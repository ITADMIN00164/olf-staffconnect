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
  var TABLES = "#aw-view-event table, #aw-view-evdash table, #aw-view-award table, #aw-view-dash table, #sg-app table";
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

  var MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  // "Nov-2026", "Nov'26", "Nov 2026" -> true when that is the month we are in
  function isThisMonth(text) {
    var m = /([A-Za-z]{3})[^0-9]*([0-9]{2,4})/.exec(String(text || ""));
    if (!m) return false;
    var mi = MONTHS.indexOf(m[1].toLowerCase()), y = Number(m[2]), now = new Date();
    if (mi < 0) return false;
    if (y < 100) y += 2000;
    return mi === now.getMonth() && y === now.getFullYear();
  }
  function numOf(text) { var n = parseFloat(String(text).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? null : n; }
  function cellBy(tr, re) {
    var cells = tr.children;
    for (var i = 0; i < cells.length; i++) { var l = cells[i].getAttribute("data-label"); if (l && re.test(l)) return cells[i]; }
    return null;
  }
  var NOTHING = /^[\s\u2014\u2013\-]*$/;

  // a stacked bar: on time / late / still to do
  function bar(host, a, b, c) {
    var sum = a + b + c, key = [a, b, c].join("-");
    var el = host.querySelector(".m-abar");
    if (!sum) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement("span");
      el.className = "m-abar";
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = "<i class='g'></i><i class='r'></i><i class='a'></i>";
      host.appendChild(el);
    }
    if (el.getAttribute("data-k") !== key) {
      el.setAttribute("data-k", key);
      el.children[0].style.width = (a / sum * 100) + "%";
      el.children[1].style.width = (b / sum * 100) + "%";
      el.children[2].style.width = (c / sum * 100) + "%";
    }
  }

  // a completion bar for a "% completed" column
  function pbar(host, pct) {
    var el = host.querySelector(".m-pbar");
    if (pct == null || isNaN(pct)) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement("span");
      el.className = "m-pbar";
      el.setAttribute("aria-hidden", "true");
      el.appendChild(document.createElement("i"));
      host.appendChild(el);
    }
    var w = Math.max(0, Math.min(100, pct)) + "%";
    if (el.firstChild.style.width !== w) el.firstChild.style.width = w;
  }

  function decorate(tr, inFoot) {
    var cells = tr.children, first = cells[0];
    if (!first || !first.getAttribute("data-label")) return;
    // loading / read-only emptiness / the month we are in
    var controls = !!tr.querySelector("input, select, textarea, button");
    var quiet = true;
    for (var i = 1; i < cells.length; i++) if (!NOTHING.test(cells[i].textContent)) { quiet = false; break; }
    tr.classList.toggle("m-empty", !inFoot && quiet && !controls && cells.length > 2);
    tr.classList.toggle("m-now", !inFoot && isThisMonth(first.textContent));
    var done = cellBy(tr, /^% *complet/i);
    if (done && !inFoot && !tr.classList.contains("m-empty")) pbar(first, numOf(done.textContent));
    // award bars (Awards list and Awards dashboard)
    var inTime = cellBy(tr, /awarded in time$/i), late = cellBy(tr, /^awarded late$/i), total = cellBy(tr, /^total( awards)?$/i);
    if (inTime && late && total && !tr.classList.contains("m-empty")) {
      var t = numOf(total.textContent), a = numOf(inTime.textContent) || 0, b = numOf(late.textContent) || 0;
      if (t) bar(first, a, b, Math.max(0, t - a - b));
    }
  }

  // the Awards dashboard: its Total row, shown first as one big summary
  function summaryCard(table) {
    var rows = table.querySelectorAll("tbody tr, tfoot tr"), row = null;
    Array.prototype.forEach.call(rows, function (tr) { var f = tr.children[0]; if (f && /^total$/i.test(f.textContent.trim())) row = tr; });
    var host = table.closest(".pom-card") || table.parentNode;
    var card = host.previousElementSibling && host.previousElementSibling.classList.contains("m-sum") ? host.previousElementSibling : null;
    if (!row) { if (card) card.remove(); return; }
    var inTime = cellBy(row, /awarded in time$/i), late = cellBy(row, /^awarded late$/i), total = cellBy(row, /^total( awards)?$/i);
    if (!inTime || !late || !total) return;
    var t = numOf(total.textContent) || 0, a = numOf(inTime.textContent) || 0, b = numOf(late.textContent) || 0, c = Math.max(0, t - a - b);
    if (!t) { if (card) card.remove(); return; }
    row.classList.add("m-covered");
    var key = [t, a, b].join("-");
    if (!card) {
      card = document.createElement("div");
      card.className = "m-sum";
      host.parentNode.insertBefore(card, host);
    }
    if (card.getAttribute("data-k") === key) return;
    card.setAttribute("data-k", key);
    var pct = function (n) { return Math.round(n / t * 100) + "%"; };
    card.innerHTML = '<div class="m-sum-main"><b>' + t.toLocaleString("en-IN") + '</b><span>awards in total</span></div>' +
      '<span class="m-abar"><i class="g" style="width:' + (a / t * 100) + '%"></i><i class="r" style="width:' + (b / t * 100) + '%"></i><i class="a" style="width:' + (c / t * 100) + '%"></i></span>' +
      '<div class="m-sum-key"><span><i class="g"></i><b>' + a.toLocaleString("en-IN") + '</b> on time <em>' + pct(a) + '</em></span>' +
      '<span><i class="r"></i><b>' + b.toLocaleString("en-IN") + '</b> late <em>' + pct(b) + '</em></span>' +
      '<span><i class="a"></i><b>' + c.toLocaleString("en-IN") + '</b> to do <em>' + pct(c) + '</em></span></div>';
  }

  function label() {
    pending = false;
    wirePull();
    floatingButton();
    if (!MQ || !MQ.matches) return;
    Array.prototype.forEach.call(document.querySelectorAll(TABLES), function (t) {
      t.classList.add("m-matrix");
      var labels = labelsFor(t);
      if (!labels) return;
      Array.prototype.forEach.call(t.querySelectorAll("tbody tr, tfoot tr"), function (tr) {
        var cells = tr.children;
        if (cells.length === 1 && cells[0].classList.contains("pom-msg")) {   // a message: loading gets soft placeholders
          cells[0].classList.toggle("m-loading", /^loading/i.test(cells[0].textContent.trim()));
          return;
        }
        if (cells.length !== labels.length) return;                       // a shape we do not know
        for (var i = 0; i < cells.length; i++) {
          var l = labels[i];
          if (l && cells[i].getAttribute("data-label") !== l) cells[i].setAttribute("data-label", l);
        }
        for (var j = 1; j < cells.length; j++) {
          if (labels[j] && / %$/.test(labels[j])) {
            if (cells[j - 1].getAttribute("data-pct") !== cells[j].textContent.trim()) cells[j - 1].setAttribute("data-pct", cells[j].textContent.trim());
            cells[j].classList.add("m-merged");
          }
        }
        decorate(tr, tr.parentNode.tagName === "TFOOT");
      });
      if (t.closest("#aw-view-dash")) summaryCard(t);
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

  /* Pull down at the top of the page to reload it, as in a phone app. It presses the page's own
     refresh button, so the right tab's data is what reloads. */
  var ptr = null, ptrY = 0, ptrDy = 0, ptrOn = false;
  function refreshButton() {
    var a = document.getElementById("aw-refresh-all"), b = document.getElementById("refresh-btn"), c = document.getElementById("sg-refresh-btn") || document.getElementById("grRefreshAll");
    if (a && a.offsetParent !== null) return a;
    if (b && b.offsetParent !== null) return b;
    if (c && c.offsetParent !== null) return c;
    return null;
  }
  function ptrBadge() {
    if (ptr) return ptr;
    ptr = document.createElement("div");
    ptr.className = "m-ptr";
    ptr.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/></svg>';
    document.getElementById("appShell").appendChild(ptr);
    return ptr;
  }
  function wirePull() {
    var area = document.getElementById("pageContent");
    if (!area || area.__mPull) return;
    area.__mPull = true;
    area.addEventListener("touchstart", function (e) {
      ptrOn = !!(MQ && MQ.matches && area.scrollTop <= 0 && area.querySelector(".award-page, #sg-app, #grPage") && e.touches.length === 1 && refreshButton());
      ptrY = e.touches[0].clientY; ptrDy = 0;
    }, { passive: true });
    area.addEventListener("touchmove", function (e) {
      if (!ptrOn) return;
      ptrDy = e.touches[0].clientY - ptrY;
      if (ptrDy <= 0 || area.scrollTop > 0) { ptrBadge().classList.remove("is-pulling"); return; }
      var d = Math.min(ptrDy * 0.5, 64), b = ptrBadge();
      b.classList.add("is-pulling");
      b.style.setProperty("--d", d + "px");
      b.classList.toggle("is-ready", ptrDy > 120);
    }, { passive: true });
    area.addEventListener("touchend", function () {
      if (!ptrOn) return;
      ptrOn = false;
      var b = ptrBadge(), go = ptrDy > 120;
      b.classList.remove("is-pulling", "is-ready");
      b.style.removeProperty("--d");
      if (go) {
        var btn = refreshButton();
        if (btn) {
          b.classList.add("is-busy");
          btn.click();
          setTimeout(function () { b.classList.remove("is-busy"); }, 1100);
        }
      }
    }, { passive: true });
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
