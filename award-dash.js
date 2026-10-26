/* award-dash.js - the Award Data Dashboard of the Test tab.

   A copy of the one on the POM page, kept apart from pom.js so the two can be
   changed separately: everything lives inside this function, and its elements
   carry awd ids. It reads the award records from the database (the same ones
   Award Management in this tab edits) rather than from the Google Sheet. */
(function () {

const SB_URL = "https://rpnxpkwcpsbxswnowuhx.supabase.co";
const SB_KEY = "sb_publishable_60Ynb6EZ6Qc2GHrdqERwpw_dUdH3dKD";
const PAGE = 1000;                       // the most rows the database sends at once

// The filters, parent first: choosing a community narrows the rest.
const FILTERS = [
  { key: "community", label: "Community",      all: "All Communities", many: "Communities" },
  { key: "district",  label: "District",       all: "All Districts",   many: "Districts" },
  { key: "month",     label: "Month",          all: "All Months",      many: "Months" },
  { key: "category",  label: "Award Category", all: "All Categories",  many: "Categories" },
  { key: "award",     label: "Award Name",     all: "All Awards",      many: "Awards" }
];
const BLANK = { community: "(Not set)", category: "(None)", award: "(None)" };

const MONTHS = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };

let rows = [];                 // every award record, flattened
let loaded = false;
let loading = false;
let sel = {};                  // committed selection per filter (null = not chosen yet)
let lastRows = [];             // what the table shows now (for the Excel file)
let lastTotals = null;
let outsideClickBound = false;
let loadedAt = 0;                // when the data last came in

// ── helpers ──
function el(id) { return document.getElementById(id); }
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function toast(msg, kind) {
  const t = document.createElement("div");
  t.className = "awd-toast " + (kind || "success");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function () { t.classList.add("hide"); }, 2600);
  setTimeout(function () { t.remove(); }, 3000);
}

// Same rule as Award Management: the level belongs to the category, not to the
// award's name, and a life-skill award is a district-level one. Safe to run on a
// row that is already split.
function splitAward(name, category) {
  let award = String(name || "").trim();
  let cat = String(category || "").trim();
  if (cat.includes(" - ")) return { awardName: award, awardCategory: cat };
  if (cat === "LIFESKILL") return { awardName: award, awardCategory: "District Level - LIFESKILL" };
  const m = award.match(/[,\s-]*\b(Block|District|Cluster) Level\s*$/i);
  if (cat === "POM" && m) {
    const level = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
    award = award.slice(0, m.index).trim();
    cat = level + " Level - POM";
  }
  return { awardName: award, awardCategory: cat };
}

function monthKey(x) {
  const p = String(x || "").split("-");
  const mi = MONTHS[p[0]], yr = parseInt(p[1], 10);
  return (mi == null || isNaN(yr)) ? -1 : yr * 12 + mi;
}
// Labels that are not a month ("Pending 2025-26") come first; real months follow
// in calendar order.
function byMonth(a, b) {
  const ka = monthKey(a), kb = monthKey(b);
  if (ka === -1 && kb === -1) return String(a).localeCompare(String(b));
  return ka - kb;
}

// The last day of a month as "2026-05-31". Dates are compared as text: read as Date objects, a date is
// midnight UTC, which is already after local midnight in India, so a post awarded on the last day of
// its month would count as late.
function monthEnd(label) {
  const p = String(label).split("-");
  const mi = MONTHS[p[0]];
  if (mi == null || !p[1]) return "";
  return new Date(Date.UTC(Number(p[1]), mi + 1, 0)).toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "";
  value = String(value);
  if (value.includes("/")) {
    const p = value.split("/");
    if (p.length === 3) return p[2] + "-" + p[1].padStart(2, "0") + "-" + p[0].padStart(2, "0");
  }
  return value;
}

// Awarded after the end of its month.
function isLate(r) {
  if (!r.awarded) return false;
  const d = formatDate(r.awardedDate);
  if (!/^\d{4}-\d{2}-\d{2}/.test(d)) return false;
  const end = monthEnd(r.month);
  return end ? d.slice(0, 10) > end : false;
}

function counts(recs) {
  const total = recs.length;
  const late = recs.filter(isLate).length;
  const awarded = recs.filter(function (r) { return r.awarded && !isLate(r); }).length;
  const verified = recs.filter(function (r) { return r.verified; }).length;
  return { total: total, late: late, awarded: awarded, verified: verified,
           totalAwarded: awarded + late, pending: total - awarded - late };
}

