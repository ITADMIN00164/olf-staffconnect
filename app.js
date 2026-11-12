import { app, trackEvent } from "./firebase-config.js";

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
    serverTimestamp,
    onSnapshot
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

/* ====================================
   SIDEBAR: compact + auto-hide
   - Docked when the app opens, so people can see where to go.
   - Picking a page hides it; the page then uses the full width.
   - Hovering the left edge (or the glowing tab there) slides it
     back over the page; it tucks away again when the mouse leaves.
   - Tap the tab on touch screens; Esc or a tap outside closes it.
   - The pin button keeps it docked (remembered per browser).
==================================== */
const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
const appSidebar       = document.getElementById("appSidebar");
const sidebarEdge      = document.getElementById("sidebarEdge");
const appBody          = appSidebar ? appSidebar.closest(".app-body") : null;

if (sidebarToggleBtn && appSidebar && appBody) {
    appSidebar.classList.remove("collapsed");          // old icon-rail mode is retired
    try { localStorage.removeItem("olf_sidebar_collapsed"); } catch (e) {}

    // The menu always rests as a slim rail and opens when pointed at, so there
    // is nothing left to pin. An old saved "pinned" choice is forgotten.
    const pinned = false;
    try { localStorage.removeItem("olf_sidebar_pinned"); } catch (e) {}
    appBody.classList.add("sb-auto");
    let openTimer = null, closeTimer = null;

    const isAuto = () => appBody.classList.contains("sb-auto");
    // A pop-up dialog is showing if a fixed, (near) full-screen layer sits on
    // top of the middle of the window. The menu stays tucked away then, so it
    // never covers a dialog.
    const dialogOpen = () => {
        let n = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
        if (!n || appSidebar.contains(n) || n === sidebarEdge) return false;
        for (; n && n !== document.body; n = n.parentElement) {
            if (getComputedStyle(n).position !== "fixed") continue;
            const r = n.getBoundingClientRect();
            return r.width >= window.innerWidth * 0.9 && r.height >= window.innerHeight * 0.9;
        }
        return false;
    };
    const setOpen = (open) => {
        clearTimeout(openTimer); clearTimeout(closeTimer);
        appBody.classList.toggle("sb-open", open);
        if (sidebarEdge) sidebarEdge.setAttribute("aria-expanded", open ? "true" : "false");
        if (tbMenuBtn) {
            tbMenuBtn.setAttribute("aria-expanded", open ? "true" : "false");
            tbMenuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        }
    };
    // Phones: the menu button in the top bar.
    const tbMenuBtn = document.getElementById("tbMenuBtn");
    if (tbMenuBtn) tbMenuBtn.addEventListener("click", () => setOpen(!appBody.classList.contains("sb-open")));
    const autoHide = () => {
        if (pinned) return;
        if (!isAuto()) {
            // Switch from docked to floating while still visible, then slide out.
            appBody.classList.add("sb-auto", "sb-open");
            requestAnimationFrame(() => requestAnimationFrame(() => setOpen(false)));
        } else {
            setOpen(false);
        }
    };
    const paintPin = () => {
        sidebarToggleBtn.setAttribute("aria-pressed", pinned ? "true" : "false");
        const t = pinned ? "Let the menu hide automatically" : "Keep the menu open";
        sidebarToggleBtn.title = t;
        sidebarToggleBtn.setAttribute("aria-label", t);
    };
    paintPin();

    sidebarToggleBtn.addEventListener("click", () => setOpen(!appBody.classList.contains("sb-open")));

    // On a phone, choosing a page tucks the drawer away. On a computer the menu
    // stays put under the pointer and closes when the pointer leaves it, so it
    // never snaps shut mid-click.
    appSidebar.addEventListener("click", (e) => {
        if (window.innerWidth > 768) return;
        if (e.target.closest(".nav-item") && !e.target.closest('[aria-disabled="true"]')) autoHide();
    });

    // Reveal on hover of the left edge (short delay avoids accidental pops).
    if (sidebarEdge) {
        sidebarEdge.addEventListener("mouseenter", () => {
            if (!isAuto()) return;
            clearTimeout(closeTimer);
            openTimer = setTimeout(() => { if (!dialogOpen()) setOpen(true); }, 90);
        });
        sidebarEdge.addEventListener("mouseleave", () => clearTimeout(openTimer));
        sidebarEdge.addEventListener("click", () => { if (isAuto() && !dialogOpen()) setOpen(!appBody.classList.contains("sb-open")); });
        sidebarEdge.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen(true);
                const first = appSidebar.querySelector(".nav-item.active") || appSidebar.querySelector(".nav-item");
                if (first) first.focus();
            }
        });
    }
    // Resting as a slim rail, the menu opens when you point at it.
    appSidebar.addEventListener("mouseenter", () => {
        clearTimeout(closeTimer);
        if (!isAuto() || appBody.classList.contains("sb-open")) return;
        clearTimeout(openTimer);
        openTimer = setTimeout(() => { if (!dialogOpen()) setOpen(true); }, 140);
    });
    appSidebar.addEventListener("mouseleave", () => {
        clearTimeout(openTimer);
        if (!isAuto()) return;
        closeTimer = setTimeout(() => setOpen(false), 280);
    });
    // Keyboard users: open while focus is inside, close when it leaves.
    appSidebar.addEventListener("focusin", () => { if (isAuto()) setOpen(true); });
    appSidebar.addEventListener("focusout", (e) => {
        if (isAuto() && !appSidebar.contains(e.relatedTarget)) setOpen(false);
    });
    // Tap outside / Esc closes the floating menu.
    document.addEventListener("pointerdown", (e) => {
        if (isAuto() && appBody.classList.contains("sb-open") &&
            !appSidebar.contains(e.target) && e.target !== sidebarEdge && !e.target.closest("#tbMenuBtn")) setOpen(false);
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && isAuto() && appBody.classList.contains("sb-open")) setOpen(false);
    });
}

/* ====================================
   TOP BAR THAT GETS OUT OF THE WAY
   Scrolling down tucks it away so the page gets the height; scrolling up,
   or moving the pointer to the very top edge, brings it back. It is always
   shown at the top of a page and whenever a page is opened.
==================================== */
(function () {
    const bar  = document.querySelector(".topbar");
    const area = document.getElementById("pageContent");
    if (!bar || !area) return;

    // Where each scrolling box was when it last turned direction. The bar only
    // moves after a real stretch of scrolling one way (STEP px), never on a
    // nudge - and showing or hiding it changes the page's height, which moves
    // the scroll position by itself, so scroll events during that slide are
    // ignored. Without both, the page shook near the bottom (HO Plan most).
    const STEP = 48, SETTLE_MS = 450;
    const anchor = new WeakMap(), last = new WeakMap();
    let hidden = false, settleUntil = 0;
    const show = (on) => {
        if (on === !hidden) return;
        hidden = !on;
        settleUntil = performance.now() + SETTLE_MS;
        document.body.style.setProperty("--tb-h", bar.offsetHeight + "px");
        document.body.classList.toggle("tb-hidden", hidden);
    };
    window.olfTopbarShow = () => show(true);

    // scroll does not bubble, but it can be caught on the way down, so a page
    // that scrolls inside itself (like HO Plan) is covered too
    area.addEventListener("scroll", (e) => {
        const el = e.target;
        if (!el || el === document || !el.scrollHeight) return;
        const y = el.scrollTop || 0;
        const before = last.has(el) ? last.get(el) : y;
        last.set(el, y);
        if (performance.now() < settleUntil) { anchor.set(el, y); return; }
        if (y < 24) { anchor.set(el, y); show(true); return; }
        // a scroller with too little room to hide the bar for keeps it shown
        if (el.scrollHeight - el.clientHeight < 160) return;
        if ((y - before) * ((anchor.get(el) ?? y) - before) > 0) anchor.set(el, before);   // turned round
        const from = anchor.has(el) ? anchor.get(el) : y;
        if (y - from > STEP) { anchor.set(el, y); show(false); }
        else if (from - y > STEP) { anchor.set(el, y); show(true); }
    }, true);

    document.addEventListener("mousemove", (e) => { if (hidden && e.clientY <= 8) show(true); });
    document.addEventListener("focusin", (e) => { if (hidden && bar.contains(e.target)) show(true); });
})();

/* ====================================
   IN-APP NOTIFICATIONS
   Replaces native alert()/confirm() with
   styled, in-app toasts and a modal so
   users never see a browser popup.
==================================== */

