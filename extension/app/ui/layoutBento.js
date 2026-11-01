'use strict';
/**
 * Style proposal v0.24 — "Bento" (MOE's own proposal, docs/features/STYLE_PROPOSALS.md).
 *
 * Look: near-black canvas, bento tiles of different sizes with soft gradient rims; the accent glows
 * only on what matters most; display type for section titles.
 * Organisation, rethought around importance — no tabs at all, one scroll:
 *   NOW      the big tool for the selection (ease graph for keys, align / anchor for layers) + the
 *            eight best actions: two wide primary tiles, six square ones
 *   index    Keys · Animate · Layer · Design · Effect · Comp — chips that jump down the page
 *   sections each Classic group as bento: primary 2×1 · standard 1×1 · rare as a strip of chips ·
 *            presets as a sideways shelf · blocks full width
 * Size = importance, everywhere. Same tools, tiers and Recent memory as Classic.
 */
const { h, icon } = require('./dom');
const A = require('./actions');
const AE = require('./layoutAE');
const studio = require('./studio/sections');

/* v0.25: your own tiles on top (right-click a tile: pin / unpin to NOW), folded sections */
const PIN_KEY = 'bento-pins', FOLD_KEY = 'bento-fold', PIN_MAX = 4;
const pins = (app) => (app.services.store.get(PIN_KEY, []) || []).filter((r) => A.resolve(r)).slice(0, PIN_MAX);
function togglePin(app, ref, label) {
  const cur = app.services.store.get(PIN_KEY, []) || [];
  const on = cur.includes(ref);
  if (!on && cur.length >= PIN_MAX) { app.toast(`NOW holds ${PIN_MAX} pinned tiles — unpin one first (right-click it)`, 4000, 'warn'); return; }
  app.services.store.set(PIN_KEY, on ? cur.filter((r) => r !== ref) : cur.concat([ref]));
  app.toast(on ? `${label} unpinned from NOW` : `${label} pinned to NOW`, 2200, 'ok');
  app.render();
}
let pinDrag = null;
/** Put pinned ref before another pinned ref (saved). */
function movePin(app, ref, beforeRef) {
  const cur = (app.services.store.get(PIN_KEY, []) || []).filter((r) => r !== ref);
  const at = cur.indexOf(beforeRef);
  cur.splice(at < 0 ? cur.length : at, 0, ref);
  app.services.store.set(PIN_KEY, cur);
  app.render();
}
const folded = (app, id) => !!(app.services.store.get(FOLD_KEY, {}) || {})[id];
function toggleFold(app, id) { const all = Object.assign({}, app.services.store.get(FOLD_KEY, {}) || {}); all[id] = !all[id]; app.services.store.set(FOLD_KEY, all); app.render(); }

/** An action as a bento tile. size: '2x1' (primary) | '1x1'. Right-click pins it to NOW. */
function tile(app, a, size, t, ref, sub) {
  const rd = a.ready(app);
  const pinned = ref && pins(app).includes(ref);
  return h('button', {
    class: `bt b-${size} ${rd.ok || a.nav ? '' : 'off'} ${pinned ? 'pinned' : ''}`, 'data-key': `a-${a.id}`, 'aria-label': a.label,
    title: `${rd.ok || a.nav ? a.label : `${a.label} — ${rd.hint}`}\nRight-click: ${pinned ? 'unpin from' : 'pin to'} NOW`,
    onclick: () => { if (!rd.ok && !a.nav) app.toast(`${a.label}: ${rd.hint}`, 4500, 'warn'); else { if (t && ref) AE.remember(app, t, ref); a.run(app); } },
    oncontextmenu: (e) => { if (!ref) return; e.preventDefault(); togglePin(app, ref, a.label); },
    // v0.26: pinned tiles reorder by drag (inside NOW)
    draggable: pinned ? 'true' : undefined,
    ondragstart: pinned ? (e) => { pinDrag = ref; try { e.dataTransfer.setData('text/plain', ref); e.dataTransfer.effectAllowed = 'move'; } catch (_) { /* old CEP */ } } : undefined,
    ondragover: pinned ? (e) => { if (pinDrag && pinDrag !== ref) { e.preventDefault(); e.currentTarget.classList.add('drop-before'); } } : undefined,
    ondragleave: pinned ? (e) => e.currentTarget.classList.remove('drop-before') : undefined,
    ondrop: pinned ? (e) => { e.preventDefault(); e.currentTarget.classList.remove('drop-before'); const r = pinDrag; pinDrag = null; if (r && r !== ref) movePin(app, r, ref); } : undefined,
    ondragend: pinned ? () => { pinDrag = null; } : undefined
  }, icon(a.icon || 'bolt', size === '2x1' ? 'lg' : ''), h('span', { class: 'bt-l' }, a.label), sub ? h('span', { class: 'bt-s' }, sub) : null,
  pinned ? h('span', { class: 'bt-pin', 'aria-hidden': 'true' }, icon('star', 'xs')) : null);
}
const wide = (key, ...kids) => h('div', { class: 'bt b-4 bt-block', 'data-key': key }, ...kids);
const caption = (key, text, extra) => h('div', { class: 'b-cap', 'data-key': key }, h('span', {}, text), extra || null);

