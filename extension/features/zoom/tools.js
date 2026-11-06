'use strict';
/**
 * Zoom & Focus (ClickZoom-style): one-click zooms for tutorials, screen recordings,
 * talking heads and podcasts — without touching the footage layers.
 *   zoom.focus   zoom into a point or the selected layer (in / hold / out), chained pans,
 *                motion blur, optional spotlight dim — keys on one "MOE Zoom" rig
 *   zoom.follow  keep the zoom centred on a moving layer (cursor / tracked null), smoothed
 *   zoom.cursor  animated cursor (arrow / hand) through the click points of a keyed layer,
 *                with click pulse, ripple ring and fade-out
 */
const Z = require('./math');
const { hexToRgb } = require('../brand/brands');

const RIG = 'MOE Zoom';
const FX = 'ADBE Geometry2';
const ADDR = (id) => ({
  anchor: { layerId: id, matchNames: ['ADBE Effect Parade', `name:${RIG}`, 'ADBE Geometry2-0001'] },
  position: { layerId: id, matchNames: ['ADBE Effect Parade', `name:${RIG}`, 'ADBE Geometry2-0002'] },
  scale: { layerId: id, matchNames: ['ADBE Effect Parade', `name:${RIG}`, 'ADBE Geometry2-0004'] }
});
const EASE_OPTIONS = Object.entries(Z.EASES).map(([value, e]) => ({ value, label: e.label }));
const RIG_ITEMS = (mb) => [{
  key: RIG, matchName: FX, before: [], expectParams: 12,
  params: [
    { id: 'Uniform Scale', value: 1, names: ['Uniform Scale'], suffix: 3 },
    { id: 'Comp Shutter', value: 0, names: ["Use Composition's Shutter Angle"], suffix: 10 },
    { id: 'Shutter Angle', value: mb ? 180 : 0, names: ['Shutter Angle'], suffix: 11 }
  ]
}];

function findRig(ctx) { return (ctx.compLayers || []).find((l) => l.name === RIG) || null; }

async function ensureRig(host, ctx, mb) {
  let rig = findRig(ctx);
  let created = null;
  if (!rig) {
    created = await host.call('layers.createAdjustment', { compId: ctx.comp.id, name: RIG, label: 2, comment: 'MOE Zoom rig — zooms everything below it' });
    rig = { id: created.layerId, name: RIG };
  }
  const fx = await host.call('effects.ensure', { compId: ctx.comp.id, label: 'MOE: Zoom Rig', layers: [{ layer: { layerId: rig.id }, items: RIG_ITEMS(mb) }] });
  return { rig, created, fx };
}

const asKeys = (plan, field, map = (v) => v) => plan.keys.map((k) => ({ t: k.t, v: map(k.v[field]), easeIn: k.easeIn, easeOut: k.easeOut }));

