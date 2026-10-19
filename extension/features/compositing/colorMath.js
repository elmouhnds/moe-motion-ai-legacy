'use strict';
/**
 * Colour math for the compositing module. Pure functions, no host access.
 *
 * Colours are [r, g, b] in 0..1 (After Effects working values as returned by
 * sampleImage). Corrections are affine maps  out = M · in + c  which compose
 * into ONE native Channel Mixer effect (M → channel weights, c → Const).
 */

const LUMA = [0.2126, 0.7152, 0.0722]; // Rec.709

const I3 = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const identity = () => ({ M: I3(), c: [0, 0, 0] });
const luma = (rgb) => LUMA[0] * rgb[0] + LUMA[1] * rgb[1] + LUMA[2] * rgb[2];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

function mulM(A, B) {
  return A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
}
function mulV(M, v) { return M.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]); }

/** Apply `first`, then `second`. */
function compose(first, second) {
  const c2 = mulV(second.M, first.c);
  return { M: mulM(second.M, first.M), c: c2.map((v, i) => v + second.c[i]) };
}
function chain(...maps) { return maps.reduce((acc, m) => compose(acc, m), identity()); }
function apply(a, rgb) { return mulV(a.M, rgb).map((v, i) => v + a.c[i]); }

/** Blend a map with identity: strength 0 = no change, 1 = full. */
function blend(a, strength) {
  const t = clamp(strength, 0, 1);
  const id = identity();
  return { M: a.M.map((row, i) => row.map((v, j) => lerp(id.M[i][j], v, t))), c: a.c.map((v) => v * t) };
}

const gain = (g) => ({ M: [[g[0], 0, 0], [0, g[1], 0], [0, 0, g[2]]], c: [0, 0, 0] });
const gainOffset = (g, o) => ({ M: gain(g).M, c: o.slice() });

/* ---------- statistics from sampled cells ---------- */

/** cells: [[r,g,b,a], …] (all times merged). Transparent cells are ignored. */
function stats(cells) {
  const px = cells.filter((c) => c[3] > 0.5);
  if (!px.length) return null;
  const n = px.length;
  const mean = [0, 1, 2].map((i) => px.reduce((s, c) => s + c[i], 0) / n);
  const std = [0, 1, 2].map((i) => Math.sqrt(px.reduce((s, c) => s + (c[i] - mean[i]) ** 2, 0) / n));
  const lum = px.map((c) => luma(c)).sort((a, b) => a - b);
  const q = (p) => lum[Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))))];
  const sat = px.reduce((s, c) => s + (Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2])), 0) / n;
  const Y = luma(mean);
  return {
    count: n,
    mean, std,
    luminance: Y,
    black: q(0.02), white: q(0.98), median: q(0.5),
    saturation: sat,
    // Cast: mean channel deviation from neutral, relative to luminance.
    cast: mean.map((m) => (Y > 1e-4 ? (m - Y) / Y : 0)),
    clippedHigh: px.filter((c) => Math.max(c[0], c[1], c[2]) >= 0.995).length / n,
    clippedLow: px.filter((c) => Math.max(c[0], c[1], c[2]) <= 0.005).length / n
  };
}

function describeCast(st) {
  const [r, g, b] = st.cast;
  const mag = Math.max(Math.abs(r), Math.abs(g), Math.abs(b));
  if (mag < 0.06) return 'neutral';
  if (r > 0.06 && b < -0.06) return 'warm';
  if (b > 0.06 && r < -0.06) return 'cool';
  if (g > 0.06) return 'green';
  if (g < -0.06) return 'magenta';
  return r > b ? 'warm' : 'cool';
}

/* ---------- corrections ---------- */

/** Grey-world white balance: scale channels so the mean becomes neutral at the same luminance. */
function whiteBalance(st) {
  const Y = st.luminance;
  return gain(st.mean.map((m) => (m > 1e-4 ? clamp(Y / m, 0.25, 4) : 1)));
}

/** Auto levels on luminance: map measured black/white points to 0.02 / 0.98. */
function autoLevels(st) {
  const range = st.white - st.black;
  if (range < 0.02) return identity();
  const k = clamp((0.98 - 0.02) / range, 0.5, 4);
  const o = 0.02 - k * st.black;
  return gainOffset([k, k, k], [o, o, o]);
}

const exposure = (stops) => gain([2 ** stops, 2 ** stops, 2 ** stops]);

/** temperature, tint: −100..100. Positive temperature = warmer, positive tint = magenta. */
function temperatureTint(temperature, tint) {
  const t = temperature / 100;
  const m = tint / 100;
  return gain([1 + 0.25 * t, 1 - 0.2 * m, 1 - 0.25 * t]);
}

