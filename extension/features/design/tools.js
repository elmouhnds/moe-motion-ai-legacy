'use strict';
const { plan: PLAN } = require('../../core/host/plan'); // v0.94 one Ctrl+Z per run
/**
 * Design tools (category "design"):
 *   design.insertShape  a Lucide icon (as editable Bézier paths) or a native AE primitive
 *                       (Rectangle / Ellipse / Polystar) as a "MOE Icon • …" / "MOE Shape • …"
 *                       shape layer, with line / solid / line+fill / duotone styles and an optional
 *                       draw-on, pop or fade at the playhead.
 *   design.background   "MOE Background" solid at the bottom of the comp: linear / radial Gradient
 *                       Ramp, 4-Colour mesh or flat colour from a palette, optional film grain
 *                       (Noise), and motion (v0.18, bgMotion.js): the colour points move (drift,
 *                       orbit, swirl, wave, breathe, wander) and the colours change (cycle, swap,
 *                       hue, pulse) through tagged expressions driven by three live sliders.
 *   design.colorize     colour the selected layers from a palette: cycle, shuffle (seeded) or
 *                       blend along the selection order.
 */
const SVG = require('./svgShape');
const LIB = require('./shapesLib');
const PAL = require('./palettes');
const B = require('../brand/brands');
const S = require('../compositing/shared');
const BM = require('./bgMotion');

const HEX = /^#[0-9a-fA-F]{6}$/;
const close = (a, b, t = 0.006) => !!a && !!b && [0, 1, 2].every((i) => Math.abs(a[i] - b[i]) < t);
const TAG = '// MOE Background';
const BG_KEYS = { gradient: 'MOE Gradient', mesh: 'MOE Mesh', grain: 'MOE Grain' };

/* ------------------------------------------------------------------ Insert shape */

const STYLE_OPTIONS = [{ value: 'line', label: 'Line' }, { value: 'fill', label: 'Solid' }, { value: 'both', label: 'Both' }, { value: 'duotone', label: 'Duo' }];

function shapeLook(args, isIcon, outlineOnly) {
  const size = args.size;
  const sw = args.strokeWidth > 0 ? args.strokeWidth : (isIcon ? size / 12 : Math.max(2, size / 40));
  const c1 = B.hexToRgb(args.color), c2 = B.hexToRgb(args.color2 || args.color);
  const cap = isIcon ? 2 : 1, join = isIcon ? 2 : 1;
  let style = args.style;
  if (outlineOnly && style === 'fill') style = 'line';
  switch (style) {
    case 'fill': return isIcon ? { stroke: { color: c1, width: sw, cap, join }, fill: { color: c1, rule: 2 } } : { stroke: null, fill: { color: c1 } };
    case 'both': return { stroke: { color: c1, width: sw, cap, join }, fill: { color: c2, rule: 2 } };
    case 'duotone': return { stroke: { color: c1, width: sw, cap, join }, fill: { color: c2, opacity: 35, rule: 2 } };
    default: return { stroke: { color: c1, width: sw, cap, join }, fill: null };
  }
}

