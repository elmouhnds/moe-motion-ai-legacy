'use strict';
/**
 * Apply a whole client brand in one click (v0.26, docs/features/BRAND_IN_ACTION.md).
 * Selection or the whole comp:
 *   text  → the brand font for its script (Arabic font + right-to-left for Arabic text, the English font
 *           otherwise) and the brand colour for its role: headlines (short text, or named title / headline)
 *           get the headline colour, the rest the text colour
 *   shape → fill colours in turn: primary, secondary, accent (a shape named bg / background → background)
 *   solid → only the background solid (named bg / background, or the bottom-most solid) gets a
 *           "MOE Brand Fill" in the background colour; MOE Background gradients are left alone
 * Colours by role come from brandRoles(): roles the import found, otherwise the palette order, always
 * checked for contrast against the background (text ≥ 4.5 : 1, headline ≥ 3 : 1).
 * Same host ops as Apply Brand Colour / Font: verified by read-back, one Undo, History › Restore.
 */
const B = require('./brands');
const S = require('../compositing/shared');

const FILL_KEY = 'MOE Brand Fill';
const BG_NAME = /\b(bg|background|backdrop)\b|خلفية/i;
const HEAD_NAME = /title|head|headline|heading|h1|عنوان/i;
const rgbOf = (c) => (c ? B.hexToRgb(c.hex) : null);
const lum = (c) => B.luminance(rgbOf(c));

/** Colours by role, contrast-checked against the background. Works for imported and hand-made clients. */
function brandRoles(brand) {
  const cols = (brand && brand.colors || []).filter((c) => B.hexToRgb(c.hex));
  if (!cols.length) return null;
  const by = (...roles) => cols.find((c) => roles.includes(c.role)) || null;
  const byLum = cols.slice().sort((a, b) => lum(a) - lum(b));
  const background = by('background', 'surface') || byLum[byLum.length - 1];
  const vs = (c) => B.contrast(rgbOf(c), rgbOf(background));
  const others = cols.filter((c) => c !== background);
  const vivid = others.filter((c) => !['text', 'neutral', 'surface', 'background'].includes(c.role));
  const primary = by('primary') || vivid[0] || others[0] || background;
  const secondary = by('secondary') || vivid.find((c) => c !== primary) || primary;
  const accent = by('accent') || vivid.find((c) => c !== primary && c !== secondary) || secondary;
  const best = (list) => list.slice().sort((a, b) => vs(b) - vs(a))[0] || null;
  const textRole = by('text');
  const text = textRole && vs(textRole) >= 4.5 ? textRole : best(others) || primary;
  const headline = vs(primary) >= 3 ? primary : text;
  return { primary, secondary, accent, background, text, headline, contrast: { text: +vs(text).toFixed(2), headline: +vs(headline).toFixed(2) } };
}

const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const isHeadline = (l) => HEAD_NAME.test(l.name || '') || (!!l.text && words(l.text) <= 4 && String(l.text).trim().length <= 32);

/** What one click will do (pure, tested). layers: { id, index, name, type, locked, text }. */
function planApply(brand, layers, { fonts = true, colors = true } = {}) {
  const roles = brandRoles(brand);
  const plan = { text: [], shapes: [], fills: [], skipped: [], roles };
  const list = (layers || []).filter((l) => l && !l.guide);
  const solids = list.filter((l) => l.type === 'solid' && !l.locked && !/^MOE Background/.test(l.name));
  const bottomSolid = solids.slice().sort((a, b) => b.index - a.index)[0] || null;
  let turn = 0;
  for (const l of list) {
    if (l.locked) { plan.skipped.push(`${l.name} (locked)`); continue; }
    if (l.type === 'text') {
      const ar = B.hasArabic(l.text);
      const font = fonts ? (ar ? brand.fonts.arabic : brand.fonts.english) || null : null;
      const head = isHeadline(l);
      const fill = colors && roles ? (head ? roles.headline : roles.text) : null;
      if (!font && !fill) { plan.skipped.push(`${l.name} (no ${ar ? 'Arabic' : 'English'} font set)`); continue; }
      plan.text.push({ layer: l, font, rtl: ar, fill, role: head ? 'headline' : 'body', fontMissing: fonts && !font });
    } else if (l.type === 'shape') {
      if (!colors || !roles) { plan.skipped.push(`${l.name} (colours off)`); continue; }
      const bg = BG_NAME.test(l.name);
      const cycle = [roles.primary, roles.secondary, roles.accent];
      plan.shapes.push({ layer: l, color: bg ? roles.background : cycle[turn++ % 3], role: bg ? 'background' : ['primary', 'secondary', 'accent'][(turn - 1) % 3] });
    } else if (l.type === 'solid') {
      if (/^MOE Background/.test(l.name)) { plan.skipped.push(`${l.name} (a MOE gradient — use a brand background preset)`); continue; }
      if (colors && roles && (BG_NAME.test(l.name) || l === bottomSolid)) plan.fills.push({ layer: l, color: roles.background, role: 'background' });
      else plan.skipped.push(`${l.name} (solid — only the background solid is coloured)`);
    } else plan.skipped.push(`${l.name} (${l.type})`);
  }
  return plan;
}

