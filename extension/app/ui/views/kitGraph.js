'use strict';
/**
 * Motion Kit ease graph (v0.10) — the control animators use most, modelled on AE's Graph Editor,
 * Motion 4's Easing screen and Flow:
 *   Value mode   the cubic-Bézier value curve; drag the two handles.
 *   Speed mode   AE-style speed graph: each key has a handle whose length is the influence
 *                (horizontal) and whose height is the speed at that key (vertical; 1 = average).
 *   Spacing      a spacing chart under the graph (one tick per 1/12 of the time) + a ball.
 *   Ghost        the curve that is on the keys now, faded, while you edit.
 * Interaction: drag (commit on release) · Shift = flat (speed 0) · Ctrl = snap to the grid ·
 * double-click a handle = reset it · arrows nudge the last handle (Shift ×5) · Enter = apply ·
 * drag the strip under the graph to resize it. The numbers can be typed or pasted (cubic-bezier).
 * Pure helpers (speeds, ranges, parsing) are exported for tests.
 */
const { h } = require('../dom');
const BZ = require('../../../features/curves/bezier');

const r3 = (v) => Math.round(v * 1000) / 1000;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const TRACK = 24;

/* ---------- pure maths ---------- */
/** Speed at each key relative to the average speed (1 = linear). */
function keySpeeds(cv) { return { out: cv.y1 / cv.x1, in: (1 - cv.y2) / (1 - cv.x2) }; }
/** New curve after moving one speed-graph handle to time x (influence) and relative speed s. */
function fromSpeed(cv, which, x, s) {
  const c = Object.assign({}, cv);
  if (which === 1) { c.x1 = clamp(x, BZ.X_MIN, BZ.X_MAX); c.y1 = clamp(s * c.x1, BZ.Y_MIN, BZ.Y_MAX); } else { c.x2 = clamp(x, BZ.X_MIN, BZ.X_MAX); c.y2 = clamp(1 - s * (1 - c.x2), BZ.Y_MIN, BZ.Y_MAX); }
  return { x1: r3(c.x1), y1: r3(c.y1), x2: r3(c.x2), y2: r3(c.y2) };
}
/** Vertical range of the value graph: grows to show overshoot / anticipation (Flow's responsive graph). */
function valueRange(cv) {
  let lo = Math.min(0, cv.y1, cv.y2), hi = Math.max(1, cv.y1, cv.y2);
  for (let i = 0; i <= 40; i++) { const y = BZ.point(cv, i / 40).y; lo = Math.min(lo, y); hi = Math.max(hi, y); }
  const pad = Math.max(0.12, (hi - lo) * 0.1);
  return { lo: lo - pad, hi: hi + pad };
}
/** Vertical range of the speed graph (relative speed), capped so a punchy curve stays readable. */
function speedRange(cv) {
  const s = keySpeeds(cv);
  let lo = Math.min(0, s.out, s.in), hi = Math.max(1.2, s.out, s.in);
  for (let i = 0; i <= 40; i++) { const v = BZ.speedAt(cv, i / 40); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  return { lo: Math.max(-6, lo) - 0.15, hi: Math.min(16, hi) * 1.12 + 0.1 };
}
/** "0.16, 1, 0.3, 1" or "cubic-bezier(.16,1,.3,1)" → curve (null if it is not 4 numbers). */
function parseCurve(text) {
  const n = String(text || '').match(/-?\d*\.?\d+(?:e-?\d+)?/gi);
  if (!n || n.length !== 4) return null;
  const [x1, y1, x2, y2] = n.map(Number);
  if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
  return BZ.normalize({ x1, y1, x2, y2 });
}
/** Canvas geometry: graph area on top, spacing track at the bottom. */
function geom(W, H, range) {
  const x0 = 12, x1 = W - 12, y0 = 10, y1 = H - TRACK - 14;
  const X = (x) => x0 + x * (x1 - x0), Y = (v) => y0 + (range.hi - v) / (range.hi - range.lo) * (y1 - y0);
  return { W, H, x0, x1, y0, y1, X, Y, ix: (px) => (px - x0) / (x1 - x0), iy: (py) => range.hi - (py - y0) / (y1 - y0) * (range.hi - range.lo), tY: H - TRACK / 2 - 4 };
}
/** Handle positions in canvas pixels for the current mode. */
function handles(cv, mode, g) {
  if (mode === 'speed') { const s = keySpeeds(cv); return [{ k: 1, x: g.X(cv.x1), y: g.Y(s.out), ax: g.X(0), ay: g.Y(s.out) }, { k: 2, x: g.X(cv.x2), y: g.Y(s.in), ax: g.X(1), ay: g.Y(s.in) }]; }
  return [{ k: 1, x: g.X(cv.x1), y: g.Y(cv.y1), ax: g.X(0), ay: g.Y(0) }, { k: 2, x: g.X(cv.x2), y: g.Y(cv.y2), ax: g.X(1), ay: g.Y(1) }];
}

/** "1250 px/s", "45 °/s", "12.5 %/s" — AE's Graph Editor units. */
function fmtSpeed(v, unit) {
  const a = Math.abs(v), n = a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2);
  return `${n} ${unit || 'units'}/s`;
}

