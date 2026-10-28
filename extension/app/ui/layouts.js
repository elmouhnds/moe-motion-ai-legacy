'use strict';
/**
 * Panel layouts (v0.16) — the three proposals from the UI study (docs/features/UI_LAYOUTS.md),
 * built from the same views and kit blocks as the Studio layout, so every tool works the same:
 *
 *   hub        Proposal 1 (Motion 4 / Motion Studio): a fixed Home (ease + anchor + align + your
 *              tools), screens in a top tab row, a slim "for this selection" strip that COPIES six
 *              actions (the original tools never move).
 *   bar        Proposal 2 (MoBar + KBar + Quick Apply): one row of menus by object
 *              (Keys · Layer · Text · Shape · Comp · Design · Layout · Finish · AI), up to three
 *              named bars you edit, search on Ctrl K; the ease graph / toolbox / libraries open in the
 *              panel area below as their own "panels".
 *   workspace  Proposal 3 (AE Properties panel + Photoshop Contextual Task Bar, made stable):
 *              a context bar that copies the 8 actions for the selection, four task tabs whose
 *              sections never move (Animate · Design · Layout · Finish), your bar at the bottom.
 *
 * Every tool keeps ONE home in each layout; context areas only copy (HCI: Findlater & McGrenere
 * 2004, Gajos et al. 2006, Sears & Shneiderman 1994). Rendering only — no host calls here.
 */
const { h, icon } = require('./dom');
const art = require('./art');
const studio = require('./studio/sections');
const A = require('./actions');
const BAR = require('../../features/quick/bar');

const LAYOUTS = [
  { id: 'studio', label: 'Studio', hint: 'Sidebar + workspaces (v0.15)' },
  { id: 'hub', label: 'Hub', hint: 'Fixed Home + screens (Motion 4 style)' },
  { id: 'bar', label: 'Command Bar', hint: 'Menus by object + your bars (MoBar / KBar style)' },
  { id: 'workspace', label: 'Workspace', hint: 'Context bar + task tabs (AE Properties style)' }
];
const layoutOf = (app) => { const l = app.services.settings.get().ui.layout; return LAYOUTS.some((x) => x.id === l) ? l : 'studio'; };

