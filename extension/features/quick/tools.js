'use strict';
const S = require('../compositing/shared'); // v0.58: MOE Blur (effects.ensure / restore)
const { plan: PLAN1 } = require('../../core/host/plan'); // v0.94 one Ctrl+Z per run
/**
 * Quick Bar actions (RKBar-style one-click helpers). Each is a normal registered tool
 * (validated, permission-checked, verified by read-back, restorable), so the Quick Bar,
 * the command palette, recipes and the Copilot all use the same code.
 */
const { EASES } = require('../zoom/math');
// v0.47 (REAL_PREVIEWS.md): the keys Quick Animate and Trim Paths write come from one pure plan — the tile previews draw the same keys
const PLAN = require('./animatePlan');
const FG = require('../../core/framegrid'); // v0.61: keys on the comp's frame grid

const ADDR = (id, mn) => ({ layerId: id, matchNames: ['ADBE Transform Group', mn] });
const visual = (ctx) => (ctx.layers || []).filter((l) => !['camera', 'light'].includes(l.type));
const EASE_OPTIONS = [...Object.entries(EASES).map(([value, e]) => ({ value, label: e.label })), { value: 'linear', label: 'Linear' }];
const easePair = PLAN.easePair;
const keyRestore = (items) => items.map((it) => ({ address: it.address, times: it.written.map((w) => w.t), restore: it.replaced }));

/* ---------------- project ---------------- */

const reveal = {
  id: 'quick.reveal', version: '1.0.0', category: 'tools', group: 'Quick · Project', name: 'Reveal in Project / Folder',
  description: 'Reveal the selected layer’s source (or this comp) in the Project panel, open its folder on disk, or open a pre-comp.',
  keywords: ['reveal', 'project', 'folder', 'explorer', 'finder', 'source', 'open precomp'], icon: 'folder',
  params: { mode: { type: 'enum', label: 'Reveal', default: 'project', options: [{ value: 'project', label: 'In Project' }, { value: 'folder', label: 'Folder' }, { value: 'open', label: 'Open pre-comp' }] } },
  requires: { comp: true }, permissions: ['read'], recovery: 'none', ai: { callable: true, hint: 'Reveal source in project, open containing folder, or open a pre-comp.' },
  uses: { hostOps: ['project.reveal'], network: false }, compatibility: { minAE: '25.0' }, ui: { primaryLabel: 'Reveal' },
  prepare(args, ctx) {
    const L = (ctx.layers || [])[0] || null;
    if (args.mode === 'open' && !L) return { ok: false, error: 'Select a pre-comp layer' };
    return { ok: true, layer: L, preview: { summary: args.mode === 'folder' ? `Open the folder of ${L ? L.name : 'the project'}` : args.mode === 'open' ? `Open ${L.name}` : `Reveal ${L ? L.name : ctx.comp.name} in the Project panel`, items: [] } };
  },
  async execute({ args, ctx, prepared, host }) { return host.call('project.reveal', { compId: ctx.comp.id, layerId: prepared.layer ? prepared.layer.id : null, mode: args.mode }); },
  verify({ result }) { return { ok: true, checks: [{ ok: true, label: 'Reveal', detail: result.folder || result.opened || result.item }] }; },
  summarize(result) { return result.folder ? `Opened ${result.folder}` : result.opened ? `Opened ${result.opened}` : `Revealed ${result.item}`; }
};

const purge = {
  id: 'quick.purge', version: '1.0.0', category: 'tools', group: 'Quick · Project', name: 'Purge Cache',
  description: 'Free memory: purge the image cache (keeps Undo), or everything including the Undo history.',
  keywords: ['purge', 'cache', 'memory', 'ram', 'clean'], icon: 'purge',
  params: { target: { type: 'enum', label: 'Purge', default: 'image', options: [{ value: 'image', label: 'Image cache' }, { value: 'all', label: 'All (incl. Undo)' }] } },
  requires: {}, permissions: ['read'], destructive: true, recovery: 'none', ai: null,
  uses: { hostOps: ['app.purge'], network: false }, compatibility: { minAE: '25.0' }, ui: { primaryLabel: 'Purge' },
  prepare(args) { return { ok: true, preview: { summary: args.target === 'all' ? 'Purge all caches — Undo history is cleared' : 'Purge image cache (Undo kept)', items: [] } }; },
  async execute({ args, host }) { return host.call('app.purge', { target: args.target }); },
  verify({ result }) { return { ok: true, checks: [{ ok: true, label: 'Purge', detail: `${result.purged} cache purged` }] }; },
  summarize(result) { return `Purged ${result.purged} cache`; }
};

const duplicate = {
  id: 'quick.duplicateComp', version: '1.0.0', category: 'tools', group: 'Quick · Project', name: 'Duplicate Comp (deep)',
  description: 'Duplicate the active comp and every pre-comp inside it, so the copy is fully independent.',
  keywords: ['duplicate', 'comp', 'deep', 'independent', 'copy', 'version'], icon: 'copy',
  params: { suffix: { type: 'string', label: 'Suffix', default: ' v2', maxLength: 40 } },
  requires: { comp: true }, permissions: ['modify.layers'], recovery: 'undo+checkpoint', ai: { callable: true, hint: 'Make an independent copy of the comp including nested pre-comps.' },
  uses: { hostOps: ['comps.deepDuplicate', 'comps.remove'], network: false }, compatibility: { minAE: '25.0' }, ui: { primaryLabel: 'Duplicate' },
  prepare(args, ctx) { return { ok: true, preview: { summary: `Duplicate ${ctx.comp.name} and its pre-comps`, items: [] } }; },
  async execute({ args, ctx, host }) { return host.call('comps.deepDuplicate', { compId: ctx.comp.id, suffix: args.suffix || ' copy' }); },
  verify({ result }) { return { ok: result.created.length >= 1, checks: [{ ok: true, label: result.name, detail: `${result.created.length} comp(s) created` }] }; },
  checkpoint({ result }) { return { created: result.created }; },
  async restore({ data, host }) { return host.call('comps.remove', { ids: data.created }); },
  summarize(result) { return `${result.name} (${result.created.length} comp(s))`; }
};

/* ---------------- layer ---------------- */

