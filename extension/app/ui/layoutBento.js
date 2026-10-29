'use strict';
/**
 * Style proposal v0.24 — "Bento" (MOE's own proposal, docs/features/STYLE_PROPOSALS.md).
 *
 * Look: near-black canvas, bento tiles of different sizes with soft gradient rims; the accent glows
 * only on what matters most; display type for section titles.
 * Organisation, rethought around importance — no tabs at all, one scroll:
 *   NOW      the big tool for the selection (ease graph for keys, align / anchor for layers) + the
 *            eight best actions: two wide primary tiles, six square ones
 *   index    Keys · Animate · Layer · Design · Effect · Comp — chips that jump down the page
 *   sections each Classic group as bento: primary 2×1 · standard 1×1 · rare as a strip of chips ·
 *            presets as a sideways shelf · blocks full width
 * Size = importance, everywhere. Same tools, tiers and Recent memory as Classic.
 */
const { h, icon } = require('./dom');
const A = require('./actions');
const AE = require('./layoutAE');
const studio = require('./studio/sections');

/** An action as a bento tile. size: '2x1' (primary) | '1x1'. */
function tile(app, a, size, t, ref, sub) {
  const rd = a.ready(app);
  return h('button', {
    class: `bt b-${size} ${rd.ok || a.nav ? '' : 'off'}`, 'data-key': `a-${a.id}`, 'aria-label': a.label, title: rd.ok || a.nav ? a.label : `${a.label} — ${rd.hint}`,
    onclick: () => { if (!rd.ok && !a.nav) app.toast(`${a.label}: ${rd.hint}`, 4500, 'warn'); else { if (t && ref) AE.remember(app, t, ref); a.run(app); } }
  }, icon(a.icon || 'bolt', size === '2x1' ? 'lg' : ''), h('span', { class: 'bt-l' }, a.label), sub ? h('span', { class: 'bt-s' }, sub) : null);
}
const wide = (key, ...kids) => h('div', { class: 'bt b-4 bt-block', 'data-key': key }, ...kids);
const caption = (key, text, extra) => h('div', { class: 'b-cap', 'data-key': key }, h('span', {}, text), extra || null);

/** The kit block that leads NOW for this kind of selection (and is then left out of its section). */
const nowBlock = (kind) => (kind === 'keys' ? 'ease' : kind === 'layers' || kind === 'shapesMany' ? 'align' : kind === 'none' ? null : 'anchor');

function now(app, s, kind) {
  const kit = require('./views/kit');
  const c = s.ctx;
  const nb = nowBlock(kind);
  const acts = (A.SETS[kind] || []).map((r) => [r, A.resolve(r)]).filter(([, a]) => a).slice(0, 8);
  let block = null;
  if (nb && c && c.comp) {
    const prev = kit.K.scope; kit.K.scope = { ctx: '__classic', focus: ['ease', 'anchorAlign', 'anchor', 'align', 'pinned'] };
    try { block = nb === 'ease' ? kit.easeBlock(app) : nb === 'align' ? kit.alignBlock(app) : kit.anchorBlock(app); } finally { kit.K.scope = prev; }
  }
  return h('section', { class: 'b-sec b-now', 'data-key': 'b-now', 'aria-label': 'Now' },
    h('div', { class: 'b-now-h' }, h('span', { class: 'b-kick' }, 'NOW'), h('b', {}, !c ? 'Reading After Effects…' : !c.comp ? 'No active composition' : A.CONTEXT_LABEL[kind]),
      c && c.comp ? h('span', { class: 'b-now-s' }, `${c.comp.name} · ${(c.layers || []).length} layers`) : null),
    h('div', { class: 'b-grid' }, block ? wide('now-block', block) : null, acts.map(([r, a], i) => tile(app, a, i < 2 ? '2x1' : '1x1', null, r))));
}

