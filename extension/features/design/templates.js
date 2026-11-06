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
  { id: 'tag', label: 'Tag', hint: 'A rounded pill that pops in around its word', title: 'NEW', subtitle: '' },
  // v0.50 (TEMPLATES.md): four more on the same plan
  { id: 'quote', label: 'Quote', hint: 'A big quote mark pops, the words rise in, the author follows', title: 'Make it move, then make it matter.', subtitle: 'Sara Ahmed' },
  { id: 'endCard', label: 'End Card', short: 'End', hint: 'A logo circle, a thank-you line and a button that pops — the last seconds of a video', title: 'Thanks for watching', subtitle: 'Subscribe' },
  { id: 'handle', label: 'Social Handle', short: 'Handle', hint: 'Your @name in a pill with a dot, bottom corner — grows in, the name fades up', title: '@moe.motion', subtitle: '' },
  { id: 'chapter', label: 'Chapter', hint: 'A big number, a line that grows and the chapter\'s title — for sections of a longer video', title: 'Getting started', subtitle: 'Your first animation', number: '01' }
];
// v0.57 (docs/features/PRODUCT_UI.md): the Product UI kit — interface pieces on the same engine (kit: 'ui')
const UI = require('./uiKit');
UI.COMPONENTS.forEach((c) => TEMPLATES.push(Object.assign({ kit: 'ui' }, c)));
const byId = (id) => TEMPLATES.find((t) => t.id === id) || null;
const isUi = (id) => !!(byId(id) && byId(id).kit === 'ui');

/** Scale of the design: everything is drawn for 1080 px tall and scaled to the comp. */
const unit = (comp) => (comp && comp.height > 0 ? comp.height / 1080 : 1);

/** The text layers a template needs, before anything is measured. */
function textSpecs(id, opts, comp) {
  const s = unit(comp), rtl = isRtl(opts);
  const T = byId(id);
  if (!T) throw new Error(`Unknown template ${id}`);
  if (T.kit === 'ui') return UI.textSpecs(id, opts, comp, helpers());
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
  } else if (id === 'quote') {
    out.push({ key: 'mark', name: 'Quote Mark', text: rtl ? '\u201D' : '\u201C', fontSize: Math.round(220 * s), bold: true, color: hexRgb(opts.accent || '#ff5a3c'), justify: side, rtl });
    out.push({ key: 'title', text: title, fontSize: Math.round(58 * s), bold: true, color: textColor, justify: side, rtl });
    if (sub) out.push({ key: 'subtitle', text: `${rtl ? '' : '\u2014 '}${sub}${rtl ? ' \u2014' : ''}`, fontSize: Math.round(32 * s), color: textColor.map((v) => v * 0.82), justify: side, rtl });
  } else if (id === 'endCard') {
    out.push({ key: 'title', text: title, fontSize: Math.round(72 * s), bold: true, color: textColor, justify: 'center', rtl });
    if (sub) out.push({ key: 'subtitle', name: 'Button Text', text: sub, fontSize: Math.round(34 * s), bold: true, color: hexRgb(opts.tagText || '#111111'), justify: 'center', rtl });
  } else if (id === 'handle') {
    out.push({ key: 'title', text: title, fontSize: Math.round(36 * s), bold: true, color: textColor, justify: side, rtl });
  } else if (id === 'chapter') {
    out.push({ key: 'number', name: 'Number', text: String(opts.number === undefined || opts.number === '' ? T.number : opts.number), fontSize: Math.round(150 * s), bold: true, color: hexRgb(opts.accent || '#ff5a3c'), justify: rtl ? 'left' : 'right', rtl: false });
    out.push({ key: 'title', text: title, fontSize: Math.round(66 * s), bold: true, color: textColor, justify: side, rtl });
    if (sub) out.push({ key: 'subtitle', text: sub, fontSize: Math.round(32 * s), color: textColor.map((v) => v * 0.82), justify: side, rtl });
  }
  // v0.52 (TEMPLATES.md, Auto-fit): every line has a widest it may be inside the safe area; After Effects measures it and
  // a longer text gets a smaller font (text.create → fit), the quote mark and the chapter number keep their size
  const W = comp && comp.width > 0 ? comp.width : 1920;
  return out.filter((t) => t.text.trim()).map((t) => Object.assign(t, { maxWidth: ['mark', 'number'].includes(t.key) ? 0 : Math.round(W * (FIT[id] || 0.8)) }));
}
/** The widest a template's lines may be, as a share of the comp width (inside title safe, beside the template's parts). */
const FIT = { lowerThird: 0.6, titleCard: 0.85, callout: 0.32, tag: 0.5, quote: 0.72, endCard: 0.8, handle: 0.45, chapter: 0.55 };
/**
 * The font size that makes a line measured `width` wide at `fontSize` fit in `maxWidth` (2 % margin), never under
 * 40 % of the design size — the same rule the host runs on After Effects' own measurement.
 */
