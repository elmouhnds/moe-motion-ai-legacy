'use strict';
/** Brand Kit tools: apply a client's colour or font to the selection; extract a palette. */
const B = require('./brands');
const S = require('../compositing/shared');

const FILL_KEY = 'MOE Brand Fill';
const COLOR_TYPES = new Set(['COLOR']);
const FILLABLE = new Set(['av', 'solid', 'precomp', 'adjustment']);

function brandFrom(services, id) {
  const b = services && services.brands ? services.brands.get(id) : null;
  return b;
}

const applyColor = {
  id: 'brand.applyColor',
  version: '1.0.0',
  category: 'brand',
  group: 'Brand',
  name: 'Apply Brand Colour',
  description: 'Colour the selection with a client colour: selected colour properties, text fill/stroke, shape fill/stroke, or a Fill effect on footage/solids.',
  keywords: ['brand', 'colour', 'color', 'palette', 'client', 'identity', 'fill', 'stroke'],
  icon: 'brand',
  params: {
    brandId: { type: 'string', label: 'Client', description: 'Brand / client id', required: true },
    colorIndex: { type: 'integer', label: 'Colour #', description: 'Index in the client palette (0-based)', min: 0, max: 39, default: 0 },
    target: { type: 'enum', label: 'Apply to', default: 'fill', description: 'Fill, stroke or both (text and shapes)',
      options: [{ value: 'fill', label: 'Fill' }, { value: 'stroke', label: 'Stroke' }, { value: 'both', label: 'Both' }] }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers', 'modify.effects'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Colour layers with a client brand colour. brandId and colorIndex come from the "brands" context.' },
  uses: { hostOps: ['props.setValues', 'props.colorTargets', 'text.setStyle', 'effects.ensure'], network: false },
  compatibility: { minAE: '25.0' },

  prepare(args, ctx, services) {
    const brand = brandFrom(services, args.brandId);
    if (!brand) return { ok: false, error: 'Choose a client' };
    const color = brand.colors[args.colorIndex];
    if (!color) return { ok: false, error: 'That colour is not in the palette' };
    const rgb = B.hexToRgb(color.hex);
    const props = (ctx.properties || []).filter((p) => COLOR_TYPES.has(p.valueType));
    const items = [];
    const plan = { props: [], text: [], shapes: [], fills: [], skipped: [] };
    if (props.length) {
      plan.props = props.map((p) => p.address);
      items.push(`${props.length} selected colour propert${props.length > 1 ? 'ies' : 'y'}`);
    } else {
      for (const l of ctx.layers || []) {
        if (l.locked) plan.skipped.push(`${l.name} (locked)`);
        else if (l.type === 'text') plan.text.push(l);
        else if (l.type === 'shape') plan.shapes.push(l);
        else if (FILLABLE.has(l.type)) plan.fills.push(l);
        else plan.skipped.push(`${l.name} (${l.type})`);
      }
      if (plan.text.length) items.push(`${plan.text.length} text layer(s): ${args.target}`);
      if (plan.shapes.length) items.push(`${plan.shapes.length} shape layer(s): ${args.target}`);
      if (plan.fills.length) items.push(`${plan.fills.length} layer(s): ${FILL_KEY} effect`);
      items.push(...plan.skipped.map((s) => `Skipped: ${s}`));
      if (!plan.text.length && !plan.shapes.length && !plan.fills.length) return { ok: false, error: plan.skipped.length ? `Nothing to colour: ${plan.skipped.join(', ')}` : 'Select layers or a colour property' };
    }
    return { ok: true, brand, color, rgb, plan, preview: { summary: `${brand.name} · ${color.name} ${color.hex}`, items } };
  },

  async execute({ args, ctx, prepared, host }) {
    const { rgb, plan } = prepared;
    const rgba = [rgb[0], rgb[1], rgb[2], 1];
    const out = { props: null, text: null, shapes: null, fills: null, requested: rgba };
    if (plan.props.length) out.props = await host.call('props.setValues', { compId: ctx.comp.id, label: 'MOE: Brand Colour', items: plan.props.map((a) => ({ address: a, value: rgba })) });
    if (plan.text.length) {
      out.text = await host.call('text.setStyle', { compId: ctx.comp.id, label: 'MOE: Brand Colour', items: plan.text.map((l) => ({
        layerId: l.id, fillColor: args.target !== 'stroke' ? rgb : undefined, strokeColor: args.target !== 'fill' ? rgb : undefined
      })) });
    }
    if (plan.shapes.length) {
      const targets = await host.call('props.colorTargets', { compId: ctx.comp.id, layers: plan.shapes.map((l) => l.id), mode: args.target });
      const addrs = targets.layers.flatMap((L) => L.addresses);
      out.shapeTargets = targets.layers.map((L) => ({ name: L.name, count: L.addresses.length }));
      if (addrs.length) out.shapes = await host.call('props.setValues', { compId: ctx.comp.id, label: 'MOE: Brand Colour', items: addrs.map((a) => ({ address: a, value: rgba })) });
    }
    if (plan.fills.length) {
      out.fillRequest = plan.fills.map((l) => ({ layer: { layerId: l.id }, items: [{ key: FILL_KEY, matchName: 'ADBE Fill', before: [], params: [{ id: 'Color', value: rgba, names: ['Color', 'Colour'], nth: { type: 'COLOR', n: 1 } }] }] }));
      out.fills = await S.writeEffects(host, ctx, out.fillRequest, 'MOE: Brand Colour');
    }
    return out;
  },

  verify({ result }) {
    const checks = [];
    const close = (a, b) => a && b && [0, 1, 2].every((i) => Math.abs(a[i] - b[i]) < 0.005);
    for (const set of [result.props, result.shapes]) {
      for (const it of (set && set.items) || []) {
        checks.push({ ok: !it.skipped && close(it.after, result.requested), label: `${it.layerName || ''} › ${it.name || ''}`, detail: it.skipped ? it.skipped : (it.atTime !== null ? `set at ${it.atTime.toFixed(2)}s (keyframed)` : 'colour read back') });
      }
    }
    for (const L of (result.text && result.text.layers) || []) {
      if (L.skipped) { checks.push({ ok: false, label: L.name, detail: L.skipped }); continue; }
      const okFill = !L.after.fillColor || close(L.after.fillColor, result.requested) || !L.after.applyFill;
      checks.push({ ok: okFill, label: `${L.name} › text`, detail: L.atTime !== null ? 'Source Text keyframed: set at current time' : 'text colour read back' });
    }
    for (const t of result.shapeTargets || []) if (!t.count) checks.push({ ok: false, label: t.name, detail: 'no fill/stroke found in shape contents' });
    if (result.fills) checks.push(...S.verifyEffects(result.fills, result.fillRequest).checks);
    return { ok: checks.length > 0 && checks.every((c) => c.ok), checks };
  },

  checkpoint({ result, ctx }) {
    return {
      compId: ctx.comp.id,
      values: [...((result.props && result.props.items) || []), ...((result.shapes && result.shapes.items) || [])].filter((i) => !i.skipped && i.atTime === null).map((i) => ({ address: i.address, value: i.before })),
      text: ((result.text && result.text.layers) || []).filter((L) => !L.skipped && L.atTime === null).map((L) => ({ layerId: L.layerId, before: L.before })),
      effects: result.fills ? S.effectsCheckpoint(result.fills, ctx) : null
    };
  },

  async restore({ data, host }) {
    if (data.values.length) await host.call('props.setValues', { compId: data.compId, label: 'MOE: Restore Colour', items: data.values });
    if (data.text.length) {
      await host.call('text.setStyle', { compId: data.compId, label: 'MOE: Restore Colour', items: data.text.map((t) => ({
        layerId: t.layerId,
        fillColor: t.before.fillColor || undefined, applyFill: t.before.applyFill ? undefined : false,
        strokeColor: t.before.strokeColor || undefined, applyStroke: t.before.applyStroke ? undefined : false
      })) });
    }
    if (data.effects) await S.restoreEffects({ data: data.effects, host });
    return { ok: true };
  },

  summarize(result, v) {
    const n = v.checks.filter((c) => c.ok).length;
    return v.ok ? `Brand colour applied (${n} target${n === 1 ? '' : 's'})` : `Brand colour: ${v.checks.filter((c) => !c.ok).length} problem(s)`;
  }
};

