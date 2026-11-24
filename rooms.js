/* OLF Staff Connect - Spaces: room booking (rooms.js)
 * Five rooms, 15-minute slots, instant booking by any signed-in person.
 * All data goes through window.olfRooms (defined in app.js, backed by Firestore),
 * so this file never touches Firebase itself. Everything is namespaced under #rb-app.
 */
(function () {
"use strict";

var ROOMS0 = [
  { id: 'interview', name: 'Interview Space', label: 'Interviews', icon: 'users' },
  { id: 'meeting',   name: 'Meeting Space',  label: 'Meetings',   icon: 'present' },
  { id: 'ceo',       name: 'CEO Space',      label: 'CEO',        icon: 'chair' },
  { id: 'coo',       name: 'COO Space',      label: 'COO',        icon: 'case' },
  { id: 'cos',       name: 'CoS Space',      label: 'Chief of Staff', icon: 'board' }
];
var OPEN = 9 * 60, CLOSE = 19 * 60, STEP = 15, CELLS = (CLOSE - OPEN) / STEP, HORIZON = 30;
var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var DURS = [[15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '1 hour'], [90, '1.5 hours'], [120, '2 hours']];

var IC = {
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.500 19c0-3 2.500-5 5.500-5s5.500 2 5.500 5"/><path d="M16 5.200a3 3 0 0 1 0 5.600M17.500 14.300c2 .6 3.200 2.300 3.200 4.700"/>',
  present: '<path d="M3.500 4h17M5 4v10h14V4M12 14v4M8 21l4-3 4 3"/>',
  chair: '<path d="M5 11a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6H5z"/><path d="M5 17v2M19 17v2M8 17v-3h8v3"/>',
  case: '<rect x="3.500" y="7.500" width="17" height="12" rx="2"/><path d="M9 7.500V6a1.500 1.500 0 0 1 1.500-1.500h3A1.500 1.500 0 0 1 15 6v1.500M3.500 13h17"/>',
  board: '<rect x="5" y="4.500" width="14" height="16" rx="2"/><path d="M9 4.500V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5M9 11h6M9 15h4"/>',
  left: '<path d="M15 5l-7 7 7 7"/>', right: '<path d="M9 5l7 7-7 7"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  bolt: '<path d="M13 3L5 13.500h6L10 21l8-10.500h-6z"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
  clock: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>',
  cal: '<rect x="4" y="5.500" width="16" height="14" rx="2"/><path d="M4 10h16M8.500 3.500v4M15.500 3.500v4"/>'
};
function ic(n) { return '<svg class="rb-i" viewBox="0 0 24 24" aria-hidden="true">' + (IC[n] || '') + '</svg>'; }

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function sortKey(b) { return b.date + ('0000' + b.startMin).slice(-4); }
function pad(n) { return n < 10 ? '0' + n : '' + n; }
// India time, as a calendar day and minutes since midnight
function ist() { var d = new Date(Date.now() + 5.5 * 3600000); return { date: d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()), min: d.getUTCHours() * 60 + d.getUTCMinutes() }; }
function pd(s) { var p = String(s).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
function fd(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
function addDays(s, n) { var d = pd(s); d.setUTCDate(d.getUTCDate() + n); return fd(d); }
function dow(s) { return pd(s).getUTCDay(); }
function fmin(m) { var h = Math.floor(m / 60), mm = m % 60; return (h % 12 || 12) + ':' + pad(mm) + ' ' + (h >= 12 ? 'pm' : 'am'); }
function dur(m) { return m < 60 ? m + ' min' : (m % 60 === 0 ? (m / 60) + (m === 60 ? ' hour' : ' hours') : Math.floor(m / 60) + 'h ' + (m % 60) + 'm'); }
function longDate(s) { var d = pd(s); return DAYS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()]; }
function shortDate(s) { var d = pd(s); return DAYS[d.getUTCDay()].slice(0, 3) + ' ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()].slice(0, 3); }
function initials(n) { var p = String(n || '').trim().split(/\s+/).filter(Boolean); return p.length ? ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() : '?'; }
function reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }

var root = null, api = null;
var S = null;
function fresh() {
  return { date: ist().date, view: 'day', rooms: [], cfg: {}, bookings: [], loading: true, selRoom: null, sel: null, drag: null,
           draft: { title: '', notes: '', att: [], more: false, err: '' }, freshId: null, mine: null, showPast: false, staff: null,
           unsub: null, timer: null, clockT: null, me: null, modal: null, at: null, route: '' };
}

// ── rooms (the five defaults, with any admin changes on top) ──
// names the app used before: a saved copy of one of these is just the old default, so the current default name is used instead
var OLD_NAMES = { 'Interview Room': 1, 'Meeting Room': 1, 'CEO Room': 1, 'COO Room': 1, 'CoS Room': 1, 'Interview Lounge': 1, 'Meeting Hall': 1, 'CEO Suite': 1, 'COO Suite': 1, 'CoS Suite': 1 };
function buildRooms() {
  var out = ROOMS0.map(function (r, i) {
    var c = S.cfg[r.id] || {};
    return { id: r.id, icon: r.icon, name: (c.name && !OLD_NAMES[c.name] ? c.name : r.name), label: (c.label != null && c.label !== '' ? c.label : r.label), active: c.active !== false, order: Number.isFinite(c.order) ? c.order : i };
  });
  out.sort(function (a, b) { return a.order - b.order; });
  S.rooms = out;
}
function visibleRooms() { return S.rooms.filter(function (r) { return r.active; }); }
function roomById(id) { for (var i = 0; i < S.rooms.length; i++) if (S.rooms[i].id === id) return S.rooms[i]; return { id: id, name: id, label: '', icon: 'users', active: true }; }

// ── what is allowed on the chosen day ──
function dayState(date) {
  var now = ist();
  if (dow(date) === 0) return { open: false, why: 'Spaces are closed on Sundays.' };
  if (date < now.date) return { open: false, why: 'This day has passed. You can look, but not book.', past: true };
  if (date > addDays(now.date, HORIZON)) return { open: false, why: 'You can book up to ' + HORIZON + ' days ahead.' };
  return { open: true };
}
function cellBooking(roomId, k) {
  var m = OPEN + k * STEP;
  for (var i = 0; i < S.bookings.length; i++) { var b = S.bookings[i]; if (b.roomId === roomId && b.startMin <= m && m < b.endMin) return b; }
  return null;
}
function cellFree(roomId, k) {
  if (k < 0 || k >= CELLS) return false;
  var st = dayState(S.date); if (!st.open) return false;
  if (cellBooking(roomId, k)) return false;
  var now = ist();
  if (S.date === now.date && OPEN + k * STEP < now.min) return false;   // a slot that has already started cannot be booked
  return true;
}
function roomBookings(roomId) { return S.bookings.filter(function (b) { return b.roomId === roomId; }).sort(function (a, b) { return a.startMin - b.startMin; }); }

// ── small helpers ──
function $(id) { return document.getElementById(id); }
function put(id, html) { var n = document.getElementById(id); if (n) n.innerHTML = html; return n; }
function alive() { var r = $('rb-app'); return !!r && r === root; }
function toast(msg, kind) {
  var t = $('rb-toast'); if (!t) return;
  t.textContent = msg; t.className = 'rb-toast show' + (kind ? ' ' + kind : '');
  clearTimeout(t._h); t._h = setTimeout(function () { t.className = 'rb-toast' + (kind ? ' ' + kind : ''); }, 3200);
}
function errText(e) {
  var m = e && e.message ? e.message : String(e || '');
  if (m === 'SLOT_TAKEN') return 'Someone just booked that time. Pick another slot.';
  if (/permission|insufficient/i.test(m)) return 'You do not have permission to do that.';
  return m || 'Something went wrong. Try again.';
}
function keepFocus(fn) {
  var a = document.activeElement, id = a && a.id && root && root.contains(a) ? a.id : null, s = null, e = null;
  try { if (id && a.selectionStart != null) { s = a.selectionStart; e = a.selectionEnd; } } catch (x) {}
  fn();
  if (id) { var n = $(id); if (n) { try { n.focus({ preventScroll: true }); if (s != null && n.setSelectionRange) n.setSelectionRange(s, e); } catch (x) {} } }
}

// ── page shell ──
function glide() {}
function openX(v) {
  var m = $('rb-xmodal'); if (!m) return;
  $('rb-xtitle').textContent = v === 'rooms' ? 'Manage spaces' : 'My bookings';
  $('rb-xsub').textContent = v === 'rooms' ? 'Rename, reorder or switch rooms on and off.' : 'Your upcoming and recent bookings.';
  $('rb-v-mine').hidden = v !== 'mine'; $('rb-v-rooms').hidden = v !== 'rooms';
  var cb = m.querySelector('.rb-x'); if (cb) cb.innerHTML = ic('x');
  m.classList.add('open'); m.setAttribute('aria-hidden', 'false');
}
function setView(v) {
  if (S.rmodal && v !== 'day') closeRoomModal();
  S.view = v;
  Array.prototype.forEach.call(root.querySelectorAll('.rb-tab'), function (b) { b.classList.toggle('on', b.getAttribute('data-view') === v); });
  var m = $('rb-xmodal');
  if (v === 'day') { if (m) { m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); } drawDay(); return; }
  openX(v);
  if (v === 'mine') loadMine();
  if (v === 'rooms') drawRooms();
}

// ── DAY VIEW ──
function drawBar() {
  var st = dayState(S.date), now = ist();
  put('rb-prev', ic('left')); put('rb-next', ic('right'));
  put('rb-free', ic('bolt') + ' Free now');
  var sub = S.date === now.date ? 'Today' : (S.date === addDays(now.date, 1) ? 'Tomorrow' : (st.past ? 'Earlier' : ''));
  put('rb-date', ic('cal') + '<span class="rb-dt"><b>' + esc(longDate(S.date)) + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span><svg class="rb-i rb-car" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>');
  if ($('rb-next')) $('rb-next').disabled = S.date >= addDays(now.date, HORIZON);
  if ($('rb-today')) $('rb-today').disabled = S.date === now.date;
}
function viewMin() { var now = ist(); return S.at != null ? S.at : (S.date === now.date ? now.min : null); }
function statusOf(r) {
  var st = dayState(S.date), now = ist(), bs = roomBookings(r.id);
  if (dow(S.date) === 0) return { cls: 'closed', txt: 'Closed on Sundays' };
  if (S.at != null && st.open) {
    var cur2 = null, nxt2 = null;
    bs.forEach(function (b) { if (b.startMin <= S.at && S.at < b.endMin) cur2 = b; else if (b.startMin > S.at && (!nxt2 || b.startMin < nxt2.startMin)) nxt2 = b; });
    if (cur2) return { cls: 'busy', txt: 'In use until ' + fmin(cur2.endMin) };
    return { cls: 'free', txt: nxt2 ? 'Free until ' + fmin(nxt2.startMin) : 'Free for the rest of the day' };
  }
  if (S.date === now.date && now.min >= CLOSE) return { cls: 'closed', txt: 'Closed for today' };
  if (S.date === now.date && now.min < OPEN) { var f = bs[0]; return { cls: 'free', txt: 'Opens at ' + fmin(OPEN) }; }
  if (S.date === now.date) {
    var cur = null, nxt = null;
    bs.forEach(function (b) { if (b.startMin <= now.min && now.min < b.endMin) cur = b; else if (b.startMin > now.min && (!nxt || b.startMin < nxt.startMin)) nxt = b; });
    if (cur) return { cls: 'busy', txt: 'In use until ' + fmin(cur.endMin) };
    return { cls: 'free', txt: nxt ? 'Free until ' + fmin(nxt.startMin) : 'Free for the rest of the day' };
  }
  if (!st.open) return { cls: 'closed', txt: st.past ? (bs.length ? bs.length + (bs.length === 1 ? ' booking' : ' bookings') : 'No bookings') : '' };
  return { cls: bs.length ? 'free' : 'free', txt: bs.length ? bs.length + (bs.length === 1 ? ' booking' : ' bookings') : 'Free all day' };
}
function drawTiles() {
  var host = $('rb-tiles'); if (!host) return;
  var now = ist(), me = S.me.email;
  host.innerHTML = visibleRooms().map(function (r) {
    var s = statusOf(r), bs = roomBookings(r.id);
    var mini = bs.map(function (b) { return '<i class="' + (b.bookedBy === me ? 'me' : '') + '" style="left:' + ((b.startMin - OPEN) / (CLOSE - OPEN) * 100) + '%;width:' + ((b.endMin - b.startMin) / (CLOSE - OPEN) * 100) + '%"></i>'; }).join('');
    if (S.date === now.date && now.min >= OPEN && now.min <= CLOSE) mini += '<i class="now" style="left:' + ((now.min - OPEN) / (CLOSE - OPEN) * 100) + '%"></i>';
    var today = S.date === now.date, cur = null, nxt = null;
    bs.forEach(function (b) { if (today && b.startMin <= now.min && now.min < b.endMin) cur = b; else if (today && b.startMin > now.min && (!nxt || b.startMin < nxt.startMin)) nxt = b; });
    var line;
    if (cur) line = '<span class="big">' + esc(cur.title) + '</span><span class="by"><i>' + esc(initials(cur.bookedByName || cur.bookedBy)) + '</i>' + esc(cur.bookedByName || cur.bookedBy) + '</span><span class="cd">Ends in ' + dur(Math.max(1, cur.endMin - now.min)) + '</span>';
    else if (nxt) line = '<span class="big">Next: ' + esc(nxt.title) + '</span><span class="cd">At ' + fmin(nxt.startMin) + ', in ' + dur(nxt.startMin - now.min) + '</span>';
    else if (bs.length) line = '<span class="big">' + bs.length + (bs.length === 1 ? ' booking' : ' bookings') + '</span><span class="cd">' + esc(s.txt) + '</span>';
    else line = '<span class="big">' + (s.cls === 'closed' ? esc(s.txt || 'Closed') : 'Nothing booked') + '</span>' + (s.cls === 'closed' ? '' : '<span class="cd">Free all day</span>');
    var canNow = today && !cur && s.cls === 'free' && cellFree(r.id, Math.max(0, Math.ceil((Math.max(OPEN, now.min) - OPEN) / STEP)));
    var quick = canNow ? '<button type="button" class="rb-quick" data-quick="' + r.id + '">' + ic('bolt') + ' Book now</button>'
      : '<button type="button" class="rb-quick" data-pick="' + r.id + '"' + (dayState(S.date).open ? '' : ' disabled') + '>' + ic('clock') + ' Choose a time</button>';
    var band = s.cls === 'busy' ? 'In use' : (s.cls === 'closed' ? 'Closed' : 'Available');
    return '<div class="rb-tile ' + s.cls + (S.selRoom === r.id ? ' on' : '') + '" data-room="' + r.id + '">'
      + '<button type="button" class="rb-tmain" data-room="' + r.id + '" aria-pressed="' + (S.selRoom === r.id) + '" aria-label="' + esc(r.name + ', ' + s.txt) + '">'
      + '<span class="rb-tband"><span>' + band + '</span><span class="rb-lt"></span></span>'
      + '<span class="rb-tbody"><span class="rb-thead"><span class="rb-ri">' + ic(r.icon) + '</span><span><span class="rb-rn" style="display:block">' + esc(r.name) + '</span><span class="rb-rl" style="display:block">' + esc(r.label) + '</span></span></span>'
      + '<span class="rb-tnow" style="display:block">' + line + '</span></span>'
      + '<span class="rb-mini" style="display:block">' + mini + '</span></button>' + quick + '</div>';
  }).join('') || '<div class="rb-empty" style="grid-column:1/-1"><b>No spaces are open for booking</b>An admin can switch spaces on under Manage.</div>';
}

// ── hero: live clock and quick numbers ──
function tickClock() {
  var el = $('rb-clock'); if (!el) return;
  var n = ist(), h = Math.floor(n.min / 60), m = n.min % 60;
  el.textContent = longDate(n.date) + '  \u00B7  ' + (h % 12 || 12) + ':' + pad(m) + ' ' + (h >= 12 ? 'PM' : 'AM') + '  \u00B7  India time';
}
var STATIC = {
  door: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M22 8l5 2v16l-5 3z" fill="#A7F3D0"/><rect x="6" y="3" width="17" height="26" rx="2.500" fill="#10B981"/><rect x="9" y="6" width="11" height="20" rx="1.500" fill="#ECFDF5"/><circle cx="17.500" cy="16" r="1.500" fill="#059669"/></svg>',
  clock: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="#3B82F6"/><circle cx="16" cy="16" r="10" fill="#fff"/><path d="M16 9.500V16l4.500 2.800" stroke="#2563EB" stroke-width="2.300" fill="none" stroke-linecap="round"/></svg>',
  cal: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="6" width="24" height="22" rx="4" fill="#fff"/><path d="M4 10a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v4H4z" fill="#8B5CF6"/><rect x="9" y="3" width="3" height="6" rx="1.500" fill="#CBD5E1"/><rect x="20" y="3" width="3" height="6" rx="1.500" fill="#CBD5E1"/><g fill="#8B5CF6"><circle cx="10.500" cy="19" r="1.800"/><circle cx="16" cy="19" r="1.800"/><circle cx="10.500" cy="24" r="1.800"/></g><circle cx="21.500" cy="19" r="1.800" fill="#F59E0B"/></svg>'
};
function statCard(icon, tint, value, label) {
  return '<div class="pg-stat" style="--tint:' + tint + '"><span class="pg-stat-icon">' + STATIC[icon] + '</span><div><div class="pg-stat-value">' + value + '</div><div class="pg-stat-label">' + label + '</div></div></div>';
}
function chip(inner) { return '<span class="pg-glass rb-chip2">' + inner + '</span>'; }
function drawStats() {
  var host = $('rb-stats'); if (!host) return;
  var now = ist(), vis = visibleRooms(), me = S.me.email, today = S.date === now.date;
  var mine = S.bookings.filter(function (b) { return b.bookedBy === me; }).length;
  var out = '';
  if (today) {
    var free = vis.filter(function (r) { return statusOf(r).cls === 'free'; }).length;
    var nxt = null; S.bookings.forEach(function (b) { if (b.startMin > now.min && (!nxt || b.startMin < nxt.startMin)) nxt = b; });
    out += chip('<i class="dot' + (free ? '' : ' r') + '"></i><b>' + free + ' of ' + vis.length + '</b> spaces free now');
    out += chip(ic('clock') + (nxt ? 'Next booking in <b>' + dur(nxt.startMin - now.min) + '</b>' : 'No more bookings today'));
    out += chip(ic('cal') + '<b>' + mine + '</b> of yours today');
  } else {
    out += chip(ic('cal') + '<b>' + S.bookings.length + '</b> ' + (S.bookings.length === 1 ? 'booking' : 'bookings') + ' on ' + esc(shortDate(S.date)));
    out += chip('<i class="dot"></i><b>' + vis.length + '</b> spaces you can book');
    out += chip(ic('cal') + '<b>' + mine + '</b> of yours');
  }
  host.innerHTML = out;
  if (!S.statsDone && host.children.length) { S.statsDone = true; Array.prototype.forEach.call(host.querySelectorAll('.rb-chip2 b'), countUp); }
}
// numbers climb up from zero the first time the page opens, like the other tabs
function countUp(el) {
  var m = /^(\d+)( of \d+)?$/.exec(el.textContent); if (!m || reduced()) return;
  var to = +m[1], rest = m[2] || ''; if (!to) return;
  var t0 = null;
  function step(t) { if (t0 === null) t0 = t; var p = Math.min(1, (t - t0) / 800), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(to * e) + rest; if (p < 1 && el.isConnected) requestAnimationFrame(step); }
  el.textContent = '0' + rest; requestAnimationFrame(step);
}

// ── 3D office floor (wide screens only) ──
// The office plan, in pixels on a 760 x 480 floor: a column down the left wall (interview, meeting, CEO, COO) behind glass, open floor with the entrance at the top, a long wall down the middle, and CoS in the bottom-right corner.
var MW = 660, MH = 520, WT = 9, MLEFT = 230, MW0 = 660, COSW = 170;
var MAPPOS = { interview: [0, 0, 16.6], meeting: [0, 16.6, 37.5], ceo: [0, 54.1, 29.2], coo: [0, 83.3, 16.7] };
var PAL = { wood: '#A8774D', walnut: '#7A5233', shelf: '#A9794A', chair: '#394458', sofa: '#3E8E8B', screen: '#1F2937', pot: '#C9714A', wall: '#F7F9FC', table: '#B9824F' };
var WHF = 1;
function bx(x, y, w, h, z, c, cls) { return '<div class="rb-bx' + (cls ? ' ' + cls : '') + '" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;--h:' + Math.max(3, Math.round(z * WHF)) + 'px;--c:' + c + '"><i class="bt"></i><i class="bs"></i><i class="bw"></i></div>'; }
function wallBox(x, y, w, h, z, cls) { return bx(x, y, w, h, z == null ? 46 : z, PAL.wall, cls); }
function flat(x, y, w, h, bg, r) { return '<div class="rb-flat" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;background:' + bg + ';border-radius:' + (r || 8) + 'px"></div>'; }
function chair(x, y) { return bx(x, y, 14, 14, 9, PAL.chair, 'round'); }
function plant(x, y) { return bx(x, y, 11, 11, 7, PAL.pot, 'round') + '<div class="rb-bb rb-crown" style="left:' + (x + 5) + 'px;top:' + (y + 5 - 24) + 'px;--z:7px"></div>'; }
function person(x, y, who) { return '<div class="rb-bb rb-ps" style="left:' + x + 'px;top:' + (y - 46) + 'px;--z:2px"><i class="ph"></i><i class="pb">' + esc(initials(who)) + '</i></div>'; }
function shortWho(n) { var p = String(n || '').trim().split(/\s+/).filter(Boolean); if (p.length < 2) return p[0] || ''; return p[0] + ' ' + p[p.length - 1].charAt(0) + '.'; }
function curBooking(r) { var t = viewMin(), c = null; if (t === null) return null; roomBookings(r.id).forEach(function (b) { if (b.startMin <= t && t < b.endMin) c = b; }); return c; }
function scrollerOf(el) { for (var p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) { var o = getComputedStyle(p).overflowY; if (o === 'auto' || o === 'scroll') return p; } return null; }
// the space from the top of the map card down to the bottom of the page, in CSS pixels
function mapAvail(map) {
  var r1 = map.getBoundingClientRect(), ratio = map.offsetHeight ? r1.height / map.offsetHeight : 1; if (!ratio || ratio > 1.5 || ratio < .5) ratio = 1;
  var sc = scrollerOf(map);
  if (sc) { var cs = getComputedStyle(sc), r2 = sc.getBoundingClientRect(); var topIn = (r1.top - r2.top) / ratio - (parseFloat(cs.borderTopWidth) || 0) + sc.scrollTop; return Math.round(sc.clientHeight - topIn - (parseFloat(cs.paddingBottom) || 0) - 6); }
  var bp = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
  return Math.round(window.innerHeight - (r1.top / ratio + (window.scrollY || 0)) - bp - 12);
}
function drawMap() {
  var map = $('rb-map'), sc = $('rb-scene'); if (!map || !sc) return;
  var vis = visibleRooms(), stage = $('rb-stage'), none = $('rb-none');
  if (none) none.hidden = vis.length > 0;
  sc.hidden = vis.length === 0;
  var mobile = (map.clientWidth || 900) < 700, k = 1, rxd, MIDX, camZ = 0;
  if (mobile) {
    // phones: a fixed plan scaled down to the screen width
    MW = MW0; MH = 520; MLEFT = 230; COSW = 170; WHF = .62; rxd = 32;
    var w = stage.clientWidth || 340;
    k = Math.max(.3, Math.min(1.2, (w - 16) / (MW + 30)));
    // use the rest of the screen height: the plan grows taller, not wider
    if (!S.mapAvail) { var av0 = mapAvail(map); if (av0 > 300) S.mapAvail = av0; }
    if (S.mapAvail) MH = Math.max(520, Math.min(1100, Math.round((S.mapAvail - 70) / (Math.cos(rxd * Math.PI / 180) * k))));
    stage.style.height = Math.round(MH * Math.cos(rxd * Math.PI / 180) * k + 56 * k + 40) + 'px'; stage.style.paddingTop = ''; map.style.height = '';
    MIDX = Math.round(MW / 2) + 50;
  } else {
    // desktop: the plan is drawn to the size of the card, so it fills it edge to edge, down to the bottom of the page
    WHF = 1; rxd = 52; camZ = -4;
    stage.style.height = ''; stage.style.paddingTop = '56px';
    if (!S.mapAvail) { var av = mapAvail(map); if (av > 300) S.mapAvail = av; }
    map.style.height = Math.max(S.mapAvail || 600, 420) + 'px';
    var sw = stage.clientWidth || 1000, sh = stage.clientHeight || 500;
    MW = Math.max(720, Math.round((sw - 90) / 1.12)); MH = Math.max(380, Math.round((sh - 56 - 76 - MW * 0.075 * Math.cos(rxd * Math.PI / 180)) / Math.cos(rxd * Math.PI / 180)));
    MLEFT = Math.round(MW * .19); COSW = Math.round(MW * .195);
    MIDX = Math.round(MW * .52);
  }
  var small = k < .8;
  var dst = dayState(S.date), note = $('rb-note2');
  if (!note) { note = document.createElement('div'); note.id = 'rb-note2'; note.className = 'rb-note2'; note.setAttribute('role', 'status'); stage.appendChild(note); }
  note.hidden = dst.open; note.textContent = dst.open ? '' : dst.why;
  sc.classList.toggle('sm-scale', small);
  S.cam = { rx: rxd, rz: camZ, live: !mobile };
  sc.style.setProperty('--rx', rxd + 'deg'); sc.style.setProperty('--rz', camZ + 'deg');
  sc.style.setProperty('--k', k.toFixed(3)); sc.style.width = MW + 'px'; sc.style.height = MH + 'px';
  var rects = {}, walls = '', doors = '';
  Object.keys(MAPPOS).forEach(function (id) { var p = MAPPOS[id]; rects[id] = [0, Math.round(p[1] / 100 * MH), MLEFT, Math.round(p[2] / 100 * MH)]; });
  rects.cos = [MW - COSW, Math.round(.708 * MH), COSW, MH - Math.round(.708 * MH)];
  var mid = MIDX, el = mid - 20, er = mid + 20;
  // outer walls, with a gap in the top wall for the entrance
  walls += wallBox(-WT, -WT, el + WT, WT) + wallBox(er, -WT, MW - er + WT, WT) + wallBox(-WT, -WT, WT, MH + 2 * WT) + wallBox(MW, -WT, WT, MH + 2 * WT) + wallBox(-WT, MH, MW + 2 * WT, WT, 14);
  // the long wall down the middle that splits the office into its two sections
  walls += wallBox(mid - Math.round(WT / 2), Math.round(.29 * MH), WT, MH - Math.round(.29 * MH));
  // glass fronts to the four rooms, with a door gap for each, and glass between them
  ['interview', 'meeting', 'ceo', 'coo'].forEach(function (id) {
    var r = rects[id], m = r[1] + Math.round(r[3] / 2), g = 20;
    walls += wallBox(MLEFT, r[1], WT, m - g - r[1], 42, 'glass') + wallBox(MLEFT, m + g, WT, r[1] + r[3] - m - g, 42, 'glass');
    doors += '<div class="rb-door" style="left:' + (MLEFT - 2) + 'px;top:' + (m - g) + 'px;width:' + (WT + 4) + 'px;height:' + (2 * g) + 'px"></div>';
    if (r[1] > 0) walls += wallBox(0, r[1] - Math.round(WT / 2), MLEFT, WT, 38, 'glass');
  });
  var c = rects.cos, cm = c[1] + Math.round(c[3] / 2);
  walls += wallBox(c[0] - WT, c[1] - WT, c[2] + WT, WT, 38, 'glass') + wallBox(c[0] - WT, c[1] - WT, WT, cm - 20 - c[1] + WT, 42, 'glass') + wallBox(c[0] - WT, cm + 20, WT, c[1] + c[3] - cm - 20, 42, 'glass');
  doors += '<div class="rb-door" style="left:' + (c[0] - WT - 2) + 'px;top:' + (cm - 20) + 'px;width:' + (WT + 4) + 'px;height:40px"></div>';
  var lamps = vis.map(function (r) {
    var q = rects[r.id]; if (!q) return '';
    var st = statusOf(r), cur = curBooking(r), mine = !!(cur && S.me && cur.bookedBy === S.me.email), cls = st.cls === 'busy' ? (mine ? 'mine' : 'busy') : st.cls;
    var lx = r.id === 'cos' ? q[0] - WT / 2 : MLEFT + WT / 2, ly = q[1] + Math.round(q[3] / 2) - 34;
    return '<div class="rb-bb rb-lampw" style="left:' + Math.round(lx) + 'px;top:' + ly + 'px;--z:' + Math.round(34 * WHF) + 'px"><i class="rb-lamp ' + cls + '"></i></div>';
  }).join('');
  var floors = vis.map(function (r) {
    var q = rects[r.id] || [260, 150, 150, 100], s = statusOf(r), cur = curBooking(r), mine = !!(cur && S.me && cur.bookedBy === S.me.email);
    var pill = small ? (s.cls === 'busy' ? (mine ? 'Yours' : 'In use') : (s.cls === 'closed' ? 'Closed' : 'Free')) : (q[3] < 100 ? (s.cls === 'busy' ? (mine ? 'Yours' : 'In use') : (s.cls === 'closed' ? 'Closed' : 'Available')) : (s.cls === 'free' ? s.txt.replace('Free for the rest of the day', 'Free all day') : (mine ? s.txt.replace('In use', 'Yours') : s.txt)));
    var tv = viewMin(), prog = (cur && tv !== null && !small && q[3] >= 100) ? '<span class="rb-prog' + (mine ? ' mine' : '') + '"><i style="width:' + Math.max(4, Math.min(100, Math.round((tv - cur.startMin) / (cur.endMin - cur.startMin) * 100))) + '%"></i></span>' : '';
    var who = (cur && !small && q[3] >= 100) ? '<span class="rb-fw">' + esc(cur.title) + ' \u00B7 ' + esc(shortWho(cur.bookedByName || cur.bookedBy)) + '</span>' : '';
    return '<div class="rb-rm ' + s.cls + (mine ? ' mine' : '') + (q[3] < 100 ? ' sm' : '') + (S.selRoom === r.id ? ' on' : '') + '" data-room="' + r.id + '" tabindex="0" role="button" aria-label="' + esc(r.name + ', ' + s.txt) + '" style="left:' + q[0] + 'px;top:' + q[1] + 'px;width:' + q[2] + 'px;height:' + q[3] + 'px">'
      + '<i class="rb-md"></i><div class="rb-fl"><b>' + esc(small ? r.name.replace(/\s+(Space|Lounge|Hall|Suite)$/, '') : r.name) + '</b><small>' + esc(pill) + '</small>' + who + prog + '</div></div>';
  }).join('');
  // warm light in the morning and late afternoon, cool at dusk and after hours (today only)
  var nowT = ist(), tint = 'transparent', tmv = viewMin();
  if (tmv !== null) { var hr = tmv / 60; tint = hr < 9 || hr >= 19 ? 'rgba(70,90,160,.16)' : (hr < 11 ? 'rgba(255,214,150,.07)' : (hr < 15 ? 'transparent' : (hr < 17.5 ? 'rgba(255,190,110,.08)' : 'rgba(150,110,200,.09)'))); }
  sc.style.setProperty('--tint', tint);
  // the first time the day has loaded, the walls rise out of the floor
  if (S.loading && !S.introDone) sc.style.visibility = 'hidden';
  else { sc.style.visibility = ''; if (!S.introDone && !reduced()) { S.introDone = true; sc.classList.add('rb-intro'); setTimeout(function () { var n = $('rb-scene'); if (n) n.classList.remove('rb-intro'); }, 1500); } else S.introDone = true; }
  // glowing route lines from the entrance to a room's door (shown while a room is hovered)
  var xc = Math.round(MLEFT + (MIDX - MLEFT) * .5), routes = '';
  ['interview', 'meeting', 'ceo', 'coo'].forEach(function (id) { var rr = rects[id]; if (rr) routes += '<path class="rb-route" data-r="' + id + '" d="M' + MIDX + ' 12V44H' + xc + 'V' + (rr[1] + Math.round(rr[3] / 2)) + 'H' + (MLEFT + 12) + '"/>'; });
  var cc = rects.cos, cx0 = MIDX + Math.round((cc[0] - MIDX) * .5);
  routes += '<path class="rb-route" data-r="cos" d="M' + MIDX + ' 12V44H' + cx0 + 'V' + (cc[1] + Math.round(cc[3] / 2)) + 'H' + (cc[0] - WT - 8) + '"/>';
  var routeSvg = '<svg class="rb-routes" width="' + MW + '" height="' + MH + '" viewBox="0 0 ' + MW + ' ' + MH + '">' + routes + '</svg>';
  sc.innerHTML = routeSvg + floors + doors + walls + lamps + '<div class="rb-gate" style="left:' + Math.round((el + er) / 2) + 'px;top:-' + Math.round(WT / 2) + 'px"><div class="rb-leaf"><i></i></div></div>';
  setRoute(S.route);
}
function openRoomModal() { var m = $('rb-rmodal'); if (!m) return; m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); S.rmodal = true; var d = $('rb-rdlg'); if (d) { d.scrollTop = 0; setTimeout(function () { var f = $('rb-title') || d.querySelector('.rb-x'); if (f) { try { f.focus({ preventScroll: true }); } catch (e) {} } }, 60); } }
function closeRoomModal() {
  var m = $('rb-rmodal'); if (!m) return;
  m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); S.rmodal = false;
  S.selRoom = null; S.sel = null; S.draft = { title: '', notes: '', att: [], more: false, err: '' };
  drawTiles(); drawMap();
}
function selectRoom(id) { S.selRoom = id; S.sel = null; S.draft.err = ''; drawTiles(); drawMap(); drawPanel(); openRoomModal(); }
function quickBook(id) {
  var now = ist(), k = Math.max(0, Math.ceil((Math.max(OPEN, now.min) - OPEN) / STEP));
  if (S.date !== now.date || !cellFree(id, k)) { selectRoom(id); return; }
  S.selRoom = id; S.sel = { room: id, a: k, z: cellFree(id, k + 1) ? k + 1 : k }; S.draft.err = '';
  drawTiles(); drawMap(); keepFocus(drawPanel);
  openRoomModal();
}
function confetti(x, y) {
  var host = $('rb-conf'); if (!host || reduced()) return;
  var cols = ['#2F6FE4', '#1FA39A', '#FBBF24', '#F0605A', '#8B5CF6', '#4ADE80'], h = '';
  host.style.left = x + 'px'; host.style.top = y + 'px';
  for (var i = 0; i < 22; i++) { var a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 90; h += '<i style="background:' + cols[i % cols.length] + ';--dx:' + Math.round(Math.cos(a) * d) + 'px;--dy:' + Math.round(Math.sin(a) * d - 30) + 'px;--rt:' + Math.round(Math.random() * 540 - 270) + 'deg"></i>'; }
  host.innerHTML = h; setTimeout(function () { if (host) host.innerHTML = ''; }, 1200);
}
function drawPanel() {
  var host = $('rb-panel'); if (!host) return;
  var st = dayState(S.date), now = ist();
  var room = S.selRoom ? roomById(S.selRoom) : null;
  if (!room || !room.active) {
    S.selRoom = null;
    host.innerHTML = '<p class="rb-note">' + (st.open ? 'Pick a space to see its day, then drag across free time to book it.' : esc(st.why)) + '</p>';
    return;
  }
  var cells = '', i;
  for (i = 0; i < CELLS; i++) {
    var free = cellFree(room.id, i), booked = !!cellBooking(room.id, i);
    cells += '<div class="rb-c ' + (booked ? 'bk' : (free ? 'free' : 'off')) + (S.sel && S.sel.room === room.id && i >= S.sel.a && i <= S.sel.z ? ' sel' : '') + '" data-k="' + i + '"></div>';
  }
  var bs = roomBookings(room.id), me = S.me.email;
  var blocks = bs.map(function (b) {
    var mine = b.bookedBy === me;
    return '<button type="button" class="rb-blk' + (mine ? ' me' : '') + (S.freshId === b.id ? ' fresh' : '') + '" data-bk="' + esc(b.id) + '" style="left:' + ((b.startMin - OPEN) / (CLOSE - OPEN) * 100) + '%;width:' + ((b.endMin - b.startMin) / (CLOSE - OPEN) * 100) + '%" title="' + esc(b.title + ' - ' + fmin(b.startMin) + ' to ' + fmin(b.endMin)) + '"><span class="rb-in">' + esc(initials(b.bookedByName || b.bookedBy)) + '</span>' + esc(b.title) + '</button>';
  }).join('');
  var nowMark = (S.date === now.date && now.min >= OPEN && now.min <= CLOSE) ? '<div class="rb-now" style="left:' + ((now.min - OPEN) / (CLOSE - OPEN) * 100) + '%"></div>' : '';
  var hours = ''; for (i = 0; i < 10; i++) hours += '<span>' + ((9 + i) % 12 || 12) + '</span>';
  var list = bs.length ? '<div class="rb-list">' + bs.map(function (b) {
    return '<button type="button" class="rb-li" data-bk="' + esc(b.id) + '"><span class="t">' + fmin(b.startMin) + ' - ' + fmin(b.endMin) + '</span><span class="m"><b>' + esc(b.title) + '</b><small>' + esc(b.bookedByName || b.bookedBy) + (b.attendees && b.attendees.length ? ' with ' + b.attendees.length + ' other' + (b.attendees.length > 1 ? 's' : '') : '') + '</small></span>' + (b.bookedBy === me ? '<span class="rb-tag me">Yours</span>' : '') + '</button>';
  }).join('') + '</div>' : '';
  var rs = statusOf(room);
  host.innerHTML = '<div class="rb-panel"><div class="rb-ph"><div class="rb-phl"><span class="rb-mi2 ' + rs.cls + '">' + ic(room.icon) + '</span><div><h3>' + esc(room.name) + '</h3><span class="rb-phs ' + rs.cls + '">' + esc(rs.cls === 'free' && S.date === ist().date ? 'Available now' : (rs.txt || ' ')) + '</span></div></div><button type="button" class="rb-x" data-rclose aria-label="Close">' + ic('x') + '</button></div>'
    + '<p class="rb-rhint">' + (st.open ? 'Drag across free time to book. Times move in 15-minute steps.' : esc(st.why)) + '</p>'
    + '<div class="rb-stripw"><div class="rb-hrs">' + hours + '</div><div class="rb-strip' + (st.open ? '' : ' dis') + '" id="rb-strip">' + cells + blocks + nowMark + '</div></div>'
    + '<div id="rb-form"></div>' + (S.loading ? '<p class="rb-note">Loading the day...</p>' : (bs.length || !st.open ? '' : '<p class="rb-note">Nothing booked yet. The whole day is free.</p>')) + list + '</div>';
  drawForm(); paintSel();
}
function selTimes() { return S.sel ? { s: OPEN + S.sel.a * STEP, e: OPEN + (S.sel.z + 1) * STEP } : null; }
function drawForm() {
  var host = $('rb-form'); if (!host) return;
  if (!S.sel) { host.innerHTML = ''; return; }
  var t = selTimes(), room = roomById(S.sel.room), d = S.draft;
  // how long this room stays free from the chosen start; longer presets that would clash are greyed out
  var run = 0; for (var fk = S.sel.a; fk < CELLS && cellFree(S.sel.room, fk); fk++) run += STEP;
  var len = t.e - t.s, preset = false;
  var chips = DURS.map(function (x) { var on = x[0] === len && !d.custom; preset = preset || x[0] === len; return '<button type="button" class="rb-chip' + (on ? ' on' : '') + '" data-dur="' + x[0] + '"' + (x[0] > run ? ' disabled' : '') + '>' + x[1] + '</button>'; }).join('')
    + '<button type="button" class="rb-chip' + (d.custom || !preset ? ' on' : '') + '" data-custom="1">Custom</button>';
  var custom = (d.custom || !preset) ? '<div class="rb-custom"><label>Hours<input type="number" id="rb-ch" min="0" max="10" step="1" inputmode="numeric" value="' + Math.floor(len / 60) + '"></label><label>Minutes<select id="rb-cm">' + [0, 15, 30, 45].map(function (m) { return '<option value="' + m + '"' + (m === len % 60 ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select></label><button type="button" class="rb-btn pri" id="rb-cset">Set time</button><span class="rb-chint">Free for up to ' + dur(Math.min(run, CLOSE - t.s)) + ' from ' + fmin(t.s) + '</span></div>' : '';
  var att = d.att.map(function (a, i) { return '<span class="rb-pill">' + esc(a.name || a.email) + '<button type="button" data-rm="' + i + '" aria-label="Remove ' + esc(a.name || a.email) + '">' + ic('x') + '</button></span>'; }).join('');
  host.innerHTML = '<div class="rb-form">'
    + '<div class="rb-sum">' + ic('clock') + '<b id="rb-sum">' + esc(fmin(t.s) + ' to ' + fmin(t.e)) + '</b><span>' + dur(t.e - t.s) + ' in ' + esc(room.name) + ', ' + esc(shortDate(S.date)) + '</span></div>'
    + '<div class="rb-chips" role="group" aria-label="Length of the booking">' + chips + '</div>' + custom
    + '<label class="rb-field' + (d.err ? ' bad' : '') + '"><span>Title</span><input type="text" id="rb-title" maxlength="120" placeholder="What is the booking for?" autocomplete="off" value="' + esc(d.title) + '">' + (d.err ? '<p class="rb-err">' + esc(d.err) + '</p>' : '') + '</label>'
    + (d.more ? '<div class="rb-field"><span>People coming (optional)</span><div class="rb-sug"><input type="text" id="rb-attq" placeholder="Search by name" autocomplete="off"><ul id="rb-sugl" hidden></ul></div><div class="rb-att">' + att + '</div></div>'
        + '<label class="rb-field"><span>Notes (optional)</span><textarea id="rb-notes" maxlength="500" placeholder="Anything people should know">' + esc(d.notes) + '</textarea></label>'
      : '<p style="margin:10px 0 0"><button type="button" class="rb-link" id="rb-more">Add people and notes</button></p>')
    + '<div class="rb-act"><button type="button" class="rb-btn pri" id="rb-book">Book ' + esc(room.name) + '</button><button type="button" class="rb-btn" id="rb-clear">Clear</button></div></div>';
}
function drawDay() { drawBar(); drawStats(); drawTiles(); drawMap(); keepFocus(drawPanel); }
function paintSel() {
  var strip = $('rb-strip'); if (!strip) return;
  Array.prototype.forEach.call(strip.querySelectorAll('.rb-c'), function (c) { var k = +c.getAttribute('data-k'); c.classList.toggle('sel', !!S.sel && S.sel.room === S.selRoom && k >= S.sel.a && k <= S.sel.z); });
  var t = selTimes(), b = $('rb-sum');
  if (t && b) { b.textContent = fmin(t.s) + ' to ' + fmin(t.e); }
  var wrap = strip.parentNode, tip = wrap.querySelector('.rb-tip');
  if (!t || !S.sel || S.sel.room !== S.selRoom) { if (tip) tip.remove(); return; }
  if (!tip) { tip = document.createElement('div'); tip.className = 'rb-tip'; wrap.appendChild(tip); }
  tip.textContent = fmin(t.s) + ' - ' + fmin(t.e) + ' (' + dur(t.e - t.s) + ')';
  tip.style.left = Math.min(88, Math.max(12, ((S.sel.a + S.sel.z + 1) / 2) / CELLS * 100)) + '%';
}

// ── data ──
function watch() {
  if (S.unsub) { try { S.unsub(); } catch (e) {} S.unsub = null; }
  S.loading = true; S.bookings = [];
  if (S.view === 'day') drawDay();
  var d = S.date;
  S.unsub = api.watchDay(d, function (list) {
    if (!alive()) { cleanup(); return; }
    if (d !== S.date) return;
    S.bookings = list || []; S.loading = false;
    if (S.sel && !S.pending && !selStillFree()) { S.sel = null; toast('That time was just taken. Pick another slot.', 'err'); }
    if (S.view === 'day') drawDay();
  }, function (err) { if (!alive()) return; S.loading = false; toast('Could not load the bookings. ' + errText(err), 'err'); if (S.view === 'day') drawDay(); });
}
function selStillFree() { if (!S.sel) return true; for (var k = S.sel.a; k <= S.sel.z; k++) if (cellBooking(S.sel.room, k)) return false; return true; }
function cleanup() { if (S) { if (S.unsub) { try { S.unsub(); } catch (e) {} S.unsub = null; } if (S.timer) { clearInterval(S.timer); S.timer = null; } if (S.clockT) { clearInterval(S.clockT); S.clockT = null; } } }
function goDate(d) {
  S.at = null;
  closeCal(); if (d === S.date) return; S.date = d; S.sel = null; S.draft.err = ''; watch(); drawBar(); }

function freeNow() {
  var now = ist();
  if (dow(now.date) === 0) { toast('Spaces are closed on Sundays. They open again on Monday at 9:00 am.'); return; }
  if (now.min >= CLOSE) { toast('Spaces are closed for today. They open at ' + fmin(OPEN) + '.'); return; }
  var go = function () {
    var start = Math.max(OPEN, Math.ceil(now.min / STEP) * STEP), k = (start - OPEN) / STEP, found = null;
    visibleRooms().forEach(function (r) { if (!found && cellFree(r.id, k)) found = r; });
    if (!found) { toast('Every space is busy right now. Try a later slot.'); return; }
    var z = cellFree(found.id, k + 1) ? k + 1 : k;
    S.selRoom = found.id; S.sel = { room: found.id, a: k, z: z }; S.draft.err = '';
    drawTiles(); keepFocus(drawPanel);
    var tile = root.querySelector('.rb-tile[data-room="' + found.id + '"]');
    if (tile && !reduced()) { tile.classList.add('rb-pop'); setTimeout(function () { tile.classList.remove('rb-pop'); }, 1900); }
    openRoomModal();
    var t = $('rb-title'); if (t) { try { t.focus({ preventScroll: true }); } catch (e) {} }
  };
  if (S.date !== now.date) { S.date = now.date; watch(); drawBar(); var wait = setInterval(function () { if (!S.loading) { clearInterval(wait); go(); } }, 60); setTimeout(function () { clearInterval(wait); }, 3000); }
  else go();
}

function setSel(room, a, z) { S.sel = { room: room, a: a, z: z }; }
function extendBy(minutes) {
  if (!S.sel) return;
  var cells = minutes / STEP, z = S.sel.a + cells - 1;
  if (z >= CELLS) { toast('That runs past 7:00 pm.'); return; }
  for (var k = S.sel.a; k <= z; k++) if (!cellFree(S.sel.room, k)) { toast('Another booking is in the way.'); return; }
  S.sel.z = z; drawForm(); paintSel();
}
function setCustom() {
  readDraft();
  var hh = Math.floor(+($('rb-ch') || {}).value || 0), mm = +($('rb-cm') || {}).value || 0, total = hh * 60 + mm;
  if (hh < 0 || total < STEP) { toast('Enter at least 15 minutes.'); return; }
  S.draft.custom = true; extendBy(total);
}
function readDraft() { var t = $('rb-title'), n = $('rb-notes'); if (t) S.draft.title = t.value; if (n) S.draft.notes = n.value; }

function book() {
  readDraft();
  var t = selTimes(); if (!t) return;
  var title = S.draft.title.trim();
  if (!title) { S.draft.err = 'Enter a title for the booking.'; keepFocus(drawForm); var i = $('rb-title'); if (i) i.focus(); return; }
  S.draft.err = '';
  var btn = $('rb-book'), burstAt = null;
  if (btn) { var br = btn.getBoundingClientRect(); burstAt = { x: br.left + br.width / 2, y: br.top + br.height / 2 }; btn.disabled = true; btn.textContent = 'Booking...'; }
  var room = roomById(S.sel.room), payload = { roomId: S.sel.room, date: S.date, startMin: t.s, endMin: t.e, title: title, notes: S.draft.notes.trim(), attendees: S.draft.att };
  S.pending = true;
  api.createBooking(payload).then(function (id) {
    S.pending = false;
    if (!alive()) return;
    S.freshId = id; S.sel = null; S.draft = { title: '', notes: '', att: [], more: false, err: '' };
    var rm = $('rb-rmodal'); if (rm) { rm.classList.remove('open'); rm.setAttribute('aria-hidden', 'true'); } S.rmodal = false; S.selRoom = null;
    if (burstAt) confetti(burstAt.x, burstAt.y);
    toast('Booked ' + room.name + ', ' + fmin(t.s) + ' to ' + fmin(t.e), 'ok');
    drawDay(); setTimeout(function () { S.freshId = null; }, 1500);
  }).catch(function (e) {
    S.pending = false;
    if (!alive()) return;
    toast(errText(e), 'err');
    if (String(e && e.message) === 'SLOT_TAKEN') S.sel = null;
    drawDay();
  });
}

// ── MY BOOKINGS ──
function loadMine() {
  var host = $('rb-v-mine'); if (!host) return;
  host.innerHTML = '<div class="rb-card"><div class="rb-empty">Loading your bookings...</div></div>';
  api.myBookings().then(function (list) { if (!alive()) return; S.mine = list || []; drawMine(); }).catch(function (e) { if (!alive()) return; host.innerHTML = '<div class="rb-card"><div class="rb-empty"><b>Could not load your bookings</b>' + esc(errText(e)) + '</div></div>'; });
}
function drawMine() {
  var host = $('rb-v-mine'); if (!host) return;
  var now = ist(), list = S.mine || [];
  var up = list.filter(function (b) { return b.date > now.date || (b.date === now.date && b.endMin > now.min); }).sort(function (a, b) { return sortKey(a).localeCompare(sortKey(b)); });
  var past = list.filter(function (b) { return up.indexOf(b) < 0; }).sort(function (a, b) { return sortKey(b).localeCompare(sortKey(a)); }).slice(0, 20);
  function group(arr) {
    var out = '', last = '';
    arr.forEach(function (b) { if (b.date !== last) { last = b.date; out += '<div class="rb-day">' + esc(longDate(b.date)) + (b.date === now.date ? ' (today)' : '') + '</div>'; }
      out += '<button type="button" class="rb-li" data-bk="' + esc(b.id) + '" data-mine="1"><span class="t">' + fmin(b.startMin) + ' - ' + fmin(b.endMin) + '</span><span class="m"><b>' + esc(b.title) + '</b><small>' + esc(roomById(b.roomId).name) + '</small></span><span class="rb-tag">' + dur(b.endMin - b.startMin) + '</span></button>'; });
    return out;
  }
  host.innerHTML = '<div class="rb-sec"><div class="rb-card">'
    + (up.length ? group(up) : '<div class="rb-empty"><b>No upcoming bookings</b>Book a space and it shows up here.</div>')
    + (past.length ? '<div style="padding:8px 0 4px"><button type="button" class="rb-link" id="rb-past">' + (S.showPast ? 'Hide earlier bookings' : 'Show earlier bookings (' + past.length + ')') + '</button></div>' + (S.showPast ? group(past) : '') : '')
    + '</div></div>';
}

// ── ADMIN: ROOMS ──
function drawRooms() {
  var host = $('rb-v-rooms'); if (!host) return;
  if (!S.me.isAdmin) { host.innerHTML = '<div class="rb-card"><div class="rb-empty"><b>Admins only</b>Only an admin can change the rooms.</div></div>'; return; }
  host.innerHTML = '<div class="rb-sec"><div class="rb-card">' + S.rooms.map(function (r, i) {
    return '<div class="rb-rr" data-room="' + r.id + '"><span class="rb-ri2">' + ic(r.icon) + '</span>'
      + '<label><span style="display:block;font-size:12px;color:var(--rb-text3)">Name</span><input type="text" class="rb-rn-in" maxlength="40" value="' + esc(r.name) + '"></label>'
      + '<label><span style="display:block;font-size:12px;color:var(--rb-text3)">Short label</span><input type="text" class="rb-rl-in" maxlength="40" value="' + esc(r.label) + '"></label>'
      + '<span class="rb-swt"><input type="checkbox" class="rb-ra-in" ' + (r.active ? 'checked' : '') + ' id="rb-act-' + r.id + '"><label for="rb-act-' + r.id + '">Bookable</label></span>'
      + '<span style="display:flex;gap:6px"><button type="button" class="rb-btn sq" data-up="' + r.id + '" aria-label="Move up" ' + (i === 0 ? 'disabled' : '') + '>' + ic('left').replace('M15 5l-7 7 7 7', 'M5 15l7-7 7 7') + '</button><button type="button" class="rb-btn sq" data-down="' + r.id + '" aria-label="Move down" ' + (i === S.rooms.length - 1 ? 'disabled' : '') + '>' + ic('left').replace('M15 5l-7 7 7 7', 'M5 9l7 7 7-7') + '</button><button type="button" class="rb-btn pri" data-save="' + r.id + '">Save</button></span></div>';
  }).join('') + '</div><p class="rb-note">Switching a space off hides it from the day view. Bookings already made stay as they are.</p></div>';
}
function saveRoom(id, orderOverride) {
  var row = root.querySelector('.rb-rr[data-room="' + id + '"]'); if (!row) return;
  var name = row.querySelector('.rb-rn-in').value.trim();
  if (!name) { toast('A space needs a name.', 'err'); return; }
  var cfg = { name: name, label: row.querySelector('.rb-rl-in').value.trim(), active: row.querySelector('.rb-ra-in').checked, order: orderOverride != null ? orderOverride : roomById(id).order };
  api.saveConfig(id, cfg).then(function () { S.cfg[id] = cfg; buildRooms(); drawRooms(); toast('Saved ' + name, 'ok'); }).catch(function (e) { toast(errText(e), 'err'); });
}
function moveRoom(id, dir) {
  var i = -1; S.rooms.forEach(function (r, n) { if (r.id === id) i = n; });
  var j = i + dir; if (i < 0 || j < 0 || j >= S.rooms.length) return;
  var a = S.rooms[i], b = S.rooms[j];
  Promise.all([api.saveConfig(a.id, { name: a.name, label: a.label, active: a.active, order: j }), api.saveConfig(b.id, { name: b.name, label: b.label, active: b.active, order: i })])
    .then(function () { S.cfg[a.id] = { name: a.name, label: a.label, active: a.active, order: j }; S.cfg[b.id] = { name: b.name, label: b.label, active: b.active, order: i }; buildRooms(); drawRooms(); })
    .catch(function (e) { toast(errText(e), 'err'); });
}

// ── POPUP: booking details, edit, cancel ──
function findBooking(id) {
  var i; for (i = 0; i < S.bookings.length; i++) if (S.bookings[i].id === id) return S.bookings[i];
  if (S.mine) for (i = 0; i < S.mine.length; i++) if (S.mine[i].id === id) return S.mine[i];
  return null;
}
function openModal(html) { var m = $('rb-modal'), d = $('rb-dlg'); d.innerHTML = html; m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); S.modal = true; var f = d.querySelector('[data-first]') || d.querySelector('button'); if (f) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) {} }, 60); }
function closeModal() { var m = $('rb-modal'); if (!m) return; m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); S.modal = false; S.editDraft = null; }
function canChange(b) { var now = ist(); var open = b.date > now.date || (b.date === now.date && b.endMin > now.min); return open && b.bookedBy === S.me.email; }
function canCancel(b) { var now = ist(); var open = b.date > now.date || (b.date === now.date && b.endMin > now.min); return open && (b.bookedBy === S.me.email || S.me.isAdmin); }
function showDetails(id) {
  var b = findBooking(id); if (!b) return;
  var room = roomById(b.roomId), att = (b.attendees || []).map(function (a) { return esc(a.name || a.email); }).join(', ');
  openModal('<div class="rb-dh"><div><h3>' + esc(b.title) + '</h3><p>' + esc(room.name) + '</p></div><button type="button" class="rb-x" data-close aria-label="Close">' + ic('x') + '</button></div><div class="rb-db">'
    + '<dl class="rb-kv"><dt>When</dt><dd>' + esc(longDate(b.date)) + ', ' + fmin(b.startMin) + ' to ' + fmin(b.endMin) + ' (' + dur(b.endMin - b.startMin) + ')</dd><dt>Booked by</dt><dd>' + esc(b.bookedByName || b.bookedBy) + '</dd>'
    + (att ? '<dt>People</dt><dd>' + att + '</dd>' : '') + (b.notes ? '<dt>Notes</dt><dd>' + esc(b.notes) + '</dd>' : '') + '</dl>'
    + '<div class="rb-act">' + (canChange(b) && endPoint(b) ? '<button type="button" class="rb-btn pri" data-endnow="' + esc(b.id) + '" data-first>' + ic('clock') + ' End now</button>' : '') + (canChange(b) ? '<button type="button" class="rb-btn" data-edit="' + esc(b.id) + '" data-first>' + ic('edit') + ' Edit</button>' : '')
    + (canCancel(b) ? '<button type="button" class="rb-btn dng" data-cancel="' + esc(b.id) + '">' + ic('trash') + ' Cancel booking</button>' : '') + '<button type="button" class="rb-btn" data-close>Close</button></div></div>');
}
// "End now": the person leaves early, so the booking is cut at the next 15-minute mark and the rest of the time is freed
function endPoint(b) {
  var now = ist(); if (b.date !== now.date || b.startMin > now.min || now.min >= b.endMin) return 0;
  var e = Math.floor(now.min / STEP) * STEP + STEP; return (e > b.startMin && e < b.endMin) ? e : 0;
}
function confirmEnd(id) {
  var b = findBooking(id); if (!b) return; var e = endPoint(b); if (!e) { closeModal(); toast('There is nothing left to free up.'); return; }
  openModal('<div class="rb-dh"><div><h3>End this booking now?</h3><p>' + esc(b.title) + ', ' + esc(roomById(b.roomId).name) + '</p></div><button type="button" class="rb-x" data-close aria-label="Close">' + ic('x') + '</button></div><div class="rb-db"><p style="margin:0 0 4px;color:var(--rb-text2)">The booking will end at <b>' + fmin(e) + '</b> instead of ' + fmin(b.endMin) + '. The room is free for everyone from ' + fmin(e) + ' to ' + fmin(b.endMin) + '.</p><div class="rb-act"><button type="button" class="rb-btn pri" data-yes-end="' + esc(b.id) + '" data-first>Yes, end it</button><button type="button" class="rb-btn" data-close>Keep it</button></div></div>');
}
function doEnd(id) {
  var b = findBooking(id); if (!b) return; var e = endPoint(b); if (!e) { closeModal(); return; }
  api.updateBooking(id, { startMin: b.startMin, endMin: e, title: b.title, notes: b.notes || '', attendees: b.attendees || [] }).then(function () {
    if (!alive()) return; closeModal(); toast('Booking ended. The space is free from ' + fmin(e) + '.', 'ok'); if (S.view === 'mine') loadMine();
  }).catch(function (x) { if (!alive()) return; toast(errText(x), 'err'); closeModal(); });
}
function confirmCancel(id) {
  var b = findBooking(id); if (!b) return;
  openModal('<div class="rb-dh"><div><h3>Cancel this booking?</h3><p>' + esc(b.title) + ', ' + esc(roomById(b.roomId).name) + '</p></div><button type="button" class="rb-x" data-close aria-label="Close">' + ic('x') + '</button></div><div class="rb-db"><p style="margin:0 0 4px;color:var(--rb-text2)">' + esc(longDate(b.date)) + ', ' + fmin(b.startMin) + ' to ' + fmin(b.endMin) + '. The time becomes free for everyone.</p><div class="rb-act"><button type="button" class="rb-btn dng" data-yes-cancel="' + esc(b.id) + '" data-first>Yes, cancel it</button><button type="button" class="rb-btn" data-close>Keep it</button></div></div>');
}
function doCancel(id) {
  api.cancelBooking(id).then(function () { if (!alive()) return; closeModal(); toast('Booking cancelled', 'ok'); if (S.view === 'mine') loadMine(); }).catch(function (e) { if (!alive()) return; toast(errText(e), 'err'); closeModal(); });
}
function timeOptions(from, to, sel) { var o = ''; for (var m = from; m <= to; m += STEP) o += '<option value="' + m + '"' + (m === sel ? ' selected' : '') + '>' + fmin(m) + '</option>'; return o; }
function editBooking(id) {
  var b = findBooking(id); if (!b) return;
  var att = (b.attendees || []).slice();
  S.editDraft = { id: id, att: att, err: '' };
  var pills = function () { return S.editDraft.att.map(function (a, i) { return '<span class="rb-pill">' + esc(a.name || a.email) + '<button type="button" data-ermv="' + i + '" aria-label="Remove ' + esc(a.name || a.email) + '">' + ic('x') + '</button></span>'; }).join(''); };
  openModal('<div class="rb-dh"><div><h3>Edit booking</h3><p>' + esc(roomById(b.roomId).name) + ', ' + esc(longDate(b.date)) + '</p></div><button type="button" class="rb-x" data-close aria-label="Close">' + ic('x') + '</button></div><div class="rb-db">'
    + '<label class="rb-field" id="rb-e-tf"><span>Title</span><input type="text" id="rb-e-title" maxlength="120" value="' + esc(b.title) + '" data-first><p class="rb-err" id="rb-e-err" hidden></p></label>'
    + '<div class="rb-row2"><label class="rb-field"><span>Starts</span><select id="rb-e-s">' + timeOptions(OPEN, CLOSE - STEP, b.startMin) + '</select></label><label class="rb-field"><span>Ends</span><select id="rb-e-e">' + timeOptions(OPEN + STEP, CLOSE, b.endMin) + '</select></label></div>'
    + '<div class="rb-field"><span>People coming (optional)</span><div class="rb-sug"><input type="text" id="rb-e-attq" placeholder="Search by name" autocomplete="off"><ul id="rb-e-sugl" hidden></ul></div><div class="rb-att" id="rb-e-att">' + pills() + '</div></div>'
    + '<label class="rb-field"><span>Notes (optional)</span><textarea id="rb-e-notes" maxlength="500">' + esc(b.notes || '') + '</textarea></label>'
    + '<div class="rb-act"><button type="button" class="rb-btn pri" data-e-save="' + esc(id) + '">Save changes</button><button type="button" class="rb-btn" data-close>Back</button></div></div>');
}
function saveEdit(id) {
  var title = $('rb-e-title').value.trim(), s = +$('rb-e-s').value, e = +$('rb-e-e').value, err = $('rb-e-err');
  var fail = function (m) { err.textContent = m; err.hidden = false; $('rb-e-tf').classList.add('bad'); };
  if (!title) return fail('Enter a title for the booking.');
  if (e <= s) return fail('The end time must be after the start time.');
  var b = findBooking(id);
  api.updateBooking(id, { startMin: s, endMin: e, title: title, notes: $('rb-e-notes').value.trim(), attendees: S.editDraft.att }).then(function () {
    if (!alive()) return; closeModal(); toast('Booking updated', 'ok'); if (S.view === 'mine') loadMine();
  }).catch(function (x) { if (!alive()) return; fail(errText(x)); });
}

