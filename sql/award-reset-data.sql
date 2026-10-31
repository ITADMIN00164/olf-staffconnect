-- ======================================================================
-- Award Management: reset the data from the app
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx, after
-- sql/award-stock-golive.sql. Safe to run twice (it replaces the first
-- version of the reset function, which reset every requisition at once).
--
-- What it gives
--   A "Reset data" button in Stock Management (Staff Connect admins only).
--   The Stock tab resets the award side, the Jute Bags tab the jute side:
--
--     Stock tab       award requisitions, award stock figures
--                     (and the go-live date, which belongs to them)
--     Jute Bags tab   jute bag requisitions, jute bag stock figures
--
--   A requisition can ask for both awards and jute bags. Resetting one
--   side takes only that side's lines out of it and leaves the other side;
--   a requisition left with no lines at all is deleted.
--
--   Nothing else is touched: the award types, Head Office list, award
--   records and dropdown lists stay.
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

-- The first version reset every requisition together; it must not stay
-- callable beside the new one.
drop function if exists public.award_reset_data(boolean, boolean, boolean, boolean);

-- Is one line of a requisition's items a jute bag?
create or replace function public.award_line_is_jute(line jsonb, jute_ids int[])
returns boolean
language sql
immutable
as $$
  select coalesce(line->>'code', '') ilike 'JUTE%'
      or coalesce(line->>'name', '') ilike '%jute%'
      or coalesce((line->>'award_type_id')::int = any (jute_ids), false);
$$;

-- Takes the jute lines (or the award lines) out of every requisition.
-- Returns how many requisitions were deleted or trimmed.
create or replace function public.award_strip_requisitions(p_jute boolean)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r        record;
  jute_ids int[];
  kept     jsonb;
  kept_d   jsonb;
  n        int := 0;
begin
  select coalesce(array_agg(id), '{}') into jute_ids
    from public.award_types where code like 'JUTE\_%';

  for r in select id, items, dispatched_items, award_type_id from public.requisitions loop
    if r.items is not null and jsonb_array_length(r.items) > 0 then
      -- keep the lines that are NOT the side being reset
      select coalesce(jsonb_agg(e), '[]'::jsonb) into kept
        from jsonb_array_elements(r.items) e
       where public.award_line_is_jute(e, jute_ids) <> p_jute;

      if jsonb_array_length(kept) = 0 then
        delete from public.requisitions where id = r.id;
        n := n + 1;
      elsif jsonb_array_length(kept) < jsonb_array_length(r.items) then
        if r.dispatched_items is null then
          kept_d := null;
        else
          select coalesce(jsonb_agg(e), '[]'::jsonb) into kept_d
            from jsonb_array_elements(r.dispatched_items) e
           where public.award_line_is_jute(e, jute_ids) <> p_jute;
        end if;
        update public.requisitions
           set items = kept,
               dispatched_items = kept_d,
               quantity = (select coalesce(sum((e->>'quantity')::int), 0)
                             from jsonb_array_elements(kept) e)
         where id = r.id;
        n := n + 1;
      end if;
    else
      -- filed before requisitions carried a list: one award, by its type
      if (coalesce(r.award_type_id = any (jute_ids), false)) = p_jute then
        delete from public.requisitions where id = r.id;
        n := n + 1;
      end if;
    end if;
  end loop;

  return n;
end;
$$;

create or replace function public.award_reset_data(
  p_award_req    boolean,
  p_jute_req     boolean,
  p_award_stock  boolean,
  p_jute_stock   boolean,
  p_go_live      boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_areq  int := 0;
  n_jreq  int := 0;
  n_award int := 0;
  n_jute  int := 0;
begin
  if coalesce((select value from public.award_settings where key = 'allow_reset'), 'no') <> 'yes' then
    raise exception 'Reset is switched off';
  end if;

  if p_award_req then n_areq := public.award_strip_requisitions(false); end if;
  if p_jute_req  then n_jreq := public.award_strip_requisitions(true);  end if;

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

  return jsonb_build_object('award_req', n_areq, 'jute_req', n_jreq,
                            'award_stock', n_award, 'jute_stock', n_jute);
end;
$$;

-- Only the reset function is callable from the app; the helpers are not.
revoke all on function public.award_strip_requisitions(boolean) from public, anon, authenticated;
grant execute on function public.award_reset_data(boolean, boolean, boolean, boolean, boolean)
  to anon, authenticated;

-- Check: the switch is on.
select key, value from public.award_settings where key = 'allow_reset';