function pct(num, den) { return den ? Math.round((num / den) * 100) + "%" : "0%"; }

// ── data ──
async function fetchAll() {
  const cols = "month_label,district_name,community,award_name,award_category,awarded,awarded_date,verified,rejected";
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    // "rejected" arrived after the table did; ask for it, and go without it where it is not there yet.
    let res = await fetch(SB_URL + "/rest/v1/award_records?select=" + cols + "&order=id.asc&limit=" + PAGE + "&offset=" + offset,
      { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } });
    if (!res.ok && offset === 0) {
      res = await fetch(SB_URL + "/rest/v1/award_records?select=" + cols.replace(",rejected", "") + "&order=id.asc&limit=" + PAGE + "&offset=" + offset,
        { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } });
    }
    if (!res.ok) throw new Error(await res.text());
    const page = await res.json();
    page.forEach(function (row) {
      const s = splitAward(row.award_name, row.award_category);
      out.push({
        month: row.month_label || "",
        district: row.district_name || "",
        community: row.community || BLANK.community,
        award: s.awardName || BLANK.award,
        category: s.awardCategory || BLANK.category,
        awarded: !!row.awarded,
        awardedDate: row.awarded_date || "",
        verified: !!row.verified && !row.rejected
      });
    });
    if (page.length < PAGE) break;
  }
  return out;
}

function start() {
  if (loaded || loading) return;
  loading = true;
  setLoadingUi(true);
  fetchAll().then(function (data) {
    rows = data;
    loaded = true;
    loadedAt = Date.now();
    loading = false;
    buildFilters();
    render();
    setRefreshing(false);
  }).catch(function (err) {
    console.error("Dashboard data load error:", err);
    loading = false;
    setRefreshing(false);
    setLoadingUi(false);
    const body = el("awdTableBody");
    if (body) body.innerHTML = '<tr><td colspan="12" class="dash-empty">Could not load the data. ' +
      '<button type="button" class="dash-retry" id="awdRetry">Try again</button></td></tr>';
    const retry = el("awdRetry");
    if (retry) retry.addEventListener("click", start);
  });
}

function refresh() {
  if (loading) return;
  setRefreshing(true);
  rows = [];
  loaded = false;
  start();                       // the filter selections stay as they were
}

function setRefreshing(on) {
  const btn = el("awdRefreshBtn");
  const txt = el("awdRefreshTxt");
  if (btn) { btn.disabled = on; btn.classList.toggle("spinning", on); }
  if (txt) txt.textContent = on ? "Refreshing…" : "Refresh Data";
}

function setLoadingUi(on) {
  FILTERS.forEach(function (f) {
    const t = el("awd-" + f.key + "-trigger");
    const l = el("awd-" + f.key + "-label");
    if (t) t.classList.toggle("loading", on);
    if (on && l) l.innerHTML = '<span class="dash-mini-spinner"></span>Loading…';
  });
  const body = el("awdTableBody");
  if (on && body) body.innerHTML = '<tr><td colspan="12" class="dash-empty">Loading data…</td></tr>';
}

// ── filters ──
function valueOf(r, key) { return r[key]; }

function inCommunity() {
  const c = new Set(sel.community || []);
  return function (r) { return c.size === 0 || c.has(r.community); };
}

// What a filter can offer: the values the chosen communities actually have.
function available(key) {
  const pass = key === "community" ? function () { return true; } : inCommunity();
  const set = Array.from(new Set(rows.filter(pass).map(function (r) { return valueOf(r, key); }).filter(Boolean)));
  return key === "month" ? set.sort(byMonth) : set.sort(function (a, b) { return String(a).localeCompare(String(b)); });
}

