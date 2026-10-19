-- ======================================================================
-- Award Management: stock
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx, after
-- sql/award-management-setup.sql. Safe to run twice.
--
-- What a district holds
--
--   balance = opening + delivered - utilised (+/- corrections)
--
--   carried month to month, per district, per award type. Nothing stores
--   the balance: it is added up from what happened, every time it is shown.
--   A stored balance is a second copy of the truth, and the spreadsheet this
--   replaces shows what that costs - one carry-forward row lost 62 units
--   between its delivery and its balance, and the sheet it fed is #REF!
--   throughout.
--
-- Where each part comes from
--   delivered  the requisitions that reached the district: what Head Office
--              actually dispatched, counted when the requester confirms it
--              arrived. Not when it was asked for, and not when it was sent -
--              a district holds stock when it has it.
--   utilised   rows in award_stock_movements, kind 'utilised'
--   opening    rows in award_stock_movements, kind 'opening' - last year's
--              closing figure, entered once
--   correction kind 'adjustment', which may be negative. For stock that was
--              damaged, lost, or counted wrong. Without it the only way to
--              fix a number is to invent a utilisation that never happened.
-- ======================================================================

begin;

-- What Head Office actually sent, which is not always what was asked for.
-- The spreadsheet keeps Requisition and Delivery as separate columns for
-- exactly this reason. Same shape as items:
--   [{"award_type_id": 1, "code": "POM_BLOCK", "name": "POM Block",
--     "quantity": 40}, ...]
alter table public.requisitions add column if not exists dispatched_items jsonb;

create table if not exists public.award_stock_movements (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('opening', 'utilised', 'adjustment')),

  -- Where the stock is. Names, like the requisitions, because the places
  -- come from the staff directory and this database cannot see it.
  state_name     text not null,
  division_name  text,
  district_name  text not null,

  award_type_id  int  not null references public.award_types (id),

  -- Positive for opening and utilised - the kind says which way it moves.
  -- An adjustment may be negative.
  quantity       int  not null,

  -- The month it belongs to, always the first of that month. Utilisation in
  -- March that is recorded in April belongs to March.
  occurred_on    date not null,

  note           text,
  recorded_by    text,
  recorded_email text,
  created_at     timestamptz not null default now(),

  constraint award_stock_movements_quantity_sane
    check (kind = 'adjustment' or quantity > 0)
);

create index if not exists award_stock_movements_place_idx
  on public.award_stock_movements (district_name, award_type_id, occurred_on);

-- One opening figure per district per award type. A second would silently
-- double a year's starting stock.
create unique index if not exists award_stock_movements_opening_idx
  on public.award_stock_movements (district_name, award_type_id, occurred_on)
  where kind = 'opening';

alter table public.award_stock_movements enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='award_stock_movements'
                   and policyname='stock movements are readable') then
    create policy "stock movements are readable"
      on public.award_stock_movements for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='award_stock_movements'
                   and policyname='stock movements can be recorded') then
    create policy "stock movements can be recorded"
      on public.award_stock_movements for all to anon, authenticated
      using (true) with check (true);
  end if;
end $$;

grant select, insert, update, delete
  on public.award_stock_movements to anon, authenticated;

commit;

-- Check: the table is there and empty on a first run, and requisitions can
-- carry what was dispatched.
select (select count(*) from public.award_stock_movements)                 as movements,
       (select count(*) from public.requisitions
         where dispatched_items is not null)                               as with_dispatch_detail,
       (select count(*) from public.requisitions)                          as requisitions;
