'use strict';
/**
 * Scene Check (v0.80, docs/features/SCENE_CHECK.md; owner picked ideas 5 · 18 · 19 · 20) — the pure part.
 * Everything here works on ONE read of the comp (scene.read: layers, Transform keys, markers) and, for what needs
 * pixels, one measurement (scene.measure: boxes, shape colours). No host call, no guess presented as a fact:
 * a finding says what was read and where; a heuristic is marked `hint`.
 *
 *   summarise(desc, snaps, markers)        → scan
 *   suggest(scan)                          → kits that fit, with the reasons (idea 5)
 *   timeline(scan)                         → rows of bars: layer life + keyed spans + MOE marks (idea 18)
 *   check(scan, { boxes, colours, brand }) → findings (idea 19)
 *   scenes(scan) / board(scan, measured) / boardHtml(board) → a storyboard page (idea 20)
 */
const FG = require('../../core/framegrid');

const LIMITS = { layers: 80, scenes: 12, colourLayers: 40 };
const isMoeName = (n) => /^MOE /.test(n || '');
const visible = (L) => L.enabled && L.hasVideo && !L.guide;

function summarise(desc, snaps, markers) {
  const byLayer = {};
  ((snaps && snaps.items) || []).forEach((it) => {
    const id = it.address.layerId;
    (byLayer[id] = byLayer[id] || []).push({ name: it.name, matchName: it.matchName, keys: (it.snapshot || []).map((k) => k.t), moe: /\/\/ MOE/.test(it.expression || ''), expr: !!it.expression });
  });
  const layers = desc.layers.map((L) => ({
    id: L.id, index: L.index, name: L.name, type: L.type, text: L.text || '', enabled: L.enabled, guide: !!L.guide, locked: !!L.locked,
    hasVideo: L.hasVideo !== false, hasAudio: !!L.hasAudio, threeD: !!L.threeD, parentId: L.parentId, inPoint: L.inPoint, outPoint: L.outPoint,
    moe: isMoeName(L.name), props: byLayer[L.id] || []
  }));
  const mk = markers || { comp: [], layers: [] };
  return { comp: { id: desc.compId, name: desc.name, width: desc.width, height: desc.height, duration: desc.duration, time: desc.time, fd: desc.frameDuration },
    layers, markers: { comp: mk.comp || [], layers: mk.layers || [] }, truncated: desc.layers.length > LIMITS.layers };
}

/** Kits that fit this comp, best first; every point of the score has its reason in words. */
function suggest(scan) {
  const L = scan.layers, c = scan.comp, score = {}, why = {};
  const add = (kit, n, reason) => { score[kit] = (score[kit] || 0) + n; (why[kit] = why[kit] || []).push(reason); };
  const texts = L.filter((x) => x.type === 'text' && visible(x)), shapes = L.filter((x) => x.type === 'shape' && visible(x));
  const audio = L.filter((x) => x.hasAudio);
  const named = (re) => L.filter((x) => re.test(x.name));
  const still = L.filter((x) => visible(x) && !x.props.length);
  if (c.height > c.width) add('social', 3, `a vertical comp (${c.width} × ${c.height})`);
  if (audio.length) { add('beat', 3, `${audio.length} layer${audio.length === 1 ? '' : 's'} with sound`); add('social', 1, 'it has sound'); }
  if (texts.length >= 2) add('kinetic', texts.length >= 4 ? 3 : 2, `${texts.length} text layers`);
  const ui = named(/^MOE (Template|Cursor|Spotlight)/).length;
  if (ui) add('saas', 3, `${ui} MOE interface part${ui === 1 ? '' : 's'} (templates, cursor)`);
  else if (shapes.length >= 4 && texts.length >= 2 && c.width >= c.height) add('saas', 1, `${shapes.length} shapes with ${texts.length} texts — it reads like an interface`);
  const glass = named(/^MOE Glass/).length; if (glass) add('glass', 3, `${glass} MOE Glass layer${glass === 1 ? '' : 's'}`);
  const grid = named(/^MOE (Grid|Clone|Effector|Word|Letter)/).length;
  if (grid) { add('effectors', 3, `${grid} cloner / effector layer${grid === 1 ? '' : 's'}`); add('mograph', 1, 'a cloner is in the comp'); }
  const vis = L.filter(visible).length;
  if (vis >= 2 && still.length >= Math.ceil(vis / 2)) add('loops', 2, `${still.length} of ${vis} visible layers do not move`);
  return Object.keys(score).map((kit) => ({ kit, score: score[kit], why: why[kit] })).sort((a, b) => b.score - a.score || a.kit.localeCompare(b.kit));
}

/** Keyed spans of a layer: one per property that has keys. */
const spansOf = (layer) => layer.props.filter((p) => p.keys.length).map((p) => ({ name: p.name, t0: p.keys[0], t1: p.keys[p.keys.length - 1], n: p.keys.length, moe: p.moe }));

