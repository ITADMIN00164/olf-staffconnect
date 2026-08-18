/* OLF Staff Connect — SMART Goals / Review & Plan  ·  FRONTEND MODULE (smartgoal.js)
 * Ported from OLF_Plan_Tracker_v20.html. localStorage replaced by an Apps Script
 * (Google Sheets) backend over JSONP. Set CONFIG.GAS_WEB_APP_URL below after deploy.
 * Loaded as a plain <script> (like calendar.js); everything is wrapped in an IIFE
 * so it never collides with app.js / pom.js / calendar.js globals.
 */
(function () {
"use strict";

// ══════════════════════════════════════════════════
// DATA STORE
// ══════════════════════════════════════════════════
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKS = ['Week 1','Week 2','Week 3','Week 4','Week 5'];

function academicYearOptions() {
  // Start at the CURRENT academic year and go forward (no past years shown).
  const now = new Date();
  const startY = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  const years = [];
  for (let y = startY; y <= startY + 10; y++) years.push(`June ${y} - May ${y+1}`);
  return years;
}
// Stored value stays the full "June 2026 - May 2027"; this is the SHORT label only.
function ayLabel(full) {
  const m = /June (\d{4}) - May (\d{4})/.exec(full || '');
  if (!m) return full || '';
  return `June ${m[1].slice(-2)} - May ${m[2].slice(-2)}`;
}
// Full current academic year string, e.g. "June 2026 - May 2027".
function currentAcademicYear() {
  const now = new Date();
  return deriveAcademicYear(MONTHS[now.getMonth()], now.getFullYear());
}
// Year <select>: option VALUE is the full string (so saved data still matches),
// LABEL is the short "June 26 - May 27". opts:{emptyLabel,includeEmpty,selectCurrent}
function populateYearSelect(id, opts) {
  opts = opts || {};
  const el = document.getElementById(id); if (!el) return;
  const cur = el.value;
  let html = '';
  if (opts.includeEmpty !== false) html += `<option value="">${opts.emptyLabel || 'All Academic Years'}</option>`;
  html += academicYearOptions().map(y => `<option value="${esc(y)}">${esc(ayLabel(y))}</option>`).join('');
  el.innerHTML = html;
  if (cur) el.value = cur;
  else if (opts.selectCurrent) el.value = currentAcademicYear();
}
// derive an academic year label from a calendar month name + calendar year
function deriveAcademicYear(monthName, calYear) {
  const idx = MONTHS.indexOf(monthName); // 0=Jan..11=Dec
  // June(5)..Dec(11) -> start of academic year is calYear; Jan(0)..May(4) -> start is calYear-1
  const startY = idx >= 5 ? calYear : calYear - 1;
  return `June ${startY} - May ${startY+1}`;
}
// "June 2026 - May 2027" -> "AY:2026-27"
function academicYearShort(yearStr) {
  const m = /June (\d{4}) - May (\d{4})/.exec(yearStr||'');
  if (!m) return yearStr||'';
  return `AY:${m[1]}-${m[2].slice(-2)}`;
}
// given academic year string + a month name, resolve the correct calendar year and return "Month YYYY"
function monthYearLabel(yearStr, monthName) {
  if (!monthName) return '';
  const m = /June (\d{4}) - May (\d{4})/.exec(yearStr||'');
  if (!m) return monthName;
  const idx = MONTHS.indexOf(monthName);
  const calYear = idx >= 5 ? parseInt(m[1],10) : parseInt(m[2],10);
  return `${monthName} ${calYear}`;
}

const DEFAULT = {
  settings: {
    depts: ['IT OPs','Communications','Program','Finance'],
    members: [
      {id:'m1',name:'IP',dept:'IT OPs',role:'dept_head'},
      {id:'m2',name:'MK',dept:'IT OPs',role:'member'},
      {id:'m3',name:'HT',dept:'IT OPs',role:'member'},
      {id:'m4',name:'VP',dept:'IT OPs',role:'member'},
      {id:'m5',name:'VT',dept:'IT OPs',role:'member'},
      {id:'m6',name:'SS',dept:'IT OPs',role:'member'},
      {id:'m7',name:'RD',dept:'IT OPs',role:'member'}
    ],
    admins: [
      {id:'a1', name:'Admin', email:'admin@example.com'}
    ],
    goalNames: ['Program Implementation','Support and Help','Roadmap Development','Team Monitoring'],
    categories: ['BA & Product','Organisation','Dist Support','App Support','Program Support','User Awareness and Training','Issues','Reviews','Meetings','Monitoring','Support']
  },
  goals: [],
  tasks: [],
  reviews: [],
  uiPrefs: { hiddenPlanCols: [] }
};

let DB = JSON.parse(JSON.stringify(DEFAULT));

// ── MIGRATIONS (keep older saved data usable) ──
(function migrate() {
  let changed = false;
  if (!DB.settings) DB.settings = JSON.parse(JSON.stringify(DEFAULT.settings));
  if (!DB.settings.admins) { DB.settings.admins = JSON.parse(JSON.stringify(DEFAULT.settings.admins)); changed = true; }
  if (!DB.uiPrefs) { DB.uiPrefs = {hiddenPlanCols:[]}; changed = true; }
  // members: string[] -> {name,dept}[] -> ensure role + id
  if (DB.settings.members && DB.settings.members.length && typeof DB.settings.members[0] === 'string') {
    DB.settings.members = DB.settings.members.map(m => ({name:m, dept:'', role:'member'}));
    changed = true;
  }
  DB.settings.members = (DB.settings.members||[]).map(m => {
    const nm = {id: m.id || uid(), name: m.name, dept: m.dept||'', role: m.role || 'member'};
    if (!m.id || !m.role) changed = true;
    return nm;
  });
  DB.settings.admins = (DB.settings.admins||[]).map(a => {
    if (!a.id) changed = true;
    return {id: a.id || uid(), name: a.name, email: a.email||''};
  });
  // goals: old schema had period/target/subcat/desc, multi-member strings, no year/weightage
  DB.goals = (DB.goals||[]).map(g => {
    if (g.year && typeof g.weightage !== 'undefined') {
      if (typeof g.description === 'undefined') { g.description = ''; changed = true; }
      return g; // already migrated
    }
    changed = true;
    let year = g.year;
    if (!year && g.period) {
      const m = /([A-Za-z]+)-(\d{4})/.exec(g.period);
      if (m) year = deriveAcademicYear(m[1].length>3 ? m[1] : MONTHS.find(mm=>mm.startsWith(m[1]))||m[1], parseInt(m[2],10));
    }
    if (!year) year = academicYearOptions()[2];
    let member = g.member || '';
    if (member.includes('/')) member = member.split('/')[0].trim(); // pick first member; rest should be re-entered per-member
    return {
      id: g.id || uid(), year, dept: g.dept||'', member,
      goal: g.goal||'', weightage: g.weightage || 25, description: g.description || '',
      cat: g.cat||'', particulars: g.particulars || g.subcat || g.desc || '',
      maxScore: g.maxScore || 10
    };
  });
  // tasks: old schema had period text instead of year/month
  DB.tasks = (DB.tasks||[]).map(t => {
    if (t.year && t.month) return t;
    changed = true;
    let year = t.year, month = t.month;
    if (!month && t.period) {
      const m = /([A-Za-z]+)-(\d{4})/.exec(t.period);
      if (m) {
        const abbr = m[1];
        month = MONTHS.find(mm => mm.startsWith(abbr)) || abbr;
        year = deriveAcademicYear(month, parseInt(m[2],10));
      }
    }
    if (!month) month = 'May';
    if (!year) year = academicYearOptions()[2];
    return {
      id: t.id || uid(), year, month, week: t.week || 'Week 1',
      dept: t.dept||'', member: t.member||'',
      goal: t.goal||'', cat: t.cat||'', subcat: t.subcat||'', action: t.action||'',
      planned: t.planned||'Yes', plannedItems: t.plannedItems ?? '',
      est: t.est||0, tgtDate: t.tgtDate||'',
      compDate: t.compDate||'', actualHrs: t.actualHrs||0, actualItems: t.actualItems ?? '',
      status: t.status||'Planned', deviation: t.deviation||'', helpNeeded: t.helpNeeded||'', revisedTgtDate: t.revisedTgtDate||'',
      managerGrade: t.managerGrade||'', managerComment: t.managerComment||''
    };
  });
  // reviews: old schema items keyed by goalId with selfScore/mgrScore, no target/actual/remark/weightage
  DB.reviews = (DB.reviews||[]).map(r => {
    let year = r.year, month = r.month;
    if ((!year || !month) && r.period) {
      const m = /([A-Za-z]+)-(\d{4})/.exec(r.period);
      if (m) {
        if (!month) month = MONTHS.find(mm => mm.startsWith(m[1])) || m[1];
        if (!year) year = deriveAcademicYear(month, parseInt(m[2],10));
      }
    }
    if (!year) year = academicYearOptions()[2];
    if (!month) month = '';
    const items = (r.items||[]).map(i => {
      if (typeof i.memberScore !== 'undefined') return i;
      changed = true;
      const g = DB.goals.find(x=>x.id===i.goalId) || {};
      return {
        goalItemId: i.goalId, goal: i.goal||g.goal||'', weightage: g.weightage||25,
        cat: i.cat||g.cat||'', particulars: i.subcat||g.particulars||'',
        maxScore: i.maxScore||g.maxScore||10,
        target:'', actual:'', remark: i.remarks||'',
        memberScore: i.selfScore||0, mgrScore: i.mgrScore||0
      };
    });
    if (!r.year || !r.month) changed = true;
    return {id:r.id||uid(), year, month, dept:r.dept||'', member:r.member||'', reviewer:r.reviewer||'', date:r.date||'', remarks:r.remarks||'', sheetBLink:r.sheetBLink||'', helpNeeded:r.helpNeeded||'', areasOfImprovement:r.areasOfImprovement||'', items};
  });
  // one-time cleanup: remove IT OPs sample/legacy data from any previously saved browser data.
  // Data for other departments (e.g. Content/Communications) is left untouched.
  if (!DB._purgedITOpsV12) {
    const beforeG = DB.goals.length, beforeT = DB.tasks.length, beforeR = DB.reviews.length;
    DB.goals = DB.goals.filter(g => g.dept !== 'IT OPs');
    DB.tasks = DB.tasks.filter(t => t.dept !== 'IT OPs');
    DB.reviews = DB.reviews.filter(r => r.dept !== 'IT OPs');
    if (DB.goals.length !== beforeG || DB.tasks.length !== beforeT || DB.reviews.length !== beforeR) changed = true;
    DB._purgedITOpsV12 = true;
    changed = true;
  }
  if (changed) save();
})();

let currentDept = '';
let editingTaskId = null;
let editingGoalId = null;
let editingReviewId = null;

// ══════════════════════════════════════════════════
// ROLE SYSTEM  (will be replaced by Google Auth later)
// ══════════════════════════════════════════════════
const ROLES = { ADMIN:'admin', DEPT_HEAD:'dept_head', MEMBER:'member' };
let currentUser = { name:'Admin', dept:'', role: ROLES.ADMIN };

function applyRoleFilter(items, type) {
  if (currentUser.role === ROLES.ADMIN) return items;
  if (currentUser.role === ROLES.DEPT_HEAD) return items.filter(i => i.dept === currentUser.dept);
  if (currentUser.role === ROLES.MEMBER) return items.filter(i => i.member === currentUser.name);
  return [];
}

function canAccessSettings() { return currentUser.role === ROLES.ADMIN; }
function canAccessReviews()  { return true; }
// SMART Goal add/edit/delete: the goal's owner, that dept's head, or an admin.
function canEditGoal(g) {
  if (currentUser.role === ROLES.ADMIN) return true;
  if (currentUser.role === ROLES.DEPT_HEAD && g && g.dept === currentUser.dept) return true;
  if (g && g.member === currentUser.name && currentUser.name) return true; // owner
  return false;
}
function canEditTask(task) {
  if (currentUser.role === ROLES.ADMIN) return true;
  if (currentUser.role === ROLES.DEPT_HEAD && task.dept === currentUser.dept) return true;
  if (currentUser.role === ROLES.MEMBER && task.member === currentUser.name) return true;
  return false;
}
function canEditMemberScore(r) {
  // The MEMBER column is the person's own self-assessment. Admin can edit any;
  // otherwise only the member themselves, on their OWN review, regardless of
  // role -- so a Dept Head fills in their own member score too. It is never
  // editable by that person's dept head or reporting manager.
  if (currentUser.role === ROLES.ADMIN) return true;
  return !!(r && currentUser.name && r.member === currentUser.name);
}
function canEditMgrScore(r) {
  if (!r) return false;
  if (currentUser.role === ROLES.ADMIN) return true;
  // A Dept Head scores the Manager column for the OTHER members of their dept,
  // but NOT their own review: a Dept Head's own manager score belongs to that
  // Dept Head's reporting manager, never to themselves.
  if (currentUser.role === ROLES.DEPT_HEAD && r.dept === currentUser.dept && r.member !== currentUser.name) return true;
  if (isManagerOf(r.member, r.dept)) return true; // assigned reporting manager
  return false;
}

// ── Manager relationship (assigned per-member, not a role) ──────────
// The logged-in user's email lives in the module var currentEmail (set by
// resolveUser at login). A person is the 'manager' of a member iff that
// member's managerEmail matches currentEmail. This is a RELATIONSHIP layered
// on top of whatever Role the person holds; it never replaces Role.
function _lc(x) { return String(x == null ? '' : x).trim().toLowerCase(); }
function _myEmail() { return _lc(currentEmail); }
function memberRecordByName(name, dept) {
  var ms = (DB.settings && DB.settings.members) || [];
  var i;
  for (i = 0; i < ms.length; i++) { if (ms[i].name === name && (!dept || ms[i].dept === dept)) return ms[i]; }
  for (i = 0; i < ms.length; i++) { if (ms[i].name === name) return ms[i]; }
  return null;
}
function isManagerOf(memberName, dept) {
  var me = _myEmail(); if (!me || !memberName) return false;
  var m = memberRecordByName(memberName, dept);
  return !!(m && _lc(m.managerEmail) === me);
}
function myReportees() {
  var me = _myEmail(); if (!me) return [];
  return ((DB.settings && DB.settings.members) || []).filter(function (m) { return _lc(m.managerEmail) === me; });
}
function amIManager() { return myReportees().length > 0; }
// A review is visible if: admin (all) · dept head (own dept) · it's your own ·
// or you are the member's assigned reporting manager (works across departments).
function canViewReview(r) {
  if (!r) return false;
  if (currentUser.role === ROLES.ADMIN) return true;
  if (currentUser.role === ROLES.DEPT_HEAD && r.dept === currentUser.dept) return true;
  if (r.member === currentUser.name && currentUser.name) return true;
  if (isManagerOf(r.member, r.dept)) return true;
  return false;
}

function renderUserBadge() {
  const roleColors = { admin:'var(--brand)', dept_head:'var(--blue)', member:'var(--green)' };
  const roleLabels = { admin:'Admin', dept_head:'Dept Head', member:'Member' };
  document.getElementById('user-badge').innerHTML = `
    <span style="font-size:11px;color:var(--text3);margin-right:6px">${esc(currentUser.name)}</span>
    <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:${roleColors[currentUser.role]}20;color:${roleColors[currentUser.role]};border:1px solid ${roleColors[currentUser.role]}40">${roleLabels[currentUser.role]}</span>
    <button onclick="openRoleSwitcher()" title="Switch role (testing only)" style="margin-left:8px;background:none;border:1px solid var(--border2);border-radius:var(--radius);padding:2px 7px;font-size:10px;color:var(--text3);cursor:pointer">⇄ Switch</button>
  `;
  document.getElementById('nav-tab-settings').style.display = canAccessSettings() ? '' : 'none';
  document.getElementById('nav-tab-reviews').style.display = '';
  if (currentUser.role === ROLES.MEMBER) currentDept = '';
  else if (currentUser.role === ROLES.DEPT_HEAD && !currentDept) currentDept = currentUser.dept;
}

function openRoleSwitcher() { openModal('role-switcher-modal'); renderRoleSwitcher(); }
function renderRoleSwitcher() {
  const members = DB.settings.members;
  const admins = DB.settings.admins;
  const rows = [
    ...admins.map(a => ({label:`Admin — ${a.name}`, role:'admin', name:a.name, dept:''})),
    ...members.filter(m=>m.role==='dept_head').map(m => ({label:`Dept Head — ${m.name} (${m.dept||'no dept'})`, role:'dept_head', name:m.name, dept:m.dept})),
    ...members.filter(m=>m.role!=='dept_head').map(m => ({label:`Member — ${m.name} (${m.dept||'no dept'})`, role:'member', name:m.name, dept:m.dept}))
  ];
  document.getElementById('role-switcher-list').innerHTML = rows.map((r,i) => `
    <div onclick="switchRole(${i})" style="padding:10px 14px;border-radius:var(--radius);cursor:pointer;border:1px solid ${currentUser.name===r.name&&currentUser.role===r.role?'var(--brand)':'var(--border)'};background:${currentUser.name===r.name&&currentUser.role===r.role?'var(--brand-lt)':'var(--surface)'};margin-bottom:6px;transition:all .12s">
      <div style="font-size:13px;font-weight:600;color:var(--text)">${esc(r.label)}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px">
        ${r.role==='admin'?'All depts · All members · Settings · Reviews':r.role==='dept_head'?`All tasks in ${r.dept} · Reviews`:`Own tasks only`}
      </div>
    </div>`).join('');
  window._roleSwitcherRows = rows;
}
function switchRole(idx) {
  const r = window._roleSwitcherRows[idx];
  var _mrec = memberRecordByName(r.name, r.dept);
  currentEmail = (_mrec && _mrec.email) ? _mrec.email : '';
  currentUser = {name:r.name, dept:r.dept, role:r.role};
  currentDept = r.role === 'dept_head' ? r.dept : '';
  closeModal('role-switcher-modal');
  renderUserBadge();
  renderSidebar();
  renderPage(getCurrentPageId());
  toast(`Viewing as: ${r.label}`);
}

function save() { saveUiPrefs(); saveSnapshot(); if (syncEnabled) syncDiff(); }

// ── HELPERS ──
function uid() { return 'id_' + Math.random().toString(36).slice(2,10); }
function memberNames() { return DB.settings.members.map(m => m.name); }

/* ── MEMBER RENAME CASCADE ──────────────────────────────────────────
   goals, tasks and reviews all store the member as a NAME STRING, not
   as a member id. Renaming somebody in Settings therefore used to
   orphan every one of their existing rows: the member row got the new
   name while the linked rows kept pointing at the old one.

   This rewrites the name in every place it is stored:
     goals.member, tasks.member,
     reviews.member, reviews.reviewer,
     members.manager_name   (the renamed person may manage others)

   It only touches the in-memory DB. syncDiff() then sees those rows as
   changed and queues each one through the normal outbox, so the writes
   are batched, retried, and reported by the usual save toast.

   Returns the number of rows changed. */
function cascadeMemberRename(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return 0;
    var touched = 0;

    (DB.goals || []).forEach(function (g) {
        if (g.member === oldName) { g.member = newName; touched++; }
    });
    (DB.tasks || []).forEach(function (t) {
        if (t.member === oldName) { t.member = newName; touched++; }
    });
    (DB.reviews || []).forEach(function (r) {
        var hit = false;
        if (r.member === oldName) { r.member = newName; hit = true; }
        // The renamed person may also be the reviewer on someone else's review.
        if (r.reviewer === oldName) { r.reviewer = newName; hit = true; }
        if (hit) touched++;
    });
    ((DB.settings && DB.settings.members) || []).forEach(function (m) {
        if (m.managerName === oldName) { m.managerName = newName; touched++; }
    });

    return touched;
}

/* One-off repair for renames made before the cascade existed (including
   ones made directly in the Supabase table editor, which the app never
   sees). Run from the browser console on the HO Plan & Review page:

     sgRenameMemberEverywhere('mahadevirathod.olf@gmail.com', 'Mahadevi Rathod')

   It rewrites the linked rows only - the members row itself is assumed
   to already carry the new name. */
window.sgRenameMemberEverywhere = function (oldName, newName) {
    var n = cascadeMemberRename(oldName, newName);
    if (!n) {
        try { toast('No linked records found for "' + oldName + '"'); } catch (e) {}
        return 0;
    }
    save();
    populateAllSelects(); renderSettings(); renderSidebar();
    try { renderDashboard(); renderSmartGoals(); renderPlan(); renderReviews(); } catch (e) {}
    try { toast('Renamed ' + n + ' linked record(s) to "' + newName + '"'); } catch (e) {}
    return n;
};
function membersInDept(dept) { return DB.settings.members.filter(m => !dept || m.dept === dept); }

function statusBadge(s) {
  const map = {Planned:'plan', Completed:'done','In Process':'ip', Pending:'pend','On Hold':'hold', Cancelled:'cancel'};
  return `<span class="badge badge-${map[s]||'hold'}">${s||'—'}</span>`;
}
function planBadge(p) { return `<span class="badge badge-${p==='Yes'?'yes':'no'}">${p}</span>`; }
function goalColor(g) {
  const map = {'Program Implementation':'gp-prog','Support and Help':'gp-supp','Roadmap Development':'gp-road','Team Monitoring':'gp-team'};
  return map[g] || 'gp-def';
}
function roleBadge(role) {
  const map = {member:['Member','badge-role-member'], dept_head:['Dept Head','badge-role-depthead'], admin:['Admin','badge-role-admin']};
  const [label,cls] = map[role]||map.member;
  return `<span class="badge ${cls}">${label}</span>`;
}
function pctColor(p) { return p>=80?'#3F6B2A':p>=50?'#C07C0A':'#C0392B'; }
function scoreClass(sc,mx) { const r=mx>0?sc/mx:0; return r>=.8?'score-hi':r>=.5?'score-mid':'score-lo'; }
// Render the Sheet B link callout as "🔗 Sheet B Link - Click Here". "Click Here" is the link when the
// value is a URL — a value without a scheme (e.g. "docs.google.com/…") is treated as https; a non-http
// scheme (javascript:, data:, …) is not linked and the raw value is shown instead so it can't inject.
function sgSheetBLinkHtml(raw) {
  const v = (raw==null?'':String(raw)).trim();
  if (!v) return '';
  const hasScheme = /^[a-z][a-z0-9+.\-]*:/i.test(v);
  const clickable = !hasScheme || /^https?:\/\//i.test(v);
  const href = hasScheme ? v : ('https://' + v);
  const linkPart = clickable
    ? `<a href="${esc(href)}" target="_blank" rel="noopener" style="color:var(--blue);font-weight:600">Click Here</a>`
    : `<span style="word-break:break-all">${esc(v)}</span>`;
  return `<p style="font-size:12px;color:var(--text2);margin:0;padding:8px 12px;background:var(--surface2);border-radius:var(--radius);border-left:3px solid var(--blue)">🔗 <span style="font-weight:600;color:var(--text)">Sheet B Link</span> - ${linkPart}</p>`;
}
// Render the overall-remark callout as "📝 Overall Performance - <what the user entered>".
function sgOverallHtml(remarks) {
  const v = (remarks==null?'':String(remarks)).trim();
  if (!v) return '';
  return `<p style="font-size:12px;color:var(--text2);margin:0;padding:8px 12px;background:var(--surface2);border-radius:var(--radius);border-left:3px solid var(--brand);overflow-wrap:anywhere;word-break:break-word">📝 <span style="font-weight:600;color:var(--text)">Overall Performance</span> - ${esc(v)}</p>`;
}
function formatDate(d) { if(!d) return '—'; const dt=new Date(d); if(isNaN(dt)) return d; const mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${String(dt.getDate()).padStart(2,'0')}-${mo[dt.getMonth()]}-${String(dt.getFullYear()).slice(-2)}`; }
function esc(s) { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
// safe to embed inside a single-quoted JS string literal that itself sits inside an HTML onclick="..." attribute
function escJs(s) { return esc(String(s??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/[\r\n]+/g,' ')); }
function toast(msg) { const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2500); }

// groups a flat list of goal-items (or review-items) by SMART Goal name, preserving weightage
function groupByGoal(items) {
  const order = []; const map = {};
  items.forEach(it => {
    const key = it.goal;
    if (!map[key]) { map[key] = []; order.push(key); }
    map[key].push(it);
  });
  return order.map(k => ({ goal:k, weightage: map[k][0].weightage || 0, rows: map[k] }));
}

function refreshDataLists() {
  document.getElementById('members-list').innerHTML = memberNames().map(m=>`<option value="${esc(m)}">`).join('');
  document.getElementById('goalnames-list').innerHTML = DB.settings.goalNames.map(g=>`<option value="${esc(g)}">`).join('');
  document.getElementById('cats-list').innerHTML = DB.settings.categories.map(c=>`<option value="${esc(c)}">`).join('');
}

function populateSelect(id, items, emptyLabel='Select…') {
  const el=document.getElementById(id); if(!el) return;
  const cur=el.value;
  el.innerHTML=`<option value="">${emptyLabel}</option>`+items.map(i=>`<option value="${esc(i)}">${esc(i)}</option>`).join('');
  if(cur) el.value=cur;
}

function populateAllSelects() {
  refreshDataLists();
  const {depts} = DB.settings, members = memberNames(), years = academicYearOptions();
  populateSelect('global-dept', depts, 'All Departments');

  populateYearSelect('sg-year-filter', {emptyLabel:'All Academic Years', selectCurrent:true});
  populateSelect('sg-dept-filter', depts, 'Select Department…');
  setSgMemberOptions();

  populateYearSelect('mp-year', {emptyLabel:'Academic Year…', selectCurrent:true});
  populateSelect('mp-month', MONTHS, 'Month…');
  populateSelect('mp-week', WEEKS, 'All Weeks');
  populateSelect('mp-dept', depts, 'Department…');
  // mp-goal & mp-member are scoped to the selected department + role
  refreshMpDeptScopedDropdowns();

  populateYearSelect('rv-year', {emptyLabel:'All Academic Years', selectCurrent:true});
  populateSelect('rv-month', MONTHS, 'All Months');
  populateSelect('rv-dept', depts, 'All Depts');
  populateSelect('rv-member', members, 'Select Member…');

  populateYearSelect('tf-year', {emptyLabel:'Select…'});
  populateSelect('tf-month', MONTHS, 'Select…');
  populateSelect('tf-week', WEEKS, 'Select…');
  populateSelect('tf-dept', depts, 'Select Department…');

  populateYearSelect('gf-year', {emptyLabel:'Select…'});
  populateSelect('gf-dept', depts, 'Select…');

  populateYearSelect('rf-year', {emptyLabel:'Select…'});
  populateSelect('rf-month', MONTHS, 'Select…');
  populateSelect('rf-dept', depts, 'Select…');

  populateYearSelect('dash-year-filter', {emptyLabel:'All Academic Years', selectCurrent:true});
  populateSelect('dash-month-filter', MONTHS, 'All Months');
  populateSelect('dash-dept-filter', depts, 'All Departments');
}

// Role-scoped member names for dept-scoped dropdowns:
//   admin -> members in the given dept; dept_head -> own dept; member -> self only.
function scopedMemberNames(dept) {
  if (currentUser.role === ROLES.MEMBER) return currentUser.name ? [currentUser.name] : [];
  if (currentUser.role === ROLES.DEPT_HEAD) return membersInDept(currentUser.dept).map(function(m){return m.name;});
  return membersInDept(dept).map(function(m){return m.name;});
}

// Reviews-only member scope: like scopedMemberNames, but ALSO includes the
// user themselves and everyone who reports to them (their reportees), even
// across departments. Used only by the Reviews tab so a Manager can pick a
// reportee to view/score. Does NOT widen Monthly Plan / SMART Goals scope.
function reviewScopedMemberNames(dept) {
  if (currentUser.role === ROLES.ADMIN) return membersInDept(dept).map(function(m){return m.name;});
  var set = {}, order = [];
  function add(n){ if (n && !set[n]) { set[n] = 1; order.push(n); } }
  if (currentUser.role === ROLES.DEPT_HEAD) membersInDept(currentUser.dept).forEach(function(m){ add(m.name); });
  add(currentUser.name);
  myReportees().forEach(function(m){ add(m.name); });
  return order;
}

// Monthly Plan: SMART Goal + Member dropdowns follow the selected department.
// The plan is view-open — EVERY role (members included) can pick any member of
// the selected department and view their plan. A member viewing a teammate sees
// read-only rows; viewing their own rows, they're editable. That edit gate is
// enforced per-row by canEditTask() in planCellHtml, not by hiding names here.
function refreshMpDeptScopedDropdowns() {
  const deptEl = document.getElementById('mp-dept'); if (!deptEl) return;
  const dept = deptEl.value || '';
  const goalPool = DB.goals.filter(function(g){ return !dept || g.dept === dept; });
  populateSelect('mp-goal', [...new Set(goalPool.map(function(g){return g.goal;}))], 'All SMART Goals');
  populateSelect('mp-member', membersInDept(dept).map(function(m){return m.name;}), 'All Members');
}
function onMpDeptChange() { refreshMpDeptScopedDropdowns(); renderPlan(); }

// Auto-populate the landing state of filters: current AY, current month, and
// (for non-admins) the user's own department. Only fills EMPTY fields, so it
// never overrides a selection the user already made.
function applyFilterDefaults() {
  const nowMonth = MONTHS[new Date().getMonth()];
  const ay = currentAcademicYear();
  const isAdmin = currentUser.role === ROLES.ADMIN;
  const myDept = currentUser.dept || '';

  ['sg-year-filter','mp-year','rv-year','dash-year-filter'].forEach(function(id){
    const el = document.getElementById(id); if (el && !el.value) el.value = ay;
  });
  ['mp-month','rv-month','dash-month-filter'].forEach(function(id){
    const el = document.getElementById(id); if (el && !el.value) el.value = nowMonth;
  });
  if (!isAdmin && myDept) {
    if (!currentDept) currentDept = myDept;
    var _isMgr = amIManager();
    ['global-dept','mp-dept','sg-dept-filter','rv-dept','dash-dept-filter'].forEach(function(id){
      if (id === 'rv-dept' && _isMgr) return; // manager: keep review dept open for cross-dept reportees
      const el = document.getElementById(id); if (el && !el.value) el.value = myDept;
    });
  }
  // Dependent, dept-scoped dropdowns
  if (typeof setSgMemberOptions === 'function') setSgMemberOptions();
  const rvDept = (document.getElementById('rv-dept') || {}).value || '';
  if (document.getElementById('rv-member')) populateSelect('rv-member', reviewScopedMemberNames(rvDept), 'Select Member…');
  refreshMpDeptScopedDropdowns();
}

function populateTaskMemberDropdown() {
  const dept = document.getElementById('tf-dept').value;
  const el = document.getElementById('tf-member');
  const curVal = el.value;
  const filtered = scopedMemberNames(dept);
  el.innerHTML = `<option value="">Select Member…</option>` + filtered.map(n => `<option value="${esc(n)}"${n===curVal?' selected':''}>${esc(n)}</option>`).join('');
}

function populateGoalMemberDropdown() {
  const dept = document.getElementById('gf-dept').value;
  const el = document.getElementById('gf-member');
  const curVal = el.value;
  const filtered = scopedMemberNames(dept);
  el.innerHTML = `<option value="">Select…</option>` + filtered.map(n => `<option value="${esc(n)}"${n===curVal?' selected':''}>${esc(n)}</option>`).join('');
}

function populateReviewMemberDropdown() {
  // reviews-scoped so a Manager editing a reportee's review sees a valid option
  const dept = document.getElementById('rf-dept').value;
  const el = document.getElementById('rf-member');
  const curVal = el.value;
  const filtered = reviewScopedMemberNames(dept);
  el.innerHTML = `<option value="">Select…</option>` + filtered.map(n => `<option value="${esc(n)}"${n===curVal?' selected':''}>${esc(n)}</option>`).join('');
}

// SMART Goal options available for a given dept+member (used in Add Task modal)
// SMART Goal dropdown in Add Task is strictly scoped to the selected Dept + Member —
// since SMART Goals are individual per member, we never fall back to a global/org-wide list.
function populateTaskGoalDropdown() {
  const dept = document.getElementById('tf-dept').value;
  const member = document.getElementById('tf-member').value;
  const el = document.getElementById('tf-goal');
  const cur = el.value;
  if (!dept || !member) {
    el.innerHTML = `<option value="">Select Department & Member first…</option>`;
    populateCatDropdown();
    return;
  }
  const goals = DB.goals.filter(g => g.dept===dept && g.member===member);
  const names = [...new Set(goals.map(g=>g.goal))];
  if (!names.length) {
    el.innerHTML = `<option value="">No SMART Goals found for this member</option>`;
    populateCatDropdown();
    return;
  }
  el.innerHTML = `<option value="">Select…</option>` + names.map(n=>`<option value="${esc(n)}"${n===cur?' selected':''}>${esc(n)}</option>`).join('');
  populateCatDropdown();
}

// Category dropdown is likewise scoped to the selected Dept + Member + SMART Goal only.
function populateCatDropdown() {
  const dept = document.getElementById('tf-dept').value;
  const member = document.getElementById('tf-member').value;
  const goal = document.getElementById('tf-goal').value;
  const el = document.getElementById('tf-cat');
  if (!dept || !member || !goal) {
    el.innerHTML = `<option value="">Select SMART Goal first…</option>`;
    return;
  }
  const goals = DB.goals.filter(g => g.dept===dept && g.member===member && g.goal===goal);
  const cats = [...new Set(goals.map(g=>g.cat))];
  if (!cats.length) {
    el.innerHTML = `<option value="">No categories found</option>`;
    return;
  }
  el.innerHTML = `<option value="">Select…</option>` + cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
}

// ── GLOBAL DEPT CHANGE ──
function changeDept() {
  currentDept = document.getElementById('global-dept').value;
  const deptLabel = currentDept ? `— ${esc(currentDept)}` : '';
  document.getElementById('dash-dept-label').textContent = `Overview ${deptLabel}`;
  document.getElementById('sg-dept-label').textContent = `Define goals per member ${deptLabel}`;
  document.getElementById('mp-dept-label').textContent = `Week-wise task tracking ${deptLabel}`;
  document.getElementById('rv-dept-label').textContent = `Score each SMART Goal item ${deptLabel}`;
  const ddf = document.getElementById('dash-dept-filter'); if (ddf) ddf.value = currentDept;
  renderPage(getCurrentPageId());
}

function getCurrentPageId() {
  const active = document.querySelector('.page.active');
  return active.id.replace('page-','');
}

// ── PAGE NAV ──
function showPage(id) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  const tabMap={dashboard:0,'smart-goals':1,'monthly-plan':2,reviews:3,settings:4};
  document.querySelectorAll('.nav-tab')[tabMap[id]]?.classList.add('active');
  renderPage(id);
}

function renderPage(id) {
  if (id==='settings' && !canAccessSettings()) { showPage('dashboard'); toast('Access restricted — Admins only'); return; }
  if(id==='dashboard') renderDashboard();
  else if(id==='smart-goals') renderSmartGoals();
  else if(id==='monthly-plan') renderPlan();
  else if(id==='reviews') renderReviews();
  else if(id==='settings') renderSettings();
}

// ── DASHBOARD ──
function deptsInScope(deptFilter) {
  let depts;
  if (currentUser.role === ROLES.ADMIN) depts = DB.settings.depts.slice();
  else if (currentUser.role === ROLES.DEPT_HEAD) depts = [currentUser.dept];
  else depts = currentUser.dept ? [currentUser.dept] : [];
  if (deptFilter) depts = depts.filter(d => d === deptFilter);
  return depts;
}

function svgDonut(segments, size, thickness) {
  size = size || 120; thickness = thickness || 16;
  const total = segments.reduce((a,s)=>a+(s.value||0),0);
  const r = (size - thickness) / 2;
  const c = size/2;
  const circumference = 2*Math.PI*r;
  let offset = 0;
  let circles = '';
  if (total <= 0) {
    circles = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${thickness}"/>`;
  } else {
    segments.forEach(s => {
      if (!s.value) return;
      const frac = s.value/total;
      const dash = frac*circumference;
      circles += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${thickness}" stroke-dasharray="${dash.toFixed(2)} ${(circumference-dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${c} ${c})"/>`;
      offset += dash;
    });
  }
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="flex-shrink:0">${circles}<text x="${c}" y="${c}" text-anchor="middle" dominant-baseline="central" font-size="18" font-weight="800" fill="var(--text)">${total}</text></svg>`;
}

function donutLegend(segments) {
  return segments.map(s => `<div style="display:flex;align-items:center;gap:7px;font-size:12px;margin-bottom:6px">
    <span style="width:10px;height:10px;border-radius:2px;background:${s.color};flex-shrink:0"></span>
    <span style="flex:1;color:var(--text2)">${esc(s.label)}</span>
    <span style="font-weight:700">${s.value}</span>
  </div>`).join('');
}

function renderDashboard() {
  const year = document.getElementById('dash-year-filter')?.value || '';
  const month = document.getElementById('dash-month-filter')?.value || '';
  const deptFilter = document.getElementById('dash-dept-filter')?.value || currentDept;

  let tasks = DB.tasks;
  tasks = applyRoleFilter(tasks, 'task');
  if (deptFilter) tasks = tasks.filter(t=>t.dept===deptFilter);
  if (year) tasks = tasks.filter(t=>t.year===year);
  if (month) tasks = tasks.filter(t=>t.month===month);

  const total=tasks.length, done=tasks.filter(t=>t.status==='Completed').length;
  const ip=tasks.filter(t=>t.status==='In Process').length;
  const pend=tasks.filter(t=>t.status==='Pending').length;
  const planned=tasks.filter(t=>t.planned==='Yes').length;
  const unplanned=tasks.filter(t=>t.planned==='No').length;
  const pct=total>0?Math.round(done/total*100):0;

  document.getElementById('dash-metrics').innerHTML=`
    <div class="metric-card"><div class="metric-label">Total Tasks</div><div class="metric-val">${total}</div></div>
    <div class="metric-card"><div class="metric-label">Completed</div><div class="metric-val" style="color:var(--green)">${done}</div>
      <div class="bar"><div class="bar-fill" style="width:${pct}%;background:var(--green)"></div></div>
      <div class="metric-sub">${pct}% completion</div></div>
    <div class="metric-card"><div class="metric-label">In Process</div><div class="metric-val" style="color:var(--amber)">${ip}</div></div>
    <div class="metric-card"><div class="metric-label">Pending</div><div class="metric-val" style="color:var(--red)">${pend}</div></div>
    <div class="metric-card"><div class="metric-label">Planned</div><div class="metric-val">${planned}</div><div class="metric-sub">of ${total}</div></div>
    <div class="metric-card"><div class="metric-label">Unplanned</div><div class="metric-val" style="color:var(--amber)">${unplanned}</div></div>`;

  // ── Monthly Plan Progress — by Department ──
  const scopeDepts = deptsInScope(deptFilter);
  let planRows = '';
  const aggStatus = {Completed:0,'In Process':0,Pending:0,'On Hold':0,Cancelled:0};
  scopeDepts.forEach(d => {
    const dt = tasks.filter(t=>t.dept===d);
    const dDone = dt.filter(t=>t.status==='Completed').length;
    const dPct = dt.length>0?Math.round(dDone/dt.length*100):0;
    dt.forEach(t=>{ if (aggStatus[t.status]!==undefined) aggStatus[t.status]++; });
    planRows += `<tr>
      <td style="font-weight:600">${esc(d)}</td>
      <td style="text-align:center">${dt.length}</td>
      <td style="text-align:center;color:var(--green)">${dDone}</td>
      <td style="text-align:center">
        <div style="display:flex;align-items:center;gap:6px;justify-content:center">
          <div class="bar" style="width:56px;height:6px"><div class="bar-fill" style="width:${dPct}%;background:${pctColor(dPct)}"></div></div>
          <span style="font-size:11px;font-weight:700">${dPct}%</span>
        </div>
      </td>
    </tr>`;
  });
  if (!scopeDepts.length) planRows = `<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:16px">No department in scope for your role</td></tr>`;
  const planTableHtml = `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Department</th><th style="text-align:center">Total Tasks</th><th style="text-align:center">Completed</th><th style="text-align:center">% Complete</th></tr></thead>
    <tbody>${planRows}</tbody>
  </table></div>`;
  const planSegments = [
    {label:'Completed', value:aggStatus['Completed'], color:'#3f6b2a'},
    {label:'In Process', value:aggStatus['In Process'], color:'#c07c0a'},
    {label:'Pending', value:aggStatus['Pending'], color:'#c0392b'},
    {label:'On Hold', value:aggStatus['On Hold'], color:'#2e5fa3'},
    {label:'Cancelled', value:aggStatus['Cancelled'], color:'#5a6b7a'}
  ];
  const planChartHtml = `<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:center">
    ${svgDonut(planSegments)}
    <div style="flex:1;min-width:140px">${donutLegend(planSegments)}</div>
  </div>`;
  document.getElementById('dash-plan-progress').innerHTML = planTableHtml + planChartHtml;

  // ── Review Score — by Department ──
  let reviews = DB.reviews;
  reviews = applyRoleFilter(reviews, 'review');
  if (deptFilter) reviews = reviews.filter(r=>r.dept===deptFilter);
  if (year) reviews = reviews.filter(r=>r.year===year);
  if (month) reviews = reviews.filter(r=>r.month===month);

  let reviewRows = '';
  const scoreBands = {High:0, Medium:0, Low:0, Pending:0};
  scopeDepts.forEach(d => {
    const dr = reviews.filter(r=>r.dept===d);
    let sumPct = 0, scoredCount = 0;
    dr.forEach(r => {
      const items = r.items||[];
      const tMax = items.reduce((a,i)=>a+(parseFloat(i.maxScore)||0),0);
      const tMgr = items.reduce((a,i)=>a+(parseFloat(i.mgrScore)||0),0);
      const mgrDone = items.some(i=>parseFloat(i.mgrScore)>0);
      if (!mgrDone) { scoreBands.Pending++; return; }
      const p = tMax>0 ? Math.round(tMgr/tMax*100) : 0;
      sumPct += p; scoredCount++;
      if (p>=80) scoreBands.High++; else if (p>=50) scoreBands.Medium++; else scoreBands.Low++;
    });
    const avgPct = scoredCount>0 ? Math.round(sumPct/scoredCount) : 0;
    reviewRows += `<tr>
      <td style="font-weight:600">${esc(d)}</td>
      <td style="text-align:center">${dr.length}</td>
      <td style="text-align:center">
        <div style="display:flex;align-items:center;gap:6px;justify-content:center">
          <div class="bar" style="width:56px;height:6px"><div class="bar-fill" style="width:${avgPct}%;background:${pctColor(avgPct)}"></div></div>
          <span style="font-size:11px;font-weight:700">${scoredCount>0?avgPct+'%':'—'}</span>
        </div>
      </td>
    </tr>`;
  });
  if (!scopeDepts.length) reviewRows = `<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:16px">No department in scope for your role</td></tr>`;
  const reviewTableHtml = `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Department</th><th style="text-align:center">Reviews</th><th style="text-align:center">Avg Mgr Score</th></tr></thead>
    <tbody>${reviewRows}</tbody>
  </table></div>`;
  const reviewSegments = [
    {label:'High (≥80%)', value:scoreBands.High, color:'#3f6b2a'},
    {label:'Medium (50–79%)', value:scoreBands.Medium, color:'#c07c0a'},
    {label:'Low (<50%)', value:scoreBands.Low, color:'#c0392b'},
    {label:'Mgr Score Pending', value:scoreBands.Pending, color:'#8a9aaa'}
  ];
  const reviewChartHtml = `<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:center">
    ${svgDonut(reviewSegments)}
    <div style="flex:1;min-width:140px">${donutLegend(reviewSegments)}</div>
  </div>`;
  document.getElementById('dash-review-score').innerHTML = reviewTableHtml + reviewChartHtml;
}

// ── SMART GOALS ──
// Member dropdown depends on the chosen department (empty until one is picked).
function setSgMemberOptions() {
  const dept = document.getElementById('sg-dept-filter').value;
  const el = document.getElementById('sg-member-filter');
  if (!el) return;
  if (!dept) {
    el.innerHTML = '<option value="">Select Department first…</option>';
  } else {
    populateSelect('sg-member-filter', scopedMemberNames(dept), 'Select Member…');
  }
}
function onSgDeptChange() {
  setSgMemberOptions();
  document.getElementById('sg-member-filter').value = '';
  renderSmartGoals();
}

function renderSmartGoals() {
  const year = document.getElementById('sg-year-filter').value;
  const dept = document.getElementById('sg-dept-filter').value;
  const member = document.getElementById('sg-member-filter').value;
  const listEl = document.getElementById('smart-goals-list');

  // Cascading gate: pick a Department, then a Member, before anything shows.
  if (!dept) {
    listEl.innerHTML = `<div class="empty"><div class="empty-icon">🏢</div><p>Select a <b>Department</b> above to begin.</p></div>`;
    return;
  }
  if (!member) {
    listEl.innerHTML = `<div class="empty"><div class="empty-icon">👤</div><p>Now select a <b>Member</b> to view their SMART Goals.</p></div>`;
    return;
  }

  let goals = DB.goals.filter(g => g.dept === dept && g.member === member);
  if (year) goals = goals.filter(g=>g.year===year);

  if (!goals.length) {
    listEl.innerHTML = `<div class="empty"><div class="empty-icon">🎯</div><p>No SMART goals for <b>${esc(member)}</b> yet.<br>Click "+ Add SMART Goal" to start.</p></div>`;
    return;
  }

  // group first by member (so each member's goals are visually separated), then by goal name within
  const byMember = {};
  const memberOrder = [];
  goals.forEach(g => {
    const key = `${g.dept}||${g.member}`;
    if (!byMember[key]) { byMember[key] = { dept:g.dept, member:g.member, items:[] }; memberOrder.push(key); }
    byMember[key].items.push(g);
  });

  let html = '';
  memberOrder.forEach(key => {
    const block = byMember[key];
    const mInfo = DB.settings.members.find(m=>m.name===block.member && m.dept===block.dept);
    const groups = groupByGoal(block.items);

    // ── Summary of SMART Goals: # | SMART Goal | Description | Weightage (+ Total row) ──
    const grpYears = [...new Set(block.items.map(i=>i.year))];
    const yearSuffix = grpYears.length===1 ? ` — ${academicYearShort(grpYears[0])}` : '';
    let summaryRows = '';
    let totalWeightage = 0;
    groups.forEach((grp,i) => {
      const weightage = parseFloat(grp.weightage)||0;
      totalWeightage += weightage;
      const desc = grp.rows[0].description || '';
      summaryRows += `<tr>
        <td style="text-align:center;color:var(--text3)">${i+1}</td>
        <td style="font-weight:600">${esc(grp.goal)}</td>
        <td style="font-size:11px;color:var(--text2)">${esc(desc||'—')}</td>
        <td style="text-align:center;font-weight:600">${weightage}%</td>
      </tr>`;
    });
    const summaryHtml = `<div style="margin-bottom:14px">
      <div class="review-section-hd">Summary of SMART Goals${yearSuffix}</div>
      <div class="tbl-wrap"><table class="tbl tbl-fixed">
        <colgroup>
          <col style="width:5%"><col style="width:25%"><col style="width:55%"><col style="width:15%">
        </colgroup>
        <thead><tr>
          <th style="text-align:center">#</th><th>SMART Goal</th><th>Description</th>
          <th style="text-align:center">Weightage</th>
        </tr></thead>
        <tbody>
          ${summaryRows}
          <tr style="background:var(--surface2);font-weight:700">
            <td colspan="3" style="text-align:right">Total</td>
            <td style="text-align:center">${totalWeightage}%</td>
          </tr>
        </tbody>
      </table></div>
    </div>`;

    html += `<div style="margin-bottom:22px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span style="font-size:14px;font-weight:800">${esc(block.member)}</span>
        <span style="font-size:11px;color:var(--text3)">${esc(block.dept)}</span>
        ${mInfo?roleBadge(mInfo.role):''}
      </div>
      ${summaryHtml}
      <div class="goal-tree">`;
    groups.forEach(grp => {
      const r0 = grp.rows[0];
      const canEdit = canEditGoal(r0);
      html += `<div class="goal-group">
        <div class="goal-group-header sg-goal-hd" onclick="toggleGoalGroup(this)" style="display:grid;grid-template-columns:18px 1.6fr 2fr auto;align-items:center;gap:10px">
          <span class="sg-goal-chevron">▶</span>
          <span class="goal-group-title">${esc(grp.goal)} <b>(${grp.weightage}%)</b></span>
          <span style="font-size:12px;color:var(--text2);font-style:${r0.description?'normal':'italic'}">${esc(r0.description||'—')}</span>
          <span class="actions-cell" onclick="event.stopPropagation()">
            ${canEdit ? `<button class="btn btn-secondary btn-sm" onclick="editGoalGroup('${escJs(r0.year)}','${escJs(r0.dept)}','${escJs(r0.member)}','${escJs(grp.goal)}')" title="Edit SMART Goal">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteGoalGroup('${escJs(r0.year)}','${escJs(r0.dept)}','${escJs(r0.member)}','${escJs(grp.goal)}')" title="Delete SMART Goal">🗑️</button>
            <button class="btn btn-secondary btn-sm" onclick="openGoalModal(null,{year:'${escJs(r0.year)}',dept:'${escJs(r0.dept)}',member:'${escJs(r0.member)}',goal:'${escJs(grp.goal)}',weightage:${grp.weightage},description:'${escJs(r0.description||'')}'})">+ Add Category</button>` : `<span style="font-size:11px;color:var(--text3)">View only</span>`}
          </span>
        </div>
        <div class="goal-items-list" style="display:none">
          <div class="goal-item-row goal-col-head" style="grid-template-columns:1.6fr 2fr 90px 70px">
            <span>Category</span><span>Particulars</span><span style="text-align:center">Max Score</span><span></span>
          </div>
          ${grp.rows.map(r=>`<div class="goal-item-row" style="grid-template-columns:1.6fr 2fr 90px 70px">
            <span class="gi-name">${esc(r.cat)}</span>
            <span class="gi-cat">${esc(r.particulars||'—')}</span>
            <span style="text-align:center;font-weight:700">${r.maxScore}</span>
            <span class="actions-cell">
              ${canEdit ? `<button class="btn btn-secondary btn-sm" onclick="openGoalModal('${r.id}')" title="Edit">✏️</button>
              <button class="btn btn-danger btn-sm" onclick="deleteGoal('${r.id}')" title="Delete">🗑️</button>` : ''}
            </span>
          </div>`).join('')}
        </div>
      </div>`;
    });
    html += `</div></div>`;
  });
  document.getElementById('smart-goals-list').innerHTML = html;
}

function openGoalModal(id, prefill) {
  // permission gate: editing an existing row, or adding a category to a group
  if (id) {
    const gExisting = DB.goals.find(x=>x.id===id);
    if (gExisting && !canEditGoal(gExisting)) { toast('You can only edit your own SMART Goals'); return; }
  } else if (prefill && (prefill.dept || prefill.member) && !canEditGoal({ dept: prefill.dept, member: prefill.member })) {
    toast('You can only add categories to your own SMART Goals'); return;
  }
  editingGoalId = id || null;
  document.getElementById('goal-modal-title').textContent = id ? 'Edit SMART Goal' : 'Add SMART Goal';
  if (id) {
    const g = DB.goals.find(x=>x.id===id);
    if (g) {
      document.getElementById('gf-year').value = g.year;
      document.getElementById('gf-dept').value = g.dept;
      populateGoalMemberDropdown();
      document.getElementById('gf-member').value = g.member;
      document.getElementById('gf-goal').value = g.goal;
      document.getElementById('gf-weightage').value = g.weightage;
      document.getElementById('gf-description').value = g.description || '';
      document.getElementById('gf-cat').value = g.cat;
      document.getElementById('gf-maxscore').value = g.maxScore;
      document.getElementById('gf-particulars').value = g.particulars || '';
    }
  } else if (prefill) {
    document.getElementById('gf-year').value = prefill.year;
    document.getElementById('gf-dept').value = prefill.dept;
    populateGoalMemberDropdown();
    document.getElementById('gf-member').value = prefill.member;
    document.getElementById('gf-goal').value = prefill.goal;
    document.getElementById('gf-weightage').value = prefill.weightage;
    document.getElementById('gf-description').value = prefill.description || '';
    document.getElementById('gf-cat').value = '';
    document.getElementById('gf-maxscore').value = '';
    document.getElementById('gf-particulars').value = '';
  } else {
    document.getElementById('gf-year').value = currentAcademicYearGuess();
    // A plain member can only create their own goals — prefill (and effectively lock) to self.
    const selfDept = (currentUser.role === ROLES.MEMBER || currentUser.role === ROLES.DEPT_HEAD) ? (currentUser.dept || currentDept || '') : (currentDept || '');
    document.getElementById('gf-dept').value = selfDept;
    populateGoalMemberDropdown();
    document.getElementById('gf-member').value = (currentUser.role === ROLES.MEMBER) ? currentUser.name : '';
    document.getElementById('gf-goal').value = '';
    document.getElementById('gf-weightage').value = '';
    document.getElementById('gf-description').value = '';
    document.getElementById('gf-cat').value = '';
    document.getElementById('gf-maxscore').value = '';
    document.getElementById('gf-particulars').value = '';
  }
  openModal('goal-modal');
}

function currentAcademicYearGuess() {
  const now = new Date();
  return deriveAcademicYear(MONTHS[now.getMonth()], now.getFullYear());
}

function saveGoal() {
  const year = document.getElementById('gf-year').value;
  const dept = document.getElementById('gf-dept').value;
  const member = document.getElementById('gf-member').value;
  const goal = document.getElementById('gf-goal').value.trim();
  const weightage = parseFloat(document.getElementById('gf-weightage').value);
  const description = document.getElementById('gf-description').value.trim();
  const cat = document.getElementById('gf-cat').value.trim();
  const maxScore = parseFloat(document.getElementById('gf-maxscore').value);
  const particulars = document.getElementById('gf-particulars').value.trim();

  if (!year||!dept||!member||!goal||isNaN(weightage)||!cat||isNaN(maxScore)) {
    toast('Please fill all mandatory fields (*)'); return;
  }
  // Permission: you can only add/edit SMART Goals you own (or, for a dept head,
  // in your department; admins may edit anyone's).
  if (!canEditGoal({ dept: dept, member: member })) {
    toast('You can only add or edit your own SMART Goals'); return;
  }
  if (!DB.settings.goalNames.includes(goal)) DB.settings.goalNames.push(goal);
  if (!DB.settings.categories.includes(cat)) DB.settings.categories.push(cat);

  const g = { id: editingGoalId||uid(), year, dept, member, goal, weightage, description, cat, particulars, maxScore };
  if (editingGoalId) { const i=DB.goals.findIndex(x=>x.id===editingGoalId); if(i>-1) DB.goals[i]=g; }
  else DB.goals.push(g);
  save(); populateAllSelects(); closeModal('goal-modal'); renderSmartGoals(); renderSidebar();
  toast('SMART Goal saved');
}

function deleteGoal(id) {
  const g0 = DB.goals.find(g=>g.id===id);
  if (g0 && !canEditGoal(g0)) { toast('You can only delete your own SMART Goals'); return; }
  sgConfirm('Are you sure you want to delete this record?', {title:'Delete category', danger:true, okText:'Delete'}).then(function (ok) {
    if (!ok) return;
    DB.goals = DB.goals.filter(g=>g.id!==id);
    save(); populateAllSelects(); renderSmartGoals(); renderSidebar();
    toast('Deleted');
  });
}

// ── SMART Goal accordion + goal-level edit/delete ──
function toggleGoalGroup(hdEl) {
  const group = hdEl.closest('.goal-group');
  if (!group) return;
  const list = group.querySelector('.goal-items-list');
  const chev = hdEl.querySelector('.sg-goal-chevron');
  const isOpen = group.classList.toggle('sg-open');
  if (list) list.style.display = isOpen ? '' : 'none';
  if (chev) chev.textContent = isOpen ? '▼' : '▶';
}

let editingGoalGroup = null; // {year, dept, member, goal}
function editGoalGroup(year, dept, member, goal) {
  if (!canEditGoal({ dept: dept, member: member })) { toast('You can only edit your own SMART Goals'); return; }
  const rows = DB.goals.filter(g => g.year===year && g.dept===dept && g.member===member && g.goal===goal);
  editingGoalGroup = { year, dept, member, goal };
  document.getElementById('gg-goal').value = goal;
  document.getElementById('gg-weightage').value = rows.length ? rows[0].weightage : '';
  document.getElementById('gg-description').value = rows.length ? (rows[0].description || '') : '';
  document.getElementById('gg-context').textContent = `${member} · ${dept} · ${academicYearShort(year)}`;
  openModal('goalgroup-modal');
}
function saveGoalGroup() {
  if (!editingGoalGroup) return;
  const { year, dept, member, goal: oldGoal } = editingGoalGroup;
  const newGoal = document.getElementById('gg-goal').value.trim();
  const weightage = parseFloat(document.getElementById('gg-weightage').value);
  const description = document.getElementById('gg-description').value.trim();
  if (!newGoal || isNaN(weightage)) { toast('SMART Goal name and weightage are required'); return; }
  if (!DB.settings.goalNames.includes(newGoal)) DB.settings.goalNames.push(newGoal);
  DB.goals.forEach(g => {
    if (g.year===year && g.dept===dept && g.member===member && g.goal===oldGoal) {
      g.goal = newGoal; g.weightage = weightage; g.description = description;
    }
  });
  editingGoalGroup = null;
  save(); populateAllSelects(); closeModal('goalgroup-modal'); renderSmartGoals(); renderSidebar();
  toast('SMART Goal updated');
}
function deleteGoalGroup(year, dept, member, goal) {
  if (!canEditGoal({ dept: dept, member: member })) { toast('You can only delete your own SMART Goals'); return; }
  const rows = DB.goals.filter(g => g.year===year && g.dept===dept && g.member===member && g.goal===goal);
  sgConfirm(`Are you sure you want to delete SMART Goal "${goal}" and all ${rows.length} categor${rows.length===1?'y':'ies'}? This cannot be undone.`, {title:'Delete SMART Goal', danger:true, okText:'Delete'}).then(function (ok) {
    if (!ok) return;
    DB.goals = DB.goals.filter(g => !(g.year===year && g.dept===dept && g.member===member && g.goal===goal));
    save(); populateAllSelects(); renderSmartGoals(); renderSidebar();
    toast('SMART Goal deleted');
  });
}

// ── Manager Grade / Comment + review helpers ──
const GRADE_DESC = {
  A: 'No Fatal, No Critical errors, No presentation issues, well reported',
  B: '\u2264 2 fatal or critical errors, presentation issues',
  C: '>2 errors, poor quality'
};
function gradeTitle(g) { return (g && GRADE_DESC[g]) ? (g + ' — ' + GRADE_DESC[g]) : 'Set grade'; }
// Who may set a task's Manager Grade / Manager Comment: admin, the dept head of
// that dept (not their own row), or the member's assigned reporting manager.
// Mirrors canEditMgrScore so manager fields follow the same rule as manager scores.
function canEditMgrTaskFields(t) {
  if (!t) return false;
  if (currentUser.role === ROLES.ADMIN) return true;
  if (currentUser.role === ROLES.DEPT_HEAD && t.dept === currentUser.dept && t.member !== currentUser.name) return true;
  if (isManagerOf(t.member, t.dept)) return true;
  return false;
}
// Academic-year-aware month position (June=0 … May=11) for sorting reviews latest-first.
function sgAyMonthPos(month) { var i = MONTHS.indexOf(month); return i < 0 ? -1 : (i - 5 + 12) % 12; }
function sgReviewSortKey(a, b) {
  var ya = String(a.year || ''), yb = String(b.year || '');
  if (ya !== yb) return yb.localeCompare(ya);            // newer academic year first
  return sgAyMonthPos(b.month) - sgAyMonthPos(a.month);  // later month in the year first
}
// Generic review-summary callout (blank value renders nothing).
function sgReviewNoteHtml(icon, label, val) {
  if (!val || !String(val).trim()) return '';
  return `<p style="font-size:12px;color:var(--text2);margin:0;padding:8px 12px;background:var(--surface2);border-radius:var(--radius);border-left:3px solid var(--brand);overflow-wrap:anywhere;word-break:break-word">${icon} <span style="font-weight:600;color:var(--text)">${esc(label)}</span> - ${esc(val)}</p>`;
}

// ── MONTHLY PLAN ──
const COL_DEFS = [
  {key:'year',      grp:'plan',   label:'Academic Year', w:125},
  {key:'month',     grp:'plan',   label:'Month', w:75},
  {key:'week',      grp:'plan',   label:'Week', w:65},
  {key:'dept',      grp:'plan',   label:'Dept', w:90},
  {key:'member',    grp:'plan',   label:'Member', w:130},
  {key:'goal',      grp:'plan',   label:'SMART Goal', w:140},
  {key:'cat',       grp:'plan',   label:'Category', w:120},
  {key:'subcat',    grp:'plan',   label:'Sub-category', w:120},
  {key:'action',    grp:'plan',   label:'Action Point', w:230},
  {key:'planned',   grp:'plan',   label:'Planned', w:70},
  {key:'plannedItems', grp:'plan',label:'Planned Items', w:80},
  {key:'est',       grp:'plan',   label:'Est Hrs', w:70},
  {key:'tgtDate',   grp:'plan',   label:'Target Date', w:110},
  {key:'compDate',  grp:'status', label:'Comp Date', w:115},
  {key:'actualHrs', grp:'status', label:'Actual Hrs', w:85},
  {key:'actualItems',grp:'status',label:'Actual Items', w:90},
  {key:'status',    grp:'status', label:'Status', w:120},
  {key:'deviation', grp:'status', label:'Deviation', w:140},
  {key:'helpNeeded',grp:'status', label:'Help Needed', w:140},
  {key:'revisedTgtDate', grp:'status', label:'Revised Date', w:110},
  {key:'managerGrade',   grp:'mgr', label:'Mgr Grade', w:95},
  {key:'managerComment', grp:'mgr', label:'Mgr Comment', w:110},
  {key:'actions',   grp:'act',    label:'Actions', w:130}
];
const GRP_LABEL = {plan:'Plan', status:'Status Update', mgr:'Manager', act:'Actions'};
const GRP_CLASS = {plan:'plan', status:'status', mgr:'mgr', act:'act'};

function isColHidden(key) { return (DB.uiPrefs.hiddenPlanCols||[]).includes(key); }
function toggleColumn(key, show) {
  if (!DB.uiPrefs) DB.uiPrefs = { hiddenPlanCols: [] };
  const set = new Set(DB.uiPrefs.hiddenPlanCols||[]);
  if (show) set.delete(key); else set.add(key);
  DB.uiPrefs.hiddenPlanCols = [...set];
  saveUiPrefs();   // persist the choice immediately (per-user), survives refresh
  save(); renderPlan();
}
function toggleColsPanel() {
  const panel = document.getElementById('cols-panel');
  if (!panel.classList.contains('open')) renderColsPanel();
  panel.classList.toggle('open');
}
document.addEventListener('click', e => {
  const wrap = document.querySelector('.cols-panel-wrap');
  if (wrap && !wrap.contains(e.target)) document.getElementById('cols-panel')?.classList.remove('open');
});
function renderColsPanel() {
  let html = '';
  ['plan','status'].forEach(grp => {
    html += `<div class="cols-panel-group">${GRP_LABEL[grp]}</div>`;
    COL_DEFS.filter(c=>c.grp===grp).forEach(c => {
      html += `<label><input type="checkbox" ${isColHidden(c.key)?'':'checked'} onchange="toggleColumn('${c.key}', this.checked)"> ${esc(c.label)}</label>`;
    });
  });
  document.getElementById('cols-panel').innerHTML = html;
}

// Manager Grade/Comment columns are visible ONLY to admins, dept heads, and
// anyone who is a reporting manager (has reportees). Plain members never see them.
function canSeeMgrCols() {
  return currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.DEPT_HEAD || amIManager();
}
function visibleCols() {
  return COL_DEFS.filter(c => {
    if (c.grp === 'mgr') return true;   // Manager columns visible to all; members see them view-only
    return c.grp === 'act' || !isColHidden(c.key);
  });
}

function renderPlanHead() {
  const cols = visibleCols();
  const grpCounts = {};
  cols.forEach(c => grpCounts[c.grp] = (grpCounts[c.grp]||0)+1);
  let grpRow = '<tr class="grp-hd">';
  ['plan','status','mgr','act'].forEach(g => { if (grpCounts[g]) grpRow += `<th class="g-${g}" colspan="${grpCounts[g]}">${GRP_LABEL[g]}</th>`; });
  grpRow += '</tr>';
  let colRow = '<tr class="col-hd">' + cols.map(c => `<th class="h-${c.grp==='act'?'act':c.grp}" data-col="${c.key}">${esc(c.label)}</th>`).join('') + '</tr>';
  // Fixed column widths: colgroup + table-layout:fixed so columns never grow/shrink
  // with content; long text wraps to the next line instead.
  const tbl = document.getElementById('plan-thead').parentElement;
  if (tbl) {
    let cg = tbl.querySelector('colgroup.plan-cg');
    if (!cg) { cg = document.createElement('colgroup'); cg.className = 'plan-cg'; tbl.insertBefore(cg, tbl.firstChild); }
    cg.innerHTML = cols.map(c => `<col style="width:${c.w||100}px">`).join('');
    tbl.style.tableLayout = 'fixed';
    tbl.style.width = cols.reduce((a,c)=>a+(c.w||100),0) + 'px';
  }
  document.getElementById('plan-thead').innerHTML = grpRow + colRow;
}

function dateChip(val) { return `<span style="font-size:11px;color:var(--text2);white-space:nowrap">${val?formatDate(val):'—'}</span>`; }
function dateCellEditable(id, field, val) {
  const label = val ? formatDate(val) : 'Set date';
  return `<td class="c-status" style="white-space:nowrap">
    <button type="button" class="sg-date-btn" onclick="sgToggleDate(this)" title="Set date">📅 <span class="sg-date-val">${label}</span></button>
    <input class="tbl-input sg-date-input" type="date" value="${val||''}" data-id="${id}" data-field="${field}" onchange="sgSyncDate(this)" style="display:none;min-width:130px">
  </td>`;
}

function planCellHtml(t, key) {
  const ed = canEditTask(t);
  switch(key) {
    case 'year': return `<td class="c-plan" style="font-size:11px;color:var(--text3)">${esc(t.year)}</td>`;
    case 'month': return `<td class="c-plan" style="white-space:nowrap;font-size:12px">${esc(t.month)}</td>`;
    case 'week': return `<td class="c-plan" style="white-space:nowrap;font-size:12px;font-weight:600">${esc(t.week)}</td>`;
    case 'dept': return `<td class="c-plan" style="font-size:11px;color:var(--text2)">${esc(t.dept)}</td>`;
    case 'member': return `<td class="c-plan" style="font-weight:500">${esc(t.member)}</td>`;
    case 'goal': return `<td class="c-plan"><span class="goal-pill ${goalColor(t.goal)}">${esc(t.goal)}</span></td>`;
    case 'cat': return `<td class="c-plan" style="font-size:11px;color:var(--text2)">${esc(t.cat||'—')}</td>`;
    case 'subcat': return `<td class="c-plan" style="font-size:11px">${esc(t.subcat||'—')}</td>`;
    case 'action': return `<td class="c-plan" style="font-size:12px">${esc(t.action)}</td>`;
    case 'planned': return `<td class="c-plan">${planBadge(t.planned)}</td>`;
    case 'plannedItems': return `<td class="c-plan" style="text-align:right">${t.plannedItems===''||t.plannedItems==null?'—':t.plannedItems}</td>`;
    case 'est': return `<td class="c-plan" style="text-align:right;font-weight:600">${t.est||0}</td>`;
    case 'tgtDate': return `<td class="c-plan" style="font-size:11px;white-space:nowrap;color:var(--text2)">${formatDate(t.tgtDate)}</td>`;
    case 'compDate': return ed ? dateCellEditable(t.id,'compDate',t.compDate)
      : `<td class="c-status" style="white-space:nowrap">${dateChip(t.compDate)}</td>`;
    case 'actualHrs': return ed
      ? `<td class="c-status"><input class="tbl-input" type="number" step="0.5" min="0" value="${t.actualHrs||0}" data-id="${t.id}" data-field="actualHrs" style="width:100%"></td>`
      : `<td class="c-status" style="text-align:right">${t.actualHrs||0}</td>`;
    case 'actualItems': return ed
      ? `<td class="c-status"><input class="tbl-input" type="number" min="0" value="${t.actualItems===''||t.actualItems==null?'':t.actualItems}" data-id="${t.id}" data-field="actualItems" style="width:100%"></td>`
      : `<td class="c-status" style="text-align:right">${t.actualItems===''||t.actualItems==null?'—':t.actualItems}</td>`;
    case 'status': return ed
      ? `<td class="c-status"><select class="tbl-select" data-id="${t.id}" data-field="status" style="width:100%">${['Planned','Completed','In Process','Pending','On Hold','Cancelled'].map(s=>`<option value="${s}"${t.status===s?' selected':''}>${s}</option>`).join('')}</select></td>`
      : `<td class="c-status">${statusBadge(t.status)}</td>`;
    case 'deviation': return ed
      ? `<td class="c-status"><input class="tbl-input" type="text" value="${esc(t.deviation||'')}" placeholder="Deviation…" data-id="${t.id}" data-field="deviation" style="width:100%"></td>`
      : `<td class="c-status" style="font-size:11px;color:var(--text2)">${esc(t.deviation||'—')}</td>`;
    case 'helpNeeded': return ed
      ? `<td class="c-status"><input class="tbl-input" type="text" value="${esc(t.helpNeeded||'')}" placeholder="Help needed…" data-id="${t.id}" data-field="helpNeeded" style="width:100%"></td>`
      : `<td class="c-status" style="font-size:11px;color:var(--text2)">${esc(t.helpNeeded||'—')}</td>`;
    case 'managerGrade': {
      const _gt = gradeTitle(t.managerGrade);
      if (canEditMgrTaskFields(t)) {
        return `<td class="c-mgr" style="text-align:center" title="${esc(_gt)}"><select class="tbl-select" onchange="sgSetGrade('${t.id}',this.value)" style="width:100%">${['','A','B','C'].map(x=>`<option value="${x}"${t.managerGrade===x?' selected':''}>${x||'—'}</option>`).join('')}</select></td>`;
      }
      return `<td class="c-mgr" style="text-align:center">${t.managerGrade?`<span title="${esc(_gt)}" style="display:inline-block;min-width:22px;padding:2px 8px;border-radius:20px;font-weight:700;font-size:11px;background:var(--surface2);border:1px solid var(--border2)">${esc(t.managerGrade)}</span>`:`<span style="color:var(--text3)" title="No grade">—</span>`}</td>`;
    }
    case 'managerComment': {
      const _has = !!(t.managerComment && String(t.managerComment).trim());
      const _ed = canEditMgrTaskFields(t);
      const _icon = _ed ? '✏️' : '👁';
      const _ttl = _ed ? 'View / edit manager comment' : 'View manager comment';
      return `<td class="c-mgr" style="text-align:center"><button type="button" class="btn btn-secondary btn-sm" onclick="openMgrComment('${t.id}')" title="${_ttl}" style="padding:2px 9px">${_icon}${_has?' •':''}</button></td>`;
    }
    case 'revisedTgtDate': return ed ? dateCellEditable(t.id,'revisedTgtDate',t.revisedTgtDate)
      : `<td class="c-status" style="white-space:nowrap">${dateChip(t.revisedTgtDate)}</td>`;
    case 'actions': return ed ? `<td class="c-act">
      <div class="actions-cell">
        <button class="btn btn-save btn-sm" onclick="saveInlineRow('${t.id}')" title="Save row">💾</button>
        <button class="btn btn-secondary btn-sm" onclick="openEditTask('${t.id}')" title="Edit task">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTask('${t.id}')" title="Delete">🗑️</button>
      </div>
    </td>` : `<td class="c-act"><span style="font-size:11px;color:var(--text3)">View only</span></td>`;
    default: return '<td></td>';
  }
}

function renderPlan() {
  const year=document.getElementById('mp-year').value;
  const month=document.getElementById('mp-month').value;
  const week=document.getElementById('mp-week').value;
  const dept=document.getElementById('mp-dept').value;
  const tbody=document.getElementById('plan-tbody');

  // Academic Year, Month and Department are mandatory; Week is optional (All Weeks).
  if (!year || !month || !dept) {
    document.getElementById('plan-thead').innerHTML='';
    tbody.innerHTML=`<tr><td colspan="23"><div class="empty"><div class="empty-icon">🗓️</div><p>Select <b>Academic Year</b>, <b>Month</b> and <b>Department</b> above to view the plan.</p></div></td></tr>`;
    return;
  }

  renderPlanHead();
  const goal=document.getElementById('mp-goal').value;
  const member=document.getElementById('mp-member').value;
  const status=document.getElementById('mp-status').value;
  const search=document.getElementById('mp-search').value.toLowerCase();

  // Everyone can view the plan; who can edit each row is enforced per-row.
  let tasks=DB.tasks.filter(t=>t.year===year && t.month===month && t.dept===dept);
  if(week) tasks=tasks.filter(t=>t.week===week);
  if(goal) tasks=tasks.filter(t=>t.goal===goal);
  if(member) tasks=tasks.filter(t=>t.member===member);
  if(status) tasks=tasks.filter(t=>t.status===status);
  if(search) tasks=tasks.filter(t=>t.action.toLowerCase().includes(search)||(t.subcat||'').toLowerCase().includes(search)||(t.cat||'').toLowerCase().includes(search));

  // Sort: Week 1 → 2 → 3 …, and within each week newest-added first.
  tasks.sort((a,b)=>{
    const wa=WEEKS.indexOf(a.week), wb=WEEKS.indexOf(b.week);
    if (wa!==wb) return wa-wb;
    const ca=a.createdAt||'', cb=b.createdAt||'';
    if (ca!==cb) return ca<cb?1:-1;
    return 0;
  });

  const cols = visibleCols();
  if(!tasks.length){tbody.innerHTML=`<tr><td colspan="${cols.length}"><div class="empty"><div class="empty-icon">📋</div><p>No tasks for this selection.</p></div></td></tr>`;return;}

  tbody.innerHTML=tasks.map(t=>`<tr id="row-${t.id}">${cols.map(c=>planCellHtml(t,c.key)).join('')}</tr>`).join('') + planTotalRowHtml(tasks, cols);
}

// Total row — shown at the bottom of the Monthly Plan table.
// Only these four numeric columns are summed: Planned Items, Est Hrs, Actual Hrs, Actual Items.
// All other columns in the Total row are left blank; the first eligible column carries the "Total" label.
function planTotalRowHtml(tasks, cols) {
  const sumKeys = ['plannedItems','est','actualHrs','actualItems'];
  const totals = {};
  sumKeys.forEach(k => totals[k] = tasks.reduce((a,t)=>a + (parseFloat(t[k])||0), 0));
  const fmt = v => { const r = Math.round(v*100)/100; return r % 1 === 0 ? r : r.toFixed(2); };
  const labelIdx = cols.findIndex(c => c.grp !== 'act' && !sumKeys.includes(c.key));
  const cells = cols.map((c,i) => {
    if (sumKeys.includes(c.key)) return `<td class="plan-total-cell" style="text-align:right">${fmt(totals[c.key])}</td>`;
    if (i === labelIdx) return `<td class="plan-total-cell">Total</td>`;
    return `<td class="plan-total-cell"></td>`;
  }).join('');
  return `<tr class="plan-total-row">${cells}</tr>`;
}

// ── Monthly Plan → Excel export ──
// Downloads exactly what is on screen: the SAME filter pipeline as renderPlan()
// and the SAME visible columns (Actions column excluded), plus the Total row.
// SheetJS is lazy-loaded from CDN only on first export, so it never slows boot.
function planCellValue(t, key) {
  switch (key) {
    case 'year':         return t.year || '';
    case 'month':        return t.month || '';
    case 'week':         return t.week || '';
    case 'dept':         return t.dept || '';
    case 'member':       return t.member || '';
    case 'goal':         return t.goal || '';
    case 'cat':          return t.cat || '';
    case 'subcat':       return t.subcat || '';
    case 'action':       return t.action || '';
    case 'planned':      return t.planned || '';
    case 'plannedItems': return (t.plannedItems === '' || t.plannedItems == null) ? '' : Number(t.plannedItems);
    case 'est':          return Number(t.est || 0);
    case 'tgtDate':      return t.tgtDate ? formatDate(t.tgtDate) : '';
    case 'compDate':     return t.compDate ? formatDate(t.compDate) : '';
    case 'actualHrs':    return Number(t.actualHrs || 0);
    case 'actualItems':  return (t.actualItems === '' || t.actualItems == null) ? '' : Number(t.actualItems);
    case 'status':       return t.status || '';
    case 'deviation':    return t.deviation || '';
    case 'helpNeeded':   return t.helpNeeded || '';
    case 'revisedTgtDate': return t.revisedTgtDate ? formatDate(t.revisedTgtDate) : '';
    case 'managerGrade': return t.managerGrade || '';
    case 'managerComment': return t.managerComment || '';
    default: return '';
  }
}

// Read-only mirror of renderPlan()'s filtering/sorting. Returns the task array
// without touching the DOM, so export and on-screen table always match.
function currentPlanTasks() {
  const year   = document.getElementById('mp-year').value;
  const month  = document.getElementById('mp-month').value;
  const week   = document.getElementById('mp-week').value;
  const dept   = document.getElementById('mp-dept').value;
  const goal   = document.getElementById('mp-goal').value;
  const member = document.getElementById('mp-member').value;
  const status = document.getElementById('mp-status').value;
  const search = (document.getElementById('mp-search').value || '').toLowerCase();
  if (!year || !month || !dept) return { tasks: [], year, month, week, dept };
  let tasks = DB.tasks.filter(t => t.year === year && t.month === month && t.dept === dept);
  if (week)   tasks = tasks.filter(t => t.week === week);
  if (goal)   tasks = tasks.filter(t => t.goal === goal);
  if (member) tasks = tasks.filter(t => t.member === member);
  if (status) tasks = tasks.filter(t => t.status === status);
  if (search) tasks = tasks.filter(t => t.action.toLowerCase().includes(search) || (t.subcat||'').toLowerCase().includes(search) || (t.cat||'').toLowerCase().includes(search));
  tasks.sort((a,b) => {
    const wa = WEEKS.indexOf(a.week), wb = WEEKS.indexOf(b.week);
    if (wa !== wb) return wa - wb;
    const ca = a.createdAt || '', cb = b.createdAt || '';
    if (ca !== cb) return ca < cb ? 1 : -1;
    return 0;
  });
  return { tasks, year, month, week, dept };
}

// Lazy-load SheetJS (only fetched the first time someone exports).
let _xlsxLoading = null;
function ensureXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (_xlsxLoading) return _xlsxLoading;
  _xlsxLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error('Excel library did not initialise'));
    s.onerror = () => reject(new Error('Could not load the Excel library (check your connection)'));
    document.head.appendChild(s);
  });
  return _xlsxLoading;
}

