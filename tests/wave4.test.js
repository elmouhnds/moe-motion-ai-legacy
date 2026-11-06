'use strict';
/** v0.64 wave 4 (docs/features/WAVE4.md): Decode / Scramble, Exploder (Wiggly Selector), Depth Reveal. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { studioComp } = require('./fixtures/studio');
const { TA } = require('./fixtures/layout');
const FG = require('../extension/core/framegrid');
const { PRESETS } = require('../extension/features/text/presets');

const tr = (L, mn) => L.property('ADBE Transform Group').property(mn);
const defs = (tool) => Object.fromEntries(Object.entries(tool.params || {}).filter(([, p]) => p.default !== undefined).map(([k, p]) => [k, p.default]));
const textComp = (fps = 24) => studioComp([{ name: 'Title', text: 'LAUNCH DAY', selected: true, transform: TA({ pos: [960, 540] }) }], { comp: { time: 1, frameRate: fps } });

async function runText(id, fps) {
  const s = await createTestServices(textComp(fps));
  const tool = s.services.registry.get('text.animate');
  const r = await s.services.executor.run('text.animate', Object.assign(defs(tool), { presetId: id, placement: 'cti' }));
  return Object.assign(s, { r });
}

test('Decode: one animator with Character Offset, by character (so not offered as Arabic-safe), keys on the frame grid', async () => {
  const p = PRESETS.find((x) => x.id === 'decode');
  assert.equal(p.arabicSafe, false, 'letters would lose their joins in Arabic');
  const { r, comp } = await runText('decode', 24);
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const L = comp._layers.find((l) => l.name === 'Title');
  const g = L.property('ADBE Text Properties').property('ADBE Text Animators').property(1);
  assert.equal(g.property('ADBE Text Animator Properties').property('ADBE Text Character Offset').value, 30);
  const off = g.property('ADBE Text Selectors').property(1).property('ADBE Text Percent Offset');
  assert.ok(off._keys.every((k) => FG.onGrid(k.t, 1 / 24)), '1.4 s at 24 fps lands on frames');
});

test('Explode / Assemble: a frozen Wiggly Selector (Intersect, −100…100 %, 0 wiggles/s) set by its English names, read back', async () => {
  for (const id of ['explode', 'assemble']) {
    const { r, comp } = await runText(id, 25);
    assert.equal(r.status, 'success', `${id}: ${JSON.stringify(r.verification || r.errors)}`);
    const L = comp._layers.find((l) => l.name === 'Title');
    const sels = L.property('ADBE Text Properties').property('ADBE Text Animators').property(1).property('ADBE Text Selectors');
    assert.equal(sels.numProperties, 2, 'a Range Selector (timing) + a Wiggly Selector (direction per letter)');
    const w = sels.property(2), byName = (n) => { for (let i = 1; i <= w.numProperties; i++) if (w.property(i).name === n) return w.property(i).value; return undefined; };
    assert.equal(w.matchName, 'ADBE Text Wiggly Selector');
    assert.deepEqual(['Mode', 'Min Amount', 'Max Amount', 'Wiggles/Second', 'Correlation'].map(byName), [3, -100, 100, 0, 0]);
    assert.deepEqual(r.result.layers[0].wiggly.missing, [], 'every setting found by name');
    assert.ok(r.verification.checks.some((c) => /Wiggly Selector \(7 settings by name\)/.test(c.detail)));
  }
});

test('Depth Reveal: made 3D, Position Z from own + Depth to own (on frames), fade + MOE Blur, screen order; Restore makes it all as it was', async () => {
  const { services, comp } = await createTestServices(studioComp([
    { name: 'Right', selected: true, transform: TA({ pos: [1400, 540] }), rect: { left: -100, top: -60, width: 200, height: 120 } },
    { name: 'Left', selected: true, transform: TA({ pos: [400, 540] }), rect: { left: -100, top: -60, width: 200, height: 120 } }
  ], { comp: { time: 1, frameRate: 30 } }));
  const tool = services.registry.get('quick.depth');
  const r = await services.executor.run('quick.depth', defs(tool));
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const L = comp._layers.find((l) => l.name === 'Left'), R = comp._layers.find((l) => l.name === 'Right');
  assert.ok(L.threeDLayer && R.threeDLayer);
  const k = tr(L, 'ADBE Position')._keys;
  assert.deepEqual(k.map((x) => Array.from(x.value)), [[400, 540, 900], [400, 540, 0]], 'from Z + 900 to where it is');
  assert.ok(k.every((x) => FG.onGrid(x.t, 1 / 30)));
  assert.ok(tr(R, 'ADBE Position')._keys[0].t > k[0].t, 'Left (first on screen) goes first');
  assert.equal(tr(L, 'ADBE Opacity')._keys[0].value, 0);
  assert.ok(L.property('ADBE Effect Parade').numProperties === 1, 'MOE Blur');
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  for (const X of [L, R]) {
    assert.equal(X.threeDLayer, false, `${X.name} 2D again`);
    assert.equal(tr(X, 'ADBE Position')._keys.length, 0);
    assert.equal(X.property('ADBE Effect Parade').numProperties, 0);
  }
});

test('the new presets and tiles are where they belong', () => {
  const ids = PRESETS.map((p) => p.id);
  for (const id of ['decode', 'scramble', 'assemble', 'explode']) assert.ok(ids.includes(id), id);
  const S = require('../extension/app/ui/studio/sections');
  const motion = S.byId('animate');
  assert.deepEqual(motion.tiles.filter((t) => t.tool === 'quick.depth').map((t) => t.id), ['depthIn', 'depthInFar', 'depthOut']);
});
