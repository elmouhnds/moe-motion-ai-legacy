'use strict';
/**
 * "Classic" panel layout (v0.20) — organised the way After Effects itself is, so an AE user finds
 * things where they expect them (docs/features/AE_CLASSIC_LAYOUT.md):
 *
 *   ≡ panel menu (like every AE panel)      · What's new, shortcuts, pie, Quick Bar, layout, settings…
 *   Quick Bar                                · your one row of buttons (unchanged)
 *   Tabs named after AE's menus              · Keys · Animate · Layer · Design · Effect · Comp
 *   Search (like Effects & Presets › Contains)
 *   Twirl-down groups (like Effect Controls) · ▸ Keyframe Assistant, ▸ Animate In, ▸ Align …
 *
 * Smart, not jumpy: a dot marks the tabs that fit the selection; inside a tab the groups that fit
 * it open by themselves, and whatever you open or fold is remembered per kind of selection. Groups
 * never move by themselves — only when you drag them (v0.22: your order is saved per tab; ▸ Recent holds the
 * last things you ran from the tab; ↑/↓ ←/→ Alt+↑/↓ work on the group headers). Every button is the same tool / quick action / preset as elsewhere (actions.resolve,
 * library.applyNow) — this file only arranges them. Libraries open as pages with a crumb back.
 */
const { h, icon } = require('./dom');
const A = require('./actions');
const studio = require('./studio/sections');

