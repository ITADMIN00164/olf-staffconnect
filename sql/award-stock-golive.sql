-- ======================================================================
-- Award Management: stock goes live
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx. Safe to
-- run twice. It adds a settings table, a "verified at" time on the award
-- records and a view of what has been verified. It changes no figure.
--
-- The idea
--   Until the go-live date stock was kept in Excel. The stock held on that
--   date is typed in once, as the opening balance. After it:
--
--     balance = opening + delivered - utilised
--
--   Utilised is every award VERIFIED on or after the go-live date, taken
--   off the column its Award Category belongs to. It moves on the day it is
--   verified, not in the month the award was for: an April award verified
--   in November comes off November's stock. Anything verified before the
--   go-live date is already inside the opening balance and is not counted.
-- ======================================================================

begin;

-- ---- settings: the go-live date lives here ---------------------------
create table if not exists public.award_settings (
  key         text primary key,
  value       text,
  updated_by  text,
  updated_at  timestamptz not null default now()
);

alter table public.award_settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='award_settings'
                   and policyname='award settings are readable') then
    create policy "award settings are readable"
      on public.award_settings for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='award_settings'
                   and policyname='award settings can be written') then
    create policy "award settings can be written"
      on public.award_settings for all to anon, authenticated
      using (true) with check (true);
  end if;
end $$;

grant select, insert, update, delete on public.award_settings to anon, authenticated;

-- ---- when a record was verified --------------------------------------
-- Stamped by the database, so it does not depend on the page that did it.
-- Un-verifying (or saving the record again, which clears the decision)
-- empties it; verifying again stamps the new time.
alter table public.award_records add column if not exists verified_at timestamptz;

create or replace function public.award_records_stamp_verified()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.verified and new.verified_at is null then new.verified_at := now(); end if;
    if not new.verified then new.verified_at := null; end if;
    return new;
  end if;

  if new.verified and not coalesce(old.verified, false) then
    new.verified_at := now();
  elsif not new.verified then
    new.verified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists award_records_stamp_verified_trg on public.award_records;
create trigger award_records_stamp_verified_trg
  before insert or update of verified on public.award_records
  for each row execute function public.award_records_stamp_verified();

-- Records verified before this existed: the time of their last "verified"
-- entry in the history, or failing that when they were last touched.
update public.award_records r
   set verified_at = coalesce(
         (select max(e.created_at) from public.award_record_events e
           where e.record_id = r.id and e.action = 'verified'),
         r.updated_at)
 where r.verified and r.verified_at is null;

-- ---- what has been verified, by day ----------------------------------
-- One row per district, award category and day (India time). The stock
-- sheet reads this and keeps what falls on or after the go-live date.
create or replace view public.award_verified_use as
select district_name,
       award_category,
       (verified_at at time zone 'Asia/Kolkata')::date as verified_on,
       count(*)::int                                   as n
from public.award_records
where verified and verified_at is not null
group by district_name, award_category, (verified_at at time zone 'Asia/Kolkata')::date;

grant select on public.award_verified_use to anon, authenticated;

commit;

-- Check: records with a verified time, and the go-live date (empty until set).
select (select count(*) from public.award_records where verified)          as verified_records,
       (select count(*) from public.award_records where verified_at is not null) as with_verified_time,
       (select value from public.award_settings where key = 'stock_go_live') as go_live;
