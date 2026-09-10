/* ===================================================================
   OLF Staff Connect - OLF Forms
   Globals are prefixed frm* to stay clear of gr*, sg*, pcal*, pom*.

   Dashboard - members: the forms sent to them and the entries they have
               recorded. Admins: every form with status and counts.
   Settings  - admin only: add / edit / publish forms, read responses.
               Forms admin rights are not editable here; they live in
               SUPER_ADMINS in Code.gs.

   Repeat entries: when a form allows more than one submission per person,
   it must say what keeps those entries apart - one per employee, or one
   per date. That key is unique per person per form, so the same employee
   or the same date cannot be recorded twice; the earlier entry is opened
   and edited instead.
   =================================================================== */

/* ------------------------------------------------------------- 1. config */

/* Live web app deployment for the OLF Forms Apps Script.
   A new VERSION of this deployment keeps the URL. A NEW deployment changes
   it, and this line must then be updated to match. */
var FRM_ENDPOINT = 'https://script.google.com/macros/s/AKfycby8wsatRiW9SFKldRqlepT0Iv2dWfhQohE9ojUVs5wcktRLWjgFWBPy6glNidDpaFYy/exec';

var FRM_CACHE_KEY = 'frm_cache_v4';        // bumped: payload shape changed
var FRM_RETRIES = 2;                       // extra attempts on a dropped request
var FRM_CACHE_TTL = 12 * 60 * 60 * 1000;
var FRM_TIMEOUT_MS = 2 * 60 * 1000;

var FRM_TYPES = [
  { v: 'short_text', t: 'Short text' },
  { v: 'long_text',  t: 'Paragraph' },
  { v: 'number',     t: 'Number' },
  { v: 'date',       t: 'Date' },
  { v: 'select',     t: 'Dropdown' },
  { v: 'radio',      t: 'Single choice' },
  { v: 'checkbox',   t: 'Multiple choice' },
  { v: 'yes_no',     t: 'Yes / No' }
];
var FRM_CHOICE_TYPES = ['select', 'radio', 'checkbox', 'yes_no'];
var FRM_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* -------------------------------------------------------------- 2. state */

var frmState = {
  booted: false,
  loading: false,
  busy: 0,
  isAdmin: false,
  user: null,
  forms: [],
  mine: [],
  tab: 'dashboard',
  view: null,          // null | 'fill' | 'builder' | 'responses'
  openForm: null,
  myEntries: [],
  taken: [],           // employees already recorded by somebody else
  editingId: null,
  adding: false,       // is the new-entry form open?
  entryKey: '',
  submitId: null,
  submitting: false,
  draft: null,
  openQ: 0,            // which builder question is expanded (-1 for none)
  responses: [],
  responseQuestions: [],
  responseFormId: null,
  pickView: 'all',     // 'all' | 'selected' in the audience picker
  detail: null,        // the form being inspected on the dashboard
  detailOpen: {},      // which respondents are expanded
  admins: [],
  adminSearch: ''
};

/* --------------------------------------------------------- 3. transport */

function frmUser() {
  if (typeof window.frmGetUser === 'function') return window.frmGetUser();

  // OLF Staff Connect publishes the signed-in user here (app.js), shaped
  // { email, displayName, role }.
  var o = window.__olfUser;
  if (o && o.email) {
    return {
      email: String(o.email).toLowerCase(),
      name: o.displayName || o.name || '',
      role: String(o.role || 'member').toLowerCase()
    };
  }
  var c = window.currentUser || window.appUser || window.userProfile || null;
  if (c && (c.email || c.userEmail)) {
    return {
      email: String(c.email || c.userEmail || '').toLowerCase(),
      name: c.name || c.displayName || c.fullName || '',
      role: String(c.role || c.userRole || 'member').toLowerCase()
    };
  }
  try {
    var fu = window.firebase && firebase.auth && firebase.auth().currentUser;
    if (fu) {
      return { email: String(fu.email || '').toLowerCase(),
               name: fu.displayName || '', role: 'member' };
    }
  } catch (e) {}
  return null;
}

/**
 * @param tries  how many extra attempts to make if the request never reaches
 *               the handler. Apps Script sometimes answers a slow POST with a
 *               404 or an empty body, and a large form was hitting that. Only
 *               transport failures are retried - a real error from the handler
 *               comes back as JSON and is reported immediately.
 *
 *               Retries are safe because a save carries clientFormId and a
 *               submission carries clientSubmitId, so the backend recognises
 *               a repeat and updates rather than duplicating. Pass 0 for
 *               anything without that protection.
 */
function frmApi(action, payload, tries) {
  var left = (tries === undefined) ? FRM_RETRIES : tries;
  var user = frmUser();
  if (!user || !user.email) {
    return Promise.reject(new Error('Not signed in. Reload the app to continue.'));
  }

  var body = Object.assign({}, payload || {}, {
    action: action,
    userEmail: user.email,
    userName: user.name,
    userRole: user.role
  });

  var again = function (why, wait) {
    console.log('frmApi ' + action + ': ' + why + ', retrying in ' +
                wait + 'ms (' + left + ' left)');
    return new Promise(function (res) { setTimeout(res, wait); })
      .then(function () { return frmApi(action, payload, left - 1); });
  };

  var ctrl = ('AbortController' in window) ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, FRM_TIMEOUT_MS) : null;

  return fetch(FRM_ENDPOINT, {
    method: 'POST',
    // text/plain avoids the CORS preflight that Apps Script cannot answer.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    signal: ctrl ? ctrl.signal : undefined,
    redirect: 'follow'
  }).then(function (res) {
    if (timer) clearTimeout(timer);
    if (!res.ok) {
      if (left > 0) return again('HTTP ' + res.status, left === FRM_RETRIES ? 1200 : 3000);
      throw new Error('The server returned ' + res.status +
        '. Nothing was saved \u2014 try again in a moment.');
    }
    return res.text().then(function (txt) { return { txt: txt }; });
  }).then(function (out) {
    if (!out || out.retried) return out;        // a retry already resolved it
    if (out.txt === undefined) return out;      // came back from again()

    var data;
    try {
      data = JSON.parse(out.txt);
    } catch (e) {
      if (left > 0) return again('unreadable body', 1200);
      throw new Error('The server sent something unreadable. Nothing was saved.');
    }
    if (!data.ok) throw new Error(data.error || 'That request did not go through.');
    return data;
  }).catch(function (err) {
    if (timer) clearTimeout(timer);
    if (err && err.name === 'AbortError') {
      // Not retried: three two-minute waits would be worse than one clear
      // failure, and the write may well have landed anyway.
      throw new Error('That took longer than two minutes. Check your connection, ' +
        'then reload before trying again.');
    }
    if (err && err.name === 'TypeError' && left > 0) {
      return again('network error', 1200);      // offline, DNS, dropped link
    }
    throw err;
  });
}

/** Same as frmApi, wrapped in the blur-and-spinner overlay. */
function frmBusyApi(action, payload, label, tries) {
  frmBusy(true, label);
  return frmApi(action, payload, tries).then(function (d) {
    frmBusy(false);
    return d;
  }).catch(function (err) {
    frmBusy(false);
    throw err;
  });
}

/* ------------------------------------------------------------ 4. caching */

function frmReadCache() {
  try {
    var raw = localStorage.getItem(FRM_CACHE_KEY);
    if (!raw) return null;
    var obj = JSON.parse(raw);
    if (!obj || !obj.at) return null;
    if (Date.now() - obj.at > FRM_CACHE_TTL) return null;
    var u = frmUser();
    if (!u || obj.email !== u.email) return null;   // never show another user's cache
    return obj;
  } catch (e) { return null; }
}

function frmWriteCache() {
  try {
    var u = frmUser();
    localStorage.setItem(FRM_CACHE_KEY, JSON.stringify({
      at: Date.now(),
      email: u ? u.email : '',
      isAdmin: frmState.isAdmin,
      forms: frmState.forms,
      mine: frmState.mine
    }));
  } catch (e) {}
}

/* ---------------------------------------------------- 5. employee source */

/** app.js publishes [{ name, email, dept }] as window.__olfEmployees. */
function frmEmployees() {
  var src = window.__olfEmployees;
  if (!Array.isArray(src)) return [];
  var out = [];
  src.forEach(function (e) {
    var email = String(e.email || e.Email || '').trim().toLowerCase();
    if (!email || email.indexOf('@') === -1) return;
    out.push({
      email: email,
      name: String(e.name || e.Name || '').trim() || email,
      dept: String(e.dept || e.Dept || '').trim() || 'Unassigned'
    });
  });
  out.sort(function (a, b) { return a.name.localeCompare(b.name); });
  return out;
}

function frmDepartments(list) {
  var seen = {}, out = [];
  list.forEach(function (e) {
    if (seen[e.dept]) return;
    seen[e.dept] = 1;
    out.push(e.dept);
  });
  out.sort();
  return out;
}

/* ------------------------------------------------------------ 6. plumbing */

function frmEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** 2026-09-10 -> 10 Sep 2026. Anything unrecognised passes through. */
function frmDate(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  if (!m) return String(s || '');
  return Number(m[3]) + ' ' + FRM_MONTHS[Number(m[2]) - 1] + ' ' + m[1];
}

/** 2026-09-10 12:01:00 -> 10 Sep 2026, 12:01 */
function frmStamp(s) {
  var t = String(s || '');
  var d = frmDate(t);
  var m = /\s(\d{2}):(\d{2})/.exec(t);
  return m ? d + ', ' + m[1] + ':' + m[2] : d;
}

function frmToday() {
  var d = new Date();
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function frmSetStatus(msg) {
  var el = document.getElementById('frmStatus');
  if (el) el.textContent = msg || '';
}

/**
 * Blurs the page and shows a spinner while something is in flight, so a slow
 * connection never looks like a dead button. Reference-counted, because two
 * requests can overlap.
 */
function frmBusy(on, label) {
  frmState.busy = Math.max(0, frmState.busy + (on ? 1 : -1));
  var shell = document.getElementById('frmShell');
  var veil = document.getElementById('frmVeil');
  if (!shell || !veil) return;

  if (frmState.busy > 0) {
    var text = veil.querySelector('.frm-veil__text');
    if (text) text.textContent = label || 'Working\u2026';
    shell.classList.add('is-busy');
    veil.hidden = false;
    veil.setAttribute('aria-busy', 'true');
  } else {
    shell.classList.remove('is-busy');
    veil.hidden = true;
    veil.setAttribute('aria-busy', 'false');
  }
}

function frmToast(msg, kind) {
  var host = document.getElementById('frmToasts');
  if (!host) { alert(msg); return; }
  var el = document.createElement('div');
  el.className = 'frm-toast frm-toast--' + (kind || 'info');
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(function () {
    el.classList.add('is-out');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 350);
  }, kind === 'error' ? 7000 : 4000);
}

/**
 * A real dialog rather than window.confirm, so a destructive action can
 * spell out its consequences. Resolves true only on the confirm button.
 */
function frmConfirm(opts) {
  return new Promise(function (resolve) {
    var host = document.getElementById('frmModal');
    if (!host) { resolve(window.confirm(opts.body || '')); return; }

    var done = function (yes) {
      document.removeEventListener('keydown', onKey);
      host.hidden = true;
      host.innerHTML = '';
      resolve(yes);
    };
    var onKey = function (e) {
      if (e.key === 'Escape') done(false);
    };

    host.innerHTML =
      '<div class="frm-modal__sheet" role="dialog" aria-modal="true" ' +
        'aria-labelledby="frmModalTitle">' +
        '<h2 class="frm-modal__title" id="frmModalTitle">' +
          frmEsc(opts.title || 'Are you sure?') + '</h2>' +
        '<p class="frm-modal__body">' + frmEsc(opts.body || '') + '</p>' +
        (opts.detail ? '<p class="frm-modal__detail">' +
          frmEsc(opts.detail) + '</p>' : '') +
        '<div class="frm-modal__acts">' +
          '<button class="frm-btn" id="frmModalNo">' +
            frmEsc(opts.cancel || 'Cancel') + '</button>' +
          '<button class="frm-btn ' +
            (opts.danger ? 'frm-btn--danger' : 'frm-btn--key') +
            '" id="frmModalYes">' + frmEsc(opts.ok || 'Confirm') + '</button>' +
        '</div>' +
      '</div>';
    host.hidden = false;

    document.getElementById('frmModalYes').onclick = function () { done(true); };
    document.getElementById('frmModalNo').onclick = function () { done(false); };
    host.onclick = function (e) { if (e.target === host) done(false); };
    document.addEventListener('keydown', onKey);
    // Focus the safe choice, not the destructive one.
    document.getElementById('frmModalNo').focus();
  });
}

function frmRenderError(msg) {
  document.getElementById('frmRoot').innerHTML =
    '<div class="frm-blank frm-blank--bad">' +
      '<p class="frm-blank__head">Forms did not load</p>' +
      '<p class="frm-blank__body">' + frmEsc(msg) + '</p>' +
      '<button class="frm-btn frm-btn--key" onclick="frmBootstrap(true)">Try again</button>' +
    '</div>';
}

/* --------------------------------------------------------------- 7. init */

