select 'customers has field_times' as check_name,
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='customers' and column_name='field_times') as ok
union all select 'push_customer_fields exists',
  to_regprocedure('public.push_customer_fields(text,jsonb,timestamptz)') is not null
union all select 'signed-in users can call it',
  coalesce(has_function_privilege('authenticated', to_regprocedure('public.push_customer_fields(text,jsonb,timestamptz)'), 'execute'), false)
union all select 'anonymous callers cannot',
  coalesce(not has_function_privilege('anon', to_regprocedure('public.push_customer_fields(text,jsonb,timestamptz)'), 'execute'), false)
union all select 'the old whole-record push_customer is gone',
  to_regprocedure('public.push_customer(text,jsonb,boolean,timestamptz,timestamptz)') is null;