const flip = {
  id: 'quick.flip', version: '1.0.0', category: 'tools', group: 'Quick · Layer', name: 'Flip',
  description: 'Flip selected layers horizontally or vertically (negates Scale on every keyframe, around the anchor point).',
  keywords: ['flip', 'mirror', 'horizontal', 'vertical'], icon: 'flipH',
  params: { axis: { type: 'enum', label: 'Axis', default: 'h', options: [{ value: 'h', label: 'Horizontal' }, { value: 'v', label: 'Vertical' }] } },
  requires: { comp: true, minLayers: 1 }, permissions: ['modify.keyframes', 'modify.layers'], recovery: 'undo+checkpoint', ai: { callable: true, hint: 'Mirror selected layers horizontally or vertically.' },
  uses: { hostOps: ['layers.flip'], network: false }, compatibility: { minAE: '25.0' }, ui: { primaryLabel: 'Flip' },
  prepare(args, ctx) { const l = visual(ctx); return l.length ? { ok: true, layers: l, preview: { summary: `Flip ${args.axis === 'v' ? 'vertical' : 'horizontal'} · ${l.length} layer(s)`, items: [] } } : { ok: false, error: 'Select layers' }; },
  async execute({ args, ctx, prepared, host }) { return host.call('layers.flip', { compId: ctx.comp.id, layerIds: prepared.layers.map((l) => l.id), axis: args.axis }); },
  verify({ result }) { const c = result.layers.map((l) => ({ ok: !l.skipped, label: l.name, detail: l.skipped ? `skipped: ${l.skipped.toLowerCase()}` : `scale ${l.scale.map((v) => Math.round(v)).join(', ')}` })); return { ok: c.some((x) => x.ok), checks: c }; },
  checkpoint({ result, ctx, args }) { return { compId: ctx.comp.id, layerIds: result.layers.filter((l) => !l.skipped).map((l) => l.layerId), axis: result.axis || (args && args.axis) }; },
  async restore({ data, host }) { return host.call('layers.flip', { compId: data.compId, layerIds: data.layerIds, axis: data.axis }); },
  summarize(result) { return `Flipped ${result.layers.filter((l) => !l.skipped).length} layer(s)`; }
};
// The checkpoint needs the axis; keep it on the result.
const flipExec = flip.execute;
flip.execute = async (o) => Object.assign(await flipExec(o), { axis: o.args.axis });

const parentNull = {
  id: 'quick.parentToNull', version: '1.0.0', category: 'tools', group: 'Quick · Layer', name: 'Parent to Null',
  description: 'Create a null at the centre of the selection and parent the selected layers to it (they stay where they are).',
  keywords: ['parent', 'null', 'controller', 'group', 'rig'], icon: 'parentNull',
  params: { name: { type: 'string', label: 'Name', default: 'Control', maxLength: 60 } },
  requires: { comp: true, minLayers: 1 }, permissions: ['modify.layers'], recovery: 'undo+checkpoint', ai: { callable: true, hint: 'Group selected layers under a new controller null.' },
  uses: { hostOps: ['layers.bounds', 'layers.parentToNull', 'layers.unparentFromNull'], network: false }, compatibility: { minAE: '25.0' }, ui: { primaryLabel: 'Parent' },
  prepare(args, ctx) { const l = visual(ctx); return l.length ? { ok: true, layers: l, preview: { summary: `Null "${args.name}" for ${l.length} layer(s)`, items: [] } } : { ok: false, error: 'Select layers' }; },
  async execute({ args, ctx, prepared, host }) {
    const b = await host.call('layers.bounds', { compId: ctx.comp.id, layerIds: prepared.layers.map((l) => l.id), times: [ctx.comp.time] });
    const boxes = b.layers.map((x) => x.boxes[0]).filter(Boolean);
    const box = boxes.reduce((u, x) => [Math.min(u[0], x[0]), Math.min(u[1], x[1]), Math.max(u[2], x[2]), Math.max(u[3], x[3])], [Infinity, Infinity, -Infinity, -Infinity]);
    const pos = boxes.length ? [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2] : [ctx.comp.width / 2, ctx.comp.height / 2];
    return host.call('layers.parentToNull', { compId: ctx.comp.id, layerIds: prepared.layers.map((l) => l.id), name: args.name || 'Control', position: pos });
  },
  verify({ result }) { return { ok: true, checks: [{ ok: true, label: result.name, detail: `${result.layers.length} layer(s) parented` }] }; },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, nullId: result.nullId, layers: result.layers }; },
  async restore({ data, host }) { return host.call('layers.unparentFromNull', data); },
  summarize(result) { return `${result.name} controls ${result.layers.length} layer(s)`; }
};

const precompose = {
  id: 'quick.precompose', version: '1.0.0', category: 'tools', group: 'Quick · Layer', name: 'Pre-compose',
  description: 'Pre-compose the selected layers (moving all attributes) under a name you choose.',
  keywords: ['precompose', 'pre-compose', 'nest', 'group'], icon: 'precomp',
  params: { name: { type: 'string', label: 'Name', default: 'Pre-comp', maxLength: 120 }, moveAll: { type: 'boolean', label: 'Move all attributes', default: true } },
  requires: { comp: true, minLayers: 1 }, permissions: ['modify.layers'], recovery: 'undo', ai: { callable: true, hint: 'Pre-compose selected layers.' },
  uses: { hostOps: ['layers.precompose'], network: false }, compatibility: { minAE: '25.0' }, ui: { primaryLabel: 'Pre-compose' },
  prepare(args, ctx) { return (ctx.layers || []).length ? { ok: true, preview: { summary: `Pre-compose ${ctx.layers.length} layer(s) → "${args.name}"`, items: ['Undo with Edit › Undo'] } } : { ok: false, error: 'Select layers' }; },
  async execute({ args, ctx, host }) { return host.call('layers.precompose', { compId: ctx.comp.id, layerIds: ctx.layers.map((l) => l.id), name: args.name, moveAll: args.moveAll }); },
  verify({ result, ctx }) { const ok = result.numLayers === ctx.layers.length; return { ok, checks: [{ ok, label: result.name, detail: `${result.numLayers} layer(s) inside · ${result.size.join('×')}` }] }; },
  summarize(result) { return `Pre-composed into ${result.name}`; }
};

const separate = {
  id: 'quick.separateXY', version: '1.0.0', category: 'tools', group: 'Quick · Layer', name: 'Separate X/Y',
  description: 'Separate Position into X and Y keeping each keyframe’s easing (influence kept, speed split by direction).',
  keywords: ['separate', 'dimensions', 'x', 'y', 'position', 'easing'], icon: 'separate',
  params: {}, requires: { comp: true, minLayers: 1 }, permissions: ['modify.keyframes'], recovery: 'undo', ai: { callable: true, hint: 'Separate position dimensions keeping easing.' },
  uses: { hostOps: ['position.separate'], network: false }, compatibility: { minAE: '25.0' }, ui: { primaryLabel: 'Separate' },
  prepare(args, ctx) { const l = visual(ctx); return l.length ? { ok: true, layers: l, preview: { summary: `Separate X/Y on ${l.length} layer(s)`, items: ['Undo with Edit › Undo'] } } : { ok: false, error: 'Select layers' }; },
  async execute({ ctx, prepared, host }) { return host.call('position.separate', { compId: ctx.comp.id, layerIds: prepared.layers.map((l) => l.id) }); },
  verify({ result }) { const c = result.layers.map((l) => ({ ok: !l.skipped || l.skipped === 'ALREADY', label: l.name, detail: l.skipped ? l.skipped.toLowerCase() : `${l.keys} key(s), easing kept` })); return { ok: c.every((x) => x.ok), checks: c }; },
  summarize(result) { return `Separated ${result.layers.filter((l) => !l.skipped).length} layer(s)`; }
};

