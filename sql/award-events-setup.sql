-- Event Management in the Test tab: one row per month, district and block.
-- A district-level row has an empty block. Run this once in the Supabase SQL editor.
-- It also copies the 10 rows that were saved so far in the POM sheet (the times are India time).

create table if not exists public.award_events (
  id                bigint generated always as identity primary key,
  month_label       text    not null,
  district_name     text    not null,
  block             text    not null default '',
  block_events      integer check (block_events      is null or block_events      >= 0),
  district_events   integer check (district_events   is null or district_events   >= 0),
  block_teachers    integer check (block_teachers    is null or block_teachers    >= 0),
  district_teachers integer check (district_teachers is null or district_teachers >= 0),
  su_ns_events      integer check (su_ns_events      is null or su_ns_events      >= 0),
  su_ns_teachers    integer check (su_ns_teachers    is null or su_ns_teachers    >= 0),
  other_events      integer check (other_events      is null or other_events      >= 0),
  other_teachers    integer check (other_teachers    is null or other_teachers    >= 0),
  cluster_heads     integer check (cluster_heads     is null or cluster_heads     >= 0),
  updated_by        text,
  updated_at        timestamptz not null default now(),
  unique (month_label, district_name, block)
);

alter table public.award_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='award_events'
                   and policyname='award events counts are readable') then
    create policy "award events counts are readable"
      on public.award_events for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='award_events'
                   and policyname='award events counts can be written') then
    create policy "award events counts can be written"
      on public.award_events for all to anon, authenticated
      using (true) with check (true);
  end if;
end $$;

-- No delete: a count is changed, not removed.
grant select, insert, update on public.award_events to anon, authenticated;

-- The rows saved so far. Safe to run twice: a month and place already here is left as it is.
insert into public.award_events
  (month_label, district_name, block, block_events, district_events, block_teachers, district_teachers,
   su_ns_events, su_ns_teachers, other_events, other_teachers, cluster_heads, updated_by, updated_at)
values
  ('Jun-2026', 'Amravati', '', null, 1, null, 12, 1, 111, 1, 11, null, 'itadmin@openlinksfoundation.org', '2026-10-03 14:31:59+05:30'),
  ('Sep-2026', 'Janjgir - Champa', '220601-AKALTARA', 1, null, 3, null, null, null, null, null, null, 'kuldeepkumar.olf@gmail.com', '2026-09-25 12:40:38+05:30'),
  ('Sep-2026', 'Janjgir - Champa', '220602-BALODA', 1, null, 2, null, null, null, null, null, null, 'kuldeepkumar.olf@gmail.com', '2026-09-25 12:41:10+05:30'),
  ('Sep-2026', 'Janjgir - Champa', '220619-PAMGARH', 1, null, 3, null, null, null, null, null, null, 'kuldeepkumar.olf@gmail.com', '2026-09-25 12:43:15+05:30'),
  ('Jun-2026', 'Raipur', '', null, 1, null, 1, null, null, null, null, 0, 'aashish.olf@gmail.com', '2026-10-07 16:18:33+05:30'),
  ('Jul-2026', 'Raipur', '', null, 1, null, 7, 1, 100, null, null, 3, 'aashish.olf@gmail.com', '2026-10-07 16:18:33+05:30'),
  ('Aug-2026', 'Raipur', '', null, 1, null, 12, null, null, null, null, 3, 'aashish.olf@gmail.com', '2026-10-07 16:18:33+05:30'),
  ('Jun-2026', 'Raipur', '221104-DHARSHIWA', 1, null, 1, null, null, null, null, null, null, 'aashish.olf@gmail.com', '2026-10-07 16:21:23+05:30'),
  ('Jul-2026', 'Raipur', '221104-DHARSHIWA', 1, null, 0, null, null, null, null, null, null, 'aashish.olf@gmail.com', '2026-10-07 16:21:23+05:30'),
  ('Aug-2026', 'Raipur', '221104-DHARSHIWA', 1, null, 1, null, null, null, null, null, null, 'aashish.olf@gmail.com', '2026-10-07 16:21:23+05:30')
on conflict (month_label, district_name, block) do nothing;
