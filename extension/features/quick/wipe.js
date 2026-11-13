'use strict';
/**
 * Wipe Reveal (v0.63, docs/features/WIPE_CAROUSEL.md): a layer revealed (or hidden) by After Effects' own Linear Wipe —
 * one effect named "MOE Wipe", Wipe Angle and Feather set by their English names, Transition Completion keyed
 * 100 → 0 (in) or 0 → 100 (out) on the comp's frame grid, with Quick Animate's eases, Stagger and screen Order.
 *
 * Angles: After Effects' Linear Wipe travels from left to right at 90° (the reference manual); a reveal runs the
 * transition backwards, so the layer appears in the direction the wipe travels. The Self-Test measures it.
 */
const PLAN = require('./animatePlan');
const S = require('../compositing/shared');
const { plan: PLAN1 } = require('../../core/host/plan'); // v0.94 one Ctrl+Z per run
const FG = require('../../core/framegrid');

const FROM = {
  left: { label: 'From the left', angle: 90 },
  right: { label: 'From the right', angle: 270 },
  top: { label: 'From the top', angle: 180 },
  bottom: { label: 'From the bottom', angle: 0 },
  topLeft: { label: 'Diagonal ↘', angle: 135 },
  bottomLeft: { label: 'Diagonal ↗', angle: 45 }
};
const FX = 'MOE Wipe';
const ADDR = (id, p) => ({ layerId: id, matchNames: ['ADBE Effect Parade', `name:${FX}`, `name:${p}`] });

/** The keys of Transition Completion, from t = 0. */
function plan(args) {
  const e = PLAN.easePair(args.ease || 'smooth');
  const dur = args.duration > 0 ? args.duration : 0.8;
  return args.dir === 'out' ? PLAN.keysFor(e, 0, dur, 0, 100) : PLAN.keysFor(e, 0, dur, 100, 0);
}

const EASES = Object.entries(require('../zoom/math').EASES).map(([value, x]) => ({ value, label: x.label })).concat([{ value: 'linear', label: 'Linear' }]);

