'use strict';
/**
 * Beat Markers (v0.67, docs/features/SMART_LAYER.md): the beats of a sound layer as layer markers, so Marker Pulse,
 * Marker Trigger and Marker In / Out follow the music. The sound is read only through After Effects' own Convert
 * Audio to Keyframes (audio.amplitude → the reused `MOE Audio · <layer>` layer); beats come from the pure finder.
 * Restore removes exactly the markers this run wrote (time + "MOE Beat" comment) and the amplitude layer only if
 * this run made it.
 */
const BEATS = require('./beats');

const COMMENT = 'MOE Beat';
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

const beatMarkers = {
  id: 'markers.beats', version: '1.0.0', category: 'layout', group: 'Timing', name: 'Beat Markers',
  description: 'Put a marker on every beat of the sound layer — on the selected layers, or on the sound layer itself. Marker Pulse, Marker Trigger and Marker In / Out then follow the music.',
  keywords: ['beat', 'beats', 'music', 'audio', 'rhythm', 'marker', 'markers', 'sync', 'bpm'],
  icon: 'xPulse',
  params: {
    sensitivity: { type: 'number', label: 'Sensitivity', min: 0, max: 100, step: 1, default: 60, unit: '%', description: 'Higher finds softer beats' },
    minGap: { type: 'number', label: 'Min gap', min: 0.05, max: 4, step: 0.05, default: 0.25, unit: 's', description: 'Two beats are at least this far apart' },
    max: { type: 'integer', label: 'At most', min: 1, max: 1000, default: 200, advanced: true }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers'], recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Mark the beats of the comp\'s sound layer on the selected layers (for Marker Pulse / Trigger).' },
  uses: { hostOps: ['layers.describe', 'audio.amplitude', 'audio.envelope', 'markers.add', 'markers.remove', 'layers.remove'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Mark Beats' },

  prepare(args, ctx) {
    const layers = (ctx.layers || []).filter((l) => !/^MOE Audio · /.test(l.name));
    if (!layers.length) return { ok: false, error: 'Select the layers that should get the beats (or the sound layer itself)' };
    return { ok: true, layers, preview: { summary: `Markers on the beats · ${plural(layers.length, 'layer')}`, items: layers.map((l) => l.name) } };
  },

  explain(args, ctx, prepared) {
    if (!prepared || !prepared.ok) return {};
    return {
      target: `${plural(prepared.layers.length, 'layer')} · the sound layer's beats`,
      writes: [`a "${COMMENT}" marker on every beat (sensitivity ${args.sensitivity} %, at least ${args.minGap} s apart)`, 'reads the sound with After Effects\' Convert Audio to Keyframes (MOE Audio layer, reused)']
    };
  },

  async execute({ ctx, prepared, args, host }) {
    const desc = await host.call('layers.describe', { compId: ctx.comp.id });
    const ids = new Set(prepared.layers.map((l) => l.id));
    const src = desc.layers.find((l) => ids.has(l.id) && l.hasAudio) || desc.layers.find((l) => l.hasAudio && !/^MOE Audio · /.test(l.name));
    if (!src) throw Object.assign(new Error('No layer with sound in this comp — add a music layer first.'), { code: 'NO_AUDIO' });
    // markers go on the selected layers; when only the sound layer is selected, on it
    const targets = prepared.layers.filter((l) => l.id !== src.id);
    const on = targets.length ? targets.map((l) => l.id) : [src.id];
    const amp = await host.call('audio.amplitude', { compId: ctx.comp.id, layerId: src.id, name: `MOE Audio · ${src.name}` });
    const env = await host.call('audio.envelope', { compId: ctx.comp.id, layerId: amp.layerId });
    const times = BEATS.find(env.times, env.values, { sensitivity: args.sensitivity, minGap: args.minGap, max: args.max });
    if (!times.length) {
      if (amp.created) await host.call('layers.remove', { compId: ctx.comp.id, layerIds: [amp.layerId] }).catch(() => {});
      throw Object.assign(new Error(`No beats found in ${src.name} — raise Sensitivity.`), { code: 'NO_BEATS' });
    }
    const add = await host.call('markers.add', { compId: ctx.comp.id, label: 'MOE: Beat Markers', layers: on, times, comment: COMMENT });
    return { src: { id: src.id, name: src.name }, amp, times, add, on };
  },

  verify({ result }) {
    const checks = result.add.layers.map((l) => (l.skipped ? { ok: true, label: l.name, detail: 'locked — skipped' }
      : { ok: l.added === result.times.length && l.total >= result.times.length, label: l.name, detail: `${plural(l.added, 'beat marker')} (${l.total} markers on the layer)` }));
    return { ok: checks.every((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) {
    return { compId: ctx.comp.id, layers: result.add.layers.filter((l) => !l.skipped).map((l) => l.layerId), times: result.times, ampLayerId: result.amp.created ? result.amp.layerId : null };
  },
  async restore({ data, host }) {
    await host.call('markers.remove', { compId: data.compId, label: 'MOE: Restore Beat Markers', layers: data.layers, times: data.times, comment: COMMENT });
    if (data.ampLayerId) await host.call('layers.remove', { compId: data.compId, layerIds: [data.ampLayerId] }).catch(() => {});
    return { ok: true };
  },
  summarize(result) { return `${plural(result.times.length, 'beat')} of ${result.src.name} marked on ${plural(result.add.layers.filter((l) => !l.skipped).length, 'layer')}`; }
};

module.exports = { beatMarkers, COMMENT };
