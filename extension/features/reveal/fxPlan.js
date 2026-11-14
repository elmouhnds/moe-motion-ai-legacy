'use strict';
/**
 * Matte FX (v0.96, docs/features/MATTE_FX.md) — the pure plan.
 *
 * The professional way to make an organic reveal in After Effects: an alpha matte made from a GRADIENT MAP of
 * Fractal Noise mixed over a direction ramp, read by Gradient Wipe. Three MOE pre-comps per layer, all native effects
 * and all set by numbers whose units are known (px, %, degrees, colours, a layer reference — never a native menu
 * except Gradient Ramp's Ramp Shape, see RAMP_SHAPE):
 *
 *   MOE FX N Map    a direction ramp (Gradient Ramp: linear along an angle, or radial from the centre; or flat grey)
 *                   under a Fractal Noise solid blended Overlay (or Normal) at `mix` % — the noise breaks the ramp's
 *                   straight line into an organic, boiling edge (Evolution keyed).
 *   MOE FX N Matte  that Map (hidden) + a white solid with Gradient Wipe reading it: Transition Completion keyed
 *                   100 → 0 reveals the brightest parts of the Map first; Softness is the edge's width; an optional
 *                   Turbulent Displace makes the edge liquid. This comp is the layer's ALPHA track matte.
 *   MOE FX N Edge   (only with an edge) the Matte twice, the second one `lag` seconds later, blended Difference: a thin
 *                   band at the reveal front. It is the LUMA matte of a linked copy of the layer, filled with the edge
 *                   colour and glowing (Fill + Glow), added on top — the burning / electric / neon front.
 *
 * Every pre-comp is built in the TARGET's layer space with a margin: pixel (m, m) of a pre-comp is the layer's
 * sourceRect (left, top). Its layer in the user's comp has Anchor = (m − left, m − top), Position (0, 0) and is
 * parented to the target with setParentWithJump (values kept) — so the matte sits exactly on the layer and follows it.
 */
const PLAN = require('../quick/animatePlan');

/** Gradient Ramp's Ramp Shape menu: 1 Linear Ramp, 2 Radial Ramp (After Effects' Gradient Ramp, two items). */
const RAMP_SHAPE = { linear: 1, radial: 2 };
const LIMITS = { margin: 64, size: 8000, edgeLag: [0.02, 0.4] };
/**
 * Fractal Noise menus, used only by the Pixel material. The values are not guessed: the Click VFX project file the owner
 * shared (docs/research/CLICK_VFX_STUDY.md) stores Noise Type 1 and Fractal Type 11 on the very layer the tutorial
 * shows as "Max / Block, Brightness -35" (owner's Reveal Seed report, [SEEN]). Unverified in this After Effects until the
 * Self-Test fxMatte reads them back.
 */
const NOISE_MENU = { type: { block: 1 }, fractal: { max: 11 } };

const hex = (h) => { const s = String(h || '#ffffff').replace('#', ''); const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1]; };
const r2 = (v) => Math.round(v * 100) / 100;

/**
 * The library. ramp: linear (angle: the way the reveal travels, 0 = left → right, 90 = top → bottom) | radial (from the
 * centre out) | none (the noise alone decides — a dissolve). noise: Fractal Noise Scale / Complexity / Contrast /
 * Brightness, `mix` (% of the noise over the ramp), `evo` (turns of Evolution during the reveal). soft: Gradient Wipe
 * Transition Softness %. displace: Turbulent Displace Amount / Size on the matte. edge: colour, `lag` (share of the
 * duration the band lasts), Glow Radius px, Glow Intensity.
 */
