select 'no sign-in addresses are left on the old domain' as check_name,
  not exists (select 1 from auth.users where email like '%@accounts.poollog.invalid') as ok
union all select 'the technician sign-ins are on the Weir domain',
  exists (select 1 from auth.users where email like 'tech-%@accounts.weir.invalid')
  or not exists (select 1 from public.members where technician_id is not null)
union all select 'new sign-ins are still set up by the owner only',
  coalesce(pg_get_functiondef(to_regprocedure('public.attach_technician(uuid,text,text,text,boolean)'))
    like '%Only an owner can create technician accounts%', false)
union all select 'and still refuse an ordinary email address',
  coalesce(pg_get_functiondef(to_regprocedure('public.attach_technician(uuid,text,text,text,boolean)'))
    like '%accounts.weir.invalid%', false);
