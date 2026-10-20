'use strict';
/**
 * One-click expression library (icon buttons). Each preset knows its natural target
 * property (wiggle → Position, blink → Opacity…), handles dimensions (1D wiggle on X
 * or Y keeps the other axis) and can expose its numbers as Slider Controls on the
 * layer ("Live controls") so they can be tweaked or keyframed later.
 */
const S = require('../compositing/shared');

const TAG = '// MOE Expr';
const T = { position: ['ADBE Transform Group', 'ADBE Position'], scale: ['ADBE Transform Group', 'ADBE Scale'], rotation: ['ADBE Transform Group', 'ADBE Rotate Z'], opacity: ['ADBE Transform Group', 'ADBE Opacity'] };

/* n(name) = a number: literal or a live slider reference. */
const PRESETS = {
  wiggle: { label: 'Wiggle', icon: 'xWiggle', target: 'position', nums: { freq: 2, amp: 30 }, code: (n) => `wiggle(${n('freq')}, ${n('amp')});` },
  wiggleX: { label: 'Wiggle X', icon: 'xWiggleX', target: 'position', nums: { freq: 2, amp: 40 }, code: (n) => `var w = wiggle(${n('freq')}, ${n('amp')});\n(value instanceof Array) ? [w[0]].concat(value.slice(1)) : w;` },
  wiggleY: { label: 'Wiggle Y', icon: 'xWiggleY', target: 'position', nums: { freq: 2, amp: 40 }, code: (n) => `var w = wiggle(${n('freq')}, ${n('amp')});\n(value instanceof Array) ? [value[0], w[1]].concat(value.slice(2)) : w;` },
  jitter: { label: 'Step Wiggle', icon: 'xStep', target: 'position', nums: { freq: 4, amp: 20, fps: 8 }, code: (n) => `posterizeTime(${n('fps')});\nwiggle(${n('freq')}, ${n('amp')});` },
  blink: { label: 'Blinker', icon: 'xBlink', target: 'opacity', nums: { rate: 2 }, code: (n) => `(Math.floor(time * ${n('rate')} * 2) % 2 == 0) ? value : 0;` },
  flicker: { label: 'Flicker', icon: 'xFlicker', target: 'opacity', nums: { rate: 12, min: 40 }, code: (n) => `posterizeTime(${n('rate')});\nseedRandom(index, false);\nvalue * random(${n('min')}, 100) / 100;` },
  autoFade: { label: 'Auto Fade', icon: 'xFade', target: 'opacity', nums: { secs: 0.5 }, code: (n) => `var d = Math.max(${n('secs')}, 0.001);\nvalue * Math.min(ease(time, inPoint, inPoint + d, 0, 1), ease(time, outPoint - d, outPoint, 1, 0));` },
  loopCycle: { label: 'Loop Cycle', icon: 'xLoop', target: 'keyed', nums: {}, code: () => 'loopOut("cycle");' },
  loopPingPong: { label: 'Ping-Pong', icon: 'xPingPong', target: 'keyed', nums: {}, code: () => 'loopOut("pingpong");' },
  loopOffset: { label: 'Loop Offset', icon: 'xOffset', target: 'keyed', nums: {}, code: () => 'loopOut("offset");' },
  loopInOut: { label: 'Loop In + Out', icon: 'xLoopBoth', target: 'keyed', nums: {}, code: () => '(numKeys > 1 && time < key(1).time) ? loopIn("cycle") : loopOut("cycle");' },
  timeRotate: { label: 'Time Rotation', icon: 'xSpin', target: 'rotation', nums: { speed: 90 }, code: (n) => `value + time * ${n('speed')};` },
  pendulum: { label: 'Pendulum', icon: 'xPendulum', target: 'rotation', nums: { amp: 25, freq: 1, decay: 0.6 }, code: (n) => `value + ${n('amp')} * Math.sin(time * ${n('freq')} * 2 * Math.PI) * Math.exp(-${n('decay')} * Math.max(time - inPoint, 0));` },
  pulse: { label: 'Pulse', icon: 'xPulse', target: 'scale', nums: { amp: 8, freq: 1 }, code: (n) => `var s = 1 + ${n('amp')} / 100 * Math.sin(time * ${n('freq')} * 2 * Math.PI);\nmul(value, s);` },
  float: { label: 'Float', icon: 'xFloat', target: 'position', nums: { amp: 12, freq: 0.5 }, code: (n) => `var o = ${n('amp')} * Math.sin(time * ${n('freq')} * 2 * Math.PI + index);\nvalue.length > 2 ? add(value, [0, o, 0]) : add(value, [0, o]);` },
  inertia: { label: 'Inertia Bounce', icon: 'xBounce', target: 'keyed', nums: { amp: 0.06, freq: 2.5, decay: 6 }, code: (n) => [
    `var amp = ${n('amp')}, freq = ${n('freq')}, decay = ${n('decay')}, k = 0;`,
    'if (numKeys > 0) { k = nearestKey(time).index; if (key(k).time > time) { k--; } }',
    'if (k > 0) { var t = time - key(k).time; var v = velocityAtTime(key(k).time - thisComp.frameDuration / 10); value + v * amp * Math.sin(freq * t * 2 * Math.PI) / Math.exp(decay * t); } else { value; }'
  ].join('\n') },
  posterize: { label: 'Stop Motion', icon: 'xPoster', target: 'keyed', nums: { fps: 12 }, code: (n) => `posterizeTime(${n('fps')});\nvalue;` }
};