/* ---------- information architecture: tab → groups ---------- */
// Action groups list their refs by importance (v0.23, docs/features/DESIGN_SYSTEM.md): `hero` = primary (32 px, first row),
// the rest standard (28 px), `minor` = rare / housekeeping (24 px chips, last). hero and minor are subsets of refs.
// Group kinds: 'kit' (an existing Motion Kit block), 'acts' (quick actions), 'tiles' (library presets,
// one click applies), 'grid' (Your grid + layouts), 'links' (pages). fits = selection kinds it suits.
const SEL = { keys: 'keys', layer: 'layer', layers: 'layers', text: 'text', shapes: 'shapes', shapesMany: 'shapesMany', none: 'none' };
const TABS = [
  { id: 'ae-keys', label: 'Keys', title: 'Keyframes: ease, keyframe assistant, loops (Animation › Keyframe Assistant)', fits: ['keys'], owns: [],
    groups: [
      { id: 'ease', label: 'Ease', kind: 'kit', block: 'ease', fits: ['keys'], open: true },
      { id: 'assist', label: 'Keyframe Assistant', kind: 'acts', fits: ['keys'], hero: ['quick:k_easy', 'quick:reverse'], minor: ['quick:k_trimKeys', 'quick:selectSame'], refs: ['quick:k_easy', 'quick:reverse', 'quick:k_linear', 'quick:k_hold', 'quick:mirror', 'quick:clone', 'quick:k_stagger', 'quick:k_trimKeys', 'quick:selectSame'] },
      { id: 'loops', label: 'Loops', kind: 'acts', fits: ['keys'], hero: ['quick:x_loopCycle'], refs: ['quick:x_loopCycle', 'quick:x_loopPingPong', 'quick:x_loopOffset', 'quick:x_loopInOut'] },
      { id: 'curves', label: 'Curve Library', kind: 'curves', fits: [] }
    ] },
  { id: 'ae-animate', label: 'Animate', title: 'Animation presets, text, rigs, expressions (Animation menu)', fits: ['layer', 'layers', 'text', 'shapes', 'shapesMany'], owns: ['animate', 'text', 'expressions', 'kit'],
    groups: [
      { id: 'in', label: 'Animate In', kind: 'tiles', section: 'animate', ids: ['inRL', 'inBT', 'fadeIn', 'popIn', 'riseIn', 'cascadeIn'], more: 'animate', fits: ['layer', 'layers', 'shapes', 'shapesMany'], open: true },
      { id: 'out', label: 'Animate Out', kind: 'tiles', section: 'animate', ids: ['outRL', 'outTB', 'fadeOut', 'scaleOut', 'popOut', 'spinOut'], more: 'animate', fits: [] },
      { id: 'draw', label: 'Draw On (shapes)', kind: 'tiles', section: 'animate', ids: ['trimDraw', 'trimErase', 'trimTravel', 'trimBoth'], more: 'animate', fits: ['shapes', 'shapesMany'] },
      { id: 'text', label: 'Text Animators', kind: 'acts', fits: ['text'], refs: ['quick:typewriter', 'quick:counter'], links: [['text', 'All text animators']] },
      { id: 'rigs', label: 'Motion Rigs', kind: 'kitTools', group: 'Motion rigs', fits: ['layer'] },
      { id: 'expr', label: 'Expressions', kind: 'tiles', section: 'expressions', ids: ['x-wiggle', 'x-float', 'x-pendulum', 'x-pulse', 'x-blink', 'x-timeRotate', 'x-inertia', 'x-bounceBack', 'x-orbit'], more: 'expressions', links: [['expressions', 'Expression editor']], fits: [] }
    ] },
  { id: 'ae-layer', label: 'Layer', title: 'Align, anchor, transform, parent, arrange (Layer menu + Align panel)', fits: ['layer', 'layers', 'shapes', 'shapesMany', 'text'], owns: ['layout', 'select'],
    groups: [
      { id: 'align', label: 'Align', kind: 'kit', block: 'align', fits: ['layers', 'shapesMany'], open: true },
      { id: 'anchor', label: 'Anchor Point', kind: 'kit', block: 'anchor', fits: ['layer', 'shapes', 'text'] },
      { id: 'transform', label: 'Transform', kind: 'acts', fits: [], hero: ['quick:precompose', 'quick:centerAnchor'], refs: ['quick:precompose', 'quick:centerAnchor', 'quick:flipH', 'quick:flipV', 'quick:separate'] },
      { id: 'parent', label: 'Parent & Link', kind: 'acts', fits: ['layers'], hero: ['quick:parentNull'], refs: ['quick:parentNull', 'quick:k_parent', 'quick:k_delay', 'quick:k_stare'] },
      { id: 'arrange', label: 'Arrange (Grid Builder)', kind: 'grid', section: 'layout', ids: ['grid', 'honey', 'wall', 'ring', 'fan', 'spiral', 'galaxy', 'path', 'globe'], more: 'layout', fits: ['layers', 'shapesMany'] },
      { id: 'select', label: 'Select & Clean up', kind: 'acts', fits: [], refs: ['quick:k_trash'], links: [['select', 'Select layers by type, name, label']] }
    ] },
  { id: 'ae-design', label: 'Design', title: 'Shapes & icons, backgrounds, looks, brand', fits: ['none'], owns: ['shapes', 'backgrounds', 'looks', 'brand'],
    groups: [
      { id: 'shapes', label: 'Shapes & Icons', kind: 'links', fits: ['none'], open: true, links: [['shapes', '1,899 icons and 22 native shapes, editable in AE']] },
      { id: 'bg', label: 'Backgrounds', kind: 'tiles', section: 'backgrounds', ids: ['bg-tomato', 'bg-midnight', 'bg-ocean', 'bg-sunset', 'bg-aurora', 'bg-cyber'], more: 'backgrounds', fits: ['none'] },
      { id: 'looks', label: 'Looks & Glass', kind: 'tiles', section: 'looks', ids: ['glass-clear', 'glass-frosted', 'glass-liquid', 'glass-tinted', 'glass-smoke', 'glass-crystal'], more: 'looks', fits: [] },
      { id: 'brand', label: 'Brand', kind: 'links', fits: [], links: [['brand', 'Client colours and fonts — apply in one click']] }
    ] },
  { id: 'ae-effect', label: 'Effect', title: 'Keying, colour, camera & zoom, stylize (Effect menu)', fits: [], owns: ['compositing', 'zoom'],
    groups: [
      { id: 'keying', label: 'Keying', kind: 'tiles', section: 'compositing', ids: ['c-compositing.keySetup', 'c-generate.greenPrompt', 'c-generate.importKey'], more: 'compositing', fits: [], open: true },
      { id: 'color', label: 'Color Correction', kind: 'tiles', section: 'compositing', ids: ['c-compositing.grade', 'c-compositing.matchColor', 'c-compositing.lookAssist', 'c-compositing.analyze'], more: 'compositing', fits: [] },
      { id: 'zoom', label: 'Camera & Zoom', kind: 'tiles', section: 'zoom', ids: ['punch', 'smooth', 'detail', 'follow', 'spot', 'cursorArrow'], more: 'zoom', fits: [] },
      { id: 'stylize', label: 'Stylize', kind: 'acts', fits: [], refs: ['quick:k_vignette'], links: [['looks', 'Looks & Glass']] }
    ] },
  { id: 'ae-comp', label: 'Comp', title: 'Guides, deliver, project, your tools (Composition menu)', fits: ['none'], owns: ['deliver', 'quick', 'tools'],
    groups: [
      { id: 'guides', label: 'Guides & Safe Areas', kind: 'tiles', section: 'layout', ids: ['g12', 'thirds', 'safe', 'split2', 'quad', 'wall6'], more: 'layout', fits: ['none'], open: true },
      { id: 'deliver', label: 'Deliver', kind: 'links', fits: [], links: [['deliver', 'Every format at once (16:9, 9:16, 1:1, 4:5…)']] },
      { id: 'project', label: 'Project', kind: 'acts', fits: [], hero: ['quick:dupComp'], minor: ['quick:revealFolder', 'quick:purge'], refs: ['quick:dupComp', 'quick:revealProject', 'quick:openPrecomp', 'quick:revealFolder', 'quick:purge'] },
      { id: 'mine', label: 'Quick Bar & My Tools', kind: 'links', fits: [], links: [['quick', 'Customize the Quick Bar'], ['tools', 'My tools & Tool Factory']] }
    ] }
];
// tab ids are prefixed: 'animate' is also the Motion presets library page
const TAB_IDS = TABS.map((t) => t.id);
/** Which tab owns a library / view page (for the crumb and the active tab). */
const ownerOf = (view) => TABS.find((t) => t.owns.includes(view)) || null;
const UTIL = ['favorites', 'history', 'settings', 'diagnostics'];

