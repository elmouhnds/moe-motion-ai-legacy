'use strict';
/**
 * Palette cards (v0.73, owner: "the background colours are shown badly — there are creative ways to show them, in every
 * style"). A palette is shown as what it becomes: a still frame of the real background (bgDraw.bgFrame — the same plan
 * the expressions write) in the style you are using (or the tile's own look), with its colours fanned out as overlapping
 * chips and its name over a soft fade. A look that moves plays under the mouse (v0.75); otherwise one still frame.
 * Used by the Background Composer (Bento · Glass · MOE · Control) and by Control's Design page.
 */
const { h } = require('./dom');

/** The args a card draws: your current look with this palette, or the tile's complete look (pure). */
function cardArgs(tile, cur, fullLook) {
  const { BG_DEFAULTS } = require('./bgDraw');
  const a = fullLook ? Object.assign({}, BG_DEFAULTS, tile.args) : Object.assign({}, BG_DEFAULTS, cur || {}, { palette: tile.args.palette, colors: tile.args.colors || '', paletteName: tile.args.paletteName || '' });
  return Object.assign(a, { grain: 0 }); // grain is noise at this size
}

/**
 * card(o): { key, label, args, colors[], on, look (a complete look ✦), title, onclick, ondblclick, oncontextmenu, cls }
 */
function card(o) {
  const widgets = require('./widgets');
  const { bgFrame } = require('./bgDraw');
  const a = o.args;
  const canvas = h('canvas', { class: 'pc-art', 'aria-hidden': 'true', 'data-key': `pc|${o.key}|${[a.style, a.from, a.to, a.angle, a.spread, a.palette, a.colors, a.motion, a.colorMotion, a.loop, a.amount].join('|')}` });
  // v0.75: rest the mouse on a card and it plays its real motion (the same maths as the expressions); a still look stays still
  const { moves } = require('./bgDraw');
  const t0 = Date.now();
  widgets.animated(canvas, (now) => { const { c, W, H } = widgets.prep(canvas); bgFrame(c, W, H, a, { width: 1600, height: 900 }, now === null ? 0 : ((Date.now() - t0) / 1000) % Math.max(a.loop || 8, 0.1), false); }, { still: !moves(a) });
  const cols = (o.colors || []).slice(0, 6);
  return h('button', {
    class: `pc ${o.on ? 'on' : ''} ${o.cls || ''}`, 'data-key': o.key, 'aria-pressed': String(!!o.on), title: o.title || o.label,
    onclick: o.onclick, ondblclick: o.ondblclick, oncontextmenu: o.oncontextmenu
  }, canvas,
  h('span', { class: 'pc-fan', 'aria-hidden': 'true' }, cols.map((hex, i) => h('i', { style: { background: hex, zIndex: String(10 - i) } }))),
  h('span', { class: 'pc-name' }, o.label),
  o.look ? h('span', { class: 'pc-look', title: 'A complete look (style + motion)' }, '✦') : null);
}

/** v0.75: just the art (a still / hover-playing background) — for squares that are not cards (Style Kits). */
function art(key, a, cls) {
  const widgets = require('./widgets');
  const { bgFrame, moves } = require('./bgDraw');
  const canvas = h('canvas', { class: cls || 'st-thumb', 'aria-hidden': 'true', 'data-key': `pca|${key}|${[a.style, a.palette, a.colors, a.motion, a.colorMotion].join('|')}` });
  const t0 = Date.now();
  return widgets.animated(canvas, (now) => { const { c, W, H } = widgets.prep(canvas); bgFrame(c, W, H, a, { width: 1600, height: 900 }, now === null ? 0 : ((Date.now() - t0) / 1000) % Math.max(a.loop || 8, 0.1), false); }, { still: !moves(a) });
}

module.exports = { card, cardArgs, art };
