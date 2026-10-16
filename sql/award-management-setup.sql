-- ======================================================================
-- Award Management: the whole database, in one run
--
-- Run this in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx.
--
-- It is the only file that needs running. It takes the award database from
-- wherever it is now - untouched, or part way through the migrations dated
-- 15 and 16 October - to the shape the page expects. Running it twice
-- changes nothing the second time, and running it after those earlier files
-- is harmless.
--
-- ----------------------------------------------------------------------
-- The flow it supports
--
--   submitted ─> approved ─> acknowledged ─> dispatched ─> received
--    PO/PM/DM    PM/DM/COO       HO          ↑    HO       requester
--       │            │            │          │                 │
--       │            │         on_hold ──────┘          not received
--       │            │            │   (stock arrived)    (back to HO)
--       │            └─ rejected ─┘
--       └─ declined       HO
--          approver
--
-- Who may do what is decided in the page, from the Employees directory in
-- Firestore. This database cannot see that directory - it only ever gets
-- the public key - so these columns record what was done in the app. They
-- are a log, not a security boundary. The same is true of every name here.
-- ======================================================================

begin;

-- ---------------------------------------------------------------- 1. place
-- Where a requisition is for, as names rather than ids. The districts come
-- from the staff directory, which knows places this database never did, so
-- there was nothing to point an id at.
alter table public.requisitions add column if not exists state_name    text;
alter table public.requisitions add column if not exists division_name text;
alter table public.requisitions add column if not exists district_name text;

-- Carry the older rows over from the lookup tables before they go.
do $$
begin
  if to_regclass('public.states') is not null then
    update public.requisitions r set state_name = s.name
    from public.states s where r.state_id = s.id and r.state_name is null;
  end if;
  if to_regclass('public.districts') is not null then
    update public.requisitions r set district_name = d.name
    from public.districts d where r.district_id = d.id and r.district_name is null;
  end if;
exception when undefined_column then
  null;        -- the id columns are already gone, so there is nothing to carry
end $$;

-- A trigger checked the district against the state by reading those tables.
-- A trigger function's body is only parsed when it runs, so dropping the
-- tables left it in place and every insert failed on a table that no longer
-- existed. The form checks the pairing now, against the directory.
drop trigger  if exists requisitions_district_state_trg on public.requisitions;
drop function if exists public.requisitions_check_district_state();

-- Nothing writes the ids any more.
alter table public.requisitions drop column if exists state_id;
alter table public.requisitions drop column if exists district_id;
drop table if exists public.districts;
drop table if exists public.states;

-- --------------------------------------------------------------- 2. awards
-- Several awards on one requisition, each with its own count. Kept on the
-- requisition rather than in a table of their own: they are filed together,
-- approved together, and never looked at apart from each other.
--
--   [{"award_type_id": 1, "code": "POM_BLOCK", "name": "POM Block",
--     "quantity": 100}, ...]
--
-- quantity holds the total, which is what the table foots up. award_type_id
-- is still set when exactly one award is asked for, so the older rows and
-- the join keep meaning something.
alter table public.requisitions add column if not exists items jsonb;
alter table public.requisitions alter column award_type_id drop not null;

-- ------------------------------------------------------------ 3. who, when
-- The role is recorded when the requisition is filed, not looked up later:
-- who may approve it depends on the level it was raised at, and people move
-- between roles.
alter table public.requisitions add column if not exists requester_role   text;
alter table public.requisitions add column if not exists requester_level  int;

-- Addresses beside names. A name is neither unique nor permanent, and the
-- log was relying on one alone to say who did what.
alter table public.requisitions add column if not exists requester_email  text;
alter table public.requisitions add column if not exists decided_by_email text;
alter table public.requisitions add column if not exists ho_by_email      text;

