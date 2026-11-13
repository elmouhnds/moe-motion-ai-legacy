'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const shots = require('./fixtures/shots');
const cm = require('../extension/features/compositing/colorMath');

const fxNames = (layer) => (layer._parade ? layer._parade._children.map((e) => e.name) : []);
const mixerValues = (fx) => fx._children.slice(0, 12).map((p) => p.value);
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
const setTime = (comp, t) => { comp.time = t; };

// AT1
test('AT1 Analyze: known mean colour, probe removed, project unchanged', async () => {
  const { services, comp, env } = await createTestServices(shots.shotComp({ layers: [{ name: 'Plate', selected: true, pixels: shots.flat([0.6, 0.5, 0.4]) }] }));
  const r = await services.executor.run('compositing.analyze', { quality: 'balanced' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const L = r.result.layers[0];
  [0.6, 0.5, 0.4].forEach((v, i) => assert.ok(near(L.stats.mean[i], v), `channel ${i}: ${L.stats.mean[i]}`));
  assert.equal(comp.numLayers, 1);
  assert.deepEqual(fxNames(comp.layer(1)), []);
  assert.equal(env.undo.depth, 0);
  assert.deepEqual(env.undo.entries, ['MOE: Analyze (temporary)'], 'v0.94: one host call, one undo step (its temporary probe)');
});

// AT2
test('AT2 Analyze: detects warm cast and black/white points on a gradient', async () => {
  const { services } = await createTestServices(shots.shotComp({ layers: [{ name: 'Warm', selected: true, pixels: shots.warmGradient() }] }));
  const r = await services.executor.run('compositing.analyze', { quality: 'thorough' });
  const L = r.result.layers[0];
  assert.equal(L.cast, 'warm');
  assert.ok(L.stats.black < 0.3 && L.stats.white > 0.7, `${L.stats.black} / ${L.stats.white}`);
});

// AT3 + AT4
test('AT3/AT4 Grade neutral: identity Channel Mixer, re-run updates in place', async () => {
  const { services, comp } = await createTestServices(shots.shotComp({ layers: [{ name: 'Plate', selected: true }] }));
  const r = await services.executor.run('compositing.grade', {});
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.deepEqual(fxNames(comp.layer(1)), ['MOE Grade']);
  assert.deepEqual(mixerValues(comp.layer(1)._parade._children[0]), [100, 0, 0, 0, 0, 100, 0, 0, 0, 0, 100, 0]);
  assert.ok(r.verification.checks.some((c) => /added, 12 param/.test(c.detail)));
  const r2 = await services.executor.run('compositing.grade', { saturation: 50 });
  assert.equal(r2.status, 'success');
  assert.deepEqual(fxNames(comp.layer(1)), ['MOE Grade'], 'no duplicate effect');
  assert.ok(r2.verification.checks.some((c) => /updated/.test(c.detail)));
});

// AT5
test('AT5 Grade auto balance: measured warm mean maps to neutral grey', async () => {
  const { services, comp } = await createTestServices(shots.shotComp({ layers: [{ name: 'Warm', selected: true, pixels: shots.warmGradient() }] }));
  const a = await services.executor.run('compositing.analyze', { quality: 'balanced' });
  const r = await services.executor.run('compositing.grade', { autoBalance: 100 });
  assert.equal(r.status, 'success');
  const v = mixerValues(comp.layer(1)._parade._children[0]).map((x) => x / 100);
  const map = { M: [[v[0], v[1], v[2]], [v[4], v[5], v[6]], [v[8], v[9], v[10]]], c: [v[3], v[7], v[11]] };
  const out = cm.apply(map, a.result.layers[0].stats.mean);
  assert.ok(Math.max(...out) - Math.min(...out) < 0.01, `balanced mean ${out}`);
});

// AT6
test('AT6 Restore: removes a created grade; restores previous values after an update', async () => {
  const { services, comp } = await createTestServices(shots.shotComp({ layers: [{ name: 'Plate', selected: true }] }));
  const r1 = await services.executor.run('compositing.grade', { temperature: 40 });
  const before = mixerValues(comp.layer(1)._parade._children[0]);
  const r2 = await services.executor.run('compositing.grade', { temperature: -40, contrast: 50 });
  assert.notDeepEqual(mixerValues(comp.layer(1)._parade._children[0]), before);
  assert.ok((await services.executor.restore(r2.checkpointId)).ok);
  assert.deepEqual(mixerValues(comp.layer(1)._parade._children[0]), before);
  assert.ok((await services.executor.restore(r1.checkpointId)).ok);
  assert.deepEqual(fxNames(comp.layer(1)), []);
});

// AT7
test('AT7 Match Color: target stats transferred to reference; MOE Match placed before MOE Grade', async () => {
  const { services, comp } = await createTestServices(shots.shotComp({ layers: [
    { name: 'Actor', selected: true, pixels: shots.warmGradient() },
    { name: 'Plate', pixels: shots.coolPlate() }
  ] }));
  await services.executor.run('compositing.grade', { saturation: 90 });
  const r = await services.executor.run('compositing.matchColor', { reference: 2, strength: 100, quality: 'balanced' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.deepEqual(fxNames(comp.layer(1)), ['MOE Match', 'MOE Grade']);
  const req = r.result.requests[0];
  req.predicted.forEach((v, i) => assert.ok(near(v, req.refMean[i]), `channel ${i}: ${v} vs ${req.refMean[i]}`));
});

// AT8
test('AT8 Match Color blocked: reference = target, missing, or not visible now', async () => {
  const fixture = shots.shotComp({ layers: [{ name: 'Actor', selected: true }, { name: 'Plate', inPoint: 5, outPoint: 10 }] });
  const { services } = await createTestServices(fixture);
  let r = await services.executor.run('compositing.matchColor', { reference: 1 });
  assert.equal(r.status, 'blocked');
  r = await services.executor.run('compositing.matchColor', { reference: 9 });
  assert.match(r.errors[0], /Choose a reference/);
  r = await services.executor.run('compositing.matchColor', { reference: 2 });
  assert.match(r.errors[0], /time indicator/);
});

// AT9
test('AT9 Screen Key: samples green, builds Keylight → Cleaner → Spill → Choke, no duplicates on re-run', async () => {
  const { services, comp } = await createTestServices(shots.shotComp({ layers: [{ name: 'GS', selected: true, pixels: shots.greenScreen([0.1, 0.75, 0.2]) }] }));
  const r = await services.executor.run('compositing.keySetup', { screen: 'auto', cleanup: true, spill: true, choke: 1.5 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.deepEqual(fxNames(comp.layer(1)), ['MOE Key', 'MOE Key Cleaner', 'MOE Spill', 'MOE Choke']);
  const screen = comp.layer(1)._parade._children[0].property('Screen Colour').value;
  [0.1, 0.75, 0.2].forEach((v, i) => assert.ok(near(screen[i], v, 0.03), `screen ${i}: ${screen[i]}`));
  assert.equal(comp.layer(1)._parade._children[3].property('Choke Matte').value, 1.5);
  await services.executor.run('compositing.keySetup', { screen: 'green', cleanup: true, spill: true, choke: 1.5 });
  assert.equal(fxNames(comp.layer(1)).length, 4);
});

test('AT9b Screen Key goes before an existing MOE Grade', async () => {
  const { services, comp } = await createTestServices(shots.shotComp({ layers: [{ name: 'GS', selected: true, pixels: shots.greenScreen() }] }));
  await services.executor.run('compositing.grade', { temperature: 10 });
  await services.executor.run('compositing.keySetup', { cleanup: true, spill: false, choke: 0 });
  assert.deepEqual(fxNames(comp.layer(1)), ['MOE Key', 'MOE Key Cleaner', 'MOE Grade']);
});

test('AT9c Screen Key: no screen visible → clear error, nothing added', async () => {
  const { services, comp } = await createTestServices(shots.shotComp({ layers: [{ name: 'Plate', selected: true, pixels: shots.coolPlate() }] }));
  const r = await services.executor.run('compositing.keySetup', { screen: 'green' });
  assert.equal(r.status, 'failed');
  assert.match(r.errors[0], /No green screen found/);
  assert.deepEqual(fxNames(comp.layer(1)), []);
});

// AT10
test('AT10 Screen Key blocked on layers with a user keyer, and on null/camera layers', async () => {
  const { services } = await createTestServices(shots.shotComp({ layers: [
    { name: 'GS', selected: true, effects: [{ matchName: 'Keylight 906', name: 'Keylight (1.2)' }] },
    { name: 'Ctrl', selected: true, nullLayer: true },
    { name: 'Cam', selected: true, camera: true }
  ] }));
  const r = await services.executor.run('compositing.keySetup', {});
  assert.equal(r.status, 'blocked');
  assert.match(r.errors[0], /already has Keylight \(1\.2\)/);
  assert.match(r.errors[0], /Ctrl \(null layer\)/);
  assert.match(r.errors[0], /Cam \(camera layer\)/);
});

// AT11
test('AT11 Unresolvable parameter: no effect left behind, error lists the parameters', async () => {
  const { services, comp } = await createTestServices(shots.shotComp({
    layers: [{ name: 'Plate', selected: true }],
    effectsOptions: { dropParams: ['Blue-Const'], locale: 'xx' }
  }));
  const r = await services.executor.run('compositing.grade', {});
  assert.equal(r.status, 'failed');
  assert.match(r.errors[0], /Cannot map parameter\(s\) .*expected 13 parameters, found 12.*Parameters found: 1:xx:Red-Red/);
  assert.deepEqual(fxNames(comp.layer(1)), []);
});

// AT12
test('AT12 Non-English parameter names resolve by match-name convention and are flagged', async () => {
  const { services, comp } = await createTestServices(shots.shotComp({ layers: [{ name: 'Plate', selected: true }], effectsOptions: { locale: 'de' } }));
  const r = await services.executor.run('compositing.grade', { saturation: 0 });
  assert.equal(r.status, 'success');
  assert.ok(r.verification.checks.some((c) => /mapping unverified: Red-Red/.test(c.detail)));
  assert.ok(near(comp.layer(1)._parade._children[0].property(1).value, 21.26, 0.02));
});

// AT13
test('AT13 Permission: modify.effects Off blocks; Copilot origin needs approval', async () => {
  const { services } = await createTestServices(shots.shotComp({ layers: [{ name: 'Plate', selected: true }] }));
  const agent = await services.executor.run('compositing.grade', {}, { origin: 'agent' });
  assert.equal(agent.status, 'needs-approval');
  services.settings.update({ permissions: { 'modify.effects': 'deny' } });
  const r = await services.executor.run('compositing.grade', {});
  assert.equal(r.status, 'blocked');
  assert.match(r.errors[0], /modify.effects/);
});

// AT14
test('AT14 Look from Words: sends measured stats, validates/clamps values, never writes; offline is clean', async () => {
  const calls = [];
  const http = { request: async (req) => { calls.push(JSON.parse(req.body)); return { status: 200, headers: {}, body: JSON.stringify({ stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: 'text', text: JSON.stringify({ settings: { exposure: -0.3, contrast: 140, saturation: 60, temperature: -40, tint: 0, autoBalance: 100, autoLevels: 0 }, explanation: 'Cold thriller.', limitations: 'No split toning.' }) }] }) }; } };
  const { services, comp, env } = await createTestServices(shots.shotComp({ layers: [{ name: 'Warm', selected: true, pixels: shots.warmGradient() }] }), { http, apiKey: 'sk-ant-test-12345678' });
  const r = await services.executor.run('compositing.lookAssist', { description: 'cold thriller' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const user = JSON.parse(calls[0].messages[0].content);
  assert.equal(user.measured.cast, 'warm');
  assert.equal(r.result.suggestion.args.contrast, 100, 'clamped to range');
  assert.deepEqual(r.result.suggestion.clamped, ['contrast']);
  assert.deepEqual(fxNames(comp.layer(1)), [], 'nothing written');
  assert.deepEqual(env.undo.entries, ['MOE: Analyze (temporary)'], 'v0.94: one host call, one undo step (its temporary probe)');
  const off = await createTestServices(shots.shotComp({ layers: [{ name: 'W', selected: true }] }), { apiKey: 'k' });
  const r2 = await off.services.executor.run('compositing.lookAssist', { description: 'warm' });
  assert.equal(r2.status, 'failed');
  assert.match(r2.errors[0], /Cannot reach the Claude API/);
});

// AT15
test('AT15 Copilot plans with compositing.grade and the plan validates', async () => {
  const { services } = await createTestServices(shots.shotComp({ layers: [{ name: 'Plate', selected: true }, { name: 'BG' }] }));
  const ctx = await services.executor.readContext();
  assert.equal(ctx.compLayers.length, 2);
  const v = await services.copilot.validate({ summary: 'cool it', steps: [{ tool: 'compositing.grade', args: { exposure: 0, contrast: 10, saturation: 90, temperature: -30, tint: 0, autoBalance: 0, autoLevels: 0, quality: 'fast' }, reason: 'cooler' }] }, ctx);
  assert.ok(v.ok, JSON.stringify(v.steps));
  const schema = JSON.stringify(require('../extension/core/ai/planner').planSchema(services.registry));
  assert.ok(schema.includes('compositing.matchColor') && !schema.includes('compositing.lookAssist'));
});

// AT16
test('AT16 Backwards compatibility: old settings file gains the new scope; existing tools unchanged', async () => {
  const { createMemPlatform } = require('../dev/platform-mem');
  const { createStore } = require('../extension/core/storage');
  const { createSettings } = require('../extension/core/settings');
  const p = createMemPlatform();
  createStore(p.fs).set('settings', { permissions: { 'modify.keyframes': 'confirm' }, ai: { model: 'claude-sonnet-5-5' } });
  const st = createSettings(createStore(p.fs)).get();
  assert.equal(st.permissions['modify.effects'], 'allow');
  assert.equal(st.permissions['modify.keyframes'], 'confirm');
  assert.equal(st.ai.model, 'claude-sonnet-5-5');
});

test('Adjustment layers: manual grade allowed, auto options blocked', async () => {
  const { services } = await createTestServices(shots.shotComp({ layers: [{ name: 'Adj', selected: true, adjustment: true }] }));
  assert.equal((await services.executor.run('compositing.grade', { temperature: 20 })).status, 'success');
  const r = await services.executor.run('compositing.grade', { autoBalance: 50 });
  assert.equal(r.status, 'blocked');
  assert.match(r.errors[0], /adjustment layer has no source pixels/);
});

test('Colour math: transfer, saturation and contrast behave as documented', () => {
  const src = cm.stats([[0.2, 0.3, 0.4, 1], [0.4, 0.5, 0.6, 1]]);
  const ref = cm.stats([[0.5, 0.5, 0.5, 1], [0.9, 0.9, 0.9, 1]]);
  const out = cm.apply(cm.transfer(src, ref), src.mean);
  out.forEach((v, i) => assert.ok(near(v, ref.mean[i])));
  const grey = cm.apply(cm.saturation(0), [0.8, 0.2, 0.1]);
  assert.ok(Math.max(...grey) - Math.min(...grey) < 1e-9);
  assert.deepEqual(cm.apply(cm.contrast(50), [0.5, 0.5, 0.5]).map((v) => +v.toFixed(6)), [0.5, 0.5, 0.5]);
  const { clamped } = cm.toChannelMixer(cm.exposure(3));
  assert.deepEqual(clamped, ['Red-Red', 'Green-Green', 'Blue-Blue']);
});

test('effects.ensure rolls back its own changes when a later layer fails', async () => {
  const { services, comp } = await createTestServices(shots.shotComp({ layers: [{ name: 'A', selected: true }, { name: 'B', selected: true }] }));
  await services.executor.run('compositing.grade', { temperature: 10 });
  const beforeA = mixerValues(comp.layer(1)._parade._children[0]);
  const ctx = await services.executor.readContext();
  const p = (v) => ({ id: 'Red-Red', value: v, names: ['Red-Red'] });
  await assert.rejects(services.host.call('effects.ensure', { compId: ctx.comp.id, layers: [
    { layer: { layerId: comp.layer(1).id }, items: [{ key: 'MOE Grade', matchName: 'ADBE CHANNEL MIXER', params: [p(150)] }, { key: 'MOE Blur', matchName: 'ADBE Gaussian Blur 2', params: [] }] },
    { layer: { layerId: comp.layer(2).id }, items: [{ key: 'MOE X', matchName: 'NOT A REAL EFFECT', params: [] }] }
  ] }), (e) => e.code === 'EFFECT_UNAVAILABLE');
  assert.deepEqual(mixerValues(comp.layer(1)._parade._children[0]), beforeA, 'updated param restored');
  assert.deepEqual(fxNames(comp.layer(1)), ['MOE Grade'], 'created effect removed');
});

test('Conflict: keyed layers are measured after the key (subject only), with MOE Grade/Match bypassed', async () => {
  const { services, comp } = await createTestServices(shots.shotComp({ layers: [
    { name: 'GS', selected: true, pixels: shots.greenScreen([0.1, 0.75, 0.2]) },
    { name: 'Plate', pixels: shots.coolPlate() }
  ] }));
  // Unkeyed: the screen dominates the measurement.
  const raw = await services.executor.run('compositing.analyze', { quality: 'thorough' });
  assert.ok(raw.result.layers[0].stats.mean[1] > 0.6, 'green dominates before keying');
  await services.executor.run('compositing.keySetup', { cleanup: false, spill: false, choke: 0 });
  await services.executor.run('compositing.grade', { temperature: 100, saturation: 200 });
  const keyed = await services.executor.run('compositing.analyze', { quality: 'thorough' });
  const L = keyed.result.layers[0];
  assert.equal(L.keyed, true);
  [0.55, 0.45, 0.4].forEach((v, i) => assert.ok(near(L.stats.mean[i], v, 0.03), `subject channel ${i}: ${L.stats.mean[i]} (grade must be bypassed)`));
  const fx = comp.layer(1)._parade._children;
  assert.ok(fx.every((e) => e.enabled), 'bypassed effects re-enabled');
  const m = await services.executor.run('compositing.matchColor', { reference: 2, strength: 100 });
  assert.equal(m.status, 'success', JSON.stringify(m.verification || m.errors));
  assert.ok(m.verification.checks.some((c) => /keyed subject only/.test(c.detail)));
  assert.ok(!m.verification.checks.some((c) => /clamped/.test(c.detail)), 'no extreme correction');
});

test('Conflict: Match Color refuses an unkeyed green-screen layer, writes nothing', async () => {
  const { services, comp } = await createTestServices(shots.shotComp({ layers: [
    { name: 'GS', selected: true, pixels: shots.greenScreen() }, { name: 'Plate', pixels: shots.coolPlate() }
  ] }));
  const r = await services.executor.run('compositing.matchColor', { reference: 2 });
  assert.equal(r.status, 'failed');
  assert.match(r.errors[0], /unkeyed green screen — run Screen Key first/);
  assert.deepEqual(fxNames(comp.layer(1)), []);
});
