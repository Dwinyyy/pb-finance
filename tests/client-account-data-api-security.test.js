import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { PGlite } from '@electric-sql/pglite';

const sources = [
  [
    'canonical schema',
    readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'),
  ],
  [
    'generated migration',
    readFileSync(
      new URL(
        '../supabase/migrations/20260717051520_client_account_profile_and_name_changes.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  ],
];

const ids = {
  client: '00000000-0000-4000-8000-000000000011',
  otherClient: '00000000-0000-4000-8000-000000000012',
  professional: '00000000-0000-4000-8000-000000000013',
  primaryCompany: '00000000-0000-4000-8000-000000000021',
  secondaryCompany: '00000000-0000-4000-8000-000000000022',
  insertedCompany: '00000000-0000-4000-8000-000000000023',
};

const dataApiHardeningBlock = (source) => (
  source.match(
    /-- BEGIN PB FINANCE OWNER DATA API HARDENING([\s\S]*?)-- END PB FINANCE OWNER DATA API HARDENING/i,
  )?.[1] || ''
);

const functionBlock = (source, name) => {
  const matches = [...source.matchAll(new RegExp(
    `create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`,
    'gi',
  ))];
  assert.ok(matches.length, `${name} function is missing`);
  return matches.at(-1)[0];
};

const primaryCompanyTriggerBlock = (source) => {
  const match = source.match(
    /drop trigger if exists prevent_direct_primary_client_company_name_change[\s\S]*?execute function public\.prevent_direct_primary_client_company_name_change\(\);/i,
  );
  assert.ok(match, 'primary-company trigger is missing');
  return match[0];
};

const rows = async (db, sql, params = []) => (await db.query(sql, params)).rows;

const mutationAllowed = async (db, role, subject, operation) => {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${role}`);
    if (subject) {
      await rows(db, "select set_config('request.jwt.claim.sub', $1, true)", [subject]);
    }
    const result = await operation();
    return !Array.isArray(result) || result.length > 0;
  } catch {
    return false;
  } finally {
    await db.exec('rollback');
  }
};

const statementAllowed = (db, role, subject, sql) => mutationAllowed(
  db,
  role,
  subject,
  async () => {
    await db.exec(sql);
    return true;
  },
);

const createDatabase = async (source) => {
  const db = new PGlite();

  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create role migration_actor nologin createrole;
    grant authenticated, service_role to migration_actor
      with admin false, inherit false, set true;
    alter schema public owner to migration_actor;
    create schema auth authorization migration_actor;
  `);
  await db.exec('set session authorization migration_actor');
  await db.exec(`
    create function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;

    create table public.profiles (
      id uuid primary key,
      email text not null,
      full_name text,
      company text,
      role text not null check (role in ('admin', 'client', 'professional')),
      client_tier text not null default 'basic'
        check (client_tier in ('basic', 'verified', 'vip')),
      title text,
      phone text,
      avatar_url text,
      google_link_verified_at timestamptz,
      password_login_enabled_at timestamptz,
      manual_triage_required boolean not null default false,
      manual_triage_status text not null default 'clear',
      manual_triage_reason text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table public.client_companies (
      id uuid primary key default gen_random_uuid(),
      owner_id uuid not null references public.profiles(id) on delete cascade,
      name text not null,
      website text,
      industry text,
      size text,
      billing_email text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table public.client_tier_permissions (
      tier text primary key,
      can_access_matchmaker boolean not null default false
    );

    create table public.professional_tier_permissions (
      tier text primary key,
      can_access_client_directory boolean not null default false
    );

    create function public.profile_role_for(p_user_id uuid)
    returns text
    language sql
    stable
    security definer
    set search_path = public
    as $$
      select coalesce((select role from public.profiles where id = p_user_id), 'client')
    $$;

    create function public.client_tier_for(p_client_id uuid)
    returns text
    language sql
    stable
    security definer
    set search_path = public
    as $$
      select coalesce((select client_tier from public.profiles where id = p_client_id), 'basic')
    $$;

    alter table public.profiles enable row level security;
    alter table public.client_companies enable row level security;
    alter table public.client_tier_permissions enable row level security;
    alter table public.professional_tier_permissions enable row level security;

    grant usage on schema public, auth to authenticated, service_role;
    grant execute on function auth.uid() to authenticated;
    grant all on public.profiles to authenticated;
    grant all on public.client_companies to authenticated;
    grant all on public.client_tier_permissions to authenticated;
    grant all on public.professional_tier_permissions to authenticated;
    grant all on public.profiles to service_role;
    grant all on public.client_companies to service_role;
    grant all on public.client_tier_permissions to service_role;
    grant all on public.professional_tier_permissions to service_role;

    create policy "Profiles are visible to their owners"
      on public.profiles for select to authenticated
      using (auth.uid() = id);
    create policy "Profiles are editable by their owners"
      on public.profiles for update to authenticated
      using (auth.uid() = id)
      with check (
        auth.uid() = id
        and role = public.profile_role_for(id)
        and client_tier = public.client_tier_for(id)
      );
    create policy "Client companies are managed by owners"
      on public.client_companies for all to authenticated
      using (auth.uid() = owner_id)
      with check (auth.uid() = owner_id);
    create policy "Client tier permissions are readable"
      on public.client_tier_permissions for select to authenticated
      using (true);
    create policy "Professional tier permissions are readable"
      on public.professional_tier_permissions for select to authenticated
      using (true);
  `);

  const hardening = dataApiHardeningBlock(source);
  if (hardening) await db.exec(hardening);
  await db.exec(functionBlock(source, 'prevent_direct_primary_client_company_name_change'));
  await db.exec(primaryCompanyTriggerBlock(source));

  await db.query(
    `insert into public.profiles
       (id, email, full_name, company, role, client_tier, title)
     values
       ($1, 'client@example.test', 'Client Owner', 'Primary Co', 'client', 'basic', 'Client'),
       ($2, 'other@example.test', 'Other Client', 'Other Co', 'client', 'basic', 'Client'),
       ($3, 'pro@example.test', 'Professional Owner', 'Independent', 'professional', 'basic', 'Analyst')`,
    [ids.client, ids.otherClient, ids.professional],
  );
  await db.query(
    `insert into public.client_companies (id, owner_id, name, billing_email, created_at)
     values
       ($1, $3, 'Primary Co', 'client@example.test', '2026-01-01T00:00:00Z'),
       ($2, $3, 'Secondary Co', 'client@example.test', '2026-02-01T00:00:00Z')`,
    [ids.primaryCompany, ids.secondaryCompany, ids.client],
  );
  await db.exec(`
    insert into public.client_tier_permissions (tier, can_access_matchmaker)
    values ('basic', false);
    insert into public.professional_tier_permissions (tier, can_access_client_directory)
    values ('independent', false);
  `);

  return db;
};

for (const [label, source] of sources) {
  test(`${label} permits only client display-name/company owner updates`, async (t) => {
    const db = await createDatabase(source);
    t.after(() => db.close());

    const attempts = {
      email: await mutationAllowed(db, 'authenticated', ids.client, () => rows(
        db,
        `update public.profiles set email = 'spoof@example.test' where id = $1 returning id`,
        [ids.client],
      )),
      avatar: await mutationAllowed(db, 'authenticated', ids.client, () => rows(
        db,
        `update public.profiles set avatar_url = 'https://attacker.test/avatar.png' where id = $1 returning id`,
        [ids.client],
      )),
      internalStatus: await mutationAllowed(db, 'authenticated', ids.client, () => rows(
        db,
        `update public.profiles set manual_triage_status = 'approved' where id = $1 returning id`,
        [ids.client],
      )),
      title: await mutationAllowed(db, 'authenticated', ids.client, () => rows(
        db,
        `update public.profiles set title = 'Trusted administrator' where id = $1 returning id`,
        [ids.client],
      )),
      role: await mutationAllowed(db, 'authenticated', ids.client, () => rows(
        db,
        `update public.profiles set role = 'admin' where id = $1 returning id`,
        [ids.client],
      )),
      clientTier: await mutationAllowed(db, 'authenticated', ids.client, () => rows(
        db,
        `update public.profiles set client_tier = 'vip' where id = $1 returning id`,
        [ids.client],
      )),
      fullName: await mutationAllowed(db, 'authenticated', ids.client, () => rows(
        db,
        `update public.profiles set full_name = 'Updated Client' where id = $1 returning id`,
        [ids.client],
      )),
      company: await mutationAllowed(db, 'authenticated', ids.client, () => rows(
        db,
        `update public.profiles set company = 'Updated Primary Co' where id = $1 returning id`,
        [ids.client],
      )),
      otherOwner: await mutationAllowed(db, 'authenticated', ids.client, () => rows(
        db,
        `update public.profiles set company = 'Stolen Co' where id = $1 returning id`,
        [ids.otherClient],
      )),
      professionalName: await mutationAllowed(db, 'authenticated', ids.professional, () => rows(
        db,
        `update public.profiles set full_name = 'Bypassed Professional' where id = $1 returning id`,
        [ids.professional],
      )),
      serviceAvatar: await mutationAllowed(db, 'service_role', null, () => rows(
        db,
        `update public.profiles set avatar_url = 'https://pb.test/avatar.png' where id = $1 returning id`,
        [ids.client],
      )),
    };

    assert.deepEqual(attempts, {
      email: false,
      avatar: false,
      internalStatus: false,
      title: false,
      role: false,
      clientTier: false,
      fullName: true,
      company: true,
      otherOwner: false,
      professionalName: false,
      serviceAvatar: true,
    });
  });

  test(`${label} grants authenticated reads of both tier permission catalogs`, async (t) => {
    const db = await createDatabase(source);
    t.after(() => db.close());

    const attempts = {
      client: await mutationAllowed(db, 'authenticated', ids.client, () => rows(
        db,
        `select tier from public.client_tier_permissions where tier = 'basic'`,
      )),
      professional: await mutationAllowed(db, 'authenticated', ids.professional, () => rows(
        db,
        `select tier from public.professional_tier_permissions where tier = 'independent'`,
      )),
    };

    assert.deepEqual(attempts, { client: true, professional: true });
  });

  test(`${label} removes destructive table privileges and tier-catalog writes`, async (t) => {
    const db = await createDatabase(source);
    t.after(() => db.close());

    const attempts = {
      truncateProfiles: await statementAllowed(
        db,
        'authenticated',
        ids.client,
        'truncate table public.client_companies, public.profiles',
      ),
      truncateCompanies: await statementAllowed(
        db,
        'authenticated',
        ids.client,
        'truncate table public.client_companies',
      ),
      truncateClientPermissions: await statementAllowed(
        db,
        'authenticated',
        ids.client,
        'truncate table public.client_tier_permissions',
      ),
      truncateProfessionalPermissions: await statementAllowed(
        db,
        'authenticated',
        ids.professional,
        'truncate table public.professional_tier_permissions',
      ),
      updateClientPermissions: await mutationAllowed(
        db,
        'authenticated',
        ids.client,
        () => rows(
          db,
          `update public.client_tier_permissions
           set can_access_matchmaker = true
           where tier = 'basic' returning tier`,
        ),
      ),
      deleteProfessionalPermissions: await mutationAllowed(
        db,
        'authenticated',
        ids.professional,
        () => rows(
          db,
          `delete from public.professional_tier_permissions
           where tier = 'independent' returning tier`,
        ),
      ),
      serviceClientPermissions: await mutationAllowed(
        db,
        'service_role',
        null,
        () => rows(
          db,
          `update public.client_tier_permissions
           set can_access_matchmaker = true
           where tier = 'basic' returning tier`,
        ),
      ),
    };

    assert.deepEqual(attempts, {
      truncateProfiles: false,
      truncateCompanies: false,
      truncateClientPermissions: false,
      truncateProfessionalPermissions: false,
      updateClientPermissions: false,
      deleteProfessionalPermissions: false,
      serviceClientPermissions: true,
    });
  });

  test(`${label} prevents owners from replacing the earliest primary company`, async (t) => {
    const db = await createDatabase(source);
    t.after(() => db.close());

    const attempts = {
      insert: await mutationAllowed(db, 'authenticated', ids.client, () => rows(
        db,
        `insert into public.client_companies
           (id, owner_id, name, billing_email, created_at)
         values ($1, $2, 'Spoof Insert', 'client@example.test', '2025-01-01T00:00:00Z')
         returning id`,
        [ids.insertedCompany, ids.client],
      )),
      reorder: await mutationAllowed(db, 'authenticated', ids.client, () => rows(
        db,
        `update public.client_companies
         set created_at = '2025-01-01T00:00:00Z'
         where id = $1 returning id`,
        [ids.secondaryCompany],
      )),
      deletePrimary: await mutationAllowed(db, 'authenticated', ids.client, () => rows(
        db,
        `delete from public.client_companies where id = $1 returning id`,
        [ids.primaryCompany],
      )),
      renamePrimary: await mutationAllowed(db, 'authenticated', ids.client, () => rows(
        db,
        `update public.client_companies set name = 'Spoof Primary' where id = $1 returning id`,
        [ids.primaryCompany],
      )),
      renameSecondary: await mutationAllowed(db, 'authenticated', ids.client, () => rows(
        db,
        `update public.client_companies set name = 'Secondary Renamed' where id = $1 returning id`,
        [ids.secondaryCompany],
      )),
      editSecondaryDetails: await mutationAllowed(db, 'authenticated', ids.client, () => rows(
        db,
        `update public.client_companies set website = 'https://secondary.test' where id = $1 returning id`,
        [ids.secondaryCompany],
      )),
      serviceInsert: await mutationAllowed(db, 'service_role', null, () => rows(
        db,
        `insert into public.client_companies
           (owner_id, name, billing_email)
         values ($1, 'Server Managed Co', 'client@example.test') returning id`,
        [ids.client],
      )),
    };

    assert.deepEqual(attempts, {
      insert: false,
      reorder: false,
      deletePrimary: false,
      renamePrimary: false,
      renameSecondary: true,
      editSecondaryDetails: true,
      serviceInsert: true,
    });
  });
}