/* ---------- state: open groups, remembered per kind of selection ---------- */
const OPEN_KEY = 'ae-open';
function isOpen(app, g, kind) {
  const o = ((app.services.store.get(OPEN_KEY, {}) || {})[kind] || {})[g.id];
  return o === undefined ? (g.fits.includes(kind) || !!g.open) : !!o;
}
function setOpen(app, g, kind, v) {
  const all = Object.assign({}, app.services.store.get(OPEN_KEY, {}) || {});
  all[kind] = Object.assign({}, all[kind] || {}, { [g.id]: v });
  app.services.store.set(OPEN_KEY, all);
  app.render();
}

/* ---------- your group order + ▸ Recent (v0.22) ---------- */
const ORDER_KEY = 'ae-order';
const RECENT_KEY = 'ae-recent';
const RECENT_MAX = 6;
// a group every tab has, first by default (drag it anywhere): what you ran from this tab, newest first
const RECENT = { id: 'recent', label: 'Recent', kind: 'recent', fits: [], open: true };
const defaultIds = (t) => [RECENT.id].concat(t.groups.map((g) => g.id));
function savedOrder(app, t) { const o = (app.services.store.get(ORDER_KEY, {}) || {})[t.id]; return Array.isArray(o) ? o : null; }
/** The tab's groups in your order. Unknown saved ids are ignored; groups added later keep their default place. */
function groupsOf(app, t) {
  const all = [RECENT].concat(t.groups);
  const o = savedOrder(app, t);
  if (!o) return all;
  const byId = new Map(all.map((g) => [g.id, g]));
  const out = o.filter((id, i) => byId.has(id) && o.indexOf(id) === i).map((id) => byId.get(id));
  all.forEach((g, i) => { if (!out.includes(g)) out.splice(Math.min(i, out.length), 0, g); });
  return out;
}
/** Move group `id` to index `to` of the tab's list (saved; the default order is stored as "no order"). */
function moveGroup(app, t, id, to) {
  const ids = groupsOf(app, t).map((g) => g.id);
  const from = ids.indexOf(id);
  if (from < 0) return false;
  const dest = Math.max(0, Math.min(ids.length - 1, to));
  if (dest === from) return false;
  ids.splice(from, 1); ids.splice(dest, 0, id);
  const all = Object.assign({}, app.services.store.get(ORDER_KEY, {}) || {});
  if (ids.join('|') === defaultIds(t).join('|')) delete all[t.id]; else all[t.id] = ids;
  app.services.store.set(ORDER_KEY, all);
  return true;
}
function resetOrder(app, t) {
  const all = Object.assign({}, app.services.store.get(ORDER_KEY, {}) || {});
  delete all[t.id];
  app.services.store.set(ORDER_KEY, all);
  app.render();
}
const recentRefs = (app, t) => ((app.services.store.get(RECENT_KEY, {}) || {})[t.id] || []).slice(0, RECENT_MAX);
/** Remember a run from tab `t`. Runs from ▸ Recent itself do not reorder it (nothing moves under the pointer). */
function remember(app, t, ref) {
  if (!t || !ref) return;
  const all = Object.assign({}, app.services.store.get(RECENT_KEY, {}) || {});
  all[t.id] = [ref].concat((all[t.id] || []).filter((r) => r !== ref)).slice(0, RECENT_MAX);
  app.services.store.set(RECENT_KEY, all);
}
function clearRecent(app, t) {
  const all = Object.assign({}, app.services.store.get(RECENT_KEY, {}) || {});
  delete all[t.id];
  app.services.store.set(RECENT_KEY, all);
  app.render();
}
/** A Recent ref → a runnable item: 'tile:<section>:<tile id>', 'kit:<Motion Kit tool>', or an actions ref ('quick:…'). */
function recentItem(app, ref) {
  const lib = require('./studio/library');
  if (ref.indexOf('tile:') === 0) {
    const [, secId, id] = ref.split(':'); const sec = studio.byId(secId); const x = sec && sec.tiles && sec.tiles.find((y) => y.id === id);
    return x ? { id: ref, label: x.label, icon: sec.icon, ready: lib.readiness(app, x), run: () => lib.applyNow(app, x, sec) } : null;
  }
  if (ref.indexOf('kit:') === 0) {
    const qb = require('./quickbar'); const BAR = require('../../features/quick/bar'); const a = qb.byId(ref.slice(4));
    return a ? { id: ref, label: BAR.KIT_LABEL[a.id] || a.label, icon: a.icon, ready: lib.readiness(app, { tool: a.tool, args: a.args }), run: () => qb.run(app, a) } : null;
  }
  const a = A.resolve(ref);
  return a ? { id: ref, label: a.label, icon: a.icon, ready: a.ready(app), run: () => a.run(app) } : null;
}
function recentBody(app, t) {
  const items = recentRefs(app, t).map((r) => recentItem(app, r)).filter(Boolean);
  // one row of fixed height, empty or full: adding an item never pushes the groups below
  return h('div', { class: 'ae-recent', role: 'list', 'aria-label': `Recent in ${t.label}` }, items.length ? items.map((it) => h('button', {
    class: `ae-act ${it.ready.ok ? '' : 'off'}`, role: 'listitem', 'data-key': `rc-${it.id}`, 'aria-label': it.label, title: it.ready.ok ? it.label : `${it.label} — ${it.ready.hint}`,
    onclick: () => (it.ready.ok ? it.run() : app.toast(`${it.label}: ${it.ready.hint}`, 4500, 'warn'))
  }, icon(it.icon || 'bolt', 'sm'), h('span', {}, it.label))) : h('span', { class: 'kit-hint' }, `What you run from ${t.label} shows up here.`));
}

