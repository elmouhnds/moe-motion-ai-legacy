'use strict';
/**
 * MOE Tracer (v0.91, docs/features/TRACER.md — React 3 study item 7): lines that connect a grid's items and follow
 * them, whatever moves them (the grid's own controls, effectors, a spring).
 *
 * One shape layer, "MOE Tracer · <grid>", with one path per line. Each path's expression builds its points from the
 * items' own comp positions: createPath([...], [], [], closed) (After Effects expression reference, Path Property).
 * The items are read by name with the // MOE tag, so the host adds each layer's permanent id (LINKS.md).
 *
 * Which items a line joins is decided ONCE, here, from where the items are when the tracer is made — pure and tested:
 *   order   one line through the items in their grid order (closed = back to the first)
 *   rows    one line per row, left to right
 *   grid    rows and columns
 *   zigzag  one line: row 1 left to right, row 2 right to left, …
 *   hub     a line from the item nearest the middle to every other item
 * Rows and columns are found from the measured positions (items within `tol` px of the same y / x), so it works for
 * any layout, any order and a honeycomb offset. Change the grid's Columns later → run Tracer again (it replaces itself).
 */
const MODES = [
  { id: 'order', label: 'In order', hint: 'One line through the items in the grid order' },
  { id: 'rows', label: 'Rows', hint: 'One line along each row' },
  { id: 'grid', label: 'Grid', hint: 'Lines along the rows and the columns' },
  { id: 'zigzag', label: 'Zig-zag', hint: 'One line that snakes row by row' },
  { id: 'hub', label: 'Hub', hint: 'From the middle item to every other item' }
];
const LIMITS = { paths: 200, points: 600 };
const TAG = '// MOE Tracer';

/** Groups of indices whose coordinate `ax` (0 x, 1 y) is the same within tol, ordered by that coordinate; each group sorted by the other axis. */
function bands(items, ax, tol) {
  const idx = items.map((_, i) => i).sort((a, b) => items[a].p[ax] - items[b].p[ax]);
  const out = [];
  for (const i of idx) {
    const last = out[out.length - 1];
    if (last && Math.abs(items[i].p[ax] - last.at) <= tol) { last.ids.push(i); last.at = (last.at * (last.ids.length - 1) + items[i].p[ax]) / last.ids.length; } else out.push({ at: items[i].p[ax], ids: [i] });
  }
  return out.map((b) => b.ids.sort((a, c) => items[a].p[1 - ax] - items[c].p[1 - ax]));
}

/**
 * The lines of a tracer. items: [{ name, p: [x, y] }] in grid order. Returns [{ names: [...], closed }] — a line has
 * at least two items.
 */
function lines(mode, items, { closed = false, tol = 2 } = {}) {
  const n = items.length, nm = (ids) => ids.map((i) => items[i].name);
  if (n < 2) return [];
  if (mode === 'rows') return bands(items, 1, tol).filter((r) => r.length > 1).map((r) => ({ names: nm(r), closed: false }));
  if (mode === 'grid') return bands(items, 1, tol).concat(bands(items, 0, tol)).filter((r) => r.length > 1).map((r) => ({ names: nm(r), closed: false }));
  if (mode === 'zigzag') { const rows = bands(items, 1, tol); return [{ names: nm(rows.reduce((acc, r, j) => acc.concat(j % 2 ? r.slice().reverse() : r), [])), closed: false }]; }
  if (mode === 'hub') {
    const cx = items.reduce((s, it) => s + it.p[0], 0) / n, cy = items.reduce((s, it) => s + it.p[1], 0) / n;
    let hub = 0, best = Infinity;
    items.forEach((it, i) => { const d = Math.hypot(it.p[0] - cx, it.p[1] - cy); if (d < best - 1e-9) { best = d; hub = i; } });
    return items.map((_, i) => i).filter((i) => i !== hub).map((i) => ({ names: [items[hub].name, items[i].name], closed: false }));
  }
  return [{ names: items.map((it) => it.name), closed: !!closed && n > 2 }];
}

/** How big a set of lines is, and whether it is within what one shape layer should carry. */
function size(ls) {
  const points = ls.reduce((s, l) => s + l.names.length, 0);
  return { paths: ls.length, points, ok: ls.length > 0 && ls.length <= LIMITS.paths && points <= LIMITS.points };
}

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
/** The Path expression of one line. Each point = the item's anchor in comp space, brought into the tracer layer's own space. */
function code(line, gridName) {
  return [
    `${TAG} · ${esc(gridName)}`,
    'var P = [], L, q;',
    ...line.names.map((nm) => `L = thisComp.layer("${esc(nm)}"); q = thisLayer.fromComp(L.toComp(L.anchorPoint)); P.push([q[0], q[1]]);`),
    `createPath(P, [], [], ${line.closed ? 'true' : 'false'});`
  ].join('\n');
}

module.exports = { MODES, LIMITS, TAG, bands, lines, size, code };
