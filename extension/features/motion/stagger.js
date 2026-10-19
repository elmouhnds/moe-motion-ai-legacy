'use strict';
/**
 * Stagger Layers — offset selected layers in time by N frames each.
 * Moves Layer.startTime (keyframes travel with the layer). Frame-exact at any fps.
 */

const TOL = 1e-6;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function orderLayers(layers, order, seed) {
  const list = layers.slice();
  if (order === 'index') list.sort((a, b) => a.index - b.index);
  else if (order === 'reverse') list.sort((a, b) => b.index - a.index);
  else if (order === 'random') {
    const rnd = mulberry32(seed);
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  } else list.sort((a, b) => a.selectionOrder - b.selectionOrder);
  return list;
}

module.exports = {
  id: 'motion.stagger',
  version: '1.0.0',
  category: 'motion',
  group: 'Timing',
  name: 'Stagger Layers',
  description: 'Offset selected layers in time, frame-accurate, in a chosen order.',
  keywords: ['stagger', 'offset', 'cascade', 'sequence', 'delay', 'choreography', 'timing'],
  icon: 'stagger',
  params: {
    frames: { type: 'integer', label: 'Step', description: 'Frames between consecutive layers (negative reverses direction)', min: -600, max: 600, step: 1, default: 2, unit: 'f' },
    order: {
      type: 'enum', label: 'Order', default: 'index', description: 'Which layer goes first',
      options: [{ value: 'index', label: 'Top → Bottom' }, { value: 'reverse', label: 'Bottom → Top' }, { value: 'selection', label: 'Selection' }, { value: 'random', label: 'Random' }]
    },
    mode: {
      type: 'enum', label: 'Mode', default: 'offset', advanced: true, description: 'offset: add the stagger to current timing. align: start all layers from the first layer, then stagger.',
      options: [{ value: 'offset', label: 'Add to current' }, { value: 'align', label: 'Align, then stagger' }]
    },
    seed: { type: 'integer', label: 'Random seed', description: 'Seed for random order', min: 0, max: 99999, default: 1, advanced: true }
  },
  requires: { comp: true, minLayers: 2 },
  permissions: ['modify.layers'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Cascades, sequential reveals, offsetting layers in time, "one after another".' },
  uses: { hostOps: ['layers.setStartTimes'], network: false },
  compatibility: { minAE: '25.0' },
  ui: {
    primaryLabel: 'Stagger',
    presets: [
      { id: 'tight', label: '1f', args: { frames: 1 } },
      { id: 'quick', label: '2f', args: { frames: 2 } },
      { id: 'beat', label: '4f', args: { frames: 4 } },
      { id: 'slow', label: '8f', args: { frames: 8 } }
    ]
  },

  prepare(args, ctx) {
    const fd = ctx.comp.frameDuration;
    const unlocked = ctx.layers.filter((l) => !l.locked);
    const locked = ctx.layers.filter((l) => l.locked);
    if (unlocked.length < 2) return { ok: false, error: 'Select at least 2 unlocked layers' };
    const ordered = orderLayers(unlocked, args.order, args.seed);
    const base = ordered[0].startTime;
    const moves = ordered.map((l, i) => {
      const target = args.mode === 'align' ? base + i * args.frames * fd : l.startTime + i * args.frames * fd;
      return { layerId: l.id, layerIndex: l.index, name: l.name, from: l.startTime, startTime: target };
    });
    const items = moves.map((m, i) => `${m.name}: ${i === 0 && args.mode === 'offset' ? 'stays' : `${Math.round((m.startTime - m.from) / fd)}f`}`);
    if (locked.length) items.push(`Skipped (locked): ${locked.map((l) => l.name).join(', ')}`);
    return {
      ok: true,
      compId: ctx.comp.id,
      moves,
      fps: ctx.comp.frameRate,
      preview: { summary: `Stagger ${moves.length} layers by ${args.frames}f @ ${Math.round(ctx.comp.frameRate * 1000) / 1000} fps`, items }
    };
  },

  async execute({ prepared, host }) {
    return host.call('layers.setStartTimes', {
      compId: prepared.compId,
      label: 'MOE: Stagger Layers',
      layers: prepared.moves.map((m) => ({ layerId: m.layerId, layerIndex: m.layerIndex, startTime: m.startTime }))
    });
  },

  verify({ prepared, result }) {
    const checks = result.layers.map((r) => {
      const want = prepared.moves.find((m) => m.layerId === r.layerId);
      if (r.skipped) return { ok: false, label: r.name, detail: `skipped: ${r.skipped}` };
      const ok = Math.abs(r.after - want.startTime) < TOL;
      return { ok, label: r.name, detail: ok ? `start ${r.after.toFixed(4)}s` : `expected ${want.startTime.toFixed(4)}s, got ${r.after.toFixed(4)}s` };
    });
    return { ok: checks.length > 0 && checks.every((c) => c.ok), checks };
  },

  checkpoint({ result, ctx }) {
    return { compId: ctx.comp.id, layers: result.layers.filter((r) => !r.skipped).map((r) => ({ layerId: r.layerId, startTime: r.before })) };
  },

  async restore({ data, host }) {
    return host.call('layers.setStartTimes', { compId: data.compId, label: 'MOE: Restore Timing', layers: data.layers });
  },

  summarize(result, verification) {
    const n = result.layers.filter((l) => !l.skipped).length;
    return verification.ok ? `Staggered ${n} layers — verified` : `Stagger finished with ${verification.checks.filter((c) => !c.ok).length} problem(s)`;
  },

  _orderLayers: orderLayers
};
