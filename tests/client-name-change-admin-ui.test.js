import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  assert.match(verificationWorkspace, /<ClientNameChangeReview nameChangeResource=\{nameChangeResource\}/);
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

test('new admin review components compile and render through Vite SSR', {
  skip: !nameChangeReview || !verificationWorkspace,
}, async () => {
  const vite = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });

  try {
    const [{ ClientNameChangeReview }, { ClientVerificationWorkspace }] = await Promise.all([
      vite.ssrLoadModule('/src/components/ClientNameChangeReview.jsx'),
      vite.ssrLoadModule('/src/components/ClientVerificationWorkspace.jsx'),
    ]);
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
