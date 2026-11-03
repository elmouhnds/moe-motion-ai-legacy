'use strict';
/**
 * v0.39 — Live Preview (docs/features/LIVE_PREVIEW.md). The Inspector's effector preview runs features/grid/sim.js,
 * which must give the same numbers as the expressions' reference (effectors.js applyAt) — so what you see while you
 * drag is what After Effects will do. These tests drive the simulation like a mouse would.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const SIM = require('../extension/features/grid/sim');
const EF = require('../extension/features/grid/effectors');

const near = (a, b, tol) => Math.abs(a - b) <= tol;

test('a still null: every item equals effectors.applyAt (the expressions\' reference) — sphere, linear, noise field, target', () => {
  for (const args of [{ falloff: 'sphere', size: 150, scale: 80, rotate: 30 }, { falloff: 'linear', size: 120, moveY: -40 }, { falloff: 'noise', size: 140, scale: 60, fieldSpeed: 80 }, { type: 'target', falloff: 'all', scale: 0 }]) {
    const sim = SIM.createSim({ args });
    sim.reset(0);
    sim.grab(0.5, 60, 20); sim.release(0.5);
    for (const t of [1, 2.5]) {
      const got = sim.frame(t);
      const src = { at: () => sim.values, toLocal: () => EF.localFn({ position: [60, 20] }), originAt: () => [60, 20], audioAt: SIM.beat, lumaAt: () => 0 };
      sim.items.forEach((p, i) => {
        const r = EF.applyAt([src], { i, k: i, n: sim.items.length, x: p[0], y: p[1], fd: 1 / 30, compAt: () => p, baseRotAt: () => 0 }, t);
        assert.ok(near(got[i].scale, r.scaleMul, 1e-9) && near(got[i].rot, r.rot, 1e-9) && near(got[i].x, p[0] + r.dx, 1e-9) && near(got[i].y, p[1] + r.dy, 1e-9), `${JSON.stringify(args)} t ${t} item ${i}`);
      });
    }
  }
});

test('drag with Spring: the item under the new spot swings past its rest and settles; Inertia only trails', () => {
  const sim = SIM.createSim({ args: { falloff: 'sphere', size: 120, softness: 30, scale: 80, spring: 100, frequency: 3, decay: 5 } });
  sim.reset(0);
  const target = sim.items[10]; // an inner item
  sim.grab(1, 1000, 1000); sim.release(1); // far away: nothing reached
  sim.grab(5, target[0], target[1]); sim.release(5); // 4 s later (everything at rest), jump onto it
  const at = (t) => sim.frame(t)[10].scale;
  assert.ok(near(at(4.99), 1, 1e-6), 'untouched (and at rest) before the jump');
  const ts = Array.from({ length: 80 }, (_, j) => 5 + j * 0.02);
  const peak = Math.max(...ts.map(at));
  assert.ok(peak > 1.8 + 0.05, `overshoots the direct 1.8 (${peak.toFixed(3)})`);
  assert.ok(near(at(9), 1.8, 0.005), `settles on 1.8 (${at(9)})`);
  sim.setArgs({ falloff: 'sphere', size: 120, softness: 30, scale: 80, spring: 100, frequency: 0, decay: 6 });
  const inertia = ts.map(at);
  assert.ok(Math.max(...inertia) <= 1.8 + 1e-6 && inertia[1] < 1.8 - 0.05, 'Inertia rises to 1.8 without passing it');
});

test('the recorded path stays bounded (a long, fast drag keeps ≤ the spring window), sweep loops and a grab takes over', () => {
  const sim = SIM.createSim({ args: { falloff: 'sphere', scale: 50, spring: 100, frequency: 2, decay: 5, sweep: true } });
  sim.reset(0);
  assert.ok(sim.sweeping, 'a sweep effector plays its sweep');
  const a = sim.effectorAt(0)[0], b = sim.effectorAt(2)[0], c = sim.effectorAt(6)[0];
  assert.ok(a < 0 && b > 0 && near(a, c, 1e-6), `left → right → back (${a}, ${b}, ${c})`);
  sim.grab(7, 0, 0);
  assert.ok(sim.dragging && !sim.sweeping);
  for (let j = 0; j < 20000; j++) sim.drag(7 + j / 240, Math.sin(j) * 200, Math.cos(j) * 100);
  assert.ok(sim.history <= SIM.MAX_POINTS, `history ${sim.history} ≤ ${SIM.MAX_POINTS}`);
  sim.release(90);
  assert.ok(!sim.dragging);
  // your own grid: setItems re-sizes the falloff like the tool (Size 0 = 60 % of the grid)
  sim.setItems([[-300, 0], [300, 0], [0, 200]]);
  assert.equal(sim.values.size, Math.round(Math.max(80, 300 * 0.6)));
});

test('Inspector: Effector gets the live preview, Grid Builder previews Points and In Place (text) with the real layout', () => {
  const W = require('../extension/app/ui/widgets');
  assert.equal(typeof W.body['grid.effector'], 'function', 'the effector has a body widget');
  const CP = require('../extension/app/ui/clonerPreview');
  const pts = CP.demoInputs({ mode: 'points' }, 1920, 1080);
  assert.ok(pts.vertices && pts.vertices.length >= 5, 'Points previews on a sample shape');
  const keep = CP.demoInputs({ mode: 'keep', splitText: 'words' }, 1920, 1080);
  assert.ok(keep.homes && keep.homes.length >= 3 && keep.widths.length === keep.homes.length, 'Text Cloner previews word blocks in place');
});
