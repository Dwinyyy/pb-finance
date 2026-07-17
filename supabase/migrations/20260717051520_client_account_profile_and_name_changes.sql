-- Protected client account names and their immutable review history.
create table if not exists public.client_name_change_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  current_full_name text not null,
  requested_full_name text not null,
  request_reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decision_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    current_full_name = btrim(current_full_name)
    and char_length(current_full_name) between 2 and 160
  ),
  check (
    requested_full_name = btrim(requested_full_name)
    and char_length(requested_full_name) between 2 and 160
  ),
  check (current_full_name <> requested_full_name),
  check (
    request_reason = btrim(request_reason)
    and char_length(request_reason) between 1 and 1000
  ),
  check (
    current_full_name !~ '[[:cntrl:]]'
    and requested_full_name !~ '[[:cntrl:]]'
    and request_reason !~ '[[:cntrl:]]'
  ),
  check (
    (
      status = 'pending'
      and reviewed_at is null
      and reviewed_by is null
      and decision_reason is null
    )
    or (
      status <> 'pending'
      and reviewed_at is not null
      and reviewed_by is not null
    )
  ),
  check (
    decision_reason is null
    or (
      decision_reason = btrim(decision_reason)
      and char_length(decision_reason) between 1 and 1000
      and decision_reason !~ '[[:cntrl:]]'
    )
  ),
  check (status <> 'rejected' or decision_reason is not null)
);

create unique index if not exists client_name_change_requests_one_pending_per_client_idx
  on public.client_name_change_requests(client_id) where (status = 'pending');
create index if not exists client_name_change_requests_client_history_idx
  on public.client_name_change_requests(client_id, created_at desc);
create index if not exists client_name_change_requests_admin_queue_idx
  on public.client_name_change_requests(status, created_at desc);
create index if not exists client_name_change_requests_reviewer_idx
  on public.client_name_change_requests(reviewed_by);

create table if not exists public.client_name_change_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.client_name_change_requests(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null
    check (
      event_type in (
        'request_created',
        'request_approved',
        'request_rejected',
        'request_cancelled'
      )
    ),
  reason text,
  created_at timestamptz not null default now(),
  check (
    reason is null
    or (
      reason = btrim(reason)
      and char_length(reason) between 1 and 1000
      and reason !~ '[[:cntrl:]]'
    )
  )
);

create index if not exists client_name_change_events_request_idx
  on public.client_name_change_events(request_id);
create index if not exists client_name_change_events_client_history_idx
  on public.client_name_change_events(client_id, created_at desc);
create index if not exists client_name_change_events_actor_idx
  on public.client_name_change_events(actor_id);
create index if not exists client_companies_primary_lookup_idx
  on public.client_companies(owner_id, created_at, id);

drop trigger if exists set_client_name_change_requests_updated_at
  on public.client_name_change_requests;
create trigger set_client_name_change_requests_updated_at
  before update on public.client_name_change_requests
  for each row
  execute function public.set_updated_at();

-- This NOLOGIN role is the narrowly privileged owner of the account RPCs and
-- privileged lookup/synchronization triggers. It deliberately remains subject
-- to RLS instead of relying on an API role's broad capabilities.
do $$
begin
  if not exists (
    select 1
    from pg_roles
    where rolname = 'pb_finance_profile_executor'
  ) then
    create role pb_finance_profile_executor
      nosuperuser nocreatedb nocreaterole noreplication nologin noinherit;
  else
    execute format(
      'alter role %I nosuperuser nocreatedb nocreaterole noreplication nologin noinherit no%s%s',
      'pb_finance_' || 'profile_executor',
      'bypass',
      'rls'
    );
  end if;
end
$$;

do $$
begin
  if current_user in ('anon', 'authenticated', 'service_role')
    or current_user = 'authenticator' then
    raise exception 'API roles may not administer the profile executor.';
  elsif current_user <> 'pb_finance_profile_executor' then
    if current_setting('server_version_num')::integer >= 160000 then
      execute format(
        'grant %I to %I with admin false, inherit false, set true',
        'pb_finance_profile_executor',
        current_user
      );
    else
      execute format(
        'grant %I to %I',
        'pb_finance_profile_executor',
        current_user
      );
    end if;
  end if;
