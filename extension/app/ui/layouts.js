'use strict';
/**
 * Panel styles. v0.29 (docs/features/FEWER_CLEARER.md): the owner kept three styles in v0.25 — Bento
 * (default), Glass and MOE — and the six retired ones (Classic, Apple, Sidebar, Hub, Command Bar,
 * Workspace) were removed from the code: a panel that had one of them opens in Bento.
 *
 *   bento  one page by how often you use things (layoutBento.js, workflow.js)
 *   glass  the five stages as spaces, frosted cards (layoutGlass.js)
 *   moe    After Effects menu tabs (layoutAE.js) + a sidebar with menus by object and the whole Quick Bar
 */
const { h, icon } = require('./dom');
const art = require('./art');
const A = require('./actions');
const AR = require('./arrange');

const LAYOUTS = [
  { id: 'bento', label: 'Bento', hint: 'One page by how often you use things · NOW · Power tools · stages' },
  { id: 'glass', label: 'Glass', hint: 'Frosted glass over a colour field · the five stages as spaces · Now card' },
  { id: 'moe', label: 'MOE', hint: 'After Effects menu tabs and twirl-down groups, with every shortcut in a sidebar' }
];
const RETIRED = ['ae', 'studio', 'hub', 'bar', 'workspace', 'apple'];
/** The panel style; anything unknown, unset or retired is the default, Bento. */
const DEFAULT_LAYOUT = 'bento';
const layoutOf = (app) => { const l = app.services.settings.get().ui.layout; return LAYOUTS.some((x) => x.id === l) ? l : DEFAULT_LAYOUT; };

