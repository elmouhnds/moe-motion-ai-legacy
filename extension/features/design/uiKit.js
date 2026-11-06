'use strict';
/**
 * Product UI kit (v0.57, docs/features/PRODUCT_UI.md) — pure. Interface pieces for SaaS / app / product videos, as
 * template plans on the Templates engine (`templates.js`): real text layers measured by After Effects, rounded shapes,
 * paths that draw on, one null, and an animation that *uses* the piece (a button is clicked, a toggle switches, a
 * bar fills, a message is typed) — not just an entrance.
 *
 *   COMPONENTS                       [{ id, label, hint, title, subtitle, ... }]
 *   textSpecs(id, opts, comp, H)     the text layers, before measuring
 *   layout(id, opts, comp, m, H)     { elements, keys, box }   (m(key) → [w, h, fontSize] measured)
 *
 * `H` are templates.js helpers (unit, hexRgb, enter, fadeIn, PLAN) so both modules share one ease / key maker.
 * Every property's keys are ONE list (entrance + the action), so the preview and After Effects play the same thing.
 * Themes: light (white card, dark text) / dark (graphite card, white text); the accent is the brand's colour.
 */
const COMPONENTS = [
  { id: 'uiButton', label: 'Button Click', short: 'Button', hint: 'A button pops in, then gets clicked: it presses down and a ripple spreads', title: 'Get started', subtitle: '' },
  { id: 'uiToggle', label: 'Toggle Switch', short: 'Toggle', hint: 'A settings row whose switch flips on: the knob slides, the track fills with the accent', title: 'Dark mode', subtitle: '' },
  { id: 'uiNotify', label: 'Notification', short: 'Notify', hint: 'A phone-style notification drops in from the top with its app icon, title and message', title: 'New order', subtitle: 'Sara just bought the Pro plan' },
  { id: 'uiSearch', label: 'Search Bar', short: 'Search', hint: 'A search field grows in, the query slides in and the text cursor blinks', title: 'motion design templates', subtitle: '' },
  { id: 'uiProgress', label: 'Progress Bar', short: 'Progress', hint: 'A labelled bar fills from left to right, then the percentage appears', title: 'Uploading project', subtitle: '100%' },
  { id: 'uiChat', label: 'Chat Message', short: 'Chat', hint: 'Three typing dots bounce, then the message bubble pops in', title: 'Can we launch on Friday?', subtitle: '' },
  { id: 'uiStat', label: 'Stat Card', short: 'Stat', hint: 'A dashboard card: the label, a big number and a trend line that draws itself', title: '$48.2K', subtitle: 'Monthly revenue' },
  { id: 'uiTask', label: 'Task Done', short: 'Task', hint: 'A to-do row: the box fills, the check draws and the task is crossed out', title: 'Send the final render', subtitle: '' }
];
const byId = (id) => COMPONENTS.find((c) => c.id === id) || null;
/** How wide each piece's main text may be (share of the comp width) before Auto-fit shrinks it. */
const FIT = { uiButton: 0.4, uiToggle: 0.36, uiNotify: 0.36, uiSearch: 0.4, uiProgress: 0.42, uiChat: 0.4, uiStat: 0.3, uiTask: 0.42 };

const THEMES = {
  light: { card: [1, 1, 1], text: [0.07, 0.07, 0.09], sub: [0.43, 0.43, 0.47], track: [0.86, 0.86, 0.89], soft: [0.94, 0.94, 0.96] },
  dark: { card: [0.12, 0.12, 0.14], text: [1, 1, 1], sub: [0.64, 0.64, 0.68], track: [0.26, 0.26, 0.29], soft: [0.18, 0.18, 0.2] }
};
const themeOf = (opts) => THEMES[opts.theme === 'dark' ? 'dark' : 'light'];

