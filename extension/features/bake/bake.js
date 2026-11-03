'use strict';
/**
 * rig.bake (v0.42, docs/features/BAKE.md) — Bake to Keyframes: the live expressions of a MOE rig become plain
 * keyframes over the work area (or the whole comp), so the scene no longer needs MOE or its expressions, renders
 * lighter and opens anywhere. What it bakes:
 *   a MOE Grid null   → every MOE expression on its items (Position / Scale / Rotation / Opacity, clone colours)
 *   a MOE Trail null  → its copies
 *   any other layer   → its own MOE expressions (or every expression, with "Every expression")
 * All values are read first (bake.sample, while every rig is still live), then written (bake.write: LINEAR keys,
 * HOLD for checkboxes and menus); "smart" keeps only the keys a straight line needs (features/bake/plan.js).
 * Read-back re-reads the baked properties and compares them with the samples. Restore puts back each
 * property's expression and its own keyframes (saved by bake.write).
 */
const P = require('./plan');

const GRID = /^MOE Grid \d+$/;
const TRAIL = /^MOE Trail \d+$/;
const REASON = { TYPE: 'not a number, point or colour', SEPARATED: 'Position with separate dimensions', LOCKED: 'locked layer', TOO_MANY_KEYS: 'more than 1,000 keyframes under the expression' };

/** Which layers to scan, and with which tag, for the selection. */
function targetsOf(sel, compLayers, which) {
  const tag = which === 'all' ? '' : '// MOE';
  const layerIds = new Set(), trails = [];
  for (const L of sel) {
    if (GRID.test(L.name)) { layerIds.add(L.id); compLayers.filter((c) => c.parentId === L.id).forEach((c) => layerIds.add(c.id)); }
    else if (TRAIL.test(L.name)) trails.push(L.name);
    else layerIds.add(L.id);
  }
  return { tag, layerIds: [...layerIds], trails };
}

const fmt = (n) => Number(n).toLocaleString('en-US');