async function exportPlanExcel() {
  const { tasks, year, month, week, dept } = currentPlanTasks();
  if (!year || !month || !dept) { toast('Select Academic Year, Month and Department first'); return; }
  if (!tasks.length) { toast('No tasks to export for this selection'); return; }

  // Columns exactly as shown on screen, minus the Actions column.
  const cols = visibleCols().filter(c => c.grp !== 'act');

  let XLSX;
  try { XLSX = await ensureXLSX(); }
  catch (e) { toast('⚠ ' + (e.message || 'Could not load Excel library')); return; }

  const header = cols.map(c => c.label);
  const rows   = tasks.map(t => cols.map(c => planCellValue(t, c.key)));

  // Total row — mirrors the on-screen Total row (sums these four numeric columns).
  const sumKeys = ['plannedItems','est','actualHrs','actualItems'];
  const totals = {}; sumKeys.forEach(k => totals[k] = tasks.reduce((a,t) => a + (parseFloat(t[k])||0), 0));
  const round2 = v => Math.round(v*100)/100;
  const labelIdx = cols.findIndex(c => !sumKeys.includes(c.key));
  const totalRow = cols.map((c,i) => {
    if (sumKeys.includes(c.key)) return round2(totals[c.key]);
    if (i === labelIdx) return 'Total';
    return '';
  });

  const aoa = [header, ...rows, totalRow];
  const ws  = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = cols.map(c => ({ wpx: Math.max(60, c.w || 100) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Monthly Plan');

  const safe = s => String(s || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const parts = ['Monthly-Plan', safe(dept), safe(month), safe(year), week ? safe(week) : 'All-Weeks'];
  const fname = parts.filter(Boolean).join('_') + '.xlsx';
  XLSX.writeFile(wb, fname);
  toast('Excel downloaded ✓');
}


function saveInlineRow(id) {
  const t=DB.tasks.find(x=>x.id===id); if(!t){toast('Task not found');return;}
  if(!canEditTask(t)){toast('You can only edit your own plan');return;}
  const row=document.getElementById('row-'+id); if(!row){toast('Row not found');return;}
  row.querySelectorAll('[data-id]').forEach(el=>{
    const field=el.dataset.field;
    if (field==='actualHrs') t[field]=parseFloat(el.value)||0;
    else if (field==='actualItems') t[field]= el.value===''?'':parseFloat(el.value)||0;
    else t[field]=el.value;
  });
  save();
  toast('Row saved ✓');
  row.style.outline='2px solid #1A8577';
  setTimeout(()=>row.style.outline='',1200);
}

// ── Manager Comment popup (Monthly Plan) ──
let _mgrCommentTaskId = null;
function openMgrComment(id) {
  const t = DB.tasks.find(x=>x.id===id); if (!t) { toast('Task not found'); return; }
  const editable = canEditMgrTaskFields(t);
  _mgrCommentTaskId = id;
  document.getElementById('mc-title').textContent = editable ? 'Manager Comment' : 'Manager Comment (view only)';
  document.getElementById('mc-sub').textContent = (t.member||'') + (t.action ? (' — ' + t.action) : (t.goal ? (' — ' + t.goal) : ''));
  const ta = document.getElementById('mc-text');
  ta.value = t.managerComment || '';
  ta.readOnly = !editable;
  document.getElementById('mc-save').style.display = editable ? '' : 'none';
  openModal('mgr-comment-modal');
}
function saveMgrComment() {
  const t = DB.tasks.find(x=>x.id===_mgrCommentTaskId); if (!t) return;
  if (!canEditMgrTaskFields(t)) { toast('Not allowed'); return; }
  t.managerComment = document.getElementById('mc-text').value;
  save(); closeModal('mgr-comment-modal'); renderPlan(); toast('Comment saved ✓');
}
// Manager Grade auto-saves on change (a reporting manager may not have the row's save button).
function sgSetGrade(id, val) {
  const t = DB.tasks.find(x=>x.id===id); if (!t) return;
  if (!canEditMgrTaskFields(t)) { toast('Not allowed'); renderPlan(); return; }
  t.managerGrade = val || '';
  save(); renderPlan(); toast('Grade saved ✓');
}

// Compact date field: chip shows the value; clicking expands the picker in-cell.
function sgToggleDate(btn) {
  const cell = btn.parentNode;
  const input = cell.querySelector('.sg-date-input');
  if (!input) return;
  btn.style.display = 'none';
  input.style.display = '';
  try { if (typeof input.showPicker === 'function') input.showPicker(); else input.focus(); } catch (e) { input.focus(); }
}
function sgSyncDate(input) {
  const cell = input.closest('td'); if (!cell) return;
  const btn = cell.querySelector('.sg-date-btn');
  const span = cell.querySelector('.sg-date-val');
  if (span) span.textContent = input.value ? formatDate(input.value) : 'Set date';
  input.style.display = 'none';
  if (btn) btn.style.display = '';
}

function openAddTask() {
  editingTaskId=null;
  document.getElementById('task-modal-title').textContent='Add Task';
  document.getElementById('tf-year').value = currentAcademicYearGuess();
  document.getElementById('tf-month').value = MONTHS[new Date().getMonth()];
  document.getElementById('tf-week').value = 'Week ' + Math.min(5, Math.ceil(new Date().getDate()/7));
  document.getElementById('tf-subcat').value='';
  document.getElementById('tf-action').value='';
  document.getElementById('tf-planneditems').value='';
  document.getElementById('tf-est').value='';
  document.getElementById('tf-planned').value='Yes';
  document.getElementById('tf-tgtdate').value='';
  const deptEl = document.getElementById('tf-dept');
  deptEl.value = (currentUser.role === ROLES.MEMBER || currentUser.role === ROLES.DEPT_HEAD) ? (currentUser.dept || currentDept || '') : (currentDept || '');
  populateTaskMemberDropdown();
  document.getElementById('tf-member').value = (currentUser.role === ROLES.MEMBER) ? currentUser.name : '';
  populateTaskGoalDropdown();
  openModal('task-modal');
}

function openEditTask(id) {
  const t=DB.tasks.find(x=>x.id===id); if(!t) return;
  if(!canEditTask(t)){toast('You can only edit your own plan');return;}
  editingTaskId=id;
  document.getElementById('task-modal-title').textContent='Edit Task';
  document.getElementById('tf-year').value=t.year;
  document.getElementById('tf-month').value=t.month;
  document.getElementById('tf-week').value=t.week;
  document.getElementById('tf-dept').value=t.dept||'';
  populateTaskMemberDropdown();
  document.getElementById('tf-member').value=t.member||'';
  populateTaskGoalDropdown();
  document.getElementById('tf-goal').value=t.goal;
  populateCatDropdown();
  document.getElementById('tf-cat').value=t.cat||'';
  document.getElementById('tf-subcat').value=t.subcat||'';
  document.getElementById('tf-action').value=t.action;
  document.getElementById('tf-planned').value=t.planned;
  document.getElementById('tf-planneditems').value=t.plannedItems===''||t.plannedItems==null?'':t.plannedItems;
  document.getElementById('tf-est').value=t.est||'';
  document.getElementById('tf-tgtdate').value=t.tgtDate||'';
  openModal('task-modal');
}

function saveTask() {
  const year=document.getElementById('tf-year').value;
  const month=document.getElementById('tf-month').value;
  const week=document.getElementById('tf-week').value;
  const dept=document.getElementById('tf-dept').value;
  const member=document.getElementById('tf-member').value;
  const goal=document.getElementById('tf-goal').value;
  const cat=document.getElementById('tf-cat').value;
  const action=document.getElementById('tf-action').value.trim();
  const planned=document.getElementById('tf-planned').value;
  const est=document.getElementById('tf-est').value;
  const tgtDate=document.getElementById('tf-tgtdate').value;
  if(!year||!month||!week||!dept||!member||!goal||!cat||!action||!planned||est===''||!tgtDate){toast('Please fill all mandatory fields (*)');return;}
  if(!canEditTask({dept:dept, member:member})){toast('You can only add or edit your own plan');return;}
  const existing=editingTaskId?DB.tasks.find(x=>x.id===editingTaskId):null;
  const plannedItemsVal = document.getElementById('tf-planneditems').value;
  const t={
    id:editingTaskId||uid(), year, month, week, dept, member, goal, cat,
    subcat:document.getElementById('tf-subcat').value||'',
    action, planned,
    plannedItems: plannedItemsVal===''?'':parseFloat(plannedItemsVal)||0,
    est:parseFloat(est)||0, tgtDate,
    actualHrs:existing?existing.actualHrs:0,
    actualItems:existing?existing.actualItems:'',
    status:existing?existing.status:'Planned',
    deviation:existing?existing.deviation:'',
    helpNeeded:existing?existing.helpNeeded:'',
    revisedTgtDate:existing?existing.revisedTgtDate:'',
    compDate:existing?existing.compDate:''
  };
  if(editingTaskId){const i=DB.tasks.findIndex(x=>x.id===editingTaskId);if(i>-1) DB.tasks[i]=t;}
  else DB.tasks.push(t);
  save();populateAllSelects();closeModal('task-modal');renderPlan();renderSidebar();
  toast(editingTaskId?'Task updated':'Task added');
}

function deleteTask(id) {
  const t0=DB.tasks.find(t=>t.id===id);
  if(t0 && !canEditTask(t0)){toast('You can only delete your own plan');return;}
  sgConfirm('Are you sure you want to delete this record?', {title:'Delete task', danger:true, okText:'Delete'}).then(function (ok) {
    if (!ok) return;
    DB.tasks=DB.tasks.filter(t=>t.id!==id);
    save();renderPlan();toast('Task deleted');
  });
}

// ── REVIEWS ──
function onRvDeptChange() {
  const dept = document.getElementById('rv-dept').value;
  populateSelect('rv-member', reviewScopedMemberNames(dept), 'Select Member…');
  document.getElementById('rv-member').value = '';
  renderReviews();
}

function renderReviews() {
  const addBtn = document.getElementById('rv-add-btn');
  // Plain Member (no reportees): self-review, filters hidden. Anyone who can
  // view others' reviews (Admin, Dept Head, or a Manager with reportees) gets
  // the Department/Member filters to choose whose review to open.
  const viewOthers = (currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.DEPT_HEAD || amIManager());
  addBtn.textContent = (currentUser.role === ROLES.MEMBER) ? '+ Submit Self Review' : '+ New Review';
  document.getElementById('rv-dept').style.display = viewOthers ? '' : 'none';
  document.getElementById('rv-member').style.display = viewOthers ? '' : 'none';

  const yearF = document.getElementById('rv-year').value;
  const monthF = document.getElementById('rv-month').value;
  // A Manager who is a plain Member has no home-dept lock — folding currentDept
  // in would hide a reportee who sits in another department.
  // Any manager (a plain member OR a dept head who also manages someone in
  // another department) must not have the review list locked to a home dept.
  const mgrView = amIManager();
  const deptF = document.getElementById('rv-dept').value || (mgrView ? '' : currentDept);
  const memberF = document.getElementById('rv-member').value;

  // Default view is blank — Dept Head / Admin must pick a Member (via filters) before anything shows.
  // Members viewing their own reviews (dept/member filters hidden) see their data immediately.
  if (viewOthers && !memberF) {
    document.getElementById('review-list').innerHTML = `<div class="empty"><div class="empty-icon">🔎</div><p>Select a Member from the filters above to view their review.</p></div>`;
    return;
  }

  // Visibility = own + dept-head's own dept + reportees (any dept) + admin(all).
  let reviews = DB.reviews.filter(canViewReview);
  if (yearF) reviews = reviews.filter(r => r.year === yearF);
  if (monthF) reviews = reviews.filter(r => r.month === monthF);
  if (deptF) reviews = reviews.filter(r => r.dept === deptF);
  if (memberF) reviews = reviews.filter(r => r.member === memberF);

  if (!reviews.length) {
    document.getElementById('review-list').innerHTML = `<div class="empty"><div class="empty-icon">📊</div><p>${!viewOthers ? 'You have no reviews yet. Click "+ Submit Self Review" to submit yours.' : 'No reviews found for this selection.'}</p></div>`;
    return;
  }

  reviews.sort(sgReviewSortKey);
  let html = '';
  reviews.forEach(r => {
    const items = r.items || [];
    const totalMax  = items.reduce((a,i) => a + (parseFloat(i.maxScore)||0), 0);
    const totalMem  = items.reduce((a,i) => a + (parseFloat(i.memberScore)||0), 0);
    const totalMgr  = items.reduce((a,i) => a + (parseFloat(i.mgrScore)||0), 0);
    const mgrDone = items.some(i => parseFloat(i.mgrScore) > 0);
    const memDone = items.some(i => parseFloat(i.memberScore) > 0);
    const statusPill = mgrDone
      ? `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--green-lt);color:var(--green);border:1px solid var(--green)">✓ Mgr Scored</span>`
      : memDone
        ? `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--blue-lt);color:var(--blue);border:1px solid var(--blue)">⏳ Awaiting Mgr Score</span>`
        : `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--surface2);color:var(--text3);border:1px solid var(--border2)">Draft</span>`;

    const groups = groupByGoal(items);

    // ── Summary of Review table with each SMART Goal's detail table nested directly beneath its row ──
    const canEditRemark = canEditMemberScore(r) || canEditMgrScore(r);
    let bodyRows = '';
    let totalWeightage = 0, totalPerformance = 0;
    groups.forEach((grp,gi) => {
      const gMax = grp.rows.reduce((a,x)=>a+(parseFloat(x.maxScore)||0),0);
      const gMgr = grp.rows.reduce((a,x)=>a+(parseFloat(x.mgrScore)||0),0);
      const gMem = grp.rows.reduce((a,x)=>a+(parseFloat(x.memberScore)||0),0);
      const weightage = parseFloat(grp.weightage)||0;
      const ratio = gMax>0 ? (gMgr/gMax) : 0;
      const performance = Math.round(ratio * weightage);
      totalWeightage += weightage;
      totalPerformance += performance;
      const desc = grp.rows[0].description || '';

      const detailBody = grp.rows.map(i=>{
        const hasRemark = !!(i.remark && String(i.remark).trim());
        const itemIndex = items.indexOf(i);
        return `<tr>
          <td>${esc(i.cat)}</td>
          <td>${esc(i.particulars||'—')}</td>
          <td style="text-align:center">${esc(i.target||'—')}</td>
          <td style="text-align:center">${esc(i.actual||'—')}</td>
          <td style="text-align:center"><button type="button" class="remark-icon-btn ${hasRemark?'has-remark':''}" title="${hasRemark?'View / edit remark':(canEditRemark?'Add remark':'No remark')}" onclick="sgOpenItemRemarkModal('${r.id}',${itemIndex})">${hasRemark?'📝':'✏️'}</button></td>
          <td style="text-align:center;font-weight:700">${i.maxScore}</td>
          <td style="text-align:center"><span class="score-badge ${scoreClass(i.memberScore,i.maxScore)}">${i.memberScore||'—'}</span></td>
          <td style="text-align:center">${parseFloat(i.mgrScore)>0?`<span class="score-badge ${scoreClass(i.mgrScore,i.maxScore)}">${i.mgrScore}</span>`:'<span style="font-size:11px;color:var(--text3)">—</span>'}</td>
        </tr>`;
      }).join('');

      const detailTable = `<table class="tbl tbl-fixed tbl-grouped">
        <colgroup>
          <col style="width:13%"><col style="width:33%"><col style="width:8%"><col style="width:8%">
          <col style="width:8%"><col style="width:8%"><col style="width:11%"><col style="width:11%">
        </colgroup>
        <thead><tr>
          <th>Category</th><th>Particulars</th>
          <th class="sg-th-nowrap" style="text-align:center">Target</th>
          <th class="sg-th-nowrap" style="text-align:center">Actual</th>
          <th class="sg-th-nowrap" style="text-align:center">Remark</th>
          <th class="sg-th-nowrap" style="text-align:center">Max</th>
          <th class="sg-th-nowrap" style="text-align:center">Member Score</th>
          <th class="sg-th-nowrap" style="text-align:center">Manager Score</th>
        </tr></thead>
        <tbody>
          ${detailBody}
          <tr class="sg-total-row" style="font-weight:700">
            <td colspan="5">Total</td>
            <td style="text-align:center">${gMax}</td>
            <td style="text-align:center"><span class="score-badge ${scoreClass(gMem,gMax)}">${gMem}</span></td>
            <td style="text-align:center">${gMgr>0?`<span class="score-badge ${scoreClass(gMgr,gMax)}">${gMgr}</span>`:'<span style="color:var(--text3)">—</span>'}</td>
          </tr>
        </tbody>
      </table>`;

      bodyRows += `<tr class="sg-sum-row" id="sgsum-${r.id}-${gi}" onclick="sgToggleGoalDetail('${r.id}',${gi})" style="cursor:pointer">
          <td style="text-align:center;color:var(--text3)">${gi+1}</td>
          <td style="font-weight:600"><span class="sg-sum-caret">▸</span>${esc(grp.goal)}</td>
          <td style="color:var(--text2)">${esc(desc||'—')}</td>
          <td style="text-align:center;font-weight:600">${weightage}%</td>
          <td style="text-align:center;font-weight:700;background:${pctColor(performance)}22;color:${pctColor(performance)}">${performance}%</td>
        </tr>
        <tr class="sg-detail-row">
          <td colspan="5" style="padding:0;border:none;background:transparent">
            <div class="sg-detail-wrap" id="sgd-${r.id}-${gi}"><div class="sg-detail-inner"><div class="sg-detail-panel">${detailTable}</div></div></div>
          </td>
        </tr>`;
    });

    const overallHtml = sgOverallHtml(r.remarks);
    const sheetBHtml = sgSheetBLinkHtml(r.sheetBLink);
    const helpHtml = sgReviewNoteHtml('🆘', 'Help Needed', r.helpNeeded);
    const areasHtml = sgReviewNoteHtml('📈', 'Areas of Improvement', r.areasOfImprovement);
    const summaryHtml = `<div style="margin-bottom:18px">
      <div class="review-section-hd">Summary of Review — ${monthYearLabel(r.year,r.month)} <span style="font-weight:400;font-size:11px;color:var(--text3);text-transform:none;letter-spacing:0">— click a SMART Goal to view its details</span></div>
      ${(overallHtml || sheetBHtml) ? `<div style="margin:10px 0 8px;display:grid;grid-template-columns:minmax(0,1fr) 200px;gap:8px;align-items:start">${overallHtml||'<span></span>'}${sheetBHtml||'<span></span>'}</div>` : ''}
      <div class="tbl-wrap"><table class="tbl tbl-fixed">
        <colgroup>
          <col style="width:5%"><col style="width:22%"><col style="width:47%"><col style="width:13%"><col style="width:13%">
        </colgroup>
        <thead><tr>
          <th style="text-align:center">#</th><th>SMART Goal</th><th>Description</th>
          <th style="text-align:center">Weightage</th><th style="text-align:center">Performance</th>
        </tr></thead>
        <tbody>
          ${bodyRows}
          <tr style="background:var(--surface2);font-weight:700">
            <td colspan="3" style="text-align:right">Total</td>
            <td style="text-align:center">${totalWeightage}%</td>
            <td style="text-align:center">${totalPerformance}%</td>
          </tr>
        </tbody>
      </table></div>
      ${(helpHtml || areasHtml) ? `<div style="margin:12px 0 0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;align-items:start">${helpHtml||'<span></span>'}${areasHtml||'<span></span>'}</div>` : ''}
    </div>`;

    // Collapsed by default: only this header line shows. Click the row to expand details.
    html += `<div class="card sg-review-card" style="margin-bottom:16px">
      <div class="card-header sg-review-hd" onclick="toggleReviewCard(this)" style="flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
          <span class="sg-review-chevron">▶</span>
          <span class="card-title" style="font-weight:700">${esc(academicYearShort(r.year))}</span>
          <span class="card-title">${esc(r.member)}</span>
          <span style="font-size:12px;color:var(--text2)">${esc(monthYearLabel(r.year,r.month))}</span>
          <span style="font-size:11px;color:var(--text3)">${r.date?formatDate(r.date):'—'}</span>
          <span style="font-size:11px;color:var(--text3)">${esc(r.dept||'')}</span>
          ${statusPill}
        </div>
        <div style="font-size:11px;color:var(--text3)">Reviewer: ${esc(r.reviewer||'—')}</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap" onclick="event.stopPropagation()">
          <span class="score-badge" style="background:${pctColor(totalPerformance)}22;color:${pctColor(totalPerformance)};border:1px solid ${pctColor(totalPerformance)}55">Performance: ${totalPerformance}%</span>
          ${(canEditMemberScore(r)||canEditMgrScore(r))?`<button class="btn btn-secondary btn-sm" onclick="openReviewModal('${r.id}')">✏️ Edit</button>`:''}
          ${currentUser.role===ROLES.ADMIN||currentUser.role===ROLES.DEPT_HEAD?`<button class="btn btn-danger btn-sm" onclick="deleteReview('${r.id}')">Delete</button>`:''}
        </div>
      </div>
      <div class="card-body" style="display:none">
        ${summaryHtml}
      </div>
    </div>`;
  });
  document.getElementById('review-list').innerHTML = html;
}

// Reviews render collapsed (header line only); clicking the header expands the detail.
function toggleReviewCard(hdEl) {
  const card = hdEl.closest('.sg-review-card');
  if (!card) return;
  const body = card.querySelector('.card-body');
  const chev = hdEl.querySelector('.sg-review-chevron');
  const isOpen = card.classList.toggle('sg-open');
  if (body) body.style.display = isOpen ? '' : 'none';
  if (chev) chev.textContent = isOpen ? '▼' : '▶';
}

function openReviewModal(id) {
  editingReviewId = id || null;
  ['rf-reviewer','rf-remarks','rf-sheetb'].forEach(fid => document.getElementById(fid).value = '');
  document.getElementById('rf-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('review-score-table').innerHTML = '';
  document.getElementById('rf-helpneeded').value = '';
  document.getElementById('rf-areas').value = '';

  const yearEl = document.getElementById('rf-year');
  const monthEl = document.getElementById('rf-month');
  const deptEl = document.getElementById('rf-dept');
  const memberEl = document.getElementById('rf-member');

  if (id) {
    const r = DB.reviews.find(x=>x.id===id);
    if (r) {
      yearEl.value = r.year; monthEl.value = r.month||''; deptEl.value = r.dept;
      populateReviewMemberDropdown(); memberEl.value = r.member;
      document.getElementById('rf-reviewer').value = r.reviewer||'';
      document.getElementById('rf-date').value = r.date||'';
      document.getElementById('rf-remarks').value = r.remarks||'';
      document.getElementById('rf-sheetb').value = r.sheetBLink||'';
      document.getElementById('rf-helpneeded').value = r.helpNeeded||'';
      document.getElementById('rf-areas').value = r.areasOfImprovement||'';
    }
  } else if (currentUser.role === ROLES.MEMBER) {
    yearEl.value = currentAcademicYearGuess();
    monthEl.value = MONTHS[new Date().getMonth()];
    deptEl.value = currentUser.dept || '';
    populateReviewMemberDropdown();
    memberEl.value = currentUser.name;
  } else {
    yearEl.value = currentAcademicYearGuess();
    monthEl.value = MONTHS[new Date().getMonth()];
    deptEl.value = currentDept || currentUser.dept || '';
    populateReviewMemberDropdown();
    memberEl.value = '';
    document.getElementById('rf-reviewer').value = currentUser.role !== ROLES.ADMIN ? currentUser.name : '';
  }

  // lock member field for member role
  const lockMember = currentUser.role === ROLES.MEMBER;
  memberEl.disabled = lockMember;
  deptEl.disabled = lockMember;
  document.getElementById('rf-reviewer-row').style.display = lockMember ? 'none' : '';

  openModal('review-modal');
  if (id) loadGoalsForReview();
}

function loadGoalsForReview() {
  const year = document.getElementById('rf-year').value;
  const dept = document.getElementById('rf-dept').value;
  const member = document.getElementById('rf-member').value;
  if (!year || !dept || !member) { toast('Select Academic Year, Department and Member first'); return; }

  let goalRows = DB.goals.filter(g => g.year===year && g.dept===dept && g.member===member);
  if (!goalRows.length) {
    document.getElementById('review-score-table').innerHTML = `<p style="color:var(--red);font-size:12px;padding:8px">No SMART Goals found for <strong>${esc(member)}</strong> in <strong>${esc(dept)}</strong> — <strong>${esc(year)}</strong>. Please add SMART Goals for this member first.</p>`;
    return;
  }

  // pull existing saved values, if editing
  const existing = editingReviewId ? DB.reviews.find(x=>x.id===editingReviewId) : null;
  const isMember = currentUser.role === ROLES.MEMBER;
  // Enable each score column by actual permission on THIS review's member:
  //  Member score  -> the member themselves, or Admin.
  //  Manager score -> Admin, that dept's Dept Head, or the assigned Manager.
  const _scopeRef = { member: member, dept: dept };
  const memberDisabled = canEditMemberScore(_scopeRef) ? '' : 'disabled';
  const mgrDisabled   = canEditMgrScore(_scopeRef)   ? '' : 'disabled';

  // group exactly like the SMART Goals tab: one mini-section per SMART Goal (header = goal + weightage bold)
  const groups = groupByGoal(goalRows);
  let html = '';
  groups.forEach(grp => {
    html += `<div class="review-section">
      <div class="review-section-hd">${esc(grp.goal)} <b>(${grp.weightage}%)</b></div>
      <div class="tbl-wrap"><table class="tbl tbl-fixed">
        <colgroup>
          <col style="width:13%"><col style="width:27%"><col style="width:8%"><col style="width:8%">
          <col style="width:16%"><col style="width:8%"><col style="width:10%"><col style="width:10%">
        </colgroup>
        <thead><tr>
          <th>Category</th><th>Particulars</th>
          <th style="text-align:center">Target</th><th style="text-align:center">Actual</th><th style="text-align:center">Remark</th>
          <th style="text-align:center">Max Score</th>
          <th style="text-align:center">Member Score</th>
          <th style="text-align:center">Manager Score</th>
        </tr></thead>
        <tbody class="review-score-group" data-goal="${esc(grp.goal)}" data-max="${grp.rows.reduce((a,g)=>a+(g.maxScore||0),0)}">`;
    grp.rows.forEach(g => {
      const ex = existing?.items?.find(i => i.goalItemId === g.id);
      const maxVal = (ex && typeof ex.maxScore !== 'undefined') ? ex.maxScore : g.maxScore;
      html += `<tr class="review-score-row" data-goal-id="${g.id}" data-goal-name="${esc(g.goal)}" data-weightage="${g.weightage}" data-default-max="${g.maxScore}">
        <td>${esc(g.cat)}</td>
        <td>${esc(g.particulars||'—')}</td>
        <td style="text-align:center"><input type="text" class="item-target" value="${esc(ex?.target||'')}" style="width:100%;border:1px solid var(--border2);border-radius:4px;padding:3px 6px;font-size:12px;font-family:inherit;text-align:center"></td>
        <td style="text-align:center"><input type="text" class="item-actual" value="${esc(ex?.actual||'')}" style="width:100%;border:1px solid var(--border2);border-radius:4px;padding:3px 6px;font-size:12px;font-family:inherit;text-align:center"></td>
        <td style="text-align:center"><input type="text" placeholder="Remark…" class="item-remark" value="${esc(ex?.remark||'')}" style="width:100%;border:1px solid var(--border2);border-radius:4px;padding:3px 7px;font-size:12px;font-family:inherit"></td>
        <td style="text-align:center"><input class="score-input-sm item-maxscore" type="number" min="0" value="${maxVal}" title="Max Score is fetched from SMART Goals, but can be adjusted here" style="width:100%;max-width:64px"></td>
        <td style="text-align:center"><input class="score-input-sm item-memberscore" type="number" min="0" value="${ex?.memberScore||0}" ${memberDisabled} style="width:100%;max-width:64px"></td>
        <td style="text-align:center"><input class="score-input-sm item-mgrscore" type="number" min="0" value="${ex?.mgrScore||0}" ${mgrDisabled} style="width:100%;max-width:64px"></td>
      </tr>`;
    });
    html += `<tr style="background:var(--surface2);font-weight:700">
          <td colspan="5">Total</td>
          <td style="text-align:center;font-size:11px;font-weight:400;color:var(--text3)">recalculated on save</td>
          <td style="text-align:center;font-weight:400;font-size:11px;color:var(--text3)">saved on submit</td>
          <td style="text-align:center;font-weight:400;font-size:11px;color:var(--text3)">saved on submit</td>
        </tr>`;
    html += `</tbody></table></div></div>`;
  });
  document.getElementById('review-score-table').innerHTML = html;
}

function saveReview() {
  const year = document.getElementById('rf-year').value;
  const month = document.getElementById('rf-month').value;
  const dept = document.getElementById('rf-dept').value;
  const member = document.getElementById('rf-member').value;
  if (!year||!month||!dept||!member) { toast('Academic Year, Month, Department and Member are required'); return; }
  const rows = document.querySelectorAll('.review-score-row');
  if (!rows.length) { toast('Load goals first'); return; }
  const items = [];
  rows.forEach(row => {
    const gid = row.dataset.goalId;
    const g = DB.goals.find(x=>x.id===gid); if (!g) return;
    const maxScoreVal = parseFloat(row.querySelector('.item-maxscore').value);
    items.push({
      goalItemId: gid, goal: g.goal, weightage: g.weightage, description: g.description||'', cat: g.cat, particulars: g.particulars,
      maxScore: isNaN(maxScoreVal) ? g.maxScore : maxScoreVal,
      target: row.querySelector('.item-target').value,
      actual: row.querySelector('.item-actual').value,
      remark: row.querySelector('.item-remark').value,
      memberScore: parseFloat(row.querySelector('.item-memberscore').value)||0,
      mgrScore: parseFloat(row.querySelector('.item-mgrscore').value)||0
    });
  });

  // avoid duplicate review records for the same year/month/dept/member
  let existingId = editingReviewId;
  if (!existingId) {
    const dup = DB.reviews.find(r=>r.year===year && r.month===month && r.dept===dept && r.member===member);
    if (dup) existingId = dup.id;
  }
  const rec = {
    id: existingId||uid(), year, month, dept, member,
    reviewer: document.getElementById('rf-reviewer').value,
    date: document.getElementById('rf-date').value,
    remarks: document.getElementById('rf-remarks').value,
    sheetBLink: (document.getElementById('rf-sheetb').value||'').trim(),
    helpNeeded: (document.getElementById('rf-helpneeded').value||'').trim(),
    areasOfImprovement: (document.getElementById('rf-areas').value||'').trim(),
    items
  };
  if (existingId) { const i=DB.reviews.findIndex(x=>x.id===existingId); if(i>-1) DB.reviews[i]=rec; }
  else DB.reviews.push(rec);
  save(); closeModal('review-modal'); renderReviews();
}

// ── Progressive disclosure of a review's per-SMART-Goal detail tables ──
// Each detail table renders collapsed (max-height:0) directly beneath its Summary row. Clicking the row
// toggles it with a smooth max-height transition. Rows are located by id so any review id is safe.
function sgToggleGoalDetail(reviewId, groupIndex) {
  const wrap = document.getElementById('sgd-' + reviewId + '-' + groupIndex);
  if (!wrap) return;
  const row = document.getElementById('sgsum-' + reviewId + '-' + groupIndex);
  const caret = row ? row.querySelector('.sg-sum-caret') : null;
  const willOpen = !wrap.classList.contains('open');

  // clear any pending post-open handler from a previous rapid toggle
  if (wrap._sgEnd) { wrap.removeEventListener('transitionend', wrap._sgEnd); wrap._sgEnd = null; }

  if (willOpen) {
    wrap.classList.add('open');
    if (row) row.classList.add('open');
    if (caret) caret.textContent = '▾';
    wrap.style.maxHeight = wrap.scrollHeight + 'px';   // animate 0 → content height
    const onEnd = function (e) {
      if (e.propertyName !== 'max-height') return;
      if (wrap.classList.contains('open')) wrap.style.maxHeight = 'none'; // allow natural growth after open
      wrap.removeEventListener('transitionend', onEnd);
      wrap._sgEnd = null;
    };
    wrap._sgEnd = onEnd;
    wrap.addEventListener('transitionend', onEnd);
  } else {
    wrap.style.maxHeight = wrap.scrollHeight + 'px';   // pin concrete height (in case it was 'none')
    void wrap.offsetHeight;                            // force reflow so the next change animates
    wrap.classList.remove('open');
    if (row) row.classList.remove('open');
    if (caret) caret.textContent = '▸';
    wrap.style.maxHeight = '0px';                      // animate content height → 0
  }
}

// ── Per-item Remark popup (view/add/edit a single row's remark without opening the full Edit modal) ──
// Items are located by their absolute index in the review's items array. This is robust even if the
// backend round-trip does not preserve a per-item id, and the index maps to the same in-memory object
// regardless of how rows are grouped for display.
let sgRemarkTarget = null;
function sgOpenItemRemarkModal(reviewId, itemIndex) {
  const r = DB.reviews.find(x => x.id === reviewId);
  if (!r) return;
  const item = (r.items || [])[itemIndex];
  if (!item) return;
  const editable = canEditMemberScore(r) || canEditMgrScore(r);
  sgRemarkTarget = { reviewId, itemIndex, editable };

  document.getElementById('ir-context').textContent = [item.cat, item.particulars].filter(Boolean).join(' — ');
  const ta = document.getElementById('ir-remark-text');
  ta.value = item.remark || '';
  ta.disabled = !editable;
  document.getElementById('ir-save-btn').style.display = editable ? '' : 'none';
  document.getElementById('item-remark-modal-title').textContent = editable ? (item.remark ? 'Edit Remark' : 'Add Remark') : 'View Remark';
  openModal('item-remark-modal');
}
function sgSaveItemRemark() {
  if (!sgRemarkTarget || !sgRemarkTarget.editable) return;
  const { reviewId, itemIndex } = sgRemarkTarget;
  const rIdx = DB.reviews.findIndex(x => x.id === reviewId);
  if (rIdx === -1) return;
  const item = (DB.reviews[rIdx].items || [])[itemIndex];
  if (!item) return;
  item.remark = document.getElementById('ir-remark-text').value;
  save();
  closeModal('item-remark-modal');
  renderReviews();
  toast('Remark saved');
}

function deleteReview(id) {
  sgConfirm('Are you sure you want to delete this record?', {title:'Delete review', danger:true, okText:'Delete'}).then(function (ok) {
    if (!ok) return;
    DB.reviews=DB.reviews.filter(r=>r.id!==id);
    save();renderReviews();toast('Review deleted');
  });
}

// ── SETTINGS ──
// Select a department from the Settings > Departments card (toggles off if re-clicked).
function selectSettingsDept(dept) {
  selectDept(currentDept === dept ? '' : dept);
}

function renderSettings() {
  document.getElementById('settings-depts').innerHTML =
    DB.settings.depts.map((item,i)=>{
      const active = item === currentDept;
      return `<div onclick="selectSettingsDept('${escJs(item)}')" title="Click to view this department's team members"
        style="display:flex;align-items:center;gap:8px;padding:9px 10px;border-bottom:1px solid var(--border);cursor:pointer;border-radius:var(--radius);${active?'background:var(--brand-lt);':''}">
        <span style="flex:1;font-size:13px;font-weight:${active?'700':'400'};color:${active?'var(--brand)':'var(--text)'}">${esc(item)}</span>
        ${active?'<span style="font-size:10px;font-weight:700;color:var(--brand);letter-spacing:.04em">SELECTED</span>':''}
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();removeDept(${i})">✕</button>
      </div>`;
    }).join('') || '<p style="font-size:12px;color:var(--text3)">None added yet</p>';

  var membersEl = document.getElementById('settings-members');
  if (!currentDept) {
    membersEl.innerHTML = '<p style="font-size:12.5px;color:var(--text3);padding:6px 0">Select a department from the left to view and manage its team members.</p>';
  } else {
    var rowsHtml = DB.settings.members
      .map(function (m, i) { return { m: m, i: i }; })
      .filter(function (x) { return x.m.dept === currentDept; })
      .map(function (x) {
        var m = x.m, i = x.i;
        var roleLabel = m.role === 'dept_head' ? 'Dept Head' : 'Member';
        return `<div style="display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:1px solid var(--border)">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:13.5px;font-weight:700;color:var(--text)">${esc(m.name)}</span>
            <span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;background:var(--brand-lt);color:var(--brand);border:1px solid var(--brand-border)">${roleLabel}</span>
          </div>
          <div style="font-size:11.5px;color:var(--text3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${esc(m.dept || '— No Dept —')} · ${esc(m.email || 'no email')}
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.managerName ? ('Mgr: ' + esc(m.managerName)) : 'Mgr: —'}</div>
        </div>
        <button class="btn btn-secondary btn-sm" title="Edit member" onclick="openEditMemberModal(${i})">✎ Edit</button>
        <button class="btn btn-danger btn-sm" title="Delete member permanently" onclick="removeMember(${i})">🗑</button>
      </div>`;
      }).join('');
    membersEl.innerHTML = rowsHtml || '<p style="font-size:12px;color:var(--text3)">No team members in '+esc(currentDept)+' yet. Use “+ Add Member”.</p>';
  }

  document.getElementById('settings-admins').innerHTML =
    DB.settings.admins.map((a,i) => `
      <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:13px;font-weight:600;min-width:100px">${esc(a.name)}</span>
        <span style="font-size:12px;color:var(--text3);flex:1">${esc(a.email||'—')}</span>
        <button class="btn btn-danger btn-sm" onclick="removeAdmin(${i})">✕</button>
      </div>`).join('') || '<p style="font-size:12px;color:var(--text3)">None added yet</p>';
}

function updateMemberField(idx, field, val) {
  DB.settings.members[idx][field] = val;
  save(); populateAllSelects(); renderSidebar();
  toast(field==='dept'?'Department updated':field==='email'?'Email updated':'Role updated');
}

function removeDept(idx) {
  sgConfirm('Are you sure you want to delete this record?', {title:'Delete department', danger:true, okText:'Delete'}).then(function (ok) {
    if (!ok) return;
    DB.settings.depts.splice(idx,1); save(); populateAllSelects(); renderSettings(); renderSidebar();
    toast('Department deleted');
  });
}
function removeMember(idx) {
  sgConfirm('Are you sure you want to delete this record?', {title:'Delete team member', danger:true, okText:'Delete'}).then(function (ok) {
    if (!ok) return;
    DB.settings.members.splice(idx,1); save(); populateAllSelects(); renderSettings(); renderSidebar();
    toast('Team member deleted');
  });
}
function removeAdmin(idx) {
  const a = DB.settings.admins[idx];
  sgConfirm('Are you sure you want to delete this record?', {title:'Remove admin', danger:true, okText:'Remove'}).then(function (ok) {
    if (!ok) return;
    DB.settings.admins.splice(idx,1); save(); renderSettings();
    if (a && a.email && window.PlanAdmins && window.PlanAdmins.remove) {
      window.PlanAdmins.remove(a.email)
        .then(function () { toast('Admin removed (access revoked)'); })
        .catch(function () { toast('Removed from list, but revoking access failed'); });
    }
  });
}

function addSetting(key, label) {
  sgPrompt(label, '', {title:'Add ' + label, okText:'Add'}).then(function (val) {
    if (!val || !val.trim()) return;
    if (!DB.settings[key].includes(val.trim())) {
      DB.settings[key].push(val.trim()); save(); populateAllSelects(); renderSettings(); renderSidebar(); toast(`${label} added`);
    } else toast('Already exists');
  });
}

// ── ADD / EDIT MEMBER MODAL ──
var editingMemberId = null;
// Manager picker: choose the reporting manager from existing members + admins
// so the stored email is always a real, loginable account (a typo'd email
// would silently break that manager's review access).
function populateManagerDropdown(selectedEmail, selectedName, excludeName) {
  var el = document.getElementById('am-mgr'); if (!el) return;
  selectedEmail = selectedEmail || ''; selectedName = selectedName || '';
  var lcSel = selectedEmail.toLowerCase();
  var people = [];
  ((DB.settings && DB.settings.members) || []).forEach(function (m) { if (m.email && m.name !== excludeName) people.push({ name: m.name, email: m.email }); });
  ((DB.settings && DB.settings.admins) || []).forEach(function (a) { if (a.email) people.push({ name: a.name || a.email, email: a.email }); });
  var seen = {}, opts = '<option value="">\u2014 None \u2014</option>', matched = false;
  people.forEach(function (p) {
    var key = (p.email || '').toLowerCase(); if (!key || seen[key]) return; seen[key] = 1;
    var sel = (key === lcSel) ? ' selected' : ''; if (sel) matched = true;
    opts += '<option value="' + esc(p.email) + '" data-name="' + esc(p.name) + '"' + sel + '>' + esc(p.name) + ' \u2014 ' + esc(p.email) + '</option>';
  });
  if (selectedEmail && !matched) {
    opts += '<option value="' + esc(selectedEmail) + '" data-name="' + esc(selectedName) + '" selected>' + esc(selectedName || selectedEmail) + ' \u2014 ' + esc(selectedEmail) + ' (not in list)</option>';
  }
  el.innerHTML = opts;
  syncMgrEmail();
}
function syncMgrEmail() {
  var el = document.getElementById('am-mgr');
  var box = document.getElementById('am-mgr-email');
  if (el && box) box.value = el.value || '';
}

function openAddMemberModal() {
  editingMemberId = null;
  document.getElementById('am-modal-title').textContent = 'Add Team Member';
  document.getElementById('am-name').value = '';
  document.getElementById('am-role').value = 'member';
  document.getElementById('am-email').value = '';
  populateSelect('am-dept', DB.settings.depts, 'Select…');
  document.getElementById('am-dept').value = currentDept || '';
  populateManagerDropdown('', '', '');
  document.getElementById('am-mgr-email').value = '';
  openModal('add-member-modal');
}
function openEditMemberModal(i) {
  var m = DB.settings.members[i];
  if (!m) return;
  editingMemberId = m.id;
  document.getElementById('am-modal-title').textContent = 'Edit Team Member';
  populateSelect('am-dept', DB.settings.depts, 'Select…');
  document.getElementById('am-dept').value = m.dept || '';
  document.getElementById('am-name').value = m.name || '';
  document.getElementById('am-role').value = m.role || 'member';
  document.getElementById('am-email').value = m.email || '';
  populateManagerDropdown(m.managerEmail || '', m.managerName || '', m.name || '');
  document.getElementById('am-mgr-email').value = m.managerEmail || '';
  openModal('add-member-modal');
}

function saveNewMember() {
  const dept = document.getElementById('am-dept').value;
  const name = document.getElementById('am-name').value.trim();
  const role = document.getElementById('am-role').value;
  const email = document.getElementById('am-email').value.trim();
  const mgrSel = document.getElementById('am-mgr');
  const mgrEmail = mgrSel ? (mgrSel.value || '') : '';
  const mgrOpt = mgrSel && mgrSel.selectedOptions && mgrSel.selectedOptions[0];
  const managerName = mgrOpt ? (mgrOpt.getAttribute('data-name') || '') : '';
  if (mgrEmail && email && mgrEmail.toLowerCase() === email.toLowerCase()) { toast('A member cannot be their own manager'); return; }
  if (!dept) { toast('Department is required'); return; }
  if (!name) { toast('Member name is required'); return; }
  if (editingMemberId) {
    const idx = DB.settings.members.findIndex(function (x) { return x.id === editingMemberId; });
    if (idx < 0) { editingMemberId = null; toast('Member not found'); return; }
    const clash = DB.settings.members.some(function (x, j) { return j !== idx && x.name === name; });
    if (clash) { toast('Another member already has that name'); return; }
    // Capture the old name BEFORE overwriting the row, so the cascade
    // knows what to look for in goals / tasks / reviews.
    const prevName = DB.settings.members[idx].name;
    DB.settings.members[idx] = { id: editingMemberId, name, dept, role, email, managerName, managerEmail: mgrEmail };
    editingMemberId = null;
    const relinked = cascadeMemberRename(prevName, name);
    save(); populateAllSelects(); renderSettings(); renderSidebar();
    // Renaming changes what every view is filtered by, so redraw them too.
    try { renderDashboard(); renderSmartGoals(); renderPlan(); renderReviews(); } catch (e) {}
    closeModal('add-member-modal');
    toast(relinked
        ? `${name} updated \u00b7 ${relinked} linked record(s) renamed`
        : `${name} updated`);
    return;
  }
  if (memberNames().includes(name)) { toast('Member already exists'); return; }
  DB.settings.members.push({id:uid(), name, dept, role, email, managerName, managerEmail: mgrEmail});
  save(); populateAllSelects(); renderSettings(); renderSidebar();
  closeModal('add-member-modal');
  toast(`${name} added`);
}

// ── ADD ADMIN MODAL ──
function openAddAdminModal() {
  document.getElementById('aa-name').value = '';
  document.getElementById('aa-email').value = '';
  openModal('add-admin-modal');
}
function saveNewAdmin() {
  const name = document.getElementById('aa-name').value.trim();
  const email = document.getElementById('aa-email').value.trim();
  if (!name) { toast('Name is required'); return; }
  if (!email) { toast('Email is required — it grants Settings access'); return; }
  DB.settings.admins.push({id:uid(), name, email});
  save(); renderSettings();
  closeModal('add-admin-modal');
  // Grant real access by writing to the Firestore "Plan Admin" collection.
  if (window.PlanAdmins && window.PlanAdmins.add) {
    window.PlanAdmins.add(email)
      .then(function () { toast(name + ' added as Admin (access granted)'); })
      .catch(function (e) { toast('Saved, but granting access failed: ' + ((e && e.message) || e)); });
  } else {
    toast(name + ' added — grant access in Firestore "Plan Admin" manually');
  }
}

// ── MODALS ──
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── In-app confirm / prompt (website popup, not the browser's) ──
var _sgDlgResolve = null;
var _sgDlgMode = 'confirm';
function sgConfirm(message, opts) {
  opts = opts || {};
  return new Promise(function (resolve) {
    _sgDlgResolve = resolve; _sgDlgMode = 'confirm';
    document.getElementById('sg-confirm-title').textContent = opts.title || 'Please confirm';
    document.getElementById('sg-confirm-msg').textContent = message || 'Are you sure?';
    document.getElementById('sg-confirm-input-wrap').style.display = 'none';
    var ok = document.getElementById('sg-confirm-ok');
    ok.textContent = opts.okText || 'Confirm';
    ok.className = 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary');
    openModal('sg-confirm-modal');
  });
}
function sgPrompt(label, defaultVal, opts) {
  opts = opts || {};
  return new Promise(function (resolve) {
    _sgDlgResolve = resolve; _sgDlgMode = 'prompt';
    document.getElementById('sg-confirm-title').textContent = opts.title || 'Enter a value';
    document.getElementById('sg-confirm-msg').textContent = opts.message || '';
    document.getElementById('sg-confirm-input-wrap').style.display = '';
    document.getElementById('sg-confirm-input-label').textContent = label || '';
    var inp = document.getElementById('sg-confirm-input');
    inp.value = defaultVal || '';
    var ok = document.getElementById('sg-confirm-ok');
    ok.textContent = opts.okText || 'Add';
    ok.className = 'btn btn-primary';
    openModal('sg-confirm-modal');
    setTimeout(function () { inp.focus(); }, 40);
  });
}
function sgConfirmOk() {
  var mode = _sgDlgMode, resolve = _sgDlgResolve; _sgDlgResolve = null;
  closeModal('sg-confirm-modal');
  if (!resolve) return;
  resolve(mode === 'prompt' ? document.getElementById('sg-confirm-input').value : true);
}
function sgConfirmCancel() {
  var mode = _sgDlgMode, resolve = _sgDlgResolve; _sgDlgResolve = null;
  closeModal('sg-confirm-modal');
  if (!resolve) return;
  resolve(mode === 'prompt' ? null : false);
}
document.querySelectorAll('.modal-backdrop').forEach(m=>{
  m.addEventListener('click',e=>{ if(e.target===m) m.classList.remove('open'); });
});

// ── EXPORT / IMPORT ──
function exportData() {
  const blob=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='olf_tracker_'+new Date().toISOString().split('T')[0]+'.json';a.click();
  toast('Data exported');
}
function importData(e) {
  const file=e.target.files[0];if(!file) return;
  const r=new FileReader();r.onload=ev=>{
    try{
      const data=JSON.parse(ev.target.result);
      if(!data.tasks||!data.goals){toast('Invalid file format');return;}
      DB=data;
      if(!DB.uiPrefs) DB.uiPrefs={hiddenPlanCols:[]};
      if(!DB.settings.admins) DB.settings.admins=[];
      save();populateAllSelects();renderDashboard();renderSidebar();showPage('dashboard');toast('Data imported');
    }catch{toast('Failed to parse JSON');}
  };
  r.readAsText(file);
}
function clearAll() { DB=JSON.parse(JSON.stringify(DEFAULT));save();populateAllSelects();renderDashboard();renderSidebar();toast('All data cleared'); }

// ── SIDEBAR ──
let sidebarCollapsed = false;
let openDepts = new Set();

function toggleSidebar() {
  var el = document.getElementById('app-sidebar');
  if (!el) return;
  sidebarCollapsed = !sidebarCollapsed;
  el.classList.toggle('collapsed', sidebarCollapsed);
}

function deptInitial(name) {
  return name.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
}

function deptColor(idx) {
  const colors = ['#0D6B5E','#2E5FA3','#C07C0A','#4C1D95','#084D44','#5A6B7A','#1F3F6E'];
  return colors[idx % colors.length];
}

function renderSidebar() {
  const scrollEl = document.getElementById('sidebar-scroll');
  if (!scrollEl) return; // sidebar removed — nothing to render
  const depts = DB.settings.depts;
  let html = '';

  const allActive = !currentDept ? 'active-dept' : '';
  html += `<div class="sb-all ${allActive}" onclick="selectDept('')">
    <span class="sb-all-icon">🏢</span>
    <span style="transition:opacity .15s">All Departments</span>
  </div>`;

  html += '<div class="sb-divider"></div>';

  depts.forEach((dept, idx) => {
    const isOpen = openDepts.has(dept);
    const isActive = currentDept === dept ? 'active-dept' : '';
    const color = deptColor(idx);
    const initial = deptInitial(dept);

    const deptTasks = DB.tasks.filter(t => t.dept === dept);
    const deptGoals = DB.goals.filter(g => g.dept === dept);
    const done = deptTasks.filter(t => t.status === 'Completed').length;
    const total = deptTasks.length;
    const memberList = DB.settings.members.filter(m => m.dept === dept).map(m => m.name);

    html += `<div class="sb-dept">
      <div class="sb-dept-hd ${isOpen?'open':''} ${isActive}" onclick="toggleDept(event,'${esc(dept)}')">
        <div class="sb-dept-icon" style="background:${color}">${initial}</div>
        <span class="sb-dept-name">${esc(dept)}</span>
        <span class="sb-dept-arrow">▶</span>
      </div>
      <div class="sb-dept-children">
        <div class="sb-dept-stats">
          <span class="sb-stat-pill" style="background:var(--green-lt);color:var(--green)">${done} done</span>
          <span class="sb-stat-pill" style="background:var(--blue-lt);color:var(--blue)">${total} tasks</span>
          <span class="sb-stat-pill" style="background:var(--brand-lt);color:var(--brand)">${deptGoals.length} goals</span>
        </div>
        ${memberList.map(m => {
          const mTasks = deptTasks.filter(t => t.member === m);
          const mDone = mTasks.filter(t => t.status === 'Completed').length;
          return `<div class="sb-member" onclick="selectDeptAndMember('${esc(dept)}','${esc(m)}')">
            <span class="sb-member-dot"></span>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis">${esc(m)}</span>
            <span style="font-size:10px;color:var(--text3);margin-left:4px">${mDone}/${mTasks.length}</span>
          </div>`;
        }).join('')}
        ${memberList.length === 0 ? `<div style="font-size:11px;color:var(--text3);padding:4px 8px 4px 36px">No members yet</div>` : ''}
      </div>
    </div>`;
  });

  document.getElementById('sidebar-scroll').innerHTML = html;
}

function toggleDept(e, dept) {
  if (openDepts.has(dept)) openDepts.delete(dept); else openDepts.add(dept);
  if (sidebarCollapsed) { sidebarCollapsed = false; document.getElementById('app-sidebar').classList.remove('collapsed'); }
  selectDept(dept);
}

function selectDept(dept) {
  currentDept = dept;
  document.getElementById('global-dept').value = dept;
  const ddf = document.getElementById('dash-dept-filter'); if (ddf) ddf.value = dept;
  document.getElementById('nav-dept-label').textContent = dept ? `Viewing: ${dept}` : '';
  const deptLabel = dept ? `— ${esc(dept)}` : '';
  ['dash-dept-label','sg-dept-label','mp-dept-label','rv-dept-label'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.textContent = el.textContent.replace(/\s*—.*$/,'') + (dept ? ` — ${dept}` : '');
  });
  renderSidebar();
  renderPage(getCurrentPageId());
}

function selectDeptAndMember(dept, member) {
  selectDept(dept);
  showPage('monthly-plan');
  const mpMember = document.getElementById('mp-member');
  if (mpMember) { mpMember.value = member; renderPlan(); }
}





/* ================================================================
   OLF Staff Connect integration  (JSONP transport + diff sync)
   Added by build step — not part of the original prototype.
================================================================ */
var CONFIG = {
  // ▼▼▼  PASTE your deployed Apps Script /exec URL here  ▼▼▼
  GAS_WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbzaJ0wcsPqQQicaiziKw0JYJ_NgRSvGOi0ipJoN6V1AQNn7QGj_KM6FySIPe39KwmOn/exec',
  REQUEST_TIMEOUT_MS: 20000
};

var currentEmail = '';
var loadedOnce = false;
var syncEnabled = false;
var mounted = false;
var _shadow = null;
var _inflight = 0;
var _flushing = false;   // an outbox flush pass is currently running
var _flushTimer = null;  // pending scheduled retry
var _outbox = null;      // in-memory mirror of the durable localStorage outbox
var _noBatch = false;    // set true if the deployed backend predates saveBatch

function sgShowLoader() { var o = document.getElementById('sg-loader'); if (o) o.classList.add('open'); }
function sgHideLoader() { var o = document.getElementById('sg-loader'); if (o) o.classList.remove('open'); }
function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

// ── TRANSPORT (JSONP → Apps Script Web App) ──
function jsonp(params) {
  return new Promise(function (resolve, reject) {
    if (!CONFIG.GAS_WEB_APP_URL || CONFIG.GAS_WEB_APP_URL.indexOf('PASTE_') === 0) {
      reject(new Error('smartgoal.js: set CONFIG.GAS_WEB_APP_URL to your deployed /exec URL.')); return;
    }
    var cb = 'sgCb_' + Date.now() + '_' + Math.floor(Math.random() * 1e9);
    var script = document.createElement('script');
    var done = false;
    var timer = setTimeout(function () { finish(new Error('Request timed out. Check the Web App URL and that access is "Anyone".')); }, CONFIG.REQUEST_TIMEOUT_MS);
    function cleanup() { clearTimeout(timer); try { delete window[cb]; } catch (e) { window[cb] = undefined; } if (script.parentNode) script.parentNode.removeChild(script); }
    function finish(err, data) { if (done) return; done = true; cleanup(); if (err) reject(err); else resolve(data); }
    window[cb] = function (data) { finish(null, data); };
    var qs = Object.keys(params).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k] == null ? '' : params[k]); }).join('&');
    script.src = CONFIG.GAS_WEB_APP_URL + '?' + qs + '&callback=' + cb + '&_t=' + Date.now();
    script.onerror = function () { finish(new Error('Network error contacting the Smart Goals server.')); };
    document.head.appendChild(script);
  });
}
// A review item's goal / weightage / description / cat / particulars are all
// derivable from its goalItemId, so we DON'T send them over the wire — the backend
// backfills them from the Goals sheet. JSONP is GET-only, so the whole payload
// rides in the URL; a large review carrying those repeated fields blows past the
// URL-length limit and the save silently fails. Local data keeps the FULL items
// (rendering needs them); only this network copy is slimmed.
function _slimReviewItems(rev) {
  if (!rev || !rev.items) return rev;
  var out = {}; for (var k in rev) { if (rev.hasOwnProperty(k)) out[k] = rev[k]; }
  out.items = rev.items.map(function (it) {
    return { goalItemId: it.goalItemId, maxScore: it.maxScore, target: it.target,
             actual: it.actual, remark: it.remark, memberScore: it.memberScore, mgrScore: it.mgrScore };
  });
  return out;
}
function _wirePayload(action, payload) {
  if (action === 'saveReview') return _slimReviewItems(payload);
  if (action === 'saveBatch' && payload && payload.ops) {
    return { ops: payload.ops.map(function (op) { return { action: op.action, payload: _wirePayload(op.action, op.payload) }; }) };
  }
  return payload;
}
// Fallback transport for a request too big for a GET URL: POST the payload in the
// body (no URL-length limit). text/plain keeps it a 'simple' request (no CORS
// preflight); Apps Script redirects to a googleusercontent URL that allows the
// cross-origin read, so we can read the JSON back. Only used for oversize writes,
// so the common JSONP path is untouched.
function _postApi(action, wire) {
  return fetch(CONFIG.GAS_WEB_APP_URL + '?action=' + encodeURIComponent(action), {
    method: 'POST', redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(wire == null ? {} : wire)
  }).then(function (r) { return r.json(); });
}
function api(action, payload) {
  // TRANSPORT SWAP: use the Supabase data store when the adapter is present.
  // Resolves to the same `data` shape and throws on error, so the outbox,
  // snapshot and retry logic below are unchanged. Falls back to the original
  // GAS/JSONP path automatically if sg-supabase.js failed to load.
  if (window.SG_SUPA && typeof window.SG_SUPA.call === 'function') {
    return window.SG_SUPA.call(action, payload || {});
  }
  var wire = _wirePayload(action, payload);
  var params = { action: action };
  if (wire) params.payload = JSON.stringify(wire);
  // Estimate the GET URL length (params + &callback=..&_t=..). If it would be too
  // long for a URL, POST instead; otherwise use the proven JSONP path.
  var getUrlLen = CONFIG.GAS_WEB_APP_URL.length + 1 + 60 +
    Object.keys(params).reduce(function (a, k) {
      return a + k.length + 1 + encodeURIComponent(params[k] == null ? '' : params[k]).length + 1;
    }, 0);
  var call = (getUrlLen > 8000) ? _postApi(action, wire) : jsonp(params);
  return call.then(function (res) {
    if (!res || res.ok === false) throw new Error((res && res.error) || 'Server error');
    return res.data;
  });
}

// ── USER / ROLE (from Firebase auth, provided by app.js) ──
function resolveUser() {
  var u = window.SMART_GOALS_USER || {};
  currentEmail = (u.email || '').toLowerCase();
  if (u.isAdmin) { currentUser = { name: (u.email || 'Admin'), dept: '', role: ROLES.ADMIN }; return; }
  var members = (DB.settings && DB.settings.members) || [];
  var m = null;
  for (var i = 0; i < members.length; i++) {
    if ((members[i].email || '').toLowerCase() === currentEmail) { m = members[i]; break; }
  }
  if (m) currentUser = { name: m.name, dept: m.dept || '', role: m.role || ROLES.MEMBER };
  else   currentUser = { name: (u.email || 'Viewer'), dept: '', role: ROLES.MEMBER };
}

// ── DATA LOAD ──
function _uiPrefsKey() {
  var u = (window.SMART_GOALS_USER && window.SMART_GOALS_USER.email) || 'anon';
  return 'sg_uiPrefs_' + u;
}
function loadUiPrefs() {
  try {
    var raw = localStorage.getItem(_uiPrefsKey());
    if (raw == null) raw = localStorage.getItem('sg_uiPrefs'); // migrate old global key
    var v = JSON.parse(raw || 'null');
    if (v && Array.isArray(v.hiddenPlanCols)) return { hiddenPlanCols: v.hiddenPlanCols };
  } catch (e) {}
  return { hiddenPlanCols: [] };
}
// Persist column show/hide choices under a per-user key so a background sync or a
// second account on the same browser can never clobber them.
function saveUiPrefs() {
  try { localStorage.setItem(_uiPrefsKey(), JSON.stringify(DB.uiPrefs || { hiddenPlanCols: [] })); } catch (e) {}
}
// ── Client snapshot: instant first paint across full page reloads ──
// Stores the last-seen data in localStorage so the page renders immediately on
// load (no spinner), then refreshes from the server in the background. This is
// CLIENT-SIDE ONLY — it never writes to or affects the Google Sheets. Keyed per
// user so different accounts on the same browser never mix.
function _snapKey() {
  var u = (window.SMART_GOALS_USER && window.SMART_GOALS_USER.email) || 'anon';
  return 'sg_snapshot_' + u;
}
function saveSnapshot() {
  try {
    localStorage.setItem(_snapKey(), JSON.stringify({
      settings: DB.settings, goals: DB.goals, tasks: DB.tasks, reviews: DB.reviews
    }));
  } catch (e) { /* quota / serialize issue — ignore; we just lose the fast-paint boost */ }
}
function loadSnapshot() {
  try { var v = JSON.parse(localStorage.getItem(_snapKey()) || 'null'); if (v && v.settings) return v; }
  catch (e) {}
  return null;
}

function loadAll(fresh) {
  // Deliver anything still queued (from this or a previous session) BEFORE
  // pulling server truth, so a refresh can't race past an unsaved change.
  return flushOutbox().then(function () {
    return api('getAll', fresh ? { fresh: 1 } : null);
  }).then(function (data) {
    data = data || {};
    var s = data.settings || {};
    var next = {
      settings: {
        depts:      s.depts || [],
        members:    s.members || [],
        admins:     s.admins || [],
        goalNames:  s.goalNames || [],
        categories: s.categories || []
      },
      goals:   data.goals   || [],
      tasks:   data.tasks   || [],
      reviews: data.reviews || [],
      uiPrefs: loadUiPrefs()
    };
    // SAFETY: an empty server read while we already hold data locally is
    // treated as a transient glitch — keep the local data rather than wipe it.
    var serverEmpty = !next.settings.members.length && !next.settings.depts.length &&
                      !next.goals.length && !next.tasks.length && !next.reviews.length;
    var haveLocal = DB && ((DB.settings && DB.settings.members && DB.settings.members.length) ||
                    (DB.goals && DB.goals.length) || (DB.tasks && DB.tasks.length) || (DB.reviews && DB.reviews.length));
    if (serverEmpty && haveLocal) {
      console.warn('[SmartGoals] empty server read ignored to protect local data');
      syncEnabled = true; loadedOnce = true; updateUnsavedBanner();
      return;
    }
    // Overlay still-pending writes so a refresh never hides an unsaved edit.
    applyOutboxTo(next);
    DB = next;
    _shadow = deepCopy(DB);
    syncEnabled = true;
    loadedOnce = true;
    saveSnapshot();
    updateUnsavedBanner();
  });
}

// ── DIFF-BASED SYNC (one small write per changed record; JSONP-safe) ──
// Small, NON-BLOCKING save indicator so the page stays fully interactive while a
// background write finishes. state: 'saving' | 'saved' | 'hide'. Purely visual —
// pointer-events:none means it never intercepts clicks. Shared by ALL write
// points (add/edit goal, add/edit task, add/edit review, settings, deletes).
// ── Stacked save toasts (bottom-right): one per save action, "Saving…" -> "Saved". ──
// Each toast is bound to the outbox keys that save touched and flips to "Saved" only
// once the SERVER confirms them (honest feedback, not just the optimistic local
// update). Rapid saves stack so the user can see how many are still in flight.
var _saveToasts = [];
var _saveDeliveredTs = {};   // outbox key -> highest ts the server has confirmed
function _saveStack() {
  var c = document.getElementById('sg-save-stack');
  if (c) return c;
  if (!document.getElementById('sg-save-stack-css')) {
    var st = document.createElement('style'); st.id = 'sg-save-stack-css';
    st.textContent = '@keyframes sgSpin{to{transform:rotate(360deg)}}'
      + '#sg-save-stack{position:fixed;right:18px;bottom:18px;z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:flex-end;pointer-events:none}'
      + '.sg-stoast{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:22px;font-family:inherit;font-size:12px;font-weight:600;line-height:1;box-shadow:0 4px 14px rgba(0,0,0,.15);opacity:0;transform:translateY(6px);transition:opacity .18s ease,transform .18s ease}'
      + '.sg-stoast.show{opacity:1;transform:translateY(0)}'
      + '.sg-stoast.saving{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}'
      + '.sg-stoast.saved{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}'
      + '.sg-stoast .sg-sp{width:12px;height:12px;border-radius:50%;border:2px solid currentColor;border-top-color:transparent;animation:sgSpin .7s linear infinite}'
      + '.sg-stoast .sg-ck{font-size:13px;font-weight:800}';
    document.head.appendChild(st);
  }
  c = document.createElement('div'); c.id = 'sg-save-stack';
  (document.getElementById('sg-app') || document.body).appendChild(c);
  return c;
}
function sgSaveToast(bound) {
  bound = (bound || []).filter(function (b) { return b && b.key; });
  var el = document.createElement('div');
  el.className = 'sg-stoast saving';
  el.innerHTML = '<span class="sg-sp"></span><span>Saving…</span>';
  _saveStack().appendChild(el);
  requestAnimationFrame(function () { el.classList.add('show'); });
  var t = { el: el, keys: bound, done: false };
  _saveToasts.push(t);
  _saveToastCheck(t);   // maybe there was nothing to send / already delivered
  return t;
}
function _saveToastCheck(t) {
  if (t.done) return;
  var ob = outbox();
  var allIn = !t.keys.length || t.keys.every(function (b) {
    if ((_saveDeliveredTs[b.key] || 0) >= b.ts) return true;   // server confirmed this or newer data
    if (!ob[b.key]) return true;                               // no longer queued -> delivered
    return false;
  });
  if (!allIn) return;
  t.done = true;
  t.el.className = 'sg-stoast saved show';
  t.el.innerHTML = '<span class="sg-ck">✓</span><span>Saved</span>';
  setTimeout(function () {
    t.el.classList.remove('show');
    setTimeout(function () {
      if (t.el.parentNode) t.el.parentNode.removeChild(t.el);
      var i = _saveToasts.indexOf(t); if (i > -1) _saveToasts.splice(i, 1);
    }, 220);
  }, 1400);
}
// Called from the flush paths whenever the server confirms an outbox key at a ts.
function _saveDelivered(key, ts) {
  if (!key) return;
  if ((_saveDeliveredTs[key] || 0) < ts) _saveDeliveredTs[key] = ts;
  for (var i = _saveToasts.length - 1; i >= 0; i--) _saveToastCheck(_saveToasts[i]);
}
// The single corner pill is superseded by the stacked per-save toasts above; kept
// as a no-op so existing call sites remain harmless.
function sgSavePill(state) { return; }
function _sgSavePill_legacy(state) {
  var id = 'sg-save-pill';
  var el = document.getElementById(id);
  if (state === 'hide') { if (el) el.style.opacity = '0'; return; }
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:9999;padding:7px 14px;'
      + 'border-radius:20px;font-size:12px;font-weight:600;font-family:inherit;pointer-events:none;'
      + 'transition:opacity .2s;box-shadow:0 4px 14px rgba(0,0,0,.15);opacity:0;';
    (document.getElementById('sg-app') || document.body).appendChild(el);
  }
  if (state === 'saving') {
    el.textContent = 'Saving\u2026';
    el.style.background = '#fff7ed'; el.style.color = '#9a3412'; el.style.border = '1px solid #fed7aa';
  } else {
    el.textContent = 'Saved';
    el.style.background = '#f0fdf4'; el.style.color = '#166534'; el.style.border = '1px solid #bbf7d0';
  }
  el.style.opacity = '1';
}

