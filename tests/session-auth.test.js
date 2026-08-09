import assert from 'node:assert/strict';
import process from 'node:process';
import test from 'node:test';

import handler from '../api/index.js';
import { getSessionUser } from '../server/session.js';
import { publicUser } from '../server/supabase.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';

const authUser = ({ appRole, metadataRole = 'professional' } = {}) => ({
  app_metadata: {
    provider: 'email',
    providers: ['email'],
    ...(appRole ? { role: appRole } : {}),
  },
  aud: 'authenticated',
  confirmed_at: '2026-08-01T00:00:00.000Z',
  created_at: '2026-08-01T00:00:00.000Z',
  email: 'professional@example.com',
  email_confirmed_at: '2026-08-01T00:00:00.000Z',
  id: USER_ID,
  identities: [],
  is_anonymous: false,
  last_sign_in_at: '2026-08-09T00:00:00.000Z',
  phone: '',
  role: 'authenticated',
  updated_at: '2026-08-09T00:00:00.000Z',
  user_metadata: {
    avatar_url: 'https://images.example/avatar.png',
    client_tier: 'vip',
    company: 'Metadata Company',
    full_name: 'Metadata Name',
    role: metadataRole,
    title: 'Metadata Title',
  },
});

const canonicalProfile = (role = 'professional') => ({
  avatar_url: 'https://images.example/canonical-avatar.png',
  client_tier: role === 'client' ? 'verified' : null,
  company: 'Canonical Company',
  email: 'professional@example.com',
  full_name: 'Canonical Name',
  id: USER_ID,
  role,
  title: 'Canonical Title',
});

const verifiedProfessionalProfile = {
  identity_verification_status: 'approved',
  professional_tier: 'verified',
  profile_visibility: 'visible',
  status: 'approved',
};
const ownerProfessionalProfile = {
  ...verifiedProfessionalProfile,
  pending_profile: null,
  review_status: null,
  user_id: USER_ID,
};

const restrictedVerifiedPermissions = {
  can_access_dashboard: false,
  can_appear_in_talent_pool: true,
  can_comment_on_job_posts: false,
  can_contact_clients_from_jobs: false,
  can_toggle_profile_visibility: false,
  can_view_full_client_profiles: false,
  label: 'Verified Limited',
  tier: 'verified',
};

const expectedRestrictedPermissions = {
  canAccessDashboard: false,
  canAppearInTalentPool: true,
  canCommentOnJobPosts: false,
  canContactClientsFromJobs: false,
  canToggleProfileVisibility: false,
  canViewFullClientProfiles: false,
  label: 'Verified Limited',
  tier: 'verified',
};

const expectedFailClosedVerifiedPermissions = {
  canAccessDashboard: false,
  canAppearInTalentPool: false,
  canCommentOnJobPosts: false,
  canContactClientsFromJobs: false,
  canToggleProfileVisibility: false,
  canViewFullClientProfiles: false,
  label: 'Verified',
  tier: 'verified',
};

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
});

const createSupabaseFetch = ({
  permissionBody = [restrictedVerifiedPermissions],
  permissionStatus = 200,
  ownerProfessionalProfileBody = [ownerProfessionalProfile],
  profileBody = [canonicalProfile()],
  profileStatus = 200,
  professionalProfileBody = [verifiedProfessionalProfile],
  professionalProfileStatus = 200,
  user = authUser(),
} = {}) => {
  const calls = [];
  const fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(`${url.pathname}${url.search}`);

    if (url.pathname === '/auth/v1/user') {
      return jsonResponse(user);
    }

    if (url.pathname === '/auth/v1/token') {
      return jsonResponse({
        access_token: 'access-token',
        expires_at: 1786237200,
        expires_in: 3600,
        refresh_token: 'refresh-token',
        token_type: 'bearer',
        user,
      });
    }

    if (url.pathname === '/rest/v1/profiles') {
      return jsonResponse(profileBody, profileStatus);
    }

    if (url.pathname === '/rest/v1/professional_profiles') {
      if (url.searchParams.get('select') === '*') {
        return jsonResponse(ownerProfessionalProfileBody, professionalProfileStatus);
      }

      return jsonResponse(professionalProfileBody, professionalProfileStatus);
    }

    if (url.pathname === '/rest/v1/professional_tier_permissions') {
      return jsonResponse(permissionBody, permissionStatus);
    }

    throw new Error(`Unexpected Supabase request: ${url.pathname}${url.search}`);
  };

  return { calls, fetch };
};

