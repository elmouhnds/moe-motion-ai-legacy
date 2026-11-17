'use strict';
/**
 * v0.37 — Object Cloner (Layout "Points": one clone on each point of a shape / mask) and Text Cloner (Layout
 * "In Place" + Split text: one text layer per word / letter, placed exactly where it was). docs/features/OBJECT_TEXT_CLONER.md
 * Points: mock-evaluated positions = features/grid/layouts.js place(). Text: every piece's comp box = the box its
 * word had in the original (the mock measures text with a simple font metric — tests/mock/ae-mock.js measureText).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { TA } = require('./fixtures/layout');
const { studioComp } = require('./fixtures/studio');
const L = require('../extension/features/grid/layouts');
const X = require('../extension/features/grid/expressions');

const tp = (Ly, mn) => Ly.property('ADBE Transform Group').property(mn);
const at = (Ly, mn, t) => tp(Ly, mn).valueAtTime(t, false);
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
const ctl = (Ly, name) => Ly._parade._children.find((f) => f.name === name)._children[0];
const HEX = Array.from({ length: 6 }, (_, j) => [960 + 300 * Math.cos((j * 60 - 90) * Math.PI / 180), 540 + 300 * Math.sin((j * 60 - 90) * Math.PI / 180)]);
const J = { LEFT: 7413, RIGHT: 7414, CENTER: 7415 };

async function pointsComp(extra = []) {
  const layers = [{ name: 'Star', selected: true, transform: TA({ pos: [200, 200] }), rect: { left: -40, top: -40, width: 80, height: 80 } }]
    .concat(extra)
    .concat([{ name: 'Hexagon', selected: true, shapes: [{ name: 'Shape 1', path: HEX.map((v) => v.map((c) => Math.round(c * 1000) / 1000)), closed: true, stroke: [1, 1, 1] }], transform: TA({ pos: [0, 0] }) }]);
  return createTestServices(studioComp(layers));
}

test('Clone on Points: one Star on each of the 6 points (the selected shape is the path); Face Center turns them along it; Point Offset shifts them', async () => {
  const { services, comp } = await pointsComp();
  const r = await services.executor.run('grid.build', { mode: 'points', orient: '2' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const items = comp._layers.filter((l) => l.name === 'Star' || /^MOE Clone \d+ · Star/.test(l.name));
  assert.equal(items.length, 6, 'the Star + 5 copies');
  assert.ok(r.verification.checks.some((c) => c.label === 'Points' && c.ok));
  const G = comp._layers.find((l) => l.name === 'MOE Grid 1');
  const verts = HEX.map((v) => v.map((c) => Math.round(c * 1000) / 1000));
  const ref = L.place(Object.assign(X.defaultParams('points'), { mode: 'points', vertices: verts, pointOffset: 0, order: 1, buildOrder: 1 }), 6);
  // items are in grid order: the source first, then the copies (Layers order in the comp is not the grid order)
  const byOrder = (ly) => { const m = /^MOE Clone (\d+)/.exec(ly.name); return m ? Number(m[1]) : 0; };
  items.sort((a, b) => byOrder(a) - byOrder(b));
  items.forEach((ly, i) => {
    const p = at(ly, 'ADBE Position', comp.time);
    assert.ok(near(p[0], ref[i].x) && near(p[1], ref[i].y), `item ${i} on point ${i}: ${p} vs ${ref[i].x},${ref[i].y}`);
    assert.ok(near(((at(ly, 'ADBE Rotate Z', comp.time) - ref[i].face) % 360 + 540) % 360 - 180, 0, 0.05), `item ${i} faces along the path`);
  });
  // Point Offset 1 → every item moves on to the next point (live, in Effect Controls)
  ctl(G, 'Point Offset').setValue(1);
  items.forEach((ly, i) => { const p = at(ly, 'ADBE Position', comp.time); assert.ok(near(p[0], ref[(i + 1) % 6].x) && near(p[1], ref[(i + 1) % 6].y), `offset item ${i}`); });
  await services.executor.restore(r.checkpointId);
  assert.ok(!comp._layers.some((l) => /^MOE (Clone|Grid)/.test(l.name)), 'copies and grid removed');
  assert.ok(near(at(comp._layers.find((l) => l.name === 'Star'), 'ADBE Position', 0)[0], 200), 'the Star is back');
});

test('Points refuses a path with one point, and needs a path layer when none is selected', async () => {
  const { services } = await createTestServices(studioComp([{ name: 'Star', selected: true, transform: TA({ pos: [200, 200] }) }, { name: 'Dot', selected: true, shapes: [{ name: 'S', path: [[100, 100]], stroke: [1, 1, 1] }], transform: TA({ pos: [0, 0] }) }]));
  const r = await services.executor.run('grid.build', { mode: 'points' });
  assert.notEqual(r.status, 'success');
  assert.match(JSON.stringify(r.errors || r), /at least 2 points/);
  const { services: s2 } = await createTestServices(studioComp([{ name: 'Star', selected: true, transform: TA({ pos: [200, 200] }) }]));
  const r2 = await s2.executor.run('grid.build', { mode: 'points' });
  assert.notEqual(r2.status, 'success');
  assert.match(JSON.stringify(r2.errors || r2), /whose points the clones sit on/);
});

/** The comp box of a piece (2D, no parent rotation / scale in these fixtures): position (+ parent position − parent anchor) − anchor·scale + rect·scale. */
function compBox(ly, t) {
  const r = ly.sourceRectAtTime(t), a = at(ly, 'ADBE Anchor Point', t), s = at(ly, 'ADBE Scale', t);
  let p = at(ly, 'ADBE Position', t);
  if (ly.parent) { const gp = at(ly.parent, 'ADBE Position', t), ga = at(ly.parent, 'ADBE Anchor Point', t); p = [p[0] + gp[0] - ga[0], p[1] + gp[1] - ga[1]]; }
  return [p[0] + (r.left - a[0]) * s[0] / 100, p[1] + (r.top - a[1]) * s[1] / 100, r.width * s[0] / 100, r.height * s[1] / 100];
}
async function textComp(text, style, pos = [960, 540], scale = 100) {
  const tf = TA({ pos }).map((q) => (q.matchName === 'ADBE Scale' ? Object.assign({}, q, { value: [scale, scale] }) : q));
  const fx = studioComp([{ name: 'Title', selected: true, text, measure: true, textStyle: style, transform: tf }]);
  return createTestServices(fx);
}

