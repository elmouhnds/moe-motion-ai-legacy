'use strict';
/**
 * Panel shell + UI controller. Owns UI state and translates user actions into
 * service calls. All project changes go through services.executor.
 */
const { h, icon, clear } = require('./dom');
const { createState } = require('./state');
const palette = require('./palette');
const copilot = require('./copilot');
const views = {
  motion: require('./views/motion'),
  expressions: require('./views/expressions'),
  tools: require('./views/tools'),
  favorites: require('./views/favorites'),
  history: require('./views/history'),
  settings: require('./views/settings'),
  diagnostics: require('./views/diagnostics')
};

const MAIN = [['motion', 'Motion', 'motion'], ['expressions', 'Expressions', 'expr'], ['tools', 'Tools', 'tools']];
const SECONDARY = [['favorites', 'Favorites', 'star'], ['history', 'History', 'history'], ['settings', 'Settings', 'gear'], ['diagnostics', 'Diagnostics', 'pulse']];

function createApp(root, services, env = {}) {
  const ui = services.settings.get().ui;
  const app = {
    services,
    env,
    state: createState({
      view: ui.workspace || 'motion',
      ctx: null, hostError: null, hostInfo: null,
      running: null, results: {}, args: {}, open: {}, advanced: {},
      expr: { code: '', assist: { mode: 'generate', request: '', result: null } },
      factory: { description: '', draft: null, busy: false, error: null },
      copilot: { open: false, request: '', phase: 'idle', validated: null, progress: {}, run: null, error: null },
      keyStatus: null, toast: null, compact: false, wide: false
    })
  };

  let scrollTop = 0;
  let toastTimer = null;

  /* ---------- rendering ---------- */
  app.render = function render() {
    const s = app.state.get();
    const content = root.querySelector('.content');
    if (content) scrollTop = content.scrollTop;
    // Keep focus, caret and uncommitted text of keyed fields across re-renders.
    const active = document.activeElement;
    const fk = active && active.getAttribute && active.getAttribute('data-fk');
    const kept = fk ? { fk, value: active.value, a: active.selectionStart, b: active.selectionEnd } : null;
    clear(root);
    const tab = ([id, label, ic]) => h('button', { class: 'tab', role: 'tab', 'aria-selected': String(s.view === id), title: label, onclick: () => app.go(id) }, icon(ic), h('span', { class: 'label' }, label));
    const sec = ([id, label, ic]) => h('button', { class: 'icon-btn', 'aria-pressed': String(s.view === id), title: label, 'aria-label': label, onclick: () => app.go(s.view === id ? 'motion' : id) }, icon(ic));
    const appEl = h('div', { class: `app ${s.compact ? 'compact' : ''} ${s.wide ? 'wide' : ''}` },
      h('div', { class: 'hdr', role: 'tablist' },
        h('div', { class: 'brand', title: `MOE Motion AI ${services.version}` }, 'M'),
        h('div', { class: 'tabs' }, MAIN.map(tab)),
        h('span', { class: 'spacer' }),
        h('button', { class: 'search-btn', title: 'Search tools (Ctrl+K)', onclick: () => palette.open(app) }, icon('search', 'sm'), h('span', { class: 'label' }, 'Search'), h('span', { class: 'kbd' }, 'Ctrl K')),
        SECONDARY.map(sec)),
      contextStrip(s),
      h('div', { class: 'content' }, (views[s.view] || views.motion).render(app)),
      copilot.render(app),
      s.toast ? h('div', { class: 'toast', role: 'status' }, s.toast) : null);
    root.appendChild(appEl);
    const c2 = root.querySelector('.content');
    if (c2) c2.scrollTop = scrollTop;
    if (kept) {
      const el = root.querySelector(`[data-fk="${kept.fk}"]`);
      if (el) {
        el.value = kept.value;
        el.focus();
        try { el.setSelectionRange(kept.a, kept.b); } catch (e) { /* not a text field */ }
      }
    }
  };

  function contextStrip(s) {
    if (s.hostError) {
      return h('div', { class: 'ctx' }, h('span', { class: 'dot err' }), h('span', { class: 'comp' }, 'After Effects not connected'), h('span', { class: 'spacer' }),
        h('button', { class: 'icon-btn', title: 'Reconnect', onclick: () => app.reconnect() }, icon('refresh', 'sm')));
    }
    const c = s.ctx;
    if (!c) return h('div', { class: 'ctx' }, h('span', { class: 'dot' }), 'Reading selection…');
    if (!c.comp) {
      return h('div', { class: 'ctx' }, h('span', { class: 'dot live' }), h('span', { class: 'comp' }, c.project ? 'No active composition' : 'No project open'), h('span', { class: 'spacer' }),
        h('button', { class: 'icon-btn', title: 'Refresh selection', onclick: () => app.refreshContext(true) }, icon('refresh', 'sm')));
    }
    const keys = c.properties.reduce((n, p) => n + p.selectedKeys.length, 0);
    const fps = Math.round(c.comp.frameRate * 1000) / 1000;
    return h('div', { class: 'ctx', title: c.truncated ? 'Large selection: only the first part is read (see Settings › Performance)' : '' },
      h('span', { class: 'dot live' }),
      h('span', { class: 'comp' }, c.comp.name),
      h('span', { class: 'chip opt' }, `${fps} fps`),
      h('span', { class: 'sep' }, '·'),
      h('span', { class: 'chip' }, h('b', {}, c.layers.length + (c.truncated ? '+' : '')), ' lyr'),
      h('span', { class: 'chip' }, h('b', {}, c.properties.length), ' prop'),
      h('span', { class: 'chip' }, h('b', {}, keys), ' keys'),
      h('span', { class: 'spacer' }),
      h('button', { class: 'icon-btn', title: 'Refresh selection', onclick: () => app.refreshContext(true) }, icon('refresh', 'sm')));
  }

  app.state.sub(() => app.render());

  app.toast = (msg, ms = 2600) => {
    clearTimeout(toastTimer);
    app.state.set({ toast: msg });
    toastTimer = setTimeout(() => app.state.set({ toast: null }), ms);
  };

  /* ---------- navigation ---------- */
  app.go = (view) => {
    app.state.set({ view });
    if (MAIN.some(([id]) => id === view)) services.settings.update({ ui: { workspace: view } });
    if (view === 'settings') app.loadKeyStatus();
  };
  app.toggleTool = (id, open) => app.state.set((s) => ({ open: Object.assign({}, s.open, { [id]: open }) }));
  app.openTool = (tool) => {
    const view = tool.category === 'expressions' && tool.id !== 'expressions.inspect' ? 'expressions' : tool.category;
    app.state.set((s) => ({ view, open: Object.assign({}, s.open, { [tool.id]: true }) }));
    setTimeout(() => { const el = root.querySelector(`[data-tool="${tool.id}"]`); if (el) el.scrollIntoView({ block: 'nearest' }); }, 0);
  };

  /* ---------- host / context ---------- */
  let ctxInFlight = null;
  let lastCtxAt = 0;
  app.refreshContext = async (force) => {
    if (ctxInFlight) return ctxInFlight;
    if (!force && Date.now() - lastCtxAt < 400) return null;
    if (services.executor.running) return null;
    ctxInFlight = (async () => {
      try {
        const ctx = await services.executor.readContext();
        lastCtxAt = Date.now();
        const prev = JSON.stringify(app.state.get().ctx);
        if (JSON.stringify(ctx) !== prev || app.state.get().hostError) app.state.set({ ctx, hostError: null });
      } catch (e) {
        services.logger.warn('ui', 'context read failed', { code: e.code, message: e.message });
        app.state.set({ hostError: e.message });
      } finally { ctxInFlight = null; }
    })();
    return ctxInFlight;
  };
  app.reconnect = async () => {
    try {
      await services.host.init();
      const info = await services.host.call('host.ping', {});
      app.state.set({ hostInfo: info, hostError: null });
      await app.refreshContext(true);
    } catch (e) {
      app.state.set({ hostError: e.message });
    }
  };

  /* ---------- dialogs ---------- */
  app.dialog = ({ title, body, input, okLabel = 'OK', danger }) => new Promise((resolve) => {
    const field = input !== undefined ? h('input', { class: 'txt', value: input, spellcheck: 'false' }) : null;
    const done = (v) => { overlay.remove(); resolve(v); };
    const overlay = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === overlay) done(null); } },
      h('div', { class: 'palette', style: { padding: '12px' } },
        h('div', { class: 'tn', style: { fontWeight: 600, marginBottom: '6px' } }, title),
        body ? (Array.isArray(body) ? h('ul', { class: 'preview-list' }, body.map((b) => h('li', {}, b))) : h('div', { class: 'why' }, body)) : null,
        field ? h('div', { style: { marginTop: '8px' } }, field) : null,
        h('div', { class: 'actions' },
          h('button', { class: `btn primary ${danger ? 'danger' : ''}`, onclick: () => done(field ? field.value : true) }, okLabel),
          h('button', { class: 'btn ghost', onclick: () => done(null) }, 'Cancel'))));
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') done(null); if (e.key === 'Enter') done(field ? field.value : true); });
    document.body.appendChild(overlay);
    (field || overlay.querySelector('.btn.primary')).focus();
  });

  /* ---------- running tools ---------- */
  app.runTool = async (toolId, args, { resultKey } = {}) => {
    const key = resultKey || toolId;
    app.state.set({ running: toolId });
    try {
      let r = await services.executor.run(toolId, args, { origin: 'user' });
      if (r.status === 'needs-approval') {
        app.state.set({ running: null });
        const ok = await app.dialog({ title: r.preview.summary, body: [...r.preview.items.slice(0, 8), ...r.reasons], okLabel: 'Apply' });
        if (!ok) return r;
        app.state.set({ running: toolId });
        r = await services.executor.run(toolId, args, { origin: 'user', approved: true });
      }
      app.state.set((s) => ({ results: Object.assign({}, s.results, { [key]: r }) }));
      if (r.status === 'success' && r.summary && r.checkpointId) app.toast(r.summary);
      return r;
    } finally {
      app.state.set({ running: null });
      app.refreshContext(true);
    }
  };
  app.clearResult = (key) => app.state.set((s) => { const results = Object.assign({}, s.results); delete results[key]; return { results }; });
  app.restore = async (checkpointId, key) => {
    const r = await services.executor.restore(checkpointId);
    if (r.ok) { app.toast('Restored previous state'); if (key) app.clearResult(key); } else app.toast(`Restore failed: ${r.errors.join(' · ')}`, 5000);
    app.render();
    app.refreshContext(true);
  };
  app.savePreset = async (tool, args) => {
    const name = await app.dialog({ title: `Save ${tool.name} preset`, input: `My ${tool.name}`, okLabel: 'Save' });
    if (!name) return;
    services.presets.save(tool.id, name.slice(0, 40), args);
    app.render();
  };
  app.saveSnippet = async (code) => {
    const name = await app.dialog({ title: 'Save expression preset', input: 'My expression', okLabel: 'Save' });
    if (!name) return;
    services.store.update('snippets', [], (all) => [...all, { id: `snip_${Date.now().toString(36)}`, label: name.slice(0, 40), code, user: true }]);
    app.render();
  };

  /* ---------- expressions assistant ---------- */
  app.askExpression = async () => {
    const ex = app.state.get().expr;
    const r = await app.runTool('expressions.assist', { mode: ex.assist.mode, request: ex.assist.request || '' }, { resultKey: 'assist' });
    app.state.set((s) => ({ expr: Object.assign({}, s.expr, { assist: Object.assign({}, s.expr.assist, { result: r }) }) }));
  };

  /* ---------- copilot ---------- */
  const setC = (patch) => app.state.set((s) => ({ copilot: Object.assign({}, s.copilot, patch) }));
  app.openCopilot = () => setC({ open: true });
  app.closeCopilot = () => setC({ open: false });
  app.planCopilot = async () => {
    const req = (app.state.get().copilot.request || '').trim();
    if (!req) return;
    setC({ phase: 'planning', error: null, validated: null, progress: {}, run: null });
    try {
      await app.refreshContext(true);
      const ctx = app.state.get().ctx;
      const plan = await services.copilot.plan(req, ctx);
      const validated = await services.copilot.validate(plan, ctx);
      setC({ phase: validated.steps.length ? 'review' : 'idle', validated });
    } catch (e) {
      setC({ phase: 'idle', error: e.message });
    }
  };
  app.approvePlan = async () => {
    const v = app.state.get().copilot.validated;
    setC({ phase: 'running', progress: {} });
    app.state.set({ running: 'copilot' });
    const run = await services.copilot.run(v, ({ step, state, result }) => {
      setC({ progress: Object.assign({}, app.state.get().copilot.progress, { [step.index]: { state, result } }) });
    });
    app.state.set({ running: null });
    setC({ phase: 'done', run });
    app.refreshContext(true);
  };
  app.rollbackPlan = async () => {
    const run = app.state.get().copilot.run;
    const rb = await services.copilot.rollback(run.results);
    app.toast(rb.ok ? `Rolled back ${rb.restored} step(s)` : 'Some steps could not be rolled back — see History', 4000);
    setC({ phase: 'idle', validated: null, run: null, progress: {} });
    app.refreshContext(true);
  };
  app.savePlanAsRecipe = async () => {
    const v = app.state.get().copilot.validated;
    const name = await app.dialog({ title: 'Save as reusable tool', body: 'Runs again without Claude, on whatever you select.', input: v.summary.slice(0, 60), okLabel: 'Save' });
    if (!name) return;
    const r = services.recipes.fromPlan(v, name);
    app.toast(r.ok ? 'Saved to Tools' : r.errors.join(' · '));
  };

  /* ---------- tool factory ---------- */
  const setF = (patch) => app.state.set((s) => ({ factory: Object.assign({}, s.factory, patch) }));
  app.draftRecipe = async () => {
    const d = (app.state.get().factory.description || '').trim();
    if (!d) return setF({ error: 'Describe the tool you want first.' });
    setF({ busy: true, error: null, draft: null });
    try { setF({ busy: false, draft: await services.factory.draft(d) }); } catch (e) { setF({ busy: false, error: e.message }); }
  };
  app.saveDraft = () => {
    const r = services.recipes.save(app.state.get().factory.draft.recipe);
    if (r.ok) { setF({ draft: null, description: '' }); app.toast('Tool saved'); } else setF({ error: r.errors.join(' · ') });
  };
  app.preflightRecipe = async (recipe, values) => {
    const pf = await services.recipes.preflight(recipe, values);
    const message = pf.ok ? `Ready: ${pf.steps[0].preview ? pf.steps[0].preview.summary : 'all steps valid'}` : (pf.errors || pf.steps.flatMap((s) => s.errors)).join(' · ');
    app.state.set((s) => ({ results: Object.assign({}, s.results, { [recipe.id]: { ok: pf.ok, message } }) }));
  };
  app.runRecipe = async (recipe, values) => {
    app.state.set({ running: recipe.id });
    try {
      const r = await services.recipes.run(recipe, values);
      const message = r.ok ? `Done — ${r.results.length} step(s) verified` : (r.errors || r.results.filter((x) => !x.result.ok).flatMap((x) => x.result.errors || [x.result.summary])).join(' · ');
      app.state.set((s) => ({ results: Object.assign({}, s.results, { [recipe.id]: { ok: r.ok, message } }) }));
    } finally {
      app.state.set({ running: null });
      app.refreshContext(true);
    }
  };

  /* ---------- settings ---------- */
  app.loadKeyStatus = async () => app.state.set({ keyStatus: await services.platform.secrets.status() });
  app.saveKey = async (key) => {
    const k = String(key || '').trim();
    if (!k) return app.toast('Paste a key first');
    if (!/^sk-ant-/.test(k)) return app.toast('That does not look like a Claude API key (sk-ant-…)');
    try { await services.platform.secrets.setApiKey(k); app.toast('API key saved'); } catch (e) { app.toast(`Could not save key: ${e.message}`, 5000); }
    app.loadKeyStatus();
  };
  app.clearKey = async () => {
    if (!(await app.dialog({ title: 'Remove the saved API key?', okLabel: 'Remove', danger: true }))) return;
    await services.platform.secrets.clear();
    app.loadKeyStatus();
  };
  app.copy = (text) => {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } }, text);
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); app.toast('Copied'); } catch (e) { app.toast('Copy failed'); }
    ta.remove();
  };

  /* ---------- layout density ---------- */
  app.applyDensity = () => {
    const d = services.settings.get().ui.density;
    const w = root.clientWidth;
    const compact = d === 'compact' || (d === 'auto' && w < 320);
    const wide = d === 'expanded' || (d === 'auto' && w >= 500);
    const st = app.state.get();
    if (compact !== st.compact || wide !== st.wide) app.state.set({ compact, wide });
  };

  /* ---------- global keys & context polling ---------- */
  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!app.paletteOpen) palette.open(app); }
    else if (e.key === '/' && !typing && !app.paletteOpen) { e.preventDefault(); palette.open(app); }
    else if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); app.openCopilot(); }
  });
  // AE sends no selection-change events to panels: re-read on focus / hover,
  // and poll lightly only while the pointer is over the panel.
  let poll = null;
  window.addEventListener('focus', () => app.refreshContext());
  document.addEventListener('mouseenter', () => {
    app.refreshContext();
    clearInterval(poll);
    poll = setInterval(() => { if (!document.hidden) app.refreshContext(); }, 1500);
  });
  document.addEventListener('mouseleave', () => clearInterval(poll));
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => app.applyDensity()).observe(root);

  return app;
}

module.exports = { createApp };
