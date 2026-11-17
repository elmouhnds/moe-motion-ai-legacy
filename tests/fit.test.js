'use strict';
/**
 * v0.99.7 — design space → the comp (features/design/fit.js), the owner's rule.
 *
 * The bug this replaces: templates scaled by the comp's HEIGHT alone (templates.js `unit`), so a 1080 x 1920 comp
 * grew every size and gap by 78 % while the frame stayed 1080 wide. The Product UI cards came out 1103, 1139 and
 * about 1400 px wide inside a 1080 px frame.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../extension/features/design/fit');

const C = (w, h) => ({ width: w, height: h });
const near = (a, b, t = 0.001) => assert.ok(Math.abs(a - b) <= t, `${a} ≈ ${b}`);

test('contain: 16:9 is unchanged, and a portrait frame fits the design to its WIDTH', () => {
  // the reference frame itself, and every 16:9 comp, is still 1 — nothing a user has today moves
  assert.equal(F.scale(C(1920, 1080)), 1);
  assert.equal(F.scale(C(3840, 2160)), 2);
  assert.equal(F.scale(C(1280, 720)), 1280 / 1920);

  // 9:16 — the old height-only rule gave 1.78 and burst the frame; contain gives 0.5625
  near(F.scale(C(1080, 1920)), 0.5625);
  near(1920 * F.scale(C(1080, 1920)), 1080, 0.01); // the design fills the width exactly
  near(F.scale(C(1080, 1080)), 0.5625);

  // a missing or broken comp falls back to the reference, never to 0
  assert.equal(F.scale(null), 1);
  assert.equal(F.scale(C(0, 0)), 1);
});

test('the Product UI cards that overflowed now fit', () => {
  // uiKit authors these in design pixels: notify 620, search 640, progress 720
  const portrait = C(1080, 1920);
  const s = F.scale(portrait);
  for (const [name, design] of [['notify', 620], ['search', 640], ['progress', 720]]) {
    const was = design * (portrait.height / 1080);   // the old height-only scale
    const now = design * s;
    assert.ok(was > portrait.width, `${name}: the old rule really did overflow (${Math.round(was)} > 1080)`);
    assert.ok(now <= portrait.width, `${name}: ${Math.round(now)} px now fits inside 1080`);
  }
});

test('the design rectangle is centred in the comp', () => {
  const b = F.box(C(1080, 1920));
  near(b.w, 1080); near(b.h, 607.5);
  near(b.x, 0); near(b.y, (1920 - 607.5) / 2);

  const wide = F.box(C(2560, 1080));            // wider than 16:9: the design meets the height
  near(wide.s, 1); near(wide.h, 1080); near(wide.x, (2560 - 1920) / 2); near(wide.y, 0);
});

test('an anchored point keeps its distance from the corner it holds, at any aspect ratio', () => {
  const ref = F.REF;
  // a lower third 96 px in from the bottom-left of the reference frame
  const p = [96, ref.height - 96];

  const same = F.place(p, 'bottom-left', C(1920, 1080));
  assert.deepEqual(same.map(Math.round), [96, 984], 'the reference frame is identity');

  const tall = F.place(p, 'bottom-left', C(1080, 1920));
  const s = F.scale(C(1080, 1920));
  near(tall[0], 96 * s);                        // still 96 design px in from the left
  near(tall[1], 1920 - 96 * s);                 // and 96 design px up from the bottom

  // centre-anchored stays centred
  const mid = F.place([ref.width / 2, ref.height / 2], 'centre', C(1080, 1920));
  assert.deepEqual(mid.map(Math.round), [540, 960]);

  // an unknown anchor falls back to the centre rather than throwing
  assert.deepEqual(F.place([960, 540], 'nonsense', C(1080, 1920)).map(Math.round), [540, 960]);
});

test('clamp pulls a measured box back inside, and says when it had to', () => {
  const comp = C(1080, 1920);

  const inside = F.clamp([100, 100, 400, 200], comp, { margin: 48 });
  assert.equal(inside.moved, false);
  assert.equal(inside.x, 100);

  // a label measured wider than planned, running off the right edge
  const out = F.clamp([800, 100, 400, 200], comp, { margin: 48 });
  assert.equal(out.moved, true);
  assert.equal(out.x, 1080 - 48 - 400);
  assert.equal(out.overflowX, false);

  // wider than the frame itself: pinned to one clean edge, and it says so
  const huge = F.clamp([200, 100, 1400, 200], comp, { margin: 48 });
  assert.equal(huge.overflowX, true);
  assert.equal(huge.x, 48);
  assert.equal(F.clamp([200, 100, 1400, 200], comp, { margin: 48, rtl: true }).x, 1080 - 48 - 1400);

  // the top edge is clamped the same way
  const up = F.clamp([100, -50, 200, 200], comp, { margin: 20 });
  assert.equal(up.y, 20);
  assert.equal(up.moved, true);
});
