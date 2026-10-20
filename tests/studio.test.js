'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTestServices } = require('./helpers/harness');
const { T, studioComp } = require('./fixtures/studio');
const ffx = require('../extension/features/text/ffx');
const { PRESETS, buildSpec } = require('../extension/features/text/presets');
const preview = require('../extension/features/text/preview');
const X = require('../extension/features/proximity/expressions');
const M = require('../extension/features/select/matcher');
const B = require('../extension/features/brand/brands');

const FFX = path.join(__dirname, 'fixtures/ffx');
const near = (a, b, t = 1e-3) => Math.abs(a - b) <= t;
const brand = { name: 'Nile Bank', colors: [{ name: 'Nile Blue', hex: '#0A4D8C' }, { name: 'Gold', hex: '#D4A017' }], fonts: { arabic: { ps: 'Cairo-Bold', family: 'Cairo', style: 'Bold' }, english: { ps: 'Montserrat-Bold', family: 'Montserrat', style: 'Bold' }, extra: [] } };
const doc = (layer) => layer.property('ADBE Text Properties').property('ADBE Text Document').value;
const A = (v) => Array.from(v);

/* ------------------------------ Brand Kit ------------------------------ */

test('Brand store: create, validate, update, export/import, delete', async () => {
  const { services } = await createTestServices(studioComp([]));
  assert.equal(services.brands.save({ name: '', colors: [{ hex: 'nope' }] }).ok, false);
  const r = services.brands.save(brand);
  assert.ok(r.ok);
  assert.equal(r.brand.colors[0].hex, '#0A4D8C');
  services.brands.save(Object.assign({}, r.brand, { name: 'Nile Bank EG' }));
  assert.equal(services.brands.list().length, 1);
  const json = services.brands.exportJSON();
  services.brands.remove(r.brand.id);
  assert.equal(services.brands.list().length, 0);
  assert.equal(services.brands.importJSON(json).imported, 1);
  assert.equal(services.brands.get(r.brand.id).name, 'Nile Bank EG');
});

