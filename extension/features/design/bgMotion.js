'use strict';
/**
 * Animated backgrounds (v0.18): how the gradient points and the colours of a "MOE Background" move.
 *
 * Everything loops exactly: every motion is built from sin / cos of p = 2π·time / Loop (and whole
 * multiples of it), so frame 0 and frame Loop are the same picture — the layer can be any length.
 *
 * Three live controls on the background layer (Slider Controls, keyframeable):
 *   MOE BG Loop    seconds for one full loop
 *   MOE BG Amount  % how far the points travel (100 % = a quarter of the comp's short side)
 *   MOE BG Colour  % how much the colours change (0 = palette colours stay)
 *
 * The plain-JS functions below (pointAt, colorAt) are the reference; the expressions are generated
 * from the same constants, and tests evaluate them in the mock and compare.
 *
 * AE expression API used (documented, both expression engines): effect()("Slider"), time, value,
 * add(), Math.*, rgbToHsl(), hslToRgb() (Color Conversion methods). Vector maths uses add() — never
 * `array + array`, which the JavaScript engine treats as text.
 */
const TAG = '// MOE Background';
const FX = { loop: 'MOE BG Loop', amount: 'MOE BG Amount', colour: 'MOE BG Colour' };

const POINT_MOTIONS = [
  { id: 'none', label: 'Still', hint: 'The gradient stays where it is' },
  { id: 'drift', label: 'Drift', hint: 'Each colour point floats on its own slow figure-eight' },
  { id: 'orbit', label: 'Orbit', hint: 'Each colour point circles around its place' },
  { id: 'swirl', label: 'Swirl', hint: 'The whole gradient turns around the centre — one turn per loop' },
  { id: 'wave', label: 'Wave', hint: 'The points sway side to side, one after another' },
  { id: 'breathe', label: 'Breathe', hint: 'The points spread out and gather in, together' },
  { id: 'wander', label: 'Wander', hint: 'Smooth random-looking paths that still loop' }
];
const COLOR_MOTIONS = [
  { id: 'none', label: 'Still', hint: 'Colours stay as picked' },
  { id: 'cycle', label: 'Cycle', hint: 'Each colour steps through the palette, blending smoothly' },
  { id: 'swap', label: 'Swap', hint: 'The colours trade places and come back' },
  { id: 'hue', label: 'Hue', hint: 'The hue swings around the palette colour' },
  { id: 'pulse', label: 'Pulse', hint: 'The colours get lighter and darker, one after another' }
];

const TAU = 2 * Math.PI;
const r4 = (x) => Math.round(x * 1e4) / 1e4;
/** Fixed pseudo-random phases per point (baked into the expression as numbers). */
function seeds(i) {
  const out = [];
  for (let k = 1; k <= 6; k++) { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; out.push(r4((s - Math.floor(s)) * TAU)); }
  return out;
}
const reach = (w, h) => 0.25 * Math.min(w, h);
const phase = (i, n) => r4(i * TAU / Math.max(n, 1));

/** Where point i (of n) is at time t. base = its still position; o = { loop, amount (0–100), w, h }. */
function pointAt(motion, base, i, n, t, o) {
  const L = Math.max(o.loop, 0.1), A = o.amount / 100, p = TAU * t / L, R = A * reach(o.w, o.h), ph = phase(i, n);
  const cx = o.w / 2, cy = o.h / 2;
  switch (motion) {
    case 'drift': return [base[0] + R * Math.sin(p + ph), base[1] + 0.6 * R * Math.sin(2 * p + r4(1.7 * i))];
    case 'orbit': return [base[0] + R * Math.cos(p + ph), base[1] + R * Math.sin(p + ph)];
    case 'swirl': { const dx = base[0] - cx, dy = base[1] - cy, c = Math.cos(p), s = Math.sin(p); return [cx + dx * c - dy * s, cy + dx * s + dy * c]; }
    case 'wave': return [base[0] + R * Math.sin(p - ph), base[1] + 0.3 * R * Math.sin(2 * p - ph)];
    case 'breathe': { const k = 1 + 0.5 * A * Math.sin(p); return [cx + (base[0] - cx) * k, cy + (base[1] - cy) * k]; }
    case 'wander': {
      const s = seeds(i);
      return [base[0] + R * (0.55 * Math.sin(p + s[0]) + 0.3 * Math.sin(2 * p + s[1]) + 0.15 * Math.sin(3 * p + s[2])),
        base[1] + R * (0.55 * Math.cos(p + s[3]) + 0.3 * Math.sin(3 * p + s[4]) + 0.15 * Math.cos(2 * p + s[5]))];
    }
    default: return base.slice(0, 2);
  }
}

