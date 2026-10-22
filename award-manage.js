/* award-manage.js - the Award Management view of the Test tab.

   A copy of the one on the POM page, kept apart from pom.js so the two can be
   changed separately: everything lives inside this function, the handlers its
   markup calls are prefixed awm, and its elements carry awm ids. It reads and
   writes the same award data through the same service. */
(function () {

const API_URL =
  "https://script.google.com/macros/s/AKfycbxTITLCE-CwfLLW9p5nwf7Tziy2xNj7oQtsctbVmG8C4toadIGq5x63qR4w17ZluZXt/exec";

const VERIFIER_COLLECTION = "verifier";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBmqPjry4Jz0WbETT8ZS6VJX6m-tdhyEFI",
  authDomain: "olf-staff-connect-b1d54.firebaseapp.com",
  projectId: "olf-staff-connect-b1d54",
  storageBucket: "olf-staff-connect-b1d54.firebasestorage.app",
  messagingSenderId: "820294263204",
  appId: "1:820294263204:web:6eef8a42bdad524debe131"
};

const AWARDED_BY_OPTIONS = [
  "DIET Officer", "Cluster", "Block Extension Officer", "Extension Officer",
  "District Education Officer", "Block Education Officer", "Headmaster",
  "Dy. CEO", "CEO", "Dy. Collector", "Collector", "MLA", "MP",
  "Edu. Minister", "Chief Minister", "Prime Minister", "President", "Governor","Additional Tribal Commissioner","Additional Collector / Project Officer","Project Officer","Assistant Project officer"
];

const UPLOAD_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
const EYE_SVG    = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const PENCIL_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const CHECK_SVG  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const SAVE_SVG   = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
const X_SVG      = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

// ── State ──
let currentRecords = [];
let allMonths = [];
let monthCache = {};
let selectedMonth = "";
let isVerifier = false;
let dirty = false;          // unsaved edits in the open month
let resolvedEmail = "";     // email resolved via Firebase Auth fallback
const LOCK_MSG = "This record is locked after verification. Please contact admin if you want to edit it again.";

function currentUser() {
  const u = window.__olfUser;
  return (u && (u.email || u.name)) || resolvedEmail || "";
}

// ===============================
// UI: loader, toasts, modal (no browser popups)
// ===============================
function showLoader() { document.getElementById("awmLoader").classList.add("open"); }
function hideLoader() { document.getElementById("awmLoader").classList.remove("open"); }

function showToast(message, type = "success") {
  const wrap = document.getElementById("awmToasts");
  if (!wrap) return;
  const t = document.createElement("div");
  t.className = "pom-toast " + type;
  t.textContent = message;
  wrap.appendChild(t);
  setTimeout(() => { t.classList.add("hide"); setTimeout(() => t.remove(), 300); }, 3000);
}

function showModal({ title, message, buttons }) {
  return new Promise(resolve => {
    const overlay = document.getElementById("awmModal");
    document.getElementById("awmModalTitle").textContent = title || "";
    document.getElementById("awmModalMsg").textContent = message || "";
    const actions = document.getElementById("awmModalActions");
    actions.innerHTML = "";
    buttons.forEach(b => {
      const el = document.createElement("button");
      el.className = "pmbtn " + (b.variant || "cancel");
      el.textContent = b.label;
      el.onclick = () => { overlay.classList.remove("open"); resolve(b.value); };
      actions.appendChild(el);
    });
    overlay.classList.add("open");
  });
}

function confirmOverride() {
  return showModal({
    title: "Image already exists",
    message: "An image already exists for this record. Override it? The current image will be deleted.",
    buttons: [
      { label: "Cancel", value: false, variant: "cancel" },
      { label: "Override", value: true, variant: "danger" }
    ]
  });
}

function confirmUnsaved() {
  return showModal({
    title: "Unsaved changes",
    message: "You have unsaved changes. They’ll be lost if you leave without saving.",
    buttons: [
      { label: "Cancel", value: "cancel", variant: "cancel" },
      { label: "Discard", value: "discard", variant: "danger" },
      { label: "Save & Leave", value: "save", variant: "primary" }
    ]
  });
}

// ===============================
// VERIFIER STATUS (Firestore)
// ===============================
async function loadVerifierStatus() {
  try {
    const [appMod, fsMod, authMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js")
    ]);
    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FIREBASE_CONFIG);

    // Resolve the signed-in email: prefer window.__olfUser, else wait for Auth state.
    let email = currentUser();
    if (!email) {
      const auth = authMod.getAuth(app);
      email = await new Promise(resolve => {
        if (auth.currentUser) return resolve(auth.currentUser.email || "");
        const unsub = authMod.onAuthStateChanged(auth, u => { unsub(); resolve(u ? (u.email || "") : ""); });
        setTimeout(() => resolve(auth.currentUser ? (auth.currentUser.email || "") : ""), 3000);
      });
      resolvedEmail = email;
    }

    const db = fsMod.getFirestore(app);
    const snap = await fsMod.getDocs(fsMod.collection(db, VERIFIER_COLLECTION));
    const me = (email || "").trim().toLowerCase();
    isVerifier = snap.docs.some(d => String(d.data().Email || "").trim().toLowerCase() === me);
    console.log("POM verifier check:", me || "(no email)", "→", isVerifier);
  } catch (e) {
    console.error("Verifier check failed:", e);
    isVerifier = false;
  }
}

// ===============================
// LOAD FILTERS (district only)
// ===============================
async function loadFilters() {
  // Re-query by id each time: initPomPageUI replaces the <select> (to rebind its
  // change handler), so a cached reference would point at a detached element.
  const dd0 = document.getElementById("awmDistrict");
  if (dd0) { dd0.disabled = true; dd0.innerHTML = '<option>⏳ Loading districts…</option>'; }
  try {
    const res = await fetch(`${API_URL}?action=getFilters`);
    const data = await res.json();
    // Month order used by every page: labels that are not a month
    // (e.g. "Pending 2025-26") come first, in name order; real months
    // follow in calendar order.
    allMonths = (data.months || []).slice().sort(function (a, b) {
      function key(x) {
        var p = String(x || "").split("-");
        var mi = MONTHS[p[0]], yr = parseInt(p[1], 10);
        return (mi == null || isNaN(yr)) ? -1 : yr * 12 + mi;
      }
      var ka = key(a), kb = key(b);
      if (ka === -1 && kb === -1) return String(a).localeCompare(String(b));
      return ka - kb;
    });
    const dd = document.getElementById("awmDistrict");
    if (dd) {
      dd.innerHTML =
        '<option value="">Select District</option>' +
        (data.districts || []).map(d => `<option value="${d}">${d}</option>`).join("");
      dd.disabled = false;
    }
  } catch (e) {
    console.error(e);
    const dd = document.getElementById("awmDistrict");
    if (dd) { dd.innerHTML = '<option value="">Failed to load — reopen page</option>'; dd.disabled = false; }
    showToast("Failed to load districts.", "error");
  }
}

