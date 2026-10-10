/* ====================================
   ORG ADMIN PAGE (pos.js)
   ------------------------------------
   Everyone who's logged in sees a Dashboard tab (placeholder for now).
   Only ORG_ADMIN_EMAIL sees the Admin tab (states/districts/blocks and
   assignments CRUD) - gated here AND in app.js's nav button, same
   pattern po.js uses for PO Review. This file re-checks the email
   itself rather than trusting the hidden button/tab.

   Loaded as a plain classic script (not a module), after
   pos-supabase.js, so `posSupabase` is already in scope on window.
   Uses window.notify / window.showAppAlert / window.showAppConfirm,
   which app.js exposes globally.
==================================== */

const ORG_ADMIN_EMAIL = "itadmin@openlinksfoundation.org";

const posData = {
    states: [],
    districts: [],
    blocks: [],
    assignments: [],
    loaded: false
};

let posActiveTopTab = "dashboard"; // "dashboard" | "admin"
let posActiveTab = "locations";    // sub-tab within admin: "locations" | "assignments"
let posEditingAssignmentId = null; // null = add mode
let posEditingBlockId = null;      // null = add mode

/* ---------- small local helpers (not shared with app.js) ---------- */

function escHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function currentAdminEmail() {
    return (window.__olfUser && window.__olfUser.email) || "unknown";
}

function isOrgAdmin() {
    const user = window.__olfUser;
    return !!user && String(user.email || "").toLowerCase() === ORG_ADMIN_EMAIL;
}

// Friendly text for common Postgres error codes, so the admin never has
// to read a raw Postgres error message.
function friendlyDbError(err) {
    if (!err) return "Something went wrong.";
    if (err.code === "23505") return "That already exists - duplicate entry.";
    if (err.code === "23503") return "Can't delete this - it's still referenced elsewhere (e.g. a block under this district, or an assignment using it).";
    return err.message || "Something went wrong.";
}

/* ====================================
   MOUNT / AUTH GATE
   Dashboard is for everyone; Admin is gated.
==================================== */

function mount() {
    const adminTabBtn = document.getElementById("posAdminTabBtn");
    const adminSection = document.getElementById("posAdminSection");
    if (!adminTabBtn || !adminSection) return; // fragment not loaded yet

    const admin = isOrgAdmin();
    adminTabBtn.hidden = !admin;

    // Non-admins can never land on the admin tab, even if it was left
    // selected from a previous (admin) session on this same browser.
    if (!admin && posActiveTopTab === "admin") posActiveTopTab = "dashboard";

    showTopTab(posActiveTopTab);

    if (admin) {
        if (!posData.loaded) {
            loadAll();
        } else {
            renderBlocksTable();
            renderAssignmentsTable();
        }
    }
}

/* ====================================
   TOP-LEVEL TABS (Dashboard / Admin)
==================================== */

function showTopTab(tab) {
    if (tab === "admin" && !isOrgAdmin()) tab = "dashboard"; // defensive, not just UI
    posActiveTopTab = tab;

    document.querySelectorAll("[data-postoptab]").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.postoptab === tab);
    });
    const dash  = document.getElementById("posDashboard");
    const admin = document.getElementById("posAdminSection");
    if (dash)  dash.style.display  = tab === "dashboard" ? "" : "none";
    if (admin) admin.style.display = tab === "admin" ? "" : "none";

    if (tab === "admin") showTab(posActiveTab);
    if (tab === "dashboard") {
        if (window.FTRDashboard) window.FTRDashboard.mount();
        else {
            // Never fail silently: a missing script used to leave the form frozen.
            const body = document.getElementById("prBody");
            if (body) body.innerHTML = '<div class="pr-empty">The dashboard script is not loaded. Make sure ' +
                '<b>pos-review.js</b> is in the project root and index.html has ' +
                '<code>&lt;script src="pos-review.js"&gt;&lt;/script&gt;</code> after pos.js.</div>';
        }
    }
}

/* ====================================
   ADMIN SUB-TABS (Locations / Assignments)
==================================== */

function showTab(tab) {
    posActiveTab = tab;
    document.querySelectorAll("[data-postab]").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.postab === tab);
    });
    const loc = document.getElementById("posTabLocations");
    const asg = document.getElementById("posTabAssignments");
    const dat = document.getElementById("posTabData");
    const acd = document.getElementById("posTabAcademic");
    const tgt = document.getElementById("posTabTargets");
    const als = document.getElementById("posTabAliases");
    if (loc) loc.style.display = tab === "locations" ? "" : "none";
    if (asg) asg.style.display = tab === "assignments" ? "" : "none";
    if (dat) dat.style.display = tab === "data" ? "" : "none";
    if (acd) acd.style.display = tab === "academic" ? "" : "none";
    if (tgt) tgt.style.display = tab === "targets" ? "" : "none";
    if (als) als.style.display = tab === "aliases" ? "" : "none";
    if (tab === "academic") initAcademicTab();
    if (tab === "targets") initTargetsTab();
    if (tab === "aliases") initAliasTab();
    if (tab === "data") { initDataTab(); initErTab(); initKekaTab(); initScTab(); initNimbleTab(); initVaTab(); }
}

/* ====================================
   LOAD
==================================== */

async function loadAll() {
    setMeta("posLocMeta", "Loading…");
    setMeta("posAssignMeta", "Loading…");
    try {
        const [statesRes, districtsRes, blocksRes, assignRes] = await Promise.all([
            posSupabase.from("states").select("*").order("name"),
            posSupabase.from("districts").select("*").order("name"),
            posSupabase.from("blocks").select("*").order("name"),
            posSupabase.from("assignments").select("*").order("name")
        ]);
        if (statesRes.error) throw statesRes.error;
        if (districtsRes.error) throw districtsRes.error;
        if (blocksRes.error) throw blocksRes.error;
        if (assignRes.error) throw assignRes.error;

        posData.states      = statesRes.data || [];
        posData.districts   = districtsRes.data || [];
        posData.blocks      = blocksRes.data || [];
        posData.assignments = assignRes.data || [];
        posData.loaded = true;

        renderBlocksTable();
        renderAssignmentsTable();
    } catch (err) {
        console.error("Org Admin load failed:", err);
        setMeta("posLocMeta", "Failed to load.");
        setMeta("posAssignMeta", "Failed to load.");
        window.notify(friendlyDbError(err), "error");
    }
}

function setMeta(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

/* ====================================
   LOOKUPS
==================================== */

function stateName(id) {
    const s = posData.states.find(x => x.id === id);
    return s ? s.name : "—";
}

function districtsInState(stateId) {
    return posData.districts.filter(d => d.state_id === stateId);
}

/* ====================================
   RENDER: LOCATIONS (blocks, joined up to district + state)
==================================== */

function renderBlocksTable() {
    const tbody = document.getElementById("posBlocksTbody");
    if (!tbody) return;

    if (posData.blocks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state">
            <div class="empty-icon">🗺️</div>No blocks yet. Add a state, then a district, then a block.
        </td></tr>`;
    } else {
        tbody.innerHTML = posData.blocks.map(b => {
            const d = posData.districts.find(x => x.id === b.district_id);
            const sName = d ? stateName(d.state_id) : "—";
            const dName = d ? d.name : "—";
            return `<tr>
                <td>${escHtml(sName)}</td>
                <td>${escHtml(dName)}</td>
                <td>${escHtml(b.name)}</td>
                <td class="pos-col-actions">
                    <button class="pos-icon-btn edit" title="Edit" onclick="window.POSAdmin.openEditBlockModal(${b.id})">✏️</button>
                    <button class="pos-icon-btn delete" title="Delete" onclick="window.POSAdmin.deleteBlock(${b.id})">🗑️</button>
                </td>
            </tr>`;
        }).join("");
    }

    setMeta("posLocMeta",
        `${posData.states.length} state${posData.states.length === 1 ? "" : "s"} · ` +
        `${posData.districts.length} district${posData.districts.length === 1 ? "" : "s"} · ` +
        `${posData.blocks.length} block${posData.blocks.length === 1 ? "" : "s"}`);
}

/* ====================================
   RENDER: ASSIGNMENTS
   Trimmed to Name / Emp ID / Role / Status / Actions - districts and
   blocks are only shown inside the Edit modal, not in this list.
==================================== */

function renderAssignmentsTable() {
    const tbody = document.getElementById("posAssignTbody");
    if (!tbody) return;

    if (posData.assignments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">
            <div class="empty-icon">👤</div>No assignments yet.
        </td></tr>`;
    } else {
        tbody.innerHTML = posData.assignments.map(a => {
            const statusBadge = a.status === "resigned"
                ? `<span class="badge-dept" style="background:#fef2f2;color:#ef4444;">Resigned</span>`
                : `<span class="badge-dept">Active</span>`;
            return `<tr>
                <td>${escHtml(a.name)}</td>
                <td>${escHtml(a.emp_id)}</td>
                <td>${escHtml(a.designation)}</td>
                <td>${statusBadge}</td>
                <td class="pos-col-actions">
                    <button class="pos-icon-btn edit" title="Edit" onclick="window.POSAdmin.openAssignmentModal(${a.id})">✏️</button>
                    ${a.status !== "resigned" ? `<button class="pos-icon-btn delete" title="Mark Resigned" onclick="window.POSAdmin.markResigned(${a.id})">🗑️</button>` : ""}
                </td>
            </tr>`;
        }).join("");
    }

    const activeCount = posData.assignments.filter(a => a.status !== "resigned").length;
    setMeta("posAssignMeta", `${activeCount} active assignment${activeCount === 1 ? "" : "s"}`);
}

/* ====================================
   MODAL: ADD STATE
==================================== */

function openStateModal() {
    document.getElementById("posStateName").value = "";
    document.getElementById("posStateModal").classList.add("open");
}

function closeStateModal() {
    document.getElementById("posStateModal").classList.remove("open");
}

async function saveState() {
    const name = document.getElementById("posStateName").value.trim();
    if (!name) { window.notify("State name is required.", "warning"); return; }

    const { error } = await posSupabase.from("states").insert({ name });
    if (error) { window.notify(friendlyDbError(error), "error"); return; }

    window.notify("State added.", "success");
    closeStateModal();
    await loadAll();
}

/* ====================================
   MODAL: ADD DISTRICT
==================================== */

function openDistrictModal() {
    const sel = document.getElementById("posDistrictState");
    sel.innerHTML = posData.states.map(s =>
        `<option value="${s.id}">${escHtml(s.name)}</option>`).join("");
    document.getElementById("posDistrictName").value = "";
    document.getElementById("posDistrictModal").classList.add("open");
}

function closeDistrictModal() {
    document.getElementById("posDistrictModal").classList.remove("open");
}

async function saveDistrict() {
    const stateId = Number(document.getElementById("posDistrictState").value);
    const name = document.getElementById("posDistrictName").value.trim();
    if (!stateId) { window.notify("Pick a state first - add one if the list is empty.", "warning"); return; }
    if (!name) { window.notify("District name is required.", "warning"); return; }

    const { error } = await posSupabase.from("districts").insert({ name, state_id: stateId });
    if (error) { window.notify(friendlyDbError(error), "error"); return; }

    window.notify("District added.", "success");
    closeDistrictModal();
    await loadAll();
}

/* ====================================
   MODAL: ADD / EDIT BLOCK
==================================== */

function openBlockModal() {
    posEditingBlockId = null;
    document.getElementById("posBlockModalTitle").textContent = "Add Block";

    const stateSel = document.getElementById("posBlockState");
    stateSel.innerHTML = posData.states.map(s =>
        `<option value="${s.id}">${escHtml(s.name)}</option>`).join("");
    document.getElementById("posBlockName").value = "";
    refreshBlockDistrictOptions();
    document.getElementById("posBlockModal").classList.add("open");
}

function openEditBlockModal(blockId) {
    const block = posData.blocks.find(b => b.id === blockId);
    if (!block) return;
    const district = posData.districts.find(d => d.id === block.district_id);
    if (!district) return;

    posEditingBlockId = blockId;
    document.getElementById("posBlockModalTitle").textContent = "Edit Block";

    const stateSel = document.getElementById("posBlockState");
    stateSel.innerHTML = posData.states.map(s =>
        `<option value="${s.id}">${escHtml(s.name)}</option>`).join("");
    stateSel.value = String(district.state_id);
    refreshBlockDistrictOptions();
    document.getElementById("posBlockDistrict").value = String(district.id);
    document.getElementById("posBlockName").value = block.name;

    document.getElementById("posBlockModal").classList.add("open");
}

function refreshBlockDistrictOptions() {
    const stateId = Number(document.getElementById("posBlockState").value);
    const districtSel = document.getElementById("posBlockDistrict");
    const opts = districtsInState(stateId);
    districtSel.innerHTML = opts.map(d =>
        `<option value="${d.id}">${escHtml(d.name)}</option>`).join("");
}

function closeBlockModal() {
    document.getElementById("posBlockModal").classList.remove("open");
    posEditingBlockId = null;
}

async function saveBlock() {
    const districtId = Number(document.getElementById("posBlockDistrict").value);
    const name = document.getElementById("posBlockName").value.trim();
    if (!districtId) { window.notify("Pick a state and district first - add one if the lists are empty.", "warning"); return; }
    if (!name) { window.notify("Block name is required.", "warning"); return; }

    // Friendly pre-check before hitting the DB's unique constraint
    // (excluding the row being edited, if any).
    const dup = posData.blocks.some(b =>
        b.district_id === districtId &&
        b.name.toLowerCase() === name.toLowerCase() &&
        b.id !== posEditingBlockId);
    if (dup) {
        window.notify(`"${name}" already exists in this district - pick a different name, or edit that one instead.`, "warning");
        return;
    }

    if (posEditingBlockId) {
        const { error } = await posSupabase.from("blocks")
            .update({ name, district_id: districtId })
            .eq("id", posEditingBlockId);
        if (error) { window.notify(friendlyDbError(error), "error"); return; }
        window.notify("Block updated.", "success");
    } else {
        const { error } = await posSupabase.from("blocks").insert({ name, district_id: districtId });
        if (error) { window.notify(friendlyDbError(error), "error"); return; }
        window.notify("Block added.", "success");
    }

    closeBlockModal();
    await loadAll();
}

/* ====================================
   DELETE LOCATION ROWS
==================================== */

async function deleteBlock(id) {
    const block = posData.blocks.find(b => b.id === id);
    if (!block) return;
    const district = posData.districts.find(d => d.id === block.district_id);

    // Check if this is the last block in its district, and if that
    // district is the last in its state — warn the admin upfront.
    const siblingsInDistrict = posData.blocks.filter(b => b.district_id === block.district_id);
    const isLastBlock = siblingsInDistrict.length === 1;
    let isLastDistrict = false;
    if (isLastBlock && district) {
        const siblingsInState = posData.districts.filter(d => d.state_id === district.state_id);
        isLastDistrict = siblingsInState.length === 1;
    }

    let message = "This cannot be undone.";
    if (isLastBlock && isLastDistrict && district) {
        message = `This is the only block in "${district.name}", which is the only district in "${stateName(district.state_id)}". ` +
                  `Deleting it will also remove that district and state.`;
    } else if (isLastBlock && district) {
        message = `This is the only block in "${district.name}". Deleting it will also remove that district.`;
    }

    const ok = await window.showAppConfirm({
        title: "Delete block?",
        message,
        type: "error", confirmText: "Delete", cancelText: "Cancel"
    });
    if (!ok) return;

    // 1. Delete the block
    const { error } = await posSupabase.from("blocks").delete().eq("id", id);
    if (error) { window.notify(friendlyDbError(error), "error"); return; }

    // 2. If that was the last block in its district, delete the district
    if (isLastBlock && district) {
        const { error: dErr } = await posSupabase.from("districts").delete().eq("id", district.id);
        if (dErr) { console.warn("District cleanup failed:", dErr); }

        // 3. If that was the last district in its state, delete the state
        if (isLastDistrict) {
            const { error: sErr } = await posSupabase.from("states").delete().eq("id", district.state_id);
            if (sErr) { console.warn("State cleanup failed:", sErr); }
        }
    }

    window.notify("Block deleted.", "success");
    await loadAll();
}

/* ====================================
   MODAL: ADD / EDIT ASSIGNMENT
==================================== */

// Survives the whole time the modal is open; re-render calls below read
// and write these rather than any DOM <select> state, so a district you
// un-check and re-check remembers which of its blocks were picked.
let posModalDistricts = new Set();
let posModalBlocks = new Set();

/* ------------------------------------
   EMPLOYEE PICKER
   Employees live in Firestore and are owned by the Employees page;
   assignments live in Supabase. app.js exposes the directory as
   window.olfStaffDirectory(). Picking from it is the ONLY way to set
   emp_id / name / email, so what we store always matches what sign-in
   looks the person up by - a typo here used to mean a PO whose targets
   never resolve to their assignment.

   It behaves as a typeahead, not a browsable list: nothing shows until
   you type, and only the few best matches ever appear. Scrolling 166
   people to find one is how you pick the wrong Akash.
------------------------------------ */

const EMP_MIN_CHARS  = 2;   // below this the menu stays shut
const EMP_MAX_RESULTS = 3;  // only ever offer the best few

let posStaff = [];           // [{ id, name, email, dept, designation }]
let posStaffError = "";      // non-empty => show this instead of the list
let posPickedEmp = null;     // the directory row chosen in this modal session
let posEmpMatches = [];      // what the menu is currently showing
let posEmpActive = -1;       // highlighted row in posEmpMatches, for ↑ ↓ Enter

async function loadStaffDirectory() {
    if (posStaff.length) return;
    try {
        posStaff = await window.olfStaffDirectory();
        posStaffError = posStaff.length ? "" : "No employees found in the directory.";
    } catch (err) {
        console.error("Employee directory load failed:", err);
        posStaff = [];
        posStaffError = "Couldn't load the Employees directory. Check your connection, then close and reopen this window.";
    }
}

// emp_id (upper-cased) -> the name already holding that assignment.
// Matches how the Dashboard compares IDs, so the two never disagree.
function assignedEmpIds() {
    const taken = {};
    posData.assignments.forEach(a => {
        const k = String(a.emp_id || "").trim().toUpperCase();
        if (k) taken[k] = a.name || a.emp_id;
    });
    return taken;
}

/* Rank matches so the obvious answer is row 1 and Enter alone is usually
   right: a name that starts with what you typed beats one that merely
   contains it, "yog" beats a stray hit inside an email address. */
function empMatches(q) {
    const needle = q.trim().toLowerCase();
    if (needle.length < EMP_MIN_CHARS) return [];

    const scored = [];
    posStaff.forEach(e => {
        const name = String(e.name || "").toLowerCase();
        const id   = String(e.id || "").toLowerCase();
        const mail = String(e.email || "").toLowerCase();

        let score = -1;
        if (name.startsWith(needle)) score = 0;                                       // "yoge" -> Yogesh
        else if (name.split(/\s+/).some(w => w.startsWith(needle))) score = 1;        // "jag"  -> Yogesh V Jagtap
        else if (id.startsWith(needle)) score = 2;
        else if (mail.startsWith(needle)) score = 3;
        else if (name.includes(needle)) score = 4;
        else if (id.includes(needle) || mail.includes(needle)) score = 5;
        if (score < 0) return;

        scored.push({ e, score });
    });

    scored.sort((a, b) => a.score - b.score || String(a.e.name).localeCompare(String(b.e.name)));
    return scored.slice(0, EMP_MAX_RESULTS).map(s => s.e);
}

function closeEmpMenu() {
    posEmpMatches = [];
    posEmpActive = -1;
    const menu = document.getElementById("posAssignEmpList");
    if (menu) { menu.hidden = true; menu.innerHTML = ""; }
}

function renderEmpMenu() {
    const menu = document.getElementById("posAssignEmpList");
    if (!menu) return;

    if (!posEmpMatches.length) { menu.hidden = true; menu.innerHTML = ""; return; }

    const taken = assignedEmpIds();
    menu.innerHTML = posEmpMatches.map((e, i) => {
        const heldBy = taken[e.id.toUpperCase()];
        return `<div class="pos-emp-row${i === posEmpActive ? " is-active" : ""}${heldBy ? " is-taken" : ""}"
                     onmousedown="event.preventDefault(); window.POSAdmin.onEmpPicked(${i})">
            <span class="pos-emp-name">${escHtml(e.name || "(no name on record)")}</span>
            <span class="pos-emp-meta">${escHtml(e.id)}${e.email ? " · " + escHtml(e.email) : " · no email"}</span>
            ${heldBy ? `<span class="pos-emp-taken">already assigned</span>` : ""}
        </div>`;
    }).join("");
    menu.hidden = false;
}

function setEmpHint(text) {
    const hint = document.getElementById("posAssignEmpCount");
    if (hint) hint.textContent = text;
}

function onEmpSearch(value) {
    // Typing after a pick clears it - otherwise you could select Yogesh Ubale,
    // edit the box to read "Jagtap", and still save Ubale.
    if (posPickedEmp) {
        posPickedEmp = null;
        document.getElementById("posAssignEmpId").value = "";
        document.getElementById("posAssignName").value = "";
        document.getElementById("posAssignEmail").value = "";
    }

    if (posStaffError) { closeEmpMenu(); setEmpHint(posStaffError); return; }

    const q = String(value || "");
    if (q.trim().length < EMP_MIN_CHARS) {
        closeEmpMenu();
        setEmpHint(`Type at least ${EMP_MIN_CHARS} letters of a name, ID or email.`);
        return;
    }

    posEmpMatches = empMatches(q);
    posEmpActive = posEmpMatches.length ? 0 : -1;   // first hit pre-armed for Enter
    renderEmpMenu();
    setEmpHint(posEmpMatches.length
        ? "↑ ↓ to move, Enter to select."
        : "No employee matches that. Check the Employees page.");
}

// ↑ ↓ move, Enter selects, Esc closes. Enter is swallowed while the menu is
// open so it can never reach the modal and fire a save.
function onEmpKey(ev) {
    if (!posEmpMatches.length) return;

    if (ev.key === "ArrowDown") {
        ev.preventDefault();
        posEmpActive = Math.min(posEmpActive + 1, posEmpMatches.length - 1);
        renderEmpMenu();
    } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        posEmpActive = Math.max(posEmpActive - 1, 0);
        renderEmpMenu();
    } else if (ev.key === "Enter") {
        ev.preventDefault();
        if (posEmpActive >= 0) onEmpPicked(posEmpActive);
    } else if (ev.key === "Escape") {
        ev.preventDefault();
        closeEmpMenu();
        setEmpHint("");
    }
}

