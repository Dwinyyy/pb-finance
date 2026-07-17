import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  PORTAL_GUIDE_VERSIONS,
  getPortalGuideStorageKey,
  markPortalGuideSeen,
  shouldShowPortalGuide,
} from '../src/utils/portalGuideStorage.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sharedGuide = read('../src/components/PortalGuideModal.jsx');
const clientGuide = read('../src/components/ClientWorkflowOnboardingModal.jsx');
const professionalGuide = read('../src/components/ProfessionalWorkflowOnboardingModal.jsx');

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
};

const titlesFrom = (source, constantName) => {
  const start = source.indexOf(`const ${constantName}`);
  const end = source.indexOf('];', start);
  assert.notEqual(start, -1, `missing ${constantName}`);
  assert.notEqual(end, -1, `missing ${constantName} end`);
  return [...source.slice(start, end).matchAll(/title:\s*'([^']+)'/g)].map((match) => match[1]);
};

test('guide storage is versioned, deterministic, role-specific, and encoded per user', () => {
  assert.deepEqual(PORTAL_GUIDE_VERSIONS, { client: 'v2', professional: 'v1' });
  assert.equal(
    getPortalGuideStorageKey('client', { id: 'client/a b' }),
    'pb-finance:portal-guide:client:client%2Fa%20b:v2'
  );
  assert.equal(
    getPortalGuideStorageKey('professional', { email: 'pro+guide@example.com' }),
    'pb-finance:portal-guide:professional:pro%2Bguide%40example.com:v1'
  );
  assert.equal(getPortalGuideStorageKey('admin', { id: 'admin-1' }), '');
  assert.equal(getPortalGuideStorageKey('client', {}), '');
});

test('guide storage fails open and never leaks seen state across role or user', () => {
  const storage = createStorage();

  assert.equal(shouldShowPortalGuide('client', { id: 'client-1' }, null), true);
  assert.equal(shouldShowPortalGuide('client', { id: 'client-1' }, {
    getItem: () => { throw new Error('blocked'); },
  }), true);
  assert.equal(markPortalGuideSeen('client', { id: 'client-1' }, null), false);
  assert.equal(markPortalGuideSeen('client', { id: 'client-1' }, {
    setItem: () => { throw new Error('blocked'); },
  }), false);

  assert.equal(markPortalGuideSeen('client', { id: 'client-1' }, storage), true);
  assert.equal(shouldShowPortalGuide('client', { id: 'client-1' }, storage), false);
  assert.equal(shouldShowPortalGuide('client', { id: 'client-2' }, storage), true);
  assert.equal(shouldShowPortalGuide('professional', { id: 'client-1' }, storage), true);
});

test('shared guide delegates dialog mechanics and keeps unavailable stages visible but inert', () => {
  assert.match(sharedGuide, /<Modal/);
  assert.match(sharedGuide, /size="onboarding"/);
  assert.match(sharedGuide, /<Eyebrow/);
  assert.match(sharedGuide, /<ol/);
  assert.match(sharedGuide, /steps\.map/);
  assert.match(sharedGuide, /<StatusBadge/);
  assert.match(sharedGuide, /step\.available/);
  assert.match(sharedGuide, /step\.onSelect/);
  assert.match(sharedGuide, /Close guide/);
  assert.doesNotMatch(sharedGuide, /(?:slate|red|emerald|amber|cyan|blue|primary)-|#[0-9a-f]{3,8}/i);
});

test('client guide has exactly the approved five status-aware stages and real destinations', () => {
  assert.deepEqual(titlesFrom(clientGuide, 'CLIENT_WORKFLOW_STEPS'), [
    'Profile and verification',
    'Discover talent',
    'Shortlist',
    'Interview',
    'Contracts and billing',
  ]);
  assert.match(clientGuide, /<PortalGuideModal/);
  assert.match(clientGuide, /tab:\s*'profile'[\s\S]*section:\s*isBasicClient \? 'verification' : 'account'/);
  for (const tab of ['discover', 'shortlist', 'interviews', 'billing']) {
    assert.match(clientGuide, new RegExp(`tab:\\s*'${tab}'`));
  }
  assert.match(clientGuide, /canScheduleInterviews/);
  assert.match(clientGuide, /canViewFullDocuments/);
  assert.match(clientGuide, /shortlistLimit/);
  assert.doesNotMatch(clientGuide, /Matchmaker/i);
});

test('professional guide has exactly the approved six stages and gates dashboard destinations', () => {
  assert.deepEqual(titlesFrom(professionalGuide, 'PROFESSIONAL_WORKFLOW_STEPS'), [
    'Complete profile',
    'Identity verification',
    'Credentials',
    'Admin review',
    'Opportunities',
    'Timesheets and earnings',
  ]);
  assert.match(professionalGuide, /<PortalGuideModal/);
  assert.match(professionalGuide, /section:\s*'identity'/);
  assert.match(professionalGuide, /section:\s*'credentials'/);
  assert.match(professionalGuide, /canAccessDashboard/);
  assert.match(professionalGuide, /tab:\s*'opportunities'/);
  assert.match(professionalGuide, /tab:\s*'earnings'/);
});

test('wrappers navigate only available destinations and manual reopening depends only on open', () => {
  for (const source of [clientGuide, professionalGuide]) {
    assert.match(source, /if \(!step\.available \|\| !step\.destination\) return/);
    assert.match(source, /onNavigate\?\.\(step\.destination\)/);
    assert.match(source, /onClose\?\.\(\)/);
    assert.match(source, /open=\{open\}/);
    assert.doesNotMatch(source, /shouldShowPortalGuide|localStorage|getPortalGuideStorageKey/);
  }
});