// Re-pull one month from the server (authoritative) and refresh the cache.
async function refetchMonth(month) {
  const district = document.getElementById("awmDistrict").value;
  const res = await fetch(
    `${API_URL}?action=getRecords&month=${encodeURIComponent(month)}&district=${encodeURIComponent(district)}`
  );
  const recs = await res.json();
  monthCache[month] = Array.isArray(recs) ? recs : [];
}

// Pull the current month's authoritative records WITHOUT touching the cache.
// Used by every mutating action to check the live situation before acting, so a
// stale page can't verify/edit/erase something that changed underneath it.
async function getFreshRecords() {
  const district = document.getElementById("awmDistrict").value;
  const res = await fetch(
    `${API_URL}?action=getRecords&month=${encodeURIComponent(selectedMonth)}&district=${encodeURIComponent(district)}`
  );
  const recs = await res.json();
  return Array.isArray(recs) ? recs : [];
}

// ===============================
// LOAD DISTRICT SUMMARY
// ===============================
async function loadDistrictSummary() {
  const district = document.getElementById("awmDistrict").value;

  monthCache = {};
  selectedMonth = "";
  currentRecords = [];
  dirty = false;
  resetDetail("Select a month above to view records");

  const body = document.getElementById("awmMonthBody");
  showList();

  if (!district) {
    body.innerHTML = `<tr><td colspan="8" class="pom-msg">Select a District to begin</td></tr>`;
    return;
  }

  body.innerHTML = `<tr><td colspan="8" class="pom-msg">Loading…</td></tr>`;
  showLoader();

  try {
    await Promise.all(
      allMonths.map(async (m) => {
        const res = await fetch(
          `${API_URL}?action=getRecords&month=${encodeURIComponent(m)}&district=${encodeURIComponent(district)}`
        );
        const recs = await res.json();
        monthCache[m] = Array.isArray(recs) ? recs : [];
      })
    );
    renderMonthTable();
  } catch (e) {
    console.error(e);
    body.innerHTML = `<tr><td colspan="8" class="pom-msg error">Failed to load months. Try again.</td></tr>`;
    showToast("Failed to load months.", "error");
  } finally {
    hideLoader();
  }
}

// ===============================
// MONTH SUMMARY TABLE
// ===============================
const MONTHS = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };

function monthEnd(label) {
  const [mon, yr] = String(label).split("-");
  const mi = MONTHS[mon];
  if (mi == null || !yr) return null;
  return new Date(Number(yr), mi + 1, 0);
}

