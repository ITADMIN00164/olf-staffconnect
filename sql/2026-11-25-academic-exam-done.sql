-- =====================================================================
-- Field Review System — G1 exams completed, shared per DISTRICT  (25-Nov-2026)
-- Run ONCE in the Supabase SQL editor of the "Field Team Review System"
-- project (xljnhbexevetzgaaehqc). Safe to run twice.
--
-- Adds one table. Nothing existing is changed.
--
--   academic_exam_done   one row per exam that has been completed in a district.
--
-- How it works
--   * The Academic Plan (academic_targets) says WHICH exams a district has and in which
--     month. Every PO of that district sees the district's exams as their G1 target;
--     PM / DM / District views count each district's exams once.
--   * When any PO of the district ticks an exam "Completed" on the Monthly review, one
--     row is written here. Every PO, PM and DM of that district then sees it as completed.
--   * exam_key = district | program | test cycle (lower-case, spaces collapsed), so it
--     does NOT point at an academic_targets row id. Re-uploading or editing the plan
--     never deletes or changes a row here.
--   * counts_in (YYYYMM) is frozen when the exam is ticked: the exam stays counted in
--     that month even if the plan later moves the exam to another month.
--   * Unticking deletes the row (any PO of the district, or itadmin — enforced in the page).
--
-- Note: Staff Connect talks to Supabase with the anon key (login is Firebase), so who may
-- tick is enforced in the page, same as the other Field Review features.
-- =====================================================================

begin;

create table if not exists public.academic_exam_done (
  exam_key        text primary key,          -- normDist(district) | program | test cycle
  district        text not null,
  program_name    text not null,
  test_cycle      text,
  counts_in       text not null check (counts_in ~ '^[0-9]{6}$'),   -- YYYYMM, frozen at tick time
  exam_date       date,                      -- the plan's Fixed Date when ticked (info only)
  marked_by_id    text,
  marked_by_name  text,
  marked_by_email text,
  marked_at       timestamptz not null default now()
);
create index if not exists academic_exam_done_month_idx on public.academic_exam_done (counts_in);

alter table public.academic_exam_done enable row level security;
drop policy if exists "academic_exam_done read"   on public.academic_exam_done;
drop policy if exists "academic_exam_done insert" on public.academic_exam_done;
drop policy if exists "academic_exam_done update" on public.academic_exam_done;
drop policy if exists "academic_exam_done delete" on public.academic_exam_done;
create policy "academic_exam_done read"   on public.academic_exam_done for select to anon, authenticated using (true);
create policy "academic_exam_done insert" on public.academic_exam_done for insert to anon, authenticated with check (true);
create policy "academic_exam_done update" on public.academic_exam_done for update to anon, authenticated using (true) with check (true);
create policy "academic_exam_done delete" on public.academic_exam_done for delete to anon, authenticated using (true);
grant select, insert, update, delete on public.academic_exam_done to anon, authenticated;

commit;

notify pgrst, 'reload schema';

-- Check (read-only):
-- select counts_in, district, count(*) from public.academic_exam_done group by 1, 2 order by 1, 2;
