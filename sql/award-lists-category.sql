-- The Award Category dropdown of Add records: a new upload may only use these values.
-- Run once in the Supabase SQL editor, after award-lists-setup.sql.
-- To add, rename or remove a category later, use "Manage the dropdown lists" in Add records
-- (the Award Category tab), or the Table Editor. Records already in the table are not changed.

-- award_lists only allowed community and district; let it hold categories too.
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.award_lists'::regclass
             and contype = 'c'
             and pg_get_constraintdef(oid) like '%community%'
  loop
    execute format('alter table public.award_lists drop constraint %I', c);
  end loop;
end $$;

alter table public.award_lists
  add constraint award_lists_kind_check check (kind in ('community', 'district', 'category'));

insert into public.award_lists (kind, value, sort_order)
values
  ('category', 'Block Level - POM', 1),
  ('category', 'District Level - POM', 2),
  ('category', 'District Level - LIFESKILL', 3),
  ('category', 'Nanhe Sitare (NS)', 4),
  ('category', 'Shikshan Utsav (SU)', 5)
on conflict (kind, value) do nothing;
