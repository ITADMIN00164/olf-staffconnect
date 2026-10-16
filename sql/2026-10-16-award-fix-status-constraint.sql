-- Award database: let status hold the stages after approval
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx.
-- Safe to run twice.
--
-- The fault
--   Acknowledging failed with:
--     new row violates check constraint "requisitions_status_check"
--
--   There were two checks on status, not one. The fulfilment migration
--   replaced the one it had created itself - requisitions_status_known - but
--   requisitions_status_check was older: Postgres names a CHECK written
--   inline on a column <table>_<column>_check, so it came from the original
--   table definition and knew only submitted, approved and declined. Both
--   have to pass, so acknowledged was refused by the one nobody had looked
--   at.
--
-- The fix
--   Rather than name the constraint to drop and risk missing a third, this
--   finds every check on the table that mentions status, drops them all, and
--   puts back the single one that knows all six stages.

begin;

do $$
declare
  c record;
begin
  for c in
    select conname
    from   pg_constraint
    where  conrelid = 'public.requisitions'::regclass
      and  contype  = 'c'
      and  pg_get_constraintdef(oid) ilike '%status%'
  loop
    raise notice 'dropping check constraint %', c.conname;
    execute format('alter table public.requisitions drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.requisitions
  add constraint requisitions_status_known
  check (status in ('submitted', 'approved', 'declined',
                    'acknowledged', 'delivered', 'rejected'));

commit;

-- Check: exactly one check constraint on status now, and it names all six.
select conname, pg_get_constraintdef(oid) as definition
from   pg_constraint
where  conrelid = 'public.requisitions'::regclass
  and  contype  = 'c'
  and  pg_get_constraintdef(oid) ilike '%status%';
