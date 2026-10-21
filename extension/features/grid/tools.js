'use strict';
/**
 * Grid Builder (inspired by aescripts Grid Builder, extended):
 *   grid.build        arrange selected layers on a live grid driven by one "MOE Grid N" null
 *                     (Grid, Radial, Spiral, Sunflower, Path, Sphere) with twist, scale step,
 *                     random jitter, Build animation (stagger/order/style) and an Effector.
 *   grid.update       change a grid's controls from the panel (live).
 *   grid.remove       remove (layers return to their own positions) or freeze (bake the layout).
 *   grid.guides       design layout guides: columns, rows, gutters, margins (AE guides you can snap to).
 *   grid.placeInCells drop selected layers into the cells of that layout (keeps their keyframes).
 */
const L = require('./layouts');
const X = require('./expressions');

const GRID_NAME = /^MOE Grid \d+$/;
const MODE_OPTIONS = L.MODES.map((m) => ({ value: m.id, label: m.label }));
const enumOf = (list) => list.map((v, i) => ({ value: String(i + 1), label: v }));
const NO_LAYOUT = new Set(['camera', 'light']);

/* ---------- pure: layout guides ---------- */

/** layoutGuides({ columns, rows, gutterX, gutterY, marginX, marginY }, W, H) -> { v: [x], h: [y], cells: [{ x, y, w, h }] } */
function layoutGuides(p, W, H) {
  const cols = Math.max(1, Math.round(p.columns)), rows = Math.max(1, Math.round(p.rows));
  const cw = (W - 2 * p.marginX - (cols - 1) * p.gutterX) / cols;
  const ch = (H - 2 * p.marginY - (rows - 1) * p.gutterY) / rows;
  if (!(cw > 1 && ch > 1)) return { error: 'Margins and gutters leave no room for cells' };
  const v = new Set(), h = new Set(), cells = [];
  for (let c = 0; c < cols; c++) { const x0 = p.marginX + c * (cw + p.gutterX); v.add(round2(x0)); v.add(round2(x0 + cw)); }
  for (let r = 0; r < rows; r++) { const y0 = p.marginY + r * (ch + p.gutterY); h.add(round2(y0)); h.add(round2(y0 + ch)); }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ x: p.marginX + c * (cw + p.gutterX), y: p.marginY + r * (ch + p.gutterY), w: cw, h: ch });
  if (p.center) { v.add(W / 2); h.add(H / 2); }
  return { v: [...v].sort((a, b) => a - b), h: [...h].sort((a, b) => a - b), cells, cw, ch };
}
const round2 = (v) => Math.round(v * 100) / 100;

const GUIDE_PARAMS = {
  columns: { type: 'integer', label: 'Columns', min: 1, max: 48, default: 12 },
  rows: { type: 'integer', label: 'Rows', min: 1, max: 48, default: 6 },
  gutterX: { type: 'number', label: 'Gutter X', min: 0, max: 400, step: 1, default: 24, unit: 'px' },
  gutterY: { type: 'number', label: 'Gutter Y', min: 0, max: 400, step: 1, default: 24, unit: 'px' },
  marginX: { type: 'number', label: 'Margin X', min: 0, max: 800, step: 1, default: 96, unit: 'px' },
  marginY: { type: 'number', label: 'Margin Y', min: 0, max: 800, step: 1, default: 72, unit: 'px' }
};

/* ---------- build ---------- */

function itemsOf(ctx, exclude) {
  return (ctx.layers || []).filter((l) => !GRID_NAME.test(l.name) && !NO_LAYOUT.has(l.type) && !exclude.includes(l.index));
}

function nextGridName(ctx) {
  const used = new Set((ctx.compLayers || []).map((l) => l.name));
  let n = 1;
  while (used.has(`MOE Grid ${n}`)) n++;
  return `MOE Grid ${n}`;
}

/** Final numeric params from tool args + measured sizes. */
function resolveParams(args, auto) {
  const p = X.defaultParams(args.mode);
  Object.assign(p, {
    columns: args.columns || auto.columns, spacingX: args.spacingX || auto.spacingX, spacingY: args.spacingY || auto.spacingY,
    order: Number(args.order), buildOrder: Number(args.buildOrder), buildStyle: Number(args.buildStyle), buildStagger: args.stagger,
    reverse: false, faceCenter: !!args.faceCenter, rowOffset: args.rowOffset || 0
  });
  if (args.mode === 'radial') { p.radius = args.radius || auto.radius; p.arc = args.arc; p.ringSpacing = auto.ringSpacing; }
  if (args.mode === 'spiral') { p.radius = args.radius || 60; p.spiralStep = Math.max(4, Math.round(auto.spacingX / 6)); }
  if (args.mode === 'sphere') p.radius = args.radius || Math.max(200, auto.radius * 0.8);
  if (args.mode === 'phyllo') p.spread = auto.spread;
  if (args.animateIn) p.build = 0;
  return p;
}

