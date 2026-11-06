'use strict';
/**
 * Carousel 3D (v0.63, docs/features/WIPE_CAROUSEL.md) — pure; the tool and the tile preview use the same numbers.
 *
 *   radius(n, maxW, gap)        the smallest ring where neighbours never overlap: chord 2R·sin(π/n) = widest + gap
 *   ring(n, R)                  card i at angle θ = 360·i/n:  position (R·sinθ, 0, −R·cosθ), Y Rotation θ (faces out;
 *                               card 0 at the front, nearest the camera)
 *   steps(n, o)                 the null's Y Rotation keys: hold, turn by −360/n (the next card comes to the front),
 *                               hold… — every key on the comp's frame grid when o.fd is given
 *   depth(theta, rot, amount)   a card's opacity for its angle on the ring: 100 at the front, 100 − amount at the back
 */
const FG = require('../../core/framegrid');
const LIMITS = { cards: [3, 24], gap: [0, 2000], turn: [0.1, 5], hold: [0, 20], depth: [0, 100], tilt: [-45, 45] };
const clamp = (v, [a, b]) => Math.min(b, Math.max(a, Number(v)));
const rad = (d) => (d * Math.PI) / 180;

function radius(n, maxW, gap) { return (maxW + clamp(gap, LIMITS.gap)) / (2 * Math.sin(Math.PI / n)); }

function ring(n, R) {
  return Array.from({ length: n }, (_, i) => {
    const th = (360 * i) / n;
    return { theta: th, position: [R * Math.sin(rad(th)), 0, -R * Math.cos(rad(th))], rotY: th };
  });
}

const EASE = { easeIn: { speed: 0, influence: 75 }, easeOut: { speed: 0, influence: 75 } };
function steps(n, o) {
  const fd = o.fd, g = (t) => (fd ? FG.snap(t, fd) : t);
  const turn = clamp(o.turn, LIMITS.turn), hold = clamp(o.hold, LIMITS.hold), count = Math.max(1, Math.round(o.steps || n));
  const step = (o.reverse ? 1 : -1) * (360 / n), t0 = o.time || 0;
  const keys = [Object.assign({ t: g(t0), v: 0 }, EASE)];
  let t = t0;
  for (let s = 1; s <= count; s++) {
    t += hold;
    if (hold > 0) keys.push(Object.assign({ t: g(t), v: step * (s - 1) }, EASE));
    t += turn;
    keys.push(Object.assign({ t: g(t), v: step * s }, EASE));
  }
  return keys.filter((k, i) => !i || k.t > keys[i - 1].t);
}

function depth(theta, rot, amount) {
  const a = clamp(amount, LIMITS.depth);
  return 100 - (a * (1 - Math.cos(rad(theta + rot)))) / 2;
}

module.exports = { LIMITS, radius, ring, steps, depth, EASE };
