'use strict';
/**
 * Adapt planner (pure). Turns a measured composition into a per-layer plan for a
 * new frame size. Every element gets ONE uniform affine map  p' = s·p + d  that the
 * host applies to Position (all keyframes, tangents, ease speeds) and Scale — so every
 * animation is kept, only re-framed.
 *
 * Elements are top-level layers; a parent carries its children, so a group's box is
 * the union of its descendants. Roles:
 *   background  covers the frame              → cover-scale, centred
 *   band        full-width strip (lower third) → fit width, keep its edge
 *   pinned      small element near an edge/corner (logo, CTA, legal) → UI scale, same corner
 *   content     everything else               → UI scale, relative position, kept inside safe area;
 *                                                re-stacked when the orientation flips
 *   nested      full-frame pre-comp holding the layout → adapted inside (handled by the tool)
 *   point       a null without content        → position mapped, UI scale
 *   skip        camera / light / audio         → untouched
 */

const ZONES = { L: 'Left', C: 'Center', R: 'Right', T: 'Top', M: 'Middle', B: 'Bottom' };
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const area = (b) => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
const union = (a, b) => (!a ? b : !b ? a : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
const center = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
const mapBox = (b, s, d) => [b[0] * s + d[0], b[1] * s + d[1], b[2] * s + d[0], b[3] * s + d[1]];
const round = (v, n = 4) => Math.round(v * 10 ** n) / 10 ** n;

function zoneName(z) { return z === 'CM' ? 'Center' : `${ZONES[z[1]]}-${ZONES[z[0]]}`; }

/**
 * describe: layers.describe result. bounds: { [layerId]: { ref: box|null, union: box|null } }
 * Returns top-level elements with group boxes.
 */
function buildElements(describe, bounds) {
  const kids = new Map();
  for (const L of describe.layers) if (L.parentId) { if (!kids.has(L.parentId)) kids.set(L.parentId, []); kids.get(L.parentId).push(L); }
  const own = (L) => bounds[L.id] || { ref: null, union: null };
  const groupBox = (L, key, depth = 0) => {
    let b = ['camera', 'light'].includes(L.type) || L.hasVideo === false ? null : own(L)[key];
    if (L.type === 'null') b = null;
    if (depth < 12) for (const c of kids.get(L.id) || []) b = union(b, groupBox(c, key, depth + 1));
    return b;
  };
  const countDesc = (L) => (kids.get(L.id) || []).reduce((n, c) => n + 1 + countDesc(c), 0);
  return describe.layers.filter((L) => !L.parentId).map((L) => ({
    id: L.id, name: L.name, type: L.type, text: L.text, locked: L.locked, enabled: L.enabled, guide: L.guide,
    hasVideo: L.hasVideo !== false, threeD: L.threeD, posExpr: L.posExpr || L.scaleExpr, animated: L.animated,
    precomp: L.precomp, transform: L.transform, children: countDesc(L),
    ref: groupBox(L, 'ref'), union: groupBox(L, 'union')
  }));
}

function scales(src, dst) {
  const sx = dst.width / src.width, sy = dst.height / src.height;
  const sFit = Math.min(sx, sy), sFill = Math.max(sx, sy);
  const sShort = Math.min(dst.width, dst.height) / Math.min(src.width, src.height);
  const sUI = clamp(Math.sqrt(sx * sy), Math.min(sFit, sShort), Math.max(sFit, sShort));
  return { sx, sy, sFit, sFill, sShort, sUI };
}

function orientation(w, h) { return w > h * 1.15 ? 'landscape' : h > w * 1.15 ? 'portrait' : 'square'; }

function identityPlaced(el, src) {
  const t = el.transform;
  if (!t || !t.position) return false;
  const near = (a, b) => Math.abs(a - b) < 0.5;
  return near(t.anchor[0], t.position[0]) && near(t.anchor[1], t.position[1]) && near(t.scale[0], 100) && near(t.scale[1], 100) && near(t.rotation, 0) &&
    near(t.anchor[0], src.width / 2) && near(t.anchor[1], src.height / 2);
}

function classify(el, src, opts) {
  if (['camera', 'light'].includes(el.type)) return { role: 'skip', reason: `${el.type} layer` };
  if (!el.hasVideo && el.type !== 'null') return { role: 'skip', reason: 'audio only' };
  const b = el.ref || el.union;
  if (!b) return { role: 'point', zone: 'CM', reason: 'no visible content (null / controller)' };
  const w = src.width, h = src.height;
  const inter = [Math.max(b[0], 0), Math.max(b[1], 0), Math.min(b[2], w), Math.min(b[3], h)];
  const cover = area(inter) / (w * h);
  const bw = b[2] - b[0], bh = b[3] - b[1];
  const [cx, cy] = center(b);
  const zone = (cy < h / 3 ? 'T' : cy > (2 * h) / 3 ? 'B' : 'M') + (cx < w / 3 ? 'L' : cx > (2 * w) / 3 ? 'R' : 'C');
  if (cover >= 0.8 || (bw >= 0.95 * w && bh >= 0.95 * h)) {
    if (opts.nested !== false && el.precomp && el.precomp.numLayers >= 2 && Math.abs(el.precomp.width - w) < 1 && Math.abs(el.precomp.height - h) < 1 && identityPlaced(el, src) && !el.animated) {
      return { role: 'nested', zone: 'CM', reason: 'full-frame pre-comp — adapted inside' };
    }
    return { role: 'background', zone: 'CM', reason: `covers ${Math.round(cover * 100)}% of the frame` };
  }
  if (bw >= 0.85 * w && bh <= 0.35 * h) return { role: 'band', zone: zone[0] + 'C', reason: 'full-width strip' };
  const ratio = (bw * bh) / (w * h);
  // Pinned = small AND hugging the edge(s) of its zone (logo, CTA, legal, page number).
  const edgeX = zone[1] === 'L' ? b[0] / w : zone[1] === 'R' ? (w - b[2]) / w : 0;
  const edgeY = zone[0] === 'T' ? b[1] / h : zone[0] === 'B' ? (h - b[3]) / h : 0;
  if (ratio <= 0.03 && zone !== 'MC' && edgeX <= 0.12 && edgeY <= 0.12) return { role: 'pinned', zone, reason: `small element at the ${zoneName(zone).toLowerCase()} edge` };
  return { role: 'content', zone, reason: `${Math.round(ratio * 100)}% of the frame` };
}

/** Map an element by zone anchoring: X/Y reference = edge or centre. */
function anchorMap(b, s, zone, src, dst, S, safe) {
  const [cx, cy] = center(b);
  let dx, dy;
  if (zone[1] === 'L') dx = b[0] * S.sUI - s * b[0];
  else if (zone[1] === 'R') dx = (dst.width - (src.width - b[2]) * S.sUI) - s * b[2];
  else dx = (dst.width / 2 + (cx - src.width / 2) * S.sx) - s * cx;
  if (zone[0] === 'T') dy = b[1] * S.sUI - s * b[1];
  else if (zone[0] === 'B') dy = (dst.height - (src.height - b[3]) * S.sUI) - s * b[3];
  else dy = (dst.height / 2 + (cy - src.height / 2) * S.sy) - s * cy;
  return keepInside(b, s, [dx, dy], safe);
}

/** Shift so the mapped box stays inside the safe area (when it fits). */
function keepInside(b, s, d, safe) {
  const n = mapBox(b, s, d);
  let [dx, dy] = d;
  if (n[2] - n[0] <= safe[2] - safe[0]) { if (n[0] < safe[0]) dx += safe[0] - n[0]; else if (n[2] > safe[2]) dx -= n[2] - safe[2]; }
  if (n[3] - n[1] <= safe[3] - safe[1]) { if (n[1] < safe[1]) dy += safe[1] - n[1]; else if (n[3] > safe[3]) dy -= n[3] - safe[3]; }
  return [dx, dy];
}

/**
 * plan({ src: {width,height}, dst: {width,height}, elements, method: 'smart'|'fit'|'fill'|'keep',
 *        margin (0..0.2), reflow: 'auto'|'off', strategy: 'direct'|'rig', overrides: { [id]: { role, zone, scale, center:[nx,ny] } } })
 */
function plan({ src, dst, elements, method = 'smart', margin = 0.05, reflow = 'auto', strategy = 'direct', overrides = {}, nested = true }) {
  const S = scales(src, dst);
  const m = margin * Math.min(dst.width, dst.height);
  const safe = [m, m, dst.width - m, dst.height - m];
  const out = [];
  const warnings = [];

  if (method !== 'smart') {
    const s = method === 'fit' ? S.sFit : method === 'fill' ? S.sFill : 1;
    const d = [(dst.width - s * src.width) / 2, (dst.height - s * src.height) / 2];
    for (const el of elements) {
      const skip = ['camera', 'light'].includes(el.type) || (!el.hasVideo && el.type !== 'null');
      const b = el.ref || el.union;
      out.push({ layerId: el.id, name: el.name, role: skip ? 'skip' : 'layout', zone: 'CM', s: round(s, 6), d: d.map((v) => round(v, 3)), method: skip ? 'none' : strategy, rig: 'Layout', boxOld: b, boxNew: b && !skip ? mapBox(b, s, d) : null, reason: method === 'fit' ? 'fit whole frame' : method === 'fill' ? 'fill whole frame (crops)' : 'keep size, centred' });
    }
    if (elements.some((e) => ['camera', 'light'].includes(e.type))) warnings.push('Cameras and lights are not moved — check 3D framing in the new comp.');
    return { layers: out, warnings, scales: S, safe };
  }

  const cls = elements.map((el) => {
    const c = classify(el, src, { nested });
    const o = overrides[el.id] || {};
    return Object.assign({ el }, c, o.role ? { role: o.role, reason: 'set by you' } : {}, o.zone ? { zone: o.zone } : {}, { o });
  });

  // Pass 1: everything except re-stacked content.
  const flip = reflow !== 'off' && orientation(src.width, src.height) !== orientation(dst.width, dst.height) && orientation(dst.width, dst.height) !== 'square';
  const stack = flip ? cls.filter((c) => c.role === 'content' && !c.o.center && !c.o.zone && (c.el.ref || c.el.union)) : [];
  const flowAxis = orientation(dst.width, dst.height) === 'portrait' ? 'y' : 'x';
  const placed = [];

  for (const c of cls) {
    const el = c.el;
    const b = el.ref || el.union;
    let s, d;
    if (c.role === 'skip') { out.push(entry(el, c, 1, [0, 0], 'none', b, null)); continue; }
    if (c.role === 'nested') { out.push(entry(el, c, 1, [0, 0], 'none', b, [0, 0, dst.width, dst.height])); continue; }
    if (stack.includes(c)) continue;
    if (c.role === 'background') {
      s = S.sFill;
      d = [(dst.width - s * src.width) / 2, (dst.height - s * src.height) / 2];
    } else if (c.role === 'band') {
      s = c.o.scale || S.sx;
      const yRef = c.zone[0];
      const cy = center(b)[1];
      const dy = yRef === 'T' ? b[1] * S.sUI - s * b[1] : yRef === 'B' ? (dst.height - (src.height - b[3]) * S.sUI) - s * b[3] : (dst.height / 2 + (cy - src.height / 2) * S.sy) - s * cy;
      d = [(dst.width / 2 + (center(b)[0] - src.width / 2) * S.sx) - s * center(b)[0], dy];
    } else if (c.role === 'point') {
      const p = el.transform && el.transform.position ? el.transform.position : [src.width / 2, src.height / 2];
      s = c.o.scale || S.sUI;
      d = [dst.width / 2 + (p[0] - src.width / 2) * S.sx - s * p[0], dst.height / 2 + (p[1] - src.height / 2) * S.sy - s * p[1]];
    } else {
      const bw = b[2] - b[0], bh = b[3] - b[1];
      const fit = Math.min((safe[2] - safe[0]) / Math.max(bw, 1), (safe[3] - safe[1]) / Math.max(bh, 1));
      s = c.o.scale || Math.min(S.sUI, fit);
      if (c.o.center) {
        const [cx, cy] = center(b);
        d = keepInside(b, s, [c.o.center[0] * dst.width - s * cx, c.o.center[1] * dst.height - s * cy], safe);
      } else d = anchorMap(b, s, c.zone, src, dst, S, safe);
    }
    const e = entry(el, c, s, d, strategy, b, b ? mapBox(b, s, d) : null);
    out.push(e);
    if (c.role === 'pinned' || c.role === 'band') placed.push(e);
  }

  // Pass 2: re-stack content when the orientation flips (landscape ↔ portrait).
  if (stack.length) {
    const items = stack.map((c) => ({ c, b: c.el.ref || c.el.union })).sort((a, b) => (flowAxis === 'y' ? (a.b[0] - b.b[0]) || (a.b[1] - b.b[1]) : (a.b[1] - b.b[1]) || (a.b[0] - b.b[0])));
    let lo = flowAxis === 'y' ? safe[1] : safe[0];
    let hi = flowAxis === 'y' ? safe[3] : safe[2];
    const gap = 0.035 * (flowAxis === 'y' ? dst.height : dst.width);
    for (const p of placed) {
      if (!p.boxNew) continue;
      if (flowAxis === 'y') { if (p.zone[0] === 'T') lo = Math.max(lo, p.boxNew[3] + gap); if (p.zone[0] === 'B') hi = Math.min(hi, p.boxNew[1] - gap); }
      else { if (p.zone[1] === 'L') lo = Math.max(lo, p.boxNew[2] + gap); if (p.zone[1] === 'R') hi = Math.min(hi, p.boxNew[0] - gap); }
    }
    if (hi - lo < (flowAxis === 'y' ? dst.height : dst.width) * 0.3) { lo = flowAxis === 'y' ? safe[1] : safe[0]; hi = flowAxis === 'y' ? safe[3] : safe[2]; warnings.push('Not enough room between pinned elements — content uses the whole safe area.'); }
    const cross = flowAxis === 'y' ? safe[2] - safe[0] : safe[3] - safe[1];
    const sizes = items.map(({ b }) => {
      const along = flowAxis === 'y' ? b[3] - b[1] : b[2] - b[0];
      const across = flowAxis === 'y' ? b[2] - b[0] : b[3] - b[1];
      const s = Math.min(S.sUI, cross / Math.max(across, 1));
      return { s, along: along * s };
    });
    const total = sizes.reduce((n, z) => n + z.along, 0) + gap * (items.length - 1);
    const k = Math.min(1, (hi - lo) / Math.max(total, 1));
    let cursor = lo + ((hi - lo) - total * k) / 2;
    items.forEach(({ c, b }, i) => {
      const s = sizes[i].s * k;
      const [cx, cy] = center(b);
      const mid = cursor + (sizes[i].along * k) / 2;
      const d = flowAxis === 'y' ? [dst.width / 2 - s * cx, mid - s * cy] : [mid - s * cx, dst.height / 2 - s * cy];
      cursor += sizes[i].along * k + gap * k;
      out.push(entry(c.el, Object.assign({}, c, { reason: `${c.reason} · re-stacked ${flowAxis === 'y' ? 'vertically' : 'horizontally'} (#${i + 1})` }), s, d, strategy, b, mapBox(b, s, d)));
    });
  }

  // Overlap warnings between foreground elements.
  const fg = out.filter((e) => e.boxNew && ['pinned', 'content', 'band'].includes(e.role));
  for (let i = 0; i < fg.length; i++) for (let j = i + 1; j < fg.length; j++) {
    const a = fg[i].boxNew, b = fg[j].boxNew;
    const ov = area([Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]);
    if (ov > 0.25 * Math.min(area(a), area(b))) warnings.push(`"${fg[i].name}" overlaps "${fg[j].name}" — adjust one of them (role, zone or scale).`);
  }
  if (elements.some((e) => e.threeD)) warnings.push('3D layers are re-framed in X/Y; Z and cameras are kept — check depth framing.');
  const order = new Map(elements.map((e, i) => [e.id, i]));
  out.sort((a, b) => order.get(a.layerId) - order.get(b.layerId));
  return { layers: out, warnings, scales: S, safe };

  function entry(el, c, s, d, meth, bOld, bNew) {
    return { layerId: el.id, name: el.name, role: c.role, zone: c.zone || 'CM', s: round(s, 6), d: d.map((v) => round(v, 3)), method: c.role === 'skip' || c.role === 'nested' ? 'none' : meth, rig: c.role === 'background' ? 'Background' : c.role === 'band' ? 'Band' : zoneName(c.zone || 'CM'), boxOld: bOld, boxNew: bNew, reason: c.reason, locked: el.locked };
  }
}

module.exports = { plan, classify, buildElements, scales, orientation, mapBox, center, union, zoneName, ZONES };
