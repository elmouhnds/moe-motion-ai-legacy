'use strict';
/**
 * v0.96 — Matte FX (docs/features/MATTE_FX.md) and rendered previews (docs/features/RENDERED_PREVIEWS.md).
 * The mock checks the wiring (pre-comps, mattes, edge, keys, one undo step, Restore, the Render Queue use); it does not
 * render. Real effect names and real frames are the Self-Test checks fxMatte and renderPreview, in After Effects.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { gridItems } = require('./fixtures/layout');
const F = require('../extension/features/reveal/fxPlan');
const PR = require('../extension/features/previews/renderer');
const { SECTIONS } = require('../extension/app/ui/studio/sections');

const cards = (comp) => comp._layers.filter((l) => /^Card/.test(l.name));
async function setup(n = 1) {
  const r0 = await createTestServices(gridItems(n));
  r0.comp._layers.forEach((l) => { l.selected = /^Card/.test(l.name); });
  return r0;
}

test('plan: every effect starts hidden and ends shown (Gradient Wipe rule), Out is the reverse; the matte sits on the layer', () => {
  const rect = [-200, -80, 400, 160];
  for (const id of Object.keys(F.PRESETS)) {
    const p = F.build({ preset: id }, rect), o = F.build({ preset: id, dir: 'out' }, rect);
    for (const v of [0, 0.3, 0.7, 1]) {
      const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, m);
      near(F.shownAt(p, 0, v), 0, `${id} hidden at the start (map ${v})`);
      near(F.shownAt(p, p.end, v), 1, `${id} shown at the end`);
      near(F.shownAt(o, 0, v), 1, `${id} out starts shown`); near(F.shownAt(o, o.end, v), 0, `${id} out ends hidden`);
    }
    assert.deepEqual(p.anchor, [p.margin + 200, p.margin + 80], 'pre-comp pixel (m, m) = the layer box corner');
    assert.equal(p.size[0], 400 + 2 * p.margin);
  }
  const burn = F.build({ preset: 'burnIn', edge: false }, rect);
  assert.equal(burn.edge, null, 'the glowing edge can be turned off');
  assert.throws(() => F.build({ preset: 'inkBleed' }, [0, 0, 9000, 100]), /too large/);
});

test('tool: Map / Matte / Edge pre-comps, alpha matte + glowing linked copy (luma), one Ctrl+Z; Restore removes everything', async () => {
  const r0 = await setup(1);
  const P = r0.env.project, items0 = P._items.length, e0 = r0.env.undo.entries.length;
  const r = await r0.services.executor.run('reveal.fx', { preset: 'burnIn', dir: 'in' }, { approved: true });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.deepEqual(r0.env.undo.entries.slice(e0), ['MOE: Matte FX']);
  const names = P._items.slice(items0).map((x) => x.name);
  for (const n of ['MOE FX 1 Map', 'MOE FX 1 Matte', 'MOE FX 1 Edge']) assert.ok(names.includes(n), n);
  const L = cards(r0.comp)[0], layers = r0.comp._layers;
  const matte = layers.find((x) => x.name === 'MOE FX 1 Matte'), glow = layers.find((x) => x.name === 'MOE FX 1 Glow'), em = layers.find((x) => x.name === 'MOE FX 1 Edge Matte');
  assert.equal(L._matte, matte); assert.equal(L.trackMatteType, 5013, 'alpha');
  assert.equal(glow._matte, em); assert.equal(glow.trackMatteType, 5015, 'luma');
  assert.equal(matte._parent, L); assert.equal(em._parent, L); assert.equal(glow._parent, L);
  assert.equal(matte.enabled, false); assert.equal(em.enabled, false);
  assert.deepEqual(Array.from(matte.property('ADBE Transform Group').property('ADBE Anchor Point').value), F.build({ preset: 'burnIn' }, (() => { const q = L.sourceRectAtTime(0); return [q.left, q.top, q.width, q.height]; })()).anchor);
  // inside the Matte: Gradient Wipe reads the (hidden) Map layer, Completion keyed 100 % → 0 % — written 1 → 0 (v0.99.1: a fraction
  // to a script in After Effects 26.5, Tile Test)
  const A = P._items.find((x) => x.name === 'MOE FX 1 Matte');
  const wipe = A._layers.find((x) => x.name === 'MOE FX Wipe'), mapL = A._layers.find((x) => x.name === 'MOE FX 1 Map');
  const gw = wipe._parade._children.find((x) => x.name === 'MOE FX Wipe');
  assert.equal(gw.property('Gradient Layer').value, mapL.index);
  const tc = gw.property('Transition Completion');
  assert.equal(tc.numKeys, 2); assert.equal(tc.keyValue(1), 1); assert.equal(tc.keyValue(2), 0);
  assert.ok(gw.property('Transition Softness').value <= 1, 'Softness written as a fraction');
  assert.equal(mapL.enabled, false);
  // the Edge comp: the matte against itself a moment later, Difference
  const E = P._items.find((x) => x.name === 'MOE FX 1 Edge');
  const late = E._layers.find((x) => /later/.test(x.name));
  assert.ok(late.startTime > 0); assert.equal(late.blendingMode, 5214);
  const e1 = r0.env.undo.entries.length;
  await r0.services.executor.restore(r.checkpointId);
  assert.deepEqual(r0.env.undo.entries.slice(e1), ['MOE: Restore Matte FX']);
  assert.ok(!r0.comp._layers.some((x) => /^MOE FX/.test(x.name)));
  assert.ok(!P._items.some((x) => /^MOE FX/.test(x.name)), 'the pre-comps are gone');
  assert.ok(!L._matte);
});

test('tool: a layer with a track matte or 3D is skipped and named; nothing usable = nothing written', async () => {
  const r0 = await setup(2);
  const [A, B] = cards(r0.comp);
  B.threeDLayer = true;
  const own = r0.comp.layers.addSolid([1, 1, 1], 'My Matte', 100, 100, 1, 10);
  A.setTrackMatte(own, 5015);
  const e0 = r0.env.undo.entries.length;
  const r = await r0.services.executor.run('reveal.fx', { preset: 'inkBleed' }, { approved: true });
  assert.notEqual(r.status, 'success');
  assert.match(JSON.stringify(r.errors), /My Matte/);
  assert.deepEqual(r0.env.undo.entries.slice(e0), []);
});

test('rendered previews: one comp per tile, the tool with the tile\'s args, an image sequence through the Render Queue (format from a template, v0.99.1); nothing left; the user\'s queue kept; cached until the args change', async () => {
  const r0 = await setup(1);
  const P = r0.env.project, items0 = P._items.length;
  P.renderQueue.items.add(P._items[0]);
  const tiles = SECTIONS.find((s) => s.id === 'animate').tiles.filter((t) => ['fx-burnIn', 'mtCard', 'riseFade'].includes(t.id));
  const out = await PR.renderTiles(r0.services, tiles, {});
  assert.deepEqual(out.failed, []);
  assert.equal(out.rendered.length, 3);
  assert.equal(P._items.length, items0, 'no comp, pre-comp or solid left in the project');
  // After Effects 26.5: Format is read-only — the format comes from a template (no JPEG one in the mock's list → PNG)
  assert.deepEqual(P.renderQueue.renders.map((x) => x.format), ['PNG Sequence', 'PNG Sequence', 'PNG Sequence']);
  assert.ok(P.renderQueue.renders.every((x) => /\.png$/.test(x.file)));
  assert.ok(P.renderQueue.renders.every((x) => /^MOE Self-Test Preview$/.test(x.comp) && /\/MOE Motion AI\/previews\//.test(x.file)));
  assert.deepEqual(P.renderQueue._items.map((i) => [i.render, i.status]), [[true, 2615]], 'the user\'s item is still queued and on');
  const idx = r0.services.store.get('previews', {});
  assert.equal(Object.keys(idx.items).length, 3);
  const again = await PR.renderTiles(r0.services, tiles, {});
  assert.ok(again.rendered.every((x) => x.cached));
  const changed = tiles.map((t) => (t.id === 'riseFade' ? Object.assign({}, t, { args: Object.assign({}, t.args, { duration: 1.3 }) }) : t));
  const third = await PR.renderTiles(r0.services, changed, {});
  for (const x of third.rendered) assert.equal(!!x.cached, x.id !== 'riseFade', `${x.id}: only the changed tile renders again`);
  // a tool with no preview scene is listed, never faked
  const p = PR.plan([{ id: 'x', tool: 'grid.build', args: {} }], r0.services.registry);
  assert.equal(p.ok.length, 0); assert.match(p.skip[0].why, /not rendered yet/);
});

test('host: previews.render renders only a MOE Self-Test comp, only under previews/, with a safe name', async () => {
  const r0 = await setup(1);
  await assert.rejects(r0.services.host.call('previews.render', { compId: r0.comp.id, name: 'x' }), /MOE Self-Test/);
  const b = await r0.services.host.call('selftest.begin', { name: 'MOE Self-Test X', width: 100, height: 100, duration: 1, frameRate: 10 });
  await assert.rejects(r0.services.host.call('previews.render', { compId: b.compId, name: '../evil' }), /a-z, 0-9/);
  const ok = await r0.services.host.call('previews.render', { compId: b.compId, name: 'ok-1', duration: 0.5 });
  assert.equal(ok.frames, 5);
  assert.match(ok.folder, /\/MOE Motion AI\/previews\/ok-1$/);
});

test('grammar (v0.97): 3,888 combinations, each hidden → shown; Pixel uses Block / Max noise, Stepped adds Posterize Time, Rain stretches the noise; Shuffle keeps locks', async () => {
  const G = require('../extension/features/reveal/grammar');
  assert.equal(G.COUNT, 9 * 9 * 6 * 8);
  const rect = [-200, -80, 400, 160];
  for (const shape of Object.keys(G.SHAPES)) for (const material of Object.keys(G.MATERIALS)) {
    const p = F.build({ preset: 'compose', shape, material, motion: 'smooth', palette: 'cyan', originX: 10, originY: 90 }, rect);
    for (const v of [0, 0.5, 1]) { assert.ok(Math.abs(F.shownAt(p, 0, v)) < 1e-9); assert.ok(Math.abs(F.shownAt(p, p.end, v) - 1) < 1e-9); }
  }
  const pt = F.build({ preset: 'compose', shape: 'point', material: 'soft', originX: 0, originY: 0 }, rect);
  assert.deepEqual(pt.ramp.start, [pt.margin, pt.margin], 'the field grows from the chosen point');
  assert.ok(pt.ramp.end[0] - pt.ramp.start[0] >= Math.hypot(400, 160), 'and clears the farthest corner');
  const k0 = G.compose({ shape: 'sweep', material: 'liquid', intensity: 0 }), k1 = G.compose({ shape: 'sweep', material: 'liquid', intensity: 100 });
  assert.ok(k0.noise.mix === 0 && k1.noise.mix > G.MATERIALS.liquid.noise.mix && k1.displace.amount > k0.displace.amount, 'Intensity scales noise and warp together');
  const keep = G.shuffle({ shape: 'iris', material: 'ink', motion: 'snap', palette: 'gold' }, 42, { shape: true, palette: true });
  assert.equal(keep.shape, 'iris'); assert.equal(keep.palette, 'gold');
  assert.deepEqual(G.shuffle({}, 7), G.shuffle({}, 7), 'deterministic per seed');
  // on the mock: Pixel Rain (stepped)
  const r0 = await setup(1);
  const r = await r0.services.executor.run('reveal.fx', { preset: 'compose', shape: 'rain', material: 'pixel', motion: 'stepped', palette: 'cyan' }, { approved: true });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const P = r0.env.project, M = P._items.find((x) => x.name === 'MOE FX 1 Map'), A = P._items.find((x) => x.name === 'MOE FX 1 Matte');
  const fn = M._layers.find((x) => x.name === 'MOE FX Noise')._parade._children.find((x) => x.name === 'MOE FX Noise');
  assert.equal(fn.property('Noise Type').value, 1); assert.equal(fn.property('Fractal Type').value, 11);
  assert.equal(fn.property('Uniform Scaling').value, 0); assert.deepEqual([fn.property('Scale Width').value, fn.property('Scale Height').value], [24, 900]);
  assert.equal(fn.property('Brightness').value, -35);
  const steps = A._layers.find((x) => x.name === 'MOE FX Wipe')._parade._children.find((x) => x.name === 'MOE FX Steps');
  assert.equal(steps.property('Frame Rate').value, 12);
  assert.match(r.verification.checks.map((c) => c.detail).join(' '), /every parameter found by its English name/);
});
