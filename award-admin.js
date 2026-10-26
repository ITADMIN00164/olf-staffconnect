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

// ── Start ──
window.awmAdminInit = function () {
  if (!isAdmin()) return;
  const wrap = el("awmDetailWrap");
  if (wrap && !el("awmAdminBar")) {
    const bar = document.createElement("div");
    bar.id = "awmAdminBar";
    bar.className = "awm-adminbar";
    bar.innerHTML = '<span class="awm-adm-tag">IT admin</span>' +
      '<span class="awm-adminbar-gap"></span>' +
      '<button type="button" id="awmAdmUploads" class="awm-adm-btn">All uploads</button>' +
      '<button type="button" id="awmAdmTrash" class="awm-adm-btn">Deleted records</button>';
    const card = wrap.querySelector(".pom-card");
    wrap.insertBefore(bar, card);
    el("awmAdmTrash").addEventListener("click", openTrash);
    el("awmAdmUploads").addEventListener("click", openUploads);
  }
};

// The Add records window links here.
window.awmOpenPastUploads = openUploads;

})();
