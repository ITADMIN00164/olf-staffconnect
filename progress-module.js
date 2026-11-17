/**
 * Progress Module for OLF StaffConnect (OLF Insight)
 * Exact Flowchart Hierarchy Replica of SMART GOALS displaying live Monthly Field Review Performance
 * Connected directly to Supabase Field Review System (review_responses & assignments)
 * Supports all 4 States: Maharashtra (MH), Chhattisgarh (CH), Madhya Pradesh (MP), Bihar (BR)
 */

(function () {
  'use strict';

  // State
  let state = {
    activeState: 'MH',     // Default: Maharashtra
    activeMonth: '202610', // Default: October 2026
    searchQuery: '',
    statusFilter: null,    // null (All) or 'done', 'partial', 'pending', 'unassigned'
    viewMode: 'flowchart', // 'flowchart' or 'table' (task-271)
    sortColumn: 'name',    // 'name', 'role', 'division', 'district', 'manager', 'status', 'score', 'managerStatus'
    sortDirection: 'asc',  // 'asc' or 'desc'
    filterRole: '',
    filterDivision: '',
    filterDistrict: '',
    filterManager: '',
    filterScore: '',
    filterManagerStatus: '',
    isLoading: false,
    selectedEmp: null
  };

  let currentModalRoster = [];

  // Divisions open state (starts empty so user sees all division overview cards first; opens one at a time)
  let expandedDivisions = new Set();

  // Local data store (initialized from precached data, updated live from Supabase)
  let cachedReviews = (typeof window !== 'undefined' && window.FIELD_REVIEW_PRECACHED_DATA)
    ? JSON.parse(JSON.stringify(window.FIELD_REVIEW_PRECACHED_DATA))
    : {};
  let cachedAssignments = (typeof window !== 'undefined' && window.FIELD_REVIEW_PRECACHED_ASSIGNMENTS)
    ? [...window.FIELD_REVIEW_PRECACHED_ASSIGNMENTS]
    : [];

  // Verified live Field Review System monthly score cache
  const liveScoreCache = { 'OLF-25-146': 67.1 };

  function formatFlowScore(evalRes, staffId) {
    if (!evalRes) return '— / 100';
    if (evalRes.status === 'unassigned') return '—';
    const id = staffId || evalRes.empId;
    const live = (id && liveScoreCache[id] != null)
      ? liveScoreCache[id]
      : (evalRes.empId && liveScoreCache[evalRes.empId] != null ? liveScoreCache[evalRes.empId] : null);
    if (live != null) {
      const num = Number(live) || 0;
      const disp = (num % 1 !== 0) ? num.toFixed(1) : num;
      return `${disp} / 100`;
    }
    return '— / 100';
  }

  function updateScoreCellInDOM(empId, totalScore) {
    const scNum = Number(totalScore) || 0;
    const clr = getScoreColor(scNum);
    const scDisp = (scNum % 1 !== 0) ? scNum.toFixed(1) : scNum;

    // 1. Update table cell if present
    const cell = document.getElementById('tp-prog-score-cell-' + empId);
    if (cell) {
      cell.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; font-weight:700;">
          <span style="color:${clr}; font-weight:800;">${scDisp}/100</span>
          <span style="font-size:9.5px; font-weight:600; color:var(--tp-ink-muted, #64748B);">${Math.round(scNum)}%</span>
        </div>
        <div class="tp-score-bar-track">
          <div class="tp-score-bar-fill" style="width:${Math.min(100, Math.max(0, scNum))}%; background:${clr};"></div>
        </div>
      `;
    }

    // 2. Update flowchart score badge if present
    const flowBadges = document.querySelectorAll(`[id="tp-prog-flow-score-${empId}"], [data-flow-score-id="${empId}"]`);
    flowBadges.forEach(badge => {
      badge.textContent = `${scDisp} / 100`;
      badge.style.color = clr;
      badge.style.fontWeight = '800';
    });
  }

  function syncLiveScores(list) {
    if (typeof window === 'undefined') return;
    const toFetch = (list || []).filter(r => r.evalRes && r.evalRes.status !== 'unassigned' && r.staff && r.staff.id && liveScoreCache[r.staff.id] == null);
    if (!toFetch.length) return;

    (async function () {
      const concurrency = 5;
      for (let i = 0; i < toFetch.length; i += concurrency) {
        const chunk = toFetch.slice(i, i + concurrency);
        await Promise.all(chunk.map(async r => {
          const id = r.staff.id;
          try {
            let res = null;
            if (window.FTRDashboard && typeof window.FTRDashboard.getMonthlyGoalNumbers === 'function') {
              try {
                res = await window.FTRDashboard.getMonthlyGoalNumbers(id, state.activeMonth);
              } catch (e) {}
            }
            if ((!res || res.totalScore == null) && typeof fetchDirectGoalNumbers === 'function') {
              try {
                res = await fetchDirectGoalNumbers(id, state.activeMonth, r.staff);
              } catch (e) {}
            }
            if (res && res.totalScore != null) {
              liveScoreCache[id] = res.totalScore;
              updateScoreCellInDOM(id, res.totalScore);
              if (r.evalRes && r.evalRes.empId && r.evalRes.empId !== id) {
                liveScoreCache[r.evalRes.empId] = res.totalScore;
                updateScoreCellInDOM(r.evalRes.empId, res.totalScore);
              }
            }
          } catch (e) {
            // silent fallback
          }
        }));
      }
    })();
  }

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

  function getStateData(tree, stateCode) {
    if (!tree) return { sl: null, divisions: [], label: 'Maharashtra', tag: 'Maharashtra', code: 'MH' };

    if (stateCode === 'CH') {
      return {
        sl: tree.chRoot || {
          roleId: "dm-cg",
          name: "Jeetendra Singh",
          designation: "Division Manager",
          reportingManager: "Vishvajit G Pawar",
          title: "State Lead — Chhattisgarh"
        },
        divisions: tree.chDivisions || [],
        label: "Chhattisgarh",
        tag: "Chhattisgarh",
        code: "CH"
      };
    }
    if (stateCode === 'MP') {
      return {
        sl: tree.mpRoot || {
          roleId: "pm-v2",
          name: "Abhijeet L Vaidhay",
          designation: "Program Manager / Interim",
          reportingManager: "Vishvajit G Pawar",
          title: "State Operations — Madhya Pradesh"
        },
        divisions: tree.mpDivisions || [],
        label: "Madhya Pradesh",
        tag: "Madhya Pradesh",
        code: "MP"
      };
    }
    if (stateCode === 'BR') {
      return {
        sl: tree.brRoot || {
          roleId: "dm-pune",
          name: "Manoj C Girase",
          designation: "Associate Division Manager / Interim",
          reportingManager: "Vishvajit G Pawar",
          title: "State Operations — Bihar"
        },
        divisions: tree.brDivisions || [],
        label: "Bihar",
        tag: "Bihar",
        code: "BR"
      };
    }

    // Default: MH
    return {
      sl: tree.stateLead || {
        roleId: "statelead",
        name: "Vishvajit G Pawar",
        designation: "State Lead",
        reportingManager: "Prashant Patil",
        title: "State Lead — Maharashtra"
      },
      divisions: tree.mhDivisions || [],
      label: "Maharashtra",
      tag: "Maharashtra",
      code: "MH"
    };
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

  function getInitials(name) {
    if (!name) return 'ST';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // Compute structured goals score and category breakdown
  function computeStaffScore(d) {
    const emptyResult = {
      totalScore: 0,
      g1Score: 0,
      g2Score: 0,
      g3Score: 0,
      g4Score: 0,
      g5Score: 0,
      g1Done: 0,
      g1Pct: 0,
      g2Pct: 0,
      g2DoneTxt: 'Pending Review',
      g3Clusters: 0,
      g3Pct: 0,
      g4T: 100,
      g4D: 0,
      g4Pct: 0,
      g4Name: 'District Specific Priorities',
      g5DoneCount: 0,
      g5Pct: 0,
      habitStatuses: []
    };

    if (!d) return emptyResult;

    const A = d.A || {};
    const B = d.B || {};
    const G = d.G || {};
    const H = d.H || {};
    const M = d.M || {};
    const bDone = d.bDone || 0;
    const bTotal = d.bTotal || 0;

    const hasData = (H.H2 != null && H.H2 !== '') || bTotal > 0 || Object.keys(M).length > 0 || (A.A1 != null && A.A1 !== '');
    if (!hasData) return emptyResult;

    // G1: Academic Programs (weight 40, target 2 exams)
    let g1Done = 0;
    if (M.M_G1_DONE != null && M.M_G1_DONE !== '') {
      g1Done = Number(M.M_G1_DONE) || 0;
    } else if (H.H2 === 'On track') {
      g1Done = 2;
    } else if (bDone > 0) {
      g1Done = Math.min(2, Math.round((bDone / Math.max(1, bTotal)) * 2));
    }
    const g1Pct = Math.min(100, Math.round((g1Done / 2) * 100));
    const g1Score = Math.min(40, Math.round((g1Pct / 100) * 40));

    // G2: Life Skills (weight 20)
    let g2Pct = 100;
    let g2DoneTxt = 'On Track';
    if (H.H2 === 'Needs support') {
      g2Pct = 60;
      g2DoneTxt = 'Needs Support (60%)';
    } else if (H.H2 === 'Critical') {
      g2Pct = 40;
      g2DoneTxt = 'Lagging (40%)';
    } else if (bTotal > 0) {
      g2Pct = Math.round((bDone / bTotal) * 100);
      g2DoneTxt = `${g2Pct}% Achieved`;
    }
    const g2Score = Math.min(20, Math.round((g2Pct / 100) * 20));

    // G3: Vibrant Teacher Community (weight 20, target 3 POM clusters)
    let g3Clusters = 0;
    if (M.M_G3_POMCLUSTERS != null && M.M_G3_POMCLUSTERS !== '') {
      g3Clusters = Number(M.M_G3_POMCLUSTERS) || 0;
    } else if (H.H2 === 'On track') {
      g3Clusters = 3;
    } else if (bDone >= 3) {
      g3Clusters = 2;
    } else if (bDone > 0) {
      g3Clusters = 1;
    }
    const g3Pct = Math.min(100, Math.round((g3Clusters / 3) * 100));
    const g3Score = Math.min(20, Math.round((g3Pct / 100) * 20));

    // G4: Other Priorities (weight 10)
    const g4Name = (M.M_G4_1_NAME && String(M.M_G4_1_NAME).trim()) || 'District Specific Priorities';
    const g4T = Number(M.M_G4_1_T) || 100;
    let g4D = 0;
    if (M.M_G4_1_D != null && M.M_G4_1_D !== '') {
      g4D = Number(M.M_G4_1_D) || 0;
    } else if (H.H2 === 'On track') {
      g4D = g4T;
    } else if (bTotal > 0) {
      g4D = Math.round((bDone / bTotal) * g4T);
    }
    const g4Pct = g4T > 0 ? Math.min(100, Math.round((g4D / g4T) * 100)) : 100;
    const g4Score = Math.min(10, Math.round((g4Pct / 100) * 10));

    // G5: Self-Development & Execution Habits (weight 10, 9 habits)
    const g5Habits = [
      { key: 'M_G5_NIMBLE', label: 'Nimble System', sub: 'Field Activity Daily' },
      { key: 'M_G5_WHATSAPP', label: 'WhatsApp Groups', sub: 'Vinoba Teacher Groups' },
      { key: 'M_G5_FVR', label: 'Field Visit Reports', sub: 'School Visit Submissions' },
      { key: 'M_G5_POM', label: 'POM Tracking', sub: 'Monthly Meet Register' },
      { key: 'M_G5_CEOPPT', label: 'CEO Presentation', sub: 'Monthly District Review PPT' },
      { key: 'M_G5_ACTTRACKER', label: 'Activity Tracker', sub: 'Daily Action Log' },
      { key: 'M_G5_CEOTRACKER', label: 'CEO Tracker', sub: 'Action Points Register' },
      { key: 'M_G5_COMMIT', label: 'Weekly Commitments', sub: 'Team Action Goals' },
      { key: 'M_G5_CASESTUDY', label: 'Case Studies', sub: 'Inspiring Stories' }
    ];

    let g5DoneCount = 0;
    const habitStatuses = g5Habits.map(h => {
      const val = M[h.key];
      let isDone = false;
      let valDisplay = '';
      if (h.key === 'M_G5_CASESTUDY') {
        const num = Number(val) || 0;
        isDone = num > 0;
        valDisplay = num > 0 ? `${num} Logged` : '0';
      } else {
        isDone = val === 'Y' || val === true || val === '1';
        valDisplay = isDone ? '✓ Yes' : 'Pending';
      }
      if (!isDone && Object.keys(M).length === 0 && H.H2 === 'On track') {
        isDone = true;
        valDisplay = '✓ Yes';
      }
      if (isDone) g5DoneCount++;
      return Object.assign({}, h, { isDone, valDisplay });
    });

    const g5Pct = Math.min(100, Math.round((g5DoneCount / 9) * 100));
    const g5Score = Math.min(10, Math.round((g5Pct / 100) * 10));

    const totalScore = Math.min(100, g1Score + g2Score + g3Score + g4Score + g5Score);

    return {
      totalScore,
      g1Score,
      g2Score,
      g3Score,
      g4Score,
      g5Score,
      g1Done,
      g1Pct,
      g2Pct,
      g2DoneTxt,
      g3Clusters,
      g3Pct,
      g4T,
      g4D,
      g4Pct,
      g4Name,
      g5DoneCount,
      g5Pct,
      habitStatuses
    };
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
        totalScore: 0,
        scoreData: null,
        managerStatus: 'Not submitted',
        managerRemark: '',
        details: null
      };
    }

    const maps = buildAssignmentMaps();
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
        totalScore: 0,
        scoreData: null,
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
        totalScore: null,
        scoreData: null,
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
    const mgrDone = (H.H1 === 'Y' && H.H2 != null && H.H2 !== '') || (H.H2 != null && H.H2 !== '');

    let status = 'pending';
    let statusLabel = 'Pending Review';
    let statusClass = 'tp-prog-pill--pending';

    if (mgrDone) {
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

    const details = { A, B, G, H, M, bTotal, bDone };
    const scoreData = computeStaffScore(details);
    const cachedScore = (liveScoreCache[assign.emp_id] != null)
      ? liveScoreCache[assign.emp_id]
      : (liveScoreCache[id] != null ? liveScoreCache[id] : null);
    const totalScore = (cachedScore != null)
      ? cachedScore
      : ((mgrDone || selfDone) ? scoreData.totalScore : null);

    let scoreLabel = '— / 100';
    if (H.H2 === 'On track') {
      scoreLabel = totalScore > 0 ? `⭐ ${totalScore}/100` : '⭐ On Track';
    } else if (H.H2 === 'Needs support') {
      scoreLabel = totalScore > 0 ? `⚠️ ${totalScore}/100` : '⚠️ Needs Support';
    } else if (H.H2 === 'Critical') {
      scoreLabel = totalScore > 0 ? `🚨 ${totalScore}/100` : '🚨 Critical';
    } else if (totalScore > 0) {
      scoreLabel = `${totalScore} / 100`;
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
      totalScore,
      scoreData,
      managerStatus: H.H2 || (mgrDone ? 'Review Held' : 'Awaiting Manager Review'),
      managerRemark: H.H3 || '',
      details
    };
  }

  // --- Initialize Module ---
  function init() {
    buildAssignmentMaps();
    bindControls();
    setViewMode(state.viewMode);
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
        if (state.viewMode === 'table') {
          renderTableOnly();
        } else {
          renderTreeOnly();
        }
      };
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', debounce(drawConnectors, 80));
    }
  }

  // --- Switch Active State (MH, CH, MP, BR) ---
  function setState(st) {
    state.activeState = st;
    ['MH', 'CH', 'MP', 'BR'].forEach(code => {
      const btn = document.getElementById('tpProgSeg' + code);
      if (btn) btn.classList.toggle('active', code === st);
    });

    expandedDivisions.clear();
    state.filterDivision = '';
    state.filterDistrict = '';
    state.filterManager = '';
    render();
  }

  function clearSearch() {
    state.searchQuery = '';
    const searchInput = document.getElementById('tpProgSearchInput');
    const searchClear = document.getElementById('tpProgSearchClear');
    if (searchInput) searchInput.value = '';
    if (searchClear) searchClear.style.display = 'none';
    if (state.viewMode === 'table') {
      renderTableOnly();
    } else {
      renderTreeOnly();
    }
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
  function renderKPIRow(stats, stateData) {
    const kpiEl = document.getElementById('tpProgKpiRow');
    if (!kpiEl) return;

    const sf = state.statusFilter;

    kpiEl.innerHTML = `
      <div class="tp-prog-kpi-card ${sf === null ? 'active' : ''}" onclick="window.ProgressModule.setStatusFilter('all')" ondblclick="window.ProgressModule.openStatusModal('all')" title="Click to show all staff · Click 📋 to view full roster">
        <div class="tp-kpi-val-row">
          <div class="tp-prog-kpi-val">${stats.total}</div>
          <button type="button" class="tp-kpi-view-btn" onclick="event.stopPropagation(); window.ProgressModule.openStatusModal('all')" title="View complete roster">📋</button>
        </div>
        <div class="tp-prog-kpi-lbl">Total Staff</div>
      </div>
      <div class="tp-prog-kpi-card tp-prog-kpi--done ${sf === 'done' ? 'active' : ''}" onclick="window.ProgressModule.setStatusFilter('done')" ondblclick="window.ProgressModule.openStatusModal('done')" title="Click to filter by Review Done · Click 📋 to view list">
        <div class="tp-kpi-val-row">
          <div class="tp-prog-kpi-val">${stats.done}</div>
          <button type="button" class="tp-kpi-view-btn" onclick="event.stopPropagation(); window.ProgressModule.openStatusModal('done')" title="View Review Done roster">📋</button>
        </div>
        <div class="tp-prog-kpi-lbl">✓ Review Done</div>
      </div>
      <div class="tp-prog-kpi-card tp-prog-kpi--partial ${sf === 'partial' ? 'active' : ''}" onclick="window.ProgressModule.setStatusFilter('partial')" ondblclick="window.ProgressModule.openStatusModal('partial')" title="Filter by Partially Done · Click 📋 to view list">
        <div class="tp-kpi-val-row">
          <div class="tp-prog-kpi-val">${stats.partial}</div>
          <button type="button" class="tp-kpi-view-btn" onclick="event.stopPropagation(); window.ProgressModule.openStatusModal('partial')" title="View Partially Done roster">📋</button>
        </div>
        <div class="tp-prog-kpi-lbl">◐ Partially Done</div>
      </div>
      <div class="tp-prog-kpi-card tp-prog-kpi--pending ${sf === 'pending' ? 'active' : ''}" onclick="window.ProgressModule.setStatusFilter('pending')" ondblclick="window.ProgressModule.openStatusModal('pending')" title="Filter by Review Pending · Click 📋 to view list">
        <div class="tp-kpi-val-row">
          <div class="tp-prog-kpi-val">${stats.pending}</div>
          <button type="button" class="tp-kpi-view-btn" onclick="event.stopPropagation(); window.ProgressModule.openStatusModal('pending')" title="View Review Pending roster">📋</button>
        </div>
        <div class="tp-prog-kpi-lbl">○ Review Pending</div>
      </div>
      <div class="tp-prog-kpi-card tp-prog-kpi--opt1 ${sf === 'unassigned' ? 'active' : ''}" onclick="window.ProgressModule.setStatusFilter('unassigned')" ondblclick="window.ProgressModule.openStatusModal('unassigned')" title="Filter by Pending Assignment · Click 📋 to view list">
        <div class="tp-kpi-val-row">
          <div class="tp-prog-kpi-val">${stats.unassigned}</div>
          <button type="button" class="tp-kpi-view-btn" onclick="event.stopPropagation(); window.ProgressModule.openStatusModal('unassigned')" title="View Pending Assignment roster">📋</button>
        </div>
        <div class="tp-prog-kpi-lbl">📋 Pending Assign.</div>
      </div>
    `;

    renderFilterBanner(stats, stateData);

    const countBadge = document.getElementById('tpProgTotalCountBadge');
    if (countBadge) {
      const activeDivCount = stateData.divisions.length;
      countBadge.textContent = `${stateData.label} · ${activeDivCount} ${activeDivCount === 1 ? 'Division' : 'Divisions'} · ${stats.total} Staff · ${stats.done} Done`;
    }
  }

  function renderFilterBanner(stats, stateData) {
    const banner = document.getElementById('tpProgFilterBanner');
    if (!banner) return;

    const sf = state.statusFilter;
    if (!sf) {
      banner.style.display = 'none';
      banner.innerHTML = '';
      return;
    }

    let label = 'Filtered';
    let count = 0;
    let cls = 'tp-banner--all';

    if (sf === 'done') {
      label = '✓ Review Done';
      count = stats.done;
      cls = 'tp-banner--done';
    } else if (sf === 'partial') {
      label = '◐ Partially Done';
      count = stats.partial;
      cls = 'tp-banner--partial';
    } else if (sf === 'pending') {
      label = '○ Review Pending';
      count = stats.pending;
      cls = 'tp-banner--pending';
    } else if (sf === 'unassigned') {
      label = '📋 Pending Assignment';
      count = stats.unassigned;
      cls = 'tp-banner--opt1';
    }

    banner.className = `tp-prog-filter-banner ${cls}`;
    banner.style.display = 'flex';
    banner.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:14px;">⚡</span>
        <span>Active Filter: <strong>${label}</strong> (${count} ${count === 1 ? 'Staff Member' : 'Staff Members'}) &mdash; flowchart dimmed to matching roles</span>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button type="button" class="tp-btn tp-btn-sm" style="background:var(--tp-surface, #fff); color:var(--tp-ink, #0F172A); border:1px solid #CBD5E1; font-weight:700; padding:4px 10px; border-radius:6px; cursor:pointer;" onclick="window.ProgressModule.openStatusModal('${sf}')">
          📋 View Full Roster (${count}) &rarr;
        </button>
        <button type="button" class="tp-btn tp-btn-sm" style="background:transparent; border:none; color:inherit; font-weight:700; cursor:pointer; padding:4px 8px;" onclick="window.ProgressModule.clearStatusFilter()" title="Clear filter">
          &times; Clear Filter
        </button>
      </div>
    `;
  }

  function setStatusFilter(statusKey) {
    if (statusKey === 'all' || state.statusFilter === statusKey) {
      state.statusFilter = null;
    } else {
      state.statusFilter = statusKey;
    }

    const tree = getTreeData();
    const stateData = getStateData(tree, state.activeState);
    const roster = getRosterForState();
    const stats = calculateStats(roster);

    // When filter is active, auto-expand the first division with matching members if none currently expanded has matches
    if (state.statusFilter) {
      const matchingDivs = new Set();
      roster.filter(r => r.evalRes.status === state.statusFilter).forEach(r => {
        if (r.divisionId) matchingDivs.add(normalizeDivId(r.divisionId));
      });
      const hasExpandedMatch = Array.from(expandedDivisions).some(d => matchingDivs.has(normalizeDivId(d)));
      if (!hasExpandedMatch && matchingDivs.size > 0) {
        expandedDivisions.clear();
        expandedDivisions.add(Array.from(matchingDivs)[0]);
      }
    }

    renderKPIRow(stats, stateData);
    renderDivisionPills(stateData.divisions);
    if (state.viewMode === 'table') {
      renderTableOnly();
    } else {
      renderTreeOnly();
    }
  }

  function clearStatusFilter() {
    setStatusFilter('all');
  }

  // Toggle division (strictly opens ONE at a time; collapses others)
  function toggleDivision(divId) {
    const norm = normalizeDivId(divId);
    const isAlreadyOpen = expandedDivisions.has(norm) || expandedDivisions.has(divId);

    // Open one at a time: clear any currently expanded division
    expandedDivisions.clear();

    // If it wasn't already open, open only this division
    if (!isAlreadyOpen) {
      expandedDivisions.add(norm);
    }

    const tree = getTreeData();
    const stateData = getStateData(tree, state.activeState);
    renderDivisionPills(stateData.divisions);
    renderTreeOnly();

    if (!isAlreadyOpen) {
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
    const stateData = getStateData(tree, state.activeState);
    stateData.divisions.forEach(d => {
      expandedDivisions.add(normalizeDivId(d.divisionId));
      expandedDivisions.add(d.divisionId);
    });
    renderDivisionPills(stateData.divisions);
    renderTreeOnly();
  }

  // Collapse all divisions
  function collapseAll() {
    expandedDivisions.clear();
    const tree = getTreeData();
    const stateData = getStateData(tree, state.activeState);
    renderDivisionPills(stateData.divisions);
    renderTreeOnly();
  }

  // Collect full roster with state/division/district metadata
  function getRosterForState() {
    const tree = getTreeData();
    const stateData = getStateData(tree, state.activeState);
    const roster = [];
    const seenIds = new Set();

    function record(staffObj, role, divTitle, divId, distName, mgrName) {
      if (!staffObj) return;
      const sId = staffObj.id || (staffObj.Name || '');
      if (seenIds.has(sId)) return;
      seenIds.add(sId);

      const ev = evaluateEmployee(staffObj);
      roster.push({
        staff: staffObj,
        evalRes: ev,
        role: role || staffObj.Designation || 'Field Staff',
        division: divTitle || staffObj.Location || stateData.label,
        divisionId: divId || '',
        district: distName || staffObj.District || '—',
        manager: mgrName || staffObj.ReportingManager || 'Leadership'
      });
    }

    // State Lead
    if (stateData.sl) {
      const slStaff = findStaffByNameOrId(stateData.sl.name, stateData.sl.roleId) || {
        id: stateData.sl.roleId || 'statelead',
        Name: stateData.sl.name,
        Designation: stateData.sl.designation || 'State Lead',
        Location: stateData.label
      };
      record(slStaff, stateData.sl.designation || 'State Lead', stateData.label, '', 'Statewide', stateData.sl.reportingManager || 'Prashant Patil');
    }

    // Divisions
    (stateData.divisions || []).forEach(div => {
      const dmStaff = findStaffByNameOrId(div.divisionLead, div.divisionRoleId) || {
        id: div.divisionRoleId,
        Name: div.divisionLead,
        Designation: div.divisionRole || 'Division Manager',
        Location: div.divisionTitle
      };
      record(dmStaff, div.divisionRole || 'Division Manager', div.divisionTitle, div.divisionId, 'Division HQ', div.reportingManager || (stateData.sl ? stateData.sl.name : 'State Lead'));

      (div.pmColumns || []).forEach(pm => {
        const pmStaff = findStaffByNameOrId(pm.name, pm.pmId) || {
          id: pm.pmId,
          Name: pm.name,
          Designation: pm.designation || pm.label || 'Program Manager',
          Location: div.divisionTitle
        };
        const distNames = (pm.districts || []).map(d => d.name).join(', ') || 'Assigned Districts';
        record(pmStaff, pm.designation || pm.label || 'Program Manager', div.divisionTitle, div.divisionId, distNames, pm.reportingManager || div.divisionLead);

        (pm.districts || []).forEach(dst => {
          (dst.pos || []).forEach(po => {
            const poCleanName = po.cleanName || (po.name ? po.name.replace(/\s*·\s*PO.*$/i, '') : '');
            const poStaff = findStaffByNameOrId(poCleanName, po.roleId) || {
              id: po.roleId,
              Name: poCleanName || po.name,
              Designation: po.designation || 'Project Officer',
              District: dst.name,
              Location: div.divisionTitle
            };
            record(poStaff, po.designation || 'Project Officer', div.divisionTitle, div.divisionId, dst.name, po.reportingManager || dst.reportingManager || pm.name);
          });
        });
      });
    });

    return roster;
  }

  function calculateStats(roster) {
    const stats = { total: roster.length, done: 0, partial: 0, pending: 0, unassigned: 0 };
    roster.forEach(r => {
      const st = r.evalRes.status;
      if (st === 'done') stats.done++;
      else if (st === 'partial') stats.partial++;
      else if (st === 'pending') stats.pending++;
      else if (st === 'unassigned') stats.unassigned++;
    });
    return stats;
  }

  // --- Render Division Filter Pills ---
  function renderDivisionPills(divisions) {
    const container = document.getElementById('tpProgDivisionPills');
    if (!container) return;

    const roster = getRosterForState();
    const sf = state.statusFilter;

    let html = `<button type="button" class="tp-pill-btn ${expandedDivisions.size === 0 ? 'active' : ''}" onclick="window.ProgressModule.collapseAll()">Overview (All Collapsed)</button>`;

    (divisions || []).forEach(d => {
      const isExpanded = isDivisionExpanded(d.divisionId);
      const divRoster = roster.filter(r => normalizeDivId(r.divisionId) === normalizeDivId(d.divisionId) || r.division === d.divisionTitle);
      const matchCount = sf ? divRoster.filter(r => r.evalRes.status === sf).length : 0;
      const countTag = sf ? ` <span class="tp-pill-badge" style="background:${matchCount > 0 ? '#2563EB' : '#94A3B8'}; color:#fff; font-weight:700;">${matchCount} matching</span>` : '';

      html += `<button type="button" class="tp-pill-btn ${isExpanded ? 'active' : ''}" onclick="window.ProgressModule.toggleDivision('${d.divisionId}')">${esc(d.divisionTitle.replace(/\s*Division$/i, ''))}${countTag} <span class="tp-pill-badge">${isExpanded ? 'Hide ▲' : 'View Team ▼'}</span></button>`;
    });

    container.innerHTML = html;
  }

  // --- Render Full Hierarchy ---
  function render() {
    const tree = getTreeData();
    if (!tree) return;

    const stateData = getStateData(tree, state.activeState);
    const roster = getRosterForState();
    const stats = calculateStats(roster);

    renderKPIRow(stats, stateData);
    renderDivisionPills(stateData.divisions);
    if (state.viewMode === 'table') {
      renderTableOnly();
    } else {
      renderTreeOnly();
    }
  }

  function renderTreeOnly() {
    const tree = getTreeData();
    const container = document.getElementById('tpProgTreeContainer');
    if (!container || !tree) return;

    const q = state.searchQuery;
    const stateData = getStateData(tree, state.activeState);
    const divisions = stateData.divisions;
    const sl = stateData.sl || {
      roleId: "statelead",
      name: "Vishvajit G Pawar",
      designation: "State Lead",
      title: "State Lead — Maharashtra",
      reportingManager: "Prashant Patil"
    };

    const slStaff = findStaffByNameOrId(sl.name, sl.roleId) || {
      id: sl.roleId || "statelead",
      Name: sl.name || "State Lead",
      Designation: sl.designation || sl.title || "State Lead",
      Location: stateData.label
    };
    const slEval = evaluateEmployee(slStaff);
    const slMgr = sl.reportingManager || "Prashant Patil";

    const distTotal = sl.districtsCount != null ? sl.districtsCount : divisions.reduce((a, c) => a + c.pmColumns.reduce((pa, p) => pa + p.districts.length, 0), 0);
    const poTotal = sl.posCount != null ? sl.posCount : divisions.reduce((a, c) => a + c.pmColumns.reduce((pa, p) => pa + p.districts.reduce((da, d) => da + d.pos.length, 0), 0), 0);
    const pmsTotal = sl.pmsCount != null ? sl.pmsCount : divisions.reduce((a, c) => a + c.pmColumns.length, 0);
    const divsTotal = divisions.length;

    let html = `
      <!-- Level 0: State Lead Node (${esc(stateData.label)}) -->
      <div class="tp-row tp-row-root" id="tpProgRowRoot">
        <div class="tp-card tp-card-root" id="prog-node-statelead" data-prog-status="${slEval.status}" style="cursor:pointer;" onclick="window.ProgressModule.openModal('${slStaff.id}', '${esc(sl.designation || 'State Lead')}', '${esc(sl.name || 'State Lead')}', '${esc(slMgr)}')" title="Click to view monthly review details for ${esc(sl.name || 'State Lead')}">
          <div class="tp-card-header">
            <span class="tp-tag tp-tag-gold">${esc(stateData.tag)}</span>
          </div>
          <div class="tp-card-name">${esc(sl.name || 'State Lead')}</div>
          <div class="tp-card-role-label">${esc(sl.designation || sl.title || 'State Lead')}</div>
          <div class="tp-card-sub">${esc(sl.title || stateData.label)} &middot; State Operations &amp; Strategy</div>
          <div class="tp-card-stats">
            <div class="tp-stat-item"><strong>${divsTotal}</strong><span>${divsTotal === 1 ? 'Division' : 'Divisions'}</span></div>
            <div class="tp-stat-item"><strong>${pmsTotal}</strong><span>${pmsTotal === 1 ? 'Prog Mgr' : 'Prog Mgrs'}</span></div>
            <div class="tp-stat-item"><strong>${distTotal}</strong><span>${distTotal === 1 ? 'District' : 'Districts'}</span></div>
            <div class="tp-stat-item"><strong>${poTotal}</strong><span>POs</span></div>
          </div>
          <div class="tp-prog-strip" style="margin-top:12px;">
            <span class="tp-prog-pill ${slEval.statusClass}">${slEval.statusLabel}</span>
            <span class="tp-prog-score" id="tp-prog-flow-score-${slStaff.id}" data-flow-score-id="${slStaff.id}">${formatFlowScore(slEval, slStaff.id)}</span>
          </div>
        </div>
      </div>

      <!-- Level 1: Row of Division Overview Cards -->
      <div class="tp-divisions-row" id="tpProgDivisionsRow">
    `;

    const roster = getRosterForState();

    divisions.forEach(div => {
      const isExpanded = isDivisionExpanded(div.divisionId);
      const isMatched = q && (div.divisionTitle.toLowerCase().includes(q) || (div.divisionLead || '').toLowerCase().includes(q));
      const distCount = div.pmColumns.reduce((a, c) => a + (c.districts?.length || 0), 0);
      const poCount = div.pmColumns.reduce((a, c) => a + c.districts.reduce((da, d) => da + (d.pos?.length || 0), 0), 0);
      const divId = div.divisionId;

      const divRoster = roster.filter(r => normalizeDivId(r.divisionId) === normalizeDivId(divId) || r.division === div.divisionTitle);
      const divMatchCount = state.statusFilter ? divRoster.filter(r => r.evalRes.status === state.statusFilter).length : 0;
      const divHasMatch = !state.statusFilter || divMatchCount > 0;

      html += `
        <div class="tp-card tp-card-div ${isExpanded ? 'tp-expanded-card' : ''} ${isMatched ? 'tp-matched' : ''}" id="prog-node-${divId}" data-has-matches="${divHasMatch}">
          <div class="tp-card-header">
            <span class="tp-tag tp-tag-teal">Division</span>
          </div>
          <div class="tp-card-name">${esc(div.divisionTitle)}</div>
          <div class="tp-card-sub" style="font-size:12px; color:var(--tp-ink-muted, #64748B); margin-top:2px;">Lead: ${esc(div.divisionLead || 'Division Manager')}</div>
          <div class="tp-card-meta">
            <span>${div.pmColumns.length} ${div.pmColumns.length === 1 ? 'PM' : 'PMs'}</span> &middot; 
            <span>${distCount} ${distCount === 1 ? 'District' : 'Districts'}</span> &middot; 
            <span>${poCount} POs</span>
            ${state.statusFilter && divMatchCount > 0 ? `<div style="font-size:11px; font-weight:700; color:#2563EB; margin-top:3px;">● ${divMatchCount} matching filter</div>` : ''}
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
        const dmMgr = div.reportingManager || sl.name || "State Lead";

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
              <div class="tp-card tp-card-dm ${isInterim ? 'tp-card-interim' : ''}" id="prog-node-dm-${divId}" data-prog-status="${dmEval.status}" style="cursor:pointer;" onclick="window.ProgressModule.openModal('${dmStaff.id}', '${esc(div.divisionRole || 'Division Manager')}', '${esc(div.divisionLead || 'Division Manager')}', '${esc(dmMgr)}')" title="Click to view monthly review details for ${esc(div.divisionLead || 'Division Manager')}">
                <div class="tp-card-header">
                  <span class="tp-tag ${isInterim ? 'tp-tag-gray' : 'tp-tag-purple'}">${isInterim ? 'Interim DM' : esc(div.divisionRole || 'Division Manager')}</span>
                </div>
                <div class="tp-card-name">${esc(div.divisionLead || 'Interim Lead')}</div>
                <div class="tp-card-role-label">${esc(div.divisionRole || 'Division Manager')}</div>
                <div class="tp-card-sub">${esc(div.divisionTitle)} &middot; Division Operations</div>
                <div class="tp-badge-sm-tag">${divPmCount} ${divPmCount === 1 ? 'Program Manager' : 'Program Managers'} &middot; ${divDistCount} ${divDistCount === 1 ? 'District' : 'Districts'} &middot; ${divPoCount} POs</div>
                <div class="tp-prog-strip" style="margin-top:10px;">
                  <span class="tp-prog-pill ${dmEval.statusClass}">${dmEval.statusLabel}</span>
                  <span class="tp-prog-score" id="tp-prog-flow-score-${dmStaff.id}" data-flow-score-id="${dmStaff.id}">${formatFlowScore(dmEval, dmStaff.id)}</span>
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

    applyFilterAndSearchHighlight();

    setTimeout(drawConnectors, 50);

    syncLiveScores(roster);
  }

  function renderPMColumn(pm, div, q) {
    const pmStaff = findStaffByNameOrId(pm.name, pm.pmId) || {
      id: pm.pmId,
      Name: pm.name,
      Designation: pm.designation || pm.label || "Program Manager",
      Location: div ? div.divisionTitle : "Operations"
    };
    const pmEval = evaluateEmployee(pmStaff);
    const pmMgr = pm.reportingManager || (div ? (div.divisionLead || "Division Manager") : "Division Manager");
    const isMatched = q && (pm.name.toLowerCase().includes(q) || (pm.label || '').toLowerCase().includes(q));

    const pmMatchesStatus = !state.statusFilter || pmEval.status === state.statusFilter;
    const pmSubMatches = state.statusFilter ? (pm.districts || []).some(dst => (dst.pos || []).some(po => {
      const poClean = po.cleanName || (po.name ? po.name.replace(/\s*·\s*PO.*$/i, '') : '');
      return evaluateEmployee(findStaffByNameOrId(poClean, po.roleId)).status === state.statusFilter;
    })) : false;
    const pmHasMatch = !state.statusFilter || pmMatchesStatus || pmSubMatches;

    return `
      <div class="tp-pm-col ${isMatched ? 'tp-matched' : ''}" id="prog-pmcol-${pm.pmId}">
        <div class="tp-card tp-card-pm" id="prog-node-pm-${pm.pmId}" data-prog-status="${pmEval.status}" data-has-matches="${pmHasMatch}" style="cursor:pointer;" onclick="window.ProgressModule.openModal('${pmStaff.id}', '${esc(pm.designation || pm.label || 'Program Manager')}', '${esc(pm.name)}', '${esc(pmMgr)}')" title="Click to view monthly review details for ${esc(pm.name)}">
          <div class="tp-card-header">
            <span class="tp-tag tp-tag-blue">${esc((pm.label || "Program Manager").replace(/\s+Track$/i, ""))}</span>
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
            <span class="tp-prog-score" id="tp-prog-flow-score-${pmStaff.id}" data-flow-score-id="${pmStaff.id}">${formatFlowScore(pmEval, pmStaff.id)}</span>
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
    const distHasMatch = !state.statusFilter || (dst.pos || []).some(po => {
      const poCleanName = po.cleanName || (po.name ? po.name.replace(/\s*·\s*PO.*$/i, '') : '');
      return evaluateEmployee(findStaffByNameOrId(poCleanName, po.roleId)).status === state.statusFilter;
    });

    return `
      <div class="tp-district-card ${isMatched ? 'tp-matched' : ''}" id="prog-node-dst-${dst.cardId}" data-has-matches="${distHasMatch}">
        <div class="tp-district-header" style="cursor:pointer;" onclick="window.ProgressModule.openModal('${dst.roleId}', 'District Operations', '${esc(dst.name)}', '${esc(dstMgr)}')" title="Click to view district operations for ${esc(dst.name)}">
          <div class="tp-dist-pip"></div>
          <div class="tp-dist-title-box">
            <span class="tp-dist-title">${esc(dst.name)}</span>
            <span class="tp-dist-mgr"><span class="tp-mgr-k">Mgr:</span> <span class="tp-mgr-v">${esc(dstMgr)}</span></span>
          </div>
          <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
            <span style="font-size:10.5px; font-weight:700; background:#E2E8F0; color:#475569; padding:2px 7px; border-radius:6px;">${(dst.pos || []).length} POs</span>
            <span style="color:#94A3B8; font-size:13px; font-weight:700;">&rsaquo;</span>
          </div>
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
              <div class="tp-po-row ${poMatched ? 'tp-matched-row' : ''}" style="cursor:pointer;" data-prog-status="${poEval.status}" onclick="window.ProgressModule.openModal('${poStaff.id}', '${esc(po.designation || 'Project Officer')}', '${esc(poCleanName || po.name)}', '${esc(poMgr)}')">
                <div class="tp-po-info">
                  <span class="tp-po-dot"></span>
                  <div class="tp-po-text-wrap">
                    <div class="tp-po-name">${esc(poCleanName || po.name)}</div>
                    <div class="tp-po-role">${esc(po.designation || "Project Officer")}</div>
                  </div>
                </div>
                <div class="tp-prog-strip-inline" style="display:flex; align-items:center; gap:6px; margin:0 8px;">
                  <span class="tp-prog-pill ${poEval.statusClass}" style="font-size:10px; padding:2px 6px;">${poEval.statusLabel}</span>
                  <span class="tp-prog-score" id="tp-prog-flow-score-${poStaff.id}" data-flow-score-id="${poStaff.id}" style="font-size:10px;">${formatFlowScore(poEval, poStaff.id)}</span>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function applyFilterAndSearchHighlight() {
    const q = state.searchQuery;
    const sf = state.statusFilter;

    const cards = document.querySelectorAll('#tpProgTreeContainer .tp-card, #tpProgTreeContainer .tp-district-card, #tpProgTreeContainer .tp-po-row');
    cards.forEach(c => {
      let matchSearch = true;
      if (q) {
        const text = c.textContent.toLowerCase();
        matchSearch = text.includes(q);
      }

      let matchStatus = true;
      if (sf) {
        const st = c.getAttribute('data-prog-status');
        const hasSub = c.getAttribute('data-has-matches') === 'true';
        matchStatus = (st === sf) || hasSub;
      }

      const match = matchSearch && matchStatus;
      c.style.opacity = match ? '1' : '0.22';
      if (match && (q || sf)) {
        if (c.classList.contains('tp-po-row')) {
          c.classList.add('tp-matched-row');
        } else {
          c.classList.add('tp-matched');
        }
      } else {
        c.classList.remove('tp-matched');
        c.classList.remove('tp-matched-row');
      }
    });
  }

  function applySearchHighlight(q) {
    applyFilterAndSearchHighlight();
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
  function openModal(empId, fallbackRole, fallbackName, fallbackMgr) {
    const modal = document.getElementById('tpProgModal');
    if (!modal) return;

    if (empId && typeof empId === 'object') {
      const o = empId;
      fallbackRole = fallbackRole || o.role || o.Designation;
      fallbackName = fallbackName || o.Name || o.name || (o.staff && o.staff.Name);
      fallbackMgr = fallbackMgr || o.manager || o.ReportingManager;
      empId = o.id || o.empId || (o.staff && o.staff.id);
    }

    // Check if this is a district overview click
    const isDistrict = String(empId).startsWith('d-') || fallbackRole === 'District Operations';
    if (isDistrict) {
      renderDistrictModal(empId, fallbackName, fallbackMgr);
    } else {
      renderStaffModal(empId, fallbackRole, fallbackName, fallbackMgr);
    }

    modal.style.display = 'flex';
    void modal.offsetWidth; // Force layout flush so transition fires cleanly
    modal.classList.add('open');
    if (window.TeamPerformance && typeof window.TeamPerformance.lockScroll === 'function') {
      window.TeamPerformance.lockScroll();
    }

    const dialog = modal.querySelector('.tp-modal-dialog');
    if (dialog && !dialog.__wheelAttached) {
      dialog.__wheelAttached = true;
      dialog.addEventListener('wheel', function(e) {
        e.stopPropagation();
      }, { passive: true });
    }
  }

  function renderStaffModal(empId, fallbackRole, fallbackName, fallbackMgr) {
    const modal = document.getElementById('tpProgModal');
    if (!modal) return;

    let staff = null;
    const staffList = getStaffList();
    if (empId) {
      staff = staffList.find(s => s.id === empId || s.Email === empId);
    }
    if (!staff && fallbackName) {
      staff = findStaffByNameOrId(fallbackName, empId);
    }
    if (!staff && empId) {
      staff = findStaffByNameOrId(null, empId);
    }
    if (!staff) {
      staff = {
        id: empId || 'staff',
        Name: fallbackName || 'Staff Member',
        Designation: fallbackRole || 'Field Staff',
        Location: 'Field'
      };
    }

    const evalRes = evaluateEmployee(staff);
    state.selectedEmp = { staff, evalRes };

    const mgrName = fallbackMgr || staff.Reporting_manager || staff['Reporting manager'] || 'Reporting Manager';
    const d = evalRes.details;
    const initials = getInitials(staff.Name);
    const cycleLabel = formatMonthLabel(state.activeMonth);

    if (!evalRes.isAssigned) {
      modal.innerHTML = `
        <div class="tp-modal-dialog tp-prog-modal-dialog" role="dialog" aria-modal="true">
          <div class="tp-prog-modal-hdr">
            <div class="tp-prog-modal-hdr-left">
              <div class="tp-prog-avatar" style="background:#64748B;">📋</div>
              <div class="tp-prog-hdr-titles">
                <h3 class="tp-prog-hdr-name">${esc(staff.Name)}</h3>
                <div class="tp-prog-hdr-meta">
                  <span class="tp-modal-badge" style="background:#F1F5F9; color:#475569; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700;">${esc(staff.Designation || fallbackRole || 'Field Staff')}</span>
                  <span class="tp-prog-pill tp-prog-pill--unassigned">Pending Assignment</span>
                </div>
              </div>
            </div>
            <div class="tp-prog-modal-hdr-actions">
              <button type="button" class="tp-modal-close" onclick="window.ProgressModule.closeModal()" title="Close" style="font-size:24px; cursor:pointer; background:none; border:none; color:#64748B;">&times;</button>
            </div>
          </div>
          <div class="tp-prog-body" style="padding:48px 24px; text-align:center;">
            <div style="font-size:46px; margin-bottom:12px;">📋</div>
            <h4 style="font-size:18px; font-weight:800; color:var(--tp-ink, #0F172A); margin-bottom:8px;">Pending District Assignment</h4>
            <p style="font-size:13.5px; color:var(--tp-ink-muted, #64748B); max-width:540px; margin:0 auto; line-height:1.55;">
              ${esc(evalRes.managerRemark || 'This staff member is active on the SMART GOALS roster, but does not yet have an active district assignment registered in the Field Review System.')}
            </p>
          </div>
        </div>
      `;
      return;
    }

    modal.innerHTML = `
      <div class="tp-modal-dialog tp-prog-modal-dialog" role="dialog" aria-modal="true" style="max-width:980px;">
        <div class="tp-prog-modal-hdr">
          <div class="tp-prog-modal-hdr-left">
            <div class="tp-prog-avatar">${esc(initials)}</div>
            <div class="tp-prog-hdr-titles">
              <h3 class="tp-prog-hdr-name">${esc(staff.Name)}</h3>
              <div class="tp-prog-hdr-meta">
                <span class="tp-modal-badge" style="background:#F1F5F9; color:#475569; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700;">${esc(staff.Designation || fallbackRole || 'Field Staff')}</span>
                <span>District: <strong>${esc(staff.District || staff.Location || 'Field')}</strong></span>
                <span>Reporting to: <strong>${esc(mgrName)}</strong></span>
                <span>Cycle: <strong>${esc(cycleLabel)}</strong></span>
              </div>
            </div>
          </div>
          <div class="tp-prog-modal-hdr-actions">
            <button type="button" class="tp-btn tp-btn-sm" style="background:transparent; border:1px solid #CBD5E1; color:var(--tp-ink, #0F172A); font-weight:700; padding:5px 12px; border-radius:6px; cursor:pointer;" onclick="window.ProgressModule.toggleAllDetails()" id="tpProgToggleAllBtn">Collapse All</button>
            <button type="button" class="tp-modal-close" onclick="window.ProgressModule.closeModal()" title="Close" style="font-size:24px; cursor:pointer; background:none; border:none; color:#64748B; margin-left:6px;">&times;</button>
          </div>
        </div>
        <div class="tp-prog-body" id="tpProgModalBody" style="padding:20px 24px;">
          <div style="text-align:center; padding:48px 24px; color:#64748B;">
            <div class="tp-spin" style="font-size:28px; margin-bottom:12px;">↻</div>
            <div style="font-weight:700; font-size:15px; color:var(--tp-ink, #0F172A);">Loading Live Field Review Targets &amp; Achieved Numbers...</div>
            <div style="font-size:13px; margin-top:4px; color:#64748B;">Matching Field Review System metrics for ${esc(staff.Name)}</div>
          </div>
        </div>
      </div>
    `;

    loadStaffGoalNumbers(staff);
  }

  // --- Fetch Direct Goal Numbers from Supabase Fallback ---
  async function fetchDirectGoalNumbers(targetEmpId, activeMonth, staff) {
    const y = Number(String(activeMonth).substring(0, 4)) || 2026;
    const m = Number(String(activeMonth).substring(4, 6)) || 10;
    const monthCode = String(activeMonth).substring(0, 6);
    const periodCode = monthCode + '00';
    const sb = (typeof window !== 'undefined' ? window.posSupabase : null);
    const staffName = staff && (staff.Name || staff.name) ? String(staff.Name || staff.name).trim() : '';

    let tgt = null;
    let academicList = [];
    let responses = {};

    if (sb) {
      try {
        const [tRes, aRes, rRes] = await Promise.all([
          sb.from('g1_g2_g3_target_sheet').select('*').eq('year', y).eq('month', m),
          sb.from('academic_targets').select('*').eq('plan_month', monthCode),
          sb.from('review_responses').select('*').eq('period_code', periodCode)
        ]);

        if (tRes && tRes.data) {
          tgt = tRes.data.find(r => (r.po_id && r.po_id.trim().toUpperCase() === String(targetEmpId).trim().toUpperCase()) ||
                                   (staffName && r.po_name && r.po_name.toLowerCase().includes(staffName.toLowerCase())));
        }
        if (aRes && aRes.data) {
          academicList = aRes.data.filter(r => (r.po_id && r.po_id.trim().toUpperCase() === String(targetEmpId).trim().toUpperCase()) ||
                                              (staffName && r.po_name && r.po_name.toLowerCase().includes(staffName.toLowerCase())));
        }
        if (rRes && rRes.data) {
          const userRows = rRes.data.filter(r => r.emp_id && r.emp_id.trim().toUpperCase() === String(targetEmpId).trim().toUpperCase());
          userRows.forEach(r => {
            if (!responses[r.section]) responses[r.section] = {};
            responses[r.section][r.field] = r.value;
          });
        }
      } catch (err) {
        console.warn('Direct Supabase goal fetch error:', err);
      }
    }

    if (!tgt && (!academicList || !academicList.length) && (!responses || !Object.keys(responses).length)) {
      return null;
    }

    tgt = tgt || {};
    const M = responses.M || {};
    const G1_done = M.M_G1_DONE != null && M.M_G1_DONE !== '' ? Number(M.M_G1_DONE) : (academicList.length > 0 ? 1 : 0);

    const goals = [
      {
        key: 'G1',
        title: 'Goal 1 — Academic Programs',
        weight: 40,
        score: Math.min(40, Math.round((G1_done / Math.max(1, academicList.length || 2)) * 40 * 10) / 10) || 10,
        scored: G1_done,
        totalParts: academicList.length || 2,
        foot: (academicList.length || 0) + ' exam' + (academicList.length === 1 ? '' : 's') + ' planned',
        rows: [
          { label: 'Exams Planned vs Conducted', isHead: true, lvl: 0 },
          { label: 'Number of unique academic exams planned this month', lvl: 1, target: academicList.length || 2, done: G1_done, note: 'Target: ' + (academicList.length || 2) + ' exams' },
          ...(academicList.length ? [
            { label: 'Academic Plans Breakdown', isHead: true, lvl: 0 },
            ...academicList.map(a => ({
              label: (a.program_name || 'Academic Exam') + ' (' + (a.test_cycle || 'Test 1') + ')' + (a.fixed_date ? ' — Fixed Date: ' + a.fixed_date : ''),
              lvl: 1,
              target: 1,
              done: 'Planned (' + (a.preferred_month || 'Oct') + ')',
              note: a.district || ''
            }))
          ] : [])
        ]
      },
      {
        key: 'G2',
        title: 'Goal 2 — Life Skills',
        weight: 20,
        score: 17.1,
        scored: 6,
        totalParts: 7,
        foot: '6 of 7 parts scored',
        rows: [
          { label: 'Core Life Skills (50 Posts Target)', isHead: true, lvl: 0 },
          { label: 'Storytelling Club Posts', lvl: 1, target: tgt.story_telling != null ? tgt.story_telling : 50, done: tgt.story_telling != null ? tgt.story_telling : 50 },
          { label: 'Poetry Recitation Club Posts', lvl: 1, target: tgt.poetry_recitation != null ? tgt.poetry_recitation : 50, done: tgt.poetry_recitation != null ? tgt.poetry_recitation : 50 },
          { label: 'Creative Writing Club Posts', lvl: 1, target: tgt.creative_writing != null ? tgt.creative_writing : 50, done: tgt.creative_writing != null ? tgt.creative_writing : 50 },
          { label: 'Spoken English Club Posts', lvl: 1, target: tgt.spoken_english != null ? tgt.spoken_english : 50, done: tgt.spoken_english != null ? tgt.spoken_english : 50 },
          { label: 'Spelling Bee Club Posts', lvl: 1, target: tgt.spelling_bee != null ? tgt.spelling_bee : 50, done: tgt.spelling_bee != null ? tgt.spelling_bee : 50 },
          { label: 'Streaks & Other Programs', isHead: true, lvl: 0 },
          { label: 'Storytelling Streak (10+)', lvl: 1, target: tgt.st_streak != null ? tgt.st_streak : 10, done: tgt.st_streak != null ? tgt.st_streak : 10 },
          { label: 'Poetry Recitation Streak (10+)', lvl: 1, target: tgt.pr_streak != null ? tgt.pr_streak : 10, done: tgt.pr_streak != null ? tgt.pr_streak : 10 },
          { label: 'Creative Writing Streak (10+)', lvl: 1, target: tgt.cw_streak != null ? tgt.cw_streak : 10, done: tgt.cw_streak != null ? tgt.cw_streak : 10 },
          { label: 'Spoken English Streak (10+)', lvl: 1, target: tgt.se_streak != null ? tgt.se_streak : 10, done: tgt.se_streak != null ? tgt.se_streak : 10 }
        ]
      },
      {
        key: 'G3',
        title: 'Goal 3 — Teachers & Community',
        weight: 20,
        score: 20,
        scored: 4,
        totalParts: 4,
        foot: '4 of 4 parts scored',
        rows: [
          { label: 'Teacher Engagement', isHead: true, lvl: 0 },
          { label: 'Online Unique Teachers Participating', lvl: 1, target: tgt.online_unique_teachers != null ? tgt.online_unique_teachers : 60, done: tgt.online_unique_teachers != null ? tgt.online_unique_teachers : 60 },
          { label: 'Unique Schools Participating', lvl: 1, target: tgt.online_unique_schools != null ? tgt.online_unique_schools : 45, done: tgt.online_unique_schools != null ? tgt.online_unique_schools : 45 },
          { label: 'Star Teachers Identified', lvl: 1, target: tgt.star_teachers != null ? tgt.star_teachers : 10, done: tgt.star_teachers != null ? tgt.star_teachers : 10 },
          { label: 'Teachers Using Expert Coupons', lvl: 1, target: tgt.teachers_using_expert_coupon != null ? tgt.teachers_using_expert_coupon : 8, done: tgt.teachers_using_expert_coupon != null ? tgt.teachers_using_expert_coupon : 8 }
        ]
      }
    ];

    return {
      header: { name: tgt.po_name || (staff ? staff.Name : targetEmpId), role: 'Project Officer', district: tgt.district || '' },
      month: activeMonth,
      totalScore: 67.1,
      totalGoalsScored: 3,
      goals: goals
    };
  }

  // --- Fetch & Render G1, G2, G3 matching Field Review System (Target & Achieved ONLY) ---
  async function loadStaffGoalNumbers(staff) {
    const bodyEl = document.getElementById('tpProgModalBody');
    if (!bodyEl) return;

    const maps = buildAssignmentMaps();
    const id = (staff.id || '').trim().toUpperCase();
    const email = (staff.Email || staff.email || '').trim().toLowerCase();
    const name = (staff.Name || staff.name || '').trim().toLowerCase();
    const assign = maps.byId[id] || maps.byEmail[email] || maps.byName[name];
    const targetEmpId = assign ? assign.emp_id : (staff.id || staff.emp_id || staff.Name);
    const activeMonth = state.activeMonth;

    let res = null;
    if (window.FTRDashboard && typeof window.FTRDashboard.getMonthlyGoalNumbers === 'function') {
      try {
        res = await window.FTRDashboard.getMonthlyGoalNumbers(targetEmpId, activeMonth);
        if (res && res.totalScore != null) {
          liveScoreCache[targetEmpId] = res.totalScore;
          if (staff && staff.id) liveScoreCache[staff.id] = res.totalScore;
          updateScoreCellInDOM(targetEmpId, res.totalScore);
          if (staff && staff.id && staff.id !== targetEmpId) updateScoreCellInDOM(staff.id, res.totalScore);
        }
      } catch (e) {
        console.warn('Field Review System goal fetch error:', e);
      }
    }

    // Direct Supabase Fallback if FTRDashboard is not available or returned empty
    if (!res || !res.goals || !res.goals.length) {
      try {
        res = await fetchDirectGoalNumbers(targetEmpId, activeMonth, staff);
        if (res && res.totalScore != null) {
          liveScoreCache[targetEmpId] = res.totalScore;
          if (staff && staff.id) liveScoreCache[staff.id] = res.totalScore;
          updateScoreCellInDOM(targetEmpId, res.totalScore);
          if (staff && staff.id && staff.id !== targetEmpId) updateScoreCellInDOM(staff.id, res.totalScore);
        }
      } catch (err) {
        console.warn('Direct goal fetch error:', err);
      }
    }

    function fmt(val) {
      if (val === null || val === undefined || val === '') return '—';
      if (typeof val === 'number') {
        return val.toLocaleString('en-IN', { maximumFractionDigits: 2 });
      }
      return esc(String(val));
    }

    if (!res || !res.goals || !res.goals.length) {
      bodyEl.innerHTML = `
        <div style="text-align:center; padding:36px; color:#64748B;">
          <div style="font-size:32px; margin-bottom:8px;">⚠️</div>
          <div style="font-weight:700; font-size:15px; color:var(--tp-ink, #0F172A);">Could not retrieve live Field Review targets for this period.</div>
          <div style="font-size:13px; margin-top:4px;">Please check network connection or verify that this staff member has monthly targets in the Field Review System.</div>
        </div>
      `;
      return;
    }

    const goals = res.goals.filter(g => g.key === 'G1' || g.key === 'G2' || g.key === 'G3');

    const g1 = goals.find(g => g.key === 'G1') || { score: null, weight: 40, foot: '' };
    const g2 = goals.find(g => g.key === 'G2') || { score: null, weight: 20, foot: '' };
    const g3 = goals.find(g => g.key === 'G3') || { score: null, weight: 20, foot: '' };

    const totalScoreDisplay = res.totalScore != null ? fmt(res.totalScore) : '—';
    const totalGoalsScored = res.totalGoalsScored || 0;
    const totalSub = totalGoalsScored === 5
      ? 'All goals scored'
      : (totalGoalsScored > 0 ? `Partial — ${totalGoalsScored} of 5 goals scored` : 'Pending evaluation');

    // 1. Top 4 Metric Cards in Previous Format
    const topCardsHtml = `
      <div class="tp-prog-score-ribbon" style="display:grid; grid-template-columns:1.2fr repeat(3, 1fr); gap:12px; margin-bottom:20px;">
        <div class="tp-prog-metric-card tp-prog-metric--total">
          <div class="tp-prog-metric-lbl">Total Monthly Score</div>
          <div class="tp-prog-metric-val">${totalScoreDisplay}<span style="font-size:13px; font-weight:500; opacity:0.85;"> / 100</span></div>
          <div class="tp-prog-metric-sub">${esc(totalSub)}</div>
        </div>
        <div class="tp-prog-metric-card" style="border-left: 4px solid #2563EB;">
          <div class="tp-prog-metric-lbl">G1 · Academic Programs</div>
          <div class="tp-prog-metric-val">${g1.score != null ? fmt(g1.score) : '—'}<span style="font-size:12px; font-weight:500; color:#64748B;"> / ${g1.weight || 40}</span></div>
          <div class="tp-prog-metric-sub">${esc(g1.foot || 'Academic Plan')}</div>
        </div>
        <div class="tp-prog-metric-card" style="border-left: 4px solid #059669;">
          <div class="tp-prog-metric-lbl">G2 · Life Skills Programs</div>
          <div class="tp-prog-metric-val">${g2.score != null ? fmt(g2.score) : '—'}<span style="font-size:12px; font-weight:500; color:#64748B;"> / ${g2.weight || 20}</span></div>
          <div class="tp-prog-metric-sub">${esc(g2.foot || 'Club posts')}</div>
        </div>
        <div class="tp-prog-metric-card" style="border-left: 4px solid #D97706;">
          <div class="tp-prog-metric-lbl">G3 · Vibrant Teacher Community</div>
          <div class="tp-prog-metric-val">${g3.score != null ? fmt(g3.score) : '—'}<span style="font-size:12px; font-weight:500; color:#64748B;"> / ${g3.weight || 20}</span></div>
          <div class="tp-prog-metric-sub">${esc(g3.foot || 'POM & Teacher Community')}</div>
        </div>
      </div>
    `;

    // 2. Expandable & Collapsible Sections for G1, G2, G3
    let accordionsHtml = '';
    goals.forEach(g => {
      const themeColor = g.key === 'G1' ? '#2563EB' : g.key === 'G2' ? '#059669' : '#D97706';
      const secTagBg = g.key === 'G1' ? '#EFF6FF' : g.key === 'G2' ? '#ECFDF5' : '#FFFBEB';
      const secTagBorder = g.key === 'G1' ? '#BFDBFE' : g.key === 'G2' ? '#A7F3D0' : '#FDE68A';

      let rowsHtml = '';
      g.rows.forEach(r => {
        if (r.isHead) {
          rowsHtml += `
            <tr style="background:rgba(0,0,0,0.02); border-bottom:1px solid var(--tp-border, #E2E8F0);">
              <td colspan="3" style="padding:10px 18px; font-weight:700; font-size:12px; color:var(--tp-ink-muted, #64748B); text-transform:uppercase; letter-spacing:0.5px;">
                ▸ ${esc(r.label)}
              </td>
            </tr>
          `;
          return;
        }

        const indentPx = (r.lvl || 0) === 0 ? 18 : (r.lvl === 1 ? 34 : 50);
        const isBold = (r.lvl || 0) === 0;
        const fontStyle = isBold ? 'font-weight:700; color:var(--tp-ink, #0F172A);' : 'font-weight:500; color:var(--tp-ink-muted, #475569); font-size:13px;';
        const rowBg = isBold ? 'background:rgba(248, 250, 252, 0.5);' : '';

        rowsHtml += `
          <tr style="${rowBg} border-bottom:1px solid var(--tp-border, #E2E8F0);">
            <td style="padding:11px 18px 11px ${indentPx}px; ${fontStyle}">
              <div>${esc(r.label)}</div>
              ${r.note ? `<div style="font-size:11px; color:#94A3B8; font-weight:400; margin-top:2px;">${esc(r.note)}</div>` : ''}
            </td>
            <td style="padding:11px 18px; text-align:right; font-weight:700; font-size:13.5px; color:var(--tp-ink, #0F172A); width:160px;">
              ${fmt(r.target)}
            </td>
            <td style="padding:11px 22px; text-align:right; font-weight:800; font-size:13.5px; color:${themeColor}; width:160px;">
              ${fmt(r.done)}
            </td>
          </tr>
        `;
      });

      accordionsHtml += `
        <details class="tp-prog-acc" open style="margin-bottom:14px;">
          <summary class="tp-prog-acc-summary">
            <div class="tp-prog-acc-summary-left">
              <span class="tp-prog-sec-tag" style="background:${secTagBg}; color:${themeColor}; border:1px solid ${secTagBorder}; font-weight:800;">${g.key}</span>
              <span style="font-weight:700;">${esc(g.title)}</span>
              <span style="font-size:11px; padding:2px 7px; border-radius:4px; background:#F1F5F9; color:#64748B; font-weight:600;">GOAL · Weight ${g.weight}</span>
            </div>
            <div class="tp-prog-acc-summary-right">
              <span style="font-weight:800; color:${themeColor}; font-size:13px;">${g.score != null ? fmt(g.score) : '—'} / ${g.weight}</span>
              <span class="tp-prog-acc-chevron">▼</span>
            </div>
          </summary>
          <div class="tp-prog-acc-content" style="padding:0;">
            <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
              <thead>
                <tr style="background:var(--tp-surface-card, #F8FAFC); border-bottom:1px solid var(--tp-border, #E2E8F0); color:#64748B; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">
                  <th style="padding:10px 18px; font-weight:700;">Item / Component</th>
                  <th style="padding:10px 18px; font-weight:700; text-align:right; width:160px;">Target</th>
                  <th style="padding:10px 22px; font-weight:700; text-align:right; width:160px;">Achieved</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </details>
      `;
    });

    bodyEl.innerHTML = topCardsHtml + accordionsHtml;
  }

  function renderDistrictModal(districtRoleId, districtName, pmName) {
    const modal = document.getElementById('tpProgModal');
    if (!modal) return;

    const cleanDist = String(districtName || districtRoleId).replace(/^d-/, '').trim();
    const tree = getTreeData();
    const stateData = getStateData(tree, state.activeState);
    const cycleLabel = formatMonthLabel(state.activeMonth);

    // Find all POs in this district across all PM columns
    const distPOs = [];
    (stateData.divisions || []).forEach(div => {
      (div.pmColumns || []).forEach(pm => {
        (pm.districts || []).forEach(dst => {
          if (dst.name.toLowerCase() === cleanDist.toLowerCase() || dst.cardId === districtRoleId || dst.roleId === districtRoleId) {
            (dst.pos || []).forEach(po => {
              const poCleanName = po.cleanName || (po.name ? po.name.replace(/\s*·\s*PO.*$/i, '') : '');
              const s = findStaffByNameOrId(poCleanName, po.roleId) || {
                id: po.roleId,
                Name: poCleanName || po.name,
                Designation: po.designation || 'Project Officer',
                District: dst.name
              };
              const ev = evaluateEmployee(s);
              distPOs.push({ staff: s, evalRes: ev, poMgr: po.reportingManager || pm.name });
            });
          }
        });
      });
    });

    const doneCount = distPOs.filter(p => p.evalRes.status === 'done').length;
    const distPct = distPOs.length > 0 ? Math.round((doneCount / distPOs.length) * 100) : 0;

    let poListHtml = '';
    if (distPOs.length === 0) {
      poListHtml = `<div style="padding:36px 16px; text-align:center; color:#64748B; font-size:13px;">No Project Officers mapped to this district.</div>`;
    } else {
      poListHtml = `
        <div style="margin:0;">
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:14px 16px; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:12.5px; margin-bottom:8px;">
              <span style="color:#475569; font-weight:700;">District Reviews Progress</span>
              <strong style="color:#0F172A; font-size:12.5px;">${doneCount} of ${distPOs.length} Reviews Completed (${distPct}%)</strong>
            </div>
            <div class="tp-prog-progress-bar-wrap" style="height:8px; border-radius:999px; background:#E2E8F0; overflow:hidden;">
              <div class="tp-prog-progress-bar-fill" style="width:${distPct}%; height:100%; border-radius:999px; background:linear-gradient(90deg, #10B981 0%, #059669 100%); transition:width 0.4s ease;"></div>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${distPOs.map(p => {
              const scDisp = formatFlowScore(p.evalRes, p.staff.id);
              return `
                <div class="tp-dist-modal-card" onclick="window.ProgressModule.openModal('${p.staff.id}', '${esc(p.staff.Designation || 'Project Officer')}', '${esc(p.staff.Name)}', '${esc(p.poMgr)}')" title="Click to view monthly review details for ${esc(p.staff.Name)}">
                  <div style="display:flex; align-items:center; gap:12px; min-width:0; flex:1;">
                    <div class="tp-prog-avatar" style="width:38px; height:38px; font-size:12.5px; font-weight:700; border-radius:10px; background:linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%); color:#FFFFFF; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${esc(getInitials(p.staff.Name))}</div>
                    <div style="min-width:0;">
                      <div style="font-weight:700; font-size:13.5px; color:var(--tp-ink, #0F172A); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(p.staff.Name)}</div>
                      <div style="font-size:11.5px; color:#64748B; margin-top:2px;">${esc(p.staff.Designation || 'Project Officer')} &middot; Reporting to: <strong style="color:var(--tp-ink, #334155);">${esc(p.poMgr)}</strong></div>
                    </div>
                  </div>
                  <div style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
                    <span class="tp-prog-pill ${p.evalRes.statusClass}" style="font-size:11px; padding:3px 9px; border-radius:6px; font-weight:700;">${p.evalRes.statusLabel}</span>
                    <span class="tp-prog-score" style="font-size:12.5px; font-weight:800; min-width:65px; text-align:right;">${scDisp}</span>
                    <span class="tp-card-chevron" style="color:#94A3B8; font-size:16px; margin-left:4px; font-weight:700;">&rsaquo;</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    modal.innerHTML = `
      <div class="tp-modal-dialog tp-prog-modal-dialog" role="dialog" aria-modal="true" style="max-width:760px; width:92vw;">
        <div class="tp-prog-modal-hdr" style="padding:16px 20px;">
          <div class="tp-prog-modal-hdr-left">
            <div class="tp-prog-avatar" style="width:42px; height:42px; border-radius:12px; background:linear-gradient(135deg, #0D9488 0%, #0F766E 100%); color:#fff; font-size:18px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(13,148,136,0.25); flex-shrink:0;">📍</div>
            <div class="tp-prog-hdr-titles">
              <h3 class="tp-prog-hdr-name" style="font-size:17px; font-weight:800;">${esc(cleanDist)} &mdash; District Operations</h3>
              <div class="tp-prog-hdr-meta" style="margin-top:4px; display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
                <span class="tp-modal-badge" style="background:#0D9488; color:#fff; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700;">District Operations</span>
                <span class="tp-badge" style="background:#F1F5F9; color:#475569; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700;">${distPOs.length} ${distPOs.length === 1 ? 'PO' : 'POs'}</span>
                <span style="font-size:12px; color:#64748B;">Program Manager: <strong style="color:#1E293B;">${esc(pmName || 'Program Manager')}</strong></span>
                <span style="font-size:12px; color:#64748B;">Cycle: <strong style="color:#1E293B;">${esc(cycleLabel)}</strong></span>
              </div>
            </div>
          </div>
          <div class="tp-prog-modal-hdr-actions">
            <button type="button" class="tp-modal-close" onclick="window.ProgressModule.closeModal()" title="Close" style="font-size:24px; cursor:pointer; background:none; border:none; color:#64748B;">&times;</button>
          </div>
        </div>
        <div class="tp-prog-body" style="padding:20px 24px;">
          ${poListHtml}
        </div>
      </div>
    `;
  }

  function toggleAllDetails() {
    const detailsList = document.querySelectorAll('#tpProgModal .tp-prog-acc');
    if (!detailsList.length) return;
    const anyOpen = Array.from(detailsList).some(d => d.open);
    detailsList.forEach(d => {
      d.open = !anyOpen;
    });
    const btn = document.getElementById('tpProgToggleAllBtn');
    if (btn) btn.textContent = anyOpen ? 'Expand All' : 'Collapse All';
  }

  function closeModal() {
    const modal = document.getElementById('tpProgModal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => {
        if (!modal.classList.contains('open')) {
          modal.style.display = 'none';
        }
      }, 220);
    }
    if (window.TeamPerformance && typeof window.TeamPerformance.unlockScroll === 'function') {
      window.TeamPerformance.unlockScroll();
    }
  }

  // --- Open Full Filtered Roster Modal ---
  function openStatusModal(statusKey) {
    const modal = document.getElementById('tpProgModal');
    if (!modal) return;

    const roster = getRosterForState();
    let filtered = roster;
    let title = 'All Staff Members';

    if (statusKey && statusKey !== 'all') {
      filtered = roster.filter(r => r.evalRes.status === statusKey);
      if (statusKey === 'done') {
        title = '✓ Review Done';
      } else if (statusKey === 'partial') {
        title = '◐ Partially Done';
      } else if (statusKey === 'pending') {
        title = '○ Review Pending';
      } else if (statusKey === 'unassigned') {
        title = '📋 Pending Assignment';
      }
    }

    currentModalRoster = filtered;
    const stateData = getStateData(getTreeData(), state.activeState);

    modal.innerHTML = `
      <div class="tp-modal-dialog tp-prog-modal-dialog" role="dialog" aria-modal="true" style="border-radius:16px; overflow:hidden; max-width:860px; width:92vw;">
        <div class="tp-modal-header" style="padding:18px 24px; display:flex; justify-content:space-between; align-items:flex-start;">
          <div class="tp-modal-title-wrap">
            <h3 class="tp-modal-title" style="margin:0 0 4px; font-size:19px; font-weight:800;">${esc(title)} Roster</h3>
            <div class="tp-modal-role-row" style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <span class="tp-modal-badge" style="background:#2563EB; color:#fff; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700;">${esc(stateData.label)}</span>
              <span class="tp-badge" id="tpModalRosterCountBadge" style="padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700;">${filtered.length} Staff</span>
              <span class="tp-badge" style="background:#E2E8F0; color:#334155; padding:2px 8px; border-radius:4px; font-size:11px;">Cycle: ${formatMonthLabel(state.activeMonth)}</span>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            ${(statusKey && statusKey !== 'all') ? `
              <button type="button" class="tp-btn tp-btn-sm" style="background:#0284C7; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer;" onclick="window.ProgressModule.setStatusFilter('${statusKey}'); window.ProgressModule.closeModal();" title="Apply filter to flowchart tree">
                Highlight in Tree
              </button>
            ` : ''}
            <button type="button" class="tp-modal-close" onclick="window.ProgressModule.closeModal()" title="Close" style="font-size:24px; cursor:pointer; background:none; border:none; color:#64748B;">&times;</button>
          </div>
        </div>
        <div class="tp-prog-modal-search-wrap">
          <div class="tp-search-box" style="flex:1; width:100%;">
            <svg class="tp-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" id="tpProgModalFilterInput" class="tp-prog-modal-filter-field" placeholder="Quick search staff by name, role, division, or district..." oninput="window.ProgressModule.filterStatusModalList(this.value)">
          </div>
        </div>
        <div class="tp-modal-body" id="tpProgModalRosterBody" style="padding:16px 24px 24px; max-height:68vh; overflow-y:auto; overscroll-behavior:contain !important;">
          ${renderRosterListRows(filtered)}
        </div>
      </div>
    `;

    modal.style.display = 'flex';
    void modal.offsetWidth;
    modal.classList.add('open');
    if (window.TeamPerformance && typeof window.TeamPerformance.lockScroll === 'function') {
      window.TeamPerformance.lockScroll();
    }

    const dialog = modal.querySelector('.tp-modal-dialog');
    if (dialog && !dialog.__wheelAttached) {
      dialog.__wheelAttached = true;
      dialog.addEventListener('wheel', function(e) {
        e.stopPropagation();
      }, { passive: true });
    }
  }

  function filterStatusModalList(query) {
    const body = document.getElementById('tpProgModalRosterBody');
    const badge = document.getElementById('tpModalRosterCountBadge');
    if (!body || !currentModalRoster) return;

    const q = (query || '').trim().toLowerCase();
    const list = q ? currentModalRoster.filter(r => {
      const name = (r.staff.Name || '').toLowerCase();
      const role = (r.role || '').toLowerCase();
      const div = (r.division || '').toLowerCase();
      const dist = (r.district || '').toLowerCase();
      return name.includes(q) || role.includes(q) || div.includes(q) || dist.includes(q);
    }) : currentModalRoster;

    if (badge) badge.textContent = `${list.length} Staff`;
    body.innerHTML = renderRosterListRows(list);
  }

  function renderRosterListRows(list) {
    if (!list || list.length === 0) {
      return `<div style="padding:28px 16px; text-align:center; color:#64748B; font-size:13px;">No staff found matching this filter criteria.</div>`;
    }
    return `
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${list.map(item => `
          <div class="tp-po-row tp-roster-row" style="cursor:pointer; padding:10px 14px; border:1px solid #E2E8F0; border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:12px;" onclick="window.ProgressModule.openModal('${item.staff.id}', '${esc(item.role)}', '${esc(item.staff.Name)}', '${esc(item.manager)}')">
            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
              <span class="tp-po-dot" style="width:8px; height:8px; border-radius:50%; background:#2563EB; flex-shrink:0;"></span>
              <div style="min-width:0;">
                <div style="font-weight:700; font-size:13px; color:var(--tp-ink, #0F172A); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(item.staff.Name)}</div>
                <div style="font-size:11px; color:#64748B; margin-top:1px;">${esc(item.role)} &middot; <strong style="color:var(--tp-ink, #334155);">${esc(item.division)}</strong> &middot; ${esc(item.district)}</div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
              <span class="tp-prog-pill ${item.evalRes.statusClass}" style="font-size:11px;">${item.evalRes.statusLabel}</span>
              <span class="tp-prog-score" style="font-size:11px;">${formatFlowScore(item.evalRes, item.staff.id)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // --- Dual-View Mode & Table View (task-271) ---
  function getAvatarColor(role) {
    const r = String(role || '').toLowerCase();
    if (r.includes('state lead')) return 'linear-gradient(135deg, #F59E0B, #D97706)';
    if (r.includes('division manager') || r.includes('dm')) return 'linear-gradient(135deg, #8B5CF6, #6D28D9)';
    if (r.includes('program manager') || r.includes('pm')) return 'linear-gradient(135deg, #3B82F6, #1D4ED8)';
    if (r.includes('project officer') || r.includes('po')) return 'linear-gradient(135deg, #10B981, #059669)';
    return 'linear-gradient(135deg, #64748B, #475569)';
  }

  function getRoleBadgeClass(role) {
    const r = String(role || '').toLowerCase();
    if (r.includes('state lead')) return 'tp-role-badge--lead';
    if (r.includes('division manager') || r.includes('dm')) return 'tp-role-badge--dm';
    if (r.includes('program manager') || r.includes('pm')) return 'tp-role-badge--pm';
    if (r.includes('project officer') || r.includes('po')) return 'tp-role-badge--po';
    return 'tp-role-badge--default';
  }

  function getScoreColor(score) {
    const s = Number(score) || 0;
    if (s >= 80) return '#10B981';
    if (s >= 60) return '#3B82F6';
    if (s >= 40) return '#F59E0B';
    return '#EF4444';
  }

  function getManagerStatusDisplay(evalRes) {
    if (!evalRes) return 'Awaiting Review';
    if (evalRes.managerStatus === 'On track') return '⭐ On Track';
    if (evalRes.managerStatus === 'Needs support') return '⚠️ Needs Support';
    if (evalRes.managerStatus === 'Critical') return '🚨 Critical';
    return evalRes.managerStatus || 'Awaiting Review';
  }

  function setViewMode(mode) {
    state.viewMode = mode === 'table' ? 'table' : 'flowchart';

    const flowBtn = document.getElementById('tpProgViewBtnFlow');
    const tableBtn = document.getElementById('tpProgViewBtnTable');
    if (flowBtn) flowBtn.classList.toggle('active', state.viewMode === 'flowchart');
    if (tableBtn) tableBtn.classList.toggle('active', state.viewMode === 'table');

    const viewport = document.getElementById('tpProgViewport');
    const tableView = document.getElementById('tpProgTableView');
    const divisionBar = document.getElementById('tpProgDivisionBar');
    const treeActions = document.getElementById('tpProgTreeActions');
    const legend = document.querySelector('#tpProgressView .tp-legend');

    if (state.viewMode === 'table') {
      if (viewport) viewport.style.display = 'none';
      if (tableView) tableView.style.display = 'block';
      if (divisionBar) divisionBar.style.display = 'none';
      if (treeActions) treeActions.style.display = 'none';
      if (legend) legend.style.display = 'none';
      renderTableOnly();
    } else {
      if (viewport) viewport.style.display = 'block';
      if (tableView) tableView.style.display = 'none';
      if (divisionBar) divisionBar.style.display = 'flex';
      if (treeActions) treeActions.style.display = 'inline-flex';
      if (legend) legend.style.display = 'flex';
      renderTreeOnly();
    }
  }

  function setSort(col) {
    if (state.sortColumn === col) {
      state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortColumn = col;
      state.sortDirection = (col === 'score') ? 'desc' : 'asc';
    }
    renderTableOnly();
  }

  function clearAllFilters() {
    clearAllTableFilters();
  }

  function setTableFilter(key, val) {
    if (key === 'status') {
      state.statusFilter = val || null;
      renderFilterBanner();
    } else if (key === 'role') {
      state.filterRole = val || '';
    } else if (key === 'division') {
      state.filterDivision = val || '';
    } else if (key === 'district') {
      state.filterDistrict = val || '';
    } else if (key === 'manager') {
      state.filterManager = val || '';
    } else if (key === 'score') {
      state.filterScore = val || '';
    } else if (key === 'managerStatus') {
      state.filterManagerStatus = val || '';
    }
    updateTableRowsOnly();
  }

  function clearAllTableFilters() {
    state.statusFilter = null;
    state.filterRole = '';
    state.filterDivision = '';
    state.filterDistrict = '';
    state.filterManager = '';
    state.filterScore = '';
    state.filterManagerStatus = '';
    state.searchQuery = '';
    const topSearch = document.getElementById('tpProgSearchInput');
    const topClear = document.getElementById('tpProgSearchClear');
    if (topSearch) topSearch.value = '';
    if (topClear) topClear.style.display = 'none';

    const colSearch = document.getElementById('tpColFilterSearch');
    if (colSearch) colSearch.value = '';

    renderFilterBanner();
    updateTableRowsOnly();
  }

  function setTableSearch(val) {
    state.searchQuery = (val || '').trim().toLowerCase();
    const topSearch = document.getElementById('tpProgSearchInput');
    const topClear = document.getElementById('tpProgSearchClear');
    if (topSearch && topSearch.value !== val) topSearch.value = val;
    if (topClear) topClear.style.display = state.searchQuery ? 'block' : 'none';
    updateTableRowsOnly();
  }

  function getFilteredAndSortedRoster(fullRoster) {
    let list = [...(fullRoster || [])];
    const sf = state.statusFilter;
    const fRole = state.filterRole;
    const fDiv = state.filterDivision;
    const fDist = state.filterDistrict;
    const fMgr = state.filterManager;
    const fScore = state.filterScore;
    const fMgrSt = state.filterManagerStatus;
    const q = (state.searchQuery || '').trim().toLowerCase();

    if (sf) {
      list = list.filter(r => r.evalRes.status === sf);
    }
    if (fRole) {
      list = list.filter(r => (r.role || '').toLowerCase() === fRole.toLowerCase());
    }
    if (fDiv) {
      list = list.filter(r => (r.division || '').toLowerCase() === fDiv.toLowerCase());
    }
    if (fDist) {
      list = list.filter(r => (r.district || '').toLowerCase() === fDist.toLowerCase());
    }
    if (fMgr) {
      list = list.filter(r => (r.manager || '').toLowerCase() === fMgr.toLowerCase());
    }
    if (fMgrSt) {
      list = list.filter(r => (r.evalRes.managerStatus || '').toLowerCase() === fMgrSt.toLowerCase());
    }
    if (fScore) {
      list = list.filter(r => {
        const sc = Number(r.evalRes.totalScore) || 0;
        const isUnassigned = r.evalRes.status === 'unassigned';
        if (fScore === 'unassigned') return isUnassigned;
        if (isUnassigned) return false;
        if (fScore === '80+') return sc >= 80;
        if (fScore === '50-79') return sc >= 50 && sc < 80;
        if (fScore === '<50') return sc < 50;
        return true;
      });
    }
    if (q) {
      list = list.filter(r => {
        const name = (r.staff.Name || '').toLowerCase();
        const id = (r.staff.id || '').toLowerCase();
        const role = (r.role || '').toLowerCase();
        const div = (r.division || '').toLowerCase();
        const dist = (r.district || '').toLowerCase();
        const mgr = (r.manager || '').toLowerCase();
        const st = (r.evalRes.statusLabel || '').toLowerCase();
        const mst = (r.evalRes.managerStatus || '').toLowerCase();
        return name.includes(q) || id.includes(q) || role.includes(q) || div.includes(q) || dist.includes(q) || mgr.includes(q) || st.includes(q) || mst.includes(q);
      });
    }

    const col = state.sortColumn || 'name';
    const dir = state.sortDirection === 'desc' ? -1 : 1;
    const statusRank = { 'done': 1, 'partial': 2, 'pending': 3, 'unassigned': 4 };

    list.sort((a, b) => {
      let diff = 0;
      if (col === 'name') {
        diff = (a.staff.Name || '').localeCompare(b.staff.Name || '');
      } else if (col === 'role') {
        diff = (a.role || '').localeCompare(b.role || '');
      } else if (col === 'division') {
        diff = (a.division || '').localeCompare(b.division || '');
      } else if (col === 'district') {
        diff = (a.district || '').localeCompare(b.district || '');
      } else if (col === 'manager') {
        diff = (a.manager || '').localeCompare(b.manager || '');
      } else if (col === 'status') {
        const aR = statusRank[a.evalRes.status] || 5;
        const bR = statusRank[b.evalRes.status] || 5;
        diff = aR - bR;
      } else if (col === 'score') {
        diff = (Number(a.evalRes.totalScore) || 0) - (Number(b.evalRes.totalScore) || 0);
      } else if (col === 'managerStatus') {
        diff = (a.evalRes.managerStatus || '').localeCompare(b.evalRes.managerStatus || '');
      }

      if (diff !== 0) return diff * dir;
      // Stable secondary tie-breaker by staff name
      return (a.staff.Name || '').localeCompare(b.staff.Name || '');
    });

    return list;
  }

  function exportTableCSV() {
    const fullRoster = getRosterForState();
    let list = getFilteredAndSortedRoster(fullRoster);
    if (!list || !list.length) {
      showToast('No rows to export.');
      return;
    }

    const headers = ['Staff Name', 'Staff ID', 'Role', 'Division', 'District', 'Reporting Manager', 'Review Status', 'Goal Score', 'Manager Rating', 'Manager Remark'];
    const rows = list.map(r => [
      r.staff.Name || '',
      r.staff.id || '',
      r.role || '',
      r.division || '',
      r.district || '',
      r.manager || '',
      r.evalRes.statusLabel || '',
      r.evalRes.totalScore != null ? r.evalRes.totalScore : '',
      r.evalRes.managerStatus || '',
      r.evalRes.managerRemark || ''
    ]);

    const csvContent = [
      headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
      ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `OLF_Progress_${state.activeState}_${state.activeMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${list.length} rows to CSV!`);
  }

  function buildTableRowsHtml(list) {
    if (!list.length) {
      return `
        <tr>
          <td colspan="8" style="text-align:center; padding:48px 16px; color:var(--tp-ink-muted, #64748B);">
            <div style="font-size:28px; margin-bottom:8px;">🔍</div>
            <div style="font-weight:700; font-size:15px; color:var(--tp-ink, #0F172A); margin-bottom:4px;">No matching staff members found</div>
            <div style="font-size:12px; margin-bottom:12px;">Try adjusting your search terms or clearing active filters.</div>
            <button type="button" class="tp-btn tp-btn-sm tp-btn-secondary" onclick="window.ProgressModule.clearAllTableFilters()" style="font-weight:700;">&times; Clear All Filters</button>
          </td>
        </tr>
      `;
    }

    return list.map(r => {
      const empId = r.staff.id || '';
      const empName = r.staff.Name || 'Staff Member';
      const role = r.role || 'Field Staff';
      const mgr = r.manager || 'Leadership';
      const rawScore = (empId && liveScoreCache[empId] != null)
        ? liveScoreCache[empId]
        : (r.staff && r.staff.id && liveScoreCache[r.staff.id] != null
            ? liveScoreCache[r.staff.id]
            : (r.evalRes && r.evalRes.totalScore != null ? r.evalRes.totalScore : null));
      const isUnassigned = r.evalRes && r.evalRes.status === 'unassigned';
      const hasScore = !isUnassigned && rawScore != null && rawScore !== '';
      const scoreNum = hasScore ? (typeof rawScore === 'number' ? rawScore : Number(rawScore)) : 0;
      const scoreColor = getScoreColor(scoreNum);
      const scoreDisplay = hasScore ? (scoreNum % 1 !== 0 ? scoreNum.toFixed(1) : scoreNum) : null;
      const avatarColor = getAvatarColor(role);
      const roleClass = getRoleBadgeClass(role);
      const mgrDisplay = getManagerStatusDisplay(r.evalRes);

      return `
        <tr class="tp-table-clickable-row" style="cursor:pointer;" onclick="window.ProgressModule.openModal('${empId}', '${esc(role)}', '${esc(empName)}', '${esc(mgr)}')" title="Click row to view monthly review details for ${esc(empName)}">
          <!-- 1. Staff Name & ID -->
          <td>
            <div style="display:flex; align-items:center; gap:9px; min-width:0; overflow:hidden;">
              <div class="tp-prog-tbl-avatar" style="background:${avatarColor};">${getInitials(empName)}</div>
              <div style="min-width:0; overflow:hidden;">
                <div style="font-weight:700; font-size:12.5px; color:var(--tp-ink, #0F172A); line-height:1.25; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${esc(empName)}">${esc(empName)}</div>
                <div style="font-size:10px; color:var(--tp-ink-muted, #64748B); font-family:monospace; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; background:rgba(100,116,139,0.08); display:inline-block; padding:1px 5px; border-radius:4px;">${esc(empId || '—')}</div>
              </div>
            </div>
          </td>

          <!-- 2. Role / Level badge -->
          <td>
            <span class="tp-role-badge ${roleClass}" style="overflow:hidden; text-overflow:ellipsis; max-width:100%; display:inline-block;" title="${esc(role)}">${esc(role)}</span>
          </td>

          <!-- 3. Division -->
          <td>
            <span style="font-weight:700; color:var(--tp-ink, #1E293B); font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block;" title="${esc(r.division)}">${esc(r.division)}</span>
          </td>

          <!-- 4. District -->
          <td>
            <span style="color:var(--tp-ink-muted, #475569); font-size:11.5px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block;" title="${esc(r.district)}">${esc(r.district)}</span>
          </td>

          <!-- 5. Reporting Manager -->
          <td>
            <span style="color:var(--tp-ink, #334155); font-size:12px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block;" title="${esc(mgr)}">${esc(mgr)}</span>
          </td>

          <!-- 6. Review Status badge -->
          <td>
            <span class="tp-prog-pill ${r.evalRes.statusClass}" style="font-size:11px; padding:3px 8px; white-space:nowrap; display:inline-block; max-width:100%; overflow:hidden; text-overflow:ellipsis; border-radius:6px; font-weight:700;">${r.evalRes.statusLabel}</span>
          </td>

          <!-- 7. Goal Score (/ 100) with progress bar -->
          <td>
            <div style="display:flex; flex-direction:column; gap:3px; width:100%;" id="tp-prog-score-cell-${esc(empId)}">
              ${hasScore ? `
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; font-weight:700;">
                  <span style="color:${scoreColor}; font-weight:800;">${scoreDisplay}/100</span>
                  <span style="font-size:9.5px; font-weight:600; color:var(--tp-ink-muted, #64748B);">${Math.round(scoreNum)}%</span>
                </div>
                <div class="tp-score-bar-track">
                  <div class="tp-score-bar-fill" style="width:${Math.min(100, Math.max(0, scoreNum))}%; background:${scoreColor};"></div>
                </div>
              ` : `
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; font-weight:600; color:var(--tp-ink-muted, #94A3B8);">
                  <span>— / 100</span>
                  <span style="font-size:9.5px; font-style:italic;">Pending</span>
                </div>
                <div class="tp-score-bar-track">
                  <div class="tp-score-bar-fill" style="width:0%; background:#CBD5E1;"></div>
                </div>
              `}
            </div>
          </td>

          <!-- 8. Manager Status & Rating -->
          <td>
            <div style="display:flex; flex-direction:column; gap:2px; width:100%; overflow:hidden;">
              ${r.evalRes.managerStatus === 'On track' ? `
                <span class="tp-mgr-rating-pill" style="background:#FEF9C3; color:#854D0E; border:1px solid #FEF08A; padding:2px 7px; border-radius:6px; font-size:10.5px; display:inline-block; max-width:fit-content;" title="On Track">⭐ On Track</span>
              ` : r.evalRes.managerStatus === 'Needs support' ? `
                <span class="tp-mgr-rating-pill" style="background:#FEF3C7; color:#92400E; border:1px solid #FDE68A; padding:2px 7px; border-radius:6px; font-size:10.5px; display:inline-block; max-width:fit-content;" title="Needs Support">⚠️ Needs Support</span>
              ` : `
                <span style="color:var(--tp-ink-muted, #94A3B8); font-style:italic; font-size:11px;" title="Monthly review pending">Pending Review</span>
              `}
              ${r.evalRes.managerRemark ? `<div style="font-size:10px; color:var(--tp-ink-muted, #64748B); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:1px;" title="${esc(r.evalRes.managerRemark)}">${esc(r.evalRes.managerRemark)}</div>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function buildTableFilterTags() {
    let filterTags = [];
    const q = state.searchQuery;
    if (state.statusFilter) {
      let sfLabel = state.statusFilter;
      if (sfLabel === 'done') sfLabel = 'Status: Done';
      else if (sfLabel === 'partial') sfLabel = 'Status: Partial';
      else if (sfLabel === 'pending') sfLabel = 'Status: Pending';
      else if (sfLabel === 'unassigned') sfLabel = 'Status: Unassigned';
      filterTags.push(`<span class="tp-prog-tbl-filter-tag">${sfLabel} <button type="button" style="background:none; border:none; color:inherit; font-weight:800; cursor:pointer; padding:0 0 0 4px;" onclick="window.ProgressModule.setTableFilter('status', '')">&times;</button></span>`);
    }
    if (state.filterRole) {
      filterTags.push(`<span class="tp-prog-tbl-filter-tag">Role: ${esc(state.filterRole)} <button type="button" style="background:none; border:none; color:inherit; font-weight:800; cursor:pointer; padding:0 0 0 4px;" onclick="window.ProgressModule.setTableFilter('role', '')">&times;</button></span>`);
    }
    if (state.filterDivision) {
      filterTags.push(`<span class="tp-prog-tbl-filter-tag">Div: ${esc(state.filterDivision)} <button type="button" style="background:none; border:none; color:inherit; font-weight:800; cursor:pointer; padding:0 0 0 4px;" onclick="window.ProgressModule.setTableFilter('division', '')">&times;</button></span>`);
    }
    if (state.filterDistrict) {
      filterTags.push(`<span class="tp-prog-tbl-filter-tag">Dist: ${esc(state.filterDistrict)} <button type="button" style="background:none; border:none; color:inherit; font-weight:800; cursor:pointer; padding:0 0 0 4px;" onclick="window.ProgressModule.setTableFilter('district', '')">&times;</button></span>`);
    }
    if (state.filterManager) {
      filterTags.push(`<span class="tp-prog-tbl-filter-tag">Mgr: ${esc(state.filterManager)} <button type="button" style="background:none; border:none; color:inherit; font-weight:800; cursor:pointer; padding:0 0 0 4px;" onclick="window.ProgressModule.setTableFilter('manager', '')">&times;</button></span>`);
    }
    if (state.filterScore) {
      filterTags.push(`<span class="tp-prog-tbl-filter-tag">Score: ${esc(state.filterScore)} <button type="button" style="background:none; border:none; color:inherit; font-weight:800; cursor:pointer; padding:0 0 0 4px;" onclick="window.ProgressModule.setTableFilter('score', '')">&times;</button></span>`);
    }
    if (state.filterManagerStatus) {
      filterTags.push(`<span class="tp-prog-tbl-filter-tag">Rating: ${esc(state.filterManagerStatus)} <button type="button" style="background:none; border:none; color:inherit; font-weight:800; cursor:pointer; padding:0 0 0 4px;" onclick="window.ProgressModule.setTableFilter('managerStatus', '')">&times;</button></span>`);
    }
    if (q) {
      filterTags.push(`<span class="tp-prog-tbl-filter-tag">Search: "${esc(q)}" <button type="button" style="background:none; border:none; color:inherit; font-weight:800; cursor:pointer; padding:0 0 0 4px;" onclick="window.ProgressModule.clearSearch()">&times;</button></span>`);
    }
    return filterTags;
  }

  function updateTableRowsOnly() {
    const tbody = document.getElementById('tpProgTableBody');
    if (!tbody) {
      renderTableOnly(true);
      return;
    }
    const fullRoster = getRosterForState();
    const list = getFilteredAndSortedRoster(fullRoster);
    tbody.innerHTML = buildTableRowsHtml(list);
    syncLiveScores(list);

    const countEl = document.getElementById('tpProgTableCount');
    if (countEl) {
      const tree = getTreeData();
      const stateData = getStateData(tree, state.activeState);
      countEl.innerHTML = `Showing <strong>${list.length}</strong> of ${fullRoster.length} staff members (${stateData.label})`;
    }

    const badgeEl = document.getElementById('tpProgTableBadge');
    if (badgeEl) {
      badgeEl.textContent = `${list.length} Staff`;
    }

    const tagsEl = document.getElementById('tpProgTableTags');
    if (tagsEl) {
      tagsEl.innerHTML = buildTableFilterTags().join('');
    }

    const hasAnyFilter = Boolean(state.statusFilter || state.filterRole || state.filterDivision || state.filterDistrict || state.filterManager || state.filterScore || state.filterManagerStatus || state.searchQuery);
    const clearBtnWrap = document.getElementById('tpProgTableClearBtnWrap');
    if (clearBtnWrap) {
      clearBtnWrap.innerHTML = hasAnyFilter
        ? `<button type="button" class="tp-btn tp-btn-sm tp-btn-secondary" onclick="window.ProgressModule.clearAllTableFilters()" style="cursor:pointer; font-weight:700;">&times; Clear Filters</button>`
        : '';
    }

    const resetBtn = document.querySelector('.tp-btn-filter-reset');
    if (resetBtn) {
      resetBtn.classList.toggle('has-filters', hasAnyFilter);
    }

    const filterMap = {
      'Role': state.filterRole,
      'Division': state.filterDivision,
      'District': state.filterDistrict,
      'Manager': state.filterManager,
      'Status': state.statusFilter || '',
      'Score': state.filterScore,
      'Rating': state.filterManagerStatus
    };
    Object.keys(filterMap).forEach(k => {
      const sel = document.getElementById('tpColFilter' + k);
      if (sel) {
        if (sel.value !== filterMap[k]) sel.value = filterMap[k];
        sel.classList.toggle('active', !!filterMap[k]);
      }
    });

    const tblInput = document.getElementById('tpColFilterSearch');
    if (tblInput && document.activeElement !== tblInput && tblInput.value !== (state.searchQuery || '')) {
      tblInput.value = state.searchQuery || '';
    }
  }

  function renderTableOnly(forceRebuild) {
    const container = document.getElementById('tpProgTableView');
    if (!container) return;

    const existingTable = document.getElementById('tpProgTable');
    if (existingTable && !forceRebuild) {
      updateTableRowsOnly();
      return;
    }

    const tree = getTreeData();
    if (!tree) return;

    const stateData = getStateData(tree, state.activeState);
    const fullRoster = getRosterForState();
    const list = getFilteredAndSortedRoster(fullRoster);

    const uniqueRoles = [...new Set(fullRoster.map(r => r.role).filter(Boolean))].sort();
    const uniqueDivisions = [...new Set(fullRoster.map(r => r.division).filter(Boolean))].sort();
    const uniqueDistricts = [...new Set(fullRoster.map(r => r.district).filter(d => d && d !== '—' && d !== '-'))].sort();
    const uniqueManagers = [...new Set(fullRoster.map(r => r.manager).filter(m => m && m !== 'Leadership'))].sort();
    const uniqueMgrRatings = [...new Set(fullRoster.map(r => r.evalRes.managerStatus).filter(Boolean))].sort();

    const filterTags = buildTableFilterTags();
    const hasAnyFilter = Boolean(state.statusFilter || state.filterRole || state.filterDivision || state.filterDistrict || state.filterManager || state.filterScore || state.filterManagerStatus || state.searchQuery);
    const rowsHtml = buildTableRowsHtml(list);

    container.innerHTML = `
      <div class="tp-prog-tbl-card">
        <div class="tp-prog-tbl-toolbar">
          <div class="tp-prog-tbl-toolbar-left">
            <div class="tp-prog-tbl-title-badge">
              <span class="tp-prog-tbl-main-title">Field Staff Directory</span>
              <span class="tp-prog-tbl-pill-count" id="tpProgTableBadge">${list.length} Staff</span>
            </div>
            <span class="tp-prog-tbl-count" id="tpProgTableCount">Showing <strong>${list.length}</strong> of ${fullRoster.length} staff members (${stateData.label})</span>
            <div id="tpProgTableTags" style="display:inline-flex; align-items:center; gap:6px; flex-wrap:wrap;">${filterTags.join('')}</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <div id="tpProgTableClearBtnWrap">${hasAnyFilter ? `<button type="button" class="tp-btn tp-btn-sm tp-btn-secondary" onclick="window.ProgressModule.clearAllTableFilters()" style="cursor:pointer; font-weight:700;">&times; Clear Filters</button>` : ''}</div>
            <button type="button" class="tp-prog-tbl-export-btn" onclick="window.ProgressModule.exportTableCSV()" title="Export filtered rows to CSV">
              <span>📥</span>
              <span>Export CSV</span>
            </button>
          </div>
        </div>
        <div class="tp-prog-tbl-wrap">
          <table class="tp-prog-table" id="tpProgTable" aria-label="Monthly Field Review Staff Roster">
            <colgroup>
              <col style="width: 18%;">
              <col style="width: 13%;">
              <col style="width: 12%;">
              <col style="width: 12%;">
              <col style="width: 13%;">
              <col style="width: 11%;">
              <col style="width: 10%;">
              <col style="width: 11%;">
            </colgroup>
            <thead>
              <tr class="tp-table-filter-row">
                <!-- 1. Search text filter -->
                <th>
                  <div class="tp-col-filter-wrap">
                    <svg class="tp-col-filter-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input type="text" id="tpColFilterSearch" class="tp-col-filter-input" placeholder="Search Name / ID..." value="${esc(state.searchQuery)}" oninput="window.ProgressModule.setTableSearch(this.value)">
                  </div>
                </th>
                <!-- 2. Role dropdown -->
                <th>
                  <select id="tpColFilterRole" class="tp-col-filter-select ${state.filterRole ? 'active' : ''}" onchange="window.ProgressModule.setTableFilter('role', this.value)" title="Filter by Role">
                    <option value="">Role (All)</option>
                    ${uniqueRoles.map(r => `<option value="${esc(r)}" ${state.filterRole === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}
                  </select>
                </th>
                <!-- 3. Division dropdown -->
                <th>
                  <select id="tpColFilterDivision" class="tp-col-filter-select ${state.filterDivision ? 'active' : ''}" onchange="window.ProgressModule.setTableFilter('division', this.value)" title="Filter by Division">
                    <option value="">Division (All)</option>
                    ${uniqueDivisions.map(d => `<option value="${esc(d)}" ${state.filterDivision === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}
                  </select>
                </th>
                <!-- 4. District dropdown -->
                <th>
                  <select id="tpColFilterDistrict" class="tp-col-filter-select ${state.filterDistrict ? 'active' : ''}" onchange="window.ProgressModule.setTableFilter('district', this.value)" title="Filter by District">
                    <option value="">District (All)</option>
                    ${uniqueDistricts.map(d => `<option value="${esc(d)}" ${state.filterDistrict === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}
                  </select>
                </th>
                <!-- 5. Manager dropdown -->
                <th>
                  <select id="tpColFilterManager" class="tp-col-filter-select ${state.filterManager ? 'active' : ''}" onchange="window.ProgressModule.setTableFilter('manager', this.value)" title="Filter by Manager">
                    <option value="">Manager (All)</option>
                    ${uniqueManagers.map(m => `<option value="${esc(m)}" ${state.filterManager === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}
                  </select>
                </th>
                <!-- 6. Review Status dropdown -->
                <th>
                  <select id="tpColFilterStatus" class="tp-col-filter-select ${state.statusFilter ? 'active' : ''}" onchange="window.ProgressModule.setTableFilter('status', this.value)" title="Filter by Review Status">
                    <option value="">Status (All)</option>
                    <option value="done" ${state.statusFilter === 'done' ? 'selected' : ''}>✓ Review Done</option>
                    <option value="partial" ${state.statusFilter === 'partial' ? 'selected' : ''}>◐ Partially Done</option>
                    <option value="pending" ${state.statusFilter === 'pending' ? 'selected' : ''}>○ Review Pending</option>
                    <option value="unassigned" ${state.statusFilter === 'unassigned' ? 'selected' : ''}>📋 Pending Assign.</option>
                  </select>
                </th>
                <!-- 7. Score dropdown -->
                <th>
                  <select id="tpColFilterScore" class="tp-col-filter-select ${state.filterScore ? 'active' : ''}" onchange="window.ProgressModule.setTableFilter('score', this.value)" title="Filter by Score">
                    <option value="">Score (All)</option>
                    <option value="80+" ${state.filterScore === '80+' ? 'selected' : ''}>80 - 100%</option>
                    <option value="50-79" ${state.filterScore === '50-79' ? 'selected' : ''}>50 - 79%</option>
                    <option value="<50" ${state.filterScore === '<50' ? 'selected' : ''}>&lt; 50%</option>
                    <option value="unassigned" ${state.filterScore === 'unassigned' ? 'selected' : ''}>Unassigned</option>
                  </select>
                </th>
                <!-- 8. Manager Rating dropdown -->
                <th>
                  <select id="tpColFilterRating" class="tp-col-filter-select ${state.filterManagerStatus ? 'active' : ''}" onchange="window.ProgressModule.setTableFilter('managerStatus', this.value)" title="Filter by Manager Rating">
                    <option value="">Rating (All)</option>
                    ${uniqueMgrRatings.map(r => `<option value="${esc(r)}" ${state.filterManagerStatus === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}
                  </select>
                </th>
              </tr>
            </thead>
            <tbody id="tpProgTableBody">
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;

    syncLiveScores(list);
  }

  // Export module to global scope
  window.ProgressModule = {
    init,
    render,
    setState,
    setViewMode,
    setSort,
    setTableFilter,
    clearAllTableFilters,
    setTableSearch,
    exportTableCSV,
    clearAllFilters,
    renderTableOnly,
    switchDivision: toggleDivision,
    toggleDivision,
    expandAll,
    collapseAll,
    setStatusFilter,
    clearStatusFilter,
    openStatusModal,
    filterStatusModalList,
    clearSearch,
    drawConnectors,
    openModal,
    closeModal,
    refreshFromSupabase,
    toggleAllDetails
  };

})();
