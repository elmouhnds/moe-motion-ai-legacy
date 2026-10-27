'use strict';
/**
 * v0.7 workflow (UX audit recommendations): tile readiness, preset search, sidebar groups,
 * setup tiles. Browser-level flows are checked with tools/audit-ui.js and the screenshot run.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;

const { createTestServices } = require('./helpers/harness');
const { createState } = require('../extension/app/ui/state');
const S = require('../extension/app/ui/studio/sections');
const library = require('../extension/app/ui/studio/library');
const palette = require('../extension/app/ui/palette');

const fixture = require('../dev/preview-fixture.js');

async function makeApp() {
  const { services } = await createTestServices(fixture);
  const ctx = await services.executor.readContext();
  const toasts = [];
  const runs = [];
  const app = {
    services, state: createState({ ctx, studio: {}, args: {}, running: null }),
    toast: (m, ms, kind) => toasts.push({ m, kind }), go: (v) => app.state.set({ view: v }),
    runTool: async (id, args, opts) => { runs.push({ id, args, opts }); return services.executor.run(id, args, { origin: 'user' }); },
    openTool: () => {}, refreshContext: () => {}, openCopilot: () => {}
  };
  return { app, toasts, runs };
}

test('sidebar: Home + five workspaces cover every section once', () => {
  const ids = S.NAV;
  assert.equal(ids[0], 'home');
  assert.equal(new Set(ids).size, ids.length, 'no duplicates');
  for (const sec of S.SECTIONS) assert.ok(ids.includes(sec.id), sec.id);
  assert.deepEqual(S.WORKSPACES.map((g) => g.label), ['Animate', 'Design', 'Layout', 'Finish', 'Tools']);
  for (const id of ids.slice(1)) assert.ok(S.workspaceOf(id), `${id} belongs to a workspace`);
});

test('readiness: a tile the selection cannot run is blocked with the tool\'s own reason; ready tiles pass', async () => {
  const { app } = await makeApp();
  const anim = S.byId('animate');
  const slide = anim.tiles.find((t) => t.id === 'inRL');
  const trim = anim.tiles.find((t) => t.id === 'trimDraw');
  assert.equal(library.readiness(app, slide).ok, true);
  const r = library.readiness(app, trim);
  assert.equal(r.ok, false);
  assert.equal(r.kind, 'select');
  assert.match(r.hint, /shape layers/);
});

test('▶ on a blocked tile explains instead of running; on a ready tile it runs with the tile label', async () => {
  const { app, toasts, runs } = await makeApp();
  const anim = S.byId('animate');
  await library.applyNow(app, anim.tiles.find((t) => t.id === 'trimDraw'), anim);
  assert.equal(runs.length, 0);
  assert.equal(toasts[0].kind, 'warn');
  const r = await library.applyNow(app, anim.tiles.find((t) => t.id === 'fadeIn'), anim);
  assert.equal(r.status, 'success');
  assert.equal(runs[0].opts.label, 'Fade In');
});

test('setup tiles (need a description / reference / file) are marked and open settings instead of failing', async () => {
  const { app, runs, toasts } = await makeApp();
  const comp = S.byId('compositing');
  const look = comp.tiles.find((t) => t.tool === 'compositing.lookAssist');
  assert.equal(look.needsInput, true);
  assert.equal(library.readiness(app, look).kind, 'input');
  await library.applyNow(app, look, comp);
  assert.equal(runs.length, 0);
  assert.match(toasts[0].m, /Inspector/);
});

test('search: presets are found by name and ranked first; Enter applies, Shift+Enter only opens', async () => {
  const { app, runs } = await makeApp();
  const res = palette.results(app, 'pop in');
  assert.equal(res[0].kind, 'preset');
  assert.equal(res[0].name, 'Pop In');
  res[0].open();
  assert.equal(app.state.get().view, 'animate');
  assert.equal(runs.length, 0, 'open does not apply');
  await res[0].run();
  assert.equal(runs.length, 1);
  assert.equal(runs[0].id, 'quick.animate');
  // text presets too
  assert.ok(palette.results(app, 'blur focus').some((x) => x.id.startsWith('text:')));
  // no query: tools and navigation only (presets would flood the list)
  assert.ok(!palette.results(app, '').some((x) => x.kind === 'preset'));
});

test('readiness checks required settings too (a tool with no prepare and an empty required field is "setup")', async () => {
  const { app, runs } = await makeApp();
  const comp = S.byId('compositing');
  const green = comp.tiles.find((t) => t.tool === 'generate.greenPrompt');
  const r = library.readiness(app, green);
  assert.equal(r.ok, false);
  assert.equal(r.kind, 'input');
  assert.match(r.hint, /is required/);
  await library.applyNow(app, green, comp);
  assert.equal(runs.length, 0);
});

/* ---------- v0.8: actions, smart sets, pie menu ---------- */
const actions = require('../extension/app/ui/actions');
const pie = require('../extension/app/ui/pie');

