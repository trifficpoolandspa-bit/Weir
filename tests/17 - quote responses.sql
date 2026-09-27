-- 17 - quote responses
--
-- Approve and Deny buttons in a quote email. Each quote sent gets a secret code
-- here; the customer's press (through the quote-response function) records
-- their answer against it, and the website files the quote into History as
-- Approved or Denied at its next sync.
--
-- Only the company's own signed-in people can read their entries, or add one
-- when sending a quote. Nobody signed in can write an answer: only the
-- quote-response function can, and only once per sending.
--
-- Needs 02 and 06 first. Safe to run more than once.

create table if not exists public.quote_responses (
  company_id   uuid not null references public.companies(id) on delete cascade,
  quote_id     text not null,
  token        text not null unique,
  outcome      text check (outcome in ('approved', 'denied')),
  responded_at timestamptz,
  created_at   timestamptz not null default now(),
  primary key (company_id, quote_id)
);

alter table public.quote_responses enable row level security;

drop policy if exists "quote responses: read own company" on public.quote_responses;
create policy "quote responses: read own company" on public.quote_responses
  for select to authenticated using (company_id = public.my_company_id());

-- Sending (or resending) a quote adds its entry, with no answer yet
drop policy if exists "quote responses: add when sending" on public.quote_responses;
create policy "quote responses: add when sending" on public.quote_responses
  for insert to authenticated with check (company_id = public.my_company_id() and outcome is null and responded_at is null);

drop policy if exists "quote responses: fresh code when resending" on public.quote_responses;
create policy "quote responses: fresh code when resending" on public.quote_responses
  for update to authenticated using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id() and outcome is null and responded_at is null);

grant select, insert, update on public.quote_responses to authenticated;
grant all on public.quote_responses to service_role;
