/* =====================================================================
   theme.js — Light / Dark / System theme for OLF Staff Connect
   ---------------------------------------------------------------------
   UI ONLY. Nothing here reads or writes app data, Firebase or Supabase.

   1. Preference: "light" (default) | "dark" | "system", kept in
      localStorage. Applied to <html data-theme="light|dark"> before the
      page paints (this file is loaded in <head>), so there is no flash.
      "system" follows the OS setting live.

   2. Switcher: the segmented control in the top bar
      (#olfThemeSwitch, buttons with data-theme-choice).

   3. Adaptive dark layer: pages were built light-only with their own
      hard-coded colours. In dark mode this reads each same-origin
      stylesheet (including the <style> inside every page fragment as it
      is injected) and generates matching dark overrides scoped to
      html[data-theme="dark"]:
        light surfaces  -> dark raised surfaces (keeping their order, so
                           white cards stay "above" the canvas)
        dark text       -> light text (contrast preserved)
        pastel badges   -> dark tinted badges (hue kept)
        brand / status  -> same hue, lightness tuned for dark
        light borders   -> subtle dark hairlines
      Inline style colours set by page scripts are adapted the same way
      and restored exactly when switching back to light. In light mode
      nothing is generated and nothing changes.
      The shared chrome (top bar, sidebar, canvas) is designed by hand in
      the #olfThemeChrome stylesheet and is skipped here.
   ===================================================================== */
