/*************************************************************
 * profile.js — top bar profile chip + auto-generated ID card
 * -----------------------------------------------------------
 * Reads the signed-in person's row from the Employees directory
 * (app.js puts it on window.__olfEmployee and fires
 * "olf:profile-ready") and renders:
 *
 *   • the chip in the top bar  — initials, name, department
 *   • an ID card panel         — every column the directory holds
 *   • Sign out                 — the original #logoutBtn, moved
 *                                inside the panel, so app.js's
 *                                existing click handler still owns it
 *
 * Plain script, no build step, namespaced with an olfp* / #olf* prefix.
 *************************************************************/
(function () {
    "use strict";

    /* Header of the card shows these, so they are not repeated in the
       field list below it. */
    const IN_HEADER = new Set(["Name", "Designation"]);

    /* Preferred order; anything else the directory holds (Blood Group,
       Date of Joining, whatever gets added later) is appended after. */
    const FIELD_ORDER = ["Dept", "Location", "Mobile", "Email", "Reporting manager"];

    /* Directory keys are terse; the card is read by people. */
    const LABELS = {
        Dept: "Department",
        Mobile: "Phone",
        "Reporting manager": "Reporting Manager"
    };

    let open = false;

    function el(id) { return document.getElementById(id); }

    function escHtml(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function initials(name) {
        const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return "U";
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    function labelFor(key) { return LABELS[key] || key; }

    /* ---------- render ---------- */

    function render() {
        const rec = window.__olfEmployee || null;
        const user = window.__olfUser || {};
        const name = (rec && rec.Name) || user.displayName || "Staff";

        // ---- chip ----
        const chipDept = el("topbarDept");
        if (chipDept) {
            // Department is the point of the chip; role is the fallback
            // when someone (an admin, say) has no directory row.
            chipDept.textContent = (rec && rec.Dept) || user.role || "\u2014";
        }
        const chipName = el("topbarName");
        if (chipName) chipName.textContent = name;
        const chipAvatar = el("topbarAvatar");
        if (chipAvatar) chipAvatar.textContent = initials(name);

        // ---- card header ----
        const idInitials = el("olfIdInitials");
        if (idInitials) idInitials.textContent = initials(name);
        const idName = el("olfIdName");
        if (idName) idName.textContent = name;
        const idDesig = el("olfIdDesignation");
        if (idDesig) {
            idDesig.textContent = (rec && rec.Designation) || user.role || "";
            idDesig.style.display = idDesig.textContent ? "" : "none";
        }

        // ---- card fields ----
        const box = el("olfIdFields");
        if (!box) return;

        if (!rec) {
            // No directory row: say so plainly and show what we do know.
            box.innerHTML =
                row("Email", user.email || "\u2014") +
                row("Access", user.role || "User") +
                '<div class="olf-id-note">No directory record found for this account, ' +
                'so only sign-in details are shown. Ask IT to add you to the ' +
                'employee directory.</div>';
            return;
        }

        const keys = FIELD_ORDER
            .filter(k => k in rec)
            .concat(Object.keys(rec).filter(k =>
                k !== "id" && !IN_HEADER.has(k) && FIELD_ORDER.indexOf(k) < 0));

        let html = row("Employee Number", rec.id);
        keys.forEach(k => {
            const v = rec[k];
            if (v === undefined || v === null || String(v).trim() === "") return;
            html += row(labelFor(k), v);
        });
        box.innerHTML = html;
    }

    function row(label, value) {
        return '<div class="olf-id-row">' +
               '<span class="olf-id-key">' + escHtml(label) + '</span>' +
               '<span class="olf-id-val" title="' + escHtml(value) + '">' + escHtml(value) + '</span>' +
               '</div>';
    }

    /* ---------- open / close ---------- */

    function setOpen(next) {
        open = next;
        const card = el("olfIdCard");
        const back = el("olfIdBackdrop");
        const btn = el("olfProfileBtn");
        if (card) card.hidden = !open;
        if (back) back.hidden = !open;
        if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) render();   // always show the freshest values
    }

    function wire() {
        const btn = el("olfProfileBtn");
        if (!btn || btn.dataset.wired === "1") return;
        btn.dataset.wired = "1";

        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            setOpen(!open);
        });

        const back = el("olfIdBackdrop");
        if (back) back.addEventListener("click", () => setOpen(false));

        const closeBtn = el("olfIdClose");
        if (closeBtn) closeBtn.addEventListener("click", () => setOpen(false));

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && open) setOpen(false);
        });

        // Navigating away should not leave the card floating over the page.
        document.querySelectorAll("#appSidebar .nav-item").forEach(n => {
            n.addEventListener("click", () => setOpen(false));
        });
    }

    /* ---------- boot ---------- */

    function boot() {
        wire();
        render();                      // paint whatever is known already
    }

    // app.js fires this once the directory lookup finishes; it may land
    // before or after this script runs, so handle both orders.
    document.addEventListener("olf:profile-ready", render);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }

    window.olfpRefreshProfile = render;   // for manual re-render if needed
})();