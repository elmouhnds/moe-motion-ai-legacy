'use strict';
/**
 * Matte Reveal (v0.95, docs/features/MATTE_REVEAL.md): the selected layers are revealed (or hidden) through an
 * Alpha Track Matte — one shape layer "MOE Matte · <layer>" per layer, its cells drawn in the layer's own space
 * (sourceRectAtTime) and keyed from `mattePlan.build`, so nine styles share one engine: Wipe (any side or diagonal),
 * Corner, Split, Iris, Card, Blinds, Stripes, Shutter, Pixels.
 *
 * One host call writes everything (one Ctrl+Z, docs/features/ONE_UNDO.md): the matte layers, an optional soft edge
 * (Gaussian Blur on the matte), every key, the track mattes, and the matte layers' video switched off. A layer that
 * already has the user's own track matte is skipped and named; one that has a MOE matte gets the new one instead.
 * The read-back compares After Effects' own values of every cell at the start and the end with the plan, as the
 * share of the layer that shows (`mattePlan.coverage`).
 */
const M = require('./mattePlan');
const PLAN = require('../quick/animatePlan');
const FG = require('../../core/framegrid');
const { plan: PLAN1 } = require('../../core/host/plan');

const EASES = Object.entries(require('../zoom/math').EASES).map(([value, x]) => ({ value, label: x.label })).concat([{ value: 'linear', label: 'Linear' }]);
const PREFIX = 'MOE Matte';
const SOFT = 'MOE Matte Soft';
const GROUP = (cell) => ['ADBE Root Vectors Group', `name:${cell}`];
const ADDR = {
  scale: (id, cell) => ({ layerId: id, matchNames: GROUP(cell).concat(['ADBE Vector Transform Group', 'ADBE Vector Scale']) }),
  position: (id, cell) => ({ layerId: id, matchNames: GROUP(cell).concat(['ADBE Vector Transform Group', 'ADBE Vector Position']) }),
  roundness: (id, cell) => ({ layerId: id, matchNames: GROUP(cell).concat(['ADBE Vectors Group', 'ADBE Vector Shape - Rect', 'ADBE Vector Rect Roundness']) })
};
const nameFor = (layerName) => `${PREFIX} · ${layerName}`.slice(0, 120);
const opts = (o) => Object.entries(o).map(([value, x]) => ({ value, label: typeof x === 'string' ? x : x.label }));

