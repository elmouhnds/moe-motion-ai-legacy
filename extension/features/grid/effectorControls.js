'use strict';
/**
 * grid.effectorControls (v0.87, docs/features/CONTROLS_ON_DEMAND.md) — add a group of controls to a MOE Effector.
 *
 * Since v0.87 an effector arrives with only the controls it uses. This tool adds the others when you want them:
 * one group (Moves · Random / Noise / Delay · Colour · Spring · Audio · Field) or all of them, on the selected
 * "MOE Effector N" null(s). Only controls that are NOT there are added, with their defaults — which are the values
 * the item expressions were already using for them, so nothing moves. Restore removes exactly what was added.
 */
const X = require('./expressions');
const EF = require('./effectors');
const S = require('../compositing/shared');
const { controlItems } = require('./effectorTool');

const GROUP_OPTIONS = [{ value: 'all', label: 'All' }].concat(Object.keys(EF.GROUP_LABEL).map((g) => ({ value: g, label: EF.GROUP_LABEL[g] })));
const addr = (layerId, name, kind) => ({ layerId, matchNames: ['ADBE Effect Parade', `name:${name}`, `name:${X.KIND[kind].param}`] });
const kindOf = (name) => EF.CONTROLS.find((c) => c[0] === name)[1];
const effectorsIn = (ctx) => (ctx.layers || []).filter((l) => EF.NAME.test(l.name));

const controls = {
  id: 'grid.effectorControls',
  version: '1.0.0',
  category: 'layout',
  group: 'Grid',
  name: 'Effector Controls',
  description: 'Add more sliders to a MOE Effector in Effect Controls. An effector arrives with only the controls it uses; this adds a group when you want it — Moves (Move X / Y, Scale, Rotate, Fade), Random · Noise · Delay, Colour, Spring, Audio, Field, Wave, Snap To, Clamp — or all of them. Only missing controls are added, with the values the effector was already using, so nothing moves.',
  keywords: ['effector', 'controls', 'sliders', 'effect controls', 'more', 'show all', 'spring', 'colour', 'noise', 'seed', 'moves'],
  icon: 'sliders',
  params: {
    group: { type: 'enum', label: 'Add', default: 'all', options: GROUP_OPTIONS, description: Object.keys(EF.GROUP_LABEL).map((g) => `${EF.GROUP_LABEL[g]}: ${EF.GROUPS[g].join(', ')}`).join(' · ') }
  },
  requires: { comp: true, layers: 1 },
  permissions: ['modify.effects'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Adds missing slider groups to the selected MOE Effector null(s). group all|moves|random|colour|spring|audio|field. It never changes a control that is already there.' },
  uses: { hostOps: ['props.values', 'effects.ensure', 'effects.setMenu', 'effects.restore'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Add Controls', lockedOk: false },

  prepare(args, ctx) {
    const list = effectorsIn(ctx);
    if (!list.length) return { ok: false, error: 'Select a MOE Effector null (the one whose sliders you want in Effect Controls)' };
    const names = EF.groupNames(args.group);
    if (!names.length) return { ok: false, error: 'Choose a group of controls to add' };
    return { ok: true, effectors: list, names, preview: { summary: `${args.group === 'all' ? 'All controls' : EF.GROUP_LABEL[args.group]} on ${list.map((l) => l.name).join(', ')}`, items: [names.join(', '), 'Only the ones that are not there yet are added, with the values already in use — nothing moves'] } };
  },

  explain(args, ctx, prepared) {
    const out = { target: 'MOE Effector null', writes: ['Slider / Colour / Layer controls in Effect Controls', 'No expression, key or existing control is changed'] };
    if (prepared && prepared.ok) out.target = prepared.effectors.map((l) => l.name).join(', ');
    return out;
  },

  async execute({ ctx, prepared, host }) {
    const comp = ctx.comp, names = prepared.names;
    // which of them are already on each null (a control that is not there answers with an error)
    const items = [];
    prepared.effectors.forEach((l) => names.forEach((n) => items.push({ address: addr(l.id, n, kindOf(n)) })));
    const have = await host.call('props.values', { compId: comp.id, time: comp.time, items });
    const plan = prepared.effectors.map((l, li) => ({ layer: l, missing: names.filter((n, ni) => { const r = have.items[li * names.length + ni]; return !!r.error; }) }));
    const todo = plan.filter((p) => p.missing.length);
    const defaults = EF.defaults();
    const fx = todo.length ? await host.call('effects.ensure', { compId: comp.id, label: 'MOE: Effector Controls', layers: todo.map((p) => ({ layer: { layerId: p.layer.id }, items: controlItems(defaults, p.missing) })) }) : null;
    // a menu control needs its items (the first one is chosen — the default)
    for (const p of todo) if (p.missing.includes('Wave Shape')) await host.call('effects.setMenu', { compId: comp.id, layerId: p.layer.id, effectKey: 'Wave Shape', items: EF.WAVES.map((w) => w.menu), value: 1 });
    // read back: every control of the group answers now
    const read = await host.call('props.values', { compId: comp.id, time: comp.time, items });
    return { fx, plan: plan.map((p) => ({ id: p.layer.id, name: p.layer.name, added: p.missing })), read, names };
  },

  verify({ result }) {
    const bad = result.read.items.filter((r) => r.error);
    const checks = result.plan.map((p) => ({ ok: true, label: p.name, detail: p.added.length ? `added ${p.added.join(', ')}` : 'already had them — nothing added' }));
    checks.push({ ok: bad.length === 0, label: 'Read-back', detail: bad.length ? `${bad.length} control(s) still missing: ${bad[0].error}` : `${result.names.length} control(s) answer on ${result.plan.length} effector(s)` });
    return { ok: checks.every((c) => c.ok), checks };
  },

  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, fx: result.fx ? S.effectsCheckpoint(result.fx, ctx) : null }; },
  async restore({ data, host }) { if (data.fx) await S.restoreEffects({ data: data.fx, host }); return { ok: true }; },
  summarize(result, v) { const n = result.plan.reduce((s, p) => s + p.added.length, 0); return v.ok ? (n ? `${n} control(s) added to ${result.plan.map((p) => p.name).join(', ')}` : 'Those controls were already there') : 'Controls added with problems'; }
};

module.exports = { controls };
