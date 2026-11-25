/* OLF Staff Connect - Spaces: the page markup and its styles (rooms.js opens this inside a popup on Home).
   Kept as a script, not a separate .html file, so nothing that serves files can change or cut it. */
window.RB_HTML = `<!-- =====================================================================
     SPACES - PAGE FRAGMENT
     Injected into the content area; rooms.js then calls RoomBooking.mount().
     Everything is namespaced under #rb-app so it cannot clash with other pages.
     ===================================================================== -->
<div id="rb-app">
<style>
#rb-app {
  --rb-bg: #F4F7FA; --rb-surface: #FFFFFF; --rb-surface2: #F7FAFC; --rb-border: #D8E4EC; --rb-border2: #B0C4D4;
  --rb-text: #1A2533; --rb-text2: #5A6B7A; --rb-text3: #66778A;
  --rb-brand: #2F6FE4; --rb-brand-dark: #2457C5; --rb-brand-lt: #EEF4FF; --rb-brand-bd: #7FA6F0;
  --rb-green: #1F7A4D; --rb-green-lt: #E3F5EA; --rb-green-bd: #97D3B0;
  --rb-red: #B42318; --rb-red-lt: #FDECEA; --rb-red-bd: #F2B8B2;
  --rb-amber: #92580A; --rb-amber-lt: #FEF3E2;
  max-width: var(--page-max, 1680px); margin-left: auto; margin-right: auto;
  color: var(--rb-text); font-size: 14px; line-height: 1.5; position: relative;
}
#rb-app *, #rb-app *::before, #rb-app *::after { box-sizing: border-box; }
#rb-app button { font: inherit; cursor: pointer; }
#rb-app svg.rb-i { width: 1.15em; height: 1.15em; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; flex: 0 0 auto; }

/* ── banner ── */

/* ── banner extras (the banner itself comes from the shared .pg-hero style) ── */
#rb-app .rb-clockchip { display: inline-flex; align-items: center; min-height: 42px; padding: 0 16px; border-radius: 13px; font-size: 13.5px; font-weight: 700; color: #fff; white-space: nowrap; font-variant-numeric: tabular-nums; }
#rb-app .rb-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
#rb-app .rb-tab[hidden] { display: none; }
#rb-app .pg-hero .rb-tab.on { background: #fff; color: #2457C5; border-color: #fff; box-shadow: 0 8px 18px rgba(15,23,42,.18); }
#rb-app .pg-stat-value { font-size: 30px; }
/* ── banner chips and popup for My bookings / Rooms ── */
#rb-app .pg-hero-sub { font-variant-numeric: tabular-nums; }
#rb-app .rb-xmodal { z-index: 4900; }
#rb-app .rb-dlg.rb-xdlg { max-width: 760px; overscroll-behavior: contain; }
#rb-app .rb-xdlg .rb-sec { margin: 0; }
#rb-app .rb-xdlg .rb-card { border: 0; padding: 0; background: none; }
#rb-app .rb-xdlg .rb-empty { padding: 30px 10px; }
/* ── clean layout: banner + office, nothing else ── */
#rb-app .pg-hero-actions { gap: 12px 18px; }
#rb-app .rb-dnav { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
#rb-app .rb-sqb { width: 42px; padding: 0; justify-content: center; }
#rb-app .pg-hero .pg-btn:disabled { opacity: .45; cursor: not-allowed; transform: none; box-shadow: none; }
/* ── date button and calendar ── */
#rb-app .rb-datebtn { gap: 10px; padding: 0 16px 0 14px; text-align: left; }
#rb-app .rb-datebtn .rb-dt { display: block; line-height: 1.15; }
#rb-app .rb-datebtn .rb-dt b { display: block; font-size: 14px; font-weight: 800; }
#rb-app .rb-datebtn .rb-dt small { display: block; margin-top: 1px; font-size: 11px; font-weight: 600; opacity: .9; }
#rb-app .rb-datebtn svg.rb-i { width: 18px; height: 18px; }
#rb-app .rb-datebtn .rb-car { width: 14px; height: 14px; opacity: .85; transition: transform .2s; }
#rb-app .rb-datebtn[aria-expanded="true"] .rb-car { transform: rotate(180deg); }
#rb-app .rb-cal { position: absolute; z-index: 4800; width: 318px; padding: 14px 14px 12px; border-radius: 20px; background: var(--rb-surface); border: 1px solid var(--rb-border); box-shadow: 0 24px 60px -18px rgba(15,23,42,.5), 0 4px 14px rgba(15,23,42,.08); animation: rbcal .2s cubic-bezier(.22,1,.36,1); }
#rb-app .rb-cal[hidden] { display: none; }
@keyframes rbcal { from { opacity: 0; transform: translateY(-8px) scale(.98); } to { opacity: 1; transform: none; } }
#rb-app .rb-ch { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
#rb-app .rb-ch b { font-size: 15px; font-weight: 800; letter-spacing: -.2px; color: var(--rb-text); }
#rb-app .rb-cn { width: 34px; height: 34px; border-radius: 11px; border: 1px solid var(--rb-border); background: var(--rb-surface); color: var(--rb-text); display: grid; place-items: center; transition: background-color .15s, border-color .15s; }
#rb-app .rb-cn:hover:not(:disabled) { background: var(--rb-brand-lt); border-color: var(--rb-brand-bd); }
#rb-app .rb-cn:disabled { opacity: .35; cursor: not-allowed; }
#rb-app .rb-cw, #rb-app .rb-cg { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
#rb-app .rb-cw span { text-align: center; font-size: 11px; font-weight: 700; color: var(--rb-text3); padding: 4px 0; text-transform: uppercase; letter-spacing: .04em; }
#rb-app .rb-cd { height: 38px; border: 0; border-radius: 12px; background: transparent; color: var(--rb-text); font-size: 13.5px; font-weight: 600; position: relative; transition: background-color .15s, transform .12s; }
#rb-app .rb-cd:hover:not(:disabled) { background: var(--rb-brand-lt); transform: scale(1.06); }
#rb-app .rb-cd.today { box-shadow: inset 0 0 0 2px var(--rb-brand-bd); font-weight: 800; }
#rb-app .rb-cd.sel, #rb-app .rb-cd.sel:hover { background: linear-gradient(135deg, #4F8EF7, #10B197); color: #fff; font-weight: 800; box-shadow: 0 8px 16px -8px rgba(47,111,228,.7); }
#rb-app .rb-cd:disabled { color: #A9B4C2; cursor: not-allowed; }
#rb-app .rb-cd.sun:disabled { background: repeating-linear-gradient(135deg, transparent 0 4px, rgba(152,162,179,.16) 4px 8px); }
#rb-app .rb-cd:focus-visible, #rb-app .rb-cn:focus-visible, #rb-app .rb-cq:focus-visible { outline: 2px solid var(--rb-brand); outline-offset: 2px; }
#rb-app .rb-cf { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--rb-border); }
#rb-app .rb-cq { height: 32px; padding: 0 14px; border-radius: 20px; border: 1px solid var(--rb-border2); background: var(--rb-surface); color: var(--rb-text2); font-size: 12.5px; font-weight: 700; }
#rb-app .rb-cq:hover:not(:disabled) { background: var(--rb-brand-lt); border-color: var(--rb-brand-bd); color: var(--rb-brand-dark); }
#rb-app .rb-cq:disabled { opacity: .4; cursor: not-allowed; }
#rb-app .rb-cnote { font-size: 11.5px; color: var(--rb-text3); }
/* ── date bar ── */
#rb-app .rb-dnav { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
#rb-app .rb-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 38px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--rb-border); background: var(--rb-surface); color: var(--rb-text); font-weight: 600; font-size: 13px; transition: background-color .18s, border-color .18s, box-shadow .22s, transform .15s; }
#rb-app .rb-btn:hover:not(:disabled) { background: var(--rb-brand-lt); border-color: var(--rb-brand-bd); }
#rb-app .rb-btn:active:not(:disabled) { transform: scale(.97); }
#rb-app .rb-btn:disabled { opacity: .45; cursor: not-allowed; }
#rb-app .rb-btn:focus-visible, #rb-app .rb-tile:focus-visible, #rb-app .rb-tmain:focus-visible, #rb-app .rb-quick:focus-visible, #rb-app .rb-rm:focus-visible, #rb-app .rb-blk:focus-visible, #rb-app .rb-chip:focus-visible { outline: 2px solid var(--rb-brand); outline-offset: 2px; }
#rb-app .rb-btn.pri { background: var(--rb-brand); border-color: var(--rb-brand); color: #fff; }
#rb-app .rb-btn.pri:hover:not(:disabled) { background: var(--rb-brand-dark); border-color: var(--rb-brand-dark); box-shadow: 0 10px 22px -10px var(--rb-brand); }
#rb-app .rb-btn.dng { color: var(--rb-red); border-color: var(--rb-red-bd); }
#rb-app .rb-btn.dng:hover:not(:disabled) { background: var(--rb-red-lt); border-color: var(--rb-red); }
#rb-app .rb-btn.sq { width: 38px; padding: 0; }

/* ── office map (3D) ── */
#rb-app .rb-map { position: relative; display: flex; flex-direction: column; margin-top: 10px; border-radius: 22px; overflow: hidden; background: linear-gradient(180deg, #F8FBFF 0%, #E9F0FC 100%); border: 1px solid var(--rb-border); }
#rb-app .rb-stage { position: relative; flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; perspective: 7000px; }
#rb-app .rb-none { text-align: center; color: var(--rb-text3); }
#rb-app .rb-none b { display: block; color: var(--rb-text); font-size: 15px; margin-bottom: 4px; }
/* ── look and feel shared with the other tabs ── */
#rb-app .rb-map { background: var(--glass, rgba(255,255,255,.72)); -webkit-backdrop-filter: blur(20px) saturate(160%); backdrop-filter: blur(20px) saturate(160%); border: 1px solid rgba(255,255,255,.85); border-radius: 18px; box-shadow: var(--shadow-md, 0 8px 24px rgba(15,23,42,.07)), inset 0 1px 0 rgba(255,255,255,.9); margin-top: 0; }
#rb-app .rb-map { background: none; border: 0; box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none; border-radius: 0; margin-top: 0; overflow: visible; }
#rb-app .rb-stage { padding-top: 40px; }
#rb-app .rb-scene { --rx: 48deg; --rz: -8deg; --k: 1; position: relative; width: 660px; height: 520px; flex: 0 0 auto; transform-style: preserve-3d; transform: rotateX(var(--rx)) rotateZ(var(--rz)) scale(var(--k)); background-color: #F2F5FA; background-image: linear-gradient(#E3E9F2 1px, transparent 1px), linear-gradient(90deg, #E3E9F2 1px, transparent 1px); background-size: 38px 38px; box-shadow: 0 0 0 2px #CBD5E3, 0 50px 70px -20px rgba(15,23,42,.35); }
#rb-app .rb-scene::after { content: ""; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,.28), rgba(30,50,90,.06)); pointer-events: none; transform: translateZ(.3px); }
#rb-app .rb-bx { position: absolute; transform-style: preserve-3d; pointer-events: none; }
#rb-app .rb-bx::before { content: ""; position: absolute; inset: -1px; background: rgba(15,23,42,.24); filter: blur(3px); transform: translate(3px, 4px) translateZ(.4px); border-radius: 3px; }
#rb-app .rb-bx i { position: absolute; display: block; background: var(--c); }
#rb-app .rb-bx .bt { inset: 0; transform: translateZ(var(--h)); }
#rb-app .rb-bx .bs { left: 0; top: 100%; width: 100%; height: var(--h); filter: brightness(.74); transform-origin: top; transform: rotateX(90deg); }
#rb-app .rb-bx .bw { top: 0; left: calc(-1 * var(--h)); width: var(--h); height: 100%; filter: brightness(.88); transform-origin: right; transform: rotateY(90deg); }
#rb-app .rb-bx.round::before, #rb-app .rb-bx.round i { border-radius: 40%; }
#rb-app .rb-bx.glass::before { display: none; }
#rb-app .rb-bx.glass i { background: rgba(150,200,240,.30); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.85); filter: none; }
#rb-app .rb-bx.glass .bt { background: rgba(120,170,215,.9); }
#rb-app .rb-flat { position: absolute; transform: translateZ(.6px); pointer-events: none; box-shadow: inset 0 0 0 2px rgba(255,255,255,.35); }
#rb-app .rb-bb { position: absolute; transform-origin: 50% 100%; transform: translateZ(var(--z, 0px)) rotateZ(calc(-1 * var(--rz))) rotateX(calc(-1 * var(--rx))); pointer-events: none; }
#rb-app .rb-crown { width: 24px; height: 24px; margin-left: -12px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #8EDB9B, #3FA05A 70%, #2E7D45); box-shadow: 0 6px 8px -4px rgba(15,23,42,.4); }
#rb-app .rb-ps { width: 26px; height: 46px; margin-left: -13px; display: flex; flex-direction: column; align-items: center; animation: rbbob 2.6s ease-in-out infinite; }
#rb-app .rb-ps .ph { width: 15px; height: 15px; border-radius: 50%; background: #F1C9A5; box-shadow: inset 0 -3px 0 rgba(0,0,0,.08); }
#rb-app .rb-ps .pb { margin-top: 1px; width: 24px; height: 28px; border-radius: 10px 10px 5px 5px; background: #E0524B; color: #fff; font-size: 9.5px; font-weight: 800; display: grid; place-items: center; font-style: normal; }
@keyframes rbbob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
#rb-app .rb-door { position: absolute; background: repeating-linear-gradient(90deg, #D7B58A 0 6px, #C9A57A 6px 12px); border-radius: 3px; transform: translateZ(1px); pointer-events: none; }
#rb-app .rb-entrymat { position: absolute; background: #FEF3E2; border: 2px dashed #E0A94F; border-radius: 6px; transform: translateZ(1px); pointer-events: none; }
#rb-app .rb-gate { position: absolute; width: 0; height: 0; transform-style: preserve-3d; pointer-events: none; }
#rb-app .rb-leaf { position: absolute; left: -20px; top: 0; width: 40px; height: 46px; box-sizing: border-box; padding: 3.5px; border-radius: 4px 4px 0 0; background: #5E3A1C; box-shadow: 0 8px 10px -6px rgba(15,23,42,.55); transform-origin: 50% 100%; transform: translateY(-100%) rotateZ(calc(-1 * var(--rz))) rotateX(calc(-1 * var(--rx))); }
#rb-app .rb-leaf::before { content: ""; position: absolute; inset: 3.5px; border-radius: 2px 2px 0 0; background: linear-gradient(90deg, #CC9B62 0%, #B9824A 60%, #A87440 100%); }
#rb-app .rb-leaf::after { content: ""; position: absolute; left: 8px; right: 8px; top: 8px; bottom: 8px; border-radius: 2px; border: 1.5px solid rgba(90,56,26,.5); }
#rb-app .rb-leaf i { position: absolute; right: 6px; top: 54%; width: 5px; height: 5px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #FFF2C2, #D9A441); box-shadow: 0 0 0 1px #5E3A1C; z-index: 2; }
#rb-app .rb-rm > .rb-md { top: 9px; right: 9px; transform: translateZ(.7px); }
#rb-app .rb-rm { --st: rgba(74,190,120,.20); position: absolute; background: linear-gradient(var(--st), var(--st)), repeating-linear-gradient(90deg, #F1E3CB 0 22px, #E9D8BB 22px 24px); cursor: pointer; outline: none; transform-style: preserve-3d; transition: box-shadow .25s; }
#rb-app .rb-rm.busy { --st: rgba(235,80,70,.26); }
#rb-app .rb-rm.closed { --st: rgba(140,150,165,.34); }
#rb-app .rb-rm:hover, #rb-app .rb-rm:focus-visible { box-shadow: inset 0 0 0 4px rgba(47,111,228,.45); }
#rb-app .rb-rm.on { box-shadow: inset 0 0 0 5px #2F6FE4; }
#rb-app .rb-lab { position: absolute; left: 50%; top: 50%; display: flex; flex-direction: row; align-items: center; gap: 8px; padding: 5px 12px 5px 6px; white-space: nowrap; text-align: left; border-radius: 14px; background: rgba(255,255,255,.95); border: 1px solid #D5DEEB; box-shadow: 0 10px 18px -10px rgba(15,23,42,.5); transform-origin: 50% 100%; transform: translate(-50%, -50%) translateZ(64px) rotateZ(calc(-1 * var(--rz))) rotateX(calc(-1 * var(--rx))); transition: transform .25s cubic-bezier(.22,1,.36,1); pointer-events: none; }
#rb-app .rb-rm.side .rb-lab { left: 100%; top: 50%; transform-origin: 0 100%; transform: translate(22px, -50%) translateZ(26px) rotateZ(calc(-1 * var(--rz))) rotateX(calc(-1 * var(--rx))); }
#rb-app .rb-rm.rev .rb-lab { left: auto; right: 100%; transform-origin: 100% 100%; transform: translate(-22px, -50%) translateZ(26px) rotateZ(calc(-1 * var(--rz))) rotateX(calc(-1 * var(--rx))); }
#rb-app .rb-rm.side:hover .rb-lab, #rb-app .rb-rm.side.on .rb-lab { transform: translate(22px, -50%) translateZ(40px) rotateZ(calc(-1 * var(--rz))) rotateX(calc(-1 * var(--rx))) scale(1.06); }
#rb-app .rb-rm.rev:hover .rb-lab, #rb-app .rb-rm.rev.on .rb-lab { transform: translate(-22px, -50%) translateZ(40px) rotateZ(calc(-1 * var(--rz))) rotateX(calc(-1 * var(--rx))) scale(1.06); }
#rb-app .rb-rm:hover .rb-lab, #rb-app .rb-rm.on .rb-lab { transform: translate(-50%, -50%) translateZ(82px) rotateZ(calc(-1 * var(--rz))) rotateX(calc(-1 * var(--rx))) scale(1.06); }
#rb-app .rb-mi { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 10px; background: var(--rb-surface2); color: var(--rb-text2); font-size: 18px; }
#rb-app .rb-rm.free .rb-mi { background: #E3F5EA; color: #1F7A4D; }
#rb-app .rb-rm.busy .rb-mi { background: #FDECEA; color: #B42318; }
#rb-app .rb-mt { display: block; }
#rb-app .rb-mt b { display: block; font-size: 13.5px; font-weight: 800; color: #1A2533; line-height: 1.2; white-space: nowrap; }
#rb-app .rb-mt small { display: none; margin-top: 2px; font-size: 11px; font-weight: 600; color: #5A6B7A; line-height: 1.25; }
#rb-app .rb-rm.sm .rb-lab { flex-direction: row; gap: 8px; padding: 5px 10px 5px 6px; max-width: none; }
#rb-app .rb-rm.sm .rb-mt small { display: none; }
#rb-app .rb-scene.sm-scale .rb-rm > .rb-md { width: calc(9px / var(--k)); height: calc(9px / var(--k)); top: calc(5px / var(--k)); right: calc(5px / var(--k)); }
#rb-app .rb-md { position: absolute; top: -3px; right: -3px; width: 10px; height: 10px; border-radius: 50%; background: #1F9D5C; border: 2px solid #fff; }
#rb-app .rb-rm.busy .rb-md { background: #D92D20; }
#rb-app .rb-rm.closed .rb-md { background: #98A2B3; }

/* ── room door displays (the tiles) ── */
#rb-app .rb-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; }
#rb-app .rb-tile { position: relative; display: flex; flex-direction: column; border-radius: 20px; background: var(--rb-surface); border: 1px solid var(--rb-border); overflow: hidden; transform-style: preserve-3d; transition: transform .18s ease-out, border-color .2s, box-shadow .25s; }
#rb-app .rb-tile:hover { border-color: var(--rb-border2); box-shadow: 0 18px 34px -22px rgba(15,23,42,.45); }
#rb-app .rb-tile.on { border: 2px solid var(--rb-brand); box-shadow: 0 0 0 4px rgba(47,111,228,.12), 0 18px 34px -22px rgba(47,111,228,.6); }
#rb-app .rb-tmain { display: block; width: 100%; text-align: left; padding: 0; border: 0; background: transparent; color: inherit; }
#rb-app .rb-tband { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 14px; font-size: 12px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; background: var(--rb-green-lt); color: var(--rb-green); border-bottom: 1px solid var(--rb-green-bd); transition: background-color .3s; }
#rb-app .rb-tile.busy .rb-tband { background: var(--rb-red-lt); color: var(--rb-red); border-color: var(--rb-red-bd); }
#rb-app .rb-tile.closed .rb-tband { background: var(--rb-surface2); color: var(--rb-text3); border-color: var(--rb-border); }
#rb-app .rb-lt { position: relative; width: 11px; height: 11px; border-radius: 50%; background: #1F9D5C; }
#rb-app .rb-tile.busy .rb-lt { background: #D92D20; }
#rb-app .rb-tile.closed .rb-lt { background: #98A2B3; }
#rb-app .rb-lt::after { content: ""; position: absolute; inset: -5px; border-radius: 50%; border: 2px solid #1F9D5C; opacity: 0; animation: rbping 2.2s ease-out infinite; }
#rb-app .rb-tile.busy .rb-lt::after { border-color: #D92D20; }
#rb-app .rb-tile.closed .rb-lt::after { display: none; }
@keyframes rbping { 0% { transform: scale(.6); opacity: .7; } 100% { transform: scale(1.9); opacity: 0; } }
#rb-app .rb-tbody { display: block; padding: 14px 14px 10px; }
#rb-app .rb-thead { display: flex; align-items: center; gap: 12px; }
#rb-app .rb-ri { width: 46px; height: 46px; border-radius: 15px; display: grid; place-items: center; font-size: 23px; background: var(--rb-surface2); color: var(--rb-text2); flex: 0 0 auto; transform: translateZ(30px); transition: background-color .25s, color .25s; }
#rb-app .rb-tile.free .rb-ri { background: var(--rb-green-lt); color: var(--rb-green); }
#rb-app .rb-tile.busy .rb-ri { background: var(--rb-red-lt); color: var(--rb-red); }
#rb-app .rb-rn { font-size: 16px; font-weight: 800; letter-spacing: -.3px; line-height: 1.2; }
#rb-app .rb-rl { font-size: 12px; color: var(--rb-text3); }
#rb-app .rb-quick { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 0 14px 14px; height: 38px; border-radius: 12px; border: 1px solid var(--rb-border); background: var(--rb-surface2); color: var(--rb-text); font-size: 13px; font-weight: 700; transition: background-color .18s, color .18s, border-color .18s, transform .15s; }
#rb-app .rb-quick:hover:not(:disabled) { background: var(--rb-brand); border-color: var(--rb-brand); color: #fff; }
#rb-app .rb-quick:active:not(:disabled) { transform: scale(.97); }
#rb-app .rb-quick:disabled { opacity: .5; cursor: not-allowed; }
#rb-app .rb-pop { animation: rbpop .9s ease-out 2; }
@keyframes rbpop { 0% { transform: scale(1); } 40% { transform: scale(1.05); } 100% { transform: scale(1); } }

/* ── day panel ── */
#rb-app .rb-panel { margin-top: 16px; padding: 16px 18px 18px; border-radius: 20px; background: var(--rb-surface); border: 1px solid var(--rb-border); animation: rbrise .35s cubic-bezier(.22,1,.36,1); }
@keyframes rbrise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
#rb-app .rb-rmodal { z-index: 4900; }
#rb-app .rb-fl { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 0 10px; text-align: center; pointer-events: none; transform: translateZ(.7px); }
#rb-app .rb-fl b { display: block; font-size: 17px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #27303F; text-shadow: 0 1px 0 rgba(255,255,255,.85), 0 0 6px rgba(255,255,255,.7); white-space: nowrap; }
#rb-app .rb-fl small { display: inline-block; padding: 3px 11px; border-radius: 999px; font-size: 11.5px; font-weight: 800; letter-spacing: .03em; color: #fff; background: #1F9D5C; box-shadow: 0 3px 8px -3px rgba(15,23,42,.45); white-space: nowrap; }
#rb-app .rb-rm.busy .rb-fl small { background: #D92D20; }
#rb-app .rb-rm.closed .rb-fl small { background: #7B8798; }
#rb-app .rb-fl { padding-bottom: 14px; }
#rb-app .rb-rm.sm .rb-fl { flex-direction: row; gap: 10px; justify-content: center; align-items: flex-start; padding: 7px 8px 0; }
#rb-app .rb-rm.sm .rb-fl b { font-size: 14.5px; }
#rb-app .rb-rm.sm .rb-fl small { padding: 2px 9px; font-size: 10.5px; }
#rb-app .rb-scene.sm-scale .rb-fl { gap: calc(3px / var(--k)); }
#rb-app .rb-scene.sm-scale .rb-fl b { font-size: calc(12px / var(--k)); letter-spacing: .04em; }
#rb-app .rb-scene.sm-scale .rb-fl small { display: none; }
#rb-app .rb-rm { --ring: rgba(31,157,92,.55); --glow: rgba(74,190,120,.28); box-shadow: inset 0 0 0 3px var(--ring), inset 0 0 46px var(--glow); }
#rb-app .rb-rm.busy { --ring: rgba(217,45,32,.5); --glow: rgba(235,80,70,.30); }
#rb-app .rb-rm.closed { --ring: rgba(123,135,152,.5); --glow: rgba(140,150,165,.25); }
#rb-app .rb-rm:hover, #rb-app .rb-rm:focus-visible { box-shadow: inset 0 0 0 4px rgba(47,111,228,.6), inset 0 0 46px rgba(47,111,228,.22); }
#rb-app .rb-rm.on { box-shadow: inset 0 0 0 5px #2F6FE4, inset 0 0 46px rgba(47,111,228,.28); }
#rb-app .rb-dlg.rb-rdlg { max-width: 780px; padding: 18px 22px 22px; overscroll-behavior: contain; }
#rb-app .rb-rdlg .rb-panel { margin: 0; padding: 0; border: 0; background: none; animation: none; }
#rb-app .rb-phl { display: flex; align-items: center; gap: 12px; min-width: 0; }
#rb-app .rb-mi2 { display: grid; place-items: center; width: 46px; height: 46px; flex: 0 0 auto; border-radius: 15px; font-size: 23px; background: var(--rb-surface2); color: var(--rb-text2); }
#rb-app .rb-mi2.free { background: var(--rb-green-lt); color: var(--rb-green); }
#rb-app .rb-mi2.busy { background: var(--rb-red-lt); color: var(--rb-red); }
#rb-app .rb-ph .rb-phs { display: inline-block; margin-top: 3px; padding: 2px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; background: var(--rb-green-lt); color: var(--rb-green); border: 1px solid var(--rb-green-bd); }
#rb-app .rb-ph .rb-phs.busy { background: var(--rb-red-lt); color: var(--rb-red); border-color: var(--rb-red-bd); }
#rb-app .rb-ph .rb-phs.closed { background: var(--rb-surface2); color: var(--rb-text2); border-color: var(--rb-border); }
#rb-app .rb-ph { align-items: center; flex-wrap: nowrap; margin-bottom: 10px; }
#rb-app .rb-ph .rb-x { flex: 0 0 auto; }
#rb-app .rb-rhint { margin: 0 0 22px; font-size: 12.5px; color: var(--rb-text3); }
#rb-app .rb-ph { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
#rb-app .rb-ph h3 { margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -.3px; }
#rb-app .rb-ph span { font-size: 12.5px; color: var(--rb-text3); }
#rb-app .rb-stripw { position: relative; padding-top: 30px; }
#rb-app .rb-hrs { position: absolute; left: 0; right: 0; top: 8px; display: grid; grid-template-columns: repeat(10, 1fr); font-size: 11px; color: var(--rb-text3); }
#rb-app .rb-strip { position: relative; display: grid; grid-template-columns: repeat(40, minmax(0, 1fr)); height: 56px; border-radius: 14px; overflow: hidden; background: var(--rb-surface2); border: 1px solid var(--rb-border); touch-action: none; user-select: none; -webkit-user-select: none; }
#rb-app .rb-strip.dis { touch-action: auto; }
#rb-app .rb-c { border-right: 1px solid var(--rb-border); cursor: pointer; transition: background-color .12s; }
#rb-app .rb-c:nth-child(4n) { border-right-color: var(--rb-border2); }
#rb-app .rb-c:last-of-type { border-right: 0; }
#rb-app .rb-c.free:hover { background: var(--rb-green-lt); }
#rb-app .rb-c.off { cursor: not-allowed; background: repeating-linear-gradient(135deg, transparent 0 5px, rgba(152,162,179,.16) 5px 10px); }
#rb-app .rb-c.sel { background: var(--rb-brand-lt) !important; box-shadow: inset 0 0 0 100px rgba(47,111,228,.24); }
#rb-app .rb-tip { position: absolute; z-index: 6; top: -14px; transform: translateX(-50%); padding: 3px 10px; border-radius: 8px; background: #1A2533; color: #fff; font-size: 12px; font-weight: 700; white-space: nowrap; pointer-events: none; transition: left .08s linear; }
#rb-app .rb-tip::after { content: ""; position: absolute; left: 50%; bottom: -4px; width: 8px; height: 8px; background: #1A2533; transform: translateX(-50%) rotate(45deg); }
#rb-app .rb-blk { position: absolute; top: 4px; bottom: 4px; border-radius: 10px; padding: 0 9px; display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 700; overflow: hidden; white-space: nowrap; text-align: left; background: #E7EAF0; color: #3F4A5A; border: 1px solid #C5CCD8; transition: transform .15s, box-shadow .2s; z-index: 2; }
#rb-app .rb-blk:hover { transform: translateY(-2px); box-shadow: 0 10px 18px -10px rgba(15,23,42,.5); }
#rb-app .rb-blk.me { background: var(--rb-green-lt); color: var(--rb-green); border-color: var(--rb-green-bd); }
#rb-app .rb-blk.fresh { animation: rbdrop .55s cubic-bezier(.34,1.56,.64,1); }
@keyframes rbdrop { from { transform: translateY(-30px) scale(.9); opacity: 0; } to { transform: none; opacity: 1; } }
#rb-app .rb-blk .rb-in { flex: 0 0 auto; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 10px; font-weight: 800; background: rgba(255,255,255,.75); color: inherit; }
#rb-app .rb-now { position: absolute; top: 0; bottom: 0; width: 2px; background: #D92D20; z-index: 3; pointer-events: none; }
#rb-app .rb-now::before { content: ""; position: absolute; top: -3px; left: -3px; width: 8px; height: 8px; border-radius: 50%; background: #D92D20; }
#rb-app .rb-note { margin: 12px 0 0; font-size: 13px; color: var(--rb-text2); }
#rb-app .rb-list { margin-top: 14px; border-top: 1px solid var(--rb-border); }
#rb-app .rb-li { display: flex; align-items: center; gap: 12px; width: 100%; padding: 11px 6px; border: 0; border-bottom: 1px solid var(--rb-border); background: transparent; color: var(--rb-text); text-align: left; border-radius: 0; transition: background-color .15s; }
#rb-app .rb-li:hover { background: var(--rb-surface2); }
#rb-app .rb-li .t { flex: 0 0 150px; font-size: 13px; font-weight: 700; }
#rb-app .rb-li .m { flex: 1; min-width: 0; }
#rb-app .rb-li .m b { display: block; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#rb-app .rb-li .m small { color: var(--rb-text3); font-size: 12px; }
#rb-app .rb-tag { flex: 0 0 auto; font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 20px; background: var(--rb-surface2); border: 1px solid var(--rb-border); color: var(--rb-text2); }
#rb-app .rb-tag.me { background: var(--rb-green-lt); border-color: var(--rb-green-bd); color: var(--rb-green); }

/* ── booking form ── */
#rb-app .rb-form { margin-top: 14px; padding: 16px; border-radius: 16px; background: var(--rb-brand-lt); border: 1px solid var(--rb-brand-bd); animation: rbrise .3s cubic-bezier(.22,1,.36,1); }
#rb-app .rb-sum { font-size: 16px; font-weight: 800; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
#rb-app .rb-sum span { font-weight: 500; font-size: 13px; color: var(--rb-text2); }
#rb-app .rb-chip { height: 34px; padding: 0 14px; border-radius: 20px; border: 1px solid var(--rb-border2); background: var(--rb-surface); color: var(--rb-text2); font-size: 12.5px; font-weight: 700; transition: background-color .15s, border-color .15s, color .15s, transform .12s; }
#rb-app .rb-chip:hover { border-color: var(--rb-brand-bd); }
#rb-app .rb-chip:active { transform: scale(.95); }
#rb-app .rb-custom { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; margin: 0 0 10px; padding: 10px 12px; border-radius: 12px; background: var(--rb-surface); border: 1px dashed var(--rb-brand-bd); }
#rb-app .rb-custom label { display: flex; flex-direction: column; gap: 3px; font-size: 12px; font-weight: 700; color: var(--rb-text); }
#rb-app .rb-custom input, #rb-app .rb-custom select { width: 86px; height: 38px; padding: 0 10px; border: 1px solid var(--rb-border2); border-radius: 10px; background: var(--rb-surface); color: var(--rb-text); font: inherit; font-size: 14px; }
#rb-app .rb-custom input:focus, #rb-app .rb-custom select:focus { outline: 0; border-color: var(--rb-brand); box-shadow: 0 0 0 3px rgba(47,111,228,.2); }
#rb-app .rb-chint { font-size: 12px; color: var(--rb-text3); align-self: center; }
#rb-app .rb-chip:disabled { opacity: .38; cursor: not-allowed; }
#rb-app .rb-chip:disabled:hover { border-color: var(--rb-border2); }
#rb-app .rb-chip.on { background: var(--rb-brand); border-color: var(--rb-brand); color: #fff; }
#rb-app .rb-field { display: block; margin-top: 10px; }
#rb-app .rb-field > span { display: block; margin-bottom: 4px; font-size: 12px; font-weight: 700; color: var(--rb-text); }
#rb-app .rb-field input, #rb-app .rb-field textarea, #rb-app .rb-field select { width: 100%; padding: 11px 12px; border: 1px solid var(--rb-border2); border-radius: 12px; background: var(--rb-surface); color: var(--rb-text); font: inherit; font-size: 14px; }
#rb-app .rb-field textarea { min-height: 64px; resize: vertical; }
#rb-app .rb-field input:focus, #rb-app .rb-field textarea:focus, #rb-app .rb-field select:focus { outline: 0; border-color: var(--rb-brand); box-shadow: 0 0 0 3px rgba(47,111,228,.2); }
#rb-app .rb-field.bad input { border-color: var(--rb-red); }
#rb-app .rb-err { margin: 4px 0 0; font-size: 12.5px; color: var(--rb-red); }
#rb-app .rb-row2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
#rb-app .rb-act { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
#rb-app .rb-link { border: 0; background: none; padding: 0; color: var(--rb-brand-dark); font-weight: 700; font-size: 13px; }
#rb-app .rb-link:hover { text-decoration: underline; }
#rb-app .rb-att { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
#rb-app .rb-pill { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 6px 0 11px; border-radius: 20px; background: var(--rb-surface); border: 1px solid var(--rb-border2); font-size: 12.5px; }
#rb-app .rb-pill button { border: 0; background: none; padding: 0; width: 20px; height: 20px; border-radius: 50%; color: var(--rb-text3); display: grid; place-items: center; }
#rb-app .rb-pill button:hover { background: var(--rb-red-lt); color: var(--rb-red); }
#rb-app .rb-sug { position: relative; }
#rb-app .rb-sug ul { position: absolute; z-index: 20; left: 0; right: 0; top: 100%; margin: 4px 0 0; padding: 4px; list-style: none; max-height: 220px; overflow-y: auto; background: var(--rb-surface); border: 1px solid var(--rb-border2); border-radius: 12px; box-shadow: 0 16px 30px -16px rgba(15,23,42,.4); }
#rb-app .rb-sug li { padding: 8px 10px; border-radius: 8px; cursor: pointer; font-size: 13px; }
#rb-app .rb-sug li small { display: block; color: var(--rb-text3); font-size: 11.5px; }
#rb-app .rb-sug li:hover { background: var(--rb-brand-lt); }

/* ── my bookings / rooms ── */
#rb-app .rb-sec { margin-top: 16px; }
#rb-app .rb-card { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 20px; padding: 6px 18px 10px; }
#rb-app .rb-day { margin: 14px 0 4px; font-size: 12px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--rb-text3); }
#rb-app .rb-empty { padding: 44px 16px; text-align: center; color: var(--rb-text3); }
#rb-app .rb-empty b { display: block; font-size: 15px; color: var(--rb-text); margin-bottom: 4px; }
#rb-app .rb-rr { display: grid; grid-template-columns: 38px minmax(0, 1.4fr) minmax(0, 1fr) auto auto; gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--rb-border); }
#rb-app .rb-rr:last-child { border-bottom: 0; }
#rb-app .rb-rr .rb-ri2 { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; background: var(--rb-surface2); color: var(--rb-text2); font-size: 19px; }
#rb-app .rb-rr input[type=text] { width: 100%; padding: 8px 10px; border: 1px solid var(--rb-border2); border-radius: 10px; background: var(--rb-surface); color: var(--rb-text); font: inherit; font-size: 14px; }
#rb-app .rb-swt { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--rb-text2); }

/* ── popup ── */
#rb-app .rb-modal { position: fixed; inset: 0; z-index: 5000; display: none; align-items: center; justify-content: center; padding: 16px; background: rgba(15,23,42,.5); backdrop-filter: blur(3px); }
#rb-app .rb-modal.open { display: flex; animation: rbfade .15s ease; }
@keyframes rbfade { from { opacity: 0; } to { opacity: 1; } }
#rb-app .rb-dlg { width: 100%; max-width: 520px; max-height: 92dvh; overflow-y: auto; background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 22px; box-shadow: 0 30px 80px -20px rgba(15,23,42,.5); animation: rbdlg .22s cubic-bezier(.2,.8,.3,1); }
@keyframes rbdlg { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: none; } }
#rb-app .rb-dh { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 18px 22px 12px; }
#rb-app .rb-dh h3 { margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -.3px; }
#rb-app .rb-dh p { margin: 2px 0 0; font-size: 12.5px; color: var(--rb-text3); }
#rb-app .rb-x { width: 32px; height: 32px; border-radius: 50%; border: 0; background: transparent; color: var(--rb-text3); display: grid; place-items: center; }
#rb-app .rb-x:hover { background: var(--rb-brand-lt); color: var(--rb-brand-dark); }
#rb-app .rb-db { padding: 0 22px 20px; }
#rb-app .rb-kv { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 8px 12px; margin: 4px 0 6px; font-size: 14px; }
#rb-app .rb-kv dt { color: var(--rb-text3); font-size: 12.5px; padding-top: 1px; }
#rb-app .rb-kv dd { margin: 0; overflow-wrap: anywhere; }
#rb-app .rb-toast { position: fixed; left: 50%; bottom: 28px; z-index: 6000; transform: translate(-50%, 20px); max-width: min(92vw, 460px); padding: 11px 18px; border-radius: 12px; background: #1A2533; color: #fff; font-size: 13.5px; font-weight: 500; opacity: 0; pointer-events: none; transition: opacity .2s, transform .25s cubic-bezier(.22,1,.36,1); }
#rb-app .rb-toast.show { opacity: 1; transform: translate(-50%, 0); }
#rb-app .rb-toast.err { background: #B42318; }
#rb-app .rb-toast.ok { background: #1F7A4D; }
#rb-app .rb-conf { position: fixed; z-index: 6500; left: 0; top: 0; width: 0; height: 0; pointer-events: none; }
#rb-app .rb-conf i { position: absolute; width: 8px; height: 12px; border-radius: 2px; opacity: 0; animation: rbconf 1s cubic-bezier(.2,.8,.3,1) forwards; }
@keyframes rbconf { 0% { opacity: 1; transform: translate(0,0) rotate(0); } 100% { opacity: 0; transform: translate(var(--dx), var(--dy)) rotate(var(--rt)); } }

/* ── tablets and phones ── */
@media (max-width: 760px) {
  #rb-app .rb-dnav .rb-datebtn { order: 5; flex: 1 1 100%; justify-content: flex-start; }
  #rb-app .rb-cal { position: fixed; left: 10px; right: 10px; bottom: 10px; width: auto; max-width: 420px; margin: 0 auto; z-index: 5200; padding: 16px 14px 14px; }
  #rb-app .rb-cd { height: 42px; }
  #rb-app .rb-dnav { width: 100%; }
  #rb-app .rb-tabs { display: flex; flex-wrap: wrap; width: 100%; gap: 8px; }
  #rb-app #rb-free { flex: 1 1 100%; justify-content: center; }
  #rb-app .rb-tab { flex: 1 1 0; justify-content: center; padding: 0 10px; }
  #rb-app .rb-stage { padding-top: 0; }
  #rb-app .pg-hero { padding: 18px 16px; margin-bottom: 12px; }
  #rb-app .stats-row { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px; }
  #rb-app .stat-card { padding: 10px; flex-direction: column; align-items: flex-start; gap: 6px; }
  #rb-app .stat-icon { width: 32px; height: 32px; font-size: 16px; border-radius: 10px; }
  #rb-app .stat-value { font-size: 19px; margin-bottom: 2px; }
  #rb-app .stat-label { font-size: 11px; line-height: 1.25; }
  #rb-app .page-header { margin-bottom: 12px; }
  #rb-app .page-header .rb-tabs { width: 100%; }
  #rb-app .rb-hrow { display: block; margin-top: 0; }
  #rb-app .rb-hrow .rb-stats { margin-top: 12px; }
  #rb-app .rb-hrow .rb-tabs { margin-top: 12px; }
  #rb-app .rb-hero { border-radius: 20px; padding: 16px 16px 14px; }
  #rb-app .rb-title { font-size: 21px; }
  #rb-app .rb-sub { display: none; }
  #rb-app .rb-ico { width: 46px; height: 46px; border-radius: 15px; }
  #rb-app .rb-ico svg { width: 27px; height: 27px; }
  #rb-app .rb-clock { font-size: 24px; }
  #rb-app .rb-clock small { display: none; }
  #rb-app .rb-top { flex-wrap: nowrap; }
  #rb-app .rb-stats { gap: 6px; margin-top: 12px; }
  #rb-app .rb-st { height: 30px; padding: 0 11px; font-size: 12px; }
  #rb-app .rb-dnav { width: 100%; }
  #rb-app .rb-tiles { display: flex; overflow-x: auto; gap: 12px; padding: 4px 2px 10px; scroll-snap-type: x mandatory; scrollbar-width: none; }
  #rb-app .rb-tiles::-webkit-scrollbar { display: none; }
  #rb-app .rb-tile { flex: 0 0 232px; scroll-snap-align: start; transform-style: flat; }
  #rb-app .rb-tile * { transform: none !important; }
  #rb-app .rb-panel { padding: 14px; }
  #rb-app .rb-li .t { flex-basis: 112px; }
  #rb-app .rb-row2 { grid-template-columns: minmax(0, 1fr); }
  #rb-app .rb-rr { grid-template-columns: 38px minmax(0, 1fr); }
  #rb-app .rb-rr > *:nth-child(n+3) { grid-column: 2; }
  #rb-app .rb-modal { padding: 0; align-items: flex-end; }
  #rb-app .rb-dlg { max-width: none; border-radius: 22px 22px 0 0; animation: rbsheet .3s cubic-bezier(.22,1,.36,1); }
  @keyframes rbsheet { from { transform: translateY(100%); } to { transform: none; } }
  #rb-app .rb-rdlg { padding: 22px 16px 26px; }
  #rb-app .rb-rdlg::before { content: ""; position: absolute; left: 50%; top: 8px; width: 38px; height: 4px; margin-left: -19px; border-radius: 4px; background: var(--rb-border2); }
  #rb-app .rb-rdlg { position: relative; }
  #rb-app .rb-btn { min-height: 42px; }
}
@media (prefers-reduced-motion: reduce) {
  #rb-app *, #rb-app *::before, #rb-app *::after { animation: none !important; transition: none !important; }
}
/* ── popup polish: slim header, hover card, "yours" rooms, who is in a room, closed-day note ── */
#rb-app .pg-hero { padding: 12px 18px; margin-bottom: 10px; border-radius: 18px; gap: 10px 18px; }
#rb-app .pg-hero-lead { gap: 12px; }
#rb-app .pg-hero-ico { width: 44px; height: 44px; border-radius: 14px; }
#rb-app .pg-hero-ico svg, #rb-app .pg-hero-ico .hero-color-ico { width: 27px; height: 27px; }
#rb-app .pg-hero-title { font-size: 22px; margin: 0 0 2px; letter-spacing: -.6px; }
#rb-app .pg-hero-sub { font-size: 12.5px; }
#rb-app .pg-hero .pg-btn { min-height: 38px; padding: 0 14px; font-size: 13px; border-radius: 12px; }
#rb-app .rb-sqb { width: 38px; }
@media (min-width: 761px) { #rb-app .pg-hero { position: sticky; top: 0; z-index: 20; } }
#rb-app .rb-rm.mine { --st: rgba(79,142,247,.30); --ring: rgba(47,111,228,.7); --glow: rgba(79,142,247,.34); }
#rb-app .rb-rm.mine .rb-fl small { background: #2F6FE4; }
#rb-app .rb-rm.mine .rb-md { background: #2F6FE4; }
#rb-app .rb-fw { display: block; max-width: 92%; margin-top: 3px; padding: 0 6px; font-size: 11.5px; font-weight: 700; color: #3B4658; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 0 5px #fff, 0 0 5px #fff; }
#rb-app .rb-tip2 { position: fixed; z-index: 5600; max-width: 290px; padding: 12px 14px; border-radius: 14px; background: #111B2E; color: #fff; box-shadow: 0 18px 40px -12px rgba(0,0,0,.65); pointer-events: none; font-size: 12.5px; line-height: 1.4; }
#rb-app .rb-tip2.in { animation: rbfade .14s ease; }
#rb-app .rb-tip2[hidden] { display: none; }
#rb-app .rb-tip2 b { display: block; font-size: 14.5px; font-weight: 800; letter-spacing: -.2px; }
#rb-app .rb-tip2 .st { display: inline-block; margin: 5px 0 7px; padding: 2px 10px; border-radius: 99px; font-weight: 800; font-size: 11px; background: #1F9D5C; }
#rb-app .rb-tip2 .st.busy { background: #D92D20; }
#rb-app .rb-tip2 .st.mine { background: #2F6FE4; }
#rb-app .rb-tip2 .st.closed { background: #64748B; }
#rb-app .rb-tip2 .ti { display: block; font-weight: 700; font-size: 13px; }
#rb-app .rb-tip2 small { display: block; opacity: .8; font-size: 12px; }
#rb-app .rb-tip2 .nx { display: block; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.14); }
#rb-app .rb-tip2 em { display: block; margin-top: 8px; font-style: normal; opacity: .65; font-size: 11.5px; }
#rb-app .rb-note2 { position: absolute; top: 8px; left: 50%; transform: translateX(-50%); z-index: 4; max-width: 90%; padding: 9px 20px; border-radius: 99px; background: rgba(15,23,42,.9); color: #fff; font-size: 13px; font-weight: 700; text-align: center; box-shadow: 0 12px 26px -10px rgba(15,23,42,.6); animation: rbrise .3s cubic-bezier(.22,1,.36,1); }
#rb-app .rb-note2[hidden] { display: none; }
/* ── cleaner colours: pastel floors instead of striped wood, soft gradient name pills ── */
#rb-app .rb-rm { --st: rgba(34,197,94,.20); background: linear-gradient(135deg, rgba(255,255,255,.62), rgba(255,255,255,0) 62%), linear-gradient(var(--st), var(--st)), #fff; }
#rb-app .rb-rm.busy { --st: rgba(239,68,68,.20); --ring: rgba(239,68,68,.55); --glow: rgba(248,113,113,.30); }
#rb-app .rb-rm.closed { --st: rgba(100,116,139,.22); }
#rb-app .rb-rm.mine { --st: rgba(59,130,246,.24); --ring: rgba(37,99,235,.7); --glow: rgba(96,165,250,.34); }
#rb-app .rb-fl small { background: linear-gradient(135deg, #34D399, #10B981); box-shadow: 0 6px 12px -6px rgba(16,185,129,.7); }
#rb-app .rb-rm.busy .rb-fl small { background: linear-gradient(135deg, #F87171, #DC2626); box-shadow: 0 6px 12px -6px rgba(220,38,38,.7); }
#rb-app .rb-rm.closed .rb-fl small { background: linear-gradient(135deg, #94A3B8, #64748B); box-shadow: none; }
#rb-app .rb-rm.mine .rb-fl small { background: linear-gradient(135deg, #60A5FA, #2563EB); box-shadow: 0 6px 12px -6px rgba(37,99,235,.7); }
#rb-app .rb-fl b { color: #1E293B; letter-spacing: .09em; }
#rb-app .rb-scene { background-color: #EDF2F9; background-image: radial-gradient(#D3DDEC 1.2px, transparent 1.4px); background-size: 24px 24px; }
/* ── depth: lit walls, glossy glass, soft shadows in the corners, far end fading into haze, glowing room lamps ── */
#rb-app .rb-stage { perspective: 3600px; }
#rb-app .rb-map { overflow: hidden; }
#rb-app .rb-scene { transition: transform .35s cubic-bezier(.22,1,.36,1); }
#rb-app .rb-bx .bs, #rb-app .rb-bx .bw { background-image: linear-gradient(180deg, rgba(255,255,255,.26), rgba(15,23,42,.18)); }
#rb-app .rb-bx .bt { background-image: linear-gradient(135deg, rgba(255,255,255,.5), rgba(255,255,255,0) 60%); }
#rb-app .rb-bx.glass .bs, #rb-app .rb-bx.glass .bw { background-image: linear-gradient(180deg, rgba(255,255,255,.62), rgba(170,210,248,.22) 38%, rgba(110,165,230,.38)); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.95), inset 0 -10px 14px -10px rgba(50,100,190,.4); }
#rb-app .rb-bx.glass .bt { background: linear-gradient(135deg, #A9C8F2, #6E9BD8); }
#rb-app .rb-rm::before { content: ""; position: absolute; inset: 0; pointer-events: none; box-shadow: inset 0 22px 26px -16px rgba(15,23,42,.30), inset 16px 0 20px -14px rgba(15,23,42,.22); }
#rb-app .rb-scene::after { background: linear-gradient(180deg, rgba(255,255,255,.55), rgba(255,255,255,0) 52%), linear-gradient(135deg, rgba(255,255,255,.16), rgba(30,50,90,.07)); }
#rb-app .rb-leaf { height: 54px; transition: transform .35s cubic-bezier(.22,1,.36,1); }
#rb-app .rb-lampw { width: 0; height: 0; transition: transform .35s cubic-bezier(.22,1,.36,1); }
#rb-app .rb-lamp { position: absolute; left: -8px; top: -8px; width: 16px; height: 16px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #D9FCE8, #22C55E 55%, #15803D); box-shadow: 0 0 0 3px rgba(255,255,255,.9), 0 0 16px 4px rgba(34,197,94,.75); }
#rb-app .rb-lamp.busy { background: radial-gradient(circle at 35% 30%, #FFE0DC, #EF4444 55%, #B91C1C); box-shadow: 0 0 0 3px rgba(255,255,255,.9), 0 0 16px 4px rgba(239,68,68,.8); }
#rb-app .rb-lamp.mine { background: radial-gradient(circle at 35% 30%, #DCEBFF, #3B82F6 55%, #1D4ED8); box-shadow: 0 0 0 3px rgba(255,255,255,.9), 0 0 16px 4px rgba(59,130,246,.8); }
#rb-app .rb-lamp.closed { background: radial-gradient(circle at 35% 30%, #F1F5F9, #94A3B8 55%, #64748B); box-shadow: 0 0 0 3px rgba(255,255,255,.9); }
@media (prefers-reduced-motion: no-preference) { #rb-app .rb-lamp.busy, #rb-app .rb-lamp.mine { animation: rblamp 2s ease-in-out infinite; } @keyframes rblamp { 0%, 100% { box-shadow: 0 0 0 3px rgba(255,255,255,.9), 0 0 10px 2px currentColor; } 50% { box-shadow: 0 0 0 3px rgba(255,255,255,.9), 0 0 22px 7px currentColor; } } #rb-app .rb-lamp.busy { color: rgba(239,68,68,.85); } #rb-app .rb-lamp.mine { color: rgba(59,130,246,.85); } }
@media (max-width: 760px) { #rb-app .rb-stage { perspective: 7000px; } }
/* ── the office builds itself when the popup opens, and the light follows the time of day ── */
@property --h { syntax: '<length>'; inherits: true; initial-value: 0px; }
@keyframes rbrise3d { from { --h: 0px; } }
@keyframes rbfloorin { from { opacity: 0; } }
#rb-app .rb-scene.rb-intro .rb-bx { animation: rbrise3d 1s cubic-bezier(.22,1,.36,1) backwards; }
#rb-app .rb-scene.rb-intro .rb-bx.glass { animation-delay: .2s; }
#rb-app .rb-scene.rb-intro .rb-rm, #rb-app .rb-scene.rb-intro .rb-door { animation: rbfloorin .6s ease backwards; }
#rb-app .rb-scene.rb-intro .rb-lampw { animation: rbfloorin .6s ease .8s backwards; }
#rb-app .rb-scene::after { background: linear-gradient(var(--tint, transparent), var(--tint, transparent)), linear-gradient(180deg, rgba(255,255,255,.55), rgba(255,255,255,0) 52%), linear-gradient(135deg, rgba(255,255,255,.16), rgba(30,50,90,.07)); }
@media (prefers-reduced-motion: reduce) { #rb-app .rb-scene.rb-intro .rb-bx, #rb-app .rb-scene.rb-intro .rb-rm, #rb-app .rb-scene.rb-intro .rb-door, #rb-app .rb-scene.rb-intro .rb-lampw { animation: none; } }
/* ── time travel bar, route lines, wood floors, glossy open floor, lift on hover ── */
#rb-app .rb-routes { position: absolute; left: 0; top: 0; pointer-events: none; transform: translateZ(1.4px); overflow: visible; }
#rb-app .rb-route { fill: none; stroke: #2F6FE4; stroke-width: 6; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1 15; opacity: 0; transition: opacity .25s; filter: drop-shadow(0 0 5px rgba(47,111,228,.9)); }
#rb-app .rb-route.on { opacity: .95; animation: rbroute 1.1s linear infinite; }
@keyframes rbroute { to { stroke-dashoffset: -32; } }
#rb-app .rb-rm { background-color: #fff; background-image: repeating-linear-gradient(90deg, rgba(125,90,55,0) 0 46px, rgba(125,90,55,.10) 46px 47px), linear-gradient(135deg, rgba(255,255,255,.62), rgba(255,255,255,0) 62%), linear-gradient(var(--st), var(--st)); transition: transform .25s cubic-bezier(.22,1,.36,1), box-shadow .25s ease; }
#rb-app .rb-rm:hover, #rb-app .rb-rm:focus-visible { transform: translateZ(9px); }
#rb-app .rb-scene { background-color: #E9EFF8; background-image: radial-gradient(ellipse at 38% 26%, rgba(255,255,255,.8), rgba(255,255,255,0) 58%), linear-gradient(rgba(140,158,190,.22) 1px, transparent 1px), linear-gradient(90deg, rgba(140,158,190,.22) 1px, transparent 1px); background-size: auto, 64px 64px, 64px 64px; }
#rb-app .rb-prog { display: block; width: 72%; max-width: 160px; height: 5px; margin: 7px auto 0; border-radius: 99px; background: rgba(15,23,42,.16); overflow: hidden; }
#rb-app .rb-prog i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #F87171, #DC2626); }
#rb-app .rb-prog.mine i { background: linear-gradient(90deg, #60A5FA, #2563EB); }
/* ── small rooms: keep the name clear of the glass wall in front ── */
#rb-app .rb-rm.sm .rb-fl { justify-content: flex-start; padding-top: 6px; padding-bottom: 0; gap: 3px; }
#rb-app .rb-rm.sm .rb-fl b { font-size: 14px; }
/* ── speed: no filters or blurs on the 3D walls, no per-frame animations on the map ── */
#rb-app .rb-bx::before { filter: none; background: rgba(15,23,42,.16); }
#rb-app .rb-bx .bs { filter: none; background-image: linear-gradient(180deg, rgba(255,255,255,.08), rgba(15,23,42,.40)); }
#rb-app .rb-bx .bw { filter: none; background-image: linear-gradient(180deg, rgba(255,255,255,.14), rgba(15,23,42,.28)); }
#rb-app .rb-scene.rb-intro .rb-bx { animation: none; }
#rb-app .rb-scene { transition: none; }
#rb-app .rb-lamp.busy, #rb-app .rb-lamp.mine { animation: none !important; }
#rb-app .rb-modal { backdrop-filter: none; -webkit-backdrop-filter: none; }
#rb-app .pg-blob { display: none; }
#rb-app .pg-hero { backdrop-filter: none; -webkit-backdrop-filter: none; }
#rb-app .rb-scene { box-shadow: 0 0 0 2px #CBD5E3, 0 22px 34px -18px rgba(15,23,42,.30); }
/* ── phone: a compact two-row header and labels you can actually read ── */
@media (max-width: 760px) {
  #rb-app .pg-hero { position: relative; display: block; padding: 12px 12px 12px; margin-bottom: 8px; border-radius: 18px; }
  #rb-app .pg-hero-lead { gap: 10px; padding-right: 48px; margin-bottom: 10px; }
  #rb-app .pg-hero-ico { width: 40px; height: 40px; border-radius: 12px; flex: none; }
  #rb-app .pg-hero-ico svg, #rb-app .pg-hero-ico .hero-color-ico { width: 24px; height: 24px; }
  #rb-app .pg-hero-title { font-size: 20px; margin: 0; }
  #rb-app .pg-hero-sub { font-size: 12px; line-height: 1.3; margin: 1px 0 0; opacity: .95; }
  #rb-app .pg-hero-actions { display: block; }
  #rb-app .rb-xclose { position: absolute; top: 12px; right: 12px; width: 38px; height: 38px; min-height: 0; padding: 0; justify-content: center; font-size: 0; gap: 0; }
  #rb-app .rb-xclose svg { width: 18px; height: 18px; }
  #rb-app .rb-dnav { display: flex; flex-wrap: nowrap; gap: 6px; width: 100%; margin-bottom: 8px; }
  #rb-app .rb-dnav .rb-sqb { width: 38px; flex: none; }
  #rb-app .rb-dnav .rb-datebtn { order: 0; flex: 1 1 auto; min-width: 0; padding: 0 10px; justify-content: flex-start; }
  #rb-app .rb-dnav #rb-prev { order: 1; } #rb-app .rb-dnav .rb-datebtn { order: 2; } #rb-app .rb-dnav #rb-next { order: 3; } #rb-app .rb-dnav #rb-today { order: 4; flex: none; padding: 0 12px; }
  #rb-app .rb-dnav .pg-btn { min-height: 38px; height: 38px; font-size: 13px; border-radius: 12px; }
  #rb-app .rb-tabs { display: flex; flex-wrap: nowrap; gap: 6px; width: 100%; }
  #rb-app .rb-tabs .pg-btn { min-height: 38px; height: 38px; font-size: 13px; border-radius: 12px; padding: 0 10px; flex: 1 1 0; justify-content: center; white-space: nowrap; }
  #rb-app #rb-free { flex: 1.3 1 0; }
  #rb-app .rb-tabs .pg-btn.rb-xclose { position: absolute; top: 12px; right: 12px; flex: none; width: 38px; height: 38px; padding: 0; font-size: 0; gap: 0; }
  #rb-app .rb-tabs .pg-btn.rb-xclose svg { width: 18px; height: 18px; }
  /* labels on the plan: bigger, on a light chip so walls never cut through them */
  #rb-app .rb-scene.sm-scale .rb-fl b { font-size: calc(13.5px / var(--k)); letter-spacing: .03em; padding: calc(2px / var(--k)) calc(7px / var(--k)); border-radius: calc(7px / var(--k)); background: rgba(255,255,255,.88); text-shadow: none; box-shadow: 0 1px 4px rgba(15,23,42,.18); }
  #rb-app .rb-scene.sm-scale .rb-fl small { display: inline-block; font-size: calc(10px / var(--k)); padding: calc(1.5px / var(--k)) calc(7px / var(--k)); }
  #rb-app .rb-scene.sm-scale .rb-fl { gap: calc(4px / var(--k)); }
  #rb-app .rb-scene.sm-scale .rb-rm.sm .rb-fl { flex-direction: column; justify-content: center; align-items: center; padding: 0; gap: calc(3px / var(--k)); }
}
#rb-app .rb-qk { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: var(--rb-text2); }
#rb-app .rb-qk.live { color: #15803D; }
#rb-app .rb-qk.live::before { content: ""; display: inline-block; width: 8px; height: 8px; margin-right: 7px; border-radius: 50%; background: #22C55E; box-shadow: 0 0 0 3px rgba(34,197,94,.25); vertical-align: 1px; }
#rb-app .rb-form { margin-top: 0; margin-bottom: 16px; }
/* ── the space popup: a coloured header for its state, one clear card, one big button ── */
#rb-app .rb-dlg.rb-rdlg { max-width: 440px; padding: 0; border-radius: 26px; overflow: hidden auto; border: 0; box-shadow: 0 40px 90px -30px rgba(15,23,42,.6); }
#rb-app .rb-rdlg .rb-panel.rb-sp { margin: 0; padding: 0; border: 0; background: none; }
#rb-app .rb-sph { position: relative; display: flex; align-items: center; gap: 14px; padding: 20px 20px 22px; color: #fff; overflow: hidden; background: linear-gradient(135deg, #10B981, #0EA5A4); }
#rb-app .rb-sph.busy { background: linear-gradient(135deg, #F43F5E, #F97316); }
#rb-app .rb-sph.mine { background: linear-gradient(135deg, #2F6FE4, #7C3AED); }
#rb-app .rb-sph.closed { background: linear-gradient(135deg, #64748B, #94A3B8); }
#rb-app .rb-sph::after { content: ""; position: absolute; right: -40px; top: -60px; width: 190px; height: 190px; border-radius: 50%; background: rgba(255,255,255,.14); pointer-events: none; }
#rb-app .rb-spi { flex: none; width: 50px; height: 50px; display: grid; place-items: center; border-radius: 16px; background: rgba(255,255,255,.22); box-shadow: inset 0 1px 0 rgba(255,255,255,.35); position: relative; z-index: 1; }
#rb-app .rb-spi svg { width: 27px; height: 27px; stroke: #fff; }
#rb-app .rb-spt { position: relative; z-index: 1; min-width: 0; }
#rb-app .rb-spt h3 { margin: 0; font-size: 21px; font-weight: 800; letter-spacing: -.5px; color: #fff; }
#rb-app .rb-sps { display: inline-block; margin-top: 5px; padding: 3px 12px; border-radius: 99px; background: rgba(255,255,255,.24); font-size: 12.5px; font-weight: 800; }
#rb-app .rb-sph .rb-x { position: absolute; top: 14px; right: 14px; z-index: 2; background: rgba(255,255,255,.2); border: 0; color: #fff; }
#rb-app .rb-sph .rb-x:hover { background: rgba(255,255,255,.34); }
#rb-app .rb-spb { padding: 18px 20px 22px; background: var(--rb-surface); }
#rb-app .rb-bz { display: flex; align-items: center; gap: 12px; padding: 14px; margin-bottom: 14px; border-radius: 16px; background: #FEF2F2; border: 1px solid #FECACA; }
#rb-app .rb-bz.mine { background: #EFF6FF; border-color: #BFDBFE; }
#rb-app .rb-av { flex: none; width: 40px; height: 40px; display: grid; place-items: center; border-radius: 50%; background: #F43F5E; color: #fff; font-size: 13px; font-weight: 800; }
#rb-app .rb-bz.mine .rb-av { background: #2F6FE4; }
#rb-app .rb-bzt { min-width: 0; color: #1E293B; }
#rb-app .rb-bzt b { display: block; font-size: 15px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#rb-app .rb-bzt small { color: #64748B; font-size: 12.5px; }
#rb-app .rb-bk { margin: 0 0 6px; }
#rb-app .rb-when { margin-bottom: 14px; }
#rb-app .rb-lv { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 800; color: #15803D; text-transform: uppercase; letter-spacing: .06em; }
#rb-app .rb-lv::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #22C55E; box-shadow: 0 0 0 3px rgba(34,197,94,.25); }
#rb-app .rb-lv.n { color: var(--rb-text2); }
#rb-app .rb-lv.n::before { background: #94A3B8; box-shadow: 0 0 0 3px rgba(148,163,184,.25); }
#rb-app .rb-tm { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-top: 6px; }
#rb-app .rb-tm b { font-size: 26px; font-weight: 800; letter-spacing: -.8px; }
#rb-app .rb-tm span { font-size: 13.5px; font-weight: 700; color: var(--rb-text2); }
#rb-app .rb-seg { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 14px; }
#rb-app .rb-seg .rb-chip { height: 42px; padding: 0 4px; border-radius: 12px; font-size: 13.5px; font-weight: 700; justify-content: center; }
#rb-app .rb-seg .rb-chip.on { background: linear-gradient(135deg, #2F6FE4, #7C3AED); border-color: transparent; color: #fff; box-shadow: 0 8px 18px -8px rgba(79,70,229,.7); }
#rb-app .rb-seg .rb-chip:disabled { opacity: .4; }
#rb-app .rb-go { display: flex; align-items: center; justify-content: center; width: 100%; height: 54px; border: 0; border-radius: 16px; background: linear-gradient(135deg, #10B981, #0EA5A4); color: #fff; font-size: 17px; font-weight: 800; letter-spacing: -.2px; cursor: pointer; box-shadow: 0 16px 28px -14px rgba(16,185,129,.8); transition: transform .15s, box-shadow .2s; }
#rb-app .rb-go:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 20px 32px -14px rgba(16,185,129,.9); }
#rb-app .rb-go:active:not(:disabled) { transform: scale(.98); }
#rb-app .rb-go:disabled { opacity: .6; cursor: default; }
#rb-app .rb-go.off { margin-bottom: 14px; background: linear-gradient(135deg, #F43F5E, #F97316); box-shadow: 0 16px 28px -14px rgba(244,63,94,.8); height: 48px; font-size: 15px; }
#rb-app .rb-more { margin: 12px 0 0; text-align: center; }
#rb-app .rb-spb .rb-field { margin-top: 12px; }
#rb-app .rb-spb .rb-go { margin-top: 16px; }
#rb-app .rb-ds { margin-top: 12px; border: 1px solid var(--rb-border); border-radius: 14px; background: var(--rb-surface); }
#rb-app .rb-ds > summary { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 13px 14px; cursor: pointer; font-size: 14px; font-weight: 700; list-style: none; }
#rb-app .rb-ds > summary::-webkit-details-marker { display: none; }
#rb-app .rb-ds > summary::after { content: "›"; font-size: 20px; line-height: 1; color: var(--rb-text3); transition: transform .15s; }
#rb-app .rb-ds[open] > summary::after { transform: rotate(90deg); }
#rb-app .rb-ds > summary em { margin-left: auto; font-style: normal; font-weight: 600; font-size: 12.5px; color: var(--rb-text3); }
#rb-app .rb-dsb { padding: 0 14px 14px; }
#rb-app .rb-dsb .rb-rhint { margin: 0 0 18px; }
#rb-app .rb-dsb .rb-li .t { flex: 0 0 128px; }
@media (max-width: 760px) {
  #rb-app .rb-dlg.rb-rdlg { max-width: none; border-radius: 26px 26px 0 0; padding: 0; }
  #rb-app .rb-rdlg::before { display: none; }
  #rb-app .rb-tm b { font-size: 24px; }
}
/* ── present / not present (CEO, COO, CoS) ── */
#rb-app .rb-sph.present { background: linear-gradient(135deg, #F59E0B, #D97706); }
#rb-app .rb-rm.present { --st: rgba(245,158,11,.24); --ring: rgba(217,119,6,.6); --glow: rgba(251,191,36,.3); }
#rb-app .rb-rm.present .rb-fl small { background: linear-gradient(135deg, #FBBF24, #D97706); box-shadow: 0 6px 12px -6px rgba(217,119,6,.7); }
#rb-app .rb-lamp.present { background: radial-gradient(circle at 35% 30%, #FEF3C7, #F59E0B 55%, #B45309); box-shadow: 0 0 0 3px rgba(255,255,255,.9), 0 0 16px 4px rgba(245,158,11,.8); }
#rb-app .rb-tip2 .st.present { background: #D97706; }
#rb-app .rb-pr { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 14px; margin-bottom: 14px; border-radius: 16px; background: #F8FAFC; border: 1px solid var(--rb-border); }
#rb-app .rb-pr.on { background: #FFFBEB; border-color: #FDE68A; }
#rb-app .rb-prh b { display: block; font-size: 14.5px; font-weight: 800; color: #1E293B; }
#rb-app .rb-prh small { font-size: 12px; color: #64748B; }
#rb-app .rb-prs { display: inline-flex; padding: 3px; border-radius: 12px; background: #E2E8F0; }
#rb-app .rb-prs button { height: 34px; padding: 0 14px; border: 0; border-radius: 10px; background: transparent; color: #475569; font-size: 13px; font-weight: 800; cursor: pointer; transition: background .15s, color .15s, box-shadow .15s; }
#rb-app .rb-prs button.on { background: #fff; color: #1E293B; box-shadow: 0 2px 8px rgba(15,23,42,.15); }
#rb-app .rb-pr.on .rb-prs button.on { background: #F59E0B; color: #fff; }
#rb-app .rb-pn { text-align: center; padding: 6px 4px 2px; line-height: 1.45; }
/* ── choosing the start time: a "Starts" row that opens a grid of times, no dragging ── */
#rb-app .rb-st { display: flex; align-items: center; gap: 10px; width: 100%; height: 48px; padding: 0 14px; margin-bottom: 12px; border: 1px solid var(--rb-border); border-radius: 14px; background: var(--rb-surface); color: var(--rb-text); font-size: 14px; cursor: pointer; transition: border-color .15s, box-shadow .15s; }
#rb-app .rb-st:hover { border-color: #A5B4FC; box-shadow: 0 6px 16px -10px rgba(79,70,229,.6); }
#rb-app .rb-st span { color: var(--rb-text2); font-weight: 600; }
#rb-app .rb-st b { margin-left: auto; font-size: 15px; font-weight: 800; }
#rb-app .rb-st i { width: 9px; height: 9px; border-right: 2px solid var(--rb-text3); border-bottom: 2px solid var(--rb-text3); transform: rotate(45deg) translate(-2px, -2px); transition: transform .15s; }
#rb-app .rb-st[aria-expanded="true"] i { transform: rotate(-135deg) translate(-2px, -2px); }
#rb-app .rb-sg { max-height: 232px; overflow-y: auto; margin: -4px 0 12px; padding: 8px; border: 1px solid var(--rb-border); border-radius: 14px; background: var(--rb-surface); overscroll-behavior: contain; }
#rb-app .rb-sr { display: grid; grid-template-columns: 44px 1fr; align-items: center; gap: 8px; padding: 4px 0; }
#rb-app .rb-sr > span { font-size: 12px; font-weight: 800; color: var(--rb-text3); text-align: right; }
#rb-app .rb-sc-w { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
#rb-app .rb-sc { height: 38px; border: 1px solid var(--rb-border); border-radius: 10px; background: var(--rb-surface); color: var(--rb-text); font-size: 13.5px; font-weight: 700; cursor: pointer; transition: background .12s, border-color .12s, transform .1s; }
#rb-app .rb-sc:hover:not(:disabled) { background: #EEF2FF; border-color: #A5B4FC; }
#rb-app .rb-sc:active:not(:disabled) { transform: scale(.96); }
#rb-app .rb-sc.on { background: linear-gradient(135deg, #2F6FE4, #7C3AED); border-color: transparent; color: #fff; }
#rb-app .rb-sc:disabled { color: var(--rb-text3); background: repeating-linear-gradient(135deg, rgba(148,163,184,.14) 0 4px, transparent 4px 8px); cursor: not-allowed; text-decoration: line-through; }
#rb-app .rb-go.ghost { margin-bottom: 14px; background: transparent; color: #2F6FE4; border: 1.5px solid #2F6FE4; box-shadow: none; height: 46px; font-size: 15px; }
#rb-app .rb-go.ghost:hover { background: #EFF6FF; box-shadow: none; }
/* ── minute-level times: the start panel and the day bar ── */
#rb-app .rb-sg { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; max-height: none; overflow: visible; margin: -4px 0 12px; padding: 12px; border: 1px solid var(--rb-border); border-radius: 14px; background: var(--rb-surface); }
#rb-app .rb-tp { flex: 1 1 140px; display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 700; color: var(--rb-text2); }
#rb-app .rb-tp input, #rb-app .rb-custom input { height: 40px; padding: 0 10px; border: 1px solid var(--rb-border); border-radius: 10px; background: var(--rb-surface); color: var(--rb-text); font: inherit; font-size: 15px; font-weight: 700; }
#rb-app .rb-ab { margin: 14px 0 4px; }
#rb-app .rb-ab-t { position: relative; height: 14px; border-radius: 8px; background: #E2E8F0; overflow: hidden; }
#rb-app .rb-ab-b { position: absolute; top: 0; bottom: 0; background: #F87171; }
#rb-app .rb-ab-b.me { background: #60A5FA; }
#rb-app .rb-ab-s { position: absolute; top: 2px; bottom: 2px; border-radius: 6px; background: linear-gradient(135deg, #2F6FE4, #7C3AED); box-shadow: 0 0 0 1.5px #fff; }
#rb-app .rb-ab-n { position: absolute; top: -2px; bottom: -2px; width: 2px; background: #0F172A; }
#rb-app .rb-ab-l { position: relative; height: 16px; margin-top: 3px; font-size: 11px; font-weight: 700; color: var(--rb-text3); }
#rb-app .rb-ab-l span { position: absolute; top: 0; }
#rb-app .rb-ab-ul { margin: 6px 0 0; padding: 0; list-style: none; font-size: 12.5px; color: var(--rb-text2); }
#rb-app .rb-ab-ul li { padding: 2px 0; }
#rb-app .rb-ab-ul b { color: var(--rb-text); font-weight: 700; margin-right: 4px; }
</style>

<section class="pg-hero">
  <span class="pg-blob pg-blob--a" aria-hidden="true"></span>
  <span class="pg-blob pg-blob--b" aria-hidden="true"></span>
  <div class="pg-hero-lead">
    <span class="pg-hero-ico" aria-hidden="true"><svg class="hero-color-ico" viewBox="0 0 32 32"><rect x="2.500" y="2.500" width="21" height="27.500" rx="4" fill="#7C3AED"/><path d="M6.500 6h13.500a1 1 0 0 1 1 1v21H6.500z" fill="#EDE9FE"/><path d="M6.500 6l8.500-2.600v26L6.500 28z" fill="#A78BFA"/><circle cx="12.200" cy="17.500" r="1.200" fill="#F5F3FF"/><circle cx="23" cy="23" r="8.300" fill="#fff"/><circle cx="23" cy="23" r="7" fill="#F59E0B"/><circle cx="23" cy="23" r="5.300" fill="#FFFBEB"/><path d="M23 19.600V23l2.500 1.600" stroke="#B45309" stroke-width="1.700" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    <div class="pg-hero-main">
      <h1 class="pg-hero-title">Spaces</h1>
      <p class="pg-hero-sub" id="rb-clock" aria-label="Current date and time"></p>
    </div>
  </div>
  <div class="pg-hero-actions">
    <div class="rb-dnav">
      <button class="pg-btn rb-sqb" id="rb-prev" type="button" aria-label="Previous day"></button>
      <button class="pg-btn" id="rb-today" type="button">Today</button>
      <button class="pg-btn rb-sqb" id="rb-next" type="button" aria-label="Next day"></button>
      <button class="pg-btn rb-datebtn" id="rb-date" type="button" aria-haspopup="dialog" aria-expanded="false" aria-label="Pick a date"></button>
    </div>
    <div class="rb-tabs" id="rb-tabs">
      <button class="pg-btn pg-btn--solid" id="rb-free" type="button"></button>
      <button class="pg-btn rb-tab" data-view="mine" type="button">My bookings</button>
      <button class="pg-btn rb-tab" data-view="rooms" type="button" id="rb-tab-rooms" hidden>Manage</button>
      <button class="pg-btn rb-xclose" data-ovclose type="button" aria-label="Close Spaces"><svg class="rb-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg> Close</button>
    </div>
  </div>
</section>
<div id="rb-v-day">
  <div class="rb-map" id="rb-map">
    <div class="rb-stage" id="rb-stage">
      <div class="rb-scene" id="rb-scene"></div>
      <div class="rb-none" id="rb-none" hidden><b>No spaces are open for booking</b>An admin can switch spaces on under Manage.</div>
    </div>
  </div>
</div>

<div class="rb-cal" id="rb-cal" role="dialog" aria-label="Pick a date" hidden></div>
<div class="rb-modal rb-xmodal" id="rb-xmodal" aria-hidden="true"><div class="rb-dlg rb-xdlg" role="dialog" aria-modal="true" aria-label="Space booking"><div class="rb-dh"><div><h3 id="rb-xtitle">My bookings</h3><p id="rb-xsub"></p></div><button type="button" class="rb-x" data-xclose aria-label="Close">x</button></div><div class="rb-db"><div id="rb-v-mine" hidden></div><div id="rb-v-rooms" hidden></div></div></div></div>
<div class="rb-modal rb-rmodal" id="rb-rmodal" aria-hidden="true"><div class="rb-dlg rb-rdlg" id="rb-rdlg" role="dialog" aria-modal="true" aria-label="Space"><div id="rb-panel"></div></div></div>
<div class="rb-modal" id="rb-modal" aria-hidden="true"><div class="rb-dlg" id="rb-dlg" role="dialog" aria-modal="true"></div></div>
<div class="rb-tip2" id="rb-tip2" role="tooltip" hidden></div>
<div class="rb-toast" id="rb-toast" role="status" aria-live="polite"></div>
<div class="rb-conf" id="rb-conf" aria-hidden="true"></div>
</div>
`;