function frmInit(force) {
  var root = document.getElementById('frmRoot');
  if (!root) { console.warn('frmInit: #frmRoot not found'); return; }

  frmState.busy = 0;

  // navigate() replaces #pageContent, so a half-filled form is already gone
  // from the DOM. Drop it rather than repainting empty inputs under a title
  // that suggests the answers survived. A builder draft DOES survive,
  // because it lives in frmState rather than the DOM.
  if (frmState.view === 'fill') {
    frmState.view = null;
    frmState.openForm = null;
    frmState.myEntries = [];
    frmState.taken = [];
    frmState.editingId = null;
    frmState.adding = false;
    frmState.entryKey = '';
    frmState.submitId = null;
  }

  if (!frmState.booted) {
    var cached = frmReadCache();
    if (cached) {
      // Paint from cache immediately; the network refresh lands underneath.
      frmState.isAdmin = !!cached.isAdmin;
      frmState.forms = cached.forms || [];
      frmState.mine = cached.mine || [];
      frmRender();
    } else {
      root.innerHTML = '<div class="frm-blank">Loading your forms\u2026</div>';
    }
  } else if (!force) {
    frmRender();
  }

  frmBootstrap();
}

/**
 * @param showBusy  true when a person pressed Refresh, so the overlay is
 *                  wanted. The automatic refresh after a page open passes
 *                  nothing, so it stays quiet behind the cached view.
 */
function frmBootstrap(showBusy) {
  if (frmState.loading) return;
  frmState.loading = true;
  frmSetStatus('Refreshing');
  if (showBusy) frmBusy(true, 'Refreshing');

  // One request carries the form list AND the person's own entries.
  frmApi('bootstrap', {}).then(function (d) {
    frmState.booted = true;
    frmState.isAdmin = !!d.isAdmin;
    frmState.user = d.user;
    frmState.forms = d.forms || [];
    frmState.mine = d.myResponses || [];
    frmWriteCache();
    frmSetStatus('');
    frmRender();
  }).catch(function (err) {
    frmSetStatus('');
    if (!frmState.booted && !frmState.forms.length) frmRenderError(err.message);
    else frmToast(err.message, 'error');
  }).then(function () {
    frmState.loading = false;
    if (showBusy) frmBusy(false);
  });
}

/* ----------------------------------------------------------- 8. rendering */

function frmRender() {
  var root = document.getElementById('frmRoot');
  if (!root) return;

  if (frmState.view === 'fill' && frmState.openForm) { frmRenderFill(); return; }
  if (frmState.view === 'done' && frmState.openForm) { frmRenderDone(); return; }
  if (frmState.view === 'builder' && frmState.draft) { frmRenderBuilder(); return; }
  if (frmState.view === 'responses') { frmRenderResponsesPage(); return; }
  if (frmState.view === 'admins') { frmRenderAdminsPage(); return; }
  if (frmState.view === 'detail') { frmRenderDetailPage(); return; }

  var tabs = [{ k: 'dashboard', t: 'Dashboard' }];
  if (frmState.isAdmin) tabs.push({ k: 'settings', t: 'Settings' });
  if (!tabs.some(function (x) { return x.k === frmState.tab; })) {
    frmState.tab = 'dashboard';
  }

  var html = '<div class="frm-tabs" role="tablist">';
  tabs.forEach(function (x) {
    var on = frmState.tab === x.k;
    html += '<button class="frm-tab' + (on ? ' is-on' : '') + '" role="tab" ' +
            'aria-selected="' + on + '" onclick="frmSetTab(\'' + x.k + '\')">' +
            frmEsc(x.t) + '</button>';
  });
  html += '</div><div id="frmBody"></div>';
  root.innerHTML = html;

  if (frmState.tab === 'dashboard') frmRenderDashboard();
  else frmRenderSettings();
}

function frmSetTab(k) {
  frmState.tab = k;
  frmState.view = null;
  frmRender();
}

/* ------------------------------------------------------- 9. dashboard tab */

function frmRenderDashboard() {
  // Past submissions are no longer listed here: they belong with the form
  // they came from, and are shown when that form is opened.
  document.getElementById('frmBody').innerHTML =
    frmState.isAdmin ? frmAdminOverview() : frmMemberForms();
}

function frmFigure(n, label) {
  return '<div class="frm-figure"><span class="frm-figure__n">' + n +
         '</span><span class="frm-figure__l">' + frmEsc(label) + '</span></div>';
}

function frmAdminOverview() {
  var f = frmState.forms;
  var live = f.filter(function (x) { return x.status === 'published'; }).length;
  var drafts = f.filter(function (x) { return x.status === 'draft'; }).length;
  var total = f.reduce(function (a, x) { return a + (x.responseCount || 0); }, 0);

  var html = '<div class="frm-figures">' +
    frmFigure(f.length, f.length === 1 ? 'form' : 'forms') +
    frmFigure(live, 'published') +
    frmFigure(drafts, drafts === 1 ? 'draft' : 'drafts') +
    frmFigure(total, total === 1 ? 'response' : 'responses') +
  '</div>';

  if (!f.length) {
    return html + '<div class="frm-blank">' +
      '<p class="frm-blank__head">No forms yet</p>' +
      '<p class="frm-blank__body">Open Settings and add your first one.</p>' +
      '<button class="frm-btn frm-btn--key" onclick="frmSetTab(\'settings\')">' +
      'Go to Settings</button></div>';
  }

  return html + '<div class="frm-scroll"><table class="frm-grid">' +
    '<thead><tr><th class="frm-grid__rail"></th><th>Form</th><th>Status</th>' +
    '<th>Sent to</th><th>Entries</th><th class="frm-num">Questions</th>' +
    '<th class="frm-num">Responses</th><th>Last change</th>' +
    '</tr></thead><tbody>' +
    f.map(function (x) {
      return '<tr>' +
        '<td class="frm-grid__rail" data-state="' + frmEsc(x.status) + '"></td>' +
        '<td class="frm-grid__name">' +
          '<button type="button" class="frm-open" onclick="frmOpenDetail(\'' +
            frmEsc(x.formId) + '\')">' + frmEsc(x.title) + '</button></td>' +
        '<td>' + frmStatusTag(x.status) + '</td>' +
        '<td>' + frmAudienceLabel(x, true) + '</td>' +
        '<td>' + frmModeLabel(x) + '</td>' +
        '<td class="frm-num">' + (x.questionCount || 0) + '</td>' +
        '<td class="frm-num">' + ((x.responseCount || 0)
          ? '<button type="button" class="frm-open frm-open--soft" ' +
            'title="See who responded" onclick="frmOpenDetail(\'' +
            frmEsc(x.formId) + '\')">' + x.responseCount + '</button>'
          : '<span class="frm-soft">0</span>') + '</td>' +
        '<td class="frm-soft">' + frmEsc(frmStamp(x.updatedAt)) + '</td>' +
      '</tr>';
    }).join('') +
    '</tbody></table></div>';
}

function frmStatusTag(status) {
  return '<span class="frm-tag" data-state="' + frmEsc(status) + '">' +
         frmEsc(status) + '</span>';
}

/**
 * @param open  render it as a way into the form's detail, where the
 *              recipients and their response counts are listed
 */
function frmAudienceLabel(f, open) {
  var text = (f.audience === 'LIST')
    ? (f.recipientCount || 0) +
      ((f.recipientCount === 1) ? ' member' : ' members')
    : 'All staff';
  if (!open) return text;
  return '<button type="button" class="frm-open frm-open--soft" ' +
    'title="See who this went to" onclick="frmOpenDetail(\'' +
    frmEsc(f.formId) + '\')">' + text + '</button>';
}

function frmModeLabel(f) {
  if (!f.allowMultiple) return '<span class="frm-soft">One each</span>';
  if (f.multiMode === 'date') return 'One per date';
  if (f.multiMode === 'employee') {
    var n = (f.entryDepts || []).length;
    return 'One per employee' + (n
      ? '<span class="frm-ref">' + frmEsc(f.entryDepts.join(', ')) + '</span>'
      : '');
  }
  return '<span class="frm-soft">Repeatable</span>';
}

/** How many entries this person has already recorded against a form. */
function frmMyCount(formId) {
  return (frmState.mine || []).filter(function (r) {
    return r.formId === formId;
  }).length;
}

function frmMemberForms() {
  var live = frmState.forms.filter(function (f) { return f.status === 'published'; });
  if (!live.length) {
    return '<div class="frm-blank">' +
      '<p class="frm-blank__head">Nothing to fill in</p>' +
      '<p class="frm-blank__body">When a form is sent to you it appears here.</p>' +
      '</div>';
  }

  return '<h2 class="frm-h2">Forms for you</h2><ul class="frm-items">' +
    live.map(function (f) {
      var mine = frmMyCount(f.formId);
      var done = mine > 0;
      var meta = [];
      meta.push('<span class="frm-meta"><b>' + (f.questionCount || 0) + '</b> ' +
        ((f.questionCount === 1) ? 'question' : 'questions') + '</span>');
      if (f.allowMultiple && f.multiMode) {
        meta.push('<span class="frm-meta">one entry per ' +
          (f.multiMode === 'date' ? 'date' : 'employee') + '</span>');
      }
      if (f.openUntil) {
        meta.push('<span class="frm-meta">open until <b>' +
          frmEsc(frmDate(f.openUntil)) + '</b></span>');
      }
      if (done) {
        meta.push('<span class="frm-meta frm-meta--done"><b>' + mine + '</b> ' +
          (mine === 1 ? 'entry recorded' : 'entries recorded') + '</span>');
      }
      return '<li class="frm-item" data-done="' + done + '">' +
        '<div class="frm-item__body">' +
          '<p class="frm-item__title">' + frmEsc(f.title) + '</p>' +
          (f.description ? '<p class="frm-item__desc">' +
            frmEsc(f.description) + '</p>' : '') +
          '<div class="frm-item__meta">' + meta.join('') + '</div>' +
        '</div>' +
        '<button class="frm-btn frm-btn--key" onclick="frmOpenForm(\'' +
          frmEsc(f.formId) + '\')">' +
          (done && f.allowMultiple ? 'Add or edit' : (done ? 'Open' : 'Fill in')) +
        '</button>' +
      '</li>';
    }).join('') + '</ul>';
}

