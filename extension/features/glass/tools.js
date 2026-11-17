'use strict';
/**
 * Glass (Glasser-style liquid / frosted glass from native effects only).
 * For each selected shape / text / footage / pre-comp layer:
 *   MOE Glass N          adjustment layer, track-matted to the source (alpha):
 *                        Gaussian Blur (frost) → Optics Compensation (lens / refraction,
 *                        centred on the source by expression) → Brightness
 *   MOE Glass N Tint     linked copy · Fill tint colour · opacity = tint amount
 *   MOE Glass N Rim      linked copy · 50 % grey Fill + Bevel Alpha · Overlay → lit / shaded edges
 *   MOE Glass N Shadow   linked copy below · black Fill + blur · offset by light angle
 * Linked copies are parented to the source with an identity transform, so moving,
 * scaling or rotating the source moves the whole glass (no control null needed).
 * Every amount lives as a control on "MOE Glass N" (Effect Controls) and is animatable.
 *
 * v0.99.7 — the holder here is "MOE Glass N" itself, and parenting the copies TO THE SOURCE is correct for this
 * tool, not the pattern to replace: each copy is a duplicate of the source and has to stay exactly on it. What was
 * wrong is that Effect Controls carried all eleven sliders on every run, including the ones for parts that were
 * switched off. See core/holder.js for when a run wants a holder of its own instead.
 */
const { hexToRgb } = require('../brand/brands');
const HOLDER = require('../../core/holder'); // v0.99.7 controls on demand
const { plan: PLAN1 } = require('../../core/host/plan'); // v0.94 one Ctrl+Z per run

const LOOKS = {
  clear: { label: 'Clear', frost: 2, refraction: 35, brightness: 8, tint: '#FFFFFF', tintAmount: 6, rim: 70, rimWidth: 3, angle: -45, shadow: 25, softness: 30, distance: 12 },
  frosted: { label: 'Frosted', frost: 22, refraction: 15, brightness: 12, tint: '#FFFFFF', tintAmount: 14, rim: 55, rimWidth: 3, angle: -45, shadow: 30, softness: 40, distance: 16 },
  liquid: { label: 'Liquid', frost: 4, refraction: 60, brightness: 10, tint: '#DDEBFF', tintAmount: 8, rim: 90, rimWidth: 4, angle: -60, shadow: 30, softness: 36, distance: 18 },
  tinted: { label: 'Tinted', frost: 10, refraction: 30, brightness: 4, tint: '#3A7BFF', tintAmount: 30, rim: 60, rimWidth: 3, angle: -45, shadow: 30, softness: 36, distance: 14 },
  smoke: { label: 'Smoke', frost: 14, refraction: 25, brightness: -18, tint: '#10131A', tintAmount: 35, rim: 45, rimWidth: 2, angle: -45, shadow: 40, softness: 40, distance: 16 },
  crystal: { label: 'Crystal', frost: 0, refraction: 80, brightness: 14, tint: '#FFFFFF', tintAmount: 0, rim: 100, rimWidth: 6, angle: -30, shadow: 20, softness: 28, distance: 10 },
  ice: { label: 'Ice', frost: 30, refraction: 20, brightness: 18, tint: '#CFEFFF', tintAmount: 20, rim: 65, rimWidth: 3, angle: -50, shadow: 25, softness: 40, distance: 14 }
};

/* [control name, kind, look key, when(args)]
   v0.99.7 (controls on demand, CLAUDE.md v0.87): a slider is written only when the part it drives is actually
   built. Before this every run put all eleven on the glass layer, so a plain Clear glass with no rim, tint or
   shadow still carried eight sliders that moved nothing. Light Angle is kept while EITHER the rim bevel or the
   shadow offset needs it. */