/* ---------- shared pieces ---------- */
/** One action reference (tile: / quick: / nav: / cmd:) as a button with readiness, like the pie. */
function actBtn(app, a, cls = 'lay-act') {
  const rd = a.ready(app);
  return h('button', {
    class: `${cls} ${rd.ok || a.nav ? '' : 'off'}`, 'data-key': `a-${a.id}`, 'aria-label': a.label,
    title: rd.ok || a.nav ? `${a.label} — ${a.where}` : `${a.label} — ${rd.hint}`,
    onclick: () => { if (!rd.ok && !a.nav) app.toast(`${a.label}: ${rd.hint}`, 4500, 'warn'); else a.run(app); }
  }, icon(a.icon || 'bolt', 'sm'), h('span', {}, a.label));
}
const resolveAll = (refs) => refs.map((r) => A.resolve(r)).filter(Boolean);
/** Context copies: the same 8 actions as the smart pie for this kind of selection (fixed order). */
function contextActions(app, n) {
  const kind = A.profile(app.state.get().ctx);
  return { kind, items: resolveAll(A.SETS[kind] || []).slice(0, n) };
}
function recentRow(app) {
  const reg = app.services.registry, out = [];
  for (const e of app.services.executor.history(60)) { if (out.length >= 8) break; if (!out.some((r) => r.toolId === e.toolId) && reg.get(e.toolId)) out.push(e); }
  if (!out.length) return null;
  return h('section', { class: 'lay-recent', 'data-key': 'recent', 'aria-label': 'Recent' }, h('div', { class: 'lay-h' }, 'Recent'),
    h('div', { class: 'lay-icons' }, out.map((e) => { const t = reg.get(e.toolId); return h('button', { class: 'kit-ib', 'data-key': `r-${t.id}`, title: t.name, 'aria-label': t.name, onclick: () => app.openTool(t) }, icon(t.icon || 'tools', 'sm')); })));
}
/** A section as a card: its picture, name and what is inside — a click opens it in place. */
function sectionCard(app, id, sub) {
  const sec = studio.byId(id);
  if (!sec) return null;
  return h('button', { class: 'lay-card', 'data-key': `card-${id}`, 'aria-label': `Open ${sec.label}`, onclick: () => app.go(id) },
    h('span', { class: 'lay-card-art', html: art.art(id) }),
    h('span', { class: 'lay-card-t' }, icon(sec.icon || 'tools', 'sm'), sec.label),
    h('span', { class: 'lay-card-s' }, sub || ''));
}
function counts(app) { try { return require('./chrome').counts(app); } catch (e) { return {}; } }
function groupBlock(app, name) {
  const kit = require('./views/kit');
  const g = BAR.KIT_GROUPS.find(([n]) => n === name);
  return g ? kit.toolsBlock(app, { ids: g[1], title: name, cls: 'lay-group', right: h('span', { class: 'kit-hint' }, 'right-click: options') }) : null;
}
function header(app, title, extra) {
  const s = app.state.get();
  const seen = app.services.settings.get().ui.seenVersion === app.services.version;
  return h('div', { class: 'hdr lay-hdr' },
    h('button', { class: 'lay-logo', title: `MOE Motion AI ${app.services.version} — About`, 'aria-label': 'About MOE Motion AI', onclick: () => app.state.set({ modal: 'about' }), html: art.logo(18) }),
    h('div', { class: 'title' }, title),
    extra || null,
    h('span', { class: 'spacer' }),
    ['available', 'ready'].includes(s.update.phase) ? h('button', { class: 'hdr-update', title: `Update to ${s.update.info.version}`, onclick: () => app.go('settings') }, icon('download', 'sm'), h('span', { class: 'label' }, s.update.info.version)) : null,
    h('button', { class: `icon-btn hdr-new ${seen ? '' : 'dot'}`, title: "What's new", 'aria-label': "What's new", onclick: () => app.state.set({ modal: 'whatsnew' }) }, icon('gift', 'sm')),
    h('button', { class: 'icon-btn', title: 'History', 'aria-label': 'History', 'aria-pressed': String(s.view === 'history'), onclick: () => app.go('history') }, icon('history', 'sm')),
    h('button', { class: 'icon-btn', title: 'Settings', 'aria-label': 'Settings', 'aria-pressed': String(s.view === 'settings'), onclick: () => app.go('settings') }, icon('gear', 'sm')),
    h('button', { class: 'icon-btn hdr-pie', title: 'Pie menu (hold Q, or hold the right mouse button)', 'aria-label': 'Pie menu', onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); app.openPie(r.left + r.width / 2, r.bottom + 120, { mode: 'click' }); } }, icon('pie', 'sm')),
    h('button', { class: 'search-btn', title: 'Search tools (Ctrl+K)', 'aria-label': 'Search tools', onclick: () => require('./palette').open(app) }, icon('search', 'sm'), h('span', { class: 'label' }, 'Search'), h('span', { class: 'kbd' }, 'Ctrl K')));
}
const UTIL = ['favorites', 'history', 'settings', 'diagnostics'];
const tabRow = (cls, items, isOn, onPick, label) => h('div', { class: `lay-tabs ${cls}${items.length > 3 ? ' many' : ''}`, role: 'tablist', 'aria-label': label },
  items.map((t) => h('button', { role: 'tab', 'data-key': `t-${t.id}`, 'aria-selected': String(isOn(t)), title: t.title || t.label, onclick: () => onPick(t) }, t.icon ? icon(t.icon, 'sm') : null, h('span', {}, t.label))));
