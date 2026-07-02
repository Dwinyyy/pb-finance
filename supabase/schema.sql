create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  company text,
  role text not null default 'client',
  client_tier text not null default 'basic',
  title text,
  phone text,
  avatar_url text,
  google_link_verified_at timestamptz,
  password_login_enabled_at timestamptz,
  manual_triage_required boolean not null default false,
  manual_triage_status text not null default 'clear',
  manual_triage_reason text,
  manual_triage_source text,
  manual_triage_domain text,
  manual_triage_flagged_at timestamptz,
  manual_triage_resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists google_link_verified_at timestamptz;
alter table public.profiles add column if not exists password_login_enabled_at timestamptz;
alter table public.profiles add column if not exists manual_triage_required boolean not null default false;
alter table public.profiles add column if not exists manual_triage_status text not null default 'clear';
alter table public.profiles add column if not exists manual_triage_reason text;
alter table public.profiles add column if not exists manual_triage_source text;
alter table public.profiles add column if not exists manual_triage_domain text;
alter table public.profiles add column if not exists manual_triage_flagged_at timestamptz;
alter table public.profiles add column if not exists manual_triage_resolved_at timestamptz;
alter table public.profiles add column if not exists client_tier text not null default 'basic';
update public.profiles
set client_tier = 'basic'
where client_tier is null
  or client_tier not in ('basic', 'verified', 'vip');
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'client', 'professional'));
alter table public.profiles drop constraint if exists profiles_client_tier_check;
alter table public.profiles add constraint profiles_client_tier_check
  check (client_tier in ('basic', 'verified', 'vip'));
alter table public.profiles drop constraint if exists profiles_manual_triage_status_check;
alter table public.profiles add constraint profiles_manual_triage_status_check
  check (manual_triage_status in ('clear', 'pending', 'approved', 'rejected'));

create table if not exists public.client_tier_permissions (
  tier text primary key check (tier in ('basic', 'verified', 'vip')),
  label text not null,
  monthly_job_limit integer check (monthly_job_limit is null or monthly_job_limit >= 0),
  shortlist_limit integer check (shortlist_limit is null or shortlist_limit >= 0),
  monthly_background_check_limit integer check (monthly_background_check_limit is null or monthly_background_check_limit >= 0),
  matchmaker_level text not null default 'none' check (matchmaker_level in ('none', 'basic', 'pro')),
  can_view_basic_profiles boolean not null default true,
  can_view_full_documents boolean not null default false,
  can_schedule_interviews boolean not null default false,
  can_review_professionals boolean not null default false,
  can_read_reviews boolean not null default true,
  can_discover_agencies boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.client_tier_permissions (
  tier,
  label,
  monthly_job_limit,
  shortlist_limit,
  monthly_background_check_limit,
  matchmaker_level,
  can_view_basic_profiles,
  can_view_full_documents,
  can_schedule_interviews,
  can_review_professionals,
  can_read_reviews,
  can_discover_agencies
)
values
  ('basic', 'Basic', 0, 5, 0, 'none', true, false, false, false, true, false),
  ('verified', 'Verified', 10, null, 0, 'basic', true, true, true, true, true, true),
  ('vip', 'VIP', null, null, null, 'pro', true, true, true, true, true, true)
on conflict (tier) do update
set
  label = excluded.label,
  monthly_job_limit = excluded.monthly_job_limit,
  shortlist_limit = excluded.shortlist_limit,
  monthly_background_check_limit = excluded.monthly_background_check_limit,
  matchmaker_level = excluded.matchmaker_level,
  can_view_basic_profiles = excluded.can_view_basic_profiles,
  can_view_full_documents = excluded.can_view_full_documents,
  can_schedule_interviews = excluded.can_schedule_interviews,
  can_review_professionals = excluded.can_review_professionals,
  can_read_reviews = excluded.can_read_reviews,
  can_discover_agencies = excluded.can_discover_agencies,
  updated_at = now();

create table if not exists public.professional_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  bio text,
  location text,
  country text default 'Philippines',
  timezone text,
  years_experience integer,
  hourly_rate numeric(10, 2),
  availability text not null default 'Immediate Start' check (availability in ('Immediate Start', '1-2 Weeks Notice', '3-4 Weeks Notice', 'Part-time OK', 'Full-time', 'US Shift (EST)', 'US Shift (PST)', 'UK/Europe Shift', 'Not Available')),
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'approved', 'hidden', 'rejected')),
  rating numeric(3, 2),
  review_count integer not null default 0,
  professional_tier text not null default 'unverified',
  profile_visibility text not null default 'hidden',
  identity_verification_status text not null default 'pending',
  identity_verified_at timestamptz,
  identity_verified_by uuid references public.profiles(id) on delete set null,
  identity_verification_notes text,
  verified_at timestamptz,
  titles text[] not null default '{}',
  tools text[] not null default '{}',
  skills text[] not null default '{}',
  certifications text[] not null default '{}',
  industries text[] not null default '{}',
  work_preferences jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  pending_profile jsonb not null default '{}'::jsonb,
  review_status text check (review_status is null or review_status in ('pending_review', 'rejected')),
  review_submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.professional_profiles drop constraint if exists professional_profiles_availability_check;

update public.professional_profiles
set availability = case
  when availability = 'available_now' then 'Immediate Start'
  when availability = 'available_soon' then '1-2 Weeks Notice'
  when availability = 'not_available' then 'Not Available'
  else 'Immediate Start'
end
where availability not in ('Immediate Start', '1-2 Weeks Notice', '3-4 Weeks Notice', 'Part-time OK', 'Full-time', 'US Shift (EST)', 'US Shift (PST)', 'UK/Europe Shift', 'Not Available');

alter table public.professional_profiles add constraint professional_profiles_availability_check
  check (availability in ('Immediate Start', '1-2 Weeks Notice', '3-4 Weeks Notice', 'Part-time OK', 'Full-time', 'US Shift (EST)', 'US Shift (PST)', 'UK/Europe Shift', 'Not Available'));
