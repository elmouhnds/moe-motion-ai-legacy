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
  { id: 'delay', menu: 'Delay', label: 'Delay', hint: 'Keyframe the effector — each item plays it a little later' }
];
const FALLOFFS = [
  { id: 'sphere', menu: 'Sphere', label: 'Sphere' },
  { id: 'linear', menu: 'Linear', label: 'Linear' },
  { id: 'box', menu: 'Box', label: 'Box' },
  { id: 'all', menu: 'Everywhere', label: 'Everywhere' }
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
  ['Colour Mix', 'slider', 0]
];
const KEY = { 'Effector Type': 'type', Falloff: 'falloff', Size: 'size', Softness: 'softness', Strength: 'strength', Invert: 'invert', 'Move X': 'moveX', 'Move Y': 'moveY', Scale: 'scale', Rotate: 'rotate', Fade: 'fade', Seed: 'seed', Delay: 'delay', 'Noise Scale': 'noiseScale', 'Noise Speed': 'noiseSpeed', Colour: 'colour', 'Colour Mix': 'colourMix' };

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

/** Weight 0..1 of a point given in the effector's own space (px). */
function weight(e, lx, ly) {
  const fo = Math.round(e.falloff), sz = Math.max(e.size, 0.001), sf = clamp(e.softness / 100, 0, 1);
  let w;
  if (fo === 4) w = 1;
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
    '  function ev(nm, tt) { return EL.effect(nm)(1).valueAtTime(tt); }',
    '  var IP = G.toComp([x + jx, y + jy + dy, z]), L0 = sub(EL.fromComp([IP[0], IP[1]]), EL.anchorPoint), lx = L0[0], ly = L0[1];',
    '  var fo = Math.round(ev("Falloff", time)), sz = Math.max(ev("Size", time), 0.001), sf = Math.min(Math.max(ev("Softness", time) / 100, 0), 1), w;',
    '  if (fo == 4) { w = 1; } else if (fo == 2) { w = sm(Math.min(Math.max(0.5 - lx / sz, 0), 1)); } else {',
    '    var dE = fo == 3 ? Math.max(Math.abs(lx), Math.abs(ly)) : Math.sqrt(lx * lx + ly * ly), inr = sz * (1 - sf);',
    '    w = dE <= inr ? 1 : (dE >= sz ? 0 : sm((sz - dE) / Math.max(sz - inr, 0.001)));',
    '  }',
    '  if (ev("Invert", time) == 1) { w = 1 - w; }',
    '  w = w * ev("Strength", time) / 100;',
    '  if (w <= 0) { return; }',
    '  var tt = tp == 5 ? time - k * ev("Delay", time) * thisComp.frameDuration : time, m = [1, 1, 1, 1, 1];',
    '  if (tp == 2) { var s2 = ev("Seed", time) * 3.117 + 1.1, ia = i * 1.731; m = [hs(ia + 0.5, s2), hs(ia + 17.63, s2), hs(ia + 34.76, s2), hs(ia + 51.89, s2), hs(ia + 69.02, s2)]; }',
    '  else if (tp == 3) { var sv = n > 1 ? k / (n - 1) : 0; m = [sv, sv, sv, sv, sv]; }',
    '  else if (tp == 4) { var nf = ev("Noise Scale", time) / 1000, ns = ev("Noise Speed", time) / 100 * time, sd = ev("Seed", time) * 17.3, nv = vn(x * nf + ns, y * nf + sd); m = [nv, vn(x * nf + 31.7 + ns, y * nf + sd), nv, nv, nv]; }',
    '  ex += ev("Move X", tt) * m[0] * w; ey += ev("Move Y", tt) * m[1] * w;',
    '  es *= Math.max(0, 1 + ev("Scale", tt) / 100 * m[2] * w);',
    '  er += ev("Rotate", tt) * m[3] * w;',
    '  eop *= Math.min(Math.max(1 - ev("Fade", tt) / 100 * m[4] * w, 0), 1);',
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
/** The colour after every effector's Colour Mix (in order). effs: [{ values, toLocal }]; cx, cy = the item's comp point. */
function colourWithEffectors(base, effs, cx, cy) {
  let col = base;
  for (const e of effs) {
    const mx = (e.values.colourMix || 0) / 100;
    if (mx <= 0) continue;
    const [lx, ly] = e.toLocal(cx, cy);
    const a = Math.min(Math.max(weight(e.values, lx, ly) * mx, 0), 1);
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
    '  if (fo == 4) { w = 1; } else if (fo == 2) { w = sm(Math.min(Math.max(0.5 - lx / sz, 0), 1)); } else {',
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

module.exports = { TYPES, FALLOFFS, SLOTS, NAME, CONTROLS, KEY, defaults, valuesOf, rgba, weight, amounts, apply, localFn, vnoise, hs, PR, code,
  COLOUR_MODES, COLOUR_CONTROLS, COLOUR_FX, COLOUR_TAG, paletteColour, colourWithEffectors, colourCode };
