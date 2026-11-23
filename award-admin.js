/* award-admin.js - the IT admin's tools on the award records of the Test tab:
     Delete  - a whole past upload, or a whole month of the first import, from "All uploads".
               Records cannot be edited or deleted one by one in the table of records.
     Undo    - every removed record is first copied to public.award_records_deleted, and the
               "Deleted records" window brings it back (with its history) or removes it for good.

   Only the IT admin account sees any of it. The check is made here in the page, like the other
   admin-only screens of this app; the database itself accepts the page's public key.
   award-manage.js hands this file what it needs through window.awmApi. */
(function () {

const SB_URL = "https://rpnxpkwcpsbxswnowuhx.supabase.co";
const SB_KEY = "sb_publishable_60Ynb6EZ6Qc2GHrdqERwpw_dUdH3dKD";
const ADMIN_EMAIL = "itadmin@openlinksfoundation.org";
const CHUNK = 80;               // ids per request, so a web address stays short

function api() { return window.awmApi || null; }
function el(id) { return document.getElementById(id); }
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function isAdmin() {
  const u = window.__olfUser;
  return !!(u && String(u.email || "").trim().toLowerCase() === ADMIN_EMAIL);
}
function who() {
  const u = window.__olfUser;
  return (u && (u.email || u.name)) || "";
}

// ── Database ──
function headers(extra) { return Object.assign({ apikey: SB_KEY, Authorization: "Bearer " + SB_KEY }, extra || {}); }
async function call(method, path, body, prefer) {
  const res = await fetch(SB_URL + "/rest/v1/" + path, {
    method: method,
    headers: headers(Object.assign({ "Content-Type": "application/json" }, prefer ? { Prefer: prefer } : {})),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!res.ok) {
    const err = new Error(await res.text());
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}
const get = path => call("GET", path);

function chunks(list, n) {
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}
function inList(ids) { return "in.(" + ids.join(",") + ")"; }

function missingTable(e) { return /award_records_deleted|permission|policy|denied|does not exist/i.test((e && e.message) || "") || (e && (e.status === 401 || e.status === 403 || e.status === 404)); }
const SETUP_HINT = "Run sql/award-records-manage.sql in Supabase first, then try again.";

// ── Delete: copy to the archive first, then remove, then say so ──
async function fetchRows(table, ids, column) {
  const out = [];
  for (const part of chunks(ids, CHUNK)) {
    const rows = await get(table + "?select=*&" + (column || "id") + "=" + inList(part));
    rows.forEach(r => out.push(r));
  }
  return out;
}

async function removeRecords(ids) {
  const rows = await fetchRows("award_records", ids);
  if (!rows.length) return 0;
  const events = await fetchRows("award_record_events", rows.map(r => r.id), "record_id");
  const copies = rows.map(r => ({
    record_id: r.id, record: r,
    events: events.filter(e => e.record_id === r.id),
    deleted_by: who()
  }));
  for (const part of chunks(copies, 40)) await call("POST", "award_records_deleted", part, "return=minimal");
  let removed = 0;
  for (const part of chunks(rows.map(r => r.id), CHUNK)) {
    const gone = await call("DELETE", "award_records?id=" + inList(part), undefined, "return=representation");
    removed += gone.length;
  }
  return removed;
}

// ── Undo: the Deleted records window ──
function ensureTrashModal() {
  if (el("awmTrashModal")) return;
  const m = document.createElement("div");
  m.id = "awmTrashModal";
  m.className = "pom-modal-overlay";
  m.innerHTML = '<div class="pom-modal-box awm-edit-box"><div class="pom-modal-title">Deleted records</div>' +
    '<p class="awm-edit-sub">Everything removed is kept here. Restore brings a record back with its history.</p>' +
    '<div class="awm-trash-list" id="awmTrashList"></div><p class="awm-edit-err" id="awmTrashMsg"></p>' +
    '<div class="pom-modal-actions"><button type="button" id="awmTrashClose" class="pmbtn cancel">Close</button>' +
    '<button type="button" id="awmTrashForever" class="pmbtn danger" disabled>Remove for good</button>' +
    '<button type="button" id="awmTrashRestore" class="pmbtn primary" disabled>Restore selected</button></div></div>';
  (el("aw-view-award") || document.body).appendChild(m);
  el("awmTrashClose").addEventListener("click", function () { m.classList.remove("open"); });
  m.addEventListener("click", function (e) { if (e.target === m) m.classList.remove("open"); });
  el("awmTrashList").addEventListener("change", syncTrashButtons);
  el("awmTrashRestore").addEventListener("click", restoreTicked);
  el("awmTrashForever").addEventListener("click", purgeTicked);
}

function trashTicked() {
  return Array.from(document.querySelectorAll("#awmTrashList [data-tid]:checked")).map(n => Number(n.getAttribute("data-tid")));
}
function syncTrashButtons() {
  const n = trashTicked().length;
  el("awmTrashRestore").disabled = !n;
  el("awmTrashForever").disabled = !n;
}

let trashRows = [];
async function openTrash() {
  if (!isAdmin()) return;
  ensureTrashModal();
  el("awmTrashMsg").textContent = "";
  el("awmTrashList").innerHTML = '<p class="awa-note">Loading…</p>';
  el("awmTrashModal").classList.add("open");
  try {
    trashRows = await get("award_records_deleted?select=id,record_id,record,events,deleted_by,deleted_at&order=deleted_at.desc&limit=300");
    renderTrash();
  } catch (e) {
    console.error("Deleted records failed:", e);
    el("awmTrashList").innerHTML = '<p class="awa-note awa-err">' + esc(missingTable(e) ? SETUP_HINT : "Could not load the deleted records.") + "</p>";
  }
}

function renderTrash() {
  const box = el("awmTrashList");
  if (!trashRows.length) { box.innerHTML = '<p class="awa-note">Nothing has been deleted.</p>'; syncTrashButtons(); return; }
  box.innerHTML = '<table class="awm-trash"><thead><tr><th></th><th>Name</th><th>District</th><th>Month</th><th>Deleted</th></tr></thead><tbody>' +
    trashRows.map(t => {
      const r = t.record || {};
      const when = t.deleted_at ? new Date(t.deleted_at).toLocaleString() : "";
      return '<tr><td><input type="checkbox" data-tid="' + t.id + '"></td><td><b>' + esc(r.full_name || "") + "</b><small>" + esc(r.mobile || "") +
        "</small></td><td>" + esc(r.district_name || "") + "</td><td>" + esc(r.month_label || "") + "</td><td>" + esc(when) +
        "<small>" + esc(t.deleted_by || "") + "</small></td></tr>";
    }).join("") + "</tbody></table>";
  syncTrashButtons();
}

async function restoreTicked() {
  const a = api();
  const ids = trashTicked();
  const items = trashRows.filter(t => ids.indexOf(t.id) !== -1);
  if (!isAdmin() || !items.length) return;
  el("awmTrashMsg").textContent = "Restoring…";
  try {
    for (const part of chunks(items, 40)) {
      await call("POST", "award_records", part.map(t => t.record), "return=minimal");
      const ev = [];
      part.forEach(t => (t.events || []).forEach(e => ev.push(e)));
      if (ev.length) await call("POST", "award_record_events", ev, "return=minimal").catch(function () {});
    }
    for (const part of chunks(items.map(t => t.id), CHUNK)) await call("DELETE", "award_records_deleted?id=" + inList(part));
    trashRows = trashRows.filter(t => ids.indexOf(t.id) === -1);
    renderTrash();
    el("awmTrashMsg").textContent = items.length + " record" + (items.length === 1 ? "" : "s") + " restored.";
    if (a) { await a.refresh(); }
  } catch (e) {
    console.error("Restore failed:", e);
    el("awmTrashMsg").textContent = e.status === 409 || /duplicate|already exists/i.test(e.message || "")
      ? "Some of these are already back in the table. Nothing was changed for them."
      : "Could not restore. Try again.";
  }
}

async function purgeTicked() {
  const a = api();
  const ids = trashTicked();
  if (!isAdmin() || !ids.length) return;
  const choice = await a.showModal({
    title: "Remove for good?",
    message: ids.length + " record" + (ids.length === 1 ? "" : "s") + " will be removed from Deleted records too. This cannot be undone.",
    buttons: [{ label: "Cancel", value: "cancel", variant: "cancel" }, { label: "Remove for good", value: "go", variant: "danger" }]
  });
  if (choice !== "go") return;
  try {
    for (const part of chunks(ids, CHUNK)) await call("DELETE", "award_records_deleted?id=" + inList(part));
    trashRows = trashRows.filter(t => ids.indexOf(t.id) === -1);
    renderTrash();
    el("awmTrashMsg").textContent = "Removed for good.";
  } catch (e) {
    console.error("Purge failed:", e);
    el("awmTrashMsg").textContent = "Could not remove. Try again.";
  }
}

// ── Every batch of records: what each upload added, and what the original import brought ──
// A record's source_ref says where it came from: "upload 2026-10-26 09:23 row 4" for Add records,
// "raw:12 + awarded:7" and the like for the first import of the POM sheets. They are grouped, so any
// of them - a whole upload, or a whole month that came with the import - can be taken out in one go.
function ensureUploadsModal() {
  if (el("awmUploadsModal")) return;
  const m = document.createElement("div");
  m.id = "awmUploadsModal";
  m.className = "pom-modal-overlay";
  m.innerHTML = '<div class="pom-modal-box awm-edit-box"><div class="pom-modal-title">All uploads</div>' +
    '<p class="awm-edit-sub">Every batch of records in the table: what Add records added, and what came with the first import. ' +
    'Delete a batch to take all of its records out. They go to Deleted records first.</p>' +
    '<div class="awm-trash-list" id="awmUploadsList"></div><p class="awm-edit-err" id="awmUploadsMsg"></p>' +
    '<div class="pom-modal-actions"><button type="button" id="awmUploadsClose" class="pmbtn cancel">Close</button></div></div>';
  (el("aw-view-award") || document.body).appendChild(m);
  el("awmUploadsClose").addEventListener("click", function () { m.classList.remove("open"); });
  m.addEventListener("click", function (e) { if (e.target === m) m.classList.remove("open"); });
}

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
// A label that is not a month ("Pending 2025-26") comes first, then the months in calendar order.
function monthKey(label) {
  const p = String(label || "").split("-");
  const mi = MONTHS[p[0]], yr = parseInt(p[1], 10);
  return (mi == null || isNaN(yr)) ? -1 : yr * 12 + mi;
}

let batches = [];
async function openUploads() {
  if (!isAdmin()) return;
  ensureUploadsModal();
  el("awmUploadsMsg").textContent = "";
  el("awmUploadsList").innerHTML = '<p class="awa-note">Loading\u2026</p>';
  el("awmUploadsModal").classList.add("open");
  try {
    const rows = [];
    for (let off = 0; ; off += 1000) {
      const page = await get("award_records?select=id,source_ref,month_label,awarded,verified,image_url&order=id.asc&limit=1000&offset=" + off);
      page.forEach(r => rows.push(r));
      if (page.length < 1000) break;
    }
    const map = {};
    rows.forEach(r => {
      const m = /^upload (\d{4}-\d{2}-\d{2} \d{2}:\d{2})/.exec(r.source_ref || "");
      const key = m ? "u|" + m[1] + "|" + r.month_label : "i|" + r.month_label;
      const g = map[key] || (map[key] = { kind: m ? "upload" : "import", stamp: m ? m[1] : "", month: r.month_label, ids: [], awarded: 0, verified: 0, image: 0 });
      g.ids.push(r.id);
      if (r.awarded) g.awarded++;
      if (r.verified) g.verified++;
      if (r.image_url) g.image++;
    });
    batches = Object.keys(map).map(k => map[k]).sort((x, y) => {
      if (x.kind !== y.kind) return x.kind === "upload" ? -1 : 1;           // what Add records added first
      if (x.kind === "upload") return y.stamp.localeCompare(x.stamp);       // newest first
      return monthKey(x.month) - monthKey(y.month);                          // the import, month by month
    });
    renderUploads();
  } catch (e) {
    console.error("Uploads failed:", e);
    el("awmUploadsList").innerHTML = '<p class="awa-note awa-err">Could not load the batches.</p>';
  }
}

function workText(b) {
  return [b.awarded && b.awarded + " awarded", b.verified && b.verified + " verified", b.image && b.image + " with image"].filter(Boolean).join(", ");
}

function renderUploads() {
  const box = el("awmUploadsList");
  if (!batches.length) { box.innerHTML = '<p class="awa-note">There are no records.</p>'; return; }
  box.innerHTML = '<table class="awm-trash"><thead><tr><th>Source</th><th>Month</th><th>Records</th><th></th></tr></thead><tbody>' +
    batches.map((b, i) => {
      const work = workText(b);
      const source = b.kind === "upload"
        ? "<b>Add records</b><small>" + esc(b.stamp) + "</small>"
        : "<b>First import</b><small>from the POM sheets</small>";
      return "<tr><td>" + source + "</td><td>" + esc(b.month) + "</td><td><b>" + b.ids.length + "</b>" +
        (work ? "<small>" + esc(work) + "</small>" : "") +
        '</td><td><button type="button" class="awa-b bad" data-bdel="' + i + '">Delete</button></td></tr>';
    }).join("") + "</tbody></table>";
  box.querySelectorAll("[data-bdel]").forEach(btn => btn.addEventListener("click", function () { deleteBatch(Number(btn.getAttribute("data-bdel"))); }));
}

// A big batch, or one with work on it, is only deleted after its word is typed.
function confirmTyped(title, message, word) {
  return new Promise(function (resolve) {
    let m = el("awmTypeModal");
    if (!m) {
      m = document.createElement("div");
      m.id = "awmTypeModal";
      m.className = "pom-modal-overlay";
      m.innerHTML = '<div class="pom-modal-box"><div class="pom-modal-title" id="awmTypeTitle"></div>' +
        '<div class="pom-modal-msg" id="awmTypeMsg"></div>' +
        '<input type="text" id="awmTypeInput" class="awm-type-input" autocomplete="off">' +
        '<div class="pom-modal-actions"><button type="button" id="awmTypeNo" class="pmbtn cancel">Cancel</button>' +
        '<button type="button" id="awmTypeYes" class="pmbtn danger" disabled>Delete</button></div></div>';
      (el("aw-view-award") || document.body).appendChild(m);
    }
    const input = el("awmTypeInput"), yes = el("awmTypeYes"), no = el("awmTypeNo");
    el("awmTypeTitle").textContent = title;
    el("awmTypeMsg").textContent = message + "\n\nType " + word + " to confirm.";
    input.value = "";
    yes.disabled = true;
    const done = function (ok) {
      m.classList.remove("open");
      input.oninput = null; yes.onclick = null; no.onclick = null;
      resolve(ok);
    };
    input.oninput = function () { yes.disabled = input.value.trim() !== word; };
    yes.onclick = function () { done(true); };
    no.onclick = function () { done(false); };
    m.classList.add("open");
    input.focus();
  });
}

async function deleteBatch(i) {
  const a = api();
  const b = batches[i];
  if (!isAdmin() || !b || !a) return;
  const where = b.kind === "upload" ? "uploaded with Add records on " + b.stamp : "from the first import";
  const work = workText(b);
  const message = b.ids.length + " records (" + b.month + "), " + where + "." +
    (work ? "\n\nSome already have work on them: " + work + "." : "") +
    "\n\nThey are copied to Deleted records first, so they can be brought back from there.";
  const heavy = b.ids.length > 25 || !!work;
  let go;
  if (heavy) {
    go = await confirmTyped("Delete " + b.ids.length + " records?", message, "DELETE");
  } else {
    go = (await a.showModal({
      title: "Delete this batch?", message: message,
      buttons: [{ label: "Cancel", value: "cancel", variant: "cancel" }, { label: "Delete " + b.ids.length, value: "go", variant: "danger" }]
    })) === "go";
  }
  if (!go) return;
  a.showLoader();
  try {
    const removed = await removeRecords(b.ids);
    batches.splice(i, 1);
    renderUploads();
    el("awmUploadsMsg").textContent = removed + " records deleted. They are in Deleted records.";
    await a.refresh();
  } catch (e) {
    console.error("Delete batch failed:", e);
    el("awmUploadsMsg").textContent = missingTable(e) ? SETUP_HINT : "Could not delete that batch.";
  } finally {
    a.hideLoader();
  }
}

// ── Verify the Shikshan Utsav (SU) / Nanhe Sitare (NS) awards of the open month ──
// IT admin only. For the district and month that are open, fills in every pending record of the
// chosen category the same way - Awarded Yes, Awarded By District Education Officer, the date, one
// picture, Description NA - and verifies it. Records already verified or rejected, and every other
// category, are left alone. Each category has its own button.
const BULK_CATS = {
  SU: { key: "SU", category: "Shikshan Utsav (SU)", name: "Shikshan Utsav", btn: "awmAdmBulk" },
  NS: { key: "NS", category: "Nanhe Sitare (NS)",   name: "Nanhe Sitare",   btn: "awmAdmBulkNS" }
};
const BULK_AWARDED_BY = "District Education Officer";
const MONTH_NO = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

function isPendingOf(cat) {
  return function (r) {
    return String(r.awardCategory || "").trim() === cat.category && r.verified !== "Yes" && r.verified !== "Rejected";
  };
}

// "Aug-2026" -> { y: 2026, m: 8 }; a label that is not a month ("Pending 2025-26") -> null.
function parseMonth(label) {
  const p = String(label || "").split("-");
  const m = MONTH_NO[p[0]], y = parseInt(p[1], 10);
  return (m && y) ? { y: y, m: m } : null;
}
function two(n) { return (n < 10 ? "0" : "") + n; }
function driveFileId(url) { return (String(url || "").match(/[-\w]{25,}/) || [])[0] || ""; }

// The button shows only where there is something for it to do.
window.awmBulkRefresh = function () {
  const a = api();
  if (!a) return;
  const recs = a.records() || [];
  Object.keys(BULK_CATS).forEach(function (k) {
    const cat = BULK_CATS[k];
    const b = el(cat.btn);
    if (!b) return;
    const n = recs.filter(isPendingOf(cat)).length;
    b.hidden = !(isAdmin() && n);
    if (n) {
      // an icon, the words, and how many are waiting - so it catches the eye and says what it will do
      b.innerHTML = '<svg class="awm-bulk-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.500l2.800 2.800L16.500 9.500"/></svg>' +
        '<span>Verify ' + cat.key + ' awards</span><span class="awm-bulk-n">' + n + '</span>';
      b.title = n + " " + cat.name + " award" + (n === 1 ? "" : "s") + " waiting to be verified in this month";
    }
  });
};

// The pending records of one category, this month, this district, straight from the database.
async function pendingOf(cat, month, district) {
  const a = api();
  const out = [];
  let from = 0;
  const base = "award_records?select=id&month_label=eq." + encodeURIComponent(month) +
    "&district_name=eq." + encodeURIComponent(district) +
    "&award_category=eq." + encodeURIComponent(cat.category) + "&verified=eq.false" +
    (a.hasRejected() ? "&or=(rejected.eq.false,rejected.is.null)" : "") +
    "&order=id.asc&limit=1000";
  for (;;) {
    const part = await get(base + "&offset=" + from);
    part.forEach(r => out.push(r));
    if (part.length < 1000) break;
    from += 1000;
  }
  return out;
}

function ensureBulkModal() {
  if (el("awmBulkModal")) return;
  const m = document.createElement("div");
  m.id = "awmBulkModal";
  m.className = "pom-modal-overlay";
  m.innerHTML =
    '<div class="pom-modal-box awm-edit-box awm-bulk-box">' +
      '<div class="awm-bulk-head"><span class="awm-bulk-badge" id="awmBulkBadge">SU</span>' +
        '<div><div class="pom-modal-title" id="awmBulkTitle">Verify Shikshan Utsav awards</div>' +
        '<div class="awm-bulk-where" id="awmBulkWhere"></div></div></div>' +
      '<div class="awm-bulk-count"><b id="awmBulkN">…</b><span id="awmBulkNLab">awards to verify</span></div>' +
      '<div class="awm-bulk-lab">Each award will be set to</div>' +
      '<div class="awm-bulk-set">' +
        '<div><span>Awarded</span><b>Yes</b></div>' +
        '<div><span>Awarded by</span><b>' + esc(BULK_AWARDED_BY) + '</b></div>' +
        '<div><span>Description</span><b>NA</b></div>' +
        '<div><span>Status</span><b>Verified</b></div>' +
      '</div>' +
      '<div class="awm-bulk-grid">' +
        '<label class="awm-bulk-field"><span class="awm-bulk-lab">Date</span><input type="date" id="awmBulkDate"></label>' +
        '<label class="awm-bulk-field"><span class="awm-bulk-lab">Image <i>required</i></span><input type="file" id="awmBulkFile" accept="image/*"></label>' +
      '</div>' +
      '<img id="awmBulkPreview" class="awm-bulk-preview" alt="" hidden>' +
      '<p class="awm-bulk-note" id="awmBulkMsg"></p>' +
      '<p class="awm-bulk-fine" id="awmBulkFine">Only pending Shikshan Utsav awards of this month are changed. Awards already verified or rejected, and other categories, are left alone.</p>' +
      '<div class="pom-modal-actions"><button type="button" id="awmBulkCancel" class="pmbtn cancel">Cancel</button>' +
      '<button type="button" id="awmBulkGo" class="pmbtn primary" disabled>Verify</button></div>' +
    '</div>';
  (el("aw-view-award") || document.body).appendChild(m);
  el("awmBulkCancel").addEventListener("click", closeBulk);
  m.addEventListener("click", function (e) { if (e.target === m && !bulkBusy) closeBulk(); });
  el("awmBulkFile").addEventListener("change", onBulkFile);
  el("awmBulkDate").addEventListener("input", syncBulk);
  el("awmBulkGo").addEventListener("click", runBulk);
}

let bulk = null;          // { cat, month, district, list: [{id}], label, span: {min,max}|null }
let bulkBusy = false;

function closeBulk() {
  if (bulkBusy) return;
  const m = el("awmBulkModal");
  if (m) m.classList.remove("open");
  bulk = null;
}

function setBulkNote(text, bad) {
  const n = el("awmBulkMsg");
  n.textContent = text || "";
  n.classList.toggle("is-bad", !!bad);
}

function onBulkFile() {
  const f = el("awmBulkFile").files && el("awmBulkFile").files[0];
  const img = el("awmBulkPreview");
  if (f && /^image\//.test(f.type)) { img.src = URL.createObjectURL(f); img.hidden = false; } else { img.hidden = true; }
  syncBulk();
}

function syncBulk() {
  if (!bulk) return;
  const n = bulk.list.length;
  const date = el("awmBulkDate").value;
  const file = el("awmBulkFile").files && el("awmBulkFile").files[0];
  let why = "", bad = false;
  if (!n) { why = "There are no pending " + bulk.cat.name + " awards here."; bad = true; }
  else if (bulk.span && date && (date < bulk.span.min || date > bulk.span.max)) { why = "The date must be in " + bulk.label + "."; bad = true; }
  else if (!date) why = "Choose the date.";
  else if (!file) why = "Upload the image to continue.";
  setBulkNote(why, bad);
  const go = el("awmBulkGo");
  go.disabled = !!why;
  go.textContent = n ? ("Verify " + n + " award" + (n === 1 ? "" : "s")) : "Verify";
}

async function openBulk(cat) {
  const a = api();
  if (!isAdmin() || !a || !cat) return;
  const month = a.month(), district = a.district();
  if (!month || !district) return;
  if (a.isDirty()) {
    a.showToast("Save or undo your unsaved changes first, then try again.", "error");
    return;
  }
  ensureBulkModal();
  const pm = parseMonth(month);
  bulk = { cat: cat, month: month, district: district, list: [], label: month, span: null };
  el("awmBulkBadge").textContent = cat.key;
  el("awmBulkTitle").textContent = "Verify " + cat.name + " awards";
  el("awmBulkFine").textContent = "Only pending " + cat.name + " awards of this month are changed. Awards already verified or rejected, and other categories, are left alone.";
  if (pm) {
    const last = new Date(pm.y, pm.m, 0).getDate();
    bulk.span = { min: pm.y + "-" + two(pm.m) + "-01", max: pm.y + "-" + two(pm.m) + "-" + two(last) };
  }
  el("awmBulkWhere").textContent = district + " · " + month;
  el("awmBulkN").textContent = "…";
  el("awmBulkNLab").textContent = "counting the awards";
  const dateEl = el("awmBulkDate");
  dateEl.value = pm ? (pm.y + "-" + two(pm.m) + "-15") : "";      // the 15th of the month, to change if needed
  dateEl.min = bulk.span ? bulk.span.min : "";
  dateEl.max = bulk.span ? bulk.span.max : "";
  el("awmBulkFile").value = "";
  el("awmBulkPreview").hidden = true;
  setBulkNote("", false);
  el("awmBulkGo").disabled = true;
  el("awmBulkGo").textContent = "Verify";
  el("awmBulkModal").classList.add("open");
  try {
    bulk.list = await pendingOf(cat, month, district);
    el("awmBulkN").textContent = String(bulk.list.length);
    el("awmBulkNLab").textContent = bulk.list.length === 1 ? "award to verify" : "awards to verify";
    syncBulk();
  } catch (e) {
    console.error("Could not count the pending " + cat.key + " awards:", e);
    setBulkNote("Could not load the awards. Close this and try again.", true);
  }
}

async function runBulk() {
  const a = api();
  if (!isAdmin() || !a || !bulk || bulkBusy) return;
  const list = bulk.list;
  const file = el("awmBulkFile").files[0];
  const date = el("awmBulkDate").value;
  if (!list.length || !file || !date) return;

  bulkBusy = true;
  const go = el("awmBulkGo");
  go.disabled = true; el("awmBulkCancel").disabled = true;
  try {
    setBulkNote("Uploading the image…", false);
    const url = await a.uploadSharedImage(file, bulk.month, bulk.district);

    const now = new Date().toISOString();
    const body = {
      awarded: true, awarded_by: BULK_AWARDED_BY, awarded_date: date,
      image_url: url, drive_file_id: driveFileId(url) || null, uploaded_by: who() || null,
      description: "NA", verified: true, verified_by: who() || null, updated_at: now
    };
    if (a.hasRejected()) body.rejected = false;

    let done = 0, skipped = 0;
    const doneIds = [];
    const ids = list.map(r => r.id);
    for (const part of chunks(ids, CHUNK)) {
      setBulkNote("Verifying… " + done + " of " + ids.length, false);
      // The database applies the filter, so a record verified meanwhile is skipped, never overwritten.
      const got = await call("PATCH", "award_records?id=" + inList(part) + "&verified=eq.false&select=id", body, "return=representation");
      got.forEach(r => doneIds.push(r.id));
      done += got.length;
      skipped += part.length - got.length;
    }

    // Every change is written down, as for a single record.
    const catName = bulk.cat.name;
    const note = "Bulk verify of " + catName + " awards, " + bulk.district + ", " + bulk.month + ", dated " + date;
    for (const part of chunks(doneIds, 200)) {
      await call("POST", "award_record_events", part.map(id => ({
        record_id: id, action: "verified (bulk)", by_email: who() || null,
        by_name: (window.__olfUser && window.__olfUser.name) || null, note: note
      })), "return=minimal").catch(function (e) { console.warn("Could not log some of the changes:", e); });
    }

    bulkBusy = false;
    closeBulk();
    await a.refresh();
    a.showToast(done + " " + catName + " award" + (done === 1 ? "" : "s") + " verified" + (skipped ? " (" + skipped + " skipped: already verified)" : "") + ".");
  } catch (e) {
    console.error("Bulk verify failed:", e);
    bulkBusy = false;
    go.disabled = false;
    setBulkNote("Stopped: " + String((e && e.message) || e).slice(0, 160) + ". Awards already verified stay verified; open this again for the rest.", true);
    try { await a.refresh(); } catch (ignore) {}
  } finally {
    el("awmBulkCancel").disabled = false;
  }
}

// ── Start ──
window.awmAdminInit = function () {
  if (!isAdmin()) return;
  const wrap = el("awmDetailWrap");
  if (wrap && !el("awmAdminBar")) {
    const bar = document.createElement("div");
    bar.id = "awmAdminBar";
    bar.className = "awm-adminbar";
    bar.innerHTML = '<span class="awm-adm-tag">IT admin</span>' +
      '<button type="button" id="awmAdmBulk" class="awm-adm-btn go" hidden>Verify SU awards…</button>' +
      '<button type="button" id="awmAdmBulkNS" class="awm-adm-btn go" hidden>Verify NS awards…</button>' +
      '<span class="awm-adminbar-gap"></span>' +
      '<button type="button" id="awmAdmUploads" class="awm-adm-btn">All uploads</button>' +
      '<button type="button" id="awmAdmTrash" class="awm-adm-btn">Deleted records</button>';
    const card = wrap.querySelector(".pom-card");
    wrap.insertBefore(bar, card);
    el("awmAdmTrash").addEventListener("click", openTrash);
    el("awmAdmUploads").addEventListener("click", openUploads);
    el("awmAdmBulk").addEventListener("click", function () { openBulk(BULK_CATS.SU); });
    el("awmAdmBulkNS").addEventListener("click", function () { openBulk(BULK_CATS.NS); });
  }
  if (typeof window.awmBulkRefresh === "function") window.awmBulkRefresh();
};

// The Add records window links here.
window.awmOpenPastUploads = openUploads;

})();
