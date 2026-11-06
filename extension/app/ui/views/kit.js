'use strict';
/**
 * Motion Kit (v0.10) — the everyday animation tools in one compact screen, after the study in
 * docs/features/MOTION_KIT.md (Motion 4 Home + Toolbox, Flow's graph):
 *   Ease    a small value graph that shows the selected keys' curve by itself; drag anywhere (Motion 4 zones)
 *           and the curve lands on the keys when you let go (Auto); preset chips apply on click
 *           (Shift = ease in only, Ctrl = ease out only); Easy Ease · Linear · Hold · Copy · Paste.
 *   Anchor  3 × 3 dots — click = anchor there, nothing moves; Alt-click = also place the layer
 *           at that point of the comp.
 *   Align   one row; to the selection or the comp; the whole animation moves.
 *   Tools   one click with saved defaults; right-click = options; Alt = the variant.
 * No tiles, no Apply bar, no banner: every control acts on the selection.
 */
const { h, icon } = require('../dom');
const W = require('../widgets');
const KG = require('./kitGraph');
const BZ = require('../../../features/curves/bezier');
const TM = require('../../../features/transform/math');
const BAR = require('../../../features/quick/bar');
const quickbar = require('../quickbar');
const library = require('../studio/library');

const NUMERIC = /^(OneD|TwoD|ThreeD|TwoD_SPATIAL|ThreeD_SPATIAL)$/;
// v0.65: the Motion Bar's one-click curves — the everyday shapes, ease-out first (what most entrances want)
const BAR_CHIPS = ['easyEase', 'outExpo', 'outCubic', 'inOutCubic', 'outBack', 'settle'];
/** v0.65: unfold the ease editor in the current scope (the Motion Bar's Graph button). */
// sc = the Motion Control's scope captured when the bar was drawn (K.scope is restored before a click arrives)
function openEase(app, sc) {
  // v0.65: in MOE the full graph is the Timing tab — go there; Bento / Glass open it in place (remembered)
  if ((app.services.settings.get().ui || {}).layout === 'moe' && sc && /^__bar-/.test(sc.ctx || '')) { app.state.set({ aeQ: '' }); app.go('ae-keys'); return; }
  const pr = prefs(app);
  if (sc) setPref(app, { ctxOpen: Object.assign({}, pr.ctxOpen || {}, { [sc.ctx]: Object.assign({}, (pr.ctxOpen || {})[sc.ctx] || {}, { ease: true }) }) });
  else setPref(app, { fold: Object.assign({}, pr.fold || {}, { ease: false }) });
}
const CHIPS = ['easyEase', 'outCubic', 'outExpo', 'outBack', 'inOutCubic', 'inOutExpo', 'inOutBack', 'inCubic', 'inExpo', 'snap', 'punch', 'glide', 'settle', 'swoosh', 'linear'];
const ALIGN_ROWS = [
  { axis: '↔', align: [['left', 'alignLeft', 'Align left edges'], ['hcenter', 'alignCenter', 'Align centres ↔'], ['right', 'alignRight', 'Align right edges']], spread: [['distH', 'distribute', 'Distribute centres ↔ (3+ layers)'], ['spaceH', 'spaceH', 'Space evenly ↔ — equal gaps between edges']] },
  { axis: '↕', align: [['top', 'alignTop', 'Align top edges'], ['vcenter', 'alignMiddle', 'Align middles ↕'], ['bottom', 'alignBottom', 'Align bottom edges']], spread: [['distV', 'distributeV', 'Distribute centres ↕ (3+ layers)'], ['spaceV', 'spaceV', 'Space evenly ↕ — equal gaps between edges']] }
];
const ORDER = ['tl', 't', 'tr', 'l', 'c', 'r', 'bl', 'b', 'br'];
const DEFAULT_CURVE = BZ.normalize(BZ.PRESETS.find((p) => p.id === 'easyEase'));

/* Transient kit state (one panel = one kit). The graph keeps its curve between renders. */
const K = { curve: Object.assign({}, DEFAULT_CURVE), ghost: null, sig: null, src: null, reading: false, lib: false, libTag: 'All', graph: null, seg: 0, keysSig: null };
/** The segment being edited (0 = all) and its data. */
const curSeg = () => (K.segs && K.segs.length ? K.segs[Math.max(0, (K.seg || 1) - 1)] || K.segs[0] : null);

/** Tools pinned to Home (Motion 4 "Pin Tools"); edited in the Toolbox. */
const DEFAULT_PINS = ['parentNull', 'k_parent', 'k_excite', 'k_delay', 'k_jump', 'k_repeat', 'k_stare', 'k_trash'];
const prefs = (app) => Object.assign({ auto: true, side: 'both', to: 'selection', masks: false, link: false, clip: null, pins: DEFAULT_PINS, graph: 'both', graphH: 150, through: false, gap: null }, app.services.settings.get().ui.kit || {});
const setPref = (app, patch) => { app.services.settings.update({ ui: { kit: Object.assign(prefs(app), patch) } }); app.render(); };
/* v0.14: every block folds from its title (remembered per panel) — keep only what you use open. */
// v0.15 Smart Home: while Home renders, K.scope = { ctx, focus } — a block is open by default when it
// is the focus for this kind of selection, and what you open / fold is remembered per kind (ctxOpen).
/** Pure rule: is block `id` folded, given the kit prefs and the Home scope (null = Fixed layout)? */
function isFolded(pr, sc, id) {
  if (!sc) return !!(pr.fold || {})[id];
  const o = ((pr.ctxOpen || {})[sc.ctx] || {})[id];
  const inFocus = sc.focus.includes(id) || ((id === 'anchor' || id === 'align') && sc.focus.includes('anchorAlign'));
  return o === undefined ? !inFocus : !o;
}
const folded = (app, id) => isFolded(prefs(app), K.scope, id);
function foldTitle(app, id, label) {
  const f = folded(app, id), sc = K.scope;
  const toggle = () => {
    const pr = prefs(app);
    if (sc) setPref(app, { ctxOpen: Object.assign({}, pr.ctxOpen || {}, { [sc.ctx]: Object.assign({}, (pr.ctxOpen || {})[sc.ctx] || {}, { [id]: f }) }) });
    else setPref(app, { fold: Object.assign({}, pr.fold || {}, { [id]: !f }) });
  };
  return h('button', { class: `kit-t kit-fold ${f ? 'folded' : ''}`, 'aria-expanded': String(!f), 'data-key': `fold-${id}`, title: f ? `Show ${label}` : `Fold ${label} (remembered${sc ? ' for this kind of selection' : ''})`, onclick: toggle }, icon('chev', 'xs'), h('span', {}, label));
}
const r3 = (v) => Math.round(v * 1000) / 1000;
const ctxOf = (app) => app.state.get().ctx;

/** First property with 2+ selected numeric keys (what the graph reads and the curve applies to). */
function keyed(ctx) { return ((ctx && ctx.properties) || []).filter((p) => (p.selectedKeys || []).length >= 2 && NUMERIC.test(p.valueType)); }
function selectedKeyCount(ctx) { return ((ctx && ctx.properties) || []).reduce((n, p) => n + (p.selectedKeys || []).length, 0); }

