-- check - company separation
--
-- Read-only. Proves no company can see another company's data. Run it in the
-- SQL Editor of either server (beta: weir-beta; live: poollog). Changes nothing.
--
-- It signs in as every account on the server in turn (each owner and each
-- technician), and as that person counts every row they can read that belongs
-- to a DIFFERENT company, in every table that holds company data, plus the
-- stored photos and videos. Every number in the "seen from other companies"
-- column must be 0.
--
-- It also lists any table in public without row-level security, and anything
-- the public (signed-out) role is allowed to read. Both lists must be empty.

do $$
declare
  u record;
  t record;
  n bigint;
  report text := '';
  bad int := 0;
begin
  for u in
    select m.user_id, m.company_id, coalesce(m.name, m.username, m.role) as who, c.name as company
    from public.members m join public.companies c on c.id = m.company_id
    where m.removed_at is null
    order by c.name, m.role
  loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', u.user_id::text, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';

    -- Every table in public with a company_id column
    for t in
      select table_name from information_schema.columns
      where table_schema = 'public' and column_name = 'company_id'
      order by table_name
    loop
      execute format('select count(*) from public.%I where company_id <> %L', t.table_name, u.company_id) into n;
      if n > 0 then bad := bad + 1; end if;
      report := report || u.company || ' / ' || u.who || ' | ' || t.table_name || ' | ' || n || E'\n';
    end loop;

    -- Other companies themselves
    select count(*) into n from public.companies where id <> u.company_id;
    if n > 0 then bad := bad + 1; end if;
    report := report || u.company || ' / ' || u.who || ' | companies | ' || n || E'\n';

    -- Stored photos and videos in other companies' folders
    if to_regclass('storage.objects') is not null then
      execute format('select count(*) from storage.objects where bucket_id = ''visit-photos'' and (storage.foldername(name))[1] <> %L',
                     u.company_id::text) into n;
      if n > 0 then bad := bad + 1; end if;
      report := report || u.company || ' / ' || u.who || ' | stored photos and videos | ' || n || E'\n';
    end if;

    execute 'reset role';
  end loop;

  perform set_config('weir.separation_report', report, true);
  perform set_config('weir.separation_bad', bad::text, true);
end $$;

select
  case when current_setting('weir.separation_bad', true) = '0'
       then 'PASS: no account can see any other company''s data'
       else 'FAIL: ' || current_setting('weir.separation_bad', true) || ' place(s) leak — see the rows below' end as result,
  current_setting('weir.separation_report', true) as "who | table | rows seen from other companies",
  (select coalesce(string_agg(tablename, ', '), 'none') from pg_tables
    where schemaname = 'public' and rowsecurity = false) as "tables WITHOUT row-level security (must be none)",
  (select coalesce(string_agg(distinct table_name || ' (' || privilege_type || ')', ', '), 'none')
    from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public') as "open to signed-out visitors (must be none)";
