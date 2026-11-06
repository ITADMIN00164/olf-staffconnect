-- Split Thane into "Thane - KDMC" and "Thane ZP"  (6-Nov-2026)
-- Run once in the Supabase SQL editor (project "Award Management").
--
-- Why: until Oct-2026, KDMC records were under "Thane" and ZP records under "ThaneZP".
-- The dropdown only had "Thane", so the Nov-2026 POM upload put the ZP blocks under "Thane" too.
-- award_blocks also has its own spelling, "Thane-ZP".
--
-- The rule: block 272106-KALYAN DOMBIVLI-URC1 (MNC schools) is KDMC. Every other Thane block
-- (Bhiwandi, Kalyan, Murbad, Shahapur, Ambernath) is ZP.
--
-- What it changes (checked on 6-Nov-2026):
--   award_records  5 rows -> "Thane - KDMC"   (all Kalyan Dombivli URC1, Sep/Oct/Nov)
--                 14 rows -> "Thane ZP"       (7 "ThaneZP" Oct + 7 "Thane" Nov)
--   award_blocks   1 row  -> "Thane - KDMC",  5 rows "Thane-ZP" -> "Thane ZP"
--   award_lists    adds "Thane - KDMC" and "Thane ZP", removes "Thane"
-- Not changed: award_stock_movements (4 rows under "Thane", Aug-2026) - see the end of the file.
-- award_events and requisitions have no Thane rows.

begin;

-- 1. Award records
update public.award_records
   set district_name = 'Thane - KDMC', updated_at = now()
 where district_name in ('Thane', 'ThaneZP', 'Thane-ZP', 'Thane ZP')
   and block_name ilike '%KALYAN DOMBIVLI%';

update public.award_records
   set district_name = 'Thane ZP', updated_at = now()
 where district_name in ('Thane', 'ThaneZP', 'Thane-ZP')
   and block_name not ilike '%KALYAN DOMBIVLI%';

-- 2. Block list (used by Event Management)
update public.award_blocks set district_name = 'Thane - KDMC'
 where district_name = 'Thane' and block ilike '%KALYAN DOMBIVLI%';
update public.award_blocks set district_name = 'Thane ZP'
 where district_name = 'Thane-ZP';

-- 3. Dropdown list: the two new names take Thane's place
insert into public.award_lists (kind, value, sort_order)
select 'district', v, coalesce((select sort_order from public.award_lists where kind = 'district' and value = 'Thane'), 999)
  from (values ('Thane - KDMC'), ('Thane ZP')) as t(v)
on conflict (kind, value) do nothing;
delete from public.award_lists where kind = 'district' and value = 'Thane';

-- 4. Check: should show Thane - KDMC 5 and Thane ZP 14, and nothing else with "thane"
select district_name, count(*) from public.award_records
 where district_name ilike '%thane%' group by district_name order by 1;
select district_name, block from public.award_blocks
 where district_name ilike '%thane%' order by 1, 2;
select value from public.award_lists where kind = 'district' and value ilike '%thane%';

commit;

-- 5. Stock (NOT run above). award_stock_movements has 4 rows under "Thane" dated 1-Aug-2026:
--    requisition + delivery of 15 (award type 1) and 12 (award type 2). Once you know whose
--    stock that is, run ONE of these:
-- update public.award_stock_movements set district_name = 'Thane - KDMC' where district_name = 'Thane';
-- update public.award_stock_movements set district_name = 'Thane ZP'     where district_name = 'Thane';