// Background write: the UI has already updated optimistically, so we DON'T block
// the page with the full-screen loader. A small corner pill shows progress; a
// failure still surfaces via toast. Sync/persistence logic is unchanged.
// ════════════════════════════════════════════════════════════════════
// DURABLE OUTBOX  —  guarantees no saved change is ever silently dropped.
//
// Every change becomes an entry in a per-user localStorage queue, keyed by
// the record it targets (so the newest edit to a record supersedes older
// queued ones). Entries are retried until the server confirms them, survive
// page reloads, and are re-applied on top of any server refresh so a reload
// never hides an unsaved edit. This is what fixes 'network error -> progress
// not saved': the write simply stays queued and keeps retrying, with a
// visible banner, until it lands.
// ════════════════════════════════════════════════════════════════════
function _outboxKey() { var u = (window.SMART_GOALS_USER && window.SMART_GOALS_USER.email) || 'anon'; return 'sg_outbox_' + u; }
function _outboxLoad() { try { var v = JSON.parse(localStorage.getItem(_outboxKey()) || 'null'); return (v && typeof v === 'object') ? v : {}; } catch (e) { return {}; } }
function _outboxSave(m) { try { localStorage.setItem(_outboxKey(), JSON.stringify(m)); } catch (e) { /* quota — keep in-memory copy */ } }
function outbox() { if (!_outbox) _outbox = _outboxLoad(); return _outbox; }
function outboxCount() { return Object.keys(outbox()).length; }
function outboxAdd(key, action, payload) { var m = outbox(); m[key] = { action: action, payload: payload, ts: Date.now(), tries: 0 }; _outboxSave(m); }