/** Remember the last section opened inside a screen / tab, so going back to it returns there. */
function goScreen(app, screen) {
  const last = (app.state.get().layLast || {})[screen.id];
  app.go(screen.items ? (screen.items.includes(last) ? last : screen.items[0]) : screen.id);
}
function remember(app, screenId, view) {
  const s = app.state.get();
  if ((s.layLast || {})[screenId] !== view) setTimeout(() => app.state.set({ layLast: Object.assign({}, app.state.get().layLast, { [screenId]: view }) }), 0);
}

/* ======================= Proposal 1 — Hub ======================= */
const HUB = [
  { id: 'hub-home', label: 'Home', icon: 'home', title: 'Ease, anchor, align and your tools — always the same' },
  { id: 'hub-ease', label: 'Ease', icon: 'easeCurve', title: 'The full ease editor and the curve library' },
  { id: 'hub-tools', label: 'Toolbox', icon: 'kExcite', title: 'Every motion tool, by what it does' },
  { id: 'hub-library', label: 'Library', icon: 'motion', items: ['animate', 'text', 'expressions', 'layout', 'zoom'], title: 'Presets with previews: motion, text, expressions, layouts, zoom' },
  { id: 'hub-design', label: 'Design', icon: 'palette', items: ['shapes', 'backgrounds', 'looks', 'brand'], title: 'Shapes & icons, backgrounds, looks, brand' },
  { id: 'hub-finish', label: 'Finish', icon: 'layers', items: ['compositing', 'deliver', 'quick', 'select', 'tools'], title: 'Compositing, deliver, utilities' }
];
function hub(app, s, body) {
  const kit = require('./views/kit');
  let view = s.view;
  if (view === 'home') view = 'hub-home';
  if (view === 'kit') view = 'hub-tools';
  const screen = HUB.find((x) => x.id === view || (x.items || []).includes(view)) || (UTIL.includes(view) ? null : HUB[0]);
  if (screen && screen.items) remember(app, screen.id, view);
  const { items } = contextActions(app, 6);
  let content;
  if (!screen) content = body(view);
  else if (screen.id === 'hub-home') {
    content = h('div', { class: 'view kit home-kit lay-page' }, kit.easeBlock(app), h('div', { class: 'kit-pair' }, kit.anchorBlock(app), kit.alignBlock(app)), kit.pinnedBlock(app), recentRow(app));
  } else if (screen.id === 'hub-ease') {
    const match = kit.matchPreset(kit.K.curve, app.services.store.get('kit-curves', []));
    content = h('div', { class: 'view kit lay-page' }, kit.easeBlock(app), h('section', { class: 'kit-block', 'aria-label': 'Curve library' }, h('div', { class: 'kit-h' }, h('span', { class: 'kit-t' }, 'Curve library'), h('span', { class: 'kit-hint' }, 'click: apply · Shift: in · Ctrl: out · Alt: load')), kit.curveLibrary(app, match)));
  } else if (screen.id === 'hub-tools') {
    content = h('div', { class: 'view kit toolbox lay-page' }, kit.toolsBlock(app, { title: 'Toolbox', right: h('button', { class: 'btn ghost sm', title: 'Choose the tools shown on Home', onclick: () => { kit.K.pinMode = !kit.K.pinMode; app.render(); } }, icon('star', 'xs'), kit.K.pinMode ? 'Done' : 'Pin to Home'), pinMode: kit.K.pinMode }));
  } else content = body(view);
  return {
    top: [
      tabRow('lay-screens', HUB, (t) => t === screen, (t) => goScreen(app, t), 'Screens'),
      items.length ? h('div', { class: 'lay-strip', 'data-key': 'strip', role: 'toolbar', 'aria-label': 'For this selection' }, h('span', { class: 'lay-strip-l' }, 'For this'), items.map((a) => actBtn(app, a, 'lay-chip'))) : null,
      screen && screen.items ? tabRow('lay-sub', screen.items.map((id) => { const x = studio.byId(id); return { id, label: x.label, icon: x.icon }; }), (t) => t.id === view, (t) => app.go(t.id), `${screen.label} sections`) : null
    ],
    title: screen ? screen.label : (studio.byId(view) || { label: view.charAt(0).toUpperCase() + view.slice(1) }).label,
    content
  };
}

