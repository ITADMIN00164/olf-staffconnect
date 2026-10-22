import { app } from "./firebase-config.js";

import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

import {
    getFirestore,
    collection,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    addDoc,
    deleteDoc,
    doc,
    query,
    where,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/* ====================================
   SHEETJS LOADER
   Loaded once on first use so we don't
   block initial page load.
==================================== */

let _xlsxReady = null;
function loadXLSX() {
    if (_xlsxReady) return _xlsxReady;
    _xlsxReady = new Promise((resolve, reject) => {
        if (window.XLSX) { resolve(window.XLSX); return; }
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
        s.onload  = () => resolve(window.XLSX);
        s.onerror = () => reject(new Error("Failed to load SheetJS"));
        document.head.appendChild(s);
    });
    return _xlsxReady;
}

/* ====================================
   INIT
==================================== */

const auth     = getAuth(app);
const db       = getFirestore(app);
const provider = new GoogleAuthProvider();

// Only this account sees/can use the Org Admin (states/districts/blocks +
// assignments) page. This is a UI convenience only - pos.js re-checks the
// same email itself before rendering anything, exactly like po.js does for
// PO Review, because a hidden button is not real access control.
const ORG_ADMIN_EMAIL = "itadmin@openlinksfoundation.org";

let currentRole      = "User";
let employees        = [];
let schemaFields     = [];
let currentMode      = "add";
let currentEditingId = null;
let currentPage      = "home";
let newsRefreshInterval = null;

/* ====================================
   AUDIT TRAIL
==================================== */

/**
 * Write one document to the `audittrail` Firestore collection.
 *
 * @param {string} action   - e.g. "employee-added", "employee-edited",
 *                            "employee-deleted", "news-added", "news-deleted"
 * @param {Object} details  - action-specific payload (see callers below)
 */
async function logAudit(action, details = {}) {
    if (String(action).startsWith("employee-")) { orgGeography = null; staffDirectory = null; }
    try {
        await addDoc(collection(db, "audittrail"), {
            action,
            performedBy: auth.currentUser?.email || "unknown",
            timestamp: serverTimestamp(),
            ...details
        });
    } catch (err) {
        // Audit failures must never break the main flow — just log quietly
        console.warn("Audit log failed:", err);
    }
}

/* ====================================
   CORE FIELDS
==================================== */

const CORE_FIELDS = [
    { key: "Name",              label: "Full Name",        placeholder: "Full name"       },
    { key: "Designation",       label: "Designation",      placeholder: "Job title"       },
    { key: "Dept",              label: "Department",       placeholder: "Department"      },
    { key: "Location",          label: "Location",         placeholder: "Office location" },
    { key: "Email",             label: "Email",            placeholder: "Work email",  type: "email" },
    { key: "Mobile",            label: "Mobile",           placeholder: "Phone number"    },
    { key: "Reporting manager", label: "Reporting Manager",placeholder: "Manager's name"  },

    // Someone who leaves is marked Inactive rather than deleted, so their
    // record survives for history. Absent counts as Active: the directory
    // predates this field and nobody should have to backfill 166 rows.
    { key: "Status",            label: "Status",           placeholder: "Active",
                                optional: true, choices: ["Active", "Inactive"] },

    // Geography, widest area first: State > Division > District > Block. These
    // arrived after the directory was already live, so every one of them is
    // optional - an Excel file prepared before they existed still validates,
    // and a record with no geography simply shows "—". All but State are
    // many-valued (see MULTI_VALUE_FIELDS): one person can cover several
    // divisions, dozens of districts and hundreds of blocks, each stored as a
    // single ";"-separated string.
    { key: "State",             label: "State",            placeholder: "e.g. Maharashtra", optional: true },
    { key: "Division",          label: "Division",         placeholder: "Divisions covered, separated by ;",
                                optional: true, multiline: true },
    { key: "District",          label: "District",         placeholder: "Districts covered, separated by ;",
                                optional: true, multiline: true },
    { key: "Block",             label: "Block",            placeholder: "Blocks covered, separated by ;",
                                optional: true, multiline: true }
];

const CORE_KEYS = CORE_FIELDS.map(f => f.key);

// Columns an uploaded file is allowed to leave out entirely (see above).
const OPTIONAL_KEYS = new Set(CORE_FIELDS.filter(f => f.optional).map(f => f.key));

const STATUS_VALUES = ["Active", "Inactive"];

/* A record with no Status is Active - the field arrived after the directory
   did, so absence means "nobody has said otherwise". */
function isActiveEmployee(emp) {
    return String((emp || {})["Status"] || "").trim().toLowerCase() !== "inactive";
}

/* A blank cell never erases anything, which is what keeps an upload from
   wiping columns it simply does not carry. Clearing a value therefore has to be
   asked for out loud: a cell holding exactly this token empties that field. */
const CLEAR_TOKEN = "#CLEAR";

function isClearToken(value) {
    return String(value).trim().toUpperCase() === CLEAR_TOKEN;
}

/* Fields that hold several values in one ";"-separated string. District and
   Block mirror the assignment data the Field Review System keeps
   (assigned_districts and assigned_blocks); Division follows the same shape
   because one person can work across more than one. */
const MULTI_VALUE_FIELDS = {
    "Division": { one: "division", many: "divisions" },
    "District": { one: "district", many: "districts" },
    "Block":    { one: "block",    many: "blocks"    }
};

/* ====================================
   DOM REFS
==================================== */

const loadingScreen = document.getElementById("loadingScreen");
const signinPage    = document.getElementById("signinPage");
const appShell      = document.getElementById("appShell");
const pageContent   = document.getElementById("pageContent");
const loginBtn      = document.getElementById("loginBtn");
const logoutBtn     = document.getElementById("logoutBtn");
const topbarName    = document.getElementById("topbarName");
const topbarRole    = document.getElementById("topbarRole");
const topbarAvatar  = document.getElementById("topbarAvatar");

// News modal refs
const newsModal          = document.getElementById("newsModal");
const closeNewsModalBtn  = document.getElementById("closeNewsModalBtn");
const closeNewsModalBtn2 = document.getElementById("closeNewsModalBtn2");
const saveNewsBtn        = document.getElementById("saveNewsBtn");

loginBtn.addEventListener("click", login);
logoutBtn.addEventListener("click", logout);

// News modal events (Add News button itself lives on the Home page)
closeNewsModalBtn.addEventListener("click",  () => newsModal.classList.remove("open"));
closeNewsModalBtn2.addEventListener("click", () => newsModal.classList.remove("open"));
saveNewsBtn.addEventListener("click", saveNews);
wireNewsEditor();

// Custom date & time picker + announcement detail modal (both static in index.html)
wireDateTimePicker();
document.getElementById("closeNewsDetailBtn")?.addEventListener("click",
    () => document.getElementById("newsDetailModal").classList.remove("open"));
document.getElementById("closeNewsDetailBtn2")?.addEventListener("click",
    () => document.getElementById("newsDetailModal").classList.remove("open"));

// Sidebar collapse/expand
const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
const appSidebar       = document.getElementById("appSidebar");

if (sidebarToggleBtn && appSidebar) {
    if (localStorage.getItem("olf_sidebar_collapsed") === "1") {
        appSidebar.classList.add("collapsed");
        sidebarToggleBtn.title = "Expand sidebar";
    }
    sidebarToggleBtn.addEventListener("click", () => {
        const collapsed = appSidebar.classList.toggle("collapsed");
        localStorage.setItem("olf_sidebar_collapsed", collapsed ? "1" : "0");
        sidebarToggleBtn.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
    });
}

/* ====================================
   IN-APP NOTIFICATIONS
   Replaces native alert()/confirm() with
   styled, in-app toasts and a modal so
   users never see a browser popup.
==================================== */

const NOTIFY_ICONS = { success: "✅", error: "⛔", warning: "⚠️", info: "ℹ️" };

// Lightweight toast for quick, non-blocking feedback (auto-dismisses).
function notify(message, type = "info", duration = 4500) {
    const container = document.getElementById("toastContainer");
    if (!container) { console.log(`[${type}] ${message}`); return; }

    const toast = document.createElement("div");
    toast.className = `app-toast app-toast--${type}`;
    toast.innerHTML = `
        <span class="app-toast-icon">${NOTIFY_ICONS[type] || NOTIFY_ICONS.info}</span>
        <span class="app-toast-msg">${escHtml(message)}</span>
        <button class="app-toast-close" aria-label="Dismiss">✕</button>
    `;
    container.appendChild(toast);

    const remove = () => {
        toast.classList.add("app-toast--leaving");
        setTimeout(() => toast.remove(), 180);
    };
    toast.querySelector(".app-toast-close").addEventListener("click", remove);
    if (duration > 0) setTimeout(remove, duration);
}

// Blocking message modal — replaces alert(). Resolves once the user clicks OK.
// Optionally renders a bulleted `list` of items (e.g. validation errors).
function showAppAlert({ title = "Notice", message = "", type = "info", list = null, okText = "OK" } = {}) {
    return new Promise(resolve => {
        const modal = document.getElementById("appMsgModal");
        if (!modal) { console.log(`[${type}] ${title}: ${message}`); resolve(true); return; }

        document.getElementById("appMsgIcon").textContent  = NOTIFY_ICONS[type] || NOTIFY_ICONS.info;
        document.getElementById("appMsgIcon").className    = `app-msg-icon app-msg-icon--${type}`;
        document.getElementById("appMsgTitle").textContent = title;
        document.getElementById("appMsgText").innerHTML    = escHtml(message).replace(/\n/g, "<br>");

        const listEl = document.getElementById("appMsgList");
        if (list && list.length) {
            listEl.innerHTML = list.map(item => `<li>${escHtml(item)}</li>`).join("");
            listEl.style.display = "block";
        } else {
            listEl.style.display = "none";
        }

        const cancelBtn = document.getElementById("appMsgCancelBtn");
        const okBtn      = document.getElementById("appMsgOkBtn");
        cancelBtn.style.display = "none";
        okBtn.textContent = okText;

        const onOk = () => {
            modal.classList.remove("open");
            okBtn.removeEventListener("click", onOk);
            resolve(true);
        };
        okBtn.addEventListener("click", onOk);
        modal.classList.add("open");
    });
}

// Blocking confirm modal — replaces confirm(). Resolves true/false based on the user's choice.
function showAppConfirm({ title = "Please confirm", message = "", type = "warning", list = null, confirmText = "Continue", cancelText = "Cancel" } = {}) {
    return new Promise(resolve => {
        const modal = document.getElementById("appMsgModal");
        if (!modal) { resolve(window.confirm(message)); return; }

        document.getElementById("appMsgIcon").textContent  = NOTIFY_ICONS[type] || NOTIFY_ICONS.warning;
        document.getElementById("appMsgIcon").className    = `app-msg-icon app-msg-icon--${type}`;
        document.getElementById("appMsgTitle").textContent = title;
        document.getElementById("appMsgText").innerHTML    = escHtml(message).replace(/\n/g, "<br>");

        const listEl = document.getElementById("appMsgList");
        if (list && list.length) {
            listEl.innerHTML = list.map(item => `<li>${escHtml(item)}</li>`).join("");
            listEl.style.display = "block";
        } else {
            listEl.style.display = "none";
        }

        const cancelBtn = document.getElementById("appMsgCancelBtn");
        const okBtn      = document.getElementById("appMsgOkBtn");
        cancelBtn.style.display = "inline-block";
        cancelBtn.textContent   = cancelText;
        okBtn.textContent       = confirmText;

        const cleanup = (result) => {
            modal.classList.remove("open");
            okBtn.removeEventListener("click", onOk);
            cancelBtn.removeEventListener("click", onCancel);
            resolve(result);
        };
        const onOk     = () => cleanup(true);
        const onCancel = () => cleanup(false);
        okBtn.addEventListener("click", onOk);
        cancelBtn.addEventListener("click", onCancel);

        modal.classList.add("open");
    });
}

/* ====================================
   EXPOSE SHARED HELPERS
   Lets non-module scripts (calendar.js,
   smartgoal.js, gr.js) reuse the in-app
   toast / alert / confirm helpers.
==================================== */

window.notify        = notify;
window.showAppAlert  = showAppAlert;
window.showAppConfirm = showAppConfirm;

/* ====================================
   AUTH STATE
==================================== */

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const email   = user.email.toLowerCase();
        const isAdmin    = await isEmailAdmin(email);
        const isEmployee = isAdmin || await isEmailInDirectory(email);

        if (!isEmployee) {
            await signOut(auth);
            hideLoading();
            showSignin();
            showAccessDenied(user.email);
            return;
        }

        currentRole = isAdmin ? "Admin" : "User";
        updateTopbar(user);
        showApp();
        loadMyEmployeeRecord(email);   // fills the profile chip / ID card
        prefetchPages();               // warm page fragments while idle
        maybeShowNewsPopup();          // once-per-session announcement nudge

        await navigate("home");
    } else {
        currentRole = "User";
        showSignin();
    }
    hideLoading();
});

/* ====================================
   LOGIN / LOGOUT
==================================== */

async function login() {
    try {
        await signInWithPopup(auth, provider);
    } catch (err) {
        console.error(err);
        await showAppAlert({ title: "Sign-in failed", message: err.message, type: "error" });
    }
}

async function logout() {
    try {
        await signOut(auth);
    } catch (err) {
        console.error(err);
        await showAppAlert({ title: "Sign-out failed", message: err.message, type: "error" });
    }
}

/* ====================================
   ADMIN CHECK (Firestore collection)
==================================== */

async function isEmailAdmin(email) {
    try {
        const snapshot = await getDocs(collection(db, "admin"));
        for (const d of snapshot.docs) {
            const data = d.data();
            if (data["Email ID"] && data["Email ID"].toLowerCase() === email) return true;
        }
        return false;
    } catch (err) {
        console.error("Admin check failed:", err);
        return false;
    }
}

/* ====================================
   CALENDAR ADMIN CHECK (Firestore)
   Emails in the "Calendar Admin" collection
   can add events + open Settings on the
   Program Calendar page. Everyone else
   is view-only.
==================================== */

async function isCalendarAdmin(email) {
    try {
        const snapshot = await getDocs(collection(db, "Calendar Admin"));
        for (const d of snapshot.docs) {
            const data = d.data();
            const val = data["Email"] || data["Email ID"] || data["email"];
            if (val && String(val).toLowerCase() === email) return true;
        }
        return false;
    } catch (err) {
        console.error("Calendar admin check failed:", err);
        return false;
    }
}

/* ====================================
   SMART GOALS ADMIN CHECK (Firestore)
   Emails in the "Plan Admin" collection
   can edit goals/tasks/reviews and open
   Settings on the Smart Goals page.
   Everyone else is mapped to their member
   record (view/edit own) via email.
==================================== */

async function isSmartGoalsAdmin(email) {
    try {
        const snapshot = await getDocs(collection(db, "Plan Admin"));
        for (const d of snapshot.docs) {
            const data = d.data();
            const val = data["Email"] || data["Email ID"] || data["email"];
            if (val && String(val).toLowerCase() === email) return true;
        }
        return false;
    } catch (err) {
        console.error("Smart Goals admin check failed:", err);
        return false;
    }
}

/* ====================================
   GR / CIRCULAR VALIDATOR CHECK (Firestore)
   Emails in the "GR_Circular_Validator"
   collection may validate / reject uploaded
   GRs & Circulars. Everyone else can upload
   and view, but not validate.
   (Matches either the Email field or the doc id.)
==================================== */

async function isGrCircularValidator(email) {
    try {
        const snapshot = await getDocs(collection(db, "GR_Circular_Validator"));
        for (const d of snapshot.docs) {
            if (d.id && d.id.toLowerCase() === email) return true;
            const data = d.data();
            const val = data["Email"] || data["Email ID"] || data["email"];
            if (val && String(val).toLowerCase() === email) return true;
        }
        return false;
    } catch (err) {
        console.error("GR/Circular validator check failed:", err);
        return false;
    }
}

/* ====================================
   PLAN ADMIN WRITES (exposed to smartgoal.js)
   Lets the Smart Goals "Add / remove Admin"
   buttons grant/revoke real Settings access by
   writing to the Firestore "Plan Admin" collection.
   Doc id = the email (idempotent, easy to delete).
==================================== */

