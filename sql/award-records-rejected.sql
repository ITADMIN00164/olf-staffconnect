-- ======================================================================
-- Award Management: record a rejection
--
-- Run in the Supabase SQL editor, after sql/award-records-setup.sql. Safe to
-- run twice.
--
-- A verifier can verify a record, reject it, or unlock one they verified.
-- Verified and rejected are different answers, so a rejection needs a place
-- of its own: verified stays false and rejected becomes true. Without this
-- column everything else on the Award Management tab works; only Reject does
-- not.
-- ======================================================================

alter table public.award_records
  add column if not exists rejected boolean not null default false;

-- Check: the column is there and nothing is rejected yet.
select count(*) filter (where rejected) as rejected, count(*) as records
from public.award_records;
