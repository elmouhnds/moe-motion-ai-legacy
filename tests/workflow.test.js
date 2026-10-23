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

test('sidebar: groups cover every section once, Home first; Ctrl 1–9 follows NAV', () => {
  const ids = S.NAV;
  assert.equal(ids[0], 'home');
  assert.equal(new Set(ids).size, ids.length, 'no duplicates');
  for (const sec of S.SECTIONS) assert.ok(ids.includes(sec.id), sec.id);
  assert.deepEqual(S.GROUPS.map((g) => g.label), ['Animate', 'Design', 'Layout', 'Finish', 'Utilities']);
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
