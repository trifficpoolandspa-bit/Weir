-- 14 - Clear out what was deleted
--
-- A customer, technician or job that is deleted is marked rather than removed,
-- so a phone that has been offline learns it is gone instead of pushing it
-- back. Once every phone has had a fair chance to hear about it, the marked
-- row has no job left to do.
--
-- This removes anything marked deleted longer ago than the number of days
-- below. Ninety is deliberately generous: a phone out of use for three months
-- is re-set up from scratch anyway, and its sync state has long since expired.
--
-- Nothing a company can still see is touched. Only rows already marked.
--
-- Run it by hand whenever you like, or set it on a schedule (see the note at
-- the end). Safe to run more than once.

create or replace function public.clear_out_deleted(p_days integer default 90)
returns table(what text, removed bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz := now() - make_interval(days => greatest(coalesce(p_days, 90), 30));
  v_n bigint;
begin
  -- Customers, and the versions kept against them
  delete from public.customer_versions cv
   using public.customers c
   where cv.company_id = c.company_id and cv.customer_id = c.id
     and c.deleted and c.updated_at < v_cutoff;

  delete from public.customers where deleted and updated_at < v_cutoff;
  get diagnostics v_n = row_count;
  what := 'customers'; removed := v_n; return next;

  -- Technicians, setup, settings and work records all live together
  delete from public.record_versions rv
   using public.company_records r
   where rv.company_id = r.company_id and rv.kind = r.kind and rv.record_id = r.id
     and r.deleted and r.updated_at < v_cutoff;

  delete from public.company_records where deleted and updated_at < v_cutoff;
  get diagnostics v_n = row_count;
  what := 'technicians, setup and work'; removed := v_n; return next;

  -- A photo record whose file has already gone
  delete from public.photos where deleted and updated_at < v_cutoff;
  get diagnostics v_n = row_count;
  what := 'photo records'; removed := v_n; return next;

  return;
end;
$$;

revoke all on function public.clear_out_deleted(integer) from public, anon, authenticated;

-- ---- Run it now ----
select * from public.clear_out_deleted(90);

-- ---- To have it run by itself ----
-- Supabase can run this on a schedule. In the dashboard: Integrations > Cron,
-- then a new job with the command below, weekly is plenty:
--
--   select public.clear_out_deleted(90);
--
-- It is deliberately not scheduled here: a clean-up that starts running on its
-- own the moment a snippet is pasted is not something anyone should inherit by
-- surprise.