function isLate(record, month) {
  if (record.awarded !== "Yes") return false;
  const d = formatDate(record.awardedDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return false;
  const end = monthEnd(month);
  return end ? new Date(d) > end : false;
}

function counts(records, month) {
  const total = records.length;
  const late = records.filter(r => isLate(r, month)).length;
  const awarded = records.filter(r => r.awarded === "Yes" && !isLate(r, month)).length;
  const verified = records.filter(r => r.verified === "Yes").length;
  const totalAwarded = awarded + late;
  return { total, awarded, late, verified, totalAwarded, pending: total - awarded - late };
}

function renderMonthTable() {
  const body = document.getElementById("awmMonthBody");
  const months = allMonths.filter(m => (monthCache[m] || []).length);

  if (!months.length) {
    body.innerHTML = `<tr><td colspan="8" class="pom-msg">No records for this district.</td></tr>`;
    return;
  }

  body.innerHTML = months.map(m => {
    const c = counts(monthCache[m], m);
    return `
      <tr class="month-row" data-month="${m}">
        <td class="m-name">${m}</td>
        <td>${c.total}</td>
        <td class="ok">${c.awarded}</td>
        <td class="late">${c.late}</td>
        <td class="warn">${c.pending}</td>
        <td class="tot-aw">${c.totalAwarded}</td>
        <td class="vok">${c.verified}</td>
        <td class="chev">›</td>
      </tr>`;
  }).join("");

  body.querySelectorAll(".month-row").forEach(row =>
    row.addEventListener("click", () => selectMonth(row.dataset.month))
  );
}

function updateMonthRow(month) {
  const row = document.querySelector(`.month-row[data-month="${month}"]`);
  if (!row) return;
  const c = counts(monthCache[month] || currentRecords, month);
  row.children[1].textContent = c.total;
  row.children[2].textContent = c.awarded;
  row.children[3].textContent = c.late;
  row.children[4].textContent = c.pending;
  row.children[5].textContent = c.totalAwarded;
  row.children[6].textContent = c.verified;
}

// ===============================
// VIEW TOGGLE + unsaved guard
// ===============================
function showList() {
  document.getElementById("awmDetailWrap").style.display = "none";
  document.getElementById("awmListView").style.display = "flex";
  document.querySelectorAll(".month-row").forEach(r => r.classList.remove("active"));
  selectedMonth = "";
  window.scrollTo(0, 0);
}

async function handleBack() {
  if (dirty) {
    const choice = await confirmUnsaved();
    if (choice === "cancel") return;
    if (choice === "save") { await saveRecords(); }
    // "discard" or after save → fall through and leave
  }
  dirty = false;
  showList();
}

async function refreshRecords() {
  if (!selectedMonth) return;
  if (dirty) {
    const choice = await showModal({
      title: "Refresh records?",
      message: "Refreshing will discard your unsaved changes and load the latest data.",
      buttons: [
        { label: "Cancel", value: "cancel", variant: "cancel" },
        { label: "Discard & Refresh", value: "go", variant: "danger" }
      ]
    });
    if (choice !== "go") return;
  }
  showLoader();
  try {
    await refetchMonth(selectedMonth);
    currentRecords = monthCache[selectedMonth];
    markExisting(currentRecords);
    dirty = false;
    renderTable();
    updateMonthRow(selectedMonth);
    showToast("Records refreshed.");
  } catch (e) {
    console.error(e);
    showToast("Failed to refresh records.", "error");
  } finally {
    hideLoader();
  }
}

function syncDetailSelects() {
  // Populate detail district dropdown from the list view district
  const listDistrict = document.getElementById("awmDistrict");
  const detailDistrict = document.getElementById("awmDetailDistrict");
  if (!detailDistrict || !listDistrict) return;

  // Copy all options from list-view select into detail select
  detailDistrict.innerHTML = listDistrict.innerHTML;
  detailDistrict.value = listDistrict.value;

  // Populate month dropdown from available months (those with records)
  const detailMonth = document.getElementById("awmDetailMonth");
  if (!detailMonth) return;
  const availMonths = allMonths.filter(m => (monthCache[m] || []).length);
  detailMonth.innerHTML = availMonths
    .map(m => `<option value="${m}">${m}</option>`)
    .join("");
  detailMonth.value = selectedMonth;
}

function selectMonth(month) {
  selectedMonth = month;
  currentRecords = monthCache[month] || [];
  markExisting(currentRecords);
  dirty = false;
  document.querySelectorAll(".month-row").forEach(r =>
    r.classList.toggle("active", r.dataset.month === month)
  );
  document.getElementById("awmListView").style.display = "none";
  document.getElementById("awmDetailWrap").style.display = "flex";
  window.scrollTo(0, 0);
  syncDetailSelects();
  renderTable();
}

// True when a record has a saved entry in Awarded Data. A record merged from
// getRecords has only default values when it ISN'T there, so any non-default
// app-owned field means it exists.
function recInAwardedData(r) {
  return !!(
    r.awarded === "Yes" || r.awardedBy || r.awardedDate ||
    r.folderLink || r.uploadedBy || r.description || r.verified === "Yes"
  );
}

// Stable identity for matching the same row across a fresh re-fetch.
function recKey(r) {
  return [r.mobile, r.fullName, r.awardName, r.schoolName]
    .map(x => String(x || "").trim().toLowerCase()).join("¦");
}

// Snapshot which records currently have a saved entry in Awarded Data, and reset
// their per-row dirty flag. Used to decide when flipping a row to "No" should
// delete its saved data.
function markExisting(records) {
  (records || []).forEach(r => {
    r._existed = recInAwardedData(r);
    r._dirty = false;   // freshly loaded from the server ⇒ in sync
  });
}

// ===============================
// ROW COMPLETENESS (mandatory: Awarded=Yes + Awarded By + Date + Image + Description)
// ===============================
function rowHasBy(r)   { return !!(r.awardedBy && String(r.awardedBy).trim()); }
function rowHasDate(r) { return /^\d{4}-\d{2}-\d{2}$/.test(formatDate(r.awardedDate) || ""); }
function rowHasImg(r)  { return !!r.folderLink; }
function rowHasDesc(r) { return !!String(r.description || "").trim(); }

// A row is "complete" (all mandatory fields present) and thus saveable on its own.
function rowComplete(r) {
  return r.awarded === "Yes" && rowHasBy(r) && rowHasDate(r) && rowHasImg(r) && rowHasDesc(r);
}

// A row the user is actively awarding but hasn't finished — blocks "Save All".
function rowIncompleteYes(r) {
  return r.verified !== "Yes" && r.awarded === "Yes" && !rowComplete(r);
}

// List the mandatory fields still missing on a Yes row (for error messages).
function rowMissingFields(r) {
  const missing = [];
  if (!rowHasBy(r))   missing.push("Awarded By");
  if (!rowHasDate(r)) missing.push("Date");
  if (!rowHasImg(r))  missing.push("Image");
  if (!rowHasDesc(r)) missing.push("Description");
  return missing;
}

// Keep the global `dirty` flag in sync with per-row `_dirty` markers.
function recomputeDirty() {
  dirty = (currentRecords || []).some(r => r._dirty);
}

// ===============================
// DETAIL TABLE
// ===============================
function awardedByOptions(value) {
  const opts = AWARDED_BY_OPTIONS.includes(value) || !value
    ? AWARDED_BY_OPTIONS
    : [value, ...AWARDED_BY_OPTIONS];
  return `<option value="">— Select —</option>` +
    opts.map(o => `<option value="${o}" ${o === value ? "selected" : ""}>${o}</option>`).join("");
}

function nameFromEmail(emailOrName) {
  if (!emailOrName) return "";
  // If it already looks like a plain name (no @), return as-is
  if (!emailOrName.includes("@")) return emailOrName;
  const local = emailOrName.split("@")[0];                // e.g. "onkar.kale"
  return local.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function renderImageCell(index, justUploaded, locked) {
  const rec = currentRecords[index];
  const has = !!rec.folderLink;
  let uploadCtl;
  if (isVerifier)      uploadCtl = "";           // verifier is view-only — no upload
  else if (locked)     uploadCtl = `<button class="icon-btn" disabled title="${LOCK_MSG}">${UPLOAD_SVG}</button>`;
  else                 uploadCtl = `<label class="icon-btn" title="Upload image">${UPLOAD_SVG}
         <input type="file" accept="image/*" style="display:none" onchange="awmUploadImage(${index}, this.files[0])">
       </label>`;
  const uploaderName = nameFromEmail(rec.uploadedBy || "");
  return `
    ${uploadCtl}
    <button class="icon-btn" title="View image" ${has ? "" : "disabled"} onclick="awmViewImage(${index})">${EYE_SVG}</button>
    ${justUploaded ? '<span class="img-status ok">Uploaded</span>' : ""}
    ${uploaderName ? `<span class="cell-sublabel" title="${rec.uploadedBy}">${uploaderName}</span>` : ""}`;
}

function renderDescCell(index, locked) {
  const has = !!String(currentRecords[index].description || "").trim();
  let editCtl;
  if (isVerifier)      editCtl = "";             // verifier is view-only — no edit
  else if (locked)     editCtl = `<button class="icon-btn" disabled title="${LOCK_MSG}">${PENCIL_SVG}</button>`;
  else                 editCtl = `<button class="icon-btn" title="Write description" onclick="awmEditDescription(${index})">${PENCIL_SVG}</button>`;
  return `${editCtl}<button class="icon-btn" title="View description" ${has ? "" : "disabled"} onclick="awmViewDescription(${index})">${EYE_SVG}</button>`;
}

function renderVerifyCell(index) {
  const r = currentRecords[index];
  const who = (email) => {
    const n = nameFromEmail(email || "");
    return n ? `<span class="cell-sublabel" title="${email}">${n}</span>` : "";
  };

  if (r.verified === "Yes")
    return `<span class="verified-badge">${CHECK_SVG} Verified</span>${who(r.verifiedBy)}`;
  if (r.verified === "Rejected")
    return `<span class="rejected-badge">${X_SVG} Rejected</span>${who(r.verifiedBy)}`;

  // Pending: only meaningful once the record is actually in Awarded Data
  // (awarded = Yes with an uploaded image).
  const submitted = r.awarded === "Yes" && r.folderLink;
  if (!submitted)
    return isVerifier ? `<span class="verify-na" title="Nothing to verify">—</span>` : "";

  if (isVerifier) {
    const sub = nameFromEmail(r.uploadedBy || "");
    const tip = sub ? `Submitted by ${sub} — verify or reject` : "Verify or reject";
    return `<span class="vr-actions" title="${tip}">`
      + `<button class="vr-btn approve" title="Verify" onclick="awmVerifyRecord(${index})">${CHECK_SVG}</button>`
      + `<button class="vr-btn reject" title="Reject" onclick="awmRejectRecord(${index})">${X_SVG}</button>`
      + `</span>`;
  }
  // Data-entry user: show the submitted status.
  return `<span class="submitted-badge">Submitted</span>${who(r.uploadedBy)}`;
}

// Per-row Save control.
//  • Awarded = Yes: solid ("ready") when all mandatory fields are filled; outlined
//    while something's missing (clicking explains what); "Saved" once persisted
//    with no pending edits. Editing a saved row flips it back to a Save button.
//  • Awarded = No on a row that was previously saved: a red Save button that, on
//    click, confirms erasing that user's saved data. Rows never saved show nothing.
function renderRowSaveCell(index) {
  const r = currentRecords[index];
  if (isVerifier)           return "";          // verifier is view-only — cannot save
  if (r.verified === "Yes") return "";          // verified → locked (rejected rows stay editable)

  if (r.awarded !== "Yes") {
    // Only offer an action if there is saved data to erase and the user changed it.
    if (r._existed && r._dirty) {
      return `<button class="rowsave-btn danger" title="Erase this user's saved data" onclick="awmSaveSingleRecord(${index})">${SAVE_SVG}Save</button>`;
    }
    return "";                                  // nothing awarded, nothing to save/erase
  }

  const complete = rowComplete(r);
  if (complete && r._existed && !r._dirty) {
    if (r.verified === "Rejected") return "";   // rejected & untouched → edit to resubmit (status shown in Verify column)
    return `<span class="rowsave-saved" title="This record is saved">${CHECK_SVG} Saved</span>`;
  }
  const cls = complete ? "rowsave-btn ready" : "rowsave-btn";
  const title = complete
    ? "Save this record"
    : "Fill Awarded By, Date, Image and Description, then save";
  return `<button class="${cls}" title="${title}" onclick="awmSaveSingleRecord(${index})">${SAVE_SVG}Save</button>`;
}

// Re-render just one row's Save cell (used after inline edits, without a full table redraw).
function refreshRowControls(index) {
  const cell = document.getElementById("rowsave-" + index);
  if (cell) cell.innerHTML = renderRowSaveCell(index);
}

// Show the "Save All Changes" bar only when there is something to commit:
// at least one complete-but-unsaved row, or a previously-saved row flipped to "No".
function updateSaveAllBar() {
  const bar = document.getElementById("awmSaveBar");
  if (!bar) return;
  if (isVerifier) { bar.style.display = "none"; return; }   // verifier is view-only
  const recs = currentRecords || [];
  const anyUnsavedComplete = recs.some(r => r.verified !== "Yes" && rowComplete(r) && (r._dirty || !r._existed));
  const anyPendingDelete   = recs.some(r => r._existed && r.awarded === "No" && r.verified !== "Yes");
  bar.style.display = (anyUnsavedComplete || anyPendingDelete) ? "block" : "none";
}

function renderTable() {
  const tbody = document.getElementById("awmTableBody");

  if (!currentRecords || currentRecords.length === 0) {
    resetDetail("No Records Found");
    return;
  }

  tbody.innerHTML = currentRecords.map((r, i) => {
    const locked   = r.verified === "Yes";       // verified → locked for the user
    const viewOnly = locked || isVerifier;        // editing controls disabled (verified row, or verifier)
    const dis = viewOnly ? "disabled" : "";
    const lt  = locked ? `title="${LOCK_MSG}"` : (isVerifier ? `title="View only — verifier access"` : "");
    return `
    <tr class="${locked ? "locked-row" : ""}" ${lt}>
      <td class="name-cell">
        <div class="nc-name">${r.fullName || ""}</div>
        <div class="nc-sub">${r.mobile || ""}${r.mobile && r.schoolName ? " · " : ""}${r.schoolName || ""}</div>
      </td>
      <td class="award-col">${r.awardName || ""}</td>
      <td>
        <select class="award-select" ${dis} ${lt} onchange="awmUpdateField(${i},'awarded',this.value)">
          <option value="No"  ${r.awarded === "No"  ? "selected" : ""}>No</option>
          <option value="Yes" ${r.awarded === "Yes" ? "selected" : ""}>Yes</option>
        </select>
      </td>
      <td>
        <select class="award-select" ${dis} ${lt} onchange="awmUpdateField(${i},'awardedBy',this.value)">
          ${awardedByOptions(r.awardedBy || "")}
        </select>
      </td>
      <td ${lt}><input type="date" class="award-input date-compact" ${dis} value="${formatDate(r.awardedDate)}" onchange="awmUpdateField(${i},'awardedDate',this.value)"></td>
      <td class="img-cell" id="imgcell-${i}">${renderImageCell(i, false, viewOnly)}</td>
      <td class="img-cell" id="desccell-${i}">${renderDescCell(i, viewOnly)}</td>
      <td class="col-center" id="rowsave-${i}">${renderRowSaveCell(i)}</td>
      <td class="verify-cell col-center" id="verify-${i}">${renderVerifyCell(i)}</td>
      <td class="col-center" id="unlock-${i}">${locked && isVerifier ? `<button class="unlock-btn" onclick="awmUnlockRecord(${i})">Unlock</button>` : ""}</td>
    </tr>`;
  }).join("");

  updateSaveAllBar();
}

function resetDetail(msg) {
  document.getElementById("awmTableBody").innerHTML =
    `<tr><td colspan="10" style="text-align:center;color:#9ca3af;padding:28px;">${msg}</td></tr>`;
  updateSaveAllBar();
}

window.awmUpdateField = function (index, field, value) {
  currentRecords[index][field] = value;
  currentRecords[index]._dirty = true;
  dirty = true;
  if ((field === "awarded" || field === "awardedDate") && selectedMonth) updateMonthRow(selectedMonth);
  refreshRowControls(index);
  updateSaveAllBar();
};

// ===============================
// IMAGE UPLOAD / VIEW
// ===============================
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function driveId(url) {
  return (String(url || "").match(/[-\w]{25,}/) || [])[0] || "";
}

window.awmUploadImage = async function (index, file) {
  if (!file) return;
  const cell = document.getElementById("imgcell-" + index);
  const rec  = currentRecords[index];

  // Guard: this record may have been verified (locked) since the page loaded.
  // Check Awarded Data BEFORE uploading anything, so a stale page can't push a new
  // image to Drive for a locked record (which could never be saved anyway).
  cell.innerHTML = '<span class="img-status">⏳ Checking…</span>';
  try {
    const fresh = await getFreshRecords();
    const match = fresh.find(f => recKey(f) === recKey(rec));
    if (match && match.verified === "Yes") {          // verified elsewhere → locked
      adoptFreshInto(rec, match);
      if (selectedMonth) { monthCache[selectedMonth] = currentRecords; updateMonthRow(selectedMonth); }
      recomputeDirty();
      renderTable();                                  // lock the row to match reality
      await showModal({
        title: "Record is locked",
        message: `This record was verified by ${nameFromEmail(match.verifiedBy) || "a verifier"} and is locked, so a new image can't be uploaded. The latest status is now shown.`,
        buttons: [{ label: "OK", value: true, variant: "primary" }]
      });
      return;
    }
  } catch (e) {
    console.error(e);
    cell.innerHTML = renderImageCell(index);
    showToast("Couldn't reach the server. Try again.", "error");
    return;
  }

  const existingUrl = rec.folderLink;
  if (existingUrl) {
    const ok = await confirmOverride();
    if (!ok) { cell.innerHTML = renderImageCell(index); return; } // Cancel → keep old image
  }

  cell.innerHTML = '<span class="img-status">⏳ Uploading…</span>';
  try {
    const dataUrl = await fileToBase64(file);
    const ext = (file.name.match(/\.[a-z0-9]+$/i) || [".jpg"])[0];
    const safeName = (currentRecords[index].fullName || "image").replace(/[^\w]+/g, "_");

    const payload = {
      action: "uploadImage",
      month: selectedMonth.replace("-", " ").toUpperCase(),
      district: document.getElementById("awmDistrict").value,
      fileName: `${safeName}_${Date.now()}${ext}`,
      mimeType: file.type || "image/jpeg",
      data: dataUrl.split(",")[1],
      replaceId: driveId(existingUrl)
    };

    const res = await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });
    const out = await res.json();
    if (!out.success) throw new Error(out.error || "Upload failed");

    currentRecords[index].folderLink = out.url;
    currentRecords[index].uploadedBy = currentUser();
    currentRecords[index]._dirty = true;      // image is on Drive but NOT yet written to the record — user must Save
    cell.innerHTML = renderImageCell(index, true, false);
    refreshRowControls(index);                // row now shows its Save button (not "Saved")
    updateSaveAllBar();

    if (payload.replaceId && out.deletedOld === false) {
      console.warn("Old image not deleted. replaceId:", payload.replaceId, "error:", out.deleteError);
      const reason = (out.deleteError || "unknown reason").replace(/^Exception:\s*/, "").slice(0, 150);
      showToast("Old image not deleted — " + reason, "error");
    } else {
      showToast("Image uploaded.");
    }
  } catch (e) {
    console.error(e);
    cell.innerHTML = renderImageCell(index) + '<span class="img-status error">Failed — retry</span>';
    showToast("Image upload failed.", "error");
  }
};

