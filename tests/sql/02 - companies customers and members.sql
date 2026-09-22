-- 02 - Companies, customers and members
--
-- The three tables everything else is built on. On the working project these
-- were created long before the snippets were kept in the repository, so this
-- rebuilds them for a new project: a beta server, or a second one later.
--
-- A company owns its customers. A member is a person signed in to that
-- company, either the owner or a technician. Every later snippet adds to these
-- rather than replacing them, so running this first is all that is needed.
--
-- Nothing here is destructive. Safe to run more than once, and safe to run on
-- a project that already has these tables.

create extension if not exists pgcrypto with schema extensions;

-- ---- The tables ----
create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role       text not null default 'technician',
  name       text,
  created_at timestamptz not null default now()
);

create index if not exists members_by_company on public.members (company_id);

-- A customer is stored as one record of its own making: the app decides what a
-- customer looks like, and the server keeps it whole. Sync merges field by
-- field on top of this.
create table if not exists public.customers (
  company_id uuid not null references public.companies(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  deleted    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

-- ---- Who you are ----
-- Which company the person signed in belongs to. Everything else asks this.
create or replace function public.my_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select m.company_id from public.members m where m.user_id = auth.uid()
$$;

create or replace function public.my_is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select m.role = 'owner' from public.members m where m.user_id = auth.uid()), false)
$$;

-- ---- Nobody sees another company's anything ----
alter table public.companies enable row level security;
alter table public.members   enable row level security;
alter table public.customers enable row level security;

drop policy if exists companies_own on public.companies;
create policy companies_own on public.companies
  for select to authenticated using (id = public.my_company_id());

drop policy if exists members_own_company on public.members;
create policy members_own_company on public.members
  for select to authenticated using (company_id = public.my_company_id());

drop policy if exists customers_read on public.customers;
create policy customers_read on public.customers
  for select to authenticated using (company_id = public.my_company_id());

-- Writing goes through push_customer_fields in snippet 04, which is what keeps
-- two devices from overwriting each other. These allow it to do its work.
drop policy if exists customers_write on public.customers;
create policy customers_write on public.customers
  for insert to authenticated with check (company_id = public.my_company_id());

drop policy if exists customers_change on public.customers;
create policy customers_change on public.customers
  for update to authenticated using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

-- ---- What the app may reach ----
grant usage on schema public to authenticated, anon;

-- Supabase hands new tables to anon and authenticated by default. Row level
-- security still refuses every row, but the permission should not be there:
-- the day a table is added without a policy, that default is the hole.
revoke all on public.companies from anon;
revoke all on public.members   from anon;
revoke all on public.customers from anon;

grant select on public.companies, public.members to authenticated;
grant select, insert, update on public.customers to authenticated;

revoke all on function public.my_company_id() from public, anon;
revoke all on function public.my_is_owner() from public, anon;
grant execute on function public.my_company_id() to authenticated;
grant execute on function public.my_is_owner() to authenticated;
