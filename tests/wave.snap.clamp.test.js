'use strict';
/**
 * v0.88 — Wave effector, Snap To and Clamp (docs/features/WAVE_SNAP_CLAMP.md). The items' expressions are evaluated
 * by the mock engine and compared with the pure reference (features/grid/effectors.js waveAt / modify / applyAt).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { gridItems } = require('./fixtures/layout');
const EF = require('../extension/features/grid/effectors');
const studio = require('../extension/app/ui/studio/sections');

const tp = (L, mn) => L.property('ADBE Transform Group').property(mn);
const at = (L, mn, t) => tp(L, mn).valueAtTime(t, false);
const cards = (comp) => comp._layers.filter((l) => /^Card/.test(l.name));
const fx = (L, name) => L._parade._children.find((f) => f.name === name);
const near = (a, b, tol) => Math.abs(a - b) <= tol;

async function gridWith(n = 9) {
  const r0 = await createTestServices(gridItems(n));
  const r = await r0.services.executor.run('grid.build', { mode: 'rect', columns: 3, spacingX: 150, spacingY: 120 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const G = r0.comp._layers.find((l) => l.name === 'MOE Grid 1');
  const base = cards(r0.comp).map((L) => ({ p: Array.from(at(L, 'ADBE Position', r0.comp.time)), s: at(L, 'ADBE Scale', r0.comp.time)[0], r: at(L, 'ADBE Rotate Z', r0.comp.time) }));
  r0.comp._layers.forEach((l) => { l.selected = l === G; });
  return Object.assign(r0, { G, base });
}
/** The reference for every item at time t: the effector's controls (defaults where a control is not there) and transform from the mock. */
function expected(comp, G, E, base, t) {
  const src = {
    at: (tt) => { const v = EF.defaults(); for (const [name, kind] of EF.CONTROLS) if (fx(E, name) && kind !== 'layer') v[EF.KEY[name]] = fx(E, name)._children[0].valueAtTime(tt, false); v.invert = v.invert === 1; return v; },
    toLocal: (tt) => EF.localFn({ position: Array.from(at(E, 'ADBE Position', tt)), rotation: at(E, 'ADBE Rotate Z', tt), scale: Array.from(at(E, 'ADBE Scale', tt)) })
  };
  return base.map((b, i) => EF.applyAt([src], { i, k: i, n: base.length, x: b.p[0], y: b.p[1], fd: comp.frameDuration, compAt: (tt) => { const gp = at(G, 'ADBE Position', tt); return [gp[0] + b.p[0], gp[1] + b.p[1]]; }, baseRotAt: () => 0 }, t));
}
function compare(comp, G, E, base, times, label) {
  for (const t of times) {
    const exp = expected(comp, G, E, base, t);
    cards(comp).forEach((L, i) => {
      const p = at(L, 'ADBE Position', t);
      assert.ok(near(p[0], base[i].p[0] + exp[i].dx, 0.02) && near(p[1], base[i].p[1] + exp[i].dy, 0.02), `${label} t ${t} item ${i} position: ${p[0]}, ${p[1]} vs ${base[i].p[0] + exp[i].dx}, ${base[i].p[1] + exp[i].dy}`);
      assert.ok(near(at(L, 'ADBE Scale', t)[0], base[i].s * exp[i].scaleMul, 0.02), `${label} t ${t} item ${i} scale`);
      assert.ok(near(at(L, 'ADBE Rotate Z', t), base[i].r + exp[i].rot, 0.02), `${label} t ${t} item ${i} rotation: ${at(L, 'ADBE Rotate Z', t)} vs ${base[i].r + exp[i].rot}`);
    });
  }
}

