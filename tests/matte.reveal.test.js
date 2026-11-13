'use strict';
/**
 * v0.95 — Matte Reveal (docs/features/MATTE_REVEAL.md): an alpha track matte per layer, nine styles from one plan.
 * The plan's coverage maths, the tool on the mock (one undo step, matte wiring, keys = plan, read-back), the refusals
 * and Restore. The mock does not render a matte: what After Effects SHOWS is checked by the Self-Test, not here.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { gridItems } = require('./fixtures/layout');
const M = require('../extension/features/reveal/mattePlan');
const TM = { ALPHA: 5013, LUMA: 5015 }; // the mock's TrackMatteType values (After Effects' enum)

const RECT = [-200, -80, 400, 160];
const cards = (comp) => comp._layers.filter((l) => /^Card/.test(l.name));
const select = (comp, pred) => comp._layers.forEach((l) => { l.selected = pred(l); });
async function setup(n = 2) {
  const r0 = await createTestServices(gridItems(n));
  select(r0.comp, (l) => /^Card/.test(l.name));
  return r0;
}
const run = (r0, args) => r0.services.executor.run('reveal.matte', Object.assign({ dir: 'in', duration: 1, ease: 'smooth' }, args), { approved: true });

test('plan: every style shows 0 % at the start and all of the layer at the end; Out is the reverse', () => {
  for (const style of Object.keys(M.STYLES)) {
    for (const extra of [{}, { from: 'bottomRight', corner: 'bottomLeft', axis: 'v', order: 'random', alternate: true }, { from: 'top', order: 'center', count: 11, cols: 13 }]) {
      const p = M.build(Object.assign({ style, dir: 'in', duration: 1 }, extra), RECT);
      const full = style === 'card' ? 0.97 : 0.999;
      assert.equal(M.coverage(p, M.valuesAt(p, 0), RECT), 0, `${style} starts hidden`);
      assert.ok(M.coverage(p, M.valuesAt(p, p.end), RECT) >= full, `${style} ends shown`);
      const mid = M.coverage(p, M.valuesAt(p, p.end / 2), RECT);
      assert.ok(mid > 0.05 && mid < 0.95, `${style} half-way shows part (${mid})`);
      const o = M.build(Object.assign({ style, dir: 'out', duration: 1 }, extra), RECT);
      assert.ok(M.coverage(o, M.valuesAt(o, 0), RECT) >= full, `${style} out starts shown`);
      assert.equal(M.coverage(o, M.valuesAt(o, o.end), RECT), 0, `${style} out ends hidden`);
      assert.ok(p.cells.length <= M.LIMITS.cells);
    }
  }
});

test('plan: Wipe goes the way it says, cascades stay inside the duration, Pixels follows the box', () => {
  const left = M.build({ style: 'wipe', from: 'left', duration: 1, ease: 'linear' }, RECT);
  const v = M.valuesAt(left, 0.3);
  assert.ok(M.inside(left.cells[0], v[0], -190, 0) && !M.inside(left.cells[0], v[0], 190, 0), 'from the left: the left side first');
  const top = M.build({ style: 'wipe', from: 'top', duration: 1, ease: 'linear' }, RECT);
  const vt = M.valuesAt(top, 0.3);
  assert.ok(M.inside(top.cells[0], vt[0], 0, -75) && !M.inside(top.cells[0], vt[0], 0, 75), 'from the top: the top first');
  const b = M.build({ style: 'blinds', count: 7, cascade: 0.6, duration: 2 }, RECT);
  assert.equal(b.cells.length, 7);
  for (const tr of b.tracks) assert.ok(tr.keys[0].t >= 0 && tr.keys[tr.keys.length - 1].t <= 2 + 1e-9);
  assert.ok(b.tracks[6].keys[0].t > b.tracks[0].keys[0].t, 'in order: the last bar starts later');
  const px = M.build({ style: 'pixels', cols: 10 }, RECT);
  assert.equal(px.cells.length, 10 * 4, '10 columns × rows from the aspect (160 / 400 × 10 = 4)');
  assert.throws(() => M.build({ style: 'pixels', cols: 16 }, [0, 0, 100, 2000]), /Too many cells/);
});

test('tool: one shape layer per layer, set as its alpha matte, parented, hidden, above it — one Ctrl+Z; keys = plan', async () => {
  const r0 = await setup(2);
  const e0 = r0.env.undo.entries.length;
  const r = await run(r0, { style: 'stripes', count: 5, soft: 6 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.deepEqual(r0.env.undo.entries.slice(e0), ['MOE: Matte Reveal'], 'one undo step');
  for (const L of cards(r0.comp)) {
    const m = L._matte;
    assert.ok(m && m.name === `MOE Matte · ${L.name}`, `${L.name} has its matte`);
    assert.equal(L.trackMatteType, TM.ALPHA);
    assert.equal(m._parent, L, 'the matte follows its layer');
    assert.equal(m.enabled, false, 'the matte layer is hidden');
    const a = r0.comp._layers;
    assert.equal(a.indexOf(m) + 1, a.indexOf(L), 'right above its layer');
    assert.deepEqual(Array.from(m.property('ADBE Transform Group').property('ADBE Position').value), [0, 0]);
    assert.ok(m._parade._children.some((f) => f.name === 'MOE Matte Soft'), 'soft edge');
    // the keys After Effects got are the plan's (times on the frame grid)
    const p = M.build({ style: 'stripes', count: 5, dir: 'in', duration: 1, ease: 'smooth' }, (() => { const q = L.sourceRectAtTime(0); return [q.left, q.top, q.width, q.height]; })());
    const g = m.property('ADBE Root Vectors Group');
    p.tracks.forEach((tr) => {
      const pr = g.property(`Cell ${tr.cell + 1}`).property('ADBE Vector Transform Group').property('ADBE Vector Position');
      assert.equal(pr.numKeys, 2);
      assert.deepEqual(Array.from(pr.keyValue(1)).map(Math.round), tr.keys[0].v.map(Math.round));
      assert.deepEqual(Array.from(pr.keyValue(2)).map(Math.round), tr.keys[1].v.map(Math.round));
    });
  }
  // Restore: the mattes go, the layers have no track matte — one step
  const e1 = r0.env.undo.entries.length;
  await r0.services.executor.restore(r.checkpointId);
  assert.deepEqual(r0.env.undo.entries.slice(e1), ['MOE: Restore Matte Reveal']);
  assert.ok(!r0.comp._layers.some((l) => /^MOE Matte/.test(l.name)));
  assert.ok(cards(r0.comp).every((L) => !L._matte));
});

test('tool: the user\'s own track matte and 3D layers are skipped (named), a MOE matte is replaced, nothing usable = nothing written', async () => {
  const r0 = await setup(3);
  const [A, B, C] = cards(r0.comp);
  const own = r0.comp.layers.addSolid([1, 1, 1], 'My Matte', 100, 100, 1, 10);
  B.setTrackMatte(own, TM.LUMA);
  C.threeDLayer = true;
  const r = await run(r0, { style: 'iris' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.equal(B._matte, own, 'your matte is untouched');
  assert.ok(!C._matte);
  const skipped = r.verification.checks.filter((c) => c.label === 'Skipped').map((c) => c.detail).join(' | ');
  assert.match(skipped, /your track matte "My Matte"/);
  assert.match(skipped, /3D layer/);
  // again on A: the MOE matte is replaced, never two
  select(r0.comp, (l) => l === A);
  const r2 = await run(r0, { style: 'pixels', cols: 6 });
  assert.equal(r2.status, 'success');
  assert.equal(r0.comp._layers.filter((l) => /^MOE Matte/.test(l.name)).length, 1);
  assert.match(A._matte.name, /^MOE Matte/);
  assert.match(r2.verification.checks[0].detail, /replaced MOE Matte · /);
  // only unusable layers: refused before anything is written
  select(r0.comp, (l) => l === B || l === C);
  const e0 = r0.env.undo.entries.length;
  const r3 = await run(r0, { style: 'wipe' });
  assert.notEqual(r3.status, 'success');
  assert.deepEqual(r0.env.undo.entries.slice(e0), [], 'nothing written');
});

test('host: tx.run of a failing plan leaves no matte behind; layers.rects reads without an undo step', async () => {
  const r0 = await setup(1);
  const L = cards(r0.comp)[0];
  const e0 = r0.env.undo.entries.length;
  const rects = await r0.services.host.call('layers.rects', { compId: r0.comp.id, layerIds: [L.id] });
  assert.equal(rects.layers[0].rect.length, 4);
  assert.deepEqual(r0.env.undo.entries.slice(e0), [], 'a read is not an undo step');
  await assert.rejects(r0.services.host.call('shapes.matte', { compId: r0.comp.id, targetId: L.id, name: 'Not MOE', cells: [{ kind: 'rect', size: [1, 1], anchor: [0, 0], position: [0, 0] }] }), /MOE Matte/);
});