/* ---------- drawing ---------- */
const css = (name, fb) => (typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() : '') || fb;
function prep(canvas) {
  const c = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 300, H = canvas.clientHeight || 160;
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);
  return { c, W, H };
}
function samePt(a, b) { return a && b && ['x1', 'y1', 'x2', 'y2'].every((k) => Math.abs(a[k] - b[k]) < 0.004); }

/**
 * st: { cv, ghost, mode, range, drag (0|1|2), sel (1|2), now (ms | null), avg (units/s of the segment), unit }
 */
function draw(canvas, st) {
  const { c, W, H } = prep(canvas);
  const { cv, mode } = st;
  const range = st.range || (mode === 'speed' ? speedRange(cv) : valueRange(cv));
  const g = geom(W, H, range);
  const acc = css('--accent', '#ff6f59'), fg = css('--text-1', '#eee'), dim = css('--text-3', '#777'), line = css('--line-strong', 'rgba(255,255,255,.16)'), soft = css('--accent-soft', 'rgba(255,111,89,.15)');
  // grid: quarters in time; 0 / 1 (value) or 0 / average (speed)
  c.lineWidth = 1; c.strokeStyle = line; c.setLineDash([2, 4]); c.beginPath();
  for (const x of [0.25, 0.5, 0.75]) { c.moveTo(Math.round(g.X(x)) + 0.5, g.y0); c.lineTo(Math.round(g.X(x)) + 0.5, g.y1); }
  for (const v of mode === 'speed' ? [1] : [0, 1]) { if (v < range.lo || v > range.hi) continue; c.moveTo(g.x0, Math.round(g.Y(v)) + 0.5); c.lineTo(g.x1, Math.round(g.Y(v)) + 0.5); }
  c.stroke(); c.setLineDash([]);
  c.fillStyle = dim; c.font = '9px sans-serif';
  if (mode === 'speed') {
    c.strokeStyle = line; c.beginPath(); c.moveTo(g.x0, Math.round(g.Y(0)) + 0.5); c.lineTo(g.x1, Math.round(g.Y(0)) + 0.5); c.stroke();
    c.fillText(st.avg ? `avg ${fmtSpeed(st.avg, st.unit)}` : 'avg', g.x0 + 2, g.Y(1) - 3);
  } else { c.fillText('100%', g.x0 + 2, g.Y(1) - 3); }
  const path = (curve, fn) => { c.beginPath(); for (let i = 0; i <= 90; i++) { const t = i / 90; const p = fn(curve, t); if (i) c.lineTo(g.X(p[0]), g.Y(clamp(p[1], range.lo, range.hi))); else c.moveTo(g.X(p[0]), g.Y(clamp(p[1], range.lo, range.hi))); } };
  const valueFn = (curve, t) => { const p = BZ.point(curve, t); return [p.x, p.y]; };
  const speedFn = (curve, t) => [t, BZ.speedAt(curve, t)];
  const fn = mode === 'speed' ? speedFn : valueFn;
  // ghost: what is on the keys now
  if (st.ghost && !samePt(st.ghost, cv)) { c.strokeStyle = dim; c.lineWidth = 1.5; c.setLineDash([4, 4]); path(st.ghost, fn); c.stroke(); c.setLineDash([]); }
  // area under the speed curve (distance travelled) / the value curve
  if (mode === 'speed') { path(cv, fn); c.lineTo(g.X(1), g.Y(clamp(0, range.lo, range.hi))); c.lineTo(g.X(0), g.Y(clamp(0, range.lo, range.hi))); c.closePath(); c.fillStyle = soft; c.fill(); }
  // handles
  const hs = handles(cv, mode, g);
  c.strokeStyle = dim; c.lineWidth = 1.2; c.beginPath();
  for (const p of hs) { c.moveTo(p.ax, p.ay); c.lineTo(p.x, p.y); }
  c.stroke();
  // curve
  c.strokeStyle = acc; c.lineWidth = 2.5; c.lineJoin = 'round'; path(cv, fn); c.stroke();
  c.fillStyle = acc; for (const p of hs) { c.beginPath(); c.arc(p.ax, p.ay, 3.2, 0, Math.PI * 2); c.fill(); }
  for (const p of hs) {
    const active = st.drag === p.k, sel = st.sel === p.k;
    c.fillStyle = active ? acc : fg; c.beginPath(); c.arc(p.x, p.y, active ? 7 : 6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = acc; c.lineWidth = sel ? 3 : 2; c.stroke();
  }
  // live readout next to the handle being dragged / nudged
  const k = st.drag || st.nudge;
  if (k) {
    const s = keySpeeds(cv);
    const inf = k === 1 ? cv.x1 * 100 : (1 - cv.x2) * 100, sp = k === 1 ? s.out : s.in;
    const txt = `${k === 1 ? 'Out' : 'In'} ${inf.toFixed(0)}% · ${st.avg ? fmtSpeed(sp * st.avg, st.unit) : `speed ${sp.toFixed(2)}×`}`;
    const p = hs[k - 1];
    c.font = '11px sans-serif'; const w = c.measureText(txt).width + 10;
    const bx = clamp(p.x - w / 2, 2, W - w - 2), by = p.y > g.y0 + 26 ? p.y - 26 : p.y + 12;
    c.fillStyle = css('--bg-raised', '#2a2a2a'); c.strokeStyle = acc; c.lineWidth = 1; c.beginPath(); c.rect(bx, by, w, 18); c.fill(); c.stroke();
    c.fillStyle = fg; c.fillText(txt, bx + 5, by + 13);
  }
  // spacing chart: where the layer is at 13 equal steps of time + the ball
  const vr = valueRange(cv), tx = (v) => g.x0 + (v - Math.min(0, vr.lo + 0.12)) / (Math.max(1, vr.hi - 0.12) - Math.min(0, vr.lo + 0.12)) * (g.x1 - g.x0);
  c.strokeStyle = line; c.lineWidth = 1; c.beginPath(); c.moveTo(tx(0), g.tY + 0.5); c.lineTo(tx(1), g.tY + 0.5); c.stroke();
  c.fillStyle = dim; for (let i = 0; i <= 12; i++) { const x = tx(BZ.valueAt(cv, i / 12)); c.fillRect(Math.round(x), g.tY - 5, 1.5, 10); }
  const t = st.now == null ? null : ((st.now / 1000) % 2) / 1.5;
  if (t !== null && t <= 1) {
    c.fillStyle = acc; c.beginPath(); c.arc(tx(BZ.valueAt(cv, t)), g.tY, 5, 0, Math.PI * 2); c.fill();
    c.fillRect(Math.round(g.X(t)), g.y0, 1, g.y1 - g.y0);
  }
  canvas.setAttribute('data-h', hs.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(','));
  return g;
}

/* ---------- widget ---------- */
/**
 * opts: { get(): curve, ghost(): curve|null, mode, height, link, onCommit(curve), onHeight(px), onMode(mode) }
 * Drags redraw this canvas only; onCommit runs on release (the shell defers renders during a press).
 */
function widget(opts) {
  const S = { cv: Object.assign({}, opts.get()), drag: 0, sel: opts.sel || 1, nudge: 0, range: null };
  const units = () => (opts.units ? opts.units() : {});
  const mode = opts.mode === 'speed' ? 'speed' : 'value';
  const canvas = h('canvas', { class: 'kit-graph', tabindex: '0', role: 'application', 'aria-label': `Ease graph (${mode}) — drag a handle; arrows nudge; Enter applies`, title: 'Drag a handle (Shift: flat · Ctrl: snap) · double-click: reset it\nArrows nudge the last handle (Shift ×5) · Enter: apply' });
  canvas.setAttribute('data-fresh', '');
  canvas.style.height = `${opts.height || 150}px`;
  let timer = null;
  const paint = (now = null) => draw(canvas, Object.assign({ cv: S.cv, ghost: opts.ghost(), mode, range: S.range, drag: S.drag, sel: S.sel, nudge: S.nudge, now }, units()));
  const at = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, W: r.width, H: r.height }; };
  const near = (p) => { const g = geom(p.W, p.H, S.range || (mode === 'speed' ? speedRange(S.cv) : valueRange(S.cv))); const hs = handles(S.cv, mode, g); const d = hs.map((q) => Math.hypot(p.x - q.x, p.y - q.y)); const k = d[0] <= d[1] ? 1 : 2; return { k, d: Math.min(d[0], d[1]), g }; };
  const mirror = (c, k) => (opts.link ? (k === 1 ? Object.assign(c, { x2: r3(1 - c.x1), y2: r3(1 - c.y1) }) : Object.assign(c, { x1: r3(1 - c.x2), y1: r3(1 - c.y2) })) : c);
  function moveTo(k, gx, gy, e) {
    let x = clamp(gx, BZ.X_MIN, BZ.X_MAX), y = gy;
    if (e && (e.ctrlKey || e.metaKey)) { x = clamp(Math.round(x * 20) / 20, BZ.X_MIN, BZ.X_MAX); y = mode === 'speed' ? Math.round(y * 4) / 4 : Math.round(y * 20) / 20; }
    if (mode === 'speed') { if (e && e.shiftKey) y = 0; S.cv = mirror(fromSpeed(S.cv, k, x, y), k); return; }
    y = clamp(y, BZ.Y_MIN, BZ.Y_MAX);
    if (e && e.shiftKey) y = k === 1 ? 0 : 1; // Motion 4: Shift = flat handle (speed 0)
    if (k === 1) { S.cv.x1 = r3(x); S.cv.y1 = r3(y); } else { S.cv.x2 = r3(x); S.cv.y2 = r3(y); }
    mirror(S.cv, k);
  }
  const commit = () => { clearTimeout(timer); S.nudge = 0; S.range = null; opts.onCommit(Object.assign({}, S.cv)); };
  canvas.addEventListener('pointerdown', (e) => {
    const p = at(e), n = near(p);
    if (n.d > 30) return;
    S.drag = n.k; S.sel = n.k; S.range = mode === 'speed' ? speedRange(S.cv) : valueRange(S.cv); // range frozen while dragging
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* older CEP */ }
    e.preventDefault(); paint();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!S.drag) { const n = near(at(e)); canvas.style.cursor = n.d <= 30 ? 'grab' : 'default'; return; }
    const p = at(e), g = geom(p.W, p.H, S.range);
    moveTo(S.drag, g.ix(p.x), g.iy(p.y), e);
    paint();
    if (opts.onLive) opts.onLive(S.cv);
  });
  const up = () => { if (!S.drag) return; S.drag = 0; commit(); };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('dblclick', (e) => {
    const n = near(at(e));
    if (n.d > 30) return;
    if (n.k === 1) { S.cv.x1 = 0.333; S.cv.y1 = 0; } else { S.cv.x2 = 0.667; S.cv.y2 = 1; }
    commit();
  });
  canvas.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 5 : 1;
    const k = S.sel;
    const cur = mode === 'speed' ? { x: k === 1 ? S.cv.x1 : S.cv.x2, y: keySpeeds(S.cv)[k === 1 ? 'out' : 'in'] } : { x: k === 1 ? S.cv.x1 : S.cv.x2, y: k === 1 ? S.cv.y1 : S.cv.y2 };
    const dy = mode === 'speed' ? 0.05 : 0.01;
    const move = { ArrowLeft: [-0.01, 0], ArrowRight: [0.01, 0], ArrowUp: [0, dy], ArrowDown: [0, -dy] }[e.key];
    if (move) {
      e.preventDefault(); e.stopPropagation();
      moveTo(k, cur.x + move[0] * step, cur.y + move[1] * step, null);
      S.nudge = k; paint();
      clearTimeout(timer);
      if (opts.autoApply) timer = setTimeout(commit, 700);
    } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commit(); } else if (e.key === 'Tab' && !e.shiftKey && S.sel === 1) { e.preventDefault(); S.sel = 2; paint(); }
  });
  // resize grip
  const grip = h('div', { class: 'kit-grip', role: 'separator', 'aria-label': 'Resize the graph', title: 'Drag to resize the graph' });
  grip.setAttribute('data-fresh', '');
  grip.addEventListener('pointerdown', (e) => {
    const y0 = e.clientY, h0 = canvas.clientHeight;
    try { grip.setPointerCapture(e.pointerId); } catch (_) { /* older CEP */ }
    const mv = (ev) => { canvas.style.height = `${clamp(h0 + ev.clientY - y0, 100, 360)}px`; paint(); };
    const done = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', done); grip.removeEventListener('pointercancel', done); if (opts.onHeight) opts.onHeight(canvas.clientHeight); };
    grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', done); grip.addEventListener('pointercancel', done);
    e.preventDefault();
  });
  return { canvas, grip, paint, state: S, set(cv) { S.cv = Object.assign({}, cv); paint(); } };
}

