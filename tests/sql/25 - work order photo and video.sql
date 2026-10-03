-- 25 - work order photo and video
--
-- A work order visit submitted on the phone now carries its photo and video to
-- the office, so the visit shows in the customer's Service reports with them.
-- Snippet 16 let a technician mark their own work order visit done (status,
-- doneAt, doneBy, doneNotes) and nothing else; this adds the two references:
--   donePhoto   the job photo (the file itself travels like a visit photo)
--   doneVideo   the job video (travels like a visit video: office only, kept 7 days)
-- Filter cleans (Oct 3): a technician may now finish their own the same way —
-- status 'done', doneAt, doneBy, doneNotes, donePhoto, doneVideo.
-- Tasks are unchanged. Everything else stays the office's, exactly as in 16.
--
-- Needs 16 first. Safe to run more than once. Changes a function only: no new
-- table, so no new GRANTs.

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
    if exists (select 1 from unnest(v_fields) f where f not in ('done', 'doneAt', 'doneBy', 'doneNotes')) then
      raise exception 'A technician can only tick a task off';
    end if;
    return;
  end if;

  if p_kind = 'work_order' then
    -- Finishing one of their own work order visits, with its photo and video
    if not v_found then raise exception 'Only the office can add a work order'; end if;
    if not public.record_is_mine('work_order', v_existing) then raise exception 'That visit is not yours'; end if;
    if exists (select 1 from unnest(v_fields) f
               where f not in ('status', 'doneAt', 'doneBy', 'doneNotes', 'donePhoto', 'doneVideo')) then
      raise exception 'A technician can only mark a work order visit done';
    end if;
    if p_changes ? 'status' and coalesce(p_changes->'status'->>'v', '') <> 'done' then
      raise exception 'A technician can only mark a work order visit done';
    end if;
    return;
  end if;

  if p_kind = 'filter_clean' then
    -- Finishing one of their own filter cleans on the job screen (Oct 3), the
    -- same as a work order visit
    if not v_found then raise exception 'Only the office can add a filter clean'; end if;
    if not public.record_is_mine('filter_clean', v_existing) then raise exception 'That filter clean is not yours'; end if;
    if exists (select 1 from unnest(v_fields) f
               where f not in ('status', 'doneAt', 'doneBy', 'doneNotes', 'donePhoto', 'doneVideo')) then
      raise exception 'A technician can only mark a filter clean done';
    end if;
    if p_changes ? 'status' and coalesce(p_changes->'status'->>'v', '') <> 'done' then
      raise exception 'A technician can only mark a filter clean done';
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
