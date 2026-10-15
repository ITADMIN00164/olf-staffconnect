-- Award database: remove the district/state check trigger
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx.
-- Safe to run twice.
--
-- Why
--   requisitions_check_district_state() confirmed that the chosen district
--   really belonged to the chosen state, by reading them back out of the
--   districts and states tables. Both tables are gone, and so are the
--   state_id and district_id columns it compared, so every insert now fails
--   with: relation "public.districts" does not exist.
--
--   A trigger function's body is stored as text and only parsed when it runs,
--   which is why dropping those tables succeeded and only writing broke. It
--   is also why this did not show up until the first requisition was filed.
--
--   There is nothing to rewrite it against: the district now comes from the
--   Employees directory in Firestore, which this database cannot see. The
--   pairing is checked in the form instead - award.js refuses a district that
--   is not listed under the chosen division - so the rule it enforced is
--   still enforced, just before the row is sent rather than after.
--
--   Dropping it cannot lose working behaviour. The function fails on every
--   insert as things stand, so whatever else it may have done is already not
--   happening.

begin;

drop trigger  if exists requisitions_district_state_trg on public.requisitions;
drop function if exists public.requisitions_check_district_state();

commit;

-- Check: no triggers left on the table.
select t.tgname as trigger_name
from   pg_trigger t
join   pg_class   c on c.oid = t.tgrelid
where  c.relname = 'requisitions'
  and  not t.tgisinternal;
