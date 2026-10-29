'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { gridItems, TA } = require('./fixtures/layout');
const { studioComp } = require('./fixtures/studio');
const Lg = require('../extension/features/grid/layouts');
const X = require('../extension/features/grid/expressions');
const { layoutGuides } = require('../extension/features/grid/tools');

const near = (a, b, t = 0.01) => Math.abs(a - b) <= t;
const A = (v) => Array.from(v);
const tp = (L, mn) => L.property('ADBE Transform Group').property(mn);
const cards = (comp) => comp._layers.filter((l) => /^Card/.test(l.name));

test('Layouts: rectangular, snake, columns order, honeycomb offset (pure)', () => {
  const p = Object.assign(X.defaultParams('rect'), { columns: 3, spacingX: 100, spacingY: 50 });
  const pts = Lg.place(p, 6).map((o) => [o.x, o.y]);
  assert.deepEqual(pts, [[-100, -25], [0, -25], [100, -25], [-100, 25], [0, 25], [100, 25]]);
  const snake = Lg.place(Object.assign({}, p, { order: 3 }), 6).map((o) => o.x);
  assert.deepEqual(snake, [-100, 0, 100, 100, 0, -100]);
  const colsFirst = Lg.place(Object.assign({}, p, { order: 2 }), 6).map((o) => [o.x, o.y]);
  assert.deepEqual(colsFirst.slice(0, 2), [[-100, -25], [-100, 25]]);
  const honey = Lg.place(Object.assign({}, p, { rowOffset: 50 }), 6);
  assert.equal(honey[3].x, -50);
  const perm = Lg.permutation(10, 7);
  assert.deepEqual([...perm].sort((a, b) => a - b), [...Array(10).keys()], 'random order is a permutation');
  assert.deepEqual(Lg.permutation(10, 7), perm, 'seeded = repeatable');
});

test('Layouts: radial ring / sphere radius / phyllotaxis are geometric', () => {
  const r = Object.assign(X.defaultParams('radial'), { radius: 200 });
  for (const o of Lg.place(r, 8)) assert.ok(near(Math.hypot(o.x, o.y), 200));
  assert.ok(near(Lg.place(r, 8)[0].y, -200), 'starts at 12 o’clock');
  const s = Object.assign(X.defaultParams('sphere'), { radius: 300, sphereSpin: 30, sphereTilt: 10 });
  for (const o of Lg.place(s, 20)) assert.ok(near(Math.hypot(o.x, o.y, o.z), 300, 1e-6));
  const ph = Lg.place(Object.assign(X.defaultParams('phyllo'), { spread: 10 }), 50);
  assert.ok(ph[49].x ** 2 + ph[49].y ** 2 > ph[1].x ** 2 + ph[1].y ** 2);
});

test('Layout guides: columns, gutters, margins and cells', () => {
  const g = layoutGuides({ columns: 2, rows: 1, gutterX: 20, gutterY: 0, marginX: 100, marginY: 50 }, 1000, 500);
  assert.deepEqual(g.v, [100, 490, 510, 900]);
  assert.deepEqual(g.h, [50, 450]);
  assert.equal(g.cells.length, 2);
  assert.ok(near(g.cw, 390));
  assert.ok(layoutGuides({ columns: 40, rows: 1, gutterX: 100, gutterY: 0, marginX: 0, marginY: 0 }, 1000, 500).error);
});

