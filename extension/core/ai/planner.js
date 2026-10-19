'use strict';
/**
 * Guided Copilot planner.
 *
 * Claude never touches After Effects directly. It returns a typed action plan
 * whose steps can ONLY reference registered, AI-callable tools. Every step is
 * re-validated locally (schema, context requirements, permissions) before the
 * user is asked to approve it, and executed through the normal executor.
 */

const { toJsonSchema, validateArgs } = require('../schema');
const { packContext } = require('./contextPack');

function aiTools(registry) {
  return registry.list({ aiCallable: true }).sort((a, b) => a.id.localeCompare(b.id));
}

/** Deterministic catalog text: identical across calls so the system prompt caches. */
function catalogText(registry) {
  return aiTools(registry).map((t) => {
    const params = Object.entries(t.params || {}).map(([k, p]) => {
      const bits = [p.type];
      if (p.options) bits.push(`one of ${p.options.map((o) => o.value).join('|')}`);
      if (p.min !== undefined) bits.push(`min ${p.min}`);
      if (p.max !== undefined) bits.push(`max ${p.max}`);
      if (p.default !== undefined) bits.push(`default ${JSON.stringify(p.default)}`);
      return `    - ${k} (${bits.join(', ')}): ${p.description || p.label}`;
    }).join('\n');
    const req = Object.keys(t.requires || {}).length ? `  Needs: ${JSON.stringify(t.requires)}\n` : '';
    return `- ${t.id} — ${t.name}: ${t.description}\n  When: ${t.ai.hint || t.description}\n${req}  Params:\n${params || '    (none)'}`;
  }).join('\n');
}

function planSchema(registry) {
  const stepVariants = aiTools(registry).map((t) => ({
    type: 'object',
    additionalProperties: false,
    required: ['tool', 'args', 'reason'],
    properties: {
      tool: { type: 'string', enum: [t.id] },
      args: {
        type: 'object',
        additionalProperties: false,
        required: Object.keys(t.params || {}),
        properties: toJsonSchema(t.params || {})
      },
      reason: { type: 'string', description: 'One short sentence: why this step.' }
    }
  }));
  return {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'steps', 'warnings', 'clarification'],
    properties: {
      summary: { type: 'string', description: 'What the plan will do, in one or two sentences.' },
      steps: { type: 'array', items: stepVariants.length === 1 ? stepVariants[0] : { anyOf: stepVariants } },
      warnings: { type: 'array', items: { type: 'string' } },
      clarification: { type: 'string', description: 'Empty string, unless the request cannot be done with the available tools — then explain why and what the user should select or change.' }
    }
  };
}

function systemPrompt(registry) {
  return [
    'You are the Motion Copilot inside MOE Motion AI, an Adobe After Effects 2025 panel used by a senior motion designer.',
    'You turn a creative request into a short plan made ONLY of the tools listed below. You cannot run scripts or invent tools.',
    '',
    'Rules:',
    '- Use the fewest steps that achieve the request. Prefer one precise step over several vague ones.',
    '- Tools act on the CURRENT selection in After Effects (selected layers / properties / keyframes). Check the provided context before planning.',
    '- If the selection does not support the request (e.g. no keyframes selected), return no steps and explain what to select in "clarification".',
    '- Fill every parameter explicitly. Respect each parameter\'s min/max.',
    '- Translate creative language into concrete values, e.g. "snappy" = fast departure, long settle; "floaty" = soft, wide influence; frame counts are at the comp frame rate.',
    '- Mention anything risky or uncertain in "warnings". Never claim the change already happened.',
    '',
    'Available tools:',
    catalogText(registry)
  ].join('\n');
}

async function createPlan({ ai, registry, request, ctx }) {
  const user = JSON.stringify({ request: String(request).slice(0, 2000), afterEffectsContext: packContext(ctx) });
  const res = await ai.createJSON({ purpose: 'copilot.plan', system: systemPrompt(registry), user, schema: planSchema(registry) });
  return res.data;
}

/** Local validation of every step; Claude output is untrusted input. */
async function validatePlan({ plan, registry, executor, ctx }) {
  const steps = [];
  for (const [i, s] of (plan.steps || []).entries()) {
    const tool = registry.get(s.tool);
    const step = { index: i, tool: s.tool, toolName: tool ? tool.name : s.tool, args: s.args, reason: s.reason, errors: [] };
    if (!tool || !tool.ai || !tool.ai.callable) {
      step.errors.push('Not an AI-callable tool');
    } else {
      const v = validateArgs(tool.params || {}, s.args);
      if (!v.ok) step.errors.push(...v.errors);
      else {
        step.args = v.value;
        // Only the first step can be checked against the current selection;
        // later steps run on whatever the selection is after the earlier ones.
        if (i === 0) {
          const c = await executor.check(tool.id, v.value, { origin: 'agent', ctx });
          if (!c.ok) step.errors.push(...c.errors);
          else step.preview = c.prepared.preview;
        }
      }
    }
    steps.push(step);
  }
  return {
    summary: plan.summary,
    warnings: plan.warnings || [],
    clarification: plan.clarification || '',
    steps,
    ok: steps.length > 0 && steps.every((s) => s.errors.length === 0)
  };
}

/** Execute an approved plan step by step; stop at the first failure. */
async function runPlan({ plan, executor, onStep }) {
  const batchId = `plan_${Date.now().toString(36)}`;
  const results = [];
  for (const step of plan.steps) {
    onStep && onStep({ step, state: 'running' });
    const r = await executor.run(step.tool, step.args, { origin: 'agent', approved: true, batchId });
    results.push({ step, result: r });
    onStep && onStep({ step, state: r.status, result: r });
    if (!r.ok) break;
  }
  const done = results.filter((x) => x.result.ok).length;
  return { batchId, results, ok: done === plan.steps.length, done, total: plan.steps.length };
}

/** Roll back the completed steps of a plan, newest first. */
async function rollbackPlan({ results, executor }) {
  const out = [];
  for (const { result } of [...results].reverse()) {
    if (result.checkpointId) out.push(await executor.restore(result.checkpointId));
  }
  return { ok: out.every((r) => r.ok), restored: out.filter((r) => r.ok).length };
}

module.exports = { createPlan, validatePlan, runPlan, rollbackPlan, planSchema, systemPrompt, catalogText };
