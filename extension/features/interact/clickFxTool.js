'use strict';
/**
 * Click VFX (v0.98, docs/features/CLICK_VFX.md): a premium click effect at the visual centre of the selected layer (or
 * the comp's centre), at the playhead — Liquid Ripple, Neon Ring, Particle Burst, Pixel Ring — built from the plan in
 * clickFxPlan.js with native effects. ONE host call (one Ctrl+Z): the shape layers "MOE Click N <part>", their effects
 * and keys, and the controller null "MOE Click N Controls" with only the look-and-feel values (Size %, Colour, Glow, and
 * Wobble or Pixel Blocks when the style has them), linked by `// MOE Click` expressions through expressions.set.
 */
const CP = require('./clickFxPlan');
const FG = require('../../core/framegrid');
const { plan: PLAN1 } = require('../../core/host/plan');

const PREFIX = 'MOE Click';
const TR = (id, mn) => ({ layerId: id, matchNames: ['ADBE Transform Group', mn] });
const FXA = (id, fx, param) => ({ layerId: id, matchNames: ['ADBE Effect Parade', `name:${fx}`, `name:${param}`] });
const STROKE = (id, group) => ({ layerId: id, matchNames: ['ADBE Root Vectors Group', `name:${group}`, 'ADBE Vectors Group', 'ADBE Vector Graphic - Stroke', 'ADBE Vector Stroke Width'] });
const v = (id, value) => ({ id, value, names: [id] });

