'use strict';
/**
 * Studio library section: filter chips + search + visual tiles, and an Inspector that
 * hosts the selected tile's tool (its own form, preview widget, Apply and report).
 * Click a tile = select it (settings filled from the tile). Double-click = apply now.
 * "All tools" tab lists every tool of the section as classic blocks.
 */
const { h, icon } = require('../dom');
const { renderTool } = require('../toolBlock');
const { defaults } = require('../../../core/schema');
const widgets = require('../widgets');
const thumbs = require('./thumbs');

function stateOf(app, section) {
  const s = app.state.get();
  return Object.assign({ tab: 'library', filter: 'All', q: '', tile: section.tiles[0].id, filled: null }, (s.studio || {})[section.id]);
}
function setSt(app, section, patch) {
  app.state.set((s) => ({ studio: Object.assign({}, s.studio, { [section.id]: Object.assign({}, stateOf(app, section), patch) }) }));
}

/** Fill the tool's settings from the tile (once per selection). */
function fill(app, tile) {
  const tool = app.services.registry.get(tile.tool);
  app.state.set((s) => ({ args: Object.assign({}, s.args, { [tool.id]: Object.assign(defaults(tool.params || {}), tile.args) }), open: Object.assign({}, s.open, { [tool.id]: true }) }));
}

async function applyNow(app, tile) {
  const tool = app.services.registry.get(tile.tool);
  const r = await app.runTool(tile.tool, Object.assign(defaults(tool.params || {}), tile.args));
  if (!r) return;
  app.toast(r.status === 'success' || r.status === 'partial' ? (r.summary || tile.label) : `${tile.label}: ${(r.errors || r.reasons || [r.status]).join(' · ')}`, r.status === 'success' ? 2600 : 5000);
}

function thumbEl(tile, cls) {
  if (tile.thumb.k === 'icon') return h('div', { class: `st-thumb icon ${cls || ''}` }, icon(tile.thumb.icon));
  const canvas = h('canvas', { class: `st-thumb ${cls || ''}`, 'aria-hidden': 'true' });
  const t0 = Math.random() * 3;
  return widgets.animated(canvas, (now) => { const { c, W, H } = widgets.prep(canvas); thumbs.draw(c, W, H, tile.thumb, now / 1000 + t0); });
}

function render(app, section) {
  const s = app.state.get();
  const st = stateOf(app, section);
  const tools = app.services.registry.list().filter((t) => !(t.ui && t.ui.hidden) && (section.tools ? section.tools(t) : section.tiles.some((x) => x.tool === t.id)));
  const tabs = h('div', { class: 'st-tabs', role: 'tablist' },
    [['library', 'Library'], ['all', 'All tools']].concat(section.editor ? [['editor', 'Editor']] : []).map(([id, label]) => h('button', { role: 'tab', 'aria-selected': String(st.tab === id), onclick: () => setSt(app, section, { tab: id }) }, label)),
    h('span', { class: 'spacer' }),
    st.tab === 'library' ? h('input', { class: 'txt st-search', 'data-fk': `st-q-${section.id}`, placeholder: `Search ${section.tiles.length} ${section.label.toLowerCase()}…`, value: st.q, 'aria-label': `Search ${section.label}`, oninput: (e) => { st.q = e.target.value; }, onchange: (e) => setSt(app, section, { q: e.target.value }) }) : null);

  if (st.tab === 'editor') return h('div', { class: 'view studio-sec' }, tabs, require('../views/expressions').render(app));
  if (st.tab === 'all') {
    return h('div', { class: 'view studio-sec' }, tabs, tools.map((t, i) => require('../toolBlock').renderTool(app, t, { openByDefault: i === 0 })));
  }

  const q = (st.q || '').toLowerCase();
  const tiles = section.tiles.filter((t) => (st.filter === 'All' || t.tags.includes(st.filter)) && (!q || t.label.toLowerCase().includes(q) || t.tags.some((g) => g.toLowerCase().includes(q))));
  const tile = section.tiles.find((t) => t.id === st.tile) || section.tiles[0];
  if (st.filled !== tile.id) setTimeout(() => { fill(app, tile); setSt(app, section, { filled: tile.id }); }, 0);
  const tool = app.services.registry.get(tile.tool);
  const pinned = app.services.favorites.list().includes(tool.id);

  const grid = h('div', { class: 'st-grid' }, tiles.length ? tiles.map((t) => h('button', {
    class: `st-tile ${t.id === tile.id ? 'on' : ''}`, title: `${t.label} — double-click to apply now`, 'aria-pressed': String(t.id === tile.id),
    onclick: () => { setSt(app, section, { tile: t.id, filled: null }); },
    ondblclick: () => applyNow(app, t)
  }, thumbEl(t), h('span', { class: 'st-meta' }, h('span', { class: 'st-name' }, t.label), t.badge ? h('span', { class: `st-badge ${t.badge.toLowerCase()}` }, t.badge) : null))) : h('div', { class: 'empty' }, 'Nothing matches'));

  const inspector = h('aside', { class: 'st-inspector', 'aria-label': 'Inspector' },
    h('div', { class: 'st-ins-h' }, h('span', { class: 'st-kicker' }, 'INSPECTOR'), h('span', { class: 'spacer' }),
      h('button', { class: 'icon-btn pin', 'aria-pressed': String(pinned), title: pinned ? 'Unpin from Favorites' : 'Pin to Favorites', onclick: () => { app.services.favorites.toggle(tool.id); app.render(); } }, icon('star', 'sm'))),
    widgets.body[tool.id] || (tool.ui && tool.ui.renderBody) ? null : thumbEl(tile, 'big'),
    h('div', { class: 'st-ins-title' }, tile.label),
    h('div', { class: 'why st-ins-desc' }, tool.description),
    h('div', { class: 'st-ins-tool' }, renderTool(app, tool, { openByDefault: true })));

  return h('div', { class: 'view studio-sec' }, tabs,
    h('div', { class: 'st-chips' }, section.filters.map((f) => h('button', { class: 'chip-btn', 'aria-pressed': String(st.filter === f), onclick: () => setSt(app, section, { filter: f }) }, f))),
    h('div', { class: `st-body ${s.studioWide ? 'wide' : ''}` }, h('div', { class: 'st-main' }, grid, h('div', { class: 'st-hint' }, 'Click to inspect · double-click to apply now · right-click a Quick Bar button for options')), inspector));
}

module.exports = { render, stateOf, setSt, fill, applyNow };
