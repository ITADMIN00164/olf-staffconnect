-- ======================================================================
-- Award Management: "Other" as a gift
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx. Safe to
-- run twice. It adds one row to award_types and changes nothing else.
--
-- "Other" is a gift like Block, District, NS and SU: it is asked for on a
-- requisition (with a few words saying what it is), and it has a column of
-- its own in the Stock Management sheet - Block, District, NS, SU, Other,
-- Total. The words are kept on the requisition line; the stock counts it as
-- one type.
-- ======================================================================

insert into public.award_types (id, code, name, sort_order)
overriding system value
select 7, 'OTHER', 'Other', 7
where not exists (
  select 1 from public.award_types t where t.code = 'OTHER' or t.id = 7
);

-- Keep the identity counter ahead of the id used above.
select setval(
  pg_get_serial_sequence('public.award_types', 'id'),
  greatest((select max(id) from public.award_types), 7)
);

-- Check: seven types, the last being Other.
select id, code, name, sort_order from public.award_types order by sort_order, id;
