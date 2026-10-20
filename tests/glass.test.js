'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { TA } = require('./fixtures/layout');
const { studioComp } = require('./fixtures/studio');

const near = (a, b, t = 0.01) => Math.abs(a - b) <= t;
const card = () => studioComp([
  { name: 'Card', selected: true, shapes: [{ name: 'Rect', fill: [1, 1, 1] }], transform: TA({ pos: [700, 400] }), rect: { left: -200, top: -120, width: 400, height: 240 } },
  { name: 'Photo', source: { kind: 'image' }, transform: TA({ pos: [960, 540], anchor: [960, 540] }), rect: { left: 0, top: 0, width: 1920, height: 1080 } }
]);
const named = (comp, n) => comp._layers.find((l) => l.name === n);
const fx = (L, n) => L._parade._children.find((f) => f.name === n);

test('Glass: adjustment matted to the source + linked tint/rim/shadow; controls drive the effects; restore', async () => {
  const { services, comp } = await createTestServices(card());
  const r = await services.executor.run('glass.apply', { look: 'liquid' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors, null, 1));
  const order = comp._layers.map((l) => l.name);
  assert.deepEqual(order.slice(0, 5), ['MOE Glass 1 Rim', 'MOE Glass 1 Tint', 'MOE Glass 1', 'Card', 'MOE Glass 1 Shadow']);
  const g = named(comp, 'MOE Glass 1');
  assert.ok(g.adjustmentLayer);
  assert.equal(g.trackMatteLayer, named(comp, 'Card'));
  assert.equal(named(comp, 'Card').enabled, false, 'source hidden, used as matte');
  const rim = named(comp, 'MOE Glass 1 Rim');
  assert.equal(rim.parent, named(comp, 'Card'));
  assert.equal(rim.blendingMode, 5224, 'overlay');
  // Lens centre follows the source; refraction comes from the control.
  assert.deepEqual(Array.from(fx(g, 'MOE Glass Lens')._children[3].valueAtTime(0, false)), [700, 400]);
  assert.equal(fx(g, 'MOE Glass Lens')._children[0].valueAtTime(0, false), 60);
  // Change a control → effect follows.
  fx(g, 'Glass Frost')._children[0].setValue(33);
  assert.equal(fx(g, 'MOE Glass Frost')._children[0].valueAtTime(0, false), 33);
  // Shadow offset from the light angle.
  const sh = named(comp, 'MOE Glass 1 Shadow').property('ADBE Transform Group').property('ADBE Position').valueAtTime(0, false);
  assert.ok(near(Math.hypot(sh[0], sh[1]), 18, 1e-6));
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.deepEqual(comp._layers.map((l) => l.name), ['Card', 'Photo']);
  assert.equal(named(comp, 'Card').enabled, true);
});

test('Glass Look: switches controls on an existing glass', async () => {
  const { services, comp } = await createTestServices(card());
  await services.executor.run('glass.apply', { look: 'clear', rim: false, shadow: false, tintLayer: false });
  comp._layers.forEach((l) => { l.selected = l.name === 'MOE Glass 1'; });
  const r = await services.executor.run('glass.look', { look: 'frosted', tint: '#FF0000' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const g = named(comp, 'MOE Glass 1');
  assert.equal(fx(g, 'Glass Frost')._children[0].value, 22);
  assert.deepEqual(Array.from(fx(g, 'Glass Tint')._children[0].value), [1, 0, 0, 1]);
  assert.equal(comp._layers.length, 3, 'simple glass: adjustment only');
});
