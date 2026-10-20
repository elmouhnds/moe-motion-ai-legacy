'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { keyVisual, nestedVisual } = require('./fixtures/layout');
const P = require('../extension/features/adapt/planner');
const { aiToOverrides } = require('../extension/features/adapt/tools');

const near = (a, b, t = 0.6) => Math.abs(a - b) <= t;
const A = (v) => Array.from(v);
const pos = (L) => L.property('ADBE Transform Group').property('ADBE Position');
const scl = (L) => L.property('ADBE Transform Group').property('ADBE Scale');
const byName = (comp, n) => comp._layers.find((l) => l.name === n);

/* ------------------------------ planner (pure) ------------------------------ */

function elementsFromBoxes(list) {
  return list.map((e, i) => Object.assign({ id: i + 1, name: e.name, type: e.type || 'av', hasVideo: true, ref: e.box, union: e.box, transform: e.transform || null }, e));
}

test('Planner: roles — background, band, pinned, content, skip', () => {
  const src = { width: 1920, height: 1080 };
  const els = elementsFromBoxes([
    { name: 'BG', box: [0, 0, 1920, 1080] },
    { name: 'Bar', box: [0, 900, 1920, 1040] },
    { name: 'Logo', box: [80, 70, 240, 150] },
    { name: 'Headline', box: [200, 440, 1000, 560] },
    { name: 'Cam', type: 'camera', box: null }
  ]);
  const roles = els.map((e) => P.classify(e, src, {}).role);
  assert.deepEqual(roles, ['background', 'band', 'pinned', 'content', 'skip']);
  assert.equal(P.classify(els[2], src, {}).zone, 'TL');
});

test('Planner: Fit / Fill / Keep are one uniform map for every layer', () => {
  const src = { width: 1920, height: 1080 };
  const dst = { width: 1080, height: 1920 };
  const els = elementsFromBoxes([{ name: 'A', box: [0, 0, 100, 100] }, { name: 'B', box: [1800, 1000, 1900, 1070] }]);
  const fit = P.plan({ src, dst, elements: els, method: 'fit' });
  assert.ok(fit.layers.every((l) => near(l.s, 0.5625, 1e-6) && near(l.d[1], (1920 - 1080 * 0.5625) / 2, 1e-3)));
  const fill = P.plan({ src, dst, elements: els, method: 'fill' });
  assert.ok(fill.layers.every((l) => near(l.s, 1920 / 1080, 1e-5)));
  const keep = P.plan({ src, dst, elements: els, method: 'keep' });
  assert.ok(keep.layers.every((l) => l.s === 1 && near(l.d[0], -420)));
});

test('Planner: smart 16:9 → 9:16 keeps the logo top-left, CTA bottom-right, stacks headline above product, BG covers', () => {
  const src = { width: 1920, height: 1080 };
  const dst = { width: 1080, height: 1920 };
  const els = elementsFromBoxes([
    { name: 'Logo', box: [80, 70, 240, 150] },
    { name: 'Headline', box: [200, 440, 1000, 560] },
    { name: 'Product', box: [1150, 260, 1750, 860] },
    { name: 'CTA', box: [1530, 950, 1770, 1010] },
    { name: 'BG', box: [0, 0, 1920, 1080] }
  ]);
  const p = P.plan({ src, dst, elements: els });
  const get = (n) => p.layers.find((l) => l.name === n);
  assert.equal(get('BG').role, 'background');
  assert.ok(near(get('BG').s, 1920 / 1080, 1e-4));
  assert.deepEqual(get('BG').boxNew.map(Math.round), [Math.round(-(1920 * 1920 / 1080 - 1080) / 2), 0, Math.round(1080 + (1920 * 1920 / 1080 - 1080) / 2), 1920]);
  assert.equal(get('Logo').role, 'pinned');
  assert.ok(get('Logo').boxNew[0] < 200 && get('Logo').boxNew[1] < 200, 'logo stays top-left');
  assert.ok(get('CTA').boxNew[2] > 900 && get('CTA').boxNew[3] > 1700, 'CTA stays bottom-right');
  const h = get('Headline').boxNew, pr = get('Product').boxNew;
  assert.ok(h[3] <= pr[1] + 1, 'headline above product');
  for (const l of p.layers.filter((x) => x.role !== 'background')) {
    assert.ok(l.boxNew[0] >= 53.9 && l.boxNew[2] <= 1026.1 && l.boxNew[1] >= 53.9 && l.boxNew[3] <= 1866.1, `${l.name} inside the safe area`);
  }
  assert.equal(p.warnings.filter((w) => /overlaps/.test(w)).length, 0);
});

test('Planner: overrides and Claude layout are applied and clamped', () => {
  const src = { width: 1920, height: 1080 };
  const dst = { width: 1080, height: 1080 };
  const els = elementsFromBoxes([{ name: 'Headline', box: [200, 440, 1000, 560] }]);
  const conv = aiToOverrides([{ id: 1, role: 'content', centerX: 0.5, centerY: 0.2, widthFraction: 0.8 }, { id: 99, role: 'content', centerX: 2, centerY: 0, widthFraction: 9 }], els, dst);
  assert.deepEqual(conv.ignored, ['unknown layer 99']);
  const p = P.plan({ src, dst, elements: els, overrides: conv.overrides });
  const b = p.layers[0].boxNew;
  assert.ok(near((b[0] + b[2]) / 2, 540, 1) && near(b[2] - b[0], 864, 1));
  assert.ok(near((b[1] + b[3]) / 2, 216, 1));
});