/** A date key reads better formatted; an employee key is already a name. */
function frmEntryText(r) {
  var lab = String(r.entryLabel || r.entryKey || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(lab) ? frmDate(lab) : lab;
}

/* ------------------------------------------------------- 10. settings tab */

function frmRenderSettings() {
  var body = document.getElementById('frmBody');
  if (!frmState.isAdmin) {
    body.innerHTML = '<div class="frm-blank">' +
      '<p class="frm-blank__head">Admin only</p>' +
      '<p class="frm-blank__body">Settings is limited to the IT admin.</p></div>';
    return;
  }

  var html = '<div class="frm-bar">' +
    '<button class="frm-btn frm-btn--key" onclick="frmNewForm()">Add form</button>' +
    '<button class="frm-btn" onclick="frmOpenAdmins()">Add admin</button>' +
    '<button class="frm-btn" onclick="frmBootstrap(true)">Refresh</button>' +
  '</div>';

  if (!frmState.forms.length) {
    body.innerHTML = html + '<div class="frm-blank">' +
      '<p class="frm-blank__head">No forms yet</p>' +
      '<p class="frm-blank__body">Add a form, choose who it goes to, ' +
      'then publish it.</p></div>';
    return;
  }

  body.innerHTML = html + '<div class="frm-scroll"><table class="frm-grid">' +
    '<thead><tr><th class="frm-grid__rail"></th><th>Form</th><th>Status</th>' +
    '<th>Sent to</th><th>Entries</th><th class="frm-num">Responses</th>' +
    '<th>Last change</th><th></th></tr></thead><tbody>' +
    frmState.forms.map(function (f) {
      return '<tr>' +
        '<td class="frm-grid__rail" data-state="' + frmEsc(f.status) + '"></td>' +
        '<td class="frm-grid__name">' + frmEsc(f.title) +
          '<span class="frm-ref">' + frmEsc(f.formId) + '</span></td>' +
        '<td>' + frmStatusTag(f.status) + '</td>' +
        '<td>' + frmAudienceLabel(f, true) + '</td>' +
        '<td>' + frmModeLabel(f) + '</td>' +
        '<td class="frm-num">' + (f.responseCount || 0) + '</td>' +
        '<td class="frm-soft">' + frmEsc(frmStamp(f.updatedAt)) + '</td>' +
        '<td><div class="frm-rowacts">' +
          '<button class="frm-btn frm-btn--tiny" onclick="frmEditForm(\'' +
            frmEsc(f.formId) + '\')">Edit</button>' +
          frmStatusButtons(f) +
          '<button class="frm-btn frm-btn--tiny" onclick="frmViewResponses(\'' +
            frmEsc(f.formId) + '\')">Responses</button>' +
          '<button class="frm-btn frm-btn--tiny frm-btn--warn" ' +
            'onclick="frmDeleteForm(\'' + frmEsc(f.formId) +
            '\')">Delete</button>' +
        '</div></td>' +
      '</tr>';
    }).join('') + '</tbody></table></div>';
}

function frmStatusButtons(f) {
  var b = function (status, text) {
    return '<button class="frm-btn frm-btn--tiny" onclick="frmStatus(\'' +
           frmEsc(f.formId) + '\',\'' + status + '\')">' + text + '</button>';
  };
  if (f.status === 'published') return b('closed', 'Close');
  if (f.status === 'draft' || f.status === 'closed') {
    return b('published', 'Publish') + b('archived', 'Archive');
  }
  return b('draft', 'Restore');
}

function frmStatus(formId, status) {
  if (status !== 'archived') { frmDoStatus(formId, status); return; }
  frmConfirm({
    title: 'Archive this form?',
    body: 'Staff will stop seeing it, but every response is kept and the ' +
          'form can be restored later.',
    ok: 'Archive'
  }).then(function (yes) { if (yes) frmDoStatus(formId, status); });
}

function frmDoStatus(formId, status) {
  frmBusyApi('setFormStatus', { formId: formId, status: status }, 'Saving')
    .then(function (d) {
      frmState.forms = d.forms || frmState.forms;
      frmWriteCache();
      frmToast(status === 'published' ? 'Published.' :
               status === 'closed' ? 'Closed.' :
               status === 'archived' ? 'Archived.' : 'Restored to draft.',
               'success');
      frmRender();
    }).catch(function (err) { frmToast(err.message, 'error'); });
}

function frmDeleteForm(formId) {
  var f = frmState.forms.filter(function (x) { return x.formId === formId; })[0];
  var n = f ? (f.responseCount || 0) : 0;

  frmConfirm({
    title: 'Delete "' + (f ? f.title : formId) + '"?',
    body: 'This form and all of its responses will be deleted. ' +
          (n ? n + (n === 1 ? ' response' : ' responses') + ' will be lost. '
             : '') +
          'This cannot be undone from here.',
    detail: 'The form\u2019s spreadsheet goes to the Drive bin, so Drive can ' +
            'restore it for 30 days.',
    ok: 'Delete form',
    danger: true
  }).then(function (yes) {
    if (!yes) return;
    frmBusyApi('deleteForm', { formId: formId }, 'Deleting form', 0)
      .then(function (d) {
        frmState.forms = d.forms || [];
        frmState.mine = (frmState.mine || []).filter(function (r) {
          return r.formId !== formId;
        });
        frmWriteCache();
        frmToast('Deleted "' + d.title + '".' +
          (d.responsesRemoved ? ' ' + d.responsesRemoved +
            (d.responsesRemoved === 1 ? ' response' : ' responses') +
            ' removed.' : ''), 'success');
        frmRender();
      }).catch(function (err) {
        frmToast('Not deleted: ' + err.message, 'error');
      });
  });
}

/* -------------------------------------------------------- 11. filling in */

function frmOpenForm(formId) {
  frmBusyApi('getForm', { formId: formId }, 'Opening form').then(function (d) {
    if (d.alreadySubmitted) {
      // Show what was sent, since the dashboard no longer lists submissions.
      frmState.openForm = d.form;
      frmState.myEntries = d.myEntries || [];
      frmState.view = 'done';
      frmRender();
      return;
    }
    frmState.openForm = d.form;
    frmState.myEntries = d.myEntries || [];
    frmState.taken = d.takenKeys || [];
    frmState.editingId = null;
    frmState.entryKey = '';
    frmState.submitId = null;
    // With entries already recorded, land on the list and let the person ask
    // for a new one. With none, there is nothing to land on, so open the form.
    frmState.adding = !(d.form.allowMultiple && d.form.multiMode &&
                        (d.myEntries || []).length > 0);
    frmState.view = 'fill';
    frmRender();
  }).catch(function (err) { frmToast(err.message, 'error'); });
}

function frmCloseForm() {
  if (frmState.submitting) return;
  frmState.openForm = null;
  frmState.myEntries = [];
  frmState.taken = [];
  frmState.editingId = null;
  frmState.adding = false;
  frmState.entryKey = '';
  frmState.submitId = null;
  frmState.view = null;
  frmRender();
}

/** Employees somebody else has already recorded, keyed by email. */
function frmHeldKeys() {
  var out = {};
  (frmState.taken || []).forEach(function (t) {
    if (t && t.key) out[String(t.key).toLowerCase()] = t;
  });
  return out;
}

/** Keys already used, so the same employee or date cannot be picked twice. */
function frmUsedKeys() {
  var used = {};
  (frmState.myEntries || []).forEach(function (e) {
    if (e.responseId === frmState.editingId) return;   // its own key stays valid
    if (e.entryKey) used[String(e.entryKey).toLowerCase()] = 1;
  });
  return used;
}

function frmEditingEntry() {
  if (!frmState.editingId) return null;
  return (frmState.myEntries || []).filter(function (e) {
    return e.responseId === frmState.editingId;
  })[0] || null;
}

/** A finished single-submission form, shown back read-only. */
function frmRenderDone() {
  var f = frmState.openForm;
  var e = (frmState.myEntries || [])[0] || { answers: {} };
  var ans = e.answers || {};

  document.getElementById('frmRoot').innerHTML = '<div class="frm-page">' +
    '<button class="frm-back" onclick="frmCloseForm()">Back to dashboard</button>' +
    '<h1 class="frm-page__title">' + frmEsc(f.title) + '</h1>' +
    '<div class="frm-done">Submitted ' + frmEsc(frmStamp(e.submittedAt)) +
      (e.responseId ? '<span class="frm-ref">' + frmEsc(e.responseId) +
        '</span>' : '') +
      (e.maxScore ? '<span class="frm-done__score">Score ' + frmEsc(e.score) +
        ' / ' + frmEsc(e.maxScore) + '</span>' : '') +
    '</div>' +
    '<div class="frm-sheet"><h2 class="frm-sheet__head">Your answers</h2>' +
      '<dl class="frm-answers">' +
        f.questions.map(function (q) {
          var v = ans[q.id];
          if (Array.isArray(v)) v = v.join(', ');
          return '<dt>' + frmEsc(q.label) + '</dt><dd>' +
            (v === '' || v === undefined || v === null
              ? '<span class="frm-soft">Not answered</span>' : frmEsc(v)) +
            '</dd>';
        }).join('') +
      '</dl>' +
      '<p class="frm-sheet__foot">This form takes one submission each, so it ' +
        'can no longer be changed here.</p>' +
    '</div></div>';
}

function frmRenderFill() {
  var f = frmState.openForm;
  var editing = frmEditingEntry();
  var multi = !!(f.allowMultiple && f.multiMode);

  var html = '<div class="frm-page">' +
    '<button class="frm-back" onclick="frmCloseForm()">Back to dashboard</button>' +
    '<h1 class="frm-page__title">' + frmEsc(f.title) + '</h1>' +
    (f.description ? '<p class="frm-page__lede">' +
      frmEsc(f.description) + '</p>' : '');

  if (multi) html += frmEntriesList(f);

  // Nothing below the entries list until the person asks for a new entry.
  if (multi && !editing && !frmState.adding) {
    html += '<div class="frm-addbar">' +
      '<button class="frm-btn frm-btn--key" onclick="frmAddEntry()">' +
        'Add new entry</button>' +
      '<span class="frm-hint">Or open an entry above to change it.</span>' +
    '</div></div>';
    document.getElementById('frmRoot').innerHTML = html;
    return;
  }

  html += '<div class="frm-sheet" id="frmEntrySheet">' +
    '<h2 class="frm-sheet__head">' +
      (editing ? 'Editing ' + frmEsc(frmEntryText(editing)) :
       multi ? 'New entry' : 'Your answers') +
    '</h2>';

  if (multi) html += frmKeyField(f, editing);

  html += '<div class="frm-qs">';
  f.questions.forEach(function (q, i) {
    html += '<div class="frm-q">' +
      '<label class="frm-q__label" for="frm_f_' + frmEsc(q.id) + '">' +
        '<span class="frm-q__n">' + (i + 1) + '</span>' + frmEsc(q.label) +
        (q.required ? '<span class="frm-star" title="Required">*</span>' : '') +
      '</label>' +
      (q.help ? '<p class="frm-q__help">' + frmEsc(q.help) + '</p>' : '') +
      frmFieldHtml(q) +
    '</div>';
  });
  html += '</div>' +
    '<div class="frm-acts">' +
      '<button class="frm-btn frm-btn--key" id="frmSubmitBtn" onclick="frmSubmit()">' +
        (editing ? 'Save changes' : multi ? 'Save entry' : 'Submit') +
      '</button>' +
      (editing
        ? '<button class="frm-btn" onclick="frmCancelEdit()">Cancel edit</button>'
        : (multi && (frmState.myEntries || []).length
            ? '<button class="frm-btn" onclick="frmCancelAdd()">Cancel</button>'
            : '<button class="frm-btn" onclick="frmCloseForm()">Cancel</button>')) +
      '<span class="frm-hint" id="frmSubmitHint"></span>' +
    '</div>' +
  '</div></div>';

  document.getElementById('frmRoot').innerHTML = html;

  if (editing) frmFillAnswers(f, editing.answers || {});
}

function frmEntriesList(f) {
  var rows = frmState.myEntries || [];
  var noun = f.multiMode === 'date' ? 'date' : 'employee';
  if (!rows.length) {
    return '<div class="frm-note">This form takes one entry per ' + noun +
      '. Record your first below.</div>';
  }
  return '<div class="frm-sheet frm-sheet--quiet">' +
    '<h2 class="frm-sheet__head">Entries you have recorded' +
      '<span class="frm-count">' + rows.length + '</span></h2>' +
    '<ul class="frm-entries">' +
      rows.map(function (e) {
        var on = e.responseId === frmState.editingId;
        return '<li class="frm-entry' + (on ? ' is-on' : '') + '">' +
          '<span class="frm-entry__key">' + frmEsc(frmEntryText(e)) + '</span>' +
          '<span class="frm-entry__when">' + frmEsc(frmStamp(e.submittedAt)) +
            (e.editCount ? ' \u00b7 edited ' + e.editCount +
              (e.editCount === 1 ? ' time' : ' times') : '') + '</span>' +
          '<button class="frm-btn frm-btn--tiny" onclick="frmEditEntry(\'' +
            frmEsc(e.responseId) + '\')">' + (on ? 'Editing' : 'Edit') +
          '</button>' +
        '</li>';
      }).join('') +
    '</ul>' +
    '<p class="frm-sheet__foot">Each ' + noun +
      ' can only be recorded once.</p>' +
  '</div>';
}

/** The employee picker or date picker that identifies a repeat entry. */
function frmKeyField(f, editing) {
  var locked = !!editing;
  if (f.multiMode === 'date') {
    var val = editing ? String(editing.entryKey || '') : (frmState.entryKey || '');
    return '<div class="frm-key">' +
      '<label class="frm-key__label" for="frmEntryKey">Which date is this entry for?' +
        '<span class="frm-star">*</span></label>' +
      '<input class="frm-input" type="date" id="frmEntryKey" value="' +
        frmEsc(val) + '" max="' + frmToday() + '"' +
        (locked ? ' disabled' : ' onchange="frmKeyChanged()"') + '>' +
      (locked
        ? '<p class="frm-key__note">The date cannot be changed on an existing entry. ' +
          'Cancel the edit and add a new one instead.</p>'
        : '<p class="frm-key__note">Dates you have already recorded are not ' +
          'available.</p>') +
    '</div>';
  }

  var staff = frmEmployees();
  if (!staff.length) {
    return '<div class="frm-note frm-note--bad">The employee list has not ' +
      'loaded, so this entry cannot be assigned yet. Open the Employees page ' +
      'once and come back.</div>';
  }

  // The form may restrict which departments an entry can be recorded for.
  var scope = f.entryDepts || [];
  if (scope.length) {
    staff = staff.filter(function (p) { return scope.indexOf(p.dept) !== -1; });
    if (!staff.length) {
      return '<div class="frm-note frm-note--bad">This form is set up for ' +
        scope.join(', ') + ', but nobody in the employee list belongs to ' +
        'those departments.</div>';
    }
  }
  var used = frmUsedKeys();
  var held = frmHeldKeys();
  var chosen = editing ? String(editing.entryKey || '') : (frmState.entryKey || '');
  var opts = '<option value="">Choose an employee\u2026</option>';
  var available = 0, heldCount = 0;
  staff.forEach(function (p) {
    var mine = !!used[p.email];
    if (mine && p.email !== chosen) return;    // in your own list, editable there
    var by = held[p.email];
    // Someone else's record stays selectable, because choosing it is how you
    // ask to replace it. It is labelled so that is never a surprise.
    if (by) heldCount++; else available++;
    opts += '<option value="' + frmEsc(p.email) + '" data-name="' +
      frmEsc(p.name) + '" data-dept="' + frmEsc(p.dept) + '"' +
      (by ? ' data-heldby="' + frmEsc(by.byName) + '"' : '') +
      (p.email === chosen ? ' selected' : '') + '>' +
      frmEsc(p.name) + ' \u2014 ' + frmEsc(p.dept) +
      (by ? '  (already recorded by ' + frmEsc(by.byName) + ')' : '') +
      '</option>';
  });

  return '<div class="frm-key">' +
    '<label class="frm-key__label" for="frmEntryKey">Which employee is this ' +
      'entry for?<span class="frm-star">*</span></label>' +
    '<select class="frm-input" id="frmEntryKey"' +
      (locked ? ' disabled' : ' onchange="frmKeyChanged()"') + '>' + opts +
    '</select>' +
    (locked
      ? '<p class="frm-key__note">The employee cannot be changed on an existing ' +
        'entry. Cancel the edit and add a new one instead.</p>'
      : '<p class="frm-key__note">' + available + ' of ' + staff.length +
        ' still to record' +
        (scope.length ? ' in ' + frmEsc(scope.join(', ')) : '') + '.' +
        (heldCount ? ' <span class="frm-warnnote">' + heldCount +
          ' already recorded by a colleague \u2014 choosing one asks before ' +
          'replacing it.</span>' : '') + '</p>') +
  '</div>';
}

function frmKeyChanged() {
  var el = document.getElementById('frmEntryKey');
  frmState.entryKey = el ? el.value : '';
}

function frmAddEntry() {
  frmState.adding = true;
  frmState.editingId = null;
  frmState.entryKey = '';
  frmState.submitId = null;
  frmRender();
  frmScrollToEntry();
}

function frmCancelAdd() {
  frmState.adding = false;
  frmState.entryKey = '';
  frmState.submitId = null;
  frmRender();
}

function frmEditEntry(responseId) {
  frmState.editingId = responseId;
  frmState.adding = false;
  frmState.entryKey = '';
  frmState.submitId = null;
  frmRender();
  frmScrollToEntry();
}

function frmCancelEdit() {
  frmState.editingId = null;
  frmState.adding = false;
  frmState.entryKey = '';
  frmState.submitId = null;
  frmRender();
}

/** Brings the entry form into view; it opens below a list that can be long. */
function frmScrollToEntry() {
  var el = document.getElementById('frmEntrySheet');
  if (el && el.scrollIntoView) {
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function frmFieldHtml(q) {
  var n = 'frm_f_' + q.id;
  if (q.type === 'long_text') {
    return '<textarea class="frm-input" rows="4" id="' + n + '"></textarea>';
  }
  if (q.type === 'number') {
    return '<input class="frm-input" type="number" id="' + n + '" inputmode="decimal">';
  }
  if (q.type === 'date') {
    return '<input class="frm-input" type="date" id="' + n + '">';
  }
  if (q.type === 'select') {
    var s = '<select class="frm-input" id="' + n +
            '"><option value="">Choose\u2026</option>';
    q.options.forEach(function (o) {
      s += '<option value="' + frmEsc(o) + '">' + frmEsc(o) + '</option>';
    });
    return s + '</select>';
  }
  if (q.type === 'radio' || q.type === 'yes_no') {
    return '<div class="frm-opts" id="' + n + '">' + q.options.map(function (o) {
      return '<label class="frm-opt"><input type="radio" name="' + n +
             '" value="' + frmEsc(o) + '"><span>' + frmEsc(o) + '</span></label>';
    }).join('') + '</div>';
  }
  if (q.type === 'checkbox') {
    return '<div class="frm-opts" id="' + n + '">' + q.options.map(function (o) {
      return '<label class="frm-opt"><input type="checkbox" name="' + n +
             '" value="' + frmEsc(o) + '"><span>' + frmEsc(o) + '</span></label>';
    }).join('') + '</div>';
  }
  return '<input class="frm-input" type="text" id="' + n + '">';
}

/** Puts a saved entry's answers back into the fields when editing. */
function frmFillAnswers(f, answers) {
  f.questions.forEach(function (q) {
    var n = 'frm_f_' + q.id;
    var v = answers[q.id];
    if (v === undefined || v === null) return;

    if (q.type === 'checkbox') {
      var want = Array.isArray(v) ? v.map(String) : [String(v)];
      var boxes = document.querySelectorAll('input[name="' + n + '"]');
      for (var i = 0; i < boxes.length; i++) {
        boxes[i].checked = want.indexOf(boxes[i].value) !== -1;
      }
    } else if (q.type === 'radio' || q.type === 'yes_no') {
      var radios = document.querySelectorAll('input[name="' + n + '"]');
      for (var k = 0; k < radios.length; k++) {
        radios[k].checked = radios[k].value === String(v);
      }
    } else {
      var el = document.getElementById(n);
      if (el) el.value = String(v);
    }
  });
}

function frmCollectAnswers() {
  var out = {};
  frmState.openForm.questions.forEach(function (q) {
    var n = 'frm_f_' + q.id;
    if (q.type === 'checkbox') {
      var boxes = document.querySelectorAll('input[name="' + n + '"]:checked');
      var arr = [];
      for (var i = 0; i < boxes.length; i++) arr.push(boxes[i].value);
      out[q.id] = arr;
    } else if (q.type === 'radio' || q.type === 'yes_no') {
      var sel = document.querySelector('input[name="' + n + '"]:checked');
      out[q.id] = sel ? sel.value : '';
    } else {
      var el = document.getElementById(n);
      out[q.id] = el ? el.value.trim() : '';
    }
  });
  return out;
}

function frmUuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'x' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

function frmSubmit() {
  if (frmState.submitting) return;
  var f = frmState.openForm;
  var editing = frmEditingEntry();
  var multi = !!(f.allowMultiple && f.multiMode);
  var answers = frmCollectAnswers();

  var missing = f.questions.filter(function (q) {
    if (!q.required) return false;
    var v = answers[q.id];
    return v === '' || v === undefined || (Array.isArray(v) && !v.length);
  });
  if (missing.length) {
    frmToast('Still needed: ' +
      missing.map(function (q) { return q.label; }).join(', '), 'error');
    return;
  }

  var entryKey = '', entryLabel = '', entryDept = '';
  if (multi && !editing) {
    var el = document.getElementById('frmEntryKey');
    entryKey = el ? String(el.value || '').trim() : '';
    if (!entryKey) {
      frmToast(f.multiMode === 'date'
        ? 'Choose the date this entry is for.'
        : 'Choose the employee this entry is for.', 'error');
      return;
    }
    if (f.multiMode === 'date') {
      entryLabel = entryKey;
      if (frmUsedKeys()[entryKey.toLowerCase()]) {
        frmToast('You already have an entry for ' + frmDate(entryKey) +
                 '. Open it to make changes.', 'error');
        return;
      }
    } else {
      var opt = el.options[el.selectedIndex];
      entryLabel = opt ? (opt.getAttribute('data-name') || entryKey) : entryKey;
      entryDept = opt ? (opt.getAttribute('data-dept') || '') : '';
    }
  }

  // One id per attempt, reused across retries so a retry never double-writes.
  if (!frmState.submitId) frmState.submitId = frmUuid();

  frmState.submitting = true;
  var btn = document.getElementById('frmSubmitBtn');
  var hint = document.getElementById('frmSubmitHint');
  if (btn) btn.disabled = true;
  if (hint) hint.textContent = 'Saving to the server\u2026';
  frmGuardUnload(true);

  var action = editing ? 'updateResponse' : 'submitResponse';
  var payload = editing
    ? { responseId: editing.responseId, answers: answers }
    : { formId: f.formId, clientSubmitId: frmState.submitId,
        entryKey: entryKey, entryLabel: entryLabel, entryDept: entryDept,
        answers: answers };

  frmBusyApi(action, payload, editing ? 'Saving changes' : 'Saving entry')
    .then(function (d) {
      // The server may answer "somebody already recorded this employee".
      // That is a question, not a result, so nothing is reported as saved.
      if (d && d.conflict) {
        frmGuardUnload(false);
        frmState.submitting = false;
        if (btn) btn.disabled = false;
        if (hint) hint.textContent = '';
        return frmAskOverride(d, payload);
      }

      // Only now, with a server-confirmed write, does anything say it worked.
      frmGuardUnload(false);
      frmState.submitting = false;
      frmState.submitId = null;

      var scoreBit = (d.scored && d.maxScore !== '' && d.maxScore !== undefined)
        ? ' Score ' + d.score + '/' + d.maxScore + '.' : '';

      if (multi) {
        // Stay on the form: the next entry is the likely next action.
        frmState.myEntries = d.myEntries || frmState.myEntries;
        frmState.editingId = null;
        // Back to the list, so the next step is a deliberate choice again.
        frmState.adding = false;
        frmState.entryKey = '';
        frmState.taken = d.takenKeys || frmState.taken;
        frmToast(editing ? 'Changes saved.' + scoreBit
          : (d.overrode
              ? 'Entry replaced and now recorded under your name.' + scoreBit
              : 'Entry saved.' + scoreBit), 'success');
        frmRender();
      } else {
        frmState.openForm = null;
        frmState.view = null;
        frmToast('Submitted. Reference ' + d.responseId + '.' + scoreBit, 'success');
      }
      frmBootstrap();
    }).catch(function (err) {
      frmState.submitting = false;
      frmGuardUnload(false);
      if (btn) btn.disabled = false;
      if (hint) hint.textContent = '';
      frmToast('Not saved: ' + err.message, 'error');
    });
}

/**
 * An employee can only be on this form once in total, so recording one that a
 * colleague already did means replacing their entry. Asked plainly, with who
 * and when, before anything is touched.
 */
function frmAskOverride(d, payload) {
  return frmConfirm({
    title: 'Already recorded',
    body: (d.entryLabel || 'That employee') + ' was already recorded by ' +
          (d.heldBy || 'a colleague') + ' on ' + frmStamp(d.heldOn) + '.',
    detail: 'Replacing it deletes their entry and records this one under ' +
            'your name instead. The answers they gave are kept in the ' +
            'activity log. Their entry will no longer count towards their ' +
            'total.',
    ok: 'Replace their entry',
    cancel: 'Leave it alone',
    danger: true
  }).then(function (yes) {
    if (!yes) {
      frmToast('Nothing was changed. Pick a different employee, or ask ' +
               (d.heldBy || 'them') + ' to update their entry.', 'info');
      return;
    }

    frmState.submitting = true;
    var btn = document.getElementById('frmSubmitBtn');
    var hint = document.getElementById('frmSubmitHint');
    if (btn) btn.disabled = true;
    if (hint) hint.textContent = 'Replacing the earlier entry\u2026';
    frmGuardUnload(true);

    // Same clientSubmitId: a retry still cannot double-write.
    var again = Object.assign({}, payload, { override: true });
    return frmBusyApi('submitResponse', again, 'Replacing entry')
      .then(function (r) {
        frmGuardUnload(false);
        frmState.submitting = false;
        frmState.submitId = null;
        frmState.myEntries = r.myEntries || frmState.myEntries;
        frmState.taken = r.takenKeys || frmState.taken;
        frmState.editingId = null;
        frmState.adding = false;
        frmState.entryKey = '';
        frmToast('Entry replaced and now recorded under your name.', 'success');
        frmRender();
        frmBootstrap();
      }).catch(function (err) {
        frmState.submitting = false;
        frmGuardUnload(false);
        if (btn) btn.disabled = false;
        if (hint) hint.textContent = '';
        frmToast('Not replaced: ' + err.message, 'error');
      });
  });
}

var frmUnloadHandler = null;
function frmGuardUnload(on) {
  if (on && !frmUnloadHandler) {
    frmUnloadHandler = function (e) {
      e.preventDefault();
      e.returnValue = 'This entry has not finished saving yet.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', frmUnloadHandler);
  } else if (!on && frmUnloadHandler) {
    window.removeEventListener('beforeunload', frmUnloadHandler);
    frmUnloadHandler = null;
  }
}

/* ------------------------------------------------------------ 12. builder */

function frmTypeName(v) {
  for (var i = 0; i < FRM_TYPES.length; i++) {
    if (FRM_TYPES[i].v === v) return FRM_TYPES[i].t;
  }
  return 'Short text';
}

function frmBlankQuestion(n) {
  return { id: 'q' + n, type: 'short_text', label: '', help: '',
           required: false, options: [], correct: [], points: 1 };
}

function frmNewForm() {
  frmState.pickView = 'all';
  frmState.draft = {
    formId: '', clientFormId: frmUuid(), title: '', description: '',
    status: 'draft',
    allowMultiple: false, multiMode: '', entryDepts: [], scored: false,
    openFrom: '', openUntil: '',
    audience: 'ALL', audienceEmails: [],
    questions: [frmBlankQuestion(1)]
  };
  frmState.openQ = 0;
  frmState.view = 'builder';
  frmRender();
}

function frmDraftFrom(f) {
  return {
    formId: f.formId, clientFormId: '',
    title: f.title || '', description: f.description || '',
    status: f.status, allowMultiple: !!f.allowMultiple,
    multiMode: f.multiMode || '',
    entryDepts: (f.entryDepts || []).map(function (x) { return String(x); }),
    scored: !!f.scored,
    openFrom: f.openFrom || '', openUntil: f.openUntil || '',
    audience: f.audience === 'LIST' ? 'LIST' : 'ALL',
    audienceEmails: (f.audienceEmails || []).map(function (e) {
      return String(e).toLowerCase();
    }),
    questions: (f.questions || []).map(function (q, i) {
      return {
        id: q.id || ('q' + (i + 1)), type: q.type, label: q.label,
        help: q.help || '', required: !!q.required,
        options: q.options || [], correct: q.correct || [],
        points: q.points || 1
      };
    })
  };
}

function frmEditForm(formId) {
  // The admin form list already carries the full definition, so the editor
  // opens with no network round trip at all. Fall back only if it is absent.
  // Only trust the cached list if it really carries the whole definition.
  // A partial entry would open the editor with blank recipients or blank
  // departments, which reads as "my settings were not saved".
  var cached = frmState.forms.filter(function (f) {
    return f.formId === formId && Array.isArray(f.questions) &&
           Array.isArray(f.audienceEmails) && Array.isArray(f.entryDepts);
  })[0];

  if (cached) {
    frmStartDraft(cached);
    return;
  }

  frmBusyApi('getForm', { formId: formId }, 'Opening form').then(function (d) {
    frmStartDraft(d.form);
  }).catch(function (err) { frmToast(err.message, 'error'); });
}

/**
 * Opens the editor on a stored definition. Both routes in - the cached admin
 * list and a fresh getForm - go through here, so neither can drift from the
 * other in what it sets up.
 */
function frmStartDraft(f) {
  frmState.draft = frmDraftFrom(f);
  if (!frmState.draft.questions.length) {
    frmState.draft.questions = [frmBlankQuestion(1)];
  }
  // A form already sent to specific people opens showing that selection.
  frmState.pickView = (frmState.draft.audience === 'LIST' &&
    frmState.draft.audienceEmails.length) ? 'selected' : 'all';
  // Existing questions start collapsed, so the whole form is visible at once.
  frmState.openQ = -1;
  frmState.view = 'builder';
  frmRender();
}

function frmRenderBuilder() {
  var d = frmState.draft;
  var html = '<div class="frm-page">' +
    '<button class="frm-back" onclick="frmCancelBuilder()">Back to settings</button>' +
    '<h1 class="frm-page__title">' + (d.formId ? 'Edit form' : 'Add form') + '</h1>' +

    '<div class="frm-sheet">' +
      '<h2 class="frm-sheet__head">The basics</h2>' +
      '<div class="frm-field"><label for="frmDTitle">Title' +
        '<span class="frm-star">*</span></label>' +
        '<input class="frm-input" id="frmDTitle" value="' + frmEsc(d.title) +
        '" placeholder="e.g. Monthly field report"></div>' +
      '<div class="frm-field"><label for="frmDDesc">Description</label>' +
        '<textarea class="frm-input" rows="2" id="frmDDesc" ' +
        'placeholder="One line telling staff what this is for">' +
        frmEsc(d.description) + '</textarea></div>' +
      '<div class="frm-pair">' +
        '<div class="frm-field"><label for="frmDFrom">Open from</label>' +
          '<input class="frm-input" type="date" id="frmDFrom" value="' +
            frmEsc(d.openFrom) + '"></div>' +
        '<div class="frm-field"><label for="frmDUntil">Open until</label>' +
          '<input class="frm-input" type="date" id="frmDUntil" value="' +
            frmEsc(d.openUntil) + '"></div>' +
      '</div>' +
      '<p class="frm-field__note">Both dates count as open, so setting the ' +
        'same day for each keeps the form open for that whole day. Leave ' +
        'blank for no limit.</p>' +
    '</div>' +

    '<div class="frm-sheet">' +
      '<h2 class="frm-sheet__head">How often can someone fill it in?</h2>' +
      frmRepeatBlock(d) +
    '</div>' +

    '<div class="frm-sheet">' +
      '<h2 class="frm-sheet__head">Who is it for?</h2>' +
      frmAudienceBlock(d) +
    '</div>' +

    '<div class="frm-sheet">' +
      '<h2 class="frm-sheet__head">Questions' +
        '<span class="frm-count">' + d.questions.length + '</span></h2>' +
      '<label class="frm-opt frm-opt--wide"><input type="checkbox" id="frmDScored"' +
        (d.scored ? ' checked' : '') + ' onchange="frmSyncDraft();frmRender()">' +
        '<span>Mark this as a test and score the answers</span></label>' +
      '<div class="frm-qlist">' +
        d.questions.map(function (q, i) {
          return frmBuilderQuestion(q, i, d.scored, d.questions.length);
        }).join('') +
      '</div>' +
      '<button type="button" class="frm-addq" onclick="frmAddQuestion()">' +
        '<span class="frm-addq__plus" aria-hidden="true">+</span>' +
        '<span>Add question</span>' +
      '</button>' +
    '</div>' +

    '<div class="frm-acts frm-acts--sticky">' +
      '<button class="frm-btn frm-btn--key" onclick="frmSaveDraft(\'published\')">' +
        (d.formId && d.status === 'published' ? 'Save changes' : 'Save and publish') +
      '</button>' +
      '<button class="frm-btn" onclick="frmSaveDraft(\'draft\')">Save as draft</button>' +
      '<button class="frm-btn" onclick="frmCancelBuilder()">Cancel</button>' +
      '<span class="frm-hint" id="frmBuilderHint"></span>' +
    '</div>' +
  '</div>';

  document.getElementById('frmRoot').innerHTML = html;
  if (d.audience === 'LIST') {
    frmApplyPicker();
  }
}

/** Single submission, or repeats keyed by employee or by date. */
function frmRepeatBlock(d) {
  var html = '<div class="frm-opts frm-opts--row">' +
    '<label class="frm-opt"><input type="radio" name="frmRepeat" value="once"' +
      (d.allowMultiple ? '' : ' checked') +
      ' onchange="frmSetRepeat(\'once\')"><span>One submission each</span></label>' +
    '<label class="frm-opt"><input type="radio" name="frmRepeat" value="many"' +
      (d.allowMultiple ? ' checked' : '') +
      ' onchange="frmSetRepeat(\'many\')"><span>More than one</span></label>' +
  '</div>';

  if (!d.allowMultiple) {
    return html + '<p class="frm-field__note">Each person can submit once. ' +
      'After that the form shows as done for them.</p>';
  }

  return html +
    '<div class="frm-sub">' +
      '<p class="frm-sub__ask">What makes each entry different?' +
        '<span class="frm-star">*</span></p>' +
      '<label class="frm-opt frm-opt--wide"><input type="radio" name="frmMulti" ' +
        'value="employee"' + (d.multiMode === 'employee' ? ' checked' : '') +
        ' onchange="frmSetMulti(\'employee\')"><span>' +
        '<b>One entry per employee</b>' +
        '<em>The person filling it in picks a colleague for each entry, and ' +
        'can record every employee once.</em></span></label>' +
      '<label class="frm-opt frm-opt--wide"><input type="radio" name="frmMulti" ' +
        'value="date"' + (d.multiMode === 'date' ? ' checked' : '') +
        ' onchange="frmSetMulti(\'date\')"><span>' +
        '<b>One entry per date</b>' +
        '<em>One entry per calendar day. Useful for daily or weekly ' +
        'reporting.</em></span></label>' +
      (d.multiMode ? '' : '<p class="frm-note frm-note--bad">Pick one before ' +
        'saving, or the form cannot tell repeat entries apart.</p>') +
      (d.multiMode === 'employee' ? frmEntryDeptBlock(d) : '') +
      (d.multiMode ? '<p class="frm-field__note">Earlier entries stay visible ' +
        'and can be edited. The same ' +
        (d.multiMode === 'date' ? 'date' : 'employee') +
        ' cannot be recorded twice.</p>' : '') +
    '</div>';
}

/** Which departments a per-employee entry may be recorded against. */
function frmEntryDeptBlock(d) {
  var staff = frmEmployees();
  if (!staff.length) {
    return '<div class="frm-note">The employee list has not loaded, so ' +
      'departments cannot be narrowed. Every employee will be available.</div>';
  }
  var depts = frmDepartments(staff);
  var picked = {};
  (d.entryDepts || []).forEach(function (x) { picked[x] = 1; });
  var n = (d.entryDepts || []).length;

  var counts = {};
  staff.forEach(function (p) { counts[p.dept] = (counts[p.dept] || 0) + 1; });
  var reach = n
    ? staff.filter(function (p) { return picked[p.dept]; }).length
    : staff.length;

  return '<div class="frm-sub frm-sub--tight">' +
    '<p class="frm-sub__ask">Which departments can entries be recorded for?</p>' +
    '<div class="frm-chips">' +
      depts.map(function (dp, i) {
        // frm-chip--entry, not the bare frm-chip the audience picker uses:
        // these two chip groups look alike but mean different things, and
        // sharing a selector let the picker overwrite this one's highlight.
        return '<button type="button" class="frm-chip frm-chip--entry' +
          (picked[dp] ? ' is-on' : '') + '" data-dept="' + frmEsc(dp) +
          '" onclick="frmToggleEntryDept(' + i + ')">' + frmEsc(dp) +
          '<span class="frm-chip__n">' + (counts[dp] || 0) + '</span>' +
          '</button>';
      }).join('') +
    '</div>' +
    '<p class="frm-field__note">' +
      (n ? 'Whoever fills this in can choose from <b>' + reach +
           '</b> colleague' + (reach === 1 ? '' : 's') + ' across ' + n +
           ' department' + (n === 1 ? '' : 's') + '.'
         : 'None picked, so all <b>' + staff.length +
           '</b> employees will be available.') +
    '</p>' +
  '</div>';
}

function frmToggleEntryDept(i) {
  frmSyncDraft();
  var depts = frmDepartments(frmEmployees());
  var dept = depts[i];
  if (!dept) return;
  var d = frmState.draft;
  if (!d.entryDepts) d.entryDepts = [];
  var at = d.entryDepts.indexOf(dept);
  if (at === -1) d.entryDepts.push(dept);
  else d.entryDepts.splice(at, 1);
  frmRender();
}

function frmSetRepeat(mode) {
  frmSyncDraft();
  frmState.draft.allowMultiple = (mode === 'many');
  if (!frmState.draft.allowMultiple) {
    frmState.draft.multiMode = '';
    frmState.draft.entryDepts = [];
  }
  frmRender();
}

function frmSetMulti(mode) {
  frmSyncDraft();
  frmState.draft.multiMode = mode;
  // Departments only mean anything for per-employee entries.
  if (mode !== 'employee') frmState.draft.entryDepts = [];
  frmRender();
}

function frmAudienceBlock(d) {
  var html = '<div class="frm-opts frm-opts--row">' +
    '<label class="frm-opt"><input type="radio" name="frmAud" value="ALL"' +
      (d.audience === 'ALL' ? ' checked' : '') +
      ' onchange="frmSetAudience(\'ALL\')"><span>All team members</span></label>' +
    '<label class="frm-opt"><input type="radio" name="frmAud" value="LIST"' +
      (d.audience === 'LIST' ? ' checked' : '') +
      ' onchange="frmSetAudience(\'LIST\')"><span>Selected team members</span></label>' +
  '</div>';

  if (d.audience !== 'LIST') {
    return html + '<p class="frm-field__note">Everyone on staff will see it.</p>';
  }

  var staff = frmEmployees();
  if (!staff.length) {
    return html + '<div class="frm-note frm-note--bad">The employee list has ' +
      'not loaded, so individual members cannot be picked yet. Open the ' +
      'Employees page once and come back, or send this to all team members.' +
      '</div>';
  }

  var depts = frmDepartments(staff);
  var chosen = {};
  d.audienceEmails.forEach(function (e) { chosen[e] = 1; });

  return html + '<div class="frm-picker">' +
    '<div class="frm-picker__top">' +
      '<input class="frm-input" id="frmPickSearch" type="search" ' +
        'placeholder="Search by name or email" oninput="frmFilterPicker()">' +
      '<span class="frm-picker__n" id="frmPickCount"></span>' +
    '</div>' +
    '<div class="frm-chips">' +
      depts.map(function (dp, i) {
        return '<button type="button" class="frm-chip" data-dept="' + frmEsc(dp) +
               '" onclick="frmToggleDept(' + i + ')">' + frmEsc(dp) + '</button>';
      }).join('') +
    '</div>' +
    '<div class="frm-picker__acts">' +
      '<div class="frm-pickview" role="group" aria-label="Which staff to show">' +
        '<button type="button" class="frm-pv' +
          (d.audienceEmails.length && frmState.pickView === 'selected'
            ? '' : ' is-on') + '" ' +
          'onclick="frmSetPickView(\'all\')">All staff</button>' +
        '<button type="button" class="frm-pv' +
          (d.audienceEmails.length && frmState.pickView === 'selected'
            ? ' is-on' : '') + '" ' +
          'onclick="frmSetPickView(\'selected\')">Selected only</button>' +
      '</div>' +
      '<button type="button" class="frm-btn frm-btn--tiny" ' +
        'onclick="frmPickAll(true)">Select all shown</button>' +
      '<button type="button" class="frm-btn frm-btn--tiny" ' +
        'onclick="frmPickAll(false)">Clear</button>' +
    '</div>' +
    '<div class="frm-people" id="frmPickList">' +
      staff.map(function (p) {
        return '<label class="frm-person" data-email="' + frmEsc(p.email) +
          '" data-dept="' + frmEsc(p.dept) +
          '" data-hay="' + frmEsc((p.name + ' ' + p.email).toLowerCase()) + '">' +
          '<input type="checkbox" onchange="frmTogglePerson(this)" value="' +
            frmEsc(p.email) + '"' + (chosen[p.email] ? ' checked' : '') + '>' +
          '<span class="frm-person__name">' + frmEsc(p.name) + '</span>' +
          '<span class="frm-person__dept">' + frmEsc(p.dept) + '</span>' +
        '</label>';
      }).join('') +
      '<p class="frm-people__none" id="frmPickNone" hidden>Nobody matches. ' +
        'Switch to All staff to pick someone.</p>' +
    '</div>' +
  '</div>';
}

/** 'Selected only' answers "who did I pick?"; searching always spans all. */
function frmSetPickView(v) {
  frmState.pickView = (v === 'selected') ? 'selected' : 'all';
  var box = document.getElementById('frmPickSearch');
  if (box && frmState.pickView === 'selected') box.value = '';
  var btns = document.querySelectorAll('.frm-pv');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('is-on',
      (i === 1) === (frmState.pickView === 'selected'));
  }
  frmApplyPicker();
}

function frmSetAudience(mode) {
  frmSyncDraft();
  frmState.draft.audience = mode === 'LIST' ? 'LIST' : 'ALL';
  frmRender();
}

function frmTogglePerson(input) {
  var d = frmState.draft;
  if (!d) return;
  var email = String(input.value).toLowerCase();
  var at = d.audienceEmails.indexOf(email);
  if (input.checked && at === -1) d.audienceEmails.push(email);
  if (!input.checked && at !== -1) d.audienceEmails.splice(at, 1);
  frmPaintPicker();
}

function frmDeptRows(dept) {
  var all = document.querySelectorAll('.frm-person');
  var out = [];
  for (var i = 0; i < all.length; i++) {
    if (all[i].getAttribute('data-dept') === dept) out.push(all[i]);
  }
  return out;
}

/**
 * Audience picker: selects a whole department of people, or clears it if it
 * is already fully selected. Not to be confused with frmToggleEntryDept,
 * which sets which departments a form's entries may be recorded for.
 */
function frmToggleDept(i) {
  var depts = frmDepartments(frmEmployees());
  var dept = depts[i];
  if (!dept) return;
  var rows = frmDeptRows(dept);
  var allOn = rows.length > 0;
  rows.forEach(function (r) {
    if (!r.querySelector('input').checked) allOn = false;
  });
  rows.forEach(function (r) {
    var b = r.querySelector('input');
    b.checked = !allOn;
    frmTogglePerson(b);
  });
  frmApplyPicker();
}

function frmPickAll(on) {
  // "Shown" respects the current search, so this stays safe with 150 staff.
  var rows = document.querySelectorAll('.frm-person');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].style.display === 'none') continue;
    var b = rows[i].querySelector('input');
    b.checked = !!on;
    frmTogglePerson(b);
  }
  frmApplyPicker();
}

