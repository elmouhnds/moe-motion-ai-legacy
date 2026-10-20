'use strict';
/**
 * Home: the active comp at a glance, illustrated quick starts, recent tools and favourites,
 * library stats and a tip of the day. Read-only — every card just navigates or opens a tool.
 */
const { h, icon, relTime } = require('../dom');
const art = require('../art');
const chrome = require('../chrome');

const TIPS = [
  'Double-click any library tile to apply it straight away — a single click only inspects.',
  'Every change MOE makes can be restored from History, even after other edits.',
  'Shapes & Icons: icons land as real Bézier paths, so Trim Paths, Offset Paths and Wiggle Paths all work.',
  'Turn on "Live controls" for an expression to get keyframeable sliders on the layer.',
  'Backgrounds with "Slow drift" loop forever — the gradient points move with a tagged expression.',
  'Ctrl + 1…9 jumps between sections. Press ? for every shortcut.',
  'Colorize → Blend makes a smooth colour ramp across a whole selection, in selection order.',
  'Deliver plans every aspect ratio at once; the keyframes of your animation are kept.',
  'Save any Inspector setting as your own preset — it appears as a tile under "My Presets".',
  'Arabic text animates by words or lines by default, so letters stay connected.',
  'Right-click a Quick Bar button for its options and to hide or reorder buttons.',
  'Settings › Appearance has a Midnight theme and eight accent colours.',
  'Glass looks are built from native effects only — every amount stays editable and animatable.',
  'Proximity reacts to an effector null: grow, repel or colour layers as it passes.',
  'Grid Builder arrangements stay live: change spacing or columns on the MOE Grid null at any time.'
];

const STARTS = [
  ['animate', 'Animate', 'One-click motion & eases', 'motion'],
  ['shapes', 'Shapes & Icons', 'Vector icons & native shapes', 'shapes'],
  ['backgrounds', 'Backgrounds', 'Gradients from palettes', 'background'],
  ['layout', 'Layout & Grid', 'Live grids & arrangements', 'grid'],
  ['expressions', 'Expressions', 'Smart, no typing', 'expr'],
  ['deliver', 'Deliver', 'Every format at once', 'resize']
];

function greeting() {
  const hr = new Date().getHours();
  return hr < 5 ? 'Working late' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
}

function compCard(app, ctx) {
  if (!ctx || !ctx.comp) {
    return h('div', { class: 'hm-card hm-comp empty' }, h('div', { class: 'hm-empty-art', html: art.empty('comp') }),
      h('div', {}, h('div', { class: 'hm-t' }, 'No active composition'), h('div', { class: 'why' }, 'Open or select a comp in After Effects — MOE reads it live.')));
  }
  const c = ctx.comp;
  const W = 120, H = 70, k = Math.min((W - 8) / c.width, (H - 8) / c.height);
  const fw = c.width * k, fh = c.height * k;
  const fps = Math.round(c.frameRate * 100) / 100;
  return h('div', { class: 'hm-card hm-comp' },
    h('div', { class: 'hm-frame', html: `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><rect x="${(W - fw) / 2}" y="${(H - fh) / 2}" width="${fw}" height="${fh}" rx="3" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="1.4"/><path d="M${W / 2 - 5} ${H / 2 - 6}l10 6-10 6z" fill="var(--accent)"/></svg>` }),
    h('div', { class: 'hm-comp-info' },
      h('div', { class: 'hm-kicker' }, 'ACTIVE COMP'),
      h('div', { class: 'hm-t' }, c.name),
      h('div', { class: 'hm-chips' },
        h('span', { class: 'chip' }, `${c.width}×${c.height}`), h('span', { class: 'chip' }, `${fps} fps`),
        c.duration ? h('span', { class: 'chip' }, `${Math.round(c.duration * 10) / 10}s`) : null,
        h('span', { class: 'chip' }, `${ctx.layers.length} selected`))));
}