// ── people suggestions (for the booking form and the edit popup) ──
function ensureStaff() { if (S.staff) return Promise.resolve(S.staff); return api.staff().then(function (l) { S.staff = l || []; return S.staff; }).catch(function () { S.staff = []; return S.staff; }); }
function suggest(inputId, listId, chosen, onPick) {
  var q = $(inputId).value.trim().toLowerCase(), ul = $(listId);
  if (!q) { ul.hidden = true; return; }
  ensureStaff().then(function (staff) {
    var have = {}; chosen.forEach(function (a) { have[a.email || a.name] = 1; });
    var hits = staff.filter(function (p) { return !have[p.email] && (p.name + ' ' + p.email).toLowerCase().indexOf(q) > -1; }).slice(0, 6);
    ul.innerHTML = hits.length ? hits.map(function (p, i) { return '<li data-i="' + i + '">' + esc(p.name) + '<small>' + esc(p.dept || p.email) + '</small></li>'; }).join('') : '<li style="cursor:default">No match</li>';
    ul._hits = hits; ul.hidden = false;
    ul.onclick = function (ev) { var li = ev.target.closest('li[data-i]'); if (!li) return; var p = ul._hits[+li.getAttribute('data-i')]; if (p) onPick({ name: p.name, email: p.email }); };
  });
}