// Drawn, not emoji: a filled disc or triangle with a white mark.
const NOTIFY_ICONS = {
    success: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#22C55E"/><path d="m7.5 12.5 3 3 6-6.500" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error:   '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#EF4444"/><path d="m8.500 8.500 7 7M15.500 8.500l-7 7" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>',
    warning: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 1.800 20.500h20.400z" fill="#F59E0B" stroke="#F59E0B" stroke-width="1.600" stroke-linejoin="round"/><path d="M12 9.500v5M12 17.500v.01" stroke="#fff" stroke-width="2.400" stroke-linecap="round"/></svg>',
    info:    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#4F8EF7"/><path d="M12 11v6M12 7.500v.01" stroke="#fff" stroke-width="2.400" stroke-linecap="round"/></svg>'
};

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

        document.getElementById("appMsgIcon").innerHTML  = NOTIFY_ICONS[type] || NOTIFY_ICONS.info;
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

        document.getElementById("appMsgIcon").innerHTML  = NOTIFY_ICONS[type] || NOTIFY_ICONS.warning;
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
        // A sign-in lasts for the day it was made on: yesterday's is not resumed
        if (signedInBeforeToday(user)) {
            await signOut(auth);
            hideLoading();
            showSignin();
            showNewDayNote();
            return;
        }
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
        applyPageAccessNav();          // POM locked by default until the switches are read
        watchPageAccess();             // live: follows IT Admin's on/off switch
        showApp();
        startDayWatch();               // signs out once the day changes
        loadMyEmployeeRecord(email);   // fills the profile chip / ID card
        prefetchPages();               // warm page fragments while idle
        maybeShowNewsPopup();          // once-per-session announcement nudge
        refreshNewsBell();             // live announcements count on the bell

        await navigate("home");
    } else {
        currentRole = "User";
        stopWatchingPageAccess();
        stopDayWatch();
        showSignin();
    }
    hideLoading();
});

/* ====================================
   LOGIN / LOGOUT
==================================== */

async function login() {
    freshSignIn = true;                // the sign-in starting now is today's
    try {
        await signInWithPopup(auth, provider);
    } catch (err) {
        console.error(err);
        await showAppAlert({ title: "Sign-in failed", message: err.message, type: "error" });
    }
}

async function logout() {
    try {
        forgetSignIn();
        await signOut(auth);
    } catch (err) {
        console.error(err);
        await showAppAlert({ title: "Sign-out failed", message: err.message, type: "error" });
    }
}

/* ====================================
   ONE SIGN-IN PER DAY
   A sign-in lasts for the calendar day it was made on, with no idle
   timeout. The first time the app is opened (or the tab comes back, or the
   computer wakes) on a later day, it signs out and asks for today's
   sign-in. The time of the sign-in on this device is kept in localStorage
   (Firebase's own last-sign-in time is the fallback for a session that
   began before this was added) and Home shows how long ago it was.
==================================== */

const SIGNIN_KEY = "olf_signin_at";
let signInAt = null, freshSignIn = false, dayTimer = null;

function signDay(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
function noteSignIn(t) {
    signInAt = new Date(t || Date.now());
    try { localStorage.setItem(SIGNIN_KEY, String(signInAt.getTime())); } catch (e) {}
}
function forgetSignIn() {
    signInAt = null;
    try { localStorage.removeItem(SIGNIN_KEY); } catch (e) {}
}
function signedInBeforeToday(user) {
    if (freshSignIn) { freshSignIn = false; noteSignIn(); return false; }   // just signed in
    let t = 0;
    try { t = Number(localStorage.getItem(SIGNIN_KEY)) || 0; } catch (e) {}
    if (!t && user && user.metadata && user.metadata.lastSignInTime) t = Date.parse(user.metadata.lastSignInTime) || 0;
    if (!t) { noteSignIn(); return false; }
    signInAt = new Date(t);
    if (signDay(signInAt) !== signDay(new Date())) { forgetSignIn(); return true; }
    noteSignIn(t);                                   // keep it on this device
    return false;
}

function startDayWatch() { stopDayWatch(); dayTimer = setInterval(dayCheck, 60 * 1000); }
function stopDayWatch() { if (dayTimer) { clearInterval(dayTimer); dayTimer = null; } }
async function dayCheck() {
    if (!dayTimer || !auth.currentUser || !signInAt) return;
    if (signDay(signInAt) === signDay(new Date())) return;
    stopDayWatch();
    forgetSignIn();
    try { await signOut(auth); } catch (e) { console.error("New-day sign-out failed:", e); return; }
    showNewDayNote();
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) dayCheck(); });

function showNewDayNote() {
    showAppAlert({ title: "New day, new sign-in", type: "info",
        message: "A sign-in lasts for the day it was made on. Please sign in again for today." });
}

// "7h 39m 12s since login" (Home, under the clock; the clock's 1-second tick keeps it live)
function sinceSignInText() {
    if (!signInAt) return "";
    const secs = Math.max(0, Math.floor((Date.now() - signInAt.getTime()) / 1000));
    const h = Math.floor(secs / 3600), m = Math.floor(secs / 60) % 60, s = secs % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return (h ? h + "h " + pad(m) + "m " : m ? m + "m " : "") + (h || m ? pad(s) : s) + "s since login";
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
   SMART GOALS EDITORS (Firestore collection "Smart Goals Admin")
==================================== */
window.SmartGoalsEditors = {
    async list() {
        const editors = [];
        try {
            const snap = await getDocs(collection(db, "Smart Goals Admin"));
            snap.forEach(d => {
                const data = d.data();
                const em = data.Email || data.email || data["Email ID"] || d.id;
                if (em) editors.push(String(em).trim().toLowerCase());
            });
        } catch (e) {
            console.warn("[SmartGoals] Could not fetch editors from Firestore:", e);
        }
        return [...new Set(editors)];
    },
    async add(email) {
        const clean = String(email || "").trim().toLowerCase();
        if (!clean) throw new Error("Email is required to grant edit access");
        await setDoc(doc(db, "Smart Goals Admin", clean), {
            Email: clean,
            updatedAt: new Date().toISOString()
        });
        return clean;
    },
    async remove(email) {
        const clean = String(email || "").trim().toLowerCase();
        if (!clean) return;
        try { await deleteDoc(doc(db, "Smart Goals Admin", clean)); } catch (e) {}
        try {
            const snap = await getDocs(collection(db, "Smart Goals Admin"));
            for (const d of snap.docs) {
                const v = d.data();
                const val = String(v.Email || v["Email ID"] || v.email || "").toLowerCase();
                if (val === clean) { try { await deleteDoc(doc(db, "Smart Goals Admin", d.id)); } catch (e) {} }
            }
        } catch (e) {}
    }
};

window.olfIsEmailAdmin = isEmailAdmin;

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
                        <div class="nd-dates">${hmIcon("calendar")} ${formatNewsDateTime(startVal, false)} \u2013 ${formatNewsDateTime(endVal, true)}</div>
                    </div>`;
        }).join("")
        : `<div class="nd-empty">No active announcements right now.</div>`;

    modal.classList.add("open");
}

/* The bell in the top bar: how many announcements are live right now, and
   a click opens them. Refreshed at sign-in and whenever one is added or
   deleted. */
async function refreshNewsBell(items) {
    const btn = document.getElementById("tbBellBtn");
    if (!btn) return;
    if (!items) {
        try { items = await getActiveNews(); } catch (err) { return; }
    }
    const n = items.length;
    const badge = btn.querySelector(".tb-bell-n");
    if (badge) { badge.textContent = n > 9 ? "9+" : String(n); badge.hidden = n === 0; }
    btn.classList.toggle("has-news", n > 0);
    const label = n ? `${n} active announcement${n === 1 ? "" : "s"}` : "No active announcements";
    btn.setAttribute("aria-label", label);
    btn.title = label;
}
document.getElementById("tbBellBtn")?.addEventListener("click", async () => {
    let items = [];
    try { items = await getActiveNews(); } catch (err) { console.error("Announcements load failed:", err); }
    refreshNewsBell(items);
    openNewsDetail(items);
});

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
                <div class="upcoming-meta"><span class="hm-mi">${hmIcon("pin")}${escHtml(e.district || "\u2014")}</span><span class="hm-mi">${hmIcon("clock")}${escHtml(time)}</span></div>
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

/* Strictly 100% read-only fetch of full Employees records for Team Performance */
window.olfGetEmployees = async function () {
    const snapshot = await getDocs(collection(db, "Employees"));
    const list = [];
    snapshot.forEach(d => {
        list.push({ id: String(d.id || "").trim(), ...d.data() });
    });
    return list;
};

/* ====================================
   WHERE THE ORGANISATION WORKS

   State -> Division -> District, built from the Employees records rather
   than kept in a second place that has to be remembered. Only Inactive
   staff are skipped: a district nobody is posted to any more should stop
   being offered.

   District names are taken exactly as they are written in Employees.
   Nothing here renames, merges or tidies them, so there is no list in the
   code to keep up to date: to change a district's name, change it in the
   Employees tab, and every page that reads the directory follows. (Only
   capitals and spacing are ignored, so "Pune" and "pune " are one place.)

   A state with no districts is left out: it cannot carry a requisition, so
   offering it only strands whoever picks it. Delhi is the live example.

   Fetched once per page load and cached, like the directory above.
==================================== */

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
            districts: keys(splitMulti(r["District"]))
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
    const res  = await fetch(`pages/${page}.html?v=20261112g`, { cache: "no-cache" });
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
   PAGE ACCESS SWITCHES (all pages)
   IT Admin can switch any page (except Home) off for everyone else.
   Stored in Firestore at appSettings/pageAccess:
       { pages: { pom: false, gr: true, ... } }
   A page missing from the map is open, except POM, which keeps its
   original switch (pomEnabled) and stays off until enabled.
   Watched live, so a flip reaches every open session at once.
     - Users: a switched-off page stays in the menu, greyed out with a
       lock, and cannot be opened (anyone on it is sent to Home).
     - IT Admin: every page always opens. Each menu item carries a small
       toggle - green = visible to all users, grey = hidden from users.
   Like the other role checks here this is a UI gate; Firestore rules
   should also limit writes to appSettings to IT Admin.
==================================== */

const PAGE_ACCESS_DOC = doc(db, "appSettings", "pageAccess");
const ALWAYS_OPEN     = new Set(["home"]);
let pageAccessData    = null;      // last snapshot's data (null = not read yet)
let pageAccessLoaded  = false;
let pageAccessUnsub   = null;
let markPageAccessReady;
let pageAccessReady   = new Promise(r => { markPageAccessReady = r; });

function isItAdmin() {
    return String(auth.currentUser?.email || "").toLowerCase() === ORG_ADMIN_EMAIL;
}

// Is this page open to ordinary users?
function isPageEnabled(page) {
    if (!page || ALWAYS_OPEN.has(page)) return true;
    const d = pageAccessData || {};
    if (d.pages && typeof d.pages[page] === "boolean") return d.pages[page];
    if (page === "pom") return d.pomEnabled === true;   // original POM switch; off until enabled
    return true;
}

function pageLabel(page) {
    const el = document.querySelector(`#appSidebar .nav-item[data-page="${page}"] .label`);
    return el ? el.textContent.trim() : page;
}

