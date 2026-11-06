'use strict';
/**
 * Grid Builder (inspired by aescripts Grid Builder, extended — study: docs/features/GRID_BUILDER_2.md):
 *   grid.build        arrange selected layers on a live grid driven by one "MOE Grid N" null
 *                     (Grid, Radial, Spiral, Sunflower, Path, Sphere) with twist, scale step,
 *                     random jitter, Build animation (stagger/order/style) and an Effector.
 *                     v0.19: Layout switchable in Effect Controls, Morph To + Morph, Orient,
 *                     Effector Rotate / Fade / attract, items keep a hand-made nudge.
 *   grid.update       change a grid's controls from the panel (live).
 *   grid.items        v0.19: reorder a grid's items (slot order, without touching the layer stack)
 *                     or give selected items their own Twist / Delay.
 *   grid.remove       remove (layers return to their own positions) or freeze (bake the layout).
 *   grid.guides       design layout guides: columns, rows, gutters, margins (AE guides you can snap to).
 *   grid.placeInCells drop selected layers into the cells of that layout (keeps their keyframes).
 */
const L = require('./layouts');
const X = require('./expressions');
const S = require('../compositing/shared');

const GRID_NAME = /^MOE Grid \d+$/;
const MODE_OPTIONS = L.MODES.map((m) => ({ value: m.id, label: m.label }));
const MORPH_OPTIONS = [{ value: 'none', label: 'No morph' }].concat(MODE_OPTIONS);
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
    reverse: false, faceCenter: !!args.faceCenter, rowOffset: args.rowOffset || 0,
    // old presets: "Face center" on and Orient left at its default → Face Center
    orient: args.faceCenter && (!args.orient || args.orient === '1') ? 2 : Number(args.orient || 1)
  });
  const morphTo = args.morphTo && args.morphTo !== 'none' && args.morphTo !== args.mode ? args.morphTo : null;
  const uses = (m) => args.mode === m || morphTo === m;
  // every layout used (built or morphed to) gets sensible numbers from the layer sizes
  p.ringSpacing = auto.ringSpacing; p.spread = auto.spread; p.spiralStep = Math.max(4, Math.round(auto.spacingX / 6));
  if (uses('radial')) { p.radius = args.radius || auto.radius; p.arc = args.arc === undefined ? 360 : args.arc; }
  if (uses('sphere')) p.radius = args.radius || (uses('radial') ? p.radius : Math.max(200, auto.radius * 0.8));
  if (args.mode === 'spiral') p.radius = args.radius || 60;
  p.morphTo = morphTo;
  p.layoutIdx = L.modeIndex(args.mode);
  p.morphToIdx = morphTo ? L.modeIndex(morphTo) : (args.mode === 'radial' ? 1 : 2);
  p.morph = 0;
  if (args.animateIn) p.build = 0;
  return p;
}

