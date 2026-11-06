'use strict';
/**
 * Click on Layer (v0.60, docs/features/SAAS_INTERACTION.md): select the UI layers in the order they are clicked —
 * a cursor travels to each one, settles, presses with a ripple, and the layer answers the press.
 *
 * Precise in After Effects:
 *  - every click point is the target's VISUAL centre measured by After Effects at that click's own time
 *    (layers.bounds → sourceRectAtTime + toComp), so parents, scale, rotation and its own animation are counted;
 *  - the press scales the layer around that centre, not around its anchor: Position gets the matching offset
 *    (P + (1 − f)(C − P)), so a text with its anchor on the baseline still presses in place;
 *  - the press is keyed on top of the layer's own Scale / Position at each key time, so an animation keeps playing;
 *  - the cursor's arrival is read back from After Effects and compared with each measured centre.
 * Restore removes the cursor layer and exactly the keys written on the targets.
 */
const P = require('./clickPlan');
const ADDR = (id, mn) => ({ layerId: id, matchNames: ['ADBE Transform Group', mn] });
const keyRestore = (items) => items.map((it) => ({ address: it.address, times: it.written.map((w) => w.t), restore: it.replaced }));
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const centre = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
const usable = (b) => b && b.length === 4 && b[2] - b[0] > 0.5 && b[3] - b[1] > 0.5 && b.every(Number.isFinite);

