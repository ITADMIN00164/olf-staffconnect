-- Lets the Dropdown lists window of Add records (IT admin) add, rename and delete the values
-- Community and District Name accept. Run once in the Supabase SQL editor, after award-lists-setup.sql.
-- The check on who may do this is made in the page; the database accepts the page's public key,
-- like the other award tables.

do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='award_lists'
                   and policyname='award lists can be changed') then
    create policy "award lists can be changed"
      on public.award_lists for all to anon, authenticated
      using (true) with check (true);
  end if;
end $$;

grant select, insert, update, delete on public.award_lists to anon, authenticated;
