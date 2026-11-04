'use strict';
/* v0.45 No Repeats (docs/features/NO_REPEATS.md): one button per job on a screen; nothing lost on the way. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const A = require('../extension/app/ui/actions');
const AE = require('../extension/app/ui/layoutAE');
const L = require('../extension/app/ui/layouts');
const BAR = require('../extension/features/quick/bar');
const BZ = require('../extension/features/curves/bezier');
const studio = require('../extension/app/ui/studio/sections');

// the MOE sidebar's menus as they were in v0.44 (what the owner could reach from there)
const OLD_MENUS = {
  Keys: ['quick:k_easy', 'quick:k_linear', 'quick:k_hold', 'quick:curveExpo', 'quick:curveBack', 'quick:reverse', 'quick:mirror', 'quick:clone', 'quick:k_stagger', 'quick:k_trimKeys', 'tile:expressions/x-loopCycle', 'tile:expressions/x-loopPingPong'],
  Layer: ['quick:anchorTL', 'quick:anchorC', 'quick:anchorB', 'quick:alignH', 'quick:alignV', 'quick:distH', 'quick:distV', 'quick:parentNull', 'quick:k_parent', 'quick:flipH', 'quick:flipV', 'quick:precompose', 'quick:separate', 'quick:k_excite', 'tile:expressions/x-wiggle', 'quick:k_delay', 'quick:k_stare', 'quick:k_trash'],
  Text: ['quick:typewriter', 'quick:counter', 'tile:animate/riseIn', 'tile:animate/cascadeIn', 'tile:animate/fadeIn', 'tile:animate/fadeOut'],
  Shape: ['tile:animate/trimDraw', 'tile:animate/trimErase', 'tile:animate/trimTravel', 'tile:animate/trimBoth', 'quick:k_repeat', 'tile:expressions/x-wiggle', 'tile:animate/popIn', 'tile:animate/spinIn'],
  Comp: ['quick:revealProject', 'quick:openPrecomp', 'quick:revealFolder', 'quick:dupComp', 'quick:purge', 'tile:layout/g12', 'tile:layout/safe', 'tile:layout/thirds'],
  Layout: ['tile:layout/grid', 'tile:layout/ring', 'tile:layout/honey', 'tile:layout/spiral', 'tile:zoom/punch', 'tile:zoom/smooth'],
  AI: ['cmd:copilot', 'cmd:search']
};
const OLD_PAGES = ['kit', 'animate', 'text', 'brand', 'shapes', 'deliver', 'backgrounds', 'looks', 'layout', 'zoom', 'compositing', 'quick', 'tools', 'expressions'];

/** Every one-click ref a MOE tab shows, plus the pages its links / "All" open. */
function tabReach() {
  const refs = new Set(), pages = new Set(['kit']); // the Toolbox: Motion Control's "Toolbox" button and Ctrl+2
  for (const t of AE.TABS) {
    t.owns.forEach((id) => pages.add(id));
    for (const g of t.groups) {
      [].concat(g.refs || [], g.hero || [], g.minor || [], ...(g.rows || []).map((r) => r[1]), ...(g.pairs || []).map(([, ...r]) => r)).forEach((r) => refs.add(r));
      (g.ids || []).forEach((id) => refs.add(`tile:${g.section}/${id}`));
      [...(g.links || []), ...(g.lead || [])].forEach(([id]) => pages.add(id));
      if (g.more) pages.add(g.more);
    }
  }
  return { refs, pages };
}
/** Where a ref is one or two clicks away without the old sidebar menu. */
function whereNow(ref, reach) {
  if (reach.refs.has(ref)) return 'tab';
  if (A.IN_CONTROL[ref]) return 'Motion Control';
  if (A.ON_SCREEN[ref]) return A.ON_SCREEN[ref];
  const q = ref.replace(/^quick:/, '');
  if (ref.startsWith('quick:') && BAR.KIT_TOOLS.includes(q)) return 'Toolbox';
  const m = /^tile:([^/]+)\/(.+)$/.exec(ref);
  if (m && reach.pages.has(m[1]) && studio.byId(m[1]).tiles.some((t) => t.id === m[2])) return `${m[1]} page`;
  return null;
}

