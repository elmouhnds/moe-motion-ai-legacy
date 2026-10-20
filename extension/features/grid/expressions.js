'use strict';
/**
 * Grid expression generator — mirrors layouts.js line for line.
 * One "MOE Grid N" null carries every control; each item's Position / Scale /
 * Rotation / Opacity gets an expression tagged `// MOE Grid`. Plain ES3-style
 * JavaScript (no let/arrow/Math.imul) so it runs on both expression engines.
 */
const L = require('./layouts');

const TAG = '// MOE Grid';

/* [name, kind, default, extra] kind: slider | angle | checkbox | menu | layer */
const MODE_CONTROLS = {
  rect: [['Columns', 'slider', 4], ['Spacing X', 'slider', 260], ['Spacing Y', 'slider', 260], ['Row Offset', 'slider', 0], ['Column Offset', 'slider', 0]],
  radial: [['Radius', 'slider', 400], ['Start Angle', 'angle', 0], ['Arc', 'slider', 360], ['Ring Size', 'slider', 0], ['Ring Spacing', 'slider', 160]],
  spiral: [['Radius', 'slider', 60], ['Start Angle', 'angle', 0], ['Angle Step', 'slider', 30], ['Spiral Step', 'slider', 12]],
  phyllo: [['Spread', 'slider', 40], ['Start Angle', 'angle', 0]],
  path: [['Path Layer', 'layer', 0], ['Path Start', 'slider', 0], ['Path End', 'slider', 100], ['Path Offset', 'slider', 0]],
  sphere: [['Radius', 'slider', 400], ['Sphere Spin', 'angle', 0], ['Sphere Tilt', 'angle', 0]]
};
const COMMON_CONTROLS = [
  ['Order', 'menu', 1, L.ORDERS], ['Reverse', 'checkbox', 0], ['Seed', 'slider', 1],
  ['Item Scale', 'slider', 100], ['Scale Step', 'slider', 0], ['Twist', 'angle', 0], ['Face Center', 'checkbox', 0],
  ['Random Position', 'slider', 0], ['Random Rotation', 'slider', 0], ['Random Scale', 'slider', 0],
  ['Build', 'slider', 100], ['Build Stagger', 'slider', 60], ['Build Order', 'menu', 1, L.BUILD_ORDERS], ['Build Style', 'menu', 1, L.BUILD_STYLES], ['Build Distance', 'slider', 120],
  ['Effector', 'layer', 0], ['Effector Radius', 'slider', 300], ['Effector Scale', 'slider', 50], ['Effector Push', 'slider', 0]
];
const KIND = {
  slider: { matchName: 'ADBE Slider Control', param: 'Slider', type: 'OneD' },
  angle: { matchName: 'ADBE Angle Control', param: 'Angle', type: 'OneD' },
  checkbox: { matchName: 'ADBE Checkbox Control', param: 'Checkbox', type: 'OneD' },
  menu: { matchName: 'ADBE Dropdown Control', param: 'Menu', type: 'OneD' },
  layer: { matchName: 'ADBE Layer Control', param: 'Layer', type: 'LAYER_INDEX' }
};

/** Control list for a mode (mode-specific first). */
function controlsFor(mode) { return [...MODE_CONTROLS[mode], ...COMMON_CONTROLS]; }

/** Param key (camelCase) ↔ control name. */
const KEY = {
  Columns: 'columns', 'Spacing X': 'spacingX', 'Spacing Y': 'spacingY', 'Row Offset': 'rowOffset', 'Column Offset': 'columnOffset',
  Radius: 'radius', 'Start Angle': 'startAngle', Arc: 'arc', 'Ring Size': 'ringSize', 'Ring Spacing': 'ringSpacing', 'Angle Step': 'angleStep', 'Spiral Step': 'spiralStep',
  Spread: 'spread', 'Path Start': 'pathStart', 'Path End': 'pathEnd', 'Path Offset': 'pathOffset', 'Sphere Spin': 'sphereSpin', 'Sphere Tilt': 'sphereTilt',
  Order: 'order', Reverse: 'reverse', Seed: 'seed', 'Item Scale': 'itemScale', 'Scale Step': 'scaleStep', Twist: 'twist', 'Face Center': 'faceCenter',
  'Random Position': 'randomPosition', 'Random Rotation': 'randomRotation', 'Random Scale': 'randomScale',
  Build: 'build', 'Build Stagger': 'buildStagger', 'Build Order': 'buildOrder', 'Build Style': 'buildStyle', 'Build Distance': 'buildDistance',
  'Effector Radius': 'effectorRadius', 'Effector Scale': 'effectorScale', 'Effector Push': 'effectorPush'
};
const NAME_OF = Object.fromEntries(Object.entries(KEY).map(([n, k]) => [k, n]));

