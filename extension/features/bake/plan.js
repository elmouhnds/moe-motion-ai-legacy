'use strict';
/**
 * Bake (v0.42, docs/features/BAKE.md) — the pure maths: which frames to sample, and which of those samples
 * must become keyframes. Keys are LINEAR (HOLD for checkboxes / menus), so between two kept keys After Effects
 * draws a straight line; "smart" keeps a sample only when that line would miss a sample in between by more
 * than the tolerance. Every sampled frame is then within the tolerance of the live expression — tests and the
 * tool's read-back check exactly that.
 */

/** Read and write limits: one bake never asks After Effects for more than this. */
const LIMITS = { samples: 120000, keys: 40000, perCall: 15000, writePerCall: 4000 };
const TOL = { COLOR: 0.0005, base: 0.005 };

const tolFor = (valueType) => (valueType === 'COLOR' ? TOL.COLOR : TOL.base);

/** Frame-aligned times from start (inclusive) over duration, one every `every` frames; the last frame is always in. */
function timesFor({ start, duration, fd, every = 1 }) {
  const f0 = Math.round(start / fd), n = Math.max(1, Math.round(duration / fd)), step = Math.max(1, Math.round(every));
  const frames = [];
  for (let f = 0; f < n; f += step) frames.push(f);
  if (frames[frames.length - 1] !== n - 1) frames.push(n - 1);
  return frames.map((f) => (f0 + f) * fd);
}

/** The smallest "every" that keeps props × samples under the read limit. */
function everyFor(nProps, frames, cap = LIMITS.samples) {
  for (let e = 1; e <= 60; e++) if (nProps * Math.ceil(frames / e) <= cap) return e;
  return null;
}

const dims = (v) => (Array.isArray(v) ? v : [v]);
/** Largest per-component difference. */
function diff(a, b) {
  const A = dims(a), B = dims(b);
  let m = 0;
  for (let i = 0; i < Math.max(A.length, B.length); i++) m = Math.max(m, Math.abs((A[i] || 0) - (B[i] || 0)));
  return m;
}
function lerp(a, b, u) {
  if (!Array.isArray(a)) return a + (b - a) * u;
  return a.map((v, i) => v + (b[i] - v) * u);
}

/** Value of linear keys at time t (what After Effects draws between LINEAR keys); hold = step. */
function keyedAt(keyTimes, keyValues, t, hold) {
  const n = keyTimes.length;
  if (t <= keyTimes[0]) return keyValues[0];
  if (t >= keyTimes[n - 1]) return keyValues[n - 1];
  let i = 0;
  while (i < n - 1 && keyTimes[i + 1] <= t + 1e-9) i++;
  if (Math.abs(keyTimes[i] - t) < 1e-9 || hold) return keyValues[i];
  const u = (t - keyTimes[i]) / (keyTimes[i + 1] - keyTimes[i]);
  return lerp(keyValues[i], keyValues[i + 1], u);
}

/**
 * Which samples become keys. mode 'smart' (only the keys needed) or 'every' (one per sample).
 * → { constant: true, value } when nothing changes (smart only), else { times, values }.
 */
function thin(times, values, { tol = TOL.base, hold = false, mode = 'smart' } = {}) {
  if (mode === 'every') return { constant: false, times: times.slice(), values: values.slice() };
  if (values.every((v) => diff(v, values[0]) <= tol)) return { constant: true, value: values[0] };
  const keep = [0];
  if (hold) {
    for (let i = 1; i < values.length; i++) if (diff(values[i], values[keep[keep.length - 1]]) > 0) keep.push(i);
  } else {
    let a = 0;
    for (let j = 2; j < values.length; j++) {
      // can a straight line a → j carry every sample between them?
      let fits = true;
      for (let m = a + 1; m < j && fits; m++) {
        const u = (times[m] - times[a]) / (times[j] - times[a]);
        if (diff(lerp(values[a], values[j], u), values[m]) > tol) fits = false;
      }
      if (!fits) { a = j - 1; keep.push(a); }
    }
    if (keep[keep.length - 1] !== values.length - 1) keep.push(values.length - 1);
  }
  return { constant: false, times: keep.map((i) => times[i]), values: keep.map((i) => values[i]) };
}

/** Worst difference between the samples and what the planned keys give at the same times. */
function planError(times, values, plan, hold) {
  if (plan.constant) return Math.max(...values.map((v) => diff(v, plan.value)));
  return Math.max(...times.map((t, i) => diff(keyedAt(plan.times, plan.values, t, hold), values[i])));
}

/** Split a list into pieces of at most `size` (by a weight per item). */
function chunks(list, size, weight = () => 1) {
  const out = [];
  let cur = [], w = 0;
  for (const it of list) {
    const iw = weight(it);
    if (cur.length && w + iw > size) { out.push(cur); cur = []; w = 0; }
    cur.push(it); w += iw;
  }
  if (cur.length) out.push(cur);
  return out;
}

module.exports = { LIMITS, TOL, tolFor, timesFor, everyFor, diff, keyedAt, thin, planError, chunks };
