'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { TA } = require('./fixtures/layout');
const { studioComp } = require('./fixtures/studio');
const P = require('../extension/features/retune/plan');
const FG = require('../extension/core/framegrid');
const { TOOLS } = require('../extension/features');
const box = (name, x, extra) => Object.assign({ name, selected: true, transform: TA({ pos: [x, 300] }), rect: { left: -20, top: -20, width: 40, height: 40 } }, extra || {});
const fd = 1 / 25;
const snap = [
  { t: 1, v: [0, 0], ei: [{ speed: 0, influence: 33 }], eo: [{ speed: 100, influence: 60 }], it: 'BEZIER', ot: 'BEZIER', inTan: [0, 0], outTan: [10, 0] },
  { t: 2, v: [100, 0], ei: [{ speed: 0, influence: 80 }], eo: [{ speed: 0, influence: 33 }], it: 'BEZIER', ot: 'BEZIER', inTan: [-10, 0], outTan: [0, 0] }
];

test('plan.scale: times on the grid around the pivot, influence kept, speed divided by the factor; too short is refused', () => {
  const r = P.scale(snap, 0.5, 1, fd);
  assert.ok(r.ok); assert.deepEqual(r.span, [1, 1.52], '1.5 s is between two frames at 25 fps: it lands on frame 38');
  assert.equal(r.snapshot[0].eo[0].influence, 60); assert.equal(r.snapshot[0].eo[0].speed, 200);
  assert.deepEqual(r.snapshot[0].outTan, [10, 0], 'the path is untouched');
  assert.ok(r.snapshot.every((k) => FG.onGrid(k.t, fd)));
  assert.deepEqual(snap[0].eo[0], { speed: 100, influence: 60 }, 'the input is not changed');
  assert.equal(P.scale(snap, 0.01, 1, fd).ok, false);
  assert.equal(P.scale(snap.slice(0, 1), 2, 1, fd).ok, false);
  const odd = P.scale(snap, 0.37, 1, fd); assert.ok(odd.ok && odd.snapshot.every((k) => FG.onGrid(k.t, fd)));
});

test('plan.place: a copied move starts at the playhead; Position moves with the target, not onto the source', () => {
  const d = P.positionDelta([0, 0], [500, 300]);
  const out = P.place(snap, 3.01, fd, d);
  assert.deepEqual(out.map((k) => k.t), [3, 4]); assert.deepEqual(out.map((k) => k.v), [[500, 300], [600, 300]]);
  assert.equal(P.positionDelta([0, 0], [1, 2, 3]), null, 'other dimensions: no guess');
  assert.deepEqual(P.place(snap, 0, fd, null).map((k) => k.v), [[0, 0], [100, 0]]);
});

test('tunables and variations come from the tool\'s own parameters', () => {
  const anim = TOOLS.find((t) => t.id === 'quick.animate');
  const nums = P.tunables(anim); assert.ok(nums.length >= 1 && nums.length <= 3 && nums[0].key === 'duration');
  assert.ok(!P.tunables(anim).some((p) => p.tileFixed));
  const args = { kind: 'moveRL', dir: 'in', duration: 0.6, ease: 'snappy' };
  const v = P.variations(anim, args);
  assert.deepEqual(v.map((x) => x.id).slice(0, 2), ['calmer', 'faster']);
  assert.ok(v.find((x) => x.id === 'calmer').args.duration > 0.6 && v.find((x) => x.id === 'faster').args.duration < 0.6);
  assert.equal(v.find((x) => x.id === 'other').args.kind, 'moveLR');
  assert.ok(v.length <= 4 && v.every((x) => JSON.stringify(x.args) !== JSON.stringify(args)));
  const { validateArgs, defaults } = require('../extension/core/schema');
  v.forEach((x) => { const r = validateArgs(anim.params, Object.assign(defaults(anim.params), x.args)); assert.ok(r.ok, `${x.id}: ${r.errors}`); });
  assert.deepEqual(P.variations(TOOLS.find((t) => t.id === 'quick.reverseKeys'), {}), [], 'a tool with nothing to vary has none');
  assert.equal(P.tunables(TOOLS.find((t) => t.id === 'motion.stagger'))[0].key, 'frames');
});

