/**
 * Progress Module for OLF StaffConnect (OLF Insight)
 * Exact Flowchart Hierarchy Replica of SMART GOALS displaying live Monthly Field Review Performance
 * Connected directly to Supabase Field Review System (review_responses & assignments)
 */

(function () {
  'use strict';

  // State
  let state = {
    activeMonth: '202610', // Default latest active cycle (October 2026)
    searchQuery: '',
    isLoading: false,
    selectedEmp: null
  };

  // Divisions open by default (Pune open by default so tree is immediately visible on first load)
  let expandedDivisions = new Set(['pune']);

  // Local data store (initialized from precached data, updated live from Supabase)
  let cachedReviews = (typeof window !== 'undefined' && window.FIELD_REVIEW_PRECACHED_DATA)
    ? JSON.parse(JSON.stringify(window.FIELD_REVIEW_PRECACHED_DATA))
    : {};
  let cachedAssignments = (typeof window !== 'undefined' && window.FIELD_REVIEW_PRECACHED_ASSIGNMENTS)
    ? [...window.FIELD_REVIEW_PRECACHED_ASSIGNMENTS]
    : [];

  let assignmentMaps = null;

  function buildAssignmentMaps() {
    if (assignmentMaps) return assignmentMaps;
    const byId = {}, byEmail = {}, byName = {};
    (cachedAssignments || []).forEach(a => {
      if (a.emp_id) byId[a.emp_id.trim().toUpperCase()] = a;
      if (a.email) byEmail[a.email.trim().toLowerCase()] = a;
      if (a.name) byName[a.name.trim().toLowerCase()] = a;
    });
    assignmentMaps = { byId, byEmail, byName };
    return assignmentMaps;
  }

  function esc(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function normalizeDivId(id) {
    if (!id) return '';
    const s = String(id).trim().toLowerCase();
    if (s === 'nashik' || s === 'nashik-konkan' || s.includes('nashik')) return 'nashik-konkan';
    return s;
  }

  function isDivisionExpanded(divId) {
    const norm = normalizeDivId(divId);
    return expandedDivisions.has(norm) || expandedDivisions.has(divId);
  }

  function getStaffList() {
    if (typeof window !== 'undefined' && window.TeamPerformance && typeof window.TeamPerformance.getStaffList === 'function') {
      const list = window.TeamPerformance.getStaffList();
      if (list && list.length) return list;
    }
    return (typeof window !== 'undefined' && window.CACHED_PROGRAM_STAFF) ? window.CACHED_PROGRAM_STAFF : [];
  }

  function getTreeData() {
    if (typeof window !== 'undefined' && window.TeamPerformance && typeof window.TeamPerformance.getTree === 'function') {
      const t = window.TeamPerformance.getTree();
      if (t) return t;
    }
    return (typeof window !== 'undefined' && window.TEAM_PERFORMANCE_TREE) ? window.TEAM_PERFORMANCE_TREE : null;
  }

  function findStaffByNameOrId(name, id) {
    const list = getStaffList();
    if (!list || !list.length) return null;
    if (id) {
      const cleanId = String(id).trim().toUpperCase();
      const matchId = list.find(s => s.id && s.id.trim().toUpperCase() === cleanId);
      if (matchId) return matchId;
    }
    if (name) {
      const cleanName = String(name).trim().toLowerCase().replace(/\s*·\s*po.*$/i, '');
      const matchName = list.find(s => {
        const sName = String(s.Name || '').trim().toLowerCase();
        return sName === cleanName || sName.includes(cleanName) || cleanName.includes(sName);
      });
      if (matchName) return matchName;
    }
    return null;
  }

  // Evaluate progress status for an employee
  function evaluateEmployee(emp) {
    if (!emp) {
      return {
        empId: 'unknown',
        name: 'Staff Member',
        designation: 'Field Staff',
        isHQ: false,
        isAssigned: false,
        status: 'pending',
        statusLabel: 'Pending Review',
        statusClass: 'tp-prog-pill--pending',
        scoreLabel: '— / 100',
        managerStatus: 'Not submitted',
        managerRemark: '',
        details: null
      };
    }

    const maps = buildAssignmentMaps();
    const loc = String(emp.Location || '').toLowerCase();
    const des = String(emp.Designation || '').toLowerCase();
    const isHQ = loc.includes('ho') || des.includes('analyst') || des.includes('communications') || des.includes('guest') || (emp.id && String(emp.id).includes('VISITOR'));

    if (isHQ) {
      return {
        empId: emp.id || 'hq',
        name: emp.Name || 'HQ Leadership',
        designation: emp.Designation || 'Executive',
        isHQ: true,
        isAssigned: false,
        status: 'hq',
        statusLabel: 'HQ Reviewer',
        statusClass: 'tp-prog-pill--hq',
        scoreLabel: 'Executive',
        managerStatus: 'Reviewer / Leadership',
        managerRemark: '',
        details: null
      };
    }

    const id = (emp.id || '').trim().toUpperCase();
    const email = (emp.Email || '').trim().toLowerCase();
    const name = (emp.Name || '').trim().toLowerCase();
    const assign = maps.byId[id] || maps.byEmail[email] || maps.byName[name];

    if (!assign) {
      return {
        empId: emp.id || id,
        name: emp.Name || name,
        designation: emp.Designation || 'Field Staff',
        isHQ: false,
        isAssigned: false,
        status: 'unassigned',
        statusLabel: 'Pending Assignment',
        statusClass: 'tp-prog-pill--unassigned',
        scoreLabel: '—',
        managerStatus: 'Assignment Pending',
        managerRemark: 'Staff member added to SMART GOALS roster; pending district assignment in Field Review System.',
        details: null
      };
    }

    const monthData = (cachedReviews[state.activeMonth] || {});
    const rev = monthData[assign.emp_id] || monthData[id] || null;

    if (!rev) {
      return {
        empId: assign.emp_id || emp.id,
        name: emp.Name || assign.name,
        designation: emp.Designation || assign.designation,
        isHQ: false,
        isAssigned: true,
        status: 'pending',
        statusLabel: 'Pending Review',
        statusClass: 'tp-prog-pill--pending',
        scoreLabel: '— / 100',
        managerStatus: 'Not submitted',
        managerRemark: 'Monthly review not yet submitted for this period.',
        details: null
      };
    }

    const H = rev.H || {};
    const A = rev.A || {};
    const B = rev.B || {};
    const G = rev.G || {};
    const M = rev.M || {};

    const selfDone = (A.A1 != null && A.A1 !== '') || Object.keys(B).length > 0 || Object.keys(G).length > 0;
    const mgrDone = H.H1 === 'Y' && H.H2 != null && H.H2 !== '';

    let status = 'pending';
    let statusLabel = 'Pending Review';
    let statusClass = 'tp-prog-pill--pending';

    if (selfDone && mgrDone) {
      status = 'done';
      statusLabel = 'Review Done';
      statusClass = 'tp-prog-pill--done';
    } else if (selfDone) {
      status = 'partial';
      statusLabel = 'Partially Done';
      statusClass = 'tp-prog-pill--partial';
    }

    // Calculate score heuristics or show Manager rating
    let bTotal = 0, bDone = 0;
    [1, 2, 3, 4, 5].forEach(n => {
      const bItem = B['B' + n];
      if (bItem && (bItem.text || typeof bItem === 'string')) {
        bTotal++;
        if (bItem.status === 'Done' || (typeof bItem === 'string' && bItem.includes('"status":"Done"'))) {
          bDone++;
        }
      }
    });

    let scoreLabel = '— / 100';
    if (H.H2 === 'On track') {
      scoreLabel = '⭐ On Track';
    } else if (H.H2 === 'Needs support') {
      scoreLabel = '⚠️ Needs Support';
    } else if (H.H2 === 'Critical') {
      scoreLabel = '🚨 Critical';
    } else if (bTotal > 0) {
      const pct = Math.round((bDone / bTotal) * 100);
      scoreLabel = `${pct}% Actions Done`;
    } else if (selfDone) {
      scoreLabel = 'Submitted';
    }

    return {
      empId: assign.emp_id || emp.id,
      name: emp.Name || assign.name,
      designation: emp.Designation || assign.designation,
      isHQ: false,
      isAssigned: true,
      status,
      statusLabel,
      statusClass,
      scoreLabel,
      managerStatus: H.H2 || (mgrDone ? 'Review Held' : 'Awaiting Manager Review'),
      managerRemark: H.H3 || '',
      details: { A, B, G, H, M, bTotal, bDone }
    };
  }

  // --- Initialize Module ---
  function init() {
    buildAssignmentMaps();
    bindControls();
    render();
  }

  function bindControls() {
    const monthSelect = document.getElementById('tpProgMonthSelect');
    if (monthSelect) {
      monthSelect.value = state.activeMonth;
      monthSelect.onchange = function () {
        state.activeMonth = this.value;
        render();
      };
    }

    const refreshBtn = document.getElementById('tpProgRefreshBtn');
    if (refreshBtn) {
      refreshBtn.onclick = function () {
        refreshFromSupabase();
      };
    }

    const searchInput = document.getElementById('tpProgSearchInput');
    const searchClear = document.getElementById('tpProgSearchClear');
    if (searchInput) {
      searchInput.value = state.searchQuery;
      searchInput.oninput = function () {
        state.searchQuery = this.value.trim().toLowerCase();
        if (searchClear) searchClear.style.display = state.searchQuery ? 'block' : 'none';
        renderTreeOnly();
      };
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', debounce(drawConnectors, 80));
    }
  }

  function clearSearch() {
    state.searchQuery = '';
    const searchInput = document.getElementById('tpProgSearchInput');
    const searchClear = document.getElementById('tpProgSearchClear');
    if (searchInput) searchInput.value = '';
    if (searchClear) searchClear.style.display = 'none';
    renderTreeOnly();
  }

  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // --- Refresh from Supabase REST API ---
  async function refreshFromSupabase() {
    const btn = document.getElementById('tpProgRefreshBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="tp-spin">↻</span> Fetching...`;
    }

    const monthCode = state.activeMonth + '00';
    try {
      const url = `https://xljnhbexevetzgaaehqc.supabase.co/rest/v1/review_responses?period_code=eq.${monthCode}&select=emp_id,period_code,section,field,value&limit=3000`;
      const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsam5oYmV4ZXZldHpnYWFlaHFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5OTIzOTQsImV4cCI6MjEwNjU2ODM5NH0.Bk_TR38XLgk2s22UaUJv3VB6liCmOy-1o2Cn5UfpLXw";

      const res = await fetch(url, {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        }
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = await res.json();

      // Regroup
      if (!cachedReviews[state.activeMonth]) cachedReviews[state.activeMonth] = {};
      rows.forEach(r => {
        if (!cachedReviews[state.activeMonth][r.emp_id]) {
          cachedReviews[state.activeMonth][r.emp_id] = { A: {}, B: {}, G: {}, H: {}, M: {} };
        }
        if (!cachedReviews[state.activeMonth][r.emp_id][r.section]) {
          cachedReviews[state.activeMonth][r.emp_id][r.section] = {};
        }
        cachedReviews[state.activeMonth][r.emp_id][r.section][r.field] = r.value;
      });

      showToast(`Refreshed ${rows.length} records for ${formatMonthLabel(state.activeMonth)} from Supabase!`);
    } catch (err) {
      console.warn('Supabase live refresh failed, using cached data:', err);
      showToast('Network notice: using local snapshot data.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg class="tp-btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Refresh`;
      }
      render();
    }
  }

  function formatMonthLabel(m) {
    if (m === '202610') return 'Oct 2026';
    if (m === '202609') return 'Sep 2026';
    if (m === '202611') return 'Nov 2026';
    return m;
  }

  function showToast(msg) {
    let toast = document.getElementById('tpProgToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'tpProgToast';
      toast.className = 'tp-prog-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 3200);
  }

  // --- Render Top KPI Summary Row ---
  function renderKPIRow(stats) {
    const kpiEl = document.getElementById('tpProgKpiRow');
    if (!kpiEl) return;

    kpiEl.innerHTML = `
      <div class="tp-prog-kpi-card">
        <div class="tp-prog-kpi-val">${stats.total}</div>
        <div class="tp-prog-kpi-lbl">Total Staff</div>
      </div>
      <div class="tp-prog-kpi-card tp-prog-kpi--done">
        <div class="tp-prog-kpi-val">${stats.done}</div>
        <div class="tp-prog-kpi-lbl">✓ Review Done</div>
      </div>
      <div class="tp-prog-kpi-card tp-prog-kpi--partial">
        <div class="tp-prog-kpi-val">${stats.partial}</div>
        <div class="tp-prog-kpi-lbl">◐ Partially Done</div>
      </div>
      <div class="tp-prog-kpi-card tp-prog-kpi--pending">
        <div class="tp-prog-kpi-val">${stats.pending}</div>
        <div class="tp-prog-kpi-lbl">○ Review Pending</div>
      </div>
      <div class="tp-prog-kpi-card tp-prog-kpi--opt1">
        <div class="tp-prog-kpi-val">${stats.unassigned}</div>
        <div class="tp-prog-kpi-lbl">📋 Pending Assign.</div>
      </div>
      <div class="tp-prog-kpi-card tp-prog-kpi--hq">
        <div class="tp-prog-kpi-val">${stats.hq}</div>
        <div class="tp-prog-kpi-lbl">🏛️ HQ Leadership</div>
      </div>
    `;

    const countBadge = document.getElementById('tpProgTotalCountBadge');
    if (countBadge) {
      countBadge.textContent = `${stats.total} Staff · ${stats.done} Done`;
    }
  }

  // Toggle single division expand/collapse
  function toggleDivision(divId) {
    const norm = normalizeDivId(divId);
    if (expandedDivisions.has(norm) || expandedDivisions.has(divId)) {
      expandedDivisions.delete(norm);
      expandedDivisions.delete(divId);
    } else {
      expandedDivisions.add(norm);
    }

    const tree = getTreeData();
    renderDivisionPills(tree ? tree.mhDivisions || [] : []);
    renderTreeOnly();

    if (expandedDivisions.has(norm)) {
      setTimeout(() => {
        const panel = document.getElementById('prog-divpanel-' + norm) || document.getElementById('prog-divpanel-' + divId);
        if (panel && typeof panel.scrollIntoView === 'function') {
          panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 60);
    }
  }

  // Expand all divisions
  function expandAll() {
    const tree = getTreeData();
    const divisions = tree ? tree.mhDivisions || [] : [];
    divisions.forEach(d => {
      expandedDivisions.add(normalizeDivId(d.divisionId));
      expandedDivisions.add(d.divisionId);
    });
    renderDivisionPills(divisions);
    renderTreeOnly();
  }

  // Collapse all divisions
  function collapseAll() {
    expandedDivisions.clear();
    const tree = getTreeData();
    renderDivisionPills(tree ? tree.mhDivisions || [] : []);
    renderTreeOnly();
  }

  // --- Render Division Filter Pills ---
  function renderDivisionPills(divisions) {
    const container = document.getElementById('tpProgDivisionPills');
    if (!container) return;

    let html = `<button type="button" class="tp-pill-btn ${expandedDivisions.size === 0 ? 'active' : ''}" onclick="window.ProgressModule.collapseAll()">Overview (All Collapsed)</button>`;

    (divisions || []).forEach(d => {
      const isExpanded = isDivisionExpanded(d.divisionId);
      html += `<button type="button" class="tp-pill-btn ${isExpanded ? 'active' : ''}" onclick="window.ProgressModule.toggleDivision('${d.divisionId}')">${esc(d.divisionTitle.replace(/\s*Division$/i, ''))} <span class="tp-pill-badge">${isExpanded ? 'Hide ▲' : 'View Team ▼'}</span></button>`;
    });

    container.innerHTML = html;
  }

  // --- Render Full Hierarchy ---
  function render() {
    const tree = getTreeData();
    if (!tree) return;

    const staffList = getStaffList();
    const stats = { total: staffList.length, done: 0, partial: 0, pending: 0, unassigned: 0, hq: 0 };

    staffList.forEach(s => {
      const evalRes = evaluateEmployee(s);
      if (evalRes.status === 'done') stats.done++;
      else if (evalRes.status === 'partial') stats.partial++;
      else if (evalRes.status === 'pending') stats.pending++;
      else if (evalRes.status === 'unassigned') stats.unassigned++;
      else if (evalRes.status === 'hq') stats.hq++;
    });

    renderKPIRow(stats);
    renderDivisionPills(tree.mhDivisions || []);
    renderTreeOnly();
  }

  function renderTreeOnly() {
    const tree = getTreeData();
    const container = document.getElementById('tpProgTreeContainer');
    if (!container || !tree) return;

    const q = state.searchQuery;
    const divisions = tree.mhDivisions || [];

    const sl = tree.stateLead || {
      roleId: "statelead",
      name: "Vishvajit G Pawar",
      title: "State Lead — Maharashtra",
      reportingManager: "Prashant Patil"
    };

    const slStaff = findStaffByNameOrId(sl.name, sl.roleId) || {
      id: "OLF-23-010",
      Name: sl.name || "Vishvajit G Pawar",
      Designation: "State Lead",
      Location: "Pune HO"
    };
    const slEval = evaluateEmployee(slStaff);

    const distTotal = sl.districtsCount != null ? sl.districtsCount : divisions.reduce((a, c) => a + c.pmColumns.reduce((pa, p) => pa + p.districts.length, 0), 0);
    const poTotal = sl.posCount != null ? sl.posCount : divisions.reduce((a, c) => a + c.pmColumns.reduce((pa, p) => pa + p.districts.reduce((da, d) => da + d.pos.length, 0), 0), 0);
    const pmsTotal = sl.pmsCount != null ? sl.pmsCount : divisions.reduce((a, c) => a + c.pmColumns.length, 0);
    const divsTotal = divisions.length;

    let html = `
      <!-- Level 0: State Lead Node (Maharashtra) -->
      <div class="tp-row tp-row-root" id="tpProgRowRoot">
        <div class="tp-card tp-card-root" id="prog-node-statelead">
          <div class="tp-card-header">
            <span class="tp-tag tp-tag-gold">Maharashtra</span>
            <button type="button" class="tp-card-details-btn" onclick="window.ProgressModule.openModal('${slStaff.id}')">Details &rarr;</button>
          </div>
          <div class="tp-card-name">${esc(sl.name || 'Vishvajit G Pawar')}</div>
          <div class="tp-card-role-label">${esc(sl.designation || sl.title || 'State Lead')}</div>
          <div class="tp-card-sub">${esc(sl.title || 'State Lead · Maharashtra')} &middot; State Operations &amp; Strategy</div>
          <div class="tp-card-stats">
            <div class="tp-stat-item"><strong>${divsTotal}</strong><span>${divsTotal === 1 ? 'Division' : 'Divisions'}</span></div>
            <div class="tp-stat-item"><strong>${pmsTotal}</strong><span>${pmsTotal === 1 ? 'Prog Mgr' : 'Prog Mgrs'}</span></div>
            <div class="tp-stat-item"><strong>${distTotal}</strong><span>${distTotal === 1 ? 'District' : 'Districts'}</span></div>
            <div class="tp-stat-item"><strong>${poTotal}</strong><span>POs</span></div>
          </div>
          <div class="tp-prog-strip" style="margin-top:12px;">
            <span class="tp-prog-pill ${slEval.statusClass}">${slEval.statusLabel}</span>
            <span class="tp-prog-score">${slEval.scoreLabel}</span>
          </div>
        </div>
      </div>

      <!-- Level 1: Row of 5 Division Overview Cards -->
      <div class="tp-divisions-row" id="tpProgDivisionsRow">
    `;

    divisions.forEach(div => {
      const isExpanded = isDivisionExpanded(div.divisionId);
      const isMatched = q && (div.divisionTitle.toLowerCase().includes(q) || (div.divisionLead || '').toLowerCase().includes(q));
      const distCount = div.pmColumns.reduce((a, c) => a + (c.districts?.length || 0), 0);
      const poCount = div.pmColumns.reduce((a, c) => a + c.districts.reduce((da, d) => da + (d.pos?.length || 0), 0), 0);
      const divId = div.divisionId;

      html += `
        <div class="tp-card tp-card-div ${isExpanded ? 'tp-expanded-card' : ''} ${isMatched ? 'tp-matched' : ''}" id="prog-node-${divId}">
          <div class="tp-card-header">
            <span class="tp-tag tp-tag-teal">Division</span>
          </div>
          <div class="tp-card-name">${esc(div.divisionTitle)}</div>
          <div class="tp-card-sub" style="font-size:12px; color:var(--tp-ink-muted, #64748B); margin-top:2px;">Lead: ${esc(div.divisionLead || 'Division Manager')}</div>
          <div class="tp-card-meta">
            <span>${div.pmColumns.length} ${div.pmColumns.length === 1 ? 'PM' : 'PMs'}</span> &middot; 
            <span>${distCount} ${distCount === 1 ? 'District' : 'Districts'}</span> &middot; 
            <span>${poCount} POs</span>
          </div>
          <div class="tp-card-footer-actions">
            <button type="button" class="tp-toggle-team-btn ${isExpanded ? 'active' : ''}" onclick="window.ProgressModule.toggleDivision('${divId}')">
              ${isExpanded ? '▲ Hide Team' : '▼ View Team (' + div.pmColumns.length + ' ' + (div.pmColumns.length === 1 ? 'PM' : 'PMs') + ')'}
            </button>
          </div>
        </div>
      `;
    });

    html += `</div>`;

    // Level 2: Expanded Division Team Flowcharts (Rendered directly beneath division row)
    const expandedList = divisions.filter(d => isDivisionExpanded(d.divisionId));
    if (expandedList.length > 0) {
      html += `<div class="tp-expanded-divisions-container">`;
      expandedList.forEach(div => {
        const isInterim = !div.divisionLead || /interim|vacant/i.test(div.divisionLead);
        const divDistCount = div.pmColumns.reduce((a, c) => a + (c.districts?.length || 0), 0);
        const divPoCount = div.pmColumns.reduce((a, c) => a + c.districts.reduce((da, d) => da + (d.pos?.length || 0), 0), 0);
        const divPmCount = div.pmColumns.length;
        const divId = div.divisionId;

        const dmStaff = findStaffByNameOrId(div.divisionLead, div.divisionRoleId) || {
          id: div.divisionRoleId,
          Name: div.divisionLead,
          Designation: div.divisionRole || "Division Manager",
          Location: div.divisionTitle
        };
        const dmEval = evaluateEmployee(dmStaff);

        html += `
          <div class="tp-division-expanded-panel" id="prog-divpanel-${divId}">
            <div class="tp-panel-banner">
              <div class="tp-panel-banner-left">
                <span class="tp-panel-badge">Active Division</span>
                <h4 class="tp-panel-title">${esc(div.divisionTitle)} &mdash; Team Flowchart</h4>
              </div>
              <div class="tp-panel-banner-right">
                <button type="button" class="tp-btn tp-btn-sm tp-btn-cancel" onclick="window.ProgressModule.toggleDivision('${divId}')">&times; Close</button>
              </div>
            </div>

            <!-- Tier 1: Division Manager (DM) Tree Node -->
            <div class="tp-tree-tier tp-tree-tier-dm">
              <div class="tp-card tp-card-dm ${isInterim ? 'tp-card-interim' : ''}" id="prog-node-dm-${divId}">
                <div class="tp-card-header">
                  <span class="tp-tag ${isInterim ? 'tp-tag-gray' : 'tp-tag-purple'}">${isInterim ? 'Interim DM' : esc(div.divisionRole || 'Division Manager')}</span>
                  <button type="button" class="tp-card-details-btn" onclick="window.ProgressModule.openModal('${dmStaff.id}')">Details &rarr;</button>
                </div>
                <div class="tp-card-name">${esc(div.divisionLead || 'Interim Lead')}</div>
                <div class="tp-card-role-label">${esc(div.divisionRole || 'Division Manager')}</div>
                <div class="tp-card-sub">${esc(div.divisionTitle)} &middot; Division Operations</div>
                <div class="tp-badge-sm-tag">${divPmCount} ${divPmCount === 1 ? 'Program Manager' : 'Program Managers'} &middot; ${divDistCount} ${divDistCount === 1 ? 'District' : 'Districts'} &middot; ${divPoCount} POs</div>
                <div class="tp-prog-strip" style="margin-top:10px;">
                  <span class="tp-prog-pill ${dmEval.statusClass}">${dmEval.statusLabel}</span>
                  <span class="tp-prog-score">${dmEval.scoreLabel}</span>
                </div>
              </div>
            </div>

            <!-- Vertical Tree Connector Stem -->
            <div class="tp-tree-connector-v"></div>

            <!-- Tier 2: Program Manager (PM) Columns Row -->
            <div class="tp-tree-tier-pms">
              <div class="tp-pm-row">
                ${div.pmColumns.map(pm => renderPMColumn(pm, div, q)).join('')}
              </div>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    container.innerHTML = html;

    if (q) {
      applySearchHighlight(q);
    }

    setTimeout(drawConnectors, 50);
  }

  function renderPMColumn(pm, div, q) {
    const pmStaff = findStaffByNameOrId(pm.name, pm.pmId) || {
      id: pm.pmId,
      Name: pm.name,
      Designation: pm.designation || pm.label || "Program Manager",
      Location: div ? div.divisionTitle : "Maharashtra"
    };
    const pmEval = evaluateEmployee(pmStaff);
    const pmMgr = pm.reportingManager || (div ? (div.divisionLead || "Division Manager") : "Division Manager");
    const isMatched = q && (pm.name.toLowerCase().includes(q) || (pm.label || '').toLowerCase().includes(q));

    return `
      <div class="tp-pm-col ${isMatched ? 'tp-matched' : ''}" id="prog-pmcol-${pm.pmId}">
        <div class="tp-card tp-card-pm" id="prog-node-pm-${pm.pmId}">
          <div class="tp-card-header">
            <span class="tp-tag tp-tag-blue">${esc((pm.label || "Program Manager").replace(/\s+Track$/i, ""))}</span>
            <button type="button" class="tp-card-details-btn" onclick="window.ProgressModule.openModal('${pmStaff.id}')">Details &rarr;</button>
          </div>
          <div class="tp-card-name">${esc(pm.name)}</div>
          <div class="tp-card-role-label">${esc(pm.designation || pm.label || "Program Manager")}</div>
          <div class="tp-card-sub">${pm.districts.length} ${pm.districts.length === 1 ? "District" : "Districts"} Assigned</div>
          <div class="tp-card-mgr-line" style="font-size:11px; color:var(--tp-ink-muted, #64748B); margin-top:3px;">
            <span>Reporting Manager:</span> <strong>${esc(pmMgr)}</strong>
          </div>
          ${pm.badge ? `<div class="tp-badge-sm-tag">${esc(pm.badge)}</div>` : ""}
          <div class="tp-prog-strip" style="margin-top:10px;">
            <span class="tp-prog-pill ${pmEval.statusClass}">${pmEval.statusLabel}</span>
            <span class="tp-prog-score">${pmEval.scoreLabel}</span>
          </div>
        </div>

        <div class="tp-districts-list">
          ${pm.districts.map(dst => renderDistrictCard(dst, pm.name, q)).join("")}
        </div>
      </div>
    `;
  }

  function renderDistrictCard(dst, pmName, q) {
    const dstMgr = dst.reportingManager || pmName || "Program Manager";
    const isMatched = q && (dst.name.toLowerCase().includes(q) || (dst.pos || []).some(p => (p.name || '').toLowerCase().includes(q)));

    return `
      <div class="tp-district-card ${isMatched ? 'tp-matched' : ''}" id="prog-node-dst-${dst.cardId}">
        <div class="tp-district-header">
          <div class="tp-dist-pip"></div>
          <div class="tp-dist-title-box">
            <span class="tp-dist-title">${esc(dst.name)}</span>
            <span class="tp-dist-mgr"><span class="tp-mgr-k">Mgr:</span> <span class="tp-mgr-v">${esc(dstMgr)}</span></span>
          </div>
          <button type="button" class="tp-row-details-btn" onclick="window.ProgressModule.openModal('${dst.roleId}')">Details &rarr;</button>
        </div>
        <div class="tp-pos-list">
          ${(dst.pos || []).map(po => {
            const poCleanName = po.cleanName || (po.name ? po.name.replace(/\s*·\s*PO.*$/i, '') : '');
            const poStaff = findStaffByNameOrId(poCleanName, po.roleId) || {
              id: po.roleId,
              Name: poCleanName || po.name,
              Designation: po.designation || "Project Officer",
              District: dst.name
            };
            const poEval = evaluateEmployee(poStaff);
            const poMgr = po.reportingManager || dstMgr;
            const poMatched = q && (poCleanName.toLowerCase().includes(q) || (po.designation || '').toLowerCase().includes(q));

            return `
              <div class="tp-po-row ${poMatched ? 'tp-matched-row' : ''}" style="cursor:pointer;" onclick="window.ProgressModule.openModal('${poStaff.id}')">
                <div class="tp-po-info">
                  <span class="tp-po-dot"></span>
                  <div class="tp-po-text-wrap">
                    <div class="tp-po-name">${esc(poCleanName || po.name)}</div>
                    <div class="tp-po-role">${esc(po.designation || "Project Officer")}</div>
                  </div>
                </div>
                <div class="tp-prog-strip-inline" style="display:flex; align-items:center; gap:6px; margin:0 8px;">
                  <span class="tp-prog-pill ${poEval.statusClass}" style="font-size:10px; padding:2px 6px;">${poEval.statusLabel}</span>
                  <span class="tp-prog-score" style="font-size:10px;">${poEval.scoreLabel}</span>
                </div>
                <button type="button" class="tp-row-details-btn" onclick="event.stopPropagation(); window.ProgressModule.openModal('${poStaff.id}')">Details &rarr;</button>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function applySearchHighlight(q) {
    const cards = document.querySelectorAll('#tpProgTreeContainer .tp-card, #tpProgTreeContainer .tp-district-card, #tpProgTreeContainer .tp-po-row');
    cards.forEach(c => {
      const text = c.textContent.toLowerCase();
      const match = text.includes(q);
      c.style.opacity = match ? '1' : '0.28';
      if (match) c.classList.add('tp-matched');
      else c.classList.remove('tp-matched');
    });
  }

  // --- SVG Connectors for Progress Tab (Exact Replica of Smart Goals) ---
  function drawConnectors() {
    const svg = document.getElementById('tpProgConnectorSvg');
    const container = document.getElementById('tpProgTreeCanvas');
    const treeContainer = document.getElementById('tpProgTreeContainer');
    if (!svg || typeof svg.setAttribute !== 'function' || !container || !treeContainer) return;

    const width = Math.max(container.scrollWidth, treeContainer.scrollWidth);
    const height = Math.max(container.scrollHeight, treeContainer.scrollHeight);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.style.width = width + 'px';
    svg.style.height = height + 'px';

    const rootCard = document.querySelector('#tpProgTreeContainer .tp-card-root');
    const divCards = document.querySelectorAll('#tpProgTreeContainer .tp-divisions-row .tp-card-div');

    if (!rootCard || !divCards.length) {
      svg.innerHTML = '';
      return;
    }

    let toSvg;
    const ctm = typeof svg.getScreenCTM === 'function' ? svg.getScreenCTM() : null;
    if (ctm && typeof svg.createSVGPoint === 'function') {
      const invCtm = ctm.inverse();
      const pt = svg.createSVGPoint();
      toSvg = (sx, sy) => {
        pt.x = sx;
        pt.y = sy;
        const res = pt.matrixTransform(invCtm);
        return { x: Math.round(res.x), y: Math.round(res.y) };
      };
    } else {
      const cRect = container.getBoundingClientRect();
      toSvg = (sx, sy) => ({
        x: Math.round(sx - cRect.left),
        y: Math.round(sy - cRect.top)
      });
    }

    const rBox = rootCard.getBoundingClientRect();
    const rPt = toSvg(rBox.left + rBox.width / 2, rBox.bottom);
    const rX = rPt.x;
    const rY = rPt.y;

    const divPoints = [];
    divCards.forEach(dCard => {
      const dBox = dCard.getBoundingClientRect();
      if (dBox.width > 0 && dBox.height > 0) {
        const dPt = toSvg(dBox.left + dBox.width / 2, dBox.top);
        divPoints.push({ dX: dPt.x, dY: dPt.y, id: dCard.id });
      }
    });

    if (!divPoints.length) {
      svg.innerHTML = '';
      return;
    }

    const minDivY = Math.min(...divPoints.map(p => p.dY));
    const busY = Math.round((rY + minDivY) / 2);
    const minX = Math.min(rX, ...divPoints.map(p => p.dX));
    const maxX = Math.max(rX, ...divPoints.map(p => p.dX));

    let paths = '';
    // 1. Root pip
    paths += `<circle cx="${rX}" cy="${rY}" r="4" class="tp-connector-root-pip"/>`;
    // 2. Trunk stem
    paths += `<line x1="${rX}" y1="${rY}" x2="${rX}" y2="${busY}" class="tp-connector-trunk"/>`;
    // 3. Central junction hub
    paths += `<circle cx="${rX}" cy="${busY}" r="5" class="tp-connector-hub"/>`;
    // 4. Horizontal busbar
    paths += `<line x1="${minX}" y1="${busY}" x2="${maxX}" y2="${busY}" class="tp-connector-branch tp-connector-busbar"/>`;
    // 5. Individual vertical drops to each division card
    divPoints.forEach(pt => {
      paths += `
        <g class="tp-connector-group" id="conn-${pt.id}">
          <line x1="${pt.dX}" y1="${busY}" x2="${pt.dX}" y2="${pt.dY}" class="tp-connector-branch tp-connector-drop"/>
          <circle cx="${pt.dX}" cy="${pt.dY}" r="3.5" class="tp-connector-anchor"/>
        </g>
      `;
    });

    svg.innerHTML = paths;
  }

  // --- Open Detailed Field Review Modal ---
  function openModal(empId) {
    const staffList = getStaffList();
    const staff = staffList.find(s => s.id === empId || s.Email === empId) || findStaffByNameOrId(null, empId) || {
      id: empId,
      Name: "Staff Member",
      Designation: "Field Staff",
      Location: "Field"
    };

    const evalRes = evaluateEmployee(staff);
    state.selectedEmp = { staff, evalRes };

    const modal = document.getElementById('tpProgModal');
    if (!modal) return;

    let modalBody = '';
    const d = evalRes.details;

    if (!evalRes.isAssigned) {
      modalBody = `
        <div class="tp-prog-modal-notice" style="text-align:center; padding:24px 16px;">
          <div class="tp-prog-notice-ico" style="font-size:36px; margin-bottom:8px;">📋</div>
          <h4 style="font-size:16px; font-weight:800; color:var(--tp-ink, #0F172A); margin-bottom:8px;">Option 1 Notice: Pending Field Assignment</h4>
          <p style="font-size:13px; color:var(--tp-ink-muted, #64748B); max-width:500px; margin:0 auto; line-height:1.5;">${esc(evalRes.managerRemark || 'This employee is active in SMART GOALS roster, but does not yet have an active assignment registered in the Field Review System.')}</p>
        </div>
      `;
    } else if (!d) {
      modalBody = `
        <div class="tp-prog-modal-notice" style="text-align:center; padding:24px 16px;">
          <div class="tp-prog-notice-ico" style="font-size:36px; margin-bottom:8px;">○</div>
          <h4 style="font-size:16px; font-weight:800; color:var(--tp-ink, #0F172A); margin-bottom:8px;">Review Pending for ${formatMonthLabel(state.activeMonth)}</h4>
          <p style="font-size:13px; color:var(--tp-ink-muted, #64748B); max-width:500px; margin:0 auto; line-height:1.5;">No monthly review data has been submitted for this staff member in ${formatMonthLabel(state.activeMonth)} yet.</p>
        </div>
      `;
    } else {
      // Build Sections
      const A = d.A || {};
      const B = d.B || {};
      const G = d.G || {};
      const H = d.H || {};
      const M = d.M || {};

      // B Items List
      let bItemsHtml = '';
      [1, 2, 3, 4, 5].forEach(n => {
        const item = B['B' + n];
        if (item) {
          const text = item.text || item;
          const status = item.status || 'Pending';
          const isDone = status === 'Done';
          bItemsHtml += `
            <div class="tp-prog-action-row">
              <span class="tp-prog-action-num">B${n}</span>
              <span class="tp-prog-action-txt">${esc(text)}</span>
              <span class="tp-prog-pill ${isDone ? 'tp-prog-pill--done' : 'tp-prog-pill--pending'}">${esc(status)}</span>
            </div>
          `;
        }
      });

      // G Items List
      let gItemsHtml = '';
      if (G.G1) {
        gItemsHtml += `
          <div class="tp-prog-action-row tp-prog-blocker">
            <span class="tp-prog-action-num">Blocker</span>
            <span class="tp-prog-action-txt">${esc(G.G1)}</span>
          </div>
        `;
      }
      [2, 3, 4, 5, 6].forEach((n, idx) => {
        const val = G['G' + n];
        if (val) {
          gItemsHtml += `
            <div class="tp-prog-action-row">
              <span class="tp-prog-action-num">Action ${idx + 1}</span>
              <span class="tp-prog-action-txt">${esc(val)}</span>
            </div>
          `;
        }
      });

      modalBody = `
        <div class="tp-prog-sections">
          <!-- Section H: Manager Review -->
          <div class="tp-prog-sec tp-prog-sec--mgr">
            <div class="tp-prog-sec-hd">
              <span>Section H · Reporting Manager Evaluation</span>
              <span class="tp-prog-pill ${H.H1 === 'Y' ? 'tp-prog-pill--done' : 'tp-prog-pill--pending'}">
                ${H.H1 === 'Y' ? '✓ Review Held' : 'Review Not Held'}
              </span>
            </div>
            <div class="tp-prog-sec-body">
              <div class="tp-prog-mgr-grid">
                <div><strong>Manager Status Rating:</strong> <span class="tp-badge">${esc(H.H2 || 'Not recorded')}</span></div>
                <div><strong>Manager Reviewer:</strong> ${esc(staff.Reporting_manager || staff['Reporting manager'] || 'Manager')}</div>
              </div>
              ${H.H3 ? `<div class="tp-prog-mgr-remark"><strong>Manager Feedback &amp; Remarks:</strong><p>${esc(H.H3)}</p></div>` : ''}
            </div>
          </div>

          <!-- Section B: Previous Month Actions -->
          <div class="tp-prog-sec">
            <div class="tp-prog-sec-hd">
              <span>Section B · Action Item Execution (${d.bDone}/${d.bTotal} Completed)</span>
            </div>
            <div class="tp-prog-sec-body">
              ${bItemsHtml || '<div class="tp-muted" style="font-size:12px; color:#64748B;">No specific carried actions recorded.</div>'}
            </div>
          </div>

          <!-- Section G: Next Month Commitments -->
          <div class="tp-prog-sec">
            <div class="tp-prog-sec-hd">
              <span>Section G · Commitments &amp; Escalations for Next Month</span>
            </div>
            <div class="tp-prog-sec-body">
              ${gItemsHtml || '<div class="tp-muted" style="font-size:12px; color:#64748B;">No future commitments recorded.</div>'}
            </div>
          </div>

          <!-- Section A: Mood & Mindset -->
          <div class="tp-prog-sec">
            <div class="tp-prog-sec-hd">
              <span>Section A · Self Check-in</span>
            </div>
            <div class="tp-prog-sec-body">
              <div style="font-size: 13px;"><strong>Monthly Sentiment / Mood:</strong> ${A.A1 === 'Y' ? '😊 Positive / Good' : esc(A.A1 || 'Not recorded')}</div>
              ${A.A2 ? `<div style="font-size: 13px; margin-top: 6px;"><strong>Mindset &amp; Notes:</strong> ${esc(A.A2)}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }

    modal.innerHTML = `
      <div class="tp-modal-dialog tp-prog-modal-dialog" role="dialog" aria-modal="true">
        <div class="tp-modal-header">
          <div class="tp-modal-title-wrap">
            <h3 class="tp-modal-title">${esc(staff.Name)}</h3>
            <div class="tp-modal-role-row">
              <span class="tp-modal-badge">${esc(staff.Designation || 'Field Staff')}</span>
              <span class="tp-prog-pill ${evalRes.statusClass}">${evalRes.statusLabel}</span>
              <span class="tp-prog-score">${evalRes.scoreLabel}</span>
            </div>
            <div class="tp-modal-person">
              <span>District: ${esc(staff.District || staff.Location || 'Field')} · Month: ${formatMonthLabel(state.activeMonth)}</span>
            </div>
          </div>
          <button type="button" class="tp-modal-close" onclick="window.ProgressModule.closeModal()" title="Close">&times;</button>
        </div>
        <div class="tp-modal-body" style="padding: 20px;">
          ${modalBody}
        </div>
      </div>
    `;

    modal.style.display = 'flex';
  }

  function closeModal() {
    const modal = document.getElementById('tpProgModal');
    if (modal) modal.style.display = 'none';
  }

  // Export module to global scope
  window.ProgressModule = {
    init,
    render,
    switchDivision: toggleDivision,
    toggleDivision,
    expandAll,
    collapseAll,
    clearSearch,
    drawConnectors,
    openModal,
    closeModal,
    refreshFromSupabase
  };

})();
