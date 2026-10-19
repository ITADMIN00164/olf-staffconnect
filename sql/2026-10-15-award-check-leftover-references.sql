-- Find what still refers to the dropped states / districts tables
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx.
-- This only reads - it changes nothing.
--
-- Why
--   Saving a requisition fails with: relation "public.districts" does not
--   exist. The insert itself never mentions that table - it sends state_name,
--   division_name, district_name, award_type_id, requester_name, quantity and
--   requisition_date. So something attached to the requisitions table is
--   reaching for it on write. A row-level security policy or a trigger is the
--   usual cause, and neither shows itself until you try to insert, which is
--   why reading the list kept working.
--
-- Paste the output back and the fix follows from what it shows.

-- 1. Row-level security policies. Look in the qual / with_check columns for
--    the words districts or states.
select policyname,
       cmd            as applies_to,
       roles,
       qual           as using_expression,
       with_check     as with_check_expression
from   pg_policies
where  schemaname = 'public'
  and  tablename  = 'requisitions'
order  by policyname;

-- 2. Triggers, and what they run.
select t.tgname                        as trigger_name,
       pg_get_triggerdef(t.oid)        as definition
from   pg_trigger t
join   pg_class     c on c.oid = t.tgrelid
join   pg_namespace n on n.oid = c.relnamespace
where  n.nspname = 'public'
  and  c.relname = 'requisitions'
  and  not t.tgisinternal;

-- 3. Constraints and column defaults that might still look something up.
select conname                          as constraint_name,
       pg_get_constraintdef(oid)        as definition
from   pg_constraint
where  conrelid = 'public.requisitions'::regclass;

select column_name, column_default, is_generated, generation_expression
from   information_schema.columns
where  table_schema = 'public'
  and  table_name   = 'requisitions'
order  by ordinal_position;

-- 4. Anything anywhere in the schema whose source still names them.
select n.nspname  as schema,
       p.proname  as function_name
from   pg_proc p
join   pg_namespace n on n.oid = p.pronamespace
where  n.nspname not in ('pg_catalog', 'information_schema')
  and  p.prosrc ~* '(public\.)?(districts|states)\M';
