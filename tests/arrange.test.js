'use strict';
/**
 * v0.43 — Smart Arrange (docs/features/SMART_ARRANGE.md): tools that belong together sit together in every style.
 * The pure engine (app/ui/arrange.js) and every button list of the UI data are checked here; the browser audit
 * (tools/audit-arrange.js) measures the same on screen in Bento, Glass and MOE at several widths.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const AR = require('../extension/app/ui/arrange');
const AE = require('../extension/app/ui/layoutAE');
const L = require('../extension/app/ui/layouts');
const BAR = require('../extension/features/quick/bar');
const A = require('../extension/app/ui/actions');

const asRef = (i) => (i.startsWith('tile:') ? i : `quick:${i}`);

test('engine: group keeps a family at its first place; runs; splits', () => {
  assert.deepEqual(AR.group(['quick:precompose', 'quick:flipV', 'quick:separate', 'quick:flipH']), ['quick:precompose', 'quick:flipH', 'quick:flipV', 'quick:separate']);
  assert.deepEqual(AR.runs(['quick:precompose', 'quick:flipH', 'quick:flipV', 'quick:separate']), [['quick:precompose'], ['quick:flipH', 'quick:flipV'], ['quick:separate']]);
  assert.deepEqual(AR.splits(['quick:flipH', 'quick:separate', 'quick:flipV']).map((b) => b.family), ['Flip']);
  assert.equal(AR.familyOf('kit:flipH').name, 'Flip', 'kit / quick / bare ids are one key');
});

test('engine: pack fills every row, keeps order and never splits a run — for 1 to 6 columns and many lists', () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let n = 0; n < 400; n++) {
    const cols = 1 + Math.floor(rnd() * 6);
    const items = Array.from({ length: 1 + Math.floor(rnd() * 12) }, (_, i) => ({ key: i, w: 1 + Math.floor(rnd() * 2), run: rnd() < 0.4 ? Math.floor(i / 2) : undefined }));
    const out = AR.pack(items, cols);
    assert.deepEqual(out.map((o) => o.key), items.map((i) => i.key), 'order kept');
    const rows = new Map();
    out.forEach((o) => rows.set(o.row, (rows.get(o.row) || 0) + o.span));
    for (const [r, sum] of rows) assert.equal(sum, cols, `row ${r} is full (${sum}/${cols})`);
    out.forEach((o, i) => assert.ok(o.span >= Math.min(items[i].w, cols), 'a tile never shrinks'));
    // a run that fits in a row stays in one row
    const byRun = new Map();
    items.forEach((it, i) => { if (it.run != null && i > 0 && items[i - 1].run === it.run) { if (!byRun.has(it.run)) byRun.set(it.run, [i - 1]); byRun.get(it.run).push(i); } });
    for (const idx of byRun.values()) { const w = idx.reduce((s, i) => s + Math.min(items[i].w, cols), 0); if (w <= cols) assert.equal(new Set(idx.map((i) => out[i].row)).size, 1, 'run on one row'); }
  }
  // the owner's example: Transform = Pre-compose (primary) · Separate XY · the Flip pair → two full rows, Flip whole
  const t = AR.pack([{ key: 'precompose', w: 2 }, { key: 'separate', w: 1 }, { key: 'flip', w: 2 }, { key: 'select', w: 2 }], 4);
  assert.deepEqual(t.map((x) => [x.key, x.span, x.row]), [['precompose', 2, 0], ['separate', 2, 0], ['flip', 2, 1], ['select', 2, 1]]);
});

test('every button list of the UI keeps its families together (Classic / Glass / MOE groups, Bento, MOE menus, Kit, Quick Bar)', () => {
  const bad = [];
  const chk = (where, refs) => AR.splits(refs).forEach((b) => bad.push(`${where}: ${b.family} split (${b.refs.join(', ')})`));
  const tiers = (where, lists) => {
    const fam = new Map();
    lists.forEach(([tier, refs]) => refs.forEach((r) => { const f = AR.familyOf(r); if (f) { if (!fam.has(f.name)) fam.set(f.name, new Set()); fam.get(f.name).add(tier); } }));
    for (const [n, s] of fam) if (s.size > 1) bad.push(`${where}: ${n} spread over ${[...s].join(' + ')}`);
  };
  for (const t of AE.TABS) for (const g of t.groups) {
    const w = `${t.id}/${g.id}`;
    if (g.kind === 'acts') {
      const hero = g.hero || [], minor = g.minor || [], paired = (g.pairs || []).flatMap(([, ...r]) => r), inRows = (g.rows || []).flatMap((rw) => rw[1]);
      const std = g.refs.filter((r) => !hero.includes(r) && !minor.includes(r) && !paired.includes(r) && !inRows.includes(r));
      tiers(w, [['primary', hero], ['standard', std], ['minor', minor], ...(g.pairs || []).map((p) => [`pair ${p[0]}`, p.slice(1)]), ...(g.rows || []).map((rw) => [`row ${rw[0]}`, rw[1]])]);
    }
    if (g.kind === 'tiles' || g.kind === 'animate') (g.modes ? g.modes.map((m) => [m[1], m[2]]) : [['ids', g.ids || []]]).forEach(([m, ids]) => chk(`${w}[${m}]`, ids.map((i) => `tile:${g.section}/${i}`)));
  }
  L.MENUS.forEach((m) => chk(`MOE menu ${m.id}`, m.refs));
  BAR.KIT_GROUPS.forEach(([n, ids]) => chk(`Kit ${n}`, ids.map(asRef)));
  const bar = BAR.DEFAULT_BAR.map(asRef);
  chk('Quick Bar Alt+1…0', bar.slice(0, 10)); chk('Quick Bar', bar.slice(10));
  assert.deepEqual(bad, []);
});

test('opposites come as a whole: a list with Flip H has Flip V, with Distribute H has Distribute V', () => {
  const OPP = AR.FAMILIES.filter(([n]) => ['Flip', 'Distribute'].includes(n));
  const half = (where, refs) => OPP.forEach(([n, fr]) => { const has = fr.filter((r) => refs.map(AR.norm).includes(AR.norm(r))); assert.ok(has.length !== 1, `${where}: only ${has[0]} of ${n}`); });
  L.MENUS.forEach((m) => half(`MOE menu ${m.id}`, m.refs));
  half('Quick Bar', BAR.DEFAULT_BAR.map(asRef));
  for (const t of AE.TABS) for (const g of t.groups) if (g.kind === 'acts') half(`${t.id}/${g.id}`, g.refs);
  // every family member is a real action
  AR.FAMILIES.forEach(([n, refs]) => refs.forEach((r) => assert.ok(A.resolve(r), `${n}: ${r} resolves`)));
});

test('Bento renders a declared pair as one tile and gives every tile its span (no dense flow)', () => {
  const css = require('fs').readFileSync(require('path').join(__dirname, '../extension/css/styles.css'), 'utf8');
  assert.ok(!/\.b-grid\s*\{[^}]*dense/.test(css), 'the Bento grid has no dense flow');
  assert.match(css, /\.b-grid > \.bt\[style\*="--s4"\] \{ grid-column: span var\(--s4\); \}/);
  const src = require('fs').readFileSync(require('path').join(__dirname, '../extension/app/ui/layoutBento.js'), 'utf8');
  assert.match(src, /pairTile\(app, t, p\)/);
  const tr = AE.TABS.find((t) => t.id === 'ae-layer').groups.find((g) => g.id === 'transform');
  assert.deepEqual(tr.pairs, [['Flip', 'quick:flipH', 'quick:flipV']]);
});
