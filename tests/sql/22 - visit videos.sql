-- 22 - visit videos
--
-- One short video per visit (up to 15 seconds), when the office allows it for
-- a technician. It travels and is stored exactly like a photo (kind 'video'),
-- with three differences:
--   - only owners and admin technicians can see it (it is for the office,
--     never sent to the customer);
--   - it is cleared out after 7 days, not 3 years: photos_past_keeping now
--     lists videos older than 7 days, and the office website's daily clean-up
--     deletes them from storage, as it already does for old photos;
--   - the bucket takes files up to 10 MB (was 5 MB), so a video fits.
--
-- Needs 10 first. Safe to run more than once.

-- A video is a kind of photo the app takes
create or replace function public.push_photo(
  p_id text, p_customer_id text, p_kind text, p_body text, p_visit_id text,
  p_equipment_id text, p_path text, p_bytes integer, p_taken_at timestamptz, p_service_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := coalesce(public.my_company_id(), public.my_upload_grace_company());
  v_tech    text := public.my_technician_id();
begin
  if v_company is null then raise exception 'This account is not attached to a company'; end if;
  if coalesce(p_id, '') = '' or coalesce(p_customer_id, '') = '' or coalesce(p_path, '') = ''
     or p_taken_at is null then
    raise exception 'A photo needs an id, a customer, a file and when it was taken';
  end if;
  if p_kind not in ('before', 'after', 'gate', 'equipment', 'custom', 'video') then
    raise exception 'That is not a kind of photo this app takes';
  end if;
  if p_path <> v_company::text || '/' || p_customer_id || '/' || p_id then
    raise exception 'A photo can only be filed under its own company and customer';
  end if;
  perform 1 from public.customers c where c.company_id = v_company and c.id = p_customer_id;
  if not found then raise exception 'That customer is not on the server yet'; end if;

  if exists (select 1 from public.photos where company_id = v_company and id = p_id) then
    return jsonb_build_object('result', 'already there');
  end if;

  insert into public.photos (company_id, id, customer_id, kind, body, visit_id, equipment_id,
                             path, bytes, taken_at, service_date, technician_id, uploaded_by)
  values (v_company, p_id, p_customer_id, p_kind, p_body, nullif(p_visit_id, ''), nullif(p_equipment_id, ''),
          p_path, p_bytes, p_taken_at, p_service_date, v_tech, auth.uid());
  return jsonb_build_object('result', 'saved', 'path', p_path);
end;
$$;

-- Videos: the office only. Photos: as in 10.
drop policy if exists "photos readable by who may see the customer" on public.photos;
create policy "photos readable by who may see the customer" on public.photos
  for select to authenticated
  using (company_id = public.my_company_id()
         and (public.my_full_access()
              or (kind <> 'video'
                  and exists (select 1 from public.customers c
                              where c.company_id = photos.company_id and c.id = photos.customer_id
                                and c.data->>'technicianId' = public.my_technician_id()))));

-- Photos older than three years, and videos older than 7 days, for the
-- office's clean-up to delete from the bucket
create or replace function public.photos_past_keeping()
returns setof public.photos
language sql stable security definer set search_path = public as $$
  select * from public.photos
   where company_id = public.my_company_id() and public.my_full_access()
     and (taken_at < now() - interval '3 years'
          or (kind = 'video' and taken_at < now() - interval '7 days'))
$$;

revoke all on function public.push_photo(text, text, text, text, text, text, text, integer, timestamptz, date) from public, anon;
revoke all on function public.photos_past_keeping() from public, anon;
grant execute on function public.push_photo(text, text, text, text, text, text, text, integer, timestamptz, date) to authenticated;
grant execute on function public.photos_past_keeping() to authenticated;

-- Room for a 15-second video in the bucket
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Supabase Storage not present here; bucket limit skipped';
    return;
  end if;
  update storage.buckets set file_size_limit = 10485760 where id = 'visit-photos';
end $$;
