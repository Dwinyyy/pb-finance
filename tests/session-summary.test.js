import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { __testing as apiTesting } from '../api/index.js';
import { toActiveSessionSummary } from '../server/session.js';
import { mergeSessionSummary, normalizeSessionSummary } from '../src/utils/sessionSummary.js';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('../api/index.js', import.meta.url), 'utf8');
const clientPageSource = readFileSync(new URL('../src/pages/ClientPages.jsx', import.meta.url), 'utf8');
const clientProfileSource = readFileSync(new URL('../src/components/ClientProfileDashboard.jsx', import.meta.url), 'utf8');
const notificationHookSource = readFileSync(new URL('../src/hooks/useNotifications.js', import.meta.url), 'utf8');
const professionalPageSource = readFileSync(new URL('../src/pages/ProfessionalPages.jsx', import.meta.url), 'utf8');
const routeBlock = (route) => {
  const marker = `'${route}': async (req, res) => {`;
  const start = apiSource.indexOf(marker);
  assert.notEqual(start, -1, `missing ${route}`);
  const next = apiSource.indexOf("\n  '", start + marker.length);
  return apiSource.slice(start, next === -1 ? apiSource.length : next);
};

const clientPermissions = {
  canDiscoverAgencies: true,
  canScheduleInterviews: true,
  canUseMatchmaker: true,
  canViewFullDocuments: true,
  label: 'VIP',
  matchmakerLevel: 'pro',
  shortlistLimit: null,
  tier: 'vip',
  injectedAdminPermission: true,
};

const professionalPermissions = {
  canAccessDashboard: true,
  canAppearInTalentPool: true,
  canCommentOnJobPosts: true,
  canContactClientsFromJobs: true,
  canToggleProfileVisibility: true,
  canViewFullClientProfiles: true,
  label: 'Verified',
  tier: 'verified',
  injectedReviewerPermission: true,
};

const expectedClientPermissions = {
  canDiscoverAgencies: true,
  canScheduleInterviews: true,
  canUseMatchmaker: true,
  canViewFullDocuments: true,
  label: 'VIP',
  matchmakerLevel: 'pro',
  shortlistLimit: null,
  tier: 'vip',
};

const expectedProfessionalPermissions = {
  canAccessDashboard: true,
  canAppearInTalentPool: true,
  canCommentOnJobPosts: true,
  canContactClientsFromJobs: true,
  canToggleProfileVisibility: true,
  canViewFullClientProfiles: true,
  label: 'Verified',
  tier: 'verified',
};

test('server active session summaries allowlist aliases and nested capabilities', () => {
  const summary = toActiveSessionSummary({
    id: 'client-1',
    full_name: 'Active Name',
    company: 'Display Company',
    avatar_url: 'https://cdn.example/avatar.png',
    title: 'Approved Controller',
    client_tier: 'vip',
    clientTierLabel: 'VIP',
    clientPermissions,
    professional_tier: 'verified',
    professionalTierLabel: 'Verified',
    professionalPermissions,
    profile_visibility: 'visible',
    email: 'changed@example.com',
    role: 'admin',
    accessToken: 'secret',
    verification: { status: 'approved' },
    pending_profile: { fullName: 'Unapproved Name' },
    reviewerId: 'admin-1',
  });

  assert.deepEqual(summary, {
    id: 'client-1',
    name: 'Active Name',
    company: 'Display Company',
    avatarUrl: 'https://cdn.example/avatar.png',
    title: 'Approved Controller',
    clientTier: 'vip',
    clientTierLabel: 'VIP',
    clientPermissions: expectedClientPermissions,
    professionalTier: 'verified',
    professionalTierLabel: 'Verified',
    professionalPermissions: expectedProfessionalPermissions,
    profileVisibility: 'visible',
  });
});

