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
  posterize: { label: 'Stop Motion', icon: 'xPoster', target: 'keyed', nums: { fps: 12 }, code: (n) => `posterizeTime(${n('fps')});\nvalue;` },
  // ---- v0.6 additions ----
  bounceBack: { label: 'Bounce Land', icon: 'xBounceLand', target: 'keyed', nums: { elastic: 0.6, gravity: 4000 }, code: (n) => [
    `var e = ${n('elastic')}, g = ${n('gravity')}, nMax = 9, k = 0;`,
    'if (numKeys > 0) { k = nearestKey(time).index; if (key(k).time > time) { k--; } }',
    'if (k > 0 && k == numKeys) {',
    '  var t = time - key(k).time, v = -velocityAtTime(key(k).time - 0.001) * e, vl = length(v);',
    '  var vu = (value instanceof Array) ? ((vl > 0) ? normalize(v) : v) : ((v < 0) ? -1 : 1);',
    '  var tCur = 0, segDur = 2 * vl / g, tNext = segDur, nb = 1;',
    '  while (tNext < t && nb <= nMax) { vl *= e; segDur *= e; tCur = tNext; tNext += segDur; nb++; }',
    '  if (nb <= nMax) { var dt = t - tCur; value + vu * dt * (vl - g * dt / 2); } else { value; }',
    '} else { value; }'
  ].join('\n') },
  squash: { label: 'Squash & Stretch', icon: 'xSquash', target: 'scale', nums: { amp: 12, freq: 2, decay: 3 }, code: (n) => `var t = Math.max(time - inPoint, 0);\nvar s = ${n('amp')} / 100 * Math.sin(t * ${n('freq')} * 2 * Math.PI) / Math.exp(${n('decay')} * t);\n[value[0] * (1 + s), value[1] * (1 - s)].concat(value.slice(2));` },
  orbit: { label: 'Orbit', icon: 'xOrbit', target: 'position', nums: { radius: 80, speed: 90 }, code: (n) => `var a = degreesToRadians(time * ${n('speed')}) + index;\nvar o = [${n('radius')} * Math.cos(a), ${n('radius')} * Math.sin(a)];\nvalue.length > 2 ? add(value, o.concat([0])) : add(value, o);` },
  swing: { label: 'Swing', icon: 'xSwing', target: 'rotation', nums: { amp: 15, freq: 0.8 }, code: (n) => `value + ${n('amp')} * Math.sin(time * ${n('freq')} * 2 * Math.PI);` },
  heartbeat: { label: 'Heartbeat', icon: 'xHeart', target: 'scale', nums: { amp: 12, rate: 1.2 }, code: (n) => `var p = (time * ${n('rate')}) % 1;\nvar b = Math.exp(-Math.pow((p - 0.1) / 0.05, 2)) + 0.6 * Math.exp(-Math.pow((p - 0.3) / 0.05, 2));\nmul(value, 1 + ${n('amp')} / 100 * b);` },
  breathe: { label: 'Breathe', icon: 'xBreathe', target: 'opacity', nums: { min: 35, freq: 0.5 }, code: (n) => `${n('min')} + (value - ${n('min')}) * (0.5 + 0.5 * Math.sin(time * ${n('freq')} * 2 * Math.PI));` },
  wiggleRot: { label: 'Wiggle Rotation', icon: 'xWiggleRot', target: 'rotation', nums: { freq: 2, amp: 8 }, code: (n) => `wiggle(${n('freq')}, ${n('amp')});` },
  wiggleScale: { label: 'Wiggle Scale', icon: 'xWiggleScale', target: 'scale', nums: { freq: 2, amp: 6 }, code: (n) => `var w = wiggle(${n('freq')}, ${n('amp')});\nvar d = w[0] - value[0];\nvalue.length > 2 ? add(value, [d, d, d]) : add(value, [d, d]);` },
  organic: { label: 'Organic Wiggle', icon: 'xOrganic', target: 'position', nums: { freq: 1, amp: 25 }, code: (n) => `wiggle(${n('freq')}, ${n('amp')}, 3, 0.35);` },
  loopWiggle: { label: 'Loop Wiggle', icon: 'xLoopWiggle', target: 'position', nums: { freq: 1.5, amp: 30, loop: 4 }, code: (n) => `var L = Math.max(${n('loop')}, 0.1), t = time % L;\nvar w1 = wiggle(${n('freq')}, ${n('amp')}, 1, 0.5, t), w2 = wiggle(${n('freq')}, ${n('amp')}, 1, 0.5, t - L);\nlinear(t, 0, L, w1, w2);` },
  drift: { label: 'Drift', icon: 'xDrift', target: 'position', nums: { pxs: 40 }, code: (n) => `var d = ${n('pxs')} * (time - inPoint);\nvalue.length > 2 ? add(value, [d, 0, 0]) : add(value, [d, 0]);` },
  clock: { label: 'Clock Ticks', icon: 'xClock', target: 'rotation', nums: { rate: 1, amp: 6 }, code: (n) => `value + Math.floor(time * ${n('rate')}) * ${n('amp')};` },
  faceMotion: { label: 'Face Motion', icon: 'xFace', target: 'rotation', nums: {}, code: () => 'var p = transform.position, f = thisComp.frameDuration;\nvar d = sub(p.valueAtTime(time + f), p.valueAtTime(time - f));\n(length(d) > 0.01) ? value + radiansToDegrees(Math.atan2(d[1], d[0])) : value;' },
  scatter: { label: 'Random Scatter', icon: 'xScatter', target: 'position', nums: { amp: 120, seed: 1 }, code: (n) => `seedRandom(${n('seed')} + index, true);\nvar r = ${n('amp')};\nvalue.length > 2 ? add(value, [random(-r, r), random(-r, r), 0]) : add(value, [random(-r, r), random(-r, r)]);` },
  popIn: { label: 'Auto Pop-In', icon: 'xPopIn', target: 'scale', nums: { secs: 0.5 }, code: (n) => `var d = Math.max(${n('secs')}, 0.01), u = (time - inPoint) / d;\nvar s = (u >= 1) ? 1 : ((u <= 0) ? 0 : 1 + 0.15 * Math.sin(Math.PI * u) - Math.pow(1 - u, 3));\nmul(value, Math.max(0, s));` },
  slideIn: { label: 'Auto Slide-In', icon: 'xSlideIn', target: 'position', nums: { secs: 0.6, amp: 300 }, code: (n) => `var u = Math.min(Math.max((time - inPoint) / Math.max(${n('secs')}, 0.01), 0), 1);\nvar o = -${n('amp')} * Math.pow(1 - u, 3);\nvalue.length > 2 ? add(value, [o, 0, 0]) : add(value, [o, 0]);` },
  // ---- v0.66 (docs/features/TOOL_CARDS.md): smart expressions that read the layer itself ----
  // Live Stagger (id cascade): each layer plays ITS OWN keys later by its order in the timeline (r = rank, written per layer) — a stagger
  // that moves no keyframe and stays live. thisProperty.valueAtTime() inside its own expression is the pre-expression value.
  cascade: { label: 'Live Stagger', icon: 'stagger', target: 'keyed', perLayer: true, nums: { delay: 0.08 }, code: (n, r) => `var i = ${r || 0};\nthisProperty.valueAtTime(time - i * ${n('delay')});` },
  // Marker Pulse: a pop on every layer marker (drop markers on the beats, the layer answers)
  markerPulse: { label: 'Marker Pulse', icon: 'xPulse', target: 'scale', nums: { amp: 15, freq: 2, decay: 5 }, code: (n) => [
    'var k = 0;',
    'if (marker.numKeys > 0) { k = marker.nearestKey(time).index; if (marker.key(k).time > time) { k--; } }',
    `if (k > 0) { var t = time - marker.key(k).time; mul(value, 1 + ${n('amp')} / 100 * Math.sin(t * ${n('freq')} * 2 * Math.PI) / Math.exp(${n('decay')} * t)); } else { value; }`
  ].join('\n') },
  // ---- v0.67 (docs/features/SMART_LAYER.md): the marker family ----
  // Marker Trigger: animate ONCE (your keys), and it replays from the start at every layer marker; it holds the first
  // key before the first marker and the last key once a run is over.
  markerTrigger: { label: 'Marker Trigger', icon: 'xLoop', target: 'keyed', nums: {}, code: () => [
    'var k = 0, n = thisProperty.numKeys;',
    'if (marker.numKeys > 0) { k = marker.nearestKey(time).index; if (marker.key(k).time > time) { k--; } }',
    'if (n < 1) { value; } else { var t0 = thisProperty.key(1).time, t1 = thisProperty.key(n).time;',
    '  (k > 0) ? thisProperty.valueAtTime(t0 + Math.min(time - marker.key(k).time, t1 - t0)) : thisProperty.valueAtTime(t0); }'
  ].join('\n') },
  // Marker In / Out: fades in after the first marker and out into the last one; nothing before or after
  markerInOut: { label: 'Marker In / Out', icon: 'xFade', target: 'opacity', nums: { secs: 0.4 }, code: (n) => [
    `var d = Math.max(${n('secs')}, 0.01), m = marker.numKeys;`,
    'if (m < 1) { value; } else { var a = marker.key(1).time, b = marker.key(m).time, v = ease(time, a, a + d, 0, 1);',
    '  if (m > 1) { v = Math.min(v, ease(time, b - d, b, 1, 0)); } value * v; }'
  ].join('\n') },
};

