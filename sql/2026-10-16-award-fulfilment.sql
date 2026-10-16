-- Award database: what happens after approval
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx.
-- Safe to run twice.
--
-- The flow
--   raised ──> approved ──> acknowledged ──> delivered
--      │           │              │
--      │           └── rejected ──┘
--      └── declined
--
--   declined is the approver turning it down; rejected is HO being unable to
--   fulfil it. Two words because they are two different events, by different
--   people, for different reasons - collapsing them would lose where a
--   requisition died.
--
--   Only an approved requisition reaches HO. Acknowledging says HO has it
--   and is preparing it; delivering closes it. Rejecting is available at
--   either point, because stock can run out after it has been acknowledged.
--
-- Who is HO
--   award_admins holds them, managed from the Settings tab. It is a list of
--   people, not requisition data, so it is its own table - there is nowhere
--   sensible to put it on a requisition.
--
--   Staff Connect Admins can manage that list as well as the people on it.
--   Without that, removing the last admin would lock the Settings tab for
--   good, with no way back in.
--
-- The same caveat as before
--   None of this is enforced in the database. The page checks who is signed
--   in, against a directory the database cannot see - it only ever gets the
--   public key. These columns record what was done in the app; they are not
--   a security boundary.

begin;

-- ---------------------------------------------------------------- the flow
alter table public.requisitions add column if not exists acknowledged_by text;
alter table public.requisitions add column if not exists acknowledged_at timestamptz;
alter table public.requisitions add column if not exists delivered_by    text;
alter table public.requisitions add column if not exists delivered_at    timestamptz;
alter table public.requisitions add column if not exists rejected_by     text;
alter table public.requisitions add column if not exists rejected_at     timestamptz;
alter table public.requisitions add column if not exists ho_remark       text;

-- status gains the three stages after approval. The old constraint only knew
-- the first three words, so it is replaced rather than added to.
alter table public.requisitions drop constraint if exists requisitions_status_known;
alter table public.requisitions
  add constraint requisitions_status_known
  check (status in ('submitted', 'approved', 'declined',
                    'acknowledged', 'delivered', 'rejected'));

-- ------------------------------------------------------------- who is HO
create table if not exists public.award_admins (
  id       uuid primary key default gen_random_uuid(),
  email    text not null unique,
  name     text,
  added_by text,
  added_at timestamptz not null default now()
);

-- Emails are matched lower-case, so they are stored that way.
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

-- Check: the columns are there, nobody is an award admin yet, and every row
-- still carries a status the page knows.
select (select count(*) from public.award_admins)                      as award_admins,
       (select count(*) from public.requisitions)                      as requisitions,
       (select count(*) from public.requisitions
         where status not in ('submitted','approved','declined',
                              'acknowledged','delivered','rejected'))  as unknown_status;
