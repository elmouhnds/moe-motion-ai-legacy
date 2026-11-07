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
const AR = require('./arrange');

/* ---------- information architecture: tab → groups ---------- */
// Action groups list their refs by importance (v0.23, docs/features/DESIGN_SYSTEM.md): `hero` = primary (32 px, first row),
// the rest standard (28 px), `minor` = rare / housekeeping (24 px chips, last). hero and minor are subsets of refs.
// Group kinds: 'kit' (an existing Motion Kit block), 'acts' (quick actions), 'tiles' (library presets,
// one click applies), 'grid' (Your grid + layouts), 'links' (pages). fits = selection kinds it suits.
const SEL = { keys: 'keys', layer: 'layer', layers: 'layers', text: 'text', shapes: 'shapes', shapesMany: 'shapesMany', none: 'none' };
const TABS = [
  // v0.31 (docs/features/SPACE_FOLLOWS_CONTENT.md): every group is sized by what it holds and merged with the
  // tools that do the same job; Easy / Linear / Hold, the anchor, align and the curve library live in the
  // Motion Control on top, so the tabs no longer repeat them.
  { id: 'ae-animate', label: 'Animate', icon: 'motion', bar: ['bar'], title: 'Animate in / out, draw on, text, expressions (Animation menu)', fits: ['layer', 'layers', 'text', 'shapes', 'shapesMany'], owns: ['animate', 'text', 'expressions', 'kit'],
    groups: [
      // one block, three modes: the In and Out presets are the same moves played the other way; Draw On is the shapes' in / out
      { id: 'in', label: 'Animate In / Out', kind: 'animate', section: 'animate', more: 'animate', fits: ['layer', 'layers', 'shapes', 'shapesMany'], open: true,
        modes: [['in', 'In', ['inRL', 'inBT', 'fadeIn', 'popIn', 'riseIn', 'cascadeIn']], ['out', 'Out', ['outRL', 'outTB', 'fadeOut', 'popOut', 'scaleOut', 'spinOut']], ['draw', 'Draw', ['trimDraw', 'trimErase', 'trimTravel', 'trimBoth']],
          ['wipe', 'Wipe', ['wipeInL', 'wipeInR', 'wipeInB', 'wipeInD', 'wipeOutL', 'wipeOutR']], ['depth', 'Depth', ['depthIn', 'depthInFar', 'depthOut']],
          ['shake', 'Shake', ['shake-bump', 'shake-zoomPunch', 'shake-whip', 'shake-slam', 'shake-jitter']]],
        ids: ['inRL', 'inBT', 'fadeIn', 'popIn', 'riseIn', 'cascadeIn', 'outRL', 'outTB', 'fadeOut', 'popOut', 'scaleOut', 'spinOut', 'trimDraw', 'trimErase', 'trimTravel', 'trimBoth', 'wipeInL', 'wipeInR', 'wipeInB', 'wipeInD', 'wipeOutL', 'wipeOutR', 'depthIn', 'depthInFar', 'depthOut', 'shake-bump', 'shake-zoomPunch', 'shake-whip', 'shake-slam', 'shake-jitter'] },
      // v0.44 (FIND_FAST): the everyday In / Out animators of the Text page, one click (Arabic-safe), like Loop
      { id: 'text', label: 'Text Animators', kind: 'acts', fits: ['text'], refs: ['quick:typewriter', 'quick:counter', 'quick:t_inUp', 'quick:t_rise', 'quick:t_blurIn', 'quick:t_trackIn', 'quick:t_outDown', 'quick:t_sink', 'quick:t_blurOut', 'quick:t_trackOut', 'quick:t_decode', 'quick:t_assemble', 'quick:t_explode', 'quick:t_remove'],
        minor: ['quick:t_remove'],
        rows: [['In', ['quick:t_inUp', 'quick:t_rise', 'quick:t_blurIn', 'quick:t_trackIn'], ['Up', 'Soft Rise', 'Blur Focus', 'Tracking']], ['Out', ['quick:t_outDown', 'quick:t_sink', 'quick:t_blurOut', 'quick:t_trackOut'], ['Down', 'Soft Sink', 'Blur Away', 'Tracking']], ['Fx', ['quick:t_decode', 'quick:t_assemble', 'quick:t_explode'], ['Decode', 'Gather', 'Explode']]],
        links: [['text', 'All 27 text animators · Arabic · .ffx']] },
      // Motion Rigs merged in: Excite = Inertia and Jump = Bounce Land with the numbers on sliders (the "Sliders" switch)
      { id: 'expr', label: 'Expressions', kind: 'tiles', section: 'expressions', live: true, ids: ['x-wiggle', 'x-float', 'x-pendulum', 'x-pulse', 'x-blink', 'x-timeRotate', 'x-inertia', 'x-bounceBack', 'x-orbit'], more: 'expressions', links: [['expressions', 'Expression editor']], fits: [] }
    ] },
  { id: 'ae-keys', label: 'Timing', icon: 'easeCurve', full: true, title: 'Timing: the full graph (ease, curves, Copy / Paste), keyframes, loops, bake (Animation › Keyframe Assistant)', fits: ['keys'], owns: [],
    groups: [
      { id: 'assist', label: 'Keyframes & Loops', kind: 'acts', fits: ['keys'], open: true, hero: ['quick:k_stagger'], minor: ['quick:k_trimKeys', 'quick:selectSame', 'quick:k_bake'],
        refs: ['quick:k_stagger', 'quick:reverse', 'quick:mirror', 'quick:clone', 'quick:k_beats', 'quick:k_trimKeys', 'quick:selectSame', 'quick:k_bake'],
        // v0.43: Reverse / Mirror / Clone are one family — one labelled row, like Loop
        rows: [['Keys', ['quick:reverse', 'quick:mirror', 'quick:clone'], ['Reverse', 'Mirror', 'Copy']], ['Loop', ['tile:expressions/x-loopCycle', 'tile:expressions/x-loopPingPong', 'tile:expressions/x-loopOffset', 'tile:expressions/x-loopInOut'], ['Cycle', 'Ping-Pong', 'Offset', 'In + Out']]] }
    ] },
  { id: 'ae-layer', label: 'Layer', icon: 'layers', bar: ['rail'], title: 'Select, transform, parent & link, arrange (Layer menu) — anchor and align are in Motion Control', fits: ['layer', 'layers', 'shapes', 'shapesMany', 'text'], owns: ['layout', 'select'],
    groups: [
      // v0.44 (FIND_FAST): Select is out front — the Selector's everyday filters, one click each (Shift / Alt, search,
      // labels, other comps and the project stay on its page)
      { id: 'select', label: 'Select', kind: 'acts', fits: ['none', 'layer', 'layers', 'text', 'shapes', 'shapesMany'], open: true, keys: true,
        refs: ['quick:selText', 'quick:selShape', 'quick:selSolid', 'quick:selNull', 'quick:selPrecomp', 'quick:selFootage', 'quick:selAdjust', 'quick:selCamLight',
          'quick:selSameType', 'quick:selSameSource', 'quick:selSameLabel', 'quick:selSameName', 'quick:selAll', 'quick:selInvert', 'quick:selNone', 'quick:selBack'],
        rows: [['Type', ['quick:selText', 'quick:selShape', 'quick:selSolid', 'quick:selNull', 'quick:selPrecomp', 'quick:selFootage', 'quick:selAdjust', 'quick:selCamLight'], ['Text', 'Shapes', 'Solids', 'Nulls', 'Pre-Comps', 'Footage', 'Adjustment', 'Cam & Light']],
          ['Same', ['quick:selSameType', 'quick:selSameSource', 'quick:selSameLabel', 'quick:selSameName'], ['Type', 'Source', 'Label', 'Name']],
          ['Comp', ['quick:selAll', 'quick:selInvert', 'quick:selNone', 'quick:selBack'], ['All', 'Invert', 'None', 'Back']]],
        links: [['select', 'Search · labels · other comps · project']] },
      // v0.67 (SMART_LAYER.md): what MOE already did to the selected layer — edit its numbers or remove one item
      { id: 'reader', label: 'On this layer', kind: 'reader', fits: ['layer', 'layers', 'text', 'shapes', 'shapesMany'], open: true },
      { id: 'transform', label: 'Transform', kind: 'acts', fits: [], hero: ['quick:precompose'], refs: ['quick:precompose', 'quick:separate', 'quick:flipH', 'quick:flipV'],
        pairs: [['Flip', 'quick:flipH', 'quick:flipV']] },
      { id: 'parent', label: 'Parent & Link', kind: 'acts', fits: ['layers'], hero: ['quick:parentNull', 'quick:k_parent'], refs: ['quick:parentNull', 'quick:k_parent', 'quick:k_delay', 'quick:k_stare'] },
      // v0.33: Arrange · Clone · Effectors — the grid engine's three jobs (mCloner / MoGraph style), one switch
      { id: 'arrange', label: 'Arrange · Clone · Effectors', kind: 'animate', panel: 'grid', section: 'layout', more: 'layout', fits: ['layer', 'layers', 'shapes', 'shapesMany'],
        modes: [['arrange', 'Arrange', ['grid', 'honey', 'wall', 'ring', 'fan', 'spiral', 'galaxy', 'path', 'globe', 'carousel', 'carouselTilt', 'carouselQuick']], ['clone', 'Clone', ['cloneGrid', 'cloneRow', 'cloneRing', 'cloneSpiral', 'cloneSun', 'cloneGlobe', 'colCycle', 'colGradient', 'colRandom', 'clonePoints', 'textWords', 'textLetters', 'trailEcho', 'trailGhost', 'trailSpin']], ['effect', 'Effectors', ['efPush', 'efShrink', 'efReveal', 'efScatter', 'efStep', 'efWave', 'efCascade', 'efTint', 'efSpring', 'efJelly', 'efInertia', 'efBounce', 'efAim', 'efLook', 'efBeat', 'efBeatWave', 'efField', 'efFlicker', 'efImage', 'efImageReveal']]],
        modeFor: { layer: 'clone', shapes: 'clone', text: 'clone', grid: 'effect' },
        ids: ['grid', 'honey', 'wall', 'ring', 'fan', 'spiral', 'galaxy', 'path', 'globe', 'carousel', 'carouselTilt', 'carouselQuick', 'cloneGrid', 'cloneRow', 'cloneRing', 'cloneSpiral', 'cloneSun', 'cloneGlobe', 'colCycle', 'colGradient', 'colRandom', 'clonePoints', 'textWords', 'textLetters', 'trailEcho', 'trailGhost', 'trailSpin', 'efPush', 'efShrink', 'efReveal', 'efScatter', 'efStep', 'efWave', 'efCascade', 'efTint', 'efSpring', 'efJelly', 'efInertia', 'efBounce', 'efAim', 'efLook', 'efBeat', 'efBeatWave', 'efField', 'efFlicker', 'efImage', 'efImageReveal'] }
    ] },
  { id: 'ae-design', label: 'Design', icon: 'palette', bar: false, title: 'Build: product UI (Click on Layer first), templates, shapes & icons, backgrounds, brand', fits: ['none'], owns: ['productui', 'templates', 'shapes', 'backgrounds', 'brand'],
    groups: [
      { id: 'productui', label: 'Product UI', kind: 'tiles', section: 'productui', ids: ['ui-click', 'ui-reveal', 'ui-button', 'ui-toggle', 'ui-search', 'ui-task', 'ui-notify', 'ui-progress', 'ui-chat', 'ui-stat'], more: 'productui', fits: ['none'], open: true },
      // v0.49 (TEMPLATES.md): lower thirds, titles, callouts, tags — built native in the comp, sized to the text
      { id: 'templates', label: 'Templates', kind: 'tiles', section: 'templates', ids: ['tpl-lowerThird', 'tpl-titleCard', 'tpl-handle', 'tpl-endCard', 'tpl-callout', 'tpl-quote', 'tpl-chapter', 'tpl-tag'], more: 'templates', fits: ['none'], open: true },
      { id: 'shapes', label: 'Shapes & Icons', kind: 'links', fits: ['none'], open: true, links: [['shapes', '1,899 icons and 22 native shapes, editable in AE']] },
      { id: 'bg', label: 'Backgrounds', kind: 'tiles', section: 'backgrounds', ids: ['bg-tomato', 'bg-midnight', 'bg-ocean', 'bg-sunset', 'bg-aurora', 'bg-cyber'], more: 'backgrounds', fits: ['none'] },
      { id: 'brand', label: 'Brand', kind: 'acts', fits: ['layers', 'text'], hero: ['brand:apply'], refs: ['brand:apply', 'brand:applyComp', 'brand:ease'], links: [['brand', 'Brand Kit — clients, from website / PDF']] }
    ] },
  { id: 'ae-effect', label: 'Look', icon: 'glass', bar: false, title: 'Finish the look: styles, glass, key & colour, camera & zoom (Effect menu)', fits: ['layer', 'layers', 'shapes', 'text'], owns: ['looks', 'compositing', 'zoom'],
    groups: [
      // v0.65: the finished look of a layer, one click — Styles (After Effects' own effects) then Glass
      { id: 'styles', label: 'Styles', kind: 'tiles', section: 'looks', ids: ['style-softShadow', 'style-deepShadow', 'style-glow', 'style-lightSweep'], more: 'looks', fits: ['layer', 'layers', 'shapes', 'text'], open: true },
      { id: 'looks', label: 'Glass', kind: 'tiles', section: 'looks', ids: ['thick-glaze', 'thick-prism', 'thick-chrome', 'thick-gold', 'glass-frosted', 'glass-liquid'], more: 'looks', fits: [] },
      // tool tiles with no picture are buttons, in the order of the job: read the shot, key it, match, grade, look
      { id: 'keycolor', label: 'Key & Color', kind: 'tiles', compact: true, section: 'compositing', hero: ['c-compositing.keySetup'], ids: ['c-compositing.keySetup', 'c-compositing.analyze', 'c-compositing.matchColor', 'c-compositing.grade', 'c-compositing.lookAssist'], more: 'compositing', fits: [] },
      { id: 'zoom', label: 'Camera & Zoom', kind: 'tiles', section: 'zoom', ids: ['punch', 'smooth', 'detail', 'follow', 'spot', 'cursorArrow'], more: 'zoom', fits: [], minor: ['quick:k_vignette'] }
    ] },
  { id: 'ae-comp', label: 'Deliver', icon: 'resize', bar: false, title: 'Guides, every format at once, project (Composition menu)', fits: ['none'], owns: ['deliver', 'quick', 'tools'],
    groups: [
      { id: 'guides', label: 'Guides & Safe Areas', kind: 'tiles', section: 'layout', ids: ['g12', 'thirds', 'gpCenter', 'gpGolden', 'gpTv', 'safe', 'gpClear', 'gpTiktok', 'gpReels', 'gpShorts', 'gpStories', 'split2', 'quad', 'wall6'], more: 'layout', fits: ['none'], open: true },
      { id: 'project', label: 'Deliver & Project', kind: 'acts', fits: [], open: true, hero: ['quick:dupComp'], minor: ['quick:revealFolder', 'quick:purge', 'quick:k_trash'],
        refs: ['quick:dupComp', 'quick:revealProject', 'quick:openPrecomp', 'quick:revealFolder', 'quick:purge', 'quick:k_trash'], lead: [['deliver', 'Every format at once (16:9, 9:16, 1:1, 4:5…)']] }
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
  if (ref.indexOf('tile:') === 0 && ref.indexOf('/') < 0) {
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
    title: `${rd.ok || a.nav ? a.label : `${a.label} — ${rd.hint}`}${a.hint ? `\n${a.hint}` : ''}`,
    onclick: (e) => { if (!rd.ok && !a.nav) app.toast(`${a.label}: ${rd.hint}`, 4500, 'warn'); else { if (onRun) onRun(); a.run(app, e); } }
  }, icon(a.icon || 'bolt', size === 's' ? 'xs' : ''), h('span', {}, a.label));
}
const linkRow = (app, links) => (links || []).map(([id, label]) => h('button', { class: 'ae-link', 'data-key': `l-${id}`, onclick: () => app.go(id) }, h('span', {}, label), icon('chev', 'xs')));

/** v0.31: columns that fit the count, so no tile sits alone on a row (normal width, wide panel). */
function tileCols(n) {
  const c = n % 3 === 0 ? 3 : n % 4 === 0 ? 4 : n % 2 === 0 ? 2 : Math.min(n, 3);
  const cw = n <= 6 ? n : n % 2 === 0 ? n / 2 : n % 3 === 0 ? n / 3 : 6;
  return { c, cw };
}
/** Expressions with "Sliders" on: the numbers go on Slider Controls (what the old Excite / Jump rigs did). */
const liveOn = (app) => !!app.services.store.get('ae-x-live', false);
const withLive = (app, g, t) => (g.live && liveOn(app) ? Object.assign({}, t, { args: Object.assign({}, t.args, { live: true }) }) : t);
function tileStrip(app, g, tab, idsOverride) {
  const lib = require('./studio/library');
  const sec = studio.byId(g.section);
  const tiles = (idsOverride || g.ids).map((id) => sec.tiles.find((t) => t.id === id)).filter(Boolean);
  if (g.compact) return compactTiles(app, g, tab, sec, tiles);
  const { c, cw } = tileCols(tiles.length);
  return h('div', { class: 'ae-tiles fit', style: { '--c': String(c), '--cw': String(cw) } }, tiles.map((t0) => {
    const t = withLive(app, g, t0);
    const rd = lib.readiness(app, t);
    return h('button', {
      class: `ae-tile ${rd.ok ? '' : 'off'}`, 'data-key': `t-${sec.id}/${t.id}`, 'aria-label': `Apply ${t.label}`,
      title: rd.ok ? `${t.label} — click to apply · right-click to open its settings` : `${t.label} — ${rd.hint}`,
      onclick: () => (rd.ok ? (remember(app, tab, `tile:${sec.id}:${t.id}`), lib.applyNow(app, t, sec)) : app.toast(`${t.label}: ${rd.hint}`, 4500, 'warn')),
      oncontextmenu: (e) => { e.preventDefault(); openTile(app, sec, t); }
    }, lib.thumbEl(lib.tileThumb(app, t)), h('span', { class: 'ae-tile-l' }, t.label));
  }));
}
/** Tool tiles whose thumbnail is only an icon: a button is the right size for them (primary first and larger). */
function compactTiles(app, g, tab, sec, tiles) {
  const lib = require('./studio/library');
  const btn = (t, size) => {
    const rd = lib.readiness(app, t);
    return h('button', {
      class: `ae-act ${size === 'l' ? 'l' : ''} ${rd.ok ? '' : 'off'}`, 'data-key': `t-${sec.id}/${t.id}`, 'aria-label': `Apply ${t.label}`,
      title: rd.ok ? `${t.label} — ${t.hint || 'click to apply'} · right-click: settings` : `${t.label} — ${rd.hint}`,
      onclick: () => (rd.ok ? (remember(app, tab, `tile:${sec.id}:${t.id}`), lib.applyNow(app, t, sec)) : (t.needsInput ? openTile(app, sec, t) : app.toast(`${t.label}: ${rd.hint}`, 4500, 'warn'))),
      oncontextmenu: (e) => { e.preventDefault(); openTile(app, sec, t); }
    }, icon((t.thumb && t.thumb.icon) || sec.icon || 'bolt', size === 'l' ? '' : 'sm'), h('span', {}, t.label));
  };
  const hero = tiles.filter((t) => (g.hero || []).includes(t.id)), rest = tiles.filter((t) => !hero.includes(t));
  return [hero.length ? h('div', { class: 'ae-hero' }, hero.map((t) => btn(t, 'l'))) : null, h('div', { class: 'ae-acts ae-acts-2' }, rest.map((t) => btn(t)))];
}
/** The right side of a group header: the Sliders switch (expressions) and "All n ›". */
function groupExtra(app, g) {
  const on = liveOn(app);
  const live = g.live ? h('button', { class: `ae-more ae-live ${on ? 'on' : ''}`, 'data-key': `live-${g.id}`, 'aria-pressed': String(on),
    title: on ? 'Sliders on: the numbers go on Slider Controls you can animate (Excite / Jump rigs)' : 'Sliders off: plain expressions — turn on to get Slider Controls',
    onclick: (e) => { e.stopPropagation(); app.services.store.set('ae-x-live', !on); app.render(); } }, icon('sliders', 'xs'), 'Sliders') : null;
  return live || g.more ? [live, g.more ? moreLink(app, g) : null] : null;
}
/** v0.46: "Shift add · Alt remove" — the Select modifiers, said once under the rows (a quiet line, not in the header). */
const keysHint = () => h('div', { class: 'ae-keys', 'data-key': 'sel-keys', title: 'Shift-click a Select button: add to the selection · Alt-click: take away from it' },
  h('kbd', {}, 'Shift'), ' add · ', h('kbd', {}, 'Alt'), ' remove');
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
  if (g.kind === 'reader') return readerBody(app);
  const kit = require('./views/kit');
  if (g.kind === 'kit') {
    // the group's twirl is the fold here: the block renders open (a scope nobody folds)
    const prev = kit.K.scope; kit.K.scope = { ctx: '__classic', focus: ['ease', 'anchorAlign', 'anchor', 'align', 'pinned'] };
    try { return g.block === 'ease' ? kit.easeBlock(app) : g.block === 'align' ? kit.alignBlock(app) : kit.anchorBlock(app); } finally { kit.K.scope = prev; }
  }
  if (g.kind === 'curves') return kit.curveLibrary(app, kit.matchPreset(kit.K.curve, app.services.store.get('kit-curves', [])));
  if (g.kind === 'kitTools') { const BAR = require('../../features/quick/bar'); const grp = BAR.KIT_GROUPS.find(([n]) => n === g.group); return kit.toolsBlock(app, { ids: grp ? grp[1] : [], title: g.group, cls: 'ae-kit', onRun: (id) => remember(app, t, `kit:${id}`) }); }
  // v0.43 (SMART_ARRANGE): a family (Mirror / Clone keys, Easy / Linear / Hold …) is one unit that wraps as a whole
  const row = (cls, refs, size, tail) => {
    const ok = AR.group(refs || []).filter((r) => A.resolve(r));
    const kids = runsOf(app, t, ok, size);
    return kids.length || (tail && tail.length) ? h('div', { class: cls }, kids, tail || null) : null;
  };
  if (g.kind === 'acts') {
    // importance decides size and place: primary first and larger, minor last as chips;
    // v0.31: a pair (Flip ↔ / ↕) is one control, a labelled row (Loop: Cycle · Ping-Pong …) is one line
    const hero = g.hero || [], minor = g.minor || [];
    const paired = (g.pairs || []).flatMap(([, ...refs]) => refs);
    const lead = (g.lead || []).map(([id, label]) => h('button', { class: 'ae-lead', 'data-key': `lead-${id}`, onclick: () => app.go(id) }, icon((studio.byId(id) || {}).icon || 'chev', 'sm'), h('span', {}, label), icon('chev', 'xs')));
    const inRows = (g.rows || []).flatMap((rw) => rw[1]);
    const std = g.refs.filter((r) => !hero.includes(r) && !minor.includes(r) && !paired.includes(r) && !inRows.includes(r));
    return [...lead, row('ae-hero flow', hero, 'l'),
      row('ae-acts flow', std, undefined, (g.pairs || []).map((p) => pairControl(app, t, p))),
      ...(g.rows || []).map((rw) => subRow(app, t, rw)), g.keys ? keysHint() : null, row('ae-minor', minor, 's'), ...linkRow(app, g.links)];
  }
  if (g.kind === 'animate') return animateBlock(app, g, t);
  if (g.kind === 'tiles') return [tileStrip(app, g, t), row('ae-minor', g.minor, 's'), ...linkRow(app, g.links)];
  if (g.kind === 'grid') return [require('./gridPanel').render(app), tileStrip(app, g, t), row('ae-minor', g.minor, 's')];
  return linkRow(app, g.links);
}