const NUM_LABEL = { freq: 'Frequency', amp: 'Amount', fps: 'Frames/sec', rate: 'Rate', min: 'Min %', secs: 'Fade time', speed: 'Degrees/sec', decay: 'Decay' };

function code(presetId, values, live) {
  const p = PRESETS[presetId];
  const n = (k) => (live ? `effect("MOE ${p.label} ${NUM_LABEL[k]}")(1).value` : String(values[k] !== undefined ? values[k] : p.nums[k]));
  return `${TAG}: ${p.label}\n${p.code(n)}`;
}

const params = {
  preset: { type: 'enum', label: 'Expression', default: 'wiggle', options: Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label })) },
  freq: { type: 'number', label: 'Frequency', min: 0, max: 60, step: 0.1, default: 2, showIf: (a) => 'freq' in PRESETS[a.preset].nums },
  amp: { type: 'number', label: 'Amount', min: 0, max: 5000, step: 0.5, default: 30, showIf: (a) => 'amp' in PRESETS[a.preset].nums },
  rate: { type: 'number', label: 'Rate', min: 0.1, max: 60, step: 0.1, default: 2, unit: 'Hz', showIf: (a) => 'rate' in PRESETS[a.preset].nums },
  fps: { type: 'number', label: 'Frames/sec', min: 1, max: 60, step: 1, default: 8, showIf: (a) => 'fps' in PRESETS[a.preset].nums },
  speed: { type: 'number', label: 'Degrees/sec', min: -3600, max: 3600, step: 5, default: 90, showIf: (a) => 'speed' in PRESETS[a.preset].nums },
  secs: { type: 'number', label: 'Fade time', min: 0.01, max: 10, step: 0.05, default: 0.5, unit: 's', showIf: (a) => 'secs' in PRESETS[a.preset].nums },
  decay: { type: 'number', label: 'Decay', min: 0, max: 30, step: 0.1, default: 0.6, showIf: (a) => 'decay' in PRESETS[a.preset].nums },
  min: { type: 'number', label: 'Min %', min: 0, max: 100, step: 1, default: 40, showIf: (a) => 'min' in PRESETS[a.preset].nums },
  live: { type: 'boolean', label: 'Live controls', default: false, description: 'Put the numbers on Slider Controls (editable / keyframeable)' },
  replace: { type: 'boolean', label: 'Replace existing', default: false, advanced: true }
};

/** Resolve targets: selected properties, else the preset's natural property on selected layers. */
function targetsFor(p, ctx) {
  const props = (ctx.properties || []).filter((x) => x.canSetExpression);
  if (props.length) {
    const usable = p.target === 'keyed' ? props.filter((x) => x.numKeys > 0) : props;
    return { list: usable.map((x) => ({ address: x.address, name: x.name, layerId: x.address.layerId })), from: 'selected properties' };
  }
  if (p.target === 'keyed') return { list: [], from: 'keyframed properties' };
  const layers = (ctx.layers || []).filter((l) => !['camera', 'light'].includes(l.type) || p.target === 'position');
  return { list: layers.map((l) => ({ address: { layerId: l.id, matchNames: T[p.target] }, name: `${l.name} › ${p.target}`, layerId: l.id })), from: p.target };
}

