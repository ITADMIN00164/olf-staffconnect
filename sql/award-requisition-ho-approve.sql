-- Requisitions: a Head Office "Approve" step between Acknowledged and Dispatched.
--
--   raised -> verified (DM) -> acknowledged (HO) -> approved (HO) -> dispatched -> received
--
-- The DM's step is still stored as 'approved', exactly as before, and only its
-- label changed to "Verified" - so nothing already filed has to be touched.
-- Head Office's new step is stored as 'ho_approved'.
--
-- Run this ONCE in the Supabase SQL Editor BEFORE the new page goes live.
-- Until it is run, Head Office's Approve button is refused by the database.
-- Safe to run again.

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where  conrelid = 'public.requisitions'::regclass
      and  contype  = 'c'
      and  pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.requisitions drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.requisitions
  add constraint requisitions_status_known
  check (status in ('submitted', 'approved', 'declined',
                    'acknowledged', 'ho_approved', 'on_hold', 'dispatched',
                    'received', 'rejected'));

-- Check. Expect one row: requisitions_status_known, naming 'ho_approved'.
select conname, pg_get_constraintdef(oid) as rule
from   pg_constraint
where  conrelid = 'public.requisitions'::regclass
  and  contype  = 'c'
  and  pg_get_constraintdef(oid) ilike '%status%';