/* ======================= Proposal 2 — Command Bar ======================= */
const MENUS = [
  { id: 'Keys', icon: 'easeCurve', refs: ['quick:k_easy', 'quick:k_linear', 'quick:k_hold', 'quick:curveExpo', 'quick:curveBack', 'quick:reverse', 'quick:mirror', 'quick:clone', 'quick:k_stagger', 'quick:k_trimKeys', 'quick:x_loopCycle', 'quick:x_loopPingPong'], open: [['bar-ease', 'Ease panel']] },
  { id: 'Layer', icon: 'layers', refs: ['quick:anchorC', 'quick:anchorB', 'quick:centerAnchor', 'quick:alignH', 'quick:alignV', 'quick:distH', 'quick:parentNull', 'quick:k_parent', 'quick:flipH', 'quick:precompose', 'quick:separate', 'quick:k_excite', 'quick:k_wiggle', 'quick:k_delay', 'quick:k_stare', 'quick:k_trash'], open: [['animate', 'Motion presets'], ['kit', 'Toolbox']] },
  { id: 'Text', icon: 'type', refs: ['quick:typewriter', 'quick:counter', 'tile:animate/riseIn', 'tile:animate/cascadeIn', 'tile:animate/fadeIn', 'tile:animate/fadeOut'], open: [['text', 'Text section'], ['brand', 'Brand']] },
  { id: 'Shape', icon: 'shapes', refs: ['quick:trimDraw', 'quick:trimErase', 'quick:trimTravel', 'quick:trimBoth', 'quick:k_repeat', 'quick:x_wiggle', 'tile:animate/popIn', 'tile:animate/spinIn'], open: [['shapes', 'Shapes & Icons']] },
  { id: 'Comp', icon: 'layers', refs: ['quick:revealProject', 'quick:revealFolder', 'quick:openPrecomp', 'quick:dupComp', 'quick:purge', 'tile:layout/g12', 'tile:layout/safe', 'tile:layout/thirds'], open: [['deliver', 'Deliver']] },
  { id: 'Design', icon: 'palette', refs: [], open: [['shapes', 'Shapes & Icons'], ['backgrounds', 'Backgrounds'], ['looks', 'Looks & Glass'], ['brand', 'Brand']] },
  { id: 'Layout', icon: 'grid', refs: ['tile:layout/grid', 'tile:layout/ring', 'tile:layout/honey', 'tile:layout/spiral', 'tile:zoom/punch', 'tile:zoom/smooth'], open: [['layout', 'Layout & Grid'], ['zoom', 'Zoom & Focus'], ['deliver', 'Deliver']] },
  { id: 'Finish', icon: 'layers', refs: [], open: [['compositing', 'Compositing'], ['select', 'Select'], ['quick', 'Quick Bar'], ['tools', 'My Tools']] },
  { id: 'AI', icon: 'spark', refs: ['cmd:copilot', 'cmd:search'], open: [['expressions', 'Expressions']] }
];
/** Which menu the selection points to (it is only highlighted — nothing moves). */
const MENU_FOR = { keys: 'Keys', layer: 'Layer', layers: 'Layer', text: 'Text', shapes: 'Shape', shapesMany: 'Shape', none: 'Comp' };
const DEFAULT_BARS = [
  ['Animate', ['k_easy', 'k_linear', 'k_hold', 'curveExpo', 'curveBack', 'reverse', 'k_stagger', 'clone']],
  ['Rig', ['k_excite', 'k_wiggle', 'k_delay', 'k_stare', 'k_swing', 'k_spin', 'parentNull', 'k_trash']],
  ['Layer', ['anchorC', 'anchorB', 'alignH', 'alignV', 'distH', 'flipH', 'precompose', 'separate']]
];
const PANELS = [{ id: 'bar-ease', label: 'Ease', icon: 'easeCurve' }, { id: 'kit', label: 'Toolbox', icon: 'kExcite' }];
function bar(app, s, body) {
  const kit = require('./views/kit');
  const qb = require('./quickbar');
  let view = s.view === 'home' ? 'bar-ease' : s.view;
  const kind = A.profile(s.ctx);
  const bars = app.services.store.get('cmd-bars', DEFAULT_BARS);
  const menuBtn = (m) => h('button', {
    class: `lay-menu ${MENU_FOR[kind] === m.id ? 'hint' : ''}`, 'data-key': `m-${m.id}`, 'aria-expanded': String(s.layMenu && s.layMenu.id === m.id), 'aria-haspopup': 'true',
    title: MENU_FOR[kind] === m.id ? `${m.id} — fits what you selected` : m.id,
    onclick: (e) => {
      if (s.layMenu && s.layMenu.id === m.id) { app.state.set({ layMenu: null }); return; }
      const r = e.currentTarget.getBoundingClientRect(), box = qb.fixedBox(e.currentTarget.closest('.app') || document.body);
      const left = Math.round(r.left - box.left), right = Math.round(box.left + box.width - r.right);
      // menus on the right half open towards the left so they never leave the panel
      app.state.set({ layMenu: { id: m.id, top: Math.round(r.bottom - box.top + 2), left: left <= box.width / 2 ? Math.max(4, left) : null, right: left > box.width / 2 ? Math.max(4, right) : null, maxW: Math.round(box.width - 8) } });
    }
  }, h('span', {}, m.id), icon('chev', 'xs'));
  const panelTabs = PANELS.concat(PANELS.some((p) => p.id === view) || UTIL.includes(view) ? [] : [{ id: view, label: (studio.byId(view) || { label: view }).label, icon: (studio.byId(view) || {}).icon || 'tools' }]);
  let content;
  if (view === 'bar-ease') content = h('div', { class: 'view kit lay-page' }, kit.easeBlock(app), h('div', { class: 'kit-pair' }, kit.anchorBlock(app), kit.alignBlock(app)));
  else if (view === 'kit') content = h('div', { class: 'view kit toolbox lay-page' }, kit.toolsBlock(app, { title: 'Toolbox' }), h('section', { class: 'kit-block', 'aria-label': 'Curve library' }, h('div', { class: 'kit-h' }, h('span', { class: 'kit-t' }, 'Curve library')), kit.curveLibrary(app, kit.matchPreset(kit.K.curve, app.services.store.get('kit-curves', [])))));
  else content = body(view);
  return {
    top: [
      h('div', { class: 'lay-menus', role: 'menubar', 'aria-label': 'Tools by object', 'data-key': 'menus' }, MENUS.map(menuBtn)),
      h('div', { class: 'lay-bars', 'data-key': 'bars', role: 'toolbar', 'aria-label': 'Your bars' },
        bars.slice(0, 3).map(([name, ids]) => h('div', { class: 'lay-barrow', 'data-key': `bar-${name}` }, h('span', { class: 'lay-bar-n' }, name), h('div', { class: 'lay-icons' }, ids.map(qb.byId).filter(Boolean).map((a) => qb.button(app, a))))),
        h('div', { class: 'lay-barrow lay-bar-edit' }, h('span', { class: 'lay-bar-n' }), h('button', { class: 'btn ghost sm', title: 'Change the buttons on your bars (Quick Bar editor)', onclick: () => app.go('quick') }, icon('edit', 'xs'), 'Edit bars'), h('span', { class: 'kit-hint' }, 'right-click a button: options'))),
      tabRow('lay-panels', panelTabs, (t) => t.id === view, (t) => app.go(t.id), 'Panel')
    ],
    title: 'MOE',
    content,
    overlay: s.layMenu ? menuPopover(app, s.layMenu) : null
  };
}
function menuPopover(app, st) {
  const m = MENUS.find((x) => x.id === st.id);
  if (!m) return null;
  const close = () => app.state.set({ layMenu: null });
  const items = resolveAll(m.refs);
  return h('div', { class: 'overlay qb-overlay', onmousedown: (e) => { if (e.target.classList.contains('overlay')) close(); } },
    h('div', { class: 'lay-drop', role: 'menu', 'aria-label': `${m.id} tools`, style: Object.assign({ top: `${st.top}px`, maxWidth: `${Math.min(440, st.maxW)}px` }, st.right != null ? { right: `${st.right}px` } : { left: `${st.left}px` }), onclick: (e) => { if (e.target.closest && e.target.closest('button')) close(); } },
      items.length ? h('div', { class: 'lay-acts' }, items.map((a) => actBtn(app, a))) : null,
      h('div', { class: 'lay-drop-open' }, m.open.map(([id, label]) => h('button', { class: 'btn ghost sm', 'data-key': `o-${id}`, onclick: () => app.go(id) }, icon('chev', 'xs'), label)))));
}