const focus = {
  id: 'zoom.focus',
  version: '1.0.0',
  category: 'motion',
  group: 'Zoom & Focus',
  name: 'Focus Zoom',
  description: 'One-click zoom into a point or the selected layer: zoom in, hold, zoom out — with easing presets, motion blur and an optional spotlight. Zooms chain into smooth pans. Your layers are never touched (one MOE Zoom rig).',
  keywords: ['zoom', 'clickzoom', 'punch in', 'focus', 'tutorial', 'screen recording', 'podcast', 'talking head', 'camera', 'push in', 'spotlight'],
  icon: 'zoom',
  params: {
    target: { type: 'enum', label: 'Focus', default: 'layer', options: [{ value: 'layer', label: 'Selected layer' }, { value: 'point', label: 'Point' }] },
    x: { type: 'number', label: 'X', min: 0, max: 100, step: 0.1, default: 50, unit: '%', hidden: true },
    y: { type: 'number', label: 'Y', min: 0, max: 100, step: 0.1, default: 50, unit: '%', hidden: true },
    level: { type: 'number', label: 'Zoom', min: 0, max: 1000, step: 5, default: 200, unit: '%', description: '0 = auto (fit the selected layer)' },
    inDur: { type: 'number', label: 'Zoom in', min: 0.05, max: 10, step: 0.05, default: 0.6, unit: 's' },
    hold: { type: 'number', label: 'Hold', min: 0, max: 60, step: 0.1, default: 1.5, unit: 's', showIf: (a) => a.zoomOut },
    outDur: { type: 'number', label: 'Zoom out', min: 0.05, max: 10, step: 0.05, default: 0.6, unit: 's', showIf: (a) => a.zoomOut },
    zoomOut: { type: 'boolean', label: 'Zoom back out', default: true },
    ease: { type: 'enum', label: 'Ease', default: 'smooth', options: EASE_OPTIONS },
    mode: { type: 'enum', label: 'Framing', default: 'center', advanced: true, options: [{ value: 'center', label: 'Centre it' }, { value: 'inPlace', label: 'Zoom in place' }] },
    endAtPlayhead: { type: 'boolean', label: 'End at playhead', default: false, advanced: true },
    motionBlur: { type: 'boolean', label: 'Motion blur', default: true, advanced: true },
    spotlight: { type: 'number', label: 'Spotlight dim', min: 0, max: 90, step: 1, default: 0, unit: '%', advanced: true, description: 'Darken around the focus while zoomed (0 = off)' }
  },
  requires: { comp: true },
  permissions: ['modify.layers', 'modify.effects', 'modify.keyframes'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Zoom/punch-in to a point or the selected layer at the playhead (screen recordings, tutorials, podcasts). x/y are percent of the frame when target=point.' },
  uses: { hostOps: ['layers.createAdjustment', 'effects.ensure', 'layers.bounds', 'props.values', 'keys.write', 'layers.createSolid', 'masks.ellipse'], network: false },
  compatibility: { minAE: '25.0' },
  ui: {
    lockedOk: true, // v0.61: the selected layer is only the target to look at — a locked one is fine
    primaryLabel: 'Zoom',
    presets: [
      { id: 'punch', label: 'Punch-in', args: { level: 150, inDur: 0.25, ease: 'snappy', zoomOut: true, hold: 2, outDur: 0.3 } },
      { id: 'smooth', label: 'Smooth', args: { level: 200, inDur: 0.8, ease: 'smooth', zoomOut: true } },
      { id: 'detail', label: 'Detail', args: { level: 350, inDur: 0.7, ease: 'expo', zoomOut: true, hold: 1.2 } },
      { id: 'stay', label: 'Stay in', args: { zoomOut: false, level: 180 } }
    ],
    renderBody(args, setArgs, { h, ctx }) {
      if (args.target !== 'point' || !ctx || !ctx.comp) return null;
      const W = ctx.comp.width, H = ctx.comp.height;
      const z = Math.max(1, (args.level || 200) / 100);
      const v = Z.visibleRect(Z.frame([(args.x / 100) * W, (args.y / 100) * H], z, W, H, args.mode), W, H);
      const box = h('div', { class: 'focus-map', style: { aspectRatio: `${W} / ${H}` }, title: 'Click to set the focus point',
        onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); setArgs(Object.assign({}, args, { x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 10 })); } },
      h('div', { class: 'focus-view', style: { left: `${(v[0] / W) * 100}%`, top: `${(v[1] / H) * 100}%`, width: `${((v[2] - v[0]) / W) * 100}%`, height: `${((v[3] - v[1]) / H) * 100}%` } }),
      h('div', { class: 'focus-dot', style: { left: `${args.x}%`, top: `${args.y}%` } }));
      return h('div', { class: 'field stack' }, h('label', {}, `Focus point · ${args.x}% , ${args.y}%`), box);
    }
  },

  prepare(args, ctx) {
    if (args.target === 'layer') {
      const L = (ctx.layers || []).find((l) => l.name !== RIG && !['camera', 'light'].includes(l.type));
      if (!L) return { ok: false, error: 'Select the layer to zoom into (or choose Point)' };
      return { ok: true, layer: L, preview: { summary: `Zoom ${args.level ? `${args.level}%` : 'auto'} into ${L.name} at ${ctx.comp.time.toFixed(2)}s`, items: [] } };
    }
    if (args.level > 0 && args.level < 100) return { ok: false, error: 'Zoom must be 100 % or more (0 = auto)' };
    return { ok: true, preview: { summary: `Zoom ${args.level || 200}% at ${args.x}%, ${args.y}% · ${ctx.comp.time.toFixed(2)}s`, items: [] } };
  },

  async execute({ args, ctx, prepared, host }) {
    const W = ctx.comp.width, H = ctx.comp.height;
    let f = [(args.x / 100) * W, (args.y / 100) * H];
    let z = (args.level || 200) / 100;
    if (prepared.layer) {
      const b = (await host.call('layers.bounds', { compId: ctx.comp.id, layerIds: [prepared.layer.id], times: [ctx.comp.time] })).layers[0].boxes[0];
      if (!b) throw new Error(`Cannot measure "${prepared.layer.name}" at the playhead`);
      f = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
      if (!args.level) z = Math.max(1.1, Math.min(10, 0.72 * Math.min(W / Math.max(b[2] - b[0], 1), H / Math.max(b[3] - b[1], 1))));
    }
    z = Math.max(1, Math.min(10, z));
    const rigInfo = await ensureRig(host, ctx, args.motionBlur !== false);
    const A = ADDR(rigInfo.rig.id);
    const total = args.inDur + (args.zoomOut ? args.hold + args.outDur : 0);
    const t0 = Math.max(0, args.endAtPlayhead ? ctx.comp.time - total : ctx.comp.time);
    let start = null;
    if (!rigInfo.created) {
      const cur = await host.call('props.values', { compId: ctx.comp.id, time: t0, items: [{ address: A.anchor }, { address: A.position }, { address: A.scale }] });
      if (cur.items.every((i) => i.value)) start = { anchor: cur.items[0].value, position: cur.items[1].value, scale: cur.items[2].value };
    }
    const p = Z.plan(f, z, W, H, { t: ctx.comp.time, inDur: args.inDur, hold: args.hold, outDur: args.outDur, endAtPlayhead: args.endAtPlayhead, zoomOut: args.zoomOut, ease: args.ease, mode: args.mode, start });
    const keys = await host.call('keys.write', { compId: ctx.comp.id, label: 'MOE: Focus Zoom', items: [
      { address: A.anchor, keys: asKeys(p, 'anchor'), spatialLinear: true },
      { address: A.position, keys: asKeys(p, 'position'), spatialLinear: true },
      { address: A.scale, keys: asKeys(p, 'scale') }
    ] });
    let spot = null;
    if (args.spotlight > 0) {
      const used = new Set((ctx.compLayers || []).map((l) => l.name));
      let n = 1;
      while (used.has(`MOE Spotlight ${n}`)) n++;
      spot = await host.call('layers.createSolid', { compId: ctx.comp.id, name: `MOE Spotlight ${n}`, color: [0, 0, 0], below: rigInfo.rig.id, label: 2, inPoint: p.span[0], outPoint: Math.max(p.span[1], p.span[0] + args.inDur) + 0.05 });
      const r = Math.min(W, H) / (2 * z) * 0.9;
      spot.mask = await host.call('masks.ellipse', { compId: ctx.comp.id, layerId: spot.layerId, name: 'Focus', center: f, size: [r * 2, r * 2], feather: r * 0.6, inverted: true });
      const o = args.spotlight;
      const ok = [{ t: p.keys[0].t, v: 0 }, { t: p.keys[1].t, v: o }];
      if (args.zoomOut) ok.push({ t: p.keys[2].t, v: o }, { t: p.keys[3].t, v: 0 });
      spot.keys = await host.call('keys.write', { compId: ctx.comp.id, label: 'MOE: Spotlight', items: [{ address: { layerId: spot.layerId, matchNames: ['ADBE Transform Group', 'ADBE Opacity'] }, keys: ok.map((k) => Object.assign(k, { easeIn: { speed: 0, influence: 60 }, easeOut: { speed: 0, influence: 60 } })) }] });
    }
    // v0.61: read back at the zoomed key as After Effects wrote it (on the comp's frame grid), not at the plan's time
    const zoomedAt = keys.items[0] && keys.items[0].written[1] ? keys.items[0].written[1].t : p.keys[1].t;
    const check = await host.call('props.values', { compId: ctx.comp.id, time: zoomedAt, items: [{ address: A.anchor }, { address: A.position }, { address: A.scale }] });
    return { rig: rigInfo.rig, created: rigInfo.created, fx: rigInfo.fx, plan: p, keys, spot, check, focus: f, level: z, comp: { W, H } };
  },

  verify({ result }) {
    const checks = [];
    const to = result.plan.to;
    const got = { anchor: result.check.items[0].value, position: result.check.items[1].value, scale: result.check.items[2].value };
    const ok = got.anchor && Math.hypot(got.anchor[0] - to.anchor[0], got.anchor[1] - to.anchor[1]) < 0.5 && Math.abs(got.scale - to.scale) < 0.05;
    checks.push({ ok, label: RIG, detail: ok ? `${Math.round(to.scale)}% on ${to.anchor.map(Math.round).join(', ')} at ${result.plan.keys[1].t.toFixed(2)}s (read back)` : `read back ${JSON.stringify(got)}` });
    const v = Z.visibleRect(got.anchor ? got : to, result.comp.W, result.comp.H);
    const covered = v[0] >= -0.5 && v[1] >= -0.5 && v[2] <= result.comp.W + 0.5 && v[3] <= result.comp.H + 0.5;
    checks.push({ ok: covered, label: 'Frame', detail: covered ? 'no empty edges while zoomed' : 'edges would show' });
    const mapped = result.fx.layers[0].items[0].params.filter((p) => p.resolvedBy !== 'name').map((p) => p.id);
    checks.push({ ok: true, label: 'Transform effect', detail: `${result.created ? 'rig created' : 'rig reused'}${mapped.length ? ` · mapping unverified: ${mapped.join(', ')}` : ''}` });
    for (const it of result.keys.items) checks.push({ ok: it.written.length === result.plan.keys.length, label: `${RIG} › ${it.name}`, detail: `${it.written.length} keys${it.replaced.length ? ` (${it.replaced.length} replaced)` : ''}` });
    if (result.spot) checks.push({ ok: true, label: result.spot.name, detail: 'spotlight dim keyed with the zoom' });
    return { ok: checks.every((c) => c.ok), checks };
  },

  checkpoint({ result, ctx }) {
    return {
      compId: ctx.comp.id,
      createdRig: result.created ? result.rig.id : null,
      keys: result.keys.items.map((it) => ({ address: it.address, times: it.written.map((w) => w.t), restore: it.replaced })),
      spot: result.spot ? result.spot.layerId : null
    };
  },

  async restore({ data, host }) {
    if (data.spot) await host.call('layers.remove', { compId: data.compId, layerIds: [data.spot], onlyNamed: 'MOE Spotlight' });
    if (data.createdRig) return host.call('layers.remove', { compId: data.compId, layerIds: [data.createdRig], onlyNamed: RIG });
    return host.call('keys.remove', { compId: data.compId, items: data.keys });
  },

  summarize(result, v) { return v.ok ? `Zoom ${Math.round(result.level * 100)}% · ${result.plan.span[0].toFixed(2)}–${result.plan.span[1].toFixed(2)}s` : 'Zoom finished with problems'; }
};