/**
 * v0.43: "Next" after the last tool — one line of fixed height once anything has run (it never comes and goes, so
 * nothing around it moves while you aim). When nothing usually follows the last tool it offers Repeat (F4).
 */
function nextStrip(app, s, cls, key) {
  if (!s.last) return null;
  const refs = require('./workflow').nextAfter(s.last);
  const head = h('span', { class: 'b-next-h' }, icon('chev', 'xs'), h('span', {}, refs.length ? 'Next' : 'Last'), h('span', { class: 'b-next-after' }, refs.length ? `after ${s.last.label}` : s.last.label));
  const body = refs.length ? refs.map((r) => actButton(app, A.resolve(r), null, 's'))
    : [h('button', { class: 'ae-act s', 'data-key': `${key}-repeat`, title: `Repeat “${s.last.label}” on the current selection (F4)`, disabled: !!s.running, onclick: () => app.repeatLast() }, icon('repeat', 'sm'), h('span', {}, 'Repeat · F4'))];
  return h('div', { class: cls, 'data-key': key, role: 'group', 'aria-label': refs.length ? `Next after ${s.last.label}` : `Last: ${s.last.label}` }, head, body);
}
/** Buttons for refs, a run of one family wrapped in one unbreakable .fam (it moves to the next line as a whole). */
function runsOf(app, t, refs, size) {
  return AR.runs(refs).map((run) => {
    const btns = run.map((r) => actButton(app, A.resolve(r), () => remember(app, t, r), size));
    return run.length > 1 ? h('div', { class: 'fam', role: 'group', 'aria-label': AR.familyOf(run[0]).name, style: { '--n': String(run.length) } }, btns) : btns[0];
  });
}
/** One control for two opposite actions: [Flip  ↔ | ↕]. */
function pairControl(app, t, [label, ...refs]) {
  const acts = refs.map((r) => [r, A.resolve(r)]).filter(([, a]) => a);
  return h('div', { class: 'ae-pair', role: 'group', 'aria-label': label, 'data-key': `pair-${label}` }, h('span', { class: 'ae-pair-l' }, label),
    acts.map(([r, a]) => { const rd = a.ready(app); return h('button', { class: `ae-pair-b ${rd.ok ? '' : 'off'}`, 'data-key': `a-${a.id}`, 'aria-label': a.label, title: rd.ok ? a.label : `${a.label} — ${rd.hint}`,
      onclick: () => (rd.ok ? (remember(app, t, r), a.run(app)) : app.toast(`${a.label}: ${rd.hint}`, 4500, 'warn')) }, icon(a.icon || 'bolt', 'sm')); }));
}
/** A labelled line of related actions: "Loop  Cycle · Ping-Pong · Offset · In + Out" (labels shortened, the full name is the tooltip). */
function subRow(app, t, [label, refs, short]) {
  const acts = refs.map((r, i) => [r, A.resolve(r), (short || [])[i]]).filter(([, a]) => a);
  return h('div', { class: 'ae-subrow', role: 'group', 'aria-label': label, 'data-key': `row-${label}` }, h('span', { class: 'ae-sub-l' }, label),
    h('div', { class: `ae-sub-b n${Math.min(acts.length, 4)}` }, acts.map(([r, a, s]) => { const rd = a.ready(app); return h('button', { class: `ae-act ${rd.ok ? '' : 'off'}`, 'data-key': `a-${a.id}`, 'aria-label': a.label, title: `${rd.ok ? a.label : `${a.label} — ${rd.hint}`}${a.hint ? `\n${a.hint}` : ''}`,
      onclick: (e) => (rd.ok ? (remember(app, t, r), a.run(app, e)) : app.toast(`${a.label}: ${rd.hint}`, 4500, 'warn')) }, icon(a.icon || 'bolt', 'sm'), h('span', {}, s || a.label)); })));
}
/** Animate In / Out / Draw On — one block, the mode switch picks the six (or four) moves. Shapes open on Draw On. */
const ANIM_KEY = 'ae-anim-mode';
const modeKey = (g) => (g.id === 'in' ? ANIM_KEY : `ae-mode-${g.id}`);
/** The mode a switch group shows: your last pick; else what fits the selection (a MOE Grid selected → its own mode). */
function animMode(app, g) {
  const saved = app.services.store.get(modeKey(g), null);
  if (g.modes.some(([m]) => m === saved)) return saved;
  const c = app.state.get().ctx;
  const kind = A.profile(c);
  if (g.modeFor) {
    const gridSel = c && (c.layers || []).some((l) => /^MOE (Grid|Effector) \d+$/.test(l.name));
    const m = gridSel ? g.modeFor.grid : g.modeFor[kind];
    if (m && g.modes.some(([x]) => x === m)) return m;
    return g.modes[0][0];
  }
  return kind === 'shapes' || kind === 'shapesMany' ? 'draw' : 'in';
}
function animateBlock(app, g, t) {
  const mode = animMode(app, g);
  const cur = g.modes.find(([m]) => m === mode);
  return [h('div', { class: 'kit-seg ae-modes', role: 'group', 'aria-label': 'Animate', 'data-key': 'ae-modes' }, g.modes.map(([m, label]) => h('button', {
    'aria-pressed': String(m === mode), 'data-key': `mode-${m}`, title: { in: 'Animate in: the layer arrives', out: 'Animate out: the layer leaves', draw: 'Draw On: trim paths for shape lines', arrange: 'Arrange the selected layers on a live grid', clone: 'One layer → many live copies (select one layer)', effect: 'Effectors: change a grid’s items near a moving null (select the grid)' }[m] || label,
    onclick: () => { app.services.store.set(modeKey(g), m); app.render(); } }, label))),
  g.panel === 'grid' ? require('./gridPanel').render(app) : null, tileStrip(app, g, t, cur[2])];
}

