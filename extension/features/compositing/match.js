'use strict';
/** Match Color — match the selected layers to a reference layer (plate or reference frame). */
const cm = require('./colorMath');
const S = require('./shared');

module.exports = {
  id: 'compositing.matchColor',
  version: '1.0.0',
  category: 'compositing',
  group: 'Color',
  name: 'Match Color',
  description: 'Match colour and contrast of the selected layers to a reference layer at the current frame.',
  keywords: ['match', 'reference', 'plate', 'color match', 'integrate', 'comp match', 'transfer'],
  icon: 'layers',
  params: {
    reference: { type: 'layer', label: 'Reference', description: 'Layer to match (background plate or reference still), measured at the current time', required: true },
    strength: { type: 'number', label: 'Strength', description: 'How strongly to match', min: 0, max: 100, step: 1, default: 100, unit: '%' },
    quality: S.QUALITY_PARAM
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.effects', 'modify.layers'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Make a foreground sit in a plate, or match shots to a reference layer. reference = layer number from compLayers.' },
  uses: { hostOps: ['pixels.sample', 'effects.ensure', 'effects.restore'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Match' },

  prepare(args, ctx) {
    const ref = (ctx.compLayers || []).find((l) => l.index === args.reference);
    if (!ref) return { ok: false, error: 'Choose a reference layer' };
    if (['null', 'camera', 'light', 'adjustment'].includes(ref.type)) return { ok: false, error: `“${ref.name}” has no pixels to match` };
    const t = ctx.comp.time;
    if (t < ref.inPoint || t >= ref.outPoint) return { ok: false, error: `Move the time indicator to a frame where “${ref.name}” is visible` };
    const t2 = S.targets(ctx, { needPixels: true });
    const usable = t2.usable.filter((l) => l.id !== ref.id);
    if (!usable.length) return { ok: false, error: 'Select the layer(s) to match — not the reference itself' };
    const items = usable.map((l) => `${l.name} → ${ref.name} @ ${t.toFixed(2)}s`);
    items.push(...t2.skipped.map((s) => `Skipped: ${s}`));
    const refSelected = (ctx.layers || []).find((l) => l.id === ref.id);
    return { ok: true, ref: Object.assign({}, ref, { effects: refSelected ? refSelected.effects : [] }), layers: usable, preview: { summary: `Match ${usable.length} layer${usable.length > 1 ? 's' : ''} to “${ref.name}” (${args.strength}%)`, items } };
  },

  async execute({ args, ctx, prepared, host }) {
    const refSample = await S.sample(host, ctx, { id: prepared.ref.id, inPoint: prepared.ref.inPoint, outPoint: prepared.ref.outPoint, effects: prepared.ref.effects || [] }, { quality: args.quality, times: [ctx.comp.time] });
    if (!refSample.stats) throw Object.assign(new Error(`Reference “${prepared.ref.name}” is transparent at this frame`), { code: 'REF_EMPTY' });
    const requests = [];
    const analysis = [{ name: prepared.ref.name, probeOk: refSample.probeOk, stats: refSample.stats, keyed: refSample.keyed }];
    for (const l of prepared.layers) {
      const s = await S.sample(host, ctx, l, { quality: args.quality });
      analysis.push({ name: l.name, probeOk: s.probeOk, stats: s.stats, keyed: s.keyed });
      if (!s.stats) continue;
      const screen = !s.keyed && cm.screenColor(s.raw.samples[0].cells, s.raw.cols, s.raw.rows, 'auto');
      if (screen && screen.coverage >= 0.5) {
        throw Object.assign(new Error(`“${l.name}” has an unkeyed ${screen.kind} screen — run Screen Key first, otherwise the match measures the screen instead of the subject.`), { code: 'SCREEN_NOT_KEYED' });
      }
      const map = cm.blend(cm.transfer(s.stats, refSample.stats), args.strength / 100);
      const mixer = cm.toChannelMixer(map);
      requests.push({
        layer: { layerId: l.id }, clamped: mixer.clamped,
        predicted: cm.apply(map, s.stats.mean), refMean: refSample.stats.mean,
        items: [{ key: S.KEYS.match, matchName: S.MATCH.mixer, before: [S.KEYS.grade], expectParams: S.MIXER_PARAM_COUNT, params: mixer.params }]
      });
    }
    if (!requests.length) throw Object.assign(new Error('Selected layers are transparent at the sampled frames'), { code: 'SRC_EMPTY' });
    const write = await S.writeEffects(host, ctx, requests.map((r) => ({ layer: r.layer, items: r.items })), 'MOE: Match Color');
    return Object.assign(write, { requests, analysis });
  },

  verify({ result }) {
    const extra = result.analysis.map((a) => ({ ok: a.probeOk, label: `${a.name} › analysis`, detail: a.probeOk ? (a.stats ? `mean ${S.rgbText(a.stats.mean)}${a.keyed ? ' · keyed subject only' : ''}` : 'transparent — skipped') : 'helper layer not removed' }));
    for (const r of result.requests) if (r.clamped.length) extra.push({ ok: true, label: 'Range', detail: `clamped to ±200 %: ${r.clamped.join(', ')}` });
    return S.verifyEffects(result, result.requests, extra);
  },
  checkpoint({ result, ctx }) { return S.effectsCheckpoint(result, ctx); },
  restore: S.restoreEffects,
  summarize(result, v) {
    return v.ok ? `Matched ${result.layers.length} layer(s) — MOE Match verified` : `Match finished with ${v.checks.filter((c) => !c.ok).length} problem(s)`;
  }
};
