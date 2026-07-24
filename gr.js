/* ============================================================
   gr.js — GR's & Circulars module for OLF Staff Connect
   ------------------------------------------------------------
   Loaded as a plain <script> (like calendar.js / smartgoal.js).
   Exposes window.GRCirculars.mount(), called by the router in
   app.js after pages/gr.html is injected into #pageContent.

   OPTIMISTIC UI DESIGN
   --------------------
   Every click updates the screen instantly from the in-memory
   cache (allRecords). Network work happens in the background:
     • Upload  -> record appears at once in "My uploads" with an
                  "Uploading…" chip; the file is pushed to Drive
                  in the background; on success the local record
                  is swapped for the server one; on failure the
                  row shows Retry / Discard.
     • Validate/Reject -> status chip flips immediately; the
                  write syncs in the background and reverts (with
                  a toast) only if the server rejects it.
     • Refresh -> stale-while-revalidate: current data stays on
                  screen while fresh data loads, then re-renders.
   Validated records are LOCKED (no further actions).
   ============================================================ */
(function () {
    "use strict";

    /* ====================================================
       CONFIG — set this to your deployed Apps Script URL
       (Deploy > Manage deployments > Web app > /exec URL)
    ==================================================== */
    const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxSfjU4yDl38EaBderQ28qrhp5LKJT4z5Wam1pDJycdVxZPtOsDFJPLE0sKdwIyP9O7/exec";

    /* ====================================================
       STATE → DISTRICTS  (verified official lists)
       MH 36 · MP 55 · CG 33 · Bihar 38
    ==================================================== */
    const STATE_LABELS = {
        MH: "Maharashtra",
        MH_ATC: "Maharashtra - ATC",
        MH_MC: "Maharashtra - MC",
        MP: "Madhya Pradesh",
        CG: "Chhattisgarh",
        BR: "Bihar"
    };

    const STATE_DISTRICTS = {
        MH: [
            "Ahilyanagar", "Akola", "Amravati", "Beed", "Bhandara", "Buldhana",
            "Chandrapur", "Chhatrapati Sambhajinagar", "Dharashiv", "Dhule",
            "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur",
            "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded",
            "Nandurbar", "Nashik", "Palghar", "Parbhani", "Pune", "Raigad",
            "Ratnagiri", "Sangli", "Satara", "Sindhudurg", "Solapur", "Thane",
            "Wardha", "Washim", "Yavatmal"
        ],
        MH_ATC: [
            "Nagpur - ATC"
        ],
        MH_MC: [
            "Amravati - MC", "Pune MC", "PCMC",
            "Sangli - MC", "Nagpur - MC", "Nashik - MC"
        ],
        MP: [
            "Agar Malwa", "Alirajpur", "Anuppur", "Ashoknagar", "Balaghat",
            "Barwani", "Betul", "Bhind", "Bhopal", "Burhanpur", "Chhatarpur",
            "Chhindwara", "Damoh", "Datia", "Dewas", "Dhar", "Dindori", "Guna",
            "Gwalior", "Harda", "Indore", "Jabalpur", "Jhabua", "Katni",
            "Khandwa", "Khargone", "Maihar", "Mandla", "Mandsaur", "Mauganj",
            "Morena", "Narmadapuram", "Narsinghpur", "Neemuch", "Niwari",
            "Pandhurna", "Panna", "Raisen", "Rajgarh", "Ratlam", "Rewa",
            "Sagar", "Satna", "Sehore", "Seoni", "Shahdol", "Shajapur",
            "Sheopur", "Shivpuri", "Sidhi", "Singrauli", "Tikamgarh", "Ujjain",
            "Umaria", "Vidisha"
        ],
        CG: [
            "Balod", "Baloda Bazar", "Balrampur-Ramanujganj", "Bastar",
            "Bemetara", "Bijapur", "Bilaspur", "Dantewada", "Dhamtari", "Durg",
            "Gariaband", "Gaurela-Pendra-Marwahi", "Janjgir-Champa", "Jashpur",
            "Kabirdham", "Kanker", "Khairagarh-Chhuikhadan-Gandai", "Kondagaon",
            "Korba", "Koriya", "Mahasamund", "Manendragarh-Chirmiri-Bharatpur",
            "Mohla-Manpur-Ambagarh Chowki", "Mungeli", "Narayanpur", "Raigarh",
            "Raipur", "Rajnandgaon", "Sakti", "Sarangarh-Bilaigarh", "Sukma",
            "Surajpur", "Surguja"
        ],
        BR: [
            "Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur",
            "Bhojpur", "Buxar", "Darbhanga", "East Champaran", "Gaya",
            "Gopalganj", "Jamui", "Jehanabad", "Kaimur", "Katihar", "Khagaria",
            "Kishanganj", "Lakhisarai", "Madhepura", "Madhubani", "Munger",
            "Muzaffarpur", "Nalanda", "Nawada", "Patna", "Purnia", "Rohtas",
            "Saharsa", "Samastipur", "Saran", "Sheikhpura", "Sheohar",
            "Sitamarhi", "Siwan", "Supaul", "Vaishali", "West Champaran"
        ]
    };

    /* ====================================================
       SMALL HELPERS
    ==================================================== */

    function notify(msg, type = "info") {
        if (typeof window.notify === "function") return window.notify(msg, type);
        console.log(`[${type}] ${msg}`);
    }
    function appAlert(opts) {
        if (typeof window.showAppAlert === "function") return window.showAppAlert(opts);
        alert(`${opts.title || ""}\n${opts.message || ""}`);
        return Promise.resolve(true);
    }
    function appConfirm(opts) {
        if (typeof window.showAppConfirm === "function") return window.showAppConfirm(opts);
        return Promise.resolve(window.confirm(opts.message || "Are you sure?"));
    }

    function escHtml(str) {
        return String(str == null ? "" : str)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    // "2026-07-15" -> "2026-07"
    function monthKeyFromDate(dateStr) {
        if (!dateStr) return "";
        return String(dateStr).slice(0, 7);
    }

    // "2026-07" -> "July 2026"
    function monthLabel(key) {
        if (!key || key.length < 7) return key || "";
        const [y, m] = key.split("-");
        const names = ["", "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
        return `${names[parseInt(m, 10)] || m} ${y}`;
    }

    function fmtDate(dateStr) {
        if (!dateStr) return "—";
        const d = new Date(String(dateStr).length <= 10 ? `${dateStr}T00:00:00` : dateStr);
        if (isNaN(d)) return escHtml(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }

    function fmtDateTime(val) {
        if (!val) return "—";
        const d = new Date(val);
        if (isNaN(d)) return escHtml(val);
        return d.toLocaleString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result).split(",")[1] || "");
            r.onerror = () => reject(new Error("Could not read the selected file"));
            r.readAsDataURL(file);
        });
    }

    function isLocal(record) {
        return String(record.recordId || "").indexOf("local-") === 0;
    }

    /* ====================================================
       APPS SCRIPT API
       POST as text/plain (no custom headers) so the browser
       skips the CORS preflight; Apps Script returns JSON.
    ==================================================== */

    async function api(payload) {
        if (!WEB_APP_URL || WEB_APP_URL.indexOf("PASTE_YOUR") === 0) {
            throw new Error("Backend not configured yet. Set WEB_APP_URL at the top of gr.js to your Apps Script /exec URL.");
        }
        let res;
        try {
            res = await fetch(WEB_APP_URL, {
                method: "POST",
                body: JSON.stringify(payload),
                redirect: "follow"
            });
        } catch (e) {
            throw new Error("Network error reaching the backend. Check the Web App URL and that it is deployed for 'Anyone'.");
        }
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); }
        catch (e) { throw new Error("Unexpected response from the server."); }
        if (!data || data.ok !== true) {
            throw new Error((data && data.error) || "The request could not be completed.");
        }
        return data;
    }

    /* ====================================================
       MODULE STATE (survives page navigation — gr.js is a
       plain script, so background syncs keep running even
       if the user leaves the page; render functions all
       bail out safely if the DOM is gone)
    ==================================================== */
    let user = { email: "", displayName: "", isValidator: false };
    console.log("Gr.js loaded")
    let allRecords = [];                       // in-memory cache (server + optimistic)
    let recordsLoaded = false;                 // first successful fetch done?
    const pendingUploads = Object.create(null); // localId -> { file, meta } for retry
    const sessionMyIds = new Set();            // ids uploaded in this session (My-uploads safety net)

    // "My uploads" (Upload tab) — clickable stat filter + per-column filters
    let myStatFilter = "all";                  // all | validated | not_validated
    let myColFilters = { type: "", district: "", state: "", status: "", title: "" };

    // Detailed dashboard — clickable stat filter (state/district/month come from the filter bar)
    let dashStatFilter = "all";                 // all | validated | not_validated

    /* ====================================================
       MOUNT — called by the router after gr.html is injected
    ==================================================== */
    const GRCirculars = {
        mount() {
            const u = window.GR_CIRCULAR_USER || window.__olfUser || {};
            user = {
                email: (u.email || "").toLowerCase(),
                displayName: u.displayName || u.email || "Unknown",
                isValidator: !!u.isValidator
            };

            const root = document.getElementById("grPage");
            if (!root) return;

            applyRoleVisibility();
            wireTabs();
            wireTopRefresh();
            wireUploadForm();
            wireMyUploadsFilters();
            wireDashboardFilters();
            wireSummaryFilters();

            const who = document.getElementById("grWhoAmI");
            if (who) {
                who.innerHTML = `Signed in as <strong>${escHtml(user.email)}</strong>` +
                    (user.isValidator ? ` <span class="gr-badge gr-badge--val">Validator</span>` : "");
            }

            // Instant paint from the in-memory cache (repeat visits render
            // with zero wait), then refresh silently in the background.
            refreshMonthOptions();
            renderMyUploads();
            loadRecords();
        }
    };

    /* ====================================================
       ROLE-BASED VISIBILITY
       The Upload tab is for everyone. The Dashboard and
       Summary tabs (validation views) are validator-only —
       non-validators never see the tab buttons for them.
    ==================================================== */
    function applyRoleVisibility() {
        if (user.isValidator) return;
        document.querySelectorAll("#grPage .gr-tab").forEach(tab => {
            if (tab.dataset.tab !== "upload") tab.style.display = "none";
        });
    }
    window.GRCirculars = GRCirculars;

    /* ====================================================
       TABS — pure client-side, render from cache instantly
    ==================================================== */
    function wireTabs() {
        const tabs = document.querySelectorAll("#grPage .gr-tab");
        tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                const target = tab.dataset.tab;
                tabs.forEach(t => t.classList.toggle("active", t === tab));
                document.querySelectorAll("#grPage .gr-panel").forEach(p => {
                    p.classList.toggle("active", p.dataset.panel === target);
                });
                if (target === "detailed") renderDetailed();
                if (target === "summary") renderSummary();
                if (target === "upload") renderMyUploads();
            });
        });
    }

    /* ====================================================
       TOP "REFRESH DATA" BUTTON
       Stale-while-revalidate: the page keeps showing what it
       has; new data re-renders when it lands. `nocache: true`
       asks the backend to skip its CacheService read cache.
    ==================================================== */
    function wireTopRefresh() {
        const btn = document.getElementById("grRefreshAll");
        if (btn) btn.addEventListener("click", () => loadRecords({ nocache: true }));
    }

    function setRefreshBusy(busy) {
        const btn = document.getElementById("grRefreshAll");
        if (!btn) return;
        btn.classList.toggle("busy", busy);
        btn.disabled = busy;
    }

    /* ====================================================
       STATE / DISTRICT DROPDOWN HELPERS
    ==================================================== */
    function fillStateSelect(sel, { includeAll = false } = {}) {
        let html = includeAll
            ? `<option value="">All states</option>`
            : `<option value="" disabled selected>Select state…</option>`;
        Object.keys(STATE_LABELS).forEach(code => {
            html += `<option value="${code}">${escHtml(STATE_LABELS[code])}</option>`;
        });
        sel.innerHTML = html;
    }

    function fillDistrictSelect(sel, stateCode, { includeAll = false } = {}) {
        if (!stateCode) {
            sel.innerHTML = includeAll
                ? `<option value="">All districts</option>`
                : `<option value="" disabled selected>Select state first…</option>`;
            sel.disabled = !includeAll;
            return;
        }
        const list = STATE_DISTRICTS[stateCode] || [];
        let html = includeAll
            ? `<option value="">All districts</option>`
            : `<option value="" disabled selected>Select district…</option>`;
        list.forEach(d => { html += `<option value="${escHtml(d)}">${escHtml(d)}</option>`; });
        sel.innerHTML = html;
        sel.disabled = false;
    }

    /* ====================================================
       UPLOAD FORM (hidden until "+ Add New" is clicked)
    ==================================================== */
    function wireUploadForm() {
        const stateSel = document.getElementById("grUpState");
        const distSel = document.getElementById("grUpDistrict");
        if (!stateSel || !distSel) return;

        fillStateSelect(stateSel);
        fillDistrictSelect(distSel, "");

        stateSel.addEventListener("change", () => {
            fillDistrictSelect(distSel, stateSel.value);
        });

        // File-name display. NOTE: this must live here in gr.js —
        // inline <script> tags inside pages/*.html never execute,
        // because scripts injected via innerHTML are ignored.
        const fileInput = document.getElementById("grUpFile");
        const fileNameEl = document.getElementById("grUpFileName");
        if (fileInput && fileNameEl) {
            fileInput.addEventListener("change", () => {
                fileNameEl.textContent = (fileInput.files && fileInput.files[0])
                    ? fileInput.files[0].name
                    : "No file chosen";
            });
        }

        const addBtn = document.getElementById("grAddNewBtn");
        const cancelBtn = document.getElementById("grFormCancelBtn");
        const closeX = document.getElementById("grFormCloseX");
        const overlay = document.getElementById("grFormModalOverlay");
        if (addBtn) addBtn.addEventListener("click", () => toggleUploadForm(true));
        if (cancelBtn) cancelBtn.addEventListener("click", () => toggleUploadForm(false));
        if (closeX) closeX.addEventListener("click", () => toggleUploadForm(false));
        // Click on the dark backdrop (not the box itself) closes the popup.
        if (overlay) overlay.addEventListener("click", (e) => {
            if (e.target === overlay) toggleUploadForm(false);
        });
        // Escape closes the popup while it's open.
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && overlay && overlay.classList.contains("open")) {
                toggleUploadForm(false);
            }
        });

        const submitBtn = document.getElementById("grUploadBtn");
        if (submitBtn) submitBtn.addEventListener("click", (e) => { e.preventDefault(); submitUpload(); });
    }

    /* ====================================================
       MY UPLOADS — clickable stat cards + per-column filters
       All client-side / plain HTML controls, applied on top
       of the in-memory cache — no extra network calls.
    ==================================================== */
    function wireMyUploadsFilters() {
        const row = document.getElementById("grMyStatRow");
        if (row) {
            row.querySelectorAll(".gr-mystat").forEach(btn => {
                btn.addEventListener("click", () => {
                    myStatFilter = btn.dataset.filter;
                    row.querySelectorAll(".gr-mystat").forEach(b => b.classList.toggle("active", b === btn));
                    renderMyUploads();
                });
            });
        }

        const filterRow = document.getElementById("grMyFilterRow");
        if (!filterRow) return;
        filterRow.querySelectorAll(".gr-col-filter").forEach(sel => {
            sel.addEventListener("change", () => {
                myColFilters[sel.dataset.col] = sel.value;
                renderMyUploads();
            });
        });
        filterRow.querySelectorAll(".gr-col-filter-text").forEach(inp => {
            inp.addEventListener("input", () => {
                myColFilters[inp.dataset.col] = inp.value.trim().toLowerCase();
                renderMyUploads();
            });
        });
    }

    // Rebuilds the <option> lists for the dropdown column filters from
    // whatever values actually exist in the user's own records, so the
    // filters never offer choices that would return zero rows.
    function populateMyColumnFilterOptions(mine) {
        const distinct = (fn) => [...new Set(mine.map(fn).filter(Boolean))].sort();
        const fillSelect = (col, values, current) => {
            const sel = document.querySelector(`#grMyFilterRow .gr-col-filter[data-col="${col}"]`);
            if (!sel) return;
            let html = `<option value="">All</option>`;
            values.forEach(v => { html += `<option value="${escHtml(v)}" ${v === current ? "selected" : ""}>${escHtml(v)}</option>`; });
            sel.innerHTML = html;
        };
        fillSelect("type", distinct(r => r.type), myColFilters.type);
        fillSelect("district", distinct(r => r.district), myColFilters.district);
        fillSelect("state", distinct(r => STATE_LABELS[r.state] || r.state), myColFilters.state);
        fillSelect("status", ["Validated", "Pending", "Rejected"], myColFilters.status);
    }

    function applyMyFilters(mine) {
        return mine.filter(r => {
            const status = (r.status || "Pending");
            if (myStatFilter === "validated" && status.toLowerCase() !== "validated") return false;
            if (myStatFilter === "not_validated" && status.toLowerCase() === "validated") return false;

            if (myColFilters.type && r.type !== myColFilters.type) return false;
            if (myColFilters.district && r.district !== myColFilters.district) return false;
            if (myColFilters.state && (STATE_LABELS[r.state] || r.state) !== myColFilters.state) return false;
            if (myColFilters.status && status !== myColFilters.status) return false;
            if (myColFilters.title && !String(r.title || "").toLowerCase().includes(myColFilters.title)) return false;
            return true;
        });
    }

    function toggleUploadForm(show) {
        const overlay = document.getElementById("grFormModalOverlay");
        if (!overlay) return;
        overlay.classList.toggle("open", show);
        if (show) {
            const title = document.getElementById("grUpTitle");
            if (title) setTimeout(() => title.focus(), 50);
        }
    }

    /* ====================================================
       OPTIMISTIC UPLOAD
       The record appears in the UI immediately; the file is
       read + sent to Drive in the background. Failures leave
       a Retry / Discard row instead of losing the entry.
    ==================================================== */
    function submitUpload() {
        const type = (document.querySelector("#grPage input[name='grType']:checked") || {}).value;
        const state = document.getElementById("grUpState").value;
        const district = document.getElementById("grUpDistrict").value;
        const title = document.getElementById("grUpTitle").value.trim();
        const description = document.getElementById("grUpDesc").value.trim();
        const docDate = document.getElementById("grUpDate").value;
        const fileInput = document.getElementById("grUpFile");
        const file = fileInput.files && fileInput.files[0];

        const errors = [];
        if (!type) errors.push("Choose whether this is a GR or a Circular.");
        if (!state) errors.push("Select a state.");
        if (!district) errors.push("Select a district.");
        if (!title) errors.push("Enter a title.");
        if (!docDate) errors.push("Enter the date of the GR / Circular.");
        if (!file) errors.push("Choose a file to upload.");

        if (errors.length) {
            appAlert({ title: "Please complete the form", type: "warning", list: errors });
            return;
        }

        // --- Optimistic insert: visible instantly ---
        const localId = "local-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
        const nowIso = new Date().toISOString();
        const optimistic = {
            srNo: "",
            recordId: localId,
            type, title, description, docDate,
            state,
            stateLabel: STATE_LABELS[state] || state,
            district,
            uploadedBy: user.displayName,
            uploadedByEmail: user.email,
            uploadTimestamp: nowIso,
            status: "Pending",
            validatedBy: "",
            validatedTimestamp: "",
            fileName: file.name,
            fileUrl: "",
            _sync: "uploading",
            _syncError: ""
        };
        allRecords.unshift(optimistic);
        sessionMyIds.add(localId);
        pendingUploads[localId] = {
            file,
            meta: {
                action: "upload",
                type,
                state,
                stateLabel: STATE_LABELS[state] || state,
                district,
                title,
                description,
                docDate,
                uploadedBy: user.email,
                uploadedByName: user.displayName
            }
        };

        toggleUploadForm(false);
        resetUploadForm();
        refreshMonthOptions();
        rerenderAll();
        notify("Upload started — saving to Drive in the background.", "info");

        performUpload(localId); // background, not awaited
    }

    async function performUpload(localId) {
        const p = pendingUploads[localId];
        if (!p) return;

        setSync(localId, "uploading", "");
        renderMyUploads();

        try {
            const fileBase64 = await fileToBase64(p.file);
            const data = await api({
                ...p.meta,
                fileBase64,
                fileName: p.file.name,
                mimeType: p.file.type || "application/octet-stream"
            });

            const idx = allRecords.findIndex(r => String(r.recordId) === localId);
            if (data.record) {
                sessionMyIds.add(String(data.record.recordId));
                if (idx >= 0) allRecords[idx] = data.record;
                else allRecords.unshift(data.record);
            } else if (idx >= 0) {
                allRecords[idx]._sync = "";
            }
            delete pendingUploads[localId];
            sessionMyIds.delete(localId);
            notify("Uploaded to Drive ✓", "success");
        } catch (err) {
            console.error(err);
            setSync(localId, "failed", err.message);
            notify("Upload failed — use Retry on the list.", "error");
        }
        refreshMonthOptions();
        rerenderAll();
    }

    function setSync(recordId, state, msg) {
        const rec = allRecords.find(r => String(r.recordId) === String(recordId));
        if (rec) { rec._sync = state; rec._syncError = msg || ""; }
    }

    function resetUploadForm() {
        document.querySelectorAll("#grPage input[name='grType']").forEach(r => r.checked = false);
        const state = document.getElementById("grUpState");
        const dist = document.getElementById("grUpDistrict");
        if (state) state.value = "";
        if (dist) fillDistrictSelect(dist, "");
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
        setVal("grUpTitle", "");
        setVal("grUpDesc", "");
        setVal("grUpDate", "");
        setVal("grUpFile", "");
        const fn = document.getElementById("grUpFileName");
        if (fn) fn.textContent = "No file chosen";
    }

    /* ====================================================
       DATA LOADING (stale-while-revalidate)
       Never blanks the screen once data has loaded — new
       results simply re-render when they arrive. Optimistic
       and in-flight records are preserved across merges.
    ==================================================== */
    async function loadRecords({ nocache = false } = {}) {
        const firstLoad = !recordsLoaded;
        if (firstLoad) {
            setLoadingBody("grMyBody", 10, "Loading your uploads…");
            setLoadingBody("grDetailedBody", 12, "Loading records…");
        }
        setRefreshBusy(true);
        try {
            const data = await api({ action: "list", nocache: !!nocache });
            mergeServerRecords(Array.isArray(data.records) ? data.records : []);
            recordsLoaded = true;
            refreshMonthOptions();
            rerenderAll();
        } catch (err) {
            console.error(err);
            if (firstLoad) {
                setEmptyBody("grMyBody", 10, "⚠️", err.message);
                setEmptyBody("grDetailedBody", 12, "⚠️", err.message);
            } else {
                notify("Refresh failed: " + err.message, "error");
            }
        } finally {
            setRefreshBusy(false);
        }
    }

    // Server list wins, except for records with a sync in flight
    // (uploading / failed / saving) — those keep their local copy
    // so the user's pending work never flickers away.
    function mergeServerRecords(server) {
        const inflight = new Map(
            allRecords.filter(r => r._sync).map(r => [String(r.recordId), r])
        );
        const merged = server.map(r => inflight.get(String(r.recordId)) || r);
        const serverIds = new Set(server.map(r => String(r.recordId)));
        const extras = [...inflight.values()].filter(r => !serverIds.has(String(r.recordId)));
        allRecords = [...extras, ...merged];
    }

    function refreshMonthOptions() {
        const months = [...new Set(allRecords.map(r => monthKeyFromDate(r.docDate)).filter(Boolean))]
            .sort().reverse();

        ["grDashMonth", "grSumMonth"].forEach(id => {
            const sel = document.getElementById(id);
            if (!sel) return;
            const prev = sel.value;
            const prevWasSet = sel.dataset.touched === "1";
            // "All months" is the default (Select All) — selected unless
            // the person already chose something specific themselves.
            let html = `<option value="" ${prevWasSet && prev ? "" : "selected"}>All months</option>`;
            months.forEach(m => {
                html += `<option value="${m}" ${m === prev ? "selected" : ""}>${escHtml(monthLabel(m))}</option>`;
            });
            sel.innerHTML = html;
            if (!sel.dataset.wiredTouch) {
                sel.dataset.wiredTouch = "1";
                sel.addEventListener("change", () => { sel.dataset.touched = "1"; });
            }
        });
        refreshValidatorOptions();
    }

    // Populates the Summary page's "Validator" filter with the distinct
    // validator EMAILS found in the data (validatedBy is always the email —
    // it's exactly what's sent to the backend when a record is validated).
    // Hidden entirely when there's zero or one validator — nothing to pick
    // between. Defaults to "All validators" (Select All).
    function refreshValidatorOptions() {
        const sel = document.getElementById("grSumValidator");
        const wrap = document.getElementById("grSumValidatorWrap");
        if (!sel || !wrap) return;

        const emails = [...new Set(
            allRecords
                .filter(r => (r.status || "").toLowerCase() === "validated" && r.validatedBy)
                .map(r => String(r.validatedBy).toLowerCase())
        )].sort();

        if (emails.length <= 1) {
            wrap.style.display = "none";
            sel.innerHTML = `<option value="">All validators</option>`;
            return;
        }

        wrap.style.display = "flex";
        const prev = sel.value;
        let html = `<option value="">All validators</option>`;
        emails.forEach(email => {
            html += `<option value="${escHtml(email)}" ${email === prev ? "selected" : ""}>${escHtml(email)}</option>`;
        });
        sel.innerHTML = html;
    }

    // Re-render everything that's currently on screen.
    function rerenderAll() {
        renderMyUploads();
        const active = document.querySelector("#grPage .gr-tab.active");
        if (!active) return;
        if (active.dataset.tab === "detailed") renderDetailed();
        if (active.dataset.tab === "summary") renderSummary();
    }

    /* ====================================================
       "MY UPLOADS" LIST (Upload tab)
       Shows only the signed-in user's records.
    ==================================================== */
    function myRecords() {
        const email = user.email;
        return allRecords.filter(r =>
            sessionMyIds.has(String(r.recordId)) ||
            (r.uploadedByEmail && String(r.uploadedByEmail).toLowerCase() === email) ||
            (!r.uploadedByEmail && String(r.uploadedBy || "").toLowerCase() === email)
        ).sort((a, b) => String(b.uploadTimestamp).localeCompare(String(a.uploadTimestamp)));
    }

    function renderMyUploads() {
        const body = document.getElementById("grMyBody");
        if (!body) return;

        if (!recordsLoaded && allRecords.length === 0) return; // initial loading row stays

        const mine = myRecords();

        // Stat cards always reflect the FULL set of the user's uploads,
        // regardless of the column filters currently applied.
        const validatedCount = mine.filter(r => (r.status || "").toLowerCase() === "validated").length;
        const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setTxt("grMyStatTotal", mine.length);
        setTxt("grMyStatValidated", validatedCount);
        setTxt("grMyStatPending", mine.length - validatedCount);

        populateMyColumnFilterOptions(mine);
        const shown = applyMyFilters(mine);

        const meta = document.getElementById("grMyMeta");
        if (meta) {
            meta.textContent = mine.length
                ? `${shown.length} of ${mine.length} upload${mine.length === 1 ? "" : "s"} shown`
                : "";
        }

        if (!mine.length) {
            setEmptyBody("grMyBody", 10, "📂", "You haven't uploaded any GRs / Circulars yet. Click “+ Add New GR / Circular” to get started.");
            return;
        }
        if (!shown.length) {
            setEmptyBody("grMyBody", 10, "📭", "No uploads match the current filters.");
            return;
        }

        body.innerHTML = shown.map((r, i) => myRowHtml(r, i + 1)).join("");

        body.querySelectorAll("button[data-act='retry']").forEach(btn => {
            btn.addEventListener("click", () => performUpload(btn.dataset.id));
        });
        body.querySelectorAll("button[data-act='discard']").forEach(btn => {
            btn.addEventListener("click", () => discardFailedUpload(btn.dataset.id));
        });
    }

    function myRowHtml(r, sr) {
        let fileCell;
        if (r._sync === "uploading") {
            fileCell = `<span class="gr-sync gr-sync--busy">⏳ Uploading…</span>`;
        } else if (r._sync === "failed") {
            fileCell = `<span class="gr-sync gr-sync--fail" title="${escHtml(r._syncError)}">⚠ Failed</span>`;
        } else if (r.fileUrl) {
            fileCell = `<a href="${escHtml(r.fileUrl)}" target="_blank" rel="noopener" class="gr-file-link">📄 Open</a>`;
        } else {
            fileCell = "—";
        }

        let actionCell = `<span class="gr-muted">—</span>`;
        if (r._sync === "failed") {
            actionCell = `
                <div class="gr-row-actions">
                    <button class="gr-btn-mini gr-btn-retry" data-act="retry" data-id="${escHtml(r.recordId)}">↻ Retry</button>
                    <button class="gr-btn-mini gr-btn-discard" data-act="discard" data-id="${escHtml(r.recordId)}">✕</button>
                </div>`;
        } else if (r._sync === "uploading") {
            actionCell = `<span class="gr-muted">…</span>`;
        }

        return `
        <tr>
            <td>${sr}</td>
            <td><span class="gr-type gr-type--${(r.type || "").toLowerCase() === "gr" ? "gr" : "circ"}">${escHtml(r.type || "")}</span></td>
            <td class="gr-td-title">${escHtml(r.title)}</td>
            <td>${fmtDate(r.docDate)}</td>
            <td>${escHtml(r.district)}</td>
            <td>${escHtml(STATE_LABELS[r.state] || r.state)}</td>
            <td>${fileCell}</td>
            <td>${statusChip(r.status)}</td>
            <td><div class="gr-ts">${fmtDateTime(r.uploadTimestamp)}</div></td>
            <td>${actionCell}</td>
        </tr>`;
    }

    async function discardFailedUpload(localId) {
        const confirmed = await appConfirm({
            title: "Discard this upload?",
            type: "warning",
            message: "This entry never reached the server. Discard it? You can upload it again later.",
            confirmText: "Discard",
            cancelText: "Keep"
        });
        if (!confirmed) return;
        allRecords = allRecords.filter(r => String(r.recordId) !== String(localId));
        delete pendingUploads[localId];
        sessionMyIds.delete(localId);
        refreshMonthOptions();
        rerenderAll();
    }

    /* ====================================================
       DETAILED DASHBOARD (rows + validate / reject)
    ==================================================== */
    function wireDashboardFilters() {
        const stateSel = document.getElementById("grDashState");
        const distSel = document.getElementById("grDashDistrict");
        const monthSel = document.getElementById("grDashMonth");
        if (!stateSel || !distSel || !monthSel) return;

        fillStateSelect(stateSel, { includeAll: true });
        fillDistrictSelect(distSel, "", { includeAll: true });

        stateSel.addEventListener("change", () => {
            fillDistrictSelect(distSel, stateSel.value, { includeAll: true });
            renderDetailed();
        });
        distSel.addEventListener("change", renderDetailed);
        monthSel.addEventListener("change", renderDetailed);

        const statRow = document.getElementById("grDashStatRow");
        if (statRow) {
            statRow.querySelectorAll(".gr-mystat").forEach(btn => {
                btn.addEventListener("click", () => {
                    dashStatFilter = btn.dataset.filter;
                    statRow.querySelectorAll(".gr-mystat").forEach(b => b.classList.toggle("active", b === btn));
                    renderDetailed();
                });
            });
        }
    }

    function currentDetailedFilters() {
        return {
            state: document.getElementById("grDashState").value,
            district: document.getElementById("grDashDistrict").value,
            month: document.getElementById("grDashMonth").value
        };
    }

    function filterRecords({ state, district, month }) {
        return allRecords.filter(r => {
            if (month && monthKeyFromDate(r.docDate) !== month) return false;
            if (state && r.state !== state) return false;
            if (district && r.district !== district) return false;
            return true;
        });
    }

    // Validated records float to the top (most recently validated first);
    // everything else follows, most recent document date first. This is
    // the default view a validator sees the moment they open the tab.
    function sortDetailedRows(rows) {
        return [...rows].sort((a, b) => {
            const av = (a.status || "").toLowerCase() === "validated";
            const bv = (b.status || "").toLowerCase() === "validated";
            if (av && bv) return String(b.validatedTimestamp).localeCompare(String(a.validatedTimestamp));
            if (av !== bv) return av ? -1 : 1;
            return String(b.docDate).localeCompare(String(a.docDate));
        });
    }

    function renderDetailed() {
        const body = document.getElementById("grDetailedBody");
        if (!body) return;

        const f = currentDetailedFilters(); // f.month === "" means "All months"
        const baseRows = filterRecords(f);

        // Stat cards reflect state/district/month filters, but NOT the
        // Validated / Not-validated toggle itself (so counts stay stable
        // while switching between the two).
        const validatedCount = baseRows.filter(r => (r.status || "").toLowerCase() === "validated").length;
        const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setTxt("grDashStatTotal", baseRows.length);
        setTxt("grDashStatValidated", validatedCount);
        setTxt("grDashStatPending", baseRows.length - validatedCount);

        const rows = sortDetailedRows(
            baseRows.filter(r => {
                const isVal = (r.status || "").toLowerCase() === "validated";
                if (dashStatFilter === "validated") return isVal;
                if (dashStatFilter === "not_validated") return !isVal;
                return true;
            })
        );

        updateDetailedMeta(rows.length);

        if (!rows.length) {
            setEmptyBody("grDetailedBody", 12, "📭", "No GRs / Circulars found for this selection.");
            return;
        }

        body.innerHTML = rows.map((r, i) => detailedRowHtml(r, i + 1)).join("");
        wireRowActions();
    }

    function statusChip(status) {
        const s = (status || "Pending").toLowerCase();
        if (s === "validated") return `<span class="gr-chip gr-chip--ok">✔ Validated</span>`;
        if (s === "rejected") return `<span class="gr-chip gr-chip--rej">✕ Rejected</span>`;
        return `<span class="gr-chip gr-chip--pend">● Pending</span>`;
    }

    function detailedRowHtml(r, sr) {
        const s = (r.status || "Pending").toLowerCase();
        const syncing = r._sync === "uploading" || r._sync === "failed" || isLocal(r);

        let actionCell;
        if (syncing) {
            actionCell = `<span class="gr-muted">${r._sync === "failed" ? "Not synced" : "Syncing…"}</span>`;
        } else if (!user.isValidator) {
            actionCell = `<span class="gr-muted">View only</span>`;
        } else if (s === "validated") {
            // Locked forever — no buttons at all.
            actionCell = `<span class="gr-locked">🔒 Locked</span>`;
        } else if (s === "rejected") {
            // A rejected record can still be validated later.
            actionCell = `
                <div class="gr-row-actions">
                    <button class="gr-btn-ok" data-act="validate" data-id="${escHtml(r.recordId)}">Validate</button>
                </div>`;
        } else {
            actionCell = `
                <div class="gr-row-actions">
                    <button class="gr-btn-ok" data-act="validate" data-id="${escHtml(r.recordId)}">Validate</button>
                    <button class="gr-btn-rej" data-act="reject" data-id="${escHtml(r.recordId)}">Reject</button>
                </div>`;
        }

        let fileCell;
        if (r._sync === "uploading") fileCell = `<span class="gr-sync gr-sync--busy">⏳</span>`;
        else if (r._sync === "failed") fileCell = `<span class="gr-sync gr-sync--fail">⚠</span>`;
        else fileCell = r.fileUrl
            ? `<a href="${escHtml(r.fileUrl)}" target="_blank" rel="noopener" class="gr-file-link">📄 Open</a>`
            : "—";

        return `
        <tr>
            <td>${sr}</td>
            <td><span class="gr-type gr-type--${(r.type || "").toLowerCase() === "gr" ? "gr" : "circ"}">${escHtml(r.type || "")}</span></td>
            <td class="gr-td-title">${escHtml(r.title)}</td>
            <td class="gr-td-desc" title="${escHtml(r.description)}">${escHtml(r.description || "—")}</td>
            <td>${fmtDate(r.docDate)}</td>
            <td>${escHtml(r.district)}</td>
            <td>${escHtml(STATE_LABELS[r.state] || r.state)}</td>
            <td>${fileCell}</td>
            <td>
                <div class="gr-uploaded">${escHtml(r.uploadedBy || "—")}</div>
                <div class="gr-ts">${fmtDateTime(r.uploadTimestamp)}</div>
            </td>
            <td>${statusChip(r.status)}</td>
            <td>
                ${r.validatedBy ? `<div class="gr-uploaded">${escHtml(r.validatedByName || r.validatedBy)}</div>
                <div class="gr-ts">${fmtDateTime(r.validatedTimestamp)}</div>` : `<span class="gr-muted">—</span>`}
            </td>
            <td>${actionCell}</td>
        </tr>`;
    }

    function wireRowActions() {
        document.querySelectorAll("#grDetailedBody button[data-act]").forEach(btn => {
            btn.addEventListener("click", () => handleValidation(btn.dataset.act, btn.dataset.id));
        });
    }

    /* ====================================================
       OPTIMISTIC VALIDATE / REJECT
       The chip flips the instant the validator confirms;
       the write syncs in the background and reverts only
       if the server refuses (e.g. record already locked).
    ==================================================== */
    async function handleValidation(act, recordId) {
        if (!user.isValidator) {
            appAlert({ title: "Not allowed", type: "error", message: "Only validators can validate or reject records." });
            return;
        }

        const idx = allRecords.findIndex(r => String(r.recordId) === String(recordId));
        if (idx < 0) return;
        if ((allRecords[idx].status || "").toLowerCase() === "validated") return; // locked

        const isReject = act === "reject";
        const confirmed = await appConfirm({
            title: isReject ? "Reject this record?" : "Mark as validated?",
            type: isReject ? "error" : "info",
            message: isReject
                ? "Reject this GR / Circular? This marks it as not validated on the Vinoba app."
                : "Confirm this GR / Circular is validated and uploaded on the Vinoba app. Once validated, the record is locked and cannot be changed.",
            confirmText: isReject ? "Reject" : "Validate",
            cancelText: "Cancel"
        });
        if (!confirmed) return;

        // --- Optimistic flip: instant on screen ---
        // validatedBy is kept as the EMAIL here (matching exactly what's
        // sent to the backend below), so the Summary validator filter
        // works the instant a validation happens, before the sync even
        // completes. validatedByName is only for the friendlier on-screen
        // label in the Detailed table.
        const prev = { ...allRecords[idx] };
        allRecords[idx] = {
            ...prev,
            status: isReject ? "Rejected" : "Validated",
            validatedBy: user.email,
            validatedByName: user.displayName || user.email,
            validatedTimestamp: new Date().toISOString(),
            _sync: "saving"
        };
        rerenderAll();

        try {
            const data = await api({
                action: isReject ? "reject" : "validate",
                recordId,
                validatedBy: user.email,
                validatedByName: user.displayName
            });
            const i2 = allRecords.findIndex(r => String(r.recordId) === String(recordId));
            if (i2 >= 0) {
                allRecords[i2] = data.record ? data.record : { ...allRecords[i2], _sync: "" };
            }
        } catch (err) {
            console.error(err);
            // Revert to the previous state and tell the user why.
            const i2 = allRecords.findIndex(r => String(r.recordId) === String(recordId));
            if (i2 >= 0) allRecords[i2] = prev;
            notify(err.message, "error");
        }
        rerenderAll();
    }

    function updateDetailedMeta(count) {
        const meta = document.getElementById("grDetailedMeta");
        if (meta) meta.textContent = count ? `${count} record${count === 1 ? "" : "s"}` : "";
    }

    /* ====================================================
       SUMMARY DASHBOARD (bar chart)
    ==================================================== */
    function wireSummaryFilters() {
        const stateSel = document.getElementById("grSumState");
        const distSel = document.getElementById("grSumDistrict");
        const monthSel = document.getElementById("grSumMonth");
        if (!stateSel || !distSel || !monthSel) return;

        fillStateSelect(stateSel, { includeAll: true });
        fillDistrictSelect(distSel, "", { includeAll: true });

        stateSel.addEventListener("change", () => {
            fillDistrictSelect(distSel, stateSel.value, { includeAll: true });
            renderSummary();
        });
        distSel.addEventListener("change", renderSummary);
        monthSel.addEventListener("change", renderSummary);

        const validatorSel = document.getElementById("grSumValidator");
        if (validatorSel) validatorSel.addEventListener("change", renderSummary);
    }

    function renderSummary() {
        const wrap = document.getElementById("grSummaryWrap");
        if (!wrap) return;

        const state = document.getElementById("grSumState").value;
        const district = document.getElementById("grSumDistrict").value;
        const month = document.getElementById("grSumMonth").value; // "" = All months (Select All)
        const validatorSel = document.getElementById("grSumValidator");
        const validator = validatorSel ? validatorSel.value.toLowerCase() : "";

        // month is no longer required — "All months" is the default view.
        const rows = filterRecords({ state, district, month });

        const stat = {
            GR: { up: 0, val: 0 },
            Circular: { up: 0, val: 0 }
        };
        let validatorValCount = 0;
        rows.forEach(r => {
            const key = (r.type || "").toLowerCase() === "gr" ? "GR" : "Circular";
            stat[key].up += 1;
            if ((r.status || "").toLowerCase() === "validated") {
                stat[key].val += 1;
                if (validator && String(r.validatedBy || "").toLowerCase() === validator) validatorValCount += 1;
            }
        });

        const totalUp = stat.GR.up + stat.Circular.up;
        const totalVal = stat.GR.val + stat.Circular.val;
        // Total uploaded & Pending/rejected depend only on State / District /
        // Month — never on which validator is selected. Only the "Validated"
        // number changes when a specific validator is picked.
        const pendingOrRejected = totalUp - totalVal;

        // Cards: when a specific validator is chosen, swap "Total validated"
        // for that validator's own count. Pending/rejected stays the same
        // for everyone — it's simply what nobody has validated yet.
        const cardsHtml = validator
            ? `${sumCard("Total uploaded", totalUp, "#4f8ef7")}
               ${sumCard(`Validated by ${validator}`, validatorValCount, "#16a34a")}
               ${sumCard("Pending / rejected", pendingOrRejected, "#f59e0b")}`
            : `${sumCard("Total uploaded", totalUp, "#4f8ef7")}
               ${sumCard("Total validated", totalVal, "#16a34a")}
               ${sumCard("Pending / rejected", pendingOrRejected, "#f59e0b")}`;

        const periodLabel = month ? monthLabel(month) : "All months";

        wrap.innerHTML = `
            <div class="gr-sum-cards">
                ${cardsHtml}
            </div>
            <div class="gr-chart-card">
                <div class="gr-chart-title">Uploaded vs Validated — ${escHtml(periodLabel)}</div>
                ${barChartHtml(stat)}
                <div class="gr-legend">
                    <span><i class="gr-swatch" style="background:#4f8ef7"></i>Uploaded</span>
                    <span><i class="gr-swatch" style="background:#16a34a"></i>Validated</span>
                </div>
            </div>`;
    }

    function sumCard(label, value, color) {
        return `
            <div class="gr-sum-card">
                <div class="gr-sum-val" style="color:${color}">${value}</div>
                <div class="gr-sum-label">${escHtml(label)}</div>
            </div>`;
    }

    function barChartHtml(stat) {
        const max = Math.max(1, stat.GR.up, stat.GR.val, stat.Circular.up, stat.Circular.val);
        const group = (name, d) => {
            const upH = Math.round((d.up / max) * 160);
            const valH = Math.round((d.val / max) * 160);
            return `
                <div class="gr-bar-group">
                    <div class="gr-bars">
                        <div class="gr-bar gr-bar--up" style="height:${upH}px" title="Uploaded: ${d.up}">
                            <span class="gr-bar-num">${d.up}</span>
                        </div>
                        <div class="gr-bar gr-bar--val" style="height:${valH}px" title="Validated: ${d.val}">
                            <span class="gr-bar-num">${d.val}</span>
                        </div>
                    </div>
                    <div class="gr-bar-label">${escHtml(name)}</div>
                </div>`;
        };
        return `
            <div class="gr-chart">
                ${group("GRs", stat.GR)}
                ${group("Circulars", stat.Circular)}
            </div>`;
    }

    /* ====================================================
       SHARED RENDER HELPERS
    ==================================================== */
    function grEmptyHtml(icon, msg) {
        return `<div class="gr-empty"><div class="gr-empty-icon">${icon}</div>${escHtml(msg)}</div>`;
    }
    function setEmptyBody(tbodyId, colspan, icon, msg) {
        const b = document.getElementById(tbodyId);
        if (b) b.innerHTML = `<tr><td colspan="${colspan}" class="gr-empty-cell">${grEmptyHtml(icon, msg)}</td></tr>`;
    }
    function setLoadingBody(tbodyId, colspan, msg) {
        setEmptyBody(tbodyId, colspan, "⏳", msg);
    }

})();