const CONTROLS = [
  ['Glass Frost', 'slider', 'frost'], ['Glass Refraction', 'slider', 'refraction'], ['Glass Brightness', 'slider', 'brightness'],
  ['Glass Tint', 'color', 'tint', (a) => !!a.tintLayer], ['Glass Tint Amount', 'slider', 'tintAmount', (a) => !!a.tintLayer],
  ['Glass Rim', 'slider', 'rim', (a) => !!a.rim], ['Glass Rim Width', 'slider', 'rimWidth', (a) => !!a.rim],
  ['Glass Light Angle', 'angle', 'angle', (a) => !!a.rim || !!a.shadow],
  ['Glass Shadow', 'slider', 'shadow', (a) => !!a.shadow], ['Glass Shadow Softness', 'slider', 'softness', (a) => !!a.shadow], ['Glass Shadow Distance', 'slider', 'distance', (a) => !!a.shadow]
];
const KIND = {
  slider: { matchName: 'ADBE Slider Control', param: 'Slider', type: 'OneD' },
  angle: { matchName: 'ADBE Angle Control', param: 'Angle', type: 'OneD' },
  color: { matchName: 'ADBE Color Control', param: 'Color', type: 'COLOR' }
};
const TAG = '// MOE Glass';
const GLASS_NAME = /^MOE Glass \d+( .+)?$/; // flat parts (Tint / Rim / Shadow) and Thick Glass parts (Map / Prism / ...)
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

function lookValues(look, tintHex) {
  const L = Object.assign({}, LOOKS[look] || LOOKS.clear);
  if (tintHex) L.tint = tintHex;
  return L;
}

function controlItems(values, args) {
  const want = HOLDER.needed(CONTROLS.map(([name, kind, key, when]) => ({ key: name, kind, lookKey: key, when })), args || {});
  return want.map(({ key: name, kind, lookKey }) => {
    const K = KIND[kind];
    const value = kind === 'color' ? hexToRgb(values[lookKey]).concat([1]) : values[lookKey];
    return { key: name, matchName: K.matchName, before: [], params: [{ id: name, value, names: [K.param], suffix: 1, nth: { type: K.type, n: 1 } }] };
  });
}

/** Expressions (pure) for one glass setup. */
function expressions(glassName, sourceName) {
  const G = `thisComp.layer("${esc(glassName)}")`;
  const S = `thisComp.layer("${esc(sourceName)}")`;
  const c = (n) => `${G}.effect("${n}")(1).value`;
  const op = (amount) => `${TAG}\n${amount} * ${S}.transform.opacity.value / 100;`;
  return {
    frost: `${TAG}\nMath.max(0, ${c('Glass Frost')});`,
    lens: `${TAG}\nMath.min(Math.max(${c('Glass Refraction')}, 0), 170);`,
    center: `${TAG}\nvar L = ${S}; var r = L.sourceRectAtTime(time, false);\nL.toComp([r.left + r.width / 2, r.top + r.height / 2]);`,
    brightness: `${TAG}\n${c('Glass Brightness')};`,
    tintColor: `${TAG}\n${c('Glass Tint')};`,
    tintOpacity: op(`Math.min(Math.max(${c('Glass Tint Amount')}, 0), 100)`),
    rimOpacity: op(`Math.min(Math.max(${c('Glass Rim')}, 0), 100)`),
    rimWidth: `${TAG}\nMath.max(0, ${c('Glass Rim Width')});`,
    rimAngle: `${TAG}\n${c('Glass Light Angle')};`,
    shadowOpacity: op(`Math.min(Math.max(${c('Glass Shadow')}, 0), 100)`),
    shadowBlur: `${TAG}\nMath.max(0, ${c('Glass Shadow Softness')});`,
    shadowOffset: `${TAG}\nvar a = (${c('Glass Light Angle')} + 90) * Math.PI / 180, d = ${c('Glass Shadow Distance')};\nvalue.length > 2 ? [value[0] + d * Math.cos(a), value[1] + d * Math.sin(a), value[2]] : [value[0] + d * Math.cos(a), value[1] + d * Math.sin(a)];`
  };
}

const fxAddr = (layerId, fx, param) => ({ layerId, matchNames: ['ADBE Effect Parade', `name:${fx}`, `name:${param}`] });
const tAddr = (layerId, mn) => ({ layerId, matchNames: ['ADBE Transform Group', mn] });

