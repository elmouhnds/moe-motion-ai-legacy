'use strict';
/**
 * v0.46 — Select modifiers (docs/features/SELECT_MODIFIERS.md): Shift-click a Select button adds to the selection,
 * Alt-click takes away — on every button (Home rows, Bento, Glass, the MOE menu, the sidebar, the Quick Bar), the
 * same keys as the Select page and After Effects.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTestServices } = require('./helpers/harness');
const { studioComp } = require('./fixtures/studio');
const { TA } = require('./fixtures/layout');
const BAR = require('../extension/features/quick/bar');
const A = require('../extension/app/ui/actions');

const T = () => TA({});
const comp = () => studioComp([
  { name: 'Title', text: 'Hello', label: 9, transform: T() },
  { name: 'Sub', text: 'World', label: 9, transform: T() },
  { name: 'Logo', shapes: [], label: 2, selected: true, transform: T() },
  { name: 'Ctrl', nullLayer: true, transform: T() }
]);
const selected = (c) => c._layers.filter((l) => l.selected).map((l) => l.name);
const act = (id) => BAR.ACTIONS.find((x) => x.id === id);
/** Run an action the way a click with these keys does (bar.withMods is what quickbar.run uses). */
const click = (services, id, e) => { const a = act(id); const m = BAR.withMods(a, e); return services.executor.run(a.tool, m.args); };

const FILTERS = ['selText', 'selShape', 'selSolid', 'selNull', 'selPrecomp', 'selFootage', 'selAdjust', 'selCamLight', 'selSameType', 'selSameSource', 'selSameLabel', 'selSameName'];

test('the 12 filters have Shift / Alt; All, Invert, None and Back do not (they are whole-comp moves)', () => {
  for (const id of FILTERS) assert.deepEqual(act(id).mods, BAR.SELECT_MODS, id);
  for (const id of ['selAll', 'selInvert', 'selNone', 'selBack']) assert.ok(!act(id).mods, id);
  // no other action reads the keys — Alt-click keeps opening their options on the Quick Bar
  assert.deepEqual(BAR.ACTIONS.filter((a) => a.mods).map((a) => a.id).sort(), FILTERS.slice().sort());
});

test('withMods: Shift = add, Alt = remove (Alt wins when both are held), no keys = the plain action', () => {
  const a = act('selText');
  assert.deepEqual(BAR.withMods(a, { shiftKey: true }).args, { by: 'type', type: 'text', mode: 'add' });
  assert.deepEqual(BAR.withMods(a, { altKey: true }).args, { by: 'type', type: 'text', mode: 'remove' });
  assert.equal(BAR.withMods(a, { altKey: true, shiftKey: true }).mod, 'alt');
  assert.equal(BAR.withMods(a, { shiftKey: true }).label, 'Select Text Layers (add)');
  const plain = BAR.withMods(a, {});
  assert.equal(plain.mod, null);
  assert.equal(plain.args, a.args, 'the same args object — nothing added');
  assert.equal(BAR.withMods(a, undefined).mod, null, 'keyboard / pie runs have no event');
  // an action without mods ignores the keys
  const flip = act('flipH');
  assert.deepEqual(BAR.withMods(flip, { shiftKey: true, altKey: true }), { args: flip.args, label: flip.label, mod: null });
  assert.equal(BAR.modsHint(a), 'Shift-click: add · Alt-click: remove');
  assert.equal(BAR.modsHint(flip), '');
});

test('on the mock: Shift adds, Alt removes, a plain click replaces — read back from the comp', async () => {
  const { services, comp: c } = await createTestServices(comp());
  assert.deepEqual(selected(c), ['Logo']);
  assert.equal((await click(services, 'selText', { shiftKey: true })).status, 'success');
  assert.deepEqual(selected(c), ['Title', 'Sub', 'Logo'], 'Shift: the texts join Logo');
  await click(services, 'selNull', { shiftKey: true });
  assert.deepEqual(selected(c), ['Title', 'Sub', 'Logo', 'Ctrl']);
  await click(services, 'selText', { altKey: true });
  assert.deepEqual(selected(c), ['Logo', 'Ctrl'], 'Alt: the texts leave');
  await click(services, 'selShape', {});
  assert.deepEqual(selected(c), ['Logo'], 'no keys: replace');
  // Same Label with Shift: the reference is the first selected layer
  c._layers.forEach((l) => { l.selected = l.name === 'Title'; });
  await click(services, 'selNull', { shiftKey: true });
  await click(services, 'selSameLabel', { shiftKey: true });
  assert.deepEqual(selected(c), ['Title', 'Sub', 'Ctrl'], 'label 9 added to Title + Ctrl');
  // Back undoes one step, whatever the mode was
  assert.equal((await click(services, 'selBack', { shiftKey: true })).status, 'success');
  assert.deepEqual(selected(c), ['Title', 'Ctrl']);
});

test('every button that runs an action passes its click on (so the keys reach withMods)', () => {
  const src = (f) => fs.readFileSync(path.join(__dirname, '../extension/app/ui', f), 'utf8');
  // the resolved action and the Quick Bar runner take the event
  assert.match(src('actions.js'), /run: \(app, e\) => q\.run\(app, a, e\)/);
  assert.match(src('quickbar.js'), /async function run\(app, a, e\)/);
  assert.match(src('quickbar.js'), /withMods\(a, e\)/);
  // Home buttons, labelled rows (the Select rows), Bento tiles, the MOE menu and the sidebar
  assert.match(src('layoutAE.js'), /onclick: \(e\) => \{ if \(!rd\.ok && !a\.nav\)[^\n]*a\.run\(app, e\)/);
  assert.match(src('layoutAE.js'), /onclick: \(e\) => \(rd\.ok \? \(remember\(app, t, r\), a\.run\(app, e\)\)/);
  assert.match(src('layoutBento.js'), /a\.run\(app, e\); \} \},/);
  assert.match(src('layouts.js'), /else a\.run\(app, e\); \}/);
  // Alt-click opens options on the Quick Bar / sidebar except where Alt is a variant (right-click always does)
  assert.match(src('layouts.js'), /e\.altKey && !a\.mods \? qb\.openOptions\(app, a\) : qb\.run\(app, a, e\)/);
  assert.match(src('quickbar.js'), /e\.altKey && !a\.mods \? openOptions\(app, a\) : run\(app, a, e\)/);
  // a Select button says it in its tooltip; the group and the MOE menu say it once
  const r = A.resolve('quick:selText');
  assert.equal(r.hint, 'Shift-click: add · Alt-click: remove');
  assert.equal(A.resolve('quick:flipH').hint, '');
  assert.match(src('layoutAE.js'), /keys: true,/);
  assert.match(src('layouts.js'), /lay-drop-keys/);
});