alter table public.professional_profiles alter column availability set default 'Immediate Start';

alter table public.professional_profiles add column if not exists titles text[] not null default '{}';
alter table public.professional_profiles add column if not exists pending_profile jsonb not null default '{}'::jsonb;
alter table public.professional_profiles add column if not exists review_status text;
alter table public.professional_profiles add column if not exists review_submitted_at timestamptz;
alter table public.professional_profiles add column if not exists professional_tier text not null default 'unverified';
alter table public.professional_profiles add column if not exists profile_visibility text not null default 'hidden';
alter table public.professional_profiles add column if not exists identity_verification_status text not null default 'pending';
alter table public.professional_profiles add column if not exists identity_verified_at timestamptz;
alter table public.professional_profiles add column if not exists identity_verified_by uuid references public.profiles(id) on delete set null;
alter table public.professional_profiles add column if not exists identity_verification_notes text;
alter table public.professional_profiles add column if not exists verified_at timestamptz;
update public.professional_profiles
set professional_tier = case
    when status = 'approved' and identity_verification_status = 'approved' then 'verified'
    else 'unverified'
  end,
  profile_visibility = case
    when status = 'approved' and identity_verification_status = 'approved' then 'visible'
    else 'hidden'
  end
where professional_tier is null
  or professional_tier not in ('unverified', 'verified')
  or profile_visibility is null
  or profile_visibility not in ('hidden', 'visible');
update public.professional_profiles
set professional_tier = 'unverified',
  profile_visibility = 'hidden',
  verified_at = null
where status <> 'approved'
  or identity_verification_status <> 'approved';
alter table public.professional_profiles drop constraint if exists professional_profiles_professional_tier_check;
alter table public.professional_profiles add constraint professional_profiles_professional_tier_check
  check (professional_tier in ('unverified', 'verified'));
alter table public.professional_profiles drop constraint if exists professional_profiles_profile_visibility_check;
alter table public.professional_profiles add constraint professional_profiles_profile_visibility_check
  check (profile_visibility in ('hidden', 'visible'));
alter table public.professional_profiles drop constraint if exists professional_profiles_identity_verification_status_check;
alter table public.professional_profiles add constraint professional_profiles_identity_verification_status_check
  check (identity_verification_status in ('pending', 'approved', 'rejected'));
alter table public.professional_profiles drop constraint if exists professional_profiles_review_status_check;
alter table public.professional_profiles add constraint professional_profiles_review_status_check
  check (review_status is null or review_status in ('pending_review', 'rejected'));

create table if not exists public.professional_tier_permissions (
  tier text primary key check (tier in ('unverified', 'verified')),
  label text not null,
  can_access_dashboard boolean not null default false,
  can_appear_in_talent_pool boolean not null default false,
  can_view_full_client_profiles boolean not null default false,
  can_comment_on_job_posts boolean not null default false,
  can_contact_clients_from_jobs boolean not null default false,
  can_toggle_profile_visibility boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.professional_tier_permissions (
  tier,
  label,
  can_access_dashboard,
  can_appear_in_talent_pool,
  can_view_full_client_profiles,
  can_comment_on_job_posts,
  can_contact_clients_from_jobs,
  can_toggle_profile_visibility
)
values
  ('unverified', 'Unverified', false, false, false, false, false, false),
  ('verified', 'Verified', true, true, true, true, true, true)
on conflict (tier) do update
set
  label = excluded.label,
  can_access_dashboard = excluded.can_access_dashboard,
  can_appear_in_talent_pool = excluded.can_appear_in_talent_pool,
  can_view_full_client_profiles = excluded.can_view_full_client_profiles,
  can_comment_on_job_posts = excluded.can_comment_on_job_posts,
  can_contact_clients_from_jobs = excluded.can_contact_clients_from_jobs,
  can_toggle_profile_visibility = excluded.can_toggle_profile_visibility,
  updated_at = now();

update public.professional_profiles pp
set titles = candidate.titles
from (
  select
    pp_inner.user_id,
    array(
      select distinct clean_title
      from (
        select nullif(jsonb_array_elements_text(
          case
            when jsonb_typeof(pp_inner.pending_profile -> 'titles') = 'array'
              then pp_inner.pending_profile -> 'titles'
            else '[]'::jsonb
          end
        ), '') as clean_title
        union all
        select nullif(pp_inner.pending_profile ->> 'title', '')
        union all
        select nullif(p.title, '')
      ) raw_titles
      where clean_title is not null
        and clean_title not in ('Complete your profile', 'Finance Professional')
    ) as titles
  from public.professional_profiles pp_inner
  join public.profiles p on p.id = pp_inner.user_id
) candidate
where pp.user_id = candidate.user_id
  and coalesce(cardinality(pp.titles), 0) = 0
  and cardinality(candidate.titles) > 0;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'professional_profiles'
      and column_name = 'title'
  ) then
    execute $sql$
      update public.professional_profiles
      set titles = array[title]
      where title is not null
        and title <> ''
        and title not in ('Complete your profile', 'Finance Professional')
        and coalesce(cardinality(titles), 0) = 0
    $sql$;

    alter table public.professional_profiles drop column title;
  end if;
end $$;