/* ---------- v0.67 Layer Reader (docs/features/SMART_LAYER.md) ---------- */
const selKey = (ctx) => ((ctx && ctx.layers) || []).map((l) => l.id).join(',');
/** One host call, on the user's click (or right after an edit / removal made here) — never a background poll. */
async function readLayers(app) {
  const ctx = app.state.get().ctx;
  if (!ctx || !ctx.comp || !(ctx.layers || []).length) return;
  const key = selKey(ctx);
  app.state.set({ reader: { key, busy: true } });
  try {
    const r = await app.services.host.call('rigs.find', { compId: ctx.comp.id, layers: ctx.layers.map((l) => l.id) });
    app.state.set({ reader: { key, layers: r.layers } });
  } catch (e) {
    app.state.set({ reader: { key, error: e.message || String(e) } });
  }
}
function editRow(app, row) {
  const lib = require('./studio/library'), sec = studio.byId('expressions'), tid = `x-${row.edit.preset}`;
  app.state.set((st) => ({ args: Object.assign({}, st.args, { 'expressions.quick': Object.assign({ preset: row.edit.preset }, row.edit.values) }) }));
  lib.setSt(app, sec, { tile: tid, filled: tid, open: true, filter: 'All', q: '' });
  app.go('expressions');
}
async function removeRow(app, layer, row) {
  await app.runTool('kit.removeRig', { layerId: layer.layerId, only: JSON.stringify(row.only) }, { label: `Remove ${row.label}` });
  await readLayers(app);
}
function readerBody(app) {
  const RD = require('../../features/kit/reader');
  const s = app.state.get(), ctx = s.ctx;
  if (!ctx || !(ctx.layers || []).length) return h('div', { class: 'why rd-empty' }, 'Select a layer to see what MOE did to it.');
  const rd = s.reader && s.reader.key === selKey(ctx) ? s.reader : null;
  const head = h('div', { class: 'rd-head' },
    h('button', { class: 'btn sm', 'data-key': 'rd-read', disabled: !!(rd && rd.busy), title: 'Read the MOE expressions and effects on the selected layers (one quick read)', onclick: () => readLayers(app) },
      rd && rd.busy ? h('span', { class: 'spin' }) : icon('eye', 'sm'), rd && rd.layers ? 'Read again' : 'Read this layer'),
    rd && rd.layers ? h('span', { class: 'rd-sum' }, (() => { const n = rd.layers.reduce((k, l) => k + RD.describe(l).length, 0); return n ? `${n} MOE item${n === 1 ? '' : 's'}` : 'nothing from MOE'; })()) : h('span', { class: 'rd-sum dim' }, `${ctx.layers.length} layer${ctx.layers.length === 1 ? '' : 's'} selected`));
  if (!rd || rd.busy) return [head];
  if (rd.error) return [head, h('div', { class: 'tc-needs' }, icon('info', 'xs'), h('span', {}, rd.error))];
  return [head, rd.layers.map((L) => {
    const rows = RD.describe(L);
    return h('div', { class: 'rd-layer', 'data-key': `rd-l-${L.layerId}` },
      rd.layers.length > 1 ? h('div', { class: 'rd-lname' }, L.name) : null,
      rows.length ? rows.map((row) => h('div', { class: `rd-row ${row.off ? 'off' : ''}`, 'data-key': `rd-${L.layerId}-${row.key}` },
        icon(row.kind === 'effect' ? 'sliders' : 'expr', 'sm'),
        h('div', { class: 'rd-text' }, h('div', { class: 'rd-label' }, h('b', {}, row.label), h('span', { class: 'rd-on' }, row.on)), row.detail ? h('div', { class: 'rd-detail' }, row.detail) : null),
        row.edit ? h('button', { class: 'btn ghost sm', 'data-key': `rd-edit-${L.layerId}-${row.key}`, title: `Open ${row.label} with these numbers — Apply replaces it in place`, onclick: () => editRow(app, row) }, 'Edit') : null,
        h('button', { class: 'icon-btn', 'data-key': `rd-rm-${L.layerId}-${row.key}`, 'aria-label': `Remove ${row.label} from ${L.name}`, title: `Remove only ${row.label} (one Ctrl+Z brings it back)`, disabled: !!s.running, onclick: () => removeRow(app, L, row) }, icon('trash', 'sm'))))
        : h('div', { class: 'rd-none' }, `Nothing from MOE on ${L.name}.`));
  })];
}

