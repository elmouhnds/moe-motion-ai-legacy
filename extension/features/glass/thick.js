'use strict';
/**
 * Thick Glass (v0.27, docs/features/THICK_GLASS.md) — Glaze-class refractive glass from native effects.
 *
 * Every setup lives in comp space and reads ONE height map, so the glass follows the shape exactly:
 *   MOE Glass N Map         hidden pre-comp: white copy of the source(s), linked live by expressions
 *                           (transform through toComp, shapes / masks / text by property index)
 *   MOE Glass N             adjustment, matte = Map · Frost (blur) → CC Glass refraction (Bump Map = Map,
 *                           Softness = bevel, Height = thickness, Displacement = refraction) → Tint → Brightness
 *   MOE Glass N Prism R/B   adjustments, Lighten · the refracted image scaled ±% about the glass centre,
 *                           one channel kept (lateral chromatic dispersion)
 *   MOE Glass N Reflect     solid · studio gradient along the light → CC Glass warp → blur (chrome / mirror)
 *   MOE Glass N Highlights  black solid, Screen · CC Glass light: specular + edge light (studio light)
 *   MOE Glass N Shadow      linked copy below · black, soft, offset away from the light
 *   MOE Glass N Caustic     linked copy below · light colour, choked + blurred core, Add (light focused by the glass)
 * All amounts are controls on "MOE Glass N" (Effect Controls), animatable; the layers only read them.
 * Pure helpers here are tested (tests/glass.thick.test.js); the tool lives in tools.js.
 */
const { hexToRgb } = require('../brand/brands');

const TAG = '// MOE Glass';
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/* Looks. Values are the effects' own units (CC Glass Softness / Height / Displacement, blur px, %). */
const BASE = { thickness: 60, bevel: 18, refraction: 80, frost: 0, dispersion: 20, tint: '#FFFFFF', tintAmount: 0, brightness: 4,
  highlights: 85, roughness: 12, edgeLight: 25, angle: -45, lightHeight: 45, lightColor: '#FFFFFF',
  reflection: 15, warp: 60, reflectionBlur: 2, shadow: 30, softness: 24, distance: 14, caustics: 35 };
const THICK_LOOKS = {
  glaze: { label: 'Thick Clear' },
  prism: { label: 'Prism', refraction: 110, dispersion: 75, highlights: 90, caustics: 55 },
  sugar: { label: 'Sugar Glass', frost: 16, refraction: 55, dispersion: 8, brightness: 10, highlights: 55, roughness: 32, reflection: 10, reflectionBlur: 10, caustics: 20 },
  bubble: { label: 'Bubble', thickness: 40, bevel: 42, refraction: 95, dispersion: 35, highlights: 95, roughness: 8, edgeLight: 40, reflection: 25, warp: 80 },
  arctic: { label: 'Arctic Ice', frost: 9, tint: '#CFEFFF', tintAmount: 22, brightness: 12, bevel: 24, dispersion: 12, roughness: 22, lightColor: '#EAF8FF', caustics: 30 },
  chrome: { label: 'Chrome', refraction: 8, dispersion: 0, highlights: 100, roughness: 7, edgeLight: 50, reflection: 100, warp: 95, reflectionBlur: 0, shadow: 40, caustics: 0 },
  gold: { label: 'Liquid Gold', refraction: 8, dispersion: 0, tint: '#FFC75A', tintAmount: 70, highlights: 100, roughness: 9, edgeLight: 45, lightColor: '#FFE3A1', reflection: 92, warp: 90, reflectionBlur: 1, shadow: 40, caustics: 45 }
};

/* [control name, kind, value key] — order = Effect Controls order. */
const THICK_CONTROLS = [
  ['Glass Thickness', 'slider', 'thickness'], ['Glass Bevel', 'slider', 'bevel'], ['Glass Refraction', 'slider', 'refraction'],
  ['Glass Frost', 'slider', 'frost'], ['Glass Dispersion', 'slider', 'dispersion'],
  ['Glass Tint', 'color', 'tint'], ['Glass Tint Amount', 'slider', 'tintAmount'], ['Glass Brightness', 'slider', 'brightness'],
  ['Glass Highlights', 'slider', 'highlights'], ['Glass Highlight Size', 'slider', 'roughness'], ['Glass Edge Light', 'slider', 'edgeLight'],
  ['Glass Light Angle', 'angle', 'angle'], ['Glass Light Height', 'slider', 'lightHeight'], ['Glass Light Color', 'color', 'lightColor'],
  ['Glass Reflection', 'slider', 'reflection'], ['Glass Reflection Warp', 'slider', 'warp'], ['Glass Reflection Blur', 'slider', 'reflectionBlur'],
  ['Glass Shadow', 'slider', 'shadow'], ['Glass Shadow Softness', 'slider', 'softness'], ['Glass Shadow Distance', 'slider', 'distance'],
  ['Glass Caustics', 'slider', 'caustics']
];
const KIND = {
  slider: { matchName: 'ADBE Slider Control', param: 'Slider', type: 'OneD' },
  angle: { matchName: 'ADBE Angle Control', param: 'Angle', type: 'OneD' },
  color: { matchName: 'ADBE Color Control', param: 'Color', type: 'COLOR' }
};