function watchPageAccess() {
    if (pageAccessUnsub) return;
    pageAccessUnsub = onSnapshot(PAGE_ACCESS_DOC, (snap) => {
        pageAccessData = snap.exists() ? snap.data() : {};
        pageAccessLoaded = true;
        markPageAccessReady();
        applyPageAccessNav();
        applyAwardTabLocks();
        if (currentPage && !isPageEnabled(currentPage) && !isItAdmin()) {
            notify(`${pageLabel(currentPage)} has been switched off by IT Admin.`, "info");
            navigate("home");
        }
    }, (err) => {
        // Can't read the switches: keep POM closed (its old default), leave the rest open.
        console.warn("Page access check failed:", err);
        pageAccessData = {};
        pageAccessLoaded = true;
        markPageAccessReady();
        applyPageAccessNav();
        applyAwardTabLocks();
    });
}

function stopWatchingPageAccess() {
    if (pageAccessUnsub) { pageAccessUnsub(); pageAccessUnsub = null; }
    pageAccessData = null;
    pageAccessLoaded = false;
    pageAccessReady = new Promise(r => { markPageAccessReady = r; });
    applyPageAccessNav();
}

// Paint every menu item: pages IT Admin has switched off are simply not in
// a user's menu; IT Admin still sees them (greyed) with a toggle on each item.
function applyPageAccessNav() {
    const sidebar = document.getElementById("appSidebar");
    if (!sidebar) return;
    const admin = isItAdmin();
    sidebar.classList.toggle("sb-admin", admin);

    sidebar.querySelectorAll(".nav-item[data-page]").forEach(btn => {
        const page = btn.dataset.page;
        const on = isPageEnabled(page);
        const label = pageLabel(page);
        const lockedForMe = !on && !admin;

        btn.classList.toggle("nav-item--locked", lockedForMe);
        btn.classList.toggle("nav-item--locked-hidden", lockedForMe);   // a user never sees a closed page
        btn.classList.toggle("nav-item--locked-admin", !on && admin);
        btn.setAttribute("aria-disabled", lockedForMe ? "true" : "false");
        btn.title = on ? label
            : (admin ? `${label} - hidden from users (only IT Admin can open it)`
                     : `${label} - temporarily unavailable`);

        // No lock badge any more: a closed page is not shown to users at all.
        const oldLock = btn.querySelector(".nav-lock");
        if (oldLock) oldLock.remove();

        // IT Admin toggle. It sits beside the menu button (never inside it,
        // a button can't hold another control), in a shared row.
        let row = btn.parentElement.classList.contains("nav-row") ? btn.parentElement : null;
        let tgl = row ? row.querySelector(".nav-access-toggle") : null;
        if (!admin || ALWAYS_OPEN.has(page)) { if (tgl) tgl.remove(); return; }
        if (!row) {
            row = document.createElement("div");
            row.className = "nav-row";
            btn.parentNode.insertBefore(row, btn);
            row.appendChild(btn);
        }
        if (!tgl) {
            tgl = document.createElement("button");
            tgl.type = "button";
            tgl.className = "nav-access-toggle";
            tgl.setAttribute("role", "switch");
            tgl.innerHTML = '<span class="nat-knob" aria-hidden="true"></span>';
            tgl.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                setPageEnabled(page, !isPageEnabled(page));
            });
            row.appendChild(tgl);
        }
        tgl.hidden = row.hidden = btn.hidden;           // follows items that hide themselves
        tgl.setAttribute("aria-checked", on ? "true" : "false");
        tgl.setAttribute("aria-label", `${label}: ${on ? "visible to all users" : "hidden from users"}`);
        tgl.title = on ? `${label} is visible to all users - click to hide it from users`
                       : `${label} is hidden from users - click to show it to everyone`;
    });
    requestAnimationFrame(() => menuGlider.move());      // items may have come or gone
}

async function setPageEnabled(page, on) {
    if (!isItAdmin() || ALWAYS_OPEN.has(page)) return;
    const label = pageLabel(page);
    if (!on) {
        const ok = await showAppConfirm({
            title: `Hide ${label} from users?`,
            message: `${label} will disappear from the menu for users and they won't be able to open it. Anyone on it now is sent to Home. You can still open it.`,
            type: "warning",
            confirmText: "Hide from users"
        });
        if (!ok) return;
    }
    const tgl = document.querySelector(`#appSidebar .nav-item[data-page="${page}"]`)
        ?.parentElement?.querySelector(".nav-access-toggle");
    if (tgl) { tgl.disabled = true; tgl.setAttribute("aria-checked", on ? "true" : "false"); }
    try {
        const currentPages = (pageAccessData && pageAccessData.pages) ? { ...pageAccessData.pages } : {};
        currentPages[page] = on;
        const patch = {
            pages: currentPages,
            updatedBy: auth.currentUser?.email || "",
            updatedAt: serverTimestamp()
        };
        if (page === "pom") patch.pomEnabled = on;       // keep the original POM switch in step
        await setDoc(PAGE_ACCESS_DOC, patch, { merge: true });
        logAudit(on ? "page-enabled" : "page-disabled", { page });
        notify(on ? `${label} is now visible to all users.` : `${label} is now hidden from users.`, "success");
        // The live listener repaints the menu.
    } catch (err) {
        console.error(err);
        await showAppAlert({
            title: `Could not change ${label}`,
            message: "Firestore did not accept the change (" + (err.code || err.message) + "). " +
                     "Check that the Firestore rules allow IT Admin to write to appSettings.",
            type: "error"
        });
    } finally {
        if (tgl) tgl.disabled = false;
        applyPageAccessNav();
    }
}

/* ====================================
   TEST PAGE TAB LOCKS (IT Admin)
   The Award Management page's three top tabs - Award Utilisation, Event Management
   and Stock Management - can each be locked by IT Admin.
     - Users: a locked tab is not shown at all. If every tab is locked
       they see a short notice instead.
     - IT Admin: every tab stays visible, each with a small Lock/Unlock
       button beside it.
   Stored in the same appSettings/pageAccess doc, watched live:
       { awardTabLocks: { util: false, event: true, stock: false } }
   true = locked; a tab missing from the map is open. Like the page
   switches, this is a UI gate.
==================================== */

const AWARD_TABS = { util: "Awards", event: "Events", stock: "Gifts" };
const LOCK_ICON   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const UNLOCK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.8"/></svg>';

function isAwardTabLocked(key) {
    const locks = (pageAccessData || {}).awardTabLocks || {};
    return locks[key] === true;
}