test('Grid build (rect): null + controls + live expressions; mock-evaluated positions equal the JS preview; restore is exact', async () => {
  const { services, comp } = await createTestServices(gridItems(6));
  const before = cards(comp).map((L) => A(tp(L, 'ADBE Position').value));
  const r = await services.executor.run('grid.build', { mode: 'rect', columns: 3, spacingX: 150, spacingY: 120 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors, null, 1));
  const g = comp._layers.find((l) => l.name === 'MOE Grid 1');
  assert.ok(g && g.nullLayer);
  assert.equal(g._parade._children.find((f) => f.name === 'Order')._children[0]._menuItems.length, 4, 'dropdown items set');
  const vals = cards(comp).map((L) => tp(L, 'ADBE Position').valueAtTime(comp.time, false));
  assert.deepEqual(vals.map((v) => v.map((x) => Math.round(x))), [[-150, -60], [0, -60], [150, -60], [-150, 60], [0, 60], [150, 60]]);
  assert.ok(cards(comp).every((L) => L.parent === g));
  assert.ok(r.verification.checks.some((c) => /match the preview/.test(c.detail)));
  // Live update: spacing via grid.update
  const u = await services.executor.run('grid.update', { gridId: g.id, values: JSON.stringify({ 'Spacing X': 200, Twist: 10 }) });
  assert.equal(u.status, 'success', JSON.stringify(u.verification || u.errors));
  assert.ok(near(tp(cards(comp)[0], 'ADBE Position').valueAtTime(comp.time, false)[0], -200));
  assert.ok(near(tp(cards(comp)[2], 'ADBE Rotate Z').valueAtTime(comp.time, false), 20));
  // Restore the build: everything back
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.equal(comp._layers.some((l) => l.name === 'MOE Grid 1'), false);
  cards(comp).forEach((L, i) => {
    assert.equal(L.parent, null);
    assert.equal(tp(L, 'ADBE Position').expression, '');
    assert.deepEqual(A(tp(L, 'ADBE Position').value), before[i]);
  });
});

test('Grid build: radial with face-center, random order, animate-in keys on Build (Rise style)', async () => {
  const { services, comp } = await createTestServices(gridItems(8, { comp: { time: 2 } }));
  const r = await services.executor.run('grid.build', { mode: 'radial', radius: 300, faceCenter: true, order: '4', animateIn: true, buildStyle: '3', buildDuration: 1 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors, null, 1));
  const g = comp._layers.find((l) => l.name === 'MOE Grid 1');
  const build = g._parade._children.find((f) => f.name === 'Build')._children[0];
  assert.equal(build.numKeys, 2);
  assert.ok(near(build.keyTime(1), 2) && near(build.keyTime(2), 3));
  const at = (t) => cards(comp).map((L) => tp(L, 'ADBE Position').valueAtTime(t, false));
  for (const v of at(3)) assert.ok(near(Math.hypot(v[0], v[1]), 300, 0.01), 'on the ring when built');
  const startOp = cards(comp).map((L) => tp(L, 'ADBE Opacity').valueAtTime(2, false));
  assert.ok(startOp.every((o) => o < 1), 'hidden at build start (Rise fades in)');
  const rot = cards(comp).map((L) => tp(L, 'ADBE Rotate Z').valueAtTime(3, false));
  assert.ok(rot.some((v) => Math.abs(v) > 1), 'face center rotates items');
});

test('Grid build: sphere makes items 3D and restores them to 2D', async () => {
  const { services, comp } = await createTestServices(gridItems(10));
  const r = await services.executor.run('grid.build', { mode: 'sphere', radius: 250 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors, null, 1));
  assert.ok(cards(comp).every((L) => L.threeDLayer));
  for (const L of cards(comp)) { const v = tp(L, 'ADBE Position').valueAtTime(comp.time, false); assert.equal(v.length, 3); assert.ok(near(Math.hypot(...v), 250, 0.01)); }
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.ok(cards(comp).every((L) => !L.threeDLayer && tp(L, 'ADBE Position').value.length === 2));
});

test('Grid build: path mode follows a shape path (points evaluated on the path)', async () => {
  const layers = gridItems(5).comp.layers;
  layers.push({ name: 'Curve', shapes: [{ name: 'Shape 1', path: [[100, 500], [1800, 500]], stroke: [1, 1, 1] }], transform: TA({ pos: [0, 0] }) });
  const fx = studioComp(layers);
  const { services, comp } = await createTestServices(fx);
  const curveIndex = comp._layers.findIndex((l) => l.name === 'Curve') + 1;
  const r = await services.executor.run('grid.build', { mode: 'path', pathLayer: curveIndex, centerAnchors: false });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors, null, 1));
  const xs = cards(comp).map((L) => tp(L, 'ADBE Position').valueAtTime(comp.time, false));
  // Grid null sits at comp origin (0,0), so local = comp coordinates on the path.
  assert.deepEqual(xs.map((v) => Math.round(v[0])), [100, 525, 950, 1375, 1800]);
  assert.ok(xs.every((v) => near(v[1], 500)));
});

