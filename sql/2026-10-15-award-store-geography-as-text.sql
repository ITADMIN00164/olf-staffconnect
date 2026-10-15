-- Award database: record where a requisition is for, as text
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx.
-- Safe to run twice: every statement checks before it writes.
--
-- Why
--   The State / Division / District dropdowns now come from the Employees
--   collection in Staff Connect, so the directory is the only place this is
--   maintained. That directory names districts - Bastar, Munger, Jabalpur -
--   which have no row in this database, so there is no id to point at. The
--   requisition therefore records the names it was filed under.
--
--   That is also the more honest record for a log that cannot be edited: it
--   keeps what was chosen at the time, rather than following a master row that
--   someone may rename later.
--
--   state_id and district_id are kept and left filled on the three existing
--   rows, so nothing already recorded is lost or rewritten.

begin;

alter table public.requisitions add column if not exists state_name    text;
alter table public.requisitions add column if not exists division_name text;
alter table public.requisitions add column if not exists district_name text;

-- Carry the three existing rows over from the tables they point at.
-- Division is left empty for them: it was never asked for, and inventing one
-- now would be a guess written into a log nobody can correct.
update public.requisitions r
set    state_name = s.name
from   public.states s
where  r.state_id = s.id
  and  r.state_name is null;

update public.requisitions r
set    district_name = d.name
from   public.districts d
where  r.district_id = d.id
  and  r.district_name is null;

-- New rows arrive with names and no ids, so the old columns have to be
-- allowed to sit empty. Dropping NOT NULL is a no-op where it was never set.
alter table public.requisitions alter column state_id    drop not null;
alter table public.requisitions alter column district_id drop not null;

commit;

-- Check: expect 3 rows, all three with a state and district name,
-- and division_name empty on all of them.
select id, requester_name, state_name, division_name, district_name
from   public.requisitions
order  by created_at desc;
