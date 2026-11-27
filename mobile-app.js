/* ==========================================================================
   Phone app shell (mobile-app.js + mobile-app.css). Nothing here runs on a laptop.

   1. Tab bar: a fixed bar of five tabs, like a phone app: four main pages and
      "More". The four are the first of TAB_PAGES the person can open; More opens
      a sheet with every other page (and the Light / Dark / System choice).
      Built from the side menu's own buttons, so who can see what, locks and the
      page you are on stay exactly as they are there. Tapping a tab clicks the
      side-menu button, so every page opens exactly as it does on a laptop.
   2. Sheets: the shared dialogs (.modal-overlay) rise from the bottom; a tap on
      the dimmed area outside closes the More sheet.
   Replaces the old sliding bottom bar (.m-nav from mobile.js), which is hidden.
   ========================================================================== */
(function () {
  "use strict";
  var MQ = window.matchMedia ? window.matchMedia("(max-width: 768px)") : null;
  function phone() { return !!(MQ && MQ.matches); }

  var TAB_PAGES = ["home", "calendar", "smart-goals", "pos", "award-management", "employees", "gr", "team-performance", "er-dashboards"];
  var LABEL = {
    "home": "Home", "employees": "Employees", "er-dashboards": "Dashboards", "award-management": "Awards",
    "calendar": "Calendar", "smart-goals": "HO Plan", "pos": "Field Review", "gr": "GRs", "forms": "Forms",
    "pom": "Old POM", "team-performance": "Insight", "ho-plan-new": "In development"
  };
  var LONG = {
    "award-management": "Awards & Gifts", "er-dashboards": "ER & Dashboards", "smart-goals": "HO Plan & Review",
    "pos": "Field Review", "gr": "GRs & Circulars", "team-performance": "OLF Insight", "calendar": "Program Calendar"
  };
  var MORE_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><circle cx="17" cy="17" r="3.6"/></svg>';

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }

  // Pages the person can open, in side-menu order (same rules as the old bottom bar).
  function pages() {
    return Array.prototype.filter.call(document.querySelectorAll("#appSidebar .sidebar-nav .nav-item[data-page]"), function (b) {
      if (b.hidden || b.closest("[hidden]")) return false;
      if (b.classList.contains("nav-item--locked-hidden") || b.classList.contains("nav-item--locked") || b.classList.contains("nav-item--locked-admin")) return false;
      return getComputedStyle(b).display !== "none";
    });
  }
  function pageOf(b) { return b.getAttribute("data-page"); }
  function colourOf(b) { return (getComputedStyle(b).getPropertyValue("--pg") || "").trim() || "#2F6FE4"; }
  function iconOf(b) { var i = b.querySelector(".icon"); return i ? i.innerHTML : ""; }
  function open(page) {
    var src = document.querySelector('#appSidebar .nav-item[data-page="' + page + '"]');
    if (src) src.click();
  }

  /* ---------------------------------------------------------------- tab bar */
  var bar = null, sheet = null, sig = "";

  function ensureBar() {
    if (bar) return bar;
    var shell = document.getElementById("appShell");
    if (!shell) return null;
    bar = document.createElement("nav");
    bar.className = "mx-tabbar";
    bar.setAttribute("aria-label", "Main pages");
    shell.appendChild(bar);
    bar.addEventListener("click", function (e) {
      var t = e.target.closest(".mx-tab");
      if (!t) return;
      if (t.hasAttribute("data-more")) { toggleSheet(); return; }
      closeSheet();
      open(t.getAttribute("data-page"));
    });
    return bar;
  }

  function build() {
    if (!ensureBar()) return;
    var all = pages();
    var byPage = {};
    all.forEach(function (b) { byPage[pageOf(b)] = b; });
    var main = [];
    TAB_PAGES.forEach(function (p) { if (byPage[p] && main.length < 4) main.push(byPage[p]); });
    all.forEach(function (b) { if (main.length < 4 && main.indexOf(b) < 0) main.push(b); });
    var rest = all.filter(function (b) { return main.indexOf(b) < 0; });

    var active = "";
    all.forEach(function (b) { if (b.classList.contains("active")) active = pageOf(b); });
    var moreActive = rest.some(function (b) { return pageOf(b) === active; });

    var s = main.map(pageOf).join("|") + "#" + rest.map(pageOf).join("|");
    if (s !== sig) {
      sig = s;
      bar.innerHTML = main.map(function (b) {
        var p = pageOf(b);
        return '<button type="button" class="mx-tab" data-page="' + esc(p) + '" style="--pg:' + esc(colourOf(b)) + '">' +
          '<span class="mx-tab-ico">' + iconOf(b) + '</span><span class="mx-tab-lbl">' + esc(LABEL[p] || b.title || p) + "</span></button>";
      }).join("") + (rest.length
        ? '<button type="button" class="mx-tab mx-tab--more" data-more aria-haspopup="dialog" style="--pg:#475569">' +
          '<span class="mx-tab-ico">' + MORE_ICO + '</span><span class="mx-tab-lbl">More</span></button>'
        : "");
      bar.style.setProperty("--n", bar.children.length);
      buildSheet(rest);
    }
    Array.prototype.forEach.call(bar.querySelectorAll(".mx-tab"), function (t) {
      var on = t.hasAttribute("data-more") ? (moreActive || (sheet && sheet.classList.contains("is-open"))) : t.getAttribute("data-page") === active;
      t.classList.toggle("is-active", !!on);
      if (on && !t.hasAttribute("data-more")) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current");
    });
    if (sheet) Array.prototype.forEach.call(sheet.querySelectorAll(".mx-tile"), function (t) {
      t.classList.toggle("is-active", t.getAttribute("data-page") === active);
    });
  }

  /* ------------------------------------------------------------ More sheet */
  function buildSheet(rest) {
    if (!sheet) {
      sheet = document.createElement("div");
      sheet.className = "mx-sheet-back";
      sheet.innerHTML = '<div class="mx-sheet" role="dialog" aria-modal="true" aria-label="All pages">' +
        '<span class="mx-grab" aria-hidden="true"></span>' +
        '<div class="mx-sheet-h">All pages</div><div class="mx-grid"></div>' +
        '<div class="mx-sheet-h mx-sheet-h--sub">Appearance</div>' +
        '<div class="mx-seg" role="radiogroup" aria-label="Appearance">' +
          '<button type="button" data-theme-set="light" role="radio">Light</button>' +
          '<button type="button" data-theme-set="dark" role="radio">Dark</button>' +
          '<button type="button" data-theme-set="system" role="radio">System</button>' +
        "</div></div>";
      document.body.appendChild(sheet);
      sheet.addEventListener("click", function (e) {
        if (e.target === sheet) { closeSheet(); return; }
        var tile = e.target.closest(".mx-tile");
        if (tile) { closeSheet(); open(tile.getAttribute("data-page")); return; }
        var th = e.target.closest("[data-theme-set]");
        if (th) setTheme(th.getAttribute("data-theme-set"));
      });
      // drag the sheet down to close it
      var startY = null, dy = 0, box = sheet.querySelector(".mx-sheet");
      box.addEventListener("touchstart", function (e) { if (box.scrollTop > 0) return; startY = e.touches[0].clientY; dy = 0; }, { passive: true });
      box.addEventListener("touchmove", function (e) {
        if (startY == null) return;
        dy = Math.max(0, e.touches[0].clientY - startY);
        box.style.transform = "translateY(" + dy + "px)";
      }, { passive: true });
      box.addEventListener("touchend", function () {
        if (startY == null) return;
        box.style.transform = "";
        if (dy > 90) closeSheet();
        startY = null;
      });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });
    }
    sheet.querySelector(".mx-grid").innerHTML = rest.map(function (b) {
      var p = pageOf(b);
      return '<button type="button" class="mx-tile" data-page="' + esc(p) + '" style="--pg:' + esc(colourOf(b)) + '">' +
        '<span class="mx-tile-ico">' + iconOf(b) + '</span><span class="mx-tile-lbl">' + esc(LONG[p] || LABEL[p] || b.title || p) + "</span></button>";
    }).join("");
  }
  function themeNow() {
    try { return (window.OLFTheme && window.OLFTheme.get && window.OLFTheme.get()) || "light"; } catch (e) { return "light"; }
  }
  function setTheme(v) {
    try {
      if (window.OLFTheme && window.OLFTheme.set) window.OLFTheme.set(v);
      else { var b = document.querySelector('#appShell .theme-switch button[data-theme-choice="' + v + '"]'); if (b) b.click(); }
    } catch (e) { /* fine */ }
    paintTheme();
  }
  function paintTheme() {
    if (!sheet) return;
    var now = themeNow();
    Array.prototype.forEach.call(sheet.querySelectorAll("[data-theme-set]"), function (b) {
      var on = b.getAttribute("data-theme-set") === now;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-checked", String(on));
    });
  }
  function toggleSheet() { if (sheet && sheet.classList.contains("is-open")) closeSheet(); else openSheet(); }
  function openSheet() {
    if (!sheet) return;
    paintTheme();
    sheet.classList.add("is-open");
    document.documentElement.classList.add("mx-sheet-open");
    build();
  }
  function closeSheet() {
    if (!sheet || !sheet.classList.contains("is-open")) return;
    sheet.classList.remove("is-open");
    document.documentElement.classList.remove("mx-sheet-open");
    build();
  }

  /* --------------------------------------------- page actions in the header
     A page banner whose only content (after its title goes) is an icon button
     or two, such as Refresh, would be an empty coloured strip. Instead the
     banner hides and the buttons appear in the header, beside the bell, as
     stand-ins that press the page's own buttons. */
  var KNOWN_REFRESH = ["#sg-refresh-btn", "#aw-refresh-all"];   // HO Plan & Review, Awards & Gifts
  function liftActions() {
    var group = document.querySelector("#appShell .topbar .tp-group");
    if (!group) return;
    var slot = group.querySelector(".mx-top-acts");
    if (!slot) {
      slot = document.createElement("span");
      slot.className = "mx-top-acts";
      group.insertBefore(slot, group.firstChild);
    }
    var hero = phone() ? document.querySelector(".content-area .pg-hero:not(.hm-hero)") : null;
    var btns = [];
    if (hero) {
      hero.classList.remove("mx-hero-lifted");   // measure it as the page drew it (re-added below, same frame)
      var rest = Array.prototype.filter.call(hero.children, function (c) {
        return !c.classList.contains("pg-blob") && !c.classList.contains("pg-hero-lead") && c.tagName !== "STYLE" && c.tagName !== "SCRIPT" && getComputedStyle(c).display !== "none";
      });
      btns = Array.prototype.filter.call(hero.querySelectorAll("button, a[href]"), function (b) { return b.offsetParent !== null; });
      // text outside the buttons, and whether every button is icon-sized (its label, if any, is not shown)
      var text = rest.map(function (c) { return c.innerText || ""; }).join("");
      btns.forEach(function (b) { text = text.replace(b.innerText || "", ""); });
      var small = btns.every(function (b) { var r = b.getBoundingClientRect(); return r.width <= 52 && r.height <= 52; });
      var only = btns.length > 0 && btns.length <= 2 && small && !text.trim() && !hero.querySelector("select, input, nav, [role=tablist]");
      hero.classList.toggle("mx-hero-lifted", only);
      if (!only) btns = [];
    }
    // Pages whose refresh button sits beside their tabs: the button moves to the header too.
    if (!btns.length && phone()) {
      KNOWN_REFRESH.forEach(function (sel) {
        var b = document.querySelector(".content-area " + sel);
        if (b && !btns.length) btns.push(b);
      });
    }
    var key = btns.map(function (b) { return b.id || b.className; }).join("|");
    if (slot.getAttribute("data-key") === key) return;
    slot.setAttribute("data-key", key);
    slot.innerHTML = "";
    btns.forEach(function (b) {
      var p = document.createElement("button");
      p.type = "button";
      p.className = "mx-top-btn";
      var REFRESH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>';
      var ico = b.querySelector("svg");
      var isRefresh = /refresh|reload|sync/i.test((b.getAttribute("aria-label") || "") + " " + (b.getAttribute("title") || "") + " " + (b.textContent || "") + " " + (b.id || ""));
      p.innerHTML = (isRefresh || !ico) ? REFRESH : ico.outerHTML;
      var name = b.getAttribute("aria-label") || b.getAttribute("title") || "Refresh";
      p.setAttribute("aria-label", name);
      p.title = name;
      p.addEventListener("click", function () { b.click(); });
      slot.appendChild(p);
    });
  }
  var pageWatched = false;
  function watchPage() {
    if (pageWatched) return;
    var area = document.getElementById("pageContent");
    if (!area) return;
    pageWatched = true;
    new MutationObserver(function () { [50, 700, 1600, 3200, 6000].forEach(function (ms) { setTimeout(liftActions, ms); setTimeout(setupFilters, ms + 20); setTimeout(markSingles, ms + 40); setTimeout(setupStrips, ms + 60); }); })
      .observe(area, { childList: true });
  }

  /* ------------------------------------------- the tab bar steps aside for dialogs
     A dialog, sheet or drawer that covers the screen (any page's own, whatever its
     class) hides the tab bar, so the dialog's own buttons at the bottom stay reachable. */
  function coveringDialog() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var stack = document.elementsFromPoint ? document.elementsFromPoint(vw / 2, vh * 0.55) : [];
    for (var i = 0; i < stack.length; i++) {
      for (var el = stack[i]; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
        if (el.id === "appShell" || el.classList.contains("content-area") || el.classList.contains("mx-sheet-back") || el.classList.contains("mx-tabbar")) break;
        var cs = getComputedStyle(el);
        if (cs.position === "fixed") {
          var r = el.getBoundingClientRect();
          if (r.width >= vw * 0.8 && r.height >= vh * 0.5 && cs.visibility !== "hidden" && +cs.opacity > 0.05) return true;
        }
      }
      if (stack[i].closest && stack[i].closest("#appShell")) return false;   // reached the page itself
    }
    return false;
  }
  var dlgQueued = false;
  function checkDialog() {
    if (dlgQueued) return;
    dlgQueued = true;
    requestAnimationFrame(function () {
      dlgQueued = false;
      if (!phone()) { document.documentElement.classList.remove("mx-dialog"); return; }
      document.documentElement.classList.toggle("mx-dialog", coveringDialog());
    });
  }
  document.addEventListener("click", function () { setTimeout(checkDialog, 60); setTimeout(checkDialog, 450); setTimeout(setupFilters, 120); setTimeout(setupFilters, 900); }, true);
  document.addEventListener("keyup", function (e) { if (e.key === "Escape") setTimeout(checkDialog, 60); }, true);
  var dlgWatched = false;
  function watchDialogs() {
    if (dlgWatched || !document.body) return;
    dlgWatched = true;
    new MutationObserver(checkDialog).observe(document.body, { childList: true, attributes: true, attributeFilter: ["class", "hidden", "open"], subtree: true });
  }

  /* ------------------------------------------------------------- Filters
     A page that opens with a tall stack of dropdowns shows one "Filters" line
     instead: what is chosen, in a few words, and a tap opens the dropdowns in
     place. It opens by itself while a dropdown still asks you to pick something
     ("Select Department..."). Buttons in the same panel (Add Task, Excel...) stay
     visible. Nothing about the dropdowns themselves changes. */
  var FILTER_PANELS = [
    { panel: "#sg-app .filter-bar" },                                  // HO Plan & Review (every tab)
    { panel: "#grMyFilterRow", barBefore: "table" },                  // GRs & Circulars: My uploads
    { panel: "#pcal-sidebar-cal-controls" },                           // Program Calendar: jump to / programme
    { panel: "#tpProgReviewContent .tp-header-controls" }              // OLF Insight
  ];
  var FILTER_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>';
  var CHEV = '<svg class="mx-fbar-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  function fieldsOf(panel) {
    return Array.prototype.filter.call(panel.querySelectorAll("select, input[type=search], input[type=text], input:not([type])"), function (f) {
      if (f.closest(".mx-fbar")) return false;
      // a select may be hidden behind the app's own dropdown (olf-select.js): judge it by its holder
      var el = (f.tagName === "SELECT" && getComputedStyle(f).display === "none") ? f.parentElement : f;
      return !!el && getComputedStyle(el).display !== "none";
    });
  }
  function summaryOf(panel) {
    var bits = [], needs = false, n = 0;
    var was = panel.classList.contains("mx-fcollapsed");
    if (was) panel.classList.remove("mx-fcollapsed");        // judge the fields as the page shows them (same frame)
    var fields = fieldsOf(panel);
    if (was) panel.classList.add("mx-fcollapsed");
    fields.forEach(function (f) {
      if (f.tagName === "SELECT") {
        var o = f.options[f.selectedIndex], t = o ? o.text.trim() : "";
        if (!t) return;
        if (/^select\b/i.test(t) || /first\b/i.test(t) && /select/i.test(t)) { if (!f.disabled) needs = true; return; }
        if (/^all\b/i.test(t)) return;
        bits.push(t); n++;
      } else if (f.value && f.value.trim()) { bits.push("\u201C" + f.value.trim() + "\u201D"); n++; }
    });
    return { text: bits.join(" \u00B7 ") || "All", needs: needs, n: n };
  }
  function paintBar(panel) {
    var bar = panel.__mxBar; if (!bar) return;
    var s = summaryOf(panel);
    bar.querySelector("small").textContent = s.text;
    if (s.needs && panel.classList.contains("mx-fcollapsed") && !panel.__mxUserClosed) {
      panel.classList.remove("mx-fcollapsed");
      bar.setAttribute("aria-expanded", "true");
    }
  }
  function setupFilters() {
    FILTER_PANELS.forEach(function (cfg) {
      Array.prototype.forEach.call(document.querySelectorAll(".content-area " + cfg.panel), function (panel) {
        if (!phone()) {
          if (panel.__mxBar) { panel.classList.remove("mx-fpanel", "mx-fcollapsed"); panel.__mxBar.remove(); panel.__mxBar = null; }
          return;
        }
        if (panel.__mxBar && panel.__mxBar.isConnected) { paintBar(panel); return; }
        if (!fieldsOf(panel).length) return;
        var bar = document.createElement("button");
        bar.type = "button";
        bar.className = "mx-fbar";
        bar.setAttribute("aria-expanded", "false");
        bar.innerHTML = '<span class="mx-fbar-ico">' + FILTER_ICO + '</span><span class="mx-fbar-txt"><b>Filters</b><small></small></span>' + CHEV;
        var host = panel;
        if (cfg.barBefore) {
          var t = panel.closest(cfg.barBefore);
          var wrap = t && (t.closest(".m-scroll") || t);
          if (!wrap) return;
          wrap.parentNode.insertBefore(bar, wrap);
          host = null;
        } else {
          panel.insertBefore(bar, panel.firstChild);
        }
        panel.__mxBar = bar;
        panel.classList.add("mx-fpanel", "mx-fcollapsed");
        if (!host) bar.classList.add("mx-fbar--outside");
        bar.addEventListener("click", function () {
          var open = panel.classList.toggle("mx-fcollapsed") === false;
          bar.setAttribute("aria-expanded", String(open));
          panel.__mxUserClosed = !open;
          if (bar.classList.contains("mx-fbar--outside")) bar.classList.toggle("is-open", open);
        });
        panel.addEventListener("change", function () { paintBar(panel); });
        panel.addEventListener("input", function () { paintBar(panel); });
        paintBar(panel);
      });
    });
  }

  /* A switch with only one choice showing (e.g. Calendar's lone "Calendar" tab for
     most people) is not a switch: it hides on a phone. */
  function markSingles() {
    Array.prototype.forEach.call(document.querySelectorAll(".content-area .has-tab-glider"), function (nav) {
      nav.classList.remove("mx-single");
      if (!phone()) return;
      var shown = Array.prototype.filter.call(nav.querySelectorAll("button, a"), function (b) { return b.offsetParent !== null; }).length;
      if (nav.offsetParent !== null && shown === 1) nav.classList.add("mx-single");
    });
  }

  /* Tab strips that scroll: a soft fade on the side that has more tabs, and the
     chosen tab slides into view. */
  var STRIPS = "#sgHero .nav-tabs, #awHero .aw-toptabs, #tpHero .tp-view-tabs, #prNav, #grPage > .gr-tabs, #sgHero .dash-subtabs, #awHero .aw-subtabs";
  function paintStrip(s) {
    var max = s.scrollWidth - s.clientWidth;
    s.classList.toggle("mx-more-r", max > 4 && s.scrollLeft < max - 4);
    s.classList.toggle("mx-more-l", max > 4 && s.scrollLeft > 4);
  }
  function setupStrips() {
    if (!phone()) return;
    Array.prototype.forEach.call(document.querySelectorAll(".content-area :is(" + STRIPS + ")"), function (s) {
      if (!s.__mxStrip) {
        s.__mxStrip = true;
        s.addEventListener("scroll", function () { paintStrip(s); }, { passive: true });
        s.addEventListener("click", function (e) {
          var b = e.target.closest("button"); if (!b) return;
          setTimeout(function () { b.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }, 30);
        });
      }
      paintStrip(s);
    });
  }

  /* ------------------------------------------------------------------ wiring */
  var watching = false;
  function watch() {
    if (watching) return;
    var side = document.querySelector("#appSidebar .sidebar-nav");
    if (!side) return;
    watching = true;
    new MutationObserver(function () { build(); })
      .observe(side, { attributes: true, subtree: true, childList: true, attributeFilter: ["class", "hidden", "style"] });
  }
  var pending = false;
  function run() { pending = false; if (!document.getElementById("appShell")) return; build(); watch(); watchPage(); liftActions(); setupFilters(); markSingles(); setupStrips(); watchDialogs(); checkDialog(); }
  function soon() { if (pending) return; pending = true; setTimeout(run, 60); }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", soon); else soon();
  window.addEventListener("load", soon);
  [800, 2500, 6000].forEach(function (ms) { setTimeout(soon, ms); });
  if (MQ && MQ.addEventListener) MQ.addEventListener("change", function () { closeSheet(); soon(); });
})();
