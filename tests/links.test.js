'use strict';
/**
 * v0.62 rename-safe links (docs/features/LINKS.md; the study's defect S1, "high": renaming the controller null
 * breaks every expression). MOE expressions carry each named layer's permanent id; Relink writes the new name.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { studioComp } = require('./fixtures/studio');
const { TA } = require('./fixtures/layout');
const S = require('../extension/app/ui/studio/sections');
const LW = require('../extension/app/ui/linkwatch');

const nulls = (n) => studioComp(Array.from({ length: n }, (_, i) => ({ name: `N${i}`, selected: true, transform: TA({ pos: [300 + i * 40, 300] }) })), { comp: { time: 1 } });
const posOf = (L) => L.property('ADBE Transform Group').property('ADBE Position');
const GRID = { mode: 'rect', columns: 2, spacingX: 150, spacingY: 120, centerAnchors: false };

/** Every expression in the comp, with its layer. */
function expressions(comp) {
  const out = [];
  const walk = (n, L) => { if (!n) return; if (n._expression) out.push({ L, code: n._expression }); (n._children || []).forEach((c) => walk(c, L)); };
  comp._layers.forEach((L) => ['ADBE Transform Group', 'ADBE Effect Parade', 'ADBE Root Vectors Group', 'ADBE Text Properties'].forEach((g) => { try { walk(L.property(g), L); } catch (e) { /* none */ } }));
  return out;
}

test('a Grid survives renaming its null: the break is seen, Relink fixes every expression, values identical, one undo step, Restore', async () => {
  const { services, comp, env } = await createTestServices(nulls(4));
  const r = await services.executor.run('grid.build', GRID);
  assert.equal(r.status, 'success');
  const g = comp._layers.find((l) => l.id === r.result.nullId), item = comp._layers.find((l) => l.name === 'N1');
  assert.match(posOf(item)._expression, new RegExp(`thisComp\\.layer\\(/\\*MOE-LINK:${g.id}\\*/"MOE Grid 1"\\)`));
  const before = comp._layers.map((L) => JSON.stringify(posOf(L).valueAtTime(1, false)));
  g.name = 'Hero "Grid"'; // quotes in the new name too
  assert.throws(() => posOf(item).valueAtTime(1, false), /layer does not exist/, 'the rename breaks it, as in After Effects');
  const scan = await services.host.call('links.scan', { compId: comp.id });
  assert.deepEqual(scan.renamed.map((x) => [x.from, x.to]), [['MOE Grid 1', 'Hero "Grid"']]);
  const g0 = env.undo.groups.length;
  const rr = await services.executor.run('links.relink', {});
  assert.equal(rr.status, 'success');
  assert.deepEqual(env.undo.groups.slice(g0), ['MOE: Relink'], 'one undo step');
  assert.deepEqual(comp._layers.map((L) => JSON.stringify(posOf(L).valueAtTime(1, false))), before, 'every value as before the rename');
  assert.equal((await services.host.call('links.scan', { compId: comp.id })).renamed.length, 0);
  // Restore puts the expressions back as they were
  assert.ok((await services.executor.restore(rr.checkpointId)).ok);
  assert.match(posOf(item)._expression, /"MOE Grid 1"/);
});

test('the grid tools keep working on a renamed grid (after Relink)', async () => {
  const { services, comp } = await createTestServices(nulls(4));
  const r = await services.executor.run('grid.build', GRID);
  const g = comp._layers.find((l) => l.id === r.result.nullId);
  g.name = 'Hero Grid';
  await services.executor.run('links.relink', {});
  comp._layers.forEach((l) => { l.selected = l === g; });
  const u = await services.executor.run('grid.update', { columns: 4 }).catch((e) => ({ status: e.message }));
  assert.notEqual(u.status, 'failed', JSON.stringify(u.errors || u.verification || u.status));
});

test('a deleted layer is reported as missing, never guessed; nothing renamed means nothing written', async () => {
  const { services, comp, env } = await createTestServices(nulls(3));
  const r = await services.executor.run('grid.build', GRID);
  const g0 = env.undo.groups.length;
  const same = await services.executor.run('links.relink', {});
  assert.equal(same.summary, 'All MOE links are up to date');
  assert.deepEqual(same.result.fixed, []);
  comp._layers.find((l) => l.id === r.result.nullId).remove();
  const scan = await services.host.call('links.scan', { compId: comp.id });
  assert.equal(scan.missing.length, 1);
  assert.equal(scan.renamed.length, 0);
  assert.ok(env.undo.groups.slice(g0).every((x) => x === 'MOE: Relink'));
});