/* ---------- v0.30 Motion Control: one block at the top of every style (keys + anchor + align) ---------- */
/** The Motion Control for the selection, or null when nothing is selected (then the page is about creating). */
function controlTop(app, kind, parts) {
  const c = app.state.get().ctx;
  if (!c || !c.comp || kind === 'none') return null;
  const kit = require('./views/kit');
  // v0.31: the graph opens when keys are selected; with layers only, the compact strip (curve · Copy / Paste ·
  // anchor · align) keeps every placement tool in ~90 px. Open or fold it yourself: remembered per kind of selection.
  // v0.65 (WORKSPACES.md): the compact Motion Bar by default for every selection — the full graph opens from its Graph
  // button (remembered per kind of selection) and always lives in MOE's Timing tab, so it no longer tops every page
  const prev = kit.K.scope; kit.K.scope = { ctx: `__bar-${kind}`, focus: ['pinned'], parts };
  try { return kit.controlBlock(app); } finally { kit.K.scope = prev; }
}
/** v0.65: what tops a MOE tab — the part of the Motion Control that tab's work needs: Timing the full graph,
    Animate the Motion Bar (ease), Layer the anchor + align, Design / Look / Deliver nothing (building, not moving). */
function tabControl(app, tab, kind) {
  if (tab.full) return controlFull(app, kind);
  return tab.bar === false ? null : controlTop(app, kind, tab.bar);
}
/** v0.65: the full Motion Control (graph open) — MOE's Timing tab. */
function controlFull(app, kind) {
  const c = app.state.get().ctx;
  if (!c || !c.comp) return null;
  const kit = require('./views/kit');
  const prev = kit.K.scope; kit.K.scope = { ctx: `__timing-${kind}`, focus: ['ease', 'pinned'] };
  try { return kit.controlBlock(app); } finally { kit.K.scope = prev; }
}

