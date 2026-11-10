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
const R = require('../kitRun');

function itemCard(app, s, ref, kit, done) {
  const a = A.resolve(ref);
  if (!a) return null;
  const build = R.buildOf(s, kit.id);
  const at = build ? build.indexOf(ref) : -1;
  const [kind, rest] = [ref.slice(0, ref.indexOf(':')), ref.slice(ref.indexOf(':') + 1)];
  let thumb = null, page = null;
  if (kind === 'tile') {
    const [secId, tileId] = rest.split('/');
    const sec = studio.byId(secId);
    const tile = sec && sec.tiles.find((t) => t.id === tileId);
    page = secId;
    if (tile && tile.tool === 'design.background') { const PC = require('../paletteCard'); thumb = PC.art(tile.id, PC.cardArgs(tile, s.args && s.args['design.background'], require('../studio/bgComposer').fullLook(tile))); }
    else if (tile) { const L = require('../studio/library'); thumb = L.thumbEl(L.tileThumb(app, tile)); }
  } else if (kind === 'nav') page = rest;
  const rd = a.ready(app);
  return h('button', {
    class: `sk-item ${rd.ok || a.nav ? '' : 'off'} ${done && done[ref] ? 'done' : ''} ${at >= 0 ? 'picked' : ''} ${build ? 'building' : ''}`, 'aria-pressed': build ? String(at >= 0) : undefined, 'data-key': `kit-i-${ref}`, 'aria-label': a.label,
    title: `${a.label}${rd.ok || a.nav ? '' : ` — ${rd.hint}`}\n${build ? 'Click: add to / take out of the recipe' : `Click: ${a.nav ? 'open' : 'apply'}${page && !a.nav ? ' · right-click: its library' : ''}`}`,
    onclick: (e) => R.runRef(app, kit, ref, e),
    oncontextmenu: page && !a.nav ? (e) => { e.preventDefault(); app.go(page); } : undefined
  }, h('span', { class: 'sk-thumb' }, thumb || icon(a.icon || 'bolt', 'lg')), h('span', { class: 'sk-name' }, a.label),
  at >= 0 ? h('span', { class: 'sk-order', 'aria-label': `step ${at + 1}` }, String(at + 1)) : null,
  done && done[ref] && at < 0 ? h('span', { class: 'sk-tick', title: 'You used this here', 'aria-label': 'used' }, icon('check', 'xs')) : null);
}

function kitCard(app, k) {
  const pinned = R.focusId(app) === k.id;
  const ready = R.readyCount(app, k);
  return h('button', {
    class: `sk-card ${pinned ? 'pinned' : ''}`, 'data-key': `kit-c-${k.id}`, style: { '--k1': k.accent[0], '--k2': k.accent[1] }, title: `${k.label} — ${k.tagline}`,
    onclick: () => app.state.set({ kitId: k.id })
  }, h('span', { class: 'sk-card-ic', 'aria-hidden': 'true' }, icon(k.icon, 'lg')),
  pinned ? h('span', { class: 'sk-card-pin' }, 'Working in') : null,
  h('span', { class: 'sk-card-t' }, h('b', {}, k.label), h('span', {}, k.tagline)),
  ready ? h('span', { class: 'sk-card-ready', title: 'Tools of this kit that can run on what is selected now' }, h('i', { 'aria-hidden': 'true' }), `${ready} ready now`) : null,
  h('span', { class: 'sk-card-n' }, `${K.refsOf(k).length} tools · ${k.steps.length} steps${(k.recipes || []).length ? ` · ${k.recipes.length} recipe${k.recipes.length > 1 ? 's' : ''}` : ''}`));
}
function overview(app) {
  return K.KINDS.map(([id, label, hint]) => h('section', { class: 'sk-kind', 'data-key': `kit-k-${id}`, 'aria-label': label },
    h('div', { class: 'sk-kind-h' }, h('b', {}, label), h('span', {}, hint)),
    h('div', { class: 'sk-cards' }, K.KITS.filter((k) => k.kind === id).map((k) => kitCard(app, k)))));
}

/** v0.76: a recipe — the chain as its tools' icons, one click runs it (one undo). */
function recipeCard(app, kit, rec) {
  const acts = rec.refs.map((r) => A.resolve(r)).filter(Boolean);
  const first = acts[0] && acts[0].ready(app);
  return h('button', {
    class: `sk-rec ${first && !first.ok ? 'off' : ''} ${rec.mine ? 'mine' : ''}`, 'data-key': `kit-r-${kit.id}-${rec.id}`,
    oncontextmenu: rec.mine ? (e) => { e.preventDefault(); R.removeMine(app, kit, rec); } : undefined,
    title: `${rec.label} — ${rec.hint}\n${acts.map((a) => a.label).join(' → ')}\nOne click, one Ctrl+Z${rec.mine ? ' · right-click: remove' : ''}${first && !first.ok ? `\nNeeds: ${first.hint}` : ''}`,
    onclick: () => R.runRecipe(app, kit, rec)
  }, h('span', { class: 'sk-rec-t' }, h('b', {}, rec.label), h('i', {}, rec.hint)),
  h('span', { class: 'sk-rec-chain', 'aria-hidden': 'true' }, acts.map((a, i) => [i ? h('em', {}) : null, h('span', { class: 'sk-rec-ic' }, icon(a.icon || 'bolt', 'sm'))])),
  h('span', { class: 'sk-rec-go' }, icon('play', 'xs'), `${acts.length} steps`));
}

