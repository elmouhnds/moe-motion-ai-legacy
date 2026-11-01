'use strict';
/**
 * Style proposal v0.24 — "Glass" (docs/features/STYLE_PROPOSALS.md).
 *
 * Look: frosted glass cards floating over a deep colour field (backdrop blur, light rims, soft shadows).
 * Organisation, rethought by stage of work instead of AE menus:
 *   ┌ Now ───────────────┐  what is selected + the eight best actions for it (the smart pie set)
 *   │ cards of the space │  Motion · Arrange · Look · Deliver — each a column of glass cards
 *   └ ◉ Motion ○ Arrange ○ Look ○ Deliver ┘  floating capsule at the bottom (thumb reach, like iOS)
 * Every card is a Classic group (same tools, same tiers, same open / fold memory) — only arranged by stage.
 */
const { h, icon } = require('./dom');
const A = require('./actions');
const AE = require('./layoutAE');
const studio = require('./studio/sections');

// v0.28: the spaces are the workflow stages (app/ui/workflow.js) — Animate · Arrange · Design · Finish · Deliver
const W = require('./workflow');
const SPACES = W.STAGES.map((st) => ({ id: `gl-${st.id.slice(3)}`, label: st.label, icon: st.icon, fits: st.fits, title: st.title, stage: st }));
const SPACE_IDS = SPACES.map((x) => x.id);
const ownerOf = (view) => { const st = W.stageOfView(view); return st ? SPACES.find((sp) => sp.stage === st) : null; };

/** The Now card: what is selected, and the eight best actions for it. */
function nowCard(app, s, kind) {
  const c = s.ctx;
  const fold = !!app.services.store.get('glass-now-folded', false);
  const what = !c ? 'Reading After Effects…' : !c.comp ? 'No active composition' : A.CONTEXT_LABEL[kind];
  const sub = c && c.comp ? `${c.comp.name} · ${(c.layers || []).length} layers${c.keys ? ` · ${c.keys} keys` : ''}` : '';
  const acts = (A.SETS[kind] || []).map((r) => A.resolve(r)).filter(Boolean).slice(0, 8);
  // v0.26: the client you work for, one click away (when layers are selected)
  const client = require('../../features/brand/kit').activeBrand(app.services.store, app.services.brands);
  if (client && kind !== 'none' && kind !== 'keys') acts.push(A.resolve('brand:apply'));
  return h('section', { class: 'gl-now', 'data-key': 'gl-now', 'aria-label': 'Now' },
    h('div', { class: 'gl-now-h' }, h('span', { class: 'gl-now-k' }, 'NOW'), h('b', {}, what), h('span', { class: 'gl-now-s' }, sub), h('span', { class: 'spacer' }),
      h('button', { class: 'icon-btn gl-now-fold', 'data-key': 'gl-now-fold', 'aria-expanded': String(!fold), 'aria-label': fold ? 'Show the Now actions' : 'Fold the Now card', title: fold ? 'Show the eight best actions' : 'Fold to one line (more room for the cards)', onclick: () => { app.services.store.set('glass-now-folded', !fold); app.render(); } }, icon('chev', `xs gl-chev ${fold ? '' : 'open'}`))),
    // folded: the two primary actions stay, as small buttons in the header line
    h('div', { class: `gl-now-acts ${fold ? 'mini' : ''}` }, (fold ? acts.slice(0, 2) : acts).map((a, i) => AE.actButton(app, a, null, fold ? 's' : i < 2 ? 'l' : undefined))));
}

function nav(app, sp, kind) {
  return h('nav', { class: 'gl-nav', 'aria-label': 'Spaces', role: 'tablist' }, SPACES.map((x) => h('button', {
    role: 'tab', class: `gl-tab ${sp && sp.id === x.id ? 'on' : ''}`, 'data-key': `gl-${x.id}`, 'aria-selected': String(!!(sp && sp.id === x.id)), title: `${x.title}${x.fits.includes(kind) ? ' — fits what you selected' : ''} · Ctrl+${SPACES.indexOf(x) + 1}`,
    onclick: () => { app.state.set({ aeQ: '' }); app.go(x.id); }
  }, icon(x.icon, ''), h('span', {}, x.label), h('kbd', { class: 'gl-kbd', 'aria-hidden': 'true' }, `^${SPACES.indexOf(x) + 1}`), x.fits.includes(kind) ? h('span', { class: 'ae-dot', 'aria-hidden': 'true' }) : null)));
}

function build(app, s, body) {
  // Settings › Glass blur (v0.25): the frosted blur can be turned off if AE feels slower on a machine
  try { document.documentElement.dataset.glassBlur = app.services.settings.get().ui.glassBlur === false ? 'off' : 'on'; } catch (e) { /* no DOM in tests */ }
  const kind = A.profile(s.ctx);
  const first = (SPACES.find((x) => x.fits.includes(kind)) || SPACES[0]).id;
  const view = s.view === 'home' ? (s.glSpace || first) : s.view;
  const isSpace = SPACE_IDS.includes(view);
  const sp = isSpace ? SPACES.find((x) => x.id === view) : ownerOf(view) || (AE.UTIL.includes(view) ? null : SPACES.find((x) => x.id === (s.glSpace || first)));
  if (s.view !== 'home' && isSpace && s.glSpace !== view) setTimeout(() => app.state.set({ glSpace: view }), 0);
  const q = (s.aeQ || '').trim();
  let content;
  if (q) content = h('div', { class: 'view ae-page gl-page' }, AE.searchResults(app, q));
  else if (isSpace) {
    // everyday groups first; the stage's rare groups follow, folded until you open them (remembered per group)
    content = h('div', { class: 'view kit ae-page gl-page' }, nowCard(app, s, kind),
      W.stageGroups(sp.stage).map(({ tab, group, tier }) => AE.twirl(app, tab, tier === 'more' && group.open ? Object.assign({}, group, { open: false }) : group, kind, () => AE.groupBody(app, group, tab),
        tier === 'more' ? h('span', { class: 'gl-rare', title: 'Used less often' }, 'more') : group.more ? AE.moreLink(app, group) : null)));
  } else {
    const back = sp || SPACES.find((x) => x.id === (s.glSpace || first));
    const sec = studio.byId(view);
    content = [h('div', { class: 'lay-crumb ae-crumb gl-crumb', 'data-key': `crumb-${view}` },
      h('button', { class: 'btn ghost sm', onclick: () => app.go(back.id) }, icon('chev', 'xs'), back.label),
      h('span', { class: 'lay-crumb-sep' }, '›'), h('span', {}, (sec || { label: view.charAt(0).toUpperCase() + view.slice(1) }).label)), body(view)];
  }
  return {
    top: [require('./quickbar').strip(app), AE.searchBox(app, s)],
    title: q ? 'Search' : isSpace ? sp.label : (studio.byId(view) || { label: view.charAt(0).toUpperCase() + view.slice(1) }).label,
    content,
    bottom: nav(app, sp, kind),
    overlay: s.aeMenu ? AE.panelMenu(app, s) : null,
    menuBtn: AE.menuButton(app, s)
  };
}

module.exports = { SPACES, SPACE_IDS, ownerOf, build };
