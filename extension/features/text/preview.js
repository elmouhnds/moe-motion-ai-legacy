'use strict';
/**
 * Range Selector simulation for previews (approximation of AE's behaviour, for the
 * library only). amountAt(...) → 0 = normal text, 1 = full animator values.
 */

function bezierEase(t, outInfl, inInfl) {
  // Speed-0 bezier between two keys with the given influences (0..100) — sampled by bisection.
  const x1 = outInfl / 100;
  const x2 = 1 - inInfl / 100;
  const bx = (s) => 3 * (1 - s) ** 2 * s * x1 + 3 * (1 - s) * s ** 2 * x2 + s ** 3;
  const by = (s) => 3 * (1 - s) * s ** 2 + s ** 3; // y1 = 0, y2 = 1 (speed 0 at both keys)
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (bx(m) < t) lo = m; else hi = m; }
  return by((lo + hi) / 2);
}

/** Offset value (−100..100) at time t for a spec. */
function offsetAt(spec, t) {
  const [a, b] = spec.keys.list;
  if (t <= a.t) return a.v;
  if (t >= b.t) return b.v;
  const u = (t - a.t) / (b.t - a.t);
  return a.v + (b.v - a.v) * bezierEase(u, a.outInfl, b.inInfl);
}

function shaped(f, adv) {
  // Ease High / Low soften the top and bottom of the ramp.
  const s = f * f * (3 - 2 * f);
  const k = ((adv.easeHigh || 0) + (adv.easeLow || 0)) / 200;
  return f + (s - f) * k;
}

/** Selector amount (0..1) for unit i of n at offset o. */
function amountAt(adv, i, n, o, order) {
  const idx = order ? order[i] : i;
  const p = ((idx + 0.5) / n) * 100;
  const s = 0 + o;
  const e = 100 + o;
  const f = Math.min(1, Math.max(0, (p - s) / (e - s)));
  switch (adv.shape) {
    case 1: { // square with smoothness
      const edge = (adv.smoothness || 0) / 100 * 0.5;
      if (edge <= 0) return p >= s && p <= e ? 1 : 0;
      return p < s || p > e ? 0 : Math.min(1, (p - s) / (edge * 100 + 1e-6), (e - p) / (edge * 100 + 1e-6));
    }
    case 2: return 1 - shaped(1 - f, adv) > 1 ? 1 : (p < s ? 0 : p > e ? 1 : shaped(f, adv));
    case 3: return p < s ? 1 : p > e ? 0 : shaped(1 - f, adv);
    case 4: return p < s || p > e ? 0 : 1 - Math.abs(f * 2 - 1);
    default: return p < s || p > e ? 0 : Math.sin(Math.PI * f);
  }
}

/** Split text into units like the Range Selector's "Based On". */
function units(text, basedOn) {
  if (basedOn === 4) return text.split('\n').map((t) => ({ t, kind: 'line' }));
  if (basedOn === 3) return text.split(/(\s+)/).filter(Boolean).map((t) => ({ t, kind: /^\s+$/.test(t) ? 'space' : 'word' }));
  return Array.from(text).map((t) => ({ t, kind: t.trim() ? 'char' : 'space' }));
}

/** Deterministic shuffle for "Randomize Order". */
function order(n, seed = 7) {
  const a = Array.from({ length: n }, (_, i) => i);
  let s = seed;
  for (let i = n - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Per-unit state at time t: [{ text, amount }] where amount applies the animator props. */
function frame(spec, text, t) {
  const adv = spec.selector.advanced;
  const all = units(text, adv.basedOn);
  const counted = adv.basedOn === 2 || adv.basedOn === 3 ? all.filter((u) => u.kind !== 'space') : all;
  const n = Math.max(1, counted.length);
  const ord = adv.randomize ? order(n) : null;
  const o = offsetAt(spec, t);
  let k = 0;
  return all.map((u) => {
    if ((adv.basedOn === 2 || adv.basedOn === 3) && u.kind === 'space') return { text: u.t, amount: 0, space: true };
    const a = amountAt(adv, k++, n, o, ord);
    return { text: u.t, amount: a };
  });
}

module.exports = { frame, offsetAt, amountAt, units, bezierEase };
