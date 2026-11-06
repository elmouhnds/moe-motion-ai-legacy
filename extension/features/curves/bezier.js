'use strict';
/**
 * Ease curves (pure maths, no host code).
 *
 * A curve is a CSS-style cubic Bézier { x1, y1, x2, y2 } on the value graph between two keys
 * (x = time 0→1, y = progress 0→1). After Effects stores the same shape as temporal ease on the
 * two keys of the segment (Scripting Guide: KeyframeEase(speed, influence)):
 *   outgoing key: influence = x1·100 %, speed = (y1 / x1) · average speed
 *   incoming key: influence = (1 − x2)·100 %, speed = ((1 − y2) / (1 − x2)) · average speed
 * average speed = Δvalue / Δtime, per dimension for non-spatial properties, along the path for
 * spatial ones (Position) — where AE takes one ease, and a negative speed is not allowed, so
 * anticipation (y < 0 at the start, y > 1 at the end) is clamped to 0 there and reported.
 */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const C = (id, label, x1, y1, x2, y2, tag) => ({ id, label, x1, y1, x2, y2, tag });

/** Penner-style eases as cubic Béziers (the widely used easings.net values) + motion-design favourites. */
const PRESETS = [
  C('linear', 'Linear', 0.333, 0.333, 0.667, 0.667, 'Basic'),
  C('ease', 'Ease', 0.25, 0.1, 0.25, 1, 'Basic'),
  C('easyEase', 'Easy Ease (AE)', 0.333, 0, 0.667, 1, 'Basic'),
  C('inSine', 'In Sine', 0.12, 0, 0.39, 0, 'In'),
  C('inQuad', 'In Quad', 0.11, 0, 0.5, 0, 'In'),
  C('inCubic', 'In Cubic', 0.32, 0, 0.67, 0, 'In'),
  C('inQuart', 'In Quart', 0.5, 0, 0.75, 0, 'In'),
  C('inQuint', 'In Quint', 0.64, 0, 0.78, 0, 'In'),
  C('inExpo', 'In Expo', 0.7, 0, 0.84, 0, 'In'),
  C('inCirc', 'In Circ', 0.55, 0, 1, 0.45, 'In'),
  C('inBack', 'In Back', 0.36, 0, 0.66, -0.56, 'In'),
  C('outSine', 'Out Sine', 0.61, 1, 0.88, 1, 'Out'),
  C('outQuad', 'Out Quad', 0.5, 1, 0.89, 1, 'Out'),
  C('outCubic', 'Out Cubic', 0.33, 1, 0.68, 1, 'Out'),
  C('outQuart', 'Out Quart', 0.25, 1, 0.5, 1, 'Out'),
  C('outQuint', 'Out Quint', 0.22, 1, 0.36, 1, 'Out'),
  C('outExpo', 'Out Expo', 0.16, 1, 0.3, 1, 'Out'),
  C('outCirc', 'Out Circ', 0, 0.55, 0.45, 1, 'Out'),
  C('outBack', 'Out Back', 0.34, 1.56, 0.64, 1, 'Out'),
  C('inOutSine', 'In-Out Sine', 0.37, 0, 0.63, 1, 'In-Out'),
  C('inOutQuad', 'In-Out Quad', 0.45, 0, 0.55, 1, 'In-Out'),
  C('inOutCubic', 'In-Out Cubic', 0.65, 0, 0.35, 1, 'In-Out'),
  C('inOutQuart', 'In-Out Quart', 0.76, 0, 0.24, 1, 'In-Out'),
  C('inOutQuint', 'In-Out Quint', 0.83, 0, 0.17, 1, 'In-Out'),
  C('inOutExpo', 'In-Out Expo', 0.87, 0, 0.13, 1, 'In-Out'),
  C('inOutCirc', 'In-Out Circ', 0.85, 0, 0.15, 1, 'In-Out'),
  C('inOutBack', 'In-Out Back', 0.68, -0.6, 0.32, 1.6, 'In-Out'),
  C('snap', 'Snap', 0.9, 0, 0.1, 1, 'Motion'),
  C('glide', 'Glide', 0.2, 0.6, 0.1, 1, 'Motion'),
  C('punch', 'Punch', 0.05, 0.7, 0.1, 1, 'Motion'),
  C('swoosh', 'Swoosh', 0.7, 0, 0, 1, 'Motion'),
  C('settle', 'Settle', 0.3, 1.25, 0.5, 1, 'Motion'),
  // v0.58 (docs/features/APPLE_MOTION.md): calm, OS-style interface motion — named by what they do
  C('nativeStandard', 'Native Standard', 0.4, 0, 0.2, 1, 'Native'),
  C('nativeEmphasized', 'Native Emphasized', 0.2, 0, 0, 1, 'Native'),
  C('nativeEnter', 'Native Enter', 0, 0, 0.2, 1, 'Native'),
  C('nativeExit', 'Native Exit', 0.4, 0, 1, 1, 'Native'),
  C('springSoft', 'Spring Soft', 0.25, 1.18, 0.5, 1, 'Native'),
  C('springBouncy', 'Spring Bouncy', 0.3, 1.5, 0.45, 1, 'Native'),
  C('anticipate', 'Anticipate', 0.55, -0.35, 0.3, 1, 'Native')
];
const TAGS = ['Basic', 'In', 'Out', 'In-Out', 'Motion', 'Native'];
const X_MIN = 0.01, X_MAX = 0.99, Y_MIN = -1, Y_MAX = 2;

