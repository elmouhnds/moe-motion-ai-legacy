'use strict';
/** Analyze Shot — measure the selected layer's pixels (local, no net change). */
const cm = require('./colorMath');
const S = require('./shared');

function swatches(h, cells, cols) {
  return h('div', { class: 'swatches', style: { gridTemplateColumns: `repeat(${cols}, 1fr)` } },
    cells.map((c) => h('span', { class: 'swatch', title: S.rgbText(c), style: { background: `rgb(${c.slice(0, 3).map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(',')})` } })));
}

module.exports = {
  id: 'compositing.analyze',
  version: '1.0.0',
  category: 'compositing',
  group: 'Analyze',
  name: 'Analyze Shot',
  description: 'Measure colour, exposure, cast, clipping and screen colour of the selected layer.',
  keywords: ['analyze', 'analysis', 'scopes', 'histogram', 'color cast', 'exposure', 'levels', 'measure'],
  icon: 'pulse',
  params: {
    sampleAt: { type: 'enum', label: 'Frames', default: 'spread', description: 'Measure at the current time or spread across the layer',
      options: [{ value: 'current', label: 'Current' }, { value: 'spread', label: 'Across layer' }] },
    quality: S.QUALITY_PARAM
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers'],
  recovery: 'undo',
  ai: null,
  uses: { hostOps: ['pixels.sample'], network: false },
  compatibility: { minAE: '25.0' },
  ui: {
    primaryLabel: 'Analyze',
    renderResult(r, { h, app }) {
      if (!r || !r.result || !r.result.layers) return null;
      return h('div', {}, r.result.layers.map((L) => h('div', { class: 'analysis' },
        h('div', { class: 'why' }, L.name),
        swatches(h, L.firstCells, L.cols),
        h('dl', { class: 'kv tight' },
          h('dt', {}, 'Mean'), h('dd', {}, S.rgbText(L.stats.mean) + (L.keyed ? ' · keyed subject' : '')),
          h('dt', {}, 'Luminance'), h('dd', {}, `${S.pct(L.stats.luminance)} · black ${S.pct(L.stats.black)} · white ${S.pct(L.stats.white)}`),
          h('dt', {}, 'Cast'), h('dd', {}, L.cast),
          h('dt', {}, 'Saturation'), h('dd', {}, S.pct(L.stats.saturation)),
          L.screen ? [h('dt', {}, 'Screen'), h('dd', {}, `${L.screen.kind} ${S.rgbText(L.screen.color)} · ${S.pct(L.screen.coverage)} of edges`)] : null),
        h('div', { class: 'actions' },
          h('button', { class: 'btn', onclick: () => app.prefillTool('compositing.grade', { autoBalance: L.cast === 'neutral' ? 0 : 100, autoLevels: 60 }) }, 'Grade with auto balance'),
          L.screen ? h('button', { class: 'btn ghost', onclick: () => app.prefillTool('compositing.keySetup', { screen: L.screen.kind }) }, `Key ${L.screen.kind} screen`) : null))));
    }
  },

  prepare(args, ctx) {
    const t = S.targets(ctx, { needPixels: true });
    if (!t.usable.length) return { ok: false, error: t.skipped.length ? `Nothing to analyze: ${t.skipped.join(', ')}` : 'Select a footage, precomp or solid layer' };
    const layers = t.usable.slice(0, 4);
    return { ok: true, layers, preview: { summary: `Analyze ${layers.map((l) => l.name).join(', ')}`, items: t.skipped.map((s) => `Skipped: ${s}`) } };
  },

  async execute({ args, ctx, prepared, host }) {
    const out = [];
    for (const l of prepared.layers) {
      const q = S.QUALITY[args.quality];
      const times = S.sampleTimes(l, ctx, q.times, args.sampleAt);
      const s = await S.sample(host, ctx, l, { quality: args.quality, times });
      if (!s.stats) { out.push({ layerId: l.id, name: l.name, empty: true, probeOk: s.probeOk }); continue; }
      out.push({
        layerId: l.id, name: l.name, cols: s.raw.cols, stats: s.stats, cast: cm.describeCast(s.stats),
        screen: s.keyed ? null : cm.screenColor(s.raw.samples[0].cells, s.raw.cols, s.raw.rows, 'auto'),
        firstCells: s.raw.samples[0].cells, probeOk: s.probeOk, keyed: s.keyed, bitsPerChannel: s.raw.bitsPerChannel
      });
    }
    return { layers: out };
  },

  verify({ result }) {
    const checks = [];
    for (const L of result.layers) {
      checks.push({ ok: L.probeOk, label: `${L.name} › helper layer`, detail: L.probeOk ? 'removed, project unchanged' : 'layer count changed — check for "MOE Probe (temporary)"' });
      if (L.empty) { checks.push({ ok: false, label: L.name, detail: 'fully transparent at the sampled frames' }); continue; }
      if (L.stats.clippedHigh > 0.05) checks.push({ ok: true, label: `${L.name} › highlights`, detail: `${S.pct(L.stats.clippedHigh)} of regions clipped` });
      if (L.bitsPerChannel === 8) checks.push({ ok: true, label: 'Project', detail: '8-bpc: strong grades may band or clip; 16/32-bpc recommended' });
    }
    return { ok: checks.every((c) => c.ok), checks };
  },

  summarize(result) {
    const L = result.layers.find((x) => !x.empty);
    if (!L) return 'No visible pixels at the sampled frames';
    return `${L.name}: ${L.cast} · luminance ${S.pct(L.stats.luminance)}${L.screen ? ` · ${L.screen.kind} screen detected` : ''}`;
  }
};
