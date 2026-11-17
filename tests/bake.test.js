'use strict';
/**
 * v0.42 — Bake to Keyframes (docs/features/BAKE.md): a MOE rig's live expressions become keyframes. Every baked
 * property, evaluated by the mock at every frame of the range, must equal what the live expression gave before
 * (within plan.TOL); Restore must bring back the exact expressions and the keys that were under them.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { gridItems, TA } = require('./fixtures/layout');
const { studioComp } = require('./fixtures/studio');
const P = require('../extension/features/bake/plan');

const MN = ['ADBE Position', 'ADBE Scale', 'ADBE Rotate Z', 'ADBE Opacity'];
const tp = (L, mn) => L.property('ADBE Transform Group').property(mn);
const at = (L, mn, t) => tp(L, mn).valueAtTime(t, false);
const cards = (comp) => comp._layers.filter((l) => /^Card/.test(l.name));
const fill = (L) => { const f = L._parade && L._parade._children.find((x) => x.name === 'MOE Clone Colour'); return f ? f._children.find((c) => /Color/.test(c.matchName) || c.name === 'Color') : null; };
const frames = (comp, t0, t1) => Array.from({ length: Math.round((t1 - t0) / comp.frameDuration) }, (_, f) => t0 + f * comp.frameDuration);
const D = (a, b) => P.diff(Array.isArray(a) ? Array.from(a) : a, Array.isArray(b) ? Array.from(b) : b);

test('plan: frame times, smart keys on a line / a curve / a constant / a hold, and chunks', () => {
  const fd = 1 / 25;
  const ts = P.timesFor({ start: 0.4, duration: 1, fd });
  assert.equal(ts.length, 25);
  assert.ok(Math.abs(ts[0] - 0.4) < 1e-12 && Math.abs(ts[24] - 1.36) < 1e-9);
  const t3 = P.timesFor({ start: 0, duration: 1, fd, every: 4 });
  assert.deepEqual(t3.map((t) => Math.round(t / fd)), [0, 4, 8, 12, 16, 20, 24], 'every 4 frames, the last frame always in');
  // a straight move: two keys
  const line = ts.map((t) => [100 + 300 * t, 50]);
  assert.equal(P.thin(ts, line, { tol: 0.005 }).times.length, 2);
  // still, then a curve: the still part needs no keys, the curve one per frame; every sample within the tolerance
  const sine = ts.map((t) => (t < 0.9 ? 0 : 100 * Math.sin((t - 0.9) * 5)));
  const pl = P.thin(ts, sine, { tol: 0.005 });
  assert.equal(pl.times.length, 2 + 12, `${pl.times.length} keys: the start and end of the still part, then every frame of the curve`);
  assert.ok(P.planError(ts, sine, pl, false) <= 0.005);
  // nothing changes: a plain value
  assert.deepEqual(P.thin(ts, ts.map(() => [1, 0, 0, 1]), { tol: 0.0005 }), { constant: true, value: [1, 0, 0, 1] });
  // a checkbox: keys only where it changes, held
  const hold = ts.map((t) => (t < 0.8 ? 0 : 1));
  const ph = P.thin(ts, hold, { hold: true });
  assert.equal(ph.times.length, 2);
  assert.equal(P.planError(ts, hold, ph, true), 0);
  // one per sample
  assert.equal(P.thin(ts, sine, { mode: 'every' }).times.length, 25);
  assert.deepEqual(P.chunks([1, 2, 3, 4, 5], 2).map((c) => c.length), [2, 2, 1]);
  assert.equal(P.everyFor(400, 750), 3, '400 properties × 750 frames → every 3 frames');
});

async function sweptGrid() {
  const r0 = await createTestServices(gridItems(6));
  const { services, comp } = r0;
  comp.workAreaStart = 0; comp.workAreaDuration = 2.4;
  const b = await services.executor.run('grid.build', { mode: 'rect', columns: 3, spacingX: 150, spacingY: 120 });
  assert.equal(b.status, 'success', JSON.stringify(b.verification || b.errors));
  const G = comp._layers.find((l) => l.name === 'MOE Grid 1');
  comp._layers.forEach((l) => { l.selected = l === G; });
  const e = await services.executor.run('grid.effector', { type: 'plain', falloff: 'sphere', size: 160, softness: 60, scale: 60, rotate: 90, fade: 50, colourMix: 100, sweep: true });
  assert.equal(e.status, 'success', JSON.stringify(e.verification || e.errors));
  comp._layers.forEach((l) => { l.selected = l === G; });
  const c = await services.executor.run('grid.colour', { mode: 'cycle', palette: 'tomato' });
  assert.equal(c.status, 'success', JSON.stringify(c.verification || c.errors));
  comp._layers.forEach((l) => { l.selected = l === G; });
  return Object.assign(r0, { G });
}

test('a swept grid with clone colours: select the grid null → every item property becomes keys equal to the live rig at every frame; Restore brings the rig back', async () => {
  const { services, comp } = await sweptGrid();
  const items = cards(comp);
  const ts = frames(comp, 0, 2.4);
  const live = items.map((L) => ({ tr: MN.map((mn) => ts.map((t) => at(L, mn, t))), col: fill(L) && ts.map((t) => fill(L).valueAtTime(t, false)) }));
  const exprs = items.map((L) => MN.map((mn) => tp(L, mn).expression));
  assert.ok(exprs.every((e) => e.every((x) => x.startsWith('// MOE'))) && items.every((L) => fill(L) && fill(L).expression.startsWith('// MOE')), 'live rig: tagged expressions on every item');
  const moving = live.some((l) => D(l.tr[1][0], l.tr[1][ts.length - 1]) > 1);
  assert.ok(moving, 'the sweep changes the items over time');

  const r = await services.executor.run('rig.bake', { range: 'work', every: 1, keys: 'smart', which: 'moe' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.equal(r.result.layers, 6);
  assert.equal(r.result.written.length, 6 * 5, '4 transform properties + the colour on each item');
  items.forEach((L, i) => {
    MN.forEach((mn, m) => {
      const p = tp(L, mn);
      assert.equal(p.expression, '', `${L.name} ${mn}: expression gone`);
      ts.forEach((t, f) => assert.ok(D(p.valueAtTime(t, false), live[i].tr[m][f]) <= P.TOL.base + 1e-9, `${L.name} ${mn} at ${t.toFixed(2)}: ${p.valueAtTime(t, false)} vs ${live[i].tr[m][f]}`));
    });
    const C = fill(L);
    assert.equal(C.expression, '');
    ts.forEach((t, f) => assert.ok(D(C.valueAtTime(t, false), live[i].col[f]) <= P.TOL.COLOR + 1e-9, `${L.name} colour at ${t.toFixed(2)}`));
  });
  // smart: fewer keys than frames, and a value that never moved is a plain value
  const total = items.reduce((n, L) => n + MN.reduce((k, mn) => k + tp(L, mn).numKeys, 0), 0);
  assert.ok(total < 6 * 4 * ts.length / 2, `${total} keys for ${6 * 4 * ts.length} samples`);
  assert.equal(r.result.keysTotal, total + items.reduce((n, L) => n + fill(L).numKeys, 0));
  assert.match(r.verification.checks.find((c) => c.label === 'Read-back').detail, /12 frames re-read/);

  await services.executor.restore(r.checkpointId);
  items.forEach((L, i) => {
    MN.forEach((mn, m) => {
      assert.equal(tp(L, mn).expression, exprs[i][m], `${L.name} ${mn}: the same expression is back`);
      assert.equal(tp(L, mn).numKeys, 0);
    });
    assert.ok(fill(L).expression.startsWith('// MOE'));
    assert.ok(D(at(L, 'ADBE Position', 1.3), live[i].tr[0][Math.round(1.3 / comp.frameDuration)]) < 1e-6, 'live again');
  });
});

test('one key per sample, every 2 frames over the whole comp', async () => {
  const { services, comp } = await sweptGrid();
  comp.duration = 3;
  const r = await services.executor.run('rig.bake', { range: 'comp', every: 2, keys: 'every', which: 'moe' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const L = cards(comp)[0];
  const want = P.timesFor({ start: 0, duration: 3, fd: comp.frameDuration, every: 2 }).length;
  assert.equal(want, 38);
  assert.equal(tp(L, 'ADBE Scale').numKeys, want);
  assert.equal(r.result.times.count, want);
});

/** A keyframed Ball with a trail; the copies are duplicates, so their Position has the Ball's keys under the expression. */
function ballComp() {
  const ball = TA({ pos: [200, 500] });
  ball[1] = Object.assign({}, ball[1], { keys: [{ time: 0, value: [200, 500] }, { time: 2, value: [1400, 300] }] });
  ball[3] = Object.assign({}, ball[3], { keys: [{ time: 0, value: 0 }, { time: 2, value: 180 }] });
  return studioComp([{ name: 'Ball', selected: true, transform: ball, rect: { left: -40, top: -40, width: 80, height: 80 } }], { comp: { duration: 3 } });
}

