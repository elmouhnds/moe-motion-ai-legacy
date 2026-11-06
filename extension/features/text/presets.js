'use strict';
/**
 * Text animation presets as DATA. Each becomes one AE Text Animator with a Range
 * Selector whose Offset is keyed −100 → 100 (the technique used by the owner's presets).
 *
 * basedOn: 1 characters · 2 characters excl. spaces · 3 words · 4 lines   (ADBE Text Range Type2)
 * shape:   1 square · 2 ramp up · 3 ramp down · 4 triangle · 5 round · 6 smooth   (ADBE Text Range Shape)
 * props (values are the HIDDEN state the text animates from / to):
 *   position [x,y,z] · scale [x,y,z] (%) · rotation (°) · opacity (%) · blur [x,y] · tracking · skew (°)
 * In presets use shape 2 (ramp up), Out presets shape 3 (ramp down).
 */

const OWNER_EASE = { first: [33.33, 33.33], last: [33.33, 16.67] }; // decoded from the owner's .ffx

const P = (o) => Object.assign({ kind: 'in', basedOn: 3, shape: 2, easeHigh: 25, easeLow: 100, smoothness: 100, randomize: 0, duration: 1.2, ease: OWNER_EASE, props: {}, source: 'moe' }, o, { shape: o.shape || ((o.kind || 'in') === 'out' ? 3 : 2) });

const PRESETS = [
  // ---- the owner's presets (values decoded from the .ffx files) ----
  P({ id: 'moe-in-down', name: 'IN Down', group: 'Signature', source: 'owner', duration: 1.733, props: { position: [0, -100, 0], opacity: 0, blur: [16, 16] } }),
  P({ id: 'moe-in-up', name: 'IN Up', group: 'Signature', source: 'owner', duration: 1.733, props: { position: [0, 88, 0], opacity: 0, blur: [16, 16] } }),
  P({ id: 'moe-in-right', name: 'IN Right', group: 'Signature', source: 'owner', duration: 1.167, ease: { first: [16.67, 33.33], last: [33.33, 16.67] }, props: { position: [-100, 0, 0], opacity: 0, blur: [16, 16] } }),
  P({ id: 'moe-out-down', name: 'OUT Down', group: 'Signature', source: 'owner', kind: 'out', duration: 1.167, ease: { first: [16.67, 33.33], last: [33.33, 16.67] }, props: { position: [0, 100, 0], opacity: 0, blur: [16, 16] } }),
  // ---- derived from the signature set ----
  P({ id: 'moe-in-left', name: 'IN Left', group: 'Signature', duration: 1.167, props: { position: [100, 0, 0], opacity: 0, blur: [16, 16] } }),
  P({ id: 'moe-out-up', name: 'OUT Up', group: 'Signature', kind: 'out', duration: 1.167, props: { position: [0, -100, 0], opacity: 0, blur: [16, 16] } }),
  P({ id: 'moe-out-right', name: 'OUT Right', group: 'Signature', kind: 'out', duration: 1.167, props: { position: [100, 0, 0], opacity: 0, blur: [16, 16] } }),
  P({ id: 'moe-out-left', name: 'OUT Left', group: 'Signature', kind: 'out', duration: 1.167, props: { position: [-100, 0, 0], opacity: 0, blur: [16, 16] } }),
  // ---- new premium IN ----
  P({ id: 'rise-soft', name: 'Soft Rise', group: 'Slide', duration: 1.1, easeHigh: 40, props: { position: [0, 45, 0], opacity: 0, blur: [6, 6] } }),
  P({ id: 'line-reveal', name: 'Line Reveal', group: 'Slide', basedOn: 4, duration: 1.0, props: { position: [0, 80, 0], opacity: 0 } }),
  P({ id: 'skew-slide', name: 'Skew Slide', group: 'Slide', duration: 1.1, props: { position: [-120, 0, 0], skew: 25, opacity: 0, blur: [10, 0] } }),
  P({ id: 'blur-focus', name: 'Blur Focus', group: 'Blur', duration: 1.3, props: { opacity: 0, blur: [40, 40] } }),
  P({ id: 'wide-focus', name: 'Wide Focus', group: 'Blur', basedOn: 4, duration: 1.4, easeHigh: 60, props: { opacity: 0, tracking: 120, blur: [24, 24] } }),
  P({ id: 'char-fade', name: 'Char Fade', group: 'Fade', basedOn: 2, duration: 1.0, props: { opacity: 0 } }),
  P({ id: 'random-fade', name: 'Random Fade', group: 'Fade', basedOn: 2, randomize: 1, duration: 1.2, props: { opacity: 0, blur: [8, 8] } }),
  P({ id: 'typewriter', name: 'Type On', group: 'Type', basedOn: 1, shape: 1, smoothness: 0, easeHigh: 0, easeLow: 0, duration: 1.5, ease: { first: [0.1, 0.1], last: [0.1, 0.1] }, props: { opacity: 0 } }),
  P({ id: 'zoom-in', name: 'Zoom In', group: 'Scale', basedOn: 2, duration: 1.0, props: { scale: [0, 0, 100], opacity: 0 } }),
  P({ id: 'zoom-out-in', name: 'Zoom Down', group: 'Scale', basedOn: 3, duration: 1.1, props: { scale: [220, 220, 100], opacity: 0, blur: [12, 12] } }),
  P({ id: 'spin-in', name: 'Spin In', group: 'Rotate', basedOn: 2, duration: 1.2, props: { rotation: 180, scale: [0, 0, 100], opacity: 0 } }),
  P({ id: 'cascade', name: 'Cascade', group: 'Rotate', basedOn: 2, duration: 1.2, props: { position: [0, 40, 0], rotation: -18, opacity: 0 } }),
  P({ id: 'tracking-in', name: 'Tracking In', group: 'Type', basedOn: 4, duration: 1.3, easeHigh: 70, props: { tracking: 60, opacity: 0 } }),
  // ---- v0.58 Apple-style (APPLE_MOTION.md): scale + blur + opacity, by line or by word (Arabic-safe) ----
  P({ id: 'hero-reveal', name: 'Hero Reveal', group: 'Hero', basedOn: 4, duration: 1.2, easeHigh: 60, props: { scale: [118, 118, 100], opacity: 0, blur: [30, 30] } }),
  P({ id: 'word-stagger', name: 'Word Stagger', group: 'Hero', basedOn: 3, duration: 1.1, easeHigh: 45, props: { position: [0, 40, 0], opacity: 0, blur: [14, 14] } }),
  P({ id: 'word-burst', name: 'Word Burst', group: 'Hero', basedOn: 3, duration: 0.9, props: { scale: [40, 40, 100], opacity: 0, blur: [20, 20] } }),
  P({ id: 'iris-in', name: 'Iris In', group: 'Hero', basedOn: 4, duration: 1.0, easeHigh: 70, props: { scale: [160, 160, 100], opacity: 0, blur: [50, 50] } }),
  // ---- new premium OUT ----
  P({ id: 'sink-out', name: 'Soft Sink', group: 'Slide', kind: 'out', duration: 0.9, props: { position: [0, 45, 0], opacity: 0, blur: [6, 6] } }),
  P({ id: 'blur-out', name: 'Blur Away', group: 'Blur', kind: 'out', duration: 1.0, props: { opacity: 0, blur: [40, 40] } }),
  P({ id: 'zoom-out', name: 'Zoom Out', group: 'Scale', kind: 'out', basedOn: 2, duration: 0.9, props: { scale: [0, 0, 100], opacity: 0 } }),
  P({ id: 'scatter-out', name: 'Scatter Out', group: 'Fade', kind: 'out', basedOn: 2, randomize: 1, duration: 1.0, props: { opacity: 0, position: [0, -30, 0], blur: [10, 10] } }),
  P({ id: 'backspace', name: 'Backspace', group: 'Type', kind: 'out', basedOn: 1, shape: 1, smoothness: 0, easeHigh: 0, easeLow: 0, duration: 1.0, ease: { first: [0.1, 0.1], last: [0.1, 0.1] }, props: { opacity: 0 } }),
  P({ id: 'hero-out', name: 'Hero Out', group: 'Hero', kind: 'out', basedOn: 4, duration: 0.9, props: { scale: [92, 92, 100], opacity: 0, blur: [24, 24] } }),
  P({ id: 'stagger-out', name: 'Stagger Out', group: 'Hero', kind: 'out', basedOn: 3, duration: 0.9, props: { position: [0, -30, 0], opacity: 0, blur: [12, 12] } }),
  P({ id: 'tracking-out', name: 'Tracking Out', group: 'Type', kind: 'out', basedOn: 4, duration: 1.0, props: { tracking: 80, opacity: 0, blur: [12, 0] } })
];