function onEmpBlur() {
    // Let a mousedown on a row land first; that handler closes the menu itself.
    setTimeout(() => { if (!posPickedEmp) closeEmpMenu(); }, 120);
}

function onEmpPicked(idx) {
    const e = posEmpMatches[idx];
    if (!e) return;

    posPickedEmp = e;
    document.getElementById("posAssignEmpId").value = e.id;
    document.getElementById("posAssignName").value  = e.name;
    document.getElementById("posAssignEmail").value = e.email;

    const search = document.getElementById("posAssignEmpSearch");
    if (search) search.value = e.name;

    closeEmpMenu();

    const heldBy = assignedEmpIds()[e.id.toUpperCase()];
    setEmpHint(heldBy
        ? `${e.name} already has an assignment — edit that row instead.`
        : `Selected ${e.name} · ${e.id}`);
}

async function openAssignmentModal(editId = null) {
    posEditingAssignmentId = editId;

    const title = document.getElementById("posAssignModalTitle");
    const existing = editId ? posData.assignments.find(a => a.id === editId) : null;
    const pickWrap = document.getElementById("posAssignPickWrap");
    const search = document.getElementById("posAssignEmpSearch");

    posPickedEmp = null;
    if (search) search.value = "";
    closeEmpMenu();
    setEmpHint("");

    if (existing) {
        title.textContent = "Edit Assignment";
        // emp_id is the stable key - hide the picker entirely so identity can't
        // drift on an edit. Change who covers what, never who the row IS.
        if (pickWrap) pickWrap.style.display = "none";
        document.getElementById("posAssignEmpId").value = existing.emp_id;
        document.getElementById("posAssignName").value = existing.name;
        document.getElementById("posAssignEmail").value = existing.email || "";
        document.getElementById("posAssignDesignation").value = existing.designation;
        posModalDistricts = new Set(existing.assigned_districts || []);
        posModalBlocks = new Set(existing.assigned_blocks || []);
    } else {
        title.textContent = "Add Assignment";
        if (pickWrap) pickWrap.style.display = "";
        document.getElementById("posAssignEmpId").value = "";
        document.getElementById("posAssignName").value = "";
        document.getElementById("posAssignEmail").value = "";
        document.getElementById("posAssignDesignation").value = "PO";
        posModalDistricts = new Set();
        posModalBlocks = new Set();
    }

    renderDistrictChecklist();
    refreshAssignModalUI();
    document.getElementById("posAssignModal").classList.add("open");

    // Only an add needs the directory. Fetched after the modal is up so the
    // Firestore round-trip never delays it, and focus lands in the search box.
    if (!existing) {
        setEmpHint("Loading employees…");
        await loadStaffDirectory();
        setEmpHint(posStaffError || `Type at least ${EMP_MIN_CHARS} letters of a name, ID or email.`);
        if (search) search.focus();
    }
}

function renderDistrictChecklist(filterText) {
    const box = document.getElementById("posAssignDistrictsBox");
    if (posData.districts.length === 0) {
        box.innerHTML = `<div class="pos-checklist-empty">No districts yet - add one in the Locations tab first.</div>`;
        updateCount("posDistrictCount", 0, 0); return;
    }
    const filter = (filterText || "").toLowerCase();
    const filtered = posData.districts.filter(d => !filter || d.name.toLowerCase().includes(filter));

    let html = `<div class="pos-checklist-search">
        <input type="text" placeholder="Search districts…" id="posDistrictSearch" value="${escHtml(filterText || "")}"
            oninput="window.POSAdmin.onDistrictSearch(this.value)">
    </div>`;
    if (filtered.length === 0) {
        html += `<div class="pos-checklist-empty">No match.</div>`;
    } else {
        html += filtered.map(d => {
            const checked = posModalDistricts.has(d.name);
            return `<label class="pos-checklist-row${checked ? " checked" : ""}">
                <input type="checkbox" class="pos-checklist-cb" value="${escHtml(d.name)}" ${checked ? "checked" : ""}
                    onchange="window.POSAdmin.onDistrictCheckToggle(this.value, this.checked)">
                <span class="pos-checklist-label">${escHtml(d.name)}</span>
            </label>`;
        }).join("");
    }
    box.innerHTML = html;
    updateCount("posDistrictCount", posModalDistricts.size, posData.districts.length);
    // Restore cursor position in search input
    const searchInput = document.getElementById("posDistrictSearch");
    if (searchInput && filterText != null) {
        searchInput.focus();
        searchInput.setSelectionRange(filterText.length, filterText.length);
    }
}

// Designation decides whether blocks are hand-picked (PO) or implied in
// full for every checked district (PM/DM/COO) - this toggles which UI
// shows and re-renders the block checklist to match.
function refreshAssignModalUI() {
    const designation = document.getElementById("posAssignDesignation").value;
    const isPO = designation === "PO";

    document.getElementById("posAssignBlocksWrap").style.display = isPO ? "" : "none";
    document.getElementById("posAssignBlocksAutoNote").style.display = isPO ? "none" : "";

    if (isPO) renderBlockChecklist();
}

function renderBlockChecklist(filterText) {
    const box = document.getElementById("posAssignBlocksBox");
    if (posModalDistricts.size === 0) {
        box.innerHTML = `<div class="pos-checklist-empty">Check a district above first — its blocks will appear here.</div>`;
        updateCount("posBlockCount", 0, 0); return;
    }
    const relevantBlocks = posData.blocks.filter(b => {
        const d = posData.districts.find(x => x.id === b.district_id);
        return d && posModalDistricts.has(d.name);
    });
    if (relevantBlocks.length === 0) {
        box.innerHTML = `<div class="pos-checklist-empty">No blocks exist yet for the checked district(s).</div>`;
        updateCount("posBlockCount", 0, 0); return;
    }
    const filter = (filterText || "").toLowerCase();
    const filtered = relevantBlocks.filter(b => !filter || b.name.toLowerCase().includes(filter));

    let html = `<div class="pos-checklist-search">
        <input type="text" placeholder="Search blocks…" id="posBlockSearch" value="${escHtml(filterText || "")}"
            oninput="window.POSAdmin.onBlockSearch(this.value)">
    </div>`;
    if (filtered.length === 0) {
        html += `<div class="pos-checklist-empty">No match.</div>`;
    } else {
        html += filtered.map(b => {
            const d = posData.districts.find(x => x.id === b.district_id);
            const dName = d ? d.name : "";
            const checked = posModalBlocks.has(b.name);
            return `<label class="pos-checklist-row${checked ? " checked" : ""}">
                <input type="checkbox" class="pos-checklist-cb" value="${escHtml(b.name)}" ${checked ? "checked" : ""}
                    onchange="window.POSAdmin.onBlockCheckToggle(this.value, this.checked)">
                <span class="pos-checklist-label">${escHtml(b.name)}<span style="color:#9ca3af;font-size:11.5px;margin-left:6px;">${escHtml(dName)}</span></span>
            </label>`;
        }).join("");
    }
    box.innerHTML = html;
    const checkedCount = relevantBlocks.filter(b => posModalBlocks.has(b.name)).length;
    updateCount("posBlockCount", checkedCount, relevantBlocks.length);
    const searchInput = document.getElementById("posBlockSearch");
    if (searchInput && filterText != null) {
        searchInput.focus();
        searchInput.setSelectionRange(filterText.length, filterText.length);
    }
}

function updateCount(elId, selected, total) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = total > 0 ? `${selected} of ${total} selected` : "";
}

function onDistrictSearch(val) { renderDistrictChecklist(val); }
function onBlockSearch(val) { renderBlockChecklist(val); }

function onDistrictCheckToggle(districtName, checked) {
    if (checked) posModalDistricts.add(districtName);
    else posModalDistricts.delete(districtName);
    // Re-render districts to update row highlight, preserving search text
    const dSearch = document.getElementById("posDistrictSearch");
    renderDistrictChecklist(dSearch ? dSearch.value : "");
    // Blocks from a district that just got unchecked drop out of view in
    // renderBlockChecklist() below, but stay remembered in posModalBlocks
    // in case the same district gets re-checked later in this same modal
    // session - only pruned for real at save time (see blocksForDistrictNames).
    if (document.getElementById("posAssignDesignation").value === "PO") renderBlockChecklist();
}

function onBlockCheckToggle(blockName, checked) {
    if (checked) posModalBlocks.add(blockName);
    else posModalBlocks.delete(blockName);
    const bSearch = document.getElementById("posBlockSearch");
    renderBlockChecklist(bSearch ? bSearch.value : "");
}

// Every block belonging to any of these district names - used to
// auto-fill assigned_blocks for PM/DM/COO, who cover a district wholesale.
function blocksForDistrictNames(districtNames) {
    const nameSet = new Set(districtNames);
    return posData.blocks
        .filter(b => {
            const d = posData.districts.find(x => x.id === b.district_id);
            return d && nameSet.has(d.name);
        })
        .map(b => b.name)
        .sort();
}

function closeAssignmentModal() {
    document.getElementById("posAssignModal").classList.remove("open");
    posPickedEmp = null;
    closeEmpMenu();
}

async function saveAssignment() {
    const empId = document.getElementById("posAssignEmpId").value.trim();
    const name = document.getElementById("posAssignName").value.trim();
    const email = document.getElementById("posAssignEmail").value.trim();
    const designation = document.getElementById("posAssignDesignation").value;
    const assignedDistricts = [...posModalDistricts];
    // PO: exactly what was hand-checked, limited to blocks still inside a
    // checked district (guards against a stray block from a district the
    // admin unchecked earlier in this same modal session).
    // PM/DM/COO: every block in every checked district, computed fresh -
    // never hand-picked, per how those roles cover a district wholesale.
    const assignedBlocks = designation === "PO"
        ? [...posModalBlocks].filter(name => blocksForDistrictNames(assignedDistricts).includes(name))
        : blocksForDistrictNames(assignedDistricts);

    // On an add, identity must have come from the directory - these three
    // fields are read-only and only onEmpPicked() ever writes them.
    if (!posEditingAssignmentId) {
        if (!posPickedEmp) {
            window.notify("Pick an employee from the list - ID, name and email come from the Employees page.", "warning");
            return;
        }
        const dup = posData.assignments.find(
            a => String(a.emp_id || "").trim().toUpperCase() === posPickedEmp.id.toUpperCase()
        );
        if (dup) {
            window.notify(`${dup.name} (${dup.emp_id}) already has an assignment - edit that row instead of adding a second one.`, "warning");
            return;
        }
        if (!posPickedEmp.email) {
            window.notify(`${posPickedEmp.name} has no email in Employees. Add it there first - it's how Staff Connect matches them at login.`, "warning");
            return;
        }
    }

    if (!empId) { window.notify("Employee ID is required.", "warning"); return; }
    if (!name) { window.notify("Name is required.", "warning"); return; }
    if (!email) { window.notify("Email is required - it's how Staff Connect matches this person when they log in.", "warning"); return; }

    if (posEditingAssignmentId) {
        // Archive the pre-edit version first, so past weeks still resolve
        // against who was actually assigned then.
        const previous = posData.assignments.find(a => a.id === posEditingAssignmentId);
        if (previous) {
            const { error: histErr } = await posSupabase.from("assignments_history").insert({
                assignment_id: previous.id,
                emp_id: previous.emp_id,
                name: previous.name,
                email: previous.email,
                designation: previous.designation,
                assigned_districts: previous.assigned_districts,
                assigned_blocks: previous.assigned_blocks,
                effective_to: todayStr(),
                changed_by: currentAdminEmail(),
                change_reason: "edited"
            });
            if (histErr) { window.notify(friendlyDbError(histErr), "error"); return; }
        }

        const { error } = await posSupabase.from("assignments").update({
            name, email, designation,
            assigned_districts: assignedDistricts,
            assigned_blocks: assignedBlocks,
            updated_at: new Date().toISOString()
        }).eq("id", posEditingAssignmentId);
        if (error) { window.notify(friendlyDbError(error), "error"); return; }

        window.notify("Assignment updated.", "success");
    } else {
        const { error } = await posSupabase.from("assignments").insert({
            emp_id: empId, name, email, designation,
            assigned_districts: assignedDistricts,
            assigned_blocks: assignedBlocks,
            status: "active"
        });
        if (error) { window.notify(friendlyDbError(error), "error"); return; }

        window.notify("Assignment added.", "success");
    }

    closeAssignmentModal();
    await loadAll();
}