/* ---------- group headers: drag to reorder, keyboard ---------- */
let drag = null; // { tab, id } while a group header is dragged
const focusGroup = (id) => { const b = document.querySelector(`.ae-group[data-key="g-${id}"] .ae-twirl`); if (b) b.focus(); };
/** ↑/↓ next group · Home/End · → open · ← fold · Alt+↑/↓ move the group (saved). */
function groupKey(app, t, g, kind, open, e) {
  const list = groupsOf(app, t);
  const i = list.findIndex((x) => x.id === g.id);
  const up = e.key === 'ArrowUp', down = e.key === 'ArrowDown';
  if ((up || down) && e.altKey) { e.preventDefault(); if (moveGroup(app, t, g.id, i + (up ? -1 : 1))) { app.render(); setTimeout(() => focusGroup(g.id), 0); } return; }
  if (up || down) { e.preventDefault(); const n = list[i + (up ? -1 : 1)]; if (n) focusGroup(n.id); return; }
  if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); focusGroup(list[e.key === 'Home' ? 0 : list.length - 1].id); return; }
  if (e.key === 'ArrowRight' && !open) { e.preventDefault(); setOpen(app, g, kind, true); return; }
  if (e.key === 'ArrowLeft' && open) { e.preventDefault(); setOpen(app, g, kind, false); }
}
function clearDrop() { document.querySelectorAll('.ae-group.drop-before, .ae-group.drop-after, .ae-group.dragging').forEach((el) => el.classList.remove('drop-before', 'drop-after', 'dragging')); }
function dropOn(app, t, g, e) {
  const r = e.currentTarget.getBoundingClientRect();
  const after = e.clientY > r.top + r.height / 2;
  const ids = groupsOf(app, t).map((x) => x.id);
  const from = ids.indexOf(drag.id);
  let to = ids.indexOf(g.id) + (after ? 1 : 0);
  if (from < to) to -= 1;
  return { after, to };
}

/* ---------- pieces ---------- */
function twirl(app, t, g, kind, body, extra) {
  const open = isOpen(app, g, kind);
  const fits = g.fits.includes(kind);
  const mine = () => drag && drag.tab === t.id && drag.id !== g.id;
  return h('section', {
    class: `ae-group ${open ? 'open' : ''} ${g.kind === 'recent' ? 'ae-g-recent' : ''}`, 'data-key': `g-${g.id}`, 'aria-label': g.label,
    ondragover: (e) => { if (!mine()) return; e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch (_) { /* old CEP */ } const d = dropOn(app, t, g, e); e.currentTarget.classList.toggle('drop-before', !d.after); e.currentTarget.classList.toggle('drop-after', d.after); },
    ondragleave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('drop-before', 'drop-after'); },
    ondrop: (e) => { if (!mine()) return; e.preventDefault(); const d = dropOn(app, t, g, e); const id = drag.id; drag = null; clearDrop(); if (moveGroup(app, t, id, d.to)) app.render(); }
  },
    h('div', { class: 'ae-gh', draggable: 'true', title: 'Drag to move this group · Alt+↑/↓',
      ondragstart: (e) => { drag = { tab: t.id, id: g.id }; try { e.dataTransfer.setData('text/plain', g.id); e.dataTransfer.effectAllowed = 'move'; } catch (_) { /* old CEP */ } const sec = e.currentTarget.parentNode; setTimeout(() => sec.classList.add('dragging'), 0); },
      ondragend: () => { drag = null; clearDrop(); } },
      h('button', { class: 'ae-twirl', 'aria-expanded': String(open), title: `${open ? 'Fold' : 'Open'} ${g.label} · ↑/↓ next group · ←/→ fold / open · Alt+↑/↓ move`,
        onclick: () => setOpen(app, g, kind, !open), onkeydown: (e) => groupKey(app, t, g, kind, open, e) }, icon('chev', 'xs'), h('span', {}, g.label)),
      fits ? h('span', { class: 'ae-fit', title: 'Fits what you selected' }, 'for selection') : null,
      h('span', { class: 'spacer' }), extra || null, icon('grip', 'xs ae-grip')),
    open ? h('div', { class: 'ae-gb' }, body()) : null);
}