/** The kit block that leads NOW for this kind of selection (and is then left out of its section). */
const nowBlock = (kind) => (kind === 'keys' ? 'ease' : kind === 'layers' || kind === 'shapesMany' ? 'align' : kind === 'none' ? null : 'anchor');

/** v0.26: the client you work for, one click away in NOW (when layers are selected). */
function brandNow(app, kind) {
  const b = require('../../features/brand/kit').activeBrand(app.services.store, app.services.brands);
  if (!b || kind === 'none' || kind === 'keys' || pins(app).includes('brand:apply')) return null;
  const a = A.resolve('brand:apply');
  return a ? tile(app, a, '2x1', null, 'brand:apply', b.name) : null;
}

/** v0.28: the comp's shape and size at a glance — 9:16 Reels, 1:1 feed, 16:9 YouTube, 4K… */
function formatChip(f) {
  if (!f) return null;
  return h('span', { class: `b-fmt fmt-${f.shape}`, 'data-key': 'b-fmt', title: `${f.label} · ${f.ratio} · ${f.use}${f.fps ? ` · ${f.fps} fps` : ''}` },
    h('span', { class: 'b-fmt-box', 'aria-hidden': 'true' }), h('span', {}, `${f.ratio} · ${f.size}${f.fps ? ` · ${f.fps}` : ''}`), h('span', { class: 'b-fmt-use' }, f.use));
}

function now(app, s, kind) {
  const kit = require('./views/kit');
  const c = s.ctx;
  const nb = nowBlock(kind);
  const mineRefs = pins(app);
  const mine = mineRefs.map((r) => [r, A.resolve(r)]).filter(([, a]) => a);
  const acts = (A.SETS[kind] || []).map((r) => [r, A.resolve(r)]).filter(([, a]) => a).slice(0, 8);
  let block = null;
  if (nb && c && c.comp) {
    const prev = kit.K.scope; kit.K.scope = { ctx: '__classic', focus: ['ease', 'anchorAlign', 'anchor', 'align', 'pinned'] };
    try { block = nb === 'ease' ? kit.easeBlock(app) : nb === 'align' ? kit.alignBlock(app) : kit.anchorBlock(app); } finally { kit.K.scope = prev; }
  }
  return h('section', { class: 'b-sec b-now', 'data-key': 'b-now', 'aria-label': 'Now' },
    h('div', { class: 'b-now-h' }, h('span', { class: 'b-kick' }, 'NOW'), h('b', {}, !c ? 'Reading After Effects…' : !c.comp ? 'No active composition' : A.CONTEXT_LABEL[kind]),
      c && c.comp ? h('span', { class: 'b-now-s' }, `${c.comp.name} · ${(c.layers || []).length} selected`) : null,
      c && c.comp ? formatChip(require('./workflow').formatOf(c.comp)) : null),
    // v0.29: the anchor point is a one-second action — half the width (2×2 cell), the actions fill the rest;
    // ease (keys) and align (several layers) are real working surfaces and keep the full width
    h('div', { class: 'b-grid' }, block ? (nb === 'anchor' ? h('div', { class: 'bt b-2x1 b-tall bt-block bt-anchor', 'data-key': 'now-block' }, block) : wide('now-block', block)) : null,
      // your pinned tiles first (same size as primary), then the best actions for the selection — no duplicates
      mine.map(([r, a]) => tile(app, a, '2x1', null, r, 'pinned')),
      brandNow(app, kind),
      acts.filter(([r]) => !mineRefs.includes(r)).map(([r, a], i) => tile(app, a, i < 2 && !mine.length && nb !== 'anchor' ? '2x1' : '1x1', null, r))));
}

