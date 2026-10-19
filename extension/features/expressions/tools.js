'use strict';
/**
 * Expression Engineer — local tools. Validation always goes through the real
 * After Effects expression engine (Property.expressionError).
 */

function targetsOf(ctx) {
  return (ctx.properties || []).filter((p) => p.canSetExpression);
}
function label(ctx, p) {
  const l = (ctx.layers || []).find((x) => x.id === p.address.layerId);
  return `${l ? l.name : `Layer ${p.address.layerIndex}`} › ${p.name}`;
}

const apply = {
  id: 'expressions.apply',
  version: '1.0.0',
  category: 'expressions',
  group: 'Write',
  name: 'Apply Expression',
  description: 'Set an expression on the selected properties; reverts automatically if After Effects reports an error.',
  keywords: ['expression', 'code', 'set', 'write', 'wiggle', 'loopOut'],
  icon: 'code',
  params: {
    code: { type: 'text', label: 'Expression', description: 'After Effects expression source', required: true, maxLength: 20000 },
    revertOnError: { type: 'boolean', label: 'Revert on error', description: 'Restore the previous expression if the engine reports an error', default: true, advanced: true }
  },
  requires: { comp: true, expressionCapable: 1 },
  permissions: ['modify.expressions'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Procedural motion that keyframe tools cannot express: wiggle, loops, linking, time-based behaviour. Write complete, valid AE expressions.' },
  uses: { hostOps: ['expressions.set'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Apply' },

  prepare(args, ctx) {
    const props = targetsOf(ctx);
    if (!props.length) return { ok: false, error: 'No selected property accepts expressions' };
    if (!args.code.trim()) return { ok: false, error: 'Expression is empty (use “Remove Expressions” to clear)' };
    return {
      ok: true,
      compId: ctx.comp.id,
      targets: props.map((p) => ({ address: p.address, expression: args.code, enabled: true })),
      preview: { summary: `Apply expression to ${props.length} propert${props.length > 1 ? 'ies' : 'y'}`, items: props.map((p) => label(ctx, p) + (p.expression ? ' (replaces existing)' : '')) }
    };
  },
  async execute({ args, prepared, host }) {
    return host.call('expressions.set', { compId: prepared.compId, label: 'MOE: Apply Expression', targets: prepared.targets, revertOnError: args.revertOnError });
  },
  verify({ args, result }) {
    const checks = result.targets.map((t) => {
      if (t.skipped) return { ok: false, label: t.name || 'Property', detail: t.skipped };
      if (t.after.expressionError) return { ok: false, label: `${t.layerName} › ${t.name}`, detail: `${t.after.expressionError}${t.reverted ? ' — reverted' : ''}` };
      const ok = t.final.expression === args.code && t.final.expressionEnabled;
      return { ok, label: `${t.layerName} › ${t.name}`, detail: ok ? 'applied, no engine errors' : 'read-back did not match' };
    });
    return { ok: checks.length > 0 && checks.every((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) {
    const changed = result.targets.filter((t) => !t.skipped && !t.reverted);
    if (!changed.length) return null;
    return { compId: ctx.comp.id, targets: changed.map((t) => ({ address: t.address, expression: t.before.expression, enabled: t.before.expressionEnabled })) };
  },
  async restore({ data, host }) {
    return host.call('expressions.set', { compId: data.compId, label: 'MOE: Restore Expression', targets: data.targets, revertOnError: false });
  },
  summarize(result, v) {
    return v.ok ? `Expression applied to ${result.targets.length} propert${result.targets.length > 1 ? 'ies' : 'y'} — no engine errors` : v.checks.find((c) => !c.ok).detail;
  }
};

const validate = {
  id: 'expressions.validate',
  version: '1.0.0',
  category: 'expressions',
  group: 'Check',
  name: 'Validate in AE',
  description: 'Test an expression with the real After Effects engine on the selected property, then restore the original.',
  keywords: ['validate', 'test', 'check', 'error', 'lint'],
  icon: 'check',
  params: {
    code: { type: 'text', label: 'Expression', required: true, maxLength: 20000 }
  },
  requires: { comp: true, expressionCapable: 1 },
  permissions: ['modify.expressions'],
  recovery: 'undo',
  ai: null,
  uses: { hostOps: ['expressions.validate'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Validate' },
  prepare(args, ctx) {
    const props = targetsOf(ctx).slice(0, 1);
    if (!props.length) return { ok: false, error: 'Select a property that accepts expressions' };
    return { ok: true, compId: ctx.comp.id, targets: props.map((p) => ({ address: p.address })), preview: { summary: `Validate on ${label(ctx, props[0])}`, items: [] } };
  },
  async execute({ args, prepared, host }) {
    return host.call('expressions.validate', { compId: prepared.compId, targets: prepared.targets, expression: args.code });
  },
  verify({ result }) {
    const checks = result.targets.map((t) => ({ ok: !t.error && t.restored, label: `${t.layerName} › ${t.name}`, detail: t.error ? t.error : t.restored ? 'no engine errors; original restored' : 'original NOT restored — check the property' }));
    return { ok: checks.every((c) => c.ok), checks };
  },
  summarize(result) {
    const t = result.targets[0];
    return t.error ? `Engine error: ${t.error}` : 'Valid — no engine errors';
  }
};

const inspect = {
  id: 'expressions.inspect',
  version: '1.0.0',
  category: 'expressions',
  group: 'Check',
  name: 'Inspect Expressions',
  description: 'List expressions and engine errors on the selected properties.',
  keywords: ['inspect', 'errors', 'list', 'audit', 'broken'],
  icon: 'search',
  params: {},
  requires: { comp: true, minProperties: 1 },
  permissions: ['read'],
  recovery: 'none',
  ai: null,
  uses: { hostOps: ['context.get'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Inspect' },
  prepare(args, ctx) {
    return { ok: true, preview: { summary: `Inspect ${ctx.properties.length} propert${ctx.properties.length > 1 ? 'ies' : 'y'}`, items: [] } };
  },
  async execute({ ctx }) {
    return {
      items: ctx.properties.map((p) => ({
        label: label(ctx, p), hasExpression: !!p.expression, enabled: p.expressionEnabled,
        error: p.expressionError, length: p.expressionLength || 0, expression: p.expression
      }))
    };
  },
  verify({ result }) {
    return { ok: true, checks: result.items.map((i) => ({ ok: !i.error, label: i.label, detail: i.error || (i.hasExpression ? `${i.length} chars, ${i.enabled ? 'enabled' : 'disabled'}` : 'no expression') })) };
  },
  summarize(result) {
    const errs = result.items.filter((i) => i.error).length;
    const withExpr = result.items.filter((i) => i.hasExpression).length;
    return `${withExpr} expression${withExpr === 1 ? '' : 's'}, ${errs} error${errs === 1 ? '' : 's'}`;
  }
};

const remove = {
  id: 'expressions.remove',
  version: '1.0.0',
  category: 'expressions',
  group: 'Write',
  name: 'Remove Expressions',
  description: 'Clear expressions from the selected properties (restorable).',
  keywords: ['remove', 'clear', 'delete', 'bake'],
  icon: 'trash',
  params: {},
  requires: { comp: true, expressionCapable: 1 },
  permissions: ['modify.expressions'],
  destructive: true,
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Only when the user explicitly asks to remove or clear expressions.' },
  uses: { hostOps: ['expressions.set'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Remove' },
  prepare(args, ctx) {
    const props = targetsOf(ctx).filter((p) => p.expression);
    if (!props.length) return { ok: false, error: 'No selected property has an expression' };
    return { ok: true, compId: ctx.comp.id, targets: props.map((p) => ({ address: p.address, expression: '', enabled: false })), preview: { summary: `Remove ${props.length} expression${props.length > 1 ? 's' : ''}`, items: props.map((p) => label(ctx, p)) } };
  },
  async execute({ prepared, host }) {
    return host.call('expressions.set', { compId: prepared.compId, label: 'MOE: Remove Expressions', targets: prepared.targets, revertOnError: false });
  },
  verify({ result }) {
    const checks = result.targets.map((t) => ({ ok: !t.skipped && t.final.expression === '', label: `${t.layerName} › ${t.name}`, detail: t.final && t.final.expression === '' ? 'cleared' : 'still has an expression' }));
    return { ok: checks.every((c) => c.ok), checks };
  },
  checkpoint: apply.checkpoint,
  restore: apply.restore,
  summarize(result, v) { return v.ok ? `Removed ${result.targets.length} expression(s) — restorable from History` : 'Some expressions were not removed'; }
};

module.exports = { apply, validate, inspect, remove };
