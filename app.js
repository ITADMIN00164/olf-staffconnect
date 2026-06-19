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
    { key: "Reporting manager", label: "Reporting Manager",placeholder: "Manager's name"  }
];

const CORE_KEYS = CORE_FIELDS.map(f => f.key);

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

function updateTopbar(user) {
    const firstLetter = user.displayName?.charAt(0)?.toUpperCase() || "U";
    if (topbarName)   topbarName.textContent   = user.displayName || "Staff";
    if (topbarRole)   topbarRole.textContent   = currentRole;
    if (topbarAvatar) topbarAvatar.textContent = firstLetter;
    // Expose user globally so pages can read email
    window.__olfUser = { email: user.email, displayName: user.displayName };
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
    document.querySelectorAll(".nav-item").forEach(el => {
        el.classList.toggle("active", el.dataset.page === page);
    });

    const res  = await fetch(`pages/${page}.html`);
    const html = await res.text();
    pageContent.innerHTML = html;

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

    if (addBtn)    addBtn.addEventListener("click", openAddModal);
    if (searchBox) searchBox.addEventListener("input", renderEmployees);
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
        "Mobile": "col-extra", "Reporting manager": "col-extra"
    };
    return map[key] || "col-extra";
}

function renderEmployees() {
    const searchBox = document.getElementById("searchBox");
    const tableHead = document.getElementById("tableHead");
    const tableEl   = document.getElementById("employeeTable");
    const metaEl    = document.getElementById("tableMeta");

    if (!tableHead || !tableEl) return;

    const search   = searchBox?.value.trim().toLowerCase() || "";
    const filtered = employees.filter(emp => JSON.stringify(emp).toLowerCase().includes(search));

    if (metaEl) metaEl.textContent = `${filtered.length} record${filtered.length !== 1 ? "s" : ""}`;

    const tableCols = getTableColumns();
    const colCount  = tableCols.length + 1 + (currentRole === "Admin" ? 1 : 0);

    tableHead.innerHTML = `
        <tr>
            ${currentRole === "Admin" ? `<th class="col-actions">Actions</th>` : ""}
            <th class="col-id">ID</th>
            ${tableCols.map(key => {
                const field = schemaFields.find(f => f.key === key);
                const label = field ? field.label : key;
                return `<th class="${colClass(key)}">${label}</th>`;
            }).join("")}
        </tr>
    `;

    if (filtered.length === 0) {
        tableEl.innerHTML = `
            <tr><td colspan="${colCount}">
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    No employees match your search.
                </div>
            </td></tr>
        `;
        return;
    }

    tableEl.innerHTML = filtered.map(emp => `
        <tr>
            ${currentRole === "Admin" ? `
            <td class="col-actions">
                <button class="btn-edit"   data-action="edit"   data-id="${emp.id}" title="Edit" aria-label="Edit">✏️</button>
                <button class="btn-delete" data-action="delete" data-id="${emp.id}" title="Delete" aria-label="Delete">🗑️</button>
            </td>` : ""}
            <td class="col-id"><code style="font-size:12px;color:#6b7280;">${emp.id}</code></td>
            ${tableCols.map(key => {
                const val = emp[key] || "";
                const cls = colClass(key);
                if (key === "Dept") return `<td class="${cls}"><span class="badge-dept">${val || "—"}</span></td>`;
                if (key === "Email" && val) return `<td class="${cls}"><a href="mailto:${val}" style="color:#4f8ef7;text-decoration:none;">${val}</a></td>`;
                return `<td class="${cls}">${val || "—"}</td>`;
            }).join("")}
        </tr>
    `).join("");
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

    const remaining = schemaFields.filter(f => f.key !== "Name");
    for (let i = 0; i < remaining.length; i += 2) {
        const f1 = remaining[i];
        const f2 = remaining[i + 1];
        html += `<div class="form-row">`;
        html += fieldHtml(f1, empData);
        if (f2) html += fieldHtml(f2, empData);
        html += `</div>`;
    }

    modalBody.innerHTML = html;

    const saveBtn = document.getElementById("saveEmployeeBtn");
    if (saveBtn) {
        saveBtn.replaceWith(saveBtn.cloneNode(true));
        document.getElementById("saveEmployeeBtn").addEventListener("click", saveEmployee);
    }
}

