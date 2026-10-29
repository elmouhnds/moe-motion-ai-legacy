'use strict';
/**
 * v0.16 layout proposals (app/ui/layouts.js): every button they show points at something real, and
 * every section of the panel stays reachable in each layout (copy-not-move: nothing is lost).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../extension/app/ui/layouts');
const A = require('../extension/app/ui/actions');
const qb = require('../extension/app/ui/quickbar');
const studio = require('../extension/app/ui/studio/sections');

const SECTIONS = [...new Set(studio.WORKSPACES.flatMap((w) => w.items))];

test('layouts: the three proposals + current are listed; unknown values fall back to the current layout', () => {
  assert.deepEqual(L.LAYOUTS.map((l) => l.id), ['studio', 'hub', 'bar', 'workspace', 'moe']);
  const app = (layout) => ({ services: { settings: { get: () => ({ ui: { layout } }) } } });
  assert.equal(L.layoutOf(app('bar')), 'bar');
  assert.equal(L.layoutOf(app('moe')), 'moe');
  assert.equal(L.layoutOf(app('nope')), 'studio');
  assert.equal(L.layoutOf(app(undefined)), 'studio');
});

test('layouts: every section stays reachable in every layout', () => {
  const hub = new Set(['kit', ...L.HUB.flatMap((x) => x.items || [])]);
  const ws = new Set(L.WS.flatMap((x) => x.owns));
  const bar = new Set(['kit', ...L.MENUS.flatMap((m) => m.open.map(([id]) => id))]);
  for (const id of SECTIONS) {
    assert.ok(hub.has(id), `Hub reaches ${id}`);
    assert.ok(ws.has(id), `Workspace reaches ${id}`);
    assert.ok(bar.has(id), `Command Bar reaches ${id}`);
  }
  // a section belongs to one Workspace tab only (the crumb and the selected tab must agree)
  const owned = L.WS.flatMap((x) => x.owns);
  assert.equal(new Set(owned).size, owned.length, 'no section owned by two tabs');
});

test('layouts: menu actions resolve, bars use real quick actions, no duplicates inside a menu', () => {
  for (const m of L.MENUS) {
    assert.equal(new Set(m.refs).size, m.refs.length, `${m.id}: no duplicates`);
    m.refs.forEach((r) => assert.ok(A.resolve(r), `${m.id}: ${r} resolves`));
    m.open.forEach(([id]) => assert.ok(studio.byId(id) || id === 'bar-ease', `${m.id}: opens ${id}`));
  }
  for (const [name, ids] of L.DEFAULT_BARS) ids.forEach((id) => assert.ok(qb.byId(id), `bar ${name}: ${id}`));
  // the highlighted menu exists for every selection kind
  for (const k of ['keys', 'layer', 'layers', 'text', 'shapes', 'shapesMany', 'none']) assert.ok(L.MENUS.some((m) => m.id === L.MENU_FOR[k]), `hint for ${k}`);
});
