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
    layout: by('layout'), looks: by('looks'), zoom: by('zoom'), expressions: by('expressions'),
    icons: lib.count(), shapes: lib.PRIMITIVES.length, palettes: by('backgrounds'), text: PRESETS.length
  };
}

const COPY = {
  animate: (n) => ({ kicker: 'ANIMATE', title: 'Motion in one click', pitch: 'Slides, pops, fades, draw-ons, eases and proximity — keyed from the playhead, always restorable.', stats: [[n.animate, 'animations'], [n.ease, 'ease curves']], tip: 'Double-click a tile to apply it straight away.' }),
  text: (n) => ({ kicker: 'TEXT', title: 'Type that moves well', pitch: 'Signature text animators with Arabic-safe defaults (words / lines, RTL).', stats: [[n.text, 'text presets']] }),
  layout: (n) => ({ kicker: 'LAYOUT & GRID', title: 'Live grids & layouts', pitch: 'Grid, radial, spiral, path and 3D arrangements driven by one null — plus guides and cells.', stats: [[n.layout, 'layouts']] }),
  looks: (n) => ({ kicker: 'LOOKS & GLASS', title: 'Liquid & frosted glass', pitch: 'Editable glass built from native effects: lens, frost, tint, rim light and shadow.', stats: [[n.looks, 'glass looks']] }),
  zoom: (n) => ({ kicker: 'ZOOM & FOCUS', title: 'Screen-recording zooms', pitch: 'Punch-ins, follows, spotlights and animated cursors without touching your layers.', stats: [[n.zoom, 'zoom presets']] }),
  expressions: (n) => ({ kicker: 'EXPRESSIONS', title: 'Smart expressions, no typing', pitch: 'Wiggles, loops, bounces, orbits and auto-animations — with live slider controls.', stats: [[n.expressions, 'expressions']] }),
  shapes: (n) => ({ kicker: 'SHAPES & ICONS', title: 'Vector icons, ready to animate', pitch: 'Every icon lands as editable shape paths; native shapes stay parametric in AE.', stats: [[n.icons.toLocaleString('en-US'), 'icons'], [n.shapes, 'native shapes']] }),
  backgrounds: (n) => ({ kicker: 'BACKGROUNDS', title: 'Backgrounds & colour', pitch: 'Gradient, radial and mesh backgrounds from curated palettes — with grain and slow drift.', stats: [[n.palettes, 'palettes'], [4, 'styles']] }),
  compositing: () => ({ kicker: 'COMPOSITING', title: 'Key, match & grade', pitch: 'Analyse a shot, pull a key, match colour and grade — measured, not guessed.' }),
  deliver: () => ({ kicker: 'DELIVER', title: 'Every format from one master', pitch: 'Plan all aspect ratios at once and adapt the animation — keyframes kept.' }),
  quick: () => ({ kicker: 'QUICK', title: 'The everyday buttons', pitch: 'Reveal, purge, flip, reverse keys, precompose, parent to null and more — one click each.' }),
  select: () => ({ kicker: 'SELECT', title: 'Find layers fast', pitch: 'Select by type, name, label, effect or property across the comp.' }),
  brand: () => ({ kicker: 'BRAND', title: 'Client kits', pitch: 'Colours and fonts per client, applied everywhere in one click.' }),
  tools: (n) => ({ kicker: 'TOOLS', title: 'Your toolbox', pitch: 'Saved recipes, the Tool Factory and every tool in one list.', stats: [[n.tools, 'tools']] })
};

function banner(app, sectionId) {
  const ui = app.services.settings.get().ui;
  if (ui.banners === false || !COPY[sectionId]) return null;
  const hidden = app.services.store.get('banners-hidden', []);
  if (hidden.includes(sectionId)) return null;
  const c = COPY[sectionId](counts(app));
  const el = h('section', { class: `hero hero-${sectionId}`, 'aria-label': c.title },
    h('div', { class: 'hero-text' },
      h('div', { class: 'hero-kicker' }, c.kicker),
      h('div', { class: 'hero-title' }, c.title),
      h('div', { class: 'hero-pitch' }, c.pitch),
      c.stats ? h('div', { class: 'hero-stats' }, c.stats.map(([v, l]) => h('span', { class: 'hero-stat' }, h('b', {}, v), ` ${l}`))) : null),
    h('div', { class: 'hero-art', html: art.art(sectionId) }),
    h('button', { class: 'icon-btn hero-x', title: 'Hide this banner (Settings › Appearance brings it back)', 'aria-label': 'Hide banner', onclick: () => { app.services.store.set('banners-hidden', hidden.concat(sectionId)); app.render(); } }, icon('x', 'sm')));
  if (theme.reducedMotion()) setTimeout(() => el.querySelectorAll('svg').forEach((s) => s.pauseAnimations && s.pauseAnimations()), 0);
  return el;
}

/* ---------- sheets (modal) ---------- */
const WHATS_NEW = [
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
  [['Ctrl', '1…9'], 'Jump to section 1–9'],
  [['?'], 'Show this sheet'],
  [['Esc'], 'Close sheets and dialogs'],
  [['Double-click'], 'Apply a tile now'],
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
      kind === 'whatsnew' ? h('div', { class: 'sheet-f' }, h('button', { class: 'btn primary', onclick: () => { close(); app.go('shapes'); } }, icon('shapes', 'sm'), 'Try Shapes & Icons'), h('button', { class: 'btn ghost', onclick: close }, 'Later')) : null));
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

module.exports = { banner, sheet, splash, counts, COPY, WHATS_NEW, SHORTCUTS };
