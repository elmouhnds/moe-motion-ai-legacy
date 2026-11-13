'use strict';
/**
 * Proximity expression generator. One effector null carries every amount as an
 * Expression Control; each target property gets ONE expression that combines the
 * chosen features. Vector maths uses add()/sub()/mul() because the JavaScript
 * expression engine has no array operators. Expressions are plain ES3-style JavaScript so they run on the
 * JavaScript and the Legacy ExtendScript expression engines.
 */

const TAG = '// MOE Proximity';

/** Effector controls: [name, effect matchName, param match, default]. */
const CONTROLS = [
  ['Proximity Radius', 'ADBE Slider Control', 'Slider', 400],
  ['Falloff', 'ADBE Slider Control', 'Slider', 50],
  ['Invert', 'ADBE Checkbox Control', 'Checkbox', 0],
  ['Scale Amount', 'ADBE Slider Control', 'Slider', 50],
  ['Push Amount', 'ADBE Slider Control', 'Slider', 150],
  ['Offset X', 'ADBE Slider Control', 'Slider', 0],
  ['Offset Y', 'ADBE Slider Control', 'Slider', -120],
  ['Offset Z', 'ADBE Slider Control', 'Slider', -300],
  ['Rotation Amount', 'ADBE Slider Control', 'Slider', 90],
  ['Opacity Amount', 'ADBE Slider Control', 'Slider', 100],
  ['Blur Amount', 'ADBE Slider Control', 'Slider', 20],
  ['Color Amount', 'ADBE Slider Control', 'Slider', 100],
  ['Shift Color', 'ADBE Color Control', 'Color', [1, 0.48, 0.35, 1]]
];

const FEATURES = {
  scaleUp: { prop: 'scale', label: 'Scale Up' },
  scaleDown: { prop: 'scale', label: 'Scale Down' },
  pushAway: { prop: 'position', label: 'Push Away' },
  pullToward: { prop: 'position', label: 'Pull Toward' },
  positionX: { prop: 'position', label: 'Position X' },
  positionY: { prop: 'position', label: 'Position Y' },
  positionZ: { prop: 'position', label: 'Position Z', threeD: true },
  rotationZ: { prop: 'rotationZ', label: 'Rotation Z' },
  rotationX: { prop: 'rotationX', label: 'Rotation X', threeD: true },
  rotationY: { prop: 'rotationY', label: 'Rotation Y', threeD: true },
  lookAt2D: { prop: 'rotationZ', label: 'Look At 2D' },
  fadeOpacity: { prop: 'opacity', label: 'Fade Opacity' },
  revealOpacity: { prop: 'opacity', label: 'Reveal Opacity' },
  blur: { prop: 'blur', label: 'Blur' },
  colorShift: { prop: 'color', label: 'Color Shift' }
};

const EXCLUSIVE = [['scaleUp', 'scaleDown'], ['pushAway', 'pullToward'], ['fadeOpacity', 'revealOpacity']];

const PROP_ADDR = {
  position: ['ADBE Transform Group', 'ADBE Position'],
  scale: ['ADBE Transform Group', 'ADBE Scale'],
  rotationZ: ['ADBE Transform Group', 'ADBE Rotate Z'],
  rotationX: ['ADBE Transform Group', 'ADBE Rotate X'],
  rotationY: ['ADBE Transform Group', 'ADBE Rotate Y'],
  opacity: ['ADBE Transform Group', 'ADBE Opacity'],
  blur: ['ADBE Effect Parade', 'name:MOE Prox Blur', 'name:Blurriness'],
  color: ['ADBE Effect Parade', 'name:MOE Prox Color', 'name:Amount to Tint']
};

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** Weight block: w = 1 at the effector, 0 at the radius (smooth, falloff-shaped, invertible). */
function header(effector, { usePosition, distance3D }) {
  const e = esc(effector);
  return [
    `${TAG} · ${e}`,
    `var E = thisComp.layer("${e}");`,
    'var R = Math.max(E.effect("Proximity Radius")("Slider"), 0.001);',
    'var F = clamp(E.effect("Falloff")("Slider"), 0, 100) / 100;',
    usePosition
      ? 'var P = thisLayer.hasParent ? thisLayer.parent.toComp(value) : value;'
      : 'var P = thisLayer.hasParent ? thisLayer.parent.toComp(transform.position) : transform.position;',
    'var Q = E.toComp(E.anchorPoint);',
    distance3D ? 'var D = length(P, Q);' : 'var D = length([P[0], P[1]], [Q[0], Q[1]]);',
    'var w = clamp(1 - D / R, 0, 1);',
    'w = w * w * (3 - 2 * w);',
    'w = Math.pow(w, 1 + F * 2);',
    'if (E.effect("Invert")("Checkbox") == 1) { w = 1 - w; }'
  ].join('\n');
}