/* ---------------- properties & keys ---------------- */

const selectSame = {
  id: 'quick.selectSame', version: '1.0.0', category: 'tools', group: 'Quick · Keys', name: 'Same Property on Other Layers',
  description: 'Select the same property (e.g. Position, a Slider, Trim End) on the other selected layers — or on every layer in the comp.',
  keywords: ['select', 'same', 'matching', 'property', 'properties'], icon: 'selectSame',
  params: { scope: { type: 'enum', label: 'On', default: 'selected', options: [{ value: 'selected', label: 'Selected layers' }, { value: 'all', label: 'All layers' }] } },
  requires: { comp: true, minLayers: 1 }, permissions: ['read'], recovery: 'none', ai: null,
  uses: { hostOps: ['props.select'], network: false }, compatibility: { minAE: '25.0' }, ui: { primaryLabel: 'Select' },
  prepare(args, ctx) {
    const props = ctx.properties || [];
    if (!props.length) return { ok: false, error: 'Select a property first (e.g. Position)' };
    const paths = [...new Map(props.map((p) => [p.address.matchNames.join('>'), p.address.matchNames])).values()];
    const targets = args.scope === 'all' ? (ctx.compLayers || []) : ctx.layers;
    return { ok: true, paths, targets, preview: { summary: `${props.map((p) => p.name).slice(0, 3).join(', ')} on ${targets.length} layer(s)`, items: [] } };
  },
  async execute({ ctx, prepared, host }) {
    const items = prepared.targets.flatMap((l) => prepared.paths.map((m) => ({ layerId: l.id, matchNames: m })));
    return host.call('props.select', { compId: ctx.comp.id, items });
  },
  verify({ result }) { return { ok: result.selected > 0, checks: [{ ok: result.selected > 0, label: 'Selection', detail: `${result.selected} propert(ies) selected${result.missing ? ` · ${result.missing} layer(s) don’t have it` : ''}` }] }; },
  summarize(result) { return `${result.selected} propert(ies) selected`; }
};

function keyTargets(ctx, needSelected) {
  return (ctx.properties || []).filter((p) => p.numKeys > 0).map((p) => ({ address: p.address, keys: p.selectedKeys.length ? p.selectedKeys : (needSelected ? [] : null), name: p.name })).filter((t) => !needSelected || t.keys.length);
}

const reverseKeys = {
  id: 'quick.reverseKeys', version: '1.0.0', category: 'tools', group: 'Quick · Keys', name: 'Reverse Keyframes',
  description: 'Reverse the selected keyframes in time (eases and interpolation swapped so the motion plays backwards). No keys selected = all keys of the selected properties.',
  keywords: ['reverse', 'keyframes', 'time reverse', 'backwards'], icon: 'reverse',
  params: {}, requires: { comp: true }, permissions: ['modify.keyframes'], recovery: 'undo+checkpoint', ai: { callable: true, hint: 'Reverse selected keyframes.' },
  uses: { hostOps: ['keys.reverse', 'keys.rebuild'], network: false }, compatibility: { minAE: '25.0' }, ui: { primaryLabel: 'Reverse' },
  prepare(args, ctx) { const t = keyTargets(ctx, false); return t.length ? { ok: true, targets: t, preview: { summary: `Reverse keys on ${t.length} propert(ies)`, items: t.map((x) => x.name) } } : { ok: false, error: 'Select keyframed properties or keys' }; },
  async execute({ ctx, prepared, host }) { return host.call('keys.reverse', { compId: ctx.comp.id, items: prepared.targets.map((t) => ({ address: t.address, keys: t.keys })) }); },
  verify({ result }) { const c = result.items.map((i) => ({ ok: !i.skipped, label: i.layerName ? `${i.layerName} › ${i.name}` : 'Property', detail: i.skipped ? i.skipped.toLowerCase() : `${i.reversed} key(s) reversed in ${i.span[0].toFixed(2)}–${i.span[1].toFixed(2)}s` })); return { ok: c.some((x) => x.ok), checks: c }; },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, items: result.items.filter((i) => !i.skipped).map((i) => ({ address: i.address, snapshot: i.snapshot })) }; },
  async restore({ data, host }) { return host.call('keys.rebuild', data); },
  summarize(result) { return `Reversed ${result.items.filter((i) => !i.skipped).length} propert(ies)`; }
};

const mirrorKeys = {
  id: 'quick.mirrorKeys', version: '1.0.0', category: 'tools', group: 'Quick · Keys', name: 'Clone & Mirror Keys',
  description: 'Paste the selected keyframes at the playhead — mirrored (plays back to the start: in → out) or cloned as is.',
  keywords: ['clone', 'mirror', 'copy keys', 'ping pong', 'out animation'], icon: 'mirror',
  params: { mode: { type: 'enum', label: 'Mode', default: 'mirror', options: [{ value: 'mirror', label: 'Mirror' }, { value: 'clone', label: 'Clone' }] } },
  requires: { comp: true }, permissions: ['modify.keyframes'], recovery: 'undo+checkpoint', ai: { callable: true, hint: 'Create the out animation by mirroring selected in-keys at the playhead.' },
  uses: { hostOps: ['keys.mirror', 'keys.rebuild'], network: false }, compatibility: { minAE: '25.0' }, ui: { primaryLabel: 'Paste' },
  prepare(args, ctx) { const t = keyTargets(ctx, true); return t.length ? { ok: true, targets: t, preview: { summary: `${args.mode === 'clone' ? 'Clone' : 'Mirror'} ${t.reduce((n, x) => n + x.keys.length, 0)} key(s) at ${ctx.comp.time.toFixed(2)}s`, items: [] } } : { ok: false, error: 'Select keyframes to copy' }; },
  async execute({ args, ctx, prepared, host }) { return host.call('keys.mirror', { compId: ctx.comp.id, at: ctx.comp.time, mode: args.mode, items: prepared.targets.map((t) => ({ address: t.address, keys: t.keys })) }); },
  verify({ result }) { const c = result.items.map((i) => ({ ok: !i.skipped, label: i.layerName ? `${i.layerName} › ${i.name}` : 'Property', detail: i.skipped ? i.skipped.toLowerCase() : `${i.written.length} key(s) pasted${i.replaced ? ` (${i.replaced} replaced)` : ''}` })); return { ok: c.some((x) => x.ok), checks: c }; },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, items: result.items.filter((i) => !i.skipped).map((i) => ({ address: i.address, snapshot: i.snapshot })) }; },
  async restore({ data, host }) { return host.call('keys.rebuild', data); },
  summarize(result) { return `${result.items.reduce((n, i) => n + (i.written ? i.written.length : 0), 0)} key(s) pasted`; }
};

