'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { TA } = require('./fixtures/layout');
const { studioComp } = require('./fixtures/studio');
const { toCompPt } = require('./mock/ae-expr');
const T = require('../extension/features/glass/thick');

const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;
const named = (comp, n) => comp._layers.find((l) => l.name === n);
const fx = (L, n) => L._parade._children.find((f) => f.name === n);
const param = (f, n) => f._children.find((p) => p.name === n);
const mapComp = (project, n) => project._items.find((c) => c._layers && c.name === n);

const scene = (extra = []) => studioComp([
  { name: 'Logo', selected: true, shapes: [{ name: 'Mark', fill: [0.9, 0.2, 0.1], path: [[-100, -60], [100, -60], [100, 60], [-100, 60]], closed: true }], transform: TA({ pos: [700, 420] }), rect: { left: -100, top: -60, width: 200, height: 120 } },
  ...extra,
  { name: 'Photo', source: { kind: 'image' }, transform: TA({ pos: [960, 540], anchor: [960, 540] }), rect: { left: 0, top: 0, width: 1920, height: 1080 } }
]);

test('Thick Glass: live map comp + matted CC Glass stack in the right order; controls drive every effect', async () => {
  const { services, comp, env: { project } } = await createTestServices(scene());
  const r = await services.executor.run('glass.thick', { look: 'glaze' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors, null, 1));
  assert.deepEqual(comp._layers.map((l) => l.name), ['MOE Glass 1 Highlights', 'MOE Glass 1 Reflect', 'MOE Glass 1 Prism B', 'MOE Glass 1 Prism R', 'MOE Glass 1', 'MOE Glass 1 Map', 'Logo', 'MOE Glass 1 Caustic', 'MOE Glass 1 Shadow', 'Photo']);
  const map = named(comp, 'MOE Glass 1 Map');
  const mc = mapComp(project, 'MOE Glass 1 Map');
  assert.ok(mc, 'map comp in the project');
  assert.equal(map.source, mc);
  assert.equal(map.enabled, false, 'map is hidden');
  assert.equal(named(comp, 'Logo').enabled, false, 'source hidden');
  assert.equal(mc.numLayers, 1);
  assert.deepEqual(Array.from(param(fx(mc.layer(1), 'MOE Glass Map Fill'), 'Color').value), [1, 1, 1, 1], 'map copy painted white');
  for (const n of ['MOE Glass 1', 'MOE Glass 1 Prism R', 'MOE Glass 1 Prism B', 'MOE Glass 1 Reflect', 'MOE Glass 1 Highlights']) assert.equal(named(comp, n).trackMatteLayer, map, `${n} matte`);
  assert.equal(named(comp, 'MOE Glass 1 Prism R').blendingMode, 5219, 'lighten');
  assert.equal(named(comp, 'MOE Glass 1 Highlights').blendingMode, 5222, 'screen');
  assert.equal(named(comp, 'MOE Glass 1 Caustic').blendingMode, 5220, 'add');
  // Every CC Glass reads the map (layer reference = its index).
  const g = named(comp, 'MOE Glass 1');
  for (const [L, k] of [[g, 'MOE Glass Refract'], [named(comp, 'MOE Glass 1 Reflect'), 'MOE Glass Warp'], [named(comp, 'MOE Glass 1 Highlights'), 'MOE Glass Studio Light']]) {
    assert.equal(param(fx(L, k), 'Bump Map').value, map.index, `${k} bump = map`);
  }
  // Controls → effects.
  const at = (L, f, p) => param(fx(L, f), p).valueAtTime(0, false);
  assert.equal(at(g, 'MOE Glass Refract', 'Displacement'), 80);
  assert.equal(at(g, 'MOE Glass Refract', 'Softness'), 18);
  param(fx(g, 'Glass Refraction'), 'Slider').setValue(140);
  param(fx(g, 'Glass Bevel'), 'Slider').setValue(250);
  assert.equal(at(g, 'MOE Glass Refract', 'Displacement'), 140);
  assert.equal(at(g, 'MOE Glass Refract', 'Softness'), 100, 'clamped to the effect range');
  const hl = named(comp, 'MOE Glass 1 Highlights');
  param(fx(g, 'Glass Light Angle'), 'Angle').setValue(30);
  assert.equal(at(hl, 'MOE Glass Studio Light', 'Light Direction'), 30);
  assert.equal(hl.property('ADBE Transform Group').property('ADBE Opacity').valueAtTime(0, false), 85);
});