function groupTiles(app, t, g, kind, skipBlock) {
  if (g.kind === 'kit' && g.block === skipBlock) return [];
  const cap = caption(`cap-${g.id}`, g.label, g.more ? AE.moreLink(app, g) : g.fits.includes(kind) ? h('span', { class: 'ae-fit' }, 'for selection') : null);
  if (g.kind === 'acts') {
    const hero = g.hero || [], minor = g.minor || [];
    const pick = (refs) => refs.map((r) => [r, A.resolve(r)]).filter(([, a]) => a);
    const minorTiles = pick(minor);
    return [cap,
      ...pick(hero).map(([r, a]) => tile(app, a, '2x1', t, r)),
      ...pick(g.refs.filter((r) => !hero.includes(r) && !minor.includes(r))).map(([r, a]) => tile(app, a, '1x1', t, r)),
      minorTiles.length ? h('div', { class: 'b-4 b-chips', 'data-key': `minor-${g.id}` }, minorTiles.map(([r, a]) => AE.actButton(app, a, () => AE.remember(app, t, r), 's'))) : null,
      ...(g.links || []).map(([id, label]) => h('button', { class: 'bt b-2x1 bt-link', 'data-key': `l-${id}`, 'aria-label': label, onclick: () => app.go(id) }, icon('chev', ''), h('span', { class: 'bt-l' }, label)))];
  }
  if (g.kind === 'links') return [cap, ...(g.links || []).map(([id, label]) => { const sec = studio.byId(id); return h('button', { class: 'bt b-2x1 bt-link', 'data-key': `l-${id}`, 'aria-label': `Open ${sec ? sec.label : label}`, onclick: () => app.go(id) }, icon((sec && sec.icon) || 'chev', 'lg'), h('span', { class: 'bt-l' }, sec ? sec.label : label), h('span', { class: 'bt-s' }, label)); })];
  return [cap, wide(`w-${g.id}`, AE.groupBody(app, g, t))];
}

function build(app, s, body) {
  const kind = A.profile(s.ctx);
  const q = (s.aeQ || '').trim();
  let content, title;
  if (q) { content = h('div', { class: 'view ae-page b-page' }, AE.searchResults(app, q)); title = 'Search'; }
  else if (s.view === 'home' || AE.TAB_IDS.includes(s.view)) {
    title = 'MOE Motion';
    const skip = nowBlock(kind);
    const index = h('nav', { class: 'b-index', 'aria-label': 'Jump to' }, AE.TABS.map((t) => h('button', {
      class: `b-ix ${t.fits.includes(kind) ? 'fit' : ''} ${s.bIx === t.id ? 'on' : ''}`, 'data-key': `ix-${t.id}`, title: t.title, 'aria-pressed': String(s.bIx === t.id),
      // jump to the section and mark the chip, so you see where you are
      onclick: () => { app.state.set({ bIx: t.id }); const el = document.querySelector(`[data-key="bs-${t.id}"]`); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    }, t.label)));
    content = h('div', { class: 'view kit b-page' }, now(app, s, kind), index,
      AE.TABS.map((t) => h('section', { class: 'b-sec', 'data-key': `bs-${t.id}`, 'aria-label': t.label },
        h('h2', { class: 'b-h' }, t.label, t.fits.includes(kind) ? h('span', { class: 'ae-dot', 'aria-hidden': 'true' }) : null),
        h('div', { class: 'b-grid' }, t.groups.map((g) => groupTiles(app, t, g, kind, skip))))));
  } else {
    const sec = studio.byId(s.view);
    title = (sec || { label: s.view.charAt(0).toUpperCase() + s.view.slice(1) }).label;
    content = [h('div', { class: 'lay-crumb ae-crumb b-crumb', 'data-key': `crumb-${s.view}` }, h('button', { class: 'btn ghost sm', onclick: () => app.go('home') }, icon('chev', 'xs'), 'MOE'), h('span', { class: 'lay-crumb-sep' }, '›'), h('span', {}, title)), body(s.view)];
  }
  return { top: [require('./quickbar').strip(app), AE.searchBox(app, s)], title, content, overlay: s.aeMenu ? AE.panelMenu(app, s) : null, menuBtn: AE.menuButton(app, s) };
}

module.exports = { build, nowBlock };
