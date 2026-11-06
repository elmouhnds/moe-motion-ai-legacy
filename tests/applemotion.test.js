'use strict';
/**
 * v0.58 Apple Motion (docs/features/APPLE_MOTION.md): Blur on entrances (a MOE Blur keyed on the move's timing, exact
 * Restore), the Native curve set, Apple-style text presets (by line / word, Arabic-safe), the Blur tiles.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTestServices } = require('./helpers/harness');
const PLAN = require('../extension/features/quick/animatePlan');
const BZ = require('../extension/features/curves/bezier');
const TP = require('../extension/features/text/presets');
const fixture = require('../dev/preview-fixture.js');

const fxOf = (L, name) => { const P = L.property('ADBE Effect Parade'); for (let i = 1; i <= P.numProperties; i++) if (P.property(i).name === name) return P.property(i); return null; };
const param = (fx, n) => { for (let i = 1; i <= fx.numProperties; i++) if (fx.property(i).name === n) return fx.property(i); return null; };

test('Blur In: one MOE Blur per layer, Blurriness keyed 40 → 0 on the fade\'s timing; Restore removes it all', async () => {
  const { services, comp } = await createTestServices(fixture);
  const sel = comp._layers.filter((l) => l.selected);
  const t0 = comp.time;
  const r = await services.executor.run('quick.animate', { kind: 'fade', dir: 'in', duration: 0.7, ease: 'smooth', blur: 40 });
  assert.equal(r.status, 'success');
  const plan = PLAN.blur({ dir: 'in', duration: 0.7, ease: 'smooth', blur: 40 });
  for (const L of sel) {
    const fx = fxOf(L, 'MOE Blur');
    assert.ok(fx && fx.matchName === 'ADBE Gaussian Blur 2', `${L.name}: MOE Blur`);
    assert.equal(param(fx, 'Repeat Edge Pixels').value, 1);
    const k = param(fx, 'Blurriness')._keys;
    assert.deepEqual(k.map((x) => +(x.t + L.startTime).toFixed(3)), plan.keys.map((x) => +(x.t + t0).toFixed(3)));
    assert.deepEqual(k.map((x) => x.value), [40, 0]);
  }
  // a second run reuses the effect (never two)
  await services.executor.run('quick.animate', { kind: 'fade', dir: 'out', duration: 0.5, blur: 20 });
  const P = sel[0].property('ADBE Effect Parade');
  let n = 0; for (let i = 1; i <= P.numProperties; i++) if (P.property(i).name === 'MOE Blur') n++;
  assert.equal(n, 1);
  // Restore of the first run: its keys and the effect it added go away
  const { services: s2, comp: c2 } = await createTestServices(fixture);
  const r2 = await s2.executor.run('quick.animate', { kind: 'fade', dir: 'in', blur: 40 });
  assert.ok((await s2.executor.restore(r2.checkpointId)).ok);
  assert.ok(c2._layers.filter((l) => l.selected).every((L) => !fxOf(L, 'MOE Blur')));
});

test('Blur 0 adds nothing; the plan is the same ease and timing as the move; previews draw it', async () => {
  const { services, comp } = await createTestServices(fixture);
  await services.executor.run('quick.animate', { kind: 'fade', dir: 'in' });
  assert.ok(comp._layers.every((L) => !fxOf(L, 'MOE Blur')));
  assert.equal(PLAN.blur({ blur: 0 }), null);
  const out = PLAN.blur({ dir: 'out', duration: 0.5, blur: 30, ease: 'expo' });
  assert.deepEqual(out.keys.map((k) => k.v), [0, 30]);
  assert.equal(out.keys[1].t, 0.5);
  const th = fs.readFileSync(path.join(__dirname, '../extension/app/ui/studio/thumbs.js'), 'utf8');
  assert.match(th, /const blurAt = \(a, lt, W\) => \{ const b = PLAN\.blur\(a\)/);
  assert.ok((th.match(/blurAt\(/g) || []).length >= 3, 'move, fade and scale draw it');
});

test('Native curves: seven OS-style curves (springs overshoot, Anticipate winds up), all storable as AE ease', () => {
  const N = BZ.PRESETS.filter((c) => c.tag === 'Native');
  assert.deepEqual(N.map((c) => c.label), ['Native Standard', 'Native Emphasized', 'Native Enter', 'Native Exit', 'Spring Soft', 'Spring Bouncy', 'Anticipate']);
  assert.ok(BZ.TAGS.includes('Native'));
  assert.ok(N.find((c) => c.id === 'springBouncy').y1 > 1 && N.find((c) => c.id === 'anticipate').y1 < 0);
  for (const c of N) {
    const n = BZ.normalize(c);
    assert.ok(n.x1 >= BZ.X_MIN && n.x2 <= BZ.X_MAX, c.id);
    assert.ok(Math.abs(BZ.valueAt(n, 1) - 1) < 1e-6 && Math.abs(BZ.valueAt(n, 0)) < 1e-6, `${c.id}: 0 → 1`);
  }
});

test('Apple-style text presets: by line or word (Arabic-safe), each with blur; the Blur tiles carry a blur', () => {
  const ids = ['hero-reveal', 'word-stagger', 'word-burst', 'iris-in', 'hero-out', 'stagger-out'];
  for (const id of ids) {
    const p = TP.PRESETS.find((x) => x.id === id);
    assert.ok(p && p.arabicSafe && p.props.blur && p.props.blur[0] > 0, id);
  }
  const S = require('../extension/app/ui/studio/sections');
  const sec = S.byId('animate');
  const blurTiles = sec.tiles.filter((t) => (t.tags || []).includes('Blur'));
  assert.equal(blurTiles.length, 7);
  assert.ok(blurTiles.every((t) => t.args.blur > 0) && sec.filters.includes('Blur'));
  const tool = require('../extension/features/quick/tools').animate || Object.values(require('../extension/features/quick/tools')).find((x) => x && x.id === 'quick.animate');
  assert.equal(tool.params.blur.default, 0);
});
