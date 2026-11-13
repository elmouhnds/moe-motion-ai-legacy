'use strict';
/**
 * MOE Effectors (v0.33, docs/features/CLONER_EFFECTORS.md) — the MoGraph idea (Cinema 4D, mCloner, Cloners +
 * Effectors) on top of MOE Grid: an effector is its own null ("MOE Effector N") with its own controls; a grid
 * links up to three of them (layer controls "Effector", "Effector 2", "Effector 3" on the grid null) and every
 * item's expression adds what each effector does to it.
 *
 *   weight   where the item is relative to the effector — Falloff: Sphere · Linear (a sweeping edge) · Box ·
 *            Everywhere; Size, Softness, Invert, Strength. The effector's own position / rotation / scale count
 *            (the item is read in the effector's space), so moving / rotating / scaling the null is the animation.
 *   amount   how much of the move each item gets — Type: Plain (all the same) · Random (seeded, per item and
 *            per channel) · Step (0 → 1 along the order) · Noise (smooth value noise over space and time) ·
 *            Delay (the effector's own keyframed moves, played later item by item).
 *   moves    Move X / Move Y (px), Scale (%), Rotate (°), Fade (%).
 *
 * This file is the reference: `code()` writes the same maths as an AE expression (plain ES3-style JS, vector
 * maths with add / sub / length so it also runs on the Legacy ExtendScript engine), and tests compare the
 * mock-evaluated expressions with `apply()`.
 */

const TYPES = [
  { id: 'plain', menu: 'Plain', label: 'Plain', hint: 'Every item in reach gets the same move' },
  { id: 'random', menu: 'Random', label: 'Random', hint: 'Each item gets its own random share (seeded)' },
  { id: 'step', menu: 'Step', label: 'Step', hint: 'Grows from the first item to the last' },
  { id: 'noise', menu: 'Noise', label: 'Noise', hint: 'Smooth organic waves over space and time' },
  { id: 'delay', menu: 'Delay', label: 'Delay', hint: 'Keyframe the effector — each item plays it a little later' },
  // v0.36
  { id: 'target', menu: 'Target', label: 'Target', hint: 'The items turn to face the effector null (Rotate = aim offset)' },
  { id: 'audio', menu: 'Audio', label: 'Audio', hint: 'The moves follow a soundtrack’s loudness — each item a little later (Delay)' },
  // v0.88 (React 3 study): a wave that runs through the items in their order
  { id: 'wave', menu: 'Wave', label: 'Wave', hint: 'A wave runs through the items in order — sine, triangle, ramp or square; it travels with Wave Speed' }
];
/** v0.89 How the falloff's soft edge runs from 0 to 1 (menu index stored in AE — append only). Smooth is the curve every effector had. */
const CURVES = [
  { id: 'smooth', menu: 'Smooth', label: 'Smooth' },
  { id: 'linear', menu: 'Linear', label: 'Linear' },
  { id: 'easeIn', menu: 'Ease In', label: 'Ease in' },
  { id: 'easeOut', menu: 'Ease Out', label: 'Ease out' }
];
/** v0.89 What Move X / Move Y mean (append only). */
const MOVE_MODES = [
  { id: 'relative', menu: 'Relative', label: 'Relative', hint: 'Move X / Y px from where the item is' },
  { id: 'attract', menu: 'Attract / Repel', label: 'Attract / Repel', hint: 'Move X px toward the effector null (never past it) — negative pushes away' },
  { id: 'absolute', menu: 'Absolute', label: 'Absolute', hint: 'The items go to the effector null (+ Move X / Y) — fully where the weight is 1' }
];
/** v0.88 Wave shapes (menu index stored in AE — append only). */
const WAVES = [
  { id: 'sine', menu: 'Sine', label: 'Sine' },
  { id: 'triangle', menu: 'Triangle', label: 'Triangle' },
  { id: 'rampUp', menu: 'Ramp Up', label: 'Ramp up' },
  { id: 'rampDown', menu: 'Ramp Down', label: 'Ramp down' },
  { id: 'square', menu: 'Square', label: 'Square' }
];
const FALLOFFS = [
  { id: 'sphere', menu: 'Sphere', label: 'Sphere' },
  { id: 'linear', menu: 'Linear', label: 'Linear' },
  { id: 'box', menu: 'Box', label: 'Box' },
  { id: 'all', menu: 'Everywhere', label: 'Everywhere' },
  // v0.38 Field falloffs: a moving noise field (in the effector's space) and a layer's brightness (Image)
  { id: 'noise', menu: 'Noise Field', label: 'Noise' },
  { id: 'image', menu: 'Image', label: 'Image' }
];
const SLOTS = ['Effector', 'Effector 2', 'Effector 3'];
const NAME = /^MOE Effector \d+$/;

