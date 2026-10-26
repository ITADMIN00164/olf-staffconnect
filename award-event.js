/* award-event.js - the Event Management view of the Test tab.

   A copy of the one on the POM page, kept apart from pom.js so the two can be
   changed separately: everything lives inside this function, the handlers its
   markup calls are prefixed awe, and its elements carry awe ids. The counts are
   kept in the database (public.award_events), one row per month, district and
   block, not in the Google Sheet.

   Two levels of entry
     Block level    (a block picked)       -> Total Block Events and Teachers
                    Felicitated (Block Level). Only these two.
     District level ("All blocks" picked)  -> Total District Events, Teachers
                    Felicitated (District Level), SU/NS Events, Teachers
                    Felicitated (SU/NS Events), Other Events, Teachers
                    Felicitated (Other Events) and Cluster Heads are editable,
                    while the two block-level columns show the sum of the
                    district's block rows, read-only.
   A block's figures are only ever written to its block row, and the district's
   to the district row (an empty block), so the two can never overwrite each other.

   Saving: a row is marked Saved only after the database has sent the row back
   and every value matches what was sent. Anything else leaves the row unsaved,
   with the typed numbers still in the boxes, and says so. */
(function () {

const SB_URL = "https://rpnxpkwcpsbxswnowuhx.supabase.co";
const SB_KEY = "sb_publishable_60Ynb6EZ6Qc2GHrdqERwpw_dUdH3dKD";

const SAVE_SVG  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
const CHECK_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

// The database column behind each count.
const DB_COLUMN = {
  blockEvents: "block_events", districtEvents: "district_events",
  blockTeachers: "block_teachers", districtTeachers: "district_teachers",
  suNsEvents: "su_ns_events", suNsTeachers: "su_ns_teachers",
  otherEvents: "other_events", otherTeachers: "other_teachers",
  clusterHeads: "cluster_heads"
};

function currentUser() {
  const u = window.__olfUser;
  return (u && (u.email || u.name)) || "";
}

function nameFromEmail(emailOrName) {
  if (!emailOrName) return "";
  if (!emailOrName.includes("@")) return emailOrName;
  const local = emailOrName.split("@")[0];
  return local.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function el(id) { return document.getElementById(id); }
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Notices, the wait overlay and the question box (this view's own) ──
function showToast(msg, kind) {
  const host = el("aweToasts");
  if (!host) return;
  const t = document.createElement("div");
  t.className = "pom-toast " + (kind || "success");
  t.textContent = msg;
  host.appendChild(t);
  setTimeout(function () { t.classList.add("hide"); }, 3200);
  setTimeout(function () { t.remove(); }, 3600);
}
function showLoader() { const l = el("aweLoader"); if (l) l.classList.add("open"); }
function hideLoader() { const l = el("aweLoader"); if (l) l.classList.remove("open"); }

// Resolves with the value of the button pressed.
function showModal(opts) {
  return new Promise(function (resolve) {
    const modal = el("aweModal");
    if (!modal) { resolve("cancel"); return; }
    el("aweModalTitle").textContent = opts.title || "";
    el("aweModalMsg").textContent = opts.message || "";
    const actions = el("aweModalActions");
    actions.innerHTML = "";
    opts.buttons.forEach(function (b) {
      const btn = document.createElement("button");
      btn.className = "pmbtn " + (b.variant || "cancel");
      btn.textContent = b.label;
      btn.addEventListener("click", function () { modal.classList.remove("open"); resolve(b.value); });
      actions.appendChild(btn);
    });
    modal.classList.add("open");
  });
}

// ── Database ──
function sbHeaders(extra) {
  return Object.assign({ apikey: SB_KEY, Authorization: "Bearer " + SB_KEY }, extra || {});
}
async function sbGet(path) {
  const res = await fetch(SB_URL + "/rest/v1/" + path, { headers: sbHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function pad(n) { return String(n).padStart(2, "0"); }
function stamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " +
    pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
}

// A database row, in the shape the rest of this file was written for.
function fromDb(row) {
  const out = {
    month: row.month_label || "",
    districtName: row.district_name || "",
    block: row.block || "",
    updatedBy: row.updated_by || "",
    updatedAt: stamp(row.updated_at)
  };
  Object.keys(DB_COLUMN).forEach(function (k) {
    const v = row[DB_COLUMN[k]];
    out[k] = v === null || v === undefined ? "" : String(v);
  });
  return out;
}

// ── State ──
let aweEvents        = [];      // every saved row
let aweEventsLoaded  = false;
let aweEventsLoading = false;
let aweDistrict      = "";      // district currently open
let aweBlock         = "";      // block currently open; "" = district level
let aweYear          = "";      // academic year currently open
let aweRows          = [];      // rows on screen
let aweSaving        = false;   // a save is in flight
let aweDistricts     = [];      // district list backing the dropdown
let aweDistrictsState = "loading";   // "loading" | "ready" | "failed"
let aweBlocks        = {};      // district -> its blocks, in order
let aweStates        = {};      // district -> its state

// ── Columns ──
// scope "block"    -> editable in block view, computed + read-only in district view
// scope "district" -> district view only
const OTHER_MSG = "Events other than POM, NS and SU.";

const COLUMNS = [
  { key: "blockEvents",      head: "Total<br>Block Events",                    scope: "block"    },
  { key: "districtEvents",   head: "Total<br>District Events",                 scope: "district" },
  { key: "blockTeachers",    head: "Teachers Felicitated<br>(Block Level)",    scope: "block"    },
  { key: "districtTeachers", head: "Teachers Felicitated<br>(District Level)", scope: "district" },
  { key: "suNsEvents",       head: "SU/NS<br>Events",                          scope: "district" },
  { key: "suNsTeachers",     head: "Teachers Felicitated<br>(SU/NS Events)",   scope: "district" },
  { key: "otherEvents",      head: "Other<br>Events",                          scope: "district", tip: OTHER_MSG },
  { key: "otherTeachers",    head: "Teachers Felicitated<br>(Other Events)",   scope: "district", tip: OTHER_MSG },
  { key: "clusterHeads",     head: "Total Cluster<br>Heads Recognised",        scope: "district" }
];

const ROLLUP_MSG = "Select any block and fill these numbers — they are reconciled here automatically.";

function isBlockView() { return !!aweBlock; }

function visibleColumns() {
  return isBlockView() ? COLUMNS.filter(c => c.scope === "block") : COLUMNS.slice();
}

// The columns the person can type into, and so the only ones this view may send.
function editableColumns() {
  return isBlockView() ? COLUMNS.filter(c => c.scope === "block") : COLUMNS.filter(c => c.scope === "district");
}

// ── Academic years ──
// A year runs June -> May, so AY 2026-27 is Jun-2026 ... May-2027. The rows are
// made from this, never from the award data, so a district can log events in a
// month that has no awards. The years offered run from the earliest saved one (or
// this year) to next year, and this year is the one that opens.
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const AY_START_MONTH = 6;              // June (1-based)

function ayLabel(startYear) { return startYear + "-" + String((startYear + 1) % 100).padStart(2, "0"); }

// The academic year a date falls in, as its first calendar year.
function ayStartOf(date) {
  return date.getMonth() + 1 >= AY_START_MONTH ? date.getFullYear() : date.getFullYear() - 1;
}

function defaultYear() { return ayLabel(ayStartOf(new Date())); }

// The academic year a "Jun-2026" style month is in, or null when it is not a month.
function ayStartOfMonth(label) {
  const parts = String(label || "").split("-");
  const mi = MONTH_NAMES.indexOf(String(parts[0] || "").slice(0, 3));
  const yr = parseInt(parts[1], 10);
  if (mi < 0 || isNaN(yr)) return null;
  return mi + 1 >= AY_START_MONTH ? yr : yr - 1;
}

function yearOptions() {
  const now = ayStartOf(new Date());
  const saved = aweEvents.map(r => ayStartOfMonth(r.month)).filter(y => y !== null);
  const first = Math.min.apply(null, saved.concat([now]));
  const out = [];
  for (let y = first; y <= now+1; y++) out.push(ayLabel(y));
  return out;
}

function monthsForYear(year) {
  const startYear = parseInt(String(year).split("-")[0], 10);
  if (isNaN(startYear)) return [];
  const out = [];
  for (let i = 0; i < 12; i++) {
    const mi = (AY_START_MONTH - 1 + i) % 12;
    const yr = startYear + (AY_START_MONTH - 1 + i >= 12 ? 1 : 0);
    out.push(MONTH_NAMES[mi] + "-" + yr);
  }
  return out;
}
function currentMonths() { return monthsForYear(aweYear || defaultYear()); }

// ── Districts ──
// The districts Award Management lists: the ones that have award records.
async function loadDistricts() {
  try {
    const rows = await sbGet("award_month_summary?select=district_name");
    aweDistricts = Array.from(new Set(rows.map(r => String(r.district_name || "").trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));
    aweDistrictsState = "ready";
  } catch (e) {
    console.error("District list failed:", e);
    if (!aweDistricts.length) aweDistrictsState = "failed";
  }
  renderDistrictOptions();
  renderNotes();
}

// The blocks of every district, and each district's state, from public.award_blocks.
async function loadBlocks() {
  try {
    const rows = await sbGet("award_blocks?select=state,district_name,block&order=sort_order.asc,id.asc&limit=10000");
    const blocks = {}, states = {};
    rows.forEach(r => {
      (blocks[r.district_name] = blocks[r.district_name] || []).push(r.block);
      if (r.state) states[r.district_name] = r.state;
    });
    aweBlocks = blocks;
    aweStates = states;
  } catch (e) {
    console.error("Block list failed:", e);
  }
  renderBlockOptions();
  renderNotes();
}

// ── Default block ──
// District-level figures are stored without a block, because that is what they
// are. The Excel report still needs a Block for every row, so they are put on the
// district's default block: the one whose NAME sorts first, ignoring the numeric
// code ("272601-AKOLE" sorts as "AKOLE"). Nothing about this is stored.
function blockName(block) { return String(block || "").replace(/^\s*\d+\s*-\s*/, "").trim().toUpperCase(); }

function defaultBlock(district) {
  const blocks = blocksFor(district);
  if (!blocks.length) return "";
  return blocks.slice().sort((a, b) => {
    const na = blockName(a), nb = blockName(b);
    if (na !== nb) return na < nb ? -1 : 1;
    return String(a).localeCompare(String(b));
  })[0];
}

// The block lists were typed apart from the district names, so one district can be
// spelled a little differently in each. Match the exact name first, then the same
// name ignoring capitals, spaces and punctuation.
function nameKey(name) { return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }

function lookup(map, district) {
  if (Object.prototype.hasOwnProperty.call(map, district)) return map[district];
  const want = nameKey(district);
  if (!want) return undefined;
  const hit = Object.keys(map).find(k => nameKey(k) === want);
  return hit === undefined ? undefined : map[hit];
}

function blocksFor(district) {
  const list = lookup(aweBlocks, district);
  return Array.isArray(list) ? list : [];
}

// ── Values ──
function str(v) { return v === undefined || v === null ? "" : String(v).trim(); }

// Whole numbers only, zero allowed. Blank means "not entered yet", which is not 0.
function valid(v) { const s = str(v); return s === "" || /^\d+$/.test(s); }

// Sent against echoed back: numeric, so "05", "5" and 5 agree; blank stays blank.
function sameValue(sent, echoed) {
  const a = str(sent), b = str(echoed);
  if (a === "" || b === "") return a === b;
  const na = Number(a), nb = Number(b);
  if (!isNaN(na) && !isNaN(nb)) return na === nb;
  return a === b;
}

function rowKey(month, district, block) { return [str(month), str(district), str(block)].join("¦"); }

function savedRow(month, district, block) {
  const want = rowKey(month, district, block);
  return aweEvents.find(r => rowKey(r.month, r.districtName, r.block) === want) || null;
}

// The sum of a block-level field across every block row of a district and month.
// A month with nothing entered gives no contributors, so it can show a dash, not 0.
function blockRollup(month, district, key) {
  let sum = 0, contributors = 0;
  aweEvents.forEach(r => {
    if (str(r.districtName) !== str(district)) return;
    if (str(r.month) !== str(month)) return;
    if (str(r.block) === "") return;                 // skip the district row
    const v = str(r[key]);
    if (v === "" || !/^\d+$/.test(v)) return;
    sum += Number(v);
    contributors++;
  });
  return { sum: sum, contributors: contributors };
}

// ── Rows on screen ──
function buildRows() {
  const months = currentMonths();
  const editable = editableColumns();

  aweRows = months.map(m => {
    const saved = savedRow(m, aweDistrict, aweBlock);
    const row = {
      month: m,
      districtName: aweDistrict,
      block: aweBlock,
      updatedBy: saved ? str(saved.updatedBy) : "",
      updatedAt: saved ? str(saved.updatedAt) : "",
      _dirty: false,
      _failed: false
    };
    editable.forEach(c => { row[c.key] = saved ? str(saved[c.key]) : ""; });
    row._existed = editable.some(c => str(row[c.key]) !== "");
    return row;
  });

  render();
  renderNotes();
}

// ── Notes ──
// Anything saved that this view cannot show is said here, not left to vanish.
function renderNotes() {
  const box = el("aweNote");
  if (!box) return;
  const notes = [];

  // Saved data under a district that is not in the list (any more).
  if (aweEventsLoaded && aweDistrictsState === "ready") {
    const known = new Set(aweDistricts);
    const orphan = Array.from(new Set(aweEvents.map(r => str(r.districtName)).filter(d => d && !known.has(d))));
    if (orphan.length) {
      notes.push("Saved event data exists for " + orphan.join(", ") + ", which " +
        (orphan.length === 1 ? "is" : "are") + " not in the district list. That data is untouched " +
        "in the database and is included in the Excel download.");
    }
  }

  if (!aweDistrict) {
    box.innerHTML = notes.map(n => "<div>" + esc(n) + "</div>").join("");
    box.style.display = notes.length ? "block" : "none";
    return;
  }

  const shown = new Set(currentMonths());

  // Saved months outside the selected academic year.
  const stray = Array.from(new Set(aweEvents
    .filter(r => str(r.districtName) === aweDistrict && str(r.block) === aweBlock)
    .map(r => str(r.month))
    .filter(m => m && !shown.has(m))));
  if (stray.length) {
    notes.push(aweDistrict + (aweBlock ? " / " + aweBlock : "") + " also has saved data for " +
      stray.join(", ") + ", outside AY " + aweYear + ". That data is untouched.");
  }

  // Block-level figures on a district row, from before blocks existed.
  if (!isBlockView()) {
    const legacy = aweEvents
      .filter(r => str(r.districtName) === aweDistrict && str(r.block) === "" &&
        (str(r.blockEvents) !== "" || str(r.blockTeachers) !== ""))
      .map(r => str(r.month))
      .filter(m => shown.has(m));
    if (legacy.length) {
      notes.push(legacy.join(", ") + (legacy.length === 1 ? " has" : " have") + " older block-level " +
        "figures recorded against the district itself, from before blocks were introduced. They " +
        "remain saved and are not counted in the block totals above — re-enter them under the " +
        "relevant block when convenient.");
    }
  }

  // A district with no blocks mapped can only be used at district level.
  if (Object.keys(aweBlocks).length && !blocksFor(aweDistrict).length) {
    notes.push("No blocks are mapped for " + aweDistrict + ", so only district-level counts can be entered.");
  }

  if (!notes.length) { box.style.display = "none"; box.innerHTML = ""; return; }
  box.innerHTML = notes.map(n => "<div>" + esc(n) + "</div>").join("");
  box.style.display = "block";
}

// ── Rendering ──
function colCount() { return visibleColumns().length + 3; }   // month + counts + save + updated

function message(msg, isError) {
  renderHead();
  const tbody = el("aweTableBody");
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="' + colCount() + '" class="pom-msg' + (isError ? " error" : "") + '">' + esc(msg) + "</td></tr>";
  }
  const bar = el("aweSaveBar");
  if (bar) bar.style.display = "none";
}

function renderHead() {
  const thead = el("aweThead");
  if (!thead) return;
  const cols = visibleColumns();
  const cells = cols.map(c => {
    const rollup = !isBlockView() && c.scope === "block";
    const tip = rollup ? ROLLUP_MSG : (c.tip || "");
    const cls = [rollup ? "pev-rollup-th" : "", c.tip ? "pev-tip-th" : ""].filter(Boolean).join(" ");
    return "<th" + (cls ? ' class="' + cls + '"' : "") + (tip ? ' title="' + esc(tip) + '"' : "") + ">" + c.head + "</th>";
  }).join("");

  // Widths: month, one per count, save, last updated. They add up to 100% so the
  // table always fits its card; the headings wrap to the width they are given.
  const MONTH_W = 8, SAVE_W = 7, UPDATED_W = 9;
  const each = ((100 - MONTH_W - SAVE_W - UPDATED_W) / Math.max(cols.length, 1)).toFixed(2);
  const group = '<col style="width:' + MONTH_W + '%">' + cols.map(() => '<col style="width:' + each + '%">').join("") +
    '<col style="width:' + SAVE_W + '%"><col style="width:' + UPDATED_W + '%">';

  thead.innerHTML = '<tr><th>Month</th>' + cells + '<th class="col-center">Save</th><th>Last Updated</th></tr>';
  const cg = el("aweColgroup");
  if (cg) cg.innerHTML = group;
}

function rowSaveCell(i) {
  const r = aweRows[i];
  if (!r) return "";
  if (r._failed) {
    return '<button class="rowsave-btn danger" title="The last attempt did not save. Your numbers are still here — click to try again." onclick="aweSaveRow(' + i + ')">' + SAVE_SVG + "Retry</button>";
  }
  if (r._dirty) {
    return '<button class="rowsave-btn ready" title="Save this month" onclick="aweSaveRow(' + i + ')">' + SAVE_SVG + "Save</button>";
  }
  if (r._existed) {
    return '<span class="rowsave-saved" title="Confirmed saved in the database">' + CHECK_SVG + " Saved</span>";
  }
  return "";
}

function refreshRowControls(i) {
  const cell = el("awesave-" + i);
  if (cell) cell.innerHTML = rowSaveCell(i);
}

// One column's total: a roll-up in the district view's block columns, otherwise what is typed.
function columnTotal(c) {
  let sum = 0, any = false;
  if (!isBlockView() && c.scope === "block") {
    aweRows.forEach(r => {
      const roll = blockRollup(r.month, aweDistrict, c.key);
      if (roll.contributors) { sum += roll.sum; any = true; }
    });
  } else {
    aweRows.forEach(r => {
      const v = str(r[c.key]);
      if (v !== "" && /^\d+$/.test(v)) { sum += Number(v); any = true; }
    });
  }
  return any ? sum : "—";
}

function render() {
  const tbody = el("aweTableBody");
  if (!tbody) return;

  if (!aweDistrict) { message("Select a District to begin"); return; }
  if (!aweRows.length) { message("No data found for this district."); return; }

  renderHead();
  const cols = visibleColumns();
  const blockView = isBlockView();

  tbody.innerHTML = aweRows.map((r, i) => {
    const cells = cols.map(c => {
      // District view: the block-level columns are a read-only roll-up.
      if (!blockView && c.scope === "block") {
        const roll = blockRollup(r.month, aweDistrict, c.key);
        const text = roll.contributors ? roll.sum : "—";
        return '<td class="pev-rollup" title="' + esc(ROLLUP_MSG) + '"><span class="pev-rollup-val">' + text + "</span></td>";
      }
      const val = str(r[c.key]);
      const bad = !valid(val);
      return "<td" + (c.tip ? ' title="' + esc(c.tip) + '"' : "") + '><input type="number" min="0" step="1" inputmode="numeric" ' +
        'class="pev-input' + (bad ? " bad" : "") + '" data-row="' + i + '" data-key="' + c.key + '" ' +
        'value="' + esc(val) + '" placeholder="—" oninput="aweUpdateField(' + i + ",'" + c.key + "',this.value)\"></td>";
    }).join("");

    const who = r.updatedBy ? nameFromEmail(r.updatedBy) : "";
    return "<tr><td class=\"pev-month\">" + esc(r.month) + "</td>" + cells +
      '<td class="col-center" id="awesave-' + i + '">' + rowSaveCell(i) + "</td>" +
      '<td class="pev-updated">' + (who ? '<span class="pev-who" title="' + esc(r.updatedBy) + '">' + esc(who) + "</span>" : "") +
      (r.updatedAt ? '<span class="pev-when">' + esc(r.updatedAt) + "</span>" : "") + "</td></tr>";
  }).join("");

  tbody.innerHTML += '<tr class="pev-totals"><td>Total</td>' +
    cols.map(c => "<td>" + columnTotal(c) + "</td>").join("") + "<td></td><td></td></tr>";

  updateSaveBar();
}

function hasUnsaved() { return (aweRows || []).some(r => r._dirty || r._failed); }

function updateSaveBar() {
  const bar = el("aweSaveBar");
  if (bar) bar.style.display = hasUnsaved() ? "block" : "none";
}

window.aweUpdateField = function (index, key, value) {
  const r = aweRows[index];
  if (!r) return;
  r[key] = str(value);
  r._dirty = true;
  r._failed = false;              // a new edit clears the last failure
  refreshRowControls(index);
  updateSaveBar();
  updateTotalsOnly();
};

// Only the totals row is redrawn, so typing never rebuilds the table under the cursor.
function updateTotalsOnly() {
  const row = document.querySelector("#aw-view-event .pev-totals");
  if (!row) return;
  visibleColumns().forEach((c, ci) => {
    const cell = row.children[ci + 1];
    if (cell) cell.textContent = columnTotal(c);
  });
}

// ── Loading ──
async function loadEvents() {
  aweEventsLoading = true;
  try {
    const rows = await sbGet("award_events?select=*&order=id.asc&limit=10000");
    aweEvents = rows.map(fromDb);
    aweEventsLoaded = true;
    populateYears();
    renderNotes();
    if (aweDistrict) buildRows();
    return true;
  } catch (e) {
    console.error("Event data load failed:", e);
    aweEvents = [];
    aweEventsLoaded = false;
    message("Couldn't load saved event data. Use Refresh to try again.", true);
    return false;
  } finally {
    aweEventsLoading = false;
  }
}

// ── Dropdowns ──
function renderDistrictOptions() {
  const dd = el("aweDistrict");
  if (!dd) return;
  if (!aweDistricts.length) {
    const msg = aweDistrictsState === "failed" ? "Couldn't load districts — click Refresh"
      : aweDistrictsState === "ready" ? "No districts yet"
      : "⏳ Loading districts…";
    dd.innerHTML = '<option value="">' + msg + "</option>";
    dd.disabled = true;
    return;
  }
  const keep = aweDistrict;
  dd.innerHTML = '<option value="">Select District</option>' +
    aweDistricts.map(d => '<option value="' + esc(d) + '">' + esc(d) + "</option>").join("");
  dd.disabled = false;
  if (keep && aweDistricts.indexOf(keep) >= 0) dd.value = keep;
}

// Blocks stay locked until a district is chosen, and always start on "All blocks".
function renderBlockOptions() {
  const dd = el("aweBlock");
  if (!dd) return;

  if (!aweDistrict) {
    dd.innerHTML = '<option value="">Select a district first</option>';
    dd.disabled = true;
    dd.value = "";
    return;
  }

  const blocks = blocksFor(aweDistrict);
  dd.innerHTML = '<option value="">All blocks (district level)</option>' +
    blocks.map(b => '<option value="' + esc(b) + '">' + esc(b) + "</option>").join("");
  dd.disabled = false;
  dd.value = blocks.indexOf(aweBlock) >= 0 ? aweBlock : "";
  if (dd.value === "") aweBlock = "";
}

function populateYears() {
  const dd = el("aweYear");
  if (!dd) return;
  if (!aweYear) aweYear = defaultYear();
  const years = yearOptions();
  if (years.indexOf(aweYear) < 0) years.push(aweYear);
  dd.innerHTML = years.map(y => '<option value="' + y + '">AY ' + y + "</option>").join("");
  dd.value = aweYear;
}

// ── The check shared by every selector change ──
async function confirmDiscard(what) {
  return showModal({
    title: "Unsaved event data",
    message: "You have counts that haven't been saved yet. They'll be lost if you change the " + what + " now.",
    buttons: [
      { label: "Cancel", value: "cancel", variant: "cancel" },
      { label: "Discard & Switch", value: "go", variant: "danger" }
    ]
  });
}

async function onDistrictChange() {
  const dd = el("aweDistrict");
  const district = dd ? dd.value : "";

  if (hasUnsaved() && (await confirmDiscard("district")) !== "go") {
    if (dd) dd.value = aweDistrict;
    return;
  }

  aweDistrict = district;
  aweBlock = "";                       // always back to district level
  aweRows = [];
  renderBlockOptions();

  if (!district) { message("Select a District to begin"); renderNotes(); return; }

  buildRows();                         // the months are local, so draw at once
  if (!aweEventsLoaded && !aweEventsLoading) {
    await loadEvents();
    if (aweDistrict !== district) return;
    buildRows();
  }
}

async function onBlockChange() {
  const dd = el("aweBlock");
  const block = dd ? dd.value : "";

  if (hasUnsaved() && (await confirmDiscard("block")) !== "go") {
    if (dd) dd.value = aweBlock;
    return;
  }

  aweBlock = block;
  aweRows = [];
  if (!aweDistrict) { message("Select a District to begin"); return; }
  buildRows();
}

async function onYearChange() {
  const dd = el("aweYear");
  const year = dd ? dd.value : defaultYear();

  if (hasUnsaved() && (await confirmDiscard("academic year")) !== "go") {
    if (dd) dd.value = aweYear;
    return;
  }

  aweYear = year;
  aweRows = [];
  if (!aweDistrict) { message("Select a District to begin"); return; }
  buildRows();
}

// ── Saving ──
// One row's payload: its keys, the person, and ONLY the fields this view may write.
function payloadFor(r) {
  const rec = { month: r.month, districtName: aweDistrict, block: aweBlock, updatedBy: currentUser() };
  editableColumns().forEach(c => { rec[c.key] = str(r[c.key]); });
  return rec;
}

function invalidFields(r) {
  return editableColumns().filter(c => !valid(r[c.key])).map(c => c.head.replace(/<br>/g, " "));
}

// Against what the database sent back: null when it matches, otherwise the reason.
function verifyEcho(sent, echoed) {
  if (!echoed) return "the database did not confirm the row";
  const mismatched = editableColumns()
    .filter(c => !sameValue(sent[c.key], echoed[c.key]))
    .map(c => c.head.replace(/<br>/g, " "));
  return mismatched.length ? "the database shows different values for " + mismatched.join(", ") : null;
}

// Sends the records and returns { ok, byKey }: each row key against the row the
// database sent back. Never throws.
async function postRecords(records) {
  try {
    const now = new Date().toISOString();
    const body = records.map(rec => {
      const row = { month_label: rec.month, district_name: rec.districtName, block: rec.block,
                    updated_by: rec.updatedBy || null, updated_at: now };
      editableColumns().forEach(c => { row[DB_COLUMN[c.key]] = rec[c.key] === "" ? null : Number(rec[c.key]); });
      return row;
    });
    const res = await fetch(SB_URL + "/rest/v1/award_events?on_conflict=month_label,district_name,block", {
      method: "POST",
      headers: sbHeaders({ "Content-Type": "application/json",
                           Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify(body)
    });
    if (!res.ok) return { ok: false, reason: "the database rejected the save", byKey: {} };
    const out = await res.json();
    const byKey = {};
    (out || []).forEach(row => {
      const r = fromDb(row);
      byKey[rowKey(r.month, r.districtName, r.block)] = r;
    });
    return { ok: true, byKey: byKey };
  } catch (e) {
    console.error("save failed:", e);
    return { ok: false, reason: "the database could not be reached", byKey: {} };
  }
}

// A confirmed row goes into the local copy, so the roll-ups and the Saved mark
// follow the database without another trip.
function adoptSaved(echoed) {
  const key = rowKey(echoed.month, echoed.districtName, echoed.block);
  const i = aweEvents.findIndex(r => rowKey(r.month, r.districtName, r.block) === key);
  if (i >= 0) aweEvents[i] = echoed; else aweEvents.push(echoed);
}

window.aweSaveRow = async function (index) {
  if (aweSaving) return;
  const r = aweRows[index];
  if (!r) return;

  const invalid = invalidFields(r);
  if (invalid.length) {
    showToast("These must be whole numbers (0 or more): " + invalid.join(", ") + ".", "error");
    return;
  }

  aweSaving = true;
  const cell = el("awesave-" + index);
  if (cell) cell.innerHTML = '<span class="img-status">⏳ Saving…</span>';

  const sent = payloadFor(r);
  const out = await postRecords([sent]);
  aweSaving = false;

  const echoed = out.ok ? out.byKey[rowKey(sent.month, sent.districtName, sent.block)] : null;
  const problem = out.ok ? verifyEcho(sent, echoed) : out.reason;

  if (problem) {
    // Nothing is cleared and nothing is redrawn from the database: the typed
    // numbers stay exactly as they were left.
    r._failed = true;
    r._dirty = true;
    refreshRowControls(index);
    updateSaveBar();
    showToast("Upload failed — " + problem + ". Your numbers are still here. Please retry.", "error");
    return;
  }

  adoptSaved(echoed);
  r.updatedBy = str(echoed.updatedBy);
  r.updatedAt = str(echoed.updatedAt);
  r._dirty = false;
  r._failed = false;
  r._existed = editableColumns().some(c => str(r[c.key]) !== "");
  render();
  showToast(r.month + " — saved.");
};

async function saveAll() {
  if (aweSaving) return;

  const dirty = aweRows.filter(r => r._dirty || r._failed);
  if (!dirty.length) { showToast("Nothing to save.", "info"); return; }

  const bad = dirty.filter(r => invalidFields(r).length);
  if (bad.length) {
    showToast("Fix these months first (whole numbers only): " + bad.map(r => r.month).join(", ") + ".", "error");
    return;
  }

  const where = isBlockView() ? aweDistrict + " / " + aweBlock : aweDistrict + " (district level)";
  const choice = await showModal({
    title: "Save event data?",
    message: dirty.length + " month" + (dirty.length === 1 ? "" : "s") + " will be saved for " + where + ", AY " + aweYear + ".",
    buttons: [
      { label: "Cancel", value: "cancel", variant: "cancel" },
      { label: "Save", value: "go", variant: "primary" }
    ]
  });
  if (choice !== "go") return;

  aweSaving = true;
  const btn = el("aweSaveAllBtn");
  if (btn) { btn.disabled = true; btn.innerText = "Saving..."; }
  showLoader();

  const sentList = dirty.map(payloadFor);
  const out = await postRecords(sentList);

  // Each row is judged on its own echo, so a partial write leaves exactly the
  // unconfirmed rows marked for retry instead of failing the whole batch.
  const failed = [];
  dirty.forEach((r, i) => {
    const sent = sentList[i];
    const echoed = out.ok ? out.byKey[rowKey(sent.month, sent.districtName, sent.block)] : null;
    const problem = out.ok ? verifyEcho(sent, echoed) : out.reason;
    if (problem) {
      r._failed = true;
      r._dirty = true;
      failed.push(r.month);
      return;
    }
    adoptSaved(echoed);
    r.updatedBy = str(echoed.updatedBy);
    r.updatedAt = str(echoed.updatedAt);
    r._dirty = false;
    r._failed = false;
    r._existed = editableColumns().some(c => str(r[c.key]) !== "");
  });

  aweSaving = false;
  if (btn) { btn.disabled = false; btn.innerText = "💾 Save All Changes"; }
  hideLoader();
  render();

  const okCount = dirty.length - failed.length;
  if (!failed.length) {
    showToast(okCount + " month" + (okCount === 1 ? "" : "s") + " saved.");
  } else if (!okCount) {
    showToast("Upload failed — " + (out.reason || "not confirmed by the database") + ". Your numbers are still here. Please retry.", "error");
  } else {
    showToast(okCount + " saved. Not confirmed: " + failed.join(", ") + " — still here, please retry.", "error");
  }
}

// ── Refresh ──
async function refresh() {
  if (aweSaving) return;

  if (hasUnsaved()) {
    const choice = await showModal({
      title: "Refresh event data?",
      message: "Refreshing will discard your unsaved counts and load the latest saved data.",
      buttons: [
        { label: "Cancel", value: "cancel", variant: "cancel" },
        { label: "Discard & Refresh", value: "go", variant: "danger" }
      ]
    });
    if (choice !== "go") return;
  }

  showLoader();
  try {
    aweEventsLoaded = false;
    const ok = await loadEvents();
    await loadDistricts();
    await loadBlocks();
    // A district that is no longer listed cannot stay selected.
    if (aweDistrict && aweDistricts.indexOf(aweDistrict) < 0) {
      aweDistrict = ""; aweBlock = ""; aweRows = [];
      message("Select a District to begin");
    }
    renderDistrictOptions();
    renderBlockOptions();
    renderNotes();
    if (aweDistrict) buildRows();
    showToast(ok ? "Event data refreshed." : "Couldn't refresh event data.", ok ? "success" : "error");
  } finally {
    hideLoader();
  }
}

// ── Excel report ──
// One row per District + Block + Month, across every saved row. The two levels
// are merged onto the same row: a block's own figures sit on its row, and the
// district-level figures for that month land on the district's default block.
// When that block also has figures of its own, both share the one row.
const EXPORT_HEADERS = [
  "State", "District", "Block", "Month",
  "Total  Block Events", "Total District Events",
  "Teachers Felicitated (Block Level)", "Teachers Felicitated (District Level)",
  "SU/NS Events", "Teachers Felicitated (SU/NS Events)",
  "Other Events", "Teachers Felicitated (Other Events)",
  "Total Cluster Heads Recognised"
];

// "Jun-2026" -> 2026*12+5, so months sort by date and not by name.
function monthOrder(month) {
  const parts = String(month || "").split("-");
  const mi = MONTH_NAMES.indexOf(String(parts[0] || "").slice(0, 3));
  const yr = parseInt(parts[1], 10);
  if (mi < 0 || isNaN(yr)) return Number.MAX_SAFE_INTEGER;
  return yr * 12 + mi;
}

// Counts go into the workbook as numbers so they add up; a blank stays blank.
function num(v) {
  const t = str(v);
  if (t === "") return "";
  const n = Number(t);
  return isNaN(n) ? t : n;
}

function buildExportRows() {
  const byDistrict = {};
  aweEvents.forEach(r => {
    const d = str(r.districtName);
    const m = str(r.month);
    if (!d || !m) return;
    byDistrict[d] = byDistrict[d] || {};
    byDistrict[d][m] = byDistrict[d][m] || { district: null, blocks: {} };
    const bucket = byDistrict[d][m];
    const b = str(r.block);
    if (b === "") bucket.district = r; else bucket.blocks[b] = r;
  });

  const out = [];
  Object.keys(byDistrict).sort((a, b) => a.localeCompare(b)).forEach(district => {
    const months = byDistrict[district];
    const state = lookup(aweStates, district) || "";
    const mapped = blocksFor(district);
    const fallback = defaultBlock(district);

    Object.keys(months).sort((a, b) => monthOrder(a) - monthOrder(b)).forEach(month => {
      const bucket = months[month];
      const dRow = bucket.district;

      // The blocks that need a row this month: any with figures of their own, and
      // the default block when there are district figures to put somewhere.
      const names = Object.keys(bucket.blocks);
      if (dRow && fallback && names.indexOf(fallback) < 0) names.push(fallback);

      // In the mapping's order, with anything unmapped after it, so a block that
      // was renamed is still exported and not dropped.
      names.sort((a, b) => {
        const ia = mapped.indexOf(a), ib = mapped.indexOf(b);
        if (ia >= 0 && ib >= 0) return ia - ib;
        if (ia >= 0) return -1;
        if (ib >= 0) return 1;
        return a.localeCompare(b);
      });

      // District figures with no block mapped at all still get one row, Block blank.
      if (!names.length && dRow) names.push("");

      names.forEach(block => {
        const bRow = bucket.blocks[block] || null;
        const carriesDistrict = dRow && (block === fallback || (!fallback && block === ""));
        out.push([
          state, district, block, month,
          bRow ? num(bRow.blockEvents) : "",
          carriesDistrict ? num(dRow.districtEvents) : "",
          bRow ? num(bRow.blockTeachers) : "",
          carriesDistrict ? num(dRow.districtTeachers) : "",
          carriesDistrict ? num(dRow.suNsEvents) : "",
          carriesDistrict ? num(dRow.suNsTeachers) : "",
          carriesDistrict ? num(dRow.otherEvents) : "",
          carriesDistrict ? num(dRow.otherTeachers) : "",
          carriesDistrict ? num(dRow.clusterHeads) : ""
        ]);
      });
    });
  });
  return out;
}

function downloadExcel() {
  if (!aweEventsLoaded) { showToast("Event data is still loading. Try again in a moment.", "info"); return; }
  const rows = buildExportRows();
  if (!rows.length) { showToast("There is no saved event data to export yet.", "info"); return; }
  if (!window.awardXlsx) { showToast("Could not generate the Excel file.", "error"); return; }

  try {
    const bytes = window.awardXlsx.build([EXPORT_HEADERS].concat(rows), "Event Data");
    window.awardXlsx.download(bytes, "OLF_Event_Report_" + new Date().toISOString().slice(0, 10) + ".xlsx");
    showToast("Excel downloaded — " + rows.length + " row" + (rows.length === 1 ? "" : "s") + ".");
  } catch (e) {
    console.error("Event Excel export failed:", e);
    showToast("Could not generate the Excel file.", "error");
  }
}

// ── Start ──
// Called the first time Event Management is opened, and again on a fresh page.
window.initAwardEventUI = function () {
  aweEvents = []; aweEventsLoaded = false; aweEventsLoading = false;
  aweDistrict = ""; aweBlock = ""; aweRows = []; aweSaving = false;
  aweDistricts = []; aweDistrictsState = "loading"; aweBlocks = {}; aweStates = {};

  const on = function (id, event, handler) {
    const node = el(id);
    if (node) node.addEventListener(event, handler);
  };
  on("aweDistrict", "change", onDistrictChange);
  on("aweBlock", "change", onBlockChange);
  on("aweYear", "change", onYearChange);
  on("aweRefreshBtn", "click", function (e) { e.stopPropagation(); refresh(); });
  on("aweSaveAllBtn", "click", function (e) { e.stopPropagation(); saveAll(); });
  on("aweExportBtn", "click", function (e) { e.stopPropagation(); downloadExcel(); });

  populateYears();
  renderDistrictOptions();
  renderBlockOptions();
  message("Select a District to begin");
  loadDistricts();
  loadBlocks();
  loadEvents();

  // Never let a closing tab take unsaved counts with it.
  if (!window.__aweBeforeUnload) {
    window.__aweBeforeUnload = true;
    window.addEventListener("beforeunload", function (e) {
      if (!hasUnsaved()) return;
      e.preventDefault();
      e.returnValue = "";
      return "";
    });
  }
};

})();
