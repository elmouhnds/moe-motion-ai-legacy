'use strict';
/**
 * Scene Check tools (v0.80, docs/features/SCENE_CHECK.md). Both run only on a click and never in the background.
 *   scene.read     read-only: every layer (layers.describe), Transform keys + expressions (keys.snapshot), markers
 *   scene.measure  measures boxes with After Effects' own probe (layers.bounds makes and removes a temporary null —
 *                  the layer count is read back) and reads shape colours; it leaves nothing behind
 */
const P = require('./plan');

const read = {
  id: 'scene.read', version: '1.0.0', category: 'tools', group: 'Scene', name: 'Read This Comp',
  description: 'Read the active comp once — layers, Transform keys, expressions and markers — for the Scene Check page: which kit fits, the motion timeline, and the quality check.',
  keywords: ['scene', 'check', 'quality', 'qc', 'review', 'timeline', 'overview', 'suggest', 'what kit'], icon: 'eye',
  params: {}, requires: { comp: true }, permissions: ['read'], recovery: 'none', ai: { callable: true, hint: 'Read the active comp (layers, keys, markers) for an overview. Changes nothing.' },
  uses: { hostOps: ['layers.describe', 'keys.snapshot', 'markers.list'], network: false }, compatibility: { minAE: '25.0' }, ui: { primaryLabel: 'Read this comp', lockedOk: true },
  prepare(args, ctx) { return { ok: true, preview: { summary: `Read ${ctx.comp.name} (${ctx.comp.numLayers} layers) — nothing is changed`, items: ['Layers', 'Transform keys and expressions', 'Markers'] } }; },
  async execute({ ctx, host }) {
    const desc = await host.call('layers.describe', { compId: ctx.comp.id });
    const ids = desc.layers.slice(0, P.LIMITS.layers).map((L) => L.id);
    const snaps = ids.length ? await host.call('keys.snapshot', { compId: ctx.comp.id, layerIds: ids, group: 'transform' }) : { items: [] };
    const markers = await host.call('markers.list', { compId: ctx.comp.id });
    return { scan: P.summarise(desc, snaps, markers), layersInComp: desc.layers.length, expected: ctx.comp.numLayers };
  },
  verify({ result }) {
    const ok = result.layersInComp === result.expected && result.scan.layers.length === result.layersInComp;
    return { ok, checks: [{ ok, label: result.scan.comp.name, detail: `${result.scan.layers.length} layers read (the comp has ${result.expected}) · ${result.scan.layers.reduce((n, L) => n + L.props.length, 0)} animated Transform properties · ${result.scan.markers.comp.length + result.scan.markers.layers.reduce((n, m) => n + m.markers.length, 0)} markers` }] };
  },
  summarize(result) { return `${result.scan.comp.name}: ${result.scan.layers.length} layers read`; }
};

const measure = {
  id: 'scene.measure', version: '1.0.0', category: 'tools', group: 'Scene', name: 'Measure Scenes',
  description: 'Measure where every visible layer is at each scene (After Effects\' own measurement through a temporary null that is removed) and read the shape colours — for the safe-area check, the brand-colour check and the storyboard.',
  keywords: ['storyboard', 'safe area', 'title safe', 'measure', 'brand colours check'], icon: 'target',
  params: { times: { type: 'string', label: 'Scene times', maxLength: 400, hidden: true, description: 'JSON list of seconds (at most 12); the playhead is always measured too' } },
  requires: { comp: true }, permissions: ['modify.layers'], recovery: 'undo', ai: { callable: false },
  uses: { hostOps: ['layers.describe', 'layers.bounds', 'props.colorTargets', 'props.values'], network: false }, compatibility: { minAE: '25.0' }, ui: { primaryLabel: 'Measure', lockedOk: true },
  prepare(args, ctx) {
    let times = []; try { times = JSON.parse(args.times || '[]'); } catch (e) { return { ok: false, error: 'The scene times cannot be read' }; }
    if (!Array.isArray(times) || times.some((t) => typeof t !== 'number' || !(t >= 0))) return { ok: false, error: 'The scene times must be seconds' };
    times = times.slice(0, P.LIMITS.scenes - 1).filter((t) => t < ctx.comp.duration);
    return { ok: true, times: [ctx.comp.time].concat(times).slice(0, 12), preview: { summary: `Measure ${ctx.comp.name} at ${1 + times.length} moment${times.length ? 's' : ''}`, items: ['Boxes of the visible layers', 'Shape colours'], warnings: ['A temporary null is made for the measurement and removed — the layer count is read back'] } };
  },
  async execute({ ctx, prepared, host }) {
    const desc = await host.call('layers.describe', { compId: ctx.comp.id });
    const vis = desc.layers.filter((L) => L.enabled && L.hasVideo !== false && !L.guide).slice(0, P.LIMITS.layers);
    const boxesAt = prepared.times.map(() => ({}));
    if (vis.length) {
      const b = await host.call('layers.bounds', { compId: ctx.comp.id, layerIds: vis.map((L) => L.id), times: prepared.times });
      // layers.bounds answers per layer: { layerId, boxes: [[l, t, r, b] per time] } (or one box when one time)
      (b.layers || b.items || []).forEach((it) => { const list = it.boxes || (it.box ? [it.box] : []); list.forEach((bx, i) => { if (bx && boxesAt[i]) boxesAt[i][it.layerId] = bx; }); });
    }
    const colours = [];
    const shapes = vis.filter((L) => L.type === 'shape').slice(0, P.LIMITS.colourLayers);
    if (shapes.length) {
      const tg = await host.call('props.colorTargets', { compId: ctx.comp.id, layers: shapes.map((L) => L.id), mode: 'both' });
      const items = []; tg.layers.forEach((L) => L.addresses.slice(0, 6).forEach((a) => items.push({ address: a.address || a, layerId: L.layerId, name: L.name })));
      if (items.length) {
        const vals = await host.call('props.values', { compId: ctx.comp.id, items: items.map((i) => ({ address: i.address, time: ctx.comp.time })) });
        (vals.items || vals.values || []).forEach((v, i) => { const rgb = v && (v.value || v.v); if (Array.isArray(rgb) && rgb.length >= 3) colours.push({ layerId: items[i].layerId, name: items[i].name, rgb: rgb.slice(0, 3) }); });
      }
    }
    const after = await host.call('layers.describe', { compId: ctx.comp.id });
    return { times: prepared.times, boxesAt, colours, measured: vis.length, layersBefore: desc.layers.length, layersAfter: after.layers.length };
  },
  verify({ result }) {
    const clean = result.layersBefore === result.layersAfter;
    const got = Object.keys(result.boxesAt[0] || {}).length;
    return { ok: clean && (got > 0 || result.measured === 0), checks: [{ ok: clean, label: 'Nothing left behind', detail: `${result.layersAfter} layers, as before` }, { ok: got > 0 || result.measured === 0, label: 'Boxes', detail: `${got} of ${result.measured} visible layers measured at ${result.times.length} moment${result.times.length === 1 ? '' : 's'}` }] };
  },
  summarize(result) { return `Measured ${Object.keys(result.boxesAt[0] || {}).length} layers at ${result.times.length} moment${result.times.length === 1 ? '' : 's'}`; }
};

module.exports = { read, measure };
