/**
 * OLF Staff Connect - "out for delivery" email.
 *
 * One copy of this script lives in each HO Gmail account (see README.md).
 * When Head Office dispatches a requisition, the database calls this script's
 * web link. The script:
 *   1. checks the secret code,
 *   2. re-reads the requisition from Supabase (it never trusts the call),
 *   3. finds the requester in the Employees tab (Firestore) and mails them,
 *   4. reports back to Supabase: sent, a test copy, skipped, or failed.
 *
 * Script properties to set (Project Settings > Script properties):
 *   SECRET        the code from:  select secret from public.dispatch_mail_config;
 *   SUPABASE_URL  https://rpnxpkwcpsbxswnowuhx.supabase.co
 *   SUPABASE_KEY  the project's public (anon) key, as in award.js
 *   APP_URL       https://olf-staff-connect-b1d54.web.app          (optional)
 *   FROM_NAME     OLF Staff Connect                                  (optional)
 *   FIREBASE_PROJECT  olf-staff-connect-b1d54                        (optional)
 */

/* ------------------------------------------------------------ entry points */

// A health check: opening the link in a browser says it is alive, and nothing else.
function doGet() {
  return json_({ ok: true, service: "OLF dispatch mail" });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (!body.secret || body.secret !== prop_("SECRET")) {
      return json_({ ok: false, error: "forbidden" });
    }
    if (!body.id) return json_({ ok: false, error: "no id" });

    // One at a time, so a repeated call cannot send twice.
    if (!lock.tryLock(20000)) return json_({ ok: false, error: "busy" });
    return json_(handle_(String(body.id), body.test_to || "", !!body.force));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/* ------------------------------------------------------------ the work */

function handle_(id, testTo, force) {
  var req = getRequisition_(id);
  if (!req) return report_(id, "failed", "Email not sent: requisition not found.");
  if (req.status !== "dispatched" && !force) {
    return report_(id, "skipped", "Email not sent: it is no longer dispatched.");
  }
  if (!force && req.dispatch_mail_for && req.dispatch_mail_for === req.dispatched_at) {
    return { ok: true, result: "already sent" };
  }

  // Who it is for: the requester's row in Employees, else the address saved on the requisition.
  var saved = String(req.requester_email || "").trim();
  if (!saved) {
    return report_(id, "skipped", "Email not sent: this requisition has no requester email saved.");
  }
  var person = findEmployee_(saved);               // null when Employees has no such row
  if (person && String(person.Status || "").trim().toLowerCase() === "inactive") {
    return report_(id, "skipped", "Email not sent: the requester is marked Inactive in Employees.");
  }
  var to = String((person && person.Email) || saved).trim();
  var name = String((person && person.Name) || req.requester_name || "").trim();

  if (MailApp.getRemainingDailyQuota() < 1) {
    return report_(id, "failed", "Email not sent: this Gmail account has reached today's sending limit.");
  }

  var mail = buildEmail_(req, {
    name: name,
    appUrl: prop_("APP_URL") || "https://olf-staff-connect-b1d54.web.app",
    sentBy: Session.getEffectiveUser().getEmail()
  });

  var realTo = to;
  if (testTo) {                                    // test mode: it goes to the tester, marked as a test
    to = testTo;
    mail.subject = "[TEST - would go to " + realTo + "] " + mail.subject;
  }

  MailApp.sendEmail({
    to: to,
    subject: mail.subject,
    body: mail.text,
    htmlBody: mail.html,
    name: prop_("FROM_NAME") || "OLF Staff Connect"
  });

  return report_(id, testTo ? "test" : "sent",
    testTo ? "Test copy sent to " + testTo + " (would go to " + realTo + ")."
           : "Email sent to " + realTo + (person ? "" : " (not found in Employees; used the address saved on the requisition)") + ".");
}

function report_(id, status, note) {
  try {
    UrlFetchApp.fetch(prop_("SUPABASE_URL") + "/rest/v1/rpc/dispatch_mail_done", {
      method: "post",
      contentType: "application/json",
      headers: { apikey: prop_("SUPABASE_KEY"), Authorization: "Bearer " + prop_("SUPABASE_KEY") },
      payload: JSON.stringify({ p_id: id, p_secret: prop_("SECRET"), p_status: status, p_note: note }),
      muteHttpExceptions: true
    });
  } catch (err) { /* the email already went; nothing more to do */ }
  return { ok: status === "sent" || status === "test", status: status, note: note };
}

/* ------------------------------------------------------------ reading data */

function getRequisition_(id) {
  var res = UrlFetchApp.fetch(
    prop_("SUPABASE_URL") + "/rest/v1/requisitions?id=eq." + encodeURIComponent(id) + "&select=*",
    { headers: { apikey: prop_("SUPABASE_KEY"), Authorization: "Bearer " + prop_("SUPABASE_KEY") }, muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) return null;
  var rows = JSON.parse(res.getContentText());
  return rows && rows.length ? rows[0] : null;
}

// The requester's row in Employees (read-only). Firestore matches the exact text, so try the usual spellings.
function findEmployee_(email) {
  var project = prop_("FIREBASE_PROJECT") || "olf-staff-connect-b1d54";
  var tries = [email, email.toLowerCase()].filter(function (v, i, a) { return a.indexOf(v) === i; });
  for (var i = 0; i < tries.length; i++) {
    var res = UrlFetchApp.fetch(
      "https://firestore.googleapis.com/v1/projects/" + project + "/databases/(default)/documents:runQuery",
      {
        method: "post", contentType: "application/json", muteHttpExceptions: true,
        payload: JSON.stringify({ structuredQuery: {
          from: [{ collectionId: "Employees" }],
          where: { fieldFilter: { field: { fieldPath: "Email" }, op: "EQUAL", value: { stringValue: tries[i] } } },
          limit: 1
        } })
      }
    );
    if (res.getResponseCode() !== 200) continue;
    var rows = JSON.parse(res.getContentText());
    for (var r = 0; r < rows.length; r++) {
      if (rows[r].document && rows[r].document.fields) {
        var out = {}, f = rows[r].document.fields;
        Object.keys(f).forEach(function (k) { if (f[k].stringValue !== undefined) out[k] = f[k].stringValue; });
        return out;
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------ the email
   Everything below needs nothing from Google, so it can be tried anywhere. */

var LABELS = {
  POM_BLOCK: "Block", POM_DISTRICT: "District",
  NS: "Nanhe Sitare (NS)", SU: "Shikshan Utsav (SU)",
  JUTE_SMALL: "Jute Bag · Small", JUTE_BIG: "Jute Bag · Big",
  OTHER: "Other", COFFEE_CEO: "Coffee With CEO", TOP_CLUSTERS: "Top Clusters"
};

function esc_(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// What was asked for and what is going, one line per kind of gift.
function lines_(req) {
  var order = [], byType = {};
  (req.items || []).forEach(function (it) {
    var key = String(it.award_type_id || it.code || it.name);
    if (!byType[key]) {
      byType[key] = { label: LABELS[String(it.code || "").toUpperCase()] || it.name || it.code || "Gift", asked: 0, sent: 0, parts: [] };
      order.push(key);
    }
    var q = Number(it.quantity) || 0;
    byType[key].asked += q;
    var cat = it.category === "Other" ? (it.category_other || "Other") : it.category;
    if (cat) byType[key].parts.push(cat + " " + q);
  });

  var sentList = (req.dispatched_items && req.dispatched_items.length) ? req.dispatched_items : null;
  order.forEach(function (key) {
    if (!sentList) { byType[key].sent = byType[key].asked; return; }     // nothing recorded: it is going as asked
    byType[key].sent = sentList.filter(function (d) {
      return String(d.award_type_id || d.code || d.name) === key;
    }).reduce(function (n, d) { return n + (Number(d.quantity) || 0); }, 0);
  });
  return order.map(function (k) { return byType[k]; });
}

function whenText_(iso) {
  if (!iso) return "";
  var d = new Date(iso);
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var ist = new Date(d.getTime() + 330 * 60000);                       // India Standard Time
  var h = ist.getUTCHours(), m = ist.getUTCMinutes();
  var ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return ist.getUTCDate() + " " + months[ist.getUTCMonth()] + " " + ist.getUTCFullYear() + ", " + h + ":" + (m < 10 ? "0" : "") + m + " " + ap;
}

function firstName_(name) { return String(name || "").trim().split(/\s+/)[0] || "there"; }

function buildEmail_(req, ctx) {
  var rows = lines_(req);
  var anyShort = rows.some(function (r) { return r.sent < r.asked; });
  var place = [req.district_name, req.state_name].filter(Boolean).join(", ");
  var ref = String(req.id || "").slice(0, 8).toUpperCase();
  var by = req.dispatched_by || "Head Office";
  var when = whenText_(req.dispatched_at);
  var note = String(req.ho_remark || "").trim();
  var hello = "Hi " + firstName_(ctx.name) + ",";

  var subject = "Out for delivery: your gifts for " + (req.district_name || "your district");

  // plain text, for mail programs that do not show the styled one
  var text = [
    hello, "",
    "Your gifts for " + place + " have been dispatched and are on their way.", "",
    "Delivered / asked:"
  ].concat(rows.map(function (r) {
    return "  - " + r.label + ": " + r.sent + " / " + r.asked + (r.parts.length ? "  (" + r.parts.join(", ") + ")" : "");
  })).concat([
    "", note ? "Note from Head Office: " + note : "",
    "Dispatched by " + by + (when ? " on " + when : "") + ".",
    "Reference: " + ref, "",
    "When they arrive, please open Staff Connect > Awards & Gifts > Gifts > Requisitions and click Confirm received:",
    ctx.appUrl, "",
    "OLF Staff Connect"
  ]).filter(function (l, i, a) { return !(l === "" && a[i - 1] === ""); }).join("\n");

  var lineHtml = rows.map(function (r) {
    var short = r.sent < r.asked;
    return '<tr>' +
      '<td style="padding:11px 14px;border-top:1px solid #E7ECF4;font-size:14px;color:#0F172A;">' + esc_(r.label) +
        (r.parts.length ? '<div style="font-size:12px;color:#64748B;margin-top:2px;">' + esc_(r.parts.join(", ")) + '</div>' : '') + '</td>' +
      '<td align="right" style="padding:11px 14px;border-top:1px solid #E7ECF4;font-size:15px;font-weight:700;white-space:nowrap;color:' + (short ? "#B45309" : "#0F172A") + ';">' +
        r.sent + ' <span style="font-weight:500;color:#64748B;">/ ' + r.asked + '</span></td></tr>';
  }).join("");

  var html =
    '<div style="background:#EEF2F9;padding:28px 12px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,.10);">' +
      '<tr><td bgcolor="#2F6FE4" style="background-color:#2F6FE4;background-image:linear-gradient(120deg,#2457C5,#2F6FE4 45%,#0B8F7A);padding:26px 28px;color:#ffffff;">' +
        '<div style="font-size:13px;font-weight:600;letter-spacing:.04em;opacity:.9;">OLF STAFF CONNECT</div>' +
        '<div style="font-size:24px;font-weight:800;margin-top:6px;letter-spacing:-.4px;">Out for delivery</div>' +
        '<div style="font-size:14px;margin-top:4px;opacity:.95;">Your gifts for ' + esc_(place) + ' are on their way.</div>' +
      '</td></tr>' +
      '<tr><td style="padding:26px 28px 8px;">' +
        '<p style="margin:0 0 16px;font-size:15px;color:#0F172A;">' + esc_(hello) + '</p>' +
        '<p style="margin:0 0 18px;font-size:14.5px;line-height:1.55;color:#334155;">Head Office has dispatched your requisition. Here is what is going:</p>' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E7ECF4;border-radius:12px;overflow:hidden;">' +
          '<tr><td style="padding:10px 14px;background:#F6F8FC;font-size:11.5px;font-weight:700;letter-spacing:.06em;color:#64748B;">GIFT</td>' +
              '<td align="right" style="padding:10px 14px;background:#F6F8FC;font-size:11.5px;font-weight:700;letter-spacing:.06em;color:#64748B;white-space:nowrap;">DELIVERED / ASKED</td></tr>' +
          lineHtml +
        '</table>' +
        (anyShort ? '<p style="margin:14px 0 0;padding:10px 14px;border-radius:10px;background:#FFF7E6;border:1px solid #FDE4B0;font-size:13px;color:#8A4B08;">Some gifts are fewer than you asked for.</p>' : '') +
        (note ? '<div style="margin:16px 0 0;padding:12px 14px;border-radius:10px;background:#F6F8FC;border-left:3px solid #2F6FE4;font-size:13.5px;line-height:1.5;color:#334155;"><b style="display:block;font-size:11.5px;letter-spacing:.06em;color:#64748B;margin-bottom:3px;">NOTE FROM HEAD OFFICE</b>' + esc_(note) + '</div>' : '') +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;font-size:13px;color:#475569;">' +
          '<tr><td style="padding:3px 0;color:#64748B;width:110px;">Dispatched by</td><td style="padding:3px 0;font-weight:600;color:#0F172A;">' + esc_(by) + '</td></tr>' +
          (when ? '<tr><td style="padding:3px 0;color:#64748B;">On</td><td style="padding:3px 0;font-weight:600;color:#0F172A;">' + esc_(when) + '</td></tr>' : '') +
          '<tr><td style="padding:3px 0;color:#64748B;">Reference</td><td style="padding:3px 0;font-weight:600;color:#0F172A;letter-spacing:.04em;">' + esc_(ref) + '</td></tr>' +
        '</table>' +
      '</td></tr>' +
      '<tr><td style="padding:20px 28px 28px;">' +
        '<p style="margin:0 0 14px;font-size:13.5px;line-height:1.55;color:#475569;">When they arrive, please open <b>Awards &amp; Gifts &rsaquo; Gifts &rsaquo; Requisitions</b> and click <b>Confirm received</b>.</p>' +
        '<a href="' + esc_(ctx.appUrl) + '" style="display:inline-block;padding:12px 22px;border-radius:12px;background:#2F6FE4;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Open Staff Connect</a>' +
      '</td></tr>' +
    '</table>' +
    '<p style="max-width:560px;margin:14px auto 0;text-align:center;font-size:11.5px;color:#94A3B8;">An automatic message from OLF Staff Connect. Reply to reach the Head Office team that dispatched it.</p>' +
    '</div>';

  return { subject: subject, text: text, html: html };
}

/* ------------------------------------------------------------ helpers */

function prop_(key) { return PropertiesService.getScriptProperties().getProperty(key) || ""; }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------ try it
   Run "sendSample" once from the editor to receive a sample email at the
   address of the account the script runs as. Nothing is read or changed. */
function sendSample() {
  var me = Session.getEffectiveUser().getEmail();
  var req = {
    id: "3f9c1a52-0000-0000-0000-000000000000", district_name: "Pune", state_name: "Maharashtra",
    items: [
      { award_type_id: 1, code: "POM_BLOCK", name: "POM Block", quantity: 100, category: "POM" },
      { award_type_id: 2, code: "POM_DISTRICT", name: "POM District", quantity: 40, category: "Academic" }
    ],
    dispatched_items: [
      { award_type_id: 1, code: "POM_BLOCK", quantity: 60 },
      { award_type_id: 2, code: "POM_DISTRICT", quantity: 40 }
    ],
    dispatched_by: "Head Office", dispatched_at: new Date().toISOString(), ho_remark: "Only 60 Block gifts in stock. The rest follow next week."
  };
  var mail = buildEmail_(req, { name: "Sample Person", appUrl: prop_("APP_URL") || "https://olf-staff-connect-b1d54.web.app", sentBy: me });
  MailApp.sendEmail({ to: me, subject: "[SAMPLE] " + mail.subject, body: mail.text, htmlBody: mail.html, name: prop_("FROM_NAME") || "OLF Staff Connect" });
}
