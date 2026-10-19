'use strict';
/**
 * Tool Factory — recipes.
 *
 * A recipe is DATA, never code: a named, parameterised sequence of steps that
 * each call an existing registered tool. Arguments can bind to recipe
 * parameters with {"$param": "name"}. Recipes run through the normal executor
 * (validation, permissions, checkpoints, verification) and need no AI to rerun.
 *
 * {
 *   id, name, description, version, createdAt, source: 'factory'|'copilot'|'manual',
 *   params: { <schema.js params> },
 *   steps: [{ tool: 'motion.smartEase', args: { influenceIn: { "$param": "softness" }, ... }, note }]
 * }
 */

const { checkSchema, validateArgs } = require('../../core/schema');

const MAX_STEPS = 20;

function bind(value, params) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (Object.keys(value).length === 1 && typeof value.$param === 'string') {
      if (!Object.prototype.hasOwnProperty.call(params, value.$param)) throw new Error(`Unknown recipe parameter "${value.$param}"`);
      return params[value.$param];
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = bind(v, params);
    return out;
  }
  return value;
}

function validateRecipe(recipe, registry) {
  const errors = [];
  if (!recipe || typeof recipe !== 'object') return ['Recipe must be an object'];
  if (!recipe.name || String(recipe.name).length > 80) errors.push('Recipe needs a name (max 80 characters)');
  errors.push(...checkSchema(recipe.params || {}, 'params'));
  if (!Array.isArray(recipe.steps) || recipe.steps.length === 0) errors.push('Recipe needs at least one step');
  else if (recipe.steps.length > MAX_STEPS) errors.push(`Recipes are limited to ${MAX_STEPS} steps`);
  if (errors.length) return errors;

  const v = validateArgs(recipe.params || {}, {});
  const defaults = v.value;
  recipe.steps.forEach((s, i) => {
    const tool = registry.get(s.tool);
    if (!tool) { errors.push(`Step ${i + 1}: unknown tool "${s.tool}"`); return; }
    if (!tool.ai || !tool.ai.callable) { errors.push(`Step ${i + 1}: "${tool.name}" cannot be used inside recipes`); return; }
    let bound;
    try { bound = bind(s.args || {}, defaults); } catch (e) { errors.push(`Step ${i + 1}: ${e.message}`); return; }
    const a = validateArgs(tool.params || {}, bound);
    if (!a.ok) errors.push(...a.errors.map((m) => `Step ${i + 1} (${tool.name}): ${m}`));
  });
  return errors;
}

