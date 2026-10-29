'use strict';
/**
 * Style proposal v0.24 — "Apple" (docs/features/STYLE_PROPOSALS.md).
 *
 * Look: macOS / iOS Settings — large titles, inset grouped lists (rounded cards of rows divided by
 * hairlines), coloured squircle icons, tinted primary buttons, preset shelves that scroll sideways.
 * Organisation, rethought as a navigation stack instead of tabs:
 *   MOE Motion (root)  · For your selection (the five best actions) · Tools (six categories ›) · General
 *   ‹ MOE  Keys        · each group is a card: primary buttons on top, rows, presets as a shelf
 * Same tools, tiers and Recent memory as Classic; nothing on the root moves when the selection changes
 * except the "For your selection" card.
 */
const { h, icon } = require('./dom');
const A = require('./actions');
const AE = require('./layoutAE');
const studio = require('./studio/sections');

// iOS Settings-like colour per category (white glyph on a coloured squircle)
const CAT = {
  'ae-keys': { color: '#ff9f0a', icon: 'ease' },
  'ae-animate': { color: '#ff375f', icon: 'motion' },
  'ae-layer': { color: '#0a84ff', icon: 'layers' },
  'ae-design': { color: '#bf5af2', icon: 'palette' },
  'ae-effect': { color: '#30b158', icon: 'sparkles' },
  'ae-comp': { color: '#5e5ce6', icon: 'layout' }
};
const ID = (t) => `ap-${t.id}`;
const CAT_IDS = AE.TABS.map(ID);
const tabOfView = (view) => AE.TABS.find((t) => ID(t) === view) || null;

function row(o) {
  return h('button', { class: `ap-row ${o.off ? 'off' : ''} ${o.strong ? 'strong' : ''}`, 'data-key': o.key, title: o.title || o.label, 'aria-label': o.label, onclick: o.onclick },
    h('span', { class: 'ap-sq', style: { background: o.color } }, icon(o.icon || 'bolt', 'sm')),
    h('span', { class: 'ap-row-t' }, h('span', { class: 'ap-row-l' }, o.label), o.sub ? h('span', { class: 'ap-row-s' }, o.sub) : null),
    o.trail === 'chev' ? icon('chev', 'xs ap-chev') : o.trail ? h('span', { class: 'ap-trail' }, o.trail) : null);
}
/** One action as a row (runs on click, remembered in Recent for its tab). */
function actRow(app, a, t, ref, color, strong) {
  const rd = a.ready(app);
  return row({ key: `a-${a.id}`, icon: a.icon, color: rd.ok || a.nav ? color : '#8e8e93', label: a.label, off: !rd.ok && !a.nav, strong, title: rd.ok || a.nav ? a.label : `${a.label} — ${rd.hint}`, trail: a.nav ? 'chev' : null,
    onclick: () => { if (!rd.ok && !a.nav) app.toast(`${a.label}: ${rd.hint}`, 4500, 'warn'); else { if (t && ref) AE.remember(app, t, ref); a.run(app); } } });
}
const card = (key, header, children, footer) => h('section', { class: 'ap-sec', 'data-key': key, 'aria-label': header || key },
  header ? h('div', { class: 'ap-sec-h' }, header) : null, h('div', { class: 'ap-card' }, children), footer ? h('div', { class: 'ap-sec-f' }, footer) : null);

function root(app, s, kind) {
  const c = s.ctx;
  const sel = (A.SETS[kind] || []).map((r) => [r, A.resolve(r)]).filter(([, a]) => a).slice(0, 5);
  return h('div', { class: 'view ap-page' },
    h('h1', { class: 'ap-large' }, 'MOE Motion'),
    card('ap-sel', `For your selection · ${c && c.comp ? A.CONTEXT_LABEL[kind] : 'no composition'}`, sel.map(([r, a]) => actRow(app, a, null, r, 'var(--accent)'))),
    card('ap-cats', 'Tools', AE.TABS.map((t) => row({
      key: `cat-${t.id}`, icon: CAT[t.id].icon, color: CAT[t.id].color, label: t.label, sub: t.groups.map((g) => g.label).slice(0, 3).join(' · '),
      trail: 'chev', title: t.title, onclick: () => { app.state.set({ aeQ: '' }); app.go(ID(t)); }
    }))),
    card('ap-gen', 'General', [
      row({ key: 'g-fav', icon: 'star', color: '#ffd60a', label: 'Favorites', trail: 'chev', onclick: () => app.go('favorites') }),
      row({ key: 'g-hist', icon: 'history', color: '#8e8e93', label: 'History', trail: 'chev', onclick: () => app.go('history') }),
      row({ key: 'g-qb', icon: 'bolt', color: '#ff9f0a', label: 'Customize Quick Bar', trail: 'chev', onclick: () => app.go('quick') }),
      row({ key: 'g-set', icon: 'gear', color: '#8e8e93', label: 'Settings', trail: 'chev', onclick: () => app.go('settings') })
    ]));
}

