'use strict';
/**
 * Resize & Adapt (CompResizer-style, plus a responsive layout planner).
 * Re-frames a comp to another size while keeping every keyframe: each top-level
 * layer gets one uniform map p' = s·p + d (keys, tangents and ease speeds included).
 * Default output is a new comp, so the original is never touched.
 */
const P = require('./planner');
const F = require('./formats');
const { measureComp } = require('./measure');

const FORMAT_OPTIONS = [...F.FORMATS.map((f) => ({ value: f.id, label: `${f.label} · ${f.w}×${f.h}` })), { value: 'custom', label: 'Custom size' }];

function targetSize(args, ctx) {
  if (args.format === 'custom') return { width: Math.round(args.width), height: Math.round(args.height) };
  const f = F.byId(args.format);
  return f ? { width: f.w, height: f.h } : null;
}

function parseOverrides(text) {
  if (!text) return {};
  try { const o = JSON.parse(text); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
}

/** Measure + plan (recursively for nested layout pre-comps). Read-only apart from the temporary probe. */
async function buildPlan(host, compId, args, refTime, dst, depth = 0, any = false) {
  const m = await measureComp(host, compId, { refTime, any });
  const src = { width: m.info.width, height: m.info.height };
  const p = P.plan({
    src, dst, elements: m.elements, method: args.method, margin: (args.margin === undefined ? 5 : args.margin) / 100,
    reflow: args.reflow === false ? 'off' : 'auto', strategy: args.strategy || 'direct',
    overrides: depth === 0 ? parseOverrides(args.overrides) : {}, nested: args.nested !== false && depth < 2
  });
  const nested = [];
  for (const e of p.layers.filter((l) => l.role === 'nested')) {
    const el = m.elements.find((x) => x.id === e.layerId);
    const D = m.info.layers.find((x) => x.id === e.layerId);
    const sub = await buildPlan(host, el.precomp.id, args, refTime - (D.startTime || 0), dst, depth + 1, true);
    nested.push({ layerId: e.layerId, name: `${el.precomp.name} ${dst.width}x${dst.height}`, width: dst.width, height: dst.height, recenter: true, plan: { layers: hostLayers(sub.layers) }, nested: sub.nested, preview: sub });
  }
  return { src, dst, layers: p.layers, warnings: p.warnings, scales: p.scales, safe: p.safe, nested, measured: m };
}

const hostLayers = (layers) => layers.map((l) => ({ layerId: l.layerId, s: l.s, d: l.d, method: l.method, rig: l.rig }));

/** Group box of `layerId` (layer + descendants) in a measured comp. */
function groupBox(m, layerId) {
  const info = Object.assign({}, m.info, { layers: m.info.layers.map((L) => (L.id === layerId ? Object.assign({}, L, { parentId: null }) : L)) });
  const el = P.buildElements(info, m.bounds).find((e) => e.id === layerId);
  return el ? (el.ref || el.union) : null;
}

const resize = {
  id: 'adapt.resize',
  version: '1.0.0',
  category: 'layout',
  group: 'Resize & Adapt',
  name: 'Resize & Adapt',
  description: 'Re-frame the active comp to another size (9:16, 1:1, 4:5…) keeping every keyframe. Smart mode re-lays out backgrounds, logos, bands and content; Fit / Fill / Keep scale everything together.',
  keywords: ['resize', 'reframe', 'aspect', 'vertical', 'square', '9:16', '1:1', '4:5', 'adapt', 'responsive', 'compresizer', 'social', 'key visual'],
  icon: 'resize',
  params: {
    format: { type: 'enum', label: 'Format', default: 'v916', options: FORMAT_OPTIONS },
    width: { type: 'integer', label: 'Width', min: 16, max: 16000, default: 1080, unit: 'px', showIf: (a) => a.format === 'custom' },
    height: { type: 'integer', label: 'Height', min: 16, max: 16000, default: 1920, unit: 'px', showIf: (a) => a.format === 'custom' },
    method: { type: 'enum', label: 'Method', default: 'smart', options: [{ value: 'smart', label: 'Smart' }, { value: 'fit', label: 'Fit' }, { value: 'fill', label: 'Fill' }, { value: 'keep', label: 'Keep' }], description: 'Smart re-lays out each element; Fit/Fill/Keep scale the whole frame' },
    output: { type: 'enum', label: 'Output', default: 'copy', options: [{ value: 'copy', label: 'New comp' }, { value: 'inplace', label: 'This comp' }] },
    margin: { type: 'number', label: 'Safe margin', min: 0, max: 20, step: 0.5, default: 5, unit: '%', advanced: true, description: 'Safe area inset (percent of the short side)' },
    reflow: { type: 'boolean', label: 'Re-stack content', default: true, advanced: true, description: 'When landscape ↔ portrait, stack side-by-side content in reading order' },
    nested: { type: 'boolean', label: 'Adapt inside pre-comps', default: true, advanced: true, description: 'A full-frame pre-comp holding the layout is adapted inside (as a copy)' },
    strategy: { type: 'enum', label: 'Apply as', default: 'direct', advanced: true, options: [{ value: 'direct', label: 'Keyframes' }, { value: 'rig', label: 'Rig nulls' }], description: 'Keyframes: values are re-mapped (clean timeline). Rig nulls: layers are parented to MOE Adapt nulls you can tweak.' },
    open: { type: 'boolean', label: 'Open new comp', default: true, advanced: true },
    overrides: { type: 'text', label: 'Overrides', hidden: true, maxLength: 20000, description: 'JSON per-layer overrides (set by the Layout view or Claude)' }
  },
  requires: { comp: true },
  permissions: ['modify.layers'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Make a resized / adapted version of the active comp for another aspect ratio (vertical 9:16, square, 4:5…), keeping all animation. Default output is a new comp.' },
  uses: { hostOps: ['layers.describe', 'layers.bounds', 'adapt.apply', 'comps.remove', 'adapt.restoreInPlace'], network: false },
  compatibility: { minAE: '25.0' },
  ui: {
    primaryLabel: 'Adapt',
    presets: [
      { id: 'vertical', label: '9:16', args: { format: 'v916', method: 'smart' } },
      { id: 'square', label: '1:1', args: { format: 'sq', method: 'smart' } },
      { id: 'portrait', label: '4:5', args: { format: 'p45', method: 'smart' } },
      { id: 'wide', label: '16:9', args: { format: 'h169', method: 'smart' } }
    ]
  },

  prepare(args, ctx) {
    const dst = targetSize(args, ctx);
    if (!dst || !(dst.width >= 16 && dst.height >= 16)) return { ok: false, error: 'Choose a size' };
    if (dst.width === ctx.comp.width && dst.height === ctx.comp.height) return { ok: false, error: `The comp is already ${dst.width}×${dst.height}` };
    const m = { smart: 'Smart layout', fit: 'Fit', fill: 'Fill', keep: 'Keep size' }[args.method];
    return {
      ok: true, dst,
      preview: {
        summary: `${ctx.comp.width}×${ctx.comp.height} → ${dst.width}×${dst.height} (${F.ratioText(dst.width, dst.height)}) · ${m} · ${args.output === 'copy' ? 'new comp' : 'this comp'}`,
        items: [args.output === 'copy' ? 'The original comp stays untouched' : 'Changes this comp (Restore puts it back)', 'Every keyframe is kept — only re-framed']
      }
    };
  },

  async execute({ args, ctx, prepared, host }) {
    const dst = prepared.dst;
    const plan = await buildPlan(host, ctx.comp.id, args, ctx.comp.time, dst);
    const res = await host.call('adapt.apply', {
      compId: ctx.comp.id, mode: args.output, name: `${ctx.comp.name} ${dst.width}x${dst.height}`, width: dst.width, height: dst.height,
      open: args.output === 'copy' && args.open !== false, plan: { layers: hostLayers(plan.layers) }, nested: plan.nested.map(stripPreview)
    }, { timeoutMs: 180000 });
    // Read-back: measure the result and compare with the plan.
    const after = await measureComp(host, res.compId, { refTime: ctx.comp.time, any: true });
    const checks = [];
    for (const l of plan.layers) {
      if (l.method === 'none' || !l.boxNew) continue;
      const rec = res.layers.find((x) => x.sourceId === l.layerId);
      if (!rec || rec.skipped) continue;
      checks.push({ name: l.name, role: l.role, expect: l.boxNew, got: groupBox(after, rec.layerId) });
    }
    return { plan: stripMeasured(plan), res, size: [after.info.width, after.info.height], checks, refTime: ctx.comp.time };
  },

  verify({ result, prepared }) {
    const out = [];
    const sizeOk = result.size[0] === prepared.dst.width && result.size[1] === prepared.dst.height;
    out.push({ ok: sizeOk, label: result.res.name, detail: `${result.size[0]}×${result.size[1]}${result.res.created.length ? ' · new comp' : ''}` });
    const tol = 0.004 * Math.max(prepared.dst.width, prepared.dst.height) + 1;
    for (const c of result.checks) {
      const ok = !!c.got && c.expect.every((v, i) => Math.abs(v - c.got[i]) <= tol);
      out.push({ ok, label: `${c.name} (${c.role})`, detail: ok ? 'placed as planned (measured)' : c.got ? `measured ${c.got.map((v) => Math.round(v)).join(', ')} vs plan ${c.expect.map((v) => Math.round(v)).join(', ')}` : 'could not measure' });
    }
    for (const l of result.res.layers.filter((x) => x.skipped && x.skipped !== 'KEPT')) out.push({ ok: l.skipped !== 'LOCKED', label: l.name || 'Layer', detail: `not moved: ${l.skipped.toLowerCase()}` });
    for (const l of result.res.layers.filter((x) => x.fallback)) out.push({ ok: true, label: l.name, detail: `rig null used (${l.fallback})` });
    for (const n of result.res.nested) out.push({ ok: true, label: n.name, detail: `adapted inside → ${n.compName}` });
    for (const w of result.plan.warnings) out.push({ ok: true, label: 'Note', detail: w });
    return { ok: out.every((c) => c.ok), checks: out };
  },

  checkpoint({ result, ctx }) {
    const r = result.res;
    if (r.created.length && r.compId !== ctx.comp.id) return { mode: 'copy', created: r.created };
    const rigChildren = r.layers.filter((l) => l.rigId).map((l) => ({ layerId: l.layerId, parentId: null }));
    return { mode: 'inplace', compId: ctx.comp.id, width: r.sizeBefore[0], height: r.sizeBefore[1], layers: r.layers.filter((l) => l.before).map((l) => ({ layerId: l.layerId, before: l.before })), unparent: rigChildren, rigs: r.rigs.map((x) => x.layerId), created: r.created };
  },

  async restore({ data, host }) {
    if (data.mode === 'copy') return host.call('comps.remove', { ids: data.created });
    const r = await host.call('adapt.restoreInPlace', data);
    if (data.created && data.created.length) await host.call('comps.remove', { ids: data.created });
    return r;
  },

  summarize(result, v) { return v.ok ? `${result.res.name}: ${result.res.layers.filter((l) => !l.skipped).length} layer(s) re-framed, keyframes kept` : 'Adapt finished with notes'; }
};

function stripPreview(n) { const { preview, ...rest } = n; return Object.assign(rest, { nested: (rest.nested || []).map(stripPreview) }); } // eslint-disable-line no-unused-vars
function stripMeasured(p) { const { measured, ...rest } = p; return Object.assign(rest, { nested: p.nested.map((n) => ({ layerId: n.layerId, name: n.name })) }); } // eslint-disable-line no-unused-vars

/* ---------------- Claude layout suggestion (read-only) ---------------- */

const SYSTEM = [
  'You are the layout designer inside MOE Motion AI for After Effects.',
  'A key visual / animated design must be adapted to a new frame size. Every element keeps its own animation; you only decide where each element sits in the new frame and how big it is.',
  'Think like a senior designer making social cut-downs: backgrounds cover the frame, logos stay in a corner with margin, headlines stay readable (big), CTA near the bottom, legal small at the bottom, products prominent. Respect reading order. Avoid overlaps. Keep everything inside a 5% safe margin unless it is a background.',
  'Coordinates are normalized to the NEW frame (0..1). widthFraction = element width / new frame width.'
].join('\n');

const AI_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['layout', 'explanation'],
  properties: {
    layout: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'role', 'centerX', 'centerY', 'widthFraction'],
        properties: {
          id: { type: 'integer' },
          role: { type: 'string', enum: ['background', 'band', 'pinned', 'content', 'skip'] },
          centerX: { type: 'number' }, centerY: { type: 'number' }, widthFraction: { type: 'number' }
        }
      }
    },
    explanation: { type: 'string' }
  }
};