// ── calendar: pick a day (past days, Sundays and anything beyond 30 days are greyed out) ──
function calMonthOf(date) { return date.slice(0, 7) + '-01'; }
function calHtml() {
  var now = ist(), last = addDays(now.date, HORIZON), first = S.calMonth, d = pd(first), y = d.getUTCFullYear(), m = d.getUTCMonth();
  var lead = (d.getUTCDay() + 6) % 7, count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), i, cells = '';
  for (i = 0; i < lead; i++) cells += '<span></span>';
  for (i = 1; i <= count; i++) {
    var ds = y + '-' + pad(m + 1) + '-' + pad(i), sun = dow(ds) === 0, off = ds < now.date || ds > last || sun;
    cells += '<button type="button" class="rb-cd' + (ds === now.date ? ' today' : '') + (ds === S.date ? ' sel' : '') + (sun ? ' sun' : '') + '" data-cal-day="' + ds + '"' + (off ? ' disabled' : '') + ' aria-label="' + esc(longDate(ds)) + '"' + (ds === S.date ? ' aria-current="date"' : '') + '>' + i + '</button>';
  }
  var prevOff = first <= calMonthOf(now.date), nextOff = calMonthOf(last) <= first;
  var tom = addDays(now.date, 1), tomOff = dow(tom) === 0 || tom > last;
  return '<div class="rb-ch"><button type="button" class="rb-cn" data-cal-nav="-1" aria-label="Previous month"' + (prevOff ? ' disabled' : '') + '>' + ic('left') + '</button><b>' + MONTHS[m] + ' ' + y + '</b><button type="button" class="rb-cn" data-cal-nav="1" aria-label="Next month"' + (nextOff ? ' disabled' : '') + '>' + ic('right') + '</button></div>'
    + '<div class="rb-cw"><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span></div><div class="rb-cg">' + cells + '</div>'
    + '<div class="rb-cf"><div><button type="button" class="rb-cq" data-cal-day="' + now.date + '"' + (dow(now.date) === 0 ? ' disabled' : '') + '>Today</button> <button type="button" class="rb-cq" data-cal-day="' + tom + '"' + (tomOff ? ' disabled' : '') + '>Tomorrow</button></div><span class="rb-cnote">Closed Sundays</span></div>';
}
function openCal() {
  var box = $('rb-cal'), btn = $('rb-date'); if (!box || !btn) return;
  S.calMonth = calMonthOf(S.date); box.innerHTML = calHtml(); box.hidden = false; btn.setAttribute('aria-expanded', 'true'); S.calOpen = true;
  if (window.innerWidth > 760) {
    var a = root.getBoundingClientRect(), b = btn.getBoundingClientRect(), w = box.offsetWidth || 318;
    var left = b.right - a.left - w; left = Math.max(8, Math.min(left, a.width - w - 8));
    box.style.left = left + 'px'; box.style.top = (b.bottom - a.top + 10) + 'px';
  } else { box.style.left = ''; box.style.top = ''; }
  var sel = box.querySelector('.rb-cd.sel') || box.querySelector('.rb-cd:not(:disabled)'); if (sel) { try { sel.focus({ preventScroll: true }); } catch (e) {} }
}
function closeCal() { var box = $('rb-cal'), btn = $('rb-date'); if (box) box.hidden = true; if (btn) btn.setAttribute('aria-expanded', 'false'); if (S) S.calOpen = false; }
function calClick(t) {
  var day = t.closest('[data-cal-day]'); if (day) { if (!day.disabled) { closeCal(); goDate(day.getAttribute('data-cal-day')); } return true; }
  var nv = t.closest('[data-cal-nav]'); if (nv) { var d = pd(S.calMonth); d.setUTCMonth(d.getUTCMonth() + (+nv.getAttribute('data-cal-nav'))); S.calMonth = fd(d); $('rb-cal').innerHTML = calHtml(); return true; }
  return false;
}

