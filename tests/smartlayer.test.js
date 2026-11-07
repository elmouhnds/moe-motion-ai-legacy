'use strict';
/* v0.67 (docs/features/SMART_LAYER.md): foresight, hover cards, Layer Reader, the marker family, Beat Markers. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { TA } = require('./fixtures/layout');
const { studioComp } = require('./fixtures/studio');
const TC = require('../extension/core/toolcard');
const E = require('../extension/features/expressions/quick');
const RD = require('../extension/features/kit/reader');
const BEATS = require('../extension/features/markers/beats');

const tp = (L, mn) => L.property('ADBE Transform Group').property(mn);
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;
const box = (name, extra) => Object.assign({ name, selected: true, transform: TA({ pos: [400, 300] }), rect: { left: -20, top: -20, width: 40, height: 40 } }, extra || {});
function keyedBox(name) {
  const tr = TA({ pos: [100, 100] });
  tr[1] = Object.assign({}, tr[1], { keys: [{ time: 0, value: [100, 100] }, { time: 1, value: [500, 100] }], selected: true });
  return box(name, { transform: tr });
}

test('Foresight: a selected property with YOUR expression stops the expression tool before anything is written; with Replace the card warns', async () => {
  const { services, comp } = await createTestServices(studioComp([keyedBox('Box')], { comp: { time: 0 } }));
  const P = tp(comp._layers[0], 'ADBE Position');
  P.expression = 'value + [10, 0]; // mine';
  const ctx = await services.executor.readContext();
  const tool = services.registry.get('expressions.quick');
  const c = TC.card(tool, { preset: 'wiggle' }, ctx, services);
  assert.equal(c.ready, false);
  assert.match(c.needs, /Position already has your own expression — turn on Replace existing/);
  const r = await services.executor.run('expressions.quick', { preset: 'wiggle' });
  assert.equal(r.status, 'blocked');
  assert.equal(P.expression, 'value + [10, 0]; // mine', 'nothing was written');
  const c2 = TC.card(tool, { preset: 'wiggle', replace: true }, ctx, services);
  assert.equal(c2.ready, true);
  assert.ok(c2.warnings.some((w) => /replaces your own expression on Position — Restore brings it back/.test(w)), c2.warnings.join(' | '));
  // keys under an enabled expression: any keyframe tool says so before Apply
  const k = TC.card(services.registry.get('quick.reverseKeys'), {}, ctx, services);
  assert.ok(k.warnings.some((w) => /Box › Position has an expression on — new keys stay hidden until it is off/.test(w)), k.warnings.join(' | '));
});

test('Hover cards: one-click buttons map to their tool and numbers; the card is the same as the Inspector\'s', async () => {
  const HC = require('../extension/app/ui/hovercard');
  assert.equal(HC.refOf('a-quick:t_inUp'), 'quick:t_inUp');
  assert.equal(HC.refOf('a-tile:animate/popIn'), 'tile:animate/popIn');
  assert.equal(HC.refOf('qt-k_easy'), 'quick:k_easy');
  assert.equal(HC.refOf('g-select'), null, 'group headers are not buttons');
  assert.equal(HC.refOf('qt-tile:expressions/x-wiggle'), 'tile:expressions/x-wiggle');
  const { services } = await createTestServices(studioComp([keyedBox('Box')], { comp: { time: 0 } }));
  const ctx = await services.executor.readContext();
  const app = { services, state: { get: () => ({ ctx }) } };
  const h = HC.cardFor(app, 'tile:expressions/x-autoFade');
  const direct = TC.card(services.registry.get('expressions.quick'), Object.assign(require('../extension/core/schema').defaults(services.registry.get('expressions.quick').params), { preset: 'autoFade', secs: 0.5 }), ctx, services);
  assert.equal(h.label, 'Auto Fade');
  assert.deepEqual(h.writes, direct.writes);
  assert.equal(h.code, direct.code);
  assert.equal(HC.cardFor(app, 'quick:nope'), null);
});

test('Layer Reader: lists what MOE did (presets read back with their numbers), removes ONE item and nothing else', async () => {
  const { services, comp } = await createTestServices(studioComp([keyedBox('Box')], { comp: { time: 0 } }));
  const L = comp._layers[0];
  assert.equal((await services.executor.run('expressions.quick', { preset: 'wiggle', freq: 3, amp: 12 })).status, 'success');
  tp(L, 'ADBE Position')._selected = false;
  assert.equal((await services.executor.run('expressions.quick', { preset: 'markerInOut', secs: 0.3 })).status, 'success');
  tp(L, 'ADBE Rotate Z').expression = 'value + 5; // mine';
  const scan = await services.host.call('rigs.find', { compId: comp.id, layers: [L.id] });
  const rows = RD.describe(scan.layers[0]);
  const wig = rows.find((r) => r.label === 'Wiggle'), fade = rows.find((r) => r.label === 'Marker In / Out');
  assert.ok(wig && fade, rows.map((r) => r.label).join(', '));
  assert.equal(wig.on, 'Position');
  assert.deepEqual(wig.edit, { preset: 'wiggle', values: { freq: 3, amp: 12 } });
  assert.equal(fade.on, 'Opacity');
  assert.ok(!rows.some((r) => /mine/.test(r.detail)), 'your own expression is never listed');
  const r = await services.executor.run('kit.removeRig', { layerId: L.id, only: JSON.stringify(wig.only) });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.equal(tp(L, 'ADBE Position').expression, '');
  assert.match(tp(L, 'ADBE Opacity').expression, /MOE Expr: Marker In \/ Out/, 'the other MOE item stays');
  assert.equal(tp(L, 'ADBE Rotate Z').expression, 'value + 5; // mine', 'your own expression stays');
  // every preset reads back exactly; a hand-edited one is not guessed
  for (const id of Object.keys(E.PRESETS)) {
    const v = {}; for (const k of Object.keys(E.PRESETS[id].nums)) v[k] = 1.25;
    const back = E.parse(E.code(id, v, false, 2));
    assert.ok(back && back.preset === id && Object.keys(v).every((k) => back.values[k] === 1.25), id);
  }
  assert.equal(E.parse('// MOE Expr: Wiggle\nwiggle(2, 30); // edited'), null);
  assert.deepEqual(E.parse(E.code('wiggle', {}, true)), { preset: 'wiggle', live: true, values: {} });
});

test('Marker Trigger replays your keys from every marker; Marker In / Out fades between the first and last marker', async () => {
  const { services, comp } = await createTestServices(studioComp([keyedBox('Box')], { comp: { time: 0 } }));
  const L = comp._layers[0];
  L._markers = [2, 3.5];
  assert.equal((await services.executor.run('expressions.quick', { preset: 'markerTrigger' })).status, 'success');
  const P = tp(L, 'ADBE Position');
  const pre = (t) => P.valueAtTime(t, true)[0];
  assert.ok(near(P.valueAtTime(1, false)[0], pre(0)), 'before the first marker: the first key');
  assert.ok(near(P.valueAtTime(2.5, false)[0], pre(0.5)), 'half a second after marker 1: the keys half a second in');
  assert.ok(near(P.valueAtTime(3.2, false)[0], pre(1)), 'a run that is over holds the last key');
  assert.ok(near(P.valueAtTime(3.75, false)[0], pre(0.25)), 'marker 2 starts it again');
  P._selected = false;
  assert.equal((await services.executor.run('expressions.quick', { preset: 'markerInOut', secs: 0.4 })).status, 'success');
  L._markers = [1, 3];
  const O = tp(L, 'ADBE Opacity');
  assert.equal(O.valueAtTime(0.5, false), 0);
  assert.equal(O.valueAtTime(2, false), 100);
  assert.equal(O.valueAtTime(3.5, false), 0);
  assert.ok(O.valueAtTime(1.2, false) > 0 && O.valueAtTime(1.2, false) < 100, 'fading in');
});

test('Beat finder: pulses every 0.5 s are found once each; sensitivity and min gap behave', () => {
  const fps = 30, times = [], values = [];
  for (let f = 0; f <= 4 * fps; f++) { const t = f / fps, ph = t % 0.5; times.push(t); values.push(0.1 + (ph < 0.08 ? 1 - ph / 0.08 : 0)); }
  const b = BEATS.find(times, values, { sensitivity: 60, minGap: 0.25 });
  assert.deepEqual(b.map((t) => Math.round(t * 2) / 2), [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].filter((t) => b.some((x) => near(x, t, 0.05))));
  assert.ok(b.length >= 8 && b.length <= 9, `${b.length} beats`);
  assert.ok(BEATS.find(times, values, { minGap: 1 }).length <= 5, 'a 1 s gap halves them');
  assert.deepEqual(BEATS.find(times, times.map(() => 0)), [], 'silence → no beats');
  assert.deepEqual(BEATS.find(times, values, { max: 3 }).length, 3);
});

test('Beat Markers: markers on the selected layer at the beats of the music; Restore removes exactly those and the amplitude layer it made', async () => {
  const fps = 25;
  const BEAT = (t) => { const ph = t % 0.5; return 0.1 + (ph < 0.08 ? 1 - ph / 0.08 : 0); };
  const music = { name: 'Music', source: { kind: 'audio', name: 'beat.wav' }, audio: BEAT, selected: false, transform: TA({ pos: [0, 0] }) };
  const { services, comp, sandbox } = await createTestServices(studioComp([box('Logo'), music], { comp: { time: 0, frameRate: fps, duration: 4 } }));
  comp._project.activeItem = comp;
  const logo = comp._layers.find((l) => l.name === 'Logo');
  logo.property('ADBE Marker').setValueAtTime(0.75, new sandbox.MarkerValue('mine'));
  const r = await services.executor.run('markers.beats', { sensitivity: 60, minGap: 0.25 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const M = logo.property('ADBE Marker');
  const beats = [];
  for (let i = 1; i <= M.numKeys; i++) if (M.keyValue(i).comment === 'MOE Beat') beats.push(M.keyTime(i));
  assert.ok(beats.length >= 7, `${beats.length} beats marked`);
  for (const t of beats) assert.ok(near((t % 0.5 + 0.5) % 0.5, 0, 0.05) || near(t % 0.5, 0.5, 0.05), `beat at ${t} sits on a pulse`);
  assert.ok(comp._layers.some((l) => l.name === 'MOE Audio · Music'), 'the sound was read with Convert Audio to Keyframes');
  assert.equal(comp._layers.find((l) => l.name === 'Music').property('ADBE Marker').numKeys, 0, 'the music itself is untouched');
  // Restore: only the MOE Beat markers go, yours stay; the amplitude layer this run made goes too
  const back = await services.executor.restore(r.checkpointId);
  assert.ok(back.ok !== false, JSON.stringify(back));
  assert.equal(M.numKeys, 1);
  assert.equal(M.keyValue(1).comment, 'mine');
  assert.ok(!comp._layers.some((l) => l.name === 'MOE Audio · Music'));
});