/** The expression for point i of n (same maths as pointAt). */
function pointExpression(motion, i, n, w, h) {
  const R0 = r4(reach(w, h)), ph = phase(i, n), cx = r4(w / 2), cy = r4(h / 2);
  const head = [`${TAG}: motion ${motion}`,
    `var L = Math.max(effect("${FX.loop}")("Slider"), 0.1), A = effect("${FX.amount}")("Slider") / 100;`,
    `var p = 2 * Math.PI * time / L, R = A * ${R0};`];
  let body;
  switch (motion) {
    case 'drift': body = `add(value, [R * Math.sin(p + ${ph}), 0.6 * R * Math.sin(2 * p + ${r4(1.7 * i)})]);`; break;
    case 'orbit': body = `add(value, [R * Math.cos(p + ${ph}), R * Math.sin(p + ${ph})]);`; break;
    case 'swirl': body = `var dx = value[0] - ${cx}, dy = value[1] - ${cy}, c = Math.cos(p), s = Math.sin(p);\n[${cx} + dx * c - dy * s, ${cy} + dx * s + dy * c];`; break;
    case 'wave': body = `add(value, [R * Math.sin(p - ${ph}), 0.3 * R * Math.sin(2 * p - ${ph})]);`; break;
    case 'breathe': body = `var k = 1 + 0.5 * A * Math.sin(p);\n[${cx} + (value[0] - ${cx}) * k, ${cy} + (value[1] - ${cy}) * k];`; break;
    case 'wander': {
      const s = seeds(i);
      body = `add(value, [R * (0.55 * Math.sin(p + ${s[0]}) + 0.3 * Math.sin(2 * p + ${s[1]}) + 0.15 * Math.sin(3 * p + ${s[2]})), R * (0.55 * Math.cos(p + ${s[3]}) + 0.3 * Math.sin(3 * p + ${s[4]}) + 0.15 * Math.cos(2 * p + ${s[5]}))]);`;
      break;
    }
    default: return null;
  }
  return head.concat(body).join('\n');
}

/* ---------- colours (0–1 RGBA, like AE colour properties) ---------- */
const mix = (a, b, f) => [0, 1, 2, 3].map((k) => a[k] + (b[k] - a[k]) * f);
const smooth = (f) => f * f * (3 - 2 * f);
/** RGB → HSL, all 0–1 — the same conversion as AE's rgbToHsl(). */
function rgbToHsl(c) {
  const r = c[0], g = c[1], b = c[2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let hh = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hh /= 6;
  }
  return [hh, s, l, c[3] === undefined ? 1 : c[3]];
}
/** HSL → RGB, all 0–1 — the same conversion as AE's hslToRgb(). */
function hslToRgb(c) {
  const hh = c[0], s = c[1], l = c[2];
  if (!s) return [l, l, l, c[3] === undefined ? 1 : c[3]];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = t - Math.floor(t); return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(hh + 1 / 3), f(hh), f(hh - 1 / 3), c[3] === undefined ? 1 : c[3]];
}

/**
 * Colour of slot i (of n) at time t. own = its palette colour, other = the colour it swaps with,
 * idx = its index in the palette, P = the palette (5 RGBA colours), o = { loop, colour (0–100) }.
 */
function colorAt(motion, s, t, o) {
  const L = Math.max(o.loop, 0.1), K = o.colour / 100, p = TAU * t / L, ph = phase(s.i, s.n);
  switch (motion) {
    case 'cycle': {
      const u = (((t / L) * 5) % 5 + 5) % 5, k = Math.floor(u), f = smooth(u - k);
      return mix(s.own, mix(s.P[(s.idx + k) % 5], s.P[(s.idx + k + 1) % 5], f), K);
    }
    case 'swap': return mix(s.own, s.other, (0.5 - 0.5 * Math.cos(p)) * K);
    case 'hue': { const q = rgbToHsl(s.own); q[0] = q[0] + 0.25 * K * Math.sin(p + ph); q[0] -= Math.floor(q[0]); return hslToRgb(q); }
    case 'pulse': { const q = rgbToHsl(s.own); q[2] = Math.min(Math.max(q[2] + 0.18 * K * Math.sin(p + ph), 0), 1); return hslToRgb(q); }
    default: return s.own.slice();
  }
}

const num = (c) => `[${c.map(r4).join(', ')}]`;
/** The expression for a colour slot (same maths as colorAt). */
function colorExpression(motion, s) {
  const ph = phase(s.i, s.n);
  const head = [`${TAG}: colour ${motion}`,
    `var L = Math.max(effect("${FX.loop}")("Slider"), 0.1), K = effect("${FX.colour}")("Slider") / 100;`,
    `var p = 2 * Math.PI * time / L, c = value;`,
    'function mix(a, b, f) { return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f]; }'];
  let body;
  switch (motion) {
    case 'cycle': body = [`var P = [${s.P.map(num).join(', ')}];`,
      'var u = ((time / L * 5) % 5 + 5) % 5, k = Math.floor(u), f = u - k;', 'f = f * f * (3 - 2 * f);',
      `mix(c, mix(P[(${s.idx} + k) % 5], P[(${s.idx} + k + 1) % 5], f), K);`]; break;
    case 'swap': body = [`mix(c, ${num(s.other)}, (0.5 - 0.5 * Math.cos(p)) * K);`]; break;
    case 'hue': body = ['var q = rgbToHsl(c);', `q[0] = q[0] + 0.25 * K * Math.sin(p + ${ph});`, 'q[0] = q[0] - Math.floor(q[0]);', 'hslToRgb(q);']; break;
    case 'pulse': body = ['var q = rgbToHsl(c);', `q[2] = Math.min(Math.max(q[2] + 0.18 * K * Math.sin(p + ${ph}), 0), 1);`, 'hslToRgb(q);']; break;
    default: return null;
  }
  return head.concat(body).join('\n');
}

const pointMotion = (id) => POINT_MOTIONS.find((m) => m.id === id) || POINT_MOTIONS[0];
const colorMotion = (id) => COLOR_MOTIONS.find((m) => m.id === id) || COLOR_MOTIONS[0];

module.exports = { TAG, FX, POINT_MOTIONS, COLOR_MOTIONS, pointAt, pointExpression, colorAt, colorExpression, rgbToHsl, hslToRgb, seeds, reach, pointMotion, colorMotion };
