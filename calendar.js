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
    REQUEST_TIMEOUT_MS: 20000,
    // Bulk Excel import
    EXCELJS_URL: 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
    BULK_MAX_ROWS: 200,
    BULK_CHUNK_SIZE: 10,
    BULK_CHUNK_TIMEOUT_MS: 180000
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

  // Apps Script occasionally answers with 500 or drops a request (its
  // per-user concurrency limit is easy to trip). Those failures are
  // transient, so a read is retried once after a short pause rather
  // than being reported to the user. Writes are NOT retried - repeating
  // a save could duplicate a row.
  function apiRead(action, payload, attempt) {
    attempt = attempt || 0;
    return api(action, payload).catch(function (err) {
      if (attempt >= 1) throw err;
      console.warn('[ProgramCalendar] ' + action + ' failed, retrying once:', err && err.message);
      return new Promise(function (r) { setTimeout(r, 700); })
        .then(function () { return apiRead(action, payload, attempt + 1); });
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

  // Same transport as apiPost, with an abort timeout. Used for bulk import
  // chunks so a dead connection surfaces as a clear stop rather than hanging
  // forever. An aborted chunk may still have been applied server-side, which
  // is why every bulk row carries a dedupe key.
  function apiPostTimed(action, payload, timeoutMs) {
    var body = { action: action };
    for (var k in (payload || {})) if (payload[k] !== undefined) body[k] = payload[k];
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var opts = { method: 'POST', body: JSON.stringify(body), redirect: 'follow' };
    if (ctrl) opts.signal = ctrl.signal;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs || 180000);
    return fetch(CONFIG.GAS_WEB_APP_URL, opts)
      .then(function (r) { return r.text(); })
      .then(function (t) {
        clearTimeout(timer);
        var res; try { res = JSON.parse(t); } catch (e) { throw new Error('Unexpected server response.'); }
        if (!res || res.ok === false) throw new Error((res && res.error) || 'Server error');
        return res.data;
      }, function (err) {
        clearTimeout(timer);
        if (err && err.name === 'AbortError') throw new Error('The server did not answer in time.');
        throw err;
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
  // The Apps Script round trip is the single slowest thing on this page,
  // so the last payload is kept in localStorage. A cold load paints from
  // it at once and the server call happens in the background; only a
  // genuinely first-ever visit has to wait.
  var LS_KEY     = 'olf_pcal_cache_v1';
  var LS_MAX_AGE = 7 * 24 * 60 * 60 * 1000;   // a week-old copy is still fine as a first paint

  function loadFromLocal() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      var box = JSON.parse(raw);
      if (!box || !box.events || !box.savedAt) return false;
      if (Date.now() - box.savedAt > LS_MAX_AGE) return false;
      events    = box.events    || [];
      districts = box.districts || [];
      programs  = box.programs  || [];
      rebuildProgramColors();
      return true;
    } catch (e) {
      return false;
    }
  }

  function persistLocal() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        savedAt: Date.now(), events: events, districts: districts, programs: programs
      }));
    } catch (e) {
      // Quota or private mode: drop the cache and carry on uncached.
      try { localStorage.removeItem(LS_KEY); } catch (e2) {}
    }
  }

  var inFlightLoad = null;      // shared promise, so parallel callers coalesce
  var lastLoadAt   = 0;
  var LOAD_MIN_GAP = 45000;     // ms; a repeat visit inside this reuses what we have

  function loadAll(opts) {
    var force = !!(opts && opts.force);

    // Already asking: hand back the same promise instead of firing a
    // second identical request alongside it.
    if (inFlightLoad) return inFlightLoad;

    // Asked very recently and we already have data: nothing to do.
    if (!force && loadedOnce && (Date.now() - lastLoadAt) < LOAD_MIN_GAP) {
      return Promise.resolve();
    }

    inFlightLoad = apiRead('getAll').then(function (data) {
      events    = (data && data.events)    || [];
      districts = (data && data.districts) || [];
      programs  = (data && data.programs)  || [];
      rebuildProgramColors();
      loadedOnce = true;
      lastLoadAt = Date.now();
      persistLocal();
    }).then(function () {
      inFlightLoad = null;
    }, function (err) {
      inFlightLoad = null;
      throw err;
    });

    return inFlightLoad;
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
    if ((name === 'settings' || name === 'bulk') && !isAdmin) return;
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
    if (name === 'bulk') renderBulkPanel();
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
          persistLocal();
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
        persistLocal();
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

  // ── BULK IMPORT FROM EXCEL (admin only) ───────────────────────────
  // Download a template whose dropdowns are built from the SAME lists the
  // Add Event form uses, fill it offline, upload it back. Nothing is sent
  // to the server until the confirmation dialog is accepted, and nothing
  // is reported as created unless the backend echoed it back.

  var BULK_COLS = [
    { key: 'state',      header: 'State *',                        width: 18, list: 'states' },
    { key: 'district',   header: 'District *',                      width: 24, list: 'districts' },
    { key: 'eventType',  header: 'Event Type *',                    width: 22, list: 'types' },
    { key: 'eventName',  header: 'Event Name *',                    width: 32 },
    { key: 'startDate',  header: 'Start Date * (DD-MM-YYYY)',       width: 20, text: true },
    { key: 'startTime',  header: 'Start Time (HH:MM, 24 hr)',       width: 20, text: true },
    { key: 'endDate',    header: 'End Date (DD-MM-YYYY)',           width: 20, text: true },
    { key: 'endTime',    header: 'End Time (HH:MM, 24 hr)',         width: 20, text: true },
    { key: 'allDay',     header: 'All Day',                         width: 11, list: 'yesno' },
    { key: 'host',       header: 'Host Email',                      width: 30 },
    { key: 'guests',     header: 'Guest Emails (comma separated)',  width: 44 },
    { key: 'sendInvite', header: 'Send Invites',                    width: 14, list: 'yesno' },
    { key: 'meet',       header: 'Google Meet',                     width: 14, list: 'yesno' },
    { key: 'reminders',  header: 'Reminders',                       width: 34, list: 'reminders' },
    { key: 'desc',       header: 'Description',                     width: 44 }
  ];

  // Header text -> key. Matching is done on a normalised header (lower case,
  // bracketed hints and * removed) so re-typed or re-ordered headers survive.
  var BULK_HEADER_MAP = {
    'state': 'state',
    'district': 'district',
    'event type': 'eventType', 'type': 'eventType', 'program': 'eventType', 'program type': 'eventType',
    'event name': 'eventName', 'name': 'eventName', 'event': 'eventName',
    'start date': 'startDate', 'start': 'startDate', 'from date': 'startDate',
    'start time': 'startTime',
    'end date': 'endDate', 'end': 'endDate', 'to date': 'endDate',
    'end time': 'endTime',
    'all day': 'allDay', 'all day event': 'allDay', 'allday': 'allDay',
    'host email': 'host', 'host': 'host',
    'guest emails': 'guests', 'guests': 'guests', 'guest email': 'guests',
    'send invites': 'sendInvite', 'send invite': 'sendInvite', 'invites': 'sendInvite',
    'google meet': 'meet', 'meet': 'meet', 'video link': 'meet',
    'reminders': 'reminders', 'reminder': 'reminders',
    'description': 'desc', 'desc': 'desc', 'notes': 'desc'
  };

  var BULK_REMINDER_PRESETS = [
    { label: 'Default (2 days + 2 hours before)', minutes: [2880, 120] },
    { label: '1 week + 1 day before',             minutes: [10080, 1440] },
    { label: '4 weeks + 1 week + 1 day before',   minutes: [40320, 10080, 1440] },
    { label: '1 week before',                     minutes: [10080] },
    { label: '1 day before',                      minutes: [1440] },
    { label: '2 hours before',                    minutes: [120] },
    { label: 'None',                              minutes: [] }
  ];

  var BULK_TEMPLATE_ROWS = 300;   // rows that carry dropdowns in the template
  var BULK_MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  var bulkParsed  = null;    // rows that passed validation, awaiting confirmation
  var bulkRunning = false;   // an import is in flight
  var excelLibPromise = null;

  // Leaving mid-import would abandon rows that were never sent.
  if (!window.__pcalBulkUnloadGuard) {
    window.__pcalBulkUnloadGuard = true;
    window.addEventListener('beforeunload', function (e) {
      if (!bulkRunning) return;
      var msg = 'Events are still being created. Leaving now will stop the import.';
      e.preventDefault();
      e.returnValue = msg;
      return msg;
    });
  }

  function bulkAllDistricts() {
    var out = [];
    Object.keys(STATE_DISTRICTS).forEach(function (code) {
      (STATE_DISTRICTS[code] || []).forEach(function (d) { if (out.indexOf(d) === -1) out.push(d); });
    });
    return out.sort();
  }
  function bulkStateOfDistrict(name) {
    var codes = Object.keys(STATE_DISTRICTS);
    for (var i = 0; i < codes.length; i++) {
      var list = STATE_DISTRICTS[codes[i]] || [];
      for (var j = 0; j < list.length; j++) if (lc(list[j]) === lc(name)) return codes[i];
    }
    return '';
  }
  function bulkStateCodeFromLabel(v) {
    var s = lc(v);
    if (!s) return '';
    var codes = Object.keys(STATE_LABELS);
    for (var i = 0; i < codes.length; i++) {
      if (s === lc(codes[i]) || s === lc(STATE_LABELS[codes[i]])) return codes[i];
    }
    return '';
  }
  function bulkNormHeader(v) {
    return String(v == null ? '' : v)
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\*/g, ' ')
      .replace(/[_\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  // ── Excel library (loaded on first use only) ──────────────────────
  function loadExcelLib() {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    if (excelLibPromise) return excelLibPromise;
    excelLibPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = CONFIG.EXCELJS_URL;
      s.onload = function () {
        if (window.ExcelJS) resolve(window.ExcelJS);
        else { excelLibPromise = null; reject(new Error('Excel library loaded but did not initialise.')); }
      };
      s.onerror = function () {
        excelLibPromise = null;
        reject(new Error('Could not load the Excel library. Check your internet connection and try again.'));
      };
      document.head.appendChild(s);
    });
    return excelLibPromise;
  }

  // ── TEMPLATE ──────────────────────────────────────────────────────
  function buildTemplateWorkbook(ExcelJS) {
    var wb = new ExcelJS.Workbook();
    wb.creator = 'OLF Staff Connect \u00b7 Program Calendar';
    wb.created = new Date();

    var ws    = wb.addWorksheet('Events', { views: [{ state: 'frozen', ySplit: 1 }] });
    var inst  = wb.addWorksheet('Instructions');
    var lists = wb.addWorksheet('Lists');

    // Lists sheet — feeds every dropdown. Hidden, but not locked.
    var stateLabels = Object.keys(STATE_LABELS).map(function (c) { return STATE_LABELS[c]; });
    var districtAll = bulkAllDistricts();
    var typeList    = (programs || []).slice();
    var listCols = [
      { title: 'States',     values: stateLabels },
      { title: 'Districts',  values: districtAll },
      { title: 'EventTypes', values: typeList },
      { title: 'YesNo',      values: ['Yes', 'No'] },
      { title: 'Reminders',  values: BULK_REMINDER_PRESETS.map(function (r) { return r.label; }) }
    ];
    listCols.forEach(function (col, i) {
      lists.getColumn(i + 1).values = [col.title].concat(col.values);
      lists.getColumn(i + 1).width = 28;
    });
    lists.getRow(1).font = { bold: true };
    lists.state = 'hidden';

    var listRange = {
      states:    'Lists!$A$2:$A$' + (1 + stateLabels.length),
      districts: 'Lists!$B$2:$B$' + (1 + districtAll.length),
      types:     'Lists!$C$2:$C$' + (1 + Math.max(typeList.length, 1)),
      yesno:     'Lists!$D$2:$D$3',
      reminders: 'Lists!$E$2:$E$' + (1 + BULK_REMINDER_PRESETS.length)
    };

    // Events sheet — header + dropdowns, no sample rows (a forgotten sample
    // row would become a real event with real invites).
    ws.getRow(1).values = BULK_COLS.map(function (c) { return c.header; });
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
    ws.getRow(1).alignment = { vertical: 'middle', wrapText: true };
    ws.getRow(1).height = 34;

    BULK_COLS.forEach(function (col, i) {
      var n = i + 1;
      ws.getColumn(n).width = col.width;
      if (col.text) ws.getColumn(n).numFmt = '@';   // keep dates exactly as typed
      var letter = ws.getColumn(n).letter;
      var range = letter + '2:' + letter + BULK_TEMPLATE_ROWS;
      if (col.list) {
        ws.dataValidations.add(range, {
          type: 'list',
          allowBlank: true,
          formulae: [listRange[col.list]],
          showErrorMessage: true,
          errorStyle: 'stop',
          errorTitle: 'Please pick from the list',
          error: 'Choose one of the values in the dropdown for this column.'
        });
      }
    });

    // Instructions sheet
    inst.getColumn(1).width = 30;
    inst.getColumn(2).width = 96;
    function head(t) {
      var r = inst.addRow([t, '']);
      r.font = { bold: true, size: 12, color: { argb: 'FF1D4ED8' } };
      return r;
    }
    function line(a, b) {
      var r = inst.addRow([a, b]);
      r.getCell(1).font = { bold: true };
      r.getCell(2).alignment = { wrapText: true, vertical: 'top' };
      r.getCell(1).alignment = { vertical: 'top' };
      return r;
    }
    head('PROGRAM CALENDAR \u00b7 BULK EVENT UPLOAD');
    inst.addRow(['', 'Fill the "Events" sheet, one row per event, then upload this file in Staff Connect \u2192 Program Calendar \u2192 Bulk Import.']);
    inst.addRow(['', '']);
    head('BEFORE YOU START');
    line('One row = one event', 'Each row creates one real event in the Program Insights Google Calendar and emails invites to its guests.');
    line('Do not add or rename columns', 'Column headings are matched by name. Extra columns are ignored; renamed ones may not be read.');
    line('Use the dropdowns', 'State, District, Event Type, All Day, Send Invites, Google Meet and Reminders are dropdown-only. Typed values that are not on the list will be rejected.');
    line('Nothing saves on upload', 'After uploading you see a summary and must confirm. If any row has an error, the whole file is rejected \u2014 fix it and upload again.');
    line('Row limit', 'Up to ' + CONFIG.BULK_MAX_ROWS + ' events per file.');
    inst.addRow(['', '']);
    head('COLUMN BY COLUMN');
    line('State *', 'Dropdown. Maharashtra, Madhya Pradesh, Chhattisgarh or Bihar. May be left blank \u2014 it is filled in from the District.');
    line('District *', 'Dropdown. Must belong to the chosen State.');
    line('Event Type *', 'Dropdown. Current types: ' + (typeList.length ? typeList.join(', ') : '(none set up yet \u2014 add them in Settings first)') + '.');
    line('Event Name *', 'Free text, up to 200 characters. This is the title guests see, e.g. "Shikshan Utsav \u2014 Pune".');
    line('Start Date *', 'DD-MM-YYYY, e.g. 15-08-2026. 2026-08-15 and 15/08/2026 are also accepted.');
    line('Start Time', '24-hour HH:MM, e.g. 09:30 or 14:00. Required unless All Day is Yes.');
    line('End Date', 'Leave blank for a single-day event. Must not be before Start Date.');
    line('End Time', '24-hour HH:MM. Required unless All Day is Yes. Must be after Start Time on a single-day event.');
    line('All Day', 'Yes / No. Blank = No. Yes means the times are ignored.');
    line('Host Email', 'Leave blank to host it yourself. The host always receives the invite.');
    line('Guest Emails', 'Comma separated, e.g. a@openlinksfoundation.org, b@openlinksfoundation.org. Up to 100 per event. Leave blank for none.');
    line('Send Invites', 'Yes / No. Blank = Yes. No still creates the event but emails nobody.');
    line('Google Meet', 'Yes / No. Blank = No. Yes adds a Meet video link.');
    line('Reminders', 'Dropdown. Blank = ' + BULK_REMINDER_PRESETS[0].label + '. Reminders are emailed to guests.');
    line('Description', 'Optional, up to 500 characters.');
    inst.addRow(['', '']);
    head('EXAMPLE ROW');
    inst.addRow(['', BULK_COLS.map(function (c) { return bulkNormHeader(c.header); }).join(' | ')]);
    inst.addRow(['', ['Maharashtra', 'Pune', (typeList[0] || 'Academic Program'), 'Shikshan Utsav \u2014 Pune',
      '15-08-2026', '09:30', '15-08-2026', '17:00', 'No', '', 'amit@openlinksfoundation.org', 'Yes', 'No',
      BULK_REMINDER_PRESETS[0].label, 'District level celebration'].join(' | ')]);
    inst.addRow(['', '']);
    head('NOT SUPPORTED HERE');
    line('Attachments', 'Files cannot be uploaded through Excel. Add an event first, then use Edit on that event to attach files.');
    line('Editing / deleting', 'This upload only creates new events. Changes and deletions are done from the calendar screen.');
    line('Repeat uploads', 'Re-uploading the same file is safe \u2014 events already created are detected and skipped, not duplicated.');
    inst.getRow(1).height = 22;

    return wb;
  }

  function downloadTemplate() {
    if (!isAdmin || bulkRunning) return;
    var btn = $('pcal-bulk-download');
    var note = $('pcal-bulk-dl-note');
    if (!programs || !programs.length) {
      showToast('No event types set up yet \u2014 add them under Settings first.', true);
      return;
    }
    setBusy(btn, true, 'Preparing\u2026');
    if (note) note.textContent = 'Building the template with the current event types and districts\u2026';
    loadExcelLib()
      .then(function (ExcelJS) { return buildTemplateWorkbook(ExcelJS).xlsx.writeBuffer(); })
      .then(function (buf) {
        var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        var stamp = new Date();
        var p2 = function (n) { return ('0' + n).slice(-2); };
        var fname = 'Program-Calendar-Bulk-Upload-' + stamp.getFullYear() + p2(stamp.getMonth() + 1) + p2(stamp.getDate()) + '.xlsx';
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = fname;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        if (note) note.textContent = 'Downloaded ' + fname + ' \u00b7 ' + (programs || []).length +
          ' event types and ' + bulkAllDistricts().length + ' districts included as dropdowns.';
        showToast('Template downloaded.');
      })
      .catch(function (e) {
        if (note) note.textContent = '';
        showToast(e.message || 'Could not build the template', true);
      })
      .then(function () { setBusy(btn, false, '\u2b07 Download Excel Template'); });
  }

  // ── CELL READERS ──────────────────────────────────────────────────
  function bulkCellText(v) {
    if (v == null) return '';
    if (v instanceof Date) return bulkDateToText(v);
    if (typeof v === 'object') {
      if (v.richText) return v.richText.map(function (t) { return t.text || ''; }).join('').trim();
      if (v.text != null) return String(v.text).trim();
      if (v.result != null) return String(v.result).trim();
      if (v.hyperlink) return String(v.hyperlink).trim();
      return '';
    }
    return String(v).trim();
  }
  function bulkDateToText(d) {
    var p = bulkDateParts(d);
    return p ? (('0' + p.d).slice(-2) + '-' + ('0' + p.m).slice(-2) + '-' + p.y) : '';
  }
  // Excel date cells arrive as UTC-anchored Dates; a locally-anchored Date
  // (some producers) must be read with the local getters or the day slips.
  function bulkDateParts(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return null;
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) {
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
    }
    if (d.getHours() === 0 && d.getMinutes() === 0) {
      return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
    }
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
  }
  function bulkTimeParts(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return null;
    return { h: d.getUTCHours(), mi: d.getUTCMinutes() };
  }
  function bulkSerialToDate(n) {
    // Excel serial 25569 === 1970-01-01.
    return new Date(Math.round((Number(n) - 25569) * 86400000));
  }
  function bulkDaysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

  // -> { y, m, d } or null
  function parseDateCell(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return bulkDateParts(v);
    if (typeof v === 'number') {
      if (v < 1 || v > 80000) return null;
      return bulkDateParts(bulkSerialToDate(Math.floor(v)));
    }
    var s = bulkCellText(v);
    if (!s) return null;
    var y, m, d, mo;
    var iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    var dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    var dmy2 = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
    var txt = s.match(/^(\d{1,2})[\s-]+([A-Za-z]{3,})[\s-]+(\d{4})$/);
    if (iso)       { y = +iso[1]; m = +iso[2]; d = +iso[3]; }
    else if (dmy)  { d = +dmy[1]; m = +dmy[2]; y = +dmy[3]; }
    else if (dmy2) { d = +dmy2[1]; m = +dmy2[2]; y = 2000 + (+dmy2[3]); }
    else if (txt)  {
      mo = BULK_MONTH_ABBR.indexOf(txt[2].slice(0, 3).toLowerCase());
      if (mo < 0) return null;
      d = +txt[1]; m = mo + 1; y = +txt[3];
    } else return null;
    if (!(y >= 2000 && y <= 2100) || !(m >= 1 && m <= 12)) return null;
    if (!(d >= 1 && d <= bulkDaysInMonth(y, m))) return null;
    return { y: y, m: m, d: d };
  }

  // -> { h, mi } or null
  function parseTimeCell(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return bulkTimeParts(v);
    if (typeof v === 'number') {
      var frac = Number(v) - Math.floor(Number(v));
      var mins = Math.round(frac * 1440);
      if (mins >= 1440) mins = 1439;
      return { h: Math.floor(mins / 60), mi: mins % 60 };
    }
    var s = bulkCellText(v).toLowerCase().replace(/\s+/g, '');
    if (!s) return null;
    var ampm = '';
    var mm = s.match(/(am|pm)$/);
    if (mm) { ampm = mm[1]; s = s.slice(0, -2); }
    var parts = s.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/) || s.match(/^(\d{1,2})$/);
    if (!parts) return null;
    var h = +parts[1], mi = parts[2] != null ? +parts[2] : 0;
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    if (!(h >= 0 && h <= 23) || !(mi >= 0 && mi <= 59)) return null;
    return { h: h, mi: mi };
  }

  // '', Yes/No, TRUE/FALSE, 1/0 -> true / false / null(blank) / undefined(bad)
  function parseBoolCell(v) {
    if (v === true || v === false) return v;
    var s = bulkCellText(v).toLowerCase();
    if (s === '') return null;
    if (s === 'yes' || s === 'y' || s === 'true' || s === '1') return true;
    if (s === 'no' || s === 'n' || s === 'false' || s === '0') return false;
    return undefined;
  }

  function bulkValidEmail(s) { return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(String(s || '').trim()); }

  function bulkRowKey(ev) {
    return [lc(ev.eventType), lc(ev.district), lc(ev.eventName), ev.start, ev.end, lc(ev.host)]
      .join('|').slice(0, 380);
  }

  // ── PARSE + VALIDATE ──────────────────────────────────────────────
  function parseBulkWorkbook(wb) {
    var ws = wb.getWorksheet('Events');
    if (!ws) {
      wb.eachSheet(function (s) { if (!ws && lc(s.name) !== 'instructions' && lc(s.name) !== 'lists') ws = s; });
    }
    if (!ws) throw new Error('No "Events" sheet found in this file. Please use the downloaded template.');

    var headerRow = ws.getRow(1);
    var colOf = {};
    var seenHeaders = 0;
    headerRow.eachCell({ includeEmpty: false }, function (cell, colNumber) {
      var key = BULK_HEADER_MAP[bulkNormHeader(bulkCellText(cell.value))];
      if (key && !colOf[key]) { colOf[key] = colNumber; seenHeaders++; }
    });
    if (!seenHeaders) throw new Error('The first row of the "Events" sheet does not look like the template headings. Please use the downloaded template.');

    var missing = ['state', 'district', 'eventType', 'eventName', 'startDate']
      .filter(function (k) { return !colOf[k]; });
    if (missing.length) {
      throw new Error('These template columns are missing: ' +
        missing.map(function (k) {
          return (BULK_COLS.filter(function (c) { return c.key === k; })[0] || {}).header || k;
        }).join(', ') + '.');
    }

    var raw = [];
    var lastRow = ws.actualRowCount ? Math.max(ws.rowCount, ws.actualRowCount) : ws.rowCount;
    for (var rn = 2; rn <= lastRow; rn++) {
      var row = ws.getRow(rn);
      var cells = {}, blank = true;
      BULK_COLS.forEach(function (c) {
        var col = colOf[c.key];
        var val = col ? row.getCell(col).value : null;
        cells[c.key] = val;
        if (val != null && bulkCellText(val) !== '') blank = false;
      });
      if (blank) continue;
      cells.__rowNo = rn;
      raw.push(cells);
      if (raw.length > CONFIG.BULK_MAX_ROWS + 1) break;
    }
    return raw;
  }

  function validateBulkRows(raw) {
    var errors = [], warnings = [], rows = [];
    var uploader = currentEmail || '';
    var typeLower = (programs || []).map(lc);
    var seenKeys = {};
    var existingKeys = {};
    (events || []).forEach(function (e) {
      existingKeys[bulkRowKey({
        eventType: e.eventType || e.type || '', district: e.district || '',
        eventName: e.eventName || '', start: e.start || '', end: e.end || '', host: e.host || ''
      })] = true;
    });

    if (raw.length > CONFIG.BULK_MAX_ROWS) {
      errors.push({ row: 0, col: '', msg: 'This file has ' + raw.length + ' rows. Please upload at most ' +
        CONFIG.BULK_MAX_ROWS + ' events at a time.' });
      return { rows: [], errors: errors, warnings: warnings };
    }

    raw.forEach(function (c) {
      var rn = c.__rowNo;
      var rowErr = errors.length;
      function bad(col, msg) { errors.push({ row: rn, col: col, msg: msg }); }
      function warn(col, msg) { warnings.push({ row: rn, col: col, msg: msg }); }

      // District first — it pins the state down on its own.
      var districtRaw = bulkCellText(c.district);
      var district = '';
      var allD = bulkAllDistricts();
      for (var i = 0; i < allD.length; i++) if (lc(allD[i]) === lc(districtRaw)) { district = allD[i]; break; }
      if (!districtRaw) bad('District', 'District is required.');
      else if (!district) bad('District', '"' + districtRaw + '" is not in the district list. Pick from the dropdown.');

      var stateRaw = bulkCellText(c.state);
      var state = bulkStateCodeFromLabel(stateRaw);
      if (stateRaw && !state) bad('State', '"' + stateRaw + '" is not a valid state. Pick from the dropdown.');
      if (district) {
        var owner = bulkStateOfDistrict(district);
        if (!state) state = owner;
        else if (state !== owner) {
          bad('State', district + ' is in ' + (STATE_LABELS[owner] || owner) + ', not ' + (STATE_LABELS[state] || state) + '.');
        }
      } else if (!stateRaw) bad('State', 'State is required when the district is not recognised.');

      var typeRaw = bulkCellText(c.eventType);
      var eventType = '';
      if (!typeRaw) bad('Event Type', 'Event Type is required.');
      else {
        var ti = typeLower.indexOf(lc(typeRaw));
        if (ti < 0) bad('Event Type', '"' + typeRaw + '" is not a known event type. Pick from the dropdown.');
        else eventType = programs[ti];
      }

      var eventName = bulkCellText(c.eventName);
      if (!eventName) bad('Event Name', 'Event Name is required.');
      else if (eventName.length > 200) bad('Event Name', 'Event Name is longer than 200 characters.');

      var allDay = parseBoolCell(c.allDay);
      if (allDay === undefined) { bad('All Day', 'Use Yes or No.'); allDay = false; }
      allDay = !!allDay;

      var sendInvite = parseBoolCell(c.sendInvite);
      if (sendInvite === undefined) { bad('Send Invites', 'Use Yes or No.'); sendInvite = true; }
      if (sendInvite === null) sendInvite = true;

      var meet = parseBoolCell(c.meet);
      if (meet === undefined) { bad('Google Meet', 'Use Yes or No.'); meet = false; }
      meet = !!meet;

      var sdText = bulkCellText(c.startDate);
      var sd = parseDateCell(c.startDate);
      if (!sdText) bad('Start Date', 'Start Date is required.');
      else if (!sd) bad('Start Date', 'Could not read "' + sdText + '". Use DD-MM-YYYY, e.g. 15-08-2026.');

      var edText = bulkCellText(c.endDate);
      var ed = edText ? parseDateCell(c.endDate) : sd;
      if (edText && !ed) bad('End Date', 'Could not read "' + edText + '". Use DD-MM-YYYY, e.g. 15-08-2026.');

      var st = null, et = null;
      if (!allDay) {
        var stText = bulkCellText(c.startTime), etText = bulkCellText(c.endTime);
        st = parseTimeCell(c.startTime);
        et = parseTimeCell(c.endTime);
        if (!stText) bad('Start Time', 'Start Time is required unless All Day is Yes.');
        else if (!st) bad('Start Time', 'Could not read "' + stText + '". Use 24-hour HH:MM, e.g. 09:30.');
        if (!etText) bad('End Time', 'End Time is required unless All Day is Yes.');
        else if (!et) bad('End Time', 'Could not read "' + etText + '". Use 24-hour HH:MM, e.g. 17:00.');
      }

      var startD = null, endD = null;
      if (sd && ed && (allDay || (st && et))) {
        startD = new Date(sd.y, sd.m - 1, sd.d, allDay ? 0 : st.h, allDay ? 0 : st.mi, 0, 0);
        endD   = new Date(ed.y, ed.m - 1, ed.d, allDay ? 0 : et.h, allDay ? 0 : et.mi, 0, 0);
        if (endD.getTime() < startD.getTime()) {
          bad('End Date', 'The end (' + fmtDateTime(endD.toISOString()) + ') is before the start (' + fmtDateTime(startD.toISOString()) + ').');
        } else if (!allDay && endD.getTime() === startD.getTime()) {
          bad('End Time', 'End Time is the same as Start Time.');
        }
        if (startD.getTime() < Date.now()) {
          warn('Start Date', 'This date is in the past. The event will be created but cannot be edited afterwards.');
        }
      }

      var hostRaw = bulkCellText(c.host);
      var host = hostRaw || uploader;
      if (hostRaw && !bulkValidEmail(hostRaw)) bad('Host Email', '"' + hostRaw + '" is not a valid email address.');
      if (!host) bad('Host Email', 'No host email, and your own email could not be determined. Reload and try again.');

      var guests = [];
      bulkCellText(c.guests).split(/[,;\n]/).forEach(function (g) {
        var t = String(g || '').trim();
        if (!t) return;
        if (!bulkValidEmail(t)) bad('Guest Emails', '"' + t + '" is not a valid email address.');
        else if (guests.map(lc).indexOf(lc(t)) === -1) guests.push(t);
      });
      if (guests.length > 100) bad('Guest Emails', 'More than 100 guests on one event (' + guests.length + ').');
      if (host && guests.map(lc).indexOf(lc(host)) === -1) guests.push(host);
      if (sendInvite && guests.length === 1 && lc(guests[0]) === lc(host)) {
        warn('Guest Emails', 'No guests listed \u2014 only the host will get this invite.');
      }

      var remRaw = bulkCellText(c.reminders);
      var reminders = BULK_REMINDER_PRESETS[0].minutes;
      var remLabel = BULK_REMINDER_PRESETS[0].label;
      if (remRaw) {
        var hit = null;
        BULK_REMINDER_PRESETS.forEach(function (p) { if (lc(p.label) === lc(remRaw)) hit = p; });
        if (!hit) bad('Reminders', '"' + remRaw + '" is not one of the reminder options. Pick from the dropdown.');
        else { reminders = hit.minutes; remLabel = hit.label; }
      }

      var desc = bulkCellText(c.desc);
      if (desc.length > 500) bad('Description', 'Description is longer than 500 characters.');

      if (errors.length > rowErr) return;   // row already rejected

      var ev = {
        rowNo: rn,
        state: state, district: district, eventType: eventType, eventName: eventName,
        desc: desc, allDay: allDay, start: startD.toISOString(), end: endD.toISOString(),
        host: host, guests: guests, sendInvite: sendInvite, meet: meet,
        reminders: reminders.map(function (m) { return { minutes: m, method: 'email' }; }),
        reminderLabel: remLabel,
        _when: allDay ? (fmtDateOnly(startD.toISOString()) +
                 (sameDay(startD.toISOString(), endD.toISOString()) ? '' : ' \u2192 ' + fmtDateOnly(endD.toISOString())) + ' (all day)')
               : (fmtDateTime(startD.toISOString()) + ' \u2192 ' + fmtDateTime(endD.toISOString()))
      };
      ev.rowKey = bulkRowKey(ev);
      if (seenKeys[ev.rowKey]) bad('Event Name', 'This is a duplicate of row ' + seenKeys[ev.rowKey] + ' in this file (same type, district, name and timing).');
      else {
        seenKeys[ev.rowKey] = rn;
        if (existingKeys[ev.rowKey]) warn('Event Name', 'An identical event already exists in the calendar. It will be skipped, not duplicated.');
        rows.push(ev);
      }
    });

    return { rows: rows, errors: errors, warnings: warnings };
  }

  // ── UPLOAD HANDLING ───────────────────────────────────────────────
  function onBulkFileChange() {
    var input = $('pcal-bulk-file');
    if (!input || !isAdmin) return;
    if (bulkRunning) { input.value = ''; showToast('An import is already running.', true); return; }
    var file = input.files && input.files[0];
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      input.value = '';
      bulkStatus('Only .xlsx files from the downloaded template can be read. If you filled this in Google Sheets, use File \u2192 Download \u2192 Microsoft Excel (.xlsx).', true);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      input.value = '';
      bulkStatus('That file is larger than 10 MB \u2014 it does not look like an events sheet.', true);
      return;
    }
    bulkParsed = null;
    bulkReport('');
    bulkStatus('Reading ' + file.name + '\u2026');
    loadExcelLib()
      .then(function (ExcelJS) {
        return fileToArrayBuffer(file).then(function (buf) {
          var wb = new ExcelJS.Workbook();
          return wb.xlsx.load(buf);
        });
      })
      .then(function (wb) {
        var raw = parseBulkWorkbook(wb);
        if (!raw.length) { bulkStatus('No filled rows found in the "Events" sheet.', true); return; }
        var res = validateBulkRows(raw);
        if (res.errors.length) {
          bulkParsed = null;
          renderBulkErrors(file.name, raw.length, res.errors);
          showToast(res.errors.length + ' problem(s) found \u2014 nothing was saved.', true);
          return;
        }
        bulkParsed = { fileName: file.name, rows: res.rows, warnings: res.warnings };
        bulkStatus('Read ' + res.rows.length + ' event(s) from ' + file.name + '.');
        openBulkConfirm();
      })
      .catch(function (e) {
        bulkParsed = null;
        bulkStatus(e.message || 'Could not read that file.', true);
      })
      .then(function () { if (input) input.value = ''; });
  }

  function fileToArrayBuffer(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error('Could not read ' + file.name)); };
      r.readAsArrayBuffer(file);
    });
  }

  function bulkStatus(msg, isError) {
    var el = $('pcal-bulk-status');
    if (!el) return;
    el.innerHTML = msg ? '<div class="pcal-bulk-status' + (isError ? ' err' : '') + '">' + esc(msg) + '</div>' : '';
  }
  function bulkReport(html) {
    var el = $('pcal-bulk-report');
    if (el) el.innerHTML = html || '';
  }

  function renderBulkErrors(fileName, rowCount, errs) {
    bulkStatus('');
    var shown = errs.slice(0, 60);
    bulkReport(
      '<div class="pcal-bulk-block err">' +
        '<div class="pcal-bulk-block-title">\u26a0 ' + errs.length + ' problem(s) in ' + esc(fileName) +
          ' \u2014 nothing has been saved</div>' +
        '<div class="pcal-bulk-block-sub">Fix these rows in the same file and upload it again. All ' +
          rowCount + ' row(s) were rejected together, so no partial import can happen.</div>' +
        '<div class="pcal-bulk-tblwrap"><table class="pcal-bulk-tbl"><thead><tr>' +
          '<th style="width:70px">Excel row</th><th style="width:160px">Column</th><th>Problem</th>' +
        '</tr></thead><tbody>' +
        shown.map(function (e) {
          return '<tr><td>' + (e.row ? e.row : '\u2014') + '</td><td>' + esc(e.col || '\u2014') + '</td><td>' + esc(e.msg) + '</td></tr>';
        }).join('') +
        '</tbody></table></div>' +
        (errs.length > shown.length ? '<div class="pcal-bulk-block-sub">\u2026and ' + (errs.length - shown.length) + ' more.</div>' : '') +
      '</div>'
    );
  }

  function openBulkConfirm() {
    if (!bulkParsed || !bulkParsed.rows.length) return;
    var rows = bulkParsed.rows;
    var invitees = {}, noInviteCount = 0;
    rows.forEach(function (ev) {
      if (ev.sendInvite) ev.guests.forEach(function (g) { invitees[lc(g)] = true; });
      else noInviteCount++;
    });
    var inviteeCount = Object.keys(invitees).length;
    var body = $('pcal-bulk-confirm-body');
    if (!body) return;

    body.innerHTML =
      '<div class="pcal-bulk-confirm-lead">' +
        '<strong>' + rows.length + ' event(s)</strong> will be created in the Program Insights Google Calendar' +
        (inviteeCount
          ? ', and Google Calendar invites will be emailed to <strong>' + inviteeCount + ' recipient(s)</strong>.'
          : '. No invites will be emailed.') +
        (noInviteCount ? ' <span class="pcal-bulk-muted">(' + noInviteCount + ' row(s) have Send Invites = No.)</span>' : '') +
      '</div>' +
      (bulkParsed.warnings.length
        ? '<div class="pcal-bulk-block warn"><div class="pcal-bulk-block-title">\u26a0 ' + bulkParsed.warnings.length +
            ' thing(s) to check</div><ul class="pcal-bulk-warnlist">' +
            bulkParsed.warnings.slice(0, 25).map(function (w) {
              return '<li>Row ' + w.row + ' \u00b7 ' + esc(w.col) + ': ' + esc(w.msg) + '</li>';
            }).join('') +
          '</ul></div>'
        : '') +
      '<div class="pcal-bulk-tblwrap"><table class="pcal-bulk-tbl"><thead><tr>' +
        '<th style="width:52px">Row</th><th>Event</th><th>Type</th><th>District</th><th>When</th><th>Host</th><th style="width:60px">Guests</th><th>Meet</th>' +
      '</tr></thead><tbody>' +
      rows.map(function (ev) {
        return '<tr>' +
          '<td>' + ev.rowNo + '</td>' +
          '<td>' + esc(ev.eventName) + '</td>' +
          '<td>' + esc(ev.eventType) + '</td>' +
          '<td>' + esc(ev.district) + '</td>' +
          '<td>' + esc(ev._when) + '</td>' +
          '<td>' + esc(ev.host) + '</td>' +
          '<td>' + ev.guests.length + '</td>' +
          '<td>' + (ev.meet ? 'Yes' : '\u2014') + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>' +
      '<div class="pcal-bulk-muted" style="margin-top:10px">Check the dates above before confirming \u2014 they are how the file was read. ' +
        'Nothing has been saved yet. Once confirmed, invites cannot be un-sent.</div>';

    var btn = $('pcal-bulk-confirm');
    if (btn) {
      btn.disabled = false;
      btn.textContent = inviteeCount
        ? 'Create ' + rows.length + ' event(s) & send invites'
        : 'Create ' + rows.length + ' event(s)';
    }
    $('pcal-modal-bulk').classList.add('open');
  }

  function runBulkImport() {
    if (!isAdmin || bulkRunning || !bulkParsed || !bulkParsed.rows.length) return;
    var rows = bulkParsed.rows.slice();
    var fileName = bulkParsed.fileName;
    var btn = $('pcal-bulk-confirm');
    var batchId = 'pcalb_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
    var uname = (window.PROGRAM_CALENDAR_USER && window.PROGRAM_CALENDAR_USER.displayName) ||
                (window.__olfUser && window.__olfUser.displayName) || '';
    var chunkSize = CONFIG.BULK_CHUNK_SIZE;
    var chunks = [];
    for (var i = 0; i < rows.length; i += chunkSize) chunks.push(rows.slice(i, i + chunkSize));

    bulkRunning = true;
    bulkParsed = null;
    if (btn) { btn.disabled = true; btn.textContent = 'Creating\u2026'; }
    closeModal('pcal-modal-bulk');
    bulkReport('');

    var created = [], duplicates = [], failed = [], unsent = rows.slice();
    var stopped = null;

    function progress(done) {
      bulkStatus('Creating events\u2026 ' + done + ' of ' + rows.length + ' processed. Please keep this page open.');
    }
    progress(0);

    function step(idx) {
      if (idx >= chunks.length) return Promise.resolve();
      var chunk = chunks[idx];
      return apiPostTimed('bulkSaveEvents', {
        batchId: batchId,
        savedByName: uname,
        savedByEmail: currentEmail || '',
        events: chunk.map(function (ev) {
          return {
            rowNo: ev.rowNo, rowKey: ev.rowKey,
            state: ev.state, district: ev.district, eventType: ev.eventType, eventName: ev.eventName,
            desc: ev.desc, start: ev.start, end: ev.end, allDay: ev.allDay,
            host: ev.host, guests: ev.guests, reminders: ev.reminders,
            sendInvite: ev.sendInvite, meet: ev.meet
          };
        })
      }, CONFIG.BULK_CHUNK_TIMEOUT_MS)
        .then(function (res) {
          var results = (res && res.results) || [];
          results.forEach(function (r) {
            unsent = unsent.filter(function (u) { return u.rowNo !== r.rowNo; });
            if (r.status === 'created') { if (r.event) created.push(r.event); else created.push({ id: 'unknown_' + r.rowNo }); }
            else if (r.status === 'duplicate') duplicates.push(r);
            else failed.push(r);
          });
          progress(rows.length - unsent.length);
          return step(idx + 1);
        })
        .catch(function (e) {
          stopped = e;   // stop here: the rest was never sent
        });
    }

    step(0).then(function () {
      bulkRunning = false;
      if (created.length) {
        var byId = {};
        created.forEach(function (e) { if (e && e.id) byId[String(e.id)] = true; });
        events = events.filter(function (e) { return !byId[String(e.id)]; }).concat(created);
        persistLocal();
        renderCalendar();
      }
      renderBulkResult(fileName, rows.length, created, duplicates, failed, unsent, stopped);
      if (stopped) showToast('Import stopped after ' + created.length + ' event(s).', true);
      else if (failed.length) showToast(created.length + ' created, ' + failed.length + ' failed.', true);
      else showToast(created.length + ' event(s) created' + (duplicates.length ? ' \u00b7 ' + duplicates.length + ' skipped' : '') + '.');
      // Re-read from the server so the grid matches the sheet exactly.
      loadAll({ force: true }).then(renderCalendar).catch(function () {});
    });
  }

  function renderBulkResult(fileName, total, created, duplicates, failed, unsent, stopped) {
    bulkStatus('');
    var cls = (failed.length || unsent.length || stopped) ? 'warn' : 'ok';
    var html = '<div class="pcal-bulk-block ' + cls + '">' +
      '<div class="pcal-bulk-block-title">' +
        (stopped ? '\u26a0 Import stopped' : (failed.length ? '\u26a0 Import finished with problems' : '\u2713 Import complete')) +
      '</div>' +
      '<div class="pcal-bulk-block-sub">' + esc(fileName) + ' \u00b7 ' + total + ' row(s) submitted</div>' +
      '<ul class="pcal-bulk-warnlist">' +
        '<li><strong>' + created.length + '</strong> event(s) created and confirmed by the server' +
          (created.length ? ' \u00b7 invites sent where Send Invites was Yes' : '') + '</li>' +
        (duplicates.length ? '<li><strong>' + duplicates.length + '</strong> skipped \u2014 an identical event already existed (rows ' +
          duplicates.map(function (d) { return d.rowNo; }).join(', ') + ')</li>' : '') +
        (failed.length ? '<li><strong>' + failed.length + '</strong> failed</li>' : '') +
        (unsent.length ? '<li><strong>' + unsent.length + '</strong> never reached the server (rows ' +
          unsent.map(function (u) { return u.rowNo; }).join(', ') + ')</li>' : '') +
      '</ul>';
    if (failed.length) {
      html += '<div class="pcal-bulk-tblwrap"><table class="pcal-bulk-tbl"><thead><tr>' +
        '<th style="width:70px">Excel row</th><th>Reason</th></tr></thead><tbody>' +
        failed.map(function (f) { return '<tr><td>' + f.rowNo + '</td><td>' + esc(f.error || 'Unknown error') + '</td></tr>'; }).join('') +
        '</tbody></table></div>';
    }
    if (stopped || unsent.length) {
      html += '<div class="pcal-bulk-block-sub">' +
        (stopped ? esc(stopped.message || 'The connection to the server was lost.') + ' ' : '') +
        'Upload the same file again to finish the remaining rows \u2014 events that were already created will be detected and skipped, not duplicated.</div>';
    }
    html += '</div>';
    bulkReport(html);
  }

  // ── BULK PANEL ────────────────────────────────────────────────────
  function renderBulkPanel() {
    var box = $('pcal-bulk-instructions');
    if (!box) return;
    var typeList = (programs || []).slice();
    box.innerHTML =
      '<div class="pcal-bulk-block info">' +
        '<div class="pcal-bulk-block-title">How to fill the sheet</div>' +
        '<ol class="pcal-bulk-steps">' +
          '<li>One row per event on the <strong>Events</strong> sheet. Do not rename or delete the heading row.</li>' +
          '<li><strong>State, District, Event Type, All Day, Send Invites, Google Meet</strong> and <strong>Reminders</strong> are dropdowns \u2014 always pick, never type.</li>' +
          '<li>Dates are <strong>DD-MM-YYYY</strong> (e.g. 15-08-2026); times are <strong>24-hour HH:MM</strong> (e.g. 09:30, 17:00).</li>' +
          '<li>Leave <strong>End Date</strong> blank for a single-day event. Times can be left blank only when All Day is Yes.</li>' +
          '<li><strong>Host Email</strong> blank means you host it. <strong>Guest Emails</strong> are comma separated.</li>' +
          '<li>Files cannot be attached through Excel \u2014 add the event, then use Edit on it to attach.</li>' +
          '<li>Up to <strong>' + CONFIG.BULK_MAX_ROWS + ' events</strong> per file. The full <strong>Instructions</strong> sheet is inside the template.</li>' +
        '</ol>' +
        '<div class="pcal-bulk-block-sub">Current event types in the dropdown: ' +
          (typeList.length ? esc(typeList.join(', ')) : '<em>none yet \u2014 add them under Settings</em>') +
          ' \u00b7 ' + bulkAllDistricts().length + ' districts across ' + Object.keys(STATE_LABELS).length + ' states.</div>' +
      '</div>';
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
      var st = $('pcal-tab-settings'), pt = $('pcal-tab-past'), bt = $('pcal-tab-bulk');
      if ((st && st.classList.contains('active')) || (pt && pt.classList.contains('active')) ||
          (bt && bt.classList.contains('active'))) switchTab('calendar');
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

    on('pcal-bulk-download', 'click', downloadTemplate);
    on('pcal-bulk-file', 'change', onBulkFileChange);
    on('pcal-bulk-confirm', 'click', runBulkImport);
    var bOverlay = $('pcal-modal-bulk');
    if (bOverlay) bOverlay.addEventListener('click', function (e) {
      if (e.target === bOverlay && !bulkRunning) bOverlay.classList.remove('open');
    });

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

    // Nothing in memory (a fresh page load) but a stored copy exists:
    // treat it as a repeat visit so the month appears with no wait.
    var paintedFromCache = false;
    if (!loadedOnce && loadFromLocal()) {
      paintedFromCache = true;
    }

    // Repeat visit: paint instantly from what we already have, refresh silently.
    if (loadedOnce || paintedFromCache) {
      applyRole();
      renderCalendar();
      // resolveUser() and loadAll() are independent - the payload does not
      // depend on the role - so they run together rather than one after
      // the other.
      return Promise.all([
        resolveUser().then(applyRole),
        loadAll()
      ]).then(function () {
        renderCalendar();
      }).catch(function (e) {
        console.warn('[ProgramCalendar] background refresh failed:', e);
      });
    }

    // Genuinely first visit: draw the empty grid, then blur + circle loader
    // over it while the two requests run side by side.
    renderCalendar();
    showLoader();
    return Promise.all([
      resolveUser(),
      loadAll()
    ])
      .then(function () { applyRole(); renderCalendar(); })
      .catch(function (e) { showError(e.message || 'Could not load calendar data'); })
      .then(function () { hideLoader(); });
  }

  window.ProgramCalendar = {
    mount: mount,
    reload: function () { return loadAll({ force: true }).then(renderCalendar); },

    // Lets other pages (the Home upcoming-events strip) read the calendar
    // without duplicating the transport: memory first, then the stored
    // copy, then the server - all with the existing retry and dedupe.
    ensureEvents: function () {
      if (events.length) return Promise.resolve(events.slice());
      if (loadFromLocal()) return Promise.resolve(events.slice());
      return loadAll({ force: true }).then(function () { return events.slice(); });
    },
    colorFor: function (type) { return getProgramColor(type); },
    // Opt-in hook for the headless test harness. Off unless the page sets
    // window.PCAL_TEST = true before this file loads.
    _bulk: (window.PCAL_TEST === true) ? {
      buildTemplateWorkbook: buildTemplateWorkbook,
      parseBulkWorkbook: parseBulkWorkbook,
      validateBulkRows: validateBulkRows,
      parseDateCell: parseDateCell,
      parseTimeCell: parseTimeCell,
      parseBoolCell: parseBoolCell,
      bulkRowKey: bulkRowKey,
      bulkStateOfDistrict: bulkStateOfDistrict,
      setPrograms: function (list) { programs = list.slice(); rebuildProgramColors(); },
      setEvents: function (list) { events = list.slice(); },
      setUserForTest: function (email, admin) { currentEmail = email; isAdmin = !!admin; }
    } : undefined,
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