function frmFilterPicker() {
  frmApplyPicker();
}

/**
 * Decides which rows are visible, then refreshes the count and the chips.
 * Search deliberately overrides 'Selected only' - otherwise there would be no
 * way to find and add somebody new once the view was switched.
 */
function frmApplyPicker() {
  var box = document.getElementById('frmPickSearch');
  var term = box ? box.value.trim().toLowerCase() : '';
  var onlySelected = (frmState.pickView === 'selected') && !term;

  var rows = document.querySelectorAll('.frm-person');
  var shown = 0;
  for (var i = 0; i < rows.length; i++) {
    var hay = rows[i].getAttribute('data-hay') || '';
    var show = !term || hay.indexOf(term) !== -1;
    if (show && onlySelected) {
      var cb = rows[i].querySelector('input');
      show = !!(cb && cb.checked);
    }
    rows[i].style.display = show ? '' : 'none';
    if (show) shown++;
  }

  var none = document.getElementById('frmPickNone');
  if (none) {
    none.hidden = shown > 0;
    none.textContent = onlySelected
      ? 'Nobody selected yet. Switch to All staff, or pick a department above.'
      : 'No staff match that search.';
  }
  frmPaintPicker();
}

/** Updates the count and chip states in place, so search focus is kept. */
function frmPaintPicker() {
  var d = frmState.draft;
  if (!d) return;
  var count = document.getElementById('frmPickCount');
  if (count) {
    var n = d.audienceEmails.length;
    count.textContent = n + ' selected';
    count.className = 'frm-picker__n' + (n ? ' is-on' : '');
  }
  // Scoped to the picker: never touch the entry-department chips, which
  // track the form's settings rather than who is currently ticked.
  var chips = document.querySelectorAll('.frm-picker .frm-chip');
  for (var i = 0; i < chips.length; i++) {
    var rows = frmDeptRows(chips[i].getAttribute('data-dept'));
    var on = rows.length > 0;
    rows.forEach(function (r) {
      if (!r.querySelector('input').checked) on = false;
    });
    chips[i].classList.toggle('is-on', on);
  }
}

