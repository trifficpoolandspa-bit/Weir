select 'members has username, technician_id, is_admin' as check_name,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='members'
     and column_name in ('username','technician_id','is_admin')) = 3 as ok
union all select 'usernames are unique within each company',
  exists (select 1 from pg_indexes where schemaname='public' and indexname='members_username_active')
  and not exists (select 1 from pg_indexes where schemaname='public' and indexname='members_username_unique')
union all select 'every company has a code',
  not exists (select 1 from public.companies where code is null)
union all select 'customers have exactly one rule, for reading',
  (select count(*) from pg_policies where schemaname='public' and tablename='customers') = 1
  and exists (select 1 from pg_policies where schemaname='public' and tablename='customers' and cmd='SELECT')
union all select 'members and companies each have one rule, for reading',
  (select count(*) from pg_policies where schemaname='public' and tablename='members') = 1
  and (select count(*) from pg_policies where schemaname='public' and tablename='companies') = 1
union all select 'removal is a 7-day upload-only grace period',
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='removed_at')
  and to_regprocedure('public.my_upload_grace_company()') is not null
union all select 'nobody can write customers except through push_customer_fields',
  not has_table_privilege('authenticated','public.customers','update')
  and not has_table_privilege('authenticated','public.customers','insert')
  and not has_table_privilege('authenticated','public.customers','delete')
union all select 'push_customer_fields checks technician rules',
  coalesce(pg_get_functiondef(to_regprocedure('public.push_customer_fields(text,jsonb,timestamptz)')) like '%check_customer_write%', false)
union all select 'password hashing is available',
  to_regprocedure('extensions.crypt(text,text)') is not null
union all select 'the sign-in screen can look up a username',
  coalesce(has_function_privilege('anon', to_regprocedure('public.sign_in_address(uuid,text)'), 'execute'), false)
union all select 'but cannot create accounts',
  coalesce(not has_function_privilege('anon', to_regprocedure('public.attach_technician(uuid,text,text,text,boolean)'), 'execute'), false)
union all select 'a code finds its company from the sign-in screen',
  coalesce(has_function_privilege('anon', to_regprocedure('public.company_for_code(text)'), 'execute'), false)
union all select 'your own account is still an owner with full access',
  exists (select 1 from public.members where role = 'owner');

-- Your company code, to give to technicians (you can change it on the website later)
-- select name, code from public.companies;