-- approval
alter table public.requisitions add column if not exists decided_by       text;
alter table public.requisitions add column if not exists decided_by_role  text;
alter table public.requisitions add column if not exists decided_at       timestamptz;
alter table public.requisitions add column if not exists decision_remark  text;

-- head office
alter table public.requisitions add column if not exists acknowledged_by  text;
alter table public.requisitions add column if not exists acknowledged_at  timestamptz;
alter table public.requisitions add column if not exists held_by          text;
alter table public.requisitions add column if not exists held_at          timestamptz;
alter table public.requisitions add column if not exists rejected_by      text;
alter table public.requisitions add column if not exists rejected_at      timestamptz;
alter table public.requisitions add column if not exists ho_remark        text;

-- Dispatch is what Head Office knows; receipt is what the requester knows.
-- delivered_* held the dispatch under a name that claimed more, so it is
-- renamed rather than replaced.
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

alter table public.requisitions add column if not exists dispatched_by text;
alter table public.requisitions add column if not exists dispatched_at timestamptz;

-- the requester's side
alter table public.requisitions add column if not exists received_by   text;
alter table public.requisitions add column if not exists received_at   timestamptz;
alter table public.requisitions add column if not exists receipt_note  text;
alter table public.requisitions add column if not exists issue_by      text;
alter table public.requisitions add column if not exists issue_at      timestamptz;
alter table public.requisitions add column if not exists issue_note    text;

-- -------------------------------------------------------------- 4. status
update public.requisitions set status = 'dispatched' where status = 'delivered';

-- Every check on status is dropped, not one named in advance. Postgres names
-- a CHECK written inline on a column <table>_<column>_check, so the original
-- table definition left one behind that knew only the first three words -
-- and naming just the constraint this project had created missed it, which
-- is why acknowledging was refused by a rule nobody had looked at.
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

-- Deciding and fulfilling write to the row, so the page has to be allowed to.
do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='requisitions'
                   and policyname='requisitions can be decided') then
    create policy "requisitions can be decided"
      on public.requisitions for update to anon, authenticated
      using (true) with check (true);
  end if;
end $$;

grant update on public.requisitions to anon, authenticated;

-- ---------------------------------------------------------- 5. head office
-- Who fulfils requisitions, managed from the Settings tab. A list of people
-- rather than requisition data, so there is nowhere sensible to put it on a
-- requisition.
--
-- Staff Connect Admins can manage this list as well as the people on it.
-- Without that, removing the last name would lock the door from the inside.
create table if not exists public.award_admins (
  id       uuid primary key default gen_random_uuid(),
  email    text not null unique,
  name     text,
  added_by text,
  added_at timestamptz not null default now()
);

create unique index if not exists award_admins_email_idx
  on public.award_admins (lower(email));

alter table public.award_admins enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='award_admins'
                   and policyname='award admins are readable') then
    create policy "award admins are readable"
      on public.award_admins for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='award_admins'
                   and policyname='award admins can be managed') then
    create policy "award admins can be managed"
      on public.award_admins for all to anon, authenticated
      using (true) with check (true);
  end if;
end $$;

grant select, insert, update, delete on public.award_admins to anon, authenticated;

commit;

-- ======================================================================
-- Check. Expect: lookup_tables_gone true, one status constraint naming all
-- eight stages, unknown_status 0, and award_admins listing whoever has been
-- added (nobody, on a first run - add them in the Settings tab, or no
-- approved requisition can be acted on).
-- ======================================================================
select
  (to_regclass('public.states') is null and
   to_regclass('public.districts') is null)                        as lookup_tables_gone,
  (select count(*) from pg_constraint
    where conrelid = 'public.requisitions'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%')              as status_constraints,
  (select count(*) from public.requisitions
    where status not in ('submitted','approved','declined','acknowledged',
                         'on_hold','dispatched','received','rejected'))
                                                                   as unknown_status,
  (select count(*) from public.requisitions)                       as requisitions,
  (select count(*) from public.award_admins)                       as award_admins;