test('only MOE expressions are linked — the user\'s own expressions are written exactly as given', async () => {
  const { services, comp } = await createTestServices(nulls(2));
  const L = comp._layers[0];
  const code = 'thisComp.layer("N1").transform.position';
  await services.host.call('expressions.set', { compId: comp.id, targets: [{ address: { layerId: L.id, matchNames: ['ADBE Transform Group', 'ADBE Position'] }, expression: code }] });
  assert.equal(posOf(L)._expression, code);
  await services.host.call('expressions.set', { compId: comp.id, targets: [{ address: { layerId: L.id, matchNames: ['ADBE Transform Group', 'ADBE Position'] }, expression: `// MOE test\n${code}` }] });
  assert.match(posOf(L)._expression, /MOE-LINK:\d+\*\/"N1"/);
});

test('rename watch: only a name change of the same layer id in the same comp counts', () => {
  const a = { comp: { id: 1 }, compLayers: [{ id: 5, name: 'MOE Grid 1' }, { id: 6, name: 'Logo' }] };
  assert.deepEqual(LW.renamed(a, { comp: { id: 1 }, compLayers: [{ id: 5, name: 'Hero' }, { id: 6, name: 'Logo' }, { id: 7, name: 'New' }] }), [{ id: 5, from: 'MOE Grid 1', to: 'Hero' }]);
  assert.deepEqual(LW.renamed(a, { comp: { id: 2 }, compLayers: [{ id: 5, name: 'Hero' }] }), [], 'another comp');
  assert.deepEqual(LW.renamed(null, a), []);
});

test('every tile and tool: no MOE expression names a layer without its permanent id', { timeout: 600000 }, async () => {
  const bare = [], linkedBy = new Set();
  const cases = [];
  for (const sec of S.SECTIONS.filter((s) => s.kind === 'library')) for (const t of sec.tiles || []) if (!t.needsInput) cases.push({ id: `${sec.id}/${t.id}`, tool: t.tool, args: t.args });
  for (const tool of require('../extension/features/index.js').TOOLS) if (!(tool.permissions || []).includes('network.ai')) cases.push({ id: `tool/${tool.id}`, tool: tool.id, args: {} });
  for (const c of cases) {
    const { services, comp } = await createTestServices(studioComp([
      { name: 'Box', selected: true, transform: TA({ pos: [700, 540] }), rect: { left: -50, top: -50, width: 100, height: 100 } },
      { name: 'Card', selected: true, transform: TA({ pos: [1200, 400] }), rect: { left: -120, top: -40, width: 240, height: 80 } },
      { name: 'Line', selected: true, shapes: [{ name: 'S', stroke: [1, 1, 1], path: [[0, 0], [100, 0]] }], transform: TA({ pos: [960, 800] }) }
    ], { comp: { time: 1 } }));
    const tool = services.registry.get(c.tool);
    const args = Object.assign(Object.fromEntries(Object.entries(tool.params || {}).filter(([, p]) => p.default !== undefined).map(([k, p]) => [k, p.default])), c.args);
    await services.executor.run(c.tool, args, { approved: true }).catch(() => null);
    for (const e of expressions(comp)) {
      if (/\/\/ MOE/.test(e.code) && /thisComp\.layer\("/.test(e.code)) bare.push(`${c.id}: ${e.L.name}`);
      if (/MOE-LINK:/.test(e.code)) linkedBy.add(c.tool);
    }
  }
  assert.deepEqual([...new Set(bare)], []);
  // and the systems that link really do: grid, effectors, glass, trail, proximity, follow…
  assert.ok(linkedBy.size >= 4, `tools that wrote linked expressions: ${[...linkedBy].join(', ')}`);
  console.log('# linked by:', [...linkedBy].join(', '));
});

test('Effectors and Follow Zoom link too (each on the setup it needs)', async () => {
  // Effector: on a built grid, with the grid null selected
  const a = await createTestServices(nulls(4));
  const r = await a.services.executor.run('grid.build', GRID);
  a.comp._layers.forEach((l) => { l.selected = l.id === r.result.nullId; });
  const e = await a.services.executor.run('grid.effector', {});
  assert.equal(e.status, 'success', JSON.stringify(e.errors || e.verification));
  assert.ok(expressions(a.comp).some((x) => /MOE Effector/.test(x.code) && /MOE-LINK:/.test(x.code)) || expressions(a.comp).filter((x) => /MOE-LINK:/.test(x.code)).length > 8, 'effector expressions linked');
  // Follow Zoom: the followed layer is linked by id
  const b = await createTestServices(nulls(1));
  const f = await b.services.executor.run('zoom.follow', { layer: b.comp._layers.find((l) => l.name === 'N0').index });
  assert.equal(f.status, 'success', JSON.stringify(f.errors || f.verification));
  assert.ok(expressions(b.comp).some((x) => new RegExp(`MOE-LINK:${b.comp._layers.find((l) => l.name === 'N0').id}\\*/"N0"`).test(x.code)), 'the followed layer is linked');
});
