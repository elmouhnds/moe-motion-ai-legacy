'use strict';
/* v0.70 (docs/features/CONTROL_STYLE.md): the Control style — squares that are the tools, a Mix, one Apply. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTestServices } = require('./helpers/harness');
const { TA } = require('./fixtures/layout');
const { studioComp } = require('./fixtures/studio');
const C = require('../extension/app/ui/layoutControl');
const L = require('../extension/app/ui/layouts');

const box = (name, x, extra) => Object.assign({ name, selected: true, transform: TA({ pos: [x, 300] }), rect: { left: -20, top: -20, width: 40, height: 40 } }, extra || {});
const on = (cc) => C.ccOf({ cc });

test('Control is a fourth style; Bento stays the default', () => {
  assert.deepEqual(L.LAYOUTS.map((x) => x.id), ['bento', 'glass', 'moe', 'control']);
  const app = (layout) => ({ services: { settings: { get: () => ({ ui: { layout } }) } } });
  assert.equal(L.layoutOf(app('control')), 'control');
  assert.equal(L.layoutOf(app(undefined)), 'bento');
});

test('the squares follow the selection: keys get the Motion Control + Loop, text a Typewriter, layers Motion + Beats', () => {
  assert.deepEqual(C.modulesFor('none'), []);
  assert.deepEqual(C.modulesFor('keys'), ['control', 'loop', 'wiggle']);
  assert.deepEqual(C.modulesFor('layer'), ['move', 'wiggle', 'beats']);
  assert.deepEqual(C.modulesFor('text'), ['move', 'wiggle', 'type', 'beats']);
  // a square that this selection does not show never runs, even if it was left on
  assert.deepEqual(C.plan(on({ loop: { on: true }, beats: { on: true }, type: { on: true } }), 'keys', 1).map((r) => r.id), ['loop']);
});

test('the Mix is the tools\' own args: motion first, then what rides on it; stagger and screen order only for 2+ layers', () => {
  const cc = on({ move: { on: true, kind: 'moveBT', dir: 'in', duration: 0.8, blur: true, screen: true, stagger: 0.1, ease: 'expo', over: true }, wiggle: { on: true, amp: 12 }, beats: { on: true } });
  const one = C.plan(cc, 'layer', 1);
  assert.deepEqual(one.map((r) => r.tool), ['quick.animate', 'expressions.quick', 'markers.beats']);
  assert.deepEqual(one[0].args, { kind: 'moveBT', dir: 'in', duration: 0.8, ease: 'expo', overshoot: true, blur: C.BLUR_PX, distance: 120, stagger: 0, order: 'selection' });
  assert.deepEqual(one[1].args, { preset: 'wiggle', freq: 2, amp: 12 });
  const many = C.plan(cc, 'layers', 3);
  assert.equal(many[0].args.stagger, 0.1);
  assert.equal(many[0].args.order, 'screen');
  // a fade has nothing to overshoot, a move out never overshoots
  assert.equal(C.plan(on({ move: { on: true, kind: 'fade', over: true } }), 'layer', 1)[0].args.overshoot, false);
  assert.equal(C.plan(on({ move: { on: true, kind: 'scale', dir: 'out', over: true } }), 'layer', 1)[0].args.overshoot, false);
  // double-click runs ONE square alone, whatever else is on
  assert.equal(C.soloRun(cc, 'layer', 1, 'wiggle').tool, 'expressions.quick');
  assert.equal(C.soloRun(on({}), 'layer', 1, 'move').tool, 'quick.animate');
  // every args set validates against its tool's own schema
  const { validateArgs, defaults } = require('../extension/core/schema');
  const reg = require('../extension/features').TOOLS || null;
  if (reg) for (const r of many) { const t = reg.find((x) => x.id === r.tool); const v = validateArgs(t.params, Object.assign(defaults(t.params), r.args)); assert.ok(v.ok, `${r.tool}: ${v.errors}`); }
});

test('one Apply runs the Mix in order through the executor (each verified), then switches the squares off', async () => {
  const { services, comp } = await createTestServices(studioComp([box('A', 400), box('B', 800)], { comp: { time: 1 } }));
  const ctx = await services.executor.readContext();
  let st = { ctx, cc: on({ move: { on: true, kind: 'scale', dir: 'in' }, wiggle: { on: true, amp: 12 } }), args: {} };
  const ran = [];
  const app = {
    services,
    state: { get: () => st, set: (p) => { st = Object.assign({}, st, typeof p === 'function' ? p(st) : p); } },
    runTool: async (id, args, o) => { ran.push(o.label); const r = await services.executor.run(id, args); st.ctx = await services.executor.readContext(); return r; },
    toast: () => {}
  };
  const out = await C.applyMix(app);
  assert.deepEqual(out, { done: ['Pop In', 'Wiggle 12'], stopped: null });
  assert.deepEqual(ran, ['Pop In', 'Wiggle 12']);
  for (const L1 of comp._layers) {
    const T = L1.property('ADBE Transform Group');
    assert.ok(T.property('ADBE Scale').numKeys >= 2, `${L1.name}: Pop In wrote Scale keys`);
    assert.match(T.property('ADBE Position').expression, /wiggle\(2, 12\)/, `${L1.name}: wiggle on Position`);
  }
  assert.equal(C.ccOf(st).move.on, false, 'switched off after it ran');
  assert.equal(C.ccOf(st).wiggle.amp, 12, 'the numbers stay');
  assert.equal(await C.applyMix(app), null, 'an empty Mix does nothing');
});

test('a square that does not fit stops the Mix before it runs and says what ran before it', async () => {
  const { services, comp } = await createTestServices(studioComp([box('A', 400)], { comp: { time: 1 } }));
  comp._layers[0].property('ADBE Transform Group').property('ADBE Position').expression = 'value + [1, 0]; // mine';
  const ctx = await services.executor.readContext();
  let st = { ctx, cc: on({ move: { on: true }, wiggle: { on: true } }), args: {} };
  const toasts = [];
  const app = { services, state: { get: () => st, set: (p) => { st = Object.assign({}, st, typeof p === 'function' ? p(st) : p); } }, runTool: async (id, args) => { const r = await services.executor.run(id, args); st.ctx = await services.executor.readContext(); return r; }, toast: (m) => toasts.push(m) };
  const out = await C.applyMix(app);
  // Pop In fits, Wiggle would replace YOUR expression: the Mix stops before Wiggle and says what ran before it
  assert.equal(out.stopped, 'wiggle');
  assert.match(toasts[0], /^Wiggle 30: .*Replace existing.* — done before it: Pop In/);
});

test('Control CSS: scoped, hover never moves a square, only Chromium 99 CSS; every page reachable from Libraries', () => {
  const css = fs.readFileSync(path.join(__dirname, '../extension/css/styles.css'), 'utf8');
  const part = css.slice(css.indexOf('/* ================================================================== CONTROL'));
  assert.ok(part.length > 1000);
  assert.ok(!/color-mix\(|:has\(|@container|backdrop-filter/.test(part));
  for (const rule of part.match(/[^{}]*:hover[^{]*\{[^}]*\}/g) || []) assert.ok(!/transform|margin|padding|width|height|flex/.test(rule.split('{')[1]), rule.trim());
  const src = fs.readFileSync(path.join(__dirname, '../extension/app/ui/layoutControl.js'), 'utf8');
  assert.match(src, /studio\.NAV\.filter\(\(id\) => id !== 'home'\)/, 'Libraries list every page');
  assert.match(src, /require\('\.\/scrub'\)\.attach\(input/, 'sliders go through scrub.js');
  assert.match(src, /TC\.card\(tool, fullArgs\(app, r\)/, 'the Mix line comes from the tools\' own cards');
});

test('v0.71 layout: the comp line moves into the head, search is a header icon, the rail is icons only, Move / Add groups, Libraries one row', () => {
  const src = fs.readFileSync(path.join(__dirname, '../extension/app/ui/layoutControl.js'), 'utf8');
  assert.match(src, /hideCtx: home && !s\.hostError/, 'the context strip hides only on the home, never over an error');
  assert.match(fs.readFileSync(path.join(__dirname, '../extension/app/ui/shell.js'), 'utf8'), /p\.hideCtx \? null : contextStrip\(s\)/);
  assert.match(src, /require\('\.\/palette'\)\.open\(app\)/, 'search opens Ctrl+K');
  assert.match(src, /group\('move', 'Move', sq\.move\), group\('add', 'Add', sq\.add\)/);
  assert.match(src, /'cc-control-open'/, 'the Motion Control folds for layers (remembered)');
  const lay = fs.readFileSync(path.join(__dirname, '../extension/app/ui/layouts.js'), 'utf8');
  assert.match(lay, /moeRail\(app, s, \{ iconsOnly: layout === 'control' \}\)/);
  const css = fs.readFileSync(path.join(__dirname, '../extension/css/styles.css'), 'utf8');
  assert.match(css, /\.cc-lib-row \{ display: flex;[^}]*overflow-x: auto/, 'Libraries scroll sideways in one row');
});

test('v0.72 pages: Move · Text · Design · Look · Deliver — every square is a real tool with valid args, applied through the library', async () => {
  const P = require('../extension/app/ui/layoutControlPages');
  assert.deepEqual(P.PAGES.map((p) => p.id), ['move', 'text', 'design', 'look', 'deliver']);
  const { services } = await createTestServices(studioComp([box('A', 400)], { comp: { time: 1 } }));
  const store = new Map();
  const app = { services: Object.assign({}, services, { store: { get: (k, d) => (store.has(k) ? store.get(k) : d), set: (k, v) => store.set(k, v) } }) };
  assert.equal(P.pageOf(app), 'move', 'Move is the first page');
  store.set(P.PAGE_KEY, 'nope'); assert.equal(P.pageOf(app), 'move', 'an unknown page falls back to Move');
  const { validateArgs, defaults } = require('../extension/core/schema');
  for (const page of ['text', 'design', 'look', 'deliver']) {
    for (const kind of ['in', 'out']) {
      const items = P.itemsOf(app, page, { ccText: { kind } });
      assert.ok(items.length >= 4, `${page}: ${items.length} squares`);
      for (const it of items) {
        const tool = services.registry.get(it.tile.tool);
        assert.ok(tool, `${page}/${it.key}: ${it.tile.tool} is registered`);
        const v = validateArgs(tool.params || {}, Object.assign(defaults(tool.params || {}), it.tile.args));
        assert.ok(v.ok, `${page}/${it.key}: ${v.errors}`);
      }
      if (page !== 'text') break;
    }
  }
  // the Text page shows In or Out presets; the picked one is the first until you pick
  const ins = P.itemsOf(app, 'text', { ccText: { kind: 'in' } }).filter((x) => x.preset);
  assert.ok(ins.length && ins.every((x) => x.preset.kind === 'in'));
  assert.equal(P.pickedOf(app, 'text', { ccText: { kind: 'in' } }).key, ins[0].key);
  assert.equal(P.pickedOf(app, 'design', { ccPick: { design: 'backgrounds/bg-auroraProduct' } }).key, 'backgrounds/bg-auroraProduct');
  // the page tab that fits the selection gets a dot — the page itself never switches
  assert.equal(P.fitsPage('text'), 'text'); assert.equal(P.fitsPage('layers'), 'move');
  const src = fs.readFileSync(path.join(__dirname, '../extension/app/ui/layoutControlPages.js'), 'utf8');
  assert.match(src, /lib\(\)\.applyNow\(app, it\.tile, it\.section\)/, 'Apply goes through the library (readiness → runTool)');
  assert.match(fs.readFileSync(path.join(__dirname, '../extension/app/ui/shell.js'), 'utf8'), /Control \(v0\.72\): Ctrl\+1…5/);
});

test('v0.73: palette cards draw the real background (your look, or the tile\'s own); three example clients; no banners in Control', () => {
  const PC = require('../extension/app/ui/paletteCard');
  const tile = { args: { palette: 'ocean', style: 'mesh', motion: 'orbit' } };
  const mine = PC.cardArgs(tile, { style: 'radial', angle: 45, grain: 6 }, false);
  assert.equal(mine.palette, 'ocean'); assert.equal(mine.style, 'radial', 'a plain palette is shown in YOUR style'); assert.equal(mine.grain, 0, 'no grain at card size');
  assert.equal(PC.cardArgs(tile, { style: 'radial' }, true).style, 'mesh', 'a complete look shows its own style');
  const EX = require('../extension/features/brand/examples');
  const B = require('../extension/features/brand/brands');
  const AA = require('../extension/features/brand/applyAll');
  assert.equal(EX.EXAMPLES.length, 3);
  for (const b of EX.EXAMPLES) {
    assert.deepEqual(B.validateBrand ? B.validateBrand(b) : [], [], b.name);
    const r = AA.brandRoles(b);
    assert.ok(r.contrast.text >= 4.5, `${b.name}: body text readable (${r.contrast.text})`);
    assert.ok(EX.isExample(b));
    assert.ok(require('../extension/features/brand/kit').brandEaseRef(b), `${b.name}: its motion feel maps to an ease`);
  }
  // seeded once, only into an empty list; Manage adds back what is missing
  const mem = new Map(); const store = { get: (k, d) => (mem.has(k) ? mem.get(k) : d), set: (k, v) => mem.set(k, v), update: (k, d, fn) => mem.set(k, fn(mem.has(k) ? mem.get(k) : d)) };
  const brands = B.createBrandStore(store);
  assert.equal(EX.seedOnce(store, brands), 3);
  assert.equal(EX.seedOnce(store, brands), 0, 'only once');
  brands.remove('example_pulse_pay');
  assert.equal(EX.addMissing(brands), 1);
  const mem2 = new Map(); const store2 = { get: (k, d) => (mem2.has(k) ? mem2.get(k) : d), set: (k, v) => mem2.set(k, v), update: (k, d, fn) => mem2.set(k, fn(mem2.has(k) ? mem2.get(k) : d)) };
  const own = B.createBrandStore(store2); own.save({ name: 'My client', colors: [{ name: 'A', hex: '#112233' }] });
  assert.equal(EX.seedOnce(store2, own), 0, 'never over your own clients');
  assert.match(fs.readFileSync(path.join(__dirname, '../extension/app/ui/chrome.js'), 'utf8'), /ui\.layout === 'moe' \|\| ui\.layout === 'control'/);
});

test('v0.74: Wiggle moves Position / Rotation / Scale (the library\'s own presets); numbers are kept, switches are not; My mixes', () => {
  const rot = C.plan(on({ wiggle: { on: true, target: 'rotation', amp: 12 } }), 'layer', 1)[0];
  assert.deepEqual([rot.tool, rot.args.preset, rot.args.amp, rot.label], ['expressions.quick', 'wiggleRot', 12, 'Wiggle Rotation 12']);
  assert.equal(C.plan(on({ wiggle: { on: true, target: 'scale' } }), 'layer', 1)[0].args.preset, 'wiggleScale');
  assert.equal(C.plan(on({ wiggle: { on: true } }), 'layer', 1)[0].args.preset, 'wiggle', 'Position by default');
  const E = require('../extension/features/expressions/quick');
  for (const [, , preset] of C.WIGGLES) assert.ok(E.PRESETS[preset] && 'amp' in E.PRESETS[preset].nums, preset);
  const nums = C.numbersOf(on({ move: { on: true, duration: 1.2 } }));
  assert.equal(nums.move.duration, 1.2); assert.ok(!('on' in nums.move), 'a switch is never saved on');
  // My mixes: saved by name with its squares, loaded back, forgotten
  const mem = new Map(); let st = { cc: on({ move: { on: true, kind: 'fade' }, wiggle: { on: true, amp: 9 } }) };
  const app = { services: { store: { get: (k, d) => (mem.has(k) ? mem.get(k) : d), set: (k, v) => mem.set(k, v) } }, state: { get: () => st, set: (p) => { st = Object.assign({}, st, typeof p === 'function' ? p(st) : p); } } };
  assert.equal(C.saveMix(app, '   '), null, 'a name is needed');
  const m = C.saveMix(app, 'Soft fade + wiggle');
  assert.equal(C.mixesOf(app).length, 1);
  st = { cc: on({}) }; C.loadMix(app, m);
  assert.deepEqual(C.plan(C.ccOf(st), 'layer', 1).map((r) => r.label), ['Fade In', 'Wiggle 9']);
  C.removeMix(app, m.id); assert.equal(C.mixesOf(app).length, 0);
  st = { cc: on({}) }; assert.equal(C.saveMix(app, 'empty'), null, 'an empty Mix is not saved');
  const sh = fs.readFileSync(path.join(__dirname, '../extension/app/ui/shell.js'), 'utf8');
  assert.match(sh, /Control \(v0\.74\): Enter applies the Mix, Esc switches it off/);
  const css = fs.readFileSync(path.join(__dirname, '../extension/css/styles.css'), 'utf8');
  assert.ok(/@keyframes cc-rise/.test(css) && /cc-apply:not\(\[disabled\]\)::after/.test(css), 'premium motion is there (Reduced turns it off globally)');
});
