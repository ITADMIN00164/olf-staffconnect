/* "Get the app on your phone": a short walkthrough for people using the site on a computer.

   After sign-in (and again after each reload) a card plays an animated how-to - Android or iPhone,
   five steps - next to a QR code that opens the app on a phone.

   - The cross closes it for this visit only: it comes back after the next reload or sign-in.
   - "I have already installed it" stops it for good for that person on this browser.
   Only on a computer, and never inside the installed app itself. */
(function () {
  "use strict";
  var APP_URL = "https://olf-staff-connect-b1d54.web.app";
  var STEP_MS = 4200;
  var opened = false;

  function standalone() {
    return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  }
  function computer() { return !(window.matchMedia && matchMedia("(max-width: 900px)").matches); }
  function who() { var u = window.__olfUser; return u && u.email ? String(u.email).toLowerCase() : ""; }
  function key() { return "olf-phone-app-done:" + who(); }
  function isDone() { try { return localStorage.getItem(key()) === "1"; } catch (e) { return false; } }
  function setDone() { try { localStorage.setItem(key(), "1"); } catch (e) {} }

  /* ------------------------------------------------------------------ the five scenes, per phone */
  var LOGO = '<svg viewBox="0 0 64 64" width="100%" height="100%"><defs><linearGradient id="mpg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4F8EF7"/><stop offset="1" stop-color="#10B197"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#mpg)"/><circle cx="32" cy="32" r="14" fill="none" stroke="#fff" stroke-width="5.4"/><circle cx="32" cy="32" r="3.4" fill="#fff"/><g fill="#fff" stroke="#2A6FD6" stroke-opacity=".35" stroke-width="1.6"><circle cx="32" cy="18" r="5.4"/><circle cx="44.12" cy="39" r="5.4"/><circle cx="19.88" cy="39" r="5.4"/></g></svg>';
  var URL_TXT = "olf-staff-connect-b1d54.web.app";

  function page(top, bottom) {
    return '<div class="mp-page" style="top:' + top + 'px;bottom:' + bottom + 'px"><div class="mp-pl">' + LOGO + '</div><b>OLF Staff Connect</b><span>Sign in with your organisation account</span><em>Sign in with Google</em></div>';
  }
  function tap(x, y, at) { return '<i class="mp-tap" style="left:' + x + 'px;top:' + y + 'px;animation-delay:' + (at || 1.4) + 's"></i>'; }
  var DL = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v11m0 0 4-4m-4 4-4-4M5 19.5h14"/></svg>';
  /* the app itself, as it looks on a phone: its own top bar, with the Install icon next to the bell */
  function appTop(pulse) {
    return '<div class="mp-status"><b>9:41</b><s></s></div><div class="mp-at"><div class="mp-al">' + LOGO + '</div><b>OLF Staff Connect</b><span class="mp-ag"><i class="mp-ib"></i><i class="mp-ib mp-inst' + (pulse ? " mp-pulse" : "") + '">' + DL + '</i><i class="mp-ib"></i><i class="mp-av">IA</i></span></div>';
  }
  function appBody(bottom) {
    return '<div class="mp-body" style="bottom:' + (bottom || 0) + 'px"><div class="mp-hero"><p></p><p></p></div><div class="mp-row"></div><div class="mp-row"></div><div class="mp-row mp-row--s"></div></div>';
  }
  function appView(pulse, bottom) { return appTop(pulse) + appBody(bottom); }
  function iosBar() {
    var ic = function (p, hl) { return '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' + (hl ? ' class="mp-share"' : "") + '>' + p + '</svg>'; };
    return '<div class="mp-sf"><div class="mp-sf-ic">' + ic('<path d="m15 6-6 6 6 6"/>') + ic('<path d="m9 6 6 6-6 6"/>') + ic('<path d="M12 15V4m0 0-4 4m4-4 4 4M6 11H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1"/>', true) + ic('<path d="M5 4h11a2 2 0 0 1 2 2v14l-7.5-4L3 20V6a2 2 0 0 1 2-2z"/>') + ic('<rect x="4" y="4" width="13" height="13" rx="2"/><path d="M8 20h11a1 1 0 0 0 1-1V8"/>') + '</div></div>';
  }
  function home() {
    var cells = "";
    var cols = ["#E8710A", "#34A853", "#4285F4", "#9C27B0", "#EA4335", "#00ACC1", "#F9AB00", "#5F6368", "#8E24AA", "#43A047", "#039BE5"];
    for (var i = 0; i < 11; i++) cells += '<div class="mp-app"><div style="background:' + cols[i] + '"></div><u></u></div>';
    return '<div class="mp-home"><div class="mp-status"><b>9:41</b><s></s></div><div class="mp-grid">' + cells + '<div class="mp-app mp-new"><div class="mp-glow"></div><div class="mp-ico">' + LOGO + '</div><u>Staff Connect</u></div></div></div>';
  }
  /* the first scene: the sign-in page, then the app once you are in */
  function opening(bottom) {
    return appView(false, bottom) + '<div class="mp-over" style="animation-delay:2.1s">' + page(0, 0) + '</div>';
  }

  var SCENES = {
    android: [
      { t: "Open the app on your phone", d: "Scan the code on the right with your phone camera, or open the link, then sign in.",
        h: opening(0) },
      { t: "Tap the Install icon", d: "It is the blue download icon at the top of the app, next to the bell.",
        h: appView(true) + tap(145, 52, 1.3) },
      { t: "Tap Install", d: "Confirm the pop-up. That is all it takes.",
        h: appView(false) + '<div class="mp-dim"></div><div class="mp-dialog"><div class="mp-di">' + LOGO + '</div><b>Install app?</b><span>OLF Staff Connect</span><div class="mp-db"><p>Cancel</p><p class="mp-pri">Install</p></div></div>' + tap(172, 293, 1.5) },
      { t: "Find it on your home screen", d: "The OLF Staff Connect icon is now with your other apps.",
        h: home() },
      { t: "Open it like any other app", d: "It opens full screen, with no address bar, and keeps itself up to date.",
        h: appView(false) + '<div class="mp-over mp-over--splash" style="animation-delay:1.9s"><div class="mp-sp"><div class="mp-pl">' + LOGO + '</div><b>OLF Staff Connect</b></div></div>' }
    ],
    ios: [
      { t: "Open the app on your phone", d: "Scan the code on the right with your phone camera, or open the link, then sign in.",
        h: opening(52) + iosBar() },
      { t: "Tap the Install icon", d: "It is the blue download icon at the top of the app, next to the bell. The app shows you what to do.",
        h: appView(true, 52) + iosBar() + tap(149, 52, 1.3) },
      { t: "Follow the app's guide", d: "The app opens its own guide. Tap Share, the square with an arrow at the bottom of the screen.",
        h: appView(false, 52) + iosBar() + '<div class="mp-dim" style="bottom:52px"></div><div class="mp-gs"><div class="mp-gh"><div class="mp-di">' + LOGO + '</div><div><b>Install OLF Staff Connect</b><span>Three quick taps</span></div></div><ol><li><i>1</i>Tap the Share button</li><li><i>2</i>Choose Add to Home Screen</li><li><i>3</i>Tap Add</li></ol><em>Got it</em></div>' + tap(113, 440, 1.7) },
      { t: "Choose Add to Home Screen", d: "It is in the list that opens. Scroll down if you do not see it straight away.",
        h: appView(false, 52) + iosBar() + '<div class="mp-dim"></div><div class="mp-sheet"><div class="mp-sh"><div class="mp-di">' + LOGO + '</div><div><b>OLF Staff Connect</b><span>' + URL_TXT + '</span></div></div><p>Copy<em>&#9633;</em></p><p>Add to Bookmarks<em>&#9734;</em></p><p class="mp-hl" style="animation-delay:1.5s">Add to Home Screen<em>+</em></p><p>Add to Reading List<em>&#8734;</em></p></div>' + tap(113, 331, 1.5) },
      { t: "Open it from your home screen", d: "It opens full screen, like any other app, and keeps itself up to date.",
        h: home() }
    ]
  };

  /* ------------------------------------------------------------------ styling */
  function css() {
    if (document.getElementById("mp-css")) return;
    var s = document.createElement("style");
    s.id = "mp-css";
    s.textContent =
      "#mpRoot{position:fixed;inset:0;z-index:3500;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(8,12,24,.62);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);opacity:0;transition:opacity .35s ease}" +
      "#mpRoot.is-on{opacity:1}" +
      ".mp-card{position:relative;display:grid;grid-template-columns:minmax(300px,380px) minmax(0,1fr);grid-template-rows:minmax(0,1fr);width:min(960px,100%);max-height:calc(100dvh - 48px);overflow:hidden;border-radius:28px;background:var(--surface,#fff);color:var(--text,#0F172A);box-shadow:0 40px 90px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.14);transform:translateY(24px) scale(.97);transition:transform .5s cubic-bezier(.22,1,.36,1)}" +
      "#mpRoot.is-on .mp-card{transform:none}" +
      ".mp-x{position:absolute;top:14px;right:14px;z-index:5;display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 16px 0 13px;border:1px solid rgba(255,255,255,.2);border-radius:99px;cursor:pointer;font:inherit;font-size:13.5px;font-weight:800;color:#fff;background:linear-gradient(135deg,#334155,#0F172A);box-shadow:0 6px 16px rgba(15,23,42,.35);transition:transform .15s,box-shadow .15s,filter .15s}" +
      ".mp-x:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(15,23,42,.45);filter:brightness(1.15)}.mp-x:active{transform:scale(.96)}.mp-x:focus-visible{outline:3px solid rgba(79,142,247,.8);outline-offset:2px}" +
      ".mp-x svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.8;stroke-linecap:round}" +
      /* the film */
      ".mp-film{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:26px 20px 18px;background:radial-gradient(120% 90% at 30% 10%,#27407A 0%,#0F1522 70%);overflow:hidden}" +
      ".mp-film::before{content:'';position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.12) 1px,transparent 1.4px);background-size:22px 22px;-webkit-mask-image:radial-gradient(ellipse at center,#000 25%,transparent 75%);mask-image:radial-gradient(ellipse at center,#000 25%,transparent 75%)}" +
      ".mp-film{perspective:1300px}" +
      ".mp-3d{position:relative;width:236px;height:480px;flex:none;transform-style:preserve-3d}" +
      ".mp-phone,.mp-back{position:absolute;inset:0}" +
      ".mp-back{visibility:hidden}" +
      ".mp-intro .mp-back{visibility:visible;animation:mp-showback 2.5s linear both}.mp-intro .mp-phone{visibility:hidden;animation:mp-showfront 2.5s linear both}" +
      "@keyframes mp-showback{0%,61.5%{visibility:visible}61.6%,100%{visibility:hidden}}@keyframes mp-showfront{0%,61.5%{visibility:hidden}61.6%,100%{visibility:visible}}" +
      ".mp-back{transform:rotateY(180deg);overflow:hidden}" +
      ".mp-3d.mp-intro{animation:mp-flip 2.5s cubic-bezier(.4,.05,.2,1) both}" +
      "@keyframes mp-flip{0%{transform:rotateY(180deg) rotateZ(-10deg) rotateX(18deg) scale(.6) translateY(60px);opacity:0}16%{opacity:1}38%{transform:rotateY(180deg) rotateZ(-3deg) rotateX(6deg) scale(1) translateY(-6px)}50%{transform:rotateY(222deg) rotateZ(2deg) rotateX(2deg) scale(1.08) translateY(-14px)}61.5%{transform:rotateY(270deg) rotateZ(0deg) rotateX(0deg) scale(1.1) translateY(-16px)}82%{transform:rotateY(368deg) rotateZ(0deg) rotateX(0deg) scale(1.03) translateY(-2px)}100%{transform:rotateY(360deg) rotateZ(0deg) rotateX(0deg) scale(1) translateY(0)}}" +
      ".mp-3d::before{content:'';position:absolute;left:8%;right:8%;bottom:-26px;height:22px;border-radius:50%;background:radial-gradient(ellipse,rgba(0,0,0,.55),transparent 70%);filter:blur(5px);transform:translateZ(-40px)}" +
      ".mp-intro::before{animation:mp-gshadow 2.5s ease both}@keyframes mp-gshadow{0%{opacity:0;transform:scale(.5)}40%{opacity:.8;transform:scale(1)}62%{opacity:.4;transform:scale(.7)}100%{opacity:.8;transform:scale(1)}}" +
      ".mp-intro .mp-screen::before{content:'';position:absolute;inset:0;z-index:30;pointer-events:none;border-radius:inherit;background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.35) 50%,transparent 65%);background-size:260% 100%;animation:mp-sheen 1.2s 1.7s ease both}" +
      ".mp-back::after{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(115deg,transparent 32%,rgba(255,255,255,.32) 46%,transparent 60%);background-size:260% 100%;animation:mp-sheen 2.3s ease both}" +
      "@keyframes mp-sheen{from{background-position:130% 0}to{background-position:-30% 0}}" +
      /* Galaxy A35 back: a navy glass panel, three separate lenses in a column, flash beside them */
      ".mp-back--a35{border-radius:34px;background:linear-gradient(145deg,#33498f,#1a2a5e 38%,#0c1534);box-shadow:0 30px 60px rgba(0,0,0,.55),inset 0 0 0 1.5px rgba(150,175,255,.35)}" +
      ".mp-back--a35::before{content:'';position:absolute;inset:4px;border-radius:30px;background:linear-gradient(160deg,#2a4486 0%,#18295f 42%,#0d1838 100%);box-shadow:inset 0 0 22px rgba(120,150,255,.22),inset 0 1px 0 rgba(255,255,255,.18)}" +
      ".mp-lens{position:absolute;width:38px;height:38px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#3b4b7d 0,#090e20 46%,#000 72%);box-shadow:0 0 0 3px #0b1331,0 0 0 4.5px #9fb2e6,0 3px 8px rgba(0,0,0,.65)}" +
      ".mp-lens::after{content:'';position:absolute;inset:9px;border-radius:50%;background:radial-gradient(circle at 30% 28%,rgba(160,185,255,.85),rgba(60,30,120,.85) 48%,#000 76%)}" +
      ".mp-lens::before{content:'';position:absolute;left:11px;top:9px;width:7px;height:5px;border-radius:50%;background:rgba(255,255,255,.7);filter:blur(1px);z-index:1}" +
      ".mp-flashd{position:absolute;width:10px;height:10px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff7d6,#d9c37a 55%,#6b5a22);box-shadow:0 0 0 2px #0b1331,0 0 0 3px #7f93c9}" +
      ".mp-wm{position:absolute;left:0;right:0;bottom:42px;text-align:center;font-style:normal;font-size:9px;font-weight:700;letter-spacing:.42em;padding-left:.42em;color:rgba(200,215,255,.42);text-shadow:0 1px 0 rgba(0,0,0,.4)}" +
      ".mp-micd{position:absolute;width:4px;height:4px;border-radius:50%;background:#050914;box-shadow:0 0 0 1px rgba(160,180,240,.5)}" +
      /* iPhone Air back: light gold glass with the long camera bar across the top */
      ".mp-back--air{border-radius:42px;background:linear-gradient(145deg,#f5ebd6 0%,#d8c39c 42%,#b49c70 100%);box-shadow:0 30px 60px rgba(0,0,0,.55),inset 0 0 0 1.5px rgba(255,255,255,.75)}" +
      ".mp-back--air::before{content:'';position:absolute;inset:4px;border-radius:38px;background:linear-gradient(160deg,#f8efdc 0%,#e7d6b3 52%,#d6c096 100%);box-shadow:inset 0 0 20px rgba(255,255,255,.55),inset 0 -2px 8px rgba(120,95,40,.18)}" +
      ".mp-plateau{position:absolute;left:12px;right:12px;top:12px;height:74px;border-radius:30px;background:linear-gradient(180deg,#d9c59f,#c3ab7d);box-shadow:inset 0 1px 0 rgba(255,255,255,.7),inset 0 -2px 6px rgba(110,85,35,.35),0 5px 12px rgba(100,75,30,.28)}" +
      ".mp-lens--air{left:20px;top:17px;width:40px;height:40px;box-shadow:0 0 0 3px #1a1710,0 0 0 5px #bba377,0 3px 8px rgba(0,0,0,.5)}" +
      ".mp-lens--air::after{background:radial-gradient(circle at 30% 28%,rgba(190,205,255,.9),rgba(70,40,130,.85) 46%,#000 76%)}" +
      ".mp-phone{position:absolute;width:auto;height:auto;border-radius:38px;padding:9px;background:linear-gradient(145deg,#2d3446,#0b0f1a);box-shadow:0 30px 60px rgba(0,0,0,.55),inset 0 0 0 1.5px rgba(255,255,255,.14);flex:none}" +
      ".mp-screen{position:relative;width:100%;height:100%;border-radius:30px;overflow:hidden;background:#fff}" +
      ".mp-phone::after{content:'';position:absolute;top:15px;left:50%;width:58px;height:14px;margin-left:-29px;border-radius:99px;background:#05070d;z-index:9}" +
      ".mp-phone--a35{border-radius:34px;padding:7px;background:linear-gradient(145deg,#33498f 0%,#1a2a5e 38%,#0c1534 100%);box-shadow:0 30px 60px rgba(0,0,0,.55),inset 0 0 0 1.5px rgba(150,175,255,.35),inset 0 0 0 4px #0a1230}" +
      ".mp-phone--a35 .mp-screen{border-radius:27px}" +
      ".mp-phone--a35::after{top:13px;width:9px;height:9px;margin-left:-4.5px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#2a3560,#05070d 60%);box-shadow:0 0 0 1.5px #0a0f1f}" +
      ".mp-phone--a35::before{content:'';position:absolute;right:-3px;top:112px;width:3px;height:46px;border-radius:0 2px 2px 0;background:linear-gradient(90deg,#1a2a5e,#3a4f96);box-shadow:0 70px 0 -1px #2c4082}" +
      ".mp-phone--a35 .mp-screen::after{content:'';position:absolute;left:50%;bottom:6px;width:70px;height:4px;margin-left:-35px;border-radius:2px;background:rgba(15,23,42,.55);z-index:20}" +
      ".mp-phone--air{border-radius:42px;padding:5px;background:linear-gradient(145deg,#f5ebd6 0%,#d8c39c 42%,#b49c70 100%);box-shadow:0 30px 60px rgba(0,0,0,.55),inset 0 0 0 1.5px rgba(255,255,255,.75),inset 0 0 0 3.5px #8f7a52}" +
      ".mp-phone--air .mp-screen{border-radius:37px;box-shadow:0 0 0 2px #05070d}" +
      ".mp-phone--air::after{top:13px;width:62px;height:17px;margin-left:-31px}" +
      ".mp-phone--air::before{content:'';position:absolute;right:-3px;top:136px;width:3px;height:62px;border-radius:0 2px 2px 0;background:linear-gradient(90deg,#a48d62,#efe2c4)}" +
      ".mp-phone--air .mp-screen::after{content:'';position:absolute;left:50%;bottom:6px;width:80px;height:4px;margin-left:-40px;border-radius:2px;background:rgba(15,23,42,.6);z-index:20}" +
      ".mp-model{position:relative;z-index:1;font-size:11.5px;font-weight:600;letter-spacing:.04em;color:rgba(255,255,255,.62);margin-top:-6px}" +
      ".mp-stage{position:absolute;inset:0;animation:mp-in .45s ease both}" +
      "@keyframes mp-in{from{opacity:0;transform:scale(1.02)}}" +
      ".mp-status{position:absolute;top:0;left:0;right:0;height:30px;display:flex;align-items:flex-end;justify-content:space-between;padding:0 22px 4px;font-size:10.5px;color:#111;background:#fff;z-index:3}" +
      ".mp-status s{width:34px;height:8px;border-radius:3px;background:linear-gradient(90deg,#111 0 60%,transparent 60% 70%,#111 70%);opacity:.75}" +
      ".mp-at{position:absolute;top:30px;left:0;right:0;height:44px;display:flex;align-items:center;gap:7px;padding:0 8px;background:#fff;z-index:3;border-bottom:1px solid #E6EAF0}" +
      ".mp-al{width:24px;height:24px;border-radius:7px;overflow:hidden;flex:none}.mp-at b{flex:1;min-width:0;font-size:10.5px;color:#0F172A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".mp-ag{display:flex;gap:7px;flex:none}.mp-ib{display:block;width:22px;height:22px;border-radius:50%;background:#EEF1F6;flex:none}" +
      ".mp-inst{display:grid!important;place-items:center;background:linear-gradient(135deg,#2F6FE4,#0B8F7A)!important;color:#fff}" +
      ".mp-pulse{animation:mp-pulse 1.1s ease-in-out infinite}@keyframes mp-pulse{0%,100%{box-shadow:0 0 0 0 rgba(47,111,228,.55)}50%{box-shadow:0 0 0 7px rgba(47,111,228,0)}}" +
      ".mp-av{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#2F6FE4;color:#fff;font-size:8px;font-style:normal;font-weight:700;flex:none}" +
      ".mp-body{position:absolute;top:74px;left:0;right:0;bottom:0;background:#EAF0FA;padding:10px}" +
      ".mp-hero{height:78px;border-radius:14px;margin-bottom:9px;padding:14px;background:linear-gradient(120deg,#4F6FE8,#14A89A)}.mp-hero p{height:7px;width:60%;margin:0 0 8px;border-radius:4px;background:rgba(255,255,255,.7)}.mp-hero p+p{width:38%;opacity:.6}" +
      ".mp-row{height:48px;border-radius:12px;background:#fff;margin-bottom:9px;box-shadow:0 1px 3px rgba(15,23,42,.06)}.mp-row--s{height:34px}" +
      ".mp-over{position:absolute;inset:0;z-index:10;animation:mp-out .5s both}@keyframes mp-out{to{opacity:0;visibility:hidden}}" +
      ".mp-over--splash{background:radial-gradient(120% 80% at 50% 30%,#1B2A52,#0F1522 70%)}.mp-over--splash .mp-sp{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#fff;font-size:14px}.mp-sp .mp-pl{animation:mp-icon .8s .1s cubic-bezier(.34,1.56,.64,1) both}" +
      ".mp-guide{position:absolute;left:10px;right:10px;bottom:64px;display:flex;align-items:center;gap:10px;padding:10px;border-radius:14px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,.25);z-index:5;animation:mp-up .4s .1s both}.mp-guide .mp-di{margin:0}.mp-guide b{display:block;font-size:10.5px;color:#111}.mp-guide span{font-size:9px;color:#64748B}" +
      ".mp-share{animation:mp-pulse 1.1s ease-in-out infinite;border-radius:50%}" +
      ".mp-ab{position:absolute;top:30px;left:0;right:0;height:34px;display:flex;align-items:center;gap:6px;padding:0 8px;background:#fff;z-index:3}" +
      ".mp-url{flex:1;min-width:0;display:flex;align-items:center;gap:5px;height:24px;padding:0 9px;border-radius:12px;background:#EEF1F5;color:#334155;font-size:9px;overflow:hidden;white-space:nowrap}" +
      ".mp-url i{font-style:normal;display:block;overflow:hidden;white-space:nowrap}" +
      ".mp-type i{width:0;animation:mp-typing 1.6s .5s steps(30,end) forwards}" +
      "@keyframes mp-typing{to{width:150px}}" +
      ".mp-dots{display:flex;flex-direction:column;gap:2.5px;padding:0 5px}.mp-dots u{width:3.5px;height:3.5px;border-radius:50%;background:#334155}" +
      ".mp-page{position:absolute;left:0;right:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;text-align:center;padding:0 22px;background:radial-gradient(120% 80% at 50% 25%,#1B2A52,#0F1522 70%);color:#fff}" +
      ".mp-pl{width:54px;height:54px;border-radius:16px;box-shadow:0 10px 24px rgba(47,111,228,.5)}" +
      ".mp-page b{font-size:15px;margin-top:6px}.mp-page span{font-size:9px;color:#AEBBD0;line-height:1.4}" +
      ".mp-page em{font-style:normal;margin-top:10px;padding:9px 18px;border-radius:10px;background:#fff;color:#1f2937;font-size:10px;font-weight:700}" +
      ".mp-sf{position:absolute;bottom:0;left:0;right:0;height:52px;padding:14px 10px 0;background:rgba(246,247,249,.97);border-top:1px solid #dde1e7;z-index:3}" +
      ".mp-sf .mp-url{display:flex;justify-content:center;height:26px;margin-bottom:6px}" +
      ".mp-sf-ic{display:flex;justify-content:space-around;color:#2F6FE4}" +
      ".mp-ios{background:transparent;color:#fff}.mp-ios s{background:none}" +
      ".mp-tap{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:rgba(79,142,247,.4);border:2px solid rgba(47,111,228,.9);opacity:0;z-index:12;animation:mp-tap 1.1s ease both}" +
      "@keyframes mp-tap{0%{opacity:0;transform:scale(1.7)}25%{opacity:1;transform:scale(1)}55%{opacity:1;transform:scale(.8)}100%{opacity:0;transform:scale(1.5)}}" +
      ".mp-menu{position:absolute;top:60px;right:8px;width:160px;padding:6px 0;border-radius:12px;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.28);z-index:8;opacity:0;transform:scale(.9) translateY(-8px);transform-origin:top right;animation:mp-pop .35s both}" +
      ".mp-menu--on{opacity:1;transform:none;animation:none}" +
      "@keyframes mp-pop{to{opacity:1;transform:none}}" +
      ".mp-menu p,.mp-sheet p{margin:0;padding:0 14px;height:30px;line-height:30px;font-size:10.5px;color:#1f2937}" +
      ".mp-hl{animation:mp-hl .6s both}.mp-menu--on .mp-hl,.mp-sheet .mp-hl{background:transparent}" +
      "@keyframes mp-hl{to{background:rgba(79,142,247,.22);font-weight:700}}" +
      ".mp-dim{position:absolute;inset:0;background:rgba(0,0,0,.45);z-index:6;animation:mp-fade .3s both}@keyframes mp-fade{from{opacity:0}}" +
      ".mp-dialog{position:absolute;left:23px;top:150px;width:190px;height:170px;padding:14px;border-radius:18px;background:#fff;z-index:8;text-align:center;box-shadow:0 14px 40px rgba(0,0,0,.4);animation:mp-up .4s .15s both}" +
      "@keyframes mp-up{from{opacity:0;transform:translateY(16px)}}" +
      ".mp-di{width:40px;height:40px;margin:0 auto 6px;border-radius:11px;overflow:hidden}.mp-di--lg{margin:0;width:48px;height:48px;border-radius:12px;flex:none}" +
      ".mp-dialog b{display:block;font-size:12.5px;color:#111}.mp-dialog span{display:block;font-size:9.5px;color:#64748B;margin-top:2px}" +
      ".mp-db{position:absolute;left:14px;right:14px;bottom:12px;display:flex;justify-content:flex-end;gap:8px}.mp-db p{margin:0;padding:0 12px;height:30px;line-height:30px;border-radius:15px;font-size:10.5px;color:#2F6FE4;font-weight:700}.mp-db .mp-pri{background:#2F6FE4;color:#fff}" +
      ".mp-sheet{position:absolute;left:0;right:0;bottom:0;height:300px;border-radius:18px 18px 0 0;background:#F2F2F7;z-index:8;padding-top:6px;animation:mp-sheet .5s .2s cubic-bezier(.22,1,.36,1) both}" +
      "@keyframes mp-sheet{from{transform:translateY(100%)}}" +
      ".mp-sh{display:flex;align-items:center;gap:9px;margin:6px 10px 8px;padding:8px;border-radius:12px;background:#fff}.mp-sh .mp-di{margin:0}.mp-sh b{display:block;font-size:11px;color:#111}.mp-sh span{font-size:8.5px;color:#8A94A6}" +
      ".mp-sheet p{position:relative;display:flex;align-items:center;justify-content:space-between;margin:0 10px;border-bottom:1px solid #E4E4EA;background:#fff;height:34px;line-height:34px}.mp-sheet p em{font-style:normal;color:#555}" +
      ".mp-add{position:absolute;left:0;right:0;top:36px;bottom:0;border-radius:16px 16px 0 0;background:#F2F2F7;z-index:8;padding:12px;animation:mp-sheet .5s .15s cubic-bezier(.22,1,.36,1) both}" +
      ".mp-ah{display:flex;align-items:center;justify-content:space-between;height:26px;font-size:10px}.mp-ah b{font-size:10.5px}.mp-ah span{color:#2F6FE4}.mp-ah .mp-pri{font-weight:700}" +
      ".mp-ar{display:flex;align-items:center;gap:10px;margin:14px 0 10px;padding:10px;border-radius:12px;background:#fff}" +
      ".mp-field{flex:1;font-size:11px;color:#111;padding-bottom:4px;border-bottom:1px solid #D7DAE0}" +
      ".mp-add small{display:block;font-size:8.5px;line-height:1.4;color:#6B7280;padding:0 4px}" +
      ".mp-home{position:absolute;inset:0;background:linear-gradient(160deg,#3b5bdb,#12b886 55%,#0b7285)}" +
      ".mp-home .mp-status{background:transparent;color:#fff}" +
      ".mp-grid{position:absolute;top:56px;left:0;right:0;display:grid;grid-template-columns:repeat(4,1fr);gap:20px 6px;padding:0 14px}" +
      ".mp-app{display:flex;flex-direction:column;align-items:center;gap:5px}.mp-app>div{width:38px;height:38px;border-radius:11px;opacity:.85}.mp-app u{width:24px;height:4px;border-radius:2px;background:rgba(255,255,255,.55);display:block}" +
      ".mp-new{position:relative}.mp-new .mp-ico{width:42px;height:42px;border-radius:12px;opacity:1;overflow:hidden;animation:mp-icon 1s .5s cubic-bezier(.34,1.56,.64,1) both}" +
      ".mp-new u{width:auto;height:auto;background:none;color:#fff;font-size:8px;text-decoration:none;font-weight:600;text-shadow:0 1px 3px rgba(0,0,0,.5);animation:mp-fade .5s 1.1s both}" +
      ".mp-glow{position:absolute;top:-10px;width:62px;height:62px;border-radius:50%;opacity:1!important;background:radial-gradient(circle,rgba(255,255,255,.8),transparent 70%);animation:mp-glow 1.6s .6s ease-out both}" +
      "@keyframes mp-icon{from{transform:scale(0) rotate(-30deg);opacity:0}}@keyframes mp-glow{0%{transform:scale(.2);opacity:0}40%{opacity:1}100%{transform:scale(2.2);opacity:0}}" +
      ".mp-bars{display:flex;gap:6px;width:236px;position:relative;z-index:1}.mp-bars button{flex:1;height:5px;padding:0;border:0;border-radius:3px;cursor:pointer;background:rgba(255,255,255,.22);overflow:hidden;position:relative}.mp-bars i{position:absolute;inset:0;transform-origin:left;transform:scaleX(0);background:linear-gradient(90deg,#4F8EF7,#10B197)}" +
      ".mp-bars button.is-done i{transform:scaleX(1)}" +
      ".mp-ctrl{display:flex;align-items:center;gap:10px;position:relative;z-index:1}.mp-ctrl button{width:36px;height:36px;border:0;border-radius:50%;display:grid;place-items:center;cursor:pointer;background:rgba(255,255,255,.14);color:#fff;transition:background .15s,transform .15s}.mp-ctrl button:hover{background:rgba(255,255,255,.26)}.mp-ctrl button:active{transform:scale(.92)}" +
      ".mp-ctrl .mp-play{width:44px;height:44px;background:linear-gradient(135deg,#2F6FE4,#0B8F7A)}.mp-ctrl svg{width:16px;height:16px;fill:currentColor}" +
      /* the text side */
      ".mp-info{display:flex;flex-direction:column;gap:14px;padding:30px 32px 24px;min-width:0;overflow:auto}" +
      ".mp-kick{display:inline-flex;align-self:flex-start;align-items:center;gap:7px;padding:5px 12px;border-radius:99px;font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#2457C5;background:rgba(47,111,228,.12)}" +
      ".mp-info h2{margin:0;font-size:26px;line-height:1.15;letter-spacing:-.6px;padding-right:96px}" +
      ".mp-sub{margin:0;font-size:14.5px;line-height:1.55;color:var(--text-soft,#64748B)}" +
      ".mp-os{display:inline-flex;align-self:flex-start;padding:4px;gap:4px;border-radius:14px;background:rgba(100,116,139,.12)}.mp-os button{border:0;padding:8px 18px;border-radius:10px;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;background:none;color:var(--text-soft,#64748B);transition:all .15s}.mp-os button.is-on{background:linear-gradient(135deg,#2F6FE4,#0B8F7A);color:#fff;box-shadow:0 6px 14px rgba(36,87,197,.3)}" +
      ".mp-steps{display:flex;flex-direction:column;gap:4px;margin:0;padding:0;list-style:none}" +
      ".mp-steps li{display:flex;gap:12px;align-items:flex-start;padding:9px 12px;border-radius:14px;cursor:pointer;border:1px solid transparent;transition:background .2s,border-color .2s}" +
      ".mp-steps li:hover{background:rgba(100,116,139,.08)}.mp-steps li.is-on{background:rgba(47,111,228,.09);border-color:rgba(47,111,228,.28)}" +
      ".mp-n{flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:12.5px;font-weight:800;background:rgba(100,116,139,.16);color:var(--text-soft,#64748B);transition:all .2s}.mp-steps li.is-on .mp-n{background:linear-gradient(135deg,#2F6FE4,#0B8F7A);color:#fff}.mp-steps li.is-seen .mp-n{background:#16A34A;color:#fff}" +
      ".mp-steps b{display:block;font-size:14px}.mp-steps div span{display:block;font-size:12.5px;line-height:1.45;color:var(--text-soft,#64748B);max-height:0;overflow:hidden;opacity:0;transition:max-height .3s ease,opacity .3s}.mp-steps li.is-on div span{max-height:60px;opacity:1;margin-top:2px}" +
      ".mp-qr{display:flex;align-items:center;gap:16px;padding:14px;border-radius:18px;background:rgba(100,116,139,.08);border:1px solid var(--hairline,rgba(15,23,42,.08))}" +
      ".mp-qrbox{flex:none;width:96px;height:96px;padding:6px;border-radius:12px;background:#fff;display:grid;place-items:center}.mp-qrbox svg{width:100%;height:100%;display:block}" +
      ".mp-qr b{display:block;font-size:14px}.mp-qr span{display:block;font-size:12.5px;line-height:1.45;color:var(--text-soft,#64748B);margin:3px 0 8px}" +
      ".mp-copy{border:0;padding:8px 14px;border-radius:10px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;color:#2457C5;background:rgba(47,111,228,.12)}.mp-copy:hover{background:rgba(47,111,228,.2)}" +
      ".mp-foot{display:flex;flex-direction:column;gap:8px;margin-top:auto;position:sticky;bottom:-24px;padding:12px 0 24px;background:linear-gradient(180deg,rgba(255,255,255,0),var(--surface,#fff) 14px)}" +
      ".mp-done{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:52px;padding:0 20px;border:0;border-radius:16px;font:inherit;font-size:15px;font-weight:800;cursor:pointer;color:#fff;background:linear-gradient(135deg,#3B82F6 0%,#2F6FE4 45%,#2457C5 100%);box-shadow:0 10px 22px rgba(47,111,228,.4),inset 0 1px 0 rgba(255,255,255,.35);transition:transform .15s,box-shadow .15s,filter .15s}" +
      ".mp-done svg{width:22px;height:22px;flex:none}.mp-done:hover{transform:translateY(-1px);box-shadow:0 14px 28px rgba(47,111,228,.5),inset 0 1px 0 rgba(255,255,255,.35);filter:brightness(1.07)}.mp-done:active{transform:scale(.985)}.mp-done:focus-visible{outline:3px solid rgba(47,111,228,.55);outline-offset:3px}" +
      ".mp-note{display:flex;flex-direction:column;gap:6px;margin-top:2px;padding:10px 12px;border-radius:12px;background:rgba(100,116,139,.08);font-size:12px;line-height:1.45;color:var(--text-soft,#64748B)}.mp-note p{margin:0;position:relative;padding-left:14px}.mp-note p::before{content:'';position:absolute;left:0;top:.5em;width:6px;height:6px;border-radius:50%;background:#2F6FE4}.mp-note p+p::before{background:#16A34A}.mp-note b{color:var(--text,#0F172A);font-weight:700}" +
      "@media (max-width:860px){.mp-card{grid-template-columns:1fr;overflow:auto}.mp-film{padding:20px}.mp-info{overflow:visible}}" +
      "@media (max-height:860px){.mp-3d{zoom:.88}.mp-bars{width:208px}.mp-film{gap:12px;padding-top:18px;padding-bottom:14px}.mp-info{padding-top:24px}.mp-info h2{font-size:23px}.mp-sub{display:none}.mp-steps li{padding:7px 12px}}" +
      "@media (max-height:760px){.mp-3d{zoom:.76}.mp-bars{width:180px}.mp-info{gap:10px}.mp-sub{font-size:13.5px}.mp-qrbox{width:84px;height:84px}}" +
      "@media (max-height:660px){.mp-3d{zoom:.64}.mp-bars{width:152px}.mp-ctrl button{width:32px;height:32px}.mp-ctrl .mp-play{width:38px;height:38px}}" +
      ".mp-card{--text:#0F172A;--text-soft:#64748B;--surface:#FFFFFF;--hairline:#E2E8F0;background:#fff;border-radius:28px;box-shadow:0 40px 100px rgba(8,12,24,.5),0 0 0 1px rgba(255,255,255,.2)}" +
      ".mp-film{background:radial-gradient(120% 90% at 30% 8%,#2F4F9C 0%,#14204A 52%,#0A1124 100%)}" +
      ".mp-info{position:relative;gap:16px;padding:32px 34px 0;background:#fff;scrollbar-width:thin;scrollbar-color:#CBD5E1 transparent}" +
      ".mp-kick{color:#2457C5;background:#EAF1FF;box-shadow:inset 0 0 0 1px #CFE0FF}" +
      ".mp-info h2{background:none;color:#0F172A;-webkit-text-fill-color:#0F172A;font-size:27px;letter-spacing:-.7px;padding-right:100px}" +
      ".mp-sub{color:#64748B;font-size:14.5px}" +
      ".mp-x{background:#0F172A;color:#fff;border:0;box-shadow:0 8px 20px rgba(15,23,42,.3)}.mp-x:hover{background:#1E293B;filter:none;box-shadow:0 12px 26px rgba(15,23,42,.38)}" +
      ".mp-os{background:#F1F5F9;box-shadow:inset 0 0 0 1px #E2E8F0}.mp-os button{color:#475569}.mp-os button:hover:not(.is-on){color:#0F172A}" +
      ".mp-steps{gap:2px}.mp-steps li{position:relative;padding:10px 12px;border-radius:14px}" +
      ".mp-steps li:not(:last-child)::before{content:'';position:absolute;left:24px;top:38px;bottom:-8px;width:2px;border-radius:1px;background:#E2E8F0}" +
      ".mp-steps li.is-seen:not(:last-child)::before{background:#86EFAC}" +
      ".mp-steps li:hover{background:#F8FAFC}" +
      ".mp-steps li.is-on{background:linear-gradient(135deg,#EEF4FF,#ECFDF8);border-color:#BFD5FF;box-shadow:0 6px 18px -8px rgba(47,111,228,.35)}" +
      ".mp-n{position:relative;z-index:1;background:#E2E8F0;color:#475569;box-shadow:0 0 0 3px #fff}.mp-steps li.is-on .mp-n{box-shadow:0 0 0 3px #EEF4FF}" +
      ".mp-steps b{color:#0F172A}" +
      ".mp-qr{background:#F8FAFC;border-color:#E2E8F0}" +
      ".mp-qrbox{box-shadow:0 0 0 1px #E2E8F0,0 6px 16px rgba(15,23,42,.08)}" +
      ".mp-qr b{color:#0F172A}" +
      ".mp-copy{color:#2457C5;background:#EAF1FF;box-shadow:inset 0 0 0 1px #CFE0FF}.mp-copy:hover{background:#DCE9FF}" +
      ".mp-foot{position:sticky;bottom:0;margin:auto -34px 0;padding:14px 34px 18px;gap:10px;background:linear-gradient(180deg,rgba(255,255,255,0),#fff 14px);border-top:1px solid #EEF2F7}" +
      ".mp-acts{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.35fr);gap:10px}" +
      ".mp-later{display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;padding:0 16px;border-radius:16px;border:1.5px solid #CBD5E1;background:#fff;color:#334155;font:inherit;font-size:14.5px;font-weight:700;cursor:pointer;transition:background .15s,border-color .15s,transform .15s}" +
      ".mp-later:hover{background:#F1F5F9;border-color:#94A3B8}.mp-later:active{transform:scale(.98)}.mp-later:focus-visible{outline:3px solid rgba(47,111,228,.5);outline-offset:2px}" +
      ".mp-later svg{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}" +
      ".mp-done{width:auto}" +
      ".mp-note{display:block;margin:0;padding:0;background:none;font-size:12px;line-height:1.5;color:#64748B;text-align:center}.mp-note b{color:#334155}" +
      ".mp-inst{box-shadow:0 0 0 1px rgba(255,255,255,.4) inset,0 3px 8px rgba(47,111,228,.55)}.mp-inst svg{animation:mp-dl 1.8s ease-in-out infinite}@keyframes mp-dl{0%,100%{transform:translateY(-.5px)}50%{transform:translateY(1.5px)}}" +
      ".mp-gs{position:absolute;left:8px;right:8px;bottom:62px;padding:12px;border-radius:18px;background:#fff;z-index:8;box-shadow:0 12px 34px rgba(0,0,0,.4);animation:mp-up .45s .15s both}" +
      ".mp-gh{display:flex;align-items:center;gap:8px;margin-bottom:8px}.mp-gh .mp-di{margin:0;width:32px;height:32px;border-radius:9px}.mp-gh b{display:block;font-size:10.5px;color:#111}.mp-gh span{font-size:8.5px;color:#64748B}" +
      ".mp-gs ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px}.mp-gs li{display:flex;align-items:center;gap:7px;padding:7px 9px;border-radius:10px;background:#F1F5F9;font-size:9.5px;font-weight:700;color:#0F172A}" +
      ".mp-gs li i{flex:none;width:16px;height:16px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-size:8.5px;color:#fff;background:linear-gradient(135deg,#2F6FE4,#0B8F7A)}" +
      ".mp-gs em{display:block;margin-top:8px;padding:8px;border-radius:10px;text-align:center;font-style:normal;font-size:10px;font-weight:800;color:#fff;background:linear-gradient(135deg,#3B82F6,#2457C5)}" +
      ".mp-pt{position:absolute;left:0;right:0;bottom:56px;z-index:9;text-align:center;font-size:8.5px;font-weight:800;color:#2F6FE4;animation:mp-bob 1.2s ease-in-out infinite}@keyframes mp-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}" +
      "@media (prefers-reduced-motion:reduce){#mpRoot *{animation-duration:.01ms!important;animation-delay:0s!important;transition-duration:.01ms!important}}";
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ the card */
  var root = null, os = "android", step = 0, playing = true, t0 = 0, raf = 0, elapsed = 0;

  function ic(n) {
    return { play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>', pause: '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
             prev: '<svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>', next: '<svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg>' }[n];
  }

  function build() {
    css();
    root = document.createElement("div");
    root.id = "mpRoot";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Get the app on your phone");
    root.innerHTML =
      '<div class="mp-card">' +
        '<button class="mp-x" type="button" aria-label="Close for now"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg><span>Close</span></button>' +
        '<div class="mp-film"><div class="mp-3d" id="mp3d"><div class="mp-phone"><div class="mp-screen" id="mpScreen"></div></div></div><div class="mp-bars" id="mpBars"></div>' +
          '<div class="mp-ctrl"><button type="button" data-a="prev" aria-label="Previous step">' + ic("prev") + '</button><button type="button" class="mp-play" data-a="play" aria-label="Pause">' + ic("pause") + '</button><button type="button" data-a="next" aria-label="Next step">' + ic("next") + '</button></div></div>' +
        '<div class="mp-info">' +
          '<span class="mp-kick">Now on your phone</span>' +
          '<h2>Use OLF Staff Connect as an app on your phone</h2>' +
          '<p class="mp-sub">Faster to open, full screen, one tap from your home screen. It takes less than a minute. Watch how:</p>' +
          '<div class="mp-os" role="tablist"><button type="button" data-os="android" class="is-on">Android</button><button type="button" data-os="ios">iPhone</button></div>' +
          '<ol class="mp-steps" id="mpSteps"></ol>' +
          '<div class="mp-qr"><div class="mp-qrbox" id="mpQr"></div><div><b>Scan with your phone camera</b><span>It opens the app address on your phone, then follow the steps.</span><button type="button" class="mp-copy" id="mpCopy">Copy link</button></div></div>' +
          '<div class="mp-foot"><div class="mp-acts">' +
            '<button type="button" class="mp-later" id="mpLater"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>Remind me later</button>' +
            '<button type="button" class="mp-done" id="mpDone"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="rgba(255,255,255,.25)"/><path d="m7.5 12.5 3 3 6-6.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>I have already installed it</span></button></div>' +
            '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);

    root.querySelector(".mp-x").addEventListener("click", closeNow);
    root.addEventListener("click", function (e) { if (e.target === root) closeNow(); });
    document.addEventListener("keydown", onKey);
    root.querySelector("#mpDone").addEventListener("click", function () { setDone(); closeNow(); });
    root.querySelector("#mpLater").addEventListener("click", closeNow);
    root.querySelector("#mpCopy").addEventListener("click", copyLink);
    Array.prototype.forEach.call(root.querySelectorAll("[data-os]"), function (b) {
      b.addEventListener("click", function () {
        os = b.getAttribute("data-os");
        Array.prototype.forEach.call(root.querySelectorAll("[data-os]"), function (x) { x.classList.toggle("is-on", x === b); });
        intro();
      });
    });
    root.querySelector(".mp-ctrl").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var a = b.getAttribute("data-a");
      if (a === "play") toggle(); else if (a === "prev") go(Math.max(0, step - 1), playing); else if (a === "next") go(step + 1 >= 5 ? 0 : step + 1, playing);
    });
    drawQr();
    requestAnimationFrame(function () { root.classList.add("is-on"); });
    intro();
  }

  function onKey(e) { if (e.key === "Escape" && root) closeNow(); }

  function closeNow() {
    if (!root) return;
    clearTimeout(introT);
    cancelAnimationFrame(raf);
    document.removeEventListener("keydown", onKey);
    var r = root; root = null;
    r.classList.remove("is-on");
    setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 380);
  }

  function copyLink() {
    var b = root && root.querySelector("#mpCopy");
    function ok() { if (b) { b.textContent = "Copied"; setTimeout(function () { if (b) b.textContent = "Copy link"; }, 1600); } }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(APP_URL).then(ok, ok); else ok();
  }

  function drawQr() {
    var box = root.querySelector("#mpQr");
    function paint() {
      try { var q = window.qrcode(0, "M"); q.addData(APP_URL); q.make(); box.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }
      catch (e) { box.innerHTML = '<span style="font-size:10px;text-align:center;word-break:break-all;color:#334155">' + APP_URL.replace("https://", "") + "</span>"; }
    }
    if (window.qrcode) { paint(); return; }
    var sc = document.createElement("script");
    sc.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
    sc.onload = paint; sc.onerror = paint;
    document.head.appendChild(sc);
  }

  /* ---- the timeline */
  function renderSteps() {
    var list = root.querySelector("#mpSteps"), bars = root.querySelector("#mpBars"), S = SCENES[os];
    list.innerHTML = S.map(function (s, i) { return '<li data-i="' + i + '"><span class="mp-n">' + (i + 1) + '</span><div><b>' + s.t + '</b><span>' + s.d + '</span></div></li>'; }).join("");
    bars.innerHTML = S.map(function (s, i) { return '<button type="button" data-i="' + i + '" aria-label="Step ' + (i + 1) + '"><i></i></button>'; }).join("");
    Array.prototype.forEach.call(root.querySelectorAll("#mpSteps li, #mpBars button"), function (el) {
      el.addEventListener("click", function () { go(+el.getAttribute("data-i"), playing); });
    });
  }

  /* ---- the phone itself: its back (shown first), its front, and the flip between them */
  var introT = 0;
  function skin() {
    var ph = root.querySelector(".mp-phone");
    ph.classList.toggle("mp-phone--a35", os === "android");
    ph.classList.toggle("mp-phone--air", os !== "android");
  }
  function intro() {
    if (!root) return;
    clearTimeout(introT); cancelAnimationFrame(raf);
    skin();
    renderSteps(); root.setAttribute("data-ostate", os);
    go(0, true);
  }

  function go(i, play) {
    if (!root) return;
    if (i >= SCENES[os].length) i = 0;
    var changedOs = !root.querySelector("#mpSteps li");
    step = i; elapsed = 0; playing = !!play;
    if (changedOs || root.querySelectorAll("#mpSteps li").length !== SCENES[os].length || root.getAttribute("data-ostate") !== os) { renderSteps(); root.setAttribute("data-ostate", os); }
    var scr = root.querySelector("#mpScreen");
    scr.innerHTML = '<div class="mp-stage">' + SCENES[os][i].h + "</div>";
    Array.prototype.forEach.call(root.querySelectorAll("#mpSteps li"), function (li, n) { li.classList.toggle("is-on", n === i); li.classList.toggle("is-seen", n < i); });
    Array.prototype.forEach.call(root.querySelectorAll("#mpBars button"), function (b, n) { b.classList.toggle("is-done", n < i); b.firstChild.style.transform = n === i ? "scaleX(0)" : ""; });
    syncPlay();
    cancelAnimationFrame(raf);
    t0 = performance.now();
    if (playing) raf = requestAnimationFrame(tick);
  }

  function syncPlay() {
    var b = root.querySelector(".mp-play");
    b.innerHTML = playing ? ic("pause") : ic("play");
    b.setAttribute("aria-label", playing ? "Pause" : "Play");
  }
  function toggle() {
    playing = !playing; syncPlay();
    var stage = root.querySelector(".mp-stage");
    if (stage) Array.prototype.forEach.call(stage.querySelectorAll("*"), function (n) { n.style.animationPlayState = playing ? "running" : "paused"; });
    if (playing) { t0 = performance.now() - elapsed; raf = requestAnimationFrame(tick); } else cancelAnimationFrame(raf);
  }
  function tick(now) {
    if (!root || !playing) return;
    elapsed = now - t0;
    var f = Math.min(1, elapsed / STEP_MS);
    var cur = root.querySelector('#mpBars button[data-i="' + step + '"]');
    if (cur) cur.firstChild.style.transform = "scaleX(" + f + ")";
    if (f >= 1) { go(step + 1 >= SCENES[os].length ? 0 : step + 1, true); return; }
    raf = requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------------ when to open it */
  function ready() {
    var shell = document.getElementById("appShell"), ls = document.getElementById("loadingScreen");
    return shell && shell.classList.contains("visible") && window.__olfUser && (!ls || ls.style.display === "none");
  }
  function wait(n) {
    if (opened || !computer() || standalone()) return;
    if (ready()) {
      if (isDone()) { opened = true; return; }
      opened = true;
      setTimeout(function () { if (computer() && !isDone() && !root) build(); }, 1400);
      return;
    }
    if (n < 240) setTimeout(function () { wait(n + 1); }, 500);   // gives up after about two minutes without a sign-in
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { wait(0); });
  else wait(0);
})();