end
$$;

grant create on schema public to pb_finance_profile_executor;
grant usage on schema public to pb_finance_profile_executor;
grant select on table public.profiles to pb_finance_profile_executor;
grant update (full_name, company) on table public.profiles
  to pb_finance_profile_executor;
grant select on table public.client_verifications to pb_finance_profile_executor;
grant update (updated_at) on table public.client_verifications
  to pb_finance_profile_executor;
grant select on table public.client_companies to pb_finance_profile_executor;
grant insert (owner_id, name, billing_email) on table public.client_companies
  to pb_finance_profile_executor;
grant update (name) on table public.client_companies
  to pb_finance_profile_executor;
grant select on table public.client_name_change_requests to pb_finance_profile_executor;
grant insert (client_id, current_full_name, requested_full_name, request_reason)
  on table public.client_name_change_requests
  to pb_finance_profile_executor;
grant update (status, decision_reason, reviewed_at, reviewed_by)
  on table public.client_name_change_requests
  to pb_finance_profile_executor;
grant insert (request_id, client_id, actor_id, event_type, reason)
  on table public.client_name_change_events
  to pb_finance_profile_executor;

alter table public.client_name_change_requests enable row level security;
alter table public.client_name_change_events enable row level security;

revoke all on table public.client_name_change_requests from public, anon, authenticated;
revoke all on table public.client_name_change_events from public, anon, authenticated;
revoke all on table public.client_name_change_requests from service_role;
revoke all on table public.client_name_change_events from service_role;
grant select on table public.client_name_change_requests to service_role;

drop policy if exists "Profile executor selects profiles" on public.profiles;
create policy "Profile executor selects profiles"
  on public.profiles
  for select
  to pb_finance_profile_executor
  using (true);

drop policy if exists "Profile executor updates client profiles" on public.profiles;
create policy "Profile executor updates client profiles"
  on public.profiles
  for update
  to pb_finance_profile_executor
  using (role = 'client')
  with check (role = 'client');

drop policy if exists "Profile executor selects client verification" on public.client_verifications;
create policy "Profile executor selects client verification"
  on public.client_verifications
  for select
  to pb_finance_profile_executor
  using (true);

drop policy if exists "Profile executor locks client verification" on public.client_verifications;
create policy "Profile executor locks client verification"
  on public.client_verifications
  for update
  to pb_finance_profile_executor
  using (true)
  with check (true);

drop policy if exists "Profile executor selects client companies" on public.client_companies;
create policy "Profile executor selects client companies"
  on public.client_companies
  for select
  to pb_finance_profile_executor
  using (true);

drop policy if exists "Profile executor inserts client companies" on public.client_companies;
create policy "Profile executor inserts client companies"
  on public.client_companies
  for insert
  to pb_finance_profile_executor
  with check (true);

drop policy if exists "Profile executor updates client companies" on public.client_companies;
create policy "Profile executor updates client companies"
  on public.client_companies
  for update
  to pb_finance_profile_executor
  using (true)
  with check (true);

drop policy if exists "Profile executor selects name change requests"
  on public.client_name_change_requests;
create policy "Profile executor selects name change requests"
  on public.client_name_change_requests
  for select
  to pb_finance_profile_executor
  using (true);

drop policy if exists "Profile executor inserts name change requests"
  on public.client_name_change_requests;
create policy "Profile executor inserts name change requests"
  on public.client_name_change_requests
  for insert
  to pb_finance_profile_executor
  with check (true);

drop policy if exists "Profile executor updates name change requests"
  on public.client_name_change_requests;
create policy "Profile executor updates name change requests"
  on public.client_name_change_requests
  for update
  to pb_finance_profile_executor
  using (true)
  with check (true);

