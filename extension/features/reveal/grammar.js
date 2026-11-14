'use strict';
/**
 * Reveal grammar (v0.97, docs/features/REVEAL_COMPOSER.md — from the owner's "Reveal Seed System" report).
 *
 * A reference is a SEED, not a target: every matte reveal is visible = Threshold(Field warped, Progress(t), Softness),
 * decorated at the threshold band. The user picks four things — SHAPE (the field), MATERIAL (warp + texture + edge),
 * MOTION (the progress curve) and PALETTE (the band's colour) — plus one Intensity; `compose()` turns them into the SAME
 * spec the Matte FX engine builds (fxPlan.build): one engine, never a second one. 9 × 9 × 6 × 8 = 3,888 combinations,
 * each with continuous settings on top.
 *
 * Fields (all built from native effects with known units): a linear Gradient Ramp along an angle, a radial one from the
 * centre or from any point of the layer (the "cursor / click distance" field), flat (noise alone = a dissolve), and
 * stretched Fractal Noise for streaks (Uniform Scaling off, Scale Width / Height).
 */
const SHAPES = {
  sweep: { label: 'Wipe', hint: 'A straight front crosses the layer', field: 'linear', angle: 0 },
  angled: { label: 'Angled wipe', hint: 'The front comes in on the diagonal', field: 'linear', angle: 45 },
  rise: { label: 'Rise', hint: 'From the bottom up', field: 'linear', angle: 270 },
  iris: { label: 'Iris', hint: 'Opens from the centre', field: 'radial', origin: [0.5, 0.5] },
  point: { label: 'From a point', hint: 'Grows out of a point you choose — a click, a cursor, a button', field: 'radial', origin: null },
  corner: { label: 'Corner bloom', hint: 'Grows out of the top-left corner', field: 'radial', origin: [0, 0] },
  dissolve: { label: 'Dissolve', hint: 'The texture alone decides — everywhere at once', field: 'none' },
  rain: { label: 'Rain', hint: 'Falls in long vertical streaks', field: 'linear', angle: 90, stretch: [24, 900] },
  curtain: { label: 'Curtain', hint: 'Slides in through long horizontal streaks', field: 'linear', angle: 0, stretch: [900, 24] }
};

/**
 * Materials: a bundle of warp + texture + edge (+ softness). noise.type 'block' and noise.fractal 'max' use Fractal
 * Noise's menus — see fxPlan.NOISE_MENU for where those values come from.
 */
const MATERIALS = {
  soft: { label: 'Soft light', hint: 'A clean feathered front', noise: { scale: 200, complexity: 3, contrast: 100, mix: 0, evo: 0.3 }, soft: 30 },
  glass: { label: 'Glass', hint: 'A slight refraction and a thin bright line', noise: { scale: 300, complexity: 4, contrast: 120, mix: 20, evo: 0.6 }, soft: 6, displace: { amount: 18, size: 200 }, edge: { lag: 0.06, glow: 30, intensity: 1.2, color: '#FFFFFF' } },
  liquid: { label: 'Liquid', hint: 'A soft, wobbling surface', noise: { scale: 200, complexity: 3, contrast: 140, mix: 45, evo: 1.2 }, soft: 10, displace: { amount: 80, size: 140 } },
  ink: { label: 'Ink', hint: 'Ragged, wet edges', noise: { scale: 240, complexity: 6, contrast: 220, mix: 75, evo: 0.8 }, soft: 14, displace: { amount: 28, size: 80 } },
  paper: { label: 'Paper', hint: 'A torn fibre edge with a thin white line', noise: { scale: 40, complexity: 9, contrast: 320, mix: 70, evo: 0.2 }, soft: 1, edge: { lag: 0.03, glow: 8, intensity: 1, color: '#FFFFFF' } },
  pixel: { label: 'Pixel', hint: 'Blocky digital noise with a coloured band', noise: { scale: 40, complexity: 2, contrast: 180, brightness: -35, mix: 70, evo: 2, type: 'block', fractal: 'max' }, soft: 2, edge: { lag: 0.06, glow: 16, intensity: 1.5 } },
  neon: { label: 'Neon', hint: 'A saturated glowing front', noise: { scale: 120, complexity: 4, contrast: 160, mix: 40, evo: 1.5 }, soft: 3, displace: { amount: 15, size: 60 }, edge: { lag: 0.06, glow: 40, intensity: 3 } },
  burn: { label: 'Burn', hint: 'An ember rim eats through', noise: { scale: 110, complexity: 7, contrast: 260, mix: 70, evo: 2 }, soft: 4, edge: { lag: 0.08, glow: 30, intensity: 2 } },
  smoke: { label: 'Smoke', hint: 'A wide, soft, drifting band', noise: { scale: 420, complexity: 3, contrast: 120, mix: 80, evo: 1.6 }, soft: 40, displace: { amount: 60, size: 200 } }
};

