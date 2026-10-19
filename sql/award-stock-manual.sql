-- ======================================================================
-- Award Management: figures entered by hand
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx, after
-- sql/award-stock-setup.sql. Safe to run twice.
--
-- Why
--   The sheet has four groups of figures. Three of them are typed by
--   somebody, or arrive from a requisition:
--
--     Requisition   what the district asked for      reported only
--     Delivery      what arrived                     adds to the balance
--     Utilisation   what was given out               comes off the balance
--     Stock Balance carried forward                  added up, never typed
--
--   Until now only utilisation and a plain correction could be recorded
--   here, so an administrator filling in a past year by hand had no way to
--   enter what was asked for or what arrived. Two kinds are added for
--   exactly that, and both behave like the real thing they stand in for.
--
--   Every figure is still a movement, and the balance is still added up from
--   what moved. Typing a figure writes the difference between what the sheet
--   shows and what it should show, which is why a quantity may now be
--   negative for any kind: correcting 20 down to 15 is a movement of -5.
-- ======================================================================

begin;

alter table public.award_stock_movements
  drop constraint if exists award_stock_movements_kind_check;

alter table public.award_stock_movements
  add constraint award_stock_movements_kind_check
  check (kind in ('opening', 'utilised', 'adjustment', 'requisition', 'delivery'));

-- A movement of nothing is not a movement. The sign carries the direction,
-- so a correction downwards is a negative quantity of the same kind.
alter table public.award_stock_movements
  drop constraint if exists award_stock_movements_quantity_sane;

alter table public.award_stock_movements
  add constraint award_stock_movements_quantity_sane
  check (quantity <> 0);

commit;

-- Check: the kinds on offer, and what is recorded under each today.
select kind, count(*) as movements, sum(quantity) as total
from   public.award_stock_movements
group  by kind
order  by kind;
