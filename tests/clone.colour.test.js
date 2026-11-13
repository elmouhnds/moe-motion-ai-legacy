'use strict';
/**
 * v0.34 — Clone Colours (docs/features/CLONE_COLOURS.md): a palette over a grid's items (Cycle / Gradient /
 * Random, live on the grid null) and effectors that tint the items they reach (Colour + Colour Mix). The items'
 * Fill colour expressions are evaluated by the mock engine and compared with features/grid/effectors.js.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { gridItems } = require('./fixtures/layout');
const EF = require('../extension/features/grid/effectors');
const { paletteFour } = require('../extension/features/grid/colourTool');

const tp = (L, mn) => L.property('ADBE Transform Group').property(mn);
const cards = (comp) => comp._layers.filter((l) => /^Card/.test(l.name));
const fxOf = (L, name) => L._parade._children.find((f) => f.name === name);
const fill = (L) => fxOf(L, EF.COLOUR_FX)._children.find((p) => p.name === 'Color');
const ctl = (L, name) => (fxOf(L, name) ? fxOf(L, name)._children[0] : { valueAtTime: () => { const d = EF.defaults()[EF.KEY[name]]; return d === false ? 0 : d; }, missing: true });
const select = (comp, name) => comp._layers.forEach((l) => { l.selected = l.name === name; });
const close = (a, b, tol = 0.002) => [0, 1, 2].every((k) => Math.abs(a[k] - b[k]) <= tol);

async function grid(n = 9) {
  const r0 = await createTestServices(gridItems(n));
  const b = await r0.services.executor.run('grid.build', { mode: 'rect', columns: 3, spacingX: 150, spacingY: 120 });
  assert.equal(b.status, 'success');
  select(r0.comp, 'MOE Grid 1');
  return r0;
}

test('Cycle, Gradient and Random: every item\'s colour equals the reference; the palette is live on the grid null', async () => {
  for (const [mode, idx] of [['cycle', 1], ['gradient', 2], ['random', 3]]) {
    const { services, comp } = await grid(9);
    const r = await services.executor.run('grid.colour', { mode, palette: 'ocean', seed: 5 });
    assert.equal(r.status, 'success', `${mode}: ${JSON.stringify(r.verification || r.errors)}`);
    const G = comp._layers.find((l) => l.name === 'MOE Grid 1');
    const pal = [1, 2, 3, 4].map((k) => ctl(G, `Colour ${k}`).valueAtTime(0, false));
    paletteFour('ocean').forEach((want, k) => assert.ok(close(pal[k], want, 1e-6), `Colour ${k + 1} = the palette's accent ${k + 1}`));
    assert.equal(ctl(G, 'Colour Mode').valueAtTime(0, false), idx);
    cards(comp).forEach((L, i) => assert.ok(close(fill(L).valueAtTime(comp.time, false), EF.paletteColour(idx, pal, i, 9, 5)), `${mode} item ${i}`));
    if (mode === 'cycle') assert.ok(close(fill(cards(comp)[4]).valueAtTime(0, false), pal[0]), 'item 4 → Colour 1 again');
    if (mode === 'gradient') assert.ok(close(fill(cards(comp)[8]).valueAtTime(0, false), pal[3]), 'the last item is Colour 4');
    if (mode === 'random') assert.ok(new Set(cards(comp).map((L) => fill(L).valueAtTime(0, false).join())).size >= 2, 'random uses more than one colour');
    // live: change Colour 1 in Effect Controls and the items that use it follow
    ctl(G, 'Colour 1').setValue([1, 0, 0, 1]);
    const pal2 = [1, 2, 3, 4].map((k) => ctl(G, `Colour ${k}`).valueAtTime(0, false));
    cards(comp).forEach((L, i) => assert.ok(close(fill(L).valueAtTime(0, false), EF.paletteColour(idx, pal2, i, 9, 5)), `${mode} live item ${i}`));
  }
});

test('Effector Colour Mix tints only what its falloff reaches (sphere with a soft edge, linear sweep); reference = mock', async () => {
  // v0.89: the third and fourth cases check that the colour's edge follows the Falloff Curve like the moves do
  for (const args of [{ falloff: 'sphere', size: 220, softness: 60 }, { falloff: 'linear', size: 200, sweep: true }, { falloff: 'sphere', size: 260, softness: 100, falloffCurve: 'easeIn', sweep: true }, { falloff: 'linear', size: 220, falloffCurve: 'easeOut', sweep: true }]) {
    const { services, comp } = await grid(9);
    assert.equal((await services.executor.run('grid.colour', { mode: 'gradient', palette: 'tomato' })).status, 'success');
    select(comp, 'MOE Grid 1');
    const r = await services.executor.run('grid.effector', Object.assign({ type: 'plain', scale: 0, colour: '#FFFFFF', colourMix: 80 }, args));
    assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
    const G = comp._layers.find((l) => l.name === 'MOE Grid 1'), E = comp._layers.find((l) => l.name === 'MOE Effector 1');
    const pal = [1, 2, 3, 4].map((k) => ctl(G, `Colour ${k}`).valueAtTime(0, false));
    for (const t of [comp.time, comp.time + 1, comp.time + 2]) {
      const vals = {}; for (const [name] of EF.CONTROLS) vals[EF.KEY[name]] = ctl(E, name).valueAtTime(t, false); vals.invert = vals.invert === 1;
      const toLocal = EF.localFn({ position: Array.from(tp(E, 'ADBE Position').valueAtTime(t, false)), rotation: tp(E, 'ADBE Rotate Z').valueAtTime(t, false), scale: Array.from(tp(E, 'ADBE Scale').valueAtTime(t, false)) });
      const gp = tp(G, 'ADBE Position').valueAtTime(t, false);
      cards(comp).forEach((L, i) => {
        const p = tp(L, 'ADBE Position').valueAtTime(t, false);
        const want = EF.colourWithEffectors(EF.paletteColour(2, pal, i, 9, 1), [{ values: vals, toLocal }], gp[0] + p[0], gp[1] + p[1]);
        assert.ok(close(fill(L).valueAtTime(t, false), want), `${args.falloff} t ${t} item ${i}: ${fill(L).valueAtTime(t, false)} vs ${want}`);
      });
    }
    if (args.falloff === 'sphere' && !args.falloffCurve) {
      const mid = fill(cards(comp)[4]).valueAtTime(comp.time, false), corner = fill(cards(comp)[0]).valueAtTime(comp.time, false);
      const base = EF.paletteColour(2, pal, 4, 9, 1), base0 = EF.paletteColour(2, pal, 0, 9, 1);
      assert.ok(close(mid, [base[0] + (1 - base[0]) * 0.8, base[1] + (1 - base[1]) * 0.8, base[2] + (1 - base[2]) * 0.8]), 'the centre item takes 80 % white');
      assert.ok(!close(corner, base0) && corner[0] < mid[0] + 0.001, 'a corner on the soft edge is tinted less than the centre');
    }
  }
});

test('Run again: updated in place (one Fill per item); restore removes the Fills and the grid colour controls', async () => {
  const { services, comp } = await grid(4);
  const r1 = await services.executor.run('grid.colour', { mode: 'cycle', palette: 'tomato' });
  select(comp, 'MOE Grid 1');
  const r2 = await services.executor.run('grid.colour', { mode: 'random', palette: 'cyber', seed: 9 });
  assert.equal(r2.status, 'success');
  cards(comp).forEach((L) => assert.equal(L._parade._children.filter((f) => f.name === EF.COLOUR_FX).length, 1, 'never duplicated'));
  await services.executor.restore(r2.checkpointId);
  await services.executor.restore(r1.checkpointId);
  cards(comp).forEach((L) => assert.ok(!fxOf(L, EF.COLOUR_FX), 'Fill removed'));
  const G = comp._layers.find((l) => l.name === 'MOE Grid 1');
  assert.ok(!fxOf(G, 'Colour Mode') && !fxOf(G, 'Colour 1'), 'grid colour controls removed');
  // nothing selected that belongs to a grid → refused before anything is made
  comp._layers.forEach((l) => { l.selected = false; });
  const r3 = await services.executor.run('grid.colour', { mode: 'cycle', palette: 'tomato' });
  assert.notEqual(r3.status, 'success');
});

test('An effector with only a colour is valid; with nothing to do it is refused; Clone Colours + Tint are in the library', () => {
  const S = require('../extension/app/ui/studio/sections');
  const lay = S.byId('layout');
  const colourTiles = lay.tiles.filter((t) => t.tool === 'grid.colour');
  assert.deepEqual(colourTiles.map((t) => t.args.mode), ['cycle', 'gradient', 'random']);
  assert.ok(colourTiles.every((t) => t.tags.includes('Clone')), 'colour tiles sit in the Clone mode');
  const tint = lay.tiles.find((t) => t.id === 'efTint');
  assert.ok(tint && tint.args.colourMix > 0 && !tint.args.scale);
  const AE = require('../extension/app/ui/layoutAE');
  const arr = AE.TABS.find((t) => t.id === 'ae-layer').groups.find((g) => g.id === 'arrange');
  const modeIds = Object.fromEntries(arr.modes.map(([m, , ids]) => [m, ids]));
  assert.equal(modeIds.clone.length % 3, 0, 'Clone mode fills its rows');
  assert.equal(modeIds.effect.length % 4, 0, 'Effectors mode fills its rows');
  assert.ok(modeIds.clone.includes('colGradient') && modeIds.effect.includes('efTint'));
});