window.PlanAdmins = {
    async add(email) {
        const clean = String(email || "").trim().toLowerCase();
        if (!clean) throw new Error("Email is required to grant admin access");
        await setDoc(doc(db, "Plan Admin", clean), { Email: clean });
        return clean;
    },
    async remove(email) {
        const clean = String(email || "").trim().toLowerCase();
        if (!clean) return;
        // remove the email-keyed doc (if present)
        try { await deleteDoc(doc(db, "Plan Admin", clean)); } catch (e) {}
        // also remove any legacy docs (auto-id or "1") whose Email field matches
        try {
            const snap = await getDocs(collection(db, "Plan Admin"));
            for (const d of snap.docs) {
                const v = d.data();
                const val = String(v.Email || v["Email ID"] || v.email || "").toLowerCase();
                if (val === clean) { try { await deleteDoc(doc(db, "Plan Admin", d.id)); } catch (e) {} }
            }
        } catch (e) {}
    }
};

/* ====================================
   EMAIL WHITELIST CHECK
==================================== */

async function isEmailInDirectory(email) {
    try {
        const q    = query(collection(db, "Employees"), where("Email", "==", email));
        const snap = await getDocs(q);
        return !snap.empty;
    } catch (err) {
        console.error("Email check failed:", err);
        return false;
    }
}

/* ====================================
   ACCESS DENIED UI
==================================== */

function showAccessDenied(email) {
    const existing = document.getElementById("accessDeniedBanner");
    if (existing) existing.remove();

    const banner = document.createElement("div");
    banner.id = "accessDeniedBanner";
    banner.innerHTML = `
        <div style="
            margin-top: 18px;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 8px;
            padding: 12px 16px;
            font-size: 13px;
            color: #b91c1c;
            line-height: 1.5;
            text-align: left;
        ">
            <strong>Access denied.</strong><br>
            <span style="color:#7f1d1d;">${email}</span> is not registered in the staff directory.
            Please contact your IT administrator.
        </div>
    `;

    const card = document.querySelector(".signin-card");
    if (card) card.appendChild(banner);
}

/* ====================================
   UI TRANSITIONS
==================================== */

function hideLoading() {
    loadingScreen.classList.add("hidden");
    setTimeout(() => loadingScreen.style.display = "none", 300);
}

function showSignin() {
    signinPage.classList.add("active");
    appShell.classList.remove("visible");
}

function showApp() {
    signinPage.classList.remove("active");
    appShell.classList.add("visible");
}

// "Omkar Sinare" -> "OS". Falls back to one letter for single-word names.
function initialsFrom(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "U";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function updateTopbar(user) {
    if (topbarName)   topbarName.textContent   = user.displayName || "Staff";
    if (topbarRole)   topbarRole.textContent   = currentRole;
    if (topbarAvatar) topbarAvatar.textContent = initialsFrom(user.displayName);
    // Expose user globally so pages can read email
    window.__olfUser = { email: user.email, displayName: user.displayName, role: currentRole };

    // Field Review System nav item: every signed-in user can open it (their Dashboard).
    // Only the Admin button inside the page is restricted to ORG_ADMIN_EMAIL (pos.js checks it).
    const posNavBtn = document.getElementById("posNavBtn");
    if (posNavBtn) posNavBtn.hidden = false;
}

/* ====================================
   CURRENT USER'S DIRECTORY RECORD
   Powers the profile chip and the ID card in the top bar. Read-only:
   it fetches the row this person already has in Employees and hands it
   to the UI. Never blocks the app - the shell renders either way.
==================================== */

async function loadMyEmployeeRecord(email) {
    try {
        const q    = query(collection(db, "Employees"), where("Email", "==", email));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const d = snap.docs[0];
            window.__olfEmployee = { id: d.id, ...d.data() };
        } else {
            window.__olfEmployee = null;   // e.g. an admin who isn't in the directory
        }
    } catch (err) {
        console.error("Could not load your directory record:", err);
        window.__olfEmployee = null;
    }
    window.__olfEmployeeLoaded = true;
    document.dispatchEvent(new CustomEvent("olf:profile-ready", {
        detail: window.__olfEmployee
    }));
}


/* ====================================
   DATE & TIME PICKER
   Replaces the native datetime-local UI, which is unstyleable and
   fiddly. The hidden inputs keep their original IDs and the same
   "YYYY-MM-DDTHH:mm" value format, so saveNews() is untouched.
   Nothing is written to the field until Save is pressed.
==================================== */

const DTP_MONTHS = ["January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"];

// Working copy; only committed to the input on Save.
let dtpState = { targetId: null, y: 0, mo: 0, d: 1, h: 9, mi: 0 };

function pad2(n) { return String(n).padStart(2, "0"); }

/** "YYYY-MM-DDTHH:mm" — exactly what datetime-local produced before. */
function dtpToValue(s) {
    return `${s.y}-${pad2(s.mo + 1)}-${pad2(s.d)}T${pad2(s.h)}:${pad2(s.mi)}`;
}

function dtpFromValue(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(value || ""));
    if (!m) return null;
    return { y: +m[1], mo: +m[2] - 1, d: +m[3], h: +m[4], mi: +m[5] };
}

function dtpPretty(value) {
    const p = dtpFromValue(value);
    if (!p) return "";
    const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
    return `${pad2(p.d)} ${DTP_MONTHS[p.mo].slice(0, 3)} ${p.y}, ${pad2(h12)}:${pad2(p.mi)} ${p.h < 12 ? "AM" : "PM"}`;
}

/** Repaints the label on a dt-field from its hidden input. */
function dtpSyncField(targetId) {
    const btn = document.querySelector(`.dt-field[data-dt-target="${targetId}"]`);
    const input = document.getElementById(targetId);
    if (!btn || !input) return;
    const label = btn.querySelector(".dt-field-val");
    const pretty = dtpPretty(input.value);
    label.textContent = pretty || "Pick date & time";
    btn.classList.toggle("is-empty", !pretty);
}

function dtpOpen(targetId) {
    const input = document.getElementById(targetId);
    if (!input) return;

    const existing = dtpFromValue(input.value);
    if (existing) {
        dtpState = { targetId, ...existing };
    } else {
        // Sensible default: now, minutes rounded up to the next 5.
        const n = new Date();
        n.setMinutes(Math.ceil(n.getMinutes() / 5) * 5, 0, 0);
        dtpState = { targetId, y: n.getFullYear(), mo: n.getMonth(), d: n.getDate(),
                     h: n.getHours(), mi: n.getMinutes() };
    }
    dtpRender();
    const ov = document.getElementById("dtpOverlay");
    if (ov) ov.hidden = false;
}

function dtpClose() {
    const ov = document.getElementById("dtpOverlay");
    if (ov) ov.hidden = true;
    dtpState.targetId = null;
}

function dtpRender() {
    const s = dtpState;
    const title = document.getElementById("dtpTitle");
    if (title) title.textContent = `${DTP_MONTHS[s.mo]} ${s.y}`;

    const grid = document.getElementById("dtpGrid");
    if (grid) {
        const first = new Date(s.y, s.mo, 1).getDay();
        const days  = new Date(s.y, s.mo + 1, 0).getDate();
        const prev  = new Date(s.y, s.mo, 0).getDate();
        const now   = new Date();
        let html = "";

        for (let i = first - 1; i >= 0; i--) {
            html += `<button type="button" class="dtp-day muted" data-dtp-shift="-1" data-dtp-day="${prev - i}">${prev - i}</button>`;
        }
        for (let d = 1; d <= days; d++) {
            const isToday = d === now.getDate() && s.mo === now.getMonth() && s.y === now.getFullYear();
            const cls = ["dtp-day", d === s.d ? "sel" : "", isToday ? "today" : ""].filter(Boolean).join(" ");
            html += `<button type="button" class="${cls}" data-dtp-day="${d}">${d}</button>`;
        }
        const tail = (7 - ((first + days) % 7)) % 7;
        for (let d = 1; d <= tail; d++) {
            html += `<button type="button" class="dtp-day muted" data-dtp-shift="1" data-dtp-day="${d}">${d}</button>`;
        }
        grid.innerHTML = html;
    }

    const h12 = s.h % 12 === 0 ? 12 : s.h % 12;
    const hEl = document.getElementById("dtpHour");
    const mEl = document.getElementById("dtpMin");
    const aEl = document.getElementById("dtpAmPm");
    const pEl = document.getElementById("dtpPreview");
    if (hEl) hEl.textContent = pad2(h12);
    if (mEl) mEl.textContent = pad2(s.mi);
    if (aEl) aEl.textContent = s.h < 12 ? "AM" : "PM";
    if (pEl) pEl.textContent = dtpPretty(dtpToValue(s));
}

function wireDateTimePicker() {
    // The triggers and the picker are static in index.html, so this runs once.
    document.querySelectorAll(".dt-field[data-dt-target]").forEach(btn => {
        btn.addEventListener("click", () => dtpOpen(btn.dataset.dtTarget));
    });

    const grid = document.getElementById("dtpGrid");
    if (grid) {
        grid.addEventListener("click", (e) => {
            const b = e.target.closest("button[data-dtp-day]");
            if (!b) return;
            const shift = Number(b.dataset.dtpShift || 0);
            if (shift) {
                // Tapping a greyed-out day walks into that month.
                const nd = new Date(dtpState.y, dtpState.mo + shift, Number(b.dataset.dtpDay));
                dtpState.y = nd.getFullYear();
                dtpState.mo = nd.getMonth();
            }
            dtpState.d = Number(b.dataset.dtpDay);
            dtpRender();
        });
    }

    const step = (field, by) => {
        if (field === "h") dtpState.h = (dtpState.h + by + 24) % 24;
        else dtpState.mi = (dtpState.mi + by + 60) % 60;
        dtpRender();
    };
    document.querySelectorAll("[data-dt-step]").forEach(b => {
        const [field, by] = b.dataset.dtStep.split(",");
        b.addEventListener("click", () => step(field, Number(by)));
    });

    const move = (by) => {
        const nd = new Date(dtpState.y, dtpState.mo + by, 1);
        dtpState.y = nd.getFullYear();
        dtpState.mo = nd.getMonth();
        // Clamp so 31 -> Feb doesn't roll into March.
        dtpState.d = Math.min(dtpState.d, new Date(dtpState.y, dtpState.mo + 1, 0).getDate());
        dtpRender();
    };
    document.getElementById("dtpPrev")?.addEventListener("click", () => move(-1));
    document.getElementById("dtpNext")?.addEventListener("click", () => move(1));

    document.getElementById("dtpAmPm")?.addEventListener("click", () => {
        dtpState.h = (dtpState.h + 12) % 24;
        dtpRender();
    });

    document.getElementById("dtpNow")?.addEventListener("click", () => {
        const n = new Date();
        n.setMinutes(Math.ceil(n.getMinutes() / 5) * 5, 0, 0);
        Object.assign(dtpState, { y: n.getFullYear(), mo: n.getMonth(), d: n.getDate(),
                                  h: n.getHours(), mi: n.getMinutes() });
        dtpRender();
    });

    document.getElementById("dtpCancel")?.addEventListener("click", dtpClose);
    document.getElementById("dtpOverlay")?.addEventListener("click", (e) => {
        if (e.target.id === "dtpOverlay") dtpClose();
    });
    document.addEventListener("keydown", (e) => {
        const ov = document.getElementById("dtpOverlay");
        if (e.key === "Escape" && ov && !ov.hidden) dtpClose();
    });

    // Save is the only thing that writes to the field.
    document.getElementById("dtpSave")?.addEventListener("click", () => {
        const id = dtpState.targetId;
        if (!id) return dtpClose();
        const input = document.getElementById(id);
        if (input) input.value = dtpToValue(dtpState);
        dtpSyncField(id);
        dtpClose();
    });

    dtpSyncField("newsStartDate");
    dtpSyncField("newsEndDate");
}

/* ====================================
   ACTIVE ANNOUNCEMENTS (shared)
==================================== */

async function getActiveNews() {
    const now = Date.now();
    const snapshot = await getDocs(collection(db, "news"));
    const active = [];
    snapshot.forEach(d => {
        const n = { id: d.id, ...d.data() };
        const { start, end } = getNewsRange(n);
        if (!isNaN(start) && !isNaN(end) && now >= start && now <= end) active.push(n);
    });
    active.sort((a, b) => getNewsRange(a).end - getNewsRange(b).end);
    return active;
}

function openNewsDetail(items) {
    const body = document.getElementById("newsDetailBody");
    const modal = document.getElementById("newsDetailModal");
    if (!body || !modal) return;

    body.innerHTML = (items && items.length)
        ? items.map(n => {
            const startVal = n.startDateTime || n.startDate;
            const endVal   = n.endDateTime   || n.endDate;
            return `<div class="nd-item">
                        ${newsBody(n, "nd-text")}
                        <div class="nd-dates">\u{1F4C5} ${formatNewsDateTime(startVal, false)} \u2013 ${formatNewsDateTime(endVal, true)}</div>
                    </div>`;
        }).join("")
        : `<div class="nd-empty">No active announcements right now.</div>`;

    modal.classList.add("open");
}

/* Shown once per session, on whatever page the person happens to be on. */
const NEWS_POPUP_FLAG = "olf_news_popup_seen";

function hideNewsPopup() {
    const p = document.getElementById("newsPopup");
    if (!p || p.hidden) return;
    p.classList.add("news-popup--leaving");
    setTimeout(() => { p.hidden = true; p.classList.remove("news-popup--leaving"); }, 200);
}

async function maybeShowNewsPopup() {
    try {
        if (sessionStorage.getItem(NEWS_POPUP_FLAG) === "1") return;
    } catch (e) { /* private mode: fall through and just show it */ }

    let items = [];
    try {
        items = await getActiveNews();
    } catch (err) {
        console.error("Announcement popup check failed:", err);
        return;
    }
    if (!items.length) return;   // nothing to shout about

    const popup = document.getElementById("newsPopup");
    const text  = document.getElementById("newsPopupText");
    const label = document.getElementById("newsPopupLabel");
    if (!popup || !text) return;

    text.textContent = items[0].text || "";
    if (label) {
        label.textContent = items.length > 1
            ? `${items.length} new announcements`
            : "New announcement";
    }
    popup.hidden = false;

    try { sessionStorage.setItem(NEWS_POPUP_FLAG, "1"); } catch (e) {}

    document.getElementById("newsPopupCta").onclick = () => { hideNewsPopup(); openNewsDetail(items); };
    document.getElementById("newsPopupClose").onclick = hideNewsPopup;
}

/* ====================================
   HAPPENING NEXT
   The next events from the Program Calendar, shown on Home: the two
   soonest from today onwards, however far off they are. An event
   drops off once its own day has passed. Reads the calendar's own
   cache, so this costs no extra request.
==================================== */

const UPCOMING_MAX = 2;   // plus a third only when it shares a day with the 2nd

function dayKey(y, m, d) { return `${y}-${pad2(m + 1)}-${pad2(d)}`; }

/** Whole days from today; 0 = today, 1 = tomorrow, negative = past. */
function daysFromToday(e) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const that  = new Date(e.year, e.month, e.day);
    return Math.round((that - today) / 86400000);
}

function pickUpcoming(events) {
    const now = new Date();
    const todayKey = dayKey(now.getFullYear(), now.getMonth(), now.getDate());

    // Everything from today onwards, soonest first. Past days drop off
    // on their own once the date rolls over.
    const upcoming = (events || [])
        .filter(e => daysFromToday(e) >= 0)
        .sort((a, b) => {
            const ka = dayKey(a.year, a.month, a.day);
            const kb = dayKey(b.year, b.month, b.day);
            if (ka !== kb) return ka < kb ? -1 : 1;
            // Same day: earlier start time first when we have one.
            return new Date(a.start || 0) - new Date(b.start || 0);
        });

    const picked = upcoming.slice(0, UPCOMING_MAX);
    // Don't cut a day in half: if the next one shares its day with the
    // last one picked, show it too.
    const third = upcoming[UPCOMING_MAX];
    if (third && picked.length === UPCOMING_MAX) {
        const last = picked[picked.length - 1];
        if (dayKey(third.year, third.month, third.day) === dayKey(last.year, last.month, last.day)) {
            picked.push(third);
        }
    }
    return { picked, todayKey };
}

