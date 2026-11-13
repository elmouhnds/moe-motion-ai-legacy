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
  { id: 'audio', menu: 'Audio', label: 'Audio', hint: 'The moves follow a soundtrack’s loudness — each item a little later (Delay)' }
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
  ['Field Speed', 'slider', 50]
];
const KEY = { 'Effector Type': 'type', Falloff: 'falloff', Size: 'size', Softness: 'softness', Strength: 'strength', Invert: 'invert', 'Move X': 'moveX', 'Move Y': 'moveY', Scale: 'scale', Rotate: 'rotate', Fade: 'fade', Seed: 'seed', Delay: 'delay', 'Noise Scale': 'noiseScale', 'Noise Speed': 'noiseSpeed', Colour: 'colour', 'Colour Mix': 'colourMix', Spring: 'spring', Frequency: 'frequency', Decay: 'decay', 'Audio Layer': 'audioLayer', 'Audio Max': 'audioMax', 'Field Layer': 'fieldLayer', 'Field Speed': 'fieldSpeed' };

/**
 * v0.87 Controls on demand (docs/features/CONTROLS_ON_DEMAND.md — owner: "only the sliders that matter for the
 * move, not every variable"). A new effector null gets only the controls its own settings use; a control that is
 * not there reads as its default in the item expression (`ev(name, t, default)`), so nothing changes in the result.
 *   core    always: Effector Type, Falloff, Size, Softness, Strength, Invert (Clone Colour expressions read them)
 *   moves   Move X / Move Y / Scale / Rotate / Fade — the ones this effector moves (Target always has Rotate)
 *   random  Seed (Random, Noise, Noise Field) · Noise Scale, Noise Speed (Noise) · Delay (Delay, Audio)
 *   colour  Colour, Colour Mix   spring  Spring, Frequency, Decay   audio  Audio Layer, Audio Max
 *   field   Field Layer (Image) · Field Speed (Noise Field)
 * GROUPS is also the list the Effector Controls tool offers to add later.
 */
const GROUPS = {
  core: ['Effector Type', 'Falloff', 'Size', 'Softness', 'Strength', 'Invert'],
  moves: ['Move X', 'Move Y', 'Scale', 'Rotate', 'Fade'],
  random: ['Seed', 'Delay', 'Noise Scale', 'Noise Speed'],
  colour: ['Colour', 'Colour Mix'],
  spring: ['Spring', 'Frequency', 'Decay'],
  audio: ['Audio Layer', 'Audio Max'],
  field: ['Field Layer', 'Field Speed']
};
const GROUP_LABEL = { moves: 'Moves', random: 'Random · Noise · Delay', colour: 'Colour', spring: 'Spring', audio: 'Audio', field: 'Field' };
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

/** Rec. 709 luma of an [r, g, b, a] sample, times its alpha (Image field). */
const luma = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) * (c[3] === undefined ? 1 : c[3]);
/**
 * Weight 0..1 of a point given in the effector's own space (px).
 * f (v0.38 fields): { t: time (Noise Field evolves), luma: the Field Layer's brightness under the item (Image) }.
 *   Noise Field: n = value noise at (lx / Size + Seed × 13.7, ly / Size + Field Speed / 100 × t), 0..1; Softness
 *   is the width of the edge around 0.5 (0 = hard cells). Image: the brightness (0..1). Both then Invert / Strength.
 */