function render(app) {
  const s = app.state.get();
  const n = chrome.counts(app);
  const reg = app.services.registry;
  const recent = [];
  for (const e of app.services.executor.history(60)) {
    if (recent.length >= 6) break;
    if (!recent.some((r) => r.toolId === e.toolId) && reg.get(e.toolId)) recent.push(e);
  }
  const favs = app.services.favorites.list().map((id) => reg.get(id)).filter(Boolean).slice(0, 8);
  const tip = TIPS[Math.floor(Date.now() / 86400000) % TIPS.length];
  const toolBtn = (t, sub) => h('button', { class: 'hm-tool', title: t.description, onclick: () => app.openTool(t) }, h('span', { class: 'hm-tool-ic' }, icon(t.icon || 'tools')), h('span', { class: 'hm-tool-t' }, t.name), sub ? h('span', { class: 'hm-tool-s' }, sub) : null);

  return h('div', { class: 'view home' },
    h('section', { class: 'hm-hero' },
      h('div', { class: 'hm-hero-text' },
        h('div', { class: 'hm-kicker' }, `MOE STUDIO ${app.services.version}`),
        h('div', { class: 'hm-hello' }, `${greeting()}.`),
        h('div', { class: 'why' }, `${n.tools} tools · ${n.icons.toLocaleString('en-US')} icons · ${n.animate + n.ease} animations · ${n.expressions} expressions · ${n.palettes} palettes`),
        h('div', { class: 'hm-actions' },
          h('button', { class: 'btn primary', onclick: () => require('../palette').open(app) }, icon('search', 'sm'), 'Search tools'),
          h('button', { class: 'btn', onclick: () => app.openCopilot() }, icon('spark', 'sm'), 'Ask Copilot'),
          h('button', { class: 'btn ghost', onclick: () => app.state.set({ modal: 'whatsnew' }) }, icon('gift', 'sm'), "What's new"))),
      h('div', { class: 'hm-hero-art', html: art.art('home') })),
    compCard(app, s.ctx),
    h('div', { class: 'section-h' }, 'Start with'),
    h('div', { class: 'hm-starts' }, STARTS.map(([id, t, sub, ic]) => h('button', { class: 'hm-start', onclick: () => app.go(id) },
      h('div', { class: 'hm-start-art', html: art.art(id) }),
      h('div', { class: 'hm-start-t' }, icon(ic, 'sm'), t),
      h('div', { class: 'hm-start-s' }, sub)))),
    h('div', { class: 'hm-cols' },
      h('div', { class: 'hm-col' },
        h('div', { class: 'section-h' }, 'Recent'),
        recent.length ? h('div', { class: 'hm-tools' }, recent.map((e) => toolBtn(reg.get(e.toolId), relTime(e.t))))
          : h('div', { class: 'hm-empty' }, h('span', { html: art.empty('clock') }), h('span', { class: 'why' }, 'Tools you run show up here.'))),
      h('div', { class: 'hm-col' },
        h('div', { class: 'section-h' }, 'Favorites'),
        favs.length ? h('div', { class: 'hm-tools' }, favs.map((t) => toolBtn(t)))
          : h('div', { class: 'hm-empty' }, h('span', { html: art.empty('star') }), h('span', { class: 'why' }, 'Pin tools with ☆ in any Inspector.')))),
    h('div', { class: 'hm-tip' }, h('span', { class: 'hm-tip-ic' }, icon('lightbulb')), h('div', {}, h('div', { class: 'hm-kicker' }, 'TIP OF THE DAY'), h('div', {}, tip))),
    h('div', { class: 'hm-foot' },
      h('button', { class: 'btn ghost', onclick: () => app.state.set({ modal: 'shortcuts' }) }, icon('keyboard', 'sm'), 'Shortcuts'),
      h('button', { class: 'btn ghost', onclick: () => app.state.set({ modal: 'about' }) }, icon('info', 'sm'), 'About')));
}

module.exports = { render, TIPS, STARTS };