/* ====================================
   RESIGNATION
   One click: archive the full current row to assignments_history,
   then remove it from assignments (the "currently active" table).
   Whoever takes over those districts/blocks gets a brand-new
   assignment row via "Add Assignment" - this does not try to guess
   a replacement.
==================================== */

async function markResigned(id) {
    const row = posData.assignments.find(a => a.id === id);
    if (!row) return;

    const ok = await window.showAppConfirm({
        title: "Mark as resigned?",
        message: `This removes ${row.name} from active assignments and archives their record. ` +
                 `Districts/blocks they covered will show no active assignee until someone new is added. Continue?`,
        type: "warning", confirmText: "Mark Resigned", cancelText: "Cancel"
    });
    if (!ok) return;

    const { error: histErr } = await posSupabase.from("assignments_history").insert({
        assignment_id: row.id,
        emp_id: row.emp_id,
        name: row.name,
        email: row.email,
        designation: row.designation,
        assigned_districts: row.assigned_districts,
        assigned_blocks: row.assigned_blocks,
        effective_to: todayStr(),
        changed_by: currentAdminEmail(),
        change_reason: "resigned"
    });
    if (histErr) { window.notify(friendlyDbError(histErr), "error"); return; }

    const { error: delErr } = await posSupabase.from("assignments").delete().eq("id", id);
    if (delErr) { window.notify(friendlyDbError(delErr), "error"); return; }

    window.notify(`${row.name} marked resigned and archived.`, "success");
    await loadAll();
}

/* ====================================
   DATA TAB — VINOBA
==================================== */

// Column mapping: Excel header → DB column name.
// Order matters — this is the canonical column list used to generate
// the sample template and to map each Excel row during upload.
// Vinoba Block Status Report (Oct 2026 format, 29 columns — Excel header = table column)
const VINOBA_COLUMNS = [
    { excel: "state_name",                 db: "state_name" },
    { excel: "district_name",              db: "district_name" },
    { excel: "block_name",                 db: "block_name" },
    { excel: "total_teachers",             db: "total_teachers" },
    { excel: "total_schools",              db: "total_schools" },
    { excel: "unique_schools_posting",     db: "unique_schools_posting" },
    { excel: "unique_teachers_posting",    db: "unique_teachers_posting" },
    { excel: "total_posts",                db: "total_posts" },
    { excel: "creative_writing",           db: "creative_writing" },
    { excel: "storytelling",               db: "storytelling" },
    { excel: "poetry_recitation",          db: "poetry_recitation" },
    { excel: "spoken_english",             db: "spoken_english" },
    { excel: "total_lifeskills",           db: "total_lifeskills" },
    { excel: "morning_assembly",           db: "morning_assembly" },
    { excel: "spelling_bee",               db: "spelling_bee" },
    { excel: "total_other_posts",          db: "total_other_posts" },
    { excel: "streaks",                    db: "streaks" },
    { excel: "streak_creative_writing",    db: "streak_creative_writing" },
    { excel: "streak_storytelling",        db: "streak_storytelling" },
    { excel: "streak_poetry_recitation",   db: "streak_poetry_recitation" },
    { excel: "streak_spoken_english",      db: "streak_spoken_english" },
    { excel: "coupons_available",          db: "coupons_available" },
    { excel: "coupons_given",              db: "coupons_given" },
    { excel: "coupons_expired",            db: "coupons_expired" },
    { excel: "coupons_outstanding",        db: "coupons_outstanding" },
    { excel: "star_teachers",              db: "star_teachers" },
    { excel: "post_per_month_per_teacher", db: "post_per_month_per_teacher" },
    { excel: "block_pom_winners",          db: "block_pom_winners" },
    { excel: "district_pom_winners",       db: "district_pom_winners" },
];

let vinobaLogLoaded = false;

function initDataTab() {
    // Populate year dropdown (current year ± 1)
    const yearSel = document.getElementById("posVinobaYear");
    if (yearSel && yearSel.options.length === 0) {
        const now = new Date().getFullYear();
        for (let y = now - 1; y <= now + 1; y++) {
            const opt = document.createElement("option");
            opt.value = y; opt.textContent = y;
            if (y === now) opt.selected = true;
            yearSel.appendChild(opt);
        }
    }
    // Pre-select current month
    const monthSel = document.getElementById("posVinobaMonth");
    if (monthSel) monthSel.value = String(new Date().getMonth() + 1);

    if (!vinobaLogLoaded) loadVinobaLog();
}

async function loadVinobaLog() {
    const tbody = document.getElementById("posVinobaLogTbody");
    if (!tbody) return;
    try {
        const { data, error } = await posSupabase
            .from("vinoba_data")
            .select("year, month, week, uploaded_at")
            .order("year", { ascending: false })
            .order("month", { ascending: false })
            .order("week", { ascending: false });
        if (error) throw error;
        renderVinobaLog(summariseLog(data || []));
        vinobaLogLoaded = true;
    } catch (err) {
        tbody.innerHTML = `<div class="pos-last pos-last--empty">Failed to load log.</div>`;
        console.error("Vinoba log load failed:", err);
    }
}

// Group raw rows into {year, month, week, row_count, last_upload}
function summariseLog(rows) {
    const map = new Map();
    for (const r of rows) {
        const key = `${r.year}-${r.month}-${r.week}`;
        const entry = map.get(key) || { year: r.year, month: r.month, week: r.week, row_count: 0, last_upload: r.uploaded_at };
        entry.row_count++;
        if (r.uploaded_at > entry.last_upload) entry.last_upload = r.uploaded_at;
        map.set(key, entry);
    }
    return [...map.values()].sort((a, b) =>
        b.year - a.year || b.month - a.month || b.week - a.week);
}

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// week 0 = whole-month upload, stored separately from Week 1-5 rows
function weekLabel(w) {
    return Number(w) === 0 ? "All Month" : `Week ${w}`;
}

function renderVinobaLog(entries) {
    renderLastUpload("posVinobaLogTbody", entries, "deleteVinobaUpload");
}

/* ── Download sample template ── */

async function downloadVinobaTempl() {
    const XLSX = await loadXLSX();
    const headers = VINOBA_COLUMNS.map(c => c.excel);
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vinoba");
    XLSX.writeFile(wb, "vinoba_sample.xlsx");
}

// SheetJS lazy loader — mirrors the one in app.js
let _posXlsxReady = null;
function loadXLSX() {
    if (_posXlsxReady) return _posXlsxReady;
    _posXlsxReady = new Promise((resolve, reject) => {
        if (window.XLSX) { resolve(window.XLSX); return; }
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
        s.onload  = () => resolve(window.XLSX);
        s.onerror = () => reject(new Error("Failed to load SheetJS"));
        document.head.appendChild(s);
    });
    return _posXlsxReady;
}

/* ── Upload ── */

async function uploadVinoba() {
    const year  = Number(document.getElementById("posVinobaYear").value);
    const month = Number(document.getElementById("posVinobaMonth").value);
    const week  = Number(document.getElementById("posVinobaWeek").value);
    const fileInput = document.getElementById("posVinobaFile");
    const file = fileInput && fileInput.files[0];

    if (!file) { window.notify("Select a file first.", "warning"); return; }

    const btn = document.getElementById("posVinobaUploadBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Uploading…"; }

    try {
        // 1. Parse and validate the file FIRST — before touching the database.
        const XLSX = await loadXLSX();
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];

        // 1a. Header validation — reject files whose columns don't match
        const headerRow = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || [];
        const fileHeaders = headerRow.map(h => String(h || "").trim());
        const expectedHeaders = VINOBA_COLUMNS.map(c => c.excel);

        const missing = expectedHeaders.filter(h => !fileHeaders.includes(h));
        const extra = fileHeaders.filter(h => h && !expectedHeaders.includes(h));

        if (missing.length > 0 || extra.length > 0) {
            let msg = "This file's columns don't match the expected Vinoba format.\n\n";
            if (missing.length > 0) msg += "Missing: " + missing.join(", ") + "\n";
            if (extra.length > 0) msg += "Unexpected: " + extra.join(", ") + "\n";
            msg += "\nDownload the current sample to see the expected headers. If the table structure has changed, update it in the Supabase SQL editor first.";
            await window.showAppAlert({
                title: "Column mismatch",
                message: msg,
                type: "error",
                okText: "OK"
            });
            resetUploadBtn(); return;
        }

        const jsonRows = XLSX.utils.sheet_to_json(ws);

        if (jsonRows.length === 0) {
            window.notify("File is empty — no data rows found.", "warning");
            resetUploadBtn(); return;
        }

        // 2. File is valid — now check for existing data and ask about override.
        const { count, error: cntErr } = await posSupabase
            .from("vinoba_data")
            .select("id", { count: "exact", head: true })
            .eq("year", year).eq("month", month).eq("week", week);
        if (cntErr) throw cntErr;

        if (count > 0) {
            const ok = await window.showAppConfirm({
                title: "Data already exists",
                message: `${MONTH_NAMES[month]} ${year} ${weekLabel(week)} already has ${count} rows. Override with this file?`,
                type: "warning", confirmText: "Override", cancelText: "Cancel"
            });
            if (!ok) { resetUploadBtn(); return; }

        }

        // 3. Map Excel rows to DB rows
        const dbRows = jsonRows.map(row => {
            const mapped = { year, month, week };
            for (const col of VINOBA_COLUMNS) {
                const val = row[col.excel];
                mapped[col.db] = val !== undefined && val !== null && val !== "" ? val : null;
            }
            return mapped;
        });

        // 4. Insert in batches of 200
        await replacePeriodRows("vinoba_data", year, month, week, dbRows);

        window.notify(`${dbRows.length} rows uploaded for ${MONTH_NAMES[month]} ${year} ${weekLabel(week)}.`, "success");
        fileInput.value = ""; refreshFileLabel(fileInput);
        vinobaLogLoaded = false;
        loadVinobaLog();

    } catch (err) {
        console.error("Vinoba upload failed:", err);
        window.notify(friendlyDbError(err), "error");
    } finally {
        resetUploadBtn();
    }
}

function resetUploadBtn() {
    const btn = document.getElementById("posVinobaUploadBtn");
    if (btn) { btn.disabled = false; btn.textContent = "Upload"; }
}

/* ── Delete an upload ── */

async function deleteVinobaUpload(year, month, week) {
    const ok = await window.showAppConfirm({
        title: "Delete upload?",
        message: `Delete all Vinoba data for ${MONTH_NAMES[month]} ${year} ${weekLabel(week)}? This cannot be undone.`,
        type: "error", confirmText: "Delete", cancelText: "Cancel"
    });
    if (!ok) return;

    const { error } = await posSupabase
        .from("vinoba_data")
        .delete()
        .eq("year", year).eq("month", month).eq("week", week);
    if (error) { window.notify(friendlyDbError(error), "error"); return; }

    window.notify("Upload deleted.", "success");
    vinobaLogLoaded = false;
    loadVinobaLog();
}

/* ====================================
   DATA TAB — ER (Expense Report)
==================================== */

const ER_COLUMNS = [
    { excel: "Name",          db: "name" },
    { excel: "Employee ID",   db: "employee_id" },
    { excel: "Department",    db: "department" },
    { excel: "Status",        db: "status" },
    { excel: "Amount",        db: "amount" },
];

let erLogLoaded = false;

function initErTab() {
    const yearSel = document.getElementById("posErYear");
    if (yearSel && yearSel.options.length === 0) {
        const now = new Date().getFullYear();
        for (let y = now - 1; y <= now + 1; y++) {
            const opt = document.createElement("option");
            opt.value = y; opt.textContent = y;
            if (y === now) opt.selected = true;
            yearSel.appendChild(opt);
        }
    }
    const monthSel = document.getElementById("posErMonth");
    if (monthSel) monthSel.value = String(new Date().getMonth() + 1);

    if (!erLogLoaded) loadErLog();
}

async function loadErLog() {
    const tbody = document.getElementById("posErLogTbody");
    if (!tbody) return;
    try {
        const { data, error } = await posSupabase
            .from("er_data")
            .select("year, month, week, uploaded_at")
            .order("year", { ascending: false })
            .order("month", { ascending: false })
            .order("week", { ascending: false });
        if (error) throw error;
        renderErLog(summariseLog(data || []));
        erLogLoaded = true;
    } catch (err) {
        tbody.innerHTML = `<div class="pos-last pos-last--empty">Failed to load log.</div>`;
        console.error("ER log load failed:", err);
    }
}

function renderErLog(entries) {
    renderLastUpload("posErLogTbody", entries, "deleteErUpload");
}

async function downloadErTempl() {
    const XLSX = await loadXLSX();
    const headers = ER_COLUMNS.map(c => c.excel);
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ER");
    XLSX.writeFile(wb, "er_sample.xlsx");
}

async function uploadEr() {
    const year  = Number(document.getElementById("posErYear").value);
    const month = Number(document.getElementById("posErMonth").value);
    const week  = Number(document.getElementById("posErWeek").value);
    const fileInput = document.getElementById("posErFile");
    const file = fileInput && fileInput.files[0];

    if (!file) { window.notify("Select a file first.", "warning"); return; }

    const btn = document.getElementById("posErUploadBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Uploading…"; }

    try {
        // 1. Parse and validate first
        const XLSX = await loadXLSX();
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];

        const headerRow = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || [];
        const fileHeaders = headerRow.map(h => String(h || "").trim());
        const expectedHeaders = ER_COLUMNS.map(c => c.excel);

        const missing = expectedHeaders.filter(h => !fileHeaders.includes(h));
        const extra = fileHeaders.filter(h => h && !expectedHeaders.includes(h));

        if (missing.length > 0 || extra.length > 0) {
            let msg = "This file's columns don't match the expected ER format.\n\n";
            if (missing.length > 0) msg += "Missing: " + missing.join(", ") + "\n";
            if (extra.length > 0) msg += "Unexpected: " + extra.join(", ") + "\n";
            msg += "\nDownload the current sample to see the expected headers. If the table structure has changed, update it in the Supabase SQL editor first.";
            await window.showAppAlert({ title: "Column mismatch", message: msg, type: "error", okText: "OK" });
            resetErBtn(); return;
        }

        const jsonRows = XLSX.utils.sheet_to_json(ws);
        if (jsonRows.length === 0) {
            window.notify("File is empty — no data rows found.", "warning");
            resetErBtn(); return;
        }

        // 2. Check for existing data
        const { count, error: cntErr } = await posSupabase
            .from("er_data")
            .select("id", { count: "exact", head: true })
            .eq("year", year).eq("month", month).eq("week", week);
        if (cntErr) throw cntErr;

        if (count > 0) {
            const ok = await window.showAppConfirm({
                title: "Data already exists",
                message: `${MONTH_NAMES[month]} ${year} ${weekLabel(week)} already has ${count} ER rows. Override with this file?`,
                type: "warning", confirmText: "Override", cancelText: "Cancel"
            });
            if (!ok) { resetErBtn(); return; }

        }

        // 3. Map and insert
        const dbRows = jsonRows.map(row => {
            const mapped = { year, month, week };
            for (const col of ER_COLUMNS) {
                let val = row[col.excel];
                // Clean up stray newlines in names (seen in real data)
                if (typeof val === "string") val = val.trim();
                mapped[col.db] = val !== undefined && val !== null && val !== "" ? val : null;
            }
            return mapped;
        });

        await replacePeriodRows("er_data", year, month, week, dbRows);

        window.notify(`${dbRows.length} rows uploaded for ${MONTH_NAMES[month]} ${year} ${weekLabel(week)}.`, "success");
        fileInput.value = ""; refreshFileLabel(fileInput);
        erLogLoaded = false;
        loadErLog();

    } catch (err) {
        console.error("ER upload failed:", err);
        window.notify(friendlyDbError(err), "error");
    } finally {
        resetErBtn();
    }
}

