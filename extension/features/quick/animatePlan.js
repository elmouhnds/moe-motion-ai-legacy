'use strict';
/**
 * Animate plan (v0.47, docs/features/REAL_PREVIEWS.md) — pure. The keyframes Quick Animate and Trim Paths write,
 * as data, and a reader that plays them back the way After Effects does (temporal ease → bezier through
 * `curves/bezier.fromTemporal`). The tools build their keys here, and the tile previews draw these same keys,
 * so a preview is the real motion (timing, ease, overshoot), never a look-alike.
 *
 *   keysFor(e, t0, dur, a, b, mid)  → [{ t, v, easeIn?, easeOut?, interp? }]  (the tool's own `k()`)
 *   animate(args, pose)            → { prop, keys }   for one property, pose = the layer's rest values
 *   trim(args)                      → { start?, end? } Trim Paths keys (percent)
 *   valueAt(keys, t)                → the value at time t (number or array)
 */
const { EASES } = require('../zoom/math');
const BZ = require('../curves/bezier');

/** The ease pair a tool writes: AE influence on the outgoing / incoming side (speed 0), or linear. */
const easePair = (name) => (name === 'linear' || !EASES[name] ? { out: { interp: 'linear' }, in: { interp: 'linear' } }
  : { out: { easeOut: { speed: 0, influence: EASES[name].out } }, in: { easeIn: { speed: 0, influence: EASES[name].in } } });

/** Two keys (or three with an overshoot `mid` at 72 %), exactly as Quick Animate writes them. */
function keysFor(e, t0, dur, a, b, mid) {
  const first = Object.assign({ t: t0, v: a }, e.out, e.out.interp ? {} : { easeIn: { speed: 0, influence: 33.33 } });
  const last = Object.assign({ t: t0 + dur, v: b }, e.in, e.in.interp ? {} : { easeOut: { speed: 0, influence: 33.33 } });
  return mid !== undefined ? [first, { t: t0 + dur * 0.72, v: mid, easeIn: { speed: 0, influence: 50 }, easeOut: { speed: 0, influence: 50 } }, last] : [first, last];
}

/** Quick Animate on a layer at rest `pose` ({ position, offset, opacity, scale, rotation }); offset = where "away" is. */
function animate(args, pose) {
  const e = easePair(args.ease || 'snappy');
  const dur = args.duration > 0 ? args.duration : 0.6;
  const p = pose || {};
  const k = (a, b, mid) => keysFor(e, 0, dur, a, b, mid);
  if (/^move/.test(args.kind)) {
    const pos = p.position || [0, 0], off = p.offset || [0, 0];
    const away = [pos[0] + off[0], pos[1] + off[1]];
    const over = args.overshoot && args.dir === 'in' ? [pos[0] - off[0] * 0.04, pos[1] - off[1] * 0.04] : undefined;
    return { prop: 'position', keys: args.dir === 'in' ? k(away, pos, over) : k(pos, away) };
  }
  if (args.kind === 'fade') {
    const o = p.opacity === undefined ? 100 : p.opacity;
    const rest = args.dir === 'in' && o === 0 ? 100 : o;
    return { prop: 'opacity', keys: args.dir === 'in' ? k(0, rest) : k(rest, 0) };
  }
  if (args.kind === 'scale') {
    // v0.48: `away` = the scale at the far end in % of the rest (0 = from / to nothing, 130 = zoom from bigger)
    const s = p.scale || [100, 100];
    const f = (args.away === undefined ? 0 : args.away) / 100;
    const far = s.map((v) => v * f);
    // the overshoot passes the rest on the far side's opposite: 8 % past it from small, 5 % under it from big
    const over = args.overshoot && args.dir === 'in' ? s.map((v) => v * (f > 1 ? 0.95 : 1.08)) : undefined;
    return { prop: 'scale', keys: args.dir === 'in' ? k(far, s, over) : k(s, far) };
  }
  if (args.kind === 'spin') {
    // v0.48: `angle` (default a half turn); the overshoot is 8° per half turn past the rest
    const r = p.rotation || 0, ang = args.angle === undefined ? 180 : args.angle;
    return { prop: 'rotation', keys: args.dir === 'in' ? k(r - ang, r, args.overshoot ? r + ang * (8 / 180) : undefined) : k(r, r + ang) };
  }
  return { prop: null, keys: [] };
}

