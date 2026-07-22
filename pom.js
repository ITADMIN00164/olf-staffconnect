console.log("POM JS FILE LOADED");

const API_URL =
  "https://script.google.com/macros/s/AKfycbyHvxHR2nzx8JZ2FRDtx5dSqnrQVieOiPWguZCIKtohD1TBDdENPjyzlJhQwQEHYdJfUw/exec";

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
  "Edu. Minister", "Chief Minister", "Prime Minister", "President", "Governor"
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
function showLoader() { document.getElementById("pomLoader").classList.add("open"); }
function hideLoader() { document.getElementById("pomLoader").classList.remove("open"); }

function showToast(message, type = "success") {
  const wrap = document.getElementById("pomToasts");
  if (!wrap) return;
  const t = document.createElement("div");
  t.className = "pom-toast " + type;
  t.textContent = message;
  wrap.appendChild(t);
  setTimeout(() => { t.classList.add("hide"); setTimeout(() => t.remove(), 300); }, 3000);
}

function showModal({ title, message, buttons }) {
  return new Promise(resolve => {
    const overlay = document.getElementById("pomModal");
    document.getElementById("pomModalTitle").textContent = title || "";
    document.getElementById("pomModalMsg").textContent = message || "";
    const actions = document.getElementById("pomModalActions");
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
  const dd0 = document.getElementById("pomDistrict");
  if (dd0) { dd0.disabled = true; dd0.innerHTML = '<option>⏳ Loading districts…</option>'; }
  try {
    const res = await fetch(`${API_URL}?action=getFilters`);
    const data = await res.json();
    allMonths = data.months || [];
    const dd = document.getElementById("pomDistrict");
    if (dd) {
      dd.innerHTML =
        '<option value="">Select District</option>' +
        (data.districts || []).map(d => `<option value="${d}">${d}</option>`).join("");
      dd.disabled = false;
    }
  } catch (e) {
    console.error(e);
    const dd = document.getElementById("pomDistrict");
    if (dd) { dd.innerHTML = '<option value="">Failed to load — reopen page</option>'; dd.disabled = false; }
    showToast("Failed to load districts.", "error");
  }
}

// Re-pull one month from the server (authoritative) and refresh the cache.
async function refetchMonth(month) {
  const district = document.getElementById("pomDistrict").value;
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
  const district = document.getElementById("pomDistrict").value;
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
  const district = document.getElementById("pomDistrict").value;

  monthCache = {};
  selectedMonth = "";
  currentRecords = [];
  dirty = false;
  resetDetail("Select a month above to view records");

  const body = document.getElementById("pomMonthBody");
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
  const body = document.getElementById("pomMonthBody");
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
  document.getElementById("pomDetailWrap").style.display = "none";
  document.getElementById("pomListView").style.display = "flex";
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
  const listDistrict = document.getElementById("pomDistrict");
  const detailDistrict = document.getElementById("pomDetailDistrict");
  if (!detailDistrict || !listDistrict) return;

  // Copy all options from list-view select into detail select
  detailDistrict.innerHTML = listDistrict.innerHTML;
  detailDistrict.value = listDistrict.value;

  // Populate month dropdown from available months (those with records)
  const detailMonth = document.getElementById("pomDetailMonth");
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
  document.getElementById("pomListView").style.display = "none";
  document.getElementById("pomDetailWrap").style.display = "flex";
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
         <input type="file" accept="image/*" style="display:none" onchange="uploadImage(${index}, this.files[0])">
       </label>`;
  const uploaderName = nameFromEmail(rec.uploadedBy || "");
  return `
    ${uploadCtl}
    <button class="icon-btn" title="View image" ${has ? "" : "disabled"} onclick="viewImage(${index})">${EYE_SVG}</button>
    ${justUploaded ? '<span class="img-status ok">Uploaded</span>' : ""}
    ${uploaderName ? `<span class="cell-sublabel" title="${rec.uploadedBy}">${uploaderName}</span>` : ""}`;
}

function renderDescCell(index, locked) {
  const has = !!String(currentRecords[index].description || "").trim();
  let editCtl;
  if (isVerifier)      editCtl = "";             // verifier is view-only — no edit
  else if (locked)     editCtl = `<button class="icon-btn" disabled title="${LOCK_MSG}">${PENCIL_SVG}</button>`;
  else                 editCtl = `<button class="icon-btn" title="Write description" onclick="editDescription(${index})">${PENCIL_SVG}</button>`;
  return `${editCtl}<button class="icon-btn" title="View description" ${has ? "" : "disabled"} onclick="viewDescription(${index})">${EYE_SVG}</button>`;
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
      + `<button class="vr-btn approve" title="Verify" onclick="verifyRecord(${index})">${CHECK_SVG}</button>`
      + `<button class="vr-btn reject" title="Reject" onclick="rejectRecord(${index})">${X_SVG}</button>`
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
      return `<button class="rowsave-btn danger" title="Erase this user's saved data" onclick="saveSingleRecord(${index})">${SAVE_SVG}Save</button>`;
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
  return `<button class="${cls}" title="${title}" onclick="saveSingleRecord(${index})">${SAVE_SVG}Save</button>`;
}

// Re-render just one row's Save cell (used after inline edits, without a full table redraw).
function refreshRowControls(index) {
  const cell = document.getElementById("rowsave-" + index);
  if (cell) cell.innerHTML = renderRowSaveCell(index);
}

// Show the "Save All Changes" bar only when there is something to commit:
// at least one complete-but-unsaved row, or a previously-saved row flipped to "No".
function updateSaveAllBar() {
  const bar = document.getElementById("pomSaveBar");
  if (!bar) return;
  if (isVerifier) { bar.style.display = "none"; return; }   // verifier is view-only
  const recs = currentRecords || [];
  const anyUnsavedComplete = recs.some(r => r.verified !== "Yes" && rowComplete(r) && (r._dirty || !r._existed));
  const anyPendingDelete   = recs.some(r => r._existed && r.awarded === "No" && r.verified !== "Yes");
  bar.style.display = (anyUnsavedComplete || anyPendingDelete) ? "block" : "none";
}

function renderTable() {
  const tbody = document.getElementById("pomTableBody");

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
        <select class="award-select" ${dis} ${lt} onchange="updateField(${i},'awarded',this.value)">
          <option value="No"  ${r.awarded === "No"  ? "selected" : ""}>No</option>
          <option value="Yes" ${r.awarded === "Yes" ? "selected" : ""}>Yes</option>
        </select>
      </td>
      <td>
        <select class="award-select" ${dis} ${lt} onchange="updateField(${i},'awardedBy',this.value)">
          ${awardedByOptions(r.awardedBy || "")}
        </select>
      </td>
      <td ${lt}><input type="date" class="award-input date-compact" ${dis} value="${formatDate(r.awardedDate)}" onchange="updateField(${i},'awardedDate',this.value)"></td>
      <td class="img-cell" id="imgcell-${i}">${renderImageCell(i, false, viewOnly)}</td>
      <td class="img-cell" id="desccell-${i}">${renderDescCell(i, viewOnly)}</td>
      <td class="col-center" id="rowsave-${i}">${renderRowSaveCell(i)}</td>
      <td class="verify-cell col-center" id="verify-${i}">${renderVerifyCell(i)}</td>
      <td class="col-center" id="unlock-${i}">${locked && isVerifier ? `<button class="unlock-btn" onclick="unlockRecord(${i})">Unlock</button>` : ""}</td>
    </tr>`;
  }).join("");

  updateSaveAllBar();
}

