-- ======================================================================
-- Award Management: a proper log
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx, after
-- sql/award-management-setup.sql. Safe to run twice.
--
-- Why
--   The history was read back out of the columns each step writes -
--   acknowledged_by, dispatched_at and so on. That works until a step
--   happens that has no column of its own: taking a requisition off hold
--   left no trace at all, and putting it on hold twice remembered only the
--   second. The order was the order the columns were listed in, not the
--   order things actually happened.
--
--   Every step now appends an entry here instead. Nothing is overwritten and
--   nothing is lost, including the steps that go backwards.
--
--   [{"at": "2026-10-17T16:24:00Z", "what": "dispatched",
--     "by": "office admin", "email": "office@...", "note": "sent by courier"}]
-- ======================================================================

begin;

alter table public.requisitions add column if not exists log jsonb not null default '[]'::jsonb;

-- Fill in what the existing rows can tell us, so nothing filed before this
-- loses its history. Each step is taken from the columns that recorded it,
-- in the order they must have happened.
update public.requisitions r
set    log = coalesce(entries.built, '[]'::jsonb)
from (
  select q.id,
         jsonb_agg(e.entry order by e.at) as built
  from   public.requisitions q
  cross  join lateral (
    values
      (q.created_at,      jsonb_build_object('at', q.created_at,      'what', 'raised',
                            'by', q.requester_name,  'note', null)),
      (q.decided_at,      jsonb_build_object('at', q.decided_at,
                            'what', case when q.status = 'declined' then 'declined' else 'approved' end,
                            'by', q.decided_by,      'note', q.decision_remark)),
      (q.acknowledged_at, jsonb_build_object('at', q.acknowledged_at, 'what', 'acknowledged',
                            'by', q.acknowledged_by, 'note', null)),
      (q.held_at,         jsonb_build_object('at', q.held_at,         'what', 'held',
                            'by', q.held_by,         'note', null)),
      (q.dispatched_at,   jsonb_build_object('at', q.dispatched_at,   'what', 'dispatched',
                            'by', q.dispatched_by,   'note', q.ho_remark)),
      (q.issue_at,        jsonb_build_object('at', q.issue_at,        'what', 'not_received',
                            'by', q.issue_by,        'note', q.issue_note)),
      (q.received_at,     jsonb_build_object('at', q.received_at,     'what', 'received',
                            'by', q.received_by,     'note', q.receipt_note)),
      (q.rejected_at,     jsonb_build_object('at', q.rejected_at,     'what', 'rejected',
                            'by', q.rejected_by,     'note', q.ho_remark))
  ) as e(at, entry)
  where  e.at is not null
  group  by q.id
) as entries
where  r.id = entries.id
  and  (r.log is null or r.log = '[]'::jsonb);

commit;

-- Check: every row has a log, and how many steps each one remembers.
select requester_name, status, jsonb_array_length(log) as steps
from   public.requisitions
order  by created_at;
