import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

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
  assert.match(clientPageSource, /onRealtimeNotification:[\s\S]*refreshSessionUser\(\)/);

  for (const type of [
    'profile_status_updated',
    'identity_verification_updated',
    'document_status_updated',
    'resume_status_updated',
  ]) {
    assert.match(professionalPageSource, new RegExp(type));
  }
  assert.match(professionalPageSource, /onRealtimeNotification:[\s\S]*refreshSessionUser\(\)/);
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