test('MOE sidebar: the nine whole-tab menus are gone (v0.46 adds one-job menus); every button they held is still reachable', () => {
  assert.ok(!L.MENUS.some((m) => Object.keys(L.RETIRED_MENUS).includes(m.id)), 'no removed menu came back');
  assert.deepEqual(Object.keys(L.RETIRED_MENUS).sort(), ['AI', 'Comp', 'Design', 'Finish', 'Keys', 'Layer', 'Layout', 'Shape', 'Text']);
  const reach = tabReach();
  for (const [menu, refs] of Object.entries(OLD_MENUS)) {
    for (const r of refs) assert.ok(whereNow(r, reach), `${menu} › ${r} is reachable without the menu`);
  }
  // the pages the old menus linked to (Design: Shapes, Backgrounds, Looks, Brand; Finish: Compositing, Quick Bar, My Tools)
  const menuSrc = fs.readFileSync(path.join(__dirname, '../extension/app/ui/layoutAE.js'), 'utf8');
  for (const id of OLD_PAGES) {
    const ok = reach.pages.has(id) || new RegExp(`app\\.go\\('${id}'\\)`).test(menuSrc);
    assert.ok(ok, `the ${id} page is still one click from a tab or the ≡ menu`);
  }
  // the sidebar code has no "By object" caption and no per-selection hint any more (the tabs' dot is that hint)
  const src = fs.readFileSync(path.join(__dirname, '../extension/app/ui/layouts.js'), 'utf8');
  assert.ok(!/By object/.test(src) && !/MENU_FOR/.test(src));
});

test('NOW never repeats the search box, the Assistant button or the Motion Control above it', () => {
  const kinds = Object.keys(A.SETS);
  for (const k of kinds) {
    const all = A.nowSet(k, { rail: true, ease: true });
    assert.ok(!all.some((r) => A.ON_SCREEN[r]), `${k}: no Search / Assistant tile`);
    assert.ok(!all.some((r) => A.IN_CONTROL[r]), `${k}: nothing the open Motion Control has`);
    // folded control (curve chips and Easy / Linear / Hold hidden): the ease ones come back, the rail ones do not
    const folded = A.nowSet(k, { rail: true, ease: false });
    A.SETS[k].filter((r) => A.IN_CONTROL[r] && A.IN_CONTROL[r][0] === 'ease').forEach((r) => assert.ok(folded.includes(r), `${k}: ${r} returns when the curves are folded`));
    A.SETS[k].filter((r) => A.IN_CONTROL[r] && A.IN_CONTROL[r][0] === 'rail').forEach((r) => assert.ok(!folded.includes(r), `${k}: ${r} stays out (anchor / align always shown)`));
    // no control at all (nothing selected, or Glass folded): only Search / Assistant leave
    assert.deepEqual(A.nowSet(k, null), A.SETS[k].filter((r) => !A.ON_SCREEN[r]));
  }
  // concretely: keys no longer shows Out Expo / Out Back twice, one layer no longer Anchor Bottom twice
  assert.ok(!A.nowSet('keys', { rail: true, ease: true }).includes('quick:curveExpo'));
  assert.ok(!A.nowSet('layer', { rail: true, ease: false }).includes('quick:anchorB'));
  assert.ok(!A.nowSet('none', null).includes('cmd:search') && !A.nowSet('none', null).includes('cmd:copilot'));
  // the pie keeps all eight (it opens at the cursor, where none of these are)
  assert.equal(A.slotsFor(null, {}).length, 8);
  assert.ok(A.slotsFor(null, {}).includes('cmd:search'));
});

test('a Motion Control button counts as the same job only when it really is (same tool, same values)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../extension/app/ui/views/kit.js'), 'utf8');
  const q = (id) => BAR.ACTIONS.find((a) => a.id === id);
  for (const [ref, [part, key]] of Object.entries(A.IN_CONTROL)) {
    assert.ok(['rail', 'ease'].includes(part), ref);
    const a = q(ref.replace(/^quick:/, ''));
    assert.ok(a, `${ref} is a Quick action`);
    if (/^ci-/.test(key)) assert.ok(src.includes(`'data-key': '${key}'`), `${key} is on the Easy / Linear / Hold buttons`);
    if (/^chip-/.test(key)) {
      const p = BZ.PRESETS.find((x) => x.id === key.slice(5));
      assert.ok(p && src.includes(`'${p.id}'`), `${key} is a curve chip`);
      assert.equal(a.tool, 'motion.easeCurve');
      assert.deepEqual([a.args.x1, a.args.y1, a.args.x2, a.args.y2], [p.x1, p.y1, p.x2, p.y2], `${ref} = the ${p.label} chip`);
    }
    if (/^ap-/.test(key)) { assert.equal(a.tool, 'transform.anchor'); assert.equal(a.args.point, key.slice(3)); }
    if (/^al-/.test(key)) { assert.equal(a.tool, 'transform.align'); assert.equal(a.args.mode, key.slice(3)); assert.equal(a.args.to, 'selection'); }
  }
  // Centre in Comp is an Alt-click in the align row, not a button: it stays a NOW / Quick Bar button
  assert.ok(!A.IN_CONTROL['quick:compCentre']);
});

