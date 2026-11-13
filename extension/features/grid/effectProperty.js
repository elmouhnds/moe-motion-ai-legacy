'use strict';
/**
 * grid.effectProperty (v0.92, docs/features/EFFECTOR_ANY_PROPERTY.md — React 3 study item 8: "if it can be
 * keyframed, React can control it").
 *
 * Select a property on ONE item of a MOE Grid (Trim Paths End, Stroke Width, Roundness, an effect's slider…) and
 * this writes, on that same property of EVERY item of the grid, an expression that adds what the grid's effectors
 * give on their Custom channel:  value + ecu  — in the property's own units. The effector's *Custom* slider is the
 * amount; its falloff, type (Random, Step, Noise, Wave, Audio…), spring, Snap To and Clamp all apply, because it is
 * the same expression head the item's Position / Scale / Rotation / Opacity use (expressions.buildCustom).
 *
 * `amount` also puts a Custom slider with that value on every effector linked to the grid that has none yet, so the
 * property moves at once. Restore puts the properties' own expressions back and removes the sliders it added.
 */
const X = require('./expressions');
const EF = require('./effectors');
const S = require('../compositing/shared');
const { GRID_NAME } = require('./tools');
const { controlItems, ctlAddr } = require('./effectorTool');

const DIMS = { OneD: 1, TwoD: 2, TwoD_SPATIAL: 2, ThreeD: 3, ThreeD_SPATIAL: 3 };
const OWN = new Set(Object.values(X.PROP_ADDR).map((a) => a[1])); // Position, Scale, Rotation, Opacity have their own channels
const POSN = X.PROP_ADDR.position;
const sameProp = (a, layerId) => ({ layerId, matchNames: a.matchNames.slice(), indices: a.indices ? a.indices.slice() : undefined });
const key = (a) => `${(a.matchNames || []).join('>')}|${(a.indices || []).join(',')}`;

/** The selected properties this tool can wire, and why the others cannot. Pure (from the context). */
function pick(ctx) {
  // the property's layer is among the selected layers (they carry parentIndex); the comp's layer list gives the parent's name
  const byId = new Map((ctx.layers || []).map((l) => [l.id, l])), byIndex = new Map((ctx.compLayers || []).map((l) => [l.index, l]));
  const ok = [], no = [];
  for (const p of ctx.properties || []) {
    const L = byId.get(p.address.layerId), parent = L && L.parentIndex ? byIndex.get(L.parentIndex) : null;
    const dims = DIMS[p.valueType];
    if (!L || !parent || !GRID_NAME.test(parent.name)) { no.push(`${p.name}: its layer is not an item of a MOE Grid`); continue; }
    if (OWN.has(p.matchName)) { no.push(`${p.name}: the effector already drives it (Move / Scale / Rotate / Fade)`); continue; }
    if (!dims) { no.push(`${p.name}: only number properties (1, 2 or 3 values) — not a colour, a path or text`); continue; }
    if (!p.canSetExpression) { no.push(`${p.name}: it cannot hold an expression`); continue; }
    if (p.expression && p.expression.indexOf(X.TAG) !== 0) { no.push(`${p.name}: it has your own expression — remove it first`); continue; }
    ok.push({ name: p.name, address: p.address, dims, grid: parent, layer: L, again: !!p.expression });
  }
  return { ok, no };
}

