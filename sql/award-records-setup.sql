-- ======================================================================
-- Award Management: award records (the text side of the POM sheets)
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx. Safe to
-- run twice. Touches nothing that exists: it only adds new tables and a view.
--
-- What this replaces
--
--   The POM page keeps two Google Sheets behind an Apps Script web app:
--     Raw Data      every post that could win an award, one row each
--     Awarded Data  a second copy of a row once someone fills it in, with
--                   who awarded it, when, the image, and whether it is
--                   verified
--   "Pending" on screen is a Raw Data row with no Awarded Data row yet. Here
--   that is one table: a row is pending until it is awarded.
--
-- Images are not here. The Drive link stays on the row (image_url), and the
-- picture itself stays in Google Drive.
--
-- Late is not stored. It is worked out from awarded_date against the end of
-- the month the row belongs to, in the view below, so it cannot go stale.
-- ======================================================================

begin;

create table if not exists public.award_records (
  id             uuid primary key default gen_random_uuid(),

  -- The month it belongs to, as the screens write it: "Apr-2026", or a
  -- label such as "Pending 2025-26" for what was never recorded. month_start
  -- is the first of that month, and empty for the labels.
  month_label    text not null,
  month_start    date,

  -- Who and where, as they arrived in Raw Data.
  full_name      text not null,
  mobile         text,
  email          text,
  school_name    text,
  community      text,
  circle_name    text,
  block_name     text,
  district_name  text not null,
  pm_name        text,

  award_name     text,
  award_category text,
  post_url       text,
  post_score     numeric,

  -- What was entered against it.
  awarded        boolean not null default false,
  awarded_by     text,
  awarded_date   date,
  image_url      text,
  drive_file_id  text,
  uploaded_by    text,
  verified       boolean not null default false,
  verified_by    text,
  description    text,

  -- Where the row came from, so any row can be traced back to a sheet line.
  source_ref     text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists award_records_district_month_idx
  on public.award_records (district_name, month_label);
create index if not exists award_records_month_idx
  on public.award_records (month_label);

-- Who did what to a record, and when. The sheets keep only the latest
-- Verified By; this keeps every verify, reject and unlock.
create table if not exists public.award_record_events (
  id          uuid primary key default gen_random_uuid(),
  record_id   uuid not null references public.award_records (id) on delete cascade,
  action      text not null,
  by_email    text,
  by_name     text,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists award_record_events_record_idx
  on public.award_record_events (record_id, created_at);

-- The month table on the screen, worked out in one query.
create or replace view public.award_month_summary as
select
  district_name,
  month_label,
  min(month_start)                                              as month_start,
  count(*)                                                      as total,
  count(*) filter (where awarded and not is_late)               as awarded_in_time,
  count(*) filter (where awarded and is_late)                   as awarded_late,
  count(*) filter (where not awarded)                           as pending,
  count(*) filter (where awarded)                               as total_awarded,
  count(*) filter (where verified)                              as verified
from (
  select r.*,
         (r.awarded
          and r.month_start is not null
          and r.awarded_date is not null
          and r.awarded_date > (r.month_start + interval '1 month' - interval '1 day')::date
         ) as is_late
  from public.award_records r
) x
group by district_name, month_label;

alter table public.award_records       enable row level security;
alter table public.award_record_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='award_records'
                   and policyname='award records are readable') then
    create policy "award records are readable"
      on public.award_records for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='award_records'
                   and policyname='award records can be written') then
    create policy "award records can be written"
      on public.award_records for all to anon, authenticated
      using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='award_record_events'
                   and policyname='award events are readable') then
    create policy "award events are readable"
      on public.award_record_events for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='award_record_events'
                   and policyname='award events can be written') then
    create policy "award events can be written"
      on public.award_record_events for all to anon, authenticated
      using (true) with check (true);
  end if;
end $$;

-- No delete on the records themselves: taking an award back clears its
-- fields, it does not remove the row that says the post existed.
grant select, insert, update on public.award_records       to anon, authenticated;
grant select, insert, update, delete on public.award_record_events to anon, authenticated;
grant select on public.award_month_summary to anon, authenticated;

commit;

-- Check: both tables exist and are empty on a first run.
select (select count(*) from public.award_records)       as records,
       (select count(*) from public.award_record_events) as events;
