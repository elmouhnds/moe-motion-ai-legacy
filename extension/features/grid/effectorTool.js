'use strict';
/**
 * grid.effector (v0.33, docs/features/CLONER_EFFECTORS.md) — add a MOE Effector to a MOE Grid / Cloner.
 *
 * Creates "MOE Effector N" (a null holding the effector's own controls — features/grid/effectors.js), links it
 * to the grid's first free slot (Effector · Effector 2 · Effector 3) and makes sure every item's expression is
 * the v0.33 one that reads effectors (older v0.19+ grids are rewritten in place from the facts baked into each
 * item's expression — same item, same home, same path). Optional sweep: the effector travels across the grid
 * in 2 s so the result shows at once. Restore removes the effector, unlinks the slot and puts the items'
 * expressions back.
 */
const X = require('./expressions');
const EF = require('./effectors');
const { gridFor } = require('./tools');

const TYPE_OPTIONS = EF.TYPES.map((t) => ({ value: t.id, label: t.label }));
const FALLOFF_OPTIONS = EF.FALLOFFS.map((f) => ({ value: f.id, label: f.label }));
const NAME = (n) => `MOE Effector ${n}`;
const POS = ['ADBE Transform Group', 'ADBE Position'];

function nextName(ctx) {
  const used = new Set((ctx.compLayers || []).map((l) => l.name));
  let n = 1;
  while (used.has(NAME(n))) n++;
  return NAME(n);
}

/** effects.ensure items for the effector null's controls. */
function controlItems(values, names) {
  const only = names ? new Set(names) : null;
  return EF.CONTROLS.filter(([name]) => !only || only.has(name)).map(([name, kind, def]) => {
    const K = X.KIND[kind];
    let value = values[EF.KEY[name]] !== undefined ? values[EF.KEY[name]] : def;
    if (kind === 'checkbox') value = value ? 1 : 0;
    // a colour stays [r, g, b, a]; everything else is one number
    return { key: name, matchName: K.matchName, before: [], params: [{ id: name, value: kind === 'color' ? EF.rgba(value) : Number(value), names: [K.param], suffix: 1, nth: { type: K.type, n: 1 } }] };
  });
}
const slotItem = (slot, value) => ({ key: slot, matchName: X.KIND.layer.matchName, before: [], params: [{ id: slot, value, names: [X.KIND.layer.param], suffix: 1, nth: { type: X.KIND.layer.type, n: 1 } }] });
const ctlAddr = (layerId, name, kind) => ({ layerId, matchNames: ['ADBE Effect Parade', `name:${name}`, `name:${X.KIND[kind].param}`] });

