'use strict';
/**
 * Tune After (v0.79, docs/features/TUNE_AFTER.md) — the pure maths.
 *   scale      a key snapshot stretched in time around a pivot: times land on the frame grid, influence stays,
 *              speed (units / second) divides by the factor — the curve keeps its shape, only faster or slower.
 *   place      a copied snapshot moved to a new start time and, for Position, onto the target's own position
 *              (the move is copied, not the place).
 *   tunables   the numbers of a tool worth changing after it ran.
 *   variations four takes on what just ran, from the tool's own parameters.
 * A snapshot is what the host's keys.snapshot returns and keys.rebuild writes: [{ t, v, ei, eo, it, ot, inTan, outTan }].
 */
const FG = require('../../core/framegrid');

const clone = (x) => JSON.parse(JSON.stringify(x));
const easeScaled = (list, f) => (list || []).map((e) => ({ speed: e.speed / f, influence: e.influence }));

/** → { ok, snapshot, span: [t0, t1] } or { ok: false, error }. */
function scale(snapshot, factor, pivot, fd) {
  if (!snapshot || snapshot.length < 2) return { ok: false, error: 'Two keys at least' };
  if (!(factor > 0)) return { ok: false, error: 'The factor must be above zero' };
  const out = snapshot.map((k) => {
    const n = clone(k);
    n.t = FG.snap(pivot + (k.t - pivot) * factor, fd);
    n.ei = easeScaled(k.ei, factor); n.eo = easeScaled(k.eo, factor);
    return n;
  });
  for (let i = 1; i < out.length; i++) if (out[i].t - out[i - 1].t < fd * 0.5) return { ok: false, error: 'Too short: two keys would land on the same frame' };
  return { ok: true, snapshot: out, span: [out[0].t, out[out.length - 1].t] };
}

const isVec = (v) => Array.isArray(v) && v.every((n) => typeof n === 'number');
/** A copied snapshot at `start`, optionally offset in value (Position: target − source at the first key). */
function place(snapshot, start, fd, delta) {
  if (!snapshot || !snapshot.length) return [];
  const t0 = snapshot[0].t;
  return snapshot.map((k) => {
    const n = clone(k);
    n.t = FG.snap(start + (k.t - t0), fd);
    if (delta && isVec(n.v)) n.v = n.v.map((x, i) => x + (delta[i] || 0));
    return n;
  });
}
/** Position's offset so the copied move starts where the target is. Null when the shapes differ. */
function positionDelta(sourceFirst, targetNow) {
  if (!isVec(sourceFirst) || !isVec(targetNow) || sourceFirst.length !== targetNow.length) return null;
  return targetNow.map((x, i) => x - sourceFirst[i]);
}

/** Up to three numbers of a tool that are worth a second try (never one the tile fixes). */
function tunables(tool) {
  const ps = (tool && tool.params) || {};
  return Object.keys(ps).filter((k) => (ps[k].type === 'number' || ps[k].type === 'integer') && !ps[k].tileFixed && !ps[k].hidden).slice(0, 3).map((k) => Object.assign({ key: k }, ps[k]));
}
const clampTo = (p, v) => Math.min(p.max !== undefined ? p.max : v, Math.max(p.min !== undefined ? p.min : v, v));
const OPPOSITE = { moveRL: 'moveLR', moveLR: 'moveRL', moveTB: 'moveBT', moveBT: 'moveTB', left: 'right', right: 'left', up: 'down', down: 'up' };
/** Four takes from the tool's own parameters; a take the tool has no parameter for is left out. */
function variations(tool, args) {
  const ps = (tool && tool.params) || {}, out = [];
  const has = (k) => ps[k] !== undefined;
  const opt = (k, v) => has(k) && (ps[k].options || []).some((o) => o.value === v);
  const round = (p, v) => { const st = p.step || 0.01; return clampTo(p, Number((Math.round(v / st) * st).toFixed(4))); };
  if (has('duration') && ps.duration.type === 'number') {
    const d = args.duration !== undefined ? args.duration : ps.duration.default;
    out.push({ id: 'calmer', label: 'Calmer', args: Object.assign({}, args, { duration: round(ps.duration, d * 1.5) }, opt('ease', 'gentle') ? { ease: 'gentle' } : opt('ease', 'smooth') ? { ease: 'smooth' } : {}) });
    out.push({ id: 'faster', label: 'Faster', args: Object.assign({}, args, { duration: round(ps.duration, d * 0.6) }, opt('ease', 'snappy') ? { ease: 'snappy' } : {}) });
  }
  if (has('overshoot')) {
    const p = ps.overshoot;
    const v = p.type === 'boolean' ? !args.overshoot : (args.overshoot ? 0 : round(p, p.max !== undefined ? Math.min(p.max, 12) : 12));
    out.push({ id: 'bounce', label: p.type === 'boolean' ? (v ? 'With overshoot' : 'No overshoot') : (v ? 'With overshoot' : 'No overshoot'), args: Object.assign({}, args, { overshoot: v }) });
  }
  const dirKey = ['kind', 'direction', 'from'].find((k) => has(k) && OPPOSITE[args[k] !== undefined ? args[k] : ps[k].default] && opt(k, OPPOSITE[args[k] !== undefined ? args[k] : ps[k].default]));
  if (dirKey) out.push({ id: 'other', label: 'Other side', args: Object.assign({}, args, { [dirKey]: OPPOSITE[args[dirKey] !== undefined ? args[dirKey] : ps[dirKey].default] }) });
  return out.filter((v) => JSON.stringify(v.args) !== JSON.stringify(args)).slice(0, 4);
}

module.exports = { scale, place, positionDelta, tunables, variations, OPPOSITE };
