-- Merge "Bid" into "Beed"  (16-Nov-2026)
-- Run in the Supabase SQL editor (project "Award Management").
--
-- Why: the district list was seeded with the UDISE spelling "Bid" (award_lists, award_blocks,
-- and all records migrated from the old POM sheets). Later "Beed" was used too (the Nov-2026
-- upload), so the same district now shows twice in every district dropdown, and its data is
-- split: old months under "Bid", new ones under "Beed". The Utilisations dropdown is built from
-- the distinct district_name values in award_records, so any second spelling shows up there.
--
-- Same kind of problem as Thane / ThaneZP / Thane-ZP (see 2026-11-06-thane-split.sql).

-- ─────────────────────────────────────────────────────────────
-- STEP 1 — LOOK FIRST (read-only). Run this block alone and check the counts.
-- ─────────────────────────────────────────────────────────────
do $$
declare t record; n_bid bigint; n_beed bigint;
begin
  for t in
    select c.table_name, c.column_name
      from information_schema.columns c
      join information_schema.tables tb
        on tb.table_schema = c.table_schema and tb.table_name = c.table_name
     where c.table_schema = 'public' and tb.table_type = 'BASE TABLE'
       and c.column_name in ('district_name', 'district', 'value')
  loop
    execute format('select count(*) from public.%I where %I = %L', t.table_name, t.column_name, 'Bid')  into n_bid;
    execute format('select count(*) from public.%I where %I = %L', t.table_name, t.column_name, 'Beed') into n_beed;
    if n_bid + n_beed > 0 then
      raise notice '%.%  ->  Bid: %   Beed: %', t.table_name, t.column_name, n_bid, n_beed;
    end if;
  end loop;
end $$;
-- The counts appear under "Messages" in the SQL editor.

-- Records by month, to see which months sit under which spelling:
select district_name, month_label, count(*)
  from public.award_records
 where district_name in ('Bid', 'Beed')
 group by 1, 2 order by 1, 2;


-- ─────────────────────────────────────────────────────────────
-- STEP 2 — MERGE. Every "Bid" becomes "Beed" in every table that has a district column.
-- ─────────────────────────────────────────────────────────────
begin;

-- 2a. award_lists has unique (kind, value): if both exist, drop "Bid"; else rename it.
delete from public.award_lists
 where kind = 'district' and value = 'Bid'
   and exists (select 1 from public.award_lists where kind = 'district' and value = 'Beed');
update public.award_lists set value = 'Beed' where kind = 'district' and value = 'Bid';

-- 2b. Every other table with a district_name / district column.
do $$
declare t record; n bigint;
begin
  for t in
    select c.table_name, c.column_name
      from information_schema.columns c
      join information_schema.tables tb
        on tb.table_schema = c.table_schema and tb.table_name = c.table_name
     where c.table_schema = 'public' and tb.table_type = 'BASE TABLE'
       and c.column_name in ('district_name', 'district')
  loop
    execute format('update public.%I set %I = %L where %I = %L',
                   t.table_name, t.column_name, 'Beed', t.column_name, 'Bid');
    get diagnostics n = row_count;
    if n > 0 then raise notice 'updated %.%: % rows', t.table_name, t.column_name, n; end if;
  end loop;
end $$;

-- 2c. Check: only "Beed" should be left.
select district_name, count(*) from public.award_records
 where district_name in ('Bid', 'Beed') group by 1;
select district_name, count(*) from public.award_blocks
 where district_name in ('Bid', 'Beed') group by 1;
select value from public.award_lists
 where kind = 'district' and value in ('Bid', 'Beed');

commit;
-- If anything looks wrong before COMMIT, run:  rollback;
--
-- Note: award_blocks has unique (district_name, block). Its rows are all "Bid" today, so the
-- rename cannot clash. If step 2b stops on a unique error, some table already has the same row
-- under both names — run "rollback;" and tell Claude which table it named.