async function renderUpcomingEvents() {
    const section = document.getElementById("upcomingSection");
    const grid    = document.getElementById("upcomingGrid");
    if (!section || !grid) return;

    let events = [];
    try {
        if (window.ProgramCalendar && typeof window.ProgramCalendar.ensureEvents === "function") {
            events = await window.ProgramCalendar.ensureEvents();
        }
    } catch (err) {
        console.warn("Upcoming events unavailable:", err);
        return;                       // leave the strip hidden; Home still works
    }

    const { picked, todayKey } = pickUpcoming(events);
    if (!picked.length) {
        // Clear as well as hide, so yesterday's cards can't linger in the DOM.
        grid.innerHTML = "";
        section.style.display = "none";
        return;
    }

    const colorFor = (t) => {
        try { return window.ProgramCalendar.colorFor(t) || "#4F8EF7"; }
        catch (e) { return "#4F8EF7"; }
    };

    grid.innerHTML = picked.map(e => {
        const away = daysFromToday(e);
        const when = away === 0 ? "Today" : (away === 1 ? "Tomorrow" : `In ${away} days`);
        const tone = away === 0 ? "today" : (away === 1 ? "tomorrow" : "later");
        const time = (!e.allDay && e.start)
            ? new Date(e.start).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
            : "All day";
        return `
        <div class="upcoming-card">
            <span class="upcoming-accent" style="background:${escHtml(colorFor(e.type))}"></span>
            <div class="upcoming-when">
                <div class="upcoming-day">${pad2(e.day)}</div>
                <div class="upcoming-mon">${DTP_MONTHS[e.month].slice(0, 3)}</div>
            </div>
            <div class="upcoming-body">
                <div class="upcoming-title" title="${escHtml(e.eventName || e.type || "Event")}">${escHtml(e.eventName || e.type || "Event")}</div>
                <div class="upcoming-meta">\u{1F4CD} ${escHtml(e.district || "\u2014")} &nbsp;\u00B7&nbsp; \u{1F551} ${escHtml(time)}</div>
                <span class="upcoming-chip upcoming-chip--${tone}">${escHtml(when)}</span>
            </div>
        </div>`;
    }).join("");

    section.style.display = "";
    document.getElementById("upcomingViewAll")?.addEventListener("click", () => navigate("calendar"));
}

/* ====================================
   PAGE FRAGMENT CACHE
   navigate() used to fetch pages/<page>.html on every visit, so the
   screen stayed on the previous page until that request came back.
   Fragments are static, so each one is fetched at most once per page
   load and reused after that - a repeat visit renders synchronously.

   Held in memory only, deliberately: a deploy replaces the fragments,
   and anything persisted would keep serving the old markup after it.
==================================== */

const pageFragments = new Map();

/* ====================================
   STAFF LIST FOR OLF FORMS
   The Forms audience picker needs every employee, but the Employees
   page owns the `employees` array and only fills it when visited.
   This fetches a slim copy once per page load and publishes it as
   window.__olfEmployees for forms.js to read.
==================================== */

let staffListLoaded = false;

async function ensureFormsStaffList() {
    if (staffListLoaded && Array.isArray(window.__olfEmployees)) return;
    try {
        const snapshot = await getDocs(collection(db, "Employees"));
        const list = [];
        snapshot.forEach(d => {
            const r = d.data();
            const email = String(r.Email || "").trim();
            if (!email) return;               // no email, cannot be a recipient
            list.push({
                name: String(r.Name || "").trim(),
                email,
                dept: String(r.Dept || "").trim()
            });
        });
        window.__olfEmployees = list;
        staffListLoaded = true;
    } catch (err) {
        // Never surfaced: the picker shows its own "not loaded" notice.
        console.error("Forms: staff list load failed:", err);
    }
}

/* ====================================
   STAFF DIRECTORY
   The full Employees list, for pages that must pick a real person
   rather than accept typed-in details - currently the Field Review
   System's Assignments modal.

   Kept separate from ensureFormsStaffList() above on purpose: that one
   drops anyone without an email because they can't be a Forms recipient,
   and forms.js reads its exact shape. This one carries the Firestore doc
   id (which IS the employee ID) and never filters, so the caller can
   decide what to do about a missing field.

   Fetched once per page load and cached. Throws on failure - the caller
   shows its own message.
==================================== */

let staffDirectory = null;

window.olfStaffDirectory = async function () {
    if (staffDirectory) return staffDirectory;
    const snapshot = await getDocs(collection(db, "Employees"));
    const list = [];
    snapshot.forEach(d => {
        const r = d.data();
        list.push({
            id:          String(d.id || "").trim(),            // doc id = employee ID (OLF-26-168)
            name:        String(r.Name || "").trim(),
            email:       String(r.Email || "").trim(),         // the Google account sign-in matches on
            dept:        String(r.Dept || "").trim(),
            designation: String(r.Designation || "").trim()    // job title, NOT the PO/PM/DM review role
        });
    });
    list.sort((a, b) => a.name.localeCompare(b.name));
    staffDirectory = list;
    return list;
};

/* ====================================
   WHERE THE ORGANISATION WORKS

   State -> Division -> District, built from the Employees records rather
   than kept in a second place that has to be remembered. Only Inactive
   staff are skipped: a district nobody is posted to any more should stop
   being offered.

   Three spellings in the directory do not match the district they mean.
   Each was checked against the division it sits under - Beed is in
   Chhatrapati Sambhajinagar, Raigad in Konkan, Sangli in Pune - and is
   mapped here rather than corrected in Firestore, so nothing is rewritten
   in production and the fix stays in one visible place.

   A state with no districts is left out: it cannot carry a requisition, so
   offering it only strands whoever picks it. Delhi is the live example.

   Fetched once per page load and cached, like the directory above.
==================================== */

const DISTRICT_RENAMES = {
    "bid":        "Beed",
    "raigarh mh": "Raigad"     // Raigarh is a Chhattisgarh district; this is Raigad
};

/* Districts as the award form should offer them.

   A municipal corporation is part of its district, not a district of its
   own, so "Sangli - MC" and "Pune - MC" are both filed under the district
   they sit in. That is a rule rather than a list because the directory
   gains these as it grows - Pune - MC appeared after the first three were
   written down, and a list would have missed it.

   It stays a rule about "- MC" specifically, not about suffixes generally:
   "Janjgir - Champa" is a real district name, and dropping what follows the
   dash would rename it. "Raigarh MH" stays in the map above for the same
   reason - taking off the MH leaves Raigarh, which is a different district
   in a different state. */
function tidyDistrict(name) {
    const trimmed = String(name || "").trim().replace(/(?:\s*[-–]\s*|\s+)MC$/i, "").trim();
    return DISTRICT_RENAMES[trimmed.toLowerCase()] || trimmed;
}

let orgGeography = null;
let orgGeographyAt = 0;

/* Re-read after a minute, and straight away after any change made here. A
   person marked Inactive in one tab must leave the stock sheet in the next
   visit, not at the next page load. */
const GEOGRAPHY_FRESH_MS = 60 * 1000;

window.olfGeography = async function () {
    if (orgGeography && Date.now() - orgGeographyAt < GEOGRAPHY_FRESH_MS) return orgGeography;

    const snapshot = await getDocs(collection(db, "Employees"));

    /* The directory is typed by hand, so the same place turns up as "Pune",
       "pune" and "Pune " . They are one place; the first spelling seen is the
       one shown. */
    const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
    const shown = new Map();
    const say = s => { const k = norm(s); if (!shown.has(k)) shown.set(k, s.replace(/\s+/g, " ").trim()); return k; };
    const keys = list => [...new Set(list.map(say))];

    const people = [];
    snapshot.forEach(d => {
        const r = d.data();
        if (!isActiveEmployee(r)) return;
        people.push({
            name:      String(r.Name || "").trim(),
            email:     String(r.Email || "").trim().toLowerCase(),
            boss:      String(r["Reporting manager"] || r["Reporting Manager"] || "").trim().toLowerCase(),
            isPM:      /^program implementation\s*[-–]?\s*pm$/
                           .test(String(r["Dept"] || "").trim().toLowerCase().replace(/\s+/g, " ")),
            isDM:      /^program implementation\s*[-–]?\s*div$/
                           .test(String(r["Dept"] || "").trim().toLowerCase().replace(/\s+/g, " ")),
            isCOO:     /^program implementation\s*[-–]?\s*coo$/
                           .test(String(r["Dept"] || "").trim().toLowerCase().replace(/\s+/g, " ")),
            states:    keys(splitMulti(r["State"])),
            divisions: keys(splitMulti(r["Division"])),
            districts: keys(splitMulti(r["District"]).map(tidyDistrict))
        });
    });

    /* Where each district is. Someone covering several places lists their
       states, divisions and districts side by side and nothing says which
       goes with which - crossing the three lists put Begusarai under
       Maharashtra because a manager there also covers Bihar. So a district is
       placed by what can be known for certain, strongest first:
         1. a person with one state, one division and one district;
         2. a person with one state and one division and several districts,
            for any district step 1 has not already placed - a list typed by
            hand is where a stray district slips in;
         3. lists of equal length, read in step: the first state, division
            and district belong together;
         4. only for a district nobody above names, the crossing of what is
            listed, which is the best there is.
       A district placed at an earlier step is not placed by a later one. */
    const placed = new Map();      // district -> Map("state|division" -> {state, division})
    const place = (map, dt, st, dv) => {
        const at = map.get(dt) || new Map();
        at.set(st + "|" + dv, { state: st, division: dv });
        map.set(dt, at);
    };
    for (const p of people) {
        if (p.states.length === 1 && p.divisions.length === 1 && p.districts.length === 1) {
            place(placed, p.districts[0], p.states[0], p.divisions[0]);
        }
    }
    /* Step 2 goes shortest list first. A Divisional Manager lists a good part
       of the state, a PM only their own districts, and where the two disagree
       it is the PM's shorter list that is right - Sukma is in Bastar, though
       the Raipur division manager lists it too. */
    const taken = new Map();       // district -> length of the list that placed it
    const wide = people
        .filter(p => p.states.length === 1 && p.divisions.length === 1 && p.districts.length > 1)
        .sort((a, b) => a.districts.length - b.districts.length);
    for (const p of wide) {
        for (const dt of p.districts) {
            if (placed.has(dt) && !taken.has(dt)) continue;       // step 1 already has it
            if (taken.has(dt) && taken.get(dt) < p.districts.length) continue;
            taken.set(dt, p.districts.length);
            place(placed, dt, p.states[0], p.divisions[0]);
        }
    }
    for (const p of people) {
        if (p.states.length > 1 && p.states.length === p.divisions.length &&
            p.states.length === p.districts.length) {
            p.districts.forEach((dt, i) => {
                if (!placed.has(dt)) place(placed, dt, p.states[i], p.divisions[i]);
            });
        }
    }
    const guessed = new Map();
    for (const p of people) {
        for (const dt of p.districts) {
            if (placed.has(dt)) continue;
            for (const st of p.states) for (const dv of p.divisions) place(guessed, dt, st, dv);
        }
    }
    const spotsOf = dt => [...(placed.get(dt) || guessed.get(dt) || new Map()).values()];

    // state -> division -> Set(district)
    const tree = new Map();
    for (const dt of new Set([...placed.keys(), ...guessed.keys()])) {
        for (const w of spotsOf(dt)) {
            if (!tree.has(w.state)) tree.set(w.state, new Map());
            const byDiv = tree.get(w.state);
            if (!byDiv.has(w.division)) byDiv.set(w.division, new Set());
            byDiv.get(w.division).add(dt);
        }
    }

    /* Who manages a district, first match wins:
         1. a PM who lists the district, in the state it sits in - a PM is given
            districts, and one may cross a division line to take one;
         2. no PM, so the DM - the one the district's staff report to, then any
            DM covering its state and division - as "(interim DM)";
         3. no DM either, so the COO, as "(interim COO)".
       A division's other PMs are not stood in: a PM manages the districts they
       are given, not whatever else sits in the same division. */
    const covers = (p, st, dv) => p.states.includes(st) && p.divisions.includes(dv);
    const nameList = ps => [...new Set(ps.map(p => p.name))];
    const byEmail = new Map(people.filter(p => p.email).map(p => [p.email, p]));
    const managerOf = (dt, st, dv) => {
        const pms = nameList(people.filter(p =>
            p.isPM && p.name && p.districts.includes(dt) && p.states.includes(st)));
        if (pms.length) return pms.join(", ");

        const bosses = nameList(people
            .filter(p => p.districts.length === 1 && p.districts[0] === dt && p.boss)
            .map(p => byEmail.get(p.boss))
            .filter(b => b && b.isDM && b.name));
        const dms = bosses.length ? bosses
            : nameList(people.filter(p => p.isDM && p.name && covers(p, st, dv)));
        if (dms.length) return dms.map(n => n + " (interim DM)").join(", ");

        return nameList(people.filter(p => p.isCOO && p.name))
            .map(n => n + " (interim COO)").join(", ");
    };

    const out = [];
    for (const [state, byDiv] of tree) {
        const divisions = [];
        for (const [division, districts] of byDiv) {
            const sorted = [...districts].map(k => shown.get(k))
                .sort((a, b) => a.localeCompare(b));
            const byDistrict = {};
            for (const k of districts) {
                const who = managerOf(k, state, division);
                if (who) byDistrict[shown.get(k)] = who;
            }
            divisions.push({
                name: shown.get(division),
                pm: "",
                pmByDistrict: byDistrict,
                districts: sorted
            });
        }
        divisions.sort((a, b) => a.name.localeCompare(b.name));
        out.push({ name: shown.get(state), divisions });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));

    orgGeography = out;
    orgGeographyAt = Date.now();
    return out;
};

async function getPageHtml(page) {
    if (pageFragments.has(page)) return pageFragments.get(page);
    // Revalidate rather than trust the browser's copy. These fragments carry
    // their own <style>, so a stale one shows new markup with old styling -
    // which looks like a broken page rather than a cached one. Hosting already
    // sends no-cache for HTML, so in production this costs a 304 and nothing
    // more; locally it is the difference between seeing an edit and not.
    const res  = await fetch(`pages/${page}.html`, { cache: "no-cache" });
    const html = await res.text();
    pageFragments.set(page, html);
    return html;
}

/**
 * Warms the cache while the browser is idle, so even the FIRST click on
 * a nav item renders instantly. Fetched one at a time and lowest
 * priority, so this never competes with the data the current page needs.
 */
function prefetchPages() {
    const pages = [...document.querySelectorAll("#appSidebar .nav-item")]
        .map(el => el.dataset.page)
        .filter(p => p && !pageFragments.has(p));

    const next = () => {
        const page = pages.shift();
        if (!page) return;
        getPageHtml(page)
            .catch(() => {})          // a miss here must never surface
            .then(() => schedule(next));
    };
    const schedule = (fn) => (window.requestIdleCallback
        ? requestIdleCallback(fn, { timeout: 3000 })
        : setTimeout(fn, 400));

    schedule(next);
}

/* ====================================
   REMEMBERED ROLE
   A UI affordance only, so a page can render its admin controls
   without waiting on Firestore first. It decides what is shown,
   never what is allowed - the backend still authorises every write.
==================================== */

function roleCacheKey(scope, email) {
    return "olf_role_" + scope + "_" + String(email || "").toLowerCase();
}

function readCachedRole(scope, email) {
    try {
        const raw = localStorage.getItem(roleCacheKey(scope, email));
        if (!raw) return false;
        const box = JSON.parse(raw);
        // A day old is plenty; the live check corrects it moments later anyway.
        if (!box || Date.now() - (box.at || 0) > 24 * 60 * 60 * 1000) return false;
        return !!box.isAdmin;
    } catch (e) {
        return false;
    }
}

function writeCachedRole(scope, email, isAdmin) {
    try {
        localStorage.setItem(roleCacheKey(scope, email),
            JSON.stringify({ isAdmin: !!isAdmin, at: Date.now() }));
    } catch (e) {}
}

