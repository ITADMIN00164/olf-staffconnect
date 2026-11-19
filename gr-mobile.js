/* GRs & Circulars on a phone: the wide record tables become one card per record.

   The lists (My uploads, Dashboard) and the district grid (Analytics) are far too
   wide to read side by side on a phone. Each cell is given its column's name and
   the stylesheet lays every row out as a card. The tables are left exactly as
   they are, so validating, rejecting, remarks, retry and filters all work as before.

   Nothing here runs on a laptop. */
(function () {
  "use strict";
  var MQ = window.matchMedia ? window.matchMedia("(max-width: 640px)") : null;
  var pending = false;
  function phone() { return !!(MQ && MQ.matches); }

  function labelsOf(table) {
    var row = table.querySelector("thead tr");
    if (!row) return null;
    return Array.prototype.map.call(row.children, function (th) {
      return th.textContent.replace(/\s+/g, " ").trim();
    });
  }

  function label() {
    pending = false;
    if (!phone()) return;
    Array.prototype.forEach.call(document.querySelectorAll("#grPage table.gr-table"), function (t) {
      t.classList.add("m-gr");
      Array.prototype.forEach.call(t.querySelectorAll("tr.gr-filter-row th"), function (th) {   // name each picker
        var c = th.querySelector("[data-col]"), n = c ? c.getAttribute("data-col") : "";
        if (n) { n = n.charAt(0).toUpperCase() + n.slice(1); if (th.getAttribute("data-label") !== n) th.setAttribute("data-label", n); }
      });
      var labels = labelsOf(t);
      if (!labels) return;
      Array.prototype.forEach.call(t.querySelectorAll("tbody tr, tfoot tr"), function (tr) {
        var cells = tr.children;
        if (cells.length !== labels.length) return;                 // "loading" or "nothing here" rows
        for (var i = 0; i < cells.length; i++) {
          var l = labels[i] || "Action";
          if (cells[i].getAttribute("data-label") !== l) cells[i].setAttribute("data-label", l);
        }
        // the row's status, so the card can colour its edge
        var chip = tr.querySelector(".gr-chip--ok, .gr-chip--rej, .gr-chip--pend");
        var s = chip ? (chip.classList.contains("gr-chip--ok") ? "ok" : chip.classList.contains("gr-chip--rej") ? "rej" : "pend") : "";
        if (tr.getAttribute("data-s") !== s) { if (s) tr.setAttribute("data-s", s); else tr.removeAttribute("data-s"); }
      });
      // a "loading" or "empty" message gets a calm card of its own
      Array.prototype.forEach.call(t.querySelectorAll("tbody tr"), function (tr) {
        var td = tr.children[0];
        if (tr.children.length === 1 && td && td.classList.contains("gr-empty-cell")) {
          td.classList.toggle("m-loading", /^\s*loading/i.test(td.textContent));
        }
      });
    });
  }

  function schedule() {
    if (pending) return;
    pending = true;
    (window.requestAnimationFrame || setTimeout)(function () { setTimeout(label, 60); });
  }

  /* The lists load more rows as their own box is scrolled. On a phone the cards flow down the page
     instead, so the page scrolling near the end asks the list for the next set. */
  function wireMore() {
    var area = document.getElementById("pageContent");
    if (!area || area.__grMore) return;
    area.__grMore = true;
    var busy = false;
    area.addEventListener("scroll", function () {
      if (busy || !phone()) return;
      var wrap = document.querySelector("#grPage .gr-panel.active .gr-table-wrap:not(.gr-an-wrap)");
      if (!wrap || wrap.dataset.lazy !== "1") return;
      var r = wrap.getBoundingClientRect();
      if (r.bottom > window.innerHeight + 700) return;              // not near the end of the list yet
      busy = true;
      wrap.dispatchEvent(new Event("scroll"));
      setTimeout(function () { busy = false; }, 250);
    }, { passive: true });
  }

  function start() {
    var area = document.getElementById("pageContent");
    if (!area) { setTimeout(start, 400); return; }
    new MutationObserver(function () { schedule(); wireMore(); }).observe(area, { childList: true, subtree: true });
    if (MQ && MQ.addEventListener) MQ.addEventListener("change", schedule);
    wireMore();
    schedule();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
