'use strict';
/**
 * Shakes (v0.59, docs/features/STYLES_SHAKES.md) — pure. An impact as REAL keyframes (not an expression), so it can be
 * edited, eased and baked like any animation: a damped oscillation around the layer's rest value, one key at each
 * peak, every key eased (speed 0 at the peak, like a hand-keyed shake).
 *
 *   TYPES                         the five shakes and their defaults
 *   plan(type, o)                 → { position?: [{ t, v: [dx, dy] }], scale?: [{ t, v: ds }], rotation?: [{ t, v: dr }], end }
 *                                    offsets from the rest value, t from the playhead (0)
 *   o = { intensity (px or %), rotation (°), frequency (Hz), settle (s) }
 *
 * Peaks are half a period apart (1 / 2f); the amplitude falls to 5 % by `settle`, then one last key returns to rest.
 * Jitter uses a hash (never Math.random) so the same settings always give the same keys (tests, Restore, previews).
 */
const TYPES = {
  bump: { label: 'Bump', hint: 'A vertical hit that bounces out', intensity: 40, rotation: 0, frequency: 7, settle: 0.6, axes: { y: 1 } },
  zoomPunch: { label: 'Zoom Punch', hint: 'The layer punches bigger and settles, with a small twist', intensity: 12, rotation: 3, frequency: 6, settle: 0.6, axes: { scale: 1 } },
  whip: { label: 'Whip', hint: 'A sideways whip with a tilt, settling fast', intensity: 70, rotation: 6, frequency: 5, settle: 0.5, axes: { x: 1 } },
  slam: { label: 'Slam', hint: 'A hard hit on every axis — the heaviest shake', intensity: 55, rotation: 8, frequency: 9, settle: 0.7, axes: { x: 0.6, y: 1, scale: 0.12 } },
  jitter: { label: 'Jitter', hint: 'A fast, tight rattle (glitch, buzz, error)', intensity: 10, rotation: 1.5, frequency: 22, settle: 0.5, axes: { x: 1, y: 1, rand: true } }
};
const LIMITS = { intensity: [0, 300], rotation: [0, 90], frequency: [1, 40], settle: [0.1, 4] };
const clamp = (v, [a, b]) => Math.min(b, Math.max(a, Number(v)));
/** A deterministic hash in [-1, 1] (Jitter). */
const hs = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };

function plan(type, o) {
  const T = TYPES[type];
  if (!T) throw new Error(`Unknown shake ${type}`);
  const p = Object.assign({}, T, o || {});
  const I = clamp(p.intensity, LIMITS.intensity), R = clamp(p.rotation, LIMITS.rotation), f = clamp(p.frequency, LIMITS.frequency), settle = clamp(p.settle, LIMITS.settle);
  const half = 1 / (2 * f), n = Math.max(2, Math.round(settle / half));
  const decay = Math.pow(0.05, 1 / n); // the amplitude after n peaks is 5 % of the first
  const ax = T.axes;
  const pos = [{ t: 0, v: [0, 0] }], sc = [{ t: 0, v: 0 }], rot = [{ t: 0, v: 0 }];
  for (let k = 1; k <= n; k++) {
    const a = Math.pow(decay, k - 1) * (k % 2 ? 1 : -1), t = k * half;
    const jx = ax.rand ? hs(k, 1) : 1, jy = ax.rand ? hs(k, 2) : 1;
    pos.push({ t, v: [(ax.x || 0) * I * a * jx, (ax.y || 0) * I * a * jy] });
    // Zoom Punch / Slam: the scale hit goes up first and swings below the rest, smaller each time
    sc.push({ t, v: (ax.scale ? (type === 'slam' ? I * ax.scale : I) : 0) * a });
    rot.push({ t, v: R * a * (ax.rand ? hs(k, 3) : 1) });
  }
  const end = (n + 1) * half;
  pos.push({ t: end, v: [0, 0] }); sc.push({ t: end, v: 0 }); rot.push({ t: end, v: 0 });
  const out = { end };
  if (ax.x || ax.y) out.position = pos;
  if (ax.scale) out.scale = sc;
  if (R > 0) out.rotation = rot;
  return out;
}

/** Ease every key (speed 0 at the peaks, 40 % influence) — the keys a hand-keyed shake has. */
const EASE = { easeIn: { speed: 0, influence: 40 }, easeOut: { speed: 0, influence: 40 } };
/** The offset at time t (for the previews; between peaks it eases like After Effects with speed 0 at each key). */
function valueAt(list, t) {
  const PLAN = require('./animatePlan');
  return PLAN.valueAt(list.map((k) => Object.assign({}, k, EASE)), t);
}

module.exports = { TYPES, LIMITS, plan, EASE, valueAt };
