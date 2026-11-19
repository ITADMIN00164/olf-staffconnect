/* OLF Insight on a phone.

   1. The Field Staff Directory (a table of eight columns) becomes one card per person. Its column
      pickers fold behind a "Filters" button that shows how many are in use.
   2. The simpler tables in Historical Data become cards the same way. The very wide "raw sheet"
      grids stay as scrolling sheets, which is what they are.
   3. A flowchart opens with its first card in view instead of a blank stretch of the canvas.

   The tables and charts are left as they are, so filters, sorting, opening a person and exporting
   work exactly as before. Nothing here runs on a laptop. */
(function () {
  "use strict";
  var MQ = window.matchMedia ? window.matchMedia("(max-width: 640px)") : null;
  var pending = false, filtersOpen = false;
  function phone() { return !!(MQ && MQ.matches); }

  /* ---- 1. staff directory */
  var DIR = ["Name", "Role", "Division", "District", "Manager", "Review", "Score", "Rating"];

  function directory() {
    var t = document.getElementById("tpProgTable");
    if (!t) return;
    t.classList.add("m-dir");
    Array.prototype.forEach.call(t.querySelectorAll("tbody tr"), function (tr) {
      if (tr.children.length !== DIR.length) return;
      for (var i = 0; i < DIR.length; i++) if (tr.children[i].getAttribute("data-label") !== DIR[i]) tr.children[i].setAttribute("data-label", DIR[i]);
    });
    var row = t.querySelector("tr.tp-table-filter-row");
    if (!row) return;
    Array.prototype.forEach.call(row.children, function (th, i) {
      var sel = th.querySelector("select"), n = "Search";
      if (sel && sel.options.length) n = sel.options[0].textContent.replace(/\s*\(all\)\s*/i, "").trim();
      if (th.getAttribute("data-label") !== n) th.setAttribute("data-label", n);
    });
    var wrap = t.closest(".tp-prog-tbl-wrap");
    if (!wrap) return;
    var btn = wrap.previousElementSibling;
    if (!btn || !btn.classList.contains("m-filter-btn")) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "m-filter-btn";
      btn.innerHTML = '<span>Filters</span><b hidden></b>';
      wrap.parentNode.insertBefore(btn, wrap);
      btn.addEventListener("click", function () {
        filtersOpen = !filtersOpen;
        var w = btn.nextElementSibling;
        if (w) w.classList.toggle("m-open", filtersOpen);
        btn.classList.toggle("is-open", filtersOpen);
      });
    }
    wrap.classList.toggle("m-open", filtersOpen);
    btn.classList.toggle("is-open", filtersOpen);
    var active = row.querySelectorAll("select.active").length + (row.querySelector("input") && row.querySelector("input").value ? 1 : 0);
    var b = btn.querySelector("b");
    b.hidden = !active;
    if (active) b.textContent = active;
  }

  /* ---- 2. simple tables in Historical Data */
  function history() {
    Array.prototype.forEach.call(document.querySelectorAll("#tpHistoricalView table.tp-hist-table"), function (t) {
      if (t.classList.contains("tp-hist-table-raw") || t.classList.contains("tp-hist-table-modal")) return;
      var heads = t.querySelectorAll("thead tr");
      if (heads.length !== 1) return;                               // a two-row heading stays a sheet
      var labels = Array.prototype.map.call(heads[0].children, function (th) { return th.textContent.replace(/\s+/g, " ").trim(); });
      if (labels.length < 3 || labels.length > 16) return;
      labels = labels.map(function (l) { return l.replace(/^(\S+) \(Pass %\)$/, "Pass $1"); });
      t.classList.add("m-hist");
      t.classList.toggle("m-hist-wide", labels.length > 12);
      Array.prototype.forEach.call(t.querySelectorAll("tbody tr"), function (tr) {
        if (tr.children.length !== labels.length) return;
        for (var i = 0; i < labels.length; i++) if (tr.children[i].getAttribute("data-label") !== labels[i]) tr.children[i].setAttribute("data-label", labels[i]);
      });
    });
  }

  /* ---- 3. flowcharts open at their first card */
  var seen = {};
  function charts() {
    ["tpProgViewport", "tpViewport"].forEach(function (id) {
      var vp = document.getElementById(id);
      if (!vp || vp.offsetParent === null) { seen[id] = ""; return; }
      var node = vp.querySelector(".tp-node, .tp-division-card, .tp-card, [class*='tp-node']");
      if (!node) return;
      var key = vp.querySelectorAll("*").length + ":" + (node.textContent || "").slice(0, 40);
      if (seen[id] === key) return;
      seen[id] = key;
      var vr = vp.getBoundingClientRect(), nr = node.getBoundingClientRect();
      vp.scrollTop = Math.max(0, vp.scrollTop + (nr.top - vr.top) - 16);
      vp.scrollLeft = Math.max(0, vp.scrollLeft + (nr.left - vr.left) - 16);
    });
  }

  function run() {
    pending = false;
    if (!phone()) return;
    directory();
    history();
    charts();
  }
  function schedule() {
    if (pending) return;
    pending = true;
    (window.requestAnimationFrame || setTimeout)(function () { setTimeout(run, 90); });
  }
  function start() {
    var area = document.getElementById("pageContent");
    if (!area) { setTimeout(start, 400); return; }
    new MutationObserver(schedule).observe(area, { childList: true, subtree: true });
    if (MQ && MQ.addEventListener) MQ.addEventListener("change", schedule);
    area.addEventListener("input", schedule, true);
    area.addEventListener("change", schedule, true);
    schedule();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
