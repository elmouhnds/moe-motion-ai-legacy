'use strict';
/**
 * v0.96 Rendered previews (docs/features/RENDERED_PREVIEWS.md): a tile that After Effects rendered (features/previews/
 * renderer.js) plays its own frames — the JPEG sequence in <data>/previews/<key>/ — instead of the drawn preview. Only
 * an entry whose signature matches the tile's tool, version and args is used, so a changed tile never shows a stale
 * render. Frames load lazily (only for tiles on screen) and are drawn to fill the tile.
 */
const R = require('../../../features/previews/renderer');

let index = null, registry = null;
// v0.98: previews bundled with MOE (tools/render-previews.py — MOE's renderer, from the same plans), one WebP sprite per
// tile; used when the user has no After Effects render of the tile
let bundled = null;
function bundledIndex() {
  if (bundled === null) { try { bundled = require('../../../assets/previews/index.json'); } catch (e) { bundled = {}; } }
  return bundled;
}
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

/** The After Effects render of this tile, else the bundled MOE render, else null (signatures must match). */
function best(tile) {
  const ae = index && registry ? get(tile) : null;
  if (ae) return ae;
  if (!registry || !tile || !tile.tool) return null;
  const tool = registry.get(tile.tool);
  if (!tool) return null;
  const key = R.keyOf(tile), b = bundledIndex()[key];
  return b && b.sig === R.sigOf(tool, tile) ? Object.assign({ key, sprite: true, at: b.sig }, b) : null;
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

const sprites = new Map();
function spriteOf(e) {
  let im = sprites.get(e.file);
  if (!im && typeof Image === 'function') {
    im = new Image(); im.decoding = 'async';
    const embedded = typeof window !== 'undefined' && window.__PREVIEW_IMG && window.__PREVIEW_IMG[e.file];
    im.src = embedded || `assets/previews/${e.file}`;
    sprites.set(e.file, im);
  }
  return im;
}

/** Draw the render at time t (s; null = the still frame: the end of an In, a moment into an Out). */
function draw(c, W, H, e, t) {
  if (e.sprite) {
    const im = spriteOf(e);
    if (!im || !im.complete || !im.naturalWidth) return false;
    // the still frame is a moment INSIDE the effect (its character), not the finished card every tile shares: the
    // sprite starts 0.2 s before the move and holds 0.6 s after it (tools/preview-frames.js)
    const n = e.frames, lead = Math.round(0.2 * e.fps), hold = Math.round(0.6 * e.fps), anim = Math.max(1, n - lead - hold);
    const still = Math.min(n - 1, lead + Math.round(anim * (e.dir === 'out' ? 0.45 : 0.4)));
    const i = t === null ? still : Math.min(n - 1, Math.floor(t * e.fps) % (n + Math.round(e.fps * 0.6)));
    const sx = (i % e.cols) * e.w, sy = Math.floor(i / e.cols) * e.h;
    const k = Math.max(W / e.w, H / e.h), w = e.w * k, h = e.h * k;
    c.drawImage(im, sx, sy, e.w, e.h, (W - w) / 2, (H - h) / 2, w, h);
    return true;
  }
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

module.exports = { sync, get, best, draw, url };
