# Dispatch email: "Out for delivery"

When Head Office marks a requisition **dispatched**, the person who raised it gets an email from the HO Gmail account that did the dispatch.

```
HO marks dispatched
   -> database trigger (sql/award-dispatch-mail.sql)
   -> that HO account's Apps Script  (tools/dispatch-mail/Code.gs)
   -> finds the requester in Employees, emails them
   -> reports back: sent / test copy / skipped / failed   (shown in requisitions.dispatch_mail_note)
```

It costs nothing, and a failed email never stops a dispatch.

## What is in the email
What was asked and what is going (`60 / 100` per gift), Head Office's note, who dispatched it and when, a reference, and a button to Staff Connect asking them to **Confirm received** when the gifts arrive. Times are in India time.

## Set-up (once)

### 1. The database
Run `sql/award-dispatch-mail.sql` in the Supabase SQL editor. It starts **off**. At the end it shows you a `secret`. Copy it: the scripts need it.

### 2. Each HO Gmail account (about 5 minutes, once per account)
Do this signed in as `officeolf001@gmail.com`, then again as `officeolf002@gmail.com`:

1. Open <https://script.google.com> and click **New project**. Name it `OLF dispatch mail`.
2. Delete what is in the editor and paste all of `tools/dispatch-mail/Code.gs`. Save.
3. **Project Settings** (the gear) > **Script properties** > **Add script property**. Add these:

   | Property | Value |
   |---|---|
   | `SECRET` | the secret from step 1 |
   | `SUPABASE_URL` | `https://rpnxpkwcpsbxswnowuhx.supabase.co` |
   | `SUPABASE_KEY` | the project's public (anon) key, the same one `award.js` uses |
   | `APP_URL` | `https://olf-staff-connect-b1d54.web.app` (optional) |
   | `FROM_NAME` | `OLF Staff Connect` (optional) |

4. Back in the editor, choose the function **sendSample** and click **Run**. Google asks you to authorise: click through (it may say "unverified app", because it is your own script: *Advanced > Go to OLF dispatch mail*). You should receive a **[SAMPLE]** email at that account. This checks the look and that Gmail works.
5. **Deploy > New deployment > Web app.** Set *Execute as*: **Me**, and *Who has access*: **Anyone**. Click **Deploy**.
6. Copy the **Web app URL** (it ends `/exec`).

### 3. Tell the database about it
In the Supabase SQL editor (use the real address and link):

```sql
insert into public.dispatch_mail_senders (email, script_url, is_default)
values ('officeolf001@gmail.com', 'PASTE THE /exec LINK HERE', true)      -- true = the default sender
on conflict (email) do update set script_url = excluded.script_url;

insert into public.dispatch_mail_senders (email, script_url, is_default)
values ('officeolf002@gmail.com', 'PASTE ITS /exec LINK HERE', false)
on conflict (email) do update set script_url = excluded.script_url;
```

The email address must be the one shown for that person under **Settings > Head Office** in Staff Connect. The default sender is used when the person who dispatched has no script of their own.

## Going live, safely

1. **Test mode**: every email goes only to you, marked `[TEST - would go to ...]`.
   ```sql
   update public.dispatch_mail_config set enabled = true, test_to = 'you@openlinksfoundation.org';
   ```
   Dispatch a real requisition. Check the email, the details, and that it did not land in spam. Run a few.
2. **Live**: requesters now get the email.
   ```sql
   update public.dispatch_mail_config set test_to = null;
   ```
3. **Stop at any time**:
   ```sql
   update public.dispatch_mail_config set enabled = false;
   ```

## Seeing what happened
```sql
select district_name, requester_name, dispatched_at, dispatch_mail_note
from public.requisitions
where status in ('dispatched', 'received') order by dispatched_at desc limit 20;
```

| `dispatch_mail_note` | Meaning |
|---|---|
| `Email sent to ...` | done |
| `Test copy sent to ...` | test mode; the requester was not emailed |
| `Email not sent: this requisition has no requester email saved.` | an old requisition: nothing to send to |
| `Email not sent: the requester is marked Inactive in Employees.` | left the organisation |
| `Email not sent: no mail sender is set up yet.` | no row in `dispatch_mail_senders` |
| `Email not sent: this Gmail account has reached today's sending limit.` | about 100 a day on a normal Gmail account |

To retry one: `select public.dispatch_mail_send('<requisition id>', true);`

## Good to know
- **The requester's address** comes from their row in the Employees tab (matched by the email they signed in with). If Employees has no row, the address saved on the requisition is used and the note says so.
- **A repeat dispatch** (after "never arrived") sends a fresh email. The same dispatch never sends twice.
- **Safety:** the web link only acts when it is given the secret; it then re-reads the requisition itself, so it cannot be used to email anyone else. Anyone can open the link in a browser, and all they see is `{"ok":true}`.
- **If you change the script**, use **Deploy > Manage deployments > Edit > New version**, so the same link keeps working.
- **If you rotate the secret**: `update public.dispatch_mail_config set secret = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');` then update `SECRET` in each script's properties.
