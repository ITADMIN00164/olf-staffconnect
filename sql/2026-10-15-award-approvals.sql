-- Award database: approvals, on the requisitions table itself
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx.
-- Safe to run twice.
--
-- What this adds to public.requisitions
--   requester_role / requester_level   the standing it was raised at
--   decided_by / decided_by_role       who settled it
--   decided_at                         when
--   decision_remark                    why
--
--   status already exists and held 'submitted'. It now also takes 'approved'
--   and 'declined', which is what the page reads to decide what a row is.
--
-- Why the role is recorded on the row
--   Who may approve a requisition depends on the level it was raised at, and
--   people move between roles. Looking it up later would mean a requisition
--   quietly changing who can approve it when somebody is promoted.
--
-- Two things worth knowing
--   Deciding updates the requisition rather than adding to a log, so this
--   grants update on that table and only the latest decision is kept - there
--   is no history of a row being declined and then approved.
--
--   It also does not enforce who may decide what. That is checked in the
--   page, against the Employees directory, which the database cannot see -
--   it only ever gets the public key. Anyone holding that key could change a
--   row directly. The same is already true of the requester's name, which is
--   text the page supplies. These are a record of what was decided in the
--   app, not a security boundary.

begin;

alter table public.requisitions add column if not exists requester_role   text;
alter table public.requisitions add column if not exists requester_level  int;
alter table public.requisitions add column if not exists decided_by       text;
alter table public.requisitions add column if not exists decided_by_role  text;
alter table public.requisitions add column if not exists decided_at       timestamptz;
alter table public.requisitions add column if not exists decision_remark  text;

-- Keep status to the three words the page knows. Added only if it is not
-- already there, and the existing rows all say 'submitted', so it holds.
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.requisitions'::regclass
                   and conname  = 'requisitions_status_known') then
    alter table public.requisitions
      add constraint requisitions_status_known
      check (status in ('submitted', 'approved', 'declined'));
  end if;
end $$;

-- Deciding writes to the row, so the page needs to be allowed to.
do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'requisitions'
                   and policyname = 'requisitions can be decided') then
    create policy "requisitions can be decided"
      on public.requisitions for update to anon, authenticated
      using (true) with check (true);
  end if;
end $$;

grant update on public.requisitions to anon, authenticated;

commit;

-- Check: the columns are there, every row still says submitted, and nothing
-- has a decision on it yet.
select count(*)                                   as rows,
       count(*) filter (where status = 'submitted') as submitted,
       count(*) filter (where decided_by is not null) as decided,
       count(*) filter (where requester_role is null) as without_a_role
from   public.requisitions;
