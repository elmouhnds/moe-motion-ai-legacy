'use strict';
/**
 * Panel styles. v0.29 (docs/features/FEWER_CLEARER.md): the owner kept three styles in v0.25 — Bento
 * (default), Glass and MOE — and the six retired ones (Classic, Apple, Sidebar, Hub, Command Bar,
 * Workspace) were removed from the code: a panel that had one of them opens in Bento.
 *
 *   bento  one page by how often you use things (layoutBento.js, workflow.js)
 *   glass  the five stages as spaces, frosted cards (layoutGlass.js)
 *   moe    After Effects menu tabs (layoutAE.js) + a sidebar with Select and the whole Quick Bar (v0.45: the other
 *          menus by object were the tabs again — NO_REPEATS.md)
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
    title: `${rd.ok || a.nav ? `${a.label} — ${a.where}` : `${a.label} — ${rd.hint}`}${a.hint ? `\n${a.hint}` : ''}`,
    onclick: (e) => { if (!rd.ok && !a.nav) app.toast(`${a.label}: ${rd.hint}`, 4500, 'warn'); else a.run(app, e); }
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
/* ---------- MOE: the sidebar's menus ---------- */
/*
 * v0.45 (docs/features/NO_REPEATS.md): ten menus "by object" were the tabs again (each tab already has its tools,
 * a ▾ quick menu and the selection dot) — removed.
 * v0.46 (docs/features/SIDEBAR_MENUS.md, owner: "menus as important as Select deserve to sit under it"): a sidebar
 * menu is ONE job a motion designer does many times a day from any tab, with variants that read as labelled rows
 * (never a whole tab). In the order of the work: pick the layers → link them → animate in / out → keep them alive.
 * Each row is a family side by side (Fade: In · Out), so opposites never sit apart.
 */
