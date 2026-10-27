'use strict';
/**
 * Studio "chrome": section hero banners, splash, and the About / What's New / Shortcuts sheets.
 * Content only — every action still goes through app.* (tools run via the executor).
 */
const { h, icon } = require('./dom');
const art = require('./art');
const theme = require('./theme');

/* ---------- section banners ---------- */
function counts(app) {
  const studio = require('./studio/sections');
  const by = (id) => (studio.byId(id) || { tiles: [] }).tiles.length;
  const lib = require('../../features/design/shapesLib');
  const { PRESETS } = require('../../features/text/presets');
  const anim = (studio.byId('animate') || { tiles: [] }).tiles;
  return {
    tools: app.services.registry.list().filter((t) => !(t.ui && t.ui.hidden)).length,
    animate: anim.filter((t) => !t.tags.includes('Ease')).length, ease: anim.filter((t) => t.tags.includes('Ease')).length,
    layout: by('layout'), curves: by('curves'), transform: by('transform'), looks: by('looks'), zoom: by('zoom'), expressions: by('expressions'),
    icons: lib.count(), shapes: lib.PRIMITIVES.length, palettes: by('backgrounds'), text: PRESETS.length
  };
}

const COPY = {
  animate: (n) => ({ kicker: 'ANIMATE', title: 'Motion in one click', pitch: 'Slides, pops, fades, draw-ons, eases and proximity — keyed from the playhead, always restorable.', stats: [[n.animate, 'animations'], [n.ease, 'ease curves']], tip: 'Press ▶ on a tile to apply it straight away.' }),
  curves: (n) => ({ kicker: 'EASE CURVES', title: 'Shape the speed graph', pitch: 'Drag a Bézier like in the graph editor, or pick expo, back, punch and glide — exact speed and influence on every selected keyframe pair.', stats: [[n.curves, 'curves']], tip: 'Read from keys loads the curve already on two keyframes.' }),
  transform: (n) => ({ kicker: 'ANCHOR & ALIGN', title: 'Anchor, align, clone', pitch: 'Move the anchor to any of 9 points without a jump, align or distribute layers, and clone a layer into rings, fans, rows and grids.', stats: [[n.transform, 'one-click tools']] }),
  text: (n) => ({ kicker: 'TEXT', title: 'Type that moves well', pitch: 'Signature text animators with Arabic-safe defaults (words / lines, RTL).', stats: [[n.text, 'text presets']] }),
  layout: (n) => ({ kicker: 'LAYOUT & GRID', title: 'Live grids & layouts', pitch: 'Grid, radial, spiral, path and 3D arrangements driven by one null — plus guides and cells.', stats: [[n.layout, 'layouts']] }),
  looks: (n) => ({ kicker: 'LOOKS & GLASS', title: 'Liquid & frosted glass', pitch: 'Editable glass built from native effects: lens, frost, tint, rim light and shadow.', stats: [[n.looks, 'glass looks']] }),
  zoom: (n) => ({ kicker: 'ZOOM & FOCUS', title: 'Screen-recording zooms', pitch: 'Punch-ins, follows, spotlights and animated cursors without touching your layers.', stats: [[n.zoom, 'zoom presets']] }),
  expressions: (n) => ({ kicker: 'EXPRESSIONS', title: 'Smart expressions, no typing', pitch: 'Wiggles, loops, bounces, orbits and auto-animations — with live slider controls.', stats: [[n.expressions, 'expressions']] }),
  shapes: (n) => ({ kicker: 'SHAPES & ICONS', title: 'Vector icons, ready to animate', pitch: 'Every icon lands as editable shape paths; native shapes stay parametric in AE.', stats: [[n.icons.toLocaleString('en-US'), 'icons'], [n.shapes, 'native shapes']] }),
  backgrounds: (n) => ({ kicker: 'BACKGROUNDS', title: 'Backgrounds & colour', pitch: 'Gradient, radial and mesh backgrounds from curated palettes — with grain and slow drift.', stats: [[n.palettes, 'palettes'], [4, 'styles']] }),
  compositing: () => ({ kicker: 'COMPOSITING', title: 'Key, match & grade', pitch: 'Analyse a shot, pull a key, match colour and grade — measured, not guessed. Green-screen prompts and import & key live here too.' }),
  deliver: () => ({ kicker: 'DELIVER', title: 'Every format from one master', pitch: 'Plan all aspect ratios at once and adapt the animation — keyframes kept.' }),
  quick: () => ({ kicker: 'QUICK BAR', title: 'Edit your Quick Bar', pitch: 'Every everyday button in one place. Star a button to put it on the bar under the selection line; right-click any button for its options.' }),
  select: () => ({ kicker: 'SELECT', title: 'Find layers fast', pitch: 'Select by type, name, label, effect or property across the comp.' }),
  brand: () => ({ kicker: 'BRAND', title: 'Client kits', pitch: 'Colours and fonts per client, applied everywhere in one click.' }),
  tools: (n) => ({ kicker: 'TOOLS', title: 'Your toolbox', pitch: 'Your saved tools, and the Tool Factory to build new one-click tools from existing ones. Every tool is one search away (Ctrl K).', stats: [[n.tools, 'tools available']] })
};