const quick = {
  id: 'expressions.quick',
  version: '1.0.0',
  category: 'expressions',
  group: 'Quick Expressions',
  name: 'Quick Expression',
  description: 'One-click expressions: wiggle (all / X / Y / stepped), blinker, flicker, auto-fade, loops (cycle, ping-pong, offset, in+out), time rotation, pendulum, pulse, float, inertia bounce, stop motion. Works on selected properties, or on the natural property of selected layers.',
  keywords: ['wiggle', 'loop', 'loopout', 'pingpong', 'cycle', 'blink', 'blinker', 'flicker', 'time', 'rotation', 'bounce', 'inertia', 'pulse', 'float', 'pendulum', 'fade', 'posterize', 'expression'],
  icon: 'expr',
  params,
  requires: { comp: true },
  permissions: ['modify.expressions', 'modify.effects'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Apply a common expression (wiggle, loopOut cycle/pingpong, blink, time rotation, bounce…) to selected properties or layers.' },
  uses: { hostOps: ['effects.ensure', 'expressions.peek', 'expressions.set'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Apply' },
  PRESETS,

  prepare(args, ctx) {
    const p = PRESETS[args.preset];
    const t = targetsFor(p, ctx);
    if (!t.list.length) return { ok: false, error: p.target === 'keyed' ? 'Select keyframed properties to loop' : 'Select layers or properties' };
    return { ok: true, targets: t.list, preview: { summary: `${p.label} on ${t.list.length} ${t.list.length === 1 ? 'property' : 'properties'} (${t.from})`, items: t.list.slice(0, 6).map((x) => x.name) } };
  },

  async execute({ args, ctx, prepared, host }) {
    const p = PRESETS[args.preset];
    const values = {};
    for (const k of Object.keys(p.nums)) values[k] = args[k] !== undefined ? args[k] : p.nums[k];
    let fx = null;
    if (args.live && Object.keys(p.nums).length) {
      const layers = [...new Set(prepared.targets.map((t) => t.layerId))];
      fx = await host.call('effects.ensure', { compId: ctx.comp.id, label: 'MOE: Expression Controls', layers: layers.map((id) => ({ layer: { layerId: id }, items: Object.keys(p.nums).map((k) => ({ key: `MOE ${p.label} ${NUM_LABEL[k]}`, matchName: 'ADBE Slider Control', before: [], params: [{ id: k, value: values[k], names: ['Slider'], suffix: 1 }] })) })) });
    }
    const expr = code(args.preset, values, !!args.live && Object.keys(p.nums).length > 0);
    const peek = await host.call('expressions.peek', { compId: ctx.comp.id, items: prepared.targets.map((t) => ({ address: t.address })) });
    const conflicts = prepared.targets.filter((t, i) => peek.items[i].expression && !peek.items[i].expression.startsWith(TAG));
    if (conflicts.length && !args.replace) {
      if (fx) await S.restoreEffects({ data: S.effectsCheckpoint(fx, ctx), host });
      throw Object.assign(new Error(`Already has your own expression: ${conflicts.map((c) => c.name).join(', ')}. Turn on "Replace existing" (restorable).`), { code: 'EXPRESSION_CONFLICT' });
    }
    const set = await host.call('expressions.set', { compId: ctx.comp.id, label: `MOE: ${p.label}`, revertOnError: true, targets: prepared.targets.map((t) => ({ address: t.address, expression: expr, enabled: true })) });
    return { set, fx, preset: p.label, expr };
  },

  verify({ result }) {
    const checks = result.set.targets.map((t) => ({ ok: !t.skipped && !t.reverted && !t.after.expressionError, label: t.layerName ? `${t.layerName} › ${t.name}` : 'Property', detail: t.skipped || (t.reverted ? `${t.after.expressionError} — reverted` : `${result.preset} active`) }));
    return { ok: checks.every((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) {
    return { compId: ctx.comp.id, fx: result.fx ? S.effectsCheckpoint(result.fx, ctx) : null, expressions: result.set.targets.filter((t) => !t.skipped && !t.reverted).map((t) => ({ address: t.address, expression: t.before.expression, enabled: t.before.expressionEnabled })) };
  },
  async restore({ data, host }) {
    await host.call('expressions.set', { compId: data.compId, label: 'MOE: Restore', revertOnError: false, targets: data.expressions });
    if (data.fx) await S.restoreEffects({ data: data.fx, host });
    return { ok: true };
  },
  summarize(result) { return `${result.preset} on ${result.set.targets.length} propert(ies)`; }
};

module.exports = { quick, PRESETS, code, TAG };
