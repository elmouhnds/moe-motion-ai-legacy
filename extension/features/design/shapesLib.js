'use strict';
/**
 * Shapes & Icons content:
 *  - ICONS: 1,899 Lucide icons (ISC licence, assets/icons/LICENSE-lucide.txt), loaded on first use.
 *  - PRIMITIVES: native After Effects parametric shapes (Rectangle / Ellipse / Polystar), which stay
 *    fully editable in AE (size, roundness, points, radii) instead of being frozen as paths.
 */

let DATA = null;
function data() {
  if (!DATA) DATA = require('../../assets/icons/lucide.json');
  return DATA;
}

function icon(name) { const d = data(); return d.icons[name] ? Object.assign({ name }, d.icons[name]) : null; }
function categories() { return data().categories; }
function count() { return data().count; }

const pretty = (name) => name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/* Shown first when browsing "All" without a search — the icons motion designers reach for most. */
const FEATURED = ['heart', 'star', 'sparkles', 'rocket', 'zap', 'flame', 'check', 'circle-check', 'x', 'play', 'pause', 'music', 'camera', 'video', 'mic',
  'map-pin', 'globe', 'phone', 'mail', 'message-circle', 'bell', 'gift', 'shopping-cart', 'shopping-bag', 'tag', 'wallet', 'credit-card', 'chart-line', 'trending-up', 'target',
  'trophy', 'award', 'crown', 'thumbs-up', 'smile', 'user', 'users', 'house', 'search', 'settings', 'calendar', 'clock', 'timer', 'cloud', 'sun', 'moon', 'umbrella', 'leaf',
  'arrow-right', 'arrow-up-right', 'chevron-right', 'move-right', 'download', 'upload', 'share-2', 'link', 'lock', 'shield-check', 'eye', 'lightbulb', 'palette', 'pen-tool',
  'wifi', 'battery-full', 'smartphone', 'laptop', 'monitor', 'cpu', 'coffee', 'pizza', 'car', 'plane', 'bike', 'ship', 'anchor', 'compass', 'mountain', 'trees', 'droplet', 'snowflake'];

/** Search icons by name / tags, optionally inside one category. Name-start matches rank first. */
function search(q, category, limit = 2000) {
  const d = data();
  q = String(q || '').trim().toLowerCase();
  if (!q && (!category || category === 'all')) {
    const feat = FEATURED.filter((n) => d.icons[n]);
    const set = new Set(feat);
    return feat.concat(Object.keys(d.icons).filter((n) => !set.has(n)).sort()).slice(0, limit);
  }
  const out = [];
  for (const [name, v] of Object.entries(d.icons)) {
    if (category && category !== 'all' && v.c !== category) continue;
    let score = 1;
    if (q) {
      const words = name.split('-');
      if (name === q) score = 100;
      else if (name.startsWith(q)) score = 50;
      else if (words.some((w) => w.startsWith(q))) score = 30;
      else if (name.includes(q)) score = 20;
      else if (v.t.some((t) => t.startsWith(q))) score = 10;
      else if (v.t.some((t) => t.includes(q))) score = 5;
      else continue;
    }
    out.push({ name, score });
  }
  out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return out.slice(0, limit).map((x) => x.name);
}

/* Native primitives. size = the shape's overall size in px; f = fractions of it. */
const PRIM = (id, label, type, spec, tags) => ({ id, label, type, spec, tags: tags || ['Basic'] });
const PRIMITIVES = [
  PRIM('square', 'Square', 'rect', { w: 1, h: 1, round: 0 }),
  PRIM('rounded', 'Rounded Square', 'rect', { w: 1, h: 1, round: 0.18 }),
  PRIM('card', 'Card', 'rect', { w: 1.6, h: 1, round: 0.08 }),
  PRIM('pill', 'Pill', 'rect', { w: 1.9, h: 0.62, round: 0.31 }),
  PRIM('bar', 'Bar', 'rect', { w: 2.4, h: 0.16, round: 0.08 }, ['Basic', 'Lines']),
  PRIM('circle', 'Circle', 'ellipse', { w: 1, h: 1 }),
  PRIM('oval', 'Oval', 'ellipse', { w: 1.5, h: 1 }),
  PRIM('ring', 'Ring', 'ellipse', { w: 1, h: 1, outline: true }),
  PRIM('triangle', 'Triangle', 'polygon', { points: 3, outer: 0.58 }, ['Polygons']),
  PRIM('softTriangle', 'Soft Triangle', 'polygon', { points: 3, outer: 0.58, outerRound: 30 }, ['Polygons']),
  PRIM('diamond', 'Diamond', 'polygon', { points: 4, outer: 0.55 }, ['Polygons']),
  PRIM('pentagon', 'Pentagon', 'polygon', { points: 5, outer: 0.52 }, ['Polygons']),
  PRIM('hexagon', 'Hexagon', 'polygon', { points: 6, outer: 0.5, rotation: 30 }, ['Polygons']),
  PRIM('octagon', 'Octagon', 'polygon', { points: 8, outer: 0.52, rotation: 22.5 }, ['Polygons']),
  PRIM('star', 'Star', 'star', { points: 5, outer: 0.52, inner: 0.22 }, ['Stars']),
  PRIM('softStar', 'Soft Star', 'star', { points: 5, outer: 0.52, inner: 0.26, outerRound: 18, innerRound: 30 }, ['Stars']),
  PRIM('star6', 'Star 6', 'star', { points: 6, outer: 0.52, inner: 0.3 }, ['Stars']),
  PRIM('sparkle', 'Sparkle', 'star', { points: 4, outer: 0.55, inner: 0.12 }, ['Stars']),
  PRIM('burst', 'Burst', 'star', { points: 12, outer: 0.52, inner: 0.4 }, ['Badges']),
  PRIM('seal', 'Seal', 'star', { points: 24, outer: 0.52, inner: 0.47 }, ['Badges']),
  PRIM('flower', 'Flower', 'star', { points: 8, outer: 0.52, inner: 0.36, outerRound: 90 }, ['Badges']),
  PRIM('blob', 'Blob', 'star', { points: 5, outer: 0.5, inner: 0.4, outerRound: 70, innerRound: 60 }, ['Badges'])
];
const primitive = (id) => PRIMITIVES.find((p) => p.id === id) || null;

/** Parametric spec for shapes.insert, sized in px. */
function primitiveSpec(p, size) {
  const s = p.spec;
  if (p.type === 'rect') return { type: 'rect', size: [s.w * size, s.h * size], roundness: s.round * size };
  if (p.type === 'ellipse') return { type: 'ellipse', size: [s.w * size, s.h * size] };
  return { type: p.type, points: s.points, outer: s.outer * size, inner: (s.inner || 0) * size, outerRound: s.outerRound || 0, innerRound: s.innerRound || 0, rotation: s.rotation || 0 };
}

module.exports = { data, icon, categories, count, search, pretty, PRIMITIVES, primitive, primitiveSpec, FEATURED };
