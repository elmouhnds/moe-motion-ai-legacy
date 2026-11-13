'use strict';
/**
 * Styles (v0.59, docs/features/STYLES_SHAKES.md): a finished look on any layer from After Effects' OWN effects —
 * Soft Shadow, Deep Shadow, Glow, Light Sweep. Each is one effect named `MOE Style • <name>`, updated in place (never
 * duplicated), every parameter resolved by its English name and read back; Restore removes what this run added and
 * puts back what it changed. Light Sweep's centre is a tagged expression (`// MOE Style`) that reads the layer's own
 * box (sourceRectAtTime), so it crosses any layer of any size, once every `every` seconds from the playhead.
 */
const S = require('../compositing/shared');
const { plan: PLAN1 } = require('../../core/host/plan'); // v0.94 one Ctrl+Z per run

const STYLES = {
  softShadow: { label: 'Soft Shadow', hint: 'A soft, lifted shadow — the card floats a little', matchName: 'ADBE Drop Shadow', params: (a) => [['Distance', 14 * a.amount], ['Softness', 50 * a.amount], ['Direction', 180]] },
  deepShadow: { label: 'Deep Shadow', hint: 'A long, very soft shadow — the card floats high', matchName: 'ADBE Drop Shadow', params: (a) => [['Distance', 40 * a.amount], ['Softness', 120 * a.amount], ['Direction', 180]] },
  glow: { label: 'Glow', hint: 'A soft halo around the bright parts', matchName: 'ADBE Glo2', params: (a) => [['Glow Radius', 60 * a.amount], ['Glow Intensity', 1.2]] },
  lightSweep: { label: 'Light Sweep', hint: 'A highlight that crosses the layer, every few seconds', matchName: 'CC Light Sweep', params: (a) => [['Width', 60 * a.amount], ['Sweep Intensity', 55]] }
};
const nameOf = (id) => `MOE Style • ${STYLES[id].label}`;

/** The Light Sweep centre: crosses the layer's box (smoothstep) from the playhead, once every `every` s. */
function sweepCode(t0, dur, every) {
  return ['// MOE Style', 'var r = sourceRectAtTime(time, false);',
    `var t0 = ${t0.toFixed(3)}, dur = ${dur.toFixed(3)}, every = ${every.toFixed(3)};`,
    'var u = time < t0 ? -1 : ((time - t0) % every) / dur;',
    'var x = (u < 0 || u > 1) ? r.left - r.width : r.left - r.width * 0.3 + r.width * 1.6 * (u * u * (3 - 2 * u));',
    '[x, r.top + r.height / 2]'].join('\n');
}

const style = {
  id: 'design.style', version: '1.0.0', category: 'design', group: 'Design · Styles', name: 'Style',
  description: 'A finished look from After Effects\' own effects: Soft Shadow, Deep Shadow, Glow or a Light Sweep that crosses the layer every few seconds. One named effect per style, updated in place, removed by Restore.',
  keywords: ['style', 'shadow', 'drop shadow', 'soft shadow', 'glow', 'light sweep', 'shine', 'highlight', 'ظل', 'توهج', 'لمعة'],
  icon: 'sparkles',
  params: {
    style: { type: 'enum', label: 'Style', tileFixed: true, default: 'softShadow', options: Object.keys(STYLES).map((k) => ({ value: k, label: STYLES[k].label })) },
    amount: { type: 'number', label: 'Amount', min: 0.2, max: 3, step: 0.05, default: 1, unit: '×', description: 'Bigger and softer above 1, tighter below' },
    every: { type: 'number', label: 'Every', min: 1, max: 20, step: 0.5, default: 3, unit: 's', showIf: (a) => a.style === 'lightSweep', description: 'The sweep crosses once every … seconds' }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.effects', 'modify.expressions'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Add a style to the selected layers: softShadow, deepShadow, glow, lightSweep (amount 0.2–3).' },
  uses: { hostOps: ['effects.ensure', 'effects.restore', 'expressions.set'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Add Style' },
  prepare(args, ctx) {
    const st = STYLES[args.style];
    if (!st) return { ok: false, error: `Unknown style ${args.style}` };
    const l = (ctx.layers || []).filter((x) => !x.locked && !['camera', 'light', 'null', 'audio'].includes(x.type));
    if (!l.length) return { ok: false, error: 'Select unlocked visual layers' };
    return { ok: true, layers: l, preview: { summary: `${st.label} on ${l.length} layer(s)`, items: [] } };
  },
  async execute({ args, ctx, prepared, host }) {
    const st = STYLES[args.style], key = nameOf(args.style);
    const req = prepared.layers.map((l) => ({ layer: { layerId: l.id }, items: [{ key, matchName: st.matchName, before: [], params: st.params(args).map(([id, value]) => ({ id, value: Math.round(value * 100) / 100, names: [id] })) }] }));
    // v0.94 (docs/features/ONE_UNDO.md): the effect and its expression in ONE host call — one Ctrl+Z
    const P = PLAN1(host, `MOE: ${st.label}`);
    const fxRef = P.add('effects.ensure', { compId: ctx.comp.id, label: `MOE: ${st.label}`, layers: req });
    let setRef = null;
    if (args.style === 'lightSweep') {
      const code = sweepCode(ctx.comp.time, 1.2, Number(args.every) || 3);
      setRef = P.add('expressions.set', { compId: ctx.comp.id, label: 'MOE: Light Sweep', revertOnError: true, targets: prepared.layers.map((l) => ({ address: { layerId: l.id, matchNames: ['ADBE Effect Parade', `name:${key}`, 'name:Center'] }, expression: code, enabled: true })) });
    }
    await P.commit();
    const fx = fxRef.value(), set = setRef ? setRef.value() : null;
    return { fx, req, set, style: args.style };
  },
  verify({ result }) {
    const v = S.verifyEffects(result.fx, result.req);
    if (result.set) for (const t of result.set.targets) v.checks.push({ ok: !t.error && /MOE Style/.test(t.after.expression || ''), label: `${t.layerName || 'Layer'} › Light Sweep centre`, detail: t.error || 'expression set (// MOE Style)' });
    return { ok: v.checks.every((c) => c.ok), checks: v.checks };
  },
  checkpoint({ result, ctx }) {
    return { compId: ctx.comp.id, fx: S.effectsCheckpoint(result.fx, ctx), expressions: result.set ? result.set.targets.map((t) => ({ address: t.address, expression: t.before.expression, enabled: t.before.expressionEnabled })) : [] };
  },
  async restore({ data, host }) {
    if (data.expressions.length) { try { await host.call('expressions.set', { compId: data.compId, label: 'MOE: Restore', revertOnError: false, targets: data.expressions }); } catch (e) { /* the effect may already be gone */ } }
    return S.restoreEffects({ data: data.fx, host });
  },
  summarize(result) { return `${STYLES[result.style].label} on ${result.fx.layers.length} layer(s)`; }
};

module.exports = { STYLES, nameOf, sweepCode, style };
