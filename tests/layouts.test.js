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

test('layouts: Classic (AE) is the default; the others stay selectable', () => {
  assert.deepEqual(L.LAYOUTS.map((l) => l.id), ['ae', 'studio', 'hub', 'bar', 'workspace', 'moe']);
  const app = (layout) => ({ services: { settings: { get: () => ({ ui: { layout } }) } } });
  assert.equal(L.layoutOf(app('bar')), 'bar');
  assert.equal(L.layoutOf(app('moe')), 'moe');
  assert.equal(L.layoutOf(app('studio')), 'studio');
  assert.equal(L.layoutOf(app('nope')), 'ae');
  assert.equal(L.layoutOf(app(undefined)), 'ae');
});

test('Classic (AE): six tabs named after AE menus; every section reachable; every button and preset exists', () => {
  const AE = require('../extension/app/ui/layoutAE');
  assert.deepEqual(AE.TABS.map((t) => t.label), ['Keys', 'Animate', 'Layer', 'Design', 'Effect', 'Comp']);
  const reach = new Set(['kit']);
  assert.ok(AE.TAB_IDS.every((id) => !studio.byId(id)), 'tab ids never collide with a page id');
  const groupIds = [];
  for (const t of AE.TABS) {
    t.owns.forEach((id) => reach.add(id));
    for (const g of t.groups) {
      groupIds.push(g.id);
      (g.refs || []).forEach((r) => assert.ok(A.resolve(r), `${t.id}/${g.id}: ${r} resolves`));
      (g.links || []).forEach(([id]) => { assert.ok(studio.byId(id), `${g.id}: link ${id}`); reach.add(id); });
      if (g.more) { assert.ok(studio.byId(g.more), `${g.id}: more ${g.more}`); reach.add(g.more); }
      if (g.ids) { const sec = studio.byId(g.section); g.ids.forEach((id) => assert.ok(sec.tiles.some((x) => x.id === id), `${g.id}: tile ${id} in ${g.section}`)); }
      g.fits.forEach((k) => assert.ok(['keys', 'layer', 'layers', 'text', 'shapes', 'shapesMany', 'none'].includes(k), `${g.id}: kind ${k}`));
    }
  }
  assert.equal(new Set(groupIds).size, groupIds.length, 'group ids unique (their open state is remembered by id)');
  for (const id of SECTIONS) assert.ok(reach.has(id), `Classic reaches ${id}`);
  // every section page belongs to exactly one tab (crumb + active tab agree)
  const owned = AE.TABS.flatMap((t) => t.owns);
  assert.equal(new Set(owned).size, owned.length);
  // at least one tab fits every kind of selection (the dot always points somewhere)
  for (const k of ['keys', 'layer', 'layers', 'text', 'shapes', 'shapesMany', 'none']) assert.ok(AE.TABS.some((t) => t.fits.includes(k)), `a tab fits ${k}`);
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

test('final layout (v0.21): every Classic tab action and preset is in its ▾ quick menu; retired layouts stay hidden', () => {
  const AE = require('../extension/app/ui/layoutAE');
  const fake = { state: { get: () => ({ ctx: null }) }, services: { settings: { get: () => ({ ui: {} }) }, registry: { get: () => null, list: () => [] } } };
  for (const t of AE.TABS) {
    let menu;
    try { menu = AE.tabItems(fake, t); } catch (e) { menu = null; }
    // readiness needs a live app; fall back to comparing ids from the groups themselves
    const ids = menu ? new Set(menu.flatMap((m) => m.items.map((i) => i.id))) : null;
    for (const g of t.groups) {
      const want = g.kind === 'acts' ? g.refs.map((r) => A.resolve(r)).filter(Boolean).map((a) => a.id)
        : g.kind === 'tiles' || g.kind === 'grid' ? g.ids
          : g.kind === 'links' ? (g.links || []).map(([id]) => `l-${id}`) : [];
      if (ids) want.forEach((id) => assert.ok(ids.has(id), `${t.label} › ${g.label}: ${id} in the ▾ menu`));
      if (ids && g.kind !== 'links') assert.ok(ids.has(`open-${g.id}`), `${t.label} › ${g.label}: an Open entry`);
    }
    assert.ok(menu, `${t.label}: tabItems builds without a live AE context`);
  }
  const shown = L.LAYOUTS.filter((x) => !x.retired).map((x) => x.id);
  assert.deepEqual(shown, ['ae', 'studio', 'moe']);
  assert.ok(['hub', 'bar', 'workspace'].every((id) => L.LAYOUTS.find((x) => x.id === id).retired));
});

test('Classic groups (v0.22): your order is saved per tab, survives new / unknown groups, resets to default', () => {
  const AE = require('../extension/app/ui/layoutAE');
  const data = {};
  const app = { render() {}, services: { store: { get: (k, f) => (k in data ? JSON.parse(JSON.stringify(data[k])) : f), set: (k, v) => { data[k] = v; } } } };
  const t = AE.TABS.find((x) => x.id === 'ae-layer');
  const def = ['recent'].concat(t.groups.map((g) => g.id));
  assert.deepEqual(AE.groupsOf(app, t).map((g) => g.id), def, 'Recent first, then the tab groups');
  assert.ok(AE.moveGroup(app, t, 'arrange', 0));
  assert.deepEqual(AE.groupsOf(app, t).map((g) => g.id).slice(0, 2), ['arrange', 'recent']);
  assert.equal(AE.moveGroup(app, t, 'arrange', -5), false, 'already first');
  assert.equal(AE.moveGroup(app, t, 'nope', 2), false);
  // other tabs keep the default
  const k = AE.TABS.find((x) => x.id === 'ae-keys');
  assert.deepEqual(AE.groupsOf(app, k).map((g) => g.id), ['recent'].concat(k.groups.map((g) => g.id)));
  // a stored order from an older version: unknown ids ignored, missing groups keep their default place, no duplicates
  data['ae-order'] = { 'ae-layer': ['gone', 'parent', 'parent', 'align'] };
  const ids = AE.groupsOf(app, t).map((g) => g.id);
  assert.equal(ids.length, def.length);
  assert.deepEqual([...ids].sort(), [...def].sort());
  assert.ok(ids.indexOf('parent') < ids.indexOf('align'));
  // moving back to the default order stores nothing
  data['ae-order'] = {};
  AE.moveGroup(app, t, 'align', 3); AE.moveGroup(app, t, 'align', 1);
  assert.equal(data['ae-order']['ae-layer'], undefined);
  AE.moveGroup(app, t, 'select', 0); AE.resetOrder(app, t);
  assert.deepEqual(AE.groupsOf(app, t).map((g) => g.id), def);
});

test('Classic ▸ Recent (v0.22): newest first, no duplicates, at most 6, per tab; every ref kind resolves', () => {
  const AE = require('../extension/app/ui/layoutAE');
  const data = {};
  const app = { render() {}, state: { get: () => ({ ctx: null }) }, services: { registry: { get: () => null, list: () => [] }, settings: { get: () => ({ ui: {} }) }, store: { get: (k, f) => (k in data ? JSON.parse(JSON.stringify(data[k])) : f), set: (k, v) => { data[k] = v; } } } };
  const t = AE.TABS.find((x) => x.id === 'ae-keys');
  ['quick:k_easy', 'quick:reverse', 'quick:k_easy', 'kit:k_easy', 'quick:x_loopCycle', 'quick:mirror', 'quick:clone', 'quick:k_hold', 'quick:k_linear'].forEach((r) => AE.remember(app, t, r));
  const list = AE.recentRefs(app, t);
  assert.equal(list.length, 6);
  assert.equal(list[0], 'quick:k_linear');
  assert.equal(new Set(list).size, list.length);
  assert.deepEqual(AE.recentRefs(app, AE.TABS[1]), [], 'per tab');
  // the refs the panel records resolve: actions, Motion Kit tools, library tiles; a stale ref is skipped
  assert.ok(AE.recentItem(app, 'quick:k_easy'));
  assert.ok(AE.recentItem(app, 'tile:animate:inRL'));
  assert.ok(AE.recentItem(app, 'kit:k_easy'));
  assert.equal(AE.recentItem(app, 'tile:animate:nope'), null);
  // every ref the ▾ menus can record resolves too
  for (const tab of AE.TABS) for (const { items } of AE.tabItems(app, tab)) for (const it of items) if (it.ref) assert.ok(AE.recentItem(app, it.ref), `${tab.label}: ${it.ref}`);
});