const effector = {
  id: 'grid.effector',
  version: '1.0.0',
  category: 'layout',
  group: 'Grid',
  name: 'Effector',
  description: 'Add a MOE Effector to a grid or cloner: a null that moves, scales, turns or fades the items near it — Plain, Random, Step, Noise, Delay or Wave (sine, triangle, ramp, square — it travels through the items), with a Sphere, Linear, Box or Everywhere falloff. Spring makes the items follow it with overshoot (or a smooth Inertia lag). Target turns the items to face the null; Audio drives the moves from a soundtrack. Move, rotate or scale the null to animate it; up to three per grid.',
  keywords: ['effector', 'mograph', 'cloner', 'falloff', 'field', 'random', 'step', 'noise', 'delay', 'wave', 'reveal', 'proximity', 'mcloner', 'c4d', 'spring', 'inertia', 'bounce', 'jelly', 'overshoot', 'lag', 'target', 'look at', 'aim', 'face', 'audio', 'music', 'beat', 'sound', 'equalizer', 'sine', 'ripple', 'snap', 'clamp', 'limit', 'attract', 'repel', 'magnet', 'push', 'pull', 'absolute', 'gather', 'ease', 'field', 'noise field', 'image', 'luma', 'map', 'logo'],
  icon: 'target',
  params: {
    type: { type: 'enum', label: 'Type', default: 'plain', options: TYPE_OPTIONS, description: EF.TYPES.map((t) => `${t.label}: ${t.hint}`).join(' · ') },
    falloff: { type: 'enum', label: 'Falloff', default: 'sphere', options: FALLOFF_OPTIONS, description: 'Where it acts: around the null (Sphere / Box), on one side of its edge (Linear — move it to sweep), on every item, in the patches of a moving Noise Field, or as bright as a layer under each item (Image)' },
    size: { type: 'number', label: 'Size', min: 0, max: 10000, step: 1, default: 0, unit: 'px', description: '0 = about a third of the grid · Noise Field: the size of a patch', showIf: (a) => a.falloff !== 'all' && a.falloff !== 'image' },
    softness: { type: 'number', label: 'Softness', min: 0, max: 100, step: 1, default: 50, unit: '%', description: 'Noise Field: 0 = hard patches, 100 = smooth', showIf: (a) => a.falloff === 'sphere' || a.falloff === 'box' || a.falloff === 'noise' },
    // v0.38 Field falloffs
    fieldSpeed: { type: 'number', label: 'Field speed', min: -1000, max: 1000, step: 1, default: 50, description: 'How fast the noise field drifts (0 = still; move the null to slide it)', showIf: (a) => a.falloff === 'noise' },
    fieldLayer: { type: 'layer', label: 'Field layer', description: 'The layer whose brightness under each item is the weight — a logo, a gradient, a video (select it with the grid and it is picked)', showIf: (a) => a.falloff === 'image' },
    strength: { type: 'number', label: 'Strength', min: -200, max: 200, step: 1, default: 100, unit: '%' },
    invert: { type: 'boolean', label: 'Invert', default: false, advanced: true, description: 'Act outside the falloff instead of inside' },
    moveX: { type: 'number', label: 'Move X', min: -5000, max: 5000, step: 1, default: 0, unit: 'px' },
    moveY: { type: 'number', label: 'Move Y', min: -5000, max: 5000, step: 1, default: 0, unit: 'px' },
    scale: { type: 'number', label: 'Scale', min: -100, max: 1000, step: 1, default: 60, unit: '%', description: '+60 = 60 % bigger · −100 = gone' },
    rotate: { type: 'number', label: 'Rotate', min: -3600, max: 3600, step: 1, default: 0, unit: '°' },
    fade: { type: 'number', label: 'Fade', min: -100, max: 100, step: 1, default: 0, unit: '%', description: '100 = invisible where it acts' },
    seed: { type: 'integer', label: 'Seed', min: 1, max: 9999, default: 1, showIf: (a) => a.type === 'random' || a.type === 'noise' },
    delay: { type: 'number', label: 'Delay', min: 0, max: 60, step: 0.5, default: 3, unit: 'frames', description: 'Per item, in the grid order. The moves are keyframed to rest in 0.6 s from the playhead (re-key them freely) and every item plays them this much later', showIf: (a) => a.type === 'delay' },
    noiseScale: { type: 'number', label: 'Noise size', min: 1, max: 2000, step: 1, default: 100, description: 'Bigger = finer waves', showIf: (a) => a.type === 'noise' },
    noiseSpeed: { type: 'number', label: 'Noise speed', min: -1000, max: 1000, step: 1, default: 50, showIf: (a) => a.type === 'noise' },
    colour: { type: 'string', label: 'Colour', default: '#FF6A4D', maxLength: 7, format: 'color', description: 'The colour the items in reach blend toward (needs Clone Colours on the grid)', showIf: (a) => a.colourMix > 0 },
    colourMix: { type: 'number', label: 'Colour mix', min: 0, max: 100, step: 1, default: 0, unit: '%', description: '0 = no colour change · 100 = the items in reach take the colour fully (v0.34, with Clone Colours)' },
    spring: { type: 'number', label: 'Spring', min: 0, max: 200, step: 1, default: 0, unit: '%', description: '0 = the items follow the effector at once · 100 = they follow through a damped spring (overshoot and settle) — v0.35' },
    frequency: { type: 'number', label: 'Frequency', min: 0, max: 10, step: 0.1, default: 2.5, unit: 'Hz', description: 'Bounces per second · 0 = Inertia (a smooth lag, no overshoot)', showIf: (a) => a.spring > 0 },
    decay: { type: 'number', label: 'Decay', min: 2, max: 30, step: 0.5, default: 5, description: 'How fast it settles — higher = shorter', showIf: (a) => a.spring > 0 },
    // v0.89: the falloff's edge and what the moves mean
    falloffCurve: { type: 'enum', label: 'Falloff curve', default: 'smooth', options: EF.CURVES.map((c) => ({ value: c.id, label: c.label })), advanced: true, description: 'How the soft edge fades: Smooth (as before) · Linear · Ease in (thin edge, sudden core) · Ease out (wide, gentle edge)', showIf: (a) => a.falloff === 'sphere' || a.falloff === 'box' || a.falloff === 'linear' },
    moveMode: { type: 'enum', label: 'Move mode', default: 'relative', options: EF.MOVE_MODES.map((m) => ({ value: m.id, label: m.label })), description: EF.MOVE_MODES.map((m) => `${m.label}: ${m.hint}`).join(' · '), showIf: (a) => a.type !== 'target' },
    // v0.88 Wave
    waveShape: { type: 'enum', label: 'Wave shape', default: 'sine', options: EF.WAVES.map((w) => ({ value: w.id, label: w.label })), showIf: (a) => a.type === 'wave' },
    waveLength: { type: 'number', label: 'Wave length', min: 0.1, max: 1000, step: 0.1, default: 6, unit: 'items', description: 'How many items one wave spans, in the grid order', showIf: (a) => a.type === 'wave' },
    waveSpeed: { type: 'number', label: 'Wave speed', min: -20, max: 20, step: 0.05, default: 0.5, unit: 'waves/s', description: '0 = a still wave · negative = it runs the other way', showIf: (a) => a.type === 'wave' },
    waveOffset: { type: 'number', label: 'Wave offset', min: -1000, max: 1000, step: 1, default: 0, unit: '%', description: 'Shift the wave by a part of its length — keyframe it to drive the wave by hand', showIf: (a) => a.type === 'wave' },
    // v0.88 Snap To / Clamp (0 = off)
    snapMove: { type: 'number', label: 'Snap move', min: 0, max: 2000, step: 1, default: 0, unit: 'px', advanced: true, description: 'Round each item\'s move to the nearest step (0 = off)' },
    snapRotate: { type: 'number', label: 'Snap rotate', min: 0, max: 360, step: 1, default: 0, unit: '°', advanced: true, description: '45 = the items only ever sit at 0°, 45°, 90°… (0 = off)' },
    snapScale: { type: 'number', label: 'Snap scale', min: 0, max: 500, step: 1, default: 0, unit: '%', advanced: true, description: 'Round the scale change to the nearest step (0 = off)' },
    maxMove: { type: 'number', label: 'Max move', min: 0, max: 10000, step: 1, default: 0, unit: 'px', advanced: true, description: 'Clamp: an item never moves further than this, spring overshoot included (0 = off)' },
    maxRotate: { type: 'number', label: 'Max rotate', min: 0, max: 3600, step: 1, default: 0, unit: '°', advanced: true, description: 'Clamp: never turns more than this either way (0 = off)' },
    maxScale: { type: 'number', label: 'Max scale', min: 0, max: 1000, step: 1, default: 0, unit: '%', advanced: true, description: 'Clamp: never scales by more than this either way (0 = off)' },
    sweep: { type: 'boolean', label: 'Sweep across', default: false, description: 'Keyframe the effector travelling across the grid in 2 s (Sphere / Box / Linear / Noise Field — or a Target the items follow)', showIf: (a) => (a.falloff !== 'all' && a.falloff !== 'image') || a.type === 'target' },
    audioLayerId: { type: 'integer', label: 'Sound layer', min: 0, max: 1e9, default: 0, hidden: true, description: '0 = the first layer with audio in the comp (not in the grid)' },
    controls: { type: 'enum', label: 'Controls on the null', default: 'needed', advanced: true, options: [{ value: 'needed', label: 'Only what it uses' }, { value: 'all', label: 'All' }], description: 'Effect Controls shows only the sliders this effector uses (v0.87). Effector Controls adds a group later — Moves, Random, Colour, Spring, Audio, Field' },
    gridId: { type: 'integer', label: 'Grid', min: 0, max: 1e9, default: 0, hidden: true }
  },
  requires: { comp: true },
  permissions: ['modify.layers', 'modify.effects', 'modify.expressions'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Add a MoGraph-style effector to an existing MOE Grid / cloner (select the grid null or its items). type plain|random|step|noise|delay|target|audio|wave (wave: waveShape sine|triangle|rampUp|rampDown|square, waveLength items, waveSpeed waves/s; snapMove/snapRotate/snapScale round the result, maxMove/maxRotate/maxScale clamp it; moveMode relative|attract|absolute — attract: moveX px toward the null (negative = away), absolute: items go to the null; falloffCurve smooth|linear|easeIn|easeOut; target: items face the null, rotate = aim offset; audio: needs a layer with sound in the comp), falloff sphere|linear|box|all, moveX/moveY px, scale %, rotate deg, fade %. sweep animates it across. spring 0-200 % (100 = full spring), frequency Hz (0 = inertia lag), decay 2-30.' },
  uses: { hostOps: ['layers.describe', 'audio.amplitude', 'layers.createNull', 'effects.ensure', 'effects.setMenu', 'props.values', 'proximity.scan', 'expressions.peek', 'expressions.set', 'keys.write', 'layers.remove'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Add Effector' },

  prepare(args, ctx) {
    const grid = gridFor(ctx, args);
    // v0.38 Image field: no Field layer chosen — the one other selected layer (not the grid, its items or a MOE layer) is it
    if (grid && args.falloff === 'image' && !args.fieldLayer) {
      const others = (ctx.layers || []).filter((l) => l.index !== grid.index && l.parentIndex !== grid.index && !/^MOE /.test(l.name));
      if (others.length === 1) args = Object.assign({}, args, { fieldLayer: others[0].index });
    }
    if (grid && args.falloff === 'image' && !args.fieldLayer) return { ok: false, error: 'Choose the Field layer — or select it together with the grid (a logo, a gradient or a video: its brightness drives the effector)' };
    if (!grid) return { ok: false, error: 'Select a MOE Grid (its null or one of its items) — or build one with Clone / Arrange first' };
    const name = nextName(ctx);
    const t = EF.TYPES.find((x) => x.id === args.type), f = EF.FALLOFFS.find((x) => x.id === args.falloff);
    const moves = [args.moveX && `move ${args.moveX}, ${args.moveY || 0} px`, !args.moveX && args.moveY && `move Y ${args.moveY} px`, args.scale && `scale ${args.scale > 0 ? '+' : ''}${args.scale} %`, args.rotate && `rotate ${args.rotate}°`, args.fade && `fade ${args.fade} %`, args.colourMix > 0 && `colour ${args.colour} at ${args.colourMix} %`].filter(Boolean);
    if (args.moveMode === 'attract' && !args.moveX) return { ok: false, error: 'Attract / Repel uses Move X as the pull in px — set it (negative pushes away)' };
    if (args.type !== 'target' && args.moveMode === 'attract') { moves.splice(0, moves[0] && /^move /.test(moves[0]) ? 1 : 0); moves.unshift(`${args.moveX > 0 ? 'pull' : 'push'} ${Math.abs(args.moveX)} px ${args.moveX > 0 ? 'toward' : 'away from'} ${name}`); }
    if (args.type !== 'target' && args.moveMode === 'absolute') { moves.splice(0, moves[0] && /^move /.test(moves[0]) ? 1 : 0); moves.unshift(`the items go to ${name}${args.moveX || args.moveY ? ` + ${args.moveX || 0}, ${args.moveY || 0} px` : ''}`); }
    if (!moves.length && args.type !== 'target') return { ok: false, error: 'Give the effector something to do: Move, Scale, Rotate, Fade or Colour' };
    if (args.type === 'target') moves.unshift(`the items turn to face ${name}${args.rotate ? ` (aim offset ${args.rotate}°)` : ''}`);
    return {
      ok: true, grid, name, fieldLayer: args.fieldLayer || 0,
      preview: {
        summary: `${name}: ${t.label} · ${f.label} on ${grid.name}`,
        items: [moves.join(' · '), ...(args.falloff === 'image' ? [`Weight = the brightness of ${((ctx.compLayers || []).find((l) => l.index === args.fieldLayer) || {}).name || 'the Field layer'} under each item`] : args.falloff === 'noise' ? ['Weight = a noise field drifting through the grid (Size = patch size)'] : []), args.type === 'wave' ? `A ${(EF.WAVES.find((w) => w.id === args.waveShape) || EF.WAVES[0]).label.toLowerCase()} wave ${args.waveLength} items long${args.waveSpeed ? `, ${Math.abs(args.waveSpeed)} per second` : ', still'}` : args.type === 'audio' ? 'Reads the loudness of the first layer with sound (After Effects’ Convert Audio to Keyframes → a MOE Audio layer at the bottom)' : args.type === 'delay' ? `${args.delay} frames later per item — keyframe the effector's moves` : t.hint, args.spring > 0 ? (args.frequency > 0.01 ? `Spring ${args.spring} %: ${args.frequency} Hz, decay ${args.decay} — the items overshoot and settle` : `Inertia ${args.spring} %: decay ${args.decay} — the items lag and ease in`) : null, args.sweep ? 'Sweeps across the grid in 2 s (keyframed)' : 'Move, rotate or scale the null to animate it', args.controls === 'all' ? `All ${EF.CONTROLS.length} controls on the null (Effect Controls)` : `${EF.needed(EF.valuesOf(Object.assign({}, args, { size: args.size || 1 }))).length} controls on the null — only what this effector uses`].filter(Boolean)
      }
    };
  },

  async execute({ args, ctx, prepared, host }) {
    const comp = ctx.comp, grid = prepared.grid;
    // 1. the grid's items and their MOE Grid expressions
    const desc = await host.call('layers.describe', { compId: comp.id });
    const kids = desc.layers.filter((l) => l.parentId === grid.id);
    if (kids.length < 1) { const e = new Error(`${grid.name} has no items`); e.code = 'NO_ITEMS'; throw e; }
    const scan = await host.call('proximity.scan', { compId: comp.id, layerIds: kids.map((l) => l.id), tag: X.TAG });
    const peek = scan.expressions.length ? await host.call('expressions.peek', { compId: comp.id, items: scan.expressions.map((a) => ({ address: a })) }) : { items: [] };
    const codes = scan.expressions.map((a, i) => ({ address: a, code: peek.items[i].expression || '' }));
    if (!codes.some((c) => X.isV2(c.code))) { const e = new Error(`${grid.name} was built before v0.19 — rebuild it (Release › Remove, then Grid Builder) to use effectors`); e.code = 'OLD_GRID'; throw e; }
    // 2. where to put the effector: the grid's centre (sweep: start left of it) and a size that fits the grid
    const pos = await host.call('props.values', { compId: comp.id, time: comp.time, items: kids.map((l) => ({ address: { layerId: l.id, matchNames: POS } })).concat([{ address: { layerId: grid.id, matchNames: POS } }]) });
    const gv = pos.items[pos.items.length - 1].value || [comp.width / 2, comp.height / 2];
    const local = pos.items.slice(0, -1).map((r) => r.value || [0, 0]);
    const ext = Math.max(50, ...local.map((p) => Math.hypot(p[0], p[1])));
    const size = args.size || Math.round(Math.max(80, ext * 0.6));
    // v0.36 Audio: the loudness of a layer with sound, through After Effects' own Convert Audio to Keyframes
    let audio = null;
    if (args.type === 'audio') {
      const inGrid = new Set(kids.map((l) => l.id).concat([grid.id]));
      const src = args.audioLayerId ? desc.layers.find((l) => l.id === args.audioLayerId) : desc.layers.find((l) => l.hasAudio && !inGrid.has(l.id) && !/^MOE Audio · /.test(l.name));
      if (!src || !src.hasAudio) { const e = new Error('Add a layer with sound (music or a voice-over) to the comp — the Audio effector follows its loudness'); e.code = 'NO_AUDIO'; throw e; }
      audio = await host.call('audio.amplitude', { compId: comp.id, layerId: src.id, name: `MOE Audio · ${src.name}`.slice(0, 120) });
      audio.source = src.name;
    }
    const values = EF.valuesOf(Object.assign({}, args, { size, invert: !!args.invert }, audio ? { audioMax: Math.max(audio.max, 0.001) } : {}));
    const start = args.sweep ? [Math.round(gv[0] - ext - size / 2), Math.round(gv[1])] : [Math.round(gv[0]), Math.round(gv[1])];
    const created = await host.call('layers.createNull', { compId: comp.id, name: prepared.name, position: start, anchor: [0, 0], label: 2, threeD: false, undoLabel: 'MOE: Effector' });
    // layer controls take indices — read them after the null was added
    const fieldId = prepared.fieldLayer ? ((ctx.compLayers || []).find((l) => l.index === prepared.fieldLayer) || {}).id : null;
    if (audio || fieldId) {
      const d0 = await host.call('layers.describe', { compId: comp.id });
      if (audio) values.audioLayer = (d0.layers.find((l) => l.id === audio.layerId) || {}).index || 0;
      if (fieldId) values.fieldLayer = (d0.layers.find((l) => l.id === fieldId) || {}).index || 0;
    }
    const names = args.controls === 'all' ? EF.groupNames('all') : EF.needed(values);
    const controls = await host.call('effects.ensure', { compId: comp.id, label: 'MOE: Effector Controls', layers: [{ layer: { layerId: created.layerId }, items: controlItems(values, names) }] });
    await host.call('effects.setMenu', { compId: comp.id, layerId: created.layerId, effectKey: 'Effector Type', items: EF.TYPES.map((t) => t.menu), value: values.type });
    await host.call('effects.setMenu', { compId: comp.id, layerId: created.layerId, effectKey: 'Falloff', items: EF.FALLOFFS.map((f) => f.menu), value: values.falloff });
    if (names.includes('Falloff Curve')) await host.call('effects.setMenu', { compId: comp.id, layerId: created.layerId, effectKey: 'Falloff Curve', items: EF.CURVES.map((c) => c.menu), value: values.falloffCurve });
    if (names.includes('Move Mode')) await host.call('effects.setMenu', { compId: comp.id, layerId: created.layerId, effectKey: 'Move Mode', items: EF.MOVE_MODES.map((m) => m.menu), value: values.moveMode });
    if (names.includes('Wave Shape')) await host.call('effects.setMenu', { compId: comp.id, layerId: created.layerId, effectKey: 'Wave Shape', items: EF.WAVES.map((w) => w.menu), value: values.waveShape });
    // 3. link it to the first free slot of the grid
    const desc2 = await host.call('layers.describe', { compId: comp.id });
    const effIndex = (desc2.layers.find((l) => l.id === created.layerId) || {}).index;
    const slotsNow = await host.call('props.values', { compId: comp.id, time: comp.time, items: EF.SLOTS.map((s) => ({ address: ctlAddr(grid.id, s, 'layer') })) });
    const freeAt = slotsNow.items.findIndex((r) => r.error || !r.value);
    if (freeAt < 0) {
      await host.call('layers.remove', { compId: comp.id, layerIds: [created.layerId], onlyNamed: 'MOE Effector' });
      if (audio && audio.created) await host.call('layers.remove', { compId: comp.id, layerIds: [audio.layerId], onlyNamed: 'MOE Audio' });
      const e = new Error(`${grid.name} already has three effectors — remove one (select it and delete) or change its controls`); e.code = 'SLOTS_FULL'; throw e;
    }
    const slot = EF.SLOTS[freeAt];
    const linked = await host.call('effects.ensure', { compId: comp.id, label: 'MOE: Link Effector', layers: [{ layer: { layerId: grid.id }, items: [slotItem(slot, effIndex)] }] });
    // 4. items read effectors: rewrite older item expressions (v0.19–v0.86) as the current one — same item, home and path.
    // v0.87: only a v4+ expression reads a control that is not on the null as its default; v0.88: only v5 knows Wave, Snap To and Clamp
    const targets = [];
    for (const c of codes) {
      if (!X.isV2(c.code) || X.isCurrent(c.code)) continue;
      const f = X.factsOf(c.code);
      if (!f) continue;
      const prop = Object.keys(X.PROP_ADDR).find((p) => X.PROP_ADDR[p][1] === c.address.matchNames[c.address.matchNames.length - 1]);
      if (!prop) continue;
      targets.push({ address: c.address, expression: X.buildAll(f.i, f.n, f)[prop], enabled: true });
    }
    const set = targets.length ? await host.call('expressions.set', { compId: comp.id, label: 'MOE: Grid reads effectors', revertOnError: true, targets }) : { targets: [] };
    // 5. sweep: travel across the grid in 2 s
    let keys = null;
    if (args.sweep) {
      const t0 = comp.time, t1 = comp.time + 2, end = [Math.round(gv[0] + ext + size / 2), Math.round(gv[1])];
      keys = await host.call('keys.write', { compId: comp.id, label: 'MOE: Effector Sweep', items: [{ address: { layerId: created.layerId, matchNames: POS }, keys: [{ t: t0, v: start, easeOut: { speed: 0, influence: 40 } }, { t: t1, v: end, easeIn: { speed: 0, influence: 40 } }] }] });
    }
    // 5b. Delay: the moves play once from the playhead (set value → rest in 0.6 s) — each item that much later
    let delayKeys = null;
    if (args.type === 'delay') {
      const moved = [['Move X', 'moveX', 'slider'], ['Move Y', 'moveY', 'slider'], ['Scale', 'scale', 'slider'], ['Rotate', 'rotate', 'angle'], ['Fade', 'fade', 'slider']].filter(([, k]) => values[k]);
      if (moved.length) delayKeys = await host.call('keys.write', { compId: comp.id, label: 'MOE: Effector Delay', items: moved.map(([nm, k, kind]) => ({ address: ctlAddr(created.layerId, nm, kind), keys: [{ t: comp.time, v: values[k], easeOut: { speed: 0, influence: 30 } }, { t: comp.time + 0.6, v: 0, easeIn: { speed: 0, influence: 80 } }] })) });
    }
    // 6. read back: every item still evaluates (no expression error), at the sweep's middle when there is one
    const at = args.sweep ? comp.time + 1 : comp.time;
    const read = await host.call('props.values', { compId: comp.id, time: at, items: kids.map((l) => ({ address: { layerId: l.id, matchNames: POS } })) });
    const slotRead = await host.call('props.values', { compId: comp.id, time: comp.time, items: [{ address: ctlAddr(grid.id, slot, 'layer') }].concat(audio ? [{ address: ctlAddr(created.layerId, 'Audio Layer', 'layer') }] : []).concat(fieldId ? [{ address: ctlAddr(created.layerId, 'Field Layer', 'layer') }] : []) });
    return { audio, audioIndex: values.audioLayer || 0, field: fieldId ? { index: values.fieldLayer, name: ((ctx.compLayers || []).find((l) => l.id === fieldId) || {}).name } : null, name: prepared.name, effectorId: created.layerId, effIndex, grid: { id: grid.id, name: grid.name }, slot, slotBefore: slotsNow.items[freeAt].error ? null : (slotsNow.items[freeAt].value || 0), controls, linked, set, keys, delayKeys, read, slotRead, items: kids.length, controlNames: names };
  },

  verify({ result }) {
    const checks = [];
    checks.push({ ok: result.controls.layers[0].items.length === result.controlNames.length, label: result.name, detail: `${result.controlNames.length} live controls on the null: ${result.controlNames.join(', ')}` });
    checks.push({ ok: result.slotRead.items[0].value === result.effIndex, label: 'Linked', detail: `${result.grid.name} › ${result.slot} → ${result.name}` });
    const bad = result.set.targets.filter((t) => t.skipped || t.reverted || (t.after && t.after.expressionError));
    checks.push({ ok: bad.length === 0, label: 'Items read effectors', detail: bad.length ? `${bad.length} failed: ${bad[0].after ? bad[0].after.expressionError : bad[0].skipped}` : (result.set.targets.length ? `${result.set.targets.length} expressions updated in place` : 'already up to date') });
    const errs = result.read.items.filter((r) => r.error || !r.value);
    checks.push({ ok: errs.length === 0, label: 'Read-back', detail: errs.length ? (errs[0].error || 'no value') : `${result.read.items.length} items evaluate with the effector` });
    if (result.audio) {
      const linkedAudio = result.slotRead.items[1] && result.slotRead.items[1].value === result.audioIndex && result.audioIndex > 0;
      checks.push({ ok: linkedAudio && result.audio.max > 0, label: 'Audio', detail: !linkedAudio ? 'the amplitude layer is not linked' : result.audio.max > 0 ? `${result.audio.created ? 'Converted' : 'Reused'} ${result.audio.source} (loudest ${Math.round(result.audio.max * 100) / 100}, ${result.audio.keys} keys)` : `${result.audio.source} is silent — nothing to follow` });
    }
    if (result.field) {
      const fr = result.slotRead.items[result.slotRead.items.length - 1];
      checks.push({ ok: !!fr && fr.value === result.field.index && result.field.index > 0, label: 'Field', detail: `${result.name} reads the brightness of ${result.field.name}` });
    }
    if (result.keys) checks.push({ ok: result.keys.items[0].written.length === 2, label: 'Sweep', detail: 'travels across the grid in 2 s' });
    if (result.delayKeys) checks.push({ ok: result.delayKeys.items.every((it) => it.written.length === 2), label: 'Delay', detail: `${result.delayKeys.items.length} move(s) keyframed to rest in 0.6 s — each item plays it later` });
    return { ok: checks.every((c) => c.ok), checks };
  },

  checkpoint({ result, ctx }) {
    return {
      compId: ctx.comp.id, effectorId: result.effectorId, audioId: result.audio && result.audio.created ? result.audio.layerId : null, gridId: result.grid.id, slot: result.slot, slotBefore: result.slotBefore || 0,
      expressions: result.set.targets.filter((t) => !t.skipped && !t.reverted).map((t) => ({ address: t.address, expression: t.before.expression, enabled: t.before.expressionEnabled }))
    };
  },

  async restore({ data, host }) {
    if (data.expressions.length) await host.call('expressions.set', { compId: data.compId, label: 'MOE: Restore Grid', revertOnError: false, targets: data.expressions });
    await host.call('effects.ensure', { compId: data.compId, label: 'MOE: Unlink Effector', layers: [{ layer: { layerId: data.gridId }, items: [slotItem(data.slot, data.slotBefore)] }] });
    await host.call('layers.remove', { compId: data.compId, layerIds: [data.effectorId], onlyNamed: 'MOE Effector' });
    if (data.audioId) await host.call('layers.remove', { compId: data.compId, layerIds: [data.audioId], onlyNamed: 'MOE Audio' });
    return { ok: true };
  },

  summarize(result, v) { return v.ok ? `${result.name} on ${result.grid.name} (${result.items} items)` : 'Effector added with problems'; }
};

module.exports = { effector, controlItems, nextName };
