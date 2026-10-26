-- Lets the IT admin edit and delete award records from the Test tab, and bring a deleted record back.
-- Run once in the Supabase SQL editor.
--
-- Nothing is deleted without a copy: before a record is removed, the page saves it (and its history from
-- award_record_events) to award_records_deleted. "Deleted records" in the page restores or removes them.
-- The check on who may do this is made in the page; the database accepts the page's public key,
-- like the other award tables.

create table if not exists public.award_records_deleted (
  id          bigint generated always as identity primary key,
  record_id   uuid        not null,
  record      jsonb       not null,
  events      jsonb,
  deleted_by  text,
  deleted_at  timestamptz not null default now()
);

create index if not exists award_records_deleted_when_idx
  on public.award_records_deleted (deleted_at desc);

alter table public.award_records_deleted enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='award_records_deleted'
                   and policyname='deleted award records can be used') then
    create policy "deleted award records can be used"
      on public.award_records_deleted for all to anon, authenticated
      using (true) with check (true);
  end if;
end $$;

grant select, insert, delete on public.award_records_deleted to anon, authenticated;

-- Until now no record could be deleted. The page asks for this only from the IT admin.
grant delete on public.award_records to anon, authenticated;
