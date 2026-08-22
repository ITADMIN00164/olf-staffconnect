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
    // Compact labels for the State column (saves horizontal space). Full name shows on hover.
    const STATE_SHORT = { MH: "MH", MH_ATC: "MH-ATC", MH_MC: "MH-MC", MP: "MP", CG: "CG", BR: "BR" };
    function stateShort(code) { return STATE_SHORT[code] || code || "—"; }
    function stateCell(code) { return `<span title="${escHtml(STATE_LABELS[code] || code || "")}">${escHtml(stateShort(code))}</span>`; }

    // Type is rendered as a single initial (G / C) so the column stays narrow.
    // The full name is still available on hover.
    function isGrType(type) { return String(type || "").toLowerCase() === "gr"; }
    function typeCell(type) {
        if (!type) return `<span class="gr-muted">—</span>`;
        const gr = isGrType(type);
        return `<span class="gr-type gr-type--${gr ? "gr" : "circ"} gr-type--initial" title="${escHtml(gr ? "Government Resolution (GR)" : "Circular")}">${gr ? "G" : "C"}</span>`;
    }

    // Validator remark cell — an icon button that opens the shared popup,
    // so the remark never eats table width. Validators get a writable cell
    // on the Dashboard (including on locked, already-validated rows); the
    // Upload tab is always read-only.
    function remarkCell(r, editable) {
        const has = !!r.validatorRemark;
        if (editable) {
            return `<button type="button" class="gr-desc-btn${has ? "" : " gr-desc-btn--empty"}" data-act="remark-edit" data-id="${escHtml(r.recordId)}" title="${has ? "View / edit validator remark" : "Add a validator remark"}">${has ? "💬" : "✎"}</button>`;
        }
        return has
            ? `<button type="button" class="gr-desc-btn" data-act="remark" data-desc="${escHtml(r.validatorRemark)}" title="View validator remark">💬</button>`
            : `<span class="gr-muted">—</span>`;
    }

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
       ANALYTICS MASTER LIST
       The districts OLF actually operates in, supplied per
       community. Drives the Analytics tab so every district
       shows a row even with zero uploads. Kept separate from
       STATE_DISTRICTS (the full official upload list) on
       purpose: these names are the operational ones.
    ==================================================== */
    const ANALYTICS_DISTRICTS = {
        MH: [
            "Ahilyanagar", "Amravati", "Bhandara", "Bid", "Buldhana",
            "Chandrapur", "Dharashiv", "Gadchiroli", "Hingoli", "Jalgaon",
            "Jalna", "Latur", "Nagpur", "Nanded", "Nandurbar", "Nashik",
            "Palghar", "Pune", "Raigarh MH", "Ratnagiri", "Kolhapur",
            "Solapur", "Satara", "Wardha", "Washim", "Yavatmal"
        ],
        MH_MC: [
            "Amravati - MC", "KDMC", "Pune MC", "PCMC", "Sangli - MC",
            "Mumbai Suburban", "Nagpur - MC", "Nashik - MC"
        ],
        MH_ATC: [
            "Nagpur - ATC"
        ],
        CG: [
            "Bastar", "Dantewada", "Dhamtari", "Durg", "Gariaband",
            "Janjgir - Champa", "Jashpur", "Raigarh", "Raipur",
            "Rajnandgaon", "Sukma"
        ],
        BR: [
            "Begusarai"
        ],
        MP: [
            "Balaghat", "Seoni"
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

    /* toLocaleDateString / toLocaleString build a fresh Intl formatter on
       every call, which costs about a millisecond each. Across a table of
       rows that alone was most of the render time, so the formatters are
       built once and the results memoised - the same handful of dates
       repeats across hundreds of rows. */
    const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
        day: "2-digit", month: "short", year: "numeric"
    });
    const DATETIME_FMT = new Intl.DateTimeFormat("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
    const dateMemo = new Map();
    const dateTimeMemo = new Map();

    function fmtDate(dateStr) {
        if (!dateStr) return "—";
        const key = String(dateStr);
        const hit = dateMemo.get(key);
        if (hit !== undefined) return hit;
        const d = new Date(key.length <= 10 ? `${key}T00:00:00` : key);
        const out = isNaN(d) ? escHtml(key) : DATE_FMT.format(d);
        if (dateMemo.size < 4000) dateMemo.set(key, out);
        return out;
    }

    function fmtDateTime(val) {
        if (!val) return "—";
        const key = String(val);
        const hit = dateTimeMemo.get(key);
        if (hit !== undefined) return hit;
        const d = new Date(key);
        const out = isNaN(d) ? escHtml(key) : DATETIME_FMT.format(d);
        if (dateTimeMemo.size < 4000) dateTimeMemo.set(key, out);
        return out;
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result).split(",")[1] || "");
            r.onerror = () => reject(new Error("Could not read the selected file"));
            r.readAsDataURL(file);
        });
    }

    // Plain string comparison instead of localeCompare: these are ISO
    // date / timestamp strings, so the result is identical and it runs
    // an order of magnitude faster across a full year of records.
    function cmpStr(a, b) {
        const x = String(a == null ? "" : a);
        const y = String(b == null ? "" : b);
        return x < y ? -1 : (x > y ? 1 : 0);
    }

    function isLocal(record) {
        return String(record.recordId || "").indexOf("local-") === 0;
    }

    /* ====================================================
       APPS SCRIPT API
       POST as text/plain (no custom headers) so the browser
       skips the CORS preflight; Apps Script returns JSON.
    ==================================================== */

    async function api(payload, opts = {}) {
        if (!WEB_APP_URL || WEB_APP_URL.indexOf("PASTE_YOUR") === 0) {
            throw new Error("Backend not configured yet. Set WEB_APP_URL at the top of gr.js to your Apps Script /exec URL.");
        }
        // Optional timeout: without one a slow/hung Apps Script request never
        // settles and the row stays stuck on "uploading" forever. With it, the
        // upload flips to a visible "failed" state the user can act on.
        let res, _timer = null, _ctrl = null;
        if (opts.timeoutMs && typeof AbortController !== "undefined") {
            _ctrl = new AbortController();
            _timer = setTimeout(() => _ctrl.abort(), opts.timeoutMs);
        }
        try {
            res = await fetch(WEB_APP_URL, {
                method: "POST",
                body: JSON.stringify(payload),
                redirect: "follow",
                signal: _ctrl ? _ctrl.signal : undefined
            });
        } catch (e) {
            if (e && e.name === "AbortError") {
                const te = new Error("The upload took too long and was stopped. It may not have saved — tap Refresh Data to check before retrying.");
                te.code = "timeout";
                throw te;
            }
            // A phone that has been idle drops its warm connection to Google,
            // so the first request after a pause often fails outright. That is
            // a transient condition, and the caller retries it.
            const ne = new Error("Could not reach the server — this is usually a temporary network blip. Please try again.");
            ne.code = "network";
            throw ne;
        } finally {
            if (_timer) clearTimeout(_timer);
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

    // The file chosen in the upload form, with its bytes already read.
    // { file, base64, error, promise } — see the change handler in wireUploadForm().
    let pickedFile = null;

    /* ----------------------------------------------------------
       SPEED
       1. The last known records live in localStorage, so the table
          paints immediately on a cold load instead of waiting for
          Apps Script.
       2. A tiny "ver" call then tells us whether anything actually
          changed; the full list is only downloaded when it did.
       3. Rows render in windows, so a year of data (1000-1500 rows)
          never builds 20k DOM nodes at once.
    ---------------------------------------------------------- */
    const LS_KEY = "olf_gr_cache_v1";
    const LS_MAX_AGE = 7 * 24 * 60 * 60 * 1000;   // a week-old cache is still fine as a first paint
    const VER_MIN_GAP = 45000;                    // don't re-check the version more often than this
    const ROW_PAGE = 50;                          // rows added per window

    let dataVersion = "";
    let lastCheckAt = 0;
    let persistTimer = null;

    let dashRows = [], dashShown = 0;   // Dashboard windowing
    let myRows = [], myShown = 0;       // My uploads windowing

    // Paint from the previous session's data, if we still have it.
    function loadFromLocal() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return false;
            const box = JSON.parse(raw);
            if (!box || !Array.isArray(box.records) || !box.records.length) return false;
            if (Date.now() - (box.savedAt || 0) > LS_MAX_AGE) return false;
            allRecords = box.records;
            dataVersion = box.version || "";
            recordsLoaded = true;
            return true;
        } catch (e) {
            return false;
        }
    }

    // Throttled, and only ever stores server-confirmed records — an
    // in-flight upload must not come back to life after a refresh.
    function persistLocal() {
        if (persistTimer) return;
        persistTimer = setTimeout(() => {
            persistTimer = null;
            try {
                const clean = allRecords
                    .filter(r => !r._sync && !isLocal(r))
                    .map(r => {
                        const c = { ...r };
                        delete c._sync;
                        delete c._syncError;
                        return c;
                    });
                localStorage.setItem(LS_KEY, JSON.stringify({
                    version: dataVersion, savedAt: Date.now(), records: clean
                }));
            } catch (e) {
                // Out of quota or private mode — drop the cache and carry on.
                try { localStorage.removeItem(LS_KEY); } catch (e2) {}
            }
        }, 1200);
    }

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
            wireAnalyticsFilters();

            const who = document.getElementById("grWhoAmI");
            if (who) {
                who.innerHTML = `Signed in as <strong>${escHtml(user.email)}</strong>` +
                    (user.isValidator ? ` <span class="gr-badge gr-badge--val">Validator</span>` : "");
            }

            // Instant paint from memory, or from the stored copy on a cold
            // load, then check the server quietly in the background.
            if (!allRecords.length) loadFromLocal();
            refreshMonthOptions();
            renderMyUploads();
            renderSyncBanner();

            // Warn before closing the tab while any upload is still unsynced,
            // so an in-flight or failed upload isn't silently lost.
            if (!window.__grUnloadGuard) {
                window.__grUnloadGuard = true;
                window.addEventListener("beforeunload", (e) => {
                    if (unsyncedRecords().length) { e.preventDefault(); e.returnValue = ""; }
                });
            }
            const _banner = document.getElementById("grSyncBanner");
            if (_banner && !_banner.dataset.wired) {
                _banner.dataset.wired = "1";
                _banner.addEventListener("click", (e) => {
                    if (e.target.closest('[data-act="gotoUpload"]')) {
                        const t = document.querySelector('#grPage .gr-tab[data-tab="upload"]');
                        if (t) t.click();
                    }
                });
            }

            syncRecords();
        }
    };

    /* ====================================================
       ROLE-BASED VISIBILITY
       All three tabs are open to every member: Upload, Dashboard
       and Summary are all readable by anyone. What is restricted
       is the ability to ACT on a record — validating, rejecting and
       writing a remark stay validator-only. That is enforced in
       three places, so a non-validator has no route to a write:
         • detailedRowHtml() renders "View only" instead of the
           validate / reject buttons;
         • remarkCell() renders a read-only remark icon rather
           than the editable one;
         • handleValidation() and editRemark() both refuse outright
           if called anyway.
       The Summary tab is read-only by nature — it has no actions.
    ==================================================== */
    function applyRoleVisibility() {
        // Nothing to hide at the tab level any more. Kept as the single
        // place to put page-level role rules if they are ever needed,
        // and it tags the page so CSS can react to the role.
        const root = document.getElementById("grPage");
        if (root) root.classList.toggle("gr-role-validator", !!user.isValidator);
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
                if (target === "analytics") renderAnalytics();
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
        if (btn) btn.addEventListener("click", () => syncRecords({ force: true }));
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
                const f = (fileInput.files && fileInput.files[0]) || null;
                fileNameEl.textContent = f ? f.name : "No file chosen";

                // A picked file is only a REFERENCE to something on disk. If the
                // form then sits open for a few minutes (screen locked, tab in the
                // background), Android can release that reference and the read at
                // upload time fails. So grab the bytes right now, while the handle
                // is certainly still good, and reuse them later.
                pickedFile = null;
                if (!f) return;
                const entry = {
                    file: f,
                    base64: null,   // filled in when the read below resolves
                    error: ""
                };
                pickedFile = entry;
                entry.promise = fileToBase64(f)
                    .then(b64 => { entry.base64 = b64; return b64; })
                    .catch(err => {
                        entry.error = (err && err.message) || "Could not read the selected file";
                        return null;   // handled at upload time; never an unhandled rejection
                    });
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

        // Description popup: close on Escape (the modal itself is created lazily in JS by openDescModal).
        document.addEventListener("keydown", (e) => {
            const o = document.getElementById("grDescModalOverlay");
            if (e.key === "Escape" && o && o.classList.contains("open")) closeDescModal();
        });
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
            // Re-open the connection to Apps Script now, while the form is being
            // filled in, so the upload itself doesn't pay the cold-start cost of
            // a fresh TLS handshake + redirect hop. Cheap (a few bytes) and
            // entirely best-effort — a failure here changes nothing.
            try { api({ action: "ver" }).catch(() => {}); } catch (e) {}
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
            // Bytes captured when the file was picked (see wireUploadForm).
            // Survives the OS releasing the file handle while the form was open.
            picked: (pickedFile && pickedFile.file === file) ? pickedFile : null,
            meta: {
                action: "upload",
                // Stable across retries so the backend can dedup and never
                // create a duplicate file/row for the same upload attempt.
                clientUploadId: localId,
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

        // --- 1. Get the file's bytes -------------------------------------
        // Prefer the copy taken when the file was picked; only fall back to
        // reading from disk if that isn't available.
        let fileBase64 = null;
        if (p.picked) {
            try { await p.picked.promise; } catch (e) {}
            if (p.picked.base64) fileBase64 = p.picked.base64;
        }
        if (fileBase64 == null) {
            try {
                fileBase64 = await fileToBase64(p.file);
            } catch (readErr) {
                const msg = "Could not read the chosen file — the phone released it while the form was open. Please discard this row and upload the file again.";
                console.error(readErr);
                setSync(localId, "failed", msg);
                notify("Upload failed — " + msg, "error");
                refreshMonthOptions();
                rerenderAll();
                return;
            }
        }

        // --- 2. Send it, retrying transient failures ----------------------
        // A page left open for a few minutes loses its warm connection to
        // Google, so the first attempt after a pause can fail instantly even
        // on a perfect network and a tiny file. Retrying re-establishes the
        // connection and almost always succeeds. This cannot create a
        // duplicate: the backend dedups on clientUploadId, which is the same
        // across every attempt and every Retry.
        const MAX_TRIES = 3;
        let lastErr = null;
        for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
            try {
                const data = await api({
                    ...p.meta,
                    fileBase64,
                    fileName: p.file.name,
                    mimeType: p.file.type || "application/octet-stream"
                }, { timeoutMs: 120000 });

                if (data.version) dataVersion = String(data.version);
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
                persistLocal();
                notify(attempt > 1 ? "Uploaded to Drive ✓ (after a retry)" : "Uploaded to Drive ✓", "success");
                refreshMonthOptions();
                rerenderAll();
                return;
            } catch (err) {
                lastErr = err;
                // A timeout may mean the file DID save and only the reply was
                // lost. Re-sending is handled safely by the backend's dedup, but
                // there is no point burning another 2 minutes — stop and let the
                // user refresh and decide.
                if (err && err.code === "timeout") break;
                if (attempt < MAX_TRIES) {
                    setSync(localId, "uploading", "Retrying (" + attempt + "/" + (MAX_TRIES - 1) + ")…");
                    renderMyUploads();
                    await new Promise(r => setTimeout(r, 800 * attempt));   // 0.8s, then 1.6s
                }
            }
        }

        // --- 3. Out of attempts: surface the REAL reason ------------------
        console.error(lastErr);
        const reason = (lastErr && lastErr.message) || "Unknown error";
        setSync(localId, "failed", reason);
        notify("Upload failed — " + reason, "error");
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
        // The in-flight upload keeps its own reference to the old entry,
        // so dropping this one never disturbs a pending send.
        pickedFile = null;
        const fn = document.getElementById("grUpFileName");
        if (fn) fn.textContent = "No file chosen";
    }

    /* ====================================================
       DATA LOADING (stale-while-revalidate)
       Never blanks the screen once data has loaded — new
       results simply re-render when they arrive. Optimistic
       and in-flight records are preserved across merges.
    ==================================================== */
    /**
     * The cheap path: ask only whether the data changed. A "ver" reply is
     * a few bytes against a payload that reaches ~1.5 MB at a full year of
     * records, so an unchanged dataset costs one tiny round trip and the
     * screen never blanks. Falls back to a full load on any doubt.
     */
    async function syncRecords({ force = false } = {}) {
        if (force) {
            lastCheckAt = Date.now();
            return loadRecords({ nocache: true });
        }
        if (!allRecords.length || !dataVersion) return loadRecords();
        if (Date.now() - lastCheckAt < VER_MIN_GAP) return;   // just checked

        lastCheckAt = Date.now();
        try {
            const data = await api({ action: "ver" });
            if (data.version && String(data.version) === String(dataVersion)) return;
        } catch (err) {
            // Older backend without the "ver" action, or a blip: just reload.
            console.warn("Version check failed, falling back to a full load.", err);
        }
        return loadRecords();
    }

    async function loadRecords({ nocache = false } = {}) {
        const firstLoad = !recordsLoaded;
        if (firstLoad) {
            setLoadingBody("grMyBody", 11, "Loading your uploads…");
            setLoadingBody("grDetailedBody", 13, "Loading records…");
        }
        setRefreshBusy(true);
        try {
            const data = await api({ action: "list", nocache: !!nocache });
            mergeServerRecords(Array.isArray(data.records) ? data.records : []);
            recordsLoaded = true;
            if (data.version) dataVersion = String(data.version);
            persistLocal();
            refreshMonthOptions();
            rerenderAll();
        } catch (err) {
            console.error(err);
            if (firstLoad) {
                setEmptyBody("grMyBody", 11, "⚠️", err.message);
                setEmptyBody("grDetailedBody", 13, "⚠️", err.message);
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

    /* ====================================================
       UNSYNCED-UPLOAD VISIBILITY
       A record is "unsynced" until the backend confirms it: it is still
       uploading, it failed, or it is a local-only optimistic row. These
       exist only in this browser — nobody else can see them and they are
       not in the sheet yet. Surface that plainly so an upload can't look
       saved when it isn't.
    ==================================================== */
    function unsyncedRecords() {
        return allRecords.filter(r => r._sync === "uploading" || r._sync === "failed" || isLocal(r));
    }

    function renderSyncBanner() {
        const el = document.getElementById("grSyncBanner");
        if (!el) return;
        const list = unsyncedRecords();
        if (!list.length) { el.style.display = "none"; el.innerHTML = ""; return; }
        const failed = list.filter(r => r._sync === "failed").length;
        const busy = list.length - failed;
        let msg;
        if (failed && busy) msg = failed + " upload" + (failed > 1 ? "s" : "") + " failed to save and " + busy + " still saving to the backend";
        else if (failed)    msg = failed + " upload" + (failed > 1 ? "s" : "") + " did NOT save to the backend";
        else                msg = busy + " upload" + (busy > 1 ? "s" : "") + " still saving to the backend";
        const tail = failed
            ? " — open the Upload tab to Retry, or they will be lost if you leave."
            : " — keep this tab open until it finishes.";
        el.className = "gr-banner " + (failed ? "gr-banner--fail" : "gr-banner--busy");
        el.innerHTML =
            '<span class="gr-banner-ic">⚠</span>' +
            '<span class="gr-banner-msg">' + escHtml(msg + tail) + '</span>' +
            '<button type="button" class="gr-banner-btn" data-act="gotoUpload">View</button>';
        el.style.display = "flex";
    }

    // Re-render everything that's currently on screen.
    function rerenderAll() {
        renderSyncBanner();
        renderMyUploads();
        const active = document.querySelector("#grPage .gr-tab.active");
        if (!active) return;
        if (active.dataset.tab === "detailed") renderDetailed();
        if (active.dataset.tab === "summary") renderSummary();
        if (active.dataset.tab === "analytics") renderAnalytics();
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
        ).sort((a, b) => cmpStr(b.uploadTimestamp, a.uploadTimestamp));
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
            setEmptyBody("grMyBody", 11, "📂", "You haven't uploaded any GRs / Circulars yet. Click “+ Add New GR / Circular” to get started.");
            return;
        }
        if (!shown.length) {
            setEmptyBody("grMyBody", 11, "📭", "No uploads match the current filters.");
            return;
        }

        const wrap = tableWrap("upload");
        const prevTop = wrap ? wrap.scrollTop : 0;
        const keep = Math.max(ROW_PAGE, myShown);   // keep what the user already scrolled through

        myRows = shown;
        myShown = 0;
        body.innerHTML = "";
        wireMyRowActions();
        wireLazyScroll("upload");
        appendMyRows(keep);
        restoreScroll(wrap, prevTop);
    }

    function appendMyRows(count) {
        const body = document.getElementById("grMyBody");
        if (!body) return;
        const next = myRows.slice(myShown, myShown + (count || ROW_PAGE));
        if (!next.length) return;
        body.insertAdjacentHTML("beforeend",
            next.map((r, i) => myRowHtml(r, myShown + i + 1)).join(""));
        myShown += next.length;
    }

    // One delegated listener per table instead of one per button — rows
    // are appended in windows, so per-row wiring would stack duplicates.
    function wireMyRowActions() {
        const body = document.getElementById("grMyBody");
        if (!body || body.dataset.wired === "1") return;
        body.dataset.wired = "1";
        body.addEventListener("click", (e) => {
            const btn = e.target.closest("button[data-act]");
            if (!btn) return;
            const act = btn.dataset.act;
            if (act === "retry") performUpload(btn.dataset.id);
            else if (act === "discard") discardFailedUpload(btn.dataset.id);
            else if (act === "remark") openDescModal(btn.dataset.desc || "", "Validator remark");
            else if (act === "why") openDescModal(btn.dataset.desc || "Upload failed", "Why the upload failed");
        });
    }

    /* Writing scrollTop straight after an insert forces a synchronous
       layout and blocks the frame. When there is nothing to restore
       (the common case - the list is at the top) skip it entirely,
       otherwise let the browser lay out first and restore on the next
       frame. */
    function restoreScroll(wrap, top) {
        if (!wrap || !top) return;
        requestAnimationFrame(() => { wrap.scrollTop = top; });
    }

    function tableWrap(panel) {
        return document.querySelector(`#grPage .gr-panel[data-panel="${panel}"] .gr-table-wrap`);
    }

    // Adds the next window of rows as the user nears the bottom.
    function wireLazyScroll(panel) {
        const wrap = tableWrap(panel);
        if (!wrap || wrap.dataset.lazy === "1") return;
        wrap.dataset.lazy = "1";
        wrap.addEventListener("scroll", () => {
            if (wrap.scrollTop + wrap.clientHeight < wrap.scrollHeight - 260) return;
            if (panel === "detailed") appendDetailedRows(); else appendMyRows();
        });
    }

    function myRowHtml(r, sr) {
        let fileCell;
        if (r._sync === "uploading") {
            fileCell = `<span class="gr-sync gr-sync--busy">⏳ Uploading…</span>`;
        } else if (r._sync === "failed") {
            fileCell = `<button type="button" class="gr-sync gr-sync--fail" data-act="why" data-desc="${escHtml(r._syncError || "Upload failed")}" title="Tap to see why" style="font:inherit;font-size:11px;font-weight:700;border:0;cursor:pointer;">⚠ Failed</button>`;
        } else if (r.fileUrl) {
            fileCell = `<a href="${escHtml(r.fileUrl)}" target="_blank" rel="noopener" class="gr-file-link gr-file-icon" title="Open file">📄</a>`;
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
            <td>${typeCell(r.type)}</td>
            <td class="gr-td-title">${escHtml(r.title)}</td>
            <td class="gr-td-date">${fmtDate(r.docDate)}</td>
            <td>${escHtml(r.district)}</td>
            <td>${stateCell(r.state)}</td>
            <td>${fileCell}</td>
            <td>${statusChip(r.status)}</td>
            <td class="gr-td-icon">${remarkCell(r, false)}</td>
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
            if (av && bv) return cmpStr(b.validatedTimestamp, a.validatedTimestamp);
            if (av !== bv) return av ? -1 : 1;
            return cmpStr(b.docDate, a.docDate);
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
            setEmptyBody("grDetailedBody", 13, "📭", "No GRs / Circulars found for this selection.");
            return;
        }

        const wrap = tableWrap("detailed");
        const prevTop = wrap ? wrap.scrollTop : 0;
        const keep = Math.max(ROW_PAGE, dashShown);

        dashRows = rows;
        dashShown = 0;
        body.innerHTML = "";
        wireRowActions();
        wireLazyScroll("detailed");
        appendDetailedRows(keep);
        restoreScroll(wrap, prevTop);
    }

    function appendDetailedRows(count) {
        const body = document.getElementById("grDetailedBody");
        if (!body) return;
        const next = dashRows.slice(dashShown, dashShown + (count || ROW_PAGE));
        if (!next.length) return;
        body.insertAdjacentHTML("beforeend",
            next.map((r, i) => detailedRowHtml(r, dashShown + i + 1)).join(""));
        dashShown += next.length;
    }

    function statusChip(status) {
        const s = (status || "Pending").toLowerCase();
        if (s === "validated") return `<span class="gr-chip gr-chip--ok gr-chip--icon" title="Validated">✔</span>`;
        if (s === "rejected") return `<span class="gr-chip gr-chip--rej gr-chip--icon" title="Rejected">✕</span>`;
        return `<span class="gr-chip gr-chip--pend gr-chip--icon" title="Pending">●</span>`;
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
            actionCell = `<span class="gr-locked gr-locked--icon" title="Locked">🔒</span>`;
        } else if (s === "rejected") {
            // A rejected record can still be validated later.
            actionCell = `
                <div class="gr-row-actions">
                    <button class="gr-btn-ok gr-btn-icon" data-act="validate" data-id="${escHtml(r.recordId)}" title="Validate">✔</button>
                </div>`;
        } else {
            actionCell = `
                <div class="gr-row-actions">
                    <button class="gr-btn-ok gr-btn-icon" data-act="validate" data-id="${escHtml(r.recordId)}" title="Validate">✔</button>
                    <button class="gr-btn-rej gr-btn-icon" data-act="reject" data-id="${escHtml(r.recordId)}" title="Reject">✕</button>
                </div>`;
        }

        let fileCell;
        if (r._sync === "uploading") fileCell = `<span class="gr-sync gr-sync--busy">⏳</span>`;
        else if (r._sync === "failed") fileCell = `<span class="gr-sync gr-sync--fail">⚠</span>`;
        else fileCell = r.fileUrl
            ? `<a href="${escHtml(r.fileUrl)}" target="_blank" rel="noopener" class="gr-file-link gr-file-icon" title="Open file">📄</a>`
            : "—";

        return `
        <tr>
            <td>${sr}</td>
            <td>${typeCell(r.type)}</td>
            <td class="gr-td-title">${escHtml(r.title)}</td>
            <td class="gr-td-icon">${r.description ? `<button type="button" class="gr-desc-btn" data-act="desc" data-desc="${escHtml(r.description)}" title="View description">📄</button>` : `<span class="gr-muted">—</span>`}</td>
            <td class="gr-td-date">${fmtDate(r.docDate)}</td>
            <td>${escHtml(r.district)}</td>
            <td>${stateCell(r.state)}</td>
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
            <td class="gr-td-icon">${remarkCell(r, user.isValidator && !syncing)}</td>
            <td>${actionCell}</td>
        </tr>`;
    }

    function wireRowActions() {
        const body = document.getElementById("grDetailedBody");
        if (!body || body.dataset.wired === "1") return;
        body.dataset.wired = "1";
        body.addEventListener("click", (e) => {
            const btn = e.target.closest("button[data-act]");
            if (!btn) return;
            const act = btn.dataset.act;
            if (act === "desc") {
                openDescModal(btn.dataset.desc || "", "Description");
            } else if (act === "remark") {
                openDescModal(btn.dataset.desc || "", "Validator remark");
            } else if (act === "remark-edit") {
                editRemark(btn.dataset.id);
            } else {
                handleValidation(act, btn.dataset.id);
            }
        });
    }

    // Description popup. The modal is created in JS the first time it's needed, so it works even if
    // the page HTML wasn't refreshed — it only relies on the pre-existing .gr-modal-* styles.
    function ensureDescModal() {
        let overlay = document.getElementById("grDescModalOverlay");
        if (overlay) return overlay;
        overlay = document.createElement("div");
        overlay.className = "gr-modal-overlay";
        overlay.id = "grDescModalOverlay";
        // Static markup only (no user data) — the description text is injected later via textContent.
        overlay.innerHTML =
            '<div class="gr-modal-box" role="dialog" aria-modal="true" style="width:560px">' +
            '<div class="gr-modal-header"><div><h2 id="grDescHeading">Description</h2></div>' +
            '<button class="gr-modal-close" id="grDescCloseX" type="button">\u2715</button></div>' +
            '<div class="gr-modal-body"><p id="grDescText" style="font-size:14px;line-height:1.6;color:#1f2937;white-space:pre-wrap;word-break:break-word;margin:0;"></p></div>' +
            '</div>';
        (document.getElementById("grPage") || document.body).appendChild(overlay);
        overlay.querySelector("#grDescCloseX").addEventListener("click", closeDescModal);
        overlay.addEventListener("click", (e) => { if (e.target === overlay) closeDescModal(); });
        return overlay;
    }
    // content set via textContent (never innerHTML) so it's safe for any text.
    function openDescModal(text, heading) {
        const overlay = ensureDescModal();
        const head = overlay.querySelector("#grDescHeading");
        if (head) head.textContent = heading || "Description";
        const body = overlay.querySelector("#grDescText");
        if (body) body.textContent = (text == null || text === "") ? "—" : text;
        overlay.classList.add("open");
    }
    function closeDescModal() {
        const overlay = document.getElementById("grDescModalOverlay");
        if (overlay) overlay.classList.remove("open");
    }

    /* ====================================================
       REMARK PROMPT
       There is no prompt-with-input helper in app.js, so this is a
       small confirm dialog with a textarea. Resolves to the remark
       string (possibly "") on confirm, or null when cancelled.
    ==================================================== */
    function ensureRemarkModal() {
        let overlay = document.getElementById("grRemarkOverlay");
        if (overlay) return overlay;
        overlay = document.createElement("div");
        overlay.className = "gr-modal-overlay";
        overlay.id = "grRemarkOverlay";
        // Static markup only — all text is set later via textContent.
        overlay.innerHTML =
            '<div class="gr-modal-box gr-modal-box--sm" role="dialog" aria-modal="true">' +
            '<div class="gr-modal-header"><div><h2 id="grRemarkTitle"></h2>' +
            '<p id="grRemarkMsg"></p></div>' +
            '<button class="gr-modal-close" id="grRemarkCloseX" type="button">✕</button></div>' +
            '<div class="gr-modal-body"><div class="gr-field">' +
            '<label for="grRemarkText">Remark <span class="gr-muted">(optional)</span></label>' +
            '<textarea id="grRemarkText" placeholder="Add a note for the person who uploaded this…"></textarea>' +
            '</div></div>' +
            '<div class="gr-modal-footer">' +
            '<button class="gr-btn-secondary" id="grRemarkCancel" type="button">Cancel</button>' +
            '<button class="gr-btn-primary" id="grRemarkOk" type="button"></button>' +
            '</div></div>';
        (document.getElementById("grPage") || document.body).appendChild(overlay);
        return overlay;
    }

    function askRemark(opts) {
        return new Promise(resolve => {
            const overlay = ensureRemarkModal();
            overlay.querySelector("#grRemarkTitle").textContent = opts.title || "Please confirm";
            overlay.querySelector("#grRemarkMsg").textContent = opts.message || "";
            const ta = overlay.querySelector("#grRemarkText");
            ta.value = opts.value || "";
            const okBtn = overlay.querySelector("#grRemarkOk");
            okBtn.textContent = opts.confirmText || "Confirm";
            okBtn.classList.toggle("gr-btn-danger", !!opts.danger);
            overlay.classList.add("open");
            setTimeout(() => ta.focus(), 60);

            let done = false;
            const finish = (val) => {
                if (done) return;
                done = true;
                overlay.classList.remove("open");
                document.removeEventListener("keydown", onKey);
                resolve(val);
            };
            const onKey = (e) => { if (e.key === "Escape") finish(null); };
            // Assigned (not added) so repeat opens never stack listeners.
            okBtn.onclick = () => finish(ta.value.trim());
            overlay.querySelector("#grRemarkCancel").onclick = () => finish(null);
            overlay.querySelector("#grRemarkCloseX").onclick = () => finish(null);
            overlay.onclick = (e) => { if (e.target === overlay) finish(null); };
            document.addEventListener("keydown", onKey);
        });
    }

    /* ====================================================
       EDIT A REMARK ON ITS OWN
       Separate from validate / reject so a validator can add or
       correct a remark at any time — including on a validated row,
       which stays locked for status changes.
    ==================================================== */
    async function editRemark(recordId) {
        if (!user.isValidator) {
            appAlert({ title: "Not allowed", type: "error", message: "Only validators can add remarks." });
            return;
        }
        const idx = allRecords.findIndex(r => String(r.recordId) === String(recordId));
        if (idx < 0) return;
        const rec = allRecords[idx];
        if (isLocal(rec) || rec._sync === "uploading" || rec._sync === "failed") {
            appAlert({
                title: "Not synced yet",
                type: "warning",
                message: "This record hasn't reached the server yet. Add the remark once the upload finishes."
            });
            return;
        }

        const next = await askRemark({
            title: "Validator remark",
            message: "Visible to the person who uploaded this GR / Circular.",
            confirmText: "Save remark",
            value: rec.validatorRemark || ""
        });
        if (next === null) return;                                  // cancelled
        if (next === String(rec.validatorRemark || "")) return;     // unchanged

        const prev = { ...rec };
        allRecords[idx] = { ...rec, validatorRemark: next, _sync: "saving" };
        rerenderAll();

        try {
            const data = await api({
                action: "remark",
                recordId,
                remark: next,
                validatedBy: user.email,
                validatedByName: user.displayName
            });
            if (data.version) dataVersion = String(data.version);
            const i2 = allRecords.findIndex(r => String(r.recordId) === String(recordId));
            if (i2 >= 0) allRecords[i2] = data.record ? data.record : { ...allRecords[i2], _sync: "" };
            persistLocal();
            notify("Remark saved ✓", "success");
        } catch (err) {
            console.error(err);
            const i2 = allRecords.findIndex(r => String(r.recordId) === String(recordId));
            if (i2 >= 0) allRecords[i2] = prev;   // put the old remark back
            notify(err.message, "error");
        }
        rerenderAll();
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
        const remark = await askRemark({
            title: isReject ? "Reject this record?" : "Mark as validated?",
            message: isReject
                ? "This marks the record as not validated on the Vinoba app. Add a remark so the person who uploaded it knows why."
                : "Confirm this GR / Circular is validated and uploaded on the Vinoba app. Once validated, the record is locked and cannot be changed.",
            confirmText: isReject ? "Reject" : "Validate",
            danger: isReject
        });
        if (remark === null) return;   // cancelled

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
            validatorRemark: remark,
            _sync: "saving"
        };
        rerenderAll();

        try {
            const data = await api({
                action: isReject ? "reject" : "validate",
                recordId,
                validatedBy: user.email,
                validatedByName: user.displayName,
                remark
            });
            if (data.version) dataVersion = String(data.version);
            const i2 = allRecords.findIndex(r => String(r.recordId) === String(recordId));
            if (i2 >= 0) {
                allRecords[i2] = data.record ? data.record : { ...allRecords[i2], _sync: "" };
            }
            persistLocal();
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
    /* Status palette, used by both the cards and the bars so a colour
       always means the same thing:
         blue  = the whole pile          green = signed off
         amber = still waiting           red   = sent back
       Amber and red are the conventional warning/error pair already used
       by the status chips elsewhere on this page. */
    const GR_C = {
        total:          "#4f8ef7",
        validated:      "#16a34a",
        validatedOther: "#8fce9f",
        pending:        "#f59e0b",
        rejected:       "#dc2626"
    };

    // Most bar groups we can show side by side and still read them.
    const SUM_MAX = 6;
    let sumStates = [];      // [] = all communities, combined into one group
    let sumDistricts = [];   // [] = every district of the chosen communities

    function wireSummaryFilters() {
        const stateWrap = document.getElementById("grSumStateMS");
        const distWrap = document.getElementById("grSumDistrictMS");
        if (!stateWrap || !distWrap) return;

        buildMultiSelect(stateWrap, {
            allLabel: "All Communities",
            options: () => Object.keys(STATE_LABELS).map(c => ({ value: c, label: STATE_LABELS[c] })),
            selected: () => sumStates,
            onApply: (vals) => {
                sumStates = vals;
                // Districts only make sense inside a single community: with
                // none or several picked the bars are grouped by community,
                // so the district filter switches off and resets.
                if (sumStates.length === 1) {
                    const allowed = new Set(districtsForStates(sumStates));
                    sumDistricts = sumDistricts.filter(d => allowed.has(d));
                } else {
                    sumDistricts = [];
                }
                renderMultiSelect(distWrap);
                renderSummary();
            }
        });

        buildMultiSelect(distWrap, {
            allLabel: "All Districts",
            options: () => districtsForStates(sumStates).map(d => ({ value: d, label: d })),
            selected: () => sumDistricts,
            disabled: () => sumStates.length !== 1,
            disabledLabel: () => sumStates.length > 1
                ? "Grouped by community"
                : "Select one community first",
            onApply: (vals) => { sumDistricts = vals; renderSummary(); }
        });

        const monthSel = document.getElementById("grSumMonth");
        if (monthSel) monthSel.addEventListener("change", renderSummary);
        const validatorSel = document.getElementById("grSumValidator");
        if (validatorSel) validatorSel.addEventListener("change", renderSummary);
        const clearBtn = document.getElementById("grSumClear");
        if (clearBtn) clearBtn.addEventListener("click", clearSummaryFilters);
    }

    // Reset every Summary filter back to its default.
    function clearSummaryFilters() {
        sumStates = [];
        sumDistricts = [];
        const monthSel = document.getElementById("grSumMonth");
        if (monthSel) { monthSel.value = ""; monthSel.dataset.touched = ""; }
        const validatorSel = document.getElementById("grSumValidator");
        if (validatorSel) validatorSel.value = "";
        closeAllMultiSelects();
        renderMultiSelect(document.getElementById("grSumStateMS"));
        renderMultiSelect(document.getElementById("grSumDistrictMS"));
        renderSummary();
    }

    // Districts available for the current community selection (all of them
    // when nothing is selected), de-duplicated and sorted.
    function districtsForStates(states) {
        const codes = states.length ? states : Object.keys(STATE_DISTRICTS);
        const out = [];
        codes.forEach(c => (STATE_DISTRICTS[c] || []).forEach(d => {
            if (out.indexOf(d) < 0) out.push(d);
        }));
        return out.sort();
    }

    /* ====================================================
       CHECKBOX MULTI-SELECT (button + dropdown + Apply)
       Nothing checked means "all", combined into one group.
    ==================================================== */
    const msConfig = new WeakMap();

    function buildMultiSelect(wrap, cfg) {
        msConfig.set(wrap, cfg);
        wrap.innerHTML =
            '<button type="button" class="gr-ms-btn"><span class="gr-ms-label"></span>' +
            '<span class="gr-ms-caret">\u25be</span></button>' +
            '<div class="gr-ms-panel"><div class="gr-ms-list"></div>' +
            '<div class="gr-ms-foot"><span class="gr-ms-hint"></span>' +
            '<span class="gr-ms-foot-btns">' +
            '<button type="button" class="gr-ms-clear">Clear</button>' +
            '<button type="button" class="gr-ms-apply">Apply</button>' +
            '</span></div></div>';

        wrap.querySelector(".gr-ms-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            if (wrap.classList.contains("gr-ms--off")) return;
            const wasOpen = wrap.classList.contains("open");
            closeAllMultiSelects();
            if (!wasOpen) {
                renderMultiSelect(wrap);   // repaint from live state before showing
                wrap.classList.add("open");
            }
        });
        // Clicks inside the panel must not bubble to the document closer.
        wrap.querySelector(".gr-ms-panel").addEventListener("click", (e) => e.stopPropagation());
        wrap.querySelector(".gr-ms-apply").addEventListener("click", () => {
            // "Select All" ticked means everything, combined into one group,
            // which is exactly what an empty selection already represents.
            const all = wrap.querySelector(".gr-ms-allbox");
            const vals = (all && all.checked)
                ? []
                : Array.from(wrap.querySelectorAll(".gr-ms-opt:not(.gr-ms-all) input:checked")).map(i => i.value);
            wrap.classList.remove("open");
            const c = msConfig.get(wrap);
            if (c) c.onApply(vals);
            renderMultiSelect(wrap);
        });
        // Clear = back to "everything, combined", applied straight away.
        wrap.querySelector(".gr-ms-clear").addEventListener("click", () => {
            wrap.classList.remove("open");
            const c = msConfig.get(wrap);
            if (c) c.onApply([]);
            renderMultiSelect(wrap);
        });

        if (!document.body.dataset.grMsWired) {
            document.body.dataset.grMsWired = "1";
            document.addEventListener("click", closeAllMultiSelects);
        }
        renderMultiSelect(wrap);
    }

    function closeAllMultiSelects() {
        document.querySelectorAll("#grPage .gr-ms.open").forEach(w => w.classList.remove("open"));
    }

    function renderMultiSelect(wrap) {
        const cfg = msConfig.get(wrap);
        if (!cfg) return;
        const opts = cfg.options();
        const sel = cfg.selected();
        const off = typeof cfg.disabled === "function" && cfg.disabled();

        const btn = wrap.querySelector(".gr-ms-btn");
        wrap.classList.toggle("gr-ms--off", !!off);
        if (off) wrap.classList.remove("open");
        if (btn) btn.disabled = !!off;

        const labelEl = wrap.querySelector(".gr-ms-label");
        if (labelEl) {
            const first = opts.filter(o => o.value === sel[0])[0];
            labelEl.textContent = off
                ? (typeof cfg.disabledLabel === "function" ? cfg.disabledLabel() : cfg.allLabel)
                : (!sel.length
                    ? cfg.allLabel
                    : (sel.length === 1 ? (first ? first.label : sel[0]) : sel.length + " selected"));
        }
        if (off) return;   // nothing to paint inside a closed, disabled control

        const list = wrap.querySelector(".gr-ms-list");
        if (!list) return;
        const allTicked = !sel.length;
        list.innerHTML = opts.length
            ? ('<label class="gr-ms-opt gr-ms-all"><input type="checkbox" class="gr-ms-allbox"' +
               (allTicked ? " checked" : "") + '><span>Select All</span></label><div class="gr-ms-sep"></div>' +
               opts.map(o =>
                   '<label class="gr-ms-opt"><input type="checkbox" value="' + escHtml(o.value) + '"' +
                   (allTicked || sel.indexOf(o.value) >= 0 ? " checked" : "") + '><span>' + escHtml(o.label) + '</span></label>'
               ).join(""))
            : '<div class="gr-ms-none">No options</div>';

        const hint = wrap.querySelector(".gr-ms-hint");
        const allBox = list.querySelector(".gr-ms-allbox");
        const boxes = Array.from(list.querySelectorAll(".gr-ms-opt:not(.gr-ms-all) input"));

        // With "Select All" ticked the individual rows are shown ticked but
        // locked. Otherwise they are free until SUM_MAX of them are ticked,
        // so the chart never gets more groups than it can render legibly.
        const cap = (typeof cfg.max === "number") ? cfg.max : SUM_MAX;
        const sync = () => {
            const all = !!(allBox && allBox.checked);
            const n = boxes.filter(b => b.checked).length;
            boxes.forEach(b => { b.disabled = all || (!b.checked && n >= cap); });
            if (hint) {
                hint.textContent = all
                    ? "All, combined into one group"
                    : (n >= cap ? "Maximum " + cap + " at a time"
                                    : (n ? n + " selected" : "Nothing ticked = all, combined"));
            }
        };
        if (allBox) {
            allBox.addEventListener("change", () => {
                // Ticking "Select All" shows every row ticked; unticking it
                // hands control back with a clean slate.
                boxes.forEach(b => { b.checked = allBox.checked; });
                sync();
            });
        }
        boxes.forEach(b => b.addEventListener("change", () => {
            if (allBox) allBox.checked = false;
            sync();
        }));
        sync();
    }


    // What each bar group represents: the chosen districts if any, else the
    // chosen communities, else everything rolled into a single group.
    function summaryGroups() {
        if (sumDistricts.length) {
            return sumDistricts.slice(0, SUM_MAX).map(d => ({
                label: d,
                match: r => r.district === d && (!sumStates.length || sumStates.indexOf(r.state) >= 0)
            }));
        }
        if (sumStates.length) {
            return sumStates.slice(0, SUM_MAX).map(c => ({
                label: STATE_LABELS[c] || c,
                match: r => r.state === c
            }));
        }
        return [{ label: "All communities", match: () => true }];
    }

    function renderSummary() {
        const wrap = document.getElementById("grSummaryWrap");
        if (!wrap) return;

        const monthSel = document.getElementById("grSumMonth");
        const month = monthSel ? monthSel.value : "";   // "" = all months
        const validatorSel = document.getElementById("grSumValidator");
        const validator = validatorSel ? validatorSel.value.toLowerCase() : "";

        const pool = allRecords.filter(r => !month || monthKeyFromDate(r.docDate) === month);
        const groups = summaryGroups();

        let totalUp = 0, totalVal = 0, totalPend = 0, totalRej = 0;
        let validatorValCount = 0;   // validated by the selected validator only

        const data = groups.map(g => {
            const rows = pool.filter(g.match);
            // val  = validated by the selected validator (or by anyone when
            //        no validator is picked)
            // vOth = validated by someone else, so the bar still adds up to
            //        the total when a validator is selected
            const blank = () => ({ up: 0, val: 0, vOth: 0, pend: 0, rej: 0 });
            const stat = { GR: blank(), Circular: blank() };
            rows.forEach(r => {
                const key = isGrType(r.type) ? "GR" : "Circular";
                const status = String(r.status || "").toLowerCase();
                stat[key].up += 1;
                if (status === "validated") {
                    totalVal += 1;
                    const mine = String(r.validatedBy || "").toLowerCase() === validator;
                    if (!validator || mine) stat[key].val += 1;
                    else stat[key].vOth += 1;
                    if (validator && mine) validatorValCount += 1;
                } else if (status === "rejected") {
                    stat[key].rej += 1;
                    totalRej += 1;
                } else {
                    stat[key].pend += 1;   // "Pending", blank, anything else
                    totalPend += 1;
                }
            });
            totalUp += rows.length;
            return { label: g.label, stat };
        });

        // Pending and Rejected are now their own cards, and the four numbers
        // always reconcile: validated + pending + rejected = total uploaded.
        const cardsHtml = `
            ${sumCard("Total uploaded", totalUp, GR_C.total)}
            ${sumCard("Validated", totalVal, GR_C.validated,
                      validator ? `${escHtml(validator)}: ${validatorValCount}` : "")}
            ${sumCard("Pending", totalPend, GR_C.pending)}
            ${sumCard("Rejected", totalRej, GR_C.rejected)}`;

        const periodLabel = month ? monthLabel(month) : "All months";

        wrap.innerHTML = `
            <div class="gr-sum-cards">
                ${cardsHtml}
            </div>
            <div class="gr-chart-card">
                <div class="gr-chart-title">Status breakdown — ${escHtml(periodLabel)}</div>
                ${stackedChartHtml(data, !!validator)}
                <div class="gr-legend">
                    <span><i class="gr-swatch" style="background:${GR_C.validated}"></i>Validated${validator ? ` by ${escHtml(validator)}` : ""}</span>
                    ${validator ? `<span><i class="gr-swatch" style="background:${GR_C.validatedOther}"></i>Validated by others</span>` : ""}
                    <span><i class="gr-swatch" style="background:${GR_C.pending}"></i>Pending</span>
                    <span><i class="gr-swatch" style="background:${GR_C.rejected}"></i>Rejected</span>
                </div>
            </div>`;
    }


    function sumCard(label, value, color, sub) {
        return `
            <div class="gr-sum-card">
                <div class="gr-sum-val" style="color:${color}">${value}</div>
                <div class="gr-sum-label">${escHtml(label)}</div>
                ${sub ? `<div class="gr-sum-sub">${sub}</div>` : ""}
            </div>`;
    }

    // One bar per type per group. The full bar is everything uploaded; the
    // green block filling it from the bottom is the validated share. The
    // total sits above the bar, the validated count inside the green block
    // (dropped when the block is too short for the text to fit).
    // Smallest segment that can hold a number legibly; anything shorter
    // gets its number printed beside the bar instead of inside it.
    const SEG_MIN_LABEL = 15;

    function stackedChartHtml(data, hasValidator) {
        const H = 170;
        let max = 1;
        data.forEach(d => { max = Math.max(max, d.stat.GR.up, d.stat.Circular.up); });

        const bar = (short, name, d) => {
            const upH = Math.max(4, Math.round((d.up / max) * H));

            // Build the stack bottom-up. Heights are apportioned by running
            // total so rounding can never make the segments overflow the bar.
            const parts = [
                { key: "val",  n: d.val,  color: GR_C.validated,      word: "validated" },
                { key: "vOth", n: d.vOth, color: GR_C.validatedOther, word: "validated by others" },
                { key: "pend", n: d.pend, color: GR_C.pending,        word: "pending" },
                { key: "rej",  n: d.rej,  color: GR_C.rejected,       word: "rejected" }
            ].filter(p => p.n > 0);

            let acc = 0, used = 0;
            const segs = parts.map(p => {
                acc += p.n;
                const edge = d.up ? Math.round((acc / d.up) * upH) : 0;
                const h = Math.max(0, edge - used);
                const seg = { ...p, h, bottom: used };   // bottom = offset from bar base
                used = edge;
                return seg;
            });

            const inside = segs.filter(s => s.h >= SEG_MIN_LABEL);
            const outside = segs.filter(s => s.h < SEG_MIN_LABEL);

            // Anchor each overflow number beside its own segment rather than
            // in a pile at the base, then nudge them apart so two adjacent
            // thin segments can't print on top of each other.
            const OUT_GAP = 15;   // chip is ~12px tall, so this clears it
            let lastY = -Infinity;
            outside.forEach(s => {
                let y = s.bottom + (s.h / 2) - 6;
                if (y < lastY + OUT_GAP) y = lastY + OUT_GAP;
                s.y = Math.max(0, Math.round(y));
                lastY = s.y;
            });

            const tip = `${name} — ${d.up} uploaded` +
                        segs.map(s => `, ${s.n} ${s.word}`).join("");

            return `
                <div class="gr-bar-col" title="${escHtml(tip)}">
                    <div class="gr-bar-num">${d.up}</div>
                    <div class="gr-bar-slot">
                        <div class="gr-bar gr-bar--stack" style="height:${upH}px">
                            ${segs.map(s => `
                                <div class="gr-seg" style="height:${s.h}px;background:${s.color}">
                                    ${inside.indexOf(s) >= 0 ? `<span class="gr-seg-num">${s.n}</span>` : ""}
                                </div>`).join("")}
                        </div>
                        ${outside.map(s => `
                            <span class="gr-out-num" style="bottom:${s.y}px;color:${s.color}">${s.n}</span>`).join("")}
                    </div>
                    <div class="gr-bar-label">${escHtml(short)}</div>
                </div>`;
        };

        return `
            <div class="gr-chart">
                ${data.map(g => `
                    <div class="gr-group">
                        <div class="gr-bars">${bar("G", "GRs", g.stat.GR)}${bar("C", "Circulars", g.stat.Circular)}</div>
                        <div class="gr-group-label" title="${escHtml(g.label)}">${escHtml(g.label)}</div>
                    </div>`).join("")}
            </div>`;
    }


    /* ====================================================
       ANALYTICS TAB
       District x (GR / Circular) matrix. Every operational
       district gets a row, even at zero. Rows sort by total
       uploads (most first); zero-upload districts sink to the
       bottom in red. Community & district multi-selects reuse
       the shared control; both default to "all".
    ==================================================== */
    let anStates = [];      // [] = all communities
    let anDistricts = [];   // [] = all districts of the chosen communities

    // Master districts for the chosen communities (all when none chosen),
    // de-duplicated and alpha-sorted for the filter dropdown.
    function analyticsDistrictsForStates(states) {
        const codes = states.length ? states : Object.keys(ANALYTICS_DISTRICTS);
        const out = [];
        codes.forEach(c => (ANALYTICS_DISTRICTS[c] || []).forEach(d => {
            if (out.indexOf(d) < 0) out.push(d);
        }));
        return out.sort(cmpStr);
    }

    function wireAnalyticsFilters() {
        const commWrap = document.getElementById("grAnCommMS");
        const distWrap = document.getElementById("grAnDistrictMS");
        if (!commWrap || !distWrap) return;

        buildMultiSelect(commWrap, {
            allLabel: "All Communities",
            max: Infinity,
            options: () => Object.keys(STATE_LABELS).map(c => ({ value: c, label: STATE_LABELS[c] })),
            selected: () => anStates,
            onApply: (vals) => {
                anStates = vals;
                // Keep only districts that still belong to the chosen
                // communities, then repaint the district control.
                const allowed = new Set(analyticsDistrictsForStates(anStates));
                anDistricts = anDistricts.filter(d => allowed.has(d));
                renderMultiSelect(distWrap);
                renderAnalytics();
            }
        });

        buildMultiSelect(distWrap, {
            allLabel: "All Districts",
            max: Infinity,
            options: () => analyticsDistrictsForStates(anStates).map(d => ({ value: d, label: d })),
            selected: () => anDistricts,
            onApply: (vals) => { anDistricts = vals; renderAnalytics(); }
        });

        const clearBtn = document.getElementById("grAnClear");
        if (clearBtn) clearBtn.addEventListener("click", clearAnalyticsFilters);
    }

    function clearAnalyticsFilters() {
        anStates = [];
        anDistricts = [];
        closeAllMultiSelects();
        renderMultiSelect(document.getElementById("grAnCommMS"));
        renderMultiSelect(document.getElementById("grAnDistrictMS"));
        renderAnalytics();
    }

    function anBlankBucket() { return { grUp: 0, grVal: 0, cUp: 0, cVal: 0 }; }
    function anAddRecord(bucket, r) {
        const validated = String(r.status || "").toLowerCase() === "validated";
        if (isGrType(r.type)) { bucket.grUp += 1; if (validated) bucket.grVal += 1; }
        else                  { bucket.cUp  += 1; if (validated) bucket.cVal  += 1; }
    }

    // A cell that dims a plain zero, greens a positive validated count,
    // and leaves uploaded counts in the default ink.
    function anNumCell(n, isVal) {
        const cls = n === 0 ? "gr-an-num gr-an-zero-num"
                            : (isVal ? "gr-an-num gr-an-val" : "gr-an-num");
        return "<td class=\"" + cls + "\">" + n + "</td>";
    }

    function renderAnalytics() {
        const body = document.getElementById("grAnBody");
        const foot = document.getElementById("grAnFoot");
        const meta = document.getElementById("grAnMeta");
        if (!body) return;

        const commCodes = anStates.length ? anStates : Object.keys(ANALYTICS_DISTRICTS);
        const commSet = new Set(commCodes);
        const distFilter = anDistricts.length ? new Set(anDistricts) : null;

        // Community-scoped key so identical district names in two
        // communities never collide. State codes never contain "::".
        const key = (state, dist) => state + "::" + dist;
        const masterKeys = new Set();
        const rows = [];
        const byKey = new Map();

        commCodes.forEach(code => {
            (ANALYTICS_DISTRICTS[code] || []).forEach(dist => {
                const k = key(code, dist);
                masterKeys.add(k);
                if (distFilter && !distFilter.has(dist)) return;
                const row = { state: code, district: dist, isExtra: false, bucket: anBlankBucket() };
                rows.push(row);
                byKey.set(k, row);
            });
        });

        // Fold in every record. Anything that does not match a master row
        // (name drift, or a district not on OLF's list) becomes its own
        // flagged "extra" row, so no upload is ever silently dropped.
        const extraByKey = new Map();
        allRecords.forEach(r => {
            const st = r.state || "";
            const dist = r.district || "";
            if (!commSet.has(st)) return;
            const k = key(st, dist);
            let row = byKey.get(k);
            if (!row) {
                if (masterKeys.has(k)) return;            // filtered-out master district
                if (distFilter && !distFilter.has(dist)) return;
                row = extraByKey.get(k);
                if (!row) {
                    row = { state: st, district: dist || "\u2014", isExtra: true, bucket: anBlankBucket() };
                    extraByKey.set(k, row);
                    rows.push(row);
                }
            }
            anAddRecord(row.bucket, r);
        });

        // Sort: most uploads first; zero-upload districts drop to the
        // bottom, alpha-sorted; ties broken by community then name.
        rows.forEach(row => { row.total = row.bucket.grUp + row.bucket.cUp; });
        rows.sort((a, b) => {
            if ((a.total === 0) !== (b.total === 0)) return a.total === 0 ? 1 : -1;
            if (b.total !== a.total) return b.total - a.total;
            const c = cmpStr(stateShort(a.state), stateShort(b.state));
            return c || cmpStr(a.district, b.district);
        });

        if (!rows.length) {
            body.innerHTML = "<tr><td colspan=\"5\" class=\"gr-empty-cell\">" +
                grEmptyHtml("\ud83d\udced", "No districts match these filters.") + "</td></tr>";
            if (foot) foot.innerHTML = "";
            if (meta) meta.textContent = "";
            return;
        }

        let rank = 0, zeroCount = 0;
        const tot = anBlankBucket();
        body.innerHTML = rows.map(row => {
            const b = row.bucket;
            tot.grUp += b.grUp; tot.grVal += b.grVal; tot.cUp += b.cUp; tot.cVal += b.cVal;
            const zero = row.total === 0;
            if (zero) zeroCount += 1;
            const rankCell = zero ? "" : "<span class=\"gr-an-rank\">" + (++rank) + "</span>";
            return "" +
                "<tr class=\"" + (zero ? "gr-an-zero" : "") + (row.isExtra ? " gr-an-extra" : "") + "\">" +
                    "<td>" + rankCell +
                        "<span class=\"gr-an-dname\">" + escHtml(row.district) + "</span>" +
                        "<div class=\"gr-an-comm\">" + escHtml(STATE_LABELS[row.state] || row.state) + "</div>" +
                    "</td>" +
                    anNumCell(b.grUp, false) +
                    anNumCell(b.grVal, true) +
                    anNumCell(b.cUp, false) +
                    anNumCell(b.cVal, true) +
                "</tr>";
        }).join("");

        if (foot) {
            foot.innerHTML =
                "<tr>" +
                    "<td>Total \u00b7 " + rows.length + " districts</td>" +
                    "<td>" + tot.grUp + "</td>" +
                    "<td>" + tot.grVal + "</td>" +
                    "<td>" + tot.cUp + "</td>" +
                    "<td>" + tot.cVal + "</td>" +
                "</tr>";
        }

        if (meta) {
            const scope = anStates.length
                ? anStates.map(c => STATE_LABELS[c] || c).join(", ")
                : "All communities";
            const grandUp = tot.grUp + tot.cUp;
            meta.textContent = scope + " \u2014 " + rows.length + " districts, " + grandUp + " uploads" +
                (zeroCount ? ", " + zeroCount + " with none yet" : "");
        }
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