test('Grid build: refuses to overwrite your expressions unless "Replace existing", and leaves no null behind', async () => {
  const fx = gridItems(3);
  fx.comp.layers[0].transform[2] = Object.assign({}, fx.comp.layers[0].transform[2], { expression: 'value' });
  const { services, comp } = await createTestServices(fx);
  const r = await services.executor.run('grid.build', { mode: 'rect' });
  assert.equal(r.status, 'failed');
  assert.match(JSON.stringify(r.errors), /already have your own expressions/);
  assert.equal(comp._layers.some((l) => /^MOE Grid/.test(l.name)), false);
});

test('Grid remove + freeze', async () => {
  const { services, comp } = await createTestServices(gridItems(4));
  const b = await services.executor.run('grid.build', { mode: 'rect', columns: 2, spacingX: 100, spacingY: 100 });
  assert.equal(b.status, 'success');
  const g = comp._layers.find((l) => l.name === 'MOE Grid 1');
  g.selected = true;
  cards(comp).forEach((L) => { L.selected = false; });
  const f = await services.executor.run('grid.remove', { mode: 'freeze' });
  assert.equal(f.status, 'success', JSON.stringify(f.verification || f.errors));
  assert.equal(tp(cards(comp)[0], 'ADBE Position').expression, '');
  assert.deepEqual(A(tp(cards(comp)[0], 'ADBE Position').value).map(Math.round), [-50, -50]);
  assert.ok((await services.executor.restore(f.checkpointId)).ok);
  assert.ok(tp(cards(comp)[0], 'ADBE Position').expression.startsWith(X.TAG));
  const rm = await services.executor.run('grid.remove', { mode: 'remove' });
  assert.equal(rm.status, 'success', JSON.stringify(rm.verification || rm.errors));
  assert.equal(comp._layers.some((l) => l.name === 'MOE Grid 1'), false);
  assert.ok(cards(comp).every((L) => L.parent === null && tp(L, 'ADBE Position').expression === ''));
});

test('Layout guides + Place in Cells (keyframes kept, measured centres)', async () => {
  const fx = gridItems(4);
  fx.comp.layers[0].transform[1] = Object.assign({}, fx.comp.layers[0].transform[1], { keys: [{ time: 0, value: [0, 0] }, { time: 2, value: [100, 0] }] });
  const { services, comp } = await createTestServices(fx);
  const g = await services.executor.run('grid.guides', { columns: 2, rows: 2, gutterX: 20, gutterY: 20, marginX: 40, marginY: 40 });
  assert.equal(g.status, 'success', JSON.stringify(g.verification || g.errors));
  assert.equal(comp.guides.length, 8);
  assert.ok((await services.executor.restore(g.checkpointId)).ok);
  assert.equal(comp.guides.length, 0);
  const p = await services.executor.run('grid.placeInCells', { columns: 2, rows: 2, gutterX: 0, gutterY: 0, marginX: 0, marginY: 0, fit: 'fit', padding: 0 });
  assert.equal(p.status, 'success', JSON.stringify(p.verification || p.errors, null, 1));
  const k = tp(cards(comp)[0], 'ADBE Position');
  assert.equal(k.numKeys, 2, 'keys kept');
  assert.ok(near(k.keyTime(2), 2));
  assert.ok((await services.executor.restore(p.checkpointId)).ok);
  assert.deepEqual(A(k.keyValue(2)), [100, 0]);
});

