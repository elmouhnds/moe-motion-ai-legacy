'use strict';
/** One tool, rendered inline: header row → presets, form, action, report. */
const { h, icon } = require('./dom');
const { renderForm } = require('./form');
const { renderReport } = require('./report');
const contextReq = require('../../core/context');
const { defaults } = require('../../core/schema');
const widgets = require('./widgets');

/** Quick colour swatches for colour fields: the active client first, then MOE's own set. */
function swatchesFor(app) {
  const brands = app.services.brands.list();
  const b = brands.find((x) => x.id === app.services.store.get('active-client', null)) || brands[0];
  const own = ['#FFFFFF', '#1C1C1E', '#FF7A59', '#FFB38A', '#4D8DFF', '#34D399', '#F5B942', '#A78BFA'];
  return [...new Set([...(b ? b.colors.map((c) => c.hex.toUpperCase()) : []), ...own])].slice(0, 12);
}

function availability(tool, ctx, args, services) {
  const r = contextReq.evaluate(tool.requires, ctx);
  if (!r.ok) return { ok: false, hint: r.reasons[0] };
  if (!tool.prepare) return { ok: true, hint: '' };
  try {
    // services too, exactly like the executor (v0.26 fix: brand tools read the client from services.brands)
    const p = tool.prepare(args, ctx, services);
    return p.ok ? { ok: true, hint: p.preview.summary, preview: p.preview } : { ok: false, hint: p.error };
  } catch (e) {
    return { ok: false, hint: 'Check the parameters' };
  }
}

function renderTool(app, tool, { openByDefault = false } = {}) {
  const s = app.state.get();
  const args = s.args[tool.id] || defaults(tool.params || {});
  const open = s.open[tool.id] !== undefined ? s.open[tool.id] : openByDefault;
  const av = s.ctx ? availability(tool, s.ctx, args, app.services) : { ok: false, hint: s.hostError ? 'After Effects not connected' : 'Reading After Effects…' };
  const running = s.running === tool.id;
  const pinned = app.services.favorites.list().includes(tool.id);
  const result = s.results[tool.id];
  const userPresets = app.services.presets.list(tool.id);
  const allPresets = [...((tool.ui && tool.ui.presets) || []), ...userPresets.map((p) => Object.assign({ user: true }, p, { label: p.name }))];
  const isActive = (p) => Object.entries(p.args).every(([k, v]) => args[k] === v);

  const setArgs = (next) => app.state.set((st) => ({ args: Object.assign({}, st.args, { [tool.id]: next }) }));

  return h('div', { class: `tool ${open ? 'open' : ''} ${av.ok ? '' : 'unavailable'}`, 'data-tool': tool.id },
    h('div', { class: 'tool-h', role: 'button', tabindex: '0', 'aria-expanded': String(open),
      onclick: () => app.toggleTool(tool.id, !open),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); app.toggleTool(tool.id, !open); } } },
      icon(tool.icon || 'tools'),
      h('span', { class: 'name' }, tool.name),
      h('span', { class: `hint ${av.ok ? 'ready' : ''}`, title: av.hint }, av.hint),
      h('button', { class: 'icon-btn pin', 'aria-pressed': String(pinned), title: pinned ? 'Unpin from Favorites' : 'Pin to Favorites',
        onclick: (e) => { e.stopPropagation(); app.services.favorites.toggle(tool.id); app.render(); } }, icon('star', 'sm')),
      h('span', { class: 'chev' }, icon('chev', 'sm'))),
    open ? h('div', { class: 'tool-b' },
      allPresets.length ? h('div', { class: 'presets' }, allPresets.map((p) => h('button', {
        class: 'chip-btn', 'aria-pressed': String(isActive(p)), title: p.user ? 'Your preset — right-click to delete' : '',
        onclick: () => setArgs(Object.assign({}, args, p.args)),
        oncontextmenu: p.user ? (e) => { e.preventDefault(); app.services.presets.remove(p.id); app.render(); } : undefined
      }, p.label))) : null,
      (tool.ui && tool.ui.renderBody) || widgets.body[tool.id] ? ((tool.ui && tool.ui.renderBody) || widgets.body[tool.id])(args, setArgs, { h, app, ctx: s.ctx }) : null,
      renderForm(tool.params, args, setArgs, { ctx: s.ctx, swatches: swatchesFor(app), advancedOpen: s.advanced[tool.id], onToggleAdvanced: () => app.state.set((st) => ({ advanced: Object.assign({}, st.advanced, { [tool.id]: !st.advanced[tool.id] }) })) }),
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary', disabled: !av.ok || !!s.running, onclick: () => app.runTool(tool.id, args) },
          running ? h('span', { class: 'spin' }) : null, (tool.ui && tool.ui.primaryLabel) || 'Run'),
        Object.keys(tool.params || {}).length ? h('button', { class: 'btn ghost', title: 'Save these settings as a preset', onclick: () => app.savePreset(tool, args) }, icon('save', 'sm')) : null,
        h('span', { class: 'spacer' }),
        !av.ok ? h('span', { class: 'why' }, av.hint) : null),
      av.ok && av.preview && av.preview.items.length && !result ? h('ul', { class: 'preview-list' }, av.preview.items.slice(0, 6).map((i) => h('li', {}, i)), av.preview.items.length > 6 ? h('li', {}, `+${av.preview.items.length - 6} more`) : null) : null,
      renderReport(result, { onRestore: () => app.restore(result.checkpointId, tool.id), onDismiss: () => app.clearResult(tool.id) }),
      result && tool.ui && tool.ui.renderResult ? tool.ui.renderResult(result, { h, app }) : null,
      result && widgets.result[tool.id] ? widgets.result[tool.id](result, { h, app }) : null) : null);
}

module.exports = { renderTool, availability };