/**
 * Section banner. The full banner shows on the first visit to a section; after that the section
 * opens with a one-line title (more room for tiles — the banner took ~17 % of a docked panel).
 * The ⓘ on the line brings the full banner back for this session.
 */
function banner(app, sectionId) {
  const ui = app.services.settings.get().ui;
  if (ui.banners === false || !COPY[sectionId]) return null;
  const hidden = app.services.store.get('banners-hidden', []);
  if (hidden.includes(sectionId)) return null;
  const c = COPY[sectionId](counts(app));
  const seen = app.services.store.get('banners-seen', []).includes(sectionId);
  const open = (app.state.get().bannerOpen || {})[sectionId];
  const setOpen = (v) => app.state.set((st) => ({ bannerOpen: Object.assign({}, st.bannerOpen, { [sectionId]: v }) }));
  if (seen && !open) {
    return h('div', { class: 'hero-line', 'data-key': `hero-${sectionId}` },
      h('span', { class: 'hero-kicker' }, c.kicker), h('span', { class: 'hero-line-t' }, c.title),
      h('span', { class: 'spacer' }),
      h('button', { class: 'icon-btn', title: 'About this section', 'aria-label': 'Show section intro', onclick: () => setOpen(true) }, icon('info', 'sm')));
  }
  const el = h('section', { class: `hero hero-${sectionId}`, 'aria-label': c.title, 'data-key': `hero-${sectionId}` },
    h('div', { class: 'hero-text' },
      h('div', { class: 'hero-kicker' }, c.kicker),
      h('div', { class: 'hero-title' }, c.title),
      h('div', { class: 'hero-pitch' }, c.pitch),
      c.stats ? h('div', { class: 'hero-stats' }, c.stats.map(([v, l]) => h('span', { class: 'hero-stat' }, h('b', {}, v), ` ${l}`))) : null),
    h('div', { class: 'hero-art', html: art.art(sectionId) }),
    seen ? h('button', { class: 'icon-btn hero-x on', title: 'Back to the one-line title', 'aria-label': 'Collapse banner', onclick: () => setOpen(false) }, icon('chev', 'sm'))
      : h('button', { class: 'icon-btn hero-x', title: 'Hide this banner (Settings › Appearance brings it back)', 'aria-label': 'Hide banner', onclick: () => { app.services.store.set('banners-hidden', hidden.concat(sectionId)); app.render(); } }, icon('x', 'sm')));
  return el;
}

/** Called when the user leaves a section: from now on its banner is a one-line title. */
function markBannerSeen(app, sectionId) {
  if (!COPY[sectionId]) return;
  const seen = app.services.store.get('banners-seen', []);
  if (!seen.includes(sectionId)) app.services.store.set('banners-seen', seen.concat(sectionId));
}

