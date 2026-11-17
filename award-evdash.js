/* award-evdash.js - Events > Dashboard on the Awards & Gifts page.

   Read-only. Adds up what Events > Utilisations saves (public.award_events) and
   the teachers felicitated counted from verified awards (public.award_records),
   for the districts picked with the filters, one row per month of the academic
   year. Nothing here writes to the database.

   Filters: State, DM, PM, District and AY. They come from the Staff Connect
   Employees list (Firestore "Employees", read through app.js):
     State - where the Employees directory places the district (window.olfGeography,
             the same State > Division > District tree the rest of this page uses)
     PM    - active staff whose Dept is "Program Implementation - PM", for the
             districts written against them in the District column
     DM    - active staff whose Dept is "Program Implementation - Div", for the
             districts written against them (if none are written, the districts
             of the Division(s) written against them)
   A district is matched by name, ignoring capitals, spaces and punctuation.
   Choosing a State / DM / PM narrows the lists after it.

   The numbers follow Events > Utilisations exactly:
     Block events                  = the block rows of each district (district rows are not added)
     Teachers felicitated (block)  = verified Block Level awards, in each award's own month
     District / SU-NS / Other / Cluster heads = the district row (empty block)
     Teachers felicitated (district) = verified District Level awards (POM + LIFESKILL)
     SU/NS / Other events          = the district row; their Teachers Felicitated are counted
                                     from verified NS + SU / Other + Coffee With CEO awards
     Cluster heads                 = verified Top Clusters awards
   A month after the current one shows "—" for the two counted columns. */
