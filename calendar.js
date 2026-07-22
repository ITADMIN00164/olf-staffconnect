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

  // State -> districts (shared with the GR module; used by the Add Event form).
  var STATE_LABELS = { MH: 'Maharashtra', MP: 'Madhya Pradesh', CG: 'Chhattisgarh', BR: 'Bihar' };
  var STATE_DISTRICTS = {
    MH: ['Ahilyanagar','Akola','Amravati','Beed','Bhandara','Buldhana','Chandrapur','Chhatrapati Sambhajinagar','Dharashiv','Dhule','Gadchiroli','Gondia','Hingoli','Jalgaon','Jalna','Kolhapur','Latur','Mumbai City','Mumbai Suburban','Nagpur','Nanded','Nandurbar','Nashik','Palghar','Parbhani','Pune','Raigad','Ratnagiri','Sangli','Satara','Sindhudurg','Solapur','Thane','Wardha','Washim','Yavatmal'],
    MP: ['Agar Malwa','Alirajpur','Anuppur','Ashoknagar','Balaghat','Barwani','Betul','Bhind','Bhopal','Burhanpur','Chhatarpur','Chhindwara','Damoh','Datia','Dewas','Dhar','Dindori','Guna','Gwalior','Harda','Indore','Jabalpur','Jhabua','Katni','Khandwa','Khargone','Maihar','Mandla','Mandsaur','Mauganj','Morena','Narmadapuram','Narsinghpur','Neemuch','Niwari','Pandhurna','Panna','Raisen','Rajgarh','Ratlam','Rewa','Sagar','Satna','Sehore','Seoni','Shahdol','Shajapur','Sheopur','Shivpuri','Sidhi','Singrauli','Tikamgarh','Ujjain','Umaria','Vidisha'],
    CG: ['Balod','Baloda Bazar','Balrampur-Ramanujganj','Bastar','Bemetara','Bijapur','Bilaspur','Dantewada','Dhamtari','Durg','Gariaband','Gaurela-Pendra-Marwahi','Janjgir-Champa','Jashpur','Kabirdham','Kanker','Khairagarh-Chhuikhadan-Gandai','Kondagaon','Korba','Koriya','Mahasamund','Manendragarh-Chirmiri-Bharatpur','Mohla-Manpur-Ambagarh Chowki','Mungeli','Narayanpur','Raigarh','Raipur','Rajnandgaon','Sakti','Sarangarh-Bilaigarh','Sukma','Surajpur','Surguja'],
    BR: ['Araria','Arwal','Aurangabad','Banka','Begusarai','Bhagalpur','Bhojpur','Buxar','Darbhanga','East Champaran','Gaya','Gopalganj','Jamui','Jehanabad','Kaimur','Katihar','Khagaria','Kishanganj','Lakhisarai','Madhepura','Madhubani','Munger','Muzaffarpur','Nalanda','Nawada','Patna','Purnia','Rohtas','Saharsa','Samastipur','Saran','Sheikhpura','Sheohar','Sitamarhi','Siwan','Supaul','Vaishali','West Champaran']
  };

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

  // POST transport for large payloads (attachments). JSONP is GET-only and
  // URL-length limited; saves/edits with files go over fetch. text/plain keeps
  // it a "simple" request (no CORS preflight), same approach as the GR module.
  function apiPost(action, payload) {
    var body = { action: action };
    for (var k in (payload || {})) if (payload[k] !== undefined) body[k] = payload[k];
    return fetch(CONFIG.GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify(body), redirect: 'follow' })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var res; try { res = JSON.parse(t); } catch (e) { throw new Error('Unexpected server response.'); }
        if (!res || res.ok === false) throw new Error((res && res.error) || 'Server error');
        return res.data;
      });
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { reject(new Error('Could not read ' + file.name)); };
      r.readAsDataURL(file);
    });
  }
  function readFiles(input) {
    var files = (input && input.files) ? Array.prototype.slice.call(input.files) : [];
    var big = files.filter(function (f) { return f.size > 25 * 1024 * 1024; });
    if (big.length) return Promise.reject(new Error('Each file must be under 25 MB.'));
    return Promise.all(files.map(function (f) {
      return fileToBase64(f).then(function (b) {
        return { name: f.name, mimeType: f.type || 'application/octet-stream', dataBase64: b };
      });
    }));
  }
  function lc(x) { return String(x == null ? '' : x).trim().toLowerCase(); }

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
    var pastModal = $('pcal-modal-past');
    if (pastModal && pastModal.classList.contains('open')) renderPastTable();
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
    if (name === 'past') renderPastTable();
  }

  function navigateMonth(dir) {
    viewMonth += dir;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    renderCalendar();
  }

  // ── ADD / EDIT EVENT MODAL ────────────────────────────────────────
  var REMINDER_CHOICES = [
    { label: '4 Weeks before', minutes: 40320 },
    { label: '2 Weeks before', minutes: 20160 },
    { label: '1 Week before',  minutes: 10080 },
    { label: '2 Days before',  minutes: 2880 },
    { label: '1 Day before',   minutes: 1440 },
    { label: '12 Hours before',minutes: 720 },
    { label: '2 Hours before', minutes: 120 },
    { label: '1 Hour before',  minutes: 60 },
    { label: '30 Min before',  minutes: 30 }
  ];
  var DEFAULT_REMINDERS = [ { minutes: 2880, method: 'email' }, { minutes: 120, method: 'email' } ];

  function fillStateSelect() {
    var sel = $('pcal-evt-state'); if (!sel) return;
    sel.innerHTML = '<option value="">Select state…</option>' +
      Object.keys(STATE_LABELS).map(function (c) {
        return '<option value="' + c + '">' + esc(STATE_LABELS[c]) + '</option>';
      }).join('');
  }
  function fillDistrictSelect(stateCode, selected) {
    var sel = $('pcal-evt-district'); if (!sel) return;
    if (!stateCode) { sel.innerHTML = '<option value="">Select state first…</option>'; sel.disabled = true; return; }
    var list = STATE_DISTRICTS[stateCode] || [];
    sel.innerHTML = '<option value="">Select district…</option>' +
      list.map(function (d) { return '<option value="' + esc(d) + '"' + (d === selected ? ' selected' : '') + '>' + esc(d) + '</option>'; }).join('');
    sel.disabled = false;
  }
  function onStateChange() { fillDistrictSelect($('pcal-evt-state').value, ''); }
  function onAllDayToggle() {
    var allday = $('pcal-evt-allday').checked;
    ['pcal-evt-start', 'pcal-evt-end'].forEach(function (id) {
      var el = $(id); if (!el) return;
      el.dataset.allday = allday ? '1' : '';
      if (el.dataset.iso) setDtField(id, el.dataset.iso, allday);
    });
  }

  function buildReminderRows(existing) {
    var box = $('pcal-reminders'); if (!box) return;
    var chosen = {};
    ((existing && existing.length) ? existing : DEFAULT_REMINDERS)
      .forEach(function (r) { chosen[Number(r.minutes)] = true; });
    box.innerHTML = '<div class="pcal-rem-grid">' + REMINDER_CHOICES.map(function (c) {
      return '<label class="pcal-rem-chk"><input type="checkbox" class="pcal-rem-when" value="' + c.minutes + '"' +
        (chosen[c.minutes] ? ' checked' : '') + '> ' + c.label + '</label>';
    }).join('') + '</div>' +
    '<div class="pcal-rem-note">Reminders are emailed to guests \u00b7 choose up to 5.</div>';
  }
  function gatherReminders() {
    var out = [];
    qsa('.pcal-rem-when').forEach(function (cb) {
      if (cb.checked && out.length < 5) out.push({ minutes: parseInt(cb.value, 10), method: 'email' });
    });
    return out;
  }
  function fillEventTypeSelect(selected) {
    var sel = $('pcal-evt-type'); if (!sel) return;
    sel.innerHTML = '<option value="">Select type\u2026</option>' +
      programs.map(function (p) {
        return '<option value="' + esc(p) + '"' + (p === selected ? ' selected' : '') + '>' + esc(p) + '</option>';
      }).join('');
  }

  function toLocalInput(iso, dateOnly) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d)) return '';
    var p = function (n) { return ('0' + n).slice(-2); };
    var base = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    return dateOnly ? base : base + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function fromLocalInput(val, dateOnly) {
    if (!val) return null;
    var d = dateOnly ? new Date(val + 'T00:00:00') : new Date(val);
    return isNaN(d) ? null : d;
  }
  function getDtISO(id) { var el = $(id); return el ? (el.dataset.iso || '') : ''; }
  function fmtDtDisplay(iso, allDay) {
    var d = new Date(iso); if (isNaN(d)) return '';
    var opt = allDay ? { day: '2-digit', month: 'short', year: 'numeric' }
                     : { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    return d.toLocaleString('en-IN', opt);
  }
  function setDtField(id, iso, allDay) {
    var el = $(id); if (!el || !iso) return;
    el.dataset.iso = new Date(iso).toISOString();
    el.dataset.allday = allDay ? '1' : '';
    el.value = fmtDtDisplay(iso, allDay);
  }
  var DTP_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var dtpState = { id: null, allDay: false, y: 0, mo: 0, d: 1, h: 9, mi: 0 };
  function ensureDtpDom() {
    if ($('pcal-dtp-overlay')) return;
    var ov = document.createElement('div');
    ov.id = 'pcal-dtp-overlay'; ov.className = 'pcal-dtp-overlay';
    ov.innerHTML = '<div class="pcal-dtp" id="pcal-dtp"></div>';
    root().appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.classList.remove('open'); });
  }
  function openDtPicker(id) {
    ensureDtpDom();
    var el = $(id);
    var allDay = !!(el && el.dataset.allday === '1');
    var base = (el && el.dataset.iso) ? new Date(el.dataset.iso) : new Date();
    if (isNaN(base)) base = new Date();
    dtpState = { id: id, allDay: allDay, y: base.getFullYear(), mo: base.getMonth(),
                 d: base.getDate(), h: base.getHours(), mi: base.getMinutes() };
    renderDtp();
    $('pcal-dtp-overlay').classList.add('open');
  }
  function renderDtp() {
    var box = $('pcal-dtp'); if (!box) return;
    var s = dtpState;
    var first = new Date(s.y, s.mo, 1).getDay();
    var days = new Date(s.y, s.mo + 1, 0).getDate();
    var cells = '';
    for (var i = 0; i < first; i++) cells += '<span class="pcal-dtp-day empty"></span>';
    for (var dd = 1; dd <= days; dd++)
      cells += '<span class="pcal-dtp-day' + (dd === s.d ? ' sel' : '') + '" data-dtp-day="' + dd + '">' + dd + '</span>';
    var timeHtml = '';
    if (!s.allDay) {
      var h12 = ((s.h % 12) || 12), ap = s.h < 12 ? 'AM' : 'PM';
      var hourOpts = ''; for (var hh = 1; hh <= 12; hh++) hourOpts += '<option value="' + hh + '"' + (hh === h12 ? ' selected' : '') + '>' + ('0' + hh).slice(-2) + '</option>';
      var minOpts = ''; for (var mm = 0; mm < 60; mm++) minOpts += '<option value="' + mm + '"' + (mm === s.mi ? ' selected' : '') + '>' + ('0' + mm).slice(-2) + '</option>';
      timeHtml = '<div class="pcal-dtp-time"><span class="pcal-dtp-clock">\uD83D\uDD52</span>' +
        '<select id="pcal-dtp-h">' + hourOpts + '</select><span>:</span>' +
        '<select id="pcal-dtp-mi">' + minOpts + '</select>' +
        '<select id="pcal-dtp-ap"><option' + (ap === 'AM' ? ' selected' : '') + '>AM</option><option' + (ap === 'PM' ? ' selected' : '') + '>PM</option></select></div>';
    }
    box.innerHTML =
      '<div class="pcal-dtp-head"><button class="pcal-dtp-nav" data-dtp-nav="-1">\u2039</button>' +
      '<div class="pcal-dtp-title">' + DTP_MONTHS[s.mo] + ' ' + s.y + '</div>' +
      '<button class="pcal-dtp-nav" data-dtp-nav="1">\u203A</button></div>' +
      '<div class="pcal-dtp-dow"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div>' +
      '<div class="pcal-dtp-grid">' + cells + '</div>' + timeHtml +
      '<div class="pcal-dtp-foot"><button class="btn-secondary small" id="pcal-dtp-cancel">Cancel</button>' +
      '<button class="btn-primary small" id="pcal-dtp-done">Done</button></div>';
    box.querySelectorAll('[data-dtp-nav]').forEach(function (b) {
      b.addEventListener('click', function () {
        s.mo += parseInt(b.getAttribute('data-dtp-nav'), 10);
        if (s.mo > 11) { s.mo = 0; s.y++; } if (s.mo < 0) { s.mo = 11; s.y--; }
        var maxd = new Date(s.y, s.mo + 1, 0).getDate(); if (s.d > maxd) s.d = maxd;
        renderDtp();
      });
    });
    box.querySelectorAll('[data-dtp-day]').forEach(function (c) {
      if (c.getAttribute('data-dtp-day')) c.addEventListener('click', function () { s.d = parseInt(c.getAttribute('data-dtp-day'), 10); renderDtp(); });
    });
    var cancel = $('pcal-dtp-cancel'); if (cancel) cancel.addEventListener('click', function () { $('pcal-dtp-overlay').classList.remove('open'); });
    var done = $('pcal-dtp-done'); if (done) done.addEventListener('click', function () {
      if (!s.allDay) {
        var h = parseInt($('pcal-dtp-h').value, 10) % 12;
        if ($('pcal-dtp-ap').value === 'PM') h += 12;
        s.h = h; s.mi = parseInt($('pcal-dtp-mi').value, 10);
      } else { s.h = 0; s.mi = 0; }
      var dt = new Date(s.y, s.mo, s.d, s.h, s.mi, 0);
      setDtField(s.id, dt.toISOString(), s.allDay);
      $('pcal-dtp-overlay').classList.remove('open');
    });
  }

  function findEvent(id) {
    for (var i = 0; i < events.length; i++) if (String(events[i].id) === String(id)) return events[i];
    return null;
  }

  function openAddEvent() { openEventModal(null); }
  function editEvent(id) {
    var evt = findEvent(id); if (!evt) return;
    if (new Date(evt.start).getTime() < Date.now()) { showToast('Past events are read-only.', true); return; }
    openEventModal(evt);
  }

  function openEventModal(evt) {
    if (!isAdmin) return;
    var isEdit = !!evt;
    $('pcal-add-title').textContent = isEdit ? '\u270F\uFE0F Edit Event' : '\u2795 Add New Event';
    $('pcal-evt-id').value = isEdit ? evt.id : '';
    $('pcal-evt-host').value = currentEmail || '';

    fillStateSelect();
    $('pcal-evt-state').value = isEdit ? (evt.state || '') : '';
    fillDistrictSelect(isEdit ? (evt.state || '') : '', isEdit ? (evt.district || '') : '');

    $('pcal-evt-name').value = isEdit ? (evt.eventName || evt.type || '') : '';
    $('pcal-evt-desc').value = isEdit ? (evt.desc || '') : '';
    $('pcal-evt-guests').value = isEdit
      ? (evt.guests || []).filter(function (g) { return lc(g) !== lc(currentEmail); }).join(', ') : '';
    $('pcal-evt-sendinvite').checked = isEdit ? (evt.sendInvite !== false) : true;

    fillEventTypeSelect(isEdit ? (evt.eventType || '') : '');
    $('pcal-evt-meet').checked = isEdit ? (!!evt.meetLink || !!evt.meet) : false;

    var allday = isEdit ? !!evt.allDay : false;
    $('pcal-evt-allday').checked = allday;
    ['pcal-evt-start', 'pcal-evt-end'].forEach(function (id) {
      var el = $(id); if (el) { el.dataset.allday = allday ? '1' : ''; el.dataset.iso = ''; el.value = ''; }
    });
    if (isEdit) { setDtField('pcal-evt-start', evt.start, allday); setDtField('pcal-evt-end', evt.end, allday); }

    buildReminderRows(isEdit ? evt.reminders : null);

    $('pcal-evt-files').value = '';
    var existBox = $('pcal-existing-attach');
    if (existBox) {
      var atts = (isEdit && evt.attachments) ? evt.attachments : [];
      existBox.innerHTML = atts.length
        ? 'Existing: ' + atts.map(function (a) { return '<a class="pcal-att-link" href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.name) + '</a>'; }).join(', ')
        : '';
    }

    clearFormErrors();
    $('pcal-modal-add').classList.add('open');
  }

  function clearFormErrors() {
['pcal-fg-state', 'pcal-fg-district', 'pcal-fg-type', 'pcal-fg-name', 'pcal-fg-start', 'pcal-fg-end']
      .forEach(function (id) { var el = $(id); if (el) el.classList.remove('has-error'); });
  }

  function saveEvent() {
    if (!isAdmin || busy) return;
    clearFormErrors();
    var id = $('pcal-evt-id').value;
    var isEdit = !!id;
    var state = $('pcal-evt-state').value;
    var district = $('pcal-evt-district').value;
    var name = $('pcal-evt-name').value.trim();
    var eventType = $('pcal-evt-type').value;
    var meet = $('pcal-evt-meet').checked;
    var allday = $('pcal-evt-allday').checked;
    var sISO = getDtISO('pcal-evt-start'), eISO = getDtISO('pcal-evt-end');
    var startD = sISO ? new Date(sISO) : null;
    var endD = eISO ? new Date(eISO) : null;
    var desc = $('pcal-evt-desc').value.trim();
    var guests = $('pcal-evt-guests').value;
    var sendInvite = $('pcal-evt-sendinvite').checked;
    var reminders = gatherReminders();
    var host = currentEmail || '';

    var valid = true;
    if (!state)    { $('pcal-fg-state').classList.add('has-error'); valid = false; }
    if (!district) { $('pcal-fg-district').classList.add('has-error'); valid = false; }
    if (!eventType){ $('pcal-fg-type').classList.add('has-error'); valid = false; }
    if (!name)     { $('pcal-fg-name').classList.add('has-error'); valid = false; }
    if (!startD)   { $('pcal-fg-start').classList.add('has-error'); valid = false; }
    if (!endD)     { $('pcal-fg-end').classList.add('has-error'); valid = false; }
    if (valid && endD.getTime() < startD.getTime()) { $('pcal-fg-end').classList.add('has-error'); showToast('End must be after start.', true); valid = false; }
    if (!host) { showToast('Could not determine your email (host).', true); valid = false; }
    if (!valid) return;

    var btn = $('pcal-save-event');
    setBusy(btn, true);
    var uname = (window.PROGRAM_CALENDAR_USER && window.PROGRAM_CALENDAR_USER.displayName) ||
                (window.__olfUser && window.__olfUser.displayName) || '';

    readFiles($('pcal-evt-files')).then(function (attachments) {
      var startISO = startD.toISOString(), endISO = endD.toISOString();
      var guestArr = guests.split(',').map(function (g) { return g.trim(); }).filter(Boolean);
      if (guestArr.map(lc).indexOf(lc(host)) === -1) guestArr.push(host);

      var priorAtt = [];
      if (isEdit) { var ex = findEvent(id); if (ex && ex.attachments) priorAtt = ex.attachments; }
      var tempId = isEdit ? id : ('tmp_' + Date.now());
      var optimistic = {
        id: tempId, googleEventId: isEdit ? ((findEvent(id) || {}).googleEventId || '') : '',
        state: state, district: district, eventName: name, eventType: eventType, type: eventType || name, desc: desc,
        start: startISO, end: endISO, allDay: allday,
        year: startD.getFullYear(), month: startD.getMonth(), day: startD.getDate(),
        host: host, guests: guestArr, reminders: reminders, sendInvite: sendInvite, meet: meet,
        meetLink: (isEdit ? ((findEvent(id) || {}).meetLink || '') : ''),
        attachments: priorAtt, savedByName: uname, savedByEmail: host, status: 'active', _saving: true
      };
      var prevEvents = events.slice();
      if (isEdit) events = events.map(function (e) { return String(e.id) === String(id) ? optimistic : e; });
      else events.push(optimistic);
      closeModal('pcal-modal-add');
      renderCalendar();
      showToast(isEdit ? 'Saving changes\u2026' : 'Saving event\u2026');

      var payload = {
        id: isEdit ? id : undefined,
        state: state, district: district, eventName: name, eventType: eventType, desc: desc,
        start: startISO, end: endISO, allDay: allday, meet: meet,
        host: host, guests: guestArr, reminders: reminders, sendInvite: sendInvite,
        attachments: attachments, savedByName: uname, savedByEmail: host
      };
      return apiPost(isEdit ? 'updateEvent' : 'saveEvent', payload)
        .then(function (res) {
          var saved = res && res.event;
          if (saved) events = events.map(function (e) { return String(e.id) === String(tempId) ? saved : e; });
          else { var keep = findEvent(tempId); if (keep) keep._saving = false; }
          renderCalendar();
          showToast(isEdit ? 'Event updated \u00B7 invites sent' : 'Event saved \u00B7 invites sent');
        })
        .catch(function (e) { events = prevEvents; renderCalendar(); showToast(e.message || 'Could not save event', true); });
    }).catch(function (e) {
      showToast(e.message || 'Could not read attachments', true);
    }).then(function () { setBusy(btn, false); });
  }

  // ── PAST / ALL EVENTS TABLE ───────────────────────────────────────
  function openPastEvents() { if (!isAdmin) return; switchTab('past'); }
  function fmtDateOnly(iso) { var d = new Date(iso); return isNaN(d) ? String(iso || '\u2014') : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  function fmtDateTime(iso) { var d = new Date(iso); return isNaN(d) ? String(iso || '\u2014') : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  function sameDay(a, b) { return new Date(a).toDateString() === new Date(b).toDateString(); }
  function renderPastTable() {
    var box = $('pcal-past-table'); if (!box) return;
    var sorted = events.slice().sort(function (a, b) { return new Date(a.start) - new Date(b.start); });
    if (!sorted.length) { box.innerHTML = '<div class="empty-state" style="padding:20px">No events yet.</div>'; return; }
    var nowT = Date.now();
    var rows = sorted.map(function (e) {
      var past = new Date(e.start).getTime() < nowT;
      var when = e.allDay ? fmtDateOnly(e.start) : fmtDateTime(e.start);
      var copyBtn = '<button class="pcal-mini pcal-mini-copy" data-pcal-copy="' + esc(e.id) + '">Copy</button>';
      var actions = e._saving ? '<span class="pcal-badge-up">saving\u2026</span>'
        : (past ? copyBtn + '<button class="pcal-mini pcal-mini-del" data-pcal-del="' + esc(e.id) + '">Delete</button>'
                : '<button class="pcal-mini pcal-mini-edit" data-pcal-edit="' + esc(e.id) + '">Edit</button>' + copyBtn + '<button class="pcal-mini pcal-mini-del" data-pcal-del="' + esc(e.id) + '">Delete</button>');
      return '<tr>' +
        '<td>' + esc(e.eventName || '\u2014') + '</td>' +
        '<td>' + esc(e.eventType || e.type || '\u2014') + '</td>' +
        '<td>' + esc(e.district) + '</td>' +
        '<td>' + esc(when) + '</td>' +
        '<td>' + esc(e.host || '\u2014') + '</td>' +
        '<td>' + ((e.guests && e.guests.length) ? e.guests.length : 0) + '</td>' +
        '<td>' + (past ? '<span class="pcal-badge-past">Past</span>' : '<span class="pcal-badge-up">Upcoming</span>') + '</td>' +
        '<td style="white-space:nowrap">' + actions + '</td></tr>';
    }).join('');
    box.innerHTML = '<div class="pcal-past-wrap"><table class="pcal-past-tbl"><thead><tr>' +
      '<th>Event</th><th>Type</th><th>District</th><th>Start</th><th>Host</th><th>Guests</th><th>Status</th><th>Action</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function copyEvent(id) {
    if (!isAdmin) return;
    var e = findEvent(id); if (!e) return;
    var clone = {
      state: e.state, district: e.district, eventName: e.eventName, eventType: e.eventType || e.type,
      desc: e.desc, allDay: e.allDay, start: e.start, end: e.end,
      guests: (e.guests || []).slice(), reminders: (e.reminders || []).slice(),
      sendInvite: e.sendInvite, meetLink: e.meetLink, meet: !!e.meetLink, attachments: []
    };
    switchTab('calendar');
    openEventModal(clone);            // no id -> saved as a brand-new event
    $('pcal-evt-id').value = '';
    $('pcal-add-title').textContent = '\u2795 Copy Event';
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
    var evt = findEvent(id);
    if (!evt) return;
    var body = $('pcal-details-body');
    if (!body) return;
    var color = getProgramColor(evt.type);
    function row(label, val) { return '<div class="pcal-detail-row"><span class="pcal-detail-label">' + label + '</span><span class="pcal-detail-val">' + val + '</span></div>'; }
    var when = evt.allDay
      ? (fmtDateOnly(evt.start) + (sameDay(evt.start, evt.end) ? '' : ' \u2192 ' + fmtDateOnly(evt.end)) + ' (all day)')
      : (fmtDateTime(evt.start) + ' \u2192 ' + fmtDateTime(evt.end));
    var atts = (evt.attachments || []).map(function (a) { return '<a class="pcal-att-link" href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.name) + '</a>'; }).join(', ');
    body.innerHTML =
      row('Event', '<span class="pcal-detail-dot" style="background:' + color + '"></span>' + esc(evt.eventName || evt.type)) +
      row('When', esc(when)) +
      row('State', esc(STATE_LABELS[evt.state] || evt.state || '\u2014')) +
      row('District', '\uD83D\uDCCD ' + esc(evt.district)) +
      row('Host', esc(evt.host || '\u2014')) +
      ((evt.guests && evt.guests.length) ? row('Guests', esc(evt.guests.join(', '))) : '') +
      (evt.desc ? '<div class="pcal-detail-row col"><span class="pcal-detail-label">Description</span><div class="pcal-detail-desc">' + esc(evt.desc) + '</div></div>' : '') +
      (atts ? row('Attachments', atts) : '') +
      (evt.savedByEmail ? row('Added by', '<span class="pcal-detail-muted">' + esc(evt.savedByName ? (evt.savedByName + ' \u00B7 ') : '') + esc(evt.savedByEmail) + '</span>') : '');
    $('pcal-modal-details').classList.add('open');
  }

  // ── SETTINGS ──────────────────────────────────────────────────────
  function renderSettings() { renderProgramList(); }

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
      var st = $('pcal-tab-settings'), pt = $('pcal-tab-past');
      if ((st && st.classList.contains('active')) || (pt && pt.classList.contains('active'))) switchTab('calendar');
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

    on('pcal-evt-state', 'change', onStateChange);
    on('pcal-evt-allday', 'change', onAllDayToggle);
    on('pcal-evt-start', 'click', function () { openDtPicker('pcal-evt-start'); });
    on('pcal-evt-end', 'click', function () { openDtPicker('pcal-evt-end'); });
    on('pcal-save-event', 'click', saveEvent);
    on('pcal-past-btn', 'click', openPastEvents);

    r.querySelectorAll('[data-pcal-close]').forEach(function (btn) {
      btn.addEventListener('click', function () { closeModal(btn.getAttribute('data-pcal-close')); });
    });
    var overlay = $('pcal-modal-add');
    if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.classList.remove('open'); });
    var dOverlay = $('pcal-modal-details');
    if (dOverlay) dOverlay.addEventListener('click', function (e) { if (e.target === dOverlay) dOverlay.classList.remove('open'); });
    var pOverlay = $('pcal-modal-past');
    if (pOverlay) pOverlay.addEventListener('click', function (e) { if (e.target === pOverlay) pOverlay.classList.remove('open'); });
    delegate('pcal-past-table', '[data-pcal-edit]', function (btn) { editEvent(btn.getAttribute('data-pcal-edit')); });
    delegate('pcal-past-table', '[data-pcal-copy]', function (btn) { copyEvent(btn.getAttribute('data-pcal-copy')); });
    delegate('pcal-past-table', '[data-pcal-del]', function (btn) { deleteEvent(btn.getAttribute('data-pcal-del')); });

    // Click an event card to view full details (ignore clicks on its delete button)
    var listEl = $('pcal-events-list');
    if (listEl) listEl.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-pcal-del-event]')) return;
      var card = e.target.closest ? e.target.closest('[data-pcal-view-event]') : null;
      if (card) openEventDetails(card.getAttribute('data-pcal-view-event'));
    });

    on('pcal-add-program-btn', 'click', addProgram);
    on('pcal-new-program', 'keydown', function (e) { if (e.key === 'Enter') addProgram(); });

    // Delegation for dynamically-rendered delete buttons
    delegate('pcal-events-list', '[data-pcal-del-event]', function (btn) {
      deleteEvent(btn.getAttribute('data-pcal-del-event'));
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