const applyFont = {
  id: 'brand.applyFont',
  version: '1.0.0',
  category: 'brand',
  group: 'Brand',
  name: 'Apply Brand Font',
  description: 'Set a client font on the selected text layers. Auto picks the Arabic font for Arabic text (with right-to-left paragraphs) and the English font otherwise.',
  keywords: ['brand', 'font', 'typeface', 'arabic', 'english', 'typography', 'client'],
  icon: 'type',
  params: {
    brandId: { type: 'string', label: 'Client', required: true },
    role: { type: 'enum', label: 'Font', default: 'auto', options: [{ value: 'auto', label: 'Auto' }, { value: 'arabic', label: 'Arabic' }, { value: 'english', label: 'English' }, { value: 'extra', label: 'Extra' }] },
    extraIndex: { type: 'integer', label: 'Extra #', min: 0, max: 9, default: 0, advanced: true }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Apply client typography to text layers. role auto chooses Arabic vs English per layer.' },
  uses: { hostOps: ['text.setStyle'], network: false },
  compatibility: { minAE: '25.0' },

  prepare(args, ctx, services) {
    const brand = brandFrom(services, args.brandId);
    if (!brand) return { ok: false, error: 'Choose a client' };
    const texts = (ctx.layers || []).filter((l) => l.type === 'text' && !l.locked);
    if (!texts.length) return { ok: false, error: 'Select text layers' };
    const pick = (l) => {
      if (args.role === 'extra') return { font: brand.fonts.extra[args.extraIndex], rtl: B.hasArabic(l.text) };
      const role = args.role === 'auto' ? (B.hasArabic(l.text) ? 'arabic' : 'english') : args.role;
      return { font: brand.fonts[role], rtl: role === 'arabic' };
    };
    const items = [];
    const missing = [];
    for (const l of texts) {
      const p = pick(l);
      if (!p.font) missing.push(l.name);
      else items.push({ layer: l, font: p.font, rtl: p.rtl });
    }
    if (!items.length) return { ok: false, error: `${brand.name} has no ${args.role === 'auto' ? 'matching' : args.role} font set` };
    return {
      ok: true, brand, items,
      preview: { summary: `${brand.name} fonts on ${items.length} text layer(s)`, items: [...items.map((i) => `${i.layer.name}: ${i.font.family || i.font.ps} ${i.font.style || ''}${i.rtl ? ' · RTL' : ''}`), ...missing.map((m) => `Skipped: ${m} (no font for this script)`)] }
    };
  },

  async execute({ ctx, prepared, host }) {
    // v1.0.2: say 'ltr' out loud. A text layer nobody gave a direction to reports RIGHT_TO_LEFT in After Effects
    // 26.5.3x9, so leaving it alone left English paragraphs running right-to-left — and justification is relative
    // to the direction, so "left" then aligned right.
    return host.call('text.setStyle', { compId: ctx.comp.id, label: 'MOE: Brand Font', items: prepared.items.map((i) => ({ layerId: i.layer.id, font: i.font.ps, direction: i.rtl ? 'rtl' : 'ltr', universal: i.rtl })) });
  },
  verify({ result, prepared }) {
    const checks = result.layers.map((L) => {
      const want = prepared.items.find((i) => i.layer.id === L.layerId);
      if (L.skipped) return { ok: false, label: L.name, detail: L.skipped };
      const ok = L.after.font === want.font.ps;
      return { ok, label: L.name, detail: ok ? `${want.font.ps}${L.after.direction === 'rtl' ? ' · RTL' : ''}${L.atTime !== null ? ' · at current time (keyframed)' : ''}` : `font is ${L.after.font}` };
    });
    return { ok: checks.every((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) {
    return { compId: ctx.comp.id, text: result.layers.filter((L) => !L.skipped && L.atTime === null).map((L) => ({ layerId: L.layerId, font: L.before.font, direction: L.before.direction })) };
  },
  async restore({ data, host }) {
    return host.call('text.setStyle', { compId: data.compId, label: 'MOE: Restore Font', items: data.text.map((t) => ({ layerId: t.layerId, font: t.font, direction: t.direction || undefined })) });
  },
  summarize(result, v) { return v.ok ? `Brand font applied to ${result.layers.length} layer(s)` : 'Some fonts were not applied'; }
};

const extractPalette = {
  id: 'brand.extractPalette',
  version: '1.0.0',
  category: 'brand',
  group: 'Brand',
  name: 'Extract Palette',
  description: 'Measure the selected footage/logo layer and propose a colour palette.',
  keywords: ['palette', 'extract', 'eyedropper', 'colours from image', 'logo'],
  icon: 'pulse',
  params: { count: { type: 'integer', label: 'Colours', min: 2, max: 8, default: 5 } },
  requires: { comp: true, minLayers: 1 },
  permissions: ['modify.layers'],
  recovery: 'undo',
  ai: null,
  uses: { hostOps: ['pixels.sample'], network: false },
  compatibility: { minAE: '25.0' },
  prepare(args, ctx) {
    const t = S.targets(ctx, { needPixels: true });
    if (!t.usable.length) return { ok: false, error: 'Select a footage, logo or precomp layer' };
    return { ok: true, layer: t.usable[0], preview: { summary: `Palette from ${t.usable[0].name}`, items: [] } };
  },
  async execute({ args, ctx, prepared, host }) {
    const s = await S.sample(host, ctx, prepared.layer, { quality: 'thorough', times: S.sampleTimes(prepared.layer, ctx, 1, 'current') });
    return { name: prepared.layer.name, colors: B.paletteFromCells(s.cells, args.count), probeOk: s.probeOk };
  },
  verify({ result }) {
    return { ok: result.probeOk && result.colors.length > 0, checks: [{ ok: result.probeOk, label: 'Analysis', detail: result.probeOk ? `${result.colors.length} colours: ${result.colors.join(' ')}` : 'helper layer not removed' }] };
  },
  summarize(result) { return `${result.colors.length} colours from ${result.name}`; }
};

module.exports = { applyColor, applyFont, extractPalette, FILL_KEY };
