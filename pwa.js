/* Install as an app: registers the offline page's service worker and shows an
   "Install" card at the bottom on phones and tablets, every time the site is
   opened in the browser, until the app is installed. Closing the card hides it for
   that visit only. Once installed, the app opens on its own and no card shows; if it is
   uninstalled, the browser offers the install again and the card comes back.
   Android (Chrome) installs with one tap. iPhone has no install prompt, so the
   card there says how: Share, then Add to Home Screen. */
(function () {
  "use strict";

  /* ---- the service worker (HTTPS or localhost only) ---------------------- */
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function (err) { console.warn("Service worker not registered:", err); });
    });
  }

  /* ---- the install card -------------------------------------------------- */
  var KEY = "olf-install-card-closed-this-visit";
  var deferred = null;
  var card = null;

  function standalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  }
  // Closed by the person for this visit only; the next time the site is opened it is back.
  function closedThisVisit() {
    try { return sessionStorage.getItem(KEY) === "1"; } catch (e) { return false; }
  }
  function closeThisVisit() {
    try { sessionStorage.setItem(KEY, "1"); } catch (e) { /* fine: it simply may show again */ }
  }
  var isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var smallScreen = function () { return window.matchMedia && window.matchMedia("(max-width: 900px)").matches; };

  function css() {
    if (document.getElementById("olf-install-css")) return;
    var s = document.createElement("style");
    s.id = "olf-install-css";
    s.textContent =
      ".olf-install{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0));z-index:1100;max-width:440px;margin:0 auto;" +
      "display:flex;align-items:center;gap:12px;padding:12px 12px 12px 14px;border-radius:18px;background:var(--surface,#fff);color:var(--text,#0F172A);" +
      "border:1px solid var(--hairline,rgba(15,23,42,.1));box-shadow:0 14px 40px rgba(15,23,42,.25);animation:olf-install-up .35s cubic-bezier(.22,1,.36,1)}" +
      "@keyframes olf-install-up{from{transform:translateY(24px);opacity:0}}" +
      ".olf-install img{width:44px;height:44px;border-radius:12px;flex:none}" +
      ".olf-install-text{flex:1;min-width:0}" +
      ".olf-install-title{font-size:14.5px;font-weight:800;letter-spacing:-.2px;line-height:1.25}" +
      ".olf-install-sub{margin-top:2px;font-size:12.5px;line-height:1.4;color:var(--text-soft,#64748B)}" +
      ".olf-install-go{flex:none;min-height:40px;padding:0 16px;border:0;border-radius:12px;font:inherit;font-size:14px;font-weight:700;color:#fff;cursor:pointer;" +
      "background:linear-gradient(135deg,#2F6FE4,#0B8F7A)}" +
      ".olf-install-x{flex:none;width:34px;height:34px;border:0;border-radius:50%;font-size:15px;cursor:pointer;background:rgba(100,116,139,.14);color:inherit}" +
      "@media (prefers-reduced-motion:reduce){.olf-install{animation:none}}";
    document.head.appendChild(s);
  }

  function hideCard() {
    if (card) { card.remove(); card = null; }
  }

  function showCard() {
    if (card || standalone() || closedThisVisit() || !smallScreen()) return;
    if (!deferred && !isIos) return;                          // nothing to offer on this browser
    css();
    card = document.createElement("div");
    card.className = "olf-install";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "Install OLF Staff Connect");
    var sub = deferred ? "Add it to your home screen. It opens full screen, like an app."
                       : "Tap Share, then Add to Home Screen.";
    card.innerHTML =
      '<img src="/icon-192.png?v=2" alt="" width="44" height="44">' +
      '<div class="olf-install-text"><div class="olf-install-title">Install OLF Staff Connect</div><div class="olf-install-sub">' + sub + "</div></div>" +
      (deferred ? '<button type="button" class="olf-install-go">Install</button>' : "") +
      '<button type="button" class="olf-install-x" aria-label="Not now">✕</button>';
    card.querySelector(".olf-install-x").addEventListener("click", function () { closeThisVisit(); hideCard(); });
    var go = card.querySelector(".olf-install-go");
    if (go) go.addEventListener("click", function () {
      var ev = deferred;
      deferred = null;
      hideCard();
      if (ev) {
        ev.prompt();
        // Not installed after all: offer it again, on this page, a moment later.
        ev.userChoice.then(function (c) { if (c && c.outcome !== "accepted") { deferred = ev; setTimeout(showCard, 4000); } });
      }
    });
    document.body.appendChild(card);
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();                                       // we show our own card
    deferred = e;
    setTimeout(showCard, 1500);
  });
  window.addEventListener("appinstalled", function () { deferred = null; hideCard(); });

  // iPhone has no install event: show its how-to card shortly after the page opens.
  if (isIos) setTimeout(showCard, 1500);
})();
