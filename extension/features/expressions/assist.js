'use strict';
/**
 * Expression Assistant (Claude). Generates, fixes, explains or optimizes an
 * expression for the selected property. It never writes to the project:
 * the result is shown as a diff and the user decides to Validate / Apply.
 */

const { packContext } = require('../../core/ai/contextPack');

const SYSTEM = [
  'You are the Expression Engineer inside MOE Motion AI for Adobe After Effects 2025.',
  'You write After Effects expressions for the JavaScript expression engine (default since AE 16.0) unless the context says the project uses the Legacy ExtendScript engine.',
  '',
  'Rules:',
  '- Output a complete expression that can be pasted as-is into the target property. No markdown fences.',
  '- The final statement must evaluate to a value of the target property\'s type: OneD → number; TwoD/TwoD_SPATIAL → [x, y]; ThreeD/ThreeD_SPATIAL → [x, y, z]; COLOR → [r, g, b, a] in 0–1.',
  '- Use only documented AE expression APIs (thisComp, thisLayer, thisProperty, time, value, wiggle, loopOut, valueAtTime, effect("…")("…"), linear, ease, etc.).',
  '- Reference layers and effects by the names in the context. If a referenced layer/effect is not in the context, say so in notes.',
  '- Prefer readable code with short comments for non-obvious parts. Keep it efficient (avoid per-frame loops over many keyframes when a closed form exists).',
  '- For mode "explain", put the explanation in "explanation" and return the original code unchanged in "code".',
  '- For mode "fix", use the reported engine error to repair the code and explain the cause.',
  '- Be honest about uncertainty in "notes". Never claim it was tested; the panel validates it with the real engine.'
].join('\n');

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['code', 'explanation', 'notes', 'controls'],
  properties: {
    code: { type: 'string', description: 'The full expression source.' },
    explanation: { type: 'string', description: 'Short explanation of what the expression does (or what was wrong).' },
    notes: { type: 'array', items: { type: 'string' }, description: 'Assumptions, required layers/effects, caveats.' },
    controls: {
      type: 'array',
      description: 'Expression Controls the expression expects (empty if none).',
      items: {
        type: 'object', additionalProperties: false, required: ['type', 'name'],
        properties: { type: { type: 'string', enum: ['Slider', 'Angle', 'Checkbox', 'Color', 'Point', '3D Point', 'Layer'] }, name: { type: 'string' } }
      }
    }
  }
};

module.exports = {
  id: 'expressions.assist',
  version: '1.0.0',
  category: 'expressions',
  group: 'Assistant',
  name: 'Expression Assistant',
  description: 'Generate, fix, explain or optimize an expression with Claude. Shows a diff before anything changes.',
  keywords: ['ai', 'generate', 'fix', 'debug', 'explain', 'optimize', 'claude', 'write expression'],
  icon: 'spark',
  params: {
    mode: {
      type: 'enum', label: 'Mode', default: 'generate',
      options: [{ value: 'generate', label: 'Generate' }, { value: 'fix', label: 'Fix' }, { value: 'explain', label: 'Explain' }, { value: 'optimize', label: 'Optimize' }]
    },
    request: { type: 'text', label: 'Describe', description: 'What the expression should do (or what is wrong)', maxLength: 2000 }
  },
  requires: { comp: true, expressionCapable: 1 },
  permissions: ['network.ai'],
  recovery: 'none',
  ai: null,
  uses: { hostOps: [], network: true },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Ask Claude' },

  prepare(args, ctx) {
    const target = ctx.properties.find((p) => p.canSetExpression);
    if (!target) return { ok: false, error: 'Select a property that accepts expressions' };
    if (args.mode === 'generate' && !(args.request || '').trim()) return { ok: false, error: 'Describe what the expression should do' };
    if (args.mode !== 'generate' && !target.expression) return { ok: false, error: 'The selected property has no expression to work on' };
    return { ok: true, target, preview: { summary: `${args.mode[0].toUpperCase() + args.mode.slice(1)} expression for ${target.name}`, items: [] } };
  },

  async execute({ args, ctx, prepared, services }) {
    const t = prepared.target;
    const user = JSON.stringify({
      mode: args.mode,
      request: args.request || '',
      target: { name: t.name, matchName: t.matchName, valueType: t.valueType, keyframes: t.numKeys, currentExpression: t.expression || '', engineError: t.expressionError || '' },
      context: packContext(ctx, { maxLayers: 40, maxProps: 10 })
    });
    const res = await services.ai.createJSON({ purpose: `expressions.${args.mode}`, system: SYSTEM, user, schema: SCHEMA });
    return Object.assign({ original: t.expression || '', target: { address: t.address, name: t.name } }, res.data);
  },

  summarize(result) {
    return result.explanation ? result.explanation.split('\n')[0].slice(0, 140) : 'Answer ready';
  }
};