/* ====================================
   ROUTER
   Nav IDs use data-page attribute to
   avoid issues with hyphens in IDs.
==================================== */

window.navigate = async function (page) {
    currentPage = page;

    // Stop auto-refreshing news banners when leaving the Home page
    if (newsRefreshInterval) {
        clearInterval(newsRefreshInterval);
        newsRefreshInterval = null;
    }

    // Highlight correct nav item using data-page attribute
    document.querySelectorAll("#appSidebar .nav-item").forEach(el => {
        el.classList.toggle("active", el.dataset.page === page);
    });

    pageContent.innerHTML = await getPageHtml(page);

    if (page === "home") {
        initHomePage();
    }
    else if (page === "employees") {
        initEmployeesPage();
    }
    else if (page === "pom") {
        if (typeof window.initPomPageUI === "function") {
            window.initPomPageUI();
        }
    }

    else if (page === "calendar") {
        const user = window.__olfUser;
        if (user) {
            // Start with the remembered verdict so admin controls are right
            // straight away; corrected below once Firestore answers.
            window.PROGRAM_CALENDAR_USER = {
                email: user.email,
                isAdmin: readCachedRole("cal", user.email)
            };
        }
        if (window.ProgramCalendar && typeof window.ProgramCalendar.mount === "function") {
            window.ProgramCalendar.mount();   // not awaited: data load starts now
        }
        if (user) {
            // Off the critical path.
            isCalendarAdmin(user.email.toLowerCase()).then(isCalAdmin => {
                writeCachedRole("cal", user.email, isCalAdmin);
                window.PROGRAM_CALENDAR_USER = { email: user.email, isAdmin: isCalAdmin };
                if (window.ProgramCalendar && typeof window.ProgramCalendar.setUser === "function") {
                    window.ProgramCalendar.setUser(window.PROGRAM_CALENDAR_USER);
                }
            }).catch(err => console.error("Calendar admin check failed:", err));
        }
    }

    else if (page === "smart-goals") {
        const user = window.__olfUser;
        if (user) {
            const isPlanAdmin = await isSmartGoalsAdmin(user.email.toLowerCase());
            window.SMART_GOALS_USER = { email: user.email, isAdmin: isPlanAdmin };
        }
        if (window.SmartGoals && typeof window.SmartGoals.mount === "function") {
            window.SmartGoals.mount();
        }
    }

    else if (page === "award-management") {
        // award.js reads window.__olfUser / window.__olfEmployee itself for the
        // requester, so there is nothing to inject here.
        if (window.AwardManagement && typeof window.AwardManagement.mount === "function") {
            window.AwardManagement.mount();
        }
    }

    else if (page === "gr") {
        const user = window.__olfUser;
        if (user) {
            const isValidator = await isGrCircularValidator(user.email.toLowerCase());
            window.GR_CIRCULAR_USER = {
                email: user.email,
                displayName: user.displayName,
                isValidator
            };
        }
        if (window.GRCirculars && typeof window.GRCirculars.mount === "function") {
            window.GRCirculars.mount();
        }
    }

    else if (page === "forms") {
        // forms.js reads window.__olfUser itself, so there is nothing to
        // inject here. Forms admin rights are decided by the Apps Script
        // backend (SUPER_ADMINS in Code.gs), not by Firestore.
        if (typeof window.frmInit === "function") {
            window.frmInit();
        }
        // The audience picker needs the staff list. Off the critical path:
        // the page renders first, and the picker refreshes if it is open.
        ensureFormsStaffList().then(() => {
            if (typeof window.frmRender === "function" &&
                window.frmState && window.frmState.view === "builder") {
                window.frmRender();
            }
        });
    }

    // ARCHIVED 2026-10-07: the "po" branch (old PO Review, window.POReview) was
    // removed here. pages/po.html and po.js are still in the repo but are never
    // fetched or loaded - the "pos" page below replaces them.

    else if (page === "pos") {
        // pos.js reads window.__olfUser itself (admin gate + run auth).
        if (window.POSAdmin && typeof window.POSAdmin.mount === "function") {
            window.POSAdmin.mount();
        }
    }

    else if (
    page === "data-dashboards" ||
    page === "expense-report"
    ) {
        // Inject user info for pages that show signed-in user
        const user = window.__olfUser;
        if (user) {
            const emailEl  = pageContent.querySelector("[id$='UserEmail'], #erUserEmail, #ddUserEmail");
            const avatarEl = pageContent.querySelector("[id$='Avatar'], #erAvatar, #ddAvatar");
            if (emailEl)  emailEl.textContent  = user.email;
            if (avatarEl) avatarEl.textContent = user.email.charAt(0).toUpperCase();
        }
    }
};

/* ====================================
   DERIVE SCHEMA FROM FIRESTORE
==================================== */

async function deriveSchema() {
    const snapshot = await getDocs(collection(db, "Employees"));
    const allKeys  = new Set();
    snapshot.forEach(d => Object.keys(d.data()).forEach(k => allKeys.add(k)));

    const extraKeys = [...allKeys]
        .filter(k => !CORE_KEYS.includes(k))
        .sort();

    schemaFields = [
        ...CORE_FIELDS,
        ...extraKeys.map(k => ({ key: k, label: k, placeholder: k }))
    ];
}

/* ====================================
   HOME PAGE
==================================== */

async function initHomePage() {
    const user  = auth.currentUser;
    const nameEl = document.getElementById("homeUserName");
    if (nameEl && user) {
        nameEl.textContent = user.displayName?.split(" ")[0] || "there";
    }

    // Admin-only: show inline "Add News" button in the news section header
    const addNewsBtn = document.getElementById("addNewsBtn");
    if (addNewsBtn) {
        if (currentRole === "Admin") {
            addNewsBtn.style.display = "inline-flex";
            addNewsBtn.addEventListener("click", () => newsModal.classList.add("open"));
        } else {
            addNewsBtn.style.display = "none";
        }
    }

    // Load news as cards
    await renderNewsCards();

    // Next events from the Program Calendar (cache-backed, no extra request)
    renderUpcomingEvents();

    // Auto-refresh so expired news disappears without a page reload
    if (newsRefreshInterval) clearInterval(newsRefreshInterval);
    newsRefreshInterval = setInterval(() => {
        if (currentPage === "home") renderNewsCards();
    }, 30000); // every 30 seconds

    try {
        const snapshot = await getDocs(collection(db, "Employees"));
        const data = [];
        snapshot.forEach(d => data.push(d.data()));

        document.getElementById("statTotal").textContent = data.length;

        const depts = [...new Set(data.map(e => e.Dept).filter(Boolean))];
        document.getElementById("statDepts").textContent = depts.length;

        const locs = [...new Set(data.map(e => e.Location).filter(Boolean))];
        document.getElementById("statLocations").textContent = locs.length;

        const deptCount = {};
        data.forEach(e => { if (e.Dept) deptCount[e.Dept] = (deptCount[e.Dept] || 0) + 1; });

        const deptList = document.getElementById("deptList");
        if (deptList) {
            if (Object.keys(deptCount).length === 0) {
                deptList.innerHTML = `<div class="loading-row">No departments found.</div>`;
            } else {
                deptList.innerHTML = Object.entries(deptCount)
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, count]) => `
                        <div class="dept-row">
                            <span class="dept-name">${name}</span>
                            <span class="dept-count">${count}</span>
                        </div>
                    `).join("");
            }
        }
    } catch (err) {
        console.error(err);
    }
}

/* ====================================
   EMPLOYEES PAGE
==================================== */

async function initEmployeesPage() {
    const adminToolbar = document.getElementById("adminToolbar");
    if (adminToolbar && currentRole === "Admin") adminToolbar.style.display = "block";

    const addBtn    = document.getElementById("addEmployeeBtn");
    const searchBox = document.getElementById("searchBox");
    const closeBtn  = document.getElementById("closeModalBtn");
    const closeBtn2 = document.getElementById("closeModalBtn2");
    const excelBtn  = document.getElementById("downloadExcelBtn");

    const orgBtn   = document.getElementById("orgChartBtn");
    const closeOrg = document.getElementById("closeOrgBtn");

    if (orgBtn)   orgBtn.addEventListener("click", openOrgChart);
    if (closeOrg) closeOrg.addEventListener("click", closeOrgChart);
    bindOrgEscape();

    const branchBack  = document.getElementById("orgBranchBack");
    const branchClose = document.getElementById("orgBranchClose");
    const branchBody  = document.getElementById("orgBranchBody");
    if (branchBack)  branchBack.addEventListener("click", orgBranchBack);
    if (branchClose) branchClose.addEventListener("click", closeOrgBranch);
    if (branchBody) {
        branchBody.addEventListener("click", (e) => {
            const open = e.target.closest("button[data-org-toggle]");
            if (open) { openOrgBranch(open.dataset.orgToggle); return; }
            const card = e.target.closest(".org-node[data-emp]");
            if (card) openOrgPerson(card.dataset.emp);
        });
    }

    const zoomIn    = document.getElementById("orgZoomIn");
    const zoomOut   = document.getElementById("orgZoomOut");
    const zoomReset = document.getElementById("orgZoomReset");
    if (zoomIn)    zoomIn.addEventListener("click", () => setOrgZoom(orgZoom + 0.1));
    if (zoomOut)   zoomOut.addEventListener("click", () => setOrgZoom(orgZoom - 0.1));
    if (zoomReset) zoomReset.addEventListener("click", () => setOrgZoom(1));

    const orgBody = document.getElementById("orgBody");
    if (orgBody) {
        orgBody.addEventListener("click", (e) => {
            const btn = e.target.closest("button[data-org-toggle]");
            if (btn) { openOrgBranch(btn.dataset.orgToggle); return; }

            const card = e.target.closest(".org-node[data-emp]");
            if (card) openOrgPerson(card.dataset.emp);
        });

    const personClose = document.getElementById("orgPersonClose");
    const personModal = document.getElementById("orgPersonModal");
    if (personClose) personClose.addEventListener("click", closeOrgPerson);
    if (personModal) personModal.addEventListener("click", (e) => {
        if (e.target === personModal) closeOrgPerson();   // click the backdrop
    });
    }

    if (addBtn)    addBtn.addEventListener("click", openAddModal);
    if (searchBox) searchBox.addEventListener("input", renderEmployees);
    document.getElementById("tableHead")?.addEventListener("click", onEmpHeadClick);
    const filterBox = document.getElementById("empFilters");
    if (filterBox) filterBox.addEventListener("change", onEmpFilterChange);
    document.getElementById("empChips")?.addEventListener("click", onEmpFilterClick);
    document.getElementById("empFiltersBtn")?.addEventListener("click", onEmpFiltersToggle);
    if (closeBtn)  closeBtn.addEventListener("click", closeModal);
    if (closeBtn2) closeBtn2.addEventListener("click", closeModal);
    if (excelBtn)  excelBtn.addEventListener("click", downloadExcel);

    // Admin-only: sample format download + Excel upload
    if (currentRole === "Admin") {
        const sampleBtn   = document.getElementById("downloadSampleExcelBtn");
        const uploadInput = document.getElementById("uploadExcelInput");

        if (sampleBtn)   sampleBtn.addEventListener("click", downloadSampleExcel);
        if (uploadInput) uploadInput.addEventListener("change", handleExcelUpload);
    }

    const table = document.getElementById("employeeTable");
    if (table) {
        table.addEventListener("click", (e) => {
            const btn = e.target.closest("button");
            if (!btn) return;
            if (btn.dataset.action === "edit")   editEmployee(btn.dataset.id);
            if (btn.dataset.action === "delete") deleteEmployeeRecord(btn.dataset.id);
            if (btn.dataset.action === "multi")  showMultiFor(btn.dataset.id, btn.dataset.key);
        });
    }

    await loadEmployees();
}

async function loadEmployees() {
    employees = [];

    const tableEl = document.getElementById("employeeTable");
    if (tableEl) tableEl.innerHTML = `<tr><td colspan="99" class="empty-state"><div class="empty-icon">⏳</div>Loading…</td></tr>`;

    try {
        await deriveSchema();
        const snapshot = await getDocs(collection(db, "Employees"));
        snapshot.forEach(d => employees.push({ id: d.id, ...d.data() }));
        buildEmpFilters();
        renderEmployees();
    } catch (err) {
        console.error(err);
        notify(err.message, "error");
    }
}

function getTableColumns() {
    const priorityKeys = ["Name", "Dept", "Designation", "Mobile", "Email", "Reporting manager"];
    const remainingKeys = schemaFields
        .map(f => f.key)
        .filter(key => !priorityKeys.includes(key));
    return [...priorityKeys, ...remainingKeys];
}

function colClass(key) {
    const map = {
        "Name": "col-name", "Designation": "col-desig", "Dept": "col-dept",
        "Email": "col-email", "Location": "col-location",
        "Mobile": "col-extra", "Reporting manager": "col-extra",
        "Status": "col-status", "State": "col-geo",
        "Division": "col-multi", "District": "col-multi", "Block": "col-multi"
    };
    return map[key] || "col-extra";
}

/* ====================================
   MANY-VALUED FIELDS (District, Block)

   One person can cover dozens of districts and hundreds of blocks, so the
   stored value is a single ";"-separated string that routinely runs to
   thousands of characters. Printing that straight into a nowrap <td> would
   stretch the row off the page, so the cell shows a count the admin can click
   to read the full list.
==================================== */

function splitMulti(value) {
    return String(value || "")
        .split(/[;\r\n]/)
        .map(s => s.trim())
        .filter(Boolean);
}

function multiCellHtml(value, empId, key) {
    const list = splitMulti(value);
    if (list.length === 0) return "—";
    if (list.length === 1) return escHtml(list[0]);
    const noun = MULTI_VALUE_FIELDS[key].many;
    return `<button class="badge-multi" data-action="multi"
                data-id="${escHtml(empId)}" data-key="${escHtml(key)}"
                title="Click to see all ${list.length} ${noun}">${list.length} ${noun}</button>`;
}

function showMultiFor(empId, key) {
    const emp   = employees.find(e => e.id === empId);
    const nouns = MULTI_VALUE_FIELDS[key];
    if (!emp || !nouns) return;
    const list = splitMulti(emp[key]);
    showAppAlert({
        title:   `${key} — ${emp["Name"] || empId}`,
        message: `${list.length} ${list.length === 1 ? nouns.one : nouns.many} assigned.`,
        type:    "info",
        list
    });
}

/* ====================================
   FILTERS AND SORTING

   A drop-down for each column worth narrowing by, built from what the
   records hold so there is nothing to keep in step. They combine with each
   other and with the search box. Division and District hold several values
   in one cell, so a person matches when any one of them is the chosen one.

   Headers sort on a click: ascending, then descending, then back to the
   order the records came in. Blank cells always go last, whichever way.
==================================== */

const EMP_FILTERS = [
    { key: "Dept",        label: "Department"  },
    { key: "Designation", label: "Designation" },
    { key: "Status",      label: "Status"      },
    { key: "State",       label: "State"       },
    { key: "Division",    label: "Division",    multi: true },
    { key: "District",    label: "District",    multi: true },
    { key: "Location",    label: "Location"    }
];
const EMP_BLANK = "__blank__";

let empFilter = {};                    // key -> chosen value
let empSort   = { key: "", dir: 1 };   // key "" = the order records came in

function empValues(emp, key) {
    if (key === "Status") return [isActiveEmployee(emp) ? "Active" : "Inactive"];
    if (EMP_FILTERS.some(f => f.key === key && f.multi) || key === "Block") return splitMulti(emp[key]);
    const v = String(emp[key] || "").trim();
    return v ? [v] : [];
}

function empMatchesFilters(emp) {
    return EMP_FILTERS.every(f => {
        const want = empFilter[f.key];
        if (!want) return true;
        const have = empValues(emp, f.key);
        return want === EMP_BLANK ? have.length === 0 : have.includes(want);
    });
}