function resetErBtn() {
    const btn = document.getElementById("posErUploadBtn");
    if (btn) { btn.disabled = false; btn.textContent = "Upload"; }
}

async function deleteErUpload(year, month, week) {
    const ok = await window.showAppConfirm({
        title: "Delete upload?",
        message: `Delete all ER data for ${MONTH_NAMES[month]} ${year} ${weekLabel(week)}? This cannot be undone.`,
        type: "error", confirmText: "Delete", cancelText: "Cancel"
    });
    if (!ok) return;

    const { error } = await posSupabase
        .from("er_data").delete()
        .eq("year", year).eq("month", month).eq("week", week);
    if (error) { window.notify(friendlyDbError(error), "error"); return; }

    window.notify("Upload deleted.", "success");
    erLogLoaded = false;
    loadErLog();
}

/* ====================================
   DATA TAB — KEKA (Attendance)
==================================== */

const KEKA_COLUMNS = [
    { excel: "Sr No.",              db: "sr_no" },
    { excel: "Employee ID's",       db: "employee_id" },
    { excel: "Employee Name",       db: "employee_name" },
    { excel: "Job Title",           db: "job_title" },
    { excel: "DEPT",                db: "dept" },
    { excel: "Location",            db: "location" },
    { excel: "Total Working Days",  db: "total_working_days" },
    { excel: "Present Days",        db: "present_days" },
    { excel: "Absent Days",         db: "absent_days" },
    { excel: "Leaves",              db: "leaves" },
    { excel: "Reguralized",         db: "regularized" },
    { excel: "Late Arrival Days",   db: "late_arrival_days" },
    { excel: "Missing Swipe Days",  db: "missing_swipe_days" },
];

let kekaLogLoaded = false;

function initKekaTab() {
    const yearSel = document.getElementById("posKekaYear");
    if (yearSel && yearSel.options.length === 0) {
        const now = new Date().getFullYear();
        for (let y = now - 1; y <= now + 1; y++) {
            const opt = document.createElement("option");
            opt.value = y; opt.textContent = y;
            if (y === now) opt.selected = true;
            yearSel.appendChild(opt);
        }
    }
    const monthSel = document.getElementById("posKekaMonth");
    if (monthSel) monthSel.value = String(new Date().getMonth() + 1);

    if (!kekaLogLoaded) loadKekaLog();
}

async function loadKekaLog() {
    const tbody = document.getElementById("posKekaLogTbody");
    if (!tbody) return;
    try {
        const { data, error } = await posSupabase
            .from("keka_data")
            .select("year, month, week, uploaded_at")
            .order("year", { ascending: false })
            .order("month", { ascending: false })
            .order("week", { ascending: false });
        if (error) throw error;
        renderKekaLog(summariseLog(data || []));
        kekaLogLoaded = true;
    } catch (err) {
        tbody.innerHTML = `<div class="pos-last pos-last--empty">Failed to load log.</div>`;
        console.error("Keka log load failed:", err);
    }
}

function renderKekaLog(entries) {
    renderLastUpload("posKekaLogTbody", entries, "deleteKekaUpload");
}

async function downloadKekaTempl() {
    const XLSX = await loadXLSX();
    const headers = KEKA_COLUMNS.map(c => c.excel);
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Keka");
    XLSX.writeFile(wb, "keka_sample.xlsx");
}

async function uploadKeka() {
    const year  = Number(document.getElementById("posKekaYear").value);
    const month = Number(document.getElementById("posKekaMonth").value);
    const week  = Number(document.getElementById("posKekaWeek").value);
    const fileInput = document.getElementById("posKekaFile");
    const file = fileInput && fileInput.files[0];

    if (!file) { window.notify("Select a file first.", "warning"); return; }

    const btn = document.getElementById("posKekaUploadBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Uploading…"; }

    try {
        // 1. Parse and validate first
        const XLSX = await loadXLSX();
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];

        const headerRow = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || [];
        const fileHeaders = headerRow.map(h => String(h || "").trim()).filter(h => h);
        const expectedHeaders = KEKA_COLUMNS.map(c => c.excel);

        const missing = expectedHeaders.filter(h => !fileHeaders.includes(h));
        const extra = fileHeaders.filter(h => !expectedHeaders.includes(h));

        if (missing.length > 0 || extra.length > 0) {
            let msg = "This file's columns don't match the expected Keka format.\n\n";
            if (missing.length > 0) msg += "Missing: " + missing.join(", ") + "\n";
            if (extra.length > 0) msg += "Unexpected: " + extra.join(", ") + "\n";
            msg += "\nDownload the current sample to see the expected headers. If the table structure has changed, update it in the Supabase SQL editor first.";
            await window.showAppAlert({ title: "Column mismatch", message: msg, type: "error", okText: "OK" });
            resetKekaBtn(); return;
        }

        const jsonRows = XLSX.utils.sheet_to_json(ws);
        // Filter out empty padding rows (Keka files often have 1000 rows but only ~143 with data)
        const validRows = jsonRows.filter(r => r["Employee ID's"]);

        if (validRows.length === 0) {
            window.notify("File is empty — no data rows found.", "warning");
            resetKekaBtn(); return;
        }

        // 2. Check for existing data
        const { count, error: cntErr } = await posSupabase
            .from("keka_data")
            .select("id", { count: "exact", head: true })
            .eq("year", year).eq("month", month).eq("week", week);
        if (cntErr) throw cntErr;

        if (count > 0) {
            const ok = await window.showAppConfirm({
                title: "Data already exists",
                message: `${MONTH_NAMES[month]} ${year} ${weekLabel(week)} already has ${count} Keka rows. Override with this file?`,
                type: "warning", confirmText: "Override", cancelText: "Cancel"
            });
            if (!ok) { resetKekaBtn(); return; }

        }

        // 3. Map and insert
        const dbRows = validRows.map(row => {
            const mapped = { year, month, week };
            for (const col of KEKA_COLUMNS) {
                let val = row[col.excel];
                if (typeof val === "string") val = val.trim();
                mapped[col.db] = val !== undefined && val !== null && val !== "" ? val : null;
            }
            return mapped;
        });

        await replacePeriodRows("keka_data", year, month, week, dbRows);

        window.notify(`${dbRows.length} rows uploaded for ${MONTH_NAMES[month]} ${year} ${weekLabel(week)}.`, "success");
        fileInput.value = ""; refreshFileLabel(fileInput);
        kekaLogLoaded = false;
        loadKekaLog();

    } catch (err) {
        console.error("Keka upload failed:", err);
        window.notify(friendlyDbError(err), "error");
    } finally {
        resetKekaBtn();
    }
}

function resetKekaBtn() {
    const btn = document.getElementById("posKekaUploadBtn");
    if (btn) { btn.disabled = false; btn.textContent = "Upload"; }
}

async function deleteKekaUpload(year, month, week) {
    const ok = await window.showAppConfirm({
        title: "Delete upload?",
        message: `Delete all Keka data for ${MONTH_NAMES[month]} ${year} ${weekLabel(week)}? This cannot be undone.`,
        type: "error", confirmText: "Delete", cancelText: "Cancel"
    });
    if (!ok) return;

    const { error } = await posSupabase
        .from("keka_data").delete()
        .eq("year", year).eq("month", month).eq("week", week);
    if (error) { window.notify(friendlyDbError(error), "error"); return; }

    window.notify("Upload deleted.", "success");
    kekaLogLoaded = false;
    loadKekaLog();
}

/* ====================================
   DATA TAB — STAFF CONNECT (Events)
==================================== */

const SC_COLUMNS = [
    { excel: "State",                                    db: "state" },
    { excel: "District",                                 db: "district" },
    { excel: "Block",                                    db: "block" },
    { excel: "Month",                                    db: "event_month" },
    { excel: "Total  Block Events",                      db: "total_block_events" },
    { excel: "Total District Events",                    db: "total_district_events" },
    { excel: "Teachers Felicitated (Block Level)",       db: "teachers_felicitated_block_level" },
    { excel: "Teachers Felicitated (District Level)",    db: "teachers_felicitated_district_level" },
    { excel: "SU/NS Events",                             db: "su_ns_events" },
    { excel: "Teachers Felicitated (SU/NS Events)",      db: "teachers_felicitated_su_ns_events" },
    { excel: "Other Events",                             db: "other_events" },
    { excel: "Teachers Felicitated (Other Events)",      db: "teachers_felicitated_other_events" },
    { excel: "Total Cluster Heads Recognised",           db: "cluster_heads_recognised" },   // added Oct 2026
];

let scLogLoaded = false;

function initScTab() {
    const yearSel = document.getElementById("posScYear");
    if (yearSel && yearSel.options.length === 0) {
        const now = new Date().getFullYear();
        for (let y = now - 1; y <= now + 1; y++) {
            const opt = document.createElement("option");
            opt.value = y; opt.textContent = y;
            if (y === now) opt.selected = true;
            yearSel.appendChild(opt);
        }
    }
    const monthSel = document.getElementById("posScMonth");
    if (monthSel) monthSel.value = String(new Date().getMonth() + 1);
    if (!scLogLoaded) loadScLog();
}

async function loadScLog() {
    const tbody = document.getElementById("posScLogTbody");
    if (!tbody) return;
    try {
        const { data, error } = await posSupabase
            .from("staffconnect_data")
            .select("year, month, week, uploaded_at")
            .order("year", { ascending: false })
            .order("month", { ascending: false })
            .order("week", { ascending: false });
        if (error) throw error;
        renderScLog(summariseLog(data || []));
        scLogLoaded = true;
    } catch (err) {
        tbody.innerHTML = `<div class="pos-last pos-last--empty">Failed to load log.</div>`;
    }
}

function renderScLog(entries) {
    renderLastUpload("posScLogTbody", entries, "deleteScUpload");
}

async function downloadScTempl() {
    const XLSX = await loadXLSX();
    const ws = XLSX.utils.aoa_to_sheet([SC_COLUMNS.map(c => c.excel)]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "StaffConnect");
    XLSX.writeFile(wb, "staffconnect_sample.xlsx");
}

async function uploadSc() {
    const year  = Number(document.getElementById("posScYear").value);
    const month = Number(document.getElementById("posScMonth").value);
    const week  = Number(document.getElementById("posScWeek").value);
    const fileInput = document.getElementById("posScFile");
    const file = fileInput && fileInput.files[0];
    if (!file) { window.notify("Select a file first.", "warning"); return; }

    const btn = document.getElementById("posScUploadBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Uploading…"; }

    try {
        const XLSX = await loadXLSX();
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];

        // Header validation
        const headerRow = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || [];
        const fileHeaders = headerRow.map(h => String(h || "").trim()).filter(h => h);
        const expectedHeaders = SC_COLUMNS.map(c => c.excel);
        const missing = expectedHeaders.filter(h => !fileHeaders.includes(h));
        const extra = fileHeaders.filter(h => !expectedHeaders.includes(h));

        if (missing.length > 0 || extra.length > 0) {
            let msg = "This file's columns don't match the expected Staff Connect format.\n\n";
            if (missing.length > 0) msg += "Missing: " + missing.join(", ") + "\n";
            if (extra.length > 0) msg += "Unexpected: " + extra.join(", ") + "\n";
            msg += "\nDownload the current sample to see the expected headers.";
            await window.showAppAlert({ title: "Column mismatch", message: msg, type: "error", okText: "OK" });
            resetScBtn(); return;
        }

        const jsonRows = XLSX.utils.sheet_to_json(ws);
        const validRows = jsonRows.filter(r => r["State"] || r["District"] || r["Block"]);
        if (validRows.length === 0) {
            window.notify("File is empty — no data rows found.", "warning");
            resetScBtn(); return;
        }

        // Duplicate check
        const { count, error: cntErr } = await posSupabase
            .from("staffconnect_data")
            .select("id", { count: "exact", head: true })
            .eq("year", year).eq("month", month).eq("week", week);
        if (cntErr) throw cntErr;

        if (count > 0) {
            const ok = await window.showAppConfirm({
                title: "Data already exists",
                message: `${MONTH_NAMES[month]} ${year} ${weekLabel(week)} already has ${count} Staff Connect rows. Override?`,
                type: "warning", confirmText: "Override", cancelText: "Cancel"
            });
            if (!ok) { resetScBtn(); return; }
        }

        // Map and insert
        const dbRows = validRows.map(row => {
            const mapped = { year, month, week };
            for (const col of SC_COLUMNS) {
                let val = row[col.excel];
                if (typeof val === "string") val = val.trim();
                // The event report leaves a count cell blank when it is 0: store 0 for counts (text columns stay null),
                // so a blank in a newer column is never confused with "column not in this upload".
                const isText = ["state", "district", "block", "event_month"].includes(col.db);
                mapped[col.db] = val !== undefined && val !== null && val !== "" ? val : (isText ? null : 0);
            }
            return mapped;
        });

        await replacePeriodRows("staffconnect_data", year, month, week, dbRows);

        window.notify(`${dbRows.length} rows uploaded for ${MONTH_NAMES[month]} ${year} ${weekLabel(week)}.`, "success");
        fileInput.value = ""; refreshFileLabel(fileInput);
        scLogLoaded = false;
        loadScLog();
    } catch (err) {
        console.error("Staff Connect upload failed:", err);
        window.notify(friendlyDbError(err), "error");
    } finally {
        resetScBtn();
    }
}

function resetScBtn() {
    const btn = document.getElementById("posScUploadBtn");
    if (btn) { btn.disabled = false; btn.textContent = "Upload"; }
}

async function deleteScUpload(year, month, week) {
    const ok = await window.showAppConfirm({
        title: "Delete upload?",
        message: `Delete all Staff Connect data for ${MONTH_NAMES[month]} ${year} ${weekLabel(week)}?`,
        type: "error", confirmText: "Delete", cancelText: "Cancel"
    });
    if (!ok) return;
    const { error } = await posSupabase.from("staffconnect_data").delete()
        .eq("year", year).eq("month", month).eq("week", week);
    if (error) { window.notify(friendlyDbError(error), "error"); return; }
    window.notify("Upload deleted.", "success");
    scLogLoaded = false;
    loadScLog();
}

/* ====================================
   NAME ALIAS MAPPING (shared by Nimble + V&A)
   ─────────────────────────────────────────────
   On upload, names from the file are checked against `name_aliases`.
   Unmatched ones open a modal where the admin picks the correct
   employee from a searchable dropdown. Once saved, the mapping is
   permanent and reused automatically on every future upload.
==================================== */

let aliasCache = null; // { nimble: {name→emp_id}, visitandactivity: {name→emp_id} }
let pendingAliasResolve = null; // Promise resolve from the modal flow

async function loadAliases() {
    if (aliasCache) return aliasCache;
    const { data, error } = await posSupabase.from("name_aliases").select("*");
    if (error) throw error;
    const map = {};
    for (const row of (data || [])) {
        if (!map[row.source]) map[row.source] = {};
        map[row.source][row.source_name] = row.emp_id;
    }
    aliasCache = map;
    return aliasCache;
}

function invalidateAliasCache() { aliasCache = null; }

/* Name normalisation used for SUGGESTIONS only - never for storage. */
function aliasTokens(s) {
    return String(s || "").toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
}
function aliasSquash(s) { return String(s || "").toLowerCase().replace(/[^a-z]/g, ""); }

/* Suggest an assignment for a source name, but ONLY on strong evidence.
   A single shared token is deliberately NOT enough: "Abhishek Kumar" and
   "Abhishek Bansal" share exactly one, and guessing between those two is
   what put HO tickets onto a PO's review in the first place. */
function suggestAssignment(sourceName) {
    const st = aliasTokens(sourceName), sq = aliasSquash(sourceName);
    if (!st.length) return null;
    const live = posData.assignments.filter(a => a.status !== "resigned");

    for (const a of live) {                                   // exact, ignoring case/punctuation
        if (aliasTokens(a.name).join(" ") === st.join(" ")) return a;
    }
    for (const a of live) {
        const at = aliasTokens(a.name);
        const smaller = st.length <= at.length ? st : at;
        const bigger  = st.length <= at.length ? at : st;
        // every word of the shorter name appears in the longer one, and the
        // shorter is at least two words: "Raghunath Wankhade" vs
        // "Raghunath R Wankhade" passes, one shared first name does not
        if (smaller.length >= 2 && smaller.every(t => bigger.includes(t))) return a;
        if (st.filter(t => at.includes(t)).length >= 2) return a;
    }
    for (const a of live) {                                   // run-together logins: "Sachinkhobragade Olf"
        const asq = aliasSquash(a.name);
        if (asq.length >= 8 && (sq.includes(asq) || asq.includes(sq))) return a;
    }
    return null;
}