function groupTiles(app, t, g, kind, skipBlock) {
  if (g.kind === 'kit' && g.block === skipBlock) return [];
  const cap = caption(`cap-${g.id}`, g.label, g.more ? AE.moreLink(app, g) : g.fits.includes(kind) ? h('span', { class: 'ae-fit' }, 'for selection') : null);
  if (g.kind === 'acts') {
    const hero = g.hero || [], minor = g.minor || [];
    const pick = (refs) => refs.map((r) => [r, A.resolve(r)]).filter(([, a]) => a);
    const minorTiles = pick(minor);
    return [cap,
      ...pick(hero).map(([r, a]) => tile(app, a, '2x1', t, r)),
      ...pick(g.refs.filter((r) => !hero.includes(r) && !minor.includes(r))).map(([r, a]) => tile(app, a, '1x1', t, r)),
      minorTiles.length ? h('div', { class: 'b-4 b-chips', 'data-key': `minor-${g.id}` }, minorTiles.map(([r, a]) => AE.actButton(app, a, () => AE.remember(app, t, r), 's'))) : null,
      ...(g.links || []).map(([id, label]) => h('button', { class: 'bt b-2x1 bt-link', 'data-key': `l-${id}`, 'aria-label': label, onclick: () => app.go(id) }, icon('chev', ''), h('span', { class: 'bt-l' }, label)))];
  }
  if (g.kind === 'links') return [cap, ...(g.links || []).map(([id, label]) => { const sec = studio.byId(id); return h('button', { class: 'bt b-2x1 bt-link', 'data-key': `l-${id}`, 'aria-label': `Open ${sec ? sec.label : label}`, onclick: () => app.go(id) }, icon((sec && sec.icon) || 'chev', 'lg'), h('span', { class: 'bt-l' }, sec ? sec.label : label), h('span', { class: 'bt-s' }, label)); })];
  return [cap, wide(`w-${g.id}`, AE.groupBody(app, g, t))];
}

/* ---------- v0.28 Power tools: big cards that explain themselves until you have used them ---------- */
function powerCard(app, p, kind) {
  const W = require('./workflow');
  const open = A.resolve(p.open);
  const tryA = p.try ? A.resolve(p.try) : null;
  const rd = tryA ? tryA.ready(app) : null;
  const fit = p.fits.includes(kind);
  const go = (a) => { W.learn(app.services.store, p.id); a.run(app); };
  return h('article', { class: `pw-card ${fit ? 'fit' : ''}`, 'data-key': `pw-${p.id}`, 'aria-label': p.title },
    h('div', { class: 'pw-top' }, h('span', { class: 'pw-ic' }, icon(p.icon, 'lg')), h('b', { class: 'pw-t' }, p.title),
      fit ? h('span', { class: 'ae-fit' }, 'for selection') : null, h('span', { class: 'spacer' }),
      h('button', { class: 'icon-btn pw-got', 'data-key': `pw-got-${p.id}`, 'aria-label': `I know ${p.title} — make it small`, title: 'Got it — show it as a small chip from now on', onclick: () => { W.gotIt(app.services.store, p.id); app.render(); } }, icon('check', 'sm'))),
    h('p', { class: 'pw-what' }, p.what),
    h('div', { class: 'pw-meta' }, h('span', {}, h('i', {}, 'When '), p.when), h('span', {}, h('i', {}, 'Needs '), p.needs)),
    h('ol', { class: 'pw-steps' }, p.steps.map((x) => h('li', {}, x))),
    h('div', { class: 'pw-acts' },
      tryA ? h('button', { class: `btn primary sm ${rd.ok ? '' : 'off'}`, 'data-key': `pw-try-${p.id}`, title: rd.ok ? `${tryA.label} on what you selected` : `${tryA.label} — ${rd.hint}`,
        onclick: () => (rd.ok ? go(tryA) : app.toast(`${tryA.label}: ${rd.hint}`, 4500, 'warn')) }, icon('play', 'sm'), tryA.label) : null,
      open ? h('button', { class: 'btn ghost sm', 'data-key': `pw-open-${p.id}`, title: `Open ${open.label} — every option`, onclick: () => go(open) }, `Open ${open.label}`, icon('chev', 'xs')) : null));
}
function power(app, kind) {
  const W = require('./workflow');
  const st = app.services.store;
  const big = W.POWER.filter((p) => !W.isLearned(st, p.id));
  const small = W.POWER.filter((p) => W.isLearned(st, p.id));
  const f = folded(app, 'b-power');
  return h('section', { class: `b-sec b-power ${f ? 'folded' : ''}`, 'data-key': 'b-power', 'aria-label': 'Power tools' },
    h('h2', { class: 'b-h' }, h('button', { class: 'b-fold', 'data-key': 'fold-b-power', 'aria-expanded': String(!f), title: f ? 'Open Power tools' : 'Fold Power tools', onclick: () => toggleFold(app, 'b-power') },
      icon('chev', 'xs'), h('span', {}, 'Power tools')), h('span', { class: 'b-h-n' }, big.length ? 'explained until you know them' : 'you know them all'),
      small.length && !f ? h('button', { class: 'ae-more', 'data-key': 'pw-explain', title: 'Show every card with its explanation again', onclick: () => { W.explainAgain(st); app.render(); } }, 'Explain again') : null),
    f ? null : [
      big.length ? h('div', { class: 'pw-grid' }, big.map((p) => powerCard(app, p, kind))) : null,
      small.length ? h('div', { class: 'pw-mini', 'data-key': 'pw-mini' }, small.map((p) => { const a = A.resolve(p.open); return a ? h('button', {
        class: `ae-chip ${p.fits.includes(kind) ? 'fit' : ''}`, 'data-key': `pwm-${p.id}`, 'aria-label': p.title, title: `${p.title} — ${p.what}`, onclick: () => a.run(app)
      }, icon(p.icon, 'xs'), h('span', {}, p.title)) : null; })) : null]);
}

