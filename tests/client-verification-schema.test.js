import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');

test('schema creates the client verification case evidence and audit tables', () => {
  assert.match(schema, /create table if not exists public\.client_verifications/i);
  assert.match(schema, /create table if not exists public\.client_verification_documents/i);
  assert.match(schema, /create table if not exists public\.client_verification_events/i);
});

test('schema enforces the protected legal business name invariant', () => {
  assert.match(schema, /verified_business_name text/i);
  assert.match(
    schema,
    /status = 'approved'[\s\S]*nullif\(btrim\(verified_business_name\), ''\) is not null[\s\S]*status <> 'approved'[\s\S]*verified_business_name is null/i
  );
});

test('schema restricts evidence kinds and business document types', () => {
  assert.match(schema, /kind in \('valid_id', 'liveness_selfie', 'profile_photo', 'business_proof'\)/i);
  assert.match(schema, /business_document_type in \('cp575_ein_letter', 'state_business_registration', 'eu_vat_certificate'\)/i);
  assert.match(schema, /unique[\s\S]*client_id[\s\S]*kind[\s\S]*where is_current/i);
});

test('all exposed verification tables enable RLS and explicitly grant service role access', () => {
  for (const table of [
    'client_verifications',
    'client_verification_documents',
    'client_verification_events',
  ]) {
    assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    assert.match(schema, new RegExp(`grant select, insert, update, delete on table public\\.${table} to service_role`, 'i'));
  }
});

test('owner policies are select-only and scoped with auth uid', () => {
  assert.match(schema, /Client verification cases are visible to owners[\s\S]*for select[\s\S]*auth\.uid\(\)\)?\s*=\s*client_id/i);
  assert.match(schema, /Client verification documents are visible to owners[\s\S]*for select[\s\S]*auth\.uid\(\)\)?\s*=\s*client_id/i);
  assert.doesNotMatch(schema, /Client verification[^\n]*owners[\s\S]{0,120}for (insert|update|delete)/i);
});

test('decision RPCs are service-role only', () => {
  for (const fn of [
    'register_client_verification_document',
    'submit_client_verification',
    'approve_client_verification',
    'reject_client_verification',
    'reset_client_verification',
  ]) {
    assert.match(schema, new RegExp(`create or replace function public\\.${fn}`, 'i'));
    assert.match(schema, new RegExp(`revoke execute on function public\\.${fn}[\\s\\S]*from public, anon, authenticated`, 'i'));
    assert.match(schema, new RegExp(`grant execute on function public\\.${fn}[\\s\\S]*to service_role`, 'i'));
  }
});

test('verification rejection and reset replace pending protected-name requests atomically', () => {
  const getLatestFunction = (name) => {
    const pattern = new RegExp(
      `create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`,
      'gi'
    );
    const matches = [...schema.matchAll(pattern)];
    assert.ok(matches.length > 0, `${name} function is missing`);
    return matches.at(-1)[0];
  };

  for (const fn of ['reject_client_verification', 'reset_client_verification']) {
    const source = getLatestFunction(fn);
    const profileLock = source.search(
      /select[^;]*from public\.profiles as profile[^;]*where profile\.id = p_client_id[^;]*for update/i
    );
    const verificationLock = source.search(
      /select[^;]*from public\.client_verifications as verification[^;]*where verification\.client_id = p_client_id[^;]*for update/i
    );
    const requestLock = source.search(
      /select[^;]*from public\.client_name_change_requests as pending_request[^;]*where pending_request\.client_id = p_client_id[^;]*pending_request\.status = 'pending'[^;]*for update/i
    );

    assert.ok(profileLock >= 0);
    assert.ok(verificationLock > profileLock);
    assert.ok(requestLock > verificationLock);
    assert.match(source, /status = 'cancelled'/i);
    assert.match(source, /'request_cancelled'/i);
    assert.match(source, /reviewed_by = p_reviewer_id/i);
    const transition = fn === 'reject_client_verification' ? 'rejected' : 'reset';
    assert.match(
      source,
      new RegExp(`Cancelled because client verification was ${transition}\\.`, 'i')
    );
  }
});

test('verification approval follows the global profile then verification lock order', () => {
  const pattern = /create or replace function public\.approve_client_verification\([\s\S]*?\$\$;/gi;
  const matches = [...schema.matchAll(pattern)];
  assert.ok(matches.length > 0, 'approve_client_verification function is missing');
  const source = matches.at(-1)[0];
  const profileLock = source.search(
    /select[^;]*from public\.profiles as profile[^;]*where profile\.id = p_client_id[^;]*for update/i
  );
  const verificationLock = source.search(
    /select[^;]*from public\.client_verifications as verification[^;]*where verification\.client_id = p_client_id[^;]*for update/i
  );

  assert.ok(profileLock >= 0);
  assert.ok(verificationLock > profileLock);
  assert.match(source, /'verification_approved'/i);
  assert.doesNotMatch(source, /request_cancelled/i);
});
