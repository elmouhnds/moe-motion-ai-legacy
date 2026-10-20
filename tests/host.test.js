'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const fx = require('./fixtures/comps');

test('host loads and answers ping', async () => {
  const { services } = await createTestServices(fx.easeComp());
  const info = await services.host.call('host.ping', {});
  assert.equal(info.hostModuleVersion, '0.6.1');
  assert.match(info.appVersion, /^25\./);
});

test('context.get reads only the selection, with stable addresses', async () => {
  const { services } = await createTestServices(fx.easeComp());
  const ctx = await services.host.call('context.get', {});
  assert.equal(ctx.comp.name, 'Ease Test');
  assert.equal(ctx.comp.frameRate, 25);
  assert.equal(ctx.layers.length, 1);
  assert.equal(ctx.properties.length, 3);
  const p = ctx.properties[0];
  assert.deepEqual(p.address.matchNames, ['ADBE Transform Group', 'ADBE Position']);
  assert.deepEqual(p.selectedKeys, [1, 2, 3]);
  assert.equal(p.valueType, 'ThreeD_SPATIAL');
});

test('context.get with no project / no comp returns empty context, not an error', async () => {
  const { services } = await createTestServices(null);
  const ctx = await services.host.call('context.get', {});
  assert.equal(ctx.comp, null);
});

test('unknown host op is rejected', async () => {
  const { services } = await createTestServices(fx.easeComp());
  await assert.rejects(services.host.call('app.quit', {}), (e) => e.code === 'UNKNOWN_OP');
});

test('arguments cannot inject ExtendScript', async () => {
  const { services, sandbox } = await createTestServices(fx.easeComp());
  const evil = '"); $.global.PWNED = true; ("';
  await assert.rejects(services.host.call('keyframes.read', { compId: evil, targets: [] }));
  assert.equal(sandbox.PWNED, undefined);
  // Unicode line separators survive the ES3 string literal
  const r = await services.host.call('host.ping', { note: 'a b c ع' });
  assert.ok(r.appVersion);
});

test('stale address is detected by matchName verification', async () => {
  const { services } = await createTestServices(fx.easeComp());
  const ctx = await services.host.call('context.get', {});
  const addr = Object.assign({}, ctx.properties[0].address, { matchNames: ['ADBE Transform Group', 'ADBE Nope'] });
  await assert.rejects(services.host.call('keyframes.read', { compId: ctx.comp.id, targets: [{ address: addr, keys: [1] }] }), (e) => e.code === 'PROPERTY_NOT_FOUND');
});

test('comp switch between read and write is refused', async () => {
  const { services } = await createTestServices(fx.easeComp());
  await assert.rejects(services.host.call('layers.setStartTimes', { compId: 999999, layers: [] }), (e) => e.code === 'COMP_CHANGED');
});
