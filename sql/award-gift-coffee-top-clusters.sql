-- ======================================================================
-- Award Management: Coffee With CEO and Top Clusters as gifts
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx. Safe to
-- run twice. It adds two rows to award_types and replaces one view; it
-- changes no record and no figure.
--
-- Two new gifts, each a type like Block, District, NS, SU and Other:
--   - asked for on a requisition ("Select gift"),
--   - a column of its own in Gift Inventory: Requisition, Delivery,
--     Utilisation, Balance,
--   - used up by VERIFIED awards in the award's own month, from the
--     Awards > Utilisations tab, like the others:
--         award category "Coffee With CEO"  -> Coffee With CEO
--         award category "Top Clusters"     -> Top Clusters
--
-- The Other gift is fixed here too. The category is now called "Other", and
-- "Others" is accepted as well, so an award recorded either way counts.
--
-- Run this BEFORE the new page goes live.
-- ======================================================================

insert into public.award_types (id, code, name, sort_order)
overriding system value
select v.id, v.code, v.name, v.sort_order
from (values
  (8, 'COFFEE_CEO',   'Coffee With CEO', 8),
  (9, 'TOP_CLUSTERS', 'Top Clusters',    9)
) as v(id, code, name, sort_order)
where not exists (
  select 1 from public.award_types t where t.code = v.code or t.id = v.id
);

-- Keep the identity counter ahead of the ids used above.
select setval(
  pg_get_serial_sequence('public.award_types', 'id'),
  greatest((select max(id) from public.award_types), 9)
);

-- What each verified award uses up, in the month it belongs to.
--     Block Level ...                     -> Block
--     District Level ... Spelling Bee     -> NS
--     District Level ... (anything else)  -> District
--     a category that names Nanhe Sitare  -> NS
--     a category that names Shikshan Utsav-> SU
--     Coffee With CEO                     -> Coffee With CEO
--     Top Clusters                        -> Top Clusters
--     Other (or Others)                   -> Other
-- Anything else moves no stock.
create or replace view public.award_use_by_month as
select district_name,
       case
         when award_category ~* '^\s*block level'                                  then 'Block'
         when award_category ~* '^\s*district level' and award_name ~* 'spelling bee' then 'NS'
         when award_category ~* '^\s*district level'                               then 'District'
         when award_category ~* 'nanhe sitare|\(ns\)'                              then 'NS'
         when award_category ~* 'shikshan utsav|\(su\)'                            then 'SU'
         when award_category ~* '^\s*coffee with ceo\s*$'                          then 'Coffee With CEO'
         when award_category ~* '^\s*top clusters\s*$'                             then 'Top Clusters'
         when award_category ~* '^\s*others?\s*$'                                  then 'Other'
       end                                  as gift,
       month_start,
       count(*)::int                        as n
from public.award_records
where verified
  and month_start is not null
  and district_name is not null
  and (award_category ~* '^\s*(block level|district level|coffee with ceo\s*$|top clusters\s*$|others?\s*$)'
       or award_category ~* 'nanhe sitare|\(ns\)|shikshan utsav|\(su\)')
group by district_name, 2, month_start;

grant select on public.award_use_by_month to anon, authenticated;

-- Check 1: nine types, the last two being the new gifts.
select id, code, name, sort_order from public.award_types order by sort_order, id;

-- Check 2: what counts, by gift and month (nothing changes).
select to_char(month_start, 'YYYY-MM') as month, gift, sum(n) as awards
from public.award_use_by_month
group by 1, 2
order by 1, 2;
