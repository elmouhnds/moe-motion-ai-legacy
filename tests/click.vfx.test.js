'use strict';
/**
 * v0.98 — Click VFX (docs/features/CLICK_VFX.md), the Matte FX controller null, and the bundled previews' freshness.
 * Mock only: what the effects look like in After Effects is the Self-Test (clickFx) and the owner's eyes.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTestServices } = require('./helpers/harness');
const { gridItems } = require('./fixtures/layout');
const CP = require('../extension/features/interact/clickFxPlan');

async function setup(n = 1) {
  const r0 = await createTestServices(gridItems(n));
  r0.comp._layers.forEach((l) => { l.selected = /^Card/.test(l.name); });
  return r0;
}

test('Click VFX: every style is a stack on the click point — one Ctrl+Z, a controller with only its look-and-feel values, Restore', async () => {
  for (const style of Object.keys(CP.STYLES)) {
    const r0 = await setup(1);
    const e0 = r0.env.undo.entries.length;
    const r = await r0.services.executor.run('interact.clickFx', { style }, { approved: true });
    assert.equal(r.status, 'success', `${style}: ${JSON.stringify(r.verification || r.errors)}`);
    const steps = r0.env.undo.entries.slice(e0).filter((x) => !/Measure/.test(x));
    assert.deepEqual(steps, [`MOE: ${CP.STYLES[style].label}`], `${style}: one real undo step`);
    const p = CP.build({ style });
    const ctl = r0.comp._layers.find((l) => l.name === 'MOE Click 1 Controls');
    assert.ok(ctl, 'the controller null');
    assert.deepEqual(ctl._parade._children.map((f) => f.name), p.controls.map((c) => c.key), 'only the style\'s own controls');
    assert.ok(p.controls.length <= 4, 'no crowd of sliders');
    const ring = r0.comp._layers.find((l) => l.name === `MOE Click 1 ${p.layers[0].role}`);
    assert.match(ring.property('ADBE Transform Group').property('ADBE Scale').expression, /MOE Click[\s\S]*Size %/);

    // v0.99.7 (core/holder.js): the controller is the real holder — every ring is parented to it, so one layer
    // moves, scales and rotates the whole click. It must sit at identity (anchor = position), because
    // layers.setParent uses setParentWithJump and does not compensate: a null left at After Effects' own [0, 0]
    // anchor would have thrown every ring across the comp by the click point.
    const tg = ctl.property('ADBE Transform Group');
    assert.deepEqual(
      Array.from(tg.property('ADBE Anchor Point').value).slice(0, 2),
      Array.from(tg.property('ADBE Position').value).slice(0, 2),
      `${style}: the holder is at identity, so parenting moves nothing`
    );
    for (const L of p.layers) {
      const part = r0.comp._layers.find((l) => l.name === `MOE Click 1 ${L.role}`);
      assert.equal(part._parent, ctl, `${style}: ${L.role} hangs off the controller`);
    }
    await r0.services.executor.restore(r.checkpointId);
    assert.ok(!r0.comp._layers.some((l) => /^MOE Click/.test(l.name)), `${style}: Restore removes every layer it made`);
  }
});

test('Click VFX: the plan — rings grow 0 → 100 % and fade, Pixel uses 48 × 27 Mosaic blocks, Burst scatters 0 → 160', () => {
  const P = require('../extension/features/quick/animatePlan');
  const rp = CP.build({ style: 'ripple' });
  const ring = rp.layers[0];
  assert.deepEqual(P.valueAt(ring.keys.scale, 0), [0, 0]);
  assert.deepEqual(P.valueAt(ring.keys.scale, rp.end), [100, 100]);
  assert.equal(P.valueAt(ring.keys.opacity, rp.end), 0);
  const px = CP.build({ style: 'pixel' }).layers[0].effects.find((e) => e.matchName === 'ADBE Mosaic');
  assert.deepEqual(px.params.map((q) => q.value), [48, 27]);
  const b = CP.build({ style: 'burst' }).layers[0];
  assert.equal(P.valueAt(b.keys.scatter, 0), 0); assert.equal(P.valueAt(b.keys.scatter, 5), 160);
});

test('Matte FX controller: one null per run with only the controls the style uses, linked into the pre-comps', async () => {
  const r0 = await setup(2);
  const r = await r0.services.executor.run('reveal.fx', { preset: 'burnIn' }, { approved: true });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const ctl = r0.comp._layers.filter((l) => /^MOE FX \d+ Controls$/.test(l.name));
  assert.equal(ctl.length, 1, 'one controller for the whole run (2 layers)');
  assert.deepEqual(ctl[0]._parade._children.map((f) => f.name), ['Softness', 'Noise', 'Noise Size', 'Boil %', 'Edge Colour', 'Glow']);
  const A = r0.env.project._items.find((x) => x.name === 'MOE FX 1 Matte');
  const soft = A._layers.find((x) => x.name === 'MOE FX Wipe')._parade._children.find((x) => x.name === 'MOE FX Wipe').property('Transition Softness');
  assert.match(soft.expression, /MOE FX[\s\S]*comp\("[^"]+"\)\.layer\("MOE FX 1 Controls"\)\.effect\("Softness"\)/);
  const r2 = await (await setup(1)).services.executor.run('reveal.fx', { preset: 'cloudIris' }, { approved: true });
  assert.ok(!r2.result.layers[0].controls.includes('Edge Colour') && !r2.result.layers[0].controls.includes('Warp'), 'no edge → no edge controls');
});

test('bundled previews: every one matches its tile\'s current tool, version and args (re-render with npm run previews)', () => {
  const dir = path.join(__dirname, '..', 'extension', 'assets', 'previews');
  const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  const { SECTIONS } = require('../extension/app/ui/studio/sections');
  const R = require('../extension/features/previews/renderer');
  const { Registry } = require('../extension/core/registry');
  const reg = require('../extension/features/index').registerAll(new Registry());
  const tiles = new Map(SECTIONS.filter((s) => s.kind === 'library' && Array.isArray(s.tiles)).flatMap((s) => s.tiles).map((t) => [R.keyOf(t), t]));
  const stale = Object.entries(idx).filter(([k, e]) => { const t = tiles.get(k); return t && e.sig !== R.sigOf(reg.get(t.tool), t); }).map(([k]) => k);
  assert.deepEqual(stale, [], 'stale previews — run: npm run previews');
  for (const [k, e] of Object.entries(idx)) assert.ok(fs.existsSync(path.join(dir, e.file)), `${k}: ${e.file}`);
  assert.ok(Object.keys(idx).length >= 100, 'about all motion / reveal / click tiles are rendered');
});
