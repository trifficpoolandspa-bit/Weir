select 'visits table exists with row-level security on' as check_name,
  coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.visits')), false) as ok
union all select 'visits have one rule, for reading',
  (select count(*) from pg_policies where schemaname='public' and tablename='visits') = 1
union all select 'nobody writes visits except through push_visit and amend_visit',
  not has_table_privilege('authenticated','public.visits','insert')
  and not has_table_privilege('authenticated','public.visits','update')
  and not has_table_privilege('authenticated','public.visits','delete')
union all select 'signed-in users can add a visit',
  coalesce(has_function_privilege('authenticated', to_regprocedure('public.push_visit(text,text,text,text,jsonb,timestamptz,date)'), 'execute'), false)
union all select 'anonymous callers cannot',
  coalesce(not has_function_privilege('anon', to_regprocedure('public.push_visit(text,text,text,text,jsonb,timestamptz,date)'), 'execute'), false)
union all select 'correcting a visit is available to the office',
  to_regprocedure('public.amend_visit(text,text,text,text,jsonb,boolean)') is not null;
