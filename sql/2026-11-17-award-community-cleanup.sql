-- =====================================================================
-- Award Management: tidy the Community column of award_records
-- Run in the Supabase SQL editor of the "Award Management" project
-- (rpnxpkwcpsbxswnowuhx). Nothing is deleted.
--
-- What it changes
--   1. "TALASHET" (1 record: Sushma Sadanand Badekar, Tala, Raigarh - MH,
--      Oct-2026 District Level POM) -> "Maharashtra ZP".
--   2. Seoni -> "MadhyaPradesh ZP" on every Seoni record (some say
--      "Maharashtra ZP", and its 3 Top Clusters records are blank).
--   3. Top Clusters records with a blank Community -> the one community
--      the rest of that district's records use (e.g. Nagpur - ATC ->
--      "ATC Community", Pune -> "Maharashtra ZP"). A district whose other
--      records use more than one community, or none, is left blank and
--      listed by the check at the end.
--
-- Not touched: the 3 blank Gadchiroli Sep-2026 Lifeskill records (likely
-- duplicates, to be reviewed separately), and every other column.
--
-- Undo: the old value of every row changed is kept in
-- public.award_records_community_fix_20261117 (id, old_community), see the end.
-- =====================================================================

begin;

-- Keep the old values of every row this script can touch, before changing anything.
create table if not exists public.award_records_community_fix_20261117 (
  id            uuid primary key,
  old_community text,
  fixed_at      timestamptz not null default now()
);
-- Kept away from the website's API: only the SQL editor can read it.
alter table public.award_records_community_fix_20261117 enable row level security;
insert into public.award_records_community_fix_20261117 (id, old_community)
select id, community
from public.award_records
where community = 'TALASHET'
   or district_name = 'Seoni'
   or (award_category = 'Top Clusters' and coalesce(trim(community), '') = '')
on conflict (id) do nothing;

-- 1. TALASHET -> Maharashtra ZP
update public.award_records
set community = 'Maharashtra ZP'
where community = 'TALASHET';

-- 2. Seoni is in Madhya Pradesh
update public.award_records
set community = 'MadhyaPradesh ZP'
where district_name = 'Seoni'
  and community is distinct from 'MadhyaPradesh ZP';

-- 3. Blank Top Clusters records take their district's community,
--    only where that district uses exactly one.
with district_community as (
  select district_name, min(trim(community)) as community
  from public.award_records
  where coalesce(trim(community), '') <> ''
  group by district_name
  having count(distinct trim(community)) = 1
)
update public.award_records r
set community = dc.community
from district_community dc
where r.district_name = dc.district_name
  and r.award_category = 'Top Clusters'
  and coalesce(trim(r.community), '') = '';

commit;

-- ---------------------------------------------------------------------
-- Checks (read-only; run after the above)
-- ---------------------------------------------------------------------
-- a) Communities now in use (expect no TALASHET; "(blank)" should be 3 = the Gadchiroli records):
select coalesce(nullif(trim(community), ''), '(blank)') as community, count(*) as records
from public.award_records
group by 1
order by 2 desc;

-- b) Anything still blank, and why:
-- select district_name, award_category, month_label, full_name
-- from public.award_records
-- where coalesce(trim(community), '') = ''
-- order by district_name;

-- c) How many rows were changed (should be about 141 + 1 + Seoni's records):
-- select count(*) from public.award_records_community_fix_20261117;

-- ---------------------------------------------------------------------
-- Undo (only if needed): puts every changed row back as it was.
-- ---------------------------------------------------------------------
-- update public.award_records r
-- set community = f.old_community
-- from public.award_records_community_fix_20261117 f
-- where r.id = f.id;
