import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const migrationsUrl = new URL('../supabase/migrations/', import.meta.url);
const migrationNames = readdirSync(migrationsUrl)
  .filter((name) => name.endsWith('_client_account_profile_and_name_changes.sql'));
const migration = migrationNames.length === 1
  ? readFileSync(new URL(migrationNames[0], migrationsUrl), 'utf8')
  : '';

const functionBlock = (source, name) => {
  const pattern = new RegExp(
    `create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`,
    'gi'
  );
  const matches = [...source.matchAll(pattern)];
  assert.ok(matches.length > 0, `${name} function is missing`);
  return matches.at(-1)[0];
};

const assertLockOrder = (source, patterns) => {
  let previousIndex = -1;
  for (const pattern of patterns) {
    const match = pattern.exec(source);
    assert.ok(match, `missing lock pattern ${pattern}`);
    assert.ok(match.index > previousIndex, `lock pattern ${pattern} is out of order`);
    previousIndex = match.index;
  }
};

test('exactly one generated client account migration exists', () => {
  assert.equal(migrationNames.length, 1);
});

for (const [label, source] of [['canonical schema', schema], ['generated migration', migration]]) {
  test(`${label} defines the protected client name-change contract`, () => {
    assert.match(source, /create table(?: if not exists)? public\.client_name_change_requests/i);
    assert.match(source, /create table(?: if not exists)? public\.client_name_change_events/i);
    assert.match(source, /where \(status = 'pending'\)/i);
    assert.match(source, /alter table public\.client_name_change_requests enable row level security/i);
    assert.match(source, /alter table public\.client_name_change_events enable row level security/i);
    assert.match(
      source,
      /create role pb_finance_profile_executor[^;]*\bnosuperuser\b[^;]*\bnocreaterole\b[^;]*\bnologin\b[^;]*\bnoinherit\b/i
    );
    assert.match(
      source,
      /alter role %I[^']*\bnosuperuser\b[^']*\bnocreaterole\b[^']*\bnologin\b[^']*\bnoinherit\b/i
    );
    assert.doesNotMatch(source, /pb_finance_profile_executor[\s\S]{0,80}bypassrls/i);
    assert.doesNotMatch(
      source,
      /create role pb_finance_profile_executor[^;]*\bbypassrls\b/i
    );
    assert.match(source, /create or replace function public\.save_client_account_profile/i);
    assert.match(source, /create or replace function public\.decide_client_name_change/i);
    assert.match(source, /security definer[\s\S]*set search_path = ''/i);
    assert.match(source, /revoke execute on function public\.save_client_account_profile[\s\S]*from public, anon, authenticated/i);
    assert.match(source, /grant execute on function public\.save_client_account_profile[\s\S]*to service_role/i);
    assert.match(source, /PB_CLIENT_NAME_CHANGE_STALE/);
    assert.match(source, /PB_CLIENT_NAME_CHANGE_PENDING/);
  });

  test(`${label} applies least privilege to name-change tables`, () => {
    for (const table of ['client_name_change_requests', 'client_name_change_events']) {
      assert.match(
        source,
        new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, 'i')
      );
      assert.match(
        source,
        new RegExp(`revoke all on table public\\.${table} from service_role`, 'i')
      );
      assert.doesNotMatch(
        source,
        new RegExp(`grant[^;]*(?:insert|update|delete)[^;]*on table public\\.${table}[^;]*to service_role`, 'i')
      );
    }

    assert.match(
      source,
      /grant select on table public\.client_name_change_requests to service_role/i
    );
    assert.doesNotMatch(
      source,
      /grant[^;]*on table public\.client_name_change_events[^;]*to service_role/i
    );
    assert.doesNotMatch(
      source,
      /grant pb_finance_profile_executor to (?:public|anon|authenticated|service_role)/i
    );
    const temporaryOwnerGrant = source.indexOf("'grant %I to %I'");
    const temporarySchemaCreateGrant = source.indexOf(
      'grant create on schema public to pb_finance_profile_executor'
    );
    const firstExecutorOwnership = source.indexOf('owner to pb_finance_profile_executor');
    const temporarySchemaCreateRevoke = source.indexOf(
      'revoke create on schema public from pb_finance_profile_executor'
    );
    const temporaryOwnerRevoke = source.indexOf("'revoke %I from %I'");
    assert.ok(temporaryOwnerGrant >= 0);
    assert.ok(temporarySchemaCreateGrant > temporaryOwnerGrant);
    assert.ok(firstExecutorOwnership > temporaryOwnerGrant);
    assert.ok(firstExecutorOwnership > temporarySchemaCreateGrant);
    assert.ok(temporarySchemaCreateRevoke > firstExecutorOwnership);
    assert.ok(temporaryOwnerRevoke > firstExecutorOwnership);
    assert.ok(temporaryOwnerRevoke > temporarySchemaCreateRevoke);
    assert.match(
      source,
      /if current_user in \('anon', 'authenticated', 'service_role'\)[\s\S]*raise exception[\s\S]*elsif current_user <> 'pb_finance_profile_executor'[\s\S]*'grant %I to %I'[\s\S]*current_user/i
    );
    assert.match(
      source,
      /if current_user <> 'pb_finance_profile_executor'[\s\S]*'revoke %I from %I'[\s\S]*current_user/i
    );
    assert.match(source, /grant usage on schema public to pb_finance_profile_executor/i);
    assert.match(
      source,
      /grant select on table public\.client_verifications to pb_finance_profile_executor/i
    );
  });

  test(`${label} limits all name-change policies to the executor`, () => {
    for (const policy of [
      'Profile executor selects profiles',
      'Profile executor updates client profiles',
      'Profile executor selects client verification',
      'Profile executor selects client companies',
      'Profile executor inserts client companies',
      'Profile executor updates client companies',
      'Profile executor selects name change requests',
      'Profile executor inserts name change requests',
      'Profile executor updates name change requests',
      'Profile executor inserts name change events',
    ]) {
      assert.match(
        source,
        new RegExp(`create policy "${policy}"[\\s\\S]{0,180}to pb_finance_profile_executor`, 'i')
      );
    }

    assert.doesNotMatch(
      source,
      /create policy "Profile executor [^"]+"[\s\S]{0,180}to (?:public|anon|authenticated|service_role)/i
    );
  });

  test(`${label} grants executor writes only to required columns`, () => {
    assert.match(
      source,
      /grant select on table public\.profiles to pb_finance_profile_executor/i
    );
    assert.match(
      source,
      /grant update \(full_name, company\) on table public\.profiles\s+to pb_finance_profile_executor/i
    );
    assert.match(
      source,
      /grant select on table public\.client_companies to pb_finance_profile_executor/i
    );
    assert.match(
      source,
      /grant insert \(owner_id, name, billing_email\) on table public\.client_companies\s+to pb_finance_profile_executor/i
    );
    assert.match(
      source,
      /grant update \(name\) on table public\.client_companies\s+to pb_finance_profile_executor/i
    );
    assert.match(
      source,
      /grant insert \(client_id, current_full_name, requested_full_name, request_reason\)[\s\S]*on table public\.client_name_change_requests[\s\S]*to pb_finance_profile_executor/i
    );
    assert.match(
      source,
      /grant update \(status, decision_reason, reviewed_at, reviewed_by\)[\s\S]*on table public\.client_name_change_requests[\s\S]*to pb_finance_profile_executor/i
    );
    assert.match(
      source,
      /grant insert \(request_id, client_id, actor_id, event_type, reason\)[\s\S]*on table public\.client_name_change_events[\s\S]*to pb_finance_profile_executor/i
    );
    assert.doesNotMatch(
      source,
      /grant (?:select, )?update on table public\.profiles to pb_finance_profile_executor/i
    );
    assert.doesNotMatch(
      source,
      /grant select, insert, update on table public\.(?:client_companies|client_name_change_requests) to pb_finance_profile_executor/i
    );
  });

  test(`${label} protects profile identity and the synchronized primary company`, () => {
    for (const fn of [
      'validate_client_profile_identity_fields',
      'prevent_protected_client_full_name_change',
      'sync_client_primary_company',
      'prevent_direct_primary_client_company_name_change',
    ]) {
      assert.match(source, new RegExp(`create or replace function public\\.${fn}`, 'i'));
      assert.match(
        source,
        new RegExp(`revoke execute on function public\\.${fn}\\(\\)\\s+from public, anon, authenticated, service_role`, 'i')
      );
      assert.match(
        source,
        new RegExp(`create trigger ${fn}[\\s\\S]{0,180}execute function public\\.${fn}\\(\\)`, 'i')
      );
    }

    assert.match(source, /before update of full_name, company on public\.profiles/i);
    assert.match(source, /before update of full_name on public\.profiles/i);
    assert.match(source, /after update of company on public\.profiles/i);
    assert.match(source, /before update of name on public\.client_companies/i);
    assert.match(source, /order by created_at, id/i);
    assert.match(
      source,
      /create index if not exists client_companies_primary_lookup_idx[\s\S]*\(owner_id, created_at, id\)/i
    );
    assert.match(source, /pb_finance\.client_name_change_approval/);
    assert.match(source, /pb_finance\.client_company_sync/);

    const protectName = functionBlock(source, 'prevent_protected_client_full_name_change');
    const syncCompany = functionBlock(source, 'sync_client_primary_company');
    const validateIdentity = functionBlock(source, 'validate_client_profile_identity_fields');
    const protectCompany = functionBlock(
      source,
      'prevent_direct_primary_client_company_name_change'
    );
    assert.match(validateIdentity, /btrim\(new\.full_name\)/i);
    assert.match(validateIdentity, /char_length\(new\.full_name\) not between 2 and 160/i);
    assert.match(validateIdentity, /char_length\(new\.company\) not between 1 and 180/i);
    assert.match(validateIdentity, /\[\[:cntrl:\]\]/i);
    assert.match(protectName, /security definer/i);
    assert.match(protectName, /set search_path = ''/i);
    assert.match(protectName, /status in \('pending_review', 'approved'\)/i);
    assert.match(protectName, /current_setting\('pb_finance\.client_name_change_approval', true\)/i);
    assert.match(syncCompany, /security definer/i);
    assert.match(syncCompany, /set search_path = ''/i);
    assert.match(syncCompany, /order by created_at, id[\s\S]*limit 1[\s\S]*for update/i);
    assert.match(syncCompany, /values \(new\.id, new\.company, new\.email\)/i);
    assert.match(protectCompany, /old\.id = v_primary_company_id/i);
    assert.match(
      source,
      /alter function public\.prevent_protected_client_full_name_change\(\)\s+owner to pb_finance_profile_executor/i
    );
    assert.match(
      source,
      /alter function public\.sync_client_primary_company\(\)\s+owner to pb_finance_profile_executor/i
    );
  });

  test(`${label} keeps profile saves and decisions atomic and ordered`, () => {
    const saveProfile = functionBlock(source, 'save_client_account_profile');
    const decideName = functionBlock(source, 'decide_client_name_change');

    assertLockOrder(saveProfile, [
      /select[^;]*from public\.profiles as profile[^;]*where profile\.id = p_client_id[^;]*for update/i,
      /select[^;]*from public\.client_verifications as verification[^;]*where verification\.client_id = p_client_id[^;]*for update/i,
      /select[^;]*from public\.client_name_change_requests as pending_request[^;]*where pending_request\.client_id = p_client_id[^;]*pending_request\.status = 'pending'[^;]*for update/i,
    ]);
    assert.match(saveProfile, /name_outcome/i);
    assert.match(saveProfile, /request_created/i);
    assert.match(saveProfile, /'unchanged'/i);
    assert.match(saveProfile, /'updated'/i);
    assert.match(saveProfile, /'pending_approval'/i);
    assert.match(saveProfile, /'request_created'/i);

    const firstDecideLock = decideName.search(/for update/i);
    const initialResolve = decideName.search(/from public\.client_name_change_requests/i);
    assert.ok(initialResolve >= 0 && initialResolve < firstDecideLock);
    assertLockOrder(decideName, [
      /select[^;]*from public\.profiles as profile[^;]*where profile\.id = v_client_id[^;]*for update/i,
      /select[^;]*from public\.client_verifications as verification[^;]*where verification\.client_id = v_client_id[^;]*for update/i,
      /select[^;]*from public\.client_name_change_requests as name_request[^;]*where name_request\.id = p_request_id[^;]*for update/i,
    ]);
    assert.match(decideName, /role = 'admin'/i);
    assert.match(decideName, /p_decision is null[\s\S]*p_decision not in \('approved', 'rejected'\)/i);
    assert.match(decideName, /set_config\('pb_finance\.client_name_change_approval', 'allowed', true\)/i);
    assert.match(decideName, /'request_approved'/i);
    assert.match(decideName, /'request_rejected'/i);

    for (const fn of ['save_client_account_profile', 'decide_client_name_change']) {
      const block = functionBlock(source, fn);
      assert.match(block, /security definer/i);
      assert.match(block, /set search_path = ''/i);
      assert.match(source, new RegExp(`alter function public\\.${fn}\\([^)]+\\)\\s+owner to pb_finance_profile_executor`, 'i'));
      assert.match(source, new RegExp(`revoke execute on function public\\.${fn}[\\s\\S]*?from public, anon, authenticated`, 'i'));
      assert.match(source, new RegExp(`grant execute on function public\\.${fn}[\\s\\S]*?to service_role`, 'i'));
    }
    assert.match(
      source,
      /revoke execute on function public\.save_client_account_profile\(uuid, text, text, text\)\s+from public, anon, authenticated/i
    );
    assert.match(
      source,
      /grant execute on function public\.save_client_account_profile\(uuid, text, text, text\)\s+to service_role/i
    );
    assert.match(
      source,
      /revoke execute on function public\.decide_client_name_change\(uuid, uuid, text, text\)\s+from public, anon, authenticated/i
    );
    assert.match(
      source,
      /grant execute on function public\.decide_client_name_change\(uuid, uuid, text, text\)\s+to service_role/i
    );
  });

  test(`${label} cancels pending name changes inside verification transitions`, () => {
    for (const fn of ['reject_client_verification', 'reset_client_verification']) {
      const block = functionBlock(source, fn);
      assertLockOrder(block, [
        /select[^;]*from public\.profiles as profile[^;]*where profile\.id = p_client_id[^;]*for update/i,
        /select[^;]*from public\.client_verifications as verification[^;]*where verification\.client_id = p_client_id[^;]*for update/i,
        /select[^;]*from public\.client_name_change_requests as pending_request[^;]*where pending_request\.client_id = p_client_id[^;]*pending_request\.status = 'pending'[^;]*for update/i,
      ]);
      assert.match(block, /status = 'cancelled'/i);
      assert.match(block, /reviewed_by = p_reviewer_id/i);
      assert.match(block, /'request_cancelled'/i);
      assert.match(block, /actor_id[\s\S]*p_reviewer_id/i);
      assert.doesNotMatch(block, /internal_review_notes[\s\S]{0,200}client_name_change_events/i);
      const transition = fn === 'reject_client_verification' ? 'rejected' : 'reset';
      assert.match(
        block,
        new RegExp(`v_cancellation_reason text := 'Cancelled because client verification was ${transition}\\.'`, 'i')
      );
    }
  });

  test(`${label} keeps verification approval in the global profile-first lock order`, () => {
    const approveVerification = functionBlock(source, 'approve_client_verification');
    assertLockOrder(approveVerification, [
      /select[^;]*from public\.profiles as profile[^;]*where profile\.id = p_client_id[^;]*for update/i,
      /select[^;]*from public\.client_verifications as verification[^;]*where verification\.client_id = p_client_id[^;]*for update/i,
    ]);
    assert.match(approveVerification, /set_config\('pb_finance\.client_verification_decision', 'allowed', true\)/i);
    assert.match(approveVerification, /verified_business_name = v_verified_business_name/i);
    assert.match(approveVerification, /client_tier = 'verified'/i);
    assert.match(approveVerification, /'verification_approved'/i);
    assert.doesNotMatch(approveVerification, /request_cancelled/i);
    assert.match(
      source,
      /revoke execute on function public\.approve_client_verification\(uuid, uuid, text, text\)\s+from public, anon, authenticated/i
    );
    assert.match(
      source,
      /grant execute on function public\.approve_client_verification\(uuid, uuid, text, text\)\s+to service_role/i
    );
  });
}