PRESETS.forEach((p) => { p.arabicSafe = p.basedOn >= 3; });

const PROP_MATCH = {
  position: 'ADBE Text Position 3D', scale: 'ADBE Text Scale 3D', rotation: 'ADBE Text Rotation',
  opacity: 'ADBE Text Opacity', blur: 'ADBE Text Blur', tracking: 'ADBE Text Tracking Amount', skew: 'ADBE Text Skew'
};

/** Direction override for slide presets: rotates the position vector. */
function directed(position, direction) {
  if (!position || !direction || direction === 'preset') return position;
  const mag = Math.hypot(position[0], position[1]) || 100;
  const v = { up: [0, mag], down: [0, -mag], left: [mag, 0], right: [-mag, 0] }[direction]; // "from" offsets
  return v ? [v[0], v[1], position[2] || 0] : position;
}

/**
 * Build the host spec. opts: { duration, distance (%), basedOn ('preset'|1|2|3|4), direction }
 */
function buildSpec(preset, opts = {}) {
  const dist = (opts.distance === undefined ? 100 : opts.distance) / 100;
  const props = [];
  for (const [k, v] of Object.entries(preset.props)) {
    let value = v;
    if (k === 'position') value = directed(v, opts.direction).map((c) => c * dist);
    if (k === 'tracking') value = v * dist;
    props.push({ matchName: PROP_MATCH[k], value });
  }
  const basedOn = opts.basedOn && opts.basedOn !== 'preset' ? Number(opts.basedOn) : preset.basedOn;
  const duration = opts.duration || preset.duration;
  return {
    selector: {
      start: 0, end: 100,
      advanced: { units: 1, basedOn, mode: 1, amount: 100, shape: preset.shape, smoothness: preset.smoothness, easeHigh: preset.easeHigh, easeLow: preset.easeLow, randomize: preset.randomize }
    },
    props,
    keys: {
      matchName: 'ADBE Text Percent Offset',
      list: [
        { t: 0, v: -100, inInfl: preset.ease.first[0], outInfl: preset.ease.first[1] },
        { t: duration, v: 100, inInfl: preset.ease.last[0], outInfl: preset.ease.last[1] }
      ]
    },
    duration
  };
}

module.exports = { PRESETS, PROP_MATCH, buildSpec, OWNER_EASE };
