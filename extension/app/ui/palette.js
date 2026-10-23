'use strict';
/** Command search (Ctrl+K or /): tools, saved tools, and navigation. */
const { h, icon, clear } = require('./dom');

function commands(app) {
  // Navigation comes from the sidebar's own section list, so it never drifts from it (v0.6.5).
  const studio = require('./studio/sections');
  const nav = [
    ...studio.SECTIONS.map((x) => [x.id, x.label, `Go to ${x.label}`, x.icon]),
    ...studio.UTILITY.map(([id, label, ic]) => [id, label, `Go to ${label}`, ic]),
    ['diagnostics', 'Diagnostics', 'Host connection, logs and report', 'pulse']
  ].map(([id, name, desc, ic]) => ({ kind: 'nav', id, name, desc, icon: ic, ws: 'go', run: () => app.go(id) }));
  const extra = [
    { kind: 'cmd', id: 'refresh', name: 'Refresh selection', desc: 'Re-read the After Effects selection', icon: 'refresh', ws: 'cmd', run: () => app.refreshContext(true) },
    { kind: 'cmd', id: 'copilot', name: 'Copilot', desc: 'Describe a change in words', icon: 'spark', ws: 'ai', run: () => app.openCopilot() }
  ];
  return { nav, extra };
}

/** Library presets and text presets as search results (v0.7): Enter applies, Shift+Enter opens. */
function presetItems(app) {
  const studio = require('./studio/sections');
  const out = [];
  for (const sec of studio.SECTIONS.filter((x) => x.kind === 'library')) {
    for (const t of sec.tiles) {
      const open = () => {
        app.state.set((st) => ({ studio: Object.assign({}, st.studio, { [sec.id]: Object.assign({}, (st.studio || {})[sec.id], { tab: 'library', filter: 'All', q: '', tile: t.id, filled: null }) }) }));
        app.go(sec.id);
      };
      out.push({ kind: 'preset', id: `${sec.id}:${t.id}`, name: t.label, desc: `${sec.label} preset${t.tags.length ? ` · ${t.tags.join(', ')}` : ''}`, icon: sec.icon, ws: sec.label, open, run: () => { open(); return require('./studio/library').applyNow(app, t, sec); } });
    }
  }
  const lib = app.services.textLibrary;
  if (lib) {
    const { defaults } = require('../../core/schema');
    for (const p of lib.all()) {
      const open = () => { app.state.set((st) => ({ textLib: Object.assign({ kind: 'all', group: 'All', sample: 'en' }, st.textLib, { selected: p.id }) })); app.go('text'); };
      out.push({ kind: 'preset', id: `text:${p.id}`, name: p.name, desc: `Text preset · ${p.kind.toUpperCase()} · ${p.group}`, icon: 'type', ws: 'Text', open,
        run: async () => {
          open();
          const tool = app.services.registry.get('text.animate');
          const r = await app.runTool('text.animate', Object.assign(defaults(tool.params || {}), { presetId: p.id, duration: p.duration || 1 }), { label: `Text · ${p.name}` });
          if (r) app.toast(r.status === 'success' ? (r.summary || p.name) : `${p.name}: ${(r.errors || r.reasons || [r.status]).join(' · ')}`, 3500, r.status === 'success' ? 'ok' : 'warn');
        } });
    }
  }
  return out;
}

function results(app, q) {
  const { nav, extra } = commands(app);
  const tools = app.services.registry.search(q).map((t) => ({ kind: 'tool', id: t.id, name: t.name, desc: t.description, icon: t.icon, ws: t.category, run: () => app.openTool(t) }));
  const recipes = app.services.recipes.list().filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase())).map((r) => ({ kind: 'recipe', id: r.id, name: r.name, desc: r.description || 'Saved tool', icon: 'tools', ws: 'saved', run: () => { app.go('tools'); app.toggleTool(r.id, true); } }));
  const ql = String(q || '').trim().toLowerCase();
  const match = (x) => !ql || `${x.name} ${x.desc}`.toLowerCase().includes(ql);
  if (!ql) return [...tools, ...recipes, ...extra, ...nav].slice(0, 40);
  // With a query: presets too, best matches first (name starts with > name contains > description).
  const score = (x) => { const n = x.name.toLowerCase(); return n === ql ? 4 : n.startsWith(ql) ? 3 : n.includes(ql) ? 2 : 1; };
  const all = [...presetItems(app).filter(match), ...tools, ...recipes, ...extra.filter(match), ...nav.filter(match)];
  return all.map((x, i) => ({ x, i, s: score(x) })).sort((a, b) => b.s - a.s || a.i - b.i).map((o) => o.x).slice(0, 40);
}

function open(app) {
  let sel = 0;
  let items = results(app, '');
  const list = h('div', { class: 'pal-list', role: 'listbox' });
  const input = h('input', { placeholder: 'Search tools, presets and sections…', 'aria-label': 'Search tools and commands', spellcheck: 'false' });
  const foot = h('div', { class: 'pal-foot' }, h('span', {}, h('b', {}, 'Enter'), ' apply / open'), h('span', {}, h('b', {}, 'Shift+Enter'), ' open only'), h('span', {}, h('b', {}, 'Esc'), ' close'));
  const overlay = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === overlay) close(); } }, h('div', { class: 'palette' }, input, list, foot));
  function draw() {
    clear(list);
    if (!items.length) list.appendChild(h('div', { class: 'empty' }, 'No matches'));
    items.forEach((it, i) => list.appendChild(h('div', { class: 'pal-item', role: 'option', 'aria-selected': String(i === sel), onmouseenter: () => mark(i), onclick: (e) => choose(i, e.shiftKey) },
      icon(it.icon || 'tools', 'sm'), h('span', { class: 'pn' }, it.name), h('span', { class: 'pd' }, it.desc), it.kind === 'preset' ? h('span', { class: 'pal-apply' }, icon('play', 'xs'), 'apply') : null, h('span', { class: 'ws' }, it.ws))));
    const cur = list.children[sel];
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }
  // Hover only moves the highlight. Redrawing the list here replaced the row under the
  // pointer between mouse-down and mouse-up, so mouse clicks on results were lost (v0.6.5).
  function mark(i) {
    sel = i;
    [...list.children].forEach((el, k) => el.setAttribute('aria-selected', String(k === sel)));
  }
  function choose(i, openOnly) { const it = items[i]; close(); if (it) (openOnly && it.open ? it.open : it.run)(); }
  function close() { overlay.remove(); app.paletteOpen = false; }
  input.addEventListener('input', () => { items = results(app, input.value); sel = 0; draw(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(sel, e.shiftKey); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  document.body.appendChild(overlay);
  app.paletteOpen = true;
  draw();
  input.focus();
}

module.exports = { open, results };
