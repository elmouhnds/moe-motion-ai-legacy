'use strict';
const TC = require('../../../core/toolcard');
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
  const st = Object.assign({ tab: 'library', filter: section.modes ? section.modes[0][0] : 'All', q: '', tile: section.tiles[0].id, filled: null, open: false }, (s.studio || {})[section.id]);
  // v0.32: a section with modes (Motion: In · Out · Draw On · Proximity) always shows one mode (or Mine)
  if (section.modes && st.filter !== 'Mine' && !section.modes.some(([m]) => m === st.filter)) st.filter = section.modes[0][0];
  return st;
}
/** v0.32: columns that fit the count (no tile alone on a row), at most `max`. */
function fitCols(n, max) {
  if (max <= 2) return 2;
  if (n > 12) return n % 4 === 0 && max >= 4 ? 4 : 3;
  if (n % 3 === 0) return 3;
  if (n % 4 === 0 && max >= 4) return 4;
  if (n % 2 === 0) return 2;
  return 3;
}
const HINT_KEY = 'lib-hint-n';
const HINT_UNTIL = 3; // the "click to inspect · ▶ applies" line goes once you have applied three presets
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
  // A built-in tile can keep some of your choices (Backgrounds: a palette tile changes the palette,
  // not your style or motion — tool.ui.keepOnTile). Your own presets (Mine) apply in full.
  // v0.60: a tile with its own look (product backdrops) applies it in full — its style is the point
  const keep = !tile.user && !tile.ownLook && tool.ui && tool.ui.keepOnTile;
  app.state.set((s) => {
    const cur = s.args[tool.id] || {};
    const kept = {};
    if (keep) keep.forEach((k) => { if (cur[k] !== undefined) kept[k] = cur[k]; });
    return { args: Object.assign({}, s.args, { [tool.id]: Object.assign(defaults(tool.params || {}), tile.args, kept) }), open: Object.assign({}, s.open, { [tool.id]: true }) };
  });
}
/** Background tiles move with the Motion / Colours picked in the Inspector (your own presets with theirs). */
function tileThumb(app, t) {
  // v0.51: template tiles show the active client's colours (the same rule as the tool: templateTool.withBrand)
  if (t.tool === 'design.template') return Object.assign({}, t, { args: brandedArgs(app, t.args) });
  if (t.thumb.k !== 'bg' || t.ownLook) return t;
  const a = t.user ? t.args : Object.assign({}, app.state.get().args['design.background'] || {}, { palette: t.thumb.palette });
  const pick = {};
  // a saved preset (Mine) shows its own palette — custom brand colours too (v0.26)
  ['style', 'motion', 'colorMotion', 'loop', 'amount', 'colourAmount', 'drift'].concat(t.user ? ['palette', 'colors', 'paletteName'] : []).forEach((k) => { if (a[k] !== undefined) pick[k] = a[k]; });
  if (pick.drift && (!pick.motion || pick.motion === 'none')) pick.motion = 'drift';
  delete pick.drift;
  return Object.assign({}, t, { thumb: Object.assign({}, t.thumb, pick) });
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
  const r = availability(tool, s.ctx, a, app.services);
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
  try { const n = app.services.store.get(HINT_KEY, 0) || 0; if (n < HINT_UNTIL) app.services.store.set(HINT_KEY, n + 1); } catch (_) { /* store optional in tests */ }
  const ok = r.status === 'success' || r.status === 'partial';
  app.toast(ok ? (r.summary || tile.label) : `${tile.label}: ${(r.errors || r.reasons || [r.status]).join(' · ')}`, ok ? 2600 : 5000, ok ? (r.status === 'partial' ? 'warn' : 'ok') : 'err');
  return r;
}

