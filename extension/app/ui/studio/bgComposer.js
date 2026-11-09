'use strict';
/**
 * Background Composer (v0.68, docs/features/LOOK_AND_FEEL.md): the Backgrounds page as one instrument instead of a
 * wall of tiles. The stage plays the real background (bgDraw → the same plan and motion maths as the expressions in
 * After Effects); Style · Motion · Colours sit under it, always visible; palettes are light colour strips (no canvas
 * each — only the stage animates), and picking one swaps the colours while keeping the style and motion you chose.
 * Fine-tune folds the rest; the library's sticky bar is the one Apply. Tiles stay the library's own (pins, Quick Bar
 * and Recent keep working).
 */
const { h, icon } = require('../dom');
const { defaults } = require('../../../core/schema');
const PAL = require('../../../features/design/palettes');
const BM = require('../../../features/design/bgMotion');
const widgets = require('../widgets');
const { bgFrame, BG_DEFAULTS, moves } = require('../bgDraw');

const TOOL = 'design.background';
const STYLES = [['linear', 'Linear', 'Two colours along a line'], ['radial', 'Radial', 'A glow from a point'], ['mesh', 'Mesh', 'Four colours blended — the richest'], ['solid', 'Flat', 'One colour']];
// tiles that ARE a designed look (style, colours, motion): picking one takes all of it; a plain palette swaps colours only
const fullLook = (t) => t.user || (t.tags || []).includes('Product');

function argsOf(app, tile) {
  const tool = app.services.registry.get(TOOL);
  return Object.assign(defaults(tool.params || {}), app.state.get().args[TOOL] || tile.args);
}

/** What picking a tile changes: a designed look takes all of it; a plain palette only the colours (pure, tested). */
function nextArgs(cur, tile) {
  return fullLook(tile) ? Object.assign({}, cur, tile.args) : Object.assign({}, cur, { palette: tile.args.palette, colors: tile.args.colors || '', paletteName: tile.args.paletteName || '' });
}

function pick(app, section, tile) {
  const lib = require('./library');
  const next = nextArgs(argsOf(app, tile), tile);
  app.state.set((s) => ({ args: Object.assign({}, s.args, { [TOOL]: next }) }));
  lib.setSt(app, section, { tile: tile.id, filled: tile.id });
}

function stage(app, a, ctx) {
  const comp = ctx && ctx.comp && ctx.comp.width ? { width: ctx.comp.width, height: ctx.comp.height } : { width: 1920, height: 1080 };
  const pal = PAL.resolve(a.palette, a.colors, a.paletteName) || PAL.byId('tomato');
  const canvas = h('canvas', { class: 'bgc-canvas', 'aria-label': `Preview: ${pal.name}`, 'data-key': `bgc-canvas|${[a.palette, a.colors, a.style, a.from, a.to, a.angle, a.spread, a.motion, a.colorMotion, a.loop, a.amount, a.colourAmount, comp.width, comp.height].join('|')}`, style: { aspectRatio: `${comp.width} / ${comp.height}` } });
  const t0 = Date.now();
  widgets.animated(canvas, (now) => { const { c, W, H } = widgets.prep(canvas); bgFrame(c, W, H, a, comp, now === null ? 0 : ((Date.now() - t0) / 1000) % Math.max(a.loop, 0.1), false); }, { still: !moves(a) });
  return h('div', { class: 'bgc-stage', 'data-key': 'bgc-stage' }, canvas,
    h('div', { class: 'bgc-badge' }, h('b', {}, pal.name), h('span', {}, `${comp.width}×${comp.height}${moves(a) ? ` · loops every ${a.loop}s` : ' · still'}`)),
    h('div', { class: 'bgc-swatches' }, pal.colors.map((hex, i) => h('button', {
      class: 'bgc-sw', style: { background: hex }, 'data-key': `bgc-sw-${i}`, title: `${hex} — click to copy`, 'aria-label': `Copy ${hex}`,
      onclick: () => { try { navigator.clipboard.writeText(hex).then(() => app.toast(`${hex} copied`, 1400, 'ok')); } catch (e) { app.toast(hex, 1600); } } }))));
}

function seg(label, items, cur, onPick, keyPrefix, disabled) {
  return h('div', { class: 'bgc-row' },
    h('span', { class: 'bgc-k' }, label),
    h('div', { class: 'bgc-chips', role: 'radiogroup', 'aria-label': label }, items.map(([id, name, hint]) => h('button', {
      class: 'bgc-chip', role: 'radio', 'aria-checked': String(id === cur), 'data-key': `${keyPrefix}-${id}`, title: hint || name, disabled: !!disabled, onclick: () => onPick(id) }, name))));
}

