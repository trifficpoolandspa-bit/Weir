select 'photos table exists with row-level security on' as check_name,
  coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.photos')), false) as ok
union all select 'photos have one rule, for reading',
  (select count(*) from pg_policies where schemaname='public' and tablename='photos') = 1
union all select 'nobody writes photos except through push_photo and remove_photo',
  not has_table_privilege('authenticated','public.photos','insert')
  and not has_table_privilege('authenticated','public.photos','update')
  and not has_table_privilege('authenticated','public.photos','delete')
union all select 'the visit-photos bucket exists and is private',
  exists (select 1 from storage.buckets where id = 'visit-photos' and public = false)
union all select 'only your company can read its photo files',
  exists (select 1 from pg_policies where schemaname='storage' and tablename='objects'
            and policyname = 'photos readable within the company')
union all select 'only your company can add photo files',
  exists (select 1 from pg_policies where schemaname='storage' and tablename='objects'
            and policyname = 'photos written within the company')
union all select 'only the office can delete photo files',
  exists (select 1 from pg_policies where schemaname='storage' and tablename='objects'
            and policyname = 'photos removed by the office');