function fitSize(fontSize, width, maxWidth, design) {
  if (!(maxWidth > 0) || !(width > maxWidth)) return fontSize;
  return Math.max(Math.round((design || fontSize) * 0.4), Math.floor(fontSize * (maxWidth / width) * 0.98));
}

/** A text part's layer name: Title, Subtitle, or its own (Quote Mark, Number, Button Text). */
const nameOf = (sp) => sp.name || (sp.key === 'title' ? 'Title' : 'Subtitle');

/** Entrance keys from Quick Animate's own plan, shifted by `delay`. */
function enter(key, prop, a, b, delay, dur, ease) {
  const e = PLAN.easePair(ease || 'expo');
  return { key, prop, keys: PLAN.keysFor(e, delay, dur, a, b) };
}
const fadeIn = (key, delay, dur) => enter(key, 'opacity', 0, 100, delay, dur, 'smooth');
/** The shared makers the UI kit uses (one ease / key maker for both modules). */
const helpers = () => ({ unit, hexRgb, enter, fadeIn, PLAN });

/** The full plan once the texts are measured ([w, h] per text key). */
function layout(id, opts, comp, measured) {
  const s = unit(comp), W = comp.width, H = comp.height, rtl = isRtl(opts);
  const m = (k) => (measured && measured[k]) || [0, 0];
  if (isUi(id)) return finish(opts, UI.layout(id, opts, comp, m, helpers()));
  const accent = hexRgb(opts.accent || '#ff5a3c');
  const els = [], keys = [];
  const dur = opts.duration > 0 ? opts.duration : 0.7;
  const specs = textSpecs(id, opts, comp);
  const spec = (k) => specs.find((x) => x.key === k);
  // a text that was fitted keeps the size it was measured at (measured[key][2])
  const text = (k, pos) => { const sp = spec(k); if (sp) els.push(Object.assign({ kind: 'text', name: nameOf(sp), position: pos }, sp, m(k)[2] ? { fontSize: m(k)[2] } : {})); return !!sp; };
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
    return finish(opts, { elements: els, keys, box: [Math.min(x0, tx + dir * Math.max(tw, sw)), top, Math.abs(tx + dir * Math.max(tw, sw) - x0), blockH] });
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
    return finish(opts, { elements: els, keys, box: [W / 2 - tw / 2, ty - th, tw, th + 2 * lineGap + sh] });
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
    return finish(opts, { elements: els, keys, box: [Math.min(P[0], end[0]), elbow[1] - th - 14 * s, Math.abs(end[0] - P[0]), P[1] - elbow[1] + th + 14 * s] });
  }
  if (id === 'tag') {
    const P = opts.point && opts.point.length === 2 ? opts.point : [W / 2, H * 0.3];
    const [tw, th] = m('title');
    const padX = 28 * s, padY = 14 * s, h = th + 2 * padY;
    els.push({ key: 'pill', kind: 'rect', name: 'Pill', position: P, size: [tw + 2 * padX, h], roundness: h / 2, color: accent });
    text('title', [P[0], P[1] + th * 0.35]);
    const pop = PLAN.animate({ kind: 'scale', dir: 'in', overshoot: true, duration: dur * 0.8, ease: 'snappy' }, { scale: [100, 100] });
    keys.push({ key: 'pill', prop: 'scale', keys: pop.keys }, { key: 'title', prop: 'scale', keys: pop.keys.map((k) => Object.assign({}, k, { t: k.t + 0.08 })) });
    return finish(opts, { elements: els, keys, box: [P[0] - tw / 2 - padX, P[1] - h / 2, tw + 2 * padX, h] });
  }
  if (id === 'quote') {
    const dir = rtl ? -1 : 1, x0 = rtl ? W * 0.86 : W * 0.14;
    const [, mh] = m('mark'), [tw, th] = m('title'), [sw, sh] = m('subtitle');
    const ty = H * 0.5 + th * 0.35, sy = ty + 26 * s + sh;
    text('mark', [x0 - dir * 10 * s, ty - th - 10 * s + mh * 0.35]);
    text('title', [x0, ty]);
    text('subtitle', [x0, sy]);
    const pop = PLAN.animate({ kind: 'scale', dir: 'in', overshoot: true, duration: dur * 0.7, ease: 'snappy' }, { scale: [100, 100] });
    keys.push({ key: 'mark', prop: 'scale', keys: pop.keys });
    keys.push(enter('title', 'position', [x0, ty + 40 * s], [x0, ty], 0.15, dur), fadeIn('title', 0.15, dur * 0.8));
    if (spec('subtitle')) keys.push(fadeIn('subtitle', 0.4, dur * 0.8));
    const right = x0 + dir * Math.max(tw, sw);
    return finish(opts, { elements: els, keys, box: [Math.min(x0, right), ty - th - mh * 0.5, Math.abs(right - x0), th + sh + mh * 0.5 + 26 * s] });
  }
  if (id === 'endCard') {
    const [tw, th] = m('title'), [sw, sh] = m('subtitle');
    const r = 90 * s, cy = H * 0.36;
    els.push({ key: 'logo', kind: 'ellipse', name: 'Logo Circle', position: [W / 2, cy], size: [2 * r, 2 * r], color: accent });
    const ty = cy + r + 40 * s + th * 0.8;
    text('title', [W / 2, ty]);
    const bh = sh + 32 * s, by = ty + 40 * s + bh / 2;
    if (spec('subtitle')) {
      els.push({ key: 'button', kind: 'rect', name: 'Button', position: [W / 2, by], size: [sw + 64 * s, bh], roundness: bh / 2, color: accent });
      text('subtitle', [W / 2, by + sh * 0.35]);
    }
    const pop = (d) => PLAN.animate({ kind: 'scale', dir: 'in', overshoot: true, duration: dur * 0.8, ease: 'snappy' }, { scale: [100, 100] }).keys.map((k) => Object.assign({}, k, { t: k.t + d }));
    keys.push({ key: 'logo', prop: 'scale', keys: pop(0) });
    keys.push(enter('title', 'position', [W / 2, ty + 30 * s], [W / 2, ty], 0.2, dur), fadeIn('title', 0.2, dur * 0.8));
    if (spec('subtitle')) keys.push({ key: 'button', prop: 'scale', keys: pop(0.45) }, { key: 'subtitle', prop: 'scale', keys: pop(0.5) });
    return finish(opts, { elements: els, keys, box: [W / 2 - Math.max(tw, 2 * r) / 2, cy - r, Math.max(tw, 2 * r), by + bh / 2 - (cy - r)] });
  }
  if (id === 'handle') {
    const [tw, th] = m('title');
    const h = th + 30 * s, dot = 14 * s, pad = 22 * s, gap = 14 * s;
    const w = pad + dot + gap + tw + pad;
    const cx = rtl ? W - W * 0.06 - w / 2 : W * 0.06 + w / 2, cy = H - H * 0.08 - h / 2;
    els.push({ key: 'pill', kind: 'rect', name: 'Pill', position: [cx, cy], size: [w, h], roundness: h / 2, color: accent });
    const dx = rtl ? cx + w / 2 - pad - dot / 2 : cx - w / 2 + pad + dot / 2;
    els.push({ key: 'dot', kind: 'ellipse', name: 'Dot', position: [dx, cy], size: [dot, dot], color: hexRgb(opts.textColor || '#ffffff') });
    const tx = rtl ? dx - dot / 2 - gap : dx + dot / 2 + gap;
    text('title', [tx, cy + th * 0.35]);
    keys.push(enter('pill', 'scale', [0, 100], [100, 100], 0, dur * 0.8, 'expo'));
    keys.push(enter('dot', 'scale', [0, 0], [100, 100], 0.2, dur * 0.5, 'snappy'));
    keys.push(enter('title', 'position', [tx, cy + th * 0.35 + 16 * s], [tx, cy + th * 0.35], 0.25, dur * 0.8), fadeIn('title', 0.25, dur * 0.7));
    return finish(opts, { elements: els, keys, box: [cx - w / 2, cy - h / 2, w, h] });
  }
  if (id === 'chapter') {
    // number | line | title + subtitle, centred vertically, from the side (title safe)
    const dir = rtl ? -1 : 1, x0 = rtl ? W * 0.88 : W * 0.12;
    const [nw, nh] = m('number'), [tw, th] = m('title'), [sw, sh] = m('subtitle');
    const blockH = th + (spec('subtitle') ? 18 * s + sh : 0);
    const cy = H * 0.5, top = cy - blockH / 2;
    const nx = x0 + dir * nw, lineX = nx + dir * 36 * s, tx = lineX + dir * 36 * s;
    text('number', [nx, cy + nh * 0.35]);
    els.push({ key: 'line', kind: 'rect', name: 'Divider', position: [lineX, cy], size: [6 * s, Math.max(blockH, nh * 0.8) + 20 * s], roundness: 3 * s, color: accent });
    text('title', [tx, top + th * 0.8]);
    text('subtitle', [tx, top + th + 18 * s + sh * 0.8]);
    keys.push(enter('number', 'position', [nx, cy + nh * 0.35 + 50 * s], [nx, cy + nh * 0.35], 0, dur), fadeIn('number', 0, dur * 0.7));
    keys.push(enter('line', 'scale', [100, 0], [100, 100], 0.15, dur * 0.8, 'expo'));
    keys.push(enter('title', 'position', [tx - dir * 50 * s, top + th * 0.8], [tx, top + th * 0.8], 0.3, dur), fadeIn('title', 0.3, dur * 0.8));
    if (spec('subtitle')) keys.push(fadeIn('subtitle', 0.45, dur * 0.8));
    const far = tx + dir * Math.max(tw, sw);
    return finish(opts, { elements: els, keys, box: [Math.min(x0, far), Math.min(top, cy - nh / 2), Math.abs(far - x0), Math.max(blockH, nh)] });
  }
  throw new Error(`Unknown template ${id}`);
}

