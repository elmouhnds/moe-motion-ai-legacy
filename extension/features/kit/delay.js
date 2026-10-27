'use strict';
/**
 * Delay (v0.10) — the Cinema 4D MoGraph Delay effector, for After Effects layers.
 *   Blend   the value eases towards where it should be (lag; Strength 0–100 %).
 *   Spring  the value follows like a spring: it overshoots and settles (Stiffness, Damping).
 *   Offset  a pure time delay (no smoothing).
 * One layer (or several with "Each layer"): the delay acts on the layer's OWN animation — any
 * keyed move gets lag / spring for free. Several layers with "Follow first": the first selected
 * layer leads; the others perform its motion (added to their own place and their own animation), each one more delayed
 * ("Delay" frames × its order) — like clones under a Delay effector.
 *
 * Controls are Slider Controls named "MOE Delay …" on the leader (follow) or on each layer (own):
 * live and keyframeable. Followers carry "MOE Delay Leader" (Layer Control) and "MOE Delay Order".
 * Expressions are tagged "// MOE Delay"; Trash removes the rig.
 *
 * The expression simulates frame by frame from a short window before the current time (≤ 300
 * frames), so it stays fast enough to scrub. Pure builders below; mock-evaluated in tests.
 */
const S = require('../compositing/shared');

const TAG = '// MOE Delay';
const FX = { leader: 'MOE Delay Leader', order: 'MOE Delay Order', strength: 'MOE Delay Strength', frames: 'MOE Delay Frames', stiffness: 'MOE Delay Stiffness', damping: 'MOE Delay Damping' };
const PROPS = { position: { mn: 'ADBE Position', expr: 'transform.position', label: 'Position' }, scale: { mn: 'ADBE Scale', expr: 'transform.scale', label: 'Scale' }, rotation: { mn: 'ADBE Rotate Z', expr: 'transform.rotation', label: 'Rotation' } };
const MODES = ['blend', 'spring', 'offset'];

/** The expression for one property. mode is baked in; every number is a live slider. */
function expression(mode, propKey) {
  const P = PROPS[propKey].expr;
  return [
    TAG,
    `var L = effect("${FX.leader}")("Layer");`,
    'var C = (L == null) ? thisLayer : L;',
    `var fd = thisComp.frameDuration, ord = effect("${FX.order}")("Slider");`,
    `var dt = ord * C.effect("${FX.frames}")("Slider") * fd;`,
    // own animation (pre-expression) or the leader's motion added to this layer's own place
    `function src(t) { return (L == null) ? thisProperty.valueAtTime(t) : add(thisProperty.valueAtTime(t), sub(L.${P}.valueAtTime(t), L.${P}.valueAtTime(0))); }`,
    mode === 'offset' ? 'src(time - dt);' : mode === 'blend' ? [
      `var s = Math.min(Math.max(C.effect("${FX.strength}")("Slider") / 100, 0), 0.995);`,
      'var n = (s <= 0) ? 0 : Math.min(300, Math.ceil(Math.log(0.001) / Math.log(s)));',
      'var t0 = time - dt - n * fd, y = src(t0);',
      'for (var i = 1; i <= n; i++) { y = add(y, mul(sub(src(t0 + i * fd), y), 1 - s)); }',
      'y;'
    ].join('\n') : [
      `var k = Math.max(C.effect("${FX.stiffness}")("Slider"), 1), c = Math.max(C.effect("${FX.damping}")("Slider"), 0.1);`,
      'var sub2 = 4, h = fd / sub2, n = Math.min(300, Math.ceil(10 / c / fd));',
      'var t0 = time - dt - n * fd, y = src(t0), v = mul(y, 0);',
      'for (var i = 1; i <= n; i++) { var x = src(t0 + i * fd); for (var j = 0; j < sub2; j++) { v = add(v, mul(sub(mul(sub(x, y), k), mul(v, c)), h)); y = add(y, mul(v, h)); } }',
      'y;'
    ].join('\n')
  ].join('\n');
}

