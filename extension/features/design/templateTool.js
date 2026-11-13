'use strict';
/**
 * design.template (v0.49, docs/features/TEMPLATES.md) — a native After Effects template from the pure plan in
 * `templates.js`: text layers first (measured by After Effects), then the shapes sized to them, all parented to
 * one null `MOE Template N` (move / scale the whole thing), and the entrance keys (Quick Animate's plan).
 * Everything it makes is named `MOE Template N · <part>` and removed by Restore.
 */
const TPL = require('./templates');

const DEFAULT_ACCENT = '#ff5a3c';
/**
 * v0.51: the active brand fills what you did not set yourself (the accent left at its default, an empty font).
 * Pure apart from reading the active client; returns new args.
 */
function withBrand(args, services) {
  if (args.useBrand === false || !services || !services.store || !services.brands) return args;
  const brand = require('../brand/kit').activeBrand(services.store, services.brands);
  const b = brand && TPL.brandOpts(brand, { title: args.title, subtitle: args.subtitle, side: args.side });
  if (!b) return args;
  const out = Object.assign({}, args, { brandName: b.brand, tagText: args.tagText || b.tagText });
  // the templates' own accents (MOE tomato, the UI kit's blue) are defaults the brand replaces; a colour you chose is kept
  if (!args.accent || [DEFAULT_ACCENT, '#0a84ff'].includes(String(args.accent).toLowerCase())) out.accent = b.accent;
  if (!args.font && b.font) out.font = b.font;
  return out;
}

const { plan } = require('../../core/host/plan');
const TR = (id, mn) => ({ layerId: id, matchNames: ['ADBE Transform Group', mn] });
/** The plan's options from the tool's args (as v0.49 built them). */
const OPTS = (args, T) => ({ title: args.title || T.title, subtitle: args.subtitle === undefined || args.subtitle === '' ? (['tag', 'handle'].includes(args.template) ? '' : T.subtitle) : args.subtitle, accent: args.accent, textColor: args.textColor, tagText: args.tagText, side: args.side, duration: args.duration, hold: args.hold, number: args.number, theme: args.theme });
/** v0.94: texts this session already measured (per services) — re-applying or tuning the same template is ONE undo step. */
const CACHES = new WeakMap();
function measureCache(services) { const k = services || CACHES; if (!CACHES.has(k)) CACHES.set(k, new Map()); return CACHES.get(k); }
const PROP = { position: 'ADBE Position', opacity: 'ADBE Opacity', scale: 'ADBE Scale' };

