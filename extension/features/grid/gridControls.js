'use strict';
/**
 * grid.controls (v0.93, docs/features/CONTROLS_ON_DEMAND.md) — add a group of controls to a MOE Grid null.
 *
 * Since v0.93 a grid arrives with only the controls it uses. This adds the others when you want them in Effect
 * Controls: one group (the other layouts' own controls · Morph · Reverse / Seed · Scale step / Twist / Orient ·
 * Random · Build · the simple effector) or all. Only controls that are NOT there are added, with the values the
 * grid was built with — the numbers its item expressions already use for them (DFT) — so nothing moves.
 * Restore removes exactly what was added.
 */
const X = require('./expressions');
const L = require('./layouts');
const S = require('../compositing/shared');
const { gridFor } = require('./tools');

const GROUPS = ['all', 'layouts'].concat(Object.keys(X.GRID_GROUPS));
const LABEL = Object.assign({ all: 'All' }, X.GRID_GROUP_LABEL);
const MENUS = { Layout: X.MODE_MENU, 'Morph To': X.MODE_MENU, Orient: L.ORIENTS, Order: L.ORDERS, 'Build Order': L.BUILD_ORDERS, 'Build Style': L.BUILD_STYLES };
const KINDS = new Map(X.allControls().map((c) => [c[0], c]));

const controls = {
  id: 'grid.controls',
  version: '1.0.0',
  category: 'layout',
  group: 'Grid',
  name: 'Grid Sliders',
  description: 'Add more sliders to a MOE Grid null in Effect Controls. A grid arrives with only the controls it uses; this adds a group when you want it — the other layouts, Morph, Reverse and Seed, Scale step / Twist / Orient, Random, Build, the simple effector — or all of them. Only missing controls are added, with the values the grid was built with, so nothing moves.',
  keywords: ['grid', 'cloner', 'controls', 'sliders', 'effect controls', 'more', 'show all', 'build', 'random', 'morph', 'twist'],
  icon: 'sliders',
  params: {
    group: { type: 'enum', label: 'Add', default: 'all', options: GROUPS.map((g) => ({ value: g, label: LABEL[g] })), description: Object.keys(X.GRID_GROUPS).map((g) => `${LABEL[g]}: ${X.GRID_GROUPS[g].join(', ')}`).join(' · ') },
    gridId: { type: 'integer', label: 'Grid', min: 0, max: 1e9, default: 0, hidden: true }
  },
  requires: { comp: true },
  permissions: ['modify.effects'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Adds missing slider groups to a MOE Grid null (select it or one of its items). group all|layouts|morph|order|items|random|build|falloff. Never changes a control that is already there.' },
  uses: { hostOps: ['layers.describe', 'proximity.scan', 'expressions.peek', 'props.values', 'effects.ensure', 'effects.setMenu', 'effects.restore'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Add Sliders' },

  prepare(args, ctx) {
    const grid = gridFor(ctx, args);
    if (!grid) return { ok: false, error: 'Select a MOE Grid (its null or one of its items)' };
    return { ok: true, grid, preview: { summary: `${LABEL[args.group] || 'All'} on ${grid.name}`, items: ['Only the ones that are not there yet are added', 'They get the values the grid was built with — nothing moves'] } };
  },
  explain(args, ctx, prepared) {
    const out = { target: 'MOE Grid null', writes: ['Slider / Angle / Menu / Checkbox controls in Effect Controls', 'No expression, key or existing control is changed'] };
    if (prepared && prepared.ok) out.target = prepared.grid.name;
    return out;
  },

  async execute({ args, ctx, prepared, host }) {
    const comp = ctx.comp, grid = prepared.grid;
    // the grid's own defaults and its layout, from one item's expression and the Layout control
    const desc = await host.call('layers.describe', { compId: comp.id });
    const kids = desc.layers.filter((l) => l.parentId === grid.id);
    const scan = kids.length ? await host.call('proximity.scan', { compId: comp.id, layerIds: kids.map((l) => l.id), tag: X.TAG }) : { expressions: [] };
    const peek = scan.expressions.length ? await host.call('expressions.peek', { compId: comp.id, items: [{ address: scan.expressions[0] }] }) : { items: [] };
    const facts = peek.items.length ? X.factsOf(peek.items[0].expression || '') : null;
    const dft = (facts && facts.defaults) || X.gridDefaults(null);
    const lay = await host.call('props.values', { compId: comp.id, time: comp.time, items: [{ address: X.controlAddress(grid.id, 'Layout') }] });
    const mode = L.modeAt(Number(lay.items[0].value) || 1);
    const names = X.gridGroupNames(args.group, mode).filter((n) => KINDS.has(n));
    const have = await host.call('props.values', { compId: comp.id, time: comp.time, items: names.map((n) => ({ address: X.controlAddress(grid.id, n) })) });
    const missing = names.filter((n, i) => !!have.items[i].error);
    let fx = null;
    if (missing.length) {
      fx = await host.call('effects.ensure', { compId: comp.id, label: 'MOE: Grid Sliders', layers: [{ layer: { layerId: grid.id }, items: missing.map((n) => { const c = KINDS.get(n), K = X.KIND[c[1]]; return { key: n, matchName: K.matchName, before: [], params: [{ id: n, value: c[1] === 'layer' ? 0 : Number(dft[n] !== undefined ? dft[n] : c[2]) || 0, names: [K.param], suffix: 1, nth: { type: K.type, n: 1 } }] }; }) }] });
      for (const n of missing) if (MENUS[n]) await host.call('effects.setMenu', { compId: comp.id, layerId: grid.id, effectKey: n, items: MENUS[n], value: Number(dft[n]) || 1 });
    }
    const read = await host.call('props.values', { compId: comp.id, time: comp.time, items: names.map((n) => ({ address: X.controlAddress(grid.id, n) })) });
    return { grid: { id: grid.id, name: grid.name }, names, added: missing, fx, read, mode };
  },

  verify({ result }) {
    const bad = result.read.items.filter((r) => r.error);
    const checks = [
      { ok: true, label: result.grid.name, detail: result.added.length ? `added ${result.added.join(', ')}` : 'already had them — nothing added' },
      { ok: bad.length === 0, label: 'Read-back', detail: bad.length ? `${bad.length} control(s) still missing: ${bad[0].error}` : `${result.names.length} control(s) answer` }
    ];
    return { ok: checks.every((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, fx: result.fx ? S.effectsCheckpoint(result.fx, ctx) : null }; },
  async restore({ data, host }) { if (data.fx) await S.restoreEffects({ data: data.fx, host }); return { ok: true }; },
  summarize(result, v) { return v.ok ? (result.added.length ? `${result.added.length} control(s) added to ${result.grid.name}` : 'Those controls were already there') : 'Sliders added with problems'; }
};

module.exports = { controls };
