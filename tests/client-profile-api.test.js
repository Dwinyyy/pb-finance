import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import test from 'node:test';

import handler from '../api/index.js';
import { validateClientProfilePatch } from '../server/clientProfile.js';
import { supabaseRestRequest } from '../server/supabase.js';

const apiSource = readFileSync(new URL('../api/index.js', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../src/services/api.js', import.meta.url), 'utf8');
const supabaseSource = readFileSync(new URL('../server/supabase.js', import.meta.url), 'utf8');
const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT_ID = '22222222-2222-4222-8222-222222222222';
const NAME_REQUEST_ID = '33333333-3333-4333-8333-333333333333';
const SUPABASE_URL = 'https://project.example.supabase.co';

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
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

const createRequest = ({ body, method, path, token = 'access-token' }) => ({
  body,
  headers: {
    authorization: `Bearer ${token}`,
    host: 'localhost',
  },
  method,
  query: {},
  socket: { remoteAddress: '127.0.0.1' },
  url: `/api${path}`,
});

const withHandlerEnvironment = async (fetch, callback) => {
  const previousFetch = globalThis.fetch;
  const envKeys = [
    'BREVO_API_KEY',
    'NOTIFICATION_FROM_EMAIL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_URL',
    'WEB_PUSH_SUBJECT',
    'WEB_PUSH_VAPID_PRIVATE_KEY',
    'WEB_PUSH_VAPID_PUBLIC_KEY',
  ];
  const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

  globalThis.fetch = fetch;
  process.env.SUPABASE_URL = SUPABASE_URL;
  process.env.SUPABASE_ANON_KEY = 'anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  for (const key of envKeys) {
    if (!['SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL'].includes(key)) {
      delete process.env[key];
    }
  }

  try {
    return await callback();
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

const drainDetachedWork = async () => {
  for (let index = 0; index < 3; index += 1) {
    await new Promise((resolve) => globalThis.setImmediate(resolve));
  }
};

const authUser = (id, metadataRole) => ({
  app_metadata: { provider: 'email', providers: ['email'] },
  aud: 'authenticated',
  confirmed_at: '2026-08-01T00:00:00.000Z',
  created_at: '2026-08-01T00:00:00.000Z',
  email: `${metadataRole}@example.com`,
  email_confirmed_at: '2026-08-01T00:00:00.000Z',
  id,
  identities: [],
  is_anonymous: false,
  last_sign_in_at: '2026-08-09T00:00:00.000Z',
  phone: '',
  role: 'authenticated',
  updated_at: '2026-08-09T00:00:00.000Z',
  user_metadata: { full_name: `${metadataRole} user`, role: metadataRole },
});

const canonicalProfile = ({ avatarUrl = '', id, role }) => ({
  avatar_url: avatarUrl,
  client_tier: 'basic',
  company: role === 'client' ? 'Client Company' : 'PB Finance',
  email: `${role}@example.com`,
  full_name: `${role} user`,
  id,
  role,
  title: '',
});

const routeBlock = (route) => {
  const marker = `'${route}': async (req, res) => {`;
  const start = apiSource.indexOf(marker);
  assert.notEqual(start, -1, `missing ${route}`);
  const next = apiSource.indexOf("\n  '", start + marker.length);
  return apiSource.slice(start, next === -1 ? apiSource.length : next);
};

const createAdminDecisionFetch = () => {
  const state = {
    notificationAttempted: false,
    postCommitReads: [],
    rpcCommitted: false,
  };
  const pendingRequest = {
    client_id: CLIENT_ID,
    created_at: '2026-08-08T00:00:00.000Z',
    current_full_name: 'Current Client Name',
    decision_reason: null,
    id: NAME_REQUEST_ID,
    request_reason: 'Legal name changed.',
    requested_full_name: 'Approved Client Name',
    reviewed_at: null,
    status: 'pending',
  };
  const fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = String(init.method || 'GET').toUpperCase();

    if (url.pathname === '/auth/v1/user') {
      return jsonResponse(authUser(ADMIN_ID, 'admin'));
    }

    if (url.pathname === '/rest/v1/notifications' && method === 'POST') {
      state.notificationAttempted = true;
      return jsonResponse({ message: 'notification delivery unavailable' }, 503);
    }

    if (state.rpcCommitted && method === 'GET' && url.pathname.startsWith('/rest/v1/')) {
      state.postCommitReads.push(`${url.pathname}${url.search}`);
      throw new Error('Unexpected PostgREST read after the decision committed.');
    }

    if (url.pathname === '/rest/v1/profiles') {
      if (url.searchParams.get('id') === `eq.${ADMIN_ID}`) {
        return jsonResponse([canonicalProfile({ id: ADMIN_ID, role: 'admin' })]);
      }

      return jsonResponse([{
        company: 'Client Company',
        email: 'client@example.com',
        id: CLIENT_ID,
      }]);
    }

    if (url.pathname === '/rest/v1/client_name_change_requests') {
      return jsonResponse([pendingRequest]);
    }

    if (url.pathname === '/rest/v1/client_verifications') {
      return jsonResponse([{ client_id: CLIENT_ID, status: 'approved' }]);
    }

    if (url.pathname === '/rest/v1/rpc/decide_client_name_change' && method === 'POST') {
      state.rpcCommitted = true;
      return jsonResponse([{
        ...pendingRequest,
        decision_reason: 'Reviewed against the legal documents.',
        reviewed_at: '2026-08-09T01:02:03.000Z',
        status: 'approved',
      }]);
    }

    throw new Error(`Unexpected request: ${method} ${url.pathname}${url.search}`);
  };

  return { fetch, state };
};

const storageObjectPath = (pathname) => {
  const prefix = '/storage/v1/object/profile-photos/';

  return pathname.startsWith(prefix)
    ? pathname.slice(prefix.length).split('/').map(decodeURIComponent).join('/')
    : '';
};

const createClientPhotoFetch = ({ avatarUrl, updateSucceeds = true }) => {
  const initialProfile = canonicalProfile({ avatarUrl, id: CLIENT_ID, role: 'client' });
  const state = {
    deletedPaths: [],
    events: [],
    newPath: '',
    patchedAvatarUrl: '',
  };
  const fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = String(init.method || 'GET').toUpperCase();

    if (url.pathname === '/auth/v1/user') {
      return jsonResponse(authUser(CLIENT_ID, 'client'));
    }

    if (url.pathname === '/storage/v1/bucket' && method === 'POST') {
      return jsonResponse({ id: 'profile-photos', public: true });
    }

    if (url.pathname.startsWith('/storage/v1/object/profile-photos/')) {
      const path = storageObjectPath(url.pathname);

      if (method === 'POST') {
        state.newPath = path;
        state.events.push(`upload:${path}`);
        return jsonResponse({ Key: path });
      }

      if (method === 'DELETE') {
        state.deletedPaths.push(path);
        state.events.push(`delete:${path}`);
        return jsonResponse({});
      }
    }

    if (url.pathname === '/rest/v1/profiles' && method === 'PATCH') {
      const body = JSON.parse(String(init.body || '{}'));
      state.patchedAvatarUrl = body.avatar_url;
      state.events.push('profile-patch');

      return jsonResponse(updateSucceeds
        ? [{ ...initialProfile, avatar_url: state.patchedAvatarUrl }]
        : []);
    }

    if (url.pathname === '/rest/v1/profiles') {
      const isSessionRead = String(url.searchParams.get('select') || '').includes('title');

      return jsonResponse([{
        ...initialProfile,
        avatar_url: isSessionRead ? avatarUrl : state.patchedAvatarUrl,
      }]);
    }

    if (
      url.pathname === '/rest/v1/client_verifications'
      || url.pathname === '/rest/v1/client_name_change_requests'
    ) {
      return jsonResponse([]);
    }

    throw new Error(`Unexpected request: ${method} ${url.pathname}${url.search}`);
  };

  return { fetch, state };
};

test('admin name decision responds from the committed RPC row without fallible post-commit reads', async () => {
  const supabase = createAdminDecisionFetch();
  const req = createRequest({
    body: {
      decision: 'approved',
      decisionReason: 'Reviewed against the legal documents.',
      requestId: NAME_REQUEST_ID,
    },
    method: 'POST',
    path: '/admin/client-name-changes/decision',
  });
  const res = createResponse();

  await withHandlerEnvironment(supabase.fetch, async () => {
    await handler(req, res);
    await drainDetachedWork();
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.id, NAME_REQUEST_ID);
  assert.equal(res.body.status, 'approved');
  assert.equal(res.body.reviewedAt, '2026-08-09T01:02:03.000Z');
  assert.equal(res.body.client.email, 'client@example.com');
  assert.equal(res.body.verificationStatus, 'approved');
  assert.equal(supabase.state.rpcCommitted, true);
  assert.deepEqual(supabase.state.postCommitReads, []);
  assert.equal(supabase.state.notificationAttempted, true);
});

test('client photo replacement deletes only the prior canonical object owned by the active client', async () => {
  const ownedFile = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-old.png';
  const ownedPath = `${CLIENT_ID}/profile/${ownedFile}`;
  const cases = [
    {
      avatarUrl: `${SUPABASE_URL}/storage/v1/object/public/profile-photos/${ownedPath}`,
      expectedDeletes: [ownedPath],
      name: 'owned canonical object',
    },
    {
      avatarUrl: 'https://cdn.example.com/client-avatar.png',
      expectedDeletes: [],
      name: 'external object',
    },
    {
      avatarUrl: `${SUPABASE_URL}/storage/v1/object/public/profile-photos/44444444-4444-4444-8444-444444444444/profile/${ownedFile}`,
      expectedDeletes: [],
      name: 'another user object',
    },
  ];

  for (const scenario of cases) {
    const supabase = createClientPhotoFetch({ avatarUrl: scenario.avatarUrl });
    const req = createRequest({
      body: {
        contentType: 'image/png',
        fileData: 'data:image/png;base64,iVBORw0KGgo=',
        fileName: 'avatar.png',
      },
      method: 'POST',
      path: '/client/profile-photo',
    });
    const res = createResponse();

    await withHandlerEnvironment(supabase.fetch, () => handler(req, res));

    assert.equal(res.statusCode, 201, scenario.name);
    assert.match(supabase.state.newPath, new RegExp(`^${CLIENT_ID}/profile/[0-9a-f-]+-avatar\\.png$`), scenario.name);
    assert.deepEqual(supabase.state.deletedPaths, scenario.expectedDeletes, scenario.name);
    assert.ok(!supabase.state.deletedPaths.includes(supabase.state.newPath), scenario.name);
    assert.equal(res.body.avatarUrl, supabase.state.patchedAvatarUrl, scenario.name);

    if (scenario.expectedDeletes.length) {
      assert.ok(
        supabase.state.events.indexOf('profile-patch')
          < supabase.state.events.indexOf(`delete:${scenario.expectedDeletes[0]}`),
        `${scenario.name}: old cleanup must follow the represented update`
      );
    }
  }
});

test('failed client photo profile update removes the new object and preserves the previous one', async () => {
  const ownedFile = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb-old.png';
  const ownedPath = `${CLIENT_ID}/profile/${ownedFile}`;
  const supabase = createClientPhotoFetch({
    avatarUrl: `${SUPABASE_URL}/storage/v1/object/public/profile-photos/${ownedPath}`,
    updateSucceeds: false,
  });
  const req = createRequest({
    body: {
      contentType: 'image/png',
      fileData: 'data:image/png;base64,iVBORw0KGgo=',
      fileName: 'avatar.png',
    },
    method: 'POST',
    path: '/client/profile-photo',
  });
  const res = createResponse();

  await withHandlerEnvironment(supabase.fetch, () => handler(req, res));

  assert.equal(res.statusCode, 404);
  assert.deepEqual(supabase.state.deletedPaths, [supabase.state.newPath]);
  assert.ok(!supabase.state.deletedPaths.includes(ownedPath));
});

test('backend exposes the five client profile and admin name-change routes', () => {
  for (const route of [
    'GET /client/me',
    'PATCH /client/me',
    'POST /client/profile-photo',
    'GET /admin/client-name-changes',
    'POST /admin/client-name-changes/decision',
  ]) {
    assert.match(apiSource, new RegExp(`['"]${route.replaceAll('/', '\\/')}['"]`));
  }
});

test('frontend service merges all five methods into the existing client and admin objects', () => {
  assert.equal((serviceSource.match(/\bclient:\s*\{/g) || []).length, 1);
  assert.equal((serviceSource.match(/\badmin:\s*\{/g) || []).length, 1);

  for (const contract of [
    /getMyProfile:\s*\(\)\s*=>\s*request\('\/client\/me'\)/,
    /updateMyProfile:\s*\(payload\)\s*=>\s*request\('\/client\/me',\s*\{\s*method:\s*'PATCH',\s*body:\s*payload\s*\}\)/,
    /uploadProfilePhoto:\s*\(payload\)\s*=>\s*request\('\/client\/profile-photo',\s*\{\s*method:\s*'POST',\s*body:\s*payload\s*\}\)/,
    /listClientNameChanges:\s*\(\)\s*=>\s*request\('\/admin\/client-name-changes'\)/,
    /decideClientNameChange:\s*\(payload\)\s*=>\s*request\('\/admin\/client-name-changes\/decision',\s*\{\s*method:\s*'POST',\s*body:\s*payload\s*\}\)/,
  ]) {
    assert.match(serviceSource, contract);
  }
});

test('client profile reads use explicit selects and Task 4 allowlist mappers', () => {
  assert.match(apiSource, /const CLIENT_ACCOUNT_PROFILE_SELECT\s*=\s*'id,avatar_url,email,full_name,company,role,client_tier'/);
  assert.match(apiSource, /const CLIENT_VERIFICATION_SUMMARY_SELECT\s*=\s*'client_id,status,verified_business_name,submitted_at,reviewed_at'/);
  assert.match(apiSource, /const CLIENT_NAME_REQUEST_SELECT\s*=\s*'id,client_id,current_full_name,requested_full_name,request_reason,status,decision_reason,created_at,reviewed_at'/);
  assert.match(apiSource, /mapClientAccount\(/);
  assert.match(apiSource, /mapClientNameRequest\(/);
  assert.match(apiSource, /mapAdminClientNameRequest\(/);
  assert.match(apiSource, /client_name_change_requests[^\n]*select=\$\{CLIENT_NAME_REQUEST_SELECT\}/);
  assert.match(apiSource, /client_verifications[^\n]*select=\$\{CLIENT_VERIFICATION_SUMMARY_SELECT\}/);
});

test('client profile handlers derive ownership only from the authenticated service session', () => {
  for (const route of ['GET /client/me', 'PATCH /client/me', 'POST /client/profile-photo']) {
    const block = routeBlock(route);
    assert.match(block, /requireClientServiceSession\(req, res\)/);
    assert.match(block, /user\.id/);
    assert.doesNotMatch(block, /body\.(?:clientId|client_id|ownerId|owner_id)/);
  }

  const patch = routeBlock('PATCH /client/me');
  assert.match(patch, /validateClientProfilePatch\(/);
  assert.match(patch, /\/rpc\/save_client_account_profile/);
  assert.match(patch, /p_client_id:\s*user\.id/);
  assert.doesNotMatch(patch, /patchRows\(/);
  assert.doesNotMatch(patch, /\/profiles\?id=/);

  const injectedOwner = validateClientProfilePatch({
    clientId: '00000000-0000-4000-8000-000000000001',
    company: 'Display Co',
    fullName: 'Client Name',
  }, {
    currentName: 'Client Name',
    verificationStatus: 'draft',
  });
  assert.equal(injectedOwner.valid, false);
  assert.match(injectedOwner.errors.join(' '), /clientId/);
});

test('profile update returns only canonical mapped data and notifies admins only for a committed new request', () => {
  const block = routeBlock('PATCH /client/me');
  assert.match(block, /await writeRows[\s\S]*\/rpc\/save_client_account_profile/);
  assert.match(block, /request_created/);
  assert.match(block, /if\s*\([^)]*requestCreated[^)]*\)\s*\{[\s\S]*notifyAdmins\(/i);
  assert.match(block, /type:\s*'client_name_change_requested'/);
  assert.match(block, /actionUrl:\s*'\/\?tab=client-verifications&section=name-changes'/);
  assert.match(block, /notifyAdmins\([\s\S]*\)\.catch\(\(\)\s*=>\s*\{\}\)/);
  assert.match(block, /toClientAccountSessionSummary\(/);
  assert.match(apiSource, /toClientAccountSessionSummary[\s\S]*mapClientSessionSummary\(/);
});

test('avatar routes share the strict parser, random server object names, and cleanup failed uploads', () => {
  assert.match(apiSource, /parseProfileImageUpload\(body\)/);
  assert.match(apiSource, /const path\s*=\s*`\$\{userId\}\/profile\/\$\{randomUUID\(\)\}-\$\{fileName\}`/);
  assert.doesNotMatch(apiSource, /const path\s*=\s*`\$\{userId\}\/profile\/\$\{Date\.now\(\)\}/);
  assert.match(apiSource, /const deleteProfilePhotoFile[\s\S]*supabaseStorageRequest\([\s\S]*method:\s*'DELETE'/);

  for (const route of ['POST /client/profile-photo', 'POST /talent/profile-photo']) {
    const block = routeBlock(route);
    assert.match(block, /uploadProfilePhotoFile\(\{ body, userId: user\.id \}\)/);
    assert.match(block, /patchRows\([\s\S]*\{ avatar_url: upload\.avatarUrl \}/);
    assert.match(block, /catch \(error\)[\s\S]*upload\?\.path[\s\S]*deleteProfilePhotoFile\(upload\.path\)/);
  }

  const clientPhoto = routeBlock('POST /client/profile-photo');
  for (const field of ['avatarUrl', 'contentType', 'fileName', 'fileSize', 'sessionSummary']) {
    assert.match(clientPhoto, new RegExp(`\\b${field}\\b`));
  }
  assert.doesNotMatch(clientPhoto, /path:\s*upload\.path/);
});

test('avatar routes require one represented profile row so zero-row updates clean up the new object', () => {
  for (const route of ['POST /client/profile-photo', 'POST /talent/profile-photo']) {
    const block = routeBlock(route);

    assert.match(block, /const updatedProfiles\s*=\s*asList\(await patchRows\(/);
    assert.match(block, /prefer:\s*'return=representation'/);
    assert.doesNotMatch(block, /prefer:\s*'return=minimal'/);
    assert.match(block, /if\s*\(updatedProfiles\.length\s*!==\s*1\)[\s\S]*throw error/);
    assert.match(block, /catch \(error\)[\s\S]*upload\?\.path[\s\S]*deleteProfilePhotoFile\(upload\.path\)/);
  }
});

test('successful avatar replacements clean up only the previous owned storage object', () => {
  assert.match(apiSource, /getOwnedProfilePhotoStoragePath/);

  for (const route of ['POST /client/profile-photo', 'POST /talent/profile-photo']) {
    const block = routeBlock(route);

    assert.match(block, /const previousPhotoPath\s*=\s*getOwnedProfilePhotoStoragePath\(/);
    assert.match(block, /user\.avatar_url\s*\|\|\s*user\.avatarUrl/);
    assert.match(block, /previousPhotoPath\s*&&\s*previousPhotoPath\s*!==\s*upload\.path/);
    assert.match(block, /deleteProfilePhotoFile\(previousPhotoPath\)\.catch\(\(\)\s*=>\s*\{\}\)/);

    const updateIndex = block.indexOf('if (updatedProfiles.length !== 1)');
    const cleanupIndex = block.indexOf('deleteProfilePhotoFile(previousPhotoPath)');
    assert.ok(updateIndex < cleanupIndex, 'old photo cleanup must happen only after a represented update');
  }
});

test('admin name-change handlers require admin identity and use only the decision RPC', () => {
  for (const route of ['GET /admin/client-name-changes', 'POST /admin/client-name-changes/decision']) {
    assert.match(routeBlock(route), /requireAdmin\(req, res\)/);
  }

  const decision = routeBlock('POST /admin/client-name-changes/decision');
  assert.match(decision, /validateClientNameDecision\(body\)/);
  assert.match(decision, /\/rpc\/decide_client_name_change/);
  assert.match(decision, /p_reviewer_id:\s*user\.id/);
  assert.doesNotMatch(decision, /body\.(?:reviewerId|reviewer_id)/);
  assert.doesNotMatch(decision, /patchRows\(/);
  assert.match(decision, /classifyClientProfileDatabaseError\(error\)/);
  assert.match(decision, /type:\s*decisionValue\s*===\s*'approved'[\s\S]*client_name_change_approved[\s\S]*client_name_change_rejected/);
  assert.match(decision, /actionUrl:\s*'\/\?tab=profile&section=account'/);
  assert.match(decision, /notifyUser\([\s\S]*\)\.catch\(\(\)\s*=>\s*\{\}\)/);

  const queue = routeBlock('GET /admin/client-name-changes');
  assert.match(apiSource, /requests\.sort\(compareClientNameRequests\)/);
  assert.match(apiSource, /pendingCount:\s*requests\.filter\(\(request\)\s*=>\s*request\.status\s*===\s*'pending'\)\.length/);
  assert.match(queue, /loadAdminClientNameChangeQueue\(req\)/);
});

test('admin name decisions complete every fallible enrichment before the committing RPC', () => {
  const decision = routeBlock('POST /admin/client-name-changes/decision');
  const contextIndex = decision.indexOf('await loadAdminClientNameChange(req, requestId)');
  const rpcIndex = decision.indexOf("'/rpc/decide_client_name_change'");

  assert.notEqual(contextIndex, -1, 'decision context must be loaded before commit');
  assert.notEqual(rpcIndex, -1, 'decision RPC is missing');
  assert.ok(contextIndex < rpcIndex, 'fallible enrichment must finish before the decision commits');
  assert.match(decision, /decidedRows\s*=\s*asList\(await writeRows\(/);
  assert.match(decision, /mapAdminClientNameRequest\(\s*decidedRows\[0\]/);
  assert.doesNotMatch(decision.slice(rpcIndex), /await loadAdminClientNameChange\(/);
  assert.match(decision, /notifyUser\([\s\S]*\)\.catch\(\(\)\s*=>\s*\{\}\)/);
});

test('admin name-change queue fetches every pending request independently of limited decision history', () => {
  const start = apiSource.indexOf('const loadAdminClientNameChangeQueue = async (req) => {');
  const end = apiSource.indexOf('\nconst loadAdminClientNameChange = async', start);
  assert.notEqual(start, -1, 'missing loadAdminClientNameChangeQueue');
  assert.notEqual(end, -1, 'missing loadAdminClientNameChange boundary');
  const block = apiSource.slice(start, end);

  assert.match(block, /Promise\.all\(/);
  assert.match(block, /client_name_change_requests\?status=eq\.pending[^`\n]*order=created_at\.desc/);
  assert.match(block, /client_name_change_requests\?status=neq\.pending[^`\n]*order=created_at\.desc[^`\n]*limit=250/);
  assert.doesNotMatch(block, /status=eq\.pending[^`\n]*limit=/);
  assert.match(block, /pendingCount:\s*requests\.filter\(\(request\)\s*=>\s*request\.status\s*===\s*'pending'\)\.length/);
});

test('structured PostgREST errors preserve status and database diagnostics for 409 classification', async () => {
  assert.match(supabaseSource, /error\.body\s*=\s*data/);
  assert.match(supabaseSource, /error\.status\s*=\s*response\.status/);
  for (const field of ['code', 'details', 'hint']) {
    assert.match(supabaseSource, new RegExp(`error\\.${field}\\s*=\\s*data\\?\\.${field}`));
  }

  assert.match(apiSource, /classifyClientProfileDatabaseError\(error\)/);
  assert.match(apiSource, /sendError\(res, classified\.status, classified\.message\)/);

  const originalFetch = globalThis.fetch;
  const originalUrl = globalThis.process.env.SUPABASE_URL;
  const originalKey = globalThis.process.env.SUPABASE_ANON_KEY;
  globalThis.process.env.SUPABASE_URL = 'https://project.example.supabase.co';
  globalThis.process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  globalThis.fetch = async () => ({
    ok: false,
    status: 409,
    text: async () => JSON.stringify({
      code: '23505',
      details: 'Unique pending request conflict.',
      hint: 'Review the pending request.',
      message: 'duplicate key value violates unique constraint',
    }),
  });

  try {
    await assert.rejects(
      supabaseRestRequest('/rpc/save_client_account_profile', {
        body: {},
        method: 'POST',
      }),
      (error) => {
        assert.equal(error.status, 409);
        assert.equal(error.code, '23505');
        assert.equal(error.details, 'Unique pending request conflict.');
        assert.equal(error.hint, 'Review the pending request.');
        assert.equal(error.body.message, 'duplicate key value violates unique constraint');
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete globalThis.process.env.SUPABASE_URL;
    else globalThis.process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete globalThis.process.env.SUPABASE_ANON_KEY;
    else globalThis.process.env.SUPABASE_ANON_KEY = originalKey;
  }
});

test('client verification decisions link back to the verification section in Profile', () => {
  for (const route of [
    'POST /admin/client-verifications/decision',
    'POST /admin/client-verifications/reset',
  ]) {
    assert.match(routeBlock(route), /actionUrl:\s*'\/\?tab=profile&section=verification'/);
  }
});