const keysOf = (L, mn) => { const p = L.property('ADBE Transform Group').property(mn); return Array.from({ length: p.numKeys }, (_, i) => Math.round(p.keyTime(i + 1) * 1000) / 1000); };

test('Retime Keys on the mock: read back, ease kept, restore is exact', async () => {
  const { easeComp } = require('./fixtures/comps');
  const { services, comp } = await createTestServices(easeComp(25));
  const L = comp._layers[0];
  const before = keysOf(L, 'ADBE Position'); assert.deepEqual(before, [0, 1, 2]);
  const r = await services.executor.run('motion.retime', { percent: 50 });
  assert.equal(r.status, 'success', JSON.stringify(r.errors || r.verification));
  assert.deepEqual(keysOf(L, 'ADBE Position'), [0, 0.52, 1], 'half the length, on frames');
  assert.deepEqual(keysOf(L, 'ADBE Scale'), [0, 0.52]);
  assert.ok(r.verification.checks.every((c) => c.ok && /keys/.test(c.detail)));
  assert.equal((await services.executor.restore(r.checkpointId)).ok, true);
  assert.deepEqual(keysOf(L, 'ADBE Position'), before);
  assert.equal((await services.executor.run('motion.retime', { percent: 100 })).status, 'blocked');
});

test('Copy Motion → Paste Motion on the mock: keys land at the playhead, Position keeps each layer\'s place, restore is exact', async () => {
  const { services, comp } = await createTestServices(studioComp([box('A', 400), Object.assign(box('B', 900), { selected: false })], { comp: { time: 0 } }));
  const [A, B] = comp._layers;
  const pos = A.property('ADBE Transform Group').property('ADBE Position');
  pos.setValueAtTime(0, [400, 300]); pos.setValueAtTime(1, [600, 300]);
  const rot = A.property('ADBE Transform Group').property('ADBE Rotate Z');
  rot.setValueAtTime(0, 0); rot.setValueAtTime(1, 90);
  const c = await services.executor.run('motion.copyMotion', {});
  assert.equal(c.status, 'success', JSON.stringify(c.errors || c.verification));
  const T = require('../extension/features/retune/tools');
  const clip = T.parseClip(services.store.get(T.CLIP_KEY, ''));
  assert.ok(!clip.error && clip.props.length === 2);
  A.selected = false; B.selected = true; comp.time = 2;
  const p = await services.executor.run('motion.pasteMotion', { expressions: true });
  assert.equal(p.status, 'success', JSON.stringify(p.errors || p.verification));
  assert.deepEqual(keysOf(B, 'ADBE Position'), [2, 3]); assert.deepEqual(keysOf(B, 'ADBE Rotate Z'), [2, 3]);
  const bp = B.property('ADBE Transform Group').property('ADBE Position');
  assert.deepEqual([bp.keyValue(1)[0], bp.keyValue(2)[0]], [900, 1100], 'B moves the same 200 px from where it was');
  assert.deepEqual(keysOf(A, 'ADBE Position'), [0, 1], 'the source is untouched');
  assert.equal((await services.executor.restore(p.checkpointId)).ok, true);
  assert.deepEqual(keysOf(B, 'ADBE Position'), []); assert.deepEqual(keysOf(B, 'ADBE Rotate Z'), []);
  // junk in the clip is refused before anything is read or written
  assert.ok(T.parseClip('{"props":[{"matchNames":["ADBE Effect Parade","x"],"snapshot":[]}]}').error);
  assert.ok(T.parseClip('nope').error); assert.ok(T.parseClip('').error);
  services.store.set(T.CLIP_KEY, '');
  assert.equal((await services.executor.run('motion.pasteMotion', {})).status, 'blocked');
});

