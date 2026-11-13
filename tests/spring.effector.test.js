'use strict';
/**
 * v0.35 — Spring / Inertia Effector (docs/features/SPRING_EFFECTOR.md). With Spring on, every grid item follows
 * what its effector does through a damped spring (overshoot + settle, or a smooth lag at Frequency 0). The
 * items' expressions are evaluated by the mock engine at many times and compared with the pure reference
 * (features/grid/effectors.js springTerms / applyAt).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { gridItems } = require('./fixtures/layout');
const EF = require('../extension/features/grid/effectors');

const tp = (L, mn) => L.property('ADBE Transform Group').property(mn);
const at = (L, mn, t) => tp(L, mn).valueAtTime(t, false);
const cards = (comp) => comp._layers.filter((l) => /^Card/.test(l.name));
const fx = (L, name) => L._parade._children.find((f) => f.name === name);
const ctl = (L, name) => (fx(L, name) ? fx(L, name)._children[0] : { valueAtTime: () => { const d = EF.defaults()[EF.KEY[name]]; return d === false ? 0 : d; }, missing: true });
const near = (a, b, tol) => Math.abs(a - b) <= tol;

async function gridWith(n = 9) {
  const r0 = await createTestServices(gridItems(n));
  const r = await r0.services.executor.run('grid.build', { mode: 'rect', columns: 3, spacingX: 150, spacingY: 120 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const G = r0.comp._layers.find((l) => l.name === 'MOE Grid 1');
  const base = cards(r0.comp).map((L) => Array.from(at(L, 'ADBE Position', r0.comp.time)));
  r0.comp._layers.forEach((l) => { l.selected = l === G; });
  return Object.assign(r0, { G, base });
}
/** The reference for every item at time t, reading the effector's controls and transform from the mock. */
function expected(comp, G, E, base, t) {
  const has = (nm) => !!fx(E, nm);
  const src = {
    at: (tt) => { const v = EF.defaults(); for (const [name] of EF.CONTROLS) if (has(name)) v[EF.KEY[name]] = ctl(E, name).valueAtTime(tt, false); v.invert = v.invert === 1; return v; },
    toLocal: (tt) => EF.localFn({ position: Array.from(at(E, 'ADBE Position', tt)), rotation: at(E, 'ADBE Rotate Z', tt), scale: Array.from(at(E, 'ADBE Scale', tt)) })
  };
  return base.map((b, i) => EF.applyAt([src], { i, k: i, n: base.length, x: b[0], y: b[1], fd: comp.frameDuration, compAt: (tt) => { const gp = at(G, 'ADBE Position', tt); return [gp[0] + b[0], gp[1] + b[1]]; } }, t));
}

test('the spring maths: step response starts at 0 and settles at 1; Spring overshoots, Inertia never does; the window is bounded', () => {
  assert.equal(EF.stepResponse(0, 3, 5), 0);
  assert.ok(near(EF.stepResponse(3, 3, 5), 1, 1e-3) && near(EF.stepResponse(3, 0, 5), 1, 1e-3), 'settles');
  const peak = Math.max(...Array.from({ length: 300 }, (_, j) => EF.stepResponse(j / 100, 3, 5)));
  assert.ok(peak > 1.2, `Spring overshoots (${peak.toFixed(3)})`);
  let prev = 0;
  for (let j = 1; j <= 300; j++) { const v = EF.stepResponse(j / 100, 0, 6); assert.ok(v >= prev - 1e-12 && v <= 1 + 1e-12, 'Inertia rises without overshoot'); prev = v; }
  for (const d of [0, 1, 2, 5, 30]) for (const fd of [1 / 24, 1 / 30, 1 / 60, 1 / 120]) {
    const { N, D } = EF.springWindow(d, fd);
    assert.ok(N >= 1 && N <= 60 && N * D <= 3 + 1e-9, `decay ${d} fps ${1 / fd}: ${N} samples × ${D}`);
  }
  // no spring → exactly the direct result; a still effector → the spring adds nothing
  const src = { at: () => EF.valuesOf({ scale: 80, size: 200, spring: 100, frequency: 3, decay: 5 }), toLocal: () => (px, py) => [px, py] };
  const item = { i: 0, k: 0, n: 1, x: 50, y: 0, compAt: () => [50, 0], fd: 1 / 30 };
  assert.ok(near(EF.springTerms(src, item, 2)[2], EF.termsAt(src, item, 2, 2)[2], 1e-9));
});

