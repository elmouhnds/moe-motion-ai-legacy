'use strict';
/**
 * Focus-zoom maths (pure). The zoom rig is one adjustment layer with a Transform
 * effect: Anchor Point A is the comp point shown at Position P, scaled by S.
 *   centre mode  : A = focus clamped so the frame stays covered, P = comp centre
 *   in-place mode: A = P = focus (the point stays where it is; scaling ≥ 100 % about
 *                  an interior point always keeps the frame covered)
 */

const EASES = {
  smooth: { label: 'Smooth', out: 60, in: 60 },
  snappy: { label: 'Snappy', out: 12, in: 88 },
  gentle: { label: 'Gentle', out: 33, in: 33 },
  expo: { label: 'Expo', out: 5, in: 96 }
};

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

function identity(W, H) { return { anchor: [W / 2, H / 2], position: [W / 2, H / 2], scale: 100 }; }

/** Transform values that show focus point f at zoom level z (1 = 100 %). */
function frame(f, z, W, H, mode = 'center') {
  z = Math.max(1, z);
  if (mode === 'inPlace') return { anchor: [clamp(f[0], 0, W), clamp(f[1], 0, H)], position: [clamp(f[0], 0, W), clamp(f[1], 0, H)], scale: z * 100 };
  const hx = W / (2 * z), hy = H / (2 * z);
  return { anchor: [clamp(f[0], hx, W - hx), clamp(f[1], hy, H - hy)], position: [W / 2, H / 2], scale: z * 100 };
}

/** Visible comp rectangle [l, t, r, b] for transform values (for previews and checks). */
function visibleRect(v, W, H) {
  const s = v.scale / 100;
  const l = v.anchor[0] - v.position[0] / s, t = v.anchor[1] - v.position[1] / s;
  return [l, t, l + W / s, t + H / s];
}

/**
 * Keyframe plan for one zoom move.
 * opts: { t: playhead, inDur, hold, outDur, endAtPlayhead, zoomOut, ease, start: current values at t0 }
 * Returns { t0, keys: [{ t, v: {anchor, position, scale}, easeIn, easeOut }], span: [t0, tEnd] }
 */
function plan(f, z, W, H, opts) {
  const e = EASES[opts.ease] || EASES.smooth;
  const total = opts.inDur + (opts.zoomOut ? opts.hold + opts.outDur : 0);
  const t0 = Math.max(0, opts.endAtPlayhead ? opts.t - total : opts.t);
  const from = opts.start || identity(W, H);
  const to = frame(f, z, W, H, opts.mode);
  const keys = [
    { t: t0, v: from, easeOut: { speed: 0, influence: e.out }, easeIn: { speed: 0, influence: 33.33 } },
    { t: t0 + opts.inDur, v: to, easeIn: { speed: 0, influence: e.in }, easeOut: { speed: 0, influence: 33.33 } }
  ];
  if (opts.zoomOut) {
    keys.push({ t: t0 + opts.inDur + opts.hold, v: to, easeOut: { speed: 0, influence: e.out }, easeIn: { speed: 0, influence: 33.33 } });
    keys.push({ t: t0 + total, v: identity(W, H), easeIn: { speed: 0, influence: e.in }, easeOut: { speed: 0, influence: 33.33 } });
  }
  return { t0, keys, to, span: [t0, t0 + total] };
}

/** Cursor keys from click points [{ t, p }]: travel, hold, click pulse, ring ripple, fade. */
function cursorPlan(clicks, { travel = 0.45, fadeOut = 0.5, pulse = true }) {
  const pos = [];
  const scale = [];
  const ringS = [];
  const ringO = [];
  clicks.forEach((c, i) => {
    if (i > 0) {
      const prev = clicks[i - 1];
      const leave = Math.max(prev.t + 0.1, c.t - travel);
      if (leave > prev.t + 1e-3) pos.push({ t: leave, v: prev.p, easeOut: { speed: 0, influence: 70 } });
    }
    pos.push({ t: c.t, v: c.p, easeIn: { speed: 0, influence: 85 } });
    if (pulse) {
      scale.push({ t: Math.max(0, c.t - 0.08), v: [100, 100] }, { t: c.t, v: [84, 84] }, { t: c.t + 0.14, v: [100, 100] });
      ringS.push({ t: c.t, v: [0, 0] }, { t: c.t + 0.4, v: [170, 170], easeIn: { speed: 0, influence: 80 } });
      ringO.push({ t: c.t, v: 90 }, { t: c.t + 0.4, v: 0 });
    }
  });
  const last = clicks[clicks.length - 1].t;
  return { pos, scale, ringS, ringO, fade: [{ t: last + 0.6, v: 100 }, { t: last + 0.6 + fadeOut, v: 0 }] };
}

module.exports = { EASES, identity, frame, visibleRect, plan, cursorPlan };