// ── hover card: who is in a room now and what is next ──
function tipHtml(id) {
  var r = roomById(id), t = viewMin(), bs = roomBookings(id), cur = null, nxt = null;
  bs.forEach(function (b) { if (t !== null && b.startMin <= t && t < b.endMin) cur = b; else if ((t === null || b.startMin > t) && (!nxt || b.startMin < nxt.startMin)) nxt = b; });
  var stt = statusOf(r), mine = !!(cur && cur.bookedBy === S.me.email), cls = stt.cls === 'busy' ? (mine ? 'mine' : 'busy') : stt.cls;
  var h = '<b>' + esc(r.name) + (S.at != null ? ' <small style="display:inline;opacity:.7">at ' + fmin(S.at) + '</small>' : '') + '</b><span class="st ' + cls + '">' + esc(mine ? stt.txt.replace('In use', 'Yours') : stt.txt) + '</span>';
  if (cur) h += '<span class="ti">' + esc(cur.title) + '</span><small>' + esc(cur.bookedByName || cur.bookedBy) + ' \u00B7 ' + fmin(cur.startMin) + ' to ' + fmin(cur.endMin) + '</small>';
  if (nxt) h += '<span class="nx"><span class="ti">' + (t !== null ? 'Next: ' : (cur ? 'Also: ' : 'First: ')) + esc(nxt.title) + '</span><small>' + fmin(nxt.startMin) + ' to ' + fmin(nxt.endMin) + ' \u00B7 ' + esc(nxt.bookedByName || nxt.bookedBy) + '</small></span>';
  else if (!cur) h += '<small>Nothing booked' + (t !== null ? ' for the rest of the day' : '') + '</small>';
  return h + '<em>Click to see the day and book</em>';
}
var tipTimer = null;
function setRoute(id) {
  if (S) S.route = id || '';
  Array.prototype.forEach.call(document.querySelectorAll('#rb-scene .rb-route'), function (p) { p.classList.toggle('on', !!id && p.getAttribute('data-r') === id); });
}
function placeTip(e) {
  var t = $('rb-tip2'); if (!t || t.hidden) return;
  var w = t._w || (t._w = t.offsetWidth), hgt = t._hh || (t._hh = t.offsetHeight), x = e.clientX + 18, y = e.clientY + 18;
  if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
  if (y + hgt > window.innerHeight - 8) y = e.clientY - hgt - 14;
  t.style.left = Math.max(8, x) + 'px'; t.style.top = Math.max(8, y) + 'px';
}
function showTip(rm, e) {
  var t = $('rb-tip2'); if (!t || S.rmodal || S.modal || S.calOpen || S.view !== 'day') return;
  clearTimeout(tipTimer);
  var rid = rm.getAttribute('data-room');
  if (t._room !== rid || t.hidden) {
    t._room = rid; setRoute(rid);
    var html = tipHtml(rid); if (t._h !== html) { t.innerHTML = html; t._h = html; t._w = 0; t._hh = 0; }
  }
  if (t.hidden) { t.hidden = false; t.classList.remove('in'); void t.offsetWidth; t.classList.add('in'); }
  placeTip(e);
}
function hideTip(now) {
  clearTimeout(tipTimer);
  var go = function () { setRoute(''); var t = $('rb-tip2'); if (t && !t.hidden) { t.hidden = true; t.classList.remove('in'); t._h = ''; t._room = ''; } };
  if (now === true) go(); else tipTimer = setTimeout(go, 160);   // a short grace period, so crossing a wall or a gap does not make it flicker
}

