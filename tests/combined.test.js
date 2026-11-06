'use strict';
/**
 * v0.48 — Combined Moves (docs/features/COMBINED_MOVES.md): one move, several properties on one timing (Also fade,
 * From / to, Angle). The keys written on the mock are the plan the tile previews play.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { TA } = require('./fixtures/layout');
const { studioComp } = require('./fixtures/studio');
const P = require('../extension/features/quick/animatePlan');
const S = require('../extension/app/ui/studio/sections');

const near = (a, b, t = 1e-6) => (Array.isArray(a) ? a.every((x, i) => Math.abs(x - b[i]) <= t) : Math.abs(a - b) <= t);
const fx = () => studioComp([{ name: 'Box', selected: true, transform: TA({ pos: [960, 540] }), rect: { left: -50, top: -50, width: 100, height: 100 } }], { comp: { time: 3 } });
const tp = (L, mn) => L.property('ADBE Transform Group').property(mn);
const rel = (prop) => prop._keys.map((k) => ({ t: +(k.t - prop._keys[0].t).toFixed(6), v: Array.isArray(k.value) ? Array.from(k.value).slice(0, 2) : k.value, inf: [k.easeIn[0].influence, k.easeOut[0].influence] }));
// v0.61: the plan as After Effects writes it — on the 25 fps frame grid
const FG = require('../extension/core/framegrid');
function same(prop, keys0, label) {
  const keys = FG.snapKeys(keys0, 1 / 25).keys;
  const w = rel(prop);
  assert.equal(w.length, keys.length, `${label}: keys`);
  keys.forEach((k, i) => {
    assert.ok(near(w[i].t, k.t), `${label} ${i}: time`);
    assert.ok(near(w[i].v, Array.isArray(k.v) ? k.v.slice(0, 2) : k.v, 1e-6), `${label} ${i}: value ${JSON.stringify(w[i].v)} vs ${JSON.stringify(k.v)}`);
    if (k.easeOut) assert.ok(near(w[i].inf[1], k.easeOut.influence), `${label} ${i}: out influence`);
    if (k.easeIn) assert.ok(near(w[i].inf[0], k.easeIn.influence), `${label} ${i}: in influence`);
  });
}
const NEW = ['riseFade', 'slideFadeIn', 'dropFade', 'zoomFadeIn', 'growFade', 'popFade', 'swingIn', 'sinkFade', 'slideFadeOut', 'zoomFadeOut', 'shrinkFade', 'swingOut'];

test('every combined preset writes its move AND its fade on one timing — exactly the plan the tile plays', async () => {
  const tiles = S.byId('animate').tiles;
  for (const id of NEW) {
    const t = tiles.find((x) => x.id === id);
    assert.ok(t, id);
    const { services, comp } = await createTestServices(fx());
    const r = await services.executor.run('quick.animate', t.args);
    assert.equal(r.status, 'success', `${id}: ${JSON.stringify(r.errors || r.verification)}`);
    const box = comp._layers[0];
    const a = Object.assign({ duration: 0.6, ease: 'snappy', overshoot: false, distance: 0, away: 0, angle: 180, stagger: 0 }, t.args);
    // the fade: same times as the move
    const f = P.fade(a, { opacity: 100 });
    same(tp(box, 'ADBE Opacity'), f.keys, `${id} opacity`);
    if (a.kind === 'scale') same(tp(box, 'ADBE Scale'), P.animate(a, { scale: [100, 100] }).keys, `${id} scale`);
    if (a.kind === 'spin') same(tp(box, 'ADBE Rotate Z'), P.animate(a, { rotation: 0 }).keys, `${id} rotation`);
    if (/^move/.test(a.kind)) {
      const pos = tp(box, 'ADBE Position');
      const k = rel(pos);
      assert.equal(k.length, a.overshoot && a.dir === 'in' ? 3 : 2, `${id}: position keys`);
      assert.deepEqual([k[0].t, k[k.length - 1].t], [0, FG.snap(a.duration, 1 / 25)], `${id}: the move and the fade share the timing`);
      const rest = a.dir === 'in' ? k[k.length - 1].v : k[0].v;
      assert.deepEqual(rest, [960, 540], `${id}: rest pose kept`);
      const far = a.dir === 'in' ? k[0].v : k[k.length - 1].v;
      assert.equal(Math.round(Math.hypot(far[0] - 960, far[1] - 540)), a.distance, `${id}: moves ${a.distance} px`);
    }
    assert.ok((await services.executor.restore(r.checkpointId)).ok, `${id}: restore`);
    assert.equal(tp(box, 'ADBE Opacity')._keys.length, 0, `${id}: restore removes the fade keys too`);
  }
});

test('From / to (scale) and Angle: zoom from bigger, shrink to 60 %, swing 25° — overshoot on the right side', () => {
  const zoom = P.animate({ kind: 'scale', dir: 'in', away: 130, overshoot: true, duration: 1 }, { scale: [100, 100] });
  assert.deepEqual(zoom.keys[0].v, [130, 130]);
  assert.deepEqual(zoom.keys[1].v, [95, 95], 'from bigger, the overshoot dips under the rest');
  assert.deepEqual(zoom.keys[2].v, [100, 100]);
  const pop = P.animate({ kind: 'scale', dir: 'in', overshoot: true, duration: 1 }, { scale: [100, 100] });
  assert.deepEqual(pop.keys.map((k) => k.v[0]), [0, 108, 100], 'v0.47 Pop unchanged (away defaults to 0)');
  const shrink = P.animate({ kind: 'scale', dir: 'out', away: 60, duration: 0.5 }, { scale: [80, 80] });
  assert.deepEqual(shrink.keys.map((k) => k.v[0]), [80, 48], '60 % of the layer\'s own scale');
  const swing = P.animate({ kind: 'spin', dir: 'in', angle: 25, overshoot: true, duration: 0.7 }, { rotation: 10 });
  assert.deepEqual(swing.keys.map((k) => +k.v.toFixed(6)), [-15, +(10 + 25 * 8 / 180).toFixed(6), 10]);
  const spin = P.animate({ kind: 'spin', dir: 'in', overshoot: true, duration: 0.5 }, { rotation: 0 });
  assert.deepEqual(spin.keys.map((k) => k.v), [-180, 8, 0], 'v0.47 Spin unchanged (angle defaults to 180)');
  // no fade unless asked, never on a fade, never an overshoot on the fade
  assert.equal(P.fade({ kind: 'scale', dir: 'in' }), null);
  assert.equal(P.fade({ kind: 'fade', dir: 'in', fade: true }), null);
  assert.equal(P.fade({ kind: 'scale', dir: 'in', fade: true, overshoot: true, duration: 1 }).keys.length, 2);
});

test('the combined presets: unique names, every one an In or an Out, with its real preview', () => {
  const tiles = S.byId('animate').tiles;
  const labels = tiles.map((t) => t.label);
  assert.equal(new Set(labels).size, labels.length, 'no two tiles share a name');
  for (const id of NEW) {
    const t = tiles.find((x) => x.id === id);
    assert.ok(t.args.fade, `${id}: also fades`);
    assert.ok(['IN', 'OUT'].includes(t.badge) && t.args.dir === t.badge.toLowerCase(), id);
    assert.ok(['move', 'scale', 'spin'].includes(t.thumb.k), `${id}: drawn from the plan`);
    if (t.thumb.dir) assert.equal(t.thumb.dir, t.args.dir, id);
  }
  assert.ok(tiles.length >= 45, `${tiles.length} tiles`);
});