function frmBuilderQuestion(q, i, scored, total) {
  var open = frmState.openQ === i;
  var isChoice = FRM_CHOICE_TYPES.indexOf(q.type) !== -1;
  var editableOpts = isChoice && q.type !== 'yes_no';

  // Collapsed: a one-line summary. Only the open question renders its fields,
  // which is also why frmSyncDraft can safely skip the closed ones.
  var h = '<div class="frm-qcard" data-open="' + open + '">' +
    '<div class="frm-qcard__head">' +
      '<button type="button" class="frm-qcard__toggle" aria-expanded="' + open +
        '" onclick="frmToggleQ(' + i + ')">' +
        '<span class="frm-qcard__n">' + (i + 1) + '</span>' +
        '<span class="frm-qcard__title' + (q.label ? '' : ' is-empty') + '">' +
          frmEsc(q.label || 'Untitled question') + '</span>' +
        '<span class="frm-qcard__type">' + frmEsc(frmTypeName(q.type)) + '</span>' +
        (q.required ? '<span class="frm-qcard__req">Required</span>' : '') +
        '<span class="frm-qcard__chev" aria-hidden="true"></span>' +
      '</button>' +
      '<div class="frm-rowacts">' +
        (i > 0 ? '<button class="frm-btn frm-btn--tiny" title="Move up" ' +
          'onclick="frmMoveQuestion(' + i + ',-1)">Up</button>' : '') +
        (i < total - 1 ? '<button class="frm-btn frm-btn--tiny" ' +
          'title="Move down" onclick="frmMoveQuestion(' + i +
          ',1)">Down</button>' : '') +
        '<button class="frm-btn frm-btn--tiny frm-btn--warn" ' +
          'onclick="frmRemoveQuestion(' + i + ')">Remove</button>' +
      '</div>' +
    '</div>';

  if (!open) return h + '</div>';

  h += '<div class="frm-qedit" data-i="' + i + '">' +
    '<div class="frm-field"><label>Question</label>' +
      '<input class="frm-input" data-f="label" value="' + frmEsc(q.label) +
      '" placeholder="What are you asking?"></div>' +
    '<div class="frm-pair">' +
      '<div class="frm-field"><label>Answer type</label>' +
        '<select class="frm-input" data-f="type" onchange="frmSyncDraft();frmRender()">';
  FRM_TYPES.forEach(function (t) {
    h += '<option value="' + t.v + '"' + (q.type === t.v ? ' selected' : '') + '>' +
         frmEsc(t.t) + '</option>';
  });
  h += '</select></div>' +
      '<div class="frm-field frm-field--mid">' +
        '<label class="frm-opt"><input type="checkbox" data-f="required"' +
          (q.required ? ' checked' : '') + '><span>Must be answered</span></label>' +
      '</div>' +
    '</div>' +
    '<div class="frm-field"><label>Hint below the question</label>' +
      '<input class="frm-input" data-f="help" value="' + frmEsc(q.help) +
      '" placeholder="Optional"></div>';

  if (editableOpts) {
    // One box per choice, so a choice can run to several lines and it is
    // always clear which text belongs to which option.
    var opts = (q.options && q.options.length) ? q.options : [''];
    h += '<div class="frm-field"><label>Choices</label>' +
      '<div class="frm-choicelist">' +
        opts.map(function (o, k) {
          return '<div class="frm-choicerow">' +
            '<span class="frm-choicerow__n">' + (k + 1) + '</span>' +
            '<textarea class="frm-input frm-choicerow__box" rows="1" ' +
              'data-f="opt" data-k="' + k + '" ' +
              'placeholder="Choice ' + (k + 1) + '" ' +
              'oninput="frmGrow(this)">' + frmEsc(o) + '</textarea>' +
            (opts.length > 1
              ? '<button type="button" class="frm-btn frm-btn--tiny ' +
                'frm-btn--warn" title="Remove this choice" ' +
                'onclick="frmRemoveOption(' + i + ',' + k + ')">Remove</button>'
              : '') +
          '</div>';
        }).join('') +
      '</div>' +
      '<button type="button" class="frm-addopt" onclick="frmAddOption(' + i +
        ')"><span class="frm-addopt__plus" aria-hidden="true">+</span>' +
        '<span>Add choice</span></button>' +
    '</div>';
  }
  if (scored) {
    h += '<div class="frm-pair">' +
      '<div class="frm-field">' + frmCorrectField(q, i, isChoice) + '</div>' +
      '<div class="frm-field frm-field--narrow"><label>Marks</label>' +
        '<input class="frm-input" type="number" min="0" data-f="points" value="' +
        frmEsc(q.points || 1) + '"></div>' +
    '</div>';
  }
  return h + '</div></div>';
}