/** Default params for a mode (merged with every control default). */
function defaultParams(mode) {
  const p = { mode };
  for (const [name, kind, def] of [...Object.values(MODE_CONTROLS).flat(), ...COMMON_CONTROLS]) {
    if (KEY[name] && p[KEY[name]] === undefined) p[KEY[name]] = kind === 'checkbox' ? !!def : def;
  }
  for (const [name, kind, def] of MODE_CONTROLS[mode]) if (KEY[name]) p[KEY[name]] = kind === 'checkbox' ? !!def : def;
  return p;
}

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const PRNG = 'function PR(sd) { var s = Math.abs(Math.round(sd)) % 2147483646 + 1; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }';

function modeBlock(mode, pathAccess, pathClosed, threeD) {
  switch (mode) {
    case 'rect': return [
      'var C = Math.max(1, Math.round(c("Columns"))), R = Math.ceil(n / C), sx = c("Spacing X"), sy = c("Spacing Y"), ro = c("Row Offset"), co = c("Column Offset"), od = c("Order"), row, col;',
      'if (od == 2) { row = k % R; col = Math.floor(k / R); } else { row = Math.floor(k / C); col = k % C; if (od == 3 && row % 2 == 1) { col = C - 1 - col; } }',
      'var x = (col - (C - 1) / 2) * sx + (row % 2 == 1 ? ro / 100 * sx : 0);',
      'var y = (row - (R - 1) / 2) * sy + (col % 2 == 1 ? co / 100 * sy : 0);',
      'var z = 0, face = 0;',
      'var maxD = Math.sqrt(Math.pow(((C - 1) / 2 + Math.abs(ro) / 100) * sx, 2) + Math.pow(((R - 1) / 2 + Math.abs(co) / 100) * sy, 2));'
    ];
    case 'radial': return [
      'var rs = Math.round(c("Ring Size")), per = rs > 0 ? rs : n, ri = Math.floor(k / per), j = k % per, cnt = Math.min(per, n - ri * per), arc = c("Arc");',
      'var a = c("Start Angle") + (cnt > 1 ? (Math.abs(arc) >= 359.999 ? j * arc / cnt : j * arc / (cnt - 1)) : 0);',
      'var rad = c("Radius") + ri * c("Ring Spacing");',
      'var x = rad * Math.cos((a - 90) * Math.PI / 180), y = rad * Math.sin((a - 90) * Math.PI / 180), z = 0, face = a;',
      'var maxD = c("Radius") + (Math.ceil(n / per) - 1) * c("Ring Spacing");'
    ];
    case 'spiral': return [
      'var a = c("Start Angle") + k * c("Angle Step"), rad = c("Radius") + k * c("Spiral Step");',
      'var x = rad * Math.cos((a - 90) * Math.PI / 180), y = rad * Math.sin((a - 90) * Math.PI / 180), z = 0, face = a;',
      'var maxD = Math.abs(c("Radius")) + (n - 1) * Math.abs(c("Spiral Step"));'
    ];
    case 'phyllo': return [
      `var a = c("Start Angle") + k * ${L.GOLDEN_DEG}, rad = c("Spread") * Math.sqrt(k + 0.5);`,
      'var x = rad * Math.cos((a - 90) * Math.PI / 180), y = rad * Math.sin((a - 90) * Math.PI / 180), z = 0, face = a;',
      'var maxD = c("Spread") * Math.sqrt(n - 0.5);'
    ];
    case 'path': return [
      'var x = 0, y = 0, z = 0, face = 0, maxD = 1;',
      'var span = c("Path End") - c("Path Start");',
      `var pct = c("Path Start") + (n > 1 ? span * k / (${pathClosed ? 'Math.abs(span) >= 99.999 ? n : n - 1' : 'n - 1'}) : 0) + c("Path Offset");`,
      'if (pct < 0 || pct > 100) { pct = ((pct % 100) + 100) % 100; }',
      'var PL = null; try { PL = G.effect("Path Layer")(1); } catch (eP) { PL = null; }',
      'if (PL) {',
      `  var acc = ${pathAccess || 'PL.mask(1).maskPath'};`,
      '  var P0 = acc.pointOnPath(pct / 100), T0 = acc.tangentOnPath(pct / 100);',
      '  var Lp = G.fromComp(PL.toComp(P0)), Lt = G.fromComp(PL.toComp([P0[0] + T0[0], P0[1] + T0[1]]));',
      '  x = Lp[0]; y = Lp[1];',
      '  face = Math.atan2(Lt[1] - Lp[1], Lt[0] - Lp[0]) * 180 / Math.PI;',
      '}'
    ];
    case 'sphere': return [
      `var yN = n > 1 ? 1 - (k + 0.5) / n * 2 : 0, rr = Math.sqrt(Math.max(0, 1 - yN * yN)), th = k * ${L.GOLDEN_RAD};`,
      'var X = Math.cos(th) * rr, Y = yN, Z = Math.sin(th) * rr, sp = c("Sphere Spin") * Math.PI / 180, tl = c("Sphere Tilt") * Math.PI / 180;',
      'var X1 = X * Math.cos(sp) + Z * Math.sin(sp), Z1 = -X * Math.sin(sp) + Z * Math.cos(sp);',
      'var Y2 = Y * Math.cos(tl) - Z1 * Math.sin(tl), Z2 = Y * Math.sin(tl) + Z1 * Math.cos(tl);',
      'var x = X1 * c("Radius"), y = Y2 * c("Radius"), z = Z2 * c("Radius"), face = Math.atan2(X1, -Z2) * 180 / Math.PI;',
      'var maxD = c("Radius");'
    ];
    default: throw new Error(`Unknown grid mode ${mode}`);
  }
}