// Persistent, tappable 'not yet saved' indicator so a failed write is never
// mistaken for a successful one. Hidden automatically once the queue drains.
function updateUnsavedBanner() {
  // Single, quiet save indicator (bottom-right corner). No separate centre
  // banner, no count, no 'tap to retry' -- retries run automatically. While any
  // change is still queued we just keep showing the 'Saving' pill; once the
  // queue drains the flush shows 'Saved' briefly and hides. Any leftover centre
  // banner from a previous build is removed on sight.
  var legacy = document.getElementById('sg-unsaved-banner');
  if (legacy && legacy.parentNode) legacy.parentNode.removeChild(legacy);
  if (outboxCount() > 0) sgSavePill('saving');
}

// Flush the whole queue in ONE request via the backend 'saveBatch' action, so a
// save is a single round-trip no matter how many records changed (the old code
// sent them one-by-one). The batch is size-bounded because JSONP is a GET and
// the encoded payload must stay within URL limits: small writes collapse into
// one request; a large queue drains across a few quick passes (at least one
// entry always goes, so a single big review still sends fine). A queued edit is
// cleared only when the server confirms it AND it wasn't superseded by a newer
// edit while in flight (matched on its timestamp) -- so no change is ever
// silently dropped. If the deployed backend predates saveBatch we permanently
// fall back to per-entry sends (still nothing is lost).
function _flushSettle(delay) {
  _flushing = false;
  if (outboxCount() === 0) { sgSavePill('saved'); setTimeout(function () { sgSavePill('hide'); }, 1200); }
  else scheduleFlush(typeof delay === 'number' ? delay : 2500);
  updateUnsavedBanner();
}
function _flushSequential(sending) {
  return sending.reduce(function (chain, s) {
    return chain.then(function () {
      return api(s.action, s.payload).then(function () {
        var mm = outbox(); if (mm[s.key] && mm[s.key].ts === s.ts) { delete mm[s.key]; _outboxSave(mm); }
        if (typeof _saveDelivered === 'function') _saveDelivered(s.key, s.ts);
      }).catch(function () {
        var mm = outbox(); if (mm[s.key] && mm[s.key].ts === s.ts) { mm[s.key].tries = (mm[s.key].tries || 0) + 1; _outboxSave(mm); }
      });
    });
  }, Promise.resolve());
}
function flushOutbox() {
  if (_flushing) return Promise.resolve();
  var m = outbox(); var keys = Object.keys(m);
  if (!keys.length) { updateUnsavedBanner(); return Promise.resolve(); }
  _flushing = true; sgSavePill('saving');
  // Build a size-bounded batch (keep the encoded GET URL within limits).
  var sending = [], approx = 0, LIMIT = 4000;
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i], e = m[k];
    var sz = JSON.stringify(e.payload || {}).length + String(e.action || '').length + 8;
    if (sending.length && approx + sz > LIMIT) break;
    sending.push({ key: k, ts: e.ts, action: e.action, payload: e.payload });
    approx += sz;
  }
  if (_noBatch) return _flushSequential(sending).then(function () { _flushSettle(300); }, function () { _flushSettle(4000); });
  var ops = sending.map(function (s) { return { action: s.action, payload: s.payload }; });
  return api('saveBatch', { ops: ops }).then(function (res) {
    var results = (res && res.results) || [];
    var mm = outbox();
    sending.forEach(function (s, i) {
      var r = results[i]; var ok = r ? (r.ok !== false) : false; var cur = mm[s.key];
      if (ok) { if (cur && cur.ts === s.ts) delete mm[s.key]; if (typeof _saveDelivered === 'function') _saveDelivered(s.key, s.ts); }
      else if (cur && cur.ts === s.ts) cur.tries = (cur.tries || 0) + 1;
    });
    _outboxSave(mm);
    _flushSettle(300); // more may remain (size-bounded) -> drain quickly
  }).catch(function (err) {
    if (err && /unknown action/i.test(err.message || '')) { _noBatch = true; return _flushSequential(sending).then(function () { _flushSettle(300); }, function () { _flushSettle(4000); }); }
    _flushSettle(4000); // transient network/timeout -> keep queued, back off
  });
}
function scheduleFlush(delay) {
  if (_flushTimer) return;
  _flushTimer = setTimeout(function () { _flushTimer = null; flushOutbox(); }, delay || 3000);
}

