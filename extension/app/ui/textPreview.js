'use strict';
/**
 * Canvas preview for text presets, driven by features/text/preview.js (Range Selector
 * simulation). One animation loop for all visible cards; stops when none are mounted.
 */
const { buildSpec } = require('../../features/text/presets');
const sim = require('../../features/text/preview');
const { hasArabic } = require('../../features/brand/brands');


function lerp(a, b, t) { return a + (b - a) * t; }

function draw(entry, now) {
  const { canvas, preset, text } = entry;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  if (canvas.width !== Math.round(W * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const spec = entry.spec || (entry.spec = buildSpec(preset, hasArabic(text) && preset.basedOn < 3 ? { basedOn: 3 } : {}));
  // Hold the start state briefly, play, then hold the end state.
  const cycle = spec.duration + 1.2;
  // Still frame (Calm / Off motion, or not hovered): the text fully visible —
  // the end of an In, the start of an Out (an Out's end frame is empty).
  const t = now === null ? (preset.kind === 'out' ? -0.1 : spec.duration + 0.2) : ((now / 1000) % cycle) - 0.35;
  const units = sim.frame(spec, text, t);
  const rtl = hasArabic(text);
  const style = getComputedStyle(canvas);
  ctx.font = `600 ${Math.round(H * 0.3)}px ${style.getPropertyValue('--font') || 'sans-serif'}`;
  ctx.textBaseline = 'middle';
  ctx.direction = rtl ? 'rtl' : 'ltr';
  const scaleK = H / 260; // AE pixels → preview pixels
  const p = preset.props;
  const widths = units.map((u) => ctx.measureText(u.text).width + (p.tracking ? (u.amount * p.tracking * scaleK * 0.6) : 0));
  const total = widths.reduce((a, b) => a + b, 0);
  let x = rtl ? (W + total) / 2 : (W - total) / 2;
  const color = style.getPropertyValue('--text').trim() || '#eee';
  units.forEach((u, i) => {
    const w = widths[i];
    const cx = rtl ? x - w / 2 : x + w / 2;
    x += rtl ? -w : w;
    if (u.space) return;
    const a = u.amount;
    // v0.64 (WAVE4.md): Wiggly Selector (Intersect, frozen) — each letter its own random −1…1 per dimension, like AE
    const wig = preset.wiggly ? (k) => { const v = Math.sin((i + 1) * 127.1 + k * 311.7) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; } : () => 1;
    const pos0 = p.position || [0, 0, 0], pos = [pos0[0] * wig(1), pos0[1] * wig(2), 0];
    const sc = p.scale ? [lerp(100, p.scale[0], a) / 100, lerp(100, p.scale[1], a) / 100] : [1, 1];
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, lerp(1, (p.opacity === undefined ? 100 : p.opacity) / 100, a)));
    const blur = p.blur ? Math.abs(Math.max(p.blur[0], p.blur[1]) * a * wig(4)) * scaleK : 0;
    if (blur > 0.2) ctx.filter = `blur(${blur.toFixed(1)}px)`;
    ctx.translate(cx + pos[0] * a * scaleK, H / 2 + pos[1] * a * scaleK);
    if (p.rotation) ctx.rotate((p.rotation * a * wig(3) * Math.PI) / 180);
    if (p.skew) ctx.transform(1, 0, -Math.tan((p.skew * a * Math.PI) / 180), 1, 0, 0);
    ctx.scale(Math.max(0.001, sc[0]), Math.max(0.001, sc[1]));
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(p.characterOffset && a > 0.01 ? offsetChars(u.text, Math.round(p.characterOffset * a)) : u.text, 0, 0);
    ctx.restore();
  });
}

/** v0.64: After Effects' Character Offset (Preserve Case & Digits): a letter moves n places along its own alphabet. */
function offsetChars(t, n) {
  return t.replace(/[A-Za-z0-9]/g, (ch) => {
    const c = ch.charCodeAt(0), [b, len] = c >= 97 ? [97, 26] : c >= 65 ? [65, 26] : [48, 10];
    return String.fromCharCode(b + ((((c - b + n) % len) + len) % len));
  });
}

/**
 * Mount a preview canvas for a preset. Returns the canvas element.
 * v0.6.5: runs on the shared widgets loop, so it follows Settings › Motion (Calm animates only the
 * card under the mouse, 30 fps max, nothing off-screen) instead of animating every card forever.
 */
function previewCanvas(preset, text) {
  const canvas = document.createElement('canvas');
  canvas.className = 'tp-canvas';
  canvas.setAttribute('data-key', `tp|${preset.id}|${text}`);
  const entry = { canvas, preset, text };
  return require('./widgets').animated(canvas, (now) => draw(entry, now));
}

module.exports = { previewCanvas };
