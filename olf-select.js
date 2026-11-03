/* =====================================================================
   olf-select.js — themed dropdown list for every <select> in Staff Connect
   ---------------------------------------------------------------------
   UI ONLY. Each page keeps its own <select> exactly as it is (size, border,
   arrow, value, onchange). Only the list that opens is ours: a rounded card
   in the app's colours (light and dark), with the chosen item ticked, a
   type-to-search box on long lists and full keyboard support.

   How it works: a mouse press / Space / Enter / Alt+Down on a select opens
   this list instead of the browser's plain one. Picking an item sets the
   select's value and fires the normal "input" and "change" events, so every
   page's existing handlers run unchanged.

   Left native on purpose: phones and tablets (their own picker is better
   there), <select multiple>, list boxes (size > 1), disabled selects, and
   any select marked data-native.
   ===================================================================== */
(function () {
    "use strict";
    if (window.OLFSelect) return;

    // Phones / tablets: the device's own picker is the better one there.
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
        window.OLFSelect = { enabled: false, close: function () {} };
        return;
    }
    var SEARCH_FROM = 13;         // show the search box on lists longer than a year of months
    var MAX_H = 320;              // list height before it scrolls (CSS px)

    /* ---------- styles (theme.js skips this sheet: both themes are hand-made) ---------- */
    var css = [
        ".olf-sel-pop{position:fixed;z-index:2147483000;box-sizing:border-box;display:flex;flex-direction:column;",
        "  min-width:160px;padding:6px;border-radius:14px;",
        "  background:var(--olf-sel-bg);color:var(--olf-sel-ink);",
        "  border:1px solid var(--olf-sel-line);",
        "  box-shadow:0 18px 44px -12px rgba(15,23,42,.28),0 4px 12px -4px rgba(15,23,42,.12),inset 0 1px 0 var(--olf-sel-hi);",
        "  -webkit-backdrop-filter:blur(18px) saturate(160%);backdrop-filter:blur(18px) saturate(160%);",
        "  font-family:inherit;line-height:1.35;outline:none;",
        "  transform-origin:top center;animation:olf-sel-in .14s cubic-bezier(.2,.8,.2,1);}",
        ".olf-sel-pop.is-up{transform-origin:bottom center;animation-name:olf-sel-in-up;}",
        "@keyframes olf-sel-in{from{opacity:0;transform:translateY(-4px) scale(.98)}to{opacity:1;transform:none}}",
        "@keyframes olf-sel-in-up{from{opacity:0;transform:translateY(4px) scale(.98)}to{opacity:1;transform:none}}",
        "@media (prefers-reduced-motion:reduce){.olf-sel-pop{animation:none}}",

        ".olf-sel-search{display:flex;align-items:center;gap:8px;margin:0 0 6px;padding:0 10px;height:34px;flex-shrink:0;",
        "  border-radius:9px;background:var(--olf-sel-soft);border:1px solid var(--olf-sel-line);color:var(--olf-sel-faint);font-size:12.5px;}",
        ".olf-sel-search svg{width:14px;height:14px;flex-shrink:0}",
        ".olf-sel-q{color:var(--olf-sel-ink);white-space:pre;overflow:hidden;text-overflow:ellipsis}",
        ".olf-sel-caret{width:1.5px;height:15px;margin-left:-6px;background:var(--olf-sel-acc);animation:olf-sel-blink 1s steps(1) infinite}",
        "@keyframes olf-sel-blink{50%{opacity:0}}",
        ".olf-sel-ph{opacity:.85}",

        ".olf-sel-list{overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--olf-sel-line) transparent;}",
        ".olf-sel-group{padding:8px 10px 4px;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--olf-sel-faint);}",
        ".olf-sel-opt{display:flex;align-items:center;gap:10px;padding:8px 10px;margin:1px 0;border-radius:9px;cursor:pointer;",
        "  color:var(--olf-sel-ink);font-size:var(--olf-sel-fs,13.5px);transition:background .1s ease,color .1s ease;}",
        ".olf-sel-opt.in-group{padding-left:18px}",
        ".olf-sel-txt{flex:1;min-width:0;overflow-wrap:anywhere}",
        ".olf-sel-txt mark{background:none;color:var(--olf-sel-acc);font-weight:700}",
        ".olf-sel-tick{width:16px;height:16px;flex-shrink:0;color:var(--olf-sel-acc);opacity:0}",
        ".olf-sel-opt.is-active{background:var(--olf-sel-hover)}",
        ".olf-sel-opt.is-sel{color:var(--olf-sel-acc);font-weight:600;background:var(--olf-sel-chosen)}",
        ".olf-sel-opt.is-sel.is-active{background:var(--olf-sel-chosen-hover)}",
        ".olf-sel-opt.is-sel .olf-sel-tick{opacity:1}",
        ".olf-sel-opt.is-dis{opacity:.45;cursor:not-allowed;background:none}",
        ".olf-sel-empty{padding:14px 10px;font-size:12.5px;color:var(--olf-sel-faint);text-align:center}",

        /* the select itself while its list is open */
        "select.olf-sel-open{border-color:var(--olf-sel-acc)!important;box-shadow:0 0 0 3px var(--olf-sel-ring)!important;}",

        /* light */
        "html{--olf-sel-bg:rgba(255,255,255,.97);--olf-sel-ink:#1E293B;--olf-sel-faint:#7A8599;--olf-sel-line:rgba(15,23,42,.09);",
        "  --olf-sel-hi:rgba(255,255,255,.9);--olf-sel-soft:#F4F7FC;--olf-sel-acc:var(--chrome-accent,#3567D4);",
        "  --olf-sel-hover:rgba(53,103,212,.07);--olf-sel-chosen:rgba(53,103,212,.10);--olf-sel-chosen-hover:rgba(53,103,212,.15);",
        "  --olf-sel-ring:rgba(53,103,212,.16);}",
        /* dark */
        "html[data-theme=\"dark\"]{--olf-sel-bg:rgba(30,36,46,.97);--olf-sel-ink:#E8ECF4;--olf-sel-faint:#8E9AB0;--olf-sel-line:rgba(255,255,255,.08);",
        "  --olf-sel-hi:rgba(255,255,255,.05);--olf-sel-soft:rgba(255,255,255,.04);--olf-sel-acc:var(--chrome-accent,#7AA8FF);",
        "  --olf-sel-hover:rgba(122,168,255,.10);--olf-sel-chosen:rgba(122,168,255,.14);--olf-sel-chosen-hover:rgba(122,168,255,.20);",
        "  --olf-sel-ring:rgba(122,168,255,.22);}",
        "html[data-theme=\"dark\"] .olf-sel-pop{box-shadow:0 22px 50px -12px rgba(0,0,0,.65),0 4px 14px -4px rgba(0,0,0,.4),inset 0 1px 0 var(--olf-sel-hi);}"
    ].join("\n");

    var TICK = '<svg class="olf-sel-tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    var LENS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>';

    function addStyle() {
        if (document.getElementById("olfSelectStyle")) return;
        var st = document.createElement("style");
        st.id = "olfSelectStyle";
        st.setAttribute("data-theme-skip", "");
        st.textContent = css;
        (document.head || document.documentElement).appendChild(st);
    }

    /* ---------- state ---------- */
    var pop = null, listEl = null, qEl = null, sel = null;
    var items = [], shown = [], active = -1, query = "";
    var typed = "", typedAt = 0;                                   // type-to-jump on short lists
    var anchor = null;                                             // where the select was when its list opened

    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }
    function eligible(s) {
        return !!s && s.tagName === "SELECT" && !s.multiple && !(s.size > 1) && !s.disabled &&
               !s.hasAttribute("data-native") && !(s.closest && s.closest("[data-native-selects]"));
    }
    // CSS zoom on <html> (the app scales the whole UI): rects are in screen px,
    // fixed positions are in CSS px.
    function zoomOf() {
        var z = parseFloat(getComputedStyle(document.documentElement).zoom);
        return z > 0 ? z : 1;
    }

    /* ---------- open / close ---------- */
    function open(s) {
        close();
        sel = s; query = "";
        items = [];
        var lastGroup = null;
        for (var i = 0; i < s.options.length; i++) {
            var o = s.options[i];
            if (o.hidden || o.style.display === "none") continue;
            var g = o.parentNode && o.parentNode.tagName === "OPTGROUP" ? o.parentNode : null;
            if (g && g !== lastGroup) items.push({ group: g.label || "" });
            lastGroup = g;
            items.push({ index: o.index, text: (o.label || o.text || "").trim() || " ",
                         disabled: o.disabled || !!(g && g.disabled), inGroup: !!g });
        }
        var countOpts = items.filter(function (x) { return !x.group; }).length;

        pop = document.createElement("div");
        pop.className = "olf-sel-pop";
        pop.setAttribute("role", "listbox");
        pop.setAttribute("aria-label", (s.getAttribute("aria-label") || s.name || s.id || "Options"));
        var fs = parseFloat(getComputedStyle(s).fontSize) || 13.5;
        pop.style.setProperty("--olf-sel-fs", Math.max(12.5, Math.min(fs, 15)) + "px");
        pop.style.fontFamily = getComputedStyle(s).fontFamily;
        pop.innerHTML = (countOpts >= SEARCH_FROM
                ? '<div class="olf-sel-search">' + LENS + '<span class="olf-sel-q"></span><span class="olf-sel-caret"></span><span class="olf-sel-ph">Type to search</span></div>' : "")
            + '<div class="olf-sel-list"></div><div class="olf-sel-empty" hidden>No matches</div>';
        listEl = pop.querySelector(".olf-sel-list");
        qEl = pop.querySelector(".olf-sel-search");
        pop.addEventListener("mousedown", function (e) { e.preventDefault(); });   // keep focus on the select
        pop.addEventListener("click", onPopClick);
        pop.addEventListener("mousemove", onPopHover);
        pop.addEventListener("wheel", function (e) {           // the wheel scrolls the list, never the page behind it
            var l = listEl, down = e.deltaY > 0;
            if (!l || (down ? l.scrollTop + l.clientHeight >= l.scrollHeight - 1 : l.scrollTop <= 0)) e.preventDefault();
        }, { passive: false });
        document.body.appendChild(pop);

        render();
        var cur = shown.indexOf(s.selectedIndex);
        setActive(cur >= 0 ? cur : firstEnabled(0, 1), true);
        place();
        anchor = s.getBoundingClientRect();
        s.classList.add("olf-sel-open");
        s.setAttribute("aria-expanded", "true");
    }
    function close() {
        if (pop) { pop.remove(); pop = null; listEl = null; qEl = null; }
        if (sel) { sel.classList.remove("olf-sel-open"); sel.removeAttribute("aria-expanded"); }
        sel = null; items = []; shown = []; active = -1; query = ""; typed = ""; anchor = null;
    }

    function place() {
        if (!pop || !sel) return;
        var z = zoomOf();
        var r = sel.getBoundingClientRect();
        var vw = window.innerWidth, vh = window.innerHeight, gap = 6 * z, pad = 8;
        var minW = r.width / z;
        pop.style.minWidth = minW + "px";
        pop.style.maxWidth = Math.max(minW, Math.min(460, (vw - 2 * pad) / z)) + "px";
        var below = vh - r.bottom - gap - pad, above = r.top - gap - pad;
        var natural = pop.offsetHeight * z;                       // screen px
        var up = natural > below && above > below;
        var room = Math.max(120, up ? above : below);
        var listMax = Math.min(MAX_H * z, room - (natural - listEl.offsetHeight * z));
        listEl.style.maxHeight = Math.max(80, listMax / z) + "px";
        var h = pop.offsetHeight * z, w = pop.offsetWidth * z;
        var left = Math.min(Math.max(pad, r.left), vw - pad - w);
        var top = up ? r.top - gap - h : r.bottom + gap;
        pop.style.left = left / z + "px";
        pop.style.top = top / z + "px";
        pop.classList.toggle("is-up", up);
    }

    /* ---------- list ---------- */
    function norm(s) { return String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, ""); }
    function render() {
        var q = norm(query.trim()), html = "", pendingGroup = null;
        shown = [];
        items.forEach(function (it) {
            if (it.group != null) { pendingGroup = it.group; return; }
            var hit = !q || norm(it.text).indexOf(q) >= 0;
            if (!hit) return;
            if (pendingGroup != null) { html += '<div class="olf-sel-group" role="presentation">' + esc(pendingGroup) + "</div>"; pendingGroup = null; }
            var label = esc(it.text);
            if (q) {
                var at = norm(it.text).indexOf(q);
                label = esc(it.text.slice(0, at)) + "<mark>" + esc(it.text.slice(at, at + q.length)) + "</mark>" + esc(it.text.slice(at + q.length));
            }
            var on = sel.selectedIndex === it.index;
            html += '<div class="olf-sel-opt' + (on ? " is-sel" : "") + (it.disabled ? " is-dis" : "") + (it.inGroup ? " in-group" : "")
                  + '" role="option" aria-selected="' + on + '"' + (it.disabled ? ' aria-disabled="true"' : "")
                  + ' data-n="' + shown.length + '"><span class="olf-sel-txt">' + label + "</span>" + TICK + "</div>";
            shown.push(it.index);
        });
        listEl.innerHTML = html;
        pop.querySelector(".olf-sel-empty").hidden = shown.length > 0;
        if (qEl) {
            qEl.querySelector(".olf-sel-q").textContent = query;
            qEl.querySelector(".olf-sel-ph").hidden = !!query;
        }
    }
    function optEl(n) { return listEl ? listEl.querySelector('.olf-sel-opt[data-n="' + n + '"]') : null; }
    function isDisabled(n) { var o = sel && sel.options[shown[n]]; return !o || o.disabled || (o.parentNode.tagName === "OPTGROUP" && o.parentNode.disabled); }
    function firstEnabled(from, step) {
        for (var n = from; n >= 0 && n < shown.length; n += step) if (!isDisabled(n)) return n;
        return -1;
    }
    function setActive(n, center) {
        var prev = optEl(active); if (prev) prev.classList.remove("is-active");
        active = n;
        var el = optEl(n); if (!el) return;
        el.classList.add("is-active");
        var lt = listEl.scrollTop, lh = listEl.clientHeight, et = el.offsetTop - listEl.offsetTop, eh = el.offsetHeight;
        if (center) listEl.scrollTop = Math.max(0, et - (lh - eh) / 2);
        else if (et < lt) listEl.scrollTop = et - 4;
        else if (et + eh > lt + lh) listEl.scrollTop = et + eh - lh + 4;
    }
    function choose(n) {
        if (n < 0 || isDisabled(n)) return;
        var s = sel, idx = shown[n];
        close();
        if (s.selectedIndex !== idx) {
            s.selectedIndex = idx;
            s.dispatchEvent(new Event("input", { bubbles: true }));
            s.dispatchEvent(new Event("change", { bubbles: true }));
        }
        try { s.focus({ preventScroll: true }); } catch (e) {}
    }
    function onPopClick(e) {
        var el = e.target.closest && e.target.closest(".olf-sel-opt");
        if (el) choose(Number(el.getAttribute("data-n")));
    }
    function onPopHover(e) {
        var el = e.target.closest && e.target.closest(".olf-sel-opt");
        if (!el || el.classList.contains("is-dis")) return;
        var n = Number(el.getAttribute("data-n"));
        if (n !== active) setActive(n, false);
    }
    function refilter() {
        render();
        setActive(firstEnabled(0, 1), false);
        listEl.scrollTop = 0;
        place();
    }

    /* ---------- events ---------- */
    document.addEventListener("mousedown", function (e) {
        // A press on the list is ours alone: page code that closes its own panels on an
        // "outside" press (the list lives on <body>) must not see it.
        if (pop && pop.contains(e.target)) { e.stopImmediatePropagation(); return; }
        var s = e.target && e.target.closest ? e.target.closest("select") : null;
        if (e.button !== 0 || !eligible(s)) { if (pop) close(); return; }
        e.preventDefault();                                     // no browser list
        if (sel === s) { close(); return; }                     // second press closes
        try { s.focus({ preventScroll: true }); } catch (x) {}
        open(s);
    }, true);

    document.addEventListener("keydown", function (e) {
        var t = e.target;
        if (!pop) {
            if (!eligible(t)) return;
            var k = e.key;
            if (k === " " || k === "Enter" || k === "F4" || (e.altKey && (k === "ArrowDown" || k === "ArrowUp"))) {
                e.preventDefault();
                open(t);
            }
            return;                                             // plain arrows keep changing the value as before
        }
        if (t !== sel) { close(); return; }
        var key = e.key;
        if (key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
        if (key === "Tab") { close(); return; }
        if (key === "Enter" || (key === " " && !query)) { e.preventDefault(); choose(active); return; }
        if (key === "ArrowDown" || key === "ArrowUp") {
            e.preventDefault();
            var step = key === "ArrowDown" ? 1 : -1;
            var n = firstEnabled(active < 0 ? (step > 0 ? 0 : shown.length - 1) : active + step, step);
            if (n >= 0) setActive(n, false);
            return;
        }
        if (key === "Home" || key === "End" || key === "PageDown" || key === "PageUp") {
            e.preventDefault();
            var jump = key === "Home" ? firstEnabled(0, 1) : key === "End" ? firstEnabled(shown.length - 1, -1)
                     : firstEnabled(Math.max(0, Math.min(shown.length - 1, active + (key === "PageDown" ? 8 : -8))), key === "PageDown" ? 1 : -1);
            if (jump >= 0) setActive(jump, false);
            return;
        }
        if (key === "Backspace") {
            e.preventDefault();
            if (qEl && query) { query = query.slice(0, -1); refilter(); }
            return;
        }
        if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            if (qEl) { query += key; refilter(); return; }
            // short lists: jump to the next item starting with the typed letters
            var now = Date.now();
            typed = (now - typedAt < 700 ? typed : "") + norm(key); typedAt = now;
            var start = typed.length > 1 ? Math.max(active, 0) : active + 1;
            for (var m = 0; m < shown.length; m++) {
                var cand = (start + m) % shown.length, o = sel.options[shown[cand]];
                if (!isDisabled(cand) && norm((o.label || o.text).trim()).indexOf(typed) === 0) { setActive(cand, false); break; }
            }
        }
    }, true);

    // Anything that moves the select away from its list closes it. (A scroll that
    // leaves the select where it was - e.g. the late event of a click's own
    // scroll-into-view, or some other panel scrolling - keeps the list open.)
    document.addEventListener("scroll", function (e) {
        if (!pop || (e.target && e.target.nodeType === 1 && pop.contains(e.target))) return;
        var r = sel.getBoundingClientRect();
        if (!anchor || Math.abs(r.top - anchor.top) > 1 || Math.abs(r.left - anchor.left) > 1) close();
    }, true);
    window.addEventListener("resize", function () { close(); });
    window.addEventListener("blur", function () { close(); });
    document.addEventListener("focusin", function (e) { if (pop && e.target !== sel) close(); });

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addStyle);
    else addStyle();

    window.OLFSelect = { enabled: true, close: close };
})();
