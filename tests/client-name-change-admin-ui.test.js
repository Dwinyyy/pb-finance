import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

const waitFor = async (assertion, timeout = 5000) => {
  const deadline = Date.now() + timeout;
  let lastError;

  while (Date.now() < deadline) {
    try {
      return await assertion();
    } catch (error) {
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

  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    const callback = pending.get(message.id);
    if (!callback) return;

    pending.delete(message.id);
    if (message.error) callback.reject(new Error(message.error.message));
    else callback.resolve(message.result);
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

const openHeadlessChrome = async () => {
  const port = await getAvailablePort();
  const userDataDir = await mkdtemp(join(tmpdir(), 'pb-name-change-focus-'));
  const process = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: 'ignore' });

  const debuggerUrl = `http://127.0.0.1:${port}`;
  const targets = await waitFor(async () => {
    const response = await fetch(`${debuggerUrl}/json/list`, { signal: AbortSignal.timeout(1000) });
    assert.equal(response.ok, true);
    const pages = await response.json();
    assert.ok(pages.some((page) => page.type === 'page' && page.webSocketDebuggerUrl));
    return pages;
  });
  const page = targets.find((target) => target.type === 'page');
  const cdp = await connectToCdp(page.webSocketDebuggerUrl);

  return {
    cdp,
    close: async () => {
      cdp.close();
      process.kill();
      await new Promise((resolve) => setTimeout(resolve, 100));
      rm(userDataDir, { force: true, recursive: true }).catch(() => {});
    },
  };
};

const mountNameChangeReview = async (cdp, mode) => cdp.evaluate(`
  (async () => {
  const { default: React } = await import('/node_modules/.vite/deps/react.js');
  const { default: ReactDomClient } = await import('/node_modules/.vite/deps/react-dom_client.js');
  const { createRoot } = ReactDomClient;
  const { ClientNameChangeReview } = await import('/src/components/ClientNameChangeReview.jsx');
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
  window.fetch = (input) => {
    if (!String(input).includes('/admin/client-name-changes/decision')) {
      throw new Error('Unexpected network request: ' + input);
    }
    return new Promise((resolve) => {
      window.__resolveNameChangeDecision = () => resolve(new Response(
        JSON.stringify(${JSON.stringify(mode === 'stale' ? { error: 'Already decided.' } : { ok: true })}),
        { status: ${mode === 'stale' ? 409 : 200}, headers: { 'Content-Type': 'application/json' } }
      ));
    });
  };
  function Harness() {
    const [data, setData] = React.useState({ pendingCount: 1, requests: [request] });
    const refetch = React.useCallback(async () => {
      if (${JSON.stringify(mode)} === 'stale') throw new Error('The canonical queue is unavailable.');
      setData({ pendingCount: 0, requests: [{ ...request, status: 'approved', reviewedAt: '2026-07-17T03:00:00.000Z' }] });
    }, []);
    return React.createElement(ClientNameChangeReview, {
      nameChangeResource: { data, error: null, isLoading: false, refetch },
    });
  }
  document.body.replaceChildren(document.createElement('div'));
  window.__nameChangeRoot = createRoot(document.body.firstElementChild);
  window.__nameChangeRoot.render(React.createElement(Harness));
  })()
`);

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

test('rendered name-change decisions keep focus in the stable region through pending, history, and stale refresh errors', async () => {
  const vite = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    plugins: [{
      name: 'name-change-focus-test-page',
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
          </body></html>`);
        });
      },
    }],
    server: { port: 0 },
  });
  const browser = await openHeadlessChrome();

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

  try {
    await vite.listen();
    const url = `${vite.resolvedUrls.local[0]}__name-change-focus-test.html`;
    await browser.cdp.send('Page.navigate', { url });
    await waitFor(async () => {
      assert.equal(await browser.cdp.evaluate('document.readyState'), 'complete');
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
    await browser.close();
    await vite.close();
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
