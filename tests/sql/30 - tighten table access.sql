-- 30 - tighten table access
--
-- A check on Oct 8 found three gaps. All of it is about what a signed-in
-- person could reach by calling the server directly, not what the apps do.
--
-- 1. Supabase gives signed-in users TRUNCATE (empty a whole table at once,
--    which the row rules don't stop), TRIGGER and REFERENCES on every table it
--    makes. Weir never uses them: taken back on every table, and new tables
--    won't get them.
-- 2. On the live server, three early rules from snippet 02 were still in place
--    on customers (customers_read, customers_write, customers_change). They let
--    any technician read every customer in the company, and add or change
--    customers directly, getting round the "only your own customers" rule and
--    push_customer_fields' checks. Snippet 06 meant to remove them; something
--    run later brought them back. Removed again, with the write rights.
-- 3. "versions readable by own company" on customer_versions let a technician
--    read old copies of every customer. Only full access may (as 06 intended).
--
-- What the apps use is untouched: reading what each person may see, and
-- writing through the server's functions. Safe to run more than once.
-- Don't run 02 or 03 again after this: they would bring the old rules back.

-- 1. No emptying tables
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
alter default privileges in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;

-- 2. Customers: reading only, by who may see them; writing only via push_customer_fields
drop policy if exists customers_read on public.customers;
drop policy if exists customers_write on public.customers;
drop policy if exists customers_change on public.customers;
revoke insert, update, delete on public.customers from anon, authenticated;

-- 3. Old customer copies: full access only
drop policy if exists "versions readable by own company" on public.customer_versions;
revoke insert, update, delete on public.customer_versions from anon, authenticated;

-- Tidy: rules that repeat another rule word for word, and a delete right no
-- rule allows anyway
drop policy if exists companies_own on public.companies;
drop policy if exists members_own_company on public.members;
revoke delete on public.quote_responses from anon, authenticated;
