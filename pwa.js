/* Install as an app: registers the offline page's service worker and offers an
   "Install" card on phones and tablets, once the person has signed in.
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
  var KEY = "olf-install-card-hidden-until";
  var DAYS = 14;
  var deferred = null;
  var card = null;

  function standalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  }
  function hiddenForNow() {
    try { return Number(localStorage.getItem(KEY) || 0) > Date.now(); } catch (e) { return false; }
  }
  function hideFor(days) {
    try { localStorage.setItem(KEY, String(Date.now() + days * 86400000)); } catch (e) { /* private mode: it may show again, which is fine */ }
  }
  var isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var smallScreen = function () { return window.matchMedia && window.matchMedia("(max-width: 900px)").matches; };

  function signedIn() {
    var shell = document.getElementById("appShell");
    return !!(shell && shell.offsetParent !== null && getComputedStyle(shell).visibility !== "hidden");
  }

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

  function hideCard(days) {
    if (card) { card.remove(); card = null; }
    if (days) hideFor(days);
  }

  function showCard() {
    if (card || standalone() || hiddenForNow() || !smallScreen() || !signedIn()) return;
    if (!deferred && !isIos) return;                          // nothing to offer on this browser
    css();
    card = document.createElement("div");
    card.className = "olf-install";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "Install OLF Staff Connect");
    var sub = deferred ? "Add it to your home screen. It opens full screen, like an app."
                       : "Tap Share, then Add to Home Screen.";
    card.innerHTML =
      '<img src="/icon-192.png" alt="" width="44" height="44">' +
      '<div class="olf-install-text"><div class="olf-install-title">Install OLF Staff Connect</div><div class="olf-install-sub">' + sub + "</div></div>" +
      (deferred ? '<button type="button" class="olf-install-go">Install</button>' : "") +
      '<button type="button" class="olf-install-x" aria-label="Not now">✕</button>';
    card.querySelector(".olf-install-x").addEventListener("click", function () { hideCard(DAYS); });
    var go = card.querySelector(".olf-install-go");
    if (go) go.addEventListener("click", function () {
      var ev = deferred;
      deferred = null;
      hideCard(0);
      if (ev) { ev.prompt(); ev.userChoice.then(function (c) { if (c && c.outcome !== "accepted") hideFor(DAYS); }); }
    });
    document.body.appendChild(card);
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();                                       // we show our own card
    deferred = e;
    setTimeout(showCard, 3000);
  });
  window.addEventListener("appinstalled", function () { deferred = null; hideCard(365); });

  // iPhone has no install event, and every browser may not have signed in yet: look a few times.
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    showCard();
    if (card || tries > 20 || standalone()) clearInterval(timer);
  }, 2500);
})();
