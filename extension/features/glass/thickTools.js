'use strict';
/**
 * Thick Glass tools (v0.27): glass.thick builds the setup described in thick.js,
 * glass.thickLook switches the look of an existing one (controls only, stays animatable).
 */
const { hexToRgb } = require('../brand/brands');
const T = require('./thick');

const SKIP_TYPES = ['camera', 'light', 'null', 'adjustment'];
const GLASS_NAME = /^MOE Glass \d+( .+)?$/;
const fxAddr = (layerId, fx, param) => ({ layerId, matchNames: ['ADBE Effect Parade', `name:${fx}`, `name:${param}`] });
const tAddr = (layerId, mn) => ({ layerId, matchNames: ['ADBE Transform Group', mn] });
const lookOptions = Object.entries(T.THICK_LOOKS).map(([value, l]) => ({ value, label: l.label }));

/* CC Glass parameters MOE sets / links (resolved by English name; a missing name fails the run with the real list). */
const ccGlass = (key, mapId, extra) => ({ key, matchName: 'CC Glass', before: [], params: [
  { id: 'Bump Map', layerRef: mapId, names: ['Bump Map'] },
  { id: 'Softness', value: 18, names: ['Softness'] }, { id: 'Height', value: 60, names: ['Height'] }, { id: 'Displacement', value: 0, names: ['Displacement'] }
].concat(extra || []) });
const v = (id, value) => ({ id, value, names: [id] });

