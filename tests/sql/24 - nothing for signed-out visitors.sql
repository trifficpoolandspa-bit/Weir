-- 24 - nothing for signed-out visitors
--
-- Weir's rule is that a signed-out visitor (Supabase's "anon" role) is granted
-- nothing on any table. Supabase's default permissions had still given anon
-- table rights on photos, visits and quote_responses. Row-level security
-- already stopped anon from reading or changing a single row, so nothing was
-- exposed; this removes the rights themselves, and stops new tables getting
-- them by default.
--
-- The customer's quote page is unaffected: it goes through the quote-response
-- function, which uses its own key. Sign-in helpers stay callable by anon
-- (company_for_code, sign_in_address, valid_username): those are functions,
-- not tables, and are untouched here.
--
-- Safe to run more than once.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
