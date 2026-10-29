'use strict';
/**
 * Draws a "MOE Background" frame on a canvas (v0.18): the Inspector preview and the hovered palette
 * tiles use it. Same palette, same geometry (design.backgroundPlan) and the same motion maths as
 * the expressions (bgMotion.pointAt / colorAt), so what moves here is what moves in AE.
 * The 4-Colour mesh is drawn by inverse-distance blending on a small grid, scaled up.
 */
const BM = require('../../features/design/bgMotion');
const BG_DEFAULTS = { palette: 'tomato', style: 'linear', from: 0, to: 2, angle: 135, spread: 100, grain: 0, motion: 'none', colorMotion: 'none', loop: 8, amount: 40, colourAmount: 100 };
/** a = background args (merged with BG_DEFAULTS by the caller), comp = { width, height }, t = seconds; dots = draw the moving points. */
const D = require('../../features/design/tools');
const PALS = require('../../features/design/palettes');
const Bn = require('../../features/brand/brands');
// The plan and palette only change when the args do: computed once, not on every frame.
const memo = new Map();
function planFor(a, comp) {
  const key = `${a.palette}|${a.style}|${a.from}|${a.to}|${a.angle}|${a.spread}|${a.motion}|${a.colorMotion}|${a.drift}|${comp.width}x${comp.height}`;
  let m = memo.get(key);
  if (!m) {
    if (memo.size > 200) memo.clear();
    m = { plan: D.backgroundPlan(a, comp), P: PALS.byId(a.palette).colors.map((hx) => Bn.hexToRgb(hx).concat([1])) };
    memo.set(key, m);
  }
  return m;
}
/** Does this background move at all? (Still + Still → draw once, no animation loop needed.) */
function moves(a) { return (a.motion && a.motion !== 'none') || (a.colorMotion && a.colorMotion !== 'none') || !!a.drift; }
function bgFrame(c, W, H, a, comp, t, dots = true) {
  const { plan, P } = planFor(a, comp);
  const k = Math.min(W / comp.width, H / comp.height), ox = (W - comp.width * k) / 2, oy = (H - comp.height * k) / 2;
  const mo = { loop: a.loop, amount: a.amount, w: comp.width, h: comp.height };
  const pts = plan.bases.map((b, i) => BM.pointAt(plan.motion, b, i, plan.bases.length, t, mo)).map((q) => [ox + q[0] * k, oy + q[1] * k]);
  const cols = plan.slots.map((sl, i) => { const other = plan.slots.find((x) => x.id === sl.other); return BM.colorAt(plan.colorMotion, { i, n: plan.slots.length, idx: sl.idx, P, own: P[sl.idx], other: P[other.idx] }, t, { loop: a.loop, colour: a.colourAmount }); });
  const css = (q) => `rgb(${Math.round(q[0] * 255)},${Math.round(q[1] * 255)},${Math.round(q[2] * 255)})`;
  c.save(); c.beginPath(); c.rect(ox, oy, comp.width * k, comp.height * k); c.clip();
  if (a.style === 'solid' || !cols.length) { c.fillStyle = plan.base; c.fillRect(ox, oy, comp.width * k, comp.height * k); }
  else if (a.style === 'mesh') {
    const gw = 64, gh = Math.max(8, Math.round(64 * comp.height / comp.width));
    const off = bgFrame.off || (bgFrame.off = document.createElement('canvas'));
    off.width = gw; off.height = gh;
    const oc = off.getContext('2d'), img = oc.createImageData(gw, gh);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const px = ox + (x + 0.5) / gw * comp.width * k, py = oy + (y + 0.5) / gh * comp.height * k;
      let sw = 0; const acc = [0, 0, 0];
      pts.forEach((q, i) => { const d2 = (px - q[0]) ** 2 + (py - q[1]) ** 2 + 1; const w = 1 / (d2 * d2); sw += w; for (let j = 0; j < 3; j++) acc[j] += cols[i][j] * w; });
      const o = (y * gw + x) * 4; img.data[o] = acc[0] / sw * 255; img.data[o + 1] = acc[1] / sw * 255; img.data[o + 2] = acc[2] / sw * 255; img.data[o + 3] = 255;
    }
    oc.putImageData(img, 0, 0);
    c.imageSmoothingEnabled = true; c.drawImage(off, ox, oy, comp.width * k, comp.height * k);
  } else {
    const [s0, e0] = pts;
    const g = a.style === 'radial' ? c.createRadialGradient(s0[0], s0[1], 0, s0[0], s0[1], Math.max(1, Math.hypot(e0[0] - s0[0], e0[1] - s0[1]))) : c.createLinearGradient(s0[0], s0[1], e0[0], e0[1]);
    g.addColorStop(0, css(cols[0])); g.addColorStop(1, css(cols[1]));
    c.fillStyle = g; c.fillRect(ox, oy, comp.width * k, comp.height * k);
  }
  if (dots && plan.motion !== 'none') pts.forEach((q) => { c.beginPath(); c.arc(q[0], q[1], 3.5, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.9)'; c.fill(); c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,0.45)'; c.stroke(); });
  c.restore();
}

module.exports = { bgFrame, BG_DEFAULTS, moves };