/* ---------------- animate (one-click moves) ---------------- */

const KINDS = [
  { value: 'moveRL', label: 'Right → Left' }, { value: 'moveLR', label: 'Left → Right' }, { value: 'moveTB', label: 'Top → Bottom' }, { value: 'moveBT', label: 'Bottom → Top' },
  { value: 'fade', label: 'Fade' }, { value: 'scale', label: 'Scale' }, { value: 'spin', label: 'Spin' }
];

/** Offscreen offset so the layer box fully leaves the frame. */
function offscreen(kind, dir, box, W, H, margin = 20) {
  const enter = dir === 'in';
  // Motion direction: RL = moving left. For "in", the start is on the opposite side.
  switch (kind) {
    case 'moveRL': return enter ? [W - box[0] + margin, 0] : [-box[2] - margin, 0];
    case 'moveLR': return enter ? [-box[2] - margin, 0] : [W - box[0] + margin, 0];
    case 'moveTB': return enter ? [0, -box[3] - margin] : [0, H - box[1] + margin];
    case 'moveBT': return enter ? [0, H - box[1] + margin] : [0, -box[3] - margin];
    default: return [0, 0];
  }
}
function fixedOffset(kind, dir, d) {
  const s = dir === 'in' ? -1 : 1; // in: start opposite to the motion
  return { moveRL: [-d * s, 0], moveLR: [d * s, 0], moveTB: [0, d * s], moveBT: [0, -d * s] }[kind] || [0, 0];
}

