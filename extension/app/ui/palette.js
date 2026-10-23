'use strict';
/** Command search (Ctrl+K or /): tools, saved tools, and navigation. */
const { h, icon, clear } = require('./dom');

function commands(app) {
  // Navigation comes from the sidebar's own section list, so it never drifts from it (v0.6.5).
  const studio = require('./studio/sections');
  const nav = [
    ...studio.SECTIONS.map((x) => [x.id, x.label, `Go to ${x.label}`, x.icon]),
    ...studio.SECONDARY.map((x) => [x.id, x.label, `Go to ${x.label}`, x.icon]),
    ...studio.UTILITY.map(([id, label, ic]) => [id, label, `Go to ${label}`, ic]),
    ['diagnostics', 'Diagnostics', 'Host connection, logs and report', 'pulse']
  ].map(([id, name, desc, ic]) => ({ kind: 'nav', id, name, desc, icon: ic, ws: 'go', run: () => app.go(id) }));
  const extra = [
    { kind: 'cmd', id: 'refresh', name: 'Refresh selection', desc: 'Re-read the After Effects selection', icon: 'refresh', ws: 'cmd', run: () => app.refreshContext(true) },
    { kind: 'cmd', id: 'copilot', name: 'Copilot', desc: 'Describe a change in words', icon: 'spark', ws: 'ai', run: () => app.openCopilot() }
  ];
  return { nav, extra };
}

function results(app, q) {
  const { nav, extra } = commands(app);
  const tools = app.services.registry.search(q).map((t) => ({ kind: 'tool', id: t.id, name: t.name, desc: t.description, icon: t.icon, ws: t.category, run: () => app.openTool(t) }));
  const recipes = app.services.recipes.list().filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase())).map((r) => ({ kind: 'recipe', id: r.id, name: r.name, desc: r.description || 'Saved tool', icon: 'tools', ws: 'saved', run: () => { app.go('tools'); app.toggleTool(r.id, true); } }));
  const match = (x) => !q || `${x.name} ${x.desc}`.toLowerCase().includes(q.toLowerCase());
  return [...tools, ...recipes, ...extra.filter(match), ...nav.filter(match)].slice(0, 40);
}

function open(app) {
  let sel = 0;
  let items = results(app, '');
  const list = h('div', { class: 'pal-list', role: 'listbox' });
  const input = h('input', { placeholder: 'Search tools and commands…', 'aria-label': 'Search tools and commands', spellcheck: 'false' });
  const overlay = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === overlay) close(); } }, h('div', { class: 'palette' }, input, list));
  function draw() {
    clear(list);
    if (!items.length) list.appendChild(h('div', { class: 'empty' }, 'No matches'));
    items.forEach((it, i) => list.appendChild(h('div', { class: 'pal-item', role: 'option', 'aria-selected': String(i === sel), onmouseenter: () => mark(i), onclick: () => choose(i) },
      icon(it.icon || 'tools', 'sm'), h('span', { class: 'pn' }, it.name), h('span', { class: 'pd' }, it.desc), h('span', { class: 'ws' }, it.ws))));
    const cur = list.children[sel];
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }
  // Hover only moves the highlight. Redrawing the list here replaced the row under the
  // pointer between mouse-down and mouse-up, so mouse clicks on results were lost (v0.6.5).
  function mark(i) {
    sel = i;
    [...list.children].forEach((el, k) => el.setAttribute('aria-selected', String(k === sel)));
  }
  function choose(i) { const it = items[i]; close(); if (it) it.run(); }
  function close() { overlay.remove(); app.paletteOpen = false; }
  input.addEventListener('input', () => { items = results(app, input.value); sel = 0; draw(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(sel); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  document.body.appendChild(overlay);
  app.paletteOpen = true;
  draw();
  input.focus();
}

module.exports = { open, results };
