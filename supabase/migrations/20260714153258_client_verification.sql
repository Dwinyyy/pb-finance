-- Client onboarding verification is intentionally isolated from editable profile and
-- company names. Only the service-role decision functions below may set or clear
-- verified_business_name.
create table if not exists public.client_verifications (
  client_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'approved', 'rejected')),
  verified_business_name text,
  decision_reason text,
  internal_review_notes text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reset_at timestamptz,
  reset_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_verifications_approved_name_check check (
    (
      status = 'approved'
      and nullif(btrim(verified_business_name), '') is not null
    )
    or (
      status <> 'approved'
      and verified_business_name is null
    )
  )
);

create table if not exists public.client_verification_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null
    check (kind in ('valid_id', 'liveness_selfie', 'profile_photo', 'business_proof')),
  business_document_type text
    check (
      business_document_type is null
      or business_document_type in ('cp575_ein_letter', 'state_business_registration', 'eu_vat_certificate')
    ),
  storage_bucket text not null default 'client-verification-documents',
  storage_path text not null,
  original_file_name text not null,
  content_type text not null,
  file_size integer not null check (file_size > 0 and file_size <= 3145728),
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'rejected', 'superseded')),
  is_current boolean not null default true,
  rejection_reason text,
  uploaded_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_verification_document_business_type_check check (
    (kind = 'business_proof' and business_document_type is not null)
    or (kind <> 'business_proof' and business_document_type is null)
  )
);

create unique index if not exists client_verification_documents_current_kind_unique
  on public.client_verification_documents (client_id, kind)
  where is_current;

create index if not exists client_verification_documents_client_status_idx
  on public.client_verification_documents (client_id, status);

create table if not exists public.client_verification_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (
    event_type in (
      'document_uploaded',
      'verification_submitted',
      'verification_approved',
      'verification_rejected',
      'verification_reset'
    )
  ),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists client_verification_events_client_created_idx
  on public.client_verification_events (client_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-verification-documents',
  'client-verification-documents',
  false,
  3145728,
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.client_verifications enable row level security;
alter table public.client_verification_documents enable row level security;
alter table public.client_verification_events enable row level security;

revoke all on table public.client_verifications from anon, authenticated;
revoke all on table public.client_verification_documents from anon, authenticated;
revoke all on table public.client_verification_events from anon, authenticated;

grant select, insert, update, delete on table public.client_verifications to service_role;
grant select, insert, update, delete on table public.client_verification_documents to service_role;
grant select, insert, update, delete on table public.client_verification_events to service_role;

drop policy if exists "Client verification cases are visible to owners" on public.client_verifications;
create policy "Client verification cases are visible to owners"
  on public.client_verifications
  for select
  using ((select auth.uid()) = client_id);

drop policy if exists "Client verification documents are visible to owners" on public.client_verification_documents;
create policy "Client verification documents are visible to owners"
  on public.client_verification_documents
  for select
  using ((select auth.uid()) = client_id);

create or replace function public.prevent_direct_client_verification_decision_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    new.verified_business_name is distinct from old.verified_business_name
    or old.status = 'approved'
    or new.status = 'approved'
  ) and coalesce(current_setting('pb_finance.client_verification_decision', true), '') <> 'allowed' then
    raise exception 'Client verification decisions must use the protected decision functions.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_direct_client_verification_decision_change on public.client_verifications;
create trigger prevent_direct_client_verification_decision_change
  before update on public.client_verifications
  for each row
  execute function public.prevent_direct_client_verification_decision_change();

drop trigger if exists set_client_verifications_updated_at on public.client_verifications;
create trigger set_client_verifications_updated_at
  before update on public.client_verifications
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_client_verification_documents_updated_at on public.client_verification_documents;
create trigger set_client_verification_documents_updated_at
  before update on public.client_verification_documents
  for each row
  execute function public.set_updated_at();

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
  v_status text;
  v_document_count integer;
  v_verified_business_name text := btrim(p_verified_business_name);
begin
  if not exists (
    select 1 from public.profiles
    where id = p_reviewer_id and role = 'admin'
  ) then
    raise exception 'Only PB Finance admins may approve client verification.';
  end if;

  if nullif(v_verified_business_name, '') is null
    or v_verified_business_name ~ '[[:cntrl:]]' then
    raise exception 'A valid exact legal business name is required.';
  end if;

  select status into v_status
  from public.client_verifications
  where client_id = p_client_id
  for update;

  if v_status is distinct from 'pending_review' then
    raise exception 'Only pending client verification cases may be approved.';
  end if;

  select count(*) into v_document_count
  from public.client_verification_documents
  where client_id = p_client_id
    and is_current
    and status = 'submitted'
    and kind in ('valid_id', 'liveness_selfie', 'profile_photo', 'business_proof');

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
  where id = p_client_id and role = 'client';

  insert into public.client_verification_events (client_id, actor_id, event_type)
  values (p_client_id, p_reviewer_id, 'verification_approved');

  return query
  select * from public.client_verifications where client_id = p_client_id;
end;
$$;

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
  v_status text;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_reviewer_id and role = 'admin'
  ) then
    raise exception 'Only PB Finance admins may reject client verification.';
  end if;

  if nullif(btrim(p_decision_reason), '') is null then
    raise exception 'A rejection reason is required.';
  end if;

  if coalesce(array_length(p_rejected_kinds, 1), 0) = 0
    or exists (
      select 1 from unnest(p_rejected_kinds) as rejected_kind
      where rejected_kind not in ('valid_id', 'liveness_selfie', 'profile_photo', 'business_proof')
    ) then
    raise exception 'At least one valid rejected requirement is required.';
  end if;

  select status into v_status
  from public.client_verifications
  where client_id = p_client_id
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
  where id = p_client_id and role = 'client';

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

  return query
  select * from public.client_verifications where client_id = p_client_id;
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
begin
  if not exists (
    select 1 from public.profiles
    where id = p_reviewer_id and role = 'admin'
  ) then
    raise exception 'Only PB Finance admins may reset client verification.';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'A reset reason is required.';
  end if;

  if not exists (
    select 1 from public.client_verifications
    where client_id = p_client_id
    for update
  ) then
    raise exception 'Client verification case not found.';
  end if;

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
  where client_id = p_client_id and is_current;

  update public.profiles
  set client_tier = 'basic'
  where id = p_client_id and role = 'client';

  insert into public.client_verification_events (client_id, actor_id, event_type, reason)
  values (p_client_id, p_reviewer_id, 'verification_reset', btrim(p_reason));

  return query
  select * from public.client_verifications where client_id = p_client_id;
end;
$$;

revoke execute on function public.approve_client_verification(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.approve_client_verification(uuid, uuid, text, text) to service_role;

revoke execute on function public.reject_client_verification(uuid, uuid, text[], text, text) from public, anon, authenticated;
grant execute on function public.reject_client_verification(uuid, uuid, text[], text, text) to service_role;

revoke execute on function public.reset_client_verification(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reset_client_verification(uuid, uuid, text) to service_role;