create table if not exists public.client_companies (
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

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  name text not null,
  slug text unique,
  specialty text,
  description text,
  location text,
  team_size text,
  monthly_rate numeric(12, 2),
  rating numeric(3, 2),
  review_count integer not null default 0,
  certifications text[] not null default '{}',
  tools text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'approved', 'hidden', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shortlists (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  notes text,
  status text not null default 'saved' check (status in ('saved', 'contacted', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, professional_id)
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  title text not null,
  company_name text,
  description text,
  hourly_rate numeric(10, 2),
  schedule text,
  status text not null default 'invited' check (status in ('invited', 'accepted', 'declined', 'active', 'cancelled', 'closed')),
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  role_title text,
  scheduled_for timestamptz,
  duration_minutes integer not null default 30,
  meeting_url text,
  status text not null default 'requesting' check (status in ('requesting', 'requested', 'scheduled', 'completed', 'cancelled', 'no_show')),
  cancellation_reason text,
  cancelled_by uuid references public.profiles(id) on delete set null,
  cancelled_at timestamptz,
  client_hidden_at timestamptz,
  professional_hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.opportunities drop constraint if exists opportunities_status_check;
alter table public.opportunities add constraint opportunities_status_check
  check (status in ('invited', 'accepted', 'declined', 'active', 'cancelled', 'closed'));

alter table public.interviews add column if not exists cancellation_reason text;
alter table public.interviews add column if not exists cancelled_by uuid references public.profiles(id) on delete set null;
alter table public.interviews add column if not exists cancelled_at timestamptz;
alter table public.interviews add column if not exists client_hidden_at timestamptz;
alter table public.interviews add column if not exists professional_hidden_at timestamptz;
alter table public.interviews drop constraint if exists interviews_status_check;
alter table public.interviews add constraint interviews_status_check
  check (status in ('requesting', 'requested', 'scheduled', 'completed', 'cancelled', 'no_show'));

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid references public.professional_profiles(user_id) on delete set null,
  agency_id uuid references public.agencies(id) on delete set null,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed', 'cancelled')),
  start_date date,
  end_date date,
  monthly_amount numeric(12, 2),
  billing_interval text default 'Monthly',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  number text,
  amount numeric(12, 2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'open', 'paid', 'void', 'uncollectible')),
  issued_at date,
  due_at date,
  paid_at date,
  stripe_invoice_id text,
  hosted_invoice_url text,
  pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  brand text,
  last4 text,
  expires text,
  holder_name text,
  stripe_payment_method_id text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.timesheets (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  period_start date,
  period_end date,
  hours numeric(8, 2) not null default 0,
  amount numeric(12, 2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'paid', 'rejected')),
  submitted_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  result_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.match_requests add column if not exists tier text not null default 'basic';
alter table public.match_requests add column if not exists matchmaker_level text not null default 'none';
alter table public.match_requests drop constraint if exists match_requests_tier_check;
alter table public.match_requests add constraint match_requests_tier_check
  check (tier in ('basic', 'verified', 'vip'));
alter table public.match_requests drop constraint if exists match_requests_matchmaker_level_check;
alter table public.match_requests add constraint match_requests_matchmaker_level_check
  check (matchmaker_level in ('none', 'basic', 'pro'));

create table if not exists public.client_jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  location text,
  employment_type text,
  status text not null default 'open' check (status in ('draft', 'open', 'closed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.professional_reviews (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review text,
  status text not null default 'published' check (status in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, professional_id)
);

create table if not exists public.client_background_checks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  package text not null default 'standard',
  status text not null default 'requested' check (status in ('requested', 'in_progress', 'completed', 'cancelled', 'failed')),
  result_summary text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_job_comments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.client_jobs(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  comment text not null,
  status text not null default 'published' check (status in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_job_contacts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.client_jobs(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  message text,
  status text not null default 'requested' check (status in ('requested', 'accepted', 'declined', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, professional_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  action_url text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists professional_profiles_status_idx on public.professional_profiles(status);
create index if not exists professional_profiles_tier_visibility_idx on public.professional_profiles(professional_tier, profile_visibility, status);
create index if not exists profiles_manual_triage_idx on public.profiles(manual_triage_required, manual_triage_status);
create index if not exists agencies_status_idx on public.agencies(status);
create index if not exists shortlists_client_id_idx on public.shortlists(client_id);
create index if not exists opportunities_professional_id_idx on public.opportunities(professional_id);
create index if not exists interviews_client_id_idx on public.interviews(client_id);
create index if not exists contracts_client_id_idx on public.contracts(client_id);
create index if not exists invoices_client_id_idx on public.invoices(client_id);
create index if not exists timesheets_professional_id_idx on public.timesheets(professional_id);
create index if not exists match_requests_client_id_idx on public.match_requests(client_id);
create index if not exists client_jobs_client_month_idx on public.client_jobs(client_id, created_at);
create index if not exists professional_reviews_professional_id_idx on public.professional_reviews(professional_id);
create index if not exists client_background_checks_client_month_idx on public.client_background_checks(client_id, created_at);
create index if not exists client_job_comments_job_id_idx on public.client_job_comments(job_id);
create index if not exists client_job_comments_professional_id_idx on public.client_job_comments(professional_id);
create index if not exists client_job_contacts_job_id_idx on public.client_job_contacts(job_id);
create index if not exists client_job_contacts_professional_id_idx on public.client_job_contacts(professional_id);
create index if not exists notifications_recipient_id_idx on public.notifications(recipient_id);
create index if not exists notifications_unread_idx on public.notifications(recipient_id, created_at desc)
  where read_at is null;

do $$
declare
  realtime_table regclass;
begin
  foreach realtime_table in array array[
    'public.agencies'::regclass,
    'public.interviews'::regclass,
    'public.notifications'::regclass,
    'public.opportunities'::regclass,
    'public.professional_profiles'::regclass,
    'public.client_job_comments'::regclass,
    'public.client_job_contacts'::regclass,
    'public.shortlists'::regclass
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table %s', realtime_table);
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.client_tier_permissions enable row level security;
alter table public.professional_tier_permissions enable row level security;
alter table public.professional_profiles enable row level security;
alter table public.client_companies enable row level security;
alter table public.agencies enable row level security;
alter table public.shortlists enable row level security;
alter table public.opportunities enable row level security;
alter table public.interviews enable row level security;
alter table public.contracts enable row level security;
alter table public.invoices enable row level security;
alter table public.payment_methods enable row level security;
alter table public.timesheets enable row level security;
alter table public.match_requests enable row level security;
alter table public.client_jobs enable row level security;
alter table public.professional_reviews enable row level security;
alter table public.client_background_checks enable row level security;
alter table public.client_job_comments enable row level security;
alter table public.client_job_contacts enable row level security;
alter table public.notifications enable row level security;

create or replace function public.profile_role_for(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.role
    from public.profiles p
    where p.id = p_user_id
    limit 1
  ), 'client');
$$;

create or replace function public.client_tier_for(p_client_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when p.role = 'client' and p.client_tier in ('basic', 'verified', 'vip') then p.client_tier
      else 'basic'
    end
    from public.profiles p
    where p.id = p_client_id
    limit 1
  ), 'basic');
$$;

create or replace function public.client_tier_job_limit(p_client_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select ctp.monthly_job_limit
  from public.client_tier_permissions ctp
  where ctp.tier = public.client_tier_for(p_client_id);
$$;

create or replace function public.client_tier_shortlist_limit(p_client_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select ctp.shortlist_limit
  from public.client_tier_permissions ctp
  where ctp.tier = public.client_tier_for(p_client_id);
$$;

create or replace function public.client_tier_background_check_limit(p_client_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select ctp.monthly_background_check_limit
  from public.client_tier_permissions ctp
  where ctp.tier = public.client_tier_for(p_client_id);
$$;

create or replace function public.client_tier_matchmaker_level(p_client_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select ctp.matchmaker_level
    from public.client_tier_permissions ctp
    where ctp.tier = public.client_tier_for(p_client_id)
    limit 1
  ), 'none');
$$;

create or replace function public.client_tier_can_view_full_documents(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select ctp.can_view_full_documents
    from public.client_tier_permissions ctp
    where ctp.tier = public.client_tier_for(p_client_id)
    limit 1
  ), false);
$$;

create or replace function public.client_tier_can_schedule_interviews(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select ctp.can_schedule_interviews
    from public.client_tier_permissions ctp
    where ctp.tier = public.client_tier_for(p_client_id)
    limit 1
  ), false);
$$;

create or replace function public.client_tier_can_review_professionals(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select ctp.can_review_professionals
    from public.client_tier_permissions ctp
    where ctp.tier = public.client_tier_for(p_client_id)
    limit 1
  ), false);
$$;

create or replace function public.client_tier_can_discover_agencies(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select ctp.can_discover_agencies
    from public.client_tier_permissions ctp
    where ctp.tier = public.client_tier_for(p_client_id)
    limit 1
  ), false);
$$;

create or replace function public.client_tier_can_use_matchmaker(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.client_tier_matchmaker_level(p_client_id) <> 'none';
$$;

create or replace function public.client_tier_can_post_job(p_client_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  limit_value integer;
  posted_count integer;
begin
  limit_value := public.client_tier_job_limit(p_client_id);

  if limit_value is null then
    return true;
  end if;

  if limit_value <= 0 then
    return false;
  end if;

  select count(*)
  into posted_count
  from (
    select cj.id
    from public.client_jobs cj
    where cj.client_id = p_client_id
      and cj.created_at >= date_trunc('month', now())
    union all
    select o.id
    from public.opportunities o
    where o.client_id = p_client_id
      and o.created_at >= date_trunc('month', now())
  ) monthly_jobs;

  return posted_count < limit_value;
end;
$$;

create or replace function public.client_tier_can_save_professional(p_client_id uuid, p_professional_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  limit_value integer;
  saved_count integer;
begin
  limit_value := public.client_tier_shortlist_limit(p_client_id);

  if limit_value is null then
    return true;
  end if;

  if limit_value <= 0 then
    return false;
  end if;

  if exists (
    select 1
    from public.shortlists s
    where s.client_id = p_client_id
      and s.professional_id = p_professional_id
  ) then
    return true;
  end if;

  select count(*)
  into saved_count
  from public.shortlists s
  where s.client_id = p_client_id
    and s.status <> 'archived';

  return saved_count < limit_value;
end;
$$;

create or replace function public.client_tier_can_request_background_check(p_client_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  limit_value integer;
  check_count integer;
begin
  limit_value := public.client_tier_background_check_limit(p_client_id);

  if limit_value is null then
    return true;
  end if;

  if limit_value <= 0 then
    return false;
  end if;

  select count(*)
  into check_count
  from public.client_background_checks bc
  where bc.client_id = p_client_id
    and bc.created_at >= date_trunc('month', now());

  return check_count < limit_value;
end;
$$;

create or replace function public.professional_tier_for(p_professional_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when pp.professional_tier = 'verified'
        and pp.status = 'approved'
        and pp.identity_verification_status = 'approved'
        then 'verified'
      else 'unverified'
    end
    from public.professional_profiles pp
    where pp.user_id = p_professional_id
    limit 1
  ), 'unverified');
$$;

create or replace function public.professional_is_verified(p_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.professional_tier_for(p_professional_id) = 'verified';
$$;

create or replace function public.professional_can_access_dashboard(p_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select ptp.can_access_dashboard
    from public.professional_tier_permissions ptp
    where ptp.tier = public.professional_tier_for(p_professional_id)
    limit 1
  ), false);
$$;

create or replace function public.professional_can_appear_in_talent_pool(p_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select ptp.can_appear_in_talent_pool
    from public.professional_tier_permissions ptp
    where ptp.tier = public.professional_tier_for(p_professional_id)
    limit 1
  ), false);
$$;

create or replace function public.professional_can_view_full_client_profiles(p_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select ptp.can_view_full_client_profiles
    from public.professional_tier_permissions ptp
    where ptp.tier = public.professional_tier_for(p_professional_id)
    limit 1
  ), false);
$$;

create or replace function public.professional_can_comment_on_job_posts(p_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select ptp.can_comment_on_job_posts
    from public.professional_tier_permissions ptp
    where ptp.tier = public.professional_tier_for(p_professional_id)
    limit 1
  ), false);
$$;

create or replace function public.professional_can_contact_clients_from_jobs(p_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select ptp.can_contact_clients_from_jobs
    from public.professional_tier_permissions ptp
    where ptp.tier = public.professional_tier_for(p_professional_id)
    limit 1
  ), false);
$$;

create or replace function public.professional_can_toggle_profile_visibility(p_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select ptp.can_toggle_profile_visibility
    from public.professional_tier_permissions ptp
    where ptp.tier = public.professional_tier_for(p_professional_id)
    limit 1
  ), false);
$$;

drop policy if exists "Profiles are visible to their owners" on public.profiles;
create policy "Profiles are visible to their owners"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Client tier permissions are readable" on public.client_tier_permissions;
create policy "Client tier permissions are readable"
  on public.client_tier_permissions
  for select
  to authenticated
  using (true);

drop policy if exists "Professional tier permissions are readable" on public.professional_tier_permissions;
create policy "Professional tier permissions are readable"
  on public.professional_tier_permissions
  for select
  to authenticated
  using (true);

drop policy if exists "Approved professional profile owners are visible" on public.profiles;
drop policy if exists "Related client profiles are visible to talent" on public.profiles;
drop policy if exists "Client profiles are visible to verified professionals" on public.profiles;
create policy "Client profiles are visible to verified professionals"
  on public.profiles
  for select
  to authenticated
  using (
    role = 'client'
    and public.professional_can_view_full_client_profiles(auth.uid())
  );

drop policy if exists "Profiles are editable by their owners" on public.profiles;
create policy "Profiles are editable by their owners"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = public.profile_role_for(id)
    and client_tier = public.client_tier_for(id)
  );

drop policy if exists "Professional profiles are visible to owners and approved clients" on public.professional_profiles;
drop policy if exists "Professional profiles are visible to owners" on public.professional_profiles;
create policy "Professional profiles are visible to owners"
  on public.professional_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Professional profiles are inserted by owners" on public.professional_profiles;
create policy "Professional profiles are inserted by owners"
  on public.professional_profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Professional profiles are editable by owners" on public.professional_profiles;
create policy "Professional profiles are editable by owners"
  on public.professional_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Client companies are managed by owners" on public.client_companies;
create policy "Client companies are managed by owners"
  on public.client_companies
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Agencies are visible to owners and when approved" on public.agencies;
create policy "Agencies are visible to owners and when approved"
  on public.agencies
  for select
  to authenticated
  using (
    auth.uid() = owner_id
    or (
      status = 'approved'
      and public.client_tier_can_discover_agencies(auth.uid())
    )
  );

drop policy if exists "Agencies are inserted by owners" on public.agencies;
create policy "Agencies are inserted by owners"
  on public.agencies
  for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Agencies are editable by owners" on public.agencies;
create policy "Agencies are editable by owners"
  on public.agencies
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Shortlists are visible to related users" on public.shortlists;
drop policy if exists "Shortlists are visible to clients" on public.shortlists;
create policy "Shortlists are visible to clients"
  on public.shortlists
  for select
  using (auth.uid() = client_id);

drop policy if exists "Shortlists are managed by clients" on public.shortlists;
drop policy if exists "Shortlists are inserted by eligible clients" on public.shortlists;
create policy "Shortlists are inserted by eligible clients"
  on public.shortlists
  for insert
  with check (
    auth.uid() = client_id
    and public.client_tier_can_save_professional(client_id, professional_id)
  );

drop policy if exists "Shortlists are updated by clients" on public.shortlists;
create policy "Shortlists are updated by clients"
  on public.shortlists
  for update
  using (auth.uid() = client_id)
  with check (
    auth.uid() = client_id
    and (
      status = 'archived'
      or public.client_tier_can_save_professional(client_id, professional_id)
    )
  );

drop policy if exists "Shortlists are deleted by clients" on public.shortlists;
create policy "Shortlists are deleted by clients"
  on public.shortlists
  for delete
  using (auth.uid() = client_id);

drop policy if exists "Opportunities are visible to related users" on public.opportunities;
drop policy if exists "Opportunities are visible to clients" on public.opportunities;
create policy "Opportunities are visible to clients"
  on public.opportunities
  for select
  using (auth.uid() = client_id);

drop policy if exists "Opportunities are visible to verified professionals" on public.opportunities;
create policy "Opportunities are visible to verified professionals"
  on public.opportunities
  for select
  to authenticated
  using (
    auth.uid() = professional_id
    and public.professional_can_access_dashboard(auth.uid())
  );

drop policy if exists "Opportunities are managed by clients" on public.opportunities;
drop policy if exists "Opportunities are inserted by job-enabled clients" on public.opportunities;
create policy "Opportunities are inserted by job-enabled clients"
  on public.opportunities
  for insert
  with check (
    auth.uid() = client_id
    and public.client_tier_can_post_job(client_id)
  );

drop policy if exists "Opportunities are updated by clients" on public.opportunities;
create policy "Opportunities are updated by clients"
  on public.opportunities
  for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

drop policy if exists "Opportunities are updated by verified professionals" on public.opportunities;
create policy "Opportunities are updated by verified professionals"
  on public.opportunities
  for update
  to authenticated
  using (
    auth.uid() = professional_id
    and public.professional_can_access_dashboard(auth.uid())
  )
  with check (
    auth.uid() = professional_id
    and public.professional_can_access_dashboard(auth.uid())
  );

drop policy if exists "Opportunities are deleted by clients" on public.opportunities;
create policy "Opportunities are deleted by clients"
  on public.opportunities
  for delete
  using (auth.uid() = client_id);

drop policy if exists "Opportunities are answerable by professionals" on public.opportunities;

drop policy if exists "Interviews are visible to related users" on public.interviews;
drop policy if exists "Interviews are visible to clients" on public.interviews;
create policy "Interviews are visible to clients"
  on public.interviews
  for select
  using (auth.uid() = client_id);

drop policy if exists "Interviews are visible to verified professionals" on public.interviews;
create policy "Interviews are visible to verified professionals"
  on public.interviews
  for select
  to authenticated
  using (
    auth.uid() = professional_id
    and public.professional_can_access_dashboard(auth.uid())
  );

drop policy if exists "Interviews are managed by clients" on public.interviews;
drop policy if exists "Interviews are inserted by interview-enabled clients" on public.interviews;
create policy "Interviews are inserted by interview-enabled clients"
  on public.interviews
  for insert
  with check (
    auth.uid() = client_id
    and public.client_tier_can_schedule_interviews(client_id)
  );

drop policy if exists "Interviews are updated by clients" on public.interviews;
create policy "Interviews are updated by clients"
  on public.interviews
  for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

drop policy if exists "Interviews are updated by verified professionals" on public.interviews;
create policy "Interviews are updated by verified professionals"
  on public.interviews
  for update
  to authenticated
  using (
    auth.uid() = professional_id
    and public.professional_can_access_dashboard(auth.uid())
  )
  with check (
    auth.uid() = professional_id
    and public.professional_can_access_dashboard(auth.uid())
  );

drop policy if exists "Interviews are deleted by clients" on public.interviews;
create policy "Interviews are deleted by clients"
  on public.interviews
  for delete
  using (auth.uid() = client_id);

drop policy if exists "Interviews can be updated by professionals" on public.interviews;

drop policy if exists "Contracts are visible to related users" on public.contracts;
create policy "Contracts are visible to related users"
  on public.contracts
  for select
  using (
    auth.uid() = client_id
    or auth.uid() = professional_id
    or exists (
      select 1
      from public.agencies
      where agencies.id = contracts.agency_id
        and agencies.owner_id = auth.uid()
    )
  );

drop policy if exists "Contracts are managed by clients" on public.contracts;
create policy "Contracts are managed by clients"
  on public.contracts
  for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

drop policy if exists "Invoices are visible to clients" on public.invoices;
create policy "Invoices are visible to clients"
  on public.invoices
  for select
  using (auth.uid() = client_id);

drop policy if exists "Payment methods are visible to clients" on public.payment_methods;
create policy "Payment methods are visible to clients"
  on public.payment_methods
  for select
  using (auth.uid() = client_id);

drop policy if exists "Timesheets are visible to related users" on public.timesheets;
create policy "Timesheets are visible to related users"
  on public.timesheets
  for select
  using (
    (
      auth.uid() = professional_id
      and public.professional_can_access_dashboard(auth.uid())
    )
    or exists (
      select 1
      from public.contracts
      where contracts.id = timesheets.contract_id
        and contracts.client_id = auth.uid()
    )
  );

drop policy if exists "Timesheets are managed by professionals" on public.timesheets;
create policy "Timesheets are managed by professionals"
  on public.timesheets
  for all
  using (
    auth.uid() = professional_id
    and public.professional_can_access_dashboard(auth.uid())
  )
  with check (
    auth.uid() = professional_id
    and public.professional_can_access_dashboard(auth.uid())
  );

drop policy if exists "Match requests are managed by clients" on public.match_requests;
drop policy if exists "Match requests are visible to clients" on public.match_requests;
create policy "Match requests are visible to clients"
  on public.match_requests
  for select
  using (auth.uid() = client_id);

drop policy if exists "Match requests are inserted by AI-enabled clients" on public.match_requests;
create policy "Match requests are inserted by AI-enabled clients"
  on public.match_requests
  for insert
  with check (
    auth.uid() = client_id
    and public.client_tier_can_use_matchmaker(client_id)
  );

drop policy if exists "Match requests are updated by clients" on public.match_requests;
create policy "Match requests are updated by clients"
  on public.match_requests
  for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

drop policy if exists "Match requests are deleted by clients" on public.match_requests;
create policy "Match requests are deleted by clients"
  on public.match_requests
  for delete
  using (auth.uid() = client_id);

drop policy if exists "Client jobs are visible to owners" on public.client_jobs;
create policy "Client jobs are visible to owners"
  on public.client_jobs
  for select
  using (auth.uid() = client_id);

drop policy if exists "Open client jobs are visible to verified professionals" on public.client_jobs;
create policy "Open client jobs are visible to verified professionals"
  on public.client_jobs
  for select
  to authenticated
  using (
    status = 'open'
    and public.professional_is_verified(auth.uid())
  );

drop policy if exists "Client jobs are inserted by job-enabled clients" on public.client_jobs;
create policy "Client jobs are inserted by job-enabled clients"
  on public.client_jobs
  for insert
  with check (
    auth.uid() = client_id
    and public.client_tier_can_post_job(client_id)
  );

drop policy if exists "Client jobs are updated by owners" on public.client_jobs;
create policy "Client jobs are updated by owners"
  on public.client_jobs
  for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

drop policy if exists "Client jobs are deleted by owners" on public.client_jobs;
create policy "Client jobs are deleted by owners"
  on public.client_jobs
  for delete
  using (auth.uid() = client_id);

drop policy if exists "Professional reviews are readable" on public.professional_reviews;
create policy "Professional reviews are readable"
  on public.professional_reviews
  for select
  to authenticated
  using (
    status = 'published'
    or auth.uid() = client_id
    or auth.uid() = professional_id
  );

drop policy if exists "Professional reviews are inserted by review-enabled clients" on public.professional_reviews;
create policy "Professional reviews are inserted by review-enabled clients"
  on public.professional_reviews
  for insert
  with check (
    auth.uid() = client_id
    and public.client_tier_can_review_professionals(client_id)
  );

drop policy if exists "Professional reviews are updated by review-enabled clients" on public.professional_reviews;
create policy "Professional reviews are updated by review-enabled clients"
  on public.professional_reviews
  for update
  using (auth.uid() = client_id)
  with check (
    auth.uid() = client_id
    and public.client_tier_can_review_professionals(client_id)
  );

drop policy if exists "Professional reviews are deleted by review-enabled clients" on public.professional_reviews;
create policy "Professional reviews are deleted by review-enabled clients"
  on public.professional_reviews
  for delete
  using (
    auth.uid() = client_id
    and public.client_tier_can_review_professionals(client_id)
  );

drop policy if exists "Background checks are visible to VIP clients" on public.client_background_checks;
create policy "Background checks are visible to VIP clients"
  on public.client_background_checks
  for select
  using (
    auth.uid() = client_id
    and public.client_tier_can_request_background_check(client_id)
  );

drop policy if exists "Background checks are inserted by VIP clients" on public.client_background_checks;
create policy "Background checks are inserted by VIP clients"
  on public.client_background_checks
  for insert
  with check (
    auth.uid() = client_id
    and public.client_tier_can_request_background_check(client_id)
  );

drop policy if exists "Background checks are updated by VIP clients" on public.client_background_checks;
create policy "Background checks are updated by VIP clients"
  on public.client_background_checks
  for update
  using (
    auth.uid() = client_id
    and public.client_tier_can_request_background_check(client_id)
  )
  with check (
    auth.uid() = client_id
    and public.client_tier_can_request_background_check(client_id)
  );

drop policy if exists "Background checks are deleted by VIP clients" on public.client_background_checks;
create policy "Background checks are deleted by VIP clients"
  on public.client_background_checks
  for delete
  using (
    auth.uid() = client_id
    and public.client_tier_can_request_background_check(client_id)
  );

drop policy if exists "Job comments are visible to related users" on public.client_job_comments;
create policy "Job comments are visible to related users"
  on public.client_job_comments
  for select
  to authenticated
  using (
    auth.uid() = professional_id
    or exists (
      select 1
      from public.client_jobs cj
      where cj.id = client_job_comments.job_id
        and cj.client_id = auth.uid()
    )
  );

drop policy if exists "Verified professionals can comment on jobs" on public.client_job_comments;
create policy "Verified professionals can comment on jobs"
  on public.client_job_comments
  for insert
  to authenticated
  with check (
    auth.uid() = professional_id
    and public.professional_can_comment_on_job_posts(professional_id)
    and exists (
      select 1
      from public.client_jobs cj
      where cj.id = client_job_comments.job_id
        and cj.status = 'open'
    )
  );

drop policy if exists "Professionals can update their job comments" on public.client_job_comments;
create policy "Professionals can update their job comments"
  on public.client_job_comments
  for update
  to authenticated
  using (
    auth.uid() = professional_id
    and public.professional_can_comment_on_job_posts(professional_id)
  )
  with check (
    auth.uid() = professional_id
    and public.professional_can_comment_on_job_posts(professional_id)
  );

drop policy if exists "Professionals can delete their job comments" on public.client_job_comments;
create policy "Professionals can delete their job comments"
  on public.client_job_comments
  for delete
  to authenticated
  using (
    auth.uid() = professional_id
    and public.professional_can_comment_on_job_posts(professional_id)
  );

drop policy if exists "Job contacts are visible to related users" on public.client_job_contacts;
create policy "Job contacts are visible to related users"
  on public.client_job_contacts
  for select
  to authenticated
  using (
    auth.uid() = professional_id
    or exists (
      select 1
      from public.client_jobs cj
      where cj.id = client_job_contacts.job_id
        and cj.client_id = auth.uid()
    )
  );

drop policy if exists "Verified professionals can contact clients from jobs" on public.client_job_contacts;
create policy "Verified professionals can contact clients from jobs"
  on public.client_job_contacts
  for insert
  to authenticated
  with check (
    auth.uid() = professional_id
    and public.professional_can_contact_clients_from_jobs(professional_id)
    and exists (
      select 1
      from public.client_jobs cj
      where cj.id = client_job_contacts.job_id
        and cj.status = 'open'
    )
  );

drop policy if exists "Job contacts can be updated by related users" on public.client_job_contacts;
create policy "Job contacts can be updated by related users"
  on public.client_job_contacts
  for update
  to authenticated
  using (
    auth.uid() = professional_id
    or exists (
      select 1
      from public.client_jobs cj
      where cj.id = client_job_contacts.job_id
        and cj.client_id = auth.uid()
    )
  )
  with check (
    auth.uid() = professional_id
    or exists (
      select 1
      from public.client_jobs cj
      where cj.id = client_job_contacts.job_id
        and cj.client_id = auth.uid()
    )
  );

drop policy if exists "Notifications are visible to recipients" on public.notifications;
create policy "Notifications are visible to recipients"
  on public.notifications
  for select
  using (auth.uid() = recipient_id);

drop policy if exists "Notifications are editable by recipients" on public.notifications;
create policy "Notifications are editable by recipients"
  on public.notifications
  for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_profile_owner_role_tier_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id
    and (
      new.role is distinct from old.role
      or new.client_tier is distinct from old.client_tier
    ) then
    raise exception 'Profile role and client tier are managed by PB Finance.';
  end if;

  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

drop trigger if exists prevent_profile_owner_role_tier_change on public.profiles;
create trigger prevent_profile_owner_role_tier_change
  before update of role, client_tier on public.profiles
  for each row
  execute function public.prevent_profile_owner_role_tier_change();

drop trigger if exists set_client_tier_permissions_updated_at on public.client_tier_permissions;
create trigger set_client_tier_permissions_updated_at
  before update on public.client_tier_permissions
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_professional_tier_permissions_updated_at on public.professional_tier_permissions;
create trigger set_professional_tier_permissions_updated_at
  before update on public.professional_tier_permissions
  for each row
  execute function public.set_updated_at();

create or replace function public.prevent_professional_owner_managed_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and auth.uid() = new.user_id then
    if new.professional_tier <> 'unverified'
      or new.profile_visibility <> 'hidden'
      or new.identity_verification_status <> 'pending'
      or new.identity_verified_at is not null
      or new.identity_verified_by is not null
      or new.identity_verification_notes is not null
      or new.verified_at is not null then
      raise exception 'Professional verification fields are managed by PB Finance.';
    end if;
  end if;

  if tg_op = 'UPDATE' and auth.uid() = old.user_id then
    if new.professional_tier is distinct from old.professional_tier
      or new.identity_verification_status is distinct from old.identity_verification_status
      or new.identity_verified_at is distinct from old.identity_verified_at
      or new.identity_verified_by is distinct from old.identity_verified_by
      or new.identity_verification_notes is distinct from old.identity_verification_notes
      or new.verified_at is distinct from old.verified_at then
      raise exception 'Professional verification fields are managed by PB Finance.';
    end if;

    if new.status is distinct from old.status
      and new.status not in ('draft', 'pending_review') then
      raise exception 'Professional approval status is managed by PB Finance.';
    end if;

    if new.profile_visibility is distinct from old.profile_visibility
      and not public.professional_can_toggle_profile_visibility(old.user_id) then
      raise exception 'Only verified professionals can toggle profile visibility.';
    end if;
  end if;

  if new.profile_visibility = 'visible'
    and (
      new.professional_tier <> 'verified'
      or new.status <> 'approved'
      or new.identity_verification_status <> 'approved'
    ) then
    raise exception 'Only verified professionals can be visible to clients.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_professional_owner_managed_change on public.professional_profiles;
create trigger prevent_professional_owner_managed_change
  before insert or update on public.professional_profiles
  for each row
  execute function public.prevent_professional_owner_managed_change();

drop trigger if exists set_professional_profiles_updated_at on public.professional_profiles;
create trigger set_professional_profiles_updated_at
  before update on public.professional_profiles
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_client_companies_updated_at on public.client_companies;
create trigger set_client_companies_updated_at
  before update on public.client_companies
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_agencies_updated_at on public.agencies;
create trigger set_agencies_updated_at
  before update on public.agencies
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_shortlists_updated_at on public.shortlists;
create trigger set_shortlists_updated_at
  before update on public.shortlists
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_opportunities_updated_at on public.opportunities;
create trigger set_opportunities_updated_at
  before update on public.opportunities
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_interviews_updated_at on public.interviews;
create trigger set_interviews_updated_at
  before update on public.interviews
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_contracts_updated_at on public.contracts;
create trigger set_contracts_updated_at
  before update on public.contracts
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at
  before update on public.invoices
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_payment_methods_updated_at on public.payment_methods;
create trigger set_payment_methods_updated_at
  before update on public.payment_methods
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_timesheets_updated_at on public.timesheets;
create trigger set_timesheets_updated_at
  before update on public.timesheets
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_client_jobs_updated_at on public.client_jobs;
create trigger set_client_jobs_updated_at
  before update on public.client_jobs
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_professional_reviews_updated_at on public.professional_reviews;
create trigger set_professional_reviews_updated_at
  before update on public.professional_reviews
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_client_background_checks_updated_at on public.client_background_checks;
create trigger set_client_background_checks_updated_at
  before update on public.client_background_checks
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_client_job_comments_updated_at on public.client_job_comments;
create trigger set_client_job_comments_updated_at
  before update on public.client_job_comments
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_client_job_contacts_updated_at on public.client_job_contacts;
create trigger set_client_job_contacts_updated_at
  before update on public.client_job_contacts
  for each row
  execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, company, role, client_tier, title)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'company',
    case
      when new.raw_user_meta_data ->> 'role' in ('client', 'professional') then new.raw_user_meta_data ->> 'role'
      else 'client'
    end,
    case
      when coalesce(new.raw_user_meta_data ->> 'role', 'client') = 'client'
        and new.raw_user_meta_data ->> 'client_tier' in ('basic', 'verified', 'vip')
        then new.raw_user_meta_data ->> 'client_tier'
      else 'basic'
    end,
    new.raw_user_meta_data ->> 'title'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    company = excluded.company,
    role = excluded.role,
    client_tier = case
      when excluded.role = 'client' then excluded.client_tier
      else profiles.client_tier
    end,
    title = excluded.title;

  if new.raw_user_meta_data ->> 'role' = 'professional' then
    insert into public.professional_profiles (user_id, status, professional_tier, profile_visibility)
    values (new.id, 'draft', 'unverified', 'hidden')
    on conflict (user_id) do nothing;
  end if;

  if coalesce(new.raw_user_meta_data ->> 'role', 'client') = 'client'
    and coalesce(new.raw_user_meta_data ->> 'company', '') <> '' then
    insert into public.client_companies (owner_id, name, billing_email)
    values (
      new.id,
      new.raw_user_meta_data ->> 'company',
      new.email
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

insert into public.profiles as p (id, email, full_name, company, role, client_tier, title)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  u.raw_user_meta_data ->> 'company',
  case
    when u.raw_user_meta_data ->> 'role' in ('client', 'professional') then u.raw_user_meta_data ->> 'role'
    else 'client'
  end,
  case
    when coalesce(u.raw_user_meta_data ->> 'role', 'client') = 'client'
      and u.raw_user_meta_data ->> 'client_tier' in ('basic', 'verified', 'vip')
      then u.raw_user_meta_data ->> 'client_tier'
    else 'basic'
  end,
  u.raw_user_meta_data ->> 'title'
from auth.users u
on conflict (id) do update
set
  email = excluded.email,
  full_name = coalesce(excluded.full_name, p.full_name),
  company = coalesce(excluded.company, p.company),
  client_tier = coalesce(p.client_tier, excluded.client_tier),
  title = coalesce(excluded.title, p.title),
  updated_at = now();

insert into public.professional_profiles (user_id, status, professional_tier, profile_visibility)
select p.id, 'draft', 'unverified', 'hidden'
from public.profiles p
where p.role = 'professional'
on conflict (user_id) do nothing;

insert into public.client_companies (owner_id, name, billing_email)
select p.id, p.company, p.email
from public.profiles p
where p.role = 'client'
  and coalesce(p.company, '') <> ''
  and not exists (
    select 1
    from public.client_companies cc
    where cc.owner_id = p.id
  )
on conflict do nothing;
