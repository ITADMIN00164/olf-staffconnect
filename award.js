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
    requesterMail: document.getElementById("requester-mail"),
    requesterInitials: document.getElementById("requester-initials"),
    quantity: document.getElementById("quantity"),
    reqDate: document.getElementById("req-date"),
    submitBtn: document.getElementById("submit-btn"),
    resetBtn: document.getElementById("reset-btn"),
    formBanner: document.getElementById("form-banner"),
    formBannerIcon: document.getElementById("form-banner-icon"),
    formBannerText: document.getElementById("form-banner-text"),

    refreshBtn: document.getElementById("refresh-btn"),
    filterState: document.getElementById("filter-state"),
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

    if (!name && mail) name = mail.split("@")[0];
    return name ? { name: name, email: mail } : null;
  }

  function initialsOf(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function showSignedInUser() {
    var who = signedInUser();
    if (!el.requesterName) return;

    if (!who) {
      el.requesterName.textContent = "Not signed in";
      el.requesterMail.textContent = "";
      el.requesterInitials.textContent = "?";
      return;
    }
    el.requesterName.textContent = who.name;
    el.requesterMail.textContent = who.email || "";
    el.requesterInitials.textContent = initialsOf(who.name);
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
    ["state", "district", "award-type", "requester", "quantity", "req-date"]
      .forEach(function (id) {
        var node = document.getElementById(id + "-error");
        if (node) node.textContent = "";
        var input = document.getElementById(id);
        if (input) input.classList.remove("invalid");
      });
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
    el.tbody.innerHTML =
      '<tr class="placeholder-row"><td colspan="7">' +
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
    showSignedInUser();

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
    loadStates();
    loadAwardTypes();
    loadRequisitions();
  }

  function disableForm() {
    Array.prototype.forEach.call(
      el.form.querySelectorAll("input, select, button"),
      function (node) { node.disabled = true; }
    );
  }

  function wireEvents() {
    // The shell rebuilds this fragment on every visit, so normally these bind
    // once per fresh set of nodes. The guard is for the case where mount() is
    // called twice against the same DOM: a second submit listener would insert
    // the requisition twice, and this log cannot be edited or deleted.
    if (el.form.dataset.awWired === "1") return;
    el.form.dataset.awWired = "1";

    el.state.addEventListener("change", function () {
      setFieldError(el.state, "state-error", "");
      loadDistricts(el.state.value);
    });

    el.form.addEventListener("submit", onSubmit);

    el.resetBtn.addEventListener("click", function () {
      // Runs before the browser's own reset, so restore defaults after it.
      window.setTimeout(function () {
        clearFieldErrors();
        setFormStatus("");
        el.reqDate.value = todayLocalISO();
        el.district.innerHTML = '<option value="">Select a state first</option>';
        el.district.disabled = true;
      }, 0);
    });

    el.refreshBtn.addEventListener("click", function () { loadRequisitions(); });

    el.filterState.addEventListener("change", function () {
      el.filterDistrict.value = "";
      renderTable();
    });
    el.filterDistrict.addEventListener("change", renderTable);
    el.filterType.addEventListener("change", renderTable);
    el.filterSearch.addEventListener("input", renderTable);
  }

  // -------------------------------------------------------- reference data

  function loadStates() {
    db.from("states").select("id, code, name").order("name")
      .then(function (res) {
        if (res.error) {
          el.state.innerHTML = '<option value="">Could not load states</option>';
          reportError("load states", res.error);
          return;
        }
        var states = res.data || [];
        fillSelect(el.state, states, "Select state",
          function (s) { return s.id; },
          function (s) { return s.name + " (" + s.code + ")"; });

        // Only one state seeded? Pick it and load its districts straight away.
        if (states.length === 1) {
          el.state.value = String(states[0].id);
          loadDistricts(el.state.value);
        }
      })
      .catch(function (err) {
        el.state.innerHTML = '<option value="">Could not load states</option>';
        reportError("load states", err);
      });
  }

  function loadDistricts(stateId) {
    if (!stateId) {
      el.district.innerHTML = '<option value="">Select a state first</option>';
      el.district.disabled = true;
      return;
    }

    el.district.disabled = true;
    el.district.innerHTML = '<option value="">Loading…</option>';

    db.from("districts").select("id, name")
      .eq("state_id", Number(stateId)).order("name")
      .then(function (res) {
        if (res.error) {
          el.district.innerHTML = '<option value="">Could not load districts</option>';
          reportError("load districts", res.error);
          return;
        }
        fillSelect(el.district, res.data || [], "Select district",
          function (d) { return d.id; },
          function (d) { return d.name; });
        el.district.disabled = false;
      })
      .catch(function (err) {
        el.district.innerHTML = '<option value="">Could not load districts</option>';
        reportError("load districts", err);
      });
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

    var values = {
      state_id: el.state.value ? Number(el.state.value) : null,
      district_id: el.district.value ? Number(el.district.value) : null,
      award_type_id: el.awardType.value ? Number(el.awardType.value) : null,
      requester_name: (signedInUser() || {}).name || "",
      quantity: el.quantity.value.trim(),
      requisition_date: el.reqDate.value,
    };

    var ok = true;

    if (!values.state_id) {
      setFieldError(el.state, "state-error", "Select a state."); ok = false;
    }
    if (!values.district_id) {
      setFieldError(el.district, "district-error", "Select a district."); ok = false;
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
          setFormStatus("Could not save: " + res.error.message, "bad");
          reportError("save requisition", res.error);
          return;
        }

        setFormStatus(
          "Saved — " + values.quantity + " " + selectedText(el.awardType) +
          " for " + selectedText(el.district) + ".",
          "ok"
        );

        // Keep state, district and date — entries usually come in batches for
        // the same place. Clear only what changes per row.
        el.awardType.value = "";
        el.quantity.value = "";
        el.quantity.focus();

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

  function loadRequisitions() {
    el.refreshBtn.disabled = true;

    db.from("requisitions")
      .select("id, requester_name, quantity, requisition_date, status, created_at," +
              " states ( code, name ), districts ( name ), award_types ( code, name )")
      .order("created_at", { ascending: false })
      .limit(500)
      .then(function (res) {
        el.refreshBtn.disabled = false;

        if (res.error) {
          placeholderRow("Could not load requisitions: " + res.error.message);
          reportError("load requisitions", res.error);
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

  // Filter dropdowns list only values that actually appear in the loaded rows.
  function buildFilterOptions() {
    var states = {}, districts = {}, types = {};

    allRequisitions.forEach(function (row) {
      if (row.states) states[row.states.name] = row.states.code;
      if (row.districts) districts[row.districts.name] = true;
      if (row.award_types) types[row.award_types.name] = true;
    });

    fillSelect(el.filterState, Object.keys(states).sort(), "All states",
      function (name) { return name; },
      function (name) { return name + " (" + states[name] + ")"; });

    fillSelect(el.filterDistrict, Object.keys(districts).sort(), "All districts",
      function (name) { return name; }, function (name) { return name; });

    fillSelect(el.filterType, Object.keys(types).sort(), "All types",
      function (name) { return name; }, function (name) { return name; });
  }

  function renderTable() {
    var stateFilter = el.filterState.value;
    var districtFilter = el.filterDistrict.value;
    var typeFilter = el.filterType.value;
    var search = el.filterSearch.value.trim().toLowerCase();

    var rows = allRequisitions.filter(function (row) {
      if (stateFilter && (!row.states || row.states.name !== stateFilter)) return false;
      if (districtFilter && (!row.districts || row.districts.name !== districtFilter)) return false;
      if (typeFilter && (!row.award_types || row.award_types.name !== typeFilter)) return false;
      if (search && String(row.requester_name || "").toLowerCase().indexOf(search) === -1) return false;
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
      var stateCode = row.states ? row.states.code : "?";
      var stateName = row.states ? row.states.name : "Unknown state";
      var district = row.districts ? row.districts.name : "—";
      var typeName = row.award_types ? row.award_types.name : "—";

      html +=
        "<tr>" +
          '<td><span class="state-code" title="' + escapeHtml(stateName) + '">' +
            escapeHtml(stateCode) + "</span></td>" +
          "<td>" + escapeHtml(district) + "</td>" +
          "<td>" + escapeHtml(row.requester_name) + "</td>" +
          '<td><span class="type-chip">' + escapeHtml(typeName) + "</span></td>" +
          '<td class="num">' + escapeHtml(row.quantity) + "</td>" +
          '<td class="cell-date">' + escapeHtml(formatDate(row.requisition_date)) + "</td>" +
          '<td class="cell-date muted">' + escapeHtml(formatTimestamp(row.created_at)) + "</td>" +
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
          ? "The tables are not there yet — run <code>supabase/schema.sql</code> " +
            "and then <code>supabase/seed.sql</code> in the Supabase SQL Editor, " +
            "then reload."
          : "Check that the config block at the top of <code>app.js</code> holds " +
            "the right Project URL and " +
            "publishable key, and that <code>supabase/schema.sql</code> and " +
            "<code>supabase/seed.sql</code> have both been run in the SQL Editor."),
        missingTable ? "Database tables are missing." : "Could not reach the database."
      );
    }
  }

  // The shell decides when this page exists; it calls mount() after the
  // fragment is in the DOM.
  window.AwardManagement = { mount: mount };
})();
