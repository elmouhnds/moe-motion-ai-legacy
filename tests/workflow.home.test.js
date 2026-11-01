'use strict';
/**
 * v0.28 — Home organised the way a motion designer works (app/ui/workflow.js) and the floating
 * Assistant (core/ai/assistant.js + app/ui/assistant.js). docs/features/WORKFLOW_HOME.md, ASSISTANT.md.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../extension/app/ui/workflow');
const AE = require('../extension/app/ui/layoutAE');
const A = require('../extension/app/ui/actions');
const qb = require('../extension/app/ui/quickbar');
const BAR = require('../extension/features/quick/bar');
const studio = require('../extension/app/ui/studio/sections');
const assistant = require('../extension/core/ai/assistant');
const { createTestServices } = require('./helpers/harness');
const fx = require('./fixtures/comps');

const memStore = (data = {}) => ({ data, get: (k, f) => (k in data ? JSON.parse(JSON.stringify(data[k])) : f), set: (k, v) => { data[k] = v; }, update: (k, f, fn) => { data[k] = fn(k in data ? data[k] : f); } });

test('stages: Animate · Arrange · Design · Finish · Deliver; every group of the shared organisation exactly once; core before more', () => {
  assert.deepEqual(W.STAGES.map((s) => s.label), ['Animate', 'Arrange', 'Design', 'Finish', 'Deliver']);
  const placed = [];
  for (const st of W.STAGES) {
    const gs = W.stageGroups(st);
    assert.equal(gs.length, st.groups.length, `${st.id}: every group resolves`);
    assert.ok(gs.every((g) => ['core', 'more'].includes(g.tier)));
    // everyday groups come first, the rare ones after "More in …"
    const firstMore = gs.findIndex((g) => g.tier === 'more');
    if (firstMore >= 0) assert.ok(gs.slice(firstMore).every((g) => g.tier === 'more'), `${st.id}: no core group after a more group`);
    assert.ok(gs.some((g) => g.tier === 'core'), `${st.id} has open groups`);
    gs.forEach((g) => placed.push(`${g.tab.id}/${g.group.id}`));
    assert.ok(!studio.byId(st.id) && !AE.TAB_IDS.includes(st.id), `${st.id} is not a page or tab id`);
  }
  assert.deepEqual([...placed].sort(), AE.TABS.flatMap((t) => t.groups.map((g) => `${t.id}/${g.id}`)).sort());
  // the most-used stage comes first and leads with Ease
  assert.deepEqual(W.STAGES[0].groups[0].slice(0, 2), ['ae-keys', 'ease']);
  // every page has a stage for its crumb
  for (const t of AE.TABS) for (const page of t.owns) assert.ok(W.stageOfView(page), `stage of ${page}`);
  assert.equal(W.stageOfView('looks').id, 'st-design');
  assert.equal(W.stageOfView('deliver').id, 'st-deliver');
  // a stage fits every kind of selection somewhere
  for (const k of ['keys', 'layer', 'layers', 'text', 'shapes', 'shapesMany', 'none']) assert.ok(W.STAGES.some((s) => s.fits.includes(k)), k);
});

test('Everyday: the default Quick Bar starts with the ten everyday tools (Alt+1…0); housekeeping left the default bar', () => {
  assert.deepEqual(BAR.DEFAULT_BAR.slice(0, 10), W.EVERYDAY);
  W.EVERYDAY.forEach((id) => assert.ok(qb.byId(id), id));
  assert.ok(!BAR.DEFAULT_BAR.includes('purge') && !BAR.DEFAULT_BAR.includes('revealFolder'), 'rare housekeeping is not on the default bar');
  assert.equal(new Set(BAR.DEFAULT_BAR).size, BAR.DEFAULT_BAR.length);
  BAR.DEFAULT_BAR.forEach((id) => assert.ok(qb.byId(id), `bar: ${id}`));
  assert.deepEqual(W.SLOT_KEYS, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
  // runSlot runs the slot's action (and refuses an empty slot)
  const runs = [];
  const app = { services: { store: memStore({ 'quick-bar': ['k_easy', 'reverse'] }), registry: { get: () => ({ params: {} }) } }, runTool: async (tool, args, o) => { runs.push([tool, o.label]); return null; }, toast() {} };
  assert.equal(qb.runSlot(app, 1).id, 'reverse');
  assert.equal(runs[0][0], 'quick.reverseKeys');
  assert.equal(qb.runSlot(app, 5), false);
});

test('Power tools: every card opens a real page and its one-click start exists; cards learn and shrink', () => {
  assert.ok(W.POWER.length >= 6);
  for (const p of W.POWER) {
    const open = A.resolve(p.open);
    assert.ok(open && open.nav, `${p.id}: opens ${p.open}`);
    if (p.try) assert.ok(A.resolve(p.try), `${p.id}: try ${p.try}`);
    assert.ok(p.what && p.when && p.needs && p.steps.length === 3, `${p.id}: explains itself`);
    p.fits.forEach((k) => assert.ok(['keys', 'layer', 'layers', 'text', 'shapes', 'shapesMany', 'none'].includes(k)));
  }
  assert.equal(new Set(W.POWER.map((p) => p.id)).size, W.POWER.length);
  const st = memStore();
  assert.equal(W.isLearned(st, 'grid'), false);
  for (let i = 1; i < W.LEARNED_AT; i++) W.learn(st, 'grid');
  assert.equal(W.isLearned(st, 'grid'), false);
  W.learn(st, 'grid');
  assert.equal(W.isLearned(st, 'grid'), true, `small after ${W.LEARNED_AT} uses`);
  W.gotIt(st, 'ease');
  W.learn(st, 'ease');
  assert.equal(st.data[W.LEARN_KEY].ease, 'got', '"Got it" stays');
  W.explainAgain(st);
  assert.equal(W.isLearned(st, 'grid'), false);
});

test('formats: shape, ratio, size and where it goes, from the comp (pixel aspect included)', () => {
  const f = (w, h, extra) => W.formatOf(Object.assign({ width: w, height: h, pixelAspect: 1, frameRate: 25 }, extra));
  assert.deepEqual([f(1080, 1920).shape, f(1080, 1920).ratio, f(1080, 1920).size], ['vertical', '9:16', 'HD']);
  assert.match(f(1080, 1920).use, /Reels/);
  assert.deepEqual([f(1080, 1350).shape, f(1080, 1350).ratio], ['portrait', '4:5']);
  assert.deepEqual([f(1080, 1080).shape, f(1080, 1080).ratio], ['square', '1:1']);
  assert.deepEqual([f(3840, 2160).shape, f(3840, 2160).ratio, f(3840, 2160).size], ['landscape', '16:9', '4K']);
  assert.deepEqual([f(1280, 720).size, f(2560, 1440).size], ['720p', '2.5K']);
  assert.equal(f(2560, 1080).shape, 'wide');
  assert.equal(f(1440, 1080, { pixelAspect: 1.333 }).ratio, '16:9', 'anamorphic HDV reads as 16:9');
  assert.equal(f(1440, 1080).ratio, '1.33:1', 'not exactly 16:9 → the real ratio');
  assert.equal(f(1920, 1080, { frameRate: 29.97 }).fps, 29.97);
  assert.equal(W.formatOf(null), null);
});

test('safe area: sized for the comp, social keeps clear of app buttons; the guides tool accepts it', async () => {
  assert.deepEqual(W.safeArgs({ width: 1080, height: 1920 }), { columns: 1, rows: 1, gutterX: 0, gutterY: 0, marginX: 65, marginY: 269, center: true });
  assert.deepEqual(W.safeArgs({ width: 1920, height: 1080 }), { columns: 1, rows: 1, gutterX: 0, gutterY: 0, marginX: 96, marginY: 54, center: true }, 'video = classic 5 % title safe');
  assert.equal(W.safeArgs({ width: 1080, height: 1080 }).marginY, 86);
  const { services } = await createTestServices({ comp: { name: 'Reel', width: 1080, height: 1920, frameRate: 30, duration: 10, layers: [{ name: 'Title', type: 'text', selected: true }] } });
  const r = await services.executor.run('grid.guides', W.safeArgs({ width: 1080, height: 1920 }), { origin: 'user' });
  assert.equal(r.status, 'success', JSON.stringify(r.errors || r.reasons));
});

test('suggestions: few, for what is in front of you, dismissable per comp; every one runs something real', () => {
  const comp = { id: 7, width: 1080, height: 1920, numLayers: 5 };
  const lay = (n, type) => Array.from({ length: n }, (_, i) => ({ id: i + 1, type: type || 'shape', name: `L${i}` }));
  const keysCtx = { comp, layers: lay(1), properties: [{ selectedKeys: [1, 2, 3] }] };
  let t = W.tips(keysCtx, {});
  assert.deepEqual(t.map((x) => x.id), ['ease', 'safe']);
  const many = W.tips({ comp, layers: lay(4, 'text'), properties: [] }, { brand: { name: 'Nile' } });
  assert.deepEqual(many.map((x) => x.id), ['stagger', 'brand', 'safe']);
  assert.ok(many.length <= 3);
  for (const x of many.concat(t)) {
    if (x.ref) assert.ok(A.resolve(x.ref), x.ref);
    else { assert.equal(x.tool, 'grid.guides'); assert.ok(x.args.marginY > 0); }
  }
  // landscape comps do not nag about social safe areas
  assert.deepEqual(W.tips({ comp: Object.assign({}, comp, { width: 1920, height: 1080 }), layers: lay(1), properties: [{ selectedKeys: [1, 2] }] }, {}).map((x) => x.id), ['ease']);
  // dismissed for this comp only
  const st = memStore();
  W.dismissTip(st, 7, 'safe');
  t = W.tips(keysCtx, { dismissed: W.dismissedTips(st) });
  assert.deepEqual(t.map((x) => x.id), ['ease']);
  assert.deepEqual(W.tips(Object.assign({}, keysCtx, { comp: Object.assign({}, comp, { id: 8 }) }), { dismissed: W.dismissedTips(st) }).map((x) => x.id), ['ease', 'safe']);
  assert.deepEqual(W.tips({ comp: null }, {}), []);
  for (let i = 0; i < 250; i++) W.dismissTip(st, i, 'x');
  assert.equal(st.data[W.TIP_KEY].length, 200, 'the list stays small');
});

test('projects: each AE project remembers its client; switching projects switches the client', () => {
  const K = require('../extension/features/brand/kit');
  const brandsList = [{ id: 'b1', name: 'Nile' }, { id: 'b2', name: 'Tomato' }];
  const brands = { list: () => brandsList, get: (id) => brandsList.find((b) => b.id === id) || null };
  const st = memStore();
  const ctx = (name) => ({ project: { name } });
  K.setActive(st, 'b1');
  assert.equal(W.syncProject(st, ctx('Nile_Q3.aep'), brands, null).switched, null);
  assert.equal(st.data[W.PROJ_KEY]['Nile_Q3.aep'].brandId, 'b1', 'learned');
  K.setActive(st, 'b2');
  W.syncProject(st, ctx('Tomato_Promo.aep'), brands, 'Nile_Q3.aep');
  assert.equal(st.data[W.PROJ_KEY]['Tomato_Promo.aep'].brandId, 'b2');
  // back to the Nile project: the client follows
  const r = W.syncProject(st, ctx('Nile_Q3.aep'), brands, 'Tomato_Promo.aep');
  assert.equal(r.switched.name, 'Nile');
  assert.equal(K.activeBrand(st, brands).id, 'b1');
  // same project again: nothing switches; untitled projects are never remembered
  assert.equal(W.syncProject(st, ctx('Nile_Q3.aep'), brands, 'Nile_Q3.aep').switched, null);
  W.syncProject(st, ctx('Untitled Project'), brands, 'Nile_Q3.aep');
  assert.ok(!('Untitled Project' in st.data[W.PROJ_KEY]));
  // a deleted client is not switched to
  st.data[W.PROJ_KEY]['Old.aep'] = { brandId: 'gone', at: 1 };
  assert.equal(W.syncProject(st, ctx('Old.aep'), brands, 'Nile_Q3.aep').switched, null);
  // memory is capped
  for (let i = 0; i < 80; i++) { K.setActive(st, i % 2 ? 'b1' : 'b2'); st.data[W.PROJ_KEY][`P${i}.aep`] = { brandId: 'b1', at: i }; }
  K.setActive(st, 'b2');
  W.syncProject(st, ctx('Last.aep'), brands, 'P1.aep');
  assert.ok(Object.keys(st.data[W.PROJ_KEY]).length <= 60);
  assert.ok('Last.aep' in st.data[W.PROJ_KEY]);
});

test('offline assistant: Arabic and English words → tool keywords (whole words), and the matching power cards', () => {
  assert.deepEqual(W.keywordsOf('عايز الكلام يدخل كلمة كلمة'), ['typewriter', 'in'], '"عايز" is not "ايز"');
  assert.deepEqual(W.keywordsOf('اعمل ايز للكيز'), ['ease']);
  assert.deepEqual(W.keywordsOf('وزعهم على دايرة').sort(), ['distribute', 'ring']);
  assert.deepEqual(W.keywordsOf('خلفية متحركة للفيديو'), ['background'], '"فيديو" is not "فيد"');
  assert.deepEqual(W.keywordsOf('make these keys snappy with overshoot'), ['keys', 'snappy', 'overshoot']);
  assert.deepEqual(W.keywordsOf(''), []);
  assert.ok(W.keywordsOf('a b c d e f g h i j k l m n o p q r s t u v w x y z ab cd ef gh ij kl mn op qr st').length <= 6);
  assert.equal(W.powerFor('زجاج على اللوجو')[0].id, 'thickGlass');
  assert.equal(W.powerFor('grid of logos')[0].id, 'grid');
  assert.deepEqual(W.powerFor(''), []);
  for (const k of Object.keys(W.PROMPTS)) assert.equal(W.PROMPTS[k].length, 3, k);
});

test('assistant (Claude): answer + plan in one structured reply; history capped; prompt deterministic and bilingual', async () => {
  const schema = assistant.assistantSchema({ list: () => [{ id: 'quick.reverseKeys', name: 'R', description: 'd', params: {}, ai: { callable: true } }] });
  assert.deepEqual(schema.required, ['answer', 'summary', 'steps', 'warnings', 'clarification']);
  assert.equal(schema.properties.answer.type, 'string');
  assert.deepEqual(schema.properties.steps.items.properties.tool.enum, ['quick.reverseKeys']);
  const hist = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `t${i} ${'x'.repeat(900)}` })).concat([{ role: 'system', text: 'nope' }, null]);
  const c = assistant.compactHistory(hist);
  assert.equal(c.length, assistant.HISTORY_TURNS);
  assert.ok(c.every((x) => x.text.length <= assistant.HISTORY_CHARS && x.role !== 'system'));
  assert.match(c[0].text, /^t4 /);

  const calls = [];
  const http = { request: async (req) => { calls.push(JSON.parse(req.body)); return { status: 200, headers: {}, body: JSON.stringify({ model: 'claude-opus-5-5', stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: 'text', text: JSON.stringify({ answer: 'خليها سريعة', summary: 'Reverse', steps: [{ tool: 'quick.reverseKeys', args_json: '{}', reason: 'r' }], warnings: [], clarification: '' }) }] }) }; } };
  const { services } = await createTestServices(fx.easeComp(), { http, apiKey: 'sk-ant-test-abcdefgh' });
  const ctx = await services.executor.readContext();
  const res = await services.assistant.ask('اعكس الكيز', ctx, [{ role: 'user', text: 'before' }], W.formatOf(ctx.comp));
  assert.equal(res.answer, 'خليها سريعة');
  const body = calls[0];
  const user = JSON.parse(body.messages[0].content);
  assert.equal(user.request, 'اعكس الكيز');
  assert.deepEqual(user.conversation, [{ role: 'user', text: 'before' }]);
  assert.ok(user.format && user.format.shape, 'the comp format travels as data');
  assert.ok(!('format' in JSON.parse(JSON.stringify(body.system))), 'volatile data stays out of the system prompt');
  assert.match(body.system[0].text, /MOE Assistant/);
  assert.match(body.system[0].text, /Egyptian Arabic/);
  const again = assistant.systemPrompt(services.registry);
  assert.equal(body.system[0].text, again, 'system prompt is deterministic (prompt caching)');
  // the plan is re-validated locally like any Copilot plan; nothing ran
  const v = await services.assistant.validate(res, ctx);
  assert.equal(v.steps[0].tool, 'quick.reverseKeys');
  assert.equal(services.store.get('history-count', 0), 0);
});

test('assistant without a key: the request never leaves the panel and the error code lets the UI answer locally', async () => {
  const { services } = await createTestServices(fx.easeComp(), {});
  await assert.rejects(services.assistant.ask('make it snappy', {}, [], null), (e) => e.code === 'AI_NO_KEY');
});

test('UI sources: one floating assistant in every style, Alt slots, stage jumps, project sync wired in the shell', () => {
  const fs = require('fs');
  const path = require('path');
  const shell = fs.readFileSync(path.join(__dirname, '../extension/app/ui/shell.js'), 'utf8');
  assert.equal((shell.match(/require\('\.\/assistant'\)\.render\(app\)/g) || []).length, 2, 'both renders show the assistant');
  assert.ok(!/copilot\.render\(app\)/.test(shell), 'the old bottom bar is gone');
  assert.match(shell, /quickbar\.runSlot\(app, n\)/);
  assert.match(shell, /e\.code === 'Backquote'/);
  assert.match(shell, /syncProject\(services\.store, ctx, services\.brands, lastProject\)/);
  assert.match(shell, /layoutBento'\)\.jumpTo\(app/);
  const css = fs.readFileSync(path.join(__dirname, '../extension/css/app.css'), 'utf8');
  // no hover style may move or resize the button (UI rule v0.6.2)
  const hover = css.match(/\.as-fab:hover \{[^}]*\}/)[0];
  assert.ok(!/transform|width|height|margin|padding/.test(hover), hover);
});