test('the wave maths: five shapes stay in −1..1, repeat every whole phase, and have their own form', () => {
  for (let sh = 1; sh <= 5; sh++) for (let j = -20; j <= 40; j++) {
    const ph = j / 8, v = EF.waveAt(sh, ph);
    assert.ok(v >= -1 - 1e-9 && v <= 1 + 1e-9, `shape ${sh} at ${ph}: ${v}`);
    assert.ok(near(v, EF.waveAt(sh, ph + 3), 1e-9), `shape ${sh} repeats`);
  }
  assert.ok(near(EF.waveAt(1, 0.25), 1, 1e-9) && near(EF.waveAt(1, 0.75), -1, 1e-9), 'sine');
  assert.ok(near(EF.waveAt(2, 0.5), 1, 1e-9) && near(EF.waveAt(2, 0), -1, 1e-9) && near(EF.waveAt(2, 0.25), 0, 1e-9), 'triangle');
  assert.ok(near(EF.waveAt(3, 0), -1, 1e-9) && near(EF.waveAt(3, 0.75), 0.5, 1e-9), 'ramp up');
  assert.ok(near(EF.waveAt(4, 0), 1, 1e-9) && near(EF.waveAt(4, 0.75), -0.5, 1e-9), 'ramp down');
  assert.equal(EF.waveAt(5, 0.2), 1); assert.equal(EF.waveAt(5, 0.7), -1);
  assert.equal(EF.TYPES[7].id, 'wave', 'appended — the menu index is stored in After Effects');
  assert.deepEqual(EF.TYPES.slice(0, 7).map((t) => t.id), ['plain', 'random', 'step', 'noise', 'delay', 'target', 'audio'], 'the older types keep their index');
});

test('Snap To rounds, Clamp limits — after each other, and off (0) changes nothing', () => {
  const R = [37, -64, 0.37, 100, 0.5];
  assert.equal(EF.modify(EF.defaults(), R), R, 'all off: the same terms');
  assert.deepEqual(EF.modify({ snapMove: 20 }, R), [40, -60, 0.37, 100, 0.5]);
  assert.deepEqual(EF.modify({ snapRotate: 45 }, R).slice(3), [90, 0.5]);
  assert.ok(near(EF.modify({ snapScale: 25 }, R)[2], 0.25, 1e-9));
  const c = EF.modify({ maxMove: 10 }, [30, -40, 0, 0, 0]);
  assert.ok(near(c[0], 6, 1e-9) && near(c[1], -8, 1e-9), 'the distance is limited, the direction kept');
  assert.deepEqual(EF.modify({ maxRotate: 30, maxScale: 20 }, [0, 0, -0.9, 100, 0.5]), [0, 0, -0.2, 30, 0.5]);
  assert.deepEqual(EF.modify({ snapRotate: 45, maxRotate: 60 }, [0, 0, 0, 100, 0]), [0, 0, 0, 60, 0], 'snap first (90), then clamp (60)');
  assert.equal(EF.modify({ snapMove: 20, maxMove: 5 }, R)[4], 0.5, 'Fade is left alone');
});

test('Wave: every shape, mock AE equals the reference at several times; the wave travels and its sliders are the only extra ones', async () => {
  for (const shape of EF.WAVES.map((w) => w.id)) {
    const { services, comp, G, base } = await gridWith(9);
    const r = await services.executor.run('grid.effector', { type: 'wave', falloff: 'all', moveY: 40, rotate: 30, scale: 20, waveShape: shape, waveLength: 4, waveSpeed: 0.5, waveOffset: 10 });
    assert.equal(r.status, 'success', `${shape}: ${JSON.stringify(r.verification || r.errors)}`);
    const E = comp._layers.find((l) => l.name === 'MOE Effector 1');
    assert.deepEqual(E._parade._children.map((f) => f.name), ['Effector Type', 'Falloff', 'Size', 'Softness', 'Strength', 'Invert', 'Move Y', 'Scale', 'Rotate', 'Wave Shape', 'Wave Length', 'Wave Speed', 'Wave Offset'], shape);
    assert.equal(fx(E, 'Wave Shape')._children[0].value, EF.WAVES.findIndex((w) => w.id === shape) + 1);
    compare(comp, G, E, base, [0, 0.33, 1, 1.7, 2.5], shape);
    const y = (t) => cards(comp).map((L) => at(L, 'ADBE Position', t)[1]);
    assert.notDeepEqual(y(0), y(0.5), `${shape}: it moves in time`);
    assert.ok(new Set(y(0).map((v) => v.toFixed(2))).size > 1, `${shape}: the items differ along the order`);
    // one wave later in time (1 / speed = 2 s) every item is where it was
    y(0).forEach((v, i) => assert.ok(near(v, y(2)[i], 0.02), `${shape}: repeats after one wave, item ${i}`));
    // Restore removes the effector and the items rest
    await services.executor.restore(r.checkpointId);
    cards(comp).forEach((L, i) => assert.ok(near(at(L, 'ADBE Position', 0)[1], base[i].p[1], 1e-6)));
  }
});

