import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const readSource = (path) => {
  try {
    return readFileSync(new URL(path, import.meta.url), 'utf8');
  } catch {
    return '';
  }
};

const nameChangeReview = readSource('../src/components/ClientNameChangeReview.jsx');
const verificationWorkspace = readSource('../src/components/ClientVerificationWorkspace.jsx');
const verificationReview = readSource('../src/components/ClientVerificationReview.jsx');
const adminPage = readSource('../src/pages/AdminPages.jsx');

const BROWSER_STARTUP_TIMEOUT_MS = 15000;
const BROWSER_STATE_TIMEOUT_MS = 15000;
const TEMPORARY_DIRECTORY_CLEANUP_TIMEOUT_MS = 10000;
const TRANSIENT_CLEANUP_ERROR_CODES = new Set(['EBUSY', 'ENOTEMPTY', 'EPERM']);

const waitFor = async (assertion, timeout = BROWSER_STATE_TIMEOUT_MS, signal) => {
  const deadline = Date.now() + timeout;
  let lastError;

  while (Date.now() < deadline) {
    if (signal?.aborted) throw signal.reason || new Error('Wait cancelled.');

    try {
      return await assertion();
    } catch (error) {
      if (signal?.aborted) throw signal.reason || error;
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  throw lastError || new Error('Timed out waiting for browser state.');
};

const connectToCdp = async (webSocketDebuggerUrl) => {
  const socket = new WebSocket(webSocketDebuggerUrl);
  const pending = new Map();
  let sequence = 0;

  const rejectPending = (error) => {
    for (const callback of pending.values()) {
      callback.reject(error);
    }
    pending.clear();
  };

  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    const callback = pending.get(message.id);
    if (!callback) return;

    pending.delete(message.id);
    if (message.error) callback.reject(new Error(message.error.message));
    else callback.resolve(message.result);
  });
  socket.addEventListener('close', () => {
    rejectPending(new Error('Chrome DevTools connection closed.'));
  });
  socket.addEventListener('error', () => {
    rejectPending(new Error('Chrome DevTools connection failed.'));
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });

  return {
    close: () => socket.close(),
    evaluate: async (expression) => {
      const result = await send('Runtime.evaluate', {
        awaitPromise: true,
        expression,
        returnByValue: true,
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      }
      return result.result.value;
    },
    send,
  };
};

const configuredChromeExecutable = process.env.PB_TEST_CHROME_EXECUTABLE || process.env.CHROME_EXECUTABLE;

const chromeExecutableCandidates = [
  process.platform === 'win32' && 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  process.platform === 'win32' && 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.platform === 'win32' && `${process.env.LOCALAPPDATA || ''}\\Google\\Chrome\\Application\\chrome.exe`,
  process.platform === 'darwin' && '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  process.platform === 'darwin' && '/Applications/Chromium.app/Contents/MacOS/Chromium',
  process.platform === 'linux' && '/usr/bin/google-chrome',
  process.platform === 'linux' && '/usr/bin/google-chrome-stable',
  process.platform === 'linux' && '/usr/bin/chromium',
  process.platform === 'linux' && '/usr/bin/chromium-browser',
].filter(Boolean);

const isFile = (path) => {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
};

const headlessChromeExecutable = configuredChromeExecutable
  ? (isFile(configuredChromeExecutable) ? configuredChromeExecutable : null)
  : chromeExecutableCandidates.find(isFile) || null;

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const closeChromeViaCdp = async (cdp) => {
  if (!cdp) return;

  await Promise.race([
    cdp.send('Browser.close').catch(() => {}),
    pause(2000),
  ]);
};

const waitForChildExit = (child, timeout = 5000) => new Promise((resolve) => {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    resolve(true);
    return;
  }

  const settle = (exited) => {
    clearTimeout(timeoutId);
    child.removeListener('exit', onExit);
    child.removeListener('error', onExit);
    resolve(exited);
  };
  const onExit = () => settle(true);
  const timeoutId = setTimeout(() => settle(false), timeout);

  child.once('exit', onExit);
  child.once('error', onExit);
});

const isProcessAlive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
};

