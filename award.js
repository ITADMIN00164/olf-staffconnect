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
    awardLines: document.getElementById("award-lines"),
    hoModal: document.getElementById("ho-modal"),
    hoHeading: document.getElementById("ho-heading"),
    hoSub: document.getElementById("ho-sub"),
    hoSummary: document.getElementById("ho-summary"),
    hoRemark: document.getElementById("ho-remark"),
    hoRemarkLabel: document.getElementById("ho-remark-label"),
    hoConfirm: document.getElementById("ho-confirm"),
    deliveryBody: document.getElementById("delivery-body"),
    adminList: document.getElementById("admin-list"),
    adminEmail: document.getElementById("admin-email"),
    adminName: document.getElementById("admin-name"),
    adminAdd: document.getElementById("admin-add"),
    awardAdd: document.getElementById("award-add"),
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
  var hasItems = true;        // false until the multiple-awards migration runs
  var hasFulfilment = true;   // false until the fulfilment migration runs
  var hasEmails = true;       // false until the addresses migration runs

  /* Where a requisition has got to.

       raised ─> approved ─> acknowledged ─> dispatched ─> received
          │          │             │
          │          └── rejected ─┘
          └── declined

     declined is the approver turning it down; rejected is HO being unable to
     fulfil it. Two words, because they are two different events by different
     people - one word would lose where it died.

     Dispatch and receipt are likewise two events, not one. Head Office knows
     it sent the award; only the person who asked for it knows whether it
     arrived. Having HO mark something "delivered" was recording a fact
     nobody at that desk could see. */
  var STAGES = {
    submitted:    { label: "Pending",      tone: "pending",  open: true  },
    approved:     { label: "Approved",     tone: "approved", open: true  },
    acknowledged: { label: "Acknowledged", tone: "progress", open: true  },
    on_hold:      { label: "On hold",      tone: "held",     open: true  },
    dispatched:   { label: "Dispatched",   tone: "progress", open: true,
                    // One event seen from two places: the requester is
                    // waiting for it, Head Office is waiting to hear.
                    hoLabel: "Awaiting confirmation" },
    received:     { label: "Received",     tone: "done",     open: false,
                    hoLabel: "Delivered" },
    declined:     { label: "Declined",     tone: "declined", open: false },
    rejected:     { label: "Rejected",     tone: "declined", open: false }
  };

  /* The same state reads differently depending on who is looking. Receipt is
     the requester confirming it arrived, which to Head Office is the
     delivery completing - one fact, two vantage points, and neither word is
     wrong from where it is said. */
  function stageLabel(row, forHo) {
    var stage = STAGES[stageOf(row)];
    return (forHo && stage.hoLabel) || stage.label;
  }

  function stageOf(row) {
    var key = String((row && row.status) || "submitted").toLowerCase();
    return STAGES[key] ? key : "submitted";
  }

  /* The approver's part, which the review dialog and the Status cell read. */
  function statusOf(row) {
    var d = stageOf(row);
    if (d === "declined" || d === "approved" || d === "acknowledged" ||
        d === "dispatched" || d === "received" || d === "rejected") {
      // Anything past submitted has been through an approver, except the
      // older rows that predate approvals - they have nobody recorded.
      return { decision: d === "declined" ? "declined" : "approved",
               by: row.decided_by, byRole: row.decided_by_role,
               remark: row.decision_remark, at: row.decided_at };
    }
    return { decision: null };
  }

  /* Every step a requisition has been through, newest last. Drawn under the
     chip so the whole journey is on the row rather than hidden in a tooltip. */
  function trailOf(row) {
    var steps = [];
    var push = function (what, who, when, email) {
      if (who || when) {
        steps.push({ what: what, who: who || "", when: when || "", email: email || "" });
      }
    };
    push("Raised", row.requester_name, row.created_at, row.requester_email);
    if (row.decided_at) {
      push(stageOf(row) === "declined" ? "Declined" : "Approved",
           row.decided_by, row.decided_at, row.decided_by_email);
    }
    push("Acknowledged", row.acknowledged_by, row.acknowledged_at);
    push("On hold", row.held_by, row.held_at);
    push("Dispatched", row.dispatched_by, row.dispatched_at);
    push("Not received", row.issue_by, row.issue_at);
    push("Received", row.received_by, row.received_at);
    push("Rejected", row.rejected_by, row.rejected_at);
    return steps;
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

    var standing = roleOfDepartment(emp["Dept"]);
    if (!standing) return null;

    // Division is a many-valued field, so this is the set they cover.
    standing.divisions = splitSemicolons(emp["Division"]);
    return standing;
  }

  function splitSemicolons(value) {
    return String(value || "").split(/[;\r\n]/)
      .map(function (p) { return p.trim(); })
      .filter(Boolean);
  }

  /* A requisition is decided by somebody responsible for the division it is
     for. A PM in Pune has no business approving Nagpur's requests, and the
     division is already on the requisition - it is where the award is going.

     The COO is the exception, and the directory agrees: the one COO has no
     division recorded, because the role is not a divisional one. Above the
     divisions, so across all of them.

     An approver whose own Division is blank covers nothing. Two of the five
     DMs are in that position today; until their Division is filled in on the
     Employees tab they will see no Review buttons. That is the honest
     reading - the alternative, treating blank as everywhere, would handing
     them the whole organisation on the strength of a missing field. */
  function coversDivision(standing, row) {
    if (!standing) return false;
    if (standing.level >= 4) return true;            // the COO is org-wide

    var want = String((row && row.division_name) || "").trim().toLowerCase();
    if (!want) return false;                         // nothing to match on

    var mine = standing.divisions || [];
    for (var i = 0; i < mine.length; i++) {
      if (mine[i].trim().toLowerCase() === want) return true;
    }
    return false;
  }

  function canRaise(standing)  { return !!standing && standing.level <= 3; }

  /* Legacy rows carry no level: they were filed before the role was
     recorded. Treating them as the lowest keeps them actionable rather than
     stranding them, which is the kinder failure for three test rows. */
  function levelRaisedAt(row) {
    var n = Number(row && row.requester_level);
    return n >= 1 && n <= 4 ? n : 1;
  }

  /* ------------------------------------------------------------ HO

     The people who fulfil requisitions, kept in award_admins and managed
     from Settings. Matched on the signed-in address, lower-cased.

     Staff Connect Admins can always reach Settings as well. Without that,
     removing the last award admin would shut the door on the room the key
     is kept in. */
  var hoAdmins = [];             // [{ email, name }]
  var hasAdmins = true;          // false until the fulfilment migration runs

  function myEmail() {
    var u = window.__olfUser || {};
    var e = window.__olfEmployee || {};
    return String(u.email || e["Email"] || "").trim().toLowerCase();
  }

  function isHoAdmin() {
    var mine = myEmail();
    if (!mine) return false;
    for (var i = 0; i < hoAdmins.length; i++) {
      if (String(hoAdmins[i].email || "").trim().toLowerCase() === mine) return true;
    }
    return false;
  }

  function isAppAdmin() {
    return String((window.__olfUser || {}).role || "").toLowerCase() === "admin";
  }

  function canManageAdmins() { return isHoAdmin() || isAppAdmin(); }

  /* What HO may do to a requisition at its current stage. Nothing before it
     has been approved - an unapproved requisition is not HO's business
     yet. */
  function hoActions(row) {
    if (!isHoAdmin()) return [];
    switch (stageOf(row)) {
      case "approved":     return ["acknowledge", "reject"];
      case "acknowledged": return ["dispatch", "hold", "reject"];
      // On hold is waiting, not refusing. It can go either way once the
      // stock question is settled.
      case "on_hold":      return ["dispatch", "resume", "reject"];
      // Once it has been sent there is nothing left for HO to do and nothing
      // left to withhold; the next move belongs to the requester.
      default:             return [];
    }
  }

  /* Confirming receipt belongs to whoever asked for it - they are the only
     one who can see it arrive.

     Matched on the address where the row has one. The rows filed before
     addresses were recorded fall back to the name, which is weaker but is
     all those rows carry; without it their requesters could never close
     them. */
  function isMine(row) {
    var mine = myEmail();
    var theirs = String((row && row.requester_email) || "").trim().toLowerCase();
    if (theirs && mine) return theirs === mine;

    var myName = String((signedInUser() || {}).name || "").trim().toLowerCase();
    var theirName = String((row && row.requester_name) || "").trim().toLowerCase();
    return !!myName && myName === theirName;
  }

  /* Whoever approved it can also close it. The requester is the right
     person, but people leave, and without this a dispatched requisition
     whose requester has gone could never be closed by anybody. Recorded
     under their own name, so the trail shows it was not the requester. */
  function iApproved(row) {
    var mine = myEmail();
    var theirs = String((row && row.decided_by_email) || "").trim().toLowerCase();
    if (theirs && mine) return theirs === mine;

    var myName = String((signedInUser() || {}).name || "").trim().toLowerCase();
    var theirName = String((row && row.decided_by) || "").trim().toLowerCase();
    return !!myName && myName === theirName;
  }

  function canConfirmReceipt(row) {
    return stageOf(row) === "dispatched" && (isMine(row) || iApproved(row));
  }

  /* Dispatched and nothing came. Without this the only move on a dispatched
     requisition is to confirm it, so a lost parcel leaves the row open for
     ever with nobody able to say so. */
  function canReportIssue(row) {
    return stageOf(row) === "dispatched" && isMine(row);
  }

  function canDecide(standing, row) {
    if (!standing) return false;
    if (statusOf(row).decision) return false;        // already settled
    if (standing.level <= levelRaisedAt(row)) return false;
    return coversDivision(standing, row);
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
    applyAccess();

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
    loadAdmins(function () { applyAccess(); renderTable(); });
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
    resetAwardLines();
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
    var first = el.state.value ? el.awardLines.querySelector(".award-line-type") : el.state;
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
        "<div><dt>Awards</dt><dd>" + awardsCellHtml(awardsOf(row)) + "</dd></div>" +
        "<div><dt>Total</dt><dd>" + escapeHtml(Number(row.quantity).toLocaleString()) +
        "</dd></div>" +
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
        decided_by_email: myEmail() || null,
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
        // Read before closing: closeReview clears what is being reviewed, and
        // the message is about it.
        var what = decision === "approved" ? "Approved" : "Declined";
        var whose = String((reviewing && reviewing.requester_name) || "").trim();
        var where = String((reviewing && reviewing.district_name) || "").trim();

        closeReview();
        showListBanner(
          whose
            ? what + " — " + whose + "'s requisition" + (where ? " for " + where : "") + "."
            : what + " — the requisition has been " + decision + "."
        );
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
  /* Delivery is HO's queue and Settings is where HO is decided, so neither
     is shown to people they mean nothing to. Hidden rather than disabled: a
     tab you may never open is clutter, not information. */
  function applyAccess() {
    var show = { requisition: true, delivery: isHoAdmin(), settings: canManageAdmins() };

    Array.prototype.forEach.call(el.subtabs, function (tab) {
      var key = tab.getAttribute("data-aw-subtab");
      tab.hidden = !show[key];
      var panel = document.getElementById(tab.getAttribute("aria-controls"));
      if (panel && !show[key]) panel.hidden = true;
    });

    // If the open tab has just gone, fall back to the one everybody has.
    var active = null;
    Array.prototype.forEach.call(el.subtabs, function (tab) {
      if (tab.classList.contains("is-active") && !tab.hidden) active = tab;
    });
    if (!active) showTab(el.subtabs, "data-aw-subtab", "requisition");

    renderAdmins();
  }

  function applyStanding() {
    var standing = myStanding();
    if (!el.standingNote) return;

    if (canRaise(standing)) {
      el.newReqBtn.hidden = false;
      el.standingNote.textContent =
        "You are filing as " + (ROLE_TITLES[standing.role] || standing.role) + "." +
        decidingNote(standing);
      el.standingNote.hidden = false;
      return;
    }

    el.newReqBtn.hidden = true;
    el.standingNote.hidden = false;
    el.standingNote.textContent = standing
      ? "As " + (ROLE_TITLES[standing.role] || standing.role) +
        " you decide on requisitions rather than raise them." + decidingNote(standing)
      : "Requisitions are raised by Programme Implementation staff. " +
        "You can see them here but not add one.";
  }

  /* Said under the heading, because the alternative is someone who can
     approve seeing no Review buttons and concluding the page is broken. */
  function decidingNote(standing) {
    if (!standing || standing.level < 2) return "";
    if (standing.level >= 4) return " You decide on any division.";

    var divs = standing.divisions || [];
    if (!divs.length) {
      return " No division is recorded against you, so there is nothing you " +
             "can approve yet — ask for it to be filled in on the Employees tab.";
    }
    return " You decide on " + divs.join(" and ") + ".";
  }

  /* --------------------------------------------------------- HO's moves

     Acknowledging and delivering are a step forward and take a note only if
     there is one to make. Rejecting ends the requisition, so it asks for a
     reason - the requester is owed one, and it is the only record of why
     nothing arrived. */
  var hoPending = null;          // { row, action } awaiting confirmation

  function mayDo(row, action) {
    if (action === "receive") return canConfirmReceipt(row);
    if (action === "issue")   return canReportIssue(row);
    return hoActions(row).indexOf(action) !== -1;
  }

  function startHoAction(id, action) {
    var row = null;
    for (var i = 0; i < allRequisitions.length; i++) {
      if (String(allRequisitions[i].id) === String(id)) { row = allRequisitions[i]; break; }
    }
    if (!row || !mayDo(row, action)) return;

    hoPending = { row: row, action: action };
    returnFocusTo = document.activeElement;

    var p = placeOf(row);
    var HEADINGS = {
      acknowledge: "Acknowledge requisition",
      dispatch:    "Mark as dispatched",
      hold:        "Put on hold",
      resume:      "Take off hold",
      reject:      "Reject requisition",
      receive:     "Confirm it arrived",
      issue:       "Report that it never arrived"
    };
    var SUBS = {
      acknowledge: "Recorded against your name, and not undone.",
      dispatch:    "The requester is asked to confirm it arrives.",
      hold:        "It stays on the list. Nobody is told no - say what is being waited for.",
      resume:      "Back to the queue, ready to go out.",
      reject:      "The requester is told this is the reason nothing is coming.",
      receive:     "Only you can say this - you are the one it was sent to.",
      issue:       "It goes back to Head Office with what you say here."
    };
    el.hoHeading.textContent = HEADINGS[action] || "Requisition";
    el.hoSub.textContent = SUBS[action] || "";

    el.hoSummary.innerHTML =
      "<dl>" +
        "<div><dt>Requested by</dt><dd>" + escapeHtml(row.requester_name || "—") + "</dd></div>" +
        "<div><dt>Awards</dt><dd>" + awardsCellHtml(awardsOf(row)) + "</dd></div>" +
        "<div><dt>For</dt><dd>" +
          escapeHtml([p.district, p.division, p.state].filter(Boolean).join(", ")) +
        "</dd></div>" +
      "</dl>";

    el.hoRemark.value = "";
    /* A reason is asked for wherever the answer is no, or not yet, or it
       did not turn up - the three a requester is owed an explanation for. */
    var NEEDS_REASON = { reject: 1, hold: 1, issue: 1 };
    el.hoRemarkLabel.innerHTML =
      action === "reject" ? 'Reason <span class="hint">required</span>' :
      action === "hold"   ? 'What is being waited for <span class="hint">required</span>' :
      action === "issue"  ? 'What happened <span class="hint">required</span>' :
      action === "receive" ? 'Note <span class="hint">anything short or damaged?</span>'
                           : 'Note <span class="hint">optional</span>';
    el.hoRemark.dataset.needsReason = NEEDS_REASON[action] ? "1" : "";
    setFieldError(el.hoRemark, "ho-remark-error", "");
    el.hoConfirm.textContent = HO_LABELS[action];
    el.hoConfirm.className = "btn " + (action === "reject" ? "btn-danger" : "btn-primary");

    el.hoModal.classList.add("is-open");
    document.addEventListener("keydown", onHoKeydown);
    scrollLockedAt = window.scrollY;
    document.body.style.overflow = "hidden";
    el.hoRemark.focus();
  }

  function closeHo() {
    hoPending = null;
    el.hoModal.classList.remove("is-open");
    document.removeEventListener("keydown", onHoKeydown);
    document.body.style.overflow = "";
    if (scrollLockedAt !== null) { window.scrollTo(0, scrollLockedAt); scrollLockedAt = null; }
    if (returnFocusTo && typeof returnFocusTo.focus === "function") returnFocusTo.focus();
    returnFocusTo = null;
  }

  function onHoKeydown(event) {
    if (event.key === "Escape") { event.stopPropagation(); closeHo(); }
  }

  function confirmHoAction() {
    if (!hoPending) return;
    var row = hoPending.row;
    var action = hoPending.action;

    if (!mayDo(row, action)) {                     // it moved under them
      setFieldError(el.hoRemark, "ho-remark-error",
        "This requisition is no longer at that stage.");
      return;
    }

    var remark = el.hoRemark.value.trim();
    if (el.hoRemark.dataset.needsReason === "1" && !remark) {
      setFieldError(el.hoRemark, "ho-remark-error",
        action === "reject" ? "Say why it is being rejected." :
        action === "hold"   ? "Say what is being waited for." :
                              "Say what happened.");
      el.hoRemark.focus();
      return;
    }
    setFieldError(el.hoRemark, "ho-remark-error", "");

    var me = (signedInUser() || {}).name || myEmail();
    var now = new Date().toISOString();
    /* Each move writes only its own columns, so one step never overwrites
       what another recorded - HO's note and the requester's stay apart,
       because they are different people saying different things. */
    var patch = {};
    var from;
    var hoNote = function () {
      patch.ho_remark = remark || null;
      patch.ho_by_email = myEmail() || null;
    };

    if (action === "acknowledge") {
      hoNote();
      patch.status = "acknowledged";
      patch.acknowledged_by = me;
      patch.acknowledged_at = now;
      from = "approved";

    } else if (action === "hold") {
      hoNote();
      patch.status = "on_hold";
      patch.held_by = me;
      patch.held_at = now;
      from = "acknowledged";

    } else if (action === "resume") {
      hoNote();
      patch.status = "acknowledged";
      // held_by and held_at stay: it was on hold, and the trail should say so.
      from = "on_hold";

    } else if (action === "dispatch") {
      hoNote();
      patch.status = "dispatched";
      patch.dispatched_by = me;
      patch.dispatched_at = now;
      // Clears any earlier report of non-arrival; this is a fresh sending.
      patch.issue_by = null;
      patch.issue_at = null;
      patch.issue_note = null;
      from = stageOf(row);                 // dispatchable from acknowledged or on_hold

    } else if (action === "receive") {
      patch.receipt_note = remark || null;
      patch.status = "received";
      patch.received_by = me;
      patch.received_at = now;
      from = "dispatched";

    } else if (action === "issue") {
      // Back to Head Office, who are the only ones who can send it again.
      patch.issue_note = remark || null;
      patch.issue_by = me;
      patch.issue_at = now;
      patch.status = "acknowledged";
      from = "dispatched";

    } else {
      // reject: from wherever it stands, which is only ever a stage before
      // it was sent - hoActions stops offering this once it has shipped.
      hoNote();
      patch.status = "rejected";
      patch.rejected_by = me;
      patch.rejected_at = now;
      from = stageOf(row);
    }

    el.hoConfirm.disabled = true;

    // Conditional on the stage it was read at, so two people acting at once
    // cannot step on each other.
    db.from("requisitions").update(patch)
      .eq("id", row.id).eq("status", from).select("id")
      .then(function (res) {
        el.hoConfirm.disabled = false;
        if (res.error) {
          setFieldError(el.hoRemark, "ho-remark-error",
            "Could not save: " + res.error.message);
          reportError("save fulfilment", res.error);
          return;
        }
        if (!res.data || !res.data.length) {
          setFieldError(el.hoRemark, "ho-remark-error",
            "Somebody has already moved this one on.");
          loadRequisitions();
          return;
        }
        var whose = String(row.requester_name || "").trim();
        var DONE = {
          acknowledge: "Acknowledged", dispatch: "Dispatched",
          hold: "Put on hold", resume: "Back in the queue",
          receive: "Receipt confirmed", issue: "Reported as not arrived",
          reject: "Rejected"
        };
        var done = DONE[action] || "Updated";
        closeHo();
        showListBanner(done + (whose ? " — " + whose + "'s requisition." : "."));
        loadRequisitions();
      })
      .catch(function (err) {
        el.hoConfirm.disabled = false;
        setFieldError(el.hoRemark, "ho-remark-error", "Could not save: " + messageOf(err));
        reportError("save fulfilment", err);
      });
  }

  /* ------------------------------------------------------------ Settings

     Who fulfils requisitions. Open to the people on the list and to Staff
     Connect Admins - without the second, removing the last name would lock
     the door from the inside. */
  function renderAdmins() {
    if (!el.adminList) return;

    if (!hasAdmins) {
      el.adminList.innerHTML =
        '<p class="aw-empty-line">Run <code>sql/2026-10-16-award-hold-and-issues.sql</code> ' +
        "to set this up.</p>";
      return;
    }
    if (!hoAdmins.length) {
      el.adminList.innerHTML =
        '<p class="aw-empty-line">Nobody yet. Until somebody is added, approved ' +
        "requisitions sit waiting with no one able to act on them.</p>";
      return;
    }

    el.adminList.innerHTML = hoAdmins.map(function (a) {
      return '<li class="admin-row">' +
               '<span class="admin-who"><b>' + escapeHtml(a.name || a.email) + "</b>" +
                 (a.name ? '<span>' + escapeHtml(a.email) + "</span>" : "") +
               "</span>" +
               '<span class="admin-added">' +
                 (a.added_by ? "added by " + escapeHtml(a.added_by) : "") +
               "</span>" +
               '<button type="button" class="btn btn-ghost btn-xs is-danger" ' +
                 'data-aw-admin-remove="' + escapeHtml(a.id) + '">Remove</button>' +
             "</li>";
    }).join("");
  }

  function addAdmin() {
    var email = el.adminEmail.value.trim().toLowerCase();
    var name = el.adminName.value.trim();

    setFieldError(el.adminEmail, "admin-email-error", "");
    if (!email) {
      setFieldError(el.adminEmail, "admin-email-error", "Enter an email address.");
      return;
    }
    if (email.indexOf("@") < 1 || email.indexOf(".", email.indexOf("@")) < 0) {
      setFieldError(el.adminEmail, "admin-email-error", "That does not look like an address.");
      return;
    }
    for (var i = 0; i < hoAdmins.length; i++) {
      if (String(hoAdmins[i].email).toLowerCase() === email) {
        setFieldError(el.adminEmail, "admin-email-error", "They are already on the list.");
        return;
      }
    }

    el.adminAdd.disabled = true;
    db.from("award_admins").insert([{
      email: email, name: name || null,
      added_by: (signedInUser() || {}).name || myEmail()
    }]).select("id")
      .then(function (res) {
        el.adminAdd.disabled = false;
        if (res.error) {
          setFieldError(el.adminEmail, "admin-email-error",
            /duplicate|unique/i.test(res.error.message || "")
              ? "They are already on the list."
              : "Could not add: " + res.error.message);
          return;
        }
        el.adminEmail.value = "";
        el.adminName.value = "";
        loadAdmins(function () { renderAdmins(); applyAccess(); renderTable(); });
      })
      .catch(function (err) {
        el.adminAdd.disabled = false;
        setFieldError(el.adminEmail, "admin-email-error", "Could not add: " + messageOf(err));
      });
  }

  function removeAdmin(id) {
    var who = null;
    for (var i = 0; i < hoAdmins.length; i++) {
      if (String(hoAdmins[i].id) === String(id)) { who = hoAdmins[i]; break; }
    }
    if (!who) return;

    /* Taking the last one off leaves nobody able to fulfil anything, so it
       says so rather than removing quietly. Asked through the shell's own
       dialog, not window.confirm - the rest of Staff Connect does, and a
       browser box in the middle of this would look like something had gone
       wrong. */
    var last = hoAdmins.length === 1;
    var ask = window.showAppConfirm ? window.showAppConfirm({
      title: last ? "Remove the last HO admin?" : "Remove from Head Office?",
      type: last ? "warning" : "question",
      message: last
        ? "Nobody will be left to acknowledge or deliver requisitions, and the "
          + "Delivery tab will disappear until somebody is added again."
        : (who.name || who.email) + " will no longer see the Delivery tab.",
      confirmText: "Remove",
      cancelText: "Keep"
    }) : Promise.resolve(window.confirm("Remove " + (who.name || who.email) + "?"));

    Promise.resolve(ask).then(function (yes) {
      if (!yes) return;

      db.from("award_admins").delete().eq("id", id)
        .then(function (res) {
          if (res.error) { reportError("remove an HO admin", res.error); return; }
          loadAdmins(function () { renderAdmins(); applyAccess(); renderTable(); });
        })
        .catch(function (err) { reportError("remove an HO admin", err); });
    });
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

    Array.prototype.forEach.call(
      el.hoModal.querySelectorAll("[data-aw-close-ho]"),
      function (node) { node.addEventListener("click", closeHo); }
    );
    el.hoConfirm.addEventListener("click", confirmHoAction);

    el.adminAdd.addEventListener("click", addAdmin);
    el.adminEmail.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); addAdmin(); }
    });
    el.adminList.addEventListener("click", function (event) {
      var btn = event.target.closest && event.target.closest("[data-aw-admin-remove]");
      if (btn) removeAdmin(btn.getAttribute("data-aw-admin-remove"));
    });

    el.newReqBtn.addEventListener("click", openRequisitionModal);

    el.awardAdd.addEventListener("click", addAwardLine);

    // The lines are rebuilt as they are added and removed, so the listeners
    // sit on the container rather than on each one.
    el.awardLines.addEventListener("change", function (event) {
      if (event.target.classList.contains("award-line-type")) {
        setFieldError(null, "award-type-error", "");
        syncAwardLines();
      }
    });
    el.awardLines.addEventListener("click", function (event) {
      var btn = event.target.closest && event.target.closest(".award-line-remove");
      if (!btn) return;
      if (el.awardLines.querySelectorAll(".award-line").length < 2) return;
      btn.closest(".award-line").remove();
      syncAwardLines();
    });

    // One listener on the body rather than one per row, since the rows are
    // thrown away and rebuilt on every render.
    el.tbody.addEventListener("click", function (event) {
      var review = event.target.closest ? event.target.closest("[data-aw-review]") : null;
      if (review) { openReview(review.getAttribute("data-aw-review")); return; }

      var ho = event.target.closest ? event.target.closest("[data-aw-ho]") : null;
      if (ho) startHoAction(ho.getAttribute("data-aw-row"), ho.getAttribute("data-aw-ho"));
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

  /* The award types, kept so a line can be built whenever one is added. */
  var awardTypes = [];

  function awardLineHtml() {
    var opts = '<option value="">Select award type</option>';
    awardTypes.forEach(function (t) {
      opts += '<option value="' + escapeHtml(t.id) + '">' + escapeHtml(t.name) + "</option>";
    });
    return '<div class="award-line">' +
             '<select class="award-line-type" aria-label="Award type">' + opts + "</select>" +
             '<input type="number" class="award-line-qty mono" min="1" max="1000000" ' +
                    'step="1" placeholder="Qty" aria-label="Quantity" />' +
             '<button type="button" class="award-line-remove" aria-label="Remove this award">' +
               '<i class="aw-icon" data-aw-icon="close" aria-hidden="true"></i>' +
             "</button>" +
           "</div>";
  }

  function addAwardLine() {
    el.awardLines.insertAdjacentHTML("beforeend", awardLineHtml());
    paintIcons();
    syncAwardLines();
    var lines = el.awardLines.querySelectorAll(".award-line");
    var last = lines[lines.length - 1];
    if (last) last.querySelector(".award-line-type").focus();
  }

  function resetAwardLines() {
    el.awardLines.innerHTML = awardLineHtml();
    paintIcons();
    syncAwardLines();
  }

  /* An award already on the requisition is taken out of the other lines'
     lists, so the same one cannot be asked for twice - two lines of the same
     award is a mistake every time, and catching it here is kinder than
     refusing it on submit. The remove button hides when one line is left,
     since there is nothing to go back to. */
  function syncAwardLines() {
    var lines = Array.prototype.slice.call(el.awardLines.querySelectorAll(".award-line"));
    var chosen = lines.map(function (l) { return l.querySelector(".award-line-type").value; });

    lines.forEach(function (line, i) {
      var select = line.querySelector(".award-line-type");
      Array.prototype.forEach.call(select.options, function (opt) {
        opt.disabled = opt.value !== "" && opt.value !== chosen[i] &&
                       chosen.indexOf(opt.value) !== -1;
      });
      line.querySelector(".award-line-remove").hidden = lines.length < 2;
    });

    // Nothing left to add once every award is on the requisition.
    el.awardAdd.hidden = lines.length >= awardTypes.length;
  }

  function readAwardLines() {
    return Array.prototype.map.call(
      el.awardLines.querySelectorAll(".award-line"),
      function (line) {
        var id = line.querySelector(".award-line-type").value;
        var qty = line.querySelector(".award-line-qty").value.trim();
        var type = null;
        for (var i = 0; i < awardTypes.length; i++) {
          if (String(awardTypes[i].id) === String(id)) { type = awardTypes[i]; break; }
        }
        return { line: line, id: id, qty: qty, type: type };
      }
    );
  }

  function loadAdmins(done) {
    if (!hasAdmins) { hoAdmins = []; return done && done(); }

    db.from("award_admins").select("id, email, name, added_by, added_at")
      .order("email")
      .then(function (res) {
        if (res.error) {
          if (/award_admins/i.test(res.error.message || "")) {
            hasAdmins = false;                // fulfilment migration not run
          } else {
            reportError("load the HO list", res.error);
          }
          hoAdmins = [];
          return done && done();
        }
        hoAdmins = res.data || [];
        done && done();
      })
      .catch(function (err) {
        reportError("load the HO list", err);
        hoAdmins = [];
        done && done();
      });
  }

  function loadAwardTypes() {
    db.from("award_types").select("id, code, name")
      .order("sort_order").order("name")
      .then(function (res) {
        if (res.error) {
          el.awardLines.innerHTML =
            '<p class="error">Could not load award types.</p>';
          reportError("load award types", res.error);
          return;
        }
        awardTypes = res.data || [];
        resetAwardLines();
      })
      .catch(function (err) {
        el.awardLines.innerHTML = '<p class="error">Could not load award types.</p>';
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
      // Filled in below, from the award lines.
      award_type_id: null,
      items: null,
      requester_name: (signedInUser() || {}).name || "",
      // The name is what gets shown; the address is what identifies the
      // account behind it, and names are neither unique nor permanent.
      requester_email: myEmail() || null,
      // Recorded now, not looked up later: who may approve this depends on
      // the level it was raised at, and people move between roles.
      requester_role: (myStanding() || {}).role || null,
      requester_level: (myStanding() || {}).level || null,
      quantity: 0,
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
    /* The awards asked for. Every line has to name one and say how many.
       Only the first fault is reported: a list of complaints about a
       three-line form reads worse than one clear sentence. */
    var lines = readAwardLines();
    var items = [];
    var total = 0;
    var lineFault = "";

    lines.forEach(function (l) {
      l.line.classList.remove("has-error");
      var n = Number(l.qty);

      if (!l.id) {
        if (!lineFault) lineFault = "Choose an award on every line, or remove the empty one.";
      } else if (!l.qty) {
        if (!lineFault) lineFault = "Say how many of each award.";
      } else if (!Number.isInteger(n) || n < 1) {
        if (!lineFault) lineFault = "Quantities are whole numbers of 1 or more.";
      } else if (n > 1000000) {
        if (!lineFault) lineFault = "That quantity looks too large.";
      } else {
        items.push({
          award_type_id: Number(l.id),
          code: l.type ? l.type.code : null,
          name: l.type ? l.type.name : null,
          quantity: n
        });
        total += n;
        return;
      }
      l.line.classList.add("has-error");
    });

    if (!items.length && !lineFault) lineFault = "Add at least one award.";

    if (lineFault) {
      setFieldError(null, "award-type-error", lineFault);
      ok = false;
    } else {
      setFieldError(null, "award-type-error", "");
      values.items = items;
      values.quantity = total;
      // Still set when exactly one is asked for, so the older rows and the
      // join keep meaning something.
      values.award_type_id = items.length === 1 ? items[0].award_type_id : null;
    }
    // Nothing to type here any more, so the only way this fails is a session
    // that has gone away underneath them.
    if (!values.requester_name) {
      setFieldError(null, "requester-error",
        "Could not tell who you are. Reload the page and sign in again."); ok = false;
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
          var missing = /(state_name|division_name|district_name|requester_email)/i
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
        var typeName = values.items.length === 1
          ? values.items[0].name
          : values.items.length + " awards";

        resetAwardLines();

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
              (hasItems ? " items," : "") +
              (hasFulfilment ? " acknowledged_by, acknowledged_at, dispatched_by," +
                               " dispatched_at, received_by, received_at, receipt_note," +
                               " rejected_by, rejected_at, ho_remark," : "") +
              (hasEmails ? " requester_email, decided_by_email, ho_by_email," : "") +
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
          if (hasEmails && /(requester_email|decided_by_email|ho_by_email)/i.test(msg)) {
            hasEmails = false;                // addresses not migrated yet
            loadRequisitions();
            return;
          }
          if (hasFulfilment &&
              /(acknowledged_|dispatched_|received_|receipt_note|rejected_|ho_remark)/i.test(msg)) {
            hasFulfilment = false;            // fulfilment not migrated yet
            loadRequisitions();
            return;
          }
          if (hasItems && /items/i.test(msg)) {
            hasItems = false;                 // multiple awards not migrated yet
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
        // Its own table, and renderTable returns early when the list is
        // empty - which is exactly when the queue needs its empty state.
        renderDelivery();
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
      awardsOf(row).forEach(function (a) { types[a.name] = true; });

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
      if (typeFilter && awardsOf(row).every(function (a) { return a.name !== typeFilter; })) return false;
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
      var awards = awardsOf(row);

      html +=
        "<tr>" +
          '<td><span class="state-code" title="' + escapeHtml(stateName) + '">' +
            escapeHtml(p.code || stateName) + "</span></td>" +
          "<td>" + escapeHtml(p.division || "—") + "</td>" +
          "<td>" + escapeHtml(p.district || "—") + "</td>" +
          "<td>" + escapeHtml(row.requester_name) + "</td>" +
          "<td>" + awardsCellHtml(awards) + "</td>" +
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

  /* What a requisition asks for. New rows carry a list; the ones filed
     before that asked for one award and are read from the join. */
  function awardsOf(row) {
    if (row && row.items && row.items.length) {
      return row.items.map(function (it) {
        return { name: it.name || it.code || "Award", quantity: Number(it.quantity) || 0 };
      });
    }
    if (row && row.award_types) {
      return [{ name: row.award_types.name, quantity: Number(row.quantity) || 0 }];
    }
    return [];
  }

  function awardsCellHtml(awards) {
    if (!awards.length) return "—";
    return awards.map(function (a) {
      return '<span class="type-chip">' + escapeHtml(a.name) +
             '<b>' + escapeHtml(a.quantity.toLocaleString()) + "</b></span>";
    }).join(" ");
  }

  /* The state of a requisition, and - where it has been settled - who said
     so. The remark hangs off the chip rather than taking a column of its
     own: most are short, and a column of mostly-empty cells reads worse. */
  /* The stage it has reached, and under it the steps that got it there, so
     the whole journey is on the row rather than hidden behind a tooltip. */
  function statusCellHtml(row, forHo) {
    var key = stageOf(row);
    var stage = STAGES[key];

    var trail = trailOf(row).map(function (st) {
      return '<span class="cell-step"' +
             (st.email ? ' title="' + escapeHtml(st.email) + '"' : "") + "><b>" +
             escapeHtml(st.what) + "</b>" +
             (st.who ? " " + escapeHtml(st.who) : "") +
             (st.when ? ' <i>' + escapeHtml(formatTimestamp(st.when)) + "</i>" : "") +
             "</span>";
    }).join("");

    var remark = row.issue_note || row.receipt_note || row.ho_remark ||
                 row.decision_remark || "";

    return '<span class="chip-status is-' + escapeHtml(stage.tone) + '">' +
             escapeHtml(stageLabel(row, forHo)) + "</span>" +
           '<span class="cell-trail">' + trail + "</span>" +
           (remark ? '<span class="cell-remark" title="' + escapeHtml(remark) + '">' +
                     escapeHtml(remark) + "</span>" : "");
  }

  var HO_LABELS = {
    acknowledge: "Acknowledge",
    dispatch:    "Mark dispatched",
    hold:        "Put on hold",
    resume:      "Take off hold",
    reject:      "Reject",
    receive:     "Confirm received",
    issue:       "Never arrived"
  };

  function actionCellHtml(row) {
    if (!hasApproval) return "";

    if (canDecide(myStanding(), row)) {
      return '<button type="button" class="btn btn-ghost btn-xs" data-aw-review="' +
               escapeHtml(row.id) + '">Review</button>';
    }

    if (canConfirmReceipt(row)) {
      var mine = '<button type="button" class="btn btn-ghost btn-xs" ' +
                   'data-aw-ho="receive" data-aw-row="' + escapeHtml(row.id) + '">' +
                   HO_LABELS.receive + "</button>";
      if (canReportIssue(row)) {
        mine += ' <button type="button" class="btn btn-ghost btn-xs is-danger" ' +
                  'data-aw-ho="issue" data-aw-row="' + escapeHtml(row.id) + '">' +
                  HO_LABELS.issue + "</button>";
      }
      return mine;
    }

    return hoActions(row).map(function (act) {
      return '<button type="button" class="btn btn-ghost btn-xs' +
               (act === "reject" ? " is-danger" : "") +
               '" data-aw-ho="' + escapeHtml(act) + '" data-aw-row="' +
               escapeHtml(row.id) + '">' + HO_LABELS[act] + "</button>";
    }).join(" ");
  }

  /* HO's queue: what has been approved and not yet finished with. Settled
     requisitions drop off - this is a list of work, not a record. */
  function renderDelivery() {
    if (!el.deliveryBody) return;

    /* Everything that has reached HO, open ones first. A dispatched
       requisition stays here rather than vanishing: HO needs to see it turn
       into Delivered when the requester confirms, which is the whole point
       of them confirming. The settled ones sit underneath as the record. */
    var ORDER = { approved: 0, on_hold: 1, acknowledged: 2, dispatched: 3,
                  received: 4, rejected: 5 };
    var rows = allRequisitions.filter(function (r) {
      return ORDER[stageOf(r)] !== undefined;
    }).sort(function (a, b) {
      var d = ORDER[stageOf(a)] - ORDER[stageOf(b)];
      return d !== 0 ? d : String(b.created_at).localeCompare(String(a.created_at));
    });

    if (!rows.length) {
      el.deliveryBody.innerHTML =
        '<tr class="placeholder-row"><td colspan="8">' +
        (hasAdmins
          ? "Nothing yet. Requisitions appear here once they are approved."
          : "Run sql/2026-10-16-award-hold-and-issues.sql to set this up.") +
        "</td></tr>";
      return;
    }

    el.deliveryBody.innerHTML = rows.map(function (row) {
      var p = placeOf(row);
      var awards = awardsOf(row);
      return "<tr>" +
        '<td><span class="state-code" title="' + escapeHtml(p.state) + '">' +
          escapeHtml(p.code || p.state || "—") + "</span></td>" +
        "<td>" + escapeHtml(p.division || "—") + "</td>" +
        "<td>" + escapeHtml(p.district || "—") + "</td>" +
        "<td>" + escapeHtml(row.requester_name || "—") + "</td>" +
        "<td>" + awardsCellHtml(awards) + "</td>" +
        '<td class="num">' + escapeHtml(Number(row.quantity).toLocaleString()) + "</td>" +
        "<td>" + statusCellHtml(row, true) + "</td>" +
        '<td class="cell-action">' + actionCellHtml(row) + "</td>" +
      "</tr>";
    }).join("");
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
      /* A refusal is not a failure to connect. Saying "could not reach the
         database, check your Project URL" when the database answered - and
         said no - sends whoever reads it to the wrong place entirely. */
      var refused = /violates|constraint|duplicate key|permission denied|row-level security/i
        .test(message);
      var missingTable = !refused && /schema cache|does not exist/i.test(message);
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
          : refused
            ? "The database refused it. Nothing was saved, and nothing is " +
              "broken - this is a rule in the database disagreeing with what " +
              "the page sent. The migrations in <code>sql/</code> are where " +
              "those rules are set."
            : "Check that the config block at the top of <code>award.js</code> " +
              "holds the right Project URL and publishable key."),
        missingTable ? "Something in the database is missing."
          : refused ? "The database would not accept that."
          : "Could not reach the database."
      );
    }
  }

  // The shell decides when this page exists; it calls mount() after the
  // fragment is in the DOM.
  window.AwardManagement = { mount: mount };
})();
