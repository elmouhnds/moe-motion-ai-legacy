'use strict';
/**
 * Quick Bar: a strip of one-click icon buttons under the context line (every section),
 * a Quick section with every action grouped, and an options popover.
 *   click            run with the action's preset
 *   right/Alt-click  open options (the tool's own form) in a popover
 *   ★ in Quick view  pin / unpin to the bar
 */
const { h, icon } = require('./dom');
const { renderTool } = require('./toolBlock');
const { defaults } = require('../../core/schema');
const B = require('../../features/quick/bar');
const { PRESETS } = require('../../features/expressions/quick');

const ACTIONS = B.resolve(PRESETS);
const byId = (id) => ACTIONS.find((a) => a.id === id);

function barIds(app) { return app.services.store.get('quick-bar', B.DEFAULT_BAR).filter((id) => byId(id)); }
function togglePin(app, id) {
  app.services.store.update('quick-bar', B.DEFAULT_BAR, (list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  app.render();
}

async function run(app, a) {
  const tool = app.services.registry.get(a.tool);
  const args = Object.assign(defaults(tool.params || {}), a.args);
  const r = await app.runTool(a.tool, args, { resultKey: `quick:${a.id}`, label: a.label });
  if (!r) return;
  if (r.status === 'success' || r.status === 'partial') app.toast(r.summary || a.label, 2600, r.status === 'partial' ? 'warn' : 'ok');
  else app.toast(`${a.label}: ${(r.errors || r.reasons || [r.status]).join(' · ')}`, 5000, r.status === 'blocked' ? 'warn' : 'err');
}

function openOptions(app, a) {
  const tool = app.services.registry.get(a.tool);
  app.state.set((s) => ({
    quickPop: a.id,
    args: Object.assign({}, s.args, { [a.tool]: Object.assign(defaults(tool.params || {}), s.quickPop === a.id ? s.args[a.tool] : {}, a.args) }),
    open: Object.assign({}, s.open, { [a.tool]: true })
  }));
}

function button(app, a, cls = 'qb-btn') {
  const s = app.state.get();
  return h('button', {
    class: cls, title: `${a.label}\nRight-click: options`, 'aria-label': a.label, disabled: !!s.running,
    onclick: (e) => (e.altKey ? openOptions(app, a) : run(app, a)),
    oncontextmenu: (e) => { e.preventDefault(); openOptions(app, a); }
  }, icon(a.icon || 'bolt'), cls === 'qt-tile' ? h('span', { class: 'qt-label' }, a.label) : null);
}

/** Strip rendered by the shell under the context line. */
function strip(app) {
  if (app.services.store.get('quick-bar-hidden', false)) return null;
  // In a narrow panel part of the bar is off to the right; a normal mouse wheel scrolls it sideways
  // (before, only the 4 px scrollbar reached those buttons).
  return h('div', { class: 'qbar', role: 'toolbar', 'aria-label': 'Quick Bar',
    onwheel: (e) => { const el = e.currentTarget; if (el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { el.scrollLeft += e.deltaY; e.preventDefault(); } } },
    barIds(app).map((id) => button(app, byId(id))),
    h('button', { class: 'qb-btn more', title: 'All quick actions', 'aria-label': 'All quick actions', onclick: () => app.go('quick') }, icon('bolt')));
}

/** Options popover (the tool's own form, prefilled with the action preset). */
function popover(app) {
  const s = app.state.get();
  const a = s.quickPop && byId(s.quickPop);
  if (!a) return null;
  const tool = app.services.registry.get(a.tool);
  const close = () => app.state.set({ quickPop: null });
  return h('div', { class: 'overlay', onmousedown: (e) => { if (e.target.classList.contains('overlay')) close(); } },
    h('div', { class: 'palette qpop', role: 'dialog', 'aria-label': `${a.label} options` },
      h('div', { class: 'qpop-h' }, icon(a.icon || 'bolt'), h('b', {}, a.label), h('span', { class: 'spacer' }), h('button', { class: 'icon-btn', title: 'Close', onclick: close }, icon('x', 'sm'))),
      renderTool(app, tool, { openByDefault: true })));
}

/** Quick section: every action, grouped, with pin toggles. */
function view(app) {
  const pinned = new Set(barIds(app));
  const hidden = app.services.store.get('quick-bar-hidden', false);
  return h('div', { class: 'view' },
    h('div', { class: 'pad tl-bar' },
      h('span', { class: 'why', style: { flex: 1 } }, `Click = run · Right-click = options · ★ = on the bar (${pinned.size} pinned)`),
      h('button', { class: 'btn ghost', onclick: () => { app.services.store.set('quick-bar-hidden', !hidden); app.render(); } }, hidden ? 'Show bar' : 'Hide bar'),
      (() => {
        const isDefault = JSON.stringify(barIds(app)) === JSON.stringify(B.DEFAULT_BAR.filter((id) => byId(id)));
        return h('button', { class: 'btn ghost', disabled: isDefault, title: isDefault ? 'The bar already has the default set' : 'Reset the bar to the default set', onclick: () => { app.services.store.set('quick-bar', B.DEFAULT_BAR); app.toast('Quick Bar reset to the default set', 2200, 'ok'); app.render(); } }, icon('undo', 'sm'));
      })()),
    B.GROUPS.map((g) => [
      h('div', { class: 'section-h' }, g),
      h('div', { class: 'qt-grid pad' }, ACTIONS.filter((a) => a.group === g).map((a) => h('div', { class: 'qt-wrap' },
        button(app, a, 'qt-tile'),
        h('button', { class: 'qt-pin', 'aria-pressed': String(pinned.has(a.id)), title: pinned.has(a.id) ? 'Remove from bar' : 'Add to bar', onclick: () => togglePin(app, a.id) }, icon('star', 'sm')))))
    ]));
}

module.exports = { strip, popover, view, ACTIONS, run, openOptions };