test('Snap To and Clamp in the expression: equal to the reference, on a Noise effector and with a Spring overshoot', async () => {
  const a = await gridWith(9);
  const r = await a.services.executor.run('grid.effector', { type: 'noise', falloff: 'all', rotate: 180, moveX: 90, scale: 0, snapRotate: 45, snapMove: 30, noiseScale: 150, noiseSpeed: 60 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const E = a.comp._layers.find((l) => l.name === 'MOE Effector 1');
  assert.ok(fx(E, 'Snap Rotate') && fx(E, 'Snap Move') && !fx(E, 'Snap Scale') && !fx(E, 'Max Move'), 'only the snaps that are on');
  compare(a.comp, a.G, E, a.base, [0, 0.4, 1.3, 2.2], 'snap');
  for (const t of [0, 0.4, 1.3]) cards(a.comp).forEach((L, i) => {
    const rot = at(L, 'ADBE Rotate Z', t) - a.base[i].r, dx = at(L, 'ADBE Position', t)[0] - a.base[i].p[0];
    assert.ok(near(rot / 45, Math.round(rot / 45), 1e-6), `item ${i} sits on a 45° step (${rot})`);
    assert.ok(near(dx / 30, Math.round(dx / 30), 1e-6), `item ${i} sits on a 30 px step (${dx})`);
  });
  // Clamp holds through a spring's overshoot
  const b = await gridWith(9);
  const rb = await b.services.executor.run('grid.effector', { type: 'plain', falloff: 'sphere', size: 160, softness: 60, scale: 80, spring: 100, frequency: 3, decay: 3, maxScale: 60, sweep: true });
  assert.equal(rb.status, 'success', JSON.stringify(rb.verification || rb.errors));
  const Eb = b.comp._layers.find((l) => l.name === 'MOE Effector 1');
  const T = b.comp.time, times = Array.from({ length: 16 }, (_, j) => T + j * 0.2);
  compare(b.comp, b.G, Eb, b.base, times, 'clamp');
  let top = 0;
  for (const t of times) cards(b.comp).forEach((L, i) => { top = Math.max(top, at(L, 'ADBE Scale', t)[0] / b.base[i].s); });
  assert.ok(top <= 1.6 + 1e-6 && top > 1.55, `the spring reaches the limit and never passes it (${top})`);
  // without the clamp the same spring does pass it
  const c = await gridWith(9);
  await c.services.executor.run('grid.effector', { type: 'plain', falloff: 'sphere', size: 160, softness: 60, scale: 80, spring: 100, frequency: 3, decay: 3, sweep: true });
  let free = 0;
  for (const t of times) cards(c.comp).forEach((L, i) => { free = Math.max(free, at(L, 'ADBE Scale', t)[0] / c.base[i].s); });
  assert.ok(free > 1.8, `unclamped it overshoots (${free})`);
});

test('the new tiles are real effector tiles, and More Sliders can add Wave / Snap To / Clamp to an effector that has none', async () => {
  const lay = studio.byId('layout');
  for (const id of ['efRipple', 'efPulseSteps', 'efSawFade', 'efSnapTurn']) {
    const t = lay.tiles.find((x) => x.id === id);
    assert.ok(t && t.tool === 'grid.effector' && t.tags.includes('Effectors'), id);
  }
  const a = await gridWith(6);
  await a.services.executor.run('grid.effector', { type: 'plain', falloff: 'all', moveY: 30, scale: 0 });
  const E = a.comp._layers.find((l) => l.name === 'MOE Effector 1');
  const was = cards(a.comp).map((L) => Array.from(at(L, 'ADBE Position', 0)));
  a.comp._layers.forEach((l) => { l.selected = l === E; });
  for (const g of ['wave', 'snap', 'clamp']) assert.equal((await a.services.executor.run('grid.effectorControls', { group: g })).status, 'success', g);
  assert.ok(['Wave Shape', 'Wave Length', 'Snap Rotate', 'Max Move'].every((n) => fx(E, n)));
  cards(a.comp).forEach((L, i) => assert.deepEqual(Array.from(at(L, 'ADBE Position', 0)), was[i], `adding them moves nothing (item ${i})`));
  // now switch the type to Wave in Effect Controls: the sliders are there and the expression follows them
  fx(E, 'Effector Type')._children[0].setValue(8);
  compare(a.comp, a.G, E, a.base, [0, 0.6, 1.4], 'switched to wave');
  assert.notDeepEqual(cards(a.comp).map((L) => at(L, 'ADBE Position', 0)[1].toFixed(2)), was.map((p) => p[1].toFixed(2)));
});