function buildBar() {
  const bar = el("awdFilterBar");
  if (!bar || bar.dataset.built) return;
  bar.dataset.built = "1";
  bar.innerHTML = FILTERS.map(function (f) {
    return '<div class="dash-filter-group">' +
      '<div class="dash-filter-label">' + f.label + '</div>' +
      '<div class="dash-dd-trigger" id="awd-' + f.key + '-trigger"><span id="awd-' + f.key + '-label">' + f.all + '</span><span class="dd-caret">▼</span></div>' +
      '<div class="dash-dd-panel" id="awd-' + f.key + '-panel">' +
        '<label class="dash-dd-all"><input type="checkbox" id="awd-' + f.key + '-all" checked> Select All</label>' +
        '<div class="dash-dd-items" id="awd-' + f.key + '-items"></div>' +
        '<div class="dash-dd-footer"><button type="button" class="dash-dd-apply" id="awd-' + f.key + '-apply">Apply</button></div>' +
      '</div></div>';
  }).join("") +
    '<button type="button" class="dash-export-btn" id="awdExportBtn" title="Download the current table as an Excel file">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
      '<span>Download Excel</span></button>' +
    '<button type="button" class="dash-refresh-btn" id="awdRefreshBtn" title="Reload the latest data from Award Management">' +
      '<span class="dash-refresh-ico">⟳</span><span id="awdRefreshTxt">Refresh Data</span></button>';

  FILTERS.forEach(function (f) {
    const trigger = el("awd-" + f.key + "-trigger");
    const panel = el("awd-" + f.key + "-panel");
    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      if (trigger.classList.contains("loading")) return;
      const open = panel.classList.contains("open");
      closePanels();
      if (!open) {
        setChecks(f, sel[f.key] || []);     // drop any draft left from the last time
        setLabel(f, sel[f.key] || []);
        panel.classList.add("open");
        trigger.classList.add("open");
      }
    });
    el("awd-" + f.key + "-apply").addEventListener("click", function (e) {
      e.stopPropagation();
      applyFilter(f);
    });
  });
  el("awdExportBtn").addEventListener("click", function (e) { e.stopPropagation(); downloadExcel(); });
  el("awdRefreshBtn").addEventListener("click", function (e) { e.stopPropagation(); refresh(); });
  if (!outsideClickBound) {
    outsideClickBound = true;
    document.addEventListener("click", closePanels);
  }
}

function closePanels(e) {
  // A click inside an open panel (ticking a box, scrolling) must not close it.
  if (e && e.target && e.target.closest && e.target.closest(".dash-dd-panel")) return;
  document.querySelectorAll(".awd-view .dash-dd-panel").forEach(function (p) { p.classList.remove("open"); });
  document.querySelectorAll(".awd-view .dash-dd-trigger").forEach(function (t) { t.classList.remove("open"); });
  if (loaded) FILTERS.forEach(function (f) { setLabel(f, sel[f.key] || []); });
}

function checked(f) {
  return Array.from(document.querySelectorAll("#awd-" + f.key + "-items .awd-cb:checked")).map(function (cb) { return cb.value; });
}

function setChecks(f, committed) {
  const set = new Set(committed);
  const all = document.querySelectorAll("#awd-" + f.key + "-items .awd-cb");
  all.forEach(function (cb) { cb.checked = set.has(cb.value); });
  syncAll(f);
}

function syncAll(f) {
  const all = document.querySelectorAll("#awd-" + f.key + "-items .awd-cb");
  const on = document.querySelectorAll("#awd-" + f.key + "-items .awd-cb:checked");
  const box = el("awd-" + f.key + "-all");
  if (!box) return;
  box.checked = all.length > 0 && all.length === on.length;
  box.indeterminate = on.length > 0 && on.length < all.length;
}

function setLabel(f, arr) {
  const total = document.querySelectorAll("#awd-" + f.key + "-items .awd-cb").length;
  const l = el("awd-" + f.key + "-label");
  if (!l) return;
  l.textContent = arr.length === 0 ? "None"
    : (total && arr.length === total) ? f.all
    : arr.length === 1 ? arr[0]
    : arr.length + " " + f.many;
}

// Ticking boxes only previews the label; nothing changes until Apply.
function buildList(f, items, committed) {
  const box = el("awd-" + f.key + "-items");
  const all = el("awd-" + f.key + "-all");
  if (!box || !all) return;
  const set = new Set(committed);
  box.innerHTML = items.map(function (item) {
    return '<label class="dash-dd-item"><input type="checkbox" class="awd-cb" value="' + esc(item) + '"' +
      (set.has(item) ? " checked" : "") + '> ' + esc(item) + '</label>';
  }).join("");
  syncAll(f);
  all.onchange = function () {
    box.querySelectorAll(".awd-cb").forEach(function (cb) { cb.checked = all.checked; });
    all.indeterminate = false;
    setLabel(f, checked(f));
  };
  box.querySelectorAll(".awd-cb").forEach(function (cb) {
    cb.onchange = function () { syncAll(f); setLabel(f, checked(f)); };
  });
}