function resetDetail(msg) {
  document.getElementById("pomTableBody").innerHTML =
    `<tr><td colspan="10" style="text-align:center;color:#9ca3af;padding:28px;">${msg}</td></tr>`;
  updateSaveAllBar();
}

window.updateField = function (index, field, value) {
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

window.uploadImage = async function (index, file) {
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
      district: document.getElementById("pomDistrict").value,
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

window.viewImage = function (index) {
  const url = currentRecords[index].folderLink;
  if (!url) return;
  const id    = driveId(url);
  const img   = document.getElementById("pomImgEl");
  const modal = document.getElementById("pomImgModal");
  const fb    = document.getElementById("pomImgFallback");
  const ld    = document.getElementById("pomImgLoading");

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
  document.getElementById("pomImgModal").classList.remove("open");
  const img = document.getElementById("pomImgEl");
  if (img) { img.onerror = null; img.onload = null; img.src = ""; img.style.display = ""; }
  const fb = document.getElementById("pomImgFallback");
  if (fb) fb.style.display = "none";
  const ld = document.getElementById("pomImgLoading");
  if (ld) ld.style.display = "none";
}

// ── Description: edit (popup textbox) + view ──
function showPrompt(title, value) {
  return new Promise(resolve => {
    const overlay = document.getElementById("pomPrompt");
    document.getElementById("pomPromptTitle").textContent = title;
    const ta = document.getElementById("pomPromptInput");
    ta.value = value || "";
    overlay.classList.add("open");
    setTimeout(() => ta.focus(), 50);
    const ok = document.getElementById("pomPromptOk");
    const cancel = document.getElementById("pomPromptCancel");
    const done = val => { overlay.classList.remove("open"); ok.onclick = null; cancel.onclick = null; resolve(val); };
    ok.onclick = () => done(ta.value);
    cancel.onclick = () => done(null);
  });
}

window.editDescription = async function (index) {
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

window.viewDescription = function (index) {
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
    const district = document.getElementById("pomDistrict").value;
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

window.verifyRecord = (index) => decideRecord(index, "Yes");
window.rejectRecord = (index) => decideRecord(index, "Rejected");

// ===============================
// UNLOCK (verifier-only): reverts a verified record to pending (Submitted) so it
// becomes editable again. Re-checks Awarded Data first so it can't re-insert a
// record the user has since erased.
// ===============================
window.unlockRecord = async function (index) {
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

window.saveSingleRecord = async function (index) {
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
window.initPomPageUI = function () {
  console.log("POM PAGE INITIALIZED");

  // Rebind the district <select> FIRST, then load — so loading + results
  // both target the final element (no detached-node race).
  const district = document.getElementById("pomDistrict");
  if (district) {
    const fresh = district.cloneNode(true);
    district.parentNode.replaceChild(fresh, district);
    fresh.addEventListener("change", loadDistrictSummary);
  }

  loadFilters().then(() => {
    // Districts are now in the dropdown. Begin loading the dashboard data in the
    // background (after a short delay so an immediate district pick on the
    // Award Management tab isn't slowed by the bulk fetch). It will already be
    // ready — or at least loading — by the time the user opens the Dashboard tab.
    setTimeout(startDashPrefetch, 800);
  });
  loadVerifierStatus().then(() => { if (selectedMonth) renderTable(); });

  const backBtn = document.getElementById("pomBackBtn");
  if (backBtn) {
    const fresh = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(fresh, backBtn);
    fresh.addEventListener("click", handleBack);
  }

  const refreshBtn = document.getElementById("pomRefreshBtn");
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
  const detailDistrictEl = document.getElementById("pomDetailDistrict");
  if (detailDistrictEl) {
    detailDistrictEl.addEventListener("change", async function () {
      if (dirty) {
        const choice = await confirmUnsaved();
        if (choice === "cancel") { this.value = document.getElementById("pomDistrict").value; return; }
        if (choice === "save") await saveRecords();
      }
      dirty = false;
      // Sync back to list-view select so loadDistrictSummary reads correct value
      const listDistrict = document.getElementById("pomDistrict");
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
  const detailMonthEl = document.getElementById("pomDetailMonth");
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

  const imgClose = document.getElementById("pomImgClose");
  if (imgClose) imgClose.addEventListener("click", closeImageModal);
  const imgModal = document.getElementById("pomImgModal");
  if (imgModal) imgModal.addEventListener("click", e => { if (e.target === imgModal) closeImageModal(); });

  // Init dashboard (uses shared allMonths + monthCache via shared state)
  initDashboard();
};

// ===============================
// TAB SWITCHER
// ===============================
window.switchPomTab = function (tab) {
  // The Award Data Dashboard tab stays disabled (showing a spinner) until its
  // data has finished loading, so the user can never land on an empty/error view.
  if (tab === "dash" && !dashLoaded) return;

  const manage = document.getElementById("pomManageView");
  const dash   = document.getElementById("pomDashView");
  const tManage = document.getElementById("tabManage");
  const tDash   = document.getElementById("tabDash");
  if (tab === "dash") {
    if (manage) manage.style.display = "none";
    if (dash)   { dash.style.display = "flex"; dash.classList.add("active"); }
    if (tManage) tManage.classList.remove("active");
    if (tDash)   tDash.classList.add("active");
    renderPomDashboard();
  } else {
    if (dash)   { dash.style.display = "none"; dash.classList.remove("active"); }
    if (manage) manage.style.display = "flex";
    if (tManage) tManage.classList.add("active");
    if (tDash)   tDash.classList.remove("active");
  }
};

// ===============================
// DASHBOARD
// ===============================

// All data: flat array of { month, community, district, ...record }
let dashAllData      = [];
let dashLoaded       = false;
let dashLoading      = false;   // background fetch in progress
let dashDistrictsList = [];     // canonical district list (server order)
let dashDistrictSel  = null;    // committed district selection (applied on "Apply")
let dashMonthSel     = null;    // committed month selection (applied on "Apply")
let dashCategorySel  = null;    // committed award-category selection (applied on "Apply")
let dashAwardSel     = null;    // committed award-name selection (applied on "Apply")
let dashLastRows     = [];      // rows currently shown in the table (for Excel export)
let dashLastTotals   = null;    // totals row currently shown (for Excel export)
let dashCommunitySel = null;    // committed community selection (drives District + Month)
let dashRetryTimer   = null;    // pending background-load retry
let dashRetryDelay   = 3000;    // backoff between retries (grows to a cap)

async function initDashboard() {
  setupDropdownToggle("dashCommunityTrigger", "dashCommunityPanel");
  setupDropdownToggle("dashDistrictTrigger", "dashDistrictPanel");
  setupDropdownToggle("dashMonthTrigger", "dashMonthPanel");
  setupDropdownToggle("dashCategoryTrigger", "dashCategoryPanel");
  setupDropdownToggle("dashAwardTrigger", "dashAwardPanel");
  document.addEventListener("click", closeDashDropdowns);

  // "Apply" buttons: a selection is only committed (and the dashboard
  // re-rendered) when the user clicks Apply — ticking checkboxes alone does
  // nothing and keeps the dropdown open.
  const cApply = document.getElementById("dashCommunityApply");
  if (cApply) cApply.onclick = (e) => { e.stopPropagation(); applyDashFilter("community"); };
  const dApply = document.getElementById("dashDistrictApply");
  if (dApply) dApply.onclick = (e) => { e.stopPropagation(); applyDashFilter("district"); };
  const mApply = document.getElementById("dashMonthApply");
  if (mApply) mApply.onclick = (e) => { e.stopPropagation(); applyDashFilter("month"); };
  const catApply = document.getElementById("dashCategoryApply");
  if (catApply) catApply.onclick = (e) => { e.stopPropagation(); applyDashFilter("category"); };
  const awdApply = document.getElementById("dashAwardApply");
  if (awdApply) awdApply.onclick = (e) => { e.stopPropagation(); applyDashFilter("award"); };

  const refreshBtn = document.getElementById("dashRefreshBtn");
  if (refreshBtn) refreshBtn.onclick = (e) => { e.stopPropagation(); refreshDashData(); };

  const exportBtn = document.getElementById("dashExportBtn");
  if (exportBtn) exportBtn.onclick = (e) => { e.stopPropagation(); downloadDashboardExcel(); };

  // Navigating away and back re-injects empty filter panels. If the data was
  // already loaded earlier this session, rebuild the filters right away so the
  // dropdowns work without re-fetching.
  if (dashLoaded) {
    populateDashFilters(dashDistrictsList);
    setDashTabLoading(false);
  } else {
    setDashTabLoading(true);   // disable the tab + show its spinner until loaded
  }
}

// Disable/enable the "Award Data Dashboard" tab and toggle its loading spinner.
function setDashTabLoading(on) {
  const tab = document.getElementById("tabDash");
  if (tab) tab.classList.toggle("loading", on);
  if (on) beginDashProgress();
  else    stopDashProgress();
}

// ── Smooth "feels fast" progress counter next to the tab spinner ──
// The bulk load is a single request, so there's no real per-cell granularity.
// We animate the number climbing quickly (fast at first, easing toward ~92%),
// nudge it up with any real progress, and snap to 100% the moment it's done.
let dashProgTimer = null;
let dashProgVal   = 0;

function setProgText(p) {
  const el = document.getElementById("dashTabProgress");
  if (el) el.textContent = Math.round(p) + "%";
}

function beginDashProgress() {
  if (dashProgTimer) return;   // already animating — let it keep climbing
  dashProgVal = 0;
  setProgText(0);
  dashProgTimer = setInterval(() => {
    const step = dashProgVal < 55 ? 7 : dashProgVal < 80 ? 3 : 1;
    dashProgVal = Math.min(92, dashProgVal + step);
    setProgText(dashProgVal);
  }, 70);
}

// Real progress (per-cell fallback path) nudges the bar forward if it's ahead.
function bumpDashProgress(done, total) {
  if (!total) return;
  const real = (done / total) * 92;
  if (real > dashProgVal) { dashProgVal = real; setProgText(dashProgVal); }
}

function finishDashProgress() {
  if (dashProgTimer) { clearInterval(dashProgTimer); dashProgTimer = null; }
  dashProgVal = 100;
  setProgText(100);
}

function stopDashProgress() {
  if (dashProgTimer) { clearInterval(dashProgTimer); dashProgTimer = null; }
  const el = document.getElementById("dashTabProgress");
  if (el) el.textContent = "";
}

function setupDropdownToggle(triggerId, panelId) {
  const trigger = document.getElementById(triggerId);
  const panel   = document.getElementById(panelId);
  if (!trigger || !panel) return;
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (trigger.classList.contains("loading")) return;   // data still loading
    const isOpen = panel.classList.contains("open");
    closeDashDropdowns();
    if (!isOpen) {
      // Reset checkboxes to the last applied selection (discard any un-applied
      // draft left over from a previous open).
      syncPanelToCommitted(panelId);
      panel.classList.add("open");
      trigger.classList.add("open");
    }
  });
}

function closeDashDropdowns(e) {
  // A click *inside* an open panel (ticking a box, scrolling) must NOT close it.
  if (e && e.target && e.target.closest && e.target.closest(".dash-dd-panel")) return;
  document.querySelectorAll(".dash-dd-panel").forEach(p => p.classList.remove("open"));
  document.querySelectorAll(".dash-dd-trigger").forEach(t => t.classList.remove("open"));
  // Revert any un-applied draft label back to the committed selection.
  if (dashLoaded) {
    updateDashCommunityLabelFrom(dashCommunitySel || []);
    updateDashDistrictLabelFrom(dashDistrictSel || []);
    updateDashMonthLabelFrom(dashMonthSel || []);
    updateDashCategoryLabelFrom(dashCategorySel || []);
    updateDashAwardLabelFrom(dashAwardSel || []);
  }
}

function isDashVisible() {
  const dash = document.getElementById("pomDashView");
  return !!(dash && dash.classList.contains("active"));
}

// Fetch ALL districts × ALL months once, flatten into dashAllData, and cache
// per (district, month) so we never refetch. Shows NO full-screen loader.
//
// Requests run with LIMITED CONCURRENCY (the Apps Script endpoint errors out if
// hit with hundreds of parallel requests) and each cell is retried a few times.
// A cell that still fails is treated as empty rather than failing the whole load
// — one bad request must never blow up the dashboard or surface an error.
async function loadDashData(onProgress) {
  const districtEl = document.getElementById("pomDistrict");
  const opts = districtEl ? Array.from(districtEl.options).map(o => o.value).filter(Boolean) : [];
  dashDistrictsList = opts;

  // ── FAST PATH ────────────────────────────────────────────────────────────
  // One request returns EVERY record (needs the getAllRecords action in the
  // Apps Script Code.gs). If that action isn't deployed yet the endpoint replies
  // with a non-array status object, so we detect that and fall back to the
  // per-cell load below — this works whether or not Code.gs has been updated.
  try {
    if (onProgress) onProgress(15, 100);
    const res = await fetch(`${API_URL}?action=getAllRecords`);
    const all = await res.json();
    if (Array.isArray(all)) {
      dashAllData = all.map(r => ({ ...r, _month: r.month, _district: r.districtName }));
      if (onProgress) onProgress(100, 100);
      return { opts, failures: 0, totalJobs: all.length };
    }
    // Not an array → action not deployed; fall through to the slower method.
  } catch (e) {
    console.warn("getAllRecords unavailable — using the slower per-cell load.", e);
  }

  // ── FALLBACK (old method: one request per district × month) ───────────────
  if (!dashAllData._cache) dashAllData._cache = {};
  const cache = dashAllData._cache;

  // Reuse anything the management view already fetched for the selected district
  // so we don't re-download those month cells.
  const curDist = (districtEl && districtEl.value) || "";
  if (curDist) {
    Object.entries(monthCache).forEach(([month, recs]) => {
      const key = `${curDist}||${month}`;
      if (!cache[key] && Array.isArray(recs)) cache[key] = recs;
    });
  }

  // Only fetch cells we don't already have cached.
  const jobs = [];
  opts.forEach(dist => allMonths.forEach(month => {
    const key = `${dist}||${month}`;
    if (!cache[key]) jobs.push({ dist, month, key });
  }));

  const CONCURRENCY = 20;
  let failures = 0;
  let next = 0;
  let done = 0;

  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++];
      let ok = false;
      for (let attempt = 0; attempt < 2 && !ok; attempt++) {
        try {
          // Exactly the request the management view uses. NO res.ok gate:
          // Apps Script answers through a redirect and res.ok can read false on
          // a perfectly good response, which would fail every request. Just
          // parse the JSON like your original code did.
          const res  = await fetch(`${API_URL}?action=getRecords&month=${encodeURIComponent(job.month)}&district=${encodeURIComponent(job.dist)}`);
          const recs = await res.json();
          cache[job.key] = Array.isArray(recs) ? recs : [];
          ok = true;
        } catch (e) {
          if (attempt < 1) {
            await new Promise(r => setTimeout(r, 300));   // brief back-off, one retry
          } else {
            failures++;   // give up on this cell; leave it UNcached so a later retry re-attempts it
          }
        }
      }
      done++;
      if (onProgress) onProgress(done, jobs.length);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(CONCURRENCY, jobs.length)) }, worker)
  );

  // Rebuild the flat results array from the cache.
  const results = [];
  opts.forEach(dist => allMonths.forEach(month => {
    (cache[`${dist}||${month}`] || []).forEach(r => results.push({ ...r, _month: month, _district: dist }));
  }));
  results._cache = cache;
  dashAllData = results;

  return { opts, failures, totalJobs: jobs.length };
}

// Start the background load. Idempotent and safe to call early — it no-ops
// until the district dropdown is populated, and again once data is loaded.
function startDashPrefetch() {
  if (dashLoaded || dashLoading) return;
  const districtEl = document.getElementById("pomDistrict");
  const hasOpts = districtEl && Array.from(districtEl.options).some(o => o.value);
  if (!hasOpts) return;

  if (dashRetryTimer) { clearTimeout(dashRetryTimer); dashRetryTimer = null; }
  dashLoading = true;
  setDashTabLoading(true);
  setDashFiltersLoading(true);
  if (isDashVisible()) setDashTableLoading();

  loadDashData((done, total) => bumpDashProgress(done, total))
    .then(({ opts, failures, totalJobs }) => {
      dashLoading = false;
      // Every request failed (endpoint or network down) → not really loaded.
      // Keep the loading UI up and quietly retry; never show an error.
      if (totalJobs > 0 && failures >= totalJobs) {
        setDashRefreshing(false);
        scheduleDashRetry();
        return;
      }
      dashRetryDelay = 3000;
      dashLoaded = true;
      populateDashFilters(opts);            // builds filters → clears loading state
      finishDashProgress();                 // snap the counter to 100%
      if (isDashVisible()) renderPomDashboard();
      setDashRefreshing(false);             // restore the Refresh Data button
      setTimeout(() => setDashTabLoading(false), 350);   // show 100% briefly, then enable the tab
    })
    .catch(err => {
      // Should be rare since loadDashData swallows per-request errors. Stay in
      // the loading state and retry rather than surfacing an error to the user.
      console.error("Dashboard data load error:", err);
      dashLoading = false;
      setDashRefreshing(false);
      scheduleDashRetry();
    });
}

// Manual refresh (the "Refresh Data" button). The dashboard caches all records
// for the session, so edits made in Award Management don't appear until the data
// is re-fetched. This forces a fresh load while preserving the user's filters.
function refreshDashData() {
  if (dashLoading) return;                  // a load is already running
  setDashRefreshing(true);
  dashAllData = [];                         // drop cached records (and any per-cell cache)
  dashLoaded  = false;
  dashLoading = false;
  if (dashRetryTimer) { clearTimeout(dashRetryTimer); dashRetryTimer = null; }
  dashRetryDelay = 3000;
  // Keep dashCommunitySel / dashDistrictSel / dashMonthSel as-is so the current
  // filter selection survives the refresh.
  startDashPrefetch();
}

// Toggle the Refresh Data button between idle and the spinning "Refreshing…" state.
function setDashRefreshing(on) {
  const btn = document.getElementById("dashRefreshBtn");
  const txt = document.getElementById("dashRefreshTxt");
  if (btn) { btn.disabled = on; btn.classList.toggle("spinning", on); }
  if (txt) txt.textContent = on ? "Refreshing…" : "Refresh Data";
}

// Keep the loading state visible and retry the background load with a gentle
// backoff. The dashboard never shows an error or a premature "no data" state —
// while data isn't loaded it always shows "loading".
function scheduleDashRetry() {
  if (dashLoaded || dashRetryTimer) return;
  setDashFiltersLoading(true);
  if (isDashVisible()) setDashTableLoading();
  const delay = dashRetryDelay;
  dashRetryDelay = Math.min(dashRetryDelay + 3000, 15000);   // 3s → 6s → … → 15s cap
  dashRetryTimer = setTimeout(() => {
    dashRetryTimer = null;
    startDashPrefetch();
  }, delay);
}

// Loading state shown inside the three filters while data is being fetched.
function setDashFiltersLoading(on) {
  [["dashCommunityTrigger", "dashCommunityLabel"], ["dashDistrictTrigger", "dashDistrictLabel"], ["dashMonthTrigger", "dashMonthLabel"], ["dashCategoryTrigger", "dashCategoryLabel"], ["dashAwardTrigger", "dashAwardLabel"]].forEach(([tid, lid]) => {
    const t = document.getElementById(tid);
    const l = document.getElementById(lid);
    if (t) t.classList.toggle("loading", on);
    if (on && l) l.innerHTML = '<span class="dash-mini-spinner"></span>Loading…';
  });
}

function setDashTableLoading() {
  const tbody = document.getElementById("dashTableBody");
  if (tbody) tbody.innerHTML = `<tr><td colspan="12" class="dash-empty">Loading data…</td></tr>`;
}

// Districts/months that actually have data for the selected communities.
function communityFilterFn() {
  const selC = new Set(dashCommunitySel || []);
  return r => selC.size === 0 || selC.has(r.community);
}
// Award category lives on each record next to awardName. Field name isn't
// referenced elsewhere in the frontend, so read it defensively.
function recAwardCategory(r) {
  return r.awardCategory || r.awardCat || r.category || r.award_category || "";
}
function availableDistricts() {
  const inC = communityFilterFn();
  return dashDistrictsList.filter(d => dashAllData.some(r => inC(r) && r._district === d));
}
function availableMonths() {
  const inC = communityFilterFn();
  return allMonths.filter(m => dashAllData.some(r => inC(r) && r._month === m));
}
function availableCategories() {
  const inC = communityFilterFn();
  return [...new Set(dashAllData.filter(inC).map(recAwardCategory).filter(Boolean))].sort();
}
function availableAwardNames() {
  const inC = communityFilterFn();
  return [...new Set(dashAllData.filter(inC).map(r => r.awardName || "").filter(Boolean))].sort();
}

function populateDashFilters(districts) {
  if (districts && districts.length) dashDistrictsList = districts;

  // Community — multi-checkbox dropdown (the parent filter).
  const communities = [...new Set(dashAllData.map(r => r.community || "").filter(Boolean))].sort();
  dashCommunitySel = dashCommunitySel === null ? [...communities] : dashCommunitySel.filter(c => communities.includes(c));
  buildCheckboxList("dashCommunityItems", "dashCommunityAll", communities, dashCommunitySel);

  // District + Month: limited to whatever the selected communities actually have.
  const availD = availableDistricts();
  const availM = availableMonths();
  dashDistrictSel = dashDistrictSel === null ? [...availD] : dashDistrictSel.filter(d => availD.includes(d));
  dashMonthSel    = dashMonthSel    === null ? [...availM] : dashMonthSel.filter(m => availM.includes(m));

  buildCheckboxList("dashDistrictItems", "dashDistrictAll", availD, dashDistrictSel);
  buildCheckboxList("dashMonthItems",    "dashMonthAll",    availM, dashMonthSel);

  // Award Category + Award Name: also scoped to the selected communities.
  const availCat = availableCategories();
  const availAwd = availableAwardNames();
  dashCategorySel = dashCategorySel === null ? [...availCat] : dashCategorySel.filter(c => availCat.includes(c));
  dashAwardSel    = dashAwardSel    === null ? [...availAwd] : dashAwardSel.filter(a => availAwd.includes(a));

  buildCheckboxList("dashCategoryItems", "dashCategoryAll", availCat, dashCategorySel);
  buildCheckboxList("dashAwardItems",    "dashAwardAll",    availAwd, dashAwardSel);

  // Clear the loading visuals and show the committed labels.
  ["dashCommunityTrigger", "dashDistrictTrigger", "dashMonthTrigger", "dashCategoryTrigger", "dashAwardTrigger"].forEach(id => {
    const t = document.getElementById(id); if (t) t.classList.remove("loading");
  });
  updateDashCommunityLabelFrom(dashCommunitySel);
  updateDashDistrictLabelFrom(dashDistrictSel);
  updateDashMonthLabelFrom(dashMonthSel);
  updateDashCategoryLabelFrom(dashCategorySel);
  updateDashAwardLabelFrom(dashAwardSel);
}

// When the community selection changes, rebuild the child filters (District,
// Month, Award Category, Award Name) to only the values available for those
// communities, and select them all by default.
function rebuildDistrictMonthForCommunity() {
  const availD   = availableDistricts();
  const availM   = availableMonths();
  const availCat = availableCategories();
  const availAwd = availableAwardNames();
  dashDistrictSel = [...availD];
  dashMonthSel    = [...availM];
  dashCategorySel = [...availCat];
  dashAwardSel    = [...availAwd];
  buildCheckboxList("dashDistrictItems", "dashDistrictAll", availD,   dashDistrictSel);
  buildCheckboxList("dashMonthItems",    "dashMonthAll",    availM,   dashMonthSel);
  buildCheckboxList("dashCategoryItems", "dashCategoryAll", availCat, dashCategorySel);
  buildCheckboxList("dashAwardItems",    "dashAwardAll",    availAwd, dashAwardSel);
  updateDashDistrictLabelFrom(dashDistrictSel);
  updateDashMonthLabelFrom(dashMonthSel);
  updateDashCategoryLabelFrom(dashCategorySel);
  updateDashAwardLabelFrom(dashAwardSel);
}

// Build the checkbox list. Ticking boxes updates ONLY the draft label preview —
// it never re-renders the dashboard. Changes are committed on "Apply".
function buildCheckboxList(containerId, allId, items, committed) {
  const container = document.getElementById(containerId);
  const allCb = document.getElementById(allId);
  if (!container || !allCb) return;

  const set = new Set(committed);
  container.innerHTML = items.map(item => `
    <label class="dash-dd-item">
      <input type="checkbox" class="dash-cb-item" data-container="${containerId}" value="${item}" ${set.has(item) ? "checked" : ""}>
      ${item}
    </label>`).join("");

  const syncAll = () => {
    const all     = container.querySelectorAll(".dash-cb-item");
    const checked = container.querySelectorAll(".dash-cb-item:checked");
    allCb.checked       = all.length > 0 && all.length === checked.length;
    allCb.indeterminate = checked.length > 0 && checked.length < all.length;
  };
  syncAll();

  allCb.onchange = function () {
    container.querySelectorAll(".dash-cb-item").forEach(cb => cb.checked = allCb.checked);
    allCb.indeterminate = false;
    draftLabelUpdate(containerId);
  };
  container.querySelectorAll(".dash-cb-item").forEach(cb => {
    cb.onchange = function () { syncAll(); draftLabelUpdate(containerId); };
  });
}

function getChecked(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  return Array.from(container.querySelectorAll(".dash-cb-item:checked")).map(cb => cb.value);
}

// Reset a panel's checkboxes + label to the last committed (applied) selection.
function syncPanelToCommitted(panelId) {
  if (panelId === "dashDistrictPanel") {
    setChecks("dashDistrictItems", "dashDistrictAll", dashDistrictSel || []);
    updateDashDistrictLabelFrom(dashDistrictSel || []);
  } else if (panelId === "dashMonthPanel") {
    setChecks("dashMonthItems", "dashMonthAll", dashMonthSel || []);
    updateDashMonthLabelFrom(dashMonthSel || []);
  } else if (panelId === "dashCommunityPanel") {
    setChecks("dashCommunityItems", "dashCommunityAll", dashCommunitySel || []);
    updateDashCommunityLabelFrom(dashCommunitySel || []);
  } else if (panelId === "dashCategoryPanel") {
    setChecks("dashCategoryItems", "dashCategoryAll", dashCategorySel || []);
    updateDashCategoryLabelFrom(dashCategorySel || []);
  } else if (panelId === "dashAwardPanel") {
    setChecks("dashAwardItems", "dashAwardAll", dashAwardSel || []);
    updateDashAwardLabelFrom(dashAwardSel || []);
  }
}

function setChecks(containerId, allId, committed) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const set = new Set(committed);
  const all = container.querySelectorAll(".dash-cb-item");
  all.forEach(cb => cb.checked = set.has(cb.value));
  const allCb = document.getElementById(allId);
  if (allCb) {
    const checked = container.querySelectorAll(".dash-cb-item:checked").length;
    allCb.checked       = all.length > 0 && checked === all.length;
    allCb.indeterminate = checked > 0 && checked < all.length;
  }
}

// Commit a draft selection (called by the Apply buttons), then re-render + close.
function applyDashFilter(kind) {
  if (kind === "district") {
    dashDistrictSel = getChecked("dashDistrictItems");
    updateDashDistrictLabelFrom(dashDistrictSel);
  } else if (kind === "month") {
    dashMonthSel = getChecked("dashMonthItems");
    updateDashMonthLabelFrom(dashMonthSel);
  } else if (kind === "community") {
    dashCommunitySel = getChecked("dashCommunityItems");
    updateDashCommunityLabelFrom(dashCommunitySel);
    // Community is the parent filter → rebuild the child filters to match.
    rebuildDistrictMonthForCommunity();
  } else if (kind === "category") {
    dashCategorySel = getChecked("dashCategoryItems");
    updateDashCategoryLabelFrom(dashCategorySel);
  } else if (kind === "award") {
    dashAwardSel = getChecked("dashAwardItems");
    updateDashAwardLabelFrom(dashAwardSel);
  }
  closeDashDropdowns();
  renderPomDashboard();
}

// Live preview of the (un-applied) draft selection in the trigger label.
function draftLabelUpdate(containerId) {
  if (containerId === "dashDistrictItems")       updateDashDistrictLabelFrom(getChecked("dashDistrictItems"));
  else if (containerId === "dashMonthItems")     updateDashMonthLabelFrom(getChecked("dashMonthItems"));
  else if (containerId === "dashCommunityItems") updateDashCommunityLabelFrom(getChecked("dashCommunityItems"));
  else if (containerId === "dashCategoryItems")  updateDashCategoryLabelFrom(getChecked("dashCategoryItems"));
  else if (containerId === "dashAwardItems")     updateDashAwardLabelFrom(getChecked("dashAwardItems"));
}

function labelText(arr, total, allWord, manyWord) {
  if (arr.length === 0)               return "None";
  if (total && arr.length === total)  return allWord;
  if (arr.length === 1)               return arr[0];
  return `${arr.length} ${manyWord}`;
}

function updateDashCommunityLabelFrom(arr) {
  const total = document.querySelectorAll("#dashCommunityItems .dash-cb-item").length;
  const label = document.getElementById("dashCommunityLabel");
  if (label) label.textContent = labelText(arr, total, "All Communities", "Communities");
}

function updateDashDistrictLabelFrom(arr) {
  const total = document.querySelectorAll("#dashDistrictItems .dash-cb-item").length;
  const label = document.getElementById("dashDistrictLabel");
  if (label) label.textContent = labelText(arr, total, "All Districts", "Districts");
}

function updateDashMonthLabelFrom(arr) {
  const total = document.querySelectorAll("#dashMonthItems .dash-cb-item").length;
  const label = document.getElementById("dashMonthLabel");
  if (label) label.textContent = labelText(arr, total, "All Months", "Months");
}

function updateDashCategoryLabelFrom(arr) {
  const total = document.querySelectorAll("#dashCategoryItems .dash-cb-item").length;
  const label = document.getElementById("dashCategoryLabel");
  if (label) label.textContent = labelText(arr, total, "All Categories", "Categories");
}

function updateDashAwardLabelFrom(arr) {
  const total = document.querySelectorAll("#dashAwardItems .dash-cb-item").length;
  const label = document.getElementById("dashAwardLabel");
  if (label) label.textContent = labelText(arr, total, "All Awards", "Awards");
}

function pct(num, den) {
  if (!den) return "0%";
  return Math.round((num / den) * 100) + "%";
}

function renderPomDashboard() {
  // Data not ready yet → show the loading state in the filters + table and make
  // sure the background load is running.
  if (!dashLoaded) {
    if (!dashLoading) startDashPrefetch();
    setDashFiltersLoading(true);
    setDashTableLoading();
    return;
  }

  const selCommunities = new Set(dashCommunitySel || []);
  const selDistricts   = new Set(dashDistrictSel || []);
  const selMonths      = new Set(dashMonthSel || []);
  const selCategories  = new Set(dashCategorySel || []);
  const selAwards      = new Set(dashAwardSel || []);

  // Filter flat data
  let filtered = dashAllData.filter(r =>
    (selCommunities.size === 0 || selCommunities.has(r.community)) &&
    (selDistricts.size === 0   || selDistricts.has(r._district)) &&
    (selMonths.size === 0      || selMonths.has(r._month)) &&
    (selCategories.size === 0  || selCategories.has(recAwardCategory(r))) &&
    (selAwards.size === 0      || selAwards.has(r.awardName || ""))
  );

  // Group by month, preserving allMonths order
  const monthsToShow = allMonths.filter(m => selMonths.size === 0 || selMonths.has(m));
  const rows = monthsToShow.map(m => {
    const recs = filtered.filter(r => r._month === m);
    if (!recs.length) return null;
    const c = counts(recs, m);
    return { month: m, ...c };
  }).filter(Boolean);

  // Totals row
  const tot = rows.reduce((acc, r) => {
    acc.total        += r.total;
    acc.awarded      += r.awarded;
    acc.late         += r.late;
    acc.pending      += r.pending;
    acc.totalAwarded += r.totalAwarded;
    acc.verified     += r.verified;
    return acc;
  }, { total: 0, awarded: 0, late: 0, pending: 0, totalAwarded: 0, verified: 0 });

  // Remember exactly what's on screen so the Excel export matches the visible table.
  dashLastRows   = rows;
  dashLastTotals = tot;

  const tbody = document.getElementById("dashTableBody");
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="12" class="dash-empty">No data matches the selected filters</td></tr>`;
    drawPie(0, 0, 0);
    return;
  }

  const mkRow = (label, c, isTotals) => {
    const cls = isTotals ? "" : "left";
    return `<tr>
      <td class="${cls}">${label}</td>
      <td class="c-dark">${c.total}</td>
      <td class="c-ok">${c.awarded}</td><td class="pct c-ok">${pct(c.awarded, c.total)}</td>
      <td class="c-late">${c.late}</td><td class="pct c-late">${pct(c.late, c.total)}</td>
      <td class="c-warn">${c.pending}</td><td class="pct c-warn">${pct(c.pending, c.total)}</td>
      <td class="c-dark">${c.totalAwarded}</td><td class="pct">${pct(c.totalAwarded, c.total)}</td>
      <td class="c-blue">${c.verified}</td><td class="pct c-blue">${pct(c.verified, c.total)}</td>
    </tr>`;
  };

  tbody.innerHTML =
    rows.map(r => mkRow(r.month, r)).join("") +
    mkRow("Total", tot, true);

  drawPie(tot.awarded, tot.late, tot.pending);
}

// ── Pure-canvas pie chart ──
function drawPie(inTime, late, pending) {
  const canvas = document.getElementById("dashPieCanvas");
  const legend = document.getElementById("dashLegend");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 8;

  ctx.clearRect(0, 0, W, H);

  const total = inTime + late + pending;
  const COLORS = ["#16a34a", "#dc2626", "#d97706"];
  const LABELS = ["Awarded In Time", "Awarded Late", "Pending"];
  const values = [inTime, late, pending];

  if (!total) {
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = "#f3f4f6"; ctx.fill();
    if (legend) legend.innerHTML = `<div style="font-size:12px;color:#9ca3af;text-align:center;">No data</div>`;
    return;
  }

  let startAngle = -Math.PI / 2;
  values.forEach((val, i) => {
    if (!val) return;
    const slice = (val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = COLORS[i];
    ctx.fill();
    startAngle += slice;
  });

  // centre donut hole
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.48, 0, Math.PI * 2);
  ctx.fillStyle = "#fff"; ctx.fill();
  // centre label
  ctx.fillStyle = "#1a1d23"; ctx.font = `bold 18px inherit`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(total, cx, cy - 7);
  ctx.fillStyle = "#9ca3af"; ctx.font = `11px inherit`;
  ctx.fillText("Total", cx, cy + 12);

  if (legend) {
    legend.innerHTML = values.map((val, i) => `
      <div class="dash-legend-item">
        <span class="dash-legend-dot" style="background:${COLORS[i]}"></span>
        <span>${LABELS[i]}</span>
        <span class="dash-legend-val">${val} <span class="dash-legend-pct">(${pct(val, total)})</span></span>
      </div>`).join("");
  }
}
// ===============================
// DASHBOARD → EXCEL EXPORT
// Downloads the currently visible dashboard table as a real .xlsx file. Row 1
// records the applied filters. Self-contained (no external library): builds a
// minimal OOXML workbook and packs it into a stored ZIP in the browser.
// ===============================

// A readable summary of each filter's committed selection (matches the labels
// the user sees: "All X" when everything is selected, otherwise the list).
function _dashFilterPart(label, sel, itemsContainerId, allWord) {
  const arr = sel || [];
  const total = document.querySelectorAll(`#${itemsContainerId} .dash-cb-item`).length;
  let val;
  if (arr.length === 0)                     val = "None";
  else if (total && arr.length === total)   val = allWord;
  else                                      val = arr.join(", ");
  return `${label}: ${val}`;
}
function dashFilterSummary() {
  return "Filters applied —  " + [
    _dashFilterPart("Community",      dashCommunitySel, "dashCommunityItems", "All Communities"),
    _dashFilterPart("District",       dashDistrictSel,  "dashDistrictItems",  "All Districts"),
    _dashFilterPart("Month",          dashMonthSel,     "dashMonthItems",     "All Months"),
    _dashFilterPart("Award Category", dashCategorySel,  "dashCategoryItems",  "All Categories"),
    _dashFilterPart("Award Name",     dashAwardSel,     "dashAwardItems",     "All Awards"),
  ].join("    |    ");
}

function downloadDashboardExcel() {
  if (!dashLoaded) { showToast("Dashboard data is still loading.", "info"); return; }
  const rows = dashLastRows || [];
  if (!rows.length) { showToast("No data to export for the current filters.", "info"); return; }
  const tot = dashLastTotals || { total: 0, awarded: 0, late: 0, pending: 0, totalAwarded: 0, verified: 0 };

  const header = ["Month", "Total Awards", "Awarded In Time", "In Time %", "Awarded Late",
    "Late %", "Pending", "Pending %", "Total Awarded", "Awarded %", "Verified", "Verified %"];
  const rowFor = (label, c) => [
    label, c.total,
    c.awarded, pct(c.awarded, c.total),
    c.late, pct(c.late, c.total),
    c.pending, pct(c.pending, c.total),
    c.totalAwarded, pct(c.totalAwarded, c.total),
    c.verified, pct(c.verified, c.total),
  ];

  const aoa = [
    [dashFilterSummary()],   // Row 1: applied filters
    [],                      // Row 2: spacer
    header,                  // Row 3: column headers
    ...rows.map(r => rowFor(r.month, r)),
    rowFor("Total", tot),
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  try {
    const bytes = _buildXlsx(aoa, "Award Data");
    _downloadBytes(bytes, `POM_Award_Data_${stamp}.xlsx`,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    showToast("Excel downloaded.");
  } catch (e) {
    console.error("Excel export failed:", e);
    showToast("Could not generate the Excel file.", "error");
  }
}

function _downloadBytes(bytes, filename, mime) {
  const blob = new Blob([bytes], { type: mime || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- Minimal, dependency-free .xlsx writer ----
function _xmlEsc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function _colLetter(n) { let s = ""; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

function _sheetXml(aoa) {
  let body = "";
  aoa.forEach((row, r) => {
    const cells = (row || []).map((val, c) => {
      if (val === null || val === undefined || val === "") return "";
      const ref = _colLetter(c) + (r + 1);
      if (typeof val === "number" && isFinite(val)) return `<c r="${ref}"><v>${val}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${_xmlEsc(val)}</t></is></c>`;
    }).join("");
    body += `<row r="${r + 1}">${cells}</row>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${body}</sheetData></worksheet>`;
}

function _buildXlsx(aoa, sheetName) {
  const name = _xmlEsc((sheetName || "Sheet1").slice(0, 31));
  const files = [
    ["[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`],
    ["_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`],
    ["xl/worksheets/sheet1.xml", _sheetXml(aoa)],
  ];
  return _zipStore(files);
}

// CRC-32 (used by the ZIP container).
function _crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Pack files into a STORED (uncompressed) ZIP → returns a Uint8Array.
function _zipStore(files) {
  const enc = new TextEncoder();
  const u16 = (n) => [n & 255, (n >> 8) & 255];
  const u32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];

  const parts = [];   // local headers + data
  const central = [];
  let offset = 0;

  files.forEach(([fname, content]) => {
    const nameB = enc.encode(fname);
    const dataB = enc.encode(content);
    const crc = _crc32(dataB);
    const size = dataB.length;

    const local = new Uint8Array([].concat(
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size), u16(nameB.length), u16(0)
    ));
    parts.push(local, nameB, dataB);

    central.push(new Uint8Array([].concat(
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size), u16(nameB.length),
      u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset)
    )), nameB);

    offset += local.length + nameB.length + dataB.length;
  });

  const cdStart = offset;
  let cdSize = 0; central.forEach(c => cdSize += c.length);
  const eocd = new Uint8Array([].concat(
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(cdSize), u32(cdStart), u16(0)
  ));

  const all = parts.concat(central, [eocd]);
  let total = 0; all.forEach(a => total += a.length);
  const out = new Uint8Array(total);
  let p = 0; all.forEach(a => { out.set(a, p); p += a.length; });
  return out;
}