/** A Classic group as an inset card: primary buttons on top, rows, minor rows; presets as a shelf; blocks inside. */
function groupCard(app, t, g) {
  const color = CAT[t.id].color;
  let body;
  if (g.kind === 'acts') {
    const hero = g.hero || [];
    const heroBtns = hero.map((r) => [r, A.resolve(r)]).filter(([, a]) => a).map(([r, a]) => {
      const rd = a.ready(app);
      return h('button', { class: `ap-hero ${rd.ok ? '' : 'off'}`, 'data-key': `h-${a.id}`, 'aria-label': a.label, title: rd.ok ? a.label : `${a.label} — ${rd.hint}`, style: { '--tint': color },
        onclick: () => { if (!rd.ok) app.toast(`${a.label}: ${rd.hint}`, 4500, 'warn'); else { AE.remember(app, t, r); a.run(app); } } }, icon(a.icon || 'bolt', ''), h('span', {}, a.label));
    });
    body = [heroBtns.length ? h('div', { class: 'ap-heros' }, heroBtns) : null,
      ...g.refs.filter((r) => !hero.includes(r)).map((r) => [r, A.resolve(r)]).filter(([, a]) => a).map(([r, a]) => actRow(app, a, t, r, (g.minor || []).includes(r) ? '#8e8e93' : color)),
      ...(g.links || []).map(([id, label]) => row({ key: `l-${id}`, icon: 'chev', color: '#8e8e93', label, trail: 'chev', onclick: () => app.go(id) }))];
  } else if (g.kind === 'links') {
    body = (g.links || []).map(([id, label]) => row({ key: `l-${id}`, icon: (studio.byId(id) || {}).icon || 'chev', color, label: (studio.byId(id) || { label }).label, sub: label, trail: 'chev', onclick: () => app.go(id) }));
  } else body = h('div', { class: 'ap-inner' }, AE.groupBody(app, g, t));
  const more = g.more ? h('button', { class: 'ap-more', 'data-key': `more-${g.id}`, onclick: () => app.go(g.more) }, `See all ${(studio.byId(g.more) || {}).tiles ? studio.byId(g.more).tiles.length : ''}`, icon('chev', 'xs')) : null;
  return h('section', { class: `ap-sec ${g.kind === 'tiles' || g.kind === 'grid' ? 'shelf' : ''}`, 'data-key': `g-${g.id}`, 'aria-label': g.label },
    h('div', { class: 'ap-sec-h' }, h('span', {}, g.label), g.fits.includes(A.profile(app.state.get().ctx)) ? h('span', { class: 'ap-fit' }, 'for selection') : null, h('span', { class: 'spacer' }), more),
    h('div', { class: 'ap-card' }, body));
}

function category(app, s, t) {
  const recent = AE.recentRefs(app, t).map((r) => AE.recentItem(app, r)).filter(Boolean);
  return h('div', { class: 'view kit ap-page' },
    h('div', { class: 'ap-nav' }, h('button', { class: 'ap-back', 'data-key': 'ap-back', 'aria-label': 'Back to MOE Motion', onclick: () => app.go('home') }, icon('chev', 'xs ap-back-i'), 'MOE')),
    h('h1', { class: 'ap-large' }, h('span', { class: 'ap-sq lg', style: { background: CAT[t.id].color } }, icon(CAT[t.id].icon, '')), t.label),
    recent.length ? card(`ap-rec-${t.id}`, 'Recent', h('div', { class: 'ap-chips' }, recent.map((it) => h('button', { class: `ae-chip ${it.ready.ok ? '' : 'off'}`, 'data-key': `rc-${it.id}`, 'aria-label': it.label, title: it.label, onclick: () => (it.ready.ok ? it.run() : app.toast(`${it.label}: ${it.ready.hint}`, 4500, 'warn')) }, icon(it.icon || 'bolt', 'xs'), h('span', {}, it.label))))) : null,
    t.groups.map((g) => groupCard(app, t, g)));
}

function build(app, s, body) {
  const kind = A.profile(s.ctx);
  const q = (s.aeQ || '').trim();
  const t = tabOfView(s.view);
  let content, title;
  if (q) { content = h('div', { class: 'view ae-page ap-page' }, AE.searchResults(app, q)); title = 'Search'; }
  else if (s.view === 'home') { content = root(app, s, kind); title = ''; } // the large title is in the page (iOS style)
  else if (t) { content = category(app, s, t); title = t.label; }
  else {
    const owner = AE.ownerOf(s.view);
    const sec = studio.byId(s.view);
    title = (sec || { label: s.view.charAt(0).toUpperCase() + s.view.slice(1) }).label;
    content = [h('div', { class: 'ap-nav', 'data-key': `crumb-${s.view}` }, h('button', { class: 'ap-back', 'aria-label': `Back to ${owner ? owner.label : 'MOE Motion'}`, onclick: () => app.go(owner ? ID(owner) : 'home') }, icon('chev', 'xs ap-back-i'), owner ? owner.label : 'MOE')), body(s.view)];
  }
  return { top: [require('./quickbar').strip(app), AE.searchBox(app, s)], title, content, overlay: s.aeMenu ? AE.panelMenu(app, s) : null, menuBtn: AE.menuButton(app, s) };
}

module.exports = { CAT, CAT_IDS, build };