/* Library filter tags (Studio). */
const TAGS = {
  Random: ['wiggle', 'wiggleX', 'wiggleY', 'jitter', 'flicker', 'wiggleRot', 'wiggleScale', 'organic', 'loopWiggle', 'scatter'],
  Periodic: ['blink', 'timeRotate', 'pendulum', 'pulse', 'float', 'swing', 'heartbeat', 'breathe', 'orbit', 'clock', 'squash'],
  Keys: ['loopCycle', 'loopPingPong', 'loopOffset', 'loopInOut', 'inertia', 'posterize', 'bounceBack', 'cascade', 'markerTrigger'],
  Auto: ['autoFade', 'popIn', 'slideIn', 'drift', 'faceMotion', 'markerPulse', 'markerInOut']
};
for (const [tag, ids] of Object.entries(TAGS)) for (const id of ids) PRESETS[id].tag = tag;

/* One-line explanations shown in the Studio Inspector. */
const HINTS = {
  wiggle: 'Random, smooth movement on every axis — the classic wiggle(freq, amount).',
  wiggleX: 'Wiggle on X only; Y and Z keep their values or keyframes.',
  wiggleY: 'Wiggle on Y only; X and Z keep their values or keyframes.',
  jitter: 'Wiggle that jumps at a lower frame rate — a nervous, hand-made feel.',
  blink: 'Switches opacity on and off at a steady rate.',
  flicker: 'Random opacity dips between Min % and full, like a faulty light.',
  autoFade: 'Fades in after the layer starts and out before it ends — no keyframes.',
  loopCycle: 'Repeats your keyframes forever (loopOut cycle).',
  loopPingPong: 'Plays your keyframes forward, then backward, forever.',
  loopOffset: 'Repeats the keyframed move and keeps adding it — endless travel.',
  loopInOut: 'Loops before the first key and after the last one.',
  timeRotate: 'Constant spin: degrees per second added to the rotation.',
  pendulum: 'Swing that slowly settles — a decaying sine on rotation.',
  pulse: 'Gentle, steady scale breathing.',
  float: 'Soft up-and-down bob, offset per layer so groups do not move in sync.',
  inertia: 'Overshoot and settle after each keyframe — springy motion from your keys.',
  posterize: 'Holds frames to a lower frame rate: instant stop-motion.',
  bounceBack: 'After the last keyframe the layer bounces like a ball landing.',
  squash: 'Squash & stretch wobble on scale that fades out after the layer starts.',
  orbit: 'Circles around its position at a set radius and speed.',
  swing: 'Endless back-and-forth rotation, like a sign in the wind.',
  heartbeat: 'Double pulse on scale — lub-dub — at a set rate.',
  breathe: 'Opacity rises and falls smoothly between Min % and full.',
  wiggleRot: 'Random rotation jitter around the current angle.',
  wiggleScale: 'Random, uniform scale jitter — width and height stay locked.',
  organic: 'Multi-octave wiggle: slow drift with fine detail, feels natural.',
  loopWiggle: 'A wiggle that loops seamlessly after Loop length — great for GIFs.',
  drift: 'Moves sideways at a constant speed from the layer start.',
  clock: 'Rotation that ticks in steps, like a clock hand.',
  faceMotion: 'Rotates the layer to point where it is moving (auto-orient by expression).',
  scatter: 'Places each layer at a random offset (seeded, so it stays put).',
  popIn: 'Scales up from 0 with a little overshoot when the layer starts — no keys.',
  slideIn: 'Slides in from the left with an ease when the layer starts — no keys.',
  cascade: 'Each layer plays its own keys a little later, in timeline order — a live stagger that moves no keyframe.',
  markerPulse: 'A pop on every marker of the layer — put markers on the beats and it answers.',
  markerTrigger: 'Animate once; your keys replay from the start at every marker of the layer.',
  markerInOut: 'Fades in after the first marker and out into the last — move the markers to retime it.'
};
for (const [id, hint] of Object.entries(HINTS)) PRESETS[id].hint = hint;

