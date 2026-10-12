-- 18 - moved customers
--
-- A visit moved "just once" to another technician (a reschedule record whose
-- technicianId names them) lets that technician, for as long as the move is
-- current:
--   see the move itself            (before, only the customer's own technician could)
--   see the customer               (before, only customers assigned to them)
--   record the service on it       lastServicedDate, lastServicedAt,
--                                  lastServiceDurationMs, servicedFor and
--                                  pendingRedo — nothing else
-- They cannot change the customer's name, address, gate codes or anything
-- else, or reassign them. Everything else is exactly as in 06 and 09.
--
-- "Current" means the move's date is no more than two days ago, so a visit
-- finished late in the evening, or held on a phone overnight, still arrives.
--
-- Needs 06 and 09 first. Safe to run more than once. Changes functions and one
-- read rule only: no new table, so no new GRANTs.

-- Is this customer moved to the technician asking, on a move that's current?
create or replace function public.customer_moved_to_me(p_customer_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.my_technician_id() is not null and exists (
    select 1 from public.company_records r
     where r.company_id = public.my_company_id()
       and r.kind = 'reschedule'
       and not r.deleted
       and r.data->>'customerId' = p_customer_id
       and r.data->>'technicianId' = public.my_technician_id()
       and coalesce(r.data->>'toDate', '') >= to_char(current_date - 2, 'YYYY-MM-DD'))
$$;

revoke all on function public.customer_moved_to_me(text) from public, anon;
grant execute on function public.customer_moved_to_me(text) to authenticated;

-- As in 09, and a move naming this technician is theirs too
create or replace function public.record_is_mine(p_kind text, p_data jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.my_technician_id() is null then false
    when p_kind in ('task', 'filter_clean', 'work_order')
      then p_data->>'technicianId' = public.my_technician_id()
    when p_kind = 'reschedule'
      then p_data->>'technicianId' = public.my_technician_id()
        or exists (select 1 from public.customers c
                   where c.company_id = public.my_company_id()
                     and c.id = p_data->>'customerId'
                     and c.data->>'technicianId' = public.my_technician_id())
    else false
  end
$$;

-- As in 06, and a customer moved to them just once
drop policy if exists "customers readable by who may see them" on public.customers;
create policy "customers readable by who may see them" on public.customers
  for select to authenticated
  using (company_id = public.my_company_id()
         and (public.my_full_access()
              or data->>'technicianId' = public.my_technician_id()
              or public.customer_moved_to_me(id)));

-- As in 06, and on a customer moved to them just once, only the service
create or replace function public.check_customer_write(p_id text, p_changes jsonb)
returns void language plpgsql stable security definer set search_path = public as $$
declare
  v_tech text;
  v_assigned text;
  v_found boolean;
begin
  if public.my_full_access() then return; end if;
  v_tech := public.my_technician_id();
  if v_tech is null then raise exception 'This account has no technician profile'; end if;
  select data->>'technicianId' into v_assigned from public.customers
   where company_id = public.my_company_id() and id = p_id;
  v_found := found;
  if not v_found then raise exception 'Only the office can add customers'; end if;
  -- Someone else's customer, moved to this technician just once
  if v_assigned is distinct from v_tech and public.customer_moved_to_me(p_id) then
    if exists (select 1 from jsonb_object_keys(p_changes) k
               where k not in ('lastServicedDate', 'lastServicedAt', 'lastServiceDurationMs',
                               'servicedFor', 'pendingRedo')) then
      raise exception 'This customer is only moved to you for the day: just their service can be recorded';
    end if;
    return;
  end if;
  if v_assigned is distinct from v_tech then raise exception 'This customer is not assigned to you'; end if;
  if p_changes ? 'technicianId' and (p_changes->'technicianId'->>'v') is distinct from v_tech then
    raise exception 'Only the office can reassign a customer';
  end if;
  if p_changes ? '_deleted' then
    raise exception 'Only the office can delete or restore a customer';
  end if;
end;
$$;
