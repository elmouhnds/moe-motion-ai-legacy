'use strict';
/**
 * grid.effector (v0.33, docs/features/CLONER_EFFECTORS.md) — add a MOE Effector to a MOE Grid / Cloner.
 *
 * Creates "MOE Effector N" (a null holding the effector's own controls — features/grid/effectors.js), links it
 * to the grid's first free slot (Effector · Effector 2 · Effector 3) and makes sure every item's expression is
 * the v0.33 one that reads effectors (older v0.19+ grids are rewritten in place from the facts baked into each
 * item's expression — same item, same home, same path). Optional sweep: the effector travels across the grid
 * in 2 s so the result shows at once. Restore removes the effector, unlinks the slot and puts the items'
 * expressions back.
 */
const X = require('./expressions');
const EF = require('./effectors');
const { gridFor } = require('./tools');

const TYPE_OPTIONS = EF.TYPES.map((t) => ({ value: t.id, label: t.label }));
const FALLOFF_OPTIONS = EF.FALLOFFS.map((f) => ({ value: f.id, label: f.label }));
const NAME = (n) => `MOE Effector ${n}`;
const POS = ['ADBE Transform Group', 'ADBE Position'];

function nextName(ctx) {
  const used = new Set((ctx.compLayers || []).map((l) => l.name));
  let n = 1;
  while (used.has(NAME(n))) n++;
  return NAME(n);
}

/** effects.ensure items for the effector null's controls. */
function controlItems(values) {
  return EF.CONTROLS.map(([name, kind, def]) => {
    const K = X.KIND[kind];
    let value = values[EF.KEY[name]] !== undefined ? values[EF.KEY[name]] : def;
    if (kind === 'checkbox') value = value ? 1 : 0;
    // a colour stays [r, g, b, a]; everything else is one number
    return { key: name, matchName: K.matchName, before: [], params: [{ id: name, value: kind === 'color' ? EF.rgba(value) : Number(value), names: [K.param], suffix: 1, nth: { type: K.type, n: 1 } }] };
  });
}
const slotItem = (slot, value) => ({ key: slot, matchName: X.KIND.layer.matchName, before: [], params: [{ id: slot, value, names: [X.KIND.layer.param], suffix: 1, nth: { type: X.KIND.layer.type, n: 1 } }] });
const ctlAddr = (layerId, name, kind) => ({ layerId, matchNames: ['ADBE Effect Parade', `name:${name}`, `name:${X.KIND[kind].param}`] });

