'use strict';
/**
 * "Your grid" (v0.19, Grid Builder 2): when a MOE Grid null — or some of its items — is selected,
 * the Layout section shows its live controls instead of making you type JSON:
 *   Layout chips (switch live; every control and keyframe stays) · Morph To chips + Morph slider ·
 *   Orient chips · the items in place order (drag, or ↑ / ↓) with Layer order / Name / Reverse /
 *   Shuffle · Twist and Delay for the selected items.
 * Every change runs a registered tool (grid.update / grid.items): validated, verified, undoable.
 * The grid's state is read once per grid and refreshed after each change (no background polling).
 */
const { h, icon } = require('./dom');
const L = require('../../features/grid/layouts');
const X = require('../../features/grid/expressions');
const GT = require('../../features/grid/tools');
const { defaults } = require('../../core/schema');

const cache = new Map(); // grid layer id → { key, data, error }
const shown = new Set(); // grids whose panel was already brought into view once
function stamp(app) { const e = app.services.executor.history(1)[0]; return e ? `${e.toolId}|${e.at || e.time || ''}|${e.checkpointId || ''}` : '-'; }

async function load(app, ctx, grid) {
  const host = app.services.host, compId = ctx.comp.id;
  const names = ['Layout', 'Morph To', 'Morph', 'Orient'];
  const vals = await host.call('props.values', { compId, items: names.map((n) => ({ address: X.controlAddress(grid.id, n) })) });
  const desc = await host.call('layers.describe', { compId });
  const kids = desc.layers.filter((l) => l.parentId === grid.id);
  const scan = kids.length ? await host.call('proximity.scan', { compId, layerIds: kids.map((k) => k.id), tag: X.TAG }) : { expressions: [] };
  const peek = scan.expressions.length ? await host.call('expressions.peek', { compId, items: scan.expressions.map((a) => ({ address: a })) }) : { items: [] };
  const codeOf = (id) => { const j = scan.expressions.findIndex((a) => a.layerId === id); return j >= 0 ? peek.items[j].expression : ''; };
  const items = kids.map((k) => ({ id: k.id, name: k.name, index: k.index, slot: (X.slotOf(codeOf(k.id)) || { i: 1e6 }).i, v2: X.isV2(codeOf(k.id)) }))
    .filter((x) => x.slot < 1e6).sort((a, b) => a.slot - b.slot);
  const value = {};
  names.forEach((n, i) => { const it = vals.items[i]; value[n] = it && it.value !== null && !it.error ? Number(it.value) : null; });
  return { items, value, v2: items.some((x) => x.v2) && value.Layout !== null };
}

function run(app, toolId, args, label) {
  const tool = app.services.registry.get(toolId);
  return app.runTool(toolId, Object.assign(defaults(tool.params || {}), args), { label }).then((r) => { if (r && r.status !== 'success') app.toast(r.summary || (r.errors || []).join(' · ') || r.status, 4000, 'err'); return r; });
}
const setControl = (app, grid, name, v) => run(app, 'grid.update', { gridId: grid.id, values: JSON.stringify({ [name]: v }) }, `Grid: ${name}`);
const setControls = (app, grid, values, label) => run(app, 'grid.update', { gridId: grid.id, values: JSON.stringify(values) }, label);
const order = (app, grid, sort, ids) => run(app, 'grid.items', { action: 'order', gridId: grid.id, sort, order: ids ? JSON.stringify(ids) : '' }, 'Grid order');

const chips = (label, list, cur, onPick, opts = {}) => h('div', { class: 'gp-row' }, h('span', { class: 'gp-l' }, label),
  h('div', { class: 'gp-chips', role: 'radiogroup', 'aria-label': label }, list.map((name, j) => h('button', {
    class: 'bgm-chip', role: 'radio', 'aria-checked': String(cur === j + 1), 'data-key': `${opts.key || label}-${j + 1}`, disabled: !!opts.disabled, title: opts.titles ? opts.titles[j] : name, onclick: () => onPick(j + 1)
  }, name))));