const bake = {
  id: 'rig.bake',
  version: '1.0.0',
  category: 'motion',
  group: 'Keyframes',
  name: 'Bake to Keyframes',
  description: 'Turn a MOE rig’s live expressions (grid, clones, effectors, trail, colours) into plain keyframes over the work area — a lighter scene that plays anywhere without MOE. Only the keys a straight line needs, or one per frame. Restore brings the expressions back.',
  keywords: ['bake', 'keyframes', 'convert expression', 'freeze', 'flatten', 'expression to keyframes', 'render', 'export', 'hand off', 'clean'],
  icon: 'bake',
  params: {
    range: { type: 'enum', label: 'Range', default: 'work', options: [{ value: 'work', label: 'Work area' }, { value: 'comp', label: 'Whole comp' }] },
    every: { type: 'integer', label: 'Sample every', min: 1, max: 10, default: 1, unit: 'frames', description: 'Read the expression every N frames (1 = every frame)' },
    keys: { type: 'enum', label: 'Keys', default: 'smart', options: [{ value: 'smart', label: 'Only what is needed' }, { value: 'every', label: 'One per sample' }], description: 'Smart keeps a key only where a straight line would miss the motion' },
    which: { type: 'enum', label: 'Bake', default: 'moe', options: [{ value: 'moe', label: 'MOE rigs' }, { value: 'all', label: 'Every expression' }], description: 'Every expression also bakes your own expressions on the selected layers' }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.keyframes', 'modify.expressions'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Convert MOE rig expressions (grid / clones / trail / effectors / colours) on the selection into keyframes. range work|comp, every 1-10 frames, keys smart|every, which moe|all.' },
  uses: { hostOps: ['layers.describe', 'bake.scan', 'bake.sample', 'bake.write', 'bake.restore'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Bake' },

  prepare(args, ctx) {
    const sel = ctx.layers || [];
    if (!sel.length) return { ok: false, error: 'Select a MOE Grid or Trail null, or the layers to bake' };
    const what = sel.map((L) => (GRID.test(L.name) ? `${L.name} (its items)` : TRAIL.test(L.name) ? `${L.name} (its copies)` : L.name));
    const c = ctx.comp || {};
    const range = args.range === 'comp' ? `the whole comp (${(c.duration || 0).toFixed(2)} s)` : 'the work area';
    return {
      ok: true,
      preview: {
        summary: `Bake ${what.slice(0, 3).join(', ')}${what.length > 3 ? ` +${what.length - 3}` : ''} over ${range}`,
        items: [
          args.which === 'all' ? 'Every live expression on these layers becomes keyframes' : 'MOE expressions become keyframes — your own expressions stay',
          args.keys === 'every' ? `A key every ${args.every} frame(s)` : `Read every ${args.every} frame(s); keys only where the motion bends — a value that never changes becomes a plain value`,
          'Outside the range the value holds its first / last key',
          'Restore brings back every expression and its own keyframes'
        ]
      }
    };
  },

  async execute({ args, ctx, host }) {
    const comp = ctx.comp;
    const desc = await host.call('layers.describe', { compId: comp.id });
    const T = targetsOf(ctx.layers || [], desc.layers, args.which);
    const scans = [];
    if (T.layerIds.length) scans.push(await host.call('bake.scan', { compId: comp.id, layerIds: T.layerIds, tag: T.tag }));
    for (const name of T.trails) scans.push(await host.call('bake.scan', { compId: comp.id, layerIds: desc.layers.map((l) => l.id), tag: `// MOE Trail · ${name}\n` }));
    const seen = new Set(), all = [];
    for (const s of scans) for (const p of s.props) { const k = JSON.stringify([p.address.layerId, p.address.matchNames, p.address.indices]); if (!seen.has(k)) { seen.add(k); all.push(p); } }
    const props = all.filter((p) => !p.reason), skipped = all.filter((p) => p.reason);
    if (!props.length) {
      throw Object.assign(new Error(skipped.length ? `Nothing can be baked: ${skipped.length} expression(s) skipped (${REASON[skipped[0].reason] || skipped[0].reason})` : `No ${args.which === 'all' ? '' : 'MOE '}expressions on the selection — select a MOE Grid or Trail null, or the rigged layers`), { code: 'NOTHING_TO_BAKE' });
    }
    const info = scans[0];
    const fd = info.frameDuration;
    const win = args.range === 'comp' ? { start: 0, duration: info.duration } : info.workArea;
    const times = P.timesFor({ start: win.start, duration: win.duration, fd, every: args.every });
    const frames = Math.max(1, Math.round(win.duration / fd));
    if (props.length * times.length > P.LIMITS.samples) {
      const e = P.everyFor(props.length, frames);
      throw Object.assign(new Error(`That is ${fmt(props.length * times.length)} values to read (${props.length} properties × ${times.length} frames) — the limit is ${fmt(P.LIMITS.samples)}. ${e ? `Set "Sample every" to ${e} frames` : 'Select fewer layers'} or shorten the work area.`), { code: 'TOO_BIG' });
    }
    // 1) read everything while every rig is still live
    const samples = [];
    for (const part of P.chunks(props, P.LIMITS.perCall, () => times.length)) {
      const r = await host.call('bake.sample', { compId: comp.id, times, items: part.map((p) => ({ address: p.address })) });
      samples.push(...r.items);
    }
    const bad = samples.findIndex((s) => !s.values || s.error);
    if (bad >= 0) throw Object.assign(new Error(`${props[bad].layerName} › ${props[bad].name}: the expression has an error (${samples[bad].error || 'no value'}) — fix it before baking`), { code: 'EXPRESSION_ERROR' });
    // 2) plan the keys
    const plans = props.map((p, i) => P.thin(times, samples[i].values, { tol: P.tolFor(p.valueType), hold: p.hold, mode: args.keys }));
    const keysTotal = plans.reduce((n, pl) => n + (pl.constant ? 0 : pl.times.length), 0);
    if (keysTotal > P.LIMITS.keys) throw Object.assign(new Error(`That is ${fmt(keysTotal)} keyframes — the limit is ${fmt(P.LIMITS.keys)}. Use "Only what is needed", a larger "Sample every", or a shorter work area.`), { code: 'TOO_BIG' });
    // 3) write, in pieces
    const items = props.map((p, i) => (plans[i].constant ? { address: p.address, constant: true, values: [plans[i].value], times: [] } : { address: p.address, times: plans[i].times, values: plans[i].values, hold: p.hold }));
    const written = [];
    for (const part of P.chunks(items, P.LIMITS.writePerCall, (it) => Math.max(1, it.times.length))) {
      const w = await host.call('bake.write', { compId: comp.id, label: 'MOE: Bake to Keyframes', items: part });
      written.push(...w.items);
    }
    // 4) read back at up to 12 of the sampled frames
    const pick = times.length <= 12 ? times.map((_, i) => i) : Array.from({ length: 12 }, (_, k) => Math.round(k * (times.length - 1) / 11));
    const back = [];
    for (const part of P.chunks(props, P.LIMITS.perCall, () => pick.length)) {
      const r = await host.call('bake.sample', { compId: comp.id, times: pick.map((i) => times[i]), items: part.map((p) => ({ address: p.address })) });
      back.push(...r.items);
    }
    let worst = 0, worstAt = null;
    props.forEach((p, i) => {
      if (written[i].skipped) return;
      pick.forEach((ti, k) => {
        const d = back[i].values ? P.diff(back[i].values[k], samples[i].values[ti]) / P.tolFor(p.valueType) : Infinity;
        if (d > worst) { worst = d; worstAt = `${p.layerName} › ${p.name} at ${times[ti].toFixed(2)} s`; }
      });
    });
    return {
      props: props.map((p, i) => ({ layerName: p.layerName, name: p.name, valueType: p.valueType, keyedBefore: p.keyed, planned: plans[i].constant ? 0 : plans[i].times.length })),
      skipped: skipped.map((p) => ({ layerName: p.layerName, name: p.name, reason: p.reason })),
      layers: new Set(props.map((p) => p.address.layerId)).size,
      times: { start: times[0], end: times[times.length - 1], count: times.length, every: args.every },
      written, keysTotal, constants: plans.filter((pl) => pl.constant).length,
      readBack: { frames: pick.length, worst, worstAt }
    };
  },

  verify({ result }) {
    const checks = [];
    const w = result.written;
    const failed = w.filter((x) => x.skipped);
    const exprLeft = w.filter((x) => !x.skipped && x.expression !== '');
    const keysOff = w.filter((x, i) => !x.skipped && x.numKeys !== result.props[i].planned);
    checks.push({ ok: failed.length === 0, label: 'Baked', detail: failed.length ? `${failed.length} propert(ies) not baked: ${failed[0].error || failed[0].skipped}` : `${w.length} propert(ies) on ${result.layers} layer(s) · ${fmt(result.keysTotal)} keyframes · ${result.constants} became plain values` });
    checks.push({ ok: exprLeft.length === 0 && keysOff.length === 0, label: 'Expressions', detail: exprLeft.length ? `${exprLeft.length} still have an expression` : keysOff.length ? `${keysOff.length} have a different number of keys than planned` : 'removed from every baked property' });
    // worst is in units of the tolerance (≤ 1 = within it)
    const rb = result.readBack;
    checks.push({ ok: rb.worst <= 1.0001, label: 'Read-back', detail: rb.worst <= 1.0001 ? `${rb.frames} frames re-read: every value matches the live expression (within ${P.TOL.base} · colour ${P.TOL.COLOR})` : `${rb.worstAt} differs by ${rb.worst.toFixed(1)}× the tolerance` });
    if (result.skipped.length) checks.push({ ok: true, label: 'Skipped', detail: `${result.skipped.length} expression(s) left live: ${result.skipped.slice(0, 2).map((s) => `${s.layerName} › ${s.name} (${REASON[s.reason] || s.reason})`).join(', ')}` });
    const under = result.props.filter((p) => p.keyedBefore > 0).length;
    if (under) checks.push({ ok: true, label: 'Saved', detail: `${under} propert(ies) had keyframes under the expression — kept for Restore` });
    return { ok: checks.every((c) => c.ok), checks };
  },

  checkpoint({ result, ctx }) {
    return { compId: ctx.comp.id, items: result.written.filter((x) => !x.skipped).map((x) => ({ address: x.address, before: x.before })) };
  },

  async restore({ data, host }) {
    for (const part of P.chunks(data.items, 400)) await host.call('bake.restore', { compId: data.compId, items: part });
    return { ok: true };
  },

  summarize(result, v) { return v.ok ? `Baked ${result.written.length} propert(ies) on ${result.layers} layer(s) · ${fmt(result.keysTotal)} keys` : 'Bake finished with problems'; }
};

module.exports = { bake, targetsOf };
