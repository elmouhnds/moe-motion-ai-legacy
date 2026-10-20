'use strict';
/** Proximity tools (ProximityPro-style): effector null + distance-driven expressions. */
const X = require('./expressions');
const S = require('../compositing/shared');

const EFFECTOR = /^MOE Effector \d+$/;
const FEATURE_PARAMS = {};
for (const [k, f] of Object.entries(X.FEATURES)) {
  FEATURE_PARAMS[k] = { type: 'boolean', label: f.label, default: k === 'scaleUp', grid: true, description: f.threeD ? '3D layers only' : '' };
}

function controlsSpec(radius) {
  return X.CONTROLS.map(([name, matchName, param, def]) => ({
    key: name, matchName, before: [],
    params: [{ id: name, value: name === 'Proximity Radius' ? radius : def, names: [param], suffix: 1, nth: { type: param === 'Color' ? 'COLOR' : 'OneD', n: 1 } }]
  }));
}

const apply = {
  id: 'proximity.apply',
  version: '1.0.0',
  category: 'motion',
  group: 'Proximity',
  name: 'Proximity',
  description: 'Drive selected layers by distance to an effector null: scale, push, offset, rotate, look-at, fade, blur, colour. Every amount lives on the effector in Effect Controls.',
  keywords: ['proximity', 'effector', 'distance', 'push away', 'falloff', 'field', 'react', 'magnet'],
  icon: 'target',
  params: Object.assign({
    radius: { type: 'number', label: 'Radius', min: 10, max: 4000, step: 10, default: 400, unit: 'px', description: 'Initial Proximity Radius (editable on the effector)' },
    distance3D: { type: 'boolean', label: '3D distance', default: false, advanced: true, description: 'Measure distance in 3D (include Z)' },
    replace: { type: 'boolean', label: 'Replace existing', default: false, advanced: true, description: 'Overwrite expressions that MOE did not create' }
  }, FEATURE_PARAMS),
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers', 'modify.effects', 'modify.expressions'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Proximity/effector reactions: layers react to a moving null (scale up near it, push away, fade, look at). Select the effector null too to reuse it.' },
  uses: { hostOps: ['layers.createNull', 'effects.ensure', 'expressions.set', 'expressions.peek'], network: false },
  compatibility: { minAE: '25.0' },
  ui: {
    primaryLabel: 'Apply Proximity',
    presets: [
      { id: 'grow', label: 'Grow', args: { scaleUp: true, scaleDown: false, pushAway: false, fadeOpacity: false, revealOpacity: false } },
      { id: 'repel', label: 'Repel', args: { scaleUp: false, pushAway: true, pullToward: false } },
      { id: 'magnet', label: 'Magnet', args: { scaleUp: false, pushAway: false, pullToward: true } },
      { id: 'spotlight', label: 'Spotlight', args: { scaleUp: true, revealOpacity: true, fadeOpacity: false } },
      { id: 'watchers', label: 'Look At', args: { scaleUp: false, lookAt2D: true } }
    ]
  },

  prepare(args, ctx) {
    const effectors = (ctx.layers || []).filter((l) => EFFECTOR.test(l.name));
    if (effectors.length > 1) return { ok: false, error: 'Select only one MOE Effector' };
    const targets = (ctx.layers || []).filter((l) => !EFFECTOR.test(l.name) && !['camera', 'light'].includes(l.type));
    const locked = targets.filter((l) => l.locked);
    const usable = targets.filter((l) => !l.locked);
    if (!usable.length) return { ok: false, error: 'Select the layers that should react' };
    const features = {};
    for (const k of Object.keys(X.FEATURES)) features[k] = !!args[k];
    if (!Object.values(features).some(Boolean)) return { ok: false, error: 'Choose at least one reaction' };
    const test = X.build('MOE Effector 1', features, { threeD: true });
    if (test.errors.length) return { ok: false, error: test.errors.join(' · ') };
    let effector = effectors[0] || null;
    let newName = null;
    if (!effector) {
      const used = new Set((ctx.compLayers || []).map((l) => l.name));
      let n = 1;
      while (used.has(`MOE Effector ${n}`)) n++;
      newName = `MOE Effector ${n}`;
    }
    const on = Object.keys(features).filter((k) => features[k]).map((k) => X.FEATURES[k].label);
    return {
      ok: true, features, usable, effector, newName,
      preview: {
        summary: `${on.join(' + ')} on ${usable.length} layer${usable.length > 1 ? 's' : ''} · ${effector ? effector.name : `new ${newName}`}`,
        items: [...usable.slice(0, 6).map((l) => l.name + (l.threeD ? ' (3D)' : '')), ...(usable.length > 6 ? [`+${usable.length - 6} more`] : []), ...locked.map((l) => `Skipped: ${l.name} (locked)`)]
      }
    };
  },

  async execute({ args, ctx, prepared, host }) {
    let effector = prepared.effector;
    let created = null;
    if (!effector) {
      created = await host.call('layers.createNull', { compId: ctx.comp.id, name: prepared.newName, position: [ctx.comp.width / 2, ctx.comp.height / 2], label: 9 });
      effector = { id: created.layerId, name: created.name };
    }
    const controls = await S.writeEffects(host, ctx, [{ layer: { layerId: effector.id }, items: controlsSpec(args.radius) }], 'MOE: Effector Controls');

    // Effects needed on targets (blur / colour) — created before expressions reference them.
    const fxItems = [];
    if (prepared.features.blur) fxItems.push({ key: 'MOE Prox Blur', matchName: 'ADBE Gaussian Blur 2', before: [], params: [] });
    if (prepared.features.colorShift) fxItems.push({ key: 'MOE Prox Color', matchName: 'ADBE Tint', before: [], params: [] });
    const targetFx = fxItems.length ? await S.writeEffects(host, ctx, prepared.usable.filter((l) => l.type !== 'null').map((l) => ({ layer: { layerId: l.id }, items: fxItems })), 'MOE: Proximity Effects') : null;

    const items = [];
    const skipped = [];
    for (const l of prepared.usable) {
      const b = X.build(effector.name, prepared.features, { threeD: l.threeD, distance3D: args.distance3D });
      for (const [prop, code] of Object.entries(b.expressions)) {
        if ((prop === 'blur' || prop === 'color') && l.type === 'null') continue;
        items.push({ layer: l, prop, address: { layerId: l.id, matchNames: X.PROP_ADDR[prop] }, expression: code });
      }
      if (b.skipped.length) skipped.push(`${l.name}: ${b.skipped.map((k) => X.FEATURES[k].label).join(', ')} (2D layer)`);
    }
    const peek = await host.call('expressions.peek', { compId: ctx.comp.id, items: items.map((i) => ({ address: i.address })) });
    const conflicts = items.filter((it, i) => peek.items[i].expression && !peek.items[i].expression.startsWith(X.TAG));
    if (conflicts.length && !args.replace) {
      const e = new Error(`These properties already have your own expressions: ${conflicts.map((c) => `${c.layer.name} › ${c.prop}`).join(', ')}. Turn on "Replace existing" to overwrite (restorable).`);
      e.code = 'EXPRESSION_CONFLICT';
      throw e;
    }
    const set = await host.call('expressions.set', { compId: ctx.comp.id, label: 'MOE: Proximity', revertOnError: true, targets: items.map((i) => ({ address: i.address, expression: i.expression, enabled: true })) });
    return { effector, created, controls, targetFx, set, skipped, count: items.length };
  },

  verify({ result }) {
    const checks = [];
    checks.push({ ok: true, label: result.effector.name, detail: result.created ? 'effector created at comp centre' : 'existing effector reused' });
    const ctlCount = result.controls.layers[0].items.length;
    checks.push({ ok: ctlCount === X.CONTROLS.length, label: `${result.effector.name} › controls`, detail: `${ctlCount} controls in Effect Controls` });
    for (const t of result.set.targets) {
      if (t.skipped) { checks.push({ ok: false, label: 'Property', detail: t.skipped }); continue; }
      const ok = !t.after.expressionError && !t.reverted;
      checks.push({ ok, label: `${t.layerName} › ${t.name}`, detail: ok ? 'expression active, no engine errors' : `${t.after.expressionError} — reverted` });
    }
    for (const s of result.skipped) checks.push({ ok: true, label: 'Skipped', detail: s });
    return { ok: checks.every((c) => c.ok), checks };
  },

  checkpoint({ result, ctx }) {
    return {
      compId: ctx.comp.id,
      expressions: result.set.targets.filter((t) => !t.skipped && !t.reverted).map((t) => ({ address: t.address, expression: t.before.expression, enabled: t.before.expressionEnabled })),
      targetFx: result.targetFx ? S.effectsCheckpoint(result.targetFx, ctx) : null,
      effectorControls: S.effectsCheckpoint(result.controls, ctx),
      createdEffector: result.created ? result.created.layerId : null
    };
  },

  async restore({ data, host }) {
    if (data.expressions.length) await host.call('expressions.set', { compId: data.compId, label: 'MOE: Restore Proximity', revertOnError: false, targets: data.expressions });
    if (data.targetFx) await S.restoreEffects({ data: data.targetFx, host });
    if (data.createdEffector) await host.call('layers.remove', { compId: data.compId, layerIds: [data.createdEffector], onlyNamed: 'MOE Effector' });
    else await S.restoreEffects({ data: data.effectorControls, host });
    return { ok: true };
  },

  summarize(result, v) { return v.ok ? `Proximity on ${result.set.targets.length} propert${result.set.targets.length === 1 ? 'y' : 'ies'} · ${result.effector.name}` : 'Proximity finished with problems'; }
};

