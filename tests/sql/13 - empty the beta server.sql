-- 13 - Empty the beta server
--
-- ONLY EVER RUN THIS ON THE BETA PROJECT.
--
-- Everything a company has ever entered is removed: customers, their kept
-- versions, technicians, setup, settings, visits, readings, work and photo
-- records. Companies and the accounts that sign in are left alone, so you can
-- sign in again straight afterwards to a clean, empty company.
--
-- Run it when real data has found its way onto the beta server by mistake, or
-- to start a round of testing from nothing.
--
-- Check which project you are in before you press Run. The project name is at
-- the top of the Supabase window.

begin;

delete from public.customer_versions;
delete from public.customers;

delete from public.record_versions;
delete from public.company_records;

-- Visits and everything hanging off them
delete from public.visits;

-- Photo records. The image files in Storage are removed separately, below.
delete from public.photos;

commit;

-- What is left
select 'customers' as what, count(*) from public.customers
union all select 'company records', count(*) from public.company_records
union all select 'visits', count(*) from public.visits
union all select 'photos', count(*) from public.photos
union all select 'companies (kept)', count(*) from public.companies
union all select 'sign-ins (kept)', count(*) from public.members;
