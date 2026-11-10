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

test('v0.75: one Apply = ONE undo group for the whole Mix (tx.begin / tx.end once), each run still verified and in History', async () => {
  const { services, comp } = await createTestServices(studioComp([box('A', 400), box('B', 800)], { comp: { time: 1 } }));
  const calls = [];
  const orig = services.host.call.bind(services.host);
  services.host.call = (op, args, o) => { calls.push(op); return orig(op, args, o); };
  let st = { ctx: await services.executor.readContext(), cc: on({ move: { on: true, kind: 'fade' }, wiggle: { on: true, amp: 5 } }), args: {} };
  const app = { services, state: { get: () => st, set: (p) => { st = Object.assign({}, st, typeof p === 'function' ? p(st) : p); } },
    runTool: async (id, args) => { const r = await services.executor.run(id, args); st.ctx = await services.executor.readContext(); return r; }, toast: () => {} };
  const out = await C.applyMix(app);
  assert.equal(out.stopped, null);
  assert.equal(calls.filter((c) => c === 'tx.begin').length, 1, calls.join(','));
  assert.equal(calls.filter((c) => c === 'tx.end').length, 1);
  assert.ok(calls.indexOf('tx.end') > calls.lastIndexOf('expressions.set'), 'the group closes after the last write');
  assert.equal(services.executor.history(5).filter((x) => x.status === 'success').length, 2, 'each run in History');
  assert.match(comp._layers[0].property('ADBE Transform Group').property('ADBE Position').expression, /wiggle\(2, 5\)/);
  // a nested batch joins the open group; a failing run still closes it
  calls.length = 0;
  await services.executor.batch('outer', async () => { await services.executor.batch('inner', async () => {}); throw Object.assign(new Error('x'), {}); }).catch(() => {});
  assert.deepEqual(calls.filter((c) => /^tx\./.test(c)), ['tx.begin', 'tx.end']);
});

test('v0.75: Style Kits point at real tools only; Signature looks are complete, valid and loop; text previews say "MOE Motion"; brand motion identity', async () => {
  const KITS = require('../extension/app/ui/kits');
  const A = require('../extension/app/ui/actions');
  const S = require('../extension/app/ui/studio/sections');
  assert.deepEqual(KITS.KITS.map((k) => k.id), ['saas', 'glass', 'kinetic', 'social', 'effectors', 'mograph']);
  for (const k of KITS.KITS) { const refs = KITS.refsOf(k); assert.equal(new Set(refs).size, refs.length, `${k.id}: each tool once`); refs.forEach((r) => assert.ok(A.resolve(r), `${k.id}: ${r}`)); }
  assert.ok(S.byId('kits') && S.WORKSPACES.some((w) => w.items.includes('kits')), 'a page reachable like any other');
  // Signature looks: 16, each a complete look with motion, args valid for the background tool
  const { services } = await createTestServices(studioComp([box('A', 400)], { comp: { time: 1 } }));
  const bg = services.registry.get('design.background');
  const { validateArgs, defaults } = require('../extension/core/schema');
  const sig = S.byId('backgrounds').tiles.filter((t) => t.tags.includes('Signature'));
  assert.equal(sig.length, 16);
  const BC = require('../extension/app/ui/studio/bgComposer');
  for (const t of sig) {
    assert.ok(BC.fullLook(t), `${t.id} is a complete look`);
    assert.ok(t.args.motion && t.args.motion !== 'none', `${t.id} moves`);
    const v = validateArgs(bg.params, Object.assign(defaults(bg.params), t.args)); assert.ok(v.ok, `${t.id}: ${v.errors}`);
  }
  // the text-preview rule
  const P = require('../extension/app/ui/layoutControlPages');
  assert.equal(P.sampleText({ ctx: { layers: [{ type: 'text', text: 'Hello world, a long line' }] } }), 'MOE Motion');
  assert.equal(P.sampleText({ ctx: { layers: [{ type: 'text', text: 'مرحبا' }] } }), 'مو موشن');
  assert.match(fs.readFileSync(path.join(__dirname, '../extension/app/ui/views/text.js'), 'utf8'), /SAMPLES = \{ en: 'MOE Motion', ar: 'مو موشن' \}/);
  // brand motion identity: saved on the client, Brand ease applies exactly those values with Smart Ease
  const K = require('../extension/features/brand/kit');
  const EX = require('../extension/features/brand/examples');
  const pulse = EX.EXAMPLES.find((b) => b.id === 'example_pulse_pay');
  assert.deepEqual(K.brandEase(pulse), { out: 12, in: 88 });
  const edited = K.withEase(pulse, { out: 40, in: 70 });
  assert.deepEqual(K.brandEase(edited), { out: 40, in: 70 });
  assert.equal(K.brandEase(K.withEase(pulse, null)), null, 'removed');
  assert.ok(require('../extension/features/brand/brands').validateBrand(edited).length === 0);
  A.setBrandSource(() => edited);
  const act = A.resolve('brand:ease');
  assert.equal(act.tool, 'motion.smartEase'); assert.equal(act.args.influenceOut, 40); assert.equal(act.args.influenceIn, 70);
  A.setBrandSource(null);
});