// ===============================
// IMAGE VIEW
// ===============================

window.awmViewImage = function (index) {
  const url = currentRecords[index].folderLink;
  if (!url) return;
  const id    = driveId(url);
  const img   = document.getElementById("awmImgEl");
  const modal = document.getElementById("awmImgModal");
  const fb    = document.getElementById("awmImgFallback");
  const ld    = document.getElementById("awmImgLoading");

  // Reset modal state
  if (fb) fb.style.display = "none";
  if (ld) ld.style.display = "flex";
  img.style.display = "none";
  modal.classList.add("open");

  img.onload = function () {
    if (ld) ld.style.display = "none";
    img.style.display = "";
  };

  if (!id) { img.onerror = null; img.src = url; return; }

  // Drive image embedding is finicky and depends on each file's sharing, so we
  // try several forms in order. The last data source is the Apps Script proxy,
  // which returns the bytes itself (works even when the file isn't public).
  const steps = [
    () => { img.src = `https://lh3.googleusercontent.com/d/${id}=w1600`; },
    () => { img.src = `https://drive.google.com/thumbnail?id=${id}&sz=w1600`; },
    () => {
      // Server proxy (needs the getImage action in Code.gs). Returns a data URL.
      fetch(`${API_URL}?action=getImage&id=${encodeURIComponent(id)}`)
        .then(r => r.json())
        .then(out => { if (out && out.success && out.dataUrl) img.src = out.dataUrl; else advance(); })
        .catch(advance);
    },
    () => {
      // Everything failed → show a link instead of a broken icon.
      if (ld) ld.style.display = "none";
      img.style.display = "none";
      if (fb) {
        const a = fb.querySelector("a");
        if (a) a.href = `https://drive.google.com/file/d/${id}/view`;
        fb.style.display = "flex";
      }
    }
  ];

  let step = 0;
  function advance() {
    if (step >= steps.length) return;
    steps[step++]();
  }
  img.onerror = advance;   // each failed load moves to the next source
  advance();               // start with the first source
};

