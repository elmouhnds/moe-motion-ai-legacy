'use strict';
/**
 * v0.31 — space follows content, for every tab (docs/features/SPACE_FOLLOWS_CONTENT.md):
 * groups merged by job, no tool shown twice, Motion Control owns ease / anchor / align, tile grids
 * without orphans, Animate In / Out / Draw On as one block.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const AE = require('../extension/app/ui/layoutAE');
const A = require('../extension/app/ui/actions');
const W = require('../extension/app/ui/workflow');
const studio = require('../extension/app/ui/studio/sections');

/** Every tool a group shows, as comparable refs ('quick:x', 'tile:sec/id'). */
function shown(g) {
  const tiles = (g.ids || []).map((id) => `tile:${g.section}/${id}`);
  // a ref in a labelled row is also in refs (▾ menu, Recent) but is drawn once, in its row (v0.43)
  return [...new Set([...(g.refs || []), ...(g.minor || []).filter((r) => !(g.refs || []).includes(r)), ...(g.rows || []).flatMap(([, refs]) => refs), ...tiles])];
}

test('25 groups became 15 (+ Select in v0.44, + Templates in v0.49): each tab holds its jobs once', () => {
  const n = AE.TABS.reduce((k, t) => k + t.groups.length, 0);
  assert.equal(n, 18); // v0.57: + Product UI on the Design tab
  const ids = (tab) => AE.TABS.find((t) => t.id === tab).groups.map((g) => g.id);
  assert.deepEqual(ids('ae-keys'), ['assist']);
  assert.deepEqual(ids('ae-animate'), ['in', 'text', 'expr']);
  assert.deepEqual(ids('ae-layer'), ['select', 'transform', 'parent', 'arrange']);
  assert.deepEqual(ids('ae-effect'), ['keycolor', 'zoom']);
  assert.deepEqual(ids('ae-comp'), ['guides', 'project']);
});

test('no tool is shown twice across the tabs, and every one resolves', () => {
  const seen = new Map();
  for (const t of AE.TABS) for (const g of t.groups) for (const r of shown(g)) {
    assert.ok(!seen.has(r), `${r} is in ${seen.get(r)} and ${t.id}/${g.id}`);
    seen.set(r, `${t.id}/${g.id}`);
    if (r.indexOf('tile:') === 0) { const [sec, id] = r.slice(5).split('/'); assert.ok(studio.byId(sec).tiles.some((x) => x.id === id), r); } else assert.ok(A.resolve(r), r);
  }
});

test('Motion Control owns ease, anchor, align and the curve library: the tabs do not repeat them', () => {
  const owned = ['quick:k_easy', 'quick:k_linear', 'quick:k_hold', 'quick:centerAnchor', 'quick:anchorC', 'quick:alignH', 'quick:distH'];
  for (const t of AE.TABS) for (const g of t.groups) {
    owned.forEach((r) => assert.ok(!shown(g).includes(r), `${t.id}/${g.id} repeats ${r}`));
    assert.notEqual(g.kind, 'curves', 'the curve library opens from the ⊞ chip of the Motion Control');
    assert.notEqual(g.kind, 'kitTools', 'Motion Rigs merged: Delay / Stare in Parent & Link, Excite / Jump = Expressions + Sliders, Repeat in Arrange');
  }
  const layer = AE.TABS.find((t) => t.id === 'ae-layer');
  assert.ok(shown(layer.groups.find((g) => g.id === 'parent')).includes('quick:k_delay'));
  // v0.33: the static Repeat left the tab — Clone (Ring, Grid…) is the live version; Repeat stays in the Quick Bar catalogue
  assert.ok(shown(layer.groups.find((g) => g.id === 'arrange')).includes('tile:layout/cloneRing'));
  const expr = AE.TABS.find((t) => t.id === 'ae-animate').groups.find((g) => g.id === 'expr');
  assert.equal(expr.live, true, 'Sliders switch: Excite = Inertia, Jump = Bounce Land with Slider Controls');
  assert.ok(expr.ids.includes('x-inertia') && expr.ids.includes('x-bounceBack'));
});

test('tile grids: columns fit the count, so no tile sits alone on a row', () => {
  for (const n of [2, 3, 4, 6, 8, 9, 12]) {
    const { c, cw } = AE.tileCols(n);
    assert.equal(n % c, 0, `${n} tiles in ${c} columns`);
    assert.equal(n % cw, 0, `${n} tiles in ${cw} wide columns`);
  }
  assert.deepEqual(AE.tileCols(4), { c: 4, cw: 4 }, 'Draw On: one row of four, not three and one');
});

test('Animate In / Out / Draw On: one block; same count per direction; shapes open on Draw On; your choice is kept', () => {
  const g = AE.TABS.find((t) => t.id === 'ae-animate').groups.find((x) => x.id === 'in');
  assert.equal(g.kind, 'animate');
  assert.deepEqual(g.modes.map(([m]) => m), ['in', 'out', 'draw']);
  assert.equal(g.modes[0][2].length, g.modes[1][2].length, 'every In has its Out');
  assert.deepEqual([...g.ids].sort(), g.modes.flatMap(([, , ids]) => ids).sort(), 'the quick menu lists every mode');
  const store = new Map();
  const app = (ctx) => ({ services: { store: { get: (k, d) => (store.has(k) ? store.get(k) : d), set: (k, v) => store.set(k, v) } }, state: { get: () => ({ ctx }) } });
  const shapes = { comp: {}, layers: [{ type: 'shape' }] };
  assert.equal(A.profile(shapes), 'shapes');
  assert.equal(AE.animMode(app(shapes), g), 'draw');
  assert.equal(AE.animMode(app({ comp: {}, layers: [{ type: 'av' }] }), g), 'in');
  store.set('ae-anim-mode', 'out');
  assert.equal(AE.animMode(app(shapes), g), 'out');
  store.set('ae-anim-mode', 'bogus');
  assert.equal(AE.animMode(app(null), g), 'in');
});

test('Motion Control follows the selection; empty Recent takes no space; small groups merged by job', () => {
  const src = fs.readFileSync(path.join(__dirname, '../extension/app/ui/layoutAE.js'), 'utf8');
  assert.match(src, /focus: kind === 'keys' \? \['ease', 'pinned'\] : \['pinned'\]/, 'graph open for keys, compact strip for layers');
  assert.match(src, /ctx: `__ctl-\$\{kind\}`/, 'your open / fold is remembered per kind of selection');
  assert.match(src, /filter\(\(g\) => g\.kind !== 'recent' \|\| recentRefs\(app, tab\)\.length\)/);
  const comp = AE.TABS.find((t) => t.id === 'ae-comp').groups.find((g) => g.id === 'project');
  assert.deepEqual(comp.lead[0][0], 'deliver', 'Deliver leads the last stage');
  assert.ok(comp.minor.includes('quick:k_trash'), 'clean-up with the project housekeeping');
  assert.equal(W.stageOfView('deliver').id, 'st-deliver');
  const transform = AE.TABS.find((t) => t.id === 'ae-layer').groups.find((g) => g.id === 'transform');
  assert.deepEqual(transform.pairs, [['Flip', 'quick:flipH', 'quick:flipV']]);
  const menu = src.slice(src.indexOf('function panelMenu'));
  assert.match(menu, /'My tools & Tool Factory'/, 'the rare pages moved to the ≡ menu');
});
