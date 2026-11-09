'use strict';
/**
 * Control's pages (v0.72, docs/features/CONTROL_STYLE.md) — owner: "only one page? no more pages?"
 *
 * Move (the squares + the Mix, layoutControl.js) is joined by four pages, each made of the plugin's own tiles:
 *   Text     the text library's presets (In / Out, played on your own text), Typewriter, Counter
 *   Design   a background square that plays the picked palette, the palettes as colour strips, the templates
 *   Look     Styles, Glass (clear + thick), Zoom & Focus
 *   Deliver  composition guides and the social safe zones, with links to Deliver and Layout & Grid
 * A square here is a library tile (the same `tool` + `args` the library applies): click picks it (the hero plays it,
 * the bar under the page says what it will do — the tool's own card), double-click applies it now, right-click
 * opens its library page. Apply goes through `library.applyNow` → readiness → `app.runTool`, like everywhere else.
 */
const { h, icon } = require('./dom');
const studio = require('./studio/sections');

const PAGES = [
  { id: 'move', label: 'Move', icon: 'motion', hint: 'Motion, timing and wiggle — the squares and the Mix' },
  { id: 'text', label: 'Text', icon: 'type', hint: 'Text animations played on your own words, Typewriter, Counter' },
  { id: 'design', label: 'Design', icon: 'palette', hint: 'Backgrounds, palettes and templates' },
  { id: 'look', label: 'Look', icon: 'sparkles', hint: 'Styles, glass, zoom and focus' },
  { id: 'deliver', label: 'Deliver', icon: 'gTiktok', hint: 'Guides, safe zones and export' }
];
const PAGE_KEY = 'cc-page';
const pageOf = (app) => { const p = app.services.store.get(PAGE_KEY, 'move'); return PAGES.some((x) => x.id === p) ? p : 'move'; };
/** Which page fits the selection (a dot on its tab — the page never switches by itself). */
const fitsPage = (kind) => (kind === 'text' ? 'text' : kind === 'none' ? 'design' : 'move');

const lib = () => require('./studio/library');
const tileOf = (secId, id) => { const sec = studio.byId(secId); return sec && (sec.tiles || []).find((t) => t.id === id); };
const tilesOf = (secId, filter) => { const sec = studio.byId(secId); return sec ? (sec.tiles || []).filter(filter || (() => true)) : []; };
const hasArabic = (t) => /[؀-ۿ]/.test(t || '');

/* ---------- items: one shape for every square on these pages ---------- */
/** A library tile as a page item. */
const tileItem = (secId, t) => ({ key: `${secId}/${t.id}`, label: t.label, section: studio.byId(secId), tile: t, page: secId });
/** A text preset as a page item (applied by text.animate, like the Text page). */
const textItem = (p) => ({ key: `text/${p.id}`, label: p.name, section: null, page: 'text', preset: p,
  tile: { id: `tp-${p.id}`, label: p.name, tool: 'text.animate', args: { presetId: p.id, duration: p.duration || 1 } } });
/** A Quick Bar tool as a page item. */
function quickItem(id) {
  const a = require('./quickbar').ACTIONS.find((x) => x.id === id);
  return a ? { key: `quick/${id}`, label: a.label.replace(/\s*\(.*\)\s*$/, ''), section: null, page: 'text', icon: a.icon, tile: { id: `q-${id}`, label: a.label.replace(/\s*\(.*\)\s*$/, ''), tool: a.tool, args: a.args || {} } } : null;
}