/* ---------------- v0.19 Grid Builder 2 ---------------- */
const GT = require('../extension/features/grid/tools');
const ctl = (g, name) => g._parade._children.find((f) => f.name === name)._children[0];
const pos = (comp, t) => cards(comp).map((L) => A(tp(L, 'ADBE Position').valueAtTime(t === undefined ? comp.time : t, false)));
const paramsOf = (r) => Object.assign({}, r.result ? r.result.params : r.params, { build: 100 });

test('Grid 2 · Morph: the null blends two layouts; AE values equal the pure placeMorph at 0 / 35 / 100 %', async () => {
  const { services, comp } = await createTestServices(gridItems(8));
  const r = await services.executor.run('grid.build', { mode: 'rect', columns: 4, spacingX: 150, spacingY: 120, morphTo: 'radial', radius: 300 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors, null, 1));
  const g = comp._layers.find((l) => l.name === 'MOE Grid 1');
  assert.equal(ctl(g, 'Layout').value, 1); assert.equal(ctl(g, 'Morph To').value, 2);
  assert.equal(ctl(g, 'Layout')._menuItems.length, 6, 'Layout dropdown lists the six layouts');
  const p = Object.assign(Lg.place.length ? {} : {}, X.defaultParams('rect'), { mode: 'rect', columns: 4, spacingX: 150, spacingY: 120, radius: 300, arc: 360, morphTo: 'radial', order: 1, buildOrder: 1, buildStyle: 1, build: 100, seed: 1, rowOffset: 0, columnOffset: 0 });
  for (const m of [0, 35, 100]) {
    ctl(g, 'Morph').setValue(m);
    const want = Lg.placeMorph(Object.assign({}, p, { morph: m }), 8);
    pos(comp).forEach((v, i) => assert.ok(near(v[0], want[i].x, 0.01) && near(v[1], want[i].y, 0.01), `morph ${m}% item ${i}: ${v} vs ${want[i].x},${want[i].y}`));
  }
  pos(comp).forEach((v) => assert.ok(near(Math.hypot(v[0], v[1]), 300, 0.01), 'Morph 100 = on the ring'));
});

test('Grid 2 · Layout switches live in Effect Controls and keeps every control and keyframe', async () => {
  const { services, comp } = await createTestServices(gridItems(6));
  const r = await services.executor.run('grid.build', { mode: 'rect', columns: 3, spacingX: 150, spacingY: 120 });
  assert.equal(r.status, 'success');
  const g = comp._layers.find((l) => l.name === 'MOE Grid 1');
  ctl(g, 'Spacing X').setValueAtTime(0, 150); ctl(g, 'Spacing X').setValueAtTime(2, 300);
  const u = await services.executor.run('grid.update', { gridId: g.id, values: JSON.stringify({ Layout: 2, Radius: 250 }) });
  assert.equal(u.status, 'success', JSON.stringify(u.verification || u.errors));
  pos(comp).forEach((v) => assert.ok(near(Math.hypot(v[0], v[1]), 250, 0.01), 'radial now'));
  ctl(g, 'Layout').setValue(1);
  assert.ok(near(pos(comp, 2)[2][0] - pos(comp, 2)[1][0], 300, 0.01), 'back to the grid — Spacing X keyframes still drive it');
  assert.equal(ctl(g, 'Spacing X').numKeys, 2);
});

test('Grid 2 · Orient: Forward turns with the null, Face Center faces out, Face Screen stays upright', async () => {
  const { services, comp } = await createTestServices(gridItems(4));
  const r = await services.executor.run('grid.build', { mode: 'radial', radius: 200, orient: '3' });
  assert.equal(r.status, 'success');
  const g = comp._layers.find((l) => l.name === 'MOE Grid 1');
  tp(g, 'ADBE Rotate Z').setValue(30);
  const rot = () => cards(comp).map((L) => tp(L, 'ADBE Rotate Z').valueAtTime(comp.time, false));
  rot().forEach((v) => assert.ok(near(v, -30), 'Face Screen cancels the null rotation'));
  ctl(g, 'Orient').setValue(1); rot().forEach((v) => assert.ok(near(v, 0), 'Forward: no own rotation'));
  ctl(g, 'Orient').setValue(2); assert.deepEqual(rot().map(Math.round), [0, 90, 180, 270], 'Face Center: each item faces out');
});