// Re-apply still-pending writes on top of a fresh server snapshot, so a
// background refresh can never blank out an edit that hasn't been saved yet.
function _listKeyFor(type) { return type === 'dept' ? 'depts' : (type === 'goalName' ? 'goalNames' : (type === 'category' ? 'categories' : null)); }
function _upsertInto(arr, obj) { if (!obj || obj.id == null) return; for (var i = 0; i < arr.length; i++) { if (arr[i].id === obj.id) { arr[i] = obj; return; } } arr.push(obj); }
function _removeFrom(arr, id) { for (var i = arr.length - 1; i >= 0; i--) { if (arr[i].id === id) arr.splice(i, 1); } }
function _addToList(settings, type, value) { var k = _listKeyFor(type); if (!k) return; settings[k] = settings[k] || []; if (settings[k].indexOf(value) === -1) settings[k].push(value); }
function _removeFromList(settings, type, value) { var k = _listKeyFor(type); if (!k || !settings[k]) return; settings[k] = settings[k].filter(function (v) { return v !== value; }); }
function applyOutboxTo(db) {
  var m = outbox();
  Object.keys(m).forEach(function (key) {
    var e = m[key]; if (!e) return; var a = e.action, p = e.payload || {};
    try {
      if (a === 'saveGoal') _upsertInto(db.goals, p);
      else if (a === 'deleteGoal') _removeFrom(db.goals, p.id);
      else if (a === 'saveTask') _upsertInto(db.tasks, p);
      else if (a === 'deleteTask') _removeFrom(db.tasks, p.id);
      else if (a === 'saveReview') _upsertInto(db.reviews, p);
      else if (a === 'deleteReview') _removeFrom(db.reviews, p.id);
      else if (a === 'saveMember') _upsertInto(db.settings.members, p);
      else if (a === 'removeMember') _removeFrom(db.settings.members, p.id);
      else if (a === 'saveAdmin') _upsertInto(db.settings.admins, p);
      else if (a === 'removeAdmin') _removeFrom(db.settings.admins, p.id);
      else if (a === 'addListItem') _addToList(db.settings, p.type, p.value);
      else if (a === 'removeListItem') _removeFromList(db.settings, p.type, p.value);
    } catch (err) { /* ignore a single bad entry */ }
  });
}

