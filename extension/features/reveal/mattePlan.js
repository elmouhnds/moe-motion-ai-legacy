'use strict';
/**
 * Matte Reveal (v0.95, docs/features/MATTE_REVEAL.md) — the pure plan.
 *
 * A reveal is ONE shape layer used as the target layer's Alpha Track Matte. Its cells (one shape group each) live in
 * the TARGET's layer space: the matte layer is parented to the target with an identity transform, so a group's
 * Position is a point of the target's own layer (sourceRectAtTime coordinates) and the matte follows the target.
 *
 * Each cell is a rectangle or an ellipse, centred on (0, 0) in its group, placed by the group's Transform:
 *   comp point = Position + R(rotation) · (Scale / 100) · (content − Anchor)
 * The plan says the cells (size, roundness, anchor, rest position, rotation) and the keys of the properties that move
 * (group Scale, group Position, rectangle Roundness), relative to t = 0. The tool writes exactly these keys; the tile
 * preview draws them; `coverage()` measures how much of the layer a set of values shows — the tool's read-back
 * compares After Effects' values with the plan through it.
 */
const PLAN = require('../quick/animatePlan');

const DIRS = {
  left: { label: 'From the left', angle: 0 }, right: { label: 'From the right', angle: 180 },
  top: { label: 'From the top', angle: 90 }, bottom: { label: 'From the bottom', angle: 270 },
  topLeft: { label: 'Diagonal ↘', angle: 45 }, bottomLeft: { label: 'Diagonal ↗', angle: 315 },
  topRight: { label: 'Diagonal ↙', angle: 135 }, bottomRight: { label: 'Diagonal ↖', angle: 225 }
};
const CORNERS = { topLeft: [-1, -1], topRight: [1, -1], bottomLeft: [-1, 1], bottomRight: [1, 1] };
const ORDERS = { forward: 'In order', reverse: 'Reverse', center: 'From the centre', random: 'Random', diagonal: 'Diagonal' };

/** Styles. `cells` says whether the Count / Cascade / Order settings apply. */
const STYLES = {
  wipe: { label: 'Wipe', hint: 'One straight edge sweeps across — any side or a diagonal' },
  corner: { label: 'Corner', hint: 'Grows out of one corner' },
  split: { label: 'Split', hint: 'Opens from the middle line outward, like doors' },
  iris: { label: 'Iris', hint: 'A circle opens from the centre' },
  card: { label: 'Card', hint: 'A round pill grows into a rounded card' },
  blinds: { label: 'Blinds', hint: 'Bars wipe in one after the other', cells: true },
  stripes: { label: 'Stripes', hint: 'Bars slide in from alternate sides', cells: true },
  shutter: { label: 'Shutter', hint: 'Slats open from their own centres', cells: true },
  pixels: { label: 'Pixels', hint: 'A grid of blocks pops in', cells: true }
};
const LIMITS = { cells: 200, count: 40, cols: 16 };
const PAD = 1; // px of overlap past every edge, so no hairline of the layer shows at the end

const r4 = (v) => Math.round(v * 10000) / 10000;
const hash = (i, seed) => { const x = Math.sin(i * 12.9898 + (seed || 0) * 78.233) * 43758.5453; return x - Math.floor(x); };

/** Rank → delay share in 0…1 for n cells, by an order. */
function shares(n, order, centres, seed) {
  if (n <= 1) return [0];
  let key;
  if (order === 'reverse') key = centres.map((_, i) => n - 1 - i);
  else if (order === 'random') key = centres.map((_, i) => hash(i + 1, seed));
  else if (order === 'center') { const m = centres.reduce((s, c) => [s[0] + c[0] / n, s[1] + c[1] / n], [0, 0]); key = centres.map((c) => Math.hypot(c[0] - m[0], c[1] - m[1])); } else if (order === 'diagonal') key = centres.map((c) => c[0] + c[1]);
  else key = centres.map((_, i) => i);
  const lo = Math.min(...key), hi = Math.max(...key);
  return key.map((k) => (hi > lo ? (k - lo) / (hi - lo) : 0));
}

