'use strict';
/** v0.93 — controls on demand for the grid null (docs/features/CONTROLS_ON_DEMAND.md): 8 sliders instead of 46. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { gridItems } = require('./fixtures/layout');
const X = require('../extension/features/grid/expressions');

const tp = (L, mn) => L.property('ADBE Transform Group').property(mn);
const cards = (comp) => comp._layers.filter((l) => /^Card/.test(l.name));
const names = (L) => L._parade._children.map((f) => f.name);
const fx = (L, name) => L._parade._children.find((f) => f.name === name);
const sel = (comp, pick) => comp._layers.forEach((l) => { l.selected = pick(l); });
const state = (comp, t = 0) => cards(comp).map((L) => [...tp(L, 'ADBE Position').valueAtTime(t, false), tp(L, 'ADBE Scale').valueAtTime(t, false)[0], tp(L, 'ADBE Rotate Z').valueAtTime(t, false), tp(L, 'ADBE Opacity').valueAtTime(t, false)]);
const same = (a, b, label) => a.forEach((row, i) => row.forEach((v, j) => assert.ok(Math.abs(v - b[i][j]) < 1e-6, `${label}: item ${i} value ${j}: ${v} vs ${b[i][j]}`)));
async function build(args, n = 9) {
  const r0 = await createTestServices(gridItems(n));
  const r = await r0.services.executor.run('grid.build', args);
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const G = r0.comp._layers.find((l) => l.name === 'MOE Grid 1');
  return Object.assign(r0, { G, r });
}

test('gridNeeded(): the layout\'s own controls + Order + Item Scale; a group only when it is used', () => {
  const p = (m, o) => Object.assign(X.defaultParams(m), o || {});
  assert.deepEqual(X.gridNeeded('rect', p('rect')), ['Layout', 'Columns', 'Spacing X', 'Spacing Y', 'Row Offset', 'Column Offset', 'Order', 'Item Scale']);
  assert.deepEqual(X.gridNeeded('radial', p('radial')), ['Layout', 'Radius', 'Start Angle', 'Arc', 'Ring Size', 'Ring Spacing', 'Order', 'Item Scale']);
  assert.ok(['Build', 'Build Stagger', 'Build Order', 'Build Style', 'Build Distance'].every((n) => X.gridNeeded('rect', p('rect'), { build: true }).includes(n)));
  assert.ok(X.gridNeeded('rect', p('rect', { order: 4 })).includes('Seed') && !X.gridNeeded('rect', p('rect')).includes('Seed'));
  assert.ok(X.gridNeeded('rect', p('rect', { twist: 10, orient: 2 })).includes('Twist') && X.gridNeeded('rect', p('rect', { orient: 2 })).includes('Orient'));
  const m = X.gridNeeded('rect', p('rect', { morphTo: 'radial' }), { morph: true });
  assert.ok(['Morph To', 'Morph', 'Radius', 'Arc'].every((n) => m.includes(n)), 'a morph brings the other layout\'s controls');
  assert.equal(X.controlsFor('rect').length, 46);
  assert.ok(X.gridNeeded('rect', p('rect')).length <= 8);
  // every optional group is made of real controls; "layouts" is everything the chosen layout does not own
  const all = new Set(X.allControls().map((c) => c[0]));
  for (const g of Object.values(X.GRID_GROUPS)) assert.ok(g.every((n) => all.has(n)));
  assert.ok(!X.gridGroupNames('layouts', 'rect').includes('Columns') && X.gridGroupNames('layouts', 'rect').includes('Radius'));
  assert.equal(X.gridDefaults(p('rect', { columns: 7, reverse: true })).Columns, 7);
  assert.equal(X.gridDefaults(p('rect', { reverse: true })).Reverse, 1);
  assert.equal(X.factsOf(X.buildAll(0, 4, { gridName: 'G', home: [1, 2], defaults: X.gridDefaults(p('rect', { columns: 7 })) }).scale).defaults.Columns, 7);
});

test('a new grid has 8 controls and gives exactly the same result as one with all 46 — plain, animated, morphing, radial', async () => {
  for (const args of [
    { mode: 'rect', columns: 3, spacingX: 150, spacingY: 120 },
    { mode: 'rect', columns: 3, spacingX: 150, spacingY: 120, animateIn: true, buildStyle: '4', buildOrder: '3' },
    { mode: 'radial', radius: 220, arc: 200, orient: '2' },
    { mode: 'rect', columns: 3, rowOffset: 50, order: '4' }
  ]) {
    const lean = await build(args), full = await build(Object.assign({ controls: 'all' }, args));
    assert.equal(names(full.G).length, 46, JSON.stringify(args));
    assert.ok(names(lean.G).length < 16, `${JSON.stringify(args)}: ${names(lean.G).length} controls`);
    for (const t of [0, 0.3, 1]) same(state(lean.comp, t), state(full.comp, t), `${JSON.stringify(args)} t ${t}`);
  }
  const plain = await build({ mode: 'rect', columns: 3, spacingX: 150, spacingY: 120 });
  assert.deepEqual(names(plain.G), ['Layout', 'Columns', 'Spacing X', 'Spacing Y', 'Row Offset', 'Column Offset', 'Order', 'Item Scale']);
});

test('Grid Controls (the panel\'s tool) adds a control that is not there; Grid Sliders adds a group with the built values; nothing moves; Restore is exact', async () => {
  const a = await build({ mode: 'rect', columns: 3, spacingX: 150, spacingY: 120 });
  const before = state(a.comp), n0 = names(a.G);
  // Twist is not on the null → Grid Controls adds it with the value
  const u = await a.services.executor.run('grid.update', { gridId: a.G.id, values: JSON.stringify({ Twist: 15, 'Spacing X': 200 }) });
  assert.equal(u.status, 'success', JSON.stringify(u.verification || u.errors));
  assert.deepEqual(names(a.G), n0.concat(['Twist']));
  assert.equal(fx(a.G, 'Twist')._children[0].value, 15); assert.equal(fx(a.G, 'Spacing X')._children[0].value, 200);
  assert.ok(Math.abs(tp(cards(a.comp)[2], 'ADBE Rotate Z').valueAtTime(0, false) - 30) < 1e-6, 'and the items follow it (Twist × k)');
  await a.services.executor.restore(u.checkpointId);
  assert.deepEqual(names(a.G), n0, 'Restore removes the control it added'); assert.equal(fx(a.G, 'Spacing X')._children[0].value, 150);
  same(state(a.comp), before, 'restored');
  // Grid Sliders: a group, then all
  sel(a.comp, (l) => l === a.G);
  const r1 = await a.services.executor.run('grid.controls', { group: 'build' });
  assert.equal(r1.status, 'success', JSON.stringify(r1.verification || r1.errors));
  assert.deepEqual(names(a.G), n0.concat(['Build', 'Build Stagger', 'Build Order', 'Build Style', 'Build Distance']));
  assert.equal(fx(a.G, 'Build')._children[0].value, 100);
  const r2 = await a.services.executor.run('grid.controls', { group: 'all' });
  assert.equal(r2.status, 'success', JSON.stringify(r2.verification || r2.errors));
  assert.equal(names(a.G).length, 46); assert.equal(new Set(names(a.G)).size, 46, 'never a second copy');
  same(state(a.comp), before, 'all 46 added: nothing moved');
  // the added layout controls carry the numbers the grid was built with (auto sizes), not generic ones
  const full = await build({ mode: 'rect', columns: 3, spacingX: 150, spacingY: 120, controls: 'all' });
  for (const n of ['Radius', 'Ring Spacing', 'Spread', 'Spiral Step', 'Build Distance']) assert.equal(fx(a.G, n)._children[0].value, fx(full.G, n)._children[0].value, n);
  await a.services.executor.restore(r2.checkpointId);
  assert.equal(names(a.G).length, n0.length + 5, 'Restore removes what that run added');
  // switching Layout in Effect Controls on a lean grid uses the built values for the other layout
  const lean = await build({ mode: 'rect', columns: 3, spacingX: 150, spacingY: 120 }), all = await build({ mode: 'rect', columns: 3, spacingX: 150, spacingY: 120, controls: 'all' });
  fx(lean.G, 'Layout')._children[0].setValue(2); fx(all.G, 'Layout')._children[0].setValue(2);
  same(state(lean.comp), state(all.comp), 'Layout → Radial with no radial controls on the null');
});

test('effectors, a tracer and a property wired to effectors all work on a lean grid; the tile exists', async () => {
  const a = await build({ mode: 'rect', columns: 3, spacingX: 150, spacingY: 120 });
  sel(a.comp, (l) => l === a.G);
  const e = await a.services.executor.run('grid.effector', { type: 'plain', falloff: 'all', scale: 50 });
  assert.equal(e.status, 'success', JSON.stringify(e.verification || e.errors));
  assert.ok(names(a.G).includes('Effector'), 'the slot is added when an effector is linked');
  assert.ok(Math.abs(tp(cards(a.comp)[0], 'ADBE Scale').valueAtTime(0, false)[0] - 150) < 1e-6);
  sel(a.comp, (l) => l === a.G);
  assert.equal((await a.services.executor.run('grid.tracer', { mode: 'grid' })).status, 'success');
  const t = require('../extension/app/ui/studio/sections').byId('layout').tiles.find((x) => x.id === 'gridSliders');
  assert.ok(t && t.tool === 'grid.controls' && t.tags.includes('Clone'));
});
