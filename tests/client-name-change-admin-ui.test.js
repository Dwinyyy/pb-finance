import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
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

const waitFor = async (assertion, timeout = 5000, signal) => {
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

const getAvailablePort = () => new Promise((resolve, reject) => {
  const server = createNetServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    server.close((error) => (error ? reject(error) : resolve(port)));
  });
});

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

const terminateChromeProcessTree = async (child) => {
  if (!child || child.exitCode !== null || child.signalCode !== null) return true;

  if (process.platform === 'win32') {
    const taskkill = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    await waitForChildExit(taskkill, 5000);
  } else {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }

  return waitForChildExit(child, 5000);
};

const removeTemporaryDirectory = async (directory) => {
  let lastError;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await rm(directory, { force: true, recursive: true, maxRetries: 1, retryDelay: 50 });
      return;
    } catch (error) {
      lastError = error;
      await pause(50 * (attempt + 1));
    }
  }

  throw lastError;
};

const openHeadlessChrome = async () => {
  if (!headlessChromeExecutable) {
    throw new Error('Headless Chrome/Chromium was not found. Set PB_TEST_CHROME_EXECUTABLE to its executable path.');
  }

  let chromeProcess;
  let cdp;
  let cleanupPromise;
  let spawnError;
  const userDataDir = await mkdtemp(join(tmpdir(), 'pb-name-change-focus-'));

  const close = () => {
    if (cleanupPromise) return cleanupPromise;

    cleanupPromise = (async () => {
      const browserClose = closeChromeViaCdp(cdp);
      const processTreeTermination = !spawnError && chromeProcess?.pid
        ? terminateChromeProcessTree(chromeProcess)
        : null;

      try {
        await browserClose;
      } catch {
        // The browser may have exited before its debugger accepted the close request.
      } finally {
        cdp?.close();
      }

      if (processTreeTermination) {
        await processTreeTermination;
      } else if (!spawnError && chromeProcess?.pid) {
        const exited = await waitForChildExit(chromeProcess);
        if (!exited) await terminateChromeProcessTree(chromeProcess);
      }
      await pause(250);
      await removeTemporaryDirectory(userDataDir);
    })();

    return cleanupPromise;
  };

  try {
    const port = await getAvailablePort();
    const startupAbortController = new AbortController();
    chromeProcess = spawn(headlessChromeExecutable, [
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ], {
      detached: process.platform !== 'win32',
      stdio: 'ignore',
      windowsHide: true,
    });

    const spawnErrorPromise = new Promise((resolve) => {
      chromeProcess.once('error', (error) => {
        spawnError = error;
        startupAbortController.abort(error);
        resolve(error);
      });
    });

    const debuggerUrl = `http://127.0.0.1:${port}`;
    const targetsPromise = waitFor(async () => {
      const response = await fetch(`${debuggerUrl}/json/list`, {
        signal: AbortSignal.any([AbortSignal.timeout(1000), startupAbortController.signal]),
      });
      assert.equal(response.ok, true);
      const pages = await response.json();
      assert.ok(pages.some((page) => page.type === 'page' && page.webSocketDebuggerUrl));
      return pages;
    }, 5000, startupAbortController.signal).then(
      (targets) => ({ targets }),
      (error) => ({ error })
    );
    const startupResult = await Promise.race([
      spawnErrorPromise.then((error) => ({ error })),
      targetsPromise,
    ]);
    if (startupResult.error) throw startupResult.error;
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
      const [data, setData] = React.useState({ pendingCount: 1, requests: [request] });
      const refetch = React.useCallback(async () => {
        if (mode === 'stale') throw new Error('The canonical queue is unavailable.');
        setData({ pendingCount: 0, requests: [{ ...request, status: 'approved', reviewedAt: '2026-07-17T03:00:00.000Z' }] });
      }, [mode]);

      return React.createElement(ClientNameChangeReview, {
        nameChangeResource: { data, error: null, isLoading: false, refetch },
      });
    }

    document.body.replaceChildren(document.createElement('div'));
    window.__nameChangeRoot = createRoot(document.body.firstElementChild);
    window.__nameChangeRoot.render(React.createElement(Harness));
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
  assert.match(nameChangeReview, /persistentFeedback[\s\S]*if \(error\)/);
  assert.match(nameChangeReview, /if \(error\)[\s\S]*persistentFeedback[\s\S]*Unable to load name change requests/);
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
    const shutdownResults = await Promise.allSettled([
      browser?.close(),
      vite?.close(),
    ]);
    const cacheCleanupResults = await Promise.allSettled([
      viteCacheDir && removeTemporaryDirectory(viteCacheDir),
    ]);
    const cleanupFailure = [...shutdownResults, ...cacheCleanupResults]
      .find((result) => result.status === 'rejected');
    if (cleanupFailure) throw cleanupFailure.reason;
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
            response.end(`<!doctype html><html><body>
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
      assert.equal(await browser.cdp.evaluate('document.readyState'), 'complete');
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
