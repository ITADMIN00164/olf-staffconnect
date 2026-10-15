-- Award database: several awards on one requisition
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx.
-- Safe to run twice.
--
-- Why
--   A requisition held one award and one quantity, so asking for two awards
--   for the same district meant filing twice and approving twice. The awards
--   asked for are now a list on the requisition.
--
-- Shape of items
--   [{"award_type_id": 1, "code": "POM_BLOCK", "name": "POM Block",
--     "quantity": 100}, ...]
--
--   The code and name are copied in alongside the id so a row still reads on
--   its own - the same reason the state and district are names rather than
--   ids. The id is kept for anyone who wants to join.
--
--   No separate table, as asked. A requisition and the awards on it are one
--   thing: they are filed together, approved together, and never queried
--   apart from each other.
--
-- The old columns stay
--   quantity keeps holding the total, which is what the table foots up, and
--   award_type_id is still set when a requisition asks for exactly one award,
--   so the existing rows and the join still mean something. Where there are
--   several, it is left empty and items is the answer.

begin;

alter table public.requisitions add column if not exists items jsonb;

-- A requisition with several awards has no single award_type_id to give.
alter table public.requisitions alter column award_type_id drop not null;

commit;

-- Check: the column is there, and the rows filed before this have no items
-- (they are read from award_type_id instead).
select count(*)                                  as rows,
       count(*) filter (where items is not null) as with_items,
       count(*) filter (where items is null)     as legacy_single_award
from   public.requisitions;
