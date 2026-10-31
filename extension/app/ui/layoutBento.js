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

/* v0.25: your own tiles on top (right-click a tile: pin / unpin to NOW), folded sections */
const PIN_KEY = 'bento-pins', FOLD_KEY = 'bento-fold', PIN_MAX = 4;
const pins = (app) => (app.services.store.get(PIN_KEY, []) || []).filter((r) => A.resolve(r)).slice(0, PIN_MAX);
function togglePin(app, ref, label) {
  const cur = app.services.store.get(PIN_KEY, []) || [];
  const on = cur.includes(ref);
  if (!on && cur.length >= PIN_MAX) { app.toast(`NOW holds ${PIN_MAX} pinned tiles — unpin one first (right-click it)`, 4000, 'warn'); return; }
  app.services.store.set(PIN_KEY, on ? cur.filter((r) => r !== ref) : cur.concat([ref]));
  app.toast(on ? `${label} unpinned from NOW` : `${label} pinned to NOW`, 2200, 'ok');
  app.render();
}
const folded = (app, id) => !!(app.services.store.get(FOLD_KEY, {}) || {})[id];
function toggleFold(app, id) { const all = Object.assign({}, app.services.store.get(FOLD_KEY, {}) || {}); all[id] = !all[id]; app.services.store.set(FOLD_KEY, all); app.render(); }

/** An action as a bento tile. size: '2x1' (primary) | '1x1'. Right-click pins it to NOW. */
function tile(app, a, size, t, ref, sub) {
  const rd = a.ready(app);
  const pinned = ref && pins(app).includes(ref);
  return h('button', {
    class: `bt b-${size} ${rd.ok || a.nav ? '' : 'off'} ${pinned ? 'pinned' : ''}`, 'data-key': `a-${a.id}`, 'aria-label': a.label,
    title: `${rd.ok || a.nav ? a.label : `${a.label} — ${rd.hint}`}\nRight-click: ${pinned ? 'unpin from' : 'pin to'} NOW`,
    onclick: () => { if (!rd.ok && !a.nav) app.toast(`${a.label}: ${rd.hint}`, 4500, 'warn'); else { if (t && ref) AE.remember(app, t, ref); a.run(app); } },
    oncontextmenu: (e) => { if (!ref) return; e.preventDefault(); togglePin(app, ref, a.label); }
  }, icon(a.icon || 'bolt', size === '2x1' ? 'lg' : ''), h('span', { class: 'bt-l' }, a.label), sub ? h('span', { class: 'bt-s' }, sub) : null,
  pinned ? h('span', { class: 'bt-pin', 'aria-hidden': 'true' }, icon('star', 'xs')) : null);
}
const wide = (key, ...kids) => h('div', { class: 'bt b-4 bt-block', 'data-key': key }, ...kids);
const caption = (key, text, extra) => h('div', { class: 'b-cap', 'data-key': key }, h('span', {}, text), extra || null);

/** The kit block that leads NOW for this kind of selection (and is then left out of its section). */
const nowBlock = (kind) => (kind === 'keys' ? 'ease' : kind === 'layers' || kind === 'shapesMany' ? 'align' : kind === 'none' ? null : 'anchor');

