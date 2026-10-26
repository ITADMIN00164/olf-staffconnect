/* award-append.js - adds a month's new records (the sheet the POM team calls Raw Data) to
   public.award_records, from the Award Management view of the Test tab.

   Only the IT admin account sees the button. The month and year the records belong to are chosen
   after the sheet is picked, and nothing is sent until they are. Before anything is sent the file is checked
   row by row, and the sheet is added only if EVERY row passes, so one wrong row stops the whole upload:
     - the columns are found by their headings, so their order does not matter;
     - Community and District Name must be one of the values in the dropdown lists
       (public.award_lists), exactly as written;
     - every column must be filled in, and the mobile number must have 10 digits.
   A row is a DUPLICATE, and is not added, when its Month + Full Name + School name + Award name are the
   same as a record already in that month, or as an earlier row of the same sheet. Those four together are
   the unique key: capitals and extra spaces do not matter, and nothing is updated for a duplicate.
   A wrong upload is taken out again with "All uploads".

   NOTE: the check on who may add is made here in the page, like the other admin-only
   screens of this app. The database itself accepts writes from the page's public key. */
(function () {

const SB_URL = "https://rpnxpkwcpsbxswnowuhx.supabase.co";
const SB_KEY = "sb_publishable_60Ynb6EZ6Qc2GHrdqERwpw_dUdH3dKD";
const ADMIN_EMAIL = "itadmin@openlinksfoundation.org";
const SHEETJS = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
const CHUNK = 300;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The columns, by the way they are headed in the sheet (case and spaces do not matter).
const COLUMNS = {
  month: "month", fullname: "fullName", mobilenumber: "mobile", email: "email",
  schoolname: "school", community: "community", circlename: "circle", blockname: "block",
  districtname: "district", pmname: "pm", awardname: "awardName", awardcategory: "awardCategory",
  postlinkurl: "postUrl", postscore: "postScore"
};
const NEEDED = [
  ["fullName", "Full Name"], ["mobile", "Mobile number"], ["email", "Email"], ["school", "School name"],
  ["community", "community"], ["circle", "Circle name"], ["block", "Block Name"],
  ["district", "District Name"], ["pm", "PM Name"], ["awardName", "Award name"],
  ["awardCategory", "Award Category"], ["postUrl", "Post link URL"], ["postScore", "Post score"]
];

let parsed = null;          // what the last file came to: { ok, errors, total, view } - view is { label, fresh, dupes } for the month chosen

function el(id) { return document.getElementById(id); }
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function isAdmin() {
  const u = window.__olfUser;
  return !!(u && String(u.email || "").trim().toLowerCase() === ADMIN_EMAIL);
}

// The month and year the person chose, as the label the screens write ("Nov-2026") and its first day.
function chosenMonth() {
  const m = el("awaMonthSel") ? el("awaMonthSel").value : "";
  const y = el("awaYearSel") ? el("awaYearSel").value : "";
  if (m === "" || y === "") return null;
  return { label: MON[Number(m)] + "-" + y, start: y + "-" + String(Number(m) + 1).padStart(2, "0") + "-01" };
}

// Last year, this year and next, so a month can still be added after the year turns.
function fillWhen() {
  const ms = el("awaMonthSel"), ys = el("awaYearSel");
  if (!ms || !ys || ms.dataset.ready) return;
  ms.dataset.ready = "1";
  ms.innerHTML = '<option value="">Month</option>' + MON.map((n, i) => '<option value="' + i + '">' + n + "</option>").join("");
  const now = new Date().getFullYear();
  ys.innerHTML = '<option value="">Year</option>' + [now - 1, now, now + 1].map(y => '<option value="' + y + '">' + y + "</option>").join("");
}

function showWhen(on) {
  const step = el("awaWhenStep");
  if (step) step.hidden = !on;
}

// The Add button waits for rows that can be added and for a month and year.
function updateGo() {
  const btn = el("awaGo");
  if (!btn || btn.textContent === "Done") return;
  const m = chosenMonth();
  const bad = parsed ? parsed.errors.length : 0;
  const view = parsed && parsed.view;
  const n = view ? view.fresh.length : 0;
  btn.disabled = bad > 0 || !view || n === 0;
  btn.textContent = bad ? "Fix " + bad + " row" + (bad === 1 ? "" : "s") + " first"
    : !parsed || !parsed.ok.length ? "Add records"
    : !m ? "Choose the month and year"
    : !view ? "Checking for duplicates\u2026"
    : n ? "Add " + n + " record" + (n === 1 ? "" : "s") + " to " + m.label
    : "Nothing new to add";
  const note = el("awaWhenNote");
  if (note) note.textContent = bad ? "Nothing is added while any row has a problem."
    : !m ? "Nothing is added until both are chosen."
    : !view ? "Checking " + m.label + " for rows that are already there."
    : view.dupes.length ? view.dupes.length + " duplicate row" + (view.dupes.length === 1 ? " is" : "s are") + " left out; the rest will be added to " + m.label + "."
    : "The records will be added to " + m.label + ".";
}

// ── The same split Award Management and the dashboard make: the level goes to the category ──
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

// ── Database ──
function sbHeaders(extra) {
  return Object.assign({ apikey: SB_KEY, Authorization: "Bearer " + SB_KEY }, extra || {});
}
async function sbGet(path) {
  const res = await fetch(SB_URL + "/rest/v1/" + path, { headers: sbHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function loadLists() {
  const rows = await sbGet("award_lists?select=kind,value&limit=10000");
  const out = { community: [], district: [] };
  rows.forEach(r => { if (out[r.kind]) out[r.kind].push(r.value); });
  out.community.sort((a, b) => a.localeCompare(b));
  out.district.sort((a, b) => a.localeCompare(b));
  if (!out.community.length || !out.district.length) throw new Error("award_lists is empty");
  return out;
}

// ── Reading the file ──
function loadSheetJs() {
  if (window.XLSX) return Promise.resolve();
  return new Promise(function (resolve, reject) {
    const s = document.createElement("script");
    s.src = SHEETJS;
    s.onload = resolve;
    s.onerror = function () { reject(new Error("Could not load the spreadsheet reader. Check your connection.")); };
    document.head.appendChild(s);
  });
}

function normHeader(h) { return String(h == null ? "" : h).toLowerCase().replace(/[^a-z0-9]/g, ""); }

function cellText(v) { return v == null ? "" : String(v).replace(/\s+/g, " ").trim(); }

// A mobile number as the sheet may hold it: 9876543210, 9.876543210E9, "+91 98765 43210".
function cleanMobile(v) {
  let s = cellText(v);
  if (s === "") return "";
  if (typeof v === "number" || /^\d+(\.\d+)?e\+?\d+$/i.test(s)) s = String(Math.round(Number(v)));
  s = s.replace(/[\s\-().]/g, "");
  if (/^\+?91\d{10}$/.test(s)) s = s.slice(-10);
  return s;
}

function readRows(buffer) {
  const wb = window.XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid = window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "", blankrows: false });
  // The heading row is the first one that has a Full Name heading.
  const headAt = grid.findIndex(r => r.some(c => normHeader(c) === "fullname"));
  if (headAt < 0) throw new Error('No heading row found. The sheet needs a "Full Name" column and the other Raw Data headings.');
  const at = {};
  grid[headAt].forEach((h, i) => {
    const f = COLUMNS[normHeader(h)];
    if (f && at[f] === undefined) at[f] = i;
  });
  const missing = NEEDED.filter(n => at[n[0]] === undefined).map(n => n[1]);
  if (missing.length) throw new Error("These columns are missing from the sheet: " + missing.join(", ") + ".");
  const rows = [];
  grid.slice(headAt + 1).forEach((r, i) => {
    if (r.every(c => cellText(c) === "")) return;
    const rec = { line: headAt + i + 2 };
    Object.keys(at).forEach(f => { rec[f] = r[at[f]]; });
    rows.push(rec);
  });
  return rows;
}

// ── Checking a row ──
function suggest(list, value) {
  const key = String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  return list.find(x => x.toLowerCase().replace(/[^a-z0-9]/g, "") === key) || "";
}

function checkRow(r, lists) {
  const problems = [];
  const rec = {
    fullName: cellText(r.fullName), mobile: cleanMobile(r.mobile), email: cellText(r.email),
    school: cellText(r.school), community: cellText(r.community), circle: cellText(r.circle),
    block: cellText(r.block), district: cellText(r.district), pm: cellText(r.pm),
    awardName: cellText(r.awardName), awardCategory: cellText(r.awardCategory),
    postUrl: cellText(r.postUrl), postScore: cellText(r.postScore)
  };

  if (!rec.fullName) problems.push("Full Name is empty");
  if (!rec.mobile) problems.push("Mobile number is empty");
  else if (!/^[6-9]\d{9}$/.test(rec.mobile)) problems.push("Mobile number “" + rec.mobile + "” is not a 10-digit number");
  if (!rec.school) problems.push("School name is empty");

  if (!rec.community) problems.push("community is empty");
  else if (lists.community.indexOf(rec.community) === -1) {
    const s = suggest(lists.community, rec.community);
    problems.push("community “" + rec.community + "” is not in the list" + (s ? " (“" + s + "”?)" : ""));
  }
  if (!rec.district) problems.push("District Name is empty");
  else if (lists.district.indexOf(rec.district) === -1) {
    const s = suggest(lists.district, rec.district);
    problems.push("District Name “" + rec.district + "” is not in the list" + (s ? " (“" + s + "”?)" : ""));
  }

  if (!rec.awardName) problems.push("Award name is empty");
  if (!rec.awardCategory) problems.push("Award Category is empty");
  if (!rec.email) problems.push("Email is empty");
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rec.email)) problems.push("Email \u201c" + rec.email + "\u201d is not valid");
  if (!rec.circle) problems.push("Circle name is empty");
  if (!rec.block) problems.push("Block Name is empty");
  if (!rec.pm) problems.push("PM Name is empty");
  if (!rec.postUrl) problems.push("Post link URL is empty");
  else if (!/^https?:\/\/\S+$/i.test(rec.postUrl)) problems.push("Post link URL is not a web address");
  if (rec.postScore === "") problems.push("Post score is empty");
  else if (isNaN(Number(rec.postScore))) problems.push("Post score \u201c" + rec.postScore + "\u201d is not a number");

  return { rec: rec, problems: problems };
}

async function analyse(buffer) {
  const rows = readRows(buffer);
  if (!rows.length) throw new Error("The sheet has headings but no records.");
  const lists = await loadLists();

  const ok = [], errors = [];
  rows.forEach(r => {
    const checked = checkRow(r, lists);
    if (checked.problems.length) { errors.push({ line: r.line, name: checked.rec.fullName, problems: checked.problems }); return; }
    const split = splitAward(checked.rec.awardName, checked.rec.awardCategory);
    checked.rec.awardName = split.awardName;
    checked.rec.awardCategory = split.awardCategory;
    checked.rec.line = r.line;
    ok.push(checked.rec);
  });
  return { ok: ok, errors: errors, total: rows.length };
}

// ── The template: the Raw Data headings, the dropdowns, the lists they take from, and how to fill it ──
// Only the data cells can be typed into. The headings, the Lists sheet and the instructions are
// locked. There is no Month column: the month and year are chosen when the sheet is uploaded.
const TEMPLATE_HEADINGS = ["Full Name", "Mobile number", "Email", "School name", "community", "Circle name",
  "Block Name", "District Name", "PM Name", "Award name", "Award Category", "Post link URL", "Post score"];
const TEMPLATE_ROWS = 5000;      // how far down the dropdowns reach

// 0 normal, 1 type-in cell, 2 type-in cell kept as text (mobile numbers), 3 heading, 4 locked month
const TEMPLATE_STYLES = '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
  '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF1E5F4A"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFEEF1F5"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="5">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyProtection="1"><protection locked="0"/></xf>' +
  '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyProtection="1"><protection locked="0"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>' +
  '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

async function downloadTemplate() {
  const btn = el("awaTemplate");
  btn.disabled = true;
  try {
    if (!window.awardXlsx || !window.awardXlsx.buildWorkbook) throw new Error("The spreadsheet writer did not load.");
    const lists = await loadLists();
    const listRows = [[{ s: 3, v: "community" }, { s: 3, v: "District Name" }]];
    for (let i = 0; i < Math.max(lists.community.length, lists.district.length); i++) {
      listRows.push([lists.community[i] || "", lists.district[i] || ""]);
    }
    const widths = [24, 16, 26, 36, 18, 22, 28, 20, 20, 34, 18, 34, 12];
    const bytes = window.awardXlsx.buildWorkbook([
      {
        name: "Raw Data",
        rows: [TEMPLATE_HEADINGS.map(h => ({ s: 3, v: h }))],
        protect: true,
        cols: widths.map((w, i) => ({ width: w, style: i === 1 ? 2 : 1 })),
        validations: [
          { sqref: "E2:E" + TEMPLATE_ROWS, formula: "Lists!$A$2:$A$" + (lists.community.length + 1),
            message: "Choose a community from the list." },
          { sqref: "H2:H" + TEMPLATE_ROWS, formula: "Lists!$B$2:$B$" + (lists.district.length + 1),
            message: "Choose a district from the list." }
        ]
      },
      { name: "Lists", rows: listRows, widths: [22, 24], protect: true },
      {
        name: "How to fill",
        widths: [110],
        protect: true,
        rows: [
          [{ s: 3, v: "How to fill this sheet" }],
          [""],
          ["1. Fill one row per record on the Raw Data sheet, starting on row 2. Keep the headings as they are."],
          ["2. community and District Name: choose from the dropdown. Anything not in the list (see the Lists sheet) is not added."],
          ["3. Save as .xlsx, then upload it in Add records and choose the month and year it belongs to."]
        ]
      }
    ], { styles: TEMPLATE_STYLES });
    window.awardXlsx.download(bytes, "Raw-Data-template.xlsx");
  } catch (e) {
    console.error("Template failed:", e);
    el("awaResult").innerHTML = '<p class="awa-note awa-err">' + esc(/award_lists/i.test(e.message || "")
      ? "The dropdown lists are not in the database yet. Run sql/award-lists-setup.sql in Supabase, then try again."
      : (e.message || "Could not make the template.")) + "</p>";
  } finally {
    btn.disabled = false;
  }
}

// ── Duplicates: Month + Full Name + School name + Award name is the unique key ──
function norm(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim().toLowerCase(); }
function uniqueKey(fullName, school, awardName) { return [fullName, school, awardName].map(norm).join("|"); }

const monthKeys = {};      // month label -> Set of the keys already in that month, kept while the window is open

async function loadMonthKeys(label) {
  if (monthKeys[label]) return monthKeys[label];
  const keys = new Set();
  for (let offset = 0; ; offset += 1000) {
    const rows = await sbGet("award_records?select=full_name,school_name,award_name,award_category&month_label=eq." +
      encodeURIComponent(label) + "&order=id.asc&limit=1000&offset=" + offset);
    rows.forEach(r => {
      const s = splitAward(r.award_name, r.award_category);   // as the new rows are written
      keys.add(uniqueKey(r.full_name, r.school_name, s.awardName));
    });
    if (rows.length < 1000) break;
  }
  monthKeys[label] = keys;
  return keys;
}

// The rows of the sheet that can go into a month, and the ones that cannot because they repeat.
async function computeView(label, fresh) {
  const known = await loadMonthKeys(label);
  const seen = new Set();
  const out = { label: label, fresh: [], dupes: [] };
  parsed.ok.forEach(r => {
    const key = uniqueKey(r.fullName, r.school, r.awardName);
    if (known.has(key)) { out.dupes.push({ line: r.line, name: r.fullName, school: r.school, award: r.awardName, where: "already in " + label }); return; }
    if (seen.has(key)) { out.dupes.push({ line: r.line, name: r.fullName, school: r.school, award: r.awardName, where: "repeats an earlier row of this sheet" }); return; }
    seen.add(key);
    out.fresh.push(r);
  });
  return out;
}

let viewSeq = 0;
async function refreshView() {
  const m = chosenMonth();
  if (!parsed) return;
  parsed.view = null;
  if (!m) { render(parsed); return; }
  const seq = ++viewSeq;
  el("awaGo").disabled = true;
  el("awaGo").textContent = "Checking for duplicates\u2026";
  try {
    const view = await computeView(m.label);
    if (seq !== viewSeq || !parsed) return;             // another month was chosen meanwhile
    parsed.view = view;
    render(parsed);
  } catch (e) {
    console.error("Duplicate check failed:", e);
    if (seq !== viewSeq) return;
    el("awaResult").innerHTML = '<p class="awa-note awa-err">Could not check for duplicates. Nothing was added. Try choosing the month again.</p>';
    el("awaGo").textContent = "Add records";
  }
}

// ── The window ──
function setBusy(msg) {
  el("awaResult").innerHTML = '<p class="awa-note">' + esc(msg) + "</p>";
  el("awaGo").disabled = true;
}

function render(p) {
  const parts = [];
  const view = p.view;
  parts.push('<div class="awa-stats">' +
    '<div class="awa-stat ok"><b>' + (view ? view.fresh.length : p.ok.length) + "</b><span>" +
      (view || !p.errors.length ? "to add" : "pass the checks") + "</span></div>" +
    '<div class="awa-stat dup"><b>' + (view ? view.dupes.length : "\u2013") + "</b><span>" +
      (view ? "duplicates, left out" : "duplicates: choose the month") + "</span></div>" +
    '<div class="awa-stat bad"><b>' + p.errors.length + "</b><span>with a problem</span></div></div>");
  if (p.errors.length) {
    parts.push('<div class="awa-errs"><div class="awa-errs-head"><b>Nothing is added until these rows are fixed</b>' +
      '<button type="button" id="awaCsv">Download these rows</button></div><ul>' +
      p.errors.slice(0, 60).map(e => "<li><span>Row " + e.line + (e.name ? " \u00b7 " + esc(e.name) : "") + "</span> " +
        esc(e.problems.join("; ")) + "</li>").join("") +
      (p.errors.length > 60 ? "<li>\u2026and " + (p.errors.length - 60) + " more (in the download).</li>" : "") + "</ul></div>");
  }
  if (view && view.dupes.length) {
    parts.push('<div class="awa-dups"><div class="awa-dups-head"><b>Duplicates are not added</b>' +
      "<span>Same Month, Full Name, School name and Award name</span></div><ul>" +
      view.dupes.slice(0, 60).map(d => "<li><span>Row " + d.line + " \u00b7 " + esc(d.name) + "</span> " +
        esc(d.school) + " \u00b7 " + esc(d.award) + " <em>" + esc(d.where) + "</em></li>").join("") +
      (view.dupes.length > 60 ? "<li>\u2026and " + (view.dupes.length - 60) + " more.</li>" : "") + "</ul></div>");
  }
  if (!p.ok.length) parts.push('<p class="awa-note">' + (p.errors.length ? "Fix the rows above in the sheet, then choose it again. The whole sheet is added only when every row is correct." : "The sheet has no rows to add.") + "</p>");
  el("awaResult").innerHTML = parts.join("");
  el("awaGo").textContent = "Add records";
  updateGo();
  const csv = el("awaCsv");
  if (csv) csv.addEventListener("click", downloadProblems);
}

function downloadProblems() {
  if (!parsed) return;
  const q = s => '"' + String(s).replace(/"/g, '""') + '"';
  const body = ["Row,Name,Problems"].concat(parsed.errors.map(e => [e.line, q(e.name), q(e.problems.join("; "))].join(","))).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + body], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = "records-with-problems.csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

function openModal() {
  if (!isAdmin()) return;
  parsed = null;
  el("awaFile").value = "";
  fillWhen();
  el("awaMonthSel").value = "";
  el("awaYearSel").value = "";
  showWhen(false);
  el("awaMonth").textContent = "After you choose the sheet, you choose the month and year its records belong to.";
  el("awaResult").innerHTML = '<p class="awa-note">Community and District Name must come from the dropdown lists; the template has them built in.</p>';
  el("awaGo").disabled = true;
  el("awaGo").textContent = "Add records";
  el("awaModal").classList.add("open");
}

function closeModal() { el("awaModal").classList.remove("open"); }

async function onFile() {
  const file = el("awaFile").files[0];
  parsed = null;
  showWhen(false);
  if (!file) return;
  try {
    setBusy("Reading " + file.name + "…");
    await loadSheetJs();
    const buffer = await file.arrayBuffer();
    setBusy("Checking the rows…");
    parsed = await analyse(buffer);
    for (const k in monthKeys) delete monthKeys[k];       // read the months again for a new sheet
    render(parsed);
    showWhen(true);
    if (chosenMonth()) refreshView();
  } catch (e) {
    console.error("Upload check failed:", e);
    const missingLists = /award_lists/i.test(e.message || "");
    el("awaResult").innerHTML = '<p class="awa-note awa-err">' + esc(missingLists
      ? "The dropdown lists are not in the database yet. Run sql/award-lists-setup.sql in Supabase, then try again."
      : (e.message || "Could not read that file.")) + "</p>";
    el("awaGo").disabled = true;
  }
}

async function add() {
  const month = chosenMonth();
  if (!parsed || !parsed.ok.length || parsed.errors.length || !month || !parsed.view || !isAdmin()) return;
  const btn = el("awaGo");
  btn.disabled = true;
  // Looked at once more now: someone may have added the same rows since the preview.
  delete monthKeys[month.label];
  let view;
  try { view = await computeView(month.label); } catch (e) {
    console.error("Duplicate check failed:", e);
    el("awaResult").innerHTML = '<p class="awa-note awa-err">Could not check for duplicates. Nothing was added.</p>';
    btn.disabled = false;
    return;
  }
  parsed.view = view;
  if (!view.fresh.length) { render(parsed); return; }
  const p = { ok: view.fresh };
  el("awaFile").disabled = true;
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  let added = 0;
  try {
    for (let i = 0; i < p.ok.length; i += CHUNK) {
      btn.textContent = "Adding… " + added + " of " + p.ok.length;
      const body = p.ok.slice(i, i + CHUNK).map(r => ({
        month_label: month.label, month_start: month.start,
        full_name: r.fullName, mobile: r.mobile, email: r.email || null,
        school_name: r.school, community: r.community, circle_name: r.circle || null,
        block_name: r.block || null, district_name: r.district, pm_name: r.pm || null,
        award_name: r.awardName, award_category: r.awardCategory,
        post_url: r.postUrl || null, post_score: r.postScore === "" ? null : Number(r.postScore),
        source_ref: "upload " + stamp + " row " + r.line
      }));
      const res = await fetch(SB_URL + "/rest/v1/award_records", {
        method: "POST",
        headers: sbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(await res.text());
      added += body.length;
    }
  } catch (e) {
    console.error("Adding records failed:", e);
    el("awaFile").disabled = false;
    el("awaResult").innerHTML = '<p class="awa-note awa-err">Stopped after ' + added + " of " + p.ok.length +
      " records. Nothing is added twice: choose the same file and month again, and the " + added + " already added are left out as duplicates.</p>";
    btn.textContent = "Add records";
    updateGo();
    return;
  }
  el("awaFile").disabled = false;
  btn.disabled = false;
  el("awaResult").innerHTML = '<p class="awa-note awa-done">✓ ' + added + " record" + (added === 1 ? "" : "s") +
    " added to " + esc(month.label) + ".</p>";
  btn.textContent = "Done";
  parsed = null;
  // Show them: reload the month summary of the district that is open.
  const dd = el("awmDistrict");
  if (dd && dd.value) dd.dispatchEvent(new Event("change"));
}

// ── The dropdown lists: add, rename and delete values (IT admin only) ──
let listKind = "community";
let listRowsCache = [];            // [{ id, kind, value }]
let listUse = { community: {}, district: {} };   // value -> how many records use it
let editingId = null;
let deletingId = null;

async function sbWrite(method, path, body) {
  const res = await fetch(SB_URL + "/rest/v1/" + path, {
    method: method,
    headers: sbHeaders({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? [] : res.json();
}

function listMessage(text, kind) {
  const box = el("awaListMsg");
  if (!box) return;
  box.textContent = text || "";
  box.className = "awa-list-msg" + (kind ? " " + kind : "");
}

async function loadListRows() {
  listRowsCache = await sbGet("award_lists?select=id,kind,value&order=kind.asc&limit=10000");
}

// How many records use each value, so a rename or delete is made knowing what it touches.
async function loadUse() {
  const use = { community: {}, district: {} };
  for (let offset = 0; ; offset += 1000) {
    const rows = await sbGet("award_records?select=community,district_name&order=id.asc&limit=1000&offset=" + offset);
    rows.forEach(r => {
      if (r.community) use.community[r.community] = (use.community[r.community] || 0) + 1;
      if (r.district_name) use.district[r.district_name] = (use.district[r.district_name] || 0) + 1;
    });
    if (rows.length < 1000) break;
  }
  listUse = use;
}

function renderListManager() {
  const body = el("awaListBody");
  const items = listRowsCache.filter(r => r.kind === listKind).sort((a, b) => a.value.localeCompare(b.value));
  document.querySelectorAll("#awaListsModal [data-akind]").forEach(b =>
    b.classList.toggle("is-active", b.getAttribute("data-akind") === listKind));
  const label = listKind === "community" ? "community" : "district";
  el("awaNew").placeholder = "New " + label + " name";
  if (!items.length) { body.innerHTML = '<p class="awa-note">Nothing in this list yet.</p>'; return; }
  body.innerHTML = '<ul class="awa-values">' + items.map(r => {
    const n = listUse[listKind][r.value] || 0;
    const use = n ? '<em title="Records using this value">' + n + " record" + (n === 1 ? "" : "s") + "</em>" : '<em class="none">not used</em>';
    if (editingId === r.id) {
      return '<li class="is-edit"><input type="text" data-aedit value="' + esc(r.value) + '" maxlength="80">' +
        '<button type="button" class="awa-b ok" data-asave="' + r.id + '">Save</button>' +
        '<button type="button" class="awa-b" data-acancel>Cancel</button></li>';
    }
    if (deletingId === r.id) {
      return '<li class="is-del"><span class="v">' + esc(r.value) + "</span>" +
        '<span class="ask">' + (n ? "Delete? " + n + " record" + (n === 1 ? " uses" : "s use") + " it; they keep the name." : "Delete this value?") + "</span>" +
        '<button type="button" class="awa-b bad" data-ayes="' + r.id + '">Delete</button>' +
        '<button type="button" class="awa-b" data-acancel>Keep</button></li>';
    }
    return '<li><span class="v">' + esc(r.value) + "</span>" + use +
      '<button type="button" class="awa-b" data-aedit-btn="' + r.id + '">Edit</button>' +
      '<button type="button" class="awa-b bad" data-adel="' + r.id + '">Delete</button></li>';
  }).join("") + "</ul>";
  const box = body.querySelector("[data-aedit]");
  if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
}

function cleanValue(v) { return String(v || "").replace(/\s+/g, " ").trim(); }

function duplicate(value, exceptId) {
  const key = value.toLowerCase();
  return listRowsCache.some(r => r.kind === listKind && r.id !== exceptId && r.value.toLowerCase() === key);
}

async function addValue() {
  if (!isAdmin()) return;
  const value = cleanValue(el("awaNew").value);
  if (!value) { listMessage("Type the new name first.", "bad"); return; }
  if (duplicate(value)) { listMessage("\u201c" + value + "\u201d is already in the list.", "bad"); return; }
  try {
    const max = listRowsCache.filter(r => r.kind === listKind).length;
    const out = await sbWrite("POST", "award_lists", { kind: listKind, value: value, sort_order: max + 1 });
    listRowsCache.push(out[0] || { id: Date.now(), kind: listKind, value: value });
    el("awaNew").value = "";
    listMessage("Added \u201c" + value + "\u201d.", "ok");
    renderListManager();
  } catch (e) { listMessage(writeProblem(e), "bad"); }
}

async function saveValue(id) {
  if (!isAdmin()) return;
  const box = document.querySelector("#awaListBody [data-aedit]");
  const value = cleanValue(box && box.value);
  const row = listRowsCache.find(r => r.id === id);
  if (!row) return;
  if (!value) { listMessage("The name cannot be empty.", "bad"); return; }
  if (value === row.value) { editingId = null; renderListManager(); return; }
  if (duplicate(value, id)) { listMessage("\u201c" + value + "\u201d is already in the list.", "bad"); return; }
  try {
    await sbWrite("PATCH", "award_lists?id=eq." + encodeURIComponent(id), { value: value });
    const n = listUse[listKind][row.value] || 0;
    listUse[listKind][value] = (listUse[listKind][value] || 0) + n;
    delete listUse[listKind][row.value];
    row.value = value;
    editingId = null;
    listMessage("Renamed. Records already added keep their old name.", "ok");
    renderListManager();
  } catch (e) { listMessage(writeProblem(e), "bad"); }
}

async function deleteValue(id) {
  if (!isAdmin()) return;
  try {
    await sbWrite("DELETE", "award_lists?id=eq." + encodeURIComponent(id));
    listRowsCache = listRowsCache.filter(r => r.id !== id);
    deletingId = null;
    listMessage("Deleted.", "ok");
    renderListManager();
  } catch (e) { listMessage(writeProblem(e), "bad"); }
}

function writeProblem(e) {
  if (e && (e.status === 401 || e.status === 403 || /permission|policy|denied/i.test(e.message || ""))) {
    return "The database would not accept that. Run sql/award-lists-manage.sql in Supabase first.";
  }
  if (e && e.status === 409) return "That value is already in the list.";
  return "Could not save that. Try again.";
}

async function openListManager() {
  if (!isAdmin()) return;
  editingId = null; deletingId = null; listKind = "community";
  listMessage("");
  el("awaListBody").innerHTML = '<p class="awa-note">Loading\u2026</p>';
  el("awaListsModal").classList.add("open");
  try {
    await Promise.all([loadListRows(), loadUse()]);
    renderListManager();
  } catch (e) {
    console.error("Lists failed:", e);
    el("awaListBody").innerHTML = '<p class="awa-note awa-err">' + esc(/award_lists/i.test(e.message || "")
      ? "The dropdown lists are not in the database yet. Run sql/award-lists-setup.sql in Supabase."
      : "Could not load the lists.") + "</p>";
  }
}

function wireListManager() {
  el("awaManage").addEventListener("click", openListManager);
  el("awaListsClose").addEventListener("click", function () { el("awaListsModal").classList.remove("open"); });
  el("awaListsModal").addEventListener("click", function (e) { if (e.target === el("awaListsModal")) el("awaListsModal").classList.remove("open"); });
  el("awaAdd").addEventListener("click", addValue);
  el("awaNew").addEventListener("keydown", function (e) { if (e.key === "Enter") addValue(); });
  document.querySelectorAll("#awaListsModal [data-akind]").forEach(b => b.addEventListener("click", function () {
    listKind = b.getAttribute("data-akind");
    editingId = null; deletingId = null;
    listMessage("");
    renderListManager();
  }));
  el("awaListBody").addEventListener("click", function (e) {
    const t = e.target;
    const idOf = a => { const v = t.getAttribute(a); return /^\d+$/.test(v) ? Number(v) : v; };
    if (t.hasAttribute("data-aedit-btn")) { editingId = idOf("data-aedit-btn"); deletingId = null; listMessage(""); renderListManager(); }
    else if (t.hasAttribute("data-adel")) { deletingId = idOf("data-adel"); editingId = null; listMessage(""); renderListManager(); }
    else if (t.hasAttribute("data-acancel")) { editingId = null; deletingId = null; renderListManager(); }
    else if (t.hasAttribute("data-asave")) saveValue(idOf("data-asave"));
    else if (t.hasAttribute("data-ayes")) deleteValue(idOf("data-ayes"));
  });
  el("awaListBody").addEventListener("keydown", function (e) {
    if (!e.target.hasAttribute("data-aedit")) return;
    if (e.key === "Enter") saveValue(editingId);
    if (e.key === "Escape") { editingId = null; renderListManager(); }
  });
}

window.awardAppendInit = function () {
  const open = el("awaOpenBtn");
  if (!open) return;
  open.hidden = !isAdmin();
  if (open.dataset.ready) return;
  open.dataset.ready = "1";
  fillWhen();
  open.addEventListener("click", openModal);
  el("awaFile").addEventListener("change", onFile);
  el("awaTemplate").addEventListener("click", downloadTemplate);
  el("awaMonthSel").addEventListener("change", refreshView);
  el("awaYearSel").addEventListener("change", refreshView);
  el("awaUploads").addEventListener("click", function () { if (window.awmOpenPastUploads) window.awmOpenPastUploads(); });
  wireListManager();
  el("awaCancel").addEventListener("click", closeModal);
  el("awaGo").addEventListener("click", function () {
    if (el("awaGo").textContent === "Done") { closeModal(); return; }
    add();
  });
  el("awaModal").addEventListener("click", function (e) { if (e.target === el("awaModal")) closeModal(); });
};

})();