/* [name, kind, default, menu items] — the effector null's controls, in Effect Controls order */
const CONTROLS = [
  ['Effector Type', 'menu', 1, TYPES.map((t) => t.menu)],
  ['Falloff', 'menu', 1, FALLOFFS.map((f) => f.menu)],
  ['Size', 'slider', 300],
  ['Softness', 'slider', 50],
  ['Strength', 'slider', 100],
  ['Invert', 'checkbox', 0],
  ['Move X', 'slider', 0],
  ['Move Y', 'slider', 0],
  ['Scale', 'slider', 0],
  ['Rotate', 'angle', 0],
  ['Fade', 'slider', 0],
  ['Seed', 'slider', 1],
  ['Delay', 'slider', 3],
  ['Noise Scale', 'slider', 100],
  ['Noise Speed', 'slider', 50],
  // v0.34: the items in reach blend toward this colour (needs Clone Colours on the grid)
  ['Colour', 'color', [1, 1, 1, 1]],
  ['Colour Mix', 'slider', 0],
  // v0.35: Spring / Inertia — the items follow what the effector does through a damped spring (0 = off)
  ['Spring', 'slider', 0],
  ['Frequency', 'slider', 2.5],
  ['Decay', 'slider', 5],
  // v0.36 Audio: the "MOE Audio · <layer>" amplitude layer (Convert Audio to Keyframes) and its loudest value
  ['Audio Layer', 'layer', 0],
  ['Audio Max', 'slider', 1],
  // v0.38 Field falloffs: the layer whose brightness is the weight (Image) and how fast the noise field evolves
  ['Field Layer', 'layer', 0],
  ['Field Speed', 'slider', 50],
  // v0.88 Wave: its shape, how many items one wave spans, how many waves pass per second, a phase offset (% of a wave)
  ['Wave Shape', 'menu', 1, WAVES.map((w) => w.menu)],
  ['Wave Length', 'slider', 6],
  ['Wave Speed', 'slider', 0.5],
  ['Wave Offset', 'slider', 0],
  // v0.88 Snap To: round what the effector gives each item to the nearest step (0 = off) — px, degrees, % of scale
  ['Snap Move', 'slider', 0],
  ['Snap Rotate', 'slider', 0],
  ['Snap Scale', 'slider', 0],
  // v0.88 Clamp: never more than this, whatever the other settings (and the spring) do (0 = off)
  ['Max Move', 'slider', 0],
  ['Max Rotate', 'slider', 0],
  ['Max Scale', 'slider', 0],
  // v0.89: the shape of the falloff's soft edge, and what Move X / Y mean
  ['Falloff Curve', 'menu', 1, CURVES.map((c) => c.menu)],
  ['Move Mode', 'menu', 1, MOVE_MODES.map((m) => m.menu)]
];
const KEY = { 'Effector Type': 'type', Falloff: 'falloff', Size: 'size', Softness: 'softness', Strength: 'strength', Invert: 'invert', 'Move X': 'moveX', 'Move Y': 'moveY', Scale: 'scale', Rotate: 'rotate', Fade: 'fade', Seed: 'seed', Delay: 'delay', 'Noise Scale': 'noiseScale', 'Noise Speed': 'noiseSpeed', Colour: 'colour', 'Colour Mix': 'colourMix', Spring: 'spring', Frequency: 'frequency', Decay: 'decay', 'Audio Layer': 'audioLayer', 'Audio Max': 'audioMax', 'Field Layer': 'fieldLayer', 'Field Speed': 'fieldSpeed', 'Wave Shape': 'waveShape', 'Wave Length': 'waveLength', 'Wave Speed': 'waveSpeed', 'Wave Offset': 'waveOffset', 'Snap Move': 'snapMove', 'Snap Rotate': 'snapRotate', 'Snap Scale': 'snapScale', 'Max Move': 'maxMove', 'Max Rotate': 'maxRotate', 'Max Scale': 'maxScale', 'Falloff Curve': 'falloffCurve', 'Move Mode': 'moveMode' };

/**
 * v0.87 Controls on demand (docs/features/CONTROLS_ON_DEMAND.md — owner: "only the sliders that matter for the
 * move, not every variable"). A new effector null gets only the controls its own settings use; a control that is
 * not there reads as its default in the item expression (`ev(name, t, default)`), so nothing changes in the result.
 *   core    always: Effector Type, Falloff, Size, Softness, Strength, Invert (Clone Colour expressions read them)
 *   moves   Move X / Move Y / Scale / Rotate / Fade — the ones this effector moves (Target always has Rotate)
 *   random  Seed (Random, Noise, Noise Field) · Noise Scale, Noise Speed (Noise) · Delay (Delay, Audio)
 *   colour  Colour, Colour Mix   spring  Spring, Frequency, Decay   audio  Audio Layer, Audio Max
 *   field   Field Layer (Image) · Field Speed (Noise Field)
 *   wave    Wave Shape, Length, Speed, Offset (Wave)   snap / clamp  each one that is not 0
 * GROUPS is also the list the Effector Controls tool offers to add later.
 */
const GROUPS = {
  core: ['Effector Type', 'Falloff', 'Size', 'Softness', 'Strength', 'Invert'],
  moves: ['Move Mode', 'Move X', 'Move Y', 'Scale', 'Rotate', 'Fade'],
  random: ['Seed', 'Delay', 'Noise Scale', 'Noise Speed'],
  colour: ['Colour', 'Colour Mix'],
  spring: ['Spring', 'Frequency', 'Decay'],
  audio: ['Audio Layer', 'Audio Max'],
  field: ['Field Layer', 'Field Speed'],
  wave: ['Wave Shape', 'Wave Length', 'Wave Speed', 'Wave Offset'],
  snap: ['Snap Move', 'Snap Rotate', 'Snap Scale'],
  clamp: ['Max Move', 'Max Rotate', 'Max Scale'],
  ease: ['Falloff Curve']
};
const GROUP_LABEL = { moves: 'Moves', random: 'Random · Noise · Delay', colour: 'Colour', spring: 'Spring', audio: 'Audio', field: 'Field', wave: 'Wave', snap: 'Snap To', clamp: 'Clamp', ease: 'Falloff curve' };
/** The control names (in Effect Controls order) an effector with these values uses. `v` = valuesOf(args). */
function needed(v) {
  const tp = Math.round(v.type), fo = Math.round(v.falloff), on = new Set(GROUPS.core);
  if (v.moveX) on.add('Move X'); if (v.moveY) on.add('Move Y'); if (v.scale) on.add('Scale'); if (v.rotate || tp === 6) on.add('Rotate'); if (v.fade) on.add('Fade');
  if (tp === 2 || tp === 4 || fo === 5) on.add('Seed');
  if (tp === 4) { on.add('Noise Scale'); on.add('Noise Speed'); }
  if (tp === 5 || tp === 7) on.add('Delay');
  if (v.colourMix > 0) GROUPS.colour.forEach((n) => on.add(n));
  if (v.spring > 0) GROUPS.spring.forEach((n) => on.add(n));
  if (tp === 7) GROUPS.audio.forEach((n) => on.add(n));
  if (fo === 6) on.add('Field Layer');
  if (fo === 5) on.add('Field Speed');
  if (tp === 8) GROUPS.wave.forEach((n) => on.add(n));
  if (Math.round(v.falloffCurve || 1) !== 1) on.add('Falloff Curve');
  if (Math.round(v.moveMode || 1) !== 1) { on.add('Move Mode'); if (Math.round(v.moveMode) === 2) on.add('Move X'); }
  if (v.snapMove > 0) on.add('Snap Move'); if (v.snapRotate > 0) on.add('Snap Rotate'); if (v.snapScale > 0) on.add('Snap Scale');
  if (v.maxMove > 0) on.add('Max Move'); if (v.maxRotate > 0) on.add('Max Rotate'); if (v.maxScale > 0) on.add('Max Scale');
  return CONTROLS.map((c) => c[0]).filter((n) => on.has(n));
}
/** The names of one group, or of every control ('all'). */
function groupNames(group) { return group === 'all' ? CONTROLS.map((c) => c[0]) : (GROUPS[group] || []).slice(); }

