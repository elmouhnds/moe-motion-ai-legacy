'use strict';
/** v0.90 — Remove Effector / Freeze Effector (docs/features/EFFECTOR_REMOVE_FREEZE.md). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { gridItems } = require('./fixtures/layout');
const EF = require('../extension/features/grid/effectors');

const tp = (L, mn) => L.property('ADBE Transform Group').property(mn);
const at = (L, mn, t) => tp(L, mn).valueAtTime(t, false);
const cards = (comp) => comp._layers.filter((l) => /^Card/.test(l.name));
const fx = (L, name) => L._parade._children.find((f) => f.name === name);
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const sel = (comp, pick) => comp._layers.forEach((l) => { l.selected = pick(l); });
const state = (comp, t) => cards(comp).map((L) => [at(L, 'ADBE Position', t)[0], at(L, 'ADBE Position', t)[1], at(L, 'ADBE Scale', t)[0], at(L, 'ADBE Rotate Z', t)]);

async function gridWith(n = 9) {
  const r0 = await createTestServices(gridItems(n));
  const r = await r0.services.executor.run('grid.build', { mode: 'rect', columns: 3, spacingX: 150, spacingY: 120 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const G = r0.comp._layers.find((l) => l.name === 'MOE Grid 1');
  const rest = state(r0.comp, 0);
  sel(r0.comp, (l) => l === G);
  return Object.assign(r0, { G, rest });
}
const closeAll = (a, b, label) => a.forEach((row, i) => row.forEach((v, j) => assert.ok(near(v, b[i][j], 0.02), `${label}: item ${i} channel ${j}: ${v} vs ${b[i][j]}`)));

test('Remove Effector: one of two goes; the other keeps doing exactly what it did alone; the grid is untouched', async () => {
  // what effector B does on its own
  const solo = await gridWith();
  await solo.services.executor.run('grid.effector', { type: 'step', falloff: 'all', rotate: 90, scale: 0 });
  const onlyB = state(solo.comp, 0);
  // A (scale) + B (rotate) on one grid, then remove A
  const a = await gridWith();
  await a.services.executor.run('grid.effector', { type: 'plain', falloff: 'all', scale: 50 });
  sel(a.comp, (l) => l === a.G);
  await a.services.executor.run('grid.effector', { type: 'step', falloff: 'all', rotate: 90, scale: 0 });
  const both = state(a.comp, 0);
  assert.ok(both.some((r, i) => !near(r[2], onlyB[i][2], 0.5)), 'A does scale the items');
  const A = a.comp._layers.find((l) => l.name === 'MOE Effector 1');
  sel(a.comp, (l) => l === A);
  const layersBefore = a.comp._layers.length;
  const r = await a.services.executor.run('grid.effectorRemove', {});
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.equal(a.comp._layers.length, layersBefore - 1);
  assert.ok(!a.comp._layers.some((l) => l.name === 'MOE Effector 1') && a.comp._layers.some((l) => l.name === 'MOE Effector 2'), 'only A is gone');
  closeAll(state(a.comp, 0), onlyB, 'after removing A');
  // the grid, not an effector, selected → refused, nothing removed
  sel(a.comp, (l) => l === a.G);
  const r2 = await a.services.executor.run('grid.effectorRemove', {});
  assert.notEqual(r2.status, 'success');
  assert.ok(a.comp._layers.some((l) => l.name === 'MOE Effector 2') && a.comp._layers.includes(a.G));
  // remove the last one: the items are back at rest
  sel(a.comp, (l) => l.name === 'MOE Effector 2');
  assert.equal((await a.services.executor.run('grid.effectorRemove', {})).status, 'success');
  closeAll(state(a.comp, 0), a.rest, 'no effectors left');
});

test('Freeze Effector: a sweeping, keyframed effector holds this frame for good; Restore brings every key back', async () => {
  const a = await gridWith();
  const r0 = await a.services.executor.run('grid.effector', { type: 'delay', falloff: 'sphere', size: 300, softness: 80, moveY: -80, scale: 40, delay: 2, sweep: true });
  assert.equal(r0.status, 'success', JSON.stringify(r0.verification || r0.errors));
  const E = a.comp._layers.find((l) => l.name === 'MOE Effector 1');
  const keysOf = () => ({ pos: tp(E, 'ADBE Position').numKeys, my: fx(E, 'Move Y')._children[0].numKeys, sc: fx(E, 'Scale')._children[0].numKeys });
  const k0 = keysOf();
  assert.ok(k0.pos === 2 && k0.my === 2 && k0.sc === 2, JSON.stringify(k0));
  const T = a.comp.time + 0.2;
  a.comp.time = T;
  const moving = [state(a.comp, T), state(a.comp, T + 0.3)];
  assert.ok(moving[0].some((r, i) => !near(r[1], moving[1][i][1], 0.5)), 'it is animating before the freeze');
  const posAt = Array.from(at(E, 'ADBE Position', T)), myAt = fx(E, 'Move Y')._children[0].valueAtTime(T, false);
  sel(a.comp, (l) => l === E);
  const r = await a.services.executor.run('grid.effectorFreeze', {});
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.deepEqual(keysOf(), { pos: 0, my: 0, sc: 0 });
  assert.ok(near(at(E, 'ADBE Position', T + 5)[0], posAt[0], 1e-6) && near(fx(E, 'Move Y')._children[0].valueAtTime(T + 5, false), myAt, 1e-6), 'the values of that frame stay');
  // the effector null no longer changes over time (Delay still reads its own past: by 2 s later every item has settled)
  closeAll(state(a.comp, T + 3), state(a.comp, T + 6), 'frozen');
  assert.ok(a.comp._layers.includes(E) && fx(a.G, 'Effector')._children[0].value > 0, 'still there and linked');
  await a.services.executor.restore(r.checkpointId);
  assert.deepEqual(keysOf(), k0, 'every key is back');
  closeAll(state(a.comp, T), moving[0], 'restored'); closeAll(state(a.comp, T + 0.3), moving[1], 'restored later');
  // nothing keyed → success, nothing written
  const b = await gridWith();
  await b.services.executor.run('grid.effector', { type: 'plain', falloff: 'all', scale: 30 });
  const Eb = b.comp._layers.find((l) => l.name === 'MOE Effector 1');
  sel(b.comp, (l) => l === Eb);
  const before = state(b.comp, 0);
  const rb = await b.services.executor.run('grid.effectorFreeze', {});
  assert.equal(rb.status, 'success');
  assert.match(JSON.stringify(rb.verification), /nothing to freeze/);
  closeAll(state(b.comp, 0), before, 'untouched');
});

test('both are tiles in Layout › Effectors with unique names', () => {
  const lay = require('../extension/app/ui/studio/sections').byId('layout');
  for (const [id, tool] of [['efRemove', 'grid.effectorRemove'], ['efFreeze', 'grid.effectorFreeze']]) { const t = lay.tiles.find((x) => x.id === id); assert.ok(t && t.tool === tool && t.tags.includes('Effectors'), id); }
  assert.equal(EF.NAME.test('MOE Effector 12'), true); assert.equal(EF.NAME.test('MOE Grid 1'), false);
});
