'use strict';
/**
 * v0.10 Motion Kit tools on the AE mock (real host .jsx): Interpolation, Trim to Keys,
 * Parent Chain, Stare, Vignette, Trash, Ease Curve in / out only — verified by read-back, restored.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { TA } = require('./fixtures/layout');
const { studioComp } = require('./fixtures/studio');

const A = (v) => Array.from(v);
const tp = (L, mn) => L.property('ADBE Transform Group').property(mn);
const named = (comp, n) => comp._layers.find((l) => l.name === n);
const select = (comp, names) => comp._layers.forEach((l) => { l.selected = names.includes(l.name); });
const KIT = { LINEAR: 6612, BEZIER: 6613, HOLD: 6614 };

function keyed(name, sel = true) {
  const t = TA({ pos: [100, 100] });
  t[1] = Object.assign({}, t[1], { selected: sel, keys: [{ time: 0.5, value: [100, 100], selected: sel }, { time: 1.5, value: [500, 100], selected: sel }, { time: 2.5, value: [500, 400], selected: sel }] });
  return { name, selected: sel, transform: t, rect: { left: -50, top: -50, width: 100, height: 100 } };
}

test('Interpolation: Hold on both sides, Linear on the out side only; restore', async () => {
  const { services, comp } = await createTestServices(studioComp([keyed('Ball')]));
  const P = tp(named(comp, 'Ball'), 'ADBE Position');
  const orig = [1, 2, 3].map((k) => [P.keyInInterpolationType(k), P.keyOutInterpolationType(k)]);
  let r = await services.executor.run('kit.interp', { mode: 'hold', side: 'both' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  for (let k = 1; k <= 3; k++) { assert.equal(P.keyInInterpolationType(k), KIT.HOLD); assert.equal(P.keyOutInterpolationType(k), KIT.HOLD); }
  await services.executor.restore(r.checkpointId);
  assert.deepEqual([1, 2, 3].map((k) => [P.keyInInterpolationType(k), P.keyOutInterpolationType(k)]), orig, 'restored exactly');
  const inBefore = P.keyInInterpolationType(2);
  r = await services.executor.run('kit.interp', { mode: 'linear', side: 'out' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  assert.equal(P.keyOutInterpolationType(2), KIT.LINEAR);
  assert.equal(P.keyInInterpolationType(2), inBefore, 'in side untouched');
});

test('Trim to Keys: in / out on the first / last key; restore', async () => {
  const { services, comp } = await createTestServices(studioComp([keyed('Ball')]));
  const L = named(comp, 'Ball');
  const before = [L.inPoint, L.outPoint];
  const r = await services.executor.run('kit.trimToKeys', {});
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  assert.deepEqual([L.inPoint, L.outPoint], [0.5, 2.5]);
  await services.executor.restore(r.checkpointId);
  assert.deepEqual([L.inPoint, L.outPoint], before);
});

test('Parent Chain: selection order, reverse; restore', async () => {
  const fx = studioComp(['A', 'B', 'C'].map((n, i) => ({ name: n, selected: true, transform: TA({ pos: [100 + i * 100, 100] }), rect: { left: 0, top: 0, width: 10, height: 10 } })));
  const { services, comp } = await createTestServices(fx);
  let r = await services.executor.run('kit.parent', {});
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  assert.equal(named(comp, 'B').parent, named(comp, 'A'));
  assert.equal(named(comp, 'C').parent, named(comp, 'B'));
  await services.executor.restore(r.checkpointId);
  assert.equal(named(comp, 'C').parent, null);
  r = await services.executor.run('kit.parent', { reverse: true });
  assert.equal(r.status, 'success');
  assert.equal(named(comp, 'B').parent, named(comp, 'C'));
});

test('Stare: the other layers face the last selected one (mock-evaluated); restore removes the rig', async () => {
  const fx = studioComp([
    { name: 'Eye', selected: true, transform: TA({ pos: [100, 100] }), rect: { left: 0, top: 0, width: 10, height: 10 } },
    { name: 'Target', selected: true, transform: TA({ pos: [100, 400] }), rect: { left: 0, top: 0, width: 10, height: 10 } }
  ]);
  const { services, comp } = await createTestServices(fx);
  const r = await services.executor.run('kit.stare', {});
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  const rot = tp(named(comp, 'Eye'), 'ADBE Rotate Z');
  assert.match(rot.expression, /MOE Stare/);
  assert.ok(Math.abs(rot.valueAtTime(0, false) - 90) < 0.01, `faces down: ${rot.valueAtTime(0, false)}`);
  await services.executor.restore(r.checkpointId);
  assert.equal(rot.expression, '');
  assert.equal(named(comp, 'Eye').property('ADBE Effect Parade').numProperties, 0);
});

test('Vignette: MOE Vignette solid with a feathered subtract mask at the set opacity; restore removes it', async () => {
  const { services, comp } = await createTestServices(studioComp([keyed('Ball')]));
  const n = comp.numLayers;
  const r = await services.executor.run('kit.vignette', { amount: 40 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  const v = named(comp, 'MOE Vignette');
  assert.ok(v);
  assert.equal(A([].concat(tp(v, 'ADBE Opacity').value))[0], 40);
  assert.equal(v.property('ADBE Mask Parade').numProperties, 1);
  await services.executor.restore(r.checkpointId);
  assert.equal(comp.numLayers, n);
});

test('Trash: removes MOE expressions and MOE effects, keeps the user\'s own', async () => {
  const { services, comp } = await createTestServices(studioComp([keyed('Ball')]));
  const L = named(comp, 'Ball');
  let r = await services.executor.run('expressions.quick', { preset: 'wiggle', live: true });
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  tp(L, 'ADBE Opacity').expression = 'value * 0.5; // mine';
  select(comp, ['Ball']);
  r = await services.executor.run('kit.trash', {});
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  assert.equal(tp(L, 'ADBE Position').expression, '');
  assert.equal(tp(L, 'ADBE Opacity').expression, 'value * 0.5; // mine');
  assert.equal(L.property('ADBE Effect Parade').numProperties, 0);
  assert.match(r.summary || '', /Removed 1 expression and 2 effects/);
});

test('Ease Curve: "in" only touches the incoming side, "out" only the outgoing side', async () => {
  const { services, comp } = await createTestServices(studioComp([keyed('Ball')]));
  const P = tp(named(comp, 'Ball'), 'ADBE Position');
  const before = (k) => [P.keyInTemporalEase(k)[0].influence, P.keyOutTemporalEase(k)[0].influence];
  const b1 = before(1), b2 = before(2);
  let r = await services.executor.run('motion.easeCurve', { x1: 0.16, y1: 1, x2: 0.3, y2: 1, side: 'out' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  assert.ok(Math.abs(P.keyOutTemporalEase(1)[0].influence - 16) < 0.01);
  assert.equal(P.keyInTemporalEase(2)[0].influence, b2[0], 'in side of key 2 untouched');
  await services.executor.restore(r.checkpointId);
  r = await services.executor.run('motion.easeCurve', { x1: 0.16, y1: 1, x2: 0.3, y2: 1, side: 'in' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  assert.ok(Math.abs(P.keyInTemporalEase(2)[0].influence - 70) < 0.01);
  assert.equal(P.keyOutTemporalEase(1)[0].influence, b1[1], 'out side of key 1 untouched');
});

test('Quick Bar expression buttons carry the preset\'s own numbers (Excite overshoot stays 0.06, not the form default 30)', () => {
  const qb = require('../extension/app/ui/quickbar');
  const { PRESETS } = require('../extension/features/expressions/quick');
  const excite = qb.ACTIONS.find((a) => a.id === 'k_excite');
  assert.equal(excite.args.amp, PRESETS.inertia.nums.amp);
  assert.equal(excite.args.live, true);
  // v0.29: the expression buttons are the library tiles themselves (old x_ ids migrate to them)
  const x = qb.byId('x_inertia');
  assert.equal(x.id, 'tile:expressions/x-inertia');
  assert.equal(x.args.amp, PRESETS.inertia.nums.amp);
  assert.equal(x.tool, 'expressions.quick');
  assert.equal(excite.label, 'Excite (overshoot)', 'kit buttons keep their Motion 4 names');
});

test('two panels on one data folder: each sees the other\'s writes; settings changes merge instead of overwriting', async () => {
  const { createMemPlatform } = require('../dev/platform-mem');
  const { createStore } = require('../extension/core/storage');
  const { createSettings } = require('../extension/core/settings');
  const plat = createMemPlatform();
  const a = createStore(plat.fs), b = createStore(plat.fs);
  const sa = createSettings(a), sb = createSettings(b);
  b.get('kit-curves', []); // panel B caches the document
  a.set('kit-curves', [{ id: 'u1', label: 'Mine' }]);
  sa.update({ ui: { theme: 'midnight' } });
  await new Promise((r) => setTimeout(r, 520));
  assert.deepEqual(b.get('kit-curves', []).map((c) => c.id), ['u1']);
  sb.update({ ui: { kit: { side: 'out' } } });
  const merged = createSettings(createStore(plat.fs)).get().ui;
  assert.equal(merged.theme, 'midnight', 'panel A\'s change survived panel B\'s save');
  assert.equal(merged.kit.side, 'out');
});

test('Motion Kit default pins are kit tools', () => {
  const kit = require('../extension/app/ui/views/kit');
  const QB = require('../extension/features/quick/bar');
  assert.deepEqual(kit.DEFAULT_PINS.filter((id) => !QB.KIT_TOOLS.includes(QB.migrate(id))), [], 'every default pin is a kit tool');
});

test('Ease graph maths: speed handles round-trip, ranges grow for overshoot, numbers parse', () => {
  const KG = require('../extension/app/ui/views/kitGraph');
  const B = require('../extension/features/curves/bezier');
  const expo = B.normalize(B.PRESETS.find((p) => p.id === 'outExpo'));
  const s = KG.keySpeeds(expo);
  assert.ok(Math.abs(s.out - 1 / 0.16) < 1e-9 && Math.abs(s.in) < 1e-9, 'Out Expo starts 6.25× average, arrives at rest');
  // dragging a speed handle to where it already is changes nothing
  const same = KG.fromSpeed(expo, 1, expo.x1, s.out);
  assert.ok(Math.abs(same.x1 - expo.x1) < 1e-3 && Math.abs(same.y1 - expo.y1) < 1e-3);
  // longer influence at the same speed → y1 grows with x1
  const longer = KG.fromSpeed(expo, 1, 0.3, s.out);
  assert.ok(Math.abs(longer.y1 / longer.x1 - Math.min(s.out * 0.3, B.Y_MAX) / 0.3) < 1e-2);
  // incoming handle: speed 0 → y2 = 1
  assert.equal(KG.fromSpeed(expo, 2, 0.5, 0).y2, 1);
  const back = B.normalize(B.PRESETS.find((p) => p.id === 'outBack'));
  assert.ok(KG.valueRange(back).hi > 1.1, 'graph grows to show the overshoot');
  assert.ok(KG.valueRange(B.normalize(B.PRESETS.find((p) => p.id === 'inBack'))).lo < -0.1, 'and the anticipation');
  assert.ok(KG.speedRange(expo).hi >= s.out, 'speed graph fits the start speed');
  assert.deepEqual(KG.parseCurve('cubic-bezier(.16, 1, .3, 1)'), { x1: 0.16, y1: 1, x2: 0.3, y2: 1 });
  assert.deepEqual(KG.parseCurve('0.25 0.1 0.25 1'), { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 });
  assert.equal(KG.parseCurve('ease'), null);
  assert.equal(KG.parseCurve('1, 2, 3'), null);
});

test('Delay (C4D MoGraph): Spring on a layer\'s own move overshoots and settles; the expression matches the reference maths', async () => {
  const D = require('../extension/features/kit/delay');
  const t = TA({ pos: [100, 300] });
  t[1] = Object.assign({}, t[1], { keys: [{ time: 0.4, value: [100, 300] }, { time: 0.8, value: [500, 300] }] });
  const { services, comp } = await createTestServices(studioComp([{ name: 'Ball', selected: true, transform: t, rect: { left: -20, top: -20, width: 40, height: 40 } }]));
  const r = await services.executor.run('kit.delay', { mode: 'spring', position: true, rotation: true, scale: true });
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  const P = tp(named(comp, 'Ball'), 'ADBE Position');
  assert.match(P.expression, /MOE Delay/);
  assert.equal(tp(named(comp, 'Ball'), 'ADBE Rotate Z').expression, '', 'rotation has no keys → untouched');
  const fx = named(comp, 'Ball').property('ADBE Effect Parade');
  assert.ok(['MOE Delay Stiffness', 'MOE Delay Damping', 'MOE Delay Leader', 'MOE Delay Order'].every((n) => fx._children.some((e) => e.name === n)));
  const pre = (tt) => P.valueAtTime(tt, true)[0];
  const ref = (tt) => D.simulate('spring', pre, tt, { fd: comp.frameDuration, stiffness: 140, damping: 9, frames: 3, order: 0 });
  const xs = [0.8, 0.9, 1.0, 1.2, 2.5].map((tt) => P.valueAtTime(tt, false)[0]);
  [0.8, 0.9, 1.0, 1.2, 2.5].forEach((tt, i) => assert.ok(Math.abs(xs[i] - ref(tt)) < 0.01, `t=${tt}: ${xs[i]} vs ${ref(tt)}`));
  assert.ok(Math.max(...[0.9, 1, 1.1, 1.2].map((tt) => P.valueAtTime(tt, false)[0])) > 500, 'springs past the target');
  assert.ok(Math.abs(xs[4] - 500) < 1, 'settles');
  await services.executor.restore(r.checkpointId);
  assert.equal(P.expression, '');
});

test('Delay: followers perform the leader\'s move, each one more delayed (Even 0 % = pure offset); Blend lags; Trash removes the rig', async () => {
  const D = require('../extension/features/kit/delay');
  const lead = TA({ pos: [100, 100] });
  lead[1] = Object.assign({}, lead[1], { keys: [{ time: 0, value: [100, 100] }, { time: 1, value: [300, 100] }] });
  const fx = studioComp([
    { name: 'Lead', selected: true, transform: lead, rect: { left: 0, top: 0, width: 10, height: 10 } },
    { name: 'F1', selected: true, transform: TA({ pos: [100, 200] }), rect: { left: 0, top: 0, width: 10, height: 10 } },
    { name: 'F2', selected: true, transform: TA({ pos: [100, 300] }), rect: { left: 0, top: 0, width: 10, height: 10 } }
  ]);
  const { services, comp } = await createTestServices(fx);
  let r = await services.executor.run('kit.delay', { mode: 'even', strength: 0, frames: 5, position: true, rotation: false, scale: false });
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  const fd = comp.frameDuration;
  const x = (n, tt) => tp(named(comp, n), 'ADBE Position').valueAtTime(tt, false);
  const lx = (tt) => tp(named(comp, 'Lead'), 'ADBE Position').valueAtTime(tt, false)[0];
  assert.ok(Math.abs(x('F1', 0.5)[0] - lx(0.5 - 5 * fd)) < 1e-6, 'F1 is 5 frames behind');
  assert.ok(Math.abs(x('F2', 0.5)[0] - lx(0.5 - 10 * fd)) < 1e-6, 'F2 is 10 frames behind');
  assert.equal(x('F2', 0.5)[1], 300, 'keeps its own place');
  assert.ok(named(comp, 'Lead').property('ADBE Effect Parade')._children.some((e) => e.name === 'MOE Delay Frames'), 'controls live on the leader');
  await services.executor.restore(r.checkpointId);
  r = await services.executor.run('kit.delay', { mode: 'blend', strength: 80, frames: 0, position: true, rotation: false, scale: false });
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  const ref = D.simulate('blend', (tt) => 100 + (lx(tt) - 100), 0.6, { fd, strength: 80, frames: 0, order: 1 });
  assert.ok(Math.abs(x('F1', 0.6)[0] - ref) < 0.01 && x('F1', 0.6)[0] < lx(0.6), 'lags behind the leader');
  select(comp, ['Lead', 'F1', 'F2']);
  r = await services.executor.run('kit.trash', {});
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  assert.equal(tp(named(comp, 'F1'), 'ADBE Position').expression, '');
  assert.equal(named(comp, 'Lead').property('ADBE Effect Parade').numProperties, 0);
});

test('Delay Even (C4D): a jump becomes an even ramp; Blend moves fast first then settles; old "offset" options still run', async () => {
  const D = require('../extension/features/kit/delay');
  const t = TA({ pos: [0, 0] });
  t[1] = Object.assign({}, t[1], { keys: [{ time: 1, value: [0, 0] }, { time: 1 + 1 / 25, value: [100, 0] }] });
  const { services, comp } = await createTestServices(studioComp([{ name: 'Box', selected: true, transform: t, rect: { left: 0, top: 0, width: 10, height: 10 } }]));
  const r = await services.executor.run('kit.delay', { mode: 'even', strength: 80, position: true, rotation: false, scale: false });
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  const fd = comp.frameDuration, P = tp(named(comp, 'Box'), 'ADBE Position');
  const n = D.evenWindow(0.8);
  assert.equal(n, 9, 'window: same average lag as Blend 80 %');
  const xs = []; for (let i = 0; i <= n + 1; i++) xs.push(P.valueAtTime(1 + 1 / 25 + i * fd, false)[0]);
  const steps = xs.slice(1, n).map((v, i) => v - xs[i]);
  assert.ok(steps.every((s) => Math.abs(s - steps[0]) < 1e-6) && steps[0] > 0, `even steps: ${steps}`);
  assert.ok(Math.abs(xs[xs.length - 1] - 100) < 1e-6, 'arrives');
  const pre = (tt) => P.valueAtTime(tt, true)[0];
  [1.1, 1.2, 1.3].forEach((tt) => assert.ok(Math.abs(P.valueAtTime(tt, false)[0] - D.simulate('even', pre, tt, { fd, strength: 80, frames: 3, order: 0 })) < 1e-6));
  // Blend: the first frame covers the biggest part of the gap (fast, then settles)
  const b = (k) => D.simulate('blend', pre, 1 + 1 / 25 + k * fd, { fd, strength: 80, frames: 0, order: 0 });
  assert.ok(b(1) - b(0) > b(2) - b(1) && b(2) - b(1) > b(3) - b(2), 'blend decelerates');
  // an option saved by 0.11 ("Offset") maps to Even instead of failing validation
  const v = require('../extension/core/schema').validateArgs(D.delay.params, { mode: 'offset' });
  assert.equal(v.value.mode, 'even');
});

test('Delay Field (C4D field): a null sets each layer\'s delay by distance; moving it sweeps the effect; Undo removes the created null', async () => {
  const D = require('../extension/features/kit/delay');
  const lead = TA({ pos: [100, 100] });
  lead[1] = Object.assign({}, lead[1], { keys: [{ time: 0, value: [100, 100] }, { time: 1, value: [300, 100] }] });
  const sq = { left: 0, top: 0, width: 10, height: 10 };
  const { services, comp } = await createTestServices(studioComp([
    { name: 'Lead', selected: true, transform: lead, rect: sq },
    { name: 'Near', selected: true, transform: TA({ pos: [960, 540] }), rect: sq },
    { name: 'Far', selected: true, transform: TA({ pos: [1900, 1060] }), rect: sq }
  ]));
  const before = comp.numLayers;
  const r = await services.executor.run('kit.delay', { mode: 'blend', strength: 80, frames: 0, field: true, position: true, rotation: false, scale: false });
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  assert.equal(comp.numLayers, before + 1);
  const F = named(comp, 'MOE Delay Field');
  assert.ok(F, 'field null created');
  const ffx = F.property('ADBE Effect Parade')._children.map((e) => e.name);
  assert.ok(['MOE Delay Field Radius', 'MOE Delay Field Falloff', 'MOE Delay Field Invert'].every((n) => ffx.includes(n)), ffx.join());
  // the leader's Layer Controls still point at the right layers after the null went on top
  const lead2 = named(comp, 'Lead');
  const ctl = (L, n) => L.property('ADBE Effect Parade')._children.find((e) => e.name === n);
  assert.equal(ctl(named(comp, 'Near'), 'MOE Delay Leader').property(1).value, lead2.index, 'leader index follows the shift');
  assert.equal(ctl(lead2, 'MOE Delay Field').property(1).value, F.index, 'field picked');
  const fd = comp.frameDuration, lx = (tt) => tp(lead2, 'ADBE Position').valueAtTime(tt, false)[0];
  const x = (n, tt) => tp(named(comp, n), 'ADBE Position').valueAtTime(tt, false)[0];
  // Near sits on the field (comp centre): full delay. Far is beyond radius + falloff: no delay at all.
  const full = D.simulate('blend', (tt) => 960 + (lx(tt) - 100), 0.5, { fd, strength: 80, frames: 0, order: 1 });
  assert.ok(Math.abs(x('Near', 0.5) - full) < 0.01, `near = full delay ${x('Near', 0.5)} vs ${full}`);
  assert.ok(Math.abs(x('Far', 0.5) - (1900 + lx(0.5) - 100)) < 1e-6, 'far = no delay');
  // a layer in the falloff gets a partial blend, exactly the pure weight
  const m = Math.min(comp.width, comp.height), d = Math.hypot(1900 - 960, 1060 - 540);
  assert.equal(D.fieldWeight(d, { radius: Math.round(m * 0.2), falloff: Math.round(m * 0.3) }), 0);
  assert.equal(D.fieldWeight(0, {}), 1);
  const wMid = D.fieldWeight(250, { radius: 200, falloff: 300 });
  assert.ok(wMid > 0 && wMid < 1 && Math.abs(D.fieldWeight(250, { radius: 200, falloff: 300, invert: true }) - (1 - wMid)) < 1e-12);
  assert.ok(Math.abs(D.fieldWeight(500, { radius: 200, falloff: 300, scale: 200 }) - D.fieldWeight(250, { radius: 200, falloff: 300 })) < 1e-12, 'scaling the null scales the field');
  // move the field onto Far: now Far is delayed and Near is not
  tp(F, 'ADBE Position').setValue([1900, 1060]);
  const farFull = D.simulate('blend', (tt) => 1900 + (lx(tt) - 100), 0.5, { fd, strength: 80, frames: 0, order: 2 });
  assert.ok(Math.abs(x('Far', 0.5) - farFull) < 0.01, 'field moved → far delayed');
  assert.ok(Math.abs(x('Near', 0.5) - (960 + lx(0.5) - 100)) < 1e-6, 'near no longer delayed');
  // run again: the field null is reused, not duplicated
  select(comp, ['Lead', 'Near', 'Far']);
  const r2 = await services.executor.run('kit.delay', { mode: 'spring', field: true, position: true, rotation: false, scale: false });
  assert.equal(r2.status, 'success', JSON.stringify(r2.verification));
  assert.equal(comp._layers.filter((l) => l.name === 'MOE Delay Field').length, 1);
  await services.executor.restore(r2.checkpointId);
  await services.executor.restore(r.checkpointId);
  assert.equal(comp.numLayers, before, 'created field null removed on restore');
  assert.equal(tp(named(comp, 'Near'), 'ADBE Position').expression, '');
});

test('Delay: refuses when nothing moves, with a clear reason', async () => {
  const { services } = await createTestServices(studioComp([{ name: 'Still', selected: true, transform: TA({ pos: [10, 10] }), rect: { left: 0, top: 0, width: 10, height: 10 } }]));
  const r = await services.executor.run('kit.delay', {});
  assert.notEqual(r.status, 'success');
  assert.match((r.errors || []).join(' '), /animate first/);
});

test('Ease Curve pass-through: with 3 keys the middle key keeps moving (speed of the line between its neighbours)', async () => {
  const { services, comp } = await createTestServices(studioComp([keyed('Ball')]));
  const P = tp(named(comp, 'Ball'), 'ADBE Position');
  let r = await services.executor.run('motion.easeCurve', { x1: 0.16, y1: 1, x2: 0.3, y2: 1, through: false });
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  assert.ok(Math.abs(P.keyInTemporalEase(2)[0].speed) < 1e-6, 'without pass-through the middle key stops');
  await services.executor.restore(r.checkpointId);
  r = await services.executor.run('motion.easeCurve', { x1: 0.16, y1: 1, x2: 0.3, y2: 1, through: true });
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  // keys: (100,100) @0.5 → (500,100) @1.5 → (500,400) @2.5 — line from key 1 to key 3: |(400,300)| / 2 s = 250 px/s
  assert.ok(Math.abs(P.keyInTemporalEase(2)[0].speed - 250) < 1e-6 && Math.abs(P.keyOutTemporalEase(2)[0].speed - 250) < 1e-6, `${P.keyInTemporalEase(2)[0].speed}`);
  assert.ok(Math.abs(P.keyOutTemporalEase(2)[0].influence - 16) < 0.01, 'influence still from the curve');
  assert.ok(Math.abs(P.keyInTemporalEase(3)[0].speed) < 1e-6, 'the last key still lands at rest');
});

test('Speed overview: real units over real time, the edited curve on every segment', () => {
  const KG = require('../extension/app/ui/views/kitGraph');
  const B = require('../extension/features/curves/bezier');
  const lin = B.normalize({ x1: 0.333, y1: 0.333, x2: 0.667, y2: 0.667 });
  const segs = [{ t0: 0, t1: 1, avg: 400, curve: lin }, { t0: 1, t1: 3, avg: 100, curve: lin }];
  const pts = KG.overviewSamples(segs, lin, true);
  assert.equal(pts[0].t, 0); assert.equal(pts[pts.length - 1].t, 3);
  assert.ok(pts.filter((p) => p.seg === 0).every((p) => Math.abs(p.v - 400) < 1), 'linear = constant 400 px/s');
  assert.ok(pts.filter((p) => p.seg === 1).every((p) => Math.abs(p.v - 100) < 1));
  assert.equal(KG.fmtSpeed(1250, 'px'), '1250 px/s');
  assert.equal(KG.fmtSpeed(12.345, '%'), '12.3 %/s');
});

test('kit graph: free drag (Motion 4) — zone decides what moves, relative to the press', () => {
  const KG = require('../extension/app/ui/views/kitGraph');
  assert.equal(KG.zoneAt(0.1), 'out');
  assert.equal(KG.zoneAt(0.5), 'both');
  assert.equal(KG.zoneAt(0.9), 'in');
  const c0 = { x1: 0.33, y1: 0, x2: 0.67, y2: 1 };
  // start zone: only the out handle moves
  const o = KG.freeDrag(c0, 'out', 0.2, 0.1, 'value');
  assert.ok(Math.abs(o.x1 - 0.53) < 1e-9 && Math.abs(o.y1 - 0.1) < 1e-9, JSON.stringify(o));
  assert.deepEqual([o.x2, o.y2], [0.67, 1]);
  // end zone: only the in handle moves; dragging up past 1 = overshoot
  const i = KG.freeDrag(c0, 'in', -0.2, 0.15, 'value');
  assert.ok(Math.abs(i.x2 - 0.47) < 1e-9 && Math.abs(i.y2 - 1.15) < 1e-9, JSON.stringify(i));
  assert.deepEqual([i.x1, i.y1], [0.33, 0]);
  // middle: drag right = both influences grow, mirrored (symmetric ease stays symmetric)
  const b = KG.freeDrag(c0, 'both', 0.2, 0, 'value');
  assert.ok(Math.abs(b.x1 - 0.53) < 1e-9 && Math.abs(b.x2 - 0.47) < 1e-9, JSON.stringify(b));
  assert.ok(Math.abs(b.x1 - (1 - b.x2)) < 1e-9, 'stays symmetric');
  // middle, drag up = overshoot at the end + anticipation at the start
  const bu = KG.freeDrag(c0, 'both', 0, 0.1, 'value');
  assert.ok(bu.y1 < 0 && bu.y2 > 1, JSON.stringify(bu));
  // influence stays inside the curve's legal range, however far the mouse goes
  const far = KG.freeDrag(c0, 'both', 5, 0, 'value');
  assert.ok(far.x1 > 0 && far.x1 <= 1 && far.x2 >= 0 && far.x2 < 1, JSON.stringify(far));
  // speed mode: drag up in the start zone raises the start speed; the end speed is untouched
  const s0 = KG.keySpeeds(c0);
  const sp = KG.freeDrag(c0, 'out', 0, 0.5, 'speed');
  const s1 = KG.keySpeeds(sp);
  assert.ok(Math.abs(s1.out - (s0.out + 0.5)) < 0.02, JSON.stringify([s0, s1]));
  assert.ok(Math.abs(s1.in - s0.in) < 0.02);
  // speed mode never goes below zero
  const neg = KG.keySpeeds(KG.freeDrag(c0, 'both', 0, -9, 'speed'));
  assert.ok(neg.out >= 0 && neg.in >= 0);
  assert.ok(KG.ZONE_HINT.value.both && KG.ZONE_HINT.speed.out);
});

test('kit graph v0.13: flip plays the ease backwards; Alt+wheel = 1 % influence per notch in the zone', () => {
  const KG = require('../extension/app/ui/views/kitGraph');
  const BZ = require('../extension/features/curves/bezier');
  const out = { x1: 0.16, y1: 1, x2: 0.3, y2: 1 };
  const f = KG.flipCurve(out);
  assert.deepEqual(f, { x1: 0.7, y1: 0, x2: 0.84, y2: 0 });
  [0.2, 0.5, 0.8].forEach((t) => assert.ok(Math.abs(BZ.valueAt(f, t) - (1 - BZ.valueAt(out, 1 - t))) < 1e-3, 'mirror in time'));
  assert.deepEqual(KG.flipCurve(f), out, 'flip twice = same');
  const c0 = { x1: 0.33, y1: 0, x2: 0.67, y2: 1 };
  const w = KG.wheelStep(c0, 'in', 3, false, 'value');
  assert.ok(Math.abs(w.x2 - 0.70) < 1e-9 && w.x1 === 0.33, JSON.stringify(w));
  const v = KG.wheelStep(c0, 'out', 2, true, 'value');
  assert.ok(Math.abs(v.y1 - 0.04) < 1e-9 && v.x1 === 0.33, JSON.stringify(v));
  const s = KG.keySpeeds(KG.wheelStep(c0, 'both', 4, true, 'speed'));
  assert.ok(Math.abs(s.out - 0.2) < 0.01 && Math.abs(s.in - 0.2) < 0.01, JSON.stringify(s));
});

test('Ease Curve per segment: segment 2 changes only keys 2 (out) and 3 (in); segment 1 then gets its own curve', async () => {
  const { services, comp } = await createTestServices(studioComp([keyed('Ball')]));
  const P = tp(named(comp, 'Ball'), 'ADBE Position');
  const before1 = P.keyOutTemporalEase(1)[0], before2in = P.keyInTemporalEase(2)[0];
  let r = await services.executor.run('motion.easeCurve', { x1: 0.16, y1: 1, x2: 0.3, y2: 1, segment: 2 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  assert.deepEqual(P.keyOutTemporalEase(1)[0], before1, 'segment 1 untouched (key 1 out)');
  assert.deepEqual(P.keyInTemporalEase(2)[0], before2in, 'segment 1 untouched (key 2 in)');
  assert.ok(Math.abs(P.keyOutTemporalEase(2)[0].influence - 16) < 0.01, 'segment 2 out = 16 %');
  assert.ok(Math.abs(P.keyInTemporalEase(3)[0].influence - 70) < 0.01, 'segment 2 in = 70 %');
  r = await services.executor.run('motion.easeCurve', { x1: 0.7, y1: 0, x2: 0.84, y2: 0, segment: 1 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  assert.ok(Math.abs(P.keyOutTemporalEase(1)[0].influence - 70) < 0.01 && Math.abs(P.keyOutTemporalEase(2)[0].influence - 16) < 0.01, 'two segments, two curves');
  // a segment that does not exist is refused with the reason
  r = await services.executor.run('motion.easeCurve', { x1: 0.3, y1: 0, x2: 0.7, y2: 1, segment: 5 });
  assert.notEqual(r.status, 'success');
  assert.match((r.errors || []).join(' '), /no segment 5/);
});

test('overview per segment: only the selected segment shows the edited curve; segmentAt maps time → segment', () => {
  const KG = require('../extension/app/ui/views/kitGraph');
  const lin = { x1: 0.333, y1: 0.333, x2: 0.667, y2: 0.667 }, out = { x1: 0.16, y1: 1, x2: 0.3, y2: 1 };
  const segs = [{ t0: 0, t1: 1, avg: 100, curve: lin }, { t0: 1, t1: 3, avg: 50, curve: lin }];
  const p2 = KG.overviewSamples(segs, out, 2);
  assert.ok(p2.filter((p) => p.seg === 0).every((p) => Math.abs(p.v - 100) < 1), 'segment 1 keeps its own (linear) curve');
  assert.ok(p2.filter((p) => p.seg === 1)[0].v > 200, 'segment 2 shows the edited ease-out (fast start)');
  const pAll = KG.overviewSamples(segs, out, 0);
  assert.ok(pAll.filter((p) => p.seg === 0)[0].v > 400, 'All: every segment shows the edited curve');
  assert.equal(KG.segmentAt(segs, 0.5), 1); assert.equal(KG.segmentAt(segs, 2.2), 2); assert.equal(KG.segmentAt(segs, 9), 2); assert.equal(KG.segmentAt(segs, -1), 1);
  const g = KG.ovGeom(216, segs); assert.equal(g.T(g.X(1.5)), 1.5);
});

test('selection kinds: every kind has a label and a pie set that resolves (Smart Home view removed in v0.29)', () => {
  const A = require('../extension/app/ui/actions');
  for (const k of ['keys', 'layer', 'layers', 'text', 'shapes', 'shapesMany', 'none']) {
    assert.ok(A.CONTEXT_LABEL[k]);
    assert.equal(new Set(A.SETS[k]).size, A.SETS[k].length, `${k}: no duplicates in the pie`);
    A.SETS[k].forEach((r) => assert.ok(A.resolve(r), `${k}: ${r} resolves`));
  }
  assert.equal(A.FOCUS, undefined);
  const ctx = (layers, keys) => ({ comp: { id: 1 }, layers, properties: keys ? [{ selectedKeys: [1, 2] }] : [] });
  assert.equal(A.profile(ctx([{ type: 'shape' }], true)), 'keys');
  assert.equal(A.profile(ctx([{ type: 'text' }, { type: 'text' }])), 'text');
  assert.equal(A.profile(ctx([{ type: 'av' }, { type: 'shape' }])), 'layers');
  assert.equal(A.profile(ctx([])), 'none');
});

test('Smart Home folds: focus open by default, others folded; what you open is remembered per kind; Fixed uses its own folds', () => {
  const { isFolded } = require('../extension/app/ui/views/kit');
  const keys = { ctx: 'keys', focus: ['ease', 'pinned'] }, layer = { ctx: 'layer', focus: ['anchorAlign', 'pinned'] };
  assert.equal(isFolded({}, keys, 'ease'), false);
  assert.equal(isFolded({}, keys, 'anchor'), true);
  assert.equal(isFolded({}, layer, 'anchor'), false, 'anchorAlign covers anchor');
  assert.equal(isFolded({}, layer, 'align'), false);
  assert.equal(isFolded({}, layer, 'ease'), true);
  const pr = { ctxOpen: { keys: { anchor: true } } };
  assert.equal(isFolded(pr, keys, 'anchor'), false, 'opened while on keys');
  assert.equal(isFolded(pr, layer, 'ease'), true, 'other kinds unaffected');
  assert.equal(isFolded({ ctxOpen: { keys: { ease: false } } }, keys, 'ease'), true, 'the focus can be folded too');
  assert.equal(isFolded({ fold: { ease: true } }, null, 'ease'), true, 'Fixed layout');
  assert.equal(isFolded({ fold: { ease: true } }, keys, 'ease'), false, 'Smart ignores Fixed folds');
});