/** Keep a curve inside what AE can store (influence 0.1–100 % on each side). */
function normalize(c) {
  return {
    x1: clamp(Number(c.x1), X_MIN, X_MAX), y1: clamp(Number(c.y1), Y_MIN, Y_MAX),
    x2: clamp(Number(c.x2), X_MIN, X_MAX), y2: clamp(Number(c.y2), Y_MIN, Y_MAX)
  };
}

/** Point on the curve at parameter t (0–1). */
function point(c, t) {
  const u = 1 - t;
  return { x: 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t, y: 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t };
}

/** Progress y at time x (0–1), by bisection on t (x(t) is monotonic for x1, x2 in [0, 1]). */
function valueAt(c, x) {
  let lo = 0, hi = 1, t = x;
  for (let i = 0; i < 40; i++) {
    t = (lo + hi) / 2;
    if (point(c, t).x < x) lo = t; else hi = t;
  }
  return point(c, t).y;
}

/** Speed relative to the average (dy/dx) at time x — 1 = average speed; what the speed graph shows. */
function speedAt(c, x) {
  const h = 1e-3;
  const a = Math.max(0, x - h), b = Math.min(1, x + h);
  return (valueAt(c, b) - valueAt(c, a)) / (b - a);
}

/**
 * Temporal ease for one segment.
 * seg: { dt (seconds, > 0), dv: number[] (value change per dimension), spatial: boolean }
 * → { out: [{ speed, influence }], in: [{ speed, influence }], clamped: boolean }
 */
function toTemporal(curve, seg) {
  const c = normalize(curve);
  const outF = c.y1 / c.x1, inF = (1 - c.y2) / (1 - c.x2);
  const outInf = clamp(c.x1 * 100, 0.1, 100), inInf = clamp((1 - c.x2) * 100, 0.1, 100);
  const dt = seg.dt > 0 ? seg.dt : 1;
  let clamped = false;
  if (seg.spatial) {
    const dist = Math.hypot(...seg.dv);
    const avg = dist / dt;
    let so = outF * avg, si = inF * avg;
    if (so < 0) { so = 0; clamped = true; }
    if (si < 0) { si = 0; clamped = true; }
    return { out: [{ speed: so, influence: outInf }], in: [{ speed: si, influence: inInf }], clamped };
  }
  return {
    out: seg.dv.map((d) => ({ speed: outF * (d / dt), influence: outInf })),
    in: seg.dv.map((d) => ({ speed: inF * (d / dt), influence: inInf })),
    clamped
  };
}

/** Read a curve back from the ease on a segment (the first dimension that changes). */
function fromTemporal(outEase, inEase, seg) {
  const dt = seg.dt > 0 ? seg.dt : 1;
  let i = seg.spatial ? 0 : Math.max(0, seg.dv.findIndex((d) => Math.abs(d) > 1e-9));
  const avg = seg.spatial ? Math.hypot(...seg.dv) / dt : seg.dv[i] / dt;
  i = Math.min(i, outEase.length - 1, inEase.length - 1);
  const x1 = outEase[i].influence / 100, x2 = 1 - inEase[i].influence / 100;
  if (!avg) return normalize({ x1, y1: 0, x2, y2: 1 });
  return normalize({ x1, y1: (outEase[i].speed / avg) * x1, x2, y2: 1 - (inEase[i].speed / avg) * (1 - x2) });
}

/** Segments between consecutive selected keys: [{ a, b }] key indices (1-based, sorted, distinct). */
function segments(selectedKeys) {
  const k = [...new Set(selectedKeys)].sort((p, q) => p - q);
  const out = [];
  for (let i = 0; i + 1 < k.length; i++) out.push({ a: k[i], b: k[i + 1] });
  return out;
}

const round = (v) => Math.round(v * 1000) / 1000;
const css = (c) => `cubic-bezier(${round(c.x1)}, ${round(c.y1)}, ${round(c.x2)}, ${round(c.y2)})`;

module.exports = { PRESETS, TAGS, normalize, point, valueAt, speedAt, toTemporal, fromTemporal, segments, css, X_MIN, X_MAX, Y_MIN, Y_MAX };