const build = {
  id: 'grid.build',
  version: '1.0.0',
  category: 'layout',
  group: 'Grid',
  name: 'Grid Builder',
  description: 'Arrange the selected layers on a live grid controlled by one MOE Grid null: Grid, Radial, Spiral, Sunflower, Path or Sphere — with twist, scale step, random jitter, a Build-in animation and an Effector. Every control stays editable in Effect Controls.',
  keywords: ['grid', 'layout', 'arrange', 'distribute', 'radial', 'circle', 'spiral', 'sunflower', 'phyllotaxis', 'path', 'sphere', 'array', 'clone', 'matrix', 'wall', 'mosaic', 'build'],
  icon: 'grid',
  params: {
    mode: { type: 'enum', label: 'Mode', default: 'rect', options: MODE_OPTIONS },
    columns: { type: 'integer', label: 'Columns', min: 0, max: 100, default: 0, description: '0 = auto from the comp shape', showIf: (a) => a.mode === 'rect' },
    spacingX: { type: 'number', label: 'Spacing X', min: 0, max: 5000, step: 1, default: 0, unit: 'px', description: '0 = auto from layer sizes', showIf: (a) => a.mode === 'rect' },
    spacingY: { type: 'number', label: 'Spacing Y', min: 0, max: 5000, step: 1, default: 0, unit: 'px', description: '0 = auto', showIf: (a) => a.mode === 'rect' },
    rowOffset: { type: 'number', label: 'Row offset', min: -100, max: 100, step: 1, default: 0, unit: '%', description: 'Shift every other row (50 = honeycomb / brick)', showIf: (a) => a.mode === 'rect' },
    radius: { type: 'number', label: 'Radius', min: 0, max: 10000, step: 1, default: 0, unit: 'px', description: '0 = auto', showIf: (a) => ['radial', 'spiral', 'sphere'].includes(a.mode) },
    arc: { type: 'number', label: 'Arc', min: -360, max: 360, step: 1, default: 360, unit: '°', showIf: (a) => a.mode === 'radial' },
    pathLayer: { type: 'layer', label: 'Path layer', description: 'Shape or masked layer whose path the items follow', showIf: (a) => a.mode === 'path' },
    order: { type: 'enum', label: 'Order', default: '1', options: enumOf(L.ORDERS) },
    faceCenter: { type: 'boolean', label: 'Face center / path', default: false, showIf: (a) => a.mode !== 'rect' },
    animateIn: { type: 'boolean', label: 'Animate in', default: false, description: 'Keyframe Build 0 → 100 from the current time' },
    buildStyle: { type: 'enum', label: 'Build style', default: '1', options: enumOf(L.BUILD_STYLES), showIf: (a) => a.animateIn },
    buildOrder: { type: 'enum', label: 'Build order', default: '1', options: enumOf(L.BUILD_ORDERS), showIf: (a) => a.animateIn },
    buildDuration: { type: 'number', label: 'Build time', min: 0.1, max: 20, step: 0.1, default: 1.5, unit: 's', showIf: (a) => a.animateIn },
    stagger: { type: 'number', label: 'Stagger', min: 0, max: 100, step: 1, default: 60, unit: '%', showIf: (a) => a.animateIn },
    effector: { type: 'layer', label: 'Effector', advanced: true, description: 'Optional layer (e.g. a null) that scales / pushes nearby items' },
    centerAnchors: { type: 'boolean', label: 'Center anchors', default: true, advanced: true, description: 'Centre each item’s anchor on its content first (keyframed anchors are left alone)' },
    replace: { type: 'boolean', label: 'Replace existing', default: false, advanced: true, description: 'Overwrite expressions MOE did not create' }
  },
  requires: { comp: true, minLayers: 2 },
  permissions: ['modify.layers', 'modify.effects', 'modify.expressions'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Arrange selected layers in a grid / circle / spiral / sunflower / along a path / on a 3D sphere, optionally animating them in with a stagger. Live controls on a MOE Grid null.' },
  uses: { hostOps: ['layers.bounds', 'layers.centerAnchor', 'layers.createNull', 'effects.ensure', 'effects.setMenu', 'layers.setParent', 'expressions.set', 'keys.write', 'props.values', 'paths.find'], network: false },
  compatibility: { minAE: '25.0' },
  ui: {
    primaryLabel: 'Build Grid',
    presets: [
      { id: 'wall', label: 'Wall', args: { mode: 'rect', order: '1', animateIn: true, buildStyle: '4', buildOrder: '3' } },
      { id: 'brick', label: 'Honeycomb', args: { mode: 'rect', order: '1', rowOffset: 50 } },
      { id: 'ring', label: 'Ring', args: { mode: 'radial', arc: 360, faceCenter: true } },
      { id: 'fan', label: 'Fan', args: { mode: 'radial', arc: 120, faceCenter: true } },
      { id: 'galaxy', label: 'Galaxy', args: { mode: 'phyllo', animateIn: true, buildStyle: '1', buildOrder: '3' } },
      { id: 'globe', label: 'Globe', args: { mode: 'sphere' } }
    ]
  },

  prepare(args, ctx) {
    const exclude = [args.pathLayer, args.effector].filter(Boolean);
    const items = itemsOf(ctx, exclude);
    if (items.length < 2) return { ok: false, error: 'Select at least 2 layers to arrange' };
    const locked = items.filter((l) => l.locked);
    if (locked.length) return { ok: false, error: `Unlock ${locked.map((l) => l.name).join(', ')} first` };
    const parented = items.filter((l) => l.parentIndex && !items.some((o) => o.index === l.parentIndex));
    if (args.mode === 'path' && !args.pathLayer) return { ok: false, error: 'Choose the path layer' };
    const name = nextGridName(ctx);
    const mode = L.MODES.find((m) => m.id === args.mode);
    return {
      ok: true, items, name,
      preview: {
        summary: `${mode.label} of ${items.length} layers · ${name}${args.animateIn ? ' · animated in' : ''}`,
        items: [
          ...items.slice(0, 6).map((l) => l.name), ...(items.length > 6 ? [`+${items.length - 6} more`] : []),
          ...(args.mode === 'sphere' ? ['Items become 3D layers (restorable)'] : []),
          ...(parented.length ? [`${parented.length} item(s) are re-parented to the grid (restorable)`] : [])
        ]
      }
    };
  },

  async execute({ args, ctx, prepared, host }) {
    const comp = ctx.comp;
    const items = prepared.items;
    const anchors = args.centerAnchors !== false ? await host.call('layers.centerAnchor', { compId: comp.id, layers: items.map((l) => l.id) }) : null;
    const meas = await host.call('layers.bounds', { compId: comp.id, layerIds: items.map((l) => l.id), times: [comp.time] });
    const boxes = meas.layers.map((m) => m.boxes[0]).filter(Boolean);
    const maxW = Math.max(10, ...boxes.map((b) => b[2] - b[0])), maxH = Math.max(10, ...boxes.map((b) => b[3] - b[1]));
    const auto = L.autoParams({ n: items.length, maxW, maxH, compW: comp.width, compH: comp.height });
    const params = resolveParams(args, auto);
    const cx = boxes.length ? boxes.reduce((s, b) => s + (b[0] + b[2]) / 2, 0) / boxes.length : comp.width / 2;
    const cy = boxes.length ? boxes.reduce((s, b) => s + (b[1] + b[3]) / 2, 0) / boxes.length : comp.height / 2;
    const threeD = args.mode === 'sphere';
    let made3D = null;
    if (threeD) {
      const flat = items.filter((l) => !l.threeD);
      if (flat.length) made3D = await host.call('layers.setAttrs', { compId: comp.id, label: 'MOE: Make 3D', items: flat.map((l) => ({ layerId: l.id, threeDLayer: true })) });
    }
    const center = args.mode === 'path' ? [0, 0] : [Math.round(cx), Math.round(cy)];
    const created = await host.call('layers.createNull', { compId: comp.id, name: prepared.name, position: threeD ? [center[0], center[1], 0] : center, anchor: [0, 0], label: 13, threeD, undoLabel: 'MOE: Grid Null' });
    let path = null;
    if (args.mode === 'path') path = await host.call('paths.find', { compId: comp.id, layerId: ctx.compLayers.find((l) => l.index === args.pathLayer).id });
    // Layer controls take layer indices — read them after the null was added.
    const desc = await host.call('layers.describe', { compId: comp.id });
    const idxOf = (oldIndex) => { const cl = ctx.compLayers.find((l) => l.index === oldIndex); const d = cl && desc.layers.find((x) => x.id === cl.id); return d ? d.index : 0; };
    const controls = await host.call('effects.ensure', {
      compId: comp.id, label: 'MOE: Grid Controls',
      layers: [{ layer: { layerId: created.layerId }, items: X.controlItems(args.mode, params, (name) => (name === 'Path Layer' ? idxOf(args.pathLayer) : name === 'Effector' && args.effector ? idxOf(args.effector) : 0)) }]
    });
    for (const [name, list, value] of [['Order', L.ORDERS, params.order], ['Build Order', L.BUILD_ORDERS, params.buildOrder], ['Build Style', L.BUILD_STYLES, params.buildStyle]]) {
      await host.call('effects.setMenu', { compId: comp.id, layerId: created.layerId, effectKey: name, items: list, value });
    }
    const targets = [];
    items.forEach((l, i) => {
      const code = X.build(i, items.length, { mode: args.mode, gridName: prepared.name, pathAccess: path && path.access, pathClosed: path && path.closed });
      for (const prop of Object.keys(X.PROP_ADDR)) targets.push({ layer: l, prop, address: { layerId: l.id, matchNames: X.PROP_ADDR[prop] }, expression: code[prop] });
    });
    const peek = await host.call('expressions.peek', { compId: comp.id, items: targets.map((t) => ({ address: t.address })) });
    const conflicts = targets.filter((t, i) => peek.items[i].expression && !peek.items[i].expression.startsWith(X.TAG));
    if (conflicts.length && !args.replace) {
      await host.call('layers.remove', { compId: comp.id, layerIds: [created.layerId], onlyNamed: 'MOE Grid' });
      if (made3D) await host.call('layers.setAttrs', { compId: comp.id, items: made3D.layers.map((x) => ({ layerId: x.layerId, threeDLayer: false })) });
      if (anchors) await host.call('layers.restoreTransform', { compId: comp.id, layers: anchors.layers.filter((a) => !a.skipped).map((a) => ({ layerId: a.layerId, anchor: a.before.anchor, position: a.before.position })) });
      const e = new Error(`These properties already have your own expressions: ${[...new Set(conflicts.map((c) => `${c.layer.name} › ${c.prop}`))].slice(0, 6).join(', ')}. Turn on "Replace existing" to overwrite (restorable).`);
      e.code = 'EXPRESSION_CONFLICT';
      throw e;
    }
    const parented = await host.call('layers.setParent', { compId: comp.id, label: 'MOE: Grid Parent', items: items.map((l) => ({ layerId: l.id, parentId: created.layerId })) });
    const set = await host.call('expressions.set', { compId: comp.id, label: 'MOE: Grid', revertOnError: true, targets: targets.map((t) => ({ address: t.address, expression: t.expression, enabled: true })) });
    let keys = null;
    let checkTime = comp.time;
    if (args.animateIn) {
      const t0 = comp.time, t1 = comp.time + args.buildDuration;
      keys = await host.call('keys.write', { compId: comp.id, label: 'MOE: Grid Build', items: [{ address: X.controlAddress(created.layerId, 'Build'), keys: [{ t: t0, v: 0, easeOut: { speed: 0, influence: 20 } }, { t: t1, v: 100, easeIn: { speed: 0, influence: 75 } }] }] });
      checkTime = t1;
    }
    const read = await host.call('props.values', { compId: comp.id, time: checkTime, items: items.map((l) => ({ address: { layerId: l.id, matchNames: X.PROP_ADDR.position } })) });
    const finalParams = Object.assign({}, params, { build: 100 });
    const predicted = args.mode === 'path' || args.effector ? null : L.place(finalParams, items.length).map((it) => { const m = L.modifiers(finalParams, it, items.length); return [it.x + m.dx, it.y + m.dy]; });
    return { name: prepared.name, nullId: created.layerId, params, controls, set, parented, anchors, made3D, keys, read, predicted, items: items.map((l) => ({ id: l.id, name: l.name })) };
  },

  verify({ result }) {
    const checks = [];
    const nCtl = result.controls.layers[0].items.length;
    checks.push({ ok: true, label: result.name, detail: `grid null with ${nCtl} controls (Effect Controls)` });
    const bad = result.set.targets.filter((t) => t.skipped || t.reverted || t.after.expressionError);
    checks.push({ ok: bad.length === 0, label: 'Expressions', detail: bad.length ? `${bad.length} failed: ${bad.slice(0, 3).map((t) => `${t.layerName} › ${t.name}: ${t.after ? t.after.expressionError : t.skipped}`).join('; ')}` : `${result.set.targets.length} live expressions, no engine errors` });
    checks.push({ ok: result.parented.layers.every((l) => l.after === result.nullId), label: 'Parenting', detail: `${result.parented.layers.length} item(s) follow ${result.name}` });
    if (result.predicted) {
      const off = result.read.items.map((r, i) => (r.value ? Math.hypot(r.value[0] - result.predicted[i][0], r.value[1] - result.predicted[i][1]) : Infinity));
      const worst = Math.max(...off);
      checks.push({ ok: worst < 0.6, label: 'Layout read-back', detail: worst < 0.6 ? `${off.length} positions match the preview (±0.5 px)` : `position differs by ${worst.toFixed(1)} px` });
    } else {
      const errs = result.read.items.filter((r) => r.error);
      checks.push({ ok: errs.length === 0, label: 'Layout read-back', detail: errs.length ? errs[0].error : `${result.read.items.length} positions evaluated` });
    }
    if (result.keys) checks.push({ ok: result.keys.items[0].written.length === 2, label: 'Build', detail: 'Build 0 → 100 keyframed' });
    return { ok: checks.every((c) => c.ok), checks };
  },

  checkpoint({ result, ctx }) {
    return {
      compId: ctx.comp.id, nullId: result.nullId,
      expressions: result.set.targets.filter((t) => !t.skipped && !t.reverted).map((t) => ({ address: t.address, expression: t.before.expression, enabled: t.before.expressionEnabled })),
      parents: result.parented.layers.map((l) => ({ layerId: l.layerId, parentId: l.before })),
      anchors: result.anchors ? result.anchors.layers.filter((a) => !a.skipped).map((a) => ({ layerId: a.layerId, anchor: a.before.anchor, position: a.before.position })) : [],
      made3D: result.made3D ? result.made3D.layers.map((l) => l.layerId) : []
    };
  },

  async restore({ data, host }) {
    if (data.expressions.length) await host.call('expressions.set', { compId: data.compId, label: 'MOE: Restore Grid', revertOnError: false, targets: data.expressions });
    await host.call('layers.setParent', { compId: data.compId, label: 'MOE: Restore Grid', items: data.parents });
    await host.call('layers.remove', { compId: data.compId, layerIds: [data.nullId], onlyNamed: 'MOE Grid' });
    if (data.anchors.length) await host.call('layers.restoreTransform', { compId: data.compId, layers: data.anchors });
    if (data.made3D.length) await host.call('layers.setAttrs', { compId: data.compId, items: data.made3D.map((id) => ({ layerId: id, threeDLayer: false })) });
    return { ok: true };
  },

  summarize(result, v) { return v.ok ? `${result.name}: ${result.items.length} layers arranged` : 'Grid built with problems'; }
};

/* ---------- live update ---------- */

function gridOf(ctx, args) {
  if (args.gridId) return (ctx.compLayers || []).find((l) => l.id === args.gridId) || null;
  return (ctx.layers || []).find((l) => GRID_NAME.test(l.name)) || null;
}

const update = {
  id: 'grid.update',
  version: '1.0.0',
  category: 'layout',
  group: 'Grid',
  name: 'Grid Controls',
  description: 'Change a MOE Grid’s controls (spacing, columns, radius, twist, build…). Select the grid null, or use the Layout view.',
  keywords: ['grid', 'controls', 'spacing', 'columns', 'tweak'],
  icon: 'sliders',
  params: {
    gridId: { type: 'integer', label: 'Grid', hidden: true },
    values: { type: 'text', label: 'Values', maxLength: 4000, description: 'JSON, e.g. {"Spacing X": 300, "Twist": 15, "Build Style": 3}' }
  },
  requires: { comp: true },
  permissions: ['modify.effects'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Tweak an existing MOE Grid (select its null). values is JSON keyed by control name: Columns, Spacing X/Y, Row Offset, Radius, Arc, Twist, Item Scale, Scale Step, Random Position/Rotation/Scale, Seed, Build, Build Stagger, Build Distance, Effector Radius/Scale/Push…' },
  uses: { hostOps: ['props.setValues'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Apply' },
  prepare(args, ctx) {
    const g = gridOf(ctx, args);
    if (!g) return { ok: false, error: 'Select a MOE Grid null' };
    let values;
    try { values = JSON.parse(args.values || '{}'); } catch (e) { return { ok: false, error: 'Values must be JSON' }; }
    const known = new Set([...Object.values(X.MODE_CONTROLS).flat(), ...X.COMMON_CONTROLS].filter((c) => !['layer'].includes(c[1])).map((c) => c[0]));
    const bad = Object.keys(values).filter((k) => !known.has(k) || !Number.isFinite(Number(values[k])));
    if (bad.length) return { ok: false, error: `Unknown or non-numeric control(s): ${bad.join(', ')}` };
    if (!Object.keys(values).length) return { ok: false, error: 'Nothing to change' };
    return { ok: true, grid: g, values, preview: { summary: `${g.name}: ${Object.entries(values).map(([k, v]) => `${k} ${v}`).join(' · ')}`, items: [] } };
  },
  async execute({ ctx, prepared, host }) {
    return host.call('props.setValues', { compId: ctx.comp.id, label: 'MOE: Grid Controls', items: Object.entries(prepared.values).map(([k, v]) => ({ address: X.controlAddress(prepared.grid.id, k), value: Number(v) })) });
  },
  verify({ result, prepared }) {
    const want = Object.values(prepared.values).map(Number);
    const checks = result.items.map((it, i) => ({ ok: !it.skipped && Math.abs(it.after - want[i]) < 1e-6, label: Object.keys(prepared.values)[i], detail: it.skipped ? it.skipped : `${it.before} → ${it.after}${it.atTime !== null ? ' (keyframe at current time)' : ''}` }));
    return { ok: checks.every((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, items: result.items.filter((i) => !i.skipped).map((i) => ({ address: i.address, value: i.before })) }; },
  async restore({ data, host }) { return host.call('props.setValues', { compId: data.compId, label: 'MOE: Restore Grid', items: data.items }); },
  summarize(result) { return `${result.items.length} grid control(s) updated`; }
};

/* ---------- remove / freeze ---------- */

const remove = {
  id: 'grid.remove',
  version: '1.0.0',
  category: 'layout',
  group: 'Grid',
  name: 'Release Grid',
  description: 'Remove a MOE Grid (layers go back to their own positions) or Freeze it (bake the current layout into static values and drop the expressions).',
  keywords: ['grid', 'remove', 'release', 'freeze', 'bake'],
  icon: 'trash',
  params: { mode: { type: 'enum', label: 'Mode', default: 'remove', options: [{ value: 'remove', label: 'Remove' }, { value: 'freeze', label: 'Freeze' }] } },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers', 'modify.expressions'],
  destructive: true,
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Only when asked to remove or freeze a grid (select its null).' },
  uses: { hostOps: ['layers.describe', 'proximity.scan', 'expressions.set', 'layers.setParent', 'props.bake'], network: false },
  compatibility: { minAE: '25.0' },
  prepare(args, ctx) {
    const g = gridOf(ctx, {});
    if (!g) return { ok: false, error: 'Select a MOE Grid null' };
    return { ok: true, grid: g, preview: { summary: `${args.mode === 'freeze' ? 'Freeze' : 'Remove'} ${g.name}`, items: [] } };
  },
  async execute({ args, ctx, prepared, host }) {
    const desc = await host.call('layers.describe', { compId: ctx.comp.id });
    const kids = desc.layers.filter((l) => l.parentId === prepared.grid.id).map((l) => l.id);
    const scan = kids.length ? await host.call('proximity.scan', { compId: ctx.comp.id, layerIds: kids, tag: X.TAG }) : { expressions: [] };
    if (args.mode === 'freeze') {
      const bake = await host.call('props.bake', { compId: ctx.comp.id, label: 'MOE: Freeze Grid', items: scan.expressions.map((a) => ({ address: a })) });
      return { mode: 'freeze', bake, kids };
    }
    const set = scan.expressions.length ? await host.call('expressions.set', { compId: ctx.comp.id, label: 'MOE: Remove Grid', revertOnError: false, targets: scan.expressions.map((a) => ({ address: a, expression: '', enabled: false })) }) : { targets: [] };
    const parents = await host.call('layers.setParent', { compId: ctx.comp.id, label: 'MOE: Remove Grid', items: kids.map((id) => ({ layerId: id, parentId: null })) });
    const removed = await host.call('layers.remove', { compId: ctx.comp.id, layerIds: [prepared.grid.id], onlyNamed: 'MOE Grid' });
    return { mode: 'remove', set, parents, removed, kids };
  },
  verify({ result }) {
    if (result.mode === 'freeze') {
      const ok = result.bake.items.every((i) => i.skipped || i.after !== undefined);
      return { ok, checks: [{ ok, label: 'Freeze', detail: `${result.bake.items.filter((i) => !i.skipped).length} propert(ies) baked to static values` }] };
    }
    const left = result.set.targets.filter((t) => t.finalState && t.finalState.expression !== '');
    return { ok: left.length === 0, checks: [{ ok: left.length === 0, label: 'Expressions', detail: `${result.set.targets.length} removed` }, { ok: true, label: 'Layers', detail: `${result.kids.length} back to their own positions · ${result.removed.removed.join(', ') || 'grid null kept'}` }] };
  },
  checkpoint({ result, ctx }) {
    if (result.mode === 'freeze') return { compId: ctx.comp.id, mode: 'freeze', items: result.bake.items.filter((i) => !i.skipped).map((i) => Object.assign({ address: i.address }, i.before)) };
    return { compId: ctx.comp.id, mode: 'remove', expressions: result.set.targets.filter((t) => !t.skipped).map((t) => ({ address: t.address, expression: t.before.expression, enabled: t.before.expressionEnabled })) };
  },
  async restore({ data, host }) {
    if (data.mode === 'freeze') return host.call('props.unbake', { compId: data.compId, items: data.items });
    // The null itself comes back with Edit › Undo; MOE restores the expressions it removed.
    return host.call('expressions.set', { compId: data.compId, label: 'MOE: Restore Grid', revertOnError: false, targets: data.expressions });
  },
  summarize(result) { return result.mode === 'freeze' ? 'Grid frozen' : 'Grid removed'; }
};

/* ---------- layout guides ---------- */

const guides = {
  id: 'grid.guides',
  version: '1.0.0',
  category: 'layout',
  group: 'Layout Grid',
  name: 'Layout Guides',
  description: 'Add a design grid as composition guides — columns, rows, gutters and margins — so layers snap to it (View › Snap to Guides).',
  keywords: ['guides', 'columns', 'rows', 'gutter', 'margin', 'layout grid', 'safe area', 'snap'],
  icon: 'guides',
  params: Object.assign({}, GUIDE_PARAMS, {
    center: { type: 'boolean', label: 'Centre lines', default: false },
    replaceAll: { type: 'boolean', label: 'Clear existing guides', default: false, advanced: true }
  }),
  requires: { comp: true },
  permissions: ['modify.layers'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Create design layout guides (columns/rows/gutters/margins) in the active comp.' },
  uses: { hostOps: ['guides.set'], network: false },
  compatibility: { minAE: '25.0' },
  ui: {
    primaryLabel: 'Add Guides',
    presets: [
      { id: 'g12', label: '12 col', args: { columns: 12, rows: 1, gutterX: 24, marginX: 96, marginY: 72 } },
      { id: 'g3x3', label: 'Thirds', args: { columns: 3, rows: 3, gutterX: 0, gutterY: 0, marginX: 0, marginY: 0 } },
      { id: 'safe', label: 'Safe area', args: { columns: 1, rows: 1, marginX: 96, marginY: 54, gutterX: 0, gutterY: 0, center: true } }
    ]
  },
  prepare(args, ctx) {
    const g = layoutGuides(args, ctx.comp.width, ctx.comp.height);
    if (g.error) return { ok: false, error: g.error };
    return { ok: true, g, preview: { summary: `${args.columns}×${args.rows} · cells ${Math.round(g.cw)}×${Math.round(g.ch)} px · ${g.v.length + g.h.length} guides`, items: [] } };
  },
  async execute({ args, ctx, prepared, host }) {
    const add = [...prepared.g.v.map((x) => ({ o: 1, pos: x })), ...prepared.g.h.map((y) => ({ o: 0, pos: y }))];
    return host.call('guides.set', { compId: ctx.comp.id, add, remove: args.replaceAll ? null : [], clearAll: !!args.replaceAll });
  },
  verify({ result, prepared }) {
    const n = prepared.g.v.length + prepared.g.h.length;
    return { ok: result.added.length === n, checks: [{ ok: result.added.length === n, label: 'Guides', detail: `${result.added.length} added · ${result.total} in comp${result.cleared ? ` · ${result.cleared.length} cleared` : ''}` }] };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, added: result.added, cleared: result.cleared || [] }; },
  async restore({ data, host }) { return host.call('guides.set', { compId: data.compId, remove: data.added, add: data.cleared }); },
  summarize(result) { return `${result.added.length} guides added`; }
};

/* ---------- place in cells ---------- */

const placeInCells = {
  id: 'grid.placeInCells',
  version: '1.0.0',
  category: 'layout',
  group: 'Layout Grid',
  name: 'Place in Cells',
  description: 'Drop the selected layers into the cells of a layout grid in reading order — fitted, filled or centred. Keyframes are kept (re-mapped), anchors untouched.',
  keywords: ['place', 'cells', 'align', 'distribute', 'fit', 'tile', 'layout'],
  icon: 'cells',
  params: Object.assign({}, GUIDE_PARAMS, {
    columns: Object.assign({}, GUIDE_PARAMS.columns, { default: 3 }),
    rows: Object.assign({}, GUIDE_PARAMS.rows, { default: 2 }),
    fit: { type: 'enum', label: 'Fit', default: 'fit', options: [{ value: 'fit', label: 'Fit' }, { value: 'fill', label: 'Fill' }, { value: 'center', label: 'Centre' }] },
    padding: { type: 'number', label: 'Padding', min: 0, max: 45, step: 1, default: 6, unit: '%', description: 'Inner padding of each cell' }
  }),
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Tile selected layers into a rows×columns layout (photo wall, product grid, split screen).' },
  uses: { hostOps: ['layers.bounds', 'transform.remap', 'transform.restore'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Place', presets: [{ id: 'split2', label: 'Split 2', args: { columns: 2, rows: 1, gutterX: 0, marginX: 0, marginY: 0, fit: 'fill', padding: 0 } }, { id: 'quad', label: '2×2', args: { columns: 2, rows: 2, gutterX: 12, gutterY: 12, marginX: 0, marginY: 0, fit: 'fill', padding: 0 } }, { id: 'wall', label: '3×2', args: { columns: 3, rows: 2 } }] },
  prepare(args, ctx) {
    const g = layoutGuides(args, ctx.comp.width, ctx.comp.height);
    if (g.error) return { ok: false, error: g.error };
    const layers = (ctx.layers || []).filter((l) => !NO_LAYOUT.has(l.type));
    const nested = layers.filter((l) => l.parentIndex);
    if (nested.length) return { ok: false, error: `Un-parent ${nested.map((l) => l.name).join(', ')} first (children follow their parent)` };
    if (layers.length > g.cells.length) return { ok: false, error: `${layers.length} layers but only ${g.cells.length} cells — add rows or columns` };
    return { ok: true, g, layers, preview: { summary: `${layers.length} layer(s) → ${args.columns}×${args.rows} cells (${args.fit})`, items: [] } };
  },
  async execute({ args, ctx, prepared, host }) {
    const meas = await host.call('layers.bounds', { compId: ctx.comp.id, layerIds: prepared.layers.map((l) => l.id), times: [ctx.comp.time] });
    const items = [];
    const skipped = [];
    meas.layers.forEach((m, i) => {
      const b = m.boxes[0];
      if (!b || !(b[2] > b[0] && b[3] > b[1])) { skipped.push(m.name); return; }
      const c = prepared.g.cells[i];
      const pad = args.padding / 100;
      const cw = c.w * (1 - 2 * pad), ch = c.h * (1 - 2 * pad);
      const bw = b[2] - b[0], bh = b[3] - b[1];
      const s = args.fit === 'center' ? 1 : args.fit === 'fill' ? Math.max(cw / bw, ch / bh) : Math.min(cw / bw, ch / bh);
      const d = [c.x + c.w / 2 - s * (b[0] + b[2]) / 2, c.y + c.h / 2 - s * (b[1] + b[3]) / 2];
      items.push({ layerId: m.layerId, s, d, cell: c, box: b });
    });
    const remap = await host.call('transform.remap', { compId: ctx.comp.id, label: 'MOE: Place in Cells', items: items.map(({ layerId, s, d }) => ({ layerId, s, d })) });
    const after = await host.call('layers.bounds', { compId: ctx.comp.id, layerIds: items.map((i) => i.layerId), times: [ctx.comp.time] });
    return { items, remap, after, skipped };
  },
  verify({ result }) {
    const checks = result.items.map((it, i) => {
      const r = result.remap.layers[i];
      if (r.skipped) return { ok: false, label: r.name, detail: `not moved: ${r.skipped.toLowerCase()}` };
      const b = result.after.layers[i].boxes[0];
      const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      const ok = Math.abs(cx - (it.cell.x + it.cell.w / 2)) < 1 && Math.abs(cy - (it.cell.y + it.cell.h / 2)) < 1;
      return { ok, label: r.name, detail: ok ? `centred in cell ${i + 1} (measured)` : `off by ${Math.round(cx - it.cell.x - it.cell.w / 2)}, ${Math.round(cy - it.cell.y - it.cell.h / 2)} px` };
    });
    for (const s of result.skipped) checks.push({ ok: true, label: s, detail: 'skipped: no visible bounds' });
    return { ok: checks.every((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, layers: result.remap.layers.filter((l) => l.before).map((l) => ({ layerId: l.layerId, before: l.before })) }; },
  async restore({ data, host }) { return host.call('transform.restore', data); },
  summarize(result) { return `${result.items.length} layer(s) placed in cells`; }
};

module.exports = { build, update, remove, guides, placeInCells, layoutGuides, resolveParams, GRID_NAME };
