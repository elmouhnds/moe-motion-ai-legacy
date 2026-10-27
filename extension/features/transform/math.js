'use strict';
/** Pure maths for Anchor, Align & Distribute and Clone (no host code; unit-tested). */

/** The nine anchor points as fractions of the content box. */
const POINTS = {
  tl: [0, 0], t: [0.5, 0], tr: [1, 0],
  l: [0, 0.5], c: [0.5, 0.5], r: [1, 0.5],
  bl: [0, 1], b: [0.5, 1], br: [1, 1]
};
const POINT_LABEL = { tl: 'Top left', t: 'Top', tr: 'Top right', l: 'Left', c: 'Centre', r: 'Right', bl: 'Bottom left', b: 'Bottom', br: 'Bottom right' };

/**
 * Align / distribute in comp space.
 * boxes: [{ layerId, box: [left, top, right, bottom] }]; mode: left|hcenter|right|top|vcenter|bottom|distH|distV;
 * to: 'selection' | 'comp'; comp: { width, height } → [{ layerId, delta: [dx, dy] }] (only layers that move).
 */
function align(boxes, mode, to, comp) {
  if (!boxes.length) return [];
  const L = Math.min(...boxes.map((b) => b.box[0])), T = Math.min(...boxes.map((b) => b.box[1]));
  const R = Math.max(...boxes.map((b) => b.box[2])), Bt = Math.max(...boxes.map((b) => b.box[3]));
  const ref = to === 'comp' ? { l: 0, t: 0, r: comp.width, b: comp.height } : { l: L, t: T, r: R, b: Bt };
  const cx = (b) => (b[0] + b[2]) / 2, cy = (b) => (b[1] + b[3]) / 2;
  let out;
  if (mode === 'distH' || mode === 'distV') {
    const h = mode === 'distH';
    const c = h ? cx : cy;
    const sorted = boxes.slice().sort((a, b) => c(a.box) - c(b.box));
    if (sorted.length < 3) return [];
    const first = c(sorted[0].box), last = c(sorted[sorted.length - 1].box);
    const step = (last - first) / (sorted.length - 1);
    out = sorted.map((b, i) => ({ layerId: b.layerId, delta: h ? [first + step * i - c(b.box), 0] : [0, first + step * i - c(b.box)] }));
  } else {
    const f = {
      left: (b) => [ref.l - b[0], 0], right: (b) => [ref.r - b[2], 0], hcenter: (b) => [(ref.l + ref.r) / 2 - cx(b), 0],
      top: (b) => [0, ref.t - b[1]], bottom: (b) => [0, ref.b - b[3]], vcenter: (b) => [0, (ref.t + ref.b) / 2 - cy(b)]
    }[mode];
    if (!f) throw new Error(`Unknown align mode ${mode}`);
    out = boxes.map((b) => ({ layerId: b.layerId, delta: f(b.box) }));
  }
  return out.filter((o) => Math.abs(o.delta[0]) > 1e-6 || Math.abs(o.delta[1]) > 1e-6).map((o) => ({ layerId: o.layerId, delta: [round(o.delta[0]), round(o.delta[1])] }));
}
const round = (v) => Math.round(v * 1000) / 1000;

/**
 * Clone layout: `count` items in total (the source is item 0).
 * mode 'radial': on a circle of `radius` around `center`, from `startAngle` over `arc` degrees (0° = up, clockwise);
 *   faceOut rotates each item by its angle. The source moves to item 0.
 * mode 'linear': each item `step` [dx, dy] further, plus rotation / scale / opacity steps. The source stays.
 * mode 'grid': `columns`, spacing [sx, sy] from the source. The source stays.
 * → { source: { position, rotation } | null, copies: [{ position, rotation, scale, opacity }] }
 */
function cloneLayout(o) {
  const n = Math.max(2, Math.round(o.count));
  const rot0 = o.rotation || 0;
  const items = [];
  if (o.mode === 'radial') {
    const arc = o.arc === undefined ? 360 : o.arc;
    const full = Math.abs(Math.abs(arc) - 360) < 1e-9;
    const stepA = arc / (full ? n : n - 1);
    const c = o.center;
    for (let i = 0; i < n; i++) {
      const a = (o.startAngle || 0) + stepA * i;
      const r = a * Math.PI / 180;
      items.push({ position: [round(c[0] + o.radius * Math.sin(r)), round(c[1] - o.radius * Math.cos(r))], rotation: round(o.faceOut ? rot0 + a : rot0), scale: 1, opacity: 100 });
    }
    return { source: { position: items[0].position, rotation: items[0].rotation }, copies: items.slice(1) };
  }
  const p0 = o.origin;
  for (let i = 1; i < n; i++) {
    let pos;
    if (o.mode === 'grid') {
      const cols = Math.max(1, Math.round(o.columns || 3));
      pos = [p0[0] + (i % cols) * o.spacing[0], p0[1] + Math.floor(i / cols) * o.spacing[1]];
    } else pos = [p0[0] + o.step[0] * i, p0[1] + o.step[1] * i];
    items.push({
      position: [round(pos[0]), round(pos[1])],
      rotation: round(rot0 + (o.rotationStep || 0) * i),
      scale: round(Math.max(0.01, 1 + ((o.scaleStep || 0) * i) / 100)),
      opacity: round(Math.min(100, Math.max(0, 100 - (o.opacityStep || 0) * i)))
    });
  }
  return { source: null, copies: items };
}

module.exports = { POINTS, POINT_LABEL, align, cloneLayout };