/** v0.51: a template's args with the active brand filled in (what the tool will build). */
function brandedArgs(app, args) {
  try { return require('../../../features/design/templateTool').withBrand(Object.assign({}, args || {}), app.services); } catch (e) { return args; }
}
/** v0.47: the tools whose previews play their real keys (features/quick/animatePlan.js). */
const PLANNED = ['quick.animate', 'quick.trimPaths', 'design.template', 'interact.click', 'quick.wipe', 'reveal.matte', 'layout.carousel', 'quick.depth'];
function thumbEl(tile, cls, liveArgs) {
  if (tile.thumb.k === 'icon') return h('div', { class: `st-thumb icon ${cls || ''}` }, icon(tile.thumb.icon));
  // the preview gets the tool's own args — the tile's preset, or the Inspector's current settings (live)
  const th = PLANNED.includes(tile.tool) ? Object.assign({}, tile.thumb, { args: Object.assign({}, tile.args || {}, liveArgs || {}) }, cls === 'big' ? { strip: true } : {}) : tile.thumb;
  const canvas = h('canvas', { class: `st-thumb ${cls || ''}`, 'aria-hidden': 'true', 'data-key': `${tile.id}|${cls || ''}|${JSON.stringify(th)}` });
  const t0 = Math.random() * 3;
  // Still frames use 1.6 s: every recipe has finished its move by then (phase() completes at 1.45 s).
  // An Out move is gone by then, so its still frame is the moment it starts leaving (v0.23: no empty tiles).
  const still = tile.thumb.dir === 'out' ? 0.6 : 1.6;
  return widgets.animated(canvas, (now) => { const { c, W, H } = widgets.prep(canvas); thumbs.draw(c, W, H, now === null && th.args ? Object.assign({}, th, { still: true }) : th, now === null ? still : now / 1000 + t0); });
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
  const pal = PAL.resolve(args.palette || (tile.args && tile.args.palette), args.colors || (tile.args && tile.args.colors), args.paletteName || (tile.args && tile.args.paletteName));
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
  if (section.modes) { setSt(app, section, visible.some((t) => t.id === st.tile) || !visible.length ? { filter: f, open: false } : { filter: f, tile: visible[0].id, filled: null, open: false }); return; }
  const keep = visible.some((t) => t.id === st.tile);
  setSt(app, section, keep || !visible.length ? { filter: f } : { filter: f, tile: visible[0].id, filled: null });
}

/** v0.66: which groups fit the selection — the selected properties' kinds (keyed ones also fit "Your keyframes"). */
function fittingGroups(ctx) {
  const props = (ctx && ctx.properties) || [];
  const out = new Set();
  for (const p of props) {
    const n = `${p.name || ''} ${(p.address && p.address.matchNames || []).join(' ')}`;
    if (/Position/.test(n)) out.add('position');
    else if (/Scale/.test(n)) out.add('scale');
    else if (/Rotat/.test(n)) out.add('rotation');
    else if (/Opacity/.test(n)) out.add('opacity');
    if (p.numKeys > 0) out.add('keyed');
  }
  return out;
}

/** v0.66: tiles in their section's groups, the groups that fit the selection first (empty groups are dropped). */
function groupTiles(section, tiles, ctx) {
  const fits = fittingGroups(ctx);
  const gs = section.groups.map(([id, label], i) => ({ id, label, fits: fits.has(id), i, tiles: tiles.filter((t) => section.groupBy(t) === id) }))
    .filter((g) => g.tiles.length);
  return gs.sort((a, b) => (b.fits - a.fits) || (a.i - b.i));
}