function closeImageModal() {
  document.getElementById("awmImgModal").classList.remove("open");
  const img = document.getElementById("awmImgEl");
  if (img) { img.onerror = null; img.onload = null; img.src = ""; img.style.display = ""; }
  const fb = document.getElementById("awmImgFallback");
  if (fb) fb.style.display = "none";
  const ld = document.getElementById("awmImgLoading");
  if (ld) ld.style.display = "none";
}

// ── Description: edit (popup textbox) + view ──
function showPrompt(title, value) {
  return new Promise(resolve => {
    const overlay = document.getElementById("awmPrompt");
    document.getElementById("awmPromptTitle").textContent = title;
    const ta = document.getElementById("awmPromptInput");
    ta.value = value || "";
    overlay.classList.add("open");
    setTimeout(() => ta.focus(), 50);
    const ok = document.getElementById("awmPromptOk");
    const cancel = document.getElementById("awmPromptCancel");
    const done = val => { overlay.classList.remove("open"); ok.onclick = null; cancel.onclick = null; resolve(val); };
    ok.onclick = () => done(ta.value);
    cancel.onclick = () => done(null);
  });
}

window.awmEditDescription = async function (index) {
  const text = await showPrompt("Description", currentRecords[index].description || "");
  if (text === null) return;               // Cancel → no change
  currentRecords[index].description = text;
  currentRecords[index]._dirty = true;
  dirty = true;
  const cell = document.getElementById("desccell-" + index);
  if (cell) cell.innerHTML = renderDescCell(index, currentRecords[index].verified === "Yes");
  refreshRowControls(index);
  updateSaveAllBar();
};

window.awmViewDescription = function (index) {
  showModal({
    title: "Description",
    message: currentRecords[index].description || "(no description)",
    buttons: [{ label: "Close", value: true, variant: "primary" }]
  });
};

