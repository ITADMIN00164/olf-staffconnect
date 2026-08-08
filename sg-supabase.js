/* =====================================================================
 * sg-supabase.js — Supabase transport for SMART Goals (data store only)
 * ---------------------------------------------------------------------
 * Drop-in replacement for the Google Apps Script transport. It exposes a
 * single entry point, window.SG_SUPA.call(action, payload), that speaks the
 * EXACT same action set and returns the EXACT same data shapes as Code.gs.
 * Because smartgoal.js funnels every read/write/batch through api(), nothing
 * else in the app changes: the durable outbox, snapshot, retry banner and
 * ALL permission rules (which live in the frontend) keep working untouched.
 *
 * LOAD ORDER (in index.html, BEFORE smartgoal.js):
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   <script src="sg-supabase.js"></script>
 *   <script src="smartgoal.js"></script>
 * ===================================================================== */
(function () {
  "use strict";

  // -------- FILL THESE IN (Settings > API in your Supabase project) --------
  var SB_URL  = 'https://muonwruwhcusohzlqitn.supabase.co';
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11b253cnV3aGN1c29oemxxaXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MjIwNDgsImV4cCI6MjEwMTQ5ODA0OH0.BHhDKkH6EzMI1kzr8odze7guTa3eckJZFRfzUg3P24E';  // public anon key (safe in browser)
  // ------------------------------------------------------------------------

  if (!window.supabase || !window.supabase.createClient) {
    console.error('[SG_SUPA] supabase-js not loaded. Add the CDN <script> before sg-supabase.js');
    return;
  }
  var sb = window.supabase.createClient(SB_URL, SB_ANON, { auth: { persistSession: false } });

  // ---- helpers: match GAS num_ coercion exactly ----
  function sgNum0(v) { if (v === '' || v == null) return 0; var n = Number(v); return isNaN(n) ? 0 : n; }
  function sgNumOrEmpty(v) { return (v == null) ? '' : (v === '' ? '' : Number(v)); }
  function sgUid() {
    // matches GAS style: id_ + 12 hex chars
    var s = '';
    if (window.crypto && crypto.getRandomValues) {
      var a = new Uint8Array(6); crypto.getRandomValues(a);
      for (var i = 0; i < a.length; i++) s += ('0' + a[i].toString(16)).slice(-2);
    } else { s = Math.random().toString(16).slice(2, 14); }
    return 'id_' + s.slice(0, 12);
  }
  function sgThrow(error) { if (error) throw new Error(error.message || String(error)); }

  var LIST_TABLE = { dept: 'depts', goalName: 'goal_names', category: 'categories' };

  // ================= READ: getAll =================
  // Supabase caps a single select at 1000 rows (PostgREST max-rows). Fetch every
  // table in fixed-size pages via .range() and stitch them together, ordered by a
  // stable key so pages never overlap or skip a row. A page shorter than PAGE_SIZE
  // means we've reached the end. This is transport-only: getAll still returns the
  // exact same complete object, so smartgoal.js and the UI are unchanged.
  var PAGE_SIZE = 1000;
  function sgSelectAll(table, orderCol) {
    var all = [];
    function fetchPage(from) {
      return sb.from(table).select('*').order(orderCol, { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
        .then(function (r) {
          sgThrow(r.error);
          var rows = r.data || [];
          all = all.concat(rows);
          // full page => there may be more; short page => done.
          if (rows.length === PAGE_SIZE) return fetchPage(from + PAGE_SIZE);
          return all;
        });
    }
    return fetchPage(0);
  }

  function sgGetAll() {
    // Tables run in parallel; each large one pages internally by its stable key.
    return Promise.all([
      sgSelectAll('depts', 'name'),
      sgSelectAll('goal_names', 'name'),
      sgSelectAll('categories', 'name'),
      sgSelectAll('members', 'id'),
      sgSelectAll('admins', 'id'),
      sgSelectAll('goals', 'id'),
      sgSelectAll('tasks', 'id'),
      sgSelectAll('reviews', 'id'),
      sgSelectAll('review_items', 'pk')
    ]).then(function (res) {
      var depts = res[0] || [], goalNames = res[1] || [], cats = res[2] || [];
      var members = res[3] || [], admins = res[4] || [];
      var goals = res[5] || [], tasks = res[6] || [];
      var reviews = res[7] || [], items = res[8] || [];

      var itemsByReview = {};
      items.forEach(function (it) {
        var rid = String(it.review_id);
        (itemsByReview[rid] || (itemsByReview[rid] = [])).push({
          goalItemId: it.goal_item_id, goal: it.goal, weightage: sgNum0(it.weightage),
          description: it.description || '', cat: it.cat, particulars: it.particulars,
          maxScore: sgNum0(it.max_score), target: it.target, actual: it.actual,
          remark: it.remark, memberScore: sgNum0(it.member_score), mgrScore: sgNum0(it.mgr_score)
        });
      });

      return {
        settings: {
          depts: depts.map(function (r) { return r.name; }).filter(String),
          goalNames: goalNames.map(function (r) { return r.name; }).filter(String),
          categories: cats.map(function (r) { return r.name; }).filter(String),
          members: members.map(function (m) {
            return { id: String(m.id || ''), name: m.name, dept: m.dept || '', role: m.role || 'member',
                     email: m.email || '', managerName: m.manager_name || '', managerEmail: m.manager_email || '' };
          }).filter(function (m) { return m.name; }),
          admins: admins.map(function (a) {
            var email = a.email || '';
            return { id: String(a.id || email), name: email, email: email };
          }).filter(function (a) { return a.email; })
        },
        goals: goals.map(function (g) {
          return { id: String(g.id || ''), year: g.year || '', dept: g.dept || '', member: g.member || '',
                   goal: g.goal || '', weightage: sgNum0(g.weightage), description: g.description || '',
                   cat: g.cat || '', particulars: g.particulars || '', maxScore: sgNum0(g.max_score) };
        }),
        tasks: tasks.map(function (t) {
          return { id: String(t.id || ''), year: t.year || '', month: t.month || '', week: t.week || '',
                   dept: t.dept || '', member: t.member || '', goal: t.goal || '', cat: t.cat || '',
                   subcat: t.subcat || '', action: t.action || '', planned: t.planned || '',
                   plannedItems: sgNumOrEmpty(t.planned_items), est: sgNum0(t.est),
                   tgtDate: t.tgt_date || '', compDate: t.comp_date || '', actualHrs: sgNum0(t.actual_hrs),
                   actualItems: sgNumOrEmpty(t.actual_items), status: t.status || '', deviation: t.deviation || '',
                   helpNeeded: t.help_needed || '', revisedTgtDate: t.revised_tgt_date || '',
                   managerComment: t.manager_comment || '', managerGrade: t.manager_grade || '' };
        }),
        reviews: reviews.map(function (r) {
          return { id: String(r.id || ''), year: r.year || '', month: r.month || '', dept: r.dept || '',
                   member: r.member || '', reviewer: r.reviewer || '', date: r.date || '',
                   remarks: r.remarks || '', sheetBLink: r.sheet_b_link || '', helpNeeded: r.help_needed || '', areasOfImprovement: r.areas_of_improvement || '',
                   items: itemsByReview[String(r.id)] || [] };
        })
      };
    });
  }

  // ================= WRITES =================
  function ensureListValue(table, name) {
    if (!name) return Promise.resolve();
    return sb.from(table).upsert({ name: name }, { onConflict: 'name', ignoreDuplicates: true })
      .then(function (r) { /* duplicate is fine */ return null; });
  }

  function sgAddListItem(p) {
    var table = LIST_TABLE[p.type]; if (!table) throw new Error('Unknown list type: ' + p.type);
    return ensureListValue(table, p.value).then(function () { return { type: p.type, value: p.value }; });
  }
  function sgRemoveListItem(p) {
    var table = LIST_TABLE[p.type]; if (!table) throw new Error('Unknown list type: ' + p.type);
    return sb.from(table).delete().eq('name', p.value).then(function (r) { sgThrow(r.error); return { type: p.type, value: p.value }; });
  }

  function sgSaveMember(m) {
    if (!m.id) m.id = sgUid();
    var row = { id: m.id, name: m.name || '', dept: m.dept || '', role: m.role || 'member',
                email: m.email || '', manager_name: m.managerName || '', manager_email: m.managerEmail || '' };
    return sb.from('members').upsert(row, { onConflict: 'id' }).then(function (r) { sgThrow(r.error); return { member: m }; });
  }
  function sgRemoveMember(p) {
    return sb.from('members').delete().eq('id', p.id).then(function (r) { sgThrow(r.error); return { id: p.id }; });
  }
  function sgSaveAdmin(a) {
    if (!a.id) a.id = sgUid();
    return sb.from('admins').upsert({ id: a.id, email: a.email || '' }, { onConflict: 'id' })
      .then(function (r) { sgThrow(r.error); return { admin: a }; });
  }
  function sgRemoveAdmin(p) {
    return sb.from('admins').delete().eq('id', p.id).then(function (r) { sgThrow(r.error); return { id: p.id }; });
  }

  function sgSaveGoal(g) {
    if (!g.id) g.id = sgUid();
    var row = { id: g.id, year: g.year || '', dept: g.dept || '', member: g.member || '',
                goal: g.goal || '', weightage: (g.weightage === '' || g.weightage == null) ? 0 : Number(g.weightage),
                description: g.description || '', cat: g.cat || '', particulars: g.particulars || '',
                max_score: (g.maxScore === '' || g.maxScore == null) ? 0 : Number(g.maxScore) };
    // mirror GAS side-effect: register new goal name + category (idempotent)
    return Promise.all([
      g.goal ? ensureListValue('goal_names', g.goal) : null,
      g.cat ? ensureListValue('categories', g.cat) : null
    ]).then(function () {
      return sb.from('goals').upsert(row, { onConflict: 'id' });
    }).then(function (r) { sgThrow(r.error); return { goal: g }; });
  }
  function sgDeleteGoal(p) {
    return sb.from('goals').delete().eq('id', p.id).then(function (r) { sgThrow(r.error); return { id: p.id }; });
  }

  function sgSaveTask(t) {
    if (!t.id) t.id = sgUid();
    var row = { id: t.id, year: t.year || '', month: t.month || '', week: t.week || '',
                dept: t.dept || '', member: t.member || '', goal: t.goal || '', cat: t.cat || '',
                subcat: t.subcat || '', action: t.action || '', planned: t.planned || '',
                planned_items: (t.plannedItems === '' || t.plannedItems == null) ? null : Number(t.plannedItems),
                est: (t.est === '' || t.est == null) ? 0 : Number(t.est),
                tgt_date: t.tgtDate || '', comp_date: t.compDate || '',
                actual_hrs: (t.actualHrs === '' || t.actualHrs == null) ? 0 : Number(t.actualHrs),
                actual_items: (t.actualItems === '' || t.actualItems == null) ? null : Number(t.actualItems),
                status: t.status || '', deviation: t.deviation || '',
                help_needed: t.helpNeeded || '', revised_tgt_date: t.revisedTgtDate || '',
                manager_comment: t.managerComment || '', manager_grade: t.managerGrade || '' };
    return (t.cat ? ensureListValue('categories', t.cat) : Promise.resolve())
      .then(function () { return sb.from('tasks').upsert(row, { onConflict: 'id' }); })
      .then(function (r) { sgThrow(r.error); return { task: t }; });
  }
  function sgDeleteTask(p) {
    return sb.from('tasks').delete().eq('id', p.id).then(function (r) { sgThrow(r.error); return { id: p.id }; });
  }

  function sgSaveReview(r) {
    if (!r.id) r.id = sgUid();
    var header = { id: r.id, year: r.year || '', month: r.month || '', dept: r.dept || '',
                   member: r.member || '', reviewer: r.reviewer || '', date: r.date || '',
                   remarks: r.remarks || '', sheet_b_link: r.sheetBLink || '', help_needed: r.helpNeeded || '', areas_of_improvement: r.areasOfImprovement || '' };
    return sb.from('reviews').upsert(header, { onConflict: 'id' }).then(function (res) {
      sgThrow(res.error);
      // DATA-SAFETY: only touch items when the caller actually sent an items array.
      // Header-only save (r.items == null) leaves existing scored items intact.
      if (r.items == null) return { review: r };
      var rows = (r.items || []).map(function (it) {
        return { review_id: r.id, goal_item_id: it.goalItemId || '', goal: it.goal || '',
                 weightage: sgNum0(it.weightage), description: it.description || '', cat: it.cat || '',
                 particulars: it.particulars || '',
                 max_score: (it.maxScore == null || it.maxScore === '') ? 0 : Number(it.maxScore),
                 target: it.target || '', actual: it.actual || '', remark: it.remark || '',
                 member_score: sgNum0(it.memberScore), mgr_score: sgNum0(it.mgrScore) };
      });
      return sb.from('review_items').delete().eq('review_id', r.id).then(function (d) {
        sgThrow(d.error);
        if (!rows.length) return { review: r };
        return sb.from('review_items').insert(rows).then(function (ins) { sgThrow(ins.error); return { review: r }; });
      });
    });
  }
  function sgDeleteReview(p) {
    // ON DELETE CASCADE removes review_items automatically.
    return sb.from('reviews').delete().eq('id', p.id).then(function (r) { sgThrow(r.error); return { id: p.id }; });
  }

  // ================= BATCH (mirrors saveBatch_) =================
  var HANDLERS = {
    getAll: function () { return sgGetAll(); },
    addListItem: sgAddListItem, removeListItem: sgRemoveListItem,
    saveMember: sgSaveMember, removeMember: sgRemoveMember,
    saveAdmin: sgSaveAdmin, removeAdmin: sgRemoveAdmin,
    saveGoal: sgSaveGoal, deleteGoal: sgDeleteGoal,
    saveTask: sgSaveTask, deleteTask: sgDeleteTask,
    saveReview: sgSaveReview, deleteReview: sgDeleteReview
  };

  function sgSaveBatch(p) {
    var ops = (p && p.ops) || [];
    // Sequential so ordering matches GAS; each op gets its own ok/error slot.
    var results = [];
    return ops.reduce(function (chain, op) {
      return chain.then(function () {
        op = op || {};
        if (!op.action || op.action === 'getAll' || op.action === 'saveBatch') {
          results.push({ ok: false, error: 'skipped: ' + op.action }); return;
        }
        var h = HANDLERS[op.action];
        if (!h) { results.push({ ok: false, error: 'Unknown action: ' + op.action }); return; }
        return Promise.resolve(h(op.payload || {}))
          .then(function (data) { results.push({ ok: true, data: data }); })
          .catch(function (e) { results.push({ ok: false, error: e && e.message ? e.message : String(e) }); });
      });
    }, Promise.resolve()).then(function () { return { results: results }; });
  }

  // ================= public entry =================
  // Resolves to `data` (already unwrapped) or rejects with an Error, exactly
  // like the promise smartgoal.js's api() expects after it unwraps res.data.
  function sgCall(action, payload) {
    if (action === 'saveBatch') return sgSaveBatch(payload);
    var h = HANDLERS[action];
    if (!h) return Promise.reject(new Error('Unknown action: ' + action));
    try { return Promise.resolve(h(payload || {})); }
    catch (e) { return Promise.reject(e); }
  }

  window.SG_SUPA = { call: sgCall, _client: sb };
})();