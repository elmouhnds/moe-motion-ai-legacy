'use strict';
/** v0.91 — MOE Tracer (docs/features/TRACER.md): lines between a grid's items that follow them. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { gridItems } = require('./fixtures/layout');
const TR = require('../extension/features/grid/tracer');
const { pathAddr } = require('../extension/features/grid/tracerTool');

const tp = (L, mn) => L.property('ADBE Transform Group').property(mn);
const at = (L, mn, t) => tp(L, mn).valueAtTime(t, false);
const cards = (comp) => comp._layers.filter((l) => /^Card/.test(l.name));
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const sel = (comp, pick) => comp._layers.forEach((l) => { l.selected = pick(l); });
const G9 = (cols = 3, n = 9, off = 0) => Array.from({ length: n }, (_, i) => ({ name: `i${i}`, p: [(i % cols) * 100 + (Math.floor(i / cols) % 2 ? off : 0), Math.floor(i / cols) * 80] }));

async function gridWith(n = 9, extra = {}) {
  const r0 = await createTestServices(gridItems(n));
  const r = await r0.services.executor.run('grid.build', Object.assign({ mode: 'rect', columns: 3, spacingX: 150, spacingY: 120 }, extra));
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const G = r0.comp._layers.find((l) => l.name === 'MOE Grid 1');
  sel(r0.comp, (l) => l === G);
  return Object.assign(r0, { G });
}
/** The points of path i of the tracer at time t (its Path expression, evaluated by the mock). */
const pathOf = (T, i, t) => T.property('ADBE Root Vectors Group').property(1).property('ADBE Vectors Group').property(i).property('ADBE Vector Shape').valueAtTime(t, false);
/** An item's anchor in comp space at time t (the grid null is not rotated or scaled in these tests). */
const compPt = (comp, G, name, t) => { const L = comp._layers.find((l) => l.name === name), p = at(L, 'ADBE Position', t), g = at(G, 'ADBE Position', t); return [g[0] + p[0], g[1] + p[1]]; };

test('the plan: order, rows, grid, zig-zag and hub on a 3 × 3; honeycomb rows still group; limits', () => {
  const it = G9();
  assert.deepEqual(TR.lines('order', it), [{ names: it.map((x) => x.name), closed: false }]);
  assert.equal(TR.lines('order', it, { closed: true })[0].closed, true);
  assert.deepEqual(TR.lines('rows', it).map((l) => l.names), [['i0', 'i1', 'i2'], ['i3', 'i4', 'i5'], ['i6', 'i7', 'i8']]);
  const g = TR.lines('grid', it).map((l) => l.names);
  assert.equal(g.length, 6);
  assert.deepEqual(g.slice(3), [['i0', 'i3', 'i6'], ['i1', 'i4', 'i7'], ['i2', 'i5', 'i8']], 'columns, top to bottom');
  assert.deepEqual(TR.lines('zigzag', it)[0].names, ['i0', 'i1', 'i2', 'i5', 'i4', 'i3', 'i6', 'i7', 'i8']);
  const hub = TR.lines('hub', it);
  assert.equal(hub.length, 8); assert.ok(hub.every((l) => l.names[0] === 'i4' && l.names.length === 2), 'the middle item is the hub');
  // a random order of the same items gives the same rows (found from positions, not from the order)
  const shuffled = [4, 8, 0, 6, 2, 7, 1, 5, 3].map((i) => it[i]);
  assert.deepEqual(TR.lines('rows', shuffled).map((l) => l.names), [['i0', 'i1', 'i2'], ['i3', 'i4', 'i5'], ['i6', 'i7', 'i8']]);
  // honeycomb: every other row is shifted — rows are still rows; "columns" join every second row
  const honey = G9(3, 9, 50);
  assert.deepEqual(TR.lines('rows', honey).map((l) => l.names.length), [3, 3, 3]);
  assert.ok(TR.lines('grid', honey).every((l) => l.names.length >= 2));
  // an incomplete last row, one item alone → no line for it in rows
  assert.deepEqual(TR.lines('rows', G9(3, 7)).map((l) => l.names.length), [3, 3]);
  assert.deepEqual(TR.lines('order', [it[0]]), []);
  assert.equal(TR.size(TR.lines('hub', G9(20, 250))).ok, false, 'too many lines is refused');
  assert.equal(TR.size(TR.lines('order', G9(20, 250))).ok, true);
  assert.match(TR.code({ names: ['A "x"', 'B'], closed: true }, 'MOE Grid 1'), /^\/\/ MOE Tracer · MOE Grid 1\n/);
  assert.match(TR.code({ names: ['A "x"', 'B'], closed: true }, 'G'), /thisComp\.layer\("A \\"x\\""\)/, 'names are escaped');
  assert.match(TR.code({ names: ['A', 'B'], closed: true }, 'G'), /createPath\(P, \[\], \[\], true\);$/);
});

