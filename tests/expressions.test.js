'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const fx = require('./fixtures/comps');

test('Apply expression: applied + verified, checkpoint restores originals', async () => {
  const { services, comp } = await createTestServices(fx.exprComp());
  const rot = comp.layer(2).property(1).property(1);
  const op = comp.layer(2).property(1).property(2);
  const r = await services.executor.run('expressions.apply', { code: 'wiggle(2, 10)' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification));
  assert.equal(rot.expression, 'wiggle(2, 10)');
  assert.equal(op.expression, 'wiggle(2, 10)');
  await services.executor.restore(r.checkpointId);
  assert.equal(rot.expression, 'time * 90');
  assert.equal(op.expression, '');
});

test('Apply expression: engine error → reverted and reported as failed', async () => {
  const { services, comp } = await createTestServices(fx.exprComp());
  const rot = comp.layer(2).property(1).property(1);
  const r = await services.executor.run('expressions.apply', { code: 'thisComp.layer("Missing").transform.position[0]' });
  assert.equal(r.status, 'failed');
  assert.match(r.verification.checks[0].detail, /missing.*reverted/i);
  assert.equal(rot.expression, 'time * 90');
});

test('Validate: reports syntax errors and leaves the property unchanged', async () => {
  const { services, comp } = await createTestServices(fx.exprComp());
  const rot = comp.layer(2).property(1).property(1);
  const bad = await services.executor.run('expressions.validate', { code: 'value + ' });
  assert.equal(bad.ok, false);
  assert.match(bad.summary, /SyntaxError/);
  assert.equal(rot.expression, 'time * 90');
  const good = await services.executor.run('expressions.validate', { code: 'value + 10' });
  assert.equal(good.ok, true);
  assert.equal(rot.expression, 'time * 90');
});

test('Inspect and Remove', async () => {
  const { services, comp } = await createTestServices(fx.exprComp());
  const i = await services.executor.run('expressions.inspect', {});
  assert.equal(i.result.items.filter((x) => x.hasExpression).length, 1);
  const r = await services.executor.run('expressions.remove', {});
  assert.equal(r.status, 'success');
  assert.equal(comp.layer(2).property(1).property(1).expression, '');
  await services.executor.restore(r.checkpointId);
  assert.equal(comp.layer(2).property(1).property(1).expression, 'time * 90');
});

test('Expression Assistant works offline-safely: clear error, no host change', async () => {
  const { services, env } = await createTestServices(fx.exprComp(), { apiKey: 'sk-ant-test-123456789' });
  const r = await services.executor.run('expressions.assist', { mode: 'generate', request: 'bounce' });
  assert.equal(r.status, 'failed');
  assert.match(r.errors[0], /Cannot reach the Claude API/);
  assert.equal(env.undo.groups.length, 0);
});