function buildEmpFilters() {
    const box = document.getElementById("empFilters");
    if (!box) return;

    const parts = EMP_FILTERS.map(f => {
        const seen = new Set();
        let hasBlank = false;
        employees.forEach(emp => {
            const vals = empValues(emp, f.key);
            if (!vals.length) hasBlank = true;
            vals.forEach(v => seen.add(v));
        });
        const options = [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

        if (empFilter[f.key] && empFilter[f.key] !== EMP_BLANK && !seen.has(empFilter[f.key])) {
            delete empFilter[f.key];       // the value it named is gone
        }
        const chosen = empFilter[f.key] || "";

        return `<div class="emp-filter${chosen ? " is-set" : ""}">
            <label for="empf-${f.key}">${f.label}</label>
            <select id="empf-${f.key}" data-filter="${f.key}">
                <option value="">All</option>
                ${hasBlank ? `<option value="${EMP_BLANK}"${chosen === EMP_BLANK ? " selected" : ""}>(blank)</option>` : ""}
                ${options.map(v => `<option value="${escHtml(v)}"${v === chosen ? " selected" : ""}>${escHtml(v)}</option>`).join("")}
            </select>
        </div>`;
    });

    box.innerHTML = parts.join("");
    syncEmpFilterBar();
}

let empFiltersOpen = false;

/* The panel, its button and the chips of what is applied, kept in step. The
   chips stay up while the panel is shut, so nothing is filtered out of sight. */
function syncEmpFilterBar() {
    const box   = document.getElementById("empFilters");
    const btn   = document.getElementById("empFiltersBtn");
    const count = document.getElementById("empFiltersCount");
    const chips = document.getElementById("empChips");
    const keys  = Object.keys(empFilter);

    if (box) box.hidden = !empFiltersOpen;
    if (btn) btn.setAttribute("aria-expanded", String(!!box && !box.hidden));
    if (count) { count.hidden = !keys.length; count.textContent = keys.length; }

    if (chips) {
        chips.hidden = !keys.length;
        chips.innerHTML = keys.map(k => {
            const f = EMP_FILTERS.find(x => x.key === k);
            const v = empFilter[k] === EMP_BLANK ? "(blank)" : empFilter[k];
            return `<span class="emp-chip"><i>${f.label}:</i> ${escHtml(v)}
                <button type="button" data-drop-filter="${k}" title="Remove" aria-label="Remove ${f.label} filter">✕</button></span>`;
        }).join("") + (keys.length > 1
            ? `<button type="button" class="emp-filter-clear" data-clear-filters>Clear all</button>` : "");
    }
}

function empSortValue(emp, key) {
    if (key === "__id") return emp.id;
    if (key === "Status") return isActiveEmployee(emp) ? "Active" : "Inactive";
    if (MULTI_VALUE_FIELDS[key]) return splitMulti(emp[key]).join("; ");
    return String(emp[key] || "").trim();
}

function sortEmployees(list) {
    if (!empSort.key) return list;
    const { key, dir } = empSort;
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    return list.slice().sort((a, b) => {
        const x = empSortValue(a, key), y = empSortValue(b, key);
        if (!x && !y) return 0;
        if (!x) return 1;
        if (!y) return -1;
        return dir * collator.compare(x, y);
    });
}

function onEmpHeadClick(e) {
    const th = e.target.closest("th[data-sort]");
    if (!th) return;
    const key = th.dataset.sort;
    if (empSort.key !== key)      empSort = { key, dir: 1 };
    else if (empSort.dir === 1)   empSort = { key, dir: -1 };
    else                          empSort = { key: "", dir: 1 };
    renderEmployees();
}

function onEmpFilterChange(e) {
    const sel = e.target.closest("select[data-filter]");
    if (!sel) return;
    if (sel.value) empFilter[sel.dataset.filter] = sel.value;
    else delete empFilter[sel.dataset.filter];
    buildEmpFilters();
    renderEmployees();
}

function onEmpFilterClick(e) {
    const drop = e.target.closest("[data-drop-filter]");
    if (drop) delete empFilter[drop.dataset.dropFilter];
    else if (e.target.closest("[data-clear-filters]")) empFilter = {};
    else return;
    buildEmpFilters();
    renderEmployees();
}

function onEmpFiltersToggle() {
    empFiltersOpen = !empFiltersOpen;
    syncEmpFilterBar();
}

function sortableTh(key, label, cls) {
    const on = empSort.key === key;
    const mark = on ? (empSort.dir === 1 ? "▲" : "▼") : "⇅";
    return `<th class="${cls} is-sortable${on ? " is-sorted" : ""}" data-sort="${key}"
        aria-sort="${on ? (empSort.dir === 1 ? "ascending" : "descending") : "none"}"
        title="Sort by ${label}">${label}<span class="sort-mark">${mark}</span></th>`;
}

function renderEmployees() {
    const searchBox = document.getElementById("searchBox");
    const tableHead = document.getElementById("tableHead");
    const tableEl   = document.getElementById("employeeTable");
    const metaEl    = document.getElementById("tableMeta");

    if (!tableHead || !tableEl) return;

    const search   = searchBox?.value.trim().toLowerCase() || "";
    const filtered = sortEmployees(employees.filter(emp =>
        empMatchesFilters(emp) && JSON.stringify(emp).toLowerCase().includes(search)));

    if (metaEl) {
        const narrowed = search || Object.keys(empFilter).length;
        metaEl.textContent = narrowed
            ? `${filtered.length} of ${employees.length} records`
            : `${filtered.length} record${filtered.length !== 1 ? "s" : ""}`;
    }

    const tableCols = getTableColumns();
    const colCount  = tableCols.length + 1 + (currentRole === "Admin" ? 1 : 0);

    tableHead.innerHTML = `
        <tr>
            ${currentRole === "Admin" ? `<th class="col-actions">Actions</th>` : ""}
            ${sortableTh("__id", "ID", "col-id")}
            ${tableCols.map(key => {
                const field = schemaFields.find(f => f.key === key);
                return sortableTh(key, field ? field.label : key, colClass(key));
            }).join("")}
        </tr>
    `;

    if (filtered.length === 0) {
        tableEl.innerHTML = `
            <tr><td colspan="${colCount}">
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    No employees match your search or filters.
                </div>
            </td></tr>
        `;
        return;
    }

    tableEl.innerHTML = filtered.map(emp => `
        <tr class="${isActiveEmployee(emp) ? "" : "row-inactive"}">
            ${currentRole === "Admin" ? `
            <td class="col-actions">
                <button class="btn-edit"   data-action="edit"   data-id="${escHtml(emp.id)}" title="Edit" aria-label="Edit">✏️</button>
                <button class="btn-delete" data-action="delete" data-id="${escHtml(emp.id)}" title="Delete" aria-label="Delete">🗑️</button>
            </td>` : ""}
            <td class="col-id"><code style="font-size:12px;color:#6b7280;">${escHtml(emp.id)}</code></td>
            ${tableCols.map(key => {
                const val = emp[key] || "";
                const cls = colClass(key);
                if (key === "Status") {
                    const active = isActiveEmployee(emp);
                    return `<td class="${cls}"><span class="badge-status${active ? "" : " is-inactive"}">${
                        active ? "Active" : "Inactive"}</span></td>`;
                }
                if (MULTI_VALUE_FIELDS[key]) return `<td class="${cls}">${multiCellHtml(val, emp.id, key)}</td>`;
                if (key === "Dept") return `<td class="${cls}"><span class="badge-dept">${escHtml(val) || "—"}</span></td>`;
                if (key === "Email" && val) return `<td class="${cls}"><a href="mailto:${escHtml(val)}" style="color:#4f8ef7;text-decoration:none;">${escHtml(val)}</a></td>`;
                return `<td class="${cls}">${escHtml(val) || "—"}</td>`;
            }).join("")}
        </tr>
    `).join("");
}

/* ====================================
   ORGANISATION CHART

   The hierarchy already exists in the data: every record carries a
   "Reporting manager" holding that manager's email, so matching it against
   Email gives parent -> child. Nothing is hardcoded, so the chart follows the
   directory as it changes.

   Two things the data cannot be trusted to guarantee, both handled below:
   a manager email that matches nobody (those people are shown separately
   rather than dropped), and a reporting loop created by an edit, which would
   otherwise recurse until the page died.
==================================== */

function allActiveEmployees() {
    return employees.filter(isActiveEmployee);
}

let orgCollapsed = new Set();   // ids whose children are hidden
let orgZoom      = 1;           // 0.3 .. 1, applied to the tree canvas

function buildOrgTree() {
    // The chart is who is here now, so people who have left are left out.
    const active = allActiveEmployees();

    const byEmail = new Map();
    active.forEach(emp => {
        const mail = String(emp["Email"] || "").trim().toLowerCase();
        if (mail && !byEmail.has(mail)) byEmail.set(mail, emp.id);
    });

    const childrenOf = new Map();
    const roots      = [];
    const orphans    = [];

    active.forEach(emp => {
        const mgrMail = String(emp["Reporting manager"] || "").trim().toLowerCase();
        if (!mgrMail) { roots.push(emp.id); return; }

        const mgrId = byEmail.get(mgrMail);
        if (!mgrId || mgrId === emp.id) { orphans.push({ id: emp.id, mgrMail }); return; }

        if (!childrenOf.has(mgrId)) childrenOf.set(mgrId, []);
        childrenOf.get(mgrId).push(emp.id);
    });

    const byId = new Map(active.map(emp => [emp.id, emp]));
    const name = id => String((byId.get(id) || {})["Name"] || id).toLowerCase();
    childrenOf.forEach(list => list.sort((a, b) => name(a).localeCompare(name(b))));

    return { byId, childrenOf, roots, orphans };
}

function countDescendants(id, childrenOf, seen = new Set()) {
    if (seen.has(id)) return 0;
    seen.add(id);
    return (childrenOf.get(id) || [])
        .reduce((n, kid) => n + 1 + countDescendants(kid, childrenOf, seen), 0);
}

function orgNodeHtml(id, tree, depth, seen) {
    const { byId, childrenOf } = tree;
    const emp = byId.get(id);
    if (!emp) return "";

    // A reporting loop would recurse forever; stop and say so instead.
    if (seen.has(id)) {
        return `<li><div class="org-node is-orphan">
            <div class="org-role">${escHtml(emp["Name"] || id)}</div>
            <div class="org-name">Reporting loop \u2014 not expanded</div>
        </div></li>`;
    }
    const nextSeen = new Set(seen).add(id);

    const kids      = childrenOf.get(id) || [];
    const collapsed = orgCollapsed.has(id);
    const role      = emp["Designation"] || emp["Name"] || id;
    const showName  = emp["Designation"] ? emp["Name"] : "";

    let html = `<li><div class="org-node${depth === 0 ? " is-root" : ""}"
        data-emp="${escHtml(id)}" title="${escHtml(emp.id)} — click for details">
        <div class="org-role">${escHtml(role)}</div>
        ${showName ? `<div class="org-name">${escHtml(showName)}</div>` : ""}
        ${emp["Dept"] ? `<div class="org-dept">${escHtml(emp["Dept"])}</div>` : ""}
    </div>`;

    if (kids.length) {
        const total = countDescendants(id, childrenOf);
        html += `<button class="org-toggle" data-org-toggle="${escHtml(id)}"
                    title="${collapsed ? "Show" : "Hide"} reports">${
            collapsed ? `+${total}` : "\u2212"
        }</button>`;
        if (!collapsed) {
            html += `<ul>${kids.map(k => orgNodeHtml(k, tree, depth + 1, nextSeen)).join("")}</ul>`;
        }
    }

    return html + `</li>`;
}

function renderOrgChart() {
    const body = document.getElementById("orgBody");
    const meta = document.getElementById("orgMeta");
    if (!body) return;

    const keepLeft = body.scrollLeft;
    const keepTop  = body.scrollTop;

    const tree = buildOrgTree();
    const { byId, childrenOf, roots, orphans } = tree;
    const active   = allActiveEmployees();
    const inactive = employees.length - active.length;

    if (!active.length) {
        body.innerHTML = `<div class="org-empty">No employees loaded yet.</div>`;
        if (meta) meta.textContent = "";
        return;
    }

    // Track who actually made it onto the page, so nobody is silently lost.
    const drawn = new Set();
    const mark = (id, seen) => {
        if (seen.has(id)) return;
        const next = new Set(seen).add(id);
        drawn.add(id);
        (childrenOf.get(id) || []).forEach(kid => mark(kid, next));
    };

    let html = "";

    roots.forEach(r => mark(r, new Set()));
    html += roots.map(r => `<ul class="org-tree">${orgNodeHtml(r, tree, 0, new Set())}</ul>`).join("");

    // A manager email matching nobody would drop that person and everyone under
    // them, so they are shown here instead. The chart only ever draws people
    // who are in this directory, so the manager who could not be found is
    // deliberately not named - only the staff who are actually employees.
    if (orphans.length) {
        const ids = orphans.map(o => o.id);
        ids.forEach(id => mark(id, new Set()));

        html += `<div class="org-group-title">Not linked to the chart</div>
                 <div class="org-group-note">Their Reporting manager is not an active employee in this
                 directory, so they have no place in the tree above.</div>
                 <ul class="org-tree">${
                     ids.map(id => orgNodeHtml(id, tree, 1, new Set())).join("")
                 }</ul>`;
    }

    // Whatever is left can only be a reporting loop that no root leads into.
    const stranded = active.map(e => e.id).filter(id => !drawn.has(id));
    if (stranded.length) {
        html += `<div class="org-group-title">In a reporting loop</div>
                 <div class="org-group-note">These records report to each other in a circle, so they have no path to the top. Fix a Reporting manager to place them.</div>`;
        stranded.forEach(id => {
            if (drawn.has(id)) return;   // already covered by an earlier loop
            mark(id, new Set());
            html += `<ul class="org-tree">${orgNodeHtml(id, tree, 1, new Set())}</ul>`;
        });
    }

    body.innerHTML = `<div class="org-canvas" style="zoom:${orgZoom}">${html}</div>`;
    body.scrollLeft = keepLeft;
    body.scrollTop  = keepTop;

    if (meta) {
        const bits = [`${active.length} people`];
        if (roots.length)     bits.push(`${roots.length === 1 ? "1 top" : roots.length + " tops"}`);
        if (orphans.length)   bits.push(`${orphans.length} unlinked`);
        if (stranded.length)  bits.push(`${stranded.length} in a loop`);
        if (inactive)         bits.push(`${inactive} inactive hidden`);
        meta.textContent = bits.join(" \u00b7 ");
    }
}

/* Collapse everything below `depth`, counting the root as depth 0. */
function setOrgDepth(depth) {
    const { childrenOf, roots, orphans } = buildOrgTree();
    orgCollapsed = new Set();

    if (depth !== Infinity) {
        const visited = new Set();
        const walk = (id, d, seen) => {
            if (seen.has(id)) return;
            const next = new Set(seen).add(id);
            visited.add(id);
            const kids = childrenOf.get(id) || [];
            if (!kids.length) return;
            if (d >= depth) orgCollapsed.add(id);
            kids.forEach(k => walk(k, d + 1, next));
        };

        roots.forEach(r => walk(r, 0, new Set()));
        // the unlinked and looping groups are drawn one level in, so they start
        // from depth 1 - and only the ones no root already reached, or the root
        // itself would be treated as a depth-1 node and collapsed.
        orphans.forEach(o => walk(o.id, 1, new Set()));
        employees.forEach(e => { if (!visited.has(e.id)) walk(e.id, 1, new Set()); });
    }
    renderOrgChart();
}

/* The tree is far wider than any screen, so put the top of the house in the
   middle of the view instead of opening on whichever branch sorts first. */
function centreOrgOnRoot() {
    const body = document.getElementById("orgBody");
    const root = body && body.querySelector(".org-node.is-root");
    if (!body || !root) return;
    const r = root.getBoundingClientRect();
    const b = body.getBoundingClientRect();
    body.scrollLeft += (r.left + r.width / 2) - (b.left + b.width / 2);
}

function setOrgZoom(next) {
    orgZoom = Math.min(1, Math.max(0.3, Math.round(next * 100) / 100));
    const label = document.getElementById("orgZoomReset");
    if (label) label.textContent = `${Math.round(orgZoom * 100)}%`;
    renderOrgChart();
    centreOrgOnRoot();
}

/* Shrink until the tree fits the window, so opening the chart shows the whole
   top of the house instead of a slice of it. Never below 30% - past that the
   names stop being readable and a picture of boxes is no use. */
/* clientWidth counts the padding, which the tree cannot actually occupy, so
   fitting against it leaves a few pixels of overflow and a stray scrollbar. */
function orgContentWidth(el) {
    const cs = getComputedStyle(el);
    return el.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
}

function fitOrgToWidth(tries = 0) {
    const body   = document.getElementById("orgBody");
    const canvas = body && body.querySelector(".org-canvas");
    if (!body || !canvas) return;

    // Called straight after the modal is shown, so the first measurement can
    // land before layout: clientWidth reads 0, the ratio works out as 0 and the
    // chart snaps to the 30% floor for no reason. Wait a frame instead.
    const avail = orgContentWidth(body);
    if (avail <= 0) {
        if (tries < 10) requestAnimationFrame(() => fitOrgToWidth(tries + 1));
        return;
    }

    canvas.style.zoom = 1;              // measure at full size, not the current zoom
    const full = canvas.scrollWidth;
    canvas.style.zoom = orgZoom;        // put it back before deciding

    setOrgZoom(full > avail ? Math.floor((avail / full) * 100) / 100 : 1);
}

function openOrgChart() {
    // One level deep is the whole leadership team; going deeper by default runs
    // to ten thousand pixels before you have clicked anything. Branches open on
    // demand.
    orgZoom = 1;
    orgBranchStack = [];
    setOrgDepth(1);
    document.getElementById("orgModal")?.classList.add("open");
    fitOrgToWidth();     // after .open, or the modal has no width to measure
}

/* One person's details, opened from their card in the chart. Every value comes
   from that employee's own record. The manager is named only when they are an
   employee here too - the chart never puts a name to someone outside the
   directory. */
function openOrgPerson(id) {
    const emp = employees.find(e => e.id === id);
    if (!emp) return;

    const nameEl = document.getElementById("orgPersonName");
    const roleEl = document.getElementById("orgPersonRole");
    const bodyEl = document.getElementById("orgPersonBody");
    if (!nameEl || !bodyEl) return;

    nameEl.textContent = emp["Name"] || emp.id;
    roleEl.textContent = [emp["Designation"], emp["Dept"]].filter(Boolean).join(" \u00b7 ");

    const row = (label, valueHtml) =>
        `<div class="org-person-row">
            <div class="org-person-key">${escHtml(label)}</div>
            <div class="org-person-val">${valueHtml}</div>
        </div>`;

    const plain = (label, value) =>
        value ? row(label, escHtml(value)) : "";

    // Division, District and Block hold lists; show how many and let them scroll.
    const listRow = (label, value) => {
        const items = splitMulti(value);
        if (!items.length) return "";
        if (items.length === 1) return row(label, escHtml(items[0]));
        const nouns = MULTI_VALUE_FIELDS[label];
        return row(label,
            `<span class="org-person-count">${items.length} ${nouns ? nouns.many : "entries"}</span>
             <div class="org-person-list">${items.map(escHtml).join("<br>")}</div>`);
    };

    const { byId, childrenOf } = buildOrgTree();
    const reports = (childrenOf.get(id) || []).length;
    const mgrMail = String(emp["Reporting manager"] || "").trim().toLowerCase();
    const mgr     = mgrMail
        ? employees.find(e => String(e["Email"] || "").trim().toLowerCase() === mgrMail && e.id !== id)
        : null;

    bodyEl.innerHTML = [
        plain("Employee ID", emp.id),
        emp["Email"]  ? row("Email", `<a href="mailto:${escHtml(emp["Email"])}">${escHtml(emp["Email"])}</a>`) : "",
        emp["Mobile"] ? row("Mobile", `<a href="tel:${escHtml(emp["Mobile"])}">${escHtml(emp["Mobile"])}</a>`) : "",
        plain("Location", emp["Location"]),
        plain("State", emp["State"]),
        listRow("Division", emp["Division"]),
        listRow("District", emp["District"]),
        listRow("Block", emp["Block"]),
        mgr ? plain("Reports to", mgr["Name"] || mgr.id) : "",
        reports ? row("Direct reports", `<span class="org-person-count">${reports}</span>`) : ""
    ].join("");

    document.getElementById("orgPersonModal")?.classList.add("open");
}

/* ---- drilling into one team ----

   Expanding in place pushed every sibling sideways and the chart stopped being
   readable after a click or two. Each team gets its own view instead: the
   manager, their direct reports, and a way back up. The stack is the trail of
   managers drilled through, so Back always returns one level. */

let orgBranchStack = [];

function orgBranchHtml(id, tree) {
    const { byId, childrenOf } = tree;
    const emp = byId.get(id);
    if (!emp) return "";

    const kids = childrenOf.get(id) || [];

    const card = (eid, isHead) => {
        const e = byId.get(eid);
        if (!e) return "";
        const role     = e["Designation"] || e["Name"] || eid;
        const showName = e["Designation"] ? e["Name"] : "";
        const below    = countDescendants(eid, childrenOf);
        const mine     = (childrenOf.get(eid) || []).length;
        return `<div class="org-node${isHead ? " is-root" : ""}"
                data-emp="${escHtml(eid)}" title="${escHtml(eid)} \u2014 click for details">
                <div class="org-role">${escHtml(role)}</div>
                ${showName ? `<div class="org-name">${escHtml(showName)}</div>` : ""}
                ${e["Dept"] ? `<div class="org-dept">${escHtml(e["Dept"])}</div>` : ""}
            </div>
            ${!isHead && mine ? `<button class="org-toggle" data-org-toggle="${escHtml(eid)}"
                    title="Open this team">+${below}</button>` : ""}`;
    };

    return `<div class="org-vtree">
        <div class="org-vhead">${card(id, true)}</div>
        ${kids.length
            ? `<ul class="org-vlist">${
                kids.map(k => `<li><div class="org-vrow">${card(k, false)}</div></li>`).join("")
              }</ul>`
            : `<div class="org-vnone">No one reports to them.</div>`}
    </div>`;
}

function renderOrgBranch() {
    const body  = document.getElementById("orgBranchBody");
    const title = document.getElementById("orgBranchTitle");
    const crumb = document.getElementById("orgBranchCrumbs");
    if (!body || !orgBranchStack.length) return;

    const tree = buildOrgTree();
    const id   = orgBranchStack[orgBranchStack.length - 1];
    const emp  = tree.byId.get(id);
    if (!emp) { closeOrgBranch(); return; }

    const kids  = (tree.childrenOf.get(id) || []).length;
    const below = countDescendants(id, tree.childrenOf);

    if (title) {
        title.textContent = `${emp["Name"] || id}` +
            (emp["Designation"] ? ` \u00b7 ${emp["Designation"]}` : "");
    }
    if (crumb) {
        crumb.textContent = `${kids} direct` + (below !== kids ? ` \u00b7 ${below} in total` : "");
    }

    body.innerHTML = `<div class="org-canvas" style="zoom:${orgZoom}">${orgBranchHtml(id, tree)}</div>`;
    body.scrollLeft = 0;
    fitOrgBranchToWidth();
}

/* The stacked layout is narrow by design, so this only has to step in when a
   card is unusually wide. Height is left to scroll. */
function fitOrgBranchToWidth(tries = 0) {
    const body   = document.getElementById("orgBranchBody");
    const canvas = body && body.querySelector(".org-canvas");
    if (!body || !canvas) return;

    const avail = orgContentWidth(body);
    if (avail <= 0) {
        if (tries < 10) requestAnimationFrame(() => fitOrgBranchToWidth(tries + 1));
        return;
    }
    canvas.style.zoom = 1;
    const full = canvas.scrollWidth;
    canvas.style.zoom = full > avail
        ? Math.max(0.3, Math.floor((avail / full) * 100) / 100)
        : 1;
    body.scrollLeft = 0;
    body.scrollTop  = 0;
}

function openOrgBranch(id) {
    orgBranchStack.push(id);
    document.getElementById("orgBranchModal")?.classList.add("open");
    renderOrgBranch();
    const back = document.getElementById("orgBranchBack");
    if (back) back.textContent = orgBranchStack.length > 1 ? "\u2190 Back" : "\u2190 Chart";
}

function orgBranchBack() {
    orgBranchStack.pop();
    if (!orgBranchStack.length) { closeOrgBranch(); return; }
    renderOrgBranch();
    const back = document.getElementById("orgBranchBack");
    if (back) back.textContent = orgBranchStack.length > 1 ? "\u2190 Back" : "\u2190 Chart";
}

function closeOrgBranch() {
    orgBranchStack = [];
    document.getElementById("orgBranchModal")?.classList.remove("open");
}

function closeOrgPerson() {
    document.getElementById("orgPersonModal")?.classList.remove("open");
}

/* Escape closes the details popup first, then the chart. Bound once: this page
   is re-entered every time the user navigates back to it, and a listener on
   document would otherwise stack up one copy per visit. */
let orgEscBound = false;

function bindOrgEscape() {
    if (orgEscBound) return;
    orgEscBound = true;
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (document.getElementById("orgPersonModal")?.classList.contains("open")) {
            closeOrgPerson();
        } else if (document.getElementById("orgBranchModal")?.classList.contains("open")) {
            orgBranchBack();
        } else if (document.getElementById("orgModal")?.classList.contains("open")) {
            closeOrgChart();
        }
    });
}