test('Brand colour → text fill, shape fill + stroke, solid via MOE Brand Fill (solid source untouched); restore', async () => {
  const { services, comp } = await createTestServices(studioComp([
    { name: 'Title', selected: true, text: 'Hello', transform: T() },
    { name: 'Badge', selected: true, shapes: [{ name: 'Circle', fill: [1, 0, 0], stroke: [0, 0, 0] }], transform: T() },
    { name: 'BG', selected: true, source: { kind: 'solid', color: [0.2, 0.2, 0.2] }, transform: T() }
  ]));
  const id = services.brands.save(brand).brand.id;
  const r = await services.executor.run('brand.applyColor', { brandId: id, colorIndex: 1, target: 'both' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const gold = B.hexToRgb('#D4A017');
  doc(comp.layer(1)).fillColor.forEach((v, i) => assert.ok(near(v, gold[i])));
  doc(comp.layer(1)).strokeColor.forEach((v, i) => assert.ok(near(v, gold[i])));
  const contents = comp.layer(2).property('ADBE Root Vectors Group').property(1).property(1);
  assert.ok(near(contents.property(1).property(1).value[0], gold[0]));
  assert.ok(near(contents.property(2).property(1).value[0], gold[0]));
  assert.deepEqual(A(comp.layer(3).source.mainSource.color), [0.2, 0.2, 0.2], 'shared solid colour untouched');
  assert.equal(comp.layer(3)._parade._children[0].name, 'MOE Brand Fill');
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.deepEqual(A(doc(comp.layer(1)).fillColor), [1, 1, 1]);
  assert.equal(doc(comp.layer(1)).applyStroke, false);
  assert.equal(contents.property(1).property(1).value[0], 1);
  assert.equal(comp.layer(3)._parade._children.length, 0);
});

test('Brand colour → selected COLOR property wins over layer targets', async () => {
  const { services, comp } = await createTestServices(studioComp([
    { name: 'Glow', selected: true, transform: [{ name: 'Color', matchName: 'ADBE Color', valueType: 'COLOR', value: [1, 1, 1, 1], selected: true, keys: [] }] }
  ]));
  const id = services.brands.save(brand).brand.id;
  const r = await services.executor.run('brand.applyColor', { brandId: id, colorIndex: 0, target: 'fill' });
  assert.equal(r.status, 'success');
  assert.ok(near(comp.layer(1).property(1).property(1).value[2], B.hexToRgb('#0A4D8C')[2]));
  assert.equal(comp.layer(1)._parade._children.length, 0, 'no fill effect when a colour property is selected');
});

test('Brand font auto: Arabic text → Arabic font + RTL; English → English font; keyframed Source Text at CTI; missing font refused', async () => {
  const { services, comp } = await createTestServices(studioComp([
    { name: 'AR', selected: true, text: 'مرحبا بكم', transform: T() },
    { name: 'EN', selected: true, text: 'Welcome', transform: T() },
    { name: 'KEYED', selected: true, text: 'Price', textKeys: [0, 2], transform: T() }
  ]));
  const id = services.brands.save(brand).brand.id;
  const r = await services.executor.run('brand.applyFont', { brandId: id, role: 'auto' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.equal(doc(comp.layer(1)).font, 'Cairo-Bold');
  assert.equal(doc(comp.layer(1)).direction, 2);
  assert.equal(doc(comp.layer(2)).font, 'Montserrat-Bold');
  assert.equal(doc(comp.layer(2)).direction, 1);
  assert.ok(r.verification.checks.some((c) => /keyframed/.test(c.detail)));
  await services.executor.restore(r.checkpointId);
  assert.equal(doc(comp.layer(1)).font, 'ArialMT');
  const bad = services.brands.save(Object.assign({}, brand, { name: 'Ghost', fonts: { english: { ps: 'NotInstalled-Black' } } })).brand.id;
  const r2 = await services.executor.run('brand.applyFont', { brandId: bad, role: 'english' });
  assert.equal(r2.status, 'failed');
  assert.match(r2.errors[0], /Font not installed/);
});

test('Palette extraction (k-means) and fonts.list with Arabic detection', async () => {
  const { services } = await createTestServices(studioComp([{ name: 'Logo', selected: true, pixels: (u) => (u < 0.5 ? [0.04, 0.3, 0.55, 1] : [0.83, 0.63, 0.09, 1]), transform: T() }]));
  const r = await services.executor.run('brand.extractPalette', { count: 3 });
  assert.equal(r.status, 'success');
  assert.ok(r.result.colors.includes('#0A4D8C') || r.result.colors.some((h) => Math.abs(parseInt(h.slice(1, 3), 16) - 10) < 8));
  const fonts = await services.host.call('fonts.list', {});
  assert.equal(fonts.fonts.find((f) => f.ps === 'Cairo-Bold').arabic, true);
  assert.equal(fonts.fonts.find((f) => f.ps === 'ArialMT').arabic, false);
});

/* --------------------------- Text animations --------------------------- */

test('FFX parser reads all four owner presets exactly', () => {
  const read = (n) => ffx.toPreset(ffx.parse(fs.readFileSync(path.join(FFX, n))), {});
  const down = read('Animation_IN_Downm.ffx');
  assert.equal(down.animatorName, 'IN');
  assert.deepEqual(down.props, { position: [0, -100, 0], opacity: 0, blur: [16, 16] });
  assert.equal(down.basedOn, 3); assert.equal(down.shape, 2); assert.equal(down.easeHigh, 25); assert.equal(down.easeLow, 100);
  assert.equal(down.duration, 1.733);
  assert.ok(near(down.ease.last[1], 16.667, 0.01));
  assert.deepEqual(read('Animation_IN_UP.ffx').props.position, [0, 88, 0]);
  assert.deepEqual(read('Animation_IN_Right.ffx').props.position, [-100, 0, 0]);
  const out = read('Animation_Out_Down.ffx');
  assert.equal(out.kind, 'out'); assert.equal(out.shape, 3); assert.equal(out.animatorName, 'OUT'); assert.equal(out.duration, 1.167);
  assert.throws(() => ffx.parse(Buffer.from('not a preset')), /Not an After Effects preset/);
});

test('Built-in Signature presets match the decoded owner files', () => {
  for (const [id, file] of [['moe-in-down', 'Animation_IN_Downm.ffx'], ['moe-in-up', 'Animation_IN_UP.ffx'], ['moe-in-right', 'Animation_IN_Right.ffx'], ['moe-out-down', 'Animation_Out_Down.ffx']]) {
    const mine = PRESETS.find((p) => p.id === id);
    const theirs = ffx.toPreset(ffx.parse(fs.readFileSync(path.join(FFX, file))), {});
    for (const k of ['kind', 'basedOn', 'shape', 'easeHigh', 'easeLow', 'smoothness', 'duration']) assert.equal(mine[k], theirs[k], `${id}.${k}`);
    assert.deepEqual(mine.props, theirs.props, id);
    mine.ease.first.concat(mine.ease.last).forEach((v, i) => assert.ok(near(v, theirs.ease.first.concat(theirs.ease.last)[i], 0.01), `${id} ease ${i}`));
  }
});

test('Animate Text builds the animator at CTI; Out ends at layer out point; re-apply replaces; restore removes', async () => {
  const { services, comp } = await createTestServices(studioComp([{ name: 'Title', selected: true, text: 'Motion Design Studio', outPoint: 8, transform: T() }]));
  const r = await services.executor.run('text.animate', { presetId: 'moe-in-down' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const anims = comp.layer(1).property('ADBE Text Properties').property('ADBE Text Animators');
  const a = anims.property(1);
  assert.equal(a.name, 'MOE In');
  const sel = a.property('ADBE Text Selectors').property(1);
  const adv = sel.property('ADBE Text Range Advanced');
  assert.equal(adv.property('ADBE Text Range Type2').value, 3);
  assert.equal(adv.property('ADBE Text Range Shape').value, 2);
  assert.equal(adv.property('ADBE Text Levels Max Ease').value, 25);
  const off = sel.property('ADBE Text Percent Offset');
  assert.equal(off.numKeys, 2);
  assert.ok(near(off.keyTime(1), 1) && near(off.keyTime(2), 1 + 1.733));
  assert.equal(off.keyOutTemporalEase(2)[0].influence.toFixed(2), '16.67');
  const props = a.property('ADBE Text Animator Properties');
  assert.deepEqual(A(props.property('ADBE Text Position 3D').value), [0, -100, 0]);
  assert.equal(props.property('ADBE Text Opacity').value, 0);
  const o = await services.executor.run('text.animate', { presetId: 'moe-out-down' });
  assert.equal(o.status, 'success');
  const outOff = anims.property(2).property('ADBE Text Selectors').property(1).property('ADBE Text Percent Offset');
  assert.ok(near(outOff.keyTime(2), 8, 0.041), `out ends at ${outOff.keyTime(2)}`);
  await services.executor.run('text.animate', { presetId: 'rise-soft' });
  assert.equal(anims.numProperties, 2, 'MOE In replaced, not stacked');
  await services.executor.restore(o.checkpointId);
  assert.deepEqual([...Array(anims.numProperties)].map((_, i) => anims.property(i + 1).name), ['MOE In']);
});

test('Arabic text: character presets switch to Words; distance & direction controls', async () => {
  const { services, comp } = await createTestServices(studioComp([{ name: 'AR', selected: true, text: 'تصميم الحركة', transform: T() }]));
  const r = await services.executor.run('text.animate', { presetId: 'char-fade' });
  assert.ok(r.preview.items.some((i) => /Arabic text: switched to Words/.test(i)));
  const adv = comp.layer(1).property('ADBE Text Properties').property('ADBE Text Animators').property(1).property('ADBE Text Selectors').property(1).property('ADBE Text Range Advanced');
  assert.equal(adv.property('ADBE Text Range Type2').value, 3);
  const spec = buildSpec(PRESETS.find((p) => p.id === 'moe-in-down'), { distance: 50, direction: 'right' });
  assert.deepEqual(spec.props.find((p) => p.matchName === 'ADBE Text Position 3D').value, [-50, 0, 0]);
});

test('Imported .ffx: stored in the library, previewable, applied via applyPreset to exactly the selected text layers', async () => {
  const { services, comp } = await createTestServices(studioComp([
    { name: 'T1', selected: true, text: 'One', transform: T() }, { name: 'Shape', selected: true, shapes: [], transform: T() }
  ]));
  const bytes = new Uint8Array(fs.readFileSync(path.join(FFX, 'Animation_IN_UP.ffx')));
  const imp = services.textLibrary.importFfx('Animation_IN_UP.ffx', bytes);
  assert.ok(imp.ok);
  assert.equal(imp.preset.previewOnly, false);
  assert.equal(services.textLibrary.all().filter((p) => p.source === 'ffx').length, 1);
  const r = await services.executor.run('text.animate', { presetId: imp.preset.id });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.deepEqual(comp._appliedPresets[0].layers, ['T1'], 'only the text layer was selected during applyPreset');
  assert.deepEqual(comp._layers.filter((l) => l.selected).map((l) => l.name), ['T1', 'Shape'], 'selection restored');
});

test('Preview engine: hidden at start, revealed at end, words reveal in order', () => {
  const spec = buildSpec(PRESETS.find((p) => p.id === 'moe-in-down'));
  const start = preview.frame(spec, 'one two three', 0).filter((u) => !u.space);
  const mid = preview.frame(spec, 'one two three', spec.duration * 0.5).filter((u) => !u.space);
  const end = preview.frame(spec, 'one two three', spec.duration + 0.1).filter((u) => !u.space);
  assert.ok(start.every((u) => u.amount > 0.99));
  assert.ok(end.every((u) => u.amount < 0.01));
  assert.ok(mid[0].amount <= mid[2].amount, 'first word reveals first');
  const out = buildSpec(PRESETS.find((p) => p.id === 'moe-out-down'));
  assert.ok(preview.frame(out, 'a b', 0).filter((u) => !u.space).every((u) => u.amount < 0.01));
  assert.ok(preview.frame(out, 'a b', out.duration).filter((u) => !u.space).every((u) => u.amount > 0.99));
});

/* ------------------------------ Proximity ------------------------------ */

test('Proximity: effector + controls created, combined expressions per property, engine-valid, restore removes everything', async () => {
  const { services, comp } = await createTestServices(studioComp([
    { name: 'Dot 1', selected: true, transform: T({ pos: [400, 300] }) },
    { name: 'Dot 2', selected: true, transform: T({ pos: [800, 300] }) }
  ]));
  const r = await services.executor.run('proximity.apply', { scaleUp: true, pushAway: true, positionY: true, fadeOpacity: true, blur: true, radius: 600 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const eff = comp._layers.find((l) => l.name === 'MOE Effector 1');
  assert.ok(eff && eff.nullLayer);
  const fxNames = eff._parade._children.map((e) => e.name);
  assert.deepEqual(fxNames, X.CONTROLS.map((c) => c[0]));
  assert.equal(eff._parade._children[0].property(1).value, 600);
  const dot = comp._layers.find((l) => l.name === 'Dot 1');
  const tr = dot.property('ADBE Transform Group');
  for (const mn of ['ADBE Scale', 'ADBE Position', 'ADBE Opacity']) assert.ok(tr.property(mn).expression.startsWith(X.TAG), mn);
  assert.ok(!/\bvalue \+ |\bvalue \* k/.test(tr.property('ADBE Position').expression), 'no array operators (JS engine)');
  assert.match(tr.property('ADBE Position').expression, /Push Amount[\s\S]*Offset Y/);
  assert.equal(dot._parade._children[0].name, 'MOE Prox Blur');
  assert.ok(dot._parade._children[0].property(1).expression.startsWith(X.TAG));
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.equal(tr.property('ADBE Scale').expression, '');
  assert.equal(dot._parade._children.length, 0);
  assert.ok(!comp._layers.some((l) => l.name === 'MOE Effector 1'), 'created effector removed');
});

test('Proximity: reuses a selected effector, protects user expressions, rejects contradictory features, 3D-only features skipped on 2D', async () => {
  const { services, comp } = await createTestServices(studioComp([
    { name: 'MOE Effector 1', selected: true, nullLayer: true, transform: T() },
    { name: 'Card', selected: true, transform: T().map((p) => (p.matchName === 'ADBE Scale' ? Object.assign({}, p, { expression: 'value * 1.1' }) : p)) },
    { name: 'Flat', selected: true, transform: T() }
  ]));
  let r = await services.executor.run('proximity.apply', { scaleUp: true, scaleDown: true });
  assert.equal(r.status, 'blocked');
  assert.match(r.errors[0], /cannot be combined/);
  r = await services.executor.run('proximity.apply', { scaleUp: true });
  assert.equal(r.status, 'failed');
  assert.match(r.errors[0], /already have your own expressions: Card › scale/);
  assert.equal(comp._layers.filter((l) => /MOE Effector/.test(l.name)).length, 1, 'no second effector');
  r = await services.executor.run('proximity.apply', { scaleUp: false, rotationX: true, positionZ: true, rotationZ: true });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.ok(r.verification.checks.some((c) => /Position Z, Rotation X \(2D layer\)/.test(c.detail)));
  const card = comp._layers.find((l) => l.name === 'Card');
  assert.equal(card.property('ADBE Transform Group').property('ADBE Scale').expression, 'value * 1.1', 'user expression kept');
});

test('Proximity remove (selected / all) and Center Anchor keeps the layer in place', async () => {
  const { services, comp } = await createTestServices(studioComp([
    { name: 'A', selected: true, rect: { left: 0, top: 0, width: 200, height: 100 }, transform: T({ pos: [500, 500], rot: 90 }) },
    { name: 'B', selected: true, transform: T() }
  ]));
  await services.executor.run('proximity.apply', { scaleUp: true, blur: true });
  const rm = await services.executor.run('proximity.remove', { scope: 'all' });
  assert.equal(rm.status, 'success', JSON.stringify(rm.verification || rm.errors));
  const a = comp._layers.find((l) => l.name === 'A');
  assert.equal(a.property('ADBE Transform Group').property('ADBE Scale').expression, '');
  assert.equal(a._parade._children.length, 0);
  const ca = await services.executor.run('proximity.centerAnchor', {});
  assert.equal(ca.status, 'success');
  const tr = a.property('ADBE Transform Group');
  assert.deepEqual(A(tr.property('ADBE Anchor Point').value), [100, 50]);
  // rotation 90°: anchor delta (100, 50) maps to position delta (−50, 100)
  assert.ok(near(tr.property('ADBE Position').value[0], 450) && near(tr.property('ADBE Position').value[1], 600));
  await services.executor.restore(ca.checkpointId);
  assert.deepEqual(A(tr.property('ADBE Position').value), [500, 500]);
});

/* -------------------------------- Select ------------------------------- */

function selectFixture() {
  return studioComp([
    { name: 'Title EN', text: 'Hello', label: 9, transform: T() },
    { name: 'Title AR', text: 'مرحبا', label: 9, locked: true, transform: T() },
    { name: 'Logo', shapes: [], label: 2, transform: T(), effects: [{ matchName: 'ADBE Gaussian Blur 2' }] },
    { name: 'BG plate', source: { kind: 'image', name: 'plate.png', file: 'plate.png' }, sourceId: 777, transform: T() },
    { name: 'BG plate copy', source: { kind: 'image', name: 'plate.png', file: 'plate.png' }, sourceId: 777, transform: T() },
    { name: 'Music', source: { kind: 'audio', name: 'track.wav', file: 'track.wav' }, transform: T() },
    { name: 'Ctrl', nullLayer: true, shy: true, inPoint: 5, outPoint: 9, transform: T() },
    { name: 'Cam', camera: true }
  ], { otherComps: [{ name: 'Other', layers: [{ name: 'Other Title', text: 'x', transform: T() }], projectSelected: true }], comp: { projectSelected: true } });
}

test('Select: types, filters, modes, search, same-as, labels, invert, history', async () => {
  const { services, comp } = await createTestServices(selectFixture());
  const sel = services.selector;
  const names = () => comp._layers.filter((l) => l.selected).map((l) => l.name);
  let snap = await sel.load('active');
  const c = M.counts(snap.layers, {}, sel.compTimes());
  assert.equal(c.text, 2); assert.equal(c.shape, 1); assert.equal(c.image, 2); assert.equal(c.audio, 1); assert.equal(c.null, 1);
  assert.equal(c.camera, 1); assert.equal(c.shy, 1); assert.equal(c.effects, 1); assert.equal(c.activeNow, 7, 'Ctrl starts at 5s');

  await sel.apply(M.plan(snap.layers, M.byType(snap.layers, ['text'], { unlockedOnly: true }), 'replace'), 'text', 'active');
  assert.deepEqual(names(), ['Title EN']);
  snap = await sel.load('active');
  await sel.apply(M.plan(snap.layers, M.bySearch(snap.layers, 'png'), 'add'), 'search', 'active');
  assert.deepEqual(names(), ['Title EN', 'BG plate', 'BG plate copy']);
  snap = await sel.load('active');
  await sel.apply(M.plan(snap.layers, M.bySearch(snap.layers, 'copy'), 'remove'), 'remove', 'active');
  assert.deepEqual(names(), ['Title EN', 'BG plate']);
  snap = await sel.load('active');
  const ref = snap.layers.find((l) => l.name === 'BG plate');
  assert.deepEqual(M.same(snap.layers, ref, 'source').map((l) => l.name), ['BG plate', 'BG plate copy']);
  assert.deepEqual(M.byLabel(snap.layers, 9).map((l) => l.name), ['Title EN', 'Title AR']);
  assert.match(M.same(snap.layers, snap.layers.find((l) => l.name === 'Ctrl'), 'source').error, /no source/);
  await sel.apply(M.invert(snap.layers), 'invert', 'active');
  assert.ok(!names().includes('Title EN') && names().includes('Logo'));
  await sel.back();
  assert.deepEqual(names(), ['Title EN', 'BG plate']);
  await sel.forward();
  assert.ok(names().includes('Logo'));
  const proj = await sel.load('selectedComps');
  assert.equal(proj.comps.length, 2);
  assert.ok(proj.layers.some((l) => l.name === 'Other Title'));
});

test('Select tool (Copilot) and layer switches with restore', async () => {
  const { services, comp } = await createTestServices(selectFixture());
  const r = await services.executor.run('select.layers', { by: 'type', type: 'image' });
  assert.equal(r.status, 'success');
  assert.equal(r.result.matched, 2);
  const lbl = await services.host.call('labels.get', {});
  assert.equal(lbl.fromPrefs, false, 'falls back to default label names when prefs are unavailable');
  const sw = await services.host.call('layers.setSwitch', { items: [{ compId: comp.id, layerIds: [comp.layer(1).id] }], prop: 'shy', value: 'toggle' });
  assert.equal(sw.layers[0].after, true);
  await assert.rejects(services.host.call('layers.setSwitch', { items: [], prop: 'remove', value: 1 }), /Unsupported layer switch/);
});

test('Copilot catalog includes the new tools and context carries brands + preset ids', async () => {
  const calls = [];
  const http = { request: async (req) => { calls.push(JSON.parse(req.body)); return { status: 200, headers: {}, body: JSON.stringify({ stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: '{"summary":"x","steps":[],"warnings":[],"clarification":"no"}' }] }) }; } };
  const { services } = await createTestServices(studioComp([{ name: 'T', selected: true, text: 'Hi', transform: T() }]), { http, apiKey: 'sk-ant-k-1234567890' });
  services.brands.save(brand);
  await services.copilot.plan('animate the title in with the client gold', await services.executor.readContext());
  const user = JSON.parse(calls[0].messages[0].content);
  assert.equal(user.afterEffectsContext.brands[0].name, 'Nile Bank');
  assert.ok(user.afterEffectsContext.textPresets.some((p) => p.startsWith('moe-in-down')));
  assert.equal(user.afterEffectsContext.selectedLayers[0].text, 'Hi');
  const sys = calls[0].system[0].text;
  for (const id of ['text.animate', 'brand.applyColor', 'proximity.apply', 'select.layers']) assert.ok(sys.includes(id), id);
});
