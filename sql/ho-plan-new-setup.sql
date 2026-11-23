-- HO Plan & Review (New): empty copies of the nine live tables, prefixed hp_.
-- Safe to run: it only CREATES new tables and does not touch the live ones.
-- Run once in the Supabase SQL editor (project muonwruwhcusohzlqitn).

create table if not exists hp_depts       (like depts       including all);
create table if not exists hp_goal_names  (like goal_names  including all);
create table if not exists hp_categories  (like categories  including all);
create table if not exists hp_admins      (like admins      including all);
create table if not exists hp_goals       (like goals       including all);
create table if not exists hp_tasks       (like tasks       including all);
create table if not exists hp_reviews     (like reviews     including all);
create table if not exists hp_review_items(like review_items including all);

-- Same access as the live tables for now, so the copy can be tested.
-- Tightening this is a separate step before go-live.
do $$
declare t text;
begin
  foreach t in array array['hp_depts','hp_goal_names','hp_categories','hp_admins','hp_goals','hp_tasks','hp_reviews','hp_review_items']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists open_all on %I', t);
    execute format('create policy open_all on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;