/**
 * With choices in hand, the answer key is a tick list rather than typed text.
 * Typing it out broke as soon as a choice contained a comma or a line break.
 */
function frmCorrectField(q, i, isChoice) {
  var opts = (q.options || []).filter(function (o) { return !!o; });
  if (!isChoice || !opts.length) {
    return '<label>Correct answer</label>' +
      '<input class="frm-input" data-f="correct" value="' +
      frmEsc((q.correct || []).join(', ')) +
      '" placeholder="Leave blank to skip scoring">';
  }
  var many = q.type === 'checkbox';
  var chosen = {};
  (q.correct || []).forEach(function (c) { chosen[String(c)] = 1; });
  return '<label>Correct answer' + (many ? 's' : '') +
      ' <span class="frm-soft">tick to mark, leave blank to skip scoring' +
      '</span></label>' +
    '<div class="frm-keylist">' +
      opts.map(function (o, k) {
        return '<label class="frm-opt frm-opt--key">' +
          '<input type="' + (many ? 'checkbox' : 'radio') + '" ' +
            'name="frmKey' + i + '" data-f="key" data-v="' + frmEsc(o) + '"' +
            (chosen[o] ? ' checked' : '') + '>' +
          '<span>' + frmEsc(o) + '</span></label>';
      }).join('') +
      (many ? '' : '<button type="button" class="frm-btn frm-btn--tiny" ' +
        'onclick="frmClearKey(' + i + ')">Clear</button>') +
    '</div>';
}

/** Keeps a choice box tall enough for its text without a scrollbar. */
function frmGrow(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight + 2, 260) + 'px';
}

function frmAddOption(i) {
  frmSyncDraft();
  var q = frmState.draft.questions[i];
  if (!q.options.length) q.options = [''];
  q.options.push('');
  frmRender();
  setTimeout(function () {
    var boxes = document.querySelectorAll('.frm-qedit [data-f="opt"]');
    var last = boxes[boxes.length - 1];
    if (last) { last.focus(); frmGrow(last); }
  }, 0);
}

function frmRemoveOption(i, k) {
  frmSyncDraft();
  var q = frmState.draft.questions[i];
  var gone = q.options[k];
  q.options.splice(k, 1);
  // A removed choice cannot stay in the answer key.
  q.correct = (q.correct || []).filter(function (c) { return c !== gone; });
  frmRender();
}

function frmClearKey(i) {
  frmSyncDraft();
  frmState.draft.questions[i].correct = [];
  frmRender();
}

/** Accordion: one question open at a time, keeping the page short. */
function frmToggleQ(i) {
  frmSyncDraft();                       // never lose edits on collapse
  frmState.openQ = (frmState.openQ === i) ? -1 : i;
  frmRender();
}

function frmSyncDraft() {
  var d = frmState.draft;
  if (!d) return;
  var g = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };
  var c = function (id) { var e = document.getElementById(id); return !!(e && e.checked); };

  if (document.getElementById('frmDTitle')) {
    d.title = g('frmDTitle');
    d.description = g('frmDDesc');
    d.openFrom = g('frmDFrom');
    d.openUntil = g('frmDUntil');
  }
  if (document.getElementById('frmDScored')) d.scored = c('frmDScored');

  var blocks = document.querySelectorAll('.frm-qedit');
  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    var qi = Number(b.getAttribute('data-i'));
    var q = d.questions[qi];
    if (!q) continue;
    var f = function (name) { return b.querySelector('[data-f="' + name + '"]'); };
    if (f('label')) q.label = f('label').value.trim();
    if (f('type')) q.type = f('type').value;
    if (f('help')) q.help = f('help').value.trim();
    if (f('required')) q.required = f('required').checked;
    // Choices come from one box each, so internal line breaks survive.
    var boxes = b.querySelectorAll('[data-f="opt"]');
    if (boxes.length) {
      var got = [];
      for (var m = 0; m < boxes.length; m++) {
        got.push(String(boxes[m].value).replace(/[ \t]+$/gm, '').trim());
      }
      // Keep blanks in place while typing; strip them only on save.
      q.options = got;
    }
    if (q.type === 'yes_no') q.options = ['Yes', 'No'];
    if (FRM_CHOICE_TYPES.indexOf(q.type) === -1) q.options = [];

    var keys = b.querySelectorAll('[data-f="key"]');
    if (keys.length) {
      var picked = [];
      for (var p = 0; p < keys.length; p++) {
        if (keys[p].checked) picked.push(keys[p].getAttribute('data-v'));
      }
      q.correct = picked;
    } else if (f('correct')) {
      q.correct = f('correct').value.split(',')
        .map(function (s) { return s.trim(); })
        .filter(function (s) { return !!s; });
    }
    if (f('points')) q.points = Number(f('points').value || 1);
  }
}

