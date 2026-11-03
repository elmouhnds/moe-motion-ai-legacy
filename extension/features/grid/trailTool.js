'use strict';
/**
 * grid.trail (v0.41, docs/features/CLONE_TRAILS.md) — Clone Trail: copies of the selected animated layer that
 * play its motion later, fading / shrinking / turning per copy. Copies are plain duplicates ("MOE Clone n · <layer>",
 * below the source, unparented) whose Position / Scale / Rotation / Opacity read the source through expressions
 * tagged "// MOE Trail"; "MOE Trail N" (a null at the source) holds Delay / Fade / Scale Step / Rotate Step.
 * Read-back compares every copy with features/grid/trail.js. Restore removes the copies and the null.
 */
const TR = require('./trail');
const X = require('./expressions');

const POS = ['ADBE Transform Group', 'ADBE Position'];
const PROPS = { position: POS, scale: ['ADBE Transform Group', 'ADBE Scale'], rotation: ['ADBE Transform Group', 'ADBE Rotate Z'], opacity: ['ADBE Transform Group', 'ADBE Opacity'] };
const NO_TRAIL = new Set(['camera', 'light', 'null']);

function nextName(ctx) {
  const used = new Set((ctx.compLayers || []).map((l) => l.name));
  let n = 1;
  while (used.has(TR.NAME(n))) n++;
  return TR.NAME(n);
}
const ctlItems = (v) => TR.CONTROLS.map(([name, kind, def]) => {
  const K = X.KIND[kind];
  const value = v[TR.KEY[name]] !== undefined ? Number(v[TR.KEY[name]]) : def;
  return { key: name, matchName: K.matchName, before: [], params: [{ id: name, value, names: [K.param], suffix: 1, nth: { type: K.type, n: 1 } }] };
});