const applyAll = {
  id: 'brand.applyAll',
  version: '1.0.0',
  category: 'brand',
  group: 'Brand',
  name: 'Apply Whole Brand',
  description: 'One click: the client fonts (Arabic / English by script) and colours by role on text (headline / body), shapes (primary · secondary · accent) and the background solid — on the selection or the whole comp. One Undo.',
  keywords: ['brand', 'apply', 'client', 'whole', 'comp', 'fonts', 'colours', 'colors', 'style', 'identity', 'one click', 'rebrand'],
  icon: 'brand',
  params: {
    brandId: { type: 'string', label: 'Client', required: true },
    scope: { type: 'enum', label: 'Apply to', default: 'selection', options: [{ value: 'selection', label: 'Selected layers' }, { value: 'comp', label: 'Whole comp' }] },
    fonts: { type: 'boolean', label: 'Fonts', default: true },
    colors: { type: 'boolean', label: 'Colours', default: true }
  },
  requires: { comp: true },
  permissions: ['modify.layers', 'modify.effects'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Apply a whole client brand (fonts by script + colours by role) to the selection or the whole comp. brandId from the "brands" context.' },
  uses: { hostOps: ['layers.describe', 'text.setStyle', 'props.colorTargets', 'props.setValues', 'effects.ensure'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Apply brand' },

  prepare(args, ctx, services) {
    const brand = services && services.brands ? services.brands.get(args.brandId) : null;
    if (!brand) return { ok: false, error: 'Choose a client (Brand)' };
    if (!args.fonts && !args.colors) return { ok: false, error: 'Turn on fonts or colours' };
    if (args.colors && !brandRoles(brand)) return { ok: false, error: `${brand.name} has no colours yet` };
    if (args.scope === 'comp') return { ok: true, brand, preview: { summary: `${brand.name} on every unlocked layer of ${ctx.comp.name}`, items: ['Text: fonts by script, headline / body colours', 'Shapes: primary · secondary · accent', 'Background solid: background colour', 'One Undo · History › Restore'] } };
    if (!(ctx.layers || []).length) return { ok: false, error: 'Select layers, or choose “Whole comp”' };
    const plan = planApply(brand, ctx.layers, args);
    if (!plan.text.length && !plan.shapes.length && !plan.fills.length) return { ok: false, error: `Nothing to brand here: ${plan.skipped.join(', ') || 'select text, shapes or the background'}` };
    return { ok: true, brand, preview: { summary: `${brand.name} on ${plan.text.length + plan.shapes.length + plan.fills.length} layer(s)`, items: [
      ...plan.text.map((t) => `${t.layer.name}: ${t.font ? `${t.font.family || t.font.ps}${t.rtl ? ' · RTL' : ''}` : 'font unchanged'}${t.fill ? ` · ${t.role} ${t.fill.hex}` : ''}`),
      ...plan.shapes.map((x) => `${x.layer.name}: ${x.role} ${x.color.hex}`), ...plan.fills.map((x) => `${x.layer.name}: background ${x.color.hex}`), ...plan.skipped.map((x) => `Skipped: ${x}`)] } };
  },

  async execute({ args, ctx, prepared, host }) {
    const brand = prepared.brand;
    let layers = ctx.layers || [];
    if (args.scope === 'comp') layers = (await host.call('layers.describe', { compId: ctx.comp.id })).layers;
    const plan = planApply(brand, layers, args);
    const out = { plan: { text: plan.text.map((t) => ({ layerId: t.layer.id, name: t.layer.name, font: t.font && t.font.ps, fill: t.fill && t.fill.hex, rtl: t.rtl, role: t.role })), shapes: plan.shapes.map((x) => ({ layerId: x.layer.id, name: x.layer.name, hex: x.color.hex })), skipped: plan.skipped }, roles: plan.roles && { primary: plan.roles.primary.hex, text: plan.roles.text.hex, background: plan.roles.background.hex, contrast: plan.roles.contrast } };
    if (plan.text.length) {
      out.text = await host.call('text.setStyle', { compId: ctx.comp.id, label: 'MOE: Apply Brand', items: plan.text.map((t) => ({
        layerId: t.layer.id, font: t.font ? t.font.ps : undefined, direction: t.font && t.rtl ? 'rtl' : undefined, universal: t.font && t.rtl ? true : undefined, fillColor: t.fill ? rgbOf(t.fill) : undefined })) });
    }
    if (plan.shapes.length) {
      const targets = await host.call('props.colorTargets', { compId: ctx.comp.id, layers: plan.shapes.map((x) => x.layer.id), mode: 'fill' });
      const items = [];
      out.shapeTargets = targets.layers.map((L) => ({ name: L.name, count: L.addresses.length }));
      for (const L of targets.layers) {
        const p = plan.shapes.find((x) => x.layer.id === L.layerId) || plan.shapes.find((x) => x.layer.name === L.name);
        const c = rgbOf(p && p.color);
        if (c) L.addresses.forEach((a) => items.push({ address: a, value: c.concat([1]) }));
      }
      if (items.length) out.shapes = await host.call('props.setValues', { compId: ctx.comp.id, label: 'MOE: Apply Brand', items });
    }
    if (plan.fills.length) {
      out.fillRequest = plan.fills.map((x) => ({ layer: { layerId: x.layer.id }, items: [{ key: FILL_KEY, matchName: 'ADBE Fill', before: [], params: [{ id: 'Color', value: rgbOf(x.color).concat([1]), names: ['Color', 'Colour'], nth: { type: 'COLOR', n: 1 } }] }] }));
      out.fills = await S.writeEffects(host, ctx, out.fillRequest, 'MOE: Apply Brand');
    }
    return out;
  },

  verify({ result }) {
    const checks = [];
    const close = (a, b) => a && b && [0, 1, 2].every((i) => Math.abs(a[i] - b[i]) < 0.005);
    for (const L of (result.text && result.text.layers) || []) {
      const want = result.plan.text.find((t) => t.layerId === L.layerId);
      if (L.skipped) { checks.push({ ok: false, label: L.name, detail: L.skipped }); continue; }
      const fontOk = !want.font || L.after.font === want.font;
      const fillOk = !want.fill || !L.after.fillColor || close(L.after.fillColor, B.hexToRgb(want.fill)) || L.after.applyFill === false;
      checks.push({ ok: fontOk && fillOk, label: `${L.name} › ${want.role}`, detail: `${fontOk ? (want.font || 'font kept') : `font is ${L.after.font}`}${want.fill ? ` · ${fillOk ? want.fill : 'colour not set'}` : ''}${L.atTime !== null ? ' · at current time (keyframed)' : ''}` });
    }
    for (const it of (result.shapes && result.shapes.items) || []) checks.push({ ok: !it.skipped, label: `${it.layerName || ''} › ${it.name || 'fill'}`, detail: it.skipped || (it.atTime !== null ? 'set at current time (keyframed)' : 'colour read back') });
    for (const t of result.shapeTargets || []) if (!t.count) checks.push({ ok: false, label: t.name, detail: 'no fill found in shape contents' });
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
    if (data.values.length) await host.call('props.setValues', { compId: data.compId, label: 'MOE: Restore Brand', items: data.values });
    if (data.text.length) {
      await host.call('text.setStyle', { compId: data.compId, label: 'MOE: Restore Brand', items: data.text.map((t) => ({
        layerId: t.layerId, font: t.before.font || undefined, direction: t.before.direction || undefined,
        fillColor: t.before.fillColor || undefined, applyFill: t.before.applyFill ? undefined : false })) });
    }
    if (data.effects) await S.restoreEffects({ data: data.effects, host });
    return { ok: true };
  },

  summarize(result, v) {
    const n = result.plan.text.length + result.plan.shapes.length + ((result.fills && result.fillRequest) ? result.fillRequest.length : 0);
    return v.ok ? `Brand applied to ${n} layer${n === 1 ? '' : 's'}${result.plan.skipped.length ? ` · ${result.plan.skipped.length} skipped` : ''}` : `Apply brand: ${v.checks.filter((c) => !c.ok).length} problem(s)`;
  }
};

module.exports = { applyAll, brandRoles, planApply, isHeadline };