function applyAwardTabLocks() {
    const nav = document.querySelector(".award-page .aw-toptabs");
    if (!nav) return;                                  // the Award Management page isn't on screen
    const admin = isItAdmin();
    const tabs = Array.from(nav.querySelectorAll(".aw-toptab[data-aw-top]"));

    tabs.forEach(tab => {
        const key = tab.getAttribute("data-aw-top");
        const name = AWARD_TABS[key] || tab.textContent.trim();
        const locked = isAwardTabLocked(key);

        // Each tab sits in a small wrapper so its lock button can sit beside it
        // (a button can't hold another control).
        let wrap = tab.parentElement.classList.contains("aw-tabwrap") ? tab.parentElement : null;
        if (!wrap) {
            wrap = document.createElement("span");
            wrap.className = "aw-tabwrap";
            wrap.setAttribute("role", "presentation");
            nav.insertBefore(wrap, tab);
            wrap.appendChild(tab);
        }
        wrap.hidden = locked && !admin;
        tab.classList.toggle("aw-toptab--locked", locked && admin);

        let btn = wrap.querySelector(".aw-tablock");
        if (!admin) { if (btn) btn.remove(); return; }
        if (!btn) {
            btn = document.createElement("button");
            btn.type = "button";
            btn.className = "aw-tablock";
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                setAwardTabLocked(key, !isAwardTabLocked(key));
            });
            wrap.appendChild(btn);
        }
        btn.classList.toggle("is-locked", locked);
        btn.setAttribute("aria-pressed", locked ? "true" : "false");
        btn.innerHTML = (locked ? LOCK_ICON : UNLOCK_ICON) + `<span>${locked ? "Locked" : "Unlocked"}</span>`;
        btn.setAttribute("aria-label", `${name}: ${locked ? "locked, hidden from users" : "unlocked, visible to users"}`);
        btn.title = locked ? `${name} is hidden from users - click to unlock it`
                           : `${name} is visible to users - click to lock it`;
    });

    // Users: never leave them on a tab they can no longer see.
    const page = nav.closest(".award-page");
    const visible = tabs.filter(t => !t.parentElement.hidden);
    const views = ["aw-view-stock", "aw-view-award", "aw-view-dash", "aw-view-event", "aw-util-bar", "aw-stock-actions"]
        .map(id => document.getElementById(id)).filter(Boolean);
    let notice = page ? page.querySelector(".aw-alllocked") : null;

    if (!visible.length) {
        views.forEach(v => { v.hidden = true; });
        if (!notice && page) {
            notice = document.createElement("div");
            notice.className = "aw-alllocked";
            notice.setAttribute("role", "status");
            notice.innerHTML = LOCK_ICON + "<div><strong>This section is locked</strong>" +
                "<span>IT Admin has locked it for now. Please check back later.</span></div>";
            const bar = page.querySelector(".aw-topbar");
            if (bar) bar.after(notice); else page.prepend(notice);
        }
        nav.dataset.allLocked = "1";
        return;
    }
    const wasAllLocked = nav.dataset.allLocked === "1";
    if (notice) notice.remove();
    delete nav.dataset.allLocked;
    const active = tabs.find(t => t.classList.contains("is-active"));
    if (wasAllLocked || !active || active.parentElement.hidden) visible[0].click();
}

async function setAwardTabLocked(key, locked) {
    if (!isItAdmin() || !AWARD_TABS[key]) return;
    const name = AWARD_TABS[key];
    if (locked) {
        const ok = await showAppConfirm({
            title: `Lock ${name}?`,
            message: `Users won't see the ${name} tab on the Award Management page until you unlock it. Anyone on it now is moved to another tab. You will still see it.`,
            type: "warning",
            confirmText: "Lock tab"
        });
        if (!ok) return;
    }
    const btn = document.querySelector(`.award-page .aw-toptab[data-aw-top="${key}"]`)
        ?.parentElement?.querySelector(".aw-tablock");
    if (btn) btn.disabled = true;
    try {
        await setDoc(PAGE_ACCESS_DOC, {
            awardTabLocks: { [key]: locked },
            updatedBy: auth.currentUser?.email || "",
            updatedAt: serverTimestamp()
        }, { merge: true });
        logAudit(locked ? "award-tab-locked" : "award-tab-unlocked", { tab: key });
        notify(locked ? `${name} is now locked for users.` : `${name} is now visible to users.`, "success");
        // The live listener repaints the tabs.
    } catch (err) {
        console.error(err);
        await showAppAlert({
            title: `Could not change ${name}`,
            message: "Firestore did not accept the change (" + (err.code || err.message) + "). " +
                     "Check that the Firestore rules allow IT Admin to write to appSettings.",
            type: "error"
        });
    } finally {
        if (btn) btn.disabled = false;
        applyAwardTabLocks();
    }
}

/* ====================================
   ROUTER
   Nav IDs use data-page attribute to
   avoid issues with hyphens in IDs.
==================================== */

// Retired page names still lead somewhere sensible (old links, bookmarks).
const PAGE_ALIASES = { "expense-report": "er-dashboards", "data-dashboards": "er-dashboards" };

/* The menu's selected card is one piece that glides to the page you open,
   rather than jumping. It follows the menu as it opens and closes, and hides
   if the open page isn't in the menu for this person. */
const menuGlider = (() => {
    const nav = document.querySelector("#appSidebar .sidebar-nav");
    if (!nav) return { move() {} };
    const glider = document.createElement("span");
    glider.className = "nav-glider";
    glider.setAttribute("aria-hidden", "true");
    nav.prepend(glider);
    nav.classList.add("has-glider");
    let placed = false;
    const move = () => {
        const btn = nav.querySelector(".nav-item.active");
        const shown = btn && btn.offsetParent && getComputedStyle(btn).display !== "none";
        glider.classList.toggle("is-hidden", !shown);
        if (!shown) return;
        // offsets, not screen boxes: the app is zoomed and these stay in CSS px
        let top = 0, left = 0;
        for (let el = btn; el && el !== nav; el = el.offsetParent) { top += el.offsetTop; left += el.offsetLeft; }
        if (!placed) glider.classList.add("no-anim");
        glider.style.transform = `translate(${left}px, ${top}px)`;
        glider.style.width  = btn.offsetWidth + "px";
        glider.style.height = btn.offsetHeight + "px";
        glider.style.setProperty("--pg", getComputedStyle(btn).getPropertyValue("--pg") || "#2F6FE4");
        if (!placed) { void glider.offsetWidth; glider.classList.remove("no-anim"); placed = true; }
    };
    // the menu widens and narrows as it opens and closes; keep up with it
    if (window.ResizeObserver) new ResizeObserver(() => move()).observe(nav);
    // pages that appear or disappear later (Field Review System, IT Admin's switches) shift the rest
    new MutationObserver((list) => {
        if (list.some(m => m.target !== glider)) requestAnimationFrame(move);
    }).observe(nav, { subtree: true, attributes: true, attributeFilter: ["hidden", "class"] });
    window.addEventListener("resize", () => requestAnimationFrame(move));
    document.getElementById("appSidebar")?.addEventListener("transitionend", move);
    return { move };
})();

/* ====================================
   GLIDING TAB SELECTION, everywhere
   Every row of tabs gets one piece that glides to the chosen tab instead of
   the selection jumping. The piece copies the chosen tab's own look (a
   white pill, a frosted pill, a soft card) or, for rows that mark the
   chosen tab with an underline, becomes a sliding underline. Rows found
   anywhere in the page area, including ones a page draws later, are picked
   up by themselves; nothing in the pages' own code changes.
==================================== */
const TAB_ROWS = [
    "#awHero .aw-toptabs", "#awHero .aw-hero-nav .aw-subtabs",
    "#sgHero .nav-tabs", "#sgHero .dash-subtabs",
    "#posPage .pos-top-tabs--header", "#posPage .pos-subtabs", "#prNav",
    "#pcal-app .pcal-navcard", "#grPage .gr-tabs", "#page-forms .frm-tabs", "#tpHero .tp-view-tabs"
];
const TAB_ACTIVE = ".is-active, .active, .is-on";
const tabGliderLast = new Map();                    // where each row's piece last was, so a redrawn row still glides
function tabRowKey(row) { return row.id || TAB_ROWS.find(s => row.matches(s)) || "row"; }

function moveTabGlider(row) {
    const glider = row.querySelector(":scope > .tab-glider");
    if (!glider) return;
    const btn = [...row.querySelectorAll(TAB_ACTIVE)].find(b => b !== glider && b.offsetParent && !b.hidden);
    glider.classList.toggle("is-hidden", !btn);
    if (!btn) return;
    let x = 0, y = 0;                               // offsets, not screen boxes: the app is zoomed
    for (let el = btn; el && el !== row; el = el.offsetParent) { x += el.offsetLeft; y += el.offsetTop; }
    let w = btn.offsetWidth, h = btn.offsetHeight;

    // copy the chosen tab's own look, read with the row's override switched off for a moment
    row.classList.add("tg-measure");             // no fades while reading, or a half-faded colour gets copied
    row.classList.remove("has-tab-glider");
    const cs = getComputedStyle(btn), after = getComputedStyle(btn, "::after");
    const filled = cs.backgroundColor !== "rgba(0, 0, 0, 0)" || cs.backgroundImage !== "none" || cs.boxShadow !== "none";
    const line = !filled && after.content !== "none" && parseFloat(after.height) <= 6;
    if (filled) {
        glider.style.background = cs.backgroundImage !== "none" ? `${cs.backgroundImage}, ${cs.backgroundColor}` : cs.backgroundColor;
        glider.style.boxShadow = cs.boxShadow;
        glider.style.borderRadius = cs.borderRadius;
    } else if (line) {
        const l = parseFloat(after.left) || 0, r = parseFloat(after.right) || 0, b = parseFloat(after.bottom) || 0;
        const lh = parseFloat(after.height) || 2;
        x += l; w = Math.max(0, w - l - r); y += h - b - lh; h = lh;
        glider.style.background = after.backgroundImage !== "none" ? after.backgroundImage : after.backgroundColor;
        glider.style.boxShadow = "none";
        glider.style.borderRadius = after.borderRadius;
    }
    row.classList.add("has-tab-glider");
    row.classList.toggle("tg-line", line);
    void row.offsetWidth;
    row.classList.remove("tg-measure");
    if (!filled && !line) { glider.classList.add("is-hidden"); return; }

    const to = { x, y, w, h };
    if (!glider.dataset.placed) {                   // a fresh row: start where this row's piece last was
        const from = tabGliderLast.get(tabRowKey(row)) || to;
        glider.classList.add("no-anim");
        Object.assign(glider.style, { transform: `translate(${from.x}px, ${from.y}px)`, width: from.w + "px", height: from.h + "px" });
        void glider.offsetWidth;
        glider.classList.remove("no-anim");
        glider.dataset.placed = "1";
    }
    Object.assign(glider.style, { transform: `translate(${x}px, ${y}px)`, width: w + "px", height: h + "px" });
    tabGliderLast.set(tabRowKey(row), to);
}