/* ---------------- follow ---------------- */

const FOLLOW_TAG = '// MOE Zoom Follow';
function followExpression(layerName, smoothing) {
  const n = smoothing > 0 ? 7 : 1;
  return [
    FOLLOW_TAG,
    `var L = thisComp.layer("${String(layerName).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}");`,
    `var sm = ${smoothing}, n = ${n}, ax = 0, ay = 0, i;`,
    'for (i = 0; i < n; i++) { var tt = n > 1 ? time + (i / (n - 1) - 0.5) * sm : time; var q = L.toComp(L.anchorPoint.valueAtTime(tt), tt); ax += q[0]; ay += q[1]; }',
    `var z = Math.max(effect("${RIG}")(4).value / 100, 1);`,
    'var W = thisComp.width, H = thisComp.height, hx = W / (2 * z), hy = H / (2 * z);',
    '[Math.min(Math.max(ax / n, hx), W - hx), Math.min(Math.max(ay / n, hy), H - hy)];'
  ].join('\n');
}

const follow = {
  id: 'zoom.follow',
  version: '1.0.0',
  category: 'motion',
  group: 'Zoom & Focus',
  name: 'Follow Zoom',
  description: 'Keep the zoom centred on a moving layer — a cursor, a tracked null or a face — smoothed, and never showing empty edges. Animate the MOE Zoom scale for punch-ins.',
  keywords: ['follow', 'track', 'cursor', 'zoom', 'pan', 'auto zoom'],
  icon: 'target',
  params: {
    layer: { type: 'layer', label: 'Follow', required: true },
    level: { type: 'number', label: 'Zoom', min: 100, max: 1000, step: 5, default: 180, unit: '%' },
    smoothing: { type: 'number', label: 'Smoothing', min: 0, max: 2, step: 0.05, default: 0.4, unit: 's' },
    motionBlur: { type: 'boolean', label: 'Motion blur', default: true, advanced: true }
  },
  requires: { comp: true },
  permissions: ['modify.layers', 'modify.effects', 'modify.expressions'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Zoom that follows a moving layer (cursor/tracked point).' },
  uses: { hostOps: ['layers.createAdjustment', 'effects.ensure', 'expressions.set', 'props.setValues'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Follow', lockedOk: true }, // follows the layer, never changes it
  prepare(args, ctx) {
    const L = (ctx.compLayers || []).find((l) => l.index === args.layer);
    if (!L) return { ok: false, error: 'Choose the layer to follow' };
    if (L.name === RIG) return { ok: false, error: 'Choose a layer other than the zoom rig' };
    return { ok: true, target: L, preview: { summary: `Follow ${L.name} at ${args.level}%`, items: [] } };
  },
  async execute({ args, ctx, prepared, host }) {
    const rigInfo = await ensureRig(host, ctx, args.motionBlur !== false);
    const A = ADDR(rigInfo.rig.id);
    const vals = await host.call('props.setValues', { compId: ctx.comp.id, label: 'MOE: Follow Zoom', items: [{ address: A.scale, value: args.level }, { address: A.position, value: [ctx.comp.width / 2, ctx.comp.height / 2] }] });
    const set = await host.call('expressions.set', { compId: ctx.comp.id, label: 'MOE: Follow Zoom', revertOnError: true, targets: [{ address: A.anchor, expression: followExpression(prepared.target.name, args.smoothing), enabled: true }] });
    const read = await host.call('props.values', { compId: ctx.comp.id, items: [{ address: A.anchor }] });
    return { rig: rigInfo.rig, created: rigInfo.created, vals, set, read, target: prepared.target.name };
  },
  verify({ result }) {
    const t = result.set.targets[0];
    const ok = !t.reverted && !t.after.expressionError && !!result.read.items[0].value;
    return { ok, checks: [{ ok, label: `${RIG} › Anchor Point`, detail: ok ? `follows ${result.target} (now ${result.read.items[0].value.map(Math.round).join(', ')})` : (t.after.expressionError || 'no value') }] };
  },
  checkpoint({ result, ctx }) {
    return { compId: ctx.comp.id, createdRig: result.created ? result.rig.id : null, expression: { address: result.set.targets[0].address, expression: result.set.targets[0].before.expression, enabled: result.set.targets[0].before.expressionEnabled }, values: result.vals.items.filter((i) => !i.skipped).map((i) => ({ address: i.address, value: i.before })) };
  },
  async restore({ data, host }) {
    if (data.createdRig) return host.call('layers.remove', { compId: data.compId, layerIds: [data.createdRig], onlyNamed: RIG });
    await host.call('expressions.set', { compId: data.compId, label: 'MOE: Restore Zoom', revertOnError: false, targets: [data.expression] });
    return host.call('props.setValues', { compId: data.compId, label: 'MOE: Restore Zoom', items: data.values });
  },
  summarize(result) { return `Zoom follows ${result.target}`; }
};

/* ---------------- cursor ---------------- */

const cursor = {
  id: 'zoom.cursor',
  version: '1.0.0',
  category: 'motion',
  group: 'Zoom & Focus',
  name: 'Cursor Animator',
  description: 'Animated cursor (arrow or hand) that travels through click points with a press pulse, a ripple ring and a fade-out. Click points = the Position keyframes of the selected layer (key a null at each click).',
  keywords: ['cursor', 'mouse', 'click', 'pointer', 'hand', 'arrow', 'tutorial', 'ripple'],
  icon: 'cursor',
  params: {
    kind: { type: 'enum', label: 'Cursor', default: 'arrow', options: [{ value: 'arrow', label: 'Arrow' }, { value: 'hand', label: 'Hand' }] },
    size: { type: 'number', label: 'Size', min: 12, max: 160, step: 1, default: 36, unit: 'px' },
    color: { type: 'string', label: 'Colour', default: '#FFFFFF', maxLength: 7, format: 'color' },
    pulse: { type: 'boolean', label: 'Click pulse', default: true },
    travel: { type: 'number', label: 'Travel', min: 0.1, max: 3, step: 0.05, default: 0.45, unit: 's', advanced: true, description: 'Time to move to each click' }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers', 'modify.keyframes'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Create an animated mouse cursor following the click points (Position keys) of the selected layer.' },
  uses: { hostOps: ['keys.list', 'shapes.cursor', 'keys.write'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Create Cursor', lockedOk: true }, // reads the click points' keys only
  prepare(args, ctx) {
    if (!/^#[0-9a-fA-F]{6}$/.test(args.color || '')) return { ok: false, error: 'Colour must be #RRGGBB' };
    const L = (ctx.layers || []).find((l) => !/^MOE Cursor/.test(l.name));
    if (!L) return { ok: false, error: 'Select a layer whose Position keys mark the clicks' };
    return { ok: true, source: L, preview: { summary: `${args.kind === 'hand' ? 'Hand' : 'Arrow'} cursor through the Position keys of ${L.name}`, items: [] } };
  },
  async execute({ args, ctx, prepared, host }) {
    const src = await host.call('keys.list', { compId: ctx.comp.id, address: { layerId: prepared.source.id, matchNames: ['ADBE Transform Group', 'ADBE Position'] } });
    if (!src.keys.length) throw new Error(`"${prepared.source.name}" has no Position keyframes — add one key at each click point.`);
    if (src.parented) throw new Error(`"${prepared.source.name}" is parented — un-parent it so its keys are comp positions.`);
    const clicks = src.keys.map((k) => ({ t: k.t, p: [k.v[0], k.v[1]] }));
    const used = new Set((ctx.compLayers || []).map((l) => l.name));
    let n = 1;
    while (used.has(`MOE Cursor ${n}`)) n++;
    const col = hexToRgb(args.color);
    const outline = (col[0] + col[1] + col[2]) / 3 > 0.5 ? [0, 0, 0] : [1, 1, 1];
    const made = await host.call('shapes.cursor', { compId: ctx.comp.id, name: `MOE Cursor ${n}`, kind: args.kind, size: args.size, color: col, outline, position: clicks[0].p, inPoint: Math.max(0, clicks[0].t - 0.5), label: 2 });
    const plan = require('./math').cursorPlan(clicks, { travel: args.travel, pulse: args.pulse });
    const items = [{ address: made.addresses.position, keys: plan.pos, spatialLinear: true }, { address: made.addresses.opacity, keys: plan.fade }];
    if (args.pulse) items.push({ address: made.addresses.scale, keys: plan.scale }, { address: made.addresses.ringScale, keys: plan.ringS }, { address: made.addresses.ringOpacity, keys: plan.ringO });
    const keys = await host.call('keys.write', { compId: ctx.comp.id, label: 'MOE: Cursor', items });
    return { made, keys, clicks: clicks.length };
  },
  verify({ result }) {
    const pos = result.keys.items[0];
    return { ok: pos.written.length >= result.clicks, checks: [{ ok: true, label: result.made.name, detail: 'cursor shape layer created' }, ...result.keys.items.map((it) => ({ ok: it.written.length > 0, label: `${result.made.name} › ${it.name}`, detail: `${it.written.length} keys` }))] };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, layerId: result.made.layerId }; },
  async restore({ data, host }) { return host.call('layers.remove', { compId: data.compId, layerIds: [data.layerId], onlyNamed: 'MOE Cursor' }); },
  summarize(result) { return `${result.made.name}: ${result.clicks} click(s)`; }
};

module.exports = { focus, follow, cursor, followExpression, RIG };
