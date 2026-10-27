'use strict';
/**
 * Panel shell + UI controller. Owns UI state and translates user actions into
 * service calls. All project changes go through services.executor.
 */
const { h, icon, clear, morph } = require('./dom');
const { createState } = require('./state');
const palette = require('./palette');
const copilot = require('./copilot');
const quickbar = require('./quickbar');
const studio = require('./studio/sections');
const library = require('./studio/library');
const chrome = require('./chrome');
const art = require('./art');
const theme = require('./theme');
const views = {
  motion: require('./views/motion'),
  expressions: require('./views/expressions'),
  tools: require('./views/tools'),
  favorites: require('./views/favorites'),
  history: require('./views/history'),
  settings: require('./views/settings'),
  diagnostics: require('./views/diagnostics'),
  // Compositing lists its tools classically; glass lives in Looks & Glass.
  compositing: { render: (app) => require('./views/motion').renderCategory(app, 'compositing', (t) => !/^glass\./.test(t.id)) },
  text: require('./views/text'),
  brand: require('./views/brand'),
  select: require('./views/select'),
  quick: { render: (app) => quickbar.view(app) },
  deliver: require('./views/deliver'),
  home: require('./views/home'),
  shapes: require('./views/shapes')
};
// Studio library sections (tiles + inspector).
for (const sec of studio.SECTIONS.filter((x) => x.kind === 'library')) views[sec.id] = { render: (app) => library.render(app, sec) };

// Studio sidebar: creative sections, then helpers; utilities at the bottom. Diagnostics opens from Settings / search.
const MAIN = studio.NAV.map((id) => { const x = studio.byId(id); return [x.id, x.label, x.icon]; });
/** Ctrl 1–6: Home + the workspaces. */
const JUMPS = ['home', ...studio.WORKSPACES.map((w) => w.id)];
const SECONDARY = studio.UTILITY;
const resolveView = (v) => studio.ALIAS[v] || v;
const TOAST_ICON = { ok: 'check', err: 'x', warn: 'pulse', info: 'info' };

