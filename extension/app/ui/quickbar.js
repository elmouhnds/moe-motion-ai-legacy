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
/**
 * v0.29: a bar button is a Quick action ('reverse') or a library tile ('tile:animate/fadeIn') — the tile
 * itself, so the preset has one source (its numbers, label and icon). Old ids are migrated (B.MIGRATE).
 */
const tileCache = new Map();
function tileAction(ref) {
  if (tileCache.has(ref)) return tileCache.get(ref);
  const studio = require('./studio/sections');
  const [secId, tileId] = ref.slice(5).split('/');
  const sec = studio.byId(secId);
  const t = sec && (sec.tiles || []).find((x) => x.id === tileId);
  let a = null;
  if (t && t.tool) {
    const p = t.tool === 'expressions.quick' && t.args ? PRESETS[t.args.preset] : null;
    // expression presets keep their own numbers (the form's generic defaults must not replace them)
    const args = Object.assign({}, p ? p.nums : {}, t.args || {});
    const icon = p ? p.icon : require('./actions').resolve(`tile:${secId}/${tileId}`).icon;
    a = { id: ref, tool: t.tool, args, icon, label: t.label, group: sec.label, tile: true, section: secId };
  }
  tileCache.set(ref, a);
  return a;
}
const byId = (id) => { if (!id) return null; const m = B.migrate(id); return m.indexOf('tile:') === 0 ? tileAction(m) : ACTIONS.find((a) => a.id === m); };

/** The bar's ids (old ids migrated, duplicates and missing ones dropped). */
function barIds(app) {
  const out = [];
  for (const id of app.services.store.get('quick-bar', B.DEFAULT_BAR) || []) { const m = B.migrate(id); if (!out.includes(m) && byId(m)) out.push(m); }
  return out;
}
function togglePin(app, id) {
  const m = B.migrate(id);
  const cur = barIds(app);
  app.services.store.set('quick-bar', cur.includes(m) ? cur.filter((x) => x !== m) : cur.concat([m]));
  app.render();
}

async function run(app, a) {
  const tool = app.services.registry.get(a.tool);
  const args = Object.assign(defaults(tool.params || {}), a.args);
  const r = await app.runTool(a.tool, args, { resultKey: `quick:${a.id}`, label: a.label });
  if (!r) return;
  if (r.status === 'success' || r.status === 'partial') app.toast(r.summary || a.label, 2600, r.status === 'partial' ? 'warn' : 'ok');
  else app.toast(`${a.label}: ${whyFailed(r).join(' · ')}`, 5000, r.status === 'blocked' ? 'warn' : 'err');
}
/** v0.44: a failure always says why — its errors, else the checks that failed (e.g. "Cam — skipped: camera"), never just "failed". */
function whyFailed(r) {
  if (r.errors && r.errors.length) return r.errors;
  if (r.reasons && r.reasons.length) return r.reasons;
  const bad = ((r.verification && r.verification.checks) || []).filter((c) => !c.ok).slice(0, 2).map((c) => (c.detail ? `${c.label} — ${c.detail}` : c.label));
  return bad.length ? bad : [r.status];
}

function openOptions(app, a) {
  const tool = app.services.registry.get(a.tool);
  app.state.set((s) => ({
    quickPop: a.id,
    args: Object.assign({}, s.args, { [a.tool]: Object.assign(defaults(tool.params || {}), s.quickPop === a.id ? s.args[a.tool] : {}, a.args) }),
    open: Object.assign({}, s.open, { [a.tool]: true })
  }));
}