/** v0.45 (NO_REPEATS): the one-click refs an open group shows right now (tiles as 'tile:<section>/<id>'). */
function shownRefs(app, g, kind) {
  if (!isOpen(app, g, kind)) return [];
  if (g.kind === 'acts') return [].concat(g.refs || [], g.hero || [], g.minor || [], ...(g.rows || []).map((rw) => rw[1]), ...(g.pairs || []).map(([, ...refs]) => refs));
  if (g.kind === 'animate') { const m = g.modes.find(([id]) => id === animMode(app, g)) || g.modes[0]; return m[2].map((id) => `tile:${g.section}/${id}`); }
  if (g.kind === 'tiles') return (g.ids || []).map((id) => `tile:${g.section}/${id}`);
  return [];
}
/** v0.45 (NO_REPEATS): which parts of the Motion Control controlTop shows — { rail, ease }, or null (none). */
function controlShows(app, kind) {
  const c = app.state.get().ctx;
  if (!c || !c.comp || kind === 'none') return null;
  const kit = require('./views/kit');
  const sc = { ctx: `__bar-${kind}`, focus: ['pinned'] };
  // v0.65: with keys selected the Motion Bar shows Easy / Linear / Hold and the common curves even when folded
  return { rail: true, ease: kind === 'keys' || !kit.isFolded(kit.prefs(app), sc, 'ease') };
}

