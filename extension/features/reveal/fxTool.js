'use strict';
/**
 * Matte FX (v0.96, docs/features/MATTE_FX.md): organic reveals made the professional way — an alpha matte from a
 * Fractal Noise gradient map read by Gradient Wipe, with an optional glowing edge. The plan is `fxPlan.build`; this
 * tool only turns it into ONE host call (one Ctrl+Z): three MOE pre-comps per layer (Map, Matte, Edge), the matte
 * layer on the target as its Alpha Track Matte, and — with an edge — a linked copy of the target, filled and glowing,
 * whose Luma Track Matte is the edge band. Everything MOE makes is named "MOE FX N …".
 *
 * Reads first (changes nothing): each layer's own box (sourceRectAtTime), 3D switch and current track matte. A layer
 * that already has a track matte or is 3D is skipped and named. The read-back: the track matte is the MOE matte, the
 * Gradient Wipe's Completion is the plan's at the first and last key, every effect parameter was found by its name.
 */
const F = require('./fxPlan');
const G = require('./grammar');
/** The spec a set of args builds (a curated preset, or the grammar's composition). */
/** Locked axes of the Shuffle (session memory, not a setting). */
const LOCKS = {};
const specOf = (a) => (a.preset === 'compose' ? G.compose(a) : F.PRESETS[a.preset]) || null;
const FG = require('../../core/framegrid');
const { plan: PLAN1 } = require('../../core/host/plan');

const EASES = Object.entries(require('../zoom/math').EASES).map(([value, x]) => ({ value, label: x.label })).concat([{ value: 'linear', label: 'Linear' }]);
const PREFIX = 'MOE FX';
const FXA = (id, fx, param) => ({ layerId: id, matchNames: ['ADBE Effect Parade', `name:${fx}`, `name:${param}`] });
const TR = (id, mn) => ({ layerId: id, matchNames: ['ADBE Transform Group', mn] });
const v = (id, value) => ({ id, value, names: [id] });

