'use strict';
/**
 * grid.colour (v0.34, docs/features/CLONE_COLOURS.md) — a colour for every item of a MOE Grid / Cloner.
 *
 * The grid null gets Colour Mode (Cycle · Gradient · Random), Colour 1–4 (live Color Controls: change the
 * palette in Effect Controls) and Colour Seed. Every item gets one "MOE Clone Colour" Fill effect whose Color
 * reads them (features/grid/effectors.js colourCode — the item's own slot) and blends toward each linked MOE
 * Effector's Colour by its falloff × Colour Mix. Run it again to change the palette or the mode (updated in
 * place, never duplicated). Restore removes the Fill effects and puts the grid's controls back.
 */
const X = require('./expressions');
const EF = require('./effectors');
const PAL = require('../design/palettes');
const S = require('../compositing/shared');
const { gridFor } = require('./tools');

const MODE_OPTIONS = EF.COLOUR_MODES.map((m) => ({ value: m.id, label: m.label }));
const PALETTE_OPTIONS = PAL.PALETTES.map((p) => ({ value: p.id, label: p.name }));
const ctl = (kind) => X.KIND[kind];

/** The four colours a palette gives the items: its accents first (a palette's first colour is its dark base). */
function paletteFour(id) {
  const p = PAL.byId(id) || PAL.PALETTES[0];
  return p.colors.slice(1, 5).map((h) => EF.rgba(h));
}

function gridItems(controls) {
  return EF.COLOUR_CONTROLS.map(([name, kind]) => {
    const K = ctl(kind);
    return { key: name, matchName: K.matchName, before: [], params: [{ id: name, value: controls[name], names: [K.param], suffix: 1, nth: { type: K.type, n: 1 } }] };
  });
}

