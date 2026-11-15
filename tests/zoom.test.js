'use strict';
const FG = require('../extension/core/framegrid'); // v0.61: keys are written on the comp's frame grid
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { TA } = require('./fixtures/layout');
const { studioComp } = require('./fixtures/studio');
const Z = require('../extension/features/zoom/math');

const near = (a, b, t = 0.01) => Math.abs(a - b) <= t;
const rec = () => studioComp([
  { name: 'Button', selected: true, transform: TA({ pos: [1600, 200] }), rect: { left: -60, top: -20, width: 120, height: 40 } },
  { name: 'Recording', source: { kind: 'video' }, transform: TA({ pos: [960, 540], anchor: [960, 540] }), rect: { left: 0, top: 0, width: 1920, height: 1080 } }
], { comp: { time: 2 } });
const fxOf = (comp) => comp._layers.find((l) => l.name === 'MOE Zoom')._parade._children.find((f) => f.name === 'MOE Zoom');

test('Zoom maths: centre mode clamps so the frame stays covered; in-place keeps the point', () => {
  const f = Z.frame([1900, 20], 2, 1920, 1080);
  assert.deepEqual(f.anchor, [1440, 270]);
  const v = Z.visibleRect(f, 1920, 1080);
  assert.deepEqual(v.map(Math.round), [960, 0, 1920, 540]);
  const ip = Z.frame([300, 300], 3, 1920, 1080, 'inPlace');
  const vi = Z.visibleRect(ip, 1920, 1080);
  assert.ok(vi[0] >= 0 && vi[1] >= 0 && vi[2] <= 1920 && vi[3] <= 1080);
  const p = Z.plan([500, 500], 2, 1920, 1080, { t: 3, inDur: 0.5, hold: 1, outDur: 0.5, zoomOut: true, endAtPlayhead: true, ease: 'snappy' });
  assert.deepEqual(p.keys.map((k) => k.t), [1, 1.5, 2.5, 3]);
  assert.equal(p.keys[0].easeOut.influence, 12);
});

test('Focus Zoom on the selected layer: rig + Transform effect + keys; read-back at zoom-in; restore removes the rig', async () => {
  const { services, comp } = await createTestServices(rec());
  const r = await services.executor.run('zoom.focus', { target: 'layer', level: 200, spotlight: 50 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors, null, 1));
  const rig = comp._layers.find((l) => l.name === 'MOE Zoom');
  assert.ok(rig.adjustmentLayer);
  const fx = fxOf(comp);
  assert.equal(fx._children[9].value, 0, 'own shutter angle');
  assert.equal(fx._children[10].value, 180, 'motion blur');
  const scale = fx._children[3];
  assert.equal(scale.numKeys, 4);
  assert.ok(near(scale.valueAtTime(2.6, false), 200));
  assert.deepEqual(Array.from(fx._children[0].valueAtTime(2.6, false)).map(Math.round), [1440, 270], 'clamped near the top-right');
  assert.ok(comp._layers.some((l) => /^MOE Spotlight/.test(l.name)));
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.equal(comp._layers.some((l) => /^MOE (Zoom|Spotlight)/.test(l.name)), false);
});

test('Focus Zoom chains: a second zoom starts from the rig state (pan), restore removes only its keys', async () => {
  const { services, comp } = await createTestServices(rec());
  const a = await services.executor.run('zoom.focus', { target: 'point', x: 25, y: 50, level: 200, zoomOut: false });
  assert.equal(a.status, 'success', JSON.stringify(a.verification || a.errors));
  comp.time = 4;
  services.executor.invalidateContext && services.executor.invalidateContext();
  const b = await services.executor.run('zoom.focus', { target: 'point', x: 75, y: 50, level: 200, zoomOut: false });
  assert.equal(b.status, 'success', JSON.stringify(b.verification || b.errors));
  const anchor = fxOf(comp)._children[0];
  assert.equal(anchor.numKeys, 4);
  assert.ok(near(anchor.valueAtTime(4, false)[0], 480), 'second move starts where the first ended');
  assert.ok((await services.executor.restore(b.checkpointId)).ok);
  assert.equal(anchor.numKeys, 2);
});

test('Follow Zoom: anchor expression follows the target and is clamped', async () => {
  const { services, comp } = await createTestServices(rec());
  const r = await services.executor.run('zoom.follow', { layer: 1, level: 200, smoothing: 0 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const v = fxOf(comp)._children[0].valueAtTime(2, false);
  assert.deepEqual(Array.from(v).map(Math.round), [1440, 270]);
});

test('Cursor Animator: cursor layer with travel/hold, pulse and ripple from a keyed null', async () => {
  const fx = rec();
  fx.comp.layers[0] = { name: 'Clicks', selected: true, nullLayer: true, transform: TA({ pos: [0, 0] }) };
  fx.comp.layers[0].transform[1] = Object.assign({}, fx.comp.layers[0].transform[1], { keys: [{ time: 1, value: [200, 200] }, { time: 3, value: [900, 600] }] });
  const { services, comp } = await createTestServices(fx);
  const r = await services.executor.run('zoom.cursor', { kind: 'hand', color: '#FFFFFF' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors, null, 1));
  const cur = comp._layers.find((l) => /^MOE Cursor/.test(l.name));
  const pos = cur.property('ADBE Transform Group').property('ADBE Position');
  assert.deepEqual(pos._keys.map((k) => +k.t.toFixed(2)), [1, FG.snap(2.55, 1 / 25), 3]);
  assert.deepEqual(Array.from(pos.valueAtTime(2, false)), [200, 200], 'holds at the first click');
  const ring = cur.property('ADBE Root Vectors Group').property(1);
  assert.equal(ring.name, 'Click Ring');
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.equal(comp._layers.some((l) => /^MOE Cursor/.test(l.name)), false);
});

test('v0.99.1: the zoom keys go to Scale Height (-0003) — the scale Uniform Scale drives; Scale Width (-0004) stays untouched', async () => {
  const { services, comp } = await createTestServices(rec());
  const r = await services.executor.run('zoom.focus', { target: 'layer', level: 200, spotlight: 50 });
  assert.equal(r.status, 'success', JSON.stringify(r.errors || r.verification));
  const f = fxOf(comp);
  const height = f._children.find((p) => p.matchName === 'ADBE Geometry2-0003'), width = f._children.find((p) => p.matchName === 'ADBE Geometry2-0004');
  assert.equal(height.name, 'Scale Height');
  assert.ok(height.numKeys >= 2, 'Scale Height is keyed');
  assert.equal(width.numKeys, 0, 'Scale Width is not keyed');
  assert.equal(f._children.find((p) => p.matchName === 'ADBE Geometry2-0011').value, 1, 'Uniform Scale on');
});
