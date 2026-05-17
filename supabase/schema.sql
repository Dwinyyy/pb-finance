create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  company text,
  role text not null default 'client' check (role in ('client', 'professional')),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are visible to their owners" on public.profiles;
create policy "Profiles are visible to their owners"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Profiles are editable by their owners" on public.profiles;
create policy "Profiles are editable by their owners"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

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
      when new.raw_user_meta_data ->> 'role' in ('client', 'professional') then new.raw_user_meta_data ->> 'role'
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

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
