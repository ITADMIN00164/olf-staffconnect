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
       STATE → DISTRICTS  (OLF's operational districts)
       MH 27 · MH-ATC 1 · MH-MC 8 · CG 11 · BR 1 · MP 2  =  50

       These are the districts OLF actually works in, not every district
       in each state. ONE list drives both the upload dropdowns and the
       Analytics table, so a district can never be uploadable but missing
       from analytics, or listed in analytics but not uploadable.
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
            "Ahilyanagar", "Amravati", "Bhandara", "Bid", "Buldhana",
            "Chandrapur", "Dharashiv", "Gadchiroli", "Hingoli", "Jalgaon",
            "Jalna", "Latur", "Nagpur", "Nanded", "Nandurbar", "Nashik",
            "Palghar", "Pune", "Raigarh MH", "Ratnagiri", "Kolhapur",
            "Solapur", "Satara", "Thane", "Wardha", "Washim", "Yavatmal"
        ],
        MH_ATC: [
            "Nagpur - ATC"
        ],
        MH_MC: [
            "Amravati - MC", "KDMC", "Pune MC", "PCMC", "Sangli - MC",
            "Mumbai Suburban", "Nagpur - MC", "Nashik - MC"
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
       RETIRED DISTRICT NAMES
       Records already in the sheet may carry a name the upload form no
       longer offers — either an older spelling or a district that has
       since been renamed. Those uploads are real, so they are MERGED into
       the correct district rather than shown as a separate row: the table
       stays at exactly the master 50 and the counts stay complete.

       Keyed by community, because the same word can mean different
       districts in different states — Chhattisgarh has "Raigarh" while
       Maharashtra has "Raigarh MH", and those must never be conflated.
    ==================================================== */
    const RETIRED_DISTRICT_NAMES = {
        MH: {
            "Beed": "Bid",                 // earlier spelling
            "Raigad": "Raigarh MH",        // earlier spelling
            "Ahmednagar": "Ahilyanagar",   // renamed district
            "Osmanabad": "Dharashiv"       // renamed district
        },
        CG: {
            "Janjgir-Champa": "Janjgir - Champa"   // spacing differs
        }
    };

    // Districts that now sit under a different community.
    const MOVED_DISTRICTS = {
        "Mumbai Suburban": { from: "MH", to: "MH_MC" }
    };

    /**
     * Maps whatever is stored on a record to the master (state, district)
     * it belongs to. Returns the input unchanged when no rule applies.
     */
    function canonicalDistrict(state, district) {
        let st = state || "";
        let d = String(district == null ? "" : district).trim();

        const byState = RETIRED_DISTRICT_NAMES[st];
        if (byState && byState[d]) d = byState[d];

        const moved = MOVED_DISTRICTS[d];
        if (moved && st === moved.from) st = moved.to;

        return { state: st, district: d };
    }

    /* ====================================================
       ANALYTICS DISTRICT SOURCE
       The Analytics tab reads STATE_DISTRICTS above — the same list the
       upload form offers — so every district a member can pick gets a
       row, even at zero.

       A district that appears in the data but NOT in that list is still
       shown, flagged "not in upload list". That is not an error state: it
       means an older record was saved under a name the form no longer
       offers (for instance the earlier spellings Beed, Raigad or
       Janjgir-Champa), and the row in the sheet is worth correcting.
    ==================================================== */

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
       UPLOAD SIZE LIMITS
       The payload is base64, which inflates a file by a third, and it
       has to travel up a rural mobile uplink. Measured against a weak
       link (~30 KB/s) a 2 MB PDF takes about 90 s and a 5 MB one cannot
       finish inside the request timeout at all. So: 2 MB is the
       comfortable ceiling, 4 MB is the absolute one.
    ==================================================== */
    const FILE_SOFT_LIMIT = 2 * 1024 * 1024;   // above this: allowed, but warned
    const FILE_HARD_LIMIT = 4 * 1024 * 1024;   // above this: refused

    function fmtBytes(n) {
        if (!n && n !== 0) return "";
        const mb = n / (1024 * 1024);
        if (mb >= 1) return mb.toFixed(mb >= 10 ? 0 : 1) + " MB";
        return Math.max(1, Math.round(n / 1024)) + " KB";
    }

    /* ====================================================
       CAN THIS UPLOAD ACTUALLY SUCCEED?
       Asked BEFORE anything is sent. A field member on a 2G signal
       cannot push a 3 MB payload up in the time available, and finding
       that out after a three-minute wait is the worst possible outcome.
       So we measure what we can and refuse up front when it is hopeless.


       navigator.connection is available on Android Chrome (which is what
       the field team uses); on iOS it is absent, in which case we do not
       pretend to know and simply allow the attempt.
    ==================================================== */
    // Conservative real-world uplink capacity in KB/s by effective type.
    // These are the numbers that hold up on a weak rural signal, not
    // best-case tower figures — being optimistic here defeats the point.
    const UPLINK_KBPS = { "slow-2g": 8, "2g": 20, "3g": 90, "4g": 350 };
    const UPLOAD_TIMEOUT_MS = 180000;

    function connectionInfo() {
        const c = navigator.connection || navigator.mozConnection ||
                  navigator.webkitConnection || null;
        return {
            online: navigator.onLine !== false,
            effectiveType: (c && c.effectiveType) ? String(c.effectiveType) : "",
            downlink: (c && typeof c.downlink === "number") ? c.downlink : null,
            rtt: (c && typeof c.rtt === "number") ? c.rtt : null,
            saveData: !!(c && c.saveData),
            deviceMemory: (typeof navigator.deviceMemory === "number") ? navigator.deviceMemory : null,
            cores: (typeof navigator.hardwareConcurrency === "number") ? navigator.hardwareConcurrency : null
        };
    }

    function isLowEndDevice(info) {
        // <= 1 GB reported RAM, or a single/dual core CPU, is the profile of
        // the cheap handsets in the field. Such a phone is also the most
        // likely to have its browser tab evicted mid-upload.
        return (info.deviceMemory !== null && info.deviceMemory <= 1) ||
               (info.cores !== null && info.cores <= 2);
    }

    /**
     * "impossible" -> refuse, and say so plainly.
     * "slow"       -> allow, but warn it will take a while.
     * "ok" / "unknown" -> proceed quietly.
     */
    function assessUpload(sizeBytes) {
        const info = connectionInfo();
        if (!info.online) return { verdict: "impossible", reason: "offline", info };

        const kbs = UPLINK_KBPS[info.effectiveType];
        if (!kbs) {
            // No Network Information API (iOS, some desktops). Don't guess.
            return { verdict: "unknown", info };
        }
        const payloadKb = (sizeBytes * 4 / 3) / 1024;
        const secs = payloadKb / kbs;
        // Refuse anything that cannot finish inside the request window —
        // with a margin, because throughput on a weak link only gets worse.
        if (secs > (UPLOAD_TIMEOUT_MS / 1000) * 0.8) {
            return { verdict: "impossible", reason: "too-slow", secs, info };
        }
        if (secs > 45) return { verdict: "slow", secs, info };
        return { verdict: "ok", secs, info };
    }

    function connectionLabel(info) {
        const names = {
            "slow-2g": "a very slow 2G connection", "2g": "a 2G connection",
            "3g": "a 3G connection", "4g": "a 4G connection"
        };
        return names[info.effectiveType] || "your current connection";
    }

    /* ====================================================
       SERVER-SIDE VERIFICATION
       The only way to know whether a document really reached the sheet is
       to ask. Used whenever the outcome is ambiguous, so the member is
       never told 'saved' on a guess — and never told 'not saved' for
       something that actually saved (which is what creates duplicates).
       Needs Code.gs v7 or later; if the endpoint is missing we report
       'cannot confirm' rather than inventing an answer.
    ==================================================== */
    async function verifyUploadSaved(clientUploadId) {
        if (!clientUploadId) return { known: false, error: "no id" };
        try {
            const data = await api(
                { action: "checkUpload", clientUploadId },
                { timeoutMs: 30000 }
            );
            return { known: true, exists: !!data.exists, record: data.record || null };
        } catch (e) {
            return { known: false, error: (e && e.message) || "" };
        }
    }

    /* ====================================================
       ATTEMPT JOURNAL
       Written to localStorage BEFORE the upload starts, so if the phone
       kills the tab mid-upload there is still a record that the attempt
       happened. On the next visit each unsettled entry is checked against
       the server and the member is told, per document, whether it saved.
       Metadata only — a few hundred bytes, no file bytes.
    ==================================================== */
    const LS_ATTEMPTS = "olf_gr_attempts_v1";
    let orphanAttempts = [];   // attempts confirmed NOT saved, or unconfirmable

    function readAttempts() {
        try {
            const raw = localStorage.getItem(LS_ATTEMPTS);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    }
    function writeAttempts(list) {
        try { localStorage.setItem(LS_ATTEMPTS, JSON.stringify(list.slice(-40))); }
        catch (e) {}
    }
    function journalAdd(entry) {
        const list = readAttempts().filter(a => a.clientUploadId !== entry.clientUploadId);
        list.push(entry);
        writeAttempts(list);
    }
    function journalRemove(clientUploadId) {
        writeAttempts(readAttempts().filter(a => a.clientUploadId !== clientUploadId));
    }

    /**
     * Runs once per mount. Every journalled attempt that never got a
     * confirmed outcome is checked against the sheet:
     *   saved      -> drop it, the record is in the list already
     *   not saved  -> keep it and tell the member, by name, to re-upload
     *   no answer  -> keep it and say we could not confirm (do NOT re-upload
     *                 yet, or you risk a duplicate)
     */
    async function reconcileAttempts() {
        const list = readAttempts();
        if (!list.length) return;

        const stillOpen = [];
        const orphans = [];
        for (const a of list) {
            // An attempt still in flight in THIS session isn't orphaned.
            if (pendingUploads[a.localId]) { stillOpen.push(a); continue; }
            const v = await verifyUploadSaved(a.clientUploadId);
            if (v.known && v.exists) continue;                 // saved: forget it
            if (v.known) orphans.push({ ...a, state: "not-saved" });
            else         orphans.push({ ...a, state: "unconfirmed" });
            stillOpen.push(a);
        }
        writeAttempts(stillOpen);
        orphanAttempts = orphans;
        renderSyncBanner();
    }

    async function clearOrphanAttempts() {
        const confirmed = await appConfirm({
            title: "Remove this warning?",
            type: "warning",
            message: "Only do this once you have uploaded these documents again. The warning will not come back.",
            confirmText: "Remove warning",
            cancelText: "Keep it"
        });
        if (!confirmed) return;
        orphanAttempts.forEach(a => journalRemove(a.clientUploadId));
        orphanAttempts = [];
        renderSyncBanner();
    }

    /* ====================================================
       BLOCKING UPLOAD OVERLAY
       The page is blurred and unclickable from the moment Upload is
       tapped until the server has confirmed the record. This is
       deliberate: the old optimistic row looked saved immediately, and on
       a phone the member would wander off mid-upload and lose it. Now the
       only way to see a success message is for the backend to have
       actually written the row.
    ==================================================== */
    let busyTimer = null;
    let busyStartedAt = 0;
    let busyRetryId = null;   // which upload the 'Try again' button retries

    function grBusyEl(id) { return document.getElementById(id); }

    function grBusyShow(fileName, sizeBytes) {
        const ov = grBusyEl("grBusyOverlay");
        if (!ov) return;
        const isLarge = sizeBytes > FILE_SOFT_LIMIT;

        const set = (id, txt) => { const el = grBusyEl(id); if (el) el.textContent = txt; };
        const show = (id, on) => { const el = grBusyEl(id); if (el) el.style.display = on ? "" : "none"; };

        show("grBusySpin", true);
        show("grBusyIcon", false);
        show("grBusyBar", true);
        show("grBusyWarn", true);

        if (isLarge) {
            set("grBusyTitle", "Large file — uploading…");
            set("grBusyMsg", "This file is over 2 MB, so it will take longer on a mobile network. Please wait until it finishes — do not close this page.");
        } else {
            set("grBusyTitle", "Your file is being uploaded…");
            set("grBusyMsg", "Please wait. The record is saved only once the server confirms it.");
        }

        const fileEl = grBusyEl("grBusyFile");
        if (fileEl) {
            fileEl.innerHTML = "<b>" + escHtml(fileName || "file") + "</b>" +
                (sizeBytes ? " · " + escHtml(fmtBytes(sizeBytes)) : "");
        }

        const acts = grBusyEl("grBusyActions");
        if (acts) acts.classList.remove("show");

        busyStartedAt = Date.now();
        set("grBusyElapsed", "0s elapsed");
        if (busyTimer) clearInterval(busyTimer);
        busyTimer = setInterval(() => {
            const s = Math.round((Date.now() - busyStartedAt) / 1000);
            set("grBusyElapsed", s + "s elapsed");
        }, 1000);

        ov.classList.add("open");
    }

    // Progress note while the retry loop is working through attempts.
    function grBusyNote(txt) {
        const el = grBusyEl("grBusyMsg");
        if (el) el.textContent = txt;
    }

    function grBusyStopTimer() {
        if (busyTimer) { clearInterval(busyTimer); busyTimer = null; }
    }

    // Confirmed saved. This is the ONLY place a success message appears.
    function grBusySuccess() {
        grBusyStopTimer();
        const set = (id, txt) => { const el = grBusyEl(id); if (el) el.textContent = txt; };
        const show = (id, on) => { const el = grBusyEl(id); if (el) el.style.display = on ? "" : "none"; };
        show("grBusySpin", false);
        show("grBusyBar", false);
        show("grBusyWarn", false);
        const ic = grBusyEl("grBusyIcon");
        if (ic) {
            ic.className = "gr-busy-icon gr-busy-icon--ok";
            ic.textContent = "✓";
            ic.style.display = "";
        }
        set("grBusyTitle", "Upload successful");
        set("grBusyMsg", "Saved to the server and recorded. It is now visible in your uploads.");
        const secs = Math.round((Date.now() - busyStartedAt) / 1000);
        set("grBusyElapsed", "Took " + secs + "s");
        setTimeout(grBusyHide, 1600);   // let them read it, then get out of the way
    }

    // Not saved. Stays open until dismissed, so it cannot be missed.
    function grBusyFailed(reason, localId) {
        grBusyStopTimer();
        const set = (id, txt) => { const el = grBusyEl(id); if (el) el.textContent = txt; };
        const show = (id, on) => { const el = grBusyEl(id); if (el) el.style.display = on ? "" : "none"; };
        show("grBusySpin", false);
        show("grBusyBar", false);
        show("grBusyWarn", false);
        const ic = grBusyEl("grBusyIcon");
        if (ic) {
            ic.className = "gr-busy-icon gr-busy-icon--fail";
            ic.textContent = "!";
            ic.style.display = "";
        }
        set("grBusyTitle", "NOT saved — please re-upload");
        set("grBusyMsg", "This document did not reach the server, so it has NOT been saved. " + (reason || ""));
        set("grBusyElapsed", "");
        busyRetryId = localId || null;
        const acts = grBusyEl("grBusyActions");
        if (acts) acts.classList.add("show");
    }

    // Neither confirmed nor refused: the server could not be reached to
    // check. Saying either 'saved' or 'not saved' here would be a lie, and
    // a wrong 'not saved' is what makes members upload duplicates.
    function grBusyUnconfirmed(localId) {
        grBusyStopTimer();
        const set = (id, txt) => { const el = grBusyEl(id); if (el) el.textContent = txt; };
        const show = (id, on) => { const el = grBusyEl(id); if (el) el.style.display = on ? "" : "none"; };
        show("grBusySpin", false);
        show("grBusyBar", false);
        show("grBusyWarn", false);
        const ic = grBusyEl("grBusyIcon");
        if (ic) {
            ic.className = "gr-busy-icon gr-busy-icon--warn";
            ic.textContent = "?";
            ic.style.display = "";
        }
        set("grBusyTitle", "Could not confirm — do not re-upload yet");
        set("grBusyMsg", "The network dropped before we could check whether this saved. Tap Refresh Data once you have signal and look for it in your uploads. Only upload it again if it is missing — otherwise you will create a duplicate.");
        set("grBusyElapsed", "");
        busyRetryId = localId || null;
        const acts = grBusyEl("grBusyActions");
        if (acts) acts.classList.add("show");
    }

    function grBusyHide() {
        grBusyStopTimer();
        const ov = grBusyEl("grBusyOverlay");
        if (ov) ov.classList.remove("open");
        busyRetryId = null;
    }

    function wireBusyOverlay() {
        const closeBtn = grBusyEl("grBusyClose");
        const retryBtn = grBusyEl("grBusyRetry");
        if (closeBtn && !closeBtn.dataset.wired) {
            closeBtn.dataset.wired = "1";
            closeBtn.addEventListener("click", grBusyHide);
        }
        if (retryBtn && !retryBtn.dataset.wired) {
            retryBtn.dataset.wired = "1";
            retryBtn.addEventListener("click", () => {
                const id = busyRetryId;
                grBusyHide();
                if (id) performUpload(id);
            });
        }
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
            wireBusyOverlay();

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
                    if (e.target.closest('[data-act="clearOrphans"]')) {
                        clearOrphanAttempts();
                        return;
                    }
                    if (e.target.closest('[data-act="gotoUpload"]')) {
                        const t = document.querySelector('#grPage .gr-tab[data-tab="upload"]');
                        if (t) t.click();
                    }
                });
            }

            syncRecords();
            // Settle anything left unfinished by a previous visit (a killed
            // tab, a phone that went to sleep) and report it accurately.
            reconcileAttempts();
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

                // Check the size the moment it is picked, not at submit time, so
                // nobody fills in the whole form only to be refused at the end.
                const hintEl = document.getElementById("grUpFileHint");
                const setHint = (cls, txt) => {
                    if (!hintEl) return;
                    hintEl.className = "gr-file-hint gr-file-hint--" + cls;
                    hintEl.textContent = txt;
                };
                if (f && f.size > FILE_HARD_LIMIT) {
                    fileInput.value = "";
                    fileNameEl.textContent = "No file chosen";
                    pickedFile = null;
                    setHint("err", "This PDF is " + fmtBytes(f.size) + " — too large to upload (limit 4 MB). Please re-scan it in Document or Black & White mode, which usually makes it much smaller, then choose it again.");
                    appAlert({
                        title: "File is too large",
                        type: "error",
                        message: "\"" + f.name + "\" is " + fmtBytes(f.size) + ". The maximum is 4 MB.\n\nOn a mobile network a file this big will not finish uploading, so it would be lost. Please re-scan the document in Document or Black & White mode (not Colour/Photo) and choose it again — that usually brings it under 1 MB."
                    });
                    return;
                }
                // Beyond size: can this connection actually carry it?
                const pre = f ? assessUpload(f.size) : null;
                if (pre && pre.verdict === "impossible") {
                    setHint("err", pre.reason === "offline"
                        ? "You have no internet connection right now, so this cannot be uploaded. Connect first, then try again."
                        : "Upload is not possible on " + connectionLabel(pre.info) + ": a " + fmtBytes(f.size) +
                          " file would need about " + Math.round(pre.secs) + " seconds and will fail. Move to a better signal, or re-scan the document smaller.");
                } else if (f && f.size > FILE_SOFT_LIMIT) {
                    setHint("warn", "Large file (" + fmtBytes(f.size) + "). This will still upload, but it may take a minute or more on a mobile network — keep the page open until it finishes.");
                } else if (pre && pre.verdict === "slow") {
                    setHint("warn", "Your connection is slow (" + connectionLabel(pre.info) + "). This should still work but may take around " + Math.round(pre.secs) + " seconds — keep the page open.");
                } else if (f) {
                    setHint("info", "Good size (" + fmtBytes(f.size) + ").");
                } else {
                    setHint("info", "PDF up to 4 MB. Under 2 MB uploads fastest — scan in Document or Black & White mode to keep it small.");
                }

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
        // Safety net: the pick-time check above is the real gate, but never
        // let an oversized file through even if the input was set some other way.
        if (file && file.size > FILE_HARD_LIMIT) {
            errors.push("The file is " + fmtBytes(file.size) + " — the maximum is 4 MB. Please re-scan it smaller.");
        }

        if (errors.length) {
            appAlert({ title: "Please complete the form", type: "warning", list: errors });
            return;
        }

        // --- Pre-flight: is this even possible right now? -----------------
        // Refusing here is kinder than a three-minute wait that ends in
        // failure, and it stops the member believing the document is safe.
        const pre = assessUpload(file.size);
        if (pre.verdict === "impossible") {
            appAlert({
                title: "Upload is not possible right now",
                type: "error",
                message: pre.reason === "offline"
                    ? "Your device has no internet connection, so this document cannot be sent to the server.\n\nNothing has been saved. Please connect to a network and upload it again."
                    : "You are on " + connectionLabel(pre.info) + ", and a " + fmtBytes(file.size) +
                      " file needs roughly " + Math.round(pre.secs) + " seconds to upload — more than the connection will hold.\n\nNothing has been saved. Please either move to a place with better signal, or re-scan the document in Document / Black & White mode to make it smaller, then upload again."
            });
            return;
        }
        if (pre.verdict !== "ok" && isLowEndDevice(pre.info)) {
            console.warn("Low-end device on a slow link — upload may struggle.", pre.info);
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

        // Journalled BEFORE the upload starts, so that even if the phone
        // kills this tab mid-flight, the next visit can tell the member
        // exactly what happened to this document.
        journalAdd({
            clientUploadId: localId,
            localId,
            title, type, district, docDate,
            fileName: file.name,
            sizeBytes: file.size || 0,
            startedAt: new Date().toISOString()
        });

        toggleUploadForm(false);
        resetUploadForm();
        refreshMonthOptions();
        rerenderAll();

        performUpload(localId); // background, not awaited
    }

    async function performUpload(localId) {
        const p = pendingUploads[localId];
        if (!p) return;

        // Blur and lock the page for the whole attempt. Nothing else can be
        // touched until the server has either confirmed or refused.
        grBusyShow(p.file.name, p.file.size || 0);

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
                const msg = "The phone released the file while the form was open. Please choose the file again and re-upload.";
                console.error(readErr);
                setSync(localId, "failed", msg);
                grBusyFailed(msg, localId);
                notify("NOT saved — " + msg, "error");
                refreshMonthOptions();
                rerenderAll();
                return;
            }
        }

        // --- 2. Send it, retrying transient failures ----------------------
        // A phone that has been idle loses its warm connection to Google, so
        // the first attempt after a pause can fail instantly. The backoff is
        // deliberately generous: a rural link often needs several seconds to
        // come back, and a too-quick retry just fails again.
        // This cannot create a duplicate: the backend dedups on
        // clientUploadId, which is identical across every attempt.
        const MAX_TRIES = 3;
        const BACKOFF = [2000, 5000];   // after attempt 1, then after attempt 2
        let lastErr = null;
        for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
            try {
                const data = await api({
                    ...p.meta,
                    fileBase64,
                    fileName: p.file.name,
                    mimeType: p.file.type || "application/octet-stream"
                }, { timeoutMs: UPLOAD_TIMEOUT_MS });

                if (data.version) dataVersion = String(data.version);

                // A success reply WITHOUT a record is not proof of anything.
                // Claiming success here is exactly how a row could show as
                // uploaded and then vanish on refresh, so verify instead.
                if (!data.record) {
                    grBusyNote("Confirming with the server…");
                    const v = await verifyUploadSaved(p.meta.clientUploadId);
                    if (v.known && v.exists && v.record) {
                        adoptSavedRecord(localId, v.record);
                        grBusySuccess();
                        refreshMonthOptions();
                        rerenderAll();
                        return;
                    }
                    if (!v.known) {
                        setSync(localId, "unknown", "The server accepted the upload but it could not be confirmed.");
                        grBusyUnconfirmed(localId);
                        refreshMonthOptions();
                        rerenderAll();
                        return;
                    }
                    // Verified absent: it genuinely did not save.
                    const miss = "The server replied but the record was not written. Please upload it again.";
                    setSync(localId, "failed", miss);
                    grBusyFailed(miss, localId);
                    refreshMonthOptions();
                    rerenderAll();
                    return;
                }

                // Confirmed: a real server record came back.
                adoptSavedRecord(localId, data.record);
                grBusySuccess();
                refreshMonthOptions();
                rerenderAll();
                return;
            } catch (err) {
                lastErr = err;
                // A timeout may mean the file DID save and only the reply was
                // lost, so re-sending blindly wastes another 3 minutes of the
                // member's data. Stop and tell them to refresh and check.
                if (err && err.code === "timeout") break;
                if (attempt < MAX_TRIES) {
                    const wait = BACKOFF[attempt - 1] || 5000;
                    grBusyNote("Connection problem — trying again (attempt " + (attempt + 1) + " of " + MAX_TRIES + ")…");
                    setSync(localId, "uploading", "Retrying " + (attempt + 1) + "/" + MAX_TRIES + "…");
                    renderMyUploads();
                    await new Promise(r => setTimeout(r, wait));
                }
            }
        }

        // --- 3. Out of attempts: find out what actually happened ----------
        // Never guess. A dropped connection can hide a save that DID happen
        // (the request completed, only the reply was lost), and telling the
        // member 'not saved' in that case is what produces duplicates.
        console.error(lastErr);
        const reason = (lastErr && lastErr.message) || "Unknown error.";

        grBusyNote("Checking with the server whether it saved…");
        const v = await verifyUploadSaved(p.meta.clientUploadId);

        if (v.known && v.exists && v.record) {
            // It did save after all.
            adoptSavedRecord(localId, v.record);
            grBusySuccess();
            notify("Saved ✓ (the reply was lost, but the record is on the server)", "success");
            refreshMonthOptions();
            rerenderAll();
            return;
        }

        if (!v.known) {
            setSync(localId, "unknown", reason + " We also could not reach the server to check whether it saved.");
            grBusyUnconfirmed(localId);
            notify("Could not confirm whether this saved — do not re-upload yet.", "error");
            refreshMonthOptions();
            rerenderAll();
            return;
        }

        // Verified: definitely not in the backend.
        setSync(localId, "failed", reason);
        grBusyFailed(reason, localId);
        notify("NOT saved — " + reason, "error");
        refreshMonthOptions();
        rerenderAll();
    }

    /**
     * Swap the local placeholder for the confirmed server record. Only
     * called once the backend has been shown to hold it — which is what
     * makes it safe to persist and to stop journalling.
     */
    function adoptSavedRecord(localId, record) {
        const idx = allRecords.findIndex(r => String(r.recordId) === String(localId));
        sessionMyIds.add(String(record.recordId));
        if (idx >= 0) allRecords[idx] = record;
        else allRecords.unshift(record);
        delete pendingUploads[localId];
        sessionMyIds.delete(localId);
        journalRemove(localId);          // settled: no orphan warning needed
        orphanAttempts = orphanAttempts.filter(a => a.clientUploadId !== localId);
        persistLocal();
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
        const fh = document.getElementById("grUpFileHint");
        if (fh) {
            fh.className = "gr-file-hint gr-file-hint--info";
            fh.textContent = "PDF up to 4 MB. Under 2 MB uploads fastest — scan in Document or Black & White mode to keep it small.";
        }
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
        return allRecords.filter(r => r._sync === "uploading" || r._sync === "failed" ||
                                      r._sync === "unknown" || isLocal(r));
    }

    function renderSyncBanner() {
        const el = document.getElementById("grSyncBanner");
        if (!el) return;
        const list = unsyncedRecords();

        // Documents from an earlier visit that were never confirmed. These are
        // the ones that used to disappear without a word — now they are named.
        const notSaved = orphanAttempts.filter(a => a.state === "not-saved");
        const unconf   = orphanAttempts.filter(a => a.state === "unconfirmed");

        if (!list.length && !orphanAttempts.length) {
            el.style.display = "none"; el.innerHTML = ""; return;
        }

        const parts = [];
        const failed = list.filter(r => r._sync === "failed").length;
        const unknown = list.filter(r => r._sync === "unknown").length;
        const busy = list.length - failed - unknown;
        if (busy)    parts.push(busy + " upload" + (busy > 1 ? "s" : "") + " still sending");
        if (failed)  parts.push(failed + " did NOT save");
        if (unknown) parts.push(unknown + " could not be confirmed");

        let extra = "";
        if (notSaved.length) {
            const names = notSaved.map(a => a.title || a.fileName).slice(0, 3).join(", ");
            extra += " Earlier document" + (notSaved.length > 1 ? "s" : "") + " that did NOT reach the server: " +
                     names + (notSaved.length > 3 ? " and " + (notSaved.length - 3) + " more" : "") +
                     ". Please upload " + (notSaved.length > 1 ? "them" : "it") + " again.";
        }
        if (unconf.length) {
            extra += " " + unconf.length + " earlier upload" + (unconf.length > 1 ? "s" : "") +
                     " could not be confirmed — tap Refresh Data and check your list before re-uploading.";
        }

        const bad = failed || unknown || orphanAttempts.length;
        // Join the clauses into one readable sentence rather than running
        // them together, since this banner is the main thing a worried
        // member reads.
        let head = parts.join(", ");
        if (head) head += (busy && !bad) ? " — keep this page open until it finishes." : ".";
        const msg = (head + extra).trim();

        el.className = "gr-banner " + (bad ? "gr-banner--fail" : "gr-banner--busy");
        el.innerHTML =
            '<span class="gr-banner-ic">⚠</span>' +
            '<span class="gr-banner-msg">' + escHtml(msg) + '</span>' +
            '<button type="button" class="gr-banner-btn" data-act="gotoUpload">View</button>' +
            (orphanAttempts.length
                ? '<button type="button" class="gr-banner-btn" data-act="clearOrphans">Done — remove</button>'
                : '');
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
            fileCell = `<button type="button" class="gr-sync gr-sync--fail" data-act="why" data-desc="${escHtml(r._syncError || "Upload failed")}" title="Tap to see why" style="font:inherit;font-size:11px;font-weight:700;border:0;cursor:pointer;">⚠ NOT saved</button>`;
        } else if (r._sync === "unknown") {
            fileCell = `<button type="button" class="gr-sync gr-sync--unknown" data-act="why" data-desc="${escHtml(r._syncError || "Could not confirm")}" title="Tap to see why" style="font:inherit;font-size:11px;font-weight:700;border:0;cursor:pointer;">? Unconfirmed</button>`;
        } else if (r.fileUrl) {
            fileCell = `<a href="${escHtml(r.fileUrl)}" target="_blank" rel="noopener" class="gr-file-link gr-file-icon" title="Open file">📄</a>`;
        } else {
            fileCell = "—";
        }

        let actionCell = `<span class="gr-muted">—</span>`;
        if (r._sync === "failed" || r._sync === "unknown") {
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
        journalRemove(localId);
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
        const syncing = r._sync === "uploading" || r._sync === "failed" ||
                        r._sync === "unknown" || isLocal(r);

        let actionCell;
        if (syncing) {
            actionCell = `<span class="gr-muted">${r._sync === "failed" ? "NOT saved" :
                (r._sync === "unknown" ? "Unconfirmed" : "Syncing…")}</span>`;
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
        else if (r._sync === "unknown") fileCell = `<span class="gr-sync gr-sync--unknown">?</span>`;
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
        if (isLocal(rec) || rec._sync === "uploading" || rec._sync === "failed" ||
            rec._sync === "unknown") {
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
    /* ----------------------------------------------------
       Columns the chooser can show or hide. District is not
       listed: it is the row label, so it is always present.
    ---------------------------------------------------- */
    // Total leads: it is what the table is ranked by, so it belongs beside
    // the district name rather than at the far end of the row.
    //
    // Widths are fixed pixels, not percentages. With table-layout:fixed a
    // percentage width stretches every number column on a wide screen, which
    // pushed the figures far from their headings and made the rows hard to
    // compare. Fixed widths keep the numbers in a tight, scannable block and
    // let the district name absorb the slack instead.
    const AN_COLUMNS = [
        { key: "total", label: "Total<br>Uploaded",      total: true,        group: "total", w: 116 },
        { key: "grUp",  label: "GRs<br>Uploaded",        pick: b => b.grUp,  isVal: false, group: "gr",   w: 100 },
        { key: "grVal", label: "GRs<br>Validated",       pick: b => b.grVal, isVal: true,  group: "gr",   w: 100 },
        { key: "cUp",   label: "Circulars<br>Uploaded",  pick: b => b.cUp,   isVal: false, group: "circ", w: 108 },
        { key: "cVal",  label: "Circulars<br>Validated", pick: b => b.cVal,  isVal: true,  group: "circ", w: 108 }
    ];
    // Plain labels for the chooser list (the table headings use <br>).
    const AN_COLUMN_LABELS = {
        grUp: "GRs Uploaded", grVal: "GRs Validated",
        cUp: "Circulars Uploaded", cVal: "Circulars Validated",
        total: "Total Uploaded"
    };

    /* ----------------------------------------------------
       UPLOAD-DATE RANGE
       Filters on when the document was UPLOADED (uploadTimestamp), not
       the date printed on the GR (docDate) — those are often months apart.

       uploadTimestamp is stored as UTC ISO. It is converted to the
       viewer's LOCAL calendar date before comparing, so "31 Aug" means
       31 August as the person reading the screen experiences it. Comparing
       the raw UTC string instead would push a late-evening IST upload into
       the following day.
    ---------------------------------------------------- */
    function uploadDateKey(record) {
        const ts = record && record.uploadTimestamp;
        if (!ts) return "";
        const d = new Date(ts);
        if (isNaN(d.getTime())) return "";
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return d.getFullYear() + "-" + m + "-" + day;
    }

    let anFrom = "";       // "" = no lower bound (YYYY-MM-DD)
    let anTo = "";         // "" = no upper bound
    let anCols = [];       // [] = show every column
    // Snapshot of the last render, so the Excel export is guaranteed to
    // match the screen instead of recomputing and possibly diverging.
    let anLastView = null;

    let anStates = [];      // [] = all communities
    let anDistricts = [];   // [] = all districts of the chosen communities

    // Master districts for the chosen communities (all when none chosen),
    // de-duplicated and alpha-sorted for the filter dropdown.
    function analyticsDistrictsForStates(states) {
        const codes = states.length ? states : Object.keys(STATE_DISTRICTS);
        const out = [];
        codes.forEach(c => (STATE_DISTRICTS[c] || []).forEach(d => {
            if (out.indexOf(d) < 0) out.push(d);
        }));
        return out.sort(cmpStr);
    }

    // One tab per community, plus All. Each carries its upload count, so a
    // community with nothing uploaded is obvious before you even open it.
    function renderAnalyticsTabs() {
        const wrap = document.getElementById("grAnTabs");
        if (!wrap) return;

        // Counted exactly the way the table counts, so a tab number can
        // never disagree with the total shown inside it: retired names are
        // mapped first, and anything outside the master 50 is left out of
        // both (it is reported separately in the meta line instead).
        const master = Object.create(null);
        Object.keys(STATE_DISTRICTS).forEach(c => {
            master[c] = new Set(STATE_DISTRICTS[c]);
        });

        const counts = Object.create(null);
        let grand = 0;
        allRecords.forEach(r => {
            if (!r.district) return;
            const c = canonicalDistrict(r.state, r.district);
            if (!master[c.state] || !master[c.state].has(c.district)) return;
            counts[c.state] = (counts[c.state] || 0) + 1;
            grand += 1;
        });

        const active = anStates.length === 1 ? anStates[0] : "";
        const tabs = [{ code: "", label: "All Communities", n: grand }].concat(
            Object.keys(STATE_LABELS).map(c => ({
                code: c, label: STATE_LABELS[c], n: counts[c] || 0
            }))
        );

        wrap.innerHTML = tabs.map(t =>
            '<button type="button" class="gr-an-tab' + (t.code === active ? " active" : "") +
            '" data-comm="' + escHtml(t.code) + '" role="tab">' +
            escHtml(t.label) +
            '<span class="gr-an-tab-count' + (t.n ? "" : " gr-an-tab-count--zero") + '">' + t.n + "</span>" +
            "</button>"
        ).join("");

        if (!wrap.dataset.wired) {
            wrap.dataset.wired = "1";
            wrap.addEventListener("click", (e) => {
                const btn = e.target.closest(".gr-an-tab");
                if (!btn) return;
                const code = btn.dataset.comm;
                anStates = code ? [code] : [];
                anDistricts = [];   // districts belong to a community; start clean
                closeAllMultiSelects();
                renderMultiSelect(document.getElementById("grAnDistrictMS"));
                renderAnalytics();
            });
        }
    }

    function wireAnalyticsFilters() {
        const distWrap = document.getElementById("grAnDistrictMS");
        if (!distWrap) return;

        renderAnalyticsTabs();

        buildMultiSelect(distWrap, {
            allLabel: "All Districts",
            max: Infinity,
            options: () => analyticsDistrictsForStates(anStates).map(d => ({ value: d, label: d })),
            selected: () => anDistricts,
            onApply: (vals) => { anDistricts = vals; renderAnalytics(); }
        });

        // Columns: nothing ticked means all, which is the same default the
        // other multi-selects on this page use.
        const colsWrap = document.getElementById("grAnColsMS");
        if (colsWrap) {
            buildMultiSelect(colsWrap, {
                allLabel: "All Columns",
                max: Infinity,
                options: () => AN_COLUMNS.map(c => ({ value: c.key, label: AN_COLUMN_LABELS[c.key] })),
                selected: () => anCols,
                onApply: (vals) => { anCols = vals; renderAnalytics(); }
            });
        }

        const fromEl = document.getElementById("grAnFrom");
        const toEl = document.getElementById("grAnTo");
        if (fromEl) fromEl.addEventListener("change", () => {
            anFrom = fromEl.value;
            syncAnDateStyles();
            renderAnalytics();
        });
        if (toEl) toEl.addEventListener("change", () => {
            anTo = toEl.value;
            syncAnDateStyles();
            renderAnalytics();
        });

        const clearBtn = document.getElementById("grAnClear");
        if (clearBtn) clearBtn.addEventListener("click", clearAnalyticsFilters);
        const exportBtn = document.getElementById("grAnExport");
        if (exportBtn) exportBtn.addEventListener("click", exportAnalyticsExcel);
    }

    // Highlight a date box once it holds a value, so a filtered view never
    // looks like the full picture.
    function syncAnDateStyles() {
        [["grAnFrom", anFrom], ["grAnTo", anTo]].forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle("gr-date-set", !!val);
        });
    }

    // True when this record's upload date sits inside the chosen range.
    // Returns null when the record has no usable upload date at all, so the
    // caller can report those instead of quietly dropping them.
    function anInDateRange(record) {
        if (!anFrom && !anTo) return true;
        const key = uploadDateKey(record);
        if (!key) return null;              // no upload date recorded
        if (anFrom && key < anFrom) return false;
        if (anTo && key > anTo) return false;
        return true;
    }

    function clearAnalyticsFilters() {
        anStates = [];
        anDistricts = [];
        anFrom = "";
        anTo = "";
        anCols = [];
        const f = document.getElementById("grAnFrom"); if (f) f.value = "";
        const t = document.getElementById("grAnTo");   if (t) t.value = "";
        syncAnDateStyles();
        closeAllMultiSelects();
        renderMultiSelect(document.getElementById("grAnDistrictMS"));
        renderMultiSelect(document.getElementById("grAnColsMS"));
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
    function anNumCell(n, isVal, extra) {
        let cls = n === 0 ? "gr-an-num gr-an-zero-num"
                          : (isVal ? "gr-an-num gr-an-val" : "gr-an-num");
        if (extra) cls += " " + extra;
        return "<td class=\"" + cls + "\">" + n + "</td>";
    }

    /**
     * The Total cell, with a faint bar behind the figure scaled against the
     * biggest total on screen. Reading the ranking becomes a glance rather
     * than a comparison of digits.
     */
    function anTotalCell(total, max, extra) {
        const cls = "gr-an-total" + (extra ? " " + extra : "");
        return "<td class=\"" + cls + "\">" + total + "</td>";
    }

    /**
     * A share bar drawn across the district column, scaled against the
     * largest total in the current view.
     *
     * It lives here rather than in the Total cell for a practical reason:
     * the number columns are deliberately narrow, so a bar inside one is
     * only ~100px and reads as decoration. The district column is the wide
     * one, so the same bar becomes genuinely comparable there \u2014 and it puts
     * that otherwise empty space to use.
     */
    function anShareBar(total, max) {
        if (!(max > 0) || !(total > 0)) return "";
        const pct = Math.max(1.5, (total / max) * 100);
        return '<span class="gr-an-dbar" style="width:' + pct.toFixed(1) + '%"></span>';
    }

    // The columns currently on show, in their fixed order. Nothing ticked
    // in the chooser means all of them.
    function anVisibleColumns() {
        const picked = anCols.length
            ? AN_COLUMNS.filter(c => anCols.indexOf(c.key) >= 0)
            : AN_COLUMNS.slice();
        // Mark where one group ends and the next begins, so GRs and
        // Circulars read as two blocks rather than four loose columns.
        let prev = null;
        return picked.map(c => {
            const sep = prev !== null && c.group !== prev;
            prev = c.group;
            return Object.assign({}, c, { sep });
        });
    }

    // The number columns take fixed widths; the district column is left
    // unsized so it absorbs whatever space is left over. The table's
    // min-width is recomputed from the visible columns, so hiding some
    // tightens the table instead of leaving a stretched, empty layout.
    const AN_DISTRICT_MIN = 250;

    function anRenderHead(cols) {
        const colgroup = document.getElementById("grAnCols");
        const head = document.getElementById("grAnHead");
        const table = document.querySelector("#grPage table.gr-an-table");

        if (colgroup) {
            colgroup.innerHTML =
                '<col>' +   // district: unsized, takes the remainder
                cols.map(c => '<col style="width:' + c.w + 'px">').join("");
        }
        if (head) {
            head.innerHTML =
                '<th class="gr-an-dcol">District</th>' +
                cols.map(c => {
                    const cls = [c.total ? "gr-an-totcol" : "", c.sep ? "gr-an-gsep" : ""]
                        .filter(Boolean).join(" ");
                    return "<th" + (cls ? ' class="' + cls + '"' : "") + ">" + c.label + "</th>";
                }).join("");
        }
        if (table) {
            const need = AN_DISTRICT_MIN + cols.reduce((a, c) => a + c.w, 0);
            table.style.minWidth = need + "px";
        }
    }

    function renderAnalytics() {
        renderAnalyticsTabs();   // counts move as records arrive
        const body = document.getElementById("grAnBody");
        const foot = document.getElementById("grAnFoot");
        const meta = document.getElementById("grAnMeta");
        if (!body) return;

        const cols = anVisibleColumns();
        anRenderHead(cols);
        const span = cols.length + 1;

        const commCodes = anStates.length ? anStates : Object.keys(STATE_DISTRICTS);
        const commSet = new Set(commCodes);
        const distFilter = anDistricts.length ? new Set(anDistricts) : null;

        // Community-scoped key so identical district names in two
        // communities never collide. State codes never contain "::".
        const key = (state, dist) => state + "::" + dist;
        const masterKeys = new Set();
        const rows = [];
        const byKey = new Map();

        commCodes.forEach(code => {
            (STATE_DISTRICTS[code] || []).forEach(dist => {
                const k = key(code, dist);
                masterKeys.add(k);
                if (distFilter && !distFilter.has(dist)) return;
                const row = { state: code, district: dist, bucket: anBlankBucket() };
                rows.push(row);
                byKey.set(k, row);
            });
        });

        // Fold in every record, mapping retired names onto the master
        // district first so those uploads land in the right row instead of
        // creating a row outside the 50.
        //
        // A record that STILL does not match after mapping is counted in
        // `unmapped` and surfaced in the meta line. It is deliberately not
        // given a row (the table is strictly the master 50) but it is never
        // silently dropped either — otherwise the totals here would quietly
        // disagree with the sheet.
        let unmapped = 0;
        let noUploadDate = 0;
        const unmappedNames = new Set();
        allRecords.forEach(r => {
            const inRange = anInDateRange(r);
            if (inRange === false) return;          // outside the chosen dates
            if (inRange === null) { noUploadDate += 1; return; }
            const c = canonicalDistrict(r.state, r.district);
            if (!commSet.has(c.state)) return;
            const k = key(c.state, c.district);
            const row = byKey.get(k);
            if (!row) {
                // In the master list but filtered out of this view: not a problem.
                if (masterKeys.has(k)) return;
                if (distFilter && !distFilter.has(c.district)) return;
                unmapped += 1;
                unmappedNames.add((STATE_SHORT[c.state] || c.state) + " / " + (c.district || "(blank)"));
                return;
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
            body.innerHTML = "<tr><td colspan=\"" + span + "\" class=\"gr-empty-cell\">" +
                grEmptyHtml("\ud83d\udced", "No districts match these filters.") + "</td></tr>";
            if (foot) foot.innerHTML = "";
            if (meta) meta.textContent = "";
            anLastView = null;   // nothing to export
            return;
        }

        let rank = 0, zeroCount = 0;
        const tot = anBlankBucket();
        // Bars are scaled against the largest total in THIS view, so the
        // comparison stays meaningful after filtering.
        const maxTotal = rows.reduce((m, r) => Math.max(m, r.total), 0);
        body.innerHTML = rows.map(row => {
            const b = row.bucket;
            // Totals always accumulate every metric, whether or not its
            // column is on show, so hiding a column never changes the
            // ranking or the footer of the columns that remain.
            tot.grUp += b.grUp; tot.grVal += b.grVal; tot.cUp += b.cUp; tot.cVal += b.cVal;
            const zero = row.total === 0;
            if (zero) zeroCount += 1;
            const rankCell = zero ? "" : "<span class=\"gr-an-rank\">" + (++rank) + "</span>";
            return "" +
                "<tr class=\"" + (zero ? "gr-an-zero" : "") + "\">" +
                    "<td>" + anShareBar(row.total, maxTotal) + rankCell +
                        "<span class=\"gr-an-dname\">" + escHtml(row.district) + "</span>" +
                        "<div class=\"gr-an-comm\">" + escHtml(STATE_LABELS[row.state] || row.state) + "</div>" +
                    "</td>" +
                    cols.map(c => c.total
                        ? anTotalCell(row.total, maxTotal, c.sep ? "gr-an-gsep" : "")
                        : anNumCell(c.pick(b), c.isVal, c.sep ? "gr-an-gsep" : "")).join("") +
                "</tr>";
        }).join("");

        if (foot) {
            foot.innerHTML =
                "<tr>" +
                    "<td>Total \u00b7 " + rows.length + " districts</td>" +
                    cols.map(c => {
                        const sep = c.sep ? " gr-an-gsep" : "";
                        return c.total
                            ? "<td class=\"gr-an-total" + sep + "\">" + (tot.grUp + tot.cUp) + "</td>"
                            : "<td class=\"gr-an-fnum" + sep + "\">" + c.pick(tot) + "</td>";
                    }).join("") +
                "</tr>";
        }

        const scope = anStates.length
            ? anStates.map(c => STATE_LABELS[c] || c).join(", ")
            : "All communities";
        // Spell the active range out, so a reduced count is never a
        // mystery to whoever is looking at the screen.
        let range = "";
        if (anFrom && anTo)      range = " \u00b7 uploaded " + fmtDate(anFrom) + " to " + fmtDate(anTo);
        else if (anFrom)         range = " \u00b7 uploaded from " + fmtDate(anFrom);
        else if (anTo)           range = " \u00b7 uploaded up to " + fmtDate(anTo);
        const grandUp = tot.grUp + tot.cUp;

        anLastView = {
            rows, cols, scope,
            districts: anDistricts.length ? anDistricts.join(", ") : "All districts",
            from: anFrom, to: anTo,
            tot: { grUp: tot.grUp, grVal: tot.grVal, cUp: tot.cUp, cVal: tot.cVal },
            unmapped, unmappedNames: [...unmappedNames].sort(), noUploadDate
        };

        if (meta) {
            const dLbl = rows.length === 1 ? " district" : " districts";
            const uLbl = grandUp === 1 ? " upload" : " uploads";
            let html = escHtml(scope + range + " \u2014 " + rows.length + dLbl + ", " + grandUp + uLbl +
                (zeroCount ? ", " + zeroCount + " with none yet" : ""));
            // Only ever shown when the sheet holds a district outside the
            // master 50 that no mapping rule covers. Normally absent.
            if (unmapped) {
                const list = [...unmappedNames].sort().join(", ");
                html += ' <span class="gr-an-warn" title="These uploads are not counted in the table above, because their district is not one of the 50. Correct the district in the sheet, or tell me to add a mapping rule.">\u26a0 ' +
                        unmapped + " upload" + (unmapped === 1 ? "" : "s") +
                        " not counted — unknown district: " + escHtml(list) + "</span>";
            }
            // Records that carry no upload date cannot be placed in a range,
            // so they are left out while a date filter is on — said plainly
            // rather than silently.
            if (noUploadDate) {
                html += ' <span class="gr-an-warn" title="These records have no upload timestamp in the sheet, so they cannot be matched against a date range. Clear the dates to include them.">\u26a0 ' +
                        noUploadDate + " record" + (noUploadDate === 1 ? "" : "s") +
                        " skipped — no upload date recorded</span>";
            }
            meta.innerHTML = html;
        }
    }

    /* ====================================================
       XLSX WRITER (no external library)
       An .xlsx is a ZIP of XML parts. At this size compression buys
       nothing, so entries are STORED uncompressed and no deflate
       implementation is needed. Deliberately not a CDN library: this page
       is used on weak rural connections where a large script at page load
       is a real cost, and an export must keep working offline.
    ==================================================== */
    let GR_CRC_TABLE = null;
    function grCrcTable() {
        if (GR_CRC_TABLE) return GR_CRC_TABLE;
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            t[n] = c >>> 0;
        }
        GR_CRC_TABLE = t;
        return t;
    }
    function grCrc32(buf) {
        const t = grCrcTable();
        let c = 0xFFFFFFFF;
        for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    function grUtf8(str) {
        return new TextEncoder().encode(str);
    }

    /* A ZIP with STORED (uncompressed) entries. An .xlsx is just a ZIP, and at
       this size compression buys nothing while deflate would need a library. */
    function grZipStore(files) {
        const chunks = [];
        const central = [];
        let offset = 0;

        const u16 = (n) => [n & 0xFF, (n >>> 8) & 0xFF];
        const u32 = (n) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];

        // Fixed DOS timestamp keeps the output byte-identical run to run.
        const dosTime = 0, dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;

        files.forEach(f => {
            const name = grUtf8(f.name);
            const data = f.data;
            const crc = grCrc32(data);

            const local = [].concat(
                u32(0x04034b50), u16(20), u16(0x0800), u16(0),
                u16(dosTime), u16(dosDate),
                u32(crc), u32(data.length), u32(data.length),
                u16(name.length), u16(0)
            );
            chunks.push(new Uint8Array(local), name, data);

            central.push([].concat(
                u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0),
                u16(dosTime), u16(dosDate),
                u32(crc), u32(data.length), u32(data.length),
                u16(name.length), u16(0), u16(0),
                u16(0), u16(0), u32(0),
                u32(offset)
            ));
            central.push(name);

            offset += local.length + name.length + data.length;
        });

        const cdParts = [];
        let cdSize = 0;
        central.forEach(p => {
            const arr = (p instanceof Uint8Array) ? p : new Uint8Array(p);
            cdParts.push(arr);
            cdSize += arr.length;
        });

        const eocd = new Uint8Array([].concat(
            u32(0x06054b50), u16(0), u16(0),
            u16(files.length), u16(files.length),
            u32(cdSize), u32(offset), u16(0)
        ));

        const all = chunks.concat(cdParts, [eocd]);
        const total = all.reduce((n, a) => n + a.length, 0);
        const out = new Uint8Array(total);
        let p = 0;
        all.forEach(a => { out.set(a, p); p += a.length; });
        return out;
    }

    function grXmlEsc(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&apos;")
            // Control characters are illegal in XML and would corrupt the file.
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
    }

    function grColName(i) {
        let s = "";
        i += 1;
        while (i > 0) {
            const r = (i - 1) % 26;
            s = String.fromCharCode(65 + r) + s;
            i = Math.floor((i - 1) / 26);
        }
        return s;
    }

    /**
     * rows: array of arrays. A cell is either a number, or a string, or
     * { v, bold } for a styled string.
     */
    function grBuildXlsx(sheetName, rows) {
        const safeSheet = String(sheetName || "Sheet1")
            .replace(/[\[\]\*\?\/\\:]/g, "-").slice(0, 31) || "Sheet1";

        const sheetRows = rows.map((row, ri) => {
            const cells = row.map((cell, ci) => {
                const ref = grColName(ci) + (ri + 1);
                const isNum = (typeof cell === "number" && isFinite(cell));
                const obj = (cell && typeof cell === "object") ? cell : null;
                const style = (obj && obj.bold) ? ' s="1"' : "";
                if (isNum) return '<c r="' + ref + '"' + style + '><v>' + cell + "</v></c>";
                const text = obj ? obj.v : cell;
                if (text === "" || text == null) return '<c r="' + ref + '"' + style + "/>";
                if (typeof text === "number") return '<c r="' + ref + '"' + style + '><v>' + text + "</v></c>";
                return '<c r="' + ref + '"' + style + ' t="inlineStr"><is><t xml:space="preserve">' +
                       grXmlEsc(text) + "</t></is></c>";
            }).join("");
            return '<row r="' + (ri + 1) + '">' + cells + "</row>";
        }).join("");

        const sheet =
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
            '<sheetData>' + sheetRows + '</sheetData></worksheet>';

        const workbook =
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
            '<sheets><sheet name="' + grXmlEsc(safeSheet) + '" sheetId="1" r:id="rId1"/></sheets>' +
            '</workbook>';

        const wbRels =
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
            '</Relationships>';

        // Two styles: default, and bold (used for headings and the total row).
        const styles =
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
            '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
            '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
            '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>' +
            '<borders count="1"><border/></borders>' +
            '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
            '<cellXfs count="2">' +
            '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
            '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
            '</cellXfs>' +
            '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
            '</styleSheet>';

        const rels =
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
            '</Relationships>';

        const contentTypes =
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
            '<Default Extension="xml" ContentType="application/xml"/>' +
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
            '</Types>';

        return grZipStore([
            { name: "[Content_Types].xml", data: grUtf8(contentTypes) },
            { name: "_rels/.rels", data: grUtf8(rels) },
            { name: "xl/workbook.xml", data: grUtf8(workbook) },
            { name: "xl/_rels/workbook.xml.rels", data: grUtf8(wbRels) },
            { name: "xl/styles.xml", data: grUtf8(styles) },
            { name: "xl/worksheets/sheet1.xml", data: grUtf8(sheet) }
        ]);
    }

    /* ====================================================
       EXPORT THE ANALYTICS VIEW
       Uses the snapshot taken by the last render, so the file always
       matches what is on screen — same tab, districts, dates, columns
       and sort order — rather than re-deriving it and risking a drift.
    ==================================================== */
    function exportAnalyticsExcel() {
        const v = anLastView;
        if (!v || !v.rows.length) {
            notify("Nothing to export for the current filters.", "error");
            return;
        }

        const B = (t) => ({ v: t, bold: true });
        const out = [];
        out.push([B("GR & Circulars — District Analytics")]);
        out.push([]);
        out.push([B("Community"), v.scope]);
        out.push([B("Districts"), v.districts]);
        out.push([B("Uploaded from"), v.from || "(no limit)"]);
        out.push([B("Uploaded to"), v.to || "(no limit)"]);
        out.push([B("Columns"), v.cols.map(c => AN_COLUMN_LABELS[c.key]).join(", ")]);
        out.push([B("Generated"), new Date().toLocaleString("en-IN")]);
        out.push([B("Generated by"), user.email || "(unknown)"]);
        out.push([]);

        // Community gets its own column here: in a spreadsheet people sort
        // and pivot, and the on-screen two-line cell would not survive that.
        out.push([B("Rank"), B("District"), B("Community")]
            .concat(v.cols.map(c => B(AN_COLUMN_LABELS[c.key]))));

        let rank = 0;
        v.rows.forEach(row => {
            const b = row.bucket;
            const rk = row.total === 0 ? "" : (++rank);
            out.push([rk, row.district, STATE_LABELS[row.state] || row.state]
                .concat(v.cols.map(c => c.total ? row.total : c.pick(b))));
        });

        out.push([B(""), B("Total · " + v.rows.length + " districts"), B("")]
            .concat(v.cols.map(c => c.total
                ? B(v.tot.grUp + v.tot.cUp)
                : B(c.pick(v.tot)))));

        // Carry the same caveats the screen shows, so a downloaded file is
        // never read as a complete picture when it is not.
        if (v.unmapped || v.noUploadDate) {
            out.push([]);
            out.push([B("Not included in the figures above")]);
            if (v.unmapped) {
                out.push(["Uploads under a district outside the master list", v.unmapped]);
                out.push(["Those districts", v.unmappedNames.join(", ")]);
            }
            if (v.noUploadDate) {
                out.push(["Records with no upload date (excluded by the date filter)", v.noUploadDate]);
            }
        }

        const bytes = grBuildXlsx("District Analytics", out);
        const stamp = new Date().toISOString().slice(0, 10);
        const scopeTag = (v.scope === "All communities" ? "All" : v.scope)
            .replace(/[^A-Za-z0-9\- ]/g, "").replace(/\s+/g, "-").slice(0, 40);
        grDownloadBlob(bytes, "GR-Circular-Analytics_" + scopeTag + "_" + stamp + ".xlsx");
        notify("Excel downloaded — " + v.rows.length + " districts.", "success");
    }

    function grDownloadBlob(bytes, filename) {
        const blob = new Blob([bytes], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        // Revoked on a timer: revoking immediately can cancel the download
        // in some browsers before it has started reading the blob.
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
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