-- Award Management: opening stock for 2026-27
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx, after
-- sql/award-stock-setup.sql. Safe to run twice: a district that already has
-- an opening figure is left alone rather than doubled.
--
-- Where this came from
--   The 'Carry forward stock' sheet of Gift Stock compilation - 2026-27,
--   read straight out of the file. 30 districts, 3515 awards in all.
--   Districts are matched against the staff directory, because that is where
--   the page gets its own list from.
--
-- This is needed once. Every year after this one closes into the next by
-- itself - the carry forward is worked out from what actually happened.
--
-- Not written, because the directory has no such district:
--   KDMC
--   Latur
--   Palghar
--   Seoni
--   Sukma

begin;

insert into public.award_stock_movements
  (kind, state_name, division_name, district_name, award_type_id, quantity,
   occurred_on, note, recorded_by)
select 'opening', v.state, v.division, v.district, v.award_type_id, v.quantity,
       date '2026-03-01', 'Carry forward from the gift tracking workbook', 'Import'
from (values
  ('Maharashtra', 'Nashik', 'Ahilyanagar', 1, 51),
  ('Maharashtra', 'Nashik', 'Ahilyanagar', 2, 58),
  ('Maharashtra', 'Amravati', 'Buldhana', 1, 79),
  ('Maharashtra', 'Amravati', 'Buldhana', 2, 77),
  ('Maharashtra', 'Chhatrapati Sambhajinagar', 'Dharashiv', 1, 103),
  ('Maharashtra', 'Chhatrapati Sambhajinagar', 'Dharashiv', 2, 63),
  ('Maharashtra', 'Pune', 'Solapur', 1, 74),
  ('Maharashtra', 'Pune', 'Solapur', 2, 41),
  ('Maharashtra', 'Amravati', 'Washim', 1, 48),
  ('Maharashtra', 'Amravati', 'Washim', 2, 44),
  ('Maharashtra', 'Nagpur', 'Bhandara', 1, 23),
  ('Maharashtra', 'Nagpur', 'Bhandara', 2, 65),
  ('Maharashtra', 'Nagpur', 'Gadchiroli', 1, 5),
  ('Maharashtra', 'Nagpur', 'Gadchiroli', 2, 113),
  ('Maharashtra', 'Amravati', 'Amravati', 1, 10),
  ('Maharashtra', 'Amravati', 'Amravati', 2, 40),
  ('Maharashtra', 'Nashik', 'Jalgaon', 1, 65),
  ('Maharashtra', 'Nashik', 'Jalgaon', 2, 57),
  ('Maharashtra', 'Nashik', 'Nashik', 1, 53),
  ('Maharashtra', 'Nashik', 'Nashik', 2, 3),
  ('Maharashtra', 'Pune', 'Pune', 1, 77),
  ('Maharashtra', 'Pune', 'Pune', 2, 191),
  ('Maharashtra', 'Amravati', 'Amravati', 1, 134),
  ('Maharashtra', 'Amravati', 'Amravati', 2, 60),
  ('Maharashtra', 'Nagpur', 'Chandrapur', 1, 28),
  ('Maharashtra', 'Nagpur', 'Chandrapur', 2, 51),
  ('Maharashtra', 'Nagpur', 'Nagpur', 1, 21),
  ('Maharashtra', 'Nagpur', 'Nagpur', 2, 70),
  ('Chhattisgarh', 'Bilaspur', 'Raigarh', 1, 131),
  ('Chhattisgarh', 'Bilaspur', 'Raigarh', 2, 32),
  ('Bihar', 'Munger', 'Begusarai', 1, 116),
  ('Bihar', 'Munger', 'Begusarai', 2, 25),
  ('Maharashtra', 'Amravati', 'Yavatmal', 1, 64),
  ('Maharashtra', 'Amravati', 'Yavatmal', 2, 71),
  ('Maharashtra', 'Chhatrapati Sambhajinagar', 'Hingoli', 1, 48),
  ('Maharashtra', 'Chhatrapati Sambhajinagar', 'Hingoli', 2, 57),
  ('Maharashtra', 'Chhatrapati Sambhajinagar', 'Beed', 1, 57),
  ('Maharashtra', 'Chhatrapati Sambhajinagar', 'Beed', 2, 14),
  ('Maharashtra', 'Nagpur', 'Nagpur', 1, 6),
  ('Maharashtra', 'Nagpur', 'Nagpur', 2, 13),
  ('Maharashtra', 'Nagpur', 'Wardha', 1, 38),
  ('Maharashtra', 'Nagpur', 'Wardha', 2, 8),
  ('Chhattisgarh', 'Raipur', 'Dhamtari', 1, 40),
  ('Chhattisgarh', 'Raipur', 'Dhamtari', 2, 142),
  ('Chhattisgarh', 'Bastar', 'Dantewada', 1, 31),
  ('Chhattisgarh', 'Bastar', 'Dantewada', 2, 21),
  ('Chhattisgarh', 'Bastar', 'Bastar', 1, 61),
  ('Chhattisgarh', 'Bastar', 'Bastar', 2, 147),
  ('Chhattisgarh', 'Durg', 'Durg', 1, 13),
  ('Chhattisgarh', 'Durg', 'Durg', 2, 127),
  ('Chhattisgarh', 'Raipur', 'Gariaband', 1, 9),
  ('Chhattisgarh', 'Raipur', 'Gariaband', 2, 118),
  ('Chhattisgarh', 'Raipur', 'Raipur', 1, 8),
  ('Chhattisgarh', 'Raipur', 'Raipur', 2, 119),
  ('Chhattisgarh', 'Durg', 'Rajnandgaon', 2, 49),
  ('Chhattisgarh', 'Bilaspur', 'Janjgir - Champa', 1, 24),
  ('Chhattisgarh', 'Bilaspur', 'Janjgir - Champa', 2, 40),
  ('Chhattisgarh', 'Surguja', 'Jashpur', 1, 23),
  ('Chhattisgarh', 'Surguja', 'Jashpur', 2, 50),
  ('Chhattisgarh', 'Bilaspur', 'Raigarh', 1, 26),
  ('Chhattisgarh', 'Bilaspur', 'Raigarh', 2, 35),
  ('Maharashtra', 'Nashik', 'Nandurbar', 1, 12),
  ('Maharashtra', 'Nashik', 'Nandurbar', 2, 12),
  ('Maharashtra', 'Chhatrapati Sambhajinagar', 'Jalna', 1, 21),
  ('Maharashtra', 'Chhatrapati Sambhajinagar', 'Jalna', 2, 3)
) as v (state, division, district, award_type_id, quantity)
where not exists (
  select 1 from public.award_stock_movements m
  where m.kind = 'opening'
    and m.district_name = v.district
    and m.award_type_id = v.award_type_id
);

commit;

-- Check: every district with its opening figures, and what they add up to.
select district_name,
       sum(quantity) filter (where award_type_id = 1) as block,
       sum(quantity) filter (where award_type_id = 2) as district,
       sum(quantity)                                  as total
from   public.award_stock_movements
where  kind = 'opening'
group  by district_name
order  by district_name;
