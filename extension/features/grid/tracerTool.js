'use strict';
/**
 * grid.tracer (v0.91, docs/features/TRACER.md) — draw lines between a MOE Grid's items that follow them.
 * The plan (which items each line joins) is features/grid/tracer.js; this file reads the grid, makes the shape
 * layer with shapes.insert, writes one Path expression per line and reads the paths back.
 */
const X = require('./expressions');
const TR = require('./tracer');
const { gridFor } = require('./tools');

const POS = ['ADBE Transform Group', 'ADBE Position'];
const NAME = (grid) => `MOE Tracer · ${grid}`.slice(0, 120);
const pathAddr = (layerId, i) => ({ layerId, matchNames: ['ADBE Root Vectors Group', 'ADBE Vector Group', 'ADBE Vectors Group', 'ADBE Vector Shape - Group', 'ADBE Vector Shape'], indices: [null, 1, null, i, null] });

const tracer = {
  id: 'grid.tracer',
  version: '1.0.0',
  category: 'layout',
  group: 'Grid',
  name: 'Tracer',
  description: 'Connect a grid\'s items with lines that follow them — through effectors, springs and the grid\'s own controls. In order (one line through all), Rows, Grid (rows and columns), Zig-zag or Hub (from the middle item to every other). The lines are one shape layer; run it again after changing the grid\'s columns and it replaces itself.',
  keywords: ['tracer', 'lines', 'connect', 'wire', 'network', 'mesh', 'grid lines', 'plexus', 'links', 'join', 'snake', 'zigzag'],
  icon: 'guides',
  params: {
    mode: { type: 'enum', label: 'Lines', tileFixed: true, default: 'order', options: TR.MODES.map((m) => ({ value: m.id, label: m.label })), description: TR.MODES.map((m) => `${m.label}: ${m.hint}`).join(' · ') },
    closed: { type: 'boolean', label: 'Close the line', default: false, description: 'Join the last item back to the first', showIf: (a) => a.mode === 'order' },
    width: { type: 'number', label: 'Width', min: 0.5, max: 100, step: 0.5, default: 2, unit: 'px' },
    colour: { type: 'string', label: 'Colour', default: '#FFFFFF', maxLength: 7, format: 'color' },
    opacity: { type: 'number', label: 'Opacity', min: 1, max: 100, step: 1, default: 70, unit: '%', advanced: true },
    behind: { type: 'boolean', label: 'Behind the items', default: true, advanced: true, description: 'Put the lines under the grid\'s items in the timeline' },
    gridId: { type: 'integer', label: 'Grid', min: 0, max: 1e9, default: 0, hidden: true }
  },
  requires: { comp: true },
  permissions: ['modify.layers', 'modify.expressions'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Lines between the items of an existing MOE Grid / cloner (select the grid null or an item). mode order|rows|grid|zigzag|hub; closed (order only); width px; colour #RRGGBB.' },
  uses: { hostOps: ['layers.describe', 'proximity.scan', 'expressions.peek', 'props.values', 'layers.remove', 'shapes.insert', 'expressions.set', 'layers.move'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Draw Tracer' },

  prepare(args, ctx) {
    const grid = gridFor(ctx, args);
    if (!grid) return { ok: false, error: 'Select a MOE Grid (its null or one of its items) — or build one with Clone / Arrange first' };
    const m = TR.MODES.find((x) => x.id === args.mode) || TR.MODES[0];
    const again = (ctx.compLayers || []).some((l) => l.name === NAME(grid.name));
    return { ok: true, grid, name: NAME(grid.name), replaces: again, preview: { summary: `${m.label} lines on ${grid.name}`, items: [m.hint, `One shape layer: ${NAME(grid.name)}`, 'The lines follow the items — effectors and springs included', again ? 'Replaces the tracer this grid already has' : 'Run it again after changing the grid\'s columns'] } };
  },

  explain(args, ctx, prepared) {
    const out = { target: 'MOE Grid', writes: ['One shape layer with a stroke', 'One Path expression per line, tagged // MOE Tracer'] };
    if (prepared && prepared.ok) { out.target = prepared.grid.name; if (prepared.replaces) out.warnings = [`${prepared.name} is replaced — Restore removes the new one but does not bring the old one back`]; }
    return out;
  },

  async execute({ args, ctx, prepared, host }) {
    const comp = ctx.comp, grid = prepared.grid;
    // 1. the items, in grid order (the slot baked into each item's MOE Grid expression)
    const desc = await host.call('layers.describe', { compId: comp.id });
    const kids = desc.layers.filter((l) => l.parentId === grid.id);
    if (kids.length < 2) { const e = new Error(`${grid.name} needs at least two items to connect`); e.code = 'NO_ITEMS'; throw e; }
    const counts = new Map(); desc.layers.forEach((l) => counts.set(l.name, (counts.get(l.name) || 0) + 1));
    const dup = kids.find((l) => counts.get(l.name) > 1);
    if (dup) { const e = new Error(`Two layers are named "${dup.name}" — the lines find each item by its name. Rename one, then draw the tracer`); e.code = 'DUPLICATE_NAME'; throw e; }
    const scan = await host.call('proximity.scan', { compId: comp.id, layerIds: kids.map((l) => l.id), tag: X.TAG });
    const peek = scan.expressions.length ? await host.call('expressions.peek', { compId: comp.id, items: scan.expressions.map((a) => ({ address: a })) }) : { items: [] };
    const slot = new Map();
    scan.expressions.forEach((a, i) => { const s = X.slotOf(peek.items[i].expression || ''); if (s && !slot.has(a.layerId)) slot.set(a.layerId, s.i); });
    const ordered = kids.slice().sort((a, b) => (slot.has(a.id) ? slot.get(a.id) : 1e6 + a.index) - (slot.has(b.id) ? slot.get(b.id) : 1e6 + b.index));
    // 2. where they are now (in the grid null's space) → which items each line joins
    const pos = await host.call('props.values', { compId: comp.id, time: comp.time, items: ordered.map((l) => ({ address: { layerId: l.id, matchNames: POS } })) });
    const bad = pos.items.find((r) => r.error || !r.value);
    if (bad) { const e = new Error(`An item of ${grid.name} has an expression error (${bad.error || 'no value'}) — fix it first`); e.code = 'ITEM_ERROR'; throw e; }
    const items = ordered.map((l, i) => ({ name: l.name, id: l.id, p: [pos.items[i].value[0], pos.items[i].value[1]] }));
    const ls = TR.lines(args.mode, items, { closed: !!args.closed });
    const sz = TR.size(ls);
    if (!sz.ok) { const e = new Error(sz.paths === 0 ? 'No two items share a row or column — try "In order" or "Hub"' : `That would be ${sz.paths} lines with ${sz.points} points — too many for one tracer (max ${TR.LIMITS.paths} lines, ${TR.LIMITS.points} points). Try "In order" or "Zig-zag"`); e.code = 'TRACER_SIZE'; throw e; }
    // 3. replace this grid's own tracer, if it has one
    const old = desc.layers.filter((l) => l.name === prepared.name);
    if (old.length) await host.call('layers.remove', { compId: comp.id, layerIds: old.map((l) => l.id), onlyNamed: 'MOE Tracer' });
    // 4. the shape layer: one two-point path per line for now, at the comp's origin so its space is the comp's
    const made = await host.call('shapes.insert', { compId: comp.id, name: prepared.name, label: 2, groupName: 'Lines', paths: ls.map(() => ({ v: [[0, 0], [10, 0]], i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], c: false })), stroke: { color: args.colour, width: args.width, opacity: args.opacity, cap: 2, join: 2 }, fill: null, position: [0, 0] });
    let set;
    try {
      set = await host.call('expressions.set', { compId: comp.id, label: 'MOE: Tracer', revertOnError: true, targets: ls.map((l, i) => ({ address: pathAddr(made.layerId, i + 1), expression: TR.code(l, grid.name), enabled: true })) });
      if (args.behind) { const d2 = await host.call('layers.describe', { compId: comp.id }); const low = d2.layers.filter((l) => l.parentId === grid.id).sort((a, b) => b.index - a.index)[0]; if (low) await host.call('layers.move', { compId: comp.id, items: [{ layerId: made.layerId, after: low.id }] }); }
    } catch (err) {
      await host.call('layers.remove', { compId: comp.id, layerIds: [made.layerId], onlyNamed: 'MOE Tracer' });
      throw err;
    }
    // 5. read back: every path's points are where its items are (comp space = this layer's space)
    const paths = await host.call('props.values', { compId: comp.id, time: comp.time, items: ls.map((l, i) => ({ address: pathAddr(made.layerId, i + 1) })) });
    const gp = await host.call('props.values', { compId: comp.id, time: comp.time, items: [{ address: { layerId: grid.id, matchNames: POS } }] });
    return { name: prepared.name, layerId: made.layerId, grid: { id: grid.id, name: grid.name }, lines: ls, size: sz, set, paths, replaced: old.length, gridPos: gp.items[0].value, items: items.map((it) => ({ name: it.name, p: it.p })) };
  },

  verify({ result }) {
    const bad = result.set.targets.filter((t) => t.skipped || t.reverted || (t.after && t.after.expressionError));
    const checks = [{ ok: bad.length === 0, label: result.name, detail: bad.length ? `${bad.length} line(s) failed: ${bad[0].after ? bad[0].after.expressionError : bad[0].skipped}` : `${result.size.paths} line(s), ${result.size.points} points` }];
    // each path has one point per item of its line
    let wrong = 0;
    result.lines.forEach((l, i) => { const v = result.paths.items[i] && result.paths.items[i].value; const n = v && v.vertices ? v.vertices.length : -1; if (n !== l.names.length) wrong++; });
    checks.push({ ok: wrong === 0, label: 'Read-back', detail: wrong ? `${wrong} path(s) do not have a point per item` : 'every path has a point on each of its items' });
    return { ok: checks.every((c) => c.ok), checks };
  },

  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, layerId: result.layerId }; },
  async restore({ data, host }) { await host.call('layers.remove', { compId: data.compId, layerIds: [data.layerId], onlyNamed: 'MOE Tracer' }); return { ok: true }; },
  summarize(result, v) { return v.ok ? `${result.name}: ${result.size.paths} line(s) follow ${result.items.length} items` : 'Tracer drawn with problems'; }
};

module.exports = { tracer, pathAddr, NAME };
