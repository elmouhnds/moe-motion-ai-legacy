'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const fx = require('./fixtures/comps');

test('Smart Ease: correct dimension count per value type, verified by read-back', async () => {
  const { services, env } = await createTestServices(fx.easeComp());
  const r = await services.executor.run('motion.smartEase', { influenceIn: 80, influenceOut: 20 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const byName = Object.fromEntries(r.result.targets.map((t) => [t.address.matchNames[1], t]));
  assert.equal(byName['ADBE Position'].dims, 1);   // spatial → 1 ease
  assert.equal(byName['ADBE Scale'].dims, 3);      // ThreeD → 3 eases
  assert.equal(byName['ADBE Opacity'].dims, 1);
  assert.equal(byName['ADBE Position'].after[1].easeIn[0].influence, 80);
  assert.equal(byName['ADBE Position'].after[1].easeOut[0].influence, 20);
  assert.equal(env.undo.depth, 0, 'undo groups balanced');
  assert.deepEqual(env.undo.groups, ['MOE: Smart Ease']);
});

test('Smart Ease: HOLD sides are preserved, not converted', async () => {
  const { services } = await createTestServices(fx.easeComp());
  const r = await services.executor.run('motion.smartEase', {});
  const op = r.result.targets.find((t) => t.address.matchNames[1] === 'ADBE Opacity');
  assert.equal(op.after[1].inInterp, 'HOLD');
  assert.equal(op.after[1].outInterp, 'HOLD');
  assert.equal(op.after[0].outInterp, 'BEZIER');
  assert.equal(r.status, 'success');
});

test('Smart Ease: checkpoint restores exact previous ease and interpolation', async () => {
  const { services, comp } = await createTestServices(fx.easeComp());
  const prop = comp.layer(1).property(1).property(1);
  const before = JSON.stringify(prop._keys.map((k) => [k.inInterp, k.outInterp, k.easeIn, k.easeOut]));
  const r = await services.executor.run('motion.smartEase', { influenceIn: 90, influenceOut: 90 });
  assert.ok(r.checkpointId);
  assert.notEqual(JSON.stringify(prop._keys.map((k) => [k.inInterp, k.outInterp, k.easeIn, k.easeOut])), before);
  const back = await services.executor.restore(r.checkpointId);
  assert.ok(back.ok, JSON.stringify(back));
  assert.equal(JSON.stringify(prop._keys.map((k) => [k.inInterp, k.outInterp, k.easeIn, k.easeOut])), before);
  const again = await services.executor.restore(r.checkpointId);
  assert.equal(again.ok, false, 'a checkpoint restores once');
});

test('Smart Ease: invalid params never reach the host', async () => {
  const { services, env } = await createTestServices(fx.easeComp());
  const r = await services.executor.run('motion.smartEase', { influenceIn: 0 });
  assert.equal(r.status, 'blocked');
  assert.equal(r.stage, 'validate');
  const r2 = await services.executor.run('motion.smartEase', { bogus: 1 });
  assert.equal(r2.status, 'blocked');
  assert.equal(env.undo.groups.length, 0);
});

test('Smart Ease: blocked when no keyframes selected', async () => {
  const fixture = fx.easeComp();
  fixture.comp.layers[0].transform.forEach((p) => p.keys.forEach((k) => { k.selected = false; }));
  const { services } = await createTestServices(fixture);
  const r = await services.executor.run('motion.smartEase', {});
  assert.equal(r.status, 'blocked');
  assert.match(r.errors[0], /No keyframes selected/);
  const all = await services.executor.run('motion.smartEase', { scope: 'all' });
  assert.equal(all.status, 'success');
});

for (const fps of [23.976, 24, 25, 29.97, 30, 50, 59.94, 60]) {
  test(`Stagger: frame-exact at ${fps} fps`, async () => {
    const { services, comp } = await createTestServices(fx.staggerComp(fps));
    const r = await services.executor.run('motion.stagger', { frames: 3, order: 'index' });
    assert.equal(r.status, 'success', JSON.stringify(r.verification));
    comp._layers.forEach((l, i) => {
      const frames = l.startTime / comp.frameDuration;
      assert.ok(Math.abs(frames - i * 3) < 1e-6, `layer ${l.name} at ${frames} frames`);
    });
  });
}

test('Stagger: selection order and reverse order', async () => {
  const { services, comp } = await createTestServices(fx.staggerComp(25));
  await services.executor.run('motion.stagger', { frames: 1, order: 'selection' });
  const f = (n) => Math.round(comp._layers.find((l) => l.name === n).startTime * 25);
  assert.deepEqual(['C', 'A', 'D', 'B'].map(f), [0, 1, 2, 3]);
  const h2 = await createTestServices(fx.staggerComp(25));
  await h2.services.executor.run('motion.stagger', { frames: 2, order: 'reverse' });
  assert.deepEqual(h2.comp._layers.map((l) => Math.round(l.startTime * 25)), [6, 4, 2, 0]);
});

test('Stagger: random order is reproducible with a seed', async () => {
  const a = await createTestServices(fx.staggerComp(25));
  const b = await createTestServices(fx.staggerComp(25));
  await a.services.executor.run('motion.stagger', { frames: 1, order: 'random', seed: 7 });
  await b.services.executor.run('motion.stagger', { frames: 1, order: 'random', seed: 7 });
  assert.deepEqual(a.comp._layers.map((l) => l.startTime), b.comp._layers.map((l) => l.startTime));
});

test('Stagger: locked layers are skipped and reported', async () => {
  const { services, comp } = await createTestServices(fx.staggerComp(25, 1));
  const c = await services.executor.check('motion.stagger', { frames: 2 });
  // v0.61: the executor takes locked layers out before the tool sees them, and names them in the summary
  assert.ok(/locked/.test(c.prepared.preview.summary) || c.prepared.preview.items.some((i) => /locked/.test(i)));
  const r = await services.executor.run('motion.stagger', { frames: 2 });
  assert.equal(r.status, 'success');
  assert.equal(comp._layers[1].startTime, 0);
});

test('Stagger: keyframes move with the layer, and restore puts them back', async () => {
  const { services, comp } = await createTestServices(fx.staggerComp(25));
  const prop = comp.layer(4).property(1).property(1);
  const t0 = prop.keyTime(2);
  const r = await services.executor.run('motion.stagger', { frames: 5, order: 'index' });
  assert.ok(Math.abs(prop.keyTime(2) - (t0 + 15 / 25)) < 1e-9);
  await services.executor.restore(r.checkpointId);
  assert.ok(Math.abs(prop.keyTime(2) - t0) < 1e-9);
});

test('Stagger: large selection (300 layers) completes in one host call', async () => {
  const fixture = { comp: { name: 'Big', frameRate: 30, duration: 60, layers: Array.from({ length: 300 }, (_, i) => ({ name: `L${i}`, selected: true, transform: [] })) } };
  const { services, env } = await createTestServices(fixture);
  services.settings.update({ limits: { maxLayers: 500 } });
  const r = await services.executor.run('motion.stagger', { frames: 1 });
  assert.equal(r.status, 'success');
  assert.equal(r.result.layers.length, 300);
  assert.equal(env.undo.groups.length, 1);
});

test('Context limit: selections beyond maxLayers are truncated and flagged', async () => {
  const fixture = { comp: { name: 'Big', frameRate: 30, duration: 60, layers: Array.from({ length: 250 }, (_, i) => ({ name: `L${i}`, selected: true, transform: [] })) } };
  const { services } = await createTestServices(fixture);
  const ctx = await services.executor.readContext();
  assert.equal(ctx.layers.length, 200);
  assert.equal(ctx.truncated, true);
});

test('History records verified runs', async () => {
  const { services } = await createTestServices(fx.staggerComp(25));
  await services.executor.run('motion.stagger', { frames: 2 });
  const h = services.executor.history();
  assert.equal(h[0].toolId, 'motion.stagger');
  assert.equal(h[0].status, 'success');
  assert.ok(h[0].checkpointId);
});