const NUM_LABEL = { delay: 'Delay', freq: 'Frequency', amp: 'Amount', fps: 'Frames/sec', rate: 'Rate', min: 'Min %', secs: 'Duration', speed: 'Degrees/sec', decay: 'Decay', elastic: 'Elasticity', gravity: 'Gravity', radius: 'Radius', loop: 'Loop length', pxs: 'Pixels/sec', seed: 'Seed' };

function code(presetId, values, live, rank) {
  const p = PRESETS[presetId];
  const n = (k) => (live ? `effect("MOE ${p.label} ${NUM_LABEL[k]}")(1).value` : String(values[k] !== undefined ? values[k] : p.nums[k]));
  return `${TAG}: ${p.label}\n${p.code(n, rank)}`;
}

const params = {
  preset: { type: 'enum', label: 'Expression', tileFixed: true, default: 'wiggle', options: Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label })) },
  freq: { type: 'number', label: 'Frequency', min: 0, max: 60, step: 0.1, default: 2, showIf: (a) => 'freq' in PRESETS[a.preset].nums },
  amp: { type: 'number', label: 'Amount', min: 0, max: 5000, step: 0.5, default: 30, showIf: (a) => 'amp' in PRESETS[a.preset].nums },
  rate: { type: 'number', label: 'Rate', min: 0.1, max: 60, step: 0.1, default: 2, unit: 'Hz', showIf: (a) => 'rate' in PRESETS[a.preset].nums },
  fps: { type: 'number', label: 'Frames/sec', min: 1, max: 60, step: 1, default: 8, showIf: (a) => 'fps' in PRESETS[a.preset].nums },
  speed: { type: 'number', label: 'Degrees/sec', min: -3600, max: 3600, step: 5, default: 90, showIf: (a) => 'speed' in PRESETS[a.preset].nums },
  secs: { type: 'number', label: 'Duration', min: 0.01, max: 10, step: 0.05, default: 0.5, unit: 's', showIf: (a) => 'secs' in PRESETS[a.preset].nums },
  decay: { type: 'number', label: 'Decay', min: 0, max: 30, step: 0.1, default: 0.6, showIf: (a) => 'decay' in PRESETS[a.preset].nums },
  min: { type: 'number', label: 'Min %', min: 0, max: 100, step: 1, default: 40, showIf: (a) => 'min' in PRESETS[a.preset].nums },
  elastic: { type: 'number', label: 'Elasticity', min: 0, max: 0.95, step: 0.05, default: 0.6, showIf: (a) => 'elastic' in PRESETS[a.preset].nums },
  gravity: { type: 'number', label: 'Gravity', min: 100, max: 20000, step: 100, default: 4000, showIf: (a) => 'gravity' in PRESETS[a.preset].nums },
  radius: { type: 'number', label: 'Radius', min: 0, max: 4000, step: 1, default: 80, unit: 'px', showIf: (a) => 'radius' in PRESETS[a.preset].nums },
  loop: { type: 'number', label: 'Loop length', min: 0.1, max: 60, step: 0.1, default: 4, unit: 's', showIf: (a) => 'loop' in PRESETS[a.preset].nums },
  pxs: { type: 'number', label: 'Pixels/sec', min: -5000, max: 5000, step: 1, default: 40, showIf: (a) => 'pxs' in PRESETS[a.preset].nums },
  delay: { type: 'number', label: 'Delay per layer', min: 0, max: 5, step: 0.01, default: 0.08, unit: 's', showIf: (a) => 'delay' in PRESETS[a.preset].nums },
  seed: { type: 'integer', label: 'Seed', min: 0, max: 9999, default: 1, showIf: (a) => 'seed' in PRESETS[a.preset].nums },
  live: { type: 'boolean', label: 'Live controls', default: false, description: 'Put the numbers on Slider Controls (editable / keyframeable)' },
  replace: { type: 'boolean', label: 'Replace existing', default: false, advanced: true }
};