function render(app, section) {
  // v0.68 (LOOK_AND_FEEL.md): a section can be one instrument instead of tiles + Inspector
  if (section.composer === 'background') return require('./bgComposer').render(app, section);
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
  // a search looks through the whole section (every mode); without one, the mode / filter decides
  const tiles = all.filter((t) => (q ? true : st.filter === 'All' || t.tags.includes(st.filter)) && (!q || t.label.toLowerCase().includes(q) || t.tags.some((g) => g.toLowerCase().includes(q))));
  const tile = all.find((t) => t.id === st.tile) || section.tiles[0];
  if (st.filled !== tile.id) setTimeout(() => { fill(app, tile); setSt(app, section, { filled: tile.id }); }, 0);
  const tool = app.services.registry.get(tile.tool);
  const pinned = app.services.favorites.list().includes(tool.id);

  // v0.32 (docs/features/LIBRARY_PAGES.md): the Inspector sits beside the tiles from 600 px; narrower, it opens
  // right under the row of the tile you click (click it again to close) instead of under the whole library.
  const wideIns = !!s.studioWide;
  const inline = !wideIns && st.open;
  const grouped = section.groupBy ? groupTiles(section, tiles, s.ctx) : null;
  const listLike = !!grouped || (tiles.length > 0 && tiles.every((t) => t.thumb && t.thumb.k === 'icon'));
  const band = s.kitBand || '';
  const cols = listLike ? 1 : fitCols(tiles.length, /kit-slim|kit-tiny/.test(band) ? 2 : /kit-narrow/.test(band) ? 3 : 4);
  const cell = (t) => {
    const rd = readiness(app, t);
    const on = t.id === tile.id;
    return h('div', { class: `st-cell ${rd.ok ? '' : `blocked ${rd.kind}`} ${listLike ? 'row' : ''}`, 'data-key': t.id },
      h('button', {
        class: `st-tile ${on ? 'on' : ''} ${t.user ? 'mine' : ''}`, title: `${t.label}${rd.ok ? '' : ` — ${rd.hint}`} · click: settings · ▶ or double-click to apply now${t.user ? ' · right-click to delete' : ''}`, 'aria-pressed': String(on), 'aria-expanded': wideIns ? undefined : String(on && inline),
        onclick: () => { setSt(app, section, on ? { open: !st.open } : { tile: t.id, filled: null, open: true }); },
        ondblclick: () => applyNow(app, t, section),
        oncontextmenu: t.user ? (e) => { e.preventDefault(); removePreset(app, section, t); } : undefined
      }, thumbEl(tileThumb(app, t)), t.isNew ? h('span', { class: 'st-new' }, 'NEW') : null,
      h('span', { class: 'st-meta' }, h('span', { class: 'st-name' }, t.label), listLike && t.hint ? h('span', { class: 'st-desc', title: t.hint }, t.hint) : null, rd.ok || rd.kind !== 'input' ? null : h('span', { class: 'st-why', title: rd.hint }, 'setup'), t.badge ? h('span', { class: `st-badge ${t.badge.toLowerCase()}` }, t.badge) : null)),
      h('button', { class: 'st-play', title: rd.ok ? `Apply ${t.label} now` : rd.hint, 'aria-label': `Apply ${t.label} now`, onclick: () => applyNow(app, t, section) }, icon('play', 'sm')));
  };

  const cardArgs = Object.assign(defaults(tool.params || {}), s.args[tool.id] || tile.args);
  const cardInfo = TC.card(tool, cardArgs, s.ctx, app.services);
  const inspector = h('aside', { class: `st-inspector ${inline ? 'inline' : ''}`, 'aria-label': 'Inspector', 'data-key': 'st-ins' },
    h('div', { class: 'st-ins-h' }, inline ? h('span', { class: 'st-ins-name' }, tile.user ? `My preset · ${tile.label}` : tile.label) : h('span', { class: 'st-kicker' }, tile.user ? 'MY PRESET' : 'INSPECTOR'), h('span', { class: 'spacer' }),
      h('button', { class: 'icon-btn', title: 'Save these settings as my preset', 'aria-label': 'Save as preset', onclick: () => saveAsPreset(app, section, tile) }, icon('presets', 'sm')),
      tile.user ? h('button', { class: 'icon-btn', title: 'Delete this preset', 'aria-label': 'Delete preset', onclick: () => removePreset(app, section, tile) }, icon('trash', 'sm')) : null,
      h('button', { class: 'icon-btn pin', 'aria-pressed': String(pinned), title: pinned ? 'Unpin from Favorites' : 'Pin to Favorites', onclick: () => { app.services.favorites.toggle(tool.id); app.render(); } }, icon('star', 'sm')),
      inline ? h('button', { class: 'icon-btn', 'data-key': 'st-ins-close', title: 'Close the settings', 'aria-label': 'Close settings', onclick: () => setSt(app, section, { open: false }) }, icon('x', 'sm')) : null),
    // v0.66 (docs/features/TOOL_CARDS.md): the card says what this tile will do before Apply — what it acts on, what
    // it writes, how to undo it, and the exact code for expressions; the sticky bar below is the one Apply.
    (() => {
      const thumb = inline || widgets.body[tool.id] || (tool.ui && tool.ui.renderBody) ? null : thumbEl(tile, 'big', PLANNED.includes(tool.id) ? (tool.id === 'design.template' ? brandedArgs(app, Object.assign({}, tile.args, app.state.get().args[tool.id] || {})) : app.state.get().args[tool.id]) : null);
      return thumb || null;
    })(),
    inline ? null : h('div', { class: 'st-ins-title' }, tile.label),
    section.extras === 'palette' ? paletteExtras(app, tile) : h('div', { class: 'why st-ins-desc', title: tool.description }, tile.hint || cardInfo.purpose),
    cardBlock(app, cardInfo, tile),
    h('div', { class: 'st-ins-tool' }, renderTool(app, tool, { openByDefault: true, bare: true, fixed: Object.keys(tile.args || {}) })));

  let cells;
  if (grouped) {
    // a header per group; inline, the settings open right under the clicked row
    cells = [];
    for (const g of grouped) {
      cells.push(h('div', { class: `st-group-h ${g.fits ? 'fits' : ''}`, 'data-key': `gh-${g.id}`, role: 'heading', 'aria-level': '3' },
        h('span', {}, g.label), h('span', { class: 'st-group-n' }, String(g.tiles.length)), g.fits ? h('span', { class: 'st-fits', title: 'Fits the properties you selected in After Effects' }, 'fits your selection') : null));
      for (const t of g.tiles) { cells.push(cell(t)); if (inline && t.id === tile.id) cells.push(inspector); }
    }
    if (inline && !tiles.some((t) => t.id === tile.id)) cells.push(inspector);
  } else cells = tiles.map(cell);
  if (inline && !grouped) {
    const i = tiles.findIndex((t) => t.id === tile.id);
    if (i >= 0) { const end = Math.min(tiles.length, (Math.floor(i / cols) + 1) * cols); cells.splice(end, 0, inspector); } else cells.push(inspector);
  }
  const grid = h('div', { class: `st-grid ${listLike ? 'list' : 'fit'}`, style: wideIns || listLike ? null : { '--c': String(cols) } }, tiles.length ? cells
    : h('div', { class: 'empty' }, h('div', { html: art.empty(st.filter === 'Mine' ? 'star' : 'search') }), st.filter === 'Mine' ? [h('b', {}, 'No presets of your own yet'), h('br'), 'Tune a tile in the Inspector, then click ', icon('presets', 'xs'), ' Save as preset.'] : 'Nothing matches'));

  const learned = (app.services.store.get(HINT_KEY, 0) || 0) >= HINT_UNTIL;
  const hint = learned ? null : h('div', { class: 'st-hint' }, wideIns ? 'Click to inspect' : 'Click a tile for its settings', ' · ▶ applies now · F4 repeats the last change · save your own settings with ', icon('presets', 'xs'));
  return h('div', { class: 'view studio-sec' }, tabs,
    filterRow(app, section, all, st, mine),
    // v0.19: a selected MOE Grid shows its live controls above the library (Layout section)
    section.id === 'layout' ? require('../gridPanel').render(app) : null,
    h('div', { class: `st-body ${wideIns ? 'wide' : ''}` }, h('div', { class: 'st-main' }, grid, hint), wideIns ? inspector : null),
    actionBar(app, section, tile, tool));
}

