'use strict';
/**
 * v0.38 — Field effectors (docs/features/FIELD_EFFECTORS.md): two new falloffs. Noise Field = patches of a value noise
 * that drifts through the grid (Size = patch size, Softness = edge, Field Speed = drift); Image = the brightness of a
 * layer under each item (sampleImage). Mock-evaluated items are compared with features/grid/effectors.js.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { gridItems, TA } = require('./fixtures/layout');
const EF = require('../extension/features/grid/effectors');

const tp = (L, mn) => L.property('ADBE Transform Group').property(mn);
const at = (L, mn, t) => tp(L, mn).valueAtTime(t, false);
const cards = (comp) => comp._layers.filter((l) => /^Card/.test(l.name));
const fx = (L, name) => L._parade._children.find((f) => f.name === name);
const ctl = (L, name) => fx(L, name)._children[0];
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const MAP = (u) => Math.min(Math.max(u * 4, 0), 1); // the Field layer: black on the left, brighter to the right

async function gridWith(n = 9, extra = []) {
  const fixture = gridItems(n);
  fixture.comp.layers = fixture.comp.layers.concat(extra);
  const r0 = await createTestServices(fixture);
  r0.comp._layers.forEach((l) => { l.selected = /^Card/.test(l.name); });
  const r = await r0.services.executor.run('grid.build', { mode: 'rect', columns: 3, spacingX: 150, spacingY: 120 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const G = r0.comp._layers.find((l) => l.name === 'MOE Grid 1');
  const base = cards(r0.comp).map((L) => Array.from(at(L, 'ADBE Position', r0.comp.time)));
  r0.comp._layers.forEach((l) => { l.selected = l === G; });
  return Object.assign(r0, { G, base });
}
function expected(comp, G, E, base, t, lumaAt) {
  const src = {
    at: (tt) => { const v = {}; for (const [name, kind] of EF.CONTROLS) if (fx(E, name) && kind !== 'layer') v[EF.KEY[name]] = ctl(E, name).valueAtTime(tt, false); v.invert = v.invert === 1; return v; },
    toLocal: (tt) => EF.localFn({ position: Array.from(at(E, 'ADBE Position', tt)), rotation: at(E, 'ADBE Rotate Z', tt), scale: Array.from(at(E, 'ADBE Scale', tt)) }),
    lumaAt
  };
  return base.map((b, i) => EF.applyAt([src], { i, k: i, n: base.length, x: b[0], y: b[1], fd: comp.frameDuration, compAt: (tt) => { const gp = at(G, 'ADBE Position', tt); return [gp[0] + b[0], gp[1] + b[1]]; } }, t));
}

test('Noise Field: patches of the field grow the items under them; it drifts with Field Speed; mock = reference at three times', async () => {
  const { services, comp, G, base } = await gridWith(9);
  const r = await services.executor.run('grid.effector', { type: 'plain', falloff: 'noise', size: 160, softness: 40, scale: 80, fieldSpeed: 60 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const E = comp._layers.find((l) => l.name === 'MOE Effector 1');
  assert.equal(ctl(E, 'Falloff').valueAtTime(0, false), 5, 'Noise Field is falloff item 5');
  const T = comp.time;
  const scales = (t) => cards(comp).map((L) => at(L, 'ADBE Scale', t)[0]);
  for (const t of [T, T + 0.5, T + 1.5]) {
    const exp = expected(comp, G, E, base, t);
    scales(t).forEach((s, i) => assert.ok(near(s, 100 * exp[i].scaleMul, 0.05), `t ${t} item ${i}: ${s} vs ${100 * exp[i].scaleMul}`));
  }
  const a = scales(T), b = scales(T + 1.5);
  assert.ok(new Set(a.map((v) => Math.round(v))).size > 2, `the field gives the items different weights (${a.map(Math.round)})`);
  assert.ok(a.some((v, i) => Math.abs(v - b[i]) > 2), 'the field drifts over time (the null did not move)');
  // Softness 0: hard patches — each item is either untouched or fully grown
  ctl(E, 'Softness').setValue(0);
  scales(T).forEach((s) => assert.ok(near(s, 100, 0.01) || near(s, 180, 0.01), `hard field: ${s}`));
});

test('Image field: the brightness of a layer under each item is its weight (picked from the selection); colour follows it too', async () => {
  const map = { name: 'Logo Map', width: 1920, height: 1080, source: { kind: 'solid' }, pixels: (u) => { const v = MAP(u); return [v, v, v, 1]; }, transform: TA({ pos: [960, 540], anchor: [960, 540] }), rect: { left: 0, top: 0, width: 1920, height: 1080 } };
  const { services, comp, G, base } = await gridWith(9, [map]);
  comp._layers.forEach((l) => { l.selected = l === G || l.name === 'Logo Map'; });
  const r = await services.executor.run('grid.effector', { type: 'plain', falloff: 'image', scale: 100 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.ok(r.verification.checks.some((c) => c.label === 'Field' && c.ok && /Logo Map/.test(c.detail)), 'linked to Logo Map');
  const E = comp._layers.find((l) => l.name === 'MOE Effector 1');
  const lumaAt = (cx) => MAP(cx / 1920);
  const exp = expected(comp, G, E, base, comp.time, lumaAt);
  const sc = cards(comp).map((L) => at(L, 'ADBE Scale', comp.time)[0]);
  sc.forEach((s, i) => assert.ok(near(s, 100 * exp[i].scaleMul, 0.05), `item ${i}: ${s} vs ${100 * exp[i].scaleMul}`));
  assert.ok(sc[2] > sc[1] && sc[1] > sc[0], `brighter to the right → bigger to the right (${sc.slice(0, 3)})`);
  // Clone Colours + the same field: the tint follows the brightness
  comp._layers.forEach((l) => { l.selected = l === G; });
  assert.equal((await services.executor.run('grid.colour', { mode: 'cycle', palette: 'tomato' })).status, 'success');
  ctl(E, 'Colour Mix').setValue(100); ctl(E, 'Colour').setValue([1, 1, 1, 1]);
  const fill = (L) => fx(L, EF.COLOUR_FX)._children.find((p) => p.name === 'Color').valueAtTime(comp.time, false);
  const pal = [1, 2, 3, 4].map((k) => ctl(G, `Colour ${k}`).valueAtTime(0, false));
  const gp = at(G, 'ADBE Position', comp.time);
  const vals = {}; for (const [name, kind] of EF.CONTROLS) if (kind !== 'layer') vals[EF.KEY[name]] = ctl(E, name).valueAtTime(comp.time, false);
  vals.invert = vals.invert === 1;
  cards(comp).forEach((L, i) => {
    const p = at(L, 'ADBE Position', comp.time);
    const want = EF.colourWithEffectors(EF.paletteColour(1, pal, i, 9, 1), [{ values: vals, toLocal: () => [0, 0], lumaAt: () => lumaAt(gp[0] + p[0]) }], gp[0] + p[0], gp[1] + p[1], comp.time);
    assert.ok([0, 1, 2].every((k) => near(fill(L)[k], want[k], 0.005)), `colour item ${i}: ${fill(L)} vs ${want}`);
  });
  await services.executor.restore(r.checkpointId);
  assert.ok(!comp._layers.some((l) => /^MOE Effector/.test(l.name)) && comp._layers.some((l) => l.name === 'Logo Map'), 'restore keeps the map layer');
});

test('Image field with no layer to read is refused with what to do', async () => {
  const { services, comp } = await gridWith(4);
  const n0 = comp._layers.length;
  const r = await services.executor.run('grid.effector', { type: 'plain', falloff: 'image', scale: 50 });
  assert.notEqual(r.status, 'success');
  assert.match(JSON.stringify(r.errors || r), /Field layer/);
  assert.equal(comp._layers.length, n0);
});

test('Library: Noise Grow, Noise Flicker, Image Grow and Image Reveal are in Effectors (full rows)', () => {
  const S = require('../extension/app/ui/studio/sections');
  const lay = S.byId('layout');
  for (const [id, fo] of [['efField', 'noise'], ['efFlicker', 'noise'], ['efImage', 'image'], ['efImageReveal', 'image']]) {
    const t = lay.tiles.find((x) => x.id === id);
    assert.ok(t && t.tool === 'grid.effector' && t.args.falloff === fo && t.tags.includes('Effectors'), id);
  }
  const AE = require('../extension/app/ui/layoutAE');
  const arr = AE.TABS.find((t) => t.id === 'ae-layer').groups.find((g) => g.id === 'arrange');
  const eff = arr.modes.find(([m]) => m === 'effect')[2];
  assert.equal(eff.length % 4, 0);
  ['efField', 'efFlicker', 'efImage', 'efImageReveal'].forEach((id) => assert.ok(eff.includes(id) && arr.ids.includes(id), id));
  assert.deepEqual(EF.FALLOFFS.map((f) => f.menu).slice(4), ['Noise Field', 'Image']);
});
