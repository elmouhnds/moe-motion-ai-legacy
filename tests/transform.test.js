'use strict';
/**
 * v0.9 Motion-4-style tools on the AE mock (real host .jsx): Anchor Point, Align & Distribute,
 * Clone, Ease Curve — each verified by read-back and restored exactly.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { TA } = require('./fixtures/layout');
const { studioComp, T: TS } = require('./fixtures/studio');
const B = require('../extension/features/curves/bezier');
const M = require('../extension/features/transform/math');

const near = (a, b, t = 0.02) => Math.abs(a - b) <= t;
const A = (v) => Array.from(v);
const tp = (L, mn) => L.property('ADBE Transform Group').property(mn);
const named = (comp, n) => comp._layers.find((l) => l.name === n);
const select = (comp, names) => comp._layers.forEach((l) => { l.selected = names.includes(l.name); });
const box = (name, pos, extra = {}) => Object.assign({ name, selected: true, transform: TA(Object.assign({ pos }, extra)), rect: { left: -50, top: -40, width: 100, height: 80 } }, extra.layer || {});

async function bounds(services, comp, ids) {
  const r = await services.host.call('layers.bounds', { compId: comp.id, layerIds: ids, times: [comp.time] });
  return r.layers.map((l) => l.boxes[0]);
}

test('bezier: endpoints, monotonic presets, temporal round trip, segments', () => {
  for (const p of B.PRESETS) {
    assert.ok(near(B.valueAt(p, 0), 0, 1e-3) && near(B.valueAt(p, 1), 1, 1e-3), p.id);
  }
  assert.ok(B.valueAt(B.PRESETS.find((p) => p.id === 'outBack'), 0.6) > 1, 'back overshoots');
  const curve = { x1: 0.16, y1: 1, x2: 0.3, y2: 1 };
  const seg = { dt: 2, dv: [100, -50], spatial: false };
  const te = B.toTemporal(curve, seg);
  assert.equal(te.out.length, 2);
  assert.ok(near(te.out[0].influence, 16) && near(te.in[0].influence, 70));
  assert.ok(near(te.out[0].speed, (1 / 0.16) * 50) && near(te.out[1].speed, (1 / 0.16) * -25), 'per-dimension signed speed');
  assert.ok(near(te.in[0].speed, 0), 'y2 = 1 → arrives at rest');
  const back = B.fromTemporal(te.out, te.in, seg);
  for (const k of ['x1', 'y1', 'x2', 'y2']) assert.ok(near(back[k], curve[k], 1e-6), k);
  const sp = B.toTemporal({ x1: 0.36, y1: 0, x2: 0.66, y2: -0.56 }, { dt: 1, dv: [100, 0], spatial: true });
  assert.equal(sp.out.length, 1);
  assert.equal(sp.in[0].speed >= 0, true);
  assert.deepEqual(B.segments([3, 1, 2, 2]), [{ a: 1, b: 2 }, { a: 2, b: 3 }]);
});

test('Anchor Point: 9 positions; the layer does not move (scaled + rotated); restore', async () => {
  const fx = studioComp([box('Card', [800, 500], { rot: 30, layer: {} })], { comp: { time: 1 } });
  fx.comp.layers[0].transform[2] = Object.assign({}, fx.comp.layers[0].transform[2], { value: [150, 80] });
  const { services, comp } = await createTestServices(fx);
  const L = named(comp, 'Card');
  const b0 = await bounds(services, comp, [L.id]);
  const r = await services.executor.run('transform.anchor', { point: 'br' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.deepEqual(A(tp(L, 'ADBE Anchor Point').value), [50, 40]);
  const b1 = await bounds(services, comp, [L.id]);
  b0[0].forEach((v, i) => assert.ok(near(v, b1[0][i], 0.05), `bounds ${i}: ${v} vs ${b1[0][i]}`));
  const rb = await services.executor.restore(r.checkpointId);
  assert.ok(rb.ok);
  assert.deepEqual(A(tp(L, 'ADBE Anchor Point').value), [0, 0]);
  assert.deepEqual(A(tp(L, 'ADBE Position').value), [800, 500]);
});

test('Anchor Point: keyframed position shifts every key; animated scale is compensated at the playhead; a keyed anchor shifts', async () => {
  const anim = TA({ pos: [400, 300] });
  anim[1] = Object.assign({}, anim[1], { keys: [{ time: 0, value: [100, 300] }, { time: 2, value: [700, 300] }] });
  const scaled = TA({ pos: [900, 300] });
  scaled[2] = Object.assign({}, scaled[2], { keys: [{ time: 0, value: [50, 50] }, { time: 1, value: [100, 100] }] });
  const keyedAnchor = TA({ pos: [300, 800] });
  keyedAnchor[0] = Object.assign({}, keyedAnchor[0], { keys: [{ time: 0, value: [0, 0] }, { time: 1, value: [20, 10] }] });
  const fx = studioComp([
    { name: 'Mover', selected: true, transform: anim, rect: { left: 0, top: 0, width: 200, height: 100 } },
    { name: 'Grower', selected: true, transform: scaled, rect: { left: 0, top: 0, width: 200, height: 100 } },
    { name: 'Pivot', selected: true, transform: keyedAnchor, rect: { left: 0, top: 0, width: 200, height: 100 } },
  ]);
  const { services, comp } = await createTestServices(fx);
  comp.time = 0;
  const r = await services.executor.run('transform.anchor', { point: 'c' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  const P = tp(named(comp, 'Mover'), 'ADBE Position');
  assert.deepEqual(A(P.keyValue(1)), [200, 350]);
  assert.deepEqual(A(P.keyValue(2)), [800, 350]);
  // Grower: scale 50 % at the playhead → position moves half the anchor change, and the report says so
  assert.deepEqual(A(tp(named(comp, 'Grower'), 'ADBE Position').value), [950, 325]);
  assert.match(r.verification.checks.find((c) => c.label === 'Grower').detail, /exact at the playhead/);
  // Pivot: the anchor keys both shift by the same amount (animation kept)
  const AP = tp(named(comp, 'Pivot'), 'ADBE Anchor Point');
  assert.deepEqual(A(AP.keyValue(1)), [100, 50]);
  assert.deepEqual(A(AP.keyValue(2)), [120, 60]);
  await services.executor.restore(r.checkpointId);
  assert.deepEqual(A(P.keyValue(1)), [100, 300]);
  assert.deepEqual(A(AP.keyValue(2)), [20, 10]);
  assert.deepEqual(A(tp(named(comp, 'Grower'), 'ADBE Position').value), [900, 300]);
});

test('Anchor Point: Alt = also place in the comp; masks box; 3D-rotated layer measured by a probe that leaves no layer and keeps the selection', async () => {
  const fx = studioComp([
    { name: 'Card', selected: true, transform: TA({ pos: [400, 300] }), rect: { left: 0, top: 0, width: 200, height: 100 } },
    { name: 'Tilted', selected: false, threeD: true, transform: TS({ pos: [600, 500, 0], threeD: true }), rect: { left: 0, top: 0, width: 100, height: 100 } }
  ]);
  const { services, comp } = await createTestServices(fx);
  let r = await services.executor.run('transform.anchor', { point: 'br', place: true });
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  const card = named(comp, 'Card');
  assert.deepEqual(A(tp(card, 'ADBE Anchor Point').value).slice(0, 2), [200, 100]);
  assert.deepEqual(A(tp(card, 'ADBE Position').value).slice(0, 2), [comp.width, comp.height], 'bottom-right corner of the comp');
  await services.executor.restore(r.checkpointId);
  assert.deepEqual(A(tp(card, 'ADBE Position').value).slice(0, 2), [400, 300]);
  // masks: the box comes from the mask, not the layer content
  await services.host.call('masks.ellipse', { compId: comp.id, layerId: card.id, center: [50, 50], size: [40, 40], feather: 0 });
  r = await services.executor.run('transform.anchor', { point: 'tl', masks: true });
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  assert.deepEqual(A(tp(card, 'ADBE Anchor Point').value).slice(0, 2).map(Math.round), [30, 30]);
  // 3D layer rotated in Y → probe path
  const tilted = named(comp, 'Tilted');
  tp(tilted, 'ADBE Rotate Y').setValue(30);
  select(comp, ['Tilted']);
  const n = comp.numLayers;
  r = await services.executor.run('transform.anchor', { point: 'c' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  assert.match(r.verification.checks[0].detail, /measured in 3D/);
  assert.equal(comp.numLayers, n, 'probe removed');
  assert.ok(tilted.selected, 'selection kept');
});

test('Align: a parented layer moves in its parent\'s space (scaled parent); whole animation moves', async () => {
  const fx = studioComp([
    { name: 'Parent', selected: false, transform: TA({ pos: [960, 540] }), rect: { left: 0, top: 0, width: 10, height: 10 } },
    box('Child', [100, 0]), box('Free', [400, 300])
  ]);
  const { services, comp } = await createTestServices(fx);
  const parent = named(comp, 'Parent'), child = named(comp, 'Child');
  tp(parent, 'ADBE Scale').setValue([200, 200]);
  child.parent = parent;
  const ids = ['Child', 'Free'].map((n) => named(comp, n).id);
  const r = await services.executor.run('transform.align', { mode: 'top', to: 'selection' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  const bx = await bounds(services, comp, ids);
  assert.ok(near(bx[0][1], bx[1][1], 0.05), `tops line up: ${bx.map(String)}`);
  assert.match(r.verification.checks.find((c) => c.label === 'Child').detail, /parent/);
});

test('Align: left edges to the selection, centre to the comp, distribute evenly; restore', async () => {
  const fx = studioComp([box('A', [200, 200]), box('B', [600, 420]), box('C', [1500, 700])]);
  const { services, comp } = await createTestServices(fx);
  const ids = ['A', 'B', 'C'].map((n) => named(comp, n).id);
  let r = await services.executor.run('transform.align', { mode: 'left', to: 'selection' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  let bx = await bounds(services, comp, ids);
  bx.forEach((b) => assert.ok(near(b[0], 150, 0.05), String(b)));
  await services.executor.restore(r.checkpointId);
  bx = await bounds(services, comp, ids);
  assert.ok(near(bx[2][0], 1450, 0.05), 'restored');
  r = await services.executor.run('transform.align', { mode: 'vcenter', to: 'comp' });
  bx = await bounds(services, comp, ids);
  bx.forEach((b) => assert.ok(near((b[1] + b[3]) / 2, 540, 0.05)));
  r = await services.executor.run('transform.align', { mode: 'distH', to: 'selection' });
  bx = await bounds(services, comp, ids);
  const cx = bx.map((b) => (b[0] + b[2]) / 2).sort((a, b) => a - b);
  assert.ok(near(cx[1] - cx[0], cx[2] - cx[1], 0.05));
});

test('align maths: nothing to do returns no moves; distribute needs 3', () => {
  const b = [{ layerId: 1, box: [0, 0, 10, 10] }, { layerId: 2, box: [0, 20, 10, 30] }];
  assert.deepEqual(M.align(b, 'left', 'selection', { width: 100, height: 100 }), []);
  assert.deepEqual(M.align(b, 'distV', 'selection', { width: 100, height: 100 }), []);
});

test('Clone radial: 8 on a ring (the original moves to slot 1), facing out; restore removes the copies', async () => {
  const fx = studioComp([box('Dot', [960, 540]), box('Other', [100, 100], { layer: { selected: false } })]);
  fx.comp.layers[1].selected = false;
  const { services, comp } = await createTestServices(fx);
  const n0 = comp.numLayers;
  const r = await services.executor.run('transform.clone', { mode: 'radial', count: 8, radius: 300, arc: 360, center: 'layer', faceOut: true });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.equal(comp.numLayers, n0 + 7);
  const copies = comp._layers.filter((l) => /^MOE Clone \d+ · Dot$/.test(l.name));
  assert.equal(copies.length, 7);
  const all = [named(comp, 'Dot'), ...copies].map((l) => A(tp(l, 'ADBE Position').value));
  all.forEach((p) => assert.ok(near(Math.hypot(p[0] - 960, p[1] - 540), 300, 0.05)));
  assert.ok(near(tp(copies[1], 'ADBE Rotate Z').value, 90), 'third item faces 90°');
  const rb = await services.executor.restore(r.checkpointId);
  assert.ok(rb.ok);
  assert.equal(comp.numLayers, n0);
  assert.deepEqual(A(tp(named(comp, 'Dot'), 'ADBE Position').value), [960, 540]);
});

test('Clone row with steps; refuses a keyframed layer; needs exactly one layer', async () => {
  const fx = studioComp([box('Bar', [100, 500])]);
  const { services, comp } = await createTestServices(fx);
  const r = await services.executor.run('transform.clone', { mode: 'linear', count: 4, stepX: 150, stepY: 0, rotationStep: 10, scaleStep: -10, opacityStep: 20 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const last = named(comp, 'MOE Clone 3 · Bar');
  assert.deepEqual(A(tp(last, 'ADBE Position').value), [550, 500]);
  assert.ok(near(tp(last, 'ADBE Rotate Z').value, 30));
  assert.deepEqual(A(tp(last, 'ADBE Scale').value), [70, 70]);
  assert.ok(near(tp(last, 'ADBE Opacity').value, 40));
  const keyedFx = studioComp([{ name: 'K', selected: true, transform: (() => { const t = TA({ pos: [0, 0] }); t[1] = Object.assign({}, t[1], { keys: [{ time: 0, value: [0, 0] }, { time: 1, value: [10, 0] }] }); return t; })(), rect: { left: 0, top: 0, width: 10, height: 10 } }]);
  const k = await createTestServices(keyedFx);
  const r2 = await k.services.executor.run('transform.clone', { mode: 'linear', count: 3 });
  assert.equal(r2.status, 'failed');
  assert.match((r2.errors || []).join(' '), /keyframes/);
  select(comp, ['Bar', 'MOE Clone 1 · Bar']);
  const r3 = await services.executor.run('transform.clone', { count: 3 });
  assert.equal(r3.status, 'blocked');
});

test('Ease Curve: exact speed + influence on every selected segment (spatial and per-dimension); restore', async () => {
  const pos = TA({ pos: [0, 0] });
  pos[1] = Object.assign({}, pos[1], { selected: true, keys: [{ time: 0, value: [100, 500], selected: true }, { time: 1, value: [500, 200], selected: true }, { time: 3, value: [900, 200], selected: true }] });
  pos[2] = Object.assign({}, pos[2], { selected: true, keys: [{ time: 0, value: [0, 0], selected: true }, { time: 2, value: [100, 50], selected: true }] });
  const fx = studioComp([{ name: 'Ball', selected: true, transform: pos, rect: { left: -20, top: -20, width: 40, height: 40 } }]);
  const { services, comp } = await createTestServices(fx);
  const curve = B.PRESETS.find((p) => p.id === 'outExpo');
  const P = tp(named(comp, 'Ball'), 'ADBE Position');
  const S = tp(named(comp, 'Ball'), 'ADBE Scale');
  const before = P.keyOutTemporalEase(1)[0].influence;
  const r = await services.executor.run('motion.easeCurve', { x1: curve.x1, y1: curve.y1, x2: curve.x2, y2: curve.y2 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  // Position segment 1: 500 px in 1 s → outgoing speed = (1 / 0.16) × 500
  assert.ok(near(P.keyOutTemporalEase(1)[0].speed, 500 / 0.16, 0.01));
  assert.ok(near(P.keyOutTemporalEase(1)[0].influence, 16));
  assert.ok(near(P.keyInTemporalEase(2)[0].influence, 70));
  assert.ok(near(P.keyOutTemporalEase(2)[0].speed, 200 / 0.16, 0.01), 'middle key: out from the next segment (400 px / 2 s)');
  // Scale (two dimensions, non-spatial): per-dimension speeds
  const se = S.keyOutTemporalEase(1);
  assert.equal(se.length, 2);
  assert.ok(near(se[0].speed, 50 / 0.16, 0.01) && near(se[1].speed, 25 / 0.16, 0.01));
  await services.executor.restore(r.checkpointId);
  assert.ok(near(P.keyOutTemporalEase(1)[0].influence, before));
});

test('v0.10 wiring: the Motion Kit owns the ease / anchor / align / kit tools; pie and Quick Bar reach them', () => {
  const S = require('../extension/app/ui/studio/sections');
  const { TOOLS } = require('../extension/features/index');
  const ids = new Set(TOOLS.map((t) => t.id));
  for (const id of ['transform.anchor', 'transform.align', 'transform.clone', 'motion.easeCurve', 'kit.interp', 'kit.trash']) assert.equal(S.sectionOf({ id, category: 'x' }), 'kit', id);
  assert.equal(S.workspaceOf('kit').id, 'ws-kit');
  assert.equal(S.byId('curves'), null, 'v0.9 tile section removed');
  assert.equal(S.byId('transform'), null, 'v0.9 tile section removed');
  const QB = require('../extension/features/quick/bar');
  for (const id of QB.KIT_TOOLS) { const a = QB.ACTIONS.find((x) => x.id === id); assert.ok(a, id); assert.ok(ids.has(a.tool), `${id} → ${a.tool}`); }
  const actions = require('../extension/app/ui/actions');
  for (const ref of ['quick:curveExpo', 'quick:anchorB', 'quick:distH', 'quick:k_repeat', 'nav:kit']) assert.ok(actions.resolve(ref), ref);
});

test('Motion Kit: preset matching and the keyed-property pick', () => {
  const kit = require('../extension/app/ui/views/kit');
  assert.equal(kit.matchPreset(B.normalize(B.PRESETS.find((p) => p.id === 'outExpo'))), 'outExpo');
  assert.equal(kit.matchPreset({ x1: 0.5, y1: 0.2, x2: 0.4, y2: 0.9 }), null);
  const ctx = { properties: [{ name: 'Color', valueType: 'COLOR', selectedKeys: [1, 2] }, { name: 'Opacity', valueType: 'OneD', selectedKeys: [2, 3] }] };
  assert.deepEqual(kit.keyed(ctx).map((p) => p.name), ['Opacity']);
});
