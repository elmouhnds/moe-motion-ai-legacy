'use strict';
/**
 * Style Kits page (v0.75, app/ui/kits.js): the kits as cards; a kit as its steps, each a row of its tools with their
 * own live previews (they play under the mouse). Click runs the tool through actions.resolve (readiness first, as the pie
 * and Home do); right-click opens its library page. Nothing here is a new tool.
 */
const { h, icon } = require('../dom');
const K = require('../kits');
const A = require('../actions');
const studio = require('../studio/sections');

function itemCard(app, s, ref) {
  const a = A.resolve(ref);
  if (!a) return null;
  const [kind, rest] = [ref.slice(0, ref.indexOf(':')), ref.slice(ref.indexOf(':') + 1)];
  let thumb = null, page = null;
  if (kind === 'tile') {
    const [secId, tileId] = rest.split('/');
    const sec = studio.byId(secId);
    const tile = sec && sec.tiles.find((t) => t.id === tileId);
    page = secId;
    if (tile) { const L = require('../studio/library'); thumb = L.thumbEl(L.tileThumb(app, tile)); }
  } else if (kind === 'nav') page = rest;
  const rd = a.ready(app);
  return h('button', {
    class: `sk-item ${rd.ok || a.nav ? '' : 'off'}`, 'data-key': `kit-i-${ref}`, 'aria-label': a.label,
    title: `${a.label}${rd.ok || a.nav ? '' : ` — ${rd.hint}`}\nClick: ${a.nav ? 'open' : 'apply'}${page && !a.nav ? ' · right-click: its library' : ''}`,
    onclick: (e) => { if (!rd.ok && !a.nav) app.toast(`${a.label}: ${rd.hint}`, 4500, 'warn'); else a.run(app, e); },
    oncontextmenu: page && !a.nav ? (e) => { e.preventDefault(); app.go(page); } : undefined
  }, h('span', { class: 'sk-thumb' }, thumb || icon(a.icon || 'bolt', 'lg')), h('span', { class: 'sk-name' }, a.label));
}

function overview(app) {
  return h('div', { class: 'sk-cards' }, K.KITS.map((k) => h('button', {
    class: 'sk-card', 'data-key': `kit-c-${k.id}`, style: { '--k1': k.accent[0], '--k2': k.accent[1] }, title: `${k.label} — ${k.tagline}`,
    onclick: () => app.state.set({ kitId: k.id })
  }, h('span', { class: 'sk-card-ic', 'aria-hidden': 'true' }, icon(k.icon, 'lg')),
  h('span', { class: 'sk-card-t' }, h('b', {}, k.label), h('span', {}, k.tagline)),
  h('span', { class: 'sk-card-n' }, `${K.refsOf(k).length} tools · ${k.steps.length} steps`))));
}

function render(app) {
  const s = app.state.get();
  const kit = K.byId(s.kitId);
  if (!kit) {
    return h('div', { class: 'view sk-page' },
      h('div', { class: 'sk-intro' }, h('b', {}, 'Style Kits'), h('span', {}, 'Each look\'s tools in one place, in the order you build it. Everyday tools stay where they are.')),
      overview(app));
  }
  return h('div', { class: 'view sk-page', 'data-key': `kit-p-${kit.id}` },
    h('div', { class: 'sk-head', style: { '--k1': kit.accent[0], '--k2': kit.accent[1] } },
      h('button', { class: 'btn ghost sm sk-back', 'data-key': 'sk-back', onclick: () => app.state.set({ kitId: null }) }, icon('chev', 'xs'), 'All kits'),
      h('span', { class: 'sk-head-t' }, icon(kit.icon, 'lg'), h('span', {}, h('b', {}, kit.label), h('i', {}, kit.tagline)))),
    h('nav', { class: 'sk-switch', 'aria-label': 'Kits' }, K.KITS.map((k) => h('button', { class: `sk-chip ${k.id === kit.id ? 'on' : ''}`, 'data-key': `kit-s-${k.id}`, 'aria-pressed': String(k.id === kit.id), onclick: () => app.state.set({ kitId: k.id }) }, k.label))),
    kit.steps.map((st, i) => h('section', { class: 'sk-step', 'data-key': `kit-st-${kit.id}-${i}`, 'aria-label': st.label },
      h('div', { class: 'sk-step-h' }, st.label),
      h('div', { class: 'sk-items' }, st.refs.map((r) => itemCard(app, s, r))))));
}

module.exports = { render };