/** Default effector values (type / falloff as menu indices 1-based). */
function defaults() {
  const p = {};
  for (const [name, kind, def] of CONTROLS) p[KEY[name]] = kind === 'checkbox' ? !!def : def;
  return p;
}
/** '#RRGGBB' → [r, g, b, 1] (0–1); an array passes through. */
function rgba(c) {
  if (Array.isArray(c)) return c.length === 4 ? c : c.concat([1]);
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c || ''));
  if (!m) return [1, 1, 1, 1];
  const v = parseInt(m[1], 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255, 1];
}
/** Tool args → control values. */
function valuesOf(args) {
  const p = Object.assign(defaults(), args || {});
  if (typeof p.type === 'string') p.type = Math.max(1, TYPES.findIndex((t) => t.id === p.type) + 1);
  if (typeof p.falloff === 'string') p.falloff = Math.max(1, FALLOFFS.findIndex((f) => f.id === p.falloff) + 1);
  if (typeof p.falloffCurve === 'string') p.falloffCurve = Math.max(1, CURVES.findIndex((c) => c.id === p.falloffCurve) + 1);
  if (typeof p.moveMode === 'string') p.moveMode = Math.max(1, MOVE_MODES.findIndex((m) => m.id === p.moveMode) + 1);
  if (typeof p.waveShape === 'string') p.waveShape = Math.max(1, WAVES.findIndex((w) => w.id === p.waveShape) + 1);
  p.colour = rgba(p.colour);
  return p;
}