const PRESETS = {
  organicSweep: { label: 'Organic Sweep', hint: 'A soft, living edge crosses the layer — noise breaks the line', ramp: 'linear', angle: 0, noise: { scale: 150, complexity: 6, contrast: 160, mix: 65, evo: 1 }, soft: 14, duration: 1, ease: 'smooth' },
  inkBleed: { label: 'Ink Bleed', hint: 'Ink spreads out from the centre with ragged, wet edges', ramp: 'radial', noise: { scale: 240, complexity: 6, contrast: 220, mix: 75, evo: 0.8 }, soft: 16, displace: { amount: 28, size: 80 }, duration: 1.2, ease: 'expo' },
  smokeRise: { label: 'Smoke Rise', hint: 'Rises out of soft smoke from the bottom', ramp: 'linear', angle: 270, noise: { scale: 420, complexity: 3, contrast: 120, mix: 80, evo: 1.6 }, soft: 40, displace: { amount: 60, size: 200 }, duration: 1.4, ease: 'smooth' },
  burnIn: { label: 'Burn In', hint: 'Burns in across the diagonal, an orange ember front', ramp: 'linear', angle: 45, noise: { scale: 110, complexity: 7, contrast: 260, mix: 70, evo: 2 }, soft: 4, edge: { color: '#FF7A1A', lag: 0.08, glow: 30, intensity: 2 }, duration: 1.2, ease: 'smooth' },
  lavaEdge: { label: 'Lava Edge', hint: 'A molten ring opens from the centre', ramp: 'radial', noise: { scale: 160, complexity: 6, contrast: 240, mix: 70, evo: 1.5 }, soft: 6, edge: { color: '#FF3D1A', lag: 0.12, glow: 50, intensity: 2.5 }, duration: 1.3, ease: 'expo' },
  electricEdge: { label: 'Electric Edge', hint: 'A crackling cyan front sweeps across', ramp: 'linear', angle: 0, noise: { scale: 60, complexity: 8, contrast: 300, mix: 55, evo: 3 }, soft: 2, edge: { color: '#3BD5FF', lag: 0.05, glow: 24, intensity: 2.5 }, duration: 0.9, ease: 'smooth' },
  neonWipe: { label: 'Neon Wipe', hint: 'A clean wipe with a magenta neon line', ramp: 'linear', angle: 0, noise: { scale: 200, complexity: 4, contrast: 120, mix: 25, evo: 0.5 }, soft: 3, edge: { color: '#FF3BD4', lag: 0.06, glow: 40, intensity: 3 }, duration: 0.9, ease: 'expo' },
  paperTear: { label: 'Paper Tear', hint: 'A torn paper edge from the top, a thin white fibre line', ramp: 'linear', angle: 90, noise: { scale: 40, complexity: 9, contrast: 320, mix: 70, evo: 0.2 }, soft: 1, edge: { color: '#FFFFFF', lag: 0.03, glow: 8, intensity: 1 }, duration: 1, ease: 'smooth' },
  frostCreep: { label: 'Frost Creep', hint: 'Frost grows out of the centre with an icy rim', ramp: 'radial', noise: { scale: 70, complexity: 8, contrast: 240, mix: 70, evo: 0.6 }, soft: 6, edge: { color: '#BFE6FF', lag: 0.07, glow: 20, intensity: 1.5 }, duration: 1.4, ease: 'smooth' },
  lightBloom: { label: 'Light Bloom', hint: 'Blooms out of a white light from the centre', ramp: 'radial', noise: { scale: 220, complexity: 5, contrast: 140, mix: 40, evo: 1 }, soft: 25, edge: { color: '#FFFFFF', lag: 0.12, glow: 60, intensity: 1.5 }, duration: 1.1, ease: 'expo' },
  cloudIris: { label: 'Cloud Iris', hint: 'Opens through drifting clouds', ramp: 'radial', noise: { scale: 380, complexity: 4, contrast: 140, mix: 80, evo: 1.2 }, soft: 30, duration: 1.3, ease: 'smooth' },
  liquidRise: { label: 'Liquid Rise', hint: 'Fills up from the bottom like a liquid surface', ramp: 'linear', angle: 270, noise: { scale: 180, complexity: 3, contrast: 140, mix: 50, evo: 1.2 }, soft: 8, displace: { amount: 80, size: 140 }, duration: 1.2, ease: 'smooth' },
  inkWash: { label: 'Ink Wash ↗', hint: 'A brush of ink washes up the diagonal', ramp: 'linear', angle: 315, noise: { scale: 300, complexity: 5, contrast: 200, mix: 75, evo: 0.8 }, soft: 20, displace: { amount: 35, size: 120 }, duration: 1.2, ease: 'expo' },
  grainDissolve: { label: 'Grain Dissolve', hint: 'Dissolves in from fine film grain', ramp: 'none', noise: { scale: 8, complexity: 2, contrast: 140, mix: 100, evo: 2 }, soft: 0, duration: 0.8, ease: 'linear' },
  cloudDissolve: { label: 'Cloud Dissolve', hint: 'Appears through soft cloudy patches', ramp: 'none', noise: { scale: 260, complexity: 5, contrast: 160, mix: 100, evo: 1 }, soft: 20, duration: 1.1, ease: 'smooth' },
  auroraEdge: { label: 'Aurora Edge', hint: 'A soft green-teal light runs along the front', ramp: 'linear', angle: 0, noise: { scale: 260, complexity: 4, contrast: 150, mix: 60, evo: 1.4 }, soft: 10, edge: { color: '#5CFFC4', lag: 0.14, glow: 70, intensity: 1.5 }, duration: 1.3, ease: 'smooth' }
};

/**
 * The plan for one layer whose content box (sourceRectAtTime) is `rect` = [left, top, width, height].
 * args: preset, dir (in | out), duration, ease, angle (overrides the preset's), softness, mix, scale, edgeColor,
 * glow, intensity, seed, edge (true | false: off turns the preset's edge off).
 */