// ── camera: the office turns slightly with the pointer, for depth (desktop only) ──
var camRaf = 0, camEv = null;
function camMove(e) {
  if (!S || !S.cam || !S.cam.live || e.pointerType === 'touch' || reduced()) return;
  camEv = e; if (camRaf) return;
  camRaf = requestAnimationFrame(function () {
    camRaf = 0; var sc = $('rb-scene'), st = $('rb-stage'); if (!sc || !st || !camEv) return;
    var b = st.getBoundingClientRect(), nx = Math.max(-1, Math.min(1, ((camEv.clientX - b.left) / b.width - .5) * 2)), ny = Math.max(-1, Math.min(1, ((camEv.clientY - b.top) / b.height - .5) * 2));
    sc.style.setProperty('--rz', (S.cam.rz + nx * 4.5).toFixed(2) + 'deg'); sc.style.setProperty('--rx', (S.cam.rx - ny * 3.5).toFixed(2) + 'deg');
  });
}
function camReset() { var sc = $('rb-scene'); if (sc && S && S.cam) { sc.style.setProperty('--rz', S.cam.rz + 'deg'); sc.style.setProperty('--rx', S.cam.rx + 'deg'); } }

// ── events ──
function bind() {
  root.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('#rb-date')) { if (S.calOpen) closeCal(); else openCal(); return; }
    if (S.calOpen) { if (t.closest('#rb-cal')) { calClick(t); return; } closeCal(); }
    var el = t.closest('[data-view]'); if (el && el.classList.contains('rb-tab')) { setView(el.getAttribute('data-view')); return; }
    if (t.closest('#rb-prev')) { goDate(addDays(S.date, -1)); return; }
    if (t.closest('#rb-next')) { var n = ist(); if (S.date < addDays(n.date, HORIZON)) goDate(addDays(S.date, 1)); return; }
    if (t.closest('#rb-today')) { goDate(ist().date); return; }
    if (t.closest('#rb-free')) { freeNow(); return; }
    var qk = t.closest('[data-quick]'); if (qk) { quickBook(qk.getAttribute('data-quick')); return; }
    var pk = t.closest('[data-pick]'); if (pk) { selectRoom(pk.getAttribute('data-pick')); return; }
    var tile = t.closest('.rb-tile, .rb-rm'); if (tile) { selectRoom(tile.getAttribute('data-room')); return; }
    var chip = t.closest('[data-dur]'); if (chip) { readDraft(); S.draft.custom = false; extendBy(+chip.getAttribute('data-dur')); return; }
    if (t.closest('[data-custom]')) { readDraft(); S.draft.custom = !S.draft.custom; drawForm(); return; }
    if (t.closest('#rb-cset')) { setCustom(); return; }
    if (t.closest('#rb-more')) { readDraft(); S.draft.more = true; drawForm(); var q = $('rb-attq'); if (q) q.focus(); return; }
    var rm = t.closest('[data-rm]'); if (rm) { readDraft(); S.draft.att.splice(+rm.getAttribute('data-rm'), 1); drawForm(); return; }
    if (t.closest('#rb-book')) { book(); return; }
    if (t.closest('#rb-clear')) { S.sel = null; S.draft = { title: '', notes: '', att: [], more: false, err: '' }; drawForm(); paintSel(); return; }
    var blk = t.closest('[data-bk]'); if (blk) { showDetails(blk.getAttribute('data-bk')); return; }
    if (t.closest('#rb-past')) { S.showPast = !S.showPast; drawMine(); return; }
    var sv = t.closest('[data-save]'); if (sv) { saveRoom(sv.getAttribute('data-save')); return; }
    var up = t.closest('[data-up]'); if (up) { moveRoom(up.getAttribute('data-up'), -1); return; }
    var dn = t.closest('[data-down]'); if (dn) { moveRoom(dn.getAttribute('data-down'), 1); return; }
    // popup
    if (t.closest('[data-close]')) { closeModal(); return; }
    if (t === $('rb-modal')) { closeModal(); return; }
    if (t.closest('[data-rclose]') || t === $('rb-rmodal')) { closeRoomModal(); return; }
    if (t.closest('[data-xclose]') || t === $('rb-xmodal')) { setView('day'); return; }
    var en = t.closest('[data-endnow]'); if (en) { confirmEnd(en.getAttribute('data-endnow')); return; }
    var ye = t.closest('[data-yes-end]'); if (ye) { ye.disabled = true; doEnd(ye.getAttribute('data-yes-end')); return; }
    var ed = t.closest('[data-edit]'); if (ed) { editBooking(ed.getAttribute('data-edit')); return; }
    var cn = t.closest('[data-cancel]'); if (cn) { confirmCancel(cn.getAttribute('data-cancel')); return; }
    var yc = t.closest('[data-yes-cancel]'); if (yc) { yc.disabled = true; doCancel(yc.getAttribute('data-yes-cancel')); return; }
    var es = t.closest('[data-e-save]'); if (es) { saveEdit(es.getAttribute('data-e-save')); return; }
    var er = t.closest('[data-ermv]'); if (er) { S.editDraft.att.splice(+er.getAttribute('data-ermv'), 1); $('rb-e-att').innerHTML = S.editDraft.att.map(function (a, i) { return '<span class="rb-pill">' + esc(a.name || a.email) + '<button type="button" data-ermv="' + i + '" aria-label="Remove ' + esc(a.name || a.email) + '">' + ic('x') + '</button></span>'; }).join(''); return; }
    if (!t.closest('.rb-sug')) { var u = $('rb-sugl'); if (u) u.hidden = true; var u2 = $('rb-e-sugl'); if (u2) u2.hidden = true; }
  });
  root.addEventListener('input', function (e) {
    var id = e.target.id;
    if (id === 'rb-title') { S.draft.title = e.target.value; if (S.draft.err) { S.draft.err = ''; var f = e.target.closest('.rb-field'); if (f) { f.classList.remove('bad'); var p = f.querySelector('.rb-err'); if (p) p.remove(); } } }
    else if (id === 'rb-notes') S.draft.notes = e.target.value;
    else if (id === 'rb-attq') suggest('rb-attq', 'rb-sugl', S.draft.att, function (p) { readDraft(); S.draft.att.push(p); drawForm(); var q = $('rb-attq'); if (q) q.focus(); });
    else if (id === 'rb-e-attq') suggest('rb-e-attq', 'rb-e-sugl', S.editDraft.att, function (p) { S.editDraft.att.push(p); $('rb-e-att').innerHTML = S.editDraft.att.map(function (a, i) { return '<span class="rb-pill">' + esc(a.name || a.email) + '<button type="button" data-ermv="' + i + '" aria-label="Remove ' + esc(a.name || a.email) + '">' + ic('x') + '</button></span>'; }).join(''); $('rb-e-attq').value = ''; $('rb-e-sugl').hidden = true; });
    else if (id === 'rb-e-title') { var tf = $('rb-e-tf'); if (tf) tf.classList.remove('bad'); var er = $('rb-e-err'); if (er) er.hidden = true; }
  });
  root.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && S.calOpen) { closeCal(); e.stopPropagation(); var db = $('rb-date'); if (db) db.focus(); }
    else if (e.key === 'Escape' && S.modal) { closeModal(); e.stopPropagation(); }
    else if (e.key === 'Escape' && S.rmodal) { closeRoomModal(); e.stopPropagation(); }
    else if (e.key === 'Escape' && S.view !== 'day') { setView('day'); e.stopPropagation(); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('rb-rm')) { e.preventDefault(); selectRoom(e.target.getAttribute('data-room')); }
    if (e.key === 'Enter' && e.target.id === 'rb-ch') { e.preventDefault(); setCustom(); }
    if (e.key === 'Enter' && e.target.id === 'rb-title') { e.preventDefault(); book(); }
    if (e.key === 'Enter' && e.target.id === 'rb-e-title') { e.preventDefault(); var b = root.querySelector('[data-e-save]'); if (b) b.click(); }
  });
  // drag across free time to choose a time
  root.addEventListener('pointerdown', function (e) {
    var c = e.target.closest('.rb-c'); if (!c || !S.selRoom) return;
    var k = +c.getAttribute('data-k'); if (!cellFree(S.selRoom, k)) { if (c.classList.contains('off') && dayState(S.date).open) toast('That time has passed.'); return; }
    readDraft(); S.drag = { start: k, moved: false }; setSel(S.selRoom, k, k); drawForm(); paintSel();
  });
  root.addEventListener('pointermove', function (e) {
    if (!S.drag) return;
    var el = document.elementFromPoint(e.clientX, e.clientY), c = el && el.closest ? el.closest('.rb-c') : null; if (!c) return;
    var k = +c.getAttribute('data-k'), a = Math.min(S.drag.start, k), z = Math.max(S.drag.start, k);
    for (var q = a; q <= z; q++) if (!cellFree(S.selRoom, q)) return;
    if (k !== S.drag.start) S.drag.moved = true;
    if (!S.sel || S.sel.a !== a || S.sel.z !== z) { setSel(S.selRoom, a, z); paintSel(); }
  });
  root.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    var rm = e.target.closest ? e.target.closest('.rb-rm') : null;
    if (rm) showTip(rm, e);
    else hideTip();
  });
  root.addEventListener('pointerleave', function () { hideTip(); camReset(); }); root.addEventListener('pointerdown', function () { hideTip(true); });
  window.removeEventListener('pointerup', onPointerUp); window.addEventListener('pointerup', onPointerUp);
  // tiles lean toward the pointer
  root.addEventListener('pointermove', function (e) {
    var tile = e.target.closest ? e.target.closest('.rb-tile') : null; if (!tile || e.pointerType === 'touch' || reduced() || window.innerWidth <= 760) return;
    var b = tile.getBoundingClientRect(), x = (e.clientX - b.left) / b.width - .5, y = (e.clientY - b.top) / b.height - .5;
    tile.style.transform = 'perspective(700px) rotateY(' + (x * 12) + 'deg) rotateX(' + (-y * 12) + 'deg) translateZ(6px)';
  });
  root.addEventListener('pointerout', function (e) { var tile = e.target.closest ? e.target.closest('.rb-tile') : null; if (tile && !tile.contains(e.relatedTarget)) tile.style.transform = ''; });
  window.removeEventListener('resize', onResize); window.addEventListener('resize', onResize);
}
function onPointerUp() {
  if (!S || !S.drag || !alive()) return;
  var d = S.drag; S.drag = null;
  if (!d.moved && S.sel && S.sel.a === S.sel.z && cellFree(S.sel.room, S.sel.a + 1)) S.sel.z = S.sel.a + 1;   // a tap starts a 30-minute booking
  drawForm(); paintSel();
  var t = $('rb-title'); if (t && !S.draft.title) { try { t.focus({ preventScroll: true }); } catch (x) {} }
}
function onResize() { if (alive()) { glide(); S.mapAvail = 0; if (S && S.view === 'day') drawMap(); } }

