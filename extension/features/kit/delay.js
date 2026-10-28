'use strict';
/**
 * Delay (v0.12) — the Cinema 4D MoGraph Delay effector, for After Effects layers.
 * Modes follow the C4D manual (Even · Blend · Spring):
 *   Even    blends uniformly: the layer follows at an even speed (a moving average over a window;
 *           a jump becomes a straight ramp). Strength sets how long that takes.
 *   Blend   fast at first, then settles slowly (exponential smoothing per frame). Strength.
 *   Spring  connected by a spring: it overshoots and settles (Stiffness, Damping).
 * Strength 0 = no smoothing (with Delay frames > 0: a pure time offset, what "Offset" used to do).
 *
 * One layer (or several with "Each layer"): the delay acts on the layer's OWN animation — any
 * keyed move gets lag / spring for free. Several layers with "Follow first": the first selected
 * layer leads; the others perform its motion (added to their own place and their own animation),
 * each one more delayed ("Delay" frames × its order).
 *
 * Field (like a C4D field on the effector): a null "MOE Delay Field" with Radius / Falloff /
 * Invert. Each layer's delay is blended with its undelayed motion by its weight: 1 inside the
 * radius, smoothly 0 at radius + falloff (distance in the comp's XY plane, measured every frame,
 * so moving the null sweeps the effect across the layers; scaling the null scales the field).
 * The "MOE Delay Field" Layer Control picks the field layer — any layer works; empty = no field.
 *
 * Controls are Slider Controls named "MOE Delay …" on the leader (follow) or on each layer (own):
 * live and keyframeable. Followers carry "MOE Delay Leader" (Layer Control) and "MOE Delay Order".
 * Expressions are tagged "// MOE Delay"; Trash removes the rig (the field null stays — delete it
 * yourself if you no longer want it; MOE never deletes layers silently).
 *
 * The expression simulates frame by frame from a short window before the current time (≤ 300
 * frames), so it stays fast enough to scrub. `simulate()` is the plain-JS reference the tests
 * compare the mock-evaluated expression with.
 */
const S = require('../compositing/shared');

const TAG = '// MOE Delay';
const FIELD_NULL = 'MOE Delay Field';
const FX = {
  leader: 'MOE Delay Leader', order: 'MOE Delay Order', strength: 'MOE Delay Strength', frames: 'MOE Delay Frames', stiffness: 'MOE Delay Stiffness', damping: 'MOE Delay Damping',
  field: 'MOE Delay Field', radius: 'MOE Delay Field Radius', falloff: 'MOE Delay Field Falloff', invert: 'MOE Delay Field Invert'
};
const PROPS = { position: { mn: 'ADBE Position', expr: 'transform.position', label: 'Position' }, scale: { mn: 'ADBE Scale', expr: 'transform.scale', label: 'Scale' }, rotation: { mn: 'ADBE Rotate Z', expr: 'transform.rotation', label: 'Rotation' } };
const MODES = ['even', 'blend', 'spring'];

/** Window length of Even: same average lag as Blend at the same Strength ((n − 1) / 2 = s / (1 − s)). */
const evenWindow = (s) => Math.min(300, Math.max(1, Math.round((2 * s) / (1 - s)) + 1));

