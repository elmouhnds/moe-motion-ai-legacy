'use strict';
/** v0.92 — Effector on Property (docs/features/EFFECTOR_ANY_PROPERTY.md): the effectors' Custom channel on any number property. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { gridItems } = require('./fixtures/layout');
const EF = require('../extension/features/grid/effectors');
const X = require('../extension/features/grid/expressions');

const tp = (L, mn) => L.property('ADBE Transform Group').property(mn);
const at = (L, mn, t) => tp(L, mn).valueAtTime(t, false);
const cards = (comp) => comp._layers.filter((l) => /^Card/.test(l.name));
const fx = (L, name) => L._parade._children.find((f) => f.name === name);
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const sel = (comp, pick) => comp._layers.forEach((l) => { l.selected = pick(l); });
const slider = (key, value, mn = 'ADBE Slider Control', pn = 'Slider') => ({ key, matchName: mn, before: [], params: [{ id: 'v', value, names: [pn], suffix: 1 }] });

/** A 3 × 3 grid whose items each carry a slider "Amount" (10) and a point control "Spot" ([5, 7]). */
async function gridWith(n = 9) {
  const r0 = await createTestServices(gridItems(n));
  const r = await r0.services.executor.run('grid.build', { mode: 'rect', columns: 3, spacingX: 150, spacingY: 120 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  await r0.services.host.call('effects.ensure', { compId: r0.comp.id, label: 'test', layers: cards(r0.comp).map((L) => ({ layer: { layerId: L.id }, items: [slider('Amount', 10)] })) });
  const G = r0.comp._layers.find((l) => l.name === 'MOE Grid 1');
  const base = cards(r0.comp).map((L) => ({ p: Array.from(at(L, 'ADBE Position', r0.comp.time)) }));
  sel(r0.comp, (l) => l === G);
  return Object.assign(r0, { G, base });
}
const amount = (L, t) => fx(L, 'Amount')._children[0].valueAtTime(t, false);
function pickProp(comp, L, prop) { sel(comp, (l) => l === L); comp._layers.forEach((x) => { const walk = (n) => { if (!n) return; if ('_selected' in n) n._selected = false; (n._children || []).forEach(walk); }; walk(x._parade); }); prop._selected = true; }
function expected(comp, G, E, base, t) {
  const src = {
    at: (tt) => { const v = EF.defaults(); for (const [name, kind] of EF.CONTROLS) if (fx(E, name) && kind !== 'layer') v[EF.KEY[name]] = fx(E, name)._children[0].valueAtTime(tt, false); v.invert = v.invert === 1; return v; },
    toLocal: (tt) => EF.localFn({ position: Array.from(at(E, 'ADBE Position', tt)), rotation: at(E, 'ADBE Rotate Z', tt), scale: Array.from(at(E, 'ADBE Scale', tt)) }),
    originAt: (tt) => Array.from(at(E, 'ADBE Position', tt)).slice(0, 2)
  };
  return base.map((b, i) => EF.applyAt([src], { i, k: i, n: base.length, x: b.p[0], y: b.p[1], fd: comp.frameDuration, compAt: (tt) => { const gp = at(G, 'ADBE Position', tt); return [gp[0] + b.p[0], gp[1] + b.p[1]]; }, baseRotAt: () => 0 }, t));
}

test('the custom channel in the maths: six terms, Custom × amount × weight, spring and Snap / Clamp leave its place', () => {
  assert.equal(EF.amounts(EF.valuesOf({ type: 'random', seed: 3 }), { i: 2, k: 2, n: 9, x: 0, y: 0, time: 0 }).length, 6);
  const src = { at: () => Object.assign(EF.defaults(), { falloff: 4, custom: 40, scale: 0 }), toLocal: () => () => [0, 0] };
  const item = { i: 0, k: 0, n: 4, x: 0, y: 0, fd: 1 / 25, compAt: () => [0, 0], baseRotAt: () => 0 };
  assert.deepEqual(EF.termsAt(src, item, 0, 0), [0, 0, 0, 0, 0, 40]);
  assert.equal(EF.applyAt([src, src], item, 0).custom, 80, 'effectors add up');
  assert.deepEqual(EF.modify({ snapMove: 10, maxRotate: 5 }, [12, 0, 0, 9, 0.5, 40]), [10, 0, 0, 5, 0.5, 40], 'Snap / Clamp keep the custom term');
  assert.ok(EF.needed(EF.valuesOf({ scale: 10, custom: 5 })).includes('Custom') && !EF.needed(EF.valuesOf({ scale: 10 })).includes('Custom'));
  assert.equal(X.customDims(X.buildCustom(1, 4, { gridName: 'MOE Grid 1', home: [0, 0] }, 2)), 2);
  assert.equal(X.customDims(X.buildAll(1, 4, { gridName: 'MOE Grid 1', home: [0, 0] }).position), 0);
  assert.match(X.buildCustom(1, 4, { gridName: 'G', home: [0, 0] }, 1), /\nvalue \+ ecu;$/);
  assert.match(X.buildCustom(1, 4, { gridName: 'G', home: [0, 0] }, 3), /\nadd\(value, \[ecu, ecu, ecu\]\);$/);
});

test('a slider on every item follows a sweeping effector: wired on all 9 from one selection, equal to the reference over time', async () => {
  const a = await gridWith(9);
  const r0 = await a.services.executor.run('grid.effector', { type: 'plain', falloff: 'sphere', size: 260, softness: 80, scale: 0, moveY: 20, sweep: true });
  assert.equal(r0.status, 'success', JSON.stringify(r0.verification || r0.errors));
  const E = a.comp._layers.find((l) => l.name === 'MOE Effector 1');
  assert.ok(!fx(E, 'Custom'), 'the effector has no Custom slider yet');
  const c0 = cards(a.comp)[0];
  pickProp(a.comp, c0, fx(c0, 'Amount')._children[0]);
  const r = await a.services.executor.run('grid.effectProperty', { amount: 50 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.equal(r.result.wired, 9);
  assert.equal(fx(E, 'Custom')._children[0].value, 50, 'Custom 50 was added to the linked effector');
  cards(a.comp).forEach((L) => { const code = fx(L, 'Amount')._children[0]._expression; assert.ok(X.isCurrent(code) && X.customDims(code) === 1, L.name); });
  const T = a.comp.time;
  let seen = 0;
  for (const t of [T, T + 0.5, T + 1, T + 1.5, T + 2]) {
    const exp = expected(a.comp, a.G, E, a.base, t);
    cards(a.comp).forEach((L, i) => { assert.ok(near(amount(L, t), 10 + exp[i].custom, 0.02), `t ${t} item ${i}: ${amount(L, t)} vs ${10 + exp[i].custom}`); if (exp[i].custom > 1) seen++; });
  }
  assert.ok(seen > 5, 'the effector does reach items during the sweep');
  // the user changes Custom in Effect Controls → the property follows
  fx(E, 'Custom')._children[0].setValue(-20);
  const exp = expected(a.comp, a.G, E, a.base, T + 1);
  cards(a.comp).forEach((L, i) => assert.ok(near(amount(L, T + 1), 10 + exp[i].custom, 0.02)));
  // Restore: the sliders are plain numbers again and the Custom slider this run added is gone
  await a.services.executor.restore(r.checkpointId);
  cards(a.comp).forEach((L) => { assert.equal(fx(L, 'Amount')._children[0]._expression || '', ''); assert.equal(amount(L, T + 1), 10); });
  assert.ok(!fx(E, 'Custom'));
});

test('it follows the effector type (Step), a spring and Clamp; a second effector adds; an existing Custom slider is left as set', async () => {
  const a = await gridWith(9);
  await a.services.executor.run('grid.effector', { type: 'step', falloff: 'all', scale: 0, moveX: 5, custom: 80, spring: 100, frequency: 2, decay: 4 });
  const E1 = a.comp._layers.find((l) => l.name === 'MOE Effector 1');
  assert.equal(fx(E1, 'Custom')._children[0].value, 80, 'the Effector tool\'s own Any property amount');
  const c0 = cards(a.comp)[0];
  pickProp(a.comp, c0, fx(c0, 'Amount')._children[0]);
  const r = await a.services.executor.run('grid.effectProperty', { amount: 50 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.equal(fx(E1, 'Custom')._children[0].value, 80, 'left as set');
  assert.deepEqual(r.result.added, []);
  const exp = expected(a.comp, a.G, E1, a.base, 0);
  cards(a.comp).forEach((L, i) => assert.ok(near(amount(L, 0), 10 + exp[i].custom, 0.02), `step item ${i}`));
  assert.ok(near(amount(cards(a.comp)[8], 0), 90, 0.02) && near(amount(cards(a.comp)[0], 0), 10, 0.02), 'Step: 0 on the first item, the full 80 on the last');
});

test('refused before anything is written: a transform property, a colour, a layer outside a grid, nothing selected', async () => {
  const a = await gridWith(4);
  const c0 = cards(a.comp)[0];
  const tryIt = async (label) => { const r = await a.services.executor.run('grid.effectProperty', { amount: 50 }); assert.notEqual(r.status, 'success', label); return JSON.stringify(r.errors || r.error || r); };
  sel(a.comp, (l) => l === c0);
  tp(c0, 'ADBE Rotate Z')._selected = true;
  assert.match(await tryIt('rotation'), /already drives it/);
  tp(c0, 'ADBE Rotate Z')._selected = false;
  sel(a.comp, (l) => l === a.G);
  assert.match(await tryIt('nothing'), /Select a property/);
  // the grid's own controls are not an item's property
  pickProp(a.comp, a.G, fx(a.G, 'Seed')._children[0]);
  assert.match(await tryIt('grid null'), /not an item of a MOE Grid/);
  cards(a.comp).forEach((L) => assert.equal(fx(L, 'Amount')._children[0]._expression || '', '', 'nothing was written'));
  // and a later effector rewrite keeps a wired property on the current version
  pickProp(a.comp, c0, fx(c0, 'Amount')._children[0]);
  assert.equal((await a.services.executor.run('grid.effectProperty', { amount: 50 })).status, 'success');
  cards(a.comp).forEach((L) => { const p = fx(L, 'Amount')._children[0]; p.expression = p._expression.replace(` · v${X.VERSION}\n`, ' · v6\n'); });
  sel(a.comp, (l) => l === a.G);
  assert.equal((await a.services.executor.run('grid.effector', { type: 'plain', falloff: 'all', scale: 0, custom: 30 })).status, 'success');
  cards(a.comp).forEach((L) => { const code = fx(L, 'Amount')._children[0]._expression; assert.ok(X.isCurrent(code) && X.customDims(code) === 1, `${L.name} was rewritten as the current version`); assert.equal(amount(L, 0), 40); });
});

test('the tile exists and the tool is one-click findable', () => {
  const t = require('../extension/app/ui/studio/sections').byId('layout').tiles.find((x) => x.id === 'efProperty');
  assert.ok(t && t.tool === 'grid.effectProperty' && t.tags.includes('Effectors'));
  assert.deepEqual(EF.GROUPS.custom, ['Custom']);
});