function render(app, section) {
  const lib = require('./library');
  const s = app.state.get();
  const st = lib.stateOf(app, section);
  const mine = lib.userTiles(app, section);
  const all = section.tiles.concat(mine);
  const q = (st.q || '').toLowerCase();
  const tiles = all.filter((t) => (q ? true : st.filter === 'All' || t.tags.includes(st.filter)) && (!q || t.label.toLowerCase().includes(q) || t.tags.some((g) => g.toLowerCase().includes(q))));
  const tile = all.find((t) => t.id === st.tile) || section.tiles[0];
  const tool = app.services.registry.get(TOOL);
  const a = Object.assign({}, BG_DEFAULTS, argsOf(app, tile));
  if (a.drift && (!a.motion || a.motion === 'none')) a.motion = 'drift';
  const set = (patch) => app.state.set((x) => ({ args: Object.assign({}, x.args, { [TOOL]: Object.assign({}, argsOf(app, tile), patch, patch.motion ? { drift: false } : {}) }) }));
  const flat = a.style === 'solid';
  const fine = !!(s.bgcFine);

  const controls = h('div', { class: 'bgc-controls' },
    seg('Style', STYLES, a.style, (v) => set({ style: v }), 'bgc-style'),
    seg('Motion', BM.POINT_MOTIONS.map((m) => [m.id, m.label, m.hint]), a.motion, (v) => set({ motion: v }), 'motion', flat),
    seg('Colours', BM.COLOR_MOTIONS.map((m) => [m.id, m.label, m.hint]), a.colorMotion, (v) => set({ colorMotion: v }), 'colorMotion', flat),
    flat ? h('div', { class: 'bgc-hint' }, 'A flat colour has nothing to move — pick Linear, Radial or Mesh to animate it.') : null);

  const actions = h('div', { class: 'bgc-actions' },
    h('button', { class: 'btn sm', 'data-key': 'bgc-colorize', title: 'Colour the selected layers with this palette', onclick: () => app.runTool('design.colorize', Object.assign(defaults(app.services.registry.get('design.colorize').params), { palette: (PAL.resolve(a.palette, a.colors, a.paletteName) || PAL.byId('tomato')).id }), { label: 'Colorize' }).then((r) => r && app.toast(r.summary || r.status, 2600, r.status === 'success' ? 'ok' : 'err')) }, icon('palette', 'sm'), 'Colorize selection'),
    h('button', { class: 'btn ghost sm', 'data-key': 'bgc-client', title: 'Save this palette as a client in Brand', onclick: () => lib.saveAsClient(app, PAL.resolve(a.palette, a.colors, a.paletteName) || PAL.byId('tomato')) }, icon('brand', 'sm'), 'Save as client'),
    h('span', { class: 'spacer' }),
    h('button', { class: `btn ghost sm ${fine ? 'on' : ''}`, 'data-key': 'bgc-fine', 'aria-expanded': String(fine), title: 'Angle, spread, grain, loop, how far it moves', onclick: () => app.state.set({ bgcFine: !fine }) }, icon('sliders', 'sm'), 'Fine-tune'));

  // v0.73 (owner: "the colours are shown badly"): each palette is a still frame of the real background in YOUR look
  // (a designed look ✦ shows its own), with its colours fanned out — paletteCard.js
  const PC = require('../paletteCard');
  const cell = (t) => {
    const pal = PAL.resolve(t.args.palette, t.args.colors, t.args.paletteName);
    const on = t.id === tile.id;
    return PC.card({ key: t.id, cls: 'bgc-pal', label: t.label, args: PC.cardArgs(t, a, fullLook(t)), colors: pal ? pal.colors : [], on, look: fullLook(t),
      title: `${t.label}${fullLook(t) ? ' — a complete look (style + motion)' : ' — swaps the colours, keeps your style and motion'} · double-click: apply now`,
      onclick: () => pick(app, section, t), ondblclick: () => { pick(app, section, t); lib.applyNow(app, t, section, Object.assign({}, argsOf(app, t))); } });
  };

  return h('div', { class: 'view studio-sec bgc' },
    stage(app, a, s.ctx),
    controls,
    actions,
    fine ? h('div', { class: 'bgc-fine', 'data-key': 'bgc-fine-body' }, require('../toolBlock').renderTool(app, tool, { openByDefault: true, bare: true, hide: ['palette', 'style', 'motion', 'colorMotion'], noBody: true })) : null,
    h('div', { class: 'bgc-lib-h' }, h('span', { class: 'bgc-k' }, 'Palettes'), h('span', { class: 'bgc-n' }, String(tiles.length)), h('span', { class: 'spacer' }),
      h('input', { class: 'txt bgc-search', 'data-fk': `st-q-${section.id}`, placeholder: `Search ${all.length}…`, value: st.q || '', 'aria-label': 'Search palettes', oninput: (e) => { lib.setSt(app, section, { q: e.target.value }); } })),
    lib.filterRow(app, section, all, st, mine),
    h('div', { class: 'bgc-grid' }, tiles.map(cell)),
    lib.actionBar(app, section, tile, tool));
}

module.exports = { render, fullLook, nextArgs, STYLES };