/** v0.48: "Also fade" — Opacity keys on the same timing as the move (never an overshoot), or null. */
function fade(args, pose) {
  if (!args.fade || args.kind === 'fade') return null;
  const e = easePair(args.ease || 'snappy');
  const dur = args.duration > 0 ? args.duration : 0.6;
  const o = pose && pose.opacity !== undefined ? pose.opacity : 100;
  const rest = args.dir === 'in' && o === 0 ? 100 : o;
  return { prop: 'opacity', keys: args.dir === 'in' ? keysFor(e, 0, dur, 0, rest) : keysFor(e, 0, dur, rest, 0) };
}

/**
 * v0.58 (docs/features/APPLE_MOTION.md): "Blur" — the layer comes in sharp from a blur (or leaves into one), on the
 * same timing and ease as the move: Blurriness of the layer's `MOE Blur` (Gaussian Blur), in px. null when blur is 0.
 */
function blur(args) {
  const b = Number(args.blur) || 0;
  if (b <= 0) return null;
  const e = easePair(args.ease || 'snappy');
  const dur = args.duration > 0 ? args.duration : 0.6;
  return { prop: 'blur', keys: args.dir === 'in' ? keysFor(e, 0, dur, b, 0) : keysFor(e, 0, dur, 0, b) };
}

/** Trim Paths keys (Start / End in percent) for draw / erase / travel / drawErase — the tool's own timing. */
function trim(args) {
  const e = easePair(args.ease || 'smooth');
  const d = args.duration > 0 ? args.duration : 1;
  const two = (a, b, s, f) => [Object.assign({ t: s, v: a }, e.out), Object.assign({ t: f, v: b }, e.in)];
  if (args.mode === 'draw') return { end: two(0, 100, 0, d) };
  if (args.mode === 'erase') return { start: two(0, 100, 0, d) };
  if (args.mode === 'travel') { const lag = d * ((args.lag === undefined ? 35 : args.lag) / 100); return { end: two(0, 100, 0, d), start: two(0, 100, lag, d + lag) }; }
  if (args.mode === 'drawErase') { const hold = args.hold === undefined ? 0.5 : args.hold; return { end: two(0, 100, 0, d), start: two(0, 100, d + hold, 2 * d + hold) }; }
  return {};
}

const lerp = (a, b, u) => (Array.isArray(a) ? a.map((x, i) => x + (b[i] - x) * u) : a + (b - a) * u);
/** Value at time t: held before the first / after the last key; between keys, AE's temporal ease (speed 0) or linear. */
function valueAt(keys, t) {
  if (!keys || !keys.length) return undefined;
  if (t <= keys[0].t) return keys[0].v;
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.v;
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const A = keys[i], B = keys[i + 1];
  const x = (t - A.t) / (B.t - A.t);
  if (A.interp === 'linear' || B.interp === 'linear' || !A.easeOut || !B.easeIn) return lerp(A.v, B.v, x);
  // the ease After Effects plays: out influence of A, in influence of B, speed 0 on both sides
  const seg = { dt: B.t - A.t, dv: [1], spatial: false };
  const curve = BZ.fromTemporal([A.easeOut], [B.easeIn], seg);
  return lerp(A.v, B.v, BZ.valueAt(curve, x));
}
/** When the keys end (for a preview loop). */
const endOf = (...lists) => Math.max(0, ...lists.filter(Boolean).map((k) => (k.length ? k[k.length - 1].t : 0)));

module.exports = { easePair, keysFor, animate, fade, blur, trim, valueAt, endOf };