// First build, and every refresh: keep what the person had chosen where it still exists.
function buildFilters() {
  buildBar();
  FILTERS.forEach(function (f) {
    const items = available(f.key);
    sel[f.key] = sel[f.key] == null ? items.slice() : sel[f.key].filter(function (v) { return items.indexOf(v) !== -1; });
  });
  FILTERS.forEach(function (f) {
    const items = available(f.key);
    buildList(f, items, sel[f.key]);
    const t = el("awd-" + f.key + "-trigger");
    if (t) t.classList.remove("loading");
    setLabel(f, sel[f.key]);
  });
}

// A new community choice changes what the others can offer: they start from everything again.
function rebuildChildren() {
  FILTERS.slice(1).forEach(function (f) {
    const items = available(f.key);
    sel[f.key] = items.slice();
    buildList(f, items, sel[f.key]);
    setLabel(f, sel[f.key]);
  });
}

function applyFilter(f) {
  sel[f.key] = checked(f);
  setLabel(f, sel[f.key]);
  if (f.key === "community") rebuildChildren();
  closePanels();
  render();
}

// ── table + chart ──
function render() {
  if (!loaded) return;
  const body = el("awdTableBody");
  if (!body) return;

  const pick = {};
  FILTERS.forEach(function (f) { pick[f.key] = new Set(sel[f.key] || []); });
  const shown = rows.filter(function (r) {
    return FILTERS.every(function (f) { return pick[f.key].size === 0 || pick[f.key].has(valueOf(r, f.key)); });
  });

  const months = Array.from(new Set(shown.map(function (r) { return r.month; }))).sort(byMonth);
  const lines = months.map(function (m) {
    const c = counts(shown.filter(function (r) { return r.month === m; }));
    c.month = m;
    return c;
  });
  const tot = lines.reduce(function (a, r) {
    a.total += r.total; a.awarded += r.awarded; a.late += r.late;
    a.pending += r.pending; a.totalAwarded += r.totalAwarded; a.verified += r.verified;
    return a;
  }, { total: 0, awarded: 0, late: 0, pending: 0, totalAwarded: 0, verified: 0 });

  lastRows = lines;
  lastTotals = tot;

  if (!lines.length) {
    body.innerHTML = '<tr><td colspan="12" class="dash-empty">No data matches the selected filters</td></tr>';
    drawPie(0, 0, 0);
    return;
  }

  const line = function (label, c, isTotal) {
    return '<tr><td class="' + (isTotal ? "" : "left") + '">' + esc(label) + '</td>' +
      '<td class="c-dark">' + c.total + '</td>' +
      '<td class="c-ok">' + c.awarded + '</td><td class="pct c-ok">' + pct(c.awarded, c.total) + '</td>' +
      '<td class="c-late">' + c.late + '</td><td class="pct c-late">' + pct(c.late, c.total) + '</td>' +
      '<td class="c-warn">' + c.pending + '</td><td class="pct c-warn">' + pct(c.pending, c.total) + '</td>' +
      '<td class="c-dark">' + c.totalAwarded + '</td><td class="pct">' + pct(c.totalAwarded, c.total) + '</td>' +
      '<td class="c-blue">' + c.verified + '</td><td class="pct c-blue">' + pct(c.verified, c.total) + '</td></tr>';
  };
  body.innerHTML = lines.map(function (c) { return line(c.month, c, false); }).join("") + line("Total", tot, true);
  drawPie(tot.awarded, tot.late, tot.pending);
}