function button(app, a, cls = 'qb-btn', slot) {
  const s = app.state.get();
  // v0.28: the first ten buttons are the Everyday slots — Alt+1…0 runs them (hold Alt to see the numbers)
  const key = slot != null && slot < 10 ? String((slot + 1) % 10) : null;
  return h('button', {
    class: cls, title: `${a.label}${key ? ` · Alt+${key}` : ''}\nRight-click: options`, 'aria-label': a.label, disabled: !!s.running, 'data-slot': key || undefined,
    onclick: (e) => (e.altKey ? openOptions(app, a) : run(app, a)),
    oncontextmenu: (e) => { e.preventDefault(); openOptions(app, a); }
  }, icon(a.icon || 'bolt'), cls === 'qt-tile' ? h('span', { class: 'qt-label' }, a.label) : null);
}

/** Strip rendered by the shell under the context line. */
function strip(app) {
  if (app.services.store.get('quick-bar-hidden', false)) return null;
  // In a narrow panel part of the bar is off to the right; a normal mouse wheel scrolls it sideways
  // (before, only the 4 px scrollbar reached those buttons).
  // v0.14: Fit (default) = one row with what fits + a "+N" button for the rest (named, in a pop-up);
  // Wrap = every button on as many rows as needed; One row = the old sideways scroll.
  // A thin line separates groups (Project · Layer · Keys · Kit …).
  const mode = rowsMode(app);
  const st = app.state.get();
  const all = barIds(app).map(byId);
  const BTN = 28, SEP = 7;
  let shown = all, rest = [];
  if (mode === 'fit' && st.qbarW) {
    let room = st.qbarW - 12 - BTN * 2, last = null; // keep room for "+N" and ⚡
    const fit = [];
    all.forEach((a, i) => { if (fit.length < i) return; const w = BTN + (i === 10 || (i > 10 && a.group !== last) ? SEP : 0); if (room - w < 0) return; room -= w; fit.push(a); last = a.group; });
    if (fit.length < all.length) { shown = fit; rest = all.slice(fit.length); }
  }
  const items = [];
  let last = null;
  // the ten Everyday slots form one run; after them, a line between groups (Project · Layer · Keys …)
  shown.forEach((a, i) => { if (i === 10 || (i > 10 && a.group !== last)) items.push(h('span', { class: 'qb-sep', 'aria-hidden': 'true' })); items.push(button(app, a, 'qb-btn', i)); last = a.group; });
  return h('div', { class: `qbar ${mode === 'wrap' ? 'wrap' : ''} ${mode === 'fit' ? 'fit' : ''}`, role: 'toolbar', 'aria-label': 'Quick Bar',
    onwheel: (e) => { const el = e.currentTarget; if (el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { el.scrollLeft += e.deltaY; e.preventDefault(); } } },
    items,
    rest.length ? h('button', { class: 'qb-btn qb-rest', title: `${rest.length} more: ${rest.map((a) => a.label).join(', ')}`, 'aria-label': `${rest.length} more quick actions`, 'aria-expanded': String(!!st.qbarMore),
      onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(), box = fixedBox(e.currentTarget.closest('.app') || document.body); app.state.set({ qbarMore: st.qbarMore ? null : { top: Math.round(r.bottom - box.top + 4), right: Math.max(4, Math.round(box.right - r.right - 30)), maxW: Math.round(box.width - 16), ids: rest.map((a) => a.id) } }); } }, `+${rest.length}`) : null,
    h('button', { class: 'qb-btn more', title: 'All quick actions', 'aria-label': 'All quick actions', onclick: () => app.go('quick') }, icon('bolt')));
}
/** The box a position:fixed element inside `host` is placed against: the window in AE, but a
 *  transformed frame in the web preview. Measured with a throw-away probe, so both are right. */
function fixedBox(host) {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;visibility:hidden;pointer-events:none';
  host.appendChild(probe);
  const b = probe.getBoundingClientRect();
  probe.remove();
  return b;
}
const ROWS = ['fit', 'wrap', 'one'];
const rowsMode = (app) => { const m = app.services.store.get('quick-bar-rows', 'fit'); return ROWS.includes(m) ? m : 'fit'; };