// ===============================
// VERIFY / REJECT (verifier-only; persists immediately)
// Both record a verifier decision in Awarded Data (verified = "Yes" or "Rejected"),
// which is then visible to the data-entry user. Guards against a stale page: the
// user may have erased the record after this page loaded, so we re-pull
// authoritative data first and refuse to decide (never re-insert) anything no
// longer present in Awarded Data.
// ===============================
async function decideRecord(index, decision) {   // decision: "Yes" (verify) | "Rejected" (reject)
  if (!isVerifier) { showToast("You don't have verifier access.", "error"); return; }
  const verb = decision === "Yes" ? "Verifying" : "Rejecting";
  const done = decision === "Yes" ? "verified" : "rejected";

  const cell = document.getElementById("verify-" + index);
  if (cell) cell.innerHTML = `<span class="img-status">⏳ ${verb}…</span>`;

  const rec = currentRecords[index];
  const me  = currentUser();

  try {
    // 1) Re-pull the month straight from the server (source of truth).
    const district = document.getElementById("awmDistrict").value;
    const fresh = await (await fetch(
      `${API_URL}?action=getRecords&month=${encodeURIComponent(selectedMonth)}&district=${encodeURIComponent(district)}`
    )).json();
    const freshArr = Array.isArray(fresh) ? fresh : [];
    const match = freshArr.find(f => recKey(f) === recKey(rec));

    // 2) No longer in Awarded Data → the user erased it. Do NOT re-insert.
    if (!match || !recInAwardedData(match)) {
      Object.assign(rec, {
        awarded: "No", awardedBy: "", awardedDate: "", folderLink: "",
        uploadedBy: "", description: "", verified: "", verifiedBy: "", late: ""
      });
      rec._existed = false; rec._dirty = false;
      if (selectedMonth) updateMonthRow(selectedMonth);
      renderTable();
      await showModal({
        title: "Record no longer available",
        message: `This record was deleted by the user, so it's no longer in Awarded Data and can't be ${done}.`,
        buttons: [{ label: "OK", value: true, variant: "primary" }]
      });
      return;
    }

    // 3) Still present → record the decision on the current (authoritative) record.
    const decided = { ...match, verified: decision, verifiedBy: me };
    decided.late = isLate(decided, selectedMonth) ? "Yes" : "No";

    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "saveRecords", records: [{ ...decided, _override: true }] })
    });
    const out = await res.json();
    if (!out.success) throw new Error("Save failed");

    // 4) Reflect the decision locally (adopt fresh data for this row).
    Object.assign(rec, decided);
    rec._existed = true; rec._dirty = false;
    if (selectedMonth) { monthCache[selectedMonth] = currentRecords; updateMonthRow(selectedMonth); }
    renderTable();   // re-render so the row locks with its badge
    showToast(`Record ${done}.`);
  } catch (e) {
    console.error(e);
    if (cell) cell.innerHTML = renderVerifyCell(index);
    const unlockCell = document.getElementById("unlock-" + index);
    if (unlockCell) unlockCell.innerHTML = "";
    showToast(`${decision === "Yes" ? "Verification" : "Rejection"} failed.`, "error");
  }
}

window.awmVerifyRecord = (index) => decideRecord(index, "Yes");
window.awmRejectRecord = (index) => decideRecord(index, "Rejected");

// ===============================
// UNLOCK (verifier-only): reverts a verified record to pending (Submitted) so it
// becomes editable again. Re-checks Awarded Data first so it can't re-insert a
// record the user has since erased.
// ===============================
window.awmUnlockRecord = async function (index) {
  if (!isVerifier) { showToast("Only a verifier can unlock a record.", "error"); return; }

  const cell = document.getElementById("verify-" + index);
  if (cell) cell.innerHTML = '<span class="img-status">⏳ Unlocking…</span>';

  const rec = currentRecords[index];

  try {
    const fresh = await getFreshRecords();
    const match = fresh.find(f => recKey(f) === recKey(rec));

    // No longer in Awarded Data → the user erased it. Don't re-insert.
    if (!match || !recInAwardedData(match)) {
      Object.assign(rec, { awarded: "No", awardedBy: "", awardedDate: "", folderLink: "",
        uploadedBy: "", description: "", verified: "", verifiedBy: "", late: "" });
      rec._existed = false; rec._dirty = false;
      if (selectedMonth) updateMonthRow(selectedMonth);
      renderTable();
      await showModal({
        title: "Record no longer available",
        message: "This record was deleted by the user, so there's nothing to unlock.",
        buttons: [{ label: "OK", value: true, variant: "primary" }]
      });
      return;
    }

    // Still present → clear the decision (back to Submitted / pending).
    const reopened = { ...match, verified: "", verifiedBy: "" };
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "saveRecords", records: [{ ...reopened, _override: true }] })
    });
    const out = await res.json();
    if (!out.success) throw new Error("Save failed");

    Object.assign(rec, reopened);
    rec._existed = true; rec._dirty = false;
    if (selectedMonth) { monthCache[selectedMonth] = currentRecords; updateMonthRow(selectedMonth); }
    renderTable();   // re-render so the row unlocks
    showToast("Row unlocked.");
  } catch (e) {
    console.error(e);
    if (cell) cell.innerHTML = renderVerifyCell(index);
    showToast("Unlock failed.", "error");
  }
};

// ===============================
// SAVE ONE ROW (from the per-row Save button).
//  • Awarded = Yes → persist the row if every mandatory field is filled, else say
//    what's missing. Re-checks the whole row each time (so edits after a save are
//    re-validated before saving again).
//  • Awarded = No on a previously-saved row → confirm, then permanently erase that
//    user's saved award data.
// ===============================
// ===============================
// SAVE ONE ROW (from the per-row Save button).
//  • Awarded = Yes → persist the row if every mandatory field is filled, else say
//    what's missing. Saving (re)submits the record, so its status becomes
//    "Submitted" (clearing any prior Rejected decision).
//  • Awarded = No on a previously-saved row → confirm, then permanently erase.
// Every path first re-checks Awarded Data: if the record was verified underneath a
// stale page it refuses; if it was already erased it just syncs.
// ===============================
function adoptFreshInto(rec, fresh) {
  Object.assign(rec, fresh);
  rec._existed = recInAwardedData(fresh);
  rec._dirty = false;
}
async function refuseBecauseVerified(rec, fresh) {
  adoptFreshInto(rec, fresh);
  if (selectedMonth) { monthCache[selectedMonth] = currentRecords; updateMonthRow(selectedMonth); }
  recomputeDirty();
  renderTable();
  await showModal({
    title: "Already verified",
    message: `This record was just verified by ${nameFromEmail(fresh.verifiedBy) || "a verifier"} and can no longer be changed. The latest status is now shown.`,
    buttons: [{ label: "OK", value: true, variant: "primary" }]
  });
}