test('Grid 2 · items stay editable: a hand nudge (or own Position keys) plays on top of the layout', async () => {
  const { services, comp } = await createTestServices(gridItems(4));
  const r = await services.executor.run('grid.build', { mode: 'rect', columns: 2, spacingX: 200, spacingY: 200 });
  assert.equal(r.status, 'success');
  const before = pos(comp);
  const P = tp(cards(comp)[1], 'ADBE Position'); const v = A(P.value);
  P.setValue([v[0] + 40, v[1] - 15]);
  const after = pos(comp);
  assert.ok(near(after[1][0] - before[1][0], 40) && near(after[1][1] - before[1][1], -15), 'nudged by hand');
  assert.deepEqual(after[0], before[0], 'others unchanged');
});

test('Grid 2 · Effector: push / attract, rotate and fade near it', async () => {
  const layers = gridItems(3).comp.layers;
  layers.push({ name: 'Magnet', null: true, transform: TA({ pos: [0, 0] }) });
  const fx = studioComp(layers);
  fx.comp.layers.forEach((l) => { l.selected = /^Card/.test(l.name); });
  const { services, comp } = await createTestServices(fx);
  const mi = comp._layers.findIndex((l) => l.name === 'Magnet') + 1;
  const r = await services.executor.run('grid.build', { mode: 'rect', columns: 3, spacingX: 300, spacingY: 100, effector: mi });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors, null, 1));
  const g = comp._layers.find((l) => l.name === 'MOE Grid 1');
  const gp = A(tp(g, 'ADBE Position').value);
  tp(comp._layers.find((l) => l.name === 'Magnet'), 'ADBE Position').setValue([gp[0], gp[1]]); // on the middle item
  ctl(g, 'Effector Rotate').setValue(90); ctl(g, 'Effector Fade').setValue(100); ctl(g, 'Effector Scale').setValue(0);
  const mid = cards(comp)[1];
  assert.ok(near(tp(mid, 'ADBE Rotate Z').valueAtTime(comp.time, false), 90), 'full rotate at the centre');
  assert.ok(near(tp(mid, 'ADBE Opacity').valueAtTime(comp.time, false), 0), 'faded out at the centre');
  ctl(g, 'Effector Radius').setValue(400); ctl(g, 'Effector Push').setValue(-100);
  const left = tp(cards(comp)[0], 'ADBE Position').valueAtTime(comp.time, false);
  assert.ok(left[0] > -300, 'negative push attracts toward the effector');
});

test('Grid 2 · Grid Items: reorder (reverse, name, my order) moves places, not the layer stack; restore; tweaks', async () => {
  const { services, comp } = await createTestServices(gridItems(4));
  const r = await services.executor.run('grid.build', { mode: 'rect', columns: 4, spacingX: 100, spacingY: 100 });
  assert.equal(r.status, 'success');
  const g = comp._layers.find((l) => l.name === 'MOE Grid 1');
  const names = () => comp._layers.map((l) => l.name).join(',');
  const stack = names(), before = pos(comp);
  const rev = await services.executor.run('grid.items', { action: 'order', gridId: g.id, sort: 'reverse' });
  assert.equal(rev.status, 'success', JSON.stringify(rev.verification || rev.errors));
  const after = pos(comp);
  after.forEach((v, i) => assert.ok(near(v[0], before[3 - i][0]), `item ${i} now in place ${3 - i}`));
  assert.equal(names(), stack, 'layer stack untouched');
  assert.ok((await services.executor.restore(rev.checkpointId)).ok);
  pos(comp).forEach((v, i) => assert.ok(near(v[0], before[i][0]), 'restored'));
  const ids = cards(comp).map((L) => L.id);
  const mine = await services.executor.run('grid.items', { action: 'order', gridId: g.id, sort: 'custom', order: JSON.stringify([ids[2], ids[0], ids[3], ids[1]]) });
  assert.equal(mine.status, 'success');
  assert.ok(near(pos(comp)[2][0], before[0][0]), 'Card 3 took the first place');
  const bad = await services.executor.run('grid.items', { action: 'order', gridId: g.id, sort: 'custom', order: JSON.stringify([ids[0]]) });
  assert.notEqual(bad.status, 'success', 'an order missing items is refused');
  // tweak: select item 2, twist 45
  comp._layers.forEach((l) => { l.selected = l.name === 'Card 2'; });
  const tw = await services.executor.run('grid.items', { action: 'tweak', twist: 45, delay: 0 });
  assert.equal(tw.status, 'success', JSON.stringify(tw.verification || tw.errors));
  assert.ok(near(tp(cards(comp)[1], 'ADBE Rotate Z').valueAtTime(comp.time, false), 45));
  assert.ok(near(tp(cards(comp)[0], 'ADBE Rotate Z').valueAtTime(comp.time, false), 0), 'others not twisted');
  assert.ok((await services.executor.restore(tw.checkpointId)).ok);
  assert.ok(near(tp(cards(comp)[1], 'ADBE Rotate Z').valueAtTime(comp.time, false), 0), 'tweak removed');
});