function attachTabGlider(row) {
    if (row.dataset.tabGlider) return;
    row.dataset.tabGlider = "1";
    if (getComputedStyle(row).position === "static") row.style.position = "relative";
    const glider = document.createElement("span");
    glider.className = "tab-glider";
    glider.setAttribute("aria-hidden", "true");
    row.prepend(glider);
    const again = () => requestAnimationFrame(() => moveTabGlider(row));
    new MutationObserver((list) => {
        if (list.some(m => m.target !== glider && m.target !== row)) again();
    }).observe(row, { subtree: true, attributes: true, attributeFilter: ["class", "hidden", "style"] });
    if (window.ResizeObserver) new ResizeObserver(again).observe(row);
    again();
}

function scanTabRows() {
    TAB_ROWS.forEach(sel => document.querySelectorAll(sel).forEach(attachTabGlider));
}
(function () {
    const area = document.getElementById("pageContent");
    if (!area || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let queued = false;
    new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; scanTabRows(); });
    }).observe(area, { childList: true, subtree: true });
    // light/dark changes the chosen tab's look; follow it
    new MutationObserver(() => document.querySelectorAll("[data-tab-glider]").forEach(r => moveTabGlider(r)))
        .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();

/* "Where you are" in the top bar: the open page's own colourful picture and
   name, taken from its menu item, sliding in when the page changes. */
function updateTopbarCrumb(page) {
    menuGlider.move();
    const btn  = document.querySelector(`#appSidebar .nav-item[data-page="${page}"]`);
    const ico  = document.getElementById("tbCrumbIco");
    const name = document.getElementById("tbCrumbName");
    const box  = document.getElementById("tbCrumbPage");
    if (!btn || !ico || !name || !box) return;
    ico.innerHTML = btn.querySelector(".icon")?.innerHTML || "";
    name.textContent = (btn.querySelector(".label")?.textContent || btn.title || "").trim();
    box.classList.remove("is-new");
    void box.offsetWidth;                           // replay the slide-in
    box.classList.add("is-new");
}

/* The thin bar along the top while a page opens. It only shows if loading
   takes longer than a blink, so cached pages open without a flicker. */
let routeBarTimer = null;
function routeBar(on) {
    let bar = document.getElementById("olfRouteBar");
    if (!bar) {
        bar = document.createElement("div");
        bar.id = "olfRouteBar";
        bar.className = "olf-route-bar";
        bar.setAttribute("aria-hidden", "true");
        document.body.appendChild(bar);
    }
    clearTimeout(routeBarTimer);
    if (on) {
        bar.classList.remove("is-done");
        routeBarTimer = setTimeout(() => bar.classList.add("is-on"), 120);
    } else if (bar.classList.contains("is-on")) {
        bar.classList.add("is-done");
        routeBarTimer = setTimeout(() => bar.classList.remove("is-on", "is-done"), 600);
    }
}
let pageEnterTimer = null;
function playPageEnter() {
    clearTimeout(pageEnterTimer);
    pageContent.classList.remove("pc-enter");
    void pageContent.offsetWidth;                   // restart the motion for the new page
    pageContent.classList.add("pc-enter");
    pageEnterTimer = setTimeout(() => pageContent.classList.remove("pc-enter"), 1100);
}