test('Thick Glass: the map copy lands exactly on the source — parent, rotation, scale, flip and animation', async () => {
  const rig = { name: 'Rig', nullLayer: true, transform: TA({ pos: [900, 500], rot: 30 }) };
  const { services, comp, env: { project } } = await createTestServices(scene([rig]));
  const logo = named(comp, 'Logo');
  const R = named(comp, 'Rig');
  R.property('ADBE Transform Group').property('ADBE Scale').setValue([150, 150]);
  logo._parent = R;
  const tg = logo.property('ADBE Transform Group');
  tg.property('ADBE Anchor Point').setValue([20, -10]);
  tg.property('ADBE Scale').setValue([-60, 90]);
  tg.property('ADBE Rotate Z').setValue(-20);
  tg.property('ADBE Position').setValueAtTime(0, [-200, 40]);
  tg.property('ADBE Position').setValueAtTime(2, [180, -60]);
  const r = await services.executor.run('glass.thick', { look: 'prism', shadow: false, caustics: false });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors, null, 1));
  const copy = mapComp(project, 'MOE Glass 1 Map').layer(1);
  assert.equal(copy.parent, null, 'copy is not parented inside the map');
  for (const t of [0, 0.7, 2]) {
    for (const p of [[-100, -60], [100, -60], [100, 60], [0, 0], [37, -12]]) {
      const a = toCompPt(logo, p, t), b = toCompPt(copy, p, t);
      assert.ok(near(a[0], b[0], 1e-6) && near(a[1], b[1], 1e-6), `t=${t} ${p} → source ${a} vs map ${b}`);
    }
  }
  assert.equal(copy.property('ADBE Transform Group').property('ADBE Opacity').valueAtTime(0, false), 100);
});

test('Thick Glass: shape edits on the source reach the map live (path linked by index)', async () => {
  const { services, comp, env: { project } } = await createTestServices(scene());
  await services.executor.run('glass.thick', { look: 'glaze' });
  const src = named(comp, 'Logo');
  const copy = mapComp(project, 'MOE Glass 1 Map').layer(1);
  const path = (L) => L.property('ADBE Root Vectors Group').property(1).property('ADBE Vectors Group').property('ADBE Vector Shape - Group').property('ADBE Vector Shape');
  assert.match(path(copy).expression, /comp\("Studio"\)\.layer\("Logo"\)\("ADBE Root Vectors Group"\)\(1\)\(1\)\(1\)\(1\)/);
  const s = path(src).value; s.vertices[1] = [160, -90]; path(src).setValue(s);
  assert.deepEqual(path(copy).valueAtTime(0, false).vertices[1], [160, -90]);
  // Fill colour is not linked (the map is white either way).
  const fill = copy.property('ADBE Root Vectors Group').property(1).property('ADBE Vectors Group').property('ADBE Vector Graphic - Fill').property('ADBE Vector Fill Color');
  assert.equal(fill.expression, '');
});

test('Thick Glass: one glass for all — one map holds every source; Shadow 1 / 2', async () => {
  const two = scene([{ name: 'Word', selected: true, text: 'GLASS', transform: TA({ pos: [1200, 600] }) }]);
  const { services, comp, env: { project } } = await createTestServices(two);
  const r = await services.executor.run('glass.thick', { look: 'sugar', merge: true });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors, null, 1));
  assert.equal(r.result.setups.length, 1);
  const mc = mapComp(project, 'MOE Glass 1 Map');
  assert.equal(mc.numLayers, 2);
  assert.match(mc._layers.find((l) => l.name === 'Word').property('ADBE Text Properties').property('ADBE Text Document').expression, /layer\("Word"\)\("ADBE Text Properties"\)\(1\)/);
  for (const n of ['MOE Glass 1 Shadow 1', 'MOE Glass 1 Shadow 2', 'MOE Glass 1 Caustic 1', 'MOE Glass 1 Caustic 2']) assert.ok(named(comp, n), n);
  assert.ok(!named(comp, 'MOE Glass 2'));
  // Prism centre = centre of both sources' bounds.
  const pr = named(comp, 'MOE Glass 1 Prism R');
  const c = param(fx(pr, 'MOE Glass Prism'), 'Position').valueAtTime(0, false);
  assert.ok(near(c[0], (600 + 1300) / 2, 1e-6) && near(c[1], (360 + 630) / 2, 1e-6), String(c));
});

test('Thick Glass: dispersion scale and studio-light direction match the plain-JS reference', async () => {
  const { services, comp } = await createTestServices(scene());
  await services.executor.run('glass.thick', { look: 'prism' });
  const g = named(comp, 'MOE Glass 1');
  for (const d of [0, 40, 75, 140]) {
    param(fx(g, 'Glass Dispersion'), 'Slider').setValue(d);
    assert.ok(near(param(fx(named(comp, 'MOE Glass 1 Prism R'), 'MOE Glass Prism'), 'Scale Height').valueAtTime(0, false), T.prismScaleRef(d, 1)));
    assert.ok(near(param(fx(named(comp, 'MOE Glass 1 Prism B'), 'MOE Glass Prism'), 'Scale Width').valueAtTime(0, false), T.prismScaleRef(d, -1)));
    assert.equal(named(comp, 'MOE Glass 1 Prism R').property('ADBE Transform Group').property('ADBE Opacity').valueAtTime(0, false), d > 0 ? 100 : 0);
  }
  // Light from the top-left (-45°): the gradient's light end sits up-left of the centre.
  const ramp = fx(named(comp, 'MOE Glass 1 Reflect'), 'MOE Glass Studio');
  const s = param(ramp, 'Start of Ramp').valueAtTime(0, false), e = param(ramp, 'End of Ramp').valueAtTime(0, false);
  assert.ok(s[0] < 700 && s[1] < 420 && e[0] > 700 && e[1] > 420, `${s} → ${e}`);
  assert.ok(near((s[0] + e[0]) / 2, 700) && near((s[1] + e[1]) / 2, 420));
});