function newId() {
  return `rcp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function createRecipeService({ store, registry, executor }) {
  const list = () => store.get('recipes', []);

  function save(recipe) {
    const errors = validateRecipe(recipe, registry);
    if (errors.length) return { ok: false, errors };
    const rec = Object.assign({ version: '1.0.0', params: {}, createdAt: new Date().toISOString() }, recipe, { id: recipe.id || newId() });
    store.update('recipes', [], (all) => [...all.filter((r) => r.id !== rec.id), rec]);
    return { ok: true, recipe: rec };
  }

  function remove(id) {
    store.update('recipes', [], (all) => all.filter((r) => r.id !== id));
  }

  /** Preflight: validate and check step 1 against the current selection. No changes. */
  async function preflight(recipe, values) {
    const errors = validateRecipe(recipe, registry);
    if (errors.length) return { ok: false, errors };
    const pv = validateArgs(recipe.params || {}, values || {});
    if (!pv.ok) return { ok: false, errors: pv.errors };
    const ctx = await executor.readContext();
    const steps = [];
    for (const [i, s] of recipe.steps.entries()) {
      const args = bind(s.args || {}, pv.value);
      if (i === 0) {
        const c = await executor.check(s.tool, args, { origin: 'recipe', ctx });
        steps.push({ tool: s.tool, args, ok: c.ok, errors: c.errors || [], preview: c.prepared && c.prepared.preview });
      } else steps.push({ tool: s.tool, args, ok: true, errors: [], deferred: true });
    }
    return { ok: steps.every((s) => s.ok), steps, values: pv.value };
  }

  async function run(recipe, values, onStep) {
    const pf = await preflight(recipe, values);
    if (!pf.ok) return { ok: false, errors: pf.errors || pf.steps.flatMap((s) => s.errors) };
    const batchId = `recipe_${Date.now().toString(36)}`;
    const results = [];
    for (const s of pf.steps) {
      onStep && onStep({ step: s, state: 'running' });
      const r = await executor.run(s.tool, s.args, { origin: 'recipe', approved: true, batchId });
      results.push({ step: s, result: r });
      onStep && onStep({ step: s, state: r.status, result: r });
      if (!r.ok) break;
    }
    return { ok: results.length === pf.steps.length && results.every((x) => x.result.ok), results, batchId };
  }

  /** Save an approved Copilot plan as a reusable recipe (no parameters). */
  function fromPlan(plan, name) {
    return save({
      name: name || plan.summary.slice(0, 60),
      description: plan.summary,
      source: 'copilot',
      params: {},
      steps: plan.steps.map((s) => ({ tool: s.tool, args: s.args, note: s.reason }))
    });
  }

  return { list, save, remove, preflight, run, fromPlan };
}

/* ---------- AI: describe a tool → recipe draft ---------- */

const FACTORY_SYSTEM = (catalog) => [
  'You are the Tool Factory inside MOE Motion AI for After Effects 2025.',
  'The user describes a utility they want. You design it as a RECIPE: a short sequence of existing tools with user-facing parameters.',
  'You cannot write scripts. If the utility needs a capability no listed tool provides, return zero steps and explain the missing capability in "limitations".',
  '',
  'Parameters: expose only what a motion designer would want to tweak (1–4 params). Use "number"/"integer" with sensible min/max, "boolean", or "enum" with options.',
  'In step args, reference a parameter as {"$param": "<key>"}; otherwise use literal values. Write each step\'s args as a JSON object string in "args_json".',
  'Every argument of every tool must be provided (literal or $param).',
  '',
  'Available tools:',
  catalog
].join('\n');

function factorySchema(registry) {
  const ids = registry.list({ aiCallable: true }).map((t) => t.id).sort();
  const nullableNumber = { anyOf: [{ type: 'number' }, { type: 'null' }] };
  return {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'description', 'params', 'steps', 'limitations'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      params: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['key', 'type', 'label', 'default_json', 'min', 'max', 'options'],
          properties: {
            key: { type: 'string', description: 'camelCase identifier' },
            type: { type: 'string', enum: ['number', 'integer', 'boolean', 'enum'] },
            label: { type: 'string' },
            default_json: { type: 'string', description: 'Default value as JSON, e.g. 4 or true or "fast"' },
            min: nullableNumber,
            max: nullableNumber,
            options: { type: 'array', items: { type: 'string' }, description: 'Only for enum' }
          }
        }
      },
      steps: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false, required: ['tool', 'args_json', 'note'],
          properties: { tool: { type: 'string', enum: ids }, args_json: { type: 'string' }, note: { type: 'string' } }
        }
      },
      limitations: { type: 'string', description: 'Empty string, or what cannot be built with the current tools.' }
    }
  };
}

/** Convert Claude's draft into a recipe object (still untrusted until validateRecipe passes). */
function draftToRecipe(d) {
  const params = {};
  const errors = [];
  for (const p of d.params || []) {
    let def;
    try { def = JSON.parse(p.default_json); } catch (e) { errors.push(`Parameter ${p.key}: bad default`); continue; }
    const spec = { type: p.type, label: p.label, default: def };
    if (typeof p.min === 'number') spec.min = p.min;
    if (typeof p.max === 'number') spec.max = p.max;
    if (p.type === 'enum') spec.options = (p.options || []).map((o) => ({ value: o, label: o }));
    params[p.key] = spec;
  }
  const steps = [];
  for (const [i, s] of (d.steps || []).entries()) {
    try { steps.push({ tool: s.tool, args: JSON.parse(s.args_json), note: s.note }); } catch (e) { errors.push(`Step ${i + 1}: arguments are not valid JSON`); }
  }
  return { recipe: { name: d.name, description: d.description, source: 'factory', params, steps }, errors, limitations: d.limitations || '' };
}

async function draftRecipe({ ai, registry, description, catalogText }) {
  const res = await ai.createJSON({
    purpose: 'toolfactory.draft',
    system: FACTORY_SYSTEM(catalogText(registry)),
    user: JSON.stringify({ request: String(description).slice(0, 2000) }),
    schema: factorySchema(registry)
  });
  const out = draftToRecipe(res.data);
  out.errors.push(...(out.recipe.steps.length ? validateRecipe(out.recipe, registry) : []));
  return out;
}

module.exports = { createRecipeService, validateRecipe, bind, draftToRecipe, draftRecipe, factorySchema };