const fx = {
  id: 'reveal.fx', version: '1.0.0', category: 'motion', group: 'Quick · Animate', name: 'Matte FX',
  description: 'Organic reveals the professional way: each layer appears (or goes) through an alpha matte made of Fractal Noise over a direction ramp, read by Gradient Wipe — ink, smoke, burn, frost, liquid, grain — with an optional glowing edge (Fill + Glow on a linked copy). Native effects only, one Ctrl+Z, Restore removes everything it made.',
  keywords: ['matte fx', 'fractal noise', 'gradient wipe', 'organic reveal', 'ink', 'smoke', 'burn', 'dissolve', 'glow edge', 'alpha matte', 'transition', 'حبر', 'دخان', 'حرق', 'ريفيل', 'ماسك'],
  icon: 'layers',
  params: {
    preset: { type: 'enum', label: 'Effect', tileFixed: true, default: 'organicSweep', options: [{ value: 'compose', label: 'Compose — Shape × Material × Motion × Palette' }].concat(Object.entries(F.PRESETS).map(([value, p]) => ({ value, label: p.label }))) },
    // v0.97 (REVEAL_COMPOSER.md): the grammar — four choices, 3,888 combinations, one engine
    shape: { type: 'enum', label: 'Shape', default: 'sweep', options: Object.entries(G.SHAPES).map(([value, x]) => ({ value, label: x.label })), showIf: (a) => a.preset === 'compose' },
    material: { type: 'enum', label: 'Material', default: 'soft', options: Object.entries(G.MATERIALS).map(([value, x]) => ({ value, label: x.label })), showIf: (a) => a.preset === 'compose' },
    motion: { type: 'enum', label: 'Motion', default: 'smooth', options: Object.entries(G.MOTIONS).map(([value, x]) => ({ value, label: x.label })), showIf: (a) => a.preset === 'compose' },
    palette: { type: 'enum', label: 'Palette', default: 'material', options: Object.entries(G.PALETTES).map(([value, x]) => ({ value, label: x.label })), showIf: (a) => a.preset === 'compose' },
    intensity: { type: 'number', label: 'Intensity', min: 0, max: 100, step: 1, default: 60, description: 'Noise, warp and glow together (60 = the material as designed)', showIf: (a) => a.preset === 'compose' },
    originX: { type: 'number', label: 'Point X', min: 0, max: 100, step: 1, default: 50, unit: '%', description: 'Where it grows from, across the layer', showIf: (a) => a.preset === 'compose' && a.shape === 'point' },
    originY: { type: 'number', label: 'Point Y', min: 0, max: 100, step: 1, default: 50, unit: '%', showIf: (a) => a.preset === 'compose' && a.shape === 'point' },
    dir: { type: 'enum', label: 'Direction', default: 'in', options: [{ value: 'in', label: 'Reveal (in)' }, { value: 'out', label: 'Hide (out)' }] },
    duration: { type: 'number', label: 'Duration', min: 0.1, max: 10, step: 0.05, default: 1, unit: 's' },
    ease: { type: 'enum', label: 'Ease', default: 'smooth', options: EASES },
    angle: { type: 'number', label: 'Direction angle', min: 0, max: 359, step: 1, unit: '°', description: 'Where the reveal travels (0 = to the right, 90 = down). Empty = the effect\'s own', showIf: (a) => { const P = specOf(a); return !!P && P.ramp === 'linear'; } },
    softness: { type: 'number', label: 'Edge softness', min: 0, max: 100, step: 1, unit: '%', description: 'Empty = the effect\'s own' },
    mix: { type: 'number', label: 'Noise', min: 0, max: 100, step: 1, unit: '%', description: 'How much the Fractal Noise breaks the edge. Empty = the effect\'s own' },
    scale: { type: 'number', label: 'Noise size', min: 2, max: 2000, step: 1, description: 'Fractal Noise Scale. Empty = the effect\'s own', advanced: true },
    edge: { type: 'boolean', label: 'Glowing edge', default: true, showIf: (a) => { const P = specOf(a); return !!P && !!P.edge; } },
    edgeColor: { type: 'string', label: 'Edge colour (#hex)', maxLength: 7, pattern: '^#[0-9A-Fa-f]{6}$', showIf: (a) => { const P = specOf(a); return a.edge !== false && !!P && !!P.edge; } },
    glow: { type: 'number', label: 'Glow radius', min: 1, max: 400, step: 1, unit: 'px', advanced: true, showIf: (a) => { const P = specOf(a); return a.edge !== false && !!P && !!P.edge; } },
    seed: { type: 'number', label: 'Seed', min: 0, max: 9999, step: 1, default: 0, advanced: true },
    stagger: { type: 'number', label: 'Stagger', min: 0, max: 2, step: 0.01, default: 0, unit: 's', advanced: true, description: 'Delay between the selected layers (selection order)' }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers', 'modify.keyframes', 'modify.effects'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: `Organic matte reveal/hide of the selected layers from Fractal Noise + Gradient Wipe. preset: ${Object.keys(F.PRESETS).join('|')}; dir in|out; angle; softness %; mix %; edge on/off.` },
  uses: { hostOps: ['layers.rects', 'comps.create', 'comps.place', 'layers.createSolid', 'effects.ensure', 'keys.write', 'props.setValues', 'layers.setAttrs', 'layers.setParent', 'layers.move', 'layers.duplicateLinked', 'layers.setMatte', 'layers.remove', 'comps.removeMoe', 'props.values', 'tx.run'], network: false },
  compatibility: { minAE: '23.0' },
  ui: {
    primaryLabel: 'Reveal',
    // v0.97 (REVEAL_COMPOSER.md, report §8): Shuffle within the guardrails, Remix one axis, Lock the axes to keep.
    // Pure UI over the tool's own params (grammar.shuffle) — nothing is written until Apply.
    bodyKeepsThumb: true,
    renderBody(args, setArgs, { h }) {
      if (args.preset !== 'compose') return null;
      const locks = LOCKS;
      const axes = [['shape', 'Shape'], ['material', 'Material'], ['motion', 'Motion'], ['palette', 'Palette']];
      const roll = (only) => {
        const keep = only ? Object.fromEntries(axes.map(([k]) => [k, k !== only])) : locks;
        setArgs(Object.assign({}, args, G.shuffle(args, Date.now() % 2147483646 || 1, keep)));
      };
      return h('div', { class: 'compose-row', 'data-key': 'fx-compose' },
        h('div', { class: 'why' }, `${G.COUNT.toLocaleString('en')} combinations — Shuffle keeps the locked axes`),
        h('div', { class: 'actions' },
          h('button', { class: 'btn', title: 'A new combination (locked axes stay)', onclick: () => roll(null) }, 'Shuffle'),
          axes.map(([k, label]) => h('button', {
            class: 'chip-btn', 'aria-pressed': String(!!locks[k]), title: `${locks[k] ? 'Unlock' : 'Lock'} ${label} · Alt-click: remix only ${label}`,
            onclick: (e) => { if (e && e.altKey) roll(k); else { locks[k] = !locks[k]; setArgs(Object.assign({}, args)); } }
          }, label))));
    }
  },
  prepare(args, ctx) {
    const P = specOf(args);
    if (!P) return { ok: false, error: `Unknown effect ${args.preset}` };
    const l = (ctx.layers || []).filter((x) => !['camera', 'light', 'null', 'audio'].includes(x.type));
    if (!l.length) return { ok: false, error: 'Select the layers to reveal (shapes, text, footage, pre-comps)' };
    return { ok: true, layers: l, preview: { summary: `${P.label} · ${args.dir === 'out' ? 'hide' : 'reveal'} · ${args.duration || P.duration}s · ${l.length} layer(s)`, items: l.slice(0, 6).map((x) => x.name) } };
  },
  explain(args, ctx, prepared) {
    if (!prepared) return {};
    const P = specOf(args);
    const edge = args.edge !== false && P.edge;
    return {
      target: `${prepared.layers.length} selected layer(s)`,
      writes: [`per layer: pre-comps "${PREFIX} N Map" (Gradient Ramp + Fractal Noise) and "${PREFIX} N Matte" (Gradient Wipe${P.displace ? ' + Turbulent Displace' : ''}), set as the layer's Alpha Track Matte and parented to it`]
        .concat(edge ? [`a glowing edge: "${PREFIX} N Edge" (the matte against itself a moment later) as the Luma matte of a linked copy "${PREFIX} N Glow" (Fill ${P.edge.color} + Glow, Add)`] : []),
      warnings: ['A layer that already has a track matte, or is 3D, is skipped and named', 'Restore removes the layers and pre-comps; the few solid items they used stay in the project (After Effects\' own Undo removes them too)']
    };
  },
  async execute({ args, ctx, prepared, host }) {
    const comp = ctx.comp, fd = comp.frameDuration || 1 / 25;
    const info = (await host.call('layers.rects', { compId: comp.id, layerIds: prepared.layers.map((l) => l.id), time: comp.time })).layers;
    const skipped = [], use = [];
    info.forEach((L) => {
      if (L.threeD) skipped.push(`${L.name} (3D layer — not supported yet)`);
      else if (!L.rect || L.rect[2] < 1 || L.rect[3] < 1) skipped.push(`${L.name} (nothing to reveal at the playhead)`);
      else if (L.matte) skipped.push(`${L.name} (already uses the track matte "${L.matte.name}" — Restore or remove it first)`);
      else use.push(L);
    });
    if (!use.length) throw Object.assign(new Error(`Nothing to reveal: ${skipped.join(', ')}`), { code: 'NOTHING' });
    const used = new Set((ctx.compLayers || []).map((l) => l.name));
    let n = 1;
    const nextN = () => { while ([...used].some((x) => x.indexOf(`${PREFIX} ${n} `) === 0)) n++; const k = n++; return k; };
    const T = PLAN1(host, 'MOE: Matte FX');
    const jobs = use.map((L, i) => {
      const p = F.build(args, L.rect), N = nextN(), t0 = FG.snap(comp.time + i * (args.stagger || 0), fd), name = `${PREFIX} ${N}`;
      const at = (keys) => keys.map((k) => Object.assign({}, k, { t: k.t + t0 }));
      // Map: ramp under noise
      const M = T.add('comps.create', { compId: comp.id, name: `${name} Map`, width: p.size[0], height: p.size[1] });
      const ramp = T.add('layers.createSolid', { compId: M.at('compId'), name: `${PREFIX} Ramp`, color: [0, 0, 0] });
      T.add('effects.ensure', { compId: M.at('compId'), label: 'MOE: Matte FX', layers: [{ layer: { layerId: ramp.at('layerId') }, items: [{ key: `${PREFIX} Ramp`, matchName: 'ADBE Ramp', before: [], params: [v('Start of Ramp', p.ramp.start), v('Start Color', p.ramp.startColor), v('End of Ramp', p.ramp.end), v('End Color', p.ramp.endColor), v('Ramp Shape', F.RAMP_SHAPE[p.ramp.shape])] }] }] });
      const noise = T.add('layers.createSolid', { compId: M.at('compId'), name: `${PREFIX} Noise`, color: [0, 0, 0] });
      const np = [v('Contrast', p.noise.contrast), v('Complexity', p.noise.complexity), v('Random Seed', p.noise.seed), v('Offset Turbulence', p.noise.offset)];
      if (p.noise.brightness) np.push(v('Brightness', p.noise.brightness));
      if (p.noise.type) np.push(v('Noise Type', p.noise.type));
      if (p.noise.fractal) np.push(v('Fractal Type', p.noise.fractal));
      // streaks: Uniform Scaling off, then Scale Width / Height (otherwise one Scale)
      if (p.noise.stretch) np.push(v('Uniform Scaling', 0), v('Scale Width', p.noise.stretch[0]), v('Scale Height', p.noise.stretch[1]));
      else np.push(v('Scale', p.noise.scale));
      T.add('effects.ensure', { compId: M.at('compId'), label: 'MOE: Matte FX', layers: [{ layer: { layerId: noise.at('layerId') }, items: [{ key: `${PREFIX} Noise`, matchName: 'ADBE Fractal Noise', before: [], params: np }] }] });
      T.add('keys.write', { compId: M.at('compId'), label: 'MOE: Matte FX', items: [{ address: FXA(noise.at('layerId'), `${PREFIX} Noise`, 'Evolution'), keys: at(p.evolution) }] });
      T.add('props.setValues', { compId: M.at('compId'), label: 'MOE: Matte FX', items: [{ address: TR(noise.at('layerId'), 'ADBE Opacity'), value: p.noise.mix }] });
      T.add('layers.setAttrs', { compId: M.at('compId'), label: 'MOE: Matte FX', items: [{ layerId: noise.at('layerId'), blendingMode: p.noise.blend }] });
      // Matte: the Map (hidden) read by Gradient Wipe on a white solid
      const A = T.add('comps.create', { compId: comp.id, name: `${name} Matte`, width: p.size[0], height: p.size[1] });
      const mapL = T.add('comps.place', { compId: A.at('compId'), sourceId: M.at('compId'), name: `${name} Map`, startTime: 0 });
      T.add('layers.setAttrs', { compId: A.at('compId'), label: 'MOE: Matte FX', items: [{ layerId: mapL.at('layerId'), enabled: false }] });
      const wipe = T.add('layers.createSolid', { compId: A.at('compId'), name: `${PREFIX} Wipe`, color: [1, 1, 1] });
      const items = [{ key: `${PREFIX} Wipe`, matchName: 'ADBE Gradient Wipe', before: [], params: [v('Transition Softness', p.soft), { id: 'Gradient Layer', layerRef: mapL.at('layerId'), names: ['Gradient Layer'] }] }];
      if (p.displace) items.push({ key: `${PREFIX} Liquid`, matchName: 'ADBE Turbulent Displace', before: [], params: [v('Amount', p.displace.amount), v('Size', p.displace.size)] });
      // Stepped motion: the matte (and the Map it reads) sampled at a lower frame rate — Posterize Time
      if (p.stepped) items.push({ key: `${PREFIX} Steps`, matchName: 'ADBE Posterize Time', before: [], params: [v('Frame Rate', p.stepped)] });
      const wipeFx = T.add('effects.ensure', { compId: A.at('compId'), label: 'MOE: Matte FX', layers: [{ layer: { layerId: wipe.at('layerId') }, items }] });
      const wipeKeys = T.add('keys.write', { compId: A.at('compId'), label: 'MOE: Matte FX', items: [{ address: FXA(wipe.at('layerId'), `${PREFIX} Wipe`, 'Transition Completion'), keys: at(p.completion) }] });
      // in the user's comp: the matte on the layer, in its own space, following it
      const place = (src, nm) => {
        const r = T.add('comps.place', { compId: comp.id, sourceId: src.at('compId'), name: nm, startTime: 0, label: 14 });
        T.add('props.setValues', { compId: comp.id, label: 'MOE: Matte FX', items: [{ address: TR(r.at('layerId'), 'ADBE Anchor Point'), value: p.anchor }, { address: TR(r.at('layerId'), 'ADBE Position'), value: [0, 0] }] });
        T.add('layers.setParent', { compId: comp.id, label: 'MOE: Matte FX', items: [{ layerId: r.at('layerId'), parentId: L.layerId }] });
        return r;
      };
      const aL = place(A, `${name} Matte`);
      T.add('layers.move', { compId: comp.id, items: [{ layerId: aL.at('layerId'), before: L.layerId }] });
      T.add('layers.setAttrs', { compId: comp.id, label: 'MOE: Matte FX', items: [{ layerId: aL.at('layerId'), enabled: false }] });
      const set = T.add('layers.setMatte', { compId: comp.id, items: [{ layerId: L.layerId, matteId: aL.at('layerId'), type: 'alpha' }] });
      const job = { L, p, N, name, t0, M, A, aL, set, wipeFx, wipeKeys };
      if (p.edge) {
        const E = T.add('comps.create', { compId: comp.id, name: `${name} Edge`, width: p.size[0], height: p.size[1] });
        T.add('comps.place', { compId: E.at('compId'), sourceId: A.at('compId'), name: `${name} Matte`, startTime: 0 });
        const late = T.add('comps.place', { compId: E.at('compId'), sourceId: A.at('compId'), name: `${name} Matte (later)`, startTime: p.edge.lag });
        T.add('layers.setAttrs', { compId: E.at('compId'), label: 'MOE: Matte FX', items: [{ layerId: late.at('layerId'), blendingMode: 'difference' }] });
        const dup = T.add('layers.duplicateLinked', { compId: comp.id, sourceId: L.layerId, name: `${name} Glow`, place: 'above', label: 14, comment: `${PREFIX} edge of ${L.name}` });
        const glowFx = T.add('effects.ensure', { compId: comp.id, label: 'MOE: Matte FX', layers: [{ layer: { layerId: dup.at('layerId') }, items: [
          { key: `${PREFIX} Edge Colour`, matchName: 'ADBE Fill', before: [], params: [v('Color', p.edge.color)] },
          { key: `${PREFIX} Edge Glow`, matchName: 'ADBE Glo2', before: [], params: [v('Glow Radius', p.edge.glow), v('Glow Intensity', p.edge.intensity)] }
        ] }] });
        const eL = place(E, `${name} Edge Matte`);
        T.add('layers.move', { compId: comp.id, items: [{ layerId: eL.at('layerId'), before: dup.at('layerId') }] });
        T.add('layers.setAttrs', { compId: comp.id, label: 'MOE: Matte FX', items: [{ layerId: eL.at('layerId'), enabled: false }, { layerId: dup.at('layerId'), blendingMode: 'add' }] });
        const eSet = T.add('layers.setMatte', { compId: comp.id, items: [{ layerId: dup.at('layerId'), matteId: eL.at('layerId'), type: 'luma' }] });
        Object.assign(job, { E, dup, eL, eSet, glowFx });
      }
      return job;
    });
    try {
      await T.commit();
    } catch (e) {
      // nothing half-made stays: layers first (they use the comps), then the comps that nothing else uses
      const layerIds = [], compIds = [];
      for (const j of jobs) {
        for (const r of [j.aL, j.eL, j.dup]) { const x = r && r.value(); if (x && x.layerId) layerIds.push(x.layerId); }
        for (const r of [j.E, j.A, j.M]) { const x = r && r.value(); if (x && x.compId) compIds.push(x.compId); }
      }
      if (layerIds.length) await host.call('layers.setMatte', { compId: comp.id, items: jobs.map((j) => ({ layerId: j.L.layerId })) }).catch(() => {});
      if (layerIds.length) await host.call('layers.remove', { compId: comp.id, layerIds, onlyNamed: PREFIX }).catch(() => {});
      if (compIds.length) await host.call('comps.removeMoe', { compId: comp.id, ids: compIds, onlyNamed: PREFIX }).catch(() => {});
      throw e;
    }
    // read back (changes nothing): the track mattes as After Effects holds them, Completion at the first / last key
    const now = (await host.call('layers.rects', { compId: comp.id, layerIds: jobs.map((j) => j.L.layerId) })).layers;
    const layers = jobs.map((j, i) => {
      const w = j.wipeKeys.value().items[0].written;
      const unmapped = [].concat(...[j.wipeFx, j.glowFx].filter(Boolean).map((r) => r.value().layers)).flatMap((x) => x.items.flatMap((it) => it.params.filter((q) => q.resolvedBy !== 'name').map((q) => `${it.key}.${q.id}`)));
      return {
        targetId: j.L.layerId, name: j.L.name, fxName: j.name, preset: j.p.label,
        matteId: j.aL.value().layerId, matteNow: now[i].matte, edgeId: j.eL ? j.eL.value().layerId : null, glowId: j.dup ? j.dup.value().layerId : null,
        edgeMatte: j.eSet ? j.eSet.value().layers[0] : null,
        comps: [j.E && j.E.value().compId, j.A.value().compId, j.M.value().compId].filter(Boolean),
        completion: { first: w[0], last: w[w.length - 1] }, plan: { first: j.p.completion[0].v, last: j.p.completion[j.p.completion.length - 1].v },
        unmapped
      };
    });
    return { preset: args.preset, label: specOf(args).label, dir: args.dir, skipped, layers };
  },
  verify({ result }) {
    const c = [];
    for (const L of result.layers) {
      const wired = L.matteNow && L.matteNow.layerId === L.matteId;
      c.push({ ok: wired, label: `${L.name} › Track Matte`, detail: wired ? `${L.fxName} Matte (alpha) — read back from After Effects` : 'the track matte is not the MOE matte' });
      const keysOk = Math.abs(L.completion.first.value - L.plan.first) < 0.01 && Math.abs(L.completion.last.value - L.plan.last) < 0.01;
      c.push({ ok: keysOk, label: `${L.name} › ${L.preset}`, detail: `Gradient Wipe Completion ${L.completion.first.value} → ${L.completion.last.value} %, ${L.completion.first.t.toFixed(2)}–${L.completion.last.t.toFixed(2)} s` });
      if (L.glowId) c.push({ ok: !!L.edgeMatte && L.edgeMatte.after === L.edgeId, label: `${L.name} › Edge`, detail: L.edgeMatte && L.edgeMatte.after === L.edgeId ? `${L.fxName} Glow on the edge band (luma)` : 'edge matte not set' });
      c.push({ ok: !L.unmapped.length, label: `${L.name} › effect parameters`, detail: L.unmapped.length ? `not found by name: ${L.unmapped.join(', ')}` : 'every parameter found by its English name' });
    }
    for (const s of result.skipped) c.push({ ok: true, label: 'Skipped', detail: s });
    return { ok: c.every((x) => x.ok), checks: c };
  },
  checkpoint({ result, ctx }) {
    return { compId: ctx.comp.id, layers: result.layers.map((L) => ({ targetId: L.targetId, layerIds: [L.matteId, L.edgeId, L.glowId].filter(Boolean), comps: L.comps })) };
  },
  async restore({ data, host }) {
    const T = PLAN1(host, 'MOE: Restore Matte FX');
    T.add('layers.setMatte', { compId: data.compId, items: data.layers.map((L) => ({ layerId: L.targetId })) });
    T.add('layers.remove', { compId: data.compId, layerIds: [].concat(...data.layers.map((L) => L.layerIds)), onlyNamed: PREFIX });
    T.add('comps.removeMoe', { compId: data.compId, ids: [].concat(...data.layers.map((L) => L.comps)), onlyNamed: PREFIX });
    await T.commit();
    return { ok: true };
  },
  summarize(result) { return `${result.label || (F.PRESETS[result.preset] || {}).label} on ${result.layers.length} layer(s)`; }
};

module.exports = { fx, PREFIX };
