/**********************************************************************
 * PROGRAM CALENDAR — FRONTEND LOGIC
 * --------------------------------------------------------------------
 * Loads alongside calendar.html inside OLF Staff Connect.
 *
 * INTEGRATION (3 steps):
 *   1. Set CONFIG.GAS_WEB_APP_URL below to the /exec URL you got when
 *      you deployed Code.gs as a Web App.
 *   2. Tell the calendar who the signed-in user is. Recommended:
 *        window.PROGRAM_CALENDAR_USER = { email: <user email>,
 *                                         isAdmin: <true/false> };
 *      Compute isAdmin however you already do it (looking the email up
 *      in the "Calendar Admin" Firestore collection). Set this BEFORE
 *      calling mount(). If you skip this, calendar.js will try to
 *      auto-detect via Firebase v8 on the page (see resolveUser()).
 *   3. After you inject calendar.html into the page, call:
 *        window.ProgramCalendar.mount();
 *      (If the fragment is already in the DOM when this file loads, it
 *      auto-mounts.)
 *
 * ROLES
 *   Admins  -> Calendar + Settings + Add/Delete events.
 *   Others  -> read-only Calendar (no Add Event, no Settings, no delete).
 **********************************************************************/
(function () {
  'use strict';

  // ── CONFIG ────────────────────────────────────────────────────────
  var CONFIG = {
    GAS_WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbwQKLMGqIbMOWkTyqGHAIj4yd5fFhFg7qSiagnLfWEUwg9ATwZogGiEn4j-bYiRg9fh/exec', // e.g. https://script.google.com/macros/s/AKfyc.../exec
    ADMIN_COLLECTION: 'Calendar Admin',
    ADMIN_EMAIL_FIELD: 'Email',
    REQUEST_TIMEOUT_MS: 20000
  };

  // ── Built-in lists (only used to protect defaults from deletion in
  //    the Settings UI; the authoritative lists live in the Sheet) ──
  var BUILT_IN_DISTRICTS = [
    'Pune', 'Nagpur', 'Nashik', 'Solapur', 'Amravati', 'Kolhapur', 'Satara',
    'Sangli', 'Ratnagiri', 'Sindhudurg', 'Dhule', 'Nandurbar', 'Jalgaon',
    'Ahmednagar', 'Beed', 'Latur', 'Osmanabad', 'Nanded', 'Hingoli', 'Parbhani',
    'Jalna', 'Buldhana', 'Akola', 'Washim', 'Yavatmal', 'Wardha', 'Gadchiroli',
    'Chandrapur', 'Bhandara', 'Gondia', 'Thane', 'Raigarh - MH', 'Palghar',
    'Raipur', 'Bilaspur', 'Durg', 'Rajnandgaon', 'Korba', 'Raigarh - CG',
    'Janjgir-Champa', 'Surguja', 'Korea', 'Bastar', 'Dantewada', 'Kanker',
    'Kabirdham', 'Mahasamund', 'Dhamtari', 'Gariaband', 'Balod', 'Bemetara',
    'Balodabazar', 'Mungeli', 'Surajpur', 'Balrampur', 'Bijapur', 'Narayanpur',
    'Kondagaon', 'Sukma', 'Gaurela-Pendra-Marwahi', 'Sarangarh-Bilaigarh',
    'Manendragarh', 'Seoni', 'Balaghat', 'Begusarai'
  ];
  var BUILT_IN_PROGRAMS = ['Shikshan Utsav', 'Nanhe Sitare', 'Academic Program'];

  var PROGRAM_COLORS = {
    'Shikshan Utsav':   '#2563eb',
    'Nanhe Sitare':     '#7c3aed',
    'Academic Program': '#059669'
  };

  // Distinct palette for any non-built-in program type. Hand-picked to be
  // visually well-separated from each other AND from the three reserved
  // colors above. Ordered so consecutive additions get maximum contrast.
  // Supports ~12 custom types (15 total with the built-ins) before repeating.
  var PROGRAM_PALETTE = [
    '#e6194b', // red
    '#42d4f4', // cyan
    '#f58231', // orange
    '#f032e6', // magenta
    '#ffe119', // yellow
    '#fabed4', // pink
    '#bfef45', // lime
    '#9a6324', // brown
    '#469990', // teal
    '#800000', // maroon
    '#808000', // olive
    '#a9a9a9'  // grey
  ];

  // name -> color, rebuilt whenever the programs list changes so each program
  // gets a unique palette slot (in list order).
  var programColorMap = {};
  function rebuildProgramColors() {
    programColorMap = {};
    var pi = 0;
    programs.forEach(function (name) {
      if (PROGRAM_COLORS[name]) { programColorMap[name] = PROGRAM_COLORS[name]; return; }
      programColorMap[name] = PROGRAM_PALETTE[pi % PROGRAM_PALETTE.length];
      pi++;
    });
  }
  // Stable fallback for a type not in the current list (e.g. a program that was
  // deleted but is still referenced by an existing event).
  function hashColor(t) {
    var h = 0, s = String(t == null ? '' : t);
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    return PROGRAM_PALETTE[h % PROGRAM_PALETTE.length];
  }
  function getProgramColor(t) {
    if (PROGRAM_COLORS[t]) return PROGRAM_COLORS[t];
    if (programColorMap[t]) return programColorMap[t];
    return hashColor(t);
  }

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // ── STATE ─────────────────────────────────────────────────────────
  var events = [], districts = [], programs = [];
  var now = new Date();
  var viewYear = now.getFullYear();
  var viewMonth = now.getMonth();
  var currentEmail = null;
  var isAdmin = false;
  var mounted = false;
  var busy = false;
  var loadedOnce = false;   // true after the first successful data load

  // ── DOM HELPERS ───────────────────────────────────────────────────
  function root() { return document.getElementById('pcal-app'); }
  function $(id) { return document.getElementById(id); }
  function qsa(sel) {
    var r = root();
    return r ? Array.prototype.slice.call(r.querySelectorAll(sel)) : [];
  }
  function on(id, evt, fn) { var el = $(id); if (el) el.addEventListener(evt, fn); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── TRANSPORT (JSONP -> Apps Script Web App) ──────────────────────
  function jsonp(params) {
    return new Promise(function (resolve, reject) {
      if (!CONFIG.GAS_WEB_APP_URL || CONFIG.GAS_WEB_APP_URL.indexOf('PASTE_') === 0) {
        reject(new Error('calendar.js: set CONFIG.GAS_WEB_APP_URL to your deployed Web App /exec URL.'));
        return;
      }
      var cb = 'pcalCb_' + Date.now() + '_' + Math.floor(Math.random() * 1e9);
      var script = document.createElement('script');
      var done = false;
      var timer = setTimeout(function () {
        finish(new Error('Request timed out. Check the Web App URL and that access is set to "Anyone".'));
      }, CONFIG.REQUEST_TIMEOUT_MS);

      function cleanup() {
        clearTimeout(timer);
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }
      function finish(err, data) {
        if (done) return;
        done = true;
        cleanup();
        if (err) reject(err); else resolve(data);
      }

      window[cb] = function (data) { finish(null, data); };

      var qs = Object.keys(params).map(function (k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(params[k] == null ? '' : params[k]);
      }).join('&');

      script.src = CONFIG.GAS_WEB_APP_URL + '?' + qs + '&callback=' + cb + '&_t=' + Date.now();
      script.onerror = function () { finish(new Error('Network error contacting the calendar server.')); };
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

  // ── USER / ADMIN RESOLUTION ───────────────────────────────────────
  function resolveUser() {
    // Primary: host provides the user (SDK-version independent).
    var u = window.PROGRAM_CALENDAR_USER;
    if (u && u.email) {
      currentEmail = u.email;
      isAdmin = !!u.isAdmin;
      return Promise.resolve();
    }
    // Fallback: auto-detect via Firebase v8 present on the page.
    return Promise.resolve()
      .then(function () {
        currentEmail = getCurrentUserEmailFallback();
        return currentEmail ? checkAdminFallback(currentEmail) : false;
      })
      .then(function (admin) { isAdmin = !!admin; })
      .catch(function (e) {
        console.warn('[ProgramCalendar] could not resolve admin status:', e);
        isAdmin = false;
      });
  }

  function getCurrentUserEmailFallback() {
    if (window.firebase && firebase.auth && firebase.auth().currentUser) {
      return firebase.auth().currentUser.email || null;
    }
    return null;
  }

  function checkAdminFallback(email) {
    if (window.firebase && firebase.firestore) {
      return firebase.firestore()
        .collection(CONFIG.ADMIN_COLLECTION)
        .where(CONFIG.ADMIN_EMAIL_FIELD, '==', email)
        .get()
        .then(function (snap) { return !snap.empty; });
    }
    return Promise.resolve(false);
  }

  // ── DATA LOAD ─────────────────────────────────────────────────────
  function loadAll() {
    return api('getAll').then(function (data) {
      events    = (data && data.events)    || [];
      districts = (data && data.districts) || [];
      programs  = (data && data.programs)  || [];
      rebuildProgramColors();
      loadedOnce = true;
    });
  }

  // ── YEAR SELECT ───────────────────────────────────────────────────
  function populateYearSelect(id, selectedYear) {
    var sel = $(id);
    if (!sel) return;
    sel.innerHTML = '';
    for (var y = 2020; y <= 2035; y++) {
      var o = document.createElement('option');
      o.value = y; o.textContent = y;
      if (y === selectedYear) o.selected = true;
      sel.appendChild(o);
    }
  }

  // ── CALENDAR RENDER ───────────────────────────────────────────────
  // OLF weekly offs: every Sunday + the 1st and 3rd Saturday of the month.
  function isWeeklyOff(year, month, day) {
    var dow = new Date(year, month, day).getDay();
    if (dow === 0) return true;                 // Sunday → off
    if (dow === 6) {                            // Saturday
      var nth = Math.floor((day - 1) / 7) + 1;  // which Saturday of the month
      return nth === 1 || nth === 3;            // 1st & 3rd off; 2nd/4th/5th working
    }
    return false;
  }

  function renderCalendar() {
    $('pcal-sel-month').value = viewMonth;
    populateYearSelect('pcal-sel-year', viewYear);
    $('pcal-cal-month-label').textContent = MONTHS[viewMonth] + ' ' + viewYear;
    $('pcal-events-list-title').textContent = 'Events — ' + MONTHS[viewMonth] + ' ' + viewYear;

    $('pcal-cal-header').innerHTML = DAYS.map(function (d) {
      return '<div class="cal-day-header">' + d + '</div>';
    }).join('');

    var firstDay = new Date(viewYear, viewMonth, 1).getDay();
    var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    var prevDays = new Date(viewYear, viewMonth, 0).getDate();
    var totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    var todayStr = now.getFullYear() + '-' + now.getMonth() + '-' + now.getDate();

    var body = $('pcal-cal-body');
    body.innerHTML = '';

    for (var i = 0; i < totalCells; i++) {
      var day, month, year, isOther = false;
      if (i < firstDay) {
        day = prevDays - firstDay + i + 1;
        month = viewMonth === 0 ? 11 : viewMonth - 1;
        year = viewMonth === 0 ? viewYear - 1 : viewYear;
        isOther = true;
      } else if (i >= firstDay + daysInMonth) {
        day = i - firstDay - daysInMonth + 1;
        month = viewMonth === 11 ? 0 : viewMonth + 1;
        year = viewMonth === 11 ? viewYear + 1 : viewYear;
        isOther = true;
      } else {
        day = i - firstDay + 1; month = viewMonth; year = viewYear;
      }

      var col = i % 7;
      var row = Math.floor(i / 7);
      var rows = totalCells / 7;
      var tipx = col <= 1 ? 'left' : (col >= 5 ? 'right' : 'center');
      var tipy = row >= rows - 1 ? 'up' : 'down';

      var cell = document.createElement('div');
      cell.className = 'cal-cell' + (isOther ? ' other-month' : '');
      if (!isOther) {
        cell.classList.add('in-month');
        if (isWeeklyOff(year, month, day)) cell.classList.add('off-day');
      }
      if (year + '-' + month + '-' + day === todayStr) cell.classList.add('today');
      cell.innerHTML = '<div class="day-num">' + day + '</div>' +
        '<div class="event-dots" id="pcal-dots-' + year + '-' + month + '-' + day + '"' +
        ' data-tipx="' + tipx + '" data-tipy="' + tipy + '"></div>';
      body.appendChild(cell);
    }

    renderEventDots();
    renderEventList();
    renderSidebarLegend();
  }

  function renderEventDots() {
    qsa('.event-dots').forEach(function (el) { el.innerHTML = ''; });
    events.forEach(function (evt) {
      var container = $('pcal-dots-' + evt.year + '-' + evt.month + '-' + evt.day);
      if (!container) return;
      var dot = document.createElement('div');
      dot.className = 'event-dot';
      dot.style.background = getProgramColor(evt.type);
      var tip = document.createElement('div');
      tip.className = 'tooltip';
      var tx = container.getAttribute('data-tipx');
      var ty = container.getAttribute('data-tipy');
      if (tx && tx !== 'center') tip.classList.add('tip-' + tx);
      if (ty === 'up') tip.classList.add('tip-up');
      tip.innerHTML = '<strong>' + esc(evt.type) + '</strong>📍 ' + esc(evt.district) +
        (evt.desc ? '<br><span style="opacity:.75;font-style:italic">' + esc(evt.desc) + '</span>' : '');
      dot.appendChild(tip);
      container.appendChild(dot);
    });
  }

  function renderEventList() {
    var list = $('pcal-events-list');
    var monthEvents = events
      .filter(function (e) { return e.year === viewYear && e.month === viewMonth; })
      .sort(function (a, b) { return a.day - b.day; });

    if (!monthEvents.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div>No events this month.' +
        (isAdmin ? '<br>Click <strong>Add Event</strong> to get started.' : '') + '</div>';
      return;
    }

    var trashTpl = $('pcal-icon-trash').innerHTML;
    list.innerHTML = monthEvents.map(function (e) {
      var delBtn = isAdmin
        ? '<button class="btn-icon-del" data-pcal-del-event="' + esc(e.id) + '" title="Delete event">' + trashTpl + '</button>'
        : '';
      return '<div class="event-list-item" data-pcal-view-event="' + esc(e.id) + '" title="Click to view details">' +
          '<div class="event-dot-big" style="background:' + getProgramColor(e.type) + '"></div>' +
          '<div class="event-info">' +
            '<div class="evt-title">' + MONTHS[e.month] + ' ' + e.day + ', ' + e.year + '</div>' +
            '<div class="evt-meta">📍 ' + esc(e.district) + ' &nbsp;•&nbsp; 🎯 ' + esc(e.type) + '</div>' +
            (e.desc ? '<div class="evt-desc">' + esc(e.desc) + '</div>' : '') +
          '</div>' + delBtn +
        '</div>';
    }).join('');
  }

  function renderSidebarLegend() {
    var used = [];
    events.forEach(function (e) { if (used.indexOf(e.type) === -1) used.push(e.type); });
    var el = $('pcal-sidebar-legend');
    if (!used.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="sidebar-legend-title">Legend</div>' +
      used.map(function (t) {
        return '<div class="legend-item"><div class="legend-dot" style="background:' +
          getProgramColor(t) + '"></div>' + esc(t) + '</div>';
      }).join('');
  }

  // ── NAVIGATION / TABS ─────────────────────────────────────────────
  function switchTab(name) {
    if (name === 'settings' && !isAdmin) return;
    qsa('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
    qsa('.nav-item').forEach(function (b) { b.classList.remove('active'); });
    var panel = $('pcal-tab-' + name);
    if (panel) panel.classList.add('active');
    var r = root();
    var btn = r ? r.querySelector('.nav-item[data-pcal-tab="' + name + '"]') : null;
    if (btn) btn.classList.add('active');
    var controls = $('pcal-sidebar-cal-controls');
    if (controls) controls.style.display = (name === 'calendar') ? '' : 'none';
    if (name === 'settings') renderSettings();
  }

  function navigateMonth(dir) {
    viewMonth += dir;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    renderCalendar();
  }

  // ── ADD EVENT MODAL ───────────────────────────────────────────────
  function openAddEvent() {
    if (!isAdmin) return;
    populateYearSelect('pcal-evt-year', viewYear);
    $('pcal-evt-month').value = viewMonth;
    updateEventDays();
    $('pcal-evt-day').value = '';
    $('pcal-evt-district').innerHTML = '<option value="">Select district…</option>' +
      districts.map(function (d) { return '<option value="' + esc(d) + '">' + esc(d) + '</option>'; }).join('');
    $('pcal-evt-type').innerHTML = '<option value="">Select type…</option>' +
      programs.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join('');
    $('pcal-evt-desc').value = '';
    clearFormErrors();
    $('pcal-modal-add').classList.add('open');
  }

  function updateEventDays() {
    var y = +$('pcal-evt-year').value;
    var m = $('pcal-evt-month').value;
    var daysSel = $('pcal-evt-day');
    var prev = daysSel.value;
    daysSel.innerHTML = '<option value="">—</option>';
    if (m === '') return;
    var dim = new Date(y, +m + 1, 0).getDate();
    for (var d = 1; d <= dim; d++) {
      var o = document.createElement('option');
      o.value = d; o.textContent = d;
      if (+prev === d) o.selected = true;
      daysSel.appendChild(o);
    }
  }

  function clearFormErrors() {
    ['pcal-fg-eyear', 'pcal-fg-emonth', 'pcal-fg-eday', 'pcal-fg-edistrict', 'pcal-fg-etype']
      .forEach(function (id) { var el = $(id); if (el) el.classList.remove('has-error'); });
  }

  function saveEvent() {
    if (!isAdmin || busy) return;
    clearFormErrors();
    var valid = true;
    var year = +$('pcal-evt-year').value;
    var month = $('pcal-evt-month').value;
    var day = $('pcal-evt-day').value;
    var district = $('pcal-evt-district').value;
    var type = $('pcal-evt-type').value;
    var desc = $('pcal-evt-desc').value.trim();

    if (!month) { $('pcal-fg-emonth').classList.add('has-error'); valid = false; }
    if (!day) { $('pcal-fg-eday').classList.add('has-error'); valid = false; }
    if (!district) { $('pcal-fg-edistrict').classList.add('has-error'); valid = false; }
    if (!type) { $('pcal-fg-etype').classList.add('has-error'); valid = false; }
    if (!valid) return;

    var btn = $('pcal-save-event');
    setBusy(btn, true);          // disable to prevent double-submit (label unchanged)
    showLoader();                // blur backdrop + spinner
    api('addEvent', {
      year: year, month: +month, day: +day,
      district: district, type: type, desc: desc,
      createdBy: currentEmail || ''
    })
      .then(function (res) {
        // Single round trip: the server returns the created event; if an older
        // backend only returns {id}, reconstruct it locally from the form.
        var evt = (res && res.event) ? res.event : {
          id: (res && res.id) || ('tmp_' + Date.now()),
          year: year, month: +month, day: +day,
          district: district, type: type, desc: desc,
          createdBy: currentEmail || ''
        };
        evt.year = Number(evt.year); evt.month = Number(evt.month); evt.day = Number(evt.day);
        events.push(evt);
        closeModal('pcal-modal-add');
        renderCalendar();
        showToast('Event added successfully!');
      })
      .catch(function (e) { showToast(e.message || 'Could not add event', true); })
      .then(function () { setBusy(btn, false); hideLoader(); });
  }

  function deleteEvent(id) {
    if (!isAdmin || busy || !id) return;
    setBusy(null, true);
    showLoader();
    api('deleteEvent', { id: id })
      .then(function () {
        // Single round trip: drop it locally instead of re-fetching everything.
        events = events.filter(function (e) { return String(e.id) !== String(id); });
        renderCalendar();
        showToast('Event deleted.');
      })
      .catch(function (e) { showToast(e.message || 'Could not delete event', true); })
      .then(function () { setBusy(null, false); hideLoader(); });
  }

  function closeModal(id) {
    var el = $(id);
    if (el) el.classList.remove('open');
  }

  function openEventDetails(id) {
    var evt = null;
    for (var i = 0; i < events.length; i++) {
      if (String(events[i].id) === String(id)) { evt = events[i]; break; }
    }
    if (!evt) return;
    var body = $('pcal-details-body');
    if (!body) return;
    var color = getProgramColor(evt.type);
    body.innerHTML =
      '<div class="pcal-detail-row"><span class="pcal-detail-label">Date</span>' +
        '<span class="pcal-detail-val">' + MONTHS[evt.month] + ' ' + evt.day + ', ' + evt.year + '</span></div>' +
      '<div class="pcal-detail-row"><span class="pcal-detail-label">District</span>' +
        '<span class="pcal-detail-val">📍 ' + esc(evt.district) + '</span></div>' +
      '<div class="pcal-detail-row"><span class="pcal-detail-label">Program Type</span>' +
        '<span class="pcal-detail-val"><span class="pcal-detail-dot" style="background:' + color + '"></span>' +
        esc(evt.type) + '</span></div>' +
      (evt.desc
        ? '<div class="pcal-detail-row col"><span class="pcal-detail-label">Description</span>' +
          '<div class="pcal-detail-desc">' + esc(evt.desc) + '</div></div>'
        : '') +
      (evt.createdBy
        ? '<div class="pcal-detail-row"><span class="pcal-detail-label">Added by</span>' +
          '<span class="pcal-detail-val pcal-detail-muted">' + esc(evt.createdBy) + '</span></div>'
        : '');
    $('pcal-modal-details').classList.add('open');
  }

  // ── SETTINGS ──────────────────────────────────────────────────────
  function renderSettings() { renderDistrictList(); renderProgramList(); }

  function trashBtn(attr) {
    return '<button class="btn-trash" ' + attr + ' title="Delete">' + $('pcal-icon-trash').innerHTML + '</button>';
  }

  function renderDistrictList() {
    var list = $('pcal-district-list');
    if (!districts.length) {
      list.innerHTML = '<div class="empty-state" style="padding:16px">No districts added yet.</div>';
      return;
    }
    list.innerHTML = districts.map(function (d) {
      return '<div class="item-row">' +
          '<div class="item-row-left"><span>' + esc(d) + '</span></div>' +
          trashBtn('data-pcal-del-district="' + esc(d) + '"') +
        '</div>';
    }).join('');
  }

  function renderProgramList() {
    var list = $('pcal-program-list');
    if (!programs.length) {
      list.innerHTML = '<div class="empty-state" style="padding:16px">No program types added yet.</div>';
      return;
    }
    list.innerHTML = programs.map(function (p) {
      return '<div class="item-row">' +
          '<div class="item-row-left">' +
            '<div style="width:9px;height:9px;border-radius:50%;background:' + getProgramColor(p) + ';flex-shrink:0"></div>' +
            '<span>' + esc(p) + '</span>' +
          '</div>' +
          trashBtn('data-pcal-del-program="' + esc(p) + '"') +
        '</div>';
    }).join('');
  }

  function addDistrict() {
    if (!isAdmin) return;
    var inp = $('pcal-new-district');
    var val = inp.value.trim();
    if (!val) return;
    if (districts.some(function (d) { return d.toLowerCase() === val.toLowerCase(); })) {
      showToast('District already exists.'); return;
    }
    // Optimistic: reflect the change instantly, then sync in the background.
    districts.push(val);
    inp.value = '';
    renderDistrictList();
    showToast('District added!');
    api('addDistrict', { name: val })
      .then(function (res) {
        if (res && res.added === false) {
          removeLocal(districts, val);
          renderDistrictList();
          showToast('District already exists.', true);
        }
      })
      .catch(function (e) {
        removeLocal(districts, val);
        renderDistrictList();
        showToast(e.message || 'Could not add district', true);
      });
  }

  function removeDistrict(name) {
    if (!isAdmin) return;
    var idx = districts.indexOf(name);
    removeLocal(districts, name);
    renderDistrictList();
    showToast('District removed.');
    api('removeDistrict', { name: name })
      .catch(function (e) {
        if (idx >= 0) districts.splice(idx, 0, name); else districts.push(name);
        renderDistrictList();
        showToast(e.message || 'Could not remove district', true);
      });
  }

  function addProgram() {
    if (!isAdmin) return;
    var inp = $('pcal-new-program');
    var val = inp.value.trim();
    if (!val) return;
    if (programs.some(function (p) { return p.toLowerCase() === val.toLowerCase(); })) {
      showToast('Program type already exists.'); return;
    }
    // Optimistic: reflect the change instantly, then sync in the background.
    programs.push(val);
    rebuildProgramColors();
    inp.value = '';
    renderProgramList();
    showToast('Program type added!');
    api('addProgram', { name: val })
      .then(function (res) {
        if (res && res.added === false) {
          removeLocal(programs, val);
          rebuildProgramColors();
          renderProgramList();
          showToast('Program type already exists.', true);
        }
      })
      .catch(function (e) {
        removeLocal(programs, val);
        rebuildProgramColors();
        renderProgramList();
        showToast(e.message || 'Could not add program type', true);
      });
  }

  function removeProgram(name) {
    if (!isAdmin) return;
    var idx = programs.indexOf(name);
    removeLocal(programs, name);
    rebuildProgramColors();
    renderProgramList();
    showToast('Program type removed.');
    api('removeProgram', { name: name })
      .catch(function (e) {
        if (idx >= 0) programs.splice(idx, 0, name); else programs.push(name);
        rebuildProgramColors();
        renderProgramList();
        showToast(e.message || 'Could not remove program type', true);
      });
  }

  // ── TOAST / BUSY / LOADING ────────────────────────────────────────
  function showLoader() { var o = $('pcal-loader'); if (o) o.classList.add('open'); }
  function hideLoader() { var o = $('pcal-loader'); if (o) o.classList.remove('open'); }

  function removeLocal(arr, val) {
    var i = arr.indexOf(val);
    if (i !== -1) arr.splice(i, 1);
  }

  function showToast(msg, isError) {
    var t = $('pcal-toast');
    if (!t) return;
    t.textContent = (isError ? '⚠ ' : '✓ ') + msg;
    t.classList.toggle('error', !!isError);
    t.classList.add('show');
    clearTimeout(t._pcalTimer);
    t._pcalTimer = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  function setBusy(btn, on, label) {
    busy = !!on;
    if (btn) {
      btn.disabled = !!on;
      if (label != null) btn.textContent = label;
    }
  }

  function showError(msg) {
    var list = $('pcal-events-list');
    if (list) list.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div>' + esc(msg) + '</div>';
  }

  // ── ROLE VISIBILITY ───────────────────────────────────────────────
  function applyRole() {
    qsa('.pcal-admin-only').forEach(function (el) { el.style.display = isAdmin ? '' : 'none'; });
    if (!isAdmin) {
      var settings = $('pcal-tab-settings');
      if (settings && settings.classList.contains('active')) switchTab('calendar');
    }
  }

  // ── EVENT BINDING (once) ──────────────────────────────────────────
  function bindEvents() {
    var r = root();
    if (!r) return;

    r.querySelectorAll('.nav-item[data-pcal-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { switchTab(btn.getAttribute('data-pcal-tab')); });
    });
    r.querySelectorAll('[data-pcal-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () { navigateMonth(parseInt(btn.getAttribute('data-pcal-nav'), 10)); });
    });

    on('pcal-sel-year', 'change', function () { viewYear = +this.value; renderCalendar(); });
    on('pcal-sel-month', 'change', function () { viewMonth = +this.value; renderCalendar(); });
    on('pcal-add-btn', 'click', openAddEvent);

    on('pcal-evt-year', 'change', updateEventDays);
    on('pcal-evt-month', 'change', updateEventDays);
    on('pcal-save-event', 'click', saveEvent);

    r.querySelectorAll('[data-pcal-close]').forEach(function (btn) {
      btn.addEventListener('click', function () { closeModal(btn.getAttribute('data-pcal-close')); });
    });
    var overlay = $('pcal-modal-add');
    if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.classList.remove('open'); });
    var dOverlay = $('pcal-modal-details');
    if (dOverlay) dOverlay.addEventListener('click', function (e) { if (e.target === dOverlay) dOverlay.classList.remove('open'); });

    // Click an event card to view full details (ignore clicks on its delete button)
    var listEl = $('pcal-events-list');
    if (listEl) listEl.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-pcal-del-event]')) return;
      var card = e.target.closest ? e.target.closest('[data-pcal-view-event]') : null;
      if (card) openEventDetails(card.getAttribute('data-pcal-view-event'));
    });

    on('pcal-add-district-btn', 'click', addDistrict);
    on('pcal-new-district', 'keydown', function (e) { if (e.key === 'Enter') addDistrict(); });
    on('pcal-add-program-btn', 'click', addProgram);
    on('pcal-new-program', 'keydown', function (e) { if (e.key === 'Enter') addProgram(); });

    // Delegation for dynamically-rendered delete buttons
    delegate('pcal-events-list', '[data-pcal-del-event]', function (btn) {
      deleteEvent(btn.getAttribute('data-pcal-del-event'));
    });
    delegate('pcal-district-list', '[data-pcal-del-district]', function (btn) {
      removeDistrict(btn.getAttribute('data-pcal-del-district'));
    });
    delegate('pcal-program-list', '[data-pcal-del-program]', function (btn) {
      removeProgram(btn.getAttribute('data-pcal-del-program'));
    });
  }

  function delegate(containerId, selector, handler) {
    var el = $(containerId);
    if (!el) return;
    el.addEventListener('click', function (e) {
      var target = e.target && e.target.closest ? e.target.closest(selector) : null;
      if (target && el.contains(target)) handler(target);
    });
  }

  // ── MOUNT / PUBLIC API ────────────────────────────────────────────
  function mount() {
    var r = root();
    if (!r) {
      console.warn('[ProgramCalendar] #pcal-app not found. Inject calendar.html before calling mount().');
      return Promise.resolve();
    }

    now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();

    // The page fragment is re-injected on every visit, so DOM nodes are always
    // fresh — listeners must be (re)bound on every mount, not just the first.
    bindEvents();
    mounted = true;

    populateYearSelect('pcal-sel-year', viewYear);
    $('pcal-sel-month').value = viewMonth;

    // Repeat visit: paint instantly from in-memory data, refresh silently.
    if (loadedOnce) {
      return resolveUser().then(function () {
        applyRole();
        renderCalendar();
        return loadAll()
          .then(renderCalendar)
          .catch(function (e) { console.warn('[ProgramCalendar] background refresh failed:', e); });
      });
    }

    // First visit: draw the empty grid immediately, then blur + circle loader
    // over it until the data arrives.
    renderCalendar();
    showLoader();
    return resolveUser()
      .then(function () { applyRole(); return loadAll(); })
      .then(function () { renderCalendar(); })
      .catch(function (e) { showError(e.message || 'Could not load calendar data'); })
      .then(function () { hideLoader(); });
  }

  window.ProgramCalendar = {
    mount: mount,
    reload: function () { return loadAll().then(renderCalendar); },
    setUser: function (u) {
      if (u && u.email) {
        currentEmail = u.email;
        isAdmin = !!u.isAdmin;
        applyRole();
        if (mounted) renderCalendar();
      }
    }
  };

  // Auto-mount if the fragment is already present when this file loads.
  function maybeAutoMount() { if (root() && !mounted) mount(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeAutoMount);
  } else {
    maybeAutoMount();
  }
})();