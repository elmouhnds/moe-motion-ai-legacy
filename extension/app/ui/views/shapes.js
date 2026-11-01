'use strict';
/**
 * Shapes & Icons library: 1,899 Lucide icons (category chips, search, starred, paging) and
 * 21 native AE shapes. The Inspector shows a live preview of the chosen style / colour /
 * animation and hosts the design.insertShape form (validated + verified like every tool).
 */
const { h, icon } = require('../dom');
const { renderTool } = require('../toolBlock');
const { defaults } = require('../../../core/schema');
const LIB = require('../../../features/design/shapesLib');
const SVG = require('../../../features/design/svgShape');
const art = require('../art');

const TOOL = 'design.insertShape';
const PAGE = 96;

function st(app) { return Object.assign({ tab: 'icons', cat: 'all', q: '', limit: PAGE, open: false }, app.state.get().shapesLib); }
/** v0.32: icon / shape columns per panel band, so the inline settings can open under the clicked row. */
function colsFor(band, prim) { const b = band || ''; return /kit-tiny/.test(b) ? (prim ? 2 : 3) : /kit-slim/.test(b) ? (prim ? 3 : 4) : /kit-narrow/.test(b) ? (prim ? 3 : 5) : (prim ? 4 : 6); }
function setSt(app, patch) { app.state.set((s) => ({ shapesLib: Object.assign({}, st(app), patch) })); }

function toolArgs(app) {
  const tool = app.services.registry.get(TOOL);
  return Object.assign(defaults(tool.params), app.state.get().args[TOOL] || {});
}
function setArgs(app, patch) {
  const tool = app.services.registry.get(TOOL);
  app.state.set((s) => ({ args: Object.assign({}, s.args, { [TOOL]: Object.assign(defaults(tool.params), s.args[TOOL] || {}, patch) }), open: Object.assign({}, s.open, { [TOOL]: true }) }));
}

const starred = (app) => app.services.store.get('fav-icons', []);
function toggleStar(app, name) {
  const cur = starred(app);
  app.services.store.set('fav-icons', cur.includes(name) ? cur.filter((x) => x !== name) : [name, ...cur].slice(0, 300));
  app.render();
}

/* ---------- SVG previews ---------- */
function iconSvg(name, cls) {
  const ic = LIB.icon(name);
  return ic ? SVG.nodesToSvg(ic.n, `class="${cls || ''}"`) : '';
}