/* ---------- v0.28 stages: Animate · Arrange · Design · Finish · Deliver ---------- */
const MORE_KEY = 'bento-more';
const moreOpen = (app, id) => !!(app.services.store.get(MORE_KEY, {}) || {})[id];
function toggleMore(app, id) { const all = Object.assign({}, app.services.store.get(MORE_KEY, {}) || {}); all[id] = !all[id]; app.services.store.set(MORE_KEY, all); app.render(); }
function stageSection(app, st, kind, skip) {
  const W = require('./workflow');
  const f = folded(app, st.id);
  const gs = W.stageGroups(st);
  const core = gs.filter((x) => x.tier === 'core'), more = gs.filter((x) => x.tier === 'more');
  const mo = moreOpen(app, st.id);
  const n = W.STAGES.indexOf(st) + 1;
  return h('section', { class: `b-sec ${f ? 'folded' : ''}`, 'data-key': `bs-${st.id}`, 'aria-label': st.label },
    h('h2', { class: 'b-h' }, h('button', { class: 'b-fold', 'data-key': `fold-${st.id}`, 'aria-expanded': String(!f), title: `${f ? 'Open' : 'Fold'} ${st.label} · Ctrl+${n} jumps here`, onclick: () => toggleFold(app, st.id) },
      icon('chev', 'xs'), icon(st.icon, ''), h('span', {}, st.label), st.fits.includes(kind) ? h('span', { class: 'ae-dot', 'aria-hidden': 'true' }) : null),
      h('span', { class: 'b-h-n' }, f ? `${gs.length} groups folded` : st.title)),
    f ? null : h('div', { class: 'b-grid' }, core.map(({ tab, group }) => groupTiles(app, tab, group, kind, skip)),
      more.length ? h('button', { class: `b-4 b-more ${mo ? 'on' : ''}`, 'data-key': `more-${st.id}`, 'aria-expanded': String(mo), title: mo ? `Hide the less used groups of ${st.label}` : `Show the less used groups of ${st.label}`, onclick: () => toggleMore(app, st.id) },
        icon('chev', 'xs'), h('span', {}, mo ? `Less in ${st.label}` : `More in ${st.label}`), h('span', { class: 'b-more-n' }, more.map((x) => x.group.label).join(' · '))) : null,
      mo ? more.map(({ tab, group }) => groupTiles(app, tab, group, kind, skip)) : null));
}

