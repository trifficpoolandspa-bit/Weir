-- 21 - delete technicians completely
--
-- Deleting a technician on the website now removes them completely, at once:
--   their sign-in (the account itself, so the username is free straight away),
--   their membership of the company, their technician profile's contents and
--   every saved earlier version of it.
-- Before, the sign-in was only switched off and kept for 7 days so a phone
-- still signed in could upload visits it was holding; that grace is gone.
--
-- The profile is left as an empty "deleted" marker, holding nothing about the
-- person, only so every other device drops its copy at its next sync. The
-- service reports they submitted stay: they are the customers' history.
--
-- Also clears out, now, any sign-in that was switched off the old way and is
-- still waiting out its 7 days.
--
-- Needs 06 and 07 first. Safe to run more than once. Changes a function only:
-- no new table, so no new GRANTs.

create or replace function public.remove_technician_account(p_technician_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.my_company_id();
  v_users   uuid[];
begin
  if not public.my_is_owner() then raise exception 'Only an owner can remove technician accounts'; end if;

  -- Their sign-in, and any other technician sign-in already switched off
  select coalesce(array_agg(m.user_id), '{}') into v_users from public.members m
   where m.company_id = v_company and m.role = 'technician'
     and (m.technician_id = p_technician_id or m.removed_at is not null);
  delete from auth.users where id = any(v_users);        -- the membership goes with it

  -- Their profile: emptied and marked deleted, so other devices drop it
  update public.company_records
     set data = '{}'::jsonb, field_times = '{}'::jsonb, deleted = true, updated_at = clock_timestamp()
   where company_id = v_company and kind = 'technician' and id = p_technician_id;
  -- and no earlier versions of it kept
  delete from public.record_versions
   where company_id = v_company and kind = 'technician' and record_id = p_technician_id;

  return jsonb_build_object('technician_id', p_technician_id, 'removed', true);
end;
$$;

revoke all on function public.remove_technician_account(text) from public, anon;
grant execute on function public.remove_technician_account(text) to authenticated;
