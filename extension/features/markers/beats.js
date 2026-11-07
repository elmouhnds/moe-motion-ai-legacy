'use strict';
/**
 * Beat finder (v0.67, docs/features/SMART_LAYER.md) — pure. Input: After Effects' own Convert Audio to Keyframes
 * envelope (Both Channels, one value per frame). A beat is a local peak that rises clearly above the recent average
 * and above a floor, at least `minGap` seconds after the previous one (the stronger of two close peaks wins).
 * Deterministic: the same sound always gives the same markers.
 */

const WINDOW = 0.35; // seconds of "recent average" a beat must rise above

/** times / values: the envelope; sensitivity 0..100 (higher = more beats); minGap seconds; max = cap. */
function find(times, values, { sensitivity = 60, minGap = 0.25, max = 200 } = {}) {
  const n = Math.min(times.length, values.length);
  if (n < 3) return [];
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, values[i]);
  if (!(peak > 0)) return [];
  const s = Math.min(Math.max(sensitivity, 0), 100) / 100;
  const floor = peak * (0.45 - 0.35 * s);   // 45 % of the loudest at 0, 10 % at 100
  const rise = 1.6 - 0.5 * s;               // must be 1.6× (at 0) … 1.1× (at 100) the recent average
  const dt = (times[n - 1] - times[0]) / (n - 1) || 1 / 30;
  const w = Math.max(1, Math.round(WINDOW / dt));
  const picks = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) sum += values[i - 1];
    if (i > w) sum -= values[i - 1 - w];
    const avg = i > 0 ? sum / Math.min(i, w) : values[0];
    const v = values[i];
    const isPeak = (i === 0 || v >= values[i - 1]) && (i === n - 1 || v > values[i + 1]);
    if (!isPeak || v < floor || (i > 0 && v < avg * rise)) continue;
    const last = picks[picks.length - 1];
    if (last && times[i] - last.t < minGap) { if (v > last.v) picks[picks.length - 1] = { t: times[i], v }; continue; }
    picks.push({ t: times[i], v });
  }
  return picks.slice(0, max).map((p) => p.t);
}

module.exports = { find, WINDOW };