/** The expression for one property. mode is baked in; every number is a live slider. */
function expression(mode, propKey) {
  const P = PROPS[propKey].expr;
  // where the layer is now, without reading its own post-expression value (no self reference)
  const here = propKey === 'position' ? 'thisProperty.valueAtTime(time)' : 'transform.position.valueAtTime(time)';
  const sim = mode === 'spring' ? [
    `var k = Math.max(C.effect("${FX.stiffness}")("Slider"), 1), c = Math.max(C.effect("${FX.damping}")("Slider"), 0.1);`,
    'var sub2 = 4, h = fd / sub2, n = Math.min(300, Math.ceil(10 / c / fd));',
    'var t0 = time - dt - n * fd; y = src(t0); var v = mul(y, 0);',
    'for (var i = 1; i <= n; i++) { var x = src(t0 + i * fd); for (var j = 0; j < sub2; j++) { v = add(v, mul(sub(mul(sub(x, y), k), mul(v, c)), h)); y = add(y, mul(v, h)); } }'
  ] : mode === 'even' ? [
    `var s = Math.min(Math.max(C.effect("${FX.strength}")("Slider") / 100, 0), 0.995);`,
    'var n = Math.min(300, Math.max(1, Math.round(2 * s / (1 - s)) + 1));',
    'y = src(time - dt);',
    'for (var i = 1; i < n; i++) { y = add(y, src(time - dt - i * fd)); }',
    'y = div(y, n);'
  ] : [
    `var s = Math.min(Math.max(C.effect("${FX.strength}")("Slider") / 100, 0), 0.995);`,
    'var n = (s <= 0) ? 0 : Math.min(300, Math.ceil(Math.log(0.001) / Math.log(s)));',
    'var t0 = time - dt - n * fd; y = src(t0);',
    'for (var i = 1; i <= n; i++) { y = add(y, mul(sub(src(t0 + i * fd), y), 1 - s)); }'
  ];
  return [
    TAG,
    `var L = effect("${FX.leader}")("Layer");`,
    'var C = (L == null) ? thisLayer : L;',
    `var fd = thisComp.frameDuration, ord = effect("${FX.order}")("Slider");`,
    `var dt = ord * C.effect("${FX.frames}")("Slider") * fd;`,
    // own animation (pre-expression) or the leader's motion added to this layer's own place
    `function src(t) { return (L == null) ? thisProperty.valueAtTime(t) : add(thisProperty.valueAtTime(t), sub(L.${P}.valueAtTime(t), L.${P}.valueAtTime(0))); }`,
    // field weight: 1 inside the radius, smooth to 0 at radius + falloff
    `var w = 1, F = C.effect("${FX.field}")("Layer");`,
    'if (F != null) {',
    '  var R = 200, W = 300, inv = 0;',
    `  try { R = F.effect("${FX.radius}")("Slider"); W = F.effect("${FX.falloff}")("Slider"); inv = F.effect("${FX.invert}")("Checkbox"); } catch (e) { }`,
    '  var fs = Math.abs(F.transform.scale[0]) / 100;',
    '  R = Math.max(R, 0) * fs; W = Math.max(W, 0.001) * fs;',
    `  var p0 = ${here};`,
    '  var Pc = thisLayer.hasParent ? thisLayer.parent.toComp(p0) : p0, Q = F.toComp(F.anchorPoint);',
    '  var d = length([Pc[0], Pc[1]], [Q[0], Q[1]]);',
    '  w = Math.min(Math.max(1 - (d - R) / W, 0), 1); w = w * w * (3 - 2 * w);',
    '  if (inv == 1) { w = 1 - w; }',
    '}',
    'var now = src(time), y = now, out = now;',
    'if (w > 0) {',
    ...sim.map((l) => `  ${l}`),
    '  out = (w >= 1) ? y : add(now, mul(sub(y, now), w));',
    '}',
    'out;'
  ].join('\n');
}

/** Field weight for a distance (pure mirror of the expression). */
function fieldWeight(d, { radius = 200, falloff = 300, invert = false, scale = 100 } = {}) {
  const fs = Math.abs(scale) / 100, R = Math.max(radius, 0) * fs, W = Math.max(falloff, 0.001) * fs;
  let w = Math.min(Math.max(1 - (d - R) / W, 0), 1);
  w = w * w * (3 - 2 * w);
  return invert ? 1 - w : w;
}

/* Pure reference of the Even / Blend / Spring maths (used by tests to check the expression). o.w = field weight. */
function simulate(mode, srcFn, time, o) {
  const fd = o.fd, dt = (o.order || 0) * o.frames * fd, w = o.w === undefined ? 1 : o.w;
  const now = srcFn(time);
  if (w <= 0) return now;
  let y;
  if (mode === 'even') {
    const s = Math.min(Math.max(o.strength / 100, 0), 0.995), n = evenWindow(s);
    y = 0;
    for (let i = 0; i < n; i++) y += srcFn(time - dt - i * fd);
    y /= n;
  } else if (mode === 'blend') {
    const s = Math.min(Math.max(o.strength / 100, 0), 0.995);
    const n = s <= 0 ? 0 : Math.min(300, Math.ceil(Math.log(0.001) / Math.log(s)));
    const t0 = time - dt - n * fd;
    y = srcFn(t0);
    for (let i = 1; i <= n; i++) y += (srcFn(t0 + i * fd) - y) * (1 - s);
  } else {
    const k = Math.max(o.stiffness, 1), c = Math.max(o.damping, 0.1), sub2 = 4, h = fd / sub2, n = Math.min(300, Math.ceil(10 / c / fd));
    const t0 = time - dt - n * fd;
    let v = 0;
    y = srcFn(t0);
    for (let i = 1; i <= n; i++) { const x = srcFn(t0 + i * fd); for (let j = 0; j < sub2; j++) { v += ((x - y) * k - v * c) * h; y += v * h; } }
  }
  return w >= 1 ? y : now + (y - now) * w;
}

const isField = (l) => l.name === FIELD_NULL;
const visual = (ctx) => (ctx.layers || []).filter((l) => !['camera', 'light'].includes(l.type) && !l.locked && !isField(l));
const addr = (id, mn) => ({ layerId: id, matchNames: ['ADBE Transform Group', mn] });