window.navigate = async function (page) {
    page = PAGE_ALIASES[page] || page;
    // Any page except Home can be switched off for everyone but IT Admin
    // (see PAGE ACCESS SWITCHES). Every route in - menu, home links - passes here.
    if (!ALWAYS_OPEN.has(page) && !isItAdmin()) {
        if (!pageAccessLoaded) await Promise.race([pageAccessReady, new Promise(r => setTimeout(r, 3000))]);
        if (!isPageEnabled(page)) {
            notify(`${pageLabel(page)} is temporarily unavailable.`, "info");
            return;
        }
    }
    currentPage = page;
    if (window.olfTopbarShow) window.olfTopbarShow();

    // Google Analytics: one page_view per Staff Connect page opened
    trackEvent("page_view", {
        page_title: page,
        page_location: location.origin + "/" + page,
        page_path: "/" + page
    });

    // Stop auto-refreshing news banners when leaving the Home page
    if (newsRefreshInterval) {
        clearInterval(newsRefreshInterval);
        newsRefreshInterval = null;
    }

    // Highlight correct nav item using data-page attribute
    document.querySelectorAll("#appSidebar .nav-item").forEach(el => {
        el.classList.toggle("active", el.dataset.page === page);
    });
    updateTopbarCrumb(page);

    routeBar(true);
    pageContent.innerHTML = await getPageHtml(page);
    pageContent.scrollTop = 0;
    playPageEnter();
    routeBar(false);

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
        applyAwardTabLocks();       // IT Admin's tab locks (hide locked tabs from users)
    }

    else if (page === "team-performance") {
        if (window.TeamPerformance && typeof window.TeamPerformance.mount === "function") {
            window.TeamPerformance.mount();
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

    else if (page === "er-dashboards") {
        // ER & Dashboards (links only): show who the user is signed in as
        const user = window.__olfUser;
        if (user) {
            const emailEl  = pageContent.querySelector("#erdUserEmail");
            const avatarEl = pageContent.querySelector("#erdAvatar");
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

/* Home: greeting, live clock and count-up numbers. */
const HM_ICON_PATHS = {
    pin:       '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
    clock:     '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar:  '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>',
    megaphone: '<path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
    trash:     '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    alert:     '<path d="M12 4 2.500 20h19z"/><path d="M12 10v4.500M12 17.500v.01"/>',
    inbox:     '<path d="M4 13l2.5-7.5A2 2 0 0 1 8.4 4h7.2a2 2 0 0 1 1.9 1.5L20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M4 13h4.5A1.5 1.5 0 0 1 10 14.5a2 2 0 0 0 4 0 1.5 1.5 0 0 1 1.5-1.5H20"/>'
};
function hmIcon(name) {
    return '<svg class="hm-i" viewBox="0 0 24 24" aria-hidden="true">' + HM_ICON_PATHS[name] + "</svg>";
}

/* The Home banner follows the day: morning, afternoon, evening and night
   each have their own colours and their own picture in the sky. */
function homeTimeOfDay(date) {
    const h = date.getHours();
    return h >= 5 && h < 12 ? "morning" : h < 17 && h >= 12 ? "afternoon" : h >= 17 && h < 20 ? "evening" : "night";
}

/* A different, light-hearted greeting each time Home opens, to raise a smile.
   The greetings live in greetings.txt, in [morning] / [afternoon] / [evening]
   / [night] sections plus [monday] [friday] [saturday] [sunday] specials;
   {name} is the person's first name. Picked from the time of day, with the
   odd day special; tapping the waving hand picks another. If the file can't
   be read, the plain greetings below are used. */
let homeGreetings = {
    morning: ["Good morning, {name}"], afternoon: ["Good afternoon, {name}"],
    evening: ["Good evening, {name}"], night: ["Hello, {name}"]
};
let homeGreetingsLoaded = false;
async function loadHomeGreetings() {
    if (homeGreetingsLoaded) return;
    try {
        const res = await fetch("greetings.txt", { cache: "no-cache" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const sets = {};
        let section = null;
        (await res.text()).split(/\r?\n/).forEach(raw => {
            const line = raw.trim();
            if (!line || line.startsWith("#")) return;
            const head = line.match(/^\[([a-z]+)\]$/i);
            if (head) { section = head[1].toLowerCase(); sets[section] = sets[section] || []; return; }
            if (section) sets[section].push(line);
        });
        ["morning", "afternoon", "evening", "night"].forEach(k => { if (sets[k] && sets[k].length) homeGreetings[k] = sets[k]; });
        ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].forEach(k => {
            if (sets[k] && sets[k].length) homeGreetings[k] = sets[k];
        });
        homeGreetingsLoaded = true;
    } catch (err) {
        console.warn("Greetings not loaded, using the plain ones:", err);
    }
}
const HOME_WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
let homeFirstName = "there";
let homeGreetingNow = "";
const homeGreetRecent = [];                         // the last few shown, so none comes round again too soon
function pickHomeGreeting(now) {
    let pool = homeGreetings[homeTimeOfDay(now)];
    const special = homeGreetings[HOME_WEEKDAYS[now.getDay()]];
    if (special && special.length && Math.random() < 0.25) pool = special;
    let choices = pool.filter(g => !homeGreetRecent.includes(g));
    if (!choices.length) choices = pool.filter(g => g !== homeGreetingNow);
    if (!choices.length) choices = pool;
    const pick = choices[Math.floor(Math.random() * choices.length)];
    homeGreetRecent.push(pick);
    if (homeGreetRecent.length > 8) homeGreetRecent.shift();
    return pick;
}
/* A greeting arrives letter by letter: each word is kept whole (so lines
   break between words) and each letter rises in a beat after the one before.
   The name sits in its own golden span. Screen readers get the plain text. */
function greetingLettersHtml(text) {
    let i = 0;
    const letters = (s) => [...s].map(ch => `<span class="hm-ch" style="--d:${(i++) * 26}ms">${escHtml(ch)}</span>`).join("");
    const words = (s) => s.split(" ").map(w => w ? `<span class="hm-w">${letters(w)}</span>` : "").join(" ");
    const [before, after = ""] = text.split("{name}");
    const name = text.includes("{name}") ? `<span class="hm-name" id="homeUserName">${words(homeFirstName)}</span>` : "";
    return words(before) + name + words(after);
}
let homeGreetSwapTimer = null;
function renderHomeGreeting(now) {
    const el = document.getElementById("homeGreetText");
    if (!el) return;
    homeGreetingNow = pickHomeGreeting(now || new Date());
    // "Greeting text | 🎉": the emoji (if any) takes the waving hand's place
    const [text, emoji] = homeGreetingNow.split("|").map(s => s.trim());
    const plain = text.replace("{name}", homeFirstName);
    const show = () => {
        el.setAttribute("aria-label", plain);
        el.innerHTML = `<span class="hm-greet-letters" aria-hidden="true">${greetingLettersHtml(text)}</span>`;
        el.classList.remove("hm-greet-out");
        const ico = document.querySelector("#homeHand .hm-hand-ico");
        if (ico) {
            ico.textContent = emoji || "👋";
            ico.classList.remove("is-new");
            void ico.offsetWidth;                   // replay the pop
            ico.classList.add("is-new");
        }
    };
    clearTimeout(homeGreetSwapTimer);
    // the greeting on screen floats away first, then the new one cascades in
    if (el.querySelector(".hm-ch") && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        el.classList.add("hm-greet-out");
        homeGreetSwapTimer = setTimeout(show, 420);
    } else {
        show();
    }
}

/* While Home is open the greeting changes by itself every few seconds. It
   holds still while the pointer is on it, while the tab isn't on screen, and
   for anyone who has asked their computer for less motion. */
const HOME_GREET_EVERY_MS = 5000;
let homeGreetRotateTimer = null;
function startGreetingRotation() {
    clearInterval(homeGreetRotateTimer);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    homeGreetRotateTimer = setInterval(() => {
        const el = document.getElementById("homeGreetText");
        if (!el) { clearInterval(homeGreetRotateTimer); homeGreetRotateTimer = null; return; }
        if (document.hidden || el.closest(".hm-title")?.matches(":hover")) return;
        renderHomeGreeting();
    }, HOME_GREET_EVERY_MS);
}

/* The waving hand: a big wave, a little burst of confetti, a new greeting. */
function wireHomeHand() {
    const hand = document.getElementById("homeHand");
    if (!hand || hand.dataset.wired) return;
    hand.dataset.wired = "1";
    hand.addEventListener("click", () => {
        renderHomeGreeting();
        hand.classList.remove("is-waving");
        void hand.offsetWidth;
        hand.classList.add("is-waving");
        setTimeout(() => hand.classList.remove("is-waving"), 950);   // so the next emoji can pop in
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const colours = ["#FDE68A", "#F9A8D4", "#6EE7B7", "#93C5FD", "#FDBA74", "#C4B5FD"];
        for (let i = 0; i < 16; i++) {
            const bit = document.createElement("span");
            bit.className = "hm-confetti";
            const angle = (Math.PI * 2 * i) / 16 + Math.random() * 0.4;
            const dist = 38 + Math.random() * 34;
            bit.style.setProperty("--dx", Math.cos(angle) * dist + "px");
            bit.style.setProperty("--dy", Math.sin(angle) * dist - 10 + "px");
            bit.style.setProperty("--rot", Math.round(Math.random() * 360) + "deg");
            bit.style.background = colours[i % colours.length];
            hand.appendChild(bit);
            setTimeout(() => bit.remove(), 900);
        }
    });
}

/* Line of the day, read from lines-of-the-day.txt (one line per line, # for
   notes). Everyone sees the same line on a given day; it moves on at
   midnight. If the file can't be read the line simply stays hidden. */
let homeLines = null;
async function showLineOfDay() {
    const box = document.getElementById("homeLine");
    const text = document.getElementById("homeLineText");
    if (!box || !text) return;
    try {
        if (!homeLines) {
            const res = await fetch("lines-of-the-day.txt", { cache: "no-cache" });
            if (!res.ok) throw new Error("HTTP " + res.status);
            homeLines = (await res.text()).split(/\r?\n/)
                .map(l => l.trim())
                .filter(l => l && !l.startsWith("#"));
        }
        if (!homeLines.length) return;
        const now = new Date();
        const dayNo = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
        text.textContent = homeLines[dayNo % homeLines.length];
        box.hidden = false;
    } catch (err) {
        console.warn("Line of the day not loaded:", err);
    }
}

let homeClockTimer = null;
function startHomeClock() {
    if (homeClockTimer) clearInterval(homeClockTimer);
    let lastDay = null;
    const tick = () => {
        const clock = document.getElementById("homeClock");
        if (!clock) { clearInterval(homeClockTimer); homeClockTimer = null; return; }
        const now = new Date();
        const hero = clock.closest(".hm-hero");
        const tod = homeTimeOfDay(now);
        if (hero && hero.dataset.tod !== tod) {
            hero.dataset.tod = tod;
            renderHomeGreeting(now);                    // on opening, and when the day moves on
        }
        if (lastDay !== null && lastDay !== now.getDate()) showLineOfDay();   // a new day, a new line
        lastDay = now.getDate();
        // 12-hour time: "4:22" with a small "PM"
        const hh = now.getHours() % 12 || 12, mm = String(now.getMinutes()).padStart(2, "0");
        const hm = hh + ":" + mm, ap = now.getHours() < 12 ? "AM" : "PM";
        if (clock.dataset.hm !== hm + ap) {
            clock.dataset.hm = hm + ap;
            clock.innerHTML = hm + '<span class="hm-clock-ap">' + ap + "</span>";
        }
        const since = document.getElementById("homeClockSince");
        if (since) { const txt = sinceSignInText(); if (since.textContent !== txt) since.textContent = txt; }
        const day = document.getElementById("homeClockDay");
        if (day) day.textContent = now.toLocaleDateString("en-IN", { weekday: "long" });
        const date = document.getElementById("homeDate");
        if (date) date.textContent = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    };
    tick();
    homeClockTimer = setInterval(tick, 1000);
}

// Counts up to the figure instead of just appearing.
function animateCount(el, target) {
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || target < 2) { el.textContent = target; return; }
    const start = performance.now(), dur = 900;
    const step = (t) => {
        const p = Math.min(1, (t - start) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1 && document.body.contains(el)) requestAnimationFrame(step); else el.textContent = target;
    };
    requestAnimationFrame(step);
}

async function initHomePage() {
    const user  = auth.currentUser;
    homeFirstName = (user && user.displayName?.split(" ")[0]) || "there";
    // the greetings file is small; wait for it (briefly) so the first greeting is a fun one
    await Promise.race([loadHomeGreetings(), new Promise(r => setTimeout(r, 1500))]);
    startHomeClock();                               // also picks the greeting
    wireHomeHand();
    startGreetingRotation();
    showLineOfDay();

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

    // Field snapshot: headline numbers from the Field Review System
    renderHomeFacts();

    // Local weather: the banner's sky follows it (refreshed every 30 minutes while Home is open)
    renderHomeWeather();
    clearInterval(homeWxTimer);
    homeWxTimer = setInterval(() => { if (currentPage === "home") renderHomeWeather(); }, WX_TTL);

    // Auto-refresh so expired news disappears without a page reload
    if (newsRefreshInterval) clearInterval(newsRefreshInterval);
    newsRefreshInterval = setInterval(() => {
        if (currentPage === "home") renderNewsCards();
    }, 30000); // every 30 seconds

    // The Employees / Departments / Locations tiles are no longer on Home;
    // only read the staff list if a page still shows those figures.
    if (!document.getElementById("statTotal") && !document.getElementById("deptList")) return;
    try {
        const snapshot = await getDocs(collection(db, "Employees"));
        const data = [];
        snapshot.forEach(d => data.push(d.data()));

        animateCount(document.getElementById("statTotal"), data.length);

        const depts = [...new Set(data.map(e => e.Dept).filter(Boolean))];
        animateCount(document.getElementById("statDepts"), depts.length);

        const locs = [...new Set(data.map(e => e.Location).filter(Boolean))];
        animateCount(document.getElementById("statLocations"), locs.length);

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

/* ── Home: local weather in the banner ─────────────────────────────────
   Where the person is: the browser asks once for their location; if they
   say no (or it can't tell), their office Location from the staff list is
   used. The current weather there comes from Open-Meteo (free, no key) and
   the banner's sky follows it - sun or moon, clouds, rain, storm, fog, snow.
   Picture only: no temperature or place is shown. Only the weather code is
   kept (30 minutes, this device); the position itself is never stored. If
   nothing can be read, the banner simply keeps its time-of-day sky. */
const WX_KEY = "olf_wx", WX_TTL = 30 * 60 * 1000;
let homeWxTimer = null;
function wxKind(c) {
    if (c === 0 || c === 1) return "clear";
    if (c === 2) return "partly";
    if (c === 3) return "cloudy";
    if (c === 45 || c === 48) return "fog";
    if (c >= 95) return "storm";
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "snow";
    if (c >= 51) return "rain";
    return "clear";
}
function wxCached() {
    try {
        const w = JSON.parse(localStorage.getItem(WX_KEY) || "null");
        return w && Date.now() - w.at < WX_TTL ? w : null;
    } catch (e) { return null; }
}
async function wxHere() {
    if (!navigator.geolocation) return null;
    try {
        if (navigator.permissions) {
            const st = await navigator.permissions.query({ name: "geolocation" });
            if (st.state === "denied") return null;             // asked before and said no: don't ask again
        }
    } catch (e) {}
    return new Promise(res => navigator.geolocation.getCurrentPosition(
        p => res({ lat: p.coords.latitude, lon: p.coords.longitude, src: "here" }),
        () => res(null),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: WX_TTL }));
}
async function wxOffice() {
    let emp = window.__olfEmployee;
    if (!window.__olfEmployeeLoaded) {
        emp = await new Promise(res => {
            const t = setTimeout(() => res(window.__olfEmployee || null), 6000);
            document.addEventListener("olf:profile-ready", e => { clearTimeout(t); res(e.detail || null); }, { once: true });
        });
    }
    const raw = String((emp && emp.Location) || "").trim();
    if (!raw) return null;
    const names = [raw, raw.split(/[-,(/]/)[0].trim()].filter((v, i, a) => v && a.indexOf(v) === i);
    for (const name of names) {
        try {
            const r = await fetch("https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&countryCode=IN&name=" + encodeURIComponent(name));
            const j = r.ok ? await r.json() : null;
            const g = j && j.results && j.results[0];
            if (g) return { lat: g.latitude, lon: g.longitude, src: "office" };
        } catch (e) {}
    }
    return null;
}
async function loadHomeWeather() {
    const cached = wxCached();
    if (cached) return cached;
    const pos = (await wxHere()) || (await wxOffice());
    if (!pos) return null;
    const lat = pos.lat.toFixed(2), lon = pos.lon.toFixed(2);       // about 1 km is plenty for weather
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code&timezone=auto`);
    if (!r.ok) throw new Error("Weather HTTP " + r.status);
    const c = (await r.json()).current || {};
    const w = { at: Date.now(), code: Number(c.weather_code) };
    if (c.weather_code == null || !Number.isFinite(w.code)) return null;
    try { localStorage.setItem(WX_KEY, JSON.stringify(w)); } catch (e) {}
    return w;
}
async function renderHomeWeather() {
    const hero = document.querySelector(".hm-hero");
    if (!hero) return;
    let w = null;
    try { w = await loadHomeWeather(); } catch (err) { console.warn("Weather not loaded:", err); }
    if (!w || !document.body.contains(hero)) return;
    hero.dataset.wx = wxKind(w.code);          // the sky picture follows the weather
}

/* ── Home: Field snapshot ───────────────────────────────────────────────
   The Field Review System's headline numbers on one slim strip that rolls
   past one after another (pauses under the mouse). Read from its Supabase
   project: the Vinoba report's latest "All Month" upload (week 0), summed
   over every block. Cached for 10 minutes so
   going back to Home doesn't re-read. Hidden if nothing can be read. */
let homeFactsCache = null;
const HOME_FACT_ICONS = {
    school:   '<path d="M3 10 12 5l9 5-9 5z"/><path d="M7 12.2V17c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5v-4.8"/>',
    teacher:  '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.6-3.8 3.4-6 7-6s6.4 2.2 7 6"/>',
    active:   '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-3.2 2.8-5 5.5-5s5 1.8 5.5 5"/><path d="m15.5 11 2 2 3.5-4"/>',
    post:     '<path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3.5V6a1 1 0 0 1 1-1z"/><path d="M8.5 9.5h7M8.5 12.5h4.5"/>',
    star:     '<path d="m12 3.8 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8z"/>',
    spark:    '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>'
};
async function loadHomeFacts(sb) {
    const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const pages = async (build) => {                  // more than 1,000 rows -> page through
        let out = [], from = 0;
        for (;;) {
            const { data, error } = await build().range(from, from + 999);
            if (error) throw error;
            out = out.concat(data || []);
            if (!data || data.length < 1000) return out;
            from += 1000;
        }
    };
    // Programme reach only (no state / district / block counts or field-team numbers on Home)
    const periods = await sb.from("data_periods").select("year,month").eq("week", 0)
        .order("year", { ascending: false }).order("month", { ascending: false }).limit(1);
    const facts = [];
    const add = (icon, color, value, label) => { if (value > 0) facts.push({ icon, color, value, label }); };

    let when = "";
    const p = periods && !periods.error && periods.data && periods.data[0];
    if (p) {
        const rows = await pages(() => sb.from("vinoba_v")            // the same view the Field Review dashboard reads
            .select("total_schools,total_teachers,unique_schools_posting,unique_teachers_posting,total_posts,total_lifeskills,star_teachers")
            .eq("year", p.year).eq("month", p.month).eq("week", 0));
        const sum = (k) => rows.reduce((t, r) => t + (Number(r[k]) || 0), 0);
        const mon = MON[p.month - 1];
        when = mon + " " + p.year;
        add("school", "#0EA5E9", sum("total_schools"), "Schools");
        add("teacher", "#8B5CF6", sum("total_teachers"), "Teachers");
        add("active", "#10B981", sum("unique_teachers_posting"), "Teachers posted in " + mon);
        add("school", "#14B8A6", sum("unique_schools_posting"), "Schools posted in " + mon);
        add("post", "#2F6FE4", sum("total_posts"), "Posts in " + mon);
        add("spark", "#EC4899", sum("total_lifeskills"), "Life-skill posts");
        add("star", "#EAB308", sum("star_teachers"), "Star teachers");
    }
    return { facts, when };
}
async function renderHomeFacts() {
    const box = document.getElementById("homeFacts"), run = document.getElementById("homeFactsRun");
    if (!box || !run || !window.posSupabase) return;
    try {
        if (!homeFactsCache || Date.now() - homeFactsCache.at > 10 * 60 * 1000) {
            homeFactsCache = { at: Date.now(), data: await loadHomeFacts(window.posSupabase) };
        }
    } catch (err) {
        console.warn("Field snapshot not loaded:", err);
        return;
    }
    const { facts, when } = homeFactsCache.data;
    if (!facts.length || !document.body.contains(run)) return;
    const fmt = (v) => Number(v).toLocaleString("en-IN");
    const one = facts.map(f =>
        `<span class="hm-fact" style="--c:${f.color}"><span class="hm-fact-ico" aria-hidden="true"><svg viewBox="0 0 24 24">${HOME_FACT_ICONS[f.icon] || ""}</svg></span>`
        + (f.text ? `<b>${f.text}</b>` : `<b>${fmt(f.value)}</b><span>${f.label}</span>`) + "</span>").join("");
    run.innerHTML = one;
    const when_ = document.getElementById("homeFactsWhen");
    if (when_) when_.textContent = when ? "Vinoba · " + when : "";
    box.hidden = false;
    // Roll only if the figures don't all fit; the run is doubled so the loop has no seam.
    requestAnimationFrame(() => {
        const track = run.parentElement;
        if (!track || run.scrollWidth <= track.clientWidth) return;
        run.innerHTML = one + one.replace(/class="hm-fact"/g, 'class="hm-fact" aria-hidden="true"');
        const half = run.scrollWidth / 2;
        run.style.setProperty("--roll", Math.max(20, Math.round(half / 45)) + "s");   // ~45px a second
        box.classList.add("is-rolling");
    });
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

    ["orgBody", "orgBranchBody"].forEach(bodyId => {
        const host = document.getElementById(bodyId);
        if (!host) return;
        host.addEventListener("keydown", (e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            const card = e.target.closest && e.target.closest(".org-node[data-emp]");
            if (!card || e.target !== card) return;
            e.preventDefault();
            openOrgPerson(card.dataset.emp);
        });
    });

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
    // Each visit starts on current staff; the Status filter can be cleared to
    // see everyone, or switched to Inactive.
    empFilter = { Status: "Active" };
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
    if (tableEl) tableEl.innerHTML = `<tr><td colspan="99" class="empty-state"><span class="emp-spin" aria-hidden="true"></span>Loading…</td></tr>`;

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

function empMatchesFilters(emp, except) {
    return EMP_FILTERS.every(f => {
        const want = empFilter[f.key];
        if (!want || f.key === except) return true;
        const have = empValues(emp, f.key);
        return want === EMP_BLANK ? have.length === 0 : have.includes(want);
    });
}

/* Each drop-down offers what is left once every OTHER filter has been
   applied, so the lists narrow as you choose: pick a state and the divisions
   and districts are only that state's. A drop-down leaves its own choice out
   of its own pool, so it can still be changed. Each option carries how many
   people it would show. */
function empPool(key) {
    const seen = new Map();
    let blank = 0;
    employees.forEach(emp => {
        if (!empMatchesFilters(emp, key)) return;
        const vals = empValues(emp, key);
        if (!vals.length) blank++;
        vals.forEach(v => seen.set(v, (seen.get(v) || 0) + 1));
    });
    return { seen, blank };
}

function buildEmpFilters() {
    const box = document.getElementById("empFilters");
    if (!box) return;

    // A choice that another filter has since made impossible is dropped, and
    // that can in turn empty another, so go round until nothing changes.
    for (let again = true, n = 0; again && n < EMP_FILTERS.length + 1; n++) {
        again = false;
        EMP_FILTERS.forEach(f => {
            const want = empFilter[f.key];
            if (!want) return;
            const { seen, blank } = empPool(f.key);
            if (want === EMP_BLANK ? !blank : !seen.has(want)) { delete empFilter[f.key]; again = true; }
        });
    }

    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    box.innerHTML = EMP_FILTERS.map(f => {
        const { seen, blank } = empPool(f.key);
        const chosen = empFilter[f.key] || "";
        const options = [...seen.keys()].sort(collator.compare);

        return `<div class="emp-filter${chosen ? " is-set" : ""}">
            <label for="empf-${f.key}">${f.label}</label>
            <select id="empf-${f.key}" data-filter="${f.key}">
                <option value="">All</option>
                ${blank ? `<option value="${EMP_BLANK}"${chosen === EMP_BLANK ? " selected" : ""}>(blank) · ${blank}</option>` : ""}
                ${options.map(v => `<option value="${escHtml(v)}"${v === chosen ? " selected" : ""}>${escHtml(v)} · ${seen.get(v)}</option>`).join("")}
            </select>
        </div>`;
    }).join("");

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
    requestAnimationFrame(() => requestAnimationFrame(fitEmpTable));
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

/* Pictures drawn in the Employees page */
const EMP_ICON_PATHS = {
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    edit:   '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    trash:  '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'
};
function empIcon(name) {
    return '<svg class="emp-i" viewBox="0 0 24 24" aria-hidden="true">' + EMP_ICON_PATHS[name] + "</svg>";
}
// A steady colour for each person's initials, taken from their name.
function empAvatarTone(name) {
    let n = 0;
    for (const c of String(name)) n = (n + c.charCodeAt(0)) % 6;
    return n;
}

function sortableTh(key, label, cls) {
    const on = empSort.key === key;
    const mark = on ? (empSort.dir === 1 ? "▲" : "▼") : "⇅";
    return `<th class="${cls} is-sortable${on ? " is-sorted" : ""}" data-sort="${key}"
        aria-sort="${on ? (empSort.dir === 1 ? "ascending" : "descending") : "none"}"
        title="Sort by ${label}">${label}<span class="sort-mark">${mark}</span></th>`;
}

/* The table takes whatever height the window has left below the banner, the
   figures and the toolbar, so as many people as fit are on screen without
   scrolling the page. It is worked out again when the window, the filters or
   the rows change. */
function fitEmpTable() {
    const wrap = document.querySelector(".employees-page .table-wrap");
    const area = document.getElementById("pageContent");
    if (!wrap || !area || !wrap.offsetParent) return;
    const top  = wrap.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop;
    const room = area.clientHeight - top - 46;              // the card's own padding and the page's bottom gap
    wrap.style.maxHeight = Math.max(300, Math.floor(room)) + "px";
}
window.addEventListener("resize", () => requestAnimationFrame(fitEmpTable));

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

    // The figures at the top describe the whole directory, whatever the search shows.
    const empFigures = {
        empStatTotal:    employees.length,
        empStatActive:   employees.filter(isActiveEmployee).length,
        empStatInactive: employees.filter(e => !isActiveEmployee(e)).length,
        empStatDepts:    new Set(employees.map(e => e.Dept).filter(Boolean)).size
    };
    Object.keys(empFigures).forEach(id => {
        const el = document.getElementById(id);
        if (el && el.dataset.v !== String(empFigures[id])) { el.dataset.v = String(empFigures[id]); animateCount(el, empFigures[id]); }
    });

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

    requestAnimationFrame(fitEmpTable);
    if (filtered.length === 0) {
        tableEl.innerHTML = `
            <tr><td colspan="${colCount}">
                <div class="empty-state">
                    <div class="empty-icon">${empIcon("search")}</div>
                    <span class="emp-empty-title">No employees found</span>
                    Nothing matches your search or filters.
                </div>
            </td></tr>
        `;
        return;
    }

    tableEl.innerHTML = filtered.map(emp => `
        <tr class="${isActiveEmployee(emp) ? "" : "row-inactive"}">
            ${currentRole === "Admin" ? `
            <td class="col-actions">
                <button class="btn-edit"   data-action="edit"   data-id="${escHtml(emp.id)}" title="Edit" aria-label="Edit">${empIcon("edit")}</button>
                <button class="btn-delete" data-action="delete" data-id="${escHtml(emp.id)}" title="Delete" aria-label="Delete">${empIcon("trash")}</button>
            </td>` : ""}
            <td class="col-id"><span class="emp-id">${escHtml(emp.id)}</span></td>
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
                if (key === "Email" && val) return `<td class="${cls}"><a class="emp-mail" href="mailto:${escHtml(val)}">${escHtml(val)}</a></td>`;
                if (key === "Name" && val) return `<td class="${cls}"><div class="emp-person"><span class="emp-av av${empAvatarTone(val)}" aria-hidden="true">${escHtml(initialsFrom(val))}</span><span class="emp-name">${escHtml(val)}</span></div></td>`;
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

// Each department keeps one colour wherever it turns up in the chart.
const ORG_TONES = ["#3B82F6", "#8B5CF6", "#14B8A6", "#F59E0B", "#EC4899", "#F97316"];
function orgToneOf(emp) {
    return ORG_TONES[empAvatarTone(String(emp["Dept"] || emp["Name"] || ""))];
}
// The picture and the words of one card, shared by the tree and the stacked team view.
function orgCardInner(emp, id) {
    const role     = emp["Designation"] || emp["Name"] || id;
    const showName = emp["Designation"] ? emp["Name"] : "";
    return `<span class="org-av av${empAvatarTone(emp["Name"] || id)}" aria-hidden="true">${escHtml(initialsFrom(emp["Name"] || id))}</span>
        <div class="org-txt">
            <div class="org-role">${escHtml(role)}</div>
            ${showName ? `<div class="org-name">${escHtml(showName)}</div>` : ""}
            ${emp["Dept"] ? `<div class="org-dept">${escHtml(emp["Dept"])}</div>` : ""}
        </div>`;
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

    let html = `<li><div class="org-node${depth === 0 ? " is-root" : ""}" tabindex="0" role="button"
        data-emp="${escHtml(id)}" style="--dc:${orgToneOf(emp)}" title="${escHtml(emp.id)} — click for details">
        ${orgCardInner(emp, id)}
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
        const below    = countDescendants(eid, childrenOf);
        const mine     = (childrenOf.get(eid) || []).length;
        return `<div class="org-node${isHead ? " is-root" : ""}" tabindex="0" role="button"
                data-emp="${escHtml(eid)}" style="--dc:${orgToneOf(e)}" title="${escHtml(eid)} \u2014 click for details">
                ${orgCardInner(e, eid)}
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
                <div class="news-banner-icon">${hmIcon("megaphone")}</div>
                <div class="news-banner-body">
                    <div class="news-banner-label">Announcement</div>
                    ${newsBody(n, "news-banner-text")}
                    <div class="news-banner-dates">${hmIcon("calendar")} ${formatNewsDateTime(startVal, false)} – ${formatNewsDateTime(endVal, true)}</div>
                </div>
                ${currentRole === "Admin" ? `
                <div class="news-banner-actions">
                    <button class="btn-delete-news" data-newsid="${n.id}">${hmIcon("trash")} Delete</button>
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
        <div class="news-empty-state hm-empty">
            <span class="hm-spin" aria-hidden="true"></span>
            <span class="hm-empty-sub">Loading announcements…</span>
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
        refreshNewsBell(active);
        expired.sort((a, b) => getNewsRange(b).end - getNewsRange(a).end);

        const allVisible = currentRole === "Admin"
            ? [...active, ...expired]
            : active;

        if (allVisible.length === 0) {
            grid.innerHTML = `
                <div class="news-empty-state hm-empty">
                    <span class="hm-empty-ico">${hmIcon("inbox")}</span>
                    <strong class="hm-empty-title">No announcements right now</strong>
                    <span class="hm-empty-sub">Check back later.</span>
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
                        ${hmIcon("megaphone")}${isExpired ? "Expired" : "Announcement"}
                    </span>
                    ${currentRole === "Admin" ? `
                    <button class="btn-delete-news" data-newsid="${n.id}" title="Delete this announcement">${hmIcon("trash")}Delete</button>
                    ` : ""}
                </div>
                ${newsBody(n, "news-card-text")}
                <button class="news-card-more" type="button" data-newsid="${n.id}" hidden>Read more →</button>
                <div class="news-card-footer">
                    <div class="news-card-dates">
                        ${hmIcon("calendar")}${formatNewsDateTime(startVal, false)} – ${formatNewsDateTime(endVal, true)}
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
                <div class="news-empty-icon">${hmIcon("alert")}</div>
                Failed to load announcements.
            </div>`;
    }
}