'use strict';
/** v0.63 Progress + Stop (docs/features/PROGRESS.md; the study's defect S4 / KPI "progress + stop over ~2 s"). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const base = require('../dev/preview-fixture.js');

function fiveSteps(services) {
  services.registry.register({
    id: 'test.fiveSteps', version: '1.0.0', category: 'tools', name: 'Five Steps', description: 'measures, then writes keys four times',
    params: {}, requires: { comp: true, minLayers: 1 }, permissions: ['modify.keyframes'], recovery: 'undo', verify: () => ({ ok: true, checks: [] }),
    async execute({ ctx, host }) {
      await host.call('layers.bounds', { compId: ctx.comp.id, layerIds: [ctx.layers[0].id], times: [0] });
      for (let i = 0; i < 4; i++) await host.call('keys.write', { compId: ctx.comp.id, items: [{ address: { layerId: ctx.layers[0].id, matchNames: ['ADBE Transform Group', 'ADBE Opacity'] }, keys: [{ t: i, v: 50 + i }] }] });
      return {};
    }
  });
}

test('every host call is a named step the panel can show', async () => {
  const { services } = await createTestServices(base);
  fiveSteps(services);
  const steps = [];
  const off = services.executor.on((e) => { if (e.type === 'step') steps.push(`${e.step}:${e.label}`); });
  const r = await services.executor.run('test.fiveSteps', {});
  off();
  assert.equal(r.status, 'success');
  assert.deepEqual(steps, ['1:Measuring', '2:Writing keys', '3:Writing keys', '4:Writing keys', '5:Writing keys']);
});

test('Stop takes effect before the next step: what was made is ONE undo step, the panel says so, history records it', async () => {
  const { services, comp, env } = await createTestServices(base);
  fiveSteps(services);
  const off = services.executor.on((e) => { if (e.type === 'step' && e.step === 2) services.executor.stop(); });
  const L = comp._layers.find((l) => l.selected);
  const r = await services.executor.run('test.fiveSteps', {});
  off();
  assert.equal(r.status, 'stopped');
  assert.equal(r.steps, 2, 'step 3 never ran');
  assert.match(r.summary, /stopped after 2 step\(s\) — Ctrl\+Z removes what was made/);
  assert.equal(L.property('ADBE Transform Group').property('ADBE Opacity').numKeys, 1, 'one write happened, no more');
  assert.equal(env.undo.depth, 0, 'the run\'s undo group is closed');
  assert.equal(services.executor.history(1)[0].status, 'stopped');
  // the next run is not stopped by the old request
  const again = await services.executor.run('test.fiveSteps', {});
  assert.equal(again.status, 'success');
});

test('Stop before the first write says nothing changed', async () => {
  const { services } = await createTestServices(base);
  fiveSteps(services);
  const off = services.executor.on((e) => { if (e.type === 'start') services.executor.stop(); });
  const r = await services.executor.run('test.fiveSteps', {});
  off();
  assert.equal(r.status, 'stopped');
  assert.match(r.summary, /before it changed anything/);
});