const wipe = {
  id: 'quick.wipe', version: '1.0.0', category: 'motion', group: 'Quick · Animate', name: 'Wipe Reveal',
  description: 'Reveal or hide the selected layers with a soft-edged wipe (After Effects\' Linear Wipe): from any side or a diagonal, eased, staggered in the order they sit on screen. One "MOE Wipe" effect per layer, removed by Restore.',
  keywords: ['wipe', 'reveal', 'linear wipe', 'wipe in', 'wipe out', 'transition', 'mask reveal', 'مسح', 'كشف'],
  icon: 'moveLR',
  params: {
    dir: { type: 'enum', label: 'Direction', tileFixed: true, default: 'in', options: [{ value: 'in', label: 'Reveal (in)' }, { value: 'out', label: 'Hide (out)' }] },
    from: { type: 'enum', label: 'From', default: 'left', options: Object.entries(FROM).map(([value, f]) => ({ value, label: f.label })) },
    duration: { type: 'number', label: 'Duration', min: 0.05, max: 10, step: 0.05, default: 0.8, unit: 's' },
    feather: { type: 'number', label: 'Soft edge', min: 0, max: 500, step: 1, default: 60, unit: 'px' },
    ease: { type: 'enum', label: 'Ease', default: 'smooth', options: EASES },
    stagger: { type: 'number', label: 'Stagger', min: 0, max: 2, step: 0.01, default: 0, unit: 's', advanced: true },
    order: { type: 'enum', label: 'Order', default: 'screen', advanced: true, options: [{ value: 'selection', label: 'Selection order' }, { value: 'screen', label: 'Screen ↘' }, { value: 'screenRtl', label: 'Screen ↙' }, { value: 'center', label: 'From the centre out' }], showIf: (a) => a.stagger > 0 }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.effects', 'modify.keyframes'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Wipe reveal/hide the selected layers: from left/right/top/bottom/topLeft/bottomLeft, feather px, stagger by screen order.' },
  uses: { hostOps: ['layers.bounds', 'effects.ensure', 'effects.restore', 'keys.write', 'keys.remove'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Wipe' },
  prepare(args, ctx) {
    if (!FROM[args.from]) return { ok: false, error: `Unknown direction ${args.from}` };
    const l = (ctx.layers || []).filter((x) => !['camera', 'light', 'null', 'audio'].includes(x.type));
    if (!l.length) return { ok: false, error: 'Select visual layers to wipe' };
    return { ok: true, layers: l, preview: { summary: `${args.dir === 'out' ? 'Wipe out' : 'Wipe in'} ${FROM[args.from].label.toLowerCase()} · ${args.duration}s · ${l.length} layer(s)`, items: [] } };
  },
  async execute({ args, ctx, prepared, host }) {
    const comp = ctx.comp, fd = comp.frameDuration || 1 / 25, ids = prepared.layers.map((l) => l.id);
    const byScreen = args.stagger > 0 && args.order && args.order !== 'selection' && ids.length > 1;
    let rank = ids.map((_, i) => i);
    if (byScreen) {
      const m = await host.call('layers.bounds', { compId: comp.id, layerIds: ids, times: [comp.time] });
      rank = PLAN.screenOrder(ids.map((id) => { const b = m.layers.find((x) => x.layerId === id); return b && b.boxes[0] ? b.boxes[0] : [0, 0, 0, 0]; }), args.order);
    }
    // v0.94 (docs/features/ONE_UNDO.md): the wipe effects and their keys in ONE host call — one Ctrl+Z
    const P = PLAN1(host, `MOE: ${FX}`);
    const fxRef = P.add('effects.ensure', { compId: ctx.comp.id, label: `MOE: ${FX}`, layers: ids.map((id) => ({ layer: { layerId: id }, items: [{ key: FX, matchName: 'ADBE Linear Wipe', before: [], params: [
      { id: 'Wipe Angle', value: FROM[args.from].angle, names: ['Wipe Angle'] },
      { id: 'Feather', value: args.feather, names: ['Feather'] }
    ] }] })) });
    const pl = plan(args);
    const items = ids.map((id, i) => {
      const t0 = FG.snap(comp.time + rank[i] * (args.stagger || 0), fd);
      return { address: ADDR(id, 'Transition Completion'), keys: pl.map((k) => Object.assign({}, k, { t: k.t + t0 })) };
    });
    const keysRef = P.add('keys.write', { compId: comp.id, label: `MOE: ${FX}`, items });
    await P.commit();
    const fx = fxRef.value(), keys = keysRef.value();
    return { fx, req: ids, keys, order: byScreen ? prepared.layers.map((l, i) => ({ n: l.name, r: rank[i] })).sort((a, b) => a.r - b.r).map((x) => x.n) : null };
  },
  verify({ result }) {
    const c = result.keys.items.map((it) => ({ ok: it.written.length >= 2 && it.written[0].value !== it.written[it.written.length - 1].value, label: `${it.layerName} › ${FX}`, detail: `Transition Completion ${it.written[0].value} → ${it.written[it.written.length - 1].value}, ${it.written[0].t.toFixed(2)}–${it.written[it.written.length - 1].t.toFixed(2)} s` }));
    for (const L of result.fx.layers) for (const it of L.items) for (const p of it.params) if (p.resolvedBy !== 'name') c.push({ ok: false, label: `${FX} › ${p.id}`, detail: 'parameter not found by its name' });
    if (result.order) c.push({ ok: true, label: 'Screen order', detail: result.order.join(' → ') });
    return { ok: c.every((x) => x.ok), checks: c };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, items: result.keys.items.map((it) => ({ address: it.address, times: it.written.map((w) => w.t), restore: it.replaced })), fx: S.effectsCheckpoint(result.fx, ctx) }; },
  async restore({ data, host }) {
    try { await host.call('keys.remove', { compId: data.compId, items: data.items }); } catch (e) { /* the effect may be gone */ }
    return S.restoreEffects({ data: data.fx, host });
  },
  summarize(result) { return `${FX} on ${result.keys.items.length} layer(s)`; }
};

module.exports = { FROM, FX, plan, wipe };
