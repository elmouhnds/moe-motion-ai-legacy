'use strict';
/**
 * Click VFX (v0.98, docs/features/CLICK_VFX.md) — the pure plan. From the study of the owner's Click VFX project file
 * (docs/research/CLICK_VFX_STUDY.md), rebuilt with native effects only: a pro click is a STACK — a growing ring, a
 * distortion, a glow, a colour pass — not one effect. Deep Glow (third-party in the reference) becomes After Effects'
 * Glow; Tritone becomes a Fill so one Colour control recolours everything.
 *
 * Every style is a few shape layers (ring / flash / second ring / disc) at the click point C, each keyed on its own
 * Transform (Scale 0 → 100 %, Opacity) and stroke width, with its effects. Times are relative to the click (t = 0).
 */
const PLAN = require('../quick/animatePlan');

const STYLES = {
  ripple: { label: 'Liquid Ripple', hint: 'A wobbling ring of light and a soft flash — the click ripple', color: '#FFFFFF', duration: 0.9 },
  neon: { label: 'Neon Ring', hint: 'Two neon rings chase each other out', color: '#FF3BD4', duration: 0.8 },
  burst: { label: 'Particle Burst', hint: 'A disc bursts into flying dots', color: '#3BD5FF', duration: 0.9 },
  pixel: { label: 'Pixel Ring', hint: 'A ring of chunky pixels', color: '#5CFFC4', duration: 0.8 }
};
const r2 = (v) => Math.round(v * 100) / 100;
const hex = (h) => { const s = String(h || '#ffffff').replace('#', ''); const n = parseInt(s, 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1]; };

/**
 * args: style, size (px radius of the ring at its widest), color (#hex, empty = the style's), duration, glow.
 * → { style, layers: [{ role, primitive, stroke, fill, delay, keys: { scale, opacity, strokeWidth? }, effects }], controls, end }
 */
function build(args) {
  const st = STYLES[args.style] ? args.style : 'ripple', S = STYLES[st];
  const R = Math.max(10, Number(args.size) || 160), dur = Number(args.duration) > 0 ? Number(args.duration) : S.duration;
  const color = hex(args.color || S.color), glow = Number(args.glow) > 0 ? Number(args.glow) : 30;
  const out = PLAN.easePair('expo'), sm = PLAN.easePair('smooth');
  const fill = { key: 'MOE Click Colour', matchName: 'ADBE Fill', params: [{ id: 'Color', value: color }] };
  const glowFx = (radius, intensity) => ({ key: 'MOE Click Glow', matchName: 'ADBE Glo2', params: [{ id: 'Glow Radius', value: radius }, { id: 'Glow Intensity', value: intensity }] });
  const ring = (role, delay, width, extra) => ({
    role, delay, primitive: { type: 'ellipse', size: [2 * R, 2 * R] }, stroke: { color: [1, 1, 1], width }, fill: null,
    keys: {
      scale: PLAN.keysFor(out, delay, dur * 0.8, [0, 0], [100, 100]),
      opacity: [{ t: delay, v: 100 }, { t: r2(delay + dur * 0.45), v: 100, easeOut: { speed: 0, influence: 33.33 } }, { t: r2(delay + dur), v: 0, easeIn: { speed: 0, influence: 60 } }],
      strokeWidth: PLAN.keysFor(sm, delay, dur, width, Math.max(0.5, width * 0.15))
    },
    effects: [fill].concat(extra || [])
  });
  let layers;
  if (st === 'ripple') {
    layers = [
      ring('Ring', 0, 10, [{ key: 'MOE Click Wobble', matchName: 'ADBE Turbulent Displace', params: [{ id: 'Amount', value: 40 }, { id: 'Size', value: 20 }, { id: 'Complexity', value: 2 }] }, { key: 'MOE Click Soften', matchName: 'ADBE Gaussian Blur 2', params: [{ id: 'Blurriness', value: 4 }] }, glowFx(glow, 1.5)]),
      { role: 'Flash', delay: 0, primitive: { type: 'ellipse', size: [1.2 * R, 1.2 * R] }, stroke: null, fill: { color: [1, 1, 1], opacity: 100 },
        keys: { scale: PLAN.keysFor(out, 0, dur * 0.5, [0, 0], [100, 100]), opacity: PLAN.keysFor(sm, 0, dur * 0.5, 35, 0) },
        effects: [fill, { key: 'MOE Click Soften', matchName: 'ADBE Gaussian Blur 2', params: [{ id: 'Blurriness', value: 30 }] }] }
    ];
  } else if (st === 'neon') {
    layers = [ring('Ring', 0, 6, [glowFx(glow + 10, 3)]), ring('Ring 2', 0.1, 4, [glowFx(glow, 2.5)])];
  } else if (st === 'burst') {
    layers = [{ role: 'Disc', delay: 0, primitive: { type: 'ellipse', size: [1.4 * R, 1.4 * R] }, stroke: null, fill: { color: [1, 1, 1], opacity: 100 },
      keys: { scale: PLAN.keysFor(out, 0, dur * 0.35, [0, 0], [100, 100]), opacity: [{ t: 0, v: 100 }, { t: r2(dur * 0.35), v: 100 }, { t: r2(dur), v: 0, easeIn: { speed: 0, influence: 60 } }],
        scatter: PLAN.keysFor(out, r2(dur * 0.25), dur * 0.75, 0, 160) },
      effects: [fill, { key: 'MOE Click Burst', matchName: 'CC Ball Action', params: [{ id: 'Grid Spacing', value: 8 }] }, glowFx(Math.round(glow * 0.6), 1.5)] }];
  } else {
    layers = [ring('Ring', 0, 18, [{ key: 'MOE Click Pixels', matchName: 'ADBE Mosaic', params: [{ id: 'Horizontal Blocks', value: 48 }, { id: 'Vertical Blocks', value: 27 }] }, glowFx(Math.round(glow * 0.7), 1.5)])];
  }
  // the controller: only the look-and-feel values (owner, v0.98)
  const controls = [
    { key: 'Size %', value: 100, link: { prop: 'ADBE Scale', expr: 'value * $ / 100' } },
    { key: 'Colour', color: true, value: color, link: { fx: 'MOE Click Colour', param: 'Color' } },
    { key: 'Glow', value: glow, link: { fx: 'MOE Click Glow', param: 'Glow Radius', expr: '$ * value / ' + glow } }
  ];
  if (st === 'ripple') controls.push({ key: 'Wobble', value: 40, link: { fx: 'MOE Click Wobble', param: 'Amount' } });
  if (st === 'pixel') controls.push({ key: 'Pixel Blocks', value: 48, link: { fx: 'MOE Click Pixels', param: 'Horizontal Blocks' } });
  return { style: st, label: S.label, R, layers, controls, end: r2(dur + Math.max(...layers.map((l) => l.delay))) };
}

module.exports = { STYLES, build };
