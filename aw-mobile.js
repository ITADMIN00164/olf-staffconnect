/* Awards & Gifts on a phone: wide month-by-column tables become one card per row.

   Utilisations, the Dashboards and the month lists are grids of numbers (a row
   per month, a column per measure). Five or ten columns cannot sit side by side
   on a phone, and sliding sideways to read them is awkward. Here each cell is
   given its column's name (a two-row heading like "Block level / Total events"
   becomes "Block level · Total events"), and the stylesheet lays each row out as
   a card: the month as its title, then every figure with its label.

   The table itself is left exactly as it is, so typing a number, saving a row
   and opening a month work as they always have. Nothing here runs on a laptop. */
(function () {
  "use strict";
  var MQ = window.matchMedia ? window.matchMedia("(max-width: 640px)") : null;
  var TABLES = "#aw-view-event table, #aw-view-evdash table, #aw-view-award table, #aw-view-dash table";
  var pending = false;

  function clean(th) {
    if (!th) return "";
    var c = th.cloneNode(true);
    Array.prototype.forEach.call(c.querySelectorAll("[class*='auto'], [class*='pill'], small, svg, sup"), function (n) { n.remove(); });
    return c.textContent.replace(/[Σ∑]/g, "").replace(/\s+/g, " ").trim();
  }

  // One name for every column position, from a one- or two-row heading.
  function labelsFor(table) {
    var rows = table.querySelectorAll("thead tr");
    if (!rows.length) return null;
    var out = [], i;
    if (rows.length === 1) {
      Array.prototype.forEach.call(rows[0].children, function (th) {
        var n = th.colSpan > 1 ? th.colSpan : 1, t = clean(th);
        for (i = 0; i < n; i++) out.push(t);
      });
    } else {
      var top = rows[0].children, sub = rows[1].children, s = 0;
      Array.prototype.forEach.call(top, function (th) {
        if ((th.rowSpan || 1) > 1) { out.push(clean(th)); return; }       // Month, Save ...
        var group = clean(th), n = th.colSpan > 1 ? th.colSpan : 1;
        for (i = 0; i < n; i++) {
          var name = clean(sub[s++]);
          out.push(group && name ? group + " · " + name : (name || group));
        }
      });
    }
    // a bare "%" column belongs to the figure before it
    for (i = 1; i < out.length; i++) if (out[i] === "%" && out[i - 1]) out[i] = out[i - 1] + " %";
    return out;
  }

  function label() {
    pending = false;
    floatingButton();
    if (!MQ || !MQ.matches) return;
    Array.prototype.forEach.call(document.querySelectorAll(TABLES), function (t) {
      t.classList.add("m-matrix");
      var labels = labelsFor(t);
      if (!labels) return;
      Array.prototype.forEach.call(t.querySelectorAll("tbody tr, tfoot tr"), function (tr) {
        var cells = tr.children;
        if (cells.length !== labels.length) return;                       // a message row, or a shape we do not know
        for (var i = 0; i < cells.length; i++) {
          var l = labels[i];
          if (l && cells[i].getAttribute("data-label") !== l) cells[i].setAttribute("data-label", l);
        }
      });
    });
  }

  /* New requisition as a floating button, on the Requisitions list only. It presses the page's own
     button, so the form opens exactly as it does on a laptop. */
  var fab = null;
  function visible(el) { return !!el && !el.hidden && el.style.display !== "none"; }
  function floatingButton() {
    var show = false;
    if (MQ && MQ.matches) {
      var shell = document.getElementById("appShell");
      var box = document.getElementById("aw-stock-actions"), btn = document.getElementById("new-req-btn");
      var view = document.getElementById("aw-view-stock"), list = document.getElementById("aw-subpanel-requisition");
      show = !!(shell && shell.classList.contains("visible") && visible(box) && btn && !btn.hidden && visible(view) && visible(list));
    }
    if (show && !fab) {
      fab = document.createElement("button");
      fab.type = "button";
      fab.id = "mFab";
      fab.className = "m-fab";
      fab.setAttribute("aria-label", "New requisition");
      fab.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>New requisition</span>';
      fab.addEventListener("click", function () { var b = document.getElementById("new-req-btn"); if (b) b.click(); });
      document.getElementById("appShell").appendChild(fab);
    }
    if (fab) fab.hidden = !show;
  }

  function schedule() {
    if (pending) return;
    pending = true;
    (window.requestAnimationFrame || setTimeout)(function () { setTimeout(label, 80); });
  }
  function start() {
    var area = document.getElementById("pageContent");
    if (!area) { setTimeout(start, 400); return; }
    new MutationObserver(schedule).observe(area, { childList: true, subtree: true });
    if (MQ && MQ.addEventListener) MQ.addEventListener("change", schedule);
    schedule();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
