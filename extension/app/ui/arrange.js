'use strict';
/**
 * Arrangement (v0.43, docs/features/SMART_ARRANGE.md) — tools that belong together sit together, in every style.
 *
 * FAMILIES are tools an artist reaches for one after the other (Flip H / Flip V, Align H / V, Easy / Linear /
 * Hold, Reverse / Mirror / Clone keys, Fade In / Out …). Anywhere a list of buttons is shown:
 *   - `group(refs)` keeps the members of a family next to each other, at the place of the first one (stable);
 *   - `runs(refs)` cuts the list into runs (a family = one run) so a renderer can keep a run on one line;
 *   - `pack(items, cols)` places grid tiles in rows: order kept, a run never split over two rows, every row filled
 *     (the tiles of a short row grow) — no holes, so no tile can ever drift in from another group.
 * Pure — tests check every button list of the UI against FAMILIES (tests/arrange.test.js) and the browser audit
 * measures them on screen (tools/audit-arrange.js).
 */

/* Refs are written as they appear in the UI data ('quick:flipH', 'tile:animate/fadeIn'); Kit lists use bare ids. */
const FAMILIES = [
  ['Flip', ['quick:flipH', 'quick:flipV']],
  ['Align', ['quick:alignLeft', 'quick:alignH', 'quick:alignV', 'quick:compCentre']],
  ['Distribute', ['quick:distH', 'quick:distV']],
  ['Anchor', ['quick:anchorTL', 'quick:anchorC', 'quick:anchorB']],
  ['Interpolation', ['quick:k_easy', 'quick:k_linear', 'quick:k_hold']],
  ['Curves', ['quick:curveExpo', 'quick:curveBack']],
  ['Copy keys', ['quick:reverse', 'quick:mirror', 'quick:clone']],
  ['Loop', ['tile:expressions/x-loopCycle', 'tile:expressions/x-loopPingPong', 'tile:expressions/x-loopOffset', 'tile:expressions/x-loopInOut']],
  ['Fade', ['tile:animate/fadeIn', 'tile:animate/fadeOut']],
  ['Pop', ['tile:animate/popIn', 'tile:animate/popOut']],
  ['Trim', ['tile:animate/trimDraw', 'tile:animate/trimErase', 'tile:animate/trimTravel', 'tile:animate/trimBoth']],
  ['Parent', ['quick:parentNull', 'quick:k_parent']],
  ['Project', ['quick:revealProject', 'quick:openPrecomp']],
  ['Text', ['quick:typewriter', 'quick:counter']],
  ['Guides', ['tile:layout/g12', 'tile:layout/safe', 'tile:layout/thirds']],
  ['Zoom', ['tile:zoom/punch', 'tile:zoom/smooth']],
  ['Clean up', ['quick:k_bake', 'quick:k_trash']]
];

/** 'quick:flipH' / 'kit:flipH' / 'flipH' → one key. */
const norm = (r) => String(r).replace(/^(quick|kit):/, '');
const FAMILY_OF = new Map();
FAMILIES.forEach(([name, refs]) => refs.forEach((r, i) => FAMILY_OF.set(norm(r), { name, i })));
const familyOf = (ref) => FAMILY_OF.get(norm(ref)) || null;

/** Keep family members together at the place of the first one; inside a family, the family's own order. */
function group(refs) {
  const out = [], done = new Set();
  refs.forEach((r) => {
    if (done.has(r)) return;
    const f = familyOf(r);
    if (!f) { out.push(r); done.add(r); return; }
    refs.filter((x) => { const g = familyOf(x); return g && g.name === f.name && !done.has(x); })
      .sort((a, b) => familyOf(a).i - familyOf(b).i)
      .forEach((x) => { out.push(x); done.add(x); });
  });
  return out;
}

/** Consecutive refs of one family become one run: [['flipH','flipV'], ['separate'], …]. */
function runs(refs) {
  const out = [];
  refs.forEach((r) => {
    const f = familyOf(r), last = out[out.length - 1];
    if (f && last && familyOf(last[0]) && familyOf(last[0]).name === f.name) last.push(r); else out.push([r]);
  });
  return out;
}

/** Families whose members in `refs` are not next to each other: [{ family, refs, at }]. */
function splits(refs) {
  const bad = [];
  const seen = new Map();
  refs.forEach((r, i) => { const f = familyOf(r); if (f) { if (!seen.has(f.name)) seen.set(f.name, []); seen.get(f.name).push(i); } });
  for (const [name, at] of seen) if (at.length > 1 && at[at.length - 1] - at[0] !== at.length - 1) bad.push({ family: name, refs: at.map((i) => refs[i]), at });
  return bad;
}

/**
 * Grid placement. items: [{ key, w, run? }] (w = columns it wants; items sharing `run` stay in one row).
 * → [{ key, span, row }] with every row's spans summing to cols.
 */
function pack(items, cols) {
  const units = [];
  items.forEach((it) => {
    const w = Math.max(1, Math.min(cols, it.w || 1));
    const last = units[units.length - 1];
    if (it.run != null && last && last.run === it.run && last.w + w <= cols) { last.items.push({ key: it.key, w }); last.w += w; } else units.push({ run: it.run, w, items: [{ key: it.key, w }] });
  });
  const rows = [];
  let cur = [], used = 0;
  const close = () => { if (cur.length) rows.push(cur); cur = []; used = 0; };
  units.forEach((u) => { if (used + u.w > cols) close(); u.items.forEach((x) => cur.push(Object.assign({}, x))); used += u.w; });
  close();
  rows.forEach((row) => {
    let extra = cols - row.reduce((n, x) => n + x.w, 0);
    // a short row grows: the narrowest tiles first, from the end, so the widths stay even
    while (extra > 0) {
      const min = Math.min(...row.map((x) => x.w));
      for (let i = row.length - 1; i >= 0 && extra > 0; i--) if (row[i].w === min) { row[i].w++; extra--; }
    }
  });
  const out = [];
  rows.forEach((row, ri) => row.forEach((x) => out.push({ key: x.key, span: x.w, row: ri })));
  return out;
}

module.exports = { FAMILIES, familyOf, norm, group, runs, splits, pack };