drop policy if exists "Profile executor inserts name change events"
  on public.client_name_change_events;
create policy "Profile executor inserts name change events"
  on public.client_name_change_events
  for insert
  to pb_finance_profile_executor
  with check (true);

create or replace function public.validate_client_profile_identity_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role = 'client' then
    if new.full_name is null
      or new.full_name <> btrim(new.full_name)
      or char_length(new.full_name) not between 2 and 160
      or new.full_name ~ '[[:cntrl:]]' then
      raise exception 'Client full name must be trimmed and contain 2 to 160 characters without control characters.';
    end if;

    if new.company is null
      or new.company <> btrim(new.company)
      or char_length(new.company) not between 1 and 180
      or new.company ~ '[[:cntrl:]]' then
      raise exception 'Client company must be trimmed and contain 1 to 180 characters without control characters.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_protected_client_full_name_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'client'
    and new.full_name is distinct from old.full_name
    and coalesce(
      current_setting('pb_finance.client_name_change_approval', true),
      ''
    ) <> 'allowed'
    and exists (
      select 1
      from public.client_verifications as verification
      where verification.client_id = new.id
        and verification.status in ('pending_review', 'approved')
    ) then
    raise exception 'Protected client names must use the name-change approval workflow.';
  end if;

  return new;
end;
$$;

alter function public.prevent_protected_client_full_name_change()
  owner to pb_finance_profile_executor;

create or replace function public.sync_client_primary_company()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_primary_company_id uuid;
begin
  if new.role <> 'client' or new.company is not distinct from old.company then
    return new;
  end if;

  select company.id
  into v_primary_company_id
  from public.client_companies as company
  where company.owner_id = new.id
  order by created_at, id
  limit 1
  for update;

  perform set_config('pb_finance.client_company_sync', 'allowed', true);

  if v_primary_company_id is null then
    insert into public.client_companies (owner_id, name, billing_email)
    values (new.id, new.company, new.email);
  else
    update public.client_companies
    set name = new.company
    where id = v_primary_company_id;
  end if;

  return new;
end;
$$;

alter function public.sync_client_primary_company()
  owner to pb_finance_profile_executor;

create or replace function public.prevent_direct_primary_client_company_name_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_primary_company_id uuid;
begin
  if new.name is not distinct from old.name
    or coalesce(current_setting('pb_finance.client_company_sync', true), '') = 'allowed' then
    return new;
  end if;

  select company.id
  into v_primary_company_id
  from public.client_companies as company
  where company.owner_id = old.owner_id
  order by created_at, id
  limit 1;

  if old.id = v_primary_company_id then
    raise exception 'The primary company name must be changed through the client account workflow.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_client_profile_identity_fields on public.profiles;
create trigger validate_client_profile_identity_fields
  before update of full_name, company on public.profiles
  for each row
  execute function public.validate_client_profile_identity_fields();

drop trigger if exists prevent_protected_client_full_name_change on public.profiles;
create trigger prevent_protected_client_full_name_change
  before update of full_name on public.profiles
  for each row
  execute function public.prevent_protected_client_full_name_change();

drop trigger if exists sync_client_primary_company on public.profiles;
create trigger sync_client_primary_company
  after update of company on public.profiles
  for each row
  execute function public.sync_client_primary_company();

drop trigger if exists prevent_direct_primary_client_company_name_change
  on public.client_companies;
create trigger prevent_direct_primary_client_company_name_change
  before update of name on public.client_companies
  for each row
  execute function public.prevent_direct_primary_client_company_name_change();

revoke execute on function public.validate_client_profile_identity_fields()
  from public, anon, authenticated, service_role;
revoke execute on function public.prevent_direct_primary_client_company_name_change()
  from public, anon, authenticated, service_role;

set role pb_finance_profile_executor;
revoke execute on function public.prevent_protected_client_full_name_change()
  from public, anon, authenticated, service_role;
revoke execute on function public.sync_client_primary_company()
  from public, anon, authenticated, service_role;
