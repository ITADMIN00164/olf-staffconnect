/* OLF Forms on a phone: the wide form tables become one card per row.

   Each cell is given its column's name and the stylesheet lays the row out as a
   card. The tables are left as they are, so opening a form, publishing, editing
   and the response lists work exactly as before. Nothing here runs on a laptop. */
(function () {
  "use strict";
  var MQ = window.matchMedia ? window.matchMedia("(max-width: 640px)") : null;
  var pending = false;

  function label() {
    pending = false;
    if (!MQ || !MQ.matches) return;
    Array.prototype.forEach.call(document.querySelectorAll("#page-forms table.frm-grid, #page-forms table.frm-subgrid"), function (t) {
      t.classList.add("m-frm");
      var head = t.querySelector("thead tr");
      if (!head) return;
      var labels = Array.prototype.map.call(head.children, function (th) { return th.textContent.replace(/\s+/g, " ").trim(); });
      Array.prototype.forEach.call(t.querySelectorAll("tbody > tr"), function (tr) {
        if (tr.children.length !== labels.length) return;
        for (var i = 0; i < labels.length; i++) {
          var l = labels[i] || (tr.children[i].classList.contains("frm-grid__rail") ? "" : "Action");
          if (tr.children[i].getAttribute("data-label") !== l) tr.children[i].setAttribute("data-label", l);
        }
      });
    });
  }
  function schedule() {
    if (pending) return;
    pending = true;
    (window.requestAnimationFrame || setTimeout)(function () { setTimeout(label, 60); });
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
