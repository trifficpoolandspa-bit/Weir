select 'push_customer_fields merges list items' as check_name,
  coalesce(pg_get_functiondef(to_regprocedure('public.push_customer_fields(text,jsonb,timestamptz)')) like '%A list, item by item%', false) as ok
union all select 'customers from the first sync keep their original edit time',
  coalesce(pg_get_functiondef(to_regprocedure('public.push_customer_fields(text,jsonb,timestamptz)')) like '%__legacy%', false)
union all select 'sync_field_newest exists',
  to_regprocedure('public.sync_field_newest(jsonb,timestamptz)') is not null
union all select 'signed-in users can still push',
  coalesce(has_function_privilege('authenticated', to_regprocedure('public.push_customer_fields(text,jsonb,timestamptz)'), 'execute'), false)
union all select 'anonymous callers still cannot',
  coalesce(not has_function_privilege('anon', to_regprocedure('public.push_customer_fields(text,jsonb,timestamptz)'), 'execute'), false);
