'use strict';
/**
 * Studio library section: filter chips + search + visual tiles, and an Inspector that
 * hosts the selected tile's tool (its own form, preview widget, Apply and report).
 * Click a tile = select it (settings filled from the tile). Double-click = apply now.
 * "Mine" lists the user's own presets for this section (saved from the Inspector).
 * "All tools" tab lists every tool of the section as classic blocks.
 */
const { h, icon } = require('../dom');
const { renderTool, availability } = require('../toolBlock');
const { defaults, validateArgs } = require('../../../core/schema');
const widgets = require('../widgets');
const thumbs = require('./thumbs');
const art = require('../art');

function stateOf(app, section) {
  const s = app.state.get();
  return Object.assign({ tab: 'library', filter: 'All', q: '', tile: section.tiles[0].id, filled: null }, (s.studio || {})[section.id]);
}
function setSt(app, section, patch) {
  app.state.set((s) => ({ studio: Object.assign({}, s.studio, { [section.id]: Object.assign({}, stateOf(app, section), patch) }) }));
}

/** The user's presets for tools of this section, as tiles (thumbnail borrowed from the source tile). */
function userTiles(app, section) {
  const toolIds = new Set(section.tiles.map((t) => t.tool));
  return app.services.presets.list().filter((p) => toolIds.has(p.toolId)).map((p) => {
    const src = section.tiles.find((t) => t.id === p.tile) || section.tiles.find((t) => t.tool === p.toolId);
    return { id: `user-${p.id}`, presetId: p.id, label: p.name, tool: p.toolId, args: Object.assign({}, src ? src.args : {}, p.args), thumb: src ? src.thumb : { k: 'icon', icon: 'presets' }, tags: ['Mine'], badge: 'MINE', user: true };
  });
}

/** Fill the tool's settings from the tile (once per selection). */
function fill(app, tile) {
  const tool = app.services.registry.get(tile.tool);
  app.state.set((s) => ({ args: Object.assign({}, s.args, { [tool.id]: Object.assign(defaults(tool.params || {}), tile.args) }), open: Object.assign({}, s.open, { [tool.id]: true }) }));
}

/**
 * Can this tile run on the current selection? (v0.7, UX audit: 32 tile runs failed with a message
 * the user only saw after clicking.) Same check as the tool's own Run button: requirements, then
 * prepare(). kind: 'select' = the selection does not fit; 'input' = a setting must be chosen first.
 */
function readiness(app, tile, args) {
  const s = app.state.get();
  if (!s.ctx) return { ok: false, kind: 'select', hint: s.hostError ? 'After Effects not connected' : 'Reading After Effects…' };
  const tool = app.services.registry.get(tile.tool);
  const a = args || Object.assign(defaults(tool.params || {}), tile.args);
  // Settings first (a required description / layer / file), exactly as the executor validates them.
  const v = validateArgs(tool.params || {}, a);
  if (!v.ok) return { ok: false, kind: 'input', hint: v.errors[0] };
  const r = availability(tool, s.ctx, a);
  if (r.ok) return { ok: true, hint: r.hint };
  // 'input' only when a setting is missing (a required pick or a setup tile); else the selection does not fit.
  const input = tile.needsInput || /is required|^Choose /i.test(r.hint || '');
  return { ok: false, kind: input ? 'input' : 'select', hint: r.hint || 'Not available for this selection' };
}

/** ▶ / double-click / search Enter: run the tile now — or explain why not and open its settings. */
async function applyNow(app, tile, section, args) {
  const tool = app.services.registry.get(tile.tool);
  const runArgs = args || Object.assign(defaults(tool.params || {}), tile.args);
  const ready = readiness(app, tile, runArgs);
  if (!ready.ok) {
    if (section) setSt(app, section, { tile: tile.id, filled: null });
    app.toast(`${tile.label}: ${ready.hint}${ready.kind === 'input' ? ' — set it in the Inspector' : ''}`, 4500, 'warn');
    return null;
  }
  const r = await app.runTool(tile.tool, runArgs, { label: tile.label });
  if (!r) return r;
  const ok = r.status === 'success' || r.status === 'partial';
  app.toast(ok ? (r.summary || tile.label) : `${tile.label}: ${(r.errors || r.reasons || [r.status]).join(' · ')}`, ok ? 2600 : 5000, ok ? (r.status === 'partial' ? 'warn' : 'ok') : 'err');
  return r;
}