function drawPie(inTime, late, pending) {
  const canvas = el("awdPieCanvas");
  const legend = el("awdLegend");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 8;
  ctx.clearRect(0, 0, W, H);

  const total = inTime + late + pending;
  const COLORS = ["#16a34a", "#dc2626", "#d97706"];
  const LABELS = ["Awarded In Time", "Awarded Late", "Pending"];
  const values = [inTime, late, pending];

  if (!total) {
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = "#f3f4f6"; ctx.fill();
    if (legend) legend.innerHTML = '<div style="font-size:12px;color:#9ca3af;text-align:center;">No data</div>';
    return;
  }

  let angle = -Math.PI / 2;
  values.forEach(function (val, i) {
    if (!val) return;
    const slice = (val / total) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, angle, angle + slice); ctx.closePath();
    ctx.fillStyle = COLORS[i]; ctx.fill();
    angle += slice;
  });

  ctx.beginPath(); ctx.arc(cx, cy, R * 0.48, 0, Math.PI * 2);
  ctx.fillStyle = "#fff"; ctx.fill();
  const face = getComputedStyle(canvas).fontFamily || "sans-serif";
  ctx.fillStyle = "#1a1d23"; ctx.font = "bold 18px " + face;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(total, cx, cy - 7);
  ctx.fillStyle = "#9ca3af"; ctx.font = "11px " + face;
  ctx.fillText("Total", cx, cy + 12);

  if (legend) {
    legend.innerHTML = values.map(function (val, i) {
      return '<div class="dash-legend-item"><span class="dash-legend-dot" style="background:' + COLORS[i] + '"></span>' +
        '<span>' + LABELS[i] + '</span><span class="dash-legend-val">' + val +
        ' <span class="dash-legend-pct">(' + pct(val, total) + ')</span></span></div>';
    }).join("");
  }
}

// ── Excel file of what the table shows ──
function filterSummary() {
  return "Filters applied —  " + FILTERS.map(function (f) {
    const arr = sel[f.key] || [];
    const total = document.querySelectorAll("#awd-" + f.key + "-items .awd-cb").length;
    const val = arr.length === 0 ? "None" : (total && arr.length === total) ? f.all : arr.join(", ");
    return f.label + ": " + val;
  }).join("    |    ");
}

function downloadExcel() {
  if (!loaded) { toast("The data is still loading.", "info"); return; }
  if (!lastRows.length) { toast("No data to export for the current filters.", "info"); return; }
  const tot = lastTotals;
  const header = ["Month", "Total Awards", "Awarded In Time", "In Time %", "Awarded Late",
    "Late %", "Pending", "Pending %", "Total Awarded", "Awarded %", "Verified", "Verified %"];
  const rowFor = function (label, c) {
    return [label, c.total, c.awarded, pct(c.awarded, c.total), c.late, pct(c.late, c.total),
      c.pending, pct(c.pending, c.total), c.totalAwarded, pct(c.totalAwarded, c.total),
      c.verified, pct(c.verified, c.total)];
  };
  const aoa = [[filterSummary()], [], header]
    .concat(lastRows.map(function (r) { return rowFor(r.month, r); }), [rowFor("Total", tot)]);
  try {
    downloadXlsx(buildXlsx(aoa, "Award Data"), "Award_Data_" + new Date().toISOString().slice(0, 10) + ".xlsx");
    toast("Excel downloaded.");
  } catch (e) {
    console.error("Excel export failed:", e);
    toast("Could not generate the Excel file.", "error");
  }
}