// ── mount ──
function mount() {
  var r = document.getElementById('rb-app'); if (!r) return;
  cleanup();
  root = r; api = window.olfRooms;
  if (!api) { r.innerHTML = '<div class="rb-card"><div class="rb-empty"><b>Spaces is not ready</b>Reload the page and try again.</div></div>'; return; }
  S = fresh(); S.me = api.user();
  buildRooms();
  if (S.me.isAdmin && $('rb-tab-rooms')) $('rb-tab-rooms').hidden = false;
  bind(); drawBar();
  S.selRoom = null;
  setView('day');
  watch();
  api.loadConfig().then(function (cfg) { if (!alive()) return; S.cfg = cfg || {}; buildRooms(); if (S.view === 'day') drawDay(); if (S.view === 'rooms') drawRooms(); }).catch(function () {});
  // keep "now" and "free until" honest while the page stays open
  S.timer = setInterval(function () { if (!alive()) { cleanup(); return; } if (S.view === 'day' && !S.drag && !S.modal) { var a = document.activeElement; if (a && a.closest && a.closest('#rb-form')) { drawBar(); drawStats(); drawTiles(); drawMap(); return; } drawDay(); } }, 30000);
  tickClock(); S.clockT = setInterval(function () { if (!alive()) { cleanup(); return; } tickClock(); }, 15000);
  setTimeout(glide, 120);
  [500, 1400, 2600].forEach(function (ms) { setTimeout(function () { if (alive() && S.view === 'day') { S.mapAvail = 0; drawMap(); } }, ms); });
}

