'use strict';
/**
 * Native templates (v0.49, docs/features/TEMPLATES.md) — pure. A template is a plan of real After Effects layers:
 * text layers (measured in After Effects, never guessed), shape layers sized to that text, and the keys that animate
 * them in (built with the same `quick/animatePlan` as Quick Animate, so the tile preview plays them exactly).
 *
 *   textSpecs(id, opts, comp)            → the text layers to create first: [{ key, text, fontSize, bold, color, justify, rtl }]
 *   layout(id, opts, comp, measured)     → { elements: [...], keys: [...] } once each text's size is known
 *       measured: { [key]: [width, height] } (sourceRectAtTime from After Effects, or the browser's measureText)
 *       element:  { key, kind: 'text'|'rect'|'ellipse'|'path', name, position, size?, roundness?, points?, color, stroke? }
 *       keys:     [{ key, prop: 'position'|'opacity'|'scale'|'trimEnd', keys: [{ t, v, easeIn, easeOut }] }]
 * Positions are comp pixels (the layer's position = its anchor: a text's baseline start, a shape's centre).
 */
const PLAN = require('../quick/animatePlan');

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const isRtl = (opts) => (opts.side === 'rtl' ? true : opts.side === 'ltr' ? false : ARABIC.test(`${opts.title || ''}${opts.subtitle || ''}`));
const hexRgb = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '')); const n = m ? parseInt(m[1], 16) : 0xffffff; return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

const TEMPLATES = [
  { id: 'lowerThird', label: 'Lower Third', short: 'Lower', hint: 'Name and role at the bottom, an accent bar that grows, the lines rise in one after the other', title: 'Sara Ahmed', subtitle: 'Motion Designer' },
  { id: 'titleCard', label: 'Title Card', short: 'Title', hint: 'A big centred title, a line that draws under it, the subtitle rises in', title: 'The Big Launch', subtitle: 'Coming this summer' },
  { id: 'callout', label: 'Callout', hint: 'A dot on the point, a line that draws out to the label', title: 'New feature', subtitle: 'Tap to try it' },
  { id: 'tag', label: 'Tag', hint: 'A rounded pill that pops in around its word', title: 'NEW', subtitle: '' }
];
const byId = (id) => TEMPLATES.find((t) => t.id === id) || null;

/** Scale of the design: everything is drawn for 1080 px tall and scaled to the comp. */
const unit = (comp) => (comp && comp.height > 0 ? comp.height / 1080 : 1);

/** The text layers a template needs, before anything is measured. */
function textSpecs(id, opts, comp) {
  const s = unit(comp), rtl = isRtl(opts);
  const T = byId(id);
  if (!T) throw new Error(`Unknown template ${id}`);
  const title = opts.title === undefined ? T.title : String(opts.title);
  const sub = opts.subtitle === undefined ? T.subtitle : String(opts.subtitle);
  const textColor = hexRgb(opts.textColor || '#ffffff');
  const side = rtl ? 'right' : 'left';
  const out = [];
  if (id === 'lowerThird') {
    out.push({ key: 'title', text: title, fontSize: Math.round(64 * s), bold: true, color: textColor, justify: side, rtl });
    if (sub) out.push({ key: 'subtitle', text: sub, fontSize: Math.round(34 * s), color: textColor.map((v) => v * 0.82), justify: side, rtl });
  } else if (id === 'titleCard') {
    out.push({ key: 'title', text: title, fontSize: Math.round(120 * s), bold: true, color: textColor, justify: 'center', rtl });
    if (sub) out.push({ key: 'subtitle', text: sub, fontSize: Math.round(44 * s), color: textColor.map((v) => v * 0.82), justify: 'center', rtl });
  } else if (id === 'callout') {
    out.push({ key: 'title', text: title, fontSize: Math.round(44 * s), bold: true, color: textColor, justify: side, rtl });
    if (sub) out.push({ key: 'subtitle', text: sub, fontSize: Math.round(28 * s), color: textColor.map((v) => v * 0.82), justify: side, rtl });
  } else if (id === 'tag') {
    out.push({ key: 'title', text: title, fontSize: Math.round(36 * s), bold: true, color: hexRgb(opts.tagText || '#111111'), justify: 'center', rtl });
  }
  return out.filter((t) => t.text.trim());
}

/** Entrance keys from Quick Animate's own plan, shifted by `delay`. */
function enter(key, prop, a, b, delay, dur, ease) {
  const e = PLAN.easePair(ease || 'expo');
  return { key, prop, keys: PLAN.keysFor(e, delay, dur, a, b) };
}
const fadeIn = (key, delay, dur) => enter(key, 'opacity', 0, 100, delay, dur, 'smooth');

