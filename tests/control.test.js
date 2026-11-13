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
    // v0.87: the numbers arrive on the expression's own Slider Controls
    assert.match(T.property('ADBE Position').expression, /wiggle\(effect\("MOE Wiggle Frequency"\)\(1\)\.value, effect\("MOE Wiggle Amount"\)\(1\)\.value\)/, `${L1.name}: wiggle on Position`);
    assert.equal(L1._parade._children.find((f) => f.name === 'MOE Wiggle Amount')._children[0].value, 12, `${L1.name}: Amount slider`);
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

test('a Mix runs each tool through the executor; v0.94: no run-wide tx.begin / tx.end (a group cannot span calls) and no write without a group', async () => {
  const { services, comp, env } = await createTestServices(studioComp([box('A', 400), box('B', 800)], { comp: { time: 1 } }));
  const calls = [];
  const orig = services.host.call.bind(services.host);
  services.host.call = (op, args, o) => { calls.push(op); return orig(op, args, o); };
  let st = { ctx: await services.executor.readContext(), cc: on({ move: { on: true, kind: 'fade' }, wiggle: { on: true, amp: 5 } }), args: {} };
  const app = { services, state: { get: () => st, set: (p) => { st = Object.assign({}, st, typeof p === 'function' ? p(st) : p); } },
    runTool: async (id, args) => { const r = await services.executor.run(id, args); st.ctx = await services.executor.readContext(); return r; }, toast: () => {} };
  const out = await C.applyMix(app);
  assert.equal(out.stopped, null);
  assert.deepEqual(calls.filter((c) => /^tx\.(begin|end)$/.test(c)), [], 'the panel no longer opens a group it cannot keep open');
  assert.deepEqual(env.undo.entries.filter((e) => /^\(no undo group\)/.test(e)), [], 'every write is inside an undo group');
  assert.equal(env.undo.depth, 0);
  assert.equal(services.executor.history(5).filter((x) => x.status === 'success').length, 2, 'each run in History');
  assert.match(comp._layers[0].property('ADBE Transform Group').property('ADBE Position').expression, /wiggle\(effect\("MOE Wiggle Frequency"\)/);
  assert.equal(comp._layers[0]._parade._children.find((f) => f.name === 'MOE Wiggle Amount')._children[0].value, 5);
  // batch() still nests and passes errors through, and opens nothing
  calls.length = 0;
  await services.executor.batch('outer', async () => { await services.executor.batch('inner', async () => {}); throw Object.assign(new Error('x'), {}); }).catch(() => {});
  assert.deepEqual(calls.filter((c) => /^tx\./.test(c)), []);
});

test('v0.75: Style Kits point at real tools only; Signature looks are complete, valid and loop; text previews say "MOE Motion"; brand motion identity', async () => {
  const KITS = require('../extension/app/ui/kits');
  const A = require('../extension/app/ui/actions');
  const S = require('../extension/app/ui/studio/sections');
  assert.deepEqual(KITS.KITS.map((k) => k.id), ['saas', 'glass', 'kinetic', 'social', 'effectors', 'beat', 'loops', 'mograph']);
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

test('v0.76 Smart Kits: kinds, recipes made of the kit\'s own tools, progress, and a recipe stops honestly', async () => {
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
    else if (rc.id === 'pulseOnBeat') assert.ok(o1.stopped && !o1.done.length, 'no soundtrack in the comp: it stops before writing');
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
  assert.deepEqual(calls.filter((c) => /^tx\.(begin|end)$/.test(c)), [], 'v0.94: no run-wide group (each step is its own undo step)');
  assert.deepEqual(Object.keys(R.doneOf(st, 'glass')).sort(), rec.refs.slice().sort());
  assert.equal(KITS.progress(glass, R.doneOf(st, 'glass')).count, 2);
  // it stops at the first step that is not ready, and says so — nothing is ticked
  let st2 = { ctx: Object.assign({}, st.ctx, { layers: [], properties: [] }), args: {}, view: 'kits' };
  const app2 = Object.assign({}, app, { state: { get: () => st2, set: (p) => { st2 = Object.assign({}, st2, typeof p === 'function' ? p(st2) : p); } } });
  const out2 = await R.runRecipe(app2, glass, rec);
  assert.ok(out2.stopped && !out2.done.length && !Object.keys(R.doneOf(st2, 'glass')).length);
});

test('v0.77 My Recipes: a chain of the kit\'s own tools, picked by clicks, named, kept per kit, run like a built-in one; ready-now counts real readiness', async () => {
  const KITS = require('../extension/app/ui/kits');
  const R = require('../extension/app/ui/kitRun');
  const loops = KITS.byId('loops');
  assert.equal(KITS.makeRecipe(loops, 'x', ['tile:expressions/x-float'], []).ok, false, 'two tools at least');
  assert.equal(KITS.makeRecipe(loops, 'x', KITS.refsOf(loops).slice(0, 5), []).ok, false, 'four at most');
  assert.equal(KITS.makeRecipe(loops, 'x', ['tile:expressions/x-float', 'tile:layout/cloneGrid'], []).ok, false, 'only this kit\'s tools');
  assert.equal(KITS.makeRecipe(KITS.byId('kinetic'), 'x', ['nav:text', 'quick:counter'], []).ok, false, 'a page is not a step');
  const m1 = KITS.makeRecipe(loops, '  Float & Breathe ', ['tile:expressions/x-float', 'tile:expressions/x-swing', 'tile:expressions/x-float'], []);
  assert.ok(m1.ok && m1.recipe.label === 'Float & Breathe 2' && m1.recipe.refs.length === 2 && m1.recipe.mine, 'a taken name gets a number; a repeated tool counts once');
  // the click flow
  const { services } = await createTestServices(studioComp([box('A', 400)], { comp: { time: 1 } }));
  let st = { ctx: await services.executor.readContext(), args: {} };
  const app = { services, state: { get: () => st, set: (p) => { st = Object.assign({}, st, typeof p === 'function' ? p(st) : p); } }, toast: () => {}, render: () => {}, go: () => {},
    dialog: async (o) => (o.input !== undefined ? 'Idle life' : true),
    runTool: async (id, args) => { const r = await services.executor.run(id, args); st.ctx = await services.executor.readContext(); return r; } };
  R.startBuild(app, 'loops');
  assert.equal(await R.runRef(app, loops, 'tile:expressions/x-float'), null, 'while building, a click picks — it does not run');
  await R.runRef(app, loops, 'tile:expressions/x-breathe');
  await R.runRef(app, loops, 'tile:expressions/x-swing'); await R.runRef(app, loops, 'tile:expressions/x-swing');
  assert.deepEqual(R.buildOf(st, 'loops'), ['tile:expressions/x-float', 'tile:expressions/x-breathe'], 'a second click takes a tool out');
  const saved = await R.saveBuild(app, loops);
  assert.equal(saved.label, 'Idle life'); assert.equal(R.buildOf(st, 'loops'), null);
  assert.deepEqual(R.mineOf(app, 'loops').map((r) => r.label), ['Idle life']);
  assert.deepEqual(R.mineOf(app, 'glass'), [], 'kept per kit');
  const out = await R.runRecipe(app, loops, R.mineOf(app, 'loops')[0]);
  assert.equal(out.stopped, null); assert.equal(out.done.length, 2);
  // a stored chain with a tool that no longer exists is not offered
  services.store.set(R.MINE_KEY, { loops: R.mineOf(app, 'loops').concat({ id: 'old', label: 'Old', refs: ['tile:expressions/x-float', 'tile:expressions/gone'] }) });
  assert.deepEqual(R.mineOf(app, 'loops').map((r) => r.label), ['Idle life']);
  assert.ok(await R.removeMine(app, loops, R.mineOf(app, 'loops')[0])); assert.deepEqual(R.mineOf(app, 'loops'), []);
  // ready now
  assert.ok(R.readyCount(app, loops) > 0);
  const none = Object.assign({}, app, { state: { get: () => Object.assign({}, st, { ctx: Object.assign({}, st.ctx, { layers: [], properties: [] }) }), set: () => {} } });
  assert.ok(R.readyCount(none, loops) < R.readyCount(app, loops));
});

test('v0.78: a recipe is checked before anything is written; it is a one-click ref (Quick Bar, pie, Ctrl+K); your recipes export and import as checked data', async () => {
  const KITS = require('../extension/app/ui/kits');
  const R = require('../extension/app/ui/kitRun');
  const A = require('../extension/app/ui/actions');
  const QB = require('../extension/app/ui/quickbar');
  const mk = async (layers) => {
    const t = await createTestServices(studioComp(layers, { comp: { time: 1 } }));
    let st = { ctx: await t.services.executor.readContext(), args: {} }; const toasts = []; const calls = [];
    const call = t.services.host.call.bind(t.services.host); t.services.host.call = async (op, a) => { calls.push(op); return call(op, a); };
    const app = { services: t.services, state: { get: () => st, set: (p) => { st = Object.assign({}, st, typeof p === 'function' ? p(st) : p); } }, toast: (m, d, k) => toasts.push([k, m]), render: () => {}, go: () => {},
      dialog: async (o) => (o.input !== undefined ? 'Mine' : true),
      runTool: async (id, args) => { const r = await t.services.executor.run(id, args); st.ctx = await t.services.executor.readContext(); return r; } };
    return { app, toasts, calls, get st() { return st; } };
  };
  // precheck: Reel Pop on nothing selected — step 1 (guides) is ready, step 2 needs layers → it must NOT add the guides
  const none = await mk([Object.assign(box('A', 400), { selected: false })]);
  const reel = KITS.byId('social').recipes.find((r) => r.id === 'reelPop');
  const pc = R.precheck(none.app, reel);
  assert.equal(pc.ok, false); assert.equal(pc.steps[0].state, 'ready'); assert.equal(pc.block.at, 1); assert.ok(pc.block.hint);
  none.calls.length = 0;
  const out = await R.runRecipe(none.app, KITS.byId('social'), reel);
  assert.deepEqual(out.done, []); assert.equal(out.stopped, pc.block.label);
  assert.ok(!none.calls.some((c) => /^tx\.|guides/.test(c)), `nothing was written: ${none.calls}`);
  assert.match(none.toasts[0][1], /nothing was changed/);
  // a step that acts on what an earlier one makes is 'after', never a block
  const one = await mk([box('A', 400)]);
  const ripple = KITS.byId('effectors').recipes.find((r) => r.id === 'rippleWall');
  const pr = R.precheck(one.app, ripple);
  assert.ok(pr.ok && pr.steps[0].state === 'ready' && pr.steps.slice(1).every((s) => s.state !== 'needs'));
  for (const k of KITS.KITS) for (const rc of k.recipes || []) { const p1 = R.precheck(one.app, rc); if (!['wordCascade', 'pulseOnBeat'].includes(rc.id)) assert.ok(p1.ok, `${rc.id}: ${JSON.stringify(p1.block)}`); }
  // a ref: resolves, is ready by the same precheck, runs the chain
  R.bind(one.app);
  const a = A.resolve('recipe:glass/frostFocus');
  assert.ok(a && a.recipe && a.label === 'Frost & Focus' && /→/.test(a.hint));
  assert.deepEqual(a.ready(one.app), { ok: true });
  assert.equal(A.resolve('recipe:social/reelPop').ready(none.app).ok, false);
  assert.equal((await a.run(one.app)).stopped, null);
  assert.equal(A.resolve('recipe:glass/nope'), null); assert.equal(A.resolve('recipe:nokit/x'), null);
  assert.ok(A.catalog().filter((x) => x.group === 'Recipes').length >= 14, 'the pie can hold a recipe');
  // on the Quick Bar: toggled by its ref, runs as the chain, dropped when the recipe is gone
  QB.togglePin(one.app, 'recipe:loops/floatBreathe');
  assert.ok(QB.barIds(one.app).includes('recipe:loops/floatBreathe'));
  const btn = QB.byId('recipe:loops/floatBreathe'); assert.ok(btn.recipe && btn.label === 'Float & Breathe');
  assert.equal((await QB.run(one.app, btn)).stopped, null);
  R.startBuild(one.app, 'loops'); await R.runRef(one.app, KITS.byId('loops'), 'tile:expressions/x-float'); await R.runRef(one.app, KITS.byId('loops'), 'tile:expressions/x-swing');
  const mine = await R.saveBuild(one.app, KITS.byId('loops'));
  const mref = R.refOf(KITS.byId('loops'), mine);
  QB.togglePin(one.app, mref); assert.ok(QB.barIds(one.app).includes(mref));
  // export → import into another machine: checked, not duplicated, junk refused
  const x = R.exportMine(one.app); assert.equal(x.count, 1);
  const other = await mk([box('A', 400)]);
  assert.deepEqual(R.importMine(other.app, x.json), { imported: 1, skipped: [] });
  assert.deepEqual(R.mineOf(other.app, 'loops').map((r) => [r.label, r.refs.length]), [['Mine', 2]]);
  assert.equal(R.importMine(other.app, x.json).imported, 0, 'the same chain twice is skipped');
  assert.equal(R.importMine(other.app, '{"format":"x"}').imported, 0);
  assert.equal(R.importMine(other.app, 'not json').imported, 0);
  const evil = JSON.stringify({ format: R.PACK, version: 1, kits: { loops: [{ label: 'E', refs: ['tile:expressions/x-float', 'tile:layout/cloneGrid'] }, { label: 'F', refs: ['quick:purge', 'cmd:search'] }], ghost: [{ label: 'G', refs: [] }] } });
  const ev = R.importMine(other.app, evil); assert.equal(ev.imported, 0); assert.equal(ev.skipped.length, 3);
  await R.removeMine(one.app, KITS.byId('loops'), mine);
  assert.ok(!QB.barIds(one.app).includes(mref), 'a removed recipe leaves the bar');
  R.bind(null);
});

test('v0.81 layout plan: Bento stages start folded and remember; with keys the Motion Control waits for "Place" in Bento / Control only; Control has the key jobs', () => {
  const B = require('../extension/app/ui/layoutBento');
  const AE = require('../extension/app/ui/layoutAE');
  const fs = require('fs'); const path = require('path');
  const src = (f) => fs.readFileSync(path.join(__dirname, '../extension/app/ui', f), 'utf8');
  // folded by default, an explicit choice (old or new) wins
  const bento = src('layoutBento.js');
  assert.match(bento, /FOLDED_BY_DEFAULT = \(id\) => \/\^st-\/\.test\(id\)/);
  assert.match(bento, /hasOwnProperty\.call\(all, id\) \? !!all\[id\] : FOLDED_BY_DEFAULT\(id\)/);
  // Place: hidden for keys in Bento and Control until asked; never in MOE / Glass; never for layers
  const mk = (layout, open) => { const mem = { 'mc-place-keys': open }; return { services: { settings: { get: () => ({ ui: { layout } }) }, store: { get: (k, d) => (k in mem && mem[k] !== undefined ? mem[k] : d), set: (k, v) => { mem[k] = v; } } }, render: () => {} }; };
  assert.equal(AE.placeHidden(mk('bento'), 'keys'), true); assert.equal(AE.placeHidden(mk('control'), 'keys'), true);
  assert.equal(AE.placeHidden(mk('bento', true), 'keys'), false, 'opened: remembered');
  assert.equal(AE.placeHidden(mk('glass'), 'keys'), false); assert.equal(AE.placeHidden(mk('moe'), 'keys'), false);
  assert.equal(AE.placeHidden(mk('bento'), 'layers'), false);
  assert.equal(AE.placeToggle(mk('glass'), 'keys'), null); assert.equal(AE.placeToggle(mk('bento'), 'layer'), null);
  // Control's key jobs are registered Quick actions already in Timing › Keyframes & Loops (one tool, two styles)
  const ctl = src('layoutControl.js');
  const refs = [...ctl.match(/const KEY_REFS = \[(.*?)\];\n/)[1].matchAll(/'(quick:[a-zA-Z_]+)'/g)].map((m) => m[1]);
  const A = require('../extension/app/ui/actions');
  const assist = AE.TABS.find((t) => t.id === 'ae-keys').groups.find((g) => g.id === 'assist');
  assert.equal(refs.length, 6);
  refs.forEach((r) => { assert.ok(A.resolve(r), r); assert.ok(assist.refs.includes(r), `${r} is in Keyframes & Loops`); });
  // one word for one place across the styles
  const P = require('../extension/app/ui/layoutControlPages');
  assert.equal(P.PAGES.find((p) => p.id === 'move').label, 'Animate');
  const W = require('../extension/app/ui/workflow');
  const tabs = AE.TABS.map((t) => t.label);
  W.STAGES.forEach((st) => assert.ok(tabs.includes(st.label), `${st.label} is one of MOE's tab names`));
});

test('v0.81 (idea 23): the Quick Bar is your own Home — it takes whole kits and recipes, and its page lists them', () => {
  const QB = require('../extension/app/ui/quickbar');
  const A = require('../extension/app/ui/actions');
  const mem = {}; let st = { view: 'home' }; const went = [];
  const app = { services: { store: { get: (k, d) => (k in mem ? mem[k] : d), set: (k, v) => { mem[k] = v; } }, registry: { get: () => ({ params: {} }) } }, render: () => {}, go: (v) => went.push(v), state: { get: () => st, set: (p) => { st = Object.assign({}, st, typeof p === 'function' ? p(st) : p); } }, toast: () => {} };
  QB.togglePin(app, 'kit:effectors');
  assert.ok(QB.barIds(app).includes('kit:effectors'));
  const b = QB.byId('kit:effectors'); assert.ok(b.kit === 'effectors' && b.label === 'Effectors Pro' && b.group === 'Kits');
  QB.run(app, b); assert.equal(st.kitId, 'effectors'); assert.deepEqual(went, ['kits']);
  assert.equal(QB.byId('kit:nope'), null);
  mem['quick-bar'] = ['k_easy', 'kit:nope', 'kit:glass']; assert.deepEqual(QB.barIds(app), ['k_easy', 'kit:glass'], 'a kit that is gone drops off the bar');
  const a = A.resolve('kit:saas'); assert.ok(a && a.nav && a.ready().ok);
  assert.ok(A.catalog().filter((x) => x.group === 'Style Kits').length >= 8, 'kits can go on My pie too');
});
