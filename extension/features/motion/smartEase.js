'use strict';
/**
 * Smart Ease — set temporal ease (speed 0, chosen influence) on keyframes.
 * Runs fully locally. One AE undo step + a MOE checkpoint for exact restore.
 */

const NOT_EASEABLE = new Set(['NO_VALUE', 'MARKER', 'TEXT_DOCUMENT', 'LAYER_INDEX', 'MASK_INDEX', 'CUSTOM_VALUE']);
const TOL = 0.01;

function layerNameOf(ctx, address) {
  const l = (ctx.layers || []).find((x) => x.id === address.layerId);
  return l ? l.name : `Layer ${address.layerIndex}`;
}

module.exports = {
  id: 'motion.smartEase',
  version: '1.0.0',
  category: 'motion',
  group: 'Easing',
  name: 'Smart Ease',
  description: 'Apply precise ease-in / ease-out influence to keyframes.',
  keywords: ['ease', 'easy ease', 'influence', 'smooth', 'snappy', 'graph', 'velocity', 'bezier'],
  icon: 'ease',
  params: {
    influenceIn: { type: 'number', label: 'Ease In', description: 'Incoming influence on each key (arriving)', min: 0.1, max: 100, step: 0.1, default: 33.33, unit: '%' },
    influenceOut: { type: 'number', label: 'Ease Out', description: 'Outgoing influence on each key (departing)', min: 0.1, max: 100, step: 0.1, default: 33.33, unit: '%' },
    sides: {
      type: 'enum', label: 'Sides', default: 'both', description: 'Which side of each keyframe to ease',
      options: [{ value: 'both', label: 'In + Out' }, { value: 'in', label: 'In' }, { value: 'out', label: 'Out' }]
    },
    scope: {
      type: 'enum', label: 'Apply to', default: 'selected', advanced: true, description: 'Selected keyframes only, or every keyframe on the selected properties',
      options: [{ value: 'selected', label: 'Selected keys' }, { value: 'all', label: 'All keys on property' }]
    }
  },
  requires: { comp: true, keyframedProperties: 1 },
  permissions: ['modify.keyframes'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Any easing request: smooth, snappy, soft landing, ease in/out, bouncy start/stop feel without overshoot.' },
  uses: { hostOps: ['keyframes.applyEase', 'keyframes.restoreEase'], network: false },
  compatibility: { minAE: '25.0' },
  ui: {
    primaryLabel: 'Apply Ease',
    presets: [
      { id: 'easy', label: 'Easy', args: { influenceIn: 33.33, influenceOut: 33.33 } },
      { id: 'smooth', label: 'Smooth', args: { influenceIn: 66, influenceOut: 66 } },
      { id: 'strong', label: 'Strong', args: { influenceIn: 85, influenceOut: 85 } },
      { id: 'snappy', label: 'Snappy', args: { influenceIn: 90, influenceOut: 15 } },
      { id: 'launch', label: 'Launch', args: { influenceIn: 15, influenceOut: 90 } }
    ]
  },

  prepare(args, ctx) {
    const targets = [];
    const items = [];
    let keyCount = 0;
    for (const p of ctx.properties || []) {
      if (p.numKeys === 0 || NOT_EASEABLE.has(p.valueType)) continue;
      const keys = args.scope === 'all'
        ? Array.from({ length: p.numKeys }, (_, i) => i + 1)
        : p.selectedKeys.slice();
      if (!keys.length) continue;
      targets.push({ address: p.address, keys });
      keyCount += keys.length;
      items.push(`${layerNameOf(ctx, p.address)} › ${p.name}: ${keys.length} key${keys.length > 1 ? 's' : ''}`);
    }
    if (!targets.length) {
      return { ok: false, error: args.scope === 'all' ? 'No keyframed properties selected' : 'No keyframes selected on easeable properties' };
    }
    const easeIn = args.sides !== 'out' ? { speed: 0, influence: args.influenceIn } : null;
    const easeOut = args.sides !== 'in' ? { speed: 0, influence: args.influenceOut } : null;
    const sideTxt = args.sides === 'both' ? `in ${args.influenceIn}% / out ${args.influenceOut}%` : args.sides === 'in' ? `in ${args.influenceIn}%` : `out ${args.influenceOut}%`;
    return {
      ok: true,
      compId: ctx.comp.id,
      targets, easeIn, easeOut,
      preview: { summary: `Ease ${keyCount} keyframe${keyCount > 1 ? 's' : ''} (${sideTxt})`, items }
    };
  },

  async execute({ prepared, host }) {
    return host.call('keyframes.applyEase', {
      compId: prepared.compId,
      label: 'MOE: Smart Ease',
      targets: prepared.targets,
      easeIn: prepared.easeIn,
      easeOut: prepared.easeOut
    });
  },

  verify({ prepared, result }) {
    const checks = [];
    for (const t of result.targets) {
      for (const s of t.skipped) checks.push({ ok: false, label: `Key ${s.index}`, detail: s.reason });
      for (const k of t.after) {
        const sides = [];
        if (prepared.easeIn && k.inInterp !== 'HOLD') sides.push(['in', k.easeIn, prepared.easeIn, k.inInterp]);
        if (prepared.easeOut && k.outInterp !== 'HOLD') sides.push(['out', k.easeOut, prepared.easeOut, k.outInterp]);
        let ok = true;
        const detail = [];
        for (const [side, actual, want, interp] of sides) {
          if (actual.length !== t.dims) { ok = false; detail.push(`${side}: expected ${t.dims} dims, got ${actual.length}`); }
          for (const e of actual) {
            if (Math.abs(e.influence - want.influence) > TOL || Math.abs(e.speed - want.speed) > 1e-6) {
              ok = false;
              detail.push(`${side}: influence ${e.influence.toFixed(2)} speed ${e.speed}`);
            }
          }
          if (interp !== 'BEZIER') { ok = false; detail.push(`${side}: interpolation ${interp}`); }
        }
        const held = (prepared.easeIn && k.inInterp === 'HOLD') || (prepared.easeOut && k.outInterp === 'HOLD');
        checks.push({ ok, label: `Key ${k.index} @ ${k.time.toFixed(3)}s`, detail: ok ? (held ? 'hold side kept' : 'verified') : detail.join('; ') });
      }
    }
    return { ok: checks.length > 0 && checks.every((c) => c.ok), checks };
  },

  checkpoint({ result, ctx }) {
    return { compId: ctx.comp.id, targets: result.targets.map((t) => ({ address: t.address, keys: t.before })) };
  },

  async restore({ data, host }) {
    return host.call('keyframes.restoreEase', { compId: data.compId, label: 'MOE: Restore Ease', targets: data.targets });
  },

  summarize(result, verification) {
    const n = result.targets.reduce((a, t) => a + t.after.length, 0);
    return verification.ok ? `Eased ${n} keyframe${n === 1 ? '' : 's'} — verified` : `Eased ${n} keyframes — ${verification.checks.filter((c) => !c.ok).length} check(s) failed`;
  }
};