const terminateChromeProcessTree = async (child) => {
  if (!child || child.exitCode !== null || child.signalCode !== null) return true;
  const pid = child.pid;

  if (process.platform === 'win32') {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const taskkill = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      const taskkillExited = await waitForChildExit(taskkill, 10000);
      if (!taskkillExited) {
        taskkill.kill('SIGKILL');
        await waitForChildExit(taskkill, 1000);
      }

      const childExited = await waitForChildExit(child, 5000);
      if (childExited || !isProcessAlive(pid)) return true;
    }

    try {
      child.kill('SIGKILL');
    } catch {
      // The process may have exited between the liveness check and direct fallback.
    }
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }

  return await waitForChildExit(child, 5000) || !isProcessAlive(pid);
};

const removeTemporaryDirectory = async (directory) => {
  if (!directory) return;

  const deadline = Date.now() + TEMPORARY_DIRECTORY_CLEANUP_TIMEOUT_MS;
  let attempt = 0;

  while (true) {
    try {
      await rm(directory, { force: true, recursive: true, maxRetries: 2, retryDelay: 50 });
      return;
    } catch (error) {
      if (!TRANSIENT_CLEANUP_ERROR_CODES.has(error?.code) || Date.now() >= deadline) {
        throw error;
      }

      attempt += 1;
      await pause(Math.min(50 * attempt, 500));
    }
  }
};

const readChromeDebuggerPort = async (userDataDir) => {
  const activePortFile = await readFile(join(userDataDir, 'DevToolsActivePort'), 'utf8');
  const [portValue] = activePortFile.split(/\r?\n/);
  const port = Number.parseInt(portValue, 10);
  assert.ok(Number.isInteger(port) && port > 0, 'Chrome did not publish a valid debugging port.');
  return port;
};

const closeBrowserTestResources = async ({ browser, vite, viteCacheDir }) => {
  const cleanupFailures = [];

  for (const cleanupOperation of [
    () => browser?.close(),
    () => vite?.close(),
    () => removeTemporaryDirectory(viteCacheDir),
  ]) {
    try {
      await cleanupOperation();
    } catch (error) {
      cleanupFailures.push(error);
    }
  }

  if (cleanupFailures.length > 0) throw cleanupFailures[0];
};

const openHeadlessChrome = async () => {
  if (!headlessChromeExecutable) {
    throw new Error('Headless Chrome/Chromium was not found. Set PB_TEST_CHROME_EXECUTABLE to its executable path.');
  }

  let chromeProcess;
  let cdp;
  let cleanupPromise;
  let spawnError;
  let startupReady = false;
  const userDataDir = await mkdtemp(join(tmpdir(), 'pb-name-change-focus-'));

  const close = () => {
    if (cleanupPromise) return cleanupPromise;

    cleanupPromise = (async () => {
      let terminationError = null;

      try {
        await closeChromeViaCdp(cdp);
      } catch {
        // The browser may have exited before its debugger accepted the close request.
      } finally {
        cdp?.close();
      }

      if (!spawnError && chromeProcess?.pid) {
        const exited = cdp ? await waitForChildExit(chromeProcess) : false;
        if (!exited) {
          const terminated = await terminateChromeProcessTree(chromeProcess);
          if (!terminated) {
            terminationError = new Error('Headless Chrome did not exit during test cleanup.');
          }
        }
      }

      await removeTemporaryDirectory(userDataDir);
      if (terminationError) throw terminationError;
    })();

    return cleanupPromise;
  };

  try {
    const startupAbortController = new AbortController();
    chromeProcess = spawn(headlessChromeExecutable, [
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=0',
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ], {
      detached: process.platform !== 'win32',
      stdio: 'ignore',
      windowsHide: true,
    });

    const startupFailurePromise = new Promise((resolve) => {
      chromeProcess.once('error', (error) => {
        if (startupReady) return;
        spawnError = error;
        startupAbortController.abort(error);
        resolve(error);
      });
      chromeProcess.once('exit', (code, signal) => {
        if (startupReady) return;
        const error = new Error(
          `Headless Chrome exited before its debugger was ready (code ${code ?? 'none'}, signal ${signal ?? 'none'}).`,
        );
        startupAbortController.abort(error);
        resolve(error);
      });
    });

    const targetsPromise = waitFor(async () => {
      const port = await readChromeDebuggerPort(userDataDir);
      const debuggerUrl = `http://127.0.0.1:${port}`;
      const response = await fetch(`${debuggerUrl}/json/list`, {
        signal: AbortSignal.any([AbortSignal.timeout(1000), startupAbortController.signal]),
      });
      assert.equal(response.ok, true);
      const pages = await response.json();
      assert.ok(pages.some((page) => page.type === 'page' && page.webSocketDebuggerUrl));
      return pages;
    }, BROWSER_STARTUP_TIMEOUT_MS, startupAbortController.signal).then(
      (targets) => ({ targets }),
      (error) => ({ error })
    );
    const startupResult = await Promise.race([
      startupFailurePromise.then((error) => ({ error })),
      targetsPromise,
    ]);
    if (startupResult.error) throw startupResult.error;
    startupReady = true;
    const { targets } = startupResult;
    const page = targets.find((target) => target.type === 'page');
    cdp = await connectToCdp(page.webSocketDebuggerUrl);

    return { cdp, close, userDataDir };
  } catch (error) {
    await close().catch(() => {});
    throw error;
  }
};

