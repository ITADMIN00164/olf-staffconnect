-- =====================================================================
-- Award Management: delete 3 duplicate award records (Gadchiroli, Sep-2026,
-- District Level - LIFESKILL). Run in the SQL editor of the "Award
-- Management" project (rpnxpkwcpsbxswnowuhx).
--
-- Each one came only from the old "Awarded" sheet (rows 681-683), with no
-- award name and no community, and duplicates a complete record of the same
-- teacher, block, month and award date:
--   7666740c-...  Simpal wamanrao Mudholkar  (keeps a1c21dfc-... Morning Assembly)
--   b2a7ea71-...  Pravin Yadao Munjamkar     (keeps d3930305-... कविता सादरीकरण)
--   0f74c42d-...  Vanashree jadhav           (keeps f10fa9e5-... Vanashree Pradeep Patil, कथा सादरीकरण)
--
-- Safe: it deletes only these 3 ids, and only while they still look exactly
-- like the duplicates (Gadchiroli, Sep-2026, no award name, no community).
-- If anything differs, nothing is deleted. The delete guard trigger copies
-- each record, with its history, into public.award_records_deleted first.
-- =====================================================================

begin;

do $$
declare n int;
begin
  select count(*) into n
  from public.award_records
  where id in ('7666740c-d1a5-4d53-93f6-4333bb075263',
               'b2a7ea71-ad49-43a4-8a70-d2f718689587',
               '0f74c42d-ee08-4c7b-ab3d-11020f8180de')
    and district_name = 'Gadchiroli'
    and month_label = 'Sep-2026'
    and award_category = 'District Level - LIFESKILL'
    and award_name is null
    and coalesce(trim(community), '') = '';
  if n <> 3 then
    raise exception 'Expected 3 matching duplicates, found %. Nothing deleted.', n;
  end if;

  delete from public.award_records
  where id in ('7666740c-d1a5-4d53-93f6-4333bb075263',
               'b2a7ea71-ad49-43a4-8a70-d2f718689587',
               '0f74c42d-ee08-4c7b-ab3d-11020f8180de');
  raise notice 'Deleted 3 duplicate records.';
end $$;

commit;

-- Check: no blank communities left, and the 3 copies are in the archive.
select coalesce(nullif(trim(community), ''), '(blank)') as community, count(*) as records
from public.award_records group by 1 order by 2 desc;

-- select record_id, record->>'full_name' as name, deleted_by, deleted_at
-- from public.award_records_deleted
-- where record_id in ('7666740c-d1a5-4d53-93f6-4333bb075263',
--                     'b2a7ea71-ad49-43a4-8a70-d2f718689587',
--                     '0f74c42d-ee08-4c7b-ab3d-11020f8180de');

-- ---------------------------------------------------------------------
-- Restore (only if needed): puts the 3 records back exactly as they were.
-- ---------------------------------------------------------------------
-- insert into public.award_records
-- select (jsonb_populate_record(null::public.award_records, d.record)).*
-- from public.award_records_deleted d
-- where d.record_id in ('7666740c-d1a5-4d53-93f6-4333bb075263',
--                       'b2a7ea71-ad49-43a4-8a70-d2f718689587',
--                       '0f74c42d-ee08-4c7b-ab3d-11020f8180de');