// Retry leftover writes when the network returns and periodically as a safety net.
try {
  window.addEventListener('online', function () { flushOutbox(); });
  setInterval(function () { if (outboxCount()) flushOutbox(); }, 20000);
} catch (e) {}

function queuePush(action, payload) {
  _inflight++; sgSavePill('saving');
  api(action, payload).catch(function (e) { try { toast((e && e.message) || 'Save failed'); } catch (x) {} })
    .then(function () {
      _inflight--;
      if (_inflight <= 0) { _inflight = 0; sgSavePill('saved'); setTimeout(function () { sgSavePill('hide'); }, 1200); }
    });
}
function diffById(saveAction, delAction, kind, cur, prev) {
  cur = cur || []; prev = prev || [];
  var byId = {}; prev.forEach(function (x) { byId[x.id] = x; });
  var seen = {};
  cur.forEach(function (x) {
    seen[x.id] = 1;
    var was = byId[x.id];
    if (!was || JSON.stringify(was) !== JSON.stringify(x)) outboxAdd(kind + ':' + x.id, saveAction, x);
  });
  var dels = prev.filter(function (x) { return !seen[x.id]; });
  // SAFETY GUARD: real deletions happen one row at a time via the UI. A pass
  // that would delete many rows at once (or wipe a whole collection) is almost
  // certainly a bad refresh or bug, so we refuse it — no saved data is lost.
  if (dels.length >= 5 || (cur.length === 0 && prev.length >= 3)) {
    console.warn('[SmartGoals] safety: skipped bulk delete of ' + dels.length + ' ' + kind + ' record(s)');
    try { toast('Safety guard: skipped an unexpected bulk delete (' + dels.length + ' ' + kind + '). Your data is intact.'); } catch (e) {}
    return;
  }
  dels.forEach(function (x) { outboxAdd(kind + ':' + x.id, delAction, { id: x.id }); });
}
function diffList(type, cur, prev) {
  cur = cur || []; prev = prev || [];
  cur.forEach(function (v) { if (prev.indexOf(v) === -1) outboxAdd('list:' + type + ':' + v, 'addListItem', { type: type, value: v }); });
  prev.forEach(function (v) { if (cur.indexOf(v) === -1) outboxAdd('list:' + type + ':' + v, 'removeListItem', { type: type, value: v }); });
}
function syncDiff() {
  if (!_shadow) { _shadow = deepCopy(DB); return; }
  var _obBefore = {}; try { var _oB = outbox(); Object.keys(_oB).forEach(function (k) { _obBefore[k] = _oB[k].ts; }); } catch (e) {}
  try {
    diffById('saveGoal', 'deleteGoal', 'goal', DB.goals, _shadow.goals);
    diffById('saveTask', 'deleteTask', 'task', DB.tasks, _shadow.tasks);
    diffById('saveReview', 'deleteReview', 'review', DB.reviews, _shadow.reviews);
    diffById('saveMember', 'removeMember', 'member', DB.settings.members, _shadow.settings.members);
    diffById('saveAdmin', 'removeAdmin', 'admin', DB.settings.admins, _shadow.settings.admins);
    diffList('dept',     DB.settings.depts,      _shadow.settings.depts);
    diffList('goalName', DB.settings.goalNames,  _shadow.settings.goalNames);
    diffList('category', DB.settings.categories, _shadow.settings.categories);
  } catch (e) { console.warn('[SmartGoals] sync error', e); }
  // Shadow can advance now: the change is durably queued in the outbox, which
  // keeps retrying until the server confirms it — so nothing is lost even if
  // the write below fails.
  try {
    var _touched = [], _oA = outbox();
    Object.keys(_oA).forEach(function (k) { if (_obBefore[k] !== _oA[k].ts) _touched.push({ key: k, ts: _oA[k].ts }); });
    if (_touched.length && typeof sgSaveToast === 'function') sgSaveToast(_touched);
  } catch (e) {}
  _shadow = deepCopy(DB);
  flushOutbox();
}

