/* Phone helpers. Nothing here does anything on a laptop.

   1. A table wider than the screen gets a box of its own to scroll sideways in,
      instead of pushing the whole page wider.
   2. Long lists (requisitions, Head Office's queue) become a slim list on a phone:
      a few lines per item, and a tap opens the rest in a sheet from the bottom. */
(function () {
  "use strict";
  var MQ = window.matchMedia ? window.matchMedia("(max-width: 768px)") : null;
  var MQ_PHONE = window.matchMedia ? window.matchMedia("(max-width: 640px)") : null;
  var pending = false;

  /* ------------------------------------------------ 1. wide tables scroll */
  function scrollsAlready(el) {
    for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (p.classList.contains("m-scroll")) return true;
      var ox = getComputedStyle(p).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
    return false;
  }

  function wrapWide() {
    if (!MQ || !MQ.matches) return;
    var area = document.querySelector(".content-area");
    if (!area) return;
    Array.prototype.forEach.call(area.querySelectorAll("table"), function (t) {
      if (t.closest(".m-scroll") || !t.parentElement) return;
      if (t.offsetParent === null) return;                       // not showing
      if (t.closest(".m-list")) return;                          // shown as a list instead
      var parent = t.parentElement;
      if (t.scrollWidth <= parent.clientWidth + 1) return;         // fits
      if (scrollsAlready(t)) return;
      var box = document.createElement("div");
      box.className = "m-scroll";
      parent.insertBefore(box, t);
      box.appendChild(t);
    });
  }

  /* ------------------------------------------------ 2. slim lists + sheet */
  var LISTS = [
    { table: "#requisitions-table", title: "District", sub: "Requester", chip: "Status" },
    { table: "#delivery-table",     title: "District", sub: "Requester", chip: "Status" }
  ];

  // Each cell learns its column name, so CSS can pick cells and the sheet can label them.
  function labelLists() {
    LISTS.forEach(function (cfg) {
      var t = document.querySelector(cfg.table);
      if (!t) return;
      t.classList.add("m-list");
      var heads = Array.prototype.map.call(t.querySelectorAll("thead th"), function (th) { return th.textContent.trim(); });
      Array.prototype.forEach.call(t.querySelectorAll("tbody tr"), function (tr) {
        if (tr.classList.contains("placeholder-row")) return;
        Array.prototype.forEach.call(tr.children, function (td, i) {
          if (heads[i] && td.getAttribute("data-label") !== heads[i]) td.setAttribute("data-label", heads[i]);
        });
      });
    });
  }

  /* The Requisitions filters sit behind one button on a phone; it says how many are on. */
  function activeFilters(box) {
    var n = 0;
    Array.prototype.forEach.call(box.querySelectorAll("select, input"), function (c) {
      if (c.value && String(c.value).trim() !== "") n++;
    });
    return n;
  }
  function paintFilterBtn(box, btn) {
    var n = activeFilters(box), c = btn.querySelector(".m-fb-count");
    c.textContent = n;
    c.hidden = !n;
  }
  function filterToggles() {
    Array.prototype.forEach.call(document.querySelectorAll("#aw-subpanel-requisition .filters"), function (box) {
      if (box.previousElementSibling && box.previousElementSibling.classList.contains("m-filter-btn")) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "m-filter-btn";
      btn.setAttribute("aria-expanded", "false");
      btn.innerHTML = '<span>Filters<span class="m-fb-count" hidden>0</span></span><span class="m-fb-caret" aria-hidden="true"></span>';
      box.parentNode.insertBefore(btn, box);
      box.classList.add("m-collapsed");
      btn.addEventListener("click", function () {
        var open = box.classList.toggle("m-collapsed") === false;
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
      var upd = function () { paintFilterBtn(box, btn); };
      box.addEventListener("change", upd);
      box.addEventListener("input", upd);
      upd();
    });
  }

  /* The month breakdown is a matrix (what, then each gift under four groups). On a
     phone it is read out as short lists instead: one card per line of the table. */
  var EMPTY_CELL = /^[\s\u2013\u2014-]*$/;
  function detailCards() {
    var t = document.getElementById("detail-table");
    if (!t) return;
    var sig = String(t.innerHTML.length) + ":" + t.querySelectorAll("tbody tr").length;
    var holder = t.parentNode.querySelector(".m-detail");
    if (holder && holder.getAttribute("data-sig") === sig) return;

    var headRows = t.querySelectorAll("thead tr");
    if (headRows.length < 2) return;
    var groups = [];
    Array.prototype.forEach.call(headRows[0].children, function (th, i) {
      if (th.hasAttribute("rowspan")) return;                   // the "What" column
      groups.push({ name: th.textContent.trim(), span: parseInt(th.getAttribute("colspan") || "1", 10) });
    });
    var types = Array.prototype.map.call(headRows[1].children, function (th) { return th.textContent.trim(); });
    var cols = [], k = 0;
    groups.forEach(function (g) {
      for (var j = 0; j < g.span; j++) cols.push({ group: g.name, type: types[k++] || "" });
    });

    var html = "";
    Array.prototype.forEach.call(t.querySelectorAll("tbody tr"), function (tr) {
      var cells = tr.children;
      var first = cells[0];
      var lines = (first ? first.innerHTML : "");
      var body = "", lastGroup = null, any = false;
      for (var i = 1; i < cells.length; i++) {
        var c = cols[i - 1];
        var txt = cells[i].textContent.trim();
        if (!c || EMPTY_CELL.test(txt)) continue;
        if (c.group !== lastGroup) { body += '<div class="m-dgrp">' + esc(c.group) + "</div>"; lastGroup = c.group; }
        body += '<div class="m-drow"><span>' + esc(c.type) + "</span><b>" + esc(txt) + "</b></div>";
        any = true;
      }
      html += '<div class="m-dcard' + (tr.classList.contains("is-month") || tr.classList.contains("is-total") ? " is-month" : "") + '">' +
        '<div class="m-dtitle">' + lines + "</div>" + (any ? body : '<div class="m-dempty">Nothing recorded</div>') + "</div>";
    });

    if (!holder) {
      holder = document.createElement("div");
      holder.className = "m-detail";
      t.parentNode.insertBefore(holder, t);
    }
    holder.innerHTML = html;
    holder.setAttribute("data-sig", sig);
  }

  // Field Review's list tables (summary and the pop-up lists): each cell learns its column name
  function labelPrTables() {
    Array.prototype.forEach.call(document.querySelectorAll("#prSumBody table, .pr-list-body table"), function (t) {
      var heads = Array.prototype.map.call(t.querySelectorAll("thead th"), function (th) { return th.textContent.trim(); });
      if (!heads.length) return;
      Array.prototype.forEach.call(t.querySelectorAll("tbody tr"), function (tr) {
        Array.prototype.forEach.call(tr.children, function (td, i) {
          if (heads[i] && td.getAttribute("data-label") !== heads[i]) td.setAttribute("data-label", heads[i]);
        });
      });
    });
  }

  function closeSheet() {
    Array.prototype.forEach.call(document.querySelectorAll(".m-sheet-overlay"), function (n) { n.remove(); });
    document.removeEventListener("keydown", sheetKey);
  }
  function sheetKey(e) { if (e.key === "Escape") closeSheet(); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function openSheet(tr, cfg) {
    closeSheet();
    var cells = {};
    Array.prototype.forEach.call(tr.children, function (td) { if (td.getAttribute("data-label")) cells[td.getAttribute("data-label")] = td; });
    var title = cells[cfg.title] ? cells[cfg.title].textContent.trim() : "Details";
    var sub = cells[cfg.sub] ? cells[cfg.sub].textContent.trim() : "";
    var chip = cells[cfg.chip] ? cells[cfg.chip].innerHTML : "";

    var origButtons = Array.prototype.slice.call(tr.querySelectorAll("button"));
    var bi = 0;
    var rows = Array.prototype.map.call(tr.children, function (td) {
      var label = td.getAttribute("data-label");
      if (!label || label === cfg.title || label === cfg.sub || label === cfg.chip) return "";
      var html = td.innerHTML.replace(/<button\b/g, function () { return '<button data-m-btn="' + (bi++) + '"'; });
      return '<div class="m-sheet-row"><span>' + esc(label) + "</span><div>" + html + "</div></div>";
    }).join("");

    var wrap = document.createElement("div");
    wrap.className = "m-sheet-overlay";
    wrap.innerHTML =
      '<div class="m-sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
        '<div class="m-sheet-grab"></div>' +
        '<div class="m-sheet-head"><div class="m-sheet-title"><div class="m-sheet-name">' + esc(title) + "</div>" +
          (sub ? '<div class="m-sheet-sub">' + esc(sub) + "</div>" : "") +
          (chip ? '<div class="m-sheet-chip">' + chip + "</div>" : "") +
        '</div><button type="button" class="m-sheet-x" aria-label="Close">✕</button></div>' +
        '<div class="m-sheet-body">' + rows + "</div>" +
      "</div>";
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap || e.target.closest(".m-sheet-x")) return closeSheet();
      var b = e.target.closest("button[data-m-btn]");
      if (b) {                                   // a button inside the sheet does what the one in the row does
        var orig = origButtons[+b.getAttribute("data-m-btn")];
        closeSheet();
        if (orig) orig.click();
      }
    });
    (document.querySelector(".award-page") || document.body).appendChild(wrap);   // inside the page, so the page's chip and button styles apply
    document.addEventListener("keydown", sheetKey);
  }

  document.addEventListener("click", function (e) {
    if (!MQ_PHONE || !MQ_PHONE.matches) return;
    var tr = e.target.closest && e.target.closest(".m-list tbody tr");
    if (!tr || tr.classList.contains("placeholder-row") || tr.classList.contains("needs-me")) return;
    if (e.target.closest("button, a, input, select, textarea, label")) return;
    var cfg = null;
    LISTS.forEach(function (c) { if (tr.closest(c.table)) cfg = c; });
    if (cfg) openSheet(tr, cfg);
  });

  /* ------------------------------------------------ 3. bottom navigation
     On a phone the side menu is replaced by a bar along the bottom: one icon for
     every page the person can open, sliding sideways. The page you are on shows its
     name beside its icon. The bar is built from the side menu's own buttons, so who
     can see what, locks and the page you are on all stay exactly as they are there. */
  var NAV_FIRST = ["home", "award-management", "calendar", "employees"];
  var NAV_LABEL = {
    "home": "Home", "employees": "Employees", "er-dashboards": "Dashboards", "award-management": "Awards & Gifts",
    "calendar": "Calendar", "smart-goals": "HO Plan", "pos": "Field Review", "gr": "GRs", "forms": "Forms",
    "pom": "Old POM", "team-performance": "Insight"
  };
  var navBar = null, navScroll = null, navSig = "", navLearned = false, navNudged = false;

  function navSource() {
    return Array.prototype.filter.call(document.querySelectorAll("#appSidebar .sidebar-nav .nav-item[data-page]"), function (b) {
      // Pages that are switched off for people (closed to everyone but IT Admin) are not offered on a phone,
      // and neither is anything the side menu itself does not show.
      if (b.hidden || b.closest("[hidden]")) return false;
      if (b.classList.contains("nav-item--locked-hidden") || b.classList.contains("nav-item--locked") || b.classList.contains("nav-item--locked-admin")) return false;
      return getComputedStyle(b).display !== "none";
    });
  }

  function ensureNav() {
    if (navBar) return;
    var shell = document.getElementById("appShell");
    if (!shell) return;
    navBar = document.createElement("nav");
    navBar.className = "m-nav";
    navBar.setAttribute("aria-label", "Pages");
    var chev = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
    navBar.innerHTML =
      '<button type="button" class="m-nav-arrow m-nav-arrow--l" aria-label="Show pages to the left" hidden>' + chev + "</button>" +
      '<div class="m-nav-scroll"></div>' +
      '<button type="button" class="m-nav-arrow m-nav-arrow--r" aria-label="Show more pages" hidden>' + chev + "</button>" +
      '<div class="m-nav-track" aria-hidden="true"><span class="m-nav-thumb"></span></div>';
    shell.appendChild(navBar);
    navScroll = navBar.querySelector(".m-nav-scroll");
    navScroll.addEventListener("scroll", paintNavEdges, { passive: true });
    // Once the person has scrolled, touched or used an arrow, they know it slides: the hints calm down.
    var learned = function () { navLearned = true; navBar.classList.add("is-learned"); };
    navScroll.addEventListener("touchstart", learned, { passive: true });
    navScroll.addEventListener("pointerdown", learned, { passive: true });
    navBar.querySelector(".m-nav-arrow--l").addEventListener("click", function () { learned(); navScroll.scrollBy({ left: -navScroll.clientWidth * 0.7, behavior: "smooth" }); });
    navBar.querySelector(".m-nav-arrow--r").addEventListener("click", function () { learned(); navScroll.scrollBy({ left: navScroll.clientWidth * 0.7, behavior: "smooth" }); });
    navScroll.addEventListener("click", function (e) {
      var b = e.target.closest(".m-nav-item");
      if (!b) return;
      var src = document.querySelector('#appSidebar .nav-item[data-page="' + b.getAttribute("data-page") + '"]');
      if (src) src.click();
    });
  }

  function paintNavEdges() {
    if (!navScroll) return;
    var max = navScroll.scrollWidth - navScroll.clientWidth;
    var left = navScroll.scrollLeft > 6, right = navScroll.scrollLeft < max - 6;
    navBar.classList.toggle("can-left", left);
    navBar.classList.toggle("can-right", right);
    navBar.classList.toggle("m-nav--scrolls", max > 8);
    navBar.querySelector(".m-nav-arrow--l").hidden = !left;
    navBar.querySelector(".m-nav-arrow--r").hidden = !right;
    // where you are along the bar, and how much of it you are looking at
    var thumb = navBar.querySelector(".m-nav-thumb");
    if (thumb && max > 8) {
      var w = Math.max(18, (navScroll.clientWidth / navScroll.scrollWidth) * 100);
      thumb.style.width = w + "%";
      thumb.style.left = ((navScroll.scrollLeft / max) * (100 - w)) + "%";
    }
  }

  /* A hint the first time the bar shows in a visit: it slides along a little and comes back,
     so it is clear that it moves. Skipped when the person has asked for less motion, or has
     already touched the bar. */
  function nudgeNav() {
    if (navNudged || navLearned || !navScroll) return;
    var max = navScroll.scrollWidth - navScroll.clientWidth;
    if (max < 40) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try { if (sessionStorage.getItem("olf-nav-nudged") === "1") { navNudged = true; return; } } catch (e) { /* fine */ }
    navNudged = true;
    try { sessionStorage.setItem("olf-nav-nudged", "1"); } catch (e) { /* fine */ }
    var home = navScroll.scrollLeft;
    setTimeout(function () {
      if (navLearned) return;
      navScroll.scrollTo({ left: Math.min(max, home + 90), behavior: "smooth" });
      setTimeout(function () { if (!navLearned) navScroll.scrollTo({ left: home, behavior: "smooth" }); }, 750);
    }, 1400);
  }

  function buildBottomNav() {
    ensureNav();
    if (!navBar) return;
    var items = navSource();
    var order = [];
    NAV_FIRST.forEach(function (p) { items.forEach(function (b) { if (b.getAttribute("data-page") === p) order.push(b); }); });
    items.forEach(function (b) { if (order.indexOf(b) < 0) order.push(b); });

    // Rebuild only when the set of pages has changed. When only the page you are on changes,
    // the same buttons stay and just swap their state, so the pill glides across smoothly.
    var sig = order.map(function (b) {
      return b.getAttribute("data-page") + (b.classList.contains("nav-item--locked-admin") ? "L" : "");
    }).join("|");
    var activeNow = "";
    order.forEach(function (b) { if (b.classList.contains("active")) activeNow = b.getAttribute("data-page"); });
    if (sig === navSig) {
      var moved = false;
      Array.prototype.forEach.call(navScroll.querySelectorAll(".m-nav-item"), function (el) {
        var on = el.getAttribute("data-page") === activeNow;
        if (on !== el.classList.contains("is-active")) moved = true;
        el.classList.toggle("is-active", on);
        if (on) el.setAttribute("aria-current", "page"); else el.removeAttribute("aria-current");
      });
      if (moved) centreActive();
      return;
    }
    navSig = sig;

    navScroll.innerHTML = order.map(function (b) {
      var page = b.getAttribute("data-page");
      var label = NAV_LABEL[page] || (b.getAttribute("title") || page);
      var icon = b.querySelector(".icon");
      var color = (getComputedStyle(b).getPropertyValue("--pg") || "").trim() || "#2F6FE4";
      var active = b.classList.contains("active");
      return '<button type="button" class="m-nav-item' + (active ? " is-active" : "") +
        (b.classList.contains("nav-item--locked-admin") ? " is-locked" : "") + '" data-page="' + esc(page) + '"' +
        ' style="--pg:' + esc(color) + '" aria-label="' + esc(label) + '"' + (active ? ' aria-current="page"' : "") + ">" +
        '<span class="m-nav-ico">' + (icon ? icon.innerHTML : "") + "</span>" +
        '<span class="m-nav-label">' + esc(label) + "</span></button>";
    }).join("");

    centreActive();
    setTimeout(paintNavEdges, 120);
    setTimeout(nudgeNav, 400);
  }

  // Bring the page you are on into view, in the middle of the bar (after its pill has grown).
  function centreActive() {
    var go = function () {
      var on = navScroll && navScroll.querySelector(".is-active");
      if (!on) return;
      var box = navScroll.getBoundingClientRect(), it = on.getBoundingClientRect();
      var delta = (it.left + it.width / 2) - (box.left + box.width / 2);
      if (Math.abs(delta) > 4) navScroll.scrollTo({ left: Math.max(0, navScroll.scrollLeft + delta), behavior: "smooth" });
    };
    setTimeout(go, 120);
    setTimeout(go, 520);          // again once the pill has finished growing
  }

  function watchSideMenu() {
    var side = document.querySelector("#appSidebar .sidebar-nav");
    if (!side || side.__mNavWatched) return;
    side.__mNavWatched = true;
    new MutationObserver(function () { buildBottomNav(); })
      .observe(side, { attributes: true, subtree: true, childList: true, attributeFilter: ["class", "hidden"] });
  }

  /* ------------------------------------------------ 4. theme on a phone
     The header shows only the current theme (light, dark or system); a tap
     moves to the next one. On a laptop all three show as before. */
  document.addEventListener("click", function (e) {
    if (!MQ || !MQ.matches) return;
    var on = e.target.closest && e.target.closest("#appShell .theme-switch button[aria-checked='true']");
    if (!on) return;
    var all = Array.prototype.slice.call(on.parentNode.querySelectorAll("button[data-theme-choice]"));
    var next = all[(all.indexOf(on) + 1) % all.length];
    if (!next || next === on) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    next.click();
  }, true);

  /* ------------------------------------------------ 5. smooth pages
     On a phone a new page fades in from just below and starts at the top; the
     header gets a soft shadow once the page has scrolled under it. */
  var smoothPagesOn = false;
  function smoothPages() {
    if (smoothPagesOn) return;
    var area = document.getElementById("pageContent");
    var bar = document.querySelector("#appShell .topbar");
    if (!area || !bar) return;
    smoothPagesOn = true;
    new MutationObserver(function (list) {
      if (!MQ || !MQ.matches) return;
      var swapped = list.some(function (m) { return m.addedNodes.length && m.target === area; });
      if (!swapped) return;
      area.style.scrollBehavior = "auto";       // jump to the top, no long scroll up
      area.scrollTop = 0;
      area.style.scrollBehavior = "";
      area.classList.remove("m-page-in");
      void area.offsetWidth;                     // restart the animation
      area.classList.add("m-page-in");
    }).observe(area, { childList: true });
    area.addEventListener("scroll", function () {
      bar.classList.toggle("m-scrolled", area.scrollTop > 6);
    }, { passive: true });
  }

  /* ------------------------------------------------ keeping up with the page */
  function run() { pending = false; labelLists(); labelPrTables(); filterToggles(); detailCards(); wrapWide(); watchSideMenu(); buildBottomNav(); smoothPages(); }
  function schedule() {
    if (pending) return;
    pending = true;
    (window.requestAnimationFrame || setTimeout)(function () { setTimeout(run, 100); });
  }

  function start() {
    var area = document.querySelector(".content-area");
    if (!area) { setTimeout(start, 400); return; }
    new MutationObserver(schedule).observe(area, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    schedule();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