const mountNameChangeReview = async (cdp, mode) => cdp.evaluate(
  `window.__mountNameChangeReview(${JSON.stringify(mode)})`
);

const NAME_CHANGE_FOCUS_ENTRY_PATH = '/__name-change-focus-test-entry.jsx';
const NAME_CHANGE_FOCUS_ENTRY_ID = '\0pb-name-change-focus-test-entry';
const nameChangeFocusEntrySource = `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { ClientNameChangeReview } from '/src/components/ClientNameChangeReview.jsx';
  import { useBackendResource } from '/src/hooks/useBackendResource.js';

  const request = {
    client: { company: 'Northstar Studio', email: 'client@example.com' },
    clientId: 'client-1',
    createdAt: '2026-07-17T02:00:00.000Z',
    currentFullName: 'Avery Chen',
    id: 'request-1',
    requestReason: 'My legal name has changed.',
    requestedFullName: 'Avery Chen-Santos',
    status: 'pending',
    verificationStatus: 'approved',
  };

  window.__mountNameChangeReview = (mode) => {
    window.fetch = (input) => {
      if (!String(input).includes('/admin/client-name-changes/decision')) {
        throw new Error('Unexpected network request: ' + input);
      }

      const isStale = mode === 'stale';
      return new Promise((resolve) => {
        window.__resolveNameChangeDecision = () => resolve(new Response(
          JSON.stringify(isStale ? { error: 'Already decided.' } : { ok: true }),
          { status: isStale ? 409 : 200, headers: { 'Content-Type': 'application/json' } }
        ));
      });
    };

    function Harness() {
      const loadCountRef = React.useRef(0);
      const initialData = React.useMemo(() => ({ pendingCount: 1, requests: [request] }), []);
      const loadResource = React.useCallback(async () => {
        loadCountRef.current += 1;
        if (loadCountRef.current === 1) return initialData;
        if (mode === 'stale') throw new Error('The canonical queue is unavailable.');
        return { pendingCount: 0, requests: [{ ...request, status: 'approved', reviewedAt: '2026-07-17T03:00:00.000Z' }] };
      }, [initialData, mode]);
      const nameChangeResource = useBackendResource(loadResource, initialData);

      return React.createElement(ClientNameChangeReview, {
        nameChangeResource,
      });
    }

    document.body.replaceChildren(document.createElement('div'));
    window.__nameChangeRoot = createRoot(document.body.firstElementChild);
    window.__nameChangeRoot.render(React.createElement(Harness));
  };
`;

const ACCOUNT_MENU_FOCUS_ENTRY_PATH = '/__account-menu-focus-test-entry.jsx';
const ACCOUNT_MENU_FOCUS_ENTRY_ID = '\0pb-account-menu-focus-test-entry';
const accountMenuFocusEntrySource = `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { MemoryRouter } from 'react-router-dom';
  import { DashboardAccountMenu } from '/src/components/DashboardAccountMenu.jsx';
  import { AITalentMatchmaker } from '/src/pages/ClientPages.jsx';
  import '/src/index.css';

  const notificationState = {
    error: '',
    isLoading: false,
    loadNotifications: async () => [],
    markAllRead: async () => {},
    markRead: async () => {},
    notifications: [],
    unreadCount: 2,
  };

  window.__mountDashboardAccountMenu = ({ withMatchmaker = false } = {}) => {
    window.__accountMenuRoot?.unmount();
    document.body.replaceChildren(document.createElement('div'));
    window.__accountMenuRoot = createRoot(document.body.firstElementChild);
    window.__accountMenuRoot.render(React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          'header',
          { className: 'fixed inset-x-0 top-0 z-40 flex justify-end bg-surface p-2' },
          React.createElement(DashboardAccountMenu, {
            accountTypeLabel: 'Verified account',
            avatarUrl: '',
            companyOrContext: 'PB Finance',
            isDarkMode: false,
            name: 'Aldwin Gotingco',
            notificationState,
            onGuide: () => {},
            onLogout: () => {},
            onNotificationOpened: () => {},
            onProfile: () => {},
            onThemeToggle: () => {},
            role: 'client',
          })
        ),
        withMatchmaker
          ? React.createElement(AITalentMatchmaker, {
            clientPermissions: { label: 'Verified', matchmakerLevel: 'basic' },
          })
          : null
      )
    ));
  };
`;