test('Tracer on a grid: one shape layer; every point sits on its item; the lines follow an effector over time; Restore removes it', async () => {
  for (const mode of ['order', 'rows', 'grid', 'zigzag', 'hub']) {
    const a = await gridWith(9);
    const before = a.comp._layers.length;
    const r = await a.services.executor.run('grid.tracer', { mode, width: 3, colour: '#00FFAA' });
    assert.equal(r.status, 'success', `${mode}: ${JSON.stringify(r.verification || r.errors)}`);
    const T = a.comp._layers.find((l) => l.name === 'MOE Tracer · MOE Grid 1');
    assert.ok(T && a.comp._layers.length === before + 1, mode);
    assert.ok(T.index > Math.max(...cards(a.comp).map((L) => L.index)), 'behind the items');
    const ls = r.result.lines;
    assert.equal(ls.length, { order: 1, rows: 3, grid: 6, zigzag: 1, hub: 8 }[mode]);
    // now make the items move: a Wave effector
    sel(a.comp, (l) => l === a.G);
    assert.equal((await a.services.executor.run('grid.effector', { type: 'wave', falloff: 'all', moveY: 60, moveX: 20, scale: 0, waveLength: 4, waveSpeed: 0.7 })).status, 'success');
    for (const t of [0, 0.37, 1.2]) ls.forEach((l, i) => {
      const sh = pathOf(T, i + 1, t);
      assert.equal(sh.vertices.length, l.names.length, `${mode} line ${i}`);
      l.names.forEach((nm, j) => { const want = compPt(a.comp, a.G, nm, t); assert.ok(near(sh.vertices[j][0], want[0], 0.01) && near(sh.vertices[j][1], want[1], 0.01), `${mode} t ${t} line ${i} point ${j} (${nm}): ${sh.vertices[j]} vs ${want}`); });
    });
    assert.notDeepEqual(pathOf(T, 1, 0).vertices, pathOf(T, 1, 0.37).vertices, `${mode}: the line moves with the items`);
    await a.services.executor.restore(r.checkpointId);
    assert.ok(!a.comp._layers.some((l) => /^MOE Tracer/.test(l.name)), 'Restore removes the tracer');
    assert.equal(cards(a.comp).length, 9, 'and nothing else');
  }
});

test('running it again replaces the grid\'s own tracer; a duplicate item name and a single item are refused before anything is made', async () => {
  const a = await gridWith(9);
  assert.equal((await a.services.executor.run('grid.tracer', { mode: 'order' })).status, 'success');
  // v0.99.5: After Effects selects a layer it ADDS and deselects the rest, so the tracer layer the first
  // run made is what is selected now — pick the grid again, the way a user has to, before running it again.
  sel(a.comp, (l) => l === a.G);
  const r2 = await a.services.executor.run('grid.tracer', { mode: 'grid', closed: true });
  assert.equal(r2.status, 'success', JSON.stringify(r2.verification || r2.errors));
  assert.equal(a.comp._layers.filter((l) => /^MOE Tracer/.test(l.name)).length, 1, 'one tracer per grid');
  assert.equal(r2.result.replaced, 1); assert.equal(r2.result.lines.length, 6);
  // the stroke the user asked for
  const b = await gridWith(9);
  const rb = await b.services.executor.run('grid.tracer', { mode: 'order', closed: true, width: 5, colour: '#FF0000' });
  const T = b.comp._layers.find((l) => /^MOE Tracer/.test(l.name));
  assert.equal(pathOf(T, 1, 0).closed, true);
  assert.equal(rb.result.set.targets.length, 1);
  // duplicate name
  const c = await gridWith(9);
  cards(c.comp)[1].name = cards(c.comp)[0].name;
  const n0 = c.comp._layers.length;
  const rc = await c.services.executor.run('grid.tracer', { mode: 'order' });
  assert.notEqual(rc.status, 'success'); assert.match(JSON.stringify(rc.errors || rc.error || rc), /named/);
  assert.equal(c.comp._layers.length, n0, 'nothing was made');
  // no grid selected
  sel(c.comp, () => false);
  assert.notEqual((await c.services.executor.run('grid.tracer', { mode: 'order' })).status, 'success');
  assert.deepEqual(pathAddr(7, 3).indices, [null, 1, null, 3, null]);
});

test('the tracer tiles exist in Layout › Clone and its expression carries the layers\' permanent ids (rename-safe links)', async () => {
  const lay = require('../extension/app/ui/studio/sections').byId('layout');
  for (const id of ['trOrder', 'trGrid', 'trZig', 'trHub']) { const t = lay.tiles.find((x) => x.id === id); assert.ok(t && t.tool === 'grid.tracer' && t.tags.includes('Clone'), id); }
  const a = await gridWith(4);
  await a.services.executor.run('grid.tracer', { mode: 'order' });
  const T = a.comp._layers.find((l) => /^MOE Tracer/.test(l.name));
  const code = T.property('ADBE Root Vectors Group').property(1).property('ADBE Vectors Group').property(1).property('ADBE Vector Shape')._expression;
  const c0 = cards(a.comp)[0];
  assert.match(code, new RegExp(`thisComp\\.layer\\(/\\*MOE-LINK:${c0.id}\\*/"${c0.name}"\\)`));
  assert.match(code, /^\/\/ MOE Tracer · MOE Grid 1\n/);
});