function closeOrgChart() {
    document.getElementById("orgModal")?.classList.remove("open");
}

/* ====================================
   MODAL
==================================== */

function buildModalForm(empData = {}, isEdit = false) {
    const modalBody = document.getElementById("modalBody");
    if (!modalBody) return;

    let html = `
        <div class="form-row">
            <div class="form-group">
                <label>Employee ID <span class="req">*</span></label>
                <input id="field__empId"
                    value="${isEdit ? (empData.__id || "") : ""}"
                    ${isEdit ? "readonly" : ""}
                    placeholder="e.g. OLF-24-001"
                    style="${isEdit ? "background:#f9fafb;color:#6b7280;" : ""}">
            </div>
            <div class="form-group">
                <label>${schemaFields.find(f => f.key === "Name")?.label || "Full Name"}</label>
                <input id="field__Name" data-fieldkey="Name"
                    value="${escHtml(empData["Name"] || "")}"
                    placeholder="Full name">
            </div>
        </div>
    `;

    // Single-line fields go two to a row; a multiline field (Block) takes a
    // whole row to itself, so `pending` holds a field waiting for its partner.
    const remaining = schemaFields.filter(f => f.key !== "Name");
    let pending = null;

    for (const field of remaining) {
        if (field.multiline) {
            if (pending) {
                html += `<div class="form-row">${fieldHtml(pending, empData)}</div>`;
                pending = null;
            }
            html += `<div class="form-row form-row-full">${fieldHtml(field, empData)}</div>`;
            continue;
        }
        if (pending) {
            html += `<div class="form-row">${fieldHtml(pending, empData)}${fieldHtml(field, empData)}</div>`;
            pending = null;
        } else {
            pending = field;
        }
    }
    if (pending) html += `<div class="form-row">${fieldHtml(pending, empData)}</div>`;

    modalBody.innerHTML = html;

    const saveBtn = document.getElementById("saveEmployeeBtn");
    if (saveBtn) {
        saveBtn.replaceWith(saveBtn.cloneNode(true));
        document.getElementById("saveEmployeeBtn").addEventListener("click", saveEmployee);
    }
}