/** A straight sweep across rect [l, t, w, h] travelling along `deg` (0 = left → right, 90 = top → bottom). */
function sweepCell(rect, deg) {
  const [l, t, w, h] = rect, a = deg * Math.PI / 180, d = [Math.cos(a), Math.sin(a)], nn = [-Math.sin(a), Math.cos(a)];
  const corners = [[l, t], [l + w, t], [l, t + h], [l + w, t + h]];
  const p = corners.map((c) => c[0] * d[0] + c[1] * d[1]), q = corners.map((c) => c[0] * nn[0] + c[1] * nn[1]);
  const pmin = Math.min(...p) - PAD, pmax = Math.max(...p) + PAD, qmin = Math.min(...q) - PAD, qmax = Math.max(...q) + PAD;
  const L = pmax - pmin, Wd = qmax - qmin, qm = (qmin + qmax) / 2;
  return { kind: 'rect', size: [r4(L), r4(Wd)], roundness: 0, anchor: [r4(-L / 2), 0], position: [r4(d[0] * pmin + nn[0] * qm), r4(d[1] * pmin + nn[1] * qm)], rotation: deg };
}

/**
 * The plan for one layer whose content box (sourceRectAtTime) is `rect` = [left, top, width, height].
 * args: style, dir ('in' | 'out'), duration, ease, from (wipe), corner, axis ('h' | 'v'), count, cols, order,
 * cascade (0…0.9: how much the cells overlap in time), radius (card), seed.
 * → { cells: [{ name, kind, size, roundness, anchor, position, rotation, scale }], tracks: [{ cell, prop, keys }], end }
 */
function build(args, rect) {
  const st = STYLES[args.style] ? args.style : 'wipe';
  const [l, t, w, h] = rect, cx = l + w / 2, cy = t + h / 2;
  const dur = args.duration > 0 ? args.duration : 0.8;
  const e = PLAN.easePair(args.ease || 'smooth');
  const out = args.dir === 'out';
  const cells = [], moves = []; // moves: [cell, prop, hidden, shown]
  const W = w + 2 * PAD, H = h + 2 * PAD;
  const add = (c, prop, hidden, shown) => { c.name = `Cell ${cells.length + 1}`; c.scale = [100, 100]; cells.push(c); moves.push([cells.length - 1, prop, hidden, shown]); return cells.length - 1; };
  const n = Math.max(2, Math.min(LIMITS.count, Math.round(args.count) || 6));
  const horiz = args.axis !== 'v';
  if (st === 'wipe') {
    const c = sweepCell(rect, (DIRS[args.from] || DIRS.left).angle);
    add(c, 'scale', [0, 100], [100, 100]);
  } else if (st === 'corner') {
    const k = CORNERS[args.corner] || CORNERS.topLeft;
    add({ kind: 'rect', size: [r4(W), r4(H)], roundness: 0, anchor: [r4(k[0] * W / 2), r4(k[1] * H / 2)], position: [r4(cx + k[0] * W / 2), r4(cy + k[1] * H / 2)], rotation: 0 }, 'scale', [0, 0], [100, 100]);
  } else if (st === 'split') {
    add({ kind: 'rect', size: [r4(W), r4(H)], roundness: 0, anchor: [0, 0], position: [r4(cx), r4(cy)], rotation: 0 }, 'scale', horiz ? [0, 100] : [100, 0], [100, 100]);
  } else if (st === 'iris') {
    const D = Math.hypot(w, h) + 2 * PAD;
    add({ kind: 'ellipse', size: [r4(D), r4(D)], roundness: 0, anchor: [0, 0], position: [r4(cx), r4(cy)], rotation: 0 }, 'scale', [0, 0], [100, 100]);
  } else if (st === 'card') {
    const r = Math.max(0, Math.min(Math.min(W, H) / 2, args.radius === undefined ? 24 : args.radius));
    const i = add({ kind: 'rect', size: [r4(W), r4(H)], roundness: r4(r), anchor: [0, 0], position: [r4(cx), r4(cy)], rotation: 0 }, 'scale', [0, 0], [100, 100]);
    moves.push([i, 'roundness', r4(Math.min(W, H) / 2), r4(r)]);
  } else if (st === 'blinds' || st === 'stripes' || st === 'shutter') {
    // horizontal bars stacked top → bottom (axis h), or vertical bars left → right (axis v)
    for (let k = 0; k < n; k++) {
      const along = horiz ? h / n : w / n;
      const size = horiz ? [W, along + PAD] : [along + PAD, H];
      const mid = horiz ? [cx, t + (k + 0.5) * along] : [l + (k + 0.5) * along, cy];
      const flip = args.alternate && k % 2 === 1 ? -1 : 1;
      if (st === 'blinds') {
        const anchor = horiz ? [-flip * W / 2, 0] : [0, -flip * H / 2];
        const pos = horiz ? [cx - flip * W / 2, mid[1]] : [mid[0], cy - flip * H / 2];
        add({ kind: 'rect', size: size.map(r4), roundness: 0, anchor: anchor.map(r4), position: pos.map(r4), rotation: 0 }, 'scale', horiz ? [0, 100] : [100, 0], [100, 100]);
      } else if (st === 'shutter') {
        add({ kind: 'rect', size: size.map(r4), roundness: 0, anchor: [0, 0], position: mid.map(r4), rotation: 0 }, 'scale', horiz ? [100, 0] : [0, 100], [100, 100]);
      } else {
        const side = k % 2 === 0 ? -1 : 1, off = horiz ? [side * W, 0] : [0, side * H];
        add({ kind: 'rect', size: size.map(r4), roundness: 0, anchor: [0, 0], position: mid.map(r4), rotation: 0 }, 'position', [r4(mid[0] + off[0]), r4(mid[1] + off[1])], mid.map(r4));
      }
    }
  } else if (st === 'pixels') {
    const cols = Math.max(2, Math.min(LIMITS.cols, Math.round(args.cols) || 8));
    const rows = Math.max(1, Math.min(LIMITS.cols, Math.round(cols * h / Math.max(1, w))));
    const cw = w / cols, ch = h / rows;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      add({ kind: 'rect', size: [r4(cw + PAD), r4(ch + PAD)], roundness: 0, anchor: [0, 0], position: [r4(l + (i + 0.5) * cw), r4(t + (j + 0.5) * ch)], rotation: 0 }, 'scale', [0, 0], [100, 100]);
    }
  }
  if (cells.length > LIMITS.cells) throw Object.assign(new Error(`Too many cells (${cells.length}, max ${LIMITS.cells})`), { code: 'TOO_MANY' });
  // timing: one cell = the whole duration; many cells overlap by Cascade
  const multi = cells.length > 1;
  const cascade = multi ? Math.max(0, Math.min(0.9, args.cascade === undefined ? 0.5 : args.cascade)) : 0;
  const share = shares(cells.length, args.order || 'forward', cells.map((c) => c.position), args.seed);
  const each = dur * (1 - cascade);
  const tracks = moves.map(([ci, prop, hidden, shown]) => {
    const t0 = r4(share[ci] * dur * cascade);
    const [a, b] = out ? [shown, hidden] : [hidden, shown];
    return { cell: ci, prop, keys: PLAN.keysFor(e, t0, each, a, b) };
  });
  // the rest value of what moves is its first key (so the group is right before the first key too)
  for (const tr of tracks) cells[tr.cell][tr.prop] = tr.keys[0].v;
  return { style: st, cells, tracks, end: r4(dur) };
}