const colour = {
  id: 'grid.colour',
  version: '1.0.0',
  category: 'layout',
  group: 'Grid',
  name: 'Clone Colours',
  description: 'Give every item of a MOE Grid or Cloner its own colour from a palette — Cycle, Gradient or Random — with the four colours live on the grid null. Effectors with Colour Mix then tint the items they reach.',
  keywords: ['colour', 'color', 'palette', 'cloner', 'clone', 'gradient', 'random', 'cycle', 'tint', 'mograph', 'shader'],
  icon: 'palette',
  params: {
    mode: { type: 'enum', label: 'Mode', default: 'cycle', options: MODE_OPTIONS, description: EF.COLOUR_MODES.map((m) => `${m.label}: ${m.hint}`).join(' · ') },
    palette: { type: 'enum', label: 'Palette', default: 'tomato', options: PALETTE_OPTIONS, description: 'Its four accent colours become Colour 1–4 on the grid null (edit them there)' },
    seed: { type: 'integer', label: 'Seed', min: 1, max: 9999, default: 1, showIf: (a) => a.mode === 'random' },
    gridId: { type: 'integer', label: 'Grid', min: 0, max: 1e9, default: 0, hidden: true }
  },
  requires: { comp: true },
  permissions: ['modify.effects', 'modify.expressions'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Colour the items of an existing MOE Grid / cloner (select the grid null or an item): mode cycle|gradient|random, palette = a MOE palette id. Effectors with colourMix > 0 then tint the items they reach.' },
  uses: { hostOps: ['layers.describe', 'proximity.scan', 'expressions.peek', 'effects.ensure', 'effects.setMenu', 'expressions.set', 'props.values', 'effects.restore'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Colour Clones' },

  prepare(args, ctx) {
    const grid = gridFor(ctx, args);
    if (!grid) return { ok: false, error: 'Select a MOE Grid (its null or one of its items) — or build one with Clone / Arrange first' };
    const m = EF.COLOUR_MODES.find((x) => x.id === args.mode);
    const pal = PAL.byId(args.palette);
    return { ok: true, grid, preview: { summary: `${grid.name}: ${m.label} colours from ${pal ? pal.name : args.palette}`, items: [m.hint, 'Colour 1–4 stay live on the grid null (Effect Controls)', 'Each item gets one "MOE Clone Colour" Fill effect (restorable)'] } };
  },

  async execute({ args, ctx, prepared, host }) {
    const comp = ctx.comp, grid = prepared.grid;
    const desc = await host.call('layers.describe', { compId: comp.id });
    const kids = desc.layers.filter((l) => l.parentId === grid.id);
    const scan = kids.length ? await host.call('proximity.scan', { compId: comp.id, layerIds: kids.map((l) => l.id), tag: X.TAG }) : { expressions: [] };
    const peek = scan.expressions.length ? await host.call('expressions.peek', { compId: comp.id, items: scan.expressions.map((a) => ({ address: a })) }) : { items: [] };
    // each item's slot (i of n) from its own grid expression
    const slots = new Map();
    scan.expressions.forEach((a, k) => { const f = X.slotOf(peek.items[k].expression); if (f && !slots.has(a.layerId)) slots.set(a.layerId, f); });
    const items = kids.filter((l) => slots.has(l.id));
    if (items.length < 1) { const e = new Error(`${grid.name} has no grid items to colour`); e.code = 'NO_ITEMS'; throw e; }
    // 1. the grid null's colour controls
    const four = paletteFour(args.palette);
    const modeIdx = EF.COLOUR_MODES.findIndex((m) => m.id === args.mode) + 1;
    const controls = { 'Colour Mode': modeIdx, 'Colour 1': four[0], 'Colour 2': four[1], 'Colour 3': four[2], 'Colour 4': four[3], 'Colour Seed': args.seed };
    const onGrid = await host.call('effects.ensure', { compId: comp.id, label: 'MOE: Clone Colours', layers: [{ layer: { layerId: grid.id }, items: gridItems(controls) }] });
    await host.call('effects.setMenu', { compId: comp.id, layerId: grid.id, effectKey: 'Colour Mode', items: EF.COLOUR_MODES.map((m) => m.menu), value: modeIdx });
    // 2. one Fill per item, its Color driven by the expression
    const fills = await host.call('effects.ensure', { compId: comp.id, label: 'MOE: Clone Colours', layers: items.map((l) => ({ layer: { layerId: l.id }, items: [{ key: EF.COLOUR_FX, matchName: 'ADBE Fill', before: [], params: [{ id: 'Color', value: four[0], names: ['Color', 'Colour'], nth: { type: 'COLOR', n: 1 } }] }] })) });
    const addr = (l) => ({ layerId: l.id, matchNames: ['ADBE Effect Parade', `name:${EF.COLOUR_FX}`, 'name:Color'] });
    const set = await host.call('expressions.set', { compId: comp.id, label: 'MOE: Clone Colours', revertOnError: true, targets: items.map((l) => { const f = slots.get(l.id); return { address: addr(l), expression: EF.colourCode(f.i, f.n, grid.name), enabled: true }; }) });
    // 3. read back: every item's colour, against the reference (no effector colour mixes in at build)
    const read = await host.call('props.values', { compId: comp.id, time: comp.time, items: items.map((l) => ({ address: addr(l) })) });
    const expected = items.map((l) => { const f = slots.get(l.id); return EF.paletteColour(modeIdx, four, f.i, f.n, args.seed); });
    return { grid: { id: grid.id, name: grid.name }, mode: args.mode, onGrid, fills, set, read, expected, items: items.map((l) => ({ id: l.id, name: l.name })) };
  },

  verify({ result }) {
    const checks = [];
    checks.push({ ok: result.onGrid.layers[0].items.length === EF.COLOUR_CONTROLS.length, label: result.grid.name, detail: 'Colour Mode, Colour 1–4 and Colour Seed live on the grid null' });
    const bad = result.set.targets.filter((t) => t.skipped || t.reverted || (t.after && t.after.expressionError));
    checks.push({ ok: bad.length === 0, label: 'Expressions', detail: bad.length ? `${bad.length} failed: ${bad[0].after ? bad[0].after.expressionError : bad[0].skipped}` : `${result.set.targets.length} item colours live` });
    // every item must evaluate; an item an effector already tints differs from the palette on purpose, and the report says how many
    const missing = result.read.items.filter((r) => r.error || !r.value);
    const exact = result.read.items.filter((r, k) => r.value && [0, 1, 2].every((c) => Math.abs(r.value[c] - result.expected[k][c]) < 0.02)).length;
    checks.push({ ok: missing.length === 0, label: 'Read-back', detail: missing.length ? (missing[0].error || 'no value') : (exact === result.read.items.length ? `${exact} colours match the palette` : `${exact} match the palette, ${result.read.items.length - exact} tinted by an effector's Colour Mix`) });
    return { ok: checks.every((c) => c.ok), checks };
  },

  checkpoint({ result, ctx }) {
    return {
      effects: { compId: ctx.comp.id, layers: S.effectsCheckpoint(result.onGrid, ctx).layers.concat(S.effectsCheckpoint(result.fills, ctx).layers) },
      compId: ctx.comp.id,
      expressions: result.set.targets.filter((t) => !t.skipped && !t.reverted && t.before && t.before.expression).map((t) => ({ address: t.address, expression: t.before.expression, enabled: t.before.expressionEnabled }))
    };
  },

  async restore({ data, host }) {
    if (data.expressions.length) await host.call('expressions.set', { compId: data.compId, label: 'MOE: Restore Clone Colours', revertOnError: false, targets: data.expressions });
    await S.restoreEffects({ data: data.effects, host });
    return { ok: true };
  },

  summarize(result, v) { return v.ok ? `${result.grid.name}: ${result.items.length} items coloured (${result.mode})` : 'Clone colours with problems'; }
};

module.exports = { colour, paletteFour };
