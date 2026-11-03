'use strict';
/**
 * Live Preview simulation (v0.39, docs/features/LIVE_PREVIEW.md) — the effector preview in the Inspector runs the
 * SAME maths as the expressions MOE writes (features/grid/effectors.js applyAt / weight), on a sample grid or the
 * user's own grid, while the null is dragged with the mouse. No DOM here (tested in Node); the canvas lives in
 * app/ui/clonerPreview.js.
 *
 *   const sim = createSim({ args, items })   items: [[x, y]…] in the grid's space (px) — default a 7 × 4 sample
 *   sim.grab(t, x, y) / sim.drag(t, x, y) / sim.release(t)   the null follows the mouse; every move is recorded
 *   sim.sweep(t0)                                             play the tool's sweep (left → right in 2 s, hold, back)
 *   sim.frame(t) → [{ x, y, scale, rot, op, w, tint }]        what every item looks like at time t
 *
 * The recorded path is what Spring / Inertia read (the step-response sum looks back ≤ 3 s), so a fast drag and a
 * sudden stop show the real overshoot. The history is trimmed to that window.
 */
const EF = require('./effectors');

const KEEP = EF.SPRING.maxWindow + 0.5; // seconds of path kept for the spring
const MAX_POINTS = 600;

/** The sample grid: 7 columns × 4 rows, 90 px apart, centred on 0. */
function sampleItems(cols = 7, rows = 4, gap = 90) {
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([(c - (cols - 1) / 2) * gap, (r - (rows - 1) / 2) * gap]);
  return out;
}

/** Biggest distance of an item from the centre (sizes the falloff like grid.effector does when Size is 0). */
const extentOf = (items) => Math.max(50, ...items.map((p) => Math.hypot(p[0], p[1])));

/** Effector control values for the preview: the tool's args, with Size 0 → about 60 % of the grid (as the tool). */
function valuesFor(args, items) {
  const ext = extentOf(items);
  const v = EF.valuesOf(Object.assign({}, args, { size: args.size || Math.round(Math.max(80, ext * 0.6)), invert: !!args.invert }));
  v.audioMax = 1;
  return v;
}

/** Stand-ins for what only After Effects has: a soundtrack (two soft beats a second) and an image (dark → bright, left → right). */
const beat = (t) => Math.pow(Math.max(0, Math.sin(t * Math.PI * 4)), 3);
function sampleLuma(ext) { return (cx) => Math.min(Math.max(0.5 + cx / (2.2 * ext), 0), 1); }

