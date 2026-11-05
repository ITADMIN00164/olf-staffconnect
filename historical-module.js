/**

 * OLF StaffConnect - Historical Data Archival Module

 * Supports External Historical Data (11 Verified Sheets) & Internal Historical Data (15 Academic Sheets).

 * Role-Based Access Control (RBAC): View-Only for regular staff; Edit Enabled for IT Admin.

 */

(function() {

  'use strict';



  // Module State

  const state = {

    dataSource: 'external', // 'external' | 'internal'

    mode: 'analytics', // 'analytics' | 'grid'

    activeSheetId: 'class-10',

    stateFilter: 'ALL', // 'ALL' | 'MH' | 'CG' | 'MP' | 'BR'

    districtFilter: 'ALL', // 'ALL' or specific district name

    personFilter: 'ALL', // 'ALL' or specific DM / PM / PO name

    searchQuery: '',

    selectedDistrict: null,

    programFocus: 'class-10', // for analytics view

    editingRecord: null // for IT Admin edit modal

  };



  // Check if current logged-in/simulated user is IT Admin

  function isITAdmin() {

    try {

      if (window.TeamPerformance && typeof window.TeamPerformance.isCurrentUserAdmin === 'function') {

        if (window.TeamPerformance.isCurrentUserAdmin()) return true;

      }

      const sim = localStorage.getItem('olf_smart_goals_simulated_user');

      const user = window.__olfUser || (sim ? JSON.parse(sim) : null);

      if (user && (user.role === 'Admin' || user.email === 'admin@openlinksfoundation.org')) {

        return true;

      }

    } catch (e) {

      console.warn('RBAC check error:', e);

    }

    return false;

  }



  // Load custom local edits saved by IT Admin

  function getSavedEdits() {

    try {

      const storageKey = state.dataSource === 'internal'

        ? 'olf_historical_internal_admin_edits'

        : 'olf_historical_admin_edits';

      const raw = localStorage.getItem(storageKey);

      return raw ? JSON.parse(raw) : {};

    } catch(e) {

      return {};

    }

  }



  function saveEditRecord(sheetId, recordKey, updatedFields) {

    const storageKey = state.dataSource === 'internal'

      ? 'olf_historical_internal_admin_edits'

      : 'olf_historical_admin_edits';

    const edits = getSavedEdits();

    const key = `${sheetId}::${recordKey.trim().toLowerCase()}`;

    edits[key] = Object.assign({}, edits[key] || {}, updatedFields);

    localStorage.setItem(storageKey, JSON.stringify(edits));

  }



  function getData() {

    const isInt = state.dataSource === 'internal';

    const raw = isInt

      ? (window.OLF_HISTORICAL_INTERNAL_DATA || { sheets: [] })

      : (window.OLF_HISTORICAL_DATA || { sheets: [] });

    const edits = getSavedEdits();



    // Deep clone rows to avoid corrupting master data and apply admin overrides

    const clonedSheets = (raw.sheets || []).map(s => {

      const clonedRows = (s.rows || []).map(r => {

        const rowCopy = [...r];

        let rowKey = '';

        if (isInt) {

          if (s.id === 'detailed-status') rowKey = cleanVal(rowCopy[1]); // District

          else if (s.id === 'demographics-internal') rowKey = cleanVal(rowCopy[0]); // District

          else if (s.id === 'master-overview') rowKey = cleanVal(rowCopy[2]); // Program

          else rowKey = cleanVal(rowCopy[2]); // District Name

        } else {

          rowKey = cleanVal(rowCopy[5]); // District Name

        }



        const key = `${s.id}::${rowKey.toLowerCase()}`;

        if (edits[key]) {

          const e = edits[key];

          if (e.dm !== undefined && rowCopy[6] !== undefined) rowCopy[6] = e.dm;

          if (e.pm !== undefined && rowCopy[7] !== undefined) rowCopy[7] = e.pm;

          if (e.age !== undefined && rowCopy[8] !== undefined) rowCopy[8] = e.age;

          if (e.grade !== undefined && rowCopy[9] !== undefined) rowCopy[9] = e.grade;

          if (e.targetGrade !== undefined && rowCopy[10] !== undefined) rowCopy[10] = e.targetGrade;

          if (e.teamLeader !== undefined && rowCopy[4] !== undefined) rowCopy[4] = e.teamLeader;

          if (e.mouDate !== undefined && rowCopy[3] !== undefined) rowCopy[3] = e.mouDate;

          if (e.colValues) {

            Object.keys(e.colValues).forEach(cIdx => {

              rowCopy[parseInt(cIdx)] = e.colValues[cIdx];

            });

          }

        }

        return rowCopy;

      });



      return Object.assign({}, s, { rows: clonedRows });

    });



    return { generatedAt: raw.generatedAt, sheets: clonedSheets, title: raw.title };

  }





  // Dynamically inject '% Qualified' column right after 'Students Qualified' if missing

  function enrichSheetColumns(sheet) {

    if (!sheet) return sheet;

    const origHeaders = sheet.headers || [];

    const origSuper = sheet.superHeaders || [];

    const origRows = sheet.rows || [];



    const newHeaders = [];

    const newSuper = [];

    const insertMap = [];



    for (let i = 0; i < origHeaders.length; i++) {

      const h = cleanVal(origHeaders[i]);

      newHeaders.push(origHeaders[i]);

      newSuper.push(origSuper[i] || '');



      const isQualified = h.toLowerCase().includes('qualified') || (h.toLowerCase().includes('passed') && !h.toLowerCase().includes('pass %'));

      const isAlreadyPct = h.includes('%');

      const nextIsPct = (i + 1 < origHeaders.length) && cleanVal(origHeaders[i + 1]).includes('%');



      if (isQualified && !isAlreadyPct && !nextIsPct) {

        let appearedIdx = -1;

        for (let j = i - 1; j >= Math.max(0, i - 4); j--) {

          const prevH = cleanVal(origHeaders[j]).toLowerCase();

          if (prevH.includes('appeared') || prevH.includes('participated') || prevH.includes('applied')) {

            appearedIdx = j;

            break;

          }

        }

        if (appearedIdx !== -1) {

          newHeaders.push('% Qualified');

          newSuper.push(origSuper[i] || '');

          insertMap.push({ afterCol: i, qualIdx: i, appIdx: appearedIdx });

        }

      }

    }



    if (insertMap.length === 0) return sheet;



    const newRows = origRows.map(r => {

      const rowCopy = [...r];

      let added = 0;

      insertMap.forEach(ins => {

        const qVal = parseNum(r[ins.qualIdx]);

        const aVal = parseNum(r[ins.appIdx]);

        let pctStr = '—';

        if (aVal && aVal > 0 && qVal !== null) {

          pctStr = ((qVal / aVal) * 100).toFixed(1) + '%';

        }

        rowCopy.splice(ins.afterCol + 1 + added, 0, pctStr);

        added++;

      });

      return rowCopy;

    });



    return Object.assign({}, sheet, {

      headers: newHeaders,

      superHeaders: newSuper,

      rows: newRows

    });

  }



  function getSheet(sheetId) {

    const data = getData();

    const rawSheet = data.sheets.find(s => s.id === sheetId) || data.sheets[0];

    return enrichSheetColumns(rawSheet);

  }



  function getSheetOrig(sheetId) {

    const data = getData();

    return data.sheets.find(s => s.id === sheetId) || data.sheets[0];

  }



  function cleanVal(v) {

    if (v === undefined || v === null) return '';

    return String(v).trim();

  }



  function parseNum(v) {

    if (!v) return null;

    const str = String(v).replace(/[%,\s]/g, '');

    const num = parseFloat(str);

    return isNaN(num) ? null : num;

  }

  function isTotalRow(r) {
    if (!r || !Array.isArray(r)) return false;
    const d0 = cleanVal(r[0]).toLowerCase();
    const d1 = cleanVal(r[1]).toLowerCase();
    const d2 = cleanVal(r[2]).toLowerCase();
    const d5 = cleanVal(r[5]).toLowerCase();
    return d0 === 'total' || d1 === 'total' || d2 === 'total' || d5 === 'total' ||
           d2 === 'grand total' || d0 === 'grand total' ||
           (d2.startsWith('total') && !d2.includes('schools') && !d2.includes('students')) ||
           (d0.startsWith('total') && !d0.includes('schools') && !d0.includes('students'));
  }



  function init() {

    const container = document.getElementById('tpHistoricalView');

    if (!container) return;



    let contentWrap = document.getElementById('tpHistoricalMain');

    if (!contentWrap) {

      container.innerHTML = `

        <div id="tpHistoricalHeaderArea"></div>

        <div id="tpHistoricalControls"></div>

        <div id="tpHistoricalMain"></div>

        <div id="tpHistoricalModalContainer"></div>

      `;

    }



    try {

      const qSource = new URLSearchParams(window.location.search).get('datasource');

      if (qSource === 'internal') {

        state.dataSource = 'internal';

        state.activeSheetId = 'academic-cycle';

        state.programFocus = 'academic-cycle';

      }

      const qMode = new URLSearchParams(window.location.search).get('mode');

      if (qMode === 'grid') {

        state.mode = 'grid';

      }

    } catch(e) {}

    renderHeader();

    renderControls();

    renderMain();

  }



  function renderHeader() {

    const headerWrap = document.getElementById('tpHistoricalHeaderArea');

    if (!headerWrap) return;



    const isAdmin = isITAdmin();

    const isExt = state.dataSource === 'external';



    const extCount = (window.OLF_HISTORICAL_DATA && window.OLF_HISTORICAL_DATA.sheets) ? window.OLF_HISTORICAL_DATA.sheets.length : 11;

    const intCount = (window.OLF_HISTORICAL_INTERNAL_DATA && window.OLF_HISTORICAL_INTERNAL_DATA.sheets) ? window.OLF_HISTORICAL_INTERNAL_DATA.sheets.length : 15;



    headerWrap.innerHTML = `

      <div class="tp-header" style="margin-bottom: 20px;">

        <div class="tp-header-left">

          <div class="tp-title-row">

            <h2 class="tp-title">Historical Performance Archive</h2>

          </div>

          <p class="tp-subtitle">

            ${isExt 

              ? 'Longitudinal educational benchmarks & student outcomes across 60 districts (2022–2026)'

              : 'Operational cycles, exam dashboards, lifeskills & milestones across 45 districts (2025–2026)'}

          </p>

        </div>



        <!-- External vs Internal Data Segment Switcher -->

        <div class="tp-hist-source-switcher">

          <button type="button" class="tp-hist-source-btn ${isExt ? 'active' : ''}" onclick="window.HistoricalModule.setDataSource('external')">

            <span>🌐 External Data</span>

            

          </button>

          <button type="button" class="tp-hist-source-btn ${!isExt ? 'active' : ''}" onclick="window.HistoricalModule.setDataSource('internal')">

            <span>🏢 Internal Data</span>

            

          </button>

        </div>

      </div>

    `;

  }



  function renderControls() {

    const ctrlWrap = document.getElementById('tpHistoricalControls');

    if (!ctrlWrap) return;



    const existingScroll = ctrlWrap.querySelector('.tp-hist-tabs-scroll');

    const savedScrollLeft = existingScroll ? existingScroll.scrollLeft : 0;



    const data = getData();

    const sheets = data.sheets || [];

    const isExt = state.dataSource === 'external';



    // Extract unique districts and leaders for dropdowns

    const districtSet = new Set();

    const leaderSet = new Set();

    sheets.forEach(s => {

      s.rows.forEach(r => {

        const d = isExt ? cleanVal(r[5]) : cleanVal(r[2]);

        if (d && d !== 'Districts' && d !== 'District Name' && d !== 'District' && d.length > 1) {

          districtSet.add(d);

        }

        if (isExt) {

          const dm = cleanVal(r[6]);

          const pm = cleanVal(r[7]);

          if (dm && dm !== 'DM' && !dm.toLowerCase().includes('vacant')) leaderSet.add(dm + ' (DM)');

          if (pm && pm !== 'PM' && !pm.toLowerCase().includes('vacant')) leaderSet.add(pm + ' (PM)');

        } else {

          const tl = cleanVal(r[4]);

          if (tl && tl !== 'Team Leader' && tl.length > 2) leaderSet.add(tl + ' (Leader)');

        }

      });

    });



    const allDistricts = Array.from(districtSet).sort();

    const allLeaders = Array.from(leaderSet).sort();

    const hasActiveFilters = state.stateFilter !== 'ALL' || state.districtFilter !== 'ALL' || state.personFilter !== 'ALL' || !!state.searchQuery;



    ctrlWrap.innerHTML = `

      <div class="tp-hist-toolbar-box">

        <!-- Tier 1: View Modes & Export Actions -->

        <div class="tp-hist-tier-top">

          <div class="tp-hist-mode-switcher">

            <button type="button" class="tp-hist-mode-btn ${state.mode === 'analytics' ? 'active' : ''}" onclick="window.HistoricalModule.setMode('analytics')">

              <span class="tp-hist-mode-icon">📊</span>

              <span>Executive Analytics</span>

            </button>

            <button type="button" class="tp-hist-mode-btn ${state.mode === 'grid' ? 'active' : ''}" onclick="window.HistoricalModule.setMode('grid')">

              <span class="tp-hist-mode-icon">📑</span>

              <span>Raw Sheet Grid (1:1)</span>

            </button>

          </div>



          <div class="tp-hist-export-actions">

            <button type="button" class="tp-hist-btn-export tp-hist-btn-xlsx" onclick="window.HistoricalModule.downloadFullWorkbook()" title="Download Complete Multi-Sheet Dataset as Excel (.xlsx)">

              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>

              <span>Export Workbook (.xlsx)</span>

            </button>

            <button type="button" class="tp-hist-btn-export tp-hist-btn-pdf" onclick="window.HistoricalModule.exportFilteredPdf()" title="Download Filtered Table as PDF">

              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>

              <span>Filtered PDF</span>

            </button>

          </div>

        </div>



        <!-- Tier 2: Filter & Search Bar -->

        <div class="tp-hist-filter-strip">

          <!-- State Pills -->

          <div class="tp-hist-pill-group">

            <span class="tp-hist-filter-title">STATE:</span>

            ${['ALL', 'MH', 'CG', 'MP', 'BR'].map(st => `

              <button type="button" class="tp-hist-pill-opt ${state.stateFilter === st ? 'active' : ''}" onclick="window.HistoricalModule.setStateFilter('${st}')">

                ${st === 'ALL' ? 'All' : st}

              </button>

            `).join('')}

          </div>



          <div class="tp-hist-filter-divider"></div>



          <!-- District Selector -->

          <div class="tp-hist-select-wrap">

            <span class="tp-hist-select-icon">📍</span>

            <select class="tp-hist-select-input" onchange="window.HistoricalModule.setDistrictFilter(this.value)">

              <option value="ALL">All Districts (${allDistricts.length})</option>

              ${allDistricts.map(d => `<option value="${escapeHtml(d)}" ${state.districtFilter === d ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('')}

            </select>

          </div>



          <!-- Leader Selector -->

          <div class="tp-hist-select-wrap">

            <span class="tp-hist-select-icon">👔</span>

            <select class="tp-hist-select-input" onchange="window.HistoricalModule.setPersonFilter(this.value)">

              <option value="ALL">All Leaders (${allLeaders.length})</option>

              ${allLeaders.map(p => {

                const rawName = p.split(' (')[0];

                return `<option value="${escapeHtml(rawName)}" ${state.personFilter === rawName ? 'selected' : ''}>${escapeHtml(p)}</option>`;

              }).join('')}

            </select>

          </div>



          <!-- Search Input -->

          <div class="tp-hist-search-wrap">

            <svg class="tp-hist-search-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>

            <input type="text" class="tp-hist-search-field" placeholder="Search districts, metrics, leaders..." value="${escapeHtml(state.searchQuery)}" oninput="window.HistoricalModule.onSearch(this.value)" />

            ${state.searchQuery ? `<button type="button" class="tp-hist-search-reset" onclick="window.HistoricalModule.clearSearch()">&times;</button>` : ''}

          </div>



          <!-- Reset All Filters Button -->

          ${hasActiveFilters ? `

            <button type="button" class="tp-hist-btn-reset-all" onclick="window.HistoricalModule.resetAllFilters()" title="Clear All Active Filters">

              <span>✕ Reset</span>

            </button>

          ` : ''}

        </div>



        <!-- Tier 3: Sheet Selector Tabs -->

        <div class="tp-hist-tabs-row">

          <div class="tp-hist-tabs-badge">${state.mode === 'grid' ? 'SHEETS' : 'PROGRAMS'}</div>

          <div class="tp-hist-tabs-scroll">

            ${sheets.map(s => {

              const isActive = (state.mode === 'grid' ? state.activeSheetId : state.programFocus) === s.id;

              return `

                <button type="button" class="tp-hist-sheet-tab ${isActive ? 'active' : ''}" data-sheet-id="${s.id}" onclick="window.HistoricalModule.selectSheet('${s.id}')">

                  <span class="tp-hist-sheet-icon">${s.icon || '📄'}</span>

                  <span class="tp-hist-sheet-name">${escapeHtml(s.name)}</span>

                </button>

              `;

            }).join('')}

          </div>

        </div>

      </div>

    `;



    const newScroll = ctrlWrap.querySelector('.tp-hist-tabs-scroll');

    if (newScroll) {

      if (savedScrollLeft > 0) {

        newScroll.scrollLeft = savedScrollLeft;

      }

      const activeTab = newScroll.querySelector('.tp-hist-sheet-tab.active');

      if (activeTab) {

        activeTab.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });

      }

    }

  }



  function renderMain() {

    const mainWrap = document.getElementById('tpHistoricalMain');

    if (!mainWrap) return;



    if (state.mode === 'analytics') {

      if (state.dataSource === 'internal') {

        mainWrap.innerHTML = renderInternalAnalyticsView();

      } else {

        mainWrap.innerHTML = renderAnalyticsView();

      }

    } else {

      mainWrap.innerHTML = renderRawGridView();

    }

  }



  // -------------------------------------------------------------

  // INTERNAL DATA VIEW (EXECUTIVE ANALYTICS VIEW)

  // -------------------------------------------------------------

  function formatKpiNum(n) {

    if (n === null || n === undefined || isNaN(n)) return '—';

    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';

    if (n >= 10000) return (n / 1000).toFixed(1) + 'K';

    return Math.round(n).toLocaleString();

  }



  function computeInternalSheetKpis(sheet, filteredRows, data) {

    const rowCount = filteredRows.length;



    // A. Academic Cycle Sheet

    if (sheet.id === 'academic-cycle') {

      let totalCycles = 0;

      filteredRows.forEach(r => {

        for (let c = 5; c <= 12; c++) {

          const n = parseNum(r[c]);

          if (n) totalCycles += n;

        }

      });

      const demoSheet = data.sheets.find(s => s.id === 'demographics-internal');

      let filteredStudents = 0;

      if (demoSheet) {

        const distSet = new Set(filteredRows.map(r => String(r[2] || '').trim().toLowerCase()));

        demoSheet.rows.forEach(r => {

          const dName = String(r[0] || '').trim().toLowerCase();

          if (distSet.size === 0 || distSet.has(dName)) {

            const cnt = parseNum(r[2]);

            if (cnt) filteredStudents += cnt;

          }

        });

      }

      return [

        { title: 'Active Districts Mapped', icon: '📍', val: rowCount, sub: 'Across MH, CG, MP & BR', desc: 'Districts with active operational MOUs' },

        { title: 'Operational Cycles', icon: '🔄', val: totalCycles ? totalCycles + '+' : '485+', sub: 'Academic Program Runs', desc: 'Total cycles executed in 2025–26' },

        { title: 'Students Reached', icon: '👥', val: filteredStudents ? formatKpiNum(filteredStudents) : '1.35M+', sub: 'Total Student Demographics', desc: 'Foundational, board & competitive exams' },

        { title: 'Academic Programs', icon: '🎯', val: data.sheets.length, sub: 'Tracked Operational Tracks', desc: 'FLN, Scholarships, Board Exams & Lifeskills' }

      ];

    }



    // B. Master Overview Sheet

    if (sheet.id === 'master-overview') {

      let totalInstances = 0;

      let rates = [];

      filteredRows.forEach(r => {

        const inst = parseNum(r[3]);

        if (inst) totalInstances += inst;

        const pct = parseNum(r[8]);

        if (pct !== null) rates.push(pct);

      });

      const avgRate = rates.length ? (rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(1) + '%' : '—';

      return [

        { title: 'Tracked Programs', icon: '🎯', val: rowCount, sub: 'Educational Streams', desc: 'Active academic tracks reviewed' },

        { title: 'Total Cycle Instances', icon: '🔄', val: totalInstances ? totalInstances.toLocaleString() : '760+', sub: 'Cumulative Operational Runs', desc: 'Instances executed across districts' },

        { title: 'Partner Districts', icon: '📍', val: '44', sub: 'Longitudinal Footprint', desc: 'Unique districts active across programs' },

        { title: 'Avg Outcome / Pass %', icon: '📈', val: avgRate, sub: 'Portfolio Benchmark', desc: 'Mean qualification rate across programs' }

      ];

    }



    // C. All Academic & Operational Program Sheets

    let schoolCol = -1;

    let studentCol = -1;

    let appearedCols = [];

    let qualifiedCols = [];

    let pctCols = [];



    sheet.headers.forEach((h, idx) => {

      const l = (h || '').toLowerCase().trim();

      const sl = ((sheet.superHeaders && sheet.superHeaders[idx]) || '').toLowerCase().trim();

      if (schoolCol === -1 && (l === '#schools' || l === 'total schools' || l === '#schools registered' || l === 'school' || sl === '#schools')) {

        schoolCol = idx;

      }

      if (studentCol === -1 && (l === '#students' || l === 'total students' || l === '#students registered' || l === 'student count' || sl === '#students')) {

        studentCol = idx;

      }

      if (l.includes('%') || l.includes('pass %') || l.includes('rate')) {

        pctCols.push(idx);

      } else if (l.includes('qualified') || l.includes('passed') || l.includes('nipun')) {

        if (!l.includes('avg')) qualifiedCols.push(idx);

      } else if (l.includes('appeared') || l.includes('participated') || l.includes('student count')) {

        if (!l.includes('avg')) appearedCols.push(idx);

      }

    });



    if (schoolCol === -1 && sheet.superHeaders && sheet.superHeaders[3] && sheet.superHeaders[3].toLowerCase().includes('school')) schoolCol = 3;

    if (studentCol === -1 && sheet.superHeaders && sheet.superHeaders[4] && sheet.superHeaders[4].toLowerCase().includes('student')) studentCol = 4;



    let totalSchools = 0;

    let totalStudents = 0;

    let totalAppeared = 0;

    let totalQualified = 0;

    let rates = [];



    filteredRows.forEach(r => {

      if (schoolCol >= 0) {

        const n = parseNum(r[schoolCol]);

        if (n) totalSchools += n;

      }

      if (studentCol >= 0) {

        const n = parseNum(r[studentCol]);

        if (n) totalStudents += n;

      }

      appearedCols.forEach(c => {

        const n = parseNum(r[c]);

        if (n) totalAppeared += n;

      });

      qualifiedCols.forEach(c => {

        const n = parseNum(r[c]);

        if (n) totalQualified += n;

      });

      pctCols.forEach(c => {

        const n = parseNum(r[c]);

        if (n !== null && n <= 100) rates.push(n);

      });

    });



    const avgPct = rates.length ? (rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(1) + '%' : (totalAppeared && totalQualified ? ((totalQualified / totalAppeared) * 100).toFixed(1) + '%' : '—');

    const displayStudents = totalStudents || totalAppeared;



    return [

      { title: 'Participating Districts', icon: '📍', val: rowCount, sub: sheet.name, desc: 'Active districts in this program' },

      { title: 'Schools Registered', icon: '🏫', val: totalSchools ? formatKpiNum(totalSchools) : (rowCount ? rowCount + ' cohorts' : '—'), sub: 'Partner Schools', desc: 'Schools covered in ' + sheet.name },

      { title: 'Students Enrolled', icon: '👥', val: displayStudents ? formatKpiNum(displayStudents) : '—', sub: 'Student Demographic Base', desc: 'Total students mapped in program' },

      { title: 'Outcome / Qualified', icon: '📈', val: totalQualified ? formatKpiNum(totalQualified) : (avgPct !== '—' ? avgPct : '—'), sub: avgPct !== '—' ? avgPct + ' Success Rate' : 'Academic Benchmark', desc: 'Students achieving qualification / benchmark' }

    ];

  }



  function renderInternalAnalyticsView() {

    const data = getData();

    const cycleSheet = data.sheets.find(s => s.id === 'academic-cycle') || data.sheets[0];

    const targetSheet = getSheet(state.programFocus) || cycleSheet;

    const filteredRows = filterRows(targetSheet.rows);

    const isAdmin = isITAdmin();



    // 1. Dynamic Top 4 Executive KPI Cards calculated for the active sheet & filters

    const kpis = computeInternalSheetKpis(targetSheet, filteredRows, data);



    let html = `

      <div class="tp-hist-kpi-grid">

        ${kpis.map(k => `

          <div class="tp-hist-kpi-card">

            <div class="tp-hist-kpi-header">

              <span class="tp-hist-kpi-title">${escapeHtml(k.title)}</span>

              <span class="tp-hist-kpi-icon">${k.icon || '📊'}</span>

            </div>

            <div class="tp-hist-kpi-val">${k.val}</div>

            <div class="tp-hist-kpi-sub">${escapeHtml(k.sub)}</div>

            <p class="tp-hist-kpi-desc">${escapeHtml(k.desc)}</p>

          </div>

        `).join('')}

      </div>

    `;



    // 2. Focused Sheet Reactive Table

    html += renderFocusedInternalSheet(targetSheet, filteredRows, isAdmin);



    return html;

  }



  function renderFocusedInternalSheet(sheet, filteredRows, isAdmin) {

    if (!sheet) return '<div class="tp-hist-empty">No sheet data available.</div>';



    // 1. Academic Cycle Matrix

    if (sheet.id === 'academic-cycle') {

      return `

        <div class="tp-hist-section-card">

          <div class="tp-hist-section-header">

            <div>

              <h3 class="tp-hist-section-title">District Operations Matrix &amp; Program Execution (2025–26)</h3>

              <p class="tp-hist-section-desc">Active MOU dates, designated Team Leaders, and operational academic cycle counts per district</p>

            </div>

            <div class="tp-hist-section-badge">

              <span>Showing ${filteredRows.length} districts</span>

            </div>

          </div>



          <div class="tp-hist-table-wrap">

            <table class="tp-hist-table">

              <thead>

                <tr>

                  <th style="width: 44px; text-align:center;">#</th>

                  <th style="width: 60px;">State</th>

                  <th>District</th>

                  <th>MOU Date</th>

                  <th>Team Leader</th>

                  <th style="text-align:center;">FLN</th>

                  <th style="text-align:center;">FLN ++</th>

                  <th style="text-align:center;">SE 5-8</th>

                  <th style="text-align:center;">JNV</th>

                  <th style="text-align:center;">NMMSE</th>

                  <th style="text-align:center;">UK 10-12</th>

                  <th style="text-align:center;">JEE/NEET</th>

                  <th style="text-align:center; font-weight:700;">Total Cycles</th>

                  <th style="text-align:center; min-width: 140px;">Actions</th>

                </tr>

              </thead>

              <tbody>

                ${filteredRows.length === 0 ? `<tr><td colspan="14" style="text-align:center; padding: 40px; color:#64748B;">No matching districts found.</td></tr>` : ''}

                ${filteredRows.map((r, idx) => {
                  const isTot = isTotalRow(r);
                  const sr = isTot ? '∑' : (cleanVal(r[0]) || (idx + 1));
                  const stateCode = isTot ? '' : cleanVal(r[1]);
                  const distName = isTot ? 'TOTAL' : cleanVal(r[2]);
                  const mouDate = cleanVal(r[3]);
                  const teamLeader = cleanVal(r[4]);

                  const fln = parseNum(r[5]) || 0;
                  const flnPlus = parseNum(r[6]) || 0;
                  const se = parseNum(r[7]) || 0;
                  const jnv = parseNum(r[8]) || 0;
                  const nmmse = parseNum(r[9]) || 0;
                  const uk = parseNum(r[10]) || 0;
                  const jee = (parseNum(r[11]) || 0) + (parseNum(r[12]) || 0);
                  const rowCycles = fln + flnPlus + se + jnv + nmmse + uk + jee;

                  if (isTot) {
                    return `
                      <tr class="tp-hist-row tp-hist-row-total" style="background:#F1F5F9; font-weight:800; border-top:2px solid #CBD5E1; color:#0F172A;">
                        <td style="text-align:center; color:#0F172A; font-weight:800; font-size:14px;">∑</td>
                        <td><span style="font-size:11px; font-weight:700; color:#475569; text-transform:uppercase;">ALL</span></td>
                        <td class="tp-hist-cell-dist" style="font-weight:800; color:#0F172A; font-size:13.5px;">TOTAL</td>
                        <td style="color:#64748B; font-size:12px;">—</td>
                        <td style="color:#64748B; font-size:12px;">Overall Leadership</td>
                        <td style="text-align:center; font-weight:800; color:#059669;">${fln}</td>
                        <td style="text-align:center; font-weight:800; color:#059669;">${flnPlus}</td>
                        <td style="text-align:center; font-weight:800; color:#2563EB;">${se}</td>
                        <td style="text-align:center; font-weight:800; color:#7C3AED;">${jnv}</td>
                        <td style="text-align:center; font-weight:800; color:#D97706;">${nmmse}</td>
                        <td style="text-align:center; font-weight:800; color:#DC2626;">${uk}</td>
                        <td style="text-align:center; font-weight:800; color:#4F46E5;">${jee}</td>
                        <td style="text-align:center; font-weight:900; color:#0F172A; background:#E2E8F0; font-size:14px;">${rowCycles}</td>
                        <td style="text-align:center; white-space:nowrap;">
                          <span style="background:#E2E8F0; color:#475569; font-size:11px; font-weight:700; padding:4px 10px; border-radius:12px;">Summary Total</span>
                        </td>
                      </tr>
                    `;
                  }

                  return `
                    <tr class="tp-hist-row">

                      <td style="text-align:center; color:#94A3B8; font-weight:600;">${sr}</td>

                      <td><span class="tp-hist-state-tag state-${stateCode.toLowerCase()}">${stateCode}</span></td>

                      <td class="tp-hist-cell-dist">

                        <a href="javascript:void(0)" onclick="window.HistoricalModule.openDistrictDrawer('${escapeHtml(distName)}')" style="color:#0284C7; text-decoration:none; font-weight:700;">

                          ${escapeHtml(distName)}

                        </a>

                      </td>

                      <td style="color:#64748B; font-size:13px; font-family:monospace;">${mouDate || '—'}</td>

                      <td style="color:#334155; font-weight:600;">${escapeHtml(teamLeader || '—')}</td>

                      <td style="text-align:center; font-mono;">${fln > 0 ? `<span style="font-weight:700; color:#059669;">${fln}</span>` : '<span style="color:#CBD5E1;">0</span>'}</td>

                      <td style="text-align:center; font-mono;">${flnPlus > 0 ? `<span style="font-weight:700; color:#059669;">${flnPlus}</span>` : '<span style="color:#CBD5E1;">0</span>'}</td>

                      <td style="text-align:center; font-mono;">${se > 0 ? `<span style="font-weight:700; color:#2563EB;">${se}</span>` : '<span style="color:#CBD5E1;">0</span>'}</td>

                      <td style="text-align:center; font-mono;">${jnv > 0 ? `<span style="font-weight:700; color:#7C3AED;">${jnv}</span>` : '<span style="color:#CBD5E1;">0</span>'}</td>

                      <td style="text-align:center; font-mono;">${nmmse > 0 ? `<span style="font-weight:700; color:#D97706;">${nmmse}</span>` : '<span style="color:#CBD5E1;">0</span>'}</td>

                      <td style="text-align:center; font-mono;">${uk > 0 ? `<span style="font-weight:700; color:#DC2626;">${uk}</span>` : '<span style="color:#CBD5E1;">0</span>'}</td>

                      <td style="text-align:center; font-mono;">${jee > 0 ? `<span style="font-weight:700; color:#4F46E5;">${jee}</span>` : '<span style="color:#CBD5E1;">0</span>'}</td>

                      <td style="text-align:center; font-weight:800; color:#0F172A; background:#F8FAFC;">${rowCycles}</td>

                      <td style="text-align:center; white-space:nowrap;">

                        <button type="button" class="tp-hist-btn-profile" onclick="window.HistoricalModule.openDistrictDrawer('${escapeHtml(distName)}')">

                          <span>🔍 View</span>

                        </button>

                        ${isAdmin ? `

                          <button type="button" class="tp-hist-btn-edit" onclick="window.HistoricalModule.openAdminEditor('${sheet.id}', '${escapeHtml(distName)}')">

                            <span>✏️ Edit</span>

                          </button>

                        ` : ''}

                      </td>

                    </tr>

                  `;

                }).join('')}

              </tbody>

            </table>

          </div>

        </div>

      `;

    }



    // 2. Master Overview Portfolio Table

    if (sheet.id === 'master-overview') {

      return `

        <div class="tp-hist-section-card">

          <div class="tp-hist-section-header">

            <div>

              <h3 class="tp-hist-section-title">Academic Programs Portfolio Summary (2025–26)</h3>

              <p class="tp-hist-section-desc">Consolidated student coverage, cycle instances, and qualification rates across all educational programs</p>

            </div>

            <div class="tp-hist-section-badge">

              <span>${filteredRows.length} Programs</span>

            </div>

          </div>



          <div class="tp-hist-table-wrap">

            <table class="tp-hist-table">

              <thead>

                <tr>

                  <th style="width: 44px; text-align:center;">#</th>

                  <th>Type</th>

                  <th>Program Name</th>

                  <th style="text-align:center;">Cycle Instances</th>

                  <th style="text-align:center;">Unique Cycles</th>

                  <th style="text-align:center;">Unique Districts</th>

                  <th style="text-align:right;">Avg Student Count</th>

                  <th style="text-align:right;">Avg Qualified / Passed</th>

                  <th style="text-align:center;">Outcome %</th>

                </tr>

              </thead>

              <tbody>

                ${filteredRows.map((r, idx) => `

                  <tr class="tp-hist-row">

                    <td style="text-align:center; color:#94A3B8; font-weight:600;">${r[0] || (idx + 1)}</td>

                    <td><span class="tp-badge" style="background:#EFF6FF; color:#1E40AF;">${escapeHtml(r[1] || 'Academic')}</span></td>

                    <td style="font-weight:700; color:#0F172A;">${escapeHtml(r[2] || '—')}</td>

                    <td style="text-align:center; font-family:monospace; font-weight:600;">${r[3] || '—'}</td>

                    <td style="text-align:center; font-family:monospace;">${r[4] || '—'}</td>

                    <td style="text-align:center; font-family:monospace; font-weight:700; color:#0284C7;">${r[5] || '—'}</td>

                    <td style="text-align:right; font-family:monospace; font-weight:600;">${r[6] || '—'}</td>

                    <td style="text-align:right; font-family:monospace; font-weight:600; color:#059669;">${r[7] || '—'}</td>

                    <td style="text-align:center; font-family:monospace; font-weight:800; color:#059669;">${r[8] || '—'}</td>

                  </tr>

                `).join('')}

              </tbody>

            </table>

          </div>

        </div>

      `;

    }



    // 4. Lifeskill Posts Table

    if (sheet.id === 'lifeskill-post-internal') {

      return `

        <div class="tp-hist-section-card">

          <div class="tp-hist-section-header">

            <div>

              <h3 class="tp-hist-section-title">Teacher Lifeskills &amp; School Engagement (2025–26)</h3>

              <p class="tp-hist-section-desc">Teacher posts, active schools, and district lifeskills engagement tracking</p>

            </div>

            <div class="tp-hist-section-badge">

              <span>Showing ${filteredRows.length} districts</span>

            </div>

          </div>



          <div class="tp-hist-table-wrap">

            <table class="tp-hist-table">

              <thead>

                <tr>

                  <th style="width: 44px; text-align:center;">#</th>

                  <th style="width: 60px;">State</th>

                  <th>District</th>

                  <th style="text-align:center;">Age (Mo)</th>

                  <th style="text-align:right;">Total Schools</th>

                  <th style="text-align:right;">Total Teachers</th>

                  <th style="text-align:right;">Lifeskill Schools</th>

                  <th style="text-align:right;">Lifeskill Teachers</th>

                  <th style="text-align:right; font-weight:700;">Lifeskill Posts</th>

                  <th style="text-align:center;">Actions</th>

                </tr>

              </thead>

              <tbody>

                ${filteredRows.map(r => `

                  <tr class="tp-hist-row">

                    <td style="text-align:center; color:#94A3B8; font-weight:600;">${r[0] || '—'}</td>

                    <td><span class="tp-hist-state-tag state-${(r[1] || '').toLowerCase()}">${r[1] || '—'}</span></td>

                    <td class="tp-hist-cell-dist">

                      <a href="javascript:void(0)" onclick="window.HistoricalModule.openDistrictDrawer('${escapeHtml(r[2])}')" style="color:#0284C7; text-decoration:none; font-weight:700;">

                        ${escapeHtml(r[2] || '—')}

                      </a>

                    </td>

                    <td style="text-align:center; font-family:monospace;">${r[3] || '—'}</td>

                    <td style="text-align:right; font-family:monospace; font-weight:600;">${r[4] || '—'}</td>

                    <td style="text-align:right; font-family:monospace; font-weight:600;">${r[5] || '—'}</td>

                    <td style="text-align:right; font-family:monospace; color:#0284C7;">${r[6] || '—'}</td>

                    <td style="text-align:right; font-family:monospace; color:#0284C7;">${r[7] || '—'}</td>

                    <td style="text-align:right; font-family:monospace; font-weight:800; color:#059669;">${r[8] || '—'}</td>

                    <td style="text-align:center; white-space:nowrap;">

                      <button type="button" class="tp-hist-btn-profile" onclick="window.HistoricalModule.openDistrictDrawer('${escapeHtml(r[2])}')">

                        <span>🔍 View</span>

                      </button>

                    </td>

                  </tr>

                `).join('')}

              </tbody>

            </table>

          </div>

        </div>

      `;

    }



    // 5. Generic Program Dashboard Table (FLN, FLN++, SE-5, SE-8, NMMSE, JNV, Class 10, Class 12, CBT, OMR)

    const headers = sheet.headers || [];

    const headerGroups = buildSuperHeaderGroups(sheet.superHeaders, sheet.headers);



    return `

      <div class="tp-hist-section-card">

        <div class="tp-hist-section-header">

          <div>

            <h3 class="tp-hist-section-title">${escapeHtml(sheet.name)}: Complete Academic Outcomes (2025–26)</h3>

            <p class="tp-hist-section-desc">All examination cycles, tests (Test 1 to 7+), and district benchmarks for ${escapeHtml(sheet.name)} &middot; Total ${headers.length} metrics</p>

          </div>

          <div class="tp-hist-section-badge">

            <span>Showing ${filteredRows.length} districts &middot; ${headers.length} columns</span>

          </div>

        </div>



        <div class="tp-hist-table-wrap">

          <table class="tp-hist-table tp-hist-table-raw">

            <thead>

              ${headerGroups.length > 1 ? `

                <tr class="tp-hist-tr-super">

                  ${headerGroups.map(g => `

                    <th colspan="${g.colspan}" class="${g.isGroup ? 'tp-hist-th-group' : 'tp-hist-th-blank'}">

                      ${escapeHtml(g.title)}

                    </th>

                  `).join('')}

                  <th class="tp-hist-th-blank" style="text-align:center; min-width: 140px;">Actions</th>

                </tr>

              ` : ''}

              <tr class="tp-hist-tr-sub">

                ${headers.map((h, colIdx) => {

                  const isSticky = colIdx <= 2;

                  return `

                    <th class="${isSticky ? 'tp-hist-col-sticky sticky-col-' + colIdx : ''}" style="${colIdx >= 4 ? 'text-align:right;' : (colIdx === 0 ? 'text-align:center; width:44px;' : '')}">

                      ${escapeHtml(h || ('Col ' + colIdx))}

                    </th>

                  `;

                }).join('')}

                <th style="text-align:center; min-width: 140px;">Actions</th>

              </tr>

            </thead>

            <tbody>

              ${filteredRows.length === 0 ? `<tr><td colspan="${headers.length + 1}" style="text-align:center; padding: 40px; color:#64748B;">No matching records found.</td></tr>` : ''}

              ${filteredRows.map((r, idx) => {
                const isTot = isTotalRow(r);
                const distName = isTot ? 'TOTAL' : cleanVal(r[2]);
                const stateCode = isTot ? '' : cleanVal(r[1]);

                if (isTot) {
                  return `
                    <tr class="tp-hist-row tp-hist-row-total" style="background:#F1F5F9; font-weight:800; border-top:2px solid #CBD5E1; color:#0F172A;">
                      ${headers.map((h, colIdx) => {
                        let val = cleanVal(r[colIdx]);
                        const isDist = colIdx === 2;
                        const isState = colIdx === 1;
                        const isNum = colIdx >= 3;
                        const isSticky = colIdx <= 2;

                        if (colIdx === 0) {
                          return `<td class="${isSticky ? 'tp-hist-col-sticky sticky-col-0' : ''}" style="text-align:center; font-weight:800; font-size:14px; background:#F1F5F9;">∑</td>`;
                        }
                        if (isState) {
                          return `<td class="${isSticky ? 'tp-hist-col-sticky sticky-col-1' : ''}" style="background:#F1F5F9;"><span style="font-size:11px; font-weight:700; color:#475569;">${val ? escapeHtml(val) : 'ALL'}</span></td>`;
                        }
                        if (isDist) {
                          return `<td class="tp-hist-cell-dist ${isSticky ? 'tp-hist-col-sticky sticky-col-2' : ''}" style="font-weight:800; color:#0F172A; background:#F1F5F9; font-size:13.5px;">TOTAL</td>`;
                        }
                        return `
                          <td class="${isSticky ? 'tp-hist-col-sticky sticky-col-' + colIdx : ''}" style="${isNum ? 'text-align:right; font-family:monospace; font-weight:800; color:#0F172A;' : ''}; background:#F1F5F9;">
                            ${escapeHtml(val || '—')}
                          </td>
                        `;
                      }).join('')}
                      <td style="text-align:center; white-space:nowrap; background:#F1F5F9;">
                        <span style="background:#E2E8F0; color:#475569; font-size:11px; font-weight:700; padding:4px 10px; border-radius:12px;">Summary Total</span>
                      </td>
                    </tr>
                  `;
                }

                return `
                  <tr class="tp-hist-row">

                    ${headers.map((h, colIdx) => {

                      let val = cleanVal(r[colIdx]);

                      const isDist = colIdx === 2;

                      const isState = colIdx === 1 && val.length <= 3;

                      const isNum = colIdx >= 4;

                      const isSticky = colIdx <= 2;



                      if (isState) {

                        return `<td class="${isSticky ? 'tp-hist-col-sticky sticky-col-' + colIdx : ''}"><span class="tp-hist-state-tag state-${val.toLowerCase()}">${escapeHtml(val)}</span></td>`;

                      }

                      if (isDist) {

                        return `

                          <td class="tp-hist-cell-dist ${isSticky ? 'tp-hist-col-sticky sticky-col-' + colIdx : ''}">

                            <a href="javascript:void(0)" onclick="window.HistoricalModule.openDistrictDrawer('${escapeHtml(val)}')" style="color:#0284C7; text-decoration:none; font-weight:700;">

                              ${escapeHtml(val || '—')}

                            </a>

                          </td>

                        `;

                      }

                      return `

                        <td class="${isSticky ? 'tp-hist-col-sticky sticky-col-' + colIdx : ''}" style="${isNum ? 'text-align:right; font-family:monospace; font-weight:600;' : (colIdx === 0 ? 'text-align:center; color:#94A3B8;' : '')}">

                          ${escapeHtml(val || '—')}

                        </td>

                      `;

                    }).join('')}

                    <td style="text-align:center; white-space:nowrap;">

                      <button type="button" class="tp-hist-btn-profile" onclick="window.HistoricalModule.openDistrictDrawer('${escapeHtml(distName)}')">

                        <span>🔍 View</span>

                      </button>

                      ${isAdmin ? `

                        <button type="button" class="tp-hist-btn-edit" onclick="window.HistoricalModule.openAdminEditor('${sheet.id}', '${escapeHtml(distName)}')">

                          <span>✏️ Edit</span>

                        </button>

                      ` : ''}

                    </td>

                  </tr>

                `;

              }).join('')}

            </tbody>

          </table>

        </div>

      </div>

    `;

  }



  // -------------------------------------------------------------

  // EXTERNAL DATA VIEW (EXECUTIVE ANALYTICS VIEW)

  // -------------------------------------------------------------

  function renderAnalyticsView() {

    const targetSheet = getSheet(state.programFocus);

    if (!targetSheet) return '<div class="tp-hist-empty">No dataset available.</div>';



    const filteredRows = filterRows(targetSheet.rows);

    const totalDistricts = filteredRows.length;

    let gradeCounts = { 'A': 0, 'B': 0, 'C': 0, 'Other': 0 };

    let totalAge = 0;

    let ageCount = 0;

    let rates = [];



    const yearCols = identifyYearMetricColumns(targetSheet);



    filteredRows.forEach(r => {

      const grade = cleanVal(r[9]).toUpperCase();

      if (gradeCounts[grade] !== undefined) gradeCounts[grade]++;

      else if (grade) gradeCounts.Other++;



      const age = parseNum(r[8]);

      if (age !== null) {

        totalAge += age;

        ageCount++;

      }



      if (yearCols.length > 0) {

        const latestCol = yearCols[yearCols.length - 1];

        const val = parseNum(r[latestCol.colIdx]);

        if (val !== null) rates.push(val);

      }

    });



    const avgAge = ageCount > 0 ? (totalAge / ageCount).toFixed(1) : '—';

    const avgLatestRate = rates.length > 0 ? (rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(1) : '—';

    const isAdmin = isITAdmin();



    let html = `

      <div class="tp-hist-kpi-grid">

        <div class="tp-hist-kpi-card">

          <div class="tp-hist-kpi-header">

            <span class="tp-hist-kpi-title">Districts Mapped</span>

            <span class="tp-hist-kpi-icon">📍</span>

          </div>

          <div class="tp-hist-kpi-val">${totalDistricts}</div>

          <div class="tp-hist-kpi-sub">Across 4 States</div>

          <p class="tp-hist-kpi-desc">Cohort districts with verified longitudinal data</p>

        </div>



        <div class="tp-hist-kpi-card">

          <div class="tp-hist-kpi-header">

            <span class="tp-hist-kpi-title">Avg Program Maturity</span>

            <span class="tp-hist-kpi-icon">⏳</span>

          </div>

          <div class="tp-hist-kpi-val">${avgAge} <span style="font-size:16px; font-weight:500;">months</span></div>

          <div class="tp-hist-kpi-sub">Longitudinal Engagement</div>

          <p class="tp-hist-kpi-desc">Average operational age with district</p>

        </div>



        <div class="tp-hist-kpi-card">

          <div class="tp-hist-kpi-header">

            <span class="tp-hist-kpi-title">Quality Grade Mix</span>

            <span class="tp-hist-kpi-icon">🏅</span>

          </div>

          <div class="tp-hist-kpi-val" style="display:flex; gap:12px; align-items:baseline;">

            <span class="tp-hist-grade-badge grade-a">A: ${gradeCounts.A}</span>

            <span class="tp-hist-grade-badge grade-b">B: ${gradeCounts.B}</span>

            <span class="tp-hist-grade-badge grade-c">C: ${gradeCounts.C}</span>

          </div>

          <div class="tp-hist-kpi-sub">Achieved Grade (25–26)</div>

          <p class="tp-hist-kpi-desc">Evaluated operational tiering</p>

        </div>



        <div class="tp-hist-kpi-card">

          <div class="tp-hist-kpi-header">

            <span class="tp-hist-kpi-title">Latest Outcome Avg</span>

            <span class="tp-hist-kpi-icon">📈</span>

          </div>

          <div class="tp-hist-kpi-val">${

            avgLatestRate !== '—'

              ? (yearCols.length > 0 && (yearCols[yearCols.length - 1].label.includes('%') || yearCols[yearCols.length - 1].label.toLowerCase().includes('rate') || yearCols[yearCols.length - 1].label.toLowerCase().includes('score'))

                  ? avgLatestRate + '%'

                  : Number(avgLatestRate).toLocaleString())

              : '—'

          }</div>

          <div class="tp-hist-kpi-sub">${yearCols.length > 0 ? escapeHtml(yearCols[yearCols.length - 1].label) : '2025–26 Benchmark'}</div>

          <p class="tp-hist-kpi-desc">Most recent academic outcome metric</p>

        </div>

      </div>

    `;



    // Longitudinal Trajectory Table

    html += `

      <div class="tp-hist-section-card">

        <div class="tp-hist-section-header">

          <div>

            <h3 class="tp-hist-section-title">Longitudinal Trajectory: ${escapeHtml(targetSheet.name)}</h3>

            <p class="tp-hist-section-desc">Multi-year trend analysis with delta indicators and 1-click District 360° Profile deep-dive</p>

          </div>

          <div class="tp-hist-section-badge">

            <span>Showing ${filteredRows.length} districts</span>

          </div>

        </div>



        <div class="tp-hist-table-wrap">

          <table class="tp-hist-table">

            <thead>

              <tr>

                <th style="width: 44px; text-align:center;">#</th>

                <th style="width: 60px;">State</th>

                <th>District</th>

                <th>Division Mgr (DM)</th>

                <th>Program Mgr (PM)</th>

                <th style="text-align:center;">Cohort</th>

                <th style="text-align:center;">Age (Mo)</th>

                <th style="text-align:center;">Grade (25-26)</th>

                <th style="text-align:center;">Target (26-27)</th>

                ${yearCols.map(y => `<th style="text-align:right;">${y.year} (${y.label})</th>`).join('')}

                ${yearCols.length >= 2 ? '<th style="text-align:center;">Momentum</th>' : ''}

                <th style="text-align:center; min-width: 140px;">Actions</th>

              </tr>

            </thead>

            <tbody>

              ${filteredRows.length === 0 ? `<tr><td colspan="15" style="text-align:center; padding: 40px; color:#64748B;">No matching districts found.</td></tr>` : ''}

              ${filteredRows.map((r, idx) => {

                const stateCode = cleanVal(r[2]);

                const districtName = cleanVal(r[5]);

                const dmName = cleanVal(r[6]);

                const pmName = cleanVal(r[7]);

                const cohort = cleanVal(r[4]);

                const age = cleanVal(r[8]);

                const grade = cleanVal(r[9]);

                const targetGrade = cleanVal(r[10]);



                let deltaHtml = '—';

                if (yearCols.length >= 2) {

                  const firstColVal = parseNum(r[yearCols[0].colIdx]);

                  const lastColVal = parseNum(r[yearCols[yearCols.length - 1].colIdx]);

                  if (firstColVal !== null && lastColVal !== null) {

                    const delta = (lastColVal - firstColVal).toFixed(0);

                    if (delta > 0) {

                      deltaHtml = `<span class="tp-hist-delta-pill pos">▲ +${delta}%</span>`;

                    } else if (delta < 0) {

                      deltaHtml = `<span class="tp-hist-delta-pill neg">▼ ${delta}%</span>`;

                    } else {

                      deltaHtml = `<span class="tp-hist-delta-pill neutral">— 0%</span>`;

                    }

                  }

                }



                return `

                  <tr class="tp-hist-row">

                    <td style="text-align:center; color:#94A3B8; font-weight:600;">${r[1] || (idx + 1)}</td>

                    <td><span class="tp-hist-state-tag state-${stateCode.toLowerCase()}">${stateCode}</span></td>

                    <td class="tp-hist-cell-dist">

                      <strong>${escapeHtml(districtName)}</strong>

                    </td>

                    <td style="color:#334155;">${escapeHtml(dmName || '—')}</td>

                    <td style="color:#64748B;">${escapeHtml(pmName || '—')}</td>

                    <td style="text-align:center; font-size:12px; color:#64748B;">${escapeHtml(cohort || '—')}</td>

                    <td style="text-align:center; font-mono; font-weight:600;">${age || '—'}</td>

                    <td style="text-align:center;"><span class="tp-hist-grade-pill grade-${(grade || '').toLowerCase()}">${grade || '—'}</span></td>

                    <td style="text-align:center;"><span class="tp-hist-grade-pill grade-${(targetGrade || '').toLowerCase()}">${targetGrade || '—'}</span></td>

                    ${yearCols.map(y => {

                      let val = cleanVal(r[y.colIdx]);

                      val = val.replace('%', '').trim();

                      return `<td style="text-align:right; font-family:monospace; font-weight:600; color:#0F172A;">${val ? val + (y.label.includes('%') ? '%' : '') : '—'}</td>`;

                    }).join('')}

                    ${yearCols.length >= 2 ? `<td style="text-align:center;">${deltaHtml}</td>` : ''}

                    <td style="text-align:center; white-space:nowrap;">

                      <button type="button" class="tp-hist-btn-profile" onclick="window.HistoricalModule.openDistrictDrawer('${escapeHtml(districtName)}')">

                        <span>🔍 View</span>

                      </button>

                      ${isAdmin ? `

                        <button type="button" class="tp-hist-btn-edit" onclick="window.HistoricalModule.openAdminEditor('${targetSheet.id}', '${escapeHtml(districtName)}')">

                          <span>✏️ Edit</span>

                        </button>

                      ` : ''}

                    </td>

                  </tr>

                `;

              }).join('')}

            </tbody>

          </table>

        </div>

      </div>

    `;



    return html;

  }



  // -------------------------------------------------------------

  // MODE 2: RAW SHEET GRID (1:1 SPREADSHEET VIEW)

  // -------------------------------------------------------------

  function renderRawGridView() {

    const sheet = getSheet(state.activeSheetId);

    if (!sheet) return '<div class="tp-hist-empty">No sheet data available.</div>';



    const isInt = state.dataSource === 'internal';

    const filteredRows = filterRows(sheet.rows);

    const headerGroups = buildSuperHeaderGroups(sheet.superHeaders, sheet.headers);

    const isAdmin = isITAdmin();



    const sheetsUrl = isInt

      ? `https://docs.google.com/spreadsheets/d/1SSMaeCYwRDslkUSwJpSGcdDTyiqxEialRsLYJMupB_4/edit`

      : `https://docs.google.com/spreadsheets/d/1VGNoUlKA062N6J-xZGwywG9mRCNSvyqsuZJ-SybOC-w/edit?gid=${sheet.gid}#gid=${sheet.gid}`;



    let html = `

      <div class="tp-hist-section-card">

        <div class="tp-hist-section-header">

          <div style="display:flex; align-items:center; gap:12px;">

            <div class="tp-hist-sheet-badge-icon">${sheet.icon}</div>

            <div>

              <div style="display:flex; align-items:center; gap:8px;">

                <h3 class="tp-hist-section-title">${escapeHtml(sheet.name)}</h3>

                <span class="tp-hist-category-pill">${sheet.category}</span>

              </div>

              <p class="tp-hist-section-desc">1:1 Raw Spreadsheet Data &middot; Exact match with Google Sheets (Total ${sheet.rows ? sheet.rows.length : 0} rows)</p>

            </div>

          </div>

          <div style="display:flex; align-items:center; gap:10px;">

            <button type="button" class="tp-hist-btn-sheets-link" onclick="window.HistoricalModule.downloadCsv('${sheet.id}')">

              <span>⬇ Export CSV</span>

            </button>

            <a href="${sheetsUrl}" target="_blank" rel="noopener" class="tp-hist-btn-sheets-link">

              <span>↗ Open in Google Sheets</span>

            </a>

          </div>

        </div>



        <div class="tp-hist-table-wrap">

          <table class="tp-hist-table tp-hist-table-raw">

            <thead>

              <tr class="tp-hist-tr-super">

                ${headerGroups.map(g => `

                  <th colspan="${g.colspan}" class="${g.isGroup ? 'tp-hist-th-group' : 'tp-hist-th-blank'}">

                    ${escapeHtml(g.title)}

                  </th>

                `).join('')}

                ${isAdmin ? `<th class="tp-hist-th-blank" style="width:80px;">Admin</th>` : ''}

              </tr>

              <tr class="tp-hist-tr-sub">

                ${sheet.headers.map((h, colIdx) => {

                  if (colIdx === 0 && !isInt) return '';

                  const isSticky = isInt ? (colIdx <= 2) : (colIdx <= 5);

                  return `

                    <th class="${isSticky ? 'tp-hist-col-sticky sticky-col-' + colIdx : ''}" style="${colIdx >= (isInt ? 4 : 11) ? 'text-align:right;' : ''}">

                      ${escapeHtml(h || ('Col ' + colIdx))}

                    </th>

                  `;

                }).join('')}

                ${isAdmin ? `<th style="text-align:center;">Action</th>` : ''}

              </tr>

            </thead>

            <tbody>

              ${filteredRows.length === 0 ? `<tr><td colspan="${sheet.headers.length + (isAdmin ? 1 : 0)}" style="text-align:center; padding: 40px; color:#64748B;">No matching rows found.</td></tr>` : ''}

              ${filteredRows.map((r, rowIdx) => {

                let distName = isInt

                  ? (sheet.id === 'detailed-status' ? cleanVal(r[1]) : (sheet.id === 'master-overview' ? cleanVal(r[2]) : cleanVal(r[2])))

                  : cleanVal(r[5]);



                return `

                  <tr class="tp-hist-row">

                    ${r.map((c, colIdx) => {

                      if (colIdx === 0 && !isInt) return '';

                      const isSticky = isInt ? (colIdx <= 2) : (colIdx <= 5);

                      let val = cleanVal(c);

                      const isDistCell = isInt ? (colIdx === 2 && sheet.id !== 'master-overview') : (colIdx === 5);

                      const isNum = colIdx >= (isInt ? 4 : 11);



                      return `

                        <td class="${isSticky ? 'tp-hist-col-sticky sticky-col-' + colIdx : ''}" style="${isNum ? 'text-align:right; font-family:monospace; font-weight:600;' : ''}">

                          ${isDistCell && val ? `<a href="javascript:void(0)" onclick="window.HistoricalModule.openDistrictDrawer('${escapeHtml(val)}')" style="color:#0284C7; text-decoration:none; font-weight:700;">${escapeHtml(val)}</a>` : escapeHtml(val || '—')}

                        </td>

                      `;

                    }).join('')}

                    ${isAdmin ? `

                      <td style="text-align:center;">

                        <button type="button" class="tp-hist-btn-edit" onclick="window.HistoricalModule.openAdminEditor('${sheet.id}', '${escapeHtml(distName)}')">

                          <span>✏️ Edit</span>

                        </button>

                      </td>

                    ` : ''}

                  </tr>

                `;

              }).join('')}

            </tbody>

          </table>

        </div>

      </div>

    `;



    return html;

  }



  // -------------------------------------------------------------

  // DISTRICT 360° HISTORICAL DRAWER / MODAL

  // -------------------------------------------------------------

  function openDistrictDrawer(districtName) {

    if (!districtName) return;

    state.selectedDistrict = districtName;

    const modalWrap = document.getElementById('tpHistoricalModalContainer');

    if (!modalWrap) return;



    const isInt = state.dataSource === 'internal';

    const data = getData();

    const sheets = data.sheets || [];

    const isAdmin = isITAdmin();



    if (isInt) {

      renderInternalDistrictDrawer(districtName, sheets, isAdmin, modalWrap);

    } else {

      renderExternalDistrictDrawer(districtName, sheets, isAdmin, modalWrap);

    }

  }



  function renderInternalDistrictDrawer(districtName, sheets, isAdmin, modalWrap) {

    const cycleSheet = sheets.find(s => s.id === 'academic-cycle');

    const demoSheet = sheets.find(s => s.id === 'demographics-internal');

    const lifeskillSheet = sheets.find(s => s.id === 'lifeskill-post-internal');

    const statusSheet = sheets.find(s => s.id === 'detailed-status');



    let cycleRow = cycleSheet ? cycleSheet.rows.find(r => cleanVal(r[2]).toLowerCase() === districtName.toLowerCase()) : null;

    let demoRow = demoSheet ? demoSheet.rows.find(r => cleanVal(r[0]).toLowerCase() === districtName.toLowerCase()) : null;

    let lifeRow = lifeskillSheet ? lifeskillSheet.rows.find(r => cleanVal(r[2]).toLowerCase() === districtName.toLowerCase()) : null;



    const stateCode = cycleRow ? cleanVal(cycleRow[1]) : (lifeRow ? cleanVal(lifeRow[1]) : '—');

    const mouDate = cycleRow ? cleanVal(cycleRow[3]) : '—';

    const teamLeader = cycleRow ? cleanVal(cycleRow[4]) : '—';

    const totalSchools = demoRow ? cleanVal(demoRow[1]) : (lifeRow ? cleanVal(lifeRow[4]) : '—');

    const totalStudents = demoRow ? cleanVal(demoRow[2]) : '—';



    // Program Execution Rows

    const programDefs = [

      { id: 'fln-internal', name: 'FLN (Foundational Literacy)', cycleCol: 5 },

      { id: 'fln-plus-internal', name: 'FLN++ (Middle Literacy 6–8)', cycleCol: 6 },

      { id: 'se-5-internal', name: 'Scholarship 5th (SE-5)', cycleCol: 7 },

      { id: 'se-8-internal', name: 'Scholarship 8th (SE-8)', cycleCol: 7 },

      { id: 'jnv-internal', name: 'JNV Jawahar Navodaya', cycleCol: 8 },

      { id: 'nmmse-internal', name: 'NMMSE Class 8', cycleCol: 9 },

      { id: 'class-10-internal', name: 'Utkrisht Class 10 Board', cycleCol: 10 },

      { id: 'class-12-internal', name: 'Utkrisht Class 12 Board', cycleCol: 10 },

      { id: 'jee-neet-cbt-internal', name: 'JEE / NEET (CBT)', cycleCol: 11 },

      { id: 'jee-neet-omr-internal', name: 'JEE / NEET (OMR)', cycleCol: 12 }

    ];



    let progRowsHtml = programDefs.map(p => {

      const pSheet = sheets.find(s => s.id === p.id);

      const cycles = cycleRow ? cleanVal(cycleRow[p.cycleCol]) : '0';

      let outcome = '—';

      let target = '—';

      let schoolsPart = '—';



      if (pSheet && pSheet.rows) {

        const found = pSheet.rows.find(r => cleanVal(r[2]).toLowerCase() === districtName.toLowerCase());

        if (found) {

          // Check standard columns

          if (p.id.includes('class-10') || p.id.includes('class-12')) {

            outcome = cleanVal(found[5]); // Dist Pass %

            target = cleanVal(found[6]);  // Target %

          } else if (p.id.includes('fln')) {

            outcome = cleanVal(found[6]); // Endline

            target = cleanVal(found[8]);  // Target

          } else {

            outcome = cleanVal(found[6]);

            target = cleanVal(found[7]);

          }

        }

      }



      return `

        <tr class="tp-hist-row">

          <td style="font-weight:700; color:#0F172A;">${p.name}</td>

          <td style="text-align:center; font-family:monospace; font-weight:700; color:${cycles > 0 ? '#059669' : '#94A3B8'};">

            ${cycles > 0 ? cycles + ' Active Cycles' : '0'}

          </td>

          <td style="text-align:center; font-family:monospace; font-weight:600; color:#475569;">${outcome || '—'}</td>

          <td style="text-align:center; font-family:monospace; font-weight:700; color:#2563EB;">${target || '—'}</td>

          <td style="text-align:center;">

            <span style="display:inline-block; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700; ${cycles > 0 ? 'background:#DCFCE7; color:#166534;' : 'background:#F1F5F9; color:#64748B;'}">

              ${cycles > 0 ? 'Active Execution' : 'Not Active'}

            </span>

          </td>

        </tr>

      `;

    }).join('');



    // Milestones from Detailed Status

    let milestonesHtml = '';

    if (statusSheet && statusSheet.rows) {

      const distStatus = statusSheet.rows.filter(r => cleanVal(r[1]).toLowerCase() === districtName.toLowerCase());

      if (distStatus.length > 0) {

        milestonesHtml = `

          <div style="margin-top:24px;">

            <h5 style="font-size:13px; font-weight:800; color:#0F172A; text-transform:uppercase; margin:0 0 12px 0;">Operational Sub-Stages &amp; Remarks</h5>

            <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:12px;">

              <table style="width:100%; border-collapse:collapse; font-size:12px;">

                <thead>

                  <tr style="border-bottom:1px solid #CBD5E1; color:#64748B; text-align:left;">

                    <th style="padding:6px;">Program</th>

                    <th style="padding:6px;">Current Sub-Stage</th>

                    <th style="padding:6px;">Next Stage</th>

                    <th style="padding:6px;">PM Remarks</th>

                  </tr>

                </thead>

                <tbody>

                  ${distStatus.map(st => `

                    <tr style="border-bottom:1px solid #F1F5F9;">

                      <td style="padding:6px; font-weight:600; color:#0F172A;">${escapeHtml(st[2])} ${escapeHtml(st[3] || '')}</td>

                      <td style="padding:6px; color:#2563EB;">${escapeHtml(st[5] || '—')}</td>

                      <td style="padding:6px; color:#059669;">${escapeHtml(st[6] || '—')}</td>

                      <td style="padding:6px; color:#475569;">${escapeHtml(st[8] || '—')}</td>

                    </tr>

                  `).join('')}

                </tbody>

              </table>

            </div>

          </div>

        `;

      }

    }



    modalWrap.innerHTML = `

      <div class="tp-hist-modal-overlay" onclick="if(event.target===this)window.HistoricalModule.closeDistrictDrawer()">

        <div class="tp-hist-modal-card" role="dialog" aria-modal="true" style="max-width: 860px;">

          <div class="tp-hist-modal-header">

            <div>

              <div style="display:flex; align-items:center; gap:8px;">

                <span class="tp-hist-state-tag state-${stateCode.toLowerCase()}">${stateCode}</span>

                <h3 class="tp-hist-modal-title">${escapeHtml(districtName)}</h3>

                <span class="tp-badge" style="background:#E0F2FE; color:#0369A1;">Internal Operations 2025–26</span>

              </div>

              <p class="tp-hist-modal-sub">MOU Date: <strong>${mouDate}</strong> &middot; Team Leader: <strong>${escapeHtml(teamLeader)}</strong></p>

            </div>

            <button type="button" class="tp-hist-modal-close" onclick="window.HistoricalModule.closeDistrictDrawer()">&times;</button>

          </div>



          <div class="tp-hist-modal-body">

            <!-- District Demographics & Scope -->

            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; margin-bottom:20px;">

              <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:12px;">

                <div style="font-size:11px; color:#64748B; font-weight:700;">TOTAL SCHOOLS</div>

                <div style="font-size:18px; font-weight:800; color:#0F172A; font-family:monospace; margin-top:4px;">${totalSchools}</div>

              </div>

              <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:12px;">

                <div style="font-size:11px; color:#64748B; font-weight:700;">TOTAL STUDENTS</div>

                <div style="font-size:18px; font-weight:800; color:#0F172A; font-family:monospace; margin-top:4px;">${totalStudents}</div>

              </div>

              <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:12px;">

                <div style="font-size:11px; color:#64748B; font-weight:700;">TEAM LEADER</div>

                <div style="font-size:15px; font-weight:700; color:#0F172A; margin-top:6px;">${escapeHtml(teamLeader)}</div>

              </div>

              <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:12px;">

                <div style="font-size:11px; color:#64748B; font-weight:700;">MOU AGREEMENT</div>

                <div style="font-size:14px; font-weight:700; color:#0F172A; margin-top:6px;">${mouDate}</div>

              </div>

            </div>



            <!-- Program Execution Grid with Explicit Columns -->

            <h5 style="font-size:13px; font-weight:800; color:#0F172A; text-transform:uppercase; margin:0 0 12px 0;">Academic Programs &amp; Operational Benchmarks</h5>

            <div class="tp-hist-table-wrap">

              <table class="tp-hist-table tp-hist-table-modal">

                <thead>

                  <tr>

                    <th>Academic Program</th>

                    <th style="text-align:center;">Active Cycles</th>

                    <th style="text-align:center;">Baseline (24–25)</th>

                    <th style="text-align:center;">Target (25–26)</th>

                    <th style="text-align:center;">Execution Status</th>

                  </tr>

                </thead>

                <tbody>

                  ${progRowsHtml}

                </tbody>

              </table>

            </div>



            ${milestonesHtml}

          </div>



          <div class="tp-hist-modal-footer">

            <button type="button" class="tp-hist-btn-secondary" onclick="window.HistoricalModule.closeDistrictDrawer()">Close</button>

            ${isAdmin && cycleSheet ? `

              <button type="button" class="tp-hist-btn-edit" onclick="window.HistoricalModule.openAdminEditor('${cycleSheet.id}', '${escapeHtml(districtName)}')">

                <span>✏️ Edit District Record (IT Admin)</span>

              </button>

            ` : ''}

          </div>

        </div>

      </div>

    `;

  }



  function renderExternalDistrictDrawer(districtName, sheets, isAdmin, modalWrap) {

    let meta = null;

    sheets.forEach(s => {

      if (meta) return;

      const found = s.rows.find(r => cleanVal(r[5]).toLowerCase() === districtName.toLowerCase());

      if (found) {

        meta = {

          sr: found[1],

          state: found[2],

          type: found[3],

          cohort: found[4],

          district: found[5],

          dm: found[6],

          pm: found[7],

          age: found[8],

          achievedGrade: found[9],

          targetGrade: found[10]

        };

      }

    });



    if (!meta) {

      alert('District details not found.');

      return;

    }



    let programRows = [];

    sheets.forEach(s => {

      const row = s.rows.find(r => cleanVal(r[5]).toLowerCase() === districtName.toLowerCase());

      if (!row) return;



      const superH = s.superHeaders || [];

      const headers = s.headers || [];

      const yData = { '22-23': null, '23-24': null, '24-25': null, '25-26': null };

      let metricLabel = '';

      let curYear = '';



      superH.forEach((sh, idx) => {

        if (idx < 11) return;

        if (sh && cleanVal(sh)) curYear = cleanVal(sh);

        const subH = cleanVal(headers[idx]);



        const matches = (subH.includes('%')) ||

                        (s.id === 'posts' && subH === 'Posts') ||

                        (subH.includes('Score')) ||

                        (subH.includes('Qualified')) ||

                        (subH.includes('Rate'));



        if (matches && ['22-23', '23-24', '24-25', '25-26'].includes(curYear)) {

          if (!metricLabel) metricLabel = subH;

          const val = cleanVal(row[idx]);

          if (val) yData[curYear] = val;

        }

      });



      let delta = null;

      const numVals = ['22-23', '23-24', '24-25', '25-26']

        .map(y => parseNum(yData[y]))

        .filter(v => v !== null);



      if (numVals.length >= 2) {

        delta = (numVals[numVals.length - 1] - numVals[0]).toFixed(0);

      }



      programRows.push({

        sheetName: s.name,

        icon: s.icon,

        category: s.category,

        metricLabel: metricLabel || 'Outcome',

        yData,

        delta

      });

    });



    modalWrap.innerHTML = `

      <div class="tp-hist-modal-overlay" onclick="if(event.target===this)window.HistoricalModule.closeDistrictDrawer()">

        <div class="tp-hist-modal-card" role="dialog" aria-modal="true" style="max-width: 860px;">

          <div class="tp-hist-modal-header">

            <div>

              <div style="display:flex; align-items:center; gap:8px;">

                <span class="tp-hist-state-tag state-${meta.state.toLowerCase()}">${meta.state}</span>

                <h3 class="tp-hist-modal-title">${escapeHtml(meta.district)}</h3>

                <span style="display:inline-flex; align-items:center; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:700; ${meta.achievedGrade === 'A' ? 'background:#DCFCE7; color:#166534;' : (meta.achievedGrade === 'B' ? 'background:#FEF3C7; color:#B45309;' : 'background:#FEE2E2; color:#B91C1C;')}">

                  Grade ${meta.achievedGrade || '—'}

                </span>

              </div>

              <p class="tp-hist-modal-sub">DM: <strong>${escapeHtml(meta.dm)}</strong> &middot; PM: <strong>${escapeHtml(meta.pm)}</strong> &middot; Cohort: <strong>${escapeHtml(meta.cohort)}</strong> &middot; Age: <strong>${meta.age} months</strong></p>

            </div>

            <button type="button" class="tp-hist-modal-close" onclick="window.HistoricalModule.closeDistrictDrawer()">&times;</button>

          </div>



          <div class="tp-hist-modal-body">

            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; margin-bottom:20px;">

              <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:12px;">

                <div style="font-size:11px; color:#64748B; font-weight:700; text-transform:uppercase;">Achieved Grade (25–26)</div>

                <div style="font-size:18px; font-weight:800; color:#059669; font-family:monospace; margin-top:4px;">Grade ${meta.achievedGrade || '—'}</div>

              </div>

              <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:12px;">

                <div style="font-size:11px; color:#64748B; font-weight:700; text-transform:uppercase;">Target Grade (26–27)</div>

                <div style="font-size:18px; font-weight:800; color:#2563EB; font-family:monospace; margin-top:4px;">Grade ${meta.targetGrade || '—'}</div>

              </div>

              <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:12px;">

                <div style="font-size:11px; color:#64748B; font-weight:700; text-transform:uppercase;">Age with District</div>

                <div style="font-size:18px; font-weight:800; color:#0F172A; font-family:monospace; margin-top:4px;">${meta.age || '—'} mo</div>

              </div>

              <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:12px;">

                <div style="font-size:11px; color:#64748B; font-weight:700; text-transform:uppercase;">Programs Tracked</div>

                <div style="font-size:18px; font-weight:800; color:#0F172A; font-family:monospace; margin-top:4px;">${programRows.length} of 11</div>

              </div>

            </div>



            <div class="tp-hist-table-wrap">

              <table class="tp-hist-table tp-hist-table-modal">

                <thead>

                  <tr>

                    <th>Program &amp; Core Benchmark</th>

                    <th style="text-align:right;">2022–23</th>

                    <th style="text-align:right;">2023–24</th>

                    <th style="text-align:right;">2024–25</th>

                    <th style="text-align:right;">2025–26</th>

                    <th style="text-align:center;">Trajectory</th>

                  </tr>

                </thead>

                <tbody>

                  ${programRows.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding: 24px; color:#64748B;">No program data available.</td></tr>` : ''}

                  ${programRows.map(p => {

                    const formatVal = (v) => {

                      if (!v) return '—';

                      let cleaned = v.replace('%', '').trim();

                      return `${cleaned}%`;

                    };



                    let deltaBadge = '—';

                    if (p.delta !== null) {

                      if (p.delta > 0) deltaBadge = `<span class="tp-hist-delta-pill pos">▲ +${p.delta}%</span>`;

                      else if (p.delta < 0) deltaBadge = `<span class="tp-hist-delta-pill neg">▼ ${p.delta}%</span>`;

                      else deltaBadge = `<span class="tp-hist-delta-pill neutral">— 0%</span>`;

                    }



                    return `

                      <tr class="tp-hist-row">

                        <td>

                          <div style="display:flex; align-items:center; gap:8px;">

                            <span>${p.icon}</span>

                            <div>

                              <div style="font-weight:700; color:#0F172A;">${escapeHtml(p.sheetName)}</div>

                              <div style="font-size:11px; color:#64748B;">${escapeHtml(p.metricLabel)}</div>

                            </div>

                          </div>

                        </td>

                        <td style="text-align:right; font-family:monospace; font-weight:600; color:#475569;">${formatVal(p.yData['22-23'])}</td>

                        <td style="text-align:right; font-family:monospace; font-weight:600; color:#475569;">${formatVal(p.yData['23-24'])}</td>

                        <td style="text-align:right; font-family:monospace; font-weight:600; color:#475569;">${formatVal(p.yData['24-25'])}</td>

                        <td style="text-align:right; font-family:monospace; font-weight:700; color:#0F172A;">${formatVal(p.yData['25-26'])}</td>

                        <td style="text-align:center;">${deltaBadge}</td>

                      </tr>

                    `;

                  }).join('')}

                </tbody>

              </table>

            </div>

          </div>



          <div class="tp-hist-modal-footer">

            <button type="button" class="tp-hist-btn-secondary" onclick="window.HistoricalModule.closeDistrictDrawer()">Close</button>

            ${isAdmin ? `

              <button type="button" class="tp-hist-btn-edit" onclick="window.HistoricalModule.openAdminEditor('class-10', '${escapeHtml(meta.district)}')">

                <span>✏️ Edit District Record (Admin)</span>

              </button>

            ` : ''}

          </div>

        </div>

      </div>

    `;

  }



  function closeDistrictDrawer() {

    state.selectedDistrict = null;

    const modalWrap = document.getElementById('tpHistoricalModalContainer');

    if (modalWrap) modalWrap.innerHTML = '';

  }



  // -------------------------------------------------------------

  // IT ADMIN RECORD EDITOR MODAL

  // -------------------------------------------------------------

  function openAdminEditor(sheetId, recordKey) {

    if (!isITAdmin()) {

      alert('Access restricted: Only IT Admins have permission to edit historical records.');

      return;

    }



    const sheet = getSheet(sheetId);

    if (!sheet) return;



    const isInt = state.dataSource === 'internal';

    let row = null;

    if (isInt) {

      row = sheet.rows.find(r => cleanVal(r[2]).toLowerCase() === recordKey.toLowerCase() || cleanVal(r[1]).toLowerCase() === recordKey.toLowerCase());

    } else {

      row = sheet.rows.find(r => cleanVal(r[5]).toLowerCase() === recordKey.toLowerCase());

    }



    if (!row) {

      alert('Record not found.');

      return;

    }



    const modalWrap = document.getElementById('tpHistoricalModalContainer');

    if (!modalWrap) return;



    if (isInt) {

      renderInternalAdminEditor(sheet, row, recordKey, modalWrap);

    } else {

      renderExternalAdminEditor(sheet, row, recordKey, modalWrap);

    }

  }



  function renderInternalAdminEditor(sheet, row, recordKey, modalWrap) {

    const currentTL = cleanVal(row[4]);

    const currentMou = cleanVal(row[3]);



    modalWrap.innerHTML = `

      <div class="tp-hist-modal-overlay" onclick="if(event.target===this)window.HistoricalModule.closeDistrictDrawer()">

        <div class="tp-hist-modal-card" style="max-width: 640px;" role="dialog" aria-modal="true">

          <div class="tp-hist-modal-header" style="background:#FAF5FF; border-bottom:1px solid #E9D5FF;">

            <div>

              <div style="display:flex; align-items:center; gap:8px;">

                <span style="font-size:18px;">👑</span>

                <h3 class="tp-hist-modal-title" style="color:#6B21A8;">IT Admin Record Editor</h3>

              </div>

              <p class="tp-hist-modal-sub">Editing: <strong>${escapeHtml(recordKey)}</strong> (${sheet.name})</p>

            </div>

            <button type="button" class="tp-hist-modal-close" onclick="window.HistoricalModule.closeDistrictDrawer()">&times;</button>

          </div>



          <form id="tpAdminEditForm" onsubmit="window.HistoricalModule.handleSaveEdit(event, '${sheet.id}', '${escapeHtml(recordKey)}')" style="padding: 24px;">

            <div class="tp-hist-edit-grid">

              <div class="tp-hist-form-group">

                <label class="tp-hist-form-label">Team Leader / PM</label>

                <input type="text" class="tp-hist-form-input" name="teamLeader" value="${escapeHtml(currentTL)}" />

              </div>



              <div class="tp-hist-form-group">

                <label class="tp-hist-form-label">MOU Date</label>

                <input type="text" class="tp-hist-form-input" name="mouDate" value="${escapeHtml(currentMou)}" />

              </div>

            </div>



            <!-- Column Values Grid -->

            <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:16px; margin-bottom:20px;">

              <h5 style="font-size:12px; font-weight:800; color:#475569; text-transform:uppercase; margin:0 0 10px 0;">Cycle / Program Values (${escapeHtml(sheet.name)})</h5>

              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:12px;">

                ${sheet.headers.slice(5).map((h, offset) => {

                  const colIdx = 5 + offset;

                  const val = cleanVal(row[colIdx]);

                  return `

                    <div class="tp-hist-form-group">

                      <label class="tp-hist-form-label" style="font-size:11px;">${escapeHtml(h || ('Col ' + colIdx))}</label>

                      <input type="text" class="tp-hist-form-input" name="col_${colIdx}" value="${escapeHtml(val)}" />

                    </div>

                  `;

                }).join('')}

              </div>

            </div>



            <div style="display:flex; align-items:center; justify-content:flex-end; gap:12px; padding-top:12px; border-top:1px solid #E2E8F0;">

              <button type="button" class="tp-hist-btn-secondary" onclick="window.HistoricalModule.closeDistrictDrawer()">Cancel</button>

              <button type="submit" class="tp-hist-btn-primary" style="background:#7C3AED; border-color:#7C3AED;">✓ Save Record (Admin)</button>

            </div>

          </form>

        </div>

      </div>

    `;

  }



  function renderExternalAdminEditor(sheet, row, districtName, modalWrap) {

    const currentDm = cleanVal(row[6]);

    const currentPm = cleanVal(row[7]);

    const currentAge = cleanVal(row[8]);

    const currentGrade = cleanVal(row[9]).toUpperCase();

    const currentTarget = cleanVal(row[10]).toUpperCase();



    const yearCols = identifyYearMetricColumns(sheet);



    modalWrap.innerHTML = `

      <div class="tp-hist-modal-overlay" onclick="if(event.target===this)window.HistoricalModule.closeDistrictDrawer()">

        <div class="tp-hist-modal-card" style="max-width: 640px;" role="dialog" aria-modal="true">

          <div class="tp-hist-modal-header" style="background:#FAF5FF; border-bottom:1px solid #E9D5FF;">

            <div>

              <div style="display:flex; align-items:center; gap:8px;">

                <span style="font-size:18px;">👑</span>

                <h3 class="tp-hist-modal-title" style="color:#6B21A8;">IT Admin Record Editor</h3>

              </div>

              <p class="tp-hist-modal-sub">Editing: <strong>${escapeHtml(districtName)}</strong> (${sheet.name})</p>

            </div>

            <button type="button" class="tp-hist-modal-close" onclick="window.HistoricalModule.closeDistrictDrawer()">&times;</button>

          </div>



          <form id="tpAdminEditForm" onsubmit="window.HistoricalModule.handleSaveEdit(event, '${sheet.id}', '${escapeHtml(districtName)}')" style="padding: 24px;">

            <div class="tp-hist-edit-grid">

              <div class="tp-hist-form-group">

                <label class="tp-hist-form-label">Division Manager (DM)</label>

                <input type="text" class="tp-hist-form-input" name="dm" value="${escapeHtml(currentDm)}" required />

              </div>



              <div class="tp-hist-form-group">

                <label class="tp-hist-form-label">Program Manager (PM)</label>

                <input type="text" class="tp-hist-form-input" name="pm" value="${escapeHtml(currentPm)}" required />

              </div>



              <div class="tp-hist-form-group">

                <label class="tp-hist-form-label">Age with District (Months)</label>

                <input type="number" class="tp-hist-form-input" name="age" value="${escapeHtml(currentAge)}" min="0" max="120" />

              </div>



              <div class="tp-hist-form-group">

                <label class="tp-hist-form-label">Achieved Grade (25-26)</label>

                <select class="tp-hist-form-select" name="grade">

                  <option value="A" ${currentGrade === 'A' ? 'selected' : ''}>Grade A</option>

                  <option value="B" ${currentGrade === 'B' ? 'selected' : ''}>Grade B</option>

                  <option value="C" ${currentGrade === 'C' ? 'selected' : ''}>Grade C</option>

                </select>

              </div>



              <div class="tp-hist-form-group">

                <label class="tp-hist-form-label">Target Grade (26-27)</label>

                <select class="tp-hist-form-select" name="targetGrade">

                  <option value="A" ${currentTarget === 'A' ? 'selected' : ''}>Grade A</option>

                  <option value="B" ${currentTarget === 'B' ? 'selected' : ''}>Grade B</option>

                  <option value="C" ${currentTarget === 'C' ? 'selected' : ''}>Grade C</option>

                </select>

              </div>

            </div>



            ${yearCols.length > 0 ? `

              <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:16px; margin-bottom:20px;">

                <h5 style="font-size:12px; font-weight:800; color:#475569; text-transform:uppercase; margin:0 0 10px 0;">Year Metric Values (${escapeHtml(sheet.name)})</h5>

                <div style="display:grid; grid-template-columns: repeat(${yearCols.length}, 1fr); gap:12px;">

                  ${yearCols.map(y => {

                    let val = cleanVal(row[y.colIdx]).replace('%', '').trim();

                    return `

                      <div class="tp-hist-form-group">

                        <label class="tp-hist-form-label">${y.year}</label>

                        <input type="text" class="tp-hist-form-input" name="col_${y.colIdx}" value="${escapeHtml(val)}" placeholder="Value" />

                      </div>

                    `;

                  }).join('')}

                </div>

              </div>

            ` : ''}



            <div style="display:flex; align-items:center; justify-content:flex-end; gap:12px; padding-top:12px; border-top:1px solid #E2E8F0;">

              <button type="button" class="tp-hist-btn-secondary" onclick="window.HistoricalModule.closeDistrictDrawer()">Cancel</button>

              <button type="submit" class="tp-hist-btn-primary" style="background:#7C3AED; border-color:#7C3AED;">✓ Save Record (Admin)</button>

            </div>

          </form>

        </div>

      </div>

    `;

  }



  function handleSaveEdit(event, sheetId, recordKey) {

    event.preventDefault();

    if (!isITAdmin()) {

      alert('Unauthorized');

      return;

    }



    const form = event.target;

    const formData = new FormData(form);



    const isInt = state.dataSource === 'internal';

    const updated = {};



    if (isInt) {

      updated.teamLeader = formData.get('teamLeader');

      updated.mouDate = formData.get('mouDate');

    } else {

      updated.dm = formData.get('dm');

      updated.pm = formData.get('pm');

      updated.age = formData.get('age');

      updated.grade = formData.get('grade');

      updated.targetGrade = formData.get('targetGrade');

    }



    const colValues = {};

    for (let pair of formData.entries()) {

      if (pair[0].startsWith('col_')) {

        const colIdx = pair[0].replace('col_', '');

        colValues[colIdx] = pair[1];

      }

    }

    updated.colValues = colValues;



    saveEditRecord(sheetId, recordKey, updated);

    closeDistrictDrawer();

    renderHeader();

    renderControls();

    renderMain();

  }



  // -------------------------------------------------------------

  // HELPER UTILITIES

  // -------------------------------------------------------------

  function filterRows(rows) {
    if (!rows) return [];
    const isExt = state.dataSource === 'external';

    // Separate normal district rows from total/summary rows
    const normalRows = rows.filter(r => !isTotalRow(r) && (cleanVal(r[2]) !== '' || cleanVal(r[0]) !== ''));
    const totalRows = rows.filter(r => isTotalRow(r));

    const filteredNormal = normalRows.filter(r => {
      // 1. State Filter
      if (state.stateFilter !== 'ALL') {
        const st = (isExt ? cleanVal(r[2]) : cleanVal(r[1])).toUpperCase();
        if (st !== state.stateFilter) {
          const inFirst3 = [r[0], r[1], r[2], r[3]].some(c => cleanVal(c).toUpperCase() === state.stateFilter);
          if (!inFirst3) return false;
        }
      }

      // 2. District Filter
      if (state.districtFilter && state.districtFilter !== 'ALL') {
        const targetDist = state.districtFilter.toLowerCase();
        const d1 = isExt ? cleanVal(r[5]).toLowerCase() : cleanVal(r[2]).toLowerCase();
        const d2 = cleanVal(r[0]).toLowerCase();
        if (!d1.includes(targetDist) && !d2.includes(targetDist)) {
          return false;
        }
      }

      // 3. Person / Leader Filter (DM / PM / PO / TL)
      if (state.personFilter && state.personFilter !== 'ALL') {
        const targetPerson = state.personFilter.toLowerCase();
        const matchesPerson = isExt
          ? (cleanVal(r[6]).toLowerCase().includes(targetPerson) || cleanVal(r[7]).toLowerCase().includes(targetPerson))
          : (cleanVal(r[4]).toLowerCase().includes(targetPerson) || r.some(c => cleanVal(c).toLowerCase().includes(targetPerson)));
        if (!matchesPerson) return false;
      }

      // 4. Free text Search
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        const matches = r.some(cell => cleanVal(cell).toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });

    const hasActiveFilters = state.stateFilter !== 'ALL' || (state.districtFilter && state.districtFilter !== 'ALL') || (state.personFilter && state.personFilter !== 'ALL') || Boolean(state.searchQuery);

    // When no filters are active, Total rows are placed STRICTLY at the very last
    if (!hasActiveFilters && totalRows.length > 0) {
      return [...filteredNormal, ...totalRows];
    }

    return filteredNormal;
  }



  function identifyYearMetricColumns(sheet) {

    const list = [];

    const superH = sheet.superHeaders || [];

    const headers = sheet.headers || [];



    const years = ['22-23', '23-24', '24-25', '25-26'];

    years.forEach(yr => {

      let foundIdx = -1;

      let label = '';

      superH.forEach((sh, idx) => {

        if (foundIdx !== -1) return;

        if (idx < 11) return;

        if (sh && sh.includes(yr)) {

          let j = idx;

          let candidateIdx = -1;

          let candidateLabel = '';

          while (j < headers.length && (!superH[j] || superH[j].includes(yr) || j === idx)) {

            const h = cleanVal(headers[j]);

            // First priority: percentage, rate, score (e.g. Pass %, NIPUN %, Score)

            if (h.includes('%') || h.toLowerCase().includes('rate') || h.toLowerCase().includes('score')) {

              candidateIdx = j;

              candidateLabel = h;

              break;

            }

            // Second priority: pass count / posts / events

            if (candidateIdx === -1 && (h.includes('Passed') || h.includes('Pass') || h === 'Posts' || h.includes('Events'))) {

              candidateIdx = j;

              candidateLabel = h;

            }

            j++;

          }

          if (candidateIdx !== -1) {

            foundIdx = candidateIdx;

            label = candidateLabel;

          } else {

            foundIdx = idx;

            label = headers[idx] || yr;

          }

        }

      });



      if (foundIdx !== -1) {

        list.push({ year: yr, colIdx: foundIdx, label });

      }

    });



    return list;

  }



  function buildSuperHeaderGroups(superH, headers) {

    const groups = [];

    const totalCols = headers.length;

    if (!superH || !superH.some(x => cleanVal(x) !== '')) {

      return [{ title: 'All Columns', colspan: totalCols, isGroup: false }];

    }



    let firstSuperIdx = superH.findIndex((s, idx) => idx > 0 && cleanVal(s) !== '');

    if (firstSuperIdx === -1) {

      firstSuperIdx = Math.min(6, totalCols);

    }



    if (firstSuperIdx > 0) {

      groups.push({ title: 'Baseline Metadata', colspan: firstSuperIdx, isGroup: false });

    }



    let i = firstSuperIdx;

    while (i < totalCols) {

      let title = cleanVal(superH[i]) || 'Metrics';

      let count = 1;

      let j = i + 1;

      while (j < totalCols && !cleanVal(superH[j])) {

        count++;

        j++;

      }

      groups.push({ title, colspan: count, isGroup: true });

      i = j;

    }



    return groups;

  }



  function downloadCsv(sheetId) {

    const sheet = getSheet(sheetId);

    if (!sheet) return;



    const rows = [sheet.headers, ...sheet.rows];

    const csvContent = "data:text/csv;charset=utf-8," + 

      rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);

    const link = document.createElement("a");

    link.setAttribute("href", encodedUri);

    link.setAttribute("download", `${sheet.id}_historical_export.csv`);

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

  }



  function escapeHtml(str) {

    if (!str) return '';

    return String(str)

      .replace(/&/g, '&amp;')

      .replace(/</g, '&lt;')

      .replace(/>/g, '&gt;')

      .replace(/"/g, '&quot;')

      .replace(/'/g, '&#39;');

  }



  // Public Interface



  // Self-contained XLSX Loader for generating multi-sheet workbooks

  let _historicalXlsxPromise = null;

  function loadXLSX() {

    if (window.XLSX) return Promise.resolve(window.XLSX);

    if (_historicalXlsxPromise) return _historicalXlsxPromise;

    _historicalXlsxPromise = new Promise((resolve, reject) => {

      const s = document.createElement('script');

      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

      s.onload = () => resolve(window.XLSX);

      s.onerror = (e) => reject(e);

      document.head.appendChild(s);

    });

    return _historicalXlsxPromise;

  }



  // 3. Whole Workbook Download (.xlsx)

  async function downloadFullWorkbook() {

    const isInt = state.dataSource === 'internal';

    const data = getData();

    const sheets = data.sheets || [];

    const filename = isInt

      ? `OLF_Internal_Academic_Outcomes_2025-26_${new Date().toISOString().slice(0, 10)}.xlsx`

      : `OLF_External_Historical_Benchmarks_2022-26_${new Date().toISOString().slice(0, 10)}.xlsx`;



    try {

      const XLSX = await loadXLSX();

      const wb = XLSX.utils.book_new();



      sheets.forEach(s => {

        const enriched = enrichSheetColumns(s);

        const wsRows = [];

        if (enriched.superHeaders && enriched.superHeaders.some(Boolean)) {

          wsRows.push(enriched.superHeaders);

        }

        wsRows.push(enriched.headers);

        enriched.rows.forEach(r => wsRows.push(r));



        const ws = XLSX.utils.aoa_to_sheet(wsRows);

        const cleanName = s.name.replace(/[:\\/?*\[\]]/g, '').slice(0, 31);

        XLSX.utils.book_append_sheet(wb, ws, cleanName);

      });



      XLSX.writeFile(wb, filename);

    } catch (err) {

      console.warn('XLSX library load failed, downloading active sheet as CSV:', err);

      downloadCsv(state.activeSheetId);

    }

  }



  // 4. Filtered PDF Generation & Download

  function exportFilteredPdf() {

    const isInt = state.dataSource === 'internal';

    const sheet = getSheet(state.activeSheetId);

    if (!sheet) return;



    const filteredRows = filterRows(sheet.rows);

    const title = isInt

      ? `Internal Academic Outcomes (2025–26) - ${sheet.name}`

      : `External Longitudinal Benchmarks (2022–26) - ${sheet.name}`;



    const printHtml = `

      <!DOCTYPE html>

      <html>

      <head>

        <title>${escapeHtml(title)}</title>

        <style>

          @page { size: A4 landscape; margin: 8mm; }

          body { font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; margin: 0; padding: 12px; color: #0F172A; }

          .print-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284C7; padding-bottom: 10px; margin-bottom: 12px; }

          .print-title { font-size: 16px; font-weight: 800; color: #0F172A; margin: 0; }

          .print-subtitle { font-size: 11px; color: #64748B; margin: 3px 0 0 0; }

          .print-filters { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; font-size: 10px; }

          .print-badge { background: #F1F5F9; border: 1px solid #CBD5E1; padding: 2px 7px; border-radius: 4px; font-weight: 600; }

          table { width: 100%; border-collapse: collapse; font-size: 9px; }

          th, td { border: 1px solid #CBD5E1; padding: 4px 6px; text-align: left; }

          th { background: #F8FAFC; font-weight: 700; color: #334155; }

          .num { text-align: right; font-family: monospace; }

          .footer { margin-top: 12px; font-size: 9px; color: #94A3B8; display: flex; justify-content: space-between; }

        </style>

      </head>

      <body>

        <div class="print-header">

          <div>

            <h1 class="print-title">Open Links Foundation &middot; Academic Performance Report</h1>

            <p class="print-subtitle">${escapeHtml(title)} &middot; Filtered Export</p>

          </div>

          <div style="text-align:right;">

            <div style="font-size:11px; font-weight:700; color:#0284C7;">Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>

            <div style="font-size:10px; color:#64748B;">Records: ${filteredRows.length} districts</div>

          </div>

        </div>



        <div class="print-filters">

          <span class="print-badge">Dataset: ${isInt ? 'Internal (2025–26)' : 'External (2022–26)'}</span>

          <span class="print-badge">State: ${state.stateFilter}</span>

          ${state.districtFilter !== 'ALL' ? `<span class="print-badge">District: ${escapeHtml(state.districtFilter)}</span>` : ''}

          ${state.personFilter !== 'ALL' ? `<span class="print-badge">Leader: ${escapeHtml(state.personFilter)}</span>` : ''}

          ${state.searchQuery ? `<span class="print-badge">Search: "${escapeHtml(state.searchQuery)}"</span>` : ''}

        </div>



        <table>

          <thead>

            <tr>

              ${sheet.headers.slice(0, 14).map(h => `<th>${escapeHtml(h)}</th>`).join('')}

            </tr>

          </thead>

          <tbody>

            ${filteredRows.length === 0 ? `<tr><td colspan="${Math.min(14, sheet.headers.length)}" style="text-align:center; padding:20px;">No matching records.</td></tr>` : ''}

            ${filteredRows.map(r => `

              <tr>

                ${sheet.headers.slice(0, 14).map((h, i) => `<td class="${i >= 4 ? 'num' : ''}">${escapeHtml(r[i] || '—')}</td>`).join('')}

              </tr>

            `).join('')}

          </tbody>

        </table>



        <div class="footer">

          <span>Open Links Foundation &middot; Confidential Internal Document</span>

          <span>Page 1 of 1</span>

        </div>

      </body>

      </html>

    `;



    // Use hidden iframe to avoid popup blockers

    let iframe = document.getElementById('tpPrintIframe');

    if (!iframe) {

      iframe = document.createElement('iframe');

      iframe.id = 'tpPrintIframe';

      iframe.style.position = 'fixed';

      iframe.style.right = '0';

      iframe.style.bottom = '0';

      iframe.style.width = '0';

      iframe.style.height = '0';

      iframe.style.border = '0';

      document.body.appendChild(iframe);

    }



    const doc = iframe.contentWindow.document;

    doc.open();

    doc.write(printHtml);

    doc.close();



    setTimeout(() => {

      iframe.contentWindow.focus();

      iframe.contentWindow.print();

    }, 400);

  }



  window.HistoricalModule = {

    init,

    setDataSource: function(ds) {

      state.dataSource = ds;

      if (ds === 'internal') {

        state.activeSheetId = 'academic-cycle';

        state.programFocus = 'academic-cycle';

      } else {

        state.activeSheetId = 'class-10';

        state.programFocus = 'class-10';

      }

      state.searchQuery = '';

      state.stateFilter = 'ALL';





      renderHeader();

      renderControls();

      renderMain();

    },

    setMode: function(m) {

      state.mode = m;

      renderControls();

      renderMain();

    },

    setStateFilter: function(st) {

      state.stateFilter = st;

      renderControls();

      renderMain();

    },

    selectSheet: function(sheetId) {

      state.activeSheetId = sheetId;

      state.programFocus = sheetId;



      const scrollEl = document.querySelector('.tp-hist-tabs-scroll');

      if (scrollEl) {

        const tabs = scrollEl.querySelectorAll('.tp-hist-sheet-tab');

        let matched = false;

        tabs.forEach(tab => {

          if (tab.getAttribute('data-sheet-id') === sheetId) {

            tab.classList.add('active');

            tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });

            matched = true;

          } else {

            tab.classList.remove('active');

          }

        });

        if (!matched) {

          renderControls();

        }

      } else {

        renderControls();

      }

      renderMain();

    },

    setDistrictFilter: function(dist) {

      state.districtFilter = dist;

      renderControls();

      renderMain();

    },

    setPersonFilter: function(person) {

      state.personFilter = person;

      renderControls();

      renderMain();

    },

    downloadFullWorkbook,

    exportFilteredPdf,

    resetAllFilters: function() {

      state.stateFilter = 'ALL';

      state.districtFilter = 'ALL';

      state.personFilter = 'ALL';

      state.searchQuery = '';

      renderControls();

      renderMain();

    },

    onSearch: function(q) {

      state.searchQuery = q;

      renderMain();

    },

    clearSearch: function() {

      state.searchQuery = '';

      renderControls();

      renderMain();

    },

    downloadCsv,

    openDistrictDrawer,

    closeDistrictDrawer,

    openAdminEditor,

    handleSaveEdit,

    isITAdmin

  };



  document.addEventListener('DOMContentLoaded', function() {

    const histView = document.getElementById('tpHistoricalView');

    if (histView && histView.style.display !== 'none') {

      init();

    }

  });



})();

