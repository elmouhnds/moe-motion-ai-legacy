'use strict';
/**
 * Anchor & Align (v0.9): Motion-4-style layer tools.
 *   transform.anchor  anchor to one of nine points of the content box — the layer does not move
 *   transform.align   align / distribute selected layers to the selection or the comp
 *   transform.clone   N copies of one layer: radial (ring / fan), linear or grid
 * Maths in ./math.js (pure). Host ops in host/ops/transform.jsx; each run is one undo step with an
 * exact MOE restore.
 */
const M = require('./math');

const ADDR = (id, mn) => ({ layerId: id, matchNames: ['ADBE Transform Group', mn] });
const visual = (ctx) => (ctx.layers || []).filter((l) => !['camera', 'light'].includes(l.type) && !l.locked);
const close = (a, b) => Math.abs(a - b) <= 0.01;
const SKIP = { LOCKED: 'locked', NO_BOUNDS: 'no visible content', NO_ANCHOR: 'no anchor point', PARENT_3D: 'a parent is rotated in 3D' };
const flat = (snap) => snap.parts.map((p) => (p.keys ? p.keys : [p.value]));

/** Expected position snapshot after a shift d = [dx, dy, dz] (static, keyframed, separated, 3D). */
function shiftedSnap(snap, d) {
  return snap.parts.map((p, i) => (p.keys || [p.value]).map((v) => (snap.separated ? v + (d[i] || 0) : v.map((x, k) => x + (d[k] || 0)))));
}
const r2 = (n) => Math.round(n * 100) / 100;
function sameSnap(a, b) { return JSON.stringify(a.map((x) => x.map((v) => [].concat(v).map(r2)))) === JSON.stringify(b.map((x) => x.map((v) => [].concat(v).map(r2)))); }

