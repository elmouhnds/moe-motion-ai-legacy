'use strict';
/**
 * v0.94 — one Ctrl+Z per production, and templates in their own comp (docs/features/ONE_UNDO.md).
 * The mock now behaves like After Effects: an undo group closes when the script that opened it returns
 * (tests/helpers/harness.js), and `env.undo.entries` is what Edit › Undo would list.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { studioComp } = require('./fixtures/studio');
const { plan } = require('../extension/core/host/plan');
const TPL = require('../extension/features/design/templates');

const tr = (L, mn) => L.property('ADBE Transform Group').property(mn);
const near = (a, b, t = 0.01) => (Array.isArray(a) ? a.every((x, i) => Math.abs(x - b[i]) <= t) : Math.abs(a - b) <= t);
async function env0() { return createTestServices(studioComp([], { comp: { time: 1 } })); }
/** A part's comp position at time t (its own position + its parent's — the template null is not rotated or scaled). */
const world = (L, t) => { const p = tr(L, 'ADBE Position').valueAtTime(t, false); const P = L.parent ? tr(L.parent, 'ADBE Position').valueAtTime(t, false) : [0, 0]; return [p[0] + P[0], p[1] + P[1]]; };

test('a template is ONE layer in your comp — its own comp, at the playhead — and ONE Ctrl+Z (plus one step that changes nothing, the first time)', async () => {
  for (const id of ['lowerThird', 'titleCard', 'uiNotify', 'uiButton']) {
    const { services, comp, env } = await env0();
    const items0 = comp._project._items.length, e0 = env.undo.entries.length;
    const r = await services.executor.run('design.template', { template: id, title: 'Mona Saleh', hold: 1 });
    assert.equal(r.status, 'success', `${id}: ${JSON.stringify(r.errors || r.verification)}`);
    assert.equal(comp._layers.length, 1, `${id}: one layer in your comp`);
    const L = comp._layers[0], src = L.source;
    assert.equal(L.name, 'MOE Template 1'); assert.equal(src.name, 'MOE Template 1'); assert.equal(L.startTime, 1, 'at the playhead');
    // v0.99.5: the template's own null also has a SOLID of its own in the project, the way After Effects makes
    // one — so count the template comp itself rather than the raw item total (the measuring comp must be gone).
    assert.equal(comp._project._items.filter((i) => /^MOE Template/.test(i.name)).length, 1, 'one new comp in the project (the measuring comp is gone)');
    assert.deepEqual([src.width, src.height, src.frameRate], [comp.width, comp.height, comp.frameRate]);
    // inside: every part, parented to the null
    const nul = src._layers.find((l) => l.name === 'MOE Template 1');
    const parts = src._layers.filter((l) => l !== nul);
    assert.ok(parts.length >= 2 && parts.every((p) => p.parent === nul && /^MOE Template 1 · /.test(p.name)), id);
    // undo: the build is ONE step; the measuring before it changed nothing
    const steps = env.undo.entries.slice(e0);
    assert.deepEqual(steps, ['MOE: Measure Text', `MOE: ${TPL.byId(id).label}`], `${id}: ${steps.join(' | ')}`);
    assert.equal(env.undo.autoClosed, 0);
    // the same template again: the texts are already measured — exactly ONE step
    const e1 = env.undo.entries.length;
    const r2 = await services.executor.run('design.template', { template: id, title: 'Mona Saleh', hold: 1, accent: '#22aa66' });
    assert.equal(r2.status, 'success');
    assert.deepEqual(env.undo.entries.slice(e1), [`MOE: ${TPL.byId(id).label}`], `${id}: a re-apply is one step`);
    // Restore removes the layer AND its comp, in one step
    const e2 = env.undo.entries.length;
    assert.ok((await services.executor.restore(r2.checkpointId)).ok);
    assert.equal(comp._layers.length, 1);
    assert.equal(comp._project._items.filter((i) => /^MOE Template/.test(i.name)).length, 1, 'the first template comp is still the only one');
    assert.deepEqual(env.undo.entries.slice(e2), ['MOE: Restore Template']);
  }
});