/** Nearest preset (within 0.02 on every handle) — lit in the chip row, like Flow's Read. */
function matchPreset(cv, user) {
  const all = BZ.PRESETS.concat(user || []);
  const n = (p) => BZ.normalize(p);
  return (all.find((p) => ['x1', 'y1', 'x2', 'y2'].every((k) => Math.abs(n(p)[k] - cv[k]) <= 0.02)) || {}).id || null;
}
const userCurves = (app) => app.services.store.get('kit-curves', []);

/** Read the curve of the selected keys whenever the key selection changes (no button needed). */
/** Unit of a property's speed, as AE's Graph Editor shows it. */
function unitOf(p) {
  const mn = (p.address.matchNames || []).slice(-1)[0] || '';
  if (/^ADBE Position/.test(mn) || /^ADBE Anchor Point/.test(mn)) return 'px';
  if (/^ADBE Rotate|^ADBE Orientation/.test(mn)) return '°';
  if (/^ADBE Scale$|^ADBE Opacity$/.test(mn)) return '%';
  return '';
}
/** Segments between the selected keys: time, value change, average speed, the curve that is on them. */
function segmentsOf(keys, spatial) {
  const out = [];
  for (let i = 0; i + 1 < keys.length; i++) {
    const ka = keys[i], kb = keys[i + 1];
    const va = [].concat(ka.value), vb = [].concat(kb.value);
    const dt = kb.time - ka.time, dv = vb.map((v, d) => v - va[d]);
    const di = Math.max(0, dv.findIndex((d) => Math.abs(d) > 1e-9));
    const avg = dt > 0 ? (spatial ? Math.hypot(...dv) : Math.abs(dv[di])) / dt : 0;
    const hold = ka.outInterp === 'HOLD', linear = ka.outInterp === 'LINEAR' && kb.inInterp === 'LINEAR';
    const got = BZ.fromTemporal(ka.easeOut, kb.easeIn, { dt, dv, spatial });
    const curve = linear ? BZ.normalize({ x1: 0.333, y1: 0.333, x2: 0.667, y2: 0.667 }) : { x1: r3(got.x1), y1: r3(got.y1), x2: r3(got.x2), y2: r3(got.y2) };
    out.push({ a: ka.index, b: kb.index, t0: ka.time, t1: kb.time, dt, dv, avg, hold, linear, curve });
  }
  return out;
}

/** Read the curve of the selected keys whenever the key selection changes (no button needed). */
function autoRead(app, force) {
  const ctx = ctxOf(app);
  const p = keyed(ctx)[0];
  const sig = p ? JSON.stringify([p.address.layerId, p.address.matchNames, p.selectedKeys]) : '';
  if (!force && sig === K.sig) return;
  K.sig = sig;
  if (!p) { K.src = null; K.segs = null; K.unit = null; K.seg = 0; K.keysSig = null; return; }
  const keys = [...new Set(p.selectedKeys)].sort((a, b) => a - b).slice(0, 12);
  if (sig !== K.keysSig) { K.seg = 0; K.keysSig = sig; } // other keys selected → back to "All"
  const layer = ((ctx.layers || []).find((l) => l.id === p.address.layerId) || {}).name || 'Layer';
  setTimeout(async () => {
    if (K.reading || app.services.executor.running) { K.sig = null; return; }
    K.reading = true;
    try {
      const r = await app.services.host.call('keyframes.read', { compId: ctx.comp.id, targets: [{ address: p.address, keys }] });
      const segs = segmentsOf(r.targets[0].keys, /_SPATIAL$/.test(p.valueType));
      if (K.seg > segs.length) K.seg = 0;
      const s0 = segs[Math.max(0, K.seg - 1)];
      K.segs = segs; K.unit = unitOf(p); K.nKeys = keys.length;
      K.ghost = null;
      K.srcBase = `${layer} › ${p.name}`;
      if (s0.hold) K.src = `${layer} › ${p.name}: hold`;
      else { K.curve = Object.assign({}, s0.curve); K.ghost = Object.assign({}, K.curve); K.src = `${layer} › ${p.name}${s0.linear ? ': linear' : K.seg ? ` · segment ${K.seg} (keys ${s0.a}–${s0.b})` : ` · keys ${keys[0]}–${keys[keys.length - 1]}`}`; }
    } catch (e) { K.src = null; K.segs = null; } finally { K.reading = false; app.scheduleRender(); }
  }, 0);
}

/* ---------- running (same readiness + messages as the pie and the ▶ buttons) ---------- */
function run(app, toolId, args, label) {
  return library.applyNow(app, { id: `kit-${toolId}`, label, tool: toolId, args }, null);
}
function applyCurve(app, cv, side, label) {
  K.curve = Object.assign({}, cv);
  if (!keyed(ctxOf(app)).length) { app.toast('Curve set — select two or more keyframes to apply it', 3200, 'info'); app.render(); return null; }
  // After applying, read the keys again (the line above the graph then names what is on them).
  const segment = K.segs && K.segs.length > 1 ? K.seg || 0 : 0;
  return Promise.resolve(run(app, 'motion.easeCurve', Object.assign({}, BZ.normalize(cv), { side, through: !!prefs(app).through && !segment, segment }), `${label || 'Ease Curve'}${segment ? ` · segment ${segment}` : ''}`)).then((r) => { K.sig = null; app.scheduleRender(); return r; });
}
const sideOf = (e, p) => (e && e.shiftKey ? 'in' : e && (e.ctrlKey || e.metaKey) ? 'out' : p.side);

