-- Moves the level out of award_name and into award_category.
--   POM:       "Post of the Month, Block Level" / POM  ->  "Post of the Month" / "Block Level - POM"
--   LIFESKILL: any award                               ->  same name / "District Level - LIFESKILL"
-- The Test tab already shows rows this way without this script; run it only to make
-- the table itself match. Safe to run twice: a category that is already split is skipped.

update public.award_records
set award_category = initcap(substring(award_name from '(?i)((?:block|district|cluster) level)\s*$')) || ' - POM',
    award_name     = btrim(regexp_replace(award_name, '[,\s-]*(block|district|cluster) level\s*$', '', 'i'))
where award_category = 'POM'
  and award_name ~* '(block|district|cluster) level\s*$';

update public.award_records
set award_category = 'District Level - LIFESKILL'
where award_category = 'LIFESKILL';
