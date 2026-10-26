-- ======================================================================
-- Field Review System: week dates
--
-- Run in the Supabase SQL editor for project xljnhbexevetzgaaehqc
-- ("Field Team Review System"). Safe to run twice.
--
-- What it stores
--   One row per year / month / week (Week 1-5) with the From and To date
--   itadmin sets on the week card. Everyone else only sees them:
--   "Week 1 · 01/10/2026 – 03/10/2026" on the card and the Week 1 column.
--   No row = no dates shown (the review works exactly as before).
--
-- Note: Staff Connect talks to Supabase with the anon key (login is
-- Firebase), so "itadmin only" is enforced in the page, same as the other
-- Admin features. The policies below just let the page read and write.
-- ======================================================================

begin;

create table if not exists public.week_dates (
  year        int  not null,
  month       int  not null check (month between 1 and 12),
  week        int  not null check (week between 1 and 5),
  from_date   date not null,
  to_date     date not null,
  updated_by  text,
  updated_at  timestamptz not null default now(),
  primary key (year, month, week),
  constraint week_dates_order check (from_date <= to_date)
);

alter table public.week_dates enable row level security;

drop policy if exists "week_dates read"   on public.week_dates;
drop policy if exists "week_dates insert" on public.week_dates;
drop policy if exists "week_dates update" on public.week_dates;
drop policy if exists "week_dates delete" on public.week_dates;

create policy "week_dates read"   on public.week_dates for select to anon, authenticated using (true);
create policy "week_dates insert" on public.week_dates for insert to anon, authenticated with check (true);
create policy "week_dates update" on public.week_dates for update to anon, authenticated using (true) with check (true);
create policy "week_dates delete" on public.week_dates for delete to anon, authenticated using (true);

grant select, insert, update, delete on public.week_dates to anon, authenticated;

commit;

-- Check
select * from public.week_dates order by year, month, week;
