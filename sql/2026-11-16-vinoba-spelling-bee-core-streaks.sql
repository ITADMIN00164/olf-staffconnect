-- =====================================================================
-- Field Review System — Block Status Report, Nov 2026 format
-- Run ONCE in the Supabase SQL editor of the "Field Team Review System"
-- project, BEFORE uploading a file in the new format.
--
-- What it does (adds only; no existing row or value is changed or deleted):
--   1. vinoba_data: 12 new columns for total / improved streaks per club
--      (Spelling Bee is now a core life-skill club).
--      The old columns (streaks, streak_creative_writing, ...) are KEPT with
--      their data, so months uploaded earlier still show their numbers.
--   2. vinoba_v (the view the Field Review page and Home read): the 12 new
--      columns are appended at the end. Everything already in the view stays
--      exactly as it is (same columns, same order, same filters).
--   3. g1_g2_g3_target_sheet: new optional column sb_streak (SB Streak target).
--
-- Safe to run twice. If any step fails, nothing is applied (one transaction).
-- =====================================================================

begin;

-- 1. new streak columns ------------------------------------------------
alter table public.vinoba_data
  add column if not exists total_improved_streaks            numeric,
  add column if not exists improved_streak_creative_writing  numeric,
  add column if not exists improved_streak_storytelling      numeric,
  add column if not exists improved_streak_poetry_recitation numeric,
  add column if not exists improved_streak_spoken_english    numeric,
  add column if not exists improved_streak_spelling_bee      numeric,
  add column if not exists total_streaks                     numeric,
  add column if not exists total_streak_creative_writing     numeric,
  add column if not exists total_streak_storytelling         numeric,
  add column if not exists total_streak_poetry_recitation    numeric,
  add column if not exists total_streak_spoken_english       numeric,
  add column if not exists total_streak_spelling_bee         numeric;

-- 3. SB Streak target (placeholder; blank until a targets file carries it)
alter table public.g1_g2_g3_target_sheet
  add column if not exists sb_streak numeric;

-- 2. append the new columns to vinoba_v --------------------------------
-- A view stores its column list when it is created, so new table columns do
-- not show up in it by themselves. This takes the view's current definition
-- and adds the 12 columns at the end of its SELECT list.
do $$
declare
  def      text;
  opts     text[];
  m        text[];
  tbl      text;
  add_list text := '';
  c        text;
  newcols  text[] := array[
    'total_improved_streaks',
    'improved_streak_creative_writing', 'improved_streak_storytelling', 'improved_streak_poetry_recitation',
    'improved_streak_spoken_english', 'improved_streak_spelling_bee',
    'total_streaks',
    'total_streak_creative_writing', 'total_streak_storytelling', 'total_streak_poetry_recitation',
    'total_streak_spoken_english', 'total_streak_spelling_bee'];
begin
  def := pg_get_viewdef('public.vinoba_v'::regclass, false);
  select reloptions into opts from pg_class where oid = 'public.vinoba_v'::regclass;

  -- how the view refers to vinoba_data (an alias like "v", or the table name itself)
  m := regexp_match(def, 'FROM[\s(]+(?:public\.)?vinoba_data(?:\s+(?:AS\s+)?([A-Za-z_][A-Za-z0-9_]*))?', 'i');
  if m is null then
    raise exception 'vinoba_v does not read vinoba_data the expected way. Definition: %', def;
  end if;
  tbl := coalesce(m[1], 'vinoba_data');
  if lower(tbl) in ('where','join','left','right','inner','full','cross','group','order','limit','on','union','window') then
    tbl := 'vinoba_data';
  end if;

  foreach c in array newcols loop
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'vinoba_v' and column_name = c) then
      add_list := add_list || ', ' || quote_ident(tbl) || '.' || c;
    end if;
  end loop;

  if add_list = '' then
    raise notice 'vinoba_v already has the new columns - nothing to do.';
    return;
  end if;

  -- insert just before "FROM vinoba_data" (the end of the SELECT list). Not simply the first
  -- FROM: expressions such as TRIM(BOTH FROM ...) also contain the word.
  def := regexp_replace(def, '\s+FROM([\s(]+(?:public\.)?vinoba_data)(?![A-Za-z0-9_])', add_list || ' FROM\1', 'i');
  def := regexp_replace(def, ';\s*$', '');
  execute 'create or replace view public.vinoba_v as ' || def;

  -- keep the view's options (e.g. security_invoker) as they were
  if opts is not null then
    execute 'alter view public.vinoba_v set (' || array_to_string(opts, ', ') || ')';
  end if;
  raise notice 'vinoba_v updated: %', add_list;
end $$;

commit;

-- let the API see the new columns straight away
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- Checks (run after the above; read-only)
-- ---------------------------------------------------------------------
-- a) the view now has the new columns (expect 12 rows + the 5 old streak columns):
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'vinoba_v' and column_name like '%streak%'
--  order by ordinal_position;
--
-- b) existing uploads are untouched (same counts as before; old streak values still there):
-- select year, month, week, count(*) as rows, sum(streaks) as old_streaks, sum(total_streaks) as new_total_streaks
--   from public.vinoba_data group by 1,2,3 order by 1 desc,2 desc,3 desc;
--
-- c) target column present:
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'g1_g2_g3_target_sheet' and column_name = 'sb_streak';
