'use strict';
/**
 * v0.33 — Cloner + Effectors (docs/features/CLONER_EFFECTORS.md). The grid items' expressions are evaluated by
 * the mock expression engine and compared with the pure reference in features/grid/effectors.js.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { gridItems, TA } = require('./fixtures/layout');
const { studioComp } = require('./fixtures/studio');
const EF = require('../extension/features/grid/effectors');
const X = require('../extension/features/grid/expressions');

const tp = (L, mn) => L.property('ADBE Transform Group').property(mn);
const cards = (comp) => comp._layers.filter((l) => /^Card/.test(l.name));
const ctl = (L, name) => { const f = L._parade._children.find((x) => x.name === name); return f ? f._children[0] : { valueAtTime: () => { const d = EF.defaults()[EF.KEY[name]]; return d === false ? 0 : d; }, missing: true }; };
const at = (L, mn, t) => tp(L, mn).valueAtTime(t, false);
const select = (comp, pred) => comp._layers.forEach((l) => { l.selected = pred(l); });

async function gridWith(n = 9, buildArgs = {}) {
  const r0 = await createTestServices(gridItems(n));
  const r = await r0.services.executor.run('grid.build', Object.assign({ mode: 'rect', columns: 3, spacingX: 150, spacingY: 120 }, buildArgs));
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const G = r0.comp._layers.find((l) => l.name === 'MOE Grid 1');
  const base = cards(r0.comp).map((L) => Array.from(at(L, 'ADBE Position', r0.comp.time)));
  select(r0.comp, (l) => l === G);
  return Object.assign(r0, { G, base, build: r });
}
/** The reference for every item at time t, given the effector layer E (2D, read from the mock). */
function expected(comp, G, E, base, t) {
  const gp = Array.from(at(G, 'ADBE Position', t));
  const vals = (tt) => { const v = {}; for (const [name] of EF.CONTROLS) v[EF.KEY[name]] = ctl(E, name).valueAtTime(tt, false); v.invert = v.invert === 1; return v; };
  const pos = Array.from(at(E, 'ADBE Position', t)), rot = at(E, 'ADBE Rotate Z', t), sc = Array.from(at(E, 'ADBE Scale', t));
  const toLocal = EF.localFn({ position: pos, rotation: rot, scale: sc });
  const n = base.length;
  return base.map((b, i) => {
    const v0 = vals(t);
    const tt = Math.round(v0.type) === 5 ? t - i * v0.delay * comp.frameDuration : t;
    const r = EF.apply([{ values: Object.assign({}, vals(tt), { type: v0.type, falloff: v0.falloff, size: v0.size, softness: v0.softness, strength: v0.strength, invert: v0.invert }), toLocal }], { i, k: i, n, x: b[0], y: b[1], cx: gp[0] + b[0], cy: gp[1] + b[1], time: t });
    return r;
  });
}
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

