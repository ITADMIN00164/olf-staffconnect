-- ======================================================================
-- Award Management: reset the data from the app
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx, after
-- sql/award-stock-golive.sql. Safe to run twice.
--
-- What it gives
--   A "Reset data" button in Stock Management (Staff Connect admins
--   only) that deletes, as ticked: every requisition (awards and jute bags),
--   the award stock figures, the jute bag stock figures, and the go-live
--   date. Nothing else is touched: the award types, Head Office list,
--   award records and dropdown lists stay.
--
-- The safety switch
--   The function does nothing unless award_settings has allow_reset = 'yes'.
--   It is switched ON here, for the testing period. The day the tab goes
--   live for real, switch it off and the button can never delete anything:
--
--       update public.award_settings set value = 'no' where key = 'allow_reset';
--
--   The page's own admin check is only in the page, so this switch is what
--   protects the real data.
-- ======================================================================

insert into public.award_settings (key, value, updated_by)
values ('allow_reset', 'yes', 'sql: award-reset-data.sql')
on conflict (key) do nothing;

create or replace function public.award_reset_data(
  p_requisitions boolean,
  p_award_stock  boolean,
  p_jute_stock   boolean,
  p_go_live      boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_req   int := 0;
  n_award int := 0;
  n_jute  int := 0;
begin
  if coalesce((select value from public.award_settings where key = 'allow_reset'), 'no') <> 'yes' then
    raise exception 'Reset is switched off';
  end if;

  if p_requisitions then
    delete from public.requisitions where true;
    get diagnostics n_req = row_count;
  end if;

  if p_award_stock then
    delete from public.award_stock_movements
     where award_type_id in (select id from public.award_types where code not like 'JUTE\_%');
    get diagnostics n_award = row_count;
  end if;

  if p_jute_stock then
    delete from public.award_stock_movements
     where award_type_id in (select id from public.award_types where code like 'JUTE\_%');
    get diagnostics n_jute = row_count;
  end if;

  if p_go_live then
    delete from public.award_settings where key = 'stock_go_live';
  end if;

  return jsonb_build_object('requisitions', n_req, 'award_stock', n_award, 'jute_stock', n_jute);
end;
$$;

grant execute on function public.award_reset_data(boolean, boolean, boolean, boolean)
  to anon, authenticated;

-- Check: the switch is on.
select key, value from public.award_settings where key = 'allow_reset';