test('Tune: a change restores the run and runs it again; only for the selection it was made on', async () => {
  const R = require('../extension/app/ui/retune');
  const { services, comp } = await createTestServices(studioComp([box('A', 400), box('B', 800)], { comp: { time: 1 } }));
  const calls = []; const call = services.host.call.bind(services.host); services.host.call = async (op, a) => { calls.push(op); return call(op, a); };
  let st = { ctx: await services.executor.readContext(), args: {} };
  const app = { services, toast: () => {}, state: { get: () => st, set: (p) => { st = Object.assign({}, st, typeof p === 'function' ? p(st) : p); } },
    refreshContext: async () => { st.ctx = await services.executor.readContext(); } };
  app.runTool = async (id, args, o) => { const sel = st.ctx.layers.map((l) => l.id); const r = await services.executor.run(id, args); st.ctx = await services.executor.readContext(); R.remember(app, id, args, (o || {}).label, r, sel); return r; };
  const { defaults } = require('../extension/core/schema');
  const stag = services.registry.get('motion.stagger');
  const first = await app.runTool('motion.stagger', Object.assign(defaults(stag.params), { frames: 2 }), { label: 'Stagger' });
  assert.equal(first.status, 'success');
  assert.ok(R.current(st) && R.current(st).toolId === 'motion.stagger');
  const starts = () => comp._layers.map((l) => Math.round(l.startTime * 25));
  const s2 = starts(); assert.equal(Math.abs(s2[1] - s2[0]), 2);
  calls.length = 0;
  const again = await R.retune(app, { frames: 5 });
  assert.equal(again.status, 'success');
  assert.equal(Math.abs(starts()[1] - starts()[0]), 5, 'the new number replaced the old one — not added to it');
  assert.deepEqual(calls.filter((c) => /^tx\.(begin|end)$/.test(c)), [], 'v0.94: no run-wide group — it could not hold the next calls');
  assert.equal(R.current(st).args.frames, 5); assert.notEqual(R.current(st).checkpointId, first.checkpointId);
  assert.equal(await R.retune(app, { frames: 5 }), null, 'the same number does nothing');
  // another selection: the strip is not offered
  st = Object.assign({}, st, { ctx: Object.assign({}, st.ctx, { layers: st.ctx.layers.slice(0, 1) }) });
  assert.equal(R.current(st), null); assert.equal(await R.retune(app, { frames: 9 }), null);
  // a write that cannot be tuned forgets the old run (its checkpoint is stale); a read does not
  st.ctx = await services.executor.readContext();
  R.remember(app, 'motion.stagger', { frames: 5 }, 'Stagger', { status: 'success', checkpointId: 'x' }, st.ctx.layers.map((l) => l.id));
  R.remember(app, 'quick.selectSame', {}, '', { status: 'success' }, []); assert.ok(st.tune, 'a read keeps it');
  R.remember(app, 'quick.reverseKeys', {}, '', { status: 'success', checkpointId: 'y' }, []); assert.equal(st.tune, null);
});

/**
 * v0.99.6 (Group 8 manual test, seen in After Effects): the Retune strip of an **Iris Reveal** offered "Bars 6",
 * "Columns 8" and "Corner radius 24" — the first three numbers of reveal.matte, which belong to Blinds, Pixels and
 * Card — while Duration and Soft edge, the ones an iris really uses, were pushed out of the three slots.
 */
test('v0.99.6: the strip only offers numbers that apply to the run that was made', () => {
  const { TOOLS } = require('../extension/features');
  const matte = TOOLS.find((t) => t.id === 'reveal.matte');
  assert.ok(matte, 'reveal.matte exists');

  const iris = P.tunables(matte, { style: 'iris', dir: 'in', duration: 0.9 }).map((p) => p.key);
  for (const k of ['count', 'cols', 'radius']) assert.ok(!iris.includes(k), `an iris must not offer ${k}: got ${iris.join(', ')}`);
  assert.ok(iris.includes('duration'), `an iris must offer duration: got ${iris.join(', ')}`);

  // the same tool in a style that DOES use bars still offers them
  const blinds = P.tunables(matte, { style: 'blinds', dir: 'in', duration: 1 }).map((p) => p.key);
  assert.ok(blinds.includes('count'), `blinds must offer count: got ${blinds.join(', ')}`);

  // a parameter the user must open "Advanced" to see never takes a slot from a plain one
  const adv = P.tunables(matte, { style: 'iris', dir: 'in' });
  assert.ok(!adv.length || !adv[0].advanced, 'the first slot is not an advanced setting');

  // called without args (an older caller) nothing is filtered out
  assert.ok(P.tunables(matte).length > 0);
});