window.awmSaveSingleRecord = async function (index) {
  const r = currentRecords[index];
  if (!r || isVerifier || r.verified === "Yes") return;   // verifier / verified → can't save here

  // --- Erase path: row was saved, now set to "No" ---
  if (r.awarded !== "Yes") {
    if (!r._existed || !r._dirty) return;       // only if there's saved data the user just un-awarded

    // Stale check before erasing.
    let fresh;
    try { fresh = await getFreshRecords(); }
    catch (e) { console.error(e); showToast("Couldn't reach the server. Try again.", "error"); return; }
    const match = fresh.find(f => recKey(f) === recKey(r));
    if (match && match.verified === "Yes") { await refuseBecauseVerified(r, match); return; }
    if (!match || !recInAwardedData(match)) {   // already gone → just sync
      Object.assign(r, { awarded: "No", awardedBy: "", awardedDate: "", folderLink: "",
        uploadedBy: "", description: "", verified: "", verifiedBy: "", late: "" });
      r._existed = false; r._dirty = false;
      if (selectedMonth) { monthCache[selectedMonth] = currentRecords; updateMonthRow(selectedMonth); }
      recomputeDirty(); renderTable();
      showToast("This record was already removed.");
      return;
    }

    const who = r.fullName ? `${r.fullName}'s` : "this user's";
    const choice = await showModal({
      title: "Erase this record?",
      message: `${who} saved award data will be erased permanently. Do you want to perform this action?`,
      buttons: [
        { label: "No", value: "no", variant: "cancel" },
        { label: "Yes, erase", value: "yes", variant: "danger" }
      ]
    });
    if (choice !== "yes") return;

    const eCell = document.getElementById("rowsave-" + index);
    if (eCell) eCell.innerHTML = '<span class="img-status">⏳ Erasing…</span>';
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "deleteRecords", records: [{ ...r }] })
      });
      const out = await res.json();
      if (!out.success) throw new Error(out.error || "Delete failed");

      r.awardedBy = ""; r.awardedDate = ""; r.folderLink = "";
      r.uploadedBy = ""; r.description = ""; r.verified = ""; r.verifiedBy = ""; r.late = "";
      r._existed = false; r._dirty = false;

      if (selectedMonth) { monthCache[selectedMonth] = currentRecords; updateMonthRow(selectedMonth); }
      recomputeDirty();
      renderTable();
      showToast((r.fullName ? r.fullName + " — " : "") + "data erased permanently."
        + (out.imageDeleteFailed ? " (image file could not be removed)" : ""));
    } catch (e) {
      console.error(e);
      refreshRowControls(index);
      showToast("Failed to erase this record.", "error");
    }
    return;
  }

  // --- Save path: Awarded = Yes ---
  if (!rowComplete(r)) {
    showToast("Fill all mandatory fields for this record: " + rowMissingFields(r).join(", ") + ".", "error");
    return;
  }

  const cell = document.getElementById("rowsave-" + index);
  if (cell) cell.innerHTML = '<span class="img-status">⏳ Saving…</span>';

  try {
    // Stale check: did this record get verified underneath us?
    const fresh = await getFreshRecords();
    const match = fresh.find(f => recKey(f) === recKey(r));
    if (match && match.verified === "Yes") { await refuseBecauseVerified(r, match); return; }

    // Saving (re)submits → status becomes "Submitted" (clears any prior decision).
    r.verified = ""; r.verifiedBy = "";
    r.late = isLate(r, selectedMonth) ? "Yes" : "No";

    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "saveRecords", records: [{ ...r }] })
    });
    const out = await res.json();
    if (!out.success) throw new Error(out.error || "Save failed");
    if (out.locked && out.locked.length) {
      await showModal({ title: "Record is locked", message: LOCK_MSG,
        buttons: [{ label: "OK", value: true, variant: "primary" }] });
      refreshRowControls(index);
      return;
    }

    r._existed = true; r._dirty = false;
    if (selectedMonth) { monthCache[selectedMonth] = currentRecords; updateMonthRow(selectedMonth); }
    recomputeDirty();
    refreshRowControls(index);
    const vCell = document.getElementById("verify-" + index);
    if (vCell) vCell.innerHTML = renderVerifyCell(index);   // → "Submitted"
    updateSaveAllBar();
    showToast((r.fullName ? r.fullName + " — " : "") + "submitted successfully.");
  } catch (e) {
    console.error(e);
    refreshRowControls(index);
    showToast("Failed to save this record.", "error");
  }
};

// ===============================
// SAVE (only awarded = "Yes" rows). Returns true on success.
// Re-pulls the month afterwards so the saved state shows without a reload.
// ===============================
async function saveRecords() {
  // Guard: any row being awarded (Yes) that isn't fully filled blocks the whole
  // save. Rows left untouched ("No") are fine — they're simply skipped below.
  const incomplete = currentRecords.filter(rowIncompleteYes);
  if (incomplete.length) {
    const names = incomplete.map(r => r.fullName || "a record").slice(0, 4).join(", ");
    const extra = incomplete.length > 4 ? ` and ${incomplete.length - 4} more` : "";
    showToast(`Fill all mandatory fields (Awarded By, Date, Image, Description) for ${names}${extra} before saving.`, "error");
    return false;
  }

  // Complete awarded rows that aren't already verified. Saving them (re)submits
  // each, so their status becomes "Submitted" (any prior Rejected is cleared).
  const toSave = currentRecords
    .filter(r => r.awarded === "Yes" && r.verified !== "Yes")
    .map(r => ({ ...r, verified: "", verifiedBy: "", late: isLate(r, selectedMonth) ? "Yes" : "No" }));

  // Unlocked rows that already had saved data but are now set to "No" →
  // their data (and image) should be deleted from Awarded Data.
  const toDelete = currentRecords.filter(
    r => r._existed && r.awarded === "No" && r.verified !== "Yes"
  );

  if (!toSave.length && !toDelete.length) {
    showToast("No completely-filled records to save.", "info");
    return false;
  }

  // Stale check: re-pull Awarded Data and refuse if any row we're about to save or
  // delete was verified underneath this (possibly stale) page. Adopt the fresh
  // state for those rows so the page reflects reality, then abort.
  let freshAll;
  try { freshAll = await getFreshRecords(); }
  catch (e) { console.error(e); showToast("Couldn't reach the server. Try again.", "error"); return false; }
  const freshByKey = {};
  freshAll.forEach(f => { freshByKey[recKey(f)] = f; });
  const conflicts = [...toSave, ...toDelete].filter(r => {
    const f = freshByKey[recKey(r)];
    return f && f.verified === "Yes";           // became verified on the server
  });
  if (conflicts.length) {
    conflicts.forEach(r => {
      const local = currentRecords.find(c => recKey(c) === recKey(r));
      const f = freshByKey[recKey(r)];
      if (local && f) adoptFreshInto(local, f);
    });
    recomputeDirty();
    renderTable();
    const names = conflicts.map(r => r.fullName || "a record").slice(0, 4).join(", ");
    const extra = conflicts.length > 4 ? ` and ${conflicts.length - 4} more` : "";
    showToast(`These records were just verified and can no longer be changed: ${names}${extra}. The latest status is now shown.`, "error");
    return false;
  }

  // Confirm before committing. Complete rows get saved; rows flipped to "No" that
  // previously had saved data get permanently deleted.
  const saveCount = toSave.length;
  let confirmTitle, confirmMsg, confirmLabel, confirmVariant;
  if (toDelete.length) {
    const delNames = toDelete.map(r => r.fullName || "this record").join(", ");
    const parts = [];
    if (saveCount) {
      parts.push(`${saveCount} record${saveCount === 1 ? " is" : "s are"} filled completely and will be saved.`);
    }
    parts.push(
      `${toDelete.length} record${toDelete.length === 1 ? " was" : "s were"} set to "No" and ${toDelete.length === 1 ? "its" : "their"} saved data will be permanently deleted:\n${delNames}\n\nThis cannot be undone.`
    );
    confirmTitle = "Save changes?";
    confirmMsg = parts.join("\n\n");
    confirmLabel = saveCount ? "Save & Delete" : "Delete";
    confirmVariant = "danger";
  } else {
    confirmTitle = "Save changes?";
    confirmMsg = `${saveCount} record${saveCount === 1 ? " is" : "s are"} filled completely. Are you sure you want to save ${saveCount === 1 ? "it" : "them all"}?`;
    confirmLabel = "Save";
    confirmVariant = "primary";
  }
  const choice = await showModal({
    title: confirmTitle,
    message: confirmMsg,
    buttons: [
      { label: "Cancel", value: "cancel", variant: "cancel" },
      { label: confirmLabel, value: "go", variant: confirmVariant }
    ]
  });
  if (choice !== "go") return false;   // cancel → nothing saved or deleted

  const btn = document.getElementById("savePomBtn");
  btn.disabled = true;
  btn.innerText = "Saving...";
  showLoader();
  try {
    let imageDeleteFailed = false;

    // 1) Delete the flipped-to-"No" records (sheet row + image) first.
    if (toDelete.length) {
      const delOut = await (await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "deleteRecords", records: toDelete })
      })).json();
      if (!delOut.success) throw new Error(delOut.error || "Delete failed");
      if (delOut.imageDeleteFailed) imageDeleteFailed = true;
    }

    // 2) Save the awarded ("Yes") records.
    let result = { success: true, locked: [] };
    if (toSave.length) {
      const saveUrl =
        `${API_URL}?action=saveRecords&records=` +
        encodeURIComponent(JSON.stringify(toSave));
      result = await (await fetch(saveUrl)).json();
      if (!result.success) throw new Error("Save failed");
    }

    // 3) Pull fresh server truth → reflects immediately, no page reload.
    if (selectedMonth) {
      await refetchMonth(selectedMonth);
      currentRecords = monthCache[selectedMonth];
      markExisting(currentRecords);
      renderTable();
      updateMonthRow(selectedMonth);
    }
    dirty = false;

    if (result.locked && result.locked.length) {
      await showModal({
        title: "Some records are locked",
        message: `${LOCK_MSG}\n\nNot saved: ${result.locked.join(", ")}.`,
        buttons: [{ label: "OK", value: true, variant: "primary" }]
      });
    } else if (toDelete.length && toSave.length) {
      showToast("Changes saved and record data deleted.");
    } else if (toDelete.length) {
      showToast(toDelete.length === 1 ? "Record data deleted." : toDelete.length + " records deleted.");
    } else {
      showToast("Records saved successfully.");
    }

    if (imageDeleteFailed) {
      showToast("A record's image couldn't be deleted (check Drive permissions).", "error");
    }
    return true;
  } catch (e) {
    console.error(e);
    showToast("Failed to save changes.", "error");
    return false;
  } finally {
    btn.disabled = false;
    btn.innerText = "💾 Save All Changes";
    hideLoader();
  }
}