/** Resolve targets: selected properties, else the preset's natural property on selected layers. */
function targetsFor(p, ctx) {
  const props = (ctx.properties || []).filter((x) => x.canSetExpression);
  if (props.length) {
    const usable = p.target === 'keyed' ? props.filter((x) => x.numKeys > 0) : props;
    return { list: usable.map((x) => ({ address: x.address, name: x.name, layerId: x.address.layerId, expression: x.expression || '' })), from: 'selected properties' };
  }
  if (p.target === 'keyed') return { list: [], from: 'keyframed properties' };
  const layers = (ctx.layers || []).filter((l) => !['camera', 'light'].includes(l.type) || p.target === 'position');
  return { list: layers.map((l) => ({ address: { layerId: l.id, matchNames: T[p.target] }, name: `${l.name} › ${p.target}`, layerId: l.id })), from: p.target };
}

/** v0.66: each target's rank = its layer's order in the timeline among the targeted layers (Cascade). */
function ranks(targets, ctx) {
  const idx = (id) => { const l = (ctx.layers || []).find((x) => x.id === id); return l && l.index !== undefined ? l.index : Infinity; };
  const order = [...new Set(targets.map((t) => t.layerId))].sort((a, b) => idx(a) - idx(b));
  return targets.map((t) => order.indexOf(t.layerId));
}

