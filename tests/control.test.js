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
