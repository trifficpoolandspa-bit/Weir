select 'company_records exists with row-level security on' as check_name,
  coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.company_records')), false) as ok
union all select 'record_versions exists with row-level security on',
  coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.record_versions')), false)
union all select 'company_records has one rule, for reading',
  (select count(*) from pg_policies where schemaname='public' and tablename='company_records') = 1
union all select 'nobody writes records except through push_record_fields',
  not has_table_privilege('authenticated','public.company_records','insert')
  and not has_table_privilege('authenticated','public.company_records','update')
  and not has_table_privilege('authenticated','public.company_records','delete')
union all select 'signed-in users can call push_record_fields',
  coalesce(has_function_privilege('authenticated', to_regprocedure('public.push_record_fields(text,text,jsonb,timestamptz)'), 'execute'), false)
union all select 'anonymous callers cannot',
  coalesce(not has_function_privilege('anon', to_regprocedure('public.push_record_fields(text,text,jsonb,timestamptz)'), 'execute'), false)
union all select 'customers still work as before',
  to_regprocedure('public.push_customer_fields(text,jsonb,timestamptz)') is not null;