test('frontend normalization exposes the same active allowlist and drops protected fields', () => {
  const normalized = normalizeSessionSummary({
    id: 'professional-1',
    fullName: 'Approved Professional',
    company: 'Approved Display Co',
    avatar_url: 'https://cdn.example/pro.png',
    title: 'Approved Accountant',
    client_tier: 'basic',
    clientTierLabel: 'Basic',
    clientPermissions,
    professional_tier: 'verified',
    professionalTierLabel: 'Verified',
    professionalPermissions,
    profile_visibility: 'hidden',
    email: 'replace@example.com',
    role: 'admin',
    refreshToken: 'secret',
    audit: { reviewer: 'admin-2' },
    unknown: 'drop me',
  });

  assert.deepEqual(normalized, {
    id: 'professional-1',
    name: 'Approved Professional',
    company: 'Approved Display Co',
    avatarUrl: 'https://cdn.example/pro.png',
    title: 'Approved Accountant',
    clientTier: 'basic',
    clientTierLabel: 'Basic',
    clientPermissions: expectedClientPermissions,
    professionalTier: 'verified',
    professionalTierLabel: 'Verified',
    professionalPermissions: expectedProfessionalPermissions,
    profileVisibility: 'hidden',
  });
});

test('session merge requires the active identity and preserves unsupplied session fields', () => {
  const current = {
    id: 'client-1',
    name: 'Old Name',
    company: 'Old Company',
    avatarUrl: 'old-avatar',
    email: 'stable@example.com',
    role: 'client',
    client_tier: 'basic',
    localSessionFact: 'preserved',
  };

  const merged = mergeSessionSummary(current, {
    id: 'client-1',
    full_name: 'New Active Name',
    avatar_url: 'new-avatar',
    client_tier: 'vip',
    clientPermissions,
    email: 'ignored@example.com',
    role: 'admin',
  });

  assert.deepEqual(merged, {
    ...current,
    name: 'New Active Name',
    avatarUrl: 'new-avatar',
    clientTier: 'vip',
    clientPermissions: expectedClientPermissions,
  });
  assert.equal(merged.company, 'Old Company');
  assert.equal(merged.email, 'stable@example.com');
  assert.equal(merged.role, 'client');
});

test('session merge refuses missing or mismatched user IDs', () => {
  const current = { id: 'client-1', name: 'Stable', role: 'client' };

  assert.equal(mergeSessionSummary(current, { name: 'No identity' }), current);
  assert.equal(mergeSessionSummary(current, { id: 'other-user', name: 'Wrong identity' }), current);
  assert.equal(mergeSessionSummary(null, { id: 'client-1', name: 'No active session' }), null);
});

test('missing summary fields never erase current active values', () => {
  const current = {
    id: 'professional-1',
    name: 'Active Name',
    title: 'Active Title',
    profileVisibility: 'visible',
  };

  assert.deepEqual(mergeSessionSummary(current, {
    id: 'professional-1',
    professionalPermissions: { canAccessDashboard: false, unknown: true },
  }), {
    ...current,
    professionalPermissions: { canAccessDashboard: false },
  });
});

