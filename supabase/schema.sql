create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  company text,
  role text not null default 'client',
  title text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'client', 'professional'));

create table if not exists public.professional_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  bio text,
  location text,
  country text default 'Philippines',
  timezone text,
  years_experience integer,
  hourly_rate numeric(10, 2),
  availability text not null default 'available_now' check (availability in ('available_now', 'available_soon', 'not_available')),
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'approved', 'hidden', 'rejected')),
  rating numeric(3, 2),
  review_count integer not null default 0,
  tools text[] not null default '{}',
  skills text[] not null default '{}',
  certifications text[] not null default '{}',
  industries text[] not null default '{}',
  work_preferences jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  status text not null default 'invited' check (status in ('invited', 'accepted', 'declined', 'active', 'closed')),
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
  status text not null default 'scheduled' check (status in ('requested', 'scheduled', 'completed', 'cancelled', 'no_show')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create index if not exists professional_profiles_status_idx on public.professional_profiles(status);
create index if not exists agencies_status_idx on public.agencies(status);
create index if not exists shortlists_client_id_idx on public.shortlists(client_id);
create index if not exists opportunities_professional_id_idx on public.opportunities(professional_id);
create index if not exists interviews_client_id_idx on public.interviews(client_id);
create index if not exists contracts_client_id_idx on public.contracts(client_id);
create index if not exists invoices_client_id_idx on public.invoices(client_id);
create index if not exists timesheets_professional_id_idx on public.timesheets(professional_id);
create index if not exists match_requests_client_id_idx on public.match_requests(client_id);

alter table public.profiles enable row level security;
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

drop policy if exists "Profiles are visible to their owners" on public.profiles;
create policy "Profiles are visible to their owners"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Approved professional profile owners are visible" on public.profiles;
create policy "Approved professional profile owners are visible"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.professional_profiles
      where professional_profiles.user_id = profiles.id
        and professional_profiles.status = 'approved'
    )
  );

drop policy if exists "Related client profiles are visible to talent" on public.profiles;
create policy "Related client profiles are visible to talent"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.opportunities
      where opportunities.client_id = profiles.id
        and opportunities.professional_id = auth.uid()
    )
    or exists (
      select 1
      from public.interviews
      where interviews.client_id = profiles.id
        and interviews.professional_id = auth.uid()
    )
    or exists (
      select 1
      from public.contracts
      where contracts.client_id = profiles.id
        and contracts.professional_id = auth.uid()
    )
  );

drop policy if exists "Profiles are editable by their owners" on public.profiles;
create policy "Profiles are editable by their owners"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Professional profiles are visible to owners and approved clients" on public.professional_profiles;
create policy "Professional profiles are visible to owners and approved clients"
  on public.professional_profiles
  for select
  to authenticated
  using (auth.uid() = user_id or status = 'approved');

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
  using (auth.uid() = owner_id or status = 'approved');

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
create policy "Shortlists are visible to related users"
  on public.shortlists
  for select
  using (auth.uid() = client_id or auth.uid() = professional_id);

drop policy if exists "Shortlists are managed by clients" on public.shortlists;
create policy "Shortlists are managed by clients"
  on public.shortlists
  for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

drop policy if exists "Opportunities are visible to related users" on public.opportunities;
create policy "Opportunities are visible to related users"
  on public.opportunities
  for select
  using (auth.uid() = client_id or auth.uid() = professional_id);

drop policy if exists "Opportunities are managed by clients" on public.opportunities;
create policy "Opportunities are managed by clients"
  on public.opportunities
  for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

drop policy if exists "Opportunities are answerable by professionals" on public.opportunities;
create policy "Opportunities are answerable by professionals"
  on public.opportunities
  for update
  using (auth.uid() = professional_id)
  with check (auth.uid() = professional_id);

drop policy if exists "Interviews are visible to related users" on public.interviews;
create policy "Interviews are visible to related users"
  on public.interviews
  for select
  using (auth.uid() = client_id or auth.uid() = professional_id);

drop policy if exists "Interviews are managed by clients" on public.interviews;
create policy "Interviews are managed by clients"
  on public.interviews
  for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

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
    auth.uid() = professional_id
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
  using (auth.uid() = professional_id)
  with check (auth.uid() = professional_id);

drop policy if exists "Match requests are managed by clients" on public.match_requests;
create policy "Match requests are managed by clients"
  on public.match_requests
  for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, company, role, title)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'company',
    case
      when new.raw_user_meta_data ->> 'role' in ('admin', 'client', 'professional') then new.raw_user_meta_data ->> 'role'
      else 'client'
    end,
    new.raw_user_meta_data ->> 'title'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    company = excluded.company,
    role = excluded.role,
    title = excluded.title;

  if new.raw_user_meta_data ->> 'role' = 'professional' then
    insert into public.professional_profiles (user_id, status)
    values (new.id, 'draft')
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

insert into public.profiles as p (id, email, full_name, company, role, title)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  u.raw_user_meta_data ->> 'company',
  case
    when u.raw_user_meta_data ->> 'role' in ('admin', 'client', 'professional') then u.raw_user_meta_data ->> 'role'
    else 'client'
  end,
  u.raw_user_meta_data ->> 'title'
from auth.users u
on conflict (id) do update
set
  email = excluded.email,
  full_name = coalesce(excluded.full_name, p.full_name),
  company = coalesce(excluded.company, p.company),
  title = coalesce(excluded.title, p.title),
  updated_at = now();

insert into public.professional_profiles (user_id, status)
select p.id, 'draft'
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