/** v0.30: the steps that usually follow the last run (MOE puts them under the Motion Control). */
function nextStrip(app, s) {
  const refs = require('./workflow').nextAfter(s.last);
  if (!refs.length) return null;
  return h('div', { class: 'b-next ae-next', 'data-key': 'ae-next', role: 'group', 'aria-label': `Next after ${s.last.label}` },
    h('span', { class: 'b-next-h' }, h('span', {}, 'Next'), h('span', { class: 'b-next-after' }, `after ${s.last.label}`)), refs.map((r) => actButton(app, A.resolve(r), null, 's')));
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
  }, icon(it.icon || 'tools', 'sm'), h('span', { class: 'ae-res-n' }, it.name), h('span', { class: 'ae-res-d' }, it.desc), it.kind === 'preset' || it.kind === 'action' ? h('span', { class: 'ae-res-a' }, 'apply') : h('span', { class: 'ae-res-w' }, it.ws))));
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
    else if (g.kind === 'tiles' || g.kind === 'grid' || g.kind === 'animate') { const sec = studio.byId(g.section); items = g.ids.map((id) => sec.tiles.find((x) => x.id === id)).filter(Boolean).map((x) => ({ id: x.id, ref: `tile:${sec.id}:${x.id}`, label: x.label, icon: sec.icon, run: () => lib.applyNow(app, x, sec), ready: lib.readiness(app, x) })); }
    const open = { id: `open-${g.id}`, label: g.kind === 'tiles' || g.kind === 'grid' || g.kind === 'animate' ? `All ${g.label}…` : `Open ${g.label}`, icon: 'chev', nav: true, run: () => { const kind = A.profile(app.state.get().ctx); setOpen(app, g, kind, true); app.go(t.id); } };
    if (g.kind === 'links') items = (g.links || []).map(([id, label]) => ({ id: `l-${id}`, label, icon: 'chev', nav: true, run: () => app.go(id), ready: { ok: true } }));
    const extra = (g.minor && g.kind !== 'acts' ? g.minor : []).concat((g.rows || []).flatMap(([, refs]) => refs)).map((r) => [r, A.resolve(r)]).filter(([, a]) => a).map(([r, a]) => ({ id: a.id, ref: r, label: a.label, icon: a.icon, run: () => a.run(app), ready: a.ready(app) }));
    items = items.concat(extra);
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
      item('sparkles', 'Assistant (` or Ctrl+Space)', () => app.openCopilot(), 'copilot'),
      item('lightbulb', 'Explain the Power tools again', () => { require('./workflow').explainAgain(app.services.store); app.go('home'); }, 'explain'),
      h('div', { class: 'ae-msep' }),
      item('star', 'Favorites', () => app.go('favorites'), 'fav'),
      item('history', 'History', () => app.go('history'), 'history'),
      item('bolt', 'Customize Quick Bar', () => app.go('quick'), 'qb'),
      item('tools', 'My tools & Tool Factory', () => app.go('tools'), 'tools'),
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
  else if (isTab) content = h('div', { class: 'view kit ae-page' }, h('div', { class: `ae-control${tab.full ? ' is-full' : ''}`, 'data-key': 'ae-control' }, tabControl(app, tab, kind), nextStrip(app, s)), groupsOf(app, tab).filter((g) => g.kind !== 'recent' || recentRefs(app, tab).length).map((g) => twirl(app, tab, g, kind, () => groupBody(app, g, tab),
    g.kind === 'recent' ? h('button', { class: 'ae-more', 'data-key': `clear-${tab.id}`, title: `Clear Recent in ${tab.label}`, onclick: () => clearRecent(app, tab) }, 'Clear') : groupExtra(app, g))));
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
      t.icon ? icon(t.icon, 'xs') : null, h('span', { class: 'ae-tab-name' }, t.label), hint ? h('span', { class: 'ae-dot', 'aria-hidden': 'true' }) : null),
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

