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
  const uploadCtl = locked
    ? `<button class="icon-btn" disabled title="${LOCK_MSG}">${UPLOAD_SVG}</button>`
    : `<label class="icon-btn" title="Upload image">${UPLOAD_SVG}
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
  const editCtl = locked
    ? `<button class="icon-btn" disabled title="${LOCK_MSG}">${PENCIL_SVG}</button>`
    : `<button class="icon-btn" title="Write description" onclick="editDescription(${index})">${PENCIL_SVG}</button>`;
  return `${editCtl}<button class="icon-btn" title="View description" ${has ? "" : "disabled"} onclick="viewDescription(${index})">${EYE_SVG}</button>`;
}

function renderVerifyCell(index) {
  const r = currentRecords[index];
  if (r.verified === "Yes") {
    const verifierName = nameFromEmail(r.verifiedBy || "");
    return `<span class="verified-badge">${CHECK_SVG} Verified</span>${verifierName ? `<span class="cell-sublabel" title="${r.verifiedBy}">${verifierName}</span>` : ""}`;
  }
  if (!isVerifier)
    return `<span class="verify-na" title="Verifier access required">🔒 No access</span>`;
  return `<button class="verify-btn" onclick="verifyRecord(${index})">Verify</button>`;
}

function renderTable() {
  const tbody = document.getElementById("pomTableBody");

  if (!currentRecords || currentRecords.length === 0) {
    resetDetail("No Records Found");
    return;
  }

  tbody.innerHTML = currentRecords.map((r, i) => {
    const locked = r.verified === "Yes";
    const dis = locked ? "disabled" : "";
    const lt = locked ? `title="${LOCK_MSG}"` : "";
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
      <td class="img-cell" id="imgcell-${i}">${renderImageCell(i, false, locked)}</td>
      <td class="img-cell" id="desccell-${i}">${renderDescCell(i, locked)}</td>
      <td class="verify-cell col-center" id="verify-${i}">${renderVerifyCell(i)}</td>
      <td class="col-center" id="unlock-${i}">${locked && isVerifier ? `<button class="unlock-btn" onclick="unlockRecord(${i})">Unlock</button>` : ""}</td>
    </tr>`;
  }).join("");
}

function resetDetail(msg) {
  document.getElementById("pomTableBody").innerHTML =
    `<tr><td colspan="9" style="text-align:center;color:#9ca3af;padding:28px;">${msg}</td></tr>`;
}

window.updateField = function (index, field, value) {
  currentRecords[index][field] = value;
  dirty = true;
  if ((field === "awarded" || field === "awardedDate") && selectedMonth) updateMonthRow(selectedMonth);
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
  const existingUrl = currentRecords[index].folderLink;

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
    cell.innerHTML = renderImageCell(index, true, false);
    showToast("Image uploaded.");
  } catch (e) {
    console.error(e);
    cell.innerHTML = renderImageCell(index) + '<span class="img-status error">Failed — retry</span>';
    showToast("Image upload failed.", "error");
  }
};

window.viewImage = function (index) {
  const url = currentRecords[index].folderLink;
  if (!url) return;
  const id = driveId(url);
  document.getElementById("pomImgEl").src = id
    ? `https://drive.google.com/thumbnail?id=${id}&sz=w1600-h1200`
    : url;
  document.getElementById("pomImgModal").classList.add("open");
  console.log("Viewing image:", url, "→", document.getElementById("pomImgEl").src);
  console.log("id", id);
};

function closeImageModal() {
  document.getElementById("pomImgModal").classList.remove("open");
  document.getElementById("pomImgEl").src = "";
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
  dirty = true;
  const cell = document.getElementById("desccell-" + index);
  if (cell) cell.innerHTML = renderDescCell(index, currentRecords[index].verified === "Yes");
};

window.viewDescription = function (index) {
  showModal({
    title: "Description",
    message: currentRecords[index].description || "(no description)",
    buttons: [{ label: "Close", value: true, variant: "primary" }]
  });
};

// ===============================
// VERIFY (verifier-only; persists immediately)
// ===============================
window.verifyRecord = async function (index) {
  if (!isVerifier) { showToast("You don't have verifier access.", "error"); return; }

  const cell = document.getElementById("verify-" + index);
  cell.innerHTML = '<span class="img-status">⏳ Verifying…</span>';

  const me = currentUser();
  const rec = currentRecords[index];
  rec.verified = "Yes";
  rec.verifiedBy = me;
  rec.late = isLate(rec, selectedMonth) ? "Yes" : "No";

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "saveRecords", records: [{ ...rec, _override: true }] })
    });
    const out = await res.json();
    if (!out.success) throw new Error("Save failed");

    if (selectedMonth) { monthCache[selectedMonth] = currentRecords; updateMonthRow(selectedMonth); }
    renderTable();   // re-render so the row locks
    showToast("Record verified.");
  } catch (e) {
    console.error(e);
    rec.verified = ""; rec.verifiedBy = "";
    cell.innerHTML = renderVerifyCell(index);
    const unlockCell = document.getElementById("unlock-" + index);
    if (unlockCell) unlockCell.innerHTML = "";
    showToast("Verification failed.", "error");
  }
};

// ===============================
// UNLOCK (verifier-only): clears verification so the row becomes editable.
// ===============================
window.unlockRecord = async function (index) {
  if (!isVerifier) { showToast("Only a verifier can unlock a record.", "error"); return; }

  const cell = document.getElementById("verify-" + index);
  cell.innerHTML = '<span class="img-status">⏳ Unlocking…</span>';

  const rec = currentRecords[index];
  const prevV = rec.verified, prevBy = rec.verifiedBy;
  rec.verified = "";
  rec.verifiedBy = "";

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "saveRecords", records: [{ ...rec, _override: true }] })
    });
    const out = await res.json();
    if (!out.success) throw new Error("Save failed");

    if (selectedMonth) { monthCache[selectedMonth] = currentRecords; updateMonthRow(selectedMonth); }
    renderTable();   // re-render so the row unlocks
    showToast("Row unlocked.");
  } catch (e) {
    console.error(e);
    rec.verified = prevV; rec.verifiedBy = prevBy;
    cell.innerHTML = renderVerifyCell(index);
    showToast("Unlock failed.", "error");
  }
};

// ===============================
// SAVE (only awarded = "Yes" rows). Returns true on success.
// Re-pulls the month afterwards so the saved state shows without a reload.
// ===============================
async function saveRecords() {
  const toSave = currentRecords
    .filter(r => r.awarded === "Yes")
    .map(r => ({ ...r, late: isLate(r, selectedMonth) ? "Yes" : "No" }));

  if (!toSave.length) { showToast("No awarded (Yes) records to save.", "error"); return false; }

  const btn = document.getElementById("savePomBtn");
  btn.disabled = true;
  btn.innerText = "Saving...";
  showLoader();
  try {
    const saveUrl =
      `${API_URL}?action=saveRecords&records=` +
      encodeURIComponent(JSON.stringify(toSave));
    const result = await (await fetch(saveUrl)).json();
    if (!result.success) throw new Error("Save failed");

    // pull fresh server truth → reflects immediately, no page reload
    if (selectedMonth) {
      await refetchMonth(selectedMonth);
      currentRecords = monthCache[selectedMonth];
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
    } else {
      showToast("Records saved successfully.");
    }
    return true;
  } catch (e) {
    console.error(e);
    showToast("Failed to save records.", "error");
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

  loadFilters();
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
};