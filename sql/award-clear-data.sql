-- ======================================================================
-- Award Management: clear the test data
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx.
--
-- What this removes
--   Every requisition, and every stock movement - the opening figures and
--   the utilisations both. After this the Requisition tab, the Delivery tab
--   and the whole stock sheet are empty, and the feature is as it will be on
--   the day it starts being used for real.
--
-- What this keeps
--   The award types, and the Head Office list in Settings. Those are set-up,
--   not test data, and deleting them means adding them back by hand before
--   anything can be tested at all.
--
-- This cannot be undone. It is meant to be run once, deliberately, before a
-- fresh run through the flow.
-- ======================================================================

begin;

-- What is about to go.
select 'requisitions'            as what, count(*) as rows from public.requisitions
union all
select 'stock movements',        count(*) from public.award_stock_movements;

delete from public.award_stock_movements;
delete from public.requisitions;

commit;

-- And what is left: both should be nothing, and the two kept tables should
-- still hold what they held.
select 'requisitions'            as what, count(*) as rows from public.requisitions
union all
select 'stock movements',        count(*) from public.award_stock_movements
union all
select 'award types (kept)',     count(*) from public.award_types
union all
select 'head office (kept)',     count(*) from public.award_admins;
