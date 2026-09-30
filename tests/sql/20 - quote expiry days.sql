-- 20 - quote expiry days
--
-- Each quote can now say how many days the customer has to answer (set on the
-- website's Quote form, 1 to 365; 30 when not set). The website saves it with
-- the quote's answer code; the quote-response function reads it, so an answer
-- after that many days is refused as expired. Quotes sent before this have no
-- number here and keep the 30 days.
--
-- Needs 17 first. Safe to run more than once. Adds one column to an existing
-- table: its grants already cover it.

alter table public.quote_responses
  add column if not exists expires_days integer check (expires_days between 1 and 365);
