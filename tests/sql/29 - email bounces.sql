-- 29 - email bounces
--
-- Emails Resend accepted but couldn't deliver (bounced), that were marked as
-- spam, or that failed. The email-events function writes them here from
-- Resend's webhook; each company's office reads its own and shows them under
-- Alerts → Emails.
--
-- Only the server writes (the function uses the service key). Signed-in
-- people see their own company's rows and nothing else. Nothing for anon.
-- Safe to run more than once.

create table if not exists public.email_events (
  id text primary key,                 -- Resend's email id + ':' + what happened
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id text,
  to_address text,
  subject text,
  event text not null,                 -- bounced, complained or failed
  reason text,
  happened_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_events_company_created on public.email_events (company_id, created_at);

alter table public.email_events enable row level security;

drop policy if exists email_events_read_own on public.email_events;
create policy email_events_read_own on public.email_events
  for select to authenticated using (company_id = public.my_company_id());

-- Supabase's defaults hand new tables to authenticated with more than reading
-- (truncate, among others): take everything back, then give only reading
revoke all on public.email_events from anon, authenticated;
grant select on public.email_events to authenticated;
grant select, insert on public.email_events to service_role;