// ── read-only user badge (no role switcher in production) ──
renderUserBadge = function () {
  var el = document.getElementById('user-badge');
  if (el) {
    var labels = { admin: 'Admin', dept_head: 'Dept Head', member: 'Member' };
    el.innerHTML =
      '<span style="font-size:11px;color:var(--text3);margin-right:6px">' + esc(currentUser.name || '') + '</span>' +
      '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--brand-lt);color:var(--brand);border:1px solid var(--brand-border)">' + (labels[currentUser.role] || '') + '</span>';
  }
  var st = document.getElementById('nav-tab-settings'); if (st) st.style.display = canAccessSettings() ? '' : 'none';
  var rv = document.getElementById('nav-tab-reviews');  if (rv) rv.style.display = '';
  if (currentUser.role === ROLES.MEMBER) currentDept = '';
  else if (currentUser.role === ROLES.DEPT_HEAD && !currentDept) currentDept = currentUser.dept;
};

// ── destructive bulk ops are unsafe on shared data ──
clearAll = function () { try { toast('Clear all is disabled in shared mode.'); } catch (e) {} };
importData = function () { try { toast('Import is disabled in shared mode.'); } catch (e) {} };

// ── MOUNT / PUBLIC API ──
function afterLoadRender() {
  resolveUser();
  populateAllSelects();
  renderUserBadge();
  applyFilterDefaults();
  renderSidebar();
  renderPage(getCurrentPageId());
}
function mount() {
  var r = document.getElementById('sg-app');
  if (!r) { console.warn('[SmartGoals] #sg-app not found. Inject smart-goals.html before mount().'); return Promise.resolve(); }
  mounted = true;

  if (loadedOnce) {
    // repeat visit: paint instantly, refresh silently
    afterLoadRender();
    return loadAll(true).then(afterLoadRender).catch(function (e) { console.warn('[SmartGoals] background refresh failed:', e); });
  }
  // Instant paint from the last local snapshot (survives full page reloads),
  // then refresh from the server in the background — no long spinner.
  var snap = loadSnapshot();
  if (snap) {
    DB = {
      settings: {
        depts:      (snap.settings && snap.settings.depts)      || [],
        members:    (snap.settings && snap.settings.members)    || [],
        admins:     (snap.settings && snap.settings.admins)     || [],
        goalNames:  (snap.settings && snap.settings.goalNames)  || [],
        categories: (snap.settings && snap.settings.categories) || []
      },
      goals:   snap.goals   || [],
      tasks:   snap.tasks   || [],
      reviews: snap.reviews || [],
      uiPrefs: loadUiPrefs()
    };
    _shadow = deepCopy(DB);     // baseline so any edit during refresh diffs correctly
    syncEnabled = true;         // edits made before the refresh still sync — no lost writes
    afterLoadRender();          // paint instantly, no spinner
    return loadAll(true).then(afterLoadRender)
      .catch(function (e) { console.warn('[SmartGoals] background refresh failed:', e); });
  }

  sgShowLoader();
  return loadAll()
    .then(afterLoadRender)
    .catch(function (e) { try { toast((e && e.message) || 'Could not load Smart Goals data'); } catch (x) {} })
    .then(function () { sgHideLoader(); });
}