// Returns a map {source_name → emp_id} for all names in `names`,
// opening the modal for any that are unmapped. Returns null if the
// admin cancels. `counts` is {name → rows in this file}, shown in the
// modal so a name with 7 rows gets more attention than one with 1.
async function resolveNames(source, names, counts) {
    const aliases = await loadAliases();
    const sourceMap = aliases[source] || {};

    const unmatched = [];
    const resolved = {};
    for (const n of names) {
        if (sourceMap[n]) {
            resolved[n] = sourceMap[n];
        } else {
            unmatched.push(n);
        }
    }

    if (unmatched.length === 0) return resolved;

    // Open modal for unmatched names — returns the new mappings or null
    const newMappings = await openAliasModal(source, unmatched, counts || {});
    if (!newMappings) return null; // cancelled

    // upsert, not insert: (source, source_name) is unique, so re-mapping a
    // name CORRECTS the existing row instead of stacking a second one that
    // loadAliases() would then pick between arbitrarily.
    const inserts = Object.entries(newMappings)
        .filter(([, empId]) => empId && empId !== "__skip__")
        .map(([name, empId]) => ({ source, source_name: name, emp_id: empId }));

    if (inserts.length > 0) {
        const { error } = await posSupabase.from("name_aliases")
            .upsert(inserts, { onConflict: "source,source_name" });
        if (error) { window.notify(friendlyDbError(error), "error"); return null; }
        invalidateAliasCache();
    }

    // Merge into resolved
    for (const [name, empId] of Object.entries(newMappings)) {
        if (empId && empId !== "__skip__") resolved[name] = empId;
        else resolved[name] = null; // skipped
    }

    return resolved;
}

function aliasEmpOptions() {
    return posData.assignments
        .filter(a => a.status !== "resigned")
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(a => `<option value="${escHtml(a.emp_id)}">${escHtml(a.name)} (${escHtml(a.emp_id)})</option>`)
        .join("");
}

function openAliasModal(source, unmatchedNames, counts) {
    return new Promise(resolve => {
        pendingAliasResolve = resolve;
        document.getElementById("posAliasModalTitle").textContent =
            `${unmatchedNames.length} name${unmatchedNames.length === 1 ? "" : "s"} in this file (${source})`;

        const empOptions = aliasEmpOptions();
        // Busiest names first - a name with 7 rows is worth more care than one with 1.
        const ordered = unmatchedNames.slice().sort(
            (a, b) => (counts[b] || 0) - (counts[a] || 0) || a.localeCompare(b)
        );

        document.getElementById("posAliasRows").innerHTML = ordered.map((name, i) => {
            const n = counts[name] || 0;
            const hit = suggestAssignment(name);
            // Default is SKIP, never a neighbouring name. Only a confident
            // match is pre-selected, and it says so.
            return `<div class="pos-al-row${hit ? " has-sug" : ""}">
                <div class="pos-al-name">
                    ${escHtml(name)}
                    ${n ? `<span class="pos-al-n">${n} row${n === 1 ? "" : "s"}</span>` : ""}
                    ${hit ? `<span class="pos-al-sug">suggested: ${escHtml(hit.name)}</span>` : ""}
                </div>
                <select class="pos-al-sel" id="posAlias_${i}" data-srcname="${escHtml(name)}"
                        onchange="window.POSAdmin.onAliasPick()">
                    <option value="__skip__"${hit ? "" : " selected"}>Skip — not a field person</option>
                    ${empOptions}
                </select>
            </div>`;
        }).join("");

        // Apply the suggestions after the markup exists, so the <select>
        // value is set by value rather than by hand-written `selected`.
        ordered.forEach((name, i) => {
            const hit = suggestAssignment(name);
            if (hit) {
                const sel = document.getElementById("posAlias_" + i);
                if (sel) sel.value = hit.emp_id;
            }
        });

        onAliasPick();
        document.getElementById("posAliasModal").classList.add("open");
    });
}

// Live tally so you can see what you're about to commit before saving.
function onAliasPick() {
    const rows = document.querySelectorAll("#posAliasRows select");
    let mapped = 0, skipped = 0;
    rows.forEach(sel => { if (sel.value === "__skip__") skipped++; else mapped++; });
    const el = document.getElementById("posAliasTally");
    if (el) el.textContent = `${mapped} mapped · ${skipped} skipped`;
}

function aliasSkipAll() {
    document.querySelectorAll("#posAliasRows select").forEach(sel => { sel.value = "__skip__"; });
    onAliasPick();
}

function cancelAliasModal() {
    document.getElementById("posAliasModal").classList.remove("open");
    if (pendingAliasResolve) { pendingAliasResolve(null); pendingAliasResolve = null; }
}

async function saveAliases() {
    const rows = document.querySelectorAll("#posAliasRows select");
    const mappings = {};
    rows.forEach(sel => { mappings[sel.dataset.srcname] = sel.value || "__skip__"; });

    // Two source names landing on one person has TWO opposite meanings:
    //   legitimate - the file spells one human several ways
    //                ("Somnath Swami" / "Somnath R Swami (interim charge)")
    //   a mistake  - two different humans picked off an alphabetical list
    //                ("Abhishek Kumar" and "Abhishek Bansal")
    // Only a person can tell those apart, so ask rather than refuse.
    const byEmp = {};
    Object.entries(mappings).forEach(([name, emp]) => {
        if (emp === "__skip__") return;
        (byEmp[emp] = byEmp[emp] || []).push(name);
    });
    const clashes = Object.entries(byEmp).filter(([, names]) => names.length > 1);

    if (clashes.length) {
        const byId = {};
        posData.assignments.forEach(a => { byId[String(a.emp_id || "").trim().toUpperCase()] = a.name; });
        const detail = clashes.map(([emp, names]) =>
            `${byId[String(emp).trim().toUpperCase()] || emp} (${emp})\n    ${names.join("\n    ")}`
        ).join("\n\n");

        const ok = await window.showAppConfirm({
            title: "Same person picked more than once",
            message: "These employees are mapped from more than one name:\n\n" + detail
                + "\n\nThat's correct if a name is just spelled differently in the file. "
                + "It's a mistake if these are different people. Continue?",
            type: "warning", confirmText: "Yes, same person", cancelText: "Let me fix it"
        });
        if (!ok) return;
    }

    document.getElementById("posAliasModal").classList.remove("open");
    if (pendingAliasResolve) { pendingAliasResolve(mappings); pendingAliasResolve = null; }
}

/* ====================================
   ADMIN TAB — NAME ALIASES
   Every saved mapping, visible and correctable. Without this the only
   way to find a wrong alias is a manual SQL query against the table.
==================================== */

let aliasRows = [];
let aliasTabLoaded = false;

async function initAliasTab() {
    if (aliasTabLoaded) return;
    aliasTabLoaded = true;
    await loadAliasRows();
}

async function loadAliasRows() {
    setMeta("posAliasMeta", "Loading…");
    const { data, error } = await posSupabase.from("name_aliases").select("*").range(0, 4999);
    if (error) { window.notify(friendlyDbError(error), "error"); setMeta("posAliasMeta", "Failed to load."); return; }
    aliasRows = data || [];
    renderAliasTable();
}

