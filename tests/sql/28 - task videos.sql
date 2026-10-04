-- 28 - task videos
--
-- A task finished on the phone can now send its videos (doneVideo and
-- doneVideoMore), so they show in the website's Alerts. They travel and are
-- kept like a visit's videos: office only, deleted after 7 days. Nothing else
-- changes.
--
-- Needs 27 first. Safe to run more than once. Changes a function only.

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
               where f not in ('done', 'doneAt', 'doneBy', 'doneNotes', 'doneVideo', 'doneVideoMore')) then
      raise exception 'A technician can only tick a task off';
    end if;
    return;
  end if;

  if p_kind in ('work_order', 'filter_clean') then
    -- Finishing one of their own work order visits or filter cleans, with up
    -- to three photos and three videos
    if not v_found then raise exception 'Only the office can add this'; end if;
    if not public.record_is_mine(p_kind, v_existing) then raise exception 'That one is not yours'; end if;
    if exists (select 1 from unnest(v_fields) f
               where f not in ('status', 'doneAt', 'doneBy', 'doneNotes',
                               'donePhoto', 'doneVideo', 'donePhotoMore', 'doneVideoMore',
                               'doneReplacements')) then
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