test('its own comp looks exactly like the separate-layers build, shifted to the playhead', async () => {
  for (const id of ['lowerThird', 'callout', 'uiProgress']) {
    const a = await env0(), b = await env0();
    const ra = await a.services.executor.run('design.template', { template: id, title: 'Same', hold: 1 });
    const rb = await b.services.executor.run('design.template', { template: id, title: 'Same', hold: 1, container: 'layers' });
    assert.equal(ra.status, 'success'); assert.equal(rb.status, 'success');
    const inner = a.comp._layers[0].source;
    // settled moments (a plan key on exactly half a frame may snap to the next frame in one build and the previous in the
    // other — float rounding of 20.5 vs 45.4999 frames — so key TIMES are compared within one frame below)
    for (const t of [0, 1.3, 1.7, 3.2]) {
      for (const L of b.comp._layers.filter((l) => / · /.test(l.name))) {
        const M = inner._layers.find((l) => l.name === L.name);
        assert.ok(M && near(world(M, t), world(L, t + 1), 1e-6), `${id} ${L.name} at ${t}: ${M && world(M, t)} vs ${world(L, t + 1)}`);
        assert.ok(near(tr(M, 'ADBE Opacity').valueAtTime(t, false), tr(L, 'ADBE Opacity').valueAtTime(t + 1, false), 1e-6), `${id} ${L.name} opacity at ${t}`);
      }
    }
    for (const L of b.comp._layers.filter((l) => / · /.test(l.name))) {
      const M = inner._layers.find((l) => l.name === L.name), kp = (X) => tr(X, 'ADBE Position')._keys;
      assert.equal(kp(M).length, kp(L).length, `${id} ${L.name} key count`);
      kp(M).forEach((k, i) => { assert.ok(Math.abs(k.t + 1 - kp(L)[i].t) <= 1 / 25 + 1e-9, `${id} ${L.name} key ${i} time`); assert.ok(near(k.value, kp(L)[i].value, 1e-9)); });
    }
  }
});

test('tx.run: refs, a comp made in the same batch may be written — no other comp; an unknown op is refused before anything; a failure says the step', async () => {
  const { services, comp, env } = await env0();
  // a comp that exists but was not made in this batch is not writable from it
  const other = comp._project.items.addComp('Not MOE', 100, 100, 1, 1, 25);
  const P1 = plan(services.host, 'MOE: Bad');
  P1.add('layers.createNull', { compId: other.id, name: 'MOE X' });
  await assert.rejects(() => P1.commit(), /active composition changed|COMP_CHANGED/i);
  assert.equal(other._layers.length, 0);
  // an op the batch may not run: refused before ANY step runs
  const e0 = env.undo.entries.length;
  await assert.rejects(() => services.host.call('tx.run', { label: 'MOE: X', steps: [{ op: 'layers.createNull', args: { compId: comp.id, name: 'MOE ok' } }, { op: 'tx.begin', args: {} }] }), /not an operation a batch can run/);
  assert.equal(comp._layers.length, 0); assert.equal(env.undo.entries.length, e0, 'nothing written, no undo step');
  // a failing step: the earlier ones ran (in that one undo step), the plan says which step failed, their refs resolve
  const P2 = plan(services.host, 'MOE: Half');
  const ok = P2.add('layers.createNull', { compId: comp.id, name: 'MOE First' });
  P2.add('layers.setParent', { compId: comp.id, items: [{ layerId: 999999, parentId: ok.at('layerId') }] });
  const err = await P2.commit().catch((e) => e);
  assert.match(err.message, /step 2 of 2: layers\.setParent/);
  assert.equal(typeof ok.value().layerId, 'number');
  assert.deepEqual(env.undo.entries.slice(e0), ['MOE: Half'], 'what ran is one undo step');
  // a ref read before commit is an error, not a silent wrong value
  const P3 = plan(services.host, 'MOE: Early');
  assert.throws(() => P3.add('layers.createNull', { compId: comp.id, name: 'MOE E' }).value(), /before the plan was committed/);
  // only MOE comps are placed or removed
  await assert.rejects(() => services.host.call('comps.place', { compId: comp.id, sourceId: other.id }), /Only a comp MOE made/);
  const rm = await services.host.call('comps.removeMoe', { ids: [other.id], onlyNamed: 'MOE ' });
  assert.deepEqual(rm.removed, []); assert.ok(comp._project._items.includes(other));
});

test('a template comp used elsewhere is never deleted by Restore — only its layer in your comp', async () => {
  const { services, comp } = await env0();
  const r = await services.executor.run('design.template', { template: 'tag', title: 'NEW' });
  const src = comp._layers[0].source;
  const elsewhere = comp._project.items.addComp('Edit', 1920, 1080, 1, 5, 25);
  elsewhere.layers.add(src);
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.equal(comp._layers.length, 0, 'gone from your comp');
  assert.ok(comp._project._items.includes(src), 'kept: another comp uses it');
});
