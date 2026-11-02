'use strict';
/**
 * v0.36 — Target and Audio effectors (docs/features/TARGET_AUDIO_EFFECTORS.md). Target turns the grid's items to
 * face the effector null; Audio drives the moves from a soundtrack's loudness (After Effects' own Convert Audio to
 * Keyframes, mocked in tests/mock/ae-mock.js). Mock-evaluated item values are compared with features/grid/effectors.js.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { gridItems } = require('./fixtures/layout');
const EF = require('../extension/features/grid/effectors');

const tp = (L, mn) => L.property('ADBE Transform Group').property(mn);
const at = (L, mn, t) => tp(L, mn).valueAtTime(t, false);
const cards = (comp) => comp._layers.filter((l) => /^Card/.test(l.name));
const fx = (L, name) => L._parade._children.find((f) => f.name === name);
const ctl = (L, name) => fx(L, name)._children[0];
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const BEAT = (t) => Math.round((1 + 9 * Math.max(0, Math.sin(t * Math.PI * 4))) * 100) / 100; // two beats a second

async function gridWith(n = 9, extraLayers = []) {
  const fixture = gridItems(n);
  fixture.comp.layers = fixture.comp.layers.concat(extraLayers);
  const r0 = await createTestServices(fixture);
  r0.comp._layers.forEach((l) => { l.selected = /^Card/.test(l.name); });
  const r = await r0.services.executor.run('grid.build', { mode: 'rect', columns: 3, spacingX: 150, spacingY: 120 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const G = r0.comp._layers.find((l) => l.name === 'MOE Grid 1');
  const base = cards(r0.comp).map((L) => Array.from(at(L, 'ADBE Position', r0.comp.time)));
  const rot0 = cards(r0.comp).map((L) => at(L, 'ADBE Rotate Z', r0.comp.time));
  r0.comp._layers.forEach((l) => { l.selected = l === G; });
  return Object.assign(r0, { G, base, rot0 });
}
/** The reference for every item at time t (effector E read from the mock; A = its amplitude layer, if any). */
function expected(comp, G, E, base, rot0, t, A) {
  const has = (nm) => !!fx(E, nm);
  const src = {
    at: (tt) => { const v = {}; for (const [name, kind] of EF.CONTROLS) if (has(name) && kind !== 'layer') v[EF.KEY[name]] = ctl(E, name).valueAtTime(tt, false); v.invert = v.invert === 1; return v; },
    toLocal: (tt) => EF.localFn({ position: Array.from(at(E, 'ADBE Position', tt)), rotation: at(E, 'ADBE Rotate Z', tt), scale: Array.from(at(E, 'ADBE Scale', tt)) }),
    originAt: (tt) => Array.from(at(E, 'ADBE Position', tt)),
    audioAt: (tt) => (A ? ctl(A, 'Both Channels').valueAtTime(tt, false) : 0)
  };
  return base.map((b, i) => EF.applyAt([src], {
    i, k: i, n: base.length, x: b[0], y: b[1], fd: comp.frameDuration,
    compAt: (tt) => { const gp = at(G, 'ADBE Position', tt); return [gp[0] + b[0], gp[1] + b[1]]; },
    baseRotAt: (tt) => rot0[i] + at(G, 'ADBE Rotate Z', tt)
  }, t));
}