/* ---------- pure maths (the reference) ---------- */
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const smooth = (u) => u * u * (3 - 2 * u);
/** Park–Miller, same as the grid's PR(). */
function PR(sd) { let s = Math.abs(Math.round(sd)) % 2147483646 + 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
/** Hash in −1..1 (fract of a big sine — identical in JS and AE's engines). */
function hs(a, b) { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; }
/** Smooth value noise in about −1..1. */
function vnoise(x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, ux = smooth(fx), uy = smooth(fy);
  const a = hs(x0, y0), b = hs(x0 + 1, y0), c = hs(x0, y0 + 1), d = hs(x0 + 1, y0 + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** v0.88 One wave, −1..1, at phase ph (1 = one whole wave). shape: 1 sine · 2 triangle · 3 ramp up · 4 ramp down · 5 square. */
function waveAt(shape, ph) {
  const sh = Math.round(shape), f = ph - Math.floor(ph);
  if (sh === 2) return 1 - 4 * Math.abs(f - 0.5);
  if (sh === 3) return 2 * f - 1;
  if (sh === 4) return 1 - 2 * f;
  if (sh === 5) return f < 0.5 ? 1 : -1;
  return Math.sin(2 * Math.PI * ph);
}
/**
 * v0.88 Snap To, then Clamp, on one effector's terms [dx, dy, scale (×1), rotate °, fade] — after the spring, so the
 * limits hold whatever the other settings do. Snap rounds to the nearest step; Max Move limits the distance (the
 * direction is kept), Max Rotate / Max Scale limit each way. 0 = off. Fade is left alone.
 */
function modify(V, R) {
  const sM = V.snapMove || 0, sR = V.snapRotate || 0, sS = (V.snapScale || 0) / 100, mM = V.maxMove || 0, mR = V.maxRotate || 0, mS = (V.maxScale || 0) / 100;
  if (!(sM > 0 || sR > 0 || sS > 0 || mM > 0 || mR > 0 || mS > 0)) return R;
  let f0 = sM > 0 ? Math.round(R[0] / sM) * sM : R[0], f1 = sM > 0 ? Math.round(R[1] / sM) * sM : R[1], f2 = sS > 0 ? Math.round(R[2] / sS) * sS : R[2], f3 = sR > 0 ? Math.round(R[3] / sR) * sR : R[3];
  if (mM > 0) { const d = Math.sqrt(f0 * f0 + f1 * f1); if (d > mM) { f0 = f0 * mM / d; f1 = f1 * mM / d; } }
  if (mS > 0) f2 = clamp(f2, -mS, mS);
  if (mR > 0) f3 = clamp(f3, -mR, mR);
  return [f0, f1, f2, f3, R[4]];
}

/** Rec. 709 luma of an [r, g, b, a] sample, times its alpha (Image field). */
const luma = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) * (c[3] === undefined ? 1 : c[3]);
/**
 * Weight 0..1 of a point given in the effector's own space (px).
 * f (v0.38 fields): { t: time (Noise Field evolves), luma: the Field Layer's brightness under the item (Image) }.
 *   Noise Field: n = value noise at (lx / Size + Seed × 13.7, ly / Size + Field Speed / 100 × t), 0..1; Softness
 *   is the width of the edge around 0.5 (0 = hard cells). Image: the brightness (0..1). Both then Invert / Strength.
 */
/** v0.89 The falloff's edge, u 0..1 → 0..1: 1 smooth (smoothstep) · 2 linear · 3 ease in (stays low, then rises) · 4 ease out. */
function edge(curve, u) { const cv = Math.round(curve || 1); return cv === 2 ? u : cv === 3 ? u * u : cv === 4 ? 1 - (1 - u) * (1 - u) : smooth(u); }
function weight(e, lx, ly, f) {
  const fo = Math.round(e.falloff), sz = Math.max(e.size, 0.001), sf = clamp(e.softness / 100, 0, 1), cv = e.falloffCurve;
  let w;
  if (fo === 4) w = 1;
  else if (fo === 5) {
    const t = f && f.t !== undefined ? f.t : 0, nu = (vnoise(lx / sz + (e.seed || 0) * 13.7, ly / sz + (e.fieldSpeed || 0) / 100 * t) + 1) / 2, hf = Math.max(sf, 0.001) / 2;
    w = smooth(clamp((nu - 0.5 + hf) / (2 * hf), 0, 1));
  } else if (fo === 6) w = clamp(f && f.luma !== undefined ? f.luma : 0, 0, 1);
  else if (fo === 2) w = edge(cv, clamp(0.5 - lx / sz, 0, 1)); // a soft edge Size px wide: full to the left, none to the right
  else {
    const d = fo === 3 ? Math.max(Math.abs(lx), Math.abs(ly)) : Math.sqrt(lx * lx + ly * ly);
    const inner = sz * (1 - sf);
    w = d <= inner ? 1 : d >= sz ? 0 : edge(cv, (sz - d) / Math.max(sz - inner, 0.001));
  }
  if (e.invert) w = 1 - w;
  return w * e.strength / 100;
}

/**
 * Amount per channel for item i (k = place in the order, n items) — [x, y, scale, rotate, fade].
 * at: (t) => effector values at time t (for Delay); fps for the frame length.
 */
function amounts(e, { i, k, n, x, y, time }) {
  const tp = Math.round(e.type);
  // Random: a well-mixed hash per item and channel (a seeded LCG gives near-equal first values for nearby items)
  if (tp === 2) { const sd = e.seed * 3.117 + 1.1; return [0, 1, 2, 3, 4].map((c) => hs(i * 1.731 + c * 17.13 + 0.5, sd)); }
  if (tp === 3) { const s = n > 1 ? k / (n - 1) : 0; return [s, s, s, s, s]; }
  if (tp === 4) {
    const f = e.noiseScale / 1000, sp = e.noiseSpeed / 100 * time;
    const v = vnoise(x * f + sp, y * f + e.seed * 17.3);
    return [v, vnoise(x * f + 31.7 + sp, y * f + e.seed * 17.3), v, v, v];
  }
  // v0.88 Wave: the phase runs along the order (k) and back in time, so the wave travels toward higher items
  if (tp === 8) { const wv = waveAt(e.waveShape || 1, k / Math.max(e.waveLength || 6, 0.001) - (e.waveSpeed === undefined ? 0.5 : e.waveSpeed) * (time || 0) + (e.waveOffset || 0) / 100); return [wv, wv, wv, wv, wv]; }
  return [1, 1, 1, 1, 1];
}

/**
 * What every effector does to one item. eff: [{ values (at the item's time), toLocal(cx, cy) → [lx, ly] }].
 * item: { i, k, n, x, y (grid space), cx, cy (comp), time }. Returns { dx, dy, scaleMul, rot, opMul }.
 * For Delay the caller passes the effector's values read at time − k × Delay frames.
 */
function apply(effs, item) {
  let dx = 0, dy = 0, scaleMul = 1, rot = 0, opMul = 1;
  for (const e of effs) {
    const [lx, ly] = e.toLocal(item.cx, item.cy);
    const w = weight(e.values, lx, ly);
    if (w <= 0) continue;
    const v = e.values, m = amounts(v, item);
    const R = modify(v, [v.moveX * m[0] * w, v.moveY * m[1] * w, v.scale / 100 * m[2] * w, v.rotate * m[3] * w, v.fade / 100 * m[4] * w]);
    dx += R[0]; dy += R[1];
    scaleMul *= Math.max(0, 1 + R[2]);
    rot += R[3];
    opMul *= clamp(1 - R[4], 0, 1);
  }
  return { dx, dy, scaleMul, rot, opMul };
}

/** A 2D effector's space: position, anchor, rotation (°), scale (%). */
/** A 2D effector's space (relative to its anchor): comp = position + R(rotation)·S(scale)·local. */
function localFn({ position, rotation = 0, scale = [100, 100] }) {
  const a = rotation * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return (px, py) => { const x = px - position[0], y = py - position[1]; return [(x * c + y * s) / (scale[0] / 100), (-x * s + y * c) / (scale[1] / 100)]; };
}

/* ---------- v0.35 Spring / Inertia: the items follow the effector through a damped spring ---------- */
/**
 * The result of one effector on one item is a signal over time (its falloff weight × the moves). With Spring on,
 * the item does not take that signal at once: every change of it rings through a damped spring — the item's
 * response to a change made τ seconds ago is the spring's step response S(τ):
 *   Frequency > 0  (Spring)   S = 1 − e^(−Decay·τ) · (cos ωτ + Decay / ω · sin ωτ),  ω = 2π · Frequency  → overshoot, settle
 *   Frequency = 0  (Inertia)  S = 1 − e^(−Decay·τ) · (1 + Decay·τ)                                      → smooth lag, no overshoot
 * The expression samples the signal back in time over a bounded window (≤ 3 s, ≤ 60 samples, CLAUDE.md: bounded
 * simulations) and sums the changes × S. Spring % blends between the direct result (0) and the spring (100).
 */
const SPRING = { maxSamples: 60, maxWindow: 3, minDecay: 2, settle: 9.2 };
function stepResponse(tau, freq, decay) {
  if (tau <= 0) return 0;
  const s = Math.max(decay, SPRING.minDecay), ek = Math.exp(-s * tau);
  if (freq <= 0.01) return 1 - ek * (1 + s * tau);
  const w = 2 * Math.PI * freq;
  return 1 - ek * (Math.cos(w * tau) + s / w * Math.sin(w * tau));
}
/** How far back the expression looks: N samples D seconds apart (N ≤ 60, N·D ≤ 3 s). */
function springWindow(decay, fd) {
  const s = Math.max(decay, SPRING.minDecay), W = Math.min(SPRING.maxWindow, SPRING.settle / s);
  const N = Math.max(1, Math.min(SPRING.maxSamples, Math.ceil(W / fd - 1e-9)));
  return { N, D: W / N };
}
/** An angle in −180..180 (the short way round). */
const wrap180 = (a) => a - 360 * Math.floor((a + 180) / 360);
/**
 * One effector's raw terms on one item at time tq: [dx px, dy px, scale (×1, added to 1), rotate °, fade (×1)].
 * src: { at(t) → control values at t, toLocal(t) → (cx, cy) → [lx, ly], originAt(t) → the effector's comp point
 * (Target), audioAt(t) → Both Channels amplitude (Audio), lumaAt(cx, cy, t) → the Field Layer's brightness there (Image) }  — menus, Invert, Seed, Delay, Audio Max and the
 * noise settings are read at `now`; Size, Softness, Strength and the effector's transform at tq; the moves at tq
 * (Delay: tq − k × Delay frames). item: { i, k, n, x, y (grid space), compAt(t) → [cx, cy], fd (frame duration),
 * baseRotAt(t) → the item's rotation before effectors + the grid null's rotation (Target) }.
 * v0.36 Target: rotate = w × (the short turn from the item's rotation to the angle toward the effector + Rotate);
 * 0° = the item's +X axis points at it. Audio: every move × (Both Channels at tq − k × Delay frames) / Audio Max.
 */
function termsAt(src, item, tq, now) {
  const V = src.at(now), Q = tq === now ? V : src.at(tq);
  const c = item.compAt(tq), l = src.toLocal(tq)(c[0], c[1]);
  const w = weight(Object.assign({}, V, { size: Q.size, softness: Q.softness, strength: Q.strength }), l[0], l[1], { t: tq, luma: src.lumaAt ? src.lumaAt(c[0], c[1], tq) : 0 });
  if (w <= 0) return [0, 0, 0, 0, 0];
  const tp = Math.round(V.type);
  const M = tp === 5 ? src.at(tq - item.k * V.delay * item.fd) : Q;
  if (tp === 6) {
    const o = src.originAt(tq), aim = wrap180(Math.atan2(o[1] - c[1], o[0] - c[0]) * 180 / Math.PI + M.rotate - item.baseRotAt(tq));
    return [M.moveX * w, M.moveY * w, M.scale / 100 * w, aim * w, M.fade / 100 * w];
  }
  let m = amounts(V, { i: item.i, k: item.k, n: item.n, x: item.x, y: item.y, time: tq });
  // (the move modes below use the amounts m, so they follow Random / Step / Noise / Wave / Audio too)
  if (tp === 7) { const a = clamp((src.audioAt ? src.audioAt(tq - item.k * V.delay * item.fd) : 0) / Math.max(V.audioMax, 0.001), 0, 1); m = [a, a, a, a, a]; }
  // v0.89 Move Mode: 2 Attract / Repel (Move X px toward the effector, never past it) · 3 Absolute (go to the effector + Move X / Y).
  // The reference measures in comp space; the expression measures in the grid null's own space (G.fromComp) — the same
  // for a null that is not rotated or scaled, which is what the tests build.
  const mm = Math.round(V.moveMode || 1);
  if (mm === 2 || mm === 3) {
    const o = src.originAt(tq), gx = o[0] - c[0], gy = o[1] - c[1], sc = M.scale / 100 * m[2] * w, ro = M.rotate * m[3] * w, fa = M.fade / 100 * m[4] * w;
    if (mm === 2) { const ds = Math.sqrt(gx * gx + gy * gy); let pl = M.moveX * m[0] * w; if (pl > ds) pl = ds; return [ds > 0.001 ? gx / ds * pl : 0, ds > 0.001 ? gy / ds * pl : 0, sc, ro, fa]; }
    const ab = m[0] * w;
    return [(gx + M.moveX) * ab, (gy + M.moveY) * ab, sc, ro, fa];
  }
  return [M.moveX * m[0] * w, M.moveY * m[1] * w, M.scale / 100 * m[2] * w, M.rotate * m[3] * w, M.fade / 100 * m[4] * w];
}
/** termsAt with the spring (when the effector has Spring > 0). */
function springTerms(src, item, now) {
  const V = src.at(now), e0 = termsAt(src, item, now, now), sp = Math.max(0, (V.spring || 0) / 100);
  if (!(sp > 0)) return e0;
  const { N, D } = springWindow(V.decay, item.fd), acc = [0, 0, 0, 0, 0];
  let prev = e0;
  for (let j = 0; j < N; j++) {
    const nx = termsAt(src, item, now - (j + 1) * D, now), S = stepResponse((j + 0.5) * D, V.frequency, V.decay);
    for (let c = 0; c < 5; c++) acc[c] += (prev[c] - nx[c]) * S;
    prev = nx;
  }
  return e0.map((v, c) => v + sp * (prev[c] + acc[c] - v));
}
/** Every effector (in slot order) on one item at time now → { dx, dy, scaleMul, rot, opMul } (spring included). */
function applyAt(srcs, item, now) {
  let dx = 0, dy = 0, scaleMul = 1, rot = 0, opMul = 1;
  for (const src of srcs) {
    const R = modify(src.at(now), springTerms(src, item, now));
    dx += R[0]; dy += R[1]; scaleMul *= Math.max(0, 1 + R[2]); rot += R[3]; opMul *= clamp(1 - R[4], 0, 1);
  }
  return { dx, dy, scaleMul, rot, opMul };
}

/* ---------- the expression (mirrors the maths above) ---------- */
/**
 * Code inserted in a grid item's expression after the grid's own position (x + jx, y + jy + dy) is known.
 * Uses G (grid null), i, k, n, PR(), WP-free maths: it computes the item's comp point itself.
 * Leaves ex, ey (px), es (scale multiplier), er (deg), eop (opacity multiplier).
 */
function code() {
  return [
    'var ex = 0, ey = 0, es = 1, er = 0, eop = 1;',
    'function sm(u) { return u * u * (3 - 2 * u); }',
    'function hs(a, b) { var s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; }',
    'function vn(px, py) { var x0 = Math.floor(px), y0 = Math.floor(py), ux = sm(px - x0), uy = sm(py - y0), a = hs(x0, y0), b = hs(x0 + 1, y0), c2 = hs(x0, y0 + 1), d = hs(x0 + 1, y0 + 1); return a + (b - a) * ux + (c2 - a) * uy + (a - b - c2 + d) * ux * uy; }',
    'function EFX(EL) {',
    '  var tp = 0; try { tp = Math.round(EL.effect("Effector Type")(1).value); } catch (eT) { return; }',
    // v0.87: a control that is not on the null reads as its default (looked up once per effector, not per sample)
    '  var H = {};',
    '  function ev(nm, tt, df) { if (H[nm] === undefined) { try { EL.effect(nm)(1); H[nm] = 1; } catch (eH) { H[nm] = 0; } } return H[nm] == 1 ? EL.effect(nm)(1).valueAtTime(tt) : df; }',
    '  var fo = Math.round(ev("Falloff", time, 1)), inv = ev("Invert", time, 0) == 1, dl = ev("Delay", time, 3), sd0 = ev("Seed", time, 1), nf = ev("Noise Scale", time, 100) / 1000, nsp = ev("Noise Speed", time, 50) / 100, m0 = [1, 1, 1, 1, 1];',
    '  if (tp == 2) { var s2 = sd0 * 3.117 + 1.1, ia = i * 1.731; m0 = [hs(ia + 0.5, s2), hs(ia + 17.63, s2), hs(ia + 34.76, s2), hs(ia + 51.89, s2), hs(ia + 69.02, s2)]; }',
    '  else if (tp == 3) { var sv = n > 1 ? k / (n - 1) : 0; m0 = [sv, sv, sv, sv, sv]; }',
    // v0.36 Audio: the amplitude layer linked on the effector (made by Convert Audio to Keyframes)
    // v0.38 fields: the noise field's speed, the Image field's layer
    '  var fsp = 0, FL = null; if (fo == 5) { fsp = ev("Field Speed", time, 50) / 100; } if (fo == 6) { try { FL = EL.effect("Field Layer")(1); } catch (eFl) { FL = null; } }',
    // v0.88 Wave (read now, like the other type settings)
    // v0.89: the falloff's edge curve and the move mode (read now)
    '  var fcv = Math.round(ev("Falloff Curve", time, 1)), mvm = Math.round(ev("Move Mode", time, 1));',
    '  function fe(u) { return fcv == 2 ? u : (fcv == 3 ? u * u : (fcv == 4 ? 1 - (1 - u) * (1 - u) : sm(u))); }',
    '  var wsh = 1, wln = 6, wsp = 0.5, wof = 0; if (tp == 8) { wsh = Math.round(ev("Wave Shape", time, 1)); wln = Math.max(ev("Wave Length", time, 6), 0.001); wsp = ev("Wave Speed", time, 0.5); wof = ev("Wave Offset", time, 0) / 100; }',
    '  var AU = null, amx = 1; if (tp == 7) { try { AU = EL.effect("Audio Layer")(1); } catch (eAu) { AU = null; } amx = Math.max(ev("Audio Max", time, 1), 0.001); }',
    // the effector's raw terms at time tq: [dx, dy, scale, rotate, fade] (features/grid/effectors.js termsAt)
    '  function TQ(tq) {',
    '    var IP = G.toComp([x + jx, y + jy + dy, z], tq), L0 = sub(EL.fromComp([IP[0], IP[1]], tq), EL.anchorPoint.valueAtTime(tq)), lx = L0[0], ly = L0[1];',
    '    var sz = Math.max(ev("Size", tq, 300), 0.001), sf = Math.min(Math.max(ev("Softness", tq, 50) / 100, 0), 1), w;',
    '    if (fo == 4) { w = 1; } else if (fo == 5) { var nu = (vn(lx / sz + sd0 * 13.7, ly / sz + fsp * tq) + 1) / 2, hf = Math.max(sf, 0.001) / 2; w = sm(Math.min(Math.max((nu - 0.5 + hf) / (2 * hf), 0), 1)); }',
    '    else if (fo == 6) { w = 0; if (FL) { var smp = FL.sampleImage(FL.fromComp([IP[0], IP[1]], tq), [2, 2], true, tq); w = Math.min(Math.max((0.2126 * smp[0] + 0.7152 * smp[1] + 0.0722 * smp[2]) * smp[3], 0), 1); } }',
    '    else if (fo == 2) { w = fe(Math.min(Math.max(0.5 - lx / sz, 0), 1)); } else {',
    '      var dE = fo == 3 ? Math.max(Math.abs(lx), Math.abs(ly)) : Math.sqrt(lx * lx + ly * ly), inr = sz * (1 - sf);',
    '      w = dE <= inr ? 1 : (dE >= sz ? 0 : fe((sz - dE) / Math.max(sz - inr, 0.001)));',
    '    }',
    '    if (inv) { w = 1 - w; }',
    '    w = w * ev("Strength", tq, 100) / 100;',
    '    if (w <= 0) { return [0, 0, 0, 0, 0]; }',
    '    var tt = tp == 5 ? tq - k * dl * thisComp.frameDuration : tq, m = m0;',
    // v0.36 Target: turn the short way toward the effector (Rotate = aim offset; 0° = the item's +X axis)
    '    if (tp == 6) { var EO = EL.toComp(EL.anchorPoint.valueAtTime(tq), tq), am = Math.atan2(EO[1] - IP[1], EO[0] - IP[0]) * 180 / Math.PI + ev("Rotate", tq, 0) - (rot + G.transform.rotation.valueAtTime(tq)); am = am - 360 * Math.floor((am + 180) / 360); return [ev("Move X", tq, 0) * w, ev("Move Y", tq, 0) * w, ev("Scale", tq, 0) / 100 * w, am * w, ev("Fade", tq, 0) / 100 * w]; }',
    '    if (tp == 7) { var av = 0; if (AU) { try { av = AU.effect("Both Channels")(1).valueAtTime(tq - k * dl * thisComp.frameDuration); } catch (eAv) { av = 0; } } av = Math.min(Math.max(av / amx, 0), 1); m = [av, av, av, av, av]; }',
    '    if (tp == 4) { var ns = nsp * tq, sd = sd0 * 17.3, nv = vn(x * nf + ns, y * nf + sd); m = [nv, vn(x * nf + 31.7 + ns, y * nf + sd), nv, nv, nv]; }',
    '    if (tp == 8) { var wph = k / wln - wsp * tq + wof, wfr = wph - Math.floor(wph), wv = wsh == 2 ? 1 - 4 * Math.abs(wfr - 0.5) : (wsh == 3 ? 2 * wfr - 1 : (wsh == 4 ? 1 - 2 * wfr : (wsh == 5 ? (wfr < 0.5 ? 1 : -1) : Math.sin(2 * Math.PI * wph)))); m = [wv, wv, wv, wv, wv]; }',
    '    if (mvm == 2 || mvm == 3) {',
    '      var EO2 = EL.toComp(EL.anchorPoint.valueAtTime(tq), tq), GO = G.fromComp([EO2[0], EO2[1]], tq), gdx = GO[0] - (x + jx), gdy = GO[1] - (y + jy + dy), msc = ev("Scale", tt, 0) / 100 * m[2] * w, mro = ev("Rotate", tt, 0) * m[3] * w, mfa = ev("Fade", tt, 0) / 100 * m[4] * w;',
    '      if (mvm == 2) { var gds = Math.sqrt(gdx * gdx + gdy * gdy), gpl = ev("Move X", tt, 0) * m[0] * w; if (gpl > gds) { gpl = gds; } return [gds > 0.001 ? gdx / gds * gpl : 0, gds > 0.001 ? gdy / gds * gpl : 0, msc, mro, mfa]; }',
    '      var gab = m[0] * w; return [(gdx + ev("Move X", tt, 0)) * gab, (gdy + ev("Move Y", tt, 0)) * gab, msc, mro, mfa];',
    '    }',
    '    return [ev("Move X", tt, 0) * m[0] * w, ev("Move Y", tt, 0) * m[1] * w, ev("Scale", tt, 0) / 100 * m[2] * w, ev("Rotate", tt, 0) * m[3] * w, ev("Fade", tt, 0) / 100 * m[4] * w];',
    '  }',
    '  var R = TQ(time), sp = 0, fq = 0, dc = 5;',
    // v0.35 Spring / Inertia (effectors made before v0.35 have no Spring control → off)
    '  sp = Math.max(0, ev("Spring", time, 0) / 100); fq = ev("Frequency", time, 2.5); dc = ev("Decay", time, 5);',
    '  if (sp > 0) {',
    `    var sg = Math.max(dc, ${SPRING.minDecay}), Wn = Math.min(${SPRING.maxWindow}, ${SPRING.settle} / sg), Nn = Math.max(1, Math.min(${SPRING.maxSamples}, Math.ceil(Wn / thisComp.frameDuration - 1e-9))), Dn = Wn / Nn, om = 2 * Math.PI * fq, pv = R, ac = [0, 0, 0, 0, 0], jn, cn;`,
    '    for (jn = 0; jn < Nn; jn++) {',
    '      var nx = TQ(time - (jn + 1) * Dn), tau = (jn + 0.5) * Dn, dk = Math.exp(-sg * tau);',
    '      var Sr = fq <= 0.01 ? 1 - dk * (1 + sg * tau) : 1 - dk * (Math.cos(om * tau) + sg / om * Math.sin(om * tau));',
    '      for (cn = 0; cn < 5; cn++) { ac[cn] += (pv[cn] - nx[cn]) * Sr; }',
    '      pv = nx;',
    '    }',
    '    var R2 = []; for (cn = 0; cn < 5; cn++) { R2.push(R[cn] + sp * (pv[cn] + ac[cn] - R[cn])); } R = R2;',
    '  }',
    // v0.88 Snap To, then Clamp — after the spring (features/grid/effectors.js modify)
    '  var snm = ev("Snap Move", time, 0), snr = ev("Snap Rotate", time, 0), sns = ev("Snap Scale", time, 0) / 100, mxm = ev("Max Move", time, 0), mxr = ev("Max Rotate", time, 0), mxs = ev("Max Scale", time, 0) / 100;',
    '  if (snm > 0 || snr > 0 || sns > 0 || mxm > 0 || mxr > 0 || mxs > 0) {',
    '    var f0 = snm > 0 ? Math.round(R[0] / snm) * snm : R[0], f1 = snm > 0 ? Math.round(R[1] / snm) * snm : R[1], f2 = sns > 0 ? Math.round(R[2] / sns) * sns : R[2], f3 = snr > 0 ? Math.round(R[3] / snr) * snr : R[3];',
    '    if (mxm > 0) { var fdm = Math.sqrt(f0 * f0 + f1 * f1); if (fdm > mxm) { f0 = f0 * mxm / fdm; f1 = f1 * mxm / fdm; } }',
    '    if (mxs > 0) { f2 = Math.min(Math.max(f2, -mxs), mxs); }',
    '    if (mxr > 0) { f3 = Math.min(Math.max(f3, -mxr), mxr); }',
    '    R = [f0, f1, f2, f3, R[4]];',
    '  }',
    '  ex += R[0]; ey += R[1];',
    '  es *= Math.max(0, 1 + R[2]);',
    '  er += R[3];',
    '  eop *= Math.min(Math.max(1 - R[4], 0), 1);',
    '}',
    `var eqi; for (eqi = 0; eqi < ${SLOTS.length}; eqi++) { var EQ = null; try { EQ = G.effect(eqi == 0 ? "Effector" : "Effector " + (eqi + 1))(1); } catch (eS) { EQ = null; } if (EQ) { EFX(EQ); } }`
  ].join('\n');
}

/* ---------- v0.34 Clone Colours: a palette over the items, effectors tint them ---------- */
const COLOUR_MODES = [
  { id: 'cycle', menu: 'Cycle', label: 'Cycle', hint: 'Colour 1, 2, 3, 4, 1, 2… in the grid order' },
  { id: 'gradient', menu: 'Gradient', label: 'Gradient', hint: 'From Colour 1 on the first item to Colour 4 on the last' },
  { id: 'random', menu: 'Random', label: 'Random', hint: 'Each item picks one of the four (Seed)' }
];
/** The grid null's colour controls. */
const COLOUR_CONTROLS = [['Colour Mode', 'menu', 1, COLOUR_MODES.map((m) => m.menu)], ['Colour 1', 'color'], ['Colour 2', 'color'], ['Colour 3', 'color'], ['Colour 4', 'color'], ['Colour Seed', 'slider', 1]];
const COLOUR_FX = 'MOE Clone Colour';
const COLOUR_TAG = '// MOE Clone Colour';
const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1];
/** Base colour of item i of n: mode 1 cycle, 2 gradient, 3 random; pal = four [r, g, b, a]. */
function paletteColour(mode, pal, i, n, seed) {
  const md = Math.round(mode);
  if (md === 2) { const t = n > 1 ? i / (n - 1) : 0, sv = t * 3, j = Math.min(Math.floor(sv), 2); return mixC(pal[j], pal[j + 1], sv - j); }
  if (md === 3) { const u = hs(i * 1.731 + 0.5, seed * 3.117 + 1.1) * 0.5 + 0.5, j = Math.min(3, Math.floor(u * 4)); return mixC(pal[j], pal[j], 0); }
  return mixC(pal[i % 4], pal[i % 4], 0);
}
/** The colour after every effector's Colour Mix (in order). effs: [{ values, toLocal, lumaAt? }]; cx, cy = the item's comp point; t = time (Noise Field). */
function colourWithEffectors(base, effs, cx, cy, t = 0) {
  let col = base;
  for (const e of effs) {
    const mx = (e.values.colourMix || 0) / 100;
    if (mx <= 0) continue;
    const [lx, ly] = e.toLocal(cx, cy);
    const a = Math.min(Math.max(weight(e.values, lx, ly, { t, luma: e.lumaAt ? e.lumaAt(cx, cy, t) : 0 }) * mx, 0), 1);
    col = mixC(col, rgba(e.values.colour), a);
  }
  return col;
}
/** The Fill colour expression for item i of n (mirrors paletteColour + colourWithEffectors). */
function colourCode(i, n, gridName) {
  const g = String(gridName).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return [
    `${COLOUR_TAG} · ${g}`,
    `var G = thisComp.layer("${g}");`,
    'function c(nm) { return G.effect(nm)(1).value; }',
    'function sm(u) { return u * u * (3 - 2 * u); }',
    'function hs(a, b) { var s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; }',
    'function mx3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1]; }',
    'function vn(px, py) { var x0 = Math.floor(px), y0 = Math.floor(py), ux = sm(px - x0), uy = sm(py - y0), a = hs(x0, y0), b = hs(x0 + 1, y0), c2 = hs(x0, y0 + 1), d = hs(x0 + 1, y0 + 1); return a + (b - a) * ux + (c2 - a) * uy + (a - b - c2 + d) * ux * uy; }',
    `var i = ${i}, n = ${n};`,
    'var md = Math.round(c("Colour Mode")), P = [c("Colour 1"), c("Colour 2"), c("Colour 3"), c("Colour 4")], col;',
    'if (md == 2) { var t = n > 1 ? i / (n - 1) : 0, sv = t * 3, j = Math.min(Math.floor(sv), 2); col = mx3(P[j], P[j + 1], sv - j); }',
    'else if (md == 3) { var u = hs(i * 1.731 + 0.5, c("Colour Seed") * 3.117 + 1.1) * 0.5 + 0.5, j2 = Math.min(3, Math.floor(u * 4)); col = mx3(P[j2], P[j2], 0); }',
    'else { col = mx3(P[i % 4], P[i % 4], 0); }',
    'var IP = thisLayer.toComp(thisLayer.anchorPoint), q;',
    `for (q = 0; q < ${SLOTS.length}; q++) {`,
    '  var EL = null; try { EL = G.effect(q == 0 ? "Effector" : "Effector " + (q + 1))(1); } catch (eS) { EL = null; }',
    '  if (!EL) { continue; }',
    '  var mxv = 0, ec = null; try { mxv = EL.effect("Colour Mix")(1).value / 100; ec = EL.effect("Colour")(1).value; } catch (eC) { continue; }',
    '  if (mxv <= 0) { continue; }',
    '  var L0 = sub(EL.fromComp([IP[0], IP[1]]), EL.anchorPoint), lx = L0[0], ly = L0[1];',
    '  var fo = Math.round(EL.effect("Falloff")(1).value), sz = Math.max(EL.effect("Size")(1).value, 0.001), sf = Math.min(Math.max(EL.effect("Softness")(1).value / 100, 0), 1), w;',
    // v0.89: the same edge curve as the moves (effectors without the control: Smooth)
    '  var fcv = 1; try { fcv = Math.round(EL.effect("Falloff Curve")(1).value); } catch (eFc) { fcv = 1; }',
    '  if (fo == 4) { w = 1; }',
    // v0.38 fields (same maths as the moves; read now)
    '  else if (fo == 5) { var fsp = 0, sd0 = 0; try { fsp = EL.effect("Field Speed")(1).value / 100; sd0 = EL.effect("Seed")(1).value; } catch (eF5) { } var nu = (vn(lx / sz + sd0 * 13.7, ly / sz + fsp * time) + 1) / 2, hf = Math.max(sf, 0.001) / 2; w = sm(Math.min(Math.max((nu - 0.5 + hf) / (2 * hf), 0), 1)); }',
    '  else if (fo == 6) { w = 0; var FL = null; try { FL = EL.effect("Field Layer")(1); } catch (eF6) { FL = null; } if (FL) { var smp = FL.sampleImage(FL.fromComp([IP[0], IP[1]]), [2, 2], true, time); w = Math.min(Math.max((0.2126 * smp[0] + 0.7152 * smp[1] + 0.0722 * smp[2]) * smp[3], 0), 1); } }',
    '  else if (fo == 2) { var u2 = Math.min(Math.max(0.5 - lx / sz, 0), 1); w = fcv == 2 ? u2 : (fcv == 3 ? u2 * u2 : (fcv == 4 ? 1 - (1 - u2) * (1 - u2) : sm(u2))); } else {',
    '    var dE = fo == 3 ? Math.max(Math.abs(lx), Math.abs(ly)) : Math.sqrt(lx * lx + ly * ly), inr = sz * (1 - sf);',
    '    if (dE <= inr) { w = 1; } else if (dE >= sz) { w = 0; } else { var u3 = (sz - dE) / Math.max(sz - inr, 0.001); w = fcv == 2 ? u3 : (fcv == 3 ? u3 * u3 : (fcv == 4 ? 1 - (1 - u3) * (1 - u3) : sm(u3))); }',
    '  }',
    '  if (EL.effect("Invert")(1).value == 1) { w = 1 - w; }',
    '  w = w * EL.effect("Strength")(1).value / 100;',
    '  col = mx3(col, ec, Math.min(Math.max(w * mxv, 0), 1));',
    '}',
    'col;'
  ].join('\n');
}

module.exports = { CURVES, MOVE_MODES, edge, WAVES, waveAt, modify, TYPES, FALLOFFS, SLOTS, NAME, CONTROLS, KEY, GROUPS, GROUP_LABEL, needed, groupNames, defaults, valuesOf, rgba, weight, amounts, apply, localFn, vnoise, hs, PR, code,
  SPRING, stepResponse, springWindow, termsAt, springTerms, applyAt, wrap180, luma,
  COLOUR_MODES, COLOUR_CONTROLS, COLOUR_FX, COLOUR_TAG, paletteColour, colourWithEffectors, colourCode };