window.SmartGoals = {
  mount: mount,
  reload: function () { return loadAll(true).then(afterLoadRender); },
  setUser: function (u) { if (u && u.email) { window.SMART_GOALS_USER = u; if (mounted) { resolveUser(); renderUserBadge(); renderPage(getCurrentPageId()); } } }
};

// ── In-app data refresh (no browser reload needed) ──
// Pulls the latest server data and re-renders the current page in place.
function sgRefresh() {
  var btn = document.getElementById('sg-refresh-btn');
  if (btn) { if (btn.classList.contains('loading')) return; btn.classList.add('loading'); }
  sgShowLoader();
  loadAll(true)
    .then(afterLoadRender)
    .then(function () { try { toast('Data refreshed'); } catch (e) {} })
    .catch(function (e) { try { toast((e && e.message) || 'Refresh failed'); } catch (x) {} })
    .then(function () { sgHideLoader(); if (btn) btn.classList.remove('loading'); });
}

// expose inline-handler functions used by the injected fragment
try { window.addSetting = addSetting; } catch(e){}
try { window.changeDept = changeDept; } catch(e){}
try { window.clearAll = clearAll; } catch(e){}
try { window.closeModal = closeModal; } catch(e){}
try { window.deleteGoal = deleteGoal; } catch(e){}
try { window.toggleGoalGroup = toggleGoalGroup; } catch(e){}
try { window.editGoalGroup = editGoalGroup; } catch(e){}
try { window.saveGoalGroup = saveGoalGroup; } catch(e){}
try { window.deleteGoalGroup = deleteGoalGroup; } catch(e){}
try { window.sgConfirmOk = sgConfirmOk; } catch(e){}
try { window.sgConfirmCancel = sgConfirmCancel; } catch(e){}
try { window.deleteReview = deleteReview; } catch(e){}
try { window.sgOpenItemRemarkModal = sgOpenItemRemarkModal; } catch(e){}
try { window.sgSaveItemRemark = sgSaveItemRemark; } catch(e){}
try { window.sgToggleGoalDetail = sgToggleGoalDetail; } catch(e){}
try { window.deleteTask = deleteTask; } catch(e){}
try { window.esc = esc; } catch(e){}
try { window.escJs = escJs; } catch(e){}
try { window.exportData = exportData; } catch(e){}
try { window.importData = importData; } catch(e){}
try { window.loadGoalsForReview = loadGoalsForReview; } catch(e){}
try { window.onRvDeptChange = onRvDeptChange; } catch(e){}
try { window.onSgDeptChange = onSgDeptChange; } catch(e){}
try { window.openAddAdminModal = openAddAdminModal; } catch(e){}
try { window.openAddMemberModal = openAddMemberModal; } catch(e){}
try { window.openEditMemberModal = openEditMemberModal; } catch(e){}
try { window.onMpDeptChange = onMpDeptChange; } catch(e){}
try { window.refreshMpDeptScopedDropdowns = refreshMpDeptScopedDropdowns; } catch(e){}
try { window.openAddTask = openAddTask; } catch(e){}
try { window.openEditTask = openEditTask; } catch(e){}
try { window.openGoalModal = openGoalModal; } catch(e){}
try { window.openReviewModal = openReviewModal; } catch(e){}
try { window.openRoleSwitcher = openRoleSwitcher; } catch(e){}
try { window.populateCatDropdown = populateCatDropdown; } catch(e){}
try { window.populateGoalMemberDropdown = populateGoalMemberDropdown; } catch(e){}
try { window.populateReviewMemberDropdown = populateReviewMemberDropdown; } catch(e){}
try { window.syncMgrEmail = syncMgrEmail; } catch(e){}
try { window.populateManagerDropdown = populateManagerDropdown; } catch(e){}
try { window.populateTaskGoalDropdown = populateTaskGoalDropdown; } catch(e){}
try { window.populateTaskMemberDropdown = populateTaskMemberDropdown; } catch(e){}
try { window.removeAdmin = removeAdmin; } catch(e){}
try { window.removeDept = removeDept; } catch(e){}
try { window.removeMember = removeMember; } catch(e){}
try { window.renderDashboard = renderDashboard; } catch(e){}
try { window.renderPlan = renderPlan; } catch(e){}
try { window.openMgrComment = openMgrComment; } catch(e){}
try { window.saveMgrComment = saveMgrComment; } catch(e){}
try { window.sgSetGrade = sgSetGrade; } catch(e){}
try { window.renderReviews = renderReviews; } catch(e){}
try { window.renderSmartGoals = renderSmartGoals; } catch(e){}
try { window.toggleReviewCard = toggleReviewCard; } catch(e){}
try { window.sgRefresh = sgRefresh; } catch(e){}
try { window.saveGoal = saveGoal; } catch(e){}
try { window.saveInlineRow = saveInlineRow; } catch(e){}
try { window.exportPlanExcel = exportPlanExcel; } catch(e){}
try { window.sgToggleDate = sgToggleDate; } catch(e){}
try { window.sgSyncDate = sgSyncDate; } catch(e){}
try { window.saveNewAdmin = saveNewAdmin; } catch(e){}
try { window.saveNewMember = saveNewMember; } catch(e){}
try { window.saveReview = saveReview; } catch(e){}
try { window.saveTask = saveTask; } catch(e){}
try { window.selectDept = selectDept; } catch(e){}
try { window.selectSettingsDept = selectSettingsDept; } catch(e){}
try { window.selectDeptAndMember = selectDeptAndMember; } catch(e){}
try { window.showPage = showPage; } catch(e){}
try { window.switchRole = switchRole; } catch(e){}
try { window.toggleColsPanel = toggleColsPanel; } catch(e){}
try { window.toggleColumn = toggleColumn; } catch(e){}
try { window.toggleDept = toggleDept; } catch(e){}
try { window.toggleSidebar = toggleSidebar; } catch(e){}
try { window.updateMemberField = updateMemberField; } catch(e){}

// auto-mount if the fragment is already present
(function () {
  function maybe() { if (document.getElementById('sg-app') && !mounted) mount(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maybe); else maybe();
})();

})();