test('Spring Grow on a sweep: every item matches the reference at every time; the items overshoot, then settle on the direct result', async () => {
  const { services, comp, G, base } = await gridWith(9);
  const r = await services.executor.run('grid.effector', { type: 'plain', falloff: 'sphere', size: 160, softness: 60, scale: 80, spring: 100, frequency: 3, decay: 5, sweep: true });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const E = comp._layers.find((l) => l.name === 'MOE Effector 1');
  assert.equal(ctl(E, 'Spring').valueAtTime(0, false), 100);
  assert.equal(ctl(E, 'Frequency').valueAtTime(0, false), 3);
  const T = comp.time;
  for (const t of [T, T + 0.4, T + 1, T + 1.6, T + 2, T + 2.3, T + 3]) {
    const exp = expected(comp, G, E, base, t);
    cards(comp).forEach((L, i) => {
      assert.ok(near(at(L, 'ADBE Scale', t)[0], 100 * exp[i].scaleMul, 0.05), `t ${t} item ${i}: ${at(L, 'ADBE Scale', t)[0]} vs ${100 * exp[i].scaleMul}`);
      const p = at(L, 'ADBE Position', t);
      assert.ok(near(p[0], base[i][0] + exp[i].dx, 0.05) && near(p[1], base[i][1] + exp[i].dy, 0.05), `t ${t} item ${i} position`);
    });
  }
  // the right-hand column item: it grows PAST the direct result at the same moment, and when the effector moves on and
  // stops (T + 2) it swings below where it comes to rest, then settles there
  const L5 = cards(comp)[5];
  const pair = (t) => { const s = at(L5, 'ADBE Scale', t)[0]; ctl(E, 'Spring').setValue(0); const d = at(L5, 'ADBE Scale', t)[0]; ctl(E, 'Spring').setValue(100); return [s, d]; };
  const times = Array.from({ length: 61 }, (_, j) => T + 1 + j * 0.05);
  const over = Math.max(...times.map((t) => { const [s, d] = pair(t); return s - d; }));
  assert.ok(over > 3, `overshoot past the direct result: ${over.toFixed(2)} %`);
  const rest = pair(T + 4)[1];
  const after = times.filter((t) => t >= T + 2.1).map((t) => pair(t)[0]);
  assert.ok(Math.min(...after) < rest - 1, `swings below the rest (${Math.min(...after).toFixed(2)} vs ${rest.toFixed(2)})`);
  assert.ok(near(pair(T + 4.5)[0], rest, 0.1), 'settled 2.5 s after the effector stopped');
  // restore removes the effector and the items go back
  await services.executor.restore(r.checkpointId);
  assert.ok(!comp._layers.some((l) => /^MOE Effector/.test(l.name)));
  cards(comp).forEach((L) => assert.ok(near(at(L, 'ADBE Scale', T + 1)[0], 100, 0.01)));
});

test('Inertia (Frequency 0): the items lag behind and ease in — never past the direct result; matches the reference', async () => {
  const { services, comp, G, base } = await gridWith(9);
  const r = await services.executor.run('grid.effector', { type: 'plain', falloff: 'sphere', size: 160, softness: 60, moveY: -60, scale: 0, spring: 100, frequency: 0, decay: 6, sweep: true });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const E = comp._layers.find((l) => l.name === 'MOE Effector 1');
  const T = comp.time, L5 = cards(comp)[5];
  for (const t of [T + 0.5, T + 1.5, T + 2.2]) {
    const exp = expected(comp, G, E, base, t);
    cards(comp).forEach((L, i) => assert.ok(near(at(L, 'ADBE Position', t)[1], base[i][1] + exp[i].dy, 0.05), `t ${t} item ${i}`));
  }
  ctl(E, 'Spring').setValue(0); const rest = at(L5, 'ADBE Position', T + 4)[1]; ctl(E, 'Spring').setValue(100);
  let lagged = false, prev = -Infinity;
  for (let j = 0; j <= 60; j++) {
    const t = T + 1 + j * 0.05, y = at(L5, 'ADBE Position', t)[1];
    ctl(E, 'Spring').setValue(0); const yd = at(L5, 'ADBE Position', t)[1]; ctl(E, 'Spring').setValue(100);
    if (Math.abs(yd - y) > 5) lagged = true;
    if (t >= T + 2.05) { assert.ok(y >= prev - 1e-6 && y <= rest + 1e-3, `t ${(t - T).toFixed(2)}: eases back to ${rest.toFixed(2)} without passing it (${y.toFixed(3)})`); prev = y; }
  }
  assert.ok(lagged, 'the item trails the direct result while the effector moves');
});

