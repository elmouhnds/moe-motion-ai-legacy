'use strict';
/**
 * Depth Reveal (v0.64, docs/features/WAVE4.md): layers come in from the depth of the scene — native 3D, no plugin,
 * no download (SaaS Kit's Depth Reveal fetches a model; this does not). Each layer is made 3D (recorded; Restore makes
 * it 2D again) and its own Position is keyed from Z + Depth to where it is, read on the frame of its start, with
 * Quick Animate's fade and MOE Blur on the same timing, staggered in the order the layers sit on screen.
 * Further away = +Z in After Effects (the default camera looks along +Z), so the layer grows into place.
 */
const PLAN = require('./animatePlan');
const S = require('../compositing/shared');
const FG = require('../../core/framegrid');
const ADDR = (id, mn) => ({ layerId: id, matchNames: ['ADBE Transform Group', mn] });
const EASES = Object.entries(require('../zoom/math').EASES).map(([value, x]) => ({ value, label: x.label })).concat([{ value: 'linear', label: 'Linear' }]);

/** Z offset keys from t = 0 (in: depth → 0, out: 0 → depth). */
function plan(args) {
  const e = PLAN.easePair(args.ease || 'smooth'), dur = args.duration > 0 ? args.duration : 0.9, d = Number(args.depth) || 0;
  return args.dir === 'out' ? PLAN.keysFor(e, 0, dur, 0, d) : PLAN.keysFor(e, 0, dur, d, 0);
}