reset role;

create or replace function public.save_client_account_profile(
  p_client_id uuid,
  p_full_name text,
  p_company text,
  p_request_reason text default null
)
returns table (
  name_outcome text,
  request_id uuid,
  request_created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_role text;
  v_current_full_name text;
  v_full_name text := btrim(p_full_name);
  v_company text := btrim(p_company);
  v_request_reason text := nullif(btrim(p_request_reason), '');
  v_verification_status text;
  v_pending_request_id uuid;
  v_pending_requested_full_name text;
begin
  if v_full_name is null
    or char_length(v_full_name) not between 2 and 160
    or v_full_name ~ '[[:cntrl:]]' then
    raise exception 'Client full name must contain 2 to 160 characters without control characters.';
  end if;

  if v_company is null
    or char_length(v_company) not between 1 and 180
    or v_company ~ '[[:cntrl:]]' then
    raise exception 'Client company must contain 1 to 180 characters without control characters.';
  end if;

  select profile.role, profile.full_name
  into v_client_role, v_current_full_name
  from public.profiles as profile
  where profile.id = p_client_id
  for update;

  if not found or v_client_role <> 'client' then
    raise exception 'A valid client account is required.';
  end if;

  v_verification_status := null;
  select verification.status
  into v_verification_status
  from public.client_verifications as verification
  where verification.client_id = p_client_id
  for update;

  v_pending_request_id := null;
  v_pending_requested_full_name := null;
  select pending_request.id, pending_request.requested_full_name
  into v_pending_request_id, v_pending_requested_full_name
  from public.client_name_change_requests as pending_request
  where pending_request.client_id = p_client_id
    and pending_request.status = 'pending'
  for update;

  if v_full_name is not distinct from v_current_full_name then
    update public.profiles
    set company = v_company
    where id = p_client_id;

    return query select 'unchanged'::text, null::uuid, false;
    return;
  end if;

  if v_verification_status is null
    or v_verification_status in ('draft', 'rejected') then
    update public.profiles
    set
      full_name = v_full_name,
      company = v_company
    where id = p_client_id;

    return query select 'updated'::text, null::uuid, false;
    return;
  end if;

  if v_verification_status not in ('pending_review', 'approved') then
    raise exception 'The current verification state cannot accept a name change.';
  end if;

  if v_current_full_name is null
    or v_current_full_name <> btrim(v_current_full_name)
    or char_length(v_current_full_name) not between 2 and 160
    or v_current_full_name ~ '[[:cntrl:]]' then
    raise exception 'The active client name cannot be used as a protected-name baseline.';
  end if;

  if v_request_reason is null
    or char_length(v_request_reason) > 1000
    or v_request_reason ~ '[[:cntrl:]]' then
    raise exception 'A 1 to 1,000 character explanation is required for a protected name change.';
  end if;

  if v_pending_request_id is not null then
    if v_pending_requested_full_name is distinct from v_full_name then
      raise exception 'PB_CLIENT_NAME_CHANGE_PENDING';
    end if;

    update public.profiles
    set company = v_company
    where id = p_client_id;

    return query select 'pending_approval'::text, v_pending_request_id, false;
    return;
  end if;

  insert into public.client_name_change_requests (
    client_id,
    current_full_name,
    requested_full_name,
    request_reason
  ) values (
    p_client_id,
    v_current_full_name,
    v_full_name,
    v_request_reason
  )
  returning id into v_pending_request_id;

  insert into public.client_name_change_events (
    request_id,
    client_id,
    actor_id,
    event_type,
    reason
  ) values (
    v_pending_request_id,
    p_client_id,
    p_client_id,
    'request_created',
    v_request_reason
  );

  update public.profiles
  set company = v_company
  where id = p_client_id;

  return query select 'pending_approval'::text, v_pending_request_id, true;
end;
$$;

alter function public.save_client_account_profile(uuid, text, text, text)
  owner to pb_finance_profile_executor;

create or replace function public.decide_client_name_change(
  p_request_id uuid,
  p_reviewer_id uuid,
  p_decision text,
  p_decision_reason text default null
)
returns setof public.client_name_change_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_locked_client_id uuid;
  v_client_role text;
  v_active_full_name text;
  v_verification_status text;
  v_request_status text;
  v_request_current_full_name text;
  v_requested_full_name text;
  v_decision_reason text := nullif(btrim(p_decision_reason), '');
begin
  select name_request.client_id
  into v_client_id
  from public.client_name_change_requests as name_request
  where name_request.id = p_request_id;

  if not found then
    raise exception 'PB_CLIENT_NAME_CHANGE_STALE';
  end if;

  select profile.role, profile.full_name
  into v_client_role, v_active_full_name
  from public.profiles as profile
  where profile.id = v_client_id
  for update;

  if not found or v_client_role <> 'client' then
    raise exception 'PB_CLIENT_NAME_CHANGE_STALE';
  end if;

  v_verification_status := null;
  select verification.status
  into v_verification_status
  from public.client_verifications as verification
  where verification.client_id = v_client_id
  for update;

  if not found then
    raise exception 'PB_CLIENT_NAME_CHANGE_STALE';
  end if;

  select
    name_request.client_id,
    name_request.status,
    name_request.current_full_name,
    name_request.requested_full_name
  into
    v_locked_client_id,
    v_request_status,
    v_request_current_full_name,
    v_requested_full_name
  from public.client_name_change_requests as name_request
  where name_request.id = p_request_id
  for update;

  if not found
    or v_locked_client_id is distinct from v_client_id
    or v_request_status <> 'pending'
    or v_active_full_name is distinct from v_request_current_full_name
    or v_verification_status not in ('pending_review', 'approved') then
    raise exception 'PB_CLIENT_NAME_CHANGE_STALE';
  end if;

  if not exists (
    select 1
    from public.profiles as reviewer
    where reviewer.id = p_reviewer_id
      and reviewer.role = 'admin'
  ) then
    raise exception 'Only PB Finance admins may decide client name changes.';
  end if;

  if p_decision is null
    or p_decision not in ('approved', 'rejected') then
    raise exception 'The name-change decision must be approved or rejected.';
  end if;

  if v_decision_reason is not null
    and (
      char_length(v_decision_reason) > 1000
      or v_decision_reason ~ '[[:cntrl:]]'
    ) then
    raise exception 'The decision reason must contain at most 1,000 characters without control characters.';
  end if;

  if p_decision = 'approved' then
    perform set_config('pb_finance.client_name_change_approval', 'allowed', true);

    update public.profiles
    set full_name = v_requested_full_name
    where id = v_client_id;

    update public.client_name_change_requests
    set
      status = 'approved',
      decision_reason = v_decision_reason,
      reviewed_at = now(),
      reviewed_by = p_reviewer_id
    where id = p_request_id;

    insert into public.client_name_change_events (
      request_id,
      client_id,
      actor_id,
      event_type,
      reason
    ) values (
      p_request_id,
      v_client_id,
      p_reviewer_id,
      'request_approved',
      v_decision_reason
    );
  else
    if v_decision_reason is null then
      raise exception 'A rejection reason is required.';
    end if;

    update public.client_name_change_requests
    set
      status = 'rejected',
      decision_reason = v_decision_reason,
      reviewed_at = now(),
      reviewed_by = p_reviewer_id
    where id = p_request_id;

    insert into public.client_name_change_events (
      request_id,
      client_id,
      actor_id,
      event_type,
      reason
    ) values (
      p_request_id,
      v_client_id,
      p_reviewer_id,
      'request_rejected',
      v_decision_reason
    );
  end if;

  return query
  select name_request.*
  from public.client_name_change_requests as name_request
  where name_request.id = p_request_id;
end;
$$;

alter function public.decide_client_name_change(uuid, uuid, text, text)
  owner to pb_finance_profile_executor;

set role pb_finance_profile_executor;
revoke execute on function public.save_client_account_profile(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.save_client_account_profile(uuid, text, text, text)
  to service_role;

revoke execute on function public.decide_client_name_change(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.decide_client_name_change(uuid, uuid, text, text)
  to service_role;
reset role;

create or replace function public.reject_client_verification(
  p_client_id uuid,
  p_reviewer_id uuid,
  p_rejected_kinds text[],
  p_decision_reason text,
  p_internal_review_notes text default null
)
returns setof public.client_verifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_role text;
  v_status text;
  v_pending_request_id uuid;
  v_cancellation_reason text := 'Cancelled because client verification was rejected.';
begin
  if not exists (
    select 1
    from public.profiles as reviewer
    where reviewer.id = p_reviewer_id
      and reviewer.role = 'admin'
  ) then
    raise exception 'Only PB Finance admins may reject client verification.';
  end if;

  if nullif(btrim(p_decision_reason), '') is null then
    raise exception 'A rejection reason is required.';
  end if;

  if coalesce(array_length(p_rejected_kinds, 1), 0) = 0
    or exists (
      select 1
      from unnest(p_rejected_kinds) as rejected_kind
      where rejected_kind not in (
        'valid_id',
        'liveness_selfie',
        'profile_photo',
        'business_proof'
      )
    ) then
    raise exception 'At least one valid rejected requirement is required.';
  end if;

  select profile.role
  into v_client_role
  from public.profiles as profile
  where profile.id = p_client_id
  for update;

  if not found or v_client_role <> 'client' then
    raise exception 'Client profile not found.';
  end if;

  select verification.status
  into v_status
  from public.client_verifications as verification
  where verification.client_id = p_client_id
  for update;

  if not found then
    raise exception 'Client verification case not found.';
  end if;

  v_pending_request_id := null;
  select pending_request.id
  into v_pending_request_id
  from public.client_name_change_requests as pending_request
  where pending_request.client_id = p_client_id
    and pending_request.status = 'pending'
  for update;

  if v_status is distinct from 'pending_review' then
    raise exception 'Only pending client verification cases may be rejected.';
  end if;

  perform set_config('pb_finance.client_verification_decision', 'allowed', true);

  update public.client_verifications
  set
    status = 'rejected',
    verified_business_name = null,
    decision_reason = btrim(p_decision_reason),
    internal_review_notes = nullif(btrim(p_internal_review_notes), ''),
    reviewed_at = now(),
    reviewed_by = p_reviewer_id
  where client_id = p_client_id;

  update public.client_verification_documents
  set
    status = 'rejected',
    rejection_reason = btrim(p_decision_reason),
    reviewed_at = now(),
    reviewed_by = p_reviewer_id
  where client_id = p_client_id
    and is_current
    and kind = any(p_rejected_kinds);

  update public.profiles
  set client_tier = 'basic'
  where id = p_client_id
    and role = 'client';

  insert into public.client_verification_events (
    client_id,
    actor_id,
    event_type,
    reason,
    metadata
  ) values (
    p_client_id,
    p_reviewer_id,
    'verification_rejected',
    btrim(p_decision_reason),
    jsonb_build_object('rejectedKinds', to_jsonb(p_rejected_kinds))
  );

  if v_pending_request_id is not null then
    update public.client_name_change_requests
    set
      status = 'cancelled',
      decision_reason = v_cancellation_reason,
      reviewed_at = now(),
      reviewed_by = p_reviewer_id
    where id = v_pending_request_id;

    insert into public.client_name_change_events (
      request_id,
      client_id,
      actor_id,
      event_type,
      reason
    ) values (
      v_pending_request_id,
      p_client_id,
      p_reviewer_id,
      'request_cancelled',
      v_cancellation_reason
    );
  end if;

  return query
  select verification.*
  from public.client_verifications as verification
  where verification.client_id = p_client_id;
end;
$$;

create or replace function public.reset_client_verification(
  p_client_id uuid,
  p_reviewer_id uuid,
  p_reason text
)
returns setof public.client_verifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_role text;
  v_status text;
  v_pending_request_id uuid;
  v_cancellation_reason text := 'Cancelled because client verification was reset.';
begin
  if not exists (
    select 1
    from public.profiles as reviewer
    where reviewer.id = p_reviewer_id
      and reviewer.role = 'admin'
  ) then
    raise exception 'Only PB Finance admins may reset client verification.';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'A reset reason is required.';
  end if;

  select profile.role
  into v_client_role
  from public.profiles as profile
  where profile.id = p_client_id
  for update;

  if not found or v_client_role <> 'client' then
    raise exception 'Client profile not found.';
  end if;

  select verification.status
  into v_status
  from public.client_verifications as verification
  where verification.client_id = p_client_id
  for update;

  if not found then
    raise exception 'Client verification case not found.';
  end if;

  v_pending_request_id := null;
  select pending_request.id
  into v_pending_request_id
  from public.client_name_change_requests as pending_request
  where pending_request.client_id = p_client_id
    and pending_request.status = 'pending'
  for update;

  perform set_config('pb_finance.client_verification_decision', 'allowed', true);

  update public.client_verifications
  set
    status = 'draft',
    verified_business_name = null,
    decision_reason = btrim(p_reason),
    internal_review_notes = null,
    submitted_at = null,
    reviewed_at = null,
    reviewed_by = null,
    reset_at = now(),
    reset_by = p_reviewer_id
  where client_id = p_client_id;

  update public.client_verification_documents
  set
    status = 'rejected',
    rejection_reason = btrim(p_reason),
    reviewed_at = now(),
    reviewed_by = p_reviewer_id
  where client_id = p_client_id
    and is_current;

  update public.profiles
  set client_tier = 'basic'
  where id = p_client_id
    and role = 'client';

  insert into public.client_verification_events (
    client_id,
    actor_id,
    event_type,
    reason
  ) values (
    p_client_id,
    p_reviewer_id,
    'verification_reset',
    btrim(p_reason)
  );

  if v_pending_request_id is not null then
    update public.client_name_change_requests
    set
      status = 'cancelled',
      decision_reason = v_cancellation_reason,
      reviewed_at = now(),
      reviewed_by = p_reviewer_id
    where id = v_pending_request_id;

    insert into public.client_name_change_events (
      request_id,
      client_id,
      actor_id,
      event_type,
      reason
    ) values (
      v_pending_request_id,
      p_client_id,
      p_reviewer_id,
      'request_cancelled',
      v_cancellation_reason
    );
  end if;

  return query
  select verification.*
  from public.client_verifications as verification
  where verification.client_id = p_client_id;
end;
$$;

revoke execute on function public.reject_client_verification(uuid, uuid, text[], text, text)
  from public, anon, authenticated;
grant execute on function public.reject_client_verification(uuid, uuid, text[], text, text)
  to service_role;

revoke execute on function public.reset_client_verification(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.reset_client_verification(uuid, uuid, text)
  to service_role;

create or replace function public.approve_client_verification(
  p_client_id uuid,
  p_reviewer_id uuid,
  p_verified_business_name text,
  p_internal_review_notes text default null
)
returns setof public.client_verifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_role text;
  v_status text;
  v_document_count integer;
  v_verified_business_name text := btrim(p_verified_business_name);
begin
  if not exists (
    select 1
    from public.profiles as reviewer
    where reviewer.id = p_reviewer_id
      and reviewer.role = 'admin'
  ) then
    raise exception 'Only PB Finance admins may approve client verification.';
  end if;

  if nullif(v_verified_business_name, '') is null
    or v_verified_business_name ~ '[[:cntrl:]]' then
    raise exception 'A valid exact legal business name is required.';
  end if;

  select profile.role
  into v_client_role
  from public.profiles as profile
  where profile.id = p_client_id
  for update;

  if not found or v_client_role <> 'client' then
    raise exception 'Client profile not found.';
  end if;

  select verification.status
  into v_status
  from public.client_verifications as verification
  where verification.client_id = p_client_id
  for update;

  if not found or v_status is distinct from 'pending_review' then
    raise exception 'Only pending client verification cases may be approved.';
  end if;

  select count(*)
  into v_document_count
  from public.client_verification_documents as document
  where document.client_id = p_client_id
    and document.is_current
    and document.status = 'submitted'
    and document.kind in (
      'valid_id',
      'liveness_selfie',
      'profile_photo',
      'business_proof'
    );

  if v_document_count <> 4 then
    raise exception 'All four current verification requirements must be submitted.';
  end if;

  perform set_config('pb_finance.client_verification_decision', 'allowed', true);

  update public.client_verifications
  set
    status = 'approved',
    verified_business_name = v_verified_business_name,
    decision_reason = null,
    internal_review_notes = nullif(btrim(p_internal_review_notes), ''),
    reviewed_at = now(),
    reviewed_by = p_reviewer_id
  where client_id = p_client_id;

  update public.client_verification_documents
  set
    status = 'approved',
    rejection_reason = null,
    reviewed_at = now(),
    reviewed_by = p_reviewer_id
  where client_id = p_client_id
    and is_current
    and status = 'submitted';

  update public.profiles
  set client_tier = 'verified'
  where id = p_client_id
    and role = 'client';

  insert into public.client_verification_events (
    client_id,
    actor_id,
    event_type
  ) values (
    p_client_id,
    p_reviewer_id,
    'verification_approved'
  );

  return query
  select verification.*
  from public.client_verifications as verification
  where verification.client_id = p_client_id;
end;
$$;

revoke execute on function public.approve_client_verification(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.approve_client_verification(uuid, uuid, text, text)
  to service_role;

revoke create on schema public from pb_finance_profile_executor;

do $$
begin
  if current_user <> 'pb_finance_profile_executor' then
    execute format(
      'revoke %I from %I',
      'pb_finance_profile_executor',
      current_user
    );
  end if;
end
$$;

-- PostgreSQL 16+ gives a non-superuser CREATEROLE creator an unavoidable
-- bootstrap-granted ADMIN-only membership in each role it creates. The grant
-- has INHERIT FALSE and SET FALSE, so it cannot expose executor privileges.
-- Verify that the temporary SET-capable grant above is gone and that no API
-- role has direct or indirect executor membership.
do $$
declare
  v_executor_oid oid;
  v_actor_is_superuser boolean;
begin
  select executor.oid
  into v_executor_oid
  from pg_roles as executor
  where executor.rolname = 'pb_finance_profile_executor';

  if exists (
    select 1
    from pg_roles as api_role
    where api_role.rolname in (
      'anon',
      'authenticated',
      'service_role',
      'authenticator'
    )
      and pg_has_role(api_role.oid, v_executor_oid, 'MEMBER')
  ) then
    raise exception 'API roles may not be members of the profile executor.';
  end if;

  select actor.rolsuper
  into v_actor_is_superuser
  from pg_roles as actor
  where actor.rolname = current_user;

  if current_user <> 'pb_finance_profile_executor'
    and not coalesce(v_actor_is_superuser, false) then
    if pg_has_role(current_user, v_executor_oid, 'USAGE') then
      raise exception 'The migration actor still inherits profile executor privileges.';
    end if;

    if current_setting('server_version_num')::integer >= 160000 then
      if pg_has_role(current_user, v_executor_oid, 'SET') then
        raise exception 'The migration actor can still set role to the profile executor.';
      end if;

      if exists (
        select 1
        from pg_auth_members as membership
        join pg_roles as member_role
          on member_role.oid = membership.member
        where membership.roleid = v_executor_oid
          and member_role.rolname = current_user
          and (
            not membership.admin_option
            or membership.inherit_option
            or membership.set_option
          )
      ) then
        raise exception 'The migration actor has unexpected profile executor membership options.';
      end if;
    end if;
  end if;
end
$$;
