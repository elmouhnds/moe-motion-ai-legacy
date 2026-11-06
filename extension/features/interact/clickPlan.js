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
/* v0.61 (ENGINE2.md): with o.fd (the comp's frame duration) every time is a whole number of frames — at least one
   frame per step — so the plan IS what After Effects keeps (keys.write would otherwise move them to the grid). */
const frames = (sec, fd, min = 1) => (fd ? Math.max(min, Math.round(sec / fd)) * fd : sec);
const grid = (t, fd) => (fd ? Math.round(Math.round(t / fd) * fd * 1e6) / 1e6 : t);
const LIMITS = { targets: 12, travel: [0.15, 3], gap: [0.4, 10], depth: [70, 100] };
const clamp = (v, a, b) => Math.min(b, Math.max(a, Number(v)));
const ARRIVE = { easeIn: { speed: 0, influence: 85 } }, LEAVE = { easeOut: { speed: 0, influence: 70 } };

function times(n, o) {
  const fd = o.fd, travel = clamp(o.travel, ...LIMITS.travel);
  const gap = frames(Math.max(clamp(o.gap, ...LIMITS.gap), travel + SETTLE + DWELL), fd);
  const t0 = grid((o.time || 0) + frames(travel, fd) + frames(SETTLE, fd), fd);
  return Array.from({ length: n }, (_, i) => grid(t0 + i * gap, fd));
}

/** Off frame at the bottom right (corner), off the right edge level with the first target (side), or the comp centre. */
function entry(from, W, H, p0) {
  if (from === 'center') return [W / 2, H / 2];
  if (from === 'side') return [W + 60, p0 ? p0[1] : H / 2];
  return [W + 60, H + 60];
}

/** The press on the target, as factors of its own Scale (its rest = 1): down with the cursor, a small spring back. */
function pressKeys(depth, fd) {
  const d = clamp(depth, ...LIMITS.depth) / 100;
  const a = frames(0.06, fd), b = Math.max(a + (fd || 0.01), frames(0.22, fd)), c = Math.max(b + (fd || 0.01), frames(0.38, fd));
  return [{ t: -a, f: 1 }, { t: a, f: d }, { t: b, f: 1 + (1 - d) * 0.3 }, { t: c, f: 1 }];
}

function plan(clicks, o) {
  if (!clicks.length) throw new Error('No clicks');
  const fd = o.fd, F = (sec) => frames(sec, fd);
  const travel = clamp(o.travel, ...LIMITS.travel), settle = F(SETTLE), dwell = F(DWELL);
  const start = grid(clicks[0].t - F(travel) - settle, fd);
  const from = entry(o.from, o.W, o.H, clicks[0].p);
  const pos = [Object.assign({ t: start, v: from }, LEAVE)];
  clicks.forEach((c, i) => {
    if (i > 0) pos.push(Object.assign({ t: grid(clicks[i - 1].t + dwell, fd), v: clicks[i - 1].p }, LEAVE));
    pos.push(Object.assign({ t: grid(c.t - settle, fd), v: c.p }, ARRIVE));
  });
  const scale = [], ringS = [], ringO = [];
  clicks.forEach((c) => {
    scale.push({ t: grid(c.t - F(0.06), fd), v: [100, 100] }, { t: grid(c.t + F(0.04), fd), v: [84, 84] }, { t: grid(c.t + Math.max(F(0.2), F(0.04) + 2 * (fd || 0.01)), fd), v: [100, 100] });
    if (o.ripple !== false) { const r = grid(c.t + F(0.45), fd); ringS.push({ t: c.t, v: [0, 0] }, Object.assign({ t: r, v: [170, 170] }, ARRIVE)); ringO.push({ t: c.t, v: 90 }, { t: r, v: 0 }); }
  });
  const last = clicks[clicks.length - 1].t, hold = grid(last + F(0.7), fd), end = grid(hold + F(0.4), fd);
  const opacity = (o.from === 'center' ? [{ t: start, v: 0 }, { t: grid(start + F(0.2), fd), v: 100 }] : [{ t: start, v: 100 }]).concat([{ t: hold, v: 100 }, { t: end, v: 0 }]);
  return { start, pos, opacity, scale, ringS, ringO, press: pressKeys(o.depth, fd), end };
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

module.exports = { SETTLE, DWELL, LIMITS, frames, grid, times, entry, pressKeys, plan, valueAt };