(function () {

const SB_URL = "https://rpnxpkwcpsbxswnowuhx.supabase.co";
const SB_KEY = "sb_publishable_60Ynb6EZ6Qc2GHrdqERwpw_dUdH3dKD";
const PAGE = 1000;

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const AY_START_MONTH = 6;              // June (1-based): AY 2026-27 = Jun-2026 ... May-2027

// The table's columns, in the same groups and colours as Events > Utilisations.
const COLUMNS = [
  { key: "blockEvents",      db: "block_events",      head: "Total<br>Block Events",                    xl: "Total Block Events",                    group: "block" },
  { key: "blockTeachers",    auto: "block",           head: "Teachers Felicitated<br>(Block Level)",    xl: "Teachers Felicitated (Block Level)",    group: "block" },
  { key: "districtEvents",   db: "district_events",   head: "Total<br>District Events",                 xl: "Total District Events",                 group: "district" },
  { key: "districtTeachers", auto: "district",        head: "Teachers Felicitated<br>(District Level)", xl: "Teachers Felicitated (District Level)", group: "district" },
  { key: "suNsEvents",       db: "su_ns_events",      head: "SU/NS<br>Events",                          xl: "SU/NS Events",                          group: "suns" },
  { key: "suNsTeachers",     auto: "suns",    head: "Teachers Felicitated<br>(SU/NS Events)",   xl: "Teachers Felicitated (SU/NS Events)",   group: "suns" },
  { key: "otherEvents",      db: "other_events",      head: "Other<br>Events",                          xl: "Other Events",                          group: "other" },
  { key: "otherTeachers",    auto: "other",    head: "Teachers Felicitated<br>(Other Events)",   xl: "Teachers Felicitated (Other Events)",   group: "other" },
  { key: "clusterHeads",     auto: "cluster",     head: "Total Cluster<br>Heads Recognised",        xl: "Total Cluster Heads Recognised",        group: "cluster" }
];
const GROUPS = { block: "Block level", district: "District level", suns: "SU / NS events", other: "Other events", cluster: "Cluster heads" };
const AUTO_MSG = "Counted from verified awards in Award Management, in each award's own month.";

// ── state ──
let loaded = false, loading = false, loadedAt = 0;
let events = [];               // award_events rows
let felic = {};                // districtKey -> month -> { block, district, blocks: { BLOCKNAME: n } }
let districts = [];            // [{ key, name, state, blocks: [] }]
let people = [];               // [{ name, role: "DM"|"PM", keys: Set(districtKey) }]
let orgOk = false;             // the Employees list loaded
let sel = { state: "", dm: "", pm: "", district: "", ay: "" };
let lastLines = [];            // what the table shows (for the Excel file)

// ── helpers ──
function el(id) { return document.getElementById(id); }
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function str(v) { return v === undefined || v === null ? "" : String(v).trim(); }
function nameKey(name) { return str(name).toLowerCase().replace(/[^a-z0-9]/g, ""); }
function blockName(block) { return str(block).replace(/^\s*\d+\s*-\s*/, "").trim().toUpperCase(); }
function intOf(v) { const t = str(v); return /^\d+$/.test(t) ? Number(t) : null; }

function toast(msg, kind) {
  const t = document.createElement("div");
  t.className = "awd-toast " + (kind || "success");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function () { t.classList.add("hide"); }, 2600);
  setTimeout(function () { t.remove(); }, 3000);
}

async function sbGet(path) {
  const res = await fetch(SB_URL + "/rest/v1/" + path, { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function sbAll(path) {
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await sbGet(path + (path.indexOf("?") < 0 ? "?" : "&") + "limit=" + PAGE + "&offset=" + offset);
    Array.prototype.push.apply(out, page);
    if (page.length < PAGE) break;
  }
  return out;
}
// ── academic years ──
function ayLabel(y) { return y + "-" + String((y + 1) % 100).padStart(2, "0"); }
function ayStartOf(d) { return d.getMonth() + 1 >= AY_START_MONTH ? d.getFullYear() : d.getFullYear() - 1; }
function monthOrder(m) {
  const p = str(m).split("-"), mi = MONTH_NAMES.indexOf(str(p[0]).slice(0, 3)), yr = parseInt(p[1], 10);
  return mi < 0 || isNaN(yr) ? null : yr * 12 + mi;
}
function ayOfMonth(m) { const o = monthOrder(m); if (o === null) return null; const y = Math.floor(o / 12), mi = o % 12; return mi + 1 >= AY_START_MONTH ? y : y - 1; }
function monthsOf(ay) {
  const y = parseInt(str(ay).split("-")[0], 10), out = [];
  if (isNaN(y)) return out;
  for (let i = 0; i < 12; i++) {
    const mi = (AY_START_MONTH - 1 + i) % 12;
    out.push(MONTH_NAMES[mi] + "-" + (y + (AY_START_MONTH - 1 + i >= 12 ? 1 : 0)));
  }
  return out;
}
function isFuture(m) { const n = new Date(); return monthOrder(m) > n.getFullYear() * 12 + n.getMonth(); }
function ayOptions() {
  const now = ayStartOf(new Date());
  const saved = events.map(function (r) { return ayOfMonth(r.month_label); }).filter(function (y) { return y !== null; });
  const first = Math.min.apply(null, saved.concat([now]));
  const out = [];
  for (let y = first; y <= now + 1; y++) out.push(ayLabel(y));
  return out;
}

// ── data ──
// Which column a verified award counts in, from its Award Category (same rule as award-event.js).
function felicKind(category) {
  const c = str(category).toLowerCase().replace(/\s+/g, " ");
  if (c.indexOf("block level") === 0) return "block";
  if (c.indexOf("district level") === 0) return "district";
  if (c.indexOf("nanhe sitare") >= 0 || c.indexOf("shikshan utsav") >= 0 || /\((ns|su)\)/.test(c)) return "suns";
  if (c.indexOf("top cluster") === 0) return "cluster";
  if (c === "other" || c.indexOf("coffee with ceo") >= 0) return "other";
  return "";
}
function awardMonth(dateStr) {
  const m = /^(\d{4})-(\d{2})/.exec(str(dateStr));
  if (!m) return "";
  const mi = Number(m[2]) - 1;
  return mi >= 0 && mi < 12 ? MONTH_NAMES[mi] + "-" + m[1] : "";
}

async function loadAll() {
  const r = await Promise.all([
    sbAll("award_events?select=*&order=id.asc"),
    sbAll("award_records?select=district_name,block_name,award_category,month_label,awarded_date,rejected&awarded=is.true&verified=is.true&order=id.asc"),
    sbAll("award_blocks?select=state,district_name,block&order=sort_order.asc,id.asc"),
    sbGet("award_month_summary?select=district_name"),
    window.awardOrgFromEmployees().catch(function (e) { console.warn("Event dashboard: Employees list not loaded:", e); return null; })
  ]);
  events = r[0];

  // Teachers felicitated: the same rule as Events > Utilisations.
  felic = {};
  r[1].forEach(function (x) {
    if (x.rejected === true) return;
    const label = str(x.month_label);
    const month = /^[A-Z][a-z]{2}-\d{4}$/.test(label) && MONTH_NAMES.indexOf(label.slice(0, 3)) >= 0 ? label : awardMonth(x.awarded_date);
    const dk = nameKey(x.district_name), kind = felicKind(x.award_category);
    if (!month || !dk || !kind) return;
    const d = (felic[dk] = felic[dk] || {});
    const m = (d[month] = d[month] || { block: 0, district: 0, suns: 0, other: 0, cluster: 0, blocks: {} });
    if (kind !== "block") { m[kind]++; return; }
    m.block++;
    const bk = blockName(x.block_name) || "";
    m.blocks[bk] = (m.blocks[bk] || 0) + 1;
  });

  // Districts: the ones Award Management lists, plus any with saved events or blocks.
  const byKey = {};
  const add = function (name) {
    const k = nameKey(name);
    if (!k) return null;
    if (!byKey[k]) byKey[k] = { key: k, name: str(name), state: "", blocks: [] };
    return byKey[k];
  };
  r[3].forEach(function (x) { add(x.district_name); });
  events.forEach(function (x) { add(x.district_name); });
  r[2].forEach(function (x) {
    const d = byKey[nameKey(x.district_name)];
    if (!d) return;                                  // a block list for a district with no awards or events
    if (x.state && !d.state) d.state = str(x.state);
    if (d.blocks.indexOf(x.block) < 0) d.blocks.push(x.block);
  });

  // States / DMs / PMs from the Staff Connect Employees list.
  people = r[4] ? r[4].people : [];
  orgOk = !!r[4];
  if (r[4]) Object.keys(byKey).forEach(function (k) { if (r[4].stateOf[k]) byKey[k].state = r[4].stateOf[k]; });
  districts = Object.keys(byKey).map(function (k) { return byKey[k]; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
}

// DMs, PMs and each district's State, from the Staff Connect Employees list (Firestore,
// read through app.js) and the State > Division > District tree app.js builds from it.
// Shared with the Awards Dashboard (award-dash.js). Cached for a minute.
//   people:  [{ name, role: "DM" | "PM", keys: Set(district key) }]
//   stateOf: { district key: state }
function splitMulti(v) { return str(v).split(/[;\r\n]/).map(function (x) { return x.trim(); }).filter(Boolean); }
let orgCache = null, orgCacheAt = 0;
window.awardDistrictKey = nameKey;
window.awardOrgFromEmployees = async function () {
  if (orgCache && Date.now() - orgCacheAt < 60000) return orgCache;
  if (typeof window.olfGetEmployees !== "function") throw new Error("Employees list not available");
  const res = await Promise.all([
    window.olfGetEmployees(),
    typeof window.olfGeography === "function" ? window.olfGeography().catch(function () { return []; }) : Promise.resolve([])
  ]);
  const employees = res[0] || [], geo = res[1] || [];
  const stateOf = {}, divOf = {};
  geo.forEach(function (st) {
    (st.divisions || []).forEach(function (dv) {
      (dv.districts || []).forEach(function (dn) {
        const k = nameKey(dn);
        if (!stateOf[k]) stateOf[k] = str(st.name);
        (divOf[nameKey(dv.name)] = divOf[nameKey(dv.name)] || []).push(k);
      });
    });
  });
  const list = [];
  employees.forEach(function (e) {
    if (str(e.Status).toLowerCase() === "inactive") return;
    const dept = str(e.Dept).toLowerCase().replace(/\s+/g, " ");
    const role = /^program implementation\s*[-–]?\s*pm$/.test(dept) ? "PM"
               : /^program implementation\s*[-–]?\s*div$/.test(dept) ? "DM" : "";
    if (!role || !str(e.Name)) return;
    let keys = splitMulti(e.District).map(nameKey).filter(Boolean);
    if (!keys.length && role === "DM") {
      splitMulti(e.Division).forEach(function (dv) { keys = keys.concat(divOf[nameKey(dv)] || []); });
    }
    if (!keys.length) return;
    const same = list.filter(function (p) { return p.role === role && p.name === str(e.Name); })[0];
    if (same) keys.forEach(function (k) { same.keys.add(k); });
    else list.push({ name: str(e.Name), role: role, keys: new Set(keys) });
  });
  list.sort(function (a, b) { return a.name.localeCompare(b.name); });
  orgCache = { people: list, stateOf: stateOf };
  orgCacheAt = Date.now();
  return orgCache;
};

// ── filters ──
function peopleFor(role, dk) {
  return people.filter(function (p) { return p.role === role && p.keys.has(dk); }).map(function (p) { return p.name; });
}
function personKeys(role, name) {
  const p = people.filter(function (x) { return x.role === role && x.name === name; })[0];
  return p ? p.keys : new Set();
}
// The districts that pass the filters above `upTo` (in the order State, DM, PM, District).
function inScope(upTo) {
  const order = ["state", "dm", "pm", "district"];
  const stop = upTo ? order.indexOf(upTo) : order.length;
  return districts.filter(function (d) {
    if (stop > 0 && sel.state && d.state !== sel.state) return false;
    if (stop > 1 && sel.dm && !personKeys("DM", sel.dm).has(d.key)) return false;
    if (stop > 2 && sel.pm && !personKeys("PM", sel.pm).has(d.key)) return false;
    if (stop > 3 && sel.district && d.key !== sel.district) return false;
    return true;
  });
}

function fillSelect(id, allLabel, items, value, disabledMsg) {
  const dd = el(id);
  if (!dd) return value;
  if (disabledMsg) {
    dd.innerHTML = '<option value="">' + esc(disabledMsg) + "</option>";
    dd.disabled = true;
    return "";
  }
  dd.innerHTML = (allLabel ? '<option value="">' + esc(allLabel) + "</option>" : "") +
    items.map(function (it) { return '<option value="' + esc(it.value) + '">' + esc(it.label) + "</option>"; }).join("");
  dd.disabled = false;
  const ok = items.some(function (it) { return it.value === value; });
  dd.value = ok ? value : (allLabel ? "" : (items[0] ? items[0].value : ""));
  return dd.value;
}

function renderFilters() {
  const states = Array.from(new Set(districts.map(function (d) { return d.state; }).filter(Boolean))).sort();
  sel.state = fillSelect("aedState", "All States", states.map(function (s) { return { value: s, label: s }; }), sel.state);

  const noOrg = orgOk ? "" : "Employees list unavailable";
  const dmKeys = inScope("dm");
  const dms = Array.from(new Set([].concat.apply([], dmKeys.map(function (d) { return peopleFor("DM", d.key); })))).sort();
  sel.dm = fillSelect("aedDm", "All DMs", dms.map(function (n) { return { value: n, label: n }; }), sel.dm, noOrg);

  const pmKeys = inScope("pm");
  const pms = Array.from(new Set([].concat.apply([], pmKeys.map(function (d) { return peopleFor("PM", d.key); })))).sort();
  sel.pm = fillSelect("aedPm", "All PMs", pms.map(function (n) { return { value: n, label: n }; }), sel.pm, orgOk ? "" : "Employees list unavailable");

  const ds = inScope("district");
  sel.district = fillSelect("aedDistrict", "All Districts", ds.map(function (d) { return { value: d.key, label: d.name }; }), sel.district);

  if (!sel.ay) sel.ay = ayLabel(ayStartOf(new Date()));
  sel.ay = fillSelect("aedYear", "", ayOptions().map(function (y) { return { value: y, label: "AY " + y }; }), sel.ay);
}

// ── numbers ──
// One district + month: the value of every column, or null where nothing is known.
function districtMonth(d, month) {
  const out = {};
  const future = isFuture(month);
  const rows = events.filter(function (r) { return nameKey(r.district_name) === d.key && str(r.month_label) === month; });
  const dRow = rows.filter(function (r) { return str(r.block) === ""; })[0] || null;
  const f = (felic[d.key] || {})[month] || null;
  COLUMNS.forEach(function (c) {
    if (c.auto) { out[c.key] = future ? null : (f ? f[c.auto] : 0); return; }
    if (c.key === "blockEvents") {
      let sum = 0, any = false;
      rows.forEach(function (r) { if (str(r.block) === "") return; const v = intOf(r.block_events); if (v !== null) { sum += v; any = true; } });
      out[c.key] = any ? sum : null;
      return;
    }
    out[c.key] = dRow ? intOf(dRow[c.db]) : null;
  });
  out._reported = rows.some(function (r) { return COLUMNS.some(function (c) { return c.db && intOf(r[c.db]) !== null; }); });
  return out;
}

function addUp(list) {
  const out = {};
  COLUMNS.forEach(function (c) {
    let sum = 0, any = false;
    list.forEach(function (x) { if (x[c.key] !== null && x[c.key] !== undefined) { sum += x[c.key]; any = true; } });
    out[c.key] = any ? sum : null;
  });
  return out;
}

// ── table ──
function groupClass(ci) {
  const c = COLUMNS[ci];
  return "pev-g-" + c.group + (ci === 0 || COLUMNS[ci - 1].group !== c.group ? " pev-gs" : "");
}
function renderHead() {
  const thead = el("aedThead");
  if (!thead) return;
  let groups = "";
  for (let ci = 0; ci < COLUMNS.length; ) {
    let span = 1;
    while (ci + span < COLUMNS.length && COLUMNS[ci + span].group === COLUMNS[ci].group) span++;
    groups += '<th colspan="' + span + '" scope="colgroup" class="pev-grp ' + groupClass(ci) + '">' + esc(GROUPS[COLUMNS[ci].group]) + "</th>";
    ci += span;
  }
  const cells = COLUMNS.map(function (c, ci) {
    return '<th class="' + groupClass(ci) + (c.auto ? " pev-auto-th" : "") + '"' + (c.auto ? ' title="' + esc(AUTO_MSG) + '"' : "") + ">" + c.head + "</th>";
  }).join("");
  thead.innerHTML = '<tr class="pev-grp-row"><th rowspan="2">Month</th>' + groups +
    '<th rowspan="2" title="Districts in view with any count saved for the month">Districts<br>Reported</th></tr>' +
    '<tr class="pev-col-row">' + cells + "</tr>";
  const cg = el("aedColgroup");
  if (cg) {
    const each = ((100 - 9 - 8) / COLUMNS.length).toFixed(2);
    cg.innerHTML = '<col style="width:9%">' + COLUMNS.map(function () { return '<col style="width:' + each + '%">'; }).join("") + '<col style="width:8%">';
  }
}
function message(msg) {
  renderHead();
  const body = el("aedBody");
  if (body) body.innerHTML = '<tr><td colspan="' + (COLUMNS.length + 2) + '" class="pom-msg">' + esc(msg) + "</td></tr>";
}
function cell(v) { return v === null || v === undefined ? "—" : String(v); }

function render() {
  if (!loaded) return;
  const scope = inScope();
  const info = el("aedInfo");
  if (info) info.textContent = scope.length + " district" + (scope.length === 1 ? "" : "s") + " in view";
  if (!scope.length) { lastLines = []; message("No districts match the selected filters."); return; }

  renderHead();
  lastLines = monthsOf(sel.ay).map(function (m) {
    const per = scope.map(function (d) { return districtMonth(d, m); });
    const line = addUp(per);
    line.month = m;
    line.reported = per.filter(function (x) { return x._reported; }).length;
    line.future = isFuture(m);
    return line;
  });
  const tot = addUp(lastLines);

  const body = el("aedBody");
  body.innerHTML = lastLines.map(function (l) {
    return "<tr" + (l.future ? ' class="aed-future"' : "") + '><td class="pev-month">' + esc(l.month) + "</td>" +
      COLUMNS.map(function (c, ci) { return '<td class="' + groupClass(ci) + '">' + cell(l[c.key]) + "</td>"; }).join("") +
      '<td class="aed-rep">' + (l.future ? "—" : l.reported + " / " + scope.length) + "</td></tr>";
  }).join("") +
    '<tr class="pev-totals"><td>Total</td>' +
    COLUMNS.map(function (c, ci) { return '<td class="' + groupClass(ci) + '">' + cell(tot[c.key]) + "</td>"; }).join("") + "<td></td></tr>";
}

// ── load / refresh ──
function setBusy(on) {
  ["aedState", "aedDm", "aedPm", "aedDistrict", "aedYear", "aedExportBtn"].forEach(function (id) {
    const n = el(id); if (n && on) n.disabled = true;
  });
}
function start() {
  if (loading) return Promise.resolve();
  loading = true;
  setBusy(true);
  if (!loaded) message("Loading data…");
  return loadAll().then(function () {
    loaded = true; loadedAt = Date.now();
    renderFilters();
    const b = el("aedExportBtn"); if (b) b.disabled = false;
    render();
  }).catch(function (e) {
    console.error("Event dashboard load failed:", e);
    if (!loaded) message("Could not load the data. Use Refresh data to try again.");
    else { renderFilters(); const b = el("aedExportBtn"); if (b) b.disabled = false; }
    toast("Could not load event data.", "error");
  }).then(function () { loading = false; });
}

function onFilter(key) {
  return function () {
    sel[key] = el({ state: "aedState", dm: "aedDm", pm: "aedPm", district: "aedDistrict", ay: "aedYear" }[key]).value;
    // Picking a DM or PM starts over from their districts: State, District and the other
    // of DM / PM go back to All. The academic year stays as it is.
    if ((key === "dm" || key === "pm") && sel[key]) {
      sel.state = ""; sel.district = "";
      if (key === "dm") sel.pm = ""; else sel.dm = "";
    }
    renderFilters();                 // the lists after this one narrow (a choice no longer offered goes back to All)
    render();
  };
}

// ── Detailed Excel ──
function filterText() {
  const dist = sel.district ? (districts.filter(function (d) { return d.key === sel.district; })[0] || {}).name : "";
  return [["State", sel.state || "All States"], ["DM", sel.dm || "All DMs"], ["PM", sel.pm || "All PMs"],
          ["District", dist || "All Districts"], ["AY", sel.ay]];
}
function downloadDetailed() {
  if (!loaded) { toast("The data is still loading.", "info"); return; }
  const scope = inScope();
  if (!scope.length) { toast("No districts match the selected filters.", "info"); return; }
  const X = window.awardXlsx;
  if (!X || !X.buildWorkbook) { toast("Could not generate the Excel file.", "error"); return; }
  const H = function (v) { return { s: 1, v: v }; };
  const n = function (v) { return v === null || v === undefined ? "" : v; };
  const months = monthsOf(sel.ay);

  // Sheet 1: one line per district-level record and per block, for every month up to now
  // (later months only where something was saved). Blank = nothing saved.
  const head = ["State", "DM", "PM", "District", "Level", "Block", "Month"].concat(COLUMNS.map(function (c) { return c.xl; }), ["Last Updated By", "Last Updated At"]);
  const lines = [];
  scope.forEach(function (d) {
    const dms = peopleFor("DM", d.key).join(", "), pms = peopleFor("PM", d.key).join(", ");
    const evs = events.filter(function (r) { return nameKey(r.district_name) === d.key; });
    // Blocks: the district's list, then any block that has saved counts or awards but is not on it.
    const blocks = d.blocks.slice();
    const known = new Set(blocks.map(blockName));
    evs.forEach(function (r) { const b = str(r.block); if (b && !known.has(blockName(b))) { known.add(blockName(b)); blocks.push(b); } });
    months.forEach(function (m) {
      const future = isFuture(m);
      const mrows = evs.filter(function (r) { return str(r.month_label) === m; });
      if (future && !mrows.length) return;
      const f = (felic[d.key] || {})[m] || { block: 0, district: 0, suns: 0, other: 0, cluster: 0, blocks: {} };
      const dRow = mrows.filter(function (r) { return str(r.block) === ""; })[0] || null;
      const base = [d.state, dms, pms, d.name];
      lines.push(base.concat(["District", "", m]).concat(COLUMNS.map(function (c) {
        if (c.group === "block") return "";
        if (c.auto) return future ? "" : f[c.auto];
        return dRow ? n(intOf(dRow[c.db])) : "";
      }), [dRow ? str(dRow.updated_by) : "", dRow && dRow.updated_at ? new Date(dRow.updated_at).toLocaleString("en-IN") : ""]));
      const placed = new Set();
      blocks.forEach(function (b) {
        const bk = blockName(b);
        placed.add(bk);
        const bRow = mrows.filter(function (r) { return str(r.block) !== "" && blockName(r.block) === bk; })[0] || null;
        lines.push(base.concat(["Block", b, m]).concat(COLUMNS.map(function (c) {
          if (c.group !== "block") return "";
          if (c.auto) return future ? "" : (f.blocks[bk] || 0);
          return bRow ? n(intOf(bRow[c.db])) : "";
        }), [bRow ? str(bRow.updated_by) : "", bRow && bRow.updated_at ? new Date(bRow.updated_at).toLocaleString("en-IN") : ""]));
      });
      // Verified block-level awards whose block is not one of the district's blocks.
      Object.keys(f.blocks).forEach(function (bk) {
        if (placed.has(bk)) return;
        lines.push(base.concat(["Block", bk ? bk + " (not in block list)" : "(no block on the award)", m]).concat(COLUMNS.map(function (c) {
          return c.key === "blockTeachers" ? f.blocks[bk] : "";
        }), ["", ""]));
      });
    });
  });

  // Sheet 2: the table on screen.
  const sumHead = ["Month"].concat(COLUMNS.map(function (c) { return c.xl; }), ["Districts Reported"]);
  const tot = addUp(lastLines);
  const sumRows = lastLines.map(function (l) {
    return [l.month].concat(COLUMNS.map(function (c) { return n(l[c.key]); }), [l.future ? "" : l.reported + " / " + scope.length]);
  }).concat([[H("Total")].concat(COLUMNS.map(function (c) { return H(n(tot[c.key])); }), [H("")])]);

  const styles = '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF2F6FE4"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  try {
    const bytes = X.buildWorkbook([
      { name: "Event Details", rows: [head.map(H)].concat(lines), freeze: { rows: 1 },
        widths: [14, 22, 22, 20, 9, 24, 10, 12, 16, 12, 16, 10, 16, 10, 16, 14, 26, 20] },
      { name: "Month Summary", rows: [sumHead.map(H)].concat(sumRows), freeze: { rows: 1 },
        widths: [12, 12, 16, 12, 16, 10, 16, 10, 16, 14, 12] },
      { name: "Filters", rows: [[H("Filter"), H("Selected")]].concat(filterText(), [[], ["Districts", scope.map(function (d) { return d.name; }).join(", ")],
        ["Downloaded", new Date().toLocaleString("en-IN")]]), widths: [14, 100] }
    ], { styles: styles });
    X.download(bytes, "Event_Dashboard_Detailed_AY" + sel.ay + "_" + new Date().toISOString().slice(0, 10) + ".xlsx");
    toast("Excel downloaded — " + lines.length + " rows.");
  } catch (e) {
    console.error("Event dashboard Excel failed:", e);
    toast("Could not generate the Excel file.", "error");
  }
}

// ── entry points (award.js) ──
window.initAwardEvDashUI = function () {
  loaded = false; loading = false; events = []; felic = {}; districts = []; people = []; lastLines = [];
  sel = { state: "", dm: "", pm: "", district: "", ay: "" };
  const on = function (id, ev, fn) { const n = el(id); if (n) n.addEventListener(ev, fn); };
  on("aedState", "change", onFilter("state"));
  on("aedDm", "change", onFilter("dm"));
  on("aedPm", "change", onFilter("pm"));
  on("aedDistrict", "change", onFilter("district"));
  on("aedYear", "change", onFilter("ay"));
  on("aedExportBtn", "click", function (e) { e.stopPropagation(); downloadDetailed(); });
  start();
};
// Shown again: counts are edited in Utilisations, so data older than half a minute is read again.
window.aedShown = function () {
  if (loaded && !loading && Date.now() - loadedAt > 30000) start();
};
// The page-wide "Refresh data" button while this view is showing.
window.aedRefresh = function () { return start().then(function () { return true; }); };

})();