/**
 * Overview of the whole selected animation (all segments, real speed over real time). The segment
 * being edited (the first) shows the new curve; the others show what is on the keys now.
 * segs: [{ t0, t1, avg, curve, hold }], cv: the curve being edited (applied to every segment).
 */
function overviewSamples(segs, cv, applyAll) {
  const out = [];
  segs.forEach((s, i) => {
    const curve = applyAll || i === 0 ? cv : s.curve;
    for (let j = 0; j <= 24; j++) { const u = j / 24; out.push({ t: s.t0 + u * (s.t1 - s.t0), v: s.hold ? 0 : BZ.speedAt(curve, u) * s.avg, seg: i }); }
  });
  return out;
}
function drawOverview(canvas, segs, cv, unit) {
  const { c, W, H } = prep(canvas);
  if (!segs || segs.length < 2) return;
  const pts = overviewSamples(segs, cv, true);
  const t0 = segs[0].t0, t1 = segs[segs.length - 1].t1, vmax = Math.max(1e-6, ...pts.map((p) => Math.abs(p.v)));
  const X = (t) => 8 + (t - t0) / (t1 - t0) * (W - 16), Y = (v) => H - 6 - Math.max(0, v) / vmax * (H - 22); // top 16 px: labels
  const acc = css('--accent', '#ff6f59'), dim = css('--text-3', '#777'), line = css('--line-strong', 'rgba(255,255,255,.16)'), soft = css('--accent-soft', 'rgba(255,111,89,.15)');
  c.strokeStyle = line; c.lineWidth = 1; c.beginPath(); c.moveTo(8, H - 5.5); c.lineTo(W - 8, H - 5.5);
  segs.forEach((s) => { c.moveTo(Math.round(X(s.t0)) + 0.5, 15); c.lineTo(Math.round(X(s.t0)) + 0.5, H - 5); });
  c.moveTo(Math.round(X(t1)) + 0.5, 15); c.lineTo(Math.round(X(t1)) + 0.5, H - 5); c.stroke();
  c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(X(p.t), Y(p.v)) : c.moveTo(X(p.t), Y(p.v)))); c.lineTo(X(t1), Y(0)); c.lineTo(X(t0), Y(0)); c.closePath(); c.fillStyle = soft; c.fill();
  c.strokeStyle = acc; c.lineWidth = 1.6; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(X(p.t), Y(p.v)) : c.moveTo(X(p.t), Y(p.v)))); c.stroke();
  c.fillStyle = dim; c.font = '9px sans-serif'; c.fillText(`peak ${fmtSpeed(vmax, unit)}`, 10, 11);
  c.textAlign = 'right'; c.fillText(`${segs.length} segments · ${(t1 - t0).toFixed(2)} s`, W - 10, 11); c.textAlign = 'left';
}

module.exports = { keySpeeds, fromSpeed, valueRange, speedRange, parseCurve, geom, handles, draw, widget, fmtSpeed, overviewSamples, drawOverview };