test('headless Chrome cleanup removes the temporary test profile', {
  skip: headlessChromeExecutable ? false : 'Headless Chrome/Chromium was not found. Set PB_TEST_CHROME_EXECUTABLE to its executable path.',
}, async () => {
  let browser;

  try {
    browser = await openHeadlessChrome();
    assert.equal(typeof browser.userDataDir, 'string');
  } finally {
    await browser?.close();
  }

  assert.equal(existsSync(browser.userDataDir), false);
});

test('verification workspace lifts one name-change resource and exposes both sections', () => {
  assert.match(
    verificationWorkspace,
    /useBackendResource\(\s*backendApi\.admin\.listClientNameChanges,\s*EMPTY_NAME_CHANGE_DATA/
  );
  assert.match(verificationWorkspace, /Verification Cases/);
  assert.match(verificationWorkspace, /Name Changes/);
  assert.match(verificationWorkspace, /aria-current=\{section === option\.value \? 'page' : undefined\}/);
  assert.match(verificationWorkspace, /pendingCount/);
  assert.match(verificationWorkspace, /<StatusBadge/);
  assert.match(verificationWorkspace, /<ClientVerificationReview showHeading=\{false\}/);
  assert.match(
    verificationWorkspace,
    /<ClientNameChangeReview[\s\S]*?nameChangeResource=\{nameChangeResource\}/
  );
});

test('name-change queue renders complete request context with pending requests first', () => {
  assert.match(nameChangeReview, /status === 'pending'/);
  assert.match(nameChangeReview, /\.sort\(/);

  for (const field of [
    'currentFullName',
    'requestedFullName',
    'requestReason',
    'client.email',
    'client.company',
    'verificationStatus',
    'createdAt',
  ]) {
    assert.match(nameChangeReview, new RegExp(field.replace('.', '\\.')));
  }

  assert.match(nameChangeReview, /formatRequestAge\(request\.createdAt\)/);
  assert.match(nameChangeReview, /formatRequestDate\(request\.createdAt\)/);
  assert.match(nameChangeReview, /role="region"/);
  assert.match(nameChangeReview, /selectedRequest\.currentFullName/);
  assert.match(nameChangeReview, /selectedRequest\.requestedFullName/);
  assert.match(nameChangeReview, /selectedRequest\.status === 'pending'/);
});

test('pending decisions validate rejection, prevent duplicates, refresh, and handle stale responses', () => {
  assert.match(nameChangeReview, /backendApi\.admin\.decideClientNameChange\(\{/);
  assert.match(nameChangeReview, /requestId: selectedRequest\.id/);
  assert.match(nameChangeReview, /decision,/);
  assert.match(nameChangeReview, /reviewNote/);
  assert.match(nameChangeReview, /decision === 'rejected' && !reviewNote\.trim\(\)/);
  assert.match(nameChangeReview, /Review note \(optional\)/);
  assert.match(nameChangeReview, /Client-visible rejection reason/);
  assert.match(nameChangeReview, /isLoading=\{isSubmitting\}/);
  assert.match(nameChangeReview, /decisionError\.status === 409/);
  assert.match(nameChangeReview, /Another administrator already decided this request/);
  assert.ok([...nameChangeReview.matchAll(/await refetch\(\)/g)].length >= 2);
});

test('decision focus and submit locking are wired across the queue and workspace', () => {
  assert.match(nameChangeReview, /useEffect/);
  assert.match(nameChangeReview, /useRef/);
  assert.match(nameChangeReview, /decisionRegionRef/);
  assert.match(nameChangeReview, /requestButtonRefs/);
  assert.match(nameChangeReview, /focusNameChangeReviewElement\(decisionRegionRef\.current\)/);
  assert.match(nameChangeReview, /restoreNameChangeRequestFocus/);
  assert.match(nameChangeReview, /ref=\{decisionRegionRef\}/);
  assert.match(nameChangeReview, /tabIndex=\{-1\}/);
  assert.ok([...nameChangeReview.matchAll(/canChangeNameReviewContext\(isSubmitting\)/g)].length >= 2);
  assert.match(nameChangeReview, /disabled=\{isSubmitting\}[\s\S]*View history/);
  assert.match(nameChangeReview, /disabled=\{isSubmitting\}[\s\S]*Close/);

  assert.match(verificationWorkspace, /isNameChangeSubmitting/);
  assert.match(verificationWorkspace, /disabled=\{isNameChangeSubmitting\}/);
  assert.match(verificationWorkspace, /onBusyChange=\{setIsNameChangeSubmitting\}/);
});

test('known decisions remain above resource failures with decision-specific semantic tones', () => {
  assert.match(nameChangeReview, /decisionOutcome/);
  assert.match(nameChangeReview, /setDecisionOutcome\(getNameChangeDecisionOutcome\(decision\)\)/);
  assert.match(nameChangeReview, /<FeedbackMessage tone=\{decisionOutcome\.tone\}>/);
  assert.match(nameChangeReview, /persistentFeedback[\s\S]*if \(error && sortedRequests\.length === 0\)/);
  assert.match(nameChangeReview, /error && sortedRequests\.length > 0[\s\S]*if \(error && sortedRequests\.length === 0\)[\s\S]*persistentFeedback[\s\S]*Unable to load name change requests/);
  assert.match(nameChangeReview, /setDecisionOutcome\(getStaleNameChangeDecisionOutcome\(\)\)/);
});

test('queue feedback uses shared semantic primitives for all required states', () => {
  for (const primitive of ['Button', 'FormField', 'StatusBadge', 'SurfaceCard']) {
    assert.match(nameChangeReview, new RegExp(`<${primitive}`));
  }

  for (const message of [
    'Loading name change requests',
    'Retry',
    'No name change requests',
    'Name change approved',
  ]) {
    assert.match(nameChangeReview, new RegExp(message));
  }

  assert.match(nameChangeReview, /role="status"/);
  assert.match(nameChangeReview, /aria-live="polite"/);
  assert.doesNotMatch(nameChangeReview, /(?:slate|red|emerald|amber|cyan)-|#[0-9a-f]{3,8}/i);
});

test('admin routing preserves search state and supplies the name-change notification fallback', () => {
  assert.match(adminPage, /ClientVerificationWorkspace/);
  assert.match(adminPage, /searchParams\.get\('section'\)/);
  assert.match(adminPage, /\['cases', 'name-changes'\]/);
  assert.match(adminPage, /new URLSearchParams\(searchParams\)/);
  assert.match(adminPage, /nextParams\.set\('section', 'cases'\)/);
  assert.match(adminPage, /setSearchParams\(nextParams, \{ replace: true \}\)/);
  assert.match(adminPage, /section=\{activeVerificationSection\}/);
  assert.match(adminPage, /onSectionChange=\{setVerificationSection\}/);
  assert.match(
    adminPage,
    /client_name_change_requested:\s*'\/\?tab=client-verifications&section=name-changes'/
  );
  assert.match(adminPage, /notification\.actionUrl \|\| ADMIN_NOTIFICATION_ACTION_FALLBACKS\[notification\.type\]/);
});

test('existing verification review supports heading composition without changing its default', () => {
  assert.match(
    verificationReview,
    /export function ClientVerificationReview\(\{ showHeading = true \}\)/
  );
  assert.match(verificationReview, /\{showHeading && \(/);
});

test('rendered name-change decisions keep focus in the stable region through pending, history, and stale refresh errors', {
  skip: headlessChromeExecutable ? false : 'Headless Chrome/Chromium was not found. Set PB_TEST_CHROME_EXECUTABLE to its executable path.',
}, async () => {
  let vite;
  let viteCacheDir;
  let browser;

  const assertDecisionFocus = async () => {
    const activeElement = await browser.cdp.evaluate(`
      (() => ({
        activeId: document.activeElement?.id,
        activeRole: document.activeElement?.getAttribute('role'),
      }))()
    `);
    assert.deepEqual(activeElement, {
      activeId: 'name-change-decision-region',
      activeRole: 'region',
    });
  };

  const submitDecision = async () => {
    await browser.cdp.evaluate(`
      (() => {
        [...document.querySelectorAll('button')].find((button) => button.textContent.includes('Review request')).click();
        return true;
      })()
    `);
    await waitFor(async () => {
      assert.equal(await browser.cdp.evaluate(`Boolean(document.querySelector('#name-change-decision-region'))`), true);
    });
    await browser.cdp.evaluate(`
      (() => {
        [...document.querySelectorAll('button')].find((button) => button.textContent.includes('Approve')).click();
        return true;
      })()
    `);
    await waitFor(async () => {
      assert.equal(await browser.cdp.evaluate(`Boolean(document.querySelector('button[type="submit"]'))`), true);
    });
    await browser.cdp.evaluate(`
      (() => {
        const submit = document.querySelector('button[type="submit"]');
        submit.focus();
        submit.click();
        return true;
      })()
    `);
    await waitFor(async () => {
      assert.equal(await browser.cdp.evaluate(`Boolean(document.querySelector('button[type="submit"]:disabled'))`), true);
      await assertDecisionFocus();
    });
  };

  const cleanup = async () => {
    await closeBrowserTestResources({ browser, vite, viteCacheDir });
  };

  try {
    viteCacheDir = await mkdtemp(join(tmpdir(), 'pb-name-change-vite-'));
    vite = await createServer({
      appType: 'custom',
      cacheDir: viteCacheDir,
      logLevel: 'silent',
      plugins: [{
        name: 'name-change-focus-test-page',
        resolveId(source) {
          return source === NAME_CHANGE_FOCUS_ENTRY_PATH ? NAME_CHANGE_FOCUS_ENTRY_ID : null;
        },
        load(id) {
          return id === NAME_CHANGE_FOCUS_ENTRY_ID ? nameChangeFocusEntrySource : null;
        },
        configureServer(server) {
          server.middlewares.use((request, response, next) => {
            if (request.url !== '/__name-change-focus-test.html') return next();

            response.setHeader('Content-Type', 'text/html');
            response.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>
              <script type="module">
                import RefreshRuntime from '/@react-refresh';
                RefreshRuntime.injectIntoGlobalHook(window);
                window.$RefreshReg$ = () => {};
                window.$RefreshSig$ = () => (type) => type;
                window.__vite_plugin_react_preamble_installed__ = true;
              </script>
              <script type="module" src="/__name-change-focus-test-entry.jsx"></script>
            </body></html>`);
          });
        },
      }],
      server: { port: 0 },
    });
    browser = await openHeadlessChrome();
    await vite.listen();
    const url = `${vite.resolvedUrls.local[0]}__name-change-focus-test.html`;
    await browser.cdp.send('Page.navigate', { url });
    await waitFor(async () => {
      assert.equal(await browser.cdp.evaluate('typeof window.__mountNameChangeReview'), 'function');
    });

    await mountNameChangeReview(browser.cdp, 'success');
    await waitFor(async () => {
      assert.equal(await browser.cdp.evaluate(`document.body.textContent.includes('Review request')`), true);
    });
    await submitDecision();
    await browser.cdp.evaluate('window.__resolveNameChangeDecision()');
    await waitFor(async () => {
      assert.equal(await browser.cdp.evaluate(`document.body.textContent.includes('Name change history')`), true);
      await assertDecisionFocus();
    });

    await mountNameChangeReview(browser.cdp, 'stale');
    await waitFor(async () => {
      assert.equal(await browser.cdp.evaluate(`document.body.textContent.includes('Review request')`), true);
    });
    await submitDecision();
    await browser.cdp.evaluate('window.__resolveNameChangeDecision()');
    await waitFor(async () => {
      assert.equal(await browser.cdp.evaluate(`document.body.textContent.includes('The canonical queue is unavailable.')`), true);
      await assertDecisionFocus();
    });
  } finally {
    await cleanup();
  }
});

test('account menu preserves notification focus and paints above the open Matchmaker', {
  skip: headlessChromeExecutable ? false : 'Headless Chrome/Chromium was not found. Set PB_TEST_CHROME_EXECUTABLE to its executable path.',
}, async () => {
  let vite;
  let viteCacheDir;
  let browser;

  const cleanup = async () => {
    await closeBrowserTestResources({ browser, vite, viteCacheDir });
  };

  try {
    viteCacheDir = await mkdtemp(join(tmpdir(), 'pb-account-menu-vite-'));
    vite = await createServer({
      appType: 'custom',
      cacheDir: viteCacheDir,
      logLevel: 'silent',
      plugins: [{
        name: 'account-menu-focus-test-page',
        resolveId(source) {
          return source === ACCOUNT_MENU_FOCUS_ENTRY_PATH ? ACCOUNT_MENU_FOCUS_ENTRY_ID : null;
        },
        load(id) {
          return id === ACCOUNT_MENU_FOCUS_ENTRY_ID ? accountMenuFocusEntrySource : null;
        },
        configureServer(server) {
          server.middlewares.use((request, response, next) => {
            if (request.url !== '/__account-menu-focus-test.html') return next();

            response.setHeader('Content-Type', 'text/html');
            response.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>
              <script type="module">
                import RefreshRuntime from '/@react-refresh';
                RefreshRuntime.injectIntoGlobalHook(window);
                window.$RefreshReg$ = () => {};
                window.$RefreshSig$ = () => (type) => type;
                window.__vite_plugin_react_preamble_installed__ = true;
              </script>
              <script type="module" src="${ACCOUNT_MENU_FOCUS_ENTRY_PATH}"></script>
            </body></html>`);
          });
        },
      }],
      server: { port: 0 },
    });
    browser = await openHeadlessChrome();
    await vite.listen();
    const url = `${vite.resolvedUrls.local[0]}__account-menu-focus-test.html`;
    await browser.cdp.send('Page.navigate', { url });
    await waitFor(async () => {
      assert.equal(await browser.cdp.evaluate('typeof window.__mountDashboardAccountMenu'), 'function');
    });

    await browser.cdp.evaluate('window.__mountDashboardAccountMenu()');
    await waitFor(async () => {
      assert.equal(await browser.cdp.evaluate(`Boolean(document.querySelector('button[aria-controls]'))`), true);
    });
    await browser.cdp.evaluate(`
      (() => {
        const trigger = document.querySelector('button[aria-controls]');
        trigger.click();
        return true;
      })()
    `);
    await waitFor(async () => {
      assert.equal(await browser.cdp.evaluate(`Boolean(document.querySelector('[aria-label="Account actions"]'))`), true);
    });
    await browser.cdp.evaluate(`
      (() => {
        const notifications = [...document.querySelectorAll('button')]
          .find((button) => button.textContent.trim().startsWith('Notifications'));
        notifications.focus();
        notifications.click();
        return true;
      })()
    `);
    await waitFor(async () => {
      assert.equal(await browser.cdp.evaluate(`document.querySelector('h2')?.textContent`), 'Notifications');
      assert.equal(await browser.cdp.evaluate(`document.activeElement?.getAttribute('aria-label')`), 'Back to account actions');
    });

    await browser.cdp.evaluate(`
      (() => {
        document.activeElement.click();
        return true;
      })()
    `);
    await waitFor(async () => {
      assert.equal(await browser.cdp.evaluate(`Boolean(document.querySelector('[aria-label="Account actions"]'))`), true);
      assert.equal(await browser.cdp.evaluate(`document.activeElement?.textContent.trim().startsWith('Notifications')`), true);
    });

    await browser.cdp.send('Emulation.setDeviceMetricsOverride', {
      deviceScaleFactor: 1,
      height: 568,
      mobile: true,
      width: 320,
    });
    await browser.cdp.evaluate('window.__mountDashboardAccountMenu({ withMatchmaker: true })');
    await waitFor(async () => {
      assert.equal(await browser.cdp.evaluate(`Boolean(document.querySelector('[aria-label="Open AI Matchmaker"]'))`), true);
    });
    await browser.cdp.evaluate(`
      (() => {
        document.querySelector('[aria-label="Open AI Matchmaker"]').click();
        [...document.querySelectorAll('button')]
          .find((button) => button.getAttribute('aria-label')?.startsWith('Open account menu'))
          .click();
        return true;
      })()
    `);
    await waitFor(async () => {
      assert.equal(await browser.cdp.evaluate(`Boolean(document.querySelector('[aria-label="Account actions"]'))`), true);
      assert.equal(await browser.cdp.evaluate(`
        (() => {
          const matchmaker = document.querySelector('div[aria-hidden="false"]');
          if (!matchmaker) return false;
          const rect = matchmaker.getBoundingClientRect();
          return rect.width > 250 && rect.height > 300;
        })()
      `), true);
    });
    const stacking = await browser.cdp.evaluate(`
      (() => {
        const trigger = [...document.querySelectorAll('button')]
          .find((button) => button.getAttribute('aria-label')?.includes('account menu'));
        const panel = document.getElementById(trigger.getAttribute('aria-controls'));
        const matchmaker = document.querySelector('div[aria-hidden="false"]');
        const panelRect = panel.getBoundingClientRect();
        const matchmakerRect = matchmaker.getBoundingClientRect();
        const left = Math.max(panelRect.left, matchmakerRect.left);
        const right = Math.min(panelRect.right, matchmakerRect.right);
        const top = Math.max(panelRect.top, matchmakerRect.top);
        const bottom = Math.min(panelRect.bottom, matchmakerRect.bottom);
        const target = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);

        return {
          matchmakerRect: { bottom: matchmakerRect.bottom, left: matchmakerRect.left, right: matchmakerRect.right, top: matchmakerRect.top },
          overlapHeight: bottom - top,
          overlapWidth: right - left,
          panelRect: { bottom: panelRect.bottom, left: panelRect.left, right: panelRect.right, top: panelRect.top },
          panelOwnsTopElement: panel.contains(target),
        };
      })()
    `);
    assert.ok(stacking.overlapHeight > 0, JSON.stringify(stacking));
    assert.ok(stacking.overlapWidth > 0, JSON.stringify(stacking));
    assert.equal(stacking.panelOwnsTopElement, true, JSON.stringify(stacking));
  } finally {
    await cleanup();
  }
});

test('new admin review components compile and render through Vite SSR', {
  skip: !nameChangeReview || !verificationWorkspace,
}, async () => {
  const vite = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });

  try {
    const [nameChangeModule, { ClientVerificationWorkspace }] = await Promise.all([
      vite.ssrLoadModule('/src/components/ClientNameChangeReview.jsx'),
      vite.ssrLoadModule('/src/components/ClientVerificationWorkspace.jsx'),
    ]);
    const { ClientNameChangeReview } = nameChangeModule;
    const {
      canChangeNameReviewContext,
      focusNameChangeReviewElement,
      getNameChangeDecisionOutcome,
      getStaleNameChangeDecisionOutcome,
      restoreNameChangeRequestFocus,
    } = ClientNameChangeReview.interactionHelpers;

    assert.equal(typeof focusNameChangeReviewElement, 'function');
    assert.equal(typeof canChangeNameReviewContext, 'function');
    assert.equal(typeof getNameChangeDecisionOutcome, 'function');
    assert.equal(typeof getStaleNameChangeDecisionOutcome, 'function');

    let focusCount = 0;
    const focusTarget = { focus: () => { focusCount += 1; } };
    focusNameChangeReviewElement(focusTarget);
    restoreNameChangeRequestFocus(focusTarget);
    assert.equal(focusCount, 2);
    assert.equal(canChangeNameReviewContext(false), true);
    assert.equal(canChangeNameReviewContext(true), false);
    assert.deepEqual(getNameChangeDecisionOutcome('approved'), {
      message: 'Name change approved. The canonical queue is being refreshed.',
      tone: 'verified',
    });
    assert.deepEqual(getNameChangeDecisionOutcome('rejected'), {
      message: 'Name change rejected. The canonical queue is being refreshed.',
      tone: 'danger',
    });
    assert.deepEqual(getStaleNameChangeDecisionOutcome(), {
      message: 'Another administrator already decided this request. Refreshing the latest queue.',
      tone: 'warning',
    });

    const nameMarkup = renderToStaticMarkup(React.createElement(ClientNameChangeReview, {
      nameChangeResource: {
        data: {
          pendingCount: 1,
          requests: [{
            client: { company: 'Northstar Studio', email: 'client@example.com' },
            clientId: 'client-1',
            createdAt: '2026-07-17T02:00:00.000Z',
            currentFullName: 'Avery Chen',
            id: 'request-1',
            requestReason: 'My legal name has changed.',
            requestedFullName: 'Avery Chen-Santos',
            status: 'pending',
            verificationStatus: 'approved',
          }],
        },
        error: null,
        isLoading: false,
        refetch: async () => {},
      },
    }));
    const workspaceMarkup = renderToStaticMarkup(React.createElement(ClientVerificationWorkspace, {
      onSectionChange: () => {},
      section: 'cases',
    }));

    for (const text of [
      'Avery Chen',
      'Avery Chen-Santos',
      'My legal name has changed.',
      'client@example.com',
      'Northstar Studio',
      'approved',
    ]) {
      assert.match(nameMarkup, new RegExp(text));
    }
    assert.equal((workspaceMarkup.match(/<h1\b/g) || []).length, 1);
    assert.match(workspaceMarkup, /Verification Cases/);
    assert.match(workspaceMarkup, /Name Changes/);
  } finally {
    await vite.close();
  }
});