/**
 * v0.50: Hold → the exit. After the entrance and `hold` seconds, every animated property goes back the way it came
 * (the last part in leaves first), on Quick Animate's keys — so a lower third leaves by itself. Hold 0 = it stays.
 */
function finish(opts, plan) {
  const hold = Number(opts.hold) || 0;
  if (hold <= 0) return plan;
  const dur = (opts.duration > 0 ? opts.duration : 0.7) * 0.7;
  const inEnd = Math.max(...plan.keys.map((k) => k.keys[k.keys.length - 1].t));
  const firsts = plan.keys.map((k) => k.keys[0].t), last = Math.max(...firsts);
  const e = PLAN.easePair('snappy');
  plan.keys = plan.keys.map((k) => {
    const from = k.keys[k.keys.length - 1].v, to = k.keys[0].v;
    const t0 = inEnd + hold + (last - k.keys[0].t) * 0.5;
    return Object.assign({}, k, { keys: k.keys.concat(PLAN.keysFor(e, t0, dur, from, to)) });
  });
  plan.exitAt = inEnd + hold;
  return plan;
}

/**
 * v0.51 (docs/features/TEMPLATES.md, Brand): a template in the active client's brand — the accent from the brand's
 * primary colour, the word on a pill / button in the brand colour (or black / white) that reads best on that accent
 * (contrast-checked, ≥ 4.5 when one exists), the brand's Arabic or English font by the text's script.
 * → { accent, tagText, font, contrast, brand } or null (no brand / no colours). Pure: the tool and the previews use it.
 */
function brandOpts(brand, opts) {
  const BR = require('../brand/brands');
  const roles = require('../brand/applyAll').brandRoles(brand);
  if (!roles) return null;
  const accent = roles.primary.hex;
  const acc = BR.hexToRgb(accent);
  const pool = [roles.text, roles.background, { hex: '#111111' }, { hex: '#ffffff' }].filter((c) => c && BR.hexToRgb(c.hex));
  const scored = pool.map((c) => ({ hex: c.hex, ratio: BR.contrast(BR.hexToRgb(c.hex), acc) })).sort((a, b) => b.ratio - a.ratio);
  const rtl = isRtl(opts || {});
  const f = brand.fonts || {};
  const font = (rtl ? f.arabic : f.english) || f.english || f.arabic || null;
  return { accent, tagText: scored[0].hex, font: font && font.ps ? font.ps : null, contrast: +scored[0].ratio.toFixed(2), brand: brand.name };
}

module.exports = { TEMPLATES, isUi, FIT, byId, textSpecs, layout, finish, fitSize, nameOf, brandOpts, isRtl, unit, hexRgb };