// ── Spaces (room booking) as a popup ──
var OV_CSS = '.rb-ov{position:fixed;inset:0;z-index:3900;display:flex;align-items:center;justify-content:center;padding:18px;animation:rbovin .22s ease}'
  + '.rb-ovbg{position:absolute;inset:0;background:rgba(11,18,32,.6)}'
  + '.rb-ovdlg{position:relative;width:min(1600px,100%);height:min(100%,1000px);overflow:auto;overscroll-behavior:contain;border-radius:24px;padding:14px;background:linear-gradient(180deg,#F3F6FC,#E6ECF6);box-shadow:0 40px 100px -24px rgba(0,0,0,.65);outline:0;animation:rbovdlg .3s cubic-bezier(.22,1,.36,1)}'
  + '@keyframes rbovin{from{opacity:0}to{opacity:1}}@keyframes rbovdlg{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:none}}'
  + '.rb-ovload{display:flex;align-items:center;justify-content:center;gap:10px;min-height:260px;color:#5A6577;font-weight:600;font-family:inherit}.rb-ovload i{width:18px;height:18px;border-radius:50%;border:3px solid #C7D2E6;border-top-color:#2F6FE4;animation:rbspin .8s linear infinite}@keyframes rbspin{to{transform:rotate(360deg)}}'
  + 'html.rb-ovopen{overflow:hidden}'
  + 'html.rb-ovopen body>*:not(#rbOverlay):not(script):not(style):not(link){visibility:hidden!important}'
  + '@media (max-width:760px){.rb-ov{padding:0}.rb-ovdlg{width:100%;height:100%;border-radius:0;padding:10px}}'
  + '@media (prefers-reduced-motion:reduce){.rb-ov,.rb-ovdlg,.rb-ovload i{animation:none}}';