const animate = {
  id: 'quick.animate', version: '1.0.0', category: 'tools', group: 'Quick · Animate', name: 'Quick Animate',
  description: 'One-click animation at the playhead: slide in/out (right→left, left→right, top→bottom, bottom→top, off-screen or by distance), fade, scale up/down, spin — with easing and optional overshoot. Keeps the current pose as the rest state.',
  keywords: ['animate', 'slide', 'move', 'in', 'out', 'fade', 'scale up', 'scale down', 'pop', 'spin', 'enter', 'exit'], icon: 'moveRL',
  params: {
    kind: { type: 'enum', label: 'Motion', tileFixed: true, default: 'moveRL', options: KINDS },
    dir: { type: 'enum', label: 'Direction', tileFixed: true, default: 'in', options: [{ value: 'in', label: 'In' }, { value: 'out', label: 'Out' }] },
    duration: { type: 'number', label: 'Duration', min: 0.05, max: 10, step: 0.05, default: 0.6, unit: 's' },
    ease: { type: 'enum', label: 'Ease', default: 'snappy', options: EASE_OPTIONS },
    distance: { type: 'number', label: 'Distance', min: 0, max: 10000, step: 10, default: 0, unit: 'px', description: '0 = fully off-screen', showIf: (a) => /^move/.test(a.kind) },
    overshoot: { type: 'boolean', label: 'Overshoot', default: false, showIf: (a) => a.dir === 'in' && a.kind !== 'fade' },
    // v0.48 (COMBINED_MOVES.md): one move, several properties on the same timing
    fade: { type: 'boolean', label: 'Also fade', default: false, description: 'Opacity in / out on the same timing', showIf: (a) => a.kind !== 'fade' },
    away: { type: 'number', label: 'From / to', min: 0, max: 400, step: 5, default: 0, unit: '%', description: 'The scale at the far end, in % of the layer\'s own: 0 = from / to nothing, 130 = zoom from bigger', showIf: (a) => a.kind === 'scale' },
    angle: { type: 'number', label: 'Angle', min: 5, max: 1080, step: 5, default: 180, unit: '°', showIf: (a) => a.kind === 'spin' },
    // v0.58 (APPLE_MOTION.md): comes in sharp from a blur — a `MOE Blur` (Gaussian Blur) keyed on the same timing
    blur: { type: 'number', label: 'Blur', min: 0, max: 200, step: 1, default: 0, unit: 'px', description: '0 = none. The layer comes in sharp from this blur (or leaves into it), on the same timing — a MOE Blur effect, removed by Restore' },
    stagger: { type: 'number', label: 'Stagger', min: 0, max: 2, step: 0.01, default: 0, unit: 's', advanced: true, description: 'Delay between layers' },
    // v0.60 (SAAS_INTERACTION.md): UI Reveal — the order comes from where each layer really is on screen (measured by AE)
    order: { type: 'enum', label: 'Order', default: 'selection', advanced: true, options: [{ value: 'selection', label: 'Selection order' }, { value: 'screen', label: 'Screen ↘ (rows, left → right)' }, { value: 'screenRtl', label: 'Screen ↙ (rows, right → left)' }, { value: 'center', label: 'From the centre out' }], description: 'Who moves first when Stagger is on. Screen orders read the boxes After Effects measures at the playhead, so a UI builds the way it is read', showIf: (a) => a.stagger > 0 }
  },
  requires: { comp: true, minLayers: 1 }, permissions: ['modify.keyframes', 'modify.effects'], recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Quick in/out animation at the playhead: slide from a side, fade, scale up/down, spin; blur (px) adds an Apple-style blur in / out.' },
  uses: { hostOps: ['layers.describe', 'layers.bounds', 'props.values', 'keys.write', 'keys.remove', 'effects.ensure', 'effects.restore'], network: false }, compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Animate' },
  prepare(args, ctx) {
    const l = visual(ctx).filter((x) => !x.locked);
    if (!l.length) return { ok: false, error: 'Select unlocked layers' };
    const k = KINDS.find((x) => x.value === args.kind);
    return { ok: true, layers: l, preview: { summary: `${k.label} ${args.dir} · ${args.duration}s · ${l.length} layer(s)`, items: [] } };
  },
  async execute({ args, ctx, prepared, host }) {
    const comp = ctx.comp;
    const W = comp.width, H = comp.height;
    const desc = await host.call('layers.describe', { compId: comp.id });
    const ids = prepared.layers.map((l) => l.id);
    const isMove = /^move/.test(args.kind);
    const byScreen = args.stagger > 0 && args.order && args.order !== 'selection' && ids.length > 1;
    const boxes = (isMove && !args.distance) || byScreen ? await host.call('layers.bounds', { compId: comp.id, layerIds: ids, times: [comp.time] }) : null;
    // v0.60: the rank of each layer in the stagger — selection order, or the screen order of the measured boxes
    const rank = byScreen ? PLAN.screenOrder(ids.map((id) => { const b = boxes.layers.find((x) => x.layerId === id); return b && b.boxes[0] ? b.boxes[0] : [0, 0, 0, 0]; }), args.order) : ids.map((_, i) => i);
    const e = easePair(args.ease);
    const items = [];
    const skipped = [];
    // v0.61 (ENGINE2.md): every value the run needs is read in ONE host call (each at its own layer's start time),
    // instead of one call per layer and property — 60 layers went from 120 reads to 1.
    const fd = comp.frameDuration || 1 / 25;
    const jobs = [], reads = [];
    const need = (address, time) => { reads.push({ address, time }); return reads.length - 1; };
    for (let i = 0; i < prepared.layers.length; i++) {
      const L = prepared.layers[i];
      const D = desc.layers.find((x) => x.id === L.id);
      const t0 = FG.snap(comp.time + rank[i] * (args.stagger || 0), fd);
      const job = { L, D, t0 };
      if (isMove) {
        if (D.parentId) { skipped.push(`${L.name} (parented)`); continue; }
        if (D.posExpr) { skipped.push(`${L.name} (Position has an expression)`); continue; }
        const box = boxes ? boxes.layers.find((b) => b.layerId === L.id).boxes[0] : null;
        if (!args.distance && !box) { skipped.push(`${L.name} (no visible bounds)`); continue; }
        job.box = box;
        job.separated = !D.transform || !D.transform.position;
        job.pos = job.separated ? [need(ADDR(L.id, 'ADBE Position_0'), t0), need(ADDR(L.id, 'ADBE Position_1'), t0)] : [need(ADDR(L.id, 'ADBE Position'), t0)];
      } else if (args.kind === 'scale' || args.kind === 'spin') {
        job.mn = args.kind === 'scale' ? 'ADBE Scale' : 'ADBE Rotate Z';
        job.own = need(ADDR(L.id, job.mn), t0);
      }
      if (args.kind === 'fade' || args.fade) job.op = need(ADDR(L.id, 'ADBE Opacity'), t0);
      jobs.push(job);
    }
    const vals = reads.length ? (await host.call('props.values', { compId: comp.id, items: reads })).items.map((r) => r.value) : [];
    for (const { L, t0, box, separated, pos, mn, own, op } of jobs) {
      const t1 = t0 + args.duration;
      const k = (a, b, mid) => PLAN.keysFor(e, t0, t1 - t0, a, b, mid);
      if (isMove) {
        const off = args.distance ? fixedOffset(args.kind, args.dir, args.distance) : offscreen(args.kind, args.dir, box, W, H);
        const p = separated ? [vals[pos[0]], vals[pos[1]]] : vals[pos[0]];
        const away = [p[0] + off[0], p[1] + off[1]].concat(p.length > 2 ? [p[2]] : []);
        const over = args.overshoot && args.dir === 'in' ? [p[0] - off[0] * 0.04, p[1] - off[1] * 0.04].concat(p.length > 2 ? [p[2]] : []) : undefined;
        const [a, b] = args.dir === 'in' ? [away, p] : [p, away];
        if (separated) {
          items.push({ address: ADDR(L.id, 'ADBE Position_0'), keys: k(a[0], b[0], over && over[0]) });
          items.push({ address: ADDR(L.id, 'ADBE Position_1'), keys: k(a[1], b[1], over && over[1]) });
        } else items.push({ address: ADDR(L.id, 'ADBE Position'), keys: k(a, b, over), spatialLinear: true });
      } else if (args.kind === 'fade') {
        const o = vals[op];
        const rest = args.dir === 'in' && o === 0 ? 100 : o;
        items.push({ address: ADDR(L.id, 'ADBE Opacity'), keys: args.dir === 'in' ? k(0, rest) : k(rest, 0) });
      } else if (mn) {
        // the plan's keys from the layer's own rest value, at the playhead (same keys as the tile preview)
        const v = vals[own];
        const pl = PLAN.animate(args, args.kind === 'scale' ? { scale: v } : { rotation: v });
        items.push({ address: ADDR(L.id, mn), keys: pl.keys.map((x) => Object.assign({}, x, { t: x.t + t0 })) });
      }
      // v0.48: Also fade — Opacity on the same timing as the move
      if (args.fade && args.kind !== 'fade') {
        const f = PLAN.fade(args, { opacity: vals[op] });
        items.push({ address: ADDR(L.id, 'ADBE Opacity'), keys: f.keys.map((x) => Object.assign({}, x, { t: x.t + t0 })) });
      }
    }
    if (!items.length) throw new Error(`Nothing to animate: ${skipped.join(', ')}`);
    // v0.58: Blur — one MOE Blur per animated layer (reused if it is there), keyed on the move's timing
    // v0.94 (docs/features/ONE_UNDO.md): the blur effects and every key in ONE host call — one Ctrl+Z
    const P = PLAN1(host, 'MOE: Quick Animate');
    let fxRef = null;
    const bl = PLAN.blur(args);
    if (bl) {
      const animated = [...new Set(items.map((it) => it.address.layerId))];
      fxRef = P.add('effects.ensure', { compId: ctx.comp.id, label: 'MOE: Blur', layers: animated.map((id) => ({ layer: { layerId: id }, items: [{ key: 'MOE Blur', matchName: 'ADBE Gaussian Blur 2', before: [], params: [{ id: 'Repeat Edge Pixels', value: 1, names: ['Repeat Edge Pixels'] }] }] })) });
      animated.forEach((id) => {
        const i = prepared.layers.findIndex((l) => l.id === id), t0 = FG.snap(comp.time + rank[i] * (args.stagger || 0), comp.frameDuration || 1 / 25);
        items.push({ address: { layerId: id, matchNames: ['ADBE Effect Parade', 'name:MOE Blur', 'name:Blurriness'] }, keys: bl.keys.map((x) => Object.assign({}, x, { t: x.t + t0 })) });
      });
    }
    const keysRef = P.add('keys.write', { compId: comp.id, label: 'MOE: Quick Animate', items });
    await P.commit();
    const keys = keysRef.value(), fx = fxRef ? fxRef.value() : null;
    return { keys, skipped, fx, order: byScreen ? prepared.layers.map((l, i) => ({ name: l.name, rank: rank[i] })).sort((a, b) => a.rank - b.rank).map((x) => x.name) : null };
  },
  verify({ result }) {
    const c = result.keys.items.map((it) => ({ ok: it.written.length >= 2, label: `${it.layerName} › ${it.name}`, detail: `${it.written.length} keys ${it.written[0].t.toFixed(2)}–${it.written[it.written.length - 1].t.toFixed(2)}s` }));
    for (const s of result.skipped) c.push({ ok: true, label: 'Skipped', detail: s });
    if (result.order) c.push({ ok: true, label: 'Screen order', detail: result.order.join(' → ') });
    return { ok: c.every((x) => x.ok), checks: c };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, items: keyRestore(result.keys.items), fx: result.fx ? S.effectsCheckpoint(result.fx, ctx) : null }; },
  async restore({ data, host }) {
    const P = PLAN1(host, 'MOE: Restore');
    const r = P.add('keys.remove', { compId: data.compId, items: data.items });
    // a MOE Blur this run added goes away; one that was there keeps its values
    if (data.fx) P.add('effects.restore', { compId: data.fx.compId, label: 'MOE: Restore Effects', layers: data.fx.layers });
    await P.commit();
    return r.value();
  },
  summarize(result) { return `Animated ${result.keys.items.length} propert(ies)${result.fx ? ' · blur' : ''}`; }
};