function renderAliasTable() {
    const tbody = document.getElementById("posAliasTbody");
    if (!tbody) return;

    const q = (document.getElementById("posAliasSearch")?.value || "").trim().toLowerCase();
    const src = document.getElementById("posAliasSource")?.value || "";
    const rows = aliasRows.filter(r =>
        (!src || r.source === src) &&
        (!q || [r.source_name, r.emp_id, r.source].some(v => String(v || "").toLowerCase().includes(q)))
    );

    // Flag every emp_id claimed by more than one source name within a source.
    const dupe = {};
    aliasRows.forEach(r => {
        const k = r.source + "|" + r.emp_id;
        (dupe[k] = dupe[k] || []).push(r.source_name);
    });

    const byId = {};
    posData.assignments.forEach(a => { byId[String(a.emp_id || "").trim().toUpperCase()] = a.name; });

    const bad = Object.values(dupe).filter(v => v.length > 1).length;
    setMeta("posAliasMeta", `${aliasRows.length} mapping${aliasRows.length === 1 ? "" : "s"}`
        + (bad ? ` · ${bad} employee${bad === 1 ? "" : "s"} mapped from more than one name `
               + "— fine when it's one person spelled several ways, wrong when they're different people" : ""));

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><div class="empty-icon">\u{1F517}</div>`
            + (aliasRows.length ? "No mapping matches." : "No name mappings saved yet.") + "</td></tr>";
        return;
    }

    tbody.innerHTML = rows.sort((a, b) =>
        a.source.localeCompare(b.source) || a.source_name.localeCompare(b.source_name)
    ).map(r => {
        const shared = (dupe[r.source + "|" + r.emp_id] || []).filter(n => n !== r.source_name);
        const who = byId[String(r.emp_id || "").trim().toUpperCase()];
        return `<tr${shared.length ? ' style="background:#fffdf5;"' : ""}>
            <td>${escHtml(r.source)}</td>
            <td>${escHtml(r.source_name)}</td>
            <td>${escHtml(r.emp_id)}${who ? ` <span style="color:#9ca3af;">${escHtml(who)}</span>` : ` <span style="color:#b45309;">not in assignments</span>`}</td>
            <td>${shared.length ? `<span style="color:#b45309;font-size:11.5px;">also mapped from: ${escHtml(shared.join(", "))}</span>` : ""}</td>
            <td class="pos-col-actions">
                <button class="pos-icon-btn edit" title="Re-map" onclick="window.POSAdmin.editAlias('${escHtml(String(r.id))}')">✏️</button>
                <button class="pos-icon-btn delete" title="Delete" onclick="window.POSAdmin.deleteAlias('${escHtml(String(r.id))}')">\u{1F5D1}️</button>
            </td>
        </tr>`;
    }).join("");
}

// id is handled as a string throughout: the table's primary key may be a
// bigint or a uuid, and String() comparison is correct either way.
async function editAlias(id) {
    const r = aliasRows.find(x => String(x.id) === String(id));
    if (!r) return;
    document.getElementById("posAliasEditName").textContent = `"${r.source_name}" (${r.source})`;
    document.getElementById("posAliasEditSel").innerHTML =
        `<option value="__skip__">Skip — not a field person</option>` + aliasEmpOptions();
    document.getElementById("posAliasEditSel").value = r.emp_id;
    document.getElementById("posAliasEditSel").dataset.aliasId = String(id);
    document.getElementById("posAliasEditModal").classList.add("open");
}

function closeAliasEdit() { document.getElementById("posAliasEditModal").classList.remove("open"); }

async function saveAliasEdit() {
    const sel = document.getElementById("posAliasEditSel");
    const id = sel.dataset.aliasId;
    const val = sel.value;
    // "Skip" means this name maps to nobody, which is a deletion, not an update.
    const res = val === "__skip__"
        ? await posSupabase.from("name_aliases").delete().eq("id", id)
        : await posSupabase.from("name_aliases").update({ emp_id: val }).eq("id", id);
    if (res.error) { window.notify(friendlyDbError(res.error), "error"); return; }
    closeAliasEdit();
    invalidateAliasCache();
    window.notify("Mapping updated. Re-upload that period to apply it to existing rows.", "success");
    await loadAliasRows();
}

async function deleteAlias(id) {
    const r = aliasRows.find(x => String(x.id) === String(id));
    if (!r) return;
    const ok = await window.showAppConfirm({
        title: "Delete this mapping?",
        message: `"${r.source_name}" will be asked about again on the next ${r.source} upload. `
               + `Rows already uploaded keep the emp_id they were given - re-upload that period to change them.`,
        type: "warning", confirmText: "Delete", cancelText: "Cancel"
    });
    if (!ok) return;
    const { error } = await posSupabase.from("name_aliases").delete().eq("id", id);
    if (error) { window.notify(friendlyDbError(error), "error"); return; }
    invalidateAliasCache();
    window.notify("Mapping deleted.", "success");
    await loadAliasRows();
}

/* ====================================
   DATA TAB — NIMBLE (Tickets)
==================================== */

const NIMBLE_COLUMNS = [
    { excel: "ID",            db: "ticket_id" },
    { excel: "!Date Closed",  db: "date_closed" },
    { excel: "Created By",    db: "created_by" },
    { excel: "Date Created",  db: "date_created" },
    { excel: "Board Column",  db: "board_column" },
];
const NIMBLE_NAME_COL = "Created By";

let nimbleLogLoaded = false;

function initNimbleTab() {
    const yearSel = document.getElementById("posNimbleYear");
    if (yearSel && yearSel.options.length === 0) {
        const now = new Date().getFullYear();
        for (let y = now - 1; y <= now + 1; y++) {
            const opt = document.createElement("option");
            opt.value = y; opt.textContent = y;
            if (y === now) opt.selected = true;
            yearSel.appendChild(opt);
        }
    }
    const monthSel = document.getElementById("posNimbleMonth");
    if (monthSel) monthSel.value = String(new Date().getMonth() + 1);
    if (!nimbleLogLoaded) loadNimbleLog();
}

async function loadNimbleLog() {
    const tbody = document.getElementById("posNimbleLogTbody");
    if (!tbody) return;
    try {
        const { data, error } = await posSupabase.from("nimble_data")
            .select("year, month, week, uploaded_at")
            .order("year", { ascending: false }).order("month", { ascending: false }).order("week", { ascending: false });
        if (error) throw error;
        renderGenericLog("posNimbleLogTbody", data || [], "Nimble", "deleteNimbleUpload");
        nimbleLogLoaded = true;
    } catch (err) { if (tbody) tbody.innerHTML = `<div class="pos-last pos-last--empty">Failed to load.</div>`; }
}

async function downloadNimbleTempl() {
    const XLSX = await loadXLSX();
    const ws = XLSX.utils.aoa_to_sheet([NIMBLE_COLUMNS.map(c => c.excel)]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Nimble");
    XLSX.writeFile(wb, "nimble_sample.xlsx");
}

async function uploadNimble() {
    const year  = Number(document.getElementById("posNimbleYear").value);
    const month = Number(document.getElementById("posNimbleMonth").value);
    const week  = Number(document.getElementById("posNimbleWeek").value);
    const fileInput = document.getElementById("posNimbleFile");
    const file = fileInput && fileInput.files[0];
    if (!file) { window.notify("Select a file first.", "warning"); return; }

    const btn = document.getElementById("posNimbleUploadBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Uploading…"; }

    try {
        const XLSX = await loadXLSX();
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];

        // Header validation
        const headerRow = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || [];
        const fileHeaders = headerRow.map(h => String(h || "").trim()).filter(h => h);
        const expectedHeaders = NIMBLE_COLUMNS.map(c => c.excel);
        const missing = expectedHeaders.filter(h => !fileHeaders.includes(h));
        const extra = fileHeaders.filter(h => !expectedHeaders.includes(h));
        if (missing.length > 0 || extra.length > 0) {
            let msg = "Columns don't match the expected Nimble format.\n\n";
            if (missing.length > 0) msg += "Missing: " + missing.join(", ") + "\n";
            if (extra.length > 0) msg += "Unexpected: " + extra.join(", ") + "\n";
            msg += "\nDownload the sample to see the expected headers.";
            await window.showAppAlert({ title: "Column mismatch", message: msg, type: "error" });
            resetNimbleBtn(); return;
        }

        const jsonRows = XLSX.utils.sheet_to_json(ws, { raw: false });
        const validRows = jsonRows.filter(r => r[NIMBLE_NAME_COL]);
        if (validRows.length === 0) { window.notify("File is empty.", "warning"); resetNimbleBtn(); return; }

        // Alias resolution
        const uniqueNames = [...new Set(validRows.map(r => String(r[NIMBLE_NAME_COL]).trim()))];
        const nameCounts = {};
        validRows.forEach(r => {
            const n = String(r[NIMBLE_NAME_COL]).trim();
            nameCounts[n] = (nameCounts[n] || 0) + 1;
        });
        const nameMap = await resolveNames("nimble", uniqueNames, nameCounts);
        if (!nameMap) { resetNimbleBtn(); return; } // cancelled

        // Duplicate check
        const { count, error: cntErr } = await posSupabase.from("nimble_data")
            .select("id", { count: "exact", head: true }).eq("year", year).eq("month", month).eq("week", week);
        if (cntErr) throw cntErr;
        if (count > 0) {
            const ok = await window.showAppConfirm({
                title: "Data already exists",
                message: `${MONTH_NAMES[month]} ${year} ${weekLabel(week)} already has ${count} Nimble rows. Override?`,
                type: "warning", confirmText: "Override", cancelText: "Cancel"
            });
            if (!ok) { resetNimbleBtn(); return; }
        }

        // Map and insert
        const dbRows = validRows.map(row => {
            const mapped = { year, month, week };
            for (const col of NIMBLE_COLUMNS) {
                let val = row[col.excel];
                if (typeof val === "string") val = val.trim();
                mapped[col.db] = val !== undefined && val !== null && val !== "" ? val : null;
            }
            const srcName = String(row[NIMBLE_NAME_COL]).trim();
            mapped.emp_id = nameMap[srcName] || null;
            return mapped;
        });

        await replacePeriodRows("nimble_data", year, month, week, dbRows);

        window.notify(`${dbRows.length} rows uploaded for ${MONTH_NAMES[month]} ${year} ${weekLabel(week)}.`, "success");
        fileInput.value = ""; refreshFileLabel(fileInput);
        nimbleLogLoaded = false; loadNimbleLog();
    } catch (err) {
        console.error("Nimble upload failed:", err);
        window.notify(friendlyDbError(err), "error");
    } finally { resetNimbleBtn(); }
}

function resetNimbleBtn() {
    const btn = document.getElementById("posNimbleUploadBtn");
    if (btn) { btn.disabled = false; btn.textContent = "Upload"; }
}

async function deleteNimbleUpload(year, month, week) {
    const ok = await window.showAppConfirm({
        title: "Delete upload?", message: `Delete all Nimble data for ${MONTH_NAMES[month]} ${year} ${weekLabel(week)}?`,
        type: "error", confirmText: "Delete", cancelText: "Cancel"
    });
    if (!ok) return;
    const { error } = await posSupabase.from("nimble_data").delete().eq("year", year).eq("month", month).eq("week", week);
    if (error) { window.notify(friendlyDbError(error), "error"); return; }
    window.notify("Deleted.", "success"); nimbleLogLoaded = false; loadNimbleLog();
}

/* ====================================
   DATA TAB — VISIT & ACTIVITY
==================================== */

const VA_COLUMNS = [
    { excel: "District",                                    db: "district" },
    { excel: "PO Name",                                     db: "po_name" },
    { excel: "Form Filled Activity",                        db: "form_filled_activity" },
    { excel: "Program Dashbboard Updated \"Yes\" Count",    db: "program_dashboard_updated_yes" },
    { excel: "Kathavli \"Yes\" Count",                      db: "kathavli_yes" },
    { excel: "Form Filled Visit",                           db: "form_filled_visit" },
    { excel: "District Visit",                              db: "district_visit" },
    { excel: "Block Visits",                                db: "block_visits" },
    { excel: "Cluster Visits",                              db: "cluster_visits" },
    { excel: "School Visits",                               db: "school_visits" },
];
const VA_NAME_COL = "PO Name";

let vaLogLoaded = false;

function initVaTab() {
    const yearSel = document.getElementById("posVaYear");
    if (yearSel && yearSel.options.length === 0) {
        const now = new Date().getFullYear();
        for (let y = now - 1; y <= now + 1; y++) {
            const opt = document.createElement("option");
            opt.value = y; opt.textContent = y;
            if (y === now) opt.selected = true;
            yearSel.appendChild(opt);
        }
    }
    const monthSel = document.getElementById("posVaMonth");
    if (monthSel) monthSel.value = String(new Date().getMonth() + 1);
    if (!vaLogLoaded) loadVaLog();
}

async function loadVaLog() {
    const tbody = document.getElementById("posVaLogTbody");
    if (!tbody) return;
    try {
        const { data, error } = await posSupabase.from("visitandactivity_data")
            .select("year, month, week, uploaded_at")
            .order("year", { ascending: false }).order("month", { ascending: false }).order("week", { ascending: false });
        if (error) throw error;
        renderGenericLog("posVaLogTbody", data || [], "V&A", "deleteVaUpload");
        vaLogLoaded = true;
    } catch (err) { if (tbody) tbody.innerHTML = `<div class="pos-last pos-last--empty">Failed to load.</div>`; }
}

async function downloadVaTempl() {
    const XLSX = await loadXLSX();
    const ws = XLSX.utils.aoa_to_sheet([VA_COLUMNS.map(c => c.excel)]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "VisitActivity");
    XLSX.writeFile(wb, "visitandactivity_sample.xlsx");
}

async function uploadVa() {
    const year  = Number(document.getElementById("posVaYear").value);
    const month = Number(document.getElementById("posVaMonth").value);
    const week  = Number(document.getElementById("posVaWeek").value);
    const fileInput = document.getElementById("posVaFile");
    const file = fileInput && fileInput.files[0];
    if (!file) { window.notify("Select a file first.", "warning"); return; }

    const btn = document.getElementById("posVaUploadBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Uploading…"; }

    try {
        const XLSX = await loadXLSX();
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];

        // Header validation
        const headerRow = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || [];
        const fileHeaders = headerRow.map(h => String(h || "").trim()).filter(h => h);
        const expectedHeaders = VA_COLUMNS.map(c => c.excel);
        const missing = expectedHeaders.filter(h => !fileHeaders.includes(h));
        const extra = fileHeaders.filter(h => !expectedHeaders.includes(h));
        if (missing.length > 0 || extra.length > 0) {
            let msg = "Columns don't match the expected Visit & Activity format.\n\n";
            if (missing.length > 0) msg += "Missing: " + missing.join(", ") + "\n";
            if (extra.length > 0) msg += "Unexpected: " + extra.join(", ") + "\n";
            msg += "\nDownload the sample to see the expected headers.";
            await window.showAppAlert({ title: "Column mismatch", message: msg, type: "error" });
            resetVaBtn(); return;
        }

        const jsonRows = XLSX.utils.sheet_to_json(ws);
        const validRows = jsonRows.filter(r => r[VA_NAME_COL]);
        if (validRows.length === 0) { window.notify("File is empty.", "warning"); resetVaBtn(); return; }

        // Alias resolution
        const uniqueNames = [...new Set(validRows.map(r => String(r[VA_NAME_COL]).trim()))];
        const nameCounts = {};
        validRows.forEach(r => {
            const n = String(r[VA_NAME_COL]).trim();
            nameCounts[n] = (nameCounts[n] || 0) + 1;
        });
        const nameMap = await resolveNames("visitandactivity", uniqueNames, nameCounts);
        if (!nameMap) { resetVaBtn(); return; }

        // Duplicate check
        const { count, error: cntErr } = await posSupabase.from("visitandactivity_data")
            .select("id", { count: "exact", head: true }).eq("year", year).eq("month", month).eq("week", week);
        if (cntErr) throw cntErr;
        if (count > 0) {
            const ok = await window.showAppConfirm({
                title: "Data already exists",
                message: `${MONTH_NAMES[month]} ${year} ${weekLabel(week)} already has ${count} V&A rows. Override?`,
                type: "warning", confirmText: "Override", cancelText: "Cancel"
            });
            if (!ok) { resetVaBtn(); return; }
        }

        // Map and insert
        const dbRows = validRows.map(row => {
            const mapped = { year, month, week };
            for (const col of VA_COLUMNS) {
                let val = row[col.excel];
                if (typeof val === "string") val = val.trim();
                mapped[col.db] = val !== undefined && val !== null && val !== "" ? val : null;
            }
            const srcName = String(row[VA_NAME_COL]).trim();
            mapped.emp_id = nameMap[srcName] || null;
            return mapped;
        });

        await replacePeriodRows("visitandactivity_data", year, month, week, dbRows);

        window.notify(`${dbRows.length} rows uploaded for ${MONTH_NAMES[month]} ${year} ${weekLabel(week)}.`, "success");
        fileInput.value = ""; refreshFileLabel(fileInput);
        vaLogLoaded = false; loadVaLog();
    } catch (err) {
        console.error("V&A upload failed:", err);
        window.notify(friendlyDbError(err), "error");
    } finally { resetVaBtn(); }
}

function resetVaBtn() {
    const btn = document.getElementById("posVaUploadBtn");
    if (btn) { btn.disabled = false; btn.textContent = "Upload"; }
}

async function deleteVaUpload(year, month, week) {
    const ok = await window.showAppConfirm({
        title: "Delete upload?", message: `Delete all V&A data for ${MONTH_NAMES[month]} ${year} ${weekLabel(week)}?`,
        type: "error", confirmText: "Delete", cancelText: "Cancel"
    });
    if (!ok) return;
    const { error } = await posSupabase.from("visitandactivity_data").delete().eq("year", year).eq("month", month).eq("week", week);
    if (error) { window.notify(friendlyDbError(error), "error"); return; }
    window.notify("Deleted.", "success"); vaLogLoaded = false; loadVaLog();
}

/* ====================================
   SHARED: generic upload-log renderer
   (used by Nimble, V&A — avoids copy-pasting the same log table code)
==================================== */

function renderGenericLog(tbodyId, rawData, sourceName, deleteFnName) {
    renderLastUpload(tbodyId, summariseLog(rawData), deleteFnName);
}

/* ====================================
   ACADEMIC PLAN (academic_targets)
   One row per exam / test cycle, same seven columns as the Excel:
   PO ID | PO Name | District | Program Name | Test Cycle | Preferred Month | Fixed Date
   plus plan_month (YYYYMM): the month the exam counts in on the Monthly tab.
   Fixed Date decides the month; Preferred Month is the fallback.
==================================== */

const ACAD_COLUMNS = [
    { excel: "PO ID",           db: "po_id" },
    { excel: "PO Name",         db: "po_name" },
    { excel: "District",        db: "district" },
    { excel: "Program Name",    db: "program_name" },
    { excel: "Test Cycle",      db: "test_cycle" },
    { excel: "Preferred Month", db: "preferred_month" },
    { excel: "Fixed Date",      db: "fixed_date" },
];
const ACAD_MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

let acadRows = [];
let acadLoaded = false;
let acadEditingId = null;

// "2026-09-21", "26-Sep-2026", "26 Sep 2026" -> "2026-09-21"; anything else -> null
function acadParseDate(v) {
    const s = String(v == null ? "" : v).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return acadIso(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[-\s/]([A-Za-z]{3,9})[-\s/,]+(\d{4})$/);
    if (m && ACAD_MON[m[2].slice(0, 3).toLowerCase()]) return acadIso(+m[3], ACAD_MON[m[2].slice(0, 3).toLowerCase()], +m[1]);
    return null;
}
function acadIso(y, mo, d) {
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function acadMonthNum(v) {               // "Sep" / "Sept" / "september" -> 9; numbers, "—", "Target" -> null
    const s = String(v == null ? "" : v).trim().toLowerCase();
    return /^[a-z]{3,9}$/.test(s) ? (ACAD_MON[s.slice(0, 3)] || null) : null;
}
// Academic year runs Jun–May. Its start year is taken from the dates themselves.
function acadInferAyStart(rows) {
    const c = {};
    rows.forEach(r => {
        if (!r.fixed_date) return;
        const y = +r.fixed_date.slice(0, 4), mo = +r.fixed_date.slice(5, 7);
        const ay = mo >= 6 ? y : y - 1; c[ay] = (c[ay] || 0) + 1;
    });
    const best = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
    if (best) return +best;
    const now = new Date(); return now.getMonth() + 1 >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}
// The one rule for which month an exam counts in (used by upload AND edit).
function acadPlanMonth(fixedDate, preferredMonth, ayStart) {
    if (fixedDate) return fixedDate.slice(0, 4) + fixedDate.slice(5, 7);
    const mo = acadMonthNum(preferredMonth);
    if (!mo) return null;
    return String(mo >= 6 ? ayStart : ayStart + 1) + String(mo).padStart(2, "0");
}
function acadMonthLabel(pm) { return pm ? MONTH_NAMES[+pm.slice(4)] + " " + pm.slice(0, 4) : ""; }

function initAcademicTab() { if (!acadLoaded) loadAcademic(); }

async function loadAcademic() {
    setMeta("posAcadMeta", "Loading…");
    try {
        let out = [], from = 0;
        for (;;) {                       // more than 1,000 rows -> page through
            const { data, error } = await posSupabase.from("academic_targets").select("*")
                .order("po_name").order("program_name").order("id").range(from, from + 999);
            if (error) throw error;
            out = out.concat(data || []);
            if (!data || data.length < 1000) break;
            from += 1000;
        }
        acadRows = out; acadLoaded = true;
        fillAcadMonthFilter(); renderAcademicTable();
    } catch (err) {
        console.error("Academic plan load failed:", err);
        setMeta("posAcadMeta", "Failed to load.");
        window.notify(friendlyDbError(err), "error");
    }
}

function fillAcadMonthFilter() {
    const sel = document.getElementById("posAcadFilter"); if (!sel) return;
    const keep = sel.value;
    const months = [...new Set(acadRows.map(r => r.plan_month).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">All rows</option><option value="__none__">Needs attention (no month)</option>'
        + months.map(m => `<option value="${m}">${acadMonthLabel(m)}</option>`).join("");
    sel.value = [...sel.options].some(o => o.value === keep) ? keep : "";
}

function renderAcademicTable() {
    const tbody = document.getElementById("posAcadTbody"); if (!tbody) return;
    const q = (document.getElementById("posAcadSearch")?.value || "").trim().toLowerCase();
    const f = document.getElementById("posAcadFilter")?.value || "";
    const rows = acadRows.filter(r => {
        if (f === "__none__" && r.plan_month) return false;
        if (f && f !== "__none__" && r.plan_month !== f) return false;
        if (!q) return true;
        return [r.po_id, r.po_name, r.district, r.program_name, r.test_cycle].some(v => String(v || "").toLowerCase().includes(q));
    });
    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="empty-state"><div class="empty-icon">🎓</div>${acadRows.length ? "No rows match." : "No academic plan yet. Upload the Academic Targets Excel."}</td></tr>`;
    } else {
        tbody.innerHTML = rows.map(r => `<tr>
            <td>${escHtml(r.po_id)}</td><td>${escHtml(r.po_name)}</td><td>${escHtml(r.district)}</td>
            <td>${escHtml(r.program_name)}</td><td>${escHtml(r.test_cycle)}</td><td>${escHtml(r.preferred_month)}</td>
            <td>${escHtml(r.fixed_date || "")}</td>
            <td>${r.plan_month ? escHtml(acadMonthLabel(r.plan_month)) : '<span class="pos-acad-warn" title="No usable Fixed Date or Preferred Month">Needs attention</span>'}</td>
            <td class="pos-col-actions">
                <button class="pos-icon-btn edit" title="Edit" onclick="window.POSAdmin.openAcadModal(${r.id})">✏️</button>
                <button class="pos-icon-btn delete" title="Delete" onclick="window.POSAdmin.deleteAcadRow(${r.id})">🗑️</button>
            </td></tr>`).join("");
    }
    const noMonth = acadRows.filter(r => !r.plan_month).length;
    const pos = new Set(acadRows.map(r => r.po_id)).size, dists = new Set(acadRows.map(r => r.district)).size;
    setMeta("posAcadMeta", `${acadRows.length} rows · ${pos} POs · ${dists} districts` + (noMonth ? ` · ${noMonth} need attention` : "")
        + (rows.length !== acadRows.length ? ` · showing ${rows.length}` : ""));
}

/* ---------- Excel: sample, download current, upload ---------- */
async function downloadAcadSample() {
    const XLSX = await loadXLSX();
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([ACAD_COLUMNS.map(c => c.excel)]), "Sheet1");
    XLSX.writeFile(wb, "academic_targets_sample.xlsx");
}
// Current plan, in the same format as the upload -> edit in Excel and upload back.
async function downloadAcadCurrent() {
    const XLSX = await loadXLSX();
    const aoa = [ACAD_COLUMNS.map(c => c.excel)].concat(acadRows.map(r => ACAD_COLUMNS.map(c => r[c.db] == null ? "" : r[c.db])));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Sheet1");
    XLSX.writeFile(wb, "Academic_Targets_current.xlsx");
}

async function uploadAcademic() {
    const fileInput = document.getElementById("posAcadFile");
    const file = fileInput && fileInput.files[0];
    if (!file) { window.notify("Select a file first.", "warning"); return; }
    const btn = document.getElementById("posAcadUploadBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Uploading…"; }
    try {
        const XLSX = await loadXLSX();
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];

        // 1. Same header check as every other upload — before anything touches the database
        const headerRow = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || [];
        const fileHeaders = headerRow.map(h => String(h || "").trim()).filter(h => h);
        const expected = ACAD_COLUMNS.map(c => c.excel);
        const missing = expected.filter(h => !fileHeaders.includes(h));
        const extra = fileHeaders.filter(h => !expected.includes(h));
        if (missing.length || extra.length) {
            let msg = "This file's columns don't match the expected Academic Targets format.\n\n";
            if (missing.length) msg += "Missing: " + missing.join(", ") + "\n";
            if (extra.length) msg += "Unexpected: " + extra.join(", ") + "\n";
            msg += "\nDownload the sample to see the expected headers.";
            await window.showAppAlert({ title: "Column mismatch", message: msg, type: "error", okText: "OK" });
            return;
        }

        // 2. Parse — date cells come through as yyyy-mm-dd text
        const json = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: "yyyy-mm-dd", defval: "" });
        let rows = json.filter(r => expected.some(h => String(r[h] || "").trim() !== "")).map(r => {
            const o = {};
            ACAD_COLUMNS.forEach(c => { o[c.db] = String(r[c.excel] == null ? "" : r[c.excel]).trim(); });
            o.fixed_date = acadParseDate(o.fixed_date);
            return o;
        });
        if (!rows.length) { window.notify("File is empty — no data rows found.", "warning"); return; }
        const ay = acadInferAyStart(rows), by = currentAdminEmail(), now = new Date().toISOString();
        rows = rows.map(o => Object.assign(o, { plan_month: acadPlanMonth(o.fixed_date, o.preferred_month, ay), updated_by: by, updated_at: now }));
        const noMonth = rows.filter(r => !r.plan_month).length;

        // 3. Confirm the full replace
        const ok = await window.showAppConfirm({
            title: "Replace the academic plan?",
            message: `This replaces all ${acadRows.length} current rows with the ${rows.length} rows in this file `
                + `(academic year ${ay}–${String(ay + 1).slice(2)}).`
                + (noMonth ? ` ${noMonth} rows have no usable Fixed Date or Preferred Month and will be marked "Needs attention".` : "")
                + " Continue?",
            type: "warning", confirmText: "Replace", cancelText: "Cancel"
        });
        if (!ok) return;

        // 4. Swap: new rows in first, old rows out only after everything succeeded
        await acadReplaceAll(rows);
        window.notify(`${rows.length} rows uploaded` + (noMonth ? ` · ${noMonth} need attention` : "") + ".", "success");
        fileInput.value = ""; refreshFileLabel(fileInput);
        acadLoaded = false; await loadAcademic();
    } catch (err) {
        console.error("Academic upload failed:", err);
        window.notify(friendlyDbError(err), "error");
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Upload"; }
    }
}