/** The items each page shows, in groups (pure enough to test: it reads only the library and the text presets). */
function groupsFor(app, page, s) {
  return rawGroups(app, page, s).map((g) => (g.items ? Object.assign({}, g, { items: g.items.filter((it) => oneClick(app, it)) }) : g));
}
/** A square is one click only when its tile needs no setup (a layer to pick, a file): those stay on their library page (All ›). */
function oneClick(app, it) {
  if (it.tile.needsInput) return false;
  const tool = app.services.registry.get(it.tile.tool);
  if (!tool) return false;
  const S = require('../../core/schema');
  return S.validateArgs(tool.params || {}, Object.assign(S.defaults(tool.params || {}), it.tile.args || {})).ok;
}
function rawGroups(app, page, s) {
  if (page === 'text') {
    const kind = (s.ccText && s.ccText.kind) || 'in';
    const presets = (app.services.textLibrary ? app.services.textLibrary.all() : []).filter((p) => !p.previewOnly && p.kind === kind);
    return [
      { id: 'tx', label: kind === 'in' ? 'Text in' : 'Text out', switcher: 'text', items: presets.slice(0, 12).map(textItem), more: 'text' },
      { id: 'tx-add', label: 'Add', items: ['typewriter', 'counter'].map(quickItem).filter(Boolean), small: true }
    ];
  }
  if (page === 'design') {
    return [
      { id: 'bg', label: 'Background', items: tilesOf('backgrounds').slice(0, 14).map((t) => tileItem('backgrounds', t)), strips: true, more: 'backgrounds' },
      { id: 'tpl', label: 'Templates', items: tilesOf('templates').map((t) => tileItem('templates', t)), more: 'templates' },
      { id: 'mk', label: 'Make', links: [['shapes', 'Shapes & Icons'], ['productui', 'Product UI'], ['brand', 'Brand']] }
    ];
  }
  if (page === 'look') {
    return [
      { id: 'st', label: 'Styles', items: tilesOf('looks', (t) => t.tool === 'design.style').map((t) => tileItem('looks', t)), more: 'looks' },
      { id: 'gl', label: 'Glass', items: tilesOf('looks', (t) => t.tool !== 'design.style').map((t) => tileItem('looks', t)), more: 'looks' },
      { id: 'zm', label: 'Zoom & Focus', items: tilesOf('zoom').map((t) => tileItem('zoom', t)), more: 'zoom' },
      { id: 'lk', label: 'Finish', links: [['compositing', 'Compositing'], ['expressions', 'Expressions']] }
    ];
  }
  if (page === 'deliver') {
    const ids = ['gpCenter', 'thirds', 'gpGolden', 'g12', 'gpTv', 'safe', 'gpClear'];
    const social = ['gpTiktok', 'gpReels', 'gpShorts', 'gpStories'];
    const pick = (list) => list.map((id) => tileOf('layout', id)).filter(Boolean).map((t) => tileItem('layout', t));
    return [
      { id: 'so', label: 'Social safe zones', items: pick(social), more: 'layout' },
      { id: 'gd', label: 'Composition guides', items: pick(ids), more: 'layout' },
      { id: 'ex', label: 'Export & layout', links: [['deliver', 'Deliver'], ['layout', 'Layout & Grid']] }
    ];
  }
  return [];
}

/** Every item on a page (for the picked one and tests). */
const itemsOf = (app, page, s) => groupsFor(app, page, s).reduce((all, g) => all.concat(g.items || []), []);

/** The item picked on a page (or the first one). */
function pickedOf(app, page, s) {
  const items = itemsOf(app, page, s);
  const key = ((s.ccPick || {})[page]) || null;
  return items.find((x) => x.key === key) || items[0] || null;
}
const pick = (app, page, it) => app.state.set((x) => ({ ccPick: Object.assign({}, x.ccPick, { [page]: it.key }) }));
const apply = (app, it) => lib().applyNow(app, it.tile, it.section);

