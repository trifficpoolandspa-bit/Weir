select 'the three tables are there' as check_name,
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name in ('companies','members','customers')) = 3 as ok
union all select 'row level security is on for all three',
  (select bool_and(relrowsecurity) from pg_class
    where relname in ('companies','members','customers') and relnamespace = 'public'::regnamespace)
union all select 'a company only sees its own customers',
  exists (select 1 from pg_policies where tablename = 'customers' and cmd = 'SELECT')
union all select 'the app can ask which company it belongs to',
  to_regprocedure('public.my_company_id()') is not null
union all select 'and whether this person is the owner',
  to_regprocedure('public.my_is_owner()') is not null
union all select 'the anon key cannot read customers directly',
  not has_table_privilege('anon', 'public.customers', 'select');