async function acadReplaceAll(rows) {
    const { data: last, error: lastErr } = await posSupabase.from("academic_targets").select("id").order("id", { ascending: false }).limit(1);
    if (lastErr) throw lastErr;
    const maxOldId = last && last.length ? last[0].id : null;
    try {
        for (let i = 0; i < rows.length; i += 200) {
            const { error } = await posSupabase.from("academic_targets").insert(rows.slice(i, i + 200));
            if (error) throw error;
        }
    } catch (err) {
        let undo = posSupabase.from("academic_targets").delete();
        undo = maxOldId != null ? undo.gt("id", maxOldId) : undo.gte("id", 0);   // remove only this attempt's rows
        await undo;
        throw err;
    }
    if (maxOldId != null) {
        const { error } = await posSupabase.from("academic_targets").delete().lte("id", maxOldId);
        if (error) throw error;
    }
}

/* ---------- single-row add / edit / delete ---------- */
function openAcadModal(id = null) {
    acadEditingId = id;
    const r = id ? acadRows.find(x => x.id === id) : null;
    document.getElementById("posAcadModalTitle").textContent = r ? "Edit exam" : "Add exam";
    const poList = document.getElementById("posAcadPoList");
    poList.innerHTML = posData.assignments.filter(a => a.designation === "PO")
        .map(a => `<option value="${escHtml(a.emp_id)}">${escHtml(a.name)}</option>`).join("");
    const dsel = document.getElementById("posAcadDistrict");
    dsel.innerHTML = '<option value="">Select…</option>' + posData.districts.map(d => d.name).sort()
        .map(n => `<option value="${escHtml(n)}">${escHtml(n)}</option>`).join("");
    const msel = document.getElementById("posAcadPrefMonth");
    msel.innerHTML = '<option value="">—</option>' + MONTH_NAMES.slice(1).map(m => `<option>${m}</option>`).join("");
    document.getElementById("posAcadPoId").value = r ? (r.po_id || "") : "";
    document.getElementById("posAcadPoName").value = r ? (r.po_name || "") : "";
    // keep an unknown district / month visible rather than silently dropping it
    if (r && r.district && ![...dsel.options].some(o => o.value === r.district)) dsel.add(new Option(r.district, r.district));
    dsel.value = r ? (r.district || "") : "";
    const pmv = r ? (acadMonthNum(r.preferred_month) ? MONTH_NAMES[acadMonthNum(r.preferred_month)] : (r.preferred_month || "")) : "";
    if (pmv && ![...msel.options].some(o => o.value === pmv)) msel.add(new Option(pmv, pmv));
    msel.value = pmv;
    document.getElementById("posAcadProgram").value = r ? (r.program_name || "") : "";
    document.getElementById("posAcadTest").value = r ? (r.test_cycle || "") : "";
    document.getElementById("posAcadDate").value = r ? (r.fixed_date || "") : "";
    document.getElementById("posAcadModal").classList.add("open");
}
function onAcadPoIdChange() {
    const id = document.getElementById("posAcadPoId").value.trim();
    const a = posData.assignments.find(x => x.emp_id === id);
    if (a) document.getElementById("posAcadPoName").value = a.name;
}
function closeAcadModal() { document.getElementById("posAcadModal").classList.remove("open"); acadEditingId = null; }

async function saveAcadRow() {
    const v = id => document.getElementById(id).value.trim();
    const row = {
        po_id: v("posAcadPoId"), po_name: v("posAcadPoName"), district: v("posAcadDistrict"),
        program_name: v("posAcadProgram"), test_cycle: v("posAcadTest"),
        preferred_month: v("posAcadPrefMonth"), fixed_date: acadParseDate(v("posAcadDate")),
        updated_by: currentAdminEmail(), updated_at: new Date().toISOString()
    };
    if (!row.po_id || !row.district || !row.program_name) { window.notify("PO ID, District and Program Name are required.", "warning"); return; }
    row.plan_month = acadPlanMonth(row.fixed_date, row.preferred_month, acadInferAyStart(acadRows.concat([row])));
    const q = acadEditingId
        ? posSupabase.from("academic_targets").update(row).eq("id", acadEditingId)
        : posSupabase.from("academic_targets").insert(row);
    const { error } = await q;
    if (error) { window.notify(friendlyDbError(error), "error"); return; }
    window.notify(acadEditingId ? "Exam updated." : "Exam added.", "success");
    closeAcadModal(); acadLoaded = false; await loadAcademic();
}

async function deleteAcadRow(id) {
    const r = acadRows.find(x => x.id === id); if (!r) return;
    const ok = await window.showAppConfirm({
        title: "Delete this exam?", message: `${r.program_name} · ${r.test_cycle} for ${r.po_name || r.po_id} (${r.district}). This cannot be undone.`,
        type: "error", confirmText: "Delete", cancelText: "Cancel"
    });
    if (!ok) return;
    const { error } = await posSupabase.from("academic_targets").delete().eq("id", id);
    if (error) { window.notify(friendlyDbError(error), "error"); return; }
    window.notify("Exam deleted.", "success"); acadLoaded = false; await loadAcademic();
}

/* ====================================
   G2 · G3 · G5 TARGETS (g1_g2_g3_target_sheet)
   One row per PO per month. Uploaded per month (Year + Month picked here).
   PM / DM / District targets are NOT stored — the dashboard adds up the PO
   rows of the districts, with a block check (see tgtBlockCheck).
==================================== */

const TGT_TEXT = [
    { excel: "PO ID", db: "po_id" }, { excel: "PO Name", db: "po_name" },
    { excel: "District", db: "district" }, { excel: "PM", db: "pm" },
];
const TGT_NUM = [
    { excel: "Story Telling", db: "story_telling", short: "ST" },
    { excel: "Poetry Recitation", db: "poetry_recitation", short: "PR" },
    { excel: "Creative Writing", db: "creative_writing", short: "CW" },
    { excel: "Spoken English", db: "spoken_english", short: "SE" },
    { excel: "Spelling Bee", db: "spelling_bee", short: "Spell. Bee" },
    { excel: "Morning Assembly", db: "morning_assembly", short: "Morn. Assembly" },
    { excel: "ST Streak", db: "st_streak", short: "ST Streak" },
    { excel: "PR Streak", db: "pr_streak", short: "PR Streak" },
    { excel: "CW Streak", db: "cw_streak", short: "CW Streak" },
    { excel: "SE Streak", db: "se_streak", short: "SE Streak" },
    { excel: "Kathawli", db: "kathawli", short: "Kathawli" },
    { excel: "Online Unique Tchrs", db: "online_unique_teachers", short: "Uniq. Tchrs" },
    { excel: "Online Unique Schs", db: "online_unique_schools", short: "Uniq. Schs" },
    { excel: "Posts per month / per teacher", db: "posts_per_teacher", short: "Posts/Tchr" },
    { excel: "Star Teachers with 3-month consistency", db: "star_teachers", short: "Star Tchrs" },
    { excel: "Teachers using expert coupon", db: "teachers_using_expert_coupon", short: "Exp. Coupon" },
    { excel: "POM Transformed clusters", db: "pom_transformed_clusters", short: "POM Clusters" },
    { excel: "Blocks with recognition events each month", db: "blocks_with_recognition_events", short: "Blocks w/ Events" },
    { excel: "District recognition event held", db: "district_recognition_event", short: "Dist. Event" },
    { excel: "Teachers Recognized vs estimate", db: "teachers_recognized", short: "Tchrs Recog." },
    { excel: "Cluster Heads recognized vs estimate", db: "cluster_heads_recognized", short: "Cluster Heads" },
    { excel: "School Visits", db: "school_visits", short: "School Visits" },
    { excel: "Cluster Visits", db: "cluster_visits", short: "Cluster Visits" },
    { excel: "Officials Visits", db: "officials_visits", short: "Officials Visits" },
    { excel: "Case Study", db: "case_study", short: "Case Study" },
    { excel: "Compliance %", db: "compliance_pct", short: "Compliance %", pct: true },
];
const TGT_ALL = TGT_TEXT.concat(TGT_NUM);

let tgtRows = [];              // rows of the month being viewed
let tgtMonths = [];            // [{year, month}] that have targets
let tgtInit = false;
let tgtEditingId = null;

function tgtNum(v) {           // "1,500" -> 1500, "100%" -> 100, "" -> null, junk -> NaN
    const s = String(v == null ? "" : v).replace(/,/g, "").replace(/%$/, "").trim();
    if (s === "") return null;
    const n = Number(s);
    return isNaN(n) ? NaN : n;
}
function tgtKey(y, m) { return y + "-" + m; }

function initTargetsTab() {
    if (tgtInit) return;
    tgtInit = true;
    const yearSel = document.getElementById("posTgtYear");
    if (yearSel && !yearSel.options.length) {
        const now = new Date().getFullYear();
        for (let y = now - 1; y <= now + 1; y++) yearSel.add(new Option(y, y, false, y === now));
    }
    const monthSel = document.getElementById("posTgtMonth");
    if (monthSel) monthSel.value = String(new Date().getMonth() + 1);
    loadTargetMonths();
}

async function loadTargetMonths(selectKey) {
    setMeta("posTgtMeta", "Loading…");
    try {
        // which months have targets (one small column pair, paged)
        let all = [], from = 0;
        for (;;) {
            const { data, error } = await posSupabase.from("g1_g2_g3_target_sheet").select("year,month").range(from, from + 999);
            if (error) throw error;
            all = all.concat(data || []);
            if (!data || data.length < 1000) break;
            from += 1000;
        }
        const seen = {};
        tgtMonths = all.filter(r => { const k = tgtKey(r.year, r.month); if (seen[k]) return false; seen[k] = 1; return true; })
                       .sort((a, b) => b.year - a.year || b.month - a.month);
        const view = document.getElementById("posTgtView");
        const keep = selectKey || (view && view.value);
        view.innerHTML = tgtMonths.length
            ? tgtMonths.map(r => `<option value="${tgtKey(r.year, r.month)}">${MONTH_NAMES[r.month]} ${r.year}</option>`).join("")
            : '<option value="">No months yet</option>';
        if (keep && tgtMonths.some(r => tgtKey(r.year, r.month) === keep)) view.value = keep;
        await loadTargetRows();
    } catch (err) {
        console.error("Targets load failed:", err);
        setMeta("posTgtMeta", "Failed to load.");
        window.notify(friendlyDbError(err), "error");
    }
}

async function loadTargetRows() {
    const v = document.getElementById("posTgtView").value;
    if (!v) { tgtRows = []; renderTargetsTable(); return; }
    const [y, m] = v.split("-").map(Number);
    const { data, error } = await posSupabase.from("g1_g2_g3_target_sheet").select("*")
        .eq("year", y).eq("month", m).order("po_name").range(0, 999);
    if (error) { window.notify(friendlyDbError(error), "error"); return; }
    tgtRows = data || [];
    renderTargetsTable();
}

/* Block check — the same rule the dashboard uses when it totals a district.
   Per district: POs sorted by how many of the district's blocks they cover;
   a PO whose blocks are ALL already covered by a PO counted before is skipped;
   a partial overlap is counted but flagged. Returns { rowId: [flags] }. */
function tgtBlockCheck(rows) {
    const nd = s => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
    const nb = s => String(s || "").toUpperCase().replace(/\s+/g, "");
    const flags = {};
    const byDist = {};
    rows.forEach(r => { (byDist[nd(r.district)] = byDist[nd(r.district)] || []).push(r); });
    Object.keys(byDist).forEach(dk => {
        const dist = posData.districts.find(d => nd(d.name) === dk);
        const dBlocks = dist ? posData.blocks.filter(b => b.district_id === dist.id).map(b => nb(b.name)) : [];
        const cand = byDist[dk].map(r => {
            const a = posData.assignments.find(x => x.emp_id === r.po_id);
            const blocks = a ? (a.assigned_blocks || []).map(nb).filter(b => dBlocks.includes(b)) : [];
            return { r, a, blocks };
        }).sort((x, y) => y.blocks.length - x.blocks.length);
        const covered = {};
        cand.forEach(c => {
            const f = flags[c.r.id] = [];
            if (!dist) f.push({ cls: "warn", text: "District not in Locations" });
            if (!c.a) f.push({ cls: "warn", text: "Not in Assignments" });
            else if (!(c.a.assigned_districts || []).some(d => nd(d) === dk)) f.push({ cls: "warn", text: "District not assigned to this PO" });
            if (!c.blocks.length) {
                // can't place this PO's blocks: skip only if the district is already fully covered
                const full = dBlocks.length && dBlocks.every(b => covered[b]);
                if (full) f.push({ cls: "skip", text: "Not counted in totals — district already fully covered by " + [...new Set(dBlocks.map(b => covered[b]))].join(", ") });
                return;
            }
            const already = c.blocks.filter(b => covered[b]);
            if (already.length === c.blocks.length) {
                f.push({ cls: "skip", text: "Not counted in totals — all blocks covered by " + [...new Set(already.map(b => covered[b]))].join(", ") });
                return;
            }
            if (already.length) f.push({ cls: "warn", text: already.length + " of " + c.blocks.length + " blocks overlap " + [...new Set(already.map(b => covered[b]))].join(", ") });
            c.blocks.forEach(b => { if (!covered[b]) covered[b] = c.r.po_name || c.r.po_id; });
        });
    });
    return flags;
}

