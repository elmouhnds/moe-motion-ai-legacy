'use strict';
/**
 * v0.47 — Real Previews (docs/features/REAL_PREVIEWS.md): a tile's preview plays the keys its tool writes.
 * The mock interpolates linearly (it does not play After Effects' ease), so these tests compare the KEYS — times,
 * values, ease influences, interpolation — that the tool wrote on the mock with the plan the preview draws; the
 * ease playback itself is `bezier.fromTemporal` (AE's influence → bezier), tested in tests/curves*.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTestServices } = require('./helpers/harness');
const { TA } = require('./fixtures/layout');
const { studioComp } = require('./fixtures/studio');
const P = require('../extension/features/quick/animatePlan');
const S = require('../extension/app/ui/studio/sections');

const near = (a, b, t = 1e-6) => (Array.isArray(a) ? a.every((x, i) => Math.abs(x - b[i]) <= t) : Math.abs(a - b) <= t);
const fx = () => studioComp([
  { name: 'Box', selected: true, transform: TA({ pos: [960, 540] }), rect: { left: -50, top: -50, width: 100, height: 100 } },
  { name: 'Line', shapes: [{ name: 'S', stroke: [1, 1, 1], path: [[0, 0], [100, 0]] }], transform: TA({ pos: [960, 540] }) }
], { comp: { time: 2 } });
const tp = (L, mn) => L.property('ADBE Transform Group').property(mn);
const named = (comp, n) => comp._layers.find((l) => l.name === n);

/** The keys on a mock property, in the plan's shape (times relative to the first key). */
function written(prop) {
  const t0 = prop._keys[0].t;
  return prop._keys.map((k) => ({ t: k.t - t0, v: Array.isArray(k.value) ? Array.from(k.value) : k.value, inf: [k.easeIn[0].influence, k.easeOut[0].influence] }));
}
// v0.61: After Effects writes the plan on the comp's frame grid (25 fps here; the playhead is on a frame)
const FG = require('../extension/core/framegrid');
function same(prop, plan0, label) {
  const plan = FG.snapKeys(plan0, 1 / 25).keys;
  const w = written(prop);
  assert.equal(w.length, plan.length, `${label}: number of keys`);
  plan.forEach((k, i) => {
    assert.ok(near(w[i].t, k.t), `${label} key ${i + 1}: time ${w[i].t} vs ${k.t}`);
    const pv = Array.isArray(k.v) ? k.v : k.v;
    assert.ok(near(Array.isArray(w[i].v) ? w[i].v.slice(0, Array.isArray(pv) ? pv.length : 1) : w[i].v, pv, 1e-6), `${label} key ${i + 1}: value ${JSON.stringify(w[i].v)} vs ${JSON.stringify(pv)}`);
    if (k.easeOut && !k.interp) assert.ok(near(w[i].inf[1], k.easeOut.influence), `${label} key ${i + 1}: out influence ${w[i].inf[1]} vs ${k.easeOut.influence}`);
    if (k.easeIn && !k.interp) assert.ok(near(w[i].inf[0], k.easeIn.influence), `${label} key ${i + 1}: in influence ${w[i].inf[0]} vs ${k.easeIn.influence}`);
  });
}

test('Quick Animate writes exactly the plan the preview plays (fade, scale + overshoot, spin, every ease)', async () => {
  for (const ease of ['snappy', 'smooth', 'gentle', 'expo']) {
    const { services, comp } = await createTestServices(fx());
    const box = named(comp, 'Box');
    let args = { kind: 'fade', dir: 'in', duration: 0.6, ease };
    assert.equal((await services.executor.run('quick.animate', args)).status, 'success');
    same(tp(box, 'ADBE Opacity'), P.animate(args, { opacity: 100 }).keys, `fade ${ease}`);
    args = { kind: 'scale', dir: 'in', duration: 0.8, ease, overshoot: true };
    assert.equal((await services.executor.run('quick.animate', args)).status, 'success');
    same(tp(box, 'ADBE Scale'), P.animate(args, { scale: [100, 100] }).keys, `pop ${ease}`);
    args = { kind: 'spin', dir: 'in', duration: 0.5, ease, overshoot: true };
    assert.equal((await services.executor.run('quick.animate', args)).status, 'success');
    same(tp(box, 'ADBE Rotate Z'), P.animate(args, { rotation: 0 }).keys, `spin ${ease}`);
  }
});