test('Effectors made before v0.35 (no Spring controls) and Spring 0 behave exactly as before', async () => {
  const { services, comp, G, base } = await gridWith(9);
  const r = await services.executor.run('grid.effector', { type: 'random', falloff: 'sphere', size: 200, moveX: 40, rotate: 30, scale: 20, sweep: true });
  assert.equal(r.status, 'success');
  const E = comp._layers.find((l) => l.name === 'MOE Effector 1');
  const T = comp.time;
  const now = cards(comp).map((L) => [at(L, 'ADBE Scale', T + 1)[0], at(L, 'ADBE Rotate Z', T + 1), at(L, 'ADBE Position', T + 1)[0]]);
  const legacy = (t) => { // v0.33 reference: values read at t, no spring
    const v = {}; for (const [name] of EF.CONTROLS) v[EF.KEY[name]] = ctl(E, name).valueAtTime(t, false); v.invert = v.invert === 1;
    const toLocal = EF.localFn({ position: Array.from(at(E, 'ADBE Position', t)), rotation: at(E, 'ADBE Rotate Z', t), scale: Array.from(at(E, 'ADBE Scale', t)) });
    const gp = at(G, 'ADBE Position', t);
    return base.map((b, i) => EF.apply([{ values: v, toLocal }], { i, k: i, n: base.length, x: b[0], y: b[1], cx: gp[0] + b[0], cy: gp[1] + b[1], time: t }));
  };
  const L0 = legacy(T + 1);
  now.forEach((v, i) => assert.ok(near(v[0], 100 * L0[i].scaleMul, 0.05) && near(v[1], L0[i].rot, 0.05), `Spring 0 = v0.33 maths, item ${i}`));
  // drop the three v0.35 controls, as on an effector made by v0.33 / v0.34 → same values, no expression error
  for (const nm of ['Spring', 'Frequency', 'Decay']) { const p = E._parade; if (fx(E, nm)) p._children.splice(p._children.indexOf(fx(E, nm)), 1); }
  cards(comp).forEach((L, i) => {
    assert.ok(near(at(L, 'ADBE Scale', T + 1)[0], now[i][0], 1e-6) && near(at(L, 'ADBE Position', T + 1)[0], now[i][2], 1e-6), `old effector, item ${i}`);
  });
});

test('Library: Spring Grow, Jelly, Inertia and Bounce Up are in Effectors (full rows) and carry real spring settings', () => {
  const S = require('../extension/app/ui/studio/sections');
  const lay = S.byId('layout');
  const ids = ['efSpring', 'efJelly', 'efInertia', 'efBounce'];
  for (const id of ids) {
    const t = lay.tiles.find((x) => x.id === id);
    assert.ok(t && t.tool === 'grid.effector' && t.args.spring > 0 && t.tags.includes('Effectors'), id);
  }
  assert.equal(lay.tiles.find((x) => x.id === 'efInertia').args.frequency, 0, 'Inertia = Frequency 0');
  const tool = require('../extension/features/grid/effectorTool').effector;
  for (const id of ids) {
    const a = lay.tiles.find((x) => x.id === id).args;
    for (const k of ['spring', 'frequency', 'decay']) assert.ok(a[k] >= tool.params[k].min && a[k] <= tool.params[k].max, `${id}.${k} in range`);
  }
  const AE = require('../extension/app/ui/layoutAE');
  const arr = AE.TABS.find((t) => t.id === 'ae-layer').groups.find((g) => g.id === 'arrange');
  const eff = arr.modes.find(([m]) => m === 'effect')[2];
  assert.equal(eff.length % 4, 0);
  ids.forEach((id) => assert.ok(eff.includes(id) && arr.ids.includes(id), id));
});