function renderTargetsTable() {
    const thead = document.getElementById("posTgtThead"), tbody = document.getElementById("posTgtTbody");
    if (!thead || !tbody) return;
    thead.innerHTML = "<tr><th>Check</th><th>PO ID</th><th>PO Name</th><th>District</th>"
        + TGT_NUM.map(c => `<th class="pos-num" title="${escHtml(c.excel)}">${escHtml(c.short)}</th>`).join("")
        + '<th class="pos-col-actions">Actions</th></tr>';
    const q = (document.getElementById("posTgtSearch")?.value || "").trim().toLowerCase();
    const flags = tgtBlockCheck(tgtRows);
    const rows = tgtRows.filter(r => !q || [r.po_id, r.po_name, r.district, r.pm].some(v => String(v || "").toLowerCase().includes(q)));
    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="${TGT_NUM.length + 5}" class="empty-state"><div class="empty-icon">🎯</div>`
            + (tgtMonths.length ? "No rows match." : "No targets yet. Pick a month and upload the targets Excel.") + "</td></tr>";
    } else {
        tbody.innerHTML = rows.map(r => {
            const f = flags[r.id] || [];
            const chk = f.length ? f.map(x => `<span class="pos-tgt-flag ${x.cls}" title="${escHtml(x.text)}">${escHtml(x.text)}</span>`).join("")
                                 : '<span class="pos-tgt-ok" title="Counted in district totals">OK</span>';
            return `<tr><td class="pos-tgt-check">${chk}</td><td>${escHtml(r.po_id)}</td><td>${escHtml(r.po_name)}</td><td>${escHtml(r.district)}</td>`
                + TGT_NUM.map(c => {
                    const v = r[c.db];
                    const shown = v == null ? "" : (isNaN(Number(v)) ? escHtml(v) : Number(v).toLocaleString("en-IN", { maximumFractionDigits: 4 }));   // display only
                    return `<td class="pos-num${v === 0 ? " pos-zero" : ""}">${v == null ? "" : shown + (c.pct ? "%" : "")}</td>`;
                }).join("")
                + `<td class="pos-col-actions"><button class="pos-icon-btn edit" title="Edit" onclick="window.POSAdmin.openTgtModal(${r.id})">✏️</button>`
                + `<button class="pos-icon-btn delete" title="Delete" onclick="window.POSAdmin.deleteTgtRow(${r.id})">🗑️</button></td></tr>`;
        }).join("");
    }
    const flagged = rows.filter(r => (flags[r.id] || []).length).length;
    const label = document.getElementById("posTgtView").selectedOptions[0]?.text || "";
    setMeta("posTgtMeta", tgtRows.length ? `${label} · ${tgtRows.length} POs` + (flagged ? ` · ${flagged} with notes` : "") : (tgtMonths.length ? label + " · no rows" : "No targets uploaded yet"));
}

/* ---------- Excel ---------- */
async function downloadTgtSample() {
    const XLSX = await loadXLSX();
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([TGT_ALL.map(c => c.excel)]), "Sheet1");
    XLSX.writeFile(wb, "targets_sample.xlsx");
}
async function downloadTgtCurrent() {
    if (!tgtRows.length) { window.notify("Nothing to download for this month.", "warning"); return; }
    const XLSX = await loadXLSX();
    const aoa = [TGT_ALL.map(c => c.excel)].concat(tgtRows.map(r => TGT_ALL.map(c => r[c.db] == null ? "" : (c.pct ? r[c.db] + "%" : r[c.db]))));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Sheet1");
    const label = (document.getElementById("posTgtView").selectedOptions[0]?.text || "month").replace(/\s+/g, "_");
    XLSX.writeFile(wb, `Targets_${label}.xlsx`);
}

async function uploadTargets() {
    const year = Number(document.getElementById("posTgtYear").value);
    const month = Number(document.getElementById("posTgtMonth").value);
    const fileInput = document.getElementById("posTgtFile");
    const file = fileInput && fileInput.files[0];
    if (!file) { window.notify("Select a file first.", "warning"); return; }
    const btn = document.getElementById("posTgtUploadBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Uploading…"; }
    try {
        const XLSX = await loadXLSX();
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];

        // 1. headers
        const fileHeaders = (XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || []).map(h => String(h || "").trim()).filter(h => h);
        const expected = TGT_ALL.map(c => c.excel);
        const missing = expected.filter(h => !fileHeaders.includes(h)), extra = fileHeaders.filter(h => !expected.includes(h));
        if (missing.length || extra.length) {
            let msg = "This file's columns don't match the expected Targets format.\n\n";
            if (missing.length) msg += "Missing: " + missing.join(", ") + "\n";
            if (extra.length) msg += "Unexpected: " + extra.join(", ") + "\n";
            await window.showAppAlert({ title: "Column mismatch", message: msg + "\nDownload the sample to see the expected headers.", type: "error", okText: "OK" });
            return;
        }

        // 2. rows: skip PM / DM / COO rows, parse numbers
        const json = XLSX.utils.sheet_to_json(ws, { raw: false, defval: "" });
        const skipped = [], bad = [], rows = [];
        json.forEach((r, i) => {
            const poId = String(r["PO ID"] || "").trim();
            if (!poId && expected.every(h => String(r[h] || "").trim() === "")) return;   // blank line
            const a = posData.assignments.find(x => x.emp_id === poId);
            if (a && a.designation !== "PO") { skipped.push(`${poId} ${a.name} (${a.designation})`); return; }
            const o = { year, month };
            TGT_TEXT.forEach(c => { o[c.db] = String(r[c.excel] || "").trim(); });
            if (!o.po_id) { bad.push(`Row ${i + 2}: PO ID is empty`); return; }
            TGT_NUM.forEach(c => {
                const n = tgtNum(r[c.excel]);
                if (Number.isNaN(n)) bad.push(`${o.po_id} ${o.po_name}: "${c.excel}" is not a number ("${r[c.excel]}")`);
                o[c.db] = Number.isNaN(n) ? null : n;
            });
            rows.push(o);
        });
        if (bad.length) {
            await window.showAppAlert({ title: "File not accepted", type: "error", okText: "OK",
                message: "These values aren't numbers:\n\n" + bad.slice(0, 12).join("\n") + (bad.length > 12 ? `\n…and ${bad.length - 12} more` : "") });
            return;
        }
        // 3. the agreed rule: Posts per month / per teacher must be 1 on every PO row
        const notOne = rows.filter(o => o.posts_per_teacher !== 1);
        if (notOne.length) {
            await window.showAppAlert({ title: "File not accepted", type: "error", okText: "OK",
                message: `"Posts per month / per teacher" must be 1 for every PO. ${notOne.length} row${notOne.length === 1 ? " is" : "s are"} not 1:\n\n`
                    + notOne.slice(0, 12).map(o => `${o.po_id} ${o.po_name}: ${o.posts_per_teacher == null ? "blank" : o.posts_per_teacher}`).join("\n")
                    + (notOne.length > 12 ? `\n…and ${notOne.length - 12} more` : "") + "\n\nNothing was saved." });
            return;
        }
        if (!rows.length) { window.notify("No PO rows found in the file.", "warning"); return; }
        const dupIds = rows.map(o => o.po_id).filter((id, i, a) => a.indexOf(id) !== i);
        if (dupIds.length) {
            await window.showAppAlert({ title: "File not accepted", type: "error", okText: "OK",
                message: "Each PO must appear once. Repeated PO IDs: " + [...new Set(dupIds)].join(", ") + "\n\nNothing was saved." });
            return;
        }

        // 4. confirm — and replace only this month
        const label = `${MONTH_NAMES[month]} ${year}`;
        const { count, error: cntErr } = await posSupabase.from("g1_g2_g3_target_sheet").select("id", { count: "exact", head: true }).eq("year", year).eq("month", month);
        if (cntErr) throw cntErr;
        const ok = await window.showAppConfirm({
            title: count ? `Replace targets for ${label}?` : `Upload targets for ${label}?`,
            message: (count ? `${label} already has ${count} PO rows. They will be replaced by ` : "This will save ")
                + `${rows.length} PO rows for ${label}.` + (skipped.length ? ` ${skipped.length} non-PO row${skipped.length === 1 ? "" : "s"} skipped: ${skipped.join("; ")}.` : "") + " Continue?",
            type: "warning", confirmText: count ? "Replace" : "Upload", cancelText: "Cancel"
        });
        if (!ok) return;
        const by = currentAdminEmail(), now = new Date().toISOString();
        await tgtReplaceMonth(year, month, rows.map(o => Object.assign(o, { updated_by: by, updated_at: now })));
        window.notify(`${rows.length} PO targets saved for ${label}.`, "success");
        fileInput.value = ""; refreshFileLabel(fileInput);
        await loadTargetMonths(tgtKey(year, month));
    } catch (err) {
        console.error("Targets upload failed:", err);
        window.notify(friendlyDbError(err), "error");
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Upload"; }
    }
}

// New rows in first; this month's old rows out only after every batch succeeded.
async function tgtReplaceMonth(year, month, rows) {
    const T = "g1_g2_g3_target_sheet";
    const forMonth = q => q.eq("year", year).eq("month", month);
    const { data: last, error: lastErr } = await forMonth(posSupabase.from(T).select("id")).order("id", { ascending: false }).limit(1);
    if (lastErr) throw lastErr;
    const maxOldId = last && last.length ? last[0].id : null;
    try {
        for (let i = 0; i < rows.length; i += 200) {
            const { error } = await posSupabase.from(T).insert(rows.slice(i, i + 200));
            if (error) throw error;
        }
    } catch (err) {
        let undo = forMonth(posSupabase.from(T).delete());
        if (maxOldId != null) undo = undo.gt("id", maxOldId);
        await undo;
        throw err;
    }
    if (maxOldId != null) {
        const { error } = await forMonth(posSupabase.from(T).delete()).lte("id", maxOldId);
        if (error) throw error;
    }
}

/* ---------- single-row edit / add / delete ---------- */
function openTgtModal(id = null) {
    const v = document.getElementById("posTgtView").value;
    if (!id && !v) { window.notify("Upload a month first, then add rows to it.", "warning"); return; }
    tgtEditingId = id;
    const r = id ? tgtRows.find(x => x.id === id) : null;
    document.getElementById("posTgtModalTitle").textContent = (r ? "Edit targets · " : "Add PO · ") + (document.getElementById("posTgtView").selectedOptions[0]?.text || "");
    document.getElementById("posTgtPoList").innerHTML = posData.assignments.filter(a => a.designation === "PO")
        .map(a => `<option value="${escHtml(a.emp_id)}">${escHtml(a.name)}</option>`).join("");
    const dsel = document.getElementById("posTgtDistrict");
    dsel.innerHTML = '<option value="">Select…</option>' + posData.districts.map(d => d.name).sort().map(n => `<option value="${escHtml(n)}">${escHtml(n)}</option>`).join("");
    if (r && r.district && ![...dsel.options].some(o => o.value === r.district)) dsel.add(new Option(r.district, r.district));
    document.getElementById("posTgtPoId").value = r ? r.po_id : "";
    document.getElementById("posTgtPoName").value = r ? (r.po_name || "") : "";
    dsel.value = r ? (r.district || "") : "";
    document.getElementById("posTgtPm").value = r ? (r.pm || "") : "";
    document.getElementById("posTgtFields").innerHTML = TGT_NUM.map(c => `
        <div class="form-group"><label title="${escHtml(c.excel)}">${escHtml(c.excel)}</label>
        <input type="number" step="any" min="0" data-tgt="${c.db}" value="${r && r[c.db] != null ? r[c.db] : (c.db === "posts_per_teacher" ? 1 : "")}"></div>`).join("");
    document.getElementById("posTgtModal").classList.add("open");
}
function onTgtPoIdChange() {
    const a = posData.assignments.find(x => x.emp_id === document.getElementById("posTgtPoId").value.trim());
    if (a) document.getElementById("posTgtPoName").value = a.name;
}
function closeTgtModal() { document.getElementById("posTgtModal").classList.remove("open"); tgtEditingId = null; }

async function saveTgtRow() {
    const val = id => document.getElementById(id).value.trim();
    const row = { po_id: val("posTgtPoId"), po_name: val("posTgtPoName"), district: val("posTgtDistrict"), pm: val("posTgtPm"),
                  updated_by: currentAdminEmail(), updated_at: new Date().toISOString() };
    if (!row.po_id || !row.district) { window.notify("PO ID and District are required.", "warning"); return; }
    let bad = false;
    document.querySelectorAll("#posTgtFields input[data-tgt]").forEach(i => {
        const n = tgtNum(i.value);
        if (Number.isNaN(n) || (n != null && n < 0)) { bad = true; i.classList.add("is-bad"); } else i.classList.remove("is-bad");
        row[i.dataset.tgt] = Number.isNaN(n) ? null : n;
    });
    if (bad) { window.notify("Fix the highlighted values — numbers of 0 or more only.", "warning"); return; }
    if (row.posts_per_teacher !== 1) { window.notify('"Posts per month / per teacher" must be 1.', "warning"); return; }
    if (!tgtEditingId && tgtRows.some(r => r.po_id === row.po_id)) { window.notify("This PO already has targets for this month — edit that row instead.", "warning"); return; }
    let q;
    if (tgtEditingId) q = posSupabase.from("g1_g2_g3_target_sheet").update(row).eq("id", tgtEditingId);
    else {
        const [y, m] = document.getElementById("posTgtView").value.split("-").map(Number);
        q = posSupabase.from("g1_g2_g3_target_sheet").insert(Object.assign(row, { year: y, month: m }));
    }
    const { error } = await q;
    if (error) { window.notify(friendlyDbError(error), "error"); return; }
    window.notify(tgtEditingId ? "Targets updated." : "PO added.", "success");
    closeTgtModal(); await loadTargetRows();
}

async function deleteTgtRow(id) {
    const r = tgtRows.find(x => x.id === id); if (!r) return;
    const ok = await window.showAppConfirm({ title: "Delete this PO's targets?",
        message: `${r.po_name || r.po_id} (${r.district}) for ${document.getElementById("posTgtView").selectedOptions[0]?.text || "this month"}. This cannot be undone.`,
        type: "error", confirmText: "Delete", cancelText: "Cancel" });
    if (!ok) return;
    const { error } = await posSupabase.from("g1_g2_g3_target_sheet").delete().eq("id", id);
    if (error) { window.notify(friendlyDbError(error), "error"); return; }
    window.notify("Deleted.", "success"); await loadTargetMonths();
}

/* ====================================
   SAFE PERIOD REPLACE (shared by all six uploads)
   New rows go in FIRST; the old rows for that period are removed only
   after every batch has succeeded. If any batch fails, the part of the
   new file that did get in is removed again, so the previous upload for
   that week is left exactly as it was.
==================================== */
async function replacePeriodRows(table, year, month, week, rows) {
    const forPeriod = q => q.eq("year", year).eq("month", month).eq("week", week);
    // Highest existing id for this period = the old rows to retire later
    const { data: last, error: lastErr } = await forPeriod(posSupabase.from(table).select("id"))
        .order("id", { ascending: false }).limit(1);
    if (lastErr) throw lastErr;
    const maxOldId = last && last.length ? last[0].id : null;

    try {
        for (let i = 0; i < rows.length; i += 200) {
            const { error } = await posSupabase.from(table).insert(rows.slice(i, i + 200));
            if (error) throw error;
        }
    } catch (err) {
        let undo = forPeriod(posSupabase.from(table).delete());
        if (maxOldId != null) undo = undo.gt("id", maxOldId);   // only the rows this attempt added
        await undo;
        throw err;
    }

    if (maxOldId != null) {
        const { error } = await forPeriod(posSupabase.from(table).delete()).lte("id", maxOldId);
        if (error) throw error;
    }
}

/* ====================================
   DATA TAB — shared UI helpers
==================================== */

// Shows only the most recent upload (by upload time) as a single strip,
// with a count of how many weeks are on file in total.
function renderLastUpload(elId, entries, deleteFnName) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!entries || entries.length === 0) {
        el.innerHTML = `<div class="pos-last pos-last--empty">No uploads yet</div>`;
        return;
    }
    const e = entries.reduce((a, b) => (b.last_upload > a.last_upload ? b : a));
    const when = e.last_upload
        ? new Date(e.last_upload).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : "—";
    const more = entries.length > 1
        ? `<span class="pos-last-more">${entries.length} weeks on file</span>`
        : "";
    el.innerHTML = `<div class="pos-last">
        <span class="pos-last-label">Last upload</span>
        <span class="pos-last-period">${MONTH_NAMES[e.month] || e.month} ${e.year} · ${weekLabel(e.week)}</span>
        <span class="pos-last-dot"></span>
        <span>${e.row_count} rows</span>
        <span class="pos-last-dot"></span>
        <span>${when}</span>
        ${more}
        <button class="pos-icon-btn delete" title="Delete this upload"
            onclick="window.POSAdmin.${deleteFnName}(${e.year},${e.month},${e.week})">🗑️</button>
    </div>`;
}

function onFilePicked(input) { refreshFileLabel(input); }

function refreshFileLabel(input) {
    const box = input && input.closest(".pos-file");
    if (!box) return;
    const textEl = box.querySelector(".pos-file-text");
    const file = input.files && input.files[0];
    box.classList.toggle("has-file", !!file);
    if (textEl) textEl.textContent = file ? file.name : "Choose an Excel file";
    box.title = file ? file.name : "";
}

/* ====================================
   EXPORT
==================================== */

window.POSAdmin = {
    mount,
    showTopTab,
    showTab,
    openStateModal, closeStateModal, saveState,
    openDistrictModal, closeDistrictModal, saveDistrict,
    openBlockModal, openEditBlockModal, closeBlockModal, saveBlock, refreshBlockDistrictOptions,
    deleteBlock,
    openAssignmentModal, closeAssignmentModal, saveAssignment,
    onEmpSearch, onEmpPicked, onEmpKey, onEmpBlur,
    refreshAssignModalUI, onDistrictCheckToggle, onBlockCheckToggle,
    onDistrictSearch, onBlockSearch,
    markResigned,
    downloadVinobaTempl, uploadVinoba, deleteVinobaUpload,
    downloadErTempl, uploadEr, deleteErUpload,
    downloadKekaTempl, uploadKeka, deleteKekaUpload,
    downloadScTempl, uploadSc, deleteScUpload,
    downloadNimbleTempl, uploadNimble, deleteNimbleUpload,
    downloadVaTempl, uploadVa, deleteVaUpload,
    cancelAliasModal, saveAliases, onAliasPick, aliasSkipAll,
    renderAliasTable, loadAliasRows, editAlias, deleteAlias, closeAliasEdit, saveAliasEdit,
    onFilePicked,
    renderAcademicTable, downloadAcadSample, downloadAcadCurrent, uploadAcademic,
    openAcadModal, onAcadPoIdChange, closeAcadModal, saveAcadRow, deleteAcadRow,
    loadTargetRows, renderTargetsTable, downloadTgtSample, downloadTgtCurrent, uploadTargets,
    openTgtModal, onTgtPoIdChange, closeTgtModal, saveTgtRow, deleteTgtRow
};