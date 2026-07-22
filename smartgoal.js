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
      status: t.status||'Planned', deviation: t.deviation||'', helpNeeded: t.helpNeeded||'', revisedTgtDate: t.revisedTgtDate||''
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
    return {id:r.id||uid(), year, month, dept:r.dept||'', member:r.member||'', reviewer:r.reviewer||'', date:r.date||'', remarks:r.remarks||'', items};
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
  return currentUser.role === ROLES.ADMIN || (currentUser.role === ROLES.MEMBER && r.member === currentUser.name);
}
function canEditMgrScore(r) {
  return currentUser.role === ROLES.ADMIN || (currentUser.role === ROLES.DEPT_HEAD && r.dept === currentUser.dept);
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
  currentUser = {name:r.name, dept:r.dept, role:r.role};
  currentDept = r.role === 'dept_head' ? r.dept : '';
  closeModal('role-switcher-modal');
  renderUserBadge();
  renderSidebar();
  renderPage(getCurrentPageId());
  toast(`Viewing as: ${r.label}`);
}

function save() { try { localStorage.setItem('sg_uiPrefs', JSON.stringify(DB.uiPrefs||{})); } catch(e){} saveSnapshot(); if (syncEnabled) syncDiff(); }

// ── HELPERS ──
function uid() { return 'id_' + Math.random().toString(36).slice(2,10); }
function memberNames() { return DB.settings.members.map(m => m.name); }
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
    ['global-dept','mp-dept','sg-dept-filter','rv-dept','dash-dept-filter'].forEach(function(id){
      const el = document.getElementById(id); if (el && !el.value) el.value = myDept;
    });
  }
  // Dependent, dept-scoped dropdowns
  if (typeof setSgMemberOptions === 'function') setSgMemberOptions();
  const rvDept = (document.getElementById('rv-dept') || {}).value || '';
  if (document.getElementById('rv-member')) populateSelect('rv-member', scopedMemberNames(rvDept), 'Select Member…');
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
  const dept = document.getElementById('rf-dept').value;
  const el = document.getElementById('rf-member');
  const curVal = el.value;
  const filtered = scopedMemberNames(dept);
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
      <div class="tbl-wrap"><table class="tbl">
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

// ── MONTHLY PLAN ──
const COL_DEFS = [
  {key:'year',      grp:'plan',   label:'Academic Year'},
  {key:'month',     grp:'plan',   label:'Month'},
  {key:'week',      grp:'plan',   label:'Week'},
  {key:'dept',      grp:'plan',   label:'Dept'},
  {key:'member',    grp:'plan',   label:'Member'},
  {key:'goal',      grp:'plan',   label:'SMART Goal'},
  {key:'cat',       grp:'plan',   label:'Category'},
  {key:'subcat',    grp:'plan',   label:'Sub-category'},
  {key:'action',    grp:'plan',   label:'Action Point'},
  {key:'planned',   grp:'plan',   label:'Planned'},
  {key:'plannedItems', grp:'plan',label:'Planned Items'},
  {key:'est',       grp:'plan',   label:'Est Hrs'},
  {key:'tgtDate',   grp:'plan',   label:'Target Date'},
  {key:'compDate',  grp:'status', label:'Comp Date'},
  {key:'actualHrs', grp:'status', label:'Actual Hrs'},
  {key:'actualItems',grp:'status',label:'Actual Items'},
  {key:'status',    grp:'status', label:'Status'},
  {key:'deviation', grp:'status', label:'Deviation'},
  {key:'helpNeeded',grp:'status', label:'Help Needed'},
  {key:'revisedTgtDate', grp:'status', label:'Revised Date'},
  {key:'actions',   grp:'act',    label:'Actions'}
];
const GRP_LABEL = {plan:'Plan', status:'Status Update', act:'Actions'};
const GRP_CLASS = {plan:'plan', status:'status', act:'act'};

