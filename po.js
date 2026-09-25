/*******************************************************************************
 * PO REVIEW (po.js) — prototype-styled Weekly view.
 * window.POReview.mount(); router calls it after pages/po.html is injected.
 ******************************************************************************/
(function () {
  "use strict";

  var GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwxjFBD1ROqldKwhphuG1m5JfQPl7QfxUbBOMZ69xHceiW3riWkecB-NYSdwsl3DKzi2w/exec";
  var ADMIN_EMAIL = "itadmin@openlinksfoundation.org";
  var state = { base: null };
  var VIEW = null;                 // last getWeeklyView payload
  var DIRTY = {};                  // { periodCode: { fieldId: value } }

  /* ---------- transport + helpers ---------- */
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  /* Resilient POST: parses JSON from text, and auto-retries when Apps Script
     transiently returns an HTML error page or the network blips. */
  function post(payload, opts) {
    opts = opts || {};
    var timeout = opts.timeout || 0;
    var maxRetries = opts.retries != null ? opts.retries : 2;     // network / HTML blips
    var maxWarm = opts.warmRetries != null ? opts.warmRetries : 6; // misrouted "service" reply (cold start)
    function once() {
      var ctrl = (timeout && typeof AbortController !== "undefined") ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeout) : null;
      var o = { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) };
      if (ctrl) o.signal = ctrl.signal;
      return fetch(GAS_WEB_APP_URL, o).then(function (r) { if (timer) clearTimeout(timer); return r.text(); });
    }
    function attempt(n, w) {
      return once().then(function (txt) {
        var parsed;
        try { parsed = JSON.parse(txt); }
        catch (e) {
          if (n < maxRetries && /^\s*</.test(txt)) return delay(700).then(function () { return attempt(n + 1, w); });
          throw new Error("The backend returned a non-JSON response (a transient Apps Script error). Please try again.");
        }
        // Misrouted doGet "service" reply (has no data/result) — the app is waking up. Retry, then fail clearly.
        if (parsed && parsed.service && !("data" in parsed) && !("result" in parsed)) {
          if (w < maxWarm) return delay(1000).then(function () { return attempt(n, w + 1); });
          throw new Error("The backend is waking up — please try again in a moment.");
        }
        return parsed;
      }, function (err) {
        if (err && err.name === "AbortError") throw err;                        // timeout -> surface, no retry
        if (n < maxRetries) return delay(700).then(function () { return attempt(n + 1, w); });  // network blip -> retry
        throw err;
      });
    }
    return attempt(0, 0);
  }
  function currentEmail() { return (window.__olfUser && window.__olfUser.email ? window.__olfUser.email : "").toLowerCase(); }
  function $(id) { return document.getElementById(id); }
  function opt(v, t) { var o = document.createElement("option"); o.value = v; o.textContent = t; return o; }
  function num(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
  function fmtNum(v) { if (v === "" || v == null) return "—"; var n = Number(v); if (isNaN(n)) return esc(String(v)); return Math.round(n) === n ? String(n) : String(Math.round(n * 100) / 100); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  var toastTimer = null;
  function toast(msg) { var el = $("poToast"); if (!el) return; el.textContent = msg; el.hidden = false; if (toastTimer) clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 3200); }

  /* ---------- section config ---------- */
  var SEC = [
    { k: "A", title: "Check-in", who: "PO", write: true, rows: [
      { id: "A1", label: "How are you feeling this week?", type: "mood" },
      { id: "A2", label: "Anything on your mind?", type: "text" } ] },
    { k: "B", title: "Last week's actions", who: "PO", write: true, rows: [
      { id: "B1", label: "Action 1 from last week", type: "prog" },
      { id: "B2", label: "Action 2 from last week", type: "prog" },
      { id: "B3", label: "Action 3 from last week", type: "prog" },
      { id: "B4", label: "Action 4 from last week", type: "prog" },
      { id: "B5", label: "Action 5 from last week", type: "prog" } ] },
    { k: "C", title: "Vinoba", who: "Auto", src: ["vinoba"] },
    { k: "D", title: "Staff Connect (Events)", who: "Auto", src: ["staffConnect"] },
    { k: "E", title: "Nimble (Tickets)", who: "Auto", src: ["nimble"] },
    { k: "F", title: "Keka & Visit / ER", who: "Auto", src: ["keka", "visit"] },
    { k: "G", title: "Next week", who: "PO", write: true, rows: [
      { id: "G1", label: "Blocker or escalation", type: "text" },
      { id: "G2", label: "Action 1 for next week", type: "text" },
      { id: "G3", label: "Action 2 for next week", type: "text" },
      { id: "G4", label: "Action 3 for next week", type: "text" },
      { id: "G5", label: "Action 4 for next week", type: "text" },
      { id: "G6", label: "Action 5 for next week", type: "text" } ] },
    { k: "H", title: "Review record", who: "PM", write: true, rows: [
      { id: "H1", label: "Review held", type: "yn" },
      { id: "H2", label: "Manager status", type: "status" },
      { id: "H3", label: "Manager's remark", type: "text" } ] }
  ];
  var MOODS = [["G", "🟢 Good"], ["Y", "🟡 Mixed"], ["R", "🔴 Struggling"]];
  var PM_STATUS = ["On track", "Needs support", "Off track"];
  var B_STATUS = ["Done", "Partial", "Not"];

  /* ---------- mount ---------- */
  function mount() {
    var root = $("poRoot"); if (!root || root.dataset.mounted === "1") return;
    root.dataset.mounted = "1";
    if (GAS_WEB_APP_URL.indexOf("PASTE_") === 0) prBody('<div class="pr-empty">Backend URL not set — paste the UI /exec into po.js.</div>');
    if (currentEmail() === ADMIN_EMAIL) { var t = $("prManageTab"); if (t) t.hidden = false; }
    wireNav(); wireFilters(); wireSettings(); wireBaseEditor(); wireMonthly();
    if ($("prModalSave")) $("prModalSave").addEventListener("click", saveTextModal);
    if ($("prModalClose")) $("prModalClose").addEventListener("click", closeTextModal);
    if ($("prModalText")) $("prModalText").addEventListener("input", updateModalMsg);
    if ($("poExport")) $("poExport").addEventListener("click", exportAll);
    loadBaseData();
  }
  function prBody(html) { var b = $("prBody"); if (b) b.innerHTML = html; }

  /* ---------- nav ---------- */
  function wireNav() {
    var btns = document.querySelectorAll("#prNav .pr-navbtn");
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.hidden) return;
        btns.forEach(function (x) { x.classList.remove("is-active"); });
        b.classList.add("is-active");
        var v = b.dataset.view;
        ["weekly", "summary", "monthly", "manage"].forEach(function (name) {
          var el = $("pr" + name.charAt(0).toUpperCase() + name.slice(1)); if (el) el.hidden = (name !== v);
        });
        if (v === "monthly") moPopulate();
      });
    });
  }

  /* ---------- filters / dropdowns ---------- */
  function wireFilters() {
    $("prUnit").addEventListener("change", function () { populateValue($("prUnit").value); refreshLoad(); });
    $("prValue").addEventListener("change", refreshLoad);
    $("prMonth").addEventListener("change", refreshLoad);
    $("prLoad").addEventListener("click", loadWeeklyView);
  }
  function refreshLoad() { $("prLoad").disabled = !($("prUnit").value && $("prValue").value && $("prMonth").value); }

  function setLoadingDropdowns() {
    var v = $("prValue"), m = $("prMonth");
    v.innerHTML = '<option value="">Loading…</option>'; v.disabled = true;
    m.innerHTML = '<option value="">Loading…</option>'; m.disabled = true;
  }
  function loadBaseData(tries) {
    tries = tries || 0;
    if (GAS_WEB_APP_URL.indexOf("PASTE_") === 0) return;
    setLoadingDropdowns();
    prBody('<div class="pr-empty">' + (tries ? "Waking the backend up\u2026 (" + tries + ")" : "Loading base data\u2026") + '</div>');
    post({ action: "getBaseData" }, { timeout: 60000 }).then(function (res) {
      if (!res.ok) { prBody('<div class="pr-empty">Couldn\'t load: ' + esc(res.error) + "</div>"); resetDropdowns(); return; }
      if (!res.data || !res.data.months) {
        // cold-start / transient wrong-shape response — retry a few times before giving up
        if (tries < 4) { setTimeout(function () { loadBaseData(tries + 1); }, 1500); return; }
        prBody('<div class="pr-empty">The backend keeps replying without the expected data. Redeploy the web app as a NEW version (Deploy → Manage deployments → Edit → Version: New version) and confirm the /exec URL in po.js matches that deployment.</div>');
        resetDropdowns(); return;
      }
      state.base = res.data;
      fillRunFolders();
      var mo = $("prMonth"); mo.innerHTML = "";
      if (!res.data.months.length) { mo.innerHTML = '<option value="">No months</option>'; }
      else { mo.appendChild(opt("", "Select…")); res.data.months.forEach(function (m) { mo.appendChild(opt(m.code, m.label)); }); }
      mo.disabled = false;
      populateValue($("prUnit").value);
      moPopulate();
      prBody('<div class="pr-empty">Choose a review unit, a value and a month, then open the review.</div>');
    }).catch(function (e) {
      var timedOut = e && (e.name === "AbortError");
      prBody('<div class="pr-empty">' + esc(timedOut
        ? "The backend didn't respond in 60s — likely a cold start after a new deployment. Reopen this page to retry. If it keeps timing out, check the browser Console and confirm a NEW web-app version was deployed."
        : ("Network error: " + e.message)) + '</div>');
      resetDropdowns();
    });
  }
  function resetDropdowns() {
    var v = $("prValue"), m = $("prMonth");
    v.innerHTML = '<option value="">—</option>'; v.disabled = true;
    m.innerHTML = '<option value="">—</option>'; m.disabled = true;
  }
  var UNIT_LABEL = { PO:"PO", PM:"PM", DM:"DM", District:"District" };
  function fillUnitSelect(sel, unit) {
    sel.innerHTML = ""; sel.appendChild(opt("", "Select…"));
    var b = state.base;
    if (unit === "District") b.districts.forEach(function (d) { sel.appendChild(opt(d, d)); });
    else if (unit === "PM") b.pms.forEach(function (p) { sel.appendChild(opt(p.empId, p.name)); });
    else if (unit === "DM") b.dms.forEach(function (p) { sel.appendChild(opt(p.empId, p.name)); });
    else b.pos.forEach(function (p) { sel.appendChild(opt(p.empId, p.name)); });
    sel.disabled = false;
  }
  function populateValue(unit) {
    var sel = $("prValue"); $("prValueLabel").textContent = UNIT_LABEL[unit] || "PO";
    if (!state.base) { sel.innerHTML = ""; sel.disabled = true; sel.appendChild(opt("", "—")); return; }
    fillUnitSelect(sel, unit);
  }

  /* ---------- load + render the weekly view ---------- */
  function loadWeeklyView() {
    var unit = $("prUnit").value, value = $("prValue").value, month = $("prMonth").value;
    if (!unit || !value || !month) return;
    DIRTY = {};
    prBody('<div class="pr-empty">Loading review…</div>');
    post({ action: "getWeeklyView", unit: unit, value: value, month: month }).then(function (res) {
      if (!res.ok) { prBody('<div class="pr-empty">Couldn\'t load: ' + esc(res.error) + "</div>"); return; }
      VIEW = res.data; renderWeeklyView();
    }).catch(function (e) { prBody('<div class="pr-empty">Network error: ' + esc(e.message) + "</div>"); });
  }

  function hasData(wk) {
    if (!wk || !wk.readPoints) return false;
    return ["vinoba", "keka", "nimble", "staffConnect", "visit"].some(function (g) { return Object.keys(wk.readPoints[g] || {}).length; });
  }
  function presentWeeks() { return (VIEW.weeks || []).filter(function (w) { return w.week >= 1 && w.week <= 5 && hasData(w); }); }
  function weekByNum(n) {
    var list = VIEW.weeks || [];
    for (var i = 0; i < list.length; i++) if (list[i].week === n) return list[i];
    return { week: n, code: VIEW.month + (n < 10 ? "0" + n : "" + n), sections: {}, readPoints: {} };
  }
  function calWeeks() { return presentWeeks(); }    // only weeks that actually have JSON data (up to 5)
  function mtdWeek() { var w0 = (VIEW.weeks || []).filter(function (w) { return w.week === 0; })[0]; return hasData(w0) ? w0 : null; }
  function repWeek() { var pw = presentWeeks(); return pw.length ? pw[0] : (mtdWeek() || (VIEW.weeks || [])[1] || { readPoints: {} }); }

  /* ---------- OLF calendar (ported from v26 prototype) ----------
     Weeks run Monday->Sunday. The weekly review is the last working day of the
     week: the Saturday, or the Friday when it's the 1st/3rd Saturday (off). A
     week locks the Monday after its review. Admin can still edit locked weeks. */
  var SAT_OFF = [1, 3];   // which Saturdays of a month are off (admin-configurable later)
  var CAL = {};           // weekNo -> { label, reviewLabel, locked, moved, adminUnlock }
  function calAdd(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function calPad(n) { return (n < 10 ? "0" : "") + n; }
  function calIso(d) { return d.getFullYear() + "-" + calPad(d.getMonth() + 1) + "-" + calPad(d.getDate()); }
  function calNthSat(d) { return Math.floor((d.getDate() - 1) / 7) + 1; }
  function calSatOff(d) { return SAT_OFF.indexOf(calNthSat(d)) >= 0; }
  function calNonWorking(d) { if (d.getDay() === 0) return true; if (d.getDay() === 6 && calSatOff(d)) return true; return false; }
  function calPrevWorking(d) { var x = new Date(d); while (calNonWorking(x)) x = calAdd(x, -1); return x; }
  function calNextMonday(d) { var x = calAdd(d, 1); while (x.getDay() !== 1) x = calAdd(x, 1); return x; }
  function calReviewDay(monday) {
    var sat = calAdd(monday, 5);
    var scheduled = calSatOff(sat) ? calAdd(sat, -1) : sat;   // Friday when the Saturday is off
    var actual = calPrevWorking(scheduled);
    return { actual: actual, moved: calIso(actual) !== calIso(scheduled) };
  }
  var CAL_MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var CAL_WD = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  function calDM(d) { return d.getDate() + " " + CAL_MO[d.getMonth()]; }
  function calWD(d) { return CAL_WD[d.getDay()] + " " + calDM(d); }
  function computeCalendar() {
    CAL = {};
    var month = VIEW && VIEW.month;
    if (!month || month.length < 6) return;
    var y = Number(month.substring(0, 4)), m = Number(month.substring(4, 6)) - 1;
    var isAdmin = (currentEmail() === ADMIN_EMAIL), today = new Date();
    var first = new Date(y, m, 1);
    var mon = calAdd(calAdd(first, -(((first.getDay() + 6) % 7))), -14);   // 2 weeks before the 1st
    var no = 0;
    for (var k = 0; k < 12; k++, mon = calAdd(mon, 7)) {
      var r = calReviewDay(mon);
      if (r.actual.getFullYear() === y && r.actual.getMonth() === m) {
        no++;
        var end = calAdd(mon, 6), lockDate = calNextMonday(r.actual), past = today >= lockDate;
        CAL[no] = { label: calDM(mon) + " \u2013 " + calDM(end), reviewLabel: calWD(r.actual),
                    moved: r.moved, locked: past && !isAdmin, adminUnlock: past && isAdmin };
      }
    }
  }
  function weekLocked(weekNo) { return !!(CAL[weekNo] && CAL[weekNo].locked); }

  function prIsAdmin() { return currentEmail() === ADMIN_EMAIL; }
  function canEditSelf() { var e = (VIEW && VIEW.header && VIEW.header.selfEmail) || ""; return prIsAdmin() || (!!currentEmail() && currentEmail() === e); }
  function canEditManager() { var e = (VIEW && VIEW.header && VIEW.header.managerEmail) || ""; return prIsAdmin() || (!!currentEmail() && currentEmail() === e); }
  function renderWeeklyView() {
    computeCalendar();
    CELL_VALS = {};
    var h = VIEW.header || {};
    var html = renderHeader(h) + renderBlocks(h) + renderCards() + renderTable();
    var canEdit = canEditSelf() || canEditManager();
    if (canEdit) html += '<div class="pr-savebar"><span class="pr-savehint">You can edit the sections your role owns.</span>'
      + '<button class="pr-btn pr-btn-primary" id="prSave">Save review</button></div>';
    prBody(html);
    bindTable();
    if (canEdit && $("prSave")) $("prSave").addEventListener("click", saveAll);
  }

  function renderHeader(h) {
    if (h.po) {
      var line = [];
      if (h.district) line.push("<b>" + esc(h.district) + "</b>");
      if (h.division) line.push(esc(h.division) + " division");
      if (h.state) line.push(esc(h.state));
      if (h.pm && h.pm.name) line.push("PM " + esc(h.pm.name) + (h.pm.designation ? " · " + esc(h.pm.designation) : ""));
      else line.push("PM vacant");
      if (h.dm && h.dm.name) line.push("DM " + esc(h.dm.name));
      if (h.coo && h.coo.name) line.push("COO " + esc(h.coo.name));
      return '<div class="pr-panel pr-po"><div class="pr-po-name">' + esc(h.po.name)
        + '<small>' + esc(h.po.empId) + (h.po.designation ? " · " + esc(h.po.designation) : "") + '</small></div>'
        + '<div class="pr-po-line">' + line.join('<span class="sep">·</span>') + '</div></div>';
    }
    // aggregate (PM / DM / District)
    var line = [], title, sub;
    if (h.unit === "PM") {
      title = h.manager || "PM"; sub = "Program Manager · manages " + (h.poCount || 0) + " POs";
      if (h.division) line.push(esc(h.division) + " division");
      if (h.dm) line.push("DM " + esc(h.dm));
      if (h.coo) line.push("COO " + esc(h.coo));
    } else if (h.unit === "DM") {
      title = h.manager || "DM"; sub = "Division Manager · manages " + (h.pmCount || 0) + " PMs · " + (h.poCount || 0) + " POs";
      if (h.division) line.push(esc(h.division) + " division");
      if (h.coo) line.push("COO " + esc(h.coo));
    } else {
      title = h.district || "District"; sub = (h.poCount || 0) + " POs" + (h.division ? " · " + esc(h.division) + " division" : "");
    }
    return '<div class="pr-panel pr-po"><div class="pr-po-name">' + esc(title) + '<small>' + esc(sub) + '</small></div>'
      + '<div class="pr-po-line">' + (line.length ? line.join('<span class="sep">·</span>') + '<span class="sep">·</span>' : "")
      + '<span class="pr-mut">view only</span></div></div>';
  }

  function renderBlocks(h) {
    if (VIEW.roster && VIEW.roster.members) {
      var kind = VIEW.roster.kind === "PM" ? "PMs" : "POs";
      var mc = VIEW.roster.members.map(function (m) {
        return '<span class="pr-chip">' + esc(m.name) + (m.total ? ' <code>' + m.total + ' PO' + (m.total > 1 ? "s" : "") + '</code>' : "") + '</span>';
      }).join("");
      return '<div class="pr-panel"><div class="pr-blocks-h">Team — ' + kind + '<b>' + VIEW.roster.members.length + '</b></div><div class="pr-chips">' + mc + '</div></div>';
    }
    var blocks = h.blocks || []; if (!blocks.length) return "";
    var chips = blocks.map(function (b) {
      var code = "", name = b.name || "";
      var m = /^([\d\s-]+)\s*[-]\s*(.+)$/.exec(name);
      if (m) { code = m[1].replace(/\s/g, ""); name = m[2]; }
      return '<span class="pr-chip">' + (code ? '<code>' + esc(code) + '</code>' : "") + esc(name) + '</span>';
    }).join("");
    return '<div class="pr-panel"><div class="pr-blocks-h">Blocks reviewed<b>' + blocks.length + '</b></div>'
      + '<div class="pr-chips">' + chips + '</div></div>';
  }

  function rosterWeekCount(code) {
    var r = VIEW.roster, bw = (r.byWeek || {})[code] || {}, done = 0, total = 0;
    if (r.kind === "PM") { r.members.forEach(function (m) { var x = bw[m.id] || { done:0, total:0 }; done += x.done; total += x.total; }); }
    else { r.members.forEach(function (m) { total++; if (bw[m.id]) done++; }); }
    return { done: done, total: total };
  }
  function hasContent(sec) {
    if (!sec) return false;
    return Object.keys(sec).some(function (k) {
      if (k === "_by" || k === "_at") return false;
      var v = sec[k];
      if (v == null || v === "") return false;
      if (typeof v === "object") return Object.keys(v).some(function (kk) { return v[kk] !== "" && v[kk] != null; });
      return true;
    });
  }
  function secFilled(w, k) {
    var s2 = (w.sections || {})[k]; if (!s2) return false;
    if (k === "A") return !!s2.A1;
    if (k === "B") return ["B1", "B2", "B3"].some(function (id) { return s2[id] && s2[id].status; });
    if (k === "G") return ["G1", "G2", "G3", "G4"].some(function (id) { return s2[id]; });
    if (k === "H") return !!s2.H1;
    return hasContent(s2);
  }
  function isWeekComplete(w) { return secFilled(w, "A") && secFilled(w, "B") && secFilled(w, "G") && secFilled(w, "H"); }

  function weekCardHtml(w) {
    var c = CAL[w.week] || {};
    var flags = ["A", "B", "G", "H"].map(function (k) { return secFilled(w, k); });   // bar 1=A, 2=B, 3=G, 4=H
    var filled = flags.filter(Boolean).length;
    var bars = flags.map(function (f) { return '<span class="pr-bar ' + (f ? "on" : "off") + '"></span>'; }).join("");
    var state = filled === 4 ? " complete" : filled > 0 ? " partial" : "";
    var remark = filled === 4 ? "Completed" : filled > 0 ? "Partially completed" : "Not started yet";
    var lock = c.locked ? '<span class="pr-lock" title="Locked">\uD83D\uDD12</span>' : (c.adminUnlock ? '<span class="pr-lock" title="Locked for others; you can edit">\uD83D\uDD13</span>' : "");
    return '<div class="pr-card pr-wkcard' + state + '"><div class="pr-card-k"><span>Week ' + w.week + '</span>' + lock + '</div>'
      + '<div class="pr-bars">' + bars + '</div>'
      + '<div class="pr-wkcard-foot"><span>' + remark + '</span><span></span></div></div>';
  }
  function renderCards() {
    var cards = "";
    calWeeks().forEach(function (w) { cards += weekCardHtml(w); });
    return '<div class="pr-cards">' + cards + '</div>';
  }
  function statCard(k, v, sub) {
    return '<div class="pr-card"><div class="pr-card-k">' + esc(k) + '</div><div class="pr-card-v">' + esc(v)
      + (sub ? '<small>' + esc(sub) + '</small>' : "") + '</div></div>';
  }
  function computeStats(pw, mtd) {
    var repTotal = pw.length, repDone = 0, actDone = 0, actTotal = 0, compDone = 0, compTotal = 0;
    pw.forEach(function (w) {
      if (w.sections && Object.keys(w.sections).length) repDone++;
      var B = (w.sections || {}).B || {};
      ["B1", "B2", "B3"].forEach(function (id) { if (B[id] && (B[id].text || B[id].status)) { actTotal++; if (B[id].status === "Done") actDone++; } });
      var v = (w.readPoints || {}).visit || {};
      if (Object.keys(v).length) {
        [["ER Submitted", function (x) { return /^y/i.test(String(x)); }], ["Program Dashboard Updated Yes", function (x) { return num(x) > 0; }], ["Kathawli Yes", function (x) { return num(x) > 0; }]]
          .forEach(function (c) { compTotal++; if (c[1](v[c[0]])) compDone++; });
      }
      var d = (w.readPoints || {}).derived || {};
      if (d["Keka Punctual"] !== undefined && d["Keka Punctual"] !== "") { compTotal++; if (d["Keka Punctual"] === "Y") compDone++; }
    });
    var srcT = mtd || repWeek();
    var tickets = num(((srcT.readPoints || {}).nimble || {})["Tickets Raised"]);
    return {
      repTotal: repTotal, repDone: repDone,
      actDone: actDone, actTotal: actTotal, actPct: actTotal ? Math.round(actDone / actTotal * 100) : 0,
      compDone: compDone, compTotal: compTotal, compPct: compTotal ? Math.round(compDone / compTotal * 100) : 0,
      tickets: tickets
    };
  }

  /* ---------- columnar A–H table ---------- */
  function sectionRows(S) {
    if (S.write) return S.rows.map(function (r) { return { id: r.id, label: r.label, type: r.type }; });
    // data rows: union of keys across the sources, from a representative week
    var rep = repWeek(), out = [];
    S.src.forEach(function (src) {
      var grp = (rep.readPoints || {})[src] || {};
      Object.keys(grp).forEach(function (key) { out.push({ label: key, key: key, src: src, data: true }); });
    });
    return out;
  }
  function dataVal(r, w) {
    var g = (w.readPoints || {})[r.src] || {};
    if (r.src === "vinoba" && r.key === "Post Per Month Per Teacher") {   // UI formula, not summed
      var ut = num(g["Unique Teachers Posting"]), tp = num(g["Total Posts"]);
      return tp ? String(Math.round(ut / tp * 100) / 100) : "\u2014";
    }
    return fmtNum(g[r.key]);
  }
  function sectionWho(S, unit) {
    if (S.k === "TEAM") return unit === "DM" ? "PM" : "PO";
    if (!S.write) return "Auto";
    if (S.k === "H") return unit === "DM" ? "COO" : (unit === "PM" ? "DM" : "PM");
    return unit === "DM" ? "DM" : (unit === "PM" ? "PM" : "PO");
  }
  function whoClassOf(who) { return who === "Auto" ? "auto" : (who === "PO" ? "po" : "pm"); }

  function renderTable() {
    var present = calWeeks(), mtd = mtdWeek();
    if (!present.length && !mtd) return '<div class="pr-panel"><div class="pr-empty">No JSON data for this month yet — run Create JSONs under Manage.</div></div>';
    var totalCols = 1 + present.length + (mtd ? 1 : 0);

    var head = '<tr><th class="pr-item">Item</th>';
    present.forEach(function (w) { head += '<th class="pr-num' + (weekLocked(w.week) ? ' pr-col-locked' : '') + '">Week ' + w.week + (weekLocked(w.week) ? ' \uD83D\uDD12' : '') + '</th>'; });
    if (mtd) head += '<th class="pr-num pr-mtd">MTD</th>';
    head += '</tr>';

    var body = "";
    if (VIEW.roster && VIEW.roster.members) body += renderRosterSection(present, mtd, totalCols);
    var uUnit = (VIEW.header && VIEW.header.unit) || "PO";
    SEC.forEach(function (S) {
      var rows = sectionRows(S);
      var editable = S.write ? ((S.k === "H") ? canEditManager() : canEditSelf()) : false;
      var who = sectionWho(S, uUnit);
      body += '<tr class="pr-grp" data-grp="' + S.k + '"><td colspan="' + totalCols + '"><span class="pr-caret">\u25B8</span>' + S.k + '. ' + esc(S.title) + ' <span class="pr-who-tag pr-who-' + whoClassOf(who) + '">' + who + '</span></td></tr>';
      rows.forEach(function (r) {
        body += '<tr class="pr-row pr-hidden" data-secrow="' + S.k + '">';
        body += '<td class="pr-item">' + esc(r.label) + '</td>';
        present.forEach(function (w) {
          body += '<td class="' + (r.data ? "pr-num" : "") + '">' + (r.data ? dataVal(r, w) : renderCell(S, r, w, editable)) + '</td>';
        });
        if (mtd) body += '<td class="pr-num pr-mtd">' + (r.data ? dataVal(r, mtd) : '<span class="pr-mut">\u2014</span>') + '</td>';
        body += '</tr>';
      });
    });
    return '<div class="pr-tablewrap"><table class="pr-tbl"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
  }
  function renderRosterSection(present, mtd, totalCols) {
    var r = VIEW.roster, who = r.kind === "PM" ? "PM" : "PO";
    var html = '<tr class="pr-grp" data-grp="TEAM"><td colspan="' + totalCols + '"><span class="pr-caret">\u25B8</span>Team <span class="pr-who-tag pr-who-' + whoClassOf(who) + '">' + who + '</span></td></tr>';
    r.members.forEach(function (m) {
      html += '<tr class="pr-row pr-hidden pr-teamrow" data-secrow="TEAM">';
      html += '<td class="pr-item">' + esc(m.name) + '</td>';
      present.forEach(function (w) {
        var st = ((r.byWeek || {})[w.code] || {})[m.id] || "none";
        var text = st === "done" ? "Completed" : (st === "partial" ? "Partially done" : "Not started");
        var cls = st === "done" ? "pr-rev-yes" : (st === "partial" ? "pr-rev-part" : "pr-rev-no");
        html += '<td class="pr-num"><span class="' + cls + '">' + text + '</span></td>';
      });
      if (mtd) html += '<td class="pr-num pr-mtd"><span class="pr-mut">\u2014</span></td>';
      html += '</tr>';
    });
    return html;
  }


  var CELL_VALS = {};
  var TEXT_MAX = 80;
  function openTextModal(btn) {
    var wc = btn.dataset.wc, fid = btn.dataset.fid, ed = btn.dataset.ed === "1", label = btn.dataset.label || "";
    $("prModalTitle").textContent = (ed ? "Edit" : "View") + " \u2014 " + label;
    var ta = $("prModalText");
    ta.value = CELL_VALS[wc + "|" + fid] || ""; ta.readOnly = !ed; ta.maxLength = TEXT_MAX;
    var sb = $("prModalSave"); sb.hidden = !ed; sb.dataset.wc = wc; sb.dataset.fid = fid; sb.dataset.key = wc + "|" + fid;
    updateModalMsg();
    $("prModal").hidden = false;
    if (ed) ta.focus();
  }
  function updateModalMsg() {
    var ta = $("prModalText"), m = $("prModalMsg"), len = ta.value.length;
    if (len >= TEXT_MAX) { m.textContent = "Content limit exceeded (max " + TEXT_MAX + " characters)."; m.className = "pr-modal-msg is-over"; }
    else { m.textContent = len + " / " + TEXT_MAX; m.className = "pr-modal-msg"; }
  }
  function saveTextModal() {
    var sb = $("prModalSave"), wc = sb.dataset.wc, fid = sb.dataset.fid, val = $("prModalText").value;
    CELL_VALS[sb.dataset.key] = val;
    markDirty(wc, fid, val);
    var cell = document.querySelector('#prBody .pr-iconbtn[data-wc="' + wc + '"][data-fid="' + fid + '"]');
    if (cell) cell.classList.toggle("has-val", !!(val && val.trim()));
    closeTextModal();
  }
  function closeTextModal() { $("prModal").hidden = true; }
  function renderCell(S, r, w, editable) {
    var sec = (w.sections || {})[S.k] || {};
    var stored = sec[r.id];
    var ro = !editable || weekLocked(w.week);
    var wc = w.code, fid = r.id;
    if (r.type === "mood") {
      var mv = stored !== undefined ? stored : "";
      if (ro) return moodLabel(mv);
      return seg(wc, fid, MOODS.map(function (m) { return [m[0], m[1]]; }), mv);
    }
    if (r.type === "yn") {
      var yv = stored !== undefined ? stored : "";
      if (ro) return yv ? (yv === "Y" ? "Yes" : "No") : '<span class="pr-mut">—</span>';
      return seg(wc, fid, [["Y", "Yes"], ["N", "No"]], yv);
    }
    if (r.type === "status") {
      var sv = stored !== undefined ? stored : "";
      if (ro) return sv ? esc(sv) : '<span class="pr-mut">—</span>';
      return '<select class="pr-sel" data-wc="' + wc + '" data-fid="' + fid + '"><option value="">—</option>'
        + PM_STATUS.map(function (o) { return '<option' + (sv === o ? " selected" : "") + '>' + esc(o) + '</option>'; }).join("") + '</select>';
    }
    if (r.type === "prog") {
      var carry = (w.carryForward || {})["B" + fid.slice(1)] || (stored && stored.text) || "";
      var st = (stored && stored.status) || "";
      var none = w.week === 1 ? "— from last month —" : "— none —";
      var carryHtml = carry ? '<div class="pr-carry">' + esc(carry) + '</div>' : '<div class="pr-carry pr-mut">' + none + '</div>';
      if (ro) return carryHtml + (st ? esc(st) : '<span class="pr-mut">—</span>');
      return carryHtml + seg(wc, fid, B_STATUS.map(function (o) { return [o, o]; }), st, esc(carry));
    }
    // text -> compact edit / view icon (opens a popup)
    var tv = stored !== undefined ? stored : "";
    CELL_VALS[wc + "|" + fid] = tv;
    var hasVal = !!(tv && String(tv).trim());
    var canEdit = !ro;
    return '<button type="button" class="pr-iconbtn' + (hasVal ? " has-val" : "") + (canEdit ? " editable" : "") + '" data-wc="' + wc + '" data-fid="' + fid + '" data-ed="' + (canEdit ? "1" : "0") + '" data-label="' + esc(r.label) + '" title="' + (canEdit ? "Edit" : "View") + '">' + (canEdit ? "\u270E" : "\uD83D\uDC41") + '</button>';
  }
  function seg(wc, fid, opts, val, carryText) {
    return '<div class="pr-seg" data-wc="' + wc + '" data-fid="' + fid + '"' + (carryText != null ? ' data-carry="' + carryText + '"' : "") + '">'
      + opts.map(function (o) { return '<button type="button" class="pr-segbtn' + (val === o[0] ? " is-on" : "") + '" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join("") + '</div>';
  }
  function moodLabel(v) { for (var i = 0; i < MOODS.length; i++) if (MOODS[i][0] === v) return MOODS[i][1]; return '<span class="pr-mut">—</span>'; }

  function bindTable() {
    // accordions (collapsed by default)
    document.querySelectorAll("#prBody .pr-grp").forEach(function (g) {
      g.addEventListener("click", function () {
        var open = g.classList.toggle("is-open");
        g.querySelector(".pr-caret").textContent = open ? "▾" : "▸";
        document.querySelectorAll('#prBody .pr-row[data-secrow="' + g.dataset.grp + '"]').forEach(function (tr) { tr.classList.toggle("pr-hidden", !open); });
      });
    });
    document.querySelectorAll("#prBody .pr-iconbtn").forEach(function (b) { b.addEventListener("click", function () { openTextModal(b); }); });
    // segmented
    document.querySelectorAll("#prBody .pr-seg").forEach(function (s) {
      s.querySelectorAll(".pr-segbtn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          s.querySelectorAll(".pr-segbtn").forEach(function (b) { b.classList.remove("is-on"); });
          btn.classList.add("is-on");
          var fid = s.dataset.fid, wc = s.dataset.wc, v = btn.dataset.v;
          if (fid.charAt(0) === "B") markDirty(wc, fid, { text: s.dataset.carry || "", status: v });
          else markDirty(wc, fid, v);
        });
      });
    });
    // text + select
    document.querySelectorAll("#prBody textarea[data-fid], #prBody select[data-fid]").forEach(function (el) {
      var h = function () { markDirty(el.dataset.wc, el.dataset.fid, el.value); };
      el.addEventListener("input", h); el.addEventListener("change", h);
    });
  }
  function markDirty(wc, fid, val) { (DIRTY[wc] = DIRTY[wc] || {})[fid] = val; }
  function exportAll() {
    if (currentEmail() !== ADMIN_EMAIL) { toast("Only the IT admin can export."); return; }
    var box = $("poExportStatus"), b = $("poExport");
    b.disabled = true; box.hidden = false; box.classList.remove("is-error");
    box.innerHTML = '<span class="pr-spin"></span>Building the export sheet\u2026 this can take a while. Keep this tab open.';
    post({ action: "exportAll", email: currentEmail() }, { timeout: 330000, retries: 0, warmRetries: 0 }).then(function (res) {
      b.disabled = false;
      if (!res.ok) { box.classList.add("is-error"); box.textContent = "Export failed: " + res.error; return; }
      var d = res.data;
      box.innerHTML = "Done \u2014 " + d.reviews + " review rows, " + d.metrics + " metric rows. "
        + '<a href="' + esc(d.url) + '" target="_blank" rel="noopener">Open the sheet</a>, then File \u2192 Download \u2192 Microsoft Excel.';
      try { window.open(d.url, "_blank"); } catch (e) {}
    }).catch(function (e) { b.disabled = false; box.classList.add("is-error"); box.textContent = "Export error: " + e.message; });
  }

  function saveAll() {
    var codes = Object.keys(DIRTY).filter(function (c) { return Object.keys(DIRTY[c]).length; });
    if (!codes.length) { toast("Nothing to save yet."); return; }
    var btn = $("prSave"); btn.disabled = true; btn.innerHTML = '<span class="pr-spin"></span>Saving…';
    var empId = VIEW.header.selfEmpId, failed = 0, chain = Promise.resolve();
    codes.forEach(function (code) {
      chain = chain.then(function () {
        return post({ action: "saveWeekly", empId: empId, periodCode: code, fields: DIRTY[code], by: currentEmail() })
          .then(function (r) { if (!r.ok) failed++; }).catch(function () { failed++; });
      });
    });
    chain.then(function () {
      btn.disabled = false; btn.textContent = "Save review";
      if (failed) {
        var hint = document.querySelector("#prBody .pr-savehint");
        if (hint) { hint.textContent = "\u26A0 Save failed for " + failed + " item(s) \u2014 click Save again to retry. Your changes are NOT lost."; hint.classList.add("is-fail"); }
        toast("Save failed \u2014 please click Save again to retry.");
      } else {
        toast("Saved."); DIRTY = {}; loadWeeklyView();
      }
    });
  }

  /* ---------- Manage: run JSONs ---------- */
  function wireSettings() {
    var l = $("poRunLatest"), a = $("poRunAll");
    if (l) l.addEventListener("click", function () { runJson(false); });
    if (a) a.addEventListener("click", function () { runJson(true); });
  }
  function fillRunFolders() {
    var sel = $("poRunFolder"); if (!sel) return;
    var periods = (state.base && state.base.periods) ? state.base.periods.slice() : [];
    periods.sort(function (a, b) { return a.code < b.code ? 1 : -1; });   // newest first
    var html = "";
    for (var i = 0; i < periods.length; i++) html += '<option value="' + esc(periods[i].code) + '">' + esc(periods[i].label) + "</option>";
    html += '<option value="">All folders (slow)</option>';
    sel.innerHTML = html;   // defaults to the newest folder
  }
  function runJson(overwrite) {
    if (currentEmail() !== ADMIN_EMAIL) { toast("Only the IT admin can run this."); return; }
    var sel = $("poRunFolder"), code = sel ? sel.value : "";
    var scopeLabel = code ? ((sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].text) || code) : "all folders";
    if (!code && !window.confirm("Build ALL folders? This processes every week and can be slow (and may time out). Usually you only need the one folder you changed.")) return;
    var box = $("poRunStatus"), l = $("poRunLatest"), a = $("poRunAll");
    l.disabled = true; a.disabled = true; box.hidden = false; box.classList.remove("is-error");
    box.innerHTML = '<span class="pr-spin"></span>' + (overwrite ? "Rebuilding" : "Updating") + " JSONs for " + esc(scopeLabel) + "\u2026 This can take a while.";
    post({ action: overwrite ? "runAll" : "runLatest", email: currentEmail(), code: code }, { retries: 0, timeout: 300000, warmRetries: 0 }).then(function (res) {
      l.disabled = false; a.disabled = false;
      if (!res.ok) { box.classList.add("is-error"); box.textContent = "Failed: " + res.error; return; }
      box.textContent = summarize(res.result);
    }).catch(function (e) { l.disabled = false; a.disabled = false; box.classList.add("is-error"); box.textContent = "Network error: " + e.message; });
  }
  function summarize(r) {
    if (!r) return "Done.";
    var lines = [(r.mode === "runAll" ? "Rebuilt all JSONs." : "Updated JSONs."),
      "Date folders processed: " + r.dateFoldersProcessed,
      "JSON created: " + r.jsonFilesCreated + (r.jsonFilesReplaced ? "   replaced: " + r.jsonFilesReplaced : "") + (r.jsonFilesSkipped ? "   skipped: " + r.jsonFilesSkipped : ""),
      "Duration: " + r.durationSeconds + "s"];
    if (r.writeErrors) lines.push("Write errors: " + r.writeErrors);
    if (r.nimbleUnmatched && r.nimbleUnmatched.length) lines.push("Nimble unmatched: " + r.nimbleUnmatched.join(", "));
    if (r.visitUnmatched && r.visitUnmatched.length) lines.push("Visit/ER unmatched: " + r.visitUnmatched.join(", "));
    if (r.errors && r.errors.length) lines.push("Errors:\n  " + r.errors.join("\n  "));
    lines.push("\nReload the weekly review to see the data.");
    return lines.join("\n");
  }

  /* ---------- Manage: PO base sheet editor ---------- */
  var baseHeaders = [];
  function wireBaseEditor() {
    var l = $("poBaseLoad"), add = $("poBaseAddRow"), save = $("poBaseSave"), filter = $("poBaseFilter");
    if (l) l.addEventListener("click", loadBaseSheet);
    if (add) add.addEventListener("click", addBaseRow);
    if (save) save.addEventListener("click", saveBaseSheet);
    if (filter) filter.addEventListener("input", filterBaseRows);
  }
  function loadBaseSheet() {
    var wrap = $("poBaseWrap"), note = $("poBaseNote"); note.hidden = true;
    wrap.innerHTML = '<div class="pr-empty">Loading base sheet…</div>';
    post({ action: "getBaseSheet" }).then(function (res) {
      if (!res.ok) { wrap.innerHTML = '<div class="pr-empty">Couldn\'t load: ' + esc(res.error) + "</div>"; return; }
      renderBaseTable(res.data);
    }).catch(function (e) { wrap.innerHTML = '<div class="pr-empty">Network error: ' + esc(e.message) + "</div>"; });
  }
  function renderBaseTable(d) {
    baseHeaders = d.headers.slice();
    var editable = d.editable, note = $("poBaseNote");
    if (!editable) { note.hidden = false; note.textContent = "This Base File is read-only here. Convert it to a Google Sheet to edit and save from this page."; }
    var html = '<table class="pr-base-tbl"><thead><tr>' + (editable ? "<th></th>" : "");
    d.headers.forEach(function (h) { html += "<th>" + esc(h) + "</th>"; });
    html += "</tr></thead><tbody>";
    d.rows.forEach(function (row) { html += baseRowHtml(row, editable); });
    html += "</tbody></table>";
    $("poBaseWrap").innerHTML = html;
    $("poBaseFilter").hidden = false;
    $("poBaseAddRow").hidden = !editable; $("poBaseSave").hidden = !editable;
    if (editable) wireDeleteButtons();
    updateBaseCount();
  }
  function baseRowHtml(row, editable) {
    var html = "<tr>" + (editable ? '<td class="pr-cell" style="text-align:center"><button class="pr-base-del" title="Remove row">✕</button></td>' : "");
    for (var i = 0; i < baseHeaders.length; i++) {
      var v = (row && row[i] != null) ? row[i] : "";
      html += '<td class="pr-cell"><div contenteditable="' + (editable ? "true" : "false") + '">' + esc(v) + "</div></td>";
    }
    return html + "</tr>";
  }
  function wireDeleteButtons() {
    document.querySelectorAll("#poBaseWrap .pr-base-del").forEach(function (btn) {
      btn.addEventListener("click", function () { var tr = btn.closest("tr"); if (tr) { tr.parentNode.removeChild(tr); updateBaseCount(); } });
    });
  }
  function addBaseRow() { var tb = document.querySelector("#poBaseWrap tbody"); if (!tb) return; tb.insertAdjacentHTML("afterbegin", baseRowHtml([], true)); wireDeleteButtons(); updateBaseCount(); filterBaseRows(); }
  function filterBaseRows() {
    var q = ($("poBaseFilter").value || "").trim().toLowerCase();
    var rows = document.querySelectorAll("#poBaseWrap tbody tr"), shown = 0;
    rows.forEach(function (tr) { var hit = !q || tr.textContent.toLowerCase().indexOf(q) >= 0; tr.classList.toggle("pr-row-hidden", !hit); if (hit) shown++; });
    updateBaseCount(shown);
  }
  function updateBaseCount(shown) {
    var total = document.querySelectorAll("#poBaseWrap tbody tr").length;
    $("poBaseCount").textContent = (shown != null && shown !== total) ? (shown + " of " + total + " rows") : (total + " rows");
  }
  function saveBaseSheet() {
    var trs = document.querySelectorAll("#poBaseWrap tbody tr"), rows = [];
    trs.forEach(function (tr) {
      var cells = tr.querySelectorAll("td.pr-cell [contenteditable]"), row = [], any = false;
      cells.forEach(function (c) { var t = c.textContent.trim(); row.push(t); if (t) any = true; });
      if (any) rows.push(row);
    });
    if (!rows.length) { toast("Nothing to save."); return; }
    if (!confirm("Save " + rows.length + " rows back to the Base File? This replaces its contents.")) return;
    var btn = $("poBaseSave"); btn.disabled = true; btn.innerHTML = '<span class="pr-spin"></span>Saving…';
    post({ action: "saveBaseSheet", email: currentEmail(), headers: baseHeaders, rows: rows }).then(function (res) {
      btn.disabled = false; btn.textContent = "Save changes";
      if (!res.ok) { toast("Save failed: " + res.error); return; }
      toast("Saved " + res.data.rows + " rows."); loadBaseData();
    }).catch(function (e) { btn.disabled = false; btn.textContent = "Save changes"; toast("Network error: " + e.message); });
  }

  /* ================================================================== */
  /* MONTHLY = Sheet B feed (per PO, view-only, from the All-Month file)  */
  /* ================================================================== */
  var GOALS = [
    { g: "G2", title: "Life Skills Programs", points: [
      { label: "LS posts", src: "vinoba", key: "Total Lifeskills" },
      { label: "Streaks", src: "vinoba", key: "Streaks" } ] },
    { g: "G3", title: "Community", points: [
      { label: "Unique teachers posting", src: "vinoba", key: "Unique Teachers Posting" },
      { label: "Unique schools posting", src: "vinoba", key: "Unique Schools Posting" },
      { label: "Expert coupons used", src: "vinoba", key: "Expert Coupons Given" },
      { label: "Recognition events held", src: "staffEvents" },
      { label: "Kathawli stories", src: "visit", key: "Kathawli Yes" } ] },
    { g: "G5", title: "High Ownership", points: [
      { label: "School visits", src: "visit", key: "School Visits" },
      { label: "Cluster / block visits", src: "visit", sum: ["Block Visits", "Cluster Visits"] },
      { label: "Visit forms filed", src: "visit", key: "Visit Forms Filed" } ] }
  ];
  var MO_COMPLIANCE = [
    { label: "ER submitted", type: "yn", src: "visit", key: "ER Submitted", yn: function (v) { return /^y/i.test(String(v)); } },
    { label: "Program dashboard updated", type: "yn", src: "visit", key: "Program Dashboard Updated Yes", yn: function (v) { return num(v) > 0; } },
    { label: "Kathawli story submitted", type: "yn", src: "visit", key: "Kathawli Yes", yn: function (v) { return num(v) > 0; } },
    { label: "Keka: punctual + location", type: "yn", src: "derived", key: "Keka Punctual", yn: function (v) { return v === "Y"; } },
    { label: "Daily forms filed", type: "num", src: "visit", key: "Daily Forms Filed" },
    { label: "Visit forms filed", type: "num", src: "visit", key: "Visit Forms Filed" }
  ];

  function wireMonthly() {
    var u = $("prMoUnit"), v = $("prMoValue"), mo = $("prMoMonth"), load = $("prMoLoad");
    if (u) u.addEventListener("change", function () { moFillValue(u.value); moRefresh(); });
    if (v) v.addEventListener("change", moRefresh);
    if (mo) mo.addEventListener("change", moRefresh);
    if (load) load.addEventListener("click", loadMonthly);
  }
  function moRefresh() { $("prMoLoad").disabled = !($("prMoUnit").value && $("prMoValue").value && $("prMoMonth").value); }
  function moFillValue(unit) {
    var sel = $("prMoValue"); $("prMoValueLabel").textContent = UNIT_LABEL[unit] || "PO";
    if (!state.base) { sel.innerHTML = ""; sel.disabled = true; sel.appendChild(opt("", "—")); return; }
    fillUnitSelect(sel, unit);
  }
  function moPopulate() {
    if (!state.base) return;
    var mo = $("prMoMonth");
    if (mo && !mo.dataset.filled) {
      mo.innerHTML = "";
      if (!state.base.months.length) { mo.innerHTML = '<option value="">No months</option>'; }
      else { mo.appendChild(opt("", "Select…")); state.base.months.forEach(function (m) { mo.appendChild(opt(m.code, m.label)); }); }
      mo.dataset.filled = "1";
    }
    moFillValue($("prMoUnit").value);
  }
  function loadMonthly() {
    var unit = $("prMoUnit").value, value = $("prMoValue").value, month = $("prMoMonth").value;
    if (!unit || !value || !month) return;
    $("prMoBody").innerHTML = '<div class="pr-empty">Loading Sheet B feed…</div>';
    post({ action: "getMonthly", unit: unit, value: value, month: month }).then(function (res) {
      if (!res.ok) { $("prMoBody").innerHTML = '<div class="pr-empty">Couldn\'t load: ' + esc(res.error) + '</div>'; return; }
      renderMonthly(res.data);
    }).catch(function (e) { $("prMoBody").innerHTML = '<div class="pr-empty">Network error: ' + esc(e.message) + '</div>'; });
  }
  function moVal(rp, pt) {
    if (pt.src === "staffEvents") {
      var sc = rp.staffConnect || {};
      return fmtNum(num(sc["Total Block Events"]) + num(sc["Total District Events"]) + num(sc["SU/NS Events"]) + num(sc["Other Events"]));
    }
    if (pt.sum) { var g = rp[pt.src] || {}, t = 0; pt.sum.forEach(function (k) { t += num(g[k]); }); return fmtNum(t); }
    return fmtNum((rp[pt.src] || {})[pt.key]);
  }
  function renderMoHeader(h) {
    var line = [];
    if (h.po) {
      if (h.district) line.push("<b>" + esc(h.district) + "</b>");
      if (h.division) line.push(esc(h.division) + " division");
      if (h.pm && h.pm.name) line.push("PM " + esc(h.pm.name)); else line.push("PM vacant");
      if (h.dm && h.dm.name) line.push("DM " + esc(h.dm.name));
      return '<div class="pr-panel pr-po"><div class="pr-po-name">' + esc(h.po.name) + '<small>' + esc(h.po.empId) + ' \u00B7 Sheet B feed</small></div>'
        + '<div class="pr-po-line">' + line.join('<span class="sep">\u00B7</span>') + '</div></div>';
    }
    var title = h.unit === "PM" ? (h.manager || "PM") : h.unit === "DM" ? (h.manager || "DM") : (h.district || "District");
    var sub = h.unit === "PM" ? ("Program Manager \u00B7 " + (h.poCount || 0) + " POs \u00B7 Sheet B feed")
            : h.unit === "DM" ? ("Division Manager \u00B7 " + (h.pmCount || 0) + " PMs \u00B7 " + (h.poCount || 0) + " POs \u00B7 Sheet B feed")
            : ((h.poCount || 0) + " POs \u00B7 Sheet B feed");
    if (h.division) line.push(esc(h.division) + " division");
    if (h.unit === "PM" && h.dm) line.push("DM " + esc(h.dm));
    if (h.coo) line.push("COO " + esc(h.coo));
    return '<div class="pr-panel pr-po"><div class="pr-po-name">' + esc(title) + '<small>' + esc(sub) + '</small></div>'
      + '<div class="pr-po-line">' + (line.length ? line.join('<span class="sep">\u00B7</span>') + '<span class="sep">\u00B7</span>' : "")
      + '<span class="pr-mut">aggregated, view only</span></div></div>';
  }
  function renderMonthly(data) {
    var h = data.header || {}, rp = data.readPoints || {}, body = $("prMoBody");
    if (!data.hasData) {
      body.innerHTML = renderMoHeader(h) + '<div class="pr-panel"><div class="pr-empty">No All-Month data yet — upload the ' + esc(data.month) + '00 folder and run Create JSONs.</div></div>';
      return;
    }
    var html = renderMoHeader(h);
    GOALS.forEach(function (G) {
      var rows = G.points.map(function (pt) {
        return '<tr><td class="pr-item">' + esc(pt.label) + '</td><td class="pr-num">' + moVal(rp, pt) + '</td><td class="pr-num pr-mut">\u2014</td></tr>';
      }).join("");
      html += '<div class="pr-panel"><div class="pr-blocks-h">' + G.g + ' \u00B7 ' + esc(G.title) + '</div>'
        + '<div class="pr-tablewrap" style="border:0"><table class="pr-tbl"><thead><tr><th class="pr-item">Item</th><th class="pr-num">This month</th><th class="pr-num">Target</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    });
    var crows = MO_COMPLIANCE.map(function (c) {
      var v = (rp[c.src] || {})[c.key], disp;
      if (c.type === "yn") {
        var yes = (v !== "" && v != null) ? c.yn(v) : null;
        disp = yes === null ? '<span class="pr-mut">\u2014</span>' : (yes ? '<span class="pr-who-tag pr-who-po">Yes</span>' : '<span class="pr-who-tag pr-who-pm">No</span>');
      } else disp = fmtNum(v);
      return '<tr><td class="pr-item">' + esc(c.label) + '</td><td class="pr-num">' + disp + '</td></tr>';
    }).join("");
    html += '<div class="pr-panel"><div class="pr-blocks-h">Compliance</div>'
      + '<div class="pr-tablewrap" style="border:0"><table class="pr-tbl"><thead><tr><th class="pr-item">Item</th><th class="pr-num">This month</th></tr></thead><tbody>' + crows + '</tbody></table></div></div>';
    html += '<div class="pr-panel"><div class="pr-po-line pr-mut">G1 (Academic, 40%) and G4 (Other, 10%) are not derived from the weekly review \u2014 they are entered on Sheet B.</div></div>';
    body.innerHTML = html;
  }

  window.POReview = { mount: mount };
})();