/** Convert Claude's layout into planner overrides (validated, clamped). */
function aiToOverrides(layout, elements, dst) {
  const out = {};
  const ignored = [];
  for (const it of layout || []) {
    const el = elements.find((e) => e.id === it.id);
    if (!el) { ignored.push(`unknown layer ${it.id}`); continue; }
    const b = el.ref || el.union;
    if (it.role === 'skip' || it.role === 'background') { out[el.id] = { role: it.role }; continue; }
    if (!b) continue;
    const wf = Math.min(Math.max(Number(it.widthFraction) || 0.3, 0.02), 1.5);
    const s = (wf * dst.width) / Math.max(b[2] - b[0], 1);
    out[el.id] = { role: ['band', 'pinned', 'content'].includes(it.role) ? it.role : 'content', scale: Math.round(s * 10000) / 10000, center: [Math.min(Math.max(Number(it.centerX), 0), 1), Math.min(Math.max(Number(it.centerY), 0), 1)] };
  }
  return { overrides: out, ignored };
}

const suggest = {
  id: 'adapt.suggestLayout',
  version: '1.0.0',
  category: 'layout',
  group: 'Resize & Adapt',
  name: 'Layout from Claude',
  description: 'Claude proposes where every element should sit in the new format (measured boxes, names and text are sent — no pixels). You review it in the plan before anything changes.',
  keywords: ['ai', 'claude', 'layout', 'adapt', 'design', 'suggest'],
  icon: 'spark',
  params: {
    format: resize.params.format, width: resize.params.width, height: resize.params.height,
    brief: { type: 'text', label: 'Brief', maxLength: 1000, description: 'Optional: e.g. “logo top-left, big headline, product bottom”' }
  },
  requires: { comp: true },
  permissions: ['network.ai'],
  recovery: 'none',
  ai: null,
  uses: { hostOps: ['layers.describe', 'layers.bounds'], network: true },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Suggest', hidden: true },
  prepare(args, ctx) {
    const dst = targetSize(args, ctx);
    if (!dst) return { ok: false, error: 'Choose a size' };
    return { ok: true, dst, preview: { summary: `Ask Claude to lay out ${ctx.comp.name} for ${dst.width}×${dst.height}`, items: [] } };
  },
  async execute({ args, ctx, prepared, host, services }) {
    const m = await measureComp(host, ctx.comp.id, { refTime: ctx.comp.time });
    const src = { width: m.info.width, height: m.info.height };
    const base = P.plan({ src, dst: prepared.dst, elements: m.elements });
    const n = (b) => (b ? [b[0] / src.width, b[1] / src.height, b[2] / src.width, b[3] / src.height].map((v) => Math.round(v * 1000) / 1000) : null);
    const payload = {
      source: src, target: prepared.dst, brief: args.brief || '',
      elements: m.elements.map((e) => ({ id: e.id, name: e.name, type: e.type, text: e.text || undefined, box: n(e.ref || e.union), animated: e.animated, children: e.children, localGuess: (base.layers.find((l) => l.layerId === e.id) || {}).role }))
    };
    const r = await services.ai.createJSON({ purpose: 'adapt.layout', system: SYSTEM, user: `Adapt this design. Data:\n${JSON.stringify(payload)}`, schema: AI_SCHEMA });
    const conv = aiToOverrides(r.data.layout, m.elements, prepared.dst);
    return { overrides: conv.overrides, ignored: conv.ignored, explanation: r.data.explanation, dst: prepared.dst };
  },
  verify({ result }) { return { ok: true, checks: [{ ok: true, label: 'Suggestion', detail: `${Object.keys(result.overrides).length} element(s) placed by Claude — review, then Adapt` }] }; },
  summarize(result) { return `Claude layout for ${Object.keys(result.overrides).length} element(s)`; }
};

module.exports = { resize, suggest, buildPlan, targetSize, aiToOverrides, hostLayers };