/* Pure reference of the Blend / Spring maths (used by tests to check the expression). */
function simulate(mode, srcFn, time, o) {
  const fd = o.fd, dt = (o.order || 0) * o.frames * fd;
  if (mode === 'offset') return srcFn(time - dt);
  if (mode === 'blend') {
    const s = Math.min(Math.max(o.strength / 100, 0), 0.995);
    const n = s <= 0 ? 0 : Math.min(300, Math.ceil(Math.log(0.001) / Math.log(s)));
    const t0 = time - dt - n * fd;
    let y = srcFn(t0);
    for (let i = 1; i <= n; i++) y += (srcFn(t0 + i * fd) - y) * (1 - s);
    return y;
  }
  const k = Math.max(o.stiffness, 1), c = Math.max(o.damping, 0.1), sub2 = 4, h = fd / sub2, n = Math.min(300, Math.ceil(10 / c / fd));
  const t0 = time - dt - n * fd;
  let y = srcFn(t0), v = 0;
  for (let i = 1; i <= n; i++) { const x = srcFn(t0 + i * fd); for (let j = 0; j < sub2; j++) { v += ((x - y) * k - v * c) * h; y += v * h; } }
  return y;
}

const visual = (ctx) => (ctx.layers || []).filter((l) => !['camera', 'light'].includes(l.type) && !l.locked);
const addr = (id, mn) => ({ layerId: id, matchNames: ['ADBE Transform Group', mn] });