function itemsList(app, grid, items) {
  let dragId = null;
  const ids = items.map((x) => x.id);
  const move = (id, to) => { const from = ids.indexOf(id); if (from < 0 || to < 0 || to >= ids.length || from === to) return; const next = ids.slice(); next.splice(from, 1); next.splice(to, 0, id); order(app, grid, 'custom', next); };
  return h('ol', { class: 'gp-items', 'aria-label': 'Items in place order' }, items.map((it, j) => h('li', {
    class: 'gp-item', draggable: 'true', 'data-key': `it-${it.id}`, title: 'Drag to change its place',
    ondragstart: (e) => { dragId = it.id; try { e.dataTransfer.setData('text/plain', String(it.id)); e.dataTransfer.effectAllowed = 'move'; } catch (_) { /* old CEP */ } },
    ondragover: (e) => { e.preventDefault(); },
    ondrop: (e) => { e.preventDefault(); const id = dragId || Number((e.dataTransfer && e.dataTransfer.getData('text/plain')) || 0); dragId = null; if (id) move(id, j); }
  }, h('span', { class: 'gp-n' }, String(j + 1)), icon('moveTB', 'xs gp-grip'), h('span', { class: 'gp-name' }, it.name),
  h('button', { class: 'icon-btn', 'aria-label': `Move ${it.name} up`, title: 'Earlier place', disabled: j === 0, onclick: () => move(it.id, j - 1) }, icon('chev', 'xs gp-up')),
  h('button', { class: 'icon-btn', 'aria-label': `Move ${it.name} down`, title: 'Later place', disabled: j === items.length - 1, onclick: () => move(it.id, j + 1) }, icon('chev', 'xs gp-down')))));
}