function isColHidden(key) { return (DB.uiPrefs.hiddenPlanCols||[]).includes(key); }
function toggleColumn(key, show) {
  const set = new Set(DB.uiPrefs.hiddenPlanCols||[]);
  if (show) set.delete(key); else set.add(key);
  DB.uiPrefs.hiddenPlanCols = [...set];
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

function visibleCols() { return COL_DEFS.filter(c => c.grp==='act' || !isColHidden(c.key)); }

function renderPlanHead() {
  const cols = visibleCols();
  const grpCounts = {};
  cols.forEach(c => grpCounts[c.grp] = (grpCounts[c.grp]||0)+1);
  let grpRow = '<tr class="grp-hd">';
  ['plan','status','act'].forEach(g => { if (grpCounts[g]) grpRow += `<th class="g-${g==='act'?'act':g}" colspan="${grpCounts[g]}">${GRP_LABEL[g]}</th>`; });
  grpRow += '</tr>';
  let colRow = '<tr class="col-hd">' + cols.map(c => `<th class="h-${c.grp==='act'?'act':c.grp}" data-col="${c.key}">${esc(c.label)}</th>`).join('') + '</tr>';
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
    case 'year': return `<td class="c-plan" style="white-space:nowrap;font-size:11px;color:var(--text3)">${esc(t.year)}</td>`;
    case 'month': return `<td class="c-plan" style="white-space:nowrap;font-size:12px">${esc(t.month)}</td>`;
    case 'week': return `<td class="c-plan" style="white-space:nowrap;font-size:12px;font-weight:600">${esc(t.week)}</td>`;
    case 'dept': return `<td class="c-plan" style="font-size:11px;color:var(--text2)">${esc(t.dept)}</td>`;
    case 'member': return `<td class="c-plan" style="white-space:nowrap;font-weight:500">${esc(t.member)}</td>`;
    case 'goal': return `<td class="c-plan"><span class="goal-pill ${goalColor(t.goal)}">${esc(t.goal)}</span></td>`;
    case 'cat': return `<td class="c-plan" style="font-size:11px;color:var(--text2)">${esc(t.cat||'—')}</td>`;
    case 'subcat': return `<td class="c-plan" style="font-size:11px">${esc(t.subcat||'—')}</td>`;
    case 'action': return `<td class="c-plan" style="min-width:170px;font-size:12px">${esc(t.action)}</td>`;
    case 'planned': return `<td class="c-plan">${planBadge(t.planned)}</td>`;
    case 'plannedItems': return `<td class="c-plan" style="text-align:right">${t.plannedItems===''||t.plannedItems==null?'—':t.plannedItems}</td>`;
    case 'est': return `<td class="c-plan" style="text-align:right;font-weight:600">${t.est||0}</td>`;
    case 'tgtDate': return `<td class="c-plan" style="font-size:11px;white-space:nowrap;color:var(--text2)">${formatDate(t.tgtDate)}</td>`;
    case 'compDate': return ed ? dateCellEditable(t.id,'compDate',t.compDate)
      : `<td class="c-status" style="white-space:nowrap">${dateChip(t.compDate)}</td>`;
    case 'actualHrs': return ed
      ? `<td class="c-status"><input class="tbl-input" type="number" step="0.5" min="0" value="${t.actualHrs||0}" data-id="${t.id}" data-field="actualHrs" style="width:72px"></td>`
      : `<td class="c-status" style="text-align:right">${t.actualHrs||0}</td>`;
    case 'actualItems': return ed
      ? `<td class="c-status"><input class="tbl-input" type="number" min="0" value="${t.actualItems===''||t.actualItems==null?'':t.actualItems}" data-id="${t.id}" data-field="actualItems" style="width:80px"></td>`
      : `<td class="c-status" style="text-align:right">${t.actualItems===''||t.actualItems==null?'—':t.actualItems}</td>`;
    case 'status': return ed
      ? `<td class="c-status"><select class="tbl-select" data-id="${t.id}" data-field="status" style="min-width:110px">${['Planned','Completed','In Process','Pending','On Hold','Cancelled'].map(s=>`<option value="${s}"${t.status===s?' selected':''}>${s}</option>`).join('')}</select></td>`
      : `<td class="c-status">${statusBadge(t.status)}</td>`;
    case 'deviation': return ed
      ? `<td class="c-status"><input class="tbl-input" type="text" value="${esc(t.deviation||'')}" placeholder="Deviation…" data-id="${t.id}" data-field="deviation" style="min-width:130px"></td>`
      : `<td class="c-status" style="font-size:11px;color:var(--text2)">${esc(t.deviation||'—')}</td>`;
    case 'helpNeeded': return ed
      ? `<td class="c-status"><input class="tbl-input" type="text" value="${esc(t.helpNeeded||'')}" placeholder="Help needed…" data-id="${t.id}" data-field="helpNeeded" style="min-width:130px"></td>`
      : `<td class="c-status" style="font-size:11px;color:var(--text2)">${esc(t.helpNeeded||'—')}</td>`;
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
    tbody.innerHTML=`<tr><td colspan="21"><div class="empty"><div class="empty-icon">🗓️</div><p>Select <b>Academic Year</b>, <b>Month</b> and <b>Department</b> above to view the plan.</p></div></td></tr>`;
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
  document.getElementById('tf-week').value='Week 1';
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
  populateSelect('rv-member', scopedMemberNames(dept), 'Select Member…');
  document.getElementById('rv-member').value = '';
  renderReviews();
}

function renderReviews() {
  const addBtn = document.getElementById('rv-add-btn');
  if (currentUser.role === ROLES.MEMBER) {
    addBtn.textContent = '+ Submit Self Review';
    document.getElementById('rv-dept').style.display = 'none';
    document.getElementById('rv-member').style.display = 'none';
  } else {
    addBtn.textContent = '+ New Review';
    document.getElementById('rv-dept').style.display = '';
    document.getElementById('rv-member').style.display = '';
  }

  const yearF = document.getElementById('rv-year').value;
  const monthF = document.getElementById('rv-month').value;
  const deptF = document.getElementById('rv-dept').value || currentDept;
  const memberF = document.getElementById('rv-member').value;

  // Default view is blank — Dept Head / Admin must pick a Member (via filters) before anything shows.
  // Members viewing their own reviews (dept/member filters hidden) see their data immediately.
  if (currentUser.role !== ROLES.MEMBER && !memberF) {
    document.getElementById('review-list').innerHTML = `<div class="empty"><div class="empty-icon">🔎</div><p>Select a Member from the filters above to view their review.</p></div>`;
    return;
  }

  let reviews = DB.reviews;
  if (currentUser.role === ROLES.MEMBER) reviews = reviews.filter(r => r.member === currentUser.name);
  else if (currentUser.role === ROLES.DEPT_HEAD) reviews = reviews.filter(r => r.dept === currentUser.dept);
  if (yearF) reviews = reviews.filter(r => r.year === yearF);
  if (monthF) reviews = reviews.filter(r => r.month === monthF);
  if (deptF) reviews = reviews.filter(r => r.dept === deptF);
  if (memberF) reviews = reviews.filter(r => r.member === memberF);

  if (!reviews.length) {
    document.getElementById('review-list').innerHTML = `<div class="empty"><div class="empty-icon">📊</div><p>${currentUser.role===ROLES.MEMBER ? 'You have no reviews yet. Click "+ Submit Self Review" to submit yours.' : 'No reviews found for this selection.'}</p></div>`;
    return;
  }

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

    // ── Summary of Review table: SMART Goal | Description | Weightage | Performance ──
    let summaryRows = '';
    let totalWeightage = 0, totalPerformance = 0;
    groups.forEach((grp,i) => {
      const tMax = grp.rows.reduce((a,x)=>a+(parseFloat(x.maxScore)||0),0);
      const tMgr = grp.rows.reduce((a,x)=>a+(parseFloat(x.mgrScore)||0),0);
      const weightage = parseFloat(grp.weightage)||0;
      const ratio = tMax>0 ? (tMgr/tMax) : 0;
      const performance = Math.round(ratio * weightage);
      totalWeightage += weightage;
      totalPerformance += performance;
      const desc = grp.rows[0].description || '';
      summaryRows += `<tr>
        <td style="text-align:center;color:var(--text3)">${i+1}</td>
        <td style="font-weight:600">${esc(grp.goal)}</td>
        <td style="font-size:11px;color:var(--text2)">${esc(desc||'—')}</td>
        <td style="text-align:center;font-weight:600">${weightage}%</td>
        <td style="text-align:center;font-weight:700;background:${pctColor(performance)}22;color:${pctColor(performance)}">${performance}%</td>
      </tr>`;
    });
    const summaryHtml = `<div style="margin-bottom:18px">
      <div class="review-section-hd">Summary of Review — ${monthYearLabel(r.year,r.month)}</div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr>
          <th style="text-align:center">#</th><th>SMART Goal</th><th>Description</th>
          <th style="text-align:center">Weightage</th><th style="text-align:center">Performance</th>
        </tr></thead>
        <tbody>
          ${summaryRows}
          <tr style="background:var(--surface2);font-weight:700">
            <td colspan="3" style="text-align:right">Total</td>
            <td style="text-align:center">${totalWeightage}%</td>
            <td style="text-align:center">${totalPerformance}%</td>
          </tr>
        </tbody>
      </table></div>
    </div>`;

    let sectionsHtml = groups.map(grp => {
      const tMax = grp.rows.reduce((a,i)=>a+(parseFloat(i.maxScore)||0),0);
      const tMem = grp.rows.reduce((a,i)=>a+(parseFloat(i.memberScore)||0),0);
      const tMgr = grp.rows.reduce((a,i)=>a+(parseFloat(i.mgrScore)||0),0);
      return `<div class="review-section">
        <div class="review-section-hd">${esc(grp.goal)} <b>(${grp.weightage}%)</b></div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr>
            <th>Category</th><th>Particulars</th><th>Target</th><th>Actual</th><th>Remark</th>
            <th style="text-align:center">Max</th><th style="text-align:center">Member Score</th><th style="text-align:center">Manager Score</th>
          </tr></thead>
          <tbody>
            ${grp.rows.map(i=>`<tr>
              <td>${esc(i.cat)}</td>
              <td>${esc(i.particulars||'—')}</td>
              <td>${esc(i.target||'—')}</td>
              <td>${esc(i.actual||'—')}</td>
              <td style="font-size:11px;color:var(--text2)">${esc(i.remark||'—')}</td>
              <td style="text-align:center;font-weight:700">${i.maxScore}</td>
              <td style="text-align:center"><span class="score-badge ${scoreClass(i.memberScore,i.maxScore)}">${i.memberScore||'—'}</span></td>
              <td style="text-align:center">${parseFloat(i.mgrScore)>0?`<span class="score-badge ${scoreClass(i.mgrScore,i.maxScore)}">${i.mgrScore}</span>`:'<span style="font-size:11px;color:var(--text3)">—</span>'}</td>
            </tr>`).join('')}
            <tr style="background:var(--surface2);font-weight:700">
              <td colspan="5">Total</td>
              <td style="text-align:center">${tMax}</td>
              <td style="text-align:center"><span class="score-badge ${scoreClass(tMem,tMax)}">${tMem}</span></td>
              <td style="text-align:center">${tMgr>0?`<span class="score-badge ${scoreClass(tMgr,tMax)}">${tMgr}</span>`:'<span style="color:var(--text3)">—</span>'}</td>
            </tr>
          </tbody>
        </table></div>
      </div>`;
    }).join('');

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
          <span class="score-badge ${scoreClass(totalMem,totalMax)}">Member: ${totalMem}/${totalMax}</span>
          ${mgrDone ? `<span class="score-badge ${scoreClass(totalMgr,totalMax)}">Mgr: ${totalMgr}/${totalMax}</span>` : `<span class="score-badge" style="background:var(--surface2);color:var(--text3)">Mgr: pending</span>`}
          ${(canEditMemberScore(r)||canEditMgrScore(r))?`<button class="btn btn-secondary btn-sm" onclick="openReviewModal('${r.id}')">✏️ Edit</button>`:''}
          ${currentUser.role===ROLES.ADMIN||currentUser.role===ROLES.DEPT_HEAD?`<button class="btn btn-danger btn-sm" onclick="deleteReview('${r.id}')">Delete</button>`:''}
        </div>
      </div>
      <div class="card-body" style="display:none">
        ${r.remarks ? `<p style="font-size:12px;color:var(--text2);margin-bottom:12px;padding:8px 12px;background:var(--surface2);border-radius:var(--radius);border-left:3px solid var(--brand)">📝 ${esc(r.remarks)}</p>` : ''}
        ${summaryHtml}
        ${sectionsHtml}
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
  ['rf-reviewer','rf-remarks'].forEach(fid => document.getElementById(fid).value = '');
  document.getElementById('rf-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('review-score-table').innerHTML = '';

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
  const memberDisabled = !(currentUser.role===ROLES.ADMIN || (isMember)) ? 'disabled' : '';
  const mgrDisabled = !(currentUser.role===ROLES.ADMIN || currentUser.role===ROLES.DEPT_HEAD) ? 'disabled' : '';

  // group exactly like the SMART Goals tab: one mini-section per SMART Goal (header = goal + weightage bold)
  const groups = groupByGoal(goalRows);
  let html = '';
  groups.forEach(grp => {
    html += `<div class="review-section">
      <div class="review-section-hd">${esc(grp.goal)} <b>(${grp.weightage}%)</b></div>
      <div class="tbl-wrap"><table class="tbl" style="min-width:900px">
        <thead><tr>
          <th>Category</th><th>Particulars</th>
          <th>Target</th><th>Actual</th><th>Remark</th>
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
        <td><input type="text" class="item-target" value="${esc(ex?.target||'')}" style="width:70px;border:1px solid var(--border2);border-radius:4px;padding:3px 6px;font-size:12px;font-family:inherit"></td>
        <td><input type="text" class="item-actual" value="${esc(ex?.actual||'')}" style="width:70px;border:1px solid var(--border2);border-radius:4px;padding:3px 6px;font-size:12px;font-family:inherit"></td>
        <td><input type="text" placeholder="Remark…" class="item-remark" value="${esc(ex?.remark||'')}" style="width:100%;min-width:120px;border:1px solid var(--border2);border-radius:4px;padding:3px 7px;font-size:12px;font-family:inherit"></td>
        <td style="text-align:center"><input class="score-input-sm item-maxscore" type="number" min="0" value="${maxVal}" title="Max Score is fetched from SMART Goals, but can be adjusted here"></td>
        <td style="text-align:center"><input class="score-input-sm item-memberscore" type="number" min="0" value="${ex?.memberScore||0}" ${memberDisabled}></td>
        <td style="text-align:center"><input class="score-input-sm item-mgrscore" type="number" min="0" value="${ex?.mgrScore||0}" ${mgrDisabled}></td>
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
    items
  };
  if (existingId) { const i=DB.reviews.findIndex(x=>x.id===existingId); if(i>-1) DB.reviews[i]=rec; }
  else DB.reviews.push(rec);
  save(); closeModal('review-modal'); renderReviews(); toast('Review saved');
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
function openAddMemberModal() {
  editingMemberId = null;
  document.getElementById('am-modal-title').textContent = 'Add Team Member';
  document.getElementById('am-name').value = '';
  document.getElementById('am-role').value = 'member';
  document.getElementById('am-email').value = '';
  populateSelect('am-dept', DB.settings.depts, 'Select…');
  document.getElementById('am-dept').value = currentDept || '';
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
  openModal('add-member-modal');
}

function saveNewMember() {
  const dept = document.getElementById('am-dept').value;
  const name = document.getElementById('am-name').value.trim();
  const role = document.getElementById('am-role').value;
  const email = document.getElementById('am-email').value.trim();
  if (!dept) { toast('Department is required'); return; }
  if (!name) { toast('Member name is required'); return; }
  if (editingMemberId) {
    const idx = DB.settings.members.findIndex(function (x) { return x.id === editingMemberId; });
    if (idx < 0) { editingMemberId = null; toast('Member not found'); return; }
    const clash = DB.settings.members.some(function (x, j) { return j !== idx && x.name === name; });
    if (clash) { toast('Another member already has that name'); return; }
    DB.settings.members[idx] = { id: editingMemberId, name, dept, role, email };
    editingMemberId = null;
    save(); populateAllSelects(); renderSettings(); renderSidebar();
    closeModal('add-member-modal');
    toast(`${name} updated`);
    return;
  }
  if (memberNames().includes(name)) { toast('Member already exists'); return; }
  DB.settings.members.push({id:uid(), name, dept, role, email});
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
function api(action, payload) {
  var params = { action: action };
  if (payload) params.payload = JSON.stringify(payload);
  return jsonp(params).then(function (res) {
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
function loadUiPrefs() {
  try { var v = JSON.parse(localStorage.getItem('sg_uiPrefs') || 'null'); if (v && v.hiddenPlanCols) return v; } catch (e) {}
  return { hiddenPlanCols: [] };
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
  return api('getAll', fresh ? { fresh: 1 } : null).then(function (data) {
    data = data || {};
    var s = data.settings || {};
    DB = {
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
    _shadow = deepCopy(DB);
    syncEnabled = true;
    loadedOnce = true;
    saveSnapshot();
  });
}

// ── DIFF-BASED SYNC (one small write per changed record; JSONP-safe) ──
function queuePush(action, payload) {
  _inflight++; sgShowLoader();
  api(action, payload).catch(function (e) { try { toast((e && e.message) || 'Save failed'); } catch (x) {} })
    .then(function () { _inflight--; if (_inflight <= 0) { _inflight = 0; sgHideLoader(); } });
}
function diffById(saveAction, delAction, cur, prev) {
  cur = cur || []; prev = prev || [];
  var byId = {}; prev.forEach(function (x) { byId[x.id] = x; });
  var seen = {};
  cur.forEach(function (x) {
    seen[x.id] = 1;
    var was = byId[x.id];
    if (!was || JSON.stringify(was) !== JSON.stringify(x)) queuePush(saveAction, x);
  });
  prev.forEach(function (x) { if (!seen[x.id]) queuePush(delAction, { id: x.id }); });
}
function diffList(type, cur, prev) {
  cur = cur || []; prev = prev || [];
  cur.forEach(function (v) { if (prev.indexOf(v) === -1) queuePush('addListItem', { type: type, value: v }); });
  prev.forEach(function (v) { if (cur.indexOf(v) === -1) queuePush('removeListItem', { type: type, value: v }); });
}
function syncDiff() {
  if (!_shadow) { _shadow = deepCopy(DB); return; }
  try {
    diffById('saveGoal', 'deleteGoal', DB.goals, _shadow.goals);
    diffById('saveTask', 'deleteTask', DB.tasks, _shadow.tasks);
    diffById('saveReview', 'deleteReview', DB.reviews, _shadow.reviews);
    diffById('saveMember', 'removeMember', DB.settings.members, _shadow.settings.members);
    diffById('saveAdmin', 'removeAdmin', DB.settings.admins, _shadow.settings.admins);
    diffList('dept',     DB.settings.depts,      _shadow.settings.depts);
    diffList('goalName', DB.settings.goalNames,  _shadow.settings.goalNames);
    diffList('category', DB.settings.categories, _shadow.settings.categories);
  } catch (e) { console.warn('[SmartGoals] sync error', e); }
  _shadow = deepCopy(DB);
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
try { window.populateTaskGoalDropdown = populateTaskGoalDropdown; } catch(e){}
try { window.populateTaskMemberDropdown = populateTaskMemberDropdown; } catch(e){}
try { window.removeAdmin = removeAdmin; } catch(e){}
try { window.removeDept = removeDept; } catch(e){}
try { window.removeMember = removeMember; } catch(e){}
try { window.renderDashboard = renderDashboard; } catch(e){}
try { window.renderPlan = renderPlan; } catch(e){}
try { window.renderReviews = renderReviews; } catch(e){}
try { window.renderSmartGoals = renderSmartGoals; } catch(e){}
try { window.toggleReviewCard = toggleReviewCard; } catch(e){}
try { window.sgRefresh = sgRefresh; } catch(e){}
try { window.saveGoal = saveGoal; } catch(e){}
try { window.saveInlineRow = saveInlineRow; } catch(e){}
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