function thumbEl(tile, cls) {
  if (tile.thumb.k === 'icon') return h('div', { class: `st-thumb icon ${cls || ''}` }, icon(tile.thumb.icon));
  const canvas = h('canvas', { class: `st-thumb ${cls || ''}`, 'aria-hidden': 'true', 'data-key': `${tile.id}|${cls || ''}|${JSON.stringify(tile.thumb)}` });
  const t0 = Math.random() * 3;
  // Still frames use 1.6 s: every recipe has finished its move by then (phase() completes at 1.45 s).
  return widgets.animated(canvas, (now) => { const { c, W, H } = widgets.prep(canvas); thumbs.draw(c, W, H, tile.thumb, now === null ? 1.6 : now / 1000 + t0); });
}

async function saveAsPreset(app, section, tile) {
  const tool = app.services.registry.get(tile.tool);
  const args = Object.assign(defaults(tool.params || {}), app.state.get().args[tool.id] || {});
  const name = await app.dialog({ title: `Save as my preset`, body: `Saves the current ${tool.name} settings as a tile under "Mine".`, input: `My ${tile.label}`.slice(0, 40), okLabel: 'Save preset' });
  if (!name) return;
  const id = `pre_${Date.now().toString(36)}`;
  app.services.presets.save(tool.id, String(name).trim().slice(0, 40) || tile.label, args, { id, tile: tile.user ? null : tile.id });
  setSt(app, section, { filter: 'Mine', tile: `user-${id}`, filled: `user-${id}` });
  app.toast(`Saved "${name}" to My Presets`, 2600, 'ok');
}

async function removePreset(app, section, tile) {
  const ok = await app.dialog({ title: `Delete "${tile.label}"?`, body: 'This removes your preset tile. Nothing in the project changes.', okLabel: 'Delete', danger: true });
  if (!ok) return;
  app.services.presets.remove(tile.presetId);
  setSt(app, section, { tile: section.tiles[0].id, filled: null });
}

/** Palette panel (Backgrounds): swatches + palette actions. */
function paletteExtras(app, tile) {
  const PAL = require('../../../features/design/palettes');
  const args = app.state.get().args['design.background'] || {};
  const pal = PAL.byId(args.palette || (tile.args && tile.args.palette));
  if (!pal) return null;
  const B = require('../../../features/brand/brands');
  return h('div', { class: 'pal-panel' },
    h('div', { class: 'pal-strip' }, pal.colors.map((hex, i) => h('button', {
      class: 'pal-sw', style: { background: hex, color: B.luminance(B.hexToRgb(hex)) > 0.45 ? '#111' : '#fff' }, title: `Colour ${i} · ${hex} — click to copy`,
      onclick: () => copy(app, hex)
    }, h('span', {}, hex.slice(1))))),
    h('div', { class: 'pal-actions' },
      h('button', { class: 'btn', title: 'Colour the selected layers with this palette', onclick: () => app.runTool('design.colorize', Object.assign(defaults(app.services.registry.get('design.colorize').params), { palette: pal.id })).then((r) => r && app.toast(r.summary || r.status, 2600, r.status === 'success' ? 'ok' : 'err')) }, icon('palette', 'sm'), 'Colorize selection'),
      h('button', { class: 'btn ghost', title: 'Save this palette as a client in Brand', onclick: () => saveAsClient(app, pal) }, icon('brand', 'sm'), 'Save as client'),
      h('button', { class: 'btn ghost', title: 'Use these colours for new shapes and icons', onclick: () => { app.state.set((s) => ({ args: Object.assign({}, s.args, { 'design.insertShape': Object.assign({}, s.args['design.insertShape'] || {}, { color: pal.colors[2], color2: pal.colors[3] }) }) })); app.go('shapes'); } }, icon('shapes', 'sm'), 'Use in Shapes')));
}

async function saveAsClient(app, pal) {
  const name = await app.dialog({ title: 'Save palette as client', input: pal.name, okLabel: 'Save' });
  if (!name) return;
  const r = app.services.brands.save({ name: String(name).trim().slice(0, 60), colors: pal.colors.map((hex, i) => ({ name: `${pal.name} ${i + 1}`, hex })), fonts: { arabic: null, english: null, extra: [] } });
  app.toast(r.ok ? `Client "${r.brand.name}" saved` : r.errors.join(' · '), 2600, r.ok ? 'ok' : 'err');
  app.render();
}