test('selection profile: keyframes > text > shapes > several / one layer > nothing', () => {
  const ctx = (layers, keys = 0) => ({ comp: { id: 1 }, layers, properties: keys ? [{ selectedKeys: Array.from({ length: keys }, (_, i) => i + 1) }] : [] });
  assert.equal(actions.profile(null), 'none');
  assert.equal(actions.profile(ctx([])), 'none');
  assert.equal(actions.profile(ctx([{ type: 'text' }], 3)), 'keys');
  assert.equal(actions.profile(ctx([{ type: 'text' }, { type: 'text' }])), 'text');
  assert.equal(actions.profile(ctx([{ type: 'shape' }])), 'shapes');
  assert.equal(actions.profile(ctx([{ type: 'shape' }, { type: 'shape' }])), 'shapesMany');
  assert.equal(actions.profile(ctx([{ type: 'shape' }, { type: 'av' }])), 'layers');
  assert.equal(actions.profile(ctx([{ type: 'av' }])), 'layer');
  assert.equal(actions.profile(ctx([{ type: 'camera' }])), 'none');
});

test('every smart slot and every catalog entry resolves to a real action', () => {
  for (const [k, set] of Object.entries(actions.SETS)) {
    assert.equal(set.length, 8, k);
    for (const ref of set) assert.ok(actions.resolve(ref), `${k}: ${ref}`);
  }
  const cat = actions.catalog();
  assert.ok(cat.length > 100);
  for (const c of cat) assert.ok(actions.resolve(c.ref), c.ref);
  assert.equal(actions.resolve('tile:animate/nope'), null);
  assert.equal(actions.resolve('quick:nope'), null);
});

test('My pie replaces the smart set; empty slots stay empty', () => {
  const mine = ['quick:flipH', '', 'nav:text'];
  const slots = actions.slotsFor(null, { mode: 'mine', mine });
  assert.equal(slots.length, 8);
  assert.deepEqual(slots.slice(0, 3), ['quick:flipH', null, 'nav:text']);
  assert.deepEqual(actions.slotsFor(null, { mode: 'mine', mine: [] }), actions.SETS.none, 'an empty My pie falls back to smart');
});

test('pie geometry: centre dead zone, north = slice 0, clockwise, each slice 45°', () => {
  assert.equal(pie.sliceAt(0, 0), -1);
  assert.equal(pie.sliceAt(5, -5), -1);
  assert.equal(pie.sliceAt(0, -60), 0);
  assert.equal(pie.sliceAt(60, -60), 1);
  assert.equal(pie.sliceAt(60, 0), 2);
  assert.equal(pie.sliceAt(0, 60), 4);
  assert.equal(pie.sliceAt(-60, 0), 6);
  assert.equal(pie.sliceAt(-60, -60), 7);
  assert.match(pie.sectorPath(0, 30, 120), /^M .* A 120 120 0 0 1 .* Z$/);
});

test('pie: keys 1–8 run that slice through the readiness check; centre repeats; Esc closes', async () => {
  const { app, runs, toasts } = await makeApp();
  app.services.settings.update({ ui: { pie: { mode: 'mine', mine: ['tile:animate/fadeIn', 'tile:animate/trimDraw'] } } });
  let repeated = 0;
  app.repeatLast = () => { repeated++; };
  const key = (k) => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true }));
  pie.open(app, 100, 100);
  assert.equal(document.querySelectorAll('.pie-slot').length, 8);
  key('1');
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(pie.isOpen(), false);
  assert.equal(runs[0].id, 'quick.animate');
  pie.open(app, 100, 100);
  key('2'); // Draw On: the selection has no shape layers → explained, not run
  assert.equal(runs.length, 1);
  assert.equal(toasts.at(-1).kind, 'warn');
  app.state.set({ last: { toolId: 'quick.animate', args: {}, label: 'Fade In' } });
  pie.open(app, 100, 100);
  document.querySelector('.pie-centre').click();
  assert.equal(repeated, 1);
  pie.open(app, 100, 100);
  key('Escape');
  assert.equal(pie.isOpen(), false);
  assert.equal(document.querySelectorAll('.pie-ov').length, 0, 'overlay removed');
});
