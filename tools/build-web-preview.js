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

const PV = path.join(ROOT, 'extension/assets/previews');
const previewImgs = JSON.stringify(fs.existsSync(PV) ? Object.fromEntries(fs.readdirSync(PV).filter((f) => f.endsWith('.webp')).map((f) => [f, `data:image/webp;base64,${fs.readFileSync(path.join(PV, f)).toString('base64')}`])) : {});
const font = fs.readFileSync(path.join(ROOT, 'extension/assets/fonts/sora-latin-wght.woff2')).toString('base64');
const css = fs.readFileSync(path.join(ROOT, 'extension/css/tokens.css'), 'utf8').replace('url("../assets/fonts/sora-latin-wght.woff2")', `url("data:font/woff2;base64,${font}")`)
  + '\n' + fs.readFileSync(path.join(ROOT, 'extension/css/app.css'), 'utf8')
  + '\n' + fs.readFileSync(path.join(ROOT, 'extension/css/styles.css'), 'utf8');

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
    <div class="pv-ctl pv-layout"><label for="pv-layout">Layout</label><div class="pv-seg" id="pv-layout" role="group" aria-label="Panel style">
      <button data-layout="bento" title="Default — one page by how often you use things: NOW, Power tools, stages">Bento</button><button data-layout="glass" title="Frosted glass, the five stages as spaces, Now card, floating bottom bar">Glass</button><button data-layout="moe" title="AE-named tabs and twirl-down groups, with every shortcut in a sidebar">MOE</button><button data-layout="control" title="New in 0.70 — a Control Center for motion: squares that are the tools, the Mix, one Apply">Control</button></div></div>
    <div class="pv-ctl"><label for="pv-scene">Comp</label><div class="pv-seg" id="pv-scene" role="group" aria-label="Sample composition">
      <button data-scene="title">Title</button><button data-scene="layout">9 cards</button><button data-scene="studio">Text</button></div></div>
    <div class="pv-ctl"><label for="pv-theme">Theme</label><div class="pv-seg" id="pv-theme" role="group" aria-label="Panel theme">
      <button data-theme-v="dark">Dark</button><button data-theme-v="midnight">Midnight</button><button data-theme-v="light">Light</button></div></div>
    <button class="pv-reset" id="pv-reset" title="Start again with a fresh comp">Reset</button>
  </header>
  <div class="pv-body">
    <div class="pv-frame" id="pv-frame"><div id="app"></div></div>
    <aside class="pv-guide" aria-label="What to try">
      <div class="pv-lguide" data-for="glass"><h2>Glass</h2><ol>
        <li>Five spaces, the <b>stages of work</b> — Animate · Arrange · Design · Finish · Deliver — in the floating bar; <kbd>Ctrl</kbd> <kbd>1</kbd>–<kbd>5</kbd> switch them.</li>
        <li>The <b>Now</b> card: what you selected and its best actions; the ⌄ folds it to one line.</li>
        <li>The colour field follows the accent (try Electric in Settings); <b>Settings › Glass blur</b> turns the blur off.</li></ol></div>
      <div class="pv-lguide" data-for="bento"><h2>Bento — the default</h2><ol>
        <li><b>By how often you use things</b>: the Quick Bar's first ten are your everyday tools (<kbd>Alt</kbd> <kbd>1</kbd>–<kbd>0</kbd>, hold Alt to see them); <b>NOW</b> is the big tool for your selection — switch the <i>Comp</i> above.</li>
        <li><b>Power tools</b>: big cards that explain themselves (✓ makes one small); then the stages <b>Animate · Arrange · Design · Finish · Deliver</b> (<kbd>Ctrl</kbd> <kbd>1</kbd>–<kbd>5</kbd>), rare groups behind <i>More in…</i>.</li>
        <li>The round <b>Assistant</b> bottom-right (<kbd>\`</kbd>): ask in Arabic or English, or describe a change (demo answers in this preview).</li></ol></div>
      <div class="pv-lguide" data-for="moe"><h2>MOE — every shortcut in a sidebar</h2><ol>
        <li>The <b>sidebar</b> holds <b>Select</b> (every filter, one click — it opens beside it) and <b>your whole Quick Bar</b>. Each tab's <b>▾</b> is its quick menu; the round button is the Assistant.</li>
        <li><b>⇔</b> at its top shows the names; right-click a shortcut for its options; <i>Customize</i> edits them.</li>
        <li>Above the tools only the AE tabs (<kbd>Ctrl</kbd> <kbd>1</kbd>–<kbd>6</kbd>) and search remain — two rows freed for the graphs.</li></ol></div>
      <div class="pv-lguide" data-for="control"><h2>Control — a Control Center for motion (new in 0.70)</h2><ol>
        <li>Every <b>square is the tool</b>: <b>Motion</b> plays the move it will write (Fade · Pop · Rise · Slide · Spin, In / Out); <b>Duration</b> and <b>Stagger</b> are tall sliders — drag up or down; <b>Blur · Overshoot · Expo · Order</b> are round switches.</li>
        <li>The squares <b>follow the selection</b>: <b>Wiggle</b> and <b>Beats</b> for layers, <b>Typewriter</b> for text, the <b>Motion Control</b> and <b>Loop</b> for keys — switch the <i>Comp</i> above.</li>
        <li>Switched-on squares gather in the <b>Mix</b> at the bottom: one line says what will happen, <b>Apply</b> runs them in order (each its own Undo). Double-click a square to run it alone; right-click opens its page.</li></ol></div>
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
// v0.98 bundled previews (MOE renderer sprites) as data URLs — the preview page has no files next to it
window.__PREVIEW_IMG = ${previewImgs};
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
  var opts = { w: 420, scene: 'layout', theme: 'dark', mode: 'main', layout: 'control' }; // 0.70: opens on the new Control style
  var HASH = { moe: 'moe', glass: 'glass', bento: 'bento', control: 'control' };
  try { var saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (saved) for (var k in saved) opts[k] = saved[k]; } catch (e) { /* storage blocked: defaults */ }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(opts)); } catch (e) { /* ignore */ } }
  var h0 = (location.hash || '').slice(1);
  if (HASH[h0]) opts.layout = HASH[h0];
  if (['bento', 'glass', 'moe', 'control'].indexOf(opts.layout) < 0) opts.layout = 'bento';
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
    require('/extension/app/main.js').start({ cs: cs, root: '/extension', platform: platform, mode: opts.mode === 'kit' ? 'kit' : undefined, ui: { layout: opts.layout, theme: opts.theme, accent: 'tomato', splash: false, banners: true, motion: 'calm', motionV: 2, /* v0.75: like the panel — previews play under the mouse */ seenVersion: opts.seen ? '${VERSION}' : '' } }).then(function (app) {
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
    try { history.replaceState(null, '', '#' + ({ ae: 'classic', hub: 'p1', bar: 'p2', workspace: 'p3', moe: 'moe', studio: 'sidebar', glass: 'glass', apple: 'apple', bento: 'bento' })[l]); } catch (e) { /* sandboxed */ }
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
