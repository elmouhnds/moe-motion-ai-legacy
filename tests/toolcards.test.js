'use strict';
/* v0.66 (docs/features/TOOL_CARDS.md): Tool Cards, the grouped Expressions list, Cascade and Marker Pulse. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { TA } = require('./fixtures/layout');
const { studioComp } = require('./fixtures/studio');
const TC = require('../extension/core/toolcard');
const E = require('../extension/features/expressions/quick');

const tp = (L, mn) => L.property('ADBE Transform Group').property(mn);
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;

/** n layers, each with its own Position keys (selected), in timeline order L1..Ln. */
function keyedLayers(n) {
  return studioComp(Array.from({ length: n }, (_, i) => {
    const tr = TA({ pos: [100, 100] });
    tr[1] = Object.assign({}, tr[1], { keys: [{ time: 0, value: [100, 100] }, { time: 1, value: [500, 100] }], selected: true });
    return { name: `L${i + 1}`, selected: true, transform: tr, rect: { left: -10, top: -10, width: 20, height: 20 } };
  }), { comp: { time: 0 } });
}

test('Tool Card: ready card says what it acts on, what it writes, how to undo, with the exact code — and never calls the host', async () => {
  const { services } = await createTestServices(keyedLayers(2));
  const ctx = await services.executor.readContext();
  const tool = services.registry.get('expressions.quick');
  let calls = 0;
  const host = services.host; const orig = host.call; host.call = (...a) => { calls++; return orig.apply(host, a); };
  const c = TC.card(tool, { preset: 'autoFade', secs: 0.4 }, ctx, services);
  host.call = orig;
  assert.equal(calls, 0, 'a card is computed from the context the panel already has');
  assert.equal(c.ready, true);
  assert.equal(c.needs, null);
  assert.equal(c.signature, 'autoFade(secs 0.4)');
  assert.match(c.target, /2 layers/);
  assert.match(c.writes[0], /2 expressions tagged \/\/ MOE Expr/);
  assert.equal(c.undo, 'One Ctrl+Z, or Restore from History');
  assert.equal(c.code, E.code('autoFade', { secs: 0.4 }, false));
  // the numbers the sliders set are lit in the code, and nothing else
  const runs = TC.codeRuns(c.code, c.numbers);
  assert.deepEqual(runs.filter((r) => r.num).map((r) => r.text), ['0.4']);
  assert.equal(runs.map((r) => r.text).join(''), c.code, 'the runs rebuild the code exactly');
});

test('Tool Card: not ready → the one thing to do first, nothing promised; tools without explain() still get a card', async () => {
  const { services } = await createTestServices(studioComp([{ name: 'A', selected: false, transform: TA({ pos: [0, 0] }) }]));
  const ctx = await services.executor.readContext();
  const q = TC.card(services.registry.get('expressions.quick'), { preset: 'loopCycle' }, ctx, services);
  assert.equal(q.ready, false);
  assert.equal(q.needs, 'Select keyframed properties to loop');
  assert.deepEqual(q.writes, []);
  // any registered tool: the card comes from prepare()'s preview
  for (const tool of services.registry.list()) {
    const c = TC.card(tool, require('../extension/core/schema').defaults(tool.params || {}), ctx, services);
    assert.ok(c.name && typeof c.purpose === 'string', tool.id);
    assert.ok(c.ready || (typeof c.needs === 'string' && c.needs.length), `${tool.id}: a card that is not ready says why`);
    assert.ok(/Ctrl\+Z|Changes nothing/.test(c.undo), tool.id);
  }
  assert.equal(TC.card(services.registry.get('expressions.quick'), { preset: 'wiggle' }, null, services).needs, 'Reading After Effects…');
});

