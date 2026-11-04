-- ======================================================================
-- Award Management: utilisation in the month the award belongs to
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx, after
-- sql/award-stock-golive.sql. Safe to run twice. It only adds a view; it
-- changes no record and no figure.
--
-- What it does
--   The stock sheet's Utilisation columns now count every VERIFIED award in
--   the month the award belongs to (the month it was recorded for, as the
--   Awards > Utilisations tab shows it), not the day it was verified. That
--   is how the Excel stock sheet is worked out, and it gives the same
--   figures: for Bastar in April, 10 Block + 12 District + 3 NS = the 25
--   verified in the Utilisations tab.
--
--   Which gift an award uses up:
--     Block Level ...                     -> Block
--     District Level ... Spelling Bee     -> NS
--     District Level ... (anything else)  -> District
--     a category that names Nanhe Sitare  -> NS
--     a category that names Shikshan Utsav-> SU
--     Other                               -> Other
--   Anything else moves no stock. Records with no month (the "Pending
--   2025-26" ones) are not counted in a year's sheet.
-- ======================================================================

create or replace view public.award_use_by_month as
select district_name,
       case
         when award_category ~* '^block level'                               then 'Block'
         when award_category ~* '^district level' and award_name ~* 'spelling bee' then 'NS'
         when award_category ~* '^district level'                            then 'District'
         when award_category ~* 'nanhe sitare|\(ns\)'                        then 'NS'
         when award_category ~* 'shikshan utsav|\(su\)'                      then 'SU'
         when award_category ~* '^other$'                                    then 'Other'
       end                                  as gift,
       month_start,
       count(*)::int                        as n
from public.award_records
where verified
  and month_start is not null
  and district_name is not null
  and (award_category ~* '^(block level|district level|other$)'
       or award_category ~* 'nanhe sitare|\(ns\)|shikshan utsav|\(su\)')
group by district_name, 2, month_start;

grant select on public.award_use_by_month to anon, authenticated;

-- Check: what counts, by gift and month (nothing changes).
select to_char(month_start, 'YYYY-MM') as month, gift, sum(n) as awards
from public.award_use_by_month
group by 1, 2
order by 1, 2;
