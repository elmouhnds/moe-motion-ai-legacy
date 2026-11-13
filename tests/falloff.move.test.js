'use strict';
/**
 * v0.89 — Falloff Curve and Move Mode (docs/features/FALLOFF_MOVE_MODES.md). Mock-evaluated item expressions are
 * compared with the pure reference (features/grid/effectors.js edge / weight / termsAt).
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
  const base = cards(r0.comp).map((L) => ({ p: Array.from(at(L, 'ADBE Position', r0.comp.time)), s: at(L, 'ADBE Scale', r0.comp.time)[0] }));
  r0.comp._layers.forEach((l) => { l.selected = l === G; });
  return Object.assign(r0, { G, base });
}
function expected(comp, G, E, base, t) {
  const src = {
    at: (tt) => { const v = EF.defaults(); for (const [name, kind] of EF.CONTROLS) if (fx(E, name) && kind !== 'layer') v[EF.KEY[name]] = fx(E, name)._children[0].valueAtTime(tt, false); v.invert = v.invert === 1; return v; },
    toLocal: (tt) => EF.localFn({ position: Array.from(at(E, 'ADBE Position', tt)), rotation: at(E, 'ADBE Rotate Z', tt), scale: Array.from(at(E, 'ADBE Scale', tt)) }),
    originAt: (tt) => Array.from(at(E, 'ADBE Position', tt)).slice(0, 2)
  };
  return base.map((b, i) => EF.applyAt([src], { i, k: i, n: base.length, x: b.p[0], y: b.p[1], fd: comp.frameDuration, compAt: (tt) => { const gp = at(G, 'ADBE Position', tt); return [gp[0] + b.p[0], gp[1] + b.p[1]]; }, baseRotAt: () => 0 }, t));
}
function compare(comp, G, E, base, times, label) {
  for (const t of times) {
    const exp = expected(comp, G, E, base, t);
    cards(comp).forEach((L, i) => {
      const p = at(L, 'ADBE Position', t);
      assert.ok(near(p[0], base[i].p[0] + exp[i].dx, 0.02) && near(p[1], base[i].p[1] + exp[i].dy, 0.02), `${label} t ${t} item ${i} position: ${p[0]}, ${p[1]} vs ${base[i].p[0] + exp[i].dx}, ${base[i].p[1] + exp[i].dy}`);
      assert.ok(near(at(L, 'ADBE Scale', t)[0], base[i].s * exp[i].scaleMul, 0.02), `${label} t ${t} item ${i} scale: ${at(L, 'ADBE Scale', t)[0]} vs ${base[i].s * exp[i].scaleMul}`);
    });
  }
}

test('the edge curves: all run 0 → 1, Smooth is the old smoothstep, Ease in stays low and Ease out rises early', () => {
  for (let cv = 1; cv <= 4; cv++) { assert.equal(EF.edge(cv, 0), 0); assert.equal(EF.edge(cv, 1), 1); let prev = 0; for (let j = 1; j <= 20; j++) { const v = EF.edge(cv, j / 20); assert.ok(v >= prev - 1e-12, `curve ${cv} never goes back`); prev = v; } }
  assert.ok(near(EF.edge(1, 0.25), 0.25 * 0.25 * (3 - 0.5), 1e-12), 'Smooth = u²(3 − 2u)');
  assert.equal(EF.edge(undefined, 0.3), EF.edge(1, 0.3), 'an effector without the control is Smooth');
  assert.equal(EF.edge(2, 0.3), 0.3);
  assert.ok(EF.edge(3, 0.5) < 0.5 && EF.edge(4, 0.5) > 0.5);
  // weight() uses it on Sphere, Box and Linear — and a full or empty weight is the same for every curve
  const e = (cv, fo) => Object.assign(EF.defaults(), { falloff: fo, size: 100, softness: 100, falloffCurve: cv });
  for (const fo of [1, 3]) { assert.equal(EF.weight(e(3, fo), 0, 0), 1); assert.equal(EF.weight(e(3, fo), 100, 0), 0); assert.ok(EF.weight(e(3, fo), 50, 0) < EF.weight(e(1, fo), 50, 0) && EF.weight(e(4, fo), 50, 0) > EF.weight(e(1, fo), 50, 0), `falloff ${fo}`); }
  assert.ok(EF.weight(e(3, 2), 0, 0) < EF.weight(e(2, 2), 0, 0));
  assert.deepEqual(EF.CURVES.map((c) => c.id), ['smooth', 'linear', 'easeIn', 'easeOut']);
});

test('Falloff Curve in the expression: each curve equals the reference on a sweep; Smooth adds no control', async () => {
  for (const curve of ['smooth', 'linear', 'easeIn', 'easeOut']) {
    const { services, comp, G, base } = await gridWith(9);
    const r = await services.executor.run('grid.effector', { type: 'plain', falloff: 'sphere', size: 260, softness: 90, scale: 80, falloffCurve: curve, sweep: true });
    assert.equal(r.status, 'success', `${curve}: ${JSON.stringify(r.verification || r.errors)}`);
    const E = comp._layers.find((l) => l.name === 'MOE Effector 1');
    assert.equal(!!fx(E, 'Falloff Curve'), curve !== 'smooth', curve);
    if (curve !== 'smooth') assert.equal(fx(E, 'Falloff Curve')._children[0].value, EF.CURVES.findIndex((c) => c.id === curve) + 1);
    const T = comp.time;
    compare(comp, G, E, base, [T, T + 0.5, T + 1, T + 1.5, T + 2], curve);
  }
});

test('Attract / Repel: items move along the line to the effector, never past it; negative pushes away; equals the reference', async () => {
  const a = await gridWith(9);
  const r = await a.services.executor.run('grid.effector', { type: 'plain', falloff: 'all', moveMode: 'attract', moveX: 60, scale: 0 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const E = a.comp._layers.find((l) => l.name === 'MOE Effector 1');
  assert.ok(fx(E, 'Move Mode') && fx(E, 'Move X') && !fx(E, 'Move Y'));
  assert.equal(fx(E, 'Move Mode')._children[0].value, 2);
  compare(a.comp, a.G, E, a.base, [0, 1], 'attract');
  const gp = at(a.G, 'ADBE Position', 0), ep = at(E, 'ADBE Position', 0);
  const dist = (L, t) => { const p = at(L, 'ADBE Position', t); return Math.hypot(gp[0] + p[0] - ep[0], gp[1] + p[1] - ep[1]); };
  cards(a.comp).forEach((L, i) => {
    const d0 = Math.hypot(gp[0] + a.base[i].p[0] - ep[0], gp[1] + a.base[i].p[1] - ep[1]);
    assert.ok(near(dist(L, 0), Math.max(0, d0 - 60), 0.02), `item ${i}: ${d0.toFixed(1)} → ${dist(L, 0).toFixed(1)} (60 px closer, never past)`);
  });
  // a pull bigger than the distance stops AT the effector
  fx(E, 'Move X')._children[0].setValue(5000);
  cards(a.comp).forEach((L, i) => assert.ok(dist(L, 0) < 0.02, `item ${i} sits on the effector`));
  // negative = repel
  fx(E, 'Move X')._children[0].setValue(-40);
  compare(a.comp, a.G, E, a.base, [0], 'repel');
  cards(a.comp).forEach((L, i) => {
    const d0 = Math.hypot(gp[0] + a.base[i].p[0] - ep[0], gp[1] + a.base[i].p[1] - ep[1]);
    if (d0 > 0.01) assert.ok(near(dist(L, 0), d0 + 40, 0.02), `item ${i} is 40 px further`);
  });
  await a.services.executor.restore(r.checkpointId);
  cards(a.comp).forEach((L, i) => assert.ok(near(at(L, 'ADBE Position', 0)[0], a.base[i].p[0], 1e-6) && near(at(L, 'ADBE Position', 0)[1], a.base[i].p[1], 1e-6), 'Restore puts them back'));
  // refused before anything is written when there is no pull
  const b = await gridWith(4);
  const rb = await b.services.executor.run('grid.effector', { type: 'plain', falloff: 'all', moveMode: 'attract', scale: 20 });
  assert.notEqual(rb.status, 'success');
  assert.ok(!b.comp._layers.some((l) => /^MOE Effector/.test(l.name)));
});

test('Absolute: where the weight is 1 the items sit on the effector (+ Move X / Y); the soft edge blends; follows a sweep and Random', async () => {
  const a = await gridWith(9);
  const r = await a.services.executor.run('grid.effector', { type: 'plain', falloff: 'all', moveMode: 'absolute', moveX: 30, moveY: -20, scale: 0 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const E = a.comp._layers.find((l) => l.name === 'MOE Effector 1');
  const gp = at(a.G, 'ADBE Position', 0), ep = at(E, 'ADBE Position', 0);
  cards(a.comp).forEach((L, i) => { const p = at(L, 'ADBE Position', 0); assert.ok(near(gp[0] + p[0], ep[0] + 30, 0.02) && near(gp[1] + p[1], ep[1] - 20, 0.02), `item ${i} at the null + offset`); });
  fx(E, 'Strength')._children[0].setValue(50);
  cards(a.comp).forEach((L, i) => { const p = at(L, 'ADBE Position', 0); assert.ok(near(p[0], a.base[i].p[0] + (ep[0] + 30 - gp[0] - a.base[i].p[0]) / 2, 0.02), `item ${i} half way`); });
  const b = await gridWith(9);
  const rb = await b.services.executor.run('grid.effector', { type: 'random', falloff: 'sphere', size: 300, softness: 80, moveMode: 'absolute', scale: 20, falloffCurve: 'easeOut', seed: 4, sweep: true });
  assert.equal(rb.status, 'success', JSON.stringify(rb.verification || rb.errors));
  const Eb = b.comp._layers.find((l) => l.name === 'MOE Effector 1'), T = b.comp.time;
  compare(b.comp, b.G, Eb, b.base, [T, T + 0.6, T + 1, T + 1.4, T + 2], 'absolute random sweep');
});

test('the new tiles exist; More Sliders adds Move Mode and Falloff curve (menus with their items) without moving anything', async () => {
  const lay = studio.byId('layout');
  for (const id of ['efMagnet', 'efRepel', 'efGather']) { const t = lay.tiles.find((x) => x.id === id); assert.ok(t && t.tool === 'grid.effector' && t.tags.includes('Effectors'), id); }
  const a = await gridWith(6);
  await a.services.executor.run('grid.effector', { type: 'plain', falloff: 'sphere', size: 300, softness: 80, moveY: 30, scale: 0 });
  const E = a.comp._layers.find((l) => l.name === 'MOE Effector 1');
  const was = cards(a.comp).map((L) => Array.from(at(L, 'ADBE Position', 0)));
  a.comp._layers.forEach((l) => { l.selected = l === E; });
  for (const g of ['moves', 'ease']) assert.equal((await a.services.executor.run('grid.effectorControls', { group: g })).status, 'success', g);
  assert.equal(fx(E, 'Move Mode')._children[0].value, 1); assert.equal(fx(E, 'Falloff Curve')._children[0].value, 1);
  cards(a.comp).forEach((L, i) => assert.deepEqual(Array.from(at(L, 'ADBE Position', 0)), was[i], `item ${i} did not move`));
  fx(E, 'Falloff Curve')._children[0].setValue(3);
  compare(a.comp, a.G, E, a.base, [0], 'curve changed in Effect Controls');
});