/** size: 'l' primary (32 px) · undefined standard (28 px) · 's' minor chip (24 px). */
function actButton(app, a, onRun, size) {
  const rd = a.ready(app);
  return h('button', {
    class: `${size === 's' ? 'ae-chip' : 'ae-act'} ${size === 'l' ? 'l' : ''} ${rd.ok || a.nav ? '' : 'off'}`, 'data-key': `a-${a.id}`, 'aria-label': a.label,
    title: rd.ok || a.nav ? a.label : `${a.label} — ${rd.hint}`,
    onclick: () => { if (!rd.ok && !a.nav) app.toast(`${a.label}: ${rd.hint}`, 4500, 'warn'); else { if (onRun) onRun(); a.run(app); } }
  }, icon(a.icon || 'bolt', size === 's' ? 'xs' : ''), h('span', {}, a.label));
}
const linkRow = (app, links) => (links || []).map(([id, label]) => h('button', { class: 'ae-link', 'data-key': `l-${id}`, onclick: () => app.go(id) }, h('span', {}, label), icon('chev', 'xs')));

function tileStrip(app, g, tab) {
  const lib = require('./studio/library');
  const sec = studio.byId(g.section);
  const tiles = g.ids.map((id) => sec.tiles.find((t) => t.id === id)).filter(Boolean);
  return h('div', { class: 'ae-tiles' }, tiles.map((t) => {
    const rd = lib.readiness(app, t);
    return h('button', {
      class: `ae-tile ${rd.ok ? '' : 'off'}`, 'data-key': `t-${t.id.slice(3)}`, 'aria-label': `Apply ${t.label}`,
      title: rd.ok ? `${t.label} — click to apply · right-click to open its settings` : `${t.label} — ${rd.hint}`,
      onclick: () => (rd.ok ? (remember(app, tab, `tile:${sec.id}:${t.id}`), lib.applyNow(app, t, sec)) : app.toast(`${t.label}: ${rd.hint}`, 4500, 'warn')),
      oncontextmenu: (e) => { e.preventDefault(); openTile(app, sec, t); }
    }, lib.thumbEl(lib.tileThumb(app, t)), h('span', { class: 'ae-tile-l' }, t.label));
  }));
}
/** Open a tile in its library page (to change its settings first). */
function openTile(app, sec, t) {
  app.state.set((st) => ({ studio: Object.assign({}, st.studio, { [sec.id]: Object.assign({}, (st.studio || {})[sec.id], { tab: 'library', filter: 'All', q: '', tile: t.id, filled: null }) }) }));
  app.go(sec.id);
}
function moreLink(app, g) {
  const sec = studio.byId(g.more);
  return sec ? h('button', { class: 'ae-more', 'data-key': `more-${g.id}`, title: `Open ${sec.label} (every preset, settings, your own presets)`, onclick: () => app.go(sec.id) }, `All ${sec.tiles ? sec.tiles.length : ''}`, icon('chev', 'xs')) : null;
}