function fieldHtml(field, empData) {
    const val     = empData[field.key] !== undefined ? empData[field.key] : "";
    const inputId = `field__${field.key.replace(/\s+/g, "_")}`;
    const ph      = escHtml(field.placeholder || field.label);

    if (field.multiline) {
        const count = splitMulti(val).length;
        return `
        <div class="form-group">
            <label>${field.label}</label>
            <textarea id="${inputId}"
                data-fieldkey="${field.key}"
                rows="4"
                placeholder="${ph}">${escHtml(String(val))}</textarea>
            <div class="field-hint">Separate each entry with a semicolon ( ; ).${count > 1 ? ` Currently ${count} entries.` : ""}</div>
        </div>
    `;
    }

    if (field.choices) {
        // default a brand-new record to the first choice rather than to blank
        const current = String(val || field.choices[0]);
        return `
        <div class="form-group">
            <label>${field.label}</label>
            <select id="${inputId}" data-fieldkey="${field.key}">
                ${field.choices.map(c =>
                    `<option value="${escHtml(c)}"${c === current ? " selected" : ""}>${escHtml(c)}</option>`
                ).join("")}
            </select>
        </div>
    `;
    }

    const inputType = field.type || "text";
    return `
        <div class="form-group">
            <label>${field.label}</label>
            <input id="${inputId}"
                data-fieldkey="${field.key}"
                type="${inputType}"
                value="${escHtml(String(val))}"
                placeholder="${ph}">
        </div>
    `;
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function openAddModal() {
    currentMode      = "add";
    currentEditingId = null;
    document.getElementById("modalTitle").textContent      = "Add Employee";
    document.getElementById("saveEmployeeBtn").textContent = "Add Employee";
    buildModalForm({}, false);
    document.getElementById("employeeModal").classList.add("open");
}

function closeModal() {
    const modal = document.getElementById("employeeModal");
    if (modal) modal.classList.remove("open");
}

async function editEmployee(empId) {
    try {
        const snap = await getDoc(doc(db, "Employees", empId));
        const data = snap.data() || {};
        data.__id  = empId;

        currentMode      = "edit";
        currentEditingId = empId;

        document.getElementById("modalTitle").textContent      = "Edit Employee";
        document.getElementById("saveEmployeeBtn").textContent = "Update Employee";

        buildModalForm(data, true);
        document.getElementById("employeeModal").classList.add("open");
    } catch (err) {
        console.error(err);
        notify(err.message, "error");
    }
}

async function deleteEmployeeRecord(empId) {
    const confirmed = await showAppConfirm({
        title: "Delete employee?",
        message: `Delete employee ${empId}? This cannot be undone.\n\n` +
                 `To keep the record for history, set Status to Inactive instead.`,
        type: "error",
        confirmText: "Delete",
        cancelText: "Cancel"
    });
    if (!confirmed) return;
    try {
        // Grab name before deletion so the audit log is human-readable
        const snap         = await getDoc(doc(db, "Employees", empId));
        const employeeName = snap.exists() ? (snap.data()["Name"] || empId) : empId;

        await deleteDoc(doc(db, "Employees", empId));

        await logAudit("employee-deleted", {
            employeeId:   empId,
            employeeName
        });

        await loadEmployees();
        notify(`Employee ${empId} deleted.`, "success");
    } catch (err) {
        console.error(err);
        notify(err.message, "error");
    }
}

async function downloadExcel() {
    if (employees.length === 0) { notify("No employee data to download.", "warning"); return; }

    const XLSX = await loadXLSX();

    const headers = ["ID", ...schemaFields.map(f => f.label)];
    const rows    = employees.map(emp => {
        const row = [emp.id];
        schemaFields.forEach(f => row.push(emp[f.key] !== undefined ? String(emp[f.key]) : ""));
        return row;
    });

    const wsData = [headers, ...rows];
    const ws     = XLSX.utils.aoa_to_sheet(wsData);
    const wb     = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, `OLF_Employees_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function validateMobile(value) {
    // Strip spaces, dashes, parentheses then check for exactly 10 digits
    const digits = String(value).replace(/[\s\-().+]/g, "");
    return /^\d{10}$/.test(digits);
}

/* ====================================
   SAMPLE EXCEL FORMAT DOWNLOAD
   Columns are derived from OLF-24-001
==================================== */

async function downloadSampleExcel() {
    try {
        // Fetch the reference record OLF-24-001 to get exact column order
        const refSnap = await getDoc(doc(db, "Employees", "OLF-24-001"));

        let sampleColumns;
        if (refSnap.exists()) {
            const refData = refSnap.data();
            // Build columns: Employee ID first, then CORE_FIELDS order, then any extras from the record
            const coreKeys  = CORE_FIELDS.map(f => f.key);
            const extraKeys = Object.keys(refData)
                .filter(k => !coreKeys.includes(k))
                .sort();
            // coreKeys is used rather than the reference record's own keys so
            // that columns added after OLF-24-001 was written still appear.
            sampleColumns = ["Employee ID", ...coreKeys, ...extraKeys];
        } else {
            // Fallback: use current schemaFields if OLF-24-001 not found
            sampleColumns = ["Employee ID", ...schemaFields.map(f => f.key)];
        }

        // Build one sample row showing placeholder values
        const sampleRow = sampleColumns.map(col => {
            const placeholders = {
                "Employee ID":        "OLF-24-001",
                "Name":               "John Doe",
                "Designation":        "Programme Officer",
                "Dept":               "Lifeskills",
                "Location":           "Mumbai",
                "Email":              "john.doe@openlinksfoundation.org",
                "Mobile":             "9876543210",
                "Reporting manager":  "Jane Smith",
                "Status":             "Active",
                "State":              "Maharashtra",
                "District":           "Pune",
                "Division":           "Pune",
                "Block":              "272501-AMBEGAON; 272502-BARAMATI"
            };
            return placeholders[col] || "";
        });

        const XLSX   = await loadXLSX();
        const wsData = [sampleColumns, sampleRow];
        const ws     = XLSX.utils.aoa_to_sheet(wsData);
        const wb     = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sample");
        XLSX.writeFile(wb, "OLF_Employee_Upload_Sample.xlsx");
    } catch (err) {
        console.error("Sample download failed:", err);
        notify("Failed to generate sample format: " + err.message, "error");
    }
}

/* ====================================
   EXCEL / CSV UPLOAD
==================================== */

/**
 * Translate one spreadsheet header into the Firestore field name it refers to.
 *
 * A column may be written either as the stored key ("Dept", "Reporting manager")
 * or as the label the directory displays and exports ("Department", "Reporting
 * Manager"), in any case. "ID" and "Employee ID" both mean the document id.
 * Anything unrecognised is returned unchanged so it is reported to the admin as
 * an ignored column rather than silently becoming a new field.
 */
function canonicalColumn(header, expectedCols) {
    const raw   = String(header).trim();
    const lower = raw.toLowerCase();

    if (lower === "id" || lower === "employee id") return "Employee ID";

    const byKey = expectedCols.find(c => c.toLowerCase() === lower);
    if (byKey) return byKey;

    const byLabel = schemaFields.find(f => String(f.label).toLowerCase() === lower);
    if (byLabel && expectedCols.includes(byLabel.key)) return byLabel.key;

    return raw;
}

async function handleExcelUpload(e) {
    const file = e.target.files[0];
    // Reset the input so the same file can be re-selected if needed
    e.target.value = "";
    if (!file) return;

    try {
        const XLSX = await loadXLSX();

        // Read file as ArrayBuffer for SheetJS
        const arrayBuffer = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = ev => resolve(ev.target.result);
            reader.onerror = ()  => reject(new Error("Could not read file."));
            reader.readAsArrayBuffer(file);
        });

        const workbook  = XLSX.read(arrayBuffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet     = workbook.Sheets[sheetName];
        // header:1 → array of arrays; defval:"" fills empty cells
        const rows      = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

        if (rows.length < 2) {
            await showAppAlert({
                title:   "Nothing to upload",
                message: "The uploaded file is empty or has no data rows.",
                type:    "error"
            });
            return;
        }

        // ── Column validation ──
        // Fetch OLF-24-001 to get expected columns
        const refSnap = await getDoc(doc(db, "Employees", "OLF-24-001"));
        let expectedCols;
        if (refSnap.exists()) {
            const refData  = refSnap.data();
            const coreKeys = CORE_FIELDS.map(f => f.key);
            const extras   = Object.keys(refData).filter(k => !coreKeys.includes(k)).sort();
            expectedCols   = ["Employee ID", ...coreKeys, ...extras];
        } else {
            expectedCols = ["Employee ID", ...schemaFields.map(f => f.key)];
        }

        // Download Excel writes human-readable headers ("Full Name", "Department")
        // while the records are keyed tersely ("Name", "Dept"), so a file that came
        // straight out of Download Excel would not line up with the upload format.
        // Either spelling is accepted, which makes download → edit → re-upload work.
        const headers = rows[0].map(h => canonicalColumn(h, expectedCols));

        // Two headers that mean the same column would make the result depend on
        // which one happened to be read last, so that is rejected outright.
        const duplicateHeaders = headers.filter((h, i) =>
            expectedCols.includes(h) && headers.indexOf(h) !== i);

        if (duplicateHeaders.length > 0) {
            await showAppAlert({
                title:   "Upload failed — duplicate columns",
                message: "These columns appear more than once in your file (a terse and a " +
                         "readable spelling of the same column both count). Keep one of each and try again.",
                type:    "error",
                list:    [...new Set(duplicateHeaders)]
            });
            return;
        }

        // Optional columns (the geography block) may be left out entirely, so a
        // file prepared before they existed still uploads cleanly.
        const missing = expectedCols.filter(col =>
            !headers.includes(col) && !OPTIONAL_KEYS.has(col));
        const extra   = headers.filter(col => !expectedCols.includes(col));

        if (missing.length > 0) {
            await showAppAlert({
                title:   "Upload failed — missing columns",
                message: "Your file is missing the following required column(s). Download the Sample Format and use it as your template, then try again.",
                type:    "error",
                list:    missing
            });
            return;
        }

        if (extra.length > 0) {
            const proceed = await showAppConfirm({
                title:       "Unrecognised columns found",
                message:     `Your file contains ${extra.length} column(s) that aren't part of the employee record. These will be ignored.`,
                type:        "warning",
                list:        extra,
                confirmText: "Continue anyway",
                cancelText:  "Cancel"
            });
            if (!proceed) return;
        }

        // ── Row validation ──
        // An Employee ID that is already in the directory updates that record;
        // one that is not adds a new record. Nothing is written until the whole
        // file has validated and the admin has confirmed the summary.
        const existing = new Map(employees.map(emp => [emp.id, emp]));

        const dataRows   = rows.slice(1).filter(r => r.some(c => String(c).trim() !== ""));
        const errors     = [];
        const seenInFile = new Set();
        const toAdd      = [];
        const toUpdate   = [];
        let unchangedCount = 0;

        dataRows.forEach((row, idx) => {
            const rowNum = idx + 2; // +2 because header is row 1
            const obj    = {};
            headers.forEach((h, i) => { obj[h] = String(row[i] || "").trim(); });

            const empId = obj["Employee ID"];

            if (!empId) {
                errors.push(`Row ${rowNum}: Employee ID is missing.`);
                return;
            }

            // An ID may appear once per file - two rows for one person would
            // make the result depend on which row happened to be written last.
            if (seenInFile.has(empId)) {
                errors.push(`Row ${rowNum}: Employee ID "${empId}" is duplicated within this file.`);
                return;
            }
            seenInFile.add(empId);

            // Mobile number must be exactly 10 digits
            const mobile = obj["Mobile"];
            if (mobile && !validateMobile(mobile)) {
                errors.push(`Row ${rowNum} (${empId}): Mobile number must be exactly 10 digits.`);
                return;
            }

            // Status drives whether someone shows in the chart, so a typo here
            // would quietly take them out of it.
            const status = obj["Status"];
            if (status && !isClearToken(status) &&
                !STATUS_VALUES.some(v => v.toLowerCase() === status.toLowerCase())) {
                errors.push(`Row ${rowNum} (${empId}): Status must be Active or Inactive.`);
                return;
            }
            if (status && !isClearToken(status)) {
                obj["Status"] = STATUS_VALUES.find(v => v.toLowerCase() === status.toLowerCase());
            }

            // Only recognised columns are written; anything else in the file is
            // ignored (the admin was warned about those above).
            const fields = {};
            expectedCols.forEach(col => {
                if (col === "Employee ID") return;
                if (!headers.includes(col)) return;
                fields[col] = obj[col];
            });

            const current = existing.get(empId);

            if (!current) {
                // Nothing to erase on a record that does not exist yet, so the
                // token simply means "leave this empty".
                Object.keys(fields).forEach(col => {
                    if (isClearToken(fields[col])) fields[col] = "";
                });
                toAdd.push({ empId, fields });
                return;
            }

            // For an existing record only the cells that actually carry a value
            // and differ from what is stored are written. A blank cell means
            // "no opinion", never "erase this": a sheet that simply leaves a
            // column empty must not wipe a value somebody typed in by hand.
            const changed = {};
            const cleared = [];
            Object.keys(fields).forEach(col => {
                const next = fields[col];
                const cur  = String(current[col] === undefined ? "" : current[col]);

                if (isClearToken(next)) {
                    if (cur !== "") { changed[col] = ""; cleared.push(col); }
                    return;
                }
                if (next === "") return;
                if (cur === next) return;
                changed[col] = next;
            });

            if (Object.keys(changed).length === 0) { unchangedCount++; return; }

            toUpdate.push({ empId, name: current["Name"] || empId, changed, cleared });
        });

        // Any validation failure cancels the whole upload — nothing is written.
        if (errors.length > 0) {
            await showAppAlert({
                title:   "Upload cancelled",
                message: `${errors.length} row(s) failed validation. Fix these in your file and re-upload — nothing was written to the directory.`,
                type:    "error",
                list:    errors.slice(0, 12).concat(errors.length > 12 ? [`…and ${errors.length - 12} more.`] : [])
            });
            return;
        }

        if (toAdd.length === 0 && toUpdate.length === 0) {
            await showAppAlert({
                title:   "Nothing to change",
                message: unchangedCount > 0
                    ? `All ${unchangedCount} row(s) already match the directory, so there is nothing to write.`
                    : "No valid data rows were found in the file.",
                type:    unchangedCount > 0 ? "info" : "error"
            });
            return;
        }

        // ── Confirm before writing ──
        // This is the live directory, so the admin sees exactly what the file
        // will do - which records, and which columns on each - before a single
        // document is touched.
        const preview = [
            ...toAdd.map(r => `ADD ${r.empId} — ${r.fields["Name"] || "(no name)"}`),
            ...toUpdate.map(r => {
                const cols = Object.keys(r.changed)
                    .map(c => r.cleared.indexOf(c) >= 0 ? `${c} (cleared)` : c);
                return `UPDATE ${r.empId} (${r.name}): ${cols.join(", ")}`;
            })
        ];

        const summary = [];
        if (toAdd.length)      summary.push(`${toAdd.length} new record(s) will be added`);
        if (toUpdate.length)   summary.push(`${toUpdate.length} existing record(s) will be updated`);
        if (unchangedCount)    summary.push(`${unchangedCount} row(s) already match and will be skipped`);

        const proceed = await showAppConfirm({
            title:       "Review before uploading",
            message:     `${summary.join(", ")}.\n\n` +
                         `Only the columns listed below change. ` +
                         `Blank cells in your file are left alone — they never erase a value ` +
                         `that is already in the directory. A cell holding ${CLEAR_TOKEN} empties ` +
                         `that field on purpose.`,
            type:        "warning",
            list:        preview.slice(0, 40)
                             .concat(preview.length > 40 ? [`…and ${preview.length - 40} more.`] : []),
            confirmText: `Write ${toAdd.length + toUpdate.length} record(s)`,
            cancelText:  "Cancel"
        });
        if (!proceed) return;

        // ── Write to Firestore ──
        let addedCount   = 0;
        let updatedCount = 0;
        const uploadErrors = [];

        for (const { empId, fields } of toAdd) {
            try {
                await setDoc(doc(db, "Employees", empId), fields);
                await logAudit("employee-added", {
                    employeeId:   empId,
                    employeeName: fields["Name"] || empId,
                    source:       "excel-upload"
                });
                addedCount++;
            } catch (err) {
                uploadErrors.push(`${empId}: ${err.message}`);
            }
        }

        for (const { empId, name, changed } of toUpdate) {
            try {
                const before = existing.get(empId) || {};

                // merge:true — columns the file does not carry are left exactly
                // as they are rather than being dropped from the document.
                await setDoc(doc(db, "Employees", empId), changed, { merge: true });

                await logAudit("employee-edited", {
                    employeeId:   empId,
                    employeeName: name,
                    changedFields: Object.keys(changed).map(k => ({
                        field: k,
                        from:  String(before[k] === undefined ? "" : before[k]),
                        to:    changed[k]
                    })),
                    source: "excel-upload"
                });
                updatedCount++;
            } catch (err) {
                uploadErrors.push(`${empId}: ${err.message}`);
            }
        }

        const done = [];
        if (addedCount)   done.push(`${addedCount} record(s) added`);
        if (updatedCount) done.push(`${updatedCount} record(s) updated`);

        if (uploadErrors.length > 0) {
            await showAppAlert({
                title:   "Upload finished with errors",
                message: `${done.join(", ") || "Nothing was written"}. ${uploadErrors.length} record(s) failed to save:`,
                type:    "warning",
                list:    uploadErrors.slice(0, 8)
            });
        } else {
            await showAppAlert({
                title:   "File uploaded successfully",
                message: `${done.join(" and ")}.`,
                type:    "success"
            });
        }

        await loadEmployees();

    } catch (err) {
        console.error("Excel upload failed:", err);
        await showAppAlert({ title: "Upload failed", message: err.message, type: "error" });
    }
}



async function saveEmployee() {
    try {
        const empIdInput = document.getElementById("field__empId");
        const empId      = empIdInput?.value.trim();
        if (!empId) { notify("Employee ID is required.", "error"); return; }

        const employeeData = {};
        document.querySelectorAll("#modalBody input[data-fieldkey], #modalBody textarea[data-fieldkey], #modalBody select[data-fieldkey]").forEach(input => {
            employeeData[input.getAttribute("data-fieldkey")] = input.value;
        });

        // Mobile validation
        const mobile = employeeData["Mobile"] || "";
        if (mobile && !validateMobile(mobile)) {
            notify("Mobile number must be exactly 10 digits.", "error");
            document.getElementById("field__Mobile")?.focus();
            return;
        }

        // Block duplicate Employee ID when adding a new record
        if (currentMode === "add" && employees.some(emp => emp.id === empId)) {
            notify(`Employee ID "${empId}" already exists.`, "error");
            return;
        }

        const docId = currentMode === "edit" ? currentEditingId : empId;

        if (currentMode === "edit") {
            // Fetch current data before overwriting so we can diff it
            const beforeSnap = await getDoc(doc(db, "Employees", docId));
            const beforeData = beforeSnap.exists() ? beforeSnap.data() : {};

            await setDoc(doc(db, "Employees", docId), employeeData);

            // Build a list of changed fields: [{ field, from, to }, …]
            const allKeys = new Set([...Object.keys(beforeData), ...Object.keys(employeeData)]);
            const changedFields = [];
            allKeys.forEach(key => {
                const from = String(beforeData[key] ?? "");
                const to   = String(employeeData[key] ?? "");
                if (from !== to) changedFields.push({ field: key, from, to });
            });

            await logAudit("employee-edited", {
                employeeId:    docId,
                employeeName:  employeeData["Name"] || beforeData["Name"] || docId,
                changedFields  // array of { field, from, to }
            });

        } else {
            await setDoc(doc(db, "Employees", docId), employeeData);

            await logAudit("employee-added", {
                employeeId:   docId,
                employeeName: employeeData["Name"] || docId
            });
        }

        closeModal();
        await loadEmployees();
        notify(currentMode === "edit" ? "Employee updated successfully." : "Employee added successfully.", "success");
    } catch (err) {
        console.error(err);
        notify(err.message, "error");
    }
}

/* ====================================
   NEWS / ANNOUNCEMENTS
==================================== */

/* ── Announcement rich text ──
   The Add News box is a small rich-text editor (bold, italic, underline,
   heading, lists, links). A post stores `html` next to the plain `text`;
   the popup, the audit log and older posts keep using `text`. The HTML is
   cleaned down to a short list of tags both when it is saved and when it
   is shown, so nothing unsafe reaches the page even if a record is
   written some other way. */