const build = {
  id: 'grid.build',
  version: '1.0.0',
  category: 'layout',
  group: 'Grid',
  name: 'Grid Builder',
  description: 'Arrange the selected layers on a live grid controlled by one MOE Grid null: Grid, Radial, Spiral, Sunflower, Path, Sphere, Points (one clone on each point of a shape) or In Place (a text split into words, kept where it was) — with twist, scale step, random jitter, a Build-in animation and an Effector. Every control stays editable in Effect Controls.',
  keywords: ['grid', 'layout', 'arrange', 'distribute', 'radial', 'circle', 'spiral', 'sunflower', 'phyllotaxis', 'path', 'sphere', 'array', 'clone', 'matrix', 'wall', 'mosaic', 'build', 'object', 'vertices', 'points', 'text cloner', 'split text', 'words', 'letters', 'motext'],
  icon: 'grid',
  params: {
    mode: { type: 'enum', label: 'Mode', default: 'rect', options: MODE_OPTIONS },
    // v0.33 Cloner: one selected layer (or a few) becomes N copies on the grid — copies cycle through the sources
    clones: { type: 'integer', label: 'Clones', min: 0, max: 200, default: 0, description: 'Make this many items by copying the selected layer(s) — 0 arranges the selection as it is' },
    columns: { type: 'integer', label: 'Columns', min: 0, max: 100, default: 0, description: '0 = auto from the comp shape', showIf: (a) => a.mode === 'rect' },
    spacingX: { type: 'number', label: 'Spacing X', min: 0, max: 5000, step: 1, default: 0, unit: 'px', description: '0 = auto from layer sizes', showIf: (a) => a.mode === 'rect' },
    spacingY: { type: 'number', label: 'Spacing Y', min: 0, max: 5000, step: 1, default: 0, unit: 'px', description: '0 = auto', showIf: (a) => a.mode === 'rect' },
    rowOffset: { type: 'number', label: 'Row offset', min: -100, max: 100, step: 1, default: 0, unit: '%', description: 'Shift every other row (50 = honeycomb / brick)', showIf: (a) => a.mode === 'rect' },
    radius: { type: 'number', label: 'Radius', min: 0, max: 10000, step: 1, default: 0, unit: 'px', description: '0 = auto', showIf: (a) => ['radial', 'spiral', 'sphere'].includes(a.mode) },
    arc: { type: 'number', label: 'Arc', min: -360, max: 360, step: 1, default: 360, unit: '°', showIf: (a) => a.mode === 'radial' },
    pathLayer: { type: 'layer', label: 'Path layer', description: 'Shape or masked layer whose path the items follow (Path) or whose points they sit on (Points)', showIf: (a) => a.mode === 'path' || a.mode === 'points' || a.morphTo === 'path' || a.morphTo === 'points' },
    // v0.37 Text Cloner: one selected text layer → one item per word / letter, kept where it was (In Place)
    splitText: { type: 'enum', label: 'Split text', default: 'none', options: [{ value: 'none', label: 'Off' }, { value: 'words', label: 'Words' }, { value: 'letters', label: 'Letters' }], description: 'One selected text layer becomes one item per word (or letter — not for Arabic), placed exactly where it was; the original is hidden (restorable)', showIf: (a) => a.mode === 'keep' || (a.splitText && a.splitText !== 'none') },
    order: { type: 'enum', label: 'Order', default: '1', options: enumOf(L.ORDERS) },
    orient: { type: 'enum', label: 'Orient', default: '1', options: enumOf(L.ORIENTS), description: 'Forward = turn with the grid · Face Center = face the centre or the path · Face Screen = stay upright when the grid spins' },
    morphTo: { type: 'enum', label: 'Morph to', default: 'none', options: MORPH_OPTIONS, description: 'A second layout the grid can blend into with the Morph slider (0–100)' },
    animateMorph: { type: 'boolean', label: 'Animate morph', default: false, description: 'Keyframe Morph 0 → 100 (after the build-in, if any)', showIf: (a) => a.morphTo && a.morphTo !== 'none' && a.morphTo !== a.mode },
    morphDuration: { type: 'number', label: 'Morph time', min: 0.1, max: 20, step: 0.1, default: 1.5, unit: 's', showIf: (a) => a.animateMorph && a.morphTo && a.morphTo !== 'none' && a.morphTo !== a.mode },
    faceCenter: { type: 'boolean', label: 'Face center (old)', default: false, hidden: true, description: 'Kept for presets saved before v0.19 — same as Orient: Face Center' },
    animateIn: { type: 'boolean', label: 'Animate in', default: false, description: 'Keyframe Build 0 → 100 from the current time' },
    buildStyle: { type: 'enum', label: 'Build style', default: '1', options: enumOf(L.BUILD_STYLES), showIf: (a) => a.animateIn },
    buildOrder: { type: 'enum', label: 'Build order', default: '1', options: enumOf(L.BUILD_ORDERS), showIf: (a) => a.animateIn },
    buildDuration: { type: 'number', label: 'Build time', min: 0.1, max: 20, step: 0.1, default: 1.5, unit: 's', showIf: (a) => a.animateIn },
    stagger: { type: 'number', label: 'Stagger', min: 0, max: 100, step: 1, default: 60, unit: '%', showIf: (a) => a.animateIn },
    effector: { type: 'layer', label: 'Effector', advanced: true, description: 'Optional layer (e.g. a null) that scales / pushes nearby items' },
    centerAnchors: { type: 'boolean', label: 'Center anchors', default: true, advanced: true, description: 'Centre each item’s anchor on its content first (keyframed anchors are left alone)' },
    replace: { type: 'boolean', label: 'Replace existing', default: false, advanced: true, description: 'Overwrite expressions MOE did not create' }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers', 'modify.effects', 'modify.expressions'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Arrange selected layers in a grid / circle / spiral / sunflower / along a path / on a 3D sphere, optionally animating them in with a stagger, and optionally morphing into a second layout (morphTo, animateMorph). orient: 1 Forward, 2 Face Center, 3 Face Screen. Live controls on a MOE Grid null.' },
  uses: { hostOps: ['paths.find', 'text.split', 'text.unsplit', 'layers.clone', 'layers.cloneMany', 'layers.remove', 'layers.bounds', 'layers.centerAnchor', 'layers.createNull', 'effects.ensure', 'effects.setMenu', 'layers.setParent', 'expressions.set', 'keys.write', 'props.values', 'paths.find'], network: false },
  compatibility: { minAE: '25.0' },
  ui: {
    primaryLabel: 'Build Grid',
    presets: [
      { id: 'wall', label: 'Wall', args: { mode: 'rect', order: '1', animateIn: true, buildStyle: '4', buildOrder: '3' } },
      { id: 'brick', label: 'Honeycomb', args: { mode: 'rect', order: '1', rowOffset: 50 } },
      { id: 'ring', label: 'Ring', args: { mode: 'radial', arc: 360, orient: '2' } },
      { id: 'fan', label: 'Fan', args: { mode: 'radial', arc: 120, orient: '2' } },
      { id: 'galaxy', label: 'Galaxy', args: { mode: 'phyllo', animateIn: true, buildStyle: '1', buildOrder: '3' } },
      { id: 'globe', label: 'Globe', args: { mode: 'sphere' } },
      { id: 'gridRing', label: 'Grid → Ring', args: { mode: 'rect', morphTo: 'radial', animateMorph: true, orient: '1' } },
      { id: 'galaxyWall', label: 'Galaxy → Wall', args: { mode: 'phyllo', morphTo: 'rect', animateIn: true, buildStyle: '1', buildOrder: '3', animateMorph: true } }
    ]
  },

  prepare(args, ctx) {
    // v0.37: Path / Points with no path layer chosen — the one selected shape layer is the path (the rest are the items)
    if ((args.mode === 'path' || args.mode === 'points') && !args.pathLayer) {
      const sel = itemsOf(ctx, [args.effector].filter(Boolean)), shapes = sel.filter((l) => l.type === 'shape');
      if (sel.length >= 2 && shapes.length === 1) args = Object.assign({}, args, { pathLayer: shapes[0].index });
    }
    const exclude = [args.pathLayer, args.effector].filter(Boolean);
    const items = itemsOf(ctx, exclude);
    const clones = Math.round(args.clones || 0);
    const split = args.splitText && args.splitText !== 'none' ? args.splitText : null;
    const copies = !split && clones >= 2 && clones > items.length ? clones - items.length : 0;
    // v0.37 Points: one selected layer and no Clones count → one copy per point of the path (counted when it runs)
    const autoPoints = args.mode === 'points' && !split && items.length === 1 && !copies;
    if (!items.length) return { ok: false, error: split ? 'Select one text layer to split' : 'Select the layer(s) to clone or arrange' };
    if (split && (items.length !== 1 || items[0].type !== 'text')) return { ok: false, error: 'Select one text layer to split into words or letters' };
    if (items.length < 2 && !copies && !split && !autoPoints) return { ok: false, error: 'Select at least 2 layers to arrange — or set Clones to copy one layer' };
    // items already in a MOE Grid: building again would pull them out of it — say where to go instead
    const inGrid = items.filter((l) => l.parentIndex && (ctx.compLayers || []).some((g) => g.index === l.parentIndex && GRID_NAME.test(g.name)));
    if (inGrid.length) {
      const g = (ctx.compLayers || []).find((x) => x.index === inGrid[0].parentIndex);
      return { ok: false, error: `${inGrid.length === items.length ? 'These layers are' : `${inGrid.length} of these layers are`} already in ${g.name} — change it in "Your grid" (Layout & Grid), or Release it first` };
    }
    const locked = items.filter((l) => l.locked);
    if (locked.length) return { ok: false, error: `Unlock ${locked.map((l) => l.name).join(', ')} first` };
    const parented = items.filter((l) => l.parentIndex && !items.some((o) => o.index === l.parentIndex));
    if ((args.mode === 'path' || args.mode === 'points') && !args.pathLayer) return { ok: false, error: args.mode === 'points' ? 'Choose the shape or masked layer whose points the clones sit on' : 'Choose the path layer' };
    const name = nextGridName(ctx);
    const mode = L.MODES.find((m) => m.id === args.mode);
    return {
      ok: true, items, name, copies, split, autoPoints, pathLayer: args.pathLayer,
      preview: {
        summary: `${mode.label} of ${split ? `the ${split} of ${items[0].name}` : autoPoints ? `${items[0].name} on every point of the path` : `${items.length + copies} ${copies ? `clones (${items.length} source${items.length > 1 ? 's' : ''} + ${copies} copies)` : 'layers'}`} · ${name}${args.animateIn ? ' · animated in' : ''}${args.morphTo && args.morphTo !== 'none' && args.morphTo !== args.mode ? ` · morphs to ${L.MODES.find((m) => m.id === args.morphTo).label}${args.animateMorph ? ' (animated)' : ''}` : ''}`,
        items: [
          ...items.slice(0, 6).map((l) => l.name), ...(items.length > 6 ? [`+${items.length - 6} more`] : []),
          ...(args.mode === 'sphere' || args.morphTo === 'sphere' ? ['Items become 3D layers (restorable)'] : []),
          ...(copies ? [`${copies} copies named "MOE Clone n · <layer>" (removed on Restore)`] : []),
          ...(autoPoints ? ['One copy per point of the path ("MOE Clone n · <layer>", removed on Restore)'] : []),
          ...(split ? [`One text layer per ${split === 'letters' ? 'letter' : 'word'} ("MOE ${split === 'letters' ? 'Letter' : 'Word'} n · ${items[0].name}"), placed where it was — ${items[0].name} is hidden (Restore brings it back)`, ...(split === 'letters' ? ['Arabic text splits by words only (letters would disconnect)'] : [])] : []),
          'Layout, Morph and every control stay live on the grid null (Effect Controls)',
          ...(parented.length ? [`${parented.length} item(s) are re-parented to the grid (restorable)`] : [])
        ]
      }
    };
  },

  async execute({ args, ctx, prepared, host }) {
    const comp = ctx.comp;
    // the path first (v0.37 Points counts its points to know how many clones to make)
    let path = null;
    const usesPath = args.mode === 'path' || args.mode === 'points' || args.morphTo === 'path' || args.morphTo === 'points';
    if (prepared.pathLayer && !args.pathLayer) args = Object.assign({}, args, { pathLayer: prepared.pathLayer });
    if (usesPath && args.pathLayer) path = await host.call('paths.find', { compId: comp.id, layerId: ctx.compLayers.find((l) => l.index === args.pathLayer).id });
    let copiesWanted = prepared.copies;
    if (prepared.autoPoints) {
      if (!path || path.points < 2) { const e = new Error(`${path ? path.name : 'The path layer'} has ${path ? path.points : 0} point(s) — draw a shape with at least 2 points`); e.code = 'FEW_POINTS'; throw e; }
      copiesWanted = Math.min(path.points, 200) - 1;
    }
    // v0.37 Text Cloner: the text becomes one layer per word / letter, placed where it was; those are the items
    let split = null;
    let items = prepared.items;
    if (prepared.split) {
      split = await host.call('text.split', { compId: comp.id, layerId: prepared.items[0].id, by: prepared.split, max: 150 });
      items = split.pieces.map((p) => ({ id: p.layerId, name: p.name, threeD: false, locked: false, type: 'text' }));
    }
    // v0.33 Cloner: copies first (they keep the source's look, effects and keyframes), cycling through the sources
    const clonesMade = [];
    if (copiesWanted) {
      const srcs = prepared.items, per = srcs.map((_, si) => Math.floor(copiesWanted / srcs.length) + (si < copiesWanted % srcs.length ? 1 : 0));
      // v0.63: every source's copies in ONE host call (was one call per selected source)
      const want = srcs.map((src, si) => ({ src, si, count: per[si] })).filter((x) => x.count > 0);
      const many = want.length ? await host.call('layers.cloneMany', { compId: comp.id, label: 'MOE: Clone', plain: true, sources: want.map((x) => ({ layerId: x.src.id, count: x.count })) }) : { results: [] };
      const made = srcs.map(() => []);
      want.forEach((x, k) => {
        const r = many.results[k];
        made[x.si] = r.created.map((c) => ({ id: c.layerId, name: c.name, threeD: x.src.threeD, locked: false }));
        r.created.forEach((c) => clonesMade.push(c.layerId));
      });
      items = srcs.slice();
      for (let j = 0; j < Math.max(...per); j++) for (let si = 0; si < srcs.length; si++) if (made[si][j]) items.push(made[si][j]);
    }
    const anchors = args.centerAnchors !== false ? await host.call('layers.centerAnchor', { compId: comp.id, layers: items.map((l) => l.id) }) : null;
    const meas = await host.call('layers.bounds', { compId: comp.id, layerIds: items.map((l) => l.id), times: [comp.time] });
    const boxes = meas.layers.map((m) => m.boxes[0]).filter(Boolean);
    const maxW = Math.max(10, ...boxes.map((b) => b[2] - b[0])), maxH = Math.max(10, ...boxes.map((b) => b[3] - b[1]));
    const auto = L.autoParams({ n: items.length, maxW, maxH, compW: comp.width, compH: comp.height });
    const params = resolveParams(args, auto);
    const cx = boxes.length ? boxes.reduce((s, b) => s + (b[0] + b[2]) / 2, 0) / boxes.length : comp.width / 2;
    const cy = boxes.length ? boxes.reduce((s, b) => s + (b[1] + b[3]) / 2, 0) / boxes.length : comp.height / 2;
    const threeD = args.mode === 'sphere' || params.morphTo === 'sphere';
    let made3D = null;
    if (threeD) {
      const flat = items.filter((l) => !l.threeD);
      if (flat.length) made3D = await host.call('layers.setAttrs', { compId: comp.id, label: 'MOE: Make 3D', items: flat.map((l) => ({ layerId: l.id, threeDLayer: true })) });
    }
    const center = args.mode === 'path' || args.mode === 'points' ? [0, 0] : [Math.round(cx), Math.round(cy)];
    // v0.37 In Place: anchor = position, so the null's space is the comp's — parenting (setParentWithJump keeps the
    // values) leaves every item exactly where it was, and the null still turns / scales around the items' centre
    const keepSpace = args.mode === 'keep';
    const created = await host.call('layers.createNull', { compId: comp.id, name: prepared.name, position: threeD ? [center[0], center[1], 0] : center, anchor: keepSpace ? center : [0, 0], label: 13, threeD, undoLabel: 'MOE: Grid Null' });
    // Layer controls take layer indices — read them after the null was added.
    const desc = await host.call('layers.describe', { compId: comp.id });
    const idxOf = (oldIndex) => { const cl = ctx.compLayers.find((l) => l.index === oldIndex); const d = cl && desc.layers.find((x) => x.id === cl.id); return d ? d.index : 0; };
    const controls = await host.call('effects.ensure', {
      compId: comp.id, label: 'MOE: Grid Controls',
      layers: [{ layer: { layerId: created.layerId }, items: X.controlItems(args.mode, params, (name) => (name === 'Path Layer' ? idxOf(args.pathLayer) : name === 'Effector' && args.effector ? idxOf(args.effector) : 0)) }]
    });
    for (const [name, list, value] of [['Layout', X.MODE_MENU, params.layoutIdx], ['Morph To', X.MODE_MENU, params.morphToIdx], ['Orient', L.ORIENTS, params.orient], ['Order', L.ORDERS, params.order], ['Build Order', L.BUILD_ORDERS, params.buildOrder], ['Build Style', L.BUILD_STYLES, params.buildStyle]]) {
      await host.call('effects.setMenu', { compId: comp.id, layerId: created.layerId, effectKey: name, items: list, value });
    }
    const targets = [];
    items.forEach((l) => { for (const prop of Object.keys(X.PROP_ADDR)) targets.push({ layer: l, prop, address: { layerId: l.id, matchNames: X.PROP_ADDR[prop] } }); });
    const peek = await host.call('expressions.peek', { compId: comp.id, items: targets.map((t) => ({ address: t.address })) });
    const conflicts = targets.filter((t, i) => peek.items[i].expression && !peek.items[i].expression.startsWith(X.TAG));
    if (conflicts.length && !args.replace) {
      await host.call('layers.remove', { compId: comp.id, layerIds: [created.layerId], onlyNamed: 'MOE Grid' });
      if (made3D) await host.call('layers.setAttrs', { compId: comp.id, items: made3D.layers.map((x) => ({ layerId: x.layerId, threeDLayer: false })) });
      if (anchors) await host.call('layers.restoreTransform', { compId: comp.id, layers: anchors.layers.filter((a) => !a.skipped).map((a) => ({ layerId: a.layerId, anchor: a.before.anchor, position: a.before.position })) });
      if (split) await host.call('text.unsplit', { compId: comp.id, layerIds: split.pieces.map((p) => p.layerId), sourceId: split.sourceId, sourceEnabled: split.sourceEnabled });
      if (clonesMade.length) await host.call('layers.remove', { compId: comp.id, layerIds: clonesMade, onlyNamed: 'MOE Clone ' });
      const e = new Error(`These properties already have your own expressions: ${[...new Set(conflicts.map((c) => `${c.layer.name} › ${c.prop}`))].slice(0, 6).join(', ')}. Turn on "Replace existing" to overwrite (restorable).`);
      e.code = 'EXPRESSION_CONFLICT';
      throw e;
    }
    const parented = await host.call('layers.setParent', { compId: comp.id, label: 'MOE: Grid Parent', items: items.map((l) => ({ layerId: l.id, parentId: created.layerId })) });
    // home = where each item sits in the null's space now: the expression adds (value − home), so a
    // later hand nudge (or the layer's own Position keys) plays on top of the grid
    const homes = await host.call('props.values', { compId: comp.id, time: comp.time, items: items.map((l) => ({ address: { layerId: l.id, matchNames: X.PROP_ADDR.position } })) });
    items.forEach((l, i) => {
      const hv = homes.items[i].value || [0, 0];
      const code = X.buildAll(i, items.length, { gridName: prepared.name, pathAccess: path && path.access, pathClosed: path && path.closed, home: [hv[0], hv[1]] });
      targets.filter((t) => t.layer === l).forEach((t) => { t.expression = code[t.prop]; });
    });
    const set = await host.call('expressions.set', { compId: comp.id, label: 'MOE: Grid', revertOnError: true, targets: targets.map((t) => ({ address: t.address, expression: t.expression, enabled: true })) });
    let keys = null, morphKeys = null;
    let checkTime = comp.time;
    if (args.animateIn) {
      const t0 = comp.time, t1 = comp.time + args.buildDuration;
      keys = await host.call('keys.write', { compId: comp.id, label: 'MOE: Grid Build', items: [{ address: X.controlAddress(created.layerId, 'Build'), keys: [{ t: t0, v: 0, easeOut: { speed: 0, influence: 20 } }, { t: t1, v: 100, easeIn: { speed: 0, influence: 75 } }] }] });
      checkTime = t1;
    }
    if (args.animateMorph && params.morphTo) {
      const m0 = checkTime, m1 = checkTime + args.morphDuration;
      morphKeys = await host.call('keys.write', { compId: comp.id, label: 'MOE: Grid Morph', items: [{ address: X.controlAddress(created.layerId, 'Morph'), keys: [{ t: m0, v: 0, easeOut: { speed: 0, influence: 50 } }, { t: m1, v: 100, easeIn: { speed: 0, influence: 50 } }] }] });
      checkTime = m1;
    }
    const read = await host.call('props.values', { compId: comp.id, time: checkTime, items: items.map((l) => ({ address: { layerId: l.id, matchNames: X.PROP_ADDR.position } })) });
    const finalParams = Object.assign({}, params, { build: 100, morph: morphKeys ? 100 : 0 });
    // v0.37 In Place: the items must not move (they stay where they were built); Points / Path depend on the path
    const keepPlace = args.mode === 'keep' && !params.morphTo && !args.effector;
    let keepCheck = null;
    if (keepPlace) {
      // read back where every item really is in the comp now (its box), against where it was before the grid
      const after = await host.call('layers.bounds', { compId: comp.id, layerIds: items.map((l) => l.id), times: [checkTime] });
      const ctr = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
      keepCheck = meas.layers.map((m, i) => { const b0 = m.boxes[0], b1 = after.layers[i] && after.layers[i].boxes[0]; return b0 && b1 ? Math.hypot(ctr(b1)[0] - ctr(b0)[0], ctr(b1)[1] - ctr(b0)[1]) : Infinity; });
    }
    const predicted = keepPlace ? null : ['path', 'points', 'keep'].includes(args.mode) || ['path', 'points', 'keep'].includes(params.morphTo) || args.effector ? null : L.placeMorph(finalParams, items.length).map((it) => { const m = L.modifiers(finalParams, it, items.length); return [it.x + m.dx, it.y + m.dy]; });
    return { split, keepCheck, path: path ? { name: path.name, points: path.points } : null, name: prepared.name, nullId: created.layerId, params, controls, set, parented, anchors, made3D, keys, morphKeys, read, predicted, clonesMade, items: items.map((l) => ({ id: l.id, name: l.name })) };
  },

  verify({ result }) {
    const checks = [];
    const nCtl = result.controls.layers[0].items.length;
    checks.push({ ok: true, label: result.name, detail: `grid null with ${nCtl} controls (Effect Controls)` });
    const bad = result.set.targets.filter((t) => t.skipped || t.reverted || t.after.expressionError);
    checks.push({ ok: bad.length === 0, label: 'Expressions', detail: bad.length ? `${bad.length} failed: ${bad.slice(0, 3).map((t) => `${t.layerName} › ${t.name}: ${t.after ? t.after.expressionError : t.skipped}`).join('; ')}` : `${result.set.targets.length} live expressions, no engine errors` });
    checks.push({ ok: result.parented.layers.every((l) => l.after === result.nullId), label: 'Parenting', detail: `${result.parented.layers.length} item(s) follow ${result.name}` });
    if (result.keepCheck) {
      const worst = Math.max(...result.keepCheck);
      checks.push({ ok: worst < 0.6, label: 'Layout read-back', detail: worst < 0.6 ? `${result.keepCheck.length} items stay exactly where they were in the comp (±0.5 px)` : `an item moved by ${worst.toFixed(1)} px` });
    } else if (result.predicted) {
      // items with their own Position keys move on top of the grid — compare the others
      const off = result.read.items.map((r, i) => (r.numKeys ? 0 : r.value ? Math.hypot(r.value[0] - result.predicted[i][0], r.value[1] - result.predicted[i][1]) : Infinity));
      const worst = Math.max(...off);
      checks.push({ ok: worst < 0.6, label: 'Layout read-back', detail: worst < 0.6 ? `${off.length} positions match the preview (±0.5 px)` : `position differs by ${worst.toFixed(1)} px` });
    } else {
      const errs = result.read.items.filter((r) => r.error);
      checks.push({ ok: errs.length === 0, label: 'Layout read-back', detail: errs.length ? errs[0].error : `${result.read.items.length} positions evaluated` });
    }
    if (result.clonesMade && result.clonesMade.length) checks.push({ ok: result.clonesMade.every((id) => result.items.some((it) => it.id === id)) && result.parented.layers.length === result.items.length, label: 'Clones', detail: `${result.clonesMade.length} copies made, ${result.items.length} items on the grid` });
    if (result.split) checks.push({ ok: result.split.pieces.length >= 2 && result.split.pieces.every((p) => result.items.some((it) => it.id === p.layerId)), label: 'Text split', detail: `${result.split.pieces.length} ${result.split.by} placed where they were — the original is hidden (Restore brings it back)` });
    if (result.path && result.path.points && result.clonesMade && result.clonesMade.length) checks.push({ ok: result.items.length === Math.min(result.path.points, 200), label: 'Points', detail: `one item on each of the ${result.path.points} points of ${result.path.name}` });
    if (result.keys) checks.push({ ok: result.keys.items[0].written.length === 2, label: 'Build', detail: 'Build 0 → 100 keyframed' });
    if (result.morphKeys) checks.push({ ok: result.morphKeys.items[0].written.length === 2, label: 'Morph', detail: 'Morph 0 → 100 keyframed' });
    return { ok: checks.every((c) => c.ok), checks };
  },

  checkpoint({ result, ctx }) {
    return {
      compId: ctx.comp.id, nullId: result.nullId,
      expressions: result.set.targets.filter((t) => !t.skipped && !t.reverted).map((t) => ({ address: t.address, expression: t.before.expression, enabled: t.before.expressionEnabled })),
      parents: result.parented.layers.map((l) => ({ layerId: l.layerId, parentId: l.before })),
      anchors: result.anchors ? result.anchors.layers.filter((a) => !a.skipped).map((a) => ({ layerId: a.layerId, anchor: a.before.anchor, position: a.before.position })) : [],
      made3D: result.made3D ? result.made3D.layers.map((l) => l.layerId) : [],
      clones: result.clonesMade || [],
      split: result.split ? { layerIds: result.split.pieces.map((p) => p.layerId), sourceId: result.split.sourceId, sourceEnabled: result.split.sourceEnabled } : null
    };
  },

  async restore({ data, host }) {
    if (data.expressions.length) await host.call('expressions.set', { compId: data.compId, label: 'MOE: Restore Grid', revertOnError: false, targets: data.expressions });
    await host.call('layers.setParent', { compId: data.compId, label: 'MOE: Restore Grid', items: data.parents });
    await host.call('layers.remove', { compId: data.compId, layerIds: [data.nullId], onlyNamed: 'MOE Grid' });
    if (data.anchors.length) await host.call('layers.restoreTransform', { compId: data.compId, layers: data.anchors });
    if (data.made3D.length) await host.call('layers.setAttrs', { compId: data.compId, items: data.made3D.map((id) => ({ layerId: id, threeDLayer: false })) });
    // v0.33: the copies the Cloner made go (only layers named "MOE Clone …")
    if (data.clones && data.clones.length) await host.call('layers.remove', { compId: data.compId, layerIds: data.clones, onlyNamed: 'MOE Clone ' });
    // v0.37: the words / letters go and the original text comes back
    if (data.split) await host.call('text.unsplit', Object.assign({ compId: data.compId }, data.split));
    return { ok: true };
  },

  summarize(result, v) { return v.ok ? `${result.name}: ${result.items.length} ${result.clonesMade && result.clonesMade.length ? 'clones' : 'layers'} arranged` : 'Grid built with problems'; }
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
  ai: { callable: true, hint: 'Tweak an existing MOE Grid (select its null). values is JSON keyed by control name: Layout (1 Grid, 2 Radial, 3 Spiral, 4 Sunflower, 5 Path, 6 Sphere), Morph To, Morph (0-100), Orient (1-3), Columns, Spacing X/Y, Row Offset, Radius, Arc, Twist, Item Scale, Scale Step, Random Position/Rotation/Scale, Seed, Build, Build Stagger, Build Distance, Effector Radius/Scale/Push/Rotate/Fade…' },
  uses: { hostOps: ['props.setValues'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Apply' },
  prepare(args, ctx) {
    const g = gridOf(ctx, args);
    if (!g) return { ok: false, error: 'Select a MOE Grid null' };
    let values;
    try { values = JSON.parse(args.values || '{}'); } catch (e) { return { ok: false, error: 'Values must be JSON' }; }
    const known = new Set(X.allControls().filter((c) => c[1] !== 'layer').map((c) => c[0]));
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

/* ---------- v0.19 items: order + per-item tweaks ---------- */

const SORTS = [{ value: 'custom', label: 'My order' }, { value: 'layer', label: 'Layer order' }, { value: 'name', label: 'Name A→Z' }, { value: 'reverse', label: 'Reverse' }, { value: 'shuffle', label: 'Shuffle' }];

/** The grid a selection points to: the selected grid null, or the null the selected items follow. */
function gridFor(ctx, args) {
  const g = gridOf(ctx, args);
  if (g) return g;
  const kid = (ctx.layers || []).find((l) => l.parentIndex);
  const parent = kid && (ctx.compLayers || []).find((l) => l.index === kid.parentIndex);
  return parent && GRID_NAME.test(parent.name) ? parent : null;
}

/** New slot order (array of layer ids, slot 0 first) for a sort. items: [{ id, name, index, slot }]. */
function sortSlots(items, sort, args) {
  const bySlot = items.slice().sort((a, b) => a.slot - b.slot);
  if (sort === 'layer') return items.slice().sort((a, b) => a.index - b.index).map((x) => x.id);
  if (sort === 'name') return items.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }) || a.index - b.index).map((x) => x.id);
  if (sort === 'reverse') return bySlot.reverse().map((x) => x.id);
  if (sort === 'shuffle') { const pm = L.permutation(items.length, args.seed || 1); return pm.map((j) => bySlot[j].id); }
  let ids; try { ids = JSON.parse(args.order || '[]'); } catch (e) { ids = null; }
  return Array.isArray(ids) ? ids.map(Number) : null;
}

const items = {
  id: 'grid.items',
  version: '1.0.0',
  category: 'layout',
  group: 'Grid',
  name: 'Grid Items',
  description: 'Change which item sits in which place of a MOE Grid — drag to reorder, sort by layer order or name, reverse, shuffle — without touching the layer stack. Or give the selected items their own Twist and build Delay.',
  keywords: ['grid', 'order', 'reorder', 'sort', 'slots', 'shuffle', 'twist', 'delay', 'stagger', 'items'],
  icon: 'grid',
  params: {
    action: { type: 'enum', label: 'Action', default: 'order', options: [{ value: 'order', label: 'Order' }, { value: 'tweak', label: 'Tweak items' }] },
    gridId: { type: 'integer', label: 'Grid', hidden: true },
    sort: { type: 'enum', label: 'Order by', default: 'layer', options: SORTS, showIf: (a) => a.action !== 'tweak' },
    order: { type: 'text', label: 'My order', maxLength: 8000, hidden: true, description: 'JSON list of layer ids, first = slot 1 (set by the panel list)' },
    seed: { type: 'integer', label: 'Seed', min: 1, max: 9999, default: 1, showIf: (a) => a.action !== 'tweak' && a.sort === 'shuffle' },
    twist: { type: 'number', label: 'Twist', min: -720, max: 720, step: 1, default: 0, unit: '°', description: 'Extra rotation for the selected items', showIf: (a) => a.action === 'tweak' },
    delay: { type: 'number', label: 'Delay', min: -100, max: 100, step: 1, default: 0, unit: '%', description: 'Build later (+) or earlier (−) than their turn', showIf: (a) => a.action === 'tweak' }
  },
  requires: { comp: true },
  permissions: ['modify.expressions', 'modify.effects'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Reorder the items of a MOE Grid (sort: layer, name, reverse, shuffle) or give selected grid items their own twist (deg) / delay (%) — action order | tweak.' },
  uses: { hostOps: ['layers.describe', 'proximity.scan', 'expressions.peek', 'expressions.set', 'effects.ensure'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Apply' },
  prepare(args, ctx) {
    const g = gridFor(ctx, args);
    if (!g) return { ok: false, error: 'Select a MOE Grid null (or some of its items)' };
    if (args.action === 'tweak') {
      const sel = (ctx.layers || []).filter((l) => l.parentIndex === g.index);
      if (!sel.length) return { ok: false, error: `Select the items of ${g.name} to tweak` };
      return { ok: true, grid: g, sel, preview: { summary: `${sel.length} item(s) of ${g.name}: twist ${args.twist}° · delay ${args.delay}%`, items: sel.slice(0, 6).map((l) => l.name) } };
    }
    return { ok: true, grid: g, preview: { summary: `${g.name}: ${SORTS.find((o) => o.value === args.sort).label}`, items: ['Only the places change — the layer stack stays as it is'] } };
  },
  async execute({ args, ctx, prepared, host }) {
    const comp = ctx.comp;
    if (args.action === 'tweak') {
      const req = prepared.sel.map((l) => ({ layer: { layerId: l.id }, items: [
        { key: X.ITEM_FX.twist, matchName: 'ADBE Angle Control', before: [], params: [{ id: 'twist', value: args.twist, names: ['Angle'], suffix: 1 }] },
        { key: X.ITEM_FX.delay, matchName: 'ADBE Slider Control', before: [], params: [{ id: 'delay', value: args.delay, names: ['Slider'], suffix: 1 }] }
      ] }));
      // only v0.19 grids read these effects
      const scan = await host.call('proximity.scan', { compId: comp.id, layerIds: prepared.sel.map((l) => l.id), tag: X.TAG });
      const peek = scan.expressions.length ? await host.call('expressions.peek', { compId: comp.id, items: scan.expressions.map((a) => ({ address: a })) }) : { items: [] };
      if (!peek.items.some((x) => X.isV2(x.expression))) { const e = new Error(`${prepared.grid.name} was built before v0.19 — rebuild it (Release › Remove, then Grid Builder) to tweak single items`); e.code = 'OLD_GRID'; throw e; }
      const fx = await S.writeEffects(host, ctx, req, 'MOE: Grid Item Tweaks');
      return { action: 'tweak', fx, req };
    }
    const desc = await host.call('layers.describe', { compId: comp.id });
    const kids = desc.layers.filter((l) => l.parentId === prepared.grid.id);
    const scan = kids.length ? await host.call('proximity.scan', { compId: comp.id, layerIds: kids.map((l) => l.id), tag: X.TAG }) : { expressions: [] };
    const peek = scan.expressions.length ? await host.call('expressions.peek', { compId: comp.id, items: scan.expressions.map((a) => ({ address: a })) }) : { items: [] };
    const exprs = scan.expressions.map((a, j) => ({ address: a, code: peek.items[j].expression })).filter((e) => X.slotOf(e.code));
    const list = kids.map((l) => { const e = exprs.find((x) => x.address.layerId === l.id); return e ? { id: l.id, name: l.name, index: l.index, slot: X.slotOf(e.code).i } : null; }).filter(Boolean);
    if (list.length < 2) { const e = new Error(`${prepared.grid.name} has fewer than 2 items`); e.code = 'NO_ITEMS'; throw e; }
    const order = sortSlots(list, args.sort, args);
    if (!order || order.length !== list.length || !list.every((x) => order.includes(x.id))) { const e = new Error('The order must list every item of the grid once'); e.code = 'BAD_ORDER'; throw e; }
    // keep the grid's own slot numbers (0..n-1 as built) — only who sits where changes
    const slots = list.map((x) => x.slot).sort((a, b) => a - b);
    const newSlot = new Map(order.map((id, j) => [id, slots[j]]));
    const targets = exprs.filter((e) => newSlot.get(e.address.layerId) !== X.slotOf(e.code).i).map((e) => ({ address: e.address, expression: X.withSlot(e.code, newSlot.get(e.address.layerId)), enabled: true }));
    const set = targets.length ? await host.call('expressions.set', { compId: comp.id, label: 'MOE: Grid Order', revertOnError: true, targets }) : { targets: [] };
    return { action: 'order', list, order, newSlot: [...newSlot.entries()], set };
  },
  verify({ result }) {
    if (result.action === 'tweak') return S.verifyEffects(result.fx, result.req);
    const want = new Map(result.newSlot);
    const bad = result.set.targets.filter((t) => t.skipped || t.reverted || (t.after && t.after.expressionError) || !X.slotOf(t.after && t.after.expression) || X.slotOf(t.after.expression).i !== want.get(t.address.layerId));
    return { ok: bad.length === 0, checks: [{ ok: bad.length === 0, label: 'Order', detail: bad.length ? `${bad.length} expression(s) not updated` : result.set.targets.length ? `${new Set(result.set.targets.map((t) => t.address.layerId)).size} item(s) moved to new places — layer stack unchanged` : 'already in this order' }] };
  },
  checkpoint({ result, ctx }) {
    if (result.action === 'tweak') return Object.assign({ action: 'tweak' }, S.effectsCheckpoint(result.fx, ctx));
    return { action: 'order', compId: ctx.comp.id, expressions: result.set.targets.filter((t) => !t.skipped).map((t) => ({ address: t.address, expression: t.before.expression, enabled: t.before.expressionEnabled })) };
  },
  async restore({ data, host }) {
    if (data.action === 'tweak') return S.restoreEffects({ data, host });
    if (data.expressions.length) await host.call('expressions.set', { compId: data.compId, label: 'MOE: Restore Grid Order', revertOnError: false, targets: data.expressions });
    return { ok: true };
  },
  summarize(result, v) { return result.action === 'tweak' ? `${result.req.length} grid item(s) tweaked` : (v.ok ? 'Grid order changed' : 'Grid order: problems'); }
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

/* ---------- v0.53 guide presets (features/grid/guidePresets.js) ---------- */

const GP = require('./guidePresets');
const guidePreset = {
  id: 'grid.guidePreset',
  version: '1.0.0',
  category: 'layout',
  group: 'Layout Grid',
  name: 'Guide Preset',
  description: 'One click for the guides you add every day: Centre, Golden ratio, broadcast Title / Action safe, and the safe zones of TikTok, Reels, Shorts and Stories (where the app covers your video). Clear removes every guide.',
  keywords: ['guides', 'safe zone', 'safe area', 'title safe', 'action safe', 'tiktok', 'reels', 'shorts', 'stories', 'instagram', 'youtube', 'social', 'golden ratio', 'centre', 'center', 'clear guides', 'دليل', 'منطقة آمنة'],
  icon: 'guides',
  params: {
    preset: { type: 'enum', label: 'Guides', default: 'center', options: GP.PRESETS.map((p) => ({ value: p.id, label: p.group === 'Social' ? `${p.label} safe zone` : p.label })) },
    replaceAll: { type: 'boolean', label: 'Clear existing guides first', default: false, showIf: (a) => a.preset !== 'clear' }
  },
  requires: { comp: true },
  permissions: ['modify.layers'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Add a guide preset (center, golden, tvSafe, tiktok, reels, shorts, stories) or clear all guides.' },
  uses: { hostOps: ['guides.set'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Add Guides' },
  prepare(args, ctx) {
    const P = GP.byId(args.preset);
    if (!P) return { ok: false, error: `Unknown guide preset ${args.preset}` };
    const g = GP.lines(args.preset, ctx.comp.width, ctx.comp.height);
    if (g.error) return { ok: false, error: g.error };
    const n = g.v.length + g.h.length;
    const summary = args.preset === 'clear' ? 'Remove every guide in the comp' : `${P.label}${P.social ? ' safe zone' : ''} · ${n} guides${g.box ? ` · safe ${Math.round(g.box.w)}×${Math.round(g.box.h)} px` : ''}${g.note ? ` · ${g.note}` : ''}${P.social ? ' · approximate, apps change their UI' : ''}`;
    return { ok: true, g, preview: { summary, items: [] } };
  },
  async execute({ args, ctx, prepared, host }) {
    if (args.preset === 'clear') return Object.assign(await host.call('guides.set', { compId: ctx.comp.id, add: [], clearAll: true }), { preset: 'clear' });
    const add = [...prepared.g.v.map((x) => ({ o: 1, pos: x })), ...prepared.g.h.map((y) => ({ o: 0, pos: y }))];
    return Object.assign(await host.call('guides.set', { compId: ctx.comp.id, add, clearAll: !!args.replaceAll, skipSame: !args.replaceAll }), { preset: args.preset });
  },
  verify({ result, prepared, args }) {
    if (args.preset === 'clear') return { ok: result.total === 0, checks: [{ ok: result.total === 0, label: 'Guides cleared', detail: `${result.cleared.length} removed · ${result.total} left` }] };
    const n = prepared.g.v.length + prepared.g.h.length, got = result.added.length + (result.skipped || 0);
    return { ok: got === n, checks: [{ ok: got === n, label: 'Guides', detail: `${result.added.length} added${result.skipped ? ` · ${result.skipped} already there` : ''} · ${result.total} in comp` }] };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, added: result.added, cleared: result.cleared || [] }; },
  async restore({ data, host }) { return host.call('guides.set', { compId: data.compId, remove: data.added, add: data.cleared }); },
  summarize(result) { return result.preset === 'clear' ? `${result.cleared.length} guides removed` : `${result.added.length} guides added`; }
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

module.exports = { build, update, items, remove, guides, guidePreset, placeInCells, layoutGuides, resolveParams, sortSlots, gridFor, GRID_NAME };
