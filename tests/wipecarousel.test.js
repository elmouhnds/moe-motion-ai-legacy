'use strict';
/** v0.63 Wipe Reveal + Carousel 3D (docs/features/WIPE_CAROUSEL.md), read back from the mock comp. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { studioComp } = require('./fixtures/studio');
const { TA } = require('./fixtures/layout');
const FG = require('../extension/core/framegrid');
const CP = require('../extension/features/carousel/plan');
const WP = require('../extension/features/quick/wipe');

const tr = (L, mn) => L.property('ADBE Transform Group').property(mn);
const fxOf = (L, name) => { const P = L.property('ADBE Effect Parade'); for (let i = 1; i <= P.numProperties; i++) if (P.property(i).name === name) return P.property(i); return null; };
const param = (fx, n) => { for (let i = 1; i <= fx.numProperties; i++) if (fx.property(i).name === n) return fx.property(i); return null; };
const cards = (n, w = 300) => studioComp(Array.from({ length: n }, (_, i) => ({ name: `Card ${i + 1}`, selected: true, transform: TA({ pos: [300 + i * 350, 540] }), rect: { left: -w / 2 + (i === 1 ? -20 : 0), top: -90, width: w + (i === 1 ? 40 : 0), height: 180 } })), { comp: { time: 1 } });
const WIPE = { dir: 'in', from: 'left', duration: 0.8, feather: 60, ease: 'smooth', stagger: 0, order: 'screen' };

test('Wipe Reveal: one MOE Wipe (Linear Wipe) per layer, angle by direction, Transition Completion 100 → 0 on frames; reused; Restore removes', async () => {
  const { services, comp } = await createTestServices(cards(3));
  const r = await services.executor.run('quick.wipe', WIPE);
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  for (const L of comp._layers.filter((l) => l.selected)) {
    const fx = fxOf(L, WP.FX);
    assert.equal(fx.matchName, 'ADBE Linear Wipe');
    assert.equal(param(fx, 'Wipe Angle').value, 270, 'reveal from the left: 270° — at 90° Linear Wipe HIDES from the left (measured in After Effects 26.5), so a reveal writes the opposite');
    assert.equal(param(fx, 'Feather').value, 60);
    const k = param(fx, 'Transition Completion')._keys;
    assert.deepEqual(k.map((x) => x.value), [100, 0]);
    assert.ok(k.every((x) => FG.onGrid(x.t, comp.frameDuration)), 'keys on frames');
  }
  // a second run (hide to the right) reuses the effect and turns it round
  const r2 = await services.executor.run('quick.wipe', Object.assign({}, WIPE, { dir: 'out', from: 'right' }));
  assert.equal(r2.status, 'success');
  const L0 = comp._layers.find((l) => l.selected), P = L0.property('ADBE Effect Parade');
  let n = 0; for (let i = 1; i <= P.numProperties; i++) if (P.property(i).name === WP.FX) n++;
  assert.equal(n, 1, 'never two');
  assert.equal(param(fxOf(L0, WP.FX), 'Wipe Angle').value, 270);
  assert.ok((await services.executor.restore(r2.checkpointId)).ok);
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.equal(fxOf(L0, WP.FX), null, 'the effect this run added is gone');
});

test('Wipe Reveal staggers in screen order (left card first), every start on a frame', async () => {
  const { services, comp } = await createTestServices(cards(3));
  // select them right-to-left, to prove the order comes from the screen
  comp._layers.reverse();
  const r = await services.executor.run('quick.wipe', Object.assign({}, WIPE, { stagger: 0.07 }));
  assert.equal(r.status, 'success');
  const start = (name) => r.result.keys.items.find((it) => it.layerName === name).written[0].t;
  assert.ok(start('Card 1') < start('Card 2') && start('Card 2') < start('Card 3'));
  assert.ok(['Card 1', 'Card 2', 'Card 3'].every((nm) => FG.onGrid(start(nm), comp.frameDuration)));
});

test('the carousel plan: neighbours never overlap, cards face out, one full loop ends at −360°, the front card is clear', () => {
  const R = CP.radius(5, 300, 40);
  assert.ok(Math.abs(2 * R * Math.sin(Math.PI / 5) - 340) < 1e-9, 'chord = widest + gap');
  const ring = CP.ring(5, R);
  assert.deepEqual(ring[0].position.map((v) => Math.round(v)), [0, 0, -Math.round(R)], 'card 1 in front');
  ring.forEach((c, i) => assert.equal(c.rotY, 72 * i));
  const k = CP.steps(5, { time: 1, turn: 0.6, hold: 1, fd: 1 / 30 });
  assert.equal(k[k.length - 1].v, -360);
  assert.ok(k.every((x) => FG.onGrid(x.t, 1 / 30)));
  assert.equal(CP.depth(0, 0, 60), 100); assert.equal(CP.depth(180, 0, 60), 40);
  assert.equal(CP.depth(72, -72, 60), 100, 'card 2 is in front after one turn');
});

test('Carousel 3D on the mock: a 3D null, the cards 3D + parented on the ring, its keys and the depth fade; Restore puts every card back', async () => {
  const { services, comp } = await createTestServices(cards(4));
  const sel = comp._layers.filter((l) => l.selected);
  const before = sel.map((L) => ({ name: L.name, pos: Array.from(tr(L, 'ADBE Position').value).slice(0, 2), threeD: L.threeDLayer, parent: L.parent }));
  const args = { turn: 0.7, hold: 1.2, steps: 0, gap: 60, depth: 60, tilt: 0, reverse: false };
  const r = await services.executor.run('layout.carousel', args);
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const nul = comp._layers.find((l) => l.name === 'MOE Carousel 1');
  assert.ok(nul && nul.threeDLayer);
  const R = CP.radius(4, 340, 60); // the widest card is 340 px (Card 2)
  assert.ok(Math.abs(r.result.R - R) < 0.5, `radius ${r.result.R} vs ${R}`);
  sel.forEach((L, i) => {
    assert.ok(L.threeDLayer && L.parent === nul, `${L.name}: 3D, on the ring`);
    const p = tr(L, 'ADBE Position').value, want = CP.ring(4, R)[i].position;
    assert.ok(Math.hypot(p[0] - want[0], p[1] - want[1], (p[2] || 0) - want[2]) < 0.5, `${L.name} at its ring place`);
    assert.equal(tr(L, 'ADBE Rotate Y').value, 90 * i);
  });
  const rot = tr(nul, 'ADBE Rotate Y')._keys;
  assert.equal(rot[rot.length - 1].value, -360, 'one full loop');
  assert.ok(rot.every((k) => FG.onGrid(k.t, comp.frameDuration)));
  assert.equal(tr(sel[0], 'ADBE Opacity')._keys[0].value, 100, 'the front card starts clear');
  assert.equal(tr(sel[2], 'ADBE Opacity')._keys[0].value, 40, 'the back card faded');
  // Restore: every card where it was, 2D, unparented, keys off, the null gone
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  sel.forEach((L, i) => {
    const p = tr(L, 'ADBE Position').value;
    assert.ok(Math.hypot(p[0] - before[i].pos[0], p[1] - before[i].pos[1]) < 0.01, `${L.name} back in place`);
    assert.equal(L.threeDLayer, before[i].threeD); assert.equal(L.parent, before[i].parent);
    assert.equal(tr(L, 'ADBE Opacity')._keys.length, 0);
  });
  assert.ok(!comp._layers.some((l) => l.name === 'MOE Carousel 1'));
});

test('Carousel 3D refuses fewer than 3 cards before anything changes', async () => {
  const { services, comp } = await createTestServices(cards(2));
  const n0 = comp._layers.length;
  assert.notEqual((await services.executor.run('layout.carousel', {})).status, 'success');
  assert.equal(comp._layers.length, n0);
});