const remove = {
  id: 'proximity.remove',
  version: '1.0.0',
  category: 'motion',
  group: 'Proximity',
  name: 'Remove Proximity',
  description: 'Remove MOE Proximity expressions and effects from the selected layers, or from the whole comp.',
  keywords: ['remove', 'proximity', 'clear', 'effector'],
  icon: 'trash',
  params: { scope: { type: 'enum', label: 'Scope', default: 'selected', options: [{ value: 'selected', label: 'Selected' }, { value: 'all', label: 'Whole comp' }] } },
  requires: { comp: true },
  permissions: ['modify.expressions', 'modify.effects'],
  destructive: true,
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Only when asked to remove proximity setups.' },
  uses: { hostOps: ['proximity.scan', 'expressions.set', 'effects.restore'], network: false },
  compatibility: { minAE: '25.0' },
  prepare(args, ctx) {
    if (args.scope === 'selected' && !(ctx.layers || []).length) return { ok: false, error: 'Select layers (or choose Whole comp)' };
    return { ok: true, preview: { summary: args.scope === 'all' ? 'Remove all MOE Proximity in this comp' : `Remove MOE Proximity from ${ctx.layers.length} layer(s)`, items: [] } };
  },
  async execute({ args, ctx, host }) {
    const scan = await host.call('proximity.scan', { compId: ctx.comp.id, layerIds: args.scope === 'all' ? null : ctx.layers.map((l) => l.id), tag: X.TAG });
    const set = scan.expressions.length ? await host.call('expressions.set', { compId: ctx.comp.id, label: 'MOE: Remove Proximity', revertOnError: false, targets: scan.expressions.map((a) => ({ address: a, expression: '', enabled: false })) }) : { targets: [] };
    const fx = scan.effects.length ? await host.call('effects.restore', { compId: ctx.comp.id, label: 'MOE: Remove Proximity', layers: scan.effects.map((e) => ({ layer: { layerId: e.layerId }, items: [{ key: e.key, matchName: e.matchName, created: true, params: [] }] })) }) : { removed: 0 };
    return { set, fx, scan };
  },
  verify({ result }) {
    const left = result.set.targets.filter((t) => t.final && t.final.expression !== '');
    return { ok: left.length === 0, checks: [{ ok: left.length === 0, label: 'Expressions', detail: `${result.set.targets.length} removed` }, { ok: true, label: 'Effects', detail: `${result.fx.removed} MOE Prox effect(s) removed (Edit › Undo brings them back)` }] };
  },
  checkpoint({ result, ctx }) {
    return { compId: ctx.comp.id, expressions: result.set.targets.filter((t) => !t.skipped).map((t) => ({ address: t.address, expression: t.before.expression, enabled: t.before.expressionEnabled })) };
  },
  async restore({ data, host }) { return host.call('expressions.set', { compId: data.compId, label: 'MOE: Restore Proximity', revertOnError: false, targets: data.expressions }); },
  summarize(result) { return `Removed ${result.set.targets.length} proximity expression(s)`; }
};

