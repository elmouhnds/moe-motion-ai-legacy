'use strict';
/**
 * Frame grid (v0.61, docs/features/ENGINE2.md) — pure, the same rule as host keys.write:
 * every generated key lands on a frame of the comp; keys that meet on one frame merge — the first and last keys of a
 * list win (they hold the rest values), otherwise the one nearest that frame.
 *
 *   snap(t, fd)            → t on the grid
 *   snapKeys(keys, fd)     → { keys, moved, merged }
 */
const snap = (t, fd) => Math.round(Math.round(Number(t) / fd) * fd * 1e6) / 1e6;

function snapKeys(keys, fd) {
  const out = [];
  let moved = 0;
  keys.forEach((k, i) => {
    const t = Number(k.t), n = snap(t, fd);
    if (Math.abs(n - t) > 1e-6) moved++;
    const c = Object.assign({}, k, { t: n });
    const meta = { d: Math.abs(t - n), end: i === 0 || i === keys.length - 1 };
    const last = out[out.length - 1];
    if (last && Math.abs(last.k.t - n) < fd / 2) {
      if ((meta.end && !last.meta.end) || (!last.meta.end && meta.d < last.meta.d)) out[out.length - 1] = { k: c, meta };
    } else out.push({ k: c, meta });
  });
  return { keys: out.map((x) => x.k), moved, merged: keys.length - out.length };
}

/** Is every time on the grid? (tests) */
const onGrid = (t, fd) => Math.abs(t / fd - Math.round(t / fd)) < 1e-4;

module.exports = { snap, snapKeys, onGrid };