test('Trim Paths writes the plan the preview plays (draw, erase, travel lag, draw + erase hold)', async () => {
  for (const args of [{ mode: 'draw', duration: 1 }, { mode: 'erase', duration: 0.7 }, { mode: 'travel', duration: 1, lag: 50 }, { mode: 'drawErase', duration: 0.8, hold: 0.3 }]) {
    const { services, comp } = await createTestServices(fx());
    comp._layers.forEach((l) => { l.selected = l.name === 'Line'; });
    const full = Object.assign({ ease: 'smooth' }, args);
    assert.equal((await services.executor.run('quick.trimPaths', full)).status, 'success', args.mode);
    const trim = named(comp, 'Line').property('ADBE Root Vectors Group')._children.find((c) => c.name === 'MOE Trim');
    const plan = P.trim(full);
    const [start, end] = [trim._children[0], trim._children[1]];
    const t0 = 2;
    for (const [prop, keys, name] of [[start, plan.start, 'start'], [end, plan.end, 'end']]) {
      if (!keys) { assert.equal(prop._keys.length, 0, `${args.mode} ${name}: not keyed`); continue; }
      assert.deepEqual(prop._keys.map((k) => +(k.t - t0).toFixed(6)), FG.snapKeys(keys, 1 / 25).keys.map((k) => +k.t.toFixed(6)), `${args.mode} ${name} times (on the frame grid)`);
      assert.deepEqual(prop._keys.map((k) => k.value), keys.map((k) => k.v), `${args.mode} ${name} values`);
    }
  }
});

test('valueAt plays After Effects ease: rest values at the ends, overshoot through its key, linear stays linear', () => {
  const pop = P.animate({ kind: 'scale', dir: 'in', duration: 0.6, ease: 'snappy', overshoot: true }, { scale: [100, 100] });
  assert.deepEqual(P.valueAt(pop.keys, -1), [0, 0]);
  assert.ok(near(P.valueAt(pop.keys, 0.432), [108, 108], 1e-9), 'overshoot key at 72 %');
  assert.deepEqual(P.valueAt(pop.keys, 0.6), [100, 100]);
  // speed 0 at the keys: the first steps move less than linear would
  assert.ok(P.valueAt(pop.keys, 0.01)[0] < 0.01 / 0.432 * 108);
  const lin = P.animate({ kind: 'fade', dir: 'out', duration: 1, ease: 'linear' }, { opacity: 80 });
  assert.ok(near(P.valueAt(lin.keys, 0.25), 60));
  // monotone between two eased keys (no wobble a preview could invent)
  const f = P.animate({ kind: 'fade', dir: 'in', duration: 1, ease: 'expo' }, {});
  let prev = -1; for (let t = 0; t <= 1.0001; t += 0.02) { const v = P.valueAt(f.keys, t); assert.ok(v >= prev - 1e-9); prev = v; }
  assert.equal(P.endOf(pop.keys), 0.6);
  assert.equal(P.endOf(P.trim({ mode: 'drawErase', duration: 1, hold: 0.5 }).start), 2.5);
});

test('the tools build their keys from the plan, and every Animate / Trim tile preview draws it', () => {
  const src = fs.readFileSync(path.join(__dirname, '../extension/features/quick/tools.js'), 'utf8');
  assert.match(src, /require\('\.\/animatePlan'\)/);
  assert.match(src, /PLAN\.keysFor\(/);
  const th = fs.readFileSync(path.join(__dirname, '../extension/app/ui/studio/thumbs.js'), 'utf8');
  assert.match(th, /PLAN\.valueAt\(/);
  // every Animate tile carries what its preview needs: the tool's args
  const anim = S.byId('animate').tiles.filter((t) => ['quick.animate', 'quick.trimPaths'].includes(t.tool));
  assert.ok(anim.length >= 16);
  for (const t of anim) assert.ok(['move', 'fade', 'scale', 'spin', 'trim', 'stagger'].includes(t.thumb.k), `${t.id}: ${t.thumb.k}`);
});