const clickFx = {
  id: 'interact.clickFx', version: '1.0.0', category: 'motion', group: 'SaaS · Interaction', name: 'Click VFX',
  description: 'A premium click effect at the centre of the selected layer, at the playhead: Liquid Ripple, Neon Ring, Particle Burst or Pixel Ring — a stack of native effects (ring, distortion, glow, colour) with one controller null for Size, Colour and Glow. One Ctrl+Z.',
  keywords: ['click', 'click effect', 'ripple', 'tap', 'button', 'neon ring', 'burst', 'particles', 'pixel', 'saas', 'ui', 'كليك', 'ضغطة', 'ريبل'],
  icon: 'cursor',
  params: {
    style: { type: 'enum', label: 'Style', tileFixed: true, default: 'ripple', options: Object.entries(CP.STYLES).map(([value, s]) => ({ value, label: s.label })) },
    size: { type: 'number', label: 'Size', min: 20, max: 1500, step: 1, default: 160, unit: 'px', description: 'The ring\'s radius at its widest' },
    color: { type: 'string', label: 'Colour (#hex)', maxLength: 7, format: 'color', description: 'Empty = the style\'s own' },
    duration: { type: 'number', label: 'Duration', min: 0.2, max: 4, step: 0.05, unit: 's', description: 'Empty = the style\'s own' },
    glow: { type: 'number', label: 'Glow radius', min: 1, max: 300, step: 1, default: 30, unit: 'px', advanced: true }
  },
  requires: { comp: true },
  permissions: ['modify.layers', 'modify.keyframes', 'modify.effects', 'modify.expressions'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'A click effect at the selected layer\'s centre at the playhead. style: ripple|neon|burst|pixel; size px; color #hex.' },
  uses: { hostOps: ['layers.bounds', 'shapes.insert', 'effects.ensure', 'keys.write', 'layers.createNull', 'expressions.set', 'layers.move', 'props.values', 'layers.remove', 'tx.run'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Add click' },
  prepare(args, ctx) {
    if (!CP.STYLES[args.style]) return { ok: false, error: `Unknown style ${args.style}` };
    const target = (ctx.layers || []).find((x) => !['camera', 'light', 'audio'].includes(x.type)) || null;
    const S = CP.STYLES[args.style];
    return { ok: true, target, preview: { summary: `${S.label} at ${target ? `the centre of ${target.name}` : 'the comp\'s centre'} · at the playhead`, items: [] } };
  },
  explain(args, ctx, prepared) {
    if (!prepared) return {};
    const p = CP.build(args);
    return {
      target: prepared.target ? `the visual centre of ${prepared.target.name}, measured by After Effects at the playhead` : 'the comp\'s centre',
      writes: [`${p.layers.length} shape layer(s) "${PREFIX} N …" with ${[...new Set([].concat(...p.layers.map((l) => l.effects.map((e) => e.matchName.replace('ADBE ', '')))))].join(', ')}`, `"${PREFIX} N Controls": ${p.controls.map((c) => c.key).join(' · ')} — linked by expressions`]
    };
  },
  async execute({ args, ctx, prepared, host }) {
    const comp = ctx.comp, fd = comp.frameDuration || 1 / 25, t0 = FG.snap(comp.time, fd);
    let C = [comp.width / 2, comp.height / 2];
    if (prepared.target) {
      const m = await host.call('layers.bounds', { compId: comp.id, layerIds: [prepared.target.id], times: [t0] });
      const b = m.layers[0] && m.layers[0].boxes[0];
      if (b) C = [Math.round((b[0] + b[2]) / 2 * 100) / 100, Math.round((b[1] + b[3]) / 2 * 100) / 100];
    }
    const p = CP.build(args);
    const used = new Set((ctx.compLayers || []).map((l) => l.name));
    let n = 1; while ([...used].some((x) => x.indexOf(`${PREFIX} ${n} `) === 0)) n++;
    const name = `${PREFIX} ${n}`;
    const at = (keys) => keys.map((k) => Object.assign({}, k, { t: Math.round((k.t + t0) * 1e6) / 1e6 }));
    const T = PLAN1(host, `MOE: ${p.label}`);
    const made = p.layers.map((L) => {
      const lay = T.add('shapes.insert', { compId: comp.id, name: `${name} ${L.role}`, label: 9, groupName: L.role, primitive: L.primitive, stroke: L.stroke, fill: L.fill, position: C, inPoint: t0, outPoint: t0 + p.end + 0.05 });
      const id = lay.at('layerId');
      const fx = T.add('effects.ensure', { compId: comp.id, label: `MOE: ${p.label}`, layers: [{ layer: { layerId: id }, items: L.effects.map((e) => ({ key: e.key, matchName: e.matchName, before: [], params: e.params.map((q) => v(q.id, q.value)) })) }] });
      const items = [{ address: TR(id, 'ADBE Scale'), keys: at(L.keys.scale) }, { address: TR(id, 'ADBE Opacity'), keys: at(L.keys.opacity) }];
      if (L.keys.strokeWidth) items.push({ address: STROKE(id, L.role), keys: at(L.keys.strokeWidth) });
      if (L.keys.scatter) items.push({ address: FXA(id, 'MOE Click Burst', 'Scatter'), keys: at(L.keys.scatter) });
      const keys = T.add('keys.write', { compId: comp.id, label: `MOE: ${p.label}`, items });
      if (prepared.target) T.add('layers.move', { compId: comp.id, items: [{ layerId: id, before: prepared.target.id }] });
      return { L, lay, fx, keys };
    });
    // the controller: only the look-and-feel values, linked by expressions (same comp → thisComp, link ids by the host)
    const ctlName = `${name} Controls`;
    const ctl = T.add('layers.createNull', { compId: comp.id, name: ctlName, position: C, label: 9 });
    T.add('effects.ensure', { compId: comp.id, label: `MOE: ${p.label} Controls`, layers: [{ layer: { layerId: ctl.at('layerId') }, items: p.controls.map((c) => (c.color
      ? { key: c.key, matchName: 'ADBE Color Control', before: [], params: [{ id: 'Color', value: c.value, names: ['Color'] }] }
      : { key: c.key, matchName: 'ADBE Slider Control', before: [], params: [{ id: 'Slider', value: c.value, names: ['Slider'] }] })) }] });
    const src = (c) => `thisComp.layer(${JSON.stringify(ctlName)}).effect(${JSON.stringify(c.key)})(${c.color ? '"Color"' : '"Slider"'})`;
    const targets = [];
    for (const m of made) {
      const id = m.lay.at('layerId');
      for (const c of p.controls) {
        const has = c.link.prop || m.L.effects.some((e) => e.key === c.link.fx);
        if (!has) continue;
        const address = c.link.prop ? TR(id, c.link.prop) : FXA(id, c.link.fx, c.link.param);
        targets.push({ address, expression: `// MOE Click\n${c.link.expr ? c.link.expr.replace('$', src(c)) : src(c)}`, enabled: true });
        if (c.key === 'Pixel Blocks') targets.push({ address: FXA(id, c.link.fx, 'Vertical Blocks'), expression: `// MOE Click\nMath.max(1, Math.round(${src(c)} * 27 / 48))`, enabled: true });
      }
    }
    const set = T.add('expressions.set', { compId: comp.id, label: `MOE: ${p.label} Controls`, revertOnError: true, targets });
    try {
      await T.commit();
    } catch (e) {
      const ids = made.map((m) => m.lay.value()).concat([ctl.value()]).filter((x) => x && x.layerId).map((x) => x.layerId);
      if (ids.length) await host.call('layers.remove', { compId: comp.id, layerIds: ids, onlyNamed: PREFIX }).catch(() => {});
      throw e;
    }
    // read back (changes nothing): where After Effects has each layer at the click
    const ids = made.map((m) => m.lay.value().layerId);
    const pos = (await host.call('props.values', { compId: comp.id, items: ids.map((id) => ({ address: TR(id, 'ADBE Position'), time: t0 })) })).items.map((r) => r.value);
    return {
      style: p.style, label: p.label, name, at: C, t0, controlsId: ctl.value().layerId, controls: p.controls.map((c) => c.key),
      layers: made.map((m, i) => ({ id: ids[i], name: m.lay.value().name, pos: pos[i], keys: m.keys.value(), unmapped: m.fx.value().layers.flatMap((x) => x.items.flatMap((it) => it.params.filter((q) => q.resolvedBy !== 'name').map((q) => `${it.key}.${q.id}`))) })),
      links: set.value().targets.map((t) => ({ name: t.name, ok: !t.skipped && !t.reverted && !(t.after && t.after.expressionError), why: t.skipped || (t.after && t.after.expressionError) || '' }))
    };
  },
  verify({ result }) {
    const c = [];
    for (const L of result.layers) {
      const off = L.pos ? Math.hypot(L.pos[0] - result.at[0], L.pos[1] - result.at[1]) : Infinity;
      c.push({ ok: off < 0.6, label: L.name, detail: `at ${result.at.map((x) => x.toFixed(1)).join(', ')} (read back ${off < 0.6 ? 'on the point' : `${off.toFixed(1)} px off`}), ${L.keys.items.length} keyed propert(ies) from ${result.t0.toFixed(2)} s` });
      if (L.unmapped.length) c.push({ ok: false, label: `${L.name} › effects`, detail: `not found by name: ${L.unmapped.join(', ')}` });
    }
    const bad = result.links.filter((x) => !x.ok);
    c.push({ ok: !bad.length && result.links.length > 0, label: `${result.name} Controls`, detail: bad.length ? `${bad.length} link(s) failed: ${bad.slice(0, 3).map((x) => `${x.name}: ${x.why}`).join('; ')}` : `${result.controls.join(' · ')} — ${result.links.length} expression link(s), no engine errors` });
    return { ok: c.every((x) => x.ok), checks: c };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, layerIds: result.layers.map((L) => L.id).concat([result.controlsId]) }; },
  async restore({ data, host }) {
    const T = PLAN1(host, 'MOE: Restore Click VFX');
    T.add('layers.remove', { compId: data.compId, layerIds: data.layerIds, onlyNamed: PREFIX });
    await T.commit();
    return { ok: true };
  },
  summarize(result) { return `${result.label} at ${result.at.map((x) => Math.round(x)).join(', ')}`; }
};

module.exports = { clickFx, PREFIX };
