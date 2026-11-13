'use strict';
/**
 * v0.90 (docs/features/EFFECTOR_REMOVE_FREEZE.md, React 3 study item 5: "delete a single effector without
 * disturbing the others — no baking, bake the current frame, or bake the animation").
 *
 *   grid.effectorRemove   unlink the selected MOE Effector null(s) from their grid and delete them. The grid, its
 *                         items and the other effectors are not touched; the items go back to where the grid and
 *                         the remaining effectors put them. After Effects' own Undo brings the null back.
 *   grid.effectorFreeze   keep what the effector does at THIS frame for good: every keyframe on the null's
 *                         Position / Scale / Rotation and on its controls is removed and the value at the playhead
 *                         stays. The effector stays linked and editable. Restore puts every key back exactly.
 * Keeping the whole animation as keyframes on the items is the Bake tool's job (rig.bake) — it is not repeated here.
 */
const X = require('./expressions');
const EF = require('./effectors');
const { GRID_NAME } = require('./tools');
const { slotItem, ctlAddr } = require('./effectorTool');

const POS = ['ADBE Transform Group', 'ADBE Position'];
const TRANSFORM = [['Position', POS], ['Scale', ['ADBE Transform Group', 'ADBE Scale']], ['Rotation', ['ADBE Transform Group', 'ADBE Rotate Z']]];
const effectorsIn = (ctx) => (ctx.layers || []).filter((l) => EF.NAME.test(l.name));
const need = (ctx, what) => ({ ok: false, error: `Select the MOE Effector null to ${what} (not the grid — it can have three)` });

