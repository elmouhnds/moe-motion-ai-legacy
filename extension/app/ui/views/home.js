'use strict';
/**
 * Home: the active comp at a glance, illustrated quick starts, recent tools and favourites,
 * library stats and a tip of the day. Read-only — every card just navigates or opens a tool.
 */
const { h, icon, relTime } = require('../dom');
const art = require('../art');
const chrome = require('../chrome');

const TIPS = [
  'Press ▶ on any tile (or double-click it) to apply it straight away — a single click only inspects.',
  'F4 repeats your last change on whatever is selected now — great for the next layer.',
  'Search (Ctrl K) finds presets too: type "pop", press Enter, and it is applied.',
  'Every change MOE makes can be restored from History, even after other edits.',
  'Shapes & Icons: icons land as real Bézier paths, so Trim Paths, Offset Paths and Wiggle Paths all work.',
  'Turn on "Live controls" for an expression to get keyframeable sliders on the layer.',
  'Backgrounds with "Slow drift" loop forever — the gradient points move with a tagged expression.',
  'Ctrl + 1…6 jumps between Home and the five workspaces. Press ? for every shortcut. Hide sections you never use in Settings › Sidebar.',
  'Hold Q, point, release: the pie menu runs the action in that direction. Its slices follow what you selected.',
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
  const err = app.state.get().hostError;
  if (err) {
    return h('div', { class: 'hm-card hm-comp empty conn' }, h('div', { class: 'hm-empty-art', html: art.empty('comp') }),
      h('div', { class: 'hm-conn' },
        h('div', { class: 'hm-t' }, 'Not connected to After Effects'),
        h('div', { class: 'why' }, 'MOE retries on its own. If it stays like this, open Details and send the report.'),
        h('div', { class: 'hm-actions' },
          h('button', { class: 'btn primary', onclick: () => app.reconnect() }, icon('refresh', 'sm'), 'Reconnect'),
          h('button', { class: 'btn ghost', onclick: () => app.go('diagnostics') }, icon('info', 'sm'), 'Details'))));
  }
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

/** "For this selection": the same eight actions the smart pie shows (v0.8). */
function suggestions(app, ctx) {
  const actions = require('../actions');
  const kind = actions.profile(ctx);
  const items = actions.SETS[kind].map((r) => actions.resolve(r)).filter(Boolean);
  return [
    h('div', { class: 'section-h hm-sg-h' }, 'For this selection', h('span', { class: 'why' }, `${actions.CONTEXT_LABEL[kind]} · hold Q for the pie`)),
    h('div', { class: 'hm-suggest' }, items.map((a) => {
      const rd = a.ready(app);
      return h('button', { class: `hm-sg ${rd.ok || a.nav ? '' : 'blocked'}`, 'data-key': `sg-${a.id}`, title: rd.ok || a.nav ? `${a.label} — ${a.where}` : `${a.label} — ${rd.hint}`,
        onclick: () => { if (!rd.ok && !a.nav) app.toast(`${a.label}: ${rd.hint}`, 4500, 'warn'); else a.run(app); } }, icon(a.icon || 'bolt', 'sm'), h('span', {}, a.label));
    }))];
}

/* ---------- Smart Home (v0.15) ---------- */
const KIND_ICON = { keys: 'easeCurve', layer: 'layers', layers: 'layers', text: 'type', shapes: 'shapes', shapesMany: 'shapes', none: 'spark' };
/** One line under the focus title: what exactly is selected. */
function detailOf(ctx, kind) {
  if (!ctx || !ctx.comp) return '';
  const names = (ctx.layers || []).map((l) => l.name);
  const list = names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
  if (kind === 'keys') { const n = (ctx.properties || []).reduce((a, p) => a + (p.selectedKeys || []).length, 0); return `${n} key${n === 1 ? '' : 's'}${list ? ` · ${list}` : ''}`; }
  if (kind === 'none') return `${ctx.comp.name} · select a layer or keys and this card changes`;
  return list;
}
function focusRows(app, kind) {
  const A = require('../actions');
  return (A.FOCUS[kind] || []).map(([title, refs]) => {
    const items = refs.map((r) => A.resolve(r)).filter(Boolean);
    return h('div', { class: 'focus-row', 'data-key': `fr-${kind}-${title}` },
      h('div', { class: 'focus-row-h' }, title),
      h('div', { class: 'focus-acts' }, items.map((a) => {
        const rd = a.ready(app);
        return h('button', { class: `focus-act ${rd.ok || a.nav ? '' : 'off'}`, 'data-key': `fa-${a.id}`, title: rd.ok || a.nav ? `${a.label} — ${a.where}` : `${a.label} — ${rd.hint}`,
          onclick: () => { if (!rd.ok && !a.nav) app.toast(`${a.label}: ${rd.hint}`, 4500, 'warn'); else a.run(app); } }, icon(a.icon || 'bolt', 'sm'), h('span', {}, a.label));
      })));
  });
}
function smartRender(app, s) {
  const A = require('../actions');
  const kit = require('./kit');
  const kind = A.profile(s.ctx);
  const head = h('div', { class: 'focus-h' },
    h('span', { class: 'focus-ic' }, icon(KIND_ICON[kind] || 'spark', 'sm')),
    h('div', { class: 'focus-t' }, h('div', { class: 'focus-k' }, A.CONTEXT_LABEL[kind]), h('div', { class: 'focus-d' }, detailOf(s.ctx, kind))));
  const reg = app.services.registry;
  const recent = [];
  for (const e of app.services.executor.history(60)) { if (recent.length >= 8) break; if (!recent.some((r) => r.toolId === e.toolId) && reg.get(e.toolId)) recent.push(e); }
  const fresh = !recent.length && !app.services.favorites.list().length;
  return [
    kit.smartHome(app, kind, focusRows(app, kind), head),
    kind === 'none' && fresh ? [h('div', { class: 'section-h' }, 'Start with'), h('div', { class: 'hm-starts' }, STARTS.map(([id, t, sub, ic]) => h('button', { class: 'hm-start', onclick: () => app.go(id) }, h('div', { class: 'hm-start-art', html: art.art(id) }), h('div', { class: 'hm-start-t' }, icon(ic, 'sm'), t), h('div', { class: 'hm-start-s' }, sub))))] : null,
    recent.length ? h('section', { class: 'home-recent', 'aria-label': 'Recent' }, h('div', { class: 'home-more-h' }, 'Recent'),
      h('div', { class: 'home-recent-row' }, recent.map((e) => { const t = reg.get(e.toolId); return h('button', { class: 'kit-ib', title: `${t.name} — ${relTime(e.t)}`, 'aria-label': t.name, onclick: () => app.openTool(t) }, icon(t.icon || 'tools', 'sm')); }))) : null
  ];
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

  const returning = recent.length > 0 || favs.length > 0;
  const actions = h('div', { class: 'hm-actions' },
    h('button', { class: 'btn primary', onclick: () => require('../palette').open(app) }, icon('search', 'sm'), 'Search tools'),
    h('button', { class: 'btn', onclick: () => app.openCopilot() }, icon('spark', 'sm'), 'Ask Copilot'),
    h('button', { class: 'btn ghost', onclick: () => app.state.set({ modal: 'whatsnew' }) }, icon('gift', 'sm'), "What's new"));
  // Returning users (v0.7): a one-line greeting, then Recent and Favorites first; the full hero only for new users.
  const hero = returning
    ? h('section', { class: 'hm-hero mini' }, h('div', { class: 'hm-hero-text' }, h('div', { class: 'hm-hello' }, `${greeting()}.`), actions))
    : h('section', { class: 'hm-hero' },
      h('div', { class: 'hm-hero-text' },
        h('div', { class: 'hm-kicker' }, `MOE STUDIO ${app.services.version}`),
        h('div', { class: 'hm-hello' }, `${greeting()}.`),
        h('div', { class: 'why' }, `${n.tools} tools · ${n.icons.toLocaleString('en-US')} icons · ${n.animate + n.ease} animations · ${n.expressions} expressions · ${n.palettes} palettes`),
        actions),
      h('div', { class: 'hm-hero-art', html: art.art('home') }));
  const cols = h('div', { class: 'hm-cols' },
    h('div', { class: 'hm-col' },
      h('div', { class: 'section-h' }, 'Recent'),
      recent.length ? h('div', { class: 'hm-tools' }, recent.map((e) => toolBtn(reg.get(e.toolId), relTime(e.t))))
        : h('div', { class: 'hm-empty' }, h('span', { html: art.empty('clock') }), h('span', { class: 'why' }, 'Tools you run show up here.'))),
    h('div', { class: 'hm-col' },
      h('div', { class: 'section-h' }, 'Favorites'),
      favs.length ? h('div', { class: 'hm-tools' }, favs.map((t) => toolBtn(t)))
        : h('div', { class: 'hm-empty' }, h('span', { html: art.empty('star') }), h('span', { class: 'why' }, 'Pin tools with ☆ in any Inspector.'))));
  const starts = [
    h('div', { class: 'section-h' }, 'Start with'),
    h('div', { class: 'hm-starts' }, STARTS.map(([id, t, sub, ic]) => h('button', { class: 'hm-start', onclick: () => app.go(id) },
      h('div', { class: 'hm-start-art', html: art.art(id) }),
      h('div', { class: 'hm-start-t' }, icon(ic, 'sm'), t),
      h('div', { class: 'hm-start-s' }, sub))))];

  // v0.10 (Motion 4 Home): ease graph, anchor, align and the pinned tools come first, every time.
  // The comp card only shows when something is wrong (not connected / no comp) — the context line has the rest.
  const connected = s.ctx && s.ctx.comp && !s.hostError;
  const kitP = require('./kit').prefs(app);
  const smart = kitP.homeLayout !== 'fixed';
  const layoutBtn = h('button', { class: 'btn ghost', title: smart ? 'Smart: the top of Home follows what you select. Click for Fixed (always the same order).' : 'Fixed: always the same order. Click for Smart (follows your selection).', onclick: () => require('./kit').setPref(app, { homeLayout: smart ? 'fixed' : 'smart' }) }, icon('layout', 'sm'), smart ? 'Layout: smart' : 'Layout: fixed');
  if (smart) {
    return h('div', { class: 'view home' },
      connected ? null : compCard(app, s.ctx),
      smartRender(app, s),
      h('div', { class: 'hm-foot' },
        layoutBtn,
        h('button', { class: 'btn ghost', onclick: () => app.state.set({ modal: 'shortcuts' }) }, icon('keyboard', 'sm'), 'Shortcuts'),
        h('button', { class: 'btn ghost', title: tip, onclick: () => app.toast(tip, 7000, 'info') }, icon('lightbulb', 'sm'), 'Tip')));
  }
  return h('div', { class: 'view home' },
    connected ? null : compCard(app, s.ctx),
    require('./kit').homeTop(app),
    connected ? suggestions(app, s.ctx) : null,
    returning ? cols : null,
    hero,
    starts,
    returning ? null : cols,
    h('div', { class: 'hm-tip' }, h('span', { class: 'hm-tip-ic' }, icon('lightbulb')), h('div', {}, h('div', { class: 'hm-kicker' }, 'TIP OF THE DAY'), h('div', {}, tip))),
    h('div', { class: 'hm-foot' },
      layoutBtn,
      h('button', { class: 'btn ghost', onclick: () => app.state.set({ modal: 'shortcuts' }) }, icon('keyboard', 'sm'), 'Shortcuts'),
      h('button', { class: 'btn ghost', onclick: () => app.state.set({ modal: 'about' }) }, icon('info', 'sm'), 'About')));
}

module.exports = { render, TIPS, STARTS };