// A small .xlsx writer with no library: an OOXML workbook packed into a stored ZIP.
function xmlEsc(s) { return esc(s); }
function colLetter(n) {
  let s = ""; n++;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function sheetXml(aoa, opts) {
  opts = opts || {};
  let body = "";
  aoa.forEach(function (row, r) {
    const cells = (row || []).map(function (val, c) {
      if (val === null || val === undefined || val === "") return "";
      const ref = colLetter(c) + (r + 1);
      // A cell can carry a style (s) and a formula (f): { s: 3, v: "Month" } or { f: "IF(B2<>\"\",1,0)" }.
      if (typeof val === "object") {
        const sa = val.s != null ? ' s="' + val.s + '"' : "";
        if (val.f) return '<c r="' + ref + '"' + sa + '><f>' + xmlEsc(val.f) + "</f></c>";
        if (typeof val.v === "number") return '<c r="' + ref + '"' + sa + '><v>' + val.v + "</v></c>";
        return '<c r="' + ref + '"' + sa + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(val.v == null ? "" : val.v) + "</t></is></c>";
      }
      if (typeof val === "number" && isFinite(val)) return '<c r="' + ref + '"><v>' + val + '</v></c>';
      return '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(val) + '</t></is></c>';
    }).join("");
    body += '<row r="' + (r + 1) + '">' + cells + '</row>';
  });
  // Column widths, and the style that empty cells of a column take (a style can unlock them).
  const colDefs = opts.cols || (opts.widths || []).map(function (w) { return { width: w }; });
  const cols = colDefs.length
    ? '<cols>' + colDefs.map(function (d, i) {
        return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + d.width + '" customWidth="1"' +
          (d.style != null ? ' style="' + d.style + '"' : "") + "/>";
      }).join("") + '</cols>'
    : "";
  const protection = opts.protect
    ? '<sheetProtection sheet="1" objects="1" scenarios="1" formatColumns="0" formatRows="0"/>' : "";
  const checks = (opts.validations || []).length
    ? '<dataValidations count="' + opts.validations.length + '">' + opts.validations.map(function (v) {
        return '<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Not in the list" ' +
          'error="' + xmlEsc(v.message || "Choose a value from the list.") + '" sqref="' + v.sqref + '">' +
          '<formula1>' + xmlEsc(v.formula) + '</formula1></dataValidation>';
      }).join("") + '</dataValidations>'
    : "";
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + cols +
    '<sheetData>' + body + '</sheetData>' + protection + checks + '</worksheet>';
}

// A workbook of several sheets: [{ name, rows, widths, validations: [{ sqref, formula, message }] }].
// A validation is a dropdown that only accepts what the list holds, for example
// { sqref: "F2:F5000", formula: "Lists!$A$2:$A$6" }.
function buildWorkbook(sheets, options) {
  options = options || {};
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const types = sheets.map(function (s, i) {
    return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
  }).join("");
  const names = sheets.map(function (s, i) {
    return '<sheet name="' + xmlEsc(String(s.name).slice(0, 31)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
  }).join("");
  const rels = sheets.map(function (s, i) {
    return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
  }).join("");
  const files = [
    ["[Content_Types].xml", head + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' + types +
      (options.styles ? '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' : "") + '</Types>'],
    ["_rels/.rels", head + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ["xl/workbook.xml", head + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + names + '</sheets><calcPr fullCalcOnLoad="1"/></workbook>'],
    ["xl/_rels/workbook.xml.rels", head + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels +
      (options.styles ? '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' : "") + '</Relationships>']
  ];
  if (options.styles) files.push(["xl/styles.xml", head + options.styles]);
  sheets.forEach(function (s, i) {
    files.push(["xl/worksheets/sheet" + (i + 1) + ".xml", sheetXml(s.rows, { widths: s.widths, cols: s.cols, protect: s.protect, validations: s.validations })]);
  });
  return zipStore(files);
}

function buildXlsx(aoa, sheetName) {
  const name = xmlEsc((sheetName || "Sheet1").slice(0, 31));
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  return zipStore([
    ["[Content_Types].xml", head + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
    ["_rels/.rels", head + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ["xl/workbook.xml", head + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + name + '" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ["xl/_rels/workbook.xml.rels", head + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
    ["xl/worksheets/sheet1.xml", sheetXml(aoa)]
  ]);
}
function downloadXlsx(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}
// The Event Management view of this tab writes its report the same way.
window.awardXlsx = { build: buildXlsx, buildWorkbook: buildWorkbook, download: downloadXlsx };

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function zipStore(files) {
  const enc = new TextEncoder();
  const u16 = function (n) { return [n & 255, (n >> 8) & 255]; };
  const u32 = function (n) { return [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]; };
  const parts = [], central = [];
  let offset = 0;
  files.forEach(function (f) {
    const nameB = enc.encode(f[0]), dataB = enc.encode(f[1]);
    const crc = crc32(dataB), size = dataB.length;
    const local = new Uint8Array([].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size), u16(nameB.length), u16(0)));
    parts.push(local, nameB, dataB);
    central.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size), u16(nameB.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))), nameB);
    offset += local.length + nameB.length + dataB.length;
  });
  let cdSize = 0; central.forEach(function (c) { cdSize += c.length; });
  const eocd = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(cdSize), u32(offset), u16(0)));
  const all = parts.concat(central, [eocd]);
  let total = 0; all.forEach(function (a) { total += a.length; });
  const out = new Uint8Array(total);
  let p = 0; all.forEach(function (a) { out.set(a, p); p += a.length; });
  return out;
}

// The Test tab calls this the first time Award Data Dashboard is opened, and
// again after the page was left and come back to.
// Called each time the dashboard is shown again: records are edited, added and deleted elsewhere in this
// tab, so data older than half a minute is read again instead of being shown stale.
window.awardDashShown = function () {
  if (loaded && !loading && Date.now() - loadedAt > 30000) refresh();
};

window.initAwardDashUI = function () {
  rows = []; loaded = false; loading = false;
  const bar = el("awdFilterBar");
  if (bar) { delete bar.dataset.built; }
  buildBar();
  start();
};

})();
