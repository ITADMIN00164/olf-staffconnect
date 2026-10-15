/* ===========================================================================
 *  Supabase connection.
 *
 *  Both values are meant to be public. The publishable key is the browser-side
 *  key and is safe to ship in frontend code; what actually guards the data is
 *  Row Level Security, defined in supabase/schema.sql.
 *
 *  NEVER put the secret / service_role key here, or the database password from
 *  the direct connection string. Either one bypasses RLS.
 *
 *  To point this at a different project: Supabase Dashboard -> Connect ->
 *  copy Project URL and Publishable key.
 * ======================================================================== */

window.AWARD_CONFIG = {
  SUPABASE_URL: "https://rpnxpkwcpsbxswnowuhx.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_60Ynb6EZ6Qc2GHrdqERwpw_dUdH3dKD",
};

/* Award Management — the Staff Connect tab.
 *
 * Ported from the standalone page. Loaded after the Supabase UMD bundle that
 * index.html already pulls in for the other Supabase-backed pages; this one
 * talks to a different project, so it keeps its own client.
 *
 * The requester is no longer typed - it is whoever is signed in, taken from
 * their Employees record where there is one. The log stays append-only: RLS
 * grants select and insert only, so nothing here can edit or delete.
 */
(function () {
  "use strict";

  // ---------------------------------------------------------------- config

  var PLACEHOLDER = /YOUR-PROJECT-REF|YOUR-ANON-PUBLIC-KEY/;
  var cfg = window.AWARD_CONFIG || {};
  var db = null;

  // --------------------------------------------------------------- element

  // Re-read on every mount: this page is a fragment the shell fetches when the
  // tab is opened, so these nodes do not exist at load time and are thrown
  // away and rebuilt each visit.
  var el = {};

  function cacheElements() {
    el = {
    setupBanner: document.getElementById("setup-banner"),
    setupTitle: document.getElementById("setup-banner-title"),
    setupDetail: document.getElementById("setup-banner-detail"),

    form: document.getElementById("requisition-form"),
    state: document.getElementById("state"),
    district: document.getElementById("district"),
    awardType: document.getElementById("award-type"),
    requesterName: document.getElementById("requester-name"),
    division: document.getElementById("division"),
    requesterWho: document.getElementById("requester-who"),
    requesterSub: document.getElementById("requester-sub"),
    quantity: document.getElementById("quantity"),
    reqDate: document.getElementById("req-date"),
    submitBtn: document.getElementById("submit-btn"),
    resetBtn: document.getElementById("reset-btn"),
    formBanner: document.getElementById("form-banner"),
    formBannerIcon: document.getElementById("form-banner-icon"),
    formBannerText: document.getElementById("form-banner-text"),

    refreshBtn: document.getElementById("refresh-btn"),
    tabs: document.querySelectorAll(".award-page .aw-tab"),
    subtabs: document.querySelectorAll(".award-page .aw-subtab"),
    modal: document.getElementById("requisition-modal"),
    newReqBtn: document.getElementById("new-req-btn"),
    listBanner: document.getElementById("list-banner"),
    listBannerText: document.getElementById("list-banner-text"),
    standingNote: document.getElementById("standing-note"),
    filterStatus: document.getElementById("filter-status"),
    reviewModal: document.getElementById("review-modal"),
    reviewSummary: document.getElementById("review-summary"),
    reviewRemark: document.getElementById("review-remark"),
    reviewBanner: document.getElementById("review-banner"),
    reviewBannerText: document.getElementById("review-banner-text"),
    reviewApprove: document.getElementById("review-approve"),
    reviewDecline: document.getElementById("review-decline"),
    filterState: document.getElementById("filter-state"),
    filterDivision: document.getElementById("filter-division"),
    filterDistrict: document.getElementById("filter-district"),
    filterType: document.getElementById("filter-type"),
    filterSearch: document.getElementById("filter-search"),

    tbody: document.getElementById("requisitions-body"),
    tfoot: document.getElementById("requisitions-foot"),
    rowPill: document.getElementById("row-pill"),
    footCount: document.getElementById("foot-count"),
    footTotal: document.getElementById("foot-total"),
    };
  }

  // Every requisition row we've loaded; filtering happens in the browser.
  var allRequisitions = [];

  /* A requisition carries its own decision: status says where it stands,
     and the decided_* columns say who settled it, when and why. They arrive
     with the approvals migration; until it is run the row is read without
     them and everything shows as pending. */
  var hasApproval = true;

  function statusOf(row) {
    var d = String((row && row.status) || "submitted").toLowerCase();
    if (d === "approved" || d === "declined") {
      return { decision: d, by: row.decided_by, byRole: row.decided_by_role,
               remark: row.decision_remark, at: row.decided_at };
    }
    return { decision: null };
  }

  /* ------------------------------------------------------------------
     Who may raise a requisition, and who may decide on one.

     Both come from the Department recorded against the person in Employees.
     Four levels, and an approver has to sit above the level the requisition
     was raised at:

       4  COO   Program Implementation COO    decides on DM, PM and PO
       3  DM    Program Implementation Div    decides on PM and PO
       2  PM    Program Implementation PM     decides on PO
       1  PO    Program Implementation        raises only

     Raising is for PO, PM and DM. The COO decides rather than asks.

     The directory spells PO two ways - 94 people are plain "Program
     Implementation" and one is "Program Implementation - PO" - so the
     patterns are anchored and allow the separator rather than matching on a
     prefix, which would have made every variant look like a PO. Anyone in
     any other department, or in none, has no part in this.
     ------------------------------------------------------------------ */
  var ROLE_PATTERNS = [
    { re: /^program implementation\s*[-–]?\s*coo$/, role: "COO", level: 4 },
    { re: /^program implementation\s*[-–]?\s*div$/, role: "DM",  level: 3 },
    { re: /^program implementation\s*[-–]?\s*pm$/,  role: "PM",  level: 2 },
    { re: /^program implementation\s*[-–]?\s*po$/,  role: "PO",  level: 1 },
    { re: /^program implementation$/,                       role: "PO",  level: 1 }
  ];

  var ROLE_TITLES = {
    PO:  "Programme Officer",
    PM:  "Programme Manager",
    DM:  "Divisional Manager",
    COO: "Chief Operating Officer"
  };

  // What someone's department makes them, or null if it makes them nothing.
  function roleOfDepartment(dept) {
    var d = String(dept || "").trim().toLowerCase().replace(/\s+/g, " ");
    for (var i = 0; i < ROLE_PATTERNS.length; i++) {
      if (ROLE_PATTERNS[i].re.test(d)) {
        return { role: ROLE_PATTERNS[i].role, level: ROLE_PATTERNS[i].level };
      }
    }
    return null;
  }

  /* The signed-in person's standing. Null for anyone outside Programme
     Implementation, anyone with no Employees record at all (an admin
     account, say), and anyone marked Inactive - a leaver should not be
     raising or approving anything. */
  function myStanding() {
    var emp = window.__olfEmployee;
    if (!emp) return null;
    if (String(emp["Status"] || "Active").trim().toLowerCase() === "inactive") return null;
    return roleOfDepartment(emp["Dept"]);
  }

  function canRaise(standing)  { return !!standing && standing.level <= 3; }

  /* Legacy rows carry no level: they were filed before the role was
     recorded. Treating them as the lowest keeps them actionable rather than
     stranding them, which is the kinder failure for three test rows. */
  function levelRaisedAt(row) {
    var n = Number(row && row.requester_level);
    return n >= 1 && n <= 4 ? n : 1;
  }

  function canDecide(standing, row) {
    if (!standing) return false;
    if (statusOf(row).decision) return false;        // already settled
    return standing.level > levelRaisedAt(row);
  }

  /* The name on a requisition comes from the signed-in user, preferring their
     Employees record - that is the name the rest of the directory shows - over
     whatever Google has as a display name. */
  function signedInUser() {
    var emp  = window.__olfEmployee || null;
    var user = window.__olfUser || null;

    var name = (emp && String(emp["Name"] || "").trim()) ||
               (user && String(user.displayName || "").trim()) || "";
    var mail = (user && String(user.email || "").trim()) ||
               (emp && String(emp["Email"] || "").trim()) || "";
    var role = (emp && String(emp["Designation"] || "").trim()) || "";

    if (!name && mail) name = mail.split("@")[0];
    return name ? { name: name, email: mail, role: role } : null;
  }

  function showSignedInUser() {
    var who = signedInUser();
    if (!el.requesterName) return;

    if (!who) {
      el.requesterName.textContent = "Not signed in";
      el.requesterSub.textContent = "";
      if (el.requesterWho) el.requesterWho.removeAttribute("title");
      return;
    }

    el.requesterName.textContent = who.name;

    // Their job title rather than their address: it is shorter, it is what the
    // header beside it shows, and a full address made the field the loudest
    // thing in the row. The address is still there on hover for anyone
    // checking which account they are filing under.
    el.requesterSub.textContent = who.role || who.email || "";
    if (el.requesterWho && who.email) el.requesterWho.title = who.email;
  }

  // ----------------------------------------------------------- small utils

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function todayLocalISO() {
    var now = new Date();
    var m = String(now.getMonth() + 1).padStart(2, "0");
    var d = String(now.getDate()).padStart(2, "0");
    return now.getFullYear() + "-" + m + "-" + d;
  }

  // 'YYYY-MM-DD' -> '12 Oct 2026'. Split by hand rather than using Date(),
  // which would read a bare date string as UTC and shift it a day.
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function formatDate(iso) {
    if (!iso) return "—";
    var parts = String(iso).slice(0, 10).split("-");
    if (parts.length !== 3) return iso;
    var month = MONTHS[Number(parts[1]) - 1] || parts[1];
    return Number(parts[2]) + " " + month + " " + parts[0];
  }

  function formatTimestamp(value) {
    if (!value) return "—";
    var dt = new Date(value);
    if (isNaN(dt.getTime())) return String(value);
    var hh = String(dt.getHours()).padStart(2, "0");
    var mm = String(dt.getMinutes()).padStart(2, "0");
    return formatDate(
      dt.getFullYear() + "-" +
      String(dt.getMonth() + 1).padStart(2, "0") + "-" +
      String(dt.getDate()).padStart(2, "0")
    ) + ", " + hh + ":" + mm;
  }

  function setFieldError(input, errorId, message) {
    var node = document.getElementById(errorId);
    if (node) node.textContent = message || "";
    if (input) input.classList.toggle("invalid", Boolean(message));
  }

  function clearFieldErrors() {
    ["state", "division", "district", "award-type", "requester", "quantity", "req-date"]
      .forEach(function (id) {
        var node = document.getElementById(id + "-error");
        if (node) node.textContent = "";
        var input = document.getElementById(id);
        if (input) input.classList.remove("invalid");
      });
  }

  /* The icons are drawn from here rather than written into the fragment.

     Inline <svg> in a page fragment is a liability: Live Server treats a
     fragment containing one as a document to inject its reload script into,
     and with several of them the response comes back truncated - the form
     went missing entirely. A fragment that is plain markup is served
     untouched. Keeping them here also means one copy of each. */
  var ICONS = {
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="2" stroke-linecap="round">' +
           '<path d="M12 8v5M12 16.5v.01"/><circle cx="12" cy="12" r="9"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
           '<path d="m4.5 12.5 5 5 10-11"/></svg>',
    plus:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="2.2" stroke-linecap="round">' +
           '<path d="M12 5v14M5 12h14"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="2" stroke-linecap="round">' +
           '<path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  function paintIcons() {
    Array.prototype.forEach.call(
      document.querySelectorAll(".award-page [data-aw-icon]"),
      function (node) {
        var svg = ICONS[node.getAttribute("data-aw-icon")];
        if (svg) node.innerHTML = svg;
      }
    );
  }

  var ICON_CHECK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.5 5 5 10-11"/></svg>';

  var ICON_ALERT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round"><path d="M12 8v5M12 16.5v.01"/><circle cx="12" cy="12" r="9"/></svg>';

  // kind: "ok" -> green banner with a tick, "bad" -> red banner with an alert.
  function setFormStatus(message, kind) {
    if (!message) {
      el.formBanner.hidden = true;
      el.formBannerText.textContent = "";
      return;
    }
    var bad = kind === "bad";
    el.formBannerIcon.innerHTML = bad ? ICON_ALERT : ICON_CHECK;
    el.formBannerText.textContent = message;
    el.formBanner.className = "banner " + (bad ? "banner-error" : "banner-success");
    el.formBanner.hidden = false;
  }

  function setRowPill(text) {
    if (el.rowPill) el.rowPill.textContent = text;
  }

  function showSetupBanner(html, title) {
    if (title) el.setupTitle.textContent = title;
    el.setupDetail.innerHTML = html;
    el.setupBanner.hidden = false;
  }

  function placeholderRow(message) {
    setRowPill(allRequisitions.length === 1 ? "1 item" : allRequisitions.length + " items");
    // Counted from the table rather than written down: the column count has
    // changed three times and a stale number leaves the message short of the
    // width, with a ragged edge where the row stops.
    var cols = document.querySelectorAll("#requisitions-table thead th").length || 1;
    el.tbody.innerHTML =
      '<tr class="placeholder-row"><td colspan="' + cols + '">' +
      escapeHtml(message) + "</td></tr>";
    el.tfoot.hidden = true;
  }

  // Replace a <select>'s options, keeping the current value if it survives.
  function fillSelect(select, items, firstLabel, getValue, getLabel) {
    var previous = select.value;
    var html = '<option value="">' + escapeHtml(firstLabel) + "</option>";
    items.forEach(function (item) {
      html += '<option value="' + escapeHtml(getValue(item)) + '">' +
              escapeHtml(getLabel(item)) + "</option>";
    });
    select.innerHTML = html;
    if (previous && select.querySelector('option[value="' + previous + '"]')) {
      select.value = previous;
    }
  }

  // ------------------------------------------------------------- bootstrap

  function mount() {
    cacheElements();
    if (!el.form) return;        // the tab is not on screen

    allRequisitions = [];
    returnFocusTo = null;          // the node it pointed at is gone
    scrollLockedAt = null;
    document.body.style.overflow = "";   // in case we left with it locked
    paintIcons();
    showSignedInUser();
    applyStanding();
    showTab(el.tabs, "data-aw-tab", "stock");
    showTab(el.subtabs, "data-aw-subtab", "requisition");

    el.reqDate.value = todayLocalISO();
    el.reqDate.max = todayLocalISO();

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      showSetupBanner(
        "Check your internet connection — the page pulls the library from " +
        "the jsDelivr CDN on first load — then reload.",
        "The Supabase library did not load."
      );
      disableForm();
      placeholderRow("Supabase library unavailable.");
      return;
    }

    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY ||
        PLACEHOLDER.test(cfg.SUPABASE_URL) ||
        PLACEHOLDER.test(cfg.SUPABASE_ANON_KEY)) {
      showSetupBanner(
        "Open <code>app.js</code> and replace the two placeholder values at the " +
        "top with your project's <strong>Project URL</strong> and " +
        "<strong>anon public key</strong> (Supabase Dashboard → Project " +
        "Settings → API), then reload this page. See " +
        "<code>README.md</code> for the full setup steps."
      );
      disableForm();
      placeholderRow("Waiting for Supabase credentials at the top of app.js.");
      return;
    }

    // One client for the life of the page, not one per visit to the tab.
    if (!db) db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

    wireEvents();
    loadGeography();
    loadAwardTypes();
    loadRequisitions();
  }

  // ------------------------------------------------------------- the tabs

  /* Two levels of them - Stock Management, and Requisition inside it - so
     this works off each button's own attribute and the panel it names,
     rather than a list that would have to be kept in step with the markup. */
  function showTab(buttons, attr, name) {
    Array.prototype.forEach.call(buttons, function (tab) {
      var on = tab.getAttribute(attr) === name;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
      // Only the selected tab is in the tab order; the arrow keys move
      // between them, which is how a tablist is meant to behave.
      tab.tabIndex = on ? 0 : -1;

      var panel = document.getElementById(tab.getAttribute("aria-controls"));
      if (panel) panel.hidden = !on;
    });
  }

  function wireTabList(buttons, attr) {
    Array.prototype.forEach.call(buttons, function (tab) {
      tab.addEventListener("click", function () {
        showTab(buttons, attr, tab.getAttribute(attr));
      });
      tab.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        var list = Array.prototype.slice.call(buttons);
        var next = list[(list.indexOf(tab) + (event.key === "ArrowRight" ? 1 : -1) +
                         list.length) % list.length];
        showTab(buttons, attr, next.getAttribute(attr));
        next.focus();
        event.preventDefault();
      });
    });
  }

  // ----------------------------------------------------------- the dialog

  // Where focus was before the dialog opened, to put it back afterwards.
  var returnFocusTo = null;

  // Where the page behind was scrolled to, so locking it does not lose it.
  var scrollLockedAt = null;

  // What was last filed, so filing several for one place does not mean
  // choosing it again every time.
  var lastPlace = null;

  function openRequisitionModal() {
    returnFocusTo = document.activeElement;

    clearFieldErrors();
    setFormStatus("");
    el.reqDate.value = todayLocalISO();

    // Put back where the last one was for, if that is still on offer.
    if (lastPlace) {
      el.state.value = lastPlace.state;
      loadDivisions(lastPlace.state);
      el.division.value = lastPlace.division;
      loadDistricts(lastPlace.state, lastPlace.division);
      el.district.value = lastPlace.district;
    }

    el.modal.classList.add("is-open");
    document.addEventListener("keydown", onModalKeydown);

    // The page behind must not scroll under the dialog, and must not lose
    // its place when the scrollbar goes.
    scrollLockedAt = window.scrollY;
    document.body.style.overflow = "hidden";

    // Straight to the first thing that still needs choosing.
    var first = el.state.value ? (el.awardType.value ? el.quantity : el.awardType) : el.state;
    if (first && typeof first.focus === "function") first.focus();
  }

  function closeRequisitionModal() {
    el.modal.classList.remove("is-open");
    document.removeEventListener("keydown", onModalKeydown);

    document.body.style.overflow = "";
    if (scrollLockedAt !== null) {
      window.scrollTo(0, scrollLockedAt);
      scrollLockedAt = null;
    }

    if (returnFocusTo && typeof returnFocusTo.focus === "function") returnFocusTo.focus();
    returnFocusTo = null;
  }

  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), ' +
                  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function onModalKeydown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();      // the shell closes its own popups on Escape
      closeRequisitionModal();
      return;
    }

    // Tab must stay inside the dialog. Without this it walks off into the
    // list behind, where nothing is visible and nothing can be reached back.
    if (event.key !== "Tab") return;

    var items = Array.prototype.filter.call(
      el.modal.querySelectorAll(FOCUSABLE),
      function (n) { return n.offsetParent !== null; }
    );
    if (!items.length) return;

    var first = items[0];
    var last  = items[items.length - 1];
    var here  = document.activeElement;

    if (event.shiftKey && (here === first || !el.modal.contains(here))) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && here === last) {
      first.focus();
      event.preventDefault();
    }
  }

  function showListBanner(message) {
    if (!el.listBanner) return;
    el.listBannerText.textContent = message;
    el.listBanner.hidden = false;
  }

  /* ---------------------------------------------------------------- review

     Deciding is its own dialog rather than a pair of buttons in the row: a
     decision cannot be taken back, so it is worth a moment and a sentence.
     Declining asks for a reason - being turned down without one is the
     complaint that comes back. Approving may carry one and usually will not.
  */
  var reviewing = null;          // the requisition under review

  function openReview(id) {
    var row = null;
    for (var i = 0; i < allRequisitions.length; i++) {
      if (String(allRequisitions[i].id) === String(id)) { row = allRequisitions[i]; break; }
    }
    if (!row || !canDecide(myStanding(), row)) return;

    reviewing = row;
    returnFocusTo = document.activeElement;

    var p = placeOf(row);
    el.reviewSummary.innerHTML =
      "<dl>" +
        "<div><dt>Requested by</dt><dd>" + escapeHtml(row.requester_name || "—") +
          (row.requester_role ? ' <span class="chip-role">' +
             escapeHtml(row.requester_role) + "</span>" : "") + "</dd></div>" +
        "<div><dt>Award</dt><dd>" +
          escapeHtml(row.award_types ? row.award_types.name : "—") + "</dd></div>" +
        "<div><dt>Quantity</dt><dd>" + escapeHtml(row.quantity) + "</dd></div>" +
        "<div><dt>For</dt><dd>" +
          escapeHtml([p.district, p.division, p.state].filter(Boolean).join(", ")) +
        "</dd></div>" +
        "<div><dt>Dated</dt><dd>" + escapeHtml(formatDate(row.requisition_date)) + "</dd></div>" +
      "</dl>";

    el.reviewRemark.value = "";
    setFieldError(el.reviewRemark, "review-remark-error", "");
    setReviewStatus("");
    el.reviewModal.classList.add("is-open");
    document.addEventListener("keydown", onReviewKeydown);
    scrollLockedAt = window.scrollY;
    document.body.style.overflow = "hidden";
    el.reviewRemark.focus();
  }

  function closeReview() {
    reviewing = null;
    el.reviewModal.classList.remove("is-open");
    document.removeEventListener("keydown", onReviewKeydown);
    document.body.style.overflow = "";
    if (scrollLockedAt !== null) { window.scrollTo(0, scrollLockedAt); scrollLockedAt = null; }
    if (returnFocusTo && typeof returnFocusTo.focus === "function") returnFocusTo.focus();
    returnFocusTo = null;
  }

  function onReviewKeydown(event) {
    if (event.key === "Escape") { event.stopPropagation(); closeReview(); }
  }

  function setReviewStatus(message, kind) {
    if (!el.reviewBanner) return;
    if (!message) { el.reviewBanner.hidden = true; return; }
    el.reviewBannerText.textContent = message;
    el.reviewBanner.className = "banner " + (kind === "bad" ? "banner-error" : "banner-success");
    el.reviewBanner.hidden = false;
  }

  function decide(decision) {
    if (!reviewing) return;
    var standing = myStanding();
    if (!canDecide(standing, reviewing)) {       // standing changed under them
      setReviewStatus("You cannot decide on this requisition.", "bad");
      return;
    }

    var remark = el.reviewRemark.value.trim();
    if (decision === "declined" && !remark) {
      setFieldError(el.reviewRemark, "review-remark-error",
        "Say why it is being declined.");
      el.reviewRemark.focus();
      return;
    }
    setFieldError(el.reviewRemark, "review-remark-error", "");

    el.reviewApprove.disabled = el.reviewDecline.disabled = true;

    /* Only a row still sitting at submitted is written to, so two people
       reaching it at once cannot overwrite one another: the second finds
       nothing to change and is told so. */
    db.from("requisitions")
      .update({
        status: decision,
        decision_remark: remark || null,
        decided_by: (signedInUser() || {}).name || "",
        decided_by_role: standing.role,
        decided_at: new Date().toISOString()
      })
      .eq("id", reviewing.id)
      .eq("status", "submitted")
      .select("id")
      .then(function (res) {
        el.reviewApprove.disabled = el.reviewDecline.disabled = false;
        if (res.error) {
          setReviewStatus(/decided_|decision_remark|status/i.test(res.error.message || "")
            ? "Approvals are not set up in the database yet - run " +
              "sql/2026-10-15-award-approvals.sql."
            : "Could not save: " + res.error.message, "bad");
          reportError("save decision", res.error);
          return;
        }
        if (!res.data || !res.data.length) {
          setReviewStatus("Somebody has already decided this one.", "bad");
          loadRequisitions();
          return;
        }
        var what = decision === "approved" ? "Approved" : "Declined";
        closeReview();
        showListBanner(what + " — " + (reviewing && reviewing.requester_name) +
                       "'s requisition.");
        loadRequisitions();
      })
      .catch(function (err) {
        el.reviewApprove.disabled = el.reviewDecline.disabled = false;
        setReviewStatus("Could not save: " + messageOf(err), "bad");
        reportError("save decision", err);
      });
  }

  /* Raising is for PO, PM and DM. Everyone else - the COO, anyone outside
     Programme Implementation, anyone without a record - sees the list but
     not the button, and is told why instead of being left to wonder at a
     greyed-out control. */
  function applyStanding() {
    var standing = myStanding();
    if (!el.standingNote) return;

    if (canRaise(standing)) {
      el.newReqBtn.hidden = false;
      el.standingNote.textContent =
        "You are filing as " + (ROLE_TITLES[standing.role] || standing.role) + ".";
      el.standingNote.hidden = false;
      return;
    }

    el.newReqBtn.hidden = true;
    el.standingNote.hidden = false;
    el.standingNote.textContent = standing
      ? "As " + (ROLE_TITLES[standing.role] || standing.role) +
        " you decide on requisitions rather than raise them."
      : "Requisitions are raised by Programme Implementation staff. " +
        "You can see them here but not add one.";
  }

  function disableForm() {
    Array.prototype.forEach.call(
      el.form.querySelectorAll("input, select, button"),
      function (node) { node.disabled = true; }
    );
    // The button sits outside the form now, so it has to be told separately -
    // otherwise it still opens a dialog nobody can submit.
    if (el.newReqBtn) el.newReqBtn.disabled = true;
  }

  function wireEvents() {
    // The shell rebuilds this fragment on every visit, so normally these bind
    // once per fresh set of nodes. The guard is for the case where mount() is
    // called twice against the same DOM: a second submit listener would insert
    // the requisition twice, and this log cannot be edited or deleted.
    if (el.form.dataset.awWired === "1") return;
    el.form.dataset.awWired = "1";

    wireTabList(el.tabs, "data-aw-tab");
    wireTabList(el.subtabs, "data-aw-subtab");

    el.newReqBtn.addEventListener("click", openRequisitionModal);

    // One listener on the body rather than one per row, since the rows are
    // thrown away and rebuilt on every render.
    el.tbody.addEventListener("click", function (event) {
      var btn = event.target.closest ? event.target.closest("[data-aw-review]") : null;
      if (btn) openReview(btn.getAttribute("data-aw-review"));
    });

    Array.prototype.forEach.call(
      el.reviewModal.querySelectorAll("[data-aw-close-review]"),
      function (node) { node.addEventListener("click", closeReview); }
    );
    el.reviewApprove.addEventListener("click", function () { decide("approved"); });
    el.reviewDecline.addEventListener("click", function () { decide("declined"); });
    if (el.filterStatus) el.filterStatus.addEventListener("change", renderTable);

    // The close button, and the backdrop behind the box.
    Array.prototype.forEach.call(
      el.modal.querySelectorAll("[data-aw-close]"),
      function (node) { node.addEventListener("click", closeRequisitionModal); }
    );

    el.state.addEventListener("change", function () {
      setFieldError(el.state, "state-error", "");
      loadDivisions(el.state.value);
    });

    el.division.addEventListener("change", function () {
      setFieldError(el.division, "division-error", "");
      loadDistricts(el.state.value, el.division.value);
    });

    el.form.addEventListener("submit", onSubmit);

    el.resetBtn.addEventListener("click", function () {
      // Runs before the browser's own reset, so restore defaults after it.
      window.setTimeout(function () {
        clearFieldErrors();
        setFormStatus("");
        el.reqDate.value = todayLocalISO();
        el.division.innerHTML = '<option value="">Select a state first</option>';
        el.division.disabled = true;
        el.district.innerHTML = '<option value="">Select a division first</option>';
        el.district.disabled = true;
      }, 0);
    });

    el.refreshBtn.addEventListener("click", function () { loadRequisitions(); });

    // Narrowing from the left clears what sat to its right, so the filters
    // cannot be left describing a combination that matches nothing.
    el.filterState.addEventListener("change", function () {
      el.filterDivision.value = "";
      el.filterDistrict.value = "";
      buildFilterOptions();
      renderTable();
    });
    el.filterDivision.addEventListener("change", function () {
      el.filterDistrict.value = "";
      buildFilterOptions();
      renderTable();
    });
    el.filterDistrict.addEventListener("change", renderTable);
    el.filterType.addEventListener("change", renderTable);
    el.filterSearch.addEventListener("input", renderTable);
  }

  // -------------------------------------------------------- reference data

  /* Where the organisation works, from the Employees directory rather than a
     copy kept here. The shell builds the State -> Division -> District tree
     once per page load; this just reads it, so changing the cascade is a
     matter of correcting someone's record in the Employees tab. */
  var geography = [];

  function stateNamed(name) {
    for (var i = 0; i < geography.length; i++) {
      if (geography[i].name === name) return geography[i];
    }
    return null;
  }

  function divisionNamed(stateName, divisionName) {
    var st = stateNamed(stateName);
    if (!st) return null;
    for (var i = 0; i < st.divisions.length; i++) {
      if (st.divisions[i].name === divisionName) return st.divisions[i];
    }
    return null;
  }

  function loadGeography() {
    if (typeof window.olfGeography !== "function") {
      el.state.innerHTML = '<option value="">Unavailable</option>';
      showSetupBanner(
        "This page reads the states, divisions and districts from the " +
        "Employees directory, and that is not loaded. Reload Staff Connect " +
        "and open the tab again.",
        "Could not reach the staff directory."
      );
      disableForm();
      return;
    }

    window.olfGeography()
      .then(function (tree) {
        geography = tree || [];

        if (!geography.length) {
          el.state.innerHTML = '<option value="">No locations found</option>';
          showSetupBanner(
            "No employee has a State, Division and District recorded, so " +
            "there is nothing to choose from. Fill those in on the Employees " +
            "tab and reload.",
            "The directory has no locations yet."
          );
          disableForm();
          return;
        }

        fillSelect(el.state, geography, "Select state",
          function (s) { return s.name; },
          function (s) { return s.name; });

        // Only one state in the directory? Choose it and move on.
        if (geography.length === 1) {
          el.state.value = geography[0].name;
          loadDivisions(el.state.value);
        }
      })
      .catch(function (err) {
        el.state.innerHTML = '<option value="">Could not load states</option>';
        reportError("load the directory's locations", err);
      });
  }

  function loadDivisions(stateName) {
    el.district.innerHTML = '<option value="">Select a division first</option>';
    el.district.disabled = true;

    var st = stateName ? stateNamed(stateName) : null;
    if (!st) {
      el.division.innerHTML = '<option value="">Select a state first</option>';
      el.division.disabled = true;
      return;
    }

    fillSelect(el.division, st.divisions, "Select division",
      function (d) { return d.name; },
      function (d) { return d.name; });
    el.division.disabled = false;

    if (st.divisions.length === 1) {
      el.division.value = st.divisions[0].name;
      loadDistricts(stateName, el.division.value);
    }
  }

  function loadDistricts(stateName, divisionName) {
    var dv = divisionName ? divisionNamed(stateName, divisionName) : null;
    if (!dv) {
      el.district.innerHTML = '<option value="">Select a division first</option>';
      el.district.disabled = true;
      return;
    }

    fillSelect(el.district, dv.districts, "Select district",
      function (n) { return n; },
      function (n) { return n; });
    el.district.disabled = false;

    if (dv.districts.length === 1) el.district.value = dv.districts[0];
  }

  function loadAwardTypes() {
    db.from("award_types").select("id, code, name")
      .order("sort_order").order("name")
      .then(function (res) {
        if (res.error) {
          el.awardType.innerHTML = '<option value="">Could not load types</option>';
          reportError("load award types", res.error);
          return;
        }
        fillSelect(el.awardType, res.data || [], "Select award type",
          function (t) { return t.id; },
          function (t) { return t.name; });
      })
      .catch(function (err) {
        el.awardType.innerHTML = '<option value="">Could not load types</option>';
        reportError("load award types", err);
      });
  }

  // ------------------------------------------------------------ validation

  function readForm() {
    clearFieldErrors();

    /* Where it is for is recorded as the names that were chosen, not as ids
       into this database's own tables: the directory covers districts those
       tables have never heard of. For a log that cannot be edited the name is
       the better record anyway - it keeps what was picked at the time instead
       of following a row somebody renames later. */
    var values = {
      state_name: el.state.value || "",
      division_name: el.division.value || "",
      district_name: el.district.value || "",
      award_type_id: el.awardType.value ? Number(el.awardType.value) : null,
      requester_name: (signedInUser() || {}).name || "",
      // Recorded now, not looked up later: who may approve this depends on
      // the level it was raised at, and people move between roles.
      requester_role: (myStanding() || {}).role || null,
      requester_level: (myStanding() || {}).level || null,
      quantity: el.quantity.value.trim(),
      requisition_date: el.reqDate.value,
    };

    var ok = true;

    if (!values.state_name) {
      setFieldError(el.state, "state-error", "Select a state."); ok = false;
    }
    if (!values.division_name) {
      setFieldError(el.division, "division-error", "Select a division."); ok = false;
    }
    if (!values.district_name) {
      setFieldError(el.district, "district-error", "Select a district."); ok = false;
    }

    // The three cascade, so a stale pairing means the directory changed under
    // them mid-form. Better to stop than to file a place that does not exist.
    if (values.state_name && values.division_name && values.district_name) {
      var dv = divisionNamed(values.state_name, values.division_name);
      if (!dv || dv.districts.indexOf(values.district_name) === -1) {
        setFieldError(el.district, "district-error",
          "That district is no longer listed under this division. Choose again.");
        ok = false;
      }
    }
    if (!values.award_type_id) {
      setFieldError(el.awardType, "award-type-error", "Select an award type."); ok = false;
    }
    // Nothing to type here any more, so the only way this fails is a session
    // that has gone away underneath them.
    if (!values.requester_name) {
      setFieldError(null, "requester-error",
        "Could not tell who you are. Reload the page and sign in again."); ok = false;
    }

    var qty = Number(values.quantity);
    if (!values.quantity) {
      setFieldError(el.quantity, "quantity-error", "Enter a quantity."); ok = false;
    } else if (!Number.isInteger(qty) || qty < 1) {
      setFieldError(el.quantity, "quantity-error", "Quantity must be a whole number of 1 or more."); ok = false;
    } else if (qty > 1000000) {
      setFieldError(el.quantity, "quantity-error", "That quantity looks too large."); ok = false;
    } else {
      values.quantity = qty;
    }

    if (!values.requisition_date) {
      setFieldError(el.reqDate, "req-date-error", "Pick a date."); ok = false;
    }

    return ok ? values : null;
  }

  // ---------------------------------------------------------------- submit

  function onSubmit(event) {
    event.preventDefault();
    setFormStatus("");

    var values = readForm();
    if (!values) {
      setFormStatus("Please fix the highlighted fields.", "bad");
      return;
    }

    el.submitBtn.disabled = true;
    el.submitBtn.textContent = "Submitting…";

    db.from("requisitions").insert([values])
      .then(function (res) {
        if (res.error) {
          // The columns these names go into arrive with a migration. Say so,
          // rather than showing the raw PostgREST complaint, which reads
          // "Could not find the 'state_name' column of 'requisitions'" - the
          // name comes before the word column, so this matches on the name.
          var missing = /(state_name|division_name|district_name)/i
            .test(res.error.message || "");
          setFormStatus(missing
            ? "This database has not been updated for divisions yet. Run " +
              "sql/2026-10-15-award-store-geography-as-text.sql in the " +
              "Supabase SQL editor, then try again."
            : "Could not save: " + res.error.message, "bad");
          reportError("save requisition", res.error);
          return;
        }

        // Remembered so that filing several for one place does not mean
        // choosing it again each time the dialog opens.
        lastPlace = {
          state: values.state_name,
          division: values.division_name,
          district: values.district_name
        };

        // Read before clearing: the message names the award type.
        var typeName = selectedText(el.awardType);

        el.awardType.value = "";
        el.quantity.value = "";

        // The dialog closes, so the confirmation goes above the list, which
        // is where they are now looking and where the new row appears.
        closeRequisitionModal();
        showListBanner(
          "Saved — " + values.quantity + " " + typeName +
          " for " + values.district_name + ", " + values.state_name + "."
        );

        loadRequisitions();
      })
      .catch(function (err) {
        setFormStatus("Could not save: " + messageOf(err), "bad");
        reportError("save requisition", err);
      })
      .then(function () {
        el.submitBtn.disabled = false;
        el.submitBtn.textContent = "Submit Requisition";
      });
  }

  function selectedText(select) {
    var option = select.options[select.selectedIndex];
    return option ? option.textContent : "";
  }

  // ------------------------------------------------------------- load list

  /* The log has to stay readable at every stage of the move off the old
     lookup tables, whichever order the steps happen in:

       state_name and the rest arrive with
         sql/2026-10-15-award-store-geography-as-text.sql
       states and districts go with
         sql/2026-10-15-award-drop-lookup-tables.sql

     Asking for either when it is not there fails the whole query, so each is
     tried once and switched off if the database says no. The two tests cannot
     catch each other's message: "state_name" does not contain "states". */
  var hasNameColumns  = true;
  var hasLookupTables = true;

  function loadRequisitions() {
    el.refreshBtn.disabled = true;

    db.from("requisitions")
      // The names are what new rows carry; the joins are for the rows filed
      // before this page recorded them, which still point at the old tables.
      .select("id, requester_name, quantity, requisition_date, status, created_at," +
              (hasNameColumns  ? " state_name, division_name, district_name," : "") +
              (hasLookupTables ? " states ( code, name ), districts ( name )," : "") +
              (hasApproval ? " requester_role, requester_level, decided_by," +
                             " decided_by_role, decided_at, decision_remark," : "") +
              " award_types ( code, name )")
      .order("created_at", { ascending: false })
      .limit(500)
      .then(function (res) {
        el.refreshBtn.disabled = false;

        if (res.error) {
          var msg = res.error.message || "";

          if (hasNameColumns && /(state_name|division_name|district_name)/i.test(msg)) {
            hasNameColumns = false;      // not migrated yet - read the old shape
            loadRequisitions();
            return;
          }
          if (hasApproval && /(requester_role|requester_level|decided_|decision_remark)/i.test(msg)) {
            hasApproval = false;      // the approvals migration is not run yet
            showSetupBanner(
              "Approvals need one more migration - run " +
              "<code>sql/2026-10-15-award-approvals.sql</code> in the Supabase " +
              "SQL Editor. Until then every requisition shows as pending.",
              "Approvals are not set up yet."
            );
            loadRequisitions();
            return;
          }
          if (hasLookupTables && /(states|districts)/i.test(msg)) {
            hasLookupTables = false;     // lookup tables gone - the names carry it
            loadRequisitions();
            return;
          }

          placeholderRow("Could not load requisitions: " + msg);
          reportError("load requisitions", msg);
          return;
        }

        allRequisitions = res.data || [];
        buildFilterOptions();
        renderTable();
      })
      .catch(function (err) {
        el.refreshBtn.disabled = false;
        placeholderRow("Could not load requisitions: " + messageOf(err));
        reportError("load requisitions", err);
      });
  }

  /* Where a row says it is for. New rows carry the names; the ones filed
     before that still point at this database's own tables, so both are read
     and the newer answer wins. */
  function placeOf(row) {
    return {
      state:    row.state_name    || (row.states    ? row.states.name    : ""),
      division: row.division_name || "",
      district: row.district_name || (row.districts ? row.districts.name : ""),
      code:     row.states ? row.states.code : ""
    };
  }

  /* The filter dropdowns offer what the loaded rows actually contain - not
     everything the directory knows - so nothing on offer can return nothing.
     Each narrows the next: pick a state and only the divisions filed in it
     remain. A selection that is still on offer survives the rebuild, because
     fillSelect puts it back.

     Award type is left alone. It has nothing to do with where a requisition
     is for, and narrowing it would only hide types from someone looking for
     them. */
  function buildFilterOptions() {
    var stateFilter    = el.filterState.value;
    var divisionFilter = el.filterDivision.value;

    var states = {}, divisions = {}, districts = {}, types = {};

    allRequisitions.forEach(function (row) {
      var p = placeOf(row);
      if (p.state) states[p.state] = p.code;
      if (row.award_types) types[row.award_types.name] = true;

      if (stateFilter && p.state !== stateFilter) return;
      if (p.division) divisions[p.division] = true;

      if (divisionFilter && p.division !== divisionFilter) return;
      if (p.district) districts[p.district] = true;
    });

    fillSelect(el.filterState, Object.keys(states).sort(), "All states",
      function (name) { return name; },
      function (name) { return states[name] ? name + " (" + states[name] + ")" : name; });

    fillSelect(el.filterDivision, Object.keys(divisions).sort(), "All divisions",
      function (name) { return name; }, function (name) { return name; });

    fillSelect(el.filterDistrict, Object.keys(districts).sort(), "All districts",
      function (name) { return name; }, function (name) { return name; });

    fillSelect(el.filterType, Object.keys(types).sort(), "All types",
      function (name) { return name; }, function (name) { return name; });
  }

  function renderTable() {
    var stateFilter = el.filterState.value;
    var divisionFilter = el.filterDivision.value;
    var districtFilter = el.filterDistrict.value;
    var typeFilter = el.filterType.value;
    var statusFilter = el.filterStatus ? el.filterStatus.value : "";
    var search = el.filterSearch.value.trim().toLowerCase();

    var rows = allRequisitions.filter(function (row) {
      var p = placeOf(row);
      if (stateFilter && p.state !== stateFilter) return false;
      if (divisionFilter && p.division !== divisionFilter) return false;
      if (districtFilter && p.district !== districtFilter) return false;
      if (typeFilter && (!row.award_types || row.award_types.name !== typeFilter)) return false;
      if (search && String(row.requester_name || "").toLowerCase().indexOf(search) === -1) return false;
      if (statusFilter) {
        var d = statusOf(row).decision || "pending";
        if (d !== statusFilter) return false;
      }
      return true;
    });

    if (!allRequisitions.length) {
      placeholderRow("No requisitions yet.");
      return;
    }
    if (!rows.length) {
      placeholderRow("No matches.");
      return;
    }

    var total = 0;
    var html = "";

    rows.forEach(function (row) {
      total += Number(row.quantity) || 0;
      var p = placeOf(row);
      var stateName = p.state || "Unknown state";
      // Rows filed before the directory fed this page have no division, and
      // an em dash is more honest than guessing one.
      var typeName = row.award_types ? row.award_types.name : "—";

      html +=
        "<tr>" +
          '<td><span class="state-code" title="' + escapeHtml(stateName) + '">' +
            escapeHtml(p.code || stateName) + "</span></td>" +
          "<td>" + escapeHtml(p.division || "—") + "</td>" +
          "<td>" + escapeHtml(p.district || "—") + "</td>" +
          "<td>" + escapeHtml(row.requester_name) + "</td>" +
          '<td><span class="type-chip">' + escapeHtml(typeName) + "</span></td>" +
          '<td class="num">' + escapeHtml(row.quantity) + "</td>" +
          '<td class="cell-date">' + escapeHtml(formatDate(row.requisition_date)) + "</td>" +
          '<td class="cell-date muted">' + escapeHtml(formatTimestamp(row.created_at)) + "</td>" +
          "<td>" + statusCellHtml(row) + "</td>" +
          '<td class="cell-action">' + actionCellHtml(row) + "</td>" +
        "</tr>";
    });

    el.tbody.innerHTML = html;
    setRowPill(rows.length === allRequisitions.length
      ? (rows.length === 1 ? "1 item" : rows.length + " items")
      : rows.length + " of " + allRequisitions.length);
    el.footCount.textContent = rows.length === allRequisitions.length
      ? rows.length + (rows.length === 1 ? " requisition" : " requisitions")
      : rows.length + " of " + allRequisitions.length;
    el.footTotal.textContent = total.toLocaleString();
    el.tfoot.hidden = false;
  }

  /* The state of a requisition, and - where it has been settled - who said
     so. The remark hangs off the chip rather than taking a column of its
     own: most are short, and a column of mostly-empty cells reads worse. */
  function statusCellHtml(row) {
    var st = statusOf(row);
    if (!st.decision) {
      return '<span class="chip-status is-pending">Pending</span>';
    }
    var title = st.by + (st.byRole ? " (" + st.byRole + ")" : "") +
                ", " + formatTimestamp(st.at) +
                (st.remark ? " — " + st.remark : "");
    return '<span class="chip-status is-' + escapeHtml(st.decision) + '" title="' +
             escapeHtml(title) + '">' +
             escapeHtml(st.decision === "approved" ? "Approved" : "Declined") +
           "</span>" +
           '<span class="cell-by">' + escapeHtml(st.by || "") + "</span>" +
           (st.remark ? '<span class="cell-remark" title="' + escapeHtml(st.remark) +
                        '">' + escapeHtml(st.remark) + "</span>" : "");
  }

  function actionCellHtml(row) {
    if (!hasApproval) return "";
    if (!canDecide(myStanding(), row)) return "";
    return '<button type="button" class="btn btn-ghost btn-xs" data-aw-review="' +
             escapeHtml(row.id) + '">Review</button>';
  }

  // ----------------------------------------------------------------- errors

  function messageOf(err) {
    if (!err) return "unknown error";
    return err.message || String(err);
  }

  // A failure on the very first calls usually means the URL/key are wrong or
  // schema.sql hasn't been run, so point at that rather than just logging.
  function reportError(what, err) {
    var message = messageOf(err);
    console.error("[award-management] Failed to " + what + ":", err);

    if (el.setupBanner.hidden) {
      var missingTable = /schema cache|does not exist/i.test(message);
      showSetupBanner(
        "Failed to " + escapeHtml(what) + ": <code>" + escapeHtml(message) +
        "</code>. " + (missingTable
          // The old states and districts tables were dropped on purpose; this
          // page does not use them. Something in the database still does -
          // a row-level security policy or a trigger on requisitions is the
          // usual culprit, since neither shows up until you write.
          ? "This page does not read those tables. Something in the database " +
            "still refers to them — run " +
            "<code>sql/2026-10-15-award-check-leftover-references.sql</code> " +
            "in the Supabase SQL Editor to find what."
          : "Check that the config block at the top of <code>award.js</code> " +
            "holds the right Project URL and publishable key."),
        missingTable ? "Something in the database is missing." : "Could not reach the database."
      );
    }
  }

  // The shell decides when this page exists; it calls mount() after the
  // fragment is in the DOM.
  window.AwardManagement = { mount: mount };
})();
