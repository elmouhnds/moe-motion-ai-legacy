'use strict';
/**
 * design.template (v0.49, docs/features/TEMPLATES.md) — a native After Effects template from the pure plan in
 * `templates.js`: text layers first (measured by After Effects), then the shapes sized to them, all parented to
 * one null `MOE Template N` (move / scale the whole thing), and the entrance keys (Quick Animate's plan).
 * Everything it makes is named `MOE Template N · <part>` and removed by Restore.
 */
const TPL = require('./templates');

const TR = (id, mn) => ({ layerId: id, matchNames: ['ADBE Transform Group', mn] });
const PROP = { position: 'ADBE Position', opacity: 'ADBE Opacity', scale: 'ADBE Scale' };

const template = {
  id: 'design.template', version: '1.0.0', category: 'design', group: 'Design · Templates', name: 'Template',
  description: 'A native, editable template built in the comp: real text layers and shape layers, sized to your text, parented to one null, with its entrance animated (and its exit after Hold) — Lower Third, Title Card, Callout, Tag, Quote, End Card, Social Handle, Chapter. Arabic is laid out right-to-left.',
  keywords: ['template', 'lower third', 'title', 'callout', 'tag', 'badge', 'name', 'caption', 'label', 'quote', 'end card', 'outro', 'subscribe', 'handle', 'social', 'chapter', 'section', 'قالب', 'عنوان', 'اقتباس', 'نهاية', 'فصل'],
  icon: 'type',
  params: {
    template: { type: 'enum', label: 'Template', default: 'lowerThird', options: TPL.TEMPLATES.map((t) => ({ value: t.id, label: t.short || t.label })) },
    title: { type: 'string', label: 'Title', default: '', placeholder: 'The template\'s own example if empty', maxLength: 120 },
    subtitle: { type: 'string', label: 'Second line', default: '', maxLength: 160, showIf: (a) => !['tag', 'handle'].includes(a.template) },
    accent: { type: 'string', label: 'Accent', default: '#ff5a3c', placeholder: '#RRGGBB', maxLength: 7 },
    textColor: { type: 'string', label: 'Text colour', default: '#ffffff', placeholder: '#RRGGBB', maxLength: 7, showIf: (a) => a.template !== 'tag' },
    side: { type: 'enum', label: 'Direction', default: 'auto', options: [{ value: 'auto', label: 'Auto' }, { value: 'ltr', label: 'LTR' }, { value: 'rtl', label: 'RTL' }], description: 'Auto: Arabic text is laid out right to left (the bar on the right)' },
    number: { type: 'string', label: 'Number', default: '', placeholder: '01', maxLength: 4, showIf: (a) => a.template === 'chapter' },
    duration: { type: 'number', label: 'Duration', min: 0.2, max: 4, step: 0.05, default: 0.7, unit: 's' },
    // v0.50: how long it stays before it leaves by itself (0 = it stays)
    hold: { type: 'number', label: 'Hold, then exit', min: 0, max: 60, step: 0.5, default: 0, unit: 's', description: '0 = it stays. Otherwise it leaves after this long, the way it came in' },
    font: { type: 'string', label: 'Font', default: '', placeholder: 'After Effects default', advanced: true }
  },
  requires: { comp: true },
  permissions: ['modify.layers', 'modify.keyframes'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Build a native template (lowerThird, titleCard, callout, tag, quote, endCard, handle, chapter) with the given title / subtitle / accent; hold > 0 adds the exit.' },
  uses: { hostOps: ['layers.describe', 'text.create', 'shapes.insert', 'shapes.trim', 'layers.createNull', 'layers.setParent', 'props.setValues', 'keys.write', 'layers.remove'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Build' },
  prepare(args, ctx) {
    if (!TPL.byId(args.template)) return { ok: false, error: `Unknown template ${args.template}` };
    for (const k of ['accent', 'textColor']) if (args[k] && !/^#?[0-9a-f]{6}$/i.test(String(args[k]).trim())) return { ok: false, error: `${k === 'accent' ? 'Accent' : 'Text colour'}: write a colour as #RRGGBB` };
    const T = TPL.byId(args.template);
    const title = args.title || T.title;
    return { ok: true, preview: { summary: `${T.label} · “${title}”${TPL.isRtl({ title, subtitle: args.subtitle, side: args.side }) ? ' · right to left' : ''}`, items: [] } };
  },
  async execute({ args, ctx, host }) {
    const comp = ctx.comp;
    const T = TPL.byId(args.template);
    const opts = { title: args.title || T.title, subtitle: args.subtitle === undefined || args.subtitle === '' ? (['tag', 'handle'].includes(args.template) ? '' : T.subtitle) : args.subtitle, accent: args.accent, textColor: args.textColor, side: args.side, duration: args.duration, hold: args.hold, number: args.number };
    // the next free number (never reuse a name: Trash and Restore find the parts by it)
    const desc = await host.call('layers.describe', { compId: comp.id });
    const used = (desc.layers || []).map((l) => (/^MOE Template (\d+)$/.exec(l.name) || [])[1]).filter(Boolean).map(Number);
    const n = used.length ? Math.max(...used) + 1 : 1;
    const base = `MOE Template ${n}`;
    const made = [];
    const ids = {};
    try {
      // 1. the texts, measured by After Effects
      const measured = {};
      for (const sp of TPL.textSpecs(args.template, opts, comp)) {
        const r = await host.call('text.create', { compId: comp.id, text: sp.text, name: `${base} · ${TPL.nameOf(sp)}`, fontSize: sp.fontSize, color: sp.color, bold: !!sp.bold, justify: sp.justify, rtl: sp.rtl, font: args.font || undefined, position: [comp.width / 2, comp.height / 2] });
        made.push(r.layerId); ids[sp.key] = r.layerId; measured[sp.key] = r.size;
      }
      // 2. the plan with the real sizes, then the shapes
      const L = TPL.layout(args.template, opts, comp, measured);
      for (const el of L.elements.filter((e) => e.kind !== 'text')) {
        const spec = { compId: comp.id, name: `${base} · ${el.name}`, groupName: el.name };
        if (el.kind === 'path') Object.assign(spec, { position: el.points[0], paths: [{ v: el.points.map((p) => [p[0] - el.points[0][0], p[1] - el.points[0][1]]), c: false }], stroke: { color: el.stroke.color, width: el.stroke.width, cap: 2, join: 2 } });
        else Object.assign(spec, { position: el.position, primitive: el.kind === 'rect' ? { type: 'rect', size: el.size, roundness: el.roundness || 0 } : { type: 'ellipse', size: el.size }, fill: { color: el.color } });
        const r = await host.call('shapes.insert', spec);
        made.push(r.layerId); ids[el.key] = r.layerId;
      }
      // 3. one null holds the template (at the block's centre): move or scale the whole thing from it
      const box = L.box, centre = [box[0] + box[2] / 2, box[1] + box[3] / 2];
      const nul = await host.call('layers.createNull', { compId: comp.id, name: base, position: centre, anchor: [0, 0], label: 9 });
      made.push(nul.layerId);
      const elPos = (key) => { const el = L.elements.find((e) => e.key === key); return el.kind === 'path' ? el.points[0] : el.position; };
      const local = (p) => [p[0] - centre[0], p[1] - centre[1]];
      await host.call('layers.setParent', { compId: comp.id, label: 'MOE: Template', items: Object.keys(ids).map((k) => ({ layerId: ids[k], parentId: nul.layerId })) });
      await host.call('props.setValues', { compId: comp.id, label: 'MOE: Template', items: Object.keys(ids).map((k) => ({ address: TR(ids[k], 'ADBE Position'), value: local(elPos(k)) })) });
      // 4. the entrance: the plan's keys at the playhead (positions in the null's space)
      const items = [];
      for (const k of L.keys) {
        const at = (x) => Object.assign({}, x, { t: x.t + comp.time, v: k.prop === 'position' ? local(x.v) : x.v });
        let address;
        if (k.prop === 'trimEnd') address = (await host.call('shapes.trim', { compId: comp.id, layerId: ids[k.key] })).end;
        else address = TR(ids[k.key], PROP[k.prop]);
        items.push({ address, keys: k.keys.map(at) });
      }
      const keys = items.length ? await host.call('keys.write', { compId: comp.id, label: 'MOE: Template', items }) : { items: [] };
      // read back what is in the comp now (verify checks it)
      const back = ((await host.call('layers.describe', { compId: comp.id })).layers || []).filter((l) => made.includes(l.id)).map((l) => ({ id: l.id, name: l.name, parentId: l.parentId || null }));
      return { base, made, ids, measured, keys, back, nullId: nul.layerId, template: T.label, title: opts.title };
    } catch (e) {
      // never leave half a template behind
      if (made.length) { try { await host.call('layers.remove', { compId: comp.id, layerIds: made, onlyNamed: base }); } catch (e2) { /* report the first error */ } }
      throw e;
    }
  },
  verify({ result }) {
    const have = (id) => result.back.find((l) => l.id === id);
    const checks = result.made.map((id) => {
      const l = have(id);
      const placed = !!l && (id === result.nullId ? !l.parentId : l.parentId === result.nullId);
      return { ok: !!l && l.name.indexOf(result.base) === 0 && placed, label: l ? l.name : `layer ${id}`, detail: !l ? 'missing' : id === result.nullId ? 'the template null' : placed ? 'parented to the template null' : 'not parented' };
    });
    for (const k of Object.keys(result.measured)) checks.push({ ok: result.measured[k][0] > 0, label: `${k} measured`, detail: `${Math.round(result.measured[k][0])} × ${Math.round(result.measured[k][1])} px` });
    for (const it of result.keys.items) checks.push({ ok: it.written.length >= 2, label: `${it.layerName} › ${it.name}`, detail: `${it.written.length} keys` });
    return { ok: checks.every((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, layerIds: result.made, base: result.base }; },
  async restore({ data, host }) { return host.call('layers.remove', { compId: data.compId, layerIds: data.layerIds, onlyNamed: data.base }); },
  summarize(result) { return `${result.template} “${result.title}” — ${result.made.length} layers in ${result.base}`; }
};

module.exports = { template };