test('v0.76 Smart Kits: kinds, recipes made of the kit\'s own tools, progress, and a recipe is one undo group that stops honestly', async () => {
  const KITS = require('../extension/app/ui/kits');
  const A = require('../extension/app/ui/actions');
  const R = require('../extension/app/ui/kitRun');
  const kinds = KITS.KINDS.map(([id]) => id);
  for (const k of KITS.KITS) {
    assert.ok(kinds.includes(k.kind), `${k.id}: a look or a technique`);
    const own = KITS.refsOf(k);
    for (const rc of k.recipes || []) {
      assert.ok(rc.refs.length >= 2 && rc.refs.length <= 4 && rc.label && rc.hint, `${k.id}/${rc.id}: a short named chain`);
      rc.refs.forEach((r) => { assert.ok(own.includes(r), `${k.id}/${rc.id}: ${r} is one of the kit's tools`); assert.ok(A.resolve(r) && !A.resolve(r).nav, `${r} runs`); });
    }
  }
  const names = [].concat(...KITS.KITS.map((k) => (k.recipes || []).map((r) => r.label)));
  assert.equal(new Set(names).size, names.length, 'no two recipes share a name');
  assert.ok(KITS.byId('effectors').steps.length === 6 && KITS.byId('effectors').kind === 'technique');
  // progress (pure)
  const ef = KITS.byId('effectors');
  assert.deepEqual(KITS.progress(ef, {}), { steps: [false, false, false, false, false, false], next: 0, count: 0, total: 6 });
  const pg = KITS.progress(ef, { 'tile:layout/cloneGrid': true, 'tile:layout/efSpring': true });
  assert.deepEqual([pg.steps, pg.next, pg.count], [[true, false, true, false, false, false], 1, 2]);
  // every recipe runs to its end on a clean layer (Word Cascade needs text, and says so before writing anything)
  for (const k of KITS.KITS) for (const rc of k.recipes || []) {
    const t = await createTestServices(studioComp([box('A', 400)], { comp: { time: 1 } }));
    let s1 = { ctx: await t.services.executor.readContext(), args: {} };
    const a1 = { services: t.services, state: { get: () => s1, set: (p) => { s1 = Object.assign({}, s1, typeof p === 'function' ? p(s1) : p); } }, toast: () => {}, render: () => {}, go: () => {},
      runTool: async (id, args) => { const r = await t.services.executor.run(id, args); s1.ctx = await t.services.executor.readContext(); return r; } };
    const o1 = await R.runRecipe(a1, k, rc);
    if (rc.id === 'wordCascade') assert.deepEqual(o1, { done: [], stopped: 'Text Cloner' });
    else assert.equal(o1.stopped, null, `${k.id}/${rc.id} stopped at ${o1.stopped}`);
  }
  // a recipe runs in order inside ONE transaction and ticks its steps
  const { services } = await createTestServices(studioComp([box('A', 400)], { comp: { time: 1 } }));
  const calls = [];
  const host = services.host; const call = host.call.bind(host);
  host.call = async (op, a) => { calls.push(op); return call(op, a); };
  let st = { ctx: await services.executor.readContext(), args: {}, view: 'kits' };
  const toasts = [];
  const app = {
    services, state: { get: () => st, set: (p) => { st = Object.assign({}, st, typeof p === 'function' ? p(st) : p); } },
    runTool: async (id, args) => { const r = await services.executor.run(id, args); st.ctx = await services.executor.readContext(); return r; },
    toast: (m, t, k) => toasts.push([k, m]), render: () => {}, go: () => {}
  };
  const glass = KITS.byId('glass');
  const rec = glass.recipes.find((r) => r.id === 'frostFocus');
  const out = await R.runRecipe(app, glass, rec);
  assert.deepEqual(out, { done: ['Frosted Glass', 'Focus In'].slice(0, out.done.length), stopped: null }, JSON.stringify([out, toasts]));
  assert.deepEqual(calls.filter((c) => /^tx\./.test(c)), ['tx.begin', 'tx.end'], 'one undo group');
  assert.deepEqual(Object.keys(R.doneOf(st, 'glass')).sort(), rec.refs.slice().sort());
  assert.equal(KITS.progress(glass, R.doneOf(st, 'glass')).count, 2);
  // it stops at the first step that is not ready, and says so — nothing is ticked
  let st2 = { ctx: Object.assign({}, st.ctx, { layers: [], properties: [] }), args: {}, view: 'kits' };
  const app2 = Object.assign({}, app, { state: { get: () => st2, set: (p) => { st2 = Object.assign({}, st2, typeof p === 'function' ? p(st2) : p); } } });
  const out2 = await R.runRecipe(app2, glass, rec);
  assert.ok(out2.stopped && !out2.done.length && !Object.keys(R.doneOf(st2, 'glass')).length);
});
