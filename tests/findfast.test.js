'use strict';
/**
 * v0.44 — Find Fast (docs/features/FIND_FAST.md): important tools are never buried behind a link, and no two
 * different tools share a name. Select is out front (its own group first in Layer, its own MOE menu); the
 * everyday text animators are one click; look-alike names were renamed or merged.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { studioComp } = require('./fixtures/studio');
const { TA } = require('./fixtures/layout');
const AE = require('../extension/app/ui/layoutAE');
const W = require('../extension/app/ui/workflow');
const L = require('../extension/app/ui/layouts');
const A = require('../extension/app/ui/actions');
const BAR = require('../extension/features/quick/bar');
const S = require('../extension/app/ui/studio/sections');

const T = () => TA({});
function mixed() {
  return studioComp([
    { name: 'Title', text: 'Hello', label: 9, selected: true, transform: T() },
    { name: 'Sub', text: 'World', label: 9, transform: T() },
    { name: 'Logo', shapes: [], label: 2, transform: T() },
    { name: 'Plate', source: { kind: 'image', name: 'plate.png', file: 'plate.png' }, sourceId: 777, transform: T() },
    { name: 'Clip', source: { kind: 'video', name: 'clip.mp4', file: 'clip.mp4' }, sourceId: 778, transform: T() },
    { name: 'Ctrl', nullLayer: true, transform: T() },
    { name: 'Cam', camera: true }
  ]);
}
const selected = (comp) => comp._layers.filter((l) => l.selected).map((l) => l.name);
const runRef = (services, ref) => { const a = BAR.ACTIONS.find((x) => x.id === ref); return services.executor.run(a.tool, a.args); };

test('Select buttons (mock): type, footage, cameras & lights, same as selected, all, invert, none, back', async () => {
  const { services, comp } = await createTestServices(mixed());
  assert.equal((await runRef(services, 'selText')).status, 'success');
  assert.deepEqual(selected(comp), ['Title', 'Sub']);
  await runRef(services, 'selFootage');
  assert.deepEqual(selected(comp), ['Plate', 'Clip'], 'footage = images + videos');
  await runRef(services, 'selCamLight');
  assert.deepEqual(selected(comp), ['Cam']);
  await runRef(services, 'selNull');
  assert.deepEqual(selected(comp), ['Ctrl']);
  // "same" uses the selected layer as the reference — the context is read fresh by the executor
  comp._layers.forEach((l) => { l.selected = l.name === 'Logo'; });
  await runRef(services, 'selSameLabel');
  assert.deepEqual(selected(comp), ['Logo']);
  comp._layers.forEach((l) => { l.selected = l.name === 'Title'; });
  await runRef(services, 'selSameLabel');
  assert.deepEqual(selected(comp), ['Title', 'Sub'], 'label 9 like Title');
  await runRef(services, 'selInvert');
  assert.deepEqual(selected(comp), ['Logo', 'Plate', 'Clip', 'Ctrl', 'Cam']);
  await runRef(services, 'selAll');
  assert.equal(selected(comp).length, 7);
  await runRef(services, 'selNone');
  assert.deepEqual(selected(comp), []);
  const back = await runRef(services, 'selBack');
  assert.equal(back.status, 'success');
  assert.equal(selected(comp).length, 7, 'Back = the selection before None');
  // same source without a source → a clear message, nothing changes
  comp._layers.forEach((l) => { l.selected = l.name === 'Ctrl'; });
  const r = await runRef(services, 'selSameSource');
  assert.notEqual(r.status, 'success');
  assert.match(JSON.stringify(r.errors), /no source/);
  assert.deepEqual(selected(comp), ['Ctrl']);
});

test('Select "same as" without a selected layer is refused before anything runs; Back with no history explains', async () => {
  const { services } = await createTestServices(studioComp([{ name: 'A', transform: T() }]));
  const r = await runRef(services, 'selSameType');
  assert.match(JSON.stringify(r.errors), /Select one layer first/);
  const b = await runRef(services, 'selBack');
  assert.match(JSON.stringify(b.errors), /No earlier selection/);
});

test('Select is out front: first group of the Layer tab and of the Arrange stage, its own MOE menu; the link left Transform', () => {
  const layer = AE.TABS.find((t) => t.id === 'ae-layer');
  const g = layer.groups[0];
  assert.equal(g.id, 'select');
  assert.equal(g.rows.length, 3);
  assert.deepEqual(g.rows.map((r) => r[0]), ['Type', 'Same', 'Comp']);
  g.rows.forEach(([, refs, short]) => { assert.equal(refs.length, short.length); refs.forEach((r) => assert.ok(g.refs.includes(r) && A.resolve(r), r)); });
  assert.deepEqual(g.links, [['select', 'Search · labels · other comps · project']]);
  assert.ok(!(layer.groups.find((x) => x.id === 'transform').links || []).length, 'no buried link in Transform any more');
  const st = W.STAGES.find((x) => x.id === 'st-arrange');
  assert.deepEqual(st.groups[0], ['ae-layer', 'select', 'core']);
  assert.equal(L.MENUS[0].id, 'Select');
  assert.ok(L.MENUS[0].refs.length >= 12 && L.MENUS[0].refs.every((r) => A.resolve(r)));
  // v0.45 (NO_REPEATS) removed the menus that were whole tabs; v0.46 (SIDEBAR_MENUS) adds one-job menus after Select
  assert.deepEqual(L.MENUS.map((m) => m.id), ['Select', 'Parent & Link', 'In / Out', 'Loop', 'Guides']); // v0.53: Guides (owner)
});

test('Text animators are one click: In / Out rows of Arabic-safe presets (+ Remove), all real presets', () => {
  const g = AE.TABS.find((t) => t.id === 'ae-animate').groups.find((x) => x.id === 'text');
  assert.deepEqual(g.rows.map((r) => r[0]), ['In', 'Out']);
  const lib = require('../extension/features/text/presets');
  const list = lib.PRESETS || Object.values(lib).find(Array.isArray);
  g.rows.forEach(([, refs]) => refs.forEach((r) => {
    const a = BAR.ACTIONS.find((x) => `quick:${x.id}` === r);
    const p = list.find((x) => x.id === a.args.presetId);
    assert.ok(p && p.arabicSafe, `${r} → ${a.args.presetId} is Arabic-safe`);
    assert.equal(p.kind, g.rows[0][1].includes(r) ? 'in' : 'out');
  }));
  assert.deepEqual(g.minor, ['quick:t_remove']);
});

test('nothing important is buried: every page has buttons on Home or a group of its own; key tools have a Home button', () => {
  // pages people open for one quick job must not be only a text link
  const groupFor = (sec) => AE.TABS.some((t) => t.groups.some((g) => g.section === sec || (g.kind === 'acts' && (g.links || []).some(([id]) => id === sec) && (g.refs || []).length > 2)));
  for (const sec of ['select', 'text', 'animate', 'expressions', 'backgrounds', 'looks', 'layout', 'zoom', 'compositing']) assert.ok(groupFor(sec), `${sec} has buttons on Home`);
  // tools a motion designer reaches for daily: each must run from a Home button
  const onHome = new Set();
  AE.TABS.forEach((t) => t.groups.forEach((g) => [...(g.refs || []), ...(g.minor || []), ...(g.rows || []).flatMap((r) => r[1])].forEach((r) => {
    const id = r.replace(/^quick:/, ''); const a = BAR.ACTIONS.find((x) => x.id === id); if (a) onHome.add(a.tool);
  })));
  for (const tool of ['select.layers', 'select.step', 'text.animate', 'text.removeAnimation', 'quick.selectSame', 'rig.bake', 'kit.trash']) assert.ok(onHome.has(tool), `${tool} has a Home button`);
});

test('no two different tools share a name (words compared, centre = center, colour = color)', () => {
  const norm = (s) => String(s).toLowerCase().replace(/[()·:,+&]/g, ' ').replace(/\bcentre\b/g, 'center').replace(/\bcolour\b/g, 'color').split(/\s+/).filter(Boolean).sort().join(' ');
  const seen = new Map();
  // key = 'tool|args' for a button, 'tool' for the tool itself: a tool's own name may sit on its own button,
  // but two different tools — or two different presets of one tool — may not share a name
  const clash = (a, b) => { const [ta, aa] = a.split('|'), [tb, ab] = b.split('|'); return ta !== tb || (aa !== undefined && ab !== undefined && aa !== ab); };
  const add = (name, key, where) => { const k = norm(name); if (!k) return; const prev = seen.get(k); if (prev && clash(prev.key, key)) assert.fail(`"${name}" (${where}) looks like "${prev.name}" (${prev.where})`); if (!prev) seen.set(k, { name, key, where }); };
  BAR.ACTIONS.forEach((a) => add(A.resolve(`quick:${a.id}`).label, `${a.tool}|${JSON.stringify(a.args)}`, `quick:${a.id}`));
  S.SECTIONS.forEach((s) => (s.tiles || []).forEach((t) => add(t.label, `${t.tool}|${JSON.stringify(t.args || {})}`, `tile ${s.id}/${t.id}`)));
  const reg = require('../extension/features/index');
  const tools = (reg.ALL || reg.tools || Object.values(reg).flat()).filter((t) => t && t.id);
  tools.forEach((t) => add(t.name, t.id, `tool ${t.id}`));
  // the renamed look-alikes
  assert.equal(A.resolve('quick:centerAnchor').label, A.resolve('quick:anchorC').label, 'Center Anchor merged into Anchor → Centre (saved bars migrate)');
  assert.equal(BAR.migrate('centerAnchor'), 'anchorC');
  assert.ok(!BAR.ACTIONS.some((a) => a.id === 'centerAnchor'));
  assert.equal(W.EVERYDAY[2], 'anchorC', 'Alt+3 keeps the job');
  assert.equal(A.resolve('quick:clone').label.startsWith('Copy'), true);
  assert.equal(A.resolve('quick:selectSame').label, 'Same Property');
  assert.ok(!/Look/.test(S.byId('layout').tiles.find((t) => t.id === 'efLook').label));
});

test('Ctrl+K finds every one-click button by name, and understands Arabic (حدد كل التكستات → Select Text Layers)', async () => {
  const { services } = await createTestServices(studioComp([{ name: 'T', text: 'Hi', selected: true, transform: T() }]));
  const P = require('../extension/app/ui/palette');
  const app = { services, state: { get: () => ({ ctx: null }), set() {} }, go() {}, openTool() {}, toast() {} };
  const names = (q) => P.results(app, q).map((x) => x.name);
  assert.equal(P.results(app, 'flip vertical')[0].name, 'Flip Vertical');
  assert.equal(P.results(app, 'flip vertical')[0].kind, 'action', 'one click, not a form');
  assert.ok(names('select text').includes('Select Text Layers'));
  assert.equal(names('حدد كل التكستات')[0], 'Select Text Layers');
  assert.equal(names('عكس التحديد')[0], 'Invert Selection');
  assert.equal(names('سيلكت النلز')[0], 'Select Nulls');
  assert.ok(!names('اعكس الكيز').includes('Invert Selection'), 'reversing keys is not inverting the selection');
});

test('a failed button always says why (errors, else the failed checks), and text buttons run with the preset duration', async () => {
  const { whyFailed } = require('../extension/app/ui/quickbar');
  assert.deepEqual(whyFailed({ status: 'failed', verification: { checks: [{ ok: false, label: 'Cam', detail: 'skipped: camera' }, { ok: true, label: 'x' }] } }), ['Cam — skipped: camera']);
  assert.deepEqual(whyFailed({ status: 'failed', errors: ['Select a layer'] }), ['Select a layer']);
  assert.deepEqual(whyFailed({ status: 'failed' }), ['failed']);
  // the text animator buttons pass only presetId: duration 0 (= the preset's) must validate
  const { services, comp } = await createTestServices(studioComp([{ name: 'Title', text: 'Hello', selected: true, transform: T() }]));
  comp.time = 0;
  const { defaults } = require('../extension/core/schema');
  const tool = services.registry.get('text.animate');
  const a = BAR.ACTIONS.find((x) => x.id === 't_inUp');
  const r = await services.executor.run(a.tool, Object.assign(defaults(tool.params), a.args));
  assert.equal(r.status, 'success', JSON.stringify(r.errors || r.verification));
});
