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

test('styles (v0.29): only Bento (default), Glass and MOE; a retired style opens in Bento', () => {
  assert.deepEqual(L.LAYOUTS.map((l) => l.id), ['bento', 'glass', 'moe', 'control']);
  const app = (layout) => ({ services: { settings: { get: () => ({ ui: { layout } }) } } });
  assert.equal(L.layoutOf(app('moe')), 'moe');
  assert.equal(L.layoutOf(app('glass')), 'glass');
  for (const old of L.RETIRED) assert.equal(L.layoutOf(app(old)), 'bento', `${old} → bento`);
  assert.equal(L.layoutOf(app('nope')), 'bento');
  assert.equal(L.layoutOf(app(undefined)), 'bento');
  const fs = require('fs'), path = require('path');
  assert.ok(!fs.existsSync(path.join(__dirname, '../extension/app/ui/layoutApple.js')), 'Apple style removed');
  assert.ok(!fs.existsSync(path.join(__dirname, '../extension/app/ui/views/home.js')), 'Sidebar Smart Home removed');
});

test('Classic (AE): six tabs named after AE menus; every section reachable; every button and preset exists', () => {
  const AE = require('../extension/app/ui/layoutAE');
  assert.deepEqual(AE.TABS.map((t) => t.label), ['Animate', 'Timing', 'Layer', 'Design', 'Look', 'Deliver']); // v0.65: the order of the work
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

test('every section stays reachable: Bento / Glass stages, MOE tabs and menus', () => {
  const AE = require('../extension/app/ui/layoutAE');
  const W = require('../extension/app/ui/workflow');
  const reach = new Set(['kit']);
  for (const t of AE.TABS) t.owns.forEach((id) => reach.add(id));
  for (const id of SECTIONS) {
    assert.ok(reach.has(id), `MOE tabs reach ${id}`);
    assert.ok(W.stageOfView(id), `a stage reaches ${id}`);
  }
  for (const m of L.MENUS) {
    assert.equal(new Set(m.refs).size, m.refs.length, `${m.id}: no duplicates`);
    m.refs.forEach((r) => assert.ok(A.resolve(r), `${m.id}: ${r} resolves`));
    m.open.forEach(([id]) => assert.ok(studio.byId(id), `${m.id}: opens ${id}`));
  }
  // v0.45: the selection's hint is the tab's dot (the sidebar's menus by object were the tabs again)
  assert.ok(AE.TABS.every((t) => Array.isArray(t.fits)) && ['keys', 'layer', 'layers', 'text', 'shapes', 'shapesMany', 'none'].every((k) => AE.TABS.some((t) => t.fits.includes(k))), 'every kind lights a tab');
});

test('MOE tabs: every tab action and preset is in its ▾ quick menu', () => {
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
  data['ae-order'] = { 'ae-layer': ['gone', 'align', 'parent', 'parent', 'transform'] }; // 'align' left in v0.30 (Motion Control)
  const ids = AE.groupsOf(app, t).map((g) => g.id);
  assert.equal(ids.length, def.length);
  assert.deepEqual([...ids].sort(), [...def].sort());
  assert.ok(ids.indexOf('parent') < ids.indexOf('transform'));
  assert.ok(!ids.includes('align'));
  // moving back to the default order stores nothing
  data['ae-order'] = {};
  const ti = def.indexOf('transform');
  AE.moveGroup(app, t, 'transform', ti + 1); AE.moveGroup(app, t, 'transform', ti);
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
  assert.deepEqual(AE.recentRefs(app, AE.TABS.find((x) => x.id !== 'ae-keys')), [], 'per tab');
  // the refs the panel records resolve: actions, Motion Kit tools, library tiles; a stale ref is skipped
  assert.ok(AE.recentItem(app, 'quick:k_easy'));
  assert.ok(AE.recentItem(app, 'tile:animate:inRL'));
  assert.ok(AE.recentItem(app, 'kit:k_easy'));
  assert.equal(AE.recentItem(app, 'tile:animate:nope'), null);
  // every ref the ▾ menus can record resolves too
  for (const tab of AE.TABS) for (const { items } of AE.tabItems(app, tab)) for (const it of items) if (it.ref) assert.ok(AE.recentItem(app, it.ref), `${tab.label}: ${it.ref}`);
});

test('style proposals (v0.24): every group has one place in Glass and Bento; ids never collide with pages', () => {
  const AE = require('../extension/app/ui/layoutAE');
  const G = require('../extension/app/ui/layoutGlass');
  const B = require('../extension/app/ui/layoutBento');
  // Glass (v0.28): the spaces are the five workflow stages, which place every Classic group exactly once
  const W = require('../extension/app/ui/workflow');
  assert.deepEqual(G.SPACES.map((sp) => sp.label), W.STAGES.map((st) => st.label));
  const covered = W.STAGES.flatMap((st) => st.groups.map(([t, g]) => `${t}/${g}`));
  assert.deepEqual([...covered].sort(), AE.TABS.flatMap((t) => t.groups.map((g) => `${t.id}/${g.id}`)).sort());
  assert.equal(new Set(covered).size, covered.length);
  // every page a tab owns is owned by one space (crumb and active space agree)
  for (const t of AE.TABS) for (const page of t.owns) assert.ok(G.ownerOf(page), `glass owns ${page}`);
  for (const ids of [G.SPACE_IDS]) for (const id of ids) assert.ok(!studio.byId(id) && !AE.TAB_IDS.includes(id), `${id} is not a page id`);
  // Bento: the NOW block exists for every kind, and is a kit block of a Classic group
  // v0.30: one Motion Control (graph + anchor + align) for every selection, never also a group of a tab
  for (const k of ['keys', 'layer', 'layers', 'text', 'shapes', 'shapesMany']) assert.equal(B.nowBlock(k), 'control', k);
  assert.equal(B.nowBlock('none'), null);
  assert.ok(!AE.TABS.some((t) => t.groups.some((g) => g.kind === 'kit')), 'ease / anchor / align are not separate groups any more');
});

test('v0.25: MOE puts every shortcut in its sidebar; Bento pins (max 4) and folds are remembered', () => {
  const L2 = require('../extension/app/ui/layouts');
  const src = require('fs').readFileSync(require('path').join(__dirname, '../extension/app/ui/layouts.js'), 'utf8');
  // the sidebar lists every menu by object and the whole Quick Bar (no "+N"), and the strip leaves the top
  assert.match(src, /p\.top = p\.top\.slice\(1\); \/\/ the Quick Bar strip moves into the sidebar/);
  assert.match(src, /MENUS\.map\(menuBtn\)/);
  assert.match(src, /qb\.barIds\(app\)\.map\(qb\.byId\)/);
  assert.equal(L2.DEFAULT_LAYOUT, 'bento');
  const Bn = require('../extension/app/ui/layoutBento');
  const data = {};
  const toasts = [];
  const app = { render() {}, toast: (m) => toasts.push(m), services: { store: { get: (k, f) => (k in data ? JSON.parse(JSON.stringify(data[k])) : f), set: (k, v) => { data[k] = v; } } } };
  ['quick:k_easy', 'quick:reverse', 'quick:x_loopCycle', 'quick:parentNull'].forEach((r) => Bn.togglePin(app, r, r));
  assert.equal(Bn.pins(app).length, Bn.PIN_MAX);
  Bn.togglePin(app, 'quick:precompose', 'Pre-compose');
  assert.equal(Bn.pins(app).length, 4, 'a fifth pin is refused');
  assert.match(toasts[toasts.length - 1], /unpin one first/);
  Bn.togglePin(app, 'quick:reverse', 'Reverse');
  assert.deepEqual(Bn.pins(app), ['quick:k_easy', 'quick:x_loopCycle', 'quick:parentNull']);
  data['bento-pins'].push('quick:does_not_exist');
  assert.equal(Bn.pins(app).length, 3, 'a pin to a tool that no longer exists is ignored');
});

test('v0.26: pinned NOW tiles reorder (movePin), unknown target puts it last', () => {
  const Bn = require('../extension/app/ui/layoutBento');
  const data = { 'bento-pins': ['quick:k_easy', 'quick:reverse', 'quick:x_loopCycle'] };
  const app = { render() {}, toast() {}, services: { store: { get: (k, f) => (k in data ? JSON.parse(JSON.stringify(data[k])) : f), set: (k, v) => { data[k] = v; } } } };
  Bn.movePin(app, 'quick:x_loopCycle', 'quick:k_easy');
  assert.deepEqual(data['bento-pins'], ['quick:x_loopCycle', 'quick:k_easy', 'quick:reverse']);
  Bn.movePin(app, 'quick:x_loopCycle', 'nope');
  assert.deepEqual(data['bento-pins'], ['quick:k_easy', 'quick:reverse', 'quick:x_loopCycle']);
});
