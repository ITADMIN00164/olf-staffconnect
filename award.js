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
    reqStock: document.getElementById("req-stock"),
    stockTemplate: document.getElementById("stock-template"),
    stockImport: document.getElementById("stock-import"),
    stockFile: document.getElementById("stock-file"),
    importModal: document.getElementById("import-modal"),
    importSub: document.getElementById("import-sub"),
    importBody: document.getElementById("import-body"),
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
    levelsModal: document.getElementById("levels-modal"),
    levelsSub: document.getElementById("levels-sub"),
    levelsBody: document.getElementById("levels-body"),
    logModal: document.getElementById("log-modal"),
    logSub: document.getElementById("log-sub"),
    logBody: document.getElementById("log-body"),
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
            '<circle cx="11" cy="11" r="6"/><path d="m16 16 4.5 4.5"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
              'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
            'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M12 20V10m0 0 4 4m-4-4-4 4M5 5h14"/></svg>',
    stock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
           'stroke-linecap="round" stroke-linejoin="round">' +
           '<path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
           'stroke-linecap="round" stroke-linejoin="round">' +
           '<path d="M2 6h11v10H2zM13 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="1.8"/>' +
           '<circle cx="17" cy="18" r="1.8"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
           'stroke-linecap="round" stroke-linejoin="round">' +
           '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    done:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
           'stroke-linecap="round" stroke-linejoin="round">' +
           '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/></svg>',
    stopped: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
             'stroke-linecap="round" stroke-linejoin="round">' +
             '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
            'stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/>' +
            '<path d="M8 6H4v2a3 3 0 0 0 4 2.8M16 6h4v2a3 3 0 0 1-4 2.8M12 13v4M8.5 20h7M10 17h4"/></svg>',
    doc:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
           'stroke-linecap="round" stroke-linejoin="round">' +
           '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
             'stroke-linecap="round" stroke-linejoin="round">' +
             '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
    eye:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
           'stroke-linecap="round" stroke-linejoin="round">' +
           '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
    gear:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
           'stroke-linecap="round" stroke-linejoin="round">' +
           '<circle cx="12" cy="12" r="3"/>' +
           '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
            'stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
           'stroke-linecap="round" stroke-linejoin="round">' +
           '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>'
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

  /* The Test tab holds two things: Stock Management, which is the rest of
     this file, and Award Management, a copy of the POM page's view kept in
     award-manage.js. That one starts the first time it is opened, since it
     fetches the district list and nothing else needs it. */
  var awardViewStarted = false;

  function showTopView(which) {
    var award = which === "award";
    var stock = document.getElementById("aw-view-stock");
    var awardView = document.getElementById("aw-view-award");
    if (!stock || !awardView) return;

    stock.hidden = award;
    var actions = document.getElementById("aw-stock-actions");
    if (actions) actions.hidden = award;
    awardView.hidden = !award;
    Array.prototype.forEach.call(
      document.querySelectorAll(".award-page .aw-toptab"),
      function (tab) {
        var on = tab.getAttribute("data-aw-top") === which;
        tab.classList.toggle("is-active", on);
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.tabIndex = on ? 0 : -1;
      }
    );

    if (award && !awardViewStarted && typeof window.initAwardManageUI === "function") {
      awardViewStarted = true;
      window.initAwardManageUI();
    }
  }

  function mount() {
    cacheElements();
    if (!el.form) return;        // the tab is not on screen

    awardViewStarted = false;      // a fresh page has a fresh Award Management view

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
    loadStock(function () {
      refreshStockControls(); renderStock(); renderReqStock();
    });
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
    renderReqStock();

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
        "<div><dt>Levels</dt><dd>" + awardsCellHtml(awardsOf(row), row) + "</dd></div>" +
        "<div><dt>Total</dt><dd>" + escapeHtml(Number(row.quantity).toLocaleString()) +
        "</dd></div>" +
        "<div><dt>For</dt><dd>" +
          escapeHtml([p.district, p.division, p.state].filter(Boolean).join(", ")) +
        "</dd></div>" +
        (remarkOf(row) ? "<div><dt>Remark</dt><dd>" + escapeHtml(remarkOf(row)) + "</dd></div>" : "") +
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
        "<div><dt>Levels</dt><dd>" + awardsCellHtml(awardsOf(row), row) + "</dd></div>" +
        (remarkOf(row) ? "<div><dt>Remark</dt><dd>" + escapeHtml(remarkOf(row)) + "</dd></div>" : "") +
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
        return '<div class="stock-line"><label>' + escapeHtml(levelLabel(t.name, t.code)) +
               ' <span class="hint">asked for ' + escapeHtml(asked[t.id]) +
               escapeHtml(askedSplit(row, t.id)) + '</span></label>' +
               '<input type="number" class="mono ho-qty" data-type="' + escapeHtml(t.id) +
               '" min="0" max="1000000" step="1" value="' + escapeHtml(asked[t.id]) + '" /></div>';
      }).join("");
      if (!el.hoLines.innerHTML) {
        el.hoLines.innerHTML = '<p class="hint">Only jute bags were asked for. They are not counted in stock, so there is no figure to enter.</p>';
      }
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
      if (!going.length && askedOf(row) > 0) {
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
      document.querySelectorAll(".award-page .aw-toptab"),
      function (tab) {
        tab.addEventListener("click", function () {
          showTopView(tab.getAttribute("data-aw-top"));
        });
      }
    );

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
    Array.prototype.forEach.call(
      el.levelsModal.querySelectorAll("[data-aw-close-levels]"),
      function (n) { n.addEventListener("click", closeLevels); }
    );
    Array.prototype.forEach.call(
      el.logModal.querySelectorAll("[data-aw-close-log]"),
      function (n) { n.addEventListener("click", closeLog); }
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

    if (el.stockTemplate) {
      el.stockTemplate.addEventListener("click", downloadStockTemplate);
    }
    if (el.stockImport) {
      el.stockImport.addEventListener("click", function () { el.stockFile.click(); });
    }
    if (el.stockFile) {
      el.stockFile.addEventListener("change", function () {
        importStockFile(this.files && this.files[0]);
        this.value = "";              // the same file again still counts
      });
    }
    if (el.importModal) {
      el.importModal.addEventListener("click", function (event) {
        if (event.target.closest("[data-aw-close-import]")) closeImportResult();
      });
    }

    el.district.addEventListener("change", function () {
      setFieldError(null, "district-error", "");
      renderReqStock();
    });

    el.awardAdd.addEventListener("click", addAwardLine);

    // The lines are rebuilt as they are added and removed, so the listeners
    // sit on the container rather than on each one.
    el.awardLines.addEventListener("change", function (event) {
      if (event.target.classList.contains("award-line-type") ||
          event.target.classList.contains("award-line-cat")) {
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

        var log = event.target.closest("[data-aw-log]");
        if (log) { openLog(log.getAttribute("data-aw-log")); return; }

        var lv = event.target.closest("[data-aw-levels]");
        if (lv) { openLevels(lv.getAttribute("data-aw-levels")); return; }

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

    // Said in words, so there is no guessing which name is which.
    var states = [];
    divisions.forEach(function (d) {
      if (states.indexOf(d.state) < 0) states.push(d.state);
    });
    var pair = function (label, value) {
      return "<span><i>" + label + "</i><b>" + escapeHtml(value) + "</b></span>";
    };

    el.reqWhere.hidden = false;
    el.reqWhere.className = "req-where";
    el.reqWhere.innerHTML =
      pair(states.length === 1 ? "State" : "States", states.join(", ")) +
      pair(divisions.length === 1 ? "Division" : "Divisions",
           divisions.map(function (d) { return d.division; }).join(", "));

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
    renderReqStock();
  }

  /* What the district is holding as things stand - the sheet's balance
     column for one district, as at this month. Shown before anything is
     asked for, since how much to ask for depends on it. */
  function renderReqStock() {
    if (!el.reqStock) return;

    var district = String(el.district.value || "").trim();
    if (!district) { el.reqStock.hidden = true; return; }

    el.reqStock.hidden = false;

    if (!hasStock || !awardTypes.length) {
      el.reqStock.className = "req-stock is-quiet";
      el.reqStock.textContent = "What " + district + " is holding is not " +
        "available yet.";
      return;
    }

    var monthKey = monthKeyOf(new Date());
    var held = balanceOn(district, fyStartOf(new Date()), monthKey);

    el.reqStock.className = "req-stock";
    el.reqStock.innerHTML =
      '<p class="req-stock-head">In stock at <b>' + escapeHtml(district) +
        "</b><span>as at " + escapeHtml(monthLabelOf(monthKey)) + "</span></p>" +
      '<table class="req-stock-table"><thead><tr>' +
        awardTypes.map(function (t) {
          return '<th class="num col-bal">' + escapeHtml(shortType(t)) + "</th>";
        }).join("") +
        '<th class="num col-bal is-total">Total</th>' +
      "</tr></thead><tbody><tr>" +
        cellsHtml(held, awardTypes, "bal", {}, false) +
      "</tr></tbody></table>";
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
    var opts = '<option value="">Select level</option>';
    awardTypes.forEach(function (t) {
      opts += '<option value="' + escapeHtml(t.id) + '">' +
              escapeHtml(levelLabel(t.name, t.code)) + "</option>";
    });
    opts += '<option value="jute">Jute Bag</option>';
    var cats = '<option value="">Select category</option>';
    CATEGORY_CHOICES.forEach(function (c) {
      cats += '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + "</option>";
    });
    return '<div class="award-line">' +
             '<select class="award-line-type" aria-label="Level">' + opts + "</select>" +
             '<select class="award-line-cat" aria-label="Category" hidden>' + cats + "</select>" +
             '<input type="number" class="award-line-qty mono" min="1" max="1000000" ' +
                    'step="1" placeholder="Qty" aria-label="Quantity" />' +
             '<button type="button" class="award-line-remove" aria-label="Remove this level">' +
               '<i class="aw-icon" data-aw-icon="close" aria-hidden="true"></i>' +
             "</button>" +
             '<input type="text" class="award-line-other" maxlength="60" hidden ' +
                    'placeholder="What is it for?" aria-label="Other category" />' +
           "</div>";
  }

  var MAX_LEVEL_LINES = 12;

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
    var remark = document.getElementById("req-remark");
    if (remark) remark.value = "";
    setFieldError(null, "remark-error", "");
    paintIcons();
    syncAwardLines();
  }

  function typeById(id) {
    if (String(id) === "jute") return JUTE;
    for (var i = 0; i < awardTypes.length; i++) {
      if (String(awardTypes[i].id) === String(id)) return awardTypes[i];
    }
    return null;
  }

  /* Keeps each line in step with what it says. Block and District ask for a
     category, and "Other" asks for words. Nanhe Sitare and Shikshan Utsav
     have neither, and can only be on the requisition once: the same one twice
     is a mistake every time, and catching it here beats refusing it on submit.
     Block and District may repeat, once for each category. */
  function syncAwardLines() {
    var lines = Array.prototype.slice.call(el.awardLines.querySelectorAll(".award-line"));
    var chosen = lines.map(function (l) { return l.querySelector(".award-line-type").value; });
    var labels = chosen.map(function (v) {
      var t = typeById(v);
      return t ? levelLabel(t.name, t.code) : "";
    });
    var needs = labels.map(function (label) { return levelHasCategory(label); });

    // A level offers its own categories. When a line changes to a level with a
    // different set, the list is rebuilt and the old choice dropped.
    lines.forEach(function (line, i) {
      var cat = line.querySelector(".award-line-cat");
      cat.hidden = !needs[i];
      if (!needs[i]) { cat.value = ""; cat.setAttribute("data-set", ""); return; }
      var set = categoriesFor(labels[i]);
      var key = set.join("|");
      if (cat.getAttribute("data-set") !== key) {
        var html = '<option value="">Select category</option>';
        set.forEach(function (c) {
          html += '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + "</option>";
        });
        cat.innerHTML = html;
        cat.setAttribute("data-set", key);
      }
    });

    // First settle what each line holds. A line that holds a category an
    // earlier line at the same level already has loses it: the earlier line
    // keeps it. "Other" can be asked for more than once - each is its own
    // words - so every other category is taken once.
    var used = {};              // level id -> { category: true }
    lines.forEach(function (line, i) {
      if (!needs[i]) return;
      var cat = line.querySelector(".award-line-cat");
      var u = used[chosen[i]] || (used[chosen[i]] = {});
      if (cat.value && cat.value !== "Other" && u[cat.value]) cat.value = "";
      if (cat.value && cat.value !== "Other") u[cat.value] = true;
    });

    // Then what each line may still choose: nothing another line holds.
    lines.forEach(function (line, i) {
      var select = line.querySelector(".award-line-type");
      Array.prototype.forEach.call(select.options, function (opt) {
        var t = opt.value === "" ? null : typeById(opt.value);
        var single = t && !levelHasCategory(levelLabel(t.name, t.code));
        opt.disabled = !!single && opt.value !== chosen[i] && chosen.indexOf(opt.value) !== -1;
      });

      var cat = line.querySelector(".award-line-cat");
      var other = line.querySelector(".award-line-other");

      if (needs[i]) {
        Array.prototype.forEach.call(cat.options, function (opt) {
          var heldElsewhere = lines.some(function (l2, j) {
            return j !== i && chosen[j] === chosen[i] &&
                   l2.querySelector(".award-line-cat").value === opt.value;
          });
          opt.disabled = opt.value !== "" && opt.value !== "Other" && heldElsewhere;
        });
      }

      other.hidden = !(needs[i] && cat.value === "Other");
      if (other.hidden) other.value = "";
      line.classList.toggle("has-category", needs[i]);
      line.classList.toggle("has-other", !other.hidden);

      line.querySelector(".award-line-remove").hidden = lines.length < 2;
    });

    // The remark is asked for on every requisition except one that is only
    // jute bags, where it is optional.
    var juteOnly = chosen.some(Boolean) && chosen.every(function (v) { return !v || v === "jute"; });
    var star = document.getElementById("remark-star");
    var hint = document.getElementById("remark-hint");
    if (star) star.hidden = juteOnly;
    if (hint) hint.hidden = !juteOnly;

    el.awardAdd.hidden = lines.length >= MAX_LEVEL_LINES;
  }

  function readAwardLines() {
    return Array.prototype.map.call(
      el.awardLines.querySelectorAll(".award-line"),
      function (line) {
        var id = line.querySelector(".award-line-type").value;
        var qty = line.querySelector(".award-line-qty").value.trim();
        var type = typeById(id);
        var needs = !!type && levelHasCategory(levelLabel(type.name, type.code));
        return {
          line: line, id: id, qty: qty, type: type, needsCategory: needs,
          category: needs ? line.querySelector(".award-line-cat").value : "",
          other: needs ? line.querySelector(".award-line-other").value.trim() : ""
        };
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
            '<p class="error">Could not load the levels.</p>';
          reportError("load award types", res.error);
          return;
        }
        awardTypes = res.data || [];
        resetAwardLines();
      })
      .catch(function (err) {
        el.awardLines.innerHTML = '<p class="error">Could not load the levels.</p>';
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
    var seen = {};

    lines.forEach(function (l) {
      l.line.classList.remove("has-error");
      var n = Number(l.qty);

      if (!l.id) {
        if (!lineFault) lineFault = "Choose a level on every line, or remove the empty one.";
      } else if (l.needsCategory && !l.category) {
        if (!lineFault) lineFault = "Choose a category for every Block, District and Jute Bag line.";
      } else if (l.needsCategory && l.category === "Other" && !l.other) {
        if (!lineFault) lineFault = "Say what the other category is.";
      } else if (!l.qty) {
        if (!lineFault) lineFault = "Say how many for each level.";
      } else if (!Number.isInteger(n) || n < 1) {
        if (!lineFault) lineFault = "Quantities are whole numbers of 1 or more.";
      } else if (n > 1000000) {
        if (!lineFault) lineFault = "That quantity looks too large.";
      } else if (seen[l.id + "|" + l.category + "|" + l.other.toLowerCase()]) {
        if (!lineFault) lineFault = "The same level and category is on the requisition twice.";
      } else {
        seen[l.id + "|" + l.category + "|" + l.other.toLowerCase()] = true;
        var item = {
          award_type_id: l.id === "jute" ? null : Number(l.id),
          code: l.type ? l.type.code : null,
          name: l.type ? levelLabel(l.type.name, l.type.code) : null,
          quantity: n
        };
        if (l.needsCategory) {
          item.category = l.category;
          if (l.category === "Other") item.category_other = l.other;
        }
        items.push(item);
        total += n;
        return;
      }
      l.line.classList.add("has-error");
    });

    if (!items.length && !lineFault) lineFault = "Add at least one level.";

    /* The remark says why these are needed, and is asked for on every requisition
       but one that is only jute bags. It is kept as the note on the first step of
       the log, which is where the people reading it already look. */
    var remarkEl = document.getElementById("req-remark");
    var remark = remarkEl ? remarkEl.value.trim() : "";
    var juteOnly = lines.length > 0 && lines.every(function (l) { return l.id === "jute"; });
    if (!remark && !juteOnly) {
      setFieldError(remarkEl, "remark-error", "Add a remark: say what these are needed for.");
      ok = false;
    } else {
      setFieldError(remarkEl, "remark-error", "");
      if (remark && values.log) values.log[0].note = remark;
    }

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
        var first = values.items[0];
        var typeName = values.items.length === 1
          ? first.name + (first.category ? " · " + (first.category_other || first.category) : "")
          : "across " + values.items.length + " levels";

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
      function (name) { return name; });

    fillSelect(el.filterDivision, Object.keys(divisions).sort(), "All divisions",
      function (name) { return name; }, function (name) { return name; });

    fillSelect(el.filterDistrict, Object.keys(districts).sort(), "All districts",
      function (name) { return name; }, function (name) { return name; });

    fillSelect(el.filterType, Object.keys(types).sort(), "All levels",
      function (name) { return name; }, function (name) { return name; });
  }

  // Both views of the same rows: the list, and Head Office's queue.
  function renderRows() {
    renderTable();
    renderDelivery();
  }

  /* ------------------------------------------------------------- summaries

     A strip of figures above each list, so what is going on can be read before
     the rows are: how many requisitions are where, and how much of what was
     asked for has actually arrived. They are drawn from the same rows the
     table shows, so a filter narrows them too. */

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  // Counts up to the figure instead of appearing at it.
  function runCounters(root) {
    Array.prototype.forEach.call(root.querySelectorAll("[data-count]"), function (node) {
      var to = Number(node.getAttribute("data-count")) || 0;
      if (reducedMotion() || to === 0) { node.textContent = to.toLocaleString(); return; }
      var start = null;
      var span = 700;
      function step(now) {
        if (start === null) start = now;
        var t = Math.min(1, (now - start) / span);
        var eased = 1 - Math.pow(1 - t, 3);
        node.textContent = Math.round(to * eased).toLocaleString();
        if (t < 1) window.requestAnimationFrame(step);
      }
      node.textContent = "0";
      window.requestAnimationFrame(step);
      // A page that is not on screen does not run animation frames; the figure still has to be right.
      window.setTimeout(function () { node.textContent = to.toLocaleString(); }, span + 200);
    });
  }

  function kpiHtml(icon, tone, count, label, hint) {
    return '<div class="kpi kpi-' + tone + '">' +
             '<span class="kpi-ico"><i class="aw-icon" data-aw-icon="' + icon + '" aria-hidden="true"></i></span>' +
             '<div class="kpi-text"><b data-count="' + count + '">' + count.toLocaleString() + "</b>" +
             "<small>" + escapeHtml(label) + "</small>" +
             (hint ? "<em>" + escapeHtml(hint) + "</em>" : "") + "</div>" +
           "</div>";
  }

  var PIPE = [
    { key: "pending",  label: "Pending",    cls: "pipe-pending",  stages: ["submitted"] },
    { key: "moving",   label: "In progress", cls: "pipe-moving",   stages: ["approved", "acknowledged", "dispatched"] },
    { key: "held",     label: "On hold",    cls: "pipe-held",     stages: ["on_hold"] },
    { key: "done",     label: "Received",   cls: "pipe-done",     stages: ["received"] },
    { key: "stopped",  label: "Declined",   cls: "pipe-stopped",  stages: ["declined", "rejected"] }
  ];

  function renderReqSummary(rows) {
    var box = document.getElementById("req-summary");
    if (!box) return;
    if (!allRequisitions.length) { box.hidden = true; box.innerHTML = ""; return; }

    var count = {};
    PIPE.forEach(function (p) { count[p.key] = 0; });
    var asked = 0, got = 0;
    rows.forEach(function (row) {
      var st = stageOf(row);
      PIPE.forEach(function (p) { if (p.stages.indexOf(st) !== -1) count[p.key] += 1; });
      asked += askedOf(row);
      got += deliveredOf(row);
    });
    var total = rows.length;
    var pct = asked ? Math.round((got / asked) * 100) : 0;
    var C = 2 * Math.PI * 26;

    var segments = PIPE.filter(function (p) { return count[p.key]; }).map(function (p) {
      return '<span class="pipe-seg ' + p.cls + '" style="--w:' + (count[p.key] / total * 100) +
             '%" title="' + escapeHtml(p.label) + ": " + count[p.key] + '"></span>';
    }).join("");
    var legend = PIPE.filter(function (p) { return count[p.key]; }).map(function (p) {
      return '<span class="pipe-key"><i class="' + p.cls + '"></i>' + escapeHtml(p.label) +
             " <b>" + count[p.key] + "</b></span>";
    }).join("");

    box.innerHTML =
      '<div class="kpis">' +
        kpiHtml("doc", "total", total, total === 1 ? "Requisition" : "Requisitions", "") +
        kpiHtml("clock", "wait", count.pending + count.held, "Waiting", "pending or on hold") +
        kpiHtml("truck", "move", count.moving, "In progress", "approved to dispatched") +
        kpiHtml("done", "good", count.done, "Received", "") +
        '<div class="kpi kpi-ring">' +
          '<svg class="ring" viewBox="0 0 64 64" aria-hidden="true">' +
            '<circle class="ring-bg" cx="32" cy="32" r="26"/>' +
            '<circle class="ring-fg" cx="32" cy="32" r="26" stroke-dasharray="' + C.toFixed(1) +
              '" style="--c:' + C.toFixed(1) + ";--to:" + (C * (1 - Math.min(1, pct / 100))).toFixed(1) + '"/>' +
          "</svg>" +
          '<div class="kpi-text"><b><span data-count="' + pct + '">' + pct + '</span>%</b>' +
            "<small>Delivered</small><em>" + got.toLocaleString() + " of " + asked.toLocaleString() + "</em></div>" +
        "</div>" +
      "</div>" +
      (total ? '<div class="pipe"><div class="pipe-bar">' + segments + '</div><div class="pipe-legend">' +
               legend + "</div></div>" : "");
    box.hidden = false;
    paintIcons();
    runCounters(box);
  }

  /* What each level holds now, and how it got there, in plain words: what the
     districts started the year with, plus what has arrived, minus what was
     given out. That is the whole story of the number, so it is said once per
     level and added up in the first card. */
  function renderStockSummary(rows, types, fy) {
    var box = document.getElementById("stock-summary");
    if (!box) return;
    if (!rows || !rows.length) { box.hidden = true; box.innerHTML = ""; return; }

    var start = {}, came = {}, used = {}, held = {};
    var latest = {};
    var nowKey = monthKeyOf(new Date());

    rows.forEach(function (r) {
      types.forEach(function (t) {
        if (!r.monthKey) start[t.id] = (start[t.id] || 0) + (r.balance[t.id] || 0);
        came[t.id] = (came[t.id] || 0) + (r.delivery[t.id] || 0);
        used[t.id] = (used[t.id] || 0) + (r.utilisation[t.id] || 0);
      });
      // What a district holds today is its last row up to this month.
      var cur = latest[r.district];
      var ok = !r.monthKey || r.monthKey <= nowKey;
      if (ok && (!cur || !cur.monthKey || (r.monthKey && r.monthKey >= cur.monthKey))) latest[r.district] = r;
    });
    Object.keys(latest).forEach(function (d) {
      types.forEach(function (t) { held[t.id] = (held[t.id] || 0) + (latest[d].balance[t.id] || 0); });
    });

    // What a district was given to begin the year with is part of where it started.
    var shown = {};
    rows.forEach(function (r) { shown[r.district] = true; });
    stockMovements.forEach(function (m) {
      if (m.kind !== "opening" || !shown[m.district_name]) return;
      var k = monthKeyOf(m.occurred_on);
      if (k >= fy + "-04" && k < (fy + 1) + "-04") {
        start[m.award_type_id] = (start[m.award_type_id] || 0) + (Number(m.quantity) || 0);
      }
    });

    var sum = function (map) {
      return types.reduce(function (n, t) { return n + (map[t.id] || 0); }, 0);
    };
    var total = { held: sum(held), start: sum(start), came: sum(came), used: sum(used) };

    var line = function (label, value) {
      return "<li><span>" + escapeHtml(label) + "</span><i>" + escapeHtml(value) + "</i></li>";
    };
    var signed = function (n) { return n === 0 ? "0" : (n < 0 ? "−" : "+") + Math.abs(n).toLocaleString(); };

    var card = function (name, d, isTotal) {
      var fix = d.held - (d.start + d.came - d.used);
      return '<div class="snow-card' + (isTotal ? " is-total" : "") + '">' +
        '<div class="snow-top"><span class="snow-name">' + escapeHtml(name) + "</span>" +
          '<b class="snow-held' + (d.held < 0 ? " is-neg" : "") + '" data-count="' + d.held + '">' +
          d.held.toLocaleString() + "</b></div>" +
        '<ul class="snow-how">' +
          line("Opening stock", d.start.toLocaleString()) +
          line("Delivered", signed(d.came)) +
          line("Utilised", signed(-d.used)) +
          (fix ? line("Adjustments", signed(fix)) : "") +
        "</ul></div>";
    };

    box.innerHTML =
      '<div class="snow-head"><h4>Current stock balance</h4></div>' +
      '<div class="snow-grid">' +
        card("All levels", total, true) +
        types.map(function (t) {
          return card(shortType(t), { held: held[t.id] || 0, start: start[t.id] || 0,
                                      came: came[t.id] || 0, used: used[t.id] || 0 }, false);
        }).join("") +
      "</div>";
    box.hidden = false;
    runCounters(box);
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

    renderReqSummary(rows);

    if (!allRequisitions.length) {
      placeholderRow("No requisitions yet.");
      return;
    }
    if (!rows.length) {
      placeholderRow("No matches.");
      return;
    }

    var total = 0;
    var gotTotal = 0;
    var html = "";

    rows.forEach(function (row) {
      total += askedOf(row);
      gotTotal += deliveredOf(row);
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
          '<td class="cell-awards">' + levelsCellHtml(row) + "</td>" +
          '<td class="num">' + quantityCellHtml(row) + "</td>" +
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
    el.footTotal.textContent = gotTotal.toLocaleString() + " / " + total.toLocaleString();
    el.tfoot.hidden = false;
    paintIcons();
  }

  /* ------------------------------------------------------------- levels

     A requisition asks for stock at a level: Block, District, Nanhe Sitare
     (NS) or Shikshan Utsav (SU). Block and District each split again by what
     the awards are for - Academic, POM, or something else that is typed in.
     The database still holds the four award types it always had; "POM Block"
     is the Block level, and a row filed before categories existed was a POM
     one, so that is what it reads as. */
  var CATEGORY_CHOICES = ["Academic", "POM", "Other"];

  /* Jute bags are asked for on the same form but are not an award: they have
     no row in award_types, so they never become a column in the stock sheet,
     and what is held, arrives or is given out never counts them. */
  var JUTE = { id: "jute", code: "JUTE_BAG", name: "Jute Bag" };
  var JUTE_CATEGORIES = ["Small", "Big"];

  function levelLabel(name, code) {
    var n = String(name || "");
    var c = String(code || "");
    if (/jute/i.test(c) || /jute/i.test(n)) return "Jute Bag";
    if (/block/i.test(c) || (!c && /block/i.test(n))) return "Block";
    if (/district/i.test(c) || (!c && /district/i.test(n))) return "District";
    return n || c || "Award";
  }

  function levelHasCategory(label) {
    return label === "Block" || label === "District" || label === "Jute Bag";
  }

  // What a level can be for: Block and District by what the awards are for, a jute bag by its size.
  function categoriesFor(label) {
    return label === "Jute Bag" ? JUTE_CATEGORIES : CATEGORY_CHOICES;
  }

  // What a line reads as: "Block · Academic", "Jute Bag · Small", or just the level.
  function awardChipLabel(a) {
    if (!a.hasCategory) return a.name;
    return a.name + " · " +
      (a.category === "Other" ? (a.categoryOther || "Other") : a.category);
  }

  /* What was asked for that the stock sheet counts: everything but jute bags.
     This is the "asked" in delivered / asked. */
  function askedOf(row) {
    return awardsOf(row).reduce(function (n, a) {
      return a.name === "Jute Bag" ? n : n + a.quantity;
    }, 0);
  }

  // Why it was asked for, written by whoever raised it: the note on the first step of the log.
  function remarkOf(row) {
    var log = row && row.log;
    if (log && log.length && log[0] && log[0].what === "raised") return String(log[0].note || "");
    return "";
  }

  // What was asked for at a level, split by category, for where the split matters.
  function askedSplit(row, id) {
    var parts = awardsOf(row).filter(function (a) { return a.id === Number(id) && a.hasCategory; })
      .map(function (a) { return awardChipLabel(a).replace(/^[^\u00b7]*\u00b7 /, "") + " " + a.quantity; });
    return parts.length ? " (" + parts.join(", ") + ")" : "";
  }

  /* What a requisition asks for. New rows carry a list; the ones filed
     before that asked for one award and are read from the join. */
  function awardsOf(row) {
    var typeOf = function (id) {
      for (var i = 0; i < awardTypes.length; i++) {
        if (String(awardTypes[i].id) === String(id)) return awardTypes[i];
      }
      return null;
    };
    var make = function (id, name, code, quantity, category, other) {
      var t = typeOf(id);
      var label = levelLabel(name || (t && t.name), code || (t && t.code));
      var has = levelHasCategory(label);
      return { id: Number(id) || 0, name: label, quantity: quantity,
               hasCategory: has,
               category: has ? (category || (label === "Jute Bag" ? "" : "POM")) : "",
               categoryOther: has && category === "Other" ? (other || "") : "" };
    };

    if (row && row.items && row.items.length) {
      return row.items.map(function (it) {
        return make(it.award_type_id, it.name || it.code || "Award", it.code,
                    Number(it.quantity) || 0, it.category, it.category_other);
      });
    }
    if (row && row.award_types) {
      return [make(row.award_type_id, row.award_types.name, row.award_types.code,
                   Number(row.quantity) || 0, "POM", "")];
    }
    return [];
  }

  /* What a requisition asked for, one line to each thing asked for, in three
     aligned columns: the level, what it was for, how many. NS and SU have no
     category, so that column is left empty for them. Once it has been sent, a
     level that went short says so under its lines - "sent 8 of 9" - because
     what goes out is counted per level, not per category. */
  function awardsCellHtml(awards, row) {
    if (!awards.length) return "—";

    var sent = row && row.dispatched_items && row.dispatched_items.length
      ? quantitiesOf(row, "dispatched")
      : null;

    var order = [];
    var groups = {};
    awards.forEach(function (a) {
      if (!groups[a.id]) { groups[a.id] = []; order.push(a.id); }
      groups[a.id].push(a);
    });

    var shortName = function (name) {
      var m = /\(([A-Z]{2,})\)\s*$/.exec(name);
      return m ? m[1] : name;
    };

    var html = '<div class="lvls">';
    order.forEach(function (id) {
      var list = groups[id];
      var asked = list.reduce(function (n, a) { return n + a.quantity; }, 0);
      var went = sent ? (sent[id] || 0) : asked;
      var short = !!sent && went < asked && list[0].name !== "Jute Bag";

      list.forEach(function (a) {
        var what = a.hasCategory
          ? (a.category === "Other" ? (a.categoryOther || "Other") : a.category)
          : "";
        var qty = (short && !a.hasCategory)
          ? went.toLocaleString() + " of " + asked.toLocaleString()
          : a.quantity.toLocaleString();
        // A colour for each level and each category, so the columns can be told apart at a glance.
        var kind = shortName(a.name).toLowerCase().replace(/[^a-z]/g, "");
        var catKind = a.hasCategory ? (a.category === "Other" ? "other" : String(a.category).toLowerCase()) : "";
        html += '<div class="lvl-row lv-' + kind + (short && !a.hasCategory ? " is-short" : "") + '">' +
          '<b class="lr-level" title="' + escapeHtml(a.name) + '">' +
            escapeHtml(shortName(a.name)) + "</b>" +
          (what
            ? '<span class="lr-cat cat-' + catKind + '" title="' + escapeHtml(what) + '">' + escapeHtml(what) + "</span>"
            : '<span class="lr-cat is-none">—</span>') +
          '<span class="lr-qty">' + escapeHtml(qty) + "</span>" +
        "</div>";
      });

      if (short && list[0].hasCategory) {
        html += '<div class="lvl-note">' + escapeHtml(shortName(list[0].name)) + " sent " +
          escapeHtml(went.toLocaleString()) + " of " + escapeHtml(asked.toLocaleString()) + "</div>";
      }
    });
    return html + "</div>";
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
    if (!steps.length) return '<span class="log-none">—</span>';
    return '<button type="button" class="btn btn-ghost btn-xs" data-aw-log="' +
             escapeHtml(row.id) + '"><i class="aw-icon" data-aw-icon="doc" aria-hidden="true"></i>View log <span class="log-count">' +
             steps.length + "</span></button>";
  }

  /* What has actually reached the district: only a received requisition
     has delivered anything, and it is what was dispatched that counts. */
  function deliveredOf(row) {
    if (stageOf(row) !== "received") return 0;
    var sent = quantitiesOf(row, "dispatched");
    return Object.keys(sent).reduce(function (n, id) { return n + sent[id]; }, 0);
  }

  function quantityCellHtml(row) {
    var asked = askedOf(row);
    if (!asked) return '<span class="qty-none" title="Jute bags only: not counted">\u2014</span>';
    var got = deliveredOf(row);
    return '<span class="qty-got' + (got ? "" : " is-none") + '">' +
             escapeHtml(got.toLocaleString()) + "</span>" +
           '<span class="qty-sep"> / </span>' +
           '<span class="qty-asked">' + escapeHtml(asked.toLocaleString()) + "</span>";
  }

  function logListHtml(row) {
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

  /* In the tables a requisition takes one line: the levels it asked for, named,
     and a button for the detail. The level, category and quantity lines open in a
     pop-up, the same way the log does. */
  function levelsCellHtml(row) {
    var awards = awardsOf(row);
    if (!awards.length) return "\u2014";
    var names = [];
    awards.forEach(function (a) {
      var m = /\(([A-Z]{2,})\)\s*$/.exec(a.name);
      var n = m ? m[1] : a.name;
      if (names.indexOf(n) === -1) names.push(n);
    });
    return '<span class="lvl-summary" title="' + escapeHtml(names.join(", ")) + '">' +
             escapeHtml(names.join(" \u00b7 ")) + "</span>" +
           '<button type="button" class="btn btn-ghost btn-xs" data-aw-levels="' +
             escapeHtml(row.id) + '"><i class="aw-icon" data-aw-icon="eye" aria-hidden="true"></i>View <span class="log-count">' + awards.length + "</span></button>";
  }

  function openLevels(id) {
    var row = allRequisitions.filter(function (r) { return String(r.id) === String(id); })[0];
    if (!row) return;
    var p = placeOf(row);
    el.levelsSub.textContent = [row.requester_name, p.district].filter(Boolean).join(" \u00b7 ") +
      " \u00b7 " + stageLabel(row, false);
    el.levelsBody.innerHTML =
      '<div class="lvls-head"><span>Level</span><span>Category</span><span>Asked</span></div>' +
      awardsCellHtml(awardsOf(row), row) +
      (askedOf(row)
        ? '<p class="lvls-total">Delivered <b>' + escapeHtml(deliveredOf(row).toLocaleString()) +
          '</b> of <b>' + escapeHtml(askedOf(row).toLocaleString()) + "</b> asked for" +
          (awardsOf(row).some(function (a) { return a.name === "Jute Bag"; }) ? " (jute bags not counted)" : "") + "</p>"
        : '<p class="lvls-total">Jute bags are not counted in stock.</p>') +
      (remarkOf(row) ? '<p class="lvls-remark"><b>Remark</b>' + escapeHtml(remarkOf(row)) + "</p>" : "");
    el.levelsModal.classList.add("is-open");
    document.addEventListener("keydown", onLevelsKeydown);
    scrollLockedAt = window.scrollY;
    document.body.style.overflow = "hidden";
    el.levelsModal.querySelector("[data-aw-close-levels]").focus();
  }

  function closeLevels() {
    el.levelsModal.classList.remove("is-open");
    document.removeEventListener("keydown", onLevelsKeydown);
    document.body.style.overflow = "";
    if (scrollLockedAt !== null) { window.scrollTo(0, scrollLockedAt); scrollLockedAt = null; }
  }

  function onLevelsKeydown(e) {
    if (e.key === "Escape") { e.stopPropagation(); closeLevels(); }
  }

  function openLog(id) {
    var row = allRequisitions.filter(function (r) { return String(r.id) === String(id); })[0];
    if (!row) return;
    var p = placeOf(row);
    el.logSub.textContent = [row.requester_name, p.district].filter(Boolean).join(" · ") +
      " · " + stageLabel(row, false);
    el.logBody.innerHTML = logListHtml(row);
    el.logModal.classList.add("is-open");
    document.addEventListener("keydown", onLogKeydown);
    scrollLockedAt = window.scrollY;
    document.body.style.overflow = "hidden";
    el.logModal.querySelector("[data-aw-close-log]").focus();
  }

  function closeLog() {
    el.logModal.classList.remove("is-open");
    document.removeEventListener("keydown", onLogKeydown);
    document.body.style.overflow = "";
    if (scrollLockedAt !== null) { window.scrollTo(0, scrollLockedAt); scrollLockedAt = null; }
  }

  function onLogKeydown(e) {
    if (e.key === "Escape") { e.stopPropagation(); closeLog(); }
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
        '<td class="cell-awards">' + levelsCellHtml(row) + "</td>" +
        '<td class="num">' + quantityCellHtml(row) + "</td>" +
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

  /* Who manages the place, one name to a line. A stand-in is marked so it is
     not read as the post-holder: the name, then an "interim" badge. */
  function pmHtml(text) {
    if (!text) return "—";
    return String(text).split(", ").map(function (one) {
      var m = one.match(/^(.*?)\s*\((interim [^)]+)\)$/i);
      return '<span class="pm-one">' + escapeHtml(m ? m[1] : one) +
        (m ? ' <em class="pm-interim">' + escapeHtml(m[2]) + "</em>" : "") + "</span>";
    }).join("");
  }

  // Every district the directory knows, with who manages it.
  function stockPlaces() {
    var out = [];
    var seen = {};

    geography.forEach(function (st) {
      st.divisions.forEach(function (dv) {
        dv.districts.forEach(function (d) {
          seen[d.toLowerCase()] = true;
          out.push({ state: st.name, division: dv.name, district: d, pm: (dv.pmByDistrict && dv.pmByDistrict[d]) || dv.pm || "" });
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

    if (el.stockTemplate) el.stockTemplate.hidden = !canSetStock();
    if (el.stockImport) el.stockImport.hidden = !canSetStock();
  }

  /* Whether the sheet has been asked for. The tab opens on its filters and
     the figures come when Fetch is pressed - thirty-five districts over
     twelve months is four hundred rows. */
  var stockShown = false;

  function renderStock() {
    var wrap = document.getElementById("stock-table-wrap");
    if (!wrap) return;
    var summaryBox = document.getElementById("stock-summary");
    if (summaryBox) summaryBox.hidden = true;

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

    renderStockSummary(rows, types, fy);

    var head = groupHeadHtml(types, { before:
        '<th rowspan="2" class="col-month">Month</th>' +
        '<th rowspan="2" class="col-district">District</th>' +
        '<th rowspan="2">State</th><th rowspan="2">PM</th>' },
      '<th rowspan="2">Remark</th>' +
      '<th rowspan="2" class="col-act"><span class="sr-only">Record</span></th>');

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
          pmHtml(r.pm) + "</td>" +
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

  /* The four groups of the sheet, in the order they read across it. The
     breakdown is the same table for one month, so it reads from the same
     list. */
  var GROUPS = [
    { kind: "req", label: "Requisition",   column: "requisition" },
    { kind: "del", label: "Delivery",      column: "delivery" },
    { kind: "use", label: "Utilisation",   column: "utilisation" },
    { kind: "bal", label: "Stock Balance", column: "balance" }
  ];

  /* The two-row head both tables wear: a band per group, the award columns
     under it. `lead` is whatever columns come first, which differ. */
  function groupHeadHtml(types, lead, trail) {
    return "<thead><tr>" + lead.before +
      GROUPS.map(function (g) {
        return '<th colspan="' + (types.length + 1) + '" class="grp col-' + g.kind +
               '">' + escapeHtml(g.label) + "</th>";
      }).join("") + (trail || "") +
      "</tr><tr>" +
      GROUPS.map(function (g) {
        return types.map(function (t) {
          return '<th class="num col-' + g.kind + '">' + escapeHtml(shortType(t)) +
                 "</th>";
        }).join("") + '<th class="num col-' + g.kind + ' is-total">Total</th>';
      }).join("") +
      "</tr></thead>";
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


  /* ------------------------------------------------- a year at a time

     Setting a district's figures one cell at a time is fine for a correction
     and hopeless for a year that has to be keyed in from a workbook. The
     sheet goes out as a file, comes back filled, and lands as the same
     unsaved edits typing would have made - so Save is still the one thing
     that writes, and the sheet still shows every change before it does. */

  var CSV_GROUPS = [
    { col: "req", label: "Requisition" },
    { col: "del", label: "Delivery" },
    { col: "use", label: "Utilisation" },
    { col: "bal", label: "Balance" }
  ];

  function csvField(value) {
    var text = value === null || value === undefined ? "" : String(value);
    return /[",\r\n;\t]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  // RFC 4180, plus the delimiter a spreadsheet chose for its locale.
  function parseCsv(text) {
    var body = String(text || "").replace(/^\uFEFF/, "");
    var head = body.split(/\r?\n/)[0] || "";
    var delim = [",", ";", "\t"].reduce(function (best, d) {
      return head.split(d).length > head.split(best).length ? d : best;
    }, ",");

    var rows = [], row = [], field = "", quoted = false, i = 0;
    while (i < body.length) {
      var c = body.charAt(i);
      if (quoted) {
        if (c === '"' && body.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
        if (c === '"') { quoted = false; i += 1; continue; }
        field += c; i += 1; continue;
      }
      if (c === '"') { quoted = true; i += 1; continue; }
      if (c === delim) { row.push(field); field = ""; i += 1; continue; }
      if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i += 1; continue; }
      if (c === "\r") { i += 1; continue; }
      field += c; i += 1;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }

    return rows.filter(function (r) {
      return r.some(function (v) { return String(v).trim() !== ""; });
    });
  }

  function normalHeader(text) {
    return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  /* Every spelling of a column that means something, so a header typed by
     hand or renamed by a spreadsheet still finds its place. */
  function csvColumnMap(types) {
    var map = {};
    map["month"] = { what: "month" };
    map["district"] = { what: "district" };

    CSV_GROUPS.forEach(function (g) {
      types.forEach(function (t) {
        var names = [shortType(t), t.code, t.name];
        [g.label, g.col].forEach(function (lead) {
          names.forEach(function (name) {
            if (!name) return;
            map[normalHeader(lead + " " + name)] =
              { what: "figure", col: g.col, typeId: Number(t.id) };
          });
        });
      });
    });
    return map;
  }

  function parseMonthCell(text) {
    var raw = String(text || "").trim();
    if (!raw || /^(carry|opening|brought)/i.test(raw)) return { key: "" };

    var pad = function (n) { return String(Number(n)).padStart(2, "0"); };
    var m = raw.match(/^(\d{4})[-\/.](\d{1,2})(?:[-\/.]\d{1,2})?$/);
    if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
      return { key: m[1] + "-" + pad(m[2]) };
    }

    /* A spreadsheet may have turned the month into a date. The day is always
       the first, so whichever number is not 1 is the month - and when
       neither is, there is no telling which way round it meant. */
    m = raw.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
    if (m) {
      var a = Number(m[1]), b = Number(m[2]);
      if (a === 1 && b >= 1 && b <= 12) return { key: m[3] + "-" + pad(b) };
      if (b === 1 && a >= 1 && a <= 12) return { key: m[3] + "-" + pad(a) };
      return { error: 'cannot tell which number is the month in "' + raw +
                      '" - write it as ' + MONTH_NAMES[3] + "'" +
                      String(m[3]).slice(2) };
    }

    m = raw.match(/^([A-Za-z]{3,9})[^0-9]*(\d{2,4})$/);
    if (m) {
      var want = m[1].slice(0, 3).toLowerCase();
      for (var i = 0; i < MONTH_NAMES.length; i++) {
        if (MONTH_NAMES[i].toLowerCase() === want) {
          var year = Number(m[2]);
          return { key: (year < 100 ? 2000 + year : year) + "-" + pad(i + 1) };
        }
      }
    }
    return { error: 'no month called "' + raw + '"' };
  }

  /* A figure in the file replaces what is recorded for that cell. An empty
     one is not an answer - it is a cell nobody filled in - so what is there
     is left alone. A dash or a nought are answers: they mean nothing held,
     and will take a figure away. */
  function parseFigureCell(text) {
    var raw = String(text || "").trim();
    if (!raw) return { skip: true };
    if (/^[-\u2013\u2014]$/.test(raw)) return { value: 0 };

    var cleaned = raw.replace(/[,\s\u00a0]/g, "");
    if (!/^\d+$/.test(cleaned)) {
      return { error: '"' + raw + '" is not a whole number' };
    }
    return { value: Number(cleaned) };
  }

  function stockFileName(fy) {
    var where = el.stockDistrict.value || el.stockDivision.value ||
                el.stockState.value || "all districts";
    return "award-stock-" + fyLabel(fy) + "-" +
           where.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".csv";
  }

  /* The sheet as it stands, for the districts on screen: April to March,
     every month of the year, whether anything has happened in it or not.
     The places are the staff directory's - the same ones the sheet and the
     requisition form read. */
  function stockTemplate(fy, places, types) {
    var head = ["Month", "State", "Division", "District"];
    CSV_GROUPS.forEach(function (g) {
      types.forEach(function (t) { head.push(g.label + " " + shortType(t)); });
    });

    /* The sheet draws a district under every division the directory posts
       anybody to, but what it is holding is one figure either way - stock is
       kept by district. So the file names it once. */
    var once = [];
    var already = {};
    places.forEach(function (p) {
      var key = p.district.trim().toLowerCase();
      if (already[key]) return;
      already[key] = true;
      once.push(p);
    });

    var lines = [head];
    var figures = function (row, group) {
      return types.map(function (t) {
        var n = (row[EDIT_COLUMNS[group].column] || {})[t.id] || 0;
        return n ? String(n) : "";
      });
    };

    once.forEach(function (place) {
      stockRows(fy, allRequisitions, stockMovements, [place])
        .forEach(function (row) {
          var line = [row.month, row.state, place.division || "", row.district];
          CSV_GROUPS.forEach(function (g) {
            /* The carry forward is one opening balance and nothing else;
               every other month is the three that are recorded. Blank is
               what the import reads as "not mine to change". */
            var typed = row.monthKey === "" ? g.col === "bal" : g.col !== "bal";
            line = line.concat(typed ? figures(row, g.col)
                                     : types.map(function () { return ""; }));
          });
          lines.push(line);
        });
    });

    return lines.map(function (line) {
      return line.map(csvField).join(",");
    }).join("\r\n");
  }

  function downloadStockTemplate() {
    if (!canSetStock()) return;

    var fy = Number(el.stockYear.value) || fyStartOf(new Date());
    var places = visibleStockPlaces();
    if (!places.length) { showStockEditError("No districts match."); return; }

    // The byte order mark is what makes a spreadsheet read it as UTF-8.
    var blob = new Blob(["\uFEFF" + stockTemplate(fy, places, awardTypes)],
                        { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = stockFileName(fy);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  function visibleStockPlaces() {
    return stockPlaces().filter(function (p) {
      return (!el.stockState.value    || p.state === el.stockState.value) &&
             (!el.stockDivision.value || p.division === el.stockDivision.value) &&
             (!el.stockDistrict.value || p.district === el.stockDistrict.value);
    });
  }

  /* What a file would change, worked out without changing anything. Every
     reason a figure cannot be taken is kept, named by the line it was on. */
  function readStockImport(text, fy) {
    var out = { edits: {}, problems: [], unchanged: 0, cleared: 0,
                districts: {}, rows: 0 };
    var rows = parseCsv(text);
    if (!rows.length) {
      out.problems.push({ line: 0, why: "The file is empty." });
      return out;
    }

    var map = csvColumnMap(awardTypes);
    var columns = rows[0].map(function (h) { return map[normalHeader(h)] || null; });
    var monthAt = columns.findIndex(function (c) { return c && c.what === "month"; });
    var districtAt = columns.findIndex(function (c) { return c && c.what === "district"; });

    if (monthAt < 0 || districtAt < 0) {
      out.problems.push({ line: 1, why:
        "The first line has to name the columns, and must include Month and " +
        "District. Download the template and fill that in." });
      return out;
    }
    if (!columns.some(function (c) { return c && c.what === "figure"; })) {
      out.problems.push({ line: 1, why:
        "No column of figures was recognised. They are named like " +
        '"Requisition ' + shortType(awardTypes[0] || { code: "Block" }) + '".' });
      return out;
    }

    var known = {};
    stockPlaces().forEach(function (p) {
      known[p.district.trim().toLowerCase()] = p;
    });

    var seen = {};
    var months = fyMonthKeys(fy);

    rows.slice(1).forEach(function (row, index) {
      var line = index + 2;
      out.rows += 1;

      /* A line with the wrong number of fields has had something shift along
         it - a thousands comma typed without quotes around it, most likely -
         and every figure after the shift would land in the wrong column. */
      if (row.length !== rows[0].length) {
        out.problems.push({ line: line, why: "this line has " + row.length +
          (row.length === 1 ? " field" : " fields") + " where the first line " +
          "has " + rows[0].length + ". A number with a comma in it needs " +
          'quotes around it, like "1,250".' });
        return;
      }

      var name = String(row[districtAt] || "").trim();
      var place = known[name.toLowerCase()];
      if (!name) {
        out.problems.push({ line: line, why: "no district on this line" });
        return;
      }
      if (!place) {
        out.problems.push({ line: line, why: '"' + name +
          '" is not a district in the staff directory' });
        return;
      }
      var month = parseMonthCell(row[monthAt]);
      if (month.error) {
        out.problems.push({ line: line, why: month.error });
        return;
      }
      if (month.key && months.indexOf(month.key) === -1) {
        out.problems.push({ line: line, why: monthLabelOf(month.key) +
          " is not in " + fyLabel(fy) + ", which is the year on screen" });
        return;
      }
      var at = place.district + "\u0000" + month.key;
      if (seen[at]) {
        out.problems.push({ line: line, why: place.district + " and " +
          (month.key ? monthLabelOf(month.key) : "the carry forward") +
          " are on line " + seen[at] + " as well" });
        return;
      }
      seen[at] = line;

      /* The template carries every month of the year, so one still to come
         arrives empty and has nothing to answer for. Only a figure typed
         into it is worth turning away. */
      var typedInto = columns.some(function (c, at2) {
        return c && c.what === "figure" && String(row[at2] || "").trim() !== "";
      });
      if (!monthHasHappened(month.key, fy)) {
        if (typedInto) {
          out.problems.push({ line: line, why: monthLabelOf(month.key) +
            " has not happened yet" });
        }
        return;
      }

      var carry = month.key === "";
      columns.forEach(function (column, at2) {
        if (!column || column.what !== "figure") return;

        /* The carry forward is one opening balance; every other month is the
           three that are recorded. A column this row cannot set is passed
           over in silence when it is empty - the template leaves it so - and
           complained about only when something was typed into it. */
        var raw = String(row[at2] || "").trim();
        if (carry !== (column.col === "bal")) {
          if (raw) {
            out.problems.push({ line: line, why: carry
              ? "the carry forward holds one opening balance, so " +
                escapeNothing(rows[0][at2]) + " cannot be set on it"
              : escapeNothing(rows[0][at2]) + " is added up from what moved, " +
                "so it cannot be typed on a month" });
          }
          return;
        }

        var cell = parseFigureCell(raw);
        if (cell.skip) return;
        if (cell.error) {
          out.problems.push({ line: line, why: cell.error + ", under " +
            escapeNothing(rows[0][at2]) });
          return;
        }

        var have = recordedFigure(place.district, fy, month.key,
                                  column.col, column.typeId);
        if (cell.value === have) { out.unchanged += 1; return; }

        if (!cell.value) out.cleared += 1;
        out.edits[editKey(place.district, month.key, column.col, column.typeId)] =
          cell.value;
        out.districts[place.district] = true;
      });
    });

    return out;
  }

  function escapeNothing(text) {
    return String(text || "that column").trim() || "that column";
  }

  function importStockFile(file) {
    if (!canSetStock() || !file) return;

    var reader = new FileReader();
    reader.onerror = function () {
      showImportResult(null, "That file could not be read.");
    };
    reader.onload = function () {
      var fy = Number(el.stockYear.value) || fyStartOf(new Date());
      var was = countPendingEdits();
      var result;
      try {
        result = readStockImport(String(reader.result || ""), fy);
      } catch (err) {
        showImportResult(null, "That file could not be read: " + messageOf(err));
        return;
      }

      var count = Object.keys(result.edits).length;
      if (count) {
        pendingEdits = result.edits;

        /* Everything about to be saved has to be on screen, so a file that
           reaches past the filters opens them. */
        var hidden = Object.keys(result.districts).filter(function (d) {
          return !visibleStockPlaces().some(function (p) { return p.district === d; });
        });
        if (hidden.length) {
          el.stockState.value = ""; el.stockDivision.value = "";
          el.stockDistrict.value = "";
          stockFiltersFor(null);
          result.opened = hidden.length;
        }
        stockShown = true;
      }

      result.replaced = count && was ? was : 0;
      showStockEditError("");
      renderStock();
      showImportResult(result, null);
    };
    reader.readAsText(file);
  }

  function showImportResult(result, failure) {
    var lines = [];
    var sub;

    if (failure) {
      sub = "Nothing was changed.";
      lines.push('<p class="import-bad">' + escapeHtml(failure) + "</p>");
    } else {
      var count = Object.keys(result.edits).length;
      var districts = Object.keys(result.districts).length;

      sub = count
        ? (count === 1 ? "One figure is" : count + " figures are") +
          " waiting in the sheet across " +
          (districts === 1 ? "one district" : districts + " districts") +
          ". Nothing is saved until you press Save changes."
        : "Nothing in the file is different from what is already recorded.";

      var said = [];
      said.push(result.rows + (result.rows === 1 ? " line read" : " lines read"));
      if (result.unchanged) {
        said.push(result.unchanged + " already matching");
      }
      // A nought written in on purpose, which is the only thing that clears.
      if (result.cleared) {
        said.push(result.cleared +
          (result.cleared === 1 ? " figure set to nothing"
                                : " figures set to nothing"));
      }
      if (result.replaced) {
        said.push(result.replaced +
          (result.replaced === 1 ? " unsaved figure replaced"
                                 : " unsaved figures replaced"));
      }
      if (result.opened) {
        said.push("filters cleared to show " + result.opened +
          (result.opened === 1 ? " district" : " districts") + " the file reaches");
      }
      lines.push('<p class="import-said">' + escapeHtml(said.join(" \u00b7 ")) + "</p>");

      var trouble = count ? negativeAfterImport() : null;
      if (trouble) {
        lines.push('<p class="import-bad">' + escapeHtml(trouble) + "</p>");
      }

      if (result.problems.length) {
        lines.push("<h4>" + (result.problems.length === 1
          ? "One line was left out"
          : result.problems.length + " lines were left out") + "</h4>");
        lines.push('<ul class="import-problems">' +
          result.problems.slice(0, 50).map(function (p) {
            return "<li><b>" + (p.line ? "Line " + p.line : "The file") +
                   "</b> " + escapeHtml(p.why) + "</li>";
          }).join("") +
          (result.problems.length > 50
            ? "<li><b>and " + (result.problems.length - 50) + " more</b></li>"
            : "") +
          "</ul>");
      }
    }

    el.importSub.textContent = sub;
    el.importBody.innerHTML = lines.join("");

    returnFocusTo = document.activeElement;
    el.importModal.classList.add("is-open");
    document.addEventListener("keydown", onImportKeydown);
    scrollLockedAt = window.scrollY;
    document.body.style.overflow = "hidden";
    el.importModal.querySelector("[data-aw-close-import]").focus();
  }

  // Said here as well as on Save, so it is known before the file is trusted.
  function negativeAfterImport() {
    var fy = Number(el.stockYear.value) || fyStartOf(new Date());
    var moves = pendingMovements(fy);
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
    if (!trouble) return "";

    var type = awardTypes.filter(function (a) {
      return Number(a.id) === trouble.bad.award_type_id;
    })[0] || {};
    return "Saving these would leave " + trouble.district + " holding " +
           trouble.bad.short + " fewer " + (type.name || "of that award") +
           " than nothing by " + trouble.bad.month + ". Put that right in the " +
           "sheet before saving.";
  }

  function closeImportResult() {
    el.importModal.classList.remove("is-open");
    document.removeEventListener("keydown", onImportKeydown);
    document.body.style.overflow = "";
    if (scrollLockedAt !== null) {
      window.scrollTo(0, scrollLockedAt);
      scrollLockedAt = null;
    }
    if (returnFocusTo && typeof returnFocusTo.focus === "function") returnFocusTo.focus();
  }

  function onImportKeydown(event) {
    if (event.key === "Escape") closeImportResult();
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
    var none = function () {
      return { requisition: {}, delivery: {}, utilisation: {}, other: {} };
    };

    var entries = [];

    /* A requisition and the delivery it turned into are one line, not two:
       what was asked for sits beside what actually came, so a part-filled
       one reads as sixteen asked and fifteen arrived rather than as two rows
       to be matched up by eye.

       One raised in a month and received in another belongs to both,
       carrying only the half that happened in each. */
    allRequisitions.filter(mine).forEach(function (row) {
      var raisedHere = inMonth(monthKeyOf(row.created_at));
      var cameHere = stageOf(row) === "received" &&
                     inMonth(monthKeyOf(row.received_at));
      if (!raisedHere && !cameHere) return;

      var cells = none();
      if (raisedHere) cells.requisition = quantitiesOf(row, "items");
      if (cameHere) cells.delivery = quantitiesOf(row, "dispatched");

      entries.push({
        sort: 0,
        at: raisedHere ? row.created_at : row.received_at,
        what: raisedHere ? "Requisition" : "Delivery",
        when: formatTimestamp(raisedHere ? row.created_at : row.received_at),
        who: row.requester_name || "",
        note: raisedHere ? stageLabel(row, false)
                         : "raised " + formatTimestamp(row.created_at),
        levels: raisedHere
          ? awardsOf(row).map(function (a) {
              return { label: awardChipLabel(a), qty: a.quantity };
            })
          : [],
        cells: cells
      });
    });

    // Utilisation and figures typed in stand on their own: no requisition
    // lies behind them.
    stockMovements.filter(mine).forEach(function (m) {
      if (!inMonth(monthKeyOf(m.occurred_on))) return;
      var kind = MOVEMENT_KINDS[m.kind] || MOVEMENT_KINDS.adjustment;
      var cells = none();
      cells[kind.column][Number(m.award_type_id)] = Number(m.quantity) || 0;

      /* A movement is stamped to a month, not to a minute: occurred_on is
         the first of it. Showing a clock time there invents one. */
      entries.push({
        sort: m.kind === "utilised" ? 1 : 2,
        at: m.occurred_on,
        what: m.kind === "utilised" ? "Utilisation" : "Entered by hand",
        when: monthLabelOf(monthKeyOf(m.occurred_on)),
        who: m.recorded_by || "",
        note: m.note || "",
        cells: cells
      });
    });

    /* Requisitions first, then what was given out, then anything typed in -
       the way the sheet reads across. By date inside each, which is as far
       as the clock can be trusted: a utilisation is recorded against a month
       rather than a day. */
    return entries.sort(function (a, b) {
      return (a.sort - b.sort) || String(a.at).localeCompare(String(b.at));
    });
  }

  // "4 requisitions and 2 utilisations", in the order the lines come.
  function countsPhrase(entries) {
    var order = [];
    var count = {};
    entries.forEach(function (e) {
      if (!count[e.what]) { count[e.what] = 0; order.push(e.what); }
      count[e.what] += 1;
    });

    var parts = order.map(function (what) {
      var n = count[what];
      var name = what.toLowerCase();
      var plural = n === 1 || name === "entered by hand" ? name : name + "s";
      return n + " " + plural;
    });
    if (parts.length === 1) return parts[0];
    return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
  }

  function openBreakdown(district, monthKey) {
    var fy = Number(el.stockYear.value) || fyStartOf(new Date());
    var entries = monthBreakdown(district, monthKey, fy);
    var types = awardTypes;
    var left = balanceOn(district, fy, monthKey);

    returnFocusTo = document.activeElement;
    el.detailHeading.textContent = district + " \u00b7 " +
      (monthKey ? monthLabelOf(monthKey) : "Before " + fyLabel(fy));

    el.detailSub.textContent = entries.length
      ? countsPhrase(entries) + " behind this month. The last line is the " +
        "month itself, as the sheet shows it."
      : "Nothing was recorded against this month.";

    /* The same table, for one month. Each thing that happened takes a row,
       its figures sitting under the group they belong to; the balance walks
       down beside them, so a row says what the district was holding once
       that had happened. The last row is the month itself - the very row
       that was clicked to get here. */
    var totals = { requisition: {}, delivery: {}, utilisation: {}, other: {} };

    /* A line touches one group, or two when a requisition and the delivery
       it turned into sit together. The groups it does not touch are left
       empty rather than filled with a row of dashes, so the eye goes
       straight to the figures that are there. */
    var group = function (map, kind) {
      return Object.keys(map).length
        ? cellsHtml(map, types, kind, {}, false)
        : '<td class="num col-' + kind + ' is-blank" colspan="' +
          (types.length + 1) + '"></td>';
    };

    var body = entries.map(function (e) {
      Object.keys(totals).forEach(function (column) {
        addInto(totals[column], e.cells[column]);
      });

      return '<tr class="detail-line">' +
        '<td class="detail-what"><b>' + escapeHtml(e.what) + "</b>" +
          (e.who ? "<span>" + escapeHtml(e.who) + "</span>" : "") +
          "<time>" + escapeHtml(e.when) + "</time>" +
          (e.note ? "<em>" + escapeHtml(e.note) + "</em>" : "") +
          (e.levels && e.levels.length
            ? '<ul class="detail-levels">' + e.levels.map(function (l) {
                return "<li>" + escapeHtml(l.label) + "<b>" +
                       escapeHtml(Number(l.qty).toLocaleString()) + "</b></li>";
              }).join("") + "</ul>"
            : "") +
        "</td>" +
        group(e.cells.requisition, "req") +
        group(e.cells.delivery, "del") +
        group(e.cells.utilisation, "use") +
        group({}, "bal") +
      "</tr>";
    }).join("");

    body += '<tr class="detail-line is-final">' +
      '<td class="detail-what"><b>' +
        escapeHtml(monthKey ? monthLabelOf(monthKey) : "Carried into " + fyLabel(fy)) +
      "</b><time>the row this came from</time></td>" +
      cellsHtml(totals.requisition, types, "req", {}, false) +
      cellsHtml(totals.delivery, types, "del", {}, false) +
      cellsHtml(totals.utilisation, types, "use", {}, false) +
      cellsHtml(left, types, "bal", {}, false) +
    "</tr>";

    el.detailBody.innerHTML = entries.length
      ? '<div class="table-scroll"><table id="detail-table">' +
        groupHeadHtml(types, { before: '<th rowspan="2" class="detail-what">What</th>' }) +
        "<tbody>" + body + "</tbody></table></div>"
      : '<p class="aw-empty-line">Nothing was recorded against this month. ' +
        "The figures beside it are what carried in from before.</p>";

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
             "<label>" + escapeHtml(levelLabel(t.name, t.code)) +
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
