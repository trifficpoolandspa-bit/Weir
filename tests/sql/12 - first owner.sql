-- 12 - The first owner of a company
--
-- A brand new project has no companies and no accounts, so there is no way to
-- sign in to the office site. This makes the first one.
--
-- Before running it:
--   Authentication > Users > Add user > Create new user
--   Give it your email address and a password, and tick
--   "Auto Confirm User" so there is no confirmation email to chase.
--
-- Then change the two lines below and run it.
--
-- Safe to run more than once: it will not make a second company for the same
-- person, and it will not touch a company that already exists.

do $$
declare
  -- ---- change these two ----
  v_email text := 'you@example.com';         -- the user you just created
  v_company_name text := 'Your Company';     -- what the company is called
  -- --------------------------

  v_user uuid;
  v_company uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception 'No account with the address %. Create it under Authentication > Users first.', v_email;
  end if;

  select company_id into v_company from public.members where user_id = v_user;
  if v_company is not null then
    raise notice 'That account is already in a company. Nothing to do.';
    return;
  end if;

  insert into public.companies (name) values (v_company_name) returning id into v_company;

  insert into public.members (user_id, company_id, role, name)
  values (v_user, v_company, 'owner', split_part(v_email, '@', 1));

  raise notice 'Company % created, and % is its owner.', v_company_name, v_email;
end $$;

-- What it made
select c.name as company, m.role, u.email
from public.members m
join public.companies c on c.id = m.company_id
join auth.users u on u.id = m.user_id
where m.role = 'owner';