/* ---------- pieces ---------- */
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
function header(app, title, extra, menuBtn) {
  const s = app.state.get();
  const seen = app.services.settings.get().ui.seenVersion === app.services.version;
  if (menuBtn) {
    // Classic: like any AE panel — title, then the ≡ panel menu (What's new, shortcuts, pie, settings…)
    if (!seen) menuBtn.classList.add('dot');
    return h('div', { class: 'hdr lay-hdr ae-hdr' },
      h('button', { class: 'lay-logo', title: `MOE Motion AI ${app.services.version} — About`, 'aria-label': 'About MOE Motion AI', onclick: () => app.state.set({ modal: 'about' }), html: art.logo(18) }),
      h('div', { class: 'title' }, title), extra || null, h('span', { class: 'spacer' }),
      ['available', 'ready'].includes(s.update.phase) ? h('button', { class: 'hdr-update', title: `Update to ${s.update.info.version}`, onclick: () => app.go('settings') }, icon('download', 'sm'), h('span', { class: 'label' }, s.update.info.version)) : null,
      h('button', { class: 'icon-btn', title: 'History (undo MOE changes)', 'aria-label': 'History', 'aria-pressed': String(s.view === 'history'), onclick: () => app.go('history') }, icon('history', 'sm')),
      menuBtn);
  }
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
/* ---------- MOE: menus by object ---------- */
const MENUS = [
  { id: 'Keys', icon: 'easeCurve', refs: ['quick:k_easy', 'quick:k_linear', 'quick:k_hold', 'quick:curveExpo', 'quick:curveBack', 'quick:reverse', 'quick:mirror', 'quick:clone', 'quick:k_stagger', 'quick:k_trimKeys', 'tile:expressions/x-loopCycle', 'tile:expressions/x-loopPingPong'], open: [['kit', 'Ease panel']] },
  { id: 'Layer', icon: 'layers', refs: ['quick:anchorC', 'quick:anchorB', 'quick:centerAnchor', 'quick:alignH', 'quick:alignV', 'quick:distH', 'quick:distV', 'quick:parentNull', 'quick:k_parent', 'quick:flipH', 'quick:flipV', 'quick:precompose', 'quick:separate', 'quick:k_excite', 'tile:expressions/x-wiggle', 'quick:k_delay', 'quick:k_stare', 'quick:k_trash'], open: [['animate', 'Motion presets'], ['kit', 'Toolbox']] },
  { id: 'Text', icon: 'type', refs: ['quick:typewriter', 'quick:counter', 'tile:animate/riseIn', 'tile:animate/cascadeIn', 'tile:animate/fadeIn', 'tile:animate/fadeOut'], open: [['text', 'Text section'], ['brand', 'Brand']] },
  { id: 'Shape', icon: 'shapes', refs: ['tile:animate/trimDraw', 'tile:animate/trimErase', 'tile:animate/trimTravel', 'tile:animate/trimBoth', 'quick:k_repeat', 'tile:expressions/x-wiggle', 'tile:animate/popIn', 'tile:animate/spinIn'], open: [['shapes', 'Shapes & Icons']] },
  { id: 'Comp', icon: 'layers', refs: ['quick:revealProject', 'quick:openPrecomp', 'quick:revealFolder', 'quick:dupComp', 'quick:purge', 'tile:layout/g12', 'tile:layout/safe', 'tile:layout/thirds'], open: [['deliver', 'Deliver']] },
  { id: 'Design', icon: 'palette', refs: [], open: [['shapes', 'Shapes & Icons'], ['backgrounds', 'Backgrounds'], ['looks', 'Looks & Glass'], ['brand', 'Brand']] },
  { id: 'Layout', icon: 'grid', refs: ['tile:layout/grid', 'tile:layout/ring', 'tile:layout/honey', 'tile:layout/spiral', 'tile:zoom/punch', 'tile:zoom/smooth'], open: [['layout', 'Layout & Grid'], ['zoom', 'Zoom & Focus'], ['deliver', 'Deliver']] },
  { id: 'Finish', icon: 'layers', refs: [], open: [['compositing', 'Compositing'], ['select', 'Select'], ['quick', 'Quick Bar'], ['tools', 'My Tools']] },
  { id: 'AI', icon: 'spark', refs: ['cmd:copilot', 'cmd:search'], open: [['expressions', 'Expressions']] }
];
/** Which menu the selection points to (it is only highlighted — nothing moves). */
const MENU_FOR = { keys: 'Keys', layer: 'Layer', layers: 'Layer', text: 'Text', shapes: 'Shape', shapesMany: 'Shape', none: 'Comp' };
function menuPopover(app, st) {
  const m = MENUS.find((x) => x.id === st.id);
  if (!m) return null;
  const close = () => app.state.set({ layMenu: null });
  const items = resolveAll(m.refs);
  return h('div', { class: 'overlay qb-overlay', onmousedown: (e) => { if (e.target.classList.contains('overlay')) close(); } },
    h('div', { class: 'lay-drop', role: 'menu', 'aria-label': `${m.id} tools`, style: Object.assign({ top: `${st.top}px`, maxWidth: `${Math.min(440, st.maxW)}px` }, st.right != null ? { right: `${st.right}px` } : { left: `${st.left}px` }), onclick: (e) => { if (e.target.closest && e.target.closest('button')) close(); } },
      // v0.43 (SMART_ARRANGE): families stay together and wrap as one unit (Flip H | Flip V, Align H | V …)
      items.length ? h('div', { class: 'lay-acts flow' }, AR.runs(AR.group(m.refs).filter((r) => A.resolve(r))).map((run) => { const btns = run.map((r) => actBtn(app, A.resolve(r))); return run.length > 1 ? h('div', { class: 'fam', role: 'group', 'aria-label': AR.familyOf(run[0]).name, style: { '--n': String(run.length) } }, btns) : btns[0]; })) : null,
      h('div', { class: 'lay-drop-open' }, m.open.map(([id, label]) => h('button', { class: 'btn ghost sm', 'data-key': `o-${id}`, onclick: () => app.go(id) }, icon('chev', 'xs'), label)))));
}

/* ============ Recommended — MOE: the best part of each proposal ============
 * Command Bar's menus by object (the one for the selection lights up — context without moving
 * anything), ONE bar you own (the Quick Bar, fitted to the panel width, like KBar), and
 * Workspace's four task tabs with a fixed order and a crumb. No second context area and no
 * bottom bar: three rows above the content, so a docked panel keeps its height for the tools. */
function moe(app, s, body) {
  // v0.25 (owner): the same tabs and twirl-down groups as Classic, and EVERY shortcut in a sidebar
  // instead of two rows on top — menus by object (the one for the selection lit) + the whole Quick Bar
  // (no "+N": every button, with its name when the sidebar is open wide).
  const p = require('./layoutAE').build(app, s, body);
  p.top = p.top.slice(1); // the Quick Bar strip moves into the sidebar
  p.side = moeRail(app, s);
  p.overlay = s.layMenu ? menuPopover(app, s.layMenu) : p.overlay;
  return p;
}
let railDrag = null;
// one picture per menu in the sidebar (the top-row menus shared the layers icon)
const RAIL_ICON = { Comp: 'layout', Layout: 'grid', Finish: 'download', AI: 'spark' };
/** MOE's sidebar: menus by object, then every Quick Bar shortcut; ⇔ shows names (remembered). */
function moeRail(app, s) {
  const qb = require('./quickbar');
  const kind = A.profile(s.ctx);
  const wide = !!app.services.store.get('moe-rail-wide', false);
  const openMenu = (m, el) => {
    if (s.layMenu && s.layMenu.id === m.id) { app.state.set({ layMenu: null }); return; }
    const r = el.getBoundingClientRect(), box = qb.fixedBox(el.closest('.app') || document.body);
    const left = Math.round(r.right - box.left + 4);
    app.state.set({ layMenu: { id: m.id, top: Math.max(4, Math.min(Math.round(r.top - box.top), Math.round(box.height - 260))), left, right: null, maxW: Math.max(220, Math.round(box.width - left - 6)) } });
  };
  const menuBtn = (m) => h('button', {
    class: `rail-btn ${MENU_FOR[kind] === m.id ? 'hint' : ''}`, 'data-key': `rm-${m.id}`, 'aria-label': `${m.id} menu`, 'aria-haspopup': 'true', 'aria-expanded': String(!!(s.layMenu && s.layMenu.id === m.id)),
    title: `${m.id}${MENU_FOR[kind] === m.id ? ' — fits what you selected' : ''}`, onclick: (e) => openMenu(m, e.currentTarget)
  }, icon(RAIL_ICON[m.id] || m.icon, 'sm'), h('span', { class: 'rail-l' }, m.id), h('span', { class: 'rail-more', 'aria-hidden': 'true' }, '›'));
  // v0.26: drag a shortcut onto another to reorder the Quick Bar (saved; same order everywhere)
  const moveTo = (id, beforeId) => { const ids = qb.barIds(app).filter((x) => x !== id); const at = ids.indexOf(beforeId); ids.splice(at < 0 ? ids.length : at, 0, id); app.services.store.set('quick-bar', ids); app.render(); };
  const shortcut = (a) => h('button', {
    class: 'rail-btn', 'data-key': `rq-${a.id}`, 'aria-label': a.label, title: `${a.label}\nRight-click: options · drag to reorder`, disabled: !!s.running, draggable: 'true',
    ondragstart: (e) => { railDrag = a.id; try { e.dataTransfer.setData('text/plain', a.id); e.dataTransfer.effectAllowed = 'move'; } catch (_) { /* old CEP */ } },
    ondragover: (e) => { if (railDrag && railDrag !== a.id) { e.preventDefault(); e.currentTarget.classList.add('drop-before'); } },
    ondragleave: (e) => e.currentTarget.classList.remove('drop-before'),
    ondrop: (e) => { e.preventDefault(); e.currentTarget.classList.remove('drop-before'); const id = railDrag; railDrag = null; if (id && id !== a.id) moveTo(id, a.id); },
    ondragend: () => { railDrag = null; },
    onclick: (e) => (e.altKey ? qb.openOptions(app, a) : qb.run(app, a)), oncontextmenu: (e) => { e.preventDefault(); qb.openOptions(app, a); }
  }, icon(a.icon || 'bolt', 'sm'), h('span', { class: 'rail-l' }, a.label));
  return h('nav', { class: `moe-rail ${wide ? 'wide' : ''}`, 'data-key': 'moe-rail', 'aria-label': 'Shortcuts' },
    h('button', { class: 'rail-btn rail-toggle', 'data-key': 'rail-toggle', 'aria-label': wide ? 'Show icons only' : 'Show names', title: wide ? 'Icons only' : 'Show names', 'aria-pressed': String(wide), onclick: () => { app.services.store.set('moe-rail-wide', !wide); app.render(); } }, icon('chev', `xs rail-chev ${wide ? 'open' : ''}`), h('span', { class: 'rail-l' }, 'Shortcuts')),
    h('div', { class: 'rail-cap' }, h('span', { class: 'rail-l' }, 'By object')),
    MENUS.map(menuBtn),
    h('div', { class: 'rail-sep', 'aria-hidden': 'true' }),
    h('div', { class: 'rail-cap' }, h('span', { class: 'rail-l' }, 'Quick Bar')),
    qb.barIds(app).map(qb.byId).filter(Boolean).map(shortcut),
    h('button', { class: 'rail-btn rail-edit', 'data-key': 'rail-edit', 'aria-label': 'Customize shortcuts', title: 'Add, remove or reorder shortcuts (Quick Bar editor)', onclick: () => app.go('quick') }, icon('edit', 'sm'), h('span', { class: 'rail-l' }, 'Customize')));
}

/** Build a style's parts: { top[], title, titleExtra, content, bottom, side, overlay, header }. */
function build(app, s, layout, body) {
  const parts = layout === 'moe' ? moe(app, s, body) : require(layout === 'glass' ? './layoutGlass' : './layoutBento').build(app, s, body);
  parts.header = header(app, parts.title, parts.titleExtra, parts.menuBtn);
  return parts;
}

module.exports = { LAYOUTS, RETIRED, DEFAULT_LAYOUT, layoutOf, build, MENUS, MENU_FOR };
