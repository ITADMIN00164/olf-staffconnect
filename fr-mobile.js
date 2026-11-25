/* Field Review on a phone - the touches that make it feel like an app.
   Nothing here runs on a laptop. It only reads and decorates what the review
   screens already draw, so saving and loading work exactly as before.

   1. The pickers fold into one line ("PO · Aapparao S Rajle · September 2026 - Change")
      once a review is open, so the review itself gets the screen.
   2. Each section you fill in shows how far along it is (2/3, done).
   3. The Save bar appears only when there is something to save.
   4. Summary cards get a bar showing done / partly done / not done at a glance.
   5. Switching week or view eases in. */
(function () {
  "use strict";
  var MQ = window.matchMedia ? window.matchMedia("(max-width: 640px)") : null;
  var pending = false;
  function phone() { return !!(MQ && MQ.matches); }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ------------------------------------------------ 1. pickers fold into a context line */
  var VIEWS = [["prWeekly", "prBody"], ["prSummary", "prSumBody"], ["prMonthly", "prMoBody"], ["prMosum", "prMsBody"],
               ["prQuarterly", "prQBody"], ["prYearly", "prYBody"], ["prWholeyear", "prFBody"]];

  function hasResult(body) {
    var el = $(body);
    if (!el || !el.children.length) return false;
    // a lone prompt, "loading" or error message is not a result
    return !(el.children.length === 1 && el.children[0].classList.contains("pr-empty"));
  }

  function ctxText(filters) {
    var parts = [];
    Array.prototype.forEach.call(filters.querySelectorAll(".pr-field"), function (f) {
      var t = "", sel = f.querySelector("select"), btn = f.querySelector(".pr-ms-btn");
      if (sel && !sel.disabled && sel.value !== "") { var o = sel.options[sel.selectedIndex]; t = o ? o.textContent.trim() : ""; }
      else if (btn && !btn.disabled) t = btn.textContent.trim();
      if (t && !/^(—|-|select)/i.test(t)) parts.push(t);
    });
    return parts.join(" · ");
  }

  function contextLines() {
    VIEWS.forEach(function (v) {
      var view = $(v[0]);
      var filters = view && view.querySelector(".pr-filters");
      if (!filters) return;
      var ctx = filters.previousElementSibling;
      if (!ctx || !ctx.classList.contains("m-ctx")) {
        ctx = document.createElement("button");
        ctx.type = "button";
        ctx.className = "m-ctx";
        ctx.setAttribute("aria-expanded", "true");
        ctx.innerHTML = '<span class="m-ctx-ico" aria-hidden="true"></span><span class="m-ctx-text"><small>Showing</small><b></b></span><span class="m-ctx-go">Change</span>';
        filters.parentNode.insertBefore(ctx, filters);
        ctx.addEventListener("click", function () {
          var closed = filters.classList.toggle("m-ctx-closed");
          ctx.setAttribute("aria-expanded", closed ? "false" : "true");
          ctx.classList.toggle("is-open", !closed);
        });
      }
      var has = hasResult(v[1]);
      if (has && !ctx.__had) {                       // a review has just opened: fold the pickers away
        filters.classList.add("m-ctx-closed");
        ctx.setAttribute("aria-expanded", "false");
        ctx.classList.remove("is-open");
      }
      if (!has) {                                    // nothing open yet: the pickers are the page
        filters.classList.remove("m-ctx-closed");
        ctx.setAttribute("aria-expanded", "true");
        ctx.classList.add("is-open");
      }
      ctx.__had = has;
      ctx.hidden = !has;                             // no line until there is something to be showing
      var b = ctx.querySelector("b"), txt = ctxText(filters) || "Your selection";
      if (b.textContent !== txt) b.textContent = txt;
    });
  }

  /* ------------------------------------------------ 2. how far along each section is */
  function cellEditable(c) { return !!c.querySelector(".pr-seg, .pr-iconbtn, select, textarea"); }
  function cellFilled(c) {
    if (c.querySelector(".pr-segbtn.is-on")) return true;
    if (c.querySelector(".pr-iconbtn.has-val")) return true;
    var s = c.querySelector("select"); if (s && s.value) return true;
    var t = c.querySelector("textarea"); if (t && t.value) return true;
    return false;
  }
  function sectionProgress() {
    Array.prototype.forEach.call(document.querySelectorAll("#prBody tr.pr-grp[data-grp], #prMoBody tr.pr-grp[data-grp]"), function (g) {
      var key = g.getAttribute("data-grp"), total = 0, done = 0;
      var rows = g.parentNode.querySelectorAll('tr.pr-row[data-secrow="' + key + '"]');
      Array.prototype.forEach.call(rows, function (r) {
        var cell = r.querySelector("td.pr-wkc:not(.pr-wkhide)") || r.querySelector('td[colspan="5"]');
        if (!cell || !cellEditable(cell)) return;
        total++;
        if (cellFilled(cell)) done++;
      });
      var chip = g.querySelector(".m-prog");
      if (!total) { if (chip) chip.remove(); return; }
      if (!chip) {
        chip = document.createElement("span");
        chip.className = "m-prog";
        chip.appendChild(document.createTextNode(""));
        g.firstElementChild.appendChild(chip);
      }
      var label = done === total ? "Done" : done + "/" + total;
      if (chip.firstChild.nodeValue !== label) chip.firstChild.nodeValue = label;
      var cls = "m-prog " + (done === total ? "is-done" : done ? "is-part" : "is-none");
      if (chip.className !== cls) chip.className = cls;
    });
  }

  /* ------------------------------------------------ 3. Save shows only when there is something to save */
  // pos-review.js announces every change it records ("pr-dirty"), so Save shows exactly when it should,
  // whatever kind of control was used (buttons, boxes, lists, notes, the monthly figures).
  function showSave() {
    if (!phone()) return;
    Array.prototype.forEach.call(document.querySelectorAll("#prBody .pr-savebar, #prMoBody .pr-savebar, #prQBody .pr-savebar, #prFBody .pr-savebar"), function (bar) {
      if (bar.classList.contains("is-dirty")) return;
      bar.classList.add("is-dirty");
      var hint = bar.querySelector(".pr-savehint");
      if (hint && !hint.classList.contains("is-fail")) hint.textContent = "You have changes that are not saved yet.";
    });
  }
  window.addEventListener("pr-dirty", showSave);

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var pick = t.closest(".pr-wkpick");           // a different week: the list eases in
    if (pick) {
      var wrap = document.querySelector("#prBody .pr-tablewrap");
      if (wrap) { wrap.classList.remove("m-swap"); void wrap.offsetWidth; wrap.classList.add("m-swap"); }
    }
    schedule();
  }, true);
  document.addEventListener("change", function () { schedule(); }, true);

  /* ------------------------------------------------ 4. summary cards: a bar for done / partly / not */
  function summaryBars() {
    Array.prototype.forEach.call(document.querySelectorAll("#prSumBody .pr-sum-tbl tr.pr-row"), function (tr) {
      var d = tr.querySelectorAll("button.pr-sum-drill");
      var item = tr.querySelector("td.pr-item");
      if (d.length !== 3 || !item) return;
      var n = Array.prototype.map.call(d, function (b) { return parseInt(String(b.textContent).replace(/[^0-9]/g, ""), 10) || 0; });
      var sum = n[0] + n[1] + n[2];
      var bar = item.querySelector(".m-bar");
      if (!sum) { if (bar) bar.remove(); return; }
      var key = n.join("-");
      if (!bar) {
        bar = document.createElement("div");
        bar.className = "m-bar";
        bar.innerHTML = "<i class='g'></i><i class='a'></i><i class='n'></i>";
        item.appendChild(bar);
      }
      if (bar.getAttribute("data-k") !== key) {
        bar.setAttribute("data-k", key);
        var s = bar.children;
        s[0].style.width = (n[0] / sum * 100) + "%";
        s[1].style.width = (n[1] / sum * 100) + "%";
        s[2].style.width = (n[2] / sum * 100) + "%";
      }
    });
  }

  /* ------------------------------------------------ running it */
  function run() {
    pending = false;
    if (!phone()) return;
    contextLines();
    sectionProgress();
    summaryBars();
  }
  function schedule() {
    if (pending) return;
    pending = true;
    (window.requestAnimationFrame || setTimeout)(function () { setTimeout(run, 80); });
  }
  function start() {
    var area = $("pageContent");
    if (!area) { setTimeout(start, 400); return; }
    new MutationObserver(schedule).observe(area, { childList: true, subtree: true });
    if (MQ && MQ.addEventListener) MQ.addEventListener("change", schedule);
    schedule();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
