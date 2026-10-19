'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const fx = require('./fixtures/comps');
const { validateRecipe, draftToRecipe } = require('../extension/features/toolfactory/recipes');

const recipe = {
  name: 'Snappy cascade',
  params: { step: { type: 'integer', label: 'Step', min: 1, max: 20, default: 3 } },
  steps: [{ tool: 'motion.stagger', args: { frames: { $param: 'step' }, order: 'index', mode: 'offset', seed: 1 } }]
};

test('recipe validation: binds params, rejects unknown tools/params/non-callable tools', async () => {
  const { services } = await createTestServices(fx.staggerComp(25));
  assert.deepEqual(validateRecipe(recipe, services.registry), []);
  assert.match(validateRecipe({ name: 'x', steps: [{ tool: 'nope.tool', args: {} }] }, services.registry)[0], /unknown tool/);
  assert.match(validateRecipe({ name: 'x', steps: [{ tool: 'motion.stagger', args: { frames: { $param: 'zz' } } }] }, services.registry)[0], /Unknown recipe parameter/);
  assert.match(validateRecipe({ name: 'x', steps: [{ tool: 'expressions.assist', args: {} }] }, services.registry)[0], /cannot be used/);
});

test('recipe save → preflight → run (no AI needed) → history', async () => {
  const { services, comp } = await createTestServices(fx.staggerComp(25));
  const saved = services.recipes.save(recipe);
  assert.ok(saved.ok);
  assert.equal(services.recipes.list().length, 1);
  const pf = await services.recipes.preflight(saved.recipe, { step: 5 });
  assert.ok(pf.ok);
  const r = await services.recipes.run(saved.recipe, { step: 5 });
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(comp._layers.map((l) => Math.round(l.startTime * 25)), [0, 5, 10, 15]);
  assert.equal(services.executor.history()[0].origin, 'recipe');
  const bad = await services.recipes.run(saved.recipe, { step: 99 });
  assert.equal(bad.ok, false);
});

test('Tool Factory draft conversion keeps Claude output untrusted', async () => {
  const { services } = await createTestServices(fx.staggerComp(25));
  const out = draftToRecipe({
    name: 'Soft cascade', description: 'd', limitations: '',
    params: [{ key: 'soft', type: 'number', label: 'Softness', default_json: '70', min: 1, max: 100, options: [] }],
    steps: [{ tool: 'motion.smartEase', args_json: '{"influenceIn":{"$param":"soft"},"influenceOut":{"$param":"soft"},"sides":"both","scope":"all"}', note: '' }, { tool: 'motion.stagger', args_json: 'not json', note: '' }]
  });
  assert.equal(out.errors.length, 1);
  assert.equal(out.recipe.steps.length, 1);
  assert.deepEqual(validateRecipe(out.recipe, services.registry), []);
});

test('Copilot plan → saved recipe', async () => {
  const { services } = await createTestServices(fx.staggerComp(25));
  const r = services.recipes.fromPlan({ summary: 'Cascade by 2', steps: [{ tool: 'motion.stagger', args: { frames: 2, order: 'index', mode: 'offset', seed: 1 }, reason: 'x' }] });
  assert.ok(r.ok);
  assert.equal(r.recipe.source, 'copilot');
});