test('Target · Everywhere: every item turns to face the effector as it sweeps; values = the reference', async () => {
  const { services, comp, G, base, rot0 } = await gridWith(9);
  const r = await services.executor.run('grid.effector', { type: 'target', falloff: 'all', scale: 0, sweep: true });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const E = comp._layers.find((l) => l.name === 'MOE Effector 1');
  assert.equal(ctl(E, 'Effector Type').valueAtTime(0, false), 6, 'Target is menu item 6');
  const T = comp.time;
  for (const t of [T, T + 0.7, T + 1.3, T + 2]) {
    const exp = expected(comp, G, E, base, rot0, t);
    const ep = at(E, 'ADBE Position', t), gp = at(G, 'ADBE Position', t);
    cards(comp).forEach((L, i) => {
      const got = at(L, 'ADBE Rotate Z', t);
      assert.ok(near(got, rot0[i] + exp[i].rot, 0.05), `t ${t} item ${i}: ${got} vs ${rot0[i] + exp[i].rot}`);
      // the item's +X axis points at the effector (any whole turn)
      const want = Math.atan2(ep[1] - (gp[1] + base[i][1]), ep[0] - (gp[0] + base[i][0])) * 180 / Math.PI;
      assert.ok(near(EF.wrap180(got - want), 0, 0.05), `t ${t} item ${i} faces the effector (${got} vs ${want})`);
    });
  }
  // the left and right columns face opposite ways while the effector is between them (centre at T + 1)
  const left = at(cards(comp)[3], 'ADBE Rotate Z', T + 1), right = at(cards(comp)[5], 'ADBE Rotate Z', T + 1);
  assert.ok(Math.abs(EF.wrap180(left - right)) > 150, `left ${left}, right ${right}`);
  await services.executor.restore(r.checkpointId);
  cards(comp).forEach((L, i) => assert.ok(near(at(L, 'ADBE Rotate Z', T + 1), rot0[i], 1e-6), 'restored'));
});

test('Target · Sphere with Spring: only the items near it turn, partly at the soft edge, and swing before they settle; reference = mock', async () => {
  const { services, comp, G, base, rot0 } = await gridWith(9);
  const r = await services.executor.run('grid.effector', { type: 'target', falloff: 'sphere', size: 180, softness: 70, scale: 0, rotate: 90, spring: 100, frequency: 2.5, decay: 5, sweep: true });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const E = comp._layers.find((l) => l.name === 'MOE Effector 1');
  const T = comp.time;
  for (const t of [T + 0.5, T + 1, T + 1.8, T + 2.4]) {
    const exp = expected(comp, G, E, base, rot0, t);
    cards(comp).forEach((L, i) => assert.ok(near(at(L, 'ADBE Rotate Z', t), rot0[i] + exp[i].rot, 0.05), `t ${t} item ${i}`));
  }
  // the spring: right after the effector stops (T + 2) the items still swing; 3 s later they rest on the direct aim
  const L4 = cards(comp)[5]; // right column, middle row: in reach of where the effector stops
  const pair = (t) => { const s = at(L4, 'ADBE Rotate Z', t); ctl(E, 'Spring').setValue(0); const d = at(L4, 'ADBE Rotate Z', t); ctl(E, 'Spring').setValue(100); return [s, d]; };
  const swing = Math.max(...[0.05, 0.15, 0.25, 0.35].map((dt) => { const [s, d] = pair(T + 2 + dt); return Math.abs(s - d); }));
  assert.ok(swing > 2, `still swinging after the stop (${swing.toFixed(2)}°)`);
  const [s5, d5] = pair(T + 5);
  assert.ok(near(s5, d5, 0.05), `settled: ${s5} vs ${d5}`);
  // at T: the effector starts left of the grid, the far right column is out of reach
  assert.ok(near(at(cards(comp)[5], 'ADBE Rotate Z', T), rot0[5], 1e-6), 'out of reach → unchanged');
});

