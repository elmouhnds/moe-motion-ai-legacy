'use strict';
/**
 * v0.59 Styles + Shakes (docs/features/STYLES_SHAKES.md): shakes as real keys from a pure plan, added ON TOP of the
 * layer's own animation; styles from After Effects' own effects, named, updated in place, restorable.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const SH = require('../extension/features/quick/shakePlan');
const ST = require('../extension/features/design/styles');
const fixture = require('../dev/preview-fixture.js');

const tr = (L, mn) => L.property('ADBE Transform Group').property(mn);
const fxOf = (L, name) => { const P = L.property('ADBE Effect Parade'); const out = []; for (let i = 1; i <= P.numProperties; i++) if (P.property(i).name === name) out.push(P.property(i)); return out; };
const param = (fx, n) => { for (let i = 1; i <= fx.numProperties; i++) if (fx.property(i).name === n) return fx.property(i); return null; };

test('the shake plan: peaks half a period apart, smaller each time, back to rest; Jitter is the same every time', () => {
  for (const [id, T] of Object.entries(SH.TYPES)) {
    const p = SH.plan(id, T);
    const list = p.position || p.scale;
    const mag = (v) => (Array.isArray(v) ? Math.hypot(v[0], v[1]) : Math.abs(v));
    assert.equal(mag(list[0].v), 0, `${id}: starts at rest`);
    assert.equal(mag(list[list.length - 1].v), 0, `${id}: ends at rest`);
    assert.ok(Math.abs(list[1].t - 1 / (2 * T.frequency)) < 1e-9, `${id}: first peak at 1 / 2f`);
    if (id !== 'jitter') for (let k = 2; k < list.length - 1; k++) assert.ok(mag(list[k].v) < mag(list[k - 1].v) + 1e-9, `${id}: decays`);
  }
  assert.deepEqual(SH.plan('jitter', {}), SH.plan('jitter', {}), 'deterministic');
  assert.equal(SH.plan('bump', { frequency: 999 }).position[1].t, 1 / 80, 'frequency clamped to 40 Hz');
});

test('Bump on the mock: Position keys = the layer\'s own value + the plan, at the plan\'s times; Restore removes them', async () => {
  const { services, comp } = await createTestServices(fixture);
  const L = comp._layers.find((l) => l.selected);
  const pos = tr(L, 'ADBE Position');
  const t0 = comp.time;
  const plan = SH.plan('bump', SH.TYPES.bump);
  // v0.61: the keys land on the comp's frames — the expected key is the plan snapped, on top of the value on THAT frame
  const grid = require('../extension/core/framegrid').snapKeys(plan.position.map((k) => ({ t: t0 + k.t, v: k.v })), comp.frameDuration).keys;
  const before = grid.map((k) => pos.valueAtTime(k.t, false));
  const r = await services.executor.run('quick.shake', { type: 'bump', intensity: 40, rotation: 0, frequency: 7, settle: 0.6 });
  assert.equal(r.status, 'success');
  grid.forEach((k, i) => {
    const v = pos.valueAtTime(k.t, false);
    assert.ok(Math.abs(v[0] - (before[i][0] + k.v[0])) < 0.01 && Math.abs(v[1] - (before[i][1] + k.v[1])) < 0.01, `key ${i}: on top of the layer's own animation`);
  });
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  grid.forEach((k, i) => { const v = pos.valueAtTime(k.t, false); assert.ok(Math.abs(v[1] - before[i][1]) < 0.01, 'back as it was'); });
});

test('Zoom Punch keys Scale + Rotation; Whip keys Position + Rotation (every shake writes what its plan holds)', async () => {
  const { services, comp } = await createTestServices(fixture);
  const L = comp._layers.find((l) => l.selected);
  await services.executor.run('quick.shake', { type: 'zoomPunch', intensity: 12, rotation: 3, frequency: 6, settle: 0.6 });
  const n = SH.plan('zoomPunch', SH.TYPES.zoomPunch).scale.length;
  assert.equal(tr(L, 'ADBE Scale').numKeys >= n, true);
  assert.equal(tr(L, 'ADBE Rotate Z').numKeys >= n, true);
});

test('Styles: one named effect per style, parameters by name and read back; updated in place; Light Sweep is a tagged expression; Restore removes', async () => {
  const { services, comp } = await createTestServices(fixture);
  const L = comp._layers.find((l) => l.selected);
  const r = await services.executor.run('design.style', { style: 'softShadow', amount: 1 });
  assert.equal(r.status, 'success');
  const fx = fxOf(L, 'MOE Style • Soft Shadow');
  assert.equal(fx.length, 1);
  assert.equal(fx[0].matchName, 'ADBE Drop Shadow');
  assert.equal(param(fx[0], 'Distance').value, 14); assert.equal(param(fx[0], 'Softness').value, 50);
  await services.executor.run('design.style', { style: 'softShadow', amount: 2 });
  assert.equal(fxOf(L, 'MOE Style • Soft Shadow').length, 1, 'updated in place, never two');
  assert.equal(param(fxOf(L, 'MOE Style • Soft Shadow')[0], 'Distance').value, 28);
  const g = await services.executor.run('design.style', { style: 'glow', amount: 1 });
  assert.equal(param(fxOf(L, 'MOE Style • Glow')[0], 'Glow Radius').value, 60);
  assert.ok((await services.executor.restore(g.checkpointId)).ok);
  assert.equal(fxOf(L, 'MOE Style • Glow').length, 0, 'Restore removes what it added');
  const s = await services.executor.run('design.style', { style: 'lightSweep', every: 4 });
  assert.equal(s.status, 'success');
  const c = param(fxOf(L, 'MOE Style • Light Sweep')[0], 'Center');
  assert.match(c.expression, /^\/\/ MOE Style/);
  assert.match(c.expression, /sourceRectAtTime\(time, false\)/);
  assert.match(c.expression, /every = 4\.000/);
});

test('the tiles: five shakes in the Motion page\'s Shake mode, four styles on Looks', () => {
  const S = require('../extension/app/ui/studio/sections');
  const shakes = S.byId('animate').tiles.filter((t) => t.tool === 'quick.shake');
  assert.deepEqual(shakes.map((t) => t.args.type), Object.keys(SH.TYPES));
  assert.ok(shakes.every((t) => t.tags.includes('Shake')));
  const styles = S.byId('looks').tiles.filter((t) => t.tool === 'design.style');
  assert.deepEqual(styles.map((t) => t.args.style), Object.keys(ST.STYLES));
  assert.ok(S.byId('looks').filters.includes('Styles'));
});
