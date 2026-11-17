'use strict';
/**
 * Design space → the composition it is built in (v0.99.7, the owner's rule).
 *
 * Ready-made content — a template, a Product UI piece — is authored once on a reference frame and then has to land
 * in whatever composition the user has open. Before this, `templates.js` scaled every constant by the comp's
 * HEIGHT alone (`comp.height / 1080`). In a 16:9 comp that is right by accident, because the width follows the
 * height. Everywhere else it is wrong, and badly:
 *
 *   1080 x 1920 (9:16)   height scale = 1.78, so every size and gap grew 78 % while the frame stayed 1080 wide.
 *                        The Product UI cards came out 1103, 1139 and about 1400 px wide inside a 1080 px frame,
 *                        and the callout and chapter chains ran past the edge.
 *
 * CONTAIN fixes it with the rule a designer already expects: the design keeps its proportions and fits inside the
 * frame, so it meets the narrow side exactly.
 *
 *   s = min(W / Wref, H / Href)
 *
 * In 16:9 that is still 1, so nothing a user has today moves. In 1080 x 1920 it is 0.5625 — and 1920 x 0.5625 is
 * exactly 1080, so the design fills the width instead of bursting through it. In 1080 x 1080 the same. The result
 * is the same picture at every aspect ratio, which is the whole point: it has to look like the tile preview.
 *
 * Positions are kept as fractions of the frame by the plans themselves (W * 0.075 and so on) — those were already
 * relative and are left alone. What this module adds is the scale, the design rectangle those fractions sit in,
 * and a last clamp for anything that is measured rather than computed, because a measured box (a line of text that
 * came back wider than planned) is the one thing a fraction cannot predict.
 */

/** The frame every plan is authored on. */
const REF = { width: 1920, height: 1080 };

const sizeOf = (comp, ref) => ({
  w: comp && comp.width > 0 ? Number(comp.width) : ref.width,
  h: comp && comp.height > 0 ? Number(comp.height) : ref.height
});

/**
 * The contain scale for a comp. Everything a plan states in design pixels — a font size, a padding, a corner
 * radius, a card width — is multiplied by this.
 */
function scale(comp, ref) {
  const R = ref || REF;
  const { w, h } = sizeOf(comp, R);
  const s = Math.min(w / R.width, h / R.height);
  return s > 0 ? s : 1;
}

/**
 * Where the design rectangle sits inside the comp, centred: `{ x, y, w, h, s }` in comp pixels. A plan that wants
 * to stay inside the design's own frame (rather than the comp's) anchors to this.
 */
function box(comp, ref) {
  const R = ref || REF;
  const { w, h } = sizeOf(comp, R);
  const s = scale(comp, R);
  const bw = R.width * s, bh = R.height * s;
  return { x: (w - bw) / 2, y: (h - bh) / 2, w: bw, h: bh, s };
}

/** The nine places a piece can hold on to. */
const ANCHORS = {
  'top-left': [0, 0], top: [0.5, 0], 'top-right': [1, 0],
  left: [0, 0.5], centre: [0.5, 0.5], right: [1, 0.5],
  'bottom-left': [0, 1], bottom: [0.5, 1], 'bottom-right': [1, 1]
};

/**
 * A point authored in design space, placed in the comp by the anchor it holds on to. An element anchored
 * 'bottom-left' keeps its distance from the bottom-left corner at any aspect ratio instead of drifting towards
 * the middle, which is what made pieces look scattered.
 */
function place(point, anchor, comp, ref) {
  const R = ref || REF;
  const { w, h } = sizeOf(comp, R);
  const s = scale(comp, R);
  const a = ANCHORS[anchor] || ANCHORS.centre;
  // the point's offset from its anchor, in design pixels, scaled — then measured from the comp's own anchor
  const dx = Number(point[0]) - a[0] * R.width;
  const dy = Number(point[1]) - a[1] * R.height;
  return [a[0] * w + dx * s, a[1] * h + dy * s];
}

/**
 * Pull a box back inside the frame. `rect` is `[left, top, width, height]` in comp pixels; the answer says where
 * it should sit and whether it had to move, so a tool can report it instead of silently shipping a piece that
 * hangs off the edge. A box wider than the safe area is pinned to the left (or to the right in RTL) rather than
 * centred, because half of it off each side is worse than one clean edge.
 */
function clamp(rect, comp, opts) {
  const o = opts || {};
  const R = o.ref || REF;
  const { w, h } = sizeOf(comp, R);
  const m = o.margin === undefined ? 0 : Number(o.margin);
  const [x, y, bw, bh] = rect.map(Number);
  const minX = m, maxX = w - m - bw;
  const minY = m, maxY = h - m - bh;
  const nx = bw > w - 2 * m ? (o.rtl ? w - m - bw : m) : Math.min(Math.max(x, minX), maxX);
  const ny = bh > h - 2 * m ? m : Math.min(Math.max(y, minY), maxY);
  const moved = Math.abs(nx - x) > 0.5 || Math.abs(ny - y) > 0.5;
  return { x: nx, y: ny, moved, overflowX: bw > w - 2 * m, overflowY: bh > h - 2 * m };
}

module.exports = { REF, ANCHORS, scale, box, place, clamp };