const withSupabaseFetch = async (fetch, callback) => {
  const previousFetch = globalThis.fetch;
  const envKeys = [
    'SUPABASE_ANON_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_URL',
  ];
  const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

  globalThis.fetch = fetch;
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-key';
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.VITE_SUPABASE_ANON_KEY;
  delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.VITE_SUPABASE_URL;

  try {
    return await callback();
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

const bearerRequest = (url = '/api/auth/me') => ({
  headers: {
    authorization: 'Bearer access-token',
    host: 'localhost',
  },
  method: 'GET',
  query: {},
  socket: { remoteAddress: '127.0.0.1' },
  url,
});

const createResponse = () => ({
  body: undefined,
  headers: {},
  statusCode: undefined,
  end() {},
  json(body) {
    this.body = body;
    return this;
  },
  setHeader(name, value) {
    this.headers[name] = value;
  },
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
});

test('public auth identity never derives authorization role or client tier from user_metadata', () => {
  const user = publicUser(authUser({ metadataRole: 'admin' }));

  assert.equal(user.role, 'client');
  assert.equal(user.clientTier, 'basic');
  assert.equal(user.name, 'Metadata Name');
});

for (const scenario of [
  { name: 'missing', profileBody: [], profileStatus: 200 },
  { name: 'unavailable', profileBody: { message: 'profiles unavailable' }, profileStatus: 503 },
]) {
  test(`session role is unresolved when the canonical profile is ${scenario.name}`, async () => {
    const supabase = createSupabaseFetch({
      profileBody: scenario.profileBody,
      profileStatus: scenario.profileStatus,
      user: authUser({ appRole: 'admin', metadataRole: 'admin' }),
    });

    const user = await withSupabaseFetch(
      supabase.fetch,
      () => getSessionUser(bearerRequest())
    );

    assert.equal(user.id, USER_ID);
    assert.equal(user.role, null);
  });
}

test('GET /auth/me enriches a verified professional from the configured permission row', async () => {
  const supabase = createSupabaseFetch();
  const req = bearerRequest();
  const res = createResponse();

  await withSupabaseFetch(supabase.fetch, () => handler(req, res));

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.professionalTier, 'verified');
  assert.equal(res.body.user.professionalTierLabel, 'Verified Limited');
  assert.deepEqual(res.body.user.professionalPermissions, expectedRestrictedPermissions);
  assert.ok(supabase.calls.some((call) => (
    call.startsWith('/rest/v1/professional_tier_permissions?')
      && call.includes('tier=eq.verified')
  )));
});

test('GET /talent/me preserves configured permissions in the private mapped profile', async () => {
  const supabase = createSupabaseFetch();
  const req = bearerRequest('/api/talent/me');
  const res = createResponse();

  await withSupabaseFetch(supabase.fetch, () => handler(req, res));

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.professionalTier, 'verified');
  assert.deepEqual(res.body.professionalPermissions, expectedRestrictedPermissions);
});

test('password session payload uses configured professional permissions', async () => {
  const supabase = createSupabaseFetch();
  const req = {
    ...bearerRequest('/api/auth/login'),
    body: { email: 'professional@example.com', password: 'password-value' },
    method: 'POST',
  };
  const res = createResponse();

  await withSupabaseFetch(supabase.fetch, () => handler(req, res));

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.professionalTier, 'verified');
  assert.deepEqual(res.body.user.professionalPermissions, expectedRestrictedPermissions);
});

test('professional capability guard denies a verified tier when its configured capability is disabled', async () => {
  const supabase = createSupabaseFetch();
  const req = {
    ...bearerRequest('/api/talent/visibility'),
    body: { profileVisibility: 'visible' },
    method: 'PATCH',
  };
  const res = createResponse();

  await withSupabaseFetch(supabase.fetch, () => handler(req, res));

  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /verified professionals can toggle profile visibility/i);
});

test('permission lookup failure preserves verified tier and denies every professional capability', async () => {
  const supabase = createSupabaseFetch({
    permissionBody: { message: 'permission table unavailable' },
    permissionStatus: 503,
  });

  const user = await withSupabaseFetch(
    supabase.fetch,
    () => getSessionUser(bearerRequest())
  );

  assert.equal(user.role, 'professional');
  assert.equal(user.professionalTier, 'verified');
  assert.deepEqual(user.professionalPermissions, expectedFailClosedVerifiedPermissions);
});