const ROW = (label, refs, short) => [label, refs, short];
const MENUS = [
  // v0.44 (FIND_FAST): Select — the Select group's own labelled rows (Type · Same · Comp)
  { id: 'Select', icon: 'cursor', title: 'every filter, one click (Shift adds, Alt removes)', tab: 'ae-layer', group: ['ae-layer', 'select'], refs: ['quick:selText', 'quick:selShape', 'quick:selSolid', 'quick:selNull', 'quick:selPrecomp', 'quick:selFootage', 'quick:selAdjust', 'quick:selCamLight', 'quick:selSameType', 'quick:selSameSource', 'quick:selSameLabel', 'quick:selSameName', 'quick:selAll', 'quick:selInvert', 'quick:selNone', 'quick:selBack'], open: [['select', 'Search, labels, comps, project']] },
  { id: 'Parent & Link', icon: 'link', title: 'parent to a null or as a chain, follow with delay or stare', tab: 'ae-layer', rows: [
    ROW('Parent', ['quick:parentNull', 'quick:k_parent'], ['To Null', 'Chain']),
    ROW('Follow', ['quick:k_delay', 'quick:k_stare'], ['Delay', 'Stare'])], open: [] },
  { id: 'In / Out', icon: 'fadeIn', title: 'the everyday entrances and exits, In and Out side by side, and Draw On', tab: 'ae-animate', rows: [
    ROW('Fade', ['tile:animate/fadeIn', 'tile:animate/fadeOut'], ['In', 'Out']),
    ROW('Pop', ['tile:animate/popIn', 'tile:animate/popOut'], ['In', 'Out']),
    ROW('Slide', ['tile:animate/inRL', 'tile:animate/inBT', 'tile:animate/outRL', 'tile:animate/outTB'], ['In ←', 'In ↑', 'Out ←', 'Out ↓']),
    ROW('Spin', ['tile:animate/spinIn', 'tile:animate/spinOut'], ['In', 'Out']),
    ROW('Draw', ['tile:animate/trimDraw', 'tile:animate/trimErase', 'tile:animate/trimTravel', 'tile:animate/trimBoth'], ['On', 'Erase', 'Travel', 'Both'])], open: [['animate', 'All motion presets']] },
  { id: 'Loop', icon: 'repeat', title: 'loop the keys, or keep a layer alive (wiggle, float, pendulum, pulse)', tab: 'ae-keys', rows: [
    ROW('Loop', ['tile:expressions/x-loopCycle', 'tile:expressions/x-loopPingPong', 'tile:expressions/x-loopOffset', 'tile:expressions/x-loopInOut'], ['Cycle', 'Ping-Pong', 'Offset', 'In + Out']),
    ROW('Idle', ['tile:expressions/x-wiggle', 'tile:expressions/x-float', 'tile:expressions/x-pendulum', 'tile:expressions/x-pulse'], ['Wiggle', 'Float', 'Pendulum', 'Pulse'])], open: [['expressions', 'All expressions']] },
  // v0.53 (owner: "a list like Guides — the famous guides and the social-media safe zones"): set up every new comp
  { id: 'Guides', icon: 'guides', title: 'composition lines, broadcast safe, the safe zones of TikTok / Reels / Shorts / Stories', tab: 'ae-comp', rows: [
    ROW('Lines', ['tile:layout/gpCenter', 'tile:layout/thirds', 'tile:layout/gpGolden', 'tile:layout/g12'], ['Centre', 'Thirds', 'Golden', '12 Col']),
    ROW('Safe', ['tile:layout/gpTv', 'tile:layout/safe', 'tile:layout/gpClear'], ['TV Safe', 'Margins', 'Clear']),
    ROW('Social', ['tile:layout/gpTiktok', 'tile:layout/gpReels', 'tile:layout/gpShorts', 'tile:layout/gpStories'], ['TikTok', 'Reels', 'Shorts', 'Stories'])], open: [['layout', 'All guides & grids']] }
];
MENUS.forEach((m) => { if (m.rows) m.refs = m.rows.flatMap((rw) => rw[1]); });
/** Menus removed in v0.45 and where their buttons are now (tests/norepeat.test.js checks every one is reachable). */
const RETIRED_MENUS = {
  Keys: 'Keys tab (▾) + Motion Control', Layer: 'Layer tab (▾) + Motion Control', Text: 'Animate tab › Text Animators', Shape: 'Animate tab › Draw On',
  Comp: 'Comp tab', Design: 'Design tab', Layout: 'Layer tab › Arrange, Comp tab › Guides', Finish: 'Effect tab, Customize, ≡ menu', AI: 'Assistant button, search box (Ctrl+K)'
};
function menuPopover(app, st) {
  const m = MENUS.find((x) => x.id === st.id);
  if (!m) return null;
  const close = () => app.state.set({ layMenu: null });
  const items = resolveAll(m.refs);
  return h('div', { class: 'overlay qb-overlay', onmousedown: (e) => { if (e.target.classList.contains('overlay')) close(); } },
    h('div', { class: 'lay-drop', role: 'menu', 'aria-label': `${m.id} tools`, style: Object.assign({ top: `${st.top}px`, maxWidth: `${Math.min(440, st.maxW)}px` }, st.right != null ? { right: `${st.right}px` } : { left: `${st.left}px` }), onclick: (e) => { if (e.target.closest && e.target.closest('button')) close(); } },
      // v0.43 (SMART_ARRANGE): families stay together and wrap as one unit (Flip H | Flip V, Align H | V …)
      m.group || m.rows ? (() => { const AE = require('./layoutAE'); const tab = AE.TABS.find((x) => x.id === (m.group ? m.group[0] : m.tab)); const g = m.group && tab && tab.groups.find((x) => x.id === m.group[1]); const rows = g ? g.rows : m.rows; return rows && tab ? h('div', { class: 'lay-rows' }, rows.map((rw) => AE.subRow(app, tab, rw))) : null; })()
        : items.length ? h('div', { class: 'lay-acts flow' }, AR.runs(AR.group(m.refs).filter((r) => A.resolve(r))).map((run) => { const btns = run.map((r) => actBtn(app, A.resolve(r))); return run.length > 1 ? h('div', { class: 'fam', role: 'group', 'aria-label': AR.familyOf(run[0]).name, style: { '--n': String(run.length) } }, btns) : btns[0]; })) : null,
      m.group && m.group[1] === 'select' ? h('div', { class: 'lay-drop-keys' }, require('./layoutAE').keysHint()) : null,
      m.open.length ? h('div', { class: 'lay-drop-open' }, m.open.map(([id, label]) => h('button', { class: 'btn ghost sm', 'data-key': `o-${id}`, onclick: () => app.go(id) }, icon('chev', 'xs'), label))) : null));
}

/* ============ Recommended — MOE: the best part of each proposal ============
 * Command Bar's menus by object (the one for the selection lights up — context without moving
 * anything), ONE bar you own (the Quick Bar, fitted to the panel width, like KBar), and
 * Workspace's four task tabs with a fixed order and a crumb. No second context area and no
 * bottom bar: three rows above the content, so a docked panel keeps its height for the tools. */
