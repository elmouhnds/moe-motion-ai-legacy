'use strict';
const FG = require('../extension/core/framegrid'); // v0.61: keys are written on the comp's frame grid
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { TA } = require('./fixtures/layout');
const { studioComp } = require('./fixtures/studio');
const E = require('../extension/features/expressions/quick');

const near = (a, b, t = 0.01) => Math.abs(a - b) <= t;
const A = (v) => Array.from(v);
const tp = (L, mn) => L.property('ADBE Transform Group').property(mn);
const named = (comp, n) => comp._layers.find((l) => l.name === n);
const keyed = (sel = true) => {
  const tr = TA({ pos: [300, 500] });
  tr[1] = Object.assign({}, tr[1], { keys: [{ time: 0, value: [100, 500], selected: sel }, { time: 1, value: [300, 500], selected: sel }, { time: 3, value: [900, 200], selected: sel }], selected: true });
  return studioComp([
    { name: 'Box', selected: true, transform: tr, rect: { left: -50, top: -50, width: 100, height: 100 } },
    { name: 'Line', shapes: [{ name: 'S', stroke: [1, 1, 1], path: [[0, 0], [100, 0]] }], transform: TA({ pos: [960, 540] }) },
    { name: 'Title', text: 'مرحبا بكم', transform: TA({ pos: [960, 300] }) }
  ], { comp: { time: 4 } });
};
const select = (comp, names) => comp._layers.forEach((l) => { l.selected = names.includes(l.name); });

test('Reverse keyframes: times mirrored inside the span, values swapped; restore rebuilds', async () => {
  const { services, comp } = await createTestServices(keyed());
  const p = tp(named(comp, 'Box'), 'ADBE Position');
  const r = await services.executor.run('quick.reverseKeys', {});
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.deepEqual(p._keys.map((k) => k.t), [0, 2, 3]);
  assert.deepEqual(A(p.keyValue(1)), [900, 200]);
  assert.deepEqual(A(p.keyValue(3)), [100, 500]);
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.deepEqual(p._keys.map((k) => k.t), [0, 1, 3]);
  assert.deepEqual(A(p.keyValue(1)), [100, 500]);
});