const apply = {
  id: 'glass.apply',
  version: '1.0.0',
  category: 'compositing',
  group: 'Glass',
  name: 'Glass',
  description: 'Turn shapes, text, footage or pre-comps into editable liquid / frosted glass with native effects: refraction lens, frost, tint, lit rim and soft shadow. Pick a look, then fine-tune and animate every amount on the MOE Glass layer.',
  keywords: ['glass', 'liquid glass', 'frosted', 'glassmorphism', 'refraction', 'blur', 'ui', 'ios', 'glasser', 'acrylic'],
  icon: 'glass',
  params: {
    look: { type: 'enum', label: 'Look', tileFixed: true, default: 'liquid', options: Object.entries(LOOKS).map(([value, l]) => ({ value, label: l.label })) },
    tint: { type: 'string', label: 'Tint', default: '', maxLength: 7, format: 'color', description: 'Optional #RRGGBB (empty = look colour)' },
    rim: { type: 'boolean', label: 'Rim light', default: true },
    tintLayer: { type: 'boolean', label: 'Tint layer', default: true },
    shadow: { type: 'boolean', label: 'Shadow', default: true }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers', 'modify.effects', 'modify.expressions'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Liquid / frosted glass look on selected shapes, text, footage or pre-comps (glassmorphism UI cards, buttons, titles).' },
  uses: { hostOps: ['layers.createAdjustment', 'layers.duplicateLinked', 'layers.setMatte', 'layers.setAttrs', 'effects.ensure', 'expressions.set'], network: false },
  compatibility: { minAE: '25.0' },
  ui: {
    primaryLabel: 'Make Glass',
    presets: Object.entries(LOOKS).map(([id, l]) => ({ id, label: l.label, args: { look: id } }))
  },

  prepare(args, ctx) {
    if (args.tint && !/^#[0-9a-fA-F]{6}$/.test(args.tint)) return { ok: false, error: 'Tint must be #RRGGBB' };
    const sources = (ctx.layers || []).filter((l) => !GLASS_NAME.test(l.name) && !['camera', 'light', 'null', 'adjustment'].includes(l.type));
    const locked = sources.filter((l) => l.locked);
    if (locked.length) return { ok: false, error: `Unlock ${locked.map((l) => l.name).join(', ')} first` };
    if (!sources.length) return { ok: false, error: 'Select shape, text, footage or pre-comp layers' };
    if (sources.length > 12) return { ok: false, error: 'Glass up to 12 layers at a time' };
    const used = new Set((ctx.compLayers || []).map((l) => l.name));
    let n = 1;
    const names = sources.map(() => { while (used.has(`MOE Glass ${n}`) || used.has(`MOE Glass ${n} Map`)) n++; used.add(`MOE Glass ${n}`); return `MOE Glass ${n}`; });
    return { ok: true, sources, names, preview: { summary: `${LOOKS[args.look].label} glass on ${sources.length} layer(s)`, items: sources.map((s, i) => `${s.name} → ${names[i]}`).concat(['Source layers are hidden and used as the glass shape (restorable)']) } };
  },

  async execute({ args, ctx, prepared, host }) {
    const comp = ctx.comp;
    const values = lookValues(args.look, args.tint);
    // v0.94 (docs/features/ONE_UNDO.md): every source's glass (layers, order, effects, links, matte) in ONE host call —
    // one Ctrl+Z. The new layers' ids reach the later steps by reference.
    const T = PLAN1(host, 'MOE: Glass');
    const pending = [];
    for (let i = 0; i < prepared.sources.length; i++) {
      const src = prepared.sources[i];
      const name = prepared.names[i];
      const made = [];
      const glassR = T.add('layers.createAdjustment', { compId: comp.id, name, above: src.id, inPoint: src.inPoint, outPoint: src.outPoint, label: 14, comment: `${TAG} of ${src.name}` });
      const glass = { layerId: glassR.at('layerId') };
      made.push(glass.layerId);
      const parts = {};
      if (args.shadow) { parts.shadow = T.add('layers.duplicateLinked', { compId: comp.id, sourceId: src.id, name: `${name} Shadow`, place: 'below', label: 14 }); made.push(parts.shadow.at('layerId')); }
      if (args.tintLayer) { parts.tint = T.add('layers.duplicateLinked', { compId: comp.id, sourceId: src.id, name: `${name} Tint`, place: 'above', label: 14 }); made.push(parts.tint.at('layerId')); }
      if (args.rim) { parts.rim = T.add('layers.duplicateLinked', { compId: comp.id, sourceId: src.id, name: `${name} Rim`, place: 'above', label: 14 }); made.push(parts.rim.at('layerId')); }
      // Stack: Rim, Tint, Glass, Source, Shadow.
      const order = [];
      if (parts.tint) order.push({ layerId: parts.tint.at('layerId'), before: glass.layerId });
      if (parts.rim) order.push({ layerId: parts.rim.at('layerId'), before: parts.tint ? parts.tint.at('layerId') : glass.layerId });
      if (order.length) T.add('layers.move', { compId: comp.id, items: order });

      const fxLayers = [{ layer: { layerId: glass.layerId }, items: [
        ...controlItems(values, args),
        { key: 'MOE Glass Frost', matchName: 'ADBE Gaussian Blur 2', before: [], params: [{ id: 'Repeat Edge Pixels', value: 1, names: ['Repeat Edge Pixels'] }] },
        { key: 'MOE Glass Lens', matchName: 'ADBE Optics Compensation', before: [], params: [{ id: 'Reverse Lens Distortion', value: 1, names: ['Reverse Lens Distortion'] }] },
        { key: 'MOE Glass Light', matchName: 'ADBE Brightness & Contrast 2', before: [], params: [] }
      ] }];
      if (parts.tint) fxLayers.push({ layer: { layerId: parts.tint.at('layerId') }, items: [{ key: 'MOE Glass Fill', matchName: 'ADBE Fill', before: [], params: [] }] });
      if (parts.rim) fxLayers.push({ layer: { layerId: parts.rim.at('layerId') }, items: [{ key: 'MOE Glass Fill', matchName: 'ADBE Fill', before: [], params: [{ id: 'Color', value: [0.5, 0.5, 0.5, 1], names: ['Color'] }] }, { key: 'MOE Glass Bevel', matchName: 'ADBE Bevel Alpha', before: [], params: [{ id: 'Light Intensity', value: 1, names: ['Light Intensity'] }] }] });
      if (parts.shadow) fxLayers.push({ layer: { layerId: parts.shadow.at('layerId') }, items: [{ key: 'MOE Glass Fill', matchName: 'ADBE Fill', before: [], params: [{ id: 'Color', value: [0, 0, 0, 1], names: ['Color'] }] }, { key: 'MOE Glass Blur', matchName: 'ADBE Gaussian Blur 2', before: [], params: [{ id: 'Repeat Edge Pixels', value: 0, names: ['Repeat Edge Pixels'] }] }] });
      const fx = T.add('effects.ensure', { compId: comp.id, label: 'MOE: Glass Effects', layers: fxLayers });

      const X = expressions(name, src.name);
      const targets = [
        { address: fxAddr(glass.layerId, 'MOE Glass Frost', 'Blurriness'), expression: X.frost },
        { address: fxAddr(glass.layerId, 'MOE Glass Lens', 'Field Of View (FOV)'), expression: X.lens },
        { address: fxAddr(glass.layerId, 'MOE Glass Lens', 'View Center'), expression: X.center },
        { address: fxAddr(glass.layerId, 'MOE Glass Light', 'Brightness'), expression: X.brightness }
      ];
      if (parts.tint) targets.push({ address: fxAddr(parts.tint.at('layerId'), 'MOE Glass Fill', 'Color'), expression: X.tintColor }, { address: tAddr(parts.tint.at('layerId'), 'ADBE Opacity'), expression: X.tintOpacity });
      if (parts.rim) targets.push({ address: tAddr(parts.rim.at('layerId'), 'ADBE Opacity'), expression: X.rimOpacity }, { address: fxAddr(parts.rim.at('layerId'), 'MOE Glass Bevel', 'Edge Thickness'), expression: X.rimWidth }, { address: fxAddr(parts.rim.at('layerId'), 'MOE Glass Bevel', 'Light Angle'), expression: X.rimAngle });
      if (parts.shadow) targets.push({ address: tAddr(parts.shadow.at('layerId'), 'ADBE Opacity'), expression: X.shadowOpacity }, { address: fxAddr(parts.shadow.at('layerId'), 'MOE Glass Blur', 'Blurriness'), expression: X.shadowBlur }, { address: tAddr(parts.shadow.at('layerId'), 'ADBE Position'), expression: X.shadowOffset });
      const set = T.add('expressions.set', { compId: comp.id, label: 'MOE: Glass', revertOnError: true, targets: targets.map((t) => Object.assign(t, { enabled: true })) });
      const matte = T.add('layers.setMatte', { compId: comp.id, items: [{ layerId: glass.layerId, matteId: src.id, type: 'alpha' }] });
      const attrs = [{ layerId: src.id, enabled: false }];
      if (parts.rim) attrs.push({ layerId: parts.rim.at('layerId'), blendingMode: 'overlay' });
      const hide = T.add('layers.setAttrs', { compId: comp.id, label: 'MOE: Glass', items: attrs });
      pending.push({ source: { id: src.id, name: src.name }, name, glassR, parts, fx, set, matte, hide, made });
    }
    try {
      await T.commit();
    } catch (e) {
      // nothing half-made stays: every layer this run made goes, the sources are shown again
      const ids = [];
      for (const p of pending) for (const m of p.made) { const v = typeof m === 'object' && m && m.value ? m.value() : m; if (v !== undefined && v !== null) ids.push(v); }
      if (ids.length) await host.call('layers.remove', { compId: comp.id, layerIds: ids, onlyNamed: 'MOE Glass' }).catch(() => {});
      await host.call('layers.setAttrs', { compId: comp.id, items: pending.map((p) => ({ layerId: p.source.id, enabled: true })) }).catch(() => {});
      throw e;
    }
    const setups = pending.map((p) => ({ source: p.source, name: p.name, glassId: p.glassR.value().layerId, parts: Object.fromEntries(Object.entries(p.parts).map(([k, v]) => [k, v.value().layerId])), fx: p.fx.value(), set: p.set.value(), matte: p.matte.value(), hide: p.hide.value(), made: p.made.map((m) => m.value()) }));
    return { setups, look: args.look };
  },

  verify({ result }) {
    const checks = [];
    for (const s of result.setups) {
      const m = s.matte.layers[0];
      checks.push({ ok: m.after === s.source.id, label: `${s.name} › Track matte`, detail: m.after === s.source.id ? `alpha of ${s.source.name}` : 'not set' });
      const src = s.hide.layers.find((l) => l.layerId === s.source.id);
      checks.push({ ok: !!src, label: s.source.name, detail: 'hidden — now the glass shape' });
      const bad = s.set.targets.filter((t) => t.skipped || t.reverted || t.after.expressionError);
      checks.push({ ok: bad.length === 0, label: `${s.name} › links`, detail: bad.length ? bad.map((t) => `${t.layerName} › ${t.name}: ${t.after ? t.after.expressionError : t.skipped}`).join('; ') : `${s.set.targets.length} controls linked, no engine errors` });
      const unmapped = s.fx.layers.flatMap((L) => L.items.flatMap((i) => i.params.filter((p) => p.resolvedBy !== 'name').map((p) => `${i.key}.${p.id}`)));
      checks.push({ ok: true, label: `${s.name} › effects`, detail: `${s.made.length} layer(s)${unmapped.length ? ` · mapping unverified: ${unmapped.join(', ')}` : ''}` });
    }
    return { ok: checks.every((c) => c.ok), checks };
  },

  checkpoint({ result, ctx }) {
    return { compId: ctx.comp.id, setups: result.setups.map((s) => ({ made: s.made, source: s.source.id })) };
  },

  async restore({ data, host }) {
    const T = PLAN1(host, 'MOE: Restore Glass');
    for (const s of data.setups) {
      T.add('layers.remove', { compId: data.compId, layerIds: s.made, onlyNamed: 'MOE Glass' });
      T.add('layers.setAttrs', { compId: data.compId, label: 'MOE: Restore Glass', items: [{ layerId: s.source, enabled: true }] });
    }
    await T.commit();
    return { ok: true };
  },

  summarize(result, v) { return v.ok ? `${LOOKS[result.look].label} glass on ${result.setups.length} layer(s)` : 'Glass finished with problems'; }
};

/** Switch look on an existing glass (select its MOE Glass N layer). */
const look = {
  id: 'glass.look',
  version: '1.0.0',
  category: 'compositing',
  group: 'Glass',
  name: 'Glass Look',
  description: 'Apply a look (or a tint) to selected MOE Glass layers — only the controls change, so it stays animatable.',
  keywords: ['glass', 'look', 'tint', 'frost'],
  icon: 'glass',
  params: { look: apply.params.look, tint: apply.params.tint },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.effects'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Change the look/tint of existing MOE Glass layers.' },
  uses: { hostOps: ['props.setValues'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Apply Look', presets: apply.ui.presets },
  prepare(args, ctx) {
    if (args.tint && !/^#[0-9a-fA-F]{6}$/.test(args.tint)) return { ok: false, error: 'Tint must be #RRGGBB' };
    const thick = new Set((ctx.compLayers || []).map((l) => l.name).filter((n) => / Map$/.test(n)));
    const glasses = (ctx.layers || []).filter((l) => /^MOE Glass \d+$/.test(l.name) && !thick.has(`${l.name} Map`));
    if (!glasses.length) return { ok: false, error: (ctx.layers || []).some((l) => /^MOE Glass \d+$/.test(l.name)) ? 'That is a Thick Glass — use Thick Glass Look' : 'Select a MOE Glass layer' };
    return { ok: true, glasses, preview: { summary: `${LOOKS[args.look].label} on ${glasses.map((g) => g.name).join(', ')}`, items: [] } };
  },
  async execute({ args, ctx, prepared, host }) {
    const v = lookValues(args.look, args.tint);
    // v0.99.7: a glass built without its rim, tint or shadow carries no slider for that part, so those controls are
    // addressed as optional - the look still applies to everything the rig does have.
    const items = prepared.glasses.flatMap((g) => CONTROLS.map(([name, kind, key, when]) => ({ address: fxAddr(g.id, name, KIND[kind].param), value: kind === 'color' ? hexToRgb(v[key]).concat([1]) : v[key], optional: !!when })));
    return host.call('props.setValues', { compId: ctx.comp.id, label: 'MOE: Glass Look', items });
  },
  verify({ result }) {
    const absent = result.items.filter((i) => i.skipped === 'NOT_PRESENT');
    const bad = result.items.filter((i) => i.skipped && i.skipped !== 'NOT_PRESENT');
    const updated = result.items.length - absent.length - bad.length;
    const ok = !bad.length && updated > 0;
    return { ok, checks: [{ ok, label: 'Controls', detail: `${updated} updated${absent.length ? ` · ${absent.length} not on this glass (that part is off)` : ''}${bad.length ? ` · ${bad.length} refused: ${bad.map((i) => i.skipped).join(', ')}` : ''}` }] };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, items: result.items.filter((i) => !i.skipped).map((i) => ({ address: i.address, value: i.before })) }; },
  async restore({ data, host }) { return host.call('props.setValues', { compId: data.compId, label: 'MOE: Restore Glass', items: data.items }); },
  summarize(result) { return `Glass look updated (${result.items.length} controls)`; }
};

module.exports = { apply, look, LOOKS, CONTROLS, expressions, TAG };
