-- A safety net for deleted award records. Run once in the Supabase SQL editor, after
-- award-records-manage.sql.
--
-- Deleting is allowed with the page's public key (the page limits it to the IT admin, but a
-- direct request to the database would not be limited). This trigger makes sure that EVERY delete,
-- from the page or not, leaves a copy of the record and its history in award_records_deleted, in the
-- same step as the delete itself. Deleted records in the page can then bring it back.
--
-- A delete made by the page is copied by the page first, with the admin's name; a delete made any other way is
-- copied here as "direct delete". The check below keeps the trigger from
-- making a second copy of the same record.

create or replace function public.archive_deleted_award_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.award_records_deleted d
                 where d.record_id = old.id
                   and d.deleted_at > now() - interval '1 minute') then
    insert into public.award_records_deleted (record_id, record, events, deleted_by)
    values (
      old.id,
      to_jsonb(old),
      (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb)
         from public.award_record_events e where e.record_id = old.id),
      'direct delete'
    );
  end if;
  return old;
end;
$$;

drop trigger if exists award_records_archive_delete on public.award_records;
create trigger award_records_archive_delete
  before delete on public.award_records
  for each row execute function public.archive_deleted_award_record();
