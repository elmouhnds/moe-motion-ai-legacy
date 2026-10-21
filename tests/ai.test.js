'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const fx = require('./fixtures/comps');
const { costOf } = require('../extension/core/ai/cost');
const planner = require('../extension/core/ai/planner');

function fakeHttp(responder) {
  const calls = [];
  return {
    calls,
    request: async (req) => {
      calls.push({ headers: req.headers, body: JSON.parse(req.body) });
      return responder(calls.length, req);
    }
  };
}
const ok = (data, usage = { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 3000, cache_creation_input_tokens: 0 }) => ({
  status: 200, headers: {}, body: JSON.stringify({ model: 'claude-opus-5-5', stop_reason: 'end_turn', usage, content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(data) }] })
});

test('Request shape: structured output, cached system prompt, fallback, key only in header', async () => {
  const http = fakeHttp(() => ok({ summary: 's', steps: [], warnings: [], clarification: 'select keys' }));
  const { services } = await createTestServices(fx.easeComp(), { http, apiKey: 'sk-ant-secret-abcdefgh' });
  const ctx = await services.executor.readContext();
  await services.copilot.plan('make it snappy', ctx);
  const { headers, body } = http.calls[0];
  assert.equal(headers['anthropic-version'], '2023-06-01');
  assert.equal(headers['x-api-key'], 'sk-ant-secret-abcdefgh');
  assert.equal(headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  assert.equal(body.model, 'claude-opus-5-5');
  assert.equal(body.fallbacks, 'default');
  assert.equal(body.output_config.format.type, 'json_schema');
  assert.equal(body.output_config.effort, 'medium');
  assert.deepEqual(body.system[0].cache_control, { type: 'ephemeral' });
  assert.equal(body.thinking, undefined, 'no thinking config (Opus 5.5 runs adaptive)');
  assert.equal(body.tool_choice, undefined, 'no forced tool_choice (400 on Opus 5.5)');
  assert.ok(!JSON.stringify(body).includes('sk-ant-secret'), 'key not in body');
  const user = JSON.parse(body.messages[0].content);
  assert.equal(user.afterEffectsContext.comp.name, 'Ease Test');
  assert.ok(!JSON.stringify(user).includes('fsName'));
  assert.ok(!services.logger.entries().some((e) => JSON.stringify(e).includes('sk-ant-secret')), 'key never logged');
});

test('System prompt is deterministic (prompt-cache friendly)', async () => {
  const a = await createTestServices(fx.easeComp());
  const b = await createTestServices(fx.staggerComp());
  assert.equal(planner.systemPrompt(a.services.registry), planner.systemPrompt(b.services.registry));
  assert.equal(JSON.stringify(planner.planSchema(a.services.registry)), JSON.stringify(planner.planSchema(b.services.registry)));
});

test('Plan schema only allows AI-callable tools', async () => {
  const { services } = await createTestServices(fx.easeComp());
  const s = JSON.stringify(planner.planSchema(services.registry));
  assert.ok(s.includes('motion.smartEase'));
  assert.ok(!s.includes('expressions.assist'));
  assert.ok(!s.includes('expressions.validate'));
});

test('Copilot: plan validated → approved → executed → verified → rolled back', async () => {
  const plan = { summary: 'Snappy ease, then stagger', warnings: [], clarification: '', steps: [
    { tool: 'motion.smartEase', args_json: '{"influenceIn":90,"influenceOut":15,"sides":"both","scope":"selected"}', reason: 'snappy' }
  ] };
  const http = fakeHttp(() => ok(plan));
  const { services, comp } = await createTestServices(fx.easeComp(), { http, apiKey: 'sk-ant-k-12345678' });
  const ctx = await services.executor.readContext();
  const raw = await services.copilot.plan('snappy', ctx);
  const v = await services.copilot.validate(raw, ctx);
  assert.ok(v.ok, JSON.stringify(v));
  assert.match(v.steps[0].preview.summary, /Ease 7 keyframes/);
  const run = await services.copilot.run(v);
  assert.ok(run.ok);
  const prop = comp.layer(1).property(1).property(1);
  assert.equal(prop.keyInTemporalEase(2)[0].influence, 90);
  const rb = await services.copilot.rollback(run.results);
  assert.ok(rb.ok);
  assert.notEqual(prop.keyInTemporalEase(2)[0].influence, 90);
  assert.equal(services.executor.history()[1].origin, 'agent');
});

test('Copilot: hallucinated tools and bad args are rejected before approval', async () => {
  const { services } = await createTestServices(fx.easeComp());
  const ctx = await services.executor.readContext();
  const v = await services.copilot.validate({ summary: 'x', steps: [
    { tool: 'system.deleteProject', args: {}, reason: 'evil' },
    { tool: 'motion.smartEase', args: { influenceIn: 500 }, reason: 'too much' },
    { tool: 'expressions.assist', args: {}, reason: 'recursion' }
  ] }, ctx);
  assert.equal(v.ok, false);
  assert.match(v.steps[0].errors[0], /Not an AI-callable tool/);
  assert.ok(v.steps[1].errors.some((e) => /≤ 100/.test(e)));
  assert.match(v.steps[2].errors[0], /Not an AI-callable tool/);
});

test('Plan schema stays compact: no per-tool variants (API "compiled grammar is too large")', async () => {
  const { services } = await createTestServices(fx.easeComp());
  const schema = planner.planSchema(services.registry);
  const s = JSON.stringify(schema);
  assert.ok(services.registry.list({ aiCallable: true }).length > 30, 'catalog is large');
  assert.ok(s.length < 4000, `schema is ${s.length} bytes`);
  assert.ok(!/anyOf|oneOf|allOf/.test(s));
  assert.equal((s.match(/"type":"object"/g) || []).length, 2, 'only the plan and the step object');
  // every object is closed (structured outputs requirement)
  const walk = (o) => { if (o && typeof o === 'object') { if (o.type === 'object') assert.equal(o.additionalProperties, false); Object.values(o).forEach(walk); } };
  walk(schema);
});

test('Copilot: args_json is parsed and re-validated locally; broken JSON and unknown keys are refused', async () => {
  const { services } = await createTestServices(fx.easeComp());
  const ctx = await services.executor.readContext();
  const v = await services.copilot.validate({ summary: 'x', steps: [
    { tool: 'motion.smartEase', args_json: '{"influenceIn":80', reason: 'truncated' },
    { tool: 'motion.smartEase', args_json: '[1,2]', reason: 'not an object' },
    { tool: 'motion.stagger', args_json: '{"frames":3,"rm -rf":1}', reason: 'unknown key' },
    { tool: 'motion.stagger', args_json: '{"frames":4}', reason: 'defaults fill the rest' }
  ] }, ctx);
  assert.match(v.steps[0].errors[0], /not a valid JSON object/);
  assert.match(v.steps[1].errors[0], /not a valid JSON object/);
  assert.ok(v.steps[2].errors.some((e) => /Unknown parameter "rm -rf"/.test(e)));
  assert.deepEqual(v.steps[3].errors, []);
  assert.equal(v.steps[3].args.frames, 4);
  assert.equal(planner.stepArgs({}).error, 'Missing arguments');
});

test('Copilot: agent-origin changes need approval', async () => {
  const { services } = await createTestServices(fx.easeComp());
  const r = await services.executor.run('motion.smartEase', {}, { origin: 'agent', approved: false });
  assert.equal(r.status, 'needs-approval');
});

test('API failures: no key, 401, refusal, truncation, retry on 429, offline', async () => {
  let h = await createTestServices(fx.easeComp());
  await assert.rejects(h.services.copilot.plan('x', {}), (e) => e.code === 'AI_NO_KEY');

  h = await createTestServices(fx.easeComp(), { apiKey: 'k', http: fakeHttp(() => ({ status: 401, headers: {}, body: '{"error":{"message":"invalid x-api-key"}}' })) });
  await assert.rejects(h.services.copilot.plan('x', {}), (e) => e.code === 'AI_AUTH');

  h = await createTestServices(fx.easeComp(), { apiKey: 'k', http: fakeHttp(() => ({ status: 200, headers: {}, body: JSON.stringify({ stop_reason: 'refusal', content: [], usage: { input_tokens: 10, output_tokens: 0 } }) })) });
  await assert.rejects(h.services.copilot.plan('x', {}), (e) => e.code === 'AI_REFUSED');

  h = await createTestServices(fx.easeComp(), { apiKey: 'k', http: fakeHttp(() => ({ status: 200, headers: {}, body: JSON.stringify({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"a' }], usage: {} }) })) });
  await assert.rejects(h.services.copilot.plan('x', {}), (e) => e.code === 'AI_TRUNCATED');

  const http = fakeHttp((n) => (n === 1 ? { status: 429, headers: { 'retry-after': '0' }, body: '{"error":{"message":"rate"}}' } : ok({ summary: 'ok', steps: [], warnings: [], clarification: '' })));
  h = await createTestServices(fx.easeComp(), { apiKey: 'k', http });
  const p = await h.services.copilot.plan('x', {});
  assert.equal(p.summary, 'ok');
  assert.equal(http.calls.length, 2);

  h = await createTestServices(fx.easeComp(), { apiKey: 'k' });
  await assert.rejects(h.services.copilot.plan('x', {}), (e) => e.code === 'AI_NETWORK');
  // local tools keep working while offline
  const r = await h.services.executor.run('motion.smartEase', {});
  assert.equal(r.status, 'success');
});

test('Cost monitor: pricing math and monthly budget gate', async () => {
  const usd = costOf('claude-opus-5-5', { input_tokens: 1e6, output_tokens: 1e6, cache_read_input_tokens: 1e6, cache_creation_input_tokens: 1e6 });
  assert.equal(usd, 4 + 20 + 0.2 + 5);
  const http = fakeHttp(() => ok({ summary: 's', steps: [], warnings: [], clarification: '' }, { input_tokens: 1e6, output_tokens: 0 }));
  const { services } = await createTestServices(fx.easeComp(), { apiKey: 'k', http });
  services.settings.update({ ai: { monthlyBudgetUSD: 5 } });
  await services.copilot.plan('x', {});
  assert.equal(services.cost.month().usd, 4);
  await services.copilot.plan('x', {});
  await assert.rejects(services.copilot.plan('x', {}), (e) => e.code === 'AI_BUDGET');
  assert.equal(http.calls.length, 2);
});

test('AI disabled in settings: AI blocked, local tools unaffected', async () => {
  const { services } = await createTestServices(fx.easeComp(), { apiKey: 'k' });
  services.settings.update({ ai: { enabled: false } });
  await assert.rejects(services.copilot.plan('x', {}), (e) => e.code === 'AI_DISABLED');
});

test('Expression Assistant returns code for diff without touching the host', async () => {
  const http = fakeHttp(() => ok({ code: 'loopOut("cycle")', explanation: 'Loops.', notes: [], controls: [] }));
  const { services, env, comp } = await createTestServices(fx.exprComp(), { http, apiKey: 'k' });
  const r = await services.executor.run('expressions.assist', { mode: 'fix', request: '' });
  assert.equal(r.status, 'success');
  assert.equal(r.result.code, 'loopOut("cycle")');
  assert.equal(r.result.original, 'time * 90');
  assert.equal(comp.layer(2).property(1).property(1).expression, 'time * 90');
  assert.equal(env.undo.groups.length, 0);
  const sent = JSON.parse(http.calls[0].body.messages[0].content);
  assert.equal(sent.target.currentExpression, 'time * 90');
  assert.equal(sent.target.valueType, 'OneD');
});