/** Dispersion 100 = ±3 % magnification between red and blue (lateral chromatic aberration). */
const PRISM_SPREAD = 0.03;

function thickValues(look, tintHex) {
  const v = Object.assign({}, BASE, THICK_LOOKS[look] || {});
  delete v.label;
  if (tintHex) { v.tint = tintHex; if (!v.tintAmount) v.tintAmount = 25; }
  return v;
}

function controlItems(values) {
  return THICK_CONTROLS.map(([name, kind, key]) => {
    const K = KIND[kind];
    const value = kind === 'color' ? hexToRgb(values[key]).concat([1]) : values[key];
    return { key: name, matchName: K.matchName, before: [], params: [{ id: name, value, names: [K.param], suffix: 1, nth: { type: K.type, n: 1 } }] };
  });
}

/**
 * The map copy's transform, linked to the source in the main comp. 2D affine from toComp:
 * the copy's anchor sits where the source's anchor lands, rotation / scale from where two
 * 100 px steps land (a flipped source gives a negative Y scale with the rotation turned 180°).
 */
function mapTransform(compName, layerName) {
  const base = `comp("${esc(compName)}").layer("${esc(layerName)}")`;
  const head = `${TAG}\nvar L = ${base}; var a = L.transform.anchorPoint.value;`;
  const frame = `${head}\nvar o = L.toComp([a[0], a[1]]), u = L.toComp([a[0] + 100, a[1]]), w = L.toComp([a[0], a[1] + 100]);\nvar ex = [u[0] - o[0], u[1] - o[1]], ey = [w[0] - o[0], w[1] - o[1]];`;
  return {
    base,
    anchor: `${head}\n[a[0], a[1]];`,
    position: `${head}\nvar p = L.toComp([a[0], a[1]]);\n[p[0], p[1]];`,
    rotation: `${frame}\nMath.atan2(ex[1], ex[0]) * 180 / Math.PI;`,
    scale: `${frame}\nvar sx = Math.sqrt(ex[0] * ex[0] + ex[1] * ex[1]), sy = Math.sqrt(ey[0] * ey[0] + ey[1] * ey[1]);\n[sx, (ex[0] * ey[1] - ex[1] * ey[0]) < 0 ? -sy : sy];`,
    opacity: `${TAG}\n${base}.transform.opacity.value;`
  };
}

/** JS (expression) code that sets x0 y0 x1 y1 = comp-space bounds of the sources. */
function boundsCode(sourceNames) {
  const list = sourceNames.map((n) => `thisComp.layer("${esc(n)}")`).join(', ');
  return `var S = [${list}], x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;\n` +
    'for (var i = 0; i < S.length; i++) { var r = S[i].sourceRectAtTime(time, false);\n' +
    '  var q = [[r.left, r.top], [r.left + r.width, r.top], [r.left, r.top + r.height], [r.left + r.width, r.top + r.height]];\n' +
    '  for (var j = 0; j < 4; j++) { var p = S[i].toComp(q[j]); x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } }\n';
}

