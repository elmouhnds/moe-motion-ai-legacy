'use strict';
/**
 * Dev: build a single-file, clickable web preview of the panel → dist/web-preview/index.html
 *   node tools/build-web-preview.js
 *
 * What runs inside: the real panel code (extension/**) and the real host ExtendScript files
 * (extension/host/*.jsx) against the After Effects mock (tests/mock/ae-mock.js) with a preview
 * fixture comp — exactly what `npm run preview` runs, but with no server and no eval:
 *   - every CommonJS module is wrapped in a function at build time;
 *   - every host .jsx (each is one IIFE expression) is wrapped as `function () { return (...) }`;
 *   - the panel's two evalScript shapes (load host, MOE_dispatch) are recognised and called directly;
 *   - the host JSON reader's eval (lib/json.jsx) is replaced by the browser's JSON.parse.
 * That keeps it working on pages whose Content-Security-Policy forbids eval / new Function.
 * Not After Effects: nothing touches a real project; reload resets everything.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist/web-preview');
const VERSION = require('../package.json').version;

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
const rel = (f) => `/${path.relative(ROOT, f).split(path.sep).join('/')}`;

const jsFiles = [
  ...walk(path.join(ROOT, 'extension')).filter((f) => f.endsWith('.js') && !/extension\/lib\/CSInterface\.js$/.test(f)),
  ...['dev/platform-mem.js', 'dev/demo-ai.js', 'dev/preview-fixture.js', 'dev/preview-fixture-layout.js', 'dev/preview-fixture-studio.js', 'dev/preview-fixture-comp.js', 'tests/mock/ae-mock.js', 'tests/mock/ae-expr.js'].map((f) => path.join(ROOT, f))
];
const jsxFiles = walk(path.join(ROOT, 'extension/host')).filter((f) => f.endsWith('.jsx'));
const jsonFiles = walk(path.join(ROOT, 'extension')).filter((f) => f.endsWith('.json'));

const noCloseScript = (src, f) => { if (/<\/script/i.test(src)) throw new Error(`${f} contains </script>`); return src; };
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
const asString = (s) => JSON.stringify(s).replace(/<\//g, '<\\/').split(LS).join('\\u2028').split(PS).join('\\u2029');

const mods = jsFiles.map((f) => `${asString(rel(f))}: function (module, exports, require) {\n${noCloseScript(fs.readFileSync(f, 'utf8'), f)}\n}`).join(',\n');
const jsxFns = jsxFiles.map((f) => {
  const src = fs.readFileSync(f, 'utf8').replace(/\s+$/, '').replace(/;$/, '');
  // lib/json.jsx parses with eval after a strict-JSON regex (ExtendScript has no JSON); here the
  // browser's JSON.parse takes its place (same strict JSON, no eval).
  const after = /lib\/json\.jsx$/.test(f) ? ' window.MOE.json.parse = function (t) { return JSON.parse(String(t)); };' : '';
  return `${asString(rel(f))}: function () { var r = (\n${noCloseScript(src, f)}\n);${after} return r; }`;
}).join(',\n');
const texts = [...jsxFiles, ...jsonFiles].map((f) => `${asString(rel(f))}: ${asString(fs.readFileSync(f, 'utf8'))}`).join(',\n');

const font = fs.readFileSync(path.join(ROOT, 'extension/assets/fonts/sora-latin-wght.woff2')).toString('base64');
const css = fs.readFileSync(path.join(ROOT, 'extension/css/tokens.css'), 'utf8').replace('url("../assets/fonts/sora-latin-wght.woff2")', `url("data:font/woff2;base64,${font}")`)
  + '\n' + fs.readFileSync(path.join(ROOT, 'extension/css/app.css'), 'utf8');

const html = `<title>MOE Motion AI Preview</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${css}
/* ---------- preview page (around the panel) ---------- */
/* Layout: a toolbar row, then the panel frame with a short guide beside it (below it on phones). */
:root { --pv-bg: #121214; --pv-surface: #1b1b1f; --pv-line: #2d2d33; --pv-text: #e9e7e4; --pv-dim: #9c9aa3; --pv-accent: #ff7a59; color-scheme: dark; }
:root[data-theme="light"] { --pv-bg: #e9e8ec; --pv-surface: #f7f6f9; --pv-line: #d4d2da; --pv-text: #1d1c21; --pv-dim: #5c5a66; --pv-accent: #c2410c; color-scheme: light; }
html, body { height: 100%; }
body { margin: 0; background: var(--pv-bg); color: var(--pv-text); font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; overflow: auto; }
.pv { min-height: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 14px; padding-block: 14px 20px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.pv-top { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 18px; }
.pv-name { display: flex; align-items: baseline; gap: 8px; margin-right: auto; }
.pv-name b { font: 600 15px "MOE Display", system-ui, sans-serif; letter-spacing: 0.01em; }
.pv-name span { color: var(--pv-dim); font-size: 12px; }
.pv-ctl { display: flex; align-items: center; gap: 6px; }
.pv-ctl > label { color: var(--pv-dim); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; }
.pv-seg { display: inline-flex; padding: 2px; border: 1px solid var(--pv-line); border-radius: 7px; background: var(--pv-surface); }
.pv-seg button { min-height: 26px; padding: 0 10px; border: 0; border-radius: 5px; background: none; color: var(--pv-dim); font: inherit; font-size: 12px; cursor: pointer; }
.pv-seg button[aria-pressed="true"] { background: var(--pv-bg); color: var(--pv-text); box-shadow: inset 0 0 0 1px var(--pv-line); }
.pv-seg button:focus-visible, .pv-reset:focus-visible { outline: 2px solid var(--pv-accent); outline-offset: 1px; }
.pv-reset { min-height: 30px; padding: 0 12px; border: 1px solid var(--pv-line); border-radius: 7px; background: var(--pv-surface); color: var(--pv-text); font: inherit; font-size: 12px; cursor: pointer; }
.pv-body { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 18px; }
.pv-frame { position: relative; transform: translateZ(0); /* fixed toasts / dialogs stay inside the panel, as in AE */ flex: none; width: min(var(--w, 420px), 100%); height: min(860px, max(560px, calc(100vh - 110px))); border: 1px solid var(--pv-line); border-radius: 10px; overflow: hidden; background: var(--bg); box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35); }
.pv-frame #app { height: 100%; }
.pv-guide { flex: 1 1 260px; min-width: 0; max-width: 46ch; display: flex; flex-direction: column; gap: 12px; }
.pv-guide h2 { margin: 0; font: 600 13px "MOE Display", system-ui, sans-serif; letter-spacing: 0.06em; text-transform: uppercase; color: var(--pv-dim); }
.pv-guide ol { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 7px; }
.pv-guide li::marker { color: var(--pv-accent); font-weight: 600; }
.pv-guide kbd { padding: 1px 5px; border: 1px solid var(--pv-line); border-bottom-width: 2px; border-radius: 4px; background: var(--pv-surface); font: 11px ui-monospace, Consolas, monospace; }
.pv-note { padding: 10px 12px; border: 1px solid var(--pv-line); border-radius: 8px; background: var(--pv-surface); color: var(--pv-dim); font-size: 12px; }
.pv-note b { color: var(--pv-text); }
.pv-lguide[hidden] { display: none; }
.pv-lguide { display: flex; flex-direction: column; gap: 10px; }
.pv-layout .pv-seg button[aria-pressed="true"] { color: var(--pv-accent); }
.pv-err { padding: 12px; color: #ff8b7a; font: 12px ui-monospace, monospace; white-space: pre-wrap; }
@media (max-width: 520px) { .pv-frame { height: 640px; } }
</style>

<div class="pv">
  <header class="pv-top">
    <div class="pv-name"><b>MOE Motion AI</b><span>v${VERSION} · live preview</span></div>
    <div class="pv-ctl"><label for="pv-w">Panel</label><div class="pv-seg" id="pv-w" role="group" aria-label="Panel width">
      <button data-w="280" data-mode="kit" title="The Motion Kit as its own slim panel (Window › Extensions › MOE Motion Kit)">Kit panel</button><button data-w="340">Narrow</button><button data-w="420">Docked</button><button data-w="640">Wide</button><button data-w="920">Full</button></div></div>
    <div class="pv-ctl pv-layout"><label for="pv-layout">Layout</label><div class="pv-seg" id="pv-layout" role="group" aria-label="Panel layout (the three proposals)">
      <button data-layout="ae" title="The new default — organised like After Effects: tabs named after AE menus, twirl-down groups, ≡ panel menu">Classic</button><button data-layout="hub" title="Proposal 1 — fixed Home + screens (Motion 4 style)">1 · Hub</button><button data-layout="bar" title="Proposal 2 — menus by object + your bars (MoBar / KBar style)">2 · Command Bar</button><button data-layout="workspace" title="Proposal 3 — context bar + task tabs (AE Properties style)">3 · Workspace</button><button data-layout="moe" title="My recommendation — menus by object + your bar + four task tabs">★ MOE</button><button data-layout="studio" title="The current v0.15 layout (sidebar + workspaces)">Current</button></div></div>
    <div class="pv-ctl"><label for="pv-scene">Comp</label><div class="pv-seg" id="pv-scene" role="group" aria-label="Sample composition">
      <button data-scene="title">Title</button><button data-scene="layout">9 cards</button><button data-scene="studio">Text</button></div></div>
    <div class="pv-ctl"><label for="pv-theme">Theme</label><div class="pv-seg" id="pv-theme" role="group" aria-label="Panel theme">
      <button data-theme-v="dark">Dark</button><button data-theme-v="midnight">Midnight</button><button data-theme-v="light">Light</button></div></div>
    <button class="pv-reset" id="pv-reset" title="Start again with a fresh comp">Reset</button>
  </header>
  <div class="pv-body">
    <div class="pv-frame" id="pv-frame"><div id="app"></div></div>
    <aside class="pv-guide" aria-label="What to try">
      <div class="pv-lguide" data-for="hub"><h2>Proposal 1 · Hub</h2><ol>
        <li><b>Home is fixed</b>: the ease graphs, Anchor, Align and <i>Your tools</i> are always in the same place, whatever you select.</li>
        <li>The orange <b>For this</b> strip under the screens <b>copies</b> six actions for the selection — switch the <i>Comp</i> above (Title = keys, 9 cards = layers, Text = text) and only the strip changes.</li>
        <li>Screens: <b>Ease</b> (big editor + curve library), <b>Toolbox</b> (tools by what they do), <b>Library</b> / <b>Design</b> / <b>Finish</b> (sections as sub-tabs). History and Settings are in the header.</li></ol></div>
      <div class="pv-lguide" data-for="bar"><h2>Proposal 2 · Command Bar</h2><ol>
        <li>The first row is <b>menus by object</b>: Keys · Layer · Text · Shape · Comp · Design · Layout · Finish · AI. The one that fits your selection is <b>highlighted orange</b> — click it to open its tools.</li>
        <li>Under it, <b>your bars</b> (Animate · Rig · Layer): one click runs, right-click opens options; <i>Edit bars</i> changes them.</li>
        <li>The area below is a <b>panel</b>: Ease (with Anchor + Align) or Toolbox; a section you open from a menu appears as its own tab. <kbd>Ctrl</kbd> <kbd>K</kbd> searches everything.</li></ol></div>
      <div class="pv-lguide" data-for="workspace"><h2>Proposal 3 · Workspace</h2><ol>
        <li>The top <b>For this</b> bar <b>copies</b> the eight actions for what you selected (the same eight as the pie, same order) — change the <i>Comp</i> above and watch only this bar change. × hides it.</li>
        <li>Four <b>task tabs</b>, each with a fixed order: <b>Animate</b> (ease, anchor + align, rigs, keyframes, then Motion presets · Text · Expressions), <b>Design</b>, <b>Layout</b>, <b>Finish</b>. A card opens its section in place; the crumb takes you back.</li>
        <li><b>Your tools</b> stay at the bottom with <kbd>F4</kbd> (repeat) and ★ to choose them.</li></ol></div>
      <div class="pv-lguide" data-for="ae"><h2>Classic — organised like After Effects</h2><ol>
        <li><b>Tabs named after AE's menus</b>: Keys · Animate · Layer · Design · Effect · Comp. An orange <b>dot</b> marks the tabs that fit what you selected — switch the <i>Comp</i> above and watch it move.</li>
        <li>Inside a tab, <b>twirl-down groups like Effect Controls</b> (▸ Keyframe Assistant, ▸ Animate In, ▸ Align…). Groups that fit your selection open by themselves; what you open or fold is remembered.</li>
        <li><b>Preset tiles apply in one click</b> (right-click opens their settings); <b>All 37 ›</b> opens the full library, the crumb brings you back.</li>
        <li><b>Search</b> under the tabs works like Effects &amp; Presets (<kbd>Ctrl</kbd> <kbd>K</kbd> jumps there). The <b>≡</b> menu top-right holds What's new, shortcuts, pie, Quick Bar, layouts and Settings — like any AE panel.</li></ol></div>
      <div class="pv-lguide" data-for="moe"><h2>★ MOE — my recommendation</h2><ol>
        <li>Three rows, each with one job. <b>Menus by object</b> (from proposal 2): the one for your selection lights up orange — switch the <i>Comp</i> above and watch it move from Keys to Shape to Text. Nothing else moves.</li>
        <li><b>Your bar</b> (from proposal 1): the Quick Bar, one row that fits the panel; <b>+N</b> shows the rest, right-click edits it.</li>
        <li><b>Four task tabs</b> (from proposal 3): <b>Animate</b> opens on ease → anchor + align → rigs → keyframes → presets; <b>Design</b>, <b>Layout</b>, <b>Finish</b> are cards that open in place with a crumb back.</li>
        <li>Why: one context area instead of two, nothing that moves under your hand, and the most height left for the graphs in a docked panel. <kbd>Ctrl</kbd> <kbd>K</kbd>, the pie (<kbd>Q</kbd>) and <kbd>F4</kbd> work everywhere.</li></ol></div>
      <div class="pv-lguide" data-for="studio">
      <h2>Current layout (v0.15)</h2>
      <ol>
        <li><b>New in 0.10 — Home is your motion toolkit</b>: on the <i>Title</i> comp keys are selected on the <i>Title</i> comp — the graph shows their curve by itself. Drag a handle and let go: the curve lands on the keys. Click a preset chip (Shift = ease in only, Ctrl = ease out only).</li>
        <li><b>Anchor:</b> click a dot — the anchor moves, the layer does not. <kbd>Alt</kbd>-click also puts the layer at that point of the comp. Try it on <i>9 cards</i>.</li>
        <li><b>Pinned tools</b> (Home) and the <b>Toolbox</b> (Ctrl 2): one click runs a tool, right-click shows its options; <i>Pin to Home</i> chooses what Home shows. Try <i>Excite</i> on the selected keys, or <i>Stare</i> with two layers selected.</li>
        <li><b>Kit panel</b> (top bar): the kit on its own, slim, as you would dock it next to the Timeline.</li>
        <li><b>Pie menu:</b> click inside the panel, then <b>hold <kbd>Q</kbd></b> (or hold the right mouse button), point toward an action and release. Tap <kbd>Q</kbd> to keep it open and press 1–8. The slices change with the selection — try the <i>Text</i> and <i>9 cards</i> comps.</li>
        <li>The sidebar is <b>Home</b> (your motion tools), the <b>Toolbox</b> and five workspaces (Animate · Design · Layout · Finish · Tools). <kbd>Ctrl</kbd> <kbd>1</kbd>–<kbd>7</kbd> jumps between them.</li>
        <li><b>Home › For this selection</b>: the same eight actions as the pie, one click each.</li>
        <li>In a library, hover a tile and press <b>▶</b>, or use <b>Apply</b> in the bar at the bottom. <kbd>F4</kbd> repeats the last change.</li>
        <li><kbd>Ctrl</kbd> <kbd>K</kbd>, type <i>pop</i>, <kbd>Enter</kbd>: the preset is applied. Dimmed tiles tell you why they cannot run.</li>
        <li>Every change is listed in <b>History</b> and can be restored.</li>
      </ol></div>
      <div class="pv-note" id="pv-noeval" hidden><b>Expressions are not evaluated on this page.</b> The page's security settings block running code from text, so the mock cannot read the result of an expression back. Tools driven by expressions (Grid, Proximity, Glass) still build, but report <i>partial</i> here; in After Effects they verify fully.</div>
      <div class="pv-note"><b>Simulated After Effects.</b> This is the real panel code and the real host scripts running against a small mock project in your browser. Nothing reaches a real project, and Reset starts over. Copilot answers are canned demo replies (no API key).</div>
    </aside>
  </div>
</div>

<script>
window.__MODS = {
${mods}
};
window.__JSX = {
${jsxFns}
};
window.__TEXT = {
${texts}
};
</script>
<script>
(function () {
  /* ---------- CommonJS without eval ---------- */
  var cache = {};
  function dirname(p) { return p.slice(0, p.lastIndexOf('/')); }
  function normalize(p) { var out = []; p.split('/').forEach(function (s) { if (s === '..') out.pop(); else if (s !== '.' && s !== '') out.push(s); }); return '/' + out.join('/'); }
  function fetchText(url) { if (!(url in window.__TEXT)) throw new Error('Cannot load ' + url); return window.__TEXT[url]; }
  function load(abs) {
    if (/\\.json$/.test(abs)) { if (!cache[abs]) cache[abs] = { exports: JSON.parse(fetchText(abs)) }; return cache[abs].exports; }
    var file = window.__MODS[abs] ? abs : window.__MODS[abs + '.js'] ? abs + '.js' : abs + '/index.js';
    if (!window.__MODS[file]) throw new Error('Preview has no module ' + abs);
    if (cache[file]) return cache[file].exports;
    var module = { exports: {} };
    cache[file] = module;
    window.__MODS[file](module, module.exports, makeRequire(dirname(file)));
    return module.exports;
  }
  function makeRequire(base) { return function (id) { if (id.charAt(0) !== '.' && id.charAt(0) !== '/') throw new Error('Preview has no Node built-in "' + id + '"'); return load(id.charAt(0) === '/' ? normalize(id) : normalize(base + '/' + id)); }; }
  window.require = makeRequire('/');

  /* ---------- options (kept for this tab only) ---------- */
  var KEY = 'moe-preview-options';
  var opts = { w: 420, scene: 'title', theme: 'dark', mode: 'main', layout: 'ae' };
  var HASH = { classic: 'ae', p1: 'hub', p2: 'bar', p3: 'workspace', moe: 'moe', current: 'studio', sidebar: 'studio' };
  try { var saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (saved) for (var k in saved) opts[k] = saved[k]; } catch (e) { /* storage blocked: defaults */ }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(opts)); } catch (e) { /* ignore */ } }
  var h0 = (location.hash || '').slice(1);
  if (HASH[h0]) opts.layout = HASH[h0];
  if (window.innerWidth < 560) opts.w = Math.min(opts.w, 420);
  var frame = document.getElementById('pv-frame');
  function mark() {
    frame.style.setProperty('--w', opts.w + 'px');
    [].forEach.call(document.querySelectorAll('#pv-w button'), function (b) { b.setAttribute('aria-pressed', String((b.dataset.mode || 'main') === (opts.mode || 'main') && Number(b.dataset.w) === opts.w)); });
    [].forEach.call(document.querySelectorAll('#pv-scene button'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.scene === opts.scene)); });
    [].forEach.call(document.querySelectorAll('#pv-theme button'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.themeV === opts.theme)); });
    [].forEach.call(document.querySelectorAll('#pv-layout button'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.layout === opts.layout)); });
    [].forEach.call(document.querySelectorAll('.pv-lguide'), function (g) { g.hidden = g.dataset.for !== opts.layout; });
  }
  mark();
  // Search, dialogs and popovers are attached to <body> by the panel; here they belong inside the
  // panel frame (in AE the panel is its own window).
  var bodyAppend = document.body.appendChild.bind(document.body);
  document.body.appendChild = function (el) { return el && el.classList && el.classList.contains('overlay') ? frame.appendChild(el) : bodyAppend(el); };

  var evalOk = true;
  try { evalOk = new Function('return 1')() === 1; } catch (e) { evalOk = false; }
  if (!evalOk) document.getElementById('pv-noeval').hidden = false;

  /* ---------- simulated After Effects ---------- */
  try {
    var mock = require('/tests/mock/ae-mock.js');
    var fixture = require({ layout: '/dev/preview-fixture-layout.js', studio: '/dev/preview-fixture-studio.js' }[opts.scene] || '/dev/preview-fixture.js');
    var byText = new Map();
    for (var p in window.__JSX) byText.set(window.__TEXT[p], window.__JSX[p]);
    mock.installAE(window, fixture, {
      readFile: fetchText,
      evalCode: function (text) { var fn = byText.get(text); if (!fn) throw new Error('Unknown host file'); return fn(); }
    });
    var STR = '("(?:[^"\\\\\\\\]|\\\\\\\\.)*")';
    var DISPATCH = new RegExp('^\\\\(typeof MOE_dispatch==="function"\\\\)\\\\?MOE_dispatch\\\\(' + STR + ',' + STR + '\\\\):"MOE_NOT_LOADED"$');
    var LOADHOST = new RegExp('MOE_ROOT=' + STR + ';return String\\\\(\\\\$\\\\.evalFile\\\\(new File\\\\(' + STR + '\\\\)\\\\)\\\\)');
    var cs = {
      evalScript: function (script, cb) {
        setTimeout(function () {
          var r, m;
          try {
            if ((m = DISPATCH.exec(script))) r = typeof window.MOE_dispatch === 'function' ? window.MOE_dispatch(JSON.parse(m[1]), JSON.parse(m[2])) : 'MOE_NOT_LOADED';
            else if ((m = LOADHOST.exec(script))) {
              try { window.$.global.MOE_ROOT = JSON.parse(m[1]); r = String(window.$.evalFile(new window.File(JSON.parse(m[2])))); } catch (e) { r = 'MOE_HOST_INIT_ERROR ' + e.message + ' (line ' + e.line + ')'; }
            } else r = 'EvalScript error.';
          } catch (e) { r = 'EvalScript error.'; }
          cb(r === undefined ? 'undefined' : String(r));
        }, 12);
      }
    };
    var mem = require('/dev/platform-mem.js');
    var platform = mem.createMemPlatform({ apiKey: 'sk-ant-preview-demo', http: require('/dev/demo-ai.js') });
    require('/extension/app/main.js').start({ cs: cs, root: '/extension', platform: platform, mode: opts.mode === 'kit' ? 'kit' : undefined, ui: { layout: opts.layout, theme: opts.theme, accent: 'tomato', splash: false, banners: true, motion: 'calm', motionV: 2, seenVersion: opts.seen ? '${VERSION}' : '' } }).then(function (app) {
      window.__app = app;
      opts.seen = true; save();
      var start = (location.hash || '').slice(1);
      var studio = require('/extension/app/ui/studio/sections.js');
      if (start && studio.byId(start)) app.go(start);
      // #backgrounds, #animate, … open that section (any section id of the panel)
      var openSection = function () { var v = (location.hash || '').slice(1); if (v && !HASH[v] && require('/extension/app/ui/studio/sections.js').byId(v)) app.go(v); };
      openSection();
      window.addEventListener('hashchange', function () { var l = HASH[(location.hash || '').slice(1)]; if (l && l !== opts.layout) setLayout(l); else openSection(); });
    });
  } catch (e) {
    document.getElementById('app').innerHTML = '<div class="pv-err"></div>';
    document.querySelector('.pv-err').textContent = 'The preview could not start: ' + (e && e.message);
  }

  /* ---------- toolbar ---------- */
  document.getElementById('pv-w').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var mode = b.dataset.mode || 'main', reload = mode !== (opts.mode || 'main');
    opts.w = Number(b.dataset.w); opts.mode = mode; save(); mark();
    if (reload) location.reload();
  });
  document.getElementById('pv-theme').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || !window.__app) return;
    opts.theme = b.dataset.themeV; save(); mark();
    window.__app.services.settings.update({ ui: { theme: opts.theme } }); window.__app.applyAppearance(); window.__app.render();
  });
  function setLayout(l) {
    opts.layout = l; save(); mark();
    if (!window.__app) return;
    window.__app.services.settings.update({ ui: { layout: l } });
    window.__app.state.set({ layMenu: null });
    window.__app.go('home'); window.__app.render();
    try { history.replaceState(null, '', '#' + ({ ae: 'classic', hub: 'p1', bar: 'p2', workspace: 'p3', moe: 'moe', studio: 'sidebar' })[l]); } catch (e) { /* sandboxed */ }
  }
  document.getElementById('pv-layout').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setLayout(b.dataset.layout); });
  document.getElementById('pv-scene').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; opts.scene = b.dataset.scene; save(); location.reload(); });
  document.getElementById('pv-reset').addEventListener('click', function () { location.reload(); });
}());
</script>
`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log(`dist/web-preview/index.html  ${(html.length / 1024 / 1024).toFixed(2)} MB  (${jsFiles.length} modules, ${jsxFiles.length} host files)`);
