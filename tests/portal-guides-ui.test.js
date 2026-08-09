import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

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
const clientPage = read('../src/pages/ClientPages.jsx');
const professionalPage = read('../src/pages/ProfessionalPages.jsx');

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
  assert.doesNotMatch(sharedGuide, /(?:bg|text|border)-pb-[a-z0-9-]+/i);
  assert.match(sharedGuide, /bg-action/);
});

test('actionable guide steps expose title-specific accessible button names', async (t) => {
  const vite = await createServer({
    appType: 'custom',
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
  });
  t.after(() => vite.close());

  const { PortalGuideModal } = await vite.ssrLoadModule('/src/components/PortalGuideModal.jsx');
  const TestIcon = (props) => createElement('svg', props);
  const guide = PortalGuideModal({
    description: 'Choose a workflow step.',
    eyebrow: 'Workflow guide',
    onClose: () => {},
    open: true,
    steps: [
      {
        available: true,
        description: 'Complete the profile source.',
        destination: { tab: 'profile' },
        icon: TestIcon,
        id: 'complete-profile',
        onSelect: () => {},
        statusLabel: 'Start here',
        title: 'Complete profile',
      },
      {
        available: true,
        description: 'Review matched opportunities.',
        destination: { tab: 'opportunities' },
        icon: TestIcon,
        id: 'opportunities',
        onSelect: () => {},
        statusLabel: 'Available',
        title: 'Opportunities',
      },
    ],
    title: 'Professional workflow',
  });
  const html = renderToStaticMarkup(guide.props.children);
  const accessibleNames = [...html.matchAll(/aria-label="(Open [^"]+)"/g)]
    .map((match) => match[1]);

  assert.deepEqual(accessibleNames, ['Open Complete profile', 'Open Opportunities']);
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

test('verified professional copy stays approved when dashboard destinations are restricted', async (t) => {
  const vite = await createServer({
    appType: 'custom',
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
  });
  t.after(() => vite.close());

  const { ProfessionalWorkflowOnboardingModal } = await vite.ssrLoadModule(
    '/src/components/ProfessionalWorkflowOnboardingModal.jsx'
  );
  const guide = ProfessionalWorkflowOnboardingModal({
    onClose: () => {},
    onNavigate: () => {},
    open: true,
    professionalPermissions: {
      canAccessDashboard: false,
      tier: 'verified',
    },
    user: { id: 'professional-1', name: 'Verified Professional' },
  });
  const steps = guide.props.steps;

  assert.deepEqual(steps.slice(0, 4).map((step) => step.statusLabel), [
    'Complete',
    'Approved',
    'Approved',
    'Verified',
  ]);
  assert.deepEqual(steps.slice(0, 4).map((step) => step.available), [true, true, true, true]);
  assert.deepEqual(steps.slice(4).map((step) => step.statusLabel), [
    'Access restricted',
    'Access restricted',
  ]);
  assert.deepEqual(steps.slice(4).map((step) => step.available), [false, false]);
  assert.deepEqual(steps.slice(4).map((step) => step.onSelect), [undefined, undefined]);
  for (const step of steps.slice(4)) {
    assert.match(step.description, /verification remains approved/i);
    assert.doesNotMatch(step.description, /unlock(?:s|ed)? after .*approv|approval required/i);
  }
});

test('unavailable guide footers distinguish account restriction from pending approval', async (t) => {
  const vite = await createServer({
    appType: 'custom',
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
  });
  t.after(() => vite.close());

  const [
    { PortalGuideModal },
    { ProfessionalWorkflowOnboardingModal },
  ] = await Promise.all([
    vite.ssrLoadModule('/src/components/PortalGuideModal.jsx'),
    vite.ssrLoadModule('/src/components/ProfessionalWorkflowOnboardingModal.jsx'),
  ]);
  const renderGuideContent = (professionalPermissions) => {
    const wrapper = ProfessionalWorkflowOnboardingModal({
      onClose: () => {},
      onNavigate: () => {},
      open: true,
      professionalPermissions,
      user: { id: 'professional-1', name: 'Professional' },
    });
    const guide = PortalGuideModal(wrapper.props);
    return renderToStaticMarkup(guide.props.children);
  };

  const restrictedHtml = renderGuideContent({
    canAccessDashboard: false,
    tier: 'verified',
  });
  const pendingHtml = renderGuideContent({
    canAccessDashboard: false,
    tier: 'unverified',
  });

  assert.match(restrictedHtml, /Opportunities access is restricted for this account\./);
  assert.match(restrictedHtml, /Timesheets and earnings access is restricted for this account\./);
  assert.doesNotMatch(restrictedHtml, /Available after the requirement above is complete/);
  assert.equal(
    [...pendingHtml.matchAll(/Available after the requirement above is complete/g)].length,
    2,
  );
  assert.doesNotMatch(pendingHtml, /access is restricted for this account/i);
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

test('portal shells own SSR-safe versioned first-run state and preserve manual reopening', () => {
  for (const [page, role, modal] of [
    [clientPage, 'client', 'ClientWorkflowOnboardingModal'],
    [professionalPage, 'professional', 'ProfessionalWorkflowOnboardingModal'],
  ]) {
    assert.match(page, /const guideStorage = typeof window === 'undefined' \? null : window\.localStorage/);
    assert.match(page, new RegExp(`shouldShowPortalGuide\\('${role}', user, guideStorage\\)`));
    assert.match(page, new RegExp(`markPortalGuideSeen\\('${role}', user, guideStorage\\)`));
    assert.match(page, /onGuide=\{\(\) => setShowWorkflowOnboarding\(true\)\}/);
    assert.equal([...page.matchAll(new RegExp(`<${modal}\\b`, 'g'))].length, 1);
  }
});

test('valid guide navigation marks the current guide seen and preserves unrelated query state', () => {
  for (const [page, role] of [
    [clientPage, 'client'],
    [professionalPage, 'professional'],
  ]) {
    assert.match(page, /const navigateFromGuide = useCallback/);
    assert.match(page, /const nextParams = new URLSearchParams\(searchParams\)/);
    assert.match(page, /nextParams\.set\('tab', destination\.tab\)/);
    assert.match(page, new RegExp(`markPortalGuideSeen\\('${role}', user, guideStorage\\)`));
    assert.match(page, /setShowWorkflowOnboarding\(false\)/);
  }
});