/* ---------- squares ---------- */
/** Your own text (the first selected text layer), short enough for a square: whole words up to ~12 letters. */
function sampleText(s) {
  const t = ((s.ctx && s.ctx.layers) || []).find((l) => l.type === 'text' && l.text);
  const line = t ? String(t.text).split(/\r|\n/)[0].trim() : 'Motion';
  const max = 12;
  let out = '';
  for (const w of line.split(/\s+/)) { if (out && (out + ' ' + w).length > max) break; out = out ? `${out} ${w}` : w; }
  return out.slice(0, max + 6) || 'Motion';
}
/** The preview an item plays: the library's own thumb, a text preset on your text, or a Quick tool's icon. */
function thumbOf(app, it, s, big) {
  if (it.preset) return require('./textPreview').previewCanvas(it.preset, sampleText(s));
  if (it.icon && !it.tile.thumb) return h('div', { class: 'st-thumb icon' }, icon(it.icon, big ? 'lg' : ''));
  const L = lib();
  return L.thumbEl(L.tileThumb(app, it.tile), big ? 'big' : '');
}
function itemSquare(app, s, page, it, on, o) {
  const latinOnly = it.preset && !it.preset.arabicSafe && ((s.ctx && s.ctx.layers) || []).some((l) => hasArabic(l.text));
  return h('button', {
    class: `cc-sq cc-item ${on ? 'on' : ''} ${o && o.small ? 'small' : ''}`, 'data-key': `cc-i-${it.key}`, 'aria-pressed': String(on),
    title: `${it.label}${latinOnly ? ' — letter by letter: Arabic letters would come apart (pick an ع preset)' : ''}\nClick: pick · double-click: apply now${it.page && studio.byId(it.page) ? ' · right-click: its library' : ''}`,
    onclick: () => pick(app, page, it), ondblclick: (e) => { e.preventDefault(); pick(app, page, it); apply(app, it); },
    oncontextmenu: it.page && studio.byId(it.page) ? (e) => { e.preventDefault(); app.go(it.page); } : undefined
  }, h('span', { class: 'cc-item-thumb' }, thumbOf(app, it, s)), h('span', { class: 'cc-item-name' }, it.label),
  it.preset && it.preset.arabicSafe ? h('span', { class: 'cc-item-badge', title: 'By words / lines — keeps Arabic letters joined' }, 'ع') : null,
  latinOnly ? h('span', { class: 'cc-item-badge warn', title: 'Letter by letter — not for Arabic' }, 'Aa') : null);
}
function stripSquare(app, s, page, it, on) {
  const PAL = require('../../features/design/palettes');
  const a = it.tile.args || {};
  const pal = PAL.resolve(a.palette, a.colors, a.paletteName);
  return h('button', { class: `cc-strip ${on ? 'on' : ''}`, 'data-key': `cc-i-${it.key}`, 'aria-pressed': String(on), title: `${it.label}\nClick: pick · double-click: apply now · right-click: Backgrounds`,
    onclick: () => pick(app, page, it), ondblclick: (e) => { e.preventDefault(); pick(app, page, it); apply(app, it); }, oncontextmenu: (e) => { e.preventDefault(); app.go('backgrounds'); } },
  h('span', { class: 'cc-strip-bars', 'aria-hidden': 'true' }, (pal ? pal.colors : []).map((hex) => h('i', { style: { background: hex } }))), h('span', { class: 'cc-strip-name' }, it.label));
}
function linkSquare(app, id, label) {
  const sec = studio.byId(id);
  return h('button', { class: 'cc-sq cc-link', 'data-key': `cc-ln-${id}`, title: `Open ${label}`, onclick: () => app.go(id) }, icon(sec ? sec.icon : 'chev', ''), h('span', {}, label), icon('chev', 'xs cc-link-chev'));
}

/** The hero: the picked item, big, with its name. */
function hero(app, s, page, it) {
  if (!it) return null;
  return h('div', { class: 'cc-sq cc-hero cc-page-hero', 'data-key': `cc-ph-${page}` },
    h('button', { class: 'cc-hero-hit', 'data-key': `cc-ph-hit-${page}`, title: `${it.label}\nDouble-click: apply now`, ondblclick: (e) => { e.preventDefault(); apply(app, it); } },
      h('span', { class: 'cc-hero-art' }, thumbOf(app, it, s, true)),
      h('span', { class: 'cc-hero-cap' }, h('span', { class: 'cc-hero-name' }, it.label), h('span', { class: 'cc-hero-sub' }, it.section ? it.section.label : page === 'text' ? (it.preset ? `${it.preset.kind === 'out' ? 'Out' : 'In'} · ${it.preset.duration || 1} s${it.preset.arabicSafe ? ' · Arabic-safe' : ''}` : 'Text') : ''))));
}