function copy(app, text) {
  try { navigator.clipboard.writeText(text).then(() => app.toast(`${text} copied`, 1600, 'ok'), () => app.toast(text, 2000)); } catch (e) { app.toast(text, 2000); }
}

/** Switch filter; if the selected tile is hidden by it, select the first visible one. */
function pickFilter(app, section, all, f) {
  const st = stateOf(app, section);
  const visible = all.filter((t) => f === 'All' || t.tags.includes(f));
  const keep = visible.some((t) => t.id === st.tile);
  setSt(app, section, keep || !visible.length ? { filter: f } : { filter: f, tile: visible[0].id, filled: null });
}

function render(app, section) {
  const s = app.state.get();
  const st = stateOf(app, section);
  const tools = app.services.registry.list().filter((t) => !(t.ui && t.ui.hidden) && (section.tools ? section.tools(t) : section.tiles.some((x) => x.tool === t.id)));
  const mine = userTiles(app, section);
  const all = section.tiles.concat(mine);
  const tabs = h('div', { class: 'st-tabs', role: 'tablist' },
    [['library', 'Library'], ['all', 'All tools']].concat(section.editor ? [['editor', 'Editor']] : []).map(([id, label]) => h('button', { role: 'tab', 'aria-selected': String(st.tab === id), onclick: () => setSt(app, section, { tab: id }) }, label)),
    h('span', { class: 'spacer' }),
    st.tab === 'library' ? h('input', { class: 'txt st-search', 'data-fk': `st-q-${section.id}`, placeholder: `Search ${all.length} ${section.label.toLowerCase()}…`, value: st.q, 'aria-label': `Search ${section.label}`, oninput: (e) => { st.q = e.target.value; }, onchange: (e) => setSt(app, section, { q: e.target.value }) }) : null);

  if (st.tab === 'editor') return h('div', { class: 'view studio-sec' }, tabs, require('../views/expressions').render(app));
  if (st.tab === 'all') {
    return h('div', { class: 'view studio-sec' }, tabs, tools.map((t, i) => renderTool(app, t, { openByDefault: i === 0 })));
  }

  const q = (st.q || '').toLowerCase();
  const tiles = all.filter((t) => (st.filter === 'All' || t.tags.includes(st.filter)) && (!q || t.label.toLowerCase().includes(q) || t.tags.some((g) => g.toLowerCase().includes(q))));
  const tile = all.find((t) => t.id === st.tile) || section.tiles[0];
  if (st.filled !== tile.id) setTimeout(() => { fill(app, tile); setSt(app, section, { filled: tile.id }); }, 0);
  const tool = app.services.registry.get(tile.tool);
  const pinned = app.services.favorites.list().includes(tool.id);

  const grid = h('div', { class: 'st-grid' }, tiles.length ? tiles.map((t) => {
    const rd = readiness(app, t);
    return h('div', { class: `st-cell ${rd.ok ? '' : `blocked ${rd.kind}`}`, 'data-key': t.id },
      h('button', {
        class: `st-tile ${t.id === tile.id ? 'on' : ''} ${t.user ? 'mine' : ''}`, title: `${t.label}${rd.ok ? '' : ` — ${rd.hint}`} · ▶ or double-click to apply now${t.user ? ' · right-click to delete' : ''}`, 'aria-pressed': String(t.id === tile.id),
        onclick: () => { setSt(app, section, { tile: t.id, filled: null }); },
        ondblclick: () => applyNow(app, t, section),
        oncontextmenu: t.user ? (e) => { e.preventDefault(); removePreset(app, section, t); } : undefined
      }, thumbEl(t), t.isNew ? h('span', { class: 'st-new' }, 'NEW') : null,
      h('span', { class: 'st-meta' }, h('span', { class: 'st-name' }, t.label), rd.ok || rd.kind !== 'input' ? null : h('span', { class: 'st-why', title: rd.hint }, 'setup'), t.badge ? h('span', { class: `st-badge ${t.badge.toLowerCase()}` }, t.badge) : null)),
      h('button', { class: 'st-play', title: rd.ok ? `Apply ${t.label} now` : rd.hint, 'aria-label': `Apply ${t.label} now`, onclick: () => applyNow(app, t, section) }, icon('play', 'sm')));
  })
    : h('div', { class: 'empty' }, h('div', { html: art.empty(st.filter === 'Mine' ? 'star' : 'search') }), st.filter === 'Mine' ? [h('b', {}, 'No presets of your own yet'), h('br'), 'Tune a tile in the Inspector, then click ', icon('presets', 'xs'), ' Save as preset.'] : 'Nothing matches'));

  const inspector = h('aside', { class: 'st-inspector', 'aria-label': 'Inspector' },
    h('div', { class: 'st-ins-h' }, h('span', { class: 'st-kicker' }, tile.user ? 'MY PRESET' : 'INSPECTOR'), h('span', { class: 'spacer' }),
      h('button', { class: 'icon-btn', title: 'Save these settings as my preset', 'aria-label': 'Save as preset', onclick: () => saveAsPreset(app, section, tile) }, icon('presets', 'sm')),
      tile.user ? h('button', { class: 'icon-btn', title: 'Delete this preset', 'aria-label': 'Delete preset', onclick: () => removePreset(app, section, tile) }, icon('trash', 'sm')) : null,
      h('button', { class: 'icon-btn pin', 'aria-pressed': String(pinned), title: pinned ? 'Unpin from Favorites' : 'Pin to Favorites', onclick: () => { app.services.favorites.toggle(tool.id); app.render(); } }, icon('star', 'sm'))),
    widgets.body[tool.id] || (tool.ui && tool.ui.renderBody) ? null : thumbEl(tile, 'big'),
    h('div', { class: 'st-ins-title' }, tile.label),
    section.extras === 'palette' ? paletteExtras(app, tile) : h('div', { class: 'why st-ins-desc', title: tool.description }, tile.hint || tool.description),
    h('div', { class: 'st-ins-tool' }, renderTool(app, tool, { openByDefault: true })));

  const filters = section.filters.concat(['Mine']);
  return h('div', { class: 'view studio-sec' }, tabs,
    h('div', { class: 'st-chips' }, filters.map((f) => h('button', { class: `chip-btn ${f === 'Mine' ? 'mine' : ''}`, 'aria-pressed': String(st.filter === f), onclick: () => pickFilter(app, section, all, f) }, f === 'Mine' ? [icon('presets', 'xs'), ` Mine${mine.length ? ` ${mine.length}` : ''}`] : f))),
    h('div', { class: `st-body ${s.studioWide ? 'wide' : ''}` }, h('div', { class: 'st-main' }, grid, h('div', { class: 'st-hint' }, 'Click to inspect · ▶ applies now · F4 repeats the last change · save your own settings with ', icon('presets', 'xs'))), inspector),
    actionBar(app, section, tile, tool));
}