const click = {
  id: 'interact.click', version: '1.0.0', category: 'motion', group: 'Zoom & Focus', name: 'Click on Layer',
  description: 'Select UI layers in the order they are clicked: a cursor travels to each one\'s real centre (measured by After Effects at that moment), settles, presses with a ripple — and the layer presses with it, in place, on top of its own animation.',
  keywords: ['click', 'cursor', 'tap', 'press', 'button', 'ui', 'saas', 'product', 'demo', 'mouse', 'interaction', 'ضغط', 'كليك', 'ماوس'],
  icon: 'cursor',
  params: {
    kind: { type: 'enum', label: 'Cursor', default: 'arrow', options: [{ value: 'arrow', label: 'Arrow' }, { value: 'hand', label: 'Hand (tap)' }] },
    from: { type: 'enum', label: 'Comes from', default: 'corner', options: [{ value: 'corner', label: 'Bottom-right, off frame' }, { value: 'side', label: 'The right edge' }, { value: 'center', label: 'The centre (fades in)' }] },
    gap: { type: 'number', label: 'Between clicks', min: 0.4, max: 10, step: 0.05, default: 1.1, unit: 's' },
    travel: { type: 'number', label: 'Travel', min: 0.15, max: 3, step: 0.05, default: 0.55, unit: 's', description: 'Time the cursor takes to reach a target' },
    depth: { type: 'number', label: 'Press', min: 70, max: 100, step: 1, default: 94, unit: '%', description: 'How far the layer goes down under the click (100 = it does not move)' },
    ripple: { type: 'boolean', label: 'Ripple', default: true },
    size: { type: 'number', label: 'Size', min: 12, max: 160, step: 1, default: 40, unit: 'px', advanced: true },
    color: { type: 'string', label: 'Colour', default: '#FFFFFF', maxLength: 7, format: 'color', advanced: true }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers', 'modify.keyframes'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Animate a cursor clicking the selected layers in selection order; each layer presses in place (depth %).' },
  uses: { hostOps: ['layers.describe', 'layers.bounds', 'props.values', 'shapes.cursor', 'keys.write', 'keys.remove', 'layers.remove'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Click' },
  prepare(args, ctx) {
    if (!/^#[0-9a-fA-F]{6}$/.test(args.color || '')) return { ok: false, error: 'Colour must be #RRGGBB' };
    const all = (ctx.layers || []).filter((l) => !/^MOE Cursor/.test(l.name) && !['camera', 'light', 'audio', 'null'].includes(l.type));
    // a locked layer is never changed (AE Panel Study, rule 9): say so before anything happens
    const t = all.filter((l) => !l.locked), locked = all.filter((l) => l.locked);
    if (!t.length) return { ok: false, error: locked.length ? `${locked.map((l) => l.name).join(', ')} ${locked.length > 1 ? 'are' : 'is'} locked — unlock to click ${locked.length > 1 ? 'them' : 'it'}` : 'Select the layers to click, in the order they are clicked' };
    if (t.length > P.LIMITS.targets) return { ok: false, error: `At most ${P.LIMITS.targets} clicks at a time` };
    return { ok: true, targets: t, locked: locked.map((l) => l.name), preview: { summary: `${t.length} click(s): ${t.map((l) => l.name).join(' → ')}${locked.length ? ` · skips locked ${locked.map((l) => l.name).join(', ')}` : ''}`, items: [] } };
  },
  async execute({ args, ctx, prepared, host }) {
    const comp = ctx.comp;
    const desc = await host.call('layers.describe', { compId: comp.id });
    const D = (id) => desc.layers.find((x) => x.id === id) || {};
    // measure each target at its own click time; a target with nothing visible then is skipped and the rest re-timed
    let targets = prepared.targets, T, boxes;
    const skipped = (prepared.locked || []).map((n) => `${n} (locked — not changed)`);
    for (let pass = 0; pass < 2; pass++) {
      T = P.times(targets.length, { time: comp.time, travel: args.travel, gap: args.gap, fd: comp.frameDuration });
      const m = await host.call('layers.bounds', { compId: comp.id, layerIds: targets.map((l) => l.id), times: T });
      boxes = targets.map((l, i) => { const r = m.layers.find((x) => x.layerId === l.id); return r && r.boxes[i]; });
      const bad = targets.filter((_, i) => !usable(boxes[i]));
      if (!bad.length) break;
      bad.forEach((l) => skipped.push(`${l.name} (nothing visible at its click)`));
      targets = targets.filter((_, i) => usable(boxes[i]));
      if (!targets.length) throw new Error(`Nothing to click: ${skipped.join(', ')}`);
    }
    const clicks = targets.map((l, i) => ({ t: T[i], p: centre(boxes[i]), layerId: l.id, name: l.name }));
    const pl = P.plan(clicks, { from: args.from, W: comp.width, H: comp.height, travel: args.travel, gap: args.gap, depth: args.depth, ripple: args.ripple, fd: comp.frameDuration });

    // the targets press around their measured centre, on top of their own Scale / Position.
    // v0.61: every own value (all targets, all press keys) is read in ONE host call, at the frame of each key.
    const items = [], notes = [];
    const pressing = [];
    for (const c of clicks) {
      const d = D(c.layerId);
      if (d.scaleExpr) { notes.push(`${c.name}: Scale has an expression — clicked, not pressed`); continue; }
      if (args.depth >= 100) continue;
      const comp2d = !!(!d.parentId && !d.threeD && !d.posExpr && d.transform && d.transform.position);
      if (!comp2d) { const why = d.parentId ? 'parented' : d.threeD ? '3D' : d.posExpr ? 'Position has an expression' : 'Position is separated'; notes.push(`${c.name}: ${why} — presses around its anchor point`); }
      pressing.push({ c, comp2d });
    }
    const reads = [];
    pressing.forEach((x) => {
      if (x.comp2d) reads.push({ address: ADDR(x.c.layerId, 'ADBE Position'), time: x.c.t });
      pl.press.forEach((k) => { reads.push({ address: ADDR(x.c.layerId, 'ADBE Scale'), time: x.c.t + k.t }); if (x.comp2d) reads.push({ address: ADDR(x.c.layerId, 'ADBE Position'), time: x.c.t + k.t }); });
    });
    const vals = reads.length ? (await host.call('props.values', { compId: comp.id, items: reads })).items.map((r) => r.value) : [];
    let q = 0;
    const EASE = { easeIn: { speed: 0, influence: 60 }, easeOut: { speed: 0, influence: 60 } };
    for (const x of pressing) {
      const c = x.c;
      let lever = null;
      if (x.comp2d) { const p0 = vals[q++]; lever = [c.p[0] - p0[0], c.p[1] - p0[1]]; if (Math.hypot(lever[0], lever[1]) < 0.5) lever = null; }
      const sk = [], pk = [];
      for (const k of pl.press) {
        const t = c.t + k.t, sv = vals[q++], pv = x.comp2d ? vals[q++] : null;
        sk.push(Object.assign({ t, v: sv.map((v, j) => (j < 2 ? v * k.f : v)) }, EASE));
        if (lever) pk.push(Object.assign({ t, v: [pv[0] + (1 - k.f) * lever[0], pv[1] + (1 - k.f) * lever[1]].concat(pv.slice(2)) }, EASE));
      }
      items.push({ address: ADDR(c.layerId, 'ADBE Scale'), keys: sk });
      if (pk.length) items.push({ address: ADDR(c.layerId, 'ADBE Position'), keys: pk, spatialLinear: true });
    }

    const used = new Set((desc.layers || []).map((l) => l.name));
    let n = 1;
    while (used.has(`MOE Cursor ${n}`)) n++;
    const col = hexToRgb(args.color);
    const outline = (col[0] + col[1] + col[2]) / 3 > 0.5 ? [0, 0, 0] : [1, 1, 1];
    const made = await host.call('shapes.cursor', { compId: comp.id, name: `MOE Cursor ${n}`, kind: args.kind, size: args.size, color: col, outline, position: pl.pos[0].v, inPoint: Math.max(0, pl.start), outPoint: pl.end + 0.05, label: 'MOE: Click on Layer' });
    const cur = [{ address: made.addresses.position, keys: pl.pos, spatialLinear: true }, { address: made.addresses.opacity, keys: pl.opacity }, { address: made.addresses.scale, keys: pl.scale }];
    if (args.ripple) cur.push({ address: made.addresses.ringScale, keys: pl.ringS }, { address: made.addresses.ringOpacity, keys: pl.ringO });
    let keys;
    try {
      keys = await host.call('keys.write', { compId: comp.id, label: 'MOE: Click on Layer', items: cur.concat(items) });
    } catch (e) {
      await host.call('layers.remove', { compId: comp.id, layerIds: [made.layerId], onlyNamed: 'MOE Cursor' }); // nothing half-made stays
      throw e;
    }
    // read back: where After Effects puts the cursor at each click
    const back = (await host.call('props.values', { compId: comp.id, items: clicks.map((c) => ({ address: made.addresses.position, time: c.t })) })).items.map((r) => r.value);
    return { made, keys, press: pl.press, clicks: clicks.map((c, i) => ({ layerId: c.layerId, name: c.name, t: c.t, p: c.p, got: back[i] })), targetItems: keys.items.slice(cur.length), skipped, notes };
  },
  verify({ result }) {
    const checks = [{ ok: true, label: result.made.name, detail: 'cursor shape layer created' }];
    for (const c of result.clicks) {
      const d = c.got ? Math.hypot(c.got[0] - c.p[0], c.got[1] - c.p[1]) : Infinity;
      checks.push({ ok: d < 1, label: `Click ${c.name}`, detail: `${c.t.toFixed(2)} s at ${c.p.map((x) => Math.round(x)).join(', ')}${d < 1 ? '' : ` — the cursor is ${d.toFixed(1)} px away`}` });
    }
    for (const it of result.targetItems) checks.push({ ok: it.written.length >= 4, label: `${it.layerName} › ${it.name}`, detail: `${it.written.length} press keys` });
    for (const s of result.skipped) checks.push({ ok: true, label: 'Skipped', detail: s });
    for (const s of result.notes) checks.push({ ok: true, label: 'Note', detail: s });
    return { ok: checks.every((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, layerId: result.made.layerId, items: keyRestore(result.targetItems) }; },
  async restore({ data, host }) {
    if (data.items.length) await host.call('keys.remove', { compId: data.compId, items: data.items });
    return host.call('layers.remove', { compId: data.compId, layerIds: [data.layerId], onlyNamed: 'MOE Cursor' });
  },
  summarize(result) { return `${result.made.name}: ${result.clicks.length} click(s)`; }
};

module.exports = { click };
