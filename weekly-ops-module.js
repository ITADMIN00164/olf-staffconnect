/**
 * Weekly OPS Module for OLF StaffConnect (OLF Insight)
 * Replicates the HO Plan & Review -> Monthly Plan form-like theme
 * Extracted from "Ops Weekly" sheet in Weekly & CAT 26-27 - Master.xlsx
 *
 * RBAC Rules:
 * - View: ALL users can view all records.
 * - Edit: IT Admin can edit/delete all records.
 *         Regular users / PMs can ONLY edit/delete their own data (where PM matches user).
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'olf_weekly_ops_overrides_v1';

  // State & Filters
  let state = {
    year: '2026-27',
    month: 'All',
    stateCode: 'All',
    district: 'All',
    pm: 'All',
    week: 'All',
    status: 'All',
    search: '',
    page: 1,
    pageSize: 50,
    initialized: false
  };

  // Cached data lists
  let allPlans = [];
  let overrides = {}; // id -> { status, remarks, isDeleted, isNew, ... }

  // Status definitions with colors matching Monthly Plan badges
  const STATUS_CONFIG = {
    'Planned': { label: 'Planned', color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE' },
    'In Process': { label: 'In Process', color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
    'Completed': { label: 'Completed', color: '#059669', bg: '#D1FAE5', border: '#A7F3D0' },
    'Postponed': { label: 'Postponed', color: '#2563EB', bg: '#DBEAFE', border: '#BFDBFE' },
    'Pending': { label: 'Pending', color: '#DC2626', bg: '#FEE2E2', border: '#FECACA' },
    'Cancelled': { label: 'Cancelled', color: '#4B5563', bg: '#F3F4F6', border: '#E5E7EB' }
  };

  const MONTH_ORDER = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

  // --- User Identity & RBAC ---
  function getCurrentUser() {
    if (window.__olfUser && window.__olfUser.email) {
      return {
        email: String(window.__olfUser.email || '').trim().toLowerCase(),
        name: String(window.__olfUser.displayName || window.__olfUser.name || '').trim(),
        role: window.__olfUser.role || 'User'
      };
    }
    if (window.__olfEmployee && window.__olfEmployee.email) {
      return {
        email: String(window.__olfEmployee.email || '').trim().toLowerCase(),
        name: String(window.__olfEmployee.name || '').trim(),
        role: window.__olfEmployee.role || 'User'
      };
    }
    try {
      const sim = localStorage.getItem('olf_smart_goals_simulated_user');
      if (sim) {
        const parsed = JSON.parse(sim);
        return {
          email: String(parsed.email || '').trim().toLowerCase(),
          name: String(parsed.displayName || parsed.name || '').trim(),
          role: parsed.role || 'User'
        };
      }
    } catch (e) {}
    return { email: '', name: '', role: 'User' };
  }

  function isITAdmin() {
    try {
      if (window.TeamPerformance && typeof window.TeamPerformance.isCurrentUserAdmin === 'function') {
        if (window.TeamPerformance.isCurrentUserAdmin()) return true;
      }
      const user = getCurrentUser();
      if (user && (user.role === 'Admin' || user.email === 'admin@openlinksfoundation.org')) {
        return true;
      }
    } catch (e) {
      console.warn('isITAdmin check error:', e);
    }
    return false;
  }

  function canEditItem(item) {
    if (!item) return false;
    // 1. IT Admin can edit all records
    if (isITAdmin()) return true;

    // 2. Regular users can only edit their own records
    const user = getCurrentUser();
    if (!user.name && !user.email) return false;

    const itemPm = String(item.pm || '').trim().toLowerCase();
    if (!itemPm) return false;

    // Match by display name or first name
    const userName = user.name.toLowerCase();
    if (userName) {
      if (itemPm === userName) return true;
      const userFirst = userName.split(/\s+/)[0];
      if (userFirst && itemPm === userFirst) return true;
      if (userName.includes(itemPm) || itemPm.includes(userName)) return true;
    }

    // Match by email prefix: e.g. "bharat@openlinksfoundation.org" matches PM "Bharat"
    if (user.email) {
      const emailPrefix = user.email.split('@')[0].toLowerCase();
      if (emailPrefix === itemPm || emailPrefix.includes(itemPm) || itemPm.includes(emailPrefix)) return true;
    }

    return false;
  }

  function loadOverrides() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      overrides = raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn('Failed to parse weekly ops overrides:', e);
      overrides = {};
    }
  }

  function saveOverrides() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    } catch (e) {
      console.warn('Failed to save weekly ops overrides:', e);
    }
  }

  function getMergedData() {
    const rawMaster = window.OLF_WEEKLY_OPS_DATA || [];
    const result = [];

    // Master items with overrides
    for (const item of rawMaster) {
      const ov = overrides[item.id];
      if (ov && ov.isDeleted) continue;
      
      const merged = Object.assign({}, item);
      if (ov) {
        if (ov.state !== undefined) merged.state = ov.state;
        if (ov.pm !== undefined) merged.pm = ov.pm;
        if (ov.district !== undefined) merged.district = ov.district;
        if (ov.year !== undefined) merged.year = ov.year;
        if (ov.month !== undefined) merged.month = ov.month;
        if (ov.week !== undefined) merged.week = ov.week;
        if (ov.meetingPlan !== undefined) merged.meetingPlan = ov.meetingPlan;
        if (ov.supportFrom !== undefined) merged.supportFrom = ov.supportFrom;
        if (ov.supportWhat !== undefined) merged.supportWhat = ov.supportWhat;
        if (ov.deadline !== undefined) merged.deadline = ov.deadline;
        if (ov.status !== undefined) merged.status = ov.status;
        if (ov.remarks !== undefined) merged.remarks = ov.remarks;
      }
      result.push(merged);
    }

    // Custom newly added items
    for (const key of Object.keys(overrides)) {
      const ov = overrides[key];
      if (ov && ov.isNew && !ov.isDeleted) {
        result.unshift(ov);
      }
    }

    return result;
  }

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function cleanPlanText(s) {
    if (s == null) return '';
    const norm = String(s).replace(/\u2011/g, '-').replace(/\u00A0/g, ' ');
    return esc(norm);
  }

  function formatDate(dStr) {
    if (!dStr) return '—';
    try {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        const y = parts[0], m = parseInt(parts[1], 10) - 1, d = parts[2];
        const date = new Date(y, m, d);
        if (!isNaN(date.getTime())) {
          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          return `${d}-${months[m]}-${y.slice(-2)}`;
        }
      }
      return dStr;
    } catch {
      return dStr;
    }
  }

  // Load XLSX if needed
  let xlsxPromise = null;
  function ensureXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (xlsxPromise) return xlsxPromise;
    xlsxPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = () => resolve(window.XLSX);
      s.onerror = () => reject(new Error('Failed to load SheetJS XLSX library'));
      document.head.appendChild(s);
    });
    return xlsxPromise;
  }

  // --- Initializer ---
  function init() {
    const root = document.getElementById('tpWeeklyOpsView');
    if (!root) return;

    loadOverrides();
    allPlans = getMergedData();

    if (!state.initialized) {
      injectStyles();
      renderLayout(root);
      state.initialized = true;
    }

    updateDropdownOptions();
    renderFiltered();
  }

  // --- Inject CSS Theme Styles ---
  function injectStyles() {
    if (document.getElementById('tpWeeklyOpsStyles')) return;
    const style = document.createElement('style');
    style.id = 'tpWeeklyOpsStyles';
    style.textContent = `
      #tpWeeklyOpsView {
        padding: 0 16px 40px;
        color: #1E293B;
        font-family: inherit;
      }
      
      /* KPI Summary Ribbon */
      .tp-wops-kpi-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }
      .tp-wops-kpi-card {
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-radius: 12px;
        padding: 12px 14px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .tp-wops-kpi-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.06);
      }
      .tp-wops-kpi-label {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #64748B;
        margin-bottom: 4px;
      }
      .tp-wops-kpi-val {
        font-size: 20px;
        font-weight: 800;
        color: #0F172A;
        line-height: 1.2;
      }
      .tp-wops-kpi-sub {
        font-size: 11px;
        color: #94A3B8;
        margin-top: 4px;
      }
      
      /* Filter Bar - HO Monthly Plan Style */
      .tp-wops-filter-bar {
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-radius: 14px;
        padding: 12px 16px;
        margin-bottom: 16px;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      }
      .tp-wops-filter-bar select,
      .tp-wops-filter-bar input[type="text"] {
        height: 38px;
        padding: 0 12px;
        border: 1px solid #CBD5E1;
        border-radius: 9px;
        font-size: 13px;
        font-family: inherit;
        color: #0F172A;
        background-color: #F8FAFC;
        transition: all 0.15s ease;
        outline: none;
      }
      .tp-wops-filter-bar select:hover,
      .tp-wops-filter-bar input[type="text"]:hover {
        border-color: #94A3B8;
        background-color: #FFFFFF;
      }
      .tp-wops-filter-bar select:focus,
      .tp-wops-filter-bar input[type="text"]:focus {
        border-color: #2563EB;
        background-color: #FFFFFF;
        box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
      }
      .tp-wops-filter-bar select {
        cursor: pointer;
        font-weight: 500;
      }
      .tp-wops-search-input {
        min-width: 220px;
        flex: 1;
      }
      
      .tp-wops-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-left: auto;
      }
      
      .tp-wops-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 38px;
        padding: 0 14px;
        font-size: 13px;
        font-weight: 600;
        font-family: inherit;
        border-radius: 9px;
        cursor: pointer;
        transition: all 0.15s ease;
        white-space: nowrap;
        border: 1px solid transparent;
      }
      .tp-wops-btn-secondary {
        background: #FFFFFF;
        color: #334155;
        border-color: #CBD5E1;
      }
      .tp-wops-btn-secondary:hover {
        background: #F8FAFC;
        border-color: #94A3B8;
        color: #0F172A;
      }
      .tp-wops-btn-primary {
        background: linear-gradient(135deg, #2563EB, #1D4ED8);
        color: #FFFFFF;
        box-shadow: 0 2px 6px rgba(37,99,235,0.25);
      }
      .tp-wops-btn-primary:hover {
        background: linear-gradient(135deg, #1D4ED8, #1E40AF);
        box-shadow: 0 4px 10px rgba(37,99,235,0.35);
      }
      .tp-wops-btn-reset {
        color: #64748B;
        background: transparent;
        border-color: transparent;
        font-size: 12px;
        height: 32px;
        padding: 0 8px;
        cursor: pointer;
      }
      .tp-wops-btn-reset:hover {
        color: #DC2626;
      }
      


      /* Table Container */
      .tp-wops-tbl-wrap {
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-radius: 14px;
        overflow: auto;
        max-height: 68vh;
        min-height: 300px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.04);
        position: relative;
      }
      .tp-wops-tbl {
        width: 100%;
        min-width: 1650px;
        border-collapse: separate;
        border-spacing: 0;
        font-size: 12.5px;
        table-layout: fixed;
      }
      .tp-wops-tbl th,
      .tp-wops-tbl td {
        box-sizing: border-box;
      }
      
      /* Group Headers (Tier 1) */
      .tp-wops-tbl .grp-hd th {
        height: 32px;
        line-height: 32px;
        padding: 0 12px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        position: sticky;
        top: 0;
        z-index: 5;
        border-bottom: none;
        text-align: center;
      }
      .tp-wops-tbl .grp-hd .g-plan {
        background: #2457C5;
        color: #FFFFFF;
      }
      .tp-wops-tbl .grp-hd .g-status {
        background: #0B8F7A;
        color: #FFFFFF;
      }
      .tp-wops-tbl .grp-hd .g-act {
        background: #334155;
        color: #FFFFFF;
      }

      /* Column Headers (Tier 2) */
      .tp-wops-tbl .col-hd th {
        height: 34px;
        line-height: 16px;
        padding: 9px 10px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        position: sticky;
        top: 31px;
        z-index: 4;
        text-align: left;
        white-space: nowrap;
        border-bottom: 2px solid #CBD5E1;
      }
      .tp-wops-tbl .col-hd .h-plan {
        background: #3A6FD1;
        color: #E4EDFF;
      }
      .tp-wops-tbl .col-hd .h-status {
        background: #0D9488;
        color: #CCFBF1;
      }
      .tp-wops-tbl .col-hd .h-act {
        background: #475569;
        color: #F1F5F9;
        text-align: center;
      }

      /* Table Rows */
      .tp-wops-tbl tbody tr {
        border-bottom: 1px solid #E2E8F0;
        transition: background-color 0.1s ease;
      }
      .tp-wops-tbl tbody tr:nth-child(even) {
        background-color: #FAFCFF;
      }
      .tp-wops-tbl tbody tr:hover {
        background-color: #F1F5F9;
      }
      
      /* Explicitly override index.html global td { white-space: nowrap } */
      .tp-wops-tbl td {
        padding: 9px 10px;
        vertical-align: top;
        font-size: 12px;
        line-height: 1.45;
        color: #334155;
        white-space: normal !important;
        overflow-wrap: break-word !important;
        word-break: break-word !important;
      }
      .tp-wops-tbl td * {
        white-space: normal;
      }
      .tp-wops-tbl td .tp-wops-chip,
      .tp-wops-tbl td .tp-wops-chip-date,
      .tp-wops-tbl td .tp-wops-status-select {
        white-space: nowrap !important;
      }
      
      /* Subtle column background tinting */
      .tp-wops-tbl td.c-plan {
        background-color: transparent;
      }
      .tp-wops-tbl td.c-status {
        background-color: rgba(13, 148, 136, 0.03);
      }
      .tp-wops-tbl td.c-act {
        text-align: center;
        vertical-align: middle;
      }

      /* Badges & Chips */
      .tp-wops-chip {
        display: inline-block;
        padding: 3px 8px;
        font-size: 11px;
        font-weight: 600;
        border-radius: 6px;
        background: #EEF2F6;
        color: #334155;
        white-space: nowrap;
      }
      .tp-wops-chip-state {
        background: #E0E7FF;
        color: #3730A3;
        font-weight: 700;
      }
      .tp-wops-chip-week {
        background: #F1F5F9;
        color: #0F172A;
        font-weight: 700;
        border: 1px solid #E2E8F0;
      }
      .tp-wops-chip-date {
        font-family: inherit;
        font-size: 11.5px;
        color: #475569;
        background: #F8FAFC;
        border: 1px solid #E2E8F0;
        padding: 2px 7px;
        border-radius: 6px;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      
      /* Form-like Controls inside Table Cells */
      .tp-wops-status-select {
        width: 100%;
        padding: 5px 8px;
        font-size: 11.5px;
        font-weight: 700;
        border-radius: 6px;
        border: 1px solid #CBD5E1;
        outline: none;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .tp-wops-status-select:focus {
        box-shadow: 0 0 0 2px rgba(37,99,235,0.2);
        border-color: #2563EB;
      }
      .tp-wops-remarks-input {
        width: 100%;
        padding: 5px 8px;
        font-size: 12px;
        font-family: inherit;
        border-radius: 6px;
        border: 1px solid #CBD5E1;
        background: #FFFFFF;
        color: #0F172A;
        outline: none;
        transition: all 0.15s ease;
      }
      .tp-wops-remarks-input:hover {
        border-color: #94A3B8;
      }
      .tp-wops-remarks-input:focus {
        border-color: #0D9488;
        box-shadow: 0 0 0 2px rgba(13,148,136,0.18);
        background: #FFFFFF;
      }
      
      /* Action Buttons */
      .tp-wops-action-btn {
        background: transparent;
        border: 1px solid transparent;
        color: #64748B;
        cursor: pointer;
        padding: 4px 6px;
        border-radius: 6px;
        transition: all 0.15s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }
      .tp-wops-edit-btn:hover {
        color: #2563EB;
        background: #EFF6FF;
        border-color: #BFDBFE;
      }
      .tp-wops-del-btn:hover {
        color: #DC2626;
        background: #FEE2E2;
        border-color: #FECACA;
      }

      /* Pagination Strip */
      .tp-wops-pagination {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-top: none;
        border-bottom-left-radius: 14px;
        border-bottom-right-radius: 14px;
        font-size: 13px;
        color: #64748B;
      }
      .tp-wops-pg-controls {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .tp-wops-pg-btn {
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 600;
        border-radius: 6px;
        border: 1px solid #CBD5E1;
        background: #FFFFFF;
        color: #334155;
        cursor: pointer;
      }
      .tp-wops-pg-btn:hover:not(:disabled) {
        background: #F1F5F9;
        color: #0F172A;
      }
      .tp-wops-pg-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      
      /* Empty state */
      .tp-wops-empty {
        text-align: center;
        padding: 48px 20px;
        color: #64748B;
      }
      .tp-wops-empty-icon {
        font-size: 36px;
        margin-bottom: 8px;
      }

      /* Modal Styling */
      .tp-wops-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.5);
        backdrop-filter: blur(2px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 20px;
      }
      .tp-wops-modal-box {
        background: #FFFFFF;
        width: 100%;
        max-width: 680px;
        border-radius: 16px;
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
        overflow: hidden;
        animation: tpWopsPop 0.2s ease-out;
      }
      @keyframes tpWopsPop {
        from { transform: scale(0.96); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      .tp-wops-modal-header {
        padding: 16px 20px;
        background: linear-gradient(135deg, #1E3A8A, #2563EB);
        color: #FFFFFF;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .tp-wops-modal-title {
        font-size: 16px;
        font-weight: 700;
        margin: 0;
      }
      .tp-wops-modal-close {
        background: transparent;
        border: none;
        color: #FFFFFF;
        font-size: 20px;
        cursor: pointer;
        opacity: 0.8;
      }
      .tp-wops-modal-close:hover { opacity: 1; }
      .tp-wops-modal-body {
        padding: 20px;
        max-height: 75vh;
        overflow-y: auto;
      }
      .tp-wops-form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }
      .tp-wops-field-full {
        grid-column: span 2;
      }
      .tp-wops-form-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .tp-wops-form-group label {
        font-size: 12px;
        font-weight: 600;
        color: #334155;
      }
      .tp-wops-form-group input,
      .tp-wops-form-group select,
      .tp-wops-form-group textarea {
        padding: 8px 10px;
        font-size: 13px;
        font-family: inherit;
        border: 1px solid #CBD5E1;
        border-radius: 8px;
        outline: none;
      }
      .tp-wops-form-group input:focus,
      .tp-wops-form-group select:focus,
      .tp-wops-form-group textarea:focus {
        border-color: #2563EB;
        box-shadow: 0 0 0 2px rgba(37,99,235,0.15);
      }
      .tp-wops-modal-footer {
        padding: 14px 20px;
        background: #F8FAFC;
        border-top: 1px solid #E2E8F0;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `;
    document.head.appendChild(style);
  }

  // --- Render Layout Elements ---
  function renderLayout(container) {


    container.innerHTML = `
      <!-- KPI Metric Summary -->
      <div id="tpWopsKpis" class="tp-wops-kpi-row"></div>

      <!-- Filter Controls Strip -->
      <div class="tp-wops-filter-bar">
        <select id="wopsYearFilter" onchange="window.WeeklyOpsModule.onFilterChange('year', this.value)" title="Academic Year">
          <option value="2026-27">FY 2026-27</option>
          <option value="All">All Years</option>
        </select>

        <select id="wopsMonthFilter" onchange="window.WeeklyOpsModule.onFilterChange('month', this.value)" title="Month">
          <option value="All">All Months</option>
        </select>

        <select id="wopsStateFilter" onchange="window.WeeklyOpsModule.onFilterChange('stateCode', this.value)" title="State">
          <option value="All">All States</option>
        </select>

        <select id="wopsDistrictFilter" onchange="window.WeeklyOpsModule.onFilterChange('district', this.value)" title="District">
          <option value="All">All Districts</option>
        </select>

        <select id="wopsPmFilter" onchange="window.WeeklyOpsModule.onFilterChange('pm', this.value)" title="Project Manager">
          <option value="All">All PMs</option>
        </select>

        <select id="wopsWeekFilter" onchange="window.WeeklyOpsModule.onFilterChange('week', this.value)" title="Week">
          <option value="All">All Weeks</option>
        </select>

        <select id="wopsStatusFilter" onchange="window.WeeklyOpsModule.onFilterChange('status', this.value)" title="Status">
          <option value="All">All Status</option>
          <option value="Planned">Planned</option>
          <option value="In Process">In Process</option>
          <option value="Completed">Completed</option>
          <option value="Postponed">Postponed</option>
          <option value="Pending">Pending</option>
          <option value="Cancelled">Cancelled</option>
        </select>

        <input type="text" id="wopsSearchInput" class="tp-wops-search-input" placeholder="Search meeting plans, district, PM, remarks..." oninput="window.WeeklyOpsModule.onSearch(this.value)" />

        <div class="tp-wops-actions">
          

          <button type="button" class="tp-wops-btn tp-wops-btn-secondary" onclick="window.WeeklyOpsModule.exportExcel()" title="Export current filtered view to Excel">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Excel
          </button>
          <button type="button" class="tp-wops-btn tp-wops-btn-primary" onclick="window.WeeklyOpsModule.openAddModal()" title="Add a new weekly meeting plan">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Add Plan
          </button>
          <button type="button" class="tp-wops-btn-reset" onclick="window.WeeklyOpsModule.resetFilters()" title="Reset all filters">
            Reset Filters
          </button>
        </div>
      </div>

      <!-- Main Two-Tier Table -->
      <div class="tp-wops-tbl-wrap">
        <table class="tp-wops-tbl" id="tpWopsTable">
          <colgroup>
            <col style="width: 60px;">   <!-- State -->
            <col style="width: 100px;">  <!-- PM -->
            <col style="width: 110px;">  <!-- District -->
            <col style="width: 70px;">   <!-- Month -->
            <col style="width: 75px;">   <!-- Week -->
            <col style="width: 420px;">  <!-- Weekly Meeting Plans -->
            <col style="width: 130px;">  <!-- Support From -->
            <col style="width: 140px;">  <!-- Support (What?) -->
            <col style="width: 105px;">  <!-- Deadline -->
            <col style="width: 135px;">  <!-- Status -->
            <col style="width: 240px;">  <!-- Remarks -->
            <col style="width: 78px;">   <!-- Action (Edit + Delete) -->
          </colgroup>
          <thead>
            <!-- Group Header Tier 1 -->
            <tr class="grp-hd">
              <th class="g-plan" colspan="9">PLAN</th>
              <th class="g-status" colspan="2">STATUS UPDATE</th>
              <th class="g-act" colspan="1">ACTION</th>
            </tr>
            <!-- Column Header Tier 2 -->
            <tr class="col-hd">
              <th class="h-plan">State</th>
              <th class="h-plan">PM</th>
              <th class="h-plan">District</th>
              <th class="h-plan">Month</th>
              <th class="h-plan">Week</th>
              <th class="h-plan">Weekly Meeting Plans</th>
              <th class="h-plan">Support From</th>
              <th class="h-plan">Support (What?)</th>
              <th class="h-plan">Deadline</th>
              <th class="h-status">Status</th>
              <th class="h-status">Remarks</th>
              <th class="h-act">Action</th>
            </tr>
          </thead>
          <tbody id="tpWopsTbody">
            <!-- Dynamic rows -->
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div class="tp-wops-pagination" id="tpWopsPagination">
        <div id="tpWopsPageInfo">Showing 0 of 0 plans</div>
        <div class="tp-wops-pg-controls">
          <span>Rows per page:</span>
          <select id="wopsPageSizeSelect" onchange="window.WeeklyOpsModule.setPageSize(this.value)" style="padding: 2px 6px; border-radius: 6px; border: 1px solid #CBD5E1; font-size: 12px;">
            <option value="25">25</option>
            <option value="50" selected>50</option>
            <option value="100">100</option>
            <option value="250">250</option>
            <option value="All">All</option>
          </select>
          <button type="button" class="tp-wops-pg-btn" id="wopsPrevBtn" onclick="window.WeeklyOpsModule.prevPage()">Previous</button>
          <span id="wopsCurrentPage" style="font-weight: 700; color: #0F172A; padding: 0 4px;">1</span>
          <button type="button" class="tp-wops-pg-btn" id="wopsNextBtn" onclick="window.WeeklyOpsModule.nextPage()">Next</button>
        </div>
      </div>

      <!-- Add / Edit Plan Modal Container -->
      <div id="tpWopsModalContainer"></div>
    `;
  }

  // --- Populate Filter Dropdowns dynamically ---
  function updateDropdownOptions() {
    const rawData = allPlans;

    // Months
    const monthSelect = document.getElementById('wopsMonthFilter');
    if (monthSelect) {
      const distinctMonths = Array.from(new Set(rawData.map(d => d.month).filter(Boolean)));
      distinctMonths.sort((a, b) => {
        const ia = MONTH_ORDER.indexOf(a);
        const ib = MONTH_ORDER.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        return a.localeCompare(b);
      });
      const curr = state.month;
      monthSelect.innerHTML = '<option value="All">All Months</option>' + 
        distinctMonths.map(m => `<option value="${esc(m)}"${m === curr ? ' selected' : ''}>${esc(m)}</option>`).join('');
    }

    // States
    const stateSelect = document.getElementById('wopsStateFilter');
    if (stateSelect) {
      const distinctStates = Array.from(new Set(rawData.map(d => (d.state || '').toUpperCase()).filter(Boolean))).sort();
      const curr = state.stateCode;
      stateSelect.innerHTML = '<option value="All">All States</option>' +
        distinctStates.map(s => `<option value="${esc(s)}"${s === curr ? ' selected' : ''}>${esc(s)}</option>`).join('');
    }

    // Weeks
    const weekSelect = document.getElementById('wopsWeekFilter');
    if (weekSelect) {
      const distinctWeeks = Array.from(new Set(rawData.map(d => d.week).filter(Boolean))).sort();
      const curr = state.week;
      weekSelect.innerHTML = '<option value="All">All Weeks</option>' +
        distinctWeeks.map(w => `<option value="${esc(w)}"${w === curr ? ' selected' : ''}>${esc(w)}</option>`).join('');
    }

    updateDependentDropdowns();
  }

  function updateDependentDropdowns() {
    let subset = allPlans;
    if (state.stateCode !== 'All') {
      subset = subset.filter(d => (d.state || '').toUpperCase() === state.stateCode.toUpperCase());
    }

    // Districts
    const distSelect = document.getElementById('wopsDistrictFilter');
    if (distSelect) {
      const distinctDists = Array.from(new Set(subset.map(d => d.district).filter(Boolean))).sort();
      const curr = state.district;
      distSelect.innerHTML = '<option value="All">All Districts</option>' +
        distinctDists.map(d => `<option value="${esc(d)}"${d === curr ? ' selected' : ''}>${esc(d)}</option>`).join('');
    }

    // PMs
    const pmSelect = document.getElementById('wopsPmFilter');
    if (pmSelect) {
      const distinctPms = Array.from(new Set(subset.map(d => d.pm).filter(Boolean))).sort();
      const curr = state.pm;
      pmSelect.innerHTML = '<option value="All">All PMs</option>' +
        distinctPms.map(p => `<option value="${esc(p)}"${p === curr ? ' selected' : ''}>${esc(p)}</option>`).join('');
    }
  }

  // --- Filter and Render ---
  function getFilteredData() {
    return allPlans.filter(item => {
      if (state.year !== 'All' && item.year && item.year !== state.year) return false;
      if (state.month !== 'All' && item.month !== state.month) return false;
      if (state.stateCode !== 'All' && (item.state || '').toUpperCase() !== state.stateCode.toUpperCase()) return false;
      if (state.district !== 'All' && item.district !== state.district) return false;
      if (state.pm !== 'All' && item.pm !== state.pm) return false;
      if (state.week !== 'All' && item.week !== state.week) return false;
      if (state.status !== 'All' && (item.status || '').toLowerCase() !== state.status.toLowerCase()) return false;

      if (state.search) {
        const q = state.search.toLowerCase();
        const combined = `${item.meetingPlan || ''} ${item.pm || ''} ${item.district || ''} ${item.remarks || ''} ${item.supportFrom || ''} ${item.supportWhat || ''}`.toLowerCase();
        if (!combined.includes(q)) return false;
      }

      return true;
    });
  }

  function renderKPIs(filtered) {
    const total = filtered.length;
    let completed = 0, inProcess = 0, planned = 0, postponed = 0, pending = 0;

    for (const d of filtered) {
      const st = (d.status || '').toLowerCase();
      if (st === 'completed') completed++;
      else if (st === 'in process') inProcess++;
      else if (st === 'planned') planned++;
      else if (st === 'postponed') postponed++;
      else if (st === 'pending' || st === 'cancelled') pending++;
    }

    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    const el = document.getElementById('tpWopsKpis');
    if (!el) return;

    el.innerHTML = `
      <div class="tp-wops-kpi-card">
        <div class="tp-wops-kpi-label">Total Plans</div>
        <div class="tp-wops-kpi-val">${total.toLocaleString()}</div>
        <div class="tp-wops-kpi-sub">Filtered records</div>
      </div>
      <div class="tp-wops-kpi-card" style="border-left: 3px solid #059669;">
        <div class="tp-wops-kpi-label" style="color: #059669;">Completed</div>
        <div class="tp-wops-kpi-val" style="color: #059669;">${completed} <span style="font-size: 13px; font-weight: 600;">(${pct}%)</span></div>
        <div class="tp-wops-kpi-sub">Executed plans</div>
      </div>
      <div class="tp-wops-kpi-card" style="border-left: 3px solid #D97706;">
        <div class="tp-wops-kpi-label" style="color: #D97706;">In Process</div>
        <div class="tp-wops-kpi-val" style="color: #D97706;">${inProcess}</div>
        <div class="tp-wops-kpi-sub">Currently ongoing</div>
      </div>
      <div class="tp-wops-kpi-card" style="border-left: 3px solid #6366F1;">
        <div class="tp-wops-kpi-label" style="color: #6366F1;">Planned</div>
        <div class="tp-wops-kpi-val" style="color: #6366F1;">${planned}</div>
        <div class="tp-wops-kpi-sub">Upcoming tasks</div>
      </div>
      <div class="tp-wops-kpi-card" style="border-left: 3px solid #2563EB;">
        <div class="tp-wops-kpi-label" style="color: #2563EB;">Postponed</div>
        <div class="tp-wops-kpi-val" style="color: #2563EB;">${postponed}</div>
        <div class="tp-wops-kpi-sub">Moved to later week</div>
      </div>
      <div class="tp-wops-kpi-card" style="border-left: 3px solid #DC2626;">
        <div class="tp-wops-kpi-label" style="color: #DC2626;">Pending / Cancelled</div>
        <div class="tp-wops-kpi-val" style="color: #DC2626;">${pending}</div>
        <div class="tp-wops-kpi-sub">Awaiting action</div>
      </div>
    `;
  }

  function renderFiltered() {
    const filtered = getFilteredData();
    renderKPIs(filtered);



    const total = filtered.length;
    const tbody = document.getElementById('tpWopsTbody');
    const pageInfo = document.getElementById('tpWopsPageInfo');
    const pageNumSpan = document.getElementById('wopsCurrentPage');
    const prevBtn = document.getElementById('wopsPrevBtn');
    const nextBtn = document.getElementById('wopsNextBtn');

    if (total === 0) {
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="12" class="tp-wops-empty">
              <div class="tp-wops-empty-icon">📋</div>
              <p style="font-size: 14px; font-weight: 600; color: #475569; margin: 0 0 4px;">No meeting plans found</p>
              <p style="font-size: 12px; margin: 0;">Try adjusting your filters or search query.</p>
            </td>
          </tr>
        `;
      }
      if (pageInfo) pageInfo.textContent = 'Showing 0 of 0 plans';
      if (pageNumSpan) pageNumSpan.textContent = '1';
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      return;
    }

    // Pagination calculations
    let pageSize = state.pageSize === 'All' ? total : parseInt(state.pageSize, 10);
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    if (state.page > maxPage) state.page = maxPage;
    if (state.page < 1) state.page = 1;

    const startIdx = (state.page - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);
    const pagedItems = filtered.slice(startIdx, endIdx);

    if (pageInfo) {
      pageInfo.textContent = `Showing ${(startIdx + 1).toLocaleString()} to ${endIdx.toLocaleString()} of ${total.toLocaleString()} plans`;
    }
    if (pageNumSpan) {
      pageNumSpan.textContent = `${state.page} / ${maxPage}`;
    }
    if (prevBtn) prevBtn.disabled = (state.page <= 1);
    if (nextBtn) nextBtn.disabled = (state.page >= maxPage);

    // Build Table Rows
    const rowsHtml = pagedItems.map(item => {
      const normStatus = normalizeStatus(item.status);
      const conf = STATUS_CONFIG[normStatus] || STATUS_CONFIG['Planned'];
      const stColor = conf.color;
      const stBg = conf.bg;
      const stBorder = conf.border;
      const canEdit = canEditItem(item);

      // Status cell HTML: interactive select if editable, else styled badge pill
      let statusCellHtml = '';
      if (canEdit) {
        statusCellHtml = `
          <select 
            class="tp-wops-status-select" 
            style="color: ${stColor}; background-color: ${stBg}; border-color: ${stBorder};"
            onchange="window.WeeklyOpsModule.onStatusChange('${item.id}', this.value)"
          >
            ${renderStatusOptions(item.status)}
          </select>
        `;
      } else {
        statusCellHtml = `
          <span 
            class="tp-wops-chip" 
            style="color: ${stColor}; background-color: ${stBg}; border: 1px solid ${stBorder}; font-weight: 700; font-size: 11.5px; padding: 4px 8px; border-radius: 6px; display: inline-block;"
            title="Read-only status: You can only edit your own plans"
          >
            ${normStatus}
          </span>
        `;
      }

      // Remarks cell HTML: interactive input if editable, else read-only text
      let remarksCellHtml = '';
      if (canEdit) {
        remarksCellHtml = `
          <input 
            type="text" 
            class="tp-wops-remarks-input" 
            placeholder="Add remarks..." 
            value="${esc(item.remarks || '')}" 
            onchange="window.WeeklyOpsModule.onRemarksChange('${item.id}', this.value)"
          />
        `;
      } else {
        remarksCellHtml = `
          <span style="color: #64748B; font-size: 12px; display: block; padding: 4px 0; word-break: break-word;" title="Read-only remarks">
            ${item.remarks ? esc(item.remarks) : '<span style="color: #CBD5E1;">—</span>'}
          </span>
        `;
      }

      // Action cell HTML: Edit + Delete buttons if editable, else subtle lock indicator
      let actionCellHtml = '';
      if (canEdit) {
        actionCellHtml = `
          <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
            <button 
              type="button" 
              class="tp-wops-action-btn tp-wops-edit-btn" 
              onclick="window.WeeklyOpsModule.openEditModal('${item.id}')" 
              title="Edit this plan"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button 
              type="button" 
              class="tp-wops-action-btn tp-wops-del-btn" 
              onclick="window.WeeklyOpsModule.deleteItem('${item.id}')" 
              title="Delete this plan"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        `;
      } else {
        actionCellHtml = `
          <span title="Read-only: You can only edit your own plans" style="display: inline-flex; align-items: center; justify-content: center; color: #94A3B8; font-size: 12px; cursor: default;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </span>
        `;
      }

      return `
        <tr data-id="${item.id}">
          <!-- Plan Cells -->
          <td class="c-plan"><span class="tp-wops-chip tp-wops-chip-state">${esc(item.state)}</span></td>
          <td class="c-plan" style="font-weight: 600; color: #0F172A;">${esc(item.pm)}</td>
          <td class="c-plan" style="color: #475569;">${esc(item.district)}</td>
          <td class="c-plan"><span class="tp-wops-chip">${esc(item.month)}</span></td>
          <td class="c-plan"><span class="tp-wops-chip tp-wops-chip-week">${esc(item.week)}</span></td>
          <td class="c-plan" style="font-weight: 500; color: #1E293B; line-height: 1.45; white-space: normal !important; overflow-wrap: break-word !important; word-break: break-word !important;">
            ${cleanPlanText(item.meetingPlan)}
          </td>
          <td class="c-plan" style="color: #475569; font-size: 11.5px; line-height: 1.4; white-space: normal !important; overflow-wrap: break-word !important; word-break: break-word !important;">
            ${cleanPlanText(item.supportFrom || '—')}
          </td>
          <td class="c-plan" style="color: #475569; font-size: 11.5px; line-height: 1.4; white-space: normal !important; overflow-wrap: break-word !important; word-break: break-word !important;">
            ${cleanPlanText(item.supportWhat || '—')}
          </td>
          <td class="c-plan">
            <span class="tp-wops-chip-date" title="Deadline">
              📅 ${formatDate(item.deadline)}
            </span>
          </td>

          <!-- Status Update Cells -->
          <td class="c-status">
            ${statusCellHtml}
          </td>
          <td class="c-status">
            ${remarksCellHtml}
          </td>

          <!-- Action Cell (Edit + Delete / Lock) -->
          <td class="c-act">
            ${actionCellHtml}
          </td>
        </tr>
      `;
    }).join('');

    if (tbody) tbody.innerHTML = rowsHtml;
  }

  function normalizeStatus(st) {
    if (!st) return 'Planned';
    const s = st.trim().toLowerCase();
    if (s.includes('comp')) return 'Completed';
    if (s.includes('process')) return 'In Process';
    if (s.includes('postpone')) return 'Postponed';
    if (s.includes('pend')) return 'Pending';
    if (s.includes('cancel')) return 'Cancelled';
    return 'Planned';
  }

  function renderStatusOptions(currentVal) {
    const norm = normalizeStatus(currentVal);
    const options = ['Planned', 'In Process', 'Completed', 'Postponed', 'Pending', 'Cancelled'];
    return options.map(opt => `<option value="${opt}"${opt === norm ? ' selected' : ''}>${opt}</option>`).join('');
  }

  // --- Handlers for Filters ---
  function onFilterChange(field, val) {
    state[field] = val;
    state.page = 1;
    if (field === 'stateCode') {
      updateDependentDropdowns();
      state.district = 'All';
      state.pm = 'All';
      const dSel = document.getElementById('wopsDistrictFilter');
      if (dSel) dSel.value = 'All';
      const pSel = document.getElementById('wopsPmFilter');
      if (pSel) pSel.value = 'All';
    }
    renderFiltered();
  }

  let searchDebounce = null;
  function onSearch(val) {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.search = (val || '').trim();
      state.page = 1;
      renderFiltered();
    }, 200);
  }

  function resetFilters() {
    state.year = '2026-27';
    state.month = 'All';
    state.stateCode = 'All';
    state.district = 'All';
    state.pm = 'All';
    state.week = 'All';
    state.status = 'All';
    state.search = '';
    state.page = 1;

    // Reset DOM controls
    const y = document.getElementById('wopsYearFilter'); if (y) y.value = '2026-27';
    const m = document.getElementById('wopsMonthFilter'); if (m) m.value = 'All';
    const s = document.getElementById('wopsStateFilter'); if (s) s.value = 'All';
    const d = document.getElementById('wopsDistrictFilter'); if (d) d.value = 'All';
    const p = document.getElementById('wopsPmFilter'); if (p) p.value = 'All';
    const w = document.getElementById('wopsWeekFilter'); if (w) w.value = 'All';
    const st = document.getElementById('wopsStatusFilter'); if (st) st.value = 'All';
    const q = document.getElementById('wopsSearchInput'); if (q) q.value = '';

    updateDependentDropdowns();
    renderFiltered();
  }

  function prevPage() {
    if (state.page > 1) {
      state.page--;
      renderFiltered();
      scrollToTableTop();
    }
  }

  function nextPage() {
    state.page++;
    renderFiltered();
    scrollToTableTop();
  }

  function setPageSize(val) {
    state.pageSize = val;
    state.page = 1;
    renderFiltered();
  }

  function scrollToTableTop() {
    const wrap = document.querySelector('.tp-wops-tbl-wrap');
    if (wrap) wrap.scrollTop = 0;
  }

  // --- Inline Editing Updates ---
  function onStatusChange(id, newStatus) {
    const item = allPlans.find(p => p.id === id);
    if (!item) return;

    if (!canEditItem(item)) {
      alert('You do not have permission to change this plan. You can only update your own plans.');
      renderFiltered();
      return;
    }

    if (!overrides[id]) overrides[id] = {};
    overrides[id].status = newStatus;
    saveOverrides();

    item.status = newStatus;

    // Update UI styling on the select itself without full re-render
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if (tr) {
      const select = tr.querySelector('.tp-wops-status-select');
      if (select) {
        const conf = STATUS_CONFIG[newStatus] || STATUS_CONFIG['Planned'];
        select.style.color = conf.color;
        select.style.backgroundColor = conf.bg;
        select.style.borderColor = conf.border;
      }
    }

    // Refresh KPI numbers
    renderKPIs(getFilteredData());
  }

  function onRemarksChange(id, newRemarks) {
    const item = allPlans.find(p => p.id === id);
    if (!item) return;

    if (!canEditItem(item)) {
      alert('You do not have permission to change this plan. You can only update your own plans.');
      renderFiltered();
      return;
    }

    if (!overrides[id]) overrides[id] = {};
    overrides[id].remarks = newRemarks;
    saveOverrides();

    item.remarks = newRemarks;
  }

  function deleteItem(id) {
    const item = allPlans.find(p => p.id === id);
    if (!item) return;

    if (!canEditItem(item)) {
      alert('You do not have permission to delete this plan. You can only delete your own plans.');
      return;
    }

    if (!confirm('Are you sure you want to delete this weekly meeting plan?')) return;
    if (!overrides[id]) overrides[id] = {};
    overrides[id].isDeleted = true;
    saveOverrides();

    allPlans = allPlans.filter(p => p.id !== id);
    renderFiltered();
  }

  // --- Edit Plan Modal ---
  function openEditModal(id) {
    const item = allPlans.find(p => p.id === id);
    if (!item) return;

    if (!canEditItem(item)) {
      alert('You do not have permission to edit this plan. You can only edit your own plans.');
      return;
    }

    const container = document.getElementById('tpWopsModalContainer');
    if (!container) return;

    const pms = Array.from(new Set(allPlans.map(d => d.pm).filter(Boolean))).sort();
    const dists = Array.from(new Set(allPlans.map(d => d.district).filter(Boolean))).sort();
    const admin = isITAdmin();

    const states = ['MH', 'CG', 'MP', 'BR', 'HM', 'HO'];
    const currentNormState = (item.state || 'MH').toUpperCase();

    // Clean deadline for input[type="date"] (must be YYYY-MM-DD)
    let cleanDateVal = '';
    if (item.deadline) {
      const match = String(item.deadline).match(/\d{4}-\d{2}-\d{2}/);
      if (match) cleanDateVal = match[0];
    }

    container.innerHTML = `
      <div class="tp-wops-modal-backdrop" id="tpWopsEditModal" onclick="if(event.target===this)window.WeeklyOpsModule.closeModal()">
        <div class="tp-wops-modal-box" role="dialog" aria-modal="true">
          <div class="tp-wops-modal-header" style="background: linear-gradient(135deg, #047857, #0D9488);">
            <h3 class="tp-wops-modal-title">✎ Edit Weekly Meeting Plan</h3>
            <button type="button" class="tp-wops-modal-close" onclick="window.WeeklyOpsModule.closeModal()">&times;</button>
          </div>
          <div class="tp-wops-modal-body">
            <form id="tpWopsEditForm" onsubmit="window.WeeklyOpsModule.submitEditPlan('${item.id}', event)">
              <div class="tp-wops-form-grid">
                <!-- State -->
                <div class="tp-wops-form-group">
                  <label>State <span style="color:#DC2626;">*</span></label>
                  <select id="wopsEditState" required>
                    ${states.map(s => `<option value="${s}"${s === currentNormState ? ' selected' : ''}>${s}</option>`).join('')}
                  </select>
                </div>

                <!-- PM -->
                <div class="tp-wops-form-group">
                  <label>Project Manager (PM) <span style="color:#DC2626;">*</span></label>
                  <input 
                    type="text" 
                    id="wopsEditPm" 
                    list="wopsEditPmDatalist" 
                    value="${esc(item.pm)}" 
                    required 
                    ${admin ? '' : 'readonly style="background:#F1F5F9; color:#475569;"'}
                    autocomplete="off" 
                  />
                  <datalist id="wopsEditPmDatalist">
                    ${pms.map(p => `<option value="${esc(p)}"></option>`).join('')}
                  </datalist>
                  ${admin ? '' : '<span style="font-size:10.5px; color:#64748B;">PM cannot be re-assigned</span>'}
                </div>

                <!-- District -->
                <div class="tp-wops-form-group">
                  <label>District <span style="color:#DC2626;">*</span></label>
                  <input type="text" id="wopsEditDistrict" list="wopsEditDistDatalist" value="${esc(item.district)}" required autocomplete="off" />
                  <datalist id="wopsEditDistDatalist">
                    ${dists.map(d => `<option value="${esc(d)}"></option>`).join('')}
                  </datalist>
                </div>

                <!-- Year -->
                <div class="tp-wops-form-group">
                  <label>Year <span style="color:#DC2626;">*</span></label>
                  <select id="wopsEditYear" required>
                    <option value="2026-27" ${item.year === '2026-27' ? 'selected' : ''}>2026-27</option>
                    <option value="2027-28" ${item.year === '2027-28' ? 'selected' : ''}>2027-28</option>
                  </select>
                </div>

                <!-- Month -->
                <div class="tp-wops-form-group">
                  <label>Month <span style="color:#DC2626;">*</span></label>
                  <select id="wopsEditMonth" required>
                    ${MONTH_ORDER.map(m => `<option value="${m}"${m === item.month ? ' selected' : ''}>${m}</option>`).join('')}
                  </select>
                </div>

                <!-- Week -->
                <div class="tp-wops-form-group">
                  <label>Week <span style="color:#DC2626;">*</span></label>
                  <select id="wopsEditWeek" required>
                    ${['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'].map(w => `<option value="${w}"${w === item.week ? ' selected' : ''}>${w}</option>`).join('')}
                  </select>
                </div>

                <!-- Meeting Plans -->
                <div class="tp-wops-form-group tp-wops-field-full">
                  <label>Weekly Meeting Plans <span style="color:#DC2626;">*</span></label>
                  <textarea id="wopsEditPlanText" rows="3" required style="resize:vertical;">${esc(item.meetingPlan)}</textarea>
                </div>

                <!-- Support From -->
                <div class="tp-wops-form-group">
                  <label>Support From</label>
                  <input type="text" id="wopsEditSupportFrom" value="${esc(item.supportFrom || '')}" placeholder="e.g. Self & Team, Dist & Team" />
                </div>

                <!-- Support (What?) -->
                <div class="tp-wops-form-group">
                  <label>Support (What?)</label>
                  <input type="text" id="wopsEditSupportWhat" value="${esc(item.supportWhat || '')}" placeholder="e.g. Center Visit, Review meeting" />
                </div>

                <!-- Deadline -->
                <div class="tp-wops-form-group">
                  <label>Deadline (Target Date)</label>
                  <input type="date" id="wopsEditDeadline" value="${cleanDateVal}" />
                </div>

                <!-- Status -->
                <div class="tp-wops-form-group">
                  <label>Status</label>
                  <select id="wopsEditStatus">
                    ${renderStatusOptions(item.status)}
                  </select>
                </div>

                <!-- Remarks -->
                <div class="tp-wops-form-group tp-wops-field-full">
                  <label>Remarks</label>
                  <input type="text" id="wopsEditRemarks" value="${esc(item.remarks || '')}" placeholder="Optional notes or status notes..." />
                </div>
              </div>
              <div class="tp-wops-modal-footer">
                <button type="button" class="tp-wops-btn tp-wops-btn-secondary" onclick="window.WeeklyOpsModule.closeModal()">Cancel</button>
                <button type="submit" class="tp-wops-btn tp-wops-btn-primary" style="background:linear-gradient(135deg, #047857, #0D9488);">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  function submitEditPlan(id, e) {
    if (e && e.preventDefault) e.preventDefault();

    const item = allPlans.find(p => p.id === id);
    if (!item) return;

    if (!canEditItem(item)) {
      alert('You do not have permission to edit this plan.');
      return;
    }

    const updated = {
      state: document.getElementById('wopsEditState').value,
      pm: (document.getElementById('wopsEditPm').value || item.pm).trim(),
      district: (document.getElementById('wopsEditDistrict').value || '').trim(),
      year: document.getElementById('wopsEditYear').value,
      month: document.getElementById('wopsEditMonth').value,
      week: document.getElementById('wopsEditWeek').value,
      meetingPlan: (document.getElementById('wopsEditPlanText').value || '').trim(),
      supportFrom: (document.getElementById('wopsEditSupportFrom').value || '').trim(),
      supportWhat: (document.getElementById('wopsEditSupportWhat').value || '').trim(),
      deadline: document.getElementById('wopsEditDeadline').value || '',
      status: document.getElementById('wopsEditStatus').value || 'Planned',
      remarks: (document.getElementById('wopsEditRemarks').value || '').trim()
    };

    if (!overrides[id]) overrides[id] = {};
    Object.assign(overrides[id], updated);
    saveOverrides();

    Object.assign(item, updated);
    closeModal();
    renderFiltered();
  }

  // --- Add Plan Modal ---
  function openAddModal() {
    const container = document.getElementById('tpWopsModalContainer');
    if (!container) return;

    // Build datalists for auto-suggestions
    const pms = Array.from(new Set(allPlans.map(d => d.pm).filter(Boolean))).sort();
    const dists = Array.from(new Set(allPlans.map(d => d.district).filter(Boolean))).sort();
    const admin = isITAdmin();
    const user = getCurrentUser();

    // Default PM: if regular user, prefill with user name
    let defaultPm = '';
    if (!admin && user.name) {
      defaultPm = user.name;
    }

    container.innerHTML = `
      <div class="tp-wops-modal-backdrop" id="tpWopsAddModal" onclick="if(event.target===this)window.WeeklyOpsModule.closeModal()">
        <div class="tp-wops-modal-box" role="dialog" aria-modal="true">
          <div class="tp-wops-modal-header">
            <h3 class="tp-wops-modal-title">➕ Add Weekly Meeting Plan</h3>
            <button type="button" class="tp-wops-modal-close" onclick="window.WeeklyOpsModule.closeModal()">&times;</button>
          </div>
          <div class="tp-wops-modal-body">
            <form id="tpWopsAddForm" onsubmit="window.WeeklyOpsModule.submitAddPlan(event)">
              <div class="tp-wops-form-grid">
                <!-- State -->
                <div class="tp-wops-form-group">
                  <label>State <span style="color:#DC2626;">*</span></label>
                  <select id="wopsAddState" required>
                    <option value="MH">MH - Maharashtra</option>
                    <option value="CG">CG - Chhattisgarh</option>
                    <option value="MP">MP - Madhya Pradesh</option>
                    <option value="BR">BR - Bihar</option>
                    <option value="HM">HM - Head Office</option>
                  </select>
                </div>
                <!-- PM -->
                <div class="tp-wops-form-group">
                  <label>Project Manager (PM) <span style="color:#DC2626;">*</span></label>
                  <input type="text" id="wopsAddPm" list="wopsPmDatalist" value="${esc(defaultPm)}" placeholder="e.g. Bharat" required autocomplete="off" />
                  <datalist id="wopsPmDatalist">
                    ${pms.map(p => `<option value="${esc(p)}"></option>`).join('')}
                  </datalist>
                </div>

                <!-- District -->
                <div class="tp-wops-form-group">
                  <label>District <span style="color:#DC2626;">*</span></label>
                  <input type="text" id="wopsAddDistrict" list="wopsDistDatalist" placeholder="e.g. Polestar / Dhamtari" required autocomplete="off" />
                  <datalist id="wopsDistDatalist">
                    ${dists.map(d => `<option value="${esc(d)}"></option>`).join('')}
                  </datalist>
                </div>
                <!-- Year -->
                <div class="tp-wops-form-group">
                  <label>Year <span style="color:#DC2626;">*</span></label>
                  <select id="wopsAddYear" required>
                    <option value="2026-27" selected>2026-27</option>
                    <option value="2027-28">2027-28</option>
                  </select>
                </div>

                <!-- Month -->
                <div class="tp-wops-form-group">
                  <label>Month <span style="color:#DC2626;">*</span></label>
                  <select id="wopsAddMonth" required>
                    ${MONTH_ORDER.map(m => `<option value="${m}">${m}</option>`).join('')}
                  </select>
                </div>
                <!-- Week -->
                <div class="tp-wops-form-group">
                  <label>Week <span style="color:#DC2626;">*</span></label>
                  <select id="wopsAddWeek" required>
                    <option value="Week 1">Week 1</option>
                    <option value="Week 2">Week 2</option>
                    <option value="Week 3">Week 3</option>
                    <option value="Week 4">Week 4</option>
                    <option value="Week 5">Week 5</option>
                  </select>
                </div>

                <!-- Meeting Plans -->
                <div class="tp-wops-form-group tp-wops-field-full">
                  <label>Weekly Meeting Plans <span style="color:#DC2626;">*</span></label>
                  <textarea id="wopsAddPlanText" rows="3" placeholder="Enter full description of meeting plan and action items..." required style="resize:vertical;"></textarea>
                </div>

                <!-- Support From -->
                <div class="tp-wops-form-group">
                  <label>Support From</label>
                  <input type="text" id="wopsAddSupportFrom" placeholder="e.g. Self & Team, Dist & Team" />
                </div>
                <!-- Support (What?) -->
                <div class="tp-wops-form-group">
                  <label>Support (What?)</label>
                  <input type="text" id="wopsAddSupportWhat" placeholder="e.g. Center Visit, Review meeting" />
                </div>

                <!-- Deadline -->
                <div class="tp-wops-form-group">
                  <label>Deadline (Target Date)</label>
                  <input type="date" id="wopsAddDeadline" />
                </div>
                <!-- Status -->
                <div class="tp-wops-form-group">
                  <label>Status</label>
                  <select id="wopsAddStatus">
                    <option value="Planned" selected>Planned</option>
                    <option value="In Process">In Process</option>
                    <option value="Completed">Completed</option>
                    <option value="Postponed">Postponed</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>

                <!-- Remarks -->
                <div class="tp-wops-form-group tp-wops-field-full">
                  <label>Remarks</label>
                  <input type="text" id="wopsAddRemarks" placeholder="Optional notes or status notes..." />
                </div>
              </div>
              <div class="tp-wops-modal-footer">
                <button type="button" class="tp-wops-btn tp-wops-btn-secondary" onclick="window.WeeklyOpsModule.closeModal()">Cancel</button>
                <button type="submit" class="tp-wops-btn tp-wops-btn-primary">Save Plan</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  function closeModal() {
    const container = document.getElementById('tpWopsModalContainer');
    if (container) container.innerHTML = '';
  }

  function submitAddPlan(e) {
    if (e && e.preventDefault) e.preventDefault();

    const newId = 'custom_' + Date.now();
    const newPlan = {
      id: newId,
      isNew: true,
      state: document.getElementById('wopsAddState').value,
      pm: (document.getElementById('wopsAddPm').value || '').trim(),
      district: (document.getElementById('wopsAddDistrict').value || '').trim(),
      year: document.getElementById('wopsAddYear').value,
      month: document.getElementById('wopsAddMonth').value,
      week: document.getElementById('wopsAddWeek').value,
      meetingPlan: (document.getElementById('wopsAddPlanText').value || '').trim(),
      supportFrom: (document.getElementById('wopsAddSupportFrom').value || '').trim(),
      supportWhat: (document.getElementById('wopsAddSupportWhat').value || '').trim(),
      deadline: document.getElementById('wopsAddDeadline').value || '',
      status: document.getElementById('wopsAddStatus').value || 'Planned',
      remarks: (document.getElementById('wopsAddRemarks').value || '').trim()
    };

    overrides[newId] = newPlan;
    saveOverrides();

    allPlans.unshift(newPlan);
    closeModal();
    renderFiltered();
  }

  // --- Excel Export ---
  async function exportExcel() {
    const filtered = getFilteredData();
    if (!filtered.length) {
      alert('No plans to export for the current filters.');
      return;
    }

    try {
      const XLSX = await ensureXLSX();
      const headers = [
        'State', 'PM', 'District', 'Year', 'Month', 'Week',
        'Weekly Meeting Plans', 'Support From', 'Support (What?)',
        'Deadline', 'Status', 'Remarks'
      ];

      const dataRows = filtered.map(item => [
        item.state || '',
        item.pm || '',
        item.district || '',
        item.year || '',
        item.month || '',
        item.week || '',
        item.meetingPlan || '',
        item.supportFrom || '',
        item.supportWhat || '',
        item.deadline || '',
        item.status || '',
        item.remarks || ''
      ]);

      const aoa = [
        ['OPS Weekly - Operational Plans & Status Updates'],
        headers,
        ...dataRows
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Auto col widths
      ws['!cols'] = [
        { wch: 8 },  // State
        { wch: 15 }, // PM
        { wch: 18 }, // District
        { wch: 10 }, // Year
        { wch: 10 }, // Month
        { wch: 10 }, // Week
        { wch: 50 }, // Meeting Plans
        { wch: 18 }, // Support From
        { wch: 20 }, // Support What
        { wch: 14 }, // Deadline
        { wch: 14 }, // Status
        { wch: 30 }  // Remarks
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ops Weekly');

      const fileName = `Weekly_OPS_${state.stateCode}_${state.month}_${state.week}_${Date.now()}.xlsx`.replace(/\s+/g, '_');
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error('Export Excel failed:', err);
      alert('Failed to export Excel: ' + (err.message || 'Unknown error'));
    }
  }

  // Public API
  window.WeeklyOpsModule = {
    init,
    onFilterChange,
    onSearch,
    resetFilters,
    prevPage,
    nextPage,
    setPageSize,
    onStatusChange,
    onRemarksChange,
    deleteItem,
    openAddModal,
    openEditModal,
    closeModal,
    submitAddPlan,
    submitEditPlan,
    exportExcel,
    isITAdmin,
    canEditItem
  };

})();
