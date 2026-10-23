/* Turns the two POM sheets - Raw Data.xlsx and Awarded Data.xlsx - into rows
   for public.award_records, and says plainly what it could not place.

     node build.cjs "Raw Data.xlsx" "Awarded Data.xlsx" out.json

   Nothing is sent anywhere. The output holds names and mobile numbers, so it
   is written where you say and is not for the repository. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const load = require("./xlsx-read.cjs");

const [, , rawFile, awardedFile, outFile] = process.argv;
if (!rawFile || !awardedFile || !outFile) {
  console.error('usage: node build.cjs "Raw Data.xlsx" "Awarded Data.xlsx" out.json');
  process.exit(1);
}

function sheet1(file) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "award-xlsx-"));
  execFileSync("unzip", ["-q", file, "-d", path.join(dir, "x")]);
  const rows = load(dir)["sheet1.xml"];
  return rows;
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// An Excel date is a day count from 1899-12-30. Anything else is a label.
function month(v) {
  const s = String(v == null ? "" : v).trim();
  if (s !== "" && !isNaN(Number(s))) {
    const d = new Date(Math.round((Number(s) - 25569) * 86400000));
    const y = d.getUTCFullYear(), m = d.getUTCMonth();
    return { label: MON[m] + "-" + y, start: y + "-" + String(m + 1).padStart(2, "0") + "-01", ym: y + "-" + String(m + 1).padStart(2, "0") };
  }
  return { label: s, start: null, ym: s.toLowerCase() };
}

function day(v) {
  const s = String(v == null ? "" : v).trim();
  if (s === "" || isNaN(Number(s))) return null;
  return new Date(Math.round((Number(s) - 25569) * 86400000)).toISOString().slice(0, 10);
}

// Mobile numbers come out of the sheet as 8.299454631E9.
function mobile(v) {
  const s = String(v == null ? "" : v).trim();
  if (s === "") return null;
  if (!isNaN(Number(s))) return String(Math.round(Number(s)));
  return s;
}

function driveId(url) {
  const m = /[?&]id=([^&]+)/.exec(String(url || ""));
  return m ? m[1] : null;
}

const text = v => { const s = String(v == null ? "" : v).trim(); return s === "" ? null : s; };

// The same identity the POM page uses to match a row to its Awarded Data
// entry, with the month added so a repeated post in another month is not
// taken for the same one.
function keyOf(r) {
  return [month(r[0]).ym, mobile(r[2]), r[1], r[10], r[4]]
    .map(x => String(x == null ? "" : x).trim().toLowerCase()).join("|");
}

const raw = sheet1(rawFile).slice(1).filter(r => r[0]);
const awarded = sheet1(awardedFile).slice(1).filter(r => r[0]);

const byKey = new Map();
raw.forEach((r, i) => {
  const k = keyOf(r);
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push({ row: r, line: i + 2 });
});

const awardedByKey = new Map();
awarded.forEach((r, i) => {
  const k = keyOf(r);
  if (!awardedByKey.has(k)) awardedByKey.set(k, []);
  awardedByKey.get(k).push({ row: r, line: i + 2 });
});

// When a post was entered more than once, the entry worth keeping is the one
// someone verified, then the one with a picture, then the latest.
function rank(a) {
  const r = a.row;
  return (r[20] === "Yes" ? 4 : 0) + (r[17] ? 2 : 0) + (Number(r[16]) || 0) / 1e6;
}

function base(r, ref) {
  const m = month(r[0]);
  return {
    month_label: m.label, month_start: m.start,
    full_name: text(r[1]) || "(no name)", mobile: mobile(r[2]), email: text(r[3]),
    school_name: text(r[4]), community: text(r[5]), circle_name: text(r[6]),
    block_name: text(r[7]), district_name: text(r[8]) || "(no district)", pm_name: text(r[9]),
    award_name: text(r[10]), award_category: text(r[11]), post_url: text(r[12]),
    post_score: text(r[13]) === null ? null : Number(r[13]),
    awarded: false, awarded_by: null, awarded_date: null, image_url: null,
    drive_file_id: null, uploaded_by: null, verified: false, verified_by: null,
    description: null, source_ref: ref
  };
}

function withAward(rec, a) {
  const r = a.row;
  rec.awarded = String(r[14]).trim() === "Yes";
  rec.awarded_by = text(r[15]);
  rec.awarded_date = day(r[16]);
  rec.image_url = text(r[17]);
  rec.drive_file_id = driveId(r[17]);
  rec.uploaded_by = text(r[19]);
  rec.verified = String(r[20]).trim() === "Yes";
  rec.verified_by = text(r[21]);
  rec.description = text(r[22]);
  rec.source_ref += " + awarded:" + a.line;
  return rec;
}

const out = [];
const extras = [];       // entered twice; the better one is kept
let paired = 0;

byKey.forEach((group, k) => {
  const entries = (awardedByKey.get(k) || []).slice().sort((x, y) => rank(y) - rank(x));
  group.forEach((g, i) => {
    const rec = base(g.row, "raw:" + g.line);
    if (entries[i]) { withAward(rec, entries[i]); paired++; }
    out.push(rec);
  });
  entries.slice(group.length).forEach(e => extras.push(e));
});

// An entry whose post is not in Raw Data still holds real work - an image, a
// verification - so it comes across as a row of its own.
const unplaced = [];
awardedByKey.forEach((list, k) => {
  if (byKey.has(k)) return;
  list.forEach(a => {
    out.push(withAward(base(a.row, "awarded:" + a.line), a));
    unplaced.push(a);
  });
});

fs.writeFileSync(outFile, JSON.stringify(out));

const count = (rows, f) => rows.reduce((m, r) => { const k = f(r); m[k] = (m[k] || 0) + 1; return m; }, {});
console.log("Raw Data rows            ", raw.length);
console.log("Awarded Data rows        ", awarded.length);
console.log("rows to import           ", out.length);
console.log("  pending (not awarded)  ", out.filter(r => !r.awarded).length);
console.log("  awarded                ", out.filter(r => r.awarded).length);
console.log("  verified               ", out.filter(r => r.verified).length);
console.log("  with an image          ", out.filter(r => r.image_url).length);
console.log("awarded entries paired   ", paired);
console.log("awarded, not in Raw Data ", unplaced.length, "(imported as their own rows)");
console.log("awarded entered twice    ", extras.length, "(the better entry kept; these are left out)");
console.log("by month                 ", JSON.stringify(count(out, r => r.month_label)));
console.log("districts                ", Object.keys(count(out, r => r.district_name)).length);