/** A page's content: the hero, then its groups. */
function render(app, s, page) {
  const it = pickedOf(app, page, s);
  const groups = groupsFor(app, page, s);
  return [hero(app, s, page, it), groups.map((g) => h('section', { class: 'cc-group', 'data-key': `cc-g-${g.id}`, 'aria-label': g.label },
    h('div', { class: 'cc-cap cc-cap-row' }, h('span', {}, g.label),
      g.switcher === 'text' ? h('div', { class: 'cc-seg cc-seg-mini', role: 'radiogroup', 'aria-label': 'In or out' }, [['in', 'In'], ['out', 'Out']].map(([id, l]) => h('button', { class: 'cc-segb', role: 'radio', 'data-key': `cc-tk-${id}`, 'aria-checked': String(((s.ccText && s.ccText.kind) || 'in') === id), onclick: () => app.state.set({ ccText: { kind: id } }) }, l))) : null,
      g.more ? h('button', { class: 'cc-more', 'data-key': `cc-more-${g.id}`, title: `All in ${(studio.byId(g.more) || {}).label || g.more}`, onclick: () => app.go(g.more) }, 'All', icon('chev', 'xs')) : null),
    g.links ? h('div', { class: 'cc-links' }, g.links.map(([id, label]) => linkSquare(app, id, label)))
      : g.strips ? h('div', { class: 'cc-strips' }, g.items.map((x) => stripSquare(app, s, page, x, it && it.key === x.key)))
        : h('div', { class: `cc-items ${g.small ? 'small' : ''}` }, g.items.map((x) => itemSquare(app, s, page, x, it && it.key === x.key, g)))))];
}

/** The bar under a page: what the picked item will do (its tool's card), and Apply. */
function pickBar(app, s, page) {
  const it = pickedOf(app, page, s);
  if (!it) return null;
  const L = lib();
  const tool = app.services.registry.get(it.tile.tool);
  const args = Object.assign(require('../../core/schema').defaults((tool && tool.params) || {}), it.tile.args || {});
  const rd = L.readiness(app, it.tile, args);
  let line = rd.ok ? null : rd.hint;
  if (!line && tool && s.ctx) {
    try { const c = require('../../core/toolcard').card(tool, args, s.ctx, app.services); line = (c.warnings && c.warnings[0]) || (c.target ? `on ${c.target}` : null) || c.purpose || null; } catch (e) { line = null; }
  }
  // a description may be shortened (its full text is the tooltip) — never a name (NO_CUT_NAMES)
  const full = line;
  if (line && line.length > 90) line = `${line.slice(0, 88).replace(/\s+\S*$/, '')}…`;
  return h('div', { class: `cc-mix cc-pick ${rd.ok ? '' : 'blocked'}`, 'data-key': `cc-pick-${page}`, role: 'region', 'aria-label': 'Picked' },
    h('div', { class: 'cc-mix-row' },
      h('span', { class: 'cc-mix-dot', 'aria-hidden': 'true' }),
      h('span', { class: 'cc-mix-t', title: full || '' }, h('b', {}, it.label), line ? ` · ${line}` : ''),
      h('button', { class: 'btn primary cc-apply', 'data-key': 'cc-pick-apply', disabled: !!(!rd.ok || s.running), title: rd.ok ? `Apply ${it.label}` : rd.hint, onclick: () => apply(app, it) }, icon('play', 'sm'), 'Apply')));
}

/** The page tabs under the head. */
function tabs(app, s, kind) {
  const cur = pageOf(app);
  const fit = fitsPage(kind);
  return h('nav', { class: 'cc-pages', 'data-key': 'cc-pages', role: 'tablist', 'aria-label': 'Control pages' }, PAGES.map((p, i) => h('button', {
    class: `cc-tab ${cur === p.id ? 'on' : ''}`, role: 'tab', 'data-key': `cc-tab-${p.id}`, 'aria-selected': String(cur === p.id),
    title: `${p.hint}${fit === p.id && cur !== p.id ? ' — fits what you selected' : ''} · Ctrl+${i + 1}`,
    onclick: () => { app.services.store.set(PAGE_KEY, p.id); app.render(); }
  }, icon(p.icon, 'sm'), h('span', {}, p.label), fit === p.id && cur !== p.id ? h('span', { class: 'ae-dot', 'aria-hidden': 'true' }) : null)));
}

module.exports = { PAGES, PAGE_KEY, pageOf, fitsPage, groupsFor, itemsOf, pickedOf, render, pickBar, tabs };
