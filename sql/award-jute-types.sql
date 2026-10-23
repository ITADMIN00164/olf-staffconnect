-- ======================================================================
-- Award Management: jute bags as stock
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx. Safe to
-- run twice. It adds two rows to award_types and changes nothing else.
--
-- Jute bags are asked for on a requisition, dispatched by Head Office and
-- counted on a sheet of their own - requisition, delivery, utilisation,
-- balance - by size, Small and Big. That sheet is the stock sheet, so a jute
-- bag is a type like the four awards, one for each size. The awards' own
-- sheet never counts them: the page keeps the two apart.
-- ======================================================================

insert into public.award_types (id, code, name, sort_order)
overriding system value
select v.id, v.code, v.name, v.sort_order
from (values
  (5, 'JUTE_SMALL', 'Jute Bag (Small)', 5),
  (6, 'JUTE_BIG',   'Jute Bag (Big)',   6)
) as v(id, code, name, sort_order)
where not exists (
  select 1 from public.award_types t where t.code = v.code or t.id = v.id
);

-- Check: six types, the last two being the jute bags.
select id, code, name, sort_order from public.award_types order by sort_order, id;
