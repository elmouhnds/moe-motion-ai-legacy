'use strict';
/**
 * Motion Kit tools (v0.10) — small, one-click tools modelled on what pros use daily
 * (Motion 4 / AE native, see docs/features/MOTION_KIT.md):
 *   kit.interp      Linear / Hold / Bezier on the selected keys (in, out or both sides)
 *   kit.trimToKeys  layer In / Out to its first / last keyframe
 *   kit.parent      parent the selected layers in a chain (selection order; reverse)
 *   kit.stare       rotation always faces a target layer (Layer Control on the layer)
 *   kit.vignette    a feathered "MOE Vignette" solid on top of the comp
 *   kit.trash       remove MOE rigs (MOE-tagged expressions + MOE effects) from the selection
 * Every run is one undo step; host ops in host/ops/kit.jsx, layout.jsx, fx.jsx, expressions.jsx.
 */
const S = require('../compositing/shared');

const visual = (ctx) => (ctx.layers || []).filter((l) => !['camera', 'light'].includes(l.type) && !l.locked);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const SIDES = [{ value: 'both', label: 'Both' }, { value: 'in', label: 'In' }, { value: 'out', label: 'Out' }];

/** Selected keys per property (sorted, distinct). */
function keyTargets(ctx) {
  return (ctx.properties || []).filter((p) => (p.selectedKeys || []).length).map((p) => ({ address: p.address, name: p.name, keys: [...new Set(p.selectedKeys)].sort((a, b) => a - b) }));
}

