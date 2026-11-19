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
      ".olf-guide{position:fixed;inset:0;z-index:2200;display:flex;align-items:flex-end;justify-content:center;background:rgba(8,12,24,.55);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);animation:olf-fade .25s ease both}" +
      ".olf-guide-sheet{position:relative;width:100%;max-width:480px;padding:22px 20px calc(86px + env(safe-area-inset-bottom,0));border-radius:26px 26px 0 0;background:var(--surface,#fff);color:var(--text,#0F172A);box-shadow:0 -20px 60px rgba(0,0,0,.35);animation:olf-sheet .45s cubic-bezier(.22,1,.36,1) both}" +
      ".olf-guide-head{display:flex;align-items:center;gap:12px;margin-bottom:16px}.olf-guide-head img{width:46px;height:46px;border-radius:13px;flex:none}" +
      ".olf-guide-head b{display:block;font-size:17px;letter-spacing:-.3px}.olf-guide-head span{display:block;margin-top:2px;font-size:13px;color:var(--text-soft,#64748B)}" +
      ".olf-guide ol{list-style:none;margin:0 0 16px;padding:0;display:flex;flex-direction:column;gap:10px}" +
      ".olf-guide li{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:rgba(100,116,139,.09);font-size:15px;font-weight:700}" +
      ".olf-guide li i{flex:none;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-size:13px;color:#fff;background:linear-gradient(135deg,#2F6FE4,#0B8F7A)}" +
      ".olf-guide li svg{margin-left:auto;width:22px;height:22px;flex:none;color:#2F6FE4;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
      ".olf-guide-ok{width:100%;min-height:52px;border:0;border-radius:16px;font:inherit;font-size:15px;font-weight:800;color:#fff;cursor:pointer;background:linear-gradient(135deg,#3B82F6,#2457C5);box-shadow:0 10px 22px rgba(47,111,228,.4)}" +
      ".olf-guide-arrow{position:absolute;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0));transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:2px;font-size:12px;font-weight:700;color:#2F6FE4;animation:olf-bob 1.2s ease-in-out infinite}" +
      ".olf-guide-arrow svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}" +
      "@keyframes olf-fade{from{opacity:0}}@keyframes olf-sheet{from{transform:translateY(100%)}}@keyframes olf-bob{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,6px)}}" +
      "@media (prefers-reduced-motion:reduce){.olf-install,.olf-guide,.olf-guide-sheet,.olf-guide-arrow{animation:none}}";
    document.head.appendChild(s);
  }

  function hideCard() {
    if (card) { card.remove(); card = null; }
  }

  // The browser's own install dialog. It can be used once per offer; if it is cancelled the
  // browser offers again later, and the banner and the button come back with it.
  function install() {
    var ev = deferred;
    if (!ev) return false;
    deferred = null;
    hideCard();
    syncTopButton();
    try { ev.prompt(); } catch (e) { return false; }
    ev.userChoice.then(function (c) {
      if (!c || c.outcome !== "accepted") { deferred = ev; syncTopButton(); setTimeout(showCard, 4000); }
    });
    return true;
  }

  function showCard(force) {
    if (card || standalone()) return;
    if (force !== true && (closedThisVisit() || !smallScreen())) return;
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
      (deferred ? '<button type="button" class="olf-install-go">Install</button>' : '<button type="button" class="olf-install-go olf-show-how">Show me</button>') +
      '<button type="button" class="olf-install-x" aria-label="Not now">✕</button>';
    card.querySelector(".olf-install-x").addEventListener("click", function () { closeThisVisit(); hideCard(); });
    var go = card.querySelector(".olf-install-go");
    if (go) go.addEventListener("click", function () { if (deferred) install(); else { hideCard(); showGuide(); } });
    document.body.appendChild(card);
  }

  /* iPhone cannot install an app by itself, so the app shows its own short guide: the last taps are
     on the iPhone's Share button, and the guide points at it. */
  var guide = null;
  function showGuide() {
    if (guide || standalone()) return;
    css();
    guide = document.createElement("div");
    guide.className = "olf-guide";
    guide.setAttribute("role", "dialog");
    guide.setAttribute("aria-label", "Install OLF Staff Connect");
    var ic = function (p) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + p + "</svg>"; };
    guide.innerHTML =
      '<div class="olf-guide-sheet">' +
        '<div class="olf-guide-head"><img src="/icon-192.png?v=2" alt="" width="46" height="46"><div><b>Install OLF Staff Connect</b><span>Three quick taps on your iPhone</span></div></div>' +
        "<ol>" +
          "<li><i>1</i>Tap the Share button" + ic('<path d="M12 15V4m0 0-4 4m4-4 4 4M6 11H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1"/>') + "</li>" +
          "<li><i>2</i>Choose Add to Home Screen" + ic('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>') + "</li>" +
          "<li><i>3</i>Tap Add" + ic('<path d="m5 12.5 4.5 4.5L19 7.500"/>') + "</li>" +
        "</ol>" +
        '<button type="button" class="olf-guide-ok">Got it</button>' +
        '<div class="olf-guide-arrow">Share is down here' + ic('<path d="M12 5v14m0 0-5-5m5 5 5-5"/>') + "</div>" +
      "</div>";
    function close() { if (guide && guide.parentNode) guide.parentNode.removeChild(guide); guide = null; }
    guide.addEventListener("click", function (e) { if (e.target === guide) close(); });
    guide.querySelector(".olf-guide-ok").addEventListener("click", close);
    document.body.appendChild(guide);
  }

  /* ---- the Install button in the top bar ------------------------------
     Shown whenever the site is open in a browser and the app can be installed;
     gone once it is installed (the installed app opens without it). */
  var topBtn = null;
  function topCss() {
    if (document.getElementById("olf-install-top-css")) return;
    var s = document.createElement("style");
    s.id = "olf-install-top-css";
    s.textContent =
      ".tb-install{position:relative;display:inline-flex;align-items:center;gap:9px;height:var(--tb-ctl,38px);padding:0 16px 0 5px;border:0;border-radius:999px;flex:none;overflow:hidden;isolation:isolate;" +
      "font:inherit;font-size:13px;font-weight:800;letter-spacing:-.1px;color:#fff;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent;" +
      "background:linear-gradient(135deg,#3B82F6 0%,#2F6FE4 38%,#0B8F7A 100%);box-shadow:0 8px 20px -4px rgba(47,111,228,.55),0 0 0 1px rgba(255,255,255,.18) inset,0 1px 0 rgba(255,255,255,.4) inset;transition:transform .18s cubic-bezier(.34,1.56,.64,1),box-shadow .2s ease,filter .2s ease}" +
      ".tb-install::before{content:'';position:absolute;top:0;bottom:0;left:-60%;width:38%;z-index:-1;transform:skewX(-20deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);animation:tb-shine 4s 1.5s ease-in-out infinite}" +
      ".tb-install .tb-ic{position:relative;flex:none;display:grid;place-items:center;width:calc(var(--tb-ctl,38px) - 10px);height:calc(var(--tb-ctl,38px) - 10px);border-radius:50%;background:rgba(255,255,255,.22);box-shadow:0 0 0 1px rgba(255,255,255,.38) inset}" +
      ".tb-install .tb-ic::after{content:'';position:absolute;inset:-3px;border-radius:50%;border:2px solid rgba(255,255,255,.55);opacity:0;animation:tb-ping 2.6s 2s ease-out infinite}" +
      ".tb-install:hover{transform:translateY(-1px) scale(1.03);filter:brightness(1.07);box-shadow:0 12px 26px -4px rgba(47,111,228,.65),0 0 0 1px rgba(255,255,255,.22) inset,0 1px 0 rgba(255,255,255,.45) inset}" +
      ".tb-install:active{transform:scale(.94)}" +
      ".tb-install:focus-visible{outline:3px solid rgba(79,142,247,.75);outline-offset:3px}" +
      ".tb-install svg{width:16px;height:16px;flex:none;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;animation:tb-dl 1.8s ease-in-out infinite}" +
      ".tb-install[hidden]{display:none}" +
      "@keyframes tb-shine{0%,60%{left:-60%}100%{left:140%}}@keyframes tb-ping{0%{transform:scale(.9);opacity:.7}100%{transform:scale(1.6);opacity:0}}@keyframes tb-dl{0%,100%{transform:translateY(-1px)}50%{transform:translateY(2px)}}" +
      "@media (max-width:768px){.tb-install{width:var(--tb-ctl,36px);padding:0;justify-content:center;gap:0}.tb-install span:not(.tb-ic){display:none}.tb-install .tb-ic{width:100%;height:100%;background:none;box-shadow:none}}" +
      "@media (prefers-reduced-motion:reduce){.tb-install::before,.tb-install .tb-ic::after,.tb-install svg{animation:none}}";
    document.head.appendChild(s);
  }
  function buildTopButton() {
    if (topBtn) return;
    var group = document.querySelector(".topbar .tp-group");
    if (!group) return;
    topCss();
    topBtn = document.createElement("button");
    topBtn.type = "button";
    topBtn.className = "tb-install";
    topBtn.hidden = true;
    topBtn.title = "Install OLF Staff Connect as an app";
    topBtn.setAttribute("aria-label", "Install app");
    topBtn.innerHTML = '<span class="tb-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v11m0 0 4-4m-4 4-4-4"/><path d="M4.5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3"/></svg></span><span>Install app</span>';
    topBtn.addEventListener("click", function () {
      if (!install()) { hideCard(); showGuide(); }              // iPhone: the app's own guide, since there is no install dialog
    });
    group.insertBefore(topBtn, group.querySelector(".tb-bell") || group.firstChild);
    syncTopButton();
  }
  function syncTopButton() {
    if (!topBtn) return;
    topBtn.hidden = standalone() || !(deferred || isIos) || !smallScreen();     // phones and tablets only, not desktop
  }
  if (window.matchMedia) {
    var mq = window.matchMedia("(max-width: 900px)");
    if (mq.addEventListener) mq.addEventListener("change", function () { syncTopButton(); });
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();                                       // we show our own card and button
    deferred = e;
    buildTopButton();
    syncTopButton();
    setTimeout(showCard, 1500);
  });
  window.addEventListener("appinstalled", function () { deferred = null; hideCard(); syncTopButton(); });

  // iPhone has no install event: show its how-to card shortly after the page opens.
  if (isIos) setTimeout(showCard, 1500);

  // The button lives in the top bar, which is part of the page from the start (shown after sign-in).
  buildTopButton();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildTopButton);
})();