function groupBody(app, g, t) {
  if (g.kind === 'recent') return recentBody(app, t);
  const kit = require('./views/kit');
  if (g.kind === 'kit') {
    // the group's twirl is the fold here: the block renders open (a scope nobody folds)
    const prev = kit.K.scope; kit.K.scope = { ctx: '__classic', focus: ['ease', 'anchorAlign', 'anchor', 'align', 'pinned'] };
    try { return g.block === 'ease' ? kit.easeBlock(app) : g.block === 'align' ? kit.alignBlock(app) : kit.anchorBlock(app); } finally { kit.K.scope = prev; }
  }
  if (g.kind === 'curves') return kit.curveLibrary(app, kit.matchPreset(kit.K.curve, app.services.store.get('kit-curves', [])));
  if (g.kind === 'kitTools') { const BAR = require('../../features/quick/bar'); const grp = BAR.KIT_GROUPS.find(([n]) => n === g.group); return kit.toolsBlock(app, { ids: grp ? grp[1] : [], title: g.group, cls: 'ae-kit', onRun: (id) => remember(app, t, `kit:${id}`) }); }
  if (g.kind === 'acts') {
    // importance decides size and place: primary first and larger, minor last as chips
    const hero = g.hero || [], minor = g.minor || [];
    const row = (cls, refs, size) => { const list = refs.map((r) => [r, A.resolve(r)]).filter(([, a]) => a); return list.length ? h('div', { class: cls }, list.map(([r, a]) => actButton(app, a, () => remember(app, t, r), size))) : null; };
    return [row('ae-hero', hero, 'l'), row('ae-acts', g.refs.filter((r) => !hero.includes(r) && !minor.includes(r))), row('ae-minor', minor, 's'), ...linkRow(app, g.links)];
  }
  if (g.kind === 'tiles') return [tileStrip(app, g, t), ...linkRow(app, g.links)];
  if (g.kind === 'grid') return [require('./gridPanel').render(app), tileStrip(app, g, t)];
  return linkRow(app, g.links);
}

/* ---------- search (Effects & Presets › Contains) ---------- */
function searchBox(app, s) {
  const input = h('input', { class: 'txt ae-search', type: 'search', 'data-fk': 'ae-q', placeholder: 'Search tools & presets', 'aria-label': 'Search tools and presets', value: s.aeQ || '' });
  input.addEventListener('input', (e) => app.state.set({ aeQ: e.target.value }));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); app.state.set({ aeQ: '' }); }
    if (e.key === 'Enter') { const r = require('./palette').results(app, e.target.value)[0]; if (r) { app.state.set({ aeQ: '' }); r.run(); } }
  });
  return h('div', { class: 'ae-searchrow' }, icon('search', 'sm'), input);
}
function searchResults(app, q) {
  const list = require('./palette').results(app, q);
  if (!list.length) return h('div', { class: 'empty' }, `Nothing matches “${q}”`);
  return h('div', { class: 'ae-results', role: 'list' }, list.map((it) => h('button', {
    class: 'ae-res', role: 'listitem', 'data-key': `r-${it.kind}-${it.id}`, title: it.desc,
    onclick: () => { app.state.set({ aeQ: '' }); it.run(); }
  }, icon(it.icon || 'tools', 'sm'), h('span', { class: 'ae-res-n' }, it.name), h('span', { class: 'ae-res-d' }, it.desc), it.kind === 'preset' ? h('span', { class: 'ae-res-a' }, 'apply') : h('span', { class: 'ae-res-w' }, it.ws))));
}

