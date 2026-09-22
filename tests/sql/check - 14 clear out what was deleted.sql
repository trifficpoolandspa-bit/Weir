select 'the clean-up is there' as check_name,
  to_regprocedure('public.clear_out_deleted(integer)') is not null as ok
union all select 'it never clears anything newer than 30 days, whatever it is asked',
  coalesce(pg_get_functiondef(to_regprocedure('public.clear_out_deleted(integer)'))
    like '%greatest(coalesce(p_days, 90), 30)%', false)
union all select 'it only touches rows already marked deleted',
  coalesce((length(pg_get_functiondef(to_regprocedure('public.clear_out_deleted(integer)')))
    - length(replace(pg_get_functiondef(to_regprocedure('public.clear_out_deleted(integer)')), 'where deleted', '')))
    / length('where deleted') >= 2, false)
union all select 'no app or key can run it, only the project owner',
  not has_function_privilege('authenticated', to_regprocedure('public.clear_out_deleted(integer)'), 'execute')
  and not has_function_privilege('anon', to_regprocedure('public.clear_out_deleted(integer)'), 'execute')
union all select 'and it is not running on its own until somebody schedules it',
  to_regclass('cron.job') is null
   or not exists (select 1 from pg_class c where c.oid = to_regclass('cron.job'));