test('Thick Glass: restore removes every layer and the map comp, shows the source again', async () => {
  const { services, comp, env: { project } } = await createTestServices(scene());
  const before = project._items.length;
  const r = await services.executor.run('glass.thick', { look: 'chrome' });
  assert.equal(r.status, 'success');
  // v0.99.5: After Effects also keeps a SOLID in the project for every solid layer the map comp holds, so the
  // run adds its map comp AND those. What matters is that the map comp is there and that restore clears it all.
  assert.equal(project._items.filter((i) => /Map$/.test(i.name)).length, 1, 'the map comp is in the project');
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.deepEqual(comp._layers.map((l) => l.name), ['Logo', 'Photo']);
  assert.equal(named(comp, 'Logo').enabled, true);
  assert.equal(project._items.length, before, 'map comp removed');
});

test('Thick Glass: if an effect is missing nothing is left behind', async () => {
  const fixture = scene();
  fixture.comp.effectsOptions = { unavailable: ['CC Glass'] };
  const { services, comp, env: { project } } = await createTestServices(fixture);
  const before = project._items.length;
  const r = await services.executor.run('glass.thick', { look: 'glaze' });
  assert.notEqual(r.status, 'success');
  assert.deepEqual(comp._layers.map((l) => l.name), ['Logo', 'Photo']);
  assert.equal(named(comp, 'Logo').enabled, true);
  assert.equal(project._items.length, before);
});

test('Thick Glass Look switches only thick controls; flat Glass Look refuses a thick glass', async () => {
  const { services, comp } = await createTestServices(scene());
  await services.executor.run('glass.thick', { look: 'glaze' });
  comp._layers.forEach((l) => { l.selected = l.name === 'MOE Glass 1'; });
  const flat = await services.executor.run('glass.look', { look: 'frosted' });
  assert.notEqual(flat.status, 'success');
  const r = await services.executor.run('glass.thickLook', { look: 'gold' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const g = named(comp, 'MOE Glass 1');
  assert.equal(param(fx(g, 'Glass Reflection'), 'Slider').value, 92);
  assert.deepEqual(Array.from(param(fx(g, 'Glass Tint'), 'Color').value).map((x) => Math.round(x * 255)), [255, 199, 90, 255]);
});

test('Thick Glass refuses 3D layers', async () => {
  const { services } = await createTestServices(studioComp([
    { name: 'A', selected: true, threeD: true, transform: require('./fixtures/studio').T({ threeD: true }) },
    { name: 'BG', source: { kind: 'solid' } }
  ]));
  const r = await services.executor.run('glass.thick', {});
  assert.notEqual(r.status, 'success');
  assert.match(JSON.stringify(r), /2D layers/);
});

/**
 * v0.99.6 (Group 9 manual test, After Effects 26.5.3): every Thick Glass tile failed —
 *   looks/thick-glaze (glass.thick) — Unable to call "setValue" because of parameter 1.
 *                                     Value 12 out of range 0 to 0.5.
 * CC Glass's Roughness is 0.00099…0.5 (read from After Effects' own effect profile), while "Glass Highlight Size"
 * is a 0–100 control. Writing it straight through crashed the tool; clamping it would have pinned every look to
 * 0.5, the dullest highlight there is. It is a percentage of that range.
 */
test('v0.99.6: CC Glass Roughness is 0–0.5, and "Glass Highlight Size" is a percentage of it', async () => {
  assert.equal(T.ROUGHNESS_MAX, 0.5);
  assert.equal(T.roughnessAE(0), 0);
  assert.equal(T.roughnessAE(100), 0.5);
  assert.equal(T.roughnessAE(12), 0.06);
  assert.equal(T.roughnessAE(200), 0.5, 'clamped to the control, then scaled');

  const { services, comp } = await createTestServices(scene());
  const r = await services.executor.run('glass.thick', { look: 'glaze' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));

  const hl = comp._layers.find((l) => /Highlights$/.test(l.name));
  assert.ok(hl, 'the highlights layer exists');
  const cc = hl._parade._children.find((x) => x.name === 'MOE Glass Studio Light');
  const rough = cc.property('Roughness');
  assert.ok(rough.value > 0 && rough.value <= 0.5, `Roughness ${rough.value} must be inside CC Glass's own range`);
  assert.equal(rough.value, T.roughnessAE(T.BASE.roughness));

  // the expression that drives it afterwards is on the same scale, not 0–100
  assert.match(rough.expression || '', /Glass Highlight Size/);
  assert.match(rough.expression || '', /0\.005/, 'the 0–100 control is scaled onto 0–0.5');
});