const matte = {
  id: 'reveal.matte', version: '1.0.0', category: 'motion', group: 'Quick · Animate', name: 'Matte Reveal',
  description: 'Reveal or hide the selected layers through an alpha track matte: a MOE matte shape layer that follows each layer, in nine styles — Wipe (any side or diagonal), Corner, Split, Iris, Card, Blinds, Stripes, Shutter and Pixels. Eased, cascaded, staggered; one Ctrl+Z; Restore removes the mattes.',
  keywords: ['matte', 'alpha matte', 'track matte', 'reveal', 'mask reveal', 'wipe', 'iris', 'blinds', 'pixels', 'shutter', 'split', 'card', 'stripes', 'saas', 'ماسك', 'ميت', 'كشف', 'ريفيل'],
  icon: 'layers',
  params: {
    style: { type: 'enum', label: 'Style', tileFixed: true, default: 'wipe', options: opts(M.STYLES) },
    dir: { type: 'enum', label: 'Direction', default: 'in', options: [{ value: 'in', label: 'Reveal (in)' }, { value: 'out', label: 'Hide (out)' }] },
    from: { type: 'enum', label: 'From', default: 'left', options: opts(M.DIRS), showIf: (a) => a.style === 'wipe' },
    corner: { type: 'enum', label: 'Corner', default: 'topLeft', options: [{ value: 'topLeft', label: 'Top left' }, { value: 'topRight', label: 'Top right' }, { value: 'bottomLeft', label: 'Bottom left' }, { value: 'bottomRight', label: 'Bottom right' }], showIf: (a) => a.style === 'corner' },
    axis: { type: 'enum', label: 'Bars', default: 'h', options: [{ value: 'h', label: 'Horizontal' }, { value: 'v', label: 'Vertical' }], showIf: (a) => ['split', 'blinds', 'stripes', 'shutter'].includes(a.style) },
    count: { type: 'number', label: 'Bars', min: 2, max: M.LIMITS.count, step: 1, default: 6, showIf: (a) => ['blinds', 'stripes', 'shutter'].includes(a.style) },
    alternate: { type: 'boolean', label: 'Alternate sides', default: false, showIf: (a) => a.style === 'blinds' },
    cols: { type: 'number', label: 'Columns', min: 2, max: M.LIMITS.cols, step: 1, default: 8, showIf: (a) => a.style === 'pixels' },
    radius: { type: 'number', label: 'Corner radius', min: 0, max: 500, step: 1, default: 24, unit: 'px', showIf: (a) => a.style === 'card' },
    duration: { type: 'number', label: 'Duration', min: 0.05, max: 10, step: 0.05, default: 0.8, unit: 's' },
    ease: { type: 'enum', label: 'Ease', default: 'smooth', options: EASES },
    order: { type: 'enum', label: 'Cell order', default: 'forward', options: opts(M.ORDERS), showIf: (a) => M.STYLES[a.style] && M.STYLES[a.style].cells },
    cascade: { type: 'number', label: 'Cascade', min: 0, max: 0.9, step: 0.05, default: 0.5, description: 'How much the bars or blocks follow each other (0 = all together)', showIf: (a) => M.STYLES[a.style] && M.STYLES[a.style].cells },
    soft: { type: 'number', label: 'Soft edge', min: 0, max: 200, step: 1, default: 0, unit: 'px', description: '0 = sharp (Gaussian Blur on the matte)' },
    stagger: { type: 'number', label: 'Stagger', min: 0, max: 2, step: 0.01, default: 0, unit: 's', advanced: true, description: 'Delay between the selected layers' },
    layerOrder: { type: 'enum', label: 'Layer order', default: 'screen', advanced: true, options: [{ value: 'selection', label: 'Selection order' }, { value: 'screen', label: 'Screen ↘' }, { value: 'screenRtl', label: 'Screen ↙' }, { value: 'center', label: 'From the centre out' }], showIf: (a) => a.stagger > 0 },
    seed: { type: 'number', label: 'Seed', min: 0, max: 999, step: 1, default: 1, advanced: true, showIf: (a) => a.order === 'random' }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers', 'modify.keyframes', 'modify.effects'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Alpha-matte reveal/hide of the selected layers. style: wipe|corner|split|iris|card|blinds|stripes|shutter|pixels; from (wipe): left/right/top/bottom/topLeft/…; axis h|v; count; cols; cascade 0–0.9; soft px.' },
  uses: { hostOps: ['layers.rects', 'layers.bounds', 'shapes.matte', 'effects.ensure', 'keys.write', 'layers.setMatte', 'layers.setAttrs', 'layers.remove', 'props.values', 'tx.run'], network: false },
  compatibility: { minAE: '23.0' },
  ui: { primaryLabel: 'Reveal' },
  prepare(args, ctx) {
    if (!M.STYLES[args.style]) return { ok: false, error: `Unknown style ${args.style}` };
    const l = (ctx.layers || []).filter((x) => !['camera', 'light', 'null', 'audio'].includes(x.type));
    if (!l.length) return { ok: false, error: 'Select the layers to reveal (shapes, text, footage, pre-comps)' };
    const st = M.STYLES[args.style];
    const what = args.style === 'wipe' ? (M.DIRS[args.from] || M.DIRS.left).label.toLowerCase() : st.hint.toLowerCase();
    return { ok: true, layers: l, preview: { summary: `${args.dir === 'out' ? 'Hide' : 'Reveal'} · ${st.label} — ${what} · ${args.duration}s · ${l.length} layer(s)`, items: l.slice(0, 6).map((x) => `${x.name} ← ${nameFor(x.name)}`) } };
  },
  explain(args, ctx, prepared) {
    if (!prepared) return {};
    return {
      target: `${prepared.layers.length} selected layer(s)`,
      writes: [`one shape layer "${PREFIX} · <layer>" per layer, set as its Alpha Track Matte and parented to it (hidden — the matte, not a picture)`, `keys on the matte's cells (${M.STYLES[args.style].label})`].concat(args.soft > 0 ? [`"${SOFT}" (Gaussian Blur ${args.soft}px) on each matte`] : []),
      warnings: ['A layer that already has your own track matte is skipped; one with a MOE matte gets the new one']
    };
  },
  async execute({ args, ctx, prepared, host }) {
    const comp = ctx.comp, fd = comp.frameDuration || 1 / 25;
    const ids = prepared.layers.map((l) => l.id);
    // 1. read (changes nothing): each layer's own box, 3D switch and current track matte
    const info = (await host.call('layers.rects', { compId: comp.id, layerIds: ids, time: comp.time })).layers;
    const skipped = [], use = [];
    info.forEach((L) => {
      if (L.threeD) skipped.push(`${L.name} (3D layer — not supported yet)`);
      else if (!L.rect || L.rect[2] < 1 || L.rect[3] < 1) skipped.push(`${L.name} (nothing to reveal at the playhead)`);
      else if (L.matte && String(L.matte.name).indexOf(PREFIX) !== 0) skipped.push(`${L.name} (already uses your track matte "${L.matte.name}")`);
      else use.push(L);
    });
    if (!use.length) throw Object.assign(new Error(`Nothing to reveal: ${skipped.join(', ')}`), { code: 'NOTHING' });
    // 2. layer order (a measurement that changes nothing — only when staggered by screen)
    let rank = use.map((_, i) => i);
    if (args.stagger > 0 && args.layerOrder !== 'selection' && use.length > 1) {
      const m = await host.call('layers.bounds', { compId: comp.id, layerIds: use.map((L) => L.layerId), times: [comp.time] });
      rank = PLAN.screenOrder(use.map((L) => { const b = m.layers.find((x) => x.layerId === L.layerId); return b && b.boxes[0] ? b.boxes[0] : [0, 0, 0, 0]; }), args.layerOrder);
    }
    // 3. the plans (pure), then ONE host call
    const jobs = use.map((L, i) => ({ L, t0: FG.snap(comp.time + rank[i] * (args.stagger || 0), fd), p: M.build(args, L.rect) }));
    const T = PLAN1(host, `MOE: Matte Reveal`);
    for (const j of jobs) {
      if (j.L.matte) {
        j.replaced = j.L.matte.name;
        T.add('layers.setMatte', { compId: comp.id, items: [{ layerId: j.L.layerId }] });
        T.add('layers.remove', { compId: comp.id, layerIds: [j.L.matte.layerId], onlyNamed: PREFIX });
      }
      j.made = T.add('shapes.matte', { compId: comp.id, targetId: j.L.layerId, name: nameFor(j.L.name), label: 9, cells: j.p.cells.map((c) => ({ name: c.name, kind: c.kind, size: c.size, roundness: c.roundness, anchor: c.anchor, position: c.position, rotation: c.rotation, scale: c.scale })) });
      const mid = j.made.at('layerId');
      if (args.soft > 0) j.fx = T.add('effects.ensure', { compId: comp.id, label: 'MOE: Matte Soft', layers: [{ layer: { layerId: mid }, items: [{ key: SOFT, matchName: 'ADBE Gaussian Blur 2', before: [], params: [{ id: 'Blurriness', value: args.soft, names: ['Blurriness'] }, { id: 'Repeat Edge Pixels', value: 0, names: ['Repeat Edge Pixels'] }] }] }] });
      j.keys = T.add('keys.write', { compId: comp.id, label: 'MOE: Matte Reveal', items: j.p.tracks.map((tr) => ({ address: ADDR[tr.prop](mid, j.p.cells[tr.cell].name), keys: tr.keys.map((k) => Object.assign({}, k, { t: k.t + j.t0 })), spatialLinear: tr.prop === 'position' })) });
      j.set = T.add('layers.setMatte', { compId: comp.id, items: [{ layerId: j.L.layerId, matteId: mid, type: 'alpha' }] });
      T.add('layers.setAttrs', { compId: comp.id, label: 'MOE: Matte Reveal', items: [{ layerId: mid, enabled: false }] });
    }
    try {
      await T.commit();
    } catch (e) {
      // nothing half-made stays: the mattes this run made go (a replaced MOE matte is gone with the same undo step)
      const made = jobs.map((j) => j.made.value()).filter((x) => x && x.layerId).map((x) => x.layerId);
      if (made.length) await host.call('layers.remove', { compId: comp.id, layerIds: made, onlyNamed: PREFIX }).catch(() => {});
      throw e;
    }
    // 4. read back (changes nothing): every cell at the first and the last key, as After Effects evaluates it
    const reads = [];
    const out = jobs.map((j) => {
      // at the first and the last key as After Effects wrote them (keys sit on the comp's frame grid)
      const w = j.keys.value().items.map((it) => it.written.map((k) => k.t));
      const first = Math.min(...w.map((x) => x[0])), last = Math.max(...w.map((x) => x[x.length - 1]));
      const mid = j.made.value().layerId, tEnd = last;
      j.t0 = first;
      const at = (t) => j.p.cells.map((c) => {
        const r = { scale: reads.push({ address: ADDR.scale(mid, c.name), time: t }) - 1, position: reads.push({ address: ADDR.position(mid, c.name), time: t }) - 1 };
        if (c.kind === 'rect' && j.p.tracks.some((tr) => tr.prop === 'roundness')) r.roundness = reads.push({ address: ADDR.roundness(mid, c.name), time: t }) - 1;
        return r;
      });
      return { j, mid, idx0: at(j.t0), idx1: at(tEnd), tEnd };
    });
    const vals = (await host.call('props.values', { compId: comp.id, items: reads })).items.map((r) => r.value);
    const pick = (idx) => idx.map((r) => ({ scale: vals[r.scale], position: vals[r.position], roundness: r.roundness !== undefined ? vals[r.roundness] : undefined }));
    return {
      style: args.style, dir: args.dir, skipped,
      layers: out.map(({ j, mid, idx0, idx1, tEnd }) => {
        const got0 = M.coverage(j.p, pick(idx0), j.L.rect), got1 = M.coverage(j.p, pick(idx1), j.L.rect);
        const want0 = M.coverage(j.p, M.valuesAt(j.p, 0), j.L.rect), want1 = M.coverage(j.p, M.valuesAt(j.p, j.p.end), j.L.rect);
        return { targetId: j.L.layerId, name: j.L.name, matteId: mid, matteName: j.made.value().name, cells: j.p.cells.length, t0: j.t0, tEnd, replaced: j.replaced || null, keys: j.keys.value(), matte: j.set.value(), fx: j.fx ? j.fx.value() : null, shown: { start: got0, end: got1 }, plan: { start: want0, end: want1 } };
      })
    };
  },
  verify({ result }) {
    const pc = (v) => `${Math.round(v * 100)}%`;
    const c = [];
    for (const L of result.layers) {
      const m = L.matte.layers[0];
      c.push({ ok: m.after === L.matteId, label: `${L.name} › Track Matte`, detail: m.after === L.matteId ? `${L.matteName} (alpha)${L.replaced ? ` — replaced ${L.replaced}` : ''}` : 'not set' });
      const near = Math.abs(L.shown.start - L.plan.start) < 0.02 && Math.abs(L.shown.end - L.plan.end) < 0.02;
      c.push({ ok: near, label: `${L.name} › ${M.STYLES[result.style].label}`, detail: `shows ${pc(L.shown.start)} → ${pc(L.shown.end)} (plan ${pc(L.plan.start)} → ${pc(L.plan.end)}), ${L.cells} cell(s), ${L.t0.toFixed(2)}–${L.tEnd.toFixed(2)} s — read back from After Effects` });
      const bad = L.keys.items.filter((it) => it.written.length < 2);
      if (bad.length) c.push({ ok: false, label: `${L.name} › keys`, detail: `${bad.length} cell propert(ies) without keys` });
    }
    for (const s of result.skipped) c.push({ ok: true, label: 'Skipped', detail: s });
    return { ok: c.every((x) => x.ok), checks: c };
  },
  checkpoint({ result, ctx }) {
    return { compId: ctx.comp.id, layers: result.layers.map((L) => ({ targetId: L.targetId, matteId: L.matteId })) };
  },
  async restore({ data, host }) {
    const T = PLAN1(host, 'MOE: Restore Matte Reveal');
    T.add('layers.setMatte', { compId: data.compId, items: data.layers.map((L) => ({ layerId: L.targetId })) });
    T.add('layers.remove', { compId: data.compId, layerIds: data.layers.map((L) => L.matteId), onlyNamed: PREFIX });
    await T.commit();
    return { ok: true };
  },
  summarize(result) { return `${M.STYLES[result.style].label} ${result.dir === 'out' ? 'hide' : 'reveal'} on ${result.layers.length} layer(s)`; }
};

module.exports = { matte, ADDR, PREFIX, nameFor };