test('Live Stagger: each layer plays its own keys later by timeline order — no key moves, the value matches the delayed keys', async () => {
  const { services, comp } = await createTestServices(keyedLayers(3));
  const before = comp._layers.map((L) => tp(L, 'ADBE Position')._keys.map((k) => k.t));
  const r = await services.executor.run('expressions.quick', { preset: 'cascade', delay: 0.2 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  comp._layers.forEach((L, rank) => {
    const p = tp(L, 'ADBE Position');
    assert.deepEqual(p._keys.map((k) => k.t), before[rank], 'no key moved');
    assert.match(p.expression, new RegExp(`var i = ${rank};`));
    for (const t of [0.1, 0.5, 0.9, 1.3]) {
      const got = p.valueAtTime(t, false), want = p.valueAtTime(t - rank * 0.2, true);
      assert.ok(near(got[0], want[0]) && near(got[1], want[1]), `L${rank + 1} at ${t}: ${got} vs ${want}`);
    }
  });
  // ranks follow the timeline, whatever order the targets came in
  assert.deepEqual(E.ranks([{ layerId: 3 }, { layerId: 1 }, { layerId: 2 }], { layers: [{ id: 1, index: 1 }, { id: 2, index: 2 }, { id: 3, index: 3 }] }), [2, 0, 1]);
  // the card tells the spread before Apply
  const c = TC.card(services.registry.get('expressions.quick'), { preset: 'cascade', delay: 0.2 }, await services.executor.readContext(), services);
  assert.ok(c.writes.some((w) => /delays 0 … 0\.4 s by timeline order/.test(w)), c.writes.join(' | '));
});

test('Marker Pulse: a decaying pop after each layer marker, rest before the first one', async () => {
  const fx = studioComp([{ name: 'Beat', selected: true, transform: TA({ pos: [960, 540] }), rect: { left: -50, top: -50, width: 100, height: 100 } }], { comp: { time: 0 } });
  const { services, comp } = await createTestServices(fx);
  const L = comp._layers[0];
  L._markers = [1, 2];
  const r = await services.executor.run('expressions.quick', { preset: 'markerPulse', amp: 20, freq: 2, decay: 5 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const s = tp(L, 'ADBE Scale');
  const base = s.valueAtTime(0.5, true)[0];
  assert.equal(s.valueAtTime(0.5, false)[0], base, 'before the first marker: untouched');
  // a quarter period after a marker: the peak of the sine, times the decay
  for (const m of [1, 2]) {
    const dt = 1 / (4 * 2);
    const want = base * (1 + 0.2 * Math.exp(-5 * dt));
    assert.ok(near(s.valueAtTime(m + dt, false)[0], want, 1e-6), `marker ${m}`);
  }
});

test('Expressions list: grouped by what it moves, the groups that fit the selection first; every preset has a group and a purpose', () => {
  const S = require('../extension/app/ui/studio/sections');
  const sec = S.byId('expressions');
  const ids = sec.groups.map(([id]) => id);
  for (const t of sec.tiles) {
    assert.ok(ids.includes(sec.groupBy(t)), `${t.id} has a group`);
    assert.ok(t.hint && t.hint.length > 10, `${t.id} says what it is for`);
  }
  const lib = require('../extension/app/ui/studio/library');
  assert.equal(typeof lib.render, 'function');
  const src = require('fs').readFileSync(require('path').join(__dirname, '../extension/app/ui/studio/library.js'), 'utf8');
  assert.match(src, /groupTiles\(section, tiles, s\.ctx\)/);
  // the order rule, on the same function the page uses
  const groupTiles = new Function('section', 'tiles', 'ctx', `${src.match(/function fittingGroups[\s\S]*?\n}\n/)[0]}\n${src.match(/function groupTiles[\s\S]*?\n}\n/)[0]}\nreturn groupTiles(section, tiles, ctx);`);
  const opacityOnly = { properties: [{ name: 'Opacity', numKeys: 0 }] };
  const g = groupTiles(sec, sec.tiles, opacityOnly);
  assert.equal(g[0].id, 'opacity');
  assert.equal(g[0].fits, true);
  assert.ok(g.slice(1).every((x) => !x.fits));
  const keyedRot = { properties: [{ name: 'Rotation', numKeys: 3 }] };
  assert.deepEqual(groupTiles(sec, sec.tiles, keyedRot).slice(0, 2).map((x) => x.id), ['rotation', 'keyed']);
  // the library inspector's settings never repeat the tile's own choice, nor its Apply
  const tb = require('fs').readFileSync(require('path').join(__dirname, '../extension/app/ui/toolBlock.js'), 'utf8');
  assert.match(tb, /filter\(\(\[, d\]\) => !d\.tileFixed\)/);
  assert.match(src, /renderTool\(app, tool, \{ openByDefault: true, bare: true \}\)/);
  assert.equal(E.quick.params.preset.tileFixed, true);
});
