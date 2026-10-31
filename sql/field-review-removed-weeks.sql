-- ======================================================================
-- Field Review System: removed weeks
--
-- Run in the Supabase SQL editor for project xljnhbexevetzgaaehqc
-- ("Field Team Review System"). Safe to run twice.
--
-- What it stores
--   One row per year / month / week that is NOT part of that month
--   (usually Week 5). itadmin adds it with the bin button on the Week 5
--   card and removes it with "Restore week".
--
--   A removed week is hidden for everyone (card + column) and skipped when
--   "Last week's actions" carry forward, so next month's Week 1 picks up
--   Week 4's G (Next week) actions.
--
--   Nothing in review_responses is deleted - restoring brings the week
--   back exactly as it was.
--
-- Note: Staff Connect talks to Supabase with the anon key (login is
-- Firebase), so "itadmin only" is enforced in the page, same as the other
-- Admin features. The policies below just let the page read and write.
-- ======================================================================

begin;

create table if not exists public.week_removed (
  year        int  not null,
  month       int  not null check (month between 1 and 12),
  week        int  not null check (week between 1 and 5),
  removed_by  text,
  removed_at  timestamptz not null default now(),
  primary key (year, month, week)
);

alter table public.week_removed enable row level security;

drop policy if exists "week_removed read"   on public.week_removed;
drop policy if exists "week_removed insert" on public.week_removed;
drop policy if exists "week_removed update" on public.week_removed;
drop policy if exists "week_removed delete" on public.week_removed;

create policy "week_removed read"   on public.week_removed for select to anon, authenticated using (true);
create policy "week_removed insert" on public.week_removed for insert to anon, authenticated with check (true);
create policy "week_removed update" on public.week_removed for update to anon, authenticated using (true) with check (true);
create policy "week_removed delete" on public.week_removed for delete to anon, authenticated using (true);

grant select, insert, update, delete on public.week_removed to anon, authenticated;

commit;

-- Check
select * from public.week_removed order by year, month, week;
