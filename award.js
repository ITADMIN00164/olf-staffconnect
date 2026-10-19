/* ===========================================================================
 *  Supabase connection.
 *
 *  Both values are meant to be public. The publishable key is the browser-side
 *  key and is safe to ship in frontend code; what actually guards the data is
 *  Row Level Security, defined in the files under sql/.
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
 * Loaded after the Supabase UMD bundle index.html already pulls in; this tab
 * talks to a different project, so it keeps its own client. Places, roles and
 * people all come from the Employees directory, never from a table here.
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
    district: document.getElementById("district"),
    reqWhere: document.getElementById("req-where"),
    requesterName: document.getElementById("requester-name"),
    requesterWho: document.getElementById("requester-who"),
    requesterSub: document.getElementById("requester-sub"),
    submitBtn: document.getElementById("submit-btn"),
    resetBtn: document.getElementById("reset-btn"),
    formBanner: document.getElementById("form-banner"),
    formBannerIcon: document.getElementById("form-banner-icon"),
    formBannerText: document.getElementById("form-banner-text"),

    refreshBtn: document.getElementById("refresh-btn"),
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
    hoLinesField: document.getElementById("ho-lines-field"),
    hoLines: document.getElementById("ho-lines"),
    hoConfirm: document.getElementById("ho-confirm"),
    deliveryBody: document.getElementById("delivery-body"),
    stockYear: document.getElementById("stock-year"),
    stockState: document.getElementById("stock-state"),
    stockDivision: document.getElementById("stock-division"),
    stockDistrict: document.getElementById("stock-district"),
    stockFetch: document.getElementById("stock-fetch"),
    stockWhere: document.getElementById("stock-where"),
    stockModal: document.getElementById("stock-modal"),
    detailModal: document.getElementById("detail-modal"),
    detailHeading: document.getElementById("detail-heading"),
    detailSub: document.getElementById("detail-sub"),
    detailBody: document.getElementById("detail-body"),
    stockHeading: document.getElementById("stock-heading"),
    stockSub: document.getElementById("stock-sub"),
    stockFLabel: document.getElementById("stock-f-label"),
    stockLines: document.getElementById("stock-lines"),
    stockNote: document.getElementById("stock-note"),
    stockSave: document.getElementById("stock-save"),
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

  // Each migration adds columns; until it is run the row is read without
  // them. See loadRequisitions for how each flag gets turned off.
  var hasApproval = true;
  var hasItems = true;        // false until the multiple-awards migration runs
  var hasFulfilment = true;   // false until the fulfilment migration runs
  var hasEmails = true;       // false until the addresses migration runs
  var hasLog = true;          // false until sql/award-log-setup.sql is run
  var hasSent = true;         // false until sql/award-stock-setup.sql is run

  /* Where a requisition has got to.

       raised ─> approved ─> acknowledged ─> dispatched ─> received
          │          │             │
          │          └── rejected ─┘
          └── declined

     declined is the approver turning it down; rejected is Head Office unable
     to fulfil it. Dispatch and receipt are likewise two events: Head Office
     knows it sent the award, only the requester knows it arrived. */
  var STAGES = {
    submitted:    { label: "Pending",      tone: "pending",  open: true  },
    approved:     { label: "Approved",     tone: "approved", open: true  },
    acknowledged: { label: "Acknowledged", tone: "progress", open: true  },
    on_hold:      { label: "On hold",      tone: "held",     open: true  },
    dispatched:   { label: "Dispatched",   tone: "progress", open: true,
                    hoLabel: "Awaiting confirmation" },
    received:     { label: "Received",     tone: "done",     open: false,
                    hoLabel: "Delivered" },
    declined:     { label: "Declined",     tone: "declined", open: false },
    rejected:     { label: "Rejected",     tone: "declined", open: false }
  };

  // One state, two vantage points: receipt to the requester is delivery
  // completing to Head Office.
  function stageLabel(row, forHo) {
    var stage = STAGES[stageOf(row)];
    return (forHo && stage.hoLabel) || stage.label;
  }

  function stageOf(row) {
    var key = String((row && row.status) || "submitted").toLowerCase();
    return STAGES[key] ? key : "submitted";
  }

  /* The approver's part. Anything not still submitted has been past an
     approver, so it is read by what it is not - naming the stages meant each
     new one had to be remembered here too. */
  function statusOf(row) {
    var d = stageOf(row);
    if (d !== "submitted") {
      return { decision: d === "declined" ? "declined" : "approved",
               by: row.decided_by, byRole: row.decided_by_role,
               remark: row.decision_remark, at: row.decided_at };
    }
    return { decision: null };
  }

  /* Who an open requisition is sitting with - by name where there is one,
     by the role that has to act where there is not. A COO has no division,
     so none is named when they are the only ones left. */
  function waitingOn(row) {
    switch (stageOf(row)) {
      case "submitted":
        var lvl = levelRaisedAt(row);
        var div = String(row.division_name || "").trim();
        if (lvl >= 3) return "the COO";
        var who = lvl === 2
          ? "a Divisional Manager or the COO"
          : "a Programme Manager, Divisional Manager or the COO";
        return who + (div ? " in " + div : "");

      case "approved":     return "Head Office, to acknowledge it";
      case "acknowledged": return "Head Office, to send it";
      case "on_hold":      return "Head Office, who are waiting on stock";
      case "dispatched":
        var name = String(row.requester_name || "").trim();
        return (name || "the requester") + ", to confirm it arrived";

      // Settled. Nobody is waiting on anything.
      default: return "";
    }
  }

  /* Every step a requisition has been through, in order. The log is appended
     to and never rewritten, so a hold, a resume and a second hold all stay.
     Rows filed before the log column existed fall back to their columns. */
  var STEP_WORDS = {
    raised:       { label: "Raised",         tone: "start" },
    approved:     { label: "Approved",       tone: "good"  },
    declined:     { label: "Declined",       tone: "bad"   },
    acknowledged: { label: "Acknowledged",   tone: "move"  },
    held:         { label: "Put on hold",    tone: "warn"  },
    resumed:      { label: "Taken off hold", tone: "move"  },
    dispatched:   { label: "Dispatched",     tone: "move"  },
    not_received: { label: "Never arrived",  tone: "bad"   },
    received:     { label: "Received",       tone: "good"  },
    rejected:     { label: "Rejected",       tone: "bad"   }
  };

  function trailOf(row) {
    var log = row && row.log;
    if (log && log.length) {
      return log.slice().sort(function (a, b) {
        return String(a.at || "").localeCompare(String(b.at || ""));
      }).map(function (e) {
        var word = STEP_WORDS[e.what] || { label: String(e.what || "Step"), tone: "move" };
        return { what: word.label, tone: word.tone, who: e.by || "",
                 when: e.at || "", note: e.note || "", email: e.email || "" };
      });
    }

    // Nothing logged: read back what the columns can still tell us.
    var steps = [];
    var push = function (what, who, when, note, email) {
      if (who || when) {
        var word = STEP_WORDS[what];
        steps.push({ what: word.label, tone: word.tone, who: who || "",
                     when: when || "", note: note || "", email: email || "" });
      }
    };
    push("raised", row.requester_name, row.created_at, "", row.requester_email);
    if (row.decided_at) {
      push(stageOf(row) === "declined" ? "declined" : "approved",
           row.decided_by, row.decided_at, row.decision_remark, row.decided_by_email);
    }
    push("acknowledged", row.acknowledged_by, row.acknowledged_at);
    push("held", row.held_by, row.held_at);
    push("dispatched", row.dispatched_by, row.dispatched_at, row.ho_remark);
    push("not_received", row.issue_by, row.issue_at, row.issue_note);
    push("received", row.received_by, row.received_at, row.receipt_note);
    push("rejected", row.rejected_by, row.rejected_at, row.ho_remark);
    return steps;
  }

  function withLog(row, what, note, patch) {
    if (hasLog && what) patch.log = logEntry(row, what, note);
    return patch;
  }

  // The columns beside the log still record the latest of each step; the
  // log is the history, and it only ever grows.
  function logEntry(row, what, note) {
    var log = (row && row.log && row.log.slice()) || [];
    log.push({
      at: new Date().toISOString(),
      what: what,
      by: (signedInUser() || {}).name || myEmail() || "",
      email: myEmail() || null,
      note: note || null
    });
    return log;
  }

  /* Who may raise a requisition and who may decide on one, both from the
     Department recorded in Employees. An approver has to sit above the level
     it was raised at:

       4  COO   Program Implementation COO    decides on DM, PM and PO
       3  DM    Program Implementation Div    decides on PM and PO
       2  PM    Program Implementation PM     decides on PO
       1  PO    Program Implementation        raises only

     Raising is for PO, PM and DM; the COO decides rather than asks. The
     directory spells PO both ways, hence the anchored patterns - a prefix
     match would make every variant look like a PO. */
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

  /* Null for anyone outside Programme Implementation, anyone with no
     Employees record, and anyone marked Inactive. */
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

  /* An approver has to cover the division the requisition is for. The COO is
     the exception - no division is recorded against the role, because it sits
     above all of them. A blank Division on anyone else covers nothing, not
     everything: until it is filled in on the Employees tab they see no Review
     buttons. */
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

  // PO, PM and DM raise; the COO decides instead, and everyone else sees
  // the list but not the button.
  function canRaise(standing)  { return !!standing && standing.level <= 3; }

  /* Legacy rows carry no level: they were filed before the role was
     recorded. Treating them as the lowest keeps them actionable rather than
     stranding them, which is the kinder failure for three test rows. */
  function levelRaisedAt(row) {
    var n = Number(row && row.requester_level);
    return n >= 1 && n <= 4 ? n : 1;
  }

  /* Head Office: the people who fulfil requisitions, kept in award_admins
     and managed from Settings. Matched on the signed-in address. */
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

  /* Settings is for Staff Connect Admins alone: Head Office fulfils
     requisitions, appointing who does that is a different job. Admins exist
     in Firestore, independently of this list, so emptying it can never lock
     everybody out. */
  function canManageAdmins() { return isAppAdmin(); }

  /* What HO may do to a requisition at its current stage. Nothing before it
     has been approved - an unapproved requisition is not HO's business
     yet. */
  function hoActions(row) {
    if (!isHoAdmin()) return [];
    switch (stageOf(row)) {
      case "approved":     return ["acknowledge", "reject"];
      case "acknowledged": return ["dispatch", "hold", "reject"];
      // On hold is waiting, not refusing. Nothing is sent from here: the
      // hold is lifted first, so the row says the blocker was settled.
      case "on_hold":      return ["resume", "reject"];
      // Once it has been sent there is nothing left for HO to do and nothing
      // left to withhold; the next move belongs to the requester.
      default:             return [];
    }
  }

  /* Matched on the address where the row has one; rows filed before
     addresses were recorded fall back to the name, which is all they carry. */
  function isMine(row) {
    var mine = myEmail();
    var theirs = String((row && row.requester_email) || "").trim().toLowerCase();
    if (theirs && mine) return theirs === mine;

    var myName = String((signedInUser() || {}).name || "").trim().toLowerCase();
    var theirName = String((row && row.requester_name) || "").trim().toLowerCase();
    return !!myName && myName === theirName;
  }

  // Whoever raised it, and nobody else: they are the only one who can see
  // it arrive.
  function canConfirmReceipt(row) {
    return stageOf(row) === "dispatched" && isMine(row);
  }

  // Dispatched and nothing came; otherwise a lost parcel leaves the row
  // open for ever.
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
    ["state", "division", "district", "award-type", "requester", "quantity"]
      .forEach(function (id) {
        var node = document.getElementById(id + "-error");
        if (node) node.textContent = "";
        var input = document.getElementById(id);
        if (input) input.classList.remove("invalid");
      });
  }

  /* Drawn from here rather than written into the fragment: Live Server
     treats a fragment containing inline <svg> as a document to inject its
     reload script into, and truncates the response. */
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
           '<path d="M6 6l12 12M18 6L6 18"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
            'stroke-width="2" stroke-linecap="round">' +
            '<circle cx="11" cy="11" r="6"/><path d="m16 16 4.5 4.5"/></svg>'
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
    showTab(el.subtabs, "data-aw-subtab", "requisition");
    applyAccess();

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
        "Open <code>award.js</code> and replace the two placeholder values at " +
        "the top with your project's <strong>Project URL</strong> and " +
        "<strong>publishable key</strong> (Supabase Dashboard → Project " +
        "Settings → API), then reload this page."
      );
      disableForm();
      placeholderRow("Waiting for Supabase credentials at the top of award.js.");
      return;
    }

    // One client for the life of the page, not one per visit to the tab.
    if (!db) db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

    wireEvents();
    loadAdmins(function () { applyAccess(); renderRows(); });
    loadStock(function () { refreshStockControls(); renderStock(); });
    loadGeography();
    loadAwardTypes();
    loadRequisitions();
  }

  // ------------------------------------------------------------- the tabs

  /* Works off each button's own attribute and the panel it names, rather
     than a list that would have to be kept in step with the markup. */
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

    /* The count belongs to the list of requisitions. On the stock sheet it
       sat in the corner saying "3 items" about something that was not on
       screen. */
    if (el.rowPill) el.rowPill.hidden = name !== "requisition";
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

    // Built each time it opens, from the directory as it stands now.
    fillMyDistricts();

    // Put back where the last one was for, if that is still on offer.
    if (lastPlace) el.district.value = lastPlace.district;

    el.modal.classList.add("is-open");
    document.addEventListener("keydown", onModalKeydown);

    // The page behind must not scroll under the dialog, and must not lose
    // its place when the scrollbar goes.
    scrollLockedAt = window.scrollY;
    document.body.style.overflow = "hidden";

    // Straight to the first thing that still needs choosing.
    var first = el.district.value
      ? el.awardLines.querySelector(".award-line-type")
      : el.district;
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

  /* Review. A decision cannot be taken back, so it gets a dialog rather
     than a button in the row. Declining asks for a reason; approving may
     carry one. */
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
        "<div><dt>Awards</dt><dd>" + awardsCellHtml(awardsOf(row), row) + "</dd></div>" +
        "<div><dt>Total</dt><dd>" + escapeHtml(Number(row.quantity).toLocaleString()) +
        "</dd></div>" +
        "<div><dt>For</dt><dd>" +
          escapeHtml([p.district, p.division, p.state].filter(Boolean).join(", ")) +
        "</dd></div>" +
        "<div><dt>Filed</dt><dd>" + escapeHtml(formatTimestamp(row.created_at)) + "</dd></div>" +
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
      .update(withLog(reviewing, decision === "approved" ? "approved" : "declined", remark, {
        status: decision,
        decision_remark: remark || null,
        decided_by: (signedInUser() || {}).name || "",
        decided_by_email: myEmail() || null,
        decided_by_role: standing.role,
        decided_at: new Date().toISOString()
      }))
      .eq("id", reviewing.id)
      .eq("status", "submitted")
      .select("id")
      .then(function (res) {
        el.reviewApprove.disabled = el.reviewDecline.disabled = false;
        if (res.error) {
          setReviewStatus(/decided_|decision_remark|status/i.test(res.error.message || "")
            ? "Approvals are not set up in the database yet - run " +
              "sql/award-management-setup.sql."
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

  /* Delivery is Head Office's queue and Settings is where Head Office is
     decided, so neither is shown to people they mean nothing to. Hidden
     rather than disabled: a tab you may never open is clutter. */
  function applyAccess() {
    var show = { requisition: true, stock: true,
                 delivery: isHoAdmin(), settings: canManageAdmins() };

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
    refreshStockControls();
    renderStock();
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

  /* Head Office's moves. Acknowledging and dispatching take a note only if
     there is one to make; rejecting ends the requisition, so it asks for a
     reason. */
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
        "<div><dt>Awards</dt><dd>" + awardsCellHtml(awardsOf(row), row) + "</dd></div>" +
        "<div><dt>For</dt><dd>" +
          escapeHtml([p.district, p.division, p.state].filter(Boolean).join(", ")) +
        "</dd></div>" +
      "</dl>";

    /* Dispatching asks how many are going, filled in with what was asked
       for. Changing a figure is the whole point: a district that is sent 60
       of the 100 it wanted has 60, and the stock has to say so. */
    var sending = action === "dispatch";
    el.hoLinesField.hidden = !sending;
    if (sending) {
      var asked = quantitiesOf(row, "items");
      el.hoLines.innerHTML = awardTypes.filter(function (t) {
        return asked[t.id];
      }).map(function (t) {
        return '<div class="stock-line"><label>' + escapeHtml(t.name) +
               ' <span class="hint">asked for ' + escapeHtml(asked[t.id]) + '</span></label>' +
               '<input type="number" class="mono ho-qty" data-type="' + escapeHtml(t.id) +
               '" min="0" max="1000000" step="1" value="' + escapeHtml(asked[t.id]) + '" /></div>';
      }).join("");
      setFieldError(null, "ho-lines-error", "");
    }

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
      var going = [];
      var short = false;
      var fault = "";
      Array.prototype.forEach.call(el.hoLines.querySelectorAll(".ho-qty"), function (input) {
        var id = Number(input.getAttribute("data-type"));
        var n = Number(input.value.trim());
        var asked = quantitiesOf(row, "items")[id] || 0;
        if (!Number.isInteger(n) || n < 0) {
          if (!fault) fault = "Quantities are whole numbers, nothing or more.";
          return;
        }
        if (n > asked) {
          if (!fault) fault = "More than was asked for. Raise a new requisition instead.";
          return;
        }
        if (n < asked) short = true;
        if (n > 0) {
          var type = awardTypes.filter(function (t) { return Number(t.id) === id; })[0] || {};
          going.push({ award_type_id: id, code: type.code || null,
                       name: type.name || null, quantity: n });
        }
      });

      if (fault) {
        setFieldError(null, "ho-lines-error", fault);
        el.hoConfirm.disabled = false;
        return;
      }
      if (!going.length) {
        setFieldError(null, "ho-lines-error",
          "Nothing is going. Reject it instead, so the requester is told why.");
        el.hoConfirm.disabled = false;
        return;
      }
      if (short && !remark) {
        setFieldError(el.hoRemark, "ho-remark-error",
          "Less than was asked for - say why, so the requester is not left counting.");
        el.hoRemark.focus();
        el.hoConfirm.disabled = false;
        return;
      }
      setFieldError(null, "ho-lines-error", "");

      hoNote();
      patch.dispatched_items = going;
      patch.status = "dispatched";
      patch.dispatched_by = me;
      patch.dispatched_at = now;
      // Clears any earlier report of non-arrival; this is a fresh sending.
      patch.issue_by = null;
      patch.issue_at = null;
      patch.issue_note = null;
      from = "acknowledged";               // never straight out of a hold

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

    /* The step goes into the log as well. "resume" is why it has to: it has
       no column of its own, so before this there was nothing anywhere to say
       a requisition had ever come back off hold. */
    patch = withLog(row, {
      acknowledge: "acknowledged", hold: "held", resume: "resumed",
      dispatch: "dispatched", receive: "received", issue: "not_received",
      reject: "rejected"
    }[action], remark, patch);

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

  /* Settings: who fulfils requisitions. The people on the list do the
     fulfilling, not the appointing. */
  function renderAdmins() {
    if (!el.adminList) return;

    if (!hasAdmins) {
      el.adminList.innerHTML =
        '<p class="aw-empty-line">Run <code>sql/award-management-setup.sql</code> ' +
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
        loadAdmins(function () { renderAdmins(); applyAccess(); renderRows(); });
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

    // Taking the last one off leaves nobody able to fulfil anything, so it
    // says so rather than removing quietly.
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
          loadAdmins(function () { renderAdmins(); applyAccess(); renderRows(); });
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

    wireTabList(el.subtabs, "data-aw-subtab");

    Array.prototype.forEach.call(
      el.hoModal.querySelectorAll("[data-aw-close-ho]"),
      function (node) { node.addEventListener("click", closeHo); }
    );
    el.hoConfirm.addEventListener("click", confirmHoAction);

    /* Utilisation is recorded from the row it belongs to. The table is
       redrawn on every change, so the click is caught on the wrapper, which
       is not. */
    var stockWrap = document.getElementById("stock-table-wrap");
    if (stockWrap) {
      stockWrap.addEventListener("click", function (event) {
        if (!event.target.closest) return;

        var btn = event.target.closest("[data-aw-row-act]");
        if (btn) {
          openStockModal({ district: btn.getAttribute("data-aw-where"),
                           month: btn.getAttribute("data-aw-month") });
          return;
        }

        if (event.target.id === "stock-edit-save")    { saveStockEdits(); return; }
        if (event.target.id === "stock-edit-discard") { discardStockEdits(); return; }

        /* A cell that takes a figure is for typing in, and it has to be
           asked about before the row it sits in: the row carries the
           breakdown, so looking for that first would mean a cell could
           never be reached. */
        var cell = event.target.closest("td.is-editable");
        if (cell) { startCellEdit(cell); return; }

        /* The button at the end, or anywhere else on a row with something
           behind it - the sheet is wide enough that the button is often off
           the side of the screen. */
        var detail = event.target.closest("[data-aw-detail]");
        if (detail) {
          openBreakdown(detail.getAttribute("data-aw-where"),
                        detail.getAttribute("data-aw-detail"));
        }
      });

      // The same cells by keyboard, since a sheet is filled in by typing.
      stockWrap.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        var cell = event.target.closest && event.target.closest("td.is-editable");
        if (!cell || cell.querySelector("input")) return;
        event.preventDefault();
        startCellEdit(cell);
      });
    }
    el.stockSave.addEventListener("click", saveStock);
    Array.prototype.forEach.call(
      el.stockModal.querySelectorAll("[data-aw-close-stock]"),
      function (n) { n.addEventListener("click", closeStockModal); }
    );
    Array.prototype.forEach.call(
      el.detailModal.querySelectorAll("[data-aw-close-detail]"),
      function (n) { n.addEventListener("click", closeBreakdown); }
    );
    // A complaint about a figure should not outlive the figure. Without
    // this the message sits there contradicting what is now on screen.
    el.stockLines.addEventListener("input", function () {
      setFieldError(null, "stock-qty-error", "");
    });
    el.hoLines.addEventListener("input", function () {
      setFieldError(null, "ho-lines-error", "");
    });
    el.awardLines.addEventListener("input", function () {
      setFieldError(null, "award-type-error", "");
    });

    el.stockFetch.addEventListener("click", function () {
      stockShown = true;
      renderStock();
    });

    // Changing a filter puts the sheet away rather than redrawing it.
    [el.stockYear, el.stockState, el.stockDivision, el.stockDistrict].forEach(function (sel) {
      sel.addEventListener("change", function () {
        if (sel === el.stockState || sel === el.stockDivision) stockFiltersFor(sel);
        stockShown = false;
        renderStock();
      });
    });

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

    /* One listener per table body rather than one per row, since the rows
       are thrown away and rebuilt on every render. Both tables draw the same
       buttons: the requisition list and Head Office's queue are two views of
       one set of rows, and an action offered in either has to work in
       either. */
    [el.tbody, el.deliveryBody].forEach(function (body) {
      if (!body) return;
      body.addEventListener("click", function (event) {
        if (!event.target.closest) return;

        var review = event.target.closest("[data-aw-review]");
        if (review) { openReview(review.getAttribute("data-aw-review")); return; }

        var ho = event.target.closest("[data-aw-ho]");
        if (ho) startHoAction(ho.getAttribute("data-aw-row"), ho.getAttribute("data-aw-ho"));
      });
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

    el.form.addEventListener("submit", onSubmit);

    el.resetBtn.addEventListener("click", function () {
      // Runs before the browser's own reset, so restore defaults after it.
      window.setTimeout(function () {
        clearFieldErrors();
        setFormStatus("");
        fillMyDistricts();
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

  /* Where the organisation works, read from the Employees directory: the
     shell builds the State -> Division -> District tree, this only reads it. */
  var geography = [];

  /* The districts this person may raise a requisition for: the ones in the
     division or divisions recorded against them in Employees. */
  function myPlaces() {
    var standing = myStanding();
    var mine = ((standing && standing.divisions) || []).map(function (d) {
      return String(d).trim().toLowerCase();
    });
    if (!mine.length) return [];

    var out = [];
    geography.forEach(function (st) {
      st.divisions.forEach(function (dv) {
        if (mine.indexOf(String(dv.name).trim().toLowerCase()) === -1) return;
        dv.districts.forEach(function (d) {
          out.push({ state: st.name, division: dv.name, district: d });
        });
      });
    });
    return out;
  }

  // The entry for a district, where it is one of theirs.
  function myPlaceOf(district) {
    var want = String(district || "").trim().toLowerCase();
    return myPlaces().filter(function (p) {
      return String(p.district).trim().toLowerCase() === want;
    })[0] || null;
  }

  function fillMyDistricts() {
    var places = myPlaces();
    var standing = myStanding();

    // Nothing to file against is nothing to submit.
    if (el.submitBtn) el.submitBtn.disabled = !places.length;

    /* The directory arrives after the page does, so opening the dialog in
       that gap must not read as having nowhere to file. */
    if (!geography.length) {
      el.district.innerHTML = '<option value="">Loading…</option>';
      el.district.disabled = true;
      el.reqWhere.hidden = true;
      return;
    }

    if (!places.length) {
      el.district.innerHTML = '<option value="">Nothing to choose</option>';
      el.district.disabled = true;
      el.reqWhere.hidden = false;
      el.reqWhere.className = "req-where is-bad";
      el.reqWhere.textContent = standing && (standing.divisions || []).length
        ? "The division recorded against you is not one the directory has " +
          "districts for, so there is nowhere to file this. Ask IT to check " +
          "your Division on the Employees tab."
        : "No Division is recorded against you on the Employees tab, so there " +
          "is nowhere to file this. Ask IT to fill it in.";
      return;
    }

    // The divisions in play, in the order they came out of the directory.
    var divisions = [];
    places.forEach(function (p) {
      if (!divisions.filter(function (d) { return d.division === p.division; }).length) {
        divisions.push({ division: p.division, state: p.state });
      }
    });

    el.reqWhere.hidden = false;
    el.reqWhere.className = "req-where";
    el.reqWhere.innerHTML = divisions.length === 1
      ? "<b>" + escapeHtml(divisions[0].division) + "</b><span>" +
        escapeHtml(divisions[0].state) + "</span>"
      : "<b>" + escapeHtml(divisions.map(function (d) { return d.division; }).join(", ")) +
        "</b><span>your divisions</span>";

    var html = '<option value="">Select district</option>';
    if (divisions.length === 1) {
      places.forEach(function (p) {
        html += '<option value="' + escapeHtml(p.district) + '">' +
                escapeHtml(p.district) + "</option>";
      });
    } else {
      divisions.forEach(function (d) {
        html += '<optgroup label="' + escapeHtml(d.division) + '">';
        places.filter(function (p) { return p.division === d.division; })
              .forEach(function (p) {
                html += '<option value="' + escapeHtml(p.district) + '">' +
                        escapeHtml(p.district) + "</option>";
              });
        html += "</optgroup>";
      });
    }
    el.district.innerHTML = html;
    el.district.disabled = false;

    // One district and nothing to decide: choose it.
    if (places.length === 1) el.district.value = places[0].district;
  }

  function loadGeography() {
    if (typeof window.olfGeography !== "function") {
      el.district.innerHTML = '<option value="">Unavailable</option>';
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
          el.district.innerHTML = '<option value="">No locations found</option>';
          showSetupBanner(
            "No employee has a State, Division and District recorded, so " +
            "there is nothing to choose from. Fill those in on the Employees " +
            "tab and reload.",
            "The directory has no locations yet."
          );
          disableForm();
          return;
        }

        fillMyDistricts();
      })
      .catch(function (err) {
        el.district.innerHTML = '<option value="">Could not load districts</option>';
        reportError("load the directory's locations", err);
      });
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
     lists: the same one twice is a mistake every time, and catching it here
     beats refusing it on submit. */
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

    /* The district is chosen; the state and division come with it. All
       three are recorded as names, not ids - the directory covers districts
       this database has never heard of - and written onto the row rather
       than looked up later, because who may approve this depends on the
       division it was for at the time. */
    var where = myPlaceOf(el.district.value) || {};

    var values = {
      state_name: where.state || "",
      division_name: where.division || "",
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
      // The moment it was filed, which the clock knows. It used to be typed,
      // which meant a requisition could be dated anything at all - and the
      // Submitted column sat beside it saying something different.
      requisition_date: todayLocalISO(),
    };

    // The first entry in the log; every step after this appends to it.
    if (hasLog) {
      values.log = [{
        at: new Date().toISOString(), what: "raised",
        by: (signedInUser() || {}).name || myEmail() || "",
        email: myEmail() || null, note: null
      }];
    }

    var ok = true;

    if (!values.district_name) {
      setFieldError(el.district, "district-error", "Select a district."); ok = false;
    } else if (!values.state_name || !values.division_name) {
      /* The district is no longer one of theirs - the directory changed
         under the form, or their own posting did. Better to stop than to
         file a requisition against a division nobody can approve. */
      setFieldError(el.district, "district-error",
        "That district is no longer one of yours. Choose again.");
      ok = false;
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
              "sql/award-management-setup.sql in the " +
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

  /* Asking for a column that is not there fails the whole query, so each
     migration's columns are tried once and switched off if the database says
     no. Narrower tests come first: the fulfilment pattern would otherwise
     swallow dispatched_items. */
  var hasNameColumns  = true;

  function loadRequisitions() {
    el.refreshBtn.disabled = true;

    db.from("requisitions")
      .select("id, requester_name, quantity, requisition_date, status, created_at," +
              (hasNameColumns  ? " state_name, division_name, district_name," : "") +
              (hasItems ? " items," : "") +
              (hasFulfilment ? " acknowledged_by, acknowledged_at, dispatched_by," +
                               " dispatched_at, received_by, received_at, receipt_note," +
                               " rejected_by, rejected_at, ho_remark," +
                               " held_by, held_at, issue_by, issue_at, issue_note," : "") +
              // What Head Office actually sent, which the stock sheet reads.
              (hasSent ? " dispatched_items," : "") +
              (hasLog ? " log," : "") +
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
          if (hasLog && /\blog\b/i.test(msg)) {
            hasLog = false;                   // the log migration is not run
            loadRequisitions();
            return;
          }
          if (hasSent && /dispatched_items/i.test(msg)) {
            hasSent = false;                  // the stock migration is not run
            loadRequisitions();
            return;
          }
          if (hasFulfilment &&
              /(acknowledged_|dispatched_|received_|receipt_note|rejected_)/i.test(msg) ||
              /(ho_remark|held_|issue_)/i.test(msg)) {
            hasFulfilment = false;            // fulfilment not migrated yet
            loadRequisitions();
            return;
          }
          if (hasItems && /items/i.test(msg)) {
            hasItems = false;                 // multiple awards not migrated yet
            loadRequisitions();
            return;
          }
          if (hasApproval &&
              /(requester_role|requester_level|decided_|decision_remark)/i.test(msg)) {
            hasApproval = false;      // the approvals migration is not run yet
            showSetupBanner(
              "Approvals need one more migration - run " +
              "<code>sql/award-management-setup.sql</code> in the Supabase " +
              "SQL Editor. Until then every requisition shows as pending.",
              "Approvals are not set up yet."
            );
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
        // Their own tables, and renderTable returns early when the list is
        // empty - which is exactly when they need their empty states.
        renderDelivery();
        refreshStockControls();
        renderStock();
      })
      .catch(function (err) {
        el.refreshBtn.disabled = false;
        placeholderRow("Could not load requisitions: " + messageOf(err));
        reportError("load requisitions", err);
      });
  }

  // Where a row says it is for, as the names it was filed with.
  function placeOf(row) {
    return {
      state:    row.state_name    || "",
      division: row.division_name || "",
      district: row.district_name || ""
    };
  }

  /* The filters offer what the loaded rows contain, not everything the
     directory knows, so nothing on offer can return nothing. Each narrows the
     next; award type is left alone, since it has nothing to do with place. */
  function buildFilterOptions() {
    var stateFilter    = el.filterState.value;
    var divisionFilter = el.filterDivision.value;

    var states = {}, divisions = {}, districts = {}, types = {};

    allRequisitions.forEach(function (row) {
      var p = placeOf(row);
      if (p.state) states[p.state] = true;
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

  // Both views of the same rows: the list, and Head Office's queue.
  function renderRows() {
    renderTable();
    renderDelivery();
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
      if (typeFilter && awardsOf(row).every(function (a) {
        return a.name !== typeFilter;
      })) return false;
      if (search && String(row.requester_name || "").toLowerCase()
                      .indexOf(search) === -1) return false;
      // Filtered on the stage itself. Going through statusOf collapsed
      // every stage after approval into "approved", so choosing Dispatched
      // or Received could not tell them apart.
      if (statusFilter && stageOf(row) !== statusFilter) return false;
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
          '<td><span class="state-code">' + escapeHtml(stateName) + "</span></td>" +
          "<td>" + escapeHtml(p.division || "—") + "</td>" +
          "<td>" + escapeHtml(p.district || "—") + "</td>" +
          "<td>" + escapeHtml(row.requester_name) + "</td>" +
          '<td class="cell-awards">' + awardsCellHtml(awards, row) + "</td>" +
          '<td class="num">' + escapeHtml(row.quantity) + "</td>" +
          '<td class="cell-date muted">' + escapeHtml(formatTimestamp(row.created_at)) + "</td>" +
          "<td>" + statusCellHtml(row) + "</td>" +
          '<td class="cell-log-col">' + logCellHtml(row) + "</td>" +
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
        return { id: Number(it.award_type_id) || 0,
                 name: it.name || it.code || "Award",
                 quantity: Number(it.quantity) || 0 };
      });
    }
    if (row && row.award_types) {
      return [{ id: Number(row.award_type_id) || 0,
                name: row.award_types.name,
                quantity: Number(row.quantity) || 0 }];
    }
    return [];
  }

  /* What a requisition asked for, and - once it has been sent - what
     actually went, where the two differ. "15 of 16" says it on the award
     itself; a badge reading "part-filled" beside it named the situation
     without giving the figures. */
  function awardsCellHtml(awards, row) {
    if (!awards.length) return "—";

    var sent = row && row.dispatched_items && row.dispatched_items.length
      ? quantitiesOf(row, "dispatched")
      : null;

    return awards.map(function (a) {
      var went = sent ? (sent[a.id] || 0) : a.quantity;
      var short = sent && went < a.quantity;
      return '<span class="type-chip' + (short ? " is-short" : "") + '"' +
             (short ? ' title="' + escapeHtml(a.quantity - went) +
                      ' fewer than asked for"' : "") + ">" +
             escapeHtml(a.name) + "<b>" +
             (short
               ? escapeHtml(went.toLocaleString()) + " of " +
                 escapeHtml(a.quantity.toLocaleString())
               : escapeHtml(a.quantity.toLocaleString())) +
             "</b></span>";
    }).join(" ");
  }

  // Where a requisition stands and who it is sitting with. The steps that
  // got it there are a column of their own.
  function statusCellHtml(row, forHo) {
    var stage = STAGES[stageOf(row)];
    var waiting = waitingOn(row);

    return '<span class="chip-status is-' + escapeHtml(stage.tone) + '">' +
             escapeHtml(stageLabel(row, forHo)) + "</span>" +
           (waiting ? '<span class="cell-waiting">With ' + escapeHtml(waiting) +
                      "</span>" : "");
  }

  /* The journey: every step, who took it, when, and anything they said.
     Coloured by what the step was. */
  function logCellHtml(row) {
    var steps = trailOf(row);
    if (!steps.length) return '<span class="log-none">\u2014</span>';

    var html = '<ol class="cell-log">' + steps.map(function (st) {
      return '<li class="log-step is-' + escapeHtml(st.tone) + '"' +
               (st.email ? ' title="' + escapeHtml(st.email) + '"' : "") + ">" +
               '<span class="log-what">' + escapeHtml(st.what) + "</span>" +
               (st.who ? '<span class="log-who">' + escapeHtml(st.who) + "</span>" : "") +
               (st.when ? '<span class="log-when">' +
                          escapeHtml(formatTimestamp(st.when)) + "</span>" : "") +
               (st.note ? '<span class="log-note">\u201c' + escapeHtml(st.note) +
                          "\u201d</span>" : "") +
             "</li>";
    }).join("") + "</ol>";

    // A remark held only in a column, on a row whose log has no notes.
    var noted = steps.some(function (st) { return !!st.note; });
    var remark = row.issue_note || row.receipt_note || row.ho_remark ||
                 row.decision_remark || "";
    if (remark && !noted) {
      html += '<span class="log-note is-loose">\u201c' + escapeHtml(remark) +
              "\u201d</span>";
    }
    return html;
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

    /* Everything that has reached Head Office, ordered by what they have to
       do next: waiting to be picked up, ready to send, blocked, sent and
       waiting on somebody else, then finished. A dispatched requisition
       stays rather than vanishing - Head Office needs to see it turn into
       Delivered. */
    var ORDER = { approved: 0, acknowledged: 1, on_hold: 2, dispatched: 3,
                  received: 4, rejected: 5 };
    var rows = allRequisitions.filter(function (r) {
      return ORDER[stageOf(r)] !== undefined;
    }).sort(function (a, b) {
      var d = ORDER[stageOf(a)] - ORDER[stageOf(b)];
      return d !== 0 ? d : String(b.created_at).localeCompare(String(a.created_at));
    });

    if (!rows.length) {
      el.deliveryBody.innerHTML =
        '<tr class="placeholder-row"><td colspan="' +
        (document.querySelectorAll("#delivery-table thead th").length || 9) + '">' +
        (hasAdmins
          ? "Nothing yet. Requisitions appear here once they are approved."
          : "Run sql/award-management-setup.sql to set this up.") +
        "</td></tr>";
      return;
    }

    el.deliveryBody.innerHTML = rows.map(function (row) {
      var p = placeOf(row);
      var awards = awardsOf(row);
      return "<tr>" +
        '<td><span class="state-code">' + escapeHtml(p.state || "—") +
          "</span></td>" +
        "<td>" + escapeHtml(p.division || "—") + "</td>" +
        "<td>" + escapeHtml(p.district || "—") + "</td>" +
        "<td>" + escapeHtml(row.requester_name || "—") + "</td>" +
        '<td class="cell-awards">' + awardsCellHtml(awards, row) + "</td>" +
        '<td class="num">' + escapeHtml(Number(row.quantity).toLocaleString()) + "</td>" +
        "<td>" + statusCellHtml(row, true) + "</td>" +
        '<td class="cell-log-col">' + logCellHtml(row) + "</td>" +
        '<td class="cell-action">' + actionCellHtml(row) + "</td>" +
      "</tr>";
    }).join("");
  }

  /* ==================================================================
     Stock

       balance = delivered - utilised +/- corrections

     carried month to month, per district, per award type. Nothing stores the
     balance; it is added up from what happened each time it is shown. A
     district gains stock when it confirms the award arrived - not when it was
     asked for, and not when Head Office sent it.
     ================================================================== */

  // The year runs April to March, so anything before April belongs to the
  // year that started the previous April.
  function fyStartOf(date) {
    var d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return null;
    return d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
  }

  function fyLabel(fyStart) {
    return fyStart + "-" + String((fyStart + 1) % 100).padStart(2, "0");
  }

  function monthKeyOf(value) {
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return "";
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  var MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                     "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function monthLabelOf(key) {
    var parts = String(key).split("-");
    var m = Number(parts[1]);
    if (!m) return key;
    return MONTH_NAMES[m - 1] + "'" + String(Number(parts[0]) % 100).padStart(2, "0");
  }

  // April through March, in order.
  function fyMonthKeys(fyStart) {
    var keys = [];
    for (var i = 0; i < 12; i++) {
      var m = 4 + i;
      var year = fyStart + (m > 12 ? 1 : 0);
      var month = m > 12 ? m - 12 : m;
      keys.push(year + "-" + String(month).padStart(2, "0"));
    }
    return keys;
  }

  function fyStartsBefore(key, fyStart) {
    return key !== "" && key < (fyStart + "-04");
  }

  /* The awards on a requisition as a map of type to quantity: what was
     dispatched where that was recorded, what was asked for where it was
     not. */
  function quantitiesOf(row, which) {
    var list = (which === "dispatched" && row.dispatched_items && row.dispatched_items.length)
      ? row.dispatched_items
      : row.items;

    var out = {};
    if (list && list.length) {
      list.forEach(function (it) {
        var id = Number(it.award_type_id);
        if (id) out[id] = (out[id] || 0) + (Number(it.quantity) || 0);
      });
    } else if (row.award_type_id) {
      out[Number(row.award_type_id)] = Number(row.quantity) || 0;
    }
    return out;
  }

  function addInto(target, source) {
    Object.keys(source).forEach(function (id) {
      target[id] = (target[id] || 0) + source[id];
    });
  }

  /* Every movement of stock, flattened to one shape so the running total
     does not have to care where each came from. */
  /* Which column a movement is reported in, and which way it moves the
     balance. A requisition is reported and nothing else: asking for an award
     does not put one in the cupboard. */
  var MOVEMENT_KINDS = {
    requisition: { column: "requisition", sign: 0 },
    delivery:    { column: "delivery",    sign: 1 },
    utilised:    { column: "utilisation", sign: -1 },
    opening:     { column: "other",       sign: 1 },
    adjustment:  { column: "other",       sign: 1 }
  };

  function stockEvents(requisitions, movements) {
    var events = [];

    (requisitions || []).forEach(function (row) {
      var district = String(row.district_name || "").trim();
      if (!district) return;

      // what was asked for, which does not move stock but is reported
      var raised = monthKeyOf(row.created_at);
      if (raised) {
        events.push({ district: district, month: raised, column: "requisition",
                      quantities: quantitiesOf(row, "items") });
      }

      // what arrived, which does
      if (stageOf(row) === "received" && row.received_at) {
        // No note: what was said about the parcel belongs on the
        // requisition. The sheet's Remark column is for the stock itself.
        events.push({ district: district, month: monthKeyOf(row.received_at),
                      column: "delivery", sign: 1,
                      quantities: quantitiesOf(row, "dispatched") });
      }
    });

    (movements || []).forEach(function (m) {
      var district = String(m.district_name || "").trim();
      if (!district) return;
      var q = {};
      q[Number(m.award_type_id)] = Number(m.quantity) || 0;
      var kind = MOVEMENT_KINDS[m.kind] || MOVEMENT_KINDS.adjustment;

      events.push({
        district: district,
        month: monthKeyOf(m.occurred_on),
        column: kind.column,
        sign: kind.sign,
        quantities: q,
        note: m.note || ""
      });
    });

    return events;
  }

  /* One block of rows per district: what it was holding when the year
     started, then every month of that year whether or not anything moved -
     a month with no activity still has to show the stock sitting there. */
  function stockRows(fyStart, requisitions, movements, places) {
    var events = stockEvents(requisitions, movements);
    var months = fyMonthKeys(fyStart);
    var rows = [];

    places.forEach(function (place) {
      var mine = events.filter(function (e) { return e.district === place.district; });

      // Everything before April is one number: the carry forward.
      var balance = {};
      mine.forEach(function (e) {
        if (e.sign && fyStartsBefore(e.month, fyStart)) {
          var signed = {};
          Object.keys(e.quantities).forEach(function (id) {
            signed[id] = e.quantities[id] * e.sign;
          });
          addInto(balance, signed);
        }
      });

      rows.push(Object.assign({}, place, {
        month: "Carry forward", monthKey: "", remark: "",
        requisition: {}, delivery: {}, utilisation: {},
        balance: Object.assign({}, balance)
      }));

      months.forEach(function (key) {
        var cell = { requisition: {}, delivery: {}, utilisation: {}, other: {} };
        var notes = [];
        mine.forEach(function (e) {
          if (e.month !== key) return;
          addInto(cell[e.column], e.quantities);
          if (e.note && notes.indexOf(e.note) === -1) notes.push(e.note);
        });

        addInto(balance, cell.delivery);
        addInto(balance, cell.other);
        Object.keys(cell.utilisation).forEach(function (id) {
          balance[id] = (balance[id] || 0) - cell.utilisation[id];
        });

        rows.push(Object.assign({}, place, {
          month: monthLabelOf(key), monthKey: key,
          requisition: cell.requisition,
          delivery: cell.delivery,
          utilisation: cell.utilisation,
          balance: Object.assign({}, balance),
          remark: notes.join(" · ")
        }));
      });
    });

    return rows;
  }

  // Every district the directory knows, with the manager of its division.
  function stockPlaces() {
    var out = [];
    var seen = {};

    geography.forEach(function (st) {
      st.divisions.forEach(function (dv) {
        dv.districts.forEach(function (d) {
          seen[d.toLowerCase()] = true;
          out.push({ state: st.name, division: dv.name, district: d, pm: dv.pm || "" });
        });
      });
    });

    /* The directory is the only source of districts here, as it is for the
       requisition form, so the two can never disagree. A district nobody is
       posted to is not in it. */
    return out;
  }

  var stockMovements = [];
  var hasStock = true;             // false until the stock migration is run

  function loadStock(done) {
    if (!hasStock) { stockMovements = []; return done && done(); }

    db.from("award_stock_movements")
      .select("id, kind, state_name, division_name, district_name, award_type_id," +
              " quantity, occurred_on, note, recorded_by")
      .order("occurred_on")
      .then(function (res) {
        if (res.error) {
          if (/award_stock_movements/i.test(res.error.message || "")) hasStock = false;
          else reportError("load stock", res.error);
          stockMovements = [];
          return done && done();
        }
        stockMovements = res.data || [];
        done && done();
      })
      .catch(function (err) {
        reportError("load stock", err);
        stockMovements = [];
        done && done();
      });
  }

  // ------------------------------------------------------------ the sheet

  function stockYears() {
    var years = {};
    var now = fyStartOf(new Date());
    years[now] = true;

    allRequisitions.forEach(function (r) {
      var y = fyStartOf(r.created_at); if (y) years[y] = true;
    });
    stockMovements.forEach(function (m) {
      // Dated the March before the year they open, so they would offer a
      // year holding nothing but a carried figure.
      if (m.kind === "opening") return;
      var y = fyStartOf(m.occurred_on); if (y) years[y] = true;
    });
    return Object.keys(years).map(Number).sort(function (a, b) { return b - a; });
  }

  /* One group of cells, carrying its group so the sheet can be read by
     colour. Nothing is greyed; a negative figure is red - it should never
     happen, and should be seen first if it does.

     An administrator types into the three groups that are recorded; the
     balance is worked out and the totals add up, so neither takes a figure.
     The cell says which district, month, column and award it stands for, so
     the editor does not have to be told. */
  function cellsHtml(map, types, kind, r, editable) {
    var html = "";
    var cell = function (n, extra, edit) {
      var pending = edit && hasPendingEdit(r.district, r.monthKey, kind, edit);
      return '<td class="num col-' + kind + (n ? "" : " is-nil") +
             (n < 0 ? " is-neg" : "") + (edit ? " is-editable" : "") +
             (pending ? " is-pending" : "") + extra + '"' +
             (edit ? ' data-edit="' + kind + '" data-type="' + escapeHtml(edit) +
                     '" data-month="' + escapeHtml(r.monthKey) +
                     '" data-where="' + escapeHtml(r.district) + '" tabindex="0"' : "") +
             ">" + (n ? escapeHtml(n.toLocaleString()) : "\u2013") + "</td>";
    };
    types.forEach(function (t) {
      html += cell(map[t.id] || 0, "", editable ? String(t.id) : null);
    });
    return html + cell(sumOf(map), " is-total", null);
  }

  /* The filters narrow each other, the same way the requisition form does:
     a division that is not in the chosen state is not an option. */
  function stockFiltersFor(changed) {
    var places = stockPlaces();
    if (changed === el.stockState) {
      el.stockDivision.value = ""; el.stockDistrict.value = "";
    } else if (changed === el.stockDivision) {
      el.stockDistrict.value = "";
    }

    var inState = places.filter(function (p) {
      return !el.stockState.value || p.state === el.stockState.value;
    });
    var divs = [], dists = [];
    inState.forEach(function (p) {
      if (divs.indexOf(p.division) === -1) divs.push(p.division);
      if ((!el.stockDivision.value || p.division === el.stockDivision.value) &&
          dists.indexOf(p.district) === -1) dists.push(p.district);
    });

    fillSelect(el.stockDivision, divs.sort(), "All divisions",
      function (n) { return n; }, function (n) { return n; });
    fillSelect(el.stockDistrict, dists.sort(), "All districts",
      function (n) { return n; }, function (n) { return n; });
  }

  function refreshStockControls() {
    if (!el.stockYear) return;

    var years = stockYears();
    var current = el.stockYear.value;
    el.stockYear.innerHTML = years.map(function (y) {
      return '<option value="' + y + '">' + escapeHtml(fyLabel(y)) + '</option>';
    }).join("");
    if (current && years.indexOf(Number(current)) !== -1) el.stockYear.value = current;

    var states = [];
    stockPlaces().forEach(function (p) {
      if (states.indexOf(p.state) === -1) states.push(p.state);
    });
    fillSelect(el.stockState, states.sort(), "All states",
      function (n) { return n; }, function (n) { return n; });
    stockFiltersFor(null);

  }

  /* Whether the sheet has been asked for. The tab opens on its filters and
     the figures come when Fetch is pressed - thirty-five districts over
     twelve months is four hundred rows. */
  var stockShown = false;

  function renderStock() {
    var wrap = document.getElementById("stock-table-wrap");
    if (!wrap) return;

    if (!stockShown) {
      wrap.innerHTML =
        '<div class="stock-prompt">' +
          "<p><b>Choose a year, and narrow it if you want to.</b></p>" +
          "<p>Then press Fetch. Leaving the places on " +
          "<i>All</i> shows the districts something has happened in; " +
          "choosing a state, a division or a district shows every district " +
          "in it, whether or not anything has.</p>" +
        "</div>";
      return;
    }

    if (!hasStock) {
      wrap.innerHTML = '<p class="aw-empty-line">Run ' +
        "<code>sql/award-stock-setup.sql</code> in the Supabase SQL Editor to " +
        "set this up.</p>";
      return;
    }
    if (!geography.length) {
      wrap.innerHTML = '<p class="aw-empty-line">Waiting for the staff directory.</p>';
      return;
    }

    var fy = Number(el.stockYear.value) || fyStartOf(new Date());
    var places = stockPlaces().filter(function (p) {
      return (!el.stockState.value    || p.state === el.stockState.value) &&
             (!el.stockDivision.value || p.division === el.stockDivision.value) &&
             (!el.stockDistrict.value || p.district === el.stockDistrict.value);
    });

    if (!places.length) {
      wrap.innerHTML = '<p class="aw-empty-line">No districts match.</p>';
      return;
    }

    var types = awardTypes;
    // Drawn with the unsaved edits in it, so every balance below one of them
    // follows along as it is typed.
    var rows = stockRows(fy, allRequisitions,
                         stockMovements.concat(pendingMovements(fy)), places);

    /* Asking for a place shows it whether or not anything has happened
       there - that is how an empty district is given its first figures.
       Asking for nothing in particular shows only the districts with
       something in them, stock sitting there included. */
    var narrowed = !!(el.stockState.value || el.stockDivision.value ||
                      el.stockDistrict.value);
    if (!narrowed) {
      var busy = {};
      rows.forEach(function (r) {
        if (sumOf(r.requisition) || sumOf(r.delivery) ||
            sumOf(r.utilisation) || sumOf(r.balance)) {
          busy[r.district] = true;
        }
      });
      rows = rows.filter(function (r) { return busy[r.district]; });
    }

    if (!rows.length) {
      wrap.innerHTML =
        '<div class="stock-prompt">' +
          "<p><b>Nothing has moved yet.</b></p>" +
          "<p>A district appears here once a requisition is raised for it, " +
          "or once it is given an opening figure. To see a district that is " +
          "still empty - to set its opening stock, say - choose it above and " +
          "press Fetch again.</p>" +
        "</div>";
      return;
    }

    var GROUPS = [
      { kind: "req", label: "Requisition" },
      { kind: "del", label: "Delivery" },
      { kind: "use", label: "Utilisation" },
      { kind: "bal", label: "Stock Balance" }
    ];

    var head =
      "<thead><tr>" +
        '<th rowspan="2" class="col-month">Month</th>' +
        '<th rowspan="2" class="col-district">District</th>' +
        '<th rowspan="2">State</th><th rowspan="2">PM</th>' +
        GROUPS.map(function (g) {
          return '<th colspan="' + (types.length + 1) + '" class="grp col-' + g.kind +
                 '">' + escapeHtml(g.label) + "</th>";
        }).join("") +
        '<th rowspan="2">Remark</th>' +
        '<th rowspan="2" class="col-act"><span class="sr-only">Record</span></th>' +
      "</tr><tr>" +
        GROUPS.map(function (g) {
          return types.map(function (t) {
            return '<th class="num col-' + g.kind + '">' + escapeHtml(shortType(t)) +
                   "</th>";
          }).join("") + '<th class="num col-' + g.kind + ' is-total">Total</th>';
        }).join("") +
      "</tr></thead>";

    var body = rows.map(function (r) {
      var carry = r.monthKey === "";
      var happened = monthHasHappened(r.monthKey, fy);
      // Nothing held is nothing to give out.
      var mayUse = !carry && happened && canUseHere(r.district) &&
                   sumOf(r.balance) > 0;
      /* An administrator types the three recorded groups straight into the
         sheet. The carry forward has none of them - it is one opening
         figure - so there the balance itself is what gets typed. */
      var mayEdit = happened && canSetStock();
      var tellable = hasAnything(r);
      return '<tr class="' + (carry ? "is-carry" : "") +
             (tellable ? " is-tellable" : "") + '"' +
             (tellable ? ' data-aw-detail="' + escapeHtml(r.monthKey) +
                         '" data-aw-where="' + escapeHtml(r.district) + '"' : "") +
             ">" +
        '<td class="col-month">' + escapeHtml(r.month) + "</td>" +
        '<td class="col-district is-district">' + escapeHtml(r.district) + "</td>" +
        "<td>" + escapeHtml(r.state) + "</td>" +
        '<td class="col-pm" title="' + escapeHtml(r.pm || "") + '">' +
          escapeHtml(r.pm || "\u2014") + "</td>" +
        cellsHtml(r.requisition, types, "req", r, mayEdit && !carry) +
        cellsHtml(r.delivery, types, "del", r, mayEdit && !carry) +
        cellsHtml(r.utilisation, types, "use", r, mayEdit && !carry) +
        cellsHtml(r.balance, types, "bal", r, mayEdit && carry) +
        '<td class="cell-remark-col" title="' + escapeHtml(r.remark || "") + '">' +
          escapeHtml(r.remark || "") + "</td>" +
        '<td class="col-act">' +
          (tellable
            ? '<button type="button" class="btn btn-ghost btn-xs" ' +
              'data-aw-detail="' + escapeHtml(r.monthKey) + '" data-aw-where="' +
              escapeHtml(r.district) + '">Breakdown</button>'
            : "") +
          (mayUse ? rowActionHtml("utilised", "Record use", r) : "") +
        "</td>" +
      "</tr>";
    }).join("");

    var waiting = countPendingEdits();
    wrap.innerHTML =
      (canSetStock()
        ? '<p class="stock-howto">Click a cell with a line under it to type a ' +
          "figure — <b>Requisition</b>, <b>Delivery</b> and <b>Utilisation</b> " +
          "on any month that has happened, and the opening <b>Balance</b> on the " +
          "carry-forward row. The rest is added up.</p>"
        : "") +
      '<div class="stock-editbar" id="stock-editbar"' + (waiting ? "" : " hidden") + ">" +
        "<span>" + (waiting === 1 ? "One figure changed"
                                  : waiting + " figures changed") +
        ", not saved yet.</span>" +
        '<button type="button" class="btn btn-ghost btn-sm" id="stock-edit-discard">' +
          "Discard</button>" +
        '<button type="button" class="btn btn-primary btn-sm" id="stock-edit-save">' +
          "Save changes</button>" +
      "</div>" +
      '<p class="error" id="stock-edit-error" hidden role="alert"></p>' +
      '<table id="stock-table">' + head + "<tbody>" + body + "</tbody></table>";
  }

  // A row with nothing in any of its own columns has nothing to break down;
  // its balance is only what carried in from an earlier month.
  function hasAnything(r) {
    return !!(sumOf(r.requisition) || sumOf(r.delivery) || sumOf(r.utilisation) ||
              (r.monthKey === "" && sumOf(r.balance)));
  }

  function rowActionHtml(kind, label, r) {
    return '<button type="button" class="btn btn-ghost btn-xs" data-aw-row-act="' +
           escapeHtml(kind) + '" data-aw-where="' + escapeHtml(r.district) +
           '" data-aw-month="' + escapeHtml(r.monthKey) + '">' +
           escapeHtml(label) + "</button>";
  }

  /* Block, District, NS, SU - the names the sheet uses, which are the award
     names with the part they all share taken off. */
  function shortType(t) {
    var code = String(t.code || "").toUpperCase();
    if (code === "POM_BLOCK") return "Block";
    if (code === "POM_DISTRICT") return "District";
    return code || t.name;
  }

  /* Setting a district's figures by hand is an administrator's job: it is
     how the first year's numbers get in, and how a miscount is put right. It
     writes a correction, so the balance is still added up from what moved. */
  function canSetStock() { return isAppAdmin(); }

  /* Which districts somebody may record against: their own division, or
     anywhere for the COO, Head Office and administrators. */
  function placesIMayRecord() {
    var all = stockPlaces();
    var standing = myStanding();
    if (isHoAdmin() || isAppAdmin() || (standing && standing.level >= 4)) return all;
    if (!standing) return [];

    var mine = (standing.divisions || []).map(function (d) {
      return String(d).trim().toLowerCase();
    });
    return all.filter(function (p) {
      return mine.indexOf(String(p.division).trim().toLowerCase()) !== -1;
    });
  }

  /* A month that has not arrived cannot have had anything given out in it,
     and there is nothing to count in it either - the figures shown for it
     are what the district will be holding if nothing else happens. The
     carry forward is the March before the year, so it is settled as soon as
     the year has started. */
  function monthHasHappened(monthKey, fy) {
    return monthKey ? monthKey <= monthKeyOf(new Date())
                    : fy <= fyStartOf(new Date());
  }

  /* ------------------------------------------------------------ editing

     An administrator types figures straight into the sheet. Nothing is
     written as it is typed: the edits are held here, the sheet is added up
     with them included so every balance below follows along, and one Save
     writes them all.

     What is held is the figure the cell should read, not the difference.
     The difference is worked out against what is recorded at the moment of
     saving, so an edit made while somebody else was recording a utilisation
     does not quietly undo theirs. */
  var pendingEdits = {};

  var EDIT_COLUMNS = {
    req: { column: "requisition", kind: "requisition" },
    del: { column: "delivery",    kind: "delivery" },
    use: { column: "utilisation", kind: "utilised" },
    bal: { column: "balance",     kind: "adjustment" }
  };

  function editKey(district, monthKey, col, typeId) {
    return [district, monthKey, col, typeId].join("\u0000");
  }

  function hasPendingEdit(district, monthKey, col, typeId) {
    return Object.prototype.hasOwnProperty.call(
      pendingEdits, editKey(district, monthKey, col, typeId));
  }

  function countPendingEdits() { return Object.keys(pendingEdits).length; }

  /* What the sheet reads for one cell as it stands in the database, which is
     what an edit is measured against. */
  function recordedFigure(district, fy, monthKey, col, typeId) {
    var rows = stockRows(fy, allRequisitions, stockMovements,
                         [{ state: "", division: "", district: district, pm: "" }]);
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].monthKey === monthKey) {
        return (rows[i][EDIT_COLUMNS[col].column] || {})[typeId] || 0;
      }
    }
    return 0;
  }

  /* The edits as movements, so the sheet can be drawn with them in it before
     any of them is saved. */
  function pendingMovements(fy) {
    return Object.keys(pendingEdits).map(function (key) {
      var parts = key.split("\u0000");
      var district = parts[0], monthKey = parts[1], col = parts[2], typeId = parts[3];
      var want = pendingEdits[key];
      var have = recordedFigure(district, fy, monthKey, col, typeId);
      if (want === have) return null;

      return {
        kind: EDIT_COLUMNS[col].kind,
        state_name: null, division_name: null, district_name: district,
        award_type_id: Number(typeId),
        quantity: want - have,
        occurred_on: (monthKey || (fy + "-03")) + "-01",
        note: null
      };
    }).filter(Boolean);
  }

  function startCellEdit(cell) {
    if (cell.querySelector("input")) return;

    var was = cell.textContent.trim();
    var shown = was === "\u2013" ? "" : was.replace(/,/g, "");
    cell.classList.add("is-editing");
    cell.innerHTML = '<input type="number" class="cell-input mono" step="1" ' +
                     'min="0" max="1000000" value="' + escapeHtml(shown) + '" />';

    var input = cell.querySelector("input");
    input.focus();
    input.select();

    var done = function (commit) {
      if (!cell.classList.contains("is-editing")) return;
      cell.classList.remove("is-editing");
      if (commit) commitCellEdit(cell, input.value);
      else renderStock();
    };

    input.addEventListener("blur", function () { done(true); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter")      { e.preventDefault(); done(true); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(false); }
      else if (e.key === "Tab")    { done(true); }   // the browser moves on
    });
  }

  function commitCellEdit(cell, raw) {
    var district = cell.getAttribute("data-where");
    var monthKey = cell.getAttribute("data-month");
    var col      = cell.getAttribute("data-edit");
    var typeId   = cell.getAttribute("data-type");
    var fy = Number(el.stockYear.value) || fyStartOf(new Date());

    var text = String(raw || "").trim();
    var n = text === "" ? 0 : Number(text);
    if (!Number.isInteger(n) || n < 0) {
      // Drawn first: the sheet is rebuilt whole, error line included.
      renderStock();
      showStockEditError("Figures are whole numbers, nothing or more.");
      return;
    }

    var key = editKey(district, monthKey, col, typeId);
    if (n === recordedFigure(district, fy, monthKey, col, typeId)) delete pendingEdits[key];
    else pendingEdits[key] = n;

    showStockEditError("");
    renderStock();
  }

  function discardStockEdits() {
    pendingEdits = {};
    showStockEditError("");
    renderStock();
  }

  function showStockEditError(message) {
    var bar = document.getElementById("stock-edit-error");
    if (!bar) return;
    bar.textContent = message || "";
    bar.hidden = !message;
  }

  /* One insert for the lot. The differences are worked out here rather than
     when each cell was typed, so they are measured against what the database
     holds now. */
  function saveStockEdits() {
    var fy = Number(el.stockYear.value) || fyStartOf(new Date());
    var moves = pendingMovements(fy);
    if (!moves.length) { discardStockEdits(); return; }

    var districts = {};
    moves.forEach(function (m) { districts[m.district_name] = true; });

    var trouble = null;
    Object.keys(districts).some(function (district) {
      var mine = moves.filter(function (m) { return m.district_name === district; });
      var earliest = mine.map(function (m) { return m.occurred_on; }).sort()[0];
      var from = earliest.slice(0, 7) === fy + "-03" ? "" : earliest.slice(0, 7);
      var bad = wouldGoNegative(district, fy, from, mine);
      if (bad) { trouble = { district: district, bad: bad }; return true; }
      return false;
    });

    if (trouble) {
      var short = awardTypes.filter(function (a) {
        return Number(a.id) === trouble.bad.award_type_id;
      })[0] || {};
      showStockEditError(
        "That would leave " + trouble.district + " holding " + trouble.bad.short +
        " fewer " + (short.name || "of that award") + " than nothing by " +
        trouble.bad.month + ".");
      return;
    }

    var places = stockPlaces();
    var rows = moves.map(function (m) {
      var place = places.filter(function (p) {
        return p.district === m.district_name;
      })[0] || {};
      /* No note. The Remark column is for what somebody wrote about the
         stock, and a typed figure writes a movement for the difference -
         noting each one turned the column into a changelog, where typing 88
         and taking it off again left "+88 · -88" against a month in which
         nothing had happened. Who typed it and when is on the movement
         itself. */
      return {
        kind: m.kind,
        state_name: place.state || "",
        division_name: place.division || null,
        district_name: m.district_name,
        award_type_id: m.award_type_id,
        quantity: m.quantity,
        occurred_on: m.occurred_on,
        note: null,
        recorded_by: (signedInUser() || {}).name || myEmail(),
        recorded_email: myEmail() || null
      };
    });

    var bar = document.getElementById("stock-edit-save");
    if (bar) bar.disabled = true;

    db.from("award_stock_movements").insert(rows).select("id")
      .then(function (res) {
        if (bar) bar.disabled = false;
        if (res.error) {
          var msg = res.error.message || "";
          showStockEditError(/kind_check|quantity_sane/i.test(msg)
            ? "Figures typed by hand need sql/award-stock-manual.sql run in " +
              "the Supabase SQL editor first."
            : "Could not save: " + msg);
          reportError("save stock edits", res.error);
          return;
        }
        pendingEdits = {};
        loadStock(function () {
          stockShown = true;
          renderStock();
          showListBanner(rows.length === 1 ? "One figure saved."
                                           : rows.length + " figures saved.");
        });
      })
      .catch(function (err) {
        if (bar) bar.disabled = false;
        showStockEditError("Could not save: " + messageOf(err));
      });
  }

  /* ---------------------------------------------------------- breakdown

     A month's figure is often several things added together - two
     requisitions raised in the same month show as one number, and there is
     no way to tell from the sheet which. This lists what went into it:
     every requisition, arrival, utilisation and typed figure behind the row,
     in the order it happened. */
  function monthBreakdown(district, monthKey, fy) {
    var want = String(district || "").trim().toLowerCase();
    var mine = function (row) {
      return String(row.district_name || "").trim().toLowerCase() === want;
    };
    var inMonth = function (key) {
      return monthKey ? key === monthKey : fyStartsBefore(key, fy);
    };

    var entries = [];

    allRequisitions.filter(mine).forEach(function (row) {
      if (inMonth(monthKeyOf(row.created_at))) {
        entries.push({
          at: row.created_at, column: "requisition",
          what: "Raised", who: row.requester_name || "",
          quantities: quantitiesOf(row, "items"),
          note: stageLabel(row, false)
        });
      }
      if (stageOf(row) === "received" && inMonth(monthKeyOf(row.received_at))) {
        entries.push({
          at: row.received_at, column: "delivery",
          what: "Arrived", who: row.received_by || row.requester_name || "",
          quantities: quantitiesOf(row, "dispatched"),
          note: row.receipt_note || ""
        });
      }
    });

    stockMovements.filter(mine).forEach(function (m) {
      if (!inMonth(monthKeyOf(m.occurred_on))) return;
      var kind = MOVEMENT_KINDS[m.kind] || MOVEMENT_KINDS.adjustment;
      var q = {};
      q[Number(m.award_type_id)] = Number(m.quantity) || 0;

      entries.push({
        at: m.created_at || m.occurred_on,
        column: kind.column,
        what: m.kind === "utilised" ? "Given out" : "Typed in",
        who: m.recorded_by || "",
        quantities: q,
        note: m.note || ""
      });
    });

    return entries.sort(function (a, b) {
      return String(a.at).localeCompare(String(b.at));
    });
  }

  /* The groups of the sheet, in the order they read across it. */
  var DETAIL_GROUPS = [
    { column: "requisition", label: "Requisition", kind: "req" },
    { column: "delivery",    label: "Delivery",    kind: "del" },
    { column: "utilisation", label: "Utilisation", kind: "use" },
    { column: "other",       label: "Corrections", kind: "bal" }
  ];

  function openBreakdown(district, monthKey) {
    var fy = Number(el.stockYear.value) || fyStartOf(new Date());
    var entries = monthBreakdown(district, monthKey, fy);
    var types = awardTypes;

    returnFocusTo = document.activeElement;
    el.detailHeading.textContent = district + " \u00b7 " +
      (monthKey ? monthLabelOf(monthKey) : "Before " + fyLabel(fy));

    el.detailSub.textContent = entries.length
      ? (entries.length === 1 ? "One thing happened here"
                              : entries.length + " things happened here") +
        ", and what each of them was."
      : "Nothing was recorded against this month.";

    var figures = function (map, extra) {
      var html = "";
      types.forEach(function (t) {
        var n = map[t.id] || 0;
        html += '<td class="num' + (n ? "" : " is-nil") +
                (n < 0 ? " is-neg" : "") + '">' +
                (n ? escapeHtml(n.toLocaleString()) : "\u2013") + "</td>";
      });
      var total = sumOf(map);
      return html + '<td class="num is-total' + (extra || "") + '">' +
             (total ? escapeHtml(total.toLocaleString()) : "\u2013") + "</td>";
    };

    var head = "<thead><tr><th>What</th>" +
      types.map(function (t) {
        return '<th class="num">' + escapeHtml(shortType(t)) + "</th>";
      }).join("") + '<th class="num">Total</th></tr></thead>';

    var body = "";

    DETAIL_GROUPS.forEach(function (group) {
      var mine = entries.filter(function (e) { return e.column === group.column; });
      if (!mine.length) return;

      var sum = {};
      mine.forEach(function (e) { addInto(sum, e.quantities); });

      body += '<tr class="detail-group col-' + group.kind + '">' +
                '<th colspan="' + (types.length + 2) + '">' +
                  escapeHtml(group.label) +
                  (mine.length > 1
                     ? '<span class="detail-count">' + mine.length + "</span>"
                     : "") +
                "</th></tr>";

      mine.forEach(function (e) {
        body += '<tr class="detail-line">' +
                  '<td class="detail-what"><b>' + escapeHtml(e.what) + "</b>" +
                    (e.who ? "<span>" + escapeHtml(e.who) + "</span>" : "") +
                    "<time>" + escapeHtml(formatTimestamp(e.at)) + "</time>" +
                    (e.note ? '<em>' + escapeHtml(e.note) + "</em>" : "") +
                  "</td>" + figures(e.quantities) +
                "</tr>";
      });

      if (mine.length > 1) {
        body += '<tr class="detail-sum"><td>Total</td>' +
                figures(sum, " is-strong") + "</tr>";
      }
    });

    el.detailBody.innerHTML =
      '<div class="table-scroll"><table class="detail-table">' +
      head + "<tbody>" + body + "</tbody></table></div>";

    el.detailModal.classList.add("is-open");
    document.addEventListener("keydown", onDetailKeydown);
    scrollLockedAt = window.scrollY;
    document.body.style.overflow = "hidden";
    el.detailModal.querySelector("[data-aw-close-detail]").focus();
  }

  function closeBreakdown() {
    el.detailModal.classList.remove("is-open");
    document.removeEventListener("keydown", onDetailKeydown);
    document.body.style.overflow = "";
    if (scrollLockedAt !== null) { window.scrollTo(0, scrollLockedAt); scrollLockedAt = null; }
    if (returnFocusTo && typeof returnFocusTo.focus === "function") returnFocusTo.focus();
    returnFocusTo = null;
  }

  function onDetailKeydown(e) {
    if (e.key === "Escape") { e.stopPropagation(); closeBreakdown(); }
  }

  // Whether this district is one of theirs to record against.
  function canUseHere(district) {
    var d = String(district || "").trim().toLowerCase();
    return placesIMayRecord().some(function (p) {
      return String(p.district).trim().toLowerCase() === d;
    });
  }

  /* Where a utilisation is being recorded, taken from the row it was opened
     from. Null for opening stock, which is entered for a district that may
     have no row in the sheet yet and so has to be chosen. */
  var stockCtx = null;

  function openStockModal(ctx) {
    // Where and when are the row's, not a form's.
    var where = placesIMayRecord().filter(function (p) {
      return String(p.district).trim().toLowerCase() ===
             String((ctx && ctx.district) || "").trim().toLowerCase();
    })[0];
    if (!where) return;

    var fy = Number(el.stockYear.value) || fyStartOf(new Date());
    var monthKey = (ctx && ctx.month) || "";
    if (!monthKey) return;                        // use is recorded in a month
    if (!monthHasHappened(monthKey, fy)) return;  // and not in a month to come

    stockCtx = { state: where.state, division: where.division,
                 district: where.district, month: monthKey, fy: fy,
                 // The carry-forward row belongs to the March before the year
                 // starts, which is where last year's closing figure sits.
                 occurredOn: (monthKey || (fy + "-03")) + "-01" };

    returnFocusTo = document.activeElement;

    el.stockHeading.textContent = "Record utilisation";
    el.stockSub.textContent =
      "Awards handed out. This comes off what the district is holding.";
    el.stockFLabel.textContent = "How many were given out";
    el.stockSave.textContent = "Record";

    el.stockWhere.innerHTML =
      '<b>' + escapeHtml(stockCtx.district) + "</b>" +
      '<span>' + escapeHtml(stockCtx.division || "") +
        (stockCtx.division ? ", " : "") + escapeHtml(stockCtx.state) + "</span>" +
      '<em>' + escapeHtml(monthLabelOf(monthKey)) + "</em>";

    // What there is to give out, which is the ceiling for what is typed.
    var held = balanceOn(stockCtx.district, fy, monthKey);

    el.stockLines.innerHTML = awardTypes.map(function (t) {
      var have = held[t.id] || 0;
      return '<div class="stock-line' + (have ? "" : " is-empty") + '">' +
             "<label>" + escapeHtml(t.name) +
               '<span class="hint">' +
                 (have ? escapeHtml(have.toLocaleString()) + " in stock"
                       : "none in stock") +
               "</span>" +
             "</label>" +
             '<input type="number" class="mono stock-qty" data-type="' + escapeHtml(t.id) +
             '" data-have="' + have + '" min="0" max="' + have +
             '" step="1" placeholder="0"' + (have ? "" : " disabled") +
             " /></div>";
    }).join("");

    el.stockNote.value = "";
    setFieldError(null, "stock-qty-error", "");

    el.stockModal.classList.add("is-open");
    document.addEventListener("keydown", onStockKeydown);
    scrollLockedAt = window.scrollY;
    document.body.style.overflow = "hidden";
    var first = el.stockLines.querySelector(".stock-qty:not([disabled])");
    (first || el.stockSave).focus();
  }

  function closeStockModal() {
    el.stockModal.classList.remove("is-open");
    document.removeEventListener("keydown", onStockKeydown);
    document.body.style.overflow = "";
    if (scrollLockedAt !== null) { window.scrollTo(0, scrollLockedAt); scrollLockedAt = null; }
    if (returnFocusTo && typeof returnFocusTo.focus === "function") returnFocusTo.focus();
    returnFocusTo = null;
  }

  function onStockKeydown(e) {
    if (e.key === "Escape") { e.stopPropagation(); closeStockModal(); }
  }

  // One movement, ready to write.
  function movementRow(kind, awardTypeId, quantity, note) {
    return {
      kind: kind,
      state_name: stockCtx.state,
      division_name: stockCtx.division || null,
      district_name: stockCtx.district,
      award_type_id: awardTypeId,
      quantity: quantity,
      occurred_on: stockCtx.occurredOn,
      note: [note, el.stockNote.value.trim()].filter(Boolean).join(" \u00b7 ") || null,
      recorded_by: (signedInUser() || {}).name || myEmail(),
      recorded_email: myEmail() || null
    };
  }

  /* What the district holds at the end of a month - or, for the empty month
     key, what it carried into the year. */
  function balanceOn(district, fy, monthKey) {
    var rows = stockRows(fy, allRequisitions, stockMovements,
                         [{ state: "", division: "", district: district, pm: "" }]);
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].monthKey === monthKey) return rows[i].balance;
    }
    return {};
  }

  /* What the months from here on would look like if these movements were
     recorded. Checking only the month being edited is not enough: the number
     that goes wrong is not always the one being typed. */
  function wouldGoNegative(district, fy, fromKey, movements) {
    var pretend = stockMovements.concat(movements.map(function (m) {
      return { kind: m.kind, district_name: district,
               award_type_id: m.award_type_id, quantity: m.quantity,
               occurred_on: m.occurred_on };
    }));

    var rows = stockRows(fy, allRequisitions, pretend,
                         [{ state: "", division: "", district: district, pm: "" }]);

    for (var i = 0; i < rows.length; i++) {
      // The carry-forward row counts only when the figure being set is the
      // carry-forward itself; otherwise start at the month being edited.
      var key = rows[i].monthKey;
      if (fromKey ? (!key || key < fromKey) : false) continue;

      var balance = rows[i].balance;
      var ids = Object.keys(balance);
      for (var j = 0; j < ids.length; j++) {
        if (balance[ids[j]] < 0) {
          return { month: key ? monthLabelOf(key) : "the carry forward",
                   award_type_id: Number(ids[j]), short: -balance[ids[j]] };
        }
      }
    }
    return null;
  }

  function saveStock() {
    if (!stockCtx) {
      setFieldError(null, "stock-qty-error",
        "Open this from the row you are recording against.");
      return;
    }

    var rows = [];
    var fault = "";

    var nameOf = function (id) {
      var t = awardTypes.filter(function (a) { return Number(a.id) === Number(id); })[0];
      return (t && t.name) || "that award";
    };

    Array.prototype.forEach.call(el.stockLines.querySelectorAll(".stock-qty"),
      function (input) {
        var raw = String(input.value || "").trim();
        if (!raw) return;

        var n = Number(raw);
        var have = Number(input.getAttribute("data-have")) || 0;
        var id = Number(input.getAttribute("data-type"));

        if (!Number.isInteger(n) || n < 1) {
          if (!fault) fault = "Quantities are whole numbers of 1 or more.";
          return;
        }
        if (n > have) {
          if (!fault) {
            fault = stockCtx.district + " is holding " + have.toLocaleString() +
                    " " + nameOf(id) + " in " + monthLabelOf(stockCtx.month) +
                    ", so it cannot give out " + n.toLocaleString() + ".";
          }
          return;
        }
        rows.push(movementRow("utilised", id, n, null));
      });

    if (fault) { setFieldError(null, "stock-qty-error", fault); return; }
    if (!rows.length) {
      setFieldError(null, "stock-qty-error", "Enter at least one quantity.");
      return;
    }
    setFieldError(null, "stock-qty-error", "");

    // No correction may leave a later month holding less than nothing.
    var trouble = wouldGoNegative(stockCtx.district, stockCtx.fy, stockCtx.month, rows);
    if (trouble) {
      var short = awardTypes.filter(function (a) {
        return Number(a.id) === trouble.award_type_id;
      })[0] || {};
      setFieldError(null, "stock-qty-error",
        "That would leave " + stockCtx.district + " holding " + trouble.short +
        " fewer " + (short.name || "of that award") + " than nothing by " +
        trouble.month + ". Something later has already been " +
        "recorded against this stock.");
      return;
    }

    el.stockSave.disabled = true;
    db.from("award_stock_movements").insert(rows).select("id")
      .then(function (res) {
        el.stockSave.disabled = false;
        if (res.error) {
          var msg = res.error.message || "";
          setFieldError(null, "stock-qty-error",
            /kind_check|quantity_sane/i.test(msg)
              ? "Figures typed by hand need sql/award-stock-manual.sql run in " +
                "the Supabase SQL editor first."
              : "Could not save: " + msg);
          reportError("save stock", res.error);
          return;
        }
        var where = stockCtx.district;
        closeStockModal();
        showListBanner("Utilisation recorded for " + where + ".");
        loadStock(function () { stockShown = true; renderStock(); });
      })
      .catch(function (err) {
        el.stockSave.disabled = false;
        setFieldError(null, "stock-qty-error", "Could not save: " + messageOf(err));
      });
  }

  function sumOf(map) {
    return Object.keys(map).reduce(function (n, id) { return n + (map[id] || 0); }, 0);
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
            "<code>sql/award-management-setup.sql</code> " +
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