/* ------------------------------ host + tool ------------------------------ */

test('Adapt: 16:9 → 9:16 as a new comp keeps every keyframe, original untouched, verified by measurement; restore removes the copy', async () => {
  const { services, comp, sandbox } = await createTestServices(keyVisual());
  const before = A(pos(byName(comp, 'Headline')).keyValue(1));
  const r = await services.executor.run('adapt.resize', { format: 'v916', method: 'smart' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors, null, 1));
  const copy = sandbox.app.project.itemByID(r.result.res.compId);
  assert.equal(copy.width, 1080);
  assert.equal(copy.height, 1920);
  assert.equal(sandbox.app.project.activeItem, copy, 'new comp opened');
  assert.deepEqual(A(pos(byName(comp, 'Headline')).keyValue(1)), before, 'original untouched');
  assert.equal(comp.width, 1920);
  const h = byName(copy, 'Headline');
  const p = pos(h);
  assert.equal(p.numKeys, 2);
  assert.ok(near(p.keyTime(1), 0) && near(p.keyTime(2), 1), 'key timing kept');
  const plan = r.result.plan.layers.find((l) => l.name === 'Headline');
  assert.ok(near(p.keyValue(1)[0], 300 * plan.s + plan.d[0], 1e-3) && near(p.keyValue(2)[0], 600 * plan.s + plan.d[0], 1e-3), 'keys re-mapped by the same affine');
  assert.ok(near(scl(h).value[0], 100 * plan.s, 1e-3));
  const bg = byName(copy, 'BG');
  assert.ok(near(scl(bg).value[0], 100 * 1920 / 1080, 0.01), 'background covers');
  assert.ok(r.verification.checks.filter((c) => /placed as planned/.test(c.detail)).length >= 4);
  const rs = await services.executor.restore(r.checkpointId);
  assert.ok(rs.ok);
  assert.throws(() => sandbox.app.project.itemByID(copy.id));
});

test('Adapt: in place with rig nulls — layers parented to MOE Adapt rigs, values untouched; restore is exact', async () => {
  const { services, comp } = await createTestServices(keyVisual());
  const snap = comp._layers.map((L) => ({ n: L.name, p: A(pos(L).value), k: pos(L)._keys.map((k) => A(k.value)) }));
  const r = await services.executor.run('adapt.resize', { format: 'sq', method: 'fit', output: 'inplace', strategy: 'rig' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors, null, 1));
  assert.equal(comp.width, 1080);
  const rigs = comp._layers.filter((L) => /^MOE Adapt/.test(L.name));
  assert.equal(rigs.length, 1);
  assert.ok(comp._layers.filter((L) => !/^MOE Adapt/.test(L.name)).every((L) => L.parent === rigs[0]));
  assert.ok(near(scl(rigs[0]).value[0], 56.25, 1e-3));
  const rs = await services.executor.restore(r.checkpointId);
  assert.ok(rs.ok);
  assert.equal(comp.width, 1920);
  assert.equal(comp._layers.filter((L) => /^MOE Adapt/.test(L.name)).length, 0);
  for (const s of snap) {
    const L = byName(comp, s.n);
    assert.equal(L.parent, null);
    assert.deepEqual(A(pos(L).value), s.p);
    assert.deepEqual(pos(L)._keys.map((k) => A(k.value)), s.k);
  }
});

test('Adapt: in place direct — restore puts values, keys and eases back', async () => {
  const { services, comp } = await createTestServices(keyVisual());
  const h = byName(comp, 'Headline');
  const k1 = A(pos(h).keyValue(1));
  const r = await services.executor.run('adapt.resize', { format: 'p45', output: 'inplace' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors, null, 1));
  assert.notDeepEqual(A(pos(h).keyValue(1)), k1);
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.deepEqual(A(pos(h).keyValue(1)), k1);
  assert.equal(comp.height, 1080);
});

test('Adapt: a full-frame layout pre-comp is adapted inside a copy and swapped in', async () => {
  const { services, comp, sandbox } = await createTestServices(nestedVisual());
  const innerOrig = comp.layer(1).source;
  const r = await services.executor.run('adapt.resize', { format: 'v916' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors, null, 1));
  assert.equal(r.result.res.nested.length, 1);
  const copy = sandbox.app.project.itemByID(r.result.res.compId);
  const swapped = copy.layer(1).source;
  assert.notEqual(swapped, innerOrig, 'original pre-comp untouched');
  assert.equal(swapped.width, 1080);
  assert.equal(swapped.height, 1920);
  assert.equal(innerOrig.width, 1920);
  assert.deepEqual(A(copy.layer(1).property('ADBE Transform Group').property('ADBE Position').value), [540, 960]);
  assert.ok(near(scl(byName(swapped, 'BG')).value[0], 177.78, 0.01));
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.throws(() => sandbox.app.project.itemByID(swapped.id));
});

test('Adapt: same size is refused; custom size validated', async () => {
  const { services } = await createTestServices(keyVisual());
  const r = await services.executor.run('adapt.resize', { format: 'h169' });
  assert.equal(r.status, 'blocked');
  assert.match(r.errors.join(' '), /already 1920×1080/);
  const c = await services.executor.run('adapt.resize', { format: 'custom', width: 8, height: 100 });
  assert.notEqual(c.status, 'success');
});
