-- 34 - quote download
--
-- The Download quote button in a quote email (Oct 15). When a quote is sent,
-- the website now keeps its breakdown (the items, prices, total, notes and the
-- company's details) with the quote's secret code. The button opens the
-- website's quote page, which asks for that breakdown with the code and turns
-- it into a PDF on the customer's phone or computer.
--
-- Only someone holding the email's link can read a breakdown: the code is 32
-- random characters, and quote_download gives back nothing for anything else.
-- Nothing else in quote_responses can be read this way, and nothing can be
-- changed. It keeps working after the quote is answered or expires.
--
-- Until this has been run, quotes still go out with Approve and Decline, just
-- without the Download button. Needs 17 first. Safe to run more than once.

alter table public.quote_responses add column if not exists details jsonb;

create or replace function public.quote_download(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select qr.details || jsonb_build_object('companyName', coalesce(c.name, ''))
  from public.quote_responses qr
  left join public.companies c on c.id = qr.company_id
  where p_token ~ '^[0-9a-f]{32}$'
    and qr.token = p_token
    and qr.details is not null
  limit 1
$$;

revoke all on function public.quote_download(text) from public;
grant execute on function public.quote_download(text) to anon, authenticated;