/* ---------- sheets (modal) ---------- */
const WHATS_NEW = [
  ['easeCurve', 'Ease Curves (speed graph)', 'Drag a Bézier like in the graph editor and apply it between every pair of selected keyframes — exact speed and influence. 32 curves: expo, back / overshoot, punch, glide, snap… Read from keys loads an existing curve.'],
  ['anchor', 'Anchor point, 9 positions', 'Move the anchor to a corner, edge or centre without the layer jumping — scaled, rotated and Position-keyed layers included.'],
  ['alignCenter', 'Align & distribute', 'Line layers up by their edges or centres, to the selection or the comp, and space three or more evenly.'],
  ['clone', 'Clone into rings, rows, grids', 'Duplicate one layer around a ring or fan (facing out), along a row with scale and fade steps, or into a grid. Restorable in one click.'],
  ['pie', 'Pie menu', 'Hold Q (or the right mouse button), point and release. Eight actions that follow your selection — keyframes, text, shapes, layers — and the centre repeats your last change.'],
  ['layers', 'Five workspaces', 'The sidebar is now Home + Animate · Design · Layout · Finish · Tools, each with its sections as tabs. Ctrl 1–6 jumps between them.'],
  ['wand', 'For this selection', 'Home shows the actions that fit what you selected, one click each.'],
  ['play', 'Apply bar & ▶ on every tile', 'The selected preset and Apply stay pinned at the bottom of every library. Hover a tile and press ▶ to apply it in one click.'],
  ['repeat', 'Repeat last (F4)', 'Applied something you like? Select the next layers and press F4 — or the ↻ chip in the selection line.'],
  ['search', 'Search applies presets', 'Ctrl K now finds presets too: type "pop", press Enter, done. Shift+Enter only opens it.'],
  ['eye', 'Tiles tell you first', 'Tiles the selection cannot run are dimmed with the reason; setup tiles open their settings instead of failing.'],
  ['grid', 'Tidier sidebar', 'Sections grouped as Animate · Design · Layout · Finish · Utilities. Hide the ones you never use in Settings › Sidebar.'],
  ['search', 'Search & previews fixed', 'Mouse clicks in search (Ctrl K) always register, text previews rest on a readable frame, and the Quick Bar scrolls with the mouse wheel.'],
  ['spark', 'Copilot works again', 'Fixed "Claude API error 400: compiled grammar is too large". Plans are still checked locally before you approve anything.'],
  ['shapes', 'Shapes & Icons', '1,899 vector icons and 22 native shapes. Insert as editable shape layers — line, solid, line + fill or duotone — with draw-on, pop or fade.'],
  ['background', 'Backgrounds', '32 curated palettes as linear, radial or mesh gradients, with film grain and a slow looping drift.'],
  ['palette', 'Colorize from palette', 'Recolour a whole selection in one click: cycle, shuffle or blend through a palette. Save any palette as a client.'],
  ['expr', '33 one-click expressions', '16 new: bounce landing, squash & stretch, orbit, swing, heartbeat, breathe, organic & loop wiggle, drift, clock ticks, face motion, scatter, auto pop-in / slide-in.'],
  ['easeCurve', 'Ease library', '8 visual ease curves (gentle → expo, decelerate, hard stop, launch) and 7 new animations (rise, drop, cascade, soft pop, pop / spin out).'],
  ['home', 'Home', 'Your comp at a glance, quick starts, recent tools, favourites and a tip of the day.'],
  ['presets', 'My Presets', 'Save any Inspector setting as your own tile, then export / import preset packs to share with the team.'],
  ['contrast', 'Appearance', 'Midnight theme, 8 accent colours, reduced motion and a new display typeface — all contrast-checked.']
];