const remove = {
  id: 'grid.effectorRemove',
  version: '1.0.0',
  category: 'layout',
  group: 'Grid',
  name: 'Remove Effector',
  description: 'Remove one MOE Effector without disturbing the others: it is unlinked from its grid and its null is deleted. The grid, its items and the other effectors stay as they are — the items go back to where the grid and the remaining effectors put them. To keep the motion as keyframes first, use Bake; to keep one frame, use Freeze Effector.',
  keywords: ['effector', 'remove', 'delete', 'unlink', 'smart delete', 'clean'],
  icon: 'trash',
  params: {},
  requires: { comp: true, layers: 1 },
  permissions: ['modify.layers', 'modify.effects'],
  recovery: 'undo',
  ai: { callable: true, hint: 'Deletes the selected MOE Effector null(s) and unlinks them from their MOE Grid. Other effectors and the grid stay. Undo in After Effects restores it.' },
  uses: { hostOps: ['layers.describe', 'props.values', 'effects.ensure', 'layers.remove'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Remove Effector' },

  prepare(args, ctx) {
    const list = effectorsIn(ctx);
    if (!list.length) return need(ctx, 'remove');
    return { ok: true, effectors: list, preview: { summary: `Remove ${list.map((l) => l.name).join(', ')}`, items: ['Unlinked from its grid, then the null is deleted', 'The grid, its items and the other effectors are not touched', 'Ctrl+Z in After Effects brings it back'] } };
  },

  explain(args, ctx, prepared) {
    const out = { target: 'MOE Effector null', writes: ['The grid null\'s Effector slot → None', 'The effector null is deleted'], warnings: ['Its keyframes go with it — Bake the items first if you want to keep the motion'] };
    if (prepared && prepared.ok) out.target = prepared.effectors.map((l) => l.name).join(', ');
    return out;
  },

  async execute({ ctx, prepared, host }) {
    const comp = ctx.comp, ids = prepared.effectors.map((l) => l.id);
    const d0 = await host.call('layers.describe', { compId: comp.id });
    const mine = d0.layers.filter((l) => ids.includes(l.id) && EF.NAME.test(l.name));
    const grids = d0.layers.filter((l) => GRID_NAME.test(l.name));
    // which grid slots point at them
    const slotAddr = []; grids.forEach((g) => EF.SLOTS.forEach((s) => slotAddr.push({ grid: g, slot: s })));
    const now = slotAddr.length ? await host.call('props.values', { compId: comp.id, time: comp.time, items: slotAddr.map((a) => ({ address: ctlAddr(a.grid.id, a.slot, 'layer') })) }) : { items: [] };
    const links = slotAddr.filter((a, i) => !now.items[i].error && mine.some((m) => m.index === now.items[i].value));
    const byGrid = new Map(); links.forEach((a) => { if (!byGrid.has(a.grid.id)) byGrid.set(a.grid.id, { grid: a.grid, slots: [] }); byGrid.get(a.grid.id).slots.push(a.slot); });
    if (byGrid.size) await host.call('effects.ensure', { compId: comp.id, label: 'MOE: Unlink Effector', layers: [...byGrid.values()].map((b) => ({ layer: { layerId: b.grid.id }, items: b.slots.map((s) => slotItem(s, 0)) })) });
    await host.call('layers.remove', { compId: comp.id, layerIds: mine.map((m) => m.id), onlyNamed: 'MOE Effector' });
    // read back: the nulls are gone, the slots are empty, the items of those grids still evaluate
    const d1 = await host.call('layers.describe', { compId: comp.id });
    const gone = mine.filter((m) => !d1.layers.some((l) => l.id === m.id));
    const slotsAfter = links.length ? await host.call('props.values', { compId: comp.id, time: comp.time, items: links.map((a) => ({ address: ctlAddr(a.grid.id, a.slot, 'layer') })) }) : { items: [] };
    const kids = d1.layers.filter((l) => byGrid.has(l.parentId));
    const read = kids.length ? await host.call('props.values', { compId: comp.id, time: comp.time, items: kids.map((l) => ({ address: { layerId: l.id, matchNames: POS } })) }) : { items: [] };
    return { names: mine.map((m) => m.name), gone: gone.length, total: mine.length, links: links.map((a) => `${a.grid.name} › ${a.slot}`), slotsAfter, read };
  },

  verify({ result }) {
    const stuck = result.slotsAfter.items.filter((r) => !r.error && r.value), errs = result.read.items.filter((r) => r.error || !r.value);
    const checks = [
      { ok: result.gone === result.total && result.total > 0, label: 'Removed', detail: `${result.gone} of ${result.total}: ${result.names.join(', ')}` },
      { ok: stuck.length === 0, label: 'Unlinked', detail: result.links.length ? result.links.join(' · ') : 'it was not linked to a grid' },
      { ok: errs.length === 0, label: 'Read-back', detail: errs.length ? (errs[0].error || 'no value') : `${result.read.items.length} items evaluate without it` }
    ];
    return { ok: checks.every((c) => c.ok), checks };
  },
  summarize(result, v) { return v.ok ? `${result.names.join(', ')} removed — the rest is untouched` : 'Effector removed with problems'; }
};

/** Every property of an effector null that can hold keys: its transform and its controls (not menus or layer pickers). */
function freezeTargets(layerId, has) {
  const out = TRANSFORM.map(([name, mn]) => ({ name, address: { layerId, matchNames: mn } }));
  for (const [name, kind] of EF.CONTROLS) if (kind !== 'menu' && kind !== 'layer' && has(name)) out.push({ name, address: ctlAddr(layerId, name, kind) });
  return out;
}
const same = (a, b) => (Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-6) : Math.abs(Number(a) - Number(b)) < 1e-6);

const freeze = {
  id: 'grid.effectorFreeze',
  version: '1.0.0',
  category: 'layout',
  group: 'Grid',
  name: 'Freeze Effector',
  description: 'Keep what a MOE Effector does at this frame for good: every keyframe on its null (Position, Scale, Rotation) and on its controls is removed and the values at the playhead stay. The effector stays linked and editable; the other effectors are not touched. Restore puts every keyframe back.',
  keywords: ['effector', 'freeze', 'hold', 'bake frame', 'current frame', 'static', 'stop'],
  icon: 'lock',
  params: {},
  requires: { comp: true, layers: 1 },
  permissions: ['modify.keyframes'],
  recovery: 'undo+checkpoint',
  ai: { callable: true, hint: 'Removes all keyframes from the selected MOE Effector null(s) (transform + controls), leaving the values at the current time. Restorable.' },
  uses: { hostOps: ['props.values', 'keys.snapshot', 'keys.rebuild', 'props.setValues'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Freeze at This Frame' },

  prepare(args, ctx) {
    const list = effectorsIn(ctx);
    if (!list.length) return need(ctx, 'freeze');
    return { ok: true, effectors: list, preview: { summary: `Freeze ${list.map((l) => l.name).join(', ')} at ${ctx.comp.time.toFixed(2)} s`, items: ['Its keyframes are removed; the values at the playhead stay', 'The effector stays linked — move it or change its sliders any time', 'Restore brings every keyframe back'] } };
  },

  explain(args, ctx, prepared) {
    const out = { target: 'MOE Effector null', writes: ['Removes the keyframes of Position / Scale / Rotation and of its controls', 'Sets each to its value at the playhead'] };
    if (prepared && prepared.ok) out.target = prepared.effectors.map((l) => l.name).join(', ');
    return out;
  },

  async execute({ ctx, prepared, host }) {
    const comp = ctx.comp;
    // which controls are on each null (controls on demand: not all of them are)
    const probe = [];
    prepared.effectors.forEach((l) => EF.CONTROLS.forEach(([name, kind]) => { if (kind !== 'menu' && kind !== 'layer') probe.push({ layer: l, name, address: ctlAddr(l.id, name, kind) }); }));
    const have = await host.call('props.values', { compId: comp.id, time: comp.time, items: probe.map((p) => ({ address: p.address })) });
    const present = new Set(probe.filter((p, i) => !have.items[i].error).map((p) => `${p.layer.id}:${p.name}`));
    const targets = [];
    prepared.effectors.forEach((l) => freezeTargets(l.id, (n) => present.has(`${l.id}:${n}`)).forEach((t) => targets.push(Object.assign({ layer: l.name }, t))));
    const snap = await host.call('keys.snapshot', { compId: comp.id, items: targets.map((t) => ({ address: t.address })) });
    const keyed = targets.map((t, i) => ({ t, before: snap.items[i].snapshot || [] })).filter((x) => x.before.length);
    if (!keyed.length) return { frozen: [], names: prepared.effectors.map((l) => l.name), time: comp.time, values: { items: [] }, after: { items: [] }, held: [] };
    // read everything first, then write
    const at = await host.call('props.values', { compId: comp.id, time: comp.time, items: keyed.map((x) => ({ address: x.t.address })) });
    await host.call('keys.rebuild', { compId: comp.id, items: keyed.map((x) => ({ address: x.t.address, snapshot: [] })) });
    await host.call('props.setValues', { compId: comp.id, label: 'MOE: Freeze Effector', items: keyed.map((x, i) => ({ address: x.t.address, value: at.items[i].value })) });
    // read back: no keys left, and the value holds a second later
    const after = await host.call('keys.snapshot', { compId: comp.id, items: keyed.map((x) => ({ address: x.t.address })) });
    const later = await host.call('props.values', { compId: comp.id, time: comp.time + 1, items: keyed.map((x) => ({ address: x.t.address })) });
    return { frozen: keyed.map((x) => ({ address: x.t.address, name: `${x.t.layer} › ${x.t.name}`, before: x.before })), names: prepared.effectors.map((l) => l.name), time: comp.time, values: at, after, held: later.items.map((r, i) => same(r.value, at.items[i].value)) };
  },

  verify({ result }) {
    if (!result.frozen.length) return { ok: true, checks: [{ ok: true, label: result.names.join(', '), detail: 'no keyframes on it — nothing to freeze' }] };
    const left = result.after.items.filter((it) => (it.snapshot || []).length);
    const checks = [
      { ok: left.length === 0, label: 'Keyframes removed', detail: left.length ? `${left.length} propert(ies) still keyed` : result.frozen.map((f) => `${f.name} (${f.before.length})`).join(' · ') },
      { ok: result.held.every(Boolean), label: 'Held', detail: `the values at ${result.time.toFixed(2)} s stay` }
    ];
    return { ok: checks.every((c) => c.ok), checks };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, items: result.frozen.map((f) => ({ address: f.address, snapshot: f.before })) }; },
  async restore({ data, host }) { if (data.items.length) await host.call('keys.rebuild', data); return { ok: true }; },
  summarize(result, v) { return v.ok ? (result.frozen.length ? `${result.names.join(', ')} frozen — ${result.frozen.length} propert(ies) hold their value` : 'Nothing to freeze') : 'Frozen with problems'; }
};

module.exports = { remove, freeze, freezeTargets };