/* ---------- Ease Copy (v0.30, docs/features/MOTION_CONTROL.md) ---------- */
/** The copied ease: { curves: [curve | {hold:true}], from }. v0.29 stored one curve — still read. */
function clipOf(pr) {
  const c = pr.clip;
  if (!c) return null;
  if (Array.isArray(c.curves) && c.curves.length) return c;
  if (Number.isFinite(c.x1)) return { curves: [{ x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2 }], from: 'curve' };
  return null;
}
const clipLabel = (c) => (c.curves.length > 1 ? `${c.curves.length} segments from ${c.from}` : `${c.curves[0].hold ? 'hold' : BZ.css(c.curves[0])}${c.from && c.from !== 'curve' ? ` from ${c.from}` : ''}`);
/** v0.30.1: Ease Copy as named buttons (the icons alone were not found), with what is on the clipboard. */
function easeCopyBar(app, pr, slim) {
  const c = clipOf(pr);
  const short = c ? (c.curves.length > 1 ? `${c.curves.length} segments` : c.curves[0].hold ? 'hold' : BZ.css(c.curves[0]).replace('cubic-bezier', '')) : 'nothing copied';
  return h('div', { class: `kit-easecopy ${slim ? 'slim' : ''}`, 'data-key': 'kit-easecopy', role: 'group', 'aria-label': 'Ease Copy' },
    h('button', { class: 'btn sm kit-ec', 'data-key': 'kit-copy', 'aria-label': 'Copy ease', title: 'Ease Copy: copy the ease of the selected keys, every segment (or the curve on the graph when no keys are selected)', onclick: () => copyEase(app) }, icon('easeCopy', 'sm'), h('span', {}, 'Copy ease')),
    h('button', { class: 'btn sm kit-ec', 'data-key': 'kit-paste', 'aria-label': 'Paste ease', disabled: !c,
      title: c ? `Paste ${clipLabel(c)} on the selected keys — any property, any distance (${pr.side === 'both' ? 'in + out' : `ease ${pr.side} only`})` : 'Copy an ease first', onclick: () => pasteEase(app) }, icon('easePaste', 'sm'), h('span', {}, 'Paste ease')),
    slim ? null : h('span', { class: `kit-ec-clip ${c ? '' : 'dim'}`, title: c ? clipLabel(c) : `${short} — select keys and press Copy ease` }, short));
}
function copyEase(app) {
  const segs = keyed(ctxOf(app)).length && K.segs && K.segs.length ? K.segs : null;
  const curves = segs ? segs.map((sg) => (sg.hold ? { hold: true } : { x1: sg.curve.x1, y1: sg.curve.y1, x2: sg.curve.x2, y2: sg.curve.y2 })) : [{ x1: K.curve.x1, y1: K.curve.y1, x2: K.curve.x2, y2: K.curve.y2 }];
  const from = segs ? (K.srcBase || 'keys') : 'curve';
  setPref(app, { clip: { curves, from } });
  app.toast(segs ? `Ease copied: ${curves.length} segment${curves.length > 1 ? 's' : ''} from ${from}` : `Curve copied: ${BZ.css(K.curve)}`, 2400, 'ok');
}
function pasteEase(app) {
  const c = clipOf(prefs(app));
  if (!c) { app.toast('Copy an ease first (select keys, then Copy)', 3000, 'warn'); return null; }
  return Promise.resolve(run(app, 'motion.pasteEase', { clip: JSON.stringify(c.curves), side: prefs(app).side }, `Paste ease${c.curves.length > 1 ? ` (${c.curves.length} segments)` : ''}`)).then((r) => { setTimeout(() => autoRead(app, true), 0); return r; });
}