function timeline(scan) {
  const d = Math.max(scan.comp.duration, scan.comp.fd);
  const rows = scan.layers.slice(0, LIMITS.layers).filter((L) => L.hasVideo || L.hasAudio).map((L) => ({
    id: L.id, name: L.name, type: L.type, moe: L.moe, dim: !L.enabled || L.guide,
    life: [Math.max(0, L.inPoint) / d, Math.min(d, L.outPoint) / d],
    spans: spansOf(L).map((s) => ({ name: s.name, a: Math.max(0, s.t0) / d, b: Math.min(d, s.t1) / d, n: s.n })),
    expr: L.props.filter((p) => p.expr).length, marks: ((scan.markers.layers.find((m) => m.layerId === L.id) || {}).markers || []).map((m) => m.t / d)
  }));
  return { duration: d, now: scan.comp.time / d, compMarks: scan.markers.comp.map((m) => ({ at: m.t / d, comment: m.comment })), rows };
}

const hexToRgb = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); return m ? [0, 2, 4].map((i) => parseInt(m[1].substr(i, 2), 16) / 255) : null; };
const dist = (a, b) => Math.sqrt(a.slice(0, 3).reduce((s, v, i) => s + (v - b[i]) * (v - b[i]), 0));
const toHex = (c) => `#${c.slice(0, 3).map((v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/**
 * Findings, worst first. level: 'fix' (it is wrong on screen), 'look' (worth a look), 'hint' (a heuristic), 'info'.
 * opts: { boxes: { layerId: [l, t, r, b] } at comp.time, colours: [{ layerId, name, rgb }], brand: { name, colors: [{ hex }] } }
 */
function check(scan, opts) {
  const o = opts || {}, c = scan.comp, fd = c.fd, out = [];
  const add = (level, L, title, detail) => out.push({ level, layerId: L ? L.id : null, layer: L ? L.name : '', title, detail });
  scan.layers.forEach((L) => {
    if (!visible(L) && !L.hasAudio) return;
    const spans = spansOf(L);
    spans.forEach((s) => {
      const frames = Math.round((s.t1 - s.t0) / fd);
      if (s.n >= 2 && frames > 0 && frames < 4) add('look', L, `${s.name}: a move of ${frames} frame${frames === 1 ? '' : 's'}`, `Keys at ${s.t0.toFixed(2)} s and ${s.t1.toFixed(2)} s — too short to read as a move (under 4 frames)`);
    });
    const off = L.props.reduce((n, p) => n + p.keys.filter((t) => !FG.onGrid(t, fd)).length, 0);
    if (off) add('look', L, `${off} key${off === 1 ? '' : 's'} between frames`, 'They sit off the frame grid — the value on the frame is not the key\'s value');
    if (L.type === 'text' && !String(L.text).trim()) add('fix', L, 'Empty text layer', 'It has no characters');
    // heuristic: it animates in at its start, has nothing near its end, and ends before the comp does → it leaves with a cut
    if (spans.length && L.outPoint < c.duration - fd) {
      const life = L.outPoint - L.inPoint, lastKey = Math.max.apply(null, spans.map((s) => s.t1)), firstKey = Math.min.apply(null, spans.map((s) => s.t0));
      if (life > 12 * fd && firstKey - L.inPoint < life * 0.3 && L.outPoint - lastKey > life * 0.4) add('hint', L, 'Comes in, leaves with a cut', `Its keys end at ${lastKey.toFixed(2)} s; the layer ends at ${L.outPoint.toFixed(2)} s, before the comp does`);
    }
  });
  // measured: text against title safe (10 % in from each edge — the classic title-safe area)
  if (o.boxes) {
    const m = [c.width * 0.1, c.height * 0.1, c.width * 0.9, c.height * 0.9];
    scan.layers.filter((L) => L.type === 'text' && visible(L) && o.boxes[L.id]).forEach((L) => {
      const b = o.boxes[L.id];
      if (b[2] < 0 || b[3] < 0 || b[0] > c.width || b[1] > c.height) return; // off screen now (not in frame at this time)
      const over = [m[0] - b[0], m[1] - b[1], b[2] - m[2], b[3] - m[3]].map((v) => Math.max(0, Math.round(v)));
      const side = ['left', 'top', 'right', 'bottom'].filter((_, i) => over[i] > 0);
      if (side.length) add(b[0] < 0 || b[1] < 0 || b[2] > c.width || b[3] > c.height ? 'fix' : 'look', L, `Text outside title safe (${side.join(', ')})`, `By ${Math.max.apply(null, over)} px at ${c.time.toFixed(2)} s — title safe is 10 % in from each edge`);
    });
  }
  // measured: shape colours against the active client's palette
  if (o.colours && o.brand && (o.brand.colors || []).length) {
    const pal = o.brand.colors.map((x) => hexToRgb(x.hex)).filter(Boolean);
    const seen = {};
    o.colours.forEach((x) => {
      if (!pal.length || pal.some((p) => dist(p, x.rgb) < 0.06)) return;
      const key = `${x.layerId}|${toHex(x.rgb)}`; if (seen[key]) return; seen[key] = true;
      add('look', { id: x.layerId, name: x.name }, `Colour ${toHex(x.rgb)} is not in ${o.brand.name}`, 'A shape fill or stroke that is none of the client\'s colours');
    });
  }
  const hidden = scan.layers.filter((L) => !L.enabled && L.hasVideo).length;
  if (hidden) add('info', null, `${hidden} hidden layer${hidden === 1 ? '' : 's'}`, 'Switched off — they do not render');
  if (scan.truncated) add('info', null, `Only the first ${LIMITS.layers} layers were read`, 'A very large comp: the rest was not checked');
  const rank = { fix: 0, look: 1, hint: 2, info: 3 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

/** Where the scenes start: comp markers, else the layers' markers, else four evenly spaced moments (said so). */
function scenes(scan) {
  const d = scan.comp.duration, fd = scan.comp.fd;
  const uniq = (list) => { const out = []; list.slice().sort((a, b) => a.t - b.t).forEach((m) => { if (m.t >= 0 && m.t < d && (!out.length || m.t - out[out.length - 1].t > fd * 0.5)) out.push(m); }); return out; };
  let from = 'comp markers', list = uniq(scan.markers.comp.map((m) => ({ t: m.t, label: m.comment })));
  if (!list.length) { from = 'layer markers'; list = uniq([].concat.apply([], scan.markers.layers.map((x) => x.markers.map((m) => ({ t: m.t, label: m.comment }))))); }
  if (!list.length) { from = 'even spacing (no markers in this comp)'; list = [0.1, 0.35, 0.6, 0.85].map((f) => ({ t: FG.snap(d * f, fd), label: '' })); }
  const cut = list.length > LIMITS.scenes;
  return { from, cut, list: list.slice(0, LIMITS.scenes).map((m, i) => ({ n: i + 1, t: m.t, label: m.label || `Scene ${i + 1}` })) };
}

/** The storyboard: per scene, what is on screen (visible, alive at that time) with its measured box. */
function board(scan, sc, boxesAt) {
  return { comp: scan.comp, from: sc.from, scenes: sc.list.map((s, i) => ({
    n: s.n, t: s.t, label: s.label,
    layers: scan.layers.filter((L) => visible(L) && L.inPoint <= s.t + 1e-6 && L.outPoint > s.t).map((L) => ({ name: L.name, type: L.type, text: L.text, box: ((boxesAt[i] || {})[L.id]) || null })).filter((L) => L.box)
  })) };
}

const esc = (v) => String(v).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[ch]));
/** A stand-alone page: a schematic frame per scene (boxes where the layers are, their text), never a render. */
function boardHtml(b) {
  const W = 320, H = Math.round(W * b.comp.height / b.comp.width), k = W / b.comp.width;
  const col = { text: '#FF7A59', shape: '#5B8CFF', solid: '#6B7280', precomp: '#22D3B6', footage: '#A78BFA' };
  const frame = (s) => `<figure><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(s.label)}"><rect width="${W}" height="${H}" fill="#14161B"/>${s.layers.map((L) => {
    const x = Math.round(L.box[0] * k), y = Math.round(L.box[1] * k), w = Math.max(2, Math.round((L.box[2] - L.box[0]) * k)), h = Math.max(2, Math.round((L.box[3] - L.box[1]) * k)), c = col[L.type] || '#9CA3AF';
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" fill-opacity="${L.type === 'text' ? 0.18 : 0.3}" stroke="${c}"/>${L.type === 'text' && L.text ? `<text x="${x + 3}" y="${y + Math.min(h - 3, 12)}" font-size="9" fill="#F3F4F6" font-family="sans-serif">${esc(L.text.slice(0, Math.max(4, Math.floor(w / 5))))}</text>` : ''}`;
  }).join('')}</svg><figcaption><b>${s.n} · ${esc(s.label)}</b><span>${s.t.toFixed(2)} s · ${s.layers.length} layer${s.layers.length === 1 ? '' : 's'}</span>${s.layers.filter((L) => L.type === 'text' && L.text).slice(0, 3).map((L) => `<i>“${esc(L.text)}”</i>`).join('')}</figcaption></figure>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(b.comp.name)} — storyboard</title><style>body{margin:24px;background:#0B0C0F;color:#E5E7EB;font:13px/1.4 system-ui,sans-serif}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 18px;color:#9CA3AF}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(${W}px,1fr));gap:18px}figure{margin:0}svg{display:block;max-width:100%;height:auto;border:1px solid #2A2D35;border-radius:6px}figcaption{display:flex;flex-direction:column;gap:2px;margin-top:6px}figcaption span{color:#9CA3AF;font-size:12px}figcaption i{color:#D1D5DB;font-size:12px}@media print{body{background:#fff;color:#111}p,figcaption span{color:#555}figcaption i{color:#333}}</style></head><body><h1>${esc(b.comp.name)}</h1><p>${b.comp.width} × ${b.comp.height} · ${b.comp.duration.toFixed(2)} s · scenes from ${esc(b.from)} · a schematic of where the layers are — not a render</p><main>${b.scenes.map(frame).join('')}</main></body></html>`;
}

module.exports = { LIMITS, summarise, suggest, timeline, spansOf, check, scenes, board, boardHtml, hexToRgb, toHex };