const centerAnchor = {
  id: 'proximity.centerAnchor',
  version: '1.0.0',
  category: 'motion',
  group: 'Proximity',
  name: 'Center Anchor',
  description: 'Move each layer’s anchor point to the centre of its content without moving the layer (distance is measured from the anchor).',
  keywords: ['anchor', 'center', 'centre', 'pivot'],
  icon: 'target',
  params: {},
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Centre anchor points (useful before proximity or rotation).' },
  uses: { hostOps: ['layers.centerAnchor', 'layers.restoreTransform'], network: false },
  compatibility: { minAE: '25.0' },
  prepare(args, ctx) { return { ok: true, preview: { summary: `Center anchor on ${ctx.layers.length} layer(s)`, items: [] } }; },
  async execute({ ctx, host }) { return host.call('layers.centerAnchor', { compId: ctx.comp.id, layers: ctx.layers.map((l) => l.id) }); },
  verify({ result }) {
    return { ok: result.layers.every((L) => !L.skipped), checks: result.layers.map((L) => ({ ok: !L.skipped, label: L.name, detail: L.skipped ? `skipped: ${L.skipped === 'KEYFRAMED' ? 'anchor/position keyframed or separated' : L.skipped}` : `anchor ${L.after.anchor.map((v) => v.toFixed(1)).join(', ')}` })) };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, layers: result.layers.filter((L) => !L.skipped).map((L) => ({ layerId: L.layerId, anchor: L.before.anchor, position: L.before.position })) }; },
  async restore({ data, host }) { return host.call('layers.restoreTransform', data); },
  summarize(result) { return `Centered ${result.layers.filter((L) => !L.skipped).length} anchor(s)`; }
};

module.exports = { apply, remove, centerAnchor, EFFECTOR };
