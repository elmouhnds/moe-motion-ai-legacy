'use strict';
/**
 * v0.41 — Clone Trails (docs/features/CLONE_TRAILS.md): copies of an animated layer that replay its motion later,
 * fading / shrinking / turning per copy. Mock-evaluated copies are compared with features/grid/trail.js.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { TA } = require('./fixtures/layout');
const { studioComp } = require('./fixtures/studio');
const TR = require('../extension/features/grid/trail');

const tp = (L, mn) => L.property('ADBE Transform Group').property(mn);
const at = (L, mn, t) => tp(L, mn).valueAtTime(t, false);
const ctl = (L, name) => L._parade._children.find((f) => f.name === name)._children[0];
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

/** A "Ball" that moves right and turns over 2 s (keyframed), plus an optional parent null. */
function ballComp({ parent = false } = {}) {
  const ball = TA({ pos: [200, 500] });
  ball[1] = Object.assign({}, ball[1], { keys: [{ time: 0, value: [200, 500] }, { time: 2, value: [1400, 300] }] });
  ball[3] = Object.assign({}, ball[3], { keys: [{ time: 0, value: 0 }, { time: 2, value: 180 }] });
  const layers = [{ name: 'Ball', selected: true, transform: ball, rect: { left: -40, top: -40, width: 80, height: 80 } }];
  if (parent) { layers.push({ name: 'Rig', nullLayer: true, transform: TA({ pos: [100, 50] }) }); layers[0].parent = 'Rig'; }
  return studioComp(layers);
}
const srcAt = (S, t) => ({ position: Array.from(at(S, 'ADBE Position', t)), scale: Array.from(at(S, 'ADBE Scale', t)), rotation: at(S, 'ADBE Rotate Z', t), opacity: at(S, 'ADBE Opacity', t) });

test('a trail of 5: each copy = the Ball k × Delay frames earlier, fading, shrinking and turning per copy; reference = mock', async () => {
  const { services, comp } = await createTestServices(ballComp());
  comp.time = 0;
  const r = await services.executor.run('grid.trail', { copies: 5, delay: 3, fade: 20, scaleStep: 10, rotateStep: 15 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const S = comp._layers.find((l) => l.name === 'Ball'), N = comp._layers.find((l) => l.name === 'MOE Trail 1');
  assert.ok(N && N.nullLayer, 'MOE Trail 1 holds the controls');
  const copies = r.result.copies.map((id) => comp._layers.find((l) => l.id === id));
  assert.equal(copies.length, 5);
  assert.ok(copies.every((L) => L.index > S.index && !L.parent), 'below the Ball, unparented');
  const c = { delay: 3, fade: 20, scaleStep: 10, rotateStep: 15 };
  for (const t of [0.5, 1, 1.6, 2.4]) {
    copies.forEach((L, i) => {
      const want = TR.at(i + 1, (tt) => srcAt(S, tt), c, t, comp.frameDuration);
      const p = at(L, 'ADBE Position', t);
      assert.ok(near(p[0], want.position[0]) && near(p[1], want.position[1]), `t ${t} copy ${i + 1} position ${p} vs ${want.position}`);
      assert.ok(near(at(L, 'ADBE Scale', t)[0], want.scale[0]) && near(at(L, 'ADBE Rotate Z', t), want.rotation) && near(at(L, 'ADBE Opacity', t), want.opacity), `t ${t} copy ${i + 1}`);
    });
  }
  // the 3rd copy 1 s in shows where the Ball was 9 frames (0.36 s) earlier, at 0.8^3 of its opacity
  assert.ok(near(at(copies[2], 'ADBE Position', 1)[0], at(S, 'ADBE Position', 1 - 9 / 25)[0]) && near(at(copies[2], 'ADBE Opacity', 1), 100 * 0.512));
  // live: Delay on the null
  ctl(N, 'Delay').setValue(6);
  assert.ok(near(at(copies[0], 'ADBE Position', 1)[0], at(S, 'ADBE Position', 1 - 6 / 25)[0]), 'Delay 6 → the first copy is 6 frames behind');
  await services.executor.restore(r.checkpointId);
  assert.ok(!comp._layers.some((l) => /^MOE (Clone|Trail) /.test(l.name)), 'restore removes the copies and the null');
  assert.ok(comp._layers.some((l) => l.name === 'Ball'));
});

test('a parented source: the copies follow its place in the comp (the parent\'s move included)', async () => {
  const { services, comp } = await createTestServices(ballComp({ parent: true }));
  comp.time = 0;
  const S = comp._layers.find((l) => l.name === 'Ball'), Rig = comp._layers.find((l) => l.name === 'Rig');
  S._parent = Rig;
  const r = await services.executor.run('grid.trail', { copies: 3, delay: 4, fade: 0, scaleStep: 0, rotateStep: 0 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const copy = comp._layers.find((l) => l.id === r.result.copies[0]);
  const t = 1, ts = t - 4 / 25, p = at(S, 'ADBE Position', ts), rp = at(Rig, 'ADBE Position', ts);
  const got = at(copy, 'ADBE Position', t);
  assert.ok(near(got[0], p[0] + rp[0]) && near(got[1], p[1] + rp[1]), `comp point ${got} vs ${[p[0] + rp[0], p[1] + rp[1]]}`);
});

test('refused before anything is made: two layers, a null, a name used twice', async () => {
  const two = await createTestServices(studioComp([{ name: 'A', selected: true, transform: TA({}) }, { name: 'B', selected: true, transform: TA({}) }]));
  assert.match(JSON.stringify((await two.services.executor.run('grid.trail', { copies: 4 })).errors), /Select one animated layer/);
  const nul = await createTestServices(studioComp([{ name: 'Ctrl', nullLayer: true, selected: true, transform: TA({}) }]));
  assert.match(JSON.stringify((await nul.services.executor.run('grid.trail', { copies: 4 })).errors), /a trail needs a layer you can see/);
  const dup = await createTestServices(studioComp([{ name: 'Logo', selected: true, transform: TA({}) }, { name: 'Logo', transform: TA({}) }]));
  assert.match(((await dup.services.executor.run('grid.trail', { copies: 4 })).errors || []).join(' '), /Two layers are named "Logo"/);
  assert.equal(dup.comp._layers.length, 2, 'nothing added');
});

test('Library: Echo, Ghost and Spin Trail are in Clone mode (full rows)', () => {
  const S = require('../extension/app/ui/studio/sections');
  const lay = S.byId('layout');
  for (const id of ['trailEcho', 'trailGhost', 'trailSpin']) {
    const t = lay.tiles.find((x) => x.id === id);
    assert.ok(t && t.tool === 'grid.trail' && t.tags.includes('Clone'), id);
  }
  const AE = require('../extension/app/ui/layoutAE');
  const arr = AE.TABS.find((t) => t.id === 'ae-layer').groups.find((g) => g.id === 'arrange');
  const clone = arr.modes.find(([m]) => m === 'clone')[2];
  assert.equal(clone.length % 3, 0);
  ['trailEcho', 'trailGhost', 'trailSpin'].forEach((id) => assert.ok(clone.includes(id) && arr.ids.includes(id), id));
});