function now(app, s, kind) {
  const kit = require('./views/kit');
  const c = s.ctx;
  const nb = nowBlock(kind);
  const mineRefs = pins(app);
  const mine = mineRefs.map((r) => [r, A.resolve(r)]).filter(([, a]) => a);
  const acts = (A.SETS[kind] || []).map((r) => [r, A.resolve(r)]).filter(([, a]) => a).slice(0, 8);
  let block = null;
  if (nb && c && c.comp) {
    const prev = kit.K.scope; kit.K.scope = { ctx: '__classic', focus: ['ease', 'anchorAlign', 'anchor', 'align', 'pinned'] };
    try { block = nb === 'ease' ? kit.easeBlock(app) : nb === 'align' ? kit.alignBlock(app) : kit.anchorBlock(app); } finally { kit.K.scope = prev; }
  }
  return h('section', { class: 'b-sec b-now', 'data-key': 'b-now', 'aria-label': 'Now' },
    h('div', { class: 'b-now-h' }, h('span', { class: 'b-kick' }, 'NOW'), h('b', {}, !c ? 'Reading After Effects…' : !c.comp ? 'No active composition' : A.CONTEXT_LABEL[kind]),
      c && c.comp ? h('span', { class: 'b-now-s' }, `${c.comp.name} · ${(c.layers || []).length} layers`) : null),
    h('div', { class: 'b-grid' }, block ? wide('now-block', block) : null,
      // your pinned tiles first (same size as primary), then the best actions for the selection — no duplicates
      mine.map(([r, a]) => tile(app, a, '2x1', null, r, 'pinned')),
      acts.filter(([r]) => !mineRefs.includes(r)).map(([r, a], i) => tile(app, a, i < 2 && !mine.length ? '2x1' : '1x1', null, r))));
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

/* scroll spy: the index chip follows the section you are reading (one listener, rAF-throttled, no host calls) */
let spyApp = null, spyQueued = false;
function spy() {
  spyQueued = false;
  const app = spyApp; if (!app) return;
  const c = document.querySelector('.app.layout-bento .content'); if (!c) return;
  const top = c.getBoundingClientRect().top + 60;
  let cur = null;
  for (const t of AE.TABS) { const el = c.querySelector(`[data-key="bs-${t.id}"]`); if (el && el.getBoundingClientRect().top <= top) cur = t.id; }
  if (cur !== (app.state.get().bIx || null)) app.state.set({ bIx: cur });
}
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('scroll', (e) => { if (!spyQueued && e.target && e.target.classList && e.target.classList.contains('content')) { spyQueued = true; requestAnimationFrame(spy); } }, true);

function build(app, s, body) {
  spyApp = app;
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
      onclick: () => { app.state.set({ bIx: t.id }); if (folded(app, t.id)) toggleFold(app, t.id); setTimeout(() => { const el = document.querySelector(`[data-key="bs-${t.id}"]`); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 0); }
    }, t.label)));
    content = h('div', { class: 'view kit b-page' }, now(app, s, kind), index,
      AE.TABS.map((t) => { const f = folded(app, t.id); return h('section', { class: `b-sec ${f ? 'folded' : ''}`, 'data-key': `bs-${t.id}`, 'aria-label': t.label },
        h('h2', { class: 'b-h' }, h('button', { class: 'b-fold', 'data-key': `fold-${t.id}`, 'aria-expanded': String(!f), title: f ? `Open ${t.label}` : `Fold ${t.label} (shorter page)`, onclick: () => toggleFold(app, t.id) },
          icon('chev', 'xs'), h('span', {}, t.label), t.fits.includes(kind) ? h('span', { class: 'ae-dot', 'aria-hidden': 'true' }) : null),
          f ? h('span', { class: 'b-h-n' }, `${t.groups.length} groups folded`) : null),
        f ? null : h('div', { class: 'b-grid' }, t.groups.map((g) => groupTiles(app, t, g, kind, skip)))); }));
  } else {
    const sec = studio.byId(s.view);
    title = (sec || { label: s.view.charAt(0).toUpperCase() + s.view.slice(1) }).label;
    content = [h('div', { class: 'lay-crumb ae-crumb b-crumb', 'data-key': `crumb-${s.view}` }, h('button', { class: 'btn ghost sm', onclick: () => app.go('home') }, icon('chev', 'xs'), 'MOE'), h('span', { class: 'lay-crumb-sep' }, '›'), h('span', {}, title)), body(s.view)];
  }
  return { top: [require('./quickbar').strip(app), AE.searchBox(app, s)], title, content, overlay: s.aeMenu ? AE.panelMenu(app, s) : null, menuBtn: AE.menuButton(app, s) };
}

module.exports = { build, nowBlock, pins, togglePin, PIN_MAX };