/* ---------------- trim paths ---------------- */

const trim = {
  id: 'quick.trimPaths', version: '1.0.0', category: 'tools', group: 'Quick · Animate', name: 'Trim Paths',
  description: 'Add Trim Paths to selected shape layers and keyframe it: Draw on (End), Erase (Start), or Travel (End then Start in one move).',
  keywords: ['trim paths', 'draw on', 'write on', 'stroke', 'line', 'erase', 'travel'], icon: 'trim',
  params: {
    mode: { type: 'enum', label: 'Mode', default: 'draw', options: [{ value: 'draw', label: 'Draw on' }, { value: 'erase', label: 'Erase' }, { value: 'travel', label: 'Travel' }, { value: 'drawErase', label: 'Draw + erase' }] },
    duration: { type: 'number', label: 'Duration', min: 0.05, max: 20, step: 0.05, default: 1, unit: 's' },
    lag: { type: 'number', label: 'Tail lag', min: 0, max: 100, step: 1, default: 35, unit: '%', showIf: (a) => a.mode === 'travel' },
    hold: { type: 'number', label: 'Hold', min: 0, max: 20, step: 0.05, default: 0.5, unit: 's', showIf: (a) => a.mode === 'drawErase' },
    ease: { type: 'enum', label: 'Ease', default: 'smooth', options: EASE_OPTIONS }
  },
  requires: { comp: true, minLayers: 1 }, permissions: ['modify.layers', 'modify.keyframes'], recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Draw-on / erase / travelling stroke with Trim Paths on selected shape layers.' },
  uses: { hostOps: ['shapes.trim', 'keys.write', 'shapes.untrim', 'keys.remove'], network: false }, compatibility: { minAE: '25.0' }, ui: { primaryLabel: 'Trim' },
  prepare(args, ctx) { const l = (ctx.layers || []).filter((x) => x.type === 'shape'); return l.length ? { ok: true, layers: l, preview: { summary: `${args.mode} · ${args.duration}s · ${l.length} shape layer(s)`, items: [] } } : { ok: false, error: 'Select shape layers' }; },
  async execute({ args, ctx, prepared, host }) {
    const t0 = ctx.comp.time;
    // v0.94 (docs/features/ONE_UNDO.md): every layer's Trim Paths and keys in ONE host call — one Ctrl+Z
    const P = PLAN1(host, 'MOE: Trim Paths');
    const refs = [];
    // the plan's keys (relative times) at the playhead — the same keys the tile preview draws
    const pl = PLAN.trim(args);
    const at = (keys) => keys.map((x) => Object.assign({}, x, { t: x.t + t0 }));
    for (const L of prepared.layers) {
      const tr = P.add('shapes.trim', { compId: ctx.comp.id, layerId: L.id });
      const items = [];
      if (pl.end) items.push({ address: tr.at('end'), keys: at(pl.end) });
      if (pl.start) items.push({ address: tr.at('start'), keys: at(pl.start) });
      refs.push({ tr, keys: P.add('keys.write', { compId: ctx.comp.id, label: 'MOE: Trim Paths', items }) });
    }
    await P.commit();
    return { layers: refs.map((r) => ({ trim: r.tr.value(), keys: r.keys.value() })) };
  },
  verify({ result }) { const c = result.layers.map((l) => ({ ok: l.keys.items.every((i) => i.written.length === 2), label: `${l.trim.name} › MOE Trim`, detail: `${l.trim.created ? 'added' : 'reused'} · ${l.keys.items.map((i) => i.name).join(' + ')} keyed` })); return { ok: c.every((x) => x.ok), checks: c }; },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, layers: result.layers.map((l) => ({ layerId: l.trim.layerId, created: l.trim.created, items: keyRestore(l.keys.items) })) }; },
  async restore({ data, host }) {
    const P = PLAN1(host, 'MOE: Restore');
    for (const l of data.layers) {
      if (l.created) P.add('shapes.untrim', { compId: data.compId, layerId: l.layerId });
      else P.add('keys.remove', { compId: data.compId, items: l.items });
    }
    await P.commit();
    return { ok: true };
  },
  summarize(result) { return `Trim Paths on ${result.layers.length} layer(s)`; }
};

/* ---------------- text: typewriter & counter ---------------- */