function fieldHtml(field, empData) {
    const val       = empData[field.key] !== undefined ? empData[field.key] : "";
    const inputType = field.type || "text";
    return `
        <div class="form-group">
            <label>${field.label}</label>
            <input id="field__${field.key.replace(/\s+/g, "_")}"
                data-fieldkey="${field.key}"
                type="${inputType}"
                value="${escHtml(String(val))}"
                placeholder="${field.placeholder || field.label}">
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
        message: `Delete employee ${empId}? This cannot be undone.`,
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
                "Reporting manager":  "Jane Smith"
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

        const headers = rows[0].map(h => String(h).trim());

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

        const missing = expectedCols.filter(col => !headers.includes(col));
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
        // Build a lookup of Employee IDs that already exist in the directory,
        // so we can reject the whole file up front rather than silently overwriting.
        const existingIds = new Set(employees.map(emp => emp.id));

        const dataRows   = rows.slice(1).filter(r => r.some(c => String(c).trim() !== ""));
        const errors     = [];
        const seenInFile = new Set();
        const validRows  = [];

        dataRows.forEach((row, idx) => {
            const rowNum = idx + 2; // +2 because header is row 1
            const obj    = {};
            headers.forEach((h, i) => { obj[h] = String(row[i] || "").trim(); });

            const empId = obj["Employee ID"];

            if (!empId) {
                errors.push(`Row ${rowNum}: Employee ID is missing.`);
                return;
            }

            // 1) Employee ID must not already exist in the directory
            if (existingIds.has(empId)) {
                errors.push(`Row ${rowNum}: Employee ID "${empId}" already exists.`);
                return;
            }

            // ...and must not be repeated within the file itself
            if (seenInFile.has(empId)) {
                errors.push(`Row ${rowNum}: Employee ID "${empId}" is duplicated within this file.`);
                return;
            }
            seenInFile.add(empId);

            // 2) Mobile number must be exactly 10 digits
            const mobile = obj["Mobile"];
            if (mobile && !validateMobile(mobile)) {
                errors.push(`Row ${rowNum} (${empId}): Mobile number must be exactly 10 digits.`);
                return;
            }

            validRows.push({ empId, obj });
        });

        // Any validation failure cancels the whole upload — nothing is written.
        if (errors.length > 0) {
            await showAppAlert({
                title:   "Upload cancelled",
                message: `${errors.length} row(s) failed validation. Fix these in your file and re-upload — no records were added.`,
                type:    "error",
                list:    errors.slice(0, 12).concat(errors.length > 12 ? [`…and ${errors.length - 12} more.`] : [])
            });
            return;
        }

        if (validRows.length === 0) {
            await showAppAlert({
                title:   "Nothing to upload",
                message: "No valid data rows were found in the file.",
                type:    "error"
            });
            return;
        }

        // ── Write to Firestore ──
        // All rows here are guaranteed to be new Employee IDs — duplicates were already rejected above.
        let successCount = 0;
        const uploadErrors = [];

        for (const { empId, obj } of validRows) {
            try {
                // Build Firestore document — strip "Employee ID" key, keep rest
                const firestoreData = {};
                Object.keys(obj).forEach(h => {
                    if (h !== "Employee ID") firestoreData[h] = obj[h];
                });

                await setDoc(doc(db, "Employees", empId), firestoreData);
                await logAudit("employee-added", {
                    employeeId:   empId,
                    employeeName: firestoreData["Name"] || empId,
                    source:       "excel-upload"
                });
                successCount++;
            } catch (err) {
                uploadErrors.push(`${empId}: ${err.message}`);
            }
        }

        if (uploadErrors.length > 0) {
            await showAppAlert({
                title:   "Upload finished with errors",
                message: `${successCount} record(s) uploaded successfully. ${uploadErrors.length} record(s) failed to save:`,
                type:    "warning",
                list:    uploadErrors.slice(0, 8)
            });
        } else {
            await showAppAlert({
                title:   "File uploaded successfully",
                message: `${successCount} new employee record(s) were added to the directory.`,
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
        document.querySelectorAll("#modalBody input[data-fieldkey]").forEach(input => {
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

async function saveNews() {
    const text          = document.getElementById("newsText")?.value.trim();
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
        document.getElementById("newsText").value = "";
        document.getElementById("newsStartDate").value = "";
        document.getElementById("newsEndDate").value = "";
        newsModal.classList.remove("open");

        // Refresh banners if still on home page
        if (currentPage === "home") await renderNewsBanners();

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
                    <div class="news-banner-text">${escHtml(n.text)}</div>
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
                <div class="news-card-text">${escHtml(n.text)}</div>
                <div class="news-card-footer">
                    <div class="news-card-dates">
                        📅 ${formatNewsDateTime(startVal, false)} – ${formatNewsDateTime(endVal, true)}
                    </div>
                </div>
            </div>`;
        }).join("");

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