var fragCache = null, lastFocus = null;
// Read the page file the way a browser does, drop anything that is not part of it (Live Server pushes its own reload script
// into the middle of the file while developing), and make sure the pieces we need are really there.
function cleanFragment(h) {
  // the file ends with a marker; anything a dev tool added after it is thrown away
  var endAt = h.indexOf('<!--rb-end-->'); if (endAt > -1) h = h.slice(0, endAt);
  var doc = new DOMParser().parseFromString('<!doctype html><html><body>' + h, 'text/html');
  Array.prototype.forEach.call(doc.querySelectorAll('script'), function (n) { n.parentNode.removeChild(n); });
  var need = ['rb-app', 'rb-map', 'rb-stage', 'rb-scene', 'rb-panel', 'rb-conf', 'rb-date'], missing = need.filter(function (id) { return !doc.getElementById(id); });
  if (missing.length) {
    var inj = h.search(/live-?server|livereload|WebSocket/i);
    throw new Error('The page file arrived incomplete (' + h.length + ' characters, missing: ' + missing.join(', ') + (inj > -1 ? '; tool script at ' + inj : '') + ').');
  }
  return doc.body.innerHTML;
}
function loadFragment() {
  if (typeof window.RB_HTML === 'string' && window.RB_HTML.length > 1000) { if (!fragCache) fragCache = cleanFragment(window.RB_HTML); return Promise.resolve(fragCache); }
  return Promise.reject(new Error('rooms-ui.js did not load. Hard-refresh the page (Ctrl+Shift+R).'));
}
function openPopup(roomId) {
  if (document.getElementById('rbOverlay')) return;
  if (!document.getElementById('rbOvStyle')) { var st = document.createElement('style'); st.id = 'rbOvStyle'; st.textContent = OV_CSS; document.head.appendChild(st); }
  var ov = document.createElement('div'); ov.id = 'rbOverlay'; ov.className = 'rb-ov';
  ov.innerHTML = '<div class="rb-ovbg" data-ovclose></div><div class="rb-ovdlg" id="rbDialog" role="dialog" aria-modal="true" aria-label="Spaces" tabindex="-1"><div id="rbHostBody"><div class="rb-ovload"><i></i><span>Opening Spaces...</span></div></div></div>';
  document.body.appendChild(ov); lastFocus = document.activeElement; document.documentElement.classList.add('rb-ovopen');
  ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); closePopup(); } });
  var d0 = document.getElementById('rbDialog'); try { d0.focus({ preventScroll: true }); } catch (x) {}
  function fail(msg, err) {
    try { console.error('[RoomBooking]', err || msg); } catch (x) {}
    var body = document.getElementById('rbHostBody');
    if (body) body.innerHTML = '<div class="rb-ovload" style="flex-direction:column;text-align:center;padding:24px"><span>' + esc(msg) + '</span><span style="font-size:12px;font-weight:500;opacity:.8">' + esc((err && err.message ? err.message : '') + (err && err.stack ? ' | ' + String(err.stack).split('\n').slice(1, 3).join(' ').replace(/\s+/g, ' ').slice(0, 220) : '')) + '</span><button type="button" data-ovclose style="margin-top:6px;padding:9px 18px;border-radius:10px;border:1px solid #B0C4D4;background:#fff;font:inherit;font-weight:700;cursor:pointer">Close</button></div>';
  }
  loadFragment().then(function (h) {
    var body = document.getElementById('rbHostBody'); if (!body) return;
    body.innerHTML = h;
    if (!document.getElementById('rb-map') || !document.getElementById('rb-panel')) { fragCache = null; fail('Spaces did not load completely.', new Error('Parts of the page are missing after loading (' + h.length + ' characters).')); return; }
    try { mount(); } catch (err) { fail('Spaces hit a problem while starting.', err); return; }
    if (roomId && S && roomById(roomId).active) { try { selectRoom(roomId); } catch (err2) {} }
    var d = document.getElementById('rbDialog'); if (d) { try { d.focus({ preventScroll: true }); } catch (x) {} }
  }).catch(function (err) { fragCache = null; fail('Could not load Spaces. Check your connection and try again.', err); });
}
function closePopup() {
  var ov = document.getElementById('rbOverlay'); if (!ov) return;
  cleanup(); root = null;
  ov.remove(); document.documentElement.classList.remove('rb-ovopen');
  try { if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); } catch (e) {}
  homeTile();
}
// how many rooms are free right now, for the dot on the top-bar button
function peek(cb) {
  var api = window.olfRooms; if (!api || !api.watchDay) { cb(null); return; }
  var now = ist(), all = {}; ROOMS0.forEach(function (r) { all[r.id] = 'closed'; });
  var shut = dow(now.date) === 0 ? 'Closed on Sundays' : (now.min >= CLOSE ? 'Closed for today' : (now.min < OPEN ? 'Opens at ' + fmin(OPEN) : ''));
  if (shut) { cb({ shut: shut, map: all }); return; }
  (api.loadConfig ? api.loadConfig().catch(function () { return {}; }) : Promise.resolve({})).then(function (cfg) {
    cfg = cfg || {}; var done = false, un = null;
    un = api.watchDay(now.date, function (list) {
      if (done) return; done = true; setTimeout(function () { try { if (un) un(); } catch (e) {} }, 0);
      var rooms = ROOMS0.filter(function (r) { return (cfg[r.id] || {}).active !== false; }), busy = {}, map = {}, next = null;
      (list || []).forEach(function (b) { if (b.startMin <= now.min && now.min < b.endMin) busy[b.roomId] = 1; else if (b.startMin > now.min && (next === null || b.startMin < next)) next = b.startMin; });
      ROOMS0.forEach(function (r) { map[r.id] = (cfg[r.id] || {}).active === false ? 'closed' : (busy[r.id] ? 'busy' : 'free'); });
      cb({ free: rooms.filter(function (r) { return !busy[r.id]; }).length, total: rooms.length, map: map, nextIn: next === null ? 0 : next - now.min });
    }, function () { cb(null); });
  });
}
// the small dot on the top-bar button: green when some room is free, red when all are busy, grey when closed
function homeTile() {
  if (!document.getElementById('tbRoomsDot') || document.hidden) return;
  peek(function (r) {
    var d = document.getElementById('tbRoomsDot'), b = document.getElementById('tbRoomsBtn'); if (!d || !r) return;
    d.className = 'tb-rooms-dot' + (r.shut ? ' shut' : (r.free ? '' : ' busy')); d.hidden = false;
    if (b) { var t = r.shut ? r.shut : r.free + ' of ' + r.total + ' spaces free now'; b.title = 'Spaces. ' + t; b.setAttribute('aria-label', 'Spaces. ' + t); }
  });
}
setTimeout(homeTile, 2500); setTimeout(homeTile, 8000);
setInterval(homeTile, 120000);
document.addEventListener('click', function (e) {
  var t = e.target; if (!t || !t.closest) return;
  var op = t.closest('#homeRooms, [data-open-rooms]'); if (op) { e.preventDefault(); openPopup(op.getAttribute('data-room') || ''); return; }
  if (t.closest('[data-ovclose]')) { e.preventDefault(); closePopup(); }
});

document.addEventListener('keydown', function (e) {
  if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.classList && e.target.classList.contains('hm-rb-room')) { e.preventDefault(); openPopup(e.target.getAttribute('data-room') || ''); }
});

window.RoomBooking = { open: openPopup, close: closePopup, homeTile: homeTile, mount: mount, setUser: function () { if (alive()) { S.me = api.user(); if (S.me.isAdmin) $('rb-tab-rooms').hidden = false; } } };
})();
