-- Award database: waiting on stock, and parcels that never arrive
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx.
-- Safe to run twice. Supersedes the two migrations dated today that it
-- repeats - running those first is harmless, running only this one is enough.
--
-- The whole flow
--
--   submitted ─> approved ─> acknowledged ─> dispatched ─> received
--      PO/PM/DM   PM/DM/COO      HO         ↑    HO        requester
--        │            │           │         │                  │
--        │            │        on_hold ─────┘                  │
--        │            │           │     (stock arrived)        │
--        │            │           │                            │
--        │            └── rejected ──┐                 not received
--        │                  HO       │                  (back to HO)
--        └── declined ───────────────┘
--             approver
--
-- What this adds
--   on_hold   HO is waiting on stock. Without it the only honest options
--             were dispatch or reject, so requisitions HO fully intended to
--             fulfil were being rejected - the requester told "no" when the
--             truth was "not yet".
--
--   an issue  The requester says it never arrived. Until now a dispatched
--             requisition could only be confirmed, so a lost parcel left the
--             row open for ever with nobody able to act. Reporting it puts it
--             back in HO's queue with the reason attached.
--
-- Nothing is deleted and no column is dropped.

begin;

alter table public.requisitions add column if not exists held_by    text;
alter table public.requisitions add column if not exists held_at    timestamptz;
alter table public.requisitions add column if not exists issue_by   text;
alter table public.requisitions add column if not exists issue_at   timestamptz;
alter table public.requisitions add column if not exists issue_note text;

-- the earlier two migrations, repeated so this one stands alone
alter table public.requisitions add column if not exists dispatched_by text;
alter table public.requisitions add column if not exists dispatched_at timestamptz;
alter table public.requisitions add column if not exists received_by   text;
alter table public.requisitions add column if not exists received_at   timestamptz;
alter table public.requisitions add column if not exists receipt_note  text;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='requisitions'
               and column_name='delivered_by') then
    alter table public.requisitions rename column delivered_by to dispatched_by;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='requisitions'
               and column_name='delivered_at') then
    alter table public.requisitions rename column delivered_at to dispatched_at;
  end if;
end $$;

update public.requisitions set status = 'dispatched' where status = 'delivered';

-- Every check on status is dropped rather than one named in advance. An
-- inline CHECK is named <table>_<column>_check by Postgres, and naming only
-- the constraint this project created is exactly what let an older one
-- refuse a stage nobody had thought to look for.
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
                    'acknowledged', 'on_hold', 'dispatched',
                    'received', 'rejected'));

commit;

-- Check: one constraint naming all eight, and every row on a known stage.
select (select string_agg(conname, ', ') from pg_constraint
         where conrelid = 'public.requisitions'::regclass and contype = 'c'
           and pg_get_constraintdef(oid) ilike '%status%')            as status_checks,
       (select count(*) from public.requisitions
         where status not in ('submitted','approved','declined','acknowledged',
                              'on_hold','dispatched','received','rejected'))
                                                                      as unknown_status,
       (select count(*) from public.requisitions)                     as rows;