/* ---------------- interpolation ---------------- */
const INTERP = { linear: 'LINEAR', hold: 'HOLD', bezier: 'BEZIER' };
const interp = {
  id: 'kit.interp', version: '1.0.0', category: 'motion', group: 'Easing', name: 'Interpolation',
  description: 'Set the selected keyframes to Linear, Hold or Bezier — on the incoming side, the outgoing side or both (AE: Keyframe Interpolation, one click).',
  keywords: ['linear', 'hold', 'bezier', 'interpolation', 'toggle hold', 'step', 'keyframe'],
  icon: 'easeCurve',
  params: {
    mode: { type: 'enum', label: 'Type', default: 'linear', options: [{ value: 'linear', label: 'Linear' }, { value: 'hold', label: 'Hold' }, { value: 'bezier', label: 'Bezier' }] },
    side: { type: 'enum', label: 'Side', default: 'both', options: SIDES }
  },
  requires: { comp: true, selectedKeys: 1 },
  permissions: ['modify.keyframes'], recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Make selected keyframes linear, hold (stepped) or bezier.' },
  uses: { hostOps: ['keyframes.setInterp', 'keyframes.restoreEase'], network: false }, compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Set' },
  prepare(args, ctx) {
    const t = keyTargets(ctx);
    if (!t.length) return { ok: false, error: 'Select keyframes' };
    const n = t.reduce((s, x) => s + x.keys.length, 0);
    return { ok: true, targets: t, preview: { summary: `${args.mode[0].toUpperCase()}${args.mode.slice(1)} (${args.side}) on ${plural(n, 'key')}`, items: t.map((x) => x.name) } };
  },
  async execute({ args, ctx, prepared, host }) {
    const type = INTERP[args.mode];
    return host.call('keyframes.setInterp', {
      compId: ctx.comp.id, label: `MOE: ${args.mode[0].toUpperCase()}${args.mode.slice(1)}`,
      targets: prepared.targets.map((t) => ({ address: t.address, keys: t.keys.map((index) => ({ index, inType: args.side !== 'out' ? type : null, outType: args.side !== 'in' ? type : null })) }))
    }).then((r) => Object.assign(r, { type, side: args.side }));
  },
  verify({ result }) {
    const checks = [];
    for (const t of result.targets) {
      for (const k of t.after) {
        const ok = (result.side === 'out' || k.inInterp === result.type) && (result.side === 'in' || k.outInterp === result.type);
        checks.push({ ok, label: `Key ${k.index}`, detail: `in ${k.inInterp.toLowerCase()} · out ${k.outInterp.toLowerCase()}` });
      }
    }
    return { ok: checks.length > 0 && checks.every((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, targets: result.targets.map((t) => ({ address: t.address, keys: t.before })) }; },
  async restore({ data, host }) { return host.call('keyframes.restoreEase', Object.assign({ label: 'MOE: Restore Interpolation' }, data)); },
  summarize(result) { const n = result.targets.reduce((s, t) => s + t.after.length, 0); return `${result.type.toLowerCase()} on ${plural(n, 'key')}`; }
};

/* ---------------- trim to keys ---------------- */
const trimToKeys = {
  id: 'kit.trimToKeys', version: '1.0.0', category: 'tools', group: 'Layer', name: 'Trim to Keys',
  description: 'Trim each selected layer so it starts on its first keyframe and ends on its last.',
  keywords: ['trim', 'in point', 'out point', 'keys', 'layer duration', 'motion 4'],
  icon: 'trim',
  params: {},
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers'], recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Trim layer in/out points to their first and last keyframes.' },
  uses: { hostOps: ['layers.trimToKeys', 'layers.restoreTiming'], network: false }, compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Trim' },
  prepare(args, ctx) {
    const l = visual(ctx);
    if (!l.length) return { ok: false, error: 'Select unlocked layers' };
    return { ok: true, layers: l, preview: { summary: `Trim ${plural(l.length, 'layer')} to their keys`, items: l.slice(0, 6).map((x) => x.name) } };
  },
  async execute({ ctx, prepared, host }) { return host.call('layers.trimToKeys', { compId: ctx.comp.id, layers: prepared.layers.map((x) => x.id) }); },
  verify({ result, ctx }) {
    const fd = (ctx && ctx.comp && ctx.comp.frameDuration) || 1 / 25;
    const why = { NO_KEYS: 'no keyframes', ONE_KEY_TIME: 'all keys at one time', LOCKED: 'locked' };
    const checks = result.layers.map((l) => (l.skipped ? { ok: true, label: l.name, detail: `skipped — ${why[l.skipped] || l.skipped}` }
      : { ok: Math.abs(l.after.inPoint - l.range[0]) < fd / 2 && Math.abs(l.after.outPoint - l.range[1]) < fd / 2, label: l.name, detail: `${l.after.inPoint.toFixed(2)}s → ${l.after.outPoint.toFixed(2)}s` }));
    return { ok: result.layers.some((l) => !l.skipped) && checks.every((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, layers: result.layers.filter((l) => !l.skipped).map((l) => Object.assign({ layerId: l.layerId }, l.before)) }; },
  async restore({ data, host }) { return host.call('layers.restoreTiming', data); },
  summarize(result) { return `Trimmed ${plural(result.layers.filter((l) => !l.skipped).length, 'layer')}`; }
};

/* ---------------- parent chain ---------------- */
const parent = {
  id: 'kit.parent', version: '1.0.0', category: 'tools', group: 'Layer', name: 'Parent Chain',
  description: 'Parent the selected layers in a chain, in the order you selected them (each to the one before). Reverse = each to the one after. Nothing jumps.',
  keywords: ['parent', 'chain', 'link', 'hierarchy', 'motion 4'],
  icon: 'parentNull',
  params: { reverse: { type: 'boolean', label: 'Reverse order', default: false } },
  requires: { comp: true, minLayers: 2 },
  permissions: ['modify.layers'], recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Chain-parent the selected layers in selection order (reverse=true flips the chain).' },
  uses: { hostOps: ['layers.setParent'], network: false }, compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Parent' },
  prepare(args, ctx) {
    const l = visual(ctx);
    if (l.length < 2) return { ok: false, error: 'Select at least two layers' };
    const order = args.reverse ? l.slice().reverse() : l;
    return { ok: true, order, preview: { summary: `Chain ${l.length} layers`, items: order.map((x) => x.name) } };
  },
  async execute({ ctx, prepared, host }) {
    const items = prepared.order.slice(1).map((x, i) => ({ layerId: x.id, parentId: prepared.order[i].id }));
    return host.call('layers.setParent', { compId: ctx.comp.id, label: 'MOE: Parent Chain', items });
  },
  verify({ result, prepared }) {
    const checks = result.layers ? result.layers : result.items || [];
    const list = (Array.isArray(checks) ? checks : []).map((x, i) => ({ ok: x.after === prepared.order[i].id, label: x.name, detail: `→ ${prepared.order[i].name}` }));
    return { ok: list.length > 0 && list.every((c) => c.ok), checks: list };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, items: (result.layers || result.items || []).map((x) => ({ layerId: x.layerId, parentId: x.before })) }; },
  async restore({ data, host }) { return host.call('layers.setParent', { compId: data.compId, label: 'MOE: Restore Parents', items: data.items }); },
  summarize(result) { return `Chained ${plural((result.layers || result.items || []).length + 1, 'layer')}`; }
};

/* ---------------- stare ---------------- */
const STARE_TAG = '// MOE Stare';
const STARE_FX = 'MOE Stare Target';
const STARE_EXPR = [
  STARE_TAG,
  `var T = effect("${STARE_FX}")("Layer");`,
  'if (T == null || T.index == index) { value; } else {',
  // Own position (not toComp of this layer: that depends on this rotation — circular).
  '  var a = hasParent ? parent.toComp(position) : position, b = T.toComp(T.anchorPoint);',
  '  value + radiansToDegrees(Math.atan2(b[1] - a[1], b[0] - a[0]));',
  '}'
].join('\n');
const stare = {
  id: 'kit.stare', version: '1.0.0', category: 'motion', group: 'Rigs', name: 'Stare',
  description: 'Make layers always face a target layer, whatever moves. With several layers selected, the others stare at the last one; with one, pick the target in Effect Controls › MOE Stare Target. The layer\'s own Rotation is the offset (e.g. −90 for artwork that points up).',
  keywords: ['stare', 'look at', 'face', 'aim', 'point at', 'target', 'motion 4'],
  icon: 'target',
  params: {},
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.expressions', 'modify.effects'], recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Rotate layers so they always face a target layer (the last selected layer is the target).' },
  uses: { hostOps: ['effects.ensure', 'expressions.set'], network: false }, compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Stare' },
  prepare(args, ctx) {
    const l = visual(ctx);
    if (!l.length) return { ok: false, error: 'Select layers' };
    const target = l.length > 1 ? l[l.length - 1] : null;
    const starers = target ? l.slice(0, -1) : l;
    return { ok: true, target, starers, preview: { summary: target ? `${plural(starers.length, 'layer')} stare at ${target.name}` : `${starers[0].name}: pick the target in Effect Controls`, items: starers.map((x) => x.name) } };
  },
  async execute({ ctx, prepared, host }) {
    const fx = await host.call('effects.ensure', { compId: ctx.comp.id, label: 'MOE: Stare Controls', layers: prepared.starers.map((x) => ({ layer: { layerId: x.id }, items: [{ key: STARE_FX, matchName: 'ADBE Layer Control', before: [], params: [{ id: 'layer', value: prepared.target ? prepared.target.index : 0, names: ['Layer'], suffix: 1 }] }] })) });
    const set = await host.call('expressions.set', { compId: ctx.comp.id, label: 'MOE: Stare', revertOnError: true, targets: prepared.starers.map((x) => ({ address: { layerId: x.id, matchNames: ['ADBE Transform Group', 'ADBE Rotate Z'] }, expression: STARE_EXPR, enabled: true })) });
    return { fx, set, target: prepared.target ? prepared.target.name : null };
  },
  verify({ result }) {
    const checks = result.set.targets.map((t) => ({ ok: !t.skipped && !t.reverted && !t.after.expressionError, label: t.layerName || 'Layer', detail: t.skipped || (t.reverted ? `${t.after.expressionError} — reverted` : result.target ? `faces ${result.target}` : 'pick the target in Effect Controls') }));
    return { ok: checks.length > 0 && checks.every((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, fx: S.effectsCheckpoint(result.fx, ctx), expressions: result.set.targets.filter((t) => !t.skipped && !t.reverted).map((t) => ({ address: t.address, expression: t.before.expression, enabled: t.before.expressionEnabled })) }; },
  async restore({ data, host }) {
    await host.call('expressions.set', { compId: data.compId, label: 'MOE: Restore', revertOnError: false, targets: data.expressions });
    await S.restoreEffects({ data: data.fx, host });
    return { ok: true };
  },
  summarize(result) { return result.target ? `Staring at ${result.target}` : 'Stare added — pick the target'; }
};

/* ---------------- vignette ---------------- */
const vignette = {
  id: 'kit.vignette', version: '1.0.0', category: 'design', group: 'Looks', name: 'Vignette',
  description: 'Add a soft dark vignette on top of the comp: a black "MOE Vignette" solid with a big feathered elliptical cut-out. Tweak its Opacity and Mask Feather afterwards.',
  keywords: ['vignette', 'dark edges', 'corners', 'look', 'motion 4'],
  icon: 'contrast',
  params: {
    amount: { type: 'number', label: 'Amount', min: 0, max: 100, step: 1, default: 55, unit: '%' },
    softness: { type: 'number', label: 'Softness', min: 0, max: 100, step: 1, default: 45, unit: '%' },
    size: { type: 'number', label: 'Size', min: 40, max: 160, step: 1, default: 105, unit: '%' }
  },
  requires: { comp: true },
  permissions: ['modify.layers'], recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Add a soft dark vignette layer on top of the comp.' },
  uses: { hostOps: ['layers.createSolid', 'masks.ellipse', 'props.setValues', 'layers.remove'], network: false }, compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Add' },
  prepare(args, ctx) { return { ok: true, preview: { summary: `Vignette ${args.amount}% on ${ctx.comp.name}`, items: [] } }; },
  async execute({ args, ctx, host }) {
    const W = ctx.comp.width, H = ctx.comp.height;
    const solid = await host.call('layers.createSolid', { compId: ctx.comp.id, name: 'MOE Vignette', color: [0, 0, 0], label: 0 });
    try {
      const k = args.size / 100;
      const mask = await host.call('masks.ellipse', { compId: ctx.comp.id, layerId: solid.layerId, name: 'MOE Vignette Mask', mode: 'subtract', center: [W / 2, H / 2], size: [W * k, H * k], feather: Math.round(Math.min(W, H) * args.softness / 100) });
      const op = await host.call('props.setValues', { compId: ctx.comp.id, label: 'MOE: Vignette', items: [{ address: { layerId: solid.layerId, matchNames: ['ADBE Transform Group', 'ADBE Opacity'] }, value: args.amount }] });
      return { solid, mask, op, amount: args.amount };
    } catch (e) {
      await host.call('layers.remove', { compId: ctx.comp.id, layerIds: [solid.layerId] }).catch(() => {});
      throw e;
    }
  },
  verify({ result }) {
    const o = result.op && result.op.items && result.op.items[0];
    const ok = !!o && Math.abs(Number([].concat(o.after)[0]) - result.amount) < 0.01;
    return { ok, checks: [{ ok: !!result.solid.layerId, label: 'MOE Vignette', detail: `layer ${result.solid.index}` }, { ok: !!result.mask.maskIndex, label: 'Mask', detail: 'feathered ellipse cut-out' }, { ok, label: 'Opacity', detail: `${result.amount}%` }] };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, layerIds: [result.solid.layerId] }; },
  async restore({ data, host }) { return host.call('layers.remove', Object.assign({ onlyNamed: 'MOE Vignette' }, data)); },
  summarize() { return 'Vignette added'; }
};

/* ---------------- trash ---------------- */
const trash = {
  id: 'kit.trash', version: '1.0.0', category: 'tools', group: 'Layer', name: 'Trash Rigs',
  description: 'Remove what MOE tools added to the selected layers: MOE-tagged expressions (wiggle, excite, orbit, stare…) and MOE effects / controls. Your own expressions and effects are never touched.',
  keywords: ['trash', 'remove', 'clean', 'delete rig', 'clear expressions', 'motion 4'],
  icon: 'trash',
  params: {},
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.expressions', 'modify.effects'], recovery: 'undo',
  ai: { callable: true, hint: 'Remove MOE expressions and MOE effects from the selected layers.' },
  uses: { hostOps: ['rigs.remove'], network: false }, compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Trash', danger: true },
  prepare(args, ctx) {
    const l = visual(ctx);
    if (!l.length) return { ok: false, error: 'Select layers' };
    return { ok: true, layers: l, preview: { summary: `Remove MOE rigs from ${plural(l.length, 'layer')} (Edit › Undo brings them back)`, items: l.map((x) => x.name) } };
  },
  async execute({ ctx, prepared, host }) { return host.call('rigs.remove', { compId: ctx.comp.id, layers: prepared.layers.map((x) => x.id) }); },
  verify({ result }) {
    const checks = result.layers.map((l) => (l.skipped ? { ok: true, label: l.name, detail: 'locked — skipped' }
      : { ok: l.left.expressions.length === 0 && l.left.effects.length === 0, label: l.name, detail: l.expressions || l.effects.length ? `${plural(l.expressions, 'expression')}, ${plural(l.effects.length, 'effect')} removed` : 'nothing from MOE here' }));
    return { ok: checks.every((c) => c.ok), checks };
  },
  summarize(result) {
    const e = result.layers.reduce((s, l) => s + (l.expressions || 0), 0), f = result.layers.reduce((s, l) => s + ((l.effects || []).length), 0);
    return e || f ? `Removed ${plural(e, 'expression')} and ${plural(f, 'effect')}` : 'No MOE rigs on the selection';
  }
};

module.exports = { interp, trimToKeys, parent, stare, vignette, trash, STARE_EXPR };