/** The "+N" pop-up: the buttons that did not fit, with their names. */
function restPopover(app) {
  const s = app.state.get();
  if (!s.qbarMore) return null;
  const close = () => app.state.set({ qbarMore: null });
  return h('div', { class: 'overlay qb-overlay', onmousedown: (e) => { if (e.target.classList.contains('overlay')) close(); } },
    h('div', { class: 'qb-rest-pop', role: 'menu', 'aria-label': 'More quick actions', style: { top: `${s.qbarMore.top}px`, right: `${s.qbarMore.right || 10}px`, maxWidth: `${Math.min(420, s.qbarMore.maxW || 420)}px` }, onclick: (e) => { if (e.target.closest && e.target.closest('button')) close(); } },
      s.qbarMore.ids.map(byId).filter(Boolean).map((a) => button(app, a, 'qt-tile'))));
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
      hidden ? null : h('button', { class: 'btn ghost', title: 'Fit: one row + a “+N” button for the rest · Wrap: every button, on more rows · One row: scroll sideways (mouse wheel)', onclick: () => { const m = rowsMode(app); app.services.store.set('quick-bar-rows', ROWS[(ROWS.indexOf(m) + 1) % ROWS.length]); app.render(); } }, `Bar: ${{ fit: 'fit', wrap: 'wrap', one: 'one row' }[rowsMode(app)]}`),
      (() => {
        const isDefault = JSON.stringify(barIds(app)) === JSON.stringify(B.DEFAULT_BAR.filter((id) => byId(id)));
        return h('button', { class: 'btn ghost', disabled: isDefault, title: isDefault ? 'The bar already has the default set' : 'Reset the bar to the default set', onclick: () => { app.services.store.set('quick-bar', B.DEFAULT_BAR); app.toast('Quick Bar reset to the default set', 2200, 'ok'); app.render(); } }, icon('undo', 'sm'));
      })()),
    B.GROUPS.map((g) => [
      h('div', { class: 'section-h' }, g),
      h('div', { class: 'qt-grid rows pad' }, ACTIONS.filter((a) => a.group === g).map((a) => pinTile(app, a, pinned)))
    ]),
    // v0.29: presets live in their library; the bar holds the tile itself (one source, no copies here)
    h('div', { class: 'section-h' }, 'Presets on your bar'),
    (() => {
      const tiles = [...pinned].filter((id) => id.indexOf('tile:') === 0).map(byId).filter(Boolean);
      return h('div', { class: 'pad' },
        tiles.length ? h('div', { class: 'qt-grid rows' }, tiles.map((a) => pinTile(app, a, pinned, a.group))) : null,
        h('p', { class: 'why' }, 'Any preset can sit on the bar: open it in its library (Animate, Expressions, Layout…) and click ☆ next to Apply. ',
          ['animate', 'expressions', 'layout', 'zoom'].map((id) => h('button', { class: 'btn ghost sm', 'data-key': `qb-lib-${id}`, onclick: () => app.go(id) }, require('./studio/sections').byId(id).label))));
    })());
}
function pinTile(app, a, pinned, sub) {
  return h('div', { class: 'qt-wrap', 'data-key': `qt-${a.id}` },
    button(app, a, 'qt-tile'),
    h('button', { class: 'qt-pin', 'aria-pressed': String(pinned.has(a.id)), 'aria-label': `${pinned.has(a.id) ? 'Remove' : 'Add'} ${a.label}${sub ? ` (${sub})` : ''} ${pinned.has(a.id) ? 'from' : 'to'} the bar`, title: pinned.has(a.id) ? 'Remove from bar' : 'Add to bar', onclick: () => togglePin(app, a.id) }, icon('star', 'sm')));
}

/** Run Everyday slot n (0-based) of the bar — Alt+1…0. */
function runSlot(app, n) { const a = byId(barIds(app)[n]); if (!a) return false; run(app, a); return a; }

module.exports = { whyFailed, tileAction, togglePin, runSlot, strip, popover, restPopover, view, ACTIONS, run, openOptions, button, fixedBox, byId, barIds };
