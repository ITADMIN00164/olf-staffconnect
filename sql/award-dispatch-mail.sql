-- ======================================================================
-- Award Management: an email to the requester when Head Office dispatches
--
-- Run in the Supabase SQL editor for project rpnxpkwcpsbxswnowuhx. Safe to
-- run twice. It adds tables, columns and functions; it changes no existing
-- record and no figure, and it starts OFF - nothing is sent until you turn
-- it on (see "Turning it on" below).
--
-- How it works
--   HO marks a requisition dispatched -> a trigger here notices -> it calls
--   the Google Apps Script that belongs to the HO account that did it (a
--   web link kept in dispatch_mail_senders) with a secret code -> the script
--   re-reads the requisition, finds the requester in the Employees tab,
--   sends the email from that Gmail account, and reports back through
--   dispatch_mail_done(). The script is in tools/dispatch-mail/.
--
--   A failed email never blocks a dispatch: every problem is caught and
--   written on the requisition (dispatch_mail_note) for you to see.
--
-- What is kept private
--   dispatch_mail_config (the on/off switch, the test address and the
--   secret) and dispatch_mail_senders are locked: the page cannot read them.
--   Only the functions below can, and only you can, from this editor.
--
-- Turning it on, in this order (details in tools/dispatch-mail/README.md)
--   1. Run this file.
--   2. Set up the script in an HO Gmail account and add it to the senders.
--   3. Test mode:  update public.dispatch_mail_config
--                    set enabled = true, test_to = 'you@openlinksfoundation.org';
--      Every email now goes ONLY to that address, marked [TEST].
--   4. Live:       update public.dispatch_mail_config set test_to = null;
--   Stop at any time:  update public.dispatch_mail_config set enabled = false;
-- ======================================================================

-- The HTTP calls to the scripts are made by Supabase's own pg_net.
create extension if not exists pg_net;

-- ----------------------------------------------------------- what is kept
alter table public.requisitions add column if not exists dispatch_mail_for  timestamptz;  -- the dispatch (dispatched_at) already mailed
alter table public.requisitions add column if not exists dispatch_mail_at   timestamptz;  -- when the script last reported
alter table public.requisitions add column if not exists dispatch_mail_note text;         -- "Sent to ...", "Test copy sent", or why not

create table if not exists public.dispatch_mail_config (
  id       int primary key default 1 check (id = 1),     -- one row, ever
  enabled  boolean not null default false,
  test_to  text,                                         -- when set, every email goes here only
  secret   text    not null
);

insert into public.dispatch_mail_config (id, enabled, test_to, secret)
select 1, false, null, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
where not exists (select 1 from public.dispatch_mail_config);

-- One row per HO Gmail account that has the script set up.
create table if not exists public.dispatch_mail_senders (
  email       text primary key,                           -- the HO account, as it appears in Settings
  script_url  text not null,                              -- that account's web app link, ending /exec
  is_default  boolean not null default false,             -- used when the dispatcher has no script of their own
  added_at    timestamptz not null default now()
);
create unique index if not exists dispatch_mail_one_default
  on public.dispatch_mail_senders (is_default) where is_default;

-- Locked: no policy, so the page (anon / authenticated) can read nothing.
alter table public.dispatch_mail_config  enable row level security;
alter table public.dispatch_mail_senders enable row level security;
revoke all on public.dispatch_mail_config  from anon, authenticated;
revoke all on public.dispatch_mail_senders from anon, authenticated;

-- ----------------------------------------------------------- the sending
-- Starts the email for one requisition. Called by the trigger below, and by
-- you to try or retry one:   select public.dispatch_mail_send('<id>', true);
create or replace function public.dispatch_mail_send(p_id uuid, p_force boolean default false)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  cfg    public.dispatch_mail_config%rowtype;
  r      record;
  target text;
begin
  select * into cfg from public.dispatch_mail_config where id = 1;
  if not found or not cfg.enabled then return 'off'; end if;

  select id, status, dispatched_at, ho_by_email, dispatch_mail_for
    into r from public.requisitions where id = p_id;
  if not found then return 'no such requisition'; end if;
  if r.status <> 'dispatched' and not p_force then return 'not dispatched'; end if;
  if not p_force and r.dispatch_mail_for is not distinct from r.dispatched_at then
    return 'already sent for this dispatch';
  end if;

  -- The sender is the HO account that dispatched it, else the default one.
  select script_url into target from public.dispatch_mail_senders
   where lower(email) = lower(coalesce(r.ho_by_email, ''));
  if target is null then
    select script_url into target from public.dispatch_mail_senders where is_default limit 1;
  end if;
  if target is null then
    update public.requisitions
       set dispatch_mail_note = 'Email not sent: no mail sender is set up yet.', dispatch_mail_at = now()
     where id = p_id;
    return 'no sender';
  end if;

  perform net.http_post(
    url     := target,
    body    := jsonb_build_object('id', p_id, 'secret', cfg.secret,
                                  'test_to', nullif(cfg.test_to, ''), 'force', p_force),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  );
  return 'queued';

exception when others then
  -- Whatever went wrong, the dispatch itself stands.
  begin
    update public.requisitions
       set dispatch_mail_note = left('Email not sent: ' || sqlerrm, 300), dispatch_mail_at = now()
     where id = p_id;
  exception when others then null;
  end;
  return 'error: ' || sqlerrm;
end;
$$;

-- The script reports back here. It must give the secret, so the page and the
-- public cannot fake a result.
create or replace function public.dispatch_mail_done(
  p_id uuid, p_secret text, p_status text, p_note text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.dispatch_mail_config%rowtype;
begin
  select * into cfg from public.dispatch_mail_config where id = 1;
  if not found or p_secret is distinct from cfg.secret then return false; end if;

  if p_status in ('sent', 'skipped') then
    -- Done for this dispatch: not mailed again unless HO dispatches again.
    update public.requisitions
       set dispatch_mail_for = dispatched_at, dispatch_mail_at = now(), dispatch_mail_note = left(p_note, 300)
     where id = p_id;
  else
    -- A test copy or a failure: noted, but the dispatch still counts as unmailed.
    update public.requisitions
       set dispatch_mail_at = now(), dispatch_mail_note = left(p_note, 300)
     where id = p_id;
  end if;
  return true;
end;
$$;

revoke all on function public.dispatch_mail_send(uuid, boolean) from public, anon, authenticated;
revoke all on function public.dispatch_mail_done(uuid, text, text, text) from public;
grant execute on function public.dispatch_mail_done(uuid, text, text, text) to anon, authenticated;

-- ----------------------------------------------------------- the trigger
create or replace function public.dispatch_mail_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.dispatch_mail_send(new.id, false);
  return new;
exception when others then
  return new;            -- never let the email get in the way of the dispatch
end;
$$;

drop trigger if exists dispatch_mail_after_dispatch on public.requisitions;
create trigger dispatch_mail_after_dispatch
  after update on public.requisitions
  for each row
  when (new.status = 'dispatched'
        and (old.status is distinct from 'dispatched'
             or old.dispatched_at is distinct from new.dispatched_at))
  execute function public.dispatch_mail_trigger();

-- ----------------------------------------------------------- checks
-- Check 1: the switch (off to begin with) - and the secret to paste into the
-- script's properties. Keep it to yourself.
select enabled, test_to, secret from public.dispatch_mail_config;

-- Check 2: the trigger exists.
select tgname, tgenabled from pg_trigger where tgname = 'dispatch_mail_after_dispatch';

-- Check 3: senders added so far (none to begin with).
select email, is_default from public.dispatch_mail_senders;