const thick = {
  id: 'glass.thick',
  version: '1.0.0',
  category: 'compositing',
  group: 'Glass',
  name: 'Thick Glass',
  description: 'Glaze-class thick glass from any shape, text, logo or footage alpha: true refraction of what is behind (CC Glass from a live height map), bevel, frost, chromatic dispersion, chrome reflection, studio highlights, soft shadow and caustics — native effects only, every amount an animatable control.',
  keywords: ['glass', 'thick glass', 'glaze', 'refraction', 'chromatic aberration', 'dispersion', 'prism', 'caustics', 'chrome', 'bevel', 'crystal', 'logo', '3d glass'],
  icon: 'glass',
  params: {
    look: { type: 'enum', label: 'Look', default: 'glaze', options: lookOptions },
    tint: { type: 'string', label: 'Tint', default: '', maxLength: 7, format: 'color', description: 'Optional #RRGGBB (empty = look colour)' },
    merge: { type: 'boolean', label: 'One piece', default: false, description: 'One glass over every selected layer — they refract as one piece' },
    prism: { type: 'boolean', label: 'Dispersion', default: true },
    reflection: { type: 'boolean', label: 'Reflection', default: true },
    highlights: { type: 'boolean', label: 'Highlights', default: true },
    shadow: { type: 'boolean', label: 'Shadow', default: true },
    caustics: { type: 'boolean', label: 'Caustics', default: true }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers', 'modify.effects', 'modify.expressions'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Thick refractive glass (Glaze-style) on selected shapes, text, logos or footage: refraction, bevel, dispersion, chrome, caustics.' },
  uses: { hostOps: ['glass.map', 'glass.removeMap', 'layers.createAdjustment', 'layers.createSolid', 'layers.duplicateLinked', 'layers.setMatte', 'layers.setAttrs', 'effects.ensure', 'expressions.set'], network: false },
  compatibility: { minAE: '25.0' },
  ui: {
    primaryLabel: 'Make Thick Glass',
    presets: Object.entries(T.THICK_LOOKS).map(([id, l]) => ({ id, label: l.label, args: { look: id } }))
  },

  prepare(args, ctx) {
    if (args.tint && !/^#[0-9a-fA-F]{6}$/.test(args.tint)) return { ok: false, error: 'Tint must be #RRGGBB' };
    const sources = (ctx.layers || []).filter((l) => !GLASS_NAME.test(l.name) && !SKIP_TYPES.includes(l.type));
    const locked = sources.filter((l) => l.locked);
    if (locked.length) return { ok: false, error: `Unlock ${locked.map((l) => l.name).join(', ')} first` };
    if (!sources.length) return { ok: false, error: 'Select shape, text, footage or pre-comp layers' };
    const three = sources.filter((l) => l.threeD);
    if (three.length) return { ok: false, error: `Thick Glass works on 2D layers (${three.map((l) => l.name).join(', ')} is 3D)` };
    if (sources.length > 8) return { ok: false, error: 'Thick Glass up to 8 layers at a time' };
    const names = new Set(sources.map((s) => s.name));
    if (names.size < sources.length) return { ok: false, error: 'Selected layers need different names (the glass links to them by name)' };
    const groups = args.merge ? [sources.slice().sort((a, b) => a.index - b.index)] : sources.map((s) => [s]);
    const used = new Set((ctx.compLayers || []).map((l) => l.name));
    let n = 1;
    const glassNames = groups.map(() => { while (used.has(`MOE Glass ${n}`) || used.has(`MOE Glass ${n} Map`)) n++; used.add(`MOE Glass ${n}`); return `MOE Glass ${n}`; });
    const parts = ['refraction'].concat(args.prism ? ['dispersion'] : [], args.reflection ? ['reflection'] : [], args.highlights ? ['highlights'] : [], args.shadow ? ['shadow'] : [], args.caustics ? ['caustics'] : []);
    return { ok: true, groups, glassNames, preview: { summary: `${T.THICK_LOOKS[args.look].label} thick glass on ${sources.length} layer(s)${args.merge && sources.length > 1 ? ' — one piece' : ''}`,
      items: groups.map((g, i) => `${g.map((s) => s.name).join(' + ')} → ${glassNames[i]} (${parts.join(', ')})`).concat([
        'A small "MOE Glass N Map" comp holds a live white copy of the shape (the glass reads its height from it)',
        'Source layers are hidden (restorable); edit them as usual — the map follows'
      ]) } };
  },

  async execute({ args, ctx, prepared, host }) {
    const comp = ctx.comp;
    const values = T.thickValues(args.look, args.tint);
    const setups = [];
    for (let gi = 0; gi < prepared.groups.length; gi++) {
      const srcs = prepared.groups[gi];
      const name = prepared.glassNames[gi];
      const top = srcs.reduce((a, b) => (b.index < a.index ? b : a));
      const inPoint = Math.min(...srcs.map((s) => s.inPoint));
      const outPoint = Math.max(...srcs.map((s) => s.outPoint));
      const made = [];
      let mapLayerId = null;
      try {
        const map = await host.call('glass.map', { compId: comp.id, name: `${name} Map`, above: top.id, label: 14, comment: `${T.TAG} map of ${srcs.map((s) => s.name).join(', ')}`,
          items: srcs.map((s) => { const m = T.mapTransform(comp.name, s.name); return { sourceId: s.id, base: m.base, transform: m }; }) });
        mapLayerId = map.mapLayerId;
        const add = async (op, a) => { const r = await host.call(op, Object.assign({ compId: comp.id, inPoint, outPoint, label: 14 }, a)); made.push(r.layerId); return r; };
        const glass = await add('layers.createAdjustment', { name, above: mapLayerId, comment: `${T.TAG} thick of ${srcs.map((s) => s.name).join(', ')}` });
        const parts = {};
        let topId = glass.layerId;
        if (args.prism) {
          parts.prismR = await add('layers.createAdjustment', { name: `${name} Prism R`, above: topId }); topId = parts.prismR.layerId;
          parts.prismB = await add('layers.createAdjustment', { name: `${name} Prism B`, above: topId }); topId = parts.prismB.layerId;
        }
        if (args.reflection) { parts.reflect = await add('layers.createSolid', { name: `${name} Reflect`, color: [0.5, 0.5, 0.5], above: topId }); topId = parts.reflect.layerId; }
        if (args.highlights) { parts.highlights = await add('layers.createSolid', { name: `${name} Highlights`, color: [0, 0, 0], above: topId }); topId = parts.highlights.layerId; }
        const shadows = [], caustics = [];
        for (let i = 0; i < srcs.length; i++) {
          const sfx = srcs.length > 1 ? ` ${i + 1}` : '';
          if (args.shadow) { const r = await host.call('layers.duplicateLinked', { compId: comp.id, sourceId: srcs[i].id, name: `${name} Shadow${sfx}`, place: 'below', label: 14 }); made.push(r.layerId); shadows.push({ id: r.layerId, src: srcs[i] }); }
          if (args.caustics) { const r = await host.call('layers.duplicateLinked', { compId: comp.id, sourceId: srcs[i].id, name: `${name} Caustic${sfx}`, place: 'below', label: 14 }); made.push(r.layerId); caustics.push({ id: r.layerId, src: srcs[i] }); }
        }

        const fxLayers = [{ layer: { layerId: glass.layerId }, items: [
          ...T.controlItems(values),
          { key: 'MOE Glass Frost', matchName: 'ADBE Gaussian Blur 2', before: [], params: [v('Repeat Edge Pixels', 1)] },
          ccGlass('MOE Glass Refract', mapLayerId, [v('Ambient', 100), v('Diffuse', 0), v('Specular', 0)]),
          { key: 'MOE Glass Tint', matchName: 'ADBE Tint', before: [], params: [v('Map Black To', [0, 0, 0, 1])] },
          { key: 'MOE Glass Light', matchName: 'ADBE Brightness & Contrast 2', before: [], params: [] }
        ] }];
        const prismFx = (keep) => [
          { key: 'MOE Glass Prism', matchName: 'ADBE Geometry2', before: [], params: [v('Uniform Scale', 1)] },
          { key: 'MOE Glass Channel', matchName: 'ADBE CHANNEL MIXER', before: [], params: ['Red-Red', 'Green-Green', 'Blue-Blue'].map((p) => v(p, p[0] === keep ? 100 : 0)) }
        ];
        if (parts.prismR) fxLayers.push({ layer: { layerId: parts.prismR.layerId }, items: prismFx('R') });
        if (parts.prismB) fxLayers.push({ layer: { layerId: parts.prismB.layerId }, items: prismFx('B') });
        if (parts.reflect) fxLayers.push({ layer: { layerId: parts.reflect.layerId }, items: [
          { key: 'MOE Glass Studio', matchName: 'ADBE Ramp', before: [], params: [v('End Color', hexToRgb('#0B0D12').concat([1])), v('Blend With Original', 0)] },
          ccGlass('MOE Glass Warp', mapLayerId, [v('Ambient', 100), v('Diffuse', 0), v('Specular', 0)]),
          { key: 'MOE Glass Blur', matchName: 'ADBE Gaussian Blur 2', before: [], params: [v('Repeat Edge Pixels', 1)] }
        ] });
        if (parts.highlights) fxLayers.push({ layer: { layerId: parts.highlights.layerId }, items: [
          ccGlass('MOE Glass Studio Light', mapLayerId, [v('Light Intensity', 100), v('Light Color', [1, 1, 1, 1]), v('Light Height', 45), v('Light Direction', -45), v('Ambient', 0), v('Diffuse', 25), v('Specular', 100), v('Roughness', 12)])
        ] });
        for (const s of shadows) fxLayers.push({ layer: { layerId: s.id }, items: [
          { key: 'MOE Glass Fill', matchName: 'ADBE Fill', before: [], params: [v('Color', [0, 0, 0, 1])] },
          { key: 'MOE Glass Blur', matchName: 'ADBE Gaussian Blur 2', before: [], params: [v('Repeat Edge Pixels', 0)] }] });
        for (const s of caustics) fxLayers.push({ layer: { layerId: s.id }, items: [
          { key: 'MOE Glass Fill', matchName: 'ADBE Fill', before: [], params: [] },
          { key: 'MOE Glass Choke', matchName: 'ADBE Simple Choker', before: [], params: [] },
          { key: 'MOE Glass Blur', matchName: 'ADBE Gaussian Blur 2', before: [], params: [v('Repeat Edge Pixels', 0)] }] });
        const fx = await host.call('effects.ensure', { compId: comp.id, label: 'MOE: Thick Glass Effects', layers: fxLayers });

        const X = T.thickExpressions(name, srcs.map((s) => s.name));
        const targets = [];
        const link = (id, fxName, param, expression) => targets.push({ address: fxAddr(id, fxName, param), expression });
        const linkT = (id, mn, expression) => targets.push({ address: tAddr(id, mn), expression });
        const g = glass.layerId;
        link(g, 'MOE Glass Frost', 'Blurriness', X.frost);
        link(g, 'MOE Glass Refract', 'Softness', X.softness); link(g, 'MOE Glass Refract', 'Height', X.height); link(g, 'MOE Glass Refract', 'Displacement', X.displacement);
        link(g, 'MOE Glass Tint', 'Map White To', X.tintColor); link(g, 'MOE Glass Tint', 'Amount to Tint', X.tintAmount);
        link(g, 'MOE Glass Light', 'Brightness', X.brightness);
        for (const [key, scale] of [['prismR', X.prismUp], ['prismB', X.prismDown]]) {
          if (!parts[key]) continue;
          const id = parts[key].layerId;
          link(id, 'MOE Glass Prism', 'Anchor Point', X.center); link(id, 'MOE Glass Prism', 'Position', X.center);
          link(id, 'MOE Glass Prism', 'Scale Height', scale); link(id, 'MOE Glass Prism', 'Scale Width', scale);
          linkT(id, 'ADBE Opacity', X.prismOpacity);
        }
        if (parts.reflect) {
          const id = parts.reflect.layerId;
          link(id, 'MOE Glass Studio', 'Start of Ramp', X.rampStart); link(id, 'MOE Glass Studio', 'End of Ramp', X.rampEnd); link(id, 'MOE Glass Studio', 'Start Color', X.lightColor);
          link(id, 'MOE Glass Warp', 'Softness', X.softness); link(id, 'MOE Glass Warp', 'Height', X.height); link(id, 'MOE Glass Warp', 'Displacement', X.warp);
          link(id, 'MOE Glass Blur', 'Blurriness', X.reflectionBlur);
          linkT(id, 'ADBE Opacity', X.reflectionOpacity);
        }
        if (parts.highlights) {
          const id = parts.highlights.layerId;
          link(id, 'MOE Glass Studio Light', 'Softness', X.softness); link(id, 'MOE Glass Studio Light', 'Height', X.height);
          link(id, 'MOE Glass Studio Light', 'Light Color', X.lightColor); link(id, 'MOE Glass Studio Light', 'Light Height', X.lightHeight);
          link(id, 'MOE Glass Studio Light', 'Light Direction', X.lightDirection); link(id, 'MOE Glass Studio Light', 'Diffuse', X.edgeLight);
          link(id, 'MOE Glass Studio Light', 'Roughness', X.roughness);
          linkT(id, 'ADBE Opacity', X.highlightsOpacity);
        }
        for (const s of shadows) {
          linkT(s.id, 'ADBE Opacity', X.shadowOpacity(s.src.name)); link(s.id, 'MOE Glass Blur', 'Blurriness', X.shadowBlur); linkT(s.id, 'ADBE Position', X.shadowOffset);
        }
        for (const s of caustics) {
          linkT(s.id, 'ADBE Opacity', X.causticOpacity(s.src.name)); link(s.id, 'MOE Glass Fill', 'Color', X.lightColor);
          link(s.id, 'MOE Glass Choke', 'Choke Matte', X.causticChoke); link(s.id, 'MOE Glass Blur', 'Blurriness', X.causticBlur); linkT(s.id, 'ADBE Position', X.causticOffset);
        }
        const set = await host.call('expressions.set', { compId: comp.id, label: 'MOE: Thick Glass', revertOnError: true, targets: targets.map((t) => Object.assign(t, { enabled: true })) });

        const matted = [glass.layerId].concat(['prismR', 'prismB', 'reflect', 'highlights'].filter((k) => parts[k]).map((k) => parts[k].layerId));
        const matte = await host.call('layers.setMatte', { compId: comp.id, items: matted.map((id) => ({ layerId: id, matteId: mapLayerId, type: 'alpha' })) });
        const attrs = srcs.map((s) => ({ layerId: s.id, enabled: false }));
        if (parts.prismR) attrs.push({ layerId: parts.prismR.layerId, blendingMode: 'lighten' }, { layerId: parts.prismB.layerId, blendingMode: 'lighten' });
        if (parts.highlights) attrs.push({ layerId: parts.highlights.layerId, blendingMode: 'screen' });
        for (const s of caustics) attrs.push({ layerId: s.id, blendingMode: 'add' });
        const hide = await host.call('layers.setAttrs', { compId: comp.id, label: 'MOE: Thick Glass', items: attrs });
        setups.push({ name, sources: srcs.map((s) => ({ id: s.id, name: s.name })), map, glassId: glass.layerId, matted, fx, set, matte, hide, made });
      } catch (e) {
        if (made.length) await host.call('layers.remove', { compId: comp.id, layerIds: made, onlyNamed: 'MOE Glass' }).catch(() => {});
        if (mapLayerId) await host.call('glass.removeMap', { compId: comp.id, mapLayerIds: [mapLayerId] }).catch(() => {});
        await host.call('layers.setAttrs', { compId: comp.id, items: srcs.map((s) => ({ layerId: s.id, enabled: true })) }).catch(() => {});
        // Roll back the setups already finished in this run, then report.
        for (const s of setups) {
          await host.call('layers.remove', { compId: comp.id, layerIds: s.made, onlyNamed: 'MOE Glass' }).catch(() => {});
          await host.call('glass.removeMap', { compId: comp.id, mapLayerIds: [s.map.mapLayerId] }).catch(() => {});
          await host.call('layers.setAttrs', { compId: comp.id, items: s.sources.map((x) => ({ layerId: x.id, enabled: true })) }).catch(() => {});
        }
        throw e;
      }
    }
    return { setups, look: args.look };
  },

  verify({ result }) {
    const checks = [];
    for (const s of result.setups) {
      const copies = s.map.copies;
      const mapErr = copies.flatMap((c) => c.errors.map((e) => `${c.sourceName} › ${e}`));
      checks.push({ ok: !s.map.enabled && mapErr.length === 0 && copies.length === s.sources.length,
        label: `${s.name} Map`, detail: mapErr.length ? mapErr.join('; ') : `${copies.map((c) => `${c.sourceName}: transform + ${c.links} live link(s)${c.capped ? ' (capped — very complex shape)' : ''}`).join(' · ')}` });
      const wrongMatte = s.matte.layers.filter((m) => m.after !== s.map.mapLayerId);
      checks.push({ ok: wrongMatte.length === 0 && s.matte.layers.length === s.matted.length, label: `${s.name} › Track mattes`, detail: wrongMatte.length ? `${wrongMatte.length} not set` : `${s.matte.layers.length} layer(s) read the map's alpha` });
      const bump = s.fx.layers.flatMap((L) => L.items.filter((i) => i.matchName === 'CC Glass').map((i) => i.params.find((p) => p.id === 'Bump Map')));
      const mapIndexOk = bump.every((p) => p && p.after > 0);
      checks.push({ ok: mapIndexOk, label: `${s.name} › CC Glass`, detail: mapIndexOk ? `${bump.length} CC Glass effect(s), Bump Map = map` : 'Bump Map not set' });
      const bad = s.set.targets.filter((t) => t.skipped || t.reverted || (t.after && t.after.expressionError));
      checks.push({ ok: bad.length === 0, label: `${s.name} › links`, detail: bad.length ? bad.map((t) => `${t.layerName} › ${t.name}: ${t.after ? t.after.expressionError : t.skipped}`).join('; ') : `${s.set.targets.length} effect values follow the controls, no engine errors` });
      const hidden = s.sources.every((src) => s.hide.layers.some((l) => l.layerId === src.id));
      checks.push({ ok: hidden, label: s.sources.map((x) => x.name).join(', '), detail: 'hidden — the map follows them' });
    }
    return { ok: checks.every((c) => c.ok), checks };
  },

  checkpoint({ result, ctx }) {
    return { compId: ctx.comp.id, setups: result.setups.map((s) => ({ made: s.made, map: s.map.mapLayerId, sources: s.sources.map((x) => x.id) })) };
  },

  async restore({ data, host }) {
    for (const s of data.setups) {
      await host.call('layers.remove', { compId: data.compId, layerIds: s.made, onlyNamed: 'MOE Glass' });
      await host.call('glass.removeMap', { compId: data.compId, mapLayerIds: [s.map] });
      await host.call('layers.setAttrs', { compId: data.compId, label: 'MOE: Restore Thick Glass', items: s.sources.map((id) => ({ layerId: id, enabled: true })) });
    }
    return { ok: true };
  },

  summarize(result, ver) { return ver.ok ? `${T.THICK_LOOKS[result.look].label} thick glass on ${result.setups.reduce((n, s) => n + s.sources.length, 0)} layer(s)` : 'Thick Glass finished with problems'; }
};

/** Switch look on existing Thick Glass (select its MOE Glass N layer). */
const thickLook = {
  id: 'glass.thickLook',
  version: '1.0.0',
  category: 'compositing',
  group: 'Glass',
  name: 'Thick Glass Look',
  description: 'Apply a Thick Glass look (or a tint) to selected MOE Glass layers made by Thick Glass — only the controls change, so it stays animatable.',
  keywords: ['glass', 'thick', 'look', 'chrome', 'prism'],
  icon: 'glass',
  params: { look: thick.params.look, tint: thick.params.tint },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.effects'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Change the look/tint of existing Thick Glass (MOE Glass N with a Map).' },
  uses: { hostOps: ['props.setValues'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Apply Look', presets: thick.ui.presets },
  prepare(args, ctx) {
    if (args.tint && !/^#[0-9a-fA-F]{6}$/.test(args.tint)) return { ok: false, error: 'Tint must be #RRGGBB' };
    const names = new Set((ctx.compLayers || []).map((l) => l.name));
    const glasses = (ctx.layers || []).filter((l) => /^MOE Glass \d+$/.test(l.name) && names.has(`${l.name} Map`));
    if (!glasses.length) return { ok: false, error: 'Select a MOE Glass layer made by Thick Glass' };
    return { ok: true, glasses, preview: { summary: `${T.THICK_LOOKS[args.look].label} on ${glasses.map((g) => g.name).join(', ')}`, items: [] } };
  },
  async execute({ args, ctx, prepared, host }) {
    const vals = T.thickValues(args.look, args.tint);
    const items = prepared.glasses.flatMap((g) => T.THICK_CONTROLS.map(([name, kind, key]) => ({ address: fxAddr(g.id, name, T.KIND[kind].param), value: kind === 'color' ? hexToRgb(vals[key]).concat([1]) : vals[key] })));
    return host.call('props.setValues', { compId: ctx.comp.id, label: 'MOE: Thick Glass Look', items });
  },
  verify({ result }) { const bad = result.items.filter((i) => i.skipped); return { ok: !bad.length, checks: [{ ok: !bad.length, label: 'Controls', detail: `${result.items.length - bad.length} updated` }] }; },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, items: result.items.filter((i) => !i.skipped).map((i) => ({ address: i.address, value: i.before })) }; },
  async restore({ data, host }) { return host.call('props.setValues', { compId: data.compId, label: 'MOE: Restore Glass', items: data.items }); },
  summarize(result) { return `Thick glass look updated (${result.items.length} controls)`; }
};

module.exports = { thick, thickLook };