/** Motions: the Progress curve. Stepped = Posterize Time on the matte (frames per second). */
const MOTIONS = {
  impact: { label: 'Impact', hint: 'Fast at the start, settles', ease: 'expo' },
  smooth: { label: 'Smooth', hint: 'Eases in and out', ease: 'smooth' },
  snap: { label: 'Snap', hint: 'Quick and crisp', ease: 'snappy' },
  gentle: { label: 'Gentle', hint: 'Slow and calm', ease: 'gentle' },
  linear: { label: 'Linear', hint: 'Constant speed — scanners, loaders', ease: 'linear' },
  stepped: { label: 'Stepped', hint: 'Choppy 12 fps — glitch, retro', ease: 'smooth', stepped: 12 }
};

/** Palettes: the band's colour (materials with an edge; 'material' keeps the material's own). */
const PALETTES = {
  material: { label: 'Material colour', color: null },
  brand: { label: 'MOE orange', color: '#FF6A3D' },
  ice: { label: 'Ice', color: '#9FE3FF' },
  ember: { label: 'Ember', color: '#FF7A1A' },
  magenta: { label: 'Magenta', color: '#FF3BD4' },
  cyan: { label: 'Cyan', color: '#3BD5FF' },
  aurora: { label: 'Aurora', color: '#5CFFC4' },
  gold: { label: 'Gold', color: '#FFC857' }
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * One choice per axis → a spec in the shape fxPlan reads (like a PRESET). Intensity 0…100 (60 = the material as
 * designed) scales the noise mix, the warp and the glow together, so no combination breaks.
 */
function compose(a) {
  const S = SHAPES[a.shape] || SHAPES.sweep, M = MATERIALS[a.material] || MATERIALS.soft;
  const Mo = MOTIONS[a.motion] || MOTIONS.smooth, Pa = PALETTES[a.palette] || PALETTES.material;
  const k = clamp(a.intensity === undefined || a.intensity === '' ? 60 : Number(a.intensity), 0, 100) / 60;
  const noise = Object.assign({}, M.noise, { mix: clamp(Math.round(M.noise.mix * k), 0, 100) });
  if (S.stretch) Object.assign(noise, { stretch: S.stretch, mix: Math.max(noise.mix, 70) });
  const origin = S.origin || [clamp((a.originX === undefined ? 50 : Number(a.originX)) / 100, 0, 1), clamp((a.originY === undefined ? 50 : Number(a.originY)) / 100, 0, 1)];
  const edge = M.edge ? Object.assign({}, M.edge, { color: Pa.color || M.edge.color || '#FF6A3D', intensity: Math.round(M.edge.intensity * k * 100) / 100 }) : null;
  return {
    label: `${M.label} ${S.label}`, ramp: S.field, angle: S.angle || 0, origin: S.field === 'radial' ? origin : null,
    noise, soft: M.soft, displace: M.displace ? { amount: Math.round(M.displace.amount * k), size: M.displace.size } : null,
    edge, duration: 1, ease: Mo.ease, stepped: Mo.stepped || 0
  };
}

/** Seeded shuffle within the guardrails; `locks` keeps chosen axes ({ shape: true, … }). Deterministic per seed. */
function shuffle(current, seed, locks = {}) {
  let x = (Math.abs(Math.round(seed)) % 2147483646) + 1;
  const next = () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; };
  const pick = (o) => { const ks = Object.keys(o); return ks[Math.floor(next() * ks.length)]; };
  const out = Object.assign({}, current);
  for (const [axis, table] of [['shape', SHAPES], ['material', MATERIALS], ['motion', MOTIONS], ['palette', PALETTES]]) if (!locks[axis]) out[axis] = pick(table);
  return out;
}

const COUNT = Object.keys(SHAPES).length * Object.keys(MATERIALS).length * Object.keys(MOTIONS).length * Object.keys(PALETTES).length;

module.exports = { SHAPES, MATERIALS, MOTIONS, PALETTES, compose, shuffle, COUNT };
