select 'a customer remembers when it was edited, and by whom' as check_name,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='customers'
      and column_name in ('edited_at','edited_by')) = 2 as ok
union all select 'overwritten versions are kept rather than lost',
  to_regclass('public.customer_versions') is not null
union all select 'and they can be found again quickly',
  exists (select 1 from pg_indexes where tablename = 'customer_versions')
union all select 'a losing version records why it was kept',
  exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='customer_versions' and column_name='reason')
union all select 'row level security is on for kept versions',
  coalesce((select relrowsecurity from pg_class
    where relname='customer_versions' and relnamespace='public'::regnamespace), false)
union all select 'the anon key cannot read kept versions',
  not has_table_privilege('anon', 'public.customer_versions', 'select');
