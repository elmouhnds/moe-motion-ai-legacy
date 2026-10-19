'use strict';
/**
 * Grade — recolor a shot with one native Channel Mixer ("MOE Grade").
 * Manual controls + optional auto balance / auto levels from measured pixels.
 */
const cm = require('./colorMath');
const S = require('./shared');

const PARAMS = {
  exposure: { type: 'number', label: 'Exposure', description: 'Exposure in stops', min: -3, max: 3, step: 0.05, default: 0, unit: 'st' },
  contrast: { type: 'number', label: 'Contrast', description: 'Contrast around mid-grey', min: -100, max: 100, step: 1, default: 0 },
  saturation: { type: 'number', label: 'Saturation', description: 'Saturation (100 = unchanged)', min: 0, max: 200, step: 1, default: 100, unit: '%' },
  temperature: { type: 'number', label: 'Temperature', description: 'Negative = cooler (blue), positive = warmer (orange)', min: -100, max: 100, step: 1, default: 0 },
  tint: { type: 'number', label: 'Tint', description: 'Negative = green, positive = magenta', min: -100, max: 100, step: 1, default: 0 },
  autoBalance: { type: 'number', label: 'Auto balance', description: 'Neutralize the measured colour cast (needs pixel analysis)', min: 0, max: 100, step: 1, default: 0, unit: '%' },
  autoLevels: { type: 'number', label: 'Auto levels', description: 'Stretch measured black/white points (needs pixel analysis)', min: 0, max: 100, step: 1, default: 0, unit: '%', advanced: true },
  quality: S.QUALITY_PARAM
};

module.exports = {
  id: 'compositing.grade',
  version: '1.0.0',
  category: 'compositing',
  group: 'Color',
  name: 'Grade',
  description: 'Recolor the selected layers: exposure, contrast, saturation, temperature, tint, auto balance — as one editable Channel Mixer.',
  keywords: ['grade', 'recolor', 'color correction', 'white balance', 'look', 'exposure', 'saturation', 'temperature', 'lumetri'],
  icon: 'grade',
  params: PARAMS,
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.effects', 'modify.layers'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Any colour change of footage/precomps: warmer, cooler, punchier, desaturated, brighter, fix colour cast. Use autoBalance to remove casts.' },
  uses: { hostOps: ['pixels.sample', 'effects.ensure', 'effects.restore'], network: false },
  compatibility: { minAE: '25.0' },
  ui: {
    primaryLabel: 'Apply Grade',
    presets: [
      { id: 'neutral', label: 'Neutral', args: { exposure: 0, contrast: 0, saturation: 100, temperature: 0, tint: 0, autoBalance: 100, autoLevels: 50 } },
      { id: 'warm', label: 'Warm', args: { exposure: 0, contrast: 10, saturation: 105, temperature: 35, tint: 5, autoBalance: 0, autoLevels: 0 } },
      { id: 'cool', label: 'Cool', args: { exposure: 0, contrast: 10, saturation: 95, temperature: -35, tint: -3, autoBalance: 0, autoLevels: 0 } },
      { id: 'punchy', label: 'Punchy', args: { exposure: 0.1, contrast: 30, saturation: 125, temperature: 0, tint: 0, autoBalance: 0, autoLevels: 40 } },
      { id: 'muted', label: 'Muted', args: { exposure: 0, contrast: -15, saturation: 70, temperature: 0, tint: 0, autoBalance: 0, autoLevels: 0 } },
      { id: 'bleach', label: 'Bleach', args: { exposure: -0.1, contrast: 35, saturation: 45, temperature: -5, tint: 0, autoBalance: 0, autoLevels: 0 } }
    ]
  },

  prepare(args, ctx) {
    const needsPixels = args.autoBalance > 0 || args.autoLevels > 0;
    const t = S.targets(ctx, { needPixels: needsPixels });
    if (!t.usable.length) return { ok: false, error: t.skipped.length ? `No layer to grade: ${t.skipped.join(', ')}` : 'Select a layer to grade' };
    const bits = [];
    if (args.exposure) bits.push(`${args.exposure > 0 ? '+' : ''}${args.exposure} st`);
    if (args.contrast) bits.push(`contrast ${args.contrast > 0 ? '+' : ''}${args.contrast}`);
    if (args.saturation !== 100) bits.push(`sat ${args.saturation}%`);
    if (args.temperature) bits.push(args.temperature > 0 ? `warm ${args.temperature}` : `cool ${-args.temperature}`);
    if (args.tint) bits.push(`tint ${args.tint}`);
    if (args.autoBalance) bits.push(`auto balance ${args.autoBalance}%`);
    if (args.autoLevels) bits.push(`auto levels ${args.autoLevels}%`);
    const items = t.usable.map((l) => `${l.name}: ${(l.effects || []).some((e) => e.name === S.KEYS.grade) ? 'update MOE Grade' : 'add MOE Grade'}`);
    items.push(...t.skipped.map((s) => `Skipped: ${s}`));
    return { ok: true, layers: t.usable, needsPixels, preview: { summary: `Grade ${t.usable.length} layer${t.usable.length > 1 ? 's' : ''}${bits.length ? ` (${bits.join(', ')})` : ' (neutral)'}`, items } };
  },

  async execute({ args, ctx, prepared, host }) {
    const requests = [];
    const analysis = [];
    for (const l of prepared.layers) {
      let st = null;
      if (prepared.needsPixels) {
        const s = await S.sample(host, ctx, l, { quality: args.quality });
        st = s.stats;
        analysis.push({ layerId: l.id, name: l.name, probeOk: s.probeOk, cast: st ? cm.describeCast(st) : 'transparent' });
      }
      const mixer = cm.toChannelMixer(cm.gradeMap(args, st));
      requests.push({ layer: { layerId: l.id }, clamped: mixer.clamped, items: [{ key: S.KEYS.grade, matchName: S.MATCH.mixer, before: [], expectParams: S.MIXER_PARAM_COUNT, params: mixer.params }] });
    }
    const write = await S.writeEffects(host, ctx, requests.map((r) => ({ layer: r.layer, items: r.items })), 'MOE: Grade');
    return Object.assign(write, { requests, analysis });
  },

  verify({ result }) {
    const extra = [];
    for (const a of result.analysis) extra.push({ ok: a.probeOk, label: `${a.name} › analysis`, detail: a.probeOk ? `measured (${a.cast})` : 'helper layer not removed' });
    for (const r of result.requests) if (r.clamped.length) extra.push({ ok: true, label: 'Range', detail: `clamped to ±200 %: ${r.clamped.join(', ')}` });
    return S.verifyEffects(result, result.requests, extra);
  },
  checkpoint({ result, ctx }) { return S.effectsCheckpoint(result, ctx); },
  restore: S.restoreEffects,
  summarize(result, v) {
    const n = result.layers.length;
    return v.ok ? `Graded ${n} layer${n > 1 ? 's' : ''} — MOE Grade verified` : `Grade finished with ${v.checks.filter((c) => !c.ok).length} problem(s)`;
  },
  PARAMS
};