function ctl(name) { return `E.effect("${name}")("${name === 'Shift Color' ? 'Color' : name === 'Invert' ? 'Checkbox' : 'Slider'}")`; }

/** Build { prop: expression } for a feature set. Pure; returns errors for impossible sets. */
function build(effector, features, { threeD = false, distance3D = false } = {}) {
  const on = Object.keys(FEATURES).filter((k) => features[k]);
  const errors = [];
  for (const [a, b] of EXCLUSIVE) if (features[a] && features[b]) errors.push(`${FEATURES[a].label} and ${FEATURES[b].label} cannot be combined`);
  const skipped = on.filter((k) => FEATURES[k].threeD && !threeD);
  const active = on.filter((k) => !skipped.includes(k));
  const out = {};
  const by = (prop) => active.filter((k) => FEATURES[k].prop === prop);

  if (by('scale').length) {
    const sign = features.scaleUp ? '+' : '-';
    out.scale = `${header(effector, { distance3D })}\nvar k = Math.max(0, 1 ${sign} w * ${ctl('Scale Amount')} / 100);\nmul(value, k);`;
  }
  if (by('position').length) {
    const lines = [header(effector, { usePosition: true, distance3D }), 'var off = [0, 0, 0];'];
    if (features.pushAway || features.pullToward) {
      lines.push(`var dir = (D > 0.001) ? normalize(${distance3D ? 'sub(P, Q)' : '[P[0] - Q[0], P[1] - Q[1], 0]'}) : [0, 0, 0];`);
      lines.push(`off = add(off, mul(dir, w * ${ctl('Push Amount')} * ${features.pushAway ? 1 : -1}));`);
    }
    if (features.positionX) lines.push(`off[0] += w * ${ctl('Offset X')};`);
    if (features.positionY) lines.push(`off[1] += w * ${ctl('Offset Y')};`);
    if (features.positionZ && threeD) lines.push(`off[2] += w * ${ctl('Offset Z')};`);
    lines.push('(value.length > 2) ? add(value, off) : add(value, [off[0], off[1]]);');
    out.position = lines.join('\n');
  }
  if (by('rotationZ').length) {
    const parts = [];
    if (features.rotationZ) parts.push(`w * ${ctl('Rotation Amount')}`);
    if (features.lookAt2D) parts.push('w * radiansToDegrees(Math.atan2(Q[1] - P[1], Q[0] - P[0]))');
    out.rotationZ = `${header(effector, { distance3D })}\nvalue + ${parts.join(' + ')};`;
  }
  if (features.rotationX && threeD) out.rotationX = `${header(effector, { distance3D })}\nvalue + w * ${ctl('Rotation Amount')};`;
  if (features.rotationY && threeD) out.rotationY = `${header(effector, { distance3D })}\nvalue + w * ${ctl('Rotation Amount')};`;
  if (by('opacity').length) {
    out.opacity = features.fadeOpacity
      ? `${header(effector, { distance3D })}\nvalue * (1 - w * ${ctl('Opacity Amount')} / 100);`
      : `${header(effector, { distance3D })}\nvalue * (1 - (1 - w) * ${ctl('Opacity Amount')} / 100);`;
  }
  if (features.blur) out.blur = `${header(effector, { distance3D })}\nw * ${ctl('Blur Amount')};`;
  if (features.colorShift) out.color = `${header(effector, { distance3D })}\nw * ${ctl('Color Amount')};`;
  return { expressions: out, errors, skipped };
}

/**
 * v0.93 Controls on demand (docs/features/CONTROLS_ON_DEMAND.md): the control names (in Effect Controls order) the
 * expressions of these features actually read — taken from the generated code itself, so it can never drift from it.
 */
function needed(features, opts = {}) {
  const b = build('E', features, { threeD: true, distance3D: !!opts.distance3D });
  const text = Object.values(b.expressions || {}).join('\n');
  return CONTROLS.map((c) => c[0]).filter((n) => text.indexOf(`E.effect("${n}")`) >= 0);
}

module.exports = { TAG, CONTROLS, FEATURES, EXCLUSIVE, PROP_ADDR, build, needed };
