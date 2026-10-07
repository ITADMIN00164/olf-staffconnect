/*******************************************************************************
 * FIELD TEAM REVIEW — DASHBOARD (pos-review.js)
 * Renders the Weekly review inside Org Admin -> Dashboard, reading from Supabase.
 *
 * The renderer (header, week cards, A–H table, edit cells, text modal) is
 * carried over unchanged from po.js. Only the data layer is new: the Apps
 * Script calls (getBaseData / getWeeklyView / saveWeekly) are replaced by the
 * Supabase functions below, which reproduce JsonCreator.gs + ui.gs rules.
 * window.FTRDashboard.mount() is called by pos.js when the Dashboard tab opens.
 ******************************************************************************/
(function () {
  "use strict";

  var ADMIN_EMAIL = "itadmin@openlinksfoundation.org";
  var state = { base: null };
  var VIEW = null;                 // last weekly-view payload
  var DIRTY = {};                  // { periodCode: { fieldId: value } }

  /* ---------- helpers ---------- */
  function currentEmail() { return (window.__olfUser && window.__olfUser.email ? window.__olfUser.email : "").toLowerCase(); }
  function $(id) { return document.getElementById(id); }
  function opt(v, t) { var o = document.createElement("option"); o.value = v; o.textContent = t; return o; }
  function num(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
  // Display only: Indian digit grouping (1,353 · 24,188 · 1,00,000), up to 2 decimals.
  function fmtNum(v) { if (v === "" || v == null) return "—"; var n = Number(v); if (isNaN(n)) return esc(String(v)); return n.toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
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

  /* ======================================================================
     SUPABASE DATA LAYER
     Replaces the Apps Script backend (ui.gs + JsonCreator.gs). It builds
     exactly the payloads the renderer below already expects:
       getBaseData()            -> { pos, pms, dms, districts, months }
       getWeeklyView(u, v, m)   -> { header, unitEmpId, month, weeks, roster }
       saveWeekly(emp, code, f) -> upserts review_responses
     Metric names, order and rules mirror JsonCreator.gs buildPoJson().
     ====================================================================== */
  function db() { return window.posSupabase; }

  var ROLE_TITLE = { PO: "Project Officer", PM: "Program Manager", DM: "Division Manager", COO: "COO" };
  var MON_LONG  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var MON_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // [label shown in the review, column in Supabase] — order = JsonCreator maps
  var VINOBA_COLS = [
    ["Total Schools", "total_schools"], ["Total Teachers", "total_teachers"],
    ["Unique Schools Posting", "unique_schools_posting"], ["Unique Teachers Posting", "unique_teachers_posting"],
    ["Total Posts", "total_posts"], ["Creative Writing", "creative_writing"], ["Storytelling", "storytelling"],
    ["Poetry Recitation", "poetry_recitation"], ["Spoken English", "spoken_english"],
    ["Total Lifeskills", "total_lifeskills"], ["Morning Assembly", "morning_assembly"], ["Spelling Bee", "spelling_bee"],
    ["Other Activities Total", "total_other_posts"], ["Streaks", "streaks"],
    ["Streak Storytelling", "streak_storytelling"], ["Streak Creative Writing", "streak_creative_writing"],
    ["Streak Poetry Recitation", "streak_poetry_recitation"], ["Streak Spoken English", "streak_spoken_english"],
    ["Expert Coupons Given", "coupons_given"], ["Expert Coupons Available", "coupons_available"],
    ["Expert Coupons Outstanding", "coupons_outstanding"], ["Expert Coupons Expired", "coupons_expired"],
    ["Star Teachers", "star_teachers"], ["Post Per Month Per Teacher", "post_per_month_per_teacher"]
    // POM Transformed Clusters / Block & District POM Winners are not shown (the winner columns are still
    // uploaded and stored in vinoba_data; POM transformed clusters is entered by the PO on the Monthly tab).
  ];
  // Staff Connect event report. Only these two columns belong to the block on the row:
  // summed over the blocks in scope (a PO sees just their own blocks).
  var SC_BLOCK_COLS = [
    ["Total Block Events", "total_block_events"],
    ["Teachers Felicitated at Block Level", "teachers_felicitated_block_level"]
  ];
  // Every other column is the DISTRICT's figure, repeated on each block row of that district
  // (e.g. "2 District Events" on Ahilyanagar's block A = the district held 2). Counted once per
  // district (highest value among its rows), then added across the districts in scope.
  var SC_DISTRICT_COLS = [
    ["Total District Events", "total_district_events"],
    ["Teachers Felicitated at District Level", "teachers_felicitated_district_level"],
    ["SU/NS Events", "su_ns_events"],
    ["Teachers Felicitated in SU/NS Events", "teachers_felicitated_su_ns_events"],
    ["Other Events", "other_events"],
    ["Teachers Felicitated in Other Events", "teachers_felicitated_other_events"],
    ["Cluster Heads Recognised", "cluster_heads_recognised"]          // added to the report Oct 2026
  ];
  var KEKA_COLS = [
    ["Working Days", "total_working_days"], ["Present Days", "present_days"], ["Absent Days", "absent_days"],
    ["Leaves", "leaves"], ["Regularized", "regularized"], ["Late Arrival", "late_arrival_days"],
    ["Missing Swipe Days", "missing_swipe_days"]
  ];
  var NIMBLE_KEYS  = ["Tickets Raised", "Tickets In Validation", "Tickets Closed"];
  var VISIT_KEYS   = ["Daily Forms Filed", "Visit Forms Filed", "School Visits", "Block Visits", "Cluster Visits",
                      "District Visits", "Program Dashboard Updated Yes", "Kathawli Yes", "ER Submitted", "ER Amount"];
  var DERIVED_KEYS = ["Form Completion %", "PO Form Filling Status", "Keka Punctual"];

  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function normBlock(v) { return String(v == null ? "" : v).toUpperCase().replace(/\s+/g, ""); }
  function normDist(v) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim().toLowerCase(); }
  function normId(v) { return String(v == null ? "" : v).trim().toUpperCase(); }
  function zeroOf(cols) { var o = {}; cols.forEach(function (c) { o[c[0]] = 0; }); return o; }
  function blankOf(keys) { var o = {}; keys.forEach(function (k) { o[k] = ""; }); return o; }
  function byNameSort(a, b) { return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0); }
  function prevMonthCode(ym) {
    var y = Number(ym.substring(0, 4)), m = Number(ym.substring(4, 6)) - 1;
    if (m < 1) { m = 12; y -= 1; }
    return "" + y + pad2(m);
  }

  // PostgREST returns at most 1000 rows per request — page through bigger results.
  async function fetchAll(build) {
    var out = [], from = 0, size = 1000;
    for (;;) {
      var res = await build().range(from, from + size - 1);
      if (res.error) throw res.error;
      out = out.concat(res.data || []);
      if (!res.data || res.data.length < size) return out;
      from += size;
    }
  }

  /* ---------- org structure (assignments + locations), cached per page load ---------- */
  var ORG = null;
  async function loadOrg(force) {
    if (ORG && !force) return ORG;
    var r = await Promise.all([
      fetchAll(function () { return db().from("states").select("id,name"); }),
      fetchAll(function () { return db().from("districts").select("id,name,state_id,division"); }),
      fetchAll(function () { return db().from("blocks").select("id,name,district_id"); }),
      fetchAll(function () { return db().from("assignments").select("*").eq("status", "active"); })
    ]);
    var stateById = {}; r[0].forEach(function (s) { stateById[s.id] = s.name; });
    var distById = {}, distByKey = {};
    r[1].forEach(function (d) {
      var rec = { id: d.id, name: d.name, state: stateById[d.state_id] || "", division: d.division || "", blocks: [] };
      distById[d.id] = rec; distByKey[normDist(d.name)] = rec;
    });
    r[2].forEach(function (b) { var d = distById[b.district_id]; if (d) d.blocks.push(b.name); });
    ORG = { districts: r[1].map(function (d) { return distById[d.id]; }), distByKey: distByKey, people: r[3] };
    return ORG;
  }
  function person(empId) {
    var id = normId(empId);
    return ORG.people.filter(function (p) { return normId(p.emp_id) === id; })[0] || null;
  }
  function overlaps(a, b) {
    var s = {}; (a || []).forEach(function (x) { s[normDist(x)] = 1; });
    return (b || []).some(function (x) { return s[normDist(x)]; });
  }
  // Reporting line is decided by district overlap (Org Admin design).
  function peopleOver(role, districts) {
    return ORG.people.filter(function (p) { return p.designation === role && overlaps(p.assigned_districts, districts); })
                     .sort(byNameSort);
  }
  function blocksOfDistricts(districts) {
    var out = [], seen = {};
    (districts || []).forEach(function (dn) {
      var d = ORG.distByKey[normDist(dn)]; if (!d) return;
      d.blocks.forEach(function (b) { var k = normBlock(b); if (!seen[k]) { seen[k] = 1; out.push(b); } });
    });
    return out;
  }
  function distInfo(districts) {
    var d = ORG.distByKey[normDist((districts || [])[0])];
    return { state: d ? d.state : "", division: d ? d.division : "" };
  }

  /* ---------- dropdowns ---------- */
  async function sbGetBaseData() {
    await loadOrg(true);
    var periods = await fetchAll(function () { return db().from("data_periods").select("year,month"); });
    var seen = {}, months = [];
    periods.forEach(function (p) {
      var code = "" + p.year + pad2(p.month);
      if (!seen[code]) { seen[code] = 1; months.push({ code: code, label: MON_LONG[p.month - 1] + " " + p.year }); }
    });
    months.sort(function (a, b) { return a.code < b.code ? -1 : 1; });
    // The month after the latest uploaded month opens too (no data yet), so POs can write
    // its action points ahead; it becomes a normal month once its data is uploaded.
    if (months.length) {
      var last = months[months.length - 1].code, ly = Number(last.substring(0, 4)), lm = Number(last.substring(4, 6));
      var ny = lm === 12 ? ly + 1 : ly, nm = lm === 12 ? 1 : lm + 1;
      months.push({ code: "" + ny + pad2(nm), label: MON_LONG[nm - 1] + " " + ny + " (no data yet)" });
    }
    function list(role) {
      return ORG.people.filter(function (p) { return p.designation === role; })
                       .map(function (p) { return { empId: p.emp_id, name: p.name }; }).sort(byNameSort);
    }
    return {
      pos: list("PO"), pms: list("PM"), dms: list("DM"),
      districts: ORG.districts.map(function (d) { return d.name; }).sort(),
      months: months
    };
  }

  /* ---------- the weekly view ---------- */
  async function sbGetWeeklyView(unit, value, month) {
    await loadOrg();
    var y = Number(month.substring(0, 4)), m = Number(month.substring(4, 6));
    var self = null, districts, blockNames, team = [];

    if (unit === "PO") {
      self = person(value);
      if (!self) throw new Error("No active assignment found for " + value + ".");
      districts = self.assigned_districts || [];
      blockNames = self.assigned_blocks || [];
    } else if (unit === "PM" || unit === "DM") {
      self = person(value);
      if (!self) throw new Error("No active assignment found for " + value + ".");
      districts = self.assigned_districts || [];
      blockNames = blocksOfDistricts(districts);
      team = peopleOver("PO", districts);
    } else {                                   // District
      districts = [value];
      blockNames = blocksOfDistricts(districts);
      team = peopleOver("PO", districts);
    }
    var unitEmpId = self ? self.emp_id : "";
    var header = buildHeader(unit, value, self, districts, blockNames, team);

    var blockKeys = blockNames.map(normBlock), distKeys = districts.map(normDist);
    var codes = [], prevCodes = [], pm = prevMonthCode(month);
    for (var w = 0; w <= 5; w++) codes.push(month + pad2(w));
    for (var w2 = 0; w2 <= 5; w2++) prevCodes.push(pm + pad2(w2));   // 00 = previous monthly review

    var NONE = Promise.resolve([]);
    var q = await Promise.all([
      fetchAll(function () { return db().from("data_periods").select("week").eq("year", y).eq("month", m); }),
      blockKeys.length ? fetchAll(function () { return db().from("vinoba_v").select("*").eq("year", y).eq("month", m).in("block_key", blockKeys); }) : NONE,
      distKeys.length  ? fetchAll(function () { return db().from("staffconnect_v").select("*").eq("year", y).eq("month", m).in("district_key", distKeys); }) : NONE,
      unitEmpId ? fetchAll(function () { return db().from("keka_data").select("*").eq("year", y).eq("month", m).eq("employee_id", unitEmpId); }) : NONE,
      unitEmpId ? fetchAll(function () { return db().from("er_data").select("*").eq("year", y).eq("month", m).eq("employee_id", unitEmpId); }) : NONE,
      unitEmpId ? fetchAll(function () { return db().from("nimble_data").select("*").eq("year", y).eq("month", m).eq("emp_id", unitEmpId); }) : NONE,
      unitEmpId ? fetchAll(function () { return db().from("visitandactivity_data").select("*").eq("year", y).eq("month", m).eq("emp_id", unitEmpId); }) : NONE,
      unitEmpId ? fetchAll(function () { return db().from("review_responses").select("*").eq("emp_id", unitEmpId).in("period_code", codes.concat(prevCodes)); }) : NONE
    ]);
    var weeksWithData = {}; q[0].forEach(function (r) { weeksWithData[r.week] = 1; });
    var own = sectionsByCode(q[7]);
    var evMonth = MON_SHORT[m - 1] + "-" + y;   // Staff Connect "Month" column, e.g. "Sep-2026"

    var weeks = [];
    for (var wk = 0; wk <= 5; wk++) {
      var code = month + pad2(wk);
      var rp = weeksWithData[wk] ? buildReadPoints(wk, !!unitEmpId, blockKeys, distKeys, evMonth,
                 q[1], q[2], q[3], q[4], q[5], q[6]) : {};
      var carry = { B1: "", B2: "", B3: "", B4: "", B5: "" };
      if (wk === 0) applyCarry(carry, (own[pm + "00"] || {}).G);      // Monthly tab: last month's plan
      else if (wk >= 2) applyCarry(carry, (own[month + pad2(wk - 1)] || {}).G);
      else if (wk === 1) {
        for (var pw = 5; pw >= 1; pw--) {
          var prev = own[pm + pad2(pw)];
          if (prev && prev.G) { applyCarry(carry, prev.G); break; }
        }
      }
      weeks.push({ week: wk, code: code, sections: own[code] || {}, readPoints: rp,
                   prefill: {}, carryForward: carry, verified: null });
    }

    var roster = null;
    if (unit === "PM" || unit === "DM") {
      var members = unit === "PM"
        ? team.map(function (p) { return { id: p.emp_id, name: p.name }; })
        : peopleOver("PM", districts).map(function (p) { return { id: p.emp_id, name: p.name }; });
      var ids = members.map(function (x) { return x.id; });
      var rr = ids.length ? await fetchAll(function () { return db().from("review_responses").select("emp_id,period_code,section,field,value").in("emp_id", ids).in("period_code", codes); }) : [];
      var byEmp = {};
      rr.forEach(function (r) { (byEmp[r.emp_id] = byEmp[r.emp_id] || []).push(r); });
      var byWeek = {};
      codes.forEach(function (c) {
        byWeek[c] = {};
        members.forEach(function (mb) { byWeek[c][mb.id] = reviewStatusOf((sectionsByCode(byEmp[mb.id] || [])[c])); });
      });
      roster = { kind: unit === "PM" ? "PO" : "PM", members: members, byWeek: byWeek };
    }
    return { header: header, unitEmpId: unitEmpId, month: month, weeks: weeks, roster: roster };
  }

  function buildHeader(unit, value, self, districts, blockNames, team) {
    var di = distInfo(districts);
    var pmP = peopleOver("PM", districts)[0] || null, dmP = peopleOver("DM", districts)[0] || null;
    var cooP = peopleOver("COO", districts)[0] || ORG.people.filter(function (p) { return p.designation === "COO"; })[0] || null;
    var lc = function (s) { return String(s || "").toLowerCase(); };
    var blocks = blockNames.map(function (b) { return { key: normBlock(b), name: b }; });
    if (unit === "PO") {
      return {
        unit: unit,
        po: { name: self.name, empId: self.emp_id, designation: ROLE_TITLE.PO, email: self.email || "" },
        state: di.state, division: di.division, district: districts.join(", "),
        pm: pmP ? { name: pmP.name, id: pmP.emp_id, email: pmP.email || "", designation: ROLE_TITLE.PM } : { name: "" },
        dm: dmP ? { name: dmP.name, id: dmP.emp_id, email: dmP.email || "", designation: ROLE_TITLE.DM } : { name: "" },
        coo: cooP ? { name: cooP.name, id: cooP.emp_id, email: cooP.email || "" } : { name: "" },
        blocks: blocks, poCount: 1,
        selfEmpId: self.emp_id,
        selfEmail: lc(self.email),                      // the PO fills A/B/G
        managerEmail: lc(pmP && pmP.email)              // the PM fills H
      };
    }
    var selfEmail = "", managerEmail = "";
    if (unit === "PM") { selfEmail = lc(self.email); managerEmail = lc(dmP && dmP.email); }
    if (unit === "DM") { selfEmail = lc(self.email); managerEmail = lc(cooP && cooP.email); }
    return {
      unit: unit,
      manager: self ? self.name : "", managerId: self ? self.emp_id : "",
      selfEmpId: self ? self.emp_id : "", selfEmail: selfEmail, managerEmail: managerEmail,
      district: unit === "District" ? value : "",
      division: di.division, state: di.state,
      dm: unit === "PM" && dmP ? dmP.name : "",
      coo: cooP ? cooP.name : "",
      pos: team.map(function (p) { return { name: p.name, empId: p.emp_id }; }),
      blocks: blocks, districts: districts,
      poCount: team.length, pmCount: peopleOver("PM", districts).length
    };
  }

  /* One week's readPoints — same groups, keys and rules as JsonCreator buildPoJson(). */
  function buildReadPoints(wk, hasSelf, blockKeys, distKeys, evMonth, vin, sc, keka, er, nim, va) {
    var inWeek = function (r) { return r.week === wk; };
    var bset = {}; blockKeys.forEach(function (k) { bset[k] = 1; });

    // Vinoba: block metrics summed over the unit's blocks
    var vinoba = zeroOf(VINOBA_COLS), seen = {}, anyRow = false;
    vin.filter(inWeek).forEach(function (r) {
      if (!bset[r.block_key]) return;
      anyRow = true;
      VINOBA_COLS.forEach(function (c) {
        if (!c[1]) return;
        if (r[c[1]] !== null && r[c[1]] !== undefined && r[c[1]] !== "") seen[c[0]] = 1;
        vinoba[c[0]] += num(r[c[1]]);
      });
    });
    // Columns added to the report later (e.g. Morning Assembly) are empty in uploads made
    // with the older format: show them as blank ("—"), not as a misleading 0.
    if (anyRow) VINOBA_COLS.forEach(function (c) { if (c[1] && !seen[c[0]]) vinoba[c[0]] = ""; });

    // Staff Connect: block metrics summed; district metrics once per district.
    // Only events for the month under review (the report can mix months).
    var scRows = sc.filter(function (r) { return inWeek(r) && (!r.event_month || String(r.event_month).trim() === evMonth); });
    // Columns added to the report later: uploads made before they existed hold null there
    // (newer uploads store blanks as 0), so all-null means "not in that upload" -> show "—".
    var SC_LATE = { "Cluster Heads Recognised": 1 };
    // Block level: summed over the unit's own blocks.
    var staff = zeroOf(SC_BLOCK_COLS);
    scRows.forEach(function (r) {
      if (!bset[r.block_key]) return;
      SC_BLOCK_COLS.forEach(function (c) { staff[c[0]] += num(r[c[1]]); });
    });
    // District level: once per district (any block row of the district carries it), summed across districts.
    var distTotals = zeroOf(SC_DISTRICT_COLS), dSeen = {}, dAny = false;
    distKeys.forEach(function (dk) {
      var drows = scRows.filter(function (r) { return r.district_key === dk; });
      if (!drows.length) return;
      dAny = true;
      SC_DISTRICT_COLS.forEach(function (c) {
        var best = 0;
        drows.forEach(function (r) {
          var v = r[c[1]];
          if (v !== null && v !== undefined && v !== "") { dSeen[c[0]] = 1; best = Math.max(best, num(v)); }
        });
        distTotals[c[0]] += best;
      });
    });
    if (dAny) Object.keys(SC_LATE).forEach(function (k) { if (!dSeen[k]) distTotals[k] = ""; });
    for (var k in distTotals) staff[k] = distTotals[k];

    var evBlocks = {};
    scRows.forEach(function (r) { if (bset[r.block_key] && num(r.total_block_events) > 0) evBlocks[r.block_key] = 1; });
    var out = { vinoba: vinoba, staffConnect: staff, extra: { "Blocks With Events": Object.keys(evBlocks).length } };
    if (!hasSelf) {   // District view: individual sources are not summable (old aggregateReadPoints)
      out.keka = blankOf(KEKA_COLS.map(function (c) { return c[0]; }));
      out.nimble = blankOf(NIMBLE_KEYS); out.visit = blankOf(VISIT_KEYS); out.derived = blankOf(DERIVED_KEYS);
      return out;
    }

    // Keka (by Employee ID)
    var kRows = keka.filter(inWeek), kk = zeroOf(KEKA_COLS);
    kRows.forEach(function (r) { KEKA_COLS.forEach(function (c) { kk[c[0]] += num(r[c[1]]); }); });

    // Nimble (alias-matched emp_id). Closed = has a close date; otherwise "in Validate" when the
    // board column mentions validate (Validate, Resolution#Validate, Notification Validated…); the rest are open.
    var tickets = nim.filter(inWeek), raised = tickets.length, closed = 0, inVal = 0;
    tickets.forEach(function (t) {
      if (t.date_closed != null && String(t.date_closed).trim() !== "") closed++;
      else if (/validat/i.test(String(t.board_column || ""))) inVal++;
    });

    // Visit & Activity (alias-matched emp_id), summed across the person's rows
    var v = { daily: 0, visit: 0, school: 0, block: 0, cluster: 0, district: 0, dash: 0, kath: 0 };
    va.filter(inWeek).forEach(function (r) {
      v.daily += num(r.form_filled_activity); v.visit += num(r.form_filled_visit);
      v.school += num(r.school_visits); v.block += num(r.block_visits); v.cluster += num(r.cluster_visits);
      v.district += num(r.district_visit); v.dash += num(r.program_dashboard_updated_yes); v.kath += num(r.kathavli_yes);
    });

    // ER (by Employee ID): Status "Submitted" or "Locked" -> submitted
    var erRow = er.filter(inWeek)[0] || null;
    var erStatus = erRow ? String(erRow.status || "").trim() : "";
    var erSubmitted = /^(submitted|locked)$/i.test(erStatus);
    out.extra["ER Status"] = erStatus;                       // Monthly "why" text only (not a weekly row)
    out.extra["Tickets Open"] = raised - closed - inVal;

    out.keka = kk;
    out.nimble = { "Tickets Raised": raised, "Tickets In Validation": inVal, "Tickets Closed": closed };
    out.visit = {
      "Daily Forms Filed": v.daily, "Visit Forms Filed": v.visit, "School Visits": v.school,
      "Block Visits": v.block, "Cluster Visits": v.cluster, "District Visits": v.district,
      "Program Dashboard Updated Yes": v.dash, "Kathawli Yes": v.kath,
      "ER Submitted": erSubmitted ? "Yes" : (erStatus ? "No" : ""),
      "ER Amount": erRow ? num(erRow.amount) : 0
    };
    var wd = num(kk["Working Days"]);
    out.derived = {
      "Form Completion %": wd > 0 ? Math.round((v.daily / wd) * 1000) / 10 : 0,
      "PO Form Filling Status": v.daily,
      "Keka Punctual": kRows.length ? ((num(kk["Late Arrival"]) + num(kk["Missing Swipe Days"])) === 0 ? "Y" : "N") : ""
    };
    return out;
  }

  /* review_responses rows -> { periodCode: { A: {A1:..., _by, _at}, B: {...} } } */
  function sectionsByCode(rows) {
    var out = {};
    (rows || []).forEach(function (r) {
      var c = out[r.period_code] = out[r.period_code] || {};
      var s = c[r.section] = c[r.section] || {};
      s[r.field] = r.value;
      if (!s._at || r.updated_at > s._at) { s._at = r.updated_at; s._by = r.updated_by; }
    });
    return out;
  }
  function applyCarry(carry, g) {
    if (!g) return;
    carry.B1 = g.G2 || ""; carry.B2 = g.G3 || ""; carry.B3 = g.G4 || ""; carry.B4 = g.G5 || ""; carry.B5 = g.G6 || "";
  }
  function reviewStatusOf(s) {
    if (!s) return "none";
    var n = [secFilled({ sections: s }, "A"), secFilled({ sections: s }, "B"),
             secFilled({ sections: s }, "G"), secFilled({ sections: s }, "H")].filter(Boolean).length;
    return n === 4 ? "done" : (n > 0 ? "partial" : "none");
  }

  /* ---------- save (field-level upsert; PO and PM saves never clobber each other) ---------- */
  async function sbSaveWeekly(empId, code, fields, by) {
    if (!empId) throw new Error("This view has no single owner \u2014 open a PO, PM or DM review to edit.");
    var now = new Date().toISOString(), rows = [];
    Object.keys(fields).forEach(function (key) {
      if (!/^[A-H][0-9]/.test(key) && !/^M_[A-Z0-9_]+$/.test(key)) return;   // A1..H3 review answers, M_* monthly goal entries
      rows.push({ emp_id: empId, period_code: code, section: key.charAt(0), field: key,
                  value: fields[key], updated_by: by, updated_at: now });
    });
    if (!rows.length) return;
    var res = await db().from("review_responses").upsert(rows, { onConflict: "emp_id,period_code,field" });
    if (res.error) throw res.error;
  }


  function mount() {
    var root = $("ftrRoot"); if (!root || root.dataset.mounted === "1") return;
    root.dataset.mounted = "1";
    if (!window.posSupabase) { prBody('<div class="pr-empty">Supabase client not loaded — check that pos-supabase.js is included.</div>'); return; }
    wireNav(); wireFilters(); wireMonthly();
    if ($("prModalSave")) $("prModalSave").addEventListener("click", saveTextModal);
    if ($("prModalClose")) $("prModalClose").addEventListener("click", closeTextModal);
    if ($("prModalText")) $("prModalText").addEventListener("input", updateModalMsg);
    if ($("prListClose")) $("prListClose").addEventListener("click", closeAcadList);
    if ($("prListModal")) $("prListModal").addEventListener("click", function (e) { if (e.target === $("prListModal")) closeAcadList(); });
    loadBaseData();
  }
  function prBody(html) { var b = $("prBody"); if (b) b.innerHTML = html; }

  /* ---------- nav ---------- */
  function wireNav() {
    var btns = document.querySelectorAll("#prNav .pr-navbtn");
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        btns.forEach(function (x) { x.classList.remove("is-active"); });
        b.classList.add("is-active");
        var v = b.dataset.view;
        ["weekly", "summary", "monthly"].forEach(function (name) {
          var el = $("pr" + name.charAt(0).toUpperCase() + name.slice(1)); if (el) el.hidden = (name !== v);
        });
        if (v === "monthly") moSyncFromWeekly();
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
  function loadBaseData() {
    setLoadingDropdowns();
    prBody('<div class="pr-empty">Loading base data\u2026</div>');
    sbGetBaseData().then(function (data) {
      state.base = data;
      var mo = $("prMonth"); mo.innerHTML = "";
      if (!data.months.length) { mo.innerHTML = '<option value="">No months</option>'; }
      else { mo.appendChild(opt("", "Select…")); data.months.forEach(function (m) { mo.appendChild(opt(m.code, m.label)); }); }
      mo.disabled = false;
      populateValue($("prUnit").value);
      moFillFromBase();
      prBody('<div class="pr-empty">Choose a review unit, a value and a month, then open the review.</div>');
    }).catch(function (e) {
      prBody('<div class="pr-empty">Couldn\'t load base data: ' + esc(e.message || String(e)) + '</div>');
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
    SELWK = { 1: true, 2: true, 3: true, 4: true, 5: true };
    prBody('<div class="pr-empty">Loading review…</div>');
    sbGetWeeklyView(unit, value, month).then(function (data) {
      VIEW = data; renderWeeklyView();
    }).catch(function (e) { prBody('<div class="pr-empty">Couldn\'t load: ' + esc(e.message || String(e)) + "</div>"); });
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
  function calWeeks() { return [1, 2, 3, 4, 5].map(weekByNum); }   // always Week 1-5, with or without data
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
                    moved: r.moved, locked: false, adminUnlock: false };
      }
    }
  }
  /* Editing is decided by WHO you are, never by which week it is.
     Owners (PO: A/B/G, PM: H) can always edit any week; everyone else views. */
  function weekLocked() { return false; }

  function prIsAdmin() { return currentEmail() === ADMIN_EMAIL; }
  function canEditSelf(v) { v = v || VIEW; var h = (v && v.header) || {}; if (!h.selfEmpId) return false; var e = h.selfEmail || ""; return prIsAdmin() || (!!currentEmail() && currentEmail() === e); }
  function canEditManager(v) { v = v || VIEW; var h = (v && v.header) || {}; if (!h.selfEmpId) return false; var e = h.managerEmail || ""; return prIsAdmin() || (!!currentEmail() && currentEmail() === e); }
  function renderWeeklyView() {
    computeCalendar();
    Object.keys(CELL_VALS).forEach(function (k) { if (!/00\|/.test(k)) delete CELL_VALS[k]; });   // keep Monthly's
    var h = VIEW.header || {};
    var html = renderHeader(h) + renderBlocks(h) + renderCards() + renderTable();
    var canEdit = canEditSelf() || canEditManager();
    if (canEdit) html += '<div class="pr-savebar"><span class="pr-savehint">You can edit the sections your role owns.</span>'
      + '<button class="pr-btn pr-btn-primary" id="prSave">Save review</button></div>';
    prBody(html);
    bindTable();
    bindWeekSel();
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

  function renderBlocks(h, v) {
    v = v || VIEW;
    if (v.roster && v.roster.members) {
      var kind = v.roster.kind === "PM" ? "PMs" : "POs";
      var mc = v.roster.members.map(function (m) {
        return '<span class="pr-chip">' + esc(m.name) + (m.total ? ' <code>' + m.total + ' PO' + (m.total > 1 ? "s" : "") + '</code>' : "") + '</span>';
      }).join("");
      return '<div class="pr-panel"><div class="pr-blocks-h">Team — ' + kind + '<b>' + v.roster.members.length + '</b></div><div class="pr-chips">' + mc + '</div></div>';
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

  // Week columns shown in the table (all by default; at least one stays).
  var SELWK = { 1: true, 2: true, 3: true, 4: true, 5: true };
  function applyWeekSel() {
    var vis = [1, 2, 3, 4, 5].filter(function (n) { return SELWK[n]; });
    document.querySelectorAll("#prBody [data-wk]").forEach(function (el) {
      var n = Number(el.dataset.wk), on = !!SELWK[n];
      if (el.classList.contains("pr-wkcard")) {
        el.classList.toggle("is-sel", on); el.classList.toggle("is-off", !on);
        var t = el.querySelector(".pr-wk-vis"); if (t) t.textContent = on ? "Shown" : "Hidden";
        return;
      }
      el.classList.toggle("pr-wkhide", !on);
      el.classList.toggle("pr-wkalt", on && vis.indexOf(n) % 2 === 1);   // alternate tint between neighbouring weeks
    });
  }
  function bindWeekSel() {
    document.querySelectorAll("#prBody .pr-wkcard[data-wk]").forEach(function (c) {
      c.addEventListener("click", function () {
        var n = Number(c.dataset.wk);
        if (SELWK[n] && [1, 2, 3, 4, 5].filter(function (k) { return SELWK[k]; }).length === 1) { toast("At least one week stays visible."); return; }
        SELWK[n] = !SELWK[n]; applyWeekSel();
      });
    });
    var all = $("prWkAll");
    if (all) all.addEventListener("click", function () { SELWK = { 1: true, 2: true, 3: true, 4: true, 5: true }; applyWeekSel(); });
    applyWeekSel();
  }

  function weekCardHtml(w) {
    var c = CAL[w.week] || {};
    var flags = ["A", "B", "G", "H"].map(function (k) { return secFilled(w, k); });   // bar 1=A, 2=B, 3=G, 4=H
    var filled = flags.filter(Boolean).length;
    var bars = flags.map(function (f) { return '<span class="pr-bar ' + (f ? "on" : "off") + '"></span>'; }).join("");
    var state = filled === 4 ? " complete" : filled > 0 ? " partial" : "";
    var remark = filled === 4 ? "Completed" : filled > 0 ? "Partially completed" : "Not started yet";
    var lock = "";   // no time-based locking — owners can edit any week
    return '<div class="pr-card pr-wkcard' + state + '" data-wk="' + w.week + '" role="button" tabindex="0" title="Click to show or hide Week ' + w.week + '">'
      + '<div class="pr-card-k"><span>Week ' + w.week + '</span>' + lock + '<span class="pr-wk-vis">Shown</span></div>'
      + '<div class="pr-bars">' + bars + '</div>'
      + '<div class="pr-wkcard-foot"><span>' + remark + '</span><span></span></div></div>';
  }
  function renderCards() {
    var cards = "";
    calWeeks().forEach(function (w) { cards += weekCardHtml(w); });
    return '<div class="pr-cards-hint">Click a week to show or hide its column \u00B7 <button type="button" class="pr-linkbtn" id="prWkAll">Show all weeks</button></div>'
      + '<div class="pr-cards pr-wkcards">' + cards + '</div>';
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
    var present = calWeeks(), mtd = null;   // All Month (week 0) data is shown in the Monthly tab, not here
    if (!present.length) return '<div class="pr-panel"><div class="pr-empty">No weekly data uploaded for this month yet — upload it under Admin \u2192 Data (All Month uploads appear in the Monthly tab).</div></div>';
    var totalCols = 1 + present.length + (mtd ? 1 : 0);

    var head = '<tr><th class="pr-item">Item</th>';
    present.forEach(function (w) {
      var c = CAL[w.week] || {};
      head += '<th class="pr-num pr-wkh" data-wk="' + w.week + '">Week ' + w.week + '</th>';   // weeks are upload slots, not dates
    });
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
      if (!S.write && !rows.length) {
        body += '<tr class="pr-row pr-hidden" data-secrow="' + S.k + '"><td class="pr-item pr-mut">No data uploaded for this month yet</td>';
        present.forEach(function (w) { body += '<td class="pr-num pr-wkc" data-wk="' + w.week + '"><span class="pr-mut">\u2014</span></td>'; });
        body += "</tr>";
      }
      rows.forEach(function (r) {
        body += '<tr class="pr-row pr-hidden" data-secrow="' + S.k + '">';
        body += '<td class="pr-item">' + esc(r.label) + '</td>';
        present.forEach(function (w) {
          body += '<td class="' + (r.data ? "pr-num " : "") + 'pr-wkc" data-wk="' + w.week + '">' + (r.data ? dataVal(r, w) : renderCell(S, r, w, editable)) + '</td>';
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
        html += '<td class="pr-num pr-wkc" data-wk="' + w.week + '"><span class="' + cls + '">' + text + '</span></td>';
      });
      if (mtd) html += '<td class="pr-num pr-mtd"><span class="pr-mut">\u2014</span></td>';
      html += '</tr>';
    });
    return html;
  }


  var CELL_VALS = {};
  var TEXT_MAX = 150;
  function openTextModal(btn) {
    var wc = btn.dataset.wc, fid = btn.dataset.fid, ed = btn.dataset.ed === "1", label = btn.dataset.label || "";
    $("prModalTitle").textContent = (ed ? "Edit" : "View") + " \u2014 " + label;
    var ta = $("prModalText");
    ta.value = CELL_VALS[wc + "|" + fid] || ""; ta.readOnly = !ed; ta.maxLength = TEXT_MAX;
    var sb = $("prModalSave"); sb.hidden = !ed; sb.dataset.wc = wc; sb.dataset.fid = fid; sb.dataset.key = wc + "|" + fid;
    updateModalMsg();
    if (!ed) $("prModalMsg").textContent = "";       // no character counter when only viewing
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
    var cell = document.querySelector('.pr .pr-iconbtn[data-wc="' + wc + '"][data-fid="' + fid + '"]');
    if (cell) cell.classList.toggle("has-val", !!(val && val.trim()));
    closeTextModal();
  }
  function closeTextModal() { $("prModal").hidden = true; }
  function renderCell(S, r, w, editable) {
    var sec = (w.sections || {})[S.k] || {};
    var stored = sec[r.id];
    var ro = !editable;                 // identity only — past weeks stay editable
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
      var carryHtml;
      if (carry) {
        CELL_VALS[wc + "|V" + fid] = carry;   // read-only copy for the View popup
        carryHtml = '<button type="button" class="pr-viewbtn" data-wc="' + wc + '" data-fid="V' + fid + '" data-ed="0" data-label="' + esc(r.label)
          + '" title="' + esc(carry) + '">View action</button>';
      } else carryHtml = '<span class="pr-carry-none">' + none + "</span>";
      if (ro) return '<div class="pr-bcell">' + carryHtml + (st ? '<span class="pr-bstat">' + esc(st) + "</span>" : '<span class="pr-mut">—</span>') + "</div>";
      return '<div class="pr-bcell">' + carryHtml + seg(wc, fid, B_STATUS.map(function (o) { return [o, o]; }), st, esc(carry)) + "</div>";
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

  function bindTable(root) {
    root = root || "#prBody";
    // accordions (collapsed by default)
    document.querySelectorAll(root + " .pr-grp").forEach(function (g) {
      g.addEventListener("click", function () {
        var open = g.classList.toggle("is-open");
        g.querySelector(".pr-caret").textContent = open ? "▾" : "▸";
        document.querySelectorAll(root + ' .pr-row[data-secrow="' + g.dataset.grp + '"]').forEach(function (tr) { tr.classList.toggle("pr-hidden", !open); });
      });
    });
    document.querySelectorAll(root + " .pr-iconbtn").forEach(function (b) { b.addEventListener("click", function () { openTextModal(b); }); });
    document.querySelectorAll(root + " .pr-viewbtn").forEach(function (b) { b.addEventListener("click", function () { openTextModal(b); }); });
    // segmented
    document.querySelectorAll(root + " .pr-seg").forEach(function (s) {
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
    document.querySelectorAll(root + " textarea[data-fid], " + root + " select[data-fid]").forEach(function (el) {
      var h = function () { markDirty(el.dataset.wc, el.dataset.fid, el.value); };
      el.addEventListener("input", h); el.addEventListener("change", h);
    });
  }
  function markDirty(wc, fid, val) {
    var map = /00$/.test(wc) ? MDIRTY : DIRTY;   // YYYYMM00 = Monthly tab, weeks 01-05 = Weekly
    (map[wc] = map[wc] || {})[fid] = val;
  }

  function saveAll() {
    var codes = Object.keys(DIRTY).filter(function (c) { return Object.keys(DIRTY[c]).length; });
    if (!codes.length) { toast("Nothing to save yet."); return; }
    var btn = $("prSave"); btn.disabled = true; btn.innerHTML = '<span class="pr-spin"></span>Saving…';
    var empId = VIEW.header.selfEmpId, failed = 0;
    Promise.all(codes.map(function (code) {
      return sbSaveWeekly(empId, code, DIRTY[code], currentEmail()).catch(function (e) { failed++; console.error("Save failed for " + code, e); });
    })).then(function () {
      btn.disabled = false; btn.textContent = "Save review";
      if (failed) {
        var hint = document.querySelector("#prBody .pr-savehint");
        if (hint) { hint.textContent = "\u26A0 Save failed for " + failed + " week(s) \u2014 click Save again to retry. Your changes are NOT lost."; hint.classList.add("is-fail"); }
        toast("Save failed \u2014 please click Save again to retry.");
      } else {
        toast("Saved."); DIRTY = {}; loadWeeklyView();
      }
    });
  }


  /* ======================================================================
     MONTHLY TAB — Sheet B monthly scorecard
     Same design language as Weekly. A / B / G / H are the same review blocks
     as Weekly, saved for period YYYYMM00 (one per month). In between sit the
     five goals G1–G5, each line scored as  Target -> Done -> % -> Score.
     "Done" is filled from the All-Month (week 0) uploads wherever a file
     carries it. Targets, and goal items people will type in, are not stored
     yet: those cells show "Not set" / "To be entered" until that is built.
     Weights follow the Monthly-tab architecture deck (Sheet B).
     ====================================================================== */
  var MVIEW = null;                // last monthly payload (same shape as VIEW)
  var MDIRTY = {};                 // { "YYYYMM00": { fieldId: value } }

  var MO_SEC = {
    A: { k: "A", title: "Check-in", who: "PO", write: true, rows: [
      { id: "A1", label: "How are you feeling this month?", type: "mood" },
      { id: "A2", label: "Anything on your mind?", type: "text" } ] },
    B: { k: "B", title: "Last month's actions", who: "PO", write: true, rows: [1, 2, 3, 4, 5].map(function (n) {
      return { id: "B" + n, label: "Action " + n + " from last month", type: "prog" }; }) },
    G: { k: "G", title: "Next month", who: "PO", write: true, rows: [{ id: "G1", label: "Blocker or escalation", type: "text" }]
      .concat([1, 2, 3, 4, 5].map(function (n) { return { id: "G" + (n + 1), label: "Action " + n + " for next month", type: "text" }; })) },
    H: { k: "H", title: "Review record", who: "PM", write: true, rows: [
      { id: "H1", label: "Review held", type: "yn" },
      { id: "H2", label: "Manager status", type: "status" },
      { id: "H3", label: "Manager's remark", type: "text" } ] }
  };

  // value helpers over one month's readPoints (rp = week 0 of the view)
  function mv(rp, g, k) { var grp = rp && rp[g]; if (!grp || grp[k] === undefined || grp[k] === "") return null; return num(grp[k]); }
  function msum(rp, g, keys) {
    var vals = keys.map(function (k) { return mv(rp, g, k); });
    return vals.every(function (v) { return v === null; }) ? null : vals.reduce(function (a, v) { return a + (v || 0); }, 0);
  }
  function A(fn, src) { return { auto: fn, src: src }; }           // filled from an upload
  var NA = { na: true };                                              // no file carries it yet
  var UE = { entry: true };                                           // will be typed in the UI
  var NE = { numentry: true };                                        // a number typed by the PO (saved as M_ field)

  // lvl: 0 = component (carries weight), 1 = item / sub-component, 2 = sub-item
  var MO_GOALS = [
    { key: "G1", title: "Academic Programs", weight: 40, rows: [
      { lvl: 0, label: "Exams planned this month", w: 40, academic: true,
        note: "Planned: from Admin \u2192 Academic Plan \u00B7 click the number to see the exams. Done: enter how many of them were completed." } ] },

    { key: "G2", title: "Life Skills Programs", weight: 20, rows: [
      { lvl: 0, label: "LS Program Cycle (Core)", w: 10, v: A(function (rp) { return msum(rp, "vinoba", ["Storytelling", "Creative Writing", "Poetry Recitation", "Spoken English"]); }, "Vinoba \u00B7 sum of the four core programs") },
      { lvl: 1, label: "Storytelling",     v: A(function (rp) { return mv(rp, "vinoba", "Storytelling"); }, "Vinoba") },
      { lvl: 1, label: "Creative Writing", v: A(function (rp) { return mv(rp, "vinoba", "Creative Writing"); }, "Vinoba") },
      { lvl: 1, label: "Poetry",           v: A(function (rp) { return mv(rp, "vinoba", "Poetry Recitation"); }, "Vinoba") },
      { lvl: 1, label: "Spoken English",   v: A(function (rp) { return mv(rp, "vinoba", "Spoken English"); }, "Vinoba") },
      { lvl: 0, label: "LS Program Cycle (Non-core)", w: 0, v: A(function (rp) { return msum(rp, "vinoba", ["Morning Assembly", "Spelling Bee"]); }, "Vinoba \u00B7 Morning Assembly + Spelling Bee") },
      { lvl: 1, label: "Morning Assembly", v: A(function (rp) { return mv(rp, "vinoba", "Morning Assembly"); }, "Vinoba \u00B7 morning_assembly") },
      { lvl: 1, label: "Spelling Bee", v: A(function (rp) { return mv(rp, "vinoba", "Spelling Bee"); }, "Vinoba \u00B7 spelling_bee") },
      // Streak = the 4 programme streaks added up, compared with the sum of their 4 targets
      // (the report's overall "streaks" also counts other programmes, so it isn't used here).
      { lvl: 0, label: "Streak", w: 10, v: A(function (rp) { return msum(rp, "vinoba", ["Streak Storytelling", "Streak Creative Writing", "Streak Spoken English", "Streak Poetry Recitation"]); }, "Vinoba \u00B7 sum of the 4 programme streaks") },
      { lvl: 1, label: "Streak \u00B7 Storytelling", v: A(function (rp) { return mv(rp, "vinoba", "Streak Storytelling"); }, "Vinoba \u00B7 streak_storytelling") },
      { lvl: 1, label: "Streak \u00B7 Creative Writing", v: A(function (rp) { return mv(rp, "vinoba", "Streak Creative Writing"); }, "Vinoba \u00B7 streak_creative_writing") },
      { lvl: 1, label: "Streak \u00B7 Spoken English", v: A(function (rp) { return mv(rp, "vinoba", "Streak Spoken English"); }, "Vinoba \u00B7 streak_spoken_english") },
      { lvl: 1, label: "Streak \u00B7 Poetry", v: A(function (rp) { return mv(rp, "vinoba", "Streak Poetry Recitation"); }, "Vinoba \u00B7 streak_poetry_recitation") } ] },

    { key: "G3", title: "Vibrant Teacher Community", weight: 20, rows: [
      { lvl: 0, label: "Vinoba Kathavli Stories", w: 5, v: A(function (rp) { return mv(rp, "visit", "Kathawli Yes"); }, "Visit & Activity \u00B7 Kathavli \u201CYes\u201D count") },
      { lvl: 0, label: "Online + Offline community", w: 15, note: "Scored together: items achieved out of 10, \u00D7 15" },
      { lvl: 1, label: "Online teachers community", w: 6 },
      { lvl: 2, label: "Unique teachers posting", w: 1, v: A(function (rp) { return mv(rp, "vinoba", "Unique Teachers Posting"); }, "Vinoba") },
      { lvl: 2, label: "Unique schools posting", w: 1, v: A(function (rp) { return mv(rp, "vinoba", "Unique Schools Posting"); }, "Vinoba") },
      { lvl: 2, label: "Posts per month per teacher", w: 1, v: A(function (rp) {
          // Ratio agreed with the programme team: unique teachers posting / total posts (target 1).
          // Same formula as the Weekly tab. Kept unrounded so % done is exact; shown to 2 decimals.
          var t = mv(rp, "vinoba", "Unique Teachers Posting"), p = mv(rp, "vinoba", "Total Posts");
          return (t === null || !p) ? null : Math.round((t / p) * 10000) / 10000; }, "Vinoba \u00B7 unique teachers posting \u00F7 total posts") },
      { lvl: 2, label: "Star teachers (3-month consistency)", w: 1, v: A(function (rp) { return mv(rp, "vinoba", "Star Teachers"); }, "Vinoba") },
      { lvl: 2, label: "Teachers using expert coupons", w: 1, v: A(function (rp) { return mv(rp, "vinoba", "Expert Coupons Given"); }, "Vinoba \u00B7 expert coupons given") },
      { lvl: 2, label: "POM transformed clusters", w: 1, v: NE, fid: "M_G3_POMCLUSTERS" },
      { lvl: 1, label: "Offline teachers community", w: 4 },
      { lvl: 2, label: "Blocks with recognition events", w: 1, v: A(function (rp) { return mv(rp, "extra", "Blocks With Events"); }, "Staff Connect \u00B7 your blocks with at least one block event (block level)") },
      { lvl: 2, label: "District recognition events held", w: 1, v: A(function (rp) { return mv(rp, "staffConnect", "Total District Events"); }, "Staff Connect \u00B7 Total District Events \u2014 district figure, counted once per district") },
      { lvl: 2, label: "Teachers recognised", w: 1, v: A(function (rp) { return msum(rp, "staffConnect", ["Teachers Felicitated at Block Level", "Teachers Felicitated at District Level", "Teachers Felicitated in SU/NS Events", "Teachers Felicitated in Other Events"]); }, "Staff Connect \u00B7 block-level felicitations of these blocks + district, SU/NS and other felicitations counted once per district") },
      { lvl: 2, label: "Cluster heads recognised", w: 1, v: A(function (rp) { return mv(rp, "staffConnect", "Cluster Heads Recognised"); }, "Staff Connect \u00B7 Total Cluster Heads Recognised \u2014 district figure, counted once per district") } ] },

    { key: "G4", title: "Other Goals", weight: 10, rows: [
      { lvl: 0, label: "Other activities", w: 10, g4: true } ] },

    { key: "G5", title: "Self-Development", weight: 10, rows: [
      { lvl: 0, label: "Compliance", w: 4, target: 12, compliance: true },
      { lvl: 1, label: "No ball drop", head: true },
      { lvl: 2, label: "Keka \u2014 daily reporting done on time", yn: A(function (rp) {
          var p = rp && rp.derived && rp.derived["Keka Punctual"]; if (!p) return null;
          var late = mv(rp, "keka", "Late Arrival") || 0, miss = mv(rp, "keka", "Missing Swipe Days") || 0;
          return { yes: p === "Y", tip: "Late Arrival Days " + fmtNum(late) + " + Missing Swipe Days " + fmtNum(miss) + " = " + fmtNum(late + miss) + (p === "Y" ? " \u2192 Yes" : " \u2192 No (must be 0)"),
                   why: [["Late Arrival Days", fmtNum(late)], ["Missing Swipe Days", fmtNum(miss)], ["Total", fmtNum(late + miss)]],
                   rule: "Yes when Late Arrival Days + Missing Swipe Days = 0, from this month's Keka (All Month) upload." };
        }, "No Keka row for this person in this month's All Month upload") },
      { lvl: 2, label: "ER submitted by 26th, error-free", yn: A(function (rp) {
          var s = rp && rp.visit && rp.visit["ER Submitted"]; if (!s) return null;
          var st = (rp.extra && rp.extra["ER Status"]) || "", amt = mv(rp, "visit", "ER Amount");
          return { yes: s === "Yes", tip: "ER status: " + (st || "blank") + (amt != null ? " \u00B7 Amount " + fmtNum(amt) : "") + (s === "Yes" ? " \u2192 Yes" : " \u2192 No (needs Submitted or Locked)"),
                   why: [["Status in the ER file", st || "(blank)"], ["Amount", amt != null ? fmtNum(amt) : "\u2014"]],
                   rule: "Yes when the ER status is Submitted or Locked, from this month's ER (All Month) upload. The file has no submission date, so \u201Cby 26th\u201D isn't checked." };
        }, "No ER row for this person in this month's All Month upload") },
      { lvl: 2, label: "All requests raised via Nimble (not email)", yn: UE, fid: "M_G5_NIMBLE", hint: function (rp) {
          var n = rp && rp.nimble; if (!n || n["Tickets Raised"] === "" || n["Tickets Raised"] == null) return null;
          var open = (rp.extra && rp.extra["Tickets Open"]) || 0;
          return { short: n["Tickets Raised"] + " raised \u00B7 " + n["Tickets In Validation"] + " in Validate \u00B7 " + n["Tickets Closed"] + " closed \u00B7 " + open + " open",
                   tip: "Nimble this month: " + n["Tickets Raised"] + " tickets raised \u2014 " + n["Tickets Closed"] + " closed (have a close date), " + n["Tickets In Validation"] + " in the Validate column, " + open + " still open." };
        } },
      { lvl: 2, label: "Program Dashboard updated after each stage", yn: A(function (rp) {
          var n = mv(rp, "visit", "Program Dashboard Updated Yes"); if (n === null) return null;
          return { yes: n > 0, detail: n + "\u00D7", tip: "Program Dashboard updated \u201CYes\u201D " + n + " time" + (n === 1 ? "" : "s") + " this month" + (n > 0 ? " \u2192 Yes" : " \u2192 No"),
                   why: [["Program Dashboard updated \u201CYes\u201D count", fmtNum(n)]],
                   rule: "Yes when the Visit & Activity file shows at least one \u201CYes\u201D for Program Dashboard updated this month." };
        }, "No Visit & Activity row for this person this month") },
      { lvl: 1, label: "Planning and tracking", head: true },
      { lvl: 2, label: "WhatsApp daily update sent", yn: UE, fid: "M_G5_WHATSAPP" },
      { lvl: 2, label: "PO Form filled daily", yn: A(function (rp) {
          var p = mv(rp, "derived", "Form Completion %"); if (p === null) return null;
          var f = mv(rp, "visit", "Daily Forms Filed") || 0, wd = mv(rp, "keka", "Working Days") || 0;
          return { yes: p >= 100, detail: fmtNum(p) + "%", tip: f + " daily forms filed \u00F7 " + wd + " Keka working days = " + fmtNum(p) + "%" + (p >= 100 ? " \u2192 Yes" : " \u2192 No (needs 100%)"),
                   why: [["Daily forms filed (Visit & Activity)", fmtNum(f)], ["Working days (Keka)", fmtNum(wd)], ["Completion", fmtNum(p) + "%"]],
                   rule: "Yes when daily forms filed \u2265 Keka working days (100%)." };
        }, "No Visit & Activity or Keka data for this person this month") },
      { lvl: 2, label: "PO Field Visit Report filed same day as visit", yn: UE, fid: "M_G5_FVR", hint: function (rp) {
          var vf = mv(rp, "visit", "Visit Forms Filed"); if (vf === null) return null;
          var vis = msum(rp, "visit", ["School Visits", "Cluster Visits", "Block Visits", "District Visits"]) || 0;
          return { short: vf + " visit forms filed \u00B7 " + vis + " visits recorded", tip: "Visit & Activity this month: " + vf + " visit forms filed for " + vis + " visits recorded." };
        } },
      { lvl: 2, label: "POM Reporting done every Friday after POM", yn: UE, fid: "M_G5_POM" },
      { lvl: 2, label: "District CEO PPT submitted by 28th, error-free", yn: UE, fid: "M_G5_CEOPPT" },
      { lvl: 1, label: "No obvious mistakes", head: true },
      { lvl: 2, label: "All District Action Tracker follow-ups completed", yn: UE, fid: "M_G5_ACTTRACKER" },
      { lvl: 2, label: "Action points completed from CEO Tracker", yn: UE, fid: "M_G5_CEOTRACKER" },
      { lvl: 2, label: "No commitments missed", yn: UE, fid: "M_G5_COMMIT", hint: function (rp, w0) {
          var B = (w0 && w0.sections && w0.sections.B) || {}, c = { Done: 0, Partial: 0, Not: 0 }, n = 0;
          ["B1", "B2", "B3", "B4", "B5"].forEach(function (k) { var s = B[k] && B[k].status; if (s && c[s] != null) { c[s]++; n++; } });
          if (!n) return null;
          return { short: "Last month's actions: " + c.Done + " Done \u00B7 " + c.Partial + " Partial \u00B7 " + c.Not + " Not", tip: "From B. Last month's actions (saved): " + c.Done + " Done, " + c.Partial + " Partial, " + c.Not + " Not." };
        } },
      { lvl: 0, label: "Visits", w: 4, v: A(function (rp) { return msum(rp, "visit", ["School Visits", "Cluster Visits", "Block Visits", "District Visits"]); }, "Visit & Activity \u00B7 all visits") },
      { lvl: 1, label: "School", v: A(function (rp) { return mv(rp, "visit", "School Visits"); }, "Visit & Activity") },
      { lvl: 1, label: "Cluster", v: A(function (rp) { return mv(rp, "visit", "Cluster Visits"); }, "Visit & Activity") },
      { lvl: 1, label: "Block / District", v: A(function (rp) { return msum(rp, "visit", ["Block Visits", "District Visits"]); }, "Visit & Activity \u00B7 block + district visits") },
      { lvl: 0, label: "Case Study", w: 2, v: NE, fid: "M_G5_CASESTUDY" } ] }
  ];

  /* ---------- monthly filters ---------- */
  function wireMonthly() {
    if (!$("prMoUnit")) return;
    $("prMoUnit").addEventListener("change", function () { moPopulateValue(); moRefresh(); });
    $("prMoValue").addEventListener("change", moRefresh);
    $("prMoMonth").addEventListener("change", moRefresh);
    $("prMoLoad").addEventListener("click", loadMonthlyView);
  }
  function moRefresh() { $("prMoLoad").disabled = !($("prMoUnit").value && $("prMoValue").value && $("prMoMonth").value); }
  function moPopulateValue() {
    var unit = $("prMoUnit").value, sel = $("prMoValue");
    $("prMoValueLabel").textContent = UNIT_LABEL[unit] || "PO";
    if (!state.base) { sel.innerHTML = ""; sel.disabled = true; sel.appendChild(opt("", "\u2014")); return; }
    fillUnitSelect(sel, unit);
  }
  function moFillFromBase() {
    if (!$("prMoMonth") || !state.base) return;
    var mo = $("prMoMonth"); mo.innerHTML = "";
    if (!state.base.months.length) mo.innerHTML = '<option value="">No months</option>';
    else { mo.appendChild(opt("", "Select\u2026")); state.base.months.forEach(function (m) { mo.appendChild(opt(m.code, m.label)); }); }
    mo.disabled = false;
    moPopulateValue();
  }
  // Opening Monthly for the first time carries over the Weekly selection.
  function moSyncFromWeekly() {
    if (!$("prMoValue") || $("prMoValue").value || !$("prValue").value) return;
    $("prMoUnit").value = $("prUnit").value; moPopulateValue();
    $("prMoValue").value = $("prValue").value; $("prMoMonth").value = $("prMonth").value;
    moRefresh();
  }

  function loadMonthlyView() {
    var unit = $("prMoUnit").value, value = $("prMoValue").value, month = $("prMoMonth").value;
    if (!unit || !value || !month) return;
    MDIRTY = {};
    $("prMoBody").innerHTML = '<div class="pr-empty">Loading monthly review\u2026</div>';
    Promise.all([
      sbGetWeeklyView(unit, value, month),
      sbGetAcademic(unit, value, month).catch(function (e) { console.warn("Academic plan not loaded:", e); return null; }),
      sbGetTargets(unit, value, month).catch(function (e) { console.warn("Targets not loaded:", e); return null; })
    ]).then(function (res) { MVIEW = res[0]; MVIEW.academic = res[1]; MVIEW.targets = res[2]; renderMonthlyView(); })
      .catch(function (e) { $("prMoBody").innerHTML = '<div class="pr-empty">Couldn\'t load: ' + esc(e.message || String(e)) + "</div>"; });
  }

  /* ---------- scoring ---------- */
  function moRowState(r, rp) {
    // -> { kind: "num"|"yn"|"na"|"entry"|"none", value, yes, detail, src }
    var spec = r.v || r.yn;
    if (!spec) return { kind: "none" };
    if (spec.numentry) {
      var ev0 = moNumVal(r.fid);
      return ev0 === "" ? { kind: "numempty" } : { kind: "num", value: ev0, src: "Entered by the PO on this page", entered: true };
    }
    if (spec.na) return { kind: "na" };
    if (spec.entry) return r.fid ? { kind: "ynentry", value: moValue(r.fid) } : { kind: "entry" };
    var got = spec.auto(rp);
    if (r.yn) return got ? { kind: "yn", yes: got.yes, detail: got.detail || "", src: spec.src, tip: got.tip || spec.src, why: got.why || [], rule: got.rule || "" }
                         : { kind: "nodata", src: spec.src, tip: spec.src };
    return got === null ? { kind: "nodata", src: spec.src } : { kind: "num", value: got, src: spec.src };
  }
  function moScore(r, st) {
    // % and score need a target; only Compliance has a fixed one (12) today.
    if (r.compliance) return null;
    if (r.target == null || !st || st.kind !== "num") return null;
    var pct = r.target > 0 ? Math.min(st.value / r.target, 1) : 0;
    return { pct: pct, score: (r.w || 0) * pct };
  }
  function moCompliance(goal, rp) {
    var items = goal.rows.filter(function (r) { return r.yn; }), yes = 0, answered = 0;
    items.forEach(function (r) {
      var st = moRowState(r, rp);
      if (st.kind === "yn") { answered++; if (st.yes) yes++; }
      else if (st.kind === "ynentry" && (st.value === "Y" || st.value === "N")) { answered++; if (st.value === "Y") yes++; }
    });
    return { yes: yes, answered: answered, total: items.length };
  }

  /* ---------- render ---------- */
  function moCell(html, cls) { return '<td class="pr-num' + (cls ? " " + cls : "") + '">' + html + "</td>"; }
  function moDash() { return '<span class="pr-mut">\u2014</span>'; }
  function moPill(text, cls, title) { return '<span class="pr-mo-pill ' + cls + '"' + (title ? ' title="' + esc(title) + '"' : "") + ">" + esc(text) + "</span>"; }

  function moComplianceCells(g, r, rp) {
    var c = moCompliance(g, rp), cs = moComplianceScore(g, r, rp);
    return { done: c.yes + " Yes" + '<div class="pr-mo-sub">' + c.answered + " of " + c.total + " answered</div>",
             pct: cs ? fmtNum(Math.round(cs.pct * 1000) / 10) + "%" : moDash(), score: cs ? fmtNum(r2(cs.score)) : moDash() };
  }
  // Recompute the Compliance row and every score card from saved + unsaved values (no full re-draw,
  // so unsaved A / B / G / H edits stay exactly as typed).
  var MO_ENT = [];
  function moRefreshScores() {
    var rp = moW0().readPoints || {}, total = 0, n = 0;
    document.querySelectorAll("#prMoBody tr[data-ent]").forEach(function (tr) {
      var it = MO_ENT[Number(tr.dataset.ent)]; if (!it) return;
      var ev = moEval(it.g, it.r, rp), weighted = (it.r.lvl === 0 && it.r.w > 0) || it.r.community;
      tr.cells[4].innerHTML = ev.pct != null ? fmtNum(Math.round(ev.pct * 1000) / 10) + "%" : moDash();
      tr.cells[5].innerHTML = weighted ? (ev.score != null ? fmtNum(r2(ev.score)) : moDash()) : "";
      if (it.r.community) { var sub = tr.cells[0].querySelector(".pr-mo-sub");
        if (sub) sub.textContent = "Average of the 10 metrics below that have both a target and data (" + ev.used + " of " + ev.of + " now), \u00D7 15."; }
    });
    moG4SummaryRefresh();
    MO_GOALS.forEach(function (g) {
      var gs = moGoalScore(g, rp);
      if (gs.score != null) { total += gs.score; n++; }
      var card = document.querySelector('#prMoBody .pr-card[data-goal="' + g.key + '"]');
      if (card) {
        card.querySelector(".pr-card-v").innerHTML = (gs.score != null ? fmtNum(r2(gs.score)) : "\u2014") + "<small>/ " + g.weight + "</small>";
        if (g.key === "G4") card.querySelector(".pr-wkcard-foot span").textContent = moG4Foot();
        else if (g.key !== "G1" && gs.scored) card.querySelector(".pr-wkcard-foot span").textContent = gs.scored + " of " + gs.total + " parts scored";
      }
      if (g.key === "G5") {
        var tr = document.querySelector('#prMoBody tr[data-comp="1"]'), cr = g.rows.filter(function (x) { return x.compliance; })[0];
        if (tr && cr) { var cc = moComplianceCells(g, cr, rp); tr.cells[3].innerHTML = cc.done; tr.cells[4].innerHTML = cc.pct; tr.cells[5].innerHTML = cc.score; }
      }
    });
    var tc = document.querySelector('#prMoBody .pr-card[data-goal="TOTAL"]');
    if (tc) {
      tc.querySelector(".pr-card-v").innerHTML = (n ? fmtNum(r2(total)) : "\u2014") + "<small>/ 100</small>";
      tc.querySelector(".pr-wkcard-foot span").textContent = n === 5 ? "All goals scored" : n ? "Partial \u2014 " + n + " of 5 goals scored" : "Shown once targets and data are in";
    }
  }
  var MO_WHY = [];
  function openWhy(i) {
    var it = MO_WHY[i]; if (!it) return;
    var h = (MVIEW && MVIEW.header) || {}, who = h.unit === "PO" ? (h.po && h.po.name) : (h.manager || h.district || "");
    $("prListTitle").textContent = "Why " + (it.st.yes ? "Yes" : "No") + " \u2014 " + it.r.label + " \u00B7 " + monthLabel(MVIEW.month) + (who ? " \u00B7 " + who : "");
    $("prListBody").innerHTML = '<table class="pr-tbl"><tbody>' + it.st.why.map(function (w) {
        return '<tr class="pr-row"><td>' + esc(w[0]) + '</td><td class="pr-num">' + esc(w[1]) + "</td></tr>"; }).join("")
      + '<tr class="pr-row pr-tgt-total"><td>Result</td><td class="pr-num ' + (it.st.yes ? "pr-rev-yes" : "pr-rev-part") + '">' + (it.st.yes ? "Yes" : "No") + "</td></tr></tbody></table>";
    $("prListNote").textContent = it.st.rule;
    $("prListModal").hidden = false;
  }


  /* ---------- G4 · Other Goals: up to 3 activities chosen by the PO ----------
     Each activity: name, weight, target, done (saved as M_G4_<n>_NAME / _W / _T / _D).
     Weights of the activities in use must add up to exactly 10.
     % done = done / target (capped at 100%); score = weight x % done; G4 = sum. */
  var G4_SLOTS = [1, 2, 3];
  function moNumVal(fid) { var v = moValue(fid); return (v === "" || v == null) ? "" : num(v); }
  function moG4Items() {
    return G4_SLOTS.map(function (i) {
      var o = { i: i, name: String(moValue("M_G4_" + i + "_NAME") || ""), w: moNumVal("M_G4_" + i + "_W"),
                t: moNumVal("M_G4_" + i + "_T"), d: moNumVal("M_G4_" + i + "_D") };
      o.used = o.name.trim() !== "" || o.w !== "" || o.t !== "" || o.d !== "";
      return o;
    });
  }
  function moG4Eval() {
    var items = moG4Items().filter(function (x) { return x.used; });
    var wsum = Math.round(items.reduce(function (a, x) { return a + (x.w === "" ? 0 : x.w); }, 0) * 1000) / 1000;
    items.forEach(function (x) { x.sc = moPctScore(x.d, x.t, x.w === "" ? 0 : x.w); });
    var valid = items.length > 0 && wsum === 10, scored = items.filter(function (x) { return x.sc; });
    return { items: items, wsum: wsum, valid: valid, scored: scored.length,
             score: valid && scored.length ? scored.reduce(function (a, x) { return a + x.sc.score; }, 0) : null };
  }
  function moG4Foot() {
    var e = moG4Eval();
    if (!e.items.length) return "Add up to 3 activities";
    if (!e.valid) return "Weights add up to " + fmtNum(e.wsum) + " \u2014 must be 10";
    return e.scored + " of " + e.items.length + " activities scored";
  }
  function moG4WsumHtml(e) {
    return '<span class="pr-mo-wsum ' + (e.items.length && !e.valid ? "bad" : (e.valid ? "ok" : "")) + '" title="The weights of the activities must add up to 10">'
      + fmtNum(e.wsum) + " / 10</span>";
  }

  function moG4Section(g) {
    var e = moG4Eval(), all = moG4Items(), editable = canEditSelf(MVIEW), code = moW0().code;
    var out = moGroupHead(g.key, g.key + " \u00B7 " + esc(g.title), "Goal", "auto", '<span class="pr-grpcount">Weight ' + g.weight + "</span>");
    out += '<tr class="pr-row pr-hidden pr-mo-l0" data-secrow="mG4" data-g4sum="1"><td class="pr-item">Other activities'
      + '<div class="pr-mo-sub">Up to 3 activities chosen by the PO. Their weights must add up to 10.</div></td>'
      + moCell(moG4WsumHtml(e)) + moCell("") + moCell("") + moCell("") + moCell(e.score != null ? fmtNum(r2(e.score)) : moDash()) + "</tr>";
    if (!editable) {
      if (!e.items.length) return out + '<tr class="pr-row pr-hidden pr-mo-l1" data-secrow="mG4"><td class="pr-item">'
        + moPill("No activities added", "pr-mo-na", "Added by the person under review") + '</td><td colspan="5"></td></tr>';
      e.items.forEach(function (x) {
        out += '<tr class="pr-row pr-hidden pr-mo-l1" data-secrow="mG4"><td class="pr-item">' + esc(x.name || "(unnamed)") + "</td>"
          + moCell(x.w === "" ? "" : fmtNum(x.w)) + moCell(x.t === "" ? "" : fmtNum(x.t)) + moCell(x.d === "" ? "" : fmtNum(x.d))
          + moCell(x.sc ? fmtNum(x.sc.pct) + "%" : moDash()) + moCell(x.sc ? fmtNum(x.sc.score) : moDash()) + "</tr>";
      });
      return out;
    }
    var shown = all.filter(function (x) { return x.used; }).map(function (x) { return x.i; });
    if (!shown.length) shown = [1];
    all.forEach(function (x) {
      var off = shown.indexOf(x.i) < 0, sc = x.used ? moPctScore(x.d, x.t, x.w === "" ? 0 : x.w) : null;
      var numIn = function (k, v, ph) {
        return '<input type="number" min="0" step="any" inputmode="decimal" class="pr-mo-g4n" data-wc="' + code + '" data-fid="M_G4_' + x.i + "_" + k
          + '" placeholder="' + ph + '" value="' + (v === "" ? "" : v) + '">';
      };
      out += '<tr class="pr-row pr-hidden pr-mo-l1' + (off ? " pr-mo-g4off" : "") + '" data-secrow="mG4" data-g4="' + x.i + '">'
        + '<td class="pr-item"><div class="pr-mo-g4name"><input type="text" class="pr-mo-txt" maxlength="80" data-wc="' + code + '" data-fid="M_G4_' + x.i
        + '_NAME" placeholder="Activity ' + x.i + ' \u2014 name" value="' + esc(x.name) + '">'
        + '<button type="button" class="pr-mo-x" title="Remove this activity">\u2715</button></div></td>'
        + moCell(numIn("W", x.w, "Weight")) + moCell(numIn("T", x.t, "Target")) + moCell(numIn("D", x.d, "Done"))
        + moCell(sc ? fmtNum(sc.pct) + "%" : moDash()) + moCell(sc ? fmtNum(sc.score) : moDash()) + "</tr>";
    });
    out += '<tr class="pr-row pr-hidden" data-secrow="mG4" data-g4add="1"' + (shown.length >= 3 ? ' style="display:none"' : "")
      + '><td colspan="6"><button type="button" class="pr-btn pr-mo-add">+ Add activity</button>'
      + ' <span class="pr-mo-sub" style="display:inline">Up to 3 \u00B7 weights must add up to 10</span></td></tr>';
    return out;
  }

  function moG4RowRefresh(tr) {
    var i = Number(tr.dataset.g4), get = function (k) { return moNumVal("M_G4_" + i + "_" + k); };
    var w = get("W"), sc = moPctScore(get("D"), get("T"), w === "" ? 0 : w);
    tr.cells[4].innerHTML = sc ? fmtNum(sc.pct) + "%" : moDash();
    tr.cells[5].innerHTML = sc ? fmtNum(sc.score) : moDash();
  }
  function moG4SummaryRefresh() {
    var tr = document.querySelector('#prMoBody tr[data-g4sum="1"]'); if (!tr) return;
    var e = moG4Eval();
    tr.cells[1].innerHTML = moG4WsumHtml(e);
    tr.cells[5].innerHTML = e.score != null ? fmtNum(r2(e.score)) : moDash();
  }
  function bindG4() {
    document.querySelectorAll("#prMoBody .pr-mo-g4n").forEach(function (inp) {
      inp.addEventListener("input", function () {
        var raw = inp.value.trim(), val = raw === "" ? "" : Number(raw), bad = val !== "" && (isNaN(val) || val < 0);
        inp.classList.toggle("is-bad", bad);
        if (bad) return;
        markDirty(inp.dataset.wc, inp.dataset.fid, val);
        moG4RowRefresh(inp.closest("tr")); moRefreshScores();
      });
    });
    document.querySelectorAll("#prMoBody .pr-mo-txt").forEach(function (inp) {
      inp.addEventListener("input", function () { markDirty(inp.dataset.wc, inp.dataset.fid, inp.value); moRefreshScores(); });
    });
    document.querySelectorAll("#prMoBody .pr-mo-x").forEach(function (b) {
      b.addEventListener("click", function () {
        var tr = b.closest("tr");
        tr.querySelectorAll("input[data-fid]").forEach(function (inp) { inp.value = ""; inp.classList.remove("is-bad"); markDirty(inp.dataset.wc, inp.dataset.fid, ""); });
        var visible = document.querySelectorAll("#prMoBody tr[data-g4]:not(.pr-mo-g4off)").length;
        if (visible > 1) tr.classList.add("pr-mo-g4off");
        moG4RowRefresh(tr); moRefreshScores();
        var add = document.querySelector('#prMoBody tr[data-g4add="1"]'); if (add) add.style.display = "";
      });
    });
    document.querySelectorAll("#prMoBody .pr-mo-add").forEach(function (b) {
      b.addEventListener("click", function () {
        var next = document.querySelector("#prMoBody tr[data-g4].pr-mo-g4off");
        if (next) { next.classList.remove("pr-mo-g4off"); var n = next.querySelector(".pr-mo-txt"); if (n) n.focus(); }
        if (!document.querySelector("#prMoBody tr[data-g4].pr-mo-g4off")) b.closest("tr").style.display = "none";
      });
    });
  }

  function moW0() {
    var month = MVIEW.month;
    return (MVIEW.weeks || []).filter(function (w) { return w.week === 0; })[0] || { week: 0, code: month + "00", sections: {}, readPoints: {} };
  }
  // Saved "exams completed" for this month ("" = not entered yet)
  function moValue(fid) {
    var code = moW0().code, d = MDIRTY[code];
    if (d && Object.prototype.hasOwnProperty.call(d, fid)) return d[fid];
    var v = ((moW0().sections || {}).M || {})[fid];
    return v == null ? "" : v;
  }
  function moG1Done() {
    var v = moValue("M_G1_DONE");
    return (v === undefined || v === null || v === "") ? "" : num(v);
  }
  // Sheet B rule: % done = done / target, capped at 100%; score = weight x % done
  function moPctScore(done, target, weight) {
    if (done === "" || done == null || isNaN(done) || !(target > 0)) return null;
    var p = Math.min(done / target, 1);
    return { pct: Math.round(p * 1000) / 10, score: Math.round(weight * p * 100) / 100 };
  }
  function moOnNumInput(e) {
    var el = e.target, raw = el.value.trim(), tr = el.closest("tr");
    var val = raw === "" ? "" : Number(raw);
    var bad = val !== "" && (isNaN(val) || val < 0);
    el.classList.toggle("is-bad", bad);
    if (bad) return;                                   // never save a negative / non-number
    markDirty(el.dataset.wc, el.dataset.fid, val);
    var target = Number(el.dataset.target), sc = moPctScore(val, target, Number(el.dataset.weight));
    tr.cells[4].innerHTML = sc ? fmtNum(sc.pct) + "%" : moDash();
    tr.cells[5].innerHTML = sc ? fmtNum(sc.score) : moDash();
    var over = tr.querySelector(".pr-mo-over");
    if (val !== "" && val > target) { if (!over) el.insertAdjacentHTML("afterend", '<div class="pr-mo-over">More than planned</div>'); }
    else if (over) over.remove();
    var card = document.querySelector('#prMoBody .pr-card[data-goal="G1"] .pr-card-v');
    if (card) card.innerHTML = (sc ? fmtNum(sc.score) : "\u2014") + "<small>/ " + el.dataset.weight + "</small>";
    moRefreshScores();
  }

  function renderMonthlyView() {
    MO_TLINES = []; MO_WHY = []; MO_ENT = [];
    var v = MVIEW, h = v.header || {}, month = v.month;
    var w0 = (v.weeks || []).filter(function (w) { return w.week === 0; })[0] || { week: 0, code: month + "00", sections: {}, readPoints: {} };
    var rp = w0.readPoints || {}, haveData = hasData(w0);
    var label = monthLabel(month);
    var selfOk = canEditSelf(v), mgrOk = canEditManager(v);

    var html = renderHeader(h) + renderBlocks(h, v);
    html += moCards(rp);

    var head = '<tr><th class="pr-item">Item</th><th class="pr-num">Weight</th><th class="pr-num">Target</th><th class="pr-num">Done</th><th class="pr-num">% done</th><th class="pr-num">Score</th></tr>';
    var body = moWriteSection(MO_SEC.A, w0, selfOk, h.unit) + moWriteSection(MO_SEC.B, w0, selfOk, h.unit);
    MO_GOALS.forEach(function (g) { body += moGoalSection(g, rp); });
    body += moWriteSection(MO_SEC.G, w0, selfOk, h.unit) + moWriteSection(MO_SEC.H, w0, mgrOk, h.unit);
    html += '<div class="pr-tablewrap"><table class="pr-tbl pr-mo-tbl"><thead>' + head + "</thead><tbody>" + body + "</tbody></table></div>";

    if (selfOk || mgrOk) html += '<div class="pr-savebar"><span class="pr-savehint">You can edit the sections your role owns.</span>'
      + '<button class="pr-btn pr-btn-primary" id="prMoSave">Save monthly review</button></div>';
    $("prMoBody").innerHTML = html;
    bindTable("#prMoBody");
    document.querySelectorAll("#prMoBody .pr-mo-link").forEach(function (b) { b.addEventListener("click", openAcadList); });
    document.querySelectorAll("#prMoBody .pr-mo-num").forEach(function (i) { i.addEventListener("input", moOnNumInput); });
    document.querySelectorAll("#prMoBody .pr-mo-tlink").forEach(function (b) { b.addEventListener("click", function () { openTargetPopup(Number(b.dataset.ti)); }); });
    bindG4();
    document.querySelectorAll("#prMoBody .pr-mo-ent").forEach(function (inp) {
      inp.addEventListener("input", function () {
        var raw = inp.value.trim(), val = raw === "" ? "" : Number(raw), bad = val !== "" && (isNaN(val) || val < 0);
        inp.classList.toggle("is-bad", bad);
        if (bad) return;
        markDirty(inp.dataset.wc, inp.dataset.fid, val); moRefreshScores();
      });
    });
    document.querySelectorAll("#prMoBody .pr-mo-why").forEach(function (b) { b.addEventListener("click", function () { openWhy(Number(b.dataset.wi)); }); });
    document.querySelectorAll("#prMoBody .pr-mo-yn").forEach(function (s) {
      s.addEventListener("change", function () { markDirty(s.dataset.wc, s.dataset.fid, s.value); moRefreshScores(); });
    });
    if ($("prMoSave")) $("prMoSave").addEventListener("click", saveMonthly);
  }
  function monthLabel(ym) {
    var m = (state.base && state.base.months || []).filter(function (x) { return x.code === ym; })[0];
    return m ? m.label : ym;
  }

  function moCards(rp) {
    var total = 0, totalN = 0, others = 0, cards = "";
    MO_GOALS.forEach(function (g) {
      var gs = moGoalScore(g, rp), acad = MVIEW.academic;
      if (gs.score != null) { total += gs.score; totalN++; if (g.key !== "G1") others += gs.score; }
      var foot = g.key === "G1" ? (acad == null ? "Academic Plan unavailable" : acadTotal(acad) + " exam" + (acadTotal(acad) === 1 ? "" : "s") + " planned")
               : g.key === "G4" ? moG4Foot()
               : (gs.scored ? gs.scored + " of " + gs.total + " parts scored" : (MVIEW.targets && MVIEW.targets.rowsInMonth ? "Needs data or targets" : "No targets for this month"));
      cards += '<div class="pr-card" data-goal="' + g.key + '"><div class="pr-card-k">' + g.key + " \u00B7 " + esc(g.title) + '</div><div class="pr-card-v">'
        + (gs.score != null ? fmtNum(r2(gs.score)) : "\u2014") + "<small>/ " + g.weight + "</small></div>"
        + '<div class="pr-wkcard-foot"><span>' + esc(foot) + "</span></div></div>";
    });
    var head = '<div class="pr-card" data-goal="TOTAL" data-others="' + others + '" data-othersn="' + (totalN - (moGoalScore(MO_GOALS[0], rp).score != null ? 1 : 0)) + '">'
      + '<div class="pr-card-k">Monthly score</div><div class="pr-card-v">' + (totalN ? fmtNum(r2(total)) : "\u2014") + "<small>/ 100</small></div>"
      + '<div class="pr-wkcard-foot"><span>' + (totalN === 5 ? "All goals scored" : totalN ? "Partial \u2014 " + totalN + " of 5 goals scored" : "Shown once targets and data are in") + "</span></div></div>";
    return '<div class="pr-cards pr-mo-cards">' + head + cards + "</div>";
  }

  function moGroupHead(key, title, tagText, tagCls, extra) {
    return '<tr class="pr-grp" data-grp="m' + key + '"><td colspan="6"><span class="pr-caret">\u25B8</span>' + title
      + ' <span class="pr-who-tag pr-who-' + tagCls + '">' + tagText + "</span>" + (extra || "") + "</td></tr>";
  }
  function moWriteSection(S, w0, editable, unit) {
    var who = sectionWho(S, unit || "PO");
    var out = moGroupHead(S.k, S.k + ". " + esc(S.title), who, whoClassOf(who));
    S.rows.forEach(function (r) {
      out += '<tr class="pr-row pr-hidden" data-secrow="m' + S.k + '"><td class="pr-item">' + esc(r.label) + '</td><td colspan="5">'
        + renderCell(S, r, w0, editable) + "</td></tr>";
    });
    return out;
  }
  function moGoalSection(g, rp) {
    if (g.key === "G4") return moG4Section(g);
    var out = moGroupHead(g.key, g.key + " \u00B7 " + esc(g.title), "Goal", "auto", '<span class="pr-grpcount">Weight ' + g.weight + "</span>");
    g.rows.forEach(function (r) {
      var cls = "pr-row pr-hidden pr-mo-l" + r.lvl + (r.head ? " pr-mo-head" : "");
      var ev = (r.head || r.academic || r.compliance) ? null : moEval(g, r, rp);
      var sub = r.note || "";
      if (r.community && ev) sub = "Average of the 10 metrics below that have both a target and data (" + ev.used + " of " + ev.of + " now), \u00D7 15.";
      var item = esc(r.label) + (sub ? '<div class="pr-mo-sub">' + esc(sub) + "</div>" : "");
      var entIdx = null;
      if (r.community) { MO_ENT.push({ g: g, r: r }); entIdx = MO_ENT.length - 1; }
      var rowOpen = '<tr class="' + cls + '" data-secrow="m' + g.key + '"' + (r.compliance ? ' data-comp="1"' : "");
      var row = '<td class="pr-item">' + item + "</td>";
      if (r.head) return (out += rowOpen + ">" + row + '<td colspan="5"></td></tr>');
      var done, target = "", pct = moDash(), score = moDash();

      if (r.academic) {
        var ac = MVIEW.academic, n = ac ? acadTotal(ac) : 0;
        target = ac == null ? moPill("Unavailable", "pr-mo-na", "The Academic Plan could not be loaded")
               : (n ? '<button type="button" class="pr-mo-link" title="See the exams">' + n + "</button>" : "0");
        var dv = moG1Done(), canEd = canEditSelf(MVIEW);
        if (ac && n) {
          done = canEd
            ? '<input type="number" min="0" step="1" inputmode="numeric" class="pr-mo-num" placeholder="0" data-wc="' + moW0().code
              + '" data-fid="M_G1_DONE" data-target="' + n + '" data-weight="' + r.w + '" value="' + (dv === "" ? "" : dv) + '">'
              + (dv !== "" && dv > n ? '<div class="pr-mo-over">More than planned</div>' : "")
            : (dv === "" ? moPill("Not entered", "pr-mo-entry", "Entered by the person under review") : fmtNum(dv));
          var g1 = moPctScore(dv, n, r.w);
          if (g1) { pct = fmtNum(g1.pct) + "%"; score = fmtNum(g1.score); }
        } else done = moDash();
      } else if (r.compliance) {
        var cc = moComplianceCells(g, r, rp);
        done = cc.done; target = String(r.target); pct = cc.pct; score = cc.score;
      } else {
        var st = ev.st;
        // target: clickable number, or why there is none
        if (ev.tg.state === "ok") { MO_TLINES.push({ r: r, g: g }); target = '<button type="button" class="pr-mo-tlink" data-ti="' + (MO_TLINES.length - 1) + '" title="See where this target comes from">' + fmtNum(r2(ev.tg.value)) + "</button>"; }
        else if (ev.tg.state === "notset") target = moPill("Not set", "pr-mo-na", "No target for this line this month (blank or 0)");
        else if (ev.tg.state === "unavailable") target = moPill("Unavailable", "pr-mo-na", "The targets table could not be loaded");
        if (r.v && r.v.numentry) {
          var curv = st.kind === "num" ? st.value : "";
          MO_ENT.push({ g: g, r: r }); entIdx = MO_ENT.length - 1;
          done = canEditSelf(MVIEW)
            ? '<input type="number" min="0" step="any" inputmode="decimal" class="pr-mo-ent" placeholder="0" data-wc="' + moW0().code
              + '" data-fid="' + r.fid + '" value="' + curv + '">'
            : (curv === "" ? moPill("Not entered", "pr-mo-entry", "Entered by the person under review") : fmtNum(curv));
        }
        else if (st.kind === "num") done = '<span title="' + esc(st.src) + '">' + fmtNum(st.value) + "</span>";
        else if (st.kind === "yn") {
          MO_WHY.push({ r: r, st: st });
          done = '<button type="button" class="pr-mo-why ' + (st.yes ? "pr-rev-yes" : "pr-rev-part") + '" data-wi="' + (MO_WHY.length - 1) + '" title="' + esc(st.tip) + '">'
            + (st.yes ? "Yes" : "No") + (st.detail ? " \u00B7 " + esc(st.detail) : "") + "</button>";
        }
        else if (st.kind === "nodata") done = '<span title="' + esc(st.tip || st.src) + '">' + moDash() + "</span>";
        else if (st.kind === "ynentry") {
          var hint = r.hint ? r.hint(rp, moW0()) : null;
          done = canEditSelf(MVIEW)
            ? '<select class="pr-mo-yn" data-wc="' + moW0().code + '" data-fid="' + r.fid + '"><option value="">\u2014</option>'
              + '<option value="Y"' + (st.value === "Y" ? " selected" : "") + ">Yes</option><option value=\"N\"" + (st.value === "N" ? " selected" : "") + ">No</option></select>"
            : (st.value === "Y" ? '<span class="pr-rev-yes">Yes</span>' : st.value === "N" ? '<span class="pr-rev-part">No</span>'
               : moPill("Not entered", "pr-mo-entry", "Entered by the person under review"));
          if (hint) done = '<span title="' + esc(hint.tip) + '">' + done + '</span><div class="pr-mo-sub pr-mo-hint" title="' + esc(hint.tip) + '">' + esc(hint.short) + "</div>";
        }
        else if (st.kind === "na") done = moPill("Not in data yet", "pr-mo-na", "No uploaded file carries this yet");
        else if (st.kind === "entry") done = moPill("To be entered", "pr-mo-entry", "Will be filled in on this page");
        else done = "";
        if (ev.pct != null) pct = fmtNum(Math.round(ev.pct * 1000) / 10) + "%";
        if (ev.score != null) score = fmtNum(r2(ev.score));
        var weighted = (r.lvl === 0 && r.w > 0) || r.community;
        if (!weighted) score = "";
        if (r.yn) { target = ""; pct = ""; score = ""; }
        if (!r.t && !r.tsum && !r.community && !r.v) pct = "";      // plain containers
      }
      row += moCell(r.w != null ? String(r.w) : "") + moCell(target) + moCell(done) + moCell(pct) + moCell(score) + "</tr>";
      out += rowOpen + (entIdx != null ? ' data-ent="' + entIdx + '"' : "") + ">" + row;
    });
    return out;
  }

  /* ---------- monthly save (A / B / G / H for period YYYYMM00) ---------- */
  function saveMonthly() {
    if (document.querySelector("#prMoBody .is-bad")) { toast("Fix the highlighted number first \u2014 it must be 0 or more."); return; }
    var e4 = moG4Eval();
    if (e4.items.length && e4.items.some(function (x) { return !x.name.trim(); })) { toast("G4: give every activity a name (or remove it)."); return; }
    if (e4.items.length && !e4.valid) { toast("G4: the activity weights add up to " + fmtNum(e4.wsum) + " \u2014 they must total exactly 10."); return; }
    var codes = Object.keys(MDIRTY).filter(function (c) { return Object.keys(MDIRTY[c]).length; });
    if (!codes.length) { toast("Nothing to save yet."); return; }
    var btn = $("prMoSave"); btn.disabled = true; btn.innerHTML = '<span class="pr-spin"></span>Saving\u2026';
    var empId = MVIEW.header.selfEmpId, failed = 0;
    Promise.all(codes.map(function (code) {
      return sbSaveWeekly(empId, code, MDIRTY[code], currentEmail()).catch(function (e) { failed++; console.error("Monthly save failed", e); });
    })).then(function () {
      btn.disabled = false; btn.textContent = "Save monthly review";
      if (failed) {
        var hint = document.querySelector("#prMoBody .pr-savehint");
        if (hint) { hint.textContent = "\u26A0 Save failed \u2014 click Save again to retry. Your changes are NOT lost."; hint.classList.add("is-fail"); }
        toast("Save failed \u2014 please click Save again to retry.");
      } else { toast("Saved."); MDIRTY = {}; loadMonthlyView(); }
    });
  }


  /* ---------- Academic Plan (G1): exams planned in a month ----------
     PO      -> that PO's own rows.
     PM / DM -> every row in the districts assigned to them (not a sum of
                their POs), and District -> rows of that district.
     For those roll-ups each exam is counted once per district: when two POs
     share a district the plan lists the same exam under both of them. */
  async function sbGetAcademic(unit, value, month) {
    await loadOrg();
    var rows = await fetchAll(function () { return db().from("academic_targets").select("*").eq("plan_month", month); });
    var lc = function (s) { return String(s == null ? "" : s).trim().toLowerCase(); };
    var item = function (r) { return { program: r.program_name || "", test: r.test_cycle || "", date: r.fixed_date || "",
                                       pref: r.preferred_month || "", district: r.district || "", pos: [] }; };
    var out = [];
    if (unit === "PO") {
      var id = normId(value);
      rows.filter(function (r) { return normId(r.po_id) === id; })
          .forEach(function (r) { var it = item(r); it.pos.push(r.po_name || r.po_id); out.push(it); });
    } else {
      // PM / DM / District. POs sharing a district each list the district's exams, often with
      // different test-cycle labels or dates for the same exam (e.g. "Test 1" / "Test 2" / "Test —").
      // So per district + program, the month's exam count = the most exams any ONE PO lists for it.
      // (One PO listing Test 1 and Test 2 in the same month still counts 2.)
      var districts = unit === "District" ? [value] : ((person(value) || {}).assigned_districts || []);
      var dk = {}; districts.forEach(function (d) { dk[normDist(d)] = 1; });
      var groups = {};
      rows.forEach(function (r) {
        if (!dk[normDist(r.district)]) return;
        var k = normDist(r.district) + "|" + lc(r.program_name);
        var gr = groups[k] = groups[k] || { program: r.program_name || "", district: r.district || "", byPo: {}, order: [] };
        var who = r.po_name || r.po_id || "(no PO)";
        if (!gr.byPo[who]) { gr.byPo[who] = []; gr.order.push(who); }
        gr.byPo[who].push({ test: r.test_cycle || "", date: r.fixed_date || "", pref: r.preferred_month || "" });
      });
      Object.keys(groups).forEach(function (k) {
        var gr = groups[k];
        out.push({ program: gr.program, district: gr.district, count: Math.max.apply(null, gr.order.map(function (w) { return gr.byPo[w].length; })),
                   byPo: gr.order.map(function (w) { return { po: w, tests: gr.byPo[w] }; }),
                   date: gr.order.map(function (w) { return gr.byPo[w].map(function (t) { return t.date; }).filter(Boolean).sort()[0] || ""; }).filter(Boolean).sort()[0] || "",
                   pos: gr.order });
      });
    }
    out.sort(function (a, b) { return (a.date || "9").localeCompare(b.date || "9") || a.district.localeCompare(b.district) || a.program.localeCompare(b.program); });
    return out;
  }

  // Exams planned: a PO's own rows count 1 each; a roll-up item carries its own count.
  function acadTotal(list) { return (list || []).reduce(function (a, it) { return a + (it.count || 1); }, 0); }

  function fmtDay(iso) {
    if (!iso) return "";
    var p = iso.split("-"); return Number(p[2]) + " " + MON_SHORT[Number(p[1]) - 1] + " " + p[0];
  }
  function openAcadList() {
    var list = (MVIEW && MVIEW.academic) || [], h = (MVIEW && MVIEW.header) || {};
    var who = h.unit === "PO" ? (h.po && h.po.name) : (h.manager || h.district || "");
    var roll = h.unit !== "PO";
    var monIdx = function (s) { return MON_SHORT.map(function (m) { return m.toLowerCase(); }).indexOf(String(s || "").trim().slice(0, 3).toLowerCase()) + 1; };
    var dateHtml = function (t) {
      var off = t.date && t.pref && monIdx(t.pref) !== Number(t.date.slice(5, 7));
      return t.date ? esc(fmtDay(t.date)) + (off ? '<div class="pr-list-warn" title="The plan\'s Preferred Month differs from the Fixed Date">Preferred month: ' + esc(t.pref) + "</div>" : "")
                    : '<span class="pr-mut">No date</span><div class="pr-list-warn">Preferred month: ' + esc(t.pref) + "</div>";
    };
    $("prListTitle").textContent = "Exams planned \u2014 " + monthLabel(MVIEW.month) + (who ? " \u00B7 " + who : "") + " (" + acadTotal(list) + ")";
    var head, body;
    if (!roll) {
      head = "<tr><th>#</th><th>Program</th><th>Test cycle</th><th>Date</th></tr>";
      body = list.map(function (e, i) {
        return '<tr class="pr-row"><td>' + (i + 1) + "</td><td>" + esc(e.program) + "</td><td>" + esc(e.test) + "</td><td>" + dateHtml(e) + "</td></tr>";
      }).join("");
    } else {
      head = '<tr><th>#</th><th>Program</th><th>District</th><th class="pr-num">Exams</th><th>As listed by each PO</th></tr>';
      body = list.map(function (e, i) {
        var lines = e.byPo.map(function (b) {
          return '<div class="pr-acad-po"><b>' + esc(b.po) + ":</b> " + b.tests.map(function (t) {
            return esc(t.test || "Test ?") + " \u00B7 " + (t.date ? esc(fmtDay(t.date)) : '<span class="pr-mut">no date</span>')
              + (t.pref && (!t.date || monIdx(t.pref) !== Number(t.date.slice(5, 7))) ? ' <span class="pr-list-warn">(pref. ' + esc(t.pref) + ")</span>" : "");
          }).join("; ") + "</div>";
        }).join("");
        return '<tr class="pr-row"><td>' + (i + 1) + "</td><td>" + esc(e.program) + "</td><td>" + esc(e.district) + '</td><td class="pr-num"><b>' + e.count + "</b></td><td>" + lines + "</td></tr>";
      }).join("");
    }
    $("prListBody").innerHTML = '<table class="pr-tbl"><thead>' + head + "</thead><tbody>" + body + "</tbody></table>";
    $("prListNote").textContent = roll
      ? "POs in the same district list the same exams, sometimes with different test cycles or dates. Each program counts the most exams any one PO lists for it this month."
      : "From Admin \u2192 Academic Plan.";
    $("prListModal").hidden = false;
  }
  function closeAcadList() { $("prListModal").hidden = true; }


  /* ---------- G2 / G3 / G5 targets (g1_g2_g3_target_sheet) ----------
     PO      -> that PO's row for the month.
     PM / DM -> the PO rows of their assigned districts; District -> that district.
     Block check per district: POs sorted by how many of the district's blocks
     they cover; a PO whose blocks are all already covered by a counted PO is
     not counted (senior / junior). A PO whose blocks can't be placed in the
     district is counted unless the district is already fully covered.
     Posts per teacher is a ratio: fixed at 1 for PM / DM / District.
     District recognition event: once per district (highest PO value).
     A target of 0 means "not set". */
  var TGT_LABEL = {
    story_telling: "Story Telling", poetry_recitation: "Poetry Recitation", creative_writing: "Creative Writing",
    spoken_english: "Spoken English", spelling_bee: "Spelling Bee", morning_assembly: "Morning Assembly",
    st_streak: "ST Streak", pr_streak: "PR Streak", cw_streak: "CW Streak", se_streak: "SE Streak",
    kathawli: "Kathawli", online_unique_teachers: "Online Unique Teachers", online_unique_schools: "Online Unique Schools",
    posts_per_teacher: "Posts per month / per teacher", star_teachers: "Star Teachers", teachers_using_expert_coupon: "Teachers using expert coupon",
    pom_transformed_clusters: "POM Transformed clusters", blocks_with_recognition_events: "Blocks with recognition events",
    district_recognition_event: "District recognition event held", teachers_recognized: "Teachers Recognized",
    cluster_heads_recognized: "Cluster Heads recognized", school_visits: "School Visits", cluster_visits: "Cluster Visits",
    officials_visits: "Officials Visits", case_study: "Case Study"
  };
  var TGT_KEYS = Object.keys(TGT_LABEL);

  async function sbGetTargets(unit, value, month) {
    await loadOrg();
    var y = Number(month.substring(0, 4)), m = Number(month.substring(4, 6));
    var rows = await fetchAll(function () { return db().from("g1_g2_g3_target_sheet").select("*").eq("year", y).eq("month", m); });
    var tnum = function (v) { var n = Number(v); return (v === null || v === undefined || v === "" || isNaN(n)) ? null : n; };
    var out = { cols: {}, unit: unit, rowsInMonth: rows.length };

    if (unit === "PO") {
      var r = rows.filter(function (x) { return normId(x.po_id) === normId(value); })[0] || null;
      TGT_KEYS.forEach(function (k) {
        var v = r ? tnum(r[k]) : null;
        out.cols[k] = { value: v > 0 ? v : null, parts: r ? [{ district: r.district, po: r.po_name || r.po_id, value: v, status: v > 0 ? "counted" : "zero" }] : [] };
      });
      return out;
    }

    var districts = unit === "District" ? [value] : ((person(value) || {}).assigned_districts || []);
    var contributors = [];
    districts.forEach(function (dn) {
      var dk = normDist(dn), dist = ORG.distByKey[dk];
      var dBlocks = dist ? dist.blocks.map(normBlock) : [];
      var cand = rows.filter(function (x) { return normDist(x.district) === dk; }).map(function (x) {
        var p = person(x.po_id);
        var bl = p ? (p.assigned_blocks || []).map(normBlock).filter(function (b) { return dBlocks.indexOf(b) >= 0; }) : [];
        return { r: x, name: x.po_name || x.po_id, blocks: bl, district: dist ? dist.name : dn, dTotal: dBlocks.length };
      }).sort(function (a, b) { return b.blocks.length - a.blocks.length; });
      var covered = {};
      var who = function (keys) { return keys.map(function (b) { return covered[b]; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(", "); };
      cand.forEach(function (c) {
        if (!c.blocks.length) {
          var full = dBlocks.length && dBlocks.every(function (b) { return covered[b]; });
          c.status = full ? "skipped" : "counted";
          c.note = full ? "District already fully covered by " + who(dBlocks) : "Blocks not found in Assignments for this district";
        } else {
          var already = c.blocks.filter(function (b) { return covered[b]; });
          if (already.length === c.blocks.length) { c.status = "skipped"; c.note = "All " + c.blocks.length + " blocks already covered by " + who(already); }
          else {
            c.status = "counted";
            if (already.length) c.note = already.length + " of " + c.blocks.length + " blocks overlap " + who(already);
            c.blocks.forEach(function (b) { if (!covered[b]) covered[b] = c.name; });
          }
        }
        contributors.push(c);
      });
    });

    TGT_KEYS.forEach(function (k) {
      if (k === "posts_per_teacher") { out.cols[k] = { value: 1, fixed: true, parts: [] }; return; }
      var perDistrict = k === "district_recognition_event", parts = [], total = 0, best = {};
      contributors.forEach(function (c) {
        var v = tnum(c.r[k]);
        var part = { district: c.district, po: c.name, blocks: c.blocks.length, dTotal: c.dTotal, value: v, status: c.status, note: c.note };
        if (c.status === "counted" && !(v > 0)) part.status = "zero";
        parts.push(part);
        if (part.status !== "counted") return;
        if (perDistrict) { if (!best[c.district] || v > best[c.district].value) best[c.district] = part; }
        else total += v;
      });
      if (perDistrict) {
        parts.forEach(function (p) { if (p.status === "counted" && best[p.district] !== p) { p.status = "once"; p.note = "District counted once (highest value)"; } });
        Object.keys(best).forEach(function (d) { total += best[d].value; });
      }
      out.cols[k] = { value: total > 0 ? total : null, parts: parts, perDistrict: perDistrict };
    });
    return out;
  }

  // Which target each Monthly line uses: one column, or the sum of several.
  var MO_TMAP = {
    "G2|LS Program Cycle (Core)": { tsum: ["story_telling", "creative_writing", "poetry_recitation", "spoken_english"] },
    "G2|Storytelling": { t: "story_telling" }, "G2|Creative Writing": { t: "creative_writing" },
    "G2|Poetry": { t: "poetry_recitation" }, "G2|Spoken English": { t: "spoken_english" },
    "G2|LS Program Cycle (Non-core)": { tsum: ["morning_assembly", "spelling_bee"] },
    "G2|Morning Assembly": { t: "morning_assembly" }, "G2|Spelling Bee": { t: "spelling_bee" },
    "G2|Streak": { tsum: ["st_streak", "cw_streak", "se_streak", "pr_streak"] },
    "G2|Streak \u00B7 Storytelling": { t: "st_streak" }, "G2|Streak \u00B7 Creative Writing": { t: "cw_streak" },
    "G2|Streak \u00B7 Spoken English": { t: "se_streak" }, "G2|Streak \u00B7 Poetry": { t: "pr_streak" },
    "G3|Vinoba Kathavli Stories": { t: "kathawli" },
    "G3|Online + Offline community": { community: true },
    "G3|Unique teachers posting": { t: "online_unique_teachers" }, "G3|Unique schools posting": { t: "online_unique_schools" },
    "G3|Posts per month per teacher": { t: "posts_per_teacher" }, "G3|Star teachers (3-month consistency)": { t: "star_teachers" },
    "G3|Teachers using expert coupons": { t: "teachers_using_expert_coupon" }, "G3|POM transformed clusters": { t: "pom_transformed_clusters" },
    "G3|Blocks with recognition events": { t: "blocks_with_recognition_events" },
    "G3|District recognition events held": { t: "district_recognition_event" },
    "G3|Teachers recognised": { t: "teachers_recognized" }, "G3|Cluster heads recognised": { t: "cluster_heads_recognized" },
    "G5|Visits": { tsum: ["school_visits", "cluster_visits", "officials_visits"] },
    "G5|School": { t: "school_visits" }, "G5|Cluster": { t: "cluster_visits" }, "G5|Block / District": { t: "officials_visits" },
    "G5|Case Study": { t: "case_study" }
  };
  MO_GOALS.forEach(function (g) { g.rows.forEach(function (r) { var x = MO_TMAP[g.key + "|" + r.label]; if (x) { for (var k in x) r[k] = x[k]; } }); });

  function moTarget(r) {
    var T = MVIEW && MVIEW.targets;
    if (!r.t && !r.tsum) return { state: "none" };
    if (!T) return { state: "unavailable" };
    if (r.t) { var c = T.cols[r.t]; return c && c.value != null ? { state: "ok", value: c.value, fixed: !!c.fixed } : { state: "notset" }; }
    var vs = r.tsum.map(function (k) { return T.cols[k] && T.cols[k].value; }).filter(function (v) { return v != null; });
    return vs.length ? { state: "ok", value: vs.reduce(function (a, b) { return a + b; }, 0) } : { state: "notset" };
  }
  // One evaluation per line, shared by the table and the cards.
  function moEval(g, r, rp) {
    var res = { st: moRowState(r, rp), tg: moTarget(r), pct: null, score: null };
    if (r.community) {           // equal weights: average of capped % over metrics with a target and data, x 15
      var mets = g.rows.filter(function (x) { return x.lvl === 2 && x.t; }), ach = [];
      mets.forEach(function (x) { var t = moTarget(x), s = moRowState(x, rp); if (t.state === "ok" && s.kind === "num") ach.push(Math.min(s.value / t.value, 1)); });
      res.used = ach.length; res.of = mets.length;
      if (ach.length) { res.pct = ach.reduce(function (a, b) { return a + b; }, 0) / ach.length; res.score = r.w * res.pct; }
      return res;
    }
    if (res.tg.state === "ok" && res.st.kind === "num" && res.tg.value > 0) {
      res.pct = Math.min(res.st.value / res.tg.value, 1);
      if (r.lvl === 0 && r.w > 0) res.score = r.w * res.pct;
    }
    return res;
  }
  function moComplianceScore(g, r, rp) {
    var c = moCompliance(g, rp);
    if (c.answered !== c.total) return null;
    var p = Math.min(c.yes / r.target, 1); return { pct: p, score: r.w * p };
  }
  function moGoalScore(g, rp) {
    if (g.key === "G4") { var e4 = moG4Eval(); return { score: e4.score, scored: e4.scored, total: e4.items.length }; }
    if (g.key === "G1") {
      var ac = MVIEW.academic, gs = (ac && acadTotal(ac)) ? moPctScore(moG1Done(), acadTotal(ac), g.weight) : null;
      return { score: gs ? gs.score : null, scored: gs ? 1 : 0, total: 1 };
    }
    var comps = g.rows.filter(function (r) { return r.lvl === 0 && r.w > 0; }), got = 0, n = 0;
    comps.forEach(function (r) {
      var sc = r.compliance ? moComplianceScore(g, r, rp) : moEval(g, r, rp);
      if (sc && sc.score != null) { got += sc.score; n++; }
    });
    return { score: n ? got : null, scored: n, total: comps.length };
  }
  function r2(x) { return Math.round(x * 100) / 100; }

  /* ---------- target reconciliation popup ---------- */
  var MO_TLINES = [];
  function openTargetPopup(i) {
    var item = MO_TLINES[i]; if (!item) return;
    var r = item.r, T = MVIEW.targets, h = MVIEW.header || {};
    var who = h.unit === "PO" ? (h.po && h.po.name) : (h.manager || h.district || "");
    $("prListTitle").textContent = "Target \u2014 " + r.label + " \u00B7 " + monthLabel(MVIEW.month) + (who ? " \u00B7 " + who : "");
    var body = "", note = "";
    if (r.tsum) {
      var tot = 0;
      body = '<table class="pr-tbl"><thead><tr><th>Part</th><th class="pr-num">Target</th></tr></thead><tbody>'
        + r.tsum.map(function (k) { var v = T.cols[k] && T.cols[k].value; if (v != null) tot += v;
            return '<tr class="pr-row"><td>' + esc(TGT_LABEL[k]) + '</td><td class="pr-num">' + (v != null ? fmtNum(v) : '<span class="pr-mut">Not set</span>') + "</td></tr>"; }).join("")
        + '<tr class="pr-row pr-tgt-total"><td>Total</td><td class="pr-num">' + fmtNum(tot) + "</td></tr></tbody></table>";
      note = "Open each line's own target to see which POs and districts it comes from.";
    } else {
      var c = T.cols[r.t];
      if (c.fixed) {
        body = '<div class="pr-empty" style="padding:22px">Posts per teacher is a ratio, so it is not added up. The target is <b>1</b> for PM, DM and District \u2014 the same as every PO\'s target.</div>';
      } else if (T.unit === "PO") {
        var p0 = c.parts[0];
        body = '<table class="pr-tbl"><thead><tr><th>From</th><th>District</th><th class="pr-num">Target</th></tr></thead><tbody><tr class="pr-row"><td>'
          + esc(p0 ? p0.po : "") + "'s row</td><td>" + esc(p0 ? p0.district : "") + '</td><td class="pr-num">' + fmtNum(p0 ? p0.value : null) + "</td></tr></tbody></table>";
        note = "From Admin \u2192 G2 \u00B7 G3 \u00B7 G5 Targets, " + monthLabel(MVIEW.month) + ".";
      } else {
        var ST = { counted: ["Counted", "pr-rev-yes"], skipped: ["Not counted", "pr-mut"], zero: ["No target (0)", "pr-mut"], once: ["Not counted", "pr-mut"] };
        body = '<table class="pr-tbl"><thead><tr><th>District</th><th>PO</th><th class="pr-num">Blocks</th><th class="pr-num">Target</th><th>In total?</th></tr></thead><tbody>'
          + c.parts.map(function (p) { var s = ST[p.status] || [p.status, ""];
              return '<tr class="pr-row"><td>' + esc(p.district) + "</td><td>" + esc(p.po) + '</td><td class="pr-num">' + p.blocks + "/" + p.dTotal
                + '</td><td class="pr-num">' + (p.value == null ? "" : fmtNum(p.value)) + '</td><td><span class="' + s[1] + '">' + s[0] + "</span>"
                + (p.note ? '<div class="pr-list-warn">' + esc(p.note) + "</div>" : "") + "</td></tr>"; }).join("")
          + '<tr class="pr-row pr-tgt-total"><td colspan="3">Total</td><td class="pr-num">' + fmtNum(c.value) + "</td><td></td></tr></tbody></table>";
        note = c.perDistrict ? "Counted once per district (the highest PO value)." : "PO rows of the districts, added up. A PO whose blocks are all covered by another PO is not counted.";
        if (!c.parts.length) note = "No PO rows for these districts in this month's targets.";
      }
    }
    $("prListBody").innerHTML = body; $("prListNote").textContent = note; $("prListModal").hidden = false;
  }

  window.FTRDashboard = { mount: mount };
})();