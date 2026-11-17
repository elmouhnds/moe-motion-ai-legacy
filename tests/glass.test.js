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

/**
 * v0.99.7 (controls on demand, CLAUDE.md v0.87): a glass built without its rim, tint and shadow carries only the
 * three sliders that drive the glass layer itself. Before this every run put all eleven on it, so a plain Clear
 * glass showed eight sliders that moved nothing. Glass Look then addresses the optional ones as optional, so it
 * applies to whatever the rig really has instead of failing on the first control that is not there.
 */
test('Glass Look: switches controls on an existing glass, and a lean glass carries only the controls it uses', async () => {
  const { services, comp } = await createTestServices(card());
  await services.executor.run('glass.apply', { look: 'clear', rim: false, shadow: false, tintLayer: false });
  const g = named(comp, 'MOE Glass 1');

  const controls = g._parade._children.map((e) => e.name).filter((n) => /^Glass /.test(n));
  assert.deepEqual(controls, ['Glass Frost', 'Glass Refraction', 'Glass Brightness'],
    'the parts are off, so their sliders are not written');

  comp._layers.forEach((l) => { l.selected = l.name === 'MOE Glass 1'; });
  const r = await services.executor.run('glass.look', { look: 'frosted', tint: '#FF0000' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.equal(fx(g, 'Glass Frost')._children[0].value, 22, 'the controls that are there still change');
  assert.equal(fx(g, 'Glass Tint'), undefined, 'and the ones that are not there are left alone, not an error');
  assert.match(r.verification.checks[0].detail, /not on this glass/);
  assert.equal(comp._layers.length, 3, 'simple glass: adjustment only');
});

test('Glass: with the parts on, every control is written and the look reaches the tint', async () => {
  const { services, comp } = await createTestServices(card());
  await services.executor.run('glass.apply', { look: 'clear', rim: true, shadow: true, tintLayer: true });
  const g = named(comp, 'MOE Glass 1');
  const controls = g._parade._children.map((e) => e.name).filter((n) => /^Glass /.test(n));
  assert.equal(controls.length, 11, `all eleven are written when every part is built: ${controls.join(', ')}`);

  comp._layers.forEach((l) => { l.selected = l.name === 'MOE Glass 1'; });
  const r = await services.executor.run('glass.look', { look: 'frosted', tint: '#FF0000' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.deepEqual(Array.from(fx(g, 'Glass Tint')._children[0].value), [1, 0, 0, 1]);
});
