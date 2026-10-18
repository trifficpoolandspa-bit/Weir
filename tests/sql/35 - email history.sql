-- 35 - email history
--
-- Every email the server sends for a company (service reports, quotes, work
-- order and filter clean emails, pool drain emails, On my way), one row each,
-- for History / Billing → Email history on the website (Oct 18).
--
-- send-report writes the row when Resend accepts the email (status 'sent').
-- email-events moves it on as Resend reports back: delivered, viewed (opened),
-- delayed, bounced, complained (marked as spam) or failed. A later "good" event
-- never covers a problem, and viewed is never taken back to delivered.
--
-- Only the server writes (both functions use the service key). Signed-in
-- people read their own company's rows and nothing else. Nothing for anon.
-- Safe to run more than once.

create table if not exists public.email_log (
  id text primary key,                 -- Resend's email id
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id text,
  to_address text,
  subject text,
  kind text,                           -- report, quote, workorder, clean, drain, onmyway, email
  html text,                           -- the email as the customer got it (photos linked)
  status text not null default 'sent', -- sent, delivered, viewed, delayed, bounced, complained, failed
  reason text,
  sent_at timestamptz not null default now(),
  delivered_at timestamptz,
  opened_at timestamptz,
  problem_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists email_log_company_sent on public.email_log (company_id, sent_at);

alter table public.email_log enable row level security;

drop policy if exists email_log_read_own on public.email_log;
create policy email_log_read_own on public.email_log
  for select to authenticated using (company_id = public.my_company_id());

revoke all on public.email_log from anon, authenticated;
grant select on public.email_log to authenticated;
grant select, insert, update on public.email_log to service_role;

-- What Resend reported, applied to the email's row. Returns false when the
-- email isn't on this server (live and beta both hear every email).
create or replace function public.email_log_event(p_id text, p_event text, p_at timestamptz, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rank_now int;
  rank_new int;
  cur text;
begin
  select status into cur from public.email_log where id = p_id for update;
  if not found then return false; end if;

  -- How far along an email is; a problem outranks everything
  rank_now := case cur when 'sent' then 1 when 'delayed' then 2 when 'delivered' then 3 when 'viewed' then 4 else 9 end;
  rank_new := case p_event when 'sent' then 1 when 'delayed' then 2 when 'delivered' then 3 when 'viewed' then 4
                           when 'bounced' then 9 when 'complained' then 9 when 'failed' then 9 else 0 end;

  update public.email_log set
    status = case when rank_new > rank_now or (rank_new = 9 and rank_now = 9) then p_event else status end,
    delivered_at = case when p_event = 'delivered' then coalesce(delivered_at, p_at) else delivered_at end,
    opened_at = case when p_event = 'viewed' then coalesce(opened_at, p_at) else opened_at end,
    problem_at = case when rank_new = 9 then p_at else problem_at end,
    reason = case when rank_new = 9 then left(p_reason, 500) else reason end,
    updated_at = now()
  where id = p_id;
  return true;
end;
$$;

revoke all on function public.email_log_event(text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.email_log_event(text, text, timestamptz, text) to service_role;
