'use strict';
/**
 * Quick Apply tools (v1.0, docs/features/QUICK_APPLY.md): what the pie's centre runs when the user picks an After
 * Effects item. Registered tools like every other capability (validate → context → prepare → host → verify).
 *   quick.applyEffect  an effect from app.effects on the selected layers, or (target 'adjustment') on a new adjustment
 *                      layer above them — the same two choices as Effect › and Layer › New › Adjustment Layer
 *   quick.applyPreset  an .ffx animation preset on the selected layers (After Effects applies presets to the selection)
 *   quick.runCommand   an After Effects menu command, found again by its name
 */
const visual = (ctx) => (ctx.layers || []).filter((l) => !/^(camera|light)$/.test(l.type));

const applyEffect = {
  id: 'quick.applyEffect', version: '1.0.0', category: 'compositing', group: 'Quick Apply', name: 'Apply Effect',
  description: 'Add an After Effects effect to the selected layers, or on a new adjustment layer above them.',
  keywords: ['effect', 'fx', 'apply', 'adjustment', 'console', 'search'], icon: 'wand',
  params: {
    matchName: { type: 'string', label: 'Effect', default: '', maxLength: 120, required: true },
    effectName: { type: 'string', label: 'Name', default: '', maxLength: 120 },
    target: { type: 'enum', label: 'On', default: 'layers', options: [{ value: 'layers', label: 'Selected layers' }, { value: 'adjustment', label: 'New adjustment layer' }] }
  },
  requires: { comp: true }, permissions: ['modify.effects', 'modify.layers'], recovery: 'undo', ai: null,
  uses: { hostOps: ['quick.applyEffect'], network: false }, compatibility: { minAE: '25.0' }, ui: { primaryLabel: 'Apply' },
  prepare(args, ctx) {
    if (!args.matchName) return { ok: false, error: 'Pick an effect' };
    const l = visual(ctx);
    if (args.target === 'layers' && !l.length) return { ok: false, error: 'Select a layer — or Ctrl+Enter for a new adjustment layer' };
    return { ok: true, layers: l, preview: { summary: args.target === 'adjustment' ? `${args.effectName || args.matchName} on a new adjustment layer` : `${args.effectName || args.matchName} on ${l.length} layer(s)`, items: [] } };
  },
  async execute({ args, ctx, prepared, host }) { return host.call('quick.applyEffect', { compId: ctx.comp.id, layerIds: prepared.layers.map((x) => x.id), matchName: args.matchName, target: args.target }); },
  verify({ result }) {
    const c = result.added.map((a) => ({ ok: a.count >= 1, label: a.name, detail: `${a.effect} added (${a.count} effect${a.count === 1 ? '' : 's'} on the layer)` }));
    result.skipped.forEach((s) => c.push({ ok: false, label: 'Skipped', detail: s }));
    return { ok: result.added.length > 0, checks: c };
  },
  summarize(r) { return r.target === 'adjustment' ? `${r.effect} on a new adjustment layer` : `${r.effect} on ${r.added.length} layer(s)${r.skipped.length ? ` · ${r.skipped.length} skipped` : ''}`; }
};

const applyPreset = {
  id: 'quick.applyPreset', version: '1.0.0', category: 'compositing', group: 'Quick Apply', name: 'Apply Animation Preset',
  description: 'Apply an After Effects animation preset (.ffx) to the selected layers.',
  keywords: ['preset', 'ffx', 'animation preset', 'apply', 'console', 'search'], icon: 'bolt',
  params: {
    path: { type: 'string', label: 'Preset', default: '', maxLength: 1000, required: true },
    presetName: { type: 'string', label: 'Name', default: '', maxLength: 200 }
  },
  requires: { comp: true, minLayers: 1 }, permissions: ['modify.effects', 'modify.layers', 'modify.keyframes'], recovery: 'undo', ai: null,
  uses: { hostOps: ['quick.applyPreset'], network: false }, compatibility: { minAE: '25.0' }, ui: { primaryLabel: 'Apply' },
  prepare(args, ctx) {
    if (!args.path) return { ok: false, error: 'Pick a preset' };
    return { ok: true, layers: ctx.layers, preview: { summary: `${args.presetName || 'Preset'} on ${ctx.layers.length} layer(s)`, items: [] } };
  },
  async execute({ args, ctx, prepared, host }) { return host.call('quick.applyPreset', { compId: ctx.comp.id, layerIds: prepared.layers.map((x) => x.id), path: args.path }); },
  verify({ result }) { return { ok: true, checks: [{ ok: true, label: result.preset, detail: `applied to ${result.layers.length} selected layer(s) by After Effects` }] }; },
  summarize(r) { return `${r.preset} on ${r.layers.length} layer(s)`; }
};

const runCommand = {
  id: 'quick.runCommand', version: '1.0.0', category: 'tools', group: 'Quick Apply', name: 'Run Menu Command',
  description: 'Run an After Effects menu command by its name.',
  keywords: ['menu', 'command', 'run', 'console', 'search'], icon: 'menu',
  params: { command: { type: 'string', label: 'Command', default: '', maxLength: 120, required: true } },
  requires: {}, permissions: ['modify.layers'], recovery: 'undo', ai: null,
  uses: { hostOps: ['quick.runCommand'], network: false }, compatibility: { minAE: '25.0' }, ui: { primaryLabel: 'Run' },
  prepare(args) { return args.command ? { ok: true, preview: { summary: `Run ${args.command}`, items: [] } } : { ok: false, error: 'Pick a command' }; },
  async execute({ args, host }) { return host.call('quick.runCommand', { name: args.command }); },
  verify({ result }) { return { ok: !!result.ran, checks: [{ ok: true, label: result.ran, detail: 'run by After Effects' }] }; },
  summarize(r) { return r.ran; }
};

module.exports = { applyEffect, applyPreset, runCommand };