const effectProperty = {
  id: 'grid.effectProperty',
  version: '1.0.0',
  category: 'layout',
  group: 'Grid',
  name: 'Effector on Property',
  description: 'Let a grid\'s effectors drive ANY number property of its items — Trim Paths End, Stroke Width, Roundness, a blur amount, any slider. Select that property on one item: it is wired on every item of the grid, and each effector\'s Custom slider says how much it adds, with its falloff, type, spring, Snap To and Clamp.',
  keywords: ['effector', 'property', 'any property', 'custom', 'trim paths', 'stroke', 'roundness', 'slider', 'blur', 'drive', 'link', 'everything else'],
  icon: 'target',
  params: {
    amount: { type: 'number', label: 'Amount', min: -100000, max: 100000, step: 1, default: 50, description: 'What an effector adds at full weight, in the property\'s own units (50 on Trim Paths End = +50 %). Put on the Custom slider of every linked effector that has none yet — change it there afterwards' }
  },
  requires: { comp: true },
  permissions: ['modify.expressions', 'modify.effects'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Wires the selected numeric property (on one item of a MOE Grid) to the grid\'s effectors on every item: value + the effectors\' Custom channel. amount = the Custom value set on effectors that have no Custom slider yet. Not for Position / Scale / Rotation / Opacity (they have their own channels).' },
  uses: { hostOps: ['layers.describe', 'proximity.scan', 'expressions.peek', 'props.values', 'expressions.set', 'effects.ensure', 'effects.restore'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Wire to Effectors' },

  prepare(args, ctx) {
    const { ok, no } = pick(ctx);
    if (!ok.length) return { ok: false, error: no.length ? no[0] : 'Select a property on one item of a MOE Grid — Trim Paths End, Stroke Width, a slider… (click its name in the timeline)' };
    const grids = [...new Set(ok.map((p) => p.grid.name))];
    if (grids.length > 1) return { ok: false, error: `The selected properties belong to ${grids.join(' and ')} — do one grid at a time` };
    // the same property selected on several items is one job
    const seen = new Set(), props = ok.filter((p) => { const k = key(p.address); if (seen.has(k)) return false; seen.add(k); return true; });
    return { ok: true, grid: ok[0].grid, props, skipped: no, preview: { summary: `${props.map((p) => p.name).join(', ')} on every item of ${ok[0].grid.name}`, items: [`value + what the effectors give on Custom (${props.map((p) => `${p.name}: ${p.dims} value${p.dims > 1 ? 's' : ''}`).join(' · ')})`, `Custom ${args.amount} on each linked effector that has no Custom slider yet`, 'Falloff, type, spring, Snap To and Clamp apply as for the moves'].concat(no.length ? [`Left alone: ${no.join(' · ')}`] : []) } };
  },

  explain(args, ctx, prepared) {
    const out = { target: 'A property of the grid\'s items', writes: ['One expression per item on that property, tagged // MOE Grid', 'A Custom slider on linked effectors that have none'] };
    if (prepared && prepared.ok) { out.target = `${prepared.props.map((p) => p.name).join(', ')} · ${prepared.grid.name}`; if (prepared.skipped.length) out.warnings = prepared.skipped; }
    return out;
  },

  async execute({ args, ctx, prepared, host }) {
    const comp = ctx.comp, grid = prepared.grid;
    const desc = await host.call('layers.describe', { compId: comp.id });
    const kids = desc.layers.filter((l) => l.parentId === grid.id);
    // each item's own facts (slot, home, path) from its MOE Grid Position expression
    const scan = await host.call('proximity.scan', { compId: comp.id, layerIds: kids.map((l) => l.id), tag: X.TAG });
    const posAddr = scan.expressions.filter((a) => a.matchNames[a.matchNames.length - 1] === POSN[1]);
    const peek = posAddr.length ? await host.call('expressions.peek', { compId: comp.id, items: posAddr.map((a) => ({ address: a })) }) : { items: [] };
    const facts = new Map();
    posAddr.forEach((a, i) => { const f = X.factsOf(peek.items[i].expression || ''); if (f) facts.set(a.layerId, f); });
    const items = kids.filter((l) => facts.has(l.id));
    if (!items.length) { const e = new Error(`${grid.name}'s items have no MOE Grid expression to read — rebuild the grid`); e.code = 'NO_ITEMS'; throw e; }
    // which items have that property (a clone always does; a mixed grid may not)
    const want = []; prepared.props.forEach((p) => items.forEach((l) => want.push({ p, layer: l, address: sameProp(p.address, l.id) })));
    const have = await host.call('props.values', { compId: comp.id, time: comp.time, items: want.map((w) => ({ address: w.address })) });
    const todo = want.filter((w, i) => !have.items[i].error && have.items[i].value !== null && (Array.isArray(have.items[i].value) ? have.items[i].value.length : 1) >= Math.min(w.p.dims, 1));
    const before = todo.map((w) => have.items[want.indexOf(w)].value);
    if (!todo.length) { const e = new Error(`No item of ${grid.name} has ${prepared.props.map((p) => p.name).join(' / ')}`); e.code = 'NO_PROPERTY'; throw e; }
    // the effectors linked to this grid, and which of them have no Custom slider yet
    const slots = await host.call('props.values', { compId: comp.id, time: comp.time, items: EF.SLOTS.map((s) => ({ address: ctlAddr(grid.id, s, 'layer') })) });
    const linked = slots.items.map((r) => (r.error ? 0 : r.value)).filter(Boolean).map((ix) => desc.layers.find((l) => l.index === ix)).filter((l) => l && EF.NAME.test(l.name));
    const cu = linked.length ? await host.call('props.values', { compId: comp.id, time: comp.time, items: linked.map((l) => ({ address: ctlAddr(l.id, 'Custom', 'slider') })) }) : { items: [] };
    const bare = linked.filter((l, i) => !!cu.items[i].error);
    const fx = bare.length && args.amount ? await host.call('effects.ensure', { compId: comp.id, label: 'MOE: Effector Custom', layers: bare.map((l) => ({ layer: { layerId: l.id }, items: controlItems({ custom: args.amount }, ['Custom']) })) }) : null;
    let set;
    try {
      set = await host.call('expressions.set', { compId: comp.id, label: 'MOE: Effector on Property', revertOnError: true, targets: todo.map((w) => { const f = facts.get(w.layer.id); return { address: w.address, expression: X.buildCustom(f.i, f.n, f, w.p.dims), enabled: true }; }) });
    } catch (err) {
      if (fx) await S.restoreEffects({ data: S.effectsCheckpoint(fx, ctx), host });
      throw err;
    }
    // read back: every wired property evaluates
    const read = await host.call('props.values', { compId: comp.id, time: comp.time, items: todo.map((w) => ({ address: w.address })) });
    const moved = read.items.filter((r, i) => !r.error && JSON.stringify(r.value) !== JSON.stringify(before[i])).length;
    return { grid: { id: grid.id, name: grid.name }, props: prepared.props.map((p) => p.name), wired: todo.length, items: items.length, missing: want.length - todo.length, effectors: linked.map((l) => l.name), added: bare.filter(() => !!fx).map((l) => l.name), amount: args.amount, set, fx, read, moved };
  },

  verify({ result }) {
    const bad = result.set.targets.filter((t) => t.skipped || t.reverted || (t.after && t.after.expressionError));
    const errs = result.read.items.filter((r) => r.error || r.value === null);
    const checks = [
      { ok: bad.length === 0, label: result.props.join(', '), detail: bad.length ? `${bad.length} failed: ${bad[0].after ? bad[0].after.expressionError : bad[0].skipped}` : `wired on ${result.wired} propert${result.wired === 1 ? 'y' : 'ies'} of ${result.items} items${result.missing ? ` (${result.missing} item(s) do not have it)` : ''}` },
      { ok: errs.length === 0, label: 'Read-back', detail: errs.length ? (errs[0].error || 'no value') : `${result.read.items.length} evaluate` },
      { ok: true, label: 'Effectors', detail: !result.effectors.length ? 'none linked yet — add an effector and set its Custom slider (More Sliders › Any property)' : result.added.length ? `Custom ${result.amount} added to ${result.added.join(', ')} — ${result.moved} value(s) changed at the playhead` : `${result.effectors.join(', ')} already ha${result.effectors.length === 1 ? 's' : 've'} a Custom slider — left as set` }
    ];
    return { ok: checks.every((c) => c.ok), checks };
  },

  checkpoint({ result, ctx }) {
    return { compId: ctx.comp.id, fx: result.fx ? S.effectsCheckpoint(result.fx, ctx) : null, expressions: result.set.targets.filter((t) => !t.skipped && !t.reverted).map((t) => ({ address: t.address, expression: t.before.expression, enabled: t.before.expressionEnabled })) };
  },
  async restore({ data, host }) {
    if (data.expressions.length) await host.call('expressions.set', { compId: data.compId, label: 'MOE: Restore', revertOnError: false, targets: data.expressions });
    if (data.fx) await S.restoreEffects({ data: data.fx, host });
    return { ok: true };
  },
  summarize(result, v) { return v.ok ? `${result.props.join(', ')} follows the effectors on ${result.items} items` : 'Wired with problems'; }
};

module.exports = { effectProperty, pick };