/* ---------------- anchor ---------------- */
const anchor = {
  id: 'transform.anchor', version: '2.0.0', category: 'layout', group: 'Anchor & Align', name: 'Anchor Point',
  description: 'Move the anchor to a corner, an edge or the centre of each layer — the layer does not move. Keeps every keyframe (position, separated X/Y, a keyed anchor), works on scaled, rotated, parented and 3D layers. Alt: also place the layer at the same point of the comp.',
  keywords: ['anchor', 'anchor point', 'pivot', 'center anchor', 'corner', 'bottom', 'motion 4', 'pan behind', 'centre'],
  icon: 'anchor',
  params: {
    point: { type: 'enum', label: 'Point', default: 'c', options: Object.keys(M.POINTS).map((v) => ({ value: v, label: M.POINT_LABEL[v] })) },
    masks: { type: 'boolean', label: 'Use masks', default: false, description: 'Take the box from the layer\'s masks instead of its content' },
    place: { type: 'boolean', label: 'Also place in comp', default: false, description: 'Move the layer so that point sits on the same point of the comp (Alt-click in the Motion Kit)' }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers'], recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Move the anchor point to centre / a corner / an edge of the selected layers without moving them (e.g. scale from the bottom, rotate around a corner); place=true also puts the layer at that point of the comp.' },
  uses: { hostOps: ['layers.moveAnchor', 'layers.restoreAnchor'], network: false }, compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Set Anchor' },
  prepare(args, ctx) {
    const l = visual(ctx);
    if (!l.length) return { ok: false, error: 'Select unlocked layers' };
    return { ok: true, layers: l, preview: { summary: `Anchor → ${M.POINT_LABEL[args.point].toLowerCase()} on ${l.length} layer${l.length > 1 ? 's' : ''}${args.place ? ', placed in the comp' : ''}`, items: l.slice(0, 6).map((x) => x.name) } };
  },
  async execute({ args, ctx, prepared, host }) {
    const [fx, fy] = M.POINTS[args.point];
    return host.call('layers.moveAnchor', { compId: ctx.comp.id, label: `MOE: Anchor ${M.POINT_LABEL[args.point]}`, layers: prepared.layers.map((x) => x.id), fx, fy, masks: !!args.masks, place: !!args.place, compSize: [ctx.comp.width, ctx.comp.height] });
  },
  verify({ result }) {
    const checks = result.layers.map((l) => {
      if (l.skipped) return { ok: true, label: l.name, detail: `skipped — ${SKIP[l.skipped] || l.skipped}` };
      const a = l.anchorAt.slice(0, 2).every((v, i) => close(v, l.target[i]));
      const p = sameSnap(flat(l.after.pos), shiftedSnap(l.before.pos, l.delta));
      const note = l.notes && l.notes.length ? ` · ${l.notes.join(' · ')}` : '';
      return { ok: a && p, label: l.name, detail: a && p ? `anchor ${l.anchorAt.slice(0, 2).map((v) => v.toFixed(1)).join(', ')} · ${l.notes && l.notes.includes('placed in the comp') ? 'placed' : 'layer kept in place'}${note.replace(' · placed in the comp', '')}` : `anchor ${a ? 'ok' : 'wrong'}, position ${p ? 'ok' : 'wrong'}` };
    });
    return { ok: result.layers.some((l) => !l.skipped) && checks.every((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, layers: result.layers.filter((l) => !l.skipped).map((l) => ({ layerId: l.layerId, anchor: l.before.anchor, pos: l.before.pos })) }; },
  async restore({ data, host }) { return host.call('layers.restoreAnchor', data); },
  summarize(result) { const n = result.layers.filter((l) => !l.skipped).length; return `Anchor moved on ${n} layer${n === 1 ? '' : 's'}`; }
};

/* ---------------- align & distribute ---------------- */
const ALIGN = [['left', 'Left'], ['hcenter', 'Centre ↔'], ['right', 'Right'], ['top', 'Top'], ['vcenter', 'Middle ↕'], ['bottom', 'Bottom'], ['distH', 'Distribute centres ↔'], ['distV', 'Distribute centres ↕'], ['spaceH', 'Space evenly ↔'], ['spaceV', 'Space evenly ↕']];
const align = {
  id: 'transform.align', version: '2.0.0', category: 'layout', group: 'Anchor & Align', name: 'Align & Distribute',
  description: 'Align the selected layers by their visible edges or centres — to the selection, to a key layer (the first selected stays) or to the comp — distribute their centres, or space them with equal (or fixed) gaps. The whole animation moves (every Position key), parented layers included.',
  keywords: ['align', 'distribute', 'center', 'left', 'right', 'top', 'bottom', 'spacing', 'even'],
  icon: 'layout',
  params: {
    mode: { type: 'enum', label: 'Align', default: 'hcenter', options: ALIGN.map(([value, label]) => ({ value, label })) },
    to: { type: 'enum', label: 'To', default: 'selection', options: [{ value: 'selection', label: 'Selection' }, { value: 'key', label: 'Key layer (first selected)' }, { value: 'comp', label: 'Comp' }] },
    gap: { type: 'number', label: 'Gap', min: -5000, max: 5000, step: 1, default: 20, unit: 'px', showIf: (a) => /^space/.test(a.mode) && a.fixedGap, description: 'Fixed gap between the layers' },
    fixedGap: { type: 'boolean', label: 'Fixed gap', default: false, showIf: (a) => /^space/.test(a.mode), description: 'Off: equal gaps across the current span (the first and the last stay)' }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers'], recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Align layers left/centre/right/top/middle/bottom to each other or to the comp, or distribute them evenly.' },
  uses: { hostOps: ['layers.bounds', 'layers.nudge', 'layers.restorePosition'], network: false }, compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Align' },
  prepare(args, ctx) {
    const l = visual(ctx);
    const dist = /^(dist|space)/.test(args.mode);
    const need = /^space/.test(args.mode) && args.fixedGap ? 2 : 3;
    if (dist && l.length < need) return { ok: false, error: `Select at least ${need} layers to ${need === 2 ? 'space' : 'distribute'}` };
    if (!dist && args.to !== 'comp' && l.length < 2) return { ok: false, error: `Select at least 2 layers (or align to the comp)` };
    if (!l.length) return { ok: false, error: 'Select unlocked layers' };
    const label = ALIGN.find((a) => a[0] === args.mode)[1];
    return { ok: true, layers: l, preview: { summary: `${label}${dist ? (/^space/.test(args.mode) && args.fixedGap ? ` · gap ${args.gap} px` : '') : ` to ${args.to === 'key' ? `${l[0].name} (key)` : args.to}`} · ${l.length} layer${l.length > 1 ? 's' : ''}`, items: [] } };
  },
  async execute({ args, ctx, prepared, host }) {
    const b = await host.call('layers.bounds', { compId: ctx.comp.id, layerIds: prepared.layers.map((x) => x.id), times: [ctx.comp.time] });
    // keep the selection order (the key layer is the first selected)
    const byId = new Map(b.layers.filter((x) => x.boxes && x.boxes[0]).map((x) => [x.layerId, x.boxes[0]]));
    const boxes = prepared.layers.filter((x) => byId.has(x.id)).map((x) => ({ layerId: x.id, box: byId.get(x.id) }));
    const moves = M.align(boxes, args.mode, args.to, ctx.comp, { gap: args.fixedGap ? args.gap : null });
    if (!moves.length) return { layers: [], already: true };
    return host.call('layers.nudge', { compId: ctx.comp.id, label: 'MOE: Align', items: moves });
  },
  verify({ result }) {
    if (result.already) return { ok: true, checks: [{ ok: true, label: 'Layers', detail: 'already aligned' }] };
    const checks = result.layers.map((l) => (l.skipped ? { ok: true, label: l.name, detail: `skipped — ${SKIP[l.skipped] || l.skipped}` }
      : { ok: sameSnap(flat(l.after), shiftedSnap(l.before, l.delta)), label: l.name, detail: `moved ${l.delta.map((v) => v.toFixed(1)).join(', ')} px${l.parented ? ' (in the parent\'s space)' : ''}` }));
    return { ok: checks.every((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, layers: (result.layers || []).filter((l) => !l.skipped).map((l) => ({ layerId: l.layerId, pos: l.before })) }; },
  async restore({ data, host }) { return data.layers.length ? host.call('layers.restorePosition', data) : { restored: 0 }; },
  summarize(result) { return result.already ? 'Already aligned' : `Aligned ${result.layers.filter((l) => !l.skipped).length} layer(s)`; }
};

/* ---------------- clone ---------------- */
const clone = {
  id: 'transform.clone', version: '1.0.0', category: 'layout', group: 'Anchor & Align', name: 'Clone',
  description: 'Make copies of one layer: around a ring or a fan (radial clone), in a row with offset / rotation / scale / fade steps, or in a grid. Copies are named "MOE Clone N · …".',
  keywords: ['clone', 'duplicate', 'copies', 'radial', 'ring', 'circle', 'array', 'repeat', 'repeater', 'motion 4'],
  icon: 'copy',
  params: {
    mode: { type: 'enum', label: 'Layout', default: 'radial', options: [{ value: 'radial', label: 'Radial' }, { value: 'linear', label: 'Row' }, { value: 'grid', label: 'Grid' }] },
    count: { type: 'integer', label: 'Count', min: 2, max: 100, default: 8, description: 'Total, including the original' },
    radius: { type: 'number', label: 'Radius', min: 1, max: 10000, step: 1, default: 300, unit: 'px', showIf: (a) => a.mode === 'radial' },
    arc: { type: 'number', label: 'Arc', min: -360, max: 360, step: 1, default: 360, unit: '°', showIf: (a) => a.mode === 'radial' },
    startAngle: { type: 'number', label: 'Start', min: -360, max: 360, step: 1, default: 0, unit: '°', advanced: true, showIf: (a) => a.mode === 'radial' },
    center: { type: 'enum', label: 'Around', default: 'layer', options: [{ value: 'layer', label: 'Layer position' }, { value: 'comp', label: 'Comp centre' }], showIf: (a) => a.mode === 'radial' },
    faceOut: { type: 'boolean', label: 'Rotate to face out', default: true, showIf: (a) => a.mode === 'radial' },
    stepX: { type: 'number', label: 'Step X', min: -5000, max: 5000, step: 1, default: 120, unit: 'px', showIf: (a) => a.mode !== 'radial' },
    stepY: { type: 'number', label: 'Step Y', min: -5000, max: 5000, step: 1, default: 0, unit: 'px', showIf: (a) => a.mode !== 'radial' },
    columns: { type: 'integer', label: 'Columns', min: 1, max: 50, default: 4, showIf: (a) => a.mode === 'grid' },
    rotationStep: { type: 'number', label: 'Rotate each', min: -360, max: 360, step: 1, default: 0, unit: '°', showIf: (a) => a.mode === 'linear' },
    scaleStep: { type: 'number', label: 'Scale each', min: -50, max: 50, step: 1, default: 0, unit: '%', showIf: (a) => a.mode === 'linear' },
    opacityStep: { type: 'number', label: 'Fade each', min: 0, max: 50, step: 1, default: 0, unit: '%', showIf: (a) => a.mode === 'linear' }
  },
  requires: { comp: true, minLayers: 1, maxLayers: 1 },
  permissions: ['modify.layers'], recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Duplicate ONE selected layer N times: radial clone around a ring or fan (e.g. "radial clone of a circle"), a row with offset/rotation/scale/fade steps, or a grid.' },
  uses: { hostOps: ['layers.describe', 'props.values', 'layers.clone', 'layers.unclone'], network: false }, compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Clone' },
  prepare(args, ctx) {
    const l = visual(ctx);
    if (l.length !== 1) return { ok: false, error: 'Select one unlocked layer to clone' };
    const what = args.mode === 'radial' ? `${Math.abs(args.arc) >= 360 ? 'ring' : `${args.arc}° fan`} r ${args.radius}px` : args.mode === 'grid' ? `grid of ${args.columns} columns` : `row, step ${args.stepX}, ${args.stepY}`;
    return { ok: true, layer: l[0], preview: { summary: `${args.count} × ${l[0].name} · ${what}`, items: [] } };
  },
  async execute({ args, ctx, prepared, host }) {
    const id = prepared.layer.id;
    const desc = await host.call('layers.describe', { compId: ctx.comp.id });
    const D = desc.layers.find((x) => x.id === id);
    let pos = D && D.transform && D.transform.position;
    if (!pos) pos = (await host.call('props.values', { compId: ctx.comp.id, items: [{ address: ADDR(id, 'ADBE Position_0') }, { address: ADDR(id, 'ADBE Position_1') }] })).items.map((x) => x.value);
    const rotation = D && D.transform ? D.transform.rotation : 0;
    const layout = M.cloneLayout({
      mode: args.mode, count: args.count, rotation, origin: pos,
      center: args.center === 'comp' ? [ctx.comp.width / 2, ctx.comp.height / 2] : pos,
      radius: args.radius, arc: args.arc, startAngle: args.startAngle, faceOut: args.faceOut,
      step: [args.stepX, args.stepY], spacing: [args.stepX, args.stepY || args.stepX], columns: args.columns,
      rotationStep: args.rotationStep, scaleStep: args.scaleStep, opacityStep: args.opacityStep
    });
    const res = await host.call('layers.clone', { compId: ctx.comp.id, label: `MOE: Clone ×${args.count}`, layerId: id, items: layout.copies, source: layout.source });
    return Object.assign(res, { planned: layout });
  },
  verify({ result }) {
    const checks = result.created.map((c, i) => {
      const want = result.planned.copies[i];
      const ok = close(c.position[0], want.position[0]) && close(c.position[1], want.position[1]) && close(c.rotation, want.rotation);
      return { ok, label: c.name, detail: `${c.position.slice(0, 2).map((v) => v.toFixed(1)).join(', ')} · ${c.rotation.toFixed(1)}°` };
    });
    if (result.planned.source) checks.unshift({ ok: close(result.after.position[0], result.planned.source.position[0]) && close(result.after.position[1], result.planned.source.position[1]), label: result.sourceName, detail: 'original moved to the first slot' });
    checks.unshift({ ok: result.created.length === result.planned.copies.length, label: 'Copies', detail: `${result.created.length} created` });
    return { ok: checks.every((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, sourceId: result.sourceId, before: result.before, layerIds: result.created.map((c) => c.layerId) }; },
  async restore({ data, host }) { return host.call('layers.unclone', data); },
  summarize(result) { return `${result.created.length + 1} × ${result.sourceName}`; }
};

module.exports = { anchor, align, clone };