test('App centralizes allowlisted session merges and coalesced canonical refreshes', () => {
  assert.match(appSource, /import \{ mergeSessionSummary \} from ['"]\.\/utils\/sessionSummary/);
  assert.match(appSource, /const userRef = useRef\(user\)/);
  assert.match(appSource, /const sessionRefreshPromiseRef = useRef\(null\)/);
  assert.match(appSource, /const handleUserUpdated = useCallback\(\(summary\) => \{/);
  assert.match(appSource, /mergeSessionSummary\(userRef\.current, summary\)/);
  assert.match(appSource, /localStorage\.setItem\('pb_user', JSON\.stringify\(nextUser\)\)/);
  assert.match(appSource, /const refreshSessionUser = useCallback\(\(\) => \{/);
  assert.match(appSource, /sessionRefreshPromiseRef\.current/);
  assert.match(appSource, /backendApi\.auth\.me\(\)[\s\S]*handleUserUpdated\(result\.user\)/);
  assert.match(appSource, /window\.addEventListener\('focus', refreshSessionUser\)/);
  assert.match(appSource, /window\.removeEventListener\('focus', refreshSessionUser\)/);

  for (const portal of ['ClientPortal', 'ProfessionalPortal']) {
    const marker = `<${portal}`;
    const start = appSource.indexOf(marker);
    assert.notEqual(start, -1, `missing ${portal}`);
    const block = appSource.slice(start, appSource.indexOf('/>', start));
    assert.match(block, /onUserUpdated=\{handleUserUpdated\}/);
    assert.match(block, /refreshSessionUser=\{refreshSessionUser\}/);
  }
});

test('notification subscriptions call a ref-held realtime callback without resubscribing on its identity', () => {
  assert.match(notificationHookSource, /export function useNotifications\(userId, \{ enabled = true, onRealtimeNotification \} = \{\}\)/);
  assert.match(notificationHookSource, /const onRealtimeNotificationRef = useRef\(onRealtimeNotification\)/);
  assert.match(notificationHookSource, /onRealtimeNotificationRef\.current = onRealtimeNotification/);
  assert.match(notificationHookSource, /onChange:\s*\(payload\) => \{[\s\S]*onRealtimeNotificationRef\.current\?\.\(payload\.new\)[\s\S]*loadNotifications\(\)/);

  const subscriptionEffect = notificationHookSource.slice(
    notificationHookSource.indexOf('if (!shouldLoad || !isRealtimeConfigured())'),
    notificationHookSource.indexOf('const markAllRead')
  );
  assert.doesNotMatch(subscriptionEffect, /\[[^\]]*onRealtimeNotification[^\]]*\]/);
});

test('client and professional shells refresh only for identity-affecting notification types', () => {
  for (const type of [
    'client_name_change_approved',
    'client_name_change_rejected',
    'client_verification_approved',
    'client_verification_rejected',
    'client_verification_reset',
  ]) {
    assert.match(clientPageSource, new RegExp(type));
  }
  assert.match(clientPageSource, /const handleRealtimeNotification[\s\S]*CLIENT_IDENTITY_NOTIFICATION_TYPES\.has[\s\S]*refreshSessionUser\(\)/);
  assert.match(clientPageSource, /onRealtimeNotification:\s*handleRealtimeNotification/);

  for (const type of [
    'profile_status_updated',
    'identity_verification_updated',
    'document_status_updated',
    'resume_status_updated',
  ]) {
    assert.match(professionalPageSource, new RegExp(type));
  }
  assert.match(professionalPageSource, /const handleRealtimeNotification[\s\S]*PROFESSIONAL_IDENTITY_NOTIFICATION_TYPES\.has[\s\S]*refreshSessionUser\(\)/);
  assert.match(professionalPageSource, /onRealtimeNotification:\s*handleRealtimeNotification/);
});

test('profile surfaces update App only with server-provided session summaries', () => {
  for (const [label, source] of [
    ['client', clientProfileSource],
    ['professional', professionalPageSource],
  ]) {
    const callbackArguments = [...source.matchAll(/onUserUpdated\(([^)]+)\)/g)]
      .map((match) => match[1].trim());

    assert.ok(callbackArguments.length > 0, `${label} profile never updates the active session`);
    assert.ok(
      callbackArguments.every((argument) => /\.sessionSummary$/.test(argument)),
      `${label} profile passed a non-summary object into the active session`
    );
  }
});

test('client mutation summaries are server-scoped so save and photo completions commute', () => {
  const saveRoute = routeBlock('PATCH /client/me');
  const photoRoute = routeBlock('POST /client/profile-photo');

  assert.match(
    saveRoute,
    /sessionSummary:\s*pickSessionSummaryFields\([\s\S]*\['id', 'name', 'company'\][\s\S]*\)/
  );
  assert.match(
    photoRoute,
    /sessionSummary:\s*pickSessionSummaryFields\([\s\S]*\['id', 'avatarUrl'\][\s\S]*\)/
  );
  assert.doesNotMatch(
    saveRoute.slice(saveRoute.indexOf('sessionSummary:')),
    /\['id', 'avatarUrl'\]/
  );
});

test('approved professional draft identity remains pending in every non-submit save path', () => {
  const currentProfile = {
    identity_verification_status: 'approved',
    pending_profile: {},
    professional_tier: 'verified',
    profile_visibility: 'visible',
    review_status: null,
    status: 'approved',
    titles: ['Approved Controller'],
    user_id: 'professional-1',
  };
  const profilePayload = {
    bio: 'Updated public bio',
    full_name: 'Pending Professional Name',
    titles: ['Pending Draft Title'],
  };
  const owner = {
    full_name: 'Approved Professional Name',
    title: 'Approved Controller',
  };
  const viewer = { clientTier: 'basic', id: 'client-1', role: 'client' };

  for (const shouldReflectCredentialDraft of [false, true]) {
    const patch = apiTesting.buildApprovedProfessionalDraftPatch({
      currentProfile,
      now: '2026-07-17T00:00:00.000Z',
      profilePayload,
      shouldReflectCredentialDraft,
    });
    const savedProfile = { ...currentProfile, ...patch };
    const mapped = apiTesting.mapTalentProfileForViewer(savedProfile, owner, viewer);

    assert.equal(Object.hasOwn(patch, 'titles'), false);
    assert.equal(savedProfile.pending_profile.full_name, 'Pending Professional Name');
    assert.deepEqual(savedProfile.pending_profile.titles, ['Pending Draft Title']);
    assert.equal(mapped.name, 'Approved Professional Name');
    assert.equal(mapped.title, 'Approved Controller');
  }
});

test('professional approval promotes pending identity and a reviewed no-pending source', () => {
  const reviewedIdentity = apiTesting.getApprovedProfessionalIdentity({
    full_name: 'Reviewed Professional Name',
    pending_profile: {},
    titles: ['Reviewed Accountant'],
  });

  assert.deepEqual(reviewedIdentity, {
    fullName: 'Reviewed Professional Name',
    titles: ['Reviewed Accountant'],
  });

  const pendingIdentity = apiTesting.toPendingProfessionalIdentity({
    full_name: 'Submitted Professional Name',
    titles: ['Submitted Controller'],
  });
  const approvedIdentity = apiTesting.getApprovedProfessionalIdentity({
    full_name: 'Old Reviewed Name',
    pending_profile: pendingIdentity,
    titles: ['Old Reviewed Title'],
  });

  assert.deepEqual(pendingIdentity, {
    full_name: 'Submitted Professional Name',
    titles: ['Submitted Controller'],
  });
  assert.deepEqual(approvedIdentity, {
    fullName: 'Submitted Professional Name',
    titles: ['Submitted Controller'],
  });
});

test('session epoch ignores an auth refresh that resolves after logout and same-user re-login', async () => {
  const callbackStart = appSource.indexOf('const handleUserUpdated =');
  const callbackEnd = appSource.indexOf('const toggleDarkMode =', callbackStart);
  const callbackSource = appSource.slice(callbackStart, callbackEnd);
  const logoutStart = appSource.indexOf('const handleLogout =');
  const logoutEnd = appSource.indexOf('  return (', logoutStart);
  const logoutSource = appSource.slice(logoutStart, logoutEnd);
  const deferred = () => {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
  };
  const staleRequest = deferred();
  const currentRequest = deferred();
  const requests = [staleRequest.promise, currentRequest.promise];
  const backendApi = {
    auth: {
      logout: async () => {},
      me: () => requests.shift(),
    },
  };
  const sessionEpochRef = { current: 0 };
  const sessionRefreshPromiseRef = { current: null };
  const userRef = {
    current: { id: 'same-user', name: 'Before logout', professionalTier: 'verified' },
  };
  let renderedUser = userRef.current;
  const storage = new Map([
    ['pb_auth_token', 'old-token'],
    ['pb_user', JSON.stringify(renderedUser)],
  ]);
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    removeItem: (key) => storage.delete(key),
    setItem: (key, value) => storage.set(key, value),
  };
  const buildCallbacks = new Function(
    'backendApi',
    'clearAuthSession',
    'handleSessionError',
    'isBackendConfigured',
    'localStorage',
    'mergeSessionSummary',
    'sessionEpochRef',
    'sessionRefreshPromiseRef',
    'setUser',
    'useCallback',
    'userRef',
    `${callbackSource}\n${logoutSource}\nreturn { handleLogout, refreshSessionUser };`,
  );
  const { handleLogout, refreshSessionUser } = buildCallbacks(
    backendApi,
    () => localStorage.removeItem('pb_auth_token'),
    () => {},
    () => true,
    localStorage,
    mergeSessionSummary,
    sessionEpochRef,
    sessionRefreshPromiseRef,
    (nextUser) => { renderedUser = nextUser; },
    (callback) => callback,
    userRef,
  );

  const staleRefresh = refreshSessionUser();
  handleLogout();

  const currentUser = {
    id: 'same-user',
    name: 'Current login',
    professionalTier: 'unverified',
  };
  userRef.current = currentUser;
  renderedUser = currentUser;
  localStorage.setItem('pb_auth_token', 'new-token');
  const currentRefresh = refreshSessionUser();

  currentRequest.resolve({ user: currentUser });
  await currentRefresh;
  staleRequest.resolve({
    user: {
      id: 'same-user',
      name: 'Stale pre-logout response',
      professionalTier: 'verified',
    },
  });
  await staleRefresh;

  assert.deepEqual(renderedUser, currentUser);
  assert.deepEqual(JSON.parse(localStorage.getItem('pb_user')), currentUser);
});