/**
 * v0.32: the filter row. A section with modes (Motion, Layout) shows one switch — the modes are what the
 * tiles are for (In / Out / Draw On…), so only that set shows; the rest keep chips on one line, Mine first.
 */
/** v0.66 Tool Card body: what it will do (or what it needs), how to undo it, and the code with its numbers lit. */
function cardBlock(app, c, tile) {
  const will = c.ready
    ? h('div', { class: 'tc-will', 'data-key': 'tc-will' },
      h('div', { class: 'tc-will-h' }, h('span', { class: 'tc-k' }, 'Will do'), c.target ? h('span', { class: 'tc-on', title: 'What it acts on' }, icon('target', 'xs'), c.target) : null),
      h('ul', { class: 'tc-list' }, c.writes.slice(0, 5).map((w) => h('li', {}, icon('check', 'xs'), h('span', {}, w))),
        (c.warnings || []).map((w) => h('li', { class: 'tc-warn' }, icon('info', 'xs'), h('span', {}, w)))),
      h('div', { class: 'tc-undo' }, c.undo))
    : h('div', { class: 'tc-needs', 'data-key': 'tc-needs' }, icon('info', 'xs'), h('span', {}, c.needs));
  const code = c.code ? h('div', { class: 'tc-code', 'data-key': 'tc-code' },
    h('div', { class: 'tc-code-h' }, c.signature ? h('code', { class: 'tc-sig', title: 'The expression and its numbers' }, c.signature) : h('span', { class: 'tc-k' }, 'Expression'), h('span', { class: 'spacer' }),
      h('button', { class: 'btn ghost sm', 'data-key': 'tc-copy', title: 'Copy the expression', onclick: () => { try { navigator.clipboard.writeText(c.code).then(() => app.toast('Expression copied', 1600, 'ok'), () => app.toast('Could not copy', 2000)); } catch (e) { app.toast('Could not copy', 2000); } } }, icon('copy', 'xs'), 'Copy')),
    h('pre', { class: 'tc-pre' }, TC.codeRuns(c.code, c.numbers).map((r) => (r.num ? h('b', { class: 'tc-num' }, r.text) : r.text)))) : null;
  return h('div', { class: 'tc', 'data-key': `tc-${tile.id}` }, will, code);
}