test('Glass: NOW leaves out what the open groups of the space below already show', () => {
  const store = new Map();
  const app = { services: { store: { get: (k, d) => (store.has(k) ? store.get(k) : d), set: (k, v) => store.set(k, v) } }, state: { get: () => ({ ctx: null }) } };
  const tab = AE.TABS.find((t) => t.id === 'ae-keys');
  const g = tab.groups[0];
  const shown = AE.shownRefs(app, g, 'keys');
  ['quick:reverse', 'tile:expressions/x-loopCycle', 'quick:k_stagger'].forEach((r) => assert.ok(shown.includes(r), r));
  // a closed group shows nothing
  assert.deepEqual(AE.shownRefs(app, Object.assign({}, g, { open: false, fits: [] }), 'none'), []);
  // an In / Out / Draw On block shows its current mode's tiles only
  const anim = AE.TABS.find((t) => t.id === 'ae-animate').groups.find((x) => x.id === 'in');
  const inMode = AE.shownRefs(app, anim, 'layer');
  assert.ok(inMode.includes('tile:animate/fadeIn') && !inMode.includes('tile:animate/fadeOut'));
  const src = fs.readFileSync(path.join(__dirname, '../extension/app/ui/layoutGlass.js'), 'utf8');
  assert.match(src, /nowCard\(app, s, kind, below\)/);
  assert.match(src, /!\(below \|\| new Set\(\)\)\.has\(r\)/);
});

test('library tiles have their own data-key (the old one cut the name: Fade In and Rise In were both "t-eIn")', () => {
  const src = fs.readFileSync(path.join(__dirname, '../extension/app/ui/layoutAE.js'), 'utf8');
  // (tabs keep `t-${t.id.slice(3)}`: their ids are 'ae-keys' … so that one is right)
  assert.ok(!/`t-\$\{t\.id\.slice\(3\)\}`, 'aria-label': `Apply/.test(src));
  assert.equal((src.match(/'data-key': `t-\$\{sec\.id\}\/\$\{t\.id\}`/g) || []).length, 2);
  // unique inside every library
  for (const sec of studio.SECTIONS || []) {
    const ids = (sec.tiles || []).map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length, sec.id);
  }
});

test('v0.46 sidebar menus: one job each, used from any tab — labelled rows, families side by side, never a whole tab', () => {
  const AR = require('../extension/app/ui/arrange');
  assert.ok(L.MENUS.length <= 5, 'a short list: more menus would be the clutter v0.45 removed');
  assert.equal(L.MENUS[0].id, 'Select');
  const tabLabels = AE.TABS.map((t) => t.label);
  const reach = tabReach();
  for (const m of L.MENUS) {
    assert.ok(!tabLabels.includes(m.id), `${m.id}: not a tab's name (no two things share a name)`);
    assert.ok(m.title && m.icon, `${m.id}: says what it is for`);
    assert.ok(AE.TABS.some((t) => t.id === m.tab), `${m.id}: its buttons are remembered in a real tab`);
    const rows = m.rows || AE.TABS.find((t) => t.id === m.group[0]).groups.find((g) => g.id === m.group[1]).rows;
    assert.ok(rows.length >= 2 && rows.length <= 5, `${m.id}: 2–5 labelled rows`);
    rows.forEach(([label, refs, short]) => { assert.ok(label && refs.length >= 2 && refs.length <= 8, `${m.id} › ${label}`); assert.equal(short.length, refs.length); });
    // every button is a real one-click action that also lives in a tab or its library page (nothing only here)
    m.refs.forEach((r) => { assert.ok(A.resolve(r), r); assert.ok(whereNow(r, reach), `${m.id}: ${r} also has its place in a tab`); });
    assert.deepEqual(AR.splits(m.refs), [], `${m.id}: families side by side (Fade In next to Fade Out)`);
  }
  // In / Out pairs each move with its opposite on one row
  const io = L.MENUS.find((m) => m.id === 'In / Out');
  for (const [label, refs] of io.rows.filter(([l]) => l !== 'Draw' && l !== 'Slide')) assert.deepEqual(refs.map((r) => /In$/.test(r) ? 'in' : 'out'), ['in', 'out'], label);
});