const depth = {
  id: 'quick.depth', version: '1.0.0', category: 'motion', group: 'Quick · Animate', name: 'Depth Reveal',
  description: 'The selected layers come in from the depth of the scene (or leave into it): made 3D, keyed along Z from their own position, with a fade and a blur on the same timing, in the order they sit on screen. No plugin, nothing downloaded.',
  keywords: ['depth', 'reveal', '3d', 'z', 'fly in', 'from behind', 'push in', 'parallax', 'عمق', 'كشف'],
  icon: 'layers',
  params: {
    dir: { type: 'enum', label: 'Direction', tileFixed: true, default: 'in', options: [{ value: 'in', label: 'Come forward (in)' }, { value: 'out', label: 'Fall back (out)' }] },
    depth: { type: 'number', label: 'Depth', min: 50, max: 10000, step: 10, default: 900, unit: 'px', description: 'How far back the layer starts (Z)' },
    duration: { type: 'number', label: 'Duration', min: 0.05, max: 10, step: 0.05, default: 0.9, unit: 's' },
    ease: { type: 'enum', label: 'Ease', default: 'smooth', options: EASES },
    fade: { type: 'boolean', label: 'Also fade', default: true },
    blur: { type: 'number', label: 'Blur', min: 0, max: 200, step: 1, default: 14, unit: 'px', description: '0 = none (MOE Blur on the same timing)' },
    stagger: { type: 'number', label: 'Stagger', min: 0, max: 2, step: 0.01, default: 0.06, unit: 's' },
    order: { type: 'enum', label: 'Order', default: 'screen', advanced: true, options: [{ value: 'selection', label: 'Selection order' }, { value: 'screen', label: 'Screen ↘' }, { value: 'screenRtl', label: 'Screen ↙' }, { value: 'center', label: 'From the centre out' }], showIf: (a) => a.stagger > 0 }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers', 'modify.keyframes', 'modify.effects'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Reveal the selected layers from depth (Z px), with fade and blur, staggered by screen order.' },
  uses: { hostOps: ['layers.describe', 'layers.bounds', 'layers.setAttrs', 'props.values', 'effects.ensure', 'effects.restore', 'keys.write', 'keys.remove'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Reveal' },
  prepare(args, ctx) {
    const l = (ctx.layers || []).filter((x) => !['camera', 'light', 'null', 'audio'].includes(x.type));
    if (!l.length) return { ok: false, error: 'Select visual layers' };
    return { ok: true, layers: l, preview: { summary: `Depth ${args.dir === 'out' ? 'out' : 'in'} · ${args.depth}px · ${args.duration}s · ${l.length} layer(s)`, items: [] } };
  },
  async execute({ args, ctx, prepared, host }) {
    const comp = ctx.comp, fd = comp.frameDuration || 1 / 25, ids = prepared.layers.map((l) => l.id);
    const desc = await host.call('layers.describe', { compId: comp.id });
    const D = (id) => desc.layers.find((x) => x.id === id) || {};
    const skipped = ids.filter((id) => D(id).posExpr).map((id) => `${D(id).name} (Position has an expression)`);
    const use = prepared.layers.filter((l) => !D(l.id).posExpr);
    if (!use.length) throw new Error(`Nothing to reveal: ${skipped.join(', ')}`);
    const uids = use.map((l) => l.id);
    let rank = uids.map((_, i) => i);
    if (args.stagger > 0 && args.order !== 'selection' && uids.length > 1) {
      const m = await host.call('layers.bounds', { compId: comp.id, layerIds: uids, times: [comp.time] });
      rank = PLAN.screenOrder(uids.map((id) => { const b = m.layers.find((x) => x.layerId === id); return b && b.boxes[0] ? b.boxes[0] : [0, 0, 0, 0]; }), args.order);
    }
    const flat = use.filter((l) => !D(l.id).threeD);
    const made3D = flat.length ? await host.call('layers.setAttrs', { compId: comp.id, label: 'MOE: Depth Reveal', items: flat.map((l) => ({ layerId: l.id, threeDLayer: true })) }) : null;
    const t0s = uids.map((_, i) => FG.snap(comp.time + rank[i] * (args.stagger || 0), fd));
    // own values at each layer's start frame, in ONE read: Position (or Z Position when separated) and Opacity
    const sep = (id) => !D(id).transform || !D(id).transform.position;
    const reads = [];
    uids.forEach((id, i) => { reads.push({ address: ADDR(id, sep(id) ? 'ADBE Position_2' : 'ADBE Position'), time: t0s[i] }, { address: ADDR(id, 'ADBE Opacity'), time: t0s[i] }); });
    const vals = (await host.call('props.values', { compId: comp.id, items: reads })).items.map((r) => r.value);
    const z = plan(args), items = [];
    uids.forEach((id, i) => {
      const own = vals[2 * i], op = vals[2 * i + 1], t0 = t0s[i];
      const at = (k) => Object.assign({}, k, { t: k.t + t0 });
      if (sep(id)) items.push({ address: ADDR(id, 'ADBE Position_2'), keys: z.map((k) => at(Object.assign({}, k, { v: own + k.v }))) });
      else { const p = own.length > 2 ? own : own.concat([0]); items.push({ address: ADDR(id, 'ADBE Position'), keys: z.map((k) => at(Object.assign({}, k, { v: [p[0], p[1], p[2] + k.v] }))), spatialLinear: true }); }
      if (args.fade) { const f = PLAN.fade(Object.assign({ kind: 'move', fade: true }, args), { opacity: op }); if (f) items.push({ address: ADDR(id, 'ADBE Opacity'), keys: f.keys.map(at) }); }
    });
    let fx = null;
    const bl = PLAN.blur(args);
    if (bl) {
      fx = await S.writeEffects(host, ctx, uids.map((id) => ({ layer: { layerId: id }, items: [{ key: 'MOE Blur', matchName: 'ADBE Gaussian Blur 2', before: [], params: [{ id: 'Repeat Edge Pixels', value: 1, names: ['Repeat Edge Pixels'] }] }] })), 'MOE: Blur');
      uids.forEach((id, i) => items.push({ address: { layerId: id, matchNames: ['ADBE Effect Parade', 'name:MOE Blur', 'name:Blurriness'] }, keys: bl.keys.map((k) => Object.assign({}, k, { t: k.t + t0s[i] })) }));
    }
    const keys = await host.call('keys.write', { compId: comp.id, label: 'MOE: Depth Reveal', items });
    return { keys, fx, made3D, skipped, n: uids.length };
  },
  verify({ result }) {
    const c = result.keys.items.map((it) => ({ ok: it.written.length >= 2, label: `${it.layerName} › ${it.name}`, detail: `${it.written.length} keys ${it.written[0].t.toFixed(2)}–${it.written[it.written.length - 1].t.toFixed(2)} s` }));
    if (result.made3D) c.push({ ok: true, label: '3D', detail: `${result.made3D.layers.length} layer(s) made 3D — Restore makes them 2D again` });
    for (const s of result.skipped) c.push({ ok: true, label: 'Skipped', detail: s });
    return { ok: c.every((x) => x.ok), checks: c };
  },
  checkpoint({ result, ctx }) {
    return { compId: ctx.comp.id, items: result.keys.items.map((it) => ({ address: it.address, times: it.written.map((w) => w.t), restore: it.replaced })), fx: result.fx ? S.effectsCheckpoint(result.fx, ctx) : null, flat: result.made3D ? result.made3D.layers.map((x) => x.layerId) : [] };
  },
  async restore({ data, host }) {
    await host.call('keys.remove', { compId: data.compId, items: data.items });
    if (data.fx) await S.restoreEffects({ data: data.fx, host });
    if (data.flat.length) await host.call('layers.setAttrs', { compId: data.compId, label: 'MOE: Restore', items: data.flat.map((id) => ({ layerId: id, threeDLayer: false })) });
    return { ok: true };
  },
  summarize(result) { return `Depth Reveal on ${result.n} layer(s)`; }
};

module.exports = { plan, depth };