/** The full plan once the texts are measured ([w, h] per text key). */
function layout(id, opts, comp, measured) {
  const s = unit(comp), W = comp.width, H = comp.height, rtl = isRtl(opts);
  const m = (k) => (measured && measured[k]) || [0, 0];
  const accent = hexRgb(opts.accent || '#ff5a3c');
  const els = [], keys = [];
  const dur = opts.duration > 0 ? opts.duration : 0.7;
  const specs = textSpecs(id, opts, comp);
  const spec = (k) => specs.find((x) => x.key === k);
  const text = (k, pos) => { const sp = spec(k); if (sp) els.push(Object.assign({ kind: 'text', name: k === 'title' ? 'Title' : 'Subtitle', position: pos }, sp)); return !!sp; };
  if (id === 'lowerThird') {
    // 7.5 % from the side (title safe), the block's bottom at 82 % of the height
    const x0 = rtl ? W - W * 0.075 : W * 0.075, dir = rtl ? -1 : 1;
    const [tw, th] = m('title'), [sw, sh] = m('subtitle');
    const gap = 12 * s, pad = 26 * s, barW = 10 * s;
    const blockH = th + (spec('subtitle') ? gap + sh : 0);
    const bottom = H * 0.82, top = bottom - blockH;
    els.push({ key: 'bar', kind: 'rect', name: 'Accent Bar', position: [x0 + dir * barW / 2, top + blockH / 2], size: [barW, blockH + 10 * s], roundness: barW / 2, color: accent });
    const tx = x0 + dir * (barW + pad);
    text('title', [tx, top + th * 0.8]);
    text('subtitle', [tx, top + th + gap + sh * 0.8]);
    // the bar grows from its bottom, then the lines rise in one after the other (Rise + Fade)
    keys.push(enter('bar', 'scale', [100, 0], [100, 100], 0, dur * 0.8, 'expo'));
    keys.push(enter('title', 'position', [tx - dir * 40 * s, top + th * 0.8], [tx, top + th * 0.8], 0.12, dur), fadeIn('title', 0.12, dur * 0.8));
    if (spec('subtitle')) keys.push(enter('subtitle', 'position', [tx - dir * 40 * s, top + th + gap + sh * 0.8], [tx, top + th + gap + sh * 0.8], 0.24, dur), fadeIn('subtitle', 0.24, dur * 0.8));
    return { elements: els, keys, box: [Math.min(x0, tx + dir * Math.max(tw, sw)), top, Math.abs(tx + dir * Math.max(tw, sw) - x0), blockH] };
  }
  if (id === 'titleCard') {
    const [tw, th] = m('title'), [, sh] = m('subtitle');
    const cy = H / 2, lineGap = 28 * s;
    const ty = cy - (spec('subtitle') ? sh / 2 : 0) + th * 0.3;
    text('title', [W / 2, ty]);
    const ly = ty + lineGap;
    els.push({ key: 'line', kind: 'rect', name: 'Underline', position: [W / 2, ly], size: [Math.max(80 * s, tw * 0.35), 6 * s], roundness: 3 * s, color: accent });
    text('subtitle', [W / 2, ly + lineGap + sh * 0.8]);
    keys.push(enter('title', 'scale', [112, 112], [100, 100], 0, dur, 'expo'), fadeIn('title', 0, dur * 0.8));
    keys.push(enter('line', 'scale', [0, 100], [100, 100], 0.2, dur * 0.8, 'expo'));
    if (spec('subtitle')) keys.push(enter('subtitle', 'position', [W / 2, ly + lineGap + sh * 0.8 + 30 * s], [W / 2, ly + lineGap + sh * 0.8], 0.35, dur), fadeIn('subtitle', 0.35, dur * 0.8));
    return { elements: els, keys, box: [W / 2 - tw / 2, ty - th, tw, th + 2 * lineGap + sh] };
  }
  if (id === 'callout') {
    // the point (default: right of centre, a bit up); the label sits up and out from it
    const P = opts.point && opts.point.length === 2 ? opts.point : [W * 0.58, H * 0.52];
    const dir = rtl ? -1 : 1;
    const [tw, th] = m('title'), [sw, sh] = m('subtitle');
    const elbow = [P[0] + dir * 90 * s, P[1] - 90 * s], end = [elbow[0] + dir * (Math.max(tw, sw) + 20 * s), elbow[1]];
    els.push({ key: 'dot', kind: 'ellipse', name: 'Dot', position: P, size: [18 * s, 18 * s], color: accent });
    els.push({ key: 'line', kind: 'path', name: 'Leader', position: [0, 0], points: [P, elbow, end], stroke: { color: accent, width: 3 * s } });
    const tx = elbow[0] + dir * 10 * s;
    text('title', [tx, elbow[1] - 14 * s]);
    text('subtitle', [tx, elbow[1] + 14 * s + sh * 0.8]);
    keys.push(enter('dot', 'scale', [0, 0], [100, 100], 0, dur * 0.6, 'snappy'));
    keys.push(enter('line', 'trimEnd', 0, 100, 0.15, dur, 'smooth'));
    keys.push(fadeIn('title', 0.45, dur * 0.7));
    if (spec('subtitle')) keys.push(fadeIn('subtitle', 0.55, dur * 0.7));
    return { elements: els, keys, box: [Math.min(P[0], end[0]), elbow[1] - th - 14 * s, Math.abs(end[0] - P[0]), P[1] - elbow[1] + th + 14 * s] };
  }
  if (id === 'tag') {
    const P = opts.point && opts.point.length === 2 ? opts.point : [W / 2, H * 0.3];
    const [tw, th] = m('title');
    const padX = 28 * s, padY = 14 * s, h = th + 2 * padY;
    els.push({ key: 'pill', kind: 'rect', name: 'Pill', position: P, size: [tw + 2 * padX, h], roundness: h / 2, color: accent });
    text('title', [P[0], P[1] + th * 0.35]);
    const pop = PLAN.animate({ kind: 'scale', dir: 'in', overshoot: true, duration: dur * 0.8, ease: 'snappy' }, { scale: [100, 100] });
    keys.push({ key: 'pill', prop: 'scale', keys: pop.keys }, { key: 'title', prop: 'scale', keys: pop.keys.map((k) => Object.assign({}, k, { t: k.t + 0.08 })) });
    return { elements: els, keys, box: [P[0] - tw / 2 - padX, P[1] - h / 2, tw + 2 * padX, h] };
  }
  throw new Error(`Unknown template ${id}`);
}

module.exports = { TEMPLATES, byId, textSpecs, layout, isRtl, unit, hexRgb };