function build(args, rect) {
  // v0.97: 'compose' = the grammar (shape × material × motion × palette); otherwise a curated preset
  const P = args.preset === 'compose' ? require('./grammar').compose(args) : (PRESETS[args.preset] || PRESETS.organicSweep);
  const [l, t, w, h] = rect;
  if (!(w >= 1 && h >= 1)) throw Object.assign(new Error('Nothing to reveal (empty layer box)'), { code: 'EMPTY' });
  const m = LIMITS.margin;
  const W = Math.ceil(w + 2 * m), H = Math.ceil(h + 2 * m);
  if (W > LIMITS.size || H > LIMITS.size) throw Object.assign(new Error(`Layer too large for a matte (${W} × ${H}, max ${LIMITS.size})`), { code: 'TOO_LARGE' });
  const dur = args.duration > 0 ? args.duration : P.duration;
  const e = PLAN.easePair(args.ease || P.ease || 'smooth');
  const out = args.dir === 'out';
  const c = [m + w / 2, m + h / 2];
  // the Map: a ramp (white = revealed first) under the noise
  let ramp;
  if (P.ramp === 'linear') {
    const ang = (args.angle !== undefined && args.angle !== null && args.angle !== '' ? Number(args.angle) : P.angle) * Math.PI / 180;
    const d = [Math.cos(ang), Math.sin(ang)];
    const R = (Math.abs(w * d[0]) + Math.abs(h * d[1])) / 2 + m / 2;
    ramp = { shape: 'linear', start: [r2(c[0] - d[0] * R), r2(c[1] - d[1] * R)], end: [r2(c[0] + d[0] * R), r2(c[1] + d[1] * R)], startColor: [1, 1, 1, 1], endColor: [0, 0, 0, 1] };
  } else if (P.ramp === 'radial') {
    // from the centre, or from any point of the layer (v0.97: the click / cursor distance field) — far enough to clear
    // the farthest corner
    const o = P.origin ? [m + P.origin[0] * w, m + P.origin[1] * h] : c;
    const R = Math.max(...[[m, m], [m + w, m], [m, m + h], [m + w, m + h]].map((q) => Math.hypot(q[0] - o[0], q[1] - o[1]))) + m / 2;
    ramp = { shape: 'radial', start: o.map(r2), end: [r2(o[0] + R), r2(o[1])], startColor: [1, 1, 1, 1], endColor: [0, 0, 0, 1] };
  } else {
    ramp = { shape: 'linear', start: [0, 0], end: [W, 0], startColor: [0.5, 0.5, 0.5, 1], endColor: [0.5, 0.5, 0.5, 1] };
  }
  const mix = Math.max(0, Math.min(100, args.mix !== undefined ? Number(args.mix) : P.noise.mix));
  const noise = {
    scale: args.scale > 0 ? Number(args.scale) : P.noise.scale, complexity: P.noise.complexity, contrast: P.noise.contrast,
    seed: Math.round(args.seed || 0), mix, blend: P.ramp === 'none' ? 'normal' : 'overlay', offset: c.map(r2),
    brightness: P.noise.brightness || 0,
    type: P.noise.type && NOISE_MENU.type[P.noise.type] ? NOISE_MENU.type[P.noise.type] : null,
    fractal: P.noise.fractal && NOISE_MENU.fractal[P.noise.fractal] ? NOISE_MENU.fractal[P.noise.fractal] : null,
    stretch: P.noise.stretch || null
  };
  const soft = Math.max(0, Math.min(100, args.softness !== undefined ? Number(args.softness) : P.soft));
  const completion = out ? PLAN.keysFor(e, 0, dur, 0, 100) : PLAN.keysFor(e, 0, dur, 100, 0);
  // Evolution turns linearly through the reveal (the edge boils while it moves)
  const evolution = [{ t: 0, v: 0, interp: 'linear' }, { t: dur, v: r2(360 * (P.noise.evo || 0)), interp: 'linear' }];
  const edgeOn = args.edge !== false && !!P.edge;
  const edge = edgeOn ? {
    color: hex(args.edgeColor || P.edge.color),
    lag: r2(Math.max(LIMITS.edgeLag[0], Math.min(LIMITS.edgeLag[1], P.edge.lag * dur))),
    glow: args.glow > 0 ? Number(args.glow) : P.edge.glow,
    intensity: args.intensity > 0 ? Number(args.intensity) : P.edge.intensity
  } : null;
  return {
    preset: args.preset in PRESETS ? args.preset : 'organicSweep', label: P.label,
    size: [W, H], margin: m, anchor: [r2(m - l), r2(m - t)], end: dur, stepped: P.stepped || 0,
    ramp, noise, soft, completion, evolution, displace: P.displace || null, edge
  };
}

/**
 * The share of the layer the matte shows at local time lt, for a Map value v in 0…1 — Gradient Wipe's rule: a pixel is
 * revealed when its Map luminance is above the Completion (with Softness as a linear band). Used by the previews'
 * reference and by tests (a plan must start hidden and end shown).
 */
function shownAt(p, lt, v) {
  const comp = PLAN.valueAt(p.completion, lt) / 100;
  const s = Math.max(1e-6, p.soft / 100);
  // the band runs from comp·(1+s) − s to comp·(1+s): Completion 100 hides every pixel, 0 shows every pixel
  return Math.max(0, Math.min(1, (v - comp * (1 + s) + s) / s));
}

module.exports = { PRESETS, RAMP_SHAPE, NOISE_MENU, LIMITS, build, shownAt, hex };