const TARGET_LABEL = { position: 'Position', scale: 'Scale', rotation: 'Rotation', opacity: 'Opacity', keyed: 'keyframed properties' };
const valuesOf = (p, args) => { const v = {}; for (const k of Object.keys(p.nums)) v[k] = args[k] !== undefined ? args[k] : p.nums[k]; return v; };

/**
 * v0.67 Layer Reader: read a MOE Expr back into { preset, values } — the preset's own code is generated with
 * placeholders and matched exactly, so an expression is only read when it is really that preset (edited by hand →
 * null). Live expressions (numbers on Slider Controls) come back as { preset, live: true }.
 */
function parse(text) {
  const src = String(text || '');
  const m = /^\/\/ MOE Expr: (.+)\n/.exec(src);
  if (!m) return null;
  const id = Object.keys(PRESETS).find((k) => PRESETS[k].label === m[1].trim());
  if (!id) return null;
  const p = PRESETS[id], keys = Object.keys(p.nums), body = src.slice(m[0].length);
  if (/effect\("MOE /.test(body)) return { preset: id, live: true, values: {} };
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tpl = p.code((k) => `\u0000${keys.indexOf(k)}\u0000`, '\u0001');
  const order = [];
  const re = new RegExp(`^${esc(tpl).replace(/\u0000(\d+)\u0000|\u0001/g, (w, i) => { order.push(i === undefined ? 'rank' : keys[+i]); return '(-?\\d+(?:\\.\\d+)?(?:e[-+]?\\d+)?)'; })}$`);
  const r = re.exec(body);
  if (!r) return null;
  const values = {};
  order.forEach((k, i) => { if (k !== 'rank') values[k] = Number(r[i + 1]); });
  return { preset: id, live: false, values };
}

const quick = {
  id: 'expressions.quick',
  version: '1.0.0',
  category: 'expressions',
  group: 'Quick Expressions',
  name: 'Quick Expression',
  description: 'One-click expressions (37): marker trigger (your keys replay at every marker), marker in / out, live stagger (each layer plays its own keys later, by timeline order), marker pulse, wiggle (all / X / Y / stepped / rotation / scale / organic / seamless loop), blinker, flicker, breathe, auto-fade, auto pop-in, auto slide-in, loops (cycle, ping-pong, offset, in+out), time rotation, clock ticks, swing, pendulum, orbit, pulse, heartbeat, squash & stretch, float, drift, face motion, random scatter, inertia bounce, bounce landing, stop motion. Works on selected properties, or on the natural property of selected layers.',
  keywords: ['marker', 'beat', 'orbit', 'swing', 'heartbeat', 'breathe', 'squash', 'stretch', 'scatter', 'drift', 'bounce', 'clock', 'auto orient', 'pop', 'slide', 'wiggle', 'loop', 'loopout', 'pingpong', 'cycle', 'blink', 'blinker', 'flicker', 'time', 'rotation', 'bounce', 'inertia', 'pulse', 'float', 'pendulum', 'fade', 'posterize', 'expression'],
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
    // v0.67 (SMART_LAYER.md): foresight — a selected property that already holds YOUR expression stops here, before
    // anything is written, instead of halfway through the run (the context already carries each property's expression)
    const own = t.list.filter((x) => x.expression && x.expression.indexOf(TAG) !== 0);
    if (own.length && !args.replace) return { ok: false, error: `${own.map((x) => x.name).join(', ')} already ${own.length === 1 ? 'has' : 'have'} your own expression — turn on Replace existing (restorable)` };
    return { ok: true, targets: t.list, from: t.from, preview: { summary: `${p.label} on ${t.list.length} ${t.list.length === 1 ? 'property' : 'properties'} (${t.from})`, items: t.list.slice(0, 6).map((x) => x.name) } };
  },

  /** v0.66 Tool Card: what it acts on, what it will write and the exact code — pure, from prepare()'s plan. */
  explain(args, ctx, prepared) {
    const p = PRESETS[args.preset];
    const values = valuesOf(p, args);
    const live = !!args.live && Object.keys(p.nums).length > 0;
    const sig = `${p.label.replace(/[^A-Za-z0-9]+(.)?/g, (m, c) => (c ? c.toUpperCase() : '')).replace(/^./, (c) => c.toLowerCase())}(${Object.entries(values).map(([k, v]) => `${k} ${v}`).join(', ')})`;
    const out = { signature: sig, target: TARGET_LABEL[p.target] || p.target, code: code(args.preset, values, live, p.perLayer ? 0 : undefined), numbers: live ? [] : Object.values(values).map(String) };
    if (prepared && prepared.ok) {
      const n = prepared.targets.length, layers = new Set(prepared.targets.map((t) => t.layerId)).size;
      out.target = `${prepared.from === 'selected properties' ? 'Selected properties' : TARGET_LABEL[p.target]} · ${layers} layer${layers === 1 ? '' : 's'}`;
      const own = prepared.targets.filter((x) => x.expression && x.expression.indexOf(TAG) !== 0);
      if (own.length) out.warnings = [`replaces your own expression on ${own.map((x) => x.name).join(', ')} — Restore brings it back`];
      out.writes = [`${n} expression${n === 1 ? '' : 's'} tagged // MOE Expr`].concat(p.perLayer && layers > 1 ? [`delays 0 … ${+((layers - 1) * values.delay).toFixed(3)} s by timeline order`] : [], live ? [`${Object.keys(p.nums).length} Slider Control${Object.keys(p.nums).length === 1 ? '' : 's'} per layer (live, keyframeable)`] : []);
    }
    return out;
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
    const live = !!args.live && Object.keys(p.nums).length > 0;
    const expr = code(args.preset, values, live);
    const rk = p.perLayer ? ranks(prepared.targets, ctx) : null;
    const peek = await host.call('expressions.peek', { compId: ctx.comp.id, items: prepared.targets.map((t) => ({ address: t.address })) });
    const conflicts = prepared.targets.filter((t, i) => peek.items[i].expression && !peek.items[i].expression.startsWith(TAG));
    if (conflicts.length && !args.replace) {
      if (fx) await S.restoreEffects({ data: S.effectsCheckpoint(fx, ctx), host });
      throw Object.assign(new Error(`Already has your own expression: ${conflicts.map((c) => c.name).join(', ')}. Turn on "Replace existing" (restorable).`), { code: 'EXPRESSION_CONFLICT' });
    }
    const set = await host.call('expressions.set', { compId: ctx.comp.id, label: `MOE: ${p.label}`, revertOnError: true, targets: prepared.targets.map((t, i) => ({ address: t.address, expression: rk ? code(args.preset, values, live, rk[i]) : expr, enabled: true })) });
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

module.exports = { quick, PRESETS, TAGS, code, TAG, ranks, TARGET_LABEL, parse };