// ===============================
// DATE FORMAT
// ===============================
function formatDate(value) {
  if (!value) return "";
  if (value.includes("/")) {
    const p = value.split("/");
    if (p.length === 3) return `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
  }
  return value;
}


// ===============================
// INITIALIZER
// ===============================
window.initAwardManageUI = function () {
  // A fresh page: nothing carried over from the last visit.
  currentRecords = [];
  allMonths = [];
  monthCache = {};
  selectedMonth = "";
  dirty = false;

  // Rebind the district <select> FIRST, then load — so loading + results
  // both target the final element (no detached-node race).
  const district = document.getElementById("awmDistrict");
  if (district) {
    const fresh = district.cloneNode(true);
    district.parentNode.replaceChild(fresh, district);
    fresh.addEventListener("change", loadDistrictSummary);
  }

  loadFilters();
  loadVerifierStatus().then(() => { if (selectedMonth) renderTable(); });

  const backBtn = document.getElementById("awmBackBtn");
  if (backBtn) {
    const fresh = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(fresh, backBtn);
    fresh.addEventListener("click", handleBack);
  }

  const refreshBtn = document.getElementById("awmRefreshBtn");
  if (refreshBtn) {
    const fresh = refreshBtn.cloneNode(true);
    refreshBtn.parentNode.replaceChild(fresh, refreshBtn);
    fresh.addEventListener("click", refreshRecords);
  }

  const saveBtn = document.getElementById("savePomBtn");
  if (saveBtn) {
    const fresh = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(fresh, saveBtn);
    fresh.addEventListener("click", saveRecords);
  }

  // Detail view — district change: reload whole summary then re-enter month if possible
  const detailDistrictEl = document.getElementById("awmDetailDistrict");
  if (detailDistrictEl) {
    detailDistrictEl.addEventListener("change", async function () {
      if (dirty) {
        const choice = await confirmUnsaved();
        if (choice === "cancel") { this.value = document.getElementById("awmDistrict").value; return; }
        if (choice === "save") await saveRecords();
      }
      dirty = false;
      // Sync back to list-view select so loadDistrictSummary reads correct value
      const listDistrict = document.getElementById("awmDistrict");
      if (listDistrict) listDistrict.value = this.value;
      // Show list briefly while loading, then re-enter if months still exist
      showList();
      await loadDistrictSummary();
      // If current month still has records in new district, jump straight in
      const months = allMonths.filter(m => (monthCache[m] || []).length);
      if (months.length) {
        const target = months.includes(selectedMonth || "") ? selectedMonth : months[0];
        selectMonth(target || months[0]);
      }
      // else stays on list view
    });
  }

  // Detail view — month change: switch records inline, no back needed
  const detailMonthEl = document.getElementById("awmDetailMonth");
  if (detailMonthEl) {
    detailMonthEl.addEventListener("change", async function () {
      if (dirty) {
        const choice = await confirmUnsaved();
        if (choice === "cancel") { this.value = selectedMonth; return; }
        if (choice === "save") await saveRecords();
      }
      dirty = false;
      selectedMonth = this.value;
      currentRecords = monthCache[selectedMonth] || [];
      markExisting(currentRecords);
      document.querySelectorAll(".month-row").forEach(r =>
        r.classList.toggle("active", r.dataset.month === selectedMonth)
      );
      renderTable();
    });
  }

  const imgClose = document.getElementById("awmImgClose");
  if (imgClose) imgClose.addEventListener("click", closeImageModal);
  const imgModal = document.getElementById("awmImgModal");
  if (imgModal) imgModal.addEventListener("click", e => { if (e.target === imgModal) closeImageModal(); });

  // Init dashboard (uses shared allMonths + monthCache via shared state)

  // Init Event Management (its own tab; independent of the award data)
};
})();