const SHORTCUTS = [
  [['Ctrl', 'K'], 'Search every tool'],
  [['Ctrl', 'Space'], 'Ask the Copilot'],
  [['Ctrl', '1…6'], 'Home and the five workspaces'],
  [['Q', 'hold'], 'Pie menu: point and release (tap Q to keep it open, 1–8 to choose)'],
  [['Right button', 'hold'], 'Pie menu with the mouse'],
  [['?'], 'Show this sheet'],
  [['Esc'], 'Close sheets and dialogs'],
  [['F4'], 'Repeat the last change on the current selection'],
  [['Enter'], 'In search: apply a preset / open a tool'],
  [['Shift', 'Enter'], 'In search: open without applying'],
  [['▶', '/ Double-click'], 'Apply a tile now'],
  [['Right-click'], 'Quick Bar button options'],
  [['Enter'], 'Confirm a dialog']
];

function sheet(app, kind) {
  const close = () => app.state.set({ modal: null });
  const version = app.services.version;
  let title, body;
  if (kind === 'about') {
    const lib = require('../../features/design/shapesLib');
    title = 'About MOE Studio';
    body = h('div', { class: 'about' },
      h('div', { class: 'about-hero' }, h('span', { html: art.logo(56) }), h('div', {},
        h('div', { class: 'about-name' }, 'MOE Motion AI'),
        h('div', { class: 'why' }, `Studio ${version} · After Effects 2025 · CEP 12`),
        h('div', { class: 'why' }, 'A workbench of real tools. Works offline; Claude is optional.'))),
      h('dl', { class: 'kv' },
        h('dt', {}, 'Tools'), h('dd', {}, String(app.services.registry.list().length)),
        h('dt', {}, 'Icons'), h('dd', {}, `${lib.count().toLocaleString('en-US')} (Lucide, ISC licence)`),
        h('dt', {}, 'Typeface'), h('dd', {}, 'Sora (SIL Open Font License 1.1)'),
        h('dt', {}, 'Data folder'), h('dd', {}, app.services.store.dataDir || '—')),
      h('div', { class: 'why' }, 'Licences ship in extension/assets/icons/LICENSE-lucide.txt and extension/assets/fonts/LICENSE-sora-OFL.txt.'));
  } else if (kind === 'whatsnew') {
    title = `What's new in ${version}`;
    body = h('div', { class: 'wn-list' }, WHATS_NEW.map(([ic, t, d]) => h('div', { class: 'wn-item' }, h('span', { class: 'wn-ic' }, icon(ic)), h('div', {}, h('div', { class: 'wn-t' }, t), h('div', { class: 'why' }, d)))));
  } else {
    title = 'Keyboard & mouse';
    body = h('div', { class: 'kb-list' }, SHORTCUTS.map(([keys, d]) => h('div', { class: 'kb-row' }, h('span', { class: 'kb-keys' }, keys.map((k) => h('kbd', {}, k))), h('span', {}, d))));
  }
  const overlay = h('div', { class: 'overlay sheet-overlay', onmousedown: (e) => { if (e.target === overlay) close(); } },
    h('div', { class: `sheet sheet-${kind}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'sheet-h' }, h('span', { class: 'sheet-title' }, title), h('span', { class: 'spacer' }), h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close }, icon('x', 'sm'))),
      h('div', { class: 'sheet-b' }, body),
      kind === 'whatsnew' ? h('div', { class: 'sheet-f' }, h('button', { class: 'btn primary', onclick: () => { close(); app.go('curves'); } }, icon('easeCurve', 'sm'), 'Try Ease Curves'), h('button', { class: 'btn ghost', onclick: close }, 'Later')) : null));
  return overlay;
}

/* ---------- splash ---------- */
function splash(onDone) {
  const el = h('div', { class: 'splash', role: 'presentation', onclick: () => finish() },
    h('div', { class: 'splash-mark', html: art.logo(64) }),
    h('div', { class: 'splash-name' }, 'MOE Studio'),
    h('div', { class: 'splash-bar' }, h('span', {})));
  let gone = false;
  function finish() { if (gone) return; gone = true; el.classList.add('out'); setTimeout(() => { el.remove(); if (onDone) onDone(); }, 260); }
  setTimeout(finish, theme.reducedMotion() ? 300 : 1100);
  return el;
}

module.exports = { banner, markBannerSeen, sheet, splash, counts, COPY, WHATS_NEW, SHORTCUTS };