test('Audio: Convert Audio to Keyframes makes one MOE Audio layer (bottom, reused); the moves follow the loudness, each item later; restore', async () => {
  const music = { name: 'Music', source: { kind: 'audio', name: 'beat.wav' }, audio: BEAT, selected: false };
  const { services, comp, G, base, rot0 } = await gridWith(9, [music]);
  comp._project.activeItem = comp;
  const r = await services.executor.run('grid.effector', { type: 'audio', falloff: 'all', scale: 60, delay: 2 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const A = comp._layers.find((l) => l.name === 'MOE Audio · Music');
  assert.ok(A, 'the amplitude layer is named MOE Audio · Music');
  assert.equal(comp._layers[comp._layers.length - 1], A, 'moved to the bottom');
  const E = comp._layers.find((l) => l.name === 'MOE Effector 1');
  assert.equal(ctl(E, 'Audio Layer').valueAtTime(0, false), A.index, 'linked on the effector');
  const loudest = Math.max(...Array.from({ length: 251 }, (_, f) => BEAT(f / 25)));
  assert.ok(near(ctl(E, 'Audio Max').valueAtTime(0, false), loudest, 1e-6), `Audio Max = the loudest frame (${loudest})`);
  for (const t of [1.05, 1.12, 1.3, 2.2]) {
    const exp = expected(comp, G, E, base, rot0, t, A);
    cards(comp).forEach((L, i) => assert.ok(near(at(L, 'ADBE Scale', t)[0], 100 * exp[i].scaleMul, 0.05), `t ${t} item ${i}: ${at(L, 'ADBE Scale', t)[0]} vs ${100 * exp[i].scaleMul}`));
  }
  // on a beat (t = 1.125: sin peak) the first item is at its biggest; the last plays it 16 frames later
  const s0 = at(cards(comp)[0], 'ADBE Scale', 1.125)[0], s8 = at(cards(comp)[8], 'ADBE Scale', 1.125)[0];
  assert.ok(near(s0, 160, 1) && s8 < s0 - 10, `first ${s0}, last ${s8}`);
  // a second Audio effector reuses the layer; restoring it keeps the layer
  comp._layers.forEach((l) => { l.selected = l === G; });
  const r2 = await services.executor.run('grid.effector', { type: 'audio', falloff: 'all', rotate: 20, scale: 0 });
  assert.equal(r2.status, 'success');
  assert.equal(comp._layers.filter((l) => /^MOE Audio/.test(l.name)).length, 1, 'reused, not duplicated');
  await services.executor.restore(r2.checkpointId);
  assert.ok(comp._layers.includes(A), 'the first effector still needs it');
  await services.executor.restore(r.checkpointId);
  assert.ok(!comp._layers.some((l) => /^MOE (Audio|Effector)/.test(l.name)), 'restore removes the effector and the amplitude layer it made');
  assert.ok(comp._layers.some((l) => l.name === 'Music'), 'the sound layer itself is untouched');
});

test('Audio with no sound in the comp is refused with what to do, and leaves nothing behind', async () => {
  const { services, comp } = await gridWith(4);
  const n0 = comp._layers.length;
  const r = await services.executor.run('grid.effector', { type: 'audio', falloff: 'all', scale: 50 });
  assert.notEqual(r.status, 'success');
  assert.match(JSON.stringify(r.errors || r), /layer with sound/);
  assert.equal(comp._layers.length, n0, 'no effector, no amplitude layer');
});

test('Library: Aim, Look Near, Beat Pulse, Beat Wave are in Effectors (full rows)', () => {
  const S = require('../extension/app/ui/studio/sections');
  const lay = S.byId('layout');
  for (const [id, type] of [['efAim', 'target'], ['efLook', 'target'], ['efBeat', 'audio'], ['efBeatWave', 'audio']]) {
    const t = lay.tiles.find((x) => x.id === id);
    assert.ok(t && t.tool === 'grid.effector' && t.args.type === type && t.tags.includes('Effectors'), id);
  }
  const AE = require('../extension/app/ui/layoutAE');
  const arr = AE.TABS.find((t) => t.id === 'ae-layer').groups.find((g) => g.id === 'arrange');
  const eff = arr.modes.find(([m]) => m === 'effect')[2];
  assert.equal(eff.length % 4, 0);
  ['efAim', 'efLook', 'efBeat', 'efBeatWave'].forEach((id) => assert.ok(eff.includes(id) && arr.ids.includes(id), id));
  // Target needs no Move / Scale / Fade (turning is what it does) — the first test runs it with none
  assert.ok(!lay.tiles.find((x) => x.id === 'efAim').args.scale);
});