/** contrast −100..100 around a pivot (default mid-grey). */
function contrast(amount, pivot = 0.5) {
  const k = 1 + (amount / 100) * 0.8;
  const o = pivot * (1 - k);
  return gainOffset([k, k, k], [o, o, o]);
}

/** saturation 0..200 (%), luminance-preserving. */
function saturation(percent) {
  const s = percent / 100;
  return { M: [0, 1, 2].map((i) => [0, 1, 2].map((j) => (1 - s) * LUMA[j] + (i === j ? s : 0))), c: [0, 0, 0] };
}

/** Per-channel mean/σ transfer (Reinhard-style, in the working RGB space). */
function transfer(src, ref) {
  const g = [0, 1, 2].map((i) => (src.std[i] > 1e-3 ? clamp(ref.std[i] / src.std[i], 0.25, 4) : 1));
  const o = [0, 1, 2].map((i) => ref.mean[i] - g[i] * src.mean[i]);
  return gainOffset(g, o);
}

/** Build the full Grade map from user settings (+ optional stats for auto parts). */
function gradeMap(args, st) {
  const parts = [];
  if (st && args.autoBalance > 0) parts.push(blend(whiteBalance(st), args.autoBalance / 100));
  if (st && args.autoLevels > 0) {
    const balanced = parts.length ? statsAfter(st, chain(...parts)) : st;
    parts.push(blend(autoLevels(balanced), args.autoLevels / 100));
  }
  parts.push(exposure(args.exposure || 0));
  parts.push(temperatureTint(args.temperature || 0, args.tint || 0));
  parts.push(contrast(args.contrast || 0));
  parts.push(saturation(args.saturation === undefined ? 100 : args.saturation));
  return chain(...parts);
}

/** Approximate stats after an affine map (exact for mean; black/white via luminance). */
function statsAfter(st, a) {
  const mean = apply(a, st.mean);
  const kY = luma([a.M[0][0], a.M[1][1], a.M[2][2]]);
  const oY = luma(a.c);
  return Object.assign({}, st, { mean, luminance: luma(mean), black: st.black * kY + oY, white: st.white * kY + oY });
}

/* ---------- Channel Mixer mapping ---------- */

const MIXER_PARAMS = [
  ['Red-Red', 0, 0], ['Red-Green', 0, 1], ['Red-Blue', 0, 2], ['Red-Const', 0, 'c'],
  ['Green-Red', 1, 0], ['Green-Green', 1, 1], ['Green-Blue', 1, 2], ['Green-Const', 1, 'c'],
  ['Blue-Red', 2, 0], ['Blue-Green', 2, 1], ['Blue-Blue', 2, 2], ['Blue-Const', 2, 'c']
];
const MIXER_LIMIT = 200;

/** Affine map → Channel Mixer parameter specs (percent), with clamping report. */
function toChannelMixer(a) {
  const clamped = [];
  const params = MIXER_PARAMS.map(([name, row, col], i) => {
    const raw = (col === 'c' ? a.c[row] : a.M[row][col]) * 100;
    const value = Math.round(clamp(raw, -MIXER_LIMIT, MIXER_LIMIT) * 100) / 100;
    if (Math.abs(raw) > MIXER_LIMIT) clamped.push(name);
    return { id: name, value, names: [name], suffix: i + 1, nth: { type: 'OneD', n: i + 1 } };
  });
  return { params, clamped };
}

/** Pick the screen colour from the border ring of a cols×rows grid. */
function screenColor(cells, cols, rows, screen = 'auto') {
  const ring = cells.filter((c, i) => {
    const x = i % cols;
    const y = Math.floor(i / cols);
    return x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
  });
  const dom = (c, kind) => (kind === 'green' ? c[1] - Math.max(c[0], c[2]) : c[2] - Math.max(c[0], c[1]));
  const pick = (kind) => {
    const hits = ring.filter((c) => dom(c, kind) > 0.08).sort((p, q) => dom(q, kind) - dom(p, kind));
    const top = hits.slice(0, Math.max(1, Math.ceil(hits.length / 2)));
    if (!hits.length) return null;
    return { kind, color: [0, 1, 2].map((i) => top.reduce((s, c) => s + c[i], 0) / top.length), coverage: hits.length / ring.length };
  };
  if (screen === 'green' || screen === 'blue') return pick(screen);
  const g = pick('green');
  const b = pick('blue');
  if (g && b) return g.coverage >= b.coverage ? g : b;
  return g || b;
}

module.exports = {
  LUMA, identity, compose, chain, apply, blend, gain, stats, describeCast, luma,
  whiteBalance, autoLevels, exposure, temperatureTint, contrast, saturation, transfer,
  gradeMap, statsAfter, toChannelMixer, screenColor, MIXER_PARAMS
};