/** The panel menu button (≡), shared by the v0.24 style proposals. */
function menuButton(app, s) {
  return h('button', { class: 'icon-btn ae-menubtn', title: 'Panel menu', 'aria-label': 'Panel menu', 'aria-haspopup': 'true', 'aria-expanded': String(!!s.aeMenu),
    onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(), box = require('./quickbar').fixedBox(e.currentTarget.closest('.app') || document.body); app.state.set({ aeMenu: !s.aeMenu, aeMenuAt: { top: Math.round(r.bottom - box.top + 2), right: Math.max(4, Math.round(box.left + box.width - r.right)) } }); } }, icon('menu', 'sm'));
}

module.exports = { readLayers, readerBody, runsOf, nextStrip, controlTop, controlFull, tabControl, controlShows, shownRefs, tileCols, animMode, TABS, TAB_IDS, RECENT, UTIL, ownerOf, isOpen, setOpen, build, tabItems, groupsOf, moveGroup, resetOrder, remember, recentRefs, recentItem,
  // building blocks reused by the v0.24 style proposals (layoutGlass / layoutApple / layoutBento)
  twirl, actButton, keysHint, groupBody, tileStrip, moreLink, groupExtra, subRow, pairControl, linkRow, searchBox, searchResults, panelMenu, menuButton, openTile };