test('Clone & Mirror keys at the playhead (out animation)', async () => {
  const { services, comp } = await createTestServices(keyed());
  const p = tp(named(comp, 'Box'), 'ADBE Position');
  const r = await services.executor.run('quick.mirrorKeys', { mode: 'mirror' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.deepEqual(p._keys.map((k) => k.t), [0, 1, 3, 4, 6, 7]);
  assert.deepEqual(A(p.keyValue(4)), [900, 200]);
  assert.deepEqual(A(p.keyValue(6)), [100, 500]);
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.equal(p.numKeys, 3);
});

test('Flip horizontal negates scale on value/keys; restore flips back', async () => {
  const { services, comp } = await createTestServices(keyed());
  const r = await services.executor.run('quick.flip', { axis: 'h' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.deepEqual(A(tp(named(comp, 'Box'), 'ADBE Scale').value), [-100, 100]);
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.deepEqual(A(tp(named(comp, 'Box'), 'ADBE Scale').value), [100, 100]);
});

test('Quick Animate: slide in right→left off-screen ends at the current pose; fade out; restore', async () => {
  const fx = keyed();
  fx.comp.layers[0].transform = TA({ pos: [960, 540] });
  const { services, comp } = await createTestServices(fx);
  const r = await services.executor.run('quick.animate', { kind: 'moveRL', dir: 'in', duration: 0.5, overshoot: true });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const p = tp(named(comp, 'Box'), 'ADBE Position');
  assert.equal(p.numKeys, 3);
  assert.ok(p.keyValue(1)[0] - 50 > 1920, 'starts fully off the right edge');
  assert.deepEqual(A(p.keyValue(3)), [960, 540]);
  assert.ok(p.keyValue(2)[0] < 960, 'overshoot past the rest pose');
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.equal(p.numKeys, 0);
  const f = await services.executor.run('quick.animate', { kind: 'fade', dir: 'out', duration: 1 });
  assert.equal(f.status, 'success');
  const o = tp(named(comp, 'Box'), 'ADBE Opacity');
  assert.deepEqual(o._keys.map((k) => k.value), [100, 0]);
});

test('Trim Paths travel: MOE Trim added, End and Start keyed with lag; restore removes it', async () => {
  const { services, comp } = await createTestServices(keyed());
  select(comp, ['Line']);
  const r = await services.executor.run('quick.trimPaths', { mode: 'travel', duration: 1, lag: 50 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const root = named(comp, 'Line').property('ADBE Root Vectors Group');
  const trim = root._children.find((c) => c.name === 'MOE Trim');
  assert.deepEqual(trim._children[1]._keys.map((k) => k.t), [4, 5]);
  assert.deepEqual(trim._children[0]._keys.map((k) => k.t), [FG.snap(4.5, 1 / 25), FG.snap(5.5, 1 / 25)]);
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.equal(root._children.some((c) => c.name === 'MOE Trim'), false);
});

test('Typewriter on Arabic text uses Words; Counter writes a live Source Text expression', async () => {
  const { services, comp } = await createTestServices(keyed());
  select(comp, ['Title']);
  const t = await services.executor.run('quick.typewriter', { duration: 2 });
  assert.equal(t.status, 'success', JSON.stringify(t.verification || t.errors));
  const anim = named(comp, 'Title').property('ADBE Text Properties').property('ADBE Text Animators').property(1);
  assert.equal(anim.name, 'MOE Typewriter');
  const adv = anim.property('ADBE Text Selectors').property(1).property('ADBE Text Range Advanced');
  assert.equal(adv.property('ADBE Text Range Type2').value, 3, 'words for Arabic');
  const c = await services.executor.run('quick.counter', { from: 0, to: 12500, duration: 1, prefix: '$' });
  assert.equal(c.status, 'success', JSON.stringify(c.verification || c.errors));
  const src = named(comp, 'Title').property('ADBE Text Properties').property('ADBE Text Document');
  assert.match(src.expression, /MOE Counter/);
});

test('Parent to Null, Select Same Property, Pre-compose, Separate X/Y, Duplicate deep, Reveal, Purge', async () => {
  const { services, comp, sandbox } = await createTestServices(keyed());
  select(comp, ['Box', 'Line']);
  const pn = await services.executor.run('quick.parentToNull', { name: 'Ctrl' });
  assert.equal(pn.status, 'success', JSON.stringify(pn.verification || pn.errors));
  const ctrl = named(comp, 'Ctrl');
  assert.ok(named(comp, 'Box').parent === ctrl && named(comp, 'Line').parent === ctrl);
  assert.ok((await services.executor.restore(pn.checkpointId)).ok);
  assert.equal(named(comp, 'Ctrl'), undefined);
  // Select same: Position is selected on Box → select it on Line too.
  const ss = await services.executor.run('quick.selectSame', { scope: 'selected' });
  assert.equal(ss.status, 'success', JSON.stringify(ss.verification || ss.errors));
  assert.equal(tp(named(comp, 'Line'), 'ADBE Position').selected, true);
  const sep = await services.executor.run('quick.separateXY', {});
  assert.equal(sep.status, 'success', JSON.stringify(sep.verification || sep.errors));
  assert.equal(tp(named(comp, 'Box'), 'ADBE Position').dimensionsSeparated, true);
  const dup = await services.executor.run('quick.duplicateComp', { suffix: ' v2' });
  assert.equal(dup.status, 'success');
  assert.ok(sandbox.app.project._items.some((i) => i.name === 'Studio v2'));
  assert.ok((await services.executor.restore(dup.checkpointId)).ok);
  assert.ok(!sandbox.app.project._items.some((i) => i.name === 'Studio v2'));
  const pc = await services.executor.run('quick.precompose', { name: 'Group' });
  assert.equal(pc.status, 'success', JSON.stringify(pc.verification || pc.errors));
  assert.equal(comp.layer(1).source.name, 'Group');
  const rv = await services.executor.run('quick.reveal', { mode: 'project' });
  assert.equal(rv.status, 'success');
  const pu = await services.executor.run('quick.purge', { target: 'image' });
  assert.equal(pu.status, 'success');
  assert.deepEqual(sandbox.app._log.purged, [4]);
});

test('Quick expressions: wiggle on natural target, wiggle X keeps Y, blink, loops need keys, live controls', async () => {
  const { services, comp } = await createTestServices(keyed(false));
  // Position is selected in the fixture → applies there.
  const w = await services.executor.run('expressions.quick', { preset: 'wiggleX', freq: 3, amp: 50 });
  assert.equal(w.status, 'success', JSON.stringify(w.verification || w.errors));
  assert.match(tp(named(comp, 'Box'), 'ADBE Position').expression, /MOE Expr: Wiggle X/);
  tp(named(comp, 'Box'), 'ADBE Position')._selected = false;
  const b = await services.executor.run('expressions.quick', { preset: 'blink', rate: 2, live: true });
  assert.equal(b.status, 'success', JSON.stringify(b.verification || b.errors));
  const o = tp(named(comp, 'Box'), 'ADBE Opacity');
  assert.match(o.expression, /effect\("MOE Blinker Rate"\)/);
  assert.equal(o.valueAtTime(0.1, false), 100);
  assert.equal(o.valueAtTime(0.3, false), 0);
  const l = await services.executor.run('expressions.quick', { preset: 'loopCycle' });
  assert.equal(l.status, 'blocked');
  for (const id of Object.keys(E.PRESETS)) assert.ok(E.code(id, {}, false).startsWith('// MOE Expr'), id);
});