/** v0.77: the tray while you build a recipe — the chain so far, Save, Cancel. */
function buildTray(app, kit, refs) {
  return h('div', { class: 'sk-tray', 'data-key': 'sk-tray', role: 'group', 'aria-label': 'New recipe' },
    h('span', { class: 'sk-tray-t' }, refs.length ? null : 'Click the tools below in the order they should run (2 to 4)',
      refs.map((r, i) => { const a = A.resolve(r); return [i ? h('em', { 'aria-hidden': 'true' }) : null, h('button', { class: 'sk-tray-chip', 'data-key': `sk-tc-${r}`, title: `Take ${a.label} out`, onclick: () => R.toggleBuild(app, kit, r) }, h('b', {}, String(i + 1)), a.label, icon('x', 'xs'))]; })),
    h('span', { class: 'sk-tray-b' },
      h('button', { class: 'btn ghost sm', 'data-key': 'sk-tray-x', onclick: () => R.cancelBuild(app) }, 'Cancel'),
      h('button', { class: 'btn primary sm', 'data-key': 'sk-tray-ok', disabled: refs.length < 2 ? 'disabled' : undefined, title: refs.length < 2 ? 'Pick at least two tools' : 'Name it and save', onclick: () => R.saveBuild(app, kit) }, icon('check', 'xs'), 'Save recipe')));
}

function render(app) {
  const s = app.state.get();
  const kit = K.byId(s.kitId);
  if (!kit) {
    return h('div', { class: 'view sk-page' },
      h('div', { class: 'sk-intro' }, h('b', {}, 'Style Kits'), h('span', {}, 'Each look\'s tools in one place, in the order you build it. Everyday tools stay where they are.')),
      overview(app));
  }
  const done = R.doneOf(s, kit.id);
  const pg = K.progress(kit, done);
  const pinned = R.focusId(app) === kit.id;
  const build = R.buildOf(s, kit.id);
  return h('div', { class: `view sk-page ${build ? 'sk-building' : ''}`, 'data-key': `kit-p-${kit.id}` },
    h('div', { class: 'sk-head', style: { '--k1': kit.accent[0], '--k2': kit.accent[1] } },
      h('button', { class: 'btn ghost sm sk-back', 'data-key': 'sk-back', onclick: () => app.state.set({ kitId: null }) }, icon('chev', 'xs'), 'All kits'),
      h('span', { class: 'sk-head-t' }, icon(kit.icon, 'lg'), h('span', {}, h('b', {}, kit.label), h('i', {}, kit.tagline))),
      h('div', { class: 'sk-head-b' },
        h('span', { class: 'sk-prog', title: 'Steps you have touched here (this session)' }, h('span', { class: 'sk-prog-bar', 'aria-hidden': 'true' }, h('i', { style: { width: `${Math.round(100 * pg.count / pg.total)}%` } })), `${pg.count} / ${pg.total} steps`),
        h('button', { class: `btn sm sk-pin ${pinned ? 'on' : ''}`, 'data-key': 'sk-pin', 'aria-pressed': String(pinned), title: pinned ? 'Stop showing this kit on Home' : 'Show this kit\'s next step on Home, in every style', onclick: () => R.setFocus(app, pinned ? null : kit.id) }, icon(pinned ? 'check' : 'target', 'xs'), pinned ? 'Working in this kit' : 'Work in this kit'))),
    h('nav', { class: 'sk-switch', 'aria-label': 'Kits' }, K.KITS.map((k) => h('button', { class: `sk-chip ${k.id === kit.id ? 'on' : ''}`, 'data-key': `kit-s-${k.id}`, 'aria-pressed': String(k.id === kit.id), onclick: () => app.state.set({ kitId: k.id }) }, k.label))),
    h('section', { class: 'sk-recs', 'data-key': `kit-rs-${kit.id}`, 'aria-label': 'Recipes' },
      h('div', { class: 'sk-step-h' }, 'Recipes · one click, one undo', h('span', { class: 'spacer' }),
        build ? null : h('button', { class: 'btn ghost sm sk-new', 'data-key': 'sk-new', title: 'Make your own: click up to four of this kit\'s tools in the order they should run, then Save', onclick: () => R.startBuild(app, kit.id) }, icon('plus', 'xs'), 'New recipe')),
      build ? buildTray(app, kit, build) : null,
      h('div', { class: 'sk-rec-row' }, (kit.recipes || []).concat(R.mineOf(app, kit.id)).map((rc) => recipeCard(app, kit, rc)))),
    kit.steps.map((st, i) => h('section', { class: `sk-step ${pg.steps[i] ? 'done' : ''} ${pg.next === i ? 'next' : ''}`, 'data-key': `kit-st-${kit.id}-${i}`, 'aria-label': st.label },
      h('div', { class: 'sk-step-h' }, h('span', { class: 'sk-step-dot', 'aria-hidden': 'true' }, pg.steps[i] ? icon('check', 'xs') : null), st.label, pg.next === i && pg.count ? h('span', { class: 'sk-step-next' }, 'Next') : null),
      h('div', { class: 'sk-items' }, st.refs.map((r) => itemCard(app, s, r, kit, done))))));
}

module.exports = { render };
