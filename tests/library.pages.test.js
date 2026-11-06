'use strict';
/**
 * v0.32 — library pages, space follows content (docs/features/LIBRARY_PAGES.md): modes instead of a wall of
 * tiles (Motion: In · Out · Draw On · Proximity; Layout: Arrange · Guides · Cells), columns that fit the count,
 * the Inspector under the clicked row (narrow) or beside the tiles (from 600 px), icon-only tools as rows.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const studio = require('../extension/app/ui/studio/sections');
const L = require('../extension/app/ui/studio/library');
const SH = require('../extension/app/ui/views/shapes');
const src = (f) => fs.readFileSync(path.join(__dirname, '../extension', f), 'utf8');

test('Motion and Layout show one mode at a time; every mode has tiles; nothing is lost', () => {
  const motion = studio.byId('animate');
  assert.deepEqual(motion.modes.map(([m]) => m), ['In', 'Out', 'Shake', 'Trim', 'Proximity']); // v0.59: + Shake
  const layout = studio.byId('layout');
  assert.deepEqual(layout.modes.map(([m]) => m), ['Arrange', 'Clone', 'Effectors', 'Guides', 'Cells'], 'v0.33 adds Clone and Effectors');
  for (const sec of [motion, layout]) {
    for (const [m] of sec.modes) assert.ok(sec.tiles.some((t) => t.tags.includes(m)), `${sec.id}: ${m} has tiles`);
  }
  // every Layout tile is in exactly one mode
  for (const t of layout.tiles) assert.equal(layout.modes.filter(([m]) => t.tags.includes(m)).length, 1, t.id);
  // the Motion tiles outside the modes are the ease presets — their home is the Motion Control, linked from the page
  const outside = motion.tiles.filter((t) => !motion.modes.some(([m]) => t.tags.includes(m)));
  assert.ok(outside.length && outside.every((t) => t.tool === 'motion.smartEase'), outside.map((t) => t.id).join());
  assert.deepEqual(motion.elsewhere[0].slice(0, 2), ['kit', 'Ease']);
  // a search still looks through every mode
  assert.match(src('app/ui/studio/library.js'), /\(q \? true : st\.filter === 'All' \|\| t\.tags\.includes\(st\.filter\)\)/);
});

test('stateOf: a mode section always lands on a mode (old "All" / unknown values), Mine stays', () => {
  const sec = studio.byId('animate');
  const mk = (studioSt) => ({ state: { get: () => ({ studio: { animate: studioSt } }) } });
  assert.equal(L.stateOf(mk(undefined), sec).filter, 'In');
  assert.equal(L.stateOf(mk({ filter: 'All' }), sec).filter, 'In');
  assert.equal(L.stateOf(mk({ filter: 'Out' }), sec).filter, 'Out');
  assert.equal(L.stateOf(mk({ filter: 'Mine' }), sec).filter, 'Mine');
  assert.equal(L.stateOf(mk(undefined), studio.byId('backgrounds')).filter, 'All', 'chip sections keep All');
  assert.equal(L.stateOf(mk(undefined), sec).open, false, 'settings closed until you click a tile');
});

test('columns fit the count: no tile alone on a row for the common counts', () => {
  for (const n of [3, 4, 6, 8, 9, 12, 16, 24, 32]) { const c = L.fitCols(n, 4); assert.equal(n % c, 0, `${n} in ${c}`); }
  assert.equal(L.fitCols(7, 2), 2, 'a docked panel is two columns');
  assert.equal(L.fitCols(12, 4), 3);
  assert.deepEqual([SH.colsFor('kit-tiny'), SH.colsFor('kit-narrow kit-slim'), SH.colsFor('kit-narrow'), SH.colsFor('kit-mid')], [3, 4, 5, 6]);
});

test('the Inspector opens under the clicked row (narrow) or beside the tiles (from 600 px); icon tools are rows', () => {
  const lib = src('app/ui/studio/library.js');
  assert.match(lib, /cells\.splice\(end, 0, inspector\)/, 'inline under the row');
  assert.match(lib, /const end = Math\.min\(tiles\.length, \(Math\.floor\(i \/ cols\) \+ 1\) \* cols\)/);
  assert.match(lib, /setSt\(app, section, on \? \{ open: !st\.open \} : \{ tile: t\.id, filled: null, open: true \}\)/, 'click again closes');
  assert.match(lib, /tiles\.every\(\(t\) => t\.thumb && t\.thumb\.k === 'icon'\)/, 'icon-only tools render as rows');
  assert.match(src('app/ui/shell.js'), /const studioWide = w >= 600;/);
  assert.match(src('app/ui/views/shapes.js'), /out\.splice\(Math\.min\(list\.length, \(Math\.floor\(i \/ c\) \+ 1\) \* c\), 0, inspector\)/, 'Shapes & Icons too');
  assert.match(src('css/app.css'), /\.st-chips\.one-line \{ flex-wrap: nowrap;/, 'filters on one line');
  assert.match(src('app/ui/quickbar.js'), /qt-grid rows pad/, 'Quick Bar customize: one-line rows');
});

test('the "click to inspect" line goes after three applied presets', () => {
  const lib = src('app/ui/studio/library.js');
  assert.equal(L.HINT_KEY, 'lib-hint-n');
  assert.match(lib, /const HINT_UNTIL = 3;/);
  assert.match(lib, /const learned = \(app\.services\.store\.get\(HINT_KEY, 0\) \|\| 0\) >= HINT_UNTIL;/);
});