const trail = {
  id: 'grid.trail',
  version: '1.0.0',
  category: 'layout',
  group: 'Grid',
  name: 'Clone Trail',
  description: 'Copies of the selected animated layer that play its motion a little later — an echo trail that fades, shrinks or turns copy by copy. Delay, Fade, Scale Step and Rotate Step stay live on one MOE Trail null.',
  keywords: ['trail', 'echo', 'ghost', 'motion trail', 'delay', 'copies', 'follow', 'snake', 'clone', 'afterimage'],
  icon: 'copy',
  params: {
    copies: { type: 'integer', label: 'Copies', min: 2, max: 60, default: 8 },
    delay: { type: 'number', label: 'Delay', min: 0, max: 60, step: 0.5, default: 3, unit: 'frames', description: 'Each copy plays the motion this much later' },
    fade: { type: 'number', label: 'Fade', min: 0, max: 100, step: 1, default: 20, unit: '%', description: 'Each copy is this much more transparent than the one before' },
    scaleStep: { type: 'number', label: 'Scale step', min: -50, max: 50, step: 1, default: 6, unit: '%', description: 'Each copy is this much smaller (negative = bigger)' },
    rotateStep: { type: 'number', label: 'Rotate step', min: -180, max: 180, step: 1, default: 0, unit: '°', description: 'Each copy turns this much more' }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers', 'modify.effects', 'modify.expressions'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Echo / motion trail of ONE selected animated layer: copies that replay its motion later. copies 2-60, delay frames, fade % per copy, scaleStep % per copy, rotateStep deg per copy.' },
  uses: { hostOps: ['layers.createNull', 'effects.ensure', 'layers.clone', 'layers.setParent', 'expressions.set', 'props.values', 'layers.remove'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Make Trail' },

  prepare(args, ctx) {
    const sel = ctx.layers || [];
    if (sel.length !== 1) return { ok: false, error: 'Select one animated layer to trail' };
    const src = sel[0];
    if (NO_TRAIL.has(src.type)) return { ok: false, error: `${src.name} is a ${src.type} — a trail needs a layer you can see` };
    if (/^MOE (Clone|Trail) /.test(src.name)) return { ok: false, error: `${src.name} is already part of a trail or clone — select the original layer` };
    if (src.locked) return { ok: false, error: `Unlock ${src.name} first` };
    if ((ctx.compLayers || []).filter((l) => l.name === src.name).length > 1) return { ok: false, error: `Two layers are named "${src.name}" — rename one (the trail finds its source by name)` };
    const name = nextName(ctx);
    return {
      ok: true, src, name,
      preview: {
        summary: `${args.copies} copies of ${src.name} · ${args.delay} frames apart · ${name}`,
        items: [`Fade ${args.fade} % · scale ${args.scaleStep > 0 ? '−' : '+'}${Math.abs(args.scaleStep)} % · turn ${args.rotateStep}° per copy`, 'Copies are "MOE Clone n · <layer>" below it (removed on Restore)', `Delay, Fade, Scale Step and Rotate Step stay live on ${name}`, 'Animate the layer itself — the trail follows (no keyframes on the copies)']
      }
    };
  },

  async execute({ args, ctx, prepared, host }) {
    const comp = ctx.comp, src = prepared.src;
    const pos0 = (await host.call('props.values', { compId: comp.id, time: comp.time, items: [{ address: { layerId: src.id, matchNames: POS } }] })).items[0];
    const nul = await host.call('layers.createNull', { compId: comp.id, name: prepared.name, position: pos0.value ? [pos0.value[0], pos0.value[1]] : [comp.width / 2, comp.height / 2], anchor: [0, 0], label: 11, threeD: false, undoLabel: 'MOE: Trail Null' });
    const controls = await host.call('effects.ensure', { compId: comp.id, label: 'MOE: Trail Controls', layers: [{ layer: { layerId: nul.layerId }, items: ctlItems(args) }] });
    const made = await host.call('layers.clone', { compId: comp.id, label: 'MOE: Trail Copies', layerId: src.id, plain: true, items: Array.from({ length: args.copies }, () => ({})) });
    const copies = made.created.map((c) => c.layerId);
    // the copies read the source in comp space: no parent
    const unparented = await host.call('layers.setParent', { compId: comp.id, label: 'MOE: Trail Copies', items: copies.map((id) => ({ layerId: id, parentId: null })) });
    const targets = [];
    copies.forEach((id, i) => { const ex = TR.code(i + 1, src.name, prepared.name); for (const p of Object.keys(PROPS)) targets.push({ address: { layerId: id, matchNames: PROPS[p] }, expression: ex[p], enabled: true }); });
    const set = await host.call('expressions.set', { compId: comp.id, label: 'MOE: Trail', revertOnError: true, targets });
    // read back one second in: every copy against trail.js, with the source read at each copy's own time
    const t = comp.time + 1, fd = comp.frameDuration;
    const c = { delay: args.delay, fade: args.fade, scaleStep: args.scaleStep, rotateStep: args.rotateStep };
    const srcTimes = copies.map((_, i) => TR.timeOf(i + 1, c.delay, t, fd));
    const srcRead = [];
    for (const tt of srcTimes) srcRead.push((await host.call('props.values', { compId: comp.id, time: tt, items: Object.values(PROPS).map((m) => ({ address: { layerId: src.id, matchNames: m } })) })).items.map((x) => x.value));
    const got = (await host.call('props.values', { compId: comp.id, time: t, items: copies.flatMap((id) => Object.values(PROPS).map((m) => ({ address: { layerId: id, matchNames: m } }))) })).items;
    return { name: prepared.name, nullId: nul.layerId, source: { id: src.id, name: src.name, parented: !!src.parentIndex }, copies, controls, unparented, set, t, srcRead, got, args: c };
  },

  verify({ result }) {
    const checks = [];
    checks.push({ ok: result.controls.layers[0].items.length === TR.CONTROLS.length, label: result.name, detail: 'Delay, Fade, Scale Step, Rotate Step live on the null' });
    const bad = result.set.targets.filter((tg) => tg.skipped || tg.reverted || (tg.after && tg.after.expressionError));
    checks.push({ ok: bad.length === 0, label: 'Expressions', detail: bad.length ? `${bad.length} failed: ${bad[0].after ? bad[0].after.expressionError : bad[0].skipped}` : `${result.set.targets.length} live expressions on ${result.copies.length} copies` });
    // copy k = the source at its own time (position exact only when the source has no parent — then its value is its comp point)
    const errs = { scale: 0, rotation: 0, opacity: 0, position: 0 };
    result.copies.forEach((_, i) => {
      const s = result.srcRead[i], g = result.got.slice(i * 4, i * 4 + 4).map((x) => x.value);
      const want = TR.at(i + 1, () => ({ position: s[0] || [0, 0], scale: s[1] || [100, 100], rotation: s[2] || 0, opacity: s[3] === null ? 100 : s[3] }), result.args, result.t, 1);
      if (!result.source.parented && g[0]) errs.position = Math.max(errs.position, Math.hypot(g[0][0] - want.position[0], g[0][1] - want.position[1]));
      if (g[1]) errs.scale = Math.max(errs.scale, Math.abs(g[1][0] - want.scale[0]));
      errs.rotation = Math.max(errs.rotation, Math.abs((g[2] || 0) - want.rotation));
      errs.opacity = Math.max(errs.opacity, Math.abs((g[3] || 0) - want.opacity));
    });
    const worst = Math.max(errs.position, errs.scale, errs.rotation, errs.opacity);
    checks.push({ ok: worst < 0.05, label: 'Read-back', detail: worst < 0.05 ? `${result.copies.length} copies = the source ${result.args.delay} frames apart each${result.source.parented ? ' (position not compared: the source has a parent)' : ''}` : `a copy differs by ${worst.toFixed(2)} (P ${errs.position.toFixed(2)} · S ${errs.scale.toFixed(2)} · R ${errs.rotation.toFixed(2)} · O ${errs.opacity.toFixed(2)})` });
    return { ok: checks.every((ch) => ch.ok), checks };
  },

  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, nullId: result.nullId, copies: result.copies }; },

  async restore({ data, host }) {
    await host.call('layers.remove', { compId: data.compId, layerIds: data.copies, onlyNamed: 'MOE Clone ' });
    await host.call('layers.remove', { compId: data.compId, layerIds: [data.nullId], onlyNamed: 'MOE Trail ' });
    return { ok: true };
  },

  summarize(result, v) { return v.ok ? `${result.name}: ${result.copies.length} copies of ${result.source.name}` : 'Trail made with problems'; }
};

module.exports = { trail };