/* scroll spy: the index chip follows the section you are reading (one listener, rAF-throttled, no host calls) */
let spyApp = null, spyQueued = false, spyHoldUntil = 0, spyJump = null;
function spy() {
  spyQueued = false;
  const app = spyApp; if (!app) return;
  // after a jump (chip / Ctrl+1…5) the chip you chose stays lit while the page scrolls there
  if (Date.now() < spyHoldUntil) return;
  // a stage you jumped to stays lit while it is on screen — near the end of the page it cannot reach the top
  if (spyJump) {
    const el = document.querySelector(`[data-key="bs-${spyJump}"]`);
    const cr = document.querySelector('.app.layout-bento .content');
    if (el && cr) { const r = el.getBoundingClientRect(), b = cr.getBoundingClientRect(); if (r.top < b.bottom - 40 && r.bottom > b.top) return; }
    spyJump = null;
  }
  const c = document.querySelector('.app.layout-bento .content'); if (!c) return;
  const top = c.getBoundingClientRect().top + 60;
  let cur = null;
  for (const st of require('./workflow').STAGES) { const el = c.querySelector(`[data-key="bs-${st.id}"]`); if (el && el.getBoundingClientRect().top <= top) cur = st.id; }
  if (cur !== (app.state.get().bIx || null)) app.state.set({ bIx: cur });
}
// your own scrolling (wheel, touch, keys) ends a jump: the chip follows what you read again
if (typeof document !== 'undefined' && document.addEventListener) ['wheel', 'touchmove', 'keydown'].forEach((t) => document.addEventListener(t, () => { spyJump = null; }, { passive: true, capture: true }));
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('scroll', (e) => { if (!spyQueued && e.target && e.target.classList && e.target.classList.contains('content')) { spyQueued = true; requestAnimationFrame(spy); } }, true);

/** Jump to a stage (index chips and Ctrl+1…5): unfold it and scroll it to the top. */
function jumpTo(app, id) {
  spyHoldUntil = Date.now() + 1200;
  setTimeout(() => { spyJump = id; }, 0); // after the key that asked for the jump
  app.state.set({ bIx: id, aeQ: '' });
  if (app.state.get().view !== 'home') app.go('home');
  if (folded(app, id)) toggleFold(app, id);
  setTimeout(() => { const el = document.querySelector(`[data-key="bs-${id}"]`); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 30);
}

function build(app, s, body) {
  spyApp = app;
  const W = require('./workflow');
  const kind = A.profile(s.ctx);
  const q = (s.aeQ || '').trim();
  let content, title;
  if (q) { content = h('div', { class: 'view ae-page b-page' }, AE.searchResults(app, q)); title = 'Search'; }
  else if (s.view === 'home' || AE.TAB_IDS.includes(s.view) || W.STAGE_IDS.includes(s.view)) {
    title = 'MOE Motion';
    const skip = nowBlock(kind);
    const index = h('nav', { class: 'b-index', 'aria-label': 'Jump to a stage' }, W.STAGES.map((st, i) => h('button', {
      class: `b-ix ${st.fits.includes(kind) ? 'fit' : ''} ${s.bIx === st.id ? 'on' : ''}`, 'data-key': `ix-${st.id}`, title: `${st.title} · Ctrl+${i + 1}`, 'aria-pressed': String(s.bIx === st.id),
      onclick: () => jumpTo(app, st.id)
    }, icon(st.icon, 'xs'), h('span', {}, st.label))));
    content = h('div', { class: 'view kit b-page' }, now(app, s, kind), power(app, kind), index, W.STAGES.map((st) => stageSection(app, st, kind, skip)));
  } else {
    const sec = studio.byId(s.view);
    const st = W.stageOfView(s.view);
    title = (sec || { label: s.view.charAt(0).toUpperCase() + s.view.slice(1) }).label;
    content = [h('div', { class: 'lay-crumb ae-crumb b-crumb', 'data-key': `crumb-${s.view}` }, h('button', { class: 'btn ghost sm', onclick: () => app.go('home') }, icon('chev', 'xs'), 'MOE'),
      st ? [h('span', { class: 'lay-crumb-sep' }, '›'), h('button', { class: 'btn ghost sm', 'data-key': `crumb-st-${st.id}`, onclick: () => jumpTo(app, st.id) }, st.label)] : null,
      h('span', { class: 'lay-crumb-sep' }, '›'), h('span', {}, title)), body(s.view)];
  }
  return { top: [require('./quickbar').strip(app), AE.searchBox(app, s)], title, content, overlay: s.aeMenu ? AE.panelMenu(app, s) : null, menuBtn: AE.menuButton(app, s) };
}

module.exports = { formatChip, build, nowBlock, pins, togglePin, movePin, PIN_MAX, jumpTo, power, stageSection };