test('Text Cloner · Words (centred, 2 lines): one layer per word, each exactly where its word was; the title is hidden; it stays in place; restore', async () => {
  const { services, comp } = await textComp('Make it move\rnow', { fontSize: 100, justification: J.CENTER });
  const r = await services.executor.run('grid.build', { mode: 'keep', splitText: 'words' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const words = comp._layers.filter((l) => /^MOE Word \d+ · Title$/.test(l.name));
  assert.deepEqual(words.map((w) => w.property('ADBE Text Properties').property('ADBE Text Document').value.text), ['Make', 'it', 'move', 'now']);
  const title = comp._layers.find((l) => l.name === 'Title');
  assert.equal(title.enabled, false, 'the original is hidden');
  // the metric: 55 px per letter, 30 per space; line 1 = 610 px centred on x 960; line 2 = 165 px; leading 120
  const want = [[655, 465, 220, 100], [905, 465, 110, 100], [1045, 465, 220, 100], [877.5, 585, 165, 100]];
  words.forEach((w, i) => compBox(w, comp.time).forEach((v, j) => assert.ok(near(v, want[i][j], 0.01), `${w.name} box[${j}] ${v} vs ${want[i][j]}`)));
  assert.ok(r.verification.checks.some((c) => c.label === 'Layout read-back' && c.ok && /stay exactly where/.test(c.detail)), 'In Place: the words did not move (comp boxes read back)');
  await services.executor.restore(r.checkpointId);
  assert.ok(!comp._layers.some((l) => /^MOE (Word|Grid)/.test(l.name)), 'pieces and grid removed');
  assert.equal(title.enabled, true, 'the title is back');
});

test('Text Cloner · Arabic (right to left, right-justified, scaled 50 %): words in their visual places; letters are refused', async () => {
  const style = { fontSize: 100, justification: J.RIGHT, direction: 2 };
  const { services, comp } = await textComp('مرحبا بالعالم', style, [1500, 300], 50);
  const r = await services.executor.run('grid.build', { mode: 'keep', splitText: 'words' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const words = comp._layers.filter((l) => /^MOE Word \d+ · Title$/.test(l.name));
  assert.equal(words.length, 2);
  // v0.99.5: After Effects selects a layer it ADDS and deselects the rest (the mock does too now),
  // so this step starts from the selection it is about.
  comp._layers.forEach((l) => { l.selected = l.name === 'Title'; });
  // 50 px per Arabic letter: "مرحبا" 250 px at the right edge, then a 30 px space, then "بالعالم" 350 px — all × 0.5
  const want = [[1500 - 125, 300 - 37.5, 125, 50], [1500 - 315, 300 - 37.5, 175, 50]];
  words.forEach((w, i) => compBox(w, comp.time).forEach((v, j) => assert.ok(near(v, want[i][j], 0.01), `${w.name} box[${j}] ${v} vs ${want[i][j]}`)));
  await services.executor.restore(r.checkpointId);
  const r2 = await services.executor.run('grid.build', { mode: 'keep', splitText: 'letters' });
  assert.notEqual(r2.status, 'success');
  assert.match(JSON.stringify(r2.errors || r2), /Arabic letters disconnect/);
  assert.ok(!comp._layers.some((l) => /^MOE (Letter|Word|Grid)/.test(l.name)) && comp._layers.find((l) => l.name === 'Title').enabled, 'nothing left behind');
});

test('Letters Rise + an Effector on the words: the build animates, effectors reach each word; refuses still-needed cases', async () => {
  const { services, comp } = await textComp('MOVE', { fontSize: 100, justification: J.LEFT }, [400, 500]);
  const r = await services.executor.run('grid.build', { mode: 'keep', splitText: 'letters', animateIn: true, buildStyle: '3', buildOrder: '1', stagger: 70 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const letters = comp._layers.filter((l) => /^MOE Letter \d+ · Title$/.test(l.name));
  assert.equal(letters.length, 4);
  const T = comp.time;
  assert.ok(letters.every((ly) => at(ly, 'ADBE Opacity', T) < 1), 'hidden at the start of the build');
  const end = T + 1.5;
  letters.forEach((ly, i) => assert.ok(near(compBox(ly, end)[0], 400 + i * 55, 0.01), `letter ${i} back in place at the end of the build`));
  const G = comp._layers.find((l) => l.name === 'MOE Grid 1');
  comp._layers.forEach((l) => { l.selected = l === G; });
  const e = await services.executor.run('grid.effector', { type: 'plain', falloff: 'linear', size: 100, scale: 50, sweep: true });
  assert.equal(e.status, 'success', JSON.stringify(e.verification || e.errors));
  const mid = comp.time + 1; // the sweep runs from the playhead for 2 s: halfway, the edge is among the letters
  const sc = letters.map((ly) => at(ly, 'ADBE Scale', mid)[0]);
  assert.ok(new Set(sc.map((v) => Math.round(v))).size > 1, `the sweep reaches the letters one by one (${sc})`);
  // a text layer with Source Text keyframes is refused before anything is made
  const fx = studioComp([{ name: 'Keyed', selected: true, text: 'Hi there', measure: true, textKeys: [0, 1], transform: TA({ pos: [100, 100] }) }]);
  const { services: s2, comp: c2 } = await createTestServices(fx);
  const r2 = await s2.executor.run('grid.build', { mode: 'keep', splitText: 'words' });
  assert.notEqual(r2.status, 'success');
  assert.match(JSON.stringify(r2.errors || r2), /still text/);
  assert.equal(c2._layers.length, 1, 'nothing added');
});

test('Library: Clone on Points, Text Cloner and Letters Rise are in Clone mode (full rows); Layout menus list Points and In Place', () => {
  const S = require('../extension/app/ui/studio/sections');
  const lay = S.byId('layout');
  for (const [id, mode] of [['clonePoints', 'points'], ['textWords', 'keep'], ['textLetters', 'keep']]) {
    const t = lay.tiles.find((x) => x.id === id);
    assert.ok(t && t.tool === 'grid.build' && t.args.mode === mode && t.tags.includes('Clone'), id);
  }
  const AE = require('../extension/app/ui/layoutAE');
  const arr = AE.TABS.find((t) => t.id === 'ae-layer').groups.find((g) => g.id === 'arrange');
  const clone = arr.modes.find(([m]) => m === 'clone')[2];
  assert.equal(clone.length % 3, 0);
  ['clonePoints', 'textWords', 'textLetters'].forEach((id) => assert.ok(clone.includes(id) && arr.ids.includes(id), id));
  assert.deepEqual(X.MODE_MENU.slice(6), ['Points', 'In Place']);
});