function moe(app, s, body) {
  // v0.25 (owner): the same tabs and twirl-down groups as Classic, and EVERY shortcut in a sidebar
  // instead of two rows on top — Select (v0.45: the only menu left) + the whole Quick Bar
  // (no "+N": every button, with its name when the sidebar is open wide).
  const p = require('./layoutAE').build(app, s, body);
  p.top = p.top.slice(1); // the Quick Bar strip moves into the sidebar
  p.side = moeRail(app, s);
  p.overlay = s.layMenu ? menuPopover(app, s.layMenu) : p.overlay;
  return p;
}
let railDrag = null;
// one picture per menu in the sidebar (the top-row menus shared the layers icon)
/** MOE's sidebar: Select, then every Quick Bar shortcut; ⇔ shows names (remembered). */
function moeRail(app, s) {
  const qb = require('./quickbar');
  const wide = !!app.services.store.get('moe-rail-wide', false);
  const openMenu = (m, el) => {
    if (s.layMenu && s.layMenu.id === m.id) { app.state.set({ layMenu: null }); return; }
    const r = el.getBoundingClientRect(), box = qb.fixedBox(el.closest('.app') || document.body);
    const left = Math.round(r.right - box.left + 4);
    app.state.set({ layMenu: { id: m.id, top: Math.max(4, Math.min(Math.round(r.top - box.top), Math.round(box.height - 260))), left, right: null, maxW: Math.max(220, Math.round(box.width - left - 6)) } });
  };
  const menuBtn = (m) => h('button', {
    class: 'rail-btn', 'data-key': `rm-${m.id === 'Select' ? 'Select' : m.id.replace(/[^A-Za-z]+/g, '')}`, 'aria-label': `${m.id} menu`, 'aria-haspopup': 'true', 'aria-expanded': String(!!(s.layMenu && s.layMenu.id === m.id)),
    title: `${m.id} — ${m.title}`, onclick: (e) => openMenu(m, e.currentTarget)
  }, icon(m.icon, 'sm'), h('span', { class: 'rail-l' }, m.id), h('span', { class: 'rail-more', 'aria-hidden': 'true' }, '›'));
  // v0.26: drag a shortcut onto another to reorder the Quick Bar (saved; same order everywhere)
  const moveTo = (id, beforeId) => { const ids = qb.barIds(app).filter((x) => x !== id); const at = ids.indexOf(beforeId); ids.splice(at < 0 ? ids.length : at, 0, id); app.services.store.set('quick-bar', ids); app.render(); };
  const shortcut = (a) => h('button', {
    class: 'rail-btn', 'data-key': `rq-${a.id}`, 'aria-label': a.label, title: `${a.label}${a.mods ? `\n${require('../../features/quick/bar').modsHint(a)}` : ''}\nRight-click: options · drag to reorder`, disabled: !!s.running, draggable: 'true',
    ondragstart: (e) => { railDrag = a.id; try { e.dataTransfer.setData('text/plain', a.id); e.dataTransfer.effectAllowed = 'move'; } catch (_) { /* old CEP */ } },
    ondragover: (e) => { if (railDrag && railDrag !== a.id) { e.preventDefault(); e.currentTarget.classList.add('drop-before'); } },
    ondragleave: (e) => e.currentTarget.classList.remove('drop-before'),
    ondrop: (e) => { e.preventDefault(); e.currentTarget.classList.remove('drop-before'); const id = railDrag; railDrag = null; if (id && id !== a.id) moveTo(id, a.id); },
    ondragend: () => { railDrag = null; },
    onclick: (e) => (e.altKey && !a.mods ? qb.openOptions(app, a) : qb.run(app, a, e)), oncontextmenu: (e) => { e.preventDefault(); qb.openOptions(app, a); }
  }, icon(a.icon || 'bolt', 'sm'), h('span', { class: 'rail-l' }, a.label));
  return h('nav', { class: `moe-rail ${wide ? 'wide' : ''}`, 'data-key': 'moe-rail', 'aria-label': 'Shortcuts' },
    h('button', { class: 'rail-btn rail-toggle', 'data-key': 'rail-toggle', 'aria-label': wide ? 'Show icons only' : 'Show names', title: wide ? 'Icons only' : 'Show names', 'aria-pressed': String(wide), onclick: () => { app.services.store.set('moe-rail-wide', !wide); app.render(); } }, icon('chev', `xs rail-chev ${wide ? 'open' : ''}`), h('span', { class: 'rail-l' }, 'Shortcuts')),
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

module.exports = { LAYOUTS, RETIRED, DEFAULT_LAYOUT, layoutOf, build, MENUS, RETIRED_MENUS };