const insertShape = {
  id: 'design.insertShape',
  version: '1.0.0',
  category: 'design',
  group: 'Shapes & Icons',
  name: 'Insert Shape / Icon',
  description: 'Insert one of 1,899 vector icons (Lucide) as editable Bézier paths, or a native After Effects shape (rectangle, ellipse, polygon, star, burst, seal…) that stays parametric. Line, solid, line + fill or duotone; optional draw-on, pop or fade at the playhead.',
  keywords: ['icon', 'icons', 'shape', 'vector', 'svg', 'lucide', 'star', 'circle', 'badge', 'burst', 'arrow', 'insert', 'graphic', 'symbol'],
  icon: 'shapes',
  params: {
    source: { type: 'enum', label: 'Source', default: 'icon', hidden: true, options: [{ value: 'icon', label: 'Icon' }, { value: 'primitive', label: 'Shape' }] },
    icon: { type: 'string', label: 'Icon', default: 'heart', hidden: true, maxLength: 80 },
    primitive: { type: 'enum', label: 'Shape', default: 'circle', hidden: true, options: LIB.PRIMITIVES.map((p) => ({ value: p.id, label: p.label })) },
    style: { type: 'enum', label: 'Style', default: 'line', options: STYLE_OPTIONS },
    color: { type: 'string', label: 'Colour', default: '#FF7A59', maxLength: 7, format: 'color' },
    color2: { type: 'string', label: 'Fill colour', default: '#FFB38A', maxLength: 7, format: 'color', showIf: (a) => a.style === 'both' || a.style === 'duotone' },
    size: { type: 'number', label: 'Size', min: 8, max: 4000, step: 1, default: 240, unit: 'px' },
    strokeWidth: { type: 'number', label: 'Line width', min: 0, max: 400, step: 0.5, default: 0, unit: 'px', description: '0 = automatic (matches the icon design)', showIf: (a) => a.style !== 'fill' || a.source === 'icon' },
    animate: { type: 'enum', label: 'Animate', default: 'pop', options: [{ value: 'none', label: 'None' }, { value: 'draw', label: 'Draw' }, { value: 'pop', label: 'Pop' }, { value: 'fade', label: 'Fade' }] },
    duration: { type: 'number', label: 'Duration', min: 0.1, max: 10, step: 0.05, default: 0.7, unit: 's', showIf: (a) => a.animate !== 'none' },
    name: { type: 'string', label: 'Layer name', default: '', maxLength: 120, advanced: true, description: 'Empty = "MOE Icon • <name>"' }
  },
  requires: { comp: true },
  permissions: ['modify.layers', 'modify.keyframes'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Insert a vector icon (Lucide name, e.g. "heart", "rocket", "map-pin") or a native shape (circle, star, burst, seal, pill…) as an editable shape layer, optionally animated (draw / pop / fade).' },
  uses: { hostOps: ['shapes.insert', 'shapes.trim', 'keys.write', 'layers.remove'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Insert' },

  prepare(args, ctx) {
    if (!HEX.test(args.color || '')) return { ok: false, error: 'Colour must be #RRGGBB' };
    if ((args.style === 'both' || args.style === 'duotone') && !HEX.test(args.color2 || '')) return { ok: false, error: 'Fill colour must be #RRGGBB' };
    const isIcon = args.source !== 'primitive';
    let label, request;
    if (isIcon) {
      const ic = LIB.icon(args.icon);
      if (!ic) return { ok: false, error: `Unknown icon "${args.icon}"` };
      const conv = SVG.toAEShapes(ic.n, { size: args.size });
      if (!conv.shapes.length) return { ok: false, error: 'This icon has no drawable paths' };
      label = LIB.pretty(ic.name);
      request = { paths: conv.shapes };
    } else {
      const p = LIB.primitive(args.primitive);
      if (!p) return { ok: false, error: `Unknown shape "${args.primitive}"` };
      label = p.label;
      request = { primitive: LIB.primitiveSpec(p, args.size), outlineOnly: !!p.spec.outline };
    }
    if (args.animate === 'draw' && args.style === 'fill' && !isIcon) return { ok: false, error: 'Draw-on needs a line: choose Line, Line + Fill or Duotone' };
    const look = shapeLook(args, isIcon, request.outlineOnly);
    const name = (args.name || '').trim() || `MOE ${isIcon ? 'Icon' : 'Shape'} • ${label}`;
    return {
      ok: true, isIcon, label, name, request, look,
      preview: {
        summary: `${label} · ${Math.round(args.size)} px · ${STYLE_OPTIONS.find((o) => o.value === args.style).label}${args.animate !== 'none' ? ` · ${args.animate} ${args.duration}s` : ''}`,
        items: [isIcon ? `${request.paths.length} Bézier path(s), editable` : 'Native parametric shape (stays editable)', `Layer "${name}" at the comp centre, starting at the playhead`]
      }
    };
  },

  async execute({ args, ctx, prepared, host }) {
    const t0 = ctx.comp.time || 0;
    const made = await host.call('shapes.insert', Object.assign({
      compId: ctx.comp.id, name: prepared.name, groupName: prepared.label, inPoint: t0 > 0 ? t0 : undefined
    }, prepared.request.paths ? { paths: prepared.request.paths } : { primitive: prepared.request.primitive }, prepared.look));
    const out = { made, anim: null, expected: prepared.request.paths ? prepared.request.paths.length : 0 };
    const d = args.duration, t1 = t0 + d;
    const easeIn = { speed: 0, influence: 80 }, easeOut = { speed: 0, influence: 45 };
    if (args.animate === 'draw') {
      const trim = await host.call('shapes.trim', { compId: ctx.comp.id, layerId: made.layerId });
      out.anim = await host.call('keys.write', { compId: ctx.comp.id, label: 'MOE: Draw On', items: [{ address: trim.end, keys: [{ t: t0, v: 0, easeOut }, { t: t1, v: 100, easeIn }] }] });
    } else if (args.animate === 'pop') {
      out.anim = await host.call('keys.write', { compId: ctx.comp.id, label: 'MOE: Pop', items: [{ address: made.addresses.scale, keys: [{ t: t0, v: [0, 0], easeOut }, { t: t0 + d * 0.7, v: [110, 110], easeIn: { speed: 0, influence: 60 }, easeOut: { speed: 0, influence: 50 } }, { t: t1, v: [100, 100], easeIn }] }] });
    } else if (args.animate === 'fade') {
      out.anim = await host.call('keys.write', { compId: ctx.comp.id, label: 'MOE: Fade', items: [{ address: made.addresses.opacity, keys: [{ t: t0, v: 0, easeOut }, { t: t1, v: 100, easeIn }] }] });
    }
    return out;
  },

  verify({ args, prepared, result }) {
    const m = result.made;
    const checks = [{ ok: !!m.layerId, label: m.name, detail: `layer ${m.index} created` }];
    if (prepared.isIcon) checks.push({ ok: m.paths === result.expected, label: 'Paths', detail: `${m.paths} of ${result.expected} read back` });
    else checks.push({ ok: !!m.primitive, label: 'Shape', detail: m.primitive || 'missing' });
    if (prepared.look.stroke) checks.push({ ok: !!m.stroke && close(m.stroke.color, prepared.look.stroke.color) && Math.abs(m.stroke.width - prepared.look.stroke.width) < 0.01, label: 'Line', detail: m.stroke ? `${m.stroke.width.toFixed(1)} px` : 'missing' });
    if (prepared.look.fill) checks.push({ ok: !!m.fill && close(m.fill.color, prepared.look.fill.color), label: 'Fill', detail: m.fill ? B.rgbToHex(m.fill.color) : 'missing' });
    if (args.animate !== 'none') {
      const it = result.anim && result.anim.items[0];
      checks.push({ ok: !!it && it.written.length >= 2, label: `Animation (${args.animate})`, detail: it ? `${it.written.length} keys` : 'not written' });
    }
    return { ok: checks.every((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, layerId: result.made.layerId }; },
  async restore({ data, host }) {
    const r = await host.call('layers.remove', { compId: data.compId, layerIds: [data.layerId], label: 'MOE: Remove Shape', onlyNamed: 'MOE ' });
    return { ok: r.removed.length === 1 };
  },
  summarize(result) { return `${result.made.name} inserted${result.anim ? ' and animated' : ''}`; }
};

/* ------------------------------------------------------------------ Background */

/** Gradient geometry in comp pixels (pure; tested). */
function gradientPoints(style, w, h, angle, spread) {
  const cx = w / 2, cy = h / 2;
  const D = Math.hypot(w, h) / 2 * (spread / 100);
  if (style === 'radial') return { start: [cx, cy], end: [cx + D, cy] };
  const a = angle * Math.PI / 180, dx = Math.cos(a) * D, dy = Math.sin(a) * D;
  return { start: [cx - dx, cy - dy], end: [cx + dx, cy + dy] };
}
function meshPoints(w, h) { return [[w * 0.12, h * 0.15], [w * 0.88, h * 0.12], [w * 0.15, h * 0.88], [w * 0.85, h * 0.85]]; }

function backgroundPlan(args, comp) {
  const pal = PAL.resolve(args.palette, args.colors, args.paletteName);
  const col = (i) => pal.colors[((i % 5) + 5) % 5];
  const rgba = (hex) => B.hexToRgb(hex).concat([1]);
  const idxOf = (i) => ((i % 5) + 5) % 5;
  const plan = { palette: pal, base: col(args.from), items: [], drift: [], bases: [], slots: [] };
  if (args.style === 'linear' || args.style === 'radial') {
    const g = gradientPoints(args.style, comp.width, comp.height, args.angle, args.spread);
    plan.items.push({ key: BG_KEYS.gradient, matchName: 'ADBE Ramp', before: [], params: [
      { id: 'start', value: g.start, names: ['Start of Ramp'], suffix: 1 },
      { id: 'startColor', value: rgba(col(args.from)), names: ['Start Color', 'Start Colour'], suffix: 2 },
      { id: 'end', value: g.end, names: ['End of Ramp'], suffix: 3 },
      { id: 'endColor', value: rgba(col(args.to)), names: ['End Color', 'End Colour'], suffix: 4 },
      { id: 'shape', value: args.style === 'radial' ? 2 : 1, names: ['Ramp Shape'], suffix: 5 }
    ] });
    plan.drift = ['start', 'end'];
    plan.bases = [g.start, g.end];
    plan.colors = [col(args.from), col(args.to)];
    plan.slots = [{ id: 'startColor', idx: idxOf(args.from), other: 'endColor' }, { id: 'endColor', idx: idxOf(args.to), other: 'startColor' }];
  } else if (args.style === 'mesh') {
    const pts = meshPoints(comp.width, comp.height);
    const cols = [0, 1, 2, 3].map((i) => col(args.from + i + (i >= 2 ? 1 : 0)));
    const params = [];
    pts.forEach((p, i) => {
      params.push({ id: `point${i + 1}`, value: p, names: [`Point ${i + 1}`], nth: { type: 'TwoD_SPATIAL', n: i + 1 } });
      params.push({ id: `color${i + 1}`, value: rgba(cols[i]), names: [`Color ${i + 1}`, `Colour ${i + 1}`], nth: { type: 'COLOR', n: i + 1 } });
    });
    plan.items.push({ key: BG_KEYS.mesh, matchName: 'ADBE 4ColorGradient', before: [], params });
    plan.drift = ['point1', 'point2', 'point3', 'point4'];
    plan.bases = pts;
    plan.colors = cols;
    plan.slots = [0, 1, 2, 3].map((i) => ({ id: `color${i + 1}`, idx: idxOf(args.from + i + (i >= 2 ? 1 : 0)), other: `color${((i + 1) % 4) + 1}` }));
  } else {
    plan.colors = [col(args.from)];
  }
  // motion: what moves (points) and how the colours change; the old "drift" switch = Drift
  plan.motion = args.style === 'solid' ? 'none' : (args.motion && args.motion !== 'none' ? args.motion : (args.drift ? 'drift' : 'none'));
  plan.colorMotion = args.style === 'solid' ? 'none' : (args.colorMotion || 'none');
  plan.animated = plan.motion !== 'none' || plan.colorMotion !== 'none';
  if (plan.animated) {
    const slider = (key, value) => ({ key, matchName: 'ADBE Slider Control', before: [], params: [{ id: 'v', value, names: ['Slider'], suffix: 1 }] });
    plan.controls = [slider(BM.FX.loop, args.loop), slider(BM.FX.amount, args.amount), slider(BM.FX.colour, args.colourAmount)];
  }
  if (args.grain > 0) plan.grain = { key: BG_KEYS.grain, matchName: 'ADBE Noise', before: [], params: [{ id: 'amount', value: args.grain, names: ['Amount of Noise'], nth: { type: 'OneD', n: 1 } }] };
  return plan;
}

/** v0.6 name kept for callers: the Drift motion of point i (of n) — now a bgMotion expression. */
function driftExpression(id, i, w, h, n = 2) { return BM.pointExpression('drift', i, n, w, h); }

const background = {
  id: 'design.background',
  version: '1.0.0',
  category: 'design',
  group: 'Backgrounds',
  name: 'Background',
  description: 'Add a "MOE Background" at the bottom of the comp from a palette: linear or radial gradient (Gradient Ramp), a soft 4-colour mesh, or a flat colour — with optional film grain, moving colour points (drift, orbit, swirl, wave, breathe, wander) and changing colours (cycle, swap, hue, pulse) that loop seamlessly and stay live on sliders.',
  keywords: ['background', 'gradient', 'ramp', 'mesh', 'bg', 'backdrop', 'palette', 'grain', 'noise', 'colour', 'animated', 'motion', 'loop', 'moving'],
  icon: 'background',
  params: {
    palette: { type: 'enum', label: 'Palette', default: 'tomato', options: PAL.PALETTES.map((p) => ({ value: p.id, label: p.name })).concat([{ value: 'custom', label: 'Custom / brand colours' }]) },
    colors: { type: 'string', label: 'Custom colours', default: '', maxLength: 80, advanced: true, description: '2–5 hex colours, e.g. a client brand: #0E7C66, #F2A541', showIf: (a) => a.palette === 'custom' },
    paletteName: { type: 'string', label: 'Custom name', default: '', maxLength: 40, advanced: true, showIf: () => false },
    style: { type: 'enum', label: 'Style', default: 'linear', options: [{ value: 'linear', label: 'Linear' }, { value: 'radial', label: 'Radial' }, { value: 'mesh', label: 'Mesh' }, { value: 'solid', label: 'Flat' }] },
    from: { type: 'integer', label: 'Colour A', min: 0, max: 4, default: 0, description: 'Palette colour (1st = 0)' },
    to: { type: 'integer', label: 'Colour B', min: 0, max: 4, default: 2, showIf: (a) => a.style === 'linear' || a.style === 'radial' },
    angle: { type: 'number', label: 'Angle', min: 0, max: 360, step: 1, default: 135, unit: '°', showIf: (a) => a.style === 'linear' },
    spread: { type: 'number', label: 'Spread', min: 10, max: 300, step: 1, default: 100, unit: '%', showIf: (a) => a.style === 'linear' || a.style === 'radial' },
    grain: { type: 'number', label: 'Grain', min: 0, max: 40, step: 0.5, default: 0, unit: '%' },
    motion: { type: 'enum', label: 'Motion', default: 'none', options: BM.POINT_MOTIONS.map((m) => ({ value: m.id, label: m.label })), description: 'How the colour points move (a looping expression on each point)', hidden: true },
    colorMotion: { type: 'enum', label: 'Colours', default: 'none', options: BM.COLOR_MOTIONS.map((m) => ({ value: m.id, label: m.label })), description: 'How the colours change over time (a looping expression on each colour)', hidden: true },
    loop: { type: 'number', label: 'Loop', min: 1, max: 120, step: 0.5, default: 8, unit: 's', description: 'One full loop — the background repeats seamlessly after this', showIf: (a) => a.style !== 'solid' && ((a.motion && a.motion !== 'none') || (a.colorMotion && a.colorMotion !== 'none') || a.drift) },
    amount: { type: 'number', label: 'Movement', min: 0, max: 100, step: 1, default: 40, unit: '%', description: 'How far the points travel (100 % = a quarter of the comp)', showIf: (a) => a.style !== 'solid' && ((a.motion && a.motion !== 'none' && a.motion !== 'swirl') || a.drift) },
    colourAmount: { type: 'number', label: 'Colour change', min: 0, max: 100, step: 1, default: 100, unit: '%', description: 'How strongly the colours change', showIf: (a) => a.style !== 'solid' && a.colorMotion && a.colorMotion !== 'none' },
    drift: { type: 'boolean', label: 'Slow drift (old)', default: false, advanced: true, description: 'Kept for presets saved before v0.18 — same as Motion: Drift', showIf: () => false },
    name: { type: 'string', label: 'Layer name', default: 'MOE Background', maxLength: 120, advanced: true }
  },
  requires: { comp: true },
  permissions: ['modify.layers', 'modify.effects', 'modify.expressions'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Create a background layer from a named palette: linear/radial gradient, 4-colour mesh or flat colour, optional grain; animate it with motion (drift/orbit/swirl/wave/breathe/wander) and colorMotion (cycle/swap/hue/pulse), loop seconds and amount.' },
  uses: { hostOps: ['layers.createSolid', 'effects.ensure', 'expressions.set', 'layers.remove'], network: false },
  compatibility: { minAE: '25.0' },
  // palette tiles change the palette only — your style, motion and colours stay (studio/library.fill)
  ui: { primaryLabel: 'Add Background', keepOnTile: ['style', 'motion', 'colorMotion', 'loop', 'amount', 'colourAmount', 'grain', 'drift'] },
  gradientPoints,
  backgroundPlan,

  prepare(args, ctx) {
    if (!PAL.resolve(args.palette, args.colors, args.paletteName)) return { ok: false, error: args.palette === 'custom' ? 'Custom palette needs 2–5 colours (#RRGGBB)' : 'Choose a palette' };
    const plan = backgroundPlan(args, ctx.comp);
    const name = (args.name || '').trim() || 'MOE Background';
    if (!/^MOE /.test(name)) return { ok: false, error: 'Layer name must start with "MOE " so it can be found and removed safely' };
    return {
      ok: true, plan, name,
      preview: { summary: `${plan.palette.name} · ${args.style}${args.grain ? ` · grain ${args.grain}%` : ''}${plan.motion !== 'none' ? ` · ${BM.pointMotion(plan.motion).label.toLowerCase()}` : ''}${plan.colorMotion !== 'none' ? ` · colours ${BM.colorMotion(plan.colorMotion).label.toLowerCase()}` : ''}`,
        items: [plan.colors.join(' → '), `New layer "${name}" at the bottom of the comp`].concat(plan.animated ? [`Loops every ${args.loop} s — live on the "${BM.FX.loop}", "${BM.FX.amount}" and "${BM.FX.colour}" sliders`] : []) }
    };
  },

  async execute({ args, ctx, prepared, host }) {
    // v0.94 (docs/features/ONE_UNDO.md): the solid, its effects, its sliders and their expressions in ONE host call —
    // one Ctrl+Z. The expressions' addresses come from the effect's own result (refs), in the order they were asked for.
    const plan = prepared.plan;
    const P = PLAN(host, `MOE: ${prepared.name}`);
    const solid = P.add('layers.createSolid', { compId: ctx.comp.id, name: prepared.name, color: B.hexToRgb(plan.base), bottom: true, comment: `MOE Background · ${plan.palette.name}` });
    const out = { solid: null, fx: null, fxRequest: null, grain: null, grainError: null, drift: null };
    const fxRequest = plan.items.length ? [{ layer: { layerId: solid.at('layerId') }, items: plan.items }] : null;
    const fx = fxRequest ? P.add('effects.ensure', { compId: ctx.comp.id, label: 'MOE: Background', layers: fxRequest }) : null;
    let controls = null, controlsRequest = null, drift = null;
    if (plan.animated && fx) {
      // sliders first: the expressions read them
      controlsRequest = [{ layer: { layerId: solid.at('layerId') }, items: plan.controls }];
      controls = P.add('effects.ensure', { compId: ctx.comp.id, label: 'MOE: Background Controls', layers: controlsRequest });
      const item = plan.items[0];
      const addr = (id) => ({ layerId: solid.at('layerId'), matchNames: ['ADBE Effect Parade', `name:${item.key}`, fx.at('layers', 0, 'items', 0, 'params', item.params.findIndex((x) => x.id === id), 'matchName')] });
      const targets = [];
      if (plan.motion !== 'none') plan.drift.forEach((id, i) => targets.push({ address: addr(id), expression: BM.pointExpression(plan.motion, i, plan.drift.length, ctx.comp.width, ctx.comp.height), enabled: true }));
      if (plan.colorMotion !== 'none') {
        const Pc = plan.palette.colors.map((hx) => B.hexToRgb(hx).concat([1]));
        plan.slots.forEach((sl, i) => {
          const other = plan.slots.find((x) => x.id === sl.other);
          targets.push({ address: addr(sl.id), expression: BM.colorExpression(plan.colorMotion, { i, n: plan.slots.length, idx: sl.idx, P: Pc, own: Pc[sl.idx], other: Pc[other.idx] }), enabled: true });
        });
      }
      if (targets.length) drift = P.add('expressions.set', { compId: ctx.comp.id, label: 'MOE: Background Motion', revertOnError: true, targets });
    }
    // grain last: if this machine lacks it, everything else is already there (and the report says so)
    const grain = plan.grain ? P.add('effects.ensure', { compId: ctx.comp.id, label: 'MOE: Grain', layers: [{ layer: { layerId: solid.at('layerId') }, items: [plan.grain] }] }) : null;
    const grainStep = grain ? P.size - 1 : -1;
    try {
      await P.commit();
    } catch (e) {
      if (e.step !== grainStep) {
        const id = solid.value() && solid.value().layerId;
        if (id) await host.call('layers.remove', { compId: ctx.comp.id, layerIds: [id], label: 'MOE: Remove Background', onlyNamed: 'MOE ' });
        throw e;
      }
      out.grainError = e.message;
    }
    out.solid = solid.value();
    if (fx) { out.fx = fx.value(); out.fxRequest = [{ layer: { layerId: out.solid.layerId }, items: plan.items }]; }
    if (controls) { out.controls = controls.value(); out.controlsRequest = [{ layer: { layerId: out.solid.layerId }, items: plan.controls }]; }
    if (drift) out.drift = drift.value();
    if (grain && !out.grainError) out.grain = grain.value();
    void controlsRequest;
    return out;
  },

  verify({ args, result }) {
    const checks = [{ ok: !!result.solid.layerId, label: result.solid.name, detail: 'background layer created at the bottom' }];
    if (result.fx) checks.push(...S.verifyEffects(result.fx, result.fxRequest).checks);
    if (args.grain > 0) checks.push({ ok: !!result.grain, label: 'Grain', detail: result.grain ? `${args.grain}%` : `not applied: ${result.grainError}` });
    if (result.controls) checks.push(...S.verifyEffects(result.controls, result.controlsRequest).checks);
    if (result.drift) for (const t of result.drift.targets) checks.push({ ok: !t.skipped && !t.reverted && !t.after.expressionError, label: `Motion › ${t.name}`, detail: t.reverted ? t.after.expressionError : 'expression active' });
    return { ok: checks.every((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, layerId: result.solid.layerId }; },
  async restore({ data, host }) {
    const r = await host.call('layers.remove', { compId: data.compId, layerIds: [data.layerId], label: 'MOE: Remove Background', onlyNamed: 'MOE ' });
    return { ok: r.removed.length === 1 };
  },
  summarize(result, v) { return v.ok ? `${result.solid.name} added` : `${result.solid.name}: ${v.checks.filter((c) => !c.ok).length} problem(s)`; }
};

/* ------------------------------------------------------------------ Colorize */

const FILL_KEY = 'MOE Palette Fill';
const FILLABLE = new Set(['av', 'solid', 'precomp', 'adjustment']);

function mix(a, b, t) { return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t); }
/** Colour for the k-th of n layers (pure; tested). */
function paletteColor(pal, mode, k, n, offset = 0, seed = 1) {
  const cols = pal.colors.map((c) => B.hexToRgb(c));
  if (mode === 'blend') {
    if (n <= 1) return cols[offset % 5];
    const u = (k / (n - 1)) * 4;
    const i = Math.min(3, Math.floor(u));
    return mix(cols[i], cols[i + 1], u - i);
  }
  if (mode === 'shuffle') {
    let x = Math.sin((k + 1) * 12.9898 + seed * 78.233) * 43758.5453;
    x -= Math.floor(x);
    return cols[Math.floor(x * 5) % 5];
  }
  return cols[(k + offset) % 5];
}

const colorize = {
  id: 'design.colorize',
  version: '1.0.0',
  category: 'design',
  group: 'Palettes',
  name: 'Colorize from Palette',
  description: 'Colour the selected layers from a palette in selection order: cycle through the colours, shuffle them, or blend smoothly from the first to the last colour. Text and shapes change fill/stroke; footage and solids get a "MOE Palette Fill" effect.',
  keywords: ['colorize', 'colour', 'color', 'palette', 'fill', 'recolor', 'random colour', 'gradient', 'swatches'],
  icon: 'palette',
  params: {
    palette: { type: 'enum', label: 'Palette', default: 'tomato', options: PAL.PALETTES.map((p) => ({ value: p.id, label: p.name })).concat([{ value: 'custom', label: 'Custom / brand colours' }]) },
    colors: { type: 'string', label: 'Custom colours', default: '', maxLength: 80, advanced: true, description: '2–5 hex colours, e.g. a client brand: #0E7C66, #F2A541', showIf: (a) => a.palette === 'custom' },
    paletteName: { type: 'string', label: 'Custom name', default: '', maxLength: 40, advanced: true, showIf: () => false },
    mode: { type: 'enum', label: 'Order', default: 'cycle', options: [{ value: 'cycle', label: 'Cycle' }, { value: 'shuffle', label: 'Shuffle' }, { value: 'blend', label: 'Blend' }] },
    target: { type: 'enum', label: 'Apply to', default: 'fill', options: [{ value: 'fill', label: 'Fill' }, { value: 'stroke', label: 'Stroke' }, { value: 'both', label: 'Both' }] },
    offset: { type: 'integer', label: 'Start at', min: 0, max: 4, default: 0, showIf: (a) => a.mode === 'cycle' },
    seed: { type: 'integer', label: 'Seed', min: 1, max: 999, default: 1, showIf: (a) => a.mode === 'shuffle' }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers', 'modify.effects'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Recolour the selected layers from a named palette (cycle / shuffle / blend).' },
  uses: { hostOps: ['text.setStyle', 'props.colorTargets', 'props.setValues', 'effects.ensure'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Colorize' },
  paletteColor,

  prepare(args, ctx) {
    const pal = PAL.resolve(args.palette, args.colors, args.paletteName);
    if (!pal) return { ok: false, error: 'Choose a palette' };
    const layers = (ctx.layers || []).filter((l) => !l.locked && (l.type === 'text' || l.type === 'shape' || FILLABLE.has(l.type)));
    const skipped = (ctx.layers || []).filter((l) => !layers.includes(l)).map((l) => `${l.name} (${l.locked ? 'locked' : l.type})`);
    if (!layers.length) return { ok: false, error: skipped.length ? `Nothing to colour: ${skipped.join(', ')}` : 'Select layers to colour' };
    const plan = layers.map((l, k) => ({ layer: l, rgb: paletteColor(pal, args.mode, k, layers.length, args.offset, args.seed) }));
    return {
      ok: true, pal, plan, skipped,
      preview: { summary: `${pal.name} · ${args.mode} · ${layers.length} layer(s)`, items: plan.slice(0, 8).map((p) => `${p.layer.name} → ${B.rgbToHex(p.rgb)}`).concat(skipped.map((s) => `Skipped: ${s}`)) }
    };
  },

  async execute({ args, ctx, prepared, host }) {
    const out = { text: null, shapes: null, fills: null, fillRequest: null, requested: {}, shapeTargets: [] };
    const text = prepared.plan.filter((p) => p.layer.type === 'text');
    const shapes = prepared.plan.filter((p) => p.layer.type === 'shape');
    const fills = prepared.plan.filter((p) => FILLABLE.has(p.layer.type));
    for (const p of prepared.plan) out.requested[p.layer.id] = p.rgb;
    if (text.length) {
      out.text = await host.call('text.setStyle', { compId: ctx.comp.id, label: 'MOE: Colorize', items: text.map((p) => ({
        layerId: p.layer.id, fillColor: args.target !== 'stroke' ? p.rgb : undefined, strokeColor: args.target !== 'fill' ? p.rgb : undefined
      })) });
    }
    if (shapes.length) {
      const targets = await host.call('props.colorTargets', { compId: ctx.comp.id, layers: shapes.map((p) => p.layer.id), mode: args.target });
      out.shapeTargets = targets.layers.map((L) => ({ name: L.name, count: L.addresses.length }));
      const items = [];
      for (const L of targets.layers) {
        const rgb = out.requested[L.layerId] || (shapes.find((p) => p.layer.name === L.name) || {}).rgb;
        for (const a of L.addresses) items.push({ address: a, value: rgb.concat([1]) });
      }
      if (items.length) out.shapes = await host.call('props.setValues', { compId: ctx.comp.id, label: 'MOE: Colorize', items });
    }
    if (fills.length) {
      out.fillRequest = fills.map((p) => ({ layer: { layerId: p.layer.id }, items: [{ key: FILL_KEY, matchName: 'ADBE Fill', before: [], params: [{ id: 'Color', value: p.rgb.concat([1]), names: ['Color', 'Colour'], nth: { type: 'COLOR', n: 1 } }] }] }));
      out.fills = await S.writeEffects(host, ctx, out.fillRequest, 'MOE: Colorize');
    }
    return out;
  },

  verify({ result }) {
    const checks = [];
    for (const it of (result.shapes && result.shapes.items) || []) {
      const want = result.requested[it.address.layerId];
      checks.push({ ok: !it.skipped && close(it.after, want), label: `${it.layerName || ''} › ${it.name || ''}`, detail: it.skipped || B.rgbToHex(it.after) });
    }
    for (const L of (result.text && result.text.layers) || []) {
      if (L.skipped) { checks.push({ ok: false, label: L.name, detail: L.skipped }); continue; }
      const want = result.requested[L.layerId];
      const ok = !L.after.fillColor || !L.after.applyFill || close(L.after.fillColor, want);
      checks.push({ ok, label: `${L.name} › text`, detail: L.atTime !== null ? 'Source Text keyframed: set at current time' : B.rgbToHex(L.after.fillColor || want) });
    }
    for (const t of result.shapeTargets) if (!t.count) checks.push({ ok: false, label: t.name, detail: 'no fill/stroke found in shape contents' });
    if (result.fills) checks.push(...S.verifyEffects(result.fills, result.fillRequest).checks);
    return { ok: checks.length > 0 && checks.every((c) => c.ok), checks };
  },

  checkpoint({ result, ctx }) {
    return {
      compId: ctx.comp.id,
      values: ((result.shapes && result.shapes.items) || []).filter((i) => !i.skipped && i.atTime === null).map((i) => ({ address: i.address, value: i.before })),
      text: ((result.text && result.text.layers) || []).filter((L) => !L.skipped && L.atTime === null).map((L) => ({ layerId: L.layerId, before: L.before })),
      effects: result.fills ? S.effectsCheckpoint(result.fills, ctx) : null
    };
  },
  async restore({ data, host }) {
    if (data.values.length) await host.call('props.setValues', { compId: data.compId, label: 'MOE: Restore Colour', items: data.values });
    if (data.text.length) {
      await host.call('text.setStyle', { compId: data.compId, label: 'MOE: Restore Colour', items: data.text.map((t) => ({
        layerId: t.layerId, fillColor: t.before.fillColor || undefined, applyFill: t.before.applyFill ? undefined : false,
        strokeColor: t.before.strokeColor || undefined, applyStroke: t.before.applyStroke ? undefined : false
      })) });
    }
    if (data.effects) await S.restoreEffects({ data: data.effects, host });
    return { ok: true };
  },
  summarize(result, v) { const n = v.checks.filter((c) => c.ok).length; return v.ok ? `Colorized ${n} target(s)` : `Colorize: ${v.checks.filter((c) => !c.ok).length} problem(s)`; }
};

module.exports = { insertShape, background, colorize, gradientPoints, backgroundPlan, paletteColor, driftExpression, TAG, BG_KEYS };