const effector = {
  id: 'grid.effector',
  version: '1.0.0',
  category: 'layout',
  group: 'Grid',
  name: 'Effector',
  description: 'Add a MOE Effector to a grid or cloner: a null that moves, scales, turns or fades the items near it — Plain, Random, Step, Noise or Delay, with a Sphere, Linear, Box or Everywhere falloff. Move, rotate or scale the null to animate it; up to three per grid.',
  keywords: ['effector', 'mograph', 'cloner', 'falloff', 'field', 'random', 'step', 'noise', 'delay', 'wave', 'reveal', 'proximity', 'mcloner', 'c4d'],
  icon: 'target',
  params: {
    type: { type: 'enum', label: 'Type', default: 'plain', options: TYPE_OPTIONS, description: EF.TYPES.map((t) => `${t.label}: ${t.hint}`).join(' · ') },
    falloff: { type: 'enum', label: 'Falloff', default: 'sphere', options: FALLOFF_OPTIONS, description: 'Where it acts: around the null (Sphere / Box), on one side of its edge (Linear — move it to sweep), or on every item' },
    size: { type: 'number', label: 'Size', min: 0, max: 10000, step: 1, default: 0, unit: 'px', description: '0 = about a third of the grid', showIf: (a) => a.falloff !== 'all' },
    softness: { type: 'number', label: 'Softness', min: 0, max: 100, step: 1, default: 50, unit: '%', showIf: (a) => a.falloff === 'sphere' || a.falloff === 'box' },
    strength: { type: 'number', label: 'Strength', min: -200, max: 200, step: 1, default: 100, unit: '%' },
    invert: { type: 'boolean', label: 'Invert', default: false, advanced: true, description: 'Act outside the falloff instead of inside' },
    moveX: { type: 'number', label: 'Move X', min: -5000, max: 5000, step: 1, default: 0, unit: 'px' },
    moveY: { type: 'number', label: 'Move Y', min: -5000, max: 5000, step: 1, default: 0, unit: 'px' },
    scale: { type: 'number', label: 'Scale', min: -100, max: 1000, step: 1, default: 60, unit: '%', description: '+60 = 60 % bigger · −100 = gone' },
    rotate: { type: 'number', label: 'Rotate', min: -3600, max: 3600, step: 1, default: 0, unit: '°' },
    fade: { type: 'number', label: 'Fade', min: -100, max: 100, step: 1, default: 0, unit: '%', description: '100 = invisible where it acts' },
    seed: { type: 'integer', label: 'Seed', min: 1, max: 9999, default: 1, showIf: (a) => a.type === 'random' || a.type === 'noise' },
    delay: { type: 'number', label: 'Delay', min: 0, max: 60, step: 0.5, default: 3, unit: 'frames', description: 'Per item, in the grid order. The moves are keyframed to rest in 0.6 s from the playhead (re-key them freely) and every item plays them this much later', showIf: (a) => a.type === 'delay' },
    noiseScale: { type: 'number', label: 'Noise size', min: 1, max: 2000, step: 1, default: 100, description: 'Bigger = finer waves', showIf: (a) => a.type === 'noise' },
    noiseSpeed: { type: 'number', label: 'Noise speed', min: -1000, max: 1000, step: 1, default: 50, showIf: (a) => a.type === 'noise' },
    colour: { type: 'string', label: 'Colour', default: '#FF6A4D', maxLength: 7, format: 'color', description: 'The colour the items in reach blend toward (needs Clone Colours on the grid)', showIf: (a) => a.colourMix > 0 },
    colourMix: { type: 'number', label: 'Colour mix', min: 0, max: 100, step: 1, default: 0, unit: '%', description: '0 = no colour change · 100 = the items in reach take the colour fully (v0.34, with Clone Colours)' },
    sweep: { type: 'boolean', label: 'Sweep across', default: false, description: 'Keyframe the effector travelling across the grid in 2 s (Sphere / Box / Linear)', showIf: (a) => a.falloff !== 'all' },
    gridId: { type: 'integer', label: 'Grid', min: 0, max: 1e9, default: 0, hidden: true }
  },
  requires: { comp: true },
  permissions: ['modify.layers', 'modify.effects', 'modify.expressions'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Add a MoGraph-style effector to an existing MOE Grid / cloner (select the grid null or its items). type plain|random|step|noise|delay, falloff sphere|linear|box|all, moveX/moveY px, scale %, rotate deg, fade %. sweep animates it across.' },
  uses: { hostOps: ['layers.describe', 'layers.createNull', 'effects.ensure', 'effects.setMenu', 'props.values', 'proximity.scan', 'expressions.peek', 'expressions.set', 'keys.write', 'layers.remove'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Add Effector' },

  prepare(args, ctx) {
    const grid = gridFor(ctx, args);
    if (!grid) return { ok: false, error: 'Select a MOE Grid (its null or one of its items) — or build one with Clone / Arrange first' };
    const name = nextName(ctx);
    const t = EF.TYPES.find((x) => x.id === args.type), f = EF.FALLOFFS.find((x) => x.id === args.falloff);
    const moves = [args.moveX && `move ${args.moveX}, ${args.moveY || 0} px`, !args.moveX && args.moveY && `move Y ${args.moveY} px`, args.scale && `scale ${args.scale > 0 ? '+' : ''}${args.scale} %`, args.rotate && `rotate ${args.rotate}°`, args.fade && `fade ${args.fade} %`, args.colourMix > 0 && `colour ${args.colour} at ${args.colourMix} %`].filter(Boolean);
    if (!moves.length) return { ok: false, error: 'Give the effector something to do: Move, Scale, Rotate, Fade or Colour' };
    return {
      ok: true, grid, name,
      preview: {
        summary: `${name}: ${t.label} · ${f.label} on ${grid.name}`,
        items: [moves.join(' · '), args.type === 'delay' ? `${args.delay} frames later per item — keyframe the effector's moves` : t.hint, args.sweep ? 'Sweeps across the grid in 2 s (keyframed)' : 'Move, rotate or scale the null to animate it', 'Every control stays live on the null (Effect Controls)']
      }
    };
  },

  async execute({ args, ctx, prepared, host }) {
    const comp = ctx.comp, grid = prepared.grid;
    // 1. the grid's items and their MOE Grid expressions
    const desc = await host.call('layers.describe', { compId: comp.id });
    const kids = desc.layers.filter((l) => l.parentId === grid.id);
    if (kids.length < 1) { const e = new Error(`${grid.name} has no items`); e.code = 'NO_ITEMS'; throw e; }
    const scan = await host.call('proximity.scan', { compId: comp.id, layerIds: kids.map((l) => l.id), tag: X.TAG });
    const peek = scan.expressions.length ? await host.call('expressions.peek', { compId: comp.id, items: scan.expressions.map((a) => ({ address: a })) }) : { items: [] };
    const codes = scan.expressions.map((a, i) => ({ address: a, code: peek.items[i].expression || '' }));
    if (!codes.some((c) => X.isV2(c.code))) { const e = new Error(`${grid.name} was built before v0.19 — rebuild it (Release › Remove, then Grid Builder) to use effectors`); e.code = 'OLD_GRID'; throw e; }
    // 2. where to put the effector: the grid's centre (sweep: start left of it) and a size that fits the grid
    const pos = await host.call('props.values', { compId: comp.id, time: comp.time, items: kids.map((l) => ({ address: { layerId: l.id, matchNames: POS } })).concat([{ address: { layerId: grid.id, matchNames: POS } }]) });
    const gv = pos.items[pos.items.length - 1].value || [comp.width / 2, comp.height / 2];
    const local = pos.items.slice(0, -1).map((r) => r.value || [0, 0]);
    const ext = Math.max(50, ...local.map((p) => Math.hypot(p[0], p[1])));
    const size = args.size || Math.round(Math.max(80, ext * 0.6));
    const values = EF.valuesOf(Object.assign({}, args, { size, invert: !!args.invert }));
    const start = args.sweep ? [Math.round(gv[0] - ext - size / 2), Math.round(gv[1])] : [Math.round(gv[0]), Math.round(gv[1])];
    const created = await host.call('layers.createNull', { compId: comp.id, name: prepared.name, position: start, anchor: [0, 0], label: 2, threeD: false, undoLabel: 'MOE: Effector' });
    const controls = await host.call('effects.ensure', { compId: comp.id, label: 'MOE: Effector Controls', layers: [{ layer: { layerId: created.layerId }, items: controlItems(values) }] });
    await host.call('effects.setMenu', { compId: comp.id, layerId: created.layerId, effectKey: 'Effector Type', items: EF.TYPES.map((t) => t.menu), value: values.type });
    await host.call('effects.setMenu', { compId: comp.id, layerId: created.layerId, effectKey: 'Falloff', items: EF.FALLOFFS.map((f) => f.menu), value: values.falloff });
    // 3. link it to the first free slot of the grid
    const desc2 = await host.call('layers.describe', { compId: comp.id });
    const effIndex = (desc2.layers.find((l) => l.id === created.layerId) || {}).index;
    const slotsNow = await host.call('props.values', { compId: comp.id, time: comp.time, items: EF.SLOTS.map((s) => ({ address: ctlAddr(grid.id, s, 'layer') })) });
    const freeAt = slotsNow.items.findIndex((r) => r.error || !r.value);
    if (freeAt < 0) {
      await host.call('layers.remove', { compId: comp.id, layerIds: [created.layerId], onlyNamed: 'MOE Effector' });
      const e = new Error(`${grid.name} already has three effectors — remove one (select it and delete) or change its controls`); e.code = 'SLOTS_FULL'; throw e;
    }
    const slot = EF.SLOTS[freeAt];
    const linked = await host.call('effects.ensure', { compId: comp.id, label: 'MOE: Link Effector', layers: [{ layer: { layerId: grid.id }, items: [slotItem(slot, effIndex)] }] });
    // 4. items read effectors: rewrite older (v0.19–v0.32) item expressions as v0.33 ones — same item, home and path
    const targets = [];
    for (const c of codes) {
      if (!X.isV2(c.code) || X.isV3(c.code)) continue;
      const f = X.factsOf(c.code);
      if (!f) continue;
      const prop = Object.keys(X.PROP_ADDR).find((p) => X.PROP_ADDR[p][1] === c.address.matchNames[c.address.matchNames.length - 1]);
      if (!prop) continue;
      targets.push({ address: c.address, expression: X.buildAll(f.i, f.n, f)[prop], enabled: true });
    }
    const set = targets.length ? await host.call('expressions.set', { compId: comp.id, label: 'MOE: Grid reads effectors', revertOnError: true, targets }) : { targets: [] };
    // 5. sweep: travel across the grid in 2 s
    let keys = null;
    if (args.sweep) {
      const t0 = comp.time, t1 = comp.time + 2, end = [Math.round(gv[0] + ext + size / 2), Math.round(gv[1])];
      keys = await host.call('keys.write', { compId: comp.id, label: 'MOE: Effector Sweep', items: [{ address: { layerId: created.layerId, matchNames: POS }, keys: [{ t: t0, v: start, easeOut: { speed: 0, influence: 40 } }, { t: t1, v: end, easeIn: { speed: 0, influence: 40 } }] }] });
    }
    // 5b. Delay: the moves play once from the playhead (set value → rest in 0.6 s) — each item that much later
    let delayKeys = null;
    if (args.type === 'delay') {
      const moved = [['Move X', 'moveX', 'slider'], ['Move Y', 'moveY', 'slider'], ['Scale', 'scale', 'slider'], ['Rotate', 'rotate', 'angle'], ['Fade', 'fade', 'slider']].filter(([, k]) => values[k]);
      if (moved.length) delayKeys = await host.call('keys.write', { compId: comp.id, label: 'MOE: Effector Delay', items: moved.map(([nm, k, kind]) => ({ address: ctlAddr(created.layerId, nm, kind), keys: [{ t: comp.time, v: values[k], easeOut: { speed: 0, influence: 30 } }, { t: comp.time + 0.6, v: 0, easeIn: { speed: 0, influence: 80 } }] })) });
    }
    // 6. read back: every item still evaluates (no expression error), at the sweep's middle when there is one
    const at = args.sweep ? comp.time + 1 : comp.time;
    const read = await host.call('props.values', { compId: comp.id, time: at, items: kids.map((l) => ({ address: { layerId: l.id, matchNames: POS } })) });
    const slotRead = await host.call('props.values', { compId: comp.id, time: comp.time, items: [{ address: ctlAddr(grid.id, slot, 'layer') }] });
    return { name: prepared.name, effectorId: created.layerId, effIndex, grid: { id: grid.id, name: grid.name }, slot, slotBefore: slotsNow.items[freeAt].error ? null : (slotsNow.items[freeAt].value || 0), controls, linked, set, keys, delayKeys, read, slotRead, items: kids.length };
  },

  verify({ result }) {
    const checks = [];
    checks.push({ ok: result.controls.layers[0].items.length === EF.CONTROLS.length, label: result.name, detail: `${EF.CONTROLS.length} live controls on the null (Effect Controls)` });
    checks.push({ ok: result.slotRead.items[0].value === result.effIndex, label: 'Linked', detail: `${result.grid.name} › ${result.slot} → ${result.name}` });
    const bad = result.set.targets.filter((t) => t.skipped || t.reverted || (t.after && t.after.expressionError));
    checks.push({ ok: bad.length === 0, label: 'Items read effectors', detail: bad.length ? `${bad.length} failed: ${bad[0].after ? bad[0].after.expressionError : bad[0].skipped}` : (result.set.targets.length ? `${result.set.targets.length} expressions updated in place` : 'already up to date') });
    const errs = result.read.items.filter((r) => r.error || !r.value);
    checks.push({ ok: errs.length === 0, label: 'Read-back', detail: errs.length ? (errs[0].error || 'no value') : `${result.read.items.length} items evaluate with the effector` });
    if (result.keys) checks.push({ ok: result.keys.items[0].written.length === 2, label: 'Sweep', detail: 'travels across the grid in 2 s' });
    if (result.delayKeys) checks.push({ ok: result.delayKeys.items.every((it) => it.written.length === 2), label: 'Delay', detail: `${result.delayKeys.items.length} move(s) keyframed to rest in 0.6 s — each item plays it later` });
    return { ok: checks.every((c) => c.ok), checks };
  },

  checkpoint({ result, ctx }) {
    return {
      compId: ctx.comp.id, effectorId: result.effectorId, gridId: result.grid.id, slot: result.slot, slotBefore: result.slotBefore || 0,
      expressions: result.set.targets.filter((t) => !t.skipped && !t.reverted).map((t) => ({ address: t.address, expression: t.before.expression, enabled: t.before.expressionEnabled }))
    };
  },

  async restore({ data, host }) {
    if (data.expressions.length) await host.call('expressions.set', { compId: data.compId, label: 'MOE: Restore Grid', revertOnError: false, targets: data.expressions });
    await host.call('effects.ensure', { compId: data.compId, label: 'MOE: Unlink Effector', layers: [{ layer: { layerId: data.gridId }, items: [slotItem(data.slot, data.slotBefore)] }] });
    await host.call('layers.remove', { compId: data.compId, layerIds: [data.effectorId], onlyNamed: 'MOE Effector' });
    return { ok: true };
  },

  summarize(result, v) { return v.ok ? `${result.name} on ${result.grid.name} (${result.items} items)` : 'Effector added with problems'; }
};

module.exports = { effector, controlItems, nextName };