function createApp(root, services, env = {}) {
  if (services.settings.get().ui.motionV !== 2) {
    // v0.6.2: "Calm" becomes the default (v0.6.0/0.6.1 saved "full" for everyone).
    const m = services.settings.get().ui.motion;
    services.settings.update({ ui: { motion: !m || m === 'full' ? 'calm' : m, motionV: 2 } });
    theme.apply(services.settings.get().ui);
  }
  const ui = services.settings.get().ui;
  const app = {
    services,
    env,
    state: createState({
      view: resolveView(ui.workspace || 'home'),
      ctx: null, hostError: null, hostInfo: null,
      running: null, results: {}, args: {}, open: {}, advanced: {},
      expr: { code: '', assist: { mode: 'generate', request: '', result: null } },
      factory: { description: '', draft: null, busy: false, error: null },
      copilot: { open: false, request: '', phase: 'idle', validated: null, progress: {}, run: null, error: null },
      keyStatus: null, toast: null, toastKind: null, modal: null, update: { phase: 'idle' }, compact: false, wide: false
    })
  };

  let scrollTop = 0;
  let toastTimer = null;

  /* ---------- rendering ---------- */
  app.stats = { renders: 0, ctxReads: 0, ctxMs: 0, deferred: 0 };
  app.render = function render() {
    app.stats.renders++;
    const s = app.state.get();
    const content = root.querySelector('.content');
    if (content) scrollTop = content.scrollTop;
    // Keep focus, caret and uncommitted text of keyed fields across re-renders.
    const active = document.activeElement;
    const fk = active && active.getAttribute && active.getAttribute('data-fk');
    const kept = fk ? { fk, value: active.value, a: active.selectionStart, b: active.selectionEnd } : null;
    const hiddenSections = services.settings.get().ui.hiddenSections || [];
    const isSection = (id) => s.view === id || (id === 'settings' && s.view === 'diagnostics');
    const navBtn = ([id, label, ic]) => h('button', { class: 'nav-btn', role: 'tab', 'aria-selected': String(isSection(id)), title: label, 'aria-label': label, onclick: () => app.go(id) }, icon(ic), h('span', { class: 'nav-label' }, label));
    const current = [...MAIN, ...SECONDARY, ['diagnostics', 'Diagnostics']].find(([id]) => id === s.view) || MAIN[0];
    const ws = studio.workspaceOf(s.view);
    const visibleItems = (w) => w.items.filter((id) => !hiddenSections.includes(id) || s.view === id);
    const wsBtn = (w) => h('button', { class: 'nav-btn', role: 'tab', 'aria-selected': String(ws === w), title: `${w.label} — ${w.items.map((id) => studio.byId(id).label).join(' · ')}`, 'aria-label': w.label, onclick: () => app.goWorkspace(w.id) }, icon(w.icon), h('span', { class: 'nav-label' }, w.label));
    const tabs = ws && visibleItems(ws).length > 1 ? h('div', { class: 'ws-tabs', role: 'tablist', 'aria-label': `${ws.label} sections` }, visibleItems(ws).map((id) => {
      const sec = studio.byId(id);
      return h('button', { role: 'tab', 'aria-selected': String(s.view === id), 'data-key': `wst-${id}`, onclick: () => app.go(id) }, icon(sec.icon, 'sm'), h('span', {}, sec.label));
    })) : null;
    const client = clientCard(s);
    const seen = services.settings.get().ui.seenVersion === services.version;
    const appEl = h('div', { class: `app ${s.compact ? 'compact' : ''} ${s.wide ? 'wide' : ''} ${s.navWide ? 'nav-wide' : ''} ${s.tilesCompact ? 'tiles-compact' : ''} ${(studio.byId(s.view) || {}).kind === 'library' || s.view === 'text' ? 'has-actbar' : ''}` },
      h('nav', { class: 'sidebar', role: 'tablist', 'aria-label': 'Sections' },
        h('button', { class: 'sb-brand', title: `MOE Motion AI ${services.version} — About`, onclick: () => app.state.set({ modal: 'about' }) }, h('span', { class: 'brand-mark', html: art.logo(22) }), h('span', { class: 'nav-label' }, h('span', { class: 'sb-name' }, 'MOE Studio'), h('span', { class: 'sb-ver' }, services.version))),
        h('div', { class: 'sb-scroll' },
          navBtn(MAIN[0]),
          h('div', { class: 'sb-group-h', 'aria-hidden': 'true' }, h('span', { class: 'nav-label' }, 'Workspaces')),
          studio.WORKSPACES.filter((w) => visibleItems(w).length).map(wsBtn)),
        h('span', { class: 'spacer' }),
        client,
        h('div', { class: 'sb-utility' }, SECONDARY.map(navBtn))),
      h('div', { class: 'main' },
        h('div', { class: 'hdr' },
          h('span', { class: 'hdr-ic' }, icon(ws ? ws.icon : current[2] || 'home', 'sm')),
          h('div', { class: 'title' }, ws ? ws.label : current[1]),
          h('span', { class: 'spacer' }),
          ['available', 'ready'].includes(s.update.phase) ? h('button', { class: 'hdr-update', title: `Update to ${s.update.info.version}`, onclick: () => app.go('settings') }, icon('download', 'sm'), h('span', { class: 'label' }, s.update.info.version)) : null,
          h('button', { class: `icon-btn hdr-new ${seen ? '' : 'dot'}`, title: "What's new", 'aria-label': "What's new", onclick: () => app.state.set({ modal: 'whatsnew' }) }, icon('gift', 'sm')),
          h('button', { class: 'icon-btn', title: 'Shortcuts (?)', 'aria-label': 'Keyboard shortcuts', onclick: () => app.state.set({ modal: 'shortcuts' }) }, icon('keyboard', 'sm')),
          h('button', { class: 'icon-btn hdr-pie', title: 'Pie menu (hold Q, or hold the right mouse button)', 'aria-label': 'Pie menu', onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); app.openPie(r.left + r.width / 2, r.bottom + 120, { mode: 'click' }); } }, icon('pie', 'sm')),
          h('button', { class: 'search-btn', title: 'Search tools (Ctrl+K)', onclick: () => palette.open(app) }, icon('search', 'sm'), h('span', { class: 'label' }, 'Search'), h('span', { class: 'kbd' }, 'Ctrl K'))),
        contextStrip(s),
        quickbar.strip(app),
        tabs,
        h('div', { class: 'content' }, chrome.banner(app, s.view), (views[s.view] || views.home).render(app)),
        copilot.render(app)),
      quickbar.popover(app),
      s.toast ? h('div', { class: `toast ${s.toastKind || ''}`, role: 'status' }, s.toastKind ? h('span', { class: 'toast-ic' }, icon(TOAST_ICON[s.toastKind] || 'info', 'sm')) : null, h('span', {}, s.toast)) : null,
      s.modal ? chrome.sheet(app, s.modal) : null);
    // Update in place: what is on screen stays the same element (no flicker, clicks never lost).
    if (root.firstChild && root.firstChild.classList && root.firstChild.classList.contains('app')) morph(root.firstChild, appEl);
    else { clear(root); root.appendChild(appEl); }
    // Calm / reduced motion: illustrations hold still (SMIL paused) — fewer repaints inside AE.
    if (theme.stillArt()) root.querySelectorAll('svg.moe-art').forEach((s) => { if (s.pauseAnimations && !s.__paused) { s.pauseAnimations(); try { s.setCurrentTime(2.2); } catch (e) { /* older engines */ } s.__paused = true; } });
    else root.querySelectorAll('svg.moe-art').forEach((s) => { if (s.__paused) { s.unpauseAnimations(); s.__paused = false; } });
    const c2 = root.querySelector('.content');
    if (c2) c2.scrollTop = scrollTop;
    if (!app._densityPending) { app._densityPending = true; setTimeout(() => { app._densityPending = false; app.applyDensity(); }, 0); }
    if (kept) {
      const el = root.querySelector(`[data-fk="${kept.fk}"]`);
      if (el) {
        el.value = kept.value;
        el.focus();
        try { el.setSelectionRange(kept.a, kept.b); } catch (e) { /* not a text field */ }
      }
    }
  };

  /** Active client (Brand Kit) — a click opens Brand; colours also feed Glass tints and previews. */
  function clientCard(s) {
    const brands = services.brands.list();
    if (!brands.length) return h('button', { class: 'sb-client empty', title: 'Add a client in Brand', onclick: () => app.go('brand') }, icon('brand'), h('span', { class: 'nav-label' }, 'Add client'));
    const b = brands.find((x) => x.id === services.store.get('active-client', null)) || brands[0];
    return h('button', { class: 'sb-client', title: `Client: ${b.name} — open Brand`, onclick: () => app.go('brand') },
      h('span', { class: 'sb-kicker nav-label' }, 'CLIENT'),
      h('span', { class: 'sb-client-name nav-label' }, b.name),
      h('span', { class: 'sb-swatches' }, b.colors.slice(0, 5).map((c) => h('span', { class: 'sb-sw', style: { background: c.hex } }))));
  }

  /** One line for the strip: which file/line or what kind of failure. */
  function shortReason(msg) {
    const m = String(msg || '');
    const file = /host\/[\w/]+\.jsx line \S+/.exec(m);
    if (file) return `· ${file[0]}`;
    if (/did not answer/.test(m)) return '· AE is busy (render / dialog?)';
    if (/EvalScript error/.test(m)) return '· ExtendScript could not run';
    return m ? `· ${m.slice(0, 60)}${m.length > 60 ? '…' : ''}` : '';
  }

  function contextStrip(s) {
    if (s.hostError) {
      return h('div', { class: 'ctx ctx-err', title: s.hostError },
        h('span', { class: 'dot err' }), h('span', { class: 'comp' }, 'After Effects not connected'),
        h('span', { class: 'ctx-reason' }, shortReason(s.hostError)), h('span', { class: 'spacer' }),
        h('button', { class: 'btn ghost ctx-btn', title: 'Show the full error and copy a report', onclick: () => app.go('diagnostics') }, 'Details'),
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
      s.last ? h('button', { class: 'ctx-repeat', title: `Repeat “${s.last.label}” on the current selection (F4)`, disabled: !!s.running, onclick: () => app.repeatLast() }, icon('repeat', 'sm'), h('span', { class: 'ctx-repeat-l' }, s.last.label)) : null,
      h('button', { class: 'icon-btn', title: 'Refresh selection', onclick: () => app.refreshContext(true) }, icon('refresh', 'sm')));
  }

  /*
   * Render scheduling: state changes in one tick are coalesced into one render, and nothing
   * re-renders between pointer-down and pointer-up (the press finishes on the same element,
   * so the click always registers). The deferred render runs right after the click.
   */
  let renderQueued = false, pressing = false, pendingAfterPress = false;
  app.scheduleRender = () => {
    if (pressing) { pendingAfterPress = true; app.stats.deferred++; return; }
    if (renderQueued) return;
    renderQueued = true;
    Promise.resolve().then(() => { renderQueued = false; if (pressing) { pendingAfterPress = true; return; } app.render(); });
  };
  app.state.sub(() => app.scheduleRender());
  document.addEventListener('pointerdown', () => { pressing = true; }, true);
  const release = () => { if (!pressing) return; setTimeout(() => { pressing = false; if (pendingAfterPress) { pendingAfterPress = false; app.scheduleRender(); } }, 0); };
  document.addEventListener('pointerup', release, true);
  document.addEventListener('pointercancel', release, true);
  window.addEventListener('blur', release);

  /** kind: 'ok' | 'err' | 'warn' | 'info' (optional; adds an icon and colour). */
  app.toast = (msg, ms = 2600, kind = null) => {
    clearTimeout(toastTimer);
    app.state.set({ toast: msg, toastKind: kind });
    toastTimer = setTimeout(() => app.state.set({ toast: null, toastKind: null }), ms);
  };
  app.applyAppearance = () => theme.apply(services.settings.get().ui);
  /** First paint: splash (optional), then What's New once per version. */
  app.boot = () => {
    const ui = services.settings.get().ui;
    const next = () => { if (ui.seenVersion !== services.version) { app.state.set({ modal: 'whatsnew' }); services.settings.update({ ui: { seenVersion: services.version } }); } };
    if (ui.splash !== false) document.body.appendChild(chrome.splash(next)); else next();
    // Quiet update check at most twice a day, only when a feed is set.
    const up = services.settings.get().updates || {};
    if (up.autoCheck !== false && up.feedUrl && (!up.lastCheck || Date.now() - Date.parse(up.lastCheck) > 12 * 3600 * 1000)) setTimeout(() => app.checkUpdates(false), 4000);
  };

  /* ---------- navigation ---------- */
  app.go = (view) => {
    view = resolveView(view);
    // Section banners show in full on the first visit only; afterwards a one-line title (v0.7).
    const prev = app.state.get().view;
    if (prev && prev !== view) chrome.markBannerSeen(app, prev);
    app.state.set({ view });
    if (studio.NAV.includes(view)) services.settings.update({ ui: { workspace: view } });
    const w = studio.workspaceOf(view);
    if (w) services.settings.update({ ui: { wsLast: Object.assign({}, services.settings.get().ui.wsLast, { [w.id]: view }) } });
    if (view === 'settings') app.loadKeyStatus();
  };
  /** Pie menu (v0.8) at a screen point; hold = 'key' | 'mouse' | null. */
  app.openPie = (x, y, { hold = null } = {}) => require('./pie').open(app, x, y, { hold });
  /** Open a workspace on the section used last there (or its first visible section). */
  app.goWorkspace = (wsId) => {
    const w = studio.WORKSPACES.find((x) => x.id === wsId);
    if (!w) return;
    const ui = services.settings.get().ui;
    const hidden = ui.hiddenSections || [];
    const items = w.items.filter((id) => !hidden.includes(id));
    const last = (ui.wsLast || {})[wsId];
    app.go(items.includes(last) ? last : (items[0] || w.items[0]));
  };
  /** Fill a tool's settings (e.g. from an analysis or an AI suggestion) and open it — nothing runs. */
  app.prefillTool = (toolId, args) => {
    const tool = services.registry.get(toolId);
    const { defaults } = require('../../core/schema');
    app.state.set((s) => ({ args: Object.assign({}, s.args, { [toolId]: Object.assign({}, s.args[toolId] || defaults(tool.params || {}), args) }) }));
    app.openTool(tool);
    app.toast(`${tool.name} settings filled — review, then apply`);
  };
  app.toggleTool = (id, open) => app.state.set((s) => ({ open: Object.assign({}, s.open, { [id]: open }) }));
  app.openTool = (tool) => {
    let view = studio.sectionOf(tool);
    const sec = studio.byId(view);
    app.state.set((s) => {
      const patch = { view, open: Object.assign({}, s.open, { [tool.id]: true }) };
      if (sec && sec.kind === 'library') {
        const tile = sec.tiles.find((t) => t.tool === tool.id);
        const cur = Object.assign({ tab: 'library', filter: 'All', q: '' }, (s.studio || {})[sec.id]);
        // Keep settings filled by the caller (prefill): mark the tile as already filled.
        patch.studio = Object.assign({}, s.studio, { [sec.id]: tile ? Object.assign(cur, { tab: 'library', tile: tile.id, filled: tile.id, filter: 'All' }) : Object.assign(cur, { tab: 'all' }) });
      }
      if (view === 'deliver') patch.deliver = Object.assign({}, s.deliver, { tab: 'tool' });
      return patch;
    });
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
        const t0 = Date.now();
        const ctx = await services.executor.readContext();
        app.stats.ctxReads++; app.stats.ctxMs = Date.now() - t0;
        lastCtxAt = Date.now();
        const prev = JSON.stringify(app.state.get().ctx);
        if (JSON.stringify(ctx) !== prev || app.state.get().hostError) app.state.set({ ctx, hostError: null });
      } catch (e) {
        services.logger.warn('ui', 'context read failed', { code: e.code, message: e.message });
        if (app.state.get().hostError !== e.message) app.state.set({ hostError: e.message });
      } finally { ctxInFlight = null; }
    })();
    return ctxInFlight;
  };
  /* Connect to the ExtendScript side. At start-up AE can still be busy, so a failed attempt is
     retried a few times (2 s, 5 s, 10 s, 20 s); the strip shows the reason meanwhile. */
  let retryTimer = null, retries = 0;
  app.reconnect = async (auto = false) => {
    clearTimeout(retryTimer);
    if (!auto) retries = 0;
    try {
      await services.host.init();
      const info = await services.host.call('host.ping', {});
      retries = 0;
      app.state.set({ hostInfo: info, hostError: null });
      await app.refreshContext(true);
    } catch (e) {
      services.logger.error('host', 'connect failed', { code: e.code, message: e.message, attempt: retries + 1 });
      app.state.set({ hostError: e.message });
      const delays = [2000, 5000, 10000, 20000];
      if (retries < delays.length) retryTimer = setTimeout(() => app.reconnect(true), delays[retries++]);
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
  /** Tools whose last successful run can be repeated (F4): anything that changes the comp. */
  const repeatable = (tool) => tool && (tool.permissions || []).some((p) => p !== 'read') && !(tool.ai === null && tool.destructive);
  app.runTool = async (toolId, args, { resultKey, label } = {}) => {
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
      if ((r.status === 'success' || r.status === 'partial') && repeatable(services.registry.get(toolId))) {
        app.state.set({ last: { toolId, args: JSON.parse(JSON.stringify(args || {})), label: label || services.registry.get(toolId).name } });
      }
      if (r.status === 'success' && r.summary && r.checkpointId) app.toast(r.summary, 2600, 'ok');
      return r;
    } finally {
      app.state.set({ running: null });
      app.refreshContext(true);
    }
  };
  /** Repeat the last successful change on whatever is selected now (F4 / the ↻ chip). */
  app.repeatLast = async () => {
    const last = app.state.get().last;
    if (!last || app.state.get().running) return null;
    await app.refreshContext(true);
    const r = await app.runTool(last.toolId, last.args, { label: last.label });
    if (r) {
      const ok = r.status === 'success' || r.status === 'partial';
      app.toast(ok ? `${last.label} — ${r.summary || 'done'}` : `${last.label}: ${(r.errors || r.reasons || [r.status]).join(' · ')}`, ok ? 2600 : 5000, ok ? 'ok' : (r.status === 'blocked' ? 'warn' : 'err'));
    }
    return r;
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

  /* ---------- fonts (cached once per session) ---------- */
  let fontsPromise = null;
  app.fonts = () => {
    if (!fontsPromise) fontsPromise = services.host.call('fonts.list', {}).then((r) => r.fonts).catch((e) => { fontsPromise = null; throw e; });
    return fontsPromise;
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
  /** My Presets pack: saved next to the settings (data folder) and copied to the clipboard. */
  /* ---------- updates (Settings › Updates) ---------- */
  const setU = (patch) => app.state.set((s) => ({ update: Object.assign({}, s.update, patch) }));
  /** manual = user clicked "Check now" (show "up to date"); auto = quiet start-up check. */
  app.checkUpdates = async (manual = true) => {
    setU({ phase: 'checking', error: null });
    const r = await services.updater.check();
    services.settings.update({ updates: { lastCheck: new Date().toISOString() } });
    if (!r.ok) { setU({ phase: manual ? 'error' : 'idle', error: r.error }); return r; }
    if (r.newer) {
      setU({ phase: 'available', info: r.update });
      if (!manual) app.toast(`MOE Motion AI ${r.update.version} is available — Settings › Updates`, 6000, 'info');
    } else setU({ phase: 'current', info: r.update });
    return r;
  };
  app.downloadUpdate = async () => {
    const info = app.state.get().update.info;
    setU({ phase: 'downloading', progress: 0, error: null });
    const r = await services.updater.download(info, (got, total) => setU({ progress: total ? got / total : 0 }));
    if (!r.ok) { setU({ phase: 'error', error: r.error }); return r; }
    setU({ phase: 'ready', file: r.file });
    return r;
  };
  app.installUpdate = (when = 'on-close') => {
    const u = app.state.get().update;
    const r = services.updater.launch(u.file, when);
    if (!r.ok) { setU({ phase: 'error', error: r.error }); return r; }
    setU({ phase: when === 'on-close' ? 'scheduled' : 'launched' });
    app.toast(when === 'on-close' ? `MOE ${u.info.version} installs when you close After Effects` : 'Installer started — close After Effects when it asks', 6000, 'ok');
    return r;
  };
  /** Pick a downloaded Setup .exe (CEP file dialog when available, else paste a path). */
  app.installFromFile = async () => {
    let file = null;
    try {
      const r = window.cep && window.cep.fs && window.cep.fs.showOpenDialogEx ? window.cep.fs.showOpenDialogEx(false, false, 'Choose the MOE Motion AI Setup .exe', '', ['exe']) : null;
      if (r && !r.err && r.data && r.data.length) file = r.data[0];
    } catch (e) { file = null; }
    if (!file) file = await app.dialog({ title: 'Install from file', body: 'Path of a downloaded MOE-Motion-AI-Setup-x.y.z.exe', input: '', okLabel: 'Install when AE closes' });
    if (!file) return null;
    const r = services.updater.launch(String(file).trim().replace(/^"|"$/g, ''), 'on-close');
    app.toast(r.ok ? 'The installer runs when you close After Effects' : r.error, 5000, r.ok ? 'ok' : 'err');
    if (r.ok) setU({ phase: 'scheduled', info: { version: 'from file' } });
    return r;
  };

  app.exportPresets = () => {
    const json = services.presets.exportPack();
    const name = `MOE-Presets-${new Date().toISOString().slice(0, 10)}.moepack.json`;
    let where = '';
    try { const fsa = services.platform && services.platform.fs; if (fsa && fsa.join && fsa.writeText) { where = fsa.join(fsa.dataDir, name); fsa.writeText(where, json); } } catch (e) { where = ''; }
    app.copy(json);
    app.toast(where ? `Pack saved: ${where} (also copied)` : 'Pack copied to the clipboard', 5000, 'ok');
  };
  app.importPresets = async () => {
    const text = await app.dialog({ title: 'Import preset pack', body: 'Paste a MOE preset pack (JSON). Every preset is checked against its tool before it is added.', input: '', okLabel: 'Import' });
    if (!text) return;
    const r = services.presets.importPack(text);
    app.toast(r.imported ? `Imported ${r.imported} preset(s)${r.skipped.length ? ` · skipped ${r.skipped.length}` : ''}` : `Nothing imported: ${r.skipped.slice(0, 2).join(' · ')}`, 5000, r.imported ? 'ok' : 'err');
    app.render();
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
    // Auto: compact when narrow, or when the header measurably overflows (fonts/locales vary).
    const compact = d === 'compact' || (d === 'auto' && w < 340);
    const wide = d === 'expanded' || (d === 'auto' && w >= 500);
    // Studio: labelled sidebar from 600 px, inspector beside the library from 760 px.
    const navWide = w >= 600;
    const studioWide = w >= 760;
    // Tiles (Settings › Appearance): compact = 3–4 columns of smaller tiles; auto = compact under 520 px.
    const tiles = services.settings.get().ui.tiles || 'auto';
    const tilesCompact = tiles === 'compact' || (tiles === 'auto' && w < 520);
    const st = app.state.get();
    if (compact !== st.compact || wide !== st.wide || navWide !== st.navWide || studioWide !== st.studioWide || tilesCompact !== st.tilesCompact) app.state.set({ compact, wide, navWide, studioWide, tilesCompact });
  };

  /* ---------- global keys & context polling ---------- */
  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!app.paletteOpen) palette.open(app); }
    else if (e.key === '/' && !typing && !app.paletteOpen) { e.preventDefault(); palette.open(app); }
    else if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); app.openCopilot(); }
    else if (e.key === 'Escape' && app.state.get().modal) { e.preventDefault(); app.state.set({ modal: null }); }
    else if (e.key === '?' && !typing) { e.preventDefault(); app.state.set({ modal: 'shortcuts' }); }
    else if ((e.ctrlKey || e.metaKey) && /^Digit[1-9]$/.test(e.code)) {
      const hidden = services.settings.get().ui.hiddenSections || [];
      const visible = JUMPS.filter((id) => id === 'home' || studio.WORKSPACES.find((w) => w.id === id).items.some((x) => !hidden.includes(x)));
      const target = visible[Number(e.code.slice(5)) - 1];
      if (target) { e.preventDefault(); if (target === 'home') app.go('home'); else app.goWorkspace(target); }
    } else if (e.key === 'F4' && !e.ctrlKey && !e.altKey) { e.preventDefault(); app.repeatLast(); }
    else if ((e.key === 'q' || e.key === 'Q') && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && !app.paletteOpen && !app.state.get().modal) {
      const pieUi = services.settings.get().ui.pie || {};
      if (pieUi.holdQ !== false && !require('./pie').isOpen()) { e.preventDefault(); app.openPie(mouse.x, mouse.y, { hold: 'key' }); }
    }
  });
  // AE sends no selection-change events to panels: re-read on focus / hover,
  // and poll lightly only while the pointer is over the panel.
  let poll = null;
  // Selection polling is light and adaptive: only while the pointer has been over the panel in
  // the last 20 s, never while a button is pressed or right after an interaction, and slower
  // when After Effects answers slowly (each read runs on AE's main thread).
  let lastPointer = 0, lastInput = 0;
  const mouse = { x: 200, y: 200 };
  document.addEventListener('pointermove', (e) => { lastPointer = Date.now(); mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true, capture: true });
  // Right button held on the panel (not on a control with its own right-click menu, not in a field) → pie.
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 2 || require('./pie').isOpen()) return;
    const pieUi = services.settings.get().ui.pie || {};
    if (pieUi.rightHold === false) return;
    for (let n = e.target; n && n !== document; n = n.parentNode) {
      if (n.__oncontextmenu || /^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName || '') || (n.classList && n.classList.contains('overlay'))) return;
    }
    e.preventDefault();
    app.openPie(e.clientX, e.clientY, { hold: 'mouse' });
  }, true);
  document.addEventListener('pointerdown', () => { lastPointer = lastInput = Date.now(); }, true);
  document.addEventListener('keydown', () => { lastInput = Date.now(); }, true);
  let lastFocusRead = 0;
  window.addEventListener('focus', () => { if (Date.now() - lastFocusRead > 1500) { lastFocusRead = Date.now(); app.refreshContext(); } });
  const pollTick = () => {
    const now = Date.now();
    const active = now - lastPointer < 20000 && !document.hidden;
    if (active && !pressing && now - lastInput > 800) app.refreshContext();
    const ms = app.stats.ctxMs || 0;
    poll = setTimeout(pollTick, Math.min(10000, Math.max(2500, ms * 12)));
  };
  poll = setTimeout(pollTick, 2500);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => app.applyDensity()).observe(root);

  return app;
}

module.exports = { createApp };
