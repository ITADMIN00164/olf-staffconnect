/* award-append.js - adds a month's new records (the sheet the POM team calls Raw Data) to
   public.award_records, from the Award Management view of the Test tab.

   Only the IT admin account sees the button. Everything goes to the CURRENT month, the way
   each month's records have been added so far. Before anything is sent the file is checked
   row by row, and only the rows that pass are added:
     - the columns are found by their headings, so their order does not matter;
     - Community and District Name must be one of the values in the dropdown lists
       (public.award_lists), exactly as written;
     - the name, mobile number (10 digits), school, award and category must be there;
     - a post already in the table, or listed twice, is skipped, not added again.
   Running the same file again therefore adds nothing twice.

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
  ["fullName", "Full Name"], ["mobile", "Mobile number"], ["school", "School name"],
  ["community", "community"], ["district", "District Name"],
  ["awardName", "Award name"], ["awardCategory", "Award Category"]
];

let parsed = null;          // what the last file came to: { ok, dupes, errors, label }

function el(id) { return document.getElementById(id); }
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function isAdmin() {
  const u = window.__olfUser;
  return !!(u && String(u.email || "").trim().toLowerCase() === ADMIN_EMAIL);
}

function currentMonth() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return { label: MON[d.getMonth()] + "-" + d.getFullYear(), start: d.getFullYear() + "-" + m + "-01" };
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
  const rows = await sbGet("award_lists?select=kind,value&order=kind.asc,sort_order.asc&limit=10000");
  const out = { community: [], district: [] };
  rows.forEach(r => { if (out[r.kind]) out[r.kind].push(r.value); });
  if (!out.community.length || !out.district.length) throw new Error("award_lists is empty");
  return out;
}

// What is in the table already, from every month: a post by its link, and a record that has no
// link by who, where and what it is for.
function identity(r) {
  const url = String(r.post_url || "").trim().toLowerCase();
  if (url) return url;
  return ["no link", r.mobile, r.full_name, r.school_name, r.award_name, r.award_category]
    .map(x => String(x == null ? "" : x).trim().toLowerCase()).join("|");
}

async function loadKnownPosts() {
  const known = new Set();
  for (let offset = 0; ; offset += 1000) {
    const rows = await sbGet("award_records?select=post_url,mobile,full_name,school_name,award_name,award_category&order=id.asc&limit=1000&offset=" + offset);
    rows.forEach(r => known.add(identity(r)));
    if (rows.length < 1000) break;
  }
  return known;
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
  if (rec.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rec.email)) problems.push("Email “" + rec.email + "” is not valid");
  if (rec.postUrl && !/^https?:\/\/\S+$/i.test(rec.postUrl)) problems.push("Post link URL is not a web address");
  if (rec.postScore !== "" && isNaN(Number(rec.postScore))) problems.push("Post score “" + rec.postScore + "” is not a number");

  return { rec: rec, problems: problems };
}

function postKey(rec) {
  return identity({ post_url: rec.postUrl, mobile: rec.mobile, full_name: rec.fullName,
                    school_name: rec.school, award_name: rec.awardName, award_category: rec.awardCategory });
}

async function analyse(buffer) {
  const month = currentMonth();
  const rows = readRows(buffer);
  if (!rows.length) throw new Error("The sheet has headings but no records.");
  const [lists, known] = await Promise.all([loadLists(), loadKnownPosts()]);

  const ok = [], dupes = [], errors = [];
  const seen = new Set();
  let otherMonth = 0;
  rows.forEach(r => {
    const checked = checkRow(r, lists);
    if (checked.problems.length) { errors.push({ line: r.line, name: checked.rec.fullName, problems: checked.problems }); return; }
    const split = splitAward(checked.rec.awardName, checked.rec.awardCategory);
    checked.rec.awardName = split.awardName;
    checked.rec.awardCategory = split.awardCategory;
    const key = postKey(checked.rec);
    if (known.has(key) || seen.has(key)) { dupes.push({ line: r.line, name: checked.rec.fullName }); return; }
    seen.add(key);
    checked.rec.line = r.line;
    ok.push(checked.rec);
    if (cellText(r.month) && cellText(r.month) !== month.label) otherMonth++;
  });
  return { ok: ok, dupes: dupes, errors: errors, label: month.label, start: month.start, total: rows.length, otherMonth: otherMonth };
}

// ── The template: the Raw Data headings, the dropdowns, the lists they take from, and how to fill it ──
const TEMPLATE_HEADINGS = ["Month", "Full Name", "Mobile number", "Email", "School name", "community", "Circle name",
  "Block Name", "District Name", "PM Name", "Award name", "Award Category", "Post link URL", "Post score"];
const TEMPLATE_ROWS = 5000;      // how far down the dropdowns reach

async function downloadTemplate() {
  const btn = el("awaTemplate");
  btn.disabled = true;
  try {
    if (!window.awardXlsx || !window.awardXlsx.buildWorkbook) throw new Error("The spreadsheet writer did not load.");
    const lists = await loadLists();
    const listRows = [["community", "District Name"]];
    for (let i = 0; i < Math.max(lists.community.length, lists.district.length); i++) {
      listRows.push([lists.community[i] || "", lists.district[i] || ""]);
    }
    const month = currentMonth().label;
    const bytes = window.awardXlsx.buildWorkbook([
      {
        name: "Raw Data",
        rows: [TEMPLATE_HEADINGS],
        widths: [10, 24, 16, 26, 36, 18, 22, 28, 20, 20, 34, 18, 34, 12],
        validations: [
          { sqref: "F2:F" + TEMPLATE_ROWS, formula: "Lists!$A$2:$A$" + (lists.community.length + 1),
            message: "Choose a community from the list." },
          { sqref: "I2:I" + TEMPLATE_ROWS, formula: "Lists!$B$2:$B$" + (lists.district.length + 1),
            message: "Choose a district from the list." }
        ]
      },
      { name: "Lists", rows: listRows, widths: [22, 24] },
      {
        name: "How to fill",
        widths: [110],
        rows: [
          ["How to fill this sheet"],
          [""],
          ["1. Fill one row per record on the Raw Data sheet, starting on row 2. Keep the headings as they are."],
          ["2. Required: Full Name, Mobile number (10 digits), School name, community, District Name, Award name, Award Category."],
          ["3. community and District Name: choose from the dropdown. Anything not in the list (see the Lists sheet) is not added."],
          ["4. Month: leave it empty. When uploaded, every record goes to the current month (" + month + " today)."],
          ["5. Post link URL starts with http. Post score is a number. Email, Circle name, Block Name and PM Name are optional."],
          ["6. A post that is already in the table (same Post link URL) is skipped, so the same sheet can be uploaded again safely."],
          ["7. Save as .xlsx, then upload it in Add records, step 2."]
        ]
      }
    ]);
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

// ── The window ──
function setBusy(msg) {
  el("awaResult").innerHTML = '<p class="awa-note">' + esc(msg) + "</p>";
  el("awaGo").disabled = true;
}

function render(p) {
  const parts = [];
  parts.push('<div class="awa-stats">' +
    '<div class="awa-stat ok"><b>' + p.ok.length + "</b><span>to add to " + esc(p.label) + "</span></div>" +
    '<div class="awa-stat dup"><b>' + p.dupes.length + "</b><span>already in the table</span></div>" +
    '<div class="awa-stat bad"><b>' + p.errors.length + "</b><span>with a problem</span></div></div>");
  if (p.otherMonth) {
    parts.push('<p class="awa-note">' + p.otherMonth + " row" + (p.otherMonth === 1 ? "" : "s") +
      " name another month in the Month column. Everything is added to " + esc(p.label) + ", the current month.</p>");
  }
  if (p.errors.length) {
    parts.push('<div class="awa-errs"><div class="awa-errs-head"><b>Rows with a problem are not added</b>' +
      '<button type="button" id="awaCsv">Download these rows</button></div><ul>' +
      p.errors.slice(0, 60).map(e => "<li><span>Row " + e.line + (e.name ? " · " + esc(e.name) : "") + "</span> " +
        esc(e.problems.join("; ")) + "</li>").join("") +
      (p.errors.length > 60 ? "<li>…and " + (p.errors.length - 60) + " more (in the download).</li>" : "") + "</ul></div>");
  }
  if (!p.ok.length) parts.push('<p class="awa-note">' + (p.errors.length ? "Fix the rows above in the sheet and choose it again." : "Nothing new to add.") + "</p>");
  el("awaResult").innerHTML = parts.join("");
  el("awaGo").disabled = !p.ok.length;
  el("awaGo").textContent = p.ok.length ? "Add " + p.ok.length + " record" + (p.ok.length === 1 ? "" : "s") : "Add records";
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
  const m = currentMonth();
  el("awaMonth").innerHTML = "Records are added to <b>" + esc(m.label) + "</b>, the current month.";
  el("awaResult").innerHTML = '<p class="awa-note">Community and District Name must come from the dropdown lists; the template has them built in.</p>';
  el("awaGo").disabled = true;
  el("awaGo").textContent = "Add records";
  el("awaModal").classList.add("open");
}

function closeModal() { el("awaModal").classList.remove("open"); }

async function onFile() {
  const file = el("awaFile").files[0];
  parsed = null;
  if (!file) return;
  try {
    setBusy("Reading " + file.name + "…");
    await loadSheetJs();
    const buffer = await file.arrayBuffer();
    setBusy("Checking the rows…");
    parsed = await analyse(buffer);
    render(parsed);
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
  if (!parsed || !parsed.ok.length || !isAdmin()) return;
  const p = parsed;
  const btn = el("awaGo");
  btn.disabled = true;
  el("awaFile").disabled = true;
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  let added = 0;
  try {
    for (let i = 0; i < p.ok.length; i += CHUNK) {
      btn.textContent = "Adding… " + added + " of " + p.ok.length;
      const body = p.ok.slice(i, i + CHUNK).map(r => ({
        month_label: p.label, month_start: p.start,
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
      " records. Nothing is added twice: choose the same file again and the " + added + " already added are skipped.</p>";
    btn.textContent = "Add records";
    return;
  }
  el("awaFile").disabled = false;
  btn.disabled = false;
  el("awaResult").innerHTML = '<p class="awa-note awa-done">✓ ' + added + " record" + (added === 1 ? "" : "s") +
    " added to " + esc(p.label) + ".</p>";
  btn.textContent = "Done";
  parsed = null;
  // Show them: reload the month summary of the district that is open.
  const dd = el("awmDistrict");
  if (dd && dd.value) dd.dispatchEvent(new Event("change"));
}

window.awardAppendInit = function () {
  const open = el("awaOpenBtn");
  if (!open) return;
  open.hidden = !isAdmin();
  if (open.dataset.ready) return;
  open.dataset.ready = "1";
  open.addEventListener("click", openModal);
  el("awaFile").addEventListener("change", onFile);
  el("awaTemplate").addEventListener("click", downloadTemplate);
  el("awaCancel").addEventListener("click", closeModal);
  el("awaGo").addEventListener("click", function () {
    if (el("awaGo").textContent === "Done") { closeModal(); return; }
    add();
  });
  el("awaModal").addEventListener("click", function (e) { if (e.target === el("awaModal")) closeModal(); });
};

})();