function textSpecs(id, opts, comp, H) {
  const s = H.unit(comp), C = byId(id), th = themeOf(opts);
  const title = opts.title === undefined || opts.title === '' ? C.title : String(opts.title);
  const sub = opts.subtitle === undefined ? C.subtitle : String(opts.subtitle);
  const W = comp && comp.width > 0 ? comp.width : 1920, max = Math.round(W * (FIT[id] || 0.4));
  const T = (key, text, size, bold, color, justify, name, fit) => ({ key, name, text, fontSize: Math.round(size * s), bold: !!bold, color, justify: justify || 'left', rtl: false, maxWidth: fit === false ? 0 : max });
  const white = [1, 1, 1];
  const out = [];
  if (id === 'uiButton') out.push(T('title', title, 40, true, H.hexRgb(opts.tagText || '#ffffff'), 'center', 'Label'));
  if (id === 'uiToggle') out.push(T('title', title, 40, true, th.text, 'left', 'Label'));
  if (id === 'uiNotify') { out.push(T('title', title, 34, true, th.text, 'left', 'Title')); if (sub) out.push(T('subtitle', sub, 30, false, th.sub, 'left', 'Message')); }
  if (id === 'uiSearch') out.push(T('title', title, 38, false, th.text, 'left', 'Query'));
  if (id === 'uiProgress') { out.push(T('title', title, 34, true, th.text, 'left', 'Label')); if (sub) out.push(T('subtitle', sub, 34, true, th.sub, 'right', 'Percent', false)); }
  if (id === 'uiChat') out.push(T('title', title, 36, false, white, 'left', 'Message'));
  if (id === 'uiStat') { if (sub) out.push(T('subtitle', sub, 30, false, th.sub, 'left', 'Label')); out.push(T('title', title, 92, true, th.text, 'left', 'Value')); }
  if (id === 'uiTask') out.push(T('title', title, 40, true, th.text, 'left', 'Task'));
  return out.filter((t) => t.text.trim());
}

/** A list of keys {t, v} with linear interpolation (a press, a blink, a bounce) — written as-is to After Effects. */
const lin = (pairs) => pairs.map(([t, v]) => ({ t, v, interp: 'linear' }));
/** The entrance keys of one property followed by more keys of the same property (one list per property). */
const then = (entrance, more) => ({ key: entrance.key, prop: entrance.prop, keys: entrance.keys.concat(more) });
/** A ring as an open path of points (for a magnifier, a status ring). */
const ring = (c, r, n = 20) => Array.from({ length: n + 1 }, (_, i) => [c[0] + r * Math.cos((i / n) * Math.PI * 2), c[1] + r * Math.sin((i / n) * Math.PI * 2)]);