/**
 * Build the four expressions for item i of n.
 * opts: { mode, gridName, pathAccess, pathClosed }
 */
function build(i, n, { mode, gridName, pathAccess = null, pathClosed = false }) {
  const threeD = mode === 'sphere';
  const head = [
    `${TAG} · ${esc(gridName)}`,
    `var G = thisComp.layer("${esc(gridName)}");`,
    'function c(nm) { return G.effect(nm)(1).value; }',
    PRNG,
    `var i = ${i}, n = ${n}, seed = c("Seed");`,
    'var k = c("Reverse") == 1 ? n - 1 - i : i;',
    'if (c("Order") == 4) { var r0 = PR(seed), pm = [], q; for (q = 0; q < n; q++) { pm.push(q); } for (q = n - 1; q > 0; q--) { var j0 = Math.floor(r0() * (q + 1)); var t0 = pm[q]; pm[q] = pm[j0]; pm[j0] = t0; } k = pm[k]; }',
    ...modeBlock(mode, pathAccess, pathClosed, threeD),
    'var lin = n > 1 ? k / (n - 1) : 0;',
    mode === 'path' ? 'var dd = Math.abs(lin - 0.5) * 2;' : 'var dd = maxD > 0 ? Math.min(1, Math.sqrt(x * x + y * y + z * z) / maxD) : 0;',
    'var rb = PR(seed + 7919), rv = 0, q2; for (q2 = 0; q2 <= i; q2++) { rv = rb(); }',
    'var bo = c("Build Order"), f = bo == 1 ? lin : (bo == 2 ? 1 - lin : (bo == 3 ? dd : (bo == 4 ? 1 - dd : rv)));',
    'var B = c("Build") / 100, S = Math.min(Math.max(c("Build Stagger") / 100, 0), 1);',
    'var pr = Math.min(Math.max((B - f * S) / Math.max(1 - S, 0.05), 0), 1);',
    'var eo = 1 - Math.pow(1 - pr, 3), bk = 1 + 2.70158 * Math.pow(pr - 1, 3) + 1.70158 * Math.pow(pr - 1, 2);',
    'var rr2 = PR(seed * 31 + i * 7 + 3), jp = c("Random Position");',
    'var jx = (rr2() * 2 - 1) * jp, jy = (rr2() * 2 - 1) * jp, jr = (rr2() * 2 - 1) * c("Random Rotation"), js = (rr2() * 2 - 1) * c("Random Scale");',
    'var sc = c("Item Scale") / 100 * Math.max(0, 1 + c("Scale Step") / 100 * k) * Math.max(0, 1 + js / 100);',
    'var rot = c("Twist") * k + jr + (c("Face Center") == 1 ? face : 0);',
    'var op = 1, dy = 0, st = c("Build Style"), bd = c("Build Distance");',
    'if (st == 1) { sc *= Math.max(bk, 0); } else if (st == 2) { op *= eo; } else if (st == 3) { dy += (1 - eo) * bd; op *= eo; } else if (st == 4) { sc *= Math.max(bk, 0); op *= eo; } else if (st == 5) { dy -= (1 - eo) * bd; op *= eo; } else if (st == 6) { sc *= eo; rot += (1 - eo) * -180; }',
    'var E = null; try { E = G.effect("Effector")(1); } catch (eE) { E = null; }',
    'var ew = 0, ed = [0, 0];',
    `if (E) { var WP = G.toComp(${threeD ? '[x + jx, y + jy + dy, z]' : '[x + jx, y + jy + dy]'}), EP = E.toComp(E.anchorPoint), D = length([WP[0], WP[1]], [EP[0], EP[1]]), ER = Math.max(c("Effector Radius"), 0.001); ew = Math.min(Math.max(1 - D / ER, 0), 1); ew = ew * ew * (3 - 2 * ew); if (D > 0.001) { ed = [(WP[0] - EP[0]) / D, (WP[1] - EP[1]) / D]; } }`,
    'sc *= 1 + ew * c("Effector Scale") / 100;'
  ].join('\n');
  return {
    position: `${head}\nvar ep = ew * c("Effector Push"), px = x + jx + ed[0] * ep, py = y + jy + dy + ed[1] * ep;\nvalue.length > 2 ? [px, py, ${threeD ? 'z' : 'value[2]'}] : [px, py];`,
    scale: `${head}\nmul(value, sc);`,
    rotation: `${head}\nvalue + rot;`,
    opacity: `${head}\nvalue * op;`
  };
}

