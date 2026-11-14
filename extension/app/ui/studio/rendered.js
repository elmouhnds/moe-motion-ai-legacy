'use strict';
/**
 * v0.96 Rendered previews (docs/features/RENDERED_PREVIEWS.md): a tile that After Effects rendered (features/previews/
 * renderer.js) plays its own frames — the JPEG sequence in <data>/previews/<key>/ — instead of the drawn preview. Only
 * an entry whose signature matches the tile's tool, version and args is used, so a changed tile never shows a stale
 * render. Frames load lazily (only for tiles on screen) and are drawn to fill the tile.
 */
const R = require('../../../features/previews/renderer');

let index = null, registry = null;
const cache = new Map(); // key → { imgs: [Image], loaded: n }

/** Read the index (cheap: the store caches documents and re-reads one another panel rewrote). */
function sync(services) {
  registry = services && services.registry;
  try { index = services && services.store ? services.store.get('previews', null) : null; } catch (e) { index = null; }
}

/** The render of this tile, or null (never rendered, or rendered with other args / another tool version). */
function get(tile) {
  if (!index || !index.items || !registry || !tile || !tile.tool) return null;
  const tool = registry.get(tile.tool);
  if (!tool) return null;
  const key = R.keyOf(tile), e = index.items[key];
  return e && e.frames > 0 && e.sig === R.sigOf(tool, tile) ? Object.assign({ key }, e) : null;
}

const pad5 = (n) => String(n).padStart(5, '0');
function url(e, i) {
  const dir = String(e.folder).replace(/\\/g, '/').replace(/^\/+/, '');
  return `file:///${dir}/${e.pattern.replace('[#####]', pad5(i))}`;
}
function frames(e) {
  let c = cache.get(e.key);
  if (!c || c.frames !== e.frames || c.at !== e.at) {
    c = { frames: e.frames, at: e.at, imgs: [] };
    if (typeof Image === 'function') for (let i = 0; i < e.frames; i++) { const im = new Image(); im.decoding = 'async'; im.src = url(e, i); c.imgs.push(im); }
    cache.set(e.key, c);
  }
  return c.imgs;
}

/** Draw the render at time t (s; null = the still frame: the end of an In, a moment into an Out). */
function draw(c, W, H, e, t) {
  const imgs = frames(e);
  if (!imgs.length) return false;
  const n = imgs.length, still = e.dir === 'out' ? Math.floor(n * 0.15) : n - 1;
  const i = t === null ? still : Math.floor(t * e.fps) % (n + Math.round(e.fps * 0.6)); // a short hold at the end
  const im = imgs[Math.min(n - 1, Math.max(0, i))];
  if (!im.complete || !im.naturalWidth) return false;
  const k = Math.max(W / e.w, H / e.h), w = e.w * k, h = e.h * k;
  c.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
  return true;
}

module.exports = { sync, get, draw, url };