/* ---------- tab quick menus (▾ / right-click): every action of a tab, two clicks from anywhere ---------- */
/** Items of a tab's quick menu, per group: actions run, presets apply, blocks / pages open. */
function tabItems(app, t) {
  const lib = require('./studio/library');
  const qb = require('./quickbar');
  const BAR = require('../../features/quick/bar');
  return t.groups.map((g) => {
    let items = [];
    if (g.kind === 'acts') items = g.refs.map((r) => [r, A.resolve(r)]).filter(([, a]) => a).map(([r, a]) => ({ id: a.id, ref: r, label: a.label, icon: a.icon, run: () => a.run(app), ready: a.ready(app) }));
    else if (g.kind === 'kitTools') { const grp = BAR.KIT_GROUPS.find(([n]) => n === g.group); items = (grp ? grp[1] : []).map((id) => qb.byId(id)).filter(Boolean).map((a) => ({ id: a.id, ref: `kit:${a.id}`, label: BAR.KIT_LABEL[a.id] || a.label, icon: a.icon, run: () => qb.run(app, a), ready: { ok: true } })); }
    else if (g.kind === 'tiles' || g.kind === 'grid') { const sec = studio.byId(g.section); items = g.ids.map((id) => sec.tiles.find((x) => x.id === id)).filter(Boolean).map((x) => ({ id: x.id, ref: `tile:${sec.id}:${x.id}`, label: x.label, icon: sec.icon, run: () => lib.applyNow(app, x, sec), ready: lib.readiness(app, x) })); }
    const open = { id: `open-${g.id}`, label: g.kind === 'tiles' || g.kind === 'grid' ? `All ${g.label}…` : `Open ${g.label}`, icon: 'chev', nav: true, run: () => { const kind = A.profile(app.state.get().ctx); setOpen(app, g, kind, true); app.go(t.id); } };
    if (g.kind === 'links') items = (g.links || []).map(([id, label]) => ({ id: `l-${id}`, label, icon: 'chev', nav: true, run: () => app.go(id), ready: { ok: true } }));
    return { g, items: items.concat(g.kind === 'links' ? [] : [Object.assign(open, { ready: { ok: true } })]) };
  });
}
function tabMenu(app, s) {
  const t = TABS.find((x) => x.id === s.aeTabMenu.id);
  if (!t) return null;
  const close = () => app.state.set({ aeTabMenu: null });
  return h('div', { class: 'overlay qb-overlay', onmousedown: (e) => { if (e.target.classList.contains('overlay')) close(); } },
    h('div', { class: 'ae-menu ae-tabmenu', role: 'menu', 'aria-label': `${t.label} — quick menu`, style: Object.assign({ top: `${s.aeTabMenu.top}px`, maxWidth: `${s.aeTabMenu.maxW}px` }, s.aeTabMenu.right != null ? { right: `${s.aeTabMenu.right}px` } : { left: `${s.aeTabMenu.left}px` }) },
      tabItems(app, t).map(({ g, items }) => [h('div', { class: 'ae-mh' }, g.label),
        h('div', { class: 'ae-mgrid' }, items.map((it) => h('button', {
          class: `ae-mi ${it.ready.ok || it.nav ? '' : 'off'}`, role: 'menuitem', 'data-key': `tm-${it.id}`, title: it.ready.ok || it.nav ? it.label : `${it.label} — ${it.ready.hint}`,
          onclick: () => { close(); if (!it.ready.ok && !it.nav) app.toast(`${it.label}: ${it.ready.hint}`, 4500, 'warn'); else { if (it.ref) remember(app, t, it.ref); it.run(); } }
        }, icon(it.icon || 'bolt', 'sm'), h('span', {}, it.label))))]),
      savedOrder(app, t) ? [h('div', { class: 'ae-msep' }), h('button', { class: 'ae-mi', role: 'menuitem', 'data-key': 'tm-reset-order', title: `Put the groups of ${t.label} back in their original order`, onclick: () => { close(); resetOrder(app, t); } }, icon('undo', 'sm'), h('span', {}, 'Reset group order'))] : null));
}
function openTabMenu(app, t, el) {
  const s = app.state.get();
  if (s.aeTabMenu && s.aeTabMenu.id === t.id) { app.state.set({ aeTabMenu: null }); return; }
  const r = el.getBoundingClientRect(), box = require('./quickbar').fixedBox(el.closest('.app') || document.body);
  const left = Math.round(r.left - box.left), right = Math.round(box.left + box.width - r.right);
  app.state.set({ aeTabMenu: { id: t.id, top: Math.round(r.bottom - box.top + 2), left: left <= box.width / 2 ? Math.max(4, left) : null, right: left > box.width / 2 ? Math.max(4, right) : null, maxW: Math.round(box.width - 8) } });
}

/* ---------- ≡ panel menu ---------- */
function panelMenu(app, s) {
  const close = () => app.state.set({ aeMenu: false });
  const item = (ic, label, fn, key) => h('button', { class: 'ae-mi', role: 'menuitem', 'data-key': `mi-${key}`, onclick: () => { close(); fn(); } }, icon(ic, 'sm'), h('span', {}, label));
  const L = require('./layouts');
  return h('div', { class: 'overlay qb-overlay', onmousedown: (e) => { if (e.target.classList.contains('overlay')) close(); } },
    h('div', { class: 'ae-menu', role: 'menu', 'aria-label': 'Panel menu', style: { top: `${s.aeMenuAt.top}px`, right: `${s.aeMenuAt.right}px` } },
      item('gift', "What's new", () => app.state.set({ modal: 'whatsnew' }), 'new'),
      item('keyboard', 'Keyboard shortcuts', () => app.state.set({ modal: 'shortcuts' }), 'keys'),
      item('pie', 'Pie menu (hold Q)', () => app.openPie(window.innerWidth / 2, 220, { mode: 'click' }), 'pie'),
      item('spark', 'Copilot (Ctrl+Space)', () => app.openCopilot(), 'copilot'),
      h('div', { class: 'ae-msep' }),
      item('star', 'Favorites', () => app.go('favorites'), 'fav'),
      item('history', 'History', () => app.go('history'), 'history'),
      item('bolt', 'Customize Quick Bar', () => app.go('quick'), 'qb'),
      h('div', { class: 'ae-msep' }),
      h('div', { class: 'ae-mh' }, 'Panel layout'),
      ...L.LAYOUTS.filter((x) => !x.retired).map((x) => h('button', { class: 'ae-mi', role: 'menuitemradio', 'aria-checked': String(L.layoutOf(app) === x.id), 'data-key': `mi-l-${x.id}`, onclick: () => { close(); app.services.settings.update({ ui: { layout: x.id } }); app.render(); } }, icon(L.layoutOf(app) === x.id ? 'check' : 'dot', 'sm'), h('span', {}, x.label))),
      h('div', { class: 'ae-msep' }),
      item('gear', 'Settings', () => app.go('settings'), 'settings'),
      item('pulse', 'Diagnostics', () => app.go('diagnostics'), 'diag'),
      item('info', 'About MOE Motion AI', () => app.state.set({ modal: 'about' }), 'about')));
}