function layout(id, opts, comp, m, H) {
  const s = H.unit(comp), W = comp.width, Ht = comp.height, th = themeOf(opts);
  const accent = H.hexRgb(opts.accent || '#0A84FF');
  const dur = opts.duration > 0 ? opts.duration : 0.7;
  const els = [], keys = [];
  const specs = textSpecs(id, opts, comp, H);
  const spec = (k) => specs.find((x) => x.key === k);
  const text = (k, pos) => { const sp = spec(k); if (sp) els.push(Object.assign({ kind: 'text', name: sp.name, position: pos }, sp, m(k)[2] ? { fontSize: m(k)[2] } : {})); return !!sp; };
  const pop = (d, dd) => H.PLAN.animate({ kind: 'scale', dir: 'in', overshoot: true, duration: dd || dur * 0.8, ease: 'snappy' }, { scale: [100, 100] }).keys.map((k) => Object.assign({}, k, { t: k.t + d }));
  const cx = W / 2, cy = Ht / 2;

  if (id === 'uiButton') {
    const [tw, tht] = m('title');
    const h = tht + 46 * s, w = tw + 104 * s;
    els.push({ key: 'ripple', kind: 'ellipse', name: 'Ripple', position: [cx, cy], size: [w * 0.9, w * 0.9], color: accent });
    els.push({ key: 'button', kind: 'rect', name: 'Button', position: [cx, cy], size: [w, h], roundness: h / 2, color: accent });
    text('title', [cx, cy + tht * 0.35]);
    const c = dur + 0.35; // the click
    const press = lin([[c, [100, 100]], [c + 0.08, [94, 94]], [c + 0.26, [100, 100]]]);
    keys.push(then({ key: 'button', prop: 'scale', keys: pop(0) }, press));
    keys.push(then({ key: 'title', prop: 'scale', keys: pop(0.05) }, press.map((k) => Object.assign({}, k, { t: k.t + 0.01 }))));
    keys.push({ key: 'ripple', prop: 'opacity', keys: lin([[0, 0], [c + 0.06, 0], [c + 0.08, 35], [c + 0.6, 0]]) });
    keys.push({ key: 'ripple', prop: 'scale', keys: lin([[c + 0.06, [40, 40]], [c + 0.6, [160, 160]]]) });
    return { elements: els, keys, box: [cx - w / 2, cy - h / 2, w, h] };
  }
  if (id === 'uiToggle') {
    const [tw, tht] = m('title');
    const tw2 = 104 * s, th2 = 60 * s, knob = 48 * s, pad = 36 * s, gap = 60 * s;
    const w = pad + tw + gap + tw2 + pad, h = Math.max(tht, th2) + 2 * pad;
    const x0 = cx - w / 2, sx = x0 + w - pad - tw2 / 2;
    els.push({ key: 'card', kind: 'rect', name: 'Row', position: [cx, cy], size: [w, h], roundness: 26 * s, color: th.card });
    els.push({ key: 'track', kind: 'rect', name: 'Track', position: [sx, cy], size: [tw2, th2], roundness: th2 / 2, color: th.track });
    els.push({ key: 'trackOn', kind: 'rect', name: 'Track On', position: [sx, cy], size: [tw2, th2], roundness: th2 / 2, color: accent });
    const off = sx - tw2 / 2 + th2 / 2, on = sx + tw2 / 2 - th2 / 2;
    els.push({ key: 'knob', kind: 'ellipse', name: 'Knob', position: [off, cy], size: [knob, knob], color: [1, 1, 1] });
    text('title', [x0 + pad, cy + tht * 0.35]);
    const c = dur + 0.3, sw = 0.32;
    keys.push(H.enter('card', 'scale', [96, 96], [100, 100], 0, dur, 'expo'), H.fadeIn('card', 0, dur * 0.6));
    keys.push(H.fadeIn('title', 0.1, dur * 0.7));
    keys.push({ key: 'knob', prop: 'position', keys: H.enter('knob', 'position', [off, cy], [off, cy], 0, 0.01, 'smooth').keys.concat(H.enter('knob', 'position', [off, cy], [on, cy], c, sw, 'snappy').keys) });
    keys.push({ key: 'trackOn', prop: 'opacity', keys: lin([[0, 0], [c, 0], [c + sw * 0.8, 100]]) });
    keys.push({ key: 'knob', prop: 'scale', keys: lin([[c, [100, 100]], [c + sw * 0.4, [112, 92]], [c + sw, [100, 100]]]) });
    return { elements: els, keys, box: [x0, cy - h / 2, w, h] };
  }
  if (id === 'uiNotify') {
    const [tw, tht] = m('title'), [sw, sh] = m('subtitle');
    const icon = 76 * s, pad = 28 * s, gap = 24 * s;
    const textW = Math.max(tw, sw), w = Math.max(620 * s, pad + icon + gap + textW + pad);
    const lines = tht + (spec('subtitle') ? 10 * s + sh : 0), h = Math.max(icon, lines) + 2 * pad;
    const y = Ht * 0.06 + h / 2, x0 = cx - w / 2;
    els.push({ key: 'card', kind: 'rect', name: 'Card', position: [cx, y], size: [w, h], roundness: 34 * s, color: th.card });
    els.push({ key: 'icon', kind: 'rect', name: 'App Icon', position: [x0 + pad + icon / 2, y], size: [icon, icon], roundness: 18 * s, color: accent });
    const tx = x0 + pad + icon + gap, top = y - lines / 2;
    text('title', [tx, top + tht * 0.8]);
    text('subtitle', [tx, top + tht + 10 * s + sh * 0.8]);
    const drop = (k, p0, d) => H.enter(k, 'position', [p0[0], p0[1] - h - Ht * 0.06], p0, d, dur, 'expo');
    keys.push(drop('card', [cx, y], 0), H.fadeIn('card', 0, dur * 0.5));
    keys.push(drop('icon', [x0 + pad + icon / 2, y], 0.03), drop('title', [tx, top + tht * 0.8], 0.06));
    if (spec('subtitle')) keys.push(drop('subtitle', [tx, top + tht + 10 * s + sh * 0.8], 0.09));
    keys.push({ key: 'icon', prop: 'scale', keys: pop(dur * 0.6, dur * 0.6) });
    return { elements: els, keys, box: [x0, y - h / 2, w, h] };
  }
  if (id === 'uiSearch') {
    const [tw, tht] = m('title');
    const h = tht + 56 * s, mag = 20 * s, pad = 34 * s, gap = 26 * s;
    const w = Math.max(640 * s, pad + 2 * mag + gap + tw + 40 * s + pad), x0 = cx - w / 2;
    els.push({ key: 'field', kind: 'rect', name: 'Field', position: [cx, cy], size: [w, h], roundness: h / 2, color: th.card });
    const mc = [x0 + pad + mag, cy - 3 * s];
    els.push({ key: 'lens', kind: 'path', name: 'Magnifier', position: [0, 0], points: ring(mc, mag * 0.75), stroke: { color: th.sub, width: 4 * s } });
    els.push({ key: 'handle', kind: 'path', name: 'Magnifier Handle', position: [0, 0], points: [[mc[0] + mag * 0.55, mc[1] + mag * 0.55], [mc[0] + mag * 1.05, mc[1] + mag * 1.05]], stroke: { color: th.sub, width: 4 * s } });
    const tx = mc[0] + mag + gap;
    text('title', [tx, cy + tht * 0.35]);
    const caretX = tx + tw + 8 * s;
    els.push({ key: 'caret', kind: 'rect', name: 'Caret', position: [caretX, cy], size: [4 * s, tht * 1.1], roundness: 2 * s, color: accent });
    keys.push(H.enter('field', 'scale', [70, 100], [100, 100], 0, dur, 'expo'), H.fadeIn('field', 0, dur * 0.5));
    keys.push(H.enter('lens', 'trimEnd', 0, 100, 0.15, dur * 0.7, 'smooth'), H.enter('handle', 'trimEnd', 0, 100, 0.35, dur * 0.4, 'smooth'));
    keys.push(H.enter('title', 'position', [tx - 30 * s, cy + tht * 0.35], [tx, cy + tht * 0.35], 0.3, dur), H.fadeIn('title', 0.3, dur * 0.7));
    // the caret slides with the text, then blinks twice a second (hold-like: 0.02 s edges)
    const b0 = 0.3 + dur, blink = [[0, 0], [0.3, 0], [0.32, 100]];
    for (let i = 0; i < 6; i++) { const t = b0 + i * 0.5; blink.push([t + 0.25, 100], [t + 0.27, 0], [t + 0.5, 0], [t + 0.52, 100]); }
    keys.push({ key: 'caret', prop: 'opacity', keys: lin(blink) });
    keys.push(H.enter('caret', 'position', [caretX - 30 * s, cy], [caretX, cy], 0.3, dur));
    return { elements: els, keys, box: [x0, cy - h / 2, w, h] };
  }
  if (id === 'uiProgress') {
    const [tw, tht] = m('title'), [pw, ph] = m('subtitle');
    const w = Math.max(720 * s, tw + pw + 80 * s), bar = 18 * s, pad = 34 * s, gap = 22 * s;
    const h = pad + tht + gap + bar + pad, x0 = cx - w / 2, top = cy - h / 2;
    els.push({ key: 'card', kind: 'rect', name: 'Card', position: [cx, cy], size: [w + 2 * pad, h], roundness: 26 * s, color: th.card });
    const ty = top + pad + tht * 0.8, by = top + pad + tht + gap + bar / 2;
    text('title', [x0, ty]);
    text('subtitle', [x0 + w, ty]);
    els.push({ key: 'track', kind: 'rect', name: 'Track', position: [cx, by], size: [w, bar], roundness: bar / 2, color: th.track });
    els.push({ key: 'fill', kind: 'path', name: 'Fill', position: [0, 0], points: [[x0 + bar / 2, by], [x0 + w - bar / 2, by]], stroke: { color: accent, width: bar } });
    const fillDur = Math.max(1.2, dur * 2.6);
    keys.push(H.enter('card', 'scale', [96, 96], [100, 100], 0, dur, 'expo'), H.fadeIn('card', 0, dur * 0.6));
    keys.push(H.fadeIn('title', 0.1, dur * 0.6));
    keys.push(H.enter('fill', 'trimEnd', 0, 100, 0.3, fillDur, 'smooth'));
    if (spec('subtitle')) keys.push({ key: 'subtitle', prop: 'scale', keys: pop(0.3 + fillDur, dur * 0.6) });
    return { elements: els, keys, box: [x0 - pad, top, w + 2 * pad, h] };
  }
  if (id === 'uiChat') {
    const [tw, tht] = m('title');
    const padX = 34 * s, padY = 24 * s, bw = tw + 2 * padX, bh = tht + 2 * padY;
    const right = W * 0.7, bx = right - bw / 2, by = cy;
    // typing indicator first (grey bubble, three bouncing dots), then the message replaces it
    const iw = 150 * s, ih = 72 * s, ix = right - iw / 2;
    els.push({ key: 'typing', kind: 'rect', name: 'Typing Bubble', position: [ix, by], size: [iw, ih], roundness: ih / 2, color: th.soft });
    const dot = 16 * s;
    [-1, 0, 1].forEach((d, i) => els.push({ key: `dot${i}`, kind: 'ellipse', name: `Typing Dot ${i + 1}`, position: [ix + d * 30 * s, by], size: [dot, dot], color: th.sub }));
    els.push({ key: 'bubble', kind: 'rect', name: 'Bubble', position: [bx, by], size: [bw, bh], roundness: Math.min(36 * s, bh / 2), color: accent });
    text('title', [bx - bw / 2 + padX, by + tht * 0.35]);
    const typing = 1.3, gone = 0.2 + typing;
    keys.push({ key: 'typing', prop: 'scale', keys: pop(0, dur * 0.6).concat(lin([[gone, [100, 100]], [gone + 0.15, [60, 60]]])) });
    keys.push({ key: 'typing', prop: 'opacity', keys: lin([[0, 100], [gone, 100], [gone + 0.15, 0]]) });
    [0, 1, 2].forEach((i) => {
      const y0 = by, up = by - 10 * s, b = [[0, y0]];
      for (let t = 0.3 + i * 0.12; t < gone - 0.2; t += 0.5) b.push([t, y0], [t + 0.15, up], [t + 0.3, y0]);
      keys.push({ key: `dot${i}`, prop: 'position', keys: lin(b.map(([t, y]) => [t, [ix + (i - 1) * 30 * s, y]])) });
      keys.push({ key: `dot${i}`, prop: 'opacity', keys: lin([[0, 100], [gone, 100], [gone + 0.1, 0]]) });
    });
    const appear = gone + 0.05;
    keys.push({ key: 'bubble', prop: 'scale', keys: lin([[0, [0, 0]], [appear, [0, 0]]]).concat(pop(appear + 0.001, dur * 0.7).slice(0)) });
    keys.push({ key: 'title', prop: 'opacity', keys: lin([[0, 0], [appear + 0.1, 0], [appear + 0.3, 100]]) });
    return { elements: els, keys, box: [right - Math.max(bw, iw), by - Math.max(bh, ih) / 2, Math.max(bw, iw), Math.max(bh, ih)] };
  }
  if (id === 'uiStat') {
    const [vw, vh] = m('title'), [lw, lh] = m('subtitle');
    const pad = 40 * s, gap = 14 * s, chartH = 110 * s;
    const w = Math.max(520 * s, Math.max(vw, lw) + 2 * pad), h = pad + (spec('subtitle') ? lh + gap : 0) + vh + 28 * s + chartH + pad;
    const x0 = cx - w / 2, top = cy - h / 2;
    els.push({ key: 'card', kind: 'rect', name: 'Card', position: [cx, cy], size: [w, h], roundness: 30 * s, color: th.card });
    const ly = top + pad + lh * 0.8, vy = top + pad + (spec('subtitle') ? lh + gap : 0) + vh * 0.8;
    text('subtitle', [x0 + pad, ly]);
    text('title', [x0 + pad, vy]);
    const cy0 = vy + 28 * s + chartH, cw = w - 2 * pad;
    const pts = [0, 0.32, 0.22, 0.55, 0.45, 0.78, 1].map((v, i, a) => [x0 + pad + (cw * i) / (a.length - 1), cy0 - v * chartH]);
    els.push({ key: 'chart', kind: 'path', name: 'Trend Line', position: [0, 0], points: pts, stroke: { color: accent, width: 7 * s } });
    const end = pts[pts.length - 1];
    els.push({ key: 'peak', kind: 'ellipse', name: 'Peak Dot', position: end, size: [22 * s, 22 * s], color: accent });
    keys.push(H.enter('card', 'position', [cx, cy + 50 * s], [cx, cy], 0, dur, 'expo'), H.fadeIn('card', 0, dur * 0.6));
    if (spec('subtitle')) keys.push(H.fadeIn('subtitle', 0.15, dur * 0.6));
    keys.push(H.enter('title', 'position', [x0 + pad, vy + 30 * s], [x0 + pad, vy], 0.2, dur), H.fadeIn('title', 0.2, dur * 0.6));
    keys.push(H.enter('chart', 'trimEnd', 0, 100, 0.4, Math.max(1, dur * 1.8), 'smooth'));
    keys.push({ key: 'peak', prop: 'scale', keys: lin([[0, [0, 0]], [0.4 + Math.max(1, dur * 1.8), [0, 0]]]).concat(pop(0.4 + Math.max(1, dur * 1.8) + 0.001, dur * 0.6)) });
    return { elements: els, keys, box: [x0, top, w, h] };
  }
  if (id === 'uiTask') {
    const [tw, tht] = m('title');
    const box = 52 * s, pad = 34 * s, gap = 28 * s;
    const w = pad + box + gap + tw + pad, h = Math.max(box, tht) + 2 * pad, x0 = cx - w / 2;
    els.push({ key: 'card', kind: 'rect', name: 'Row', position: [cx, cy], size: [w, h], roundness: 24 * s, color: th.card });
    const bx = x0 + pad + box / 2;
    els.push({ key: 'box', kind: 'rect', name: 'Checkbox', position: [bx, cy], size: [box, box], roundness: 14 * s, color: th.track });
    els.push({ key: 'boxOn', kind: 'rect', name: 'Checkbox On', position: [bx, cy], size: [box, box], roundness: 14 * s, color: accent });
    els.push({ key: 'check', kind: 'path', name: 'Check', position: [0, 0], points: [[bx - box * 0.24, cy + box * 0.02], [bx - box * 0.06, cy + box * 0.2], [bx + box * 0.26, cy - box * 0.18]], stroke: { color: [1, 1, 1], width: 6 * s } });
    const tx = bx + box / 2 + gap;
    text('title', [tx, cy + tht * 0.35]);
    els.push({ key: 'strike', kind: 'path', name: 'Strike', position: [0, 0], points: [[tx, cy], [tx + tw, cy]], stroke: { color: th.sub, width: 4 * s } });
    const c = dur + 0.3;
    keys.push(H.enter('card', 'scale', [96, 96], [100, 100], 0, dur, 'expo'), H.fadeIn('card', 0, dur * 0.6));
    keys.push({ key: 'boxOn', prop: 'scale', keys: lin([[0, [0, 0]], [c, [0, 0]]]).concat(pop(c + 0.001, 0.35)) });
    keys.push(H.enter('check', 'trimEnd', 0, 100, c + 0.15, 0.3, 'smooth'));
    keys.push(H.enter('strike', 'trimEnd', 0, 100, c + 0.35, 0.4, 'smooth'));
    // the task text fades in, then dims to 55 % once it is crossed out
    keys.push({ key: 'title', prop: 'opacity', keys: H.fadeIn('title', 0.1, dur * 0.7).keys.concat(lin([[c + 0.35, 100], [c + 0.75, 55]])) });
    return { elements: els, keys, box: [x0, cy - h / 2, w, h] };
  }
  throw new Error(`Unknown component ${id}`);
}
/** One key list per (part, property): the last one written for a pair wins (the combined list). */
function dedupe(keys) {
  const seen = new Map();
  keys.forEach((k) => seen.set(`${k.key}|${k.prop}`, k));
  return [...seen.values()];
}

module.exports = { COMPONENTS, FIT, THEMES, byId, textSpecs, layout: (id, o, c, m, H) => { const p = layout(id, o, c, m, H); p.keys = dedupe(p.keys); return p; } };
