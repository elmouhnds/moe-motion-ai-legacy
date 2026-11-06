'use strict';
/**
 * Canvas thumbnails for Studio tiles. Each recipe draws one frame at time t (seconds);
 * the shared loop in widgets.js animates the visible ones and stops when they unmount.
 */
const L = require('../../../features/grid/layouts');
const GX = require('../../../features/grid/expressions');
const { LOOKS } = require('../../../features/glass/tools');
const { thickValues } = require('../../../features/glass/thick');
const { hexToRgb } = require('../../../features/brand/brands');
const PAL = require('../../../features/design/palettes');
// v0.47 (docs/features/REAL_PREVIEWS.md): Animate / Trim previews play the keys the tool writes (same timing, ease, overshoot)
const PLAN = require('../../../features/quick/animatePlan');
// v0.49 (docs/features/TEMPLATES.md): template previews draw the tool's own layout and keys
const TPL = require('../../../features/design/templates');
// v0.53 (docs/features/GUIDE_PRESETS.md): guide-preset tiles draw the preset's own lines
const GPR = require('../../../features/grid/guidePresets');

// Theme-aware ink (light AE brightness → dark ink). Refreshed once per drawn frame.
let ACC = '#ff7a59';
let FG = '#e6e6e6';
let DIM = 'rgba(230,230,230,0.28)';
function theme() {
  if (typeof getComputedStyle !== 'function') return;
  const cs = getComputedStyle(document.documentElement);
  ACC = cs.getPropertyValue('--accent').trim() || ACC;
  FG = cs.getPropertyValue('--text-2').trim() || FG;
  DIM = cs.getPropertyValue('--line-strong').trim() || DIM;
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const eOut = (p) => 1 - Math.pow(1 - p, 3);
const eBack = (p) => 1 + 2.70158 * Math.pow(p - 1, 3) + 1.70158 * Math.pow(p - 1, 2);
/** 0 → 1 over the cycle with holds: start 0.35 s, play `dur`, hold end. */
function phase(t, dur = 1.1, cycle = 2.4) { return clamp01(((t % cycle) - 0.35) / dur); }

function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

/**
 * The tool's keys and the local time to play them at: wait 0.35 s, play the keys at their real speed, hold the end,
 * loop. A still frame (no animation) shows the rest pose of an In and the start of an Out.
 */
/** v0.60: the MOE cursor glyph (the same outline shapes.cursor draws in AE), its tip at (x, y). */
function pointer(c, x, y, s, hand) {
  const pts = hand ? [[-2.5, 0], [2.5, 0], [3.2, 12], [9.5, 12.3], [17.6, 13.6], [18.6, 24], [15.6, 31], [3.5, 31], [-7.4, 15.6], [-3.2, 14.2]] : [[0, 0], [0, 26], [6.5, 20], [11, 30], [15, 28.2], [10.6, 18.6], [19, 18.6]];
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1.4 / Math.max(s, 0.1); c.beginPath();
  pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); c.fill(); c.stroke(); c.restore();
}
function planOf(th, t) {
  const args = Object.assign({}, th.args || {});
  return { args, at: (end) => (th.still ? (th.dir === 'out' || args.dir === 'out' ? 0 : end) : (t % (0.35 + end + 0.9)) - 0.35) };
}
const animArgs = (th, kind) => Object.assign({ kind, dir: th.dir || 'in', overshoot: !!th.over }, th.args || {});
/** v0.48: the "Also fade" opacity at local time lt (1 when the move has no fade). */
const fadeAt = (a, lt) => { const f = PLAN.fade(a, { opacity: 100 }); return f ? clamp01(PLAN.valueAt(f.keys, lt) / 100) : 1; };
/** v0.58: the plan's Blur at local time lt as a canvas filter (comp pixels → tile pixels; 'none' without blur). */
const blurAt = (a, lt, W) => { const b = PLAN.blur(a); const px = b ? PLAN.valueAt(b.keys, lt) * (W / 1920) * 2.2 : 0; return px > 0.05 ? `blur(${px.toFixed(2)}px)` : 'none'; };
const SHK = require('../../../features/quick/shakePlan');
const DRAW = {
  // v0.59: a shake plays the plan's own keys (offsets in comp px / %, eased like After Effects) on a card
  shake(c, W, H, th, t) {
    const p = SHK.plan(th.type, th.args || {});
    const loop = p.end + 0.9, lt = th.still ? p.end * 0.1 : (t % loop) - 0.3;
    const k = W / 640;
    const d = p.position ? SHK.valueAt(p.position, lt) : [0, 0], ds = p.scale ? SHK.valueAt(p.scale, lt) : 0, dr = p.rotation ? SHK.valueAt(p.rotation, lt) : 0;
    const bw = W * 0.38, bh = H * 0.34;
    c.setLineDash([3, 3]); c.strokeStyle = DIM; rrect(c, W / 2 - bw / 2, H / 2 - bh / 2, bw, bh, 5); c.stroke(); c.setLineDash([]);
    c.save(); c.translate(W / 2 + d[0] * k, H / 2 + d[1] * k); c.rotate(dr * Math.PI / 180); const sc = 1 + ds / 100; c.scale(sc, sc);
    c.fillStyle = FG; rrect(c, -bw / 2, -bh / 2, bw, bh, 5); c.fill(); c.restore();
  },
  // v0.59: a style on a card — the shadow, glow or sweep the effect gives (drawn with the canvas' own shadow / gradient)
  style(c, W, H, th, t) {
    const bw = W * 0.46, bh = H * 0.44, x = W / 2 - bw / 2, y = H / 2 - bh / 2 - H * 0.04;
    c.save();
    if (th.style === 'softShadow' || th.style === 'deepShadow') { const deep = th.style === 'deepShadow'; c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = deep ? 26 : 12; c.shadowOffsetY = deep ? 14 : 6; }
    if (th.style === 'glow') { c.shadowColor = ACC; c.shadowBlur = 18 + 6 * Math.sin(t * 2); }
    c.fillStyle = th.style === 'glow' ? ACC : '#f4f4f6'; rrect(c, x, y, bw, bh, 7); c.fill(); c.restore();
    if (th.style === 'lightSweep') {
      const u = ((t % 2.4) / 1.2), sx = x - bw * 0.3 + bw * 1.6 * Math.min(1, Math.max(0, u * u * (3 - 2 * u)));
      c.save(); rrect(c, x, y, bw, bh, 7); c.clip();
      const g = c.createLinearGradient(sx - 18, 0, sx + 18, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = '#c9c9d1'; c.fillRect(x, y, bw, bh); c.fillStyle = g; c.translate(sx, y + bh / 2); c.rotate(-0.4); c.fillRect(-18, -bh, 36, bh * 2); c.restore();
    }
    c.fillStyle = 'rgba(20,20,24,0.55)'; c.fillRect(x + bw * 0.14, y + bh * 0.3, bw * 0.5, Math.max(2, bh * 0.1)); c.fillRect(x + bw * 0.14, y + bh * 0.55, bw * 0.34, Math.max(2, bh * 0.08));
  },
  move(c, W, H, th, t) {
    if (th.args) {
      // the plan in tile units: rest at the centre, "away" one box-and-a-half off in the move's direction
      const bw = W * 0.36, bh = H * 0.28;
      const a = animArgs(th, 'moveRL');
      const pl = PLAN.animate(a, { position: [0, 0], offset: [th.dx * W * 0.75, th.dy * H * 0.8] });
      const lt = planOf(th, t).at(PLAN.endOf(pl.keys));
      const v = PLAN.valueAt(pl.keys, lt);
      c.fillStyle = DIM; rrect(c, W / 2 - bw / 2, H / 2 - bh / 2, bw, bh, 4); c.setLineDash([3, 3]); c.strokeStyle = DIM; c.stroke(); c.setLineDash([]);
      c.globalAlpha = fadeAt(a, lt); c.filter = blurAt(a, lt, W);
      c.fillStyle = FG; rrect(c, W / 2 - bw / 2 + v[0], H / 2 - bh / 2 + v[1], bw, bh, 4); c.fill(); c.globalAlpha = 1; c.filter = 'none';
      return;
    }
    const p = eOut(phase(t));
    const k = th.dir === 'in' ? 1 - p : p;
    const bw = W * 0.36, bh = H * 0.28;
    const x = W / 2 - bw / 2 + th.dx * k * W * 0.75, y = H / 2 - bh / 2 + th.dy * k * H * 0.8;
    c.fillStyle = DIM; rrect(c, W / 2 - bw / 2, H / 2 - bh / 2, bw, bh, 4); c.setLineDash([3, 3]); c.strokeStyle = DIM; c.stroke(); c.setLineDash([]);
    c.fillStyle = FG; rrect(c, x, y, bw, bh, 4); c.fill();
  },
  fade(c, W, H, th, t) {
    if (th.args) {
      const fa = animArgs(th, 'fade'), pl = PLAN.animate(fa, { opacity: 100 }), flt = planOf(th, t).at(PLAN.endOf(pl.keys));
      c.globalAlpha = clamp01(PLAN.valueAt(pl.keys, flt) / 100); c.filter = blurAt(fa, flt, W);
      c.fillStyle = FG; rrect(c, W * 0.3, H * 0.34, W * 0.4, H * 0.32, 4); c.fill(); c.globalAlpha = 1; c.filter = 'none';
      return;
    }
    const p = eOut(phase(t));
    c.globalAlpha = th.dir === 'in' ? p : 1 - p;
    c.fillStyle = FG; rrect(c, W * 0.3, H * 0.34, W * 0.4, H * 0.32, 4); c.fill(); c.globalAlpha = 1;
  },
  scale(c, W, H, th, t) {
    let s;
    let alpha = 1, flt = 'none';
    if (th.args) { const a = animArgs(th, 'scale'), pl = PLAN.animate(a, { scale: [100, 100] }), lt = planOf(th, t).at(PLAN.endOf(pl.keys)); s = Math.max(0, PLAN.valueAt(pl.keys, lt)[0] / 100); alpha = fadeAt(a, lt); flt = blurAt(a, lt, W); } else {
      const ph = phase(t);
      s = th.dir === 'in' ? (th.over ? Math.max(0, eBack(ph)) : eOut(ph)) : 1 - eOut(ph);
    }
    const bw = W * 0.34 * s, bh = H * 0.42 * s;
    // the full size as a dashed ghost (like move): shows where the scale starts or ends
    c.setLineDash([3, 3]); c.strokeStyle = DIM; rrect(c, W / 2 - W * 0.17, H / 2 - H * 0.21, W * 0.34, H * 0.42, 4); c.stroke(); c.setLineDash([]);
    c.globalAlpha = alpha; c.filter = flt; c.fillStyle = FG; rrect(c, W / 2 - bw / 2, H / 2 - bh / 2, Math.max(bw, 0.1), Math.max(bh, 0.1), 4); c.fill(); c.globalAlpha = 1; c.filter = 'none';
  },
  spin(c, W, H, th, t) {
    let ang;
    let alpha = 1;
    if (th.args) { const a = animArgs(th, 'spin'), pl = PLAN.animate(a, { rotation: 0 }), lt = planOf(th, t).at(PLAN.endOf(pl.keys)); ang = PLAN.valueAt(pl.keys, lt) * Math.PI / 180; alpha = fadeAt(a, lt); } else ang = (1 - eBack(phase(t))) * -Math.PI;
    c.globalAlpha = alpha;
    c.save(); c.translate(W / 2, H / 2); c.rotate(ang); c.fillStyle = FG; rrect(c, -W * 0.15, -H * 0.2, W * 0.3, H * 0.4, 4); c.fill(); c.restore(); c.globalAlpha = 1;
  },
  trim(c, W, H, th, t) {
    let a = 0, b = 1;
    if (th.args) {
      // Trim Paths keys (Start / End %) from the plan, played at their real times
      const pl = PLAN.trim(Object.assign({ mode: th.mode }, th.args));
      const lt = planOf(Object.assign({}, th, { dir: th.mode === 'erase' ? 'out' : 'in' }), t).at(PLAN.endOf(pl.start, pl.end));
      if (pl.start) a = PLAN.valueAt(pl.start, lt) / 100;
      if (pl.end) b = PLAN.valueAt(pl.end, lt) / 100;
      if (th.still && th.mode === 'drawErase') { a = 0; b = 1; }
    } else {
      const ph = phase(t, 1.4, 2.8);
      if (th.mode === 'draw') b = eOut(ph);
      if (th.mode === 'erase') a = eOut(ph);
      if (th.mode === 'travel') { b = clamp01(eOut(ph) * 1.5); a = clamp01(eOut(ph) * 1.5 - 0.5); }
      if (th.mode === 'drawErase') { b = clamp01(ph * 2); a = clamp01(ph * 2 - 1); }
    }
    const pts = []; for (let i = 0; i <= 60; i++) { const u = i / 60; pts.push([W * (0.12 + 0.76 * u), H * (0.62 - 0.3 * Math.sin(u * Math.PI * 1.5))]); }
    c.strokeStyle = DIM; c.lineWidth = 1; c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke();
    c.strokeStyle = ACC; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath();
    let started = false;
    pts.forEach((q, i) => { const u = i / 60; if (u >= a && u <= b) { if (!started) { c.moveTo(q[0], q[1]); started = true; } else c.lineTo(q[0], q[1]); } });
    c.stroke(); c.lineWidth = 1;
  },
  ease(c, W, H, th, t) {
    const x0 = W * 0.15, y0 = H * 0.82, x1 = W * 0.85, y1 = H * 0.18;
    const c1 = [x0 + (x1 - x0) * th.a, y0], c2 = [x1 - (x1 - x0) * th.b, y1];
    c.strokeStyle = DIM; c.beginPath(); c.moveTo(x0, y0); c.lineTo(c1[0], c1[1]); c.moveTo(x1, y1); c.lineTo(c2[0], c2[1]); c.stroke();
    c.strokeStyle = FG; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, y0); c.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], x1, y1); c.stroke(); c.lineWidth = 1;
    const u = phase(t, 1.2), v = 1 - u;
    const bx = v * v * v * x0 + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * x1, by = v * v * v * y0 + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * y1;
    c.fillStyle = ACC; c.beginPath(); c.arc(bx, by, 3.5, 0, Math.PI * 2); c.fill();
  },
  stagger(c, W, H, th, t) {
    if (th.args) {
      // Cascade: the same Quick Animate keys per layer, each one `stagger` later (selection order) — four layers
      const a = Object.assign({ kind: 'moveBT', dir: 'in' }, th.args), n = 4, lag = a.stagger || 0;
      const moveY = a.distance ? Math.min(H * 0.3, a.distance / 1080 * H * 2) : H * 0.6;
      const pl = PLAN.animate(a, { position: [0, 0], offset: /^move/.test(a.kind) ? [0, moveY * (a.kind === 'moveTB' ? -1 : 1)] : [0, 0], opacity: 100 });
      const lt = planOf(th, t).at(PLAN.endOf(pl.keys) + lag * (n - 1));
      for (let i = 0; i < n; i++) {
        const v = PLAN.valueAt(pl.keys, lt - i * lag);
        const dy = Array.isArray(v) ? v[1] : 0;
        c.globalAlpha = Array.isArray(v) ? 1 : clamp01(v / 100);
        c.fillStyle = i === 0 ? ACC : FG; rrect(c, W * 0.18, H * (0.18 + i * 0.17) + dy, W * 0.64, H * 0.11, 3); c.fill();
      }
      c.globalAlpha = 1;
      return;
    }
    for (let i = 0; i < 4; i++) { const p = eOut(clamp01((phase(t, 1.6, 2.8) - i * 0.15) / 0.55)); c.globalAlpha = p; c.fillStyle = i === 0 ? ACC : FG; rrect(c, W * 0.18 + (1 - p) * -16, H * (0.18 + i * 0.17), W * 0.64, H * 0.11, 3); c.fill(); }
    c.globalAlpha = 1;
  },
  prox(c, W, H, th, t) {
    const ex = W * (0.5 + 0.35 * Math.sin(t * 1.3)), ey = H * (0.5 + 0.25 * Math.cos(t * 1.7));
    for (let r = 0; r < 4; r++) for (let q = 0; q < 6; q++) {
      const x = W * (0.12 + q * 0.152), y = H * (0.2 + r * 0.2);
      const d = Math.hypot(x - ex, y - ey), w = clamp01(1 - d / (W * 0.35));
      const ww = w * w * (3 - 2 * w);
      let px = x, py = y, s = 4;
      if (th.mode === 'grow') s = 4 + ww * 6;
      else if (d > 0.1) { px += ((x - ex) / d) * ww * 12; py += ((y - ey) / d) * ww * 12; }
      c.fillStyle = ww > 0.3 ? ACC : FG; c.beginPath(); c.arc(px, py, s, 0, Math.PI * 2); c.fill();
    }
    c.strokeStyle = ACC; c.beginPath(); c.arc(ex, ey, 6, 0, Math.PI * 2); c.stroke();
  },
  grid(c, W, H, th, t) {
    // v0.37: Points = one clone on each corner of a hexagon; In Place (Text Cloner) = the words / letters of a title
    const WORDS = th.text === 'letters' ? [16, 16, 16, 16, 0, 16, 16, 16, 16, 16] : [64, 30, 58];
    const n = th.text ? WORDS.filter((w) => w).length : th.mode === 'points' ? 6 : th.row ? 8 : th.mode === 'phyllo' ? 34 : th.mode === 'sphere' ? 40 : th.mode === 'spiral' && th.clone ? 20 : 12;
    const p = Object.assign(GX.defaultParams(th.mode), { columns: th.row ? 8 : 4, spacingX: 52, spacingY: 40, radius: th.mode === 'spiral' ? 10 : 70, arc: th.arc || 360, rowOffset: th.rowOffset || 0, spread: 13, spiralStep: 6, angleStep: 32, ringSpacing: 30, sphereSpin: t * 25, faceCenter: th.mode !== 'rect', buildStyle: 4, buildOrder: 3, buildStagger: 70 });
    p.build = th.build ? clamp01(phase(t, 1.6, 2.8)) * 100 : 100;
    if (th.mode === 'path') p.path = { point: (u) => [-110 + 220 * u, 30 - 60 * Math.sin(u * Math.PI)], tangent: (u) => [220, -60 * Math.PI * Math.cos(u * Math.PI)] };
    if (th.mode === 'points') p.vertices = Array.from({ length: 6 }, (_, j) => [62 * Math.cos((j * 60 - 90) * Math.PI / 180), 62 * Math.sin((j * 60 - 90) * Math.PI / 180)]);
    const widths = [];
    if (th.text) {
      const gap = th.text === 'letters' ? 4 : 12, total = WORDS.reduce((a, w) => a + (w || 14) + gap, -gap);
      let x = -total / 2; p.homes = [];
      WORDS.forEach((w) => { if (w) { p.homes.push([x + w / 2, 0]); widths.push(w); } x += (w || 14) + gap; });
      if (th.bs) p.buildStyle = th.bs;
      p.buildDistance = 40; p.faceCenter = false; p.orient = 1;
    }
    const k = Math.min(W / 260, H / 160);
    const pts = L.place(p, n).map((it) => Object.assign(it, { m: L.modifiers(p, it, n) }));
    if (th.mode === 'sphere') pts.sort((a, b) => a.z - b.z);
    for (const it of pts) {
      const depth = th.mode === 'sphere' ? (it.z / p.radius + 1) / 2 : 0;
      const s = it.m.scale * (th.mode === 'sphere' ? 1 - depth * 0.5 : 1) * (n > 20 ? 0.45 : 1);
      c.save(); c.translate(W / 2 + (it.x + it.m.dx) * k, H / 2 + (it.y + it.m.dy) * k); c.rotate((it.m.rot * Math.PI) / 180);
      c.globalAlpha = clamp01(it.m.opacity) * (th.mode === 'sphere' ? 1 - depth * 0.6 : 1);
      c.fillStyle = it.i === 0 ? ACC : FG;
      if (th.text) { const w = widths[it.i]; c.fillStyle = it.i === 0 ? ACC : FG; rrect(c, -w / 2 * k * s, -14 * k * s, w * k * s, 28 * k * s, 3); c.fill(); }
      else if (th.clone) { c.beginPath(); c.arc(0, 0, 11 * k * s, 0, Math.PI * 2); c.fill(); } else rrect(c, -16 * k * s, -11 * k * s, 32 * k * s, 22 * k * s, 2), c.fill();
      c.restore();
    }
    c.globalAlpha = 1;
    if (th.mode === 'points') { c.strokeStyle = ACC; c.lineWidth = 1.2; c.setLineDash([3, 3]); c.beginPath(); p.vertices.forEach((v, j) => (j ? c.lineTo : c.moveTo).call(c, W / 2 + v[0] * k, H / 2 + v[1] * k)); c.closePath(); c.stroke(); c.setLineDash([]); }
  },
  /* v0.41: a square moving along a curve, its copies replaying the motion later (features/grid/trail.js) */
  trail(c, W, H, th, t) {
    const TR = require('../../../features/grid/trail');
    const k = Math.min(W / 260, H / 160), fd = 1 / 30;
    const src = (tt) => { const u = ((tt % 3) + 3) % 3 / 3, a = u * Math.PI * 2; return { position: [W / 2 + Math.cos(a) * 80 * k, H / 2 + Math.sin(a * 2) * 34 * k], scale: [100, 100], rotation: a * 57.3, opacity: 100 }; };
    const cc = { delay: th.delay * 2, fade: th.fade, scaleStep: th.scaleStep || 0, rotateStep: th.rotateStep || 0 };
    for (let i = th.copies; i >= 0; i--) {
      const s = TR.at(i, src, cc, t, fd), sz = 22 * k * s.scale[0] / 100;
      c.save(); c.translate(s.position[0], s.position[1]); c.rotate((th.rotateStep ? s.rotation : 0) * Math.PI / 180);
      c.globalAlpha = Math.max(0, Math.min(1, s.opacity / 100)); c.fillStyle = i === 0 ? ACC : FG;
      rrect(c, -sz / 2, -sz / 2, sz, sz, 3); c.fill(); c.restore();
    }
    c.globalAlpha = 1;
  },
  /* v0.33: an effector passing over a grid of cards (the real maths: features/grid/effectors.js) */
  eff(c, W, H, th, t) {
    const EF = require('../../../features/grid/effectors');
    const cols = 7, rows = 4, sx = 34, sy = 32, n = cols * rows, k = Math.min(W / 260, H / 160);
    // v0.35 spring tiles: move, hold, move back, hold — so the overshoot and settle show at each stop
    const exAt = (tt) => { if (!th.spring) { const sw = (Math.sin((tt / 3) * Math.PI * 2 - Math.PI / 2) + 1) / 2; return -150 + 300 * sw; } const u = ((tt % 5) + 5) % 5, ss = (v) => v * v * (3 - 2 * v); return u < 1.2 ? -150 + 300 * ss(u / 1.2) : u < 2.5 ? 150 : u < 3.7 ? 150 - 300 * ss((u - 2.5) / 1.2) : -150; };
    const ex = exAt(t);
    const base = EF.valuesOf(Object.assign({ size: th.falloff === 'linear' ? 90 : th.falloff === 'noise' ? 45 : 75, softness: 60, scale: 0 }, th, { type: th.type, falloff: th.falloff }));
    const cyc = 2.4, at = (tt) => { if (th.type !== 'delay') return base; const u = Math.min(Math.max((((tt % cyc) + cyc) % cyc) / 0.6, 0), 1), f = 1 - u * u * (3 - 2 * u); return Object.assign({}, base, { moveX: base.moveX * f, moveY: base.moveY * f, scale: base.scale * f, rotate: base.rotate * f, fade: base.fade * f }); };
    const toLocal = (px, py) => [px - ex, py];
    for (let i = 0; i < n; i++) {
      const col = i % cols, row = Math.floor(i / cols), x = (col - (cols - 1) / 2) * sx, y = (row - (rows - 1) / 2) * sy;
      // v0.36: Target items face the effector; Audio follows a two-beat-a-second pulse (the real maths: applyAt)
      const live = th.spring || th.type === 'target' || th.type === 'audio' || th.falloff === 'noise' || th.falloff === 'image';
      const r = live
        ? EF.applyAt([{ at: () => Object.assign({}, base, { audioMax: 1 }), toLocal: (tt) => { const e = exAt(tt); return (px, py) => [px - e, py]; }, originAt: (tt) => [exAt(tt), 0], audioAt: (tt) => Math.pow(Math.max(0, Math.sin(tt * Math.PI * 4)), 3), lumaAt: (cx, cy, tt) => { const bx = Math.sin(tt * 0.9) * 70, d = Math.hypot(cx - bx, cy) / 70; return Math.max(0, 1 - d * d); } }], { i, k: i, n, x, y, compAt: () => [x, y], fd: 1 / 30, baseRotAt: () => 0 }, t)
        : EF.apply([{ values: at(t - i * 0.05), toLocal }], { i, k: i, n, x, y, cx: x, cy: y, time: t });
      const s = Math.max(0, r.scaleMul);
      c.save(); c.translate(W / 2 + (x + r.dx) * k, H / 2 + (y + r.dy) * k); c.rotate(r.rot * Math.PI / 180);
      c.globalAlpha = Math.min(Math.max(r.opMul, 0), 1);
      if (th.tint) { const lx = x - ex, w = EF.weight(Object.assign({}, base, { colourMix: 100 }), lx, y); c.fillStyle = w > 0.5 ? '#ffffff' : ACC; c.globalAlpha = 1; }
      else c.fillStyle = FG;
      if (th.type === 'target') { c.beginPath(); c.moveTo(12 * k * s, 0); c.lineTo(-9 * k * s, -8 * k * s); c.lineTo(-5 * k * s, 0); c.lineTo(-9 * k * s, 8 * k * s); c.closePath(); c.fill(); c.restore(); continue; }
      rrect(c, -11 * k * s, -9 * k * s, 22 * k * s, 18 * k * s, 2); c.fill(); c.restore();
    }
    c.globalAlpha = 1;
    if (th.type === 'target') { c.fillStyle = ACC; c.beginPath(); c.arc(W / 2 + ex * k, H / 2, 4, 0, Math.PI * 2); c.fill(); }
    if (th.falloff !== 'all' && th.falloff !== 'noise' && th.falloff !== 'image') {
      c.strokeStyle = ACC; c.lineWidth = 1.5; c.setLineDash([4, 3]); c.beginPath();
      if (th.falloff === 'linear') { c.moveTo(W / 2 + ex * k, 4); c.lineTo(W / 2 + ex * k, H - 4); } else c.arc(W / 2 + ex * k, H / 2, base.size * k, 0, Math.PI * 2);
      c.stroke(); c.setLineDash([]);
    }
  },
  /* v0.34: a ring of clones coloured by the real palette maths (Cycle / Gradient / Random) */
  cloneCol(c, W, H, th, t) {
    const EF = require('../../../features/grid/effectors');
    const PALS = { 1: 'tomato', 2: 'ocean', 3: 'candy' };
    const P = require('../../../features/design/palettes').byId(PALS[th.mode]).colors.slice(1, 5).map((h) => EF.rgba(h));
    const n = 12, k = Math.min(W / 260, H / 160), R = 52, spin = t * 12;
    for (let i = 0; i < n; i++) {
      const a = (-90 + i * 30 + spin) * Math.PI / 180, col = EF.paletteColour(th.mode, P, i, n, 3);
      c.fillStyle = `rgb(${col.slice(0, 3).map((v) => Math.round(v * 255)).join(',')})`;
      c.beginPath(); c.arc(W / 2 + Math.cos(a) * R * k, H / 2 + Math.sin(a) * R * k, 11 * k, 0, Math.PI * 2); c.fill();
    }
  },
  // v0.53: a guide preset in its own frame — the real lines from guidePresets.lines(); social zones on a phone,
  // with the areas the app covers shaded and its buttons / caption sketched where they really sit
  gpreset(c, W, H, th, t) {
    const P = GPR.byId(th.id); if (!P) return;
    const tall = !!P.social, ar = tall ? 9 / 16 : 16 / 9;
    let fh = H * (tall ? 0.9 : 0.74), fw = fh * ar;
    if (fw > W * 0.86) { fw = W * 0.86; fh = fw / ar; }
    const fx = (W - fw) / 2, fy = (H - fh) / 2, CW = tall ? 1080 : 1920, CH = tall ? 1920 : 1080, k = fw / CW;
    c.fillStyle = 'rgba(255,255,255,0.04)'; rrect(c, fx, fy, fw, fh, tall ? 6 : 3); c.fill();
    c.strokeStyle = DIM; c.lineWidth = 1; rrect(c, fx + 0.5, fy + 0.5, fw - 1, fh - 1, tall ? 6 : 3); c.stroke();
    const g = GPR.lines(th.id, CW, CH);
    const pulse = 0.55 + 0.45 * Math.sin(t * 2.2);
    if (g.box && P.social) {
      const b = g.box;
      c.save(); rrect(c, fx, fy, fw, fh, 6); c.clip();
      c.fillStyle = 'rgba(255,90,60,0.16)';
      c.fillRect(fx, fy, fw, b.y * k); c.fillRect(fx, fy + (b.y + b.h) * k, fw, fh - (b.y + b.h) * k);
      c.fillRect(fx + (b.x + b.w) * k, fy + b.y * k, fw - (b.x + b.w) * k, b.h * k);
      // the app's own furniture: buttons down the right, caption lines and a profile at the bottom
      c.fillStyle = 'rgba(255,255,255,0.55)';
      const bx = fx + fw - Math.max(5, (CW - b.x - b.w) * k * 0.5);
      for (let i = 0; i < (th.id === 'stories' ? 0 : 4); i++) { c.beginPath(); c.arc(bx, fy + fh * (0.52 + i * 0.075), Math.max(1.6, fw * 0.035), 0, Math.PI * 2); c.fill(); }
      const cy = fy + (b.y + b.h) * k + 5;
      c.fillRect(fx + fw * 0.08, cy, fw * 0.42, 2); c.fillRect(fx + fw * 0.08, cy + 5, fw * 0.6, 2);
      c.restore();
      c.setLineDash([3, 2]); c.strokeStyle = ACC; c.globalAlpha = pulse; c.lineWidth = 1.25;
      c.strokeRect(fx + b.x * k + 0.5, fy + b.y * k + 0.5, b.w * k - 1, b.h * k - 1); c.setLineDash([]); c.globalAlpha = 1;
      return;
    }
    if (th.id === 'clear') {
      c.strokeStyle = 'rgba(80,190,255,0.35)'; c.setLineDash([2, 3]);
      [0.33, 0.66].forEach((u) => { c.beginPath(); c.moveTo(fx + fw * u, fy); c.lineTo(fx + fw * u, fy + fh); c.moveTo(fx, fy + fh * u); c.lineTo(fx + fw, fy + fh * u); c.stroke(); });
      c.setLineDash([]); c.strokeStyle = ACC; c.lineWidth = 2; const m = Math.min(fw, fh) * 0.16, cx = W / 2, cy = H / 2;
      c.beginPath(); c.moveTo(cx - m, cy - m); c.lineTo(cx + m, cy + m); c.moveTo(cx + m, cy - m); c.lineTo(cx - m, cy + m); c.stroke();
      return;
    }
    if (g.box) { c.fillStyle = 'rgba(80,190,255,0.08)'; c.fillRect(fx + g.box.x * k, fy + g.box.y * k, g.box.w * k, g.box.h * k); }
    c.strokeStyle = 'rgba(80,190,255,0.9)'; c.lineWidth = 1;
    g.v.forEach((x) => { const X = Math.round(fx + x * k) + 0.5; c.beginPath(); c.moveTo(X, fy); c.lineTo(X, fy + fh); c.stroke(); });
    g.h.forEach((y) => { const Y = Math.round(fy + y * k) + 0.5; c.beginPath(); c.moveTo(fx, Y); c.lineTo(fx + fw, Y); c.stroke(); });
    if (th.id === 'golden') { c.fillStyle = ACC; c.globalAlpha = pulse; c.beginPath(); c.arc(fx + g.v[1] * k, fy + g.h[0] * k, 2.5, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
    if (th.id === 'center') { c.strokeStyle = ACC; c.globalAlpha = pulse; c.beginPath(); c.arc(W / 2, H / 2, 4, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1; }
  },
  guides(c, W, H, th) {
    const m = th.safe ? 0.08 : th.c === 12 ? 0.07 : 0;
    const x0 = W * m, x1 = W * (1 - m), y0 = H * (th.safe ? 0.08 : th.c === 12 ? 0.1 : 0), y1 = H - y0;
    c.fillStyle = 'rgba(255,122,89,0.14)';
    const gw = th.c === 12 ? 4 : 0;
    const cw = (x1 - x0 - gw * (th.c - 1)) / th.c, ch = (y1 - y0) / th.r;
    for (let i = 0; i < th.c; i++) for (let j = 0; j < th.r; j++) c.fillRect(x0 + i * (cw + gw), y0 + j * ch, cw, ch - (th.r > 1 ? 1 : 0));
    c.strokeStyle = 'rgba(80,190,255,0.9)';
    for (let i = 0; i <= th.c; i++) { const x = x0 + i * (cw + gw) - (i === th.c ? gw : 0) + 0.5; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let j = 0; j <= th.r; j++) { const y = y0 + j * ch + 0.5; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    if (th.safe) { c.beginPath(); c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.stroke(); }
  },
  cells(c, W, H, th, t) {
    const g = 3, cw = (W - g * (th.c + 1)) / th.c, ch = (H - g * (th.r + 1)) / th.r;
    let k = 0;
    for (let j = 0; j < th.r; j++) for (let i = 0; i < th.c; i++) {
      const p = eOut(clamp01((phase(t, 1.4, 2.8) - k * 0.12) / 0.5));
      c.globalAlpha = 0.25 + 0.75 * p;
      c.fillStyle = k % 3 === 0 ? ACC : k % 3 === 1 ? '#8fb3d9' : FG; rrect(c, g + i * (cw + g), g + j * (ch + g), cw, ch, 3); c.fill(); k++;
    }
    c.globalAlpha = 1;
  },
  glass(c, W, H, th, t) {
    const L0 = LOOKS[th.look];
    const bg = c.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#1e3a5f'); bg.addColorStop(1, '#5a2d4f');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    const blobs = (ctx) => { ctx.fillStyle = '#ff7a59'; ctx.beginPath(); ctx.arc(W * (0.3 + 0.08 * Math.sin(t)), H * 0.4, H * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#4fc3f7'; ctx.beginPath(); ctx.arc(W * 0.72, H * (0.62 + 0.06 * Math.cos(t * 1.2)), H * 0.24, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffe082'; ctx.fillRect(W * 0.08, H * 0.75, W * 0.3, H * 0.08); };
    blobs(c);
    const x = W * 0.2, y = H * 0.22, w = W * 0.6, hh = H * 0.56;
    if (L0.shadow) { c.save(); c.globalAlpha = L0.shadow / 100; c.filter = `blur(${L0.softness / 6}px)`; c.fillStyle = '#000'; rrect(c, x + 3, y + 5, w, hh, 10); c.fill(); c.restore(); }
    c.save(); rrect(c, x, y, w, hh, 10); c.clip();
    c.filter = `blur(${Math.max(0, L0.frost / 3)}px) brightness(${1 + L0.brightness / 100})`;
    const z = 1 + L0.refraction / 300;
    c.translate(W / 2, H / 2); c.scale(z, z); c.translate(-W / 2, -H / 2);
    c.fillStyle = bg; c.fillRect(0, 0, W, H); blobs(c);
    c.restore(); c.filter = 'none';
    const tc = hexToRgb(L0.tint);
    c.fillStyle = `rgba(${tc.map((v) => Math.round(v * 255)).join(',')},${L0.tintAmount / 100})`; rrect(c, x, y, w, hh, 10); c.fill();
    const rim = c.createLinearGradient(x, y, x + w, y + hh); rim.addColorStop(0, `rgba(255,255,255,${0.2 + L0.rim / 160})`); rim.addColorStop(0.5, 'rgba(255,255,255,0.05)'); rim.addColorStop(1, `rgba(255,255,255,${L0.rim / 400})`);
    c.strokeStyle = rim; c.lineWidth = Math.max(1, L0.rimWidth / 2); rrect(c, x + 0.5, y + 0.5, w - 1, hh - 1, 10); c.stroke(); c.lineWidth = 1;
  },
  /* Thick Glass (v0.27): a thick pill over moving colour — flat centre, stronger refraction in the bevel band,
     red / blue fringes for dispersion, studio highlight, reflection gradient, shadow and caustic below. */
  thick(c, W, H, th, t) {
    const V = thickValues(th.look);
    const bg = c.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#16324f'); bg.addColorStop(1, '#4a2348');
    const scene = (ctx) => {
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ff7a59'; ctx.beginPath(); ctx.arc(W * (0.32 + 0.1 * Math.sin(t * 0.9)), H * 0.42, H * 0.26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4fc3f7'; ctx.beginPath(); ctx.arc(W * 0.7, H * (0.6 + 0.08 * Math.cos(t * 1.1)), H * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe082'; for (let i = 0; i < 6; i++) ctx.fillRect(W * (0.06 + i * 0.16), H * 0.82, W * 0.07, H * 0.06);
    };
    scene(c);
    const x = W * 0.18, y = H * 0.24, w = W * 0.64, hh = H * 0.5, r = hh * 0.45;
    const bev = Math.max(2, hh * (0.1 + V.bevel / 220));
    const ang = (V.angle + 90) * Math.PI / 180, d = V.distance / 5;
    if (V.shadow) { c.save(); c.globalAlpha = V.shadow / 110; c.filter = `blur(${V.softness / 7}px)`; c.fillStyle = '#000'; rrect(c, x + d * Math.cos(ang), y + d * Math.sin(ang), w, hh, r); c.fill(); c.restore(); }
    if (V.caustics) { const lc = hexToRgb(V.lightColor).map((k) => Math.round(k * 255)).join(','); c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = V.caustics / 160; c.filter = `blur(${V.softness / 6}px)`; c.fillStyle = `rgb(${lc})`; rrect(c, x + w * 0.2 + d * 0.6 * Math.cos(ang), y + hh * 0.3 + d * 0.6 * Math.sin(ang), w * 0.6, hh * 0.4, r * 0.5); c.fill(); c.restore(); }
    const zoomed = (z, blur) => { c.save(); c.filter = `blur(${blur}px) brightness(${1 + V.brightness / 100})`; c.translate(W / 2, H / 2); c.scale(z, z); c.translate(-W / 2, -H / 2); scene(c); c.restore(); };
    const zEdge = 1 + V.refraction / 260, zMid = 1 + V.refraction / 1400;
    c.save(); rrect(c, x, y, w, hh, r); c.clip();
    zoomed(zEdge, V.frost / 5);
    if (V.dispersion) {
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(0.55, V.dispersion / 140);
      c.strokeStyle = '#ff3030'; c.lineWidth = bev * 0.5; rrect(c, x + 1.5, y + 1.5, w - 3, hh - 3, r); c.stroke();
      c.strokeStyle = '#3060ff'; rrect(c, x + bev * 0.55, y + bev * 0.55, w - bev * 1.1, hh - bev * 1.1, Math.max(1, r - bev * 0.55)); c.stroke();
      c.restore();
    }
    c.save(); rrect(c, x + bev, y + bev, w - 2 * bev, hh - 2 * bev, Math.max(1, r - bev)); c.clip(); zoomed(zMid, V.frost / 5); c.restore();
    if (V.tintAmount) { const tc = hexToRgb(V.tint).map((k) => Math.round(k * 255)).join(','); c.fillStyle = `rgba(${tc},${V.tintAmount / 130})`; c.fillRect(x, y, w, hh); }
    if (V.reflection) {
      const a = V.angle * Math.PI / 180, cx = x + w / 2, cy = y + hh / 2, R = Math.hypot(w, hh) / 2;
      const g = c.createLinearGradient(cx + R * Math.sin(a), cy - R * Math.cos(a), cx - R * Math.sin(a), cy + R * Math.cos(a));
      const lc = hexToRgb(V.lightColor).map((k) => Math.round(k * 255)).join(',');
      g.addColorStop(0, `rgba(${lc},${V.reflection / 100})`); g.addColorStop(0.48, `rgba(${lc},${V.reflection / 260})`); g.addColorStop(0.52, `rgba(11,13,18,${V.reflection / 140})`); g.addColorStop(1, `rgba(11,13,18,${V.reflection / 110})`);
      c.fillStyle = g; c.fillRect(x, y, w, hh);
      if (V.tintAmount > 40) { const tc = hexToRgb(V.tint).map((k) => Math.round(k * 255)).join(','); c.globalCompositeOperation = 'multiply'; c.fillStyle = `rgba(${tc},${V.tintAmount / 100})`; c.fillRect(x, y, w, hh); c.globalCompositeOperation = 'source-over'; }
    }
    c.restore();
    // Studio highlight: a bright arc on the lit edge, softer edge light round the rim.
    const hs = 0.35 + V.roughness / 60;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(255,255,255,${V.edgeLight / 300})`; c.lineWidth = 1; rrect(c, x + 0.5, y + 0.5, w - 1, hh - 1, r); c.stroke();
    c.globalAlpha = V.highlights / 100; c.filter = `blur(${Math.max(0.3, V.roughness / 14)}px)`; c.strokeStyle = '#fff'; c.lineWidth = Math.max(1.2, bev * 0.45); c.lineCap = 'round';
    c.beginPath(); c.arc(x + r, y + r, r - bev * 0.5, Math.PI * (1.08), Math.PI * (1.08 + hs)); c.stroke();
    c.beginPath(); c.moveTo(x + r + bev, y + bev * 0.55); c.lineTo(x + r + w * 0.22 * hs, y + bev * 0.55); c.stroke();
    c.restore(); c.filter = 'none'; c.lineWidth = 1; c.lineCap = 'butt';
  },
  zoom(c, W, H, th, t) {
    c.fillStyle = '#2f3740'; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(230,230,230,0.25)';
    for (let i = 0; i < 5; i++) c.fillRect(W * 0.08, H * (0.14 + i * 0.12), W * (0.3 - (i % 2) * 0.08), H * 0.05);
    c.fillStyle = ACC; c.fillRect(W * 0.6, H * 0.55, W * 0.18, H * 0.12);
    const ph = (t % 3.2) / 3.2;
    const zin = eOut(clamp01((ph - 0.12) / 0.2)), zout = th.stay ? 0 : eOut(clamp01((ph - 0.72) / 0.2));
    const z = 1 + (th.z - 1) * (zin - zout);
    const fx = W * 0.69, fy = H * 0.61;
    const vw = W / z, vh = H / z;
    const vx = Math.min(Math.max(fx - vw / 2, 0), W - vw), vy = Math.min(Math.max(fy - vh / 2, 0), H - vh);
    if (th.spot && z > 1.05) { c.fillStyle = `rgba(0,0,0,${0.5 * (z - 1) / (th.z - 1)})`; c.fillRect(0, 0, W, H); c.fillStyle = ACC; c.fillRect(W * 0.6, H * 0.55, W * 0.18, H * 0.12); }
    c.strokeStyle = ACC; c.lineWidth = 1.5; c.strokeRect(vx + 0.75, vy + 0.75, vw - 1.5, vh - 1.5); c.lineWidth = 1;
  },
  follow(c, W, H, th, t) {
    c.fillStyle = '#2f3740'; c.fillRect(0, 0, W, H);
    const px = W * (0.5 + 0.32 * Math.sin(t * 0.9)), py = H * (0.5 + 0.25 * Math.sin(t * 1.4));
    c.fillStyle = ACC; c.beginPath(); c.arc(px, py, 4, 0, Math.PI * 2); c.fill();
    const vw = W / 1.8, vh = H / 1.8;
    const vx = Math.min(Math.max(px - vw / 2, 0), W - vw), vy = Math.min(Math.max(py - vh / 2, 0), H - vh);
    c.strokeStyle = FG; c.strokeRect(vx + 0.5, vy + 0.5, vw - 1, vh - 1);
  },
  cursor(c, W, H, th, t) {
    c.fillStyle = '#2f3740'; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(230,230,230,0.2)'; c.fillRect(W * 0.12, H * 0.22, W * 0.3, H * 0.14); c.fillRect(W * 0.58, H * 0.62, W * 0.3, H * 0.14);
    const ph = (t % 2.6) / 2.6;
    const m = eOut(clamp01((ph - 0.25) / 0.3));
    const x = W * (0.27 + 0.46 * m), y = H * (0.29 + 0.4 * m);
    const click = ph > 0.6 ? clamp01((ph - 0.6) / 0.3) : (ph < 0.2 ? clamp01(ph / 0.2) : 0);
    if (click > 0 && click < 1) { c.strokeStyle = `rgba(255,122,89,${1 - click})`; c.beginPath(); c.arc(x, y, 4 + click * 14, 0, Math.PI * 2); c.stroke(); }
    c.save(); c.translate(x, y); const s = click > 0 && click < 0.3 ? 0.85 : 1; c.scale(s * 0.9, s * 0.9);
    c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.beginPath();
    const pts = th.hand ? [[-2.5, 0], [2.5, 0], [3.2, 12], [9.5, 12.3], [17.6, 13.6], [18.6, 24], [15.6, 31], [3.5, 31], [-7.4, 15.6], [-3.2, 14.2]] : [[0, 0], [0, 26], [6.5, 20], [11, 30], [15, 28.2], [10.6, 18.6], [19, 18.6]];
    pts.forEach((q, i) => (i ? c.lineTo(q[0] * 0.6, q[1] * 0.6) : c.moveTo(q[0] * 0.6, q[1] * 0.6))); c.closePath(); c.fill(); c.stroke(); c.restore();
  },
  /**
   * v0.60 (SAAS_INTERACTION.md): Click on Layer — the tool's own plan on a small app: the cursor travels to each
   * piece's centre, settles, presses (ripple), and the piece presses with it around its centre.
   */
  click(c, W, H, th, t) {
    const CP = require('../../../features/interact/clickPlan');
    c.fillStyle = '#2f3740'; c.fillRect(0, 0, W, H);
    const boxes = [[0.1, 0.14, 0.62, 0.3], [0.1, 0.42, 0.9, 0.58], [0.56, 0.7, 0.9, 0.86]].map((b) => [b[0] * W, b[1] * H, b[2] * W, b[3] * H]);
    const a = Object.assign({ travel: 0.55, gap: 1.1, depth: 94, from: 'corner', ripple: true }, th.args || {});
    const T = CP.times(boxes.length, { time: 0, travel: a.travel, gap: a.gap });
    const clicks = boxes.map((b, i) => ({ t: T[i], p: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] }));
    const pl = CP.plan(clicks, { from: a.from, W, H, travel: a.travel, gap: a.gap, depth: a.depth, ripple: a.ripple });
    const span = pl.end - pl.start + 0.5;
    const lt = th.still ? clicks[clicks.length - 1].t - 0.1 : pl.start + (t % span);
    const press = pl.press.map((k) => ({ t: k.t, v: k.f }));
    boxes.forEach((b, i) => {
      const f = CP.valueAt(press, lt - clicks[i].t), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, w = (b[2] - b[0]) * f, h = (b[3] - b[1]) * f;
      c.fillStyle = i === boxes.length - 1 ? ACC : (i === 0 ? 'rgba(230,230,230,0.22)' : 'rgba(230,230,230,0.12)');
      rrect(c, cx - w / 2, cy - h / 2, w, h, Math.min(h / 2, 5)); c.fill();
      if (i === 1) { c.fillStyle = lt > clicks[1].t ? ACC : 'rgba(230,230,230,0.35)'; const r = h * 0.32, kx = lt > clicks[1].t ? cx + w / 2 - h / 2 : cx + w / 2 - h * 1.1; c.beginPath(); c.arc(kx, cy, r, 0, Math.PI * 2); c.fill(); }
    });
    if (pl.ringS.length) {
      const rs = CP.valueAt(pl.ringS, lt)[0] / 100, ro = CP.valueAt(pl.ringO, lt) / 100, p = CP.valueAt(pl.pos, lt);
      if (rs > 0.02 && ro > 0.02) { c.strokeStyle = `rgba(255,255,255,${ro})`; c.lineWidth = 1.5; c.beginPath(); c.arc(p[0], p[1], 9 * rs, 0, Math.PI * 2); c.stroke(); c.lineWidth = 1; }
    }
    const p = CP.valueAt(pl.pos, lt), s = CP.valueAt(pl.scale, lt)[0] / 100;
    c.globalAlpha = clamp01(CP.valueAt(pl.opacity, lt) / 100);
    pointer(c, p[0], p[1], 0.55 * s, th.hand);
    c.globalAlpha = 1;
  },
  /**
   * v0.64 (WAVE4.md): Depth Reveal — the tool's Z keys through a simple perspective (f / (f + z)), with the plan's fade
   * and blur, three cards one Stagger apart.
   */
  depth(c, W, H, th, t) {
    const DP = require('../../../features/quick/depth');
    const a = Object.assign({ dir: th.dir || 'in', depth: th.far ? 2400 : 900, duration: 0.9, fade: true, blur: 14, stagger: 0.06, ease: 'smooth' }, th.args || {});
    const z = DP.plan(a), lag = a.stagger || 0, lt0 = planOf(th, t).at(PLAN.endOf(z) + lag * 2);
    c.fillStyle = '#2f3740'; c.fillRect(0, 0, W, H);
    const f = 1100;
    [0, 1, 2].forEach((i) => {
      const lt = lt0 - i * lag, zz = PLAN.valueAt(z, lt), s = f / (f + Math.max(-f * 0.9, zz));
      const cx = W * (0.25 + i * 0.25), cy = H * 0.5, w = W * 0.2 * s, h = H * 0.42 * s;
      c.save();
      c.globalAlpha = fadeAt(Object.assign({ kind: 'move' }, a), lt); c.filter = blurAt(a, lt, W);
      c.fillStyle = i === 1 ? ACC : 'rgba(230,230,230,0.32)'; rrect(c, cx - w / 2, cy - h / 2, w, h, 4); c.fill();
      c.restore();
    });
  },
  /**
   * v0.63 (WIPE_CAROUSEL.md): Carousel 3D — the tool's own ring, steps and depth fade, projected with a simple
   * perspective (nearer = bigger, lower, drawn last).
   */
  carousel(c, W, H, th, t) {
    const CP = require('../../../features/carousel/plan');
    const a = Object.assign({ turn: 0.7, hold: 1.2, depth: 60, tilt: th.tilt || 0 }, th.args || {}), n = 6;
    const keys = CP.steps(n, { time: 0, turn: a.turn, hold: a.hold, steps: n, reverse: a.reverse });
    const end = keys[keys.length - 1].t, lt = th.still ? 0 : t % (end + 0.4);
    const rot = PLAN.valueAt(keys.map((k) => ({ t: k.t, v: k.v, easeIn: k.easeIn, easeOut: k.easeOut })), lt);
    c.fillStyle = '#2f3740'; c.fillRect(0, 0, W, H);
    const R = W * 0.3, tilt = Math.sin((a.tilt || 0) * Math.PI / 180);
    const cards = CP.ring(n, 1).map((r, i) => {
      const ang = (r.theta + rot) * Math.PI / 180, x = Math.sin(ang), z = -Math.cos(ang); // z −1 = front
      const sc = 0.7 + 0.3 * (-z + 1) / 2, o = CP.depth(r.theta, rot, a.depth) / 100;
      return { i, x: W / 2 + x * R, y: H * 0.52 + (-z) * H * (0.06 + tilt * 0.4), z, sc, o, face: Math.cos(ang) };
    }).sort((p, q) => q.z - p.z);
    for (const k of cards) {
      const w = W * 0.2 * k.sc * Math.max(0.12, Math.abs(k.face)), h = H * 0.36 * k.sc;
      c.globalAlpha = clamp01(k.o);
      c.fillStyle = k.i === 0 ? ACC : (k.face < 0 ? 'rgba(230,230,230,0.18)' : 'rgba(230,230,230,0.38)');
      rrect(c, k.x - w / 2, k.y - h / 2, w, h, 3); c.fill();
    }
    c.globalAlpha = 1;
  },
  /**
   * v0.63 (WIPE_CAROUSEL.md): Wipe Reveal — the tool's own Transition Completion keys, drawn as a soft-edged wipe
   * along the same angle After Effects uses (90° travels left → right).
   */
  wipe(c, W, H, th, t) {
    const WP = require('../../../features/quick/wipe');
    const a = Object.assign({ dir: th.dir || 'in', from: th.from || 'left', duration: 0.8, feather: 60, ease: 'smooth' }, th.args || {});
    const keys = WP.plan(a), lt = planOf(th, t).at(PLAN.endOf(keys));
    const done = clamp01(PLAN.valueAt(keys, lt) / 100); // 0 = all shown, 1 = all hidden
    c.fillStyle = '#2f3740'; c.fillRect(0, 0, W, H);
    // the "layer": a card with a title bar and lines, so the wipe edge reads
    const card = () => { c.fillStyle = 'rgba(230,230,230,0.16)'; rrect(c, W * 0.12, H * 0.18, W * 0.76, H * 0.64, 6); c.fill(); c.fillStyle = ACC; rrect(c, W * 0.18, H * 0.28, W * 0.34, H * 0.1, 3); c.fill(); c.fillStyle = 'rgba(230,230,230,0.35)'; [0.48, 0.6].forEach((y, i) => { rrect(c, W * 0.18, H * y, W * (0.6 - i * 0.18), H * 0.06, 2); c.fill(); }); };
    const ang = ((WP.FROM[a.from] || WP.FROM.left).angle - 90) * Math.PI / 180; // 0 = travels left → right
    const dx = Math.cos(ang), dy = Math.sin(ang), span = Math.abs(dx) * W + Math.abs(dy) * H, soft = Math.max(1, (a.feather / 1920) * W * 2.2);
    const cx = W / 2, cy = H / 2, edge = -span / 2 + done * (span + soft);
    // the card's outline stays, faint, so the tile is never empty while the card is still hidden
    c.strokeStyle = 'rgba(230,230,230,0.18)'; c.setLineDash && c.setLineDash([3, 3]); rrect(c, W * 0.12, H * 0.18, W * 0.76, H * 0.64, 6); c.stroke(); c.setLineDash && c.setLineDash([]);
    c.save();
    const g = c.createLinearGradient(cx + dx * (edge - soft), cy + dy * (edge - soft), cx + dx * edge, cy + dy * edge);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    // draw the card, then keep only the part the wipe has not taken
    card();
    c.globalCompositeOperation = 'destination-in';
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.restore();
  },
  /**
   * v0.60: UI Reveal — a small page measured into boxes, ranked by the tool's own screenOrder (reading order, right to
   * left, or from the centre), each piece playing Quick Animate's keys (+ fade + blur) one Stagger after the other.
   */
  uiReveal(c, W, H, th, t) {
    c.fillStyle = '#2f3740'; c.fillRect(0, 0, W, H);
    const boxes = [[0.08, 0.1, 0.92, 0.22], [0.08, 0.3, 0.36, 0.62], [0.38, 0.3, 0.64, 0.62], [0.66, 0.3, 0.92, 0.62], [0.08, 0.72, 0.56, 0.8], [0.66, 0.7, 0.92, 0.86]].map((b) => [b[0] * W, b[1] * H, b[2] * W, b[3] * H]);
    const a = Object.assign({ kind: 'moveBT', dir: 'in', stagger: 0.06, order: 'screen' }, th.args || {});
    const rank = PLAN.screenOrder(boxes, a.order || th.order || 'screen');
    const isScale = a.kind === 'scale';
    const moveY = a.distance ? Math.min(H * 0.3, a.distance / 1080 * H * 2.5) : H * 0.4;
    const pl = PLAN.animate(a, isScale ? { scale: [100, 100] } : { position: [0, 0], offset: [0, moveY], opacity: 100 });
    const lag = a.stagger || 0, lt0 = planOf(th, t).at(PLAN.endOf(pl.keys) + lag * (boxes.length - 1));
    boxes.forEach((b, i) => {
      const lt = lt0 - rank[i] * lag, v = PLAN.valueAt(pl.keys, lt);
      c.save();
      c.globalAlpha = fadeAt(a, lt); c.filter = blurAt(a, lt, W);
      const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      c.translate(cx, cy + (isScale ? 0 : v[1]));
      if (isScale) { const s = Math.max(0, v[0] / 100); c.scale(s, s); }
      c.fillStyle = i === boxes.length - 1 ? ACC : (i === 0 ? 'rgba(230,230,230,0.3)' : 'rgba(230,230,230,0.16)');
      rrect(c, b[0] - cx, b[1] - cy, b[2] - b[0], b[3] - b[1], 4); c.fill();
      c.restore();
    });
  },
  /**
   * Background tile (v0.18): the real background for that palette, moving on hover with the Motion
   * and Colours picked in the Inspector (Still → a gentle Drift, so hover always shows life),
   * through the same drawing as the Inspector preview. Swatches along the bottom.
   */
  bg(c, W, H, th, t) {
    const pal = PAL.resolve(th.palette, th.colors, th.paletteName) || PAL.byId('tomato');
    if (!pal) return;
    const { bgFrame, BG_DEFAULTS } = bgDraw || (bgDraw = require('../bgDraw'));
    const a = Object.assign({}, BG_DEFAULTS, th);
    if ((!a.motion || a.motion === 'none') && (!a.colorMotion || a.colorMotion === 'none')) a.motion = 'drift';
    // a tile is a small window on a 16:9-ish frame: the comp takes the tile's own shape
    bgFrame(c, W, H, a, { width: 1920, height: Math.round(1920 * H / W) }, t % Math.max(a.loop, 0.1), false);
    const sw = W / 5;
    pal.colors.forEach((hex, i) => { c.fillStyle = hex; c.fillRect(i * sw, H - 6, sw, 6); });
  },
  /** Palette strip (Colorize / palette pickers). */
  palette(c, W, H, th) {
    const pal = PAL.resolve(th.palette, th.colors, th.paletteName) || PAL.byId('tomato');
    if (!pal) return;
    const sw = W / pal.colors.length;
    pal.colors.forEach((hex, i) => { c.fillStyle = hex; c.fillRect(i * sw, 0, sw + 1, H); });
  },
  expr(c, W, H, th, t) {
    const f = EXPR_FN[th.preset] || EXPR_FN.wiggle;
    const span = 4;
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.beginPath(); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.stroke();
    c.strokeStyle = FG; c.lineWidth = 1.6; c.beginPath();
    for (let i = 0; i <= 120; i++) { const u = (i / 120) * span; const v = f(u); const x = (i / 120) * W, y = H / 2 - v * H * 0.36; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke(); c.lineWidth = 1;
    const u = t % span; const v = f(u);
    c.fillStyle = ACC; c.beginPath(); c.arc((u / span) * W, H / 2 - v * H * 0.36, 3.5, 0, Math.PI * 2); c.fill();
  }
};

function noise(u, seed = 1) { return (Math.sin(u * 5.1 + seed) * 0.5 + Math.sin(u * 8.7 + seed * 2.3) * 0.3 + Math.sin(u * 13.3 + seed * 4.1) * 0.2); }
const keyed = (u) => { const x = u % 1.6; return x < 1 ? -1 + 2 * (x * x * (3 - 2 * x)) : 1; };
const EXPR_FN = {
  wiggle: (u) => noise(u), wiggleX: (u) => noise(u, 3), wiggleY: (u) => noise(u, 5),
  jitter: (u) => noise(Math.floor(u * 4) / 4, 2),
  blink: (u) => (Math.floor(u * 4) % 2 ? -0.8 : 0.8),
  flicker: (u) => Math.sin(Math.floor(u * 10) * 12.9898) * 0.8,
  autoFade: (u) => (u < 0.6 ? -0.8 + (u / 0.6) * 1.6 : u > 3.4 ? 0.8 - ((u - 3.4) / 0.6) * 1.6 : 0.8),
  loopCycle: (u) => keyed(u), loopPingPong: (u) => { const x = u % 2; return x < 1 ? -1 + 2 * x : 1 - 2 * (x - 1); },
  loopOffset: (u) => -1 + Math.floor(u / 1) * 0.5 + (u % 1) * 0.5,
  loopInOut: (u) => keyed(u + 0.8),
  timeRotate: (u) => -1 + (u / 4) * 2,
  pendulum: (u) => Math.sin(u * Math.PI * 2) * Math.exp(-u * 0.6),
  pulse: (u) => Math.sin(u * Math.PI * 2) * 0.6, float: (u) => Math.sin(u * Math.PI) * 0.6,
  inertia: (u) => (u < 1 ? -1 + 2 * u : 1 + 0.5 * Math.sin((u - 1) * 9) * Math.exp(-(u - 1) * 3.5)),
  posterize: (u) => -1 + Math.floor((u / 4) * 8) / 4,
  bounceBack: (u) => { if (u < 1) return 1 - 2 * u * u; let t = u - 1, h = 1.2, d = 0.9; while (t > d && d > 0.05) { t -= d; d *= 0.6; h *= 0.36; } return t > d ? -1 : -1 + h * 4 * (t / d) * (1 - t / d); },
  squash: (u) => Math.sin(u * Math.PI * 2 * 1.2) * Math.exp(-u * 0.7) * 0.9,
  orbit: (u) => Math.sin(u * Math.PI * 1.5) * 0.8,
  swing: (u) => Math.sin(u * Math.PI * 1.6) * 0.7,
  heartbeat: (u) => { const p = (u * 0.9) % 1; return -0.5 + 1.3 * (Math.exp(-Math.pow((p - 0.1) / 0.05, 2)) + 0.6 * Math.exp(-Math.pow((p - 0.3) / 0.05, 2))); },
  breathe: (u) => Math.sin(u * Math.PI) * 0.7,
  wiggleRot: (u) => noise(u, 7) * 0.8, wiggleScale: (u) => noise(u, 9) * 0.7,
  organic: (u) => noise(u * 0.6, 4) * 0.9,
  loopWiggle: (u) => noise(u % 2, 6) * (1 - Math.abs((u % 2) - 1) * 0.2),
  drift: (u) => -1 + (u / 4) * 1.6,
  clock: (u) => -1 + Math.floor(u * 2) / 4,
  faceMotion: (u) => Math.atan(Math.cos(u * 1.8) * 3) / 1.4,
  scatter: (u) => Math.sin(Math.floor(u * 3) * 78.233) * 0.8,
  popIn: (u) => { const x = u % 2; if (x > 1) return 0.6; return x <= 0 ? -1 : -1 + 1.6 * (1 + 0.15 * Math.sin(Math.PI * x) - Math.pow(1 - x, 3)); },
  slideIn: (u) => { const x = Math.min((u % 2) / 0.8, 1); return -1 + 1.7 * (1 - Math.pow(1 - x, 3)); }
};

/* ---------- v0.9: curves, anchor, align, clone ---------- */
const BZ = require('../../../features/curves/bezier');
const TM = require('../../../features/transform/math');
Object.assign(DRAW, {
  /** Value curve + a ball travelling with that ease (left → right). */
  bezier(c, W, H, th, t) {
    const pad = 10, gw = W - pad * 2, gh = H - 30;
    const top = 8 + gh * 0.18, h = gh * 0.64; // y 0…1 inside, room for overshoot above / below
    const X = (x) => pad + x * gw, Y = (y) => top + h - y * h;
    c.strokeStyle = DIM; c.lineWidth = 1; c.setLineDash([2, 3]);
    c.beginPath(); c.moveTo(X(0), Y(0)); c.lineTo(X(1), Y(0)); c.moveTo(X(0), Y(1)); c.lineTo(X(1), Y(1)); c.stroke(); c.setLineDash([]);
    c.strokeStyle = ACC; c.lineWidth = 2; c.beginPath();
    for (let i = 0; i <= 40; i++) { const p = BZ.point(th, i / 40); if (i) c.lineTo(X(p.x), Y(p.y)); else c.moveTo(X(p.x), Y(p.y)); }
    c.stroke();
    const k = phase(t, 1.2, 2.6);
    const v = BZ.valueAt(th, k);
    c.fillStyle = FG; c.beginPath(); c.arc(pad + 6 + v * (gw - 12), H - 11, 5, 0, Math.PI * 2); c.fill();
    c.fillStyle = ACC; c.beginPath(); c.arc(X(k), Y(v), 3, 0, Math.PI * 2); c.fill();
  },
  anchor(c, W, H, th, t) {
    const bw = W * 0.42, bh = H * 0.44, x = (W - bw) / 2 + W * 0.04, y = (H - bh) / 2 + H * 0.06; // clear of the NEW badge
    const [fx, fy] = TM.POINTS[th.p];
    const ax = x + bw * fx, ay = y + bh * fy;
    const a = Math.sin(phase(t, 1.2, 2.6) * Math.PI) * 0.35;
    c.save(); c.translate(ax, ay); c.rotate(a); c.translate(-ax, -ay);
    c.fillStyle = DIM; rrect(c, x, y, bw, bh, 4); c.fill(); c.restore();
    c.strokeStyle = ACC; c.lineWidth = 1.5;
    c.beginPath(); c.arc(ax, ay, 5, 0, Math.PI * 2); c.moveTo(ax - 9, ay); c.lineTo(ax + 9, ay); c.moveTo(ax, ay - 9); c.lineTo(ax, ay + 9); c.stroke();
  },
  align(c, W, H, th, t) {
    const p = eOut(phase(t));
    const rows = [[0.18, 0.3], [0.42, 0.5], [0.3, 0.38]];
    const vert = /^(top|vcenter|bottom|distV)$/.test(th.mode);
    c.strokeStyle = ACC; c.lineWidth = 1.5; c.setLineDash([3, 3]); c.beginPath();
    const guide = { left: [W * 0.2, 0], hcenter: [W * 0.5, 0], right: [W * 0.8, 0], top: [0, H * 0.2], vcenter: [0, H * 0.5], bottom: [0, H * 0.8] }[th.mode];
    if (guide) { if (guide[0]) { c.moveTo(guide[0], 4); c.lineTo(guide[0], H - 4); } else { c.moveTo(4, guide[1]); c.lineTo(W - 4, guide[1]); } }
    c.stroke(); c.setLineDash([]);
    rows.forEach(([a, len], i) => {
      const n = rows.length;
      if (!vert) {
        const w = W * len, y = H * (0.2 + i * 0.26), from = W * a;
        const to = { left: W * 0.2, hcenter: W * 0.5 - w / 2, right: W * 0.8 - w, distH: W * (0.12 + i * 0.3) }[th.mode];
        c.fillStyle = FG; rrect(c, from + (to - from) * p, y, th.mode === 'distH' ? W * 0.16 : w, H * 0.16, 3); c.fill();
      } else {
        const h = H * len * 0.9, x = W * (0.2 + i * 0.25), from = H * a;
        const to = { top: H * 0.2, vcenter: H * 0.5 - h / 2, bottom: H * 0.8 - h, distV: H * (0.1 + i * 0.28) }[th.mode];
        c.fillStyle = FG; rrect(c, x, from + (to - from) * p, W * 0.14, th.mode === 'distV' ? H * 0.16 : h, 3); c.fill();
      }
      return n;
    });
  },
  clone(c, W, H, th, t) {
    const n = th.n || 8, p = phase(t, 1.2, 2.8), shown = Math.max(1, Math.ceil(p * n));
    const lay = th.mode === 'radial'
      ? TM.cloneLayout({ mode: 'radial', count: n, radius: Math.min(W, H) * 0.32, arc: th.arc || 360, center: [W / 2, H / 2 + (th.arc && th.arc < 360 ? H * 0.12 : 0)], startAngle: th.arc && th.arc < 360 ? -th.arc / 2 : 0, faceOut: true })
      : TM.cloneLayout({ mode: th.mode, count: n, origin: [W * 0.16, th.mode === 'grid' ? H * 0.24 : H / 2], step: [W * 0.68 / (n - 1), 0], spacing: [W * 0.2, H * 0.24], columns: th.cols || 4, scaleStep: th.scale || 0, opacityStep: th.fade || 0 });
    const items = lay.source ? [lay.source, ...lay.copies] : [{ position: [W * 0.16, th.mode === 'grid' ? H * 0.24 : H / 2], rotation: 0, scale: 1, opacity: 100 }, ...lay.copies];
    items.slice(0, shown).forEach((it, i) => {
      const r = 5 * (it.scale || 1);
      c.globalAlpha = (it.opacity === undefined ? 100 : it.opacity) / 100;
      c.fillStyle = i === 0 ? ACC : FG;
      c.beginPath(); c.arc(it.position[0], it.position[1], Math.max(1.5, r), 0, Math.PI * 2); c.fill();
    });
    c.globalAlpha = 1;
  }
});

let bgDraw = null; // loaded on first use (bgDraw → design tools; keeps thumbs light to load)
/** Draw one thumbnail frame. */
/**
 * v0.49: a template as the tool builds it — the same layout (`templates.layout`) and the same entrance keys, drawn on
 * a 1920 × 1080 frame scaled into the tile. Only the text widths come from the browser (After Effects measures the real
 * ones; the bar / pill then fits them the same way).
 */
const TPL_COMP = { width: 1920, height: 1080 };
function templatePlan(c, th) {
  const opts = Object.assign({}, th.args || {});
  // a small tile shows the exit after a short hold (1 s) so it is never empty for long; the big preview keeps Hold
  if (!th.strip && opts.hold > 1) opts.hold = 1;
  const id = opts.template || th.id;
  const T = TPL.byId(id);
  if (!opts.title) opts.title = T.title;
  if (opts.subtitle === undefined || opts.subtitle === '') opts.subtitle = id === 'tag' ? '' : T.subtitle;
  const specs = TPL.textSpecs(id, opts, TPL_COMP);
  const measured = {};
    const meas = (s, fs) => { c.font = `${s.bold ? '700 ' : ''}${fs}px sans-serif`; const mt = c.measureText && c.measureText(s.text); return mt && mt.width > 0 ? mt.width : s.text.length * fs * 0.55; };
  // v0.52: the same Auto-fit as the host (templates.fitSize on the measured width), so a long line shrinks here too
  specs.forEach((s) => { let fs = s.fontSize, w = meas(s, fs); for (let k = 0; k < 4 && s.maxWidth && w > s.maxWidth; k++) { const nf = Math.max(Math.round(s.fontSize * 0.4), Math.floor(fs * (s.maxWidth / w) * 0.98)); if (nf >= fs) break; fs = nf; w = meas(s, fs); } measured[s.key] = [w, fs * 0.75, fs]; });
  return { id, plan: TPL.layout(id, opts, TPL_COMP, measured) };
}
const css = (rgb, a) => `rgba(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)},${a === undefined ? 1 : a})`;
DRAW.template = function (c, W, H, th, t) {
  const { plan } = templatePlan(c, th);
  const end = Math.max(0.01, ...plan.keys.map((k) => PLAN.endOf(k.keys)));
  // with an exit the loop rests 0.5 s after it, without one it holds the finished template 1.6 s; a still frame is the
  // template in place (the moment the exit would start, or the end of the entrance)
  const rest = plan.exitAt ? 0.5 : 1.6;
  const lt = th.still ? (plan.exitAt || end) : (t % (0.35 + end + rest)) - 0.35;
  // the big preview shows the whole frame (where it sits); a small tile frames the template itself
  const b = plan.box, pad = 0.35;
  const view = th.strip ? [0, 0, 1920, 1080] : [b[0] - b[2] * pad, b[1] - Math.max(b[3], 60) * pad * 2, b[2] * (1 + 2 * pad), Math.max(b[3], 60) * (1 + 4 * pad)];
  const k = Math.min(W / view[2], H / view[3]), ox = (W - view[2] * k) / 2 - view[0] * k, oy = (H - view[3] * k) / 2 - view[1] * k;
  c.save(); c.translate(ox, oy); c.scale(k, k);
  if (th.strip) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 0, 1920, 1080); }
  const val = (key, prop, dflt) => { const kk = plan.keys.find((x) => x.key === key && x.prop === prop); return kk ? PLAN.valueAt(kk.keys, lt) : dflt; };
  for (const el of plan.elements) {
    const pos = val(el.key, 'position', el.kind === 'path' ? el.points[0] : el.position);
    const sc = val(el.key, 'scale', [100, 100]);
    c.save();
    c.globalAlpha = clamp01(val(el.key, 'opacity', 100) / 100);
    c.translate(pos[0], pos[1]); c.scale(sc[0] / 100, sc[1] / 100);
    if (el.kind === 'rect') { c.fillStyle = css(el.color); rrect(c, -el.size[0] / 2, -el.size[1] / 2, el.size[0], el.size[1], Math.min(el.roundness || 0, el.size[1] / 2, el.size[0] / 2)); c.fill(); }
    if (el.kind === 'ellipse') { c.fillStyle = css(el.color); c.beginPath(); c.ellipse(0, 0, el.size[0] / 2, el.size[1] / 2, 0, 0, Math.PI * 2); c.fill(); }
    if (el.kind === 'path') {
      // Trim End: draw the leader up to the keyed percentage of its length
      const pts = el.points.map((p) => [p[0] - el.points[0][0], p[1] - el.points[0][1]]);
      const segs = []; let total = 0; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); total += l; }
      let left = total * clamp01(val(el.key, 'trimEnd', 100) / 100);
      c.strokeStyle = css(el.stroke.color); c.lineWidth = el.stroke.width; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(0, 0);
      for (let i = 1; i < pts.length && left > 0; i++) { const u = Math.min(1, left / segs[i - 1]); c.lineTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u); left -= segs[i - 1]; }
      c.stroke();
    }
    if (el.kind === 'text') {
      c.fillStyle = css(el.color); c.font = `${el.bold ? '700 ' : ''}${el.fontSize}px sans-serif`;
      c.textAlign = el.justify === 'center' ? 'center' : el.justify; c.direction = el.rtl ? 'rtl' : 'ltr';
      c.fillText(el.text, 0, 0);
    }
    c.restore();
  }
  c.restore(); c.direction = 'ltr'; c.textAlign = 'left';
};

/** The keys a planned preview plays (for the Inspector's key strip). */
function planKeys(th) {
  if (!th.args) return null;
  if (th.k === 'trim') { const pl = PLAN.trim(Object.assign({ mode: th.mode }, th.args)); return [].concat(pl.end || [], pl.start || []); }
  const kind = { move: 'moveRL', fade: 'fade', scale: 'scale', spin: 'spin', stagger: 'moveBT' }[th.k];
  if (!kind) return null;
  const a = animArgs(th, kind);
  const keys = PLAN.animate(a, { position: [0, 0], offset: [1, 1], opacity: 100, scale: [100, 100], rotation: 0 }).keys;
  return th.k === 'stagger' && a.stagger ? keys.concat(keys.map((k) => Object.assign({}, k, { t: k.t + a.stagger * 3 }))) : keys;
}
/**
 * v0.47: under the big Inspector preview, the keys on a strip with the playhead — where the keys sit in time
 * (an overshoot is the extra key at 72 %), the duration and the ease, as After Effects will get them.
 */
function keyStrip(c, W, H, th, t) {
  const keys = planKeys(th);
  if (!keys || !keys.length) return;
  const end = Math.max(...keys.map((k) => k.t)) || 1;
  const x0 = W * 0.06, x1 = W * 0.94, y = H - 12;
  const X = (tt) => x0 + (x1 - x0) * Math.max(0, Math.min(1, tt / end));
  c.strokeStyle = DIM; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
  c.fillStyle = FG;
  keys.forEach((k) => { const x = X(k.t); c.beginPath(); c.moveTo(x, y - 4); c.lineTo(x + 4, y); c.lineTo(x, y + 4); c.lineTo(x - 4, y); c.closePath(); c.fill(); });
  const lt = th.still ? end : (t % (0.35 + end + 0.9)) - 0.35;
  if (lt >= 0 && lt <= end) { c.strokeStyle = ACC; c.lineWidth = 2; c.beginPath(); c.moveTo(X(lt), y - 7); c.lineTo(X(lt), y + 7); c.stroke(); c.lineWidth = 1; }
  c.fillStyle = DIM; c.font = '10px sans-serif'; c.textAlign = 'right';
  const a = th.args || {};
  c.fillText(`${end.toFixed(2)} s${a.ease ? ` · ${a.ease}` : ''}${a.overshoot ? ' · overshoot' : ''}`, x1, y - 8); c.textAlign = 'left';
}
function draw(c, W, H, thumb, t) {
  theme();
  const fn = DRAW[thumb.k];
  if (fn) fn(c, W, H, thumb, t);
  if (thumb.strip) keyStrip(c, W, H, thumb, t);
}

module.exports = { draw, DRAW, EXPR_FN, planKeys };
