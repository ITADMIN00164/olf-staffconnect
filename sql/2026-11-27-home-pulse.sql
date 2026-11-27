-- =====================================================================
-- Home "Review Pulse" — shared snapshot  (27-Nov-2026)
-- Run ONCE in the Supabase SQL editor of the "Field Team Review System"
-- project (xljnhbexevetzgaaehqc). Safe to run twice. Adds only.
--
-- Why: the Review Pulse card on Home counts this month's HO tasks / reviews
-- and Field weekly / monthly reviews. Working that out reads a few thousand
-- review rows. Instead of every person doing that on every Home visit, the
-- first visitor after 30 minutes works it out and saves the result here;
-- everyone else reads this one small row.
--
--   period       'YYYYMM' (e.g. '202611')
--   data         { ym, field: {...}, ho: {...} }  — counts only, no names
--   computed_at  when it was worked out
--
-- Without this table Home still works: each visitor works the numbers out
-- themselves (cached in the page for 10 minutes).
--
-- Note: Staff Connect talks to Supabase with the anon key (login is Firebase),
-- same as the other Field Review tables.
-- =====================================================================

begin;

create table if not exists public.home_pulse (
  period       text primary key,
  data         jsonb not null,
  computed_at  timestamptz not null default now()
);

alter table public.home_pulse enable row level security;

drop policy if exists "home_pulse read"   on public.home_pulse;
drop policy if exists "home_pulse insert" on public.home_pulse;
drop policy if exists "home_pulse update" on public.home_pulse;

create policy "home_pulse read"   on public.home_pulse for select to anon, authenticated using (true);
create policy "home_pulse insert" on public.home_pulse for insert to anon, authenticated with check (true);
create policy "home_pulse update" on public.home_pulse for update to anon, authenticated using (true) with check (true);

grant select, insert, update on public.home_pulse to anon, authenticated;

commit;

-- Check:
-- select period, computed_at, data from public.home_pulse order by period desc;
