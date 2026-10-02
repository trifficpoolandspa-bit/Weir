-- 23 - removed technicians: one day to send
--
-- Deleting a technician still shuts them out at once:
--   - their password stops working, so they can't sign in again anywhere;
--   - their username is free straight away for someone else;
--   - they can read nothing of the company (everything checks for an active
--     membership);
--   - their profile is emptied and every earlier version of it removed.
-- What changes from 21: the phone that was already signed in may, for ONE DAY,
-- still send up visits and photos it was holding (unsent, say, for lack of
-- signal). The app is told the sign-in was removed, sends what it held, then
-- wipes the company's data from the phone. After the day, the account itself
-- is deleted the next time technicians are managed on the website.
--
-- Replaces 21's version of remove_technician_account. Needs 06, 07 and 21.
-- Safe to run more than once. Functions only: no new table, so no new GRANTs.

-- The one-day window for sending what the phone held
create or replace function public.my_upload_grace_company()
returns uuid language sql stable security definer set search_path = public as $$
  select m.company_id from public.members m
  where m.user_id = auth.uid()
    and (m.removed_at is null or m.removed_at > now() - interval '1 day')
$$;

-- What the phone is told about itself (when sending must stop)
create or replace function public.my_membership()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'role', m.role, 'is_admin', m.is_admin, 'full_access', (m.role = 'owner' or m.is_admin),
    'technician_id', m.technician_id, 'username', m.username, 'name', m.name,
    'company_id', m.company_id, 'company_name', c.name,
    'company_code', case when m.role = 'owner' and m.removed_at is null then c.code end,
    'removed', m.removed_at is not null,
    'upload_until', case when m.removed_at is not null then m.removed_at + interval '1 day' end)
  from public.members m join public.companies c on c.id = m.company_id
  where m.user_id = auth.uid()
$$;

-- Accounts past their day are deleted whenever an owner manages accounts
create or replace function public.purge_removed_technicians()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  with gone as (
    delete from auth.users u using public.members m
    where m.user_id = u.id and m.role = 'technician'
      and m.removed_at is not null and m.removed_at <= now() - interval '1 day'
    returning u.id)
  select count(*) into v_count from gone;
  return v_count;
end;
$$;

create or replace function public.remove_technician_account(p_technician_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.my_company_id();
  v_user    uuid;
begin
  if not public.my_is_owner() then raise exception 'Only an owner can remove technician accounts'; end if;
  perform public.purge_removed_technicians();

  select m.user_id into v_user from public.members m
   where m.company_id = v_company and m.technician_id = p_technician_id
     and m.role = 'technician' and m.removed_at is null;

  if v_user is not null then
    -- Shut out now: no access, no admin, the username free for someone else
    -- (usernames only have to be unique among active members)
    update public.members set removed_at = now(), is_admin = false where user_id = v_user;
    -- and the password no longer works, so no new sign-in anywhere
    update auth.users set encrypted_password = '' where id = v_user;
  end if;

  -- Their profile: emptied and marked deleted, so other devices drop it
  update public.company_records
     set data = '{}'::jsonb, field_times = '{}'::jsonb, deleted = true, updated_at = clock_timestamp()
   where company_id = v_company and kind = 'technician' and id = p_technician_id;
  -- and no earlier versions of it kept
  delete from public.record_versions
   where company_id = v_company and kind = 'technician' and record_id = p_technician_id;

  return jsonb_build_object('technician_id', p_technician_id, 'removed', true,
                            'upload_until', case when v_user is not null then now() + interval '1 day' end);
end;
$$;

revoke all on function public.remove_technician_account(text) from public, anon;
grant execute on function public.remove_technician_account(text) to authenticated;
revoke all on function public.purge_removed_technicians() from public, anon, authenticated;
revoke all on function public.my_upload_grace_company() from public, anon;
grant execute on function public.my_upload_grace_company() to authenticated;
revoke all on function public.my_membership() from public, anon;
grant execute on function public.my_membership() to authenticated;