const NEWS_TAGS   = new Set(["P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "H3", "UL", "OL", "LI", "A"]);
const NEWS_DROP   = /^(SCRIPT|STYLE|IFRAME|FRAME|OBJECT|EMBED|TEMPLATE|NOSCRIPT|SVG|MATH|TITLE|HEAD|META|LINK|BASE|TEXTAREA|SELECT|BUTTON|INPUT|FORM|IMG|PICTURE|VIDEO|AUDIO|CANVAS)$/;
const NEWS_AS_H3  = /^(H1|H2|H4|H5|H6)$/;
const NEWS_AS_DIV = /^(SECTION|ARTICLE|HEADER|FOOTER|ASIDE|MAIN|BLOCKQUOTE|PRE|FIGURE|TABLE|TBODY|THEAD|TR|DL|DT|DD)$/;
const NEWS_LINK   = /^(https?:\/\/|mailto:)/i;

function newsCleanHtml(html) {
    const tpl = document.createElement("template");      // inert: nothing in it runs or loads
    tpl.innerHTML = String(html || "");
    (function clean(node) {
        [...node.childNodes].forEach(ch => {
            if (ch.nodeType === Node.TEXT_NODE) return;
            if (ch.nodeType !== Node.ELEMENT_NODE) { ch.remove(); return; }
            const tag = ch.tagName.toUpperCase();
            if (NEWS_DROP.test(tag)) { ch.remove(); return; }
            clean(ch);
            if (NEWS_AS_H3.test(tag) || NEWS_AS_DIV.test(tag)) {
                const el = document.createElement(NEWS_AS_H3.test(tag) ? "h3" : "div");
                el.append(...ch.childNodes);
                ch.replaceWith(el);
                return;
            }
            if (!NEWS_TAGS.has(tag)) { ch.replaceWith(...ch.childNodes); return; }
            const href = tag === "A" ? (ch.getAttribute("href") || "").trim() : "";
            [...ch.attributes].forEach(a => ch.removeAttribute(a.name));
            if (tag === "A") {
                if (!NEWS_LINK.test(href)) { ch.replaceWith(...ch.childNodes); return; }
                ch.setAttribute("href", href);
                ch.setAttribute("target", "_blank");
                ch.setAttribute("rel", "noopener noreferrer");
            }
            // Empty blocks left behind by editing only add stray gaps
            if (/^(P|DIV|H3|UL|OL)$/.test(tag) && !ch.textContent.trim() && !ch.querySelector("br")) ch.remove();
        });
    })(tpl.content);
    return tpl.innerHTML.trim();
}

// The text of a post as HTML: rich posts cleaned, plain (older) posts escaped.
function newsBody(n, cls) {
    const html = n.html ? newsCleanHtml(n.html) : "";
    return html
        ? `<div class="${cls} news-rich">${html}</div>`
        : `<div class="${cls} news-plain">${escHtml(n.text || "")}</div>`;
}

function newsEditorValue() {
    const area = document.getElementById("newsEditor");
    const text = (area?.innerText || "").replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    return { text, html: text ? newsCleanHtml(area.innerHTML) : "" };
}

function wireNewsEditor() {
    const area      = document.getElementById("newsEditor");
    const bar       = document.getElementById("newsEditorBar");
    const linkRow   = document.getElementById("newsLinkRow");
    const linkInput = document.getElementById("newsLinkUrl");
    if (!area || !bar || !linkRow || !linkInput) return;

    const exec = (cmd, value) => { try { return document.execCommand(cmd, false, value); } catch (e) { return false; } };
    const isHeading = () => { try { return /^h3$/i.test(document.queryCommandValue("formatBlock")); } catch (e) { return false; } };
    const inEditor = () => {
        const sel = window.getSelection();
        return sel && sel.rangeCount && area.contains(sel.getRangeAt(0).commonAncestorContainer);
    };

    // Highlight the toolbar buttons that apply where the cursor is
    const refresh = () => {
        bar.querySelectorAll("[data-cmd]").forEach(b => {
            const cmd = b.dataset.cmd;
            let on = false;
            try {
                on = cmd === "h3" ? isHeading()
                   : /^(bold|italic|underline|insertUnorderedList|insertOrderedList)$/.test(cmd) && document.queryCommandState(cmd);
            } catch (e) { /* not supported: leave it unlit */ }
            b.classList.toggle("is-on", !!on);
        });
    };
    document.addEventListener("selectionchange", () => { if (inEditor()) refresh(); });

    area.addEventListener("focus", () => exec("defaultParagraphSeparator", "p"));
    area.addEventListener("input", () => {
        // Emptied by the person: clear the leftover <br> so the placeholder shows again
        if (!area.textContent.trim() && !area.querySelector("li")) area.innerHTML = "";
        refresh();
    });

    // Paste keeps the useful formatting (headings, lists, bold, links) and drops the rest
    area.addEventListener("paste", e => {
        const cd = e.clipboardData;
        if (!cd) return;
        e.preventDefault();
        const html = cd.getData("text/html");
        if (html) exec("insertHTML", newsCleanHtml(html));
        else      exec("insertText", cd.getData("text/plain"));
    });

    // Toolbar: mousedown is cancelled so the text selection stays in the editor
    let savedRange = null;
    bar.addEventListener("mousedown", e => { if (e.target.closest("button")) e.preventDefault(); });
    bar.addEventListener("click", e => {
        const b = e.target.closest("button[data-cmd]");
        if (!b) return;
        const cmd = b.dataset.cmd;
        area.focus();
        if (cmd === "link") {
            const sel = window.getSelection();
            savedRange = inEditor() ? sel.getRangeAt(0).cloneRange() : null;
            linkRow.classList.add("open");
            linkInput.value = "https://";
            linkInput.focus();
            linkInput.select();
            return;
        }
        if (cmd === "h3")         exec("formatBlock", isHeading() ? "<p>" : "<h3>");
        else if (cmd === "clear") { exec("removeFormat"); exec("unlink"); if (isHeading()) exec("formatBlock", "<p>"); }
        else                      exec(cmd);
        refresh();
    });

    const closeLink = () => { linkRow.classList.remove("open"); area.focus(); };
    const applyLink = () => {
        let url = linkInput.value.trim();
        if (url && !NEWS_LINK.test(url)) url = "https://" + url;
        closeLink();
        const sel = window.getSelection();
        if (savedRange) { sel.removeAllRanges(); sel.addRange(savedRange); }
        if (!url || url === "https://") return;
        if (sel.isCollapsed) exec("insertHTML", `<a href="${escHtml(url)}">${escHtml(url)}</a>&nbsp;`);
        else                 exec("createLink", url);
    };
    document.getElementById("newsLinkOk")?.addEventListener("click", applyLink);
    document.getElementById("newsLinkCancel")?.addEventListener("click", closeLink);
    linkInput.addEventListener("keydown", e => {
        if (e.key === "Enter")  { e.preventDefault(); applyLink(); }
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeLink(); }
    });
}

async function saveNews() {
    const { text, html } = newsEditorValue();
    const startDateTime = document.getElementById("newsStartDate")?.value;
    const endDateTime   = document.getElementById("newsEndDate")?.value;

    if (!text)          { notify("Please enter the announcement text.", "error"); return; }
    if (!startDateTime) { notify("Please select a start date & time.", "error"); return; }
    if (!endDateTime)   { notify("Please select an end date & time.", "error"); return; }

    const startMs = new Date(startDateTime).getTime();
    const endMs   = new Date(endDateTime).getTime();

    if (isNaN(startMs) || isNaN(endMs)) { notify("Invalid date/time.", "error"); return; }
    if (startMs >= endMs) { notify('The "To" date & time must be after the "From" date & time.', "error"); return; }

    try {
        const newsRef = await addDoc(collection(db, "news"), {
            text,
            html,
            startDateTime,
            endDateTime,
            createdAt: new Date().toISOString(),
            createdBy: auth.currentUser?.email || ""
        });

        await logAudit("news-added", {
            newsId:        newsRef.id,
            // Store a short preview (first 120 chars) so the log is readable
            textPreview:   text.length > 120 ? text.slice(0, 120) + "…" : text,
            startDateTime,
            endDateTime
        });

        // Reset form and close modal
        document.getElementById("newsEditor").innerHTML = "";
        document.getElementById("newsLinkRow")?.classList.remove("open");
        document.getElementById("newsStartDate").value = "";
        document.getElementById("newsEndDate").value = "";
        dtpSyncField("newsStartDate");
        dtpSyncField("newsEndDate");
        newsModal.classList.remove("open");

        // Refresh the announcements if still on home page
        if (currentPage === "home") { await renderNewsCards(); await renderNewsBanners(); }

        notify("News posted successfully.", "success");
    } catch (err) {
        console.error(err);
        notify(err.message, "error");
    }
}

// Format a stored datetime (datetime-local string, or legacy date-only string) for display
function formatNewsDateTime(value, isEnd) {
    if (!value) return "";
    // Legacy records only stored a plain date (YYYY-MM-DD)
    const dt = value.length <= 10 ? new Date(`${value}T${isEnd ? "23:59" : "00:00"}`) : new Date(value);
    if (isNaN(dt.getTime())) return value;
    return dt.toLocaleString(undefined, {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

// Get start/end timestamps for a news item, supporting legacy date-only fields
function getNewsRange(n) {
    let startVal = n.startDateTime || n.startDate;
    let endVal   = n.endDateTime   || n.endDate;

    let start = startVal ? new Date(startVal.length <= 10 ? `${startVal}T00:00` : startVal).getTime() : NaN;
    let end   = endVal   ? new Date(endVal.length   <= 10 ? `${endVal}T23:59:59` : endVal).getTime()   : NaN;

    return { start, end };
}

async function renderNewsBanners() {
    const section = document.getElementById("newsBannerSection");
    if (!section) return;

    try {
        const now      = Date.now();
        const snapshot = await getDocs(collection(db, "news"));
        const active   = [];

        snapshot.forEach(d => {
            const n = { id: d.id, ...d.data() };
            const { start, end } = getNewsRange(n);
            if (!isNaN(start) && !isNaN(end) && now >= start && now <= end) active.push(n);
        });

        // Show soonest-expiring announcements first
        active.sort((a, b) => getNewsRange(a).end - getNewsRange(b).end);

        if (active.length === 0) {
            section.innerHTML = "";
            return;
        }

        section.innerHTML = active.map(n => {
            const startVal = n.startDateTime || n.startDate;
            const endVal   = n.endDateTime   || n.endDate;
            return `
            <div class="news-banner">
                <div class="news-banner-icon">📢</div>
                <div class="news-banner-body">
                    <div class="news-banner-label">Announcement</div>
                    ${newsBody(n, "news-banner-text")}
                    <div class="news-banner-dates">📅 ${formatNewsDateTime(startVal, false)} – ${formatNewsDateTime(endVal, true)}</div>
                </div>
                ${currentRole === "Admin" ? `
                <div class="news-banner-actions">
                    <button class="btn-delete-news" data-newsid="${n.id}">🗑 Delete</button>
                </div>` : ""}
            </div>
        `;
        }).join("");

        // Wire delete buttons
        section.querySelectorAll(".btn-delete-news").forEach(btn => {
            btn.addEventListener("click", async () => {
                const confirmed = await showAppConfirm({
                    title: "Delete announcement?",
                    message: "Delete this announcement? This cannot be undone.",
                    type: "error",
                    confirmText: "Delete",
                    cancelText: "Cancel"
                });
                if (!confirmed) return;
                const newsId = btn.dataset.newsid;
                try {
                    // Grab text preview before deletion for the audit log
                    const newsSnap   = await getDoc(doc(db, "news", newsId));
                    const newsData   = newsSnap.exists() ? newsSnap.data() : {};
                    const rawText    = newsData.text || "";
                    const textPreview = rawText.length > 120 ? rawText.slice(0, 120) + "…" : rawText;

                    await deleteDoc(doc(db, "news", newsId));

                    await logAudit("news-deleted", {
                        newsId,
                        textPreview,
                        startDateTime: newsData.startDateTime || newsData.startDate || "",
                        endDateTime:   newsData.endDateTime   || newsData.endDate   || ""
                    });

                    await renderNewsBanners();
                } catch (err) {
                    notify(err.message, "error");
                }
            });
        });

    } catch (err) {
        console.error("News load failed:", err);
    }
}

/* ── News Cards (new home-page section) ── */
async function renderNewsCards() {
    const grid = document.getElementById("newsCardsGrid");
    if (!grid) return;

    grid.innerHTML = `
        <div class="news-empty-state">
            <div class="news-empty-icon">⏳</div>
            Loading announcements…
        </div>`;

    try {
        const now      = Date.now();
        const snapshot = await getDocs(collection(db, "news"));

        const active = [];
        const expired = [];

        snapshot.forEach(d => {
            const n = { id: d.id, ...d.data() };
            const { start, end } = getNewsRange(n);
            if (!isNaN(start) && !isNaN(end)) {
                if (now >= start && now <= end) active.push(n);
                else if (currentRole === "Admin") expired.push(n); // admins see all
            }
        });

        // Sort: soonest-expiring first
        active.sort((a, b) => getNewsRange(a).end - getNewsRange(b).end);
        expired.sort((a, b) => getNewsRange(b).end - getNewsRange(a).end);

        const allVisible = currentRole === "Admin"
            ? [...active, ...expired]
            : active;

        if (allVisible.length === 0) {
            grid.innerHTML = `
                <div class="news-empty-state">
                    <div class="news-empty-icon">📭</div>
                    No announcements right now. Check back later.
                </div>`;
            return;
        }

        grid.innerHTML = allVisible.map(n => {
            const startVal  = n.startDateTime || n.startDate;
            const endVal    = n.endDateTime   || n.endDate;
            const { end }   = getNewsRange(n);
            const isExpired = now > end;

            return `
            <div class="news-card${isExpired ? " news-card--expired" : ""}">
                <div class="news-card-top">
                    <span class="news-card-badge">
                        📢 ${isExpired ? "Expired" : "Announcement"}
                    </span>
                    ${currentRole === "Admin" ? `
                    <button class="btn-delete-news" data-newsid="${n.id}">🗑 Delete</button>
                    ` : ""}
                </div>
                ${newsBody(n, "news-card-text")}
                <button class="news-card-more" type="button" data-newsid="${n.id}" hidden>Read more →</button>
                <div class="news-card-footer">
                    <div class="news-card-dates">
                        📅 ${formatNewsDateTime(startVal, false)} – ${formatNewsDateTime(endVal, true)}
                    </div>
                </div>
            </div>`;
        }).join("");

        // Long posts: cut short on the card, "Read more" opens the whole announcement
        const byId = new Map(allVisible.map(n => [n.id, n]));
        grid.querySelectorAll(".news-card").forEach(card => {
            const body = card.querySelector(".news-card-text");
            const more = card.querySelector(".news-card-more");
            if (!body || !more) return;
            body.classList.add("is-clamped");
            if (body.scrollHeight > body.clientHeight + 4) {
                more.hidden = false;
                more.addEventListener("click", () => openNewsDetail([byId.get(more.dataset.newsid)]));
            } else {
                body.classList.remove("is-clamped");
            }
        });

        // Wire delete buttons
        grid.querySelectorAll(".btn-delete-news").forEach(btn => {
            btn.addEventListener("click", async () => {
                const confirmed = await showAppConfirm({
                    title: "Delete announcement?",
                    message: "Delete this announcement? This cannot be undone.",
                    type: "error",
                    confirmText: "Delete",
                    cancelText: "Cancel"
                });
                if (!confirmed) return;
                const newsId = btn.dataset.newsid;
                try {
                    // Grab text preview before deletion for the audit log
                    const newsSnap    = await getDoc(doc(db, "news", newsId));
                    const newsData    = newsSnap.exists() ? newsSnap.data() : {};
                    const rawText     = newsData.text || "";
                    const textPreview = rawText.length > 120 ? rawText.slice(0, 120) + "…" : rawText;

                    await deleteDoc(doc(db, "news", newsId));

                    await logAudit("news-deleted", {
                        newsId,
                        textPreview,
                        startDateTime: newsData.startDateTime || newsData.startDate || "",
                        endDateTime:   newsData.endDateTime   || newsData.endDate   || ""
                    });

                    await renderNewsCards();
                } catch (err) {
                    notify(err.message, "error");
                }
            });
        });

    } catch (err) {
        console.error("News cards load failed:", err);
        grid.innerHTML = `
            <div class="news-empty-state">
                <div class="news-empty-icon">⚠️</div>
                Failed to load announcements.
            </div>`;
    }
}