function polyPoints(n, outer, inner, rot) {
  const pts = [];
  const steps = inner ? n * 2 : n;
  for (let i = 0; i < steps; i++) {
    const r = inner && i % 2 ? inner : outer;
    const a = (-90 + rot + (360 / steps) * i) * Math.PI / 180;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}
/** Primitive preview on a 100×100 box (size = 64). */
function primSvg(p, look) {
  const S = 64, s = p.spec;
  const fill = look.fill || 'none', stroke = look.stroke || 'none', sw = look.sw || 0, fo = look.fillOpacity || 1;
  const paint = `fill="${fill}" fill-opacity="${fo}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"`;
  let body;
  if (p.type === 'rect') { const w = s.w * S, hh = s.h * S, k = Math.min(1, 92 / Math.max(w, hh)); body = `<rect x="${50 - w * k / 2}" y="${50 - hh * k / 2}" width="${w * k}" height="${hh * k}" rx="${s.round * S * k}" ${paint}/>`; }
  else if (p.type === 'ellipse') { const k = Math.min(1, 92 / Math.max(s.w, s.h) / S); body = `<ellipse cx="50" cy="50" rx="${s.w * S * k / 2}" ry="${s.h * S * k / 2}" ${s.outline ? `fill="none" stroke="${look.stroke || look.fill}" stroke-width="${Math.max(sw, 4)}"` : paint}/>`; }
  else body = `<polygon points="${polyPoints(s.points, s.outer * S * 1.4, p.type === 'star' ? s.inner * S * 1.4 : 0, s.rotation || 0)}" ${paint}/>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`;
}

function lookOf(args, isIcon, size = 24) {
  const k = size / Math.max(args.size, 1);
  const sw = args.strokeWidth > 0 ? args.strokeWidth * k : (isIcon ? 2 : 3);
  switch (args.style) {
    case 'fill': return isIcon ? { stroke: args.color, fill: args.color, sw } : { fill: args.color, stroke: 'none', sw: 0 };
    case 'both': return { stroke: args.color, fill: args.color2, sw };
    case 'duotone': return { stroke: args.color, fill: args.color2, fillOpacity: 0.35, sw };
    default: return { stroke: args.color, fill: 'none', sw };
  }
}

function stylePreview(args, isIcon) {
  const anim = args.animate !== 'none' ? `anim-${args.animate}` : '';
  if (isIcon) {
    const ic = LIB.icon(args.icon);
    if (!ic) return h('div', { class: 'sh-preview' });
    const L = lookOf(args, true);
    const svg = SVG.nodesToSvg(ic.n.map(([t, a]) => [t, Object.assign({ pathLength: '1' }, a)]), `class="${anim}" style="--dur:${args.duration}s" stroke="${L.stroke}" fill="${L.fill}" fill-opacity="${L.fillOpacity || 1}" stroke-width="${L.sw.toFixed(2)}"`)
      .replace(' fill="none" stroke="currentColor" stroke-width="2"', '');
    return h('div', { class: 'sh-preview', html: svg });
  }
  const p = LIB.primitive(args.primitive);
  const L = lookOf(args, false, 100);
  return h('div', { class: `sh-preview ${anim}`, style: { '--dur': `${args.duration}s` }, html: p ? primSvg(p, { fill: L.fill, stroke: L.stroke, sw: L.sw * 1.4, fillOpacity: L.fillOpacity }) : '' });
}

/* ---------- view ---------- */
function render(app) {
  const s = app.state.get();
  const S = st(app);
  const tool = app.services.registry.get(TOOL);
  const args = toolArgs(app);
  const stars = starred(app);
  const wide = s.studioWide;

  const tabs = h('div', { class: 'st-tabs', role: 'tablist' },
    [['icons', `Icons · ${LIB.count().toLocaleString('en-US')}`], ['shapes', `Shapes · ${LIB.PRIMITIVES.length}`], ['all', 'All tools']].map(([id, label]) => h('button', { role: 'tab', 'aria-selected': String(S.tab === id), onclick: () => { setSt(app, { tab: id }); if (id === 'icons' && args.source !== 'icon') setArgs(app, { source: 'icon', style: 'line' }); if (id === 'shapes' && args.source !== 'primitive') setArgs(app, { source: 'primitive', style: 'fill', animate: args.animate === 'draw' ? 'pop' : args.animate }); } }, label)),
    h('span', { class: 'spacer' }),
    S.tab === 'icons' ? h('input', { class: 'txt st-search', 'data-fk': 'sh-q', placeholder: 'Search icons (name or tag)…', value: S.q, 'aria-label': 'Search icons', oninput: (e) => { S.q = e.target.value; }, onchange: (e) => setSt(app, { q: e.target.value, limit: PAGE }) }) : null);

  if (S.tab === 'all') return h('div', { class: 'view studio-sec' }, tabs, renderTool(app, tool, { openByDefault: true }));

  const isIcon = args.source !== 'primitive';
  const name = isIcon ? args.icon : args.primitive;
  const meta = isIcon ? LIB.icon(name) : LIB.primitive(name);
  const inline = !wide && S.open;
  const inspector = h('aside', { class: `st-inspector ${inline ? 'inline' : ''}`, 'aria-label': 'Inspector', 'data-key': 'sh-ins' },
    h('div', { class: 'st-ins-h' }, h('span', { class: 'st-kicker' }, isIcon ? 'ICON' : 'NATIVE SHAPE'), h('span', { class: 'spacer' }),
      isIcon ? h('button', { class: 'icon-btn pin', 'aria-pressed': String(stars.includes(name)), title: stars.includes(name) ? 'Unstar icon' : 'Star icon', onclick: () => toggleStar(app, name) }, icon('star', 'sm')) : null,
      isIcon ? h('button', { class: 'icon-btn', title: 'Copy SVG', onclick: () => copyText(app, iconSvg(name), 'SVG copied') }, icon('copy', 'sm')) : null,
      inline ? h('button', { class: 'icon-btn', 'data-key': 'sh-ins-close', title: 'Close the settings', 'aria-label': 'Close settings', onclick: () => setSt(app, { open: false }) }, icon('x', 'sm')) : null),
    stylePreview(args, isIcon),
    h('div', { class: 'st-ins-title' }, isIcon ? LIB.pretty(name) : (meta ? meta.label : name)),
    isIcon && meta ? h('div', { class: 'sh-tags' }, meta.t.slice(0, 8).map((t) => h('button', { class: 'tag', onclick: () => setSt(app, { q: t, cat: 'all', limit: PAGE }) }, t))) : h('div', { class: 'why st-ins-desc' }, 'Rectangle / Ellipse / Polystar — size, roundness, points and radii stay editable in After Effects.'),
    h('div', { class: 'st-ins-tool' }, renderTool(app, tool, { openByDefault: true })));

  // v0.32: settings beside the grid from 600 px; narrower, under the row of the icon / shape you click
  const place = (cells, list, sel, c) => { if (!inline) return cells; const i = list.indexOf(sel); if (i < 0) return cells; const out = cells.slice(); out.splice(Math.min(list.length, (Math.floor(i / c) + 1) * c), 0, inspector); return out; };
  const pick = (patch, same) => { if (same) setSt(app, { open: !S.open }); else { setArgs(app, patch); setSt(app, { open: true }); } };
  let grid, chips = null, more = null;
  if (S.tab === 'icons') {
    const cats = LIB.categories();
    chips = h('div', { class: 'st-chips one-line' },
      h('button', { class: 'chip-btn', 'aria-pressed': String(S.cat === 'all'), onclick: () => setSt(app, { cat: 'all', limit: PAGE }) }, 'All'),
      h('button', { class: 'chip-btn', 'aria-pressed': String(S.cat === 'starred'), onclick: () => setSt(app, { cat: 'starred', limit: PAGE }) }, icon('star', 'xs'), ` Starred ${stars.length || ''}`),
      cats.map((c) => h('button', { class: 'chip-btn', 'aria-pressed': String(S.cat === c.id), onclick: () => setSt(app, { cat: c.id, limit: PAGE }) }, c.label, h('span', { class: 'chip-n' }, c.count))));
    const names = S.cat === 'starred' ? stars.filter((n) => !S.q || n.includes(S.q.toLowerCase())) : LIB.search(S.q, S.cat);
    const shown = names.slice(0, S.limit);
    const ci = colsFor(s.kitBand, false);
    grid = shown.length ? h('div', { class: 'sh-grid fit', style: wide ? null : { '--c': String(ci) } }, place(shown.map((name) => h('button', {
      class: `sh-tile ${args.source === 'icon' && args.icon === name ? 'on' : ''}`, 'data-key': name, title: `${LIB.pretty(name)} — double-click to insert`,
      'aria-pressed': String(args.icon === name),
      onclick: () => pick({ source: 'icon', icon: name }, args.source === 'icon' && args.icon === name),
      ondblclick: () => { setArgs(app, { source: 'icon', icon: name }); app.runTool(TOOL, Object.assign(toolArgs(app), { source: 'icon', icon: name })).then((r) => r && app.toast(r.summary || r.status)); }
    }, h('span', { class: 'sh-ic', html: iconSvg(name) }), stars.includes(name) ? h('span', { class: 'sh-star' }, icon('star', 'xs')) : null)), shown, isIcon ? args.icon : null, ci))
      : h('div', { class: 'empty' }, h('div', { html: art.empty('search') }), h('b', {}, 'No icons match'), h('br'), 'Try another word — tags like "money", "weather" or "arrow" work too.');
    if (names.length > shown.length) more = h('div', { class: 'sh-more' }, h('button', { class: 'btn', onclick: () => setSt(app, { limit: S.limit + PAGE * 2 }) }, `Show more (${(names.length - shown.length).toLocaleString('en-US')} left)`));
    else if (names.length) more = h('div', { class: 'sh-more why' }, `${names.length.toLocaleString('en-US')} icon${names.length === 1 ? '' : 's'}`);
  } else {
    const look = lookOf(Object.assign({}, args, { style: args.style === 'line' ? 'line' : args.style }), false, 100);
    const groups = [...new Set(LIB.PRIMITIVES.flatMap((p) => p.tags))];
    grid = h('div', {}, groups.map((g) => h('div', {},
      h('div', { class: 'sh-group' }, g),
      (() => { const list = LIB.PRIMITIVES.filter((p) => p.tags[0] === g); const cp = colsFor(s.kitBand, true); return h('div', { class: 'sh-grid prim fit', style: wide ? null : { '--c': String(cp) } }, place(list.map((p) => h('button', {
        class: `sh-tile prim ${args.source === 'primitive' && args.primitive === p.id ? 'on' : ''}`, 'data-key': p.id, title: `${p.label} — native AE shape (stays editable). Double-click to insert`,
        onclick: () => pick({ source: 'primitive', primitive: p.id }, args.source === 'primitive' && args.primitive === p.id),
        ondblclick: () => { setArgs(app, { source: 'primitive', primitive: p.id }); app.runTool(TOOL, Object.assign(toolArgs(app), { source: 'primitive', primitive: p.id })).then((r) => r && app.toast(r.summary || r.status)); }
      }, h('span', { class: 'sh-ic', html: primSvg(p, { fill: look.fill === 'none' ? 'none' : 'currentColor', stroke: 'currentColor', sw: look.fill === 'none' ? 4 : 0 }) }), h('span', { class: 'sh-name' }, p.label))), list.map((p) => p.id), isIcon ? null : args.primitive, cp)); })())));
  }

  return h('div', { class: 'view studio-sec shapes' }, tabs, chips,
    h('div', { class: `st-body ${wide ? 'wide' : ''}` }, h('div', { class: 'st-main' }, grid, more,
      wide || inline ? null : h('div', { class: 'st-hint' }, S.tab === 'icons' ? 'Click an icon for its style and Insert · double-click inserts it now' : 'Click a shape for its style and Insert · double-click inserts it now')), wide ? inspector : null));
}

function copyText(app, text, done) {
  const ok = () => app.toast(done);
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(ok, () => fallback()); return; }
  } catch (e) { /* fall back */ }
  fallback();
  function fallback() {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } }, text);
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); ok(); } catch (e) { app.toast('Copy not available here'); }
    ta.remove();
  }
}

module.exports = { colsFor, render, primSvg, lookOf };