function filterRow(app, section, all, st, mine) {
  const mineChip = h('button', { class: 'chip-btn mine', 'data-key': 'f-Mine', 'aria-pressed': String(st.filter === 'Mine'), onclick: () => pickFilter(app, section, all, 'Mine') }, icon('presets', 'xs'), ` Mine${mine.length ? ` ${mine.length}` : ''}`);
  if (section.modes) {
    const count = (tag) => all.filter((t) => t.tags.includes(tag)).length;
    return h('div', { class: 'st-chips st-modes' },
      h('div', { class: 'kit-seg st-seg', role: 'group', 'aria-label': `${section.label}: show` }, section.modes.map(([m, label, title]) => h('button', {
        'aria-pressed': String(st.filter === m), 'data-key': `m-${m}`, title: `${title || label} · ${count(m)}`, onclick: () => pickFilter(app, section, all, m) }, label))),
      mineChip,
      (section.elsewhere || []).map(([id, label, title]) => h('button', { class: 'chip-btn st-away', 'data-key': `away-${id}`, title, onclick: () => app.go(id) }, label, icon('chev', 'xs'))));
  }
  const filters = section.filters.filter((f) => f !== 'All');
  return h('div', { class: 'st-chips one-line' },
    h('button', { class: 'chip-btn', 'data-key': 'f-All', 'aria-pressed': String(st.filter === 'All'), onclick: () => pickFilter(app, section, all, 'All') }, 'All'), mineChip,
    filters.map((f) => h('button', { class: 'chip-btn', 'data-key': `f-${f}`, 'aria-pressed': String(st.filter === f), onclick: () => pickFilter(app, section, all, f) }, f)));
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
    // v0.29: any built-in preset can sit on the Quick Bar — the bar holds this tile itself (one source)
    (() => {
      if (tile.user || !section || !tile.tool) return null;
      const qb = require('../quickbar');
      const ref = `tile:${section.id}/${tile.id}`;
      if (!qb.tileAction(ref)) return null;
      const on = qb.barIds(app).includes(ref);
      return h('button', { class: `btn ghost st-qbpin ${on ? 'on' : ''}`, 'data-key': `qbpin-${tile.id}`, 'aria-pressed': String(on), 'aria-label': on ? `Remove ${tile.label} from the Quick Bar` : `Add ${tile.label} to the Quick Bar`,
        title: on ? 'On your Quick Bar — click to remove' : 'Add this preset to your Quick Bar', onclick: () => { qb.togglePin(app, ref); app.toast(on ? `${tile.label} removed from the Quick Bar` : `${tile.label} added to the Quick Bar`, 2200, 'ok'); } }, icon('star', 'sm'));
    })(),
    s.studioWide || !section || !section.tiles ? (s.studioWide ? null : h('button', { class: 'btn ghost', title: 'Show the settings of this tile', onclick: () => { const el = document.querySelector('.st-inspector'); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } }, icon('sliders', 'sm'), h('span', { class: 'label' }, 'Settings')))
      : h('button', { class: `btn ghost ${stateOf(app, section).open ? 'on' : ''}`, 'data-key': 'act-settings', 'aria-pressed': String(!!stateOf(app, section).open), title: 'Show the settings of this tile under its row', onclick: () => { const open = !stateOf(app, section).open; setSt(app, section, { open }); if (open) setTimeout(() => { const el = document.querySelector('.st-inspector.inline'); if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 30); } }, icon('sliders', 'sm'), h('span', { class: 'label' }, 'Settings')),
    h('button', { class: 'btn primary', disabled: !rd.ok || !!s.running, title: rd.ok ? `${(tool.ui && tool.ui.primaryLabel) || 'Apply'} (${tile.label})` : rd.hint, onclick: () => applyNow(app, tile, section, args) },
      running ? h('span', { class: 'spin' }) : icon('play', 'sm'), (tool.ui && tool.ui.primaryLabel) || 'Apply'));
}

module.exports = { saveAsClient, fitCols, filterRow, HINT_KEY, render, stateOf, setSt, fill, applyNow, readiness, userTiles, actionBar, thumbEl, tileThumb };
