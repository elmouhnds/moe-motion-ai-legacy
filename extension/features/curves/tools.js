'use strict';
/**
 * Ease Curve — shape the speed graph with a cubic Bézier (graph-editor style, like Flow / Motion 4).
 * The curve is applied to every segment between consecutive selected keyframes of a property:
 * the segment's first key gets the outgoing ease, its second key the incoming ease.
 * Maths in ./bezier.js (pure, tested); the host op only stores the numbers and reads them back.
 */
const B = require('./bezier');

const NUMERIC = new Set(['OneD', 'TwoD', 'ThreeD', 'TwoD_SPATIAL', 'ThreeD_SPATIAL']);
const SPATIAL = /_SPATIAL$/;
const close = (a, b, tol) => Math.abs(a - b) <= tol;
const asArray = (v) => (Array.isArray(v) ? v : [v]);

function layerNameOf(ctx, address) {
  const l = (ctx.layers || []).find((x) => x.id === address.layerId);
  return l ? l.name : `Layer ${address.layerIndex}`;
}

const easeCurve = {
  id: 'motion.easeCurve',
  version: '1.1.0',
  category: 'motion',
  group: 'Easing',
  name: 'Ease Curve',
  description: 'Shape the speed graph with a Bézier curve: drag the two handles or pick a preset (expo, back / overshoot, punch, glide…). Applied between every pair of selected keyframes, with exact speed and influence.',
  keywords: ['speed graph', 'value graph', 'graph editor', 'bezier', 'curve', 'cubic-bezier', 'ease', 'flow', 'motion 4', 'expo', 'back', 'overshoot', 'velocity', 'influence'],
  icon: 'easeCurve',
  params: {
    x1: { type: 'number', label: 'Out X', description: 'Outgoing handle: time (influence of the first key)', min: B.X_MIN, max: B.X_MAX, step: 0.01, default: 0.333 },
    y1: { type: 'number', label: 'Out Y', description: 'Outgoing handle: progress (speed of the first key)', min: B.Y_MIN, max: B.Y_MAX, step: 0.01, default: 0 },
    x2: { type: 'number', label: 'In X', description: 'Incoming handle: time (influence of the second key)', min: B.X_MIN, max: B.X_MAX, step: 0.01, default: 0.667 },
    y2: { type: 'number', label: 'In Y', description: 'Incoming handle: progress (speed of the second key)', min: B.Y_MIN, max: B.Y_MAX, step: 0.01, default: 1 },
    through: { type: 'boolean', label: 'Pass through middle keys', default: false, description: 'With 3+ keys, the speed flows through the middle keys (no stop) — like EaseCopy pass-through' },
    side: { type: 'enum', label: 'Apply to', default: 'both', options: [{ value: 'both', label: 'In + Out' }, { value: 'in', label: 'Ease In only' }, { value: 'out', label: 'Ease Out only' }], description: 'In = the incoming side of each segment\'s second key; Out = the outgoing side of its first key (Shift / Ctrl-click a preset in the Motion Kit)' }
  },
  requires: { comp: true, selectedKeys: 2 },
  permissions: ['modify.keyframes'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Easing as a CSS-style cubic-bezier (x1,y1,x2,y2) between selected keyframes: expo, back/overshoot (y outside 0–1), punch, glide, any graph-editor curve.' },
  uses: { hostOps: ['keyframes.read', 'keyframes.setEase', 'keyframes.restoreEase'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Apply Curve' },

  prepare(args, ctx) {
    const targets = [];
    const items = [];
    let segs = 0;
    const skipped = [];
    for (const p of ctx.properties || []) {
      if ((p.selectedKeys || []).length < 2) continue;
      if (!NUMERIC.has(p.valueType)) { skipped.push(`${p.name}: not a numeric property (use Smart Ease)`); continue; }
      const keys = [...new Set(p.selectedKeys)].sort((a, b) => a - b);
      targets.push({ address: p.address, keys, spatial: SPATIAL.test(p.valueType), name: p.name });
      segs += keys.length - 1;
      items.push(`${layerNameOf(ctx, p.address)} › ${p.name}: ${keys.length - 1} segment${keys.length > 2 ? 's' : ''}`);
    }
    if (!targets.length) return { ok: false, error: skipped[0] || 'Select at least two keyframes on one property' };
    const curve = B.normalize(args);
    const side = args.side || 'both';
    return { ok: true, compId: ctx.comp.id, curve, side, through: !!args.through, targets, preview: { summary: `${B.css(curve)}${side === 'both' ? '' : side === 'in' ? ' (ease in)' : ' (ease out)'} on ${segs} segment${segs > 1 ? 's' : ''}`, items: items.concat(skipped) } };
  },

  async execute({ prepared, host }) {
    const read = await host.call('keyframes.read', { compId: prepared.compId, targets: prepared.targets.map((t) => ({ address: t.address, keys: t.keys })) });
    const targets = [];
    let clamped = false;
    for (let i = 0; i < prepared.targets.length; i++) {
      const t = prepared.targets[i];
      const byIndex = new Map(read.targets[i].keys.map((k) => [k.index, k]));
      const plan = new Map();
      for (const { a, b } of B.segments(t.keys)) {
        const ka = byIndex.get(a), kb = byIndex.get(b);
        if (!ka || !kb || ka.value === null || kb.value === null) continue;
        const va = asArray(ka.value), vb = asArray(kb.value);
        const te = B.toTemporal(prepared.curve, { dt: kb.time - ka.time, dv: vb.map((v, d) => v - va[d]), spatial: t.spatial });
        if (te.clamped) clamped = true;
        const side = prepared.side || 'both';
        if (side !== 'in') plan.set(a, Object.assign(plan.get(a) || { index: a, easeIn: null }, { easeOut: te.out }));
        if (side !== 'out') plan.set(b, Object.assign(plan.get(b) || { index: b, easeOut: null }, { easeIn: te.in }));
      }
      // Pass-through: a key between two shaped segments keeps moving — both sides get the speed of the
      // line from the key before to the key after (per dimension; along the path for Position).
      if (prepared.through) {
        for (let j = 1; j + 1 < t.keys.length; j++) {
          const kp = byIndex.get(t.keys[j - 1]), kn = byIndex.get(t.keys[j + 1]), k = plan.get(t.keys[j]);
          if (!kp || !kn || !k || !k.easeIn || !k.easeOut || kn.time <= kp.time) continue;
          const vp = asArray(kp.value), vn = asArray(kn.value), span = kn.time - kp.time;
          const sp = t.spatial ? [Math.hypot(...vn.map((v, d) => v - vp[d])) / span] : vn.map((v, d) => (v - vp[d]) / span);
          k.easeIn = k.easeIn.map((e, d) => ({ speed: sp[d], influence: e.influence }));
          k.easeOut = k.easeOut.map((e, d) => ({ speed: sp[d], influence: e.influence }));
        }
      }
      if (plan.size) targets.push({ address: t.address, keys: [...plan.values()].map((k) => Object.assign({ easeIn: null, easeOut: null }, k)) });
    }
    if (!targets.length) throw new Error('No segments with numeric keyframes to shape');
    const res = await host.call('keyframes.setEase', { compId: prepared.compId, label: 'MOE: Ease Curve', targets });
    return Object.assign(res, { sent: targets, clamped });
  },

  verify({ result }) {
    const checks = [];
    result.targets.forEach((t, ti) => {
      const sent = new Map(result.sent[ti].keys.map((k) => [k.index, k]));
      for (const s of t.skipped) checks.push({ ok: /^HOLD_/.test(s.reason), label: `Key ${s.index}`, detail: /^HOLD_/.test(s.reason) ? 'hold side kept' : s.reason });
      for (const k of t.after) {
        const want = sent.get(k.index);
        const detail = [];
        for (const [side, got, exp] of [['in', k.easeIn, want.easeIn], ['out', k.easeOut, want.easeOut]]) {
          if (!exp || (side === 'in' ? k.inInterp : k.outInterp) === 'HOLD') continue;
          if (got.length !== exp.length) { detail.push(`${side}: ${got.length} dims`); continue; }
          got.forEach((g, d) => {
            if (!close(g.influence, exp[d].influence, 0.01) || !close(g.speed, exp[d].speed, Math.max(1e-4, Math.abs(exp[d].speed) * 1e-3))) detail.push(`${side}: speed ${g.speed.toFixed(3)} / ${g.influence.toFixed(2)}%`);
          });
        }
        checks.push({ ok: !detail.length, label: `Key ${k.index} @ ${k.time.toFixed(3)}s`, detail: detail.length ? detail.join('; ') : 'verified' });
      }
    });
    if (result.clamped) checks.push({ ok: true, label: 'Position', detail: 'anticipation / overshoot on a spatial property is limited to 0 speed (separate X/Y for full back curves)' });
    return { ok: checks.length > 0 && checks.every((c) => c.ok), checks };
  },

  checkpoint({ result, ctx }) {
    return { compId: ctx.comp.id, targets: result.targets.map((t) => ({ address: t.address, keys: t.before })) };
  },
  async restore({ data, host }) { return host.call('keyframes.restoreEase', Object.assign({ label: 'MOE: Restore Curve' }, data)); },
  summarize(result) {
    const n = result.targets.reduce((s, t) => s + t.after.length, 0);
    return `Curve on ${n} keyframe${n === 1 ? '' : 's'}${result.clamped ? ' (Position: no anticipation)' : ''}`;
  }
};

module.exports = { easeCurve };