function frmAddQuestion() {
  frmSyncDraft();
  var d = frmState.draft;
  var n = d.questions.length + 1;
  var used = {}; d.questions.forEach(function (q) { used[q.id] = 1; });
  while (used['q' + n]) n++;
  d.questions.push(frmBlankQuestion(n));
  frmState.openQ = d.questions.length - 1;   // open it ready to type
  frmRender();
  setTimeout(function () {
    var el = document.querySelector('.frm-qcard[data-open="true"] [data-f="label"]');
    if (el) { el.focus(); if (el.scrollIntoView) el.scrollIntoView({ block: 'center' }); }
  }, 0);
}

function frmRemoveQuestion(i) {
  frmSyncDraft();
  var d = frmState.draft;
  if (d.questions.length <= 1) {
    frmToast('A form needs at least one question.', 'error');
    return;
  }
  d.questions.splice(i, 1);
  if (frmState.openQ === i) frmState.openQ = -1;
  else if (frmState.openQ > i) frmState.openQ--;
  frmRender();
}

function frmMoveQuestion(i, dir) {
  frmSyncDraft();
  var qs = frmState.draft.questions;
  var j = i + dir;
  if (j < 0 || j >= qs.length) return;
  var t = qs[i]; qs[i] = qs[j]; qs[j] = t;
  if (frmState.openQ === i) frmState.openQ = j;
  else if (frmState.openQ === j) frmState.openQ = i;
  frmRender();
}

function frmCancelBuilder() {
  if (!confirm('Discard changes to this form?')) return;
  frmState.draft = null;
  frmState.view = null;
  frmState.tab = 'settings';
  frmRender();
}

function frmSaveDraft(status) {
  frmSyncDraft();
  var d = frmState.draft;

  if (!d.title) { frmToast('Give the form a title.', 'error'); return; }
  if (d.allowMultiple && !d.multiMode) {
    frmToast('Choose whether repeat entries are one per employee or one per date.',
             'error');
    return;
  }
  var unlabelled = d.questions.filter(function (q) { return !q.label; });
  if (unlabelled.length) { frmToast('Every question needs text.', 'error'); return; }
  d.questions.forEach(function (q) {
    if (FRM_CHOICE_TYPES.indexOf(q.type) === -1) return;
    q.options = (q.options || []).filter(function (o) { return !!o; });
    q.correct = (q.correct || []).filter(function (c) {
      return q.options.indexOf(c) !== -1;
    });
  });
  var noOpts = d.questions.filter(function (q) {
    return ['select', 'radio', 'checkbox'].indexOf(q.type) !== -1 &&
           q.options.length < 2;
  });
  if (noOpts.length) {
    frmToast('"' + noOpts[0].label + '" needs at least two choices.', 'error');
    return;
  }
  if (d.audience === 'LIST' && !d.audienceEmails.length) {
    frmToast('Pick at least one team member, or send it to all team members.',
             'error');
    return;
  }
  if (d.openFrom && d.openUntil && d.openFrom > d.openUntil) {
    frmToast('The closing date is before the opening date.', 'error');
    return;
  }

  var hint = document.getElementById('frmBuilderHint');
  if (hint) hint.textContent = 'Saving\u2026';

  frmBusyApi('saveForm', {
    form: Object.assign({}, d, { status: status }),
    clientFormId: d.clientFormId || ''
  }, 'Saving form')
    .then(function (r) {
      if (hint) hint.textContent = '';
      frmState.forms = r.forms || frmState.forms;
      frmState.draft = null;
      frmState.view = null;
      frmState.tab = 'settings';
      frmWriteCache();
      frmToast(status === 'published' ? 'Published.' : 'Saved as draft.', 'success');
      frmRender();
    }).catch(function (err) {
      if (hint) hint.textContent = '';
      frmToast('Not saved: ' + err.message, 'error');
    });
}

/* -------------------------------------------------- 12b. form detail view */

function frmOpenDetail(formId) {
  frmBusyApi('getFormDetail', { formId: formId }, 'Loading form')
    .then(function (d) {
      frmState.detail = d;
      frmState.detailOpen = {};
      frmState.view = 'detail';
      frmRender();
    }).catch(function (err) { frmToast(err.message, 'error'); });
}

function frmCloseDetail() {
  frmState.view = null;
  frmState.detail = null;
  frmState.detailOpen = {};
  frmState.tab = 'dashboard';
  frmRender();
}

function frmToggleRespondent(email) {
  frmState.detailOpen[email] = !frmState.detailOpen[email];
  frmRender();
}

/**
 * Who the form went to, merged with who actually replied. Recipients with
 * nothing yet still appear, because "12 members, 4 replied" is the useful
 * shape - a list of only the repliers hides the gap.
 */
function frmDetailRows() {
  var d = frmState.detail;
  var staff = {};
  frmEmployees().forEach(function (p) { staff[p.email] = p; });

  var replied = {};
  (d.respondents || []).forEach(function (r) { replied[r.email] = r; });

  var expected = (d.audience === 'LIST')
    ? (d.audienceEmails || []).slice()
    : Object.keys(staff);

  var seen = {}, rows = [];
  var add = function (email) {
    var e = String(email).toLowerCase();
    if (!e || seen[e]) return;
    seen[e] = 1;
    var r = replied[e];
    var p = staff[e];
    rows.push({
      email: e,
      name: (p && p.name) || (r && r.name) || e.split('@')[0],
      dept: (p && p.dept) || '',
      count: r ? r.count : 0,
      entries: r ? r.entries : [],
      known: !!p
    });
  };
  expected.forEach(add);
  // Somebody may have replied before the recipient list changed.
  (d.respondents || []).forEach(function (r) { add(r.email); });

  rows.sort(function (a, b) {
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name);
  });
  return rows;
}

function frmRenderDetailPage() {
  var d = frmState.detail;
  if (!d) { frmCloseDetail(); return; }

  var rows = frmDetailRows();
  var replied = rows.filter(function (r) { return r.count > 0; }).length;
  var noun = d.multiMode === 'date' ? 'date'
           : d.multiMode === 'employee' ? 'employee' : 'entry';

  var html = '<div class="frm-page frm-page--wide">' +
    '<button class="frm-back" onclick="frmCloseDetail()">Back to dashboard</button>' +
    '<h1 class="frm-page__title">' + frmEsc(d.title) + '</h1>' +
    (d.description ? '<p class="frm-page__lede">' + frmEsc(d.description) +
      '</p>' : '') +

    '<div class="frm-figures">' +
      frmFigure(rows.length, d.audience === 'LIST'
        ? (rows.length === 1 ? 'recipient' : 'recipients') : 'staff') +
      frmFigure(replied, 'replied') +
      frmFigure(rows.length - replied, 'yet to reply') +
      frmFigure(d.totalEntries,
        d.totalEntries === 1 ? 'entry' : 'entries') +
    '</div>' +

    '<div class="frm-bar">' +
      frmStatusTag(d.status) +
      '<span class="frm-hint">' +
        (d.allowMultiple && d.multiMode
          ? 'One entry per ' + noun
          : 'One submission each') +
        (d.entryDepts && d.entryDepts.length
          ? ', limited to ' + frmEsc(d.entryDepts.join(', ')) : '') +
      '</span>' +
      '<button class="frm-btn" onclick="frmViewResponses(\'' +
        frmEsc(d.formId) + '\')">See all answers</button>' +
    '</div>';

  if (!rows.length) {
    html += '<div class="frm-blank">' +
      '<p class="frm-blank__head">Nobody to show</p>' +
      '<p class="frm-blank__body">This form has no recipients and no ' +
      'responses yet.</p></div></div>';
    document.getElementById('frmRoot').innerHTML = html;
    return;
  }

  html += '<div class="frm-scroll"><table class="frm-grid frm-grid--detail">' +
    '<thead><tr><th>Sent to</th><th>Department</th>' +
    '<th class="frm-num">Responses</th><th></th></tr></thead><tbody>' +
    rows.map(function (r) { return frmDetailRow(r, d); }).join('') +
    '</tbody></table></div></div>';

  document.getElementById('frmRoot').innerHTML = html;
}

function frmDetailRow(r, d) {
  var open = !!frmState.detailOpen[r.email];
  var h = '<tr class="frm-drow' + (r.count ? '' : ' is-quiet') + '">' +
    '<td class="frm-grid__name">' + frmEsc(r.name) +
      '<span class="frm-ref">' + frmEsc(r.email) + '</span></td>' +
    '<td class="frm-soft">' + (r.dept ? frmEsc(r.dept) :
      '<span class="frm-soft">\u2014</span>') + '</td>' +
    '<td class="frm-num">' +
      (r.count
        ? '<button type="button" class="frm-tally-btn' +
            (open ? ' is-on' : '') + '" aria-expanded="' + open + '" ' +
            'onclick="frmToggleRespondent(\'' + frmEsc(r.email) + '\')">' +
            r.count + '</button>'
        : '<span class="frm-soft">0</span>') +
    '</td>' +
    '<td>' + (r.count
      ? '<button type="button" class="frm-btn frm-btn--tiny" ' +
        'onclick="frmToggleRespondent(\'' + frmEsc(r.email) + '\')">' +
        (open ? 'Hide' : 'Show') + '</button>'
      : '<span class="frm-hint">No response yet</span>') + '</td>' +
  '</tr>';

  if (!open || !r.count) return h;

  var headline = d.multiMode === 'employee' ? 'Recorded for'
               : d.multiMode === 'date' ? 'Date'
               : 'Submission';
  h += '<tr class="frm-dsub"><td colspan="4">' +
    '<table class="frm-subgrid"><thead><tr>' +
      '<th>' + headline + '</th><th>Submitted</th>' +
      (d.scored ? '<th class="frm-num">Score</th>' : '') +
      '<th>Reference</th></tr></thead><tbody>' +
    r.entries.map(function (e) {
      var label = e.entryLabel || e.entryKey;
      return '<tr>' +
        '<td class="frm-grid__name">' +
          (label ? frmEsc(frmEntryText(e)) : '<span class="frm-soft">\u2014</span>') +
          (e.entryDept ? '<span class="frm-ref">' + frmEsc(e.entryDept) +
            '</span>' : '') + '</td>' +
        '<td class="frm-soft">' + frmEsc(frmStamp(e.submittedAt)) +
          (e.editCount ? ' <span class="frm-soft">(edited ' + e.editCount +
            'x)</span>' : '') + '</td>' +
        (d.scored ? '<td class="frm-num">' + (e.maxScore
          ? frmEsc(e.score) + '/' + frmEsc(e.maxScore)
          : '<span class="frm-soft">\u2014</span>') + '</td>' : '') +
        '<td class="frm-ref">' + frmEsc(e.responseId) + '</td>' +
      '</tr>';
    }).join('') +
    '</tbody></table></td></tr>';
  return h;
}

/* ------------------------------------------------------------- 13. admins */

function frmOpenAdmins() {
  frmState.view = 'admins';
  frmState.adminSearch = '';
  frmRender();
  frmLoadAdmins();
}

function frmCloseAdmins() {
  frmState.view = null;
  frmState.tab = 'settings';
  frmRender();
}

function frmRenderAdminsPage() {
  document.getElementById('frmRoot').innerHTML = '<div class="frm-page">' +
    '<button class="frm-back" onclick="frmCloseAdmins()">Back to settings</button>' +
    '<h1 class="frm-page__title">Forms admins</h1>' +
    '<p class="frm-page__lede">Anyone here can create and publish forms, read ' +
      'every response, and add or remove other admins.</p>' +
    '<div id="frmAdminArea"><div class="frm-blank">Loading admins\u2026</div></div>' +
  '</div>';
}

function frmLoadAdmins() {
  frmBusyApi('getAdmins', {}, 'Loading admins').then(function (d) {
    frmState.admins = d.admins || [];
    frmState.you = d.you || '';
    frmPaintAdmins();
  }).catch(function (err) {
    var el = document.getElementById('frmAdminArea');
    if (el) el.innerHTML = '<div class="frm-blank frm-blank--bad">' +
      frmEsc(err.message) + '</div>';
  });
}

