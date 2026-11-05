/* OLF Insight: proper icons in place of emoji.

   The Insight page (SMART goals, historical archive) was written with emoji
   standing in for icons, and its screens are built from strings in several
   files. Rather than edit every one of them, this swaps each emoji it finds
   inside the page for a colourful SVG as the screens are drawn, so the text
   and the logic behind them stay exactly as they are. Only #tpRoot is
   touched, only text (never inputs, selects or scripts), and a character
   with no icon here is left alone. */
(function () {
    "use strict";

    // viewBox 0 0 24 24, drawn with strokes so they stay crisp at any size
    const S = (inner) =>
        '<svg class="tp-ico" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + "</svg>";

    const ICONS = {
        "⚙": S('<path d="M12 2.8l1.7 2.5 2.9-.6.9 2.8 2.8.9-.6 2.9 2.5 1.7-2.5 1.7.6 2.9-2.8.9-.9 2.8-2.9-.6L12 21.2l-1.7-2.5-2.9.6-.9-2.8-2.8-.9.6-2.9L2.3 12l2.5-1.7-.6-2.9 2.8-.9.9-2.8 2.9.6z" fill="#CBD5E1" stroke="#475569"/><circle cx="12" cy="12" r="3" fill="#fff" stroke="#475569"/>'),
        "✎": S('<path d="M4 20l1-4.200L16.500 4.300a2.100 2.100 0 013 3L7.800 19z" fill="#FDE68A" stroke="#D97706"/><path d="M14.500 6.300l3.200 3.200" stroke="#D97706"/>'),
        "🏆": S('<path d="M7 4h10v5a5 5 0 01-10 0z" fill="#FCD34D" stroke="#D97706"/><path d="M7 6H4.200v1.300A3 3 0 007 10.300M17 6h2.800v1.300A3 3 0 0117 10.300" stroke="#D97706"/><path d="M12 14v3.500" stroke="#D97706"/><path d="M8.500 20.500h7M9.500 17.500h5v3h-5z" fill="#F59E0B" stroke="#D97706"/>'),
        "📍": S('<path d="M12 21.500s7-6 7-11.500a7 7 0 00-14 0c0 5.500 7 11.500 7 11.500z" fill="#F87171" stroke="#DC2626"/><circle cx="12" cy="10" r="2.600" fill="#fff" stroke="#DC2626"/>'),
        "🔍": S('<circle cx="10.500" cy="10.500" r="6.500" fill="#E0F2FE" stroke="#2563EB"/><path d="M15.500 15.500L21 21" stroke="#2563EB" stroke-width="2.200"/>'),
        "⛶": S('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" stroke="#475569" stroke-width="2"/>'),
        "◗": S('<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" stroke="#475569" stroke-width="2"/>'),
        "📊": S('<rect x="3.500" y="12" width="4.500" height="8.500" rx="1.200" fill="#93C5FD" stroke="#2563EB"/><rect x="9.800" y="5" width="4.500" height="15.500" rx="1.200" fill="#6EE7B7" stroke="#059669"/><rect x="16" y="9" width="4.500" height="11.500" rx="1.200" fill="#FCD34D" stroke="#D97706"/>'),
        "👥": S('<circle cx="9" cy="8.500" r="3.300" fill="#FBCFE8" stroke="#DB2777"/><path d="M2.800 19.500c.4-3.300 2.800-5 6.200-5s5.800 1.700 6.200 5z" fill="#F9A8D4" stroke="#DB2777"/><circle cx="17" cy="9" r="2.700" fill="#BFDBFE" stroke="#2563EB"/><path d="M16.500 14.800c2.700-.2 4.500 1.200 4.900 4.200h-4.400" fill="#93C5FD" stroke="#2563EB"/>'),
        "🎯": S('<circle cx="12" cy="12" r="9" fill="#FECACA" stroke="#EF4444"/><circle cx="12" cy="12" r="5.200" fill="#fff" stroke="#EF4444"/><circle cx="12" cy="12" r="1.900" fill="#EF4444" stroke="#EF4444"/>'),
        "📈": S('<path d="M3.500 4v16.500H20.500" stroke="#64748B"/><path d="M6.500 15.500l4-4.500 3 3 5-6.500" stroke="#059669" stroke-width="2.200"/><path d="M15 7.500h4v4" stroke="#059669" stroke-width="2.200"/>'),
        "🎓": S('<path d="M12 4.500L2.500 9.500 12 14.500l9.500-5z" fill="#A5B4FC" stroke="#4F46E5"/><path d="M6.500 12v4.200c0 1.200 2.500 2.800 5.500 2.800s5.500-1.600 5.500-2.800V12" fill="#C7D2FE" stroke="#4F46E5"/><path d="M21.500 9.500v5" stroke="#4F46E5"/>'),
        "✕": S('<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.200"/>'),
        "🔄": S('<path d="M20 12a8 8 0 01-14 5.300M4 12a8 8 0 0114-5.300" stroke="#0D9488" stroke-width="2"/><path d="M18.500 3v4h-4M5.500 21v-4h4" stroke="#0D9488" stroke-width="2"/>'),
        "🏫": S('<path d="M3.500 21V10l8.500-5 8.500 5v11z" fill="#FDBA74" stroke="#EA580C"/><path d="M10 21v-5.500h4V21" fill="#fff" stroke="#EA580C"/><path d="M12 5V2.500M12 2.500h3" stroke="#EA580C"/><circle cx="12" cy="10.500" r="1.600" fill="#fff" stroke="#EA580C"/>'),
        "🏅": S('<path d="M8 3h3l1 5-3.500 1zM16 3h-3l-1 5 3.500 1z" fill="#FCA5A5" stroke="#DC2626"/><circle cx="12" cy="15" r="5.500" fill="#FCD34D" stroke="#D97706"/><path d="M12 12l1 2.100 2.300.3-1.700 1.600.4 2.300-2-1.100-2 1.100.4-2.300L8.700 14.400l2.300-.3z" fill="#fff" stroke="#D97706" stroke-width="1.200"/>'),
        "👑": S('<path d="M3.500 8l4.500 4 4-6.500 4 6.500 4.500-4-1.500 11H5z" fill="#FCD34D" stroke="#D97706"/><circle cx="3.500" cy="7.500" r="1.200" fill="#F59E0B" stroke="#D97706"/><circle cx="20.500" cy="7.500" r="1.200" fill="#F59E0B" stroke="#D97706"/>'),
        "✓": S('<path d="M5 12.500l4.500 4.500L19 7.500" stroke="currentColor" stroke-width="2.400"/>'),
        "🌱": S('<path d="M12 21v-9" stroke="#15803D"/><path d="M12 13c0-4 2.500-6.500 7-6.500 0 4-2.500 6.500-7 6.500z" fill="#86EFAC" stroke="#15803D"/><path d="M12 15c0-3-2-5-6-5 0 3 2 5 6 5z" fill="#BBF7D0" stroke="#15803D"/>'),
        "📝": S('<path d="M5 3.500h10l4 4V20.500H5z" fill="#FEF3C7" stroke="#D97706"/><path d="M15 3.500v4h4M8.500 12h7M8.500 15.500h7" stroke="#D97706"/>'),
        "🚩": S('<path d="M5.500 21V3.500" stroke="#475569" stroke-width="2"/><path d="M5.500 4.500h12.500l-2.600 4 2.600 4H5.500z" fill="#F87171" stroke="#DC2626"/>'),
        "🏛": S('<path d="M2.500 9.500L12 3.500l9.500 6z" fill="#C4B5FD" stroke="#7C3AED"/><path d="M5 10v8M9.500 10v8M14.500 10v8M19 10v8" stroke="#7C3AED"/><path d="M3 20.500h18" stroke="#7C3AED" stroke-width="2.200"/>'),
        "🌳": S('<path d="M12 21v-6" stroke="#92400E" stroke-width="2.200"/><circle cx="12" cy="9" r="6" fill="#86EFAC" stroke="#15803D"/><circle cx="8.500" cy="12" r="3.400" fill="#4ADE80" stroke="#15803D"/><circle cx="15.500" cy="12" r="3.400" fill="#4ADE80" stroke="#15803D"/>'),
        "🌾": S('<path d="M12 21.500V8" stroke="#B45309"/><path d="M12 8c-2.500-.5-3.500-2-3.500-4 2.500.3 3.500 1.800 3.500 4zM12 8c2.500-.5 3.500-2 3.500-4-2.500.3-3.500 1.800-3.500 4zM12 13c-2.500-.5-3.500-2-3.500-4 2.500.3 3.500 1.800 3.500 4zM12 13c2.500-.5 3.500-2 3.500-4-2.500.3-3.500 1.800-3.500 4z" fill="#FCD34D" stroke="#B45309" stroke-width="1.400"/>'),
        "🔒": S('<rect x="5" y="10.500" width="14" height="10" rx="2.200" fill="#FDE68A" stroke="#D97706"/><path d="M8 10.500V8a4 4 0 018 0v2.500" stroke="#D97706"/><circle cx="12" cy="15.500" r="1.400" fill="#D97706" stroke="#D97706"/>'),
        "🌐": S('<circle cx="12" cy="12" r="9" fill="#BAE6FD" stroke="#0284C7"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke="#0284C7"/>'),
        "🏢": S('<rect x="5" y="3.500" width="10" height="17" rx="1.400" fill="#BFDBFE" stroke="#2563EB"/><path d="M15 9.500h4.500v11H15" fill="#93C5FD" stroke="#2563EB"/><path d="M8 7.500h4M8 11h4M8 14.500h4" stroke="#2563EB"/>'),
        "📑": S('<path d="M7 3.500h9l3.500 3.500v12.500H7z" fill="#E0E7FF" stroke="#4F46E5"/><path d="M16 3.500V7h3.500" stroke="#4F46E5"/><path d="M4.500 7v14h11" stroke="#818CF8"/><path d="M10 11.500h6M10 15h6" stroke="#4F46E5"/>'),
        "👔": S('<circle cx="12" cy="7.500" r="3.500" fill="#FDE68A" stroke="#D97706"/><path d="M4.500 21c.4-4.300 3-6.500 7.500-6.500s7.100 2.200 7.500 6.500z" fill="#A5B4FC" stroke="#4F46E5"/><path d="M12 14.500l-1.400 2.200 1.400 3 1.400-3z" fill="#EF4444" stroke="#DC2626" stroke-width="1.200"/>'),
        "📄": S('<path d="M6 3.500h8.500L19 8v12.500H6z" fill="#E0F2FE" stroke="#0284C7"/><path d="M14.500 3.500V8H19M9 12.500h7M9 16h7" stroke="#0284C7"/>'),
        "⏳": S('<path d="M6.500 3h11M6.500 21h11" stroke="#B45309" stroke-width="2"/><path d="M7.500 3c0 5 4.500 5.500 4.500 9s-4.500 4-4.500 9h9c0-5-4.500-5.500-4.500-9s4.500-4 4.500-9z" fill="#FDE68A" stroke="#D97706"/>'),
        "⬇": S('<path d="M12 4v11.500M7 11l5 5 5-5" stroke="currentColor" stroke-width="2.200"/><path d="M5 20h14" stroke="currentColor" stroke-width="2.200"/>'),
        "🎪": S('<path d="M3 10l9-6 9 6z" fill="#F9A8D4" stroke="#DB2777"/><path d="M5 10v10h14V10" fill="#FBCFE8" stroke="#DB2777"/><path d="M10 20v-5a2 2 0 014 0v5" fill="#fff" stroke="#DB2777"/>'),
        "🗺": S('<path d="M3 6.500l6-2.500 6 2.500 6-2.500v13.500l-6 2.500-6-2.500-6 2.500z" fill="#BBF7D0" stroke="#15803D"/><path d="M9 4v13.500M15 6.500V20" stroke="#15803D"/>'),
        "🌿": S('<path d="M5 20c0-8 4-13 14-14-.5 9-5 14-12 14" fill="#86EFAC" stroke="#15803D"/><path d="M5 20L14 11" stroke="#15803D"/>'),
        "🎖": S('<path d="M8 2.500h3l1.500 6-3.500 1zM16 2.500h-3l-1.500 6 3.500 1z" fill="#93C5FD" stroke="#2563EB"/><circle cx="12" cy="15.500" r="5.500" fill="#FCD34D" stroke="#D97706"/><circle cx="12" cy="15.500" r="2.200" fill="#fff" stroke="#D97706"/>'),
        "💡": S('<path d="M12 3a6.500 6.500 0 00-3.800 11.800c.7.600 1 1.200 1 2V18h5.600v-1.200c0-.8.300-1.400 1-2A6.500 6.500 0 0012 3z" fill="#FDE68A" stroke="#D97706"/><path d="M9.800 21h4.400" stroke="#64748B"/>'),
        "💻": S('<rect x="4.500" y="5" width="15" height="10.500" rx="1.600" fill="#C7D2FE" stroke="#4F46E5"/><path d="M2.500 19.500h19l-1.500-4H4z" fill="#A5B4FC" stroke="#4F46E5"/>'),
        "🤝": S('<path d="M2.500 10.500l4-3 4 1.500 3-1.500 4 3.500 4-1" fill="none" stroke="#0D9488"/><path d="M6.500 7.500L2.500 10.500l6 6 2.500-1.500M17.500 11l4-1-3.500 7-3.500 2.500-6-5.500 3-2.500 4 2" fill="#99F6E4" stroke="#0D9488"/>')
    };
    ICONS["✏"] = ICONS["✎"];                 // the two pencils are the same icon

    // a run of emoji characters, with the optional variation selector some carry
    const ALL = new RegExp("(" + Object.keys(ICONS).concat(["✏"]).join("|") + ")\\uFE0F?", "g");
    const SKIP = /^(OPTION|SELECT|TEXTAREA|INPUT|SCRIPT|STYLE|SVG|CODE)$/i;

    function swapText(node) {
        const text = node.nodeValue;
        if (!text || !ALL.test(text)) { ALL.lastIndex = 0; return; }
        ALL.lastIndex = 0;
        const frag = document.createDocumentFragment();
        let last = 0, m;
        while ((m = ALL.exec(text))) {
            if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
            const holder = document.createElement("span");
            holder.className = "tp-ico-wrap";
            holder.innerHTML = ICONS[m[1]];
            frag.appendChild(holder);
            last = m.index + m[0].length;
        }
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag, node);
    }

    function swapIn(root) {
        if (!root) return;
        if (root.nodeType === 3) {                       // a bare text node
            if (root.parentNode && !SKIP.test(root.parentNode.nodeName)) swapText(root);
            return;
        }
        if (root.nodeType !== 1 || SKIP.test(root.nodeName)) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: (n) => SKIP.test((n.parentNode && n.parentNode.nodeName) || "") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
        });
        const found = [];
        while (walker.nextNode()) found.push(walker.currentNode);
        found.forEach(swapText);
    }

    function inInsight(node) {
        const el = node.nodeType === 1 ? node : node.parentNode;
        return !!(el && el.closest && el.closest("#tpRoot"));
    }

    function start() {
        const area = document.getElementById("pageContent");
        if (!area) return;
        new MutationObserver((records) => {
            records.forEach((r) => {
                if (r.type === "characterData") { if (inInsight(r.target)) swapIn(r.target); return; }
                r.addedNodes.forEach((n) => {
                    if (n.nodeType === 1 && n.id === "tpRoot") swapIn(n);
                    else if (inInsight(n)) swapIn(n);
                });
            });
        }).observe(area, { childList: true, subtree: true, characterData: true });
        swapIn(document.getElementById("tpRoot"));      // if the page is already open
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();

    window.OlfInsightIcons = { swapIn, ICONS };
})();
