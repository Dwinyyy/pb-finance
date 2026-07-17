import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { validateClientProfilePatch } from '../server/clientProfile.js';
import { supabaseRestRequest } from '../server/supabase.js';

const apiSource = readFileSync(new URL('../api/index.js', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../src/services/api.js', import.meta.url), 'utf8');
const supabaseSource = readFileSync(new URL('../server/supabase.js', import.meta.url), 'utf8');

const routeBlock = (route) => {
  const marker = `'${route}': async (req, res) => {`;
  const start = apiSource.indexOf(marker);
  assert.notEqual(start, -1, `missing ${route}`);
  const next = apiSource.indexOf("\n  '", start + marker.length);
  return apiSource.slice(start, next === -1 ? apiSource.length : next);
};

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