const PROP_ADDR = {
  position: ['ADBE Transform Group', 'ADBE Position'],
  scale: ['ADBE Transform Group', 'ADBE Scale'],
  rotation: ['ADBE Transform Group', 'ADBE Rotate Z'],
  opacity: ['ADBE Transform Group', 'ADBE Opacity']
};

/** effects.ensure items for the grid null's controls with values from params. */
function controlItems(mode, params, layerIndexOf = () => 0) {
  return controlsFor(mode).map(([name, kind, def]) => {
    const K = KIND[kind];
    let value = params[KEY[name]] !== undefined ? params[KEY[name]] : def;
    if (kind === 'checkbox') value = value ? 1 : 0;
    if (kind === 'layer') value = layerIndexOf(name);
    return { key: name, matchName: K.matchName, before: [], params: [{ id: name, value, names: [K.param], suffix: 1, nth: { type: K.type, n: 1 } }] };
  });
}

/** Address of a control's value on the grid null. */
function controlAddress(layerId, name) {
  const kind = controlsFor('rect').concat(...Object.values(MODE_CONTROLS)).find((c) => c[0] === name);
  return { layerId, matchNames: ['ADBE Effect Parade', `name:${name}`, `name:${KIND[kind ? kind[1] : 'slider'].param}`] };
}

module.exports = { TAG, MODE_CONTROLS, COMMON_CONTROLS, KIND, KEY, NAME_OF, controlsFor, defaultParams, build, PROP_ADDR, controlItems, controlAddress };