function createSim({ args = {}, items = null } = {}) {
  let A = Object.assign({}, args), P = items && items.length ? items.map((p) => [p[0], p[1]]) : sampleItems();
  let V = valuesFor(A, P), ext = extentOf(P), luma = sampleLuma(ext);
  let hist = [];            // [t, x, y] — where the null was
  let dragging = false, sweepFrom = null, delayFrom = 0;
  const home = () => (A.sweep ? [-(ext + V.size / 2), 0] : [0, 0]);

  function record(t, x, y) {
    hist.push([t, x, y]);
    // keep the window the spring reads (and a hard cap for very fast pointers)
    while (hist.length > 2 && (t - hist[1][0] > KEEP || hist.length > MAX_POINTS)) hist.shift();
  }
  /** Sweep path: 2 s across (eased), hold 1 s, 2 s back, hold 1 s — loops while nobody drags. */
  function sweepAt(t) {
    const a = -(ext + V.size / 2), b = ext + V.size / 2, u = ((t - sweepFrom) % 6 + 6) % 6, ss = (q) => q * q * (3 - 2 * q);
    const x = u < 2 ? a + (b - a) * ss(u / 2) : u < 3 ? b : u < 5 ? b - (b - a) * ss((u - 3) / 2) : a;
    return [x, 0];
  }
  function posAt(t) {
    if (!dragging && sweepFrom !== null && (!hist.length || t >= hist[hist.length - 1][0])) return sweepAt(t);
    if (!hist.length) return home();
    if (t <= hist[0][0]) return [hist[0][1], hist[0][2]];
    const last = hist[hist.length - 1];
    if (t >= last[0]) return [last[1], last[2]];
    let lo = 0, hi = hist.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (hist[mid][0] <= t) lo = mid; else hi = mid; }
    const p = hist[lo], q = hist[hi], u = q[0] > p[0] ? (t - p[0]) / (q[0] - p[0]) : 1;
    return [p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u];
  }
  /** Delay type: the moves play from full to rest in 0.6 s (like the keys grid.effector writes), every 2.4 s. */
  function valuesAt(t) {
    if (Math.round(V.type) !== 5) return V;
    const u = Math.min(Math.max((((t - delayFrom) % 2.4) + 2.4) % 2.4 / 0.6, 0), 1), f = 1 - u * u * (3 - 2 * u);
    return Object.assign({}, V, { moveX: V.moveX * f, moveY: V.moveY * f, scale: V.scale * f, rotate: V.rotate * f, fade: V.fade * f });
  }
  const src = {
    at: valuesAt,
    toLocal: (t) => EF.localFn({ position: posAt(t) }),
    originAt: posAt,
    audioAt: beat,
    lumaAt: (cx) => luma(cx)
  };

  const sim = {
    get items() { return P; },
    get values() { return V; },
    get extent() { return ext; },
    get history() { return hist.length; },
    get dragging() { return dragging; },
    get sweeping() { return !dragging && sweepFrom !== null; },
    setArgs(next) { A = Object.assign({}, next); V = valuesFor(A, P); },
    setItems(next) { P = next && next.length ? next.map((p) => [p[0], p[1]]) : sampleItems(); ext = extentOf(P); luma = sampleLuma(ext); V = valuesFor(A, P); },
    effectorAt: posAt,
    // a click jumps the null there: hold where it was until now (otherwise the path would slide from the last point)
    grab(t, x, y) { const p = posAt(t); record(t, p[0], p[1]); dragging = true; sweepFrom = null; record(t, x, y); },
    drag(t, x, y) { if (dragging) record(t, x, y); },
    release(t) { if (!dragging) return; dragging = false; const p = posAt(t); record(t, p[0], p[1]); },
    sweep(t0) { const p = posAt(t0); hist = []; record(t0, p[0], p[1]); sweepFrom = t0; delayFrom = t0; },
    /** Put the null back where the tool puts it (centre, or left of the grid for a sweep) — no swing; play: start the sweep. */
    reset(t0, play = !!A.sweep) { hist = []; sweepFrom = play ? t0 : null; delayFrom = t0; const p = play ? sweepAt(t0) : home(); record(t0 - KEEP, p[0], p[1]); record(t0, p[0], p[1]); },
    /** Every item at time t: offsets in px, scale / opacity multipliers, rotation, weight and colour tint (0..1). */
    frame(t) {
      const pos = posAt(t), toLocal = EF.localFn({ position: pos });
      return P.map((p, i) => {
        const r = EF.applyAt([src], { i, k: i, n: P.length, x: p[0], y: p[1], fd: 1 / 30, compAt: () => p, baseRotAt: () => 0 }, t);
        const l = toLocal(p[0], p[1]);
        const w = EF.weight(V, l[0], l[1], { t, luma: luma(p[0]) });
        return { x: p[0] + r.dx, y: p[1] + r.dy, scale: r.scaleMul, rot: r.rot, op: r.opMul, w, tint: Math.min(Math.max(w * (V.colourMix || 0) / 100, 0), 1) };
      });
    },
    /** The falloff's weight at a point (for the overlay). */
    weightAt(t, x, y) { const l = EF.localFn({ position: posAt(t) })(x, y); return EF.weight(V, l[0], l[1], { t, luma: luma(x) }); }
  };
  sim.reset(0);
  return sim;
}

module.exports = { createSim, sampleItems, valuesFor, beat, extentOf, KEEP, MAX_POINTS };