function frmPaintAdmins() {
  var el = document.getElementById('frmAdminArea');
  if (!el) return;

  var admins = frmState.admins || [];
  var isAdmin = {};
  admins.forEach(function (a) { isAdmin[a.email] = a; });

  var html = '<div class="frm-sheet">' +
    '<h2 class="frm-sheet__head">Current admins' +
      '<span class="frm-count">' + admins.length + '</span></h2>' +
    '<ul class="frm-admins">' +
      admins.map(function (a) {
        var you = a.email === frmState.you;
        return '<li class="frm-admin">' +
          '<span class="frm-admin__who">' +
            '<span class="frm-admin__name">' +
              frmEsc(a.name || a.email.split('@')[0]) +
              (you ? '<span class="frm-admin__you">you</span>' : '') +
            '</span>' +
            '<span class="frm-admin__mail">' + frmEsc(a.email) + '</span>' +
          '</span>' +
          '<span class="frm-admin__meta">' +
            (a.permanent ? 'Set in Code.gs'
              : (a.addedBy ? 'Added by ' + frmEsc(a.addedBy) : '') +
                (a.addedAt ? ' on ' + frmEsc(frmStamp(a.addedAt)) : '')) +
          '</span>' +
          (a.permanent || you
            ? '<span class="frm-admin__fixed">' +
                (a.permanent ? 'Permanent' : 'Cannot remove yourself') + '</span>'
            : '<button class="frm-btn frm-btn--tiny frm-btn--warn" ' +
              'onclick="frmRemoveAdmin(\'' + frmEsc(a.email) +
              '\')">Remove</button>') +
        '</li>';
      }).join('') +
    '</ul></div>';

  var staff = frmEmployees();
  html += '<div class="frm-sheet"><h2 class="frm-sheet__head">Add an admin</h2>';

  if (!staff.length) {
    html += '<div class="frm-note frm-note--bad">The employee list has not ' +
      'loaded, so staff cannot be searched. Open the Employees page once and ' +
      'come back.</div></div>';
    el.innerHTML = html;
    return;
  }

  html += '<div class="frm-picker__top">' +
      '<input class="frm-input" id="frmAdminSearch" type="search" ' +
        'placeholder="Search staff by name or email" ' +
        'oninput="frmFilterAdminSearch()" value="' +
        frmEsc(frmState.adminSearch) + '">' +
      '<span class="frm-picker__n">' + staff.length + ' staff</span>' +
    '</div>' +
    '<div class="frm-people frm-people--tall" id="frmAdminPick">' +
      staff.map(function (p) {
        var already = !!isAdmin[p.email];
        return '<div class="frm-person frm-person--act" data-hay="' +
          frmEsc((p.name + ' ' + p.email).toLowerCase()) + '">' +
          '<span class="frm-person__name">' + frmEsc(p.name) +
            '<span class="frm-person__mail">' + frmEsc(p.email) + '</span>' +
          '</span>' +
          '<span class="frm-person__dept">' + frmEsc(p.dept) + '</span>' +
          (already
            ? '<span class="frm-person__is">Already an admin</span>'
            : '<button class="frm-btn frm-btn--tiny" onclick="frmAddAdmin(\'' +
              frmEsc(p.email) + '\',\'' + frmEsc(p.name) + '\')">Add</button>') +
        '</div>';
      }).join('') +
    '</div></div>';

  el.innerHTML = html;
  if (frmState.adminSearch) frmFilterAdminSearch();
}

function frmFilterAdminSearch() {
  var box = document.getElementById('frmAdminSearch');
  var term = box ? box.value.trim().toLowerCase() : '';
  frmState.adminSearch = term;
  var rows = document.querySelectorAll('#frmAdminPick .frm-person');
  var shown = 0;
  for (var i = 0; i < rows.length; i++) {
    var hit = !term || (rows[i].getAttribute('data-hay') || '').indexOf(term) !== -1;
    rows[i].style.display = hit ? '' : 'none';
    if (hit) shown++;
  }
  var n = document.querySelector('#frmAdminArea .frm-picker__n');
  if (n) n.textContent = term ? shown + ' found' : rows.length + ' staff';
}

function frmAddAdmin(email, name) {
  frmBusyApi('addAdmin', { email: email, name: name }, 'Adding admin')
    .then(function (d) {
      frmState.admins = d.admins || [];
      frmState.you = d.you || frmState.you;
      frmToast((name || email) + ' can now manage forms.', 'success');
      frmPaintAdmins();
    }).catch(function (err) {
      frmToast('Not added: ' + err.message, 'error');
    });
}

function frmRemoveAdmin(email) {
  frmConfirm({
    title: 'Remove admin access?',
    body: email + ' will lose access to Settings, to every response, and to ' +
          'creating forms. Any forms they made are unaffected.',
    ok: 'Remove access',
    danger: true
  }).then(function (yes) {
    if (!yes) return;
    frmBusyApi('removeAdmin', { email: email }, 'Removing access')
      .then(function (d) {
        frmState.admins = d.admins || [];
        frmToast('Access removed for ' + email + '.', 'success');
        frmPaintAdmins();
      }).catch(function (err) {
        frmToast('Not removed: ' + err.message, 'error');
      });
  });
}

/* ---------------------------------------------------------- 13. responses */

function frmViewResponses(formId) {
  frmState.responseFormId = formId || null;
  // Remember where the person came from, so Back goes back there.
  frmState.responseFrom = (frmState.view === 'detail') ? 'detail' : 'settings';
  frmState.view = 'responses';
  frmRender();
  frmLoadResponses();
}

function frmRenderResponsesPage() {
  document.getElementById('frmRoot').innerHTML = '<div class="frm-page">' +
    '<button class="frm-back" onclick="frmCloseResponses()">' +
      (frmState.responseFrom === 'detail' ? 'Back to the form' : 'Back to settings') +
    '</button>' +
    '<h1 class="frm-page__title">Responses</h1>' +
    '<div class="frm-bar">' +
      '<select class="frm-input frm-input--auto" id="frmRespPick" ' +
        'onchange="frmPickResponseForm()" aria-label="Choose a form">' +
        '<option value="">Every form</option>' +
        frmState.forms.map(function (f) {
          return '<option value="' + frmEsc(f.formId) + '"' +
            (frmState.responseFormId === f.formId ? ' selected' : '') + '>' +
            frmEsc(f.title) + ' (' + (f.responseCount || 0) + ')</option>';
        }).join('') +
      '</select>' +
      '<button class="frm-btn" onclick="frmLoadResponses()">Reload</button>' +
      '<button class="frm-btn" onclick="frmExportResponses()">Download as Excel</button>' +
    '</div>' +
    '<div id="frmRespArea"><div class="frm-blank">Loading responses\u2026</div></div>' +
  '</div>';
}

function frmCloseResponses() {
  if (frmState.responseFrom === 'detail' && frmState.detail) {
    frmState.view = 'detail';
    frmRender();
    return;
  }
  frmState.view = null;
  frmState.tab = 'settings';
  frmRender();
}

function frmPickResponseForm() {
  var el = document.getElementById('frmRespPick');
  frmState.responseFormId = el && el.value ? el.value : null;
  frmLoadResponses();
}

function frmLoadResponses() {
  var area = document.getElementById('frmRespArea');
  if (area) area.innerHTML = '<div class="frm-blank">Loading responses\u2026</div>';
  frmBusyApi('getResponses', { formId: frmState.responseFormId }, 'Loading responses')
    .then(function (d) {
      frmState.responses = d.responses || [];
      frmState.responseQuestions = d.questions || [];
      frmPaintResponses();
    }).catch(function (err) {
      var a = document.getElementById('frmRespArea');
      if (a) a.innerHTML = '<div class="frm-blank frm-blank--bad">' +
        frmEsc(err.message) + '</div>';
    });
}

function frmResponseColumns() {
  var cols = [
    { k: 'submittedAt', t: 'Submitted' },
    { k: 'respondentName', t: 'Name' },
    { k: 'respondentEmail', t: 'Email' }
  ];
  if (!frmState.responseFormId) cols.push({ k: 'formTitle', t: 'Form' });
  cols.push({ k: 'entryLabel', t: 'Entry' });
  cols.push({ k: 'entryDept', t: 'Entry department' });
  frmState.responseQuestions.forEach(function (q) {
    cols.push({ k: 'a:' + q.id, t: q.label });
  });
  cols.push({ k: 'score', t: 'Score' });
  cols.push({ k: 'edited', t: 'Edited' });
  cols.push({ k: 'responseId', t: 'Reference' });
  return cols;
}

function frmCellValue(r, key) {
  if (key.indexOf('a:') === 0) {
    var v = r.answers ? r.answers[key.slice(2)] : '';
    if (Array.isArray(v)) return v.join('; ');
    return v == null ? '' : String(v);
  }
  if (key === 'score') return r.maxScore ? r.score + ' / ' + r.maxScore : '';
  if (key === 'edited') {
    return r.editCount ? frmStamp(r.editedAt) + ' (' + r.editCount + ')' : '';
  }
  if (key === 'submittedAt') return frmStamp(r.submittedAt);
  if (key === 'entryLabel') return r.entryLabel ? frmEntryText(r) : '';
  return r[key] == null ? '' : String(r[key]);
}

function frmPaintResponses() {
  var area = document.getElementById('frmRespArea');
  if (!area) return;
  if (!frmState.responses.length) {
    area.innerHTML = '<div class="frm-blank">' +
      '<p class="frm-blank__head">No responses yet</p>' +
      '<p class="frm-blank__body">They appear here as staff submit.</p></div>';
    return;
  }
  var cols = frmResponseColumns();
  area.innerHTML = '<div class="frm-scroll"><table class="frm-grid"><thead><tr>' +
    cols.map(function (c) { return '<th>' + frmEsc(c.t) + '</th>'; }).join('') +
    '</tr></thead><tbody>' +
    frmState.responses.map(function (r) {
      return '<tr>' + cols.map(function (c) {
        return '<td>' + frmEsc(frmCellValue(r, c.k)) + '</td>';
      }).join('') + '</tr>';
    }).join('') +
    '</tbody></table></div><p class="frm-tally">' +
    frmState.responses.length +
    (frmState.responses.length === 1 ? ' response' : ' responses') + '</p>';
}

/* Dependency-free Excel export: SpreadsheetML 2003, opens natively in Excel. */
function frmExportResponses() {
  if (!frmState.responses.length) {
    frmToast('Nothing to download yet.', 'error');
    return;
  }
  var cols = frmResponseColumns();
  var xml = '<?xml version="1.0"?>\n' +
    '<?mso-application progid="Excel.Sheet"?>\n' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n' +
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n' +
    '<Styles><Style ss:ID="hdr"><Font ss:Bold="1"/></Style></Styles>\n' +
    '<Worksheet ss:Name="Responses"><Table>\n<Row>' +
    cols.map(function (c) {
      return '<Cell ss:StyleID="hdr"><Data ss:Type="String">' +
             frmEsc(c.t) + '</Data></Cell>';
    }).join('') + '</Row>\n' +
    frmState.responses.map(function (r) {
      return '<Row>' + cols.map(function (c) {
        return '<Cell><Data ss:Type="String">' +
               frmEsc(frmCellValue(r, c.k)) + '</Data></Cell>';
      }).join('') + '</Row>\n';
    }).join('') +
    '</Table></Worksheet></Workbook>';

  var name = 'OLF-Forms-responses';
  if (frmState.responseFormId) {
    var f = frmState.forms.filter(function (x) {
      return x.formId === frmState.responseFormId;
    })[0];
    if (f) name = 'OLF-' + f.title.replace(/[^A-Za-z0-9]+/g, '-').slice(0, 40);
  }
  var blob = new Blob(['\ufeff' + xml], { type: 'application/vnd.ms-excel' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = name + '-' + frmToday() + '.xls';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

/* --------------------------------------- 14. exports for inline onclick */

window.frmInit = frmInit;
window.frmBootstrap = frmBootstrap;
window.frmSetTab = frmSetTab;
window.frmRender = frmRender;
window.frmOpenForm = frmOpenForm;
window.frmCloseForm = frmCloseForm;
window.frmSubmit = frmSubmit;
window.frmAddEntry = frmAddEntry;
window.frmCancelAdd = frmCancelAdd;
window.frmEditEntry = frmEditEntry;
window.frmCancelEdit = frmCancelEdit;
window.frmAskOverride = frmAskOverride;
window.frmKeyChanged = frmKeyChanged;
window.frmNewForm = frmNewForm;
window.frmEditForm = frmEditForm;
window.frmStatus = frmStatus;
window.frmDeleteForm = frmDeleteForm;
window.frmSetRepeat = frmSetRepeat;
window.frmSetMulti = frmSetMulti;
window.frmToggleEntryDept = frmToggleEntryDept;
window.frmSetAudience = frmSetAudience;
window.frmTogglePerson = frmTogglePerson;
window.frmToggleDept = frmToggleDept;
window.frmPickAll = frmPickAll;
window.frmFilterPicker = frmFilterPicker;
window.frmApplyPicker = frmApplyPicker;
window.frmSetPickView = frmSetPickView;
window.frmToggleQ = frmToggleQ;
window.frmGrow = frmGrow;
window.frmAddOption = frmAddOption;
window.frmRemoveOption = frmRemoveOption;
window.frmClearKey = frmClearKey;
window.frmAddQuestion = frmAddQuestion;
window.frmRemoveQuestion = frmRemoveQuestion;
window.frmMoveQuestion = frmMoveQuestion;
window.frmSyncDraft = frmSyncDraft;
window.frmSaveDraft = frmSaveDraft;
window.frmCancelBuilder = frmCancelBuilder;
window.frmOpenAdmins = frmOpenAdmins;
window.frmCloseAdmins = frmCloseAdmins;
window.frmLoadAdmins = frmLoadAdmins;
window.frmFilterAdminSearch = frmFilterAdminSearch;
window.frmAddAdmin = frmAddAdmin;
window.frmRemoveAdmin = frmRemoveAdmin;
window.frmOpenDetail = frmOpenDetail;
window.frmCloseDetail = frmCloseDetail;
window.frmToggleRespondent = frmToggleRespondent;
window.frmViewResponses = frmViewResponses;
window.frmCloseResponses = frmCloseResponses;
window.frmLoadResponses = frmLoadResponses;
window.frmPickResponseForm = frmPickResponseForm;
window.frmExportResponses = frmExportResponses;