const typewriter = {
  id: 'quick.typewriter', version: '1.0.0', category: 'tools', group: 'Quick · Text', name: 'Typewriter',
  description: 'Reveal text letter by letter (or word by word for Arabic) from the playhead.',
  keywords: ['typewriter', 'typing', 'type on', 'write on', 'reveal'], icon: 'typewriter',
  params: { duration: { type: 'number', label: 'Duration', min: 0.1, max: 30, step: 0.1, default: 1.5, unit: 's' }, unit: { type: 'enum', label: 'By', default: 'auto', options: [{ value: 'auto', label: 'Auto' }, { value: '1', label: 'Letters' }, { value: '3', label: 'Words' }] } },
  requires: { comp: true, minLayers: 1 }, permissions: ['modify.layers'], recovery: 'undo+checkpoint', ai: { callable: true, hint: 'Typewriter reveal on selected text layers.' },
  uses: { hostOps: ['text.applyAnimator', 'text.removeAnimator'], network: false }, compatibility: { minAE: '25.0' }, ui: { primaryLabel: 'Type' },
  prepare(args, ctx) { const l = (ctx.layers || []).filter((x) => x.type === 'text'); return l.length ? { ok: true, layers: l, preview: { summary: `Typewriter ${args.duration}s on ${l.length} text layer(s)`, items: [] } } : { ok: false, error: 'Select text layers' }; },
  async execute({ args, ctx, prepared, host }) {
    const arabic = (t) => /[؀-ۿ]/.test(t || '');
    const out = [];
    for (const L of prepared.layers) {
      const txt = typeof L.text === 'string' ? L.text : (L.text && L.text.text) || '';
      const basedOn = args.unit === 'auto' ? (arabic(txt) ? 3 : 1) : Number(args.unit);
      const spec = { selector: { start: 0, end: 100, advanced: { basedOn, shape: 1, easeHigh: 0, easeLow: 0 } }, props: [{ matchName: 'ADBE Text Opacity', value: 0 }], keys: { matchName: 'ADBE Text Percent Start', list: [{ t: 0, v: 0, outInfl: 0.1 }, { t: args.duration, v: 100, inInfl: 0.1 }] } };
      out.push(await host.call('text.applyAnimator', { compId: ctx.comp.id, label: 'MOE: Typewriter', name: 'MOE Typewriter', layers: [{ layerId: L.id, startTime: ctx.comp.time }], spec }));
    }
    return { results: out };
  },
  verify({ result }) { const ls = result.results.flatMap((r) => r.layers); return { ok: ls.every((l) => !l.skipped && l.keys === 2), checks: ls.map((l) => ({ ok: !l.skipped && l.keys === 2, label: l.name, detail: l.skipped || `MOE Typewriter ${l.replaced ? 'replaced' : 'added'}` })) }; },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, items: result.results.flatMap((r) => r.layers.filter((l) => !l.skipped).map((l) => ({ layerId: l.layerId, name: 'MOE Typewriter' }))) }; },
  async restore({ data, host }) { return host.call('text.removeAnimator', data); },
  summarize(result) { return `Typewriter on ${result.results.length} layer(s)`; }
};

function counterExpression({ decimals, prefix, suffix, separator }) {
  const q = (s) => JSON.stringify(String(s || ''));
  return [
    '// MOE Counter',
    'var v = effect("MOE Counter")(1).value;',
    `var p = Math.abs(v).toFixed(${decimals}).split(".");`,
    separator ? 'p[0] = p[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",");' : '',
    `(v < 0 ? "-" : "") + ${q(prefix)} + p.join(".") + ${q(suffix)};`
  ].filter(Boolean).join('\n');
}

const counter = {
  id: 'quick.counter', version: '1.0.0', category: 'tools', group: 'Quick · Text', name: 'Number Counter',
  description: 'Turn a text layer into an animated number counter (from → to) with decimals, thousands separators, prefix and suffix. The value lives on a MOE Counter slider you can re-key.',
  keywords: ['counter', 'number', 'count up', 'counting', 'stats', 'percentage', 'money'], icon: 'counter',
  params: {
    from: { type: 'number', label: 'From', min: -1e9, max: 1e9, default: 0 }, to: { type: 'number', label: 'To', min: -1e9, max: 1e9, default: 100 },
    duration: { type: 'number', label: 'Duration', min: 0.05, max: 60, step: 0.05, default: 2, unit: 's' },
    decimals: { type: 'integer', label: 'Decimals', min: 0, max: 6, default: 0 },
    prefix: { type: 'string', label: 'Prefix', default: '', maxLength: 12 }, suffix: { type: 'string', label: 'Suffix', default: '', maxLength: 12 },
    separator: { type: 'boolean', label: 'Thousands ,', default: true }, ease: { type: 'enum', label: 'Ease', default: 'smooth', options: EASE_OPTIONS }
  },
  requires: { comp: true, minLayers: 1 }, permissions: ['modify.effects', 'modify.expressions', 'modify.keyframes'], recovery: 'undo+checkpoint', ai: { callable: true, hint: 'Animated number counter on a text layer.' },
  uses: { hostOps: ['effects.ensure', 'keys.write', 'expressions.set'], network: false }, compatibility: { minAE: '25.0' }, ui: { primaryLabel: 'Count' },
  prepare(args, ctx) { const l = (ctx.layers || []).filter((x) => x.type === 'text'); return l.length ? { ok: true, layers: l, preview: { summary: `${args.prefix}${args.from} → ${args.to}${args.suffix} in ${args.duration}s`, items: l.map((x) => x.name) } } : { ok: false, error: 'Select text layers' }; },
  async execute({ args, ctx, prepared, host }) {
    const fx = await host.call('effects.ensure', { compId: ctx.comp.id, label: 'MOE: Counter', layers: prepared.layers.map((l) => ({ layer: { layerId: l.id }, items: [{ key: 'MOE Counter', matchName: 'ADBE Slider Control', before: [], params: [] }] })) });
    const e = easePair(args.ease);
    const keys = await host.call('keys.write', { compId: ctx.comp.id, label: 'MOE: Counter', items: prepared.layers.map((l) => ({ address: { layerId: l.id, matchNames: ['ADBE Effect Parade', 'name:MOE Counter', 'name:Slider'] }, keys: [Object.assign({ t: ctx.comp.time, v: args.from }, e.out), Object.assign({ t: ctx.comp.time + args.duration, v: args.to }, e.in)] })) });
    const set = await host.call('expressions.set', { compId: ctx.comp.id, label: 'MOE: Counter', revertOnError: true, targets: prepared.layers.map((l) => ({ address: { layerId: l.id, matchNames: ['ADBE Text Properties', 'ADBE Text Document'] }, expression: counterExpression(args), enabled: true })) });
    return { fx, keys, set };
  },
  verify({ result }) { const c = result.set.targets.map((t) => ({ ok: !t.reverted && !t.after.expressionError, label: `${t.layerName} › Source Text`, detail: t.after.expressionError || 'counter expression active' })); return { ok: c.every((x) => x.ok), checks: c }; },
  checkpoint({ result, ctx }) { const S = require('../compositing/shared'); return { compId: ctx.comp.id, fx: S.effectsCheckpoint(result.fx, ctx), expressions: result.set.targets.map((t) => ({ address: t.address, expression: t.before.expression, enabled: t.before.expressionEnabled })) }; },
  async restore({ data, host }) { await host.call('expressions.set', { compId: data.compId, label: 'MOE: Restore', revertOnError: false, targets: data.expressions }); return require('../compositing/shared').restoreEffects({ data: data.fx, host }); },
  summarize(result) { return `Counter on ${result.set.targets.length} layer(s)`; }
};

