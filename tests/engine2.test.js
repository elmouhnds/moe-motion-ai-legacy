'use strict';
/**
 * v0.61 Engine 2 (docs/features/ENGINE2.md) — the rules from the owner's AE panel study:
 * one Ctrl+Z per run, keys on the frame grid, few host round trips, locked layers respected, reasons visible.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const base = require('../dev/preview-fixture.js');
const clone = () => JSON.parse(JSON.stringify(base));
const CLICK = { kind: 'arrow', from: 'corner', gap: 1.1, travel: 0.55, depth: 94, ripple: true, size: 40, color: '#FFFFFF' };

test('one Ctrl+Z per run: a tool with many host writes opens exactly ONE undo group, named after it, and closes it', async () => {
  const f = clone(); f.comp.layers.forEach((l) => { l.selected = l.name === 'Title' || l.name === 'Logo'; });
  const { services, env } = await createTestServices(f);
  const g0 = env.undo.groups.length;
  const r = await services.executor.run('interact.click', CLICK); // measure + cursor + keys = 4 writing ops
  assert.equal(r.status, 'success');
  assert.deepEqual(env.undo.groups.slice(g0), ['MOE: Click on Layer']);
  assert.equal(env.undo.depth, 0, 'closed');
  await services.executor.restore(r.checkpointId);
  assert.deepEqual(env.undo.groups.slice(g0 + 1), ['MOE: Restore Click on Layer'], 'Restore is one step too');
  assert.equal(env.undo.depth, 0);
});

test('the run\'s undo group is closed even when the tool fails half way', async () => {
  const { services, env } = await createTestServices(clone());
  services.registry.register({
    id: 'test.failsHalfWay', version: '1.0.0', category: 'tools', name: 'Fails Half Way', description: 'writes once, then throws',
    params: {}, requires: { comp: true, minLayers: 1 }, permissions: ['modify.layers'], recovery: 'undo', verify: () => ({ ok: true, checks: [] }),
    async execute({ ctx, host }) { await host.call('layers.bounds', { compId: ctx.comp.id, layerIds: [ctx.layers[0].id], times: [0] }); throw new Error('boom'); }
  });
  const r = await services.executor.run('test.failsHalfWay', {});
  assert.equal(r.status, 'failed');
  assert.equal(env.undo.depth, 0, 'no undo group left open');
  assert.equal((await services.host.call('tx.state', {})).open, false);
});

test('a transaction left open (crashed panel) is closed by the next one, never nested', async () => {
  const { services, env } = await createTestServices(clone());
  await services.host.call('tx.begin', { label: 'MOE: stale' });
  const r = await services.host.call('tx.begin', { label: 'MOE: next' });
  assert.equal(r.closedStale, 'MOE: stale');
  assert.equal(env.undo.depth, 1, 'only the new group is open');
  await services.host.call('tx.end', {});
  assert.equal(env.undo.depth, 0);
});

test('read-only tools open no transaction (no undo entry for looking)', async () => {
  const { services, env } = await createTestServices(clone());
  const ro = services.registry.list().filter((t) => (t.permissions || []).every((p) => p === 'read'));
  assert.ok(ro.length > 0, 'there are read-only tools');
  const g0 = env.undo.groups.length;
  for (const t of ro) await services.executor.run(t.id, {}).catch(() => null);
  assert.deepEqual(env.undo.groups.slice(g0).filter((g) => ro.some((t) => g === `MOE: ${t.name}`)), []);
  assert.equal(env.undo.depth, 0);
});

const FG = require('../extension/core/framegrid');
/** Every key on every property of every layer, as absolute times. */
function allKeyTimes(comp) {
  const out = [];
  const walk = (node, name) => {
    if (!node) return;
    if (node._keys && node._keys.length) node._keys.forEach((k) => out.push({ t: k.t, name }));
    (node._children || []).forEach((c) => walk(c, `${name} › ${c.name}`));
    if (node._parade) walk(node._parade, `${name} › fx`);
  };
  comp._layers.forEach((L) => { walk(L.property('ADBE Transform Group'), L.name); walk(L.property('ADBE Effect Parade'), L.name); walk(L.property('ADBE Root Vectors Group'), L.name); });
  return out;
}

for (const fps of [24, 30, 60]) {
  test(`keys on the frame grid at ${fps} fps: Quick Animate (stagger + blur), Shake, Click on Layer write no key between frames`, async () => {
    const runs = [
      ['quick.animate', { kind: 'moveBT', dir: 'in', distance: 40, fade: true, blur: 12, stagger: 0.06, ease: 'smooth', duration: 0.7, order: 'screen' }],
      ['quick.shake', { type: 'jitter', intensity: 10, rotation: 1.5, frequency: 22, settle: 0.5 }],
      ['interact.click', CLICK]
    ];
    for (const [id, args] of runs) {
      const f = clone(); f.comp.frameRate = fps; f.comp.layers.forEach((l) => { l.selected = ['Title', 'Subtitle', 'Logo'].includes(l.name); l.transform.forEach((p) => { p.keys = []; }); });
      const { services, comp } = await createTestServices(f);
      const r = await services.executor.run(id, args);
      assert.equal(r.status, 'success', `${id}: ${JSON.stringify(r.errors || r.verification)}`);
      const off = allKeyTimes(comp).filter((k) => !FG.onGrid(k.t, 1 / fps));
      assert.deepEqual(off, [], `${id} @ ${fps} fps: keys between frames`);
    }
  });
}