/* ---------- ease block ---------- */
/** Small picture of a curve (fits overshoot / anticipation), used as the preset's only face. */
function curveSvg(cv) {
  let lo = 0, hi = 1;
  const pts = [];
  for (let i = 0; i <= 24; i++) { const q = BZ.point(cv, i / 24); pts.push(q); lo = Math.min(lo, q.y); hi = Math.max(hi, q.y); }
  const Y = (y) => 19 - (y - lo) / (hi - lo) * 16;
  const line = pts.map((q) => `${(2 + q.x * 20).toFixed(1)},${Y(q.y).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 24 22" aria-hidden="true"><path d="M2 ${Y(0).toFixed(1)}H22M2 ${Y(1).toFixed(1)}H22" stroke="currentColor" opacity=".18" fill="none"/><polyline points="${line}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
/** A preset = only the picture of its curve (name in the tooltip). */
function chip(app, p, active, user) {
  const pr = prefs(app);
  const cv = BZ.normalize(p);
  return h('button', {
    class: `kit-chip ${active ? 'on' : ''} ${user ? 'mine' : ''}`, 'data-key': `chip-${p.id}`, 'aria-pressed': String(!!active), 'aria-label': user ? `My curve ${BZ.css(cv)}` : p.label,
    title: `${user ? 'My curve' : p.label} — ${BZ.css(cv)}\nClick: apply (${pr.side === 'both' ? 'in + out' : pr.side}) · Shift: ease in only · Ctrl: ease out only · Alt: load into the graph only${user ? ' · Right-click: remove' : ''}`,
    onclick: (e) => { if (e.altKey) { K.curve = Object.assign({}, cv); if (K.graph) K.graph.set(cv); app.render(); return; } applyCurve(app, cv, sideOf(e, pr), user ? 'My curve' : p.label); },
    oncontextmenu: user ? (e) => { e.preventDefault(); removeCurve(app, p); } : undefined
  }, h('span', { class: 'kit-chip-g', html: curveSvg(cv) }));
}
/** Save the curve in the graph — no name needed; the same curve is never saved twice. */
function saveCurve(app) {
  const cv = BZ.normalize(K.curve);
  const dup = matchPreset(cv, userCurves(app));
  if (dup) { app.toast(`Already a preset: ${(BZ.PRESETS.concat(userCurves(app)).find((p) => p.id === dup) || {}).label || BZ.css(cv)}`, 2600, 'info'); return; }
  app.services.store.set('kit-curves', userCurves(app).concat([Object.assign({ id: `u${Date.now().toString(36)}`, label: BZ.css(cv), tag: 'Mine' }, { x1: r3(cv.x1), y1: r3(cv.y1), x2: r3(cv.x2), y2: r3(cv.y2) })]));
  app.toast(`Saved ${BZ.css(cv)}`, 2000, 'ok');
  app.render();
}
/** Remove a saved curve; an Undo chip stays for 8 s (never a silent delete). */
function removeCurve(app, p) {
  const list = userCurves(app), at = list.findIndex((x) => x.id === p.id);
  if (at < 0) return;
  app.services.store.set('kit-curves', list.filter((x) => x.id !== p.id));
  clearTimeout(K.undoTimer);
  K.undoCurve = { p, at };
  K.undoTimer = setTimeout(() => { K.undoCurve = null; app.scheduleRender(); }, 8000);
  app.toast('Curve removed — the ↶ chip brings it back', 3000, 'info');
  app.render();
}
function undoChip(app) {
  if (!K.undoCurve) return null;
  return h('button', { class: 'kit-chip more undo', title: 'Bring back the curve you removed', 'aria-label': 'Undo remove curve', onclick: () => {
    const { p, at } = K.undoCurve, list = userCurves(app).slice();
    list.splice(Math.min(at, list.length), 0, p);
    app.services.store.set('kit-curves', list); K.undoCurve = null; clearTimeout(K.undoTimer); app.render();
  } }, icon('undo', 'sm'));
}

/** Edit one segment (n ≥ 1) or all of them (0): the graph loads that segment's own curve. */
function selectSeg(app, n) {
  if (!K.segs || n < 0 || n > K.segs.length) return;
  K.seg = n;
  const s = curSeg();
  if (s && !s.hold) { K.curve = Object.assign({}, s.curve); K.ghost = Object.assign({}, s.curve); if (K.graph) K.graph.set(K.curve); }
  if (K.srcBase && s) K.src = `${K.srcBase}${n ? ` · segment ${n} (keys ${s.a}–${s.b})${s.hold ? ': hold' : ''}` : ` · keys ${K.segs[0].a}–${K.segs[K.segs.length - 1].b}`}`;
  app.render();
}
/** All · 1 · 2 · … — each segment as the picture of the curve that is on it now. */
function segStrip(app) {
  if (!K.segs || K.segs.length < 2) return null;
  return h('div', { class: 'kit-segs', role: 'tablist', 'aria-label': 'Segments', 'data-key': 'segs' },
    h('button', { class: `kit-segb all ${K.seg ? '' : 'on'}`, role: 'tab', 'aria-selected': String(!K.seg), title: 'Edit every segment together (one curve on all)', onclick: () => selectSeg(app, 0) }, 'All'),
    K.segs.map((s, i) => h('button', {
      class: `kit-segb ${K.seg === i + 1 ? 'on' : ''}`, role: 'tab', 'aria-selected': String(K.seg === i + 1), 'data-key': `seg-${i}`, 'aria-label': `Segment ${i + 1}`,
      title: `Segment ${i + 1}: keys ${s.a}–${s.b} · ${s.dt.toFixed(2)} s${s.hold ? ' · hold' : ` · ${BZ.css(s.curve)}`}\nClick: edit only this segment`,
      onclick: () => selectSeg(app, K.seg === i + 1 ? 0 : i + 1)
    }, h('span', { class: 'kit-segn' }, String(i + 1)), s.hold ? h('span', { class: 'kit-segh' }, 'hold') : h('span', { class: 'kit-chip-g', html: curveSvg(K.seg === i + 1 ? K.curve : s.curve) }))));
}

/** Live sync of everything that shows the curve (sliders, velocity fields, numbers, overview). */
function syncLive(cv) {
  const el = document.querySelector('.kit-num'); if (el && document.activeElement !== el) el.value = nums(cv);
  const ov = document.querySelector('.kit-overview'); if (ov) KG.drawOverview(ov, K.segs, cv, K.unit, K.seg);
  [['out', cv.x1 * 100], ['in', (1 - cv.x2) * 100]].forEach(([side, v]) => { const r = document.querySelector(`.kit-range[data-side="${side}"]`); if (r) { r.value = Math.round(v); const t = r.nextSibling; if (t) t.textContent = `${Math.round(v)}%`; } });
  const avg = curSeg() ? curSeg().avg : 0, sp = KG.keySpeeds(cv), spd = (rel) => (avg ? String(Math.round(rel * avg * 10) / 10) : String(Math.round(rel * 100) / 100));
  [['Outgoing speed', spd(sp.out)], ['Outgoing influence', String(Math.round(cv.x1 * 100))], ['Incoming speed', spd(sp.in)], ['Incoming influence', String(Math.round((1 - cv.x2) * 100))]].forEach(([l, v]) => { const f = document.querySelector(`.kit-vel[data-vel="${l}"]`); if (f && document.activeElement !== f) f.value = v; });
}

/**
 * Value and Speed graphs (v0.13: shown together by default, both editable). A drag on one moves
 * the other live; hovering one shows the same moment on the other.
 */
function graph(app) {
  const pr = prefs(app);
  const view = pr.graph === 'value' || pr.graph === 'speed' ? pr.graph : 'both';
  const both = view === 'both';
  const ws = [];
  const make = (mode, height, track, label) => {
    const w = KG.widget({
      get: () => K.curve, ghost: () => K.ghost, mode, height, link: pr.link, autoApply: pr.auto, track, label,
      units: () => { const sg = curSeg(); return sg && sg.avg ? { avg: sg.avg, unit: K.unit } : {}; },
      onCommit: (cv) => { K.curve = cv; ws.forEach((o) => o !== w && o.set(cv)); if (pr.auto) applyCurve(app, cv, pr.side, 'Ease Curve'); else app.render(); },
      onLive: (cv) => { ws.forEach((o) => o !== w && o.set(cv)); syncLive(cv); },
      onHover: (u) => ws.forEach((o) => o !== w && o.hover(u)),
      onHeight: (px) => setPref(app, { graphH: Math.round(px) })
    });
    W.animated(w.canvas, (now) => w.paint(w.state.drag || w.state.nudge ? null : now));
    ws.push(w);
    return w;
  };
  const wv = view !== 'speed' ? make('value', pr.graphH, true, both ? 'VALUE' : null) : null;
  const wsp = view !== 'value' ? make('speed', both ? Math.max(90, Math.round(pr.graphH * 0.8)) : pr.graphH, !both, both ? 'SPEED' : null) : null;
  K.graph = { set: (cv) => ws.forEach((o) => o.set(cv)) };
  const grip = (wv || wsp).grip;
  const num = h('input', { class: 'kit-num', value: nums(K.curve), spellcheck: 'false', 'aria-label': 'Curve numbers (cubic-bezier)', title: 'Type or paste 4 numbers or a cubic-bezier(…) — Enter applies' });
  num.addEventListener('focus', () => num.select());
  num.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const cv = KG.parseCurve(num.value);
    if (!cv) { app.toast('Type 4 numbers, e.g. 0.16, 1, 0.3, 1', 3000, 'warn'); return; }
    K.curve = cv; K.graph.set(cv);
    if (pr.auto) applyCurve(app, cv, pr.side, 'Ease Curve'); else app.render();
  });
  const mode = (m, l, t) => h('button', { 'aria-pressed': String(view === m), title: t, onclick: () => setPref(app, { graph: m }) }, l);
  // Whole selected animation (3+ keys): real speed over real time, with the new curve on every segment.
  let ov = null;
  if (K.segs && K.segs.length > 1) {
    ov = h('canvas', { class: 'kit-overview', role: 'img', 'aria-label': 'Speed of the whole selected animation — click a segment to edit it alone', title: 'Speed of the whole selected animation (real time, real units)\nClick a segment: edit only that one · click it again: all segments' });
    ov.setAttribute('data-fresh', '');
    ov.addEventListener('click', (e) => { const r = ov.getBoundingClientRect(); const n = KG.segmentAt(K.segs, KG.ovGeom(r.width, K.segs).T(e.clientX - r.left)); selectSeg(app, n === K.seg ? 0 : n); });
    setTimeout(() => KG.drawOverview(ov, K.segs, K.curve, K.unit, K.seg), 0);
  }
  const thru = K.nKeys > 2 && !K.seg ? h('button', { class: `kit-thru ${pr.through ? 'on' : ''}`, 'aria-pressed': String(!!pr.through), title: 'Pass through middle keys: the speed flows through the keys between the first and the last (no stop at each key)', onclick: () => setPref(app, { through: !pr.through }) }, 'Pass-through') : null;
  return h('div', { class: 'kit-graph-wrap' },
    ov,
    segStrip(app),
    h('div', { class: `kit-graphs ${both ? 'both' : ''}`, 'data-key': `graphs-${view}` }, ws.map((w, i) => h('div', { class: 'kit-gcell', 'data-key': `gcell-${i}` }, w.canvas))),
    h('div', { class: 'kit-gbar', 'data-key': 'gbar' },
      h('div', { class: 'kit-seg kit-gmode', role: 'group', 'aria-label': 'Graph' },
        mode('both', 'Both', 'Value and speed graphs together — drag either one (Motion 4 / AE Graph Editor)'),
        mode('value', 'Value', 'Value graph only: progress over time (like CSS / Flow)'),
        mode('speed', 'Speed', 'Speed graph only: drag sideways for influence, up / down for the speed at the key (like AE\'s speed graph)')),
      thru,
      grip,
      num));
}
const nums = (cv) => [cv.x1, cv.y1, cv.x2, cv.y2].map((v) => String(Math.round(v * 100) / 100)).join(', ');

function slider(app, label, which) {
  const pr = prefs(app);
  const cv = K.curve;
  const val = which === 'out' ? Math.round(cv.x1 * 100) : Math.round((1 - cv.x2) * 100);
  const input = h('input', { type: 'range', min: 1, max: 99, step: 1, value: val, 'aria-label': `${label} influence`, class: 'kit-range', 'data-side': which });
  const out = h('span', { class: 'kit-range-v' }, `${val}%`);
  const set = (v) => {
    const c = K.curve;
    if (which === 'out' || pr.link) c.x1 = v / 100;
    if (which === 'in' || pr.link) c.x2 = 1 - v / 100;
    out.textContent = `${v}%`;
    if (K.graph) K.graph.set(c);
  };
  input.addEventListener('input', () => set(Number(input.value)));
  input.addEventListener('change', () => { set(Number(input.value)); if (pr.auto) applyCurve(app, K.curve, pr.side, `${label} ${input.value}%`); else app.render(); });
  return h('label', { class: 'kit-slider', title: `${label} influence — how long the ${which === 'out' ? 'first key holds back' : 'second key settles'}` }, h('span', { class: 'kit-slider-l' }, label), input, out);
}

/** AE's Keyframe Velocity dialog, in the kit: exact speed (real units) and influence for each side. */
function velocity(app) {
  const pr = prefs(app);
  const avg = curSeg() ? curSeg().avg : 0, unit = K.unit;
  const sp = KG.keySpeeds(K.curve);
  // v0.55 (owner: "a smart hidden slider"): each number is also a slider you do not see — drag sideways on it like
  // After Effects' scrubby values (Shift ×10, Ctrl fine), the graph follows live, release applies; a plain click types.
  // A thin bar under the field shows where the value sits (on hover / while dragging).
  const field = (label, value, suffix, on, scrub) => {
    const input = h('input', { class: 'kit-vel', value, inputmode: 'decimal', spellcheck: 'false', 'aria-label': label, 'data-vel': label, title: `${label} — drag sideways to change (Shift ×10, Ctrl fine) · ↑ ↓ step · click to type, Enter applies` });
    const fill = h('span', { class: 'kit-vfill', 'aria-hidden': 'true' });
    const show = (v) => fill.style.setProperty('--p', `${Math.round(Math.max(0, Math.min(1, scrub.frac(v))) * 1000) / 10}%`);
    show(Number(value));
    const commit = (v) => { const cv = on(v); K.curve = cv; if (K.graph) K.graph.set(cv); if (pr.auto) applyCurve(app, cv, pr.side, label); else app.render(); };
    input.addEventListener('focus', () => input.select());
    input.addEventListener('keydown', (e) => { if (e.key !== 'Enter') return; const v = Number(String(input.value).replace(',', '.')); if (!Number.isFinite(v)) { app.toast('Type a number', 2400, 'warn'); return; } commit(v); });
    // v0.56: the shared hidden slider (app/ui/scrub.js) — same behaviour as every number in the panel
    require('../scrub').attach(input, { step: scrub.step, min: scrub.lo, max: scrub.hi, round: scrub.round, fill: null,
      live: (v) => { show(v); const cv = on(v); K.curve = cv; if (K.graph) K.graph.set(cv); }, commit });
    return h('label', { class: 'kit-vfield' }, input, h('span', { class: 'kit-vunit' }, suffix), fill);
  };
  const spd = (rel) => (avg ? String(Math.round(rel * avg * 10) / 10) : String(Math.round(rel * 100) / 100));
  const toRel = (v) => (avg ? v / avg : v);
  const unitTxt = avg ? `${unit || 'units'}/s` : '× avg';
  // the hidden sliders' ranges: influence 1–99 % (1 % a pixel); speed ≥ 0, 1 % of the average speed a pixel, the bar spans 0–3× the average
  const INFL = { step: 1, lo: 1, hi: 99, clamp: (v) => Math.max(1, Math.min(99, v)), round: (v) => Math.round(v), frac: (v) => v / 100 };
  const base = avg || 1;
  const SPEED = { step: base * 0.01, lo: 0, clamp: (v) => Math.max(0, v), round: (v) => Math.round(v * 10) / 10, frac: (v) => v / (base * 3) };
  return h('div', { class: 'kit-velocity', role: 'group', 'aria-label': 'Keyframe velocity' },
    h('span', { class: 'kit-slider-l' }, 'Out'),
    field('Outgoing speed', spd(sp.out), unitTxt, (v) => KG.fromSpeed(K.curve, 1, K.curve.x1, toRel(v)), SPEED),
    field('Outgoing influence', String(Math.round(K.curve.x1 * 100)), '%', (v) => KG.fromSpeed(K.curve, 1, v / 100, sp.out), INFL),
    h('span', { class: 'kit-slider-l' }, 'In'),
    field('Incoming speed', spd(sp.in), unitTxt, (v) => KG.fromSpeed(K.curve, 2, K.curve.x2, toRel(v)), SPEED),
    field('Incoming influence', String(Math.round((1 - K.curve.x2) * 100)), '%', (v) => KG.fromSpeed(K.curve, 2, 1 - v / 100, sp.in), INFL));
}

/**
 * v0.30 Motion Control: the anchor 3×3 and the align buttons are small, so they live INSIDE the ease block,
 * in a rail beside the graph (under it in a narrow panel) — one control surface for "where it is" and
 * "how it moves". opts.rail = show them (NOW / Now card / MOE top / docked Motion Kit).
 */
function rail(app) {
  return h('div', { class: 'kit-rail', 'data-key': 'kit-rail', role: 'group', 'aria-label': 'Anchor and align' }, anchorBlock(app, true), alignBlock(app, true));
}
function easeBlock(app, opts = {}) {
  const pr = prefs(app);
  const ctx = ctxOf(app);
  autoRead(app);
  const match = matchPreset(K.curve, userCurves(app));
  const nKeys = selectedKeyCount(ctx);
  const seg = (v, l, t) => h('button', { 'aria-pressed': String(pr.side === v), title: t, onclick: () => setPref(app, { side: v }) }, l);
  const tool = (ic, label, title, onclick, extra = {}) => h('button', Object.assign({ class: 'kit-ib', title: `${label} — ${title}`, 'aria-label': label, onclick }, extra), icon(ic, 'sm'));
  const chips = CHIPS.map((id) => BZ.PRESETS.find((p) => p.id === id)).filter(Boolean);
  const mine = userCurves(app);
  const title = opts.rail ? 'Motion' : 'Ease';
  if (folded(app, 'ease')) {
    // folded = the compact strip: the curve, what it was read from, and (Motion Control) anchor + align.
    // v0.65 (docs/features/WORKSPACES.md): with keys selected it is the Motion Bar — Easy / Linear / Hold and the
    // curves you use most, one click each, and a Graph button for the full editor. The full graph no longer takes the
    // top of every page; it opens when you ask (remembered) and lives in MOE's Timing tab.
    const parts = (K.scope && K.scope.parts) || ['bar', 'rail'];
    const scNow = K.scope;
    // v0.65: MOE's Layer tab shows only the placing tools (the ease lives in Animate's bar and the Timing tab)
    const placeOnly = opts.rail && !parts.includes('bar');
    const bar = opts.rail && nKeys > 0 && parts.includes('bar') ? h('div', { class: 'kit-mbar', role: 'toolbar', 'aria-label': 'Ease the selected keys' },
      h('div', { class: 'kit-ibgroup' },
        tool('easeCurve', 'Easy', 'Easy Ease (F9): speed 0, 33 % influence on both sides', () => run(app, 'motion.smartEase', { influenceIn: 33.33, influenceOut: 33.33 }, 'Easy Ease'), { 'data-key': 'mb-easy' }),
        tool('kLinear', 'Linear', `Linear keys (${pr.side})`, () => run(app, 'kit.interp', { mode: 'linear', side: pr.side }, 'Linear'), { 'data-key': 'mb-linear' }),
        tool('kHold', 'Hold', `Hold keys (${pr.side})`, () => run(app, 'kit.interp', { mode: 'hold', side: pr.side }, 'Hold'), { 'data-key': 'mb-hold' })),
      h('div', { class: 'kit-mbar-chips' }, mine.slice(0, 2).map((p) => chip(app, p, match === p.id, true)).concat(BAR_CHIPS.map((id) => BZ.PRESETS.find((p) => p.id === id)).filter(Boolean).slice(0, 6 - Math.min(2, mine.length)).map((p) => chip(app, p, match === p.id)))),
      h('button', { class: 'btn sm kit-mbar-graph', 'data-key': 'mb-graph', title: 'The full graph: value + speed curves, handles, every preset', onclick: () => openEase(app, scNow), 'aria-label': 'Graph' }, icon('easeCurve', 'sm'), h('span', { class: 'kit-mbar-gl' }, 'Graph'))) : null;
    return h('section', { class: `kit-block kit-ease folded ${opts.rail ? 'kit-control' : ''} ${bar ? 'has-mbar' : ''}`, 'aria-label': opts.rail ? 'Motion control' : 'Ease' },
      placeOnly ? h('div', { class: 'kit-h' }, h('span', { class: 'kit-t' }, 'Place'), h('span', { class: 'kit-src dim' }, 'anchor · align · distribute')) :
      h('div', { class: 'kit-h' }, foldTitle(app, 'ease', title),
        h('span', { class: 'kit-chip-g kit-fold-cv', html: curveSvg(K.curve), title: BZ.css(K.curve) }),
        h('span', { class: `kit-src ${K.src ? '' : 'dim'}` }, K.src || (nKeys ? 'select 2+ keys on one property' : 'no keys selected')),
        opts.rail ? h('span', { class: 'spacer' }) : null,
        opts.rail ? easeCopyBar(app, pr, true) : null),
      bar,
      opts.rail && parts.includes('rail') ? rail(app) : null);
  }
  return h('section', { class: `kit-block kit-ease ${opts.rail ? 'kit-control' : ''}`, 'aria-label': opts.rail ? 'Motion control' : 'Ease' },
    h('div', { class: 'kit-h' },
      foldTitle(app, 'ease', title),
      h('button', { class: `kit-src ${K.src ? '' : 'dim'}`, title: `${K.src || 'No curve read'} — click to read the selected keys again`, onclick: () => (keyed(ctxOf(app)).length ? autoRead(app, true) : app.toast('Select two or more keyframes on one property — the graph then shows their curve', 3500, 'info')) }, K.src || (nKeys ? 'select 2+ keys on one property' : 'no keys selected')),
      match ? h('span', { class: 'kit-match', title: 'The curve matches this preset' }, `≈ ${(BZ.PRESETS.concat(userCurves(app)).find((p) => p.id === match) || {}).label || ''}`) : null,
      h('span', { class: 'spacer' }),
      h('div', { class: 'kit-seg', role: 'group', 'aria-label': 'Apply to' }, seg('in', 'In', 'Ease in only (incoming side)'), seg('both', 'Both', 'In and out'), seg('out', 'Out', 'Ease out only (outgoing side)')),
      h('button', { class: `icon-btn ${pr.link ? 'on' : ''}`, 'aria-pressed': String(pr.link), title: 'Mirror: the two handles move together (symmetric ease)', 'aria-label': 'Mirror handles', onclick: () => setPref(app, { link: !pr.link }) }, icon('mirror', 'sm')),
      h('button', { class: `icon-btn kit-auto ${pr.auto ? 'on' : ''}`, 'aria-pressed': String(pr.auto), title: pr.auto ? 'Auto on: graph edits land on the selected keys when you let go' : 'Auto off: shape the curve, then press Apply', 'aria-label': 'Auto apply', onclick: () => setPref(app, { auto: !pr.auto }) }, icon('kAuto', 'sm'))),
    opts.rail ? h('div', { class: 'kit-graph-row' }, h('div', { class: 'kit-graph-wrap' }, graph(app)), rail(app)) : h('div', { class: 'kit-graph-wrap' }, graph(app)),
    pr.auto ? null : h('div', { class: 'kit-row' }, h('span', { class: 'spacer' }), h('button', { class: 'btn primary sm', onclick: () => applyCurve(app, K.curve, pr.side, 'Ease Curve') }, icon('play', 'xs'), 'Apply curve')),
    pr.graph === 'value' ? h('div', { class: 'kit-sliders' }, slider(app, 'Out', 'out'), slider(app, 'In', 'in')) : velocity(app),
    h('div', { class: 'kit-tools-row icons' },
      h('div', { class: 'kit-ibgroup' },
      tool('easeCurve', 'Easy', 'Easy Ease (F9): speed 0, 33 % influence on both sides', () => run(app, 'motion.smartEase', { influenceIn: 33.33, influenceOut: 33.33 }, 'Easy Ease'), { 'data-key': 'ci-easy' }),
      tool('kLinear', 'Linear', `Linear keys (${pr.side})`, () => run(app, 'kit.interp', { mode: 'linear', side: pr.side }, 'Linear'), { 'data-key': 'ci-linear' }),
      tool('kHold', 'Hold', `Hold keys (${pr.side})`, () => run(app, 'kit.interp', { mode: 'hold', side: pr.side }, 'Hold'), { 'data-key': 'ci-hold' })),
      h('div', { class: 'kit-ibgroup' },
      tool('reverse', 'Flip', 'Flip the curve: the same ease played backwards (ease-out ↔ ease-in)', () => { const cv = KG.flipCurve(K.curve); K.curve = cv; if (K.graph) K.graph.set(cv); if (pr.auto) applyCurve(app, cv, pr.side, 'Flip curve'); else app.render(); })), easeCopyBar(app, pr)),
    h('div', { class: 'kit-chips', role: 'toolbar', 'aria-label': 'Ease presets' },
      chips.map((p) => chip(app, p, match === p.id)),
      mine.length ? h('span', { class: 'kit-chip-sep', 'aria-hidden': 'true' }) : null,
      mine.map((p) => chip(app, p, match === p.id, true)),
      undoChip(app),
      h('button', { class: 'kit-chip more', title: 'Save this curve as a preset (no name needed)', 'aria-label': 'Save curve', onclick: () => saveCurve(app) }, icon('plus', 'sm')),
      h('button', { class: `kit-chip more ${K.lib ? 'on' : ''}`, 'aria-pressed': String(K.lib), title: K.lib ? 'Fewer curves' : 'All curves', 'aria-label': 'All curves', onclick: () => { K.lib = !K.lib; app.render(); } }, icon(K.lib ? 'x' : 'grid', 'sm'))),
    K.lib ? h('div', { class: 'kit-lib' }, curveLibrary(app, match)) : null);
}
function curveLibrary(app, match) {
  const fam = ['All', ...BZ.TAGS];
  const groups = (K.libTag === 'All' ? BZ.TAGS : [K.libTag]).map((t) => [t, BZ.PRESETS.filter((p) => p.tag === t)]).filter(([, l]) => l.length);
  const mine = userCurves(app);
  return [
    h('div', { class: 'kit-seg wide', role: 'group', 'aria-label': 'Curve family' }, fam.map((t) => h('button', { 'aria-pressed': String(K.libTag === t), onclick: () => { K.libTag = t; app.render(); } }, t))),
    groups.map(([t, list]) => h('div', { class: 'kit-libgroup', 'data-key': `lg-${t}` }, h('span', { class: 'kit-libtag' }, t), h('div', { class: 'kit-chips grid' }, list.map((p) => chip(app, p, match === p.id))))),
    K.libTag === 'All' && mine.length ? h('div', { class: 'kit-libgroup', 'data-key': 'lg-mine' }, h('span', { class: 'kit-libtag' }, 'Mine'), h('div', { class: 'kit-chips grid' }, mine.map((p) => chip(app, p, match === p.id, true)))) : null];
}

/* ---------- anchor + align ---------- */
function anchorBlock(app, mini) {
  const pr = prefs(app);
  const rd = library.readiness(app, { tool: 'transform.anchor', args: { point: 'c' } });
  return h('section', { class: `kit-block kit-anchor ${mini ? 'mini' : ''}`, 'aria-label': 'Anchor point' },
    mini ? h('div', { class: 'kit-cap-row' }, h('span', { class: 'kit-cap' }, 'Anchor'), h('span', { class: 'spacer' }),
      h('label', { class: 'kit-check mini', title: 'Use the layer\'s masks for the box instead of its content' }, h('input', { type: 'checkbox', checked: pr.masks, onchange: (e) => setPref(app, { masks: e.target.checked }) }), 'Masks')) : h('div', { class: 'kit-h' }, foldTitle(app, 'anchor', 'Anchor')),
    !mini && folded(app, 'anchor') ? null : h('div', { class: 'kit-anchor-body' },
    h('div', { class: `kit-dots ${rd.ok ? '' : 'off'}`, role: 'group', 'aria-label': 'Anchor point' },
      ORDER.map((p) => h('button', {
        class: 'kit-dot', 'data-key': `ap-${p}`, 'aria-label': `Anchor ${TM.POINT_LABEL[p]}`,
        title: `${TM.POINT_LABEL[p]}\nClick: anchor here (the layer does not move)\nAlt-click: also place the layer at the ${TM.POINT_LABEL[p].toLowerCase()} of the comp${rd.ok ? '' : `\n— ${rd.hint}`}`,
        onclick: (e) => run(app, 'transform.anchor', { point: p, masks: pr.masks, place: !!e.altKey }, `Anchor ${TM.POINT_LABEL[p]}${e.altKey ? ' + place' : ''}`)
      }, h('span')))),
    mini ? null : h('label', { class: 'kit-check', title: 'Use the layer\'s masks for the box instead of its content' }, h('input', { type: 'checkbox', checked: pr.masks, onchange: (e) => setPref(app, { masks: e.target.checked }) }), 'Masks')));
}
/**
 * Align (v0.13): two rows — ↔ and ↕ — each with align (edges / centre) and spread (distribute
 * centres / space evenly). Target: the selection, the key layer (first selected stays) or the comp.
 * Alt-click = to the comp, Shift-click = to the key layer (one-off). Gap: empty = even, a number = fixed px.
 */
function alignBlock(app, mini) {
  const pr = prefs(app);
  const to = (v, l, t) => h('button', { 'aria-pressed': String(pr.to === v), title: t, onclick: () => setPref(app, { to: v }) }, l);
  const btn = ([mode, ic, label]) => {
    const spread = /^(dist|space)/.test(mode);
    const fixed = /^space/.test(mode) && pr.gap !== null && pr.gap !== undefined && pr.gap !== '';
    const args = Object.assign({ mode, to: pr.to }, /^space/.test(mode) ? { fixedGap: fixed, gap: fixed ? Number(pr.gap) : 20 } : {});
    const rd = library.readiness(app, { tool: 'transform.align', args });
    const target = pr.to === 'key' ? 'the key layer (first selected)' : `the ${pr.to}`;
    return h('button', {
      class: `kit-ib ${rd.ok ? '' : 'off'}`, 'data-key': `al-${mode}`, 'aria-label': label,
      title: `${label}${spread ? (fixed ? ` · gap ${pr.gap} px` : '') : ` to ${target}\nAlt-click: to the comp · Shift-click: to the key layer`} — the whole animation moves${rd.ok ? '' : `\n— ${rd.hint}`}`,
      onclick: (e) => {
        const a = Object.assign({}, args, spread ? {} : { to: e.altKey ? 'comp' : e.shiftKey ? 'key' : pr.to });
        run(app, 'transform.align', a, label + (spread ? '' : a.to === pr.to ? '' : ` (${a.to})`));
      }
    }, icon(ic, 'sm'));
  };
  const gap = h('input', { class: 'kit-gap', value: pr.gap === null || pr.gap === undefined ? '' : String(pr.gap), placeholder: 'even', inputmode: 'decimal', spellcheck: 'false', 'aria-label': 'Gap for Space evenly (px; empty = even)', title: 'Gap for Space evenly, in px — empty = equal gaps across the current span; Enter keeps it' });
  const setGap = () => { const t = String(gap.value).trim().replace(',', '.'); const v = t === '' ? null : Number(t); if (t !== '' && !Number.isFinite(v)) { app.toast('Type a number of pixels, or leave it empty for even gaps', 3000, 'warn'); return; } if (v !== pr.gap) setPref(app, { gap: v }); };
  gap.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); setGap(); } });
  gap.addEventListener('change', setGap);
  // v0.56: the gap is a hidden slider too (drag sideways from "even" = 0 px)
  require('../scrub').attach(gap, { step: 1, min: 0, max: 2000, round: Math.round, commit: (v) => { if (v !== pr.gap) setPref(app, { gap: v }); } });
  gap.title = 'Gap for Space evenly, in px — drag sideways or type; empty = equal gaps across the current span';
  const f = !mini && folded(app, 'align');
  return h('section', { class: `kit-block kit-align ${mini ? 'mini' : ''}`, 'aria-label': 'Align' },
    h('div', { class: 'kit-h' }, mini ? h('span', { class: 'kit-cap' }, 'Align') : foldTitle(app, 'align', 'Align'), h('span', { class: 'spacer' }),
      h('div', { class: 'kit-seg', role: 'group', 'aria-label': 'Align to' },
        to('selection', 'Sel', 'Align to the selection\'s bounds'),
        to('key', 'Key', 'Align to the key layer: the first selected layer stays, the others line up with it'),
        to('comp', 'Comp', 'Align to the comp'))),
    f ? null : ALIGN_ROWS.map((r) => h('div', { class: 'kit-align-row2', 'data-key': `ar-${r.axis}` },
      h('span', { class: 'kit-axis', 'aria-hidden': 'true' }, r.axis),
      h('div', { class: 'kit-ibgroup' }, r.align.map(btn)),
      h('div', { class: 'kit-ibgroup' }, r.spread.map(btn)))),
    f ? null : h('label', { class: 'kit-gapl' }, h('span', {}, 'Gap'), gap, h('span', { class: 'kit-vunit' }, 'px')));
}

/* ---------- tools ---------- */
function toolButton(app, id, pinMode, onRun) {
  const s = app.state.get();
  const pr = prefs(app);
  const a = quickbar.byId(id);
  if (!a) return null;
  const rd = library.readiness(app, { tool: a.tool, args: a.args });
  const alt = BAR.KIT_ALT[id];
  const pinned = pr.pins.includes(id);
  if (pinMode) {
    return h('button', { class: `kit-tool pin ${pinned ? 'on' : ''}`, 'data-key': `kp-${id}`, 'aria-pressed': String(pinned), 'aria-label': `${pinned ? 'Unpin' : 'Pin'} ${BAR.KIT_LABEL[id] || a.label}`, title: pinned ? 'On Home — click to unpin' : 'Click to pin to Home',
      onclick: () => setPref(app, { pins: pinned ? pr.pins.filter((x) => x !== id) : pr.pins.concat([id]) }) },
    icon(a.icon || 'bolt'), h('span', { class: 'kit-tool-l' }, BAR.KIT_LABEL[id] || a.label), pinned ? h('span', { class: 'kit-pin-mark' }, icon('star', 'xs')) : null);
  }
  return h('button', {
    class: `kit-tool ${rd.ok ? '' : 'off'} ${id === 'k_trash' ? 'danger' : ''}`, 'data-key': `kt-${id}`, disabled: !!s.running, 'aria-label': BAR.KIT_LABEL[id] || a.label,
    title: `${a.label}${alt ? `\nAlt-click: ${{ clone: 'mirror keys', k_delay: 'Blend (smooth lag) instead of Spring' }[id] || 'reverse order'}` : ''}\nRight-click: options${rd.ok ? '' : `\n— ${rd.hint}`}`,
    onclick: (e) => (e.altKey && alt ? quickbar.run(app, Object.assign({}, a, { args: Object.assign({}, a.args, alt) })) : rd.ok ? (onRun && onRun(id), quickbar.run(app, a)) : app.toast(`${a.label}: ${rd.hint}`, 4000, 'warn')),
    oncontextmenu: (e) => { e.preventDefault(); quickbar.openOptions(app, a); }
  }, icon(a.icon || 'bolt'), h('span', { class: 'kit-tool-l' }, BAR.KIT_LABEL[id] || a.label));
}
function toolsBlock(app, opts = {}) {
  const ids = opts.ids || BAR.KIT_TOOLS;
  const f = opts.foldId && folded(app, opts.foldId);
  const title = opts.foldId ? foldTitle(app, opts.foldId, opts.title || 'Tools') : h('span', { class: 'kit-t' }, opts.title || 'Tools');
  // v0.14: the full list is grouped by what the tools do; a pinned list keeps the user's order
  const body = !ids.length ? h('div', { class: 'why kit-empty' }, 'Nothing pinned — open the Toolbox and use “Pin to Home”.')
    : opts.ids ? h('div', { class: 'kit-grid' }, ids.map((id) => toolButton(app, id, opts.pinMode, opts.onRun)))
      : BAR.KIT_GROUPS.map(([g, list]) => h('div', { class: 'kit-tgroup', 'data-key': `tg-${g}` }, h('div', { class: 'kit-tgroup-h' }, g), h('div', { class: 'kit-grid' }, list.filter((id) => ids.includes(id)).map((id) => toolButton(app, id, opts.pinMode)))));
  return h('section', { class: `kit-block kit-toolbox ${opts.cls || ''}`, 'aria-label': opts.title || 'Tools' },
    h('div', { class: 'kit-h' }, title, opts.right || h('span', { class: 'kit-hint' }, 'right-click: options · Alt: variant')),
    f ? null : body);
}

/** Docked Motion Kit panel: everything, compact. */
function render(app) {
  return h('div', { class: 'view kit' },
    easeBlock(app, { rail: true }),
    toolsBlock(app, { foldId: 'kitTools' }));
}
/** Motion Control (v0.30): the one block for keys + anchor + align, used at the top of every style. */
const controlBlock = (app) => easeBlock(app, { rail: true });

function pinnedBlock(app) {
  const pr = prefs(app);
  return toolsBlock(app, { ids: pr.pins.map(BAR.migrate).filter((id) => BAR.KIT_TOOLS.includes(id)), title: 'Your tools', foldId: 'pinned', right: h('button', { class: 'btn ghost sm kit-more', title: 'All tools and the pin list (Ctrl 2)', onclick: () => app.go('kit') }, 'Toolbox', icon('chev', 'xs')) });
}

/** Toolbox (sidebar, Ctrl 2): every tool, the pin list for Home, the whole curve library. */
function renderToolbox(app) {
  const match = matchPreset(K.curve, userCurves(app));
  return h('div', { class: 'view kit toolbox' },
    toolsBlock(app, { pinMode: K.pinMode, title: K.pinMode ? 'Pin tools to Home' : 'Tools', right: h('button', { class: `btn ${K.pinMode ? 'primary' : 'ghost'} sm`, 'aria-pressed': String(!!K.pinMode), title: K.pinMode ? 'Done' : 'Choose the tools shown on Home', onclick: () => { K.pinMode = !K.pinMode; app.render(); } }, icon('star', 'xs'), K.pinMode ? 'Done' : 'Pin to Home') }),
    h('section', { class: 'kit-block', 'aria-label': 'Curve library' },
      h('div', { class: 'kit-h' }, h('span', { class: 'kit-t' }, 'Curve library'), h('span', { class: 'kit-hint' }, 'click: apply · Shift: in · Ctrl: out')),
      curveLibrary(app, match)));
}

module.exports = { controlBlock, copyEase, pasteEase, clipOf, render, renderToolbox, matchPreset, keyed, K, DEFAULT_PINS, prefs, setPref, isFolded,
  // v0.16 layouts (app/ui/layouts.js) build their screens from the same blocks
  easeBlock, anchorBlock, alignBlock, toolsBlock, pinnedBlock, curveLibrary, toolButton };
