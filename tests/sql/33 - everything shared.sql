-- 33 - everything shared
--
-- Two fixes, so the website, the app and every computer stay in step:
--
-- 1. A filter clean or pool drain finished on the phone with extra work ticked
--    off (Oct 13) was turned away by the server, because the phone sends which
--    items were done (doneExtraWork) and the server didn't allow that field
--    from a technician. The whole finish was refused, so the office never saw
--    it done. This lets that one field through, along with how long the job
--    took (doneDurationMs, from 32).
--
-- 2. The filter clean groups, the drain calendar, the quotes and work orders
--    sent, and service calls were kept only in the browser they were made in,
--    so another computer never saw them. Each is now a company record of its
--    own kind ('filter_group', 'drain_entry', 'quote', 'service_call'). Only
--    the office can read or change them; technicians never see them.
--
-- Includes everything 31 and 32 did, so it can be run on its own whether or
-- not those were. Safe to run more than once. Changes a constraint and two
-- functions; no data is touched.

alter table public.company_records drop constraint if exists company_records_kind_check;
alter table public.company_records add constraint company_records_kind_check
  check (kind in ('technician', 'company', 'setup', 'setting',
                  'task', 'filter_clean', 'pool_drain', 'work_order', 'reschedule',
                  'filter_group', 'drain_entry', 'quote', 'service_call'));

-- Is this record for the technician asking?
create or replace function public.record_is_mine(p_kind text, p_data jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.my_technician_id() is null then false
    when p_kind in ('task', 'filter_clean', 'pool_drain', 'work_order')
      then p_data->>'technicianId' = public.my_technician_id()
    when p_kind = 'reschedule'
      then exists (select 1 from public.customers c
                   where c.company_id = public.my_company_id()
                     and c.id = p_data->>'customerId'
                     and c.data->>'technicianId' = public.my_technician_id())
    else false
  end
$$;

create or replace function public.check_record_write(p_kind text, p_id text, p_changes jsonb)
returns void language plpgsql stable security definer set search_path = public as $$
declare
  v_existing jsonb;
  v_found boolean;
  v_fields text[];
begin
  if public.my_full_access() then return; end if;
  if public.my_technician_id() is null then raise exception 'Only the office can change this'; end if;

  select data into v_existing from public.company_records
   where company_id = public.my_company_id() and kind = p_kind and id = p_id;
  v_found := found;
  select coalesce(array_agg(k), '{}') into v_fields from jsonb_object_keys(p_changes) k;

  if p_kind = 'task' then
    if not v_found then raise exception 'Only the office can add a task'; end if;
    if not public.record_is_mine('task', v_existing) then raise exception 'That task is not yours'; end if;
    if exists (select 1 from unnest(v_fields) f
               where f not in ('done', 'doneAt', 'doneBy', 'doneNotes', 'doneVideo', 'doneVideoMore', 'doneDurationMs')) then
      raise exception 'A technician can only tick a task off';
    end if;
    return;
  end if;

  if p_kind in ('work_order', 'filter_clean', 'pool_drain') then
    -- Finishing one of their own work order visits, filter cleans or pool
    -- drains, with up to three photos and three videos, how long it took, and
    -- the extra work ticked off (doneExtraWork, Oct 13)
    if not v_found then raise exception 'Only the office can add this'; end if;
    if not public.record_is_mine(p_kind, v_existing) then raise exception 'That one is not yours'; end if;
    if exists (select 1 from unnest(v_fields) f
               where f not in ('status', 'doneAt', 'doneBy', 'doneNotes',
                               'donePhoto', 'doneVideo', 'donePhotoMore', 'doneVideoMore',
                               'doneReplacements', 'doneDurationMs', 'doneExtraWork')) then
      raise exception 'A technician can only mark this done';
    end if;
    if p_changes ? 'status' and coalesce(p_changes->'status'->>'v', '') <> 'done' then
      raise exception 'A technician can only mark this done';
    end if;
    return;
  end if;

  if p_kind = 'reschedule' then
    -- Moving a visit for one of their own customers, new or changed
    if v_found and not public.record_is_mine('reschedule', v_existing) then
      raise exception 'That visit is not yours to move';
    end if;
    if not v_found and not public.record_is_mine('reschedule',
        jsonb_build_object('customerId', p_changes->'customerId'->>'v')) then
      raise exception 'That visit is not yours to move';
    end if;
    return;
  end if;

  raise exception 'Only the office can change this';
end;
$$;

revoke all on function public.check_record_write(text, text, jsonb) from public, anon;
grant execute on function public.check_record_write(text, text, jsonb) to authenticated;