/** Values of every cell at time t (relative to the plan's start). */
function valuesAt(p, t) {
  return p.cells.map((c, i) => {
    const v = { scale: c.scale, position: c.position, roundness: c.roundness };
    for (const tr of p.tracks) if (tr.cell === i) v[tr.prop] = PLAN.valueAt(tr.keys, t);
    return v;
  });
}

/** Is layer point (x, y) inside cell c with values v? (rounded rectangles and ellipses, exact) */
function inside(c, v, x, y) {
  const s = v.scale || [100, 100], sx = s[0] / 100, sy = s[1] / 100;
  if (Math.abs(sx) < 1e-6 || Math.abs(sy) < 1e-6) return false;
  const P = v.position || c.position, a = -(c.rotation || 0) * Math.PI / 180;
  const dx = x - P[0], dy = y - P[1];
  const lx = (dx * Math.cos(a) - dy * Math.sin(a)) / sx + c.anchor[0], ly = (dx * Math.sin(a) + dy * Math.cos(a)) / sy + c.anchor[1];
  const hw = c.size[0] / 2, hh = c.size[1] / 2;
  if (c.kind === 'ellipse') return (lx * lx) / (hw * hw) + (ly * ly) / (hh * hh) <= 1;
  if (Math.abs(lx) > hw || Math.abs(ly) > hh) return false;
  const r = Math.min(Math.max(0, v.roundness === undefined ? c.roundness : v.roundness), hw, hh);
  if (r <= 0) return true;
  const qx = Math.max(Math.abs(lx) - (hw - r), 0), qy = Math.max(Math.abs(ly) - (hh - r), 0);
  return qx * qx + qy * qy <= r * r;
}

/** Share of the layer's box shown through the matte (0…1), sampled on an n × n grid of cell centres. */
function coverage(p, values, rect, n = 24) {
  const [l, t, w, h] = rect;
  let hit = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = l + (i + 0.5) * w / n, y = t + (j + 0.5) * h / n;
    if (p.cells.some((c, k) => inside(c, values[k], x, y))) hit++;
  }
  return hit / (n * n);
}

module.exports = { STYLES, DIRS, CORNERS, ORDERS, LIMITS, build, valuesAt, inside, coverage, sweepCell, shares };