const delay = {
  id: 'kit.delay', version: '2.0.0', category: 'motion', group: 'Rigs', name: 'Delay',
  description: 'Cinema 4D MoGraph Delay. Even = follows at an even speed, Blend = fast then settles, Spring = overshoots and settles. One layer: its own animation gets the delay. Several layers: the first leads and the others follow its motion, each more delayed. Field: a null whose distance sets how much delay each layer gets (move it to sweep the effect). Live sliders in Effect Controls; Trash removes it.',
  keywords: ['delay', 'mograph', 'cinema 4d', 'c4d', 'effector', 'lag', 'spring', 'even', 'blend', 'field', 'falloff', 'follow', 'trail', 'inertia', 'overlap', 'follow through', 'motion 4'],
  icon: 'kDelay',
  params: {
    mode: { type: 'enum', label: 'Mode', default: 'spring', options: [{ value: 'even', label: 'Even' }, { value: 'blend', label: 'Blend' }, { value: 'spring', label: 'Spring' }], aliases: { offset: 'even' }, description: 'Even: follows at an even speed · Blend: fast, then settles slowly · Spring: overshoots and settles (like C4D)' },
    target: { type: 'enum', label: 'Layers', default: 'auto', options: [{ value: 'auto', label: 'Auto' }, { value: 'follow', label: 'Follow first' }, { value: 'own', label: 'Each layer' }], description: 'Auto: one layer = its own animation, several = the others follow the first selected' },
    strength: { type: 'number', label: 'Strength', min: 0, max: 99, step: 1, default: 70, unit: '%', description: 'How much it lags (0 = none)', showIf: (a) => a.mode !== 'spring' },
    stiffness: { type: 'number', label: 'Stiffness', min: 1, max: 1000, step: 1, default: 140, showIf: (a) => a.mode === 'spring' },
    damping: { type: 'number', label: 'Damping', min: 0.1, max: 60, step: 0.1, default: 9, showIf: (a) => a.mode === 'spring' },
    frames: { type: 'number', label: 'Delay', min: 0, max: 120, step: 1, default: 3, unit: 'fr', description: 'Extra time delay per follower in frames (× its order)' },
    field: { type: 'boolean', label: 'Field (null)', default: false, description: 'A null sets how much delay each layer gets by its distance: full inside the radius, none beyond the falloff. Creates "MOE Delay Field" (or reuses it).' },
    position: { type: 'boolean', label: 'Position', default: true },
    rotation: { type: 'boolean', label: 'Rotation', default: true },
    scale: { type: 'boolean', label: 'Scale', default: true }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.expressions', 'modify.effects', 'modify.layers'], recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'C4D MoGraph Delay (even / blend / spring) on the selected layers\' animation, or followers trailing the first selected layer; optional distance field from a null.' },
  uses: { hostOps: ['props.values', 'layers.createNull', 'layers.remove', 'effects.ensure', 'expressions.peek', 'expressions.set'], network: false }, compatibility: { minAE: '25.0' },
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
    const fieldLayer = args.field ? ((ctx.compLayers || []).find(isField) || null) : null;
    const field = args.field ? (fieldLayer ? `field: ${FIELD_NULL}` : `new ${FIELD_NULL}`) : '';
    return { ok: true, follow, leader, layers, props, fieldLayer, preview: { summary: (follow ? `${layers.length} layer${layers.length > 1 ? 's' : ''} follow ${leader.name} (${args.mode})` : `${args.mode} on ${layers.length} layer${layers.length > 1 ? 's' : ''}' own animation`) + (field ? ` · ${field}` : ''), items: layers.map((x) => x.name) } };
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

    // Field null: reuse the comp's "MOE Delay Field", or create one at the comp centre (new layers go on top → indices below shift by one).
    let fieldInfo = null, created = null, shift = 0;
    if (args.field) {
      if (prepared.fieldLayer) fieldInfo = { id: prepared.fieldLayer.id, index: prepared.fieldLayer.index, name: prepared.fieldLayer.name };
      else {
        created = await host.call('layers.createNull', { compId, name: FIELD_NULL, position: [ctx.comp.width / 2, ctx.comp.height / 2], label: 11, undoLabel: 'MOE: Delay Field' });
        fieldInfo = { id: created.layerId, index: created.index, name: created.name };
        shift = 1;
      }
    }
    const idx = (layer) => layer.index + (shift && created.index <= layer.index ? 1 : 0);

    const slider = (key, value) => ({ key, matchName: 'ADBE Slider Control', before: [], params: [{ id: 'v', value, names: ['Slider'], suffix: 1 }] });
    const layerCtl = (key, index) => ({ key, matchName: 'ADBE Layer Control', before: [], params: [{ id: 'layer', value: index, names: ['Layer'], suffix: 1 }] });
    const knobs = [slider(FX.strength, args.strength), slider(FX.frames, args.frames), slider(FX.stiffness, args.stiffness), slider(FX.damping, args.damping), layerCtl(FX.field, fieldInfo ? fieldInfo.index : 0)];
    const ids = [...new Set(plan.map((p) => p.layer.id))];
    const items = [];
    if (fieldInfo) {
      const m = Math.min(ctx.comp.width, ctx.comp.height);
      const fieldFx = created ? [slider(FX.radius, Math.round(m * 0.2)), slider(FX.falloff, Math.round(m * 0.3)), { key: FX.invert, matchName: 'ADBE Checkbox Control', before: [], params: [{ id: 'v', value: 0, names: ['Checkbox'], suffix: 1 }] }] : [];
      if (fieldFx.length) items.push({ layer: { layerId: fieldInfo.id }, items: fieldFx });
    }
    if (prepared.follow) items.push({ layer: { layerId: prepared.leader.id }, items: knobs });
    for (const id of ids) {
      const order = (plan.find((p) => p.layer.id === id) || {}).order || 0;
      items.push({ layer: { layerId: id }, items: [layerCtl(FX.leader, prepared.follow ? idx(prepared.leader) : 0), slider(FX.order, order)].concat(prepared.follow ? [] : knobs) });
    }
    const undoField = async () => { if (created) await host.call('layers.remove', { compId, layerIds: [created.layerId], onlyNamed: FIELD_NULL }); };
    let fx;
    try { fx = await host.call('effects.ensure', { compId, label: 'MOE: Delay Controls', layers: items }); } catch (e) { await undoField(); throw e; }
    const targets = plan.map((p) => ({ address: addr(p.layer.id, PROPS[p.prop].mn), expression: expression(args.mode, p.prop), enabled: true, name: `${p.layer.name} › ${PROPS[p.prop].label}` }));
    const peek = await host.call('expressions.peek', { compId, items: targets.map((t) => ({ address: t.address })) });
    const mine = targets.filter((t, i) => peek.items[i].expression && !/^\/\/ MOE/.test(peek.items[i].expression));
    if (mine.length) {
      await S.restoreEffects({ data: S.effectsCheckpoint(fx, ctx), host });
      await undoField();
      throw Object.assign(new Error(`Already has your own expression: ${mine.map((t) => t.name).join(', ')}`), { code: 'EXPRESSION_CONFLICT' });
    }
    const set = await host.call('expressions.set', { compId, label: `MOE: Delay (${args.mode})`, revertOnError: true, targets: targets.map(({ address, expression: e, enabled }) => ({ address, expression: e, enabled })) });
    return { fx, set, mode: args.mode, follow: prepared.follow, leader: prepared.leader ? prepared.leader.name : null, names: targets.map((t) => t.name), field: fieldInfo, created };
  },
  verify({ result }) {
    const checks = result.set.targets.map((t, i) => ({ ok: !t.skipped && !t.reverted && !t.after.expressionError, label: result.names[i], detail: t.skipped || (t.reverted ? `${t.after.expressionError} — reverted` : `${result.mode}${result.follow ? ` · follows ${result.leader}` : ''}${result.field ? ' · field' : ''}`) }));
    if (result.field) checks.push({ ok: true, label: result.field.name, detail: result.created ? 'field null created at the comp centre — move or scale it' : 'existing field reused' });
    return { ok: checks.length > 0 && checks.every((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, fx: S.effectsCheckpoint(result.fx, ctx), createdField: result.created ? result.created.layerId : null, expressions: result.set.targets.filter((t) => !t.skipped && !t.reverted).map((t) => ({ address: t.address, expression: t.before.expression, enabled: t.before.expressionEnabled })) }; },
  async restore({ data, host }) {
    await host.call('expressions.set', { compId: data.compId, label: 'MOE: Restore', revertOnError: false, targets: data.expressions });
    await S.restoreEffects({ data: data.fx, host });
    if (data.createdField) await host.call('layers.remove', { compId: data.compId, layerIds: [data.createdField], onlyNamed: FIELD_NULL });
    return { ok: true };
  },
  summarize(result) { return `Delay (${result.mode}) on ${result.set.targets.length} propert${result.set.targets.length === 1 ? 'y' : 'ies'}${result.follow ? ` · following ${result.leader}` : ''}${result.field ? ` · field ${result.field.name}` : ''}`; }
};

module.exports = { delay, expression, simulate, fieldWeight, evenWindow, TAG, FX, MODES, FIELD_NULL };