test('Plain · Sphere: items inside move, the soft edge blends, outside stays; scale / rotate / fade follow; restore is exact', async () => {
  const { services, comp, G, base } = await gridWith(9);
  const before = cards(comp).map((L) => [Array.from(at(L, 'ADBE Position', 0)), Array.from(at(L, 'ADBE Scale', 0)), at(L, 'ADBE Rotate Z', 0), at(L, 'ADBE Opacity', 0)]);
  const r = await services.executor.run('grid.effector', { type: 'plain', falloff: 'sphere', size: 200, softness: 60, moveY: -80, scale: 50, rotate: 30, fade: 40 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const E = comp._layers.find((l) => l.name === 'MOE Effector 1');
  assert.ok(E && E.nullLayer, 'a null named MOE Effector 1');
  const exp = expected(comp, G, E, base, comp.time);
  cards(comp).forEach((L, i) => {
    const p = at(L, 'ADBE Position', comp.time);
    assert.ok(near(p[0], base[i][0] + exp[i].dx, 0.05) && near(p[1], base[i][1] + exp[i].dy, 0.05), `item ${i} position ${p} vs ${base[i][1] + exp[i].dy}`);
    assert.ok(near(at(L, 'ADBE Scale', comp.time)[0], 100 * exp[i].scaleMul, 0.05), `item ${i} scale`);
    assert.ok(near(at(L, 'ADBE Rotate Z', comp.time), exp[i].rot, 0.05), `item ${i} rotation`);
    assert.ok(near(at(L, 'ADBE Opacity', comp.time), 100 * exp[i].opMul, 0.05), `item ${i} opacity`);
  });
  // the centre item is fully in, a corner (d = 192 px, between 80 and 200) is blended, so it moves less
  assert.ok(near(exp[4].dy, -80) && exp[0].dy > -80 && exp[0].dy < 0, `centre ${exp[4].dy}, corner ${exp[0].dy}`);
  await services.executor.restore(r.checkpointId);
  assert.ok(!comp._layers.some((l) => /^MOE Effector/.test(l.name)), 'effector removed');
  cards(comp).forEach((L, i) => {
    assert.deepEqual(Array.from(at(L, 'ADBE Position', 0)).map((v) => Math.round(v * 100) / 100), before[i][0].map((v) => Math.round(v * 100) / 100));
    assert.equal(at(L, 'ADBE Opacity', 0), before[i][3]);
  });
});

test('Linear falloff sweeps: moving / rotating the effector is the animation (sweep keyframes); values match the reference', async () => {
  const { services, comp, G, base } = await gridWith(9);
  const r = await services.executor.run('grid.effector', { type: 'plain', falloff: 'linear', size: 200, scale: -100, sweep: true });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const E = comp._layers.find((l) => l.name === 'MOE Effector 1');
  assert.equal(tp(E, 'ADBE Position').numKeys, 2, 'sweep keyframed');
  const T = comp.time; // the sweep runs from the playhead for 2 s
  for (const t of [T, T + 0.5, T + 1, T + 1.5, T + 2]) {
    const exp = expected(comp, G, E, base, t);
    cards(comp).forEach((L, i) => assert.ok(near(at(L, 'ADBE Scale', t)[0], 100 * exp[i].scaleMul, 0.05), `t ${t} item ${i}: ${at(L, 'ADBE Scale', t)[0]} vs ${100 * exp[i].scaleMul}`));
  }
  // at the start every item is right of the edge (untouched), at the end all are gone (scale 0)
  assert.ok(cards(comp).every((L) => near(at(L, 'ADBE Scale', T)[0], 100, 0.5)));
  assert.ok(cards(comp).every((L) => near(at(L, 'ADBE Scale', T + 2)[0], 0, 0.5)));
  // a rotated effector: the edge turns with it
  tp(E, 'ADBE Rotate Z').setValue(90);
  const exp = expected(comp, G, E, base, T + 1);
  cards(comp).forEach((L, i) => assert.ok(near(at(L, 'ADBE Scale', T + 1)[0], 100 * exp[i].scaleMul, 0.05), `rotated item ${i}`));
});

test('Random, Step, Noise and Box: each item gets its own share — mock AE equals the reference', async () => {
  for (const [args, check] of [
    [{ type: 'random', falloff: 'all', moveX: 60, moveY: 60, rotate: 45, seed: 7 }, (exp) => assert.ok(new Set(exp.map((e) => Math.round(e.dx))).size > 4, 'random spreads')],
    [{ type: 'step', falloff: 'all', moveY: -90, scale: 0, fade: 100 }, (exp) => { assert.ok(near(exp[0].dy, 0) && near(exp[8].dy, -90)); assert.ok(near(exp[8].opMul, 0)); }],
    [{ type: 'noise', falloff: 'all', moveY: 50, noiseScale: 300, noiseSpeed: 80, seed: 3 }, (exp) => assert.ok(exp.some((e) => Math.abs(e.dy) > 1), 'noise moves')],
    [{ type: 'plain', falloff: 'box', size: 120, softness: 0, moveX: 40, invert: true }, (exp) => { assert.ok(near(exp[4].dx, 0), 'centre inside the box: inverted → untouched'); assert.ok(near(exp[0].dx, 40), 'corner outside: moved'); }]
  ]) {
    const { services, comp, G, base } = await gridWith(9);
    const r = await services.executor.run('grid.effector', args);
    assert.equal(r.status, 'success', `${args.type}: ${JSON.stringify(r.verification || r.errors)}`);
    const E = comp._layers.find((l) => l.name === 'MOE Effector 1');
    for (const t of [0, 0.8]) {
      const exp = expected(comp, G, E, base, t);
      cards(comp).forEach((L, i) => {
        const p = at(L, 'ADBE Position', t);
        assert.ok(near(p[0], base[i][0] + exp[i].dx, 0.05) && near(p[1], base[i][1] + exp[i].dy, 0.05), `${args.type} t ${t} item ${i}: ${p} vs ${[base[i][0] + exp[i].dx, base[i][1] + exp[i].dy]}`);
        assert.ok(near(at(L, 'ADBE Rotate Z', t), exp[i].rot, 0.05) && near(at(L, 'ADBE Opacity', t), 100 * exp[i].opMul, 0.05), `${args.type} item ${i} rot / opacity`);
      });
      if (t === 0) check(exp);
    }
  }
});

test('Delay: keyframe the effector once — every item plays it Delay frames later, in order', async () => {
  const { services, comp, G, base } = await gridWith(6, { columns: 3 });
  const r = await services.executor.run('grid.effector', { type: 'delay', falloff: 'all', delay: 5, moveY: 0, scale: 50, controls: 'all' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const E = comp._layers.find((l) => l.name === 'MOE Effector 1');
  const my = ctl(E, 'Move Y');
  my.setValueAtTime(0, 0); my.setValueAtTime(1, -100);
  const fd = comp.frameDuration;
  for (const t of [0.2, 0.6, 1.1]) {
    const exp = expected(comp, G, E, base, t);
    cards(comp).forEach((L, i) => {
      const p = at(L, 'ADBE Position', t);
      assert.ok(near(p[1], base[i][1] + exp[i].dy, 0.05), `t ${t} item ${i}: ${p[1]} vs ${base[i][1] + exp[i].dy}`);
      assert.ok(near(exp[i].dy, Math.max(-100, Math.min(0, -100 * (t - i * 5 * fd)))), `item ${i} is ${i * 5} frames late`);
    });
  }
});

test('Cloner: one layer → N copies on the grid (sources cycle); restore removes the copies; old grids get effectors in place', async () => {
  const fx = studioComp([
    { name: 'Dot', selected: true, transform: TA({ pos: [500, 300] }), rect: { left: -20, top: -20, width: 40, height: 40 } },
    { name: 'Star', selected: true, transform: TA({ pos: [600, 300] }), rect: { left: -20, top: -20, width: 40, height: 40 } },
    { name: 'BG', selected: false, transform: TA({ pos: [0, 0] }), rect: { left: 0, top: 0, width: 10, height: 10 } }]);
  const { services, comp } = await createTestServices(fx);
  const r = await services.executor.run('grid.build', { mode: 'radial', clones: 7 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const names = r.result.items.map((it) => it.name);
  assert.equal(names.length, 7);
  assert.deepEqual(names.slice(0, 4), ['Dot', 'Star', 'MOE Clone 1 · Dot', 'MOE Clone 1 · Star'], 'sources first, then copies cycling');
  assert.equal(comp._layers.filter((l) => /^MOE Clone/.test(l.name)).length, 5);
  await services.executor.restore(r.checkpointId);
  assert.deepEqual(comp._layers.map((l) => l.name), ['Dot', 'Star', 'BG']);
  // one layer, no clones: still asks for two
  select(comp, (l) => l.name === 'Dot');
  const one = await services.executor.run('grid.build', { mode: 'rect' });
  assert.notEqual(one.status, 'success');

  // an item expression from v0.19–v0.32 (v2) is rewritten as v3 when an effector is added: same slot, home, grid
  const old = X.buildAll(2, 6, { gridName: 'MOE Grid 4', home: [12, -7] }).position.replace(` · v${X.VERSION}\n`, ' · v2\n');
  const f = X.factsOf(old);
  assert.deepEqual([f.i, f.n, f.home, f.gridName], [2, 6, [12, -7], 'MOE Grid 4']);
  assert.ok(X.isV2(old) && !X.isV3(old) && X.isV3(X.buildAll(f.i, f.n, f).position));
});

test('Three effectors per grid; a fourth is refused with what to do; Effector is in Layer › Arrange and the Layout library', async () => {
  const { services, comp } = await gridWith(4, { columns: 2 });
  for (let k = 1; k <= 3; k++) {
    const r = await services.executor.run('grid.effector', { type: 'plain', falloff: 'all', moveX: 10 });
    assert.equal(r.status, 'success', `effector ${k}: ${JSON.stringify(r.verification || r.errors)}`);
    select(comp, (l) => l.name === 'MOE Grid 1');
  }
  // three plain effectors, everywhere, +10 px each → +30 px
  const b = await gridWith(4, { columns: 2 });
  const shift = cards(comp).map((L, i) => at(L, 'ADBE Position', 0)[0] - b.base[i][0]);
  assert.ok(shift.every((d) => near(d, 30, 0.05)), `stacked: ${shift}`);
  const r4 = await services.executor.run('grid.effector', { type: 'plain', falloff: 'all', moveX: 10 });
  assert.notEqual(r4.status, 'success');
  assert.match(JSON.stringify(r4.errors || r4), /three effectors/);
  assert.equal(comp._layers.filter((l) => /^MOE Effector/.test(l.name)).length, 3, 'the refused one left nothing behind');
  // with nothing to do it is refused before anything is made
  const r5 = await services.executor.run('grid.effector', { type: 'plain', falloff: 'all', scale: 0 });
  assert.notEqual(r5.status, 'success');
  const S = require('../extension/app/ui/studio/sections');
  const lay = S.byId('layout');
  assert.ok(lay.modes.some(([m]) => m === 'Clone') && lay.modes.some(([m]) => m === 'Effectors'));
  assert.ok(lay.tiles.filter((t) => t.tool === 'grid.effector').length >= 5);
  assert.ok(lay.tiles.filter((t) => t.tool === 'grid.build' && t.args.clones).length >= 4);
});
