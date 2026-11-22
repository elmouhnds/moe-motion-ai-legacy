'use strict';
/** Text animation tools: apply library presets (MOE spec or imported .ffx) to selected text layers. */
const { buildSpec } = require('./presets');
const { hasArabic } = require('../brand/brands');

const NAMES = { in: 'MOE In', out: 'MOE Out' };

function textLayers(ctx) {
  const all = (ctx.layers || []).filter((l) => l.type === 'text');
  return { usable: all.filter((l) => !l.locked), locked: all.filter((l) => l.locked) };
}

const animate = {
  id: 'text.animate',
  version: '1.0.0',
  category: 'text',
  group: 'Animate',
  name: 'Animate Text',
  description: 'Apply a text animation preset (In or Out) to the selected text layers as an editable Text Animator.',
  keywords: ['text', 'animation', 'animator', 'typography', 'in', 'out', 'reveal', 'kinetic', 'preset'],
  icon: 'type',
  params: {
    presetId: { type: 'string', label: 'Preset', required: true, description: 'Preset id from the text library' },
    duration: { type: 'number', label: 'Duration', min: 0, max: 10, step: 0.05, default: 0, unit: 's', description: '0 = preset duration' }, // v0.44: min 0 — the default 0 (= preset) was refused by its own minimum
    distance: { type: 'number', label: 'Distance', min: 0, max: 300, step: 1, default: 100, unit: '%', description: 'Scales movement / tracking' },
    direction: { type: 'enum', label: 'Direction', default: 'preset', description: 'Where text comes from (slide presets)',
      options: [{ value: 'preset', label: 'Preset' }, { value: 'up', label: 'Below' }, { value: 'down', label: 'Above' }, { value: 'right', label: 'Left' }, { value: 'left', label: 'Right' }] },
    basedOn: { type: 'enum', label: 'Based on', default: 'preset', advanced: true,
      options: [{ value: 'preset', label: 'Preset' }, { value: '2', label: 'Chars' }, { value: '3', label: 'Words' }, { value: '4', label: 'Lines' }] },
    placement: { type: 'enum', label: 'Timing', default: 'auto', advanced: true, description: 'auto: In starts at the time indicator, Out ends at the layer out point',
      options: [{ value: 'auto', label: 'Auto' }, { value: 'cti', label: 'Start at CTI' }, { value: 'layerStart', label: 'Layer start' }] }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Animate text layers in or out. presetId from the text library (e.g. moe-in-down, rise-soft, typewriter, moe-out-down). Use Words/Lines for Arabic.' },
  uses: { hostOps: ['text.applyAnimator', 'text.removeAnimator', 'text.applyFfx'], network: false },
  compatibility: { minAE: '25.0' },

  prepare(args, ctx, services) {
    const preset = services && services.textLibrary ? services.textLibrary.get(args.presetId) : null;
    if (!preset) return { ok: false, error: 'Choose a preset' };
    const t = textLayers(ctx);
    if (!t.usable.length) return { ok: false, error: t.locked.length ? 'Selected text layers are locked' : 'Select text layers' };
    const fd = ctx.comp.frameDuration;
    const duration = args.duration || preset.duration || 1;
    const notes = [];
    let basedOn = args.basedOn;
    if (preset.source !== 'ffx' && basedOn === 'preset' && preset.basedOn < 3 && t.usable.some((l) => hasArabic(l.text))) {
      basedOn = '3';
      notes.push('Arabic text: switched to Words so letters stay joined');
    }
    const layers = t.usable.map((l) => {
      let start;
      if (args.placement === 'layerStart') start = l.inPoint;
      else if (args.placement === 'cti') start = ctx.comp.time;
      else start = preset.kind === 'out' ? l.outPoint - duration : Math.max(ctx.comp.time, l.inPoint);
      return { layerId: l.id, name: l.name, startTime: Math.round(start / fd) * fd };
    });
    const isFfx = preset.source === 'ffx';
    return {
      ok: true, preset, isFfx, duration, layers, fd,
      spec: isFfx ? null : buildSpec(preset, { duration, distance: args.distance, basedOn, direction: args.direction }),
      preview: {
        summary: `${preset.name} on ${layers.length} text layer${layers.length > 1 ? 's' : ''} · ${duration.toFixed(2)}s`,
        items: [...layers.map((l) => `${l.name}: ${l.startTime.toFixed(2)}s → ${(l.startTime + duration).toFixed(2)}s`), ...notes, ...(isFfx ? ['Imported .ffx: applied by After Effects at the time indicator'] : []), ...t.locked.map((l) => `Skipped: ${l.name} (locked)`)]
      }
    };
  },

  async execute({ ctx, prepared, host }) {
    if (prepared.isFfx) {
      const r = await host.call('text.applyFfx', { compId: ctx.comp.id, layers: prepared.layers.map((l) => l.layerId), path: prepared.preset.path });
      return { ffx: r, layers: [] };
    }
    const name = NAMES[prepared.preset.kind] || NAMES.in;
    const r = await host.call('text.applyAnimator', { compId: ctx.comp.id, label: `MOE: ${prepared.preset.name}`, name, spec: prepared.spec, layers: prepared.layers.map((l) => ({ layerId: l.layerId, startTime: l.startTime })) });
    return Object.assign(r, { animatorName: name });
  },

  verify({ prepared, result }) {
    if (result.ffx) return { ok: result.ffx.applied.length > 0, checks: [{ ok: result.ffx.applied.length > 0, label: 'Preset', detail: `applied to ${result.ffx.applied.join(', ')} by After Effects (not read back)` }] };
    const checks = result.layers.map((L) => {
      if (L.skipped) return { ok: false, label: L.name, detail: L.skipped };
      const want = prepared.layers.find((x) => x.layerId === L.layerId);
      // v0.64: keys sit on the comp's frame grid — within half a frame of the plan
      const half = (prepared.fd || 1 / 24) / 2 + 1e-6;
      const okTime = Math.abs(L.firstKey - want.startTime) <= half && Math.abs(L.lastKey - (want.startTime + prepared.duration)) <= half;
      const wig = L.wiggly && L.wiggly.missing.length ? `Wiggly Selector: not found by name — ${L.wiggly.missing.join(', ')}` : '';
      // v1.0.2: this check knows three different numbers and used to report all three as the bare words "animator
      // read-back mismatch" — which is what the Self-Test showed for the Explode preset in After Effects 26.5.3x9,
      // with nothing to act on. Say WHICH one is off, and by how much (CLAUDE.md: a failure always says why).
      const want2 = want.startTime + prepared.duration;
      const off = [];
      if (!okTime) off.push(`keys at ${L.firstKey.toFixed(2)}–${L.lastKey.toFixed(2)} s, wanted ${want.startTime.toFixed(2)}–${want2.toFixed(2)} s`);
      if (L.keys !== 2) off.push(`${L.keys} key(s) on the selector, wanted 2`);
      if (L.props !== prepared.spec.props.length) off.push(`${L.props} animator propert${L.props === 1 ? 'y' : 'ies'} set, wanted ${prepared.spec.props.length} (${prepared.spec.props.map((p) => (p && p.matchName) || p).join(', ')})${L.hiddenSkipped && L.hiddenSkipped.length ? ` — After Effects hid ${L.hiddenSkipped.join(', ')}` : ''}`);
      const ok = !off.length && !wig;
      return { ok, label: L.name, detail: ok ? `${L.animator}: ${L.props} propert${L.props === 1 ? 'y' : 'ies'}${L.wiggly ? ` + Wiggly Selector (${L.wiggly.set.length} settings by name)` : ''}, keys ${L.firstKey.toFixed(2)}–${L.lastKey.toFixed(2)}s${L.replaced ? ' · replaced previous' : ''}` : (wig || `animator read-back mismatch — ${off.join(' · ')}`) };
    });
    return { ok: checks.length > 0 && checks.every((c) => c.ok), checks };
  },

  checkpoint({ result, ctx }) {
    if (result.ffx) return null;
    return { compId: ctx.comp.id, items: result.layers.filter((L) => !L.skipped).map((L) => ({ layerId: L.layerId, name: L.animator })) };
  },
  async restore({ data, host }) { return host.call('text.removeAnimator', data); },
  summarize(result, v) { return result.ffx ? 'Preset applied' : (v.ok ? `Animated ${result.layers.length} text layer(s)` : 'Text animation finished with problems'); }
};

const removeAnimation = {
  id: 'text.removeAnimation',
  version: '1.0.0',
  category: 'text',
  group: 'Animate',
  name: 'Remove Text Animation',
  description: 'Remove MOE In / Out animators from the selected text layers.',
  keywords: ['remove', 'clear', 'text animation'],
  icon: 'trash',
  params: { which: { type: 'enum', label: 'Remove', default: 'both', options: [{ value: 'both', label: 'In + Out' }, { value: 'in', label: 'In' }, { value: 'out', label: 'Out' }] } },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers'],
  destructive: true,
  recovery: 'undo',
  ai: { callable: true, hint: 'Only when asked to remove text animations.' },
  uses: { hostOps: ['text.removeAnimator'], network: false },
  compatibility: { minAE: '25.0' },
  prepare(args, ctx) {
    const t = textLayers(ctx);
    if (!t.usable.length) return { ok: false, error: 'Select text layers' };
    const names = args.which === 'both' ? [NAMES.in, NAMES.out] : [NAMES[args.which]];
    return { ok: true, items: t.usable.flatMap((l) => names.map((n) => ({ layerId: l.id, name: n }))), preview: { summary: `Remove ${names.join(' + ')} from ${t.usable.length} layer(s)`, items: [] } };
  },
  async execute({ ctx, prepared, host }) { return host.call('text.removeAnimator', { compId: ctx.comp.id, items: prepared.items }); },
  verify({ result }) { return { ok: true, checks: [{ ok: true, label: 'Removed', detail: `${result.removed} animator(s) — Edit › Undo restores them` }] }; },
  summarize(result) { return `Removed ${result.removed} animator(s)`; }
};

module.exports = { animate, removeAnimation, NAMES };
