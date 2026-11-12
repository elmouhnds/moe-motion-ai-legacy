'use strict';
/**
 * Tune After (v0.79, docs/features/TUNE_AFTER.md):
 *   motion.retime       stretch the keys of the selected properties in time, the ease kept (plan.scale)
 *   motion.copyMotion   read one layer's Transform keys + expressions into the clip (read-only)
 *   motion.pasteMotion  write the clip on the selected layers, at the playhead; Position keeps each layer's place
 * Keys are rebuilt from a snapshot (keys.rebuild), not keys.write: a snapshot carries spatial tangents and per-key
 * interpolation that keys.write cannot — the times are snapped to the frame grid here (core/framegrid via plan.js).
 */
const P = require('./plan');

const CLIP_KEY = 'motion-clip';
const CLIP_MAX = 200000;
const fdOf = (ctx) => ctx.comp.frameDuration || (1 / (ctx.comp.frameRate || 25));
const near = (a, b, fd) => Math.abs(a - b) < fd * 0.51;

const retime = {
  id: 'motion.retime', version: '1.0.0', category: 'motion', group: 'Timing', name: 'Retime Keys',
  description: 'Make a keyed move faster or slower: every key keeps its ease, the times stretch around the first key and land on frames.',
  keywords: ['retime', 'stretch', 'speed up', 'slow down', 'duration', 'time stretch keys', 'scale keys'], icon: 'clock',
  params: { percent: { type: 'number', label: 'Length', min: 10, max: 400, step: 5, default: 75, unit: '%', description: '100 % = as it is; 50 % = twice as fast' } },
  requires: { comp: true }, permissions: ['modify.keyframes'], recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Stretch the selected keyed properties in time by a percentage, keeping the ease.' },
  uses: { hostOps: ['keys.snapshot', 'keys.rebuild'], network: false }, compatibility: { minAE: '25.0' }, ui: { primaryLabel: 'Retime' },
  prepare(args, ctx) {
    const t = (ctx.properties || []).filter((p) => p.numKeys >= 2).map((p) => ({ address: p.address, name: p.name }));
    if (!t.length) return { ok: false, error: 'Select properties (or keys) that have two keys or more' };
    if (args.percent === 100) return { ok: false, error: '100 % changes nothing — drag the number' };
    return { ok: true, targets: t, preview: { summary: `${args.percent} % of the length on ${t.length} propert${t.length === 1 ? 'y' : 'ies'} · ease kept`, items: t.map((x) => x.name) } };
  },
  async execute({ args, ctx, prepared, host }) {
    const fd = fdOf(ctx);
    const read = await host.call('keys.snapshot', { compId: ctx.comp.id, items: prepared.targets.map((t) => ({ address: t.address })) });
    const items = read.items.map((it) => {
      const sc = P.scale(it.snapshot, args.percent / 100, it.snapshot.length ? it.snapshot[0].t : 0, fd);
      return { address: it.address, name: it.name, layerName: it.layerName, before: it.snapshot, after: sc.ok ? sc.snapshot : null, skipped: sc.ok ? '' : sc.error };
    });
    const write = items.filter((i) => i.after);
    if (!write.length) return { items, fd }; // nothing written: every property refused (too short)
    await host.call('keys.rebuild', { compId: ctx.comp.id, items: write.map((i) => ({ address: i.address, snapshot: i.after })) });
    const back = await host.call('keys.snapshot', { compId: ctx.comp.id, items: write.map((i) => ({ address: i.address })) });
    write.forEach((i, n) => { i.read = back.items[n].snapshot; });
    return { items, fd };
  },
  verify({ result }) {
    const checks = result.items.map((i) => {
      const label = i.layerName ? `${i.layerName} › ${i.name}` : i.name;
      if (!i.after) return { ok: false, label, detail: i.skipped };
      const ok = i.read && i.read.length === i.after.length && i.read.every((k, n) => near(k.t, i.after[n].t, result.fd));
      return { ok, label, detail: ok ? `${i.read.length} keys · ${(i.after[i.after.length - 1].t - i.after[0].t).toFixed(2)} s (was ${(i.before[i.before.length - 1].t - i.before[0].t).toFixed(2)} s)` : 'the keys read back do not match the plan' };
    });
    return { ok: checks.some((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, items: result.items.filter((i) => i.after).map((i) => ({ address: i.address, snapshot: i.before })) }; },
  async restore({ data, host }) { return host.call('keys.rebuild', data); },
  summarize(result) { const n = result.items.filter((i) => i.after).length, s = result.items.length - n; return `Retimed ${n} propert${n === 1 ? 'y' : 'ies'}${s ? ` · ${s} skipped (too short)` : ''}`; }
};

/** The clip as text (untrusted when it comes back): { from, props: [{ matchNames, name, isSpatial, snapshot, expression }] } */
function parseClip(text) {
  if (!text) return { error: 'Nothing copied yet — select the layer that moves and press Copy Motion' };
  if (text.length > CLIP_MAX) return { error: 'The copied motion is too large' };
  let c; try { c = JSON.parse(text); } catch (e) { return { error: 'The copied motion cannot be read' }; }
  if (!c || !Array.isArray(c.props) || !c.props.length) return { error: 'The copied motion is empty' };
  const props = c.props.filter((p) => p && Array.isArray(p.matchNames) && p.matchNames[0] === 'ADBE Transform Group' && p.matchNames.length === 2 && p.matchNames.every((m) => typeof m === 'string' && m.length < 80) && Array.isArray(p.snapshot) && typeof (p.expression || '') === 'string');
  if (!props.length) return { error: 'The copied motion has nothing a layer can take' };
  return { from: String(c.from || 'a layer').slice(0, 80), props };
}

const copyMotion = {
  id: 'motion.copyMotion', version: '1.0.0', category: 'motion', group: 'Timing', name: 'Copy Motion',
  description: 'Copy how a layer moves: the keys (with their ease and paths) and expressions of its Position, Scale, Rotation, Opacity and Anchor Point.',
  keywords: ['copy motion', 'copy animation', 'copy keys', 'same move', 'transfer animation'], icon: 'copy',
  params: {}, requires: { comp: true, minLayers: 1, maxLayers: 1 }, permissions: ['read'], recovery: 'none',
  ai: { callable: false }, uses: { hostOps: ['keys.snapshot'], network: false }, compatibility: { minAE: '25.0' }, ui: { primaryLabel: 'Copy Motion', lockedOk: true },
  prepare(args, ctx) {
    const L = (ctx.layers || [])[0];
    return L ? { ok: true, layer: L, preview: { summary: `Copy the motion of ${L.name}`, items: ['Transform keys, ease, paths and expressions'] } } : { ok: false, error: 'Select the one layer whose motion you want' };
  },
  async execute({ ctx, prepared, host, services }) {
    const r = await host.call('keys.snapshot', { compId: ctx.comp.id, layerIds: [prepared.layer.id], group: 'transform' });
    const props = r.items.map((i) => ({ matchNames: i.address.matchNames, name: i.name, isSpatial: i.isSpatial, snapshot: i.snapshot, expression: i.expression }));
    const text = JSON.stringify({ from: prepared.layer.name, props });
    if (props.length && text.length <= CLIP_MAX) services.store.set(CLIP_KEY, text);
    const kept = parseClip(services.store.get(CLIP_KEY, '')); // read back what was kept (verify gets no services)
    return { kept: !kept.error && kept.from === prepared.layer.name && kept.props.length === props.length, from: prepared.layer.name, props: props.map((p) => ({ name: p.name, keys: p.snapshot.length, expression: !!p.expression })), tooLarge: text.length > CLIP_MAX };
  },
  verify({ result }) {
    const ok = !result.tooLarge && result.props.length > 0 && result.kept;
    return { ok, checks: [{ ok, label: result.from, detail: result.tooLarge ? 'too many keys to copy' : result.props.length ? result.props.map((p) => `${p.name} ${p.keys ? `${p.keys} keys` : ''}${p.expression ? ' expr' : ''}`.trim()).join(' · ') : 'this layer has no Transform keys or expressions' }] };
  },
  summarize(result) { return `Motion of ${result.from} copied (${result.props.length} propert${result.props.length === 1 ? 'y' : 'ies'}) — select layers and Paste Motion`; }
};

const pasteMotion = {
  id: 'motion.pasteMotion', version: '1.0.0', category: 'motion', group: 'Timing', name: 'Paste Motion',
  description: 'Give the selected layers the copied motion, starting at the playhead. Position keeps each layer where it is — the move is pasted, not the place.',
  keywords: ['paste motion', 'paste animation', 'apply same move', 'transfer animation'], icon: 'kPaste',
  params: {
    clip: { type: 'string', label: 'Copied motion', maxLength: CLIP_MAX, hidden: true, description: 'Filled from Copy Motion' },
    expressions: { type: 'boolean', label: 'Expressions too', default: true }
  },
  requires: { comp: true, minLayers: 1 }, permissions: ['modify.keyframes', 'modify.expressions'], recovery: 'undo+checkpoint',
  ai: { callable: false }, uses: { hostOps: ['keys.snapshot', 'keys.rebuild', 'expressions.set'], network: false }, compatibility: { minAE: '25.0' }, ui: { primaryLabel: 'Paste Motion' },
  prepare(args, ctx, services) {
    const c = parseClip(args.clip || (services && services.store ? services.store.get(CLIP_KEY, '') : ''));
    if (c.error) return { ok: false, error: c.error };
    const layers = (ctx.layers || []);
    if (!layers.length) return { ok: false, error: 'Select the layers that should move the same way' };
    const keyed = c.props.filter((p) => p.snapshot.length).length, ex = c.props.filter((p) => p.expression).length;
    return { ok: true, clip: c, layers, preview: { summary: `${c.from} → ${layers.length} layer${layers.length === 1 ? '' : 's'} at the playhead · ${keyed} keyed propert${keyed === 1 ? 'y' : 'ies'}${ex && args.expressions !== false ? ` · ${ex} expression${ex === 1 ? '' : 's'}` : ''}`,
      items: c.props.map((p) => p.name), warnings: ['Keys already on those properties are replaced (one Ctrl+Z, or Restore, brings them back)'] } };
  },
  async execute({ args, ctx, prepared, host }) {
    const fd = fdOf(ctx), start = ctx.comp.time;
    const targets = [];
    prepared.layers.forEach((L) => prepared.clip.props.forEach((p) => targets.push({ layer: L, p, address: { layerId: L.id, layerIndex: L.index, matchNames: p.matchNames } })));
    const before = await host.call('keys.snapshot', { compId: ctx.comp.id, items: targets.map((t) => ({ address: t.address })) });
    const items = targets.map((t, i) => {
      const b = before.items[i];
      const isPos = t.p.matchNames[1] === 'ADBE Position';
      const delta = isPos && t.p.snapshot.length ? P.positionDelta(t.p.snapshot[0].v, b.value) : null;
      if (isPos && t.p.snapshot.length && !delta) return { address: t.address, layerName: t.layer.name, name: t.p.name, before: b.snapshot, beforeExpr: b.expression, skipped: 'Position has other dimensions here (separated or 3D)' };
      const after = t.p.snapshot.length ? P.place(t.p.snapshot, start, fd, delta) : null;
      return { address: t.address, layerName: t.layer.name, name: t.p.name, before: b.snapshot, beforeExpr: b.expression, after, expr: args.expressions !== false && t.p.expression ? t.p.expression : '' };
    });
    const keyed = items.filter((i) => i.after);
    if (keyed.length) await host.call('keys.rebuild', { compId: ctx.comp.id, items: keyed.map((i) => ({ address: i.address, snapshot: i.after })) });
    const exprs = items.filter((i) => i.expr);
    if (exprs.length) await host.call('expressions.set', { compId: ctx.comp.id, label: 'MOE: Paste Motion', targets: exprs.map((i) => ({ address: i.address, expression: i.expr, enabled: true })), revertOnError: false });
    const done = items.filter((i) => i.after || i.expr);
    if (done.length) { const back = await host.call('keys.snapshot', { compId: ctx.comp.id, items: done.map((i) => ({ address: i.address })) }); done.forEach((i, n) => { i.read = back.items[n].snapshot; i.readExpr = back.items[n].expression; }); }
    return { items, fd, from: prepared.clip.from };
  },
  verify({ result }) {
    const checks = result.items.map((i) => {
      const label = `${i.layerName} › ${i.name}`;
      if (i.skipped) return { ok: false, label, detail: i.skipped };
      if (!i.after && !i.expr) return { ok: true, label, detail: 'nothing to paste here' };
      const keysOk = !i.after || (i.read && i.read.length === i.after.length && i.read.every((k, n) => near(k.t, i.after[n].t, result.fd)));
      const exprOk = !i.expr || (i.readExpr || '').length > 0;
      return { ok: keysOk && exprOk, label, detail: keysOk && exprOk ? `${i.after ? `${i.after.length} keys` : ''}${i.after && i.expr ? ' + ' : ''}${i.expr ? 'expression' : ''}` : 'read back differs from what was pasted' };
    });
    return { ok: checks.some((c) => c.ok) && !checks.some((c) => !c.ok && !/dimensions/.test(c.detail)), checks };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, items: result.items.filter((i) => i.after || i.expr).map((i) => ({ address: i.address, snapshot: i.before, expression: i.beforeExpr, hadExpr: !!i.expr })) }; },
  async restore({ data, host }) {
    const ex = data.items.filter((i) => i.hadExpr);
    if (ex.length) await host.call('expressions.set', { compId: data.compId, label: 'MOE: Restore', targets: ex.map((i) => ({ address: i.address, expression: i.expression || '', enabled: !!i.expression })), revertOnError: false });
    return host.call('keys.rebuild', { compId: data.compId, items: data.items.map((i) => ({ address: i.address, snapshot: i.snapshot })) });
  },
  summarize(result) { const L = new Set(result.items.filter((i) => i.after || i.expr).map((i) => i.layerName)).size; const sk = result.items.filter((i) => i.skipped).length; return `Motion of ${result.from} pasted on ${L} layer${L === 1 ? '' : 's'}${sk ? ` · ${sk} skipped` : ''}`; }
};

module.exports = { retime, copyMotion, pasteMotion, parseClip, CLIP_KEY, CLIP_MAX };