function weight(e, lx, ly, f) {
  const fo = Math.round(e.falloff), sz = Math.max(e.size, 0.001), sf = clamp(e.softness / 100, 0, 1);
  let w;
  if (fo === 4) w = 1;
  else if (fo === 5) {
    const t = f && f.t !== undefined ? f.t : 0, nu = (vnoise(lx / sz + (e.seed || 0) * 13.7, ly / sz + (e.fieldSpeed || 0) / 100 * t) + 1) / 2, hf = Math.max(sf, 0.001) / 2;
    w = smooth(clamp((nu - 0.5 + hf) / (2 * hf), 0, 1));
  } else if (fo === 6) w = clamp(f && f.luma !== undefined ? f.luma : 0, 0, 1);
  else if (fo === 2) w = smooth(clamp(0.5 - lx / sz, 0, 1)); // a soft edge Size px wide: full to the left, none to the right
  else {
    const d = fo === 3 ? Math.max(Math.abs(lx), Math.abs(ly)) : Math.sqrt(lx * lx + ly * ly);
    const inner = sz * (1 - sf);
    w = d <= inner ? 1 : d >= sz ? 0 : smooth((sz - d) / Math.max(sz - inner, 0.001));
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
    dx += v.moveX * m[0] * w; dy += v.moveY * m[1] * w;
    scaleMul *= Math.max(0, 1 + v.scale / 100 * m[2] * w);
    rot += v.rotate * m[3] * w;
    opMul *= clamp(1 - v.fade / 100 * m[4] * w, 0, 1);
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
  if (tp === 7) { const a = clamp((src.audioAt ? src.audioAt(tq - item.k * V.delay * item.fd) : 0) / Math.max(V.audioMax, 0.001), 0, 1); m = [a, a, a, a, a]; }
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
    const R = springTerms(src, item, now);
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
    '  var AU = null, amx = 1; if (tp == 7) { try { AU = EL.effect("Audio Layer")(1); } catch (eAu) { AU = null; } amx = Math.max(ev("Audio Max", time, 1), 0.001); }',
    // the effector's raw terms at time tq: [dx, dy, scale, rotate, fade] (features/grid/effectors.js termsAt)
    '  function TQ(tq) {',
    '    var IP = G.toComp([x + jx, y + jy + dy, z], tq), L0 = sub(EL.fromComp([IP[0], IP[1]], tq), EL.anchorPoint.valueAtTime(tq)), lx = L0[0], ly = L0[1];',
    '    var sz = Math.max(ev("Size", tq, 300), 0.001), sf = Math.min(Math.max(ev("Softness", tq, 50) / 100, 0), 1), w;',
    '    if (fo == 4) { w = 1; } else if (fo == 5) { var nu = (vn(lx / sz + sd0 * 13.7, ly / sz + fsp * tq) + 1) / 2, hf = Math.max(sf, 0.001) / 2; w = sm(Math.min(Math.max((nu - 0.5 + hf) / (2 * hf), 0), 1)); }',
    '    else if (fo == 6) { w = 0; if (FL) { var smp = FL.sampleImage(FL.fromComp([IP[0], IP[1]], tq), [2, 2], true, tq); w = Math.min(Math.max((0.2126 * smp[0] + 0.7152 * smp[1] + 0.0722 * smp[2]) * smp[3], 0), 1); } }',
    '    else if (fo == 2) { w = sm(Math.min(Math.max(0.5 - lx / sz, 0), 1)); } else {',
    '      var dE = fo == 3 ? Math.max(Math.abs(lx), Math.abs(ly)) : Math.sqrt(lx * lx + ly * ly), inr = sz * (1 - sf);',
    '      w = dE <= inr ? 1 : (dE >= sz ? 0 : sm((sz - dE) / Math.max(sz - inr, 0.001)));',
    '    }',
    '    if (inv) { w = 1 - w; }',
    '    w = w * ev("Strength", tq, 100) / 100;',
    '    if (w <= 0) { return [0, 0, 0, 0, 0]; }',
    '    var tt = tp == 5 ? tq - k * dl * thisComp.frameDuration : tq, m = m0;',
    // v0.36 Target: turn the short way toward the effector (Rotate = aim offset; 0° = the item's +X axis)
    '    if (tp == 6) { var EO = EL.toComp(EL.anchorPoint.valueAtTime(tq), tq), am = Math.atan2(EO[1] - IP[1], EO[0] - IP[0]) * 180 / Math.PI + ev("Rotate", tq, 0) - (rot + G.transform.rotation.valueAtTime(tq)); am = am - 360 * Math.floor((am + 180) / 360); return [ev("Move X", tq, 0) * w, ev("Move Y", tq, 0) * w, ev("Scale", tq, 0) / 100 * w, am * w, ev("Fade", tq, 0) / 100 * w]; }',
    '    if (tp == 7) { var av = 0; if (AU) { try { av = AU.effect("Both Channels")(1).valueAtTime(tq - k * dl * thisComp.frameDuration); } catch (eAv) { av = 0; } } av = Math.min(Math.max(av / amx, 0), 1); m = [av, av, av, av, av]; }',
    '    if (tp == 4) { var ns = nsp * tq, sd = sd0 * 17.3, nv = vn(x * nf + ns, y * nf + sd); m = [nv, vn(x * nf + 31.7 + ns, y * nf + sd), nv, nv, nv]; }',
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
    '  if (fo == 4) { w = 1; }',
    // v0.38 fields (same maths as the moves; read now)
    '  else if (fo == 5) { var fsp = 0, sd0 = 0; try { fsp = EL.effect("Field Speed")(1).value / 100; sd0 = EL.effect("Seed")(1).value; } catch (eF5) { } var nu = (vn(lx / sz + sd0 * 13.7, ly / sz + fsp * time) + 1) / 2, hf = Math.max(sf, 0.001) / 2; w = sm(Math.min(Math.max((nu - 0.5 + hf) / (2 * hf), 0), 1)); }',
    '  else if (fo == 6) { w = 0; var FL = null; try { FL = EL.effect("Field Layer")(1); } catch (eF6) { FL = null; } if (FL) { var smp = FL.sampleImage(FL.fromComp([IP[0], IP[1]]), [2, 2], true, time); w = Math.min(Math.max((0.2126 * smp[0] + 0.7152 * smp[1] + 0.0722 * smp[2]) * smp[3], 0), 1); } }',
    '  else if (fo == 2) { w = sm(Math.min(Math.max(0.5 - lx / sz, 0), 1)); } else {',
    '    var dE = fo == 3 ? Math.max(Math.abs(lx), Math.abs(ly)) : Math.sqrt(lx * lx + ly * ly), inr = sz * (1 - sf);',
    '    w = dE <= inr ? 1 : (dE >= sz ? 0 : sm((sz - dE) / Math.max(sz - inr, 0.001)));',
    '  }',
    '  if (EL.effect("Invert")(1).value == 1) { w = 1 - w; }',
    '  w = w * EL.effect("Strength")(1).value / 100;',
    '  col = mx3(col, ec, Math.min(Math.max(w * mxv, 0), 1));',
    '}',
    'col;'
  ].join('\n');
}

module.exports = { TYPES, FALLOFFS, SLOTS, NAME, CONTROLS, KEY, GROUPS, GROUP_LABEL, needed, groupNames, defaults, valuesOf, rgba, weight, amounts, apply, localFn, vnoise, hs, PR, code,
  SPRING, stepResponse, springWindow, termsAt, springTerms, applyAt, wrap180, luma,
  COLOUR_MODES, COLOUR_CONTROLS, COLOUR_FX, COLOUR_TAG, paletteColour, colourWithEffectors, colourCode };
