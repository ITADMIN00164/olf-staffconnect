-- Award database: record addresses alongside names
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx.
-- Safe to run twice.
--
-- Why
--   Every person on a requisition was recorded as a name only - who raised
--   it, who approved it, who fulfilled it. Two people sharing a name, or
--   somebody changing theirs, and the log stops saying who did anything. An
--   address is the thing that identifies the account, so it is kept beside
--   the name.
--
--   The name is still what is shown. This is for the record, not the page.

begin;

alter table public.requisitions add column if not exists requester_email  text;
alter table public.requisitions add column if not exists decided_by_email text;
alter table public.requisitions add column if not exists ho_by_email      text;

commit;

-- Check: the rows filed before this have no address, which is expected -
-- they were recorded before it was kept.
select count(*)                                        as rows,
       count(*) filter (where requester_email is null) as without_requester_email
from   public.requisitions;