test('Grid 2 · presets: Grid → Ring and Galaxy → Wall build, keyframe Morph after the build-in, and verify', async () => {
  for (const id of ['gridRing', 'galaxyWall']) {
    const { services, comp } = await createTestServices(gridItems(9, { comp: { time: 1 } }));
    const preset = GT.build.ui.presets.find((p) => p.id === id);
    const r = await services.executor.run('grid.build', Object.assign({}, preset.args));
    assert.equal(r.status, 'success', `${id}: ${JSON.stringify(r.verification || r.errors, null, 1)}`);
    const g = comp._layers.find((l) => l.name === 'MOE Grid 1');
    assert.equal(ctl(g, 'Morph').numKeys, 2, `${id}: Morph keyframed`);
    if (preset.args.animateIn) assert.ok(ctl(g, 'Morph').keyTime(1) >= ctl(g, 'Build').keyTime(2) - 1e-9, 'morph starts after the build-in');
    assert.ok(r.verification.checks.some((c) => /match the preview/.test(c.detail)), `${id}: read-back equals the pure layout`);
  }
});

test('Grid 2 · old "Face center" presets still face the centre; sortSlots is a permutation', () => {
  const p = GT.resolveParams({ mode: 'radial', faceCenter: true, orient: '1', order: '1', buildOrder: '1', buildStyle: '1' }, { columns: 3, spacingX: 100, spacingY: 100, radius: 300, spread: 40, ringSpacing: 100 });
  assert.equal(p.orient, 2);
  const items = [{ id: 1, name: 'b', index: 3, slot: 0 }, { id: 2, name: 'a', index: 1, slot: 1 }, { id: 3, name: 'c', index: 2, slot: 2 }];
  assert.deepEqual(GT.sortSlots(items, 'layer', {}), [2, 3, 1]);
  assert.deepEqual(GT.sortSlots(items, 'name', {}), [2, 1, 3]);
  assert.deepEqual(GT.sortSlots(items, 'reverse', {}), [3, 2, 1]);
  assert.deepEqual(GT.sortSlots(items, 'shuffle', { seed: 5 }).slice().sort(), [1, 2, 3]);
});

test('Grid 2 · building again on items already in a grid is refused with where to go instead', async () => {
  const { services, comp } = await createTestServices(gridItems(4));
  const r = await services.executor.run('grid.build', { mode: 'rect', columns: 2 });
  assert.equal(r.status, 'success');
  comp._layers.forEach((l) => { l.selected = /^Card/.test(l.name); });
  const again = await services.executor.run('grid.build', { mode: 'radial' });
  assert.notEqual(again.status, 'success');
  assert.match(JSON.stringify(again.errors), /already in MOE Grid 1/);
  assert.equal(comp._layers.filter((l) => /^MOE Grid/.test(l.name)).length, 1, 'no second null');
});
