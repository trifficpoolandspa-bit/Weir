-- 36 - permanently delete customers
--
-- The bin beside a customer in Settings > Restore customers (Oct 19) deletes
-- them for good. Their details and every saved earlier version go at once.
-- The row stays as an empty "deleted" marker, holding nothing about them, so
-- a phone that has been offline still drops its copy at its next sync instead
-- of sending it back. 14 clears these markers out later, as it does others.
--
-- Only a customer already deleted, only in your own company, and only for an
-- owner or admin. Needs 02, 04 and 06 first. Safe to run more than once.
-- Changes a function only: no new table, so no new GRANTs beyond it.

create or replace function public.purge_deleted_customer(p_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.my_company_id();
  v_n bigint;
begin
  if not public.my_full_access() then raise exception 'Only an owner or admin can delete customers permanently'; end if;

  update public.customers
     set data = '{}'::jsonb,
         field_times = jsonb_build_object('_deleted', coalesce(field_times->'_deleted', to_jsonb(clock_timestamp()::text))),
         updated_at = clock_timestamp()
   where company_id = v_company and id = p_id and deleted;
  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('id', p_id, 'purged', false); end if;

  delete from public.customer_versions where company_id = v_company and customer_id = p_id;

  return jsonb_build_object('id', p_id, 'purged', true);
end;
$$;

revoke all on function public.purge_deleted_customer(text) from public, anon;
grant execute on function public.purge_deleted_customer(text) to authenticated;