/* ======================= Proposal 3 — Selection Workspace ======================= */
const WS = [
  { id: 'wsp-animate', label: 'Animate', icon: 'motion', owns: ['animate', 'text', 'expressions', 'kit'] },
  { id: 'wsp-design', label: 'Design', icon: 'palette', owns: ['shapes', 'backgrounds', 'looks', 'brand'] },
  { id: 'wsp-layout', label: 'Layout', icon: 'grid', owns: ['layout', 'zoom', 'deliver'] },
  { id: 'wsp-finish', label: 'Finish', icon: 'layers', owns: ['compositing', 'select', 'quick', 'tools'] }
];
function workspace(app, s, body) {
  const kit = require('./views/kit');
  const qb = require('./quickbar');
  let view = s.view === 'home' ? 'wsp-animate' : s.view;
  const tab = WS.find((t) => t.id === view || t.owns.includes(view)) || null;
  const sub = tab && tab.id !== view ? view : null;
  const n = counts(app);
  const hidden = app.services.store.get('ctx-bar-hidden', false);
  const { kind, items } = contextActions(app, 8);
  let content;
  if (!tab) content = body(view);
  else if (sub) content = [h('div', { class: 'lay-crumb', 'data-key': `crumb-${sub}` }, h('button', { class: 'btn ghost sm', onclick: () => app.go(tab.id) }, icon('chev', 'xs'), tab.label), h('span', { class: 'lay-crumb-sep' }, '›'), h('span', {}, (studio.byId(sub) || { label: sub }).label)), body(sub)];
  else if (tab.id === 'wsp-animate') {
    content = h('div', { class: 'view kit lay-page' }, kit.easeBlock(app), h('div', { class: 'kit-pair' }, kit.anchorBlock(app), kit.alignBlock(app)), groupBlock(app, 'Motion rigs'), groupBlock(app, 'Keyframes'),
      h('div', { class: 'lay-cards' }, sectionCard(app, 'animate', `${n.animate || ''} animations · ${n.ease || ''} eases`), sectionCard(app, 'text', 'Text in / out, typewriter, counter'), sectionCard(app, 'expressions', `${n.expressions || ''} expressions`)));
  } else if (tab.id === 'wsp-design') {
    content = h('div', { class: 'view lay-page' }, h('div', { class: 'lay-cards' }, sectionCard(app, 'shapes', `${(n.icons || 0).toLocaleString('en-US')} icons · ${n.shapes || ''} shapes`), sectionCard(app, 'backgrounds', `${n.palettes || ''} palettes`), sectionCard(app, 'looks', `${n.looks || ''} looks`), sectionCard(app, 'brand', 'Clients, colours, fonts')));
  } else if (tab.id === 'wsp-layout') {
    content = h('div', { class: 'view kit lay-page' }, h('div', { class: 'lay-cards' }, sectionCard(app, 'layout', `${n.layout || ''} grids & arrangements`), sectionCard(app, 'zoom', `${n.zoom || ''} camera moves`), sectionCard(app, 'deliver', 'Every format at once')), groupBlock(app, 'Layers'));
  } else {
    const project = BAR.ACTIONS.filter((a) => a.group === 'Project').map((a) => a.id);
    content = h('div', { class: 'view kit lay-page' }, h('div', { class: 'lay-cards' }, sectionCard(app, 'compositing', 'Analyse, key, match, grade'), sectionCard(app, 'select', 'Select by type, name, label'), sectionCard(app, 'quick', 'Edit the Quick Bar'), sectionCard(app, 'tools', 'Your own tools')),
      h('section', { class: 'kit-block lay-group', 'aria-label': 'Project' }, h('div', { class: 'kit-h' }, h('span', { class: 'kit-t' }, 'Project')), h('div', { class: 'lay-icons' }, project.map(qb.byId).filter(Boolean).map((a) => qb.button(app, a, 'qt-tile')))),
      groupBlock(app, 'Clean up'));
  }
  if (tab && sub) remember(app, tab.id, sub);
  const pins = require('./views/kit').prefs(app).pins.filter((id) => BAR.KIT_TOOLS.includes(id));
  return {
    top: [
      hidden ? null : h('div', { class: 'lay-ctxbar', 'data-key': 'ctxbar', role: 'toolbar', 'aria-label': `For this selection: ${A.CONTEXT_LABEL[kind]}` },
        h('div', { class: 'lay-ctxbar-h' }, h('span', { class: 'lay-strip-l' }, 'For this'), h('span', { class: 'lay-ctxbar-k' }, A.CONTEXT_LABEL[kind]), h('span', { class: 'spacer' }), h('button', { class: 'icon-btn', title: 'Hide this bar (the header button brings it back)', 'aria-label': 'Hide the context bar', onclick: () => { app.services.store.set('ctx-bar-hidden', true); app.render(); } }, icon('x', 'xs'))),
        h('div', { class: 'lay-acts four' }, items.map((a) => actBtn(app, a)))),
      tabRow('lay-screens', WS, (t) => t === tab, (t) => (t === tab && sub ? app.go(t.id) : goScreen(app, { id: t.id })), 'Workspaces')
    ],
    title: tab ? tab.label : (studio.byId(view) || { label: view.charAt(0).toUpperCase() + view.slice(1) }).label,
    titleExtra: hidden ? h('button', { class: 'btn ghost sm', title: 'Show the context bar', onclick: () => { app.services.store.set('ctx-bar-hidden', false); app.render(); } }, 'For this') : null,
    content,
    bottom: h('div', { class: 'lay-foot', 'data-key': 'foot', role: 'toolbar', 'aria-label': 'Your tools' },
      h('div', { class: 'lay-icons' }, pins.map((id) => { const a = qb.byId(id); return a ? qb.button(app, a) : null; })),
      h('span', { class: 'spacer' }),
      s.last ? h('button', { class: 'btn ghost sm', title: `Repeat “${s.last.label}” (F4)`, disabled: !!s.running, onclick: () => app.repeatLast() }, icon('repeat', 'xs'), 'F4') : null,
      h('button', { class: 'icon-btn', title: 'Choose your tools (Toolbox › Pin to Home)', 'aria-label': 'Choose your tools', onclick: () => { require('./views/kit').K.pinMode = true; app.go('kit'); } }, icon('star', 'sm')))
  };
}

/** Build a layout's parts: { top[], title, titleExtra, content, bottom, overlay }. */
function build(app, s, layout, body) {
  const parts = (layout === 'hub' ? hub : layout === 'bar' ? bar : workspace)(app, s, body);
  parts.header = header(app, parts.title, parts.titleExtra);
  return parts;
}

module.exports = { LAYOUTS, layoutOf, build, HUB, MENUS, WS, DEFAULT_BARS, MENU_FOR };
