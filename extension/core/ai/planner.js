'use strict';
/**
 * Guided Copilot planner.
 *
 * Claude never touches After Effects directly. It returns a typed action plan
 * whose steps can ONLY reference registered, AI-callable tools. Every step is
 * re-validated locally (schema, context requirements, permissions) before the
 * user is asked to approve it, and executed through the normal executor.
 */

const { validateArgs } = require('../schema');
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

/**
 * Structured-output schema for a plan.
 *
 * v0.6.4: kept deliberately small. One strict variant per tool (anyOf of ~40 objects with
 * full parameter schemas) made the API reject the request with "compiled grammar is too
 * large". The grammar now only pins the tool id (enum); the arguments travel as a JSON
 * string described by the catalog in the system prompt, and are parsed and re-validated
 * locally against the tool's own schema (validatePlan) — the same pattern Tool Factory uses.
 */
function planSchema(registry) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'steps', 'warnings', 'clarification'],
    properties: {
      summary: { type: 'string', description: 'What the plan will do, in one or two sentences.' },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['tool', 'args_json', 'reason'],
          properties: {
            tool: { type: 'string', enum: aiTools(registry).map((t) => t.id) },
            args_json: { type: 'string', description: 'JSON object with every parameter of that tool, e.g. {"influenceIn":90,"sides":"both"}' },
            reason: { type: 'string', description: 'One short sentence: why this step.' }
          }
        }
      },
      warnings: { type: 'array', items: { type: 'string' } },
      clarification: { type: 'string', description: 'Empty string, unless the request cannot be done with the available tools — then explain why and what the user should select or change.' }
    }
  };
}

/** Turn a step's args_json (or a legacy args object) into an object; errors are reported, not thrown. */
function stepArgs(s) {
  if (s && s.args && typeof s.args === 'object' && !Array.isArray(s.args)) return { args: s.args };
  if (s && typeof s.args_json === 'string') {
    try {
      const v = JSON.parse(s.args_json || '{}');
      if (v && typeof v === 'object' && !Array.isArray(v)) return { args: v };
    } catch (e) { /* fall through */ }
    return { args: {}, error: 'Arguments are not a valid JSON object' };
  }
  return { args: {}, error: 'Missing arguments' };
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
    '- Put the arguments of each step in "args_json" as a JSON object string. Fill every parameter of that tool explicitly, use only the parameter names listed for it, and respect each parameter\'s type, options and min/max.',
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
    const parsed = stepArgs(s);
    const step = { index: i, tool: s.tool, toolName: tool ? tool.name : s.tool, args: parsed.args, reason: s.reason, errors: [] };
    if (!tool || !tool.ai || !tool.ai.callable) {
      step.errors.push('Not an AI-callable tool');
    } else if (parsed.error) {
      step.errors.push(parsed.error);
    } else {
      const v = validateArgs(tool.params || {}, parsed.args);
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

module.exports = { createPlan, validatePlan, runPlan, rollbackPlan, planSchema, systemPrompt, catalogText, stepArgs };