test('frame grid merge rule: ends always survive, otherwise the key nearest the frame; times only move to the nearest frame', () => {
  const fd = 1 / 24;
  const r = FG.snapKeys([{ t: 0, v: 0 }, { t: 0.01, v: 5 }, { t: 0.03, v: 9 }, { t: 0.5, v: 2 }, { t: 0.51, v: 0 }], fd);
  assert.deepEqual(r.keys.map((k) => k.v), [0, 9, 0], 'first and last kept, 0.03 (nearer 1 frame) kept');
  assert.equal(r.merged, 2);
  for (const k of r.keys) assert.ok(FG.onGrid(k.t, fd));
});

test('few host round trips: a 12-key shake on 3 layers and a 3-target click cost a handful of calls, not one per key', async () => {
  for (const [id, args, max] of [['quick.shake', { type: 'slam', intensity: 55, rotation: 8, frequency: 9, settle: 0.7 }, 16], ['interact.click', CLICK, 12]]) {
    const f = clone(); f.comp.layers.forEach((l) => { l.selected = ['Title', 'Subtitle', 'Logo'].includes(l.name); });
    const { services } = await createTestServices(f);
    const real = services.host.call.bind(services.host);
    let n = 0;
    services.host.call = (op, a, o) => { n++; return real(op, a, o); };
    const r = await services.executor.run(id, args);
    assert.equal(r.status, 'success');
    assert.ok(n <= max, `${id}: ${n} host calls (≤ ${max})`);
  }
});

test('locked layers: the panel button and the executor give the same answer (one rule, core/lockpolicy.js)', async () => {
  const f = clone(); f.comp.layers.forEach((l) => { if (l.selected) l.locked = true; });
  const { services } = await createTestServices(f);
  const ctx = await services.executor.readContext();
  const { availability } = require('../extension/app/ui/toolBlock');
  for (const id of ['quick.trimPaths', 'expressions.quick', 'quick.precompose', 'interact.click', 'quick.animate']) {
    const tool = services.registry.get(id);
    const defs = Object.fromEntries(Object.entries(tool.params || {}).filter(([, p]) => p.default !== undefined).map(([k, p]) => [k, p.default]));
    const av = availability(tool, ctx, defs, services);
    const c = await services.executor.check(id, defs);
    assert.equal(av.ok, false, `${id}: the button is off`);
    assert.match(av.hint, /locked/, `${id}: and says why`);
    assert.equal(c.ok, false, `${id}: the executor refuses too`);
  }
  // a tool that only looks at the layer still works on a locked one
  assert.equal(require('../extension/core/lockpolicy').apply(services.registry.get('zoom.focus'), ctx).ctx.layers.length, ctx.layers.length);
});

test('selftest.undoOnce can never undo the user\'s work: MOE labels only, on the self-test comp only', async () => {
  const { services } = await createTestServices(clone());
  await assert.rejects(services.host.call('selftest.undoOnce', { label: 'Move Layer' }), /MOE undo step/);
  await assert.rejects(services.host.call('selftest.undoOnce', { label: 'MOE: Quick Animate' }), /self-test comp/);
});

test('60 layers (the study\'s performance case): Quick Animate and Shake cost the same few host calls as 3 layers', async () => {
  const { studioComp } = require('./fixtures/studio');
  const { TA } = require('./fixtures/layout');
  const mk = (n) => studioComp(Array.from({ length: n }, (_, i) => ({ name: `L${i}`, selected: true, transform: TA({ pos: [100 + (i % 10) * 170, 100 + Math.floor(i / 10) * 150] }), rect: { left: -40, top: -40, width: 80, height: 80 } })), { comp: { time: 1 } });
  for (const [id, args] of [['quick.animate', { kind: 'moveBT', dir: 'in', fade: true, blur: 12, stagger: 0.03, order: 'screen' }], ['quick.animate', { kind: 'scale', dir: 'in', overshoot: true, fade: true }], ['quick.shake', { type: 'slam' }]]) {
    const calls = [];
    for (const n of [3, 60]) {
      const { services } = await createTestServices(mk(n));
      const real = services.host.call.bind(services.host); let c = 0;
      services.host.call = (op, a, o) => { c++; return real(op, a, o); };
      assert.equal((await services.executor.run(id, args)).status, 'success');
      calls.push(c);
    }
    assert.equal(calls[1], calls[0], `${id} ${args.kind || args.type}: ${calls[0]} calls for 3 layers, ${calls[1]} for 60`);
    assert.ok(calls[1] <= 8, `${id}: ${calls[1]} ≤ 8`);
  }
});