/* ---------- v0.59 Shake (docs/features/STYLES_SHAKES.md): an impact as real keys, from the pure plan ---------- */
const SH = require('./shakePlan');
const shake = {
  id: 'quick.shake', version: '1.0.0', category: 'tools', group: 'Quick · Animate', name: 'Shake',
  description: 'An impact at the playhead as real keyframes (not an expression): Bump, Zoom Punch, Whip, Slam or Jitter — a damped shake that settles back to the layer\'s own values, so it sits on top of its animation and stays editable.',
  keywords: ['shake', 'impact', 'hit', 'bump', 'punch', 'whip', 'slam', 'jitter', 'rattle', 'camera shake', 'هزة', 'اهتزاز'], icon: 'zoom',
  params: {
    type: { type: 'enum', label: 'Shake', tileFixed: true, default: 'bump', options: Object.keys(SH.TYPES).map((k) => ({ value: k, label: SH.TYPES[k].label })) },
    intensity: { type: 'number', label: 'Intensity', min: 0, max: 300, step: 1, default: 40, description: 'The first hit: pixels for a move (Bump, Whip, Slam, Jitter), percent for Zoom Punch' },
    rotation: { type: 'number', label: 'Rotation', min: 0, max: 90, step: 0.5, default: 0, unit: '°' },
    frequency: { type: 'number', label: 'Frequency', min: 1, max: 40, step: 0.5, default: 7, unit: 'Hz' },
    settle: { type: 'number', label: 'Settle', min: 0.1, max: 4, step: 0.05, default: 0.6, unit: 's', description: 'How long until it is still again' },
    stagger: { type: 'number', label: 'Stagger', min: 0, max: 2, step: 0.01, default: 0, unit: 's', advanced: true }
  },
  requires: { comp: true, minLayers: 1 }, permissions: ['modify.keyframes'], recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'An impact shake at the playhead as keyframes: type bump / zoomPunch / whip / slam / jitter, intensity, rotation, frequency, settle.' },
  uses: { hostOps: ['layers.describe', 'props.values', 'keys.write', 'keys.remove'], network: false }, compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Shake' },
  prepare(args, ctx) {
    const l = visual(ctx).filter((x) => !x.locked);
    if (!l.length) return { ok: false, error: 'Select unlocked layers' };
    const p = SH.plan(args.type, args);
    return { ok: true, layers: l, plan: p, preview: { summary: `${SH.TYPES[args.type].label} · ${p.end.toFixed(2)} s · ${l.length} layer(s)`, items: [] } };
  },
  async execute({ args, ctx, prepared, host }) {
    const comp = ctx.comp, p = prepared.plan;
    const desc = await host.call('layers.describe', { compId: comp.id });
    const items = [], skipped = [];
    // the offsets are added to the layer's OWN value at each key time, so a shake sits on top of its animation
    // v0.61 (ENGINE2.md): the key times are snapped to the comp's frames FIRST, then every own value is read at the
    // snapped time in ONE host call — the value under each key is exactly the layer's value on that frame
    const fd = comp.frameDuration || 1 / 25;
    const jobs = [];
    for (let i = 0; i < prepared.layers.length; i++) {
      const L = prepared.layers[i], D = desc.layers.find((x) => x.id === L.id);
      const t0 = comp.time + i * (args.stagger || 0);
      // queued now, read for ALL layers in one host call below
      const keyed = async (address, list, add) => { jobs.push({ address, add, grid: FG.snapKeys(list.map((k) => ({ t: t0 + k.t, v: k.v })), fd).keys }); };
      if (p.position) {
        if (D.posExpr) skipped.push(`${L.name} (Position has an expression)`);
        else if (!D.transform || !D.transform.position) {
          await keyed(ADDR(L.id, 'ADBE Position_0'), p.position.map((k) => ({ t: k.t, v: k.v[0] })), (v, d) => v + d);
          await keyed(ADDR(L.id, 'ADBE Position_1'), p.position.map((k) => ({ t: k.t, v: k.v[1] })), (v, d) => v + d);
        } else await keyed(ADDR(L.id, 'ADBE Position'), p.position, (v, d) => [v[0] + d[0], v[1] + d[1]].concat(v.length > 2 ? [v[2]] : []));
      }
      if (p.scale) await keyed(ADDR(L.id, 'ADBE Scale'), p.scale, (v, d) => v.map((x, j) => (j < 2 ? x + d : x)));
      if (p.rotation) await keyed(ADDR(L.id, 'ADBE Rotate Z'), p.rotation, (v, d) => v + d);
    }
    if (jobs.length) {
      const reads = []; jobs.forEach((jb) => jb.grid.forEach((k) => reads.push({ address: jb.address, time: k.t })));
      const own = (await host.call('props.values', { compId: comp.id, items: reads })).items;
      let q = 0;
      jobs.forEach((jb) => items.push({ address: jb.address, keys: jb.grid.map((k) => Object.assign({ t: k.t, v: jb.add(own[q++].value, k.v) }, SH.EASE)) }));
    }
    if (!items.length) throw new Error(`Nothing to shake: ${skipped.join(', ')}`);
    const keys = await host.call('keys.write', { compId: comp.id, label: 'MOE: Shake', items });
    return { asked: items.map((it) => it.keys.length), keys, skipped, type: args.type };
  },
  verify({ result, prepared }) {
    // v0.61: compare with the keys asked for after the frame grid (a fast shake can have two peaks inside one frame)
    const asked = result.asked || result.keys.items.map(() => (prepared.plan.position || prepared.plan.scale || prepared.plan.rotation).length);
    const c = result.keys.items.map((it, j) => ({ ok: it.written.length === asked[j], label: `${it.layerName} › ${it.name}`, detail: `${it.written.length} keys, settles at ${it.written[it.written.length - 1].t.toFixed(2)} s` }));
    for (const s of result.skipped) c.push({ ok: true, label: 'Skipped', detail: s });
    return { ok: c.every((x) => x.ok), checks: c };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, items: keyRestore(result.keys.items) }; },
  async restore({ data, host }) { return host.call('keys.remove', data); },
  summarize(result) { return `${SH.TYPES[result.type].label} on ${new Set(result.keys.items.map((i) => i.layerName)).size} layer(s)`; }
};

module.exports = { reveal, purge, duplicate, flip, parentNull, precompose, separate, selectSame, reverseKeys, mirrorKeys, animate, trim, typewriter, counter, counterExpression, offscreen, shake };
