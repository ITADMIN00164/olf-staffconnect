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
    panels: {
      requisitions: document.getElementById("aw-panel-requisitions"),
      stock: document.getElementById("aw-panel-stock")
    },
    modal: document.getElementById("requisition-modal"),
    newReqBtn: document.getElementById("new-req-btn"),
    listBanner: document.getElementById("list-banner"),
    listBannerText: document.getElementById("list-banner-text"),
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
    returnFocusTo = null;          // the node it pointed at is gone
    showSignedInUser();
    showTab("requisitions");

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

  function showTab(name) {
    Array.prototype.forEach.call(el.tabs, function (tab) {
      var on = tab.getAttribute("data-aw-tab") === name;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
      // Only the selected tab is in the tab order; the arrow keys move
      // between them, which is how a tablist is meant to behave.
      tab.tabIndex = on ? 0 : -1;
    });
    Object.keys(el.panels).forEach(function (key) {
      if (el.panels[key]) el.panels[key].hidden = key !== name;
    });
  }

  // ----------------------------------------------------------- the dialog

  // Where focus was before the dialog opened, to put it back afterwards.
  var returnFocusTo = null;

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

    // Straight to the first thing that still needs choosing.
    var first = el.state.value ? (el.awardType.value ? el.quantity : el.awardType) : el.state;
    if (first && typeof first.focus === "function") first.focus();
  }

  function closeRequisitionModal() {
    el.modal.classList.remove("is-open");
    document.removeEventListener("keydown", onModalKeydown);
    if (returnFocusTo && typeof returnFocusTo.focus === "function") returnFocusTo.focus();
    returnFocusTo = null;
  }

  function onModalKeydown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();      // the shell closes its own popups on Escape
      closeRequisitionModal();
    }
  }

  function showListBanner(message) {
    if (!el.listBanner) return;
    el.listBannerText.textContent = message;
    el.listBanner.hidden = false;
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

    Array.prototype.forEach.call(el.tabs, function (tab) {
      tab.addEventListener("click", function () {
        showTab(tab.getAttribute("data-aw-tab"));
      });
      tab.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        var list = Array.prototype.slice.call(el.tabs);
        var next = list[(list.indexOf(tab) + (event.key === "ArrowRight" ? 1 : -1) +
                         list.length) % list.length];
        showTab(next.getAttribute("data-aw-tab"));
        next.focus();
        event.preventDefault();
      });
    });

    el.newReqBtn.addEventListener("click", openRequisitionModal);

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
    var search = el.filterSearch.value.trim().toLowerCase();

    var rows = allRequisitions.filter(function (row) {
      var p = placeOf(row);
      if (stateFilter && p.state !== stateFilter) return false;
      if (divisionFilter && p.division !== divisionFilter) return false;
      if (districtFilter && p.district !== districtFilter) return false;
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