const template = {
  id: 'design.template', version: '1.0.0', category: 'design', group: 'Design · Templates', name: 'Template',
  description: 'A native, editable template built in the comp: real text layers and shape layers, sized to your text, parented to one null, with its entrance animated (and its exit after Hold) — Lower Third, Title Card, Callout, Tag, Quote, End Card, Social Handle, Chapter. Arabic is laid out right-to-left.',
  keywords: ['template', 'lower third', 'title', 'callout', 'tag', 'badge', 'name', 'caption', 'label', 'quote', 'end card', 'outro', 'subscribe', 'handle', 'social', 'chapter', 'section', 'قالب', 'عنوان', 'اقتباس', 'نهاية', 'فصل'],
  icon: 'type',
  params: {
    template: { type: 'enum', label: 'Template', tileFixed: true, default: 'lowerThird', options: TPL.TEMPLATES.map((t) => ({ value: t.id, label: t.short || t.label })) },
    title: { type: 'string', label: 'Title', default: '', placeholder: 'The template\'s own example if empty', maxLength: 120 },
    subtitle: { type: 'string', label: 'Second line', default: '', maxLength: 160, showIf: (a) => !['tag', 'handle'].includes(a.template) && (!TPL.isUi(a.template) || ['uiNotify', 'uiProgress', 'uiStat'].includes(a.template)) },
    // v0.57 Product UI: the card's look (light card + dark text, or graphite + white)
    theme: { type: 'enum', label: 'Look', default: 'light', options: [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }], showIf: (a) => TPL.isUi(a.template) },
    accent: { type: 'string', label: 'Accent', default: '#ff5a3c', placeholder: '#RRGGBB', maxLength: 7 },
    textColor: { type: 'string', label: 'Text colour', default: '#ffffff', placeholder: '#RRGGBB', maxLength: 7, showIf: (a) => a.template !== 'tag' && !TPL.isUi(a.template) },
    side: { type: 'enum', label: 'Direction', default: 'auto', options: [{ value: 'auto', label: 'Auto' }, { value: 'ltr', label: 'LTR' }, { value: 'rtl', label: 'RTL' }], showIf: (a) => !TPL.isUi(a.template), description: 'Auto: Arabic text is laid out right to left (the bar on the right)' },
    number: { type: 'string', label: 'Number', default: '', placeholder: '01', maxLength: 4, showIf: (a) => a.template === 'chapter' },
    duration: { type: 'number', label: 'Duration', min: 0.2, max: 4, step: 0.05, default: 0.7, unit: 's' },
    // v0.50: how long it stays before it leaves by itself (0 = it stays)
    hold: { type: 'number', label: 'Hold, then exit', min: 0, max: 60, step: 0.5, default: 0, unit: 's', description: '0 = it stays. Otherwise it leaves after this long, the way it came in' },
    font: { type: 'string', label: 'Font', default: '', placeholder: 'After Effects default', advanced: true },
    // v0.51: the active client's colours and fonts (Brand Kit); what you set by hand wins
    // v0.94 (owner): a template is built in its own comp and placed in yours as ONE layer — one Ctrl+Z removes it
    container: { type: 'enum', label: 'Build in', default: 'comp', advanced: true, options: [{ value: 'comp', label: 'Its own comp' }, { value: 'layers', label: 'Your comp (separate layers)' }], description: 'Its own comp: one layer in your timeline, double-click it to edit the parts. Your comp: every part as its own layer, as before v0.94' },
    useBrand: { type: 'boolean', label: 'Use the brand', default: true, description: 'With a client active in Brand Kit: its primary colour, the best-reading text on it, and its Arabic / English font' }
  },
  requires: { comp: true },
  permissions: ['modify.layers', 'modify.keyframes'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Build a native template (lowerThird, titleCard, callout, tag, quote, endCard, handle, chapter) with the given title / subtitle / accent; hold > 0 adds the exit.' },
  uses: { hostOps: ['layers.describe', 'text.measure', 'tx.run', 'comps.create', 'comps.place', 'comps.removeMoe', 'text.create', 'shapes.insert', 'shapes.trim', 'layers.move', 'layers.createNull', 'layers.setParent', 'props.setValues', 'keys.write', 'layers.remove'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Build' },
  prepare(args, ctx) {
    if (!TPL.byId(args.template)) return { ok: false, error: `Unknown template ${args.template}` };
    for (const k of ['accent', 'textColor']) if (args[k] && !/^#?[0-9a-f]{6}$/i.test(String(args[k]).trim())) return { ok: false, error: `${k === 'accent' ? 'Accent' : 'Text colour'}: write a colour as #RRGGBB` };
    const T = TPL.byId(args.template);
    const title = args.title || T.title;
    return { ok: true, preview: { summary: `${T.label} · “${title}”${TPL.isRtl({ title, subtitle: args.subtitle, side: args.side }) ? ' · right to left' : ''}`, items: [] } };
  },
  async execute({ args, ctx, host, services }) {
    const comp = ctx.comp;
    const T = TPL.byId(args.template);
    args = withBrand(args, services);
    const opts = OPTS(args, T);
    // the next free number (never reuse a name: Trash and Restore find the parts by it)
    const desc = await host.call('layers.describe', { compId: comp.id });
    const used = (desc.layers || []).map((l) => (/^MOE Template (\d+)$/.exec(l.name) || [])[1]).filter(Boolean).map(Number);
    const n = used.length ? Math.max(...used) + 1 : 1;
    const base = `MOE Template ${n}`;
    const specs = TPL.textSpecs(args.template, opts, comp);
    const textArgs = (sp, compId) => ({ compId, text: sp.text, name: `${base} · ${TPL.nameOf(sp)}`, fontSize: sp.fontSize, color: sp.color, bold: !!sp.bold, justify: sp.justify, rtl: sp.rtl, font: args.font || undefined, position: [comp.width / 2, comp.height / 2], maxWidth: sp.maxWidth });

    // 1. the texts, measured by After Effects (v0.94: in a temporary comp it removes — an undo step that changes
    //    nothing; skipped when this session already measured the same texts, so a re-apply or Tune is ONE step)
    const cache = measureCache(services);
    const keyOf = (sp) => JSON.stringify(Object.assign(textArgs(sp, 0), { compId: 0, name: '', position: [comp.width, comp.height] }));
    const need = specs.filter((sp) => !cache.has(keyOf(sp)));
    if (need.length) {
      const m = await host.call('text.measure', { compId: comp.id, items: need.map((sp) => textArgs(sp, comp.id)) });
      need.forEach((sp, i) => cache.set(keyOf(sp), m.items[i]));
    }
    const measured = {}, fitted = [];
    for (const sp of specs) {
      const r = cache.get(keyOf(sp));
      measured[sp.key] = [r.size[0], r.size[1], r.fontSize];
      if (r.fitted) fitted.push(`${TPL.nameOf(sp)} ${sp.fontSize} → ${r.fontSize} px`);
    }
    const L = TPL.layout(args.template, opts, comp, measured);

    // 2. ONE plan, ONE host call, ONE Ctrl+Z (docs/features/ONE_UNDO.md): the template's own comp, everything in it,
    //    then that comp placed in yours as one layer at the playhead. `container: layers` builds in your comp as before.
    const own = args.container !== 'layers';
    const P = plan(host, `MOE: ${T.label}`);
    const made = P.size; // (index only)
    const inComp = own ? P.add('comps.create', { compId: comp.id, name: base }) : null;
    const cid = own ? inComp.at('compId') : comp.id;
    const t0 = own ? 0 : comp.time;
    const ids = {}, textIds = [], shapeIds = [], parts = [];
    for (const sp of specs) {
      const r = P.add('text.create', textArgs(sp, cid));
      ids[sp.key] = r.at('layerId'); textIds.push(ids[sp.key]); parts.push(ids[sp.key]);
    }
    for (const el of L.elements.filter((e) => e.kind !== 'text')) {
      const spec = { compId: cid, name: `${base} · ${el.name}`, groupName: el.name };
      if (el.kind === 'path') Object.assign(spec, { position: el.points[0], paths: [{ v: el.points.map((p) => [p[0] - el.points[0][0], p[1] - el.points[0][1]]), c: false }], stroke: { color: el.stroke.color, width: el.stroke.width, cap: 2, join: 2 } });
      else Object.assign(spec, { position: el.position, primitive: el.kind === 'rect' ? { type: 'rect', size: el.size, roundness: el.roundness || 0 } : { type: 'ellipse', size: el.size }, fill: { color: el.color } });
      const r = P.add('shapes.insert', spec);
      ids[el.key] = r.at('layerId'); shapeIds.push(ids[el.key]); parts.push(ids[el.key]);
    }
    // v0.57: every new layer goes on top and the shapes come after the texts — the texts go back above the topmost shape
    if (shapeIds.length && textIds.length) P.add('layers.move', { compId: cid, items: textIds.map((id) => ({ layerId: id, before: shapeIds[shapeIds.length - 1] })) });
    // 3. one null holds the template (at the block's centre): move or scale the whole thing from it
    const box = L.box, centre = [box[0] + box[2] / 2, box[1] + box[3] / 2];
    const nul = P.add('layers.createNull', { compId: cid, name: base, position: centre, anchor: [0, 0], label: 9 });
    const elPos = (key) => { const el = L.elements.find((e) => e.key === key); return el.kind === 'path' ? el.points[0] : el.position; };
    const local = (p) => [p[0] - centre[0], p[1] - centre[1]];
    P.add('layers.setParent', { compId: cid, label: 'MOE: Template', items: Object.keys(ids).map((k) => ({ layerId: ids[k], parentId: nul.at('layerId') })) });
    P.add('props.setValues', { compId: cid, label: 'MOE: Template', items: Object.keys(ids).map((k) => ({ address: TR(ids[k], 'ADBE Position'), value: local(elPos(k)) })) });
    // 4. the entrance: the plan's keys (at 0 in its own comp, which starts at the playhead; positions in the null's space)
    const items = [];
    for (const k of L.keys) {
      const at = (x) => Object.assign({}, x, { t: x.t + t0, v: k.prop === 'position' ? local(x.v) : x.v });
      const address = k.prop === 'trimEnd' ? P.add('shapes.trim', { compId: cid, layerId: ids[k.key] }).at('end') : TR(ids[k.key], PROP[k.prop]);
      items.push({ address, keys: k.keys.map(at) });
    }
    const keysRef = items.length ? P.add('keys.write', { compId: cid, label: 'MOE: Template', items }) : null;
    // 5. the template's comp in yours, as one layer at the playhead
    const placed = own ? P.add('comps.place', { compId: comp.id, sourceId: inComp.at('compId'), name: base, startTime: comp.time, label: 9 }) : null;
    void made;
    try {
      await P.commit();
    } catch (e) {
      // never leave half a template behind (what ran is in that one undo step too — this tidies it now)
      try {
        const C = plan(host, 'MOE: Remove Template');
        if (own) {
          if (placed.value() && placed.value().layerId) C.add('layers.remove', { compId: comp.id, layerIds: [placed.value().layerId], onlyNamed: base });
          if (inComp.value() && inComp.value().compId) C.add('comps.removeMoe', { ids: [inComp.value().compId], onlyNamed: base });
        } else {
          const done = parts.concat([nul.at('layerId')]).map((r) => r.value()).filter(Boolean);
          if (done.length) C.add('layers.remove', { compId: comp.id, layerIds: done, onlyNamed: base });
        }
        if (C.size) await C.commit();
      } catch (e2) { /* report the first error */ }
      throw e;
    }
    const where = own ? inComp.value().compId : comp.id;
    const real = {}; Object.keys(ids).forEach((k) => { real[k] = ids[k].value(); });
    const madeIds = parts.map((r) => r.value()).concat([nul.value().layerId]);
    // read back what is in the template's comp now (verify checks it), and the placed layer in yours
    const back = ((await host.call('layers.describe', { compId: where, any: own })).layers || []).filter((l) => madeIds.includes(l.id)).map((l) => ({ id: l.id, name: l.name, parentId: l.parentId || null }));
    const yours = own ? ((await host.call('layers.describe', { compId: comp.id })).layers || []).find((l) => l.id === placed.value().layerId) : null;
    return { base, made: madeIds, ids: real, measured, keys: keysRef ? keysRef.value() : { items: [] }, back, nullId: nul.value().layerId, template: T.label, title: opts.title, brand: args.brandName || null, fitted,
      container: own ? { compId: where, layerId: placed.value().layerId, name: base, startTime: comp.time, found: !!yours, sourceId: yours ? yours.sourceId : null } : null,
      measuredNow: need.length, hostWrites: (need.length ? 1 : 0) + 1 };
  },
  verify({ result }) {
    const have = (id) => result.back.find((l) => l.id === id);
    const checks = result.made.map((id) => {
      const l = have(id);
      const placed = !!l && (id === result.nullId ? !l.parentId : l.parentId === result.nullId);
      return { ok: !!l && l.name.indexOf(result.base) === 0 && placed, label: l ? l.name : `layer ${id}`, detail: !l ? 'missing' : id === result.nullId ? 'the template null' : placed ? 'parented to the template null' : 'not parented' };
    });
    for (const k of Object.keys(result.measured)) checks.push({ ok: result.measured[k][0] > 0, label: `${k} measured`, detail: `${Math.round(result.measured[k][0])} × ${Math.round(result.measured[k][1])} px` });
    for (const f of result.fitted || []) checks.push({ ok: true, label: 'Fitted to the safe area', detail: f });
    for (const it of result.keys.items) checks.push({ ok: it.written.length >= 2, label: `${it.layerName} › ${it.name}`, detail: `${it.written.length} keys` });
    if (result.container) checks.push({ ok: result.container.found, label: result.base, detail: result.container.found ? `its own comp, placed in yours as one layer at ${result.container.startTime.toFixed(2)} s — one Ctrl+Z removes it` : 'the template comp was not placed in your comp' });
    return { ok: checks.every((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, layerIds: result.made, base: result.base, container: result.container ? { compId: result.container.compId, layerId: result.container.layerId } : null }; },
  async restore({ data, host }) {
    if (!data.container) return host.call('layers.remove', { compId: data.compId, layerIds: data.layerIds, onlyNamed: data.base });
    // the placed layer, then its comp (only when nothing else uses it) — one call, one undo step
    const P = plan(host, 'MOE: Restore Template');
    P.add('layers.remove', { compId: data.compId, layerIds: [data.container.layerId], onlyNamed: data.base });
    P.add('comps.removeMoe', { ids: [data.container.compId], onlyNamed: data.base });
    await P.commit();
    return { ok: true, removed: P.results };
  },
  summarize(result) { return `${result.template} “${result.title}” — ${result.made.length} layers in ${result.container ? 'its own comp ' : ''}${result.base}${result.brand ? ` · ${result.brand} brand` : ''}`; }
};

module.exports = { template, withBrand };