const delay = {
  id: 'kit.delay', version: '1.0.0', category: 'motion', group: 'Rigs', name: 'Delay',
  description: 'Cinema 4D MoGraph-style Delay. Blend = smooth lag, Spring = overshoot and settle, Offset = pure time delay. One layer: its own animation gets the delay. Several layers: the first leads and the others follow its motion, each more delayed. Live sliders in Effect Controls; Trash removes it.',
  keywords: ['delay', 'mograph', 'cinema 4d', 'c4d', 'effector', 'lag', 'spring', 'follow', 'trail', 'inertia', 'overlap', 'follow through', 'motion 4'],
  icon: 'kDelay',
  params: {
    mode: { type: 'enum', label: 'Mode', default: 'spring', options: [{ value: 'spring', label: 'Spring' }, { value: 'blend', label: 'Blend' }, { value: 'offset', label: 'Offset' }], description: 'Spring: overshoots and settles · Blend: smooth lag · Offset: pure time delay' },
    target: { type: 'enum', label: 'Layers', default: 'auto', options: [{ value: 'auto', label: 'Auto' }, { value: 'follow', label: 'Follow first' }, { value: 'own', label: 'Each layer' }], description: 'Auto: one layer = its own animation, several = the others follow the first selected' },
    strength: { type: 'number', label: 'Strength', min: 0, max: 99, step: 1, default: 70, unit: '%', showIf: (a) => a.mode === 'blend' },
    stiffness: { type: 'number', label: 'Stiffness', min: 1, max: 1000, step: 1, default: 140, showIf: (a) => a.mode === 'spring' },
    damping: { type: 'number', label: 'Damping', min: 0.1, max: 60, step: 0.1, default: 9, showIf: (a) => a.mode === 'spring' },
    frames: { type: 'number', label: 'Delay', min: 0, max: 120, step: 1, default: 3, unit: 'frames', description: 'Extra delay per follower (× its order)' },
    position: { type: 'boolean', label: 'Position', default: true },
    rotation: { type: 'boolean', label: 'Rotation', default: true },
    scale: { type: 'boolean', label: 'Scale', default: true }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.expressions', 'modify.effects'], recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'C4D MoGraph Delay: spring / blend lag / offset on the selected layers\' animation, or followers trailing the first selected layer.' },
  uses: { hostOps: ['props.values', 'effects.ensure', 'expressions.peek', 'expressions.set'], network: false }, compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Delay' },
  prepare(args, ctx) {
    const l = visual(ctx);
    if (!l.length) return { ok: false, error: 'Select layers' };
    const props = Object.keys(PROPS).filter((k) => args[k]);
    if (!props.length) return { ok: false, error: 'Pick Position, Rotation or Scale' };
    const follow = args.target === 'follow' || (args.target === 'auto' && l.length > 1);
    if (follow && l.length < 2) return { ok: false, error: 'Select a leader and at least one follower' };
    const leader = follow ? l[0] : null;
    const layers = follow ? l.slice(1) : l;
    return { ok: true, follow, leader, layers, props, preview: { summary: follow ? `${layers.length} layer${layers.length > 1 ? 's' : ''} follow ${leader.name} (${args.mode})` : `${args.mode} on ${layers.length} layer${layers.length > 1 ? 's' : ''}' own animation`, items: layers.map((x) => x.name) } };
  },
  async execute({ args, ctx, prepared, host }) {
    const compId = ctx.comp.id;
    // Only properties that move (on the leader, or on each layer itself) — one host call for all.
    const pairs = [];
    prepared.layers.forEach((L, i) => prepared.props.forEach((k) => pairs.push({ layer: L, order: prepared.follow ? i + 1 : 0, prop: k, src: prepared.follow ? prepared.leader.id : L.id })));
    const seen = [...new Map(pairs.map((p) => [`${p.src}|${p.prop}`, p])).values()];
    const vals = await host.call('props.values', { compId, items: seen.map((p) => ({ address: addr(p.src, PROPS[p.prop].mn) })) });
    const moving = new Set(seen.filter((p, i) => (vals.items[i].numKeys || 0) > 1).map((p) => `${p.src}|${p.prop}`));
    const plan = pairs.filter((p) => moving.has(`${p.src}|${p.prop}`));
    if (!plan.length) throw Object.assign(new Error(prepared.follow ? `${prepared.leader.name} has no Position / Rotation / Scale animation to follow` : 'No Position / Rotation / Scale keyframes on the selection — animate first, then Delay'), { code: 'NOTHING_TO_DELAY' });
    const slider = (key, value) => ({ key, matchName: 'ADBE Slider Control', before: [], params: [{ id: 'v', value, names: ['Slider'], suffix: 1 }] });
    const knobs = [slider(FX.strength, args.strength), slider(FX.frames, args.frames), slider(FX.stiffness, args.stiffness), slider(FX.damping, args.damping)];
    const ids = [...new Set(plan.map((p) => p.layer.id))];
    const items = [];
    if (prepared.follow) items.push({ layer: { layerId: prepared.leader.id }, items: knobs });
    for (const id of ids) {
      const order = (plan.find((p) => p.layer.id === id) || {}).order || 0;
      items.push({ layer: { layerId: id }, items: [{ key: FX.leader, matchName: 'ADBE Layer Control', before: [], params: [{ id: 'layer', value: prepared.follow ? prepared.leader.index : 0, names: ['Layer'], suffix: 1 }] }, slider(FX.order, order)].concat(prepared.follow ? [] : knobs) });
    }
    const fx = await host.call('effects.ensure', { compId, label: 'MOE: Delay Controls', layers: items });
    const targets = plan.map((p) => ({ address: addr(p.layer.id, PROPS[p.prop].mn), expression: expression(args.mode, p.prop), enabled: true, name: `${p.layer.name} › ${PROPS[p.prop].label}` }));
    const peek = await host.call('expressions.peek', { compId, items: targets.map((t) => ({ address: t.address })) });
    const mine = targets.filter((t, i) => peek.items[i].expression && !/^\/\/ MOE/.test(peek.items[i].expression));
    if (mine.length) {
      await S.restoreEffects({ data: S.effectsCheckpoint(fx, ctx), host });
      throw Object.assign(new Error(`Already has your own expression: ${mine.map((t) => t.name).join(', ')}`), { code: 'EXPRESSION_CONFLICT' });
    }
    const set = await host.call('expressions.set', { compId, label: `MOE: Delay (${args.mode})`, revertOnError: true, targets: targets.map(({ address, expression: e, enabled }) => ({ address, expression: e, enabled })) });
    return { fx, set, mode: args.mode, follow: prepared.follow, leader: prepared.leader ? prepared.leader.name : null, names: targets.map((t) => t.name) };
  },
  verify({ result }) {
    const checks = result.set.targets.map((t, i) => ({ ok: !t.skipped && !t.reverted && !t.after.expressionError, label: result.names[i], detail: t.skipped || (t.reverted ? `${t.after.expressionError} — reverted` : `${result.mode}${result.follow ? ` · follows ${result.leader}` : ''}`) }));
    return { ok: checks.length > 0 && checks.every((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, fx: S.effectsCheckpoint(result.fx, ctx), expressions: result.set.targets.filter((t) => !t.skipped && !t.reverted).map((t) => ({ address: t.address, expression: t.before.expression, enabled: t.before.expressionEnabled })) }; },
  async restore({ data, host }) {
    await host.call('expressions.set', { compId: data.compId, label: 'MOE: Restore', revertOnError: false, targets: data.expressions });
    await S.restoreEffects({ data: data.fx, host });
    return { ok: true };
  },
  summarize(result) { return `Delay (${result.mode}) on ${result.set.targets.length} propert${result.set.targets.length === 1 ? 'y' : 'ies'}${result.follow ? ` · following ${result.leader}` : ''}`; }
};

module.exports = { delay, expression, simulate, TAG, FX, MODES };