(function () {
    "use strict";

    var KEY = "olf_theme";
    var root = document.documentElement;
    var mql = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

    function readPref() {
        try {
            var v = localStorage.getItem(KEY);
            return v === "light" || v === "dark" || v === "system" ? v : "light";
        } catch (e) { return "light"; }
    }
    function resolve(pref) {
        if (pref === "system") return mql && mql.matches ? "dark" : "light";
        return pref;
    }

    var pref = readPref();
    var current = null;

    /* -------------------------------------------------------------
       COLOUR MATHS
    ------------------------------------------------------------- */
    var NAMED = {
        white: [255, 255, 255], black: [0, 0, 0], red: [255, 0, 0], green: [0, 128, 0],
        blue: [0, 0, 255], gray: [128, 128, 128], grey: [128, 128, 128], silver: [192, 192, 192],
        orange: [255, 165, 0], yellow: [255, 255, 0], whitesmoke: [245, 245, 245],
        gainsboro: [220, 220, 220], lightgray: [211, 211, 211], lightgrey: [211, 211, 211],
        aliceblue: [240, 248, 255], ghostwhite: [248, 248, 255], snow: [255, 250, 250],
        ivory: [255, 255, 240], linen: [250, 240, 230], beige: [245, 245, 220],
        lavender: [230, 230, 250], navy: [0, 0, 128], teal: [0, 128, 128],
        darkgray: [169, 169, 169], darkgrey: [169, 169, 169], dimgray: [105, 105, 105],
        lightyellow: [255, 255, 224], honeydew: [240, 255, 240], mintcream: [245, 255, 250],
        azure: [240, 255, 255], seashell: [255, 245, 238], oldlace: [253, 245, 230],
        floralwhite: [255, 250, 240], lightblue: [173, 216, 230], lightgreen: [144, 238, 144],
        pink: [255, 192, 203], crimson: [220, 20, 60], gold: [255, 215, 0], tomato: [255, 99, 71]
    };
    var COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^()]*\)|hsla?\([^()]*\)|\b(?:white|black|red|green|blue|gray|grey|silver|orange|yellow|whitesmoke|gainsboro|lightgray|lightgrey|aliceblue|ghostwhite|snow|ivory|linen|beige|lavender|navy|teal|darkgray|darkgrey|dimgray|lightyellow|honeydew|mintcream|azure|seashell|oldlace|floralwhite|lightblue|lightgreen|pink|crimson|gold|tomato)\b/g;

    function parseColor(str) {
        var s = str.trim().toLowerCase(), m;
        if (s[0] === "#") {
            var h = s.slice(1);
            if (h.length === 3 || h.length === 4) h = h.split("").map(function (c) { return c + c; }).join("");
            if (h.length !== 6 && h.length !== 8) return null;
            return {
                r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16),
                a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
            };
        }
        if ((m = s.match(/^rgba?\(([^)]*)\)$/))) {
            var p = m[1].replace(/\//g, " ").split(/[\s,]+/).filter(Boolean);
            if (p.length < 3) return null;
            var f = function (v, i) {
                if (v.indexOf("%") > -1) return parseFloat(v) * (i < 3 ? 2.55 : 0.01);
                return parseFloat(v);
            };
            return { r: f(p[0], 0), g: f(p[1], 1), b: f(p[2], 2), a: p[3] != null ? f(p[3], 3) : 1 };
        }
        if ((m = s.match(/^hsla?\(([^)]*)\)$/))) {
            var q = m[1].replace(/\//g, " ").split(/[\s,]+/).filter(Boolean);
            if (q.length < 3) return null;
            var rgb = hslToRgb(parseFloat(q[0]) / 360, parseFloat(q[1]) / 100, parseFloat(q[2]) / 100);
            var a = q[3] != null ? (q[3].indexOf("%") > -1 ? parseFloat(q[3]) / 100 : parseFloat(q[3])) : 1;
            return { r: rgb[0], g: rgb[1], b: rgb[2], a: a };
        }
        if (NAMED[s]) return { r: NAMED[s][0], g: NAMED[s][1], b: NAMED[s][2], a: 1 };
        return null;
    }
    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b), h = 0, s = 0, l = (max + min) / 2;
        if (max !== min) {
            var d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h /= 6;
        }
        return [h, s, l];
    }
    function hslToRgb(h, s, l) {
        if (s === 0) return [l * 255, l * 255, l * 255];
        var hue = function (p, q, t) {
            if (t < 0) t += 1; if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
        return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255];
    }
    function out(h, s, l, a) {
        var c = hslToRgb(h, Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, l)));
        var r = Math.round(c[0]), g = Math.round(c[1]), b = Math.round(c[2]);
        if (a >= 1) return "rgb(" + r + ", " + g + ", " + b + ")";
        return "rgba(" + r + ", " + g + ", " + b + ", " + Math.round(a * 1000) / 1000 + ")";
    }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    // Neutrals in dark mode lean towards the canvas's blue-slate hue so
    // greys never look muddy next to it.
    var NH = 0.605;   // ~218deg

    // Each mapper takes a parsed colour and returns a CSS colour string.
    var MAP = {
        bg: function (c) {
            if (c.a === 0) return null;
            var hsl = rgbToHsl(c.r, c.g, c.b), h = hsl[0], s = hsl[1], l = hsl[2];
            if (l < 0.32 && c.a < 0.35) return out(0, 0, 1, Math.min(c.a * 0.9, 0.12));   // subtle dark tint -> subtle light tint
            if (l >= 0.80) {
                if (s < 0.25 || l > 0.975) return out(s < 0.12 ? NH : h, s < 0.12 ? 0.17 : Math.min(s * 0.5, 0.2), 0.118 + (l - 0.80) / 0.20 * 0.058, c.a);
                return out(h, Math.min(s * 0.55, 0.45), 0.165 + (1 - l) * 0.15, c.a);          // pastel -> dark tint
            }
            if (l >= 0.45) {
                if (s < 0.15) return out(NH, 0.12, 0.29 + (l - 0.45) * 0.3, c.a);                // mid grey
                return out(h, s, Math.max(l * 0.92, 0.36), c.a);                                 // accent fill
            }
            return null;                                                                           // already dark
        },
        text: function (c) {
            if (c.a === 0) return null;
            var hsl = rgbToHsl(c.r, c.g, c.b), h = hsl[0], s = hsl[1], l = hsl[2];
            if (s < 0.25 || (l < 0.3 && s < 0.6)) {                                                // greys and dark "ink"
                if (l > 0.96) return null;                                                         // white on accents
                return out(s < 0.12 ? NH : h, s < 0.12 ? 0.14 : Math.min(s, 0.18), 0.94 - 0.62 * l, c.a);
            }
            if (l >= 0.62 && l <= 0.86) return null;
            return out(h, Math.min(s, 0.85), l < 0.62 ? 0.64 + l * 0.06 : 0.84, c.a);
        },
        border: function (c) {
            if (c.a === 0) return null;
            var hsl = rgbToHsl(c.r, c.g, c.b), h = hsl[0], s = hsl[1], l = hsl[2];
            if (l < 0.35 && c.a < 1) return out(0, 0, 1, Math.min(c.a * 1.15, 0.16));
            if (l >= 0.75) {
                if (s < 0.25) return out(NH, 0.14, 0.245 + (1 - l) * 0.15, c.a);
                return out(h, Math.min(s * 0.6, 0.5), 0.30, c.a);
            }
            if (l >= 0.45 && s < 0.15) return out(NH, 0.12, 0.33, c.a);
            return null;
        },
        shadow: function (c) {
            if (c.a === 0) return null;
            var hsl = rgbToHsl(c.r, c.g, c.b), s = hsl[1], l = hsl[2];
            if (l > 0.9) return out(0, 0, 1, Math.min(c.a * 0.06, 0.06));                       // highlights
            if (s < 0.35 || l < 0.5) return out(0, 0, 0, Math.min(Math.max(c.a * 2.2, 0.18), 0.6));
            return out(hsl[0], s, l, c.a * 0.8);                                                   // coloured glow
        },
        accent: function (c) {
            if (c.a === 0) return null;
            var hsl = rgbToHsl(c.r, c.g, c.b), h = hsl[0], s = hsl[1], l = hsl[2];
            if (s < 0.2) return l > 0.75 ? MAP.bg(c) : MAP.text(c);
            if (l >= 0.85) return MAP.bg(c);
            if (l >= 0.45 && l <= 0.72) return null;
            if (l < 0.45) return out(h, Math.min(s * 0.72, 0.62), 0.44, c.a);                       // deep brand -> calmer mid tone
            return out(h, s, 0.72, c.a);
        },
        graphic: function (c) {
            var hsl = rgbToHsl(c.r, c.g, c.b);
            if (hsl[1] < 0.2) return hsl[2] >= 0.75 ? MAP.border(c) : MAP.text(c);
            return MAP.accent(c);
        }
    };

    function roleForProp(prop) {
        if (prop === "background-color" || prop === "background-image" || prop === "background") return "bg";
        if (prop === "color" || prop === "-webkit-text-fill-color" || prop === "caret-color" ||
            prop === "text-decoration-color" || prop === "outline-color" || prop === "column-rule-color") return "text";
        if (prop.indexOf("border") === 0 && prop.indexOf("color") > -1) return "border";
        if (prop === "box-shadow" || prop === "text-shadow") return "shadow";
        if (prop === "fill" || prop === "stroke") return "graphic";
        return null;
    }
    // Page colour variables are classified by their names.
    function roleForVar(name, parsed) {
        var n = name.toLowerCase();
        if (/(^|-)(hdt|on|accent-on)$/.test(n)) return "keep";
        if (/(border|line|bd|hair|rule|divider|stroke|outline|sep)(\d*)$|(^|-)(l|l2)$/.test(n)) return "border";
        if (/(bg|surface|canvas|panel|card|soft|lt|light|fill|tint|hl|alt|wash|paper|base|track)(\d*)$|-bg-|surface/.test(n)) return "bg";
        if (/(text|ink|mut|muted|faint|fg|title|label|heading|graphite|slate)(\d*)$|text/.test(n)) return "text";
        if (parsed) {
            var hsl = rgbToHsl(parsed.r, parsed.g, parsed.b);
            if (hsl[2] >= 0.85) return "bg";
            if (hsl[1] < 0.2) return "text";
        }
        return "accent";
    }

    function mapValue(value, role) {
        if (!value || role === "keep") return null;
        var changed = false;
        var res = value.replace(COLOR_RE, function (tok) {
            if (/^(transparent|currentcolor|inherit)$/i.test(tok)) return tok;
            var c = parseColor(tok);
            if (!c) return tok;
            var m = MAP[role](c);
            if (m == null) return tok;
            changed = true;
            return m;
        });
        return changed ? res : null;
    }

    /* -------------------------------------------------------------
       STYLESHEET ADAPTER
    ------------------------------------------------------------- */
    var DARK = 'html[data-theme="dark"]';
    // Hand-designed chrome is skipped: it themes itself with tokens.
    var SKIP_SEL = /(^|[\s,>+~(])(:root|html|body)(?=$|[\s,.:#[>+~)])|\.topbar|\.tp-(avatar|name|dept|caret|text|group)\b|topbar|\.sidebar|#appSidebar|\.nav-item|\.nav-lock|\.app-body|\.content-area|\.theme-|#olfTheme|\.page-access/;
    var generated = new Map();   // source node -> generated <style>
    var pending = false;

    function splitSelectors(sel) {
        var parts = [], depth = 0, cur = "";
        for (var i = 0; i < sel.length; i++) {
            var ch = sel[i];
            if (ch === "(" || ch === "[") depth++;
            else if (ch === ")" || ch === "]") depth--;
            if (ch === "," && depth === 0) { parts.push(cur); cur = ""; } else cur += ch;
        }
        parts.push(cur);
        return parts.map(function (s) { return s.trim(); }).filter(Boolean);
    }
    function scope(sel) {
        return splitSelectors(sel).map(function (s) { return DARK + " " + s; }).join(", ");
    }

    var SHORTHANDS = [["background", "bg"], ["border", "border"], ["border-top", "border"], ["border-right", "border"],
        ["border-bottom", "border"], ["border-left", "border"], ["border-color", "border"], ["outline", "text"]];
    var VAR_RE = /var\(\s*(--[\w-]+)\s*(?:,[^()]*(?:\([^()]*\)[^()]*)*)?\)/g;

    // Colour variables: their light value, and how pages actually use them.
    var TOKENS = new Map();   // name -> Map(stylesheet -> value): pages may reuse a name with their own value
    var USES = new Map();     // name -> { bg, text, border }
    var REFBY = new Map();    // name -> Set of variables whose value is var(name)

    function eachDecl(rules, fn) {
        for (var i = 0; i < rules.length; i++) {
            var r = rules[i];
            if (r.type === 1) {
                if (!r.selectorText) continue;
                var st = r.style;
                for (var j = 0; j < st.length; j++) fn(st[j], st.getPropertyValue(st[j]), r);
                for (var k = 0; k < SHORTHANDS.length; k++) {
                    var v = st.getPropertyValue(SHORTHANDS[k][0]);
                    if (v && v.indexOf("var(") > -1) fn(SHORTHANDS[k][0], v, r, SHORTHANDS[k][1]);
                }
            } else if ((r.type === 4 || r.type === 12) && r.cssRules) eachDecl(r.cssRules, fn);
        }
    }
    function scanSheet(rules) {
        eachDecl(rules, function (prop, val, r, shRole) {
            if (!val) return;
            if (prop.indexOf("--") === 0) {
                var defs = TOKENS.get(prop) || new Map();
                if (!defs.has(r.parentStyleSheet)) defs.set(r.parentStyleSheet, val.trim());
                TOKENS.set(prop, defs);
                var a; VAR_RE.lastIndex = 0;
                while ((a = VAR_RE.exec(val))) {               // --c: var(--c1)  =>  --c1 is used like --c
                    var set = REFBY.get(a[1]) || new Set(); set.add(prop); REFBY.set(a[1], set);
                }
                return;
            }
            var role = shRole || roleForProp(prop);
            if (role !== "bg" && role !== "text" && role !== "border") return;
            var m; VAR_RE.lastIndex = 0;
            while ((m = VAR_RE.exec(val))) {
                var u = USES.get(m[1]) || { bg: 0, text: 0, border: 0 };
                u[role]++; USES.set(m[1], u);
            }
        });
    }
    // A variable's main role comes from its usage; names are the fallback.
    function usesOf(name, depth) {
        var u = USES.get(name), sum = { bg: 0, text: 0, border: 0 };
        if (u) { sum.bg += u.bg; sum.text += u.text; sum.border += u.border; }
        if (depth < 4 && REFBY.has(name)) REFBY.get(name).forEach(function (p) {
            var v = usesOf(p, depth + 1); sum.bg += v.bg; sum.text += v.text; sum.border += v.border;
        });
        return sum;
    }
    function tokenRole(name, parsed) {
        var u = usesOf(name, 0);
        if (u && (u.bg || u.text || u.border)) {
            if (u.text >= u.bg && u.text >= u.border) return "text";
            return u.bg >= u.border ? "bg" : "border";
        }
        return roleForVar(name, parsed);
    }
    function isSingleColor(v) {
        var s = v && v.trim(), m = s && s.match(COLOR_RE);
        return !!(m && m.length === 1 && s === m[0]);
    }
    // Where a variable is used in a different role than its main one,
    // put the right dark value in that rule directly.
    // The variable's value as seen from this stylesheet: its own definition,
    // else the only one there is. Ambiguous names are left alone.
    function tokenValue(name, sheet) {
        var defs = TOKENS.get(name);
        if (!defs) return null;
        if (sheet && defs.has(sheet)) return defs.get(sheet);
        var vals = new Set(defs.values());
        return vals.size === 1 ? vals.values().next().value : null;
    }
    function substituteVars(val, role, sheet) {
        if (val.indexOf("var(") < 0) return val;
        return val.replace(VAR_RE, function (whole, name) {
            var def = tokenValue(name, sheet);
            if (!def || !isSingleColor(def)) return whole;
            var parsed = parseColor(def);
            if (!parsed || tokenRole(name, parsed) === role) return whole;
            return MAP[role](parsed) || def;
        });
    }

    function convertRules(rules) {
        var css = "";
        for (var i = 0; i < rules.length; i++) {
            var r = rules[i];
            if (r.type === 1) {                                   // style rule
                if (!r.selectorText || SKIP_SEL.test(r.selectorText)) continue;
                var decl = "", st = r.style, changed = false;
                for (var j = 0; j < st.length; j++) {
                    var prop = st[j], val = st.getPropertyValue(prop), role, mapped;
                    if (!val) continue;
                    var imp = st.getPropertyPriority(prop) ? " !important" : "";
                    if (prop.indexOf("--") === 0) {
                        if (isSingleColor(val)) {
                            role = tokenRole(prop, parseColor(val.trim()));
                        } else {
                            role = /shadow/.test(prop) ? "shadow" : /grad|bg|surface/.test(prop) ? "bg" : null;
                            if (!role) continue;
                        }
                        mapped = mapValue(val, role);
                        if (mapped) changed = true;
                        decl += prop + ":" + (mapped || val) + imp + ";";
                        continue;
                    }
                    role = roleForProp(prop);
                    if (!role) {
                        // Keep the rest of the background / border / outline
                        // family with the colours, so a shorthand from another
                        // generated rule can never reset it (e.g. no-repeat).
                        if (/^(background|border|outline)-/.test(prop)) decl += prop + ":" + val + imp + ";";
                        continue;
                    }
                    var sub = role === "shadow" || role === "graphic" ? val : substituteVars(val, role, r.parentStyleSheet);
                    mapped = mapValue(sub, role) || (sub !== val ? sub : null);
                    if (mapped) changed = true;
                    // Unchanged colours are re-emitted too, so the cascade
                    // between rules stays exactly as it is in light mode.
                    decl += prop + ":" + (mapped || val) + imp + ";";
                }
                // Shorthands that contain var() keep their longhands empty in
                // the CSSOM, so read and map the shorthand itself.
                for (var k = 0; k < SHORTHANDS.length; k++) {
                    var sh = SHORTHANDS[k][0], shv = st.getPropertyValue(sh);
                    if (!shv || shv.indexOf("var(") < 0) continue;
                    var shs = substituteVars(shv, SHORTHANDS[k][1], r.parentStyleSheet);
                    var shm = mapValue(shs, SHORTHANDS[k][1]) || (shs !== shv ? shs : null);
                    if (shm) changed = true;
                    decl += sh + ":" + (shm || shv) + (st.getPropertyPriority(sh) ? " !important" : "") + ";";
                }
                if (decl) css += scope(r.selectorText) + "{" + decl + "}\n";
            } else if (r.type === 4 && r.cssRules) {              // @media
                var inner = convertRules(r.cssRules);
                if (inner) css += "@media " + r.media.mediaText + "{" + inner + "}\n";
            } else if (r.type === 12 && r.cssRules) {             // @supports
                var inner2 = convertRules(r.cssRules);
                if (inner2) css += "@supports " + r.conditionText + "{" + inner2 + "}\n";
            }
        }
        return css;
    }

    function rulesOf(sheet) {
        var node = sheet.ownerNode;
        if (!node || generated.has(node)) return null;
        if (node.hasAttribute && (node.hasAttribute("data-theme-skip") || node.hasAttribute("data-theme-generated"))) return null;
        try { return sheet.cssRules || null; } catch (e) { return null; }   // cross-origin (fonts)
    }
    function adaptSheet(sheet, rules) {
        var node = sheet.ownerNode;
        var css = convertRules(rules);
        var gen = document.createElement("style");
        gen.setAttribute("data-theme-generated", "");
        gen.textContent = css;
        document.head.appendChild(gen);
        generated.set(node, gen);
    }

    function adaptAllSheets() {
        // Drop overrides whose source left the page (old page fragments).
        generated.forEach(function (gen, src) {
            if (!src.isConnected) { gen.remove(); generated.delete(src); }
        });
        var sheets = document.styleSheets, todo = [];
        for (var i = 0; i < sheets.length; i++) {
            var rules = rulesOf(sheets[i]);
            if (rules) { scanSheet(rules); todo.push([sheets[i], rules]); }
        }
        for (var j = 0; j < todo.length; j++) adaptSheet(todo[j][0], todo[j][1]);
    }

    /* -------------------------------------------------------------
       INLINE STYLES (colours set from page scripts)
    ------------------------------------------------------------- */
    var inlineState = new WeakMap();   // el -> { prop: {orig, mapped, prio} }
    var touched = new Set();
    var INLINE_PROPS = ["color", "background-color", "background-image", "border-top-color", "border-right-color",
        "border-bottom-color", "border-left-color", "box-shadow", "fill", "stroke", "outline-color"];

    function adaptInline(el) {
        var st = el.style;
        if (!st || !st.length) return;
        if (el.closest && el.closest("#appSidebar, .topbar")) return;
        var rec = inlineState.get(el) || {};
        var any = false;
        for (var i = 0; i < INLINE_PROPS.length; i++) {
            var p = INLINE_PROPS[i], v = st.getPropertyValue(p);
            if (!v) continue;
            var prev = rec[p];
            if (prev && prev.mapped === v) continue;               // already ours
            var m = mapValue(v, roleForProp(p));
            if (!m) { if (prev) delete rec[p]; continue; }
            var prio = st.getPropertyPriority(p);
            st.setProperty(p, m, prio);
            rec[p] = { orig: v, mapped: st.getPropertyValue(p), prio: prio };
            any = true;
        }
        if (any) { inlineState.set(el, rec); touched.add(el); }
    }
    function adaptInlineIn(node) {
        if (node.nodeType !== 1) return;
        if (node.hasAttribute("style")) adaptInline(node);
        var list = node.querySelectorAll ? node.querySelectorAll("[style]") : [];
        for (var i = 0; i < list.length; i++) adaptInline(list[i]);
    }
    function restoreInline() {
        touched.forEach(function (el) {
            var rec = inlineState.get(el);
            if (!rec || !el.style) return;
            Object.keys(rec).forEach(function (p) {
                if (el.style.getPropertyValue(p) === rec[p].mapped) el.style.setProperty(p, rec[p].orig, rec[p].prio);
            });
            inlineState.delete(el);
        });
        touched.clear();
    }

    /* -------------------------------------------------------------
       OBSERVER — page fragments, injected styles, script-made markup
    ------------------------------------------------------------- */
    var observer = null;
    function onMutations(list) {
        if (current !== "dark") return;
        var sheetsChanged = false;
        for (var i = 0; i < list.length; i++) {
            var m = list[i];
            if (m.type === "attributes") { adaptInline(m.target); continue; }
            for (var j = 0; j < m.addedNodes.length; j++) {
                var n = m.addedNodes[j];
                if (n.nodeType !== 1) continue;
                if (n.tagName === "STYLE" && !n.hasAttribute("data-theme-generated")) sheetsChanged = true;
                else if (n.tagName === "LINK") n.addEventListener("load", adaptAllSheets, { once: true });
                else {
                    if (n.querySelector && n.querySelector("style")) sheetsChanged = true;
                    adaptInlineIn(n);
                }
            }
            if (m.removedNodes.length) sheetsChanged = true;
        }
        if (sheetsChanged) adaptAllSheets();
    }
    function startObserver() {
        if (observer || !window.MutationObserver) return;
        observer = new MutationObserver(onMutations);
        observer.observe(document.documentElement, {
            subtree: true, childList: true, attributes: true, attributeFilter: ["style"]
        });
    }

    /* -------------------------------------------------------------
       APPLY
    ------------------------------------------------------------- */
    function setMetaColor(theme) {
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", theme === "dark" ? "#161A21" : "#E0E8F6");
    }

    function apply(theme) {
        if (theme === current) return;
        current = theme;
        root.setAttribute("data-theme", theme);
        root.style.colorScheme = theme;
        setMetaColor(theme);
        if (theme === "dark") {
            if (document.readyState === "loading") return;          // done on DOMContentLoaded
            adaptAllSheets();
            adaptInlineIn(document.body);
            startObserver();
        } else {
            restoreInline();
        }
    }

    function paintSwitch() {
        var group = document.getElementById("olfThemeSwitch");
        if (!group) return;
        var btns = group.querySelectorAll("[data-theme-choice]");
        for (var i = 0; i < btns.length; i++) {
            var on = btns[i].getAttribute("data-theme-choice") === pref;
            btns[i].setAttribute("aria-checked", on ? "true" : "false");
            btns[i].tabIndex = on ? 0 : -1;
        }
    }

    function setPref(p) {
        pref = p;
        try { localStorage.setItem(KEY, p); } catch (e) {}
        // Smooth cross-fade of colours, only for this deliberate switch.
        root.classList.add("theme-switching");
        apply(resolve(pref));
        paintSwitch();
        setTimeout(function () { root.classList.remove("theme-switching"); }, 320);
    }

    function wireSwitch() {
        var group = document.getElementById("olfThemeSwitch");
        if (!group || group.dataset.wired) return;
        group.dataset.wired = "1";
        group.addEventListener("click", function (e) {
            var b = e.target.closest("[data-theme-choice]");
            if (b) setPref(b.getAttribute("data-theme-choice"));
        });
        // Radio-group keyboard pattern: arrows move and select.
        group.addEventListener("keydown", function (e) {
            var order = ["light", "dark", "system"], i = order.indexOf(pref), n = -1;
            if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % 3;
            else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i + 2) % 3;
            if (n < 0) return;
            e.preventDefault();
            setPref(order[n]);
            var b = group.querySelector('[data-theme-choice="' + order[n] + '"]');
            if (b) b.focus();
        });
        paintSwitch();
    }

    // 1) Before first paint.
    apply(resolve(pref));

    // 2) Follow the OS while on "system".
    if (mql) {
        var onOs = function () { if (pref === "system") apply(resolve("system")); };
        if (mql.addEventListener) mql.addEventListener("change", onOs); else if (mql.addListener) mql.addListener(onOs);
    }

    // 3) Once the DOM exists: adapt sheets if dark, wire the switcher.
    function ready() {
        wireSwitch();
        if (current === "dark") {
            adaptAllSheets();
            adaptInlineIn(document.body);
            startObserver();
        }
        // Linked stylesheets that finish loading later.
        window.addEventListener("load", function () { if (current === "dark") adaptAllSheets(); });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
    else ready();

    window.OLFTheme = {
        get: function () { return pref; },
        set: function (p) { if (p === "light" || p === "dark" || p === "system") setPref(p); }
    };
})();