function render(app) {
  const s = app.state.get(), ctx = s.ctx;
  if (!ctx || !ctx.comp) return null;
  const grid = GT.gridFor(ctx, {});
  if (!grid) return null;
  const key = stamp(app);
  let e = cache.get(grid.id);
  if (!e || e.key !== key) {
    e = { key, data: null, error: null };
    cache.set(grid.id, e);
    const entry = e;
    load(app, ctx, grid).then((d) => {
      entry.data = d; app.scheduleRender ? app.scheduleRender() : app.render();
      // first time this grid's panel appears (e.g. right after Build Grid): bring it into view once
      if (!shown.has(grid.id)) { shown.add(grid.id); setTimeout(() => { const el = document.querySelector(`[data-key="gp-${grid.id}"]`); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 60); }
    }, (err) => { entry.error = err.message; app.render(); });
  }
  const d = e.data;
  const head = h('div', { class: 'gp-h' }, icon('grid', 'sm'), h('b', {}, grid.name), d ? h('span', { class: 'gp-sub' }, `${d.items.length} items`) : h('span', { class: 'gp-sub' }, e.error ? 'could not read' : 'reading…'), h('span', { class: 'spacer' }),
    h('span', { class: 'kit-hint' }, 'live — also in Effect Controls'));
  if (!d) return h('section', { class: 'gp', 'data-key': `gp-${grid.id}`, 'aria-label': 'Your grid' }, head, e.error ? h('div', { class: 'notice err' }, e.error) : null);
  const v = d.value, busy = !!s.running;
  const sel = (ctx.layers || []).filter((l) => l.parentIndex === grid.index);
  const morphVal = v.Morph === null ? 0 : v.Morph;
  const range = h('input', { type: 'range', min: 0, max: 100, step: 1, value: morphVal, 'aria-label': 'Morph', disabled: !d.v2 || busy, style: { '--pct': `${morphVal}%` } });
  range.addEventListener('input', (ev) => { range.style.setProperty('--pct', `${ev.target.value}%`); const out = range.parentNode && range.parentNode.querySelector('.gp-val'); if (out) out.textContent = `${ev.target.value}%`; });
  range.addEventListener('change', (ev) => setControl(app, grid, 'Morph', Number(ev.target.value)));
  return h('section', { class: 'gp', 'data-key': `gp-${grid.id}`, 'aria-label': 'Your grid' }, head,
    d.v2 ? null : h('div', { class: 'notice' }, 'Built before v0.19: Layout, Morph and Orient need a rebuild (Release › Remove, then build again). Changing the order works.'),
    // picking the layout the grid morphs to swaps the two, so Morph keeps meaning something
    chips('Layout', L.MODES.map((m) => m.label), v.Layout, (j) => (j === v['Morph To'] && v.Layout ? setControls(app, grid, { Layout: j, 'Morph To': v.Layout }, 'Grid: Layout') : setControl(app, grid, 'Layout', j)), { disabled: !d.v2 || busy, key: 'gp-layout', titles: L.MODES.map((m) => `Switch to ${m.label} — controls and keyframes stay`) }),
    chips('Morph to', L.MODES.map((m) => m.label), v['Morph To'], (j) => setControl(app, grid, 'Morph To', j), { disabled: !d.v2 || busy, key: 'gp-morphto', titles: L.MODES.map((m) => `Blend into ${m.label} with the Morph slider`) }),
    h('div', { class: 'gp-row' }, h('span', { class: 'gp-l' }, 'Morph'), v.Layout && v.Layout === v['Morph To'] ? h('span', { class: 'kit-hint' }, 'Pick a different “Morph to” layout to blend into') : h('div', { class: 'slider-row' }, range, h('span', { class: 'gp-val' }, `${Math.round(morphVal)}%`))),
    chips('Orient', L.ORIENTS, v.Orient, (j) => setControl(app, grid, 'Orient', j), { disabled: !d.v2 || busy, key: 'gp-orient', titles: ['Turn with the grid null', 'Face the centre (or the path)', 'Stay upright when the grid spins'] }),
    h('div', { class: 'gp-row top' }, h('span', { class: 'gp-l' }, 'Places'),
      h('div', { class: 'gp-col' },
        h('div', { class: 'gp-chips' }, [['layer', 'Layer order'], ['name', 'Name A→Z'], ['reverse', 'Reverse'], ['shuffle', 'Shuffle']].map(([id, label]) => h('button', { class: 'bgm-chip', 'data-key': `gp-sort-${id}`, disabled: busy, title: `Put the items in ${label.toLowerCase()} — the layer stack stays`, onclick: () => order(app, grid, id) }, label))),
        itemsList(app, grid, d.items))),
    sel.length ? tweakRow(app, grid, sel, d.v2) : h('div', { class: 'kit-hint gp-tip' }, 'Tip: select some items of this grid to give them their own Twist or Delay. Move an item by hand — it keeps that nudge.'));
}

function tweakRow(app, grid, sel, v2) {
  const twist = h('input', { class: 'num', type: 'number', value: 0, step: 1, min: -720, max: 720, 'aria-label': 'Twist for the selected items' });
  const delay = h('input', { class: 'num', type: 'number', value: 0, step: 1, min: -100, max: 100, 'aria-label': 'Delay for the selected items' });
  return h('div', { class: 'gp-row' }, h('span', { class: 'gp-l' }, `${sel.length} selected`),
    h('div', { class: 'gp-tweak' }, h('label', {}, 'Twist', twist, h('span', { class: 'unit' }, '°')), h('label', {}, 'Delay', delay, h('span', { class: 'unit' }, '%')),
      h('button', { class: 'btn sm', disabled: !v2, title: v2 ? 'Give the selected items their own twist and build delay' : 'Rebuild the grid (v0.19) to tweak single items', onclick: () => run(app, 'grid.items', { action: 'tweak', gridId: grid.id, twist: Number(twist.value) || 0, delay: Number(delay.value) || 0 }, 'Grid item tweak') }, 'Apply')));
}

module.exports = { render, load };
