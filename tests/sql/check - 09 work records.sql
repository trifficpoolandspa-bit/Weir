select 'work joins the company records rather than a table of its own' as check_name,
  coalesce((select pg_get_constraintdef(oid) from pg_constraint
    where conname = 'company_records_kind_check') like '%task%', false) as ok
union all select 'all four kinds of work are allowed',
  coalesce((select pg_get_constraintdef(oid) from pg_constraint
    where conname = 'company_records_kind_check') like '%filter_clean%'
  and (select pg_get_constraintdef(oid) from pg_constraint
    where conname = 'company_records_kind_check') like '%work_order%'
  and (select pg_get_constraintdef(oid) from pg_constraint
    where conname = 'company_records_kind_check') like '%reschedule%', false)
union all select 'a technician can be asked whether a record is theirs',
  to_regprocedure('public.record_is_mine(text,jsonb)') is not null
union all select 'and it answers no when they are not a technician',
  coalesce(pg_get_functiondef(to_regprocedure('public.record_is_mine(text,jsonb)'))
    like '%my_technician_id() is null then false%', false)
union all select 'row level security is still on for company records',
  coalesce((select relrowsecurity from pg_class
    where relname='company_records' and relnamespace='public'::regnamespace), false)
union all select 'the anon key cannot read them',
  not has_table_privilege('anon', 'public.company_records', 'select');
