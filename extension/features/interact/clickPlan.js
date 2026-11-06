'use strict';
/**
 * Click on Layer (v0.60, docs/features/SAAS_INTERACTION.md) — pure. A cursor that travels to each target, settles,
 * presses, and the target answers the press. The tool measures each target's real centre in After Effects
 * (layers.bounds at the click time, so parents, scale and its own animation count); this plan turns those centres
 * into keys. The preview draws the same keys.
 *
 *   times(n, o)            → the click times from the playhead: the first after one travel, then one every `gap`
 *   entry(from, W, H, p0)  → where the cursor comes from
 *   plan(clicks, o)        → { pos, opacity, scale, ringS, ringO, press: [{ t, f }], end }
 *       clicks = [{ t, p: [x, y] }], o = { from, W, H, travel, gap, depth (%), ripple }
 *       press  = the factor of the target's own Scale at each key (1 = its own value): t is relative to its click
 *
 * Timing that reads as a real hand: arrive 0.14 s before the click and settle (speed 0, 85 % influence), press,
 * dwell, then leave with a soft start (70 %). The target goes down with the cursor and springs back past its rest.
 */
const SETTLE = 0.14, DWELL = 0.22;
const LIMITS = { targets: 12, travel: [0.15, 3], gap: [0.4, 10], depth: [70, 100] };
const clamp = (v, a, b) => Math.min(b, Math.max(a, Number(v)));
const ARRIVE = { easeIn: { speed: 0, influence: 85 } }, LEAVE = { easeOut: { speed: 0, influence: 70 } };

function times(n, o) {
  const travel = clamp(o.travel, ...LIMITS.travel), gap = Math.max(clamp(o.gap, ...LIMITS.gap), travel + SETTLE + DWELL);
  const t0 = (o.time || 0) + travel + SETTLE;
  return Array.from({ length: n }, (_, i) => t0 + i * gap);
}

/** Off frame at the bottom right (corner), off the right edge level with the first target (side), or the comp centre. */
function entry(from, W, H, p0) {
  if (from === 'center') return [W / 2, H / 2];
  if (from === 'side') return [W + 60, p0 ? p0[1] : H / 2];
  return [W + 60, H + 60];
}

/** The press on the target, as factors of its own Scale (its rest = 1): down with the cursor, a small spring back. */
function pressKeys(depth) {
  const d = clamp(depth, ...LIMITS.depth) / 100;
  return [{ t: -0.06, f: 1 }, { t: 0.06, f: d }, { t: 0.22, f: 1 + (1 - d) * 0.3 }, { t: 0.38, f: 1 }];
}

function plan(clicks, o) {
  if (!clicks.length) throw new Error('No clicks');
  const travel = clamp(o.travel, ...LIMITS.travel), start = clicks[0].t - travel - SETTLE;
  const from = entry(o.from, o.W, o.H, clicks[0].p);
  const pos = [Object.assign({ t: start, v: from }, LEAVE)];
  clicks.forEach((c, i) => {
    if (i > 0) pos.push(Object.assign({ t: clicks[i - 1].t + DWELL, v: clicks[i - 1].p }, LEAVE));
    pos.push(Object.assign({ t: c.t - SETTLE, v: c.p }, ARRIVE));
  });
  const scale = [], ringS = [], ringO = [];
  clicks.forEach((c) => {
    scale.push({ t: c.t - 0.06, v: [100, 100] }, { t: c.t + 0.04, v: [84, 84] }, { t: c.t + 0.2, v: [100, 100] });
    if (o.ripple !== false) { ringS.push({ t: c.t, v: [0, 0] }, Object.assign({ t: c.t + 0.45, v: [170, 170] }, ARRIVE)); ringO.push({ t: c.t, v: 90 }, { t: c.t + 0.45, v: 0 }); }
  });
  const last = clicks[clicks.length - 1].t, end = last + 0.7 + 0.4;
  const opacity = (o.from === 'center' ? [{ t: start, v: 0 }, { t: start + 0.2, v: 100 }] : [{ t: start, v: 100 }]).concat([{ t: last + 0.7, v: 100 }, { t: end, v: 0 }]);
  return { start, pos, opacity, scale, ringS, ringO, press: pressKeys(o.depth), end };
}

/** Linear-in-time value of a key list (the previews ease between keys with the plan's own smoothstep). */
function valueAt(keys, t) {
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1], b = keys[i], u = (t - a.t) / (b.t - a.t || 1), s = u * u * (3 - 2 * u);
      return Array.isArray(a.v) ? a.v.map((x, j) => x + (b.v[j] - x) * s) : a.v + (b.v - a.v) * s;
    }
  }
  return keys[keys.length - 1].v;
}

module.exports = { SETTLE, DWELL, LIMITS, times, entry, pressKeys, plan, valueAt };