/** Expressions (pure) for one Thick Glass setup. Light angle: AE convention, 0° = up, clockwise. */
function thickExpressions(glassName, sourceNames, mapName) {
  const G = `thisComp.layer("${esc(glassName)}")`;
  const c = (n) => `${G}.effect("${n}")(1).value`;
  const clamp = (v, lo, hi) => `Math.min(Math.max(${v}, ${lo}), ${hi})`;
  const B = boundsCode(sourceNames);
  const center = `${TAG}\n${B}[(x0 + x1) / 2, (y0 + y1) / 2];`;
  const ramp = (sign) => `${TAG}\n${B}var a = ${c('Glass Light Angle')} * Math.PI / 180, R = Math.max(1, Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)) / 2);\n[(x0 + x1) / 2 ${sign} R * Math.sin(a), (y0 + y1) / 2 ${sign === '+' ? '-' : '+'} R * Math.cos(a)];`;
  const prismScale = (sign) => `${TAG}\n100 ${sign} ${clamp(c('Glass Dispersion'), 0, 100)} * ${PRISM_SPREAD * 100} / 100;`;
  const srcOpacity = (n, amount) => `${TAG}\n${amount} * thisComp.layer("${esc(n)}").transform.opacity.value / 100;`;
  const offset = (k) => `${TAG}\nvar a = (${c('Glass Light Angle')} + 90) * Math.PI / 180, d = ${c('Glass Shadow Distance')} * ${k};\nvalue.length > 2 ? [value[0] + d * Math.cos(a), value[1] + d * Math.sin(a), value[2]] : [value[0] + d * Math.cos(a), value[1] + d * Math.sin(a)];`;
  return {
    softness: `${TAG}\n${clamp(c('Glass Bevel'), 0, 100)};`,
    height: `${TAG}\n${clamp(c('Glass Thickness'), 0, 100)};`,
    displacement: `${TAG}\n${clamp(c('Glass Refraction'), -500, 500)};`,
    frost: `${TAG}\nMath.max(0, ${c('Glass Frost')});`,
    tintColor: `${TAG}\n${c('Glass Tint')};`,
    tintAmount: `${TAG}\n${clamp(c('Glass Tint Amount'), 0, 100)};`,
    brightness: `${TAG}\n${c('Glass Brightness')};`,
    center,
    prismUp: prismScale('+'),
    prismDown: prismScale('-'),
    prismOpacity: `${TAG}\n${c('Glass Dispersion')} > 0 ? 100 : 0;`,
    rampStart: ramp('+'),
    rampEnd: ramp('-'),
    lightColor: `${TAG}\n${c('Glass Light Color')};`,
    warp: `${TAG}\n${clamp(c('Glass Reflection Warp'), -500, 500)};`,
    reflectionBlur: `${TAG}\nMath.max(0, ${c('Glass Reflection Blur')});`,
    reflectionOpacity: `${TAG}\n${clamp(c('Glass Reflection'), 0, 100)};`,
    highlightsOpacity: `${TAG}\n${clamp(c('Glass Highlights'), 0, 100)};`,
    roughness: `${TAG}\n${clamp(c('Glass Highlight Size'), 0, 100)} * ${ROUGHNESS_PER_CENT};`,
    edgeLight: `${TAG}\n${clamp(c('Glass Edge Light'), 0, 100)};`,
    lightDirection: `${TAG}\n${c('Glass Light Angle')};`,
    lightHeight: `${TAG}\n${clamp(c('Glass Light Height'), 0, 100)};`,
    shadowOpacity: (n) => srcOpacity(n, clamp(c('Glass Shadow'), 0, 100)),
    shadowBlur: `${TAG}\nMath.max(0, ${c('Glass Shadow Softness')});`,
    shadowOffset: offset(1),
    causticOpacity: (n) => srcOpacity(n, clamp(c('Glass Caustics'), 0, 100)),
    causticChoke: `${TAG}\nMath.max(0, ${c('Glass Bevel')}) * 0.5;`,
    causticBlur: `${TAG}\nMath.max(0, ${c('Glass Shadow Softness')}) * 0.5;`,
    causticOffset: offset(0.6)
  };
}

/** Plain-JS reference of the prism scale (tests compare the evaluated expression with it). */
/**
 * v0.99.6 (Group 9 manual test, After Effects 26.5.3): CC Glass's **Roughness is 0.00099…0.5**, read from After
 * Effects' own effect profile (every other number this tool writes is on the scale it looks like: Ambient 0-200,
 * Diffuse 0-100, Specular 0-100, Light Intensity 0-1000, Light Height -100…100). "Glass Highlight Size" is a 0-100
 * control, so it is a percentage OF THAT RANGE. Writing it straight through made every Thick Glass tile fail with
 *   Value 12 out of range 0 to 0.5
 * and, had it got past that, the expression would have clamped every look to 0.5 - the dullest highlight there is.
 */
const ROUGHNESS_MAX = 0.5;
const ROUGHNESS_PER_CENT = ROUGHNESS_MAX / 100;
/** A 0-100 "Glass Highlight Size" as CC Glass's own Roughness. */
const roughnessAE = (v) => Math.round(Math.min(100, Math.max(0, Number(v) || 0)) * ROUGHNESS_PER_CENT * 1e6) / 1e6;

const prismScaleRef = (dispersion, sign) => 100 + sign * Math.min(Math.max(dispersion, 0), 100) * PRISM_SPREAD;

module.exports = { TAG, BASE, THICK_LOOKS, THICK_CONTROLS, KIND, PRISM_SPREAD, ROUGHNESS_MAX, roughnessAE, thickValues, controlItems, mapTransform, boundsCode, thickExpressions, prismScaleRef };