test('a trail: select MOE Trail 1 → its copies are baked, the Ball keeps its own keys; Restore puts the keys under the copies back', async () => {
  const { services, comp } = await createTestServices(ballComp());
  comp.time = 0; comp.workAreaStart = 0; comp.workAreaDuration = 2.6;
  const t = await services.executor.run('grid.trail', { copies: 3, delay: 4, fade: 25, scaleStep: 10, rotateStep: 20 });
  assert.equal(t.status, 'success', JSON.stringify(t.verification || t.errors));
  const ball = comp._layers.find((l) => l.name === 'Ball'), N = comp._layers.find((l) => l.name === 'MOE Trail 1');
  const copies = t.result.copies.map((id) => comp._layers.find((l) => l.id === id));
  const keysUnder = copies.map((L) => tp(L, 'ADBE Position').numKeys);
  assert.ok(keysUnder.every((k) => k === 2), 'the copies carry the Ball keys under their expressions');
  const ts = frames(comp, 0, 2.6);
  const live = copies.map((L) => MN.map((mn) => ts.map((tt) => at(L, mn, tt))));
  comp._layers.forEach((l) => { l.selected = l === N; });
  const r = await services.executor.run('rig.bake', { range: 'work', every: 1, keys: 'smart', which: 'moe' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.equal(r.result.written.length, 3 * 4);
  assert.match(r.verification.checks.find((c) => c.label === 'Saved').detail, /had keyframes under the expression/);
  copies.forEach((L, i) => MN.forEach((mn, m) => {
    assert.equal(tp(L, mn).expression, '');
    ts.forEach((tt, f) => assert.ok(D(at(L, mn, tt), live[i][m][f]) <= P.TOL.base + 1e-9, `copy ${i + 1} ${mn} at ${tt.toFixed(2)}`));
  }));
  assert.equal(tp(ball, 'ADBE Position').numKeys, 2, 'the Ball is untouched');
  assert.equal(tp(ball, 'ADBE Position').expression, '');
  await services.executor.restore(r.checkpointId);
  copies.forEach((L, i) => {
    assert.ok(tp(L, 'ADBE Position').expression.startsWith('// MOE Trail · MOE Trail 1'));
    assert.equal(tp(L, 'ADBE Position').numKeys, keysUnder[i], 'the keys under the expression are back');
    assert.ok(D(at(L, 'ADBE Position', 1.2), live[i][0][30]) < 1e-6, 'the trail is live again');
  });
});

test('"MOE rigs" leaves your own expression; "Every expression" bakes it too', async () => {
  const fx = () => studioComp([{ name: 'Logo', selected: true, transform: TA({ pos: [400, 300] }) }], { comp: { duration: 2 } });
  const mine = '[value[0] + time * 100, value[1]]';
  for (const which of ['moe', 'all']) {
    const { services, comp } = await createTestServices(fx());
    const L = comp._layers.find((l) => l.name === 'Logo');
    tp(L, 'ADBE Position').expression = mine;
    tp(L, 'ADBE Rotate Z').expression = '// MOE Expr\ntime * 90';
    const r = await services.executor.run('rig.bake', { range: 'comp', every: 1, keys: 'smart', which });
    assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
    assert.equal(tp(L, 'ADBE Rotate Z').expression, '');
    assert.equal(tp(L, 'ADBE Rotate Z').numKeys, 2, 'a steady turn is two keys');
    assert.ok(Math.abs(at(L, 'ADBE Rotate Z', 1) - 90) < 1e-6);
    if (which === 'moe') assert.equal(tp(L, 'ADBE Position').expression, mine, 'your own expression stays');
    else { assert.equal(tp(L, 'ADBE Position').expression, ''); assert.ok(D(at(L, 'ADBE Position', 1.5), [550, 300]) < 1e-6); }
  }
});

test('refused before anything changes: nothing to bake, too many values, an expression error', async () => {
  const one = await createTestServices(studioComp([{ name: 'Plain', selected: true, transform: TA({}) }]));
  const r1 = await one.services.executor.run('rig.bake', {});
  assert.notEqual(r1.status, 'success');
  assert.match(JSON.stringify(r1.errors), /No MOE expressions on the selection/);

  const { services, comp } = await sweptGrid();
  comp.workAreaDuration = 10;
  const before = cards(comp).map((L) => tp(L, 'ADBE Position').expression);
  const P0 = P.LIMITS.samples;
  P.LIMITS.samples = 1000;
  try {
    const r2 = await services.executor.run('rig.bake', { every: 1 });
    assert.notEqual(r2.status, 'success');
    assert.match(JSON.stringify(r2.errors), /values to read .* Set \\"Sample every\\" to \d+ frames/);
  } finally { P.LIMITS.samples = P0; }
  assert.deepEqual(cards(comp).map((L) => tp(L, 'ADBE Position').expression), before, 'nothing changed');

  const bad = await createTestServices(studioComp([{ name: 'Broken', selected: true, transform: TA({}) }], { comp: { duration: 1 } }));
  const B = bad.comp._layers[0];
  tp(B, 'ADBE Opacity').expression = '// MOE Expr\nthisComp.layer("Nope").transform.opacity';
  const r3 = await bad.services.executor.run('rig.bake', {});
  assert.notEqual(r3.status, 'success');
  assert.match(JSON.stringify(r3.errors), /expression has an error/);
  assert.ok(tp(B, 'ADBE Opacity').expression.includes('Nope'), 'left as it was');
});

test('UI: Bake is one click in the Motion Kit (Clean up, Alt = one key per frame) and in the Keys tab; Arabic words find it', () => {
  const BAR = require('../extension/features/quick/bar');
  const a = BAR.ACTIONS.find((x) => x.id === 'k_bake');
  assert.ok(a && a.tool === 'rig.bake' && a.icon === 'bake');
  assert.deepEqual(BAR.KIT_GROUPS.find(([g]) => g === 'Clean up')[1], ['k_bake', 'k_trash']);
  assert.deepEqual(BAR.KIT_ALT.k_bake, { keys: 'every' });
  const AE = require('../extension/app/ui/layoutAE');
  const keys = AE.TABS.find((t) => t.id === 'ae-keys').groups.find((g) => g.id === 'assist');
  assert.ok(keys.refs.includes('quick:k_bake') && keys.minor.includes('quick:k_bake'));
  const W = require('../extension/app/ui/workflow');
  assert.deepEqual(W.keywordsOf('اعمل بيك للجريد').sort(), ['bake', 'grid']);
  assert.deepEqual(W.keywordsOf('حول الاكسبريشن لكي فريمز'), ['bake']);
  assert.deepEqual(W.keywordsOf('الولد بيكلم الكاميرا'), [], 'whole words only');
});

/**
 * v0.99.7 — Restore has to put back the number UNDER the expression, not the one the expression produced.
 *
 * Measured in After Effects 26.5.3 on a swept grid: the value under item 1's Position was [620, 300] and the
 * expression gave [-150, -120]. The bake saved `Property.value`, which in After Effects is the EVALUATED value, so
 * Restore wrote [-150, -120] underneath and the restored expression applied its own offset a second time — the
 * item came back at [-920, -540]. The Self-Test's `bake` check reported it only as "restore differs by 770".
 *
 * This test switches the mock to After Effects' real `.value` (env.mode.strictValue) so the same thing happens
 * here. With the old `saveState` it goes red.
 */
test('v0.99.7: Restore puts back the value underneath the expression, not the expression’s own result', async () => {
  const r0 = await createTestServices(studioComp([
    { name: 'Card 1', transform: TA({ pos: [620, 300] }), rect: { left: -75, top: -50, width: 150, height: 100 } }
  ], { comp: { time: 0 } }));
  r0.env.mode.strictValue = true;                 // After Effects' own Property.value
  try {
    const L = r0.comp._layers.find((l) => l.name === 'Card 1');
    const pos = tp(L, 'ADBE Position');

    // a MOE rig whose expression builds on the number underneath it, the way a grid item's does
    pos.setValue([620, 300]);
    pos.expression = '// MOE Grid\n[value[0] - 770, value[1] - 420]';
    const under = pos.valueAtTime(0, true);
    assert.deepEqual(Array.from(under).slice(0, 2), [620, 300], 'the number underneath');
    assert.deepEqual(Array.from(pos.value).slice(0, 2), [-150, -120], 'and what the expression makes of it');

    L.selected = true;
    const r = await r0.services.executor.run('rig.bake', { range: 'work', every: 5, keys: 'smart', which: 'moe' }, { approved: true });
    assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));

    await r0.services.executor.restore(r.checkpointId);

    assert.deepEqual(Array.from(pos.valueAtTime(0, true)).slice(0, 2), [620, 300],
      'the value underneath came back — not the baked result');
    assert.deepEqual(Array.from(pos.value).slice(0, 2), [-150, -120],
      'so the rig lands where it did before the bake');
    assert.match(pos.expression, /MOE Grid/, 'and the expression came back too');
  } finally {
    r0.env.mode.strictValue = false;
  }
});
