'use strict';
/** Green-Screen Key — Keylight with sampled screen colour + cleanup chain. */
const cm = require('./colorMath');
const S = require('./shared');

module.exports = {
  id: 'compositing.keySetup',
  version: '1.0.0',
  category: 'compositing',
  group: 'Key',
  name: 'Screen Key',
  description: 'Key a green or blue screen: Keylight with an auto-sampled screen colour, Key Cleaner, spill suppression and choke.',
  keywords: ['key', 'keying', 'green screen', 'blue screen', 'chroma', 'keylight', 'spill', 'matte', 'choke'],
  icon: 'key',
  params: {
    screen: { type: 'enum', label: 'Screen', default: 'auto', description: 'Screen colour to remove (sampled from the frame edges)',
      options: [{ value: 'auto', label: 'Auto' }, { value: 'green', label: 'Green' }, { value: 'blue', label: 'Blue' }] },
    cleanup: { type: 'boolean', label: 'Key Cleaner', description: 'Add Key Cleaner to recover edge detail', default: true },
    spill: { type: 'boolean', label: 'Spill', description: 'Add Advanced Spill Suppressor', default: true },
    choke: { type: 'number', label: 'Choke', description: 'Shrink (+) or grow (−) the matte edge, Simple Choker pixels; 0 = none', min: -10, max: 10, step: 0.1, default: 0, unit: 'px' }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.effects', 'modify.layers'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Remove a green/blue screen from footage.' },
  uses: { hostOps: ['pixels.sample', 'effects.ensure', 'effects.restore'], network: false },
  compatibility: { minAE: '25.0' },
  ui: {
    primaryLabel: 'Key',
    presets: [
      { id: 'green', label: 'Green screen', args: { screen: 'green' } },
      { id: 'blue', label: 'Blue screen', args: { screen: 'blue' } },
      { id: 'tight', label: 'Tight edge', args: { choke: 1 } }
    ]
  },

  prepare(args, ctx) {
    const t = S.targets(ctx, { needPixels: true });
    const blocked = [];
    const usable = t.usable.filter((l) => {
      const f = S.foreignKeyers(l);
      if (f.length) blocked.push(`${l.name} already has ${f.map((e) => e.name).join(', ')}`);
      return !f.length;
    });
    if (!usable.length) {
      const why = [...blocked, ...t.skipped];
      return { ok: false, error: why.length ? why.join(' · ') : 'Select the green-screen footage layer' };
    }
    const chain = ['Keylight', args.cleanup && 'Key Cleaner', args.spill && 'Spill', args.choke && `Choke ${args.choke}px`].filter(Boolean).join(' → ');
    return {
      ok: true, layers: usable,
      preview: { summary: `Key ${usable.length} layer${usable.length > 1 ? 's' : ''}: ${chain}`, items: [...usable.map((l) => `${l.name}: sample ${args.screen === 'auto' ? 'screen' : args.screen} colour at ${ctx.comp.time.toFixed(2)}s`), ...blocked.map((b) => `Skipped: ${b}`), ...t.skipped.map((s) => `Skipped: ${s}`)] }
    };
  },

  async execute({ args, ctx, prepared, host }) {
    const requests = [];
    const analysis = [];
    for (const l of prepared.layers) {
      const s = await S.sample(host, ctx, l, { quality: 'thorough', times: S.sampleTimes(l, ctx, 1, 'current'), screen: true });
      const sc = cm.screenColor(s.raw.samples[0].cells, s.raw.cols, s.raw.rows, args.screen);
      analysis.push({ name: l.name, probeOk: s.probeOk, screen: sc });
      if (!sc) {
        throw Object.assign(new Error(`No ${args.screen === 'auto' ? 'green or blue' : args.screen} screen found along the edges of “${l.name}” at this frame. Move to a frame with visible screen, or pick the colour in Keylight.`), { code: 'NO_SCREEN' });
      }
      const items = [{
        key: S.KEYS.key, matchName: S.MATCH.keylight, before: [S.KEYS.match, S.KEYS.grade],
        params: [{ id: 'Screen Colour', value: [sc.color[0], sc.color[1], sc.color[2], 1], names: ['Screen Colour', 'Screen Color'], nth: { type: 'COLOR', n: 1 } }]
      }];
      if (args.cleanup) items.push({ key: S.KEYS.cleaner, matchName: S.MATCH.cleaner, before: [S.KEYS.match, S.KEYS.grade], params: [] });
      if (args.spill) items.push({ key: S.KEYS.spill, matchName: S.MATCH.spill, before: [S.KEYS.match, S.KEYS.grade], params: [] });
      if (args.choke) items.push({ key: S.KEYS.choke, matchName: S.MATCH.choker, before: [S.KEYS.match, S.KEYS.grade], params: [{ id: 'Choke Matte', value: args.choke, names: ['Choke Matte'], suffix: 2, nth: { type: 'OneD', n: 2 } }] });
      requests.push({ layer: { layerId: l.id }, items });
    }
    const write = await S.writeEffects(host, ctx, requests, 'MOE: Screen Key');
    return Object.assign(write, { requests, analysis });
  },

  verify({ result }) {
    const extra = result.analysis.map((a) => ({ ok: a.probeOk, label: `${a.name} › screen`, detail: `${a.screen.kind} ${S.rgbText(a.screen.color)} (${S.pct(a.screen.coverage)} of edges)` }));
    const v = S.verifyEffects(result, result.requests, extra);
    // Order check: MOE key chain must be contiguous in the documented order.
    for (const L of result.layers) {
      const idx = L.items.map((i) => i.index);
      const ordered = idx.every((v2, i) => i === 0 || v2 > idx[i - 1]);
      v.checks.push({ ok: ordered, label: `${L.name} › order`, detail: ordered ? L.items.map((i) => i.key.replace('MOE ', '')).join(' → ') : 'unexpected effect order' });
    }
    v.ok = v.checks.every((c) => c.ok);
    return v;
  },
  checkpoint({ result, ctx }) { return S.effectsCheckpoint(result, ctx); },
  restore: S.restoreEffects,
  summarize(result, v) {
    return v.ok ? `Keyed ${result.layers.length} layer(s) — screen colour sampled, chain verified` : `Key setup finished with ${v.checks.filter((c) => !c.ok).length} problem(s)`;
  }
};