/* ---------- build ---------- */
function build(app, s, body) {
  const kind = A.profile(s.ctx);
  // first open: the first tab that fits the selection (afterwards the tab you chose stays)
  const firstTab = (TABS.find((t) => t.fits.includes(kind)) || TABS[0]).id;
  const view = s.view === 'home' ? (s.aeTab || firstTab) : s.view;
  const isTab = TAB_IDS.includes(view);
  const owner = isTab ? TABS.find((t) => t.id === view) : ownerOf(view);
  const tab = owner || (UTIL.includes(view) ? null : TABS.find((t) => t.id === (s.aeTab || firstTab)));
  // remember a tab only when you picked it (Home follows the selection until then)
  if (s.view !== 'home' && isTab && s.aeTab !== view) setTimeout(() => app.state.set({ aeTab: view }), 0);
  const q = (s.aeQ || '').trim();
  let content;
  if (q) content = h('div', { class: 'view ae-page' }, searchResults(app, q));
  else if (isTab) content = h('div', { class: 'view kit ae-page' }, groupsOf(app, tab).map((g) => twirl(app, tab, g, kind, () => groupBody(app, g, tab),
    g.kind === 'recent' ? (recentRefs(app, tab).length ? h('button', { class: 'ae-more', 'data-key': `clear-${tab.id}`, title: `Clear Recent in ${tab.label}`, onclick: () => clearRecent(app, tab) }, 'Clear') : null) : g.more ? moreLink(app, g) : null)));
  else {
    const sec = studio.byId(view);
    const back = tab || TABS.find((t) => t.id === (s.aeTab || firstTab));
    content = [h('div', { class: 'lay-crumb ae-crumb', 'data-key': `crumb-${view}` },
      h('button', { class: 'btn ghost sm', onclick: () => app.go(back.id) }, icon('chev', 'xs'), back.label),
      h('span', { class: 'lay-crumb-sep' }, '›'), h('span', {}, (sec || { label: view.charAt(0).toUpperCase() + view.slice(1) }).label)), body(view)];
  }
  const tabs = h('div', { class: 'lay-tabs ae-tabs', role: 'tablist', 'aria-label': 'Tool categories' }, TABS.map((t) => {
    const on = tab && tab.id === t.id;
    const hint = t.fits.includes(kind);
    const n = TABS.indexOf(t) + 1;
    return h('div', { class: `ae-tab ${on ? 'on' : ''}`, 'data-key': `tw-${t.id}` },
      h('button', { role: 'tab', 'data-key': `t-${t.id.slice(3)}`, 'aria-selected': String(!!on), title: `${t.title}${hint ? ' — fits what you selected' : ''} · Ctrl+${n} · right-click: quick menu`,
        onclick: () => { app.state.set({ aeQ: '', aeTabMenu: null }); app.go(t.id); },
        oncontextmenu: (e) => { e.preventDefault(); openTabMenu(app, t, e.currentTarget); } },
      h('span', {}, t.label), hint ? h('span', { class: 'ae-dot', 'aria-hidden': 'true' }) : null),
      h('button', { class: 'ae-tabmenu-btn', 'data-key': `tm-${t.id}`, 'aria-label': `${t.label} quick menu`, 'aria-haspopup': 'true', 'aria-expanded': String(!!(s.aeTabMenu && s.aeTabMenu.id === t.id)), title: `${t.label}: every action in two clicks (without leaving this tab)`, onclick: (e) => openTabMenu(app, t, e.currentTarget.parentNode) }, icon('chev', 'xs')));
  }));
  const menuBtn = h('button', { class: 'icon-btn ae-menubtn', title: 'Panel menu', 'aria-label': 'Panel menu', 'aria-haspopup': 'true', 'aria-expanded': String(!!s.aeMenu),
    onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(), box = require('./quickbar').fixedBox(e.currentTarget.closest('.app') || document.body); app.state.set({ aeMenu: !s.aeMenu, aeMenuAt: { top: Math.round(r.bottom - box.top + 2), right: Math.max(4, Math.round(box.left + box.width - r.right)) } }); } }, icon('menu', 'sm'));
  return {
    top: [require('./quickbar').strip(app), tabs, searchBox(app, s)],
    title: q ? 'Search' : isTab ? tab.label : (studio.byId(view) || { label: view.charAt(0).toUpperCase() + view.slice(1) }).label,
    content,
    overlay: s.aeMenu ? panelMenu(app, s) : s.aeTabMenu ? tabMenu(app, s) : null,
    menuBtn
  };
}

module.exports = { TABS, TAB_IDS, RECENT, ownerOf, isOpen, build, tabItems, groupsOf, moveGroup, resetOrder, remember, recentRefs, recentItem };
