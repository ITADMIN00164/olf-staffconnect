-- Award database: remove the states and districts lookup tables
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx.
--
-- Why they can go
--   The form reads State / Division / District from the Employees directory
--   in Staff Connect, and a requisition records the names it was filed under.
--   Nothing writes state_id or district_id any more.
--
-- The one thing that would go wrong
--   The requisitions filed before that change recorded their location ONLY as
--   ids pointing into these two tables. Dropping them without copying those
--   names out first destroys the only record of where those requisitions were
--   for, in a log that cannot be edited.
--
--   So this script does the copying itself, checks it worked, and only then
--   drops anything - all in one transaction. Run it on its own and nothing is
--   lost. Run it after the earlier migration and the copying simply finds
--   nothing left to do.
--
-- Safe to run twice. If anything below fails, the whole thing rolls back and
-- the database is exactly as it was.

begin;

-- 1. the columns the names live in (no-ops if the earlier migration ran)
alter table public.requisitions add column if not exists state_name    text;
alter table public.requisitions add column if not exists division_name text;
alter table public.requisitions add column if not exists district_name text;

-- 2. copy every name out of the lookup tables before they go
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

-- 3. refuse to go further if that left anything behind
do $$
declare
  stranded integer;
begin
  select count(*) into stranded
  from   public.requisitions
  where  (state_id    is not null and state_name    is null)
     or  (district_id is not null and district_name is null);

  if stranded > 0 then
    raise exception
      'Stopping: % requisition(s) still have an id but no name. Nothing was dropped.',
      stranded;
  end if;
end $$;

-- 4. the foreign keys have to go before the tables they point at
alter table public.requisitions drop column if exists state_id;
alter table public.requisitions drop column if exists district_id;

-- 5. and now the tables themselves
drop table if exists public.districts;
drop table if exists public.states;

commit;

-- Check: three rows, each with a state and district name, no division
-- (they were filed before there was one), and the id columns gone.
select requester_name, state_name, division_name, district_name
from   public.requisitions
order  by created_at desc;
