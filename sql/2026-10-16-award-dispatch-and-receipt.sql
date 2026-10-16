-- Award database: dispatch and receipt are two different events
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx.
-- Safe to run twice.
--
-- What was wrong
--   Head Office marked a requisition "delivered". They cannot know that.
--   What they know is that they sent it; whether it arrived is something
--   only the person who asked for it can say. One step was standing in for
--   two events, at two places, known by two different people - and the one
--   recording it was the one who could not see it.
--
-- The flow now
--   raised ─> approved ─> acknowledged ─> dispatched ─> received
--      │          │             │
--      │          └── rejected ─┘
--      └── declined
--
--   HO acknowledges and dispatches. The requester confirms receipt - nobody
--   else can, because nobody else is there. Rejecting stops being possible
--   once it has been sent, because at that point there is nothing to
--   withhold.
--
--   delivered_by / delivered_at are renamed rather than replaced: they
--   recorded the dispatch all along, under a name that claimed more.

begin;

-- the column kept the right fact under the wrong name
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
alter table public.requisitions add column if not exists received_by   text;
alter table public.requisitions add column if not exists received_at   timestamptz;
alter table public.requisitions add column if not exists receipt_note  text;

-- anything already marked delivered was a dispatch, by the people who sent it
update public.requisitions set status = 'dispatched' where status = 'delivered';

-- Every check on status is dropped, not one named in advance - that is what
-- let an older inline constraint refuse the stages last time.
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
                    'acknowledged', 'dispatched', 'received', 'rejected'));

commit;

-- Check: one constraint, naming all seven, and no row left saying delivered.
select (select count(*) from public.requisitions where status = 'delivered') as still_delivered,
       (select string_agg(conname, ', ') from pg_constraint
         where conrelid = 'public.requisitions'::regclass and contype = 'c'
           and pg_get_constraintdef(oid) ilike '%status%')                   as status_checks;