/**
 * Sticky action bar (v0.7): the selected tile, what it will do on the current selection, and Apply —
 * one click from any scroll position (Apply used to sit up to 4 screens down in a docked panel).
 */
function actionBar(app, section, tile, tool) {
  const s = app.state.get();
  const args = Object.assign(defaults(tool.params || {}), s.args[tool.id] || tile.args);
  const rd = readiness(app, tile, args);
  const running = s.running === tool.id;
  return h('div', { class: 'st-actbar', role: 'region', 'aria-label': 'Apply' },
    h('div', { class: 'st-act-text' },
      h('div', { class: 'st-act-name' }, tile.label),
      h('div', { class: `st-act-hint ${rd.ok ? '' : 'warn'}`, title: rd.hint }, rd.hint || tool.name)),
    s.studioWide ? null : h('button', { class: 'btn ghost', title: 'Show the settings of this tile', onclick: () => { const el = document.querySelector('.st-inspector'); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } }, icon('sliders', 'sm'), h('span', { class: 'label' }, 'Settings')),
    h('button', { class: 'btn primary', disabled: !rd.ok || !!s.running, title: rd.ok ? `${(tool.ui && tool.ui.primaryLabel) || 'Apply'} (${tile.label})` : rd.hint, onclick: () => applyNow(app, tile, section, args) },
      running ? h('span', { class: 'spin' }) : icon('play', 'sm'), (tool.ui && tool.ui.primaryLabel) || 'Apply'));
}

module.exports = { render, stateOf, setSt, fill, applyNow, readiness, userTiles, actionBar };
