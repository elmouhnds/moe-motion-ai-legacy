'use strict';
/**
 * Canvas thumbnails for Studio tiles. Each recipe draws one frame at time t (seconds);
 * the shared loop in widgets.js animates the visible ones and stops when they unmount.
 */
const L = require('../../../features/grid/layouts');
const GX = require('../../../features/grid/expressions');
const { LOOKS } = require('../../../features/glass/tools');
const { hexToRgb } = require('../../../features/brand/brands');
const PAL = require('../../../features/design/palettes');

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

const DRAW = {
  move(c, W, H, th, t) {
    const p = eOut(phase(t));
    const k = th.dir === 'in' ? 1 - p : p;
    const bw = W * 0.36, bh = H * 0.28;
    const x = W / 2 - bw / 2 + th.dx * k * W * 0.75, y = H / 2 - bh / 2 + th.dy * k * H * 0.8;
    c.fillStyle = DIM; rrect(c, W / 2 - bw / 2, H / 2 - bh / 2, bw, bh, 4); c.setLineDash([3, 3]); c.strokeStyle = DIM; c.stroke(); c.setLineDash([]);
    c.fillStyle = FG; rrect(c, x, y, bw, bh, 4); c.fill();
  },
  fade(c, W, H, th, t) {
    const p = eOut(phase(t));
    c.globalAlpha = th.dir === 'in' ? p : 1 - p;
    c.fillStyle = FG; rrect(c, W * 0.3, H * 0.34, W * 0.4, H * 0.32, 4); c.fill(); c.globalAlpha = 1;
  },
  scale(c, W, H, th, t) {
    const ph = phase(t);
    const s = th.dir === 'in' ? (th.over ? Math.max(0, eBack(ph)) : eOut(ph)) : 1 - eOut(ph);
    const bw = W * 0.34 * s, bh = H * 0.42 * s;
    c.fillStyle = FG; rrect(c, W / 2 - bw / 2, H / 2 - bh / 2, Math.max(bw, 0.1), Math.max(bh, 0.1), 4); c.fill();
  },
  spin(c, W, H, th, t) {
    const p = eBack(phase(t));
    c.save(); c.translate(W / 2, H / 2); c.rotate((1 - p) * -Math.PI); c.fillStyle = FG; rrect(c, -W * 0.15, -H * 0.2, W * 0.3, H * 0.4, 4); c.fill(); c.restore();
  },
  trim(c, W, H, th, t) {
    const ph = phase(t, 1.4, 2.8);
    let a = 0, b = 1;
    if (th.mode === 'draw') b = eOut(ph);
    if (th.mode === 'erase') a = eOut(ph);
    if (th.mode === 'travel') { b = clamp01(eOut(ph) * 1.5); a = clamp01(eOut(ph) * 1.5 - 0.5); }
    if (th.mode === 'drawErase') { b = clamp01(ph * 2); a = clamp01(ph * 2 - 1); }
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
    const n = th.mode === 'phyllo' ? 34 : th.mode === 'sphere' ? 40 : 12;
    const p = Object.assign(GX.defaultParams(th.mode), { columns: 4, spacingX: 52, spacingY: 40, radius: th.mode === 'spiral' ? 10 : 70, arc: th.arc || 360, rowOffset: th.rowOffset || 0, spread: 13, spiralStep: 6, angleStep: 32, ringSpacing: 30, sphereSpin: t * 25, faceCenter: th.mode !== 'rect', buildStyle: 4, buildOrder: 3, buildStagger: 70 });
    p.build = th.build ? clamp01(phase(t, 1.6, 2.8)) * 100 : 100;
    if (th.mode === 'path') p.path = { point: (u) => [-110 + 220 * u, 30 - 60 * Math.sin(u * Math.PI)], tangent: (u) => [220, -60 * Math.PI * Math.cos(u * Math.PI)] };
    const k = Math.min(W / 260, H / 160);
    const pts = L.place(p, n).map((it) => Object.assign(it, { m: L.modifiers(p, it, n) }));
    if (th.mode === 'sphere') pts.sort((a, b) => a.z - b.z);
    for (const it of pts) {
      const depth = th.mode === 'sphere' ? (it.z / p.radius + 1) / 2 : 0;
      const s = it.m.scale * (th.mode === 'sphere' ? 1 - depth * 0.5 : 1) * (n > 20 ? 0.45 : 1);
      c.save(); c.translate(W / 2 + (it.x + it.m.dx) * k, H / 2 + (it.y + it.m.dy) * k); c.rotate((it.m.rot * Math.PI) / 180);
      c.globalAlpha = clamp01(it.m.opacity) * (th.mode === 'sphere' ? 1 - depth * 0.6 : 1);
      c.fillStyle = it.i === 0 ? ACC : FG; rrect(c, -16 * k * s, -11 * k * s, 32 * k * s, 22 * k * s, 2); c.fill(); c.restore();
    }
    c.globalAlpha = 1;
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
  /** Background tile: the real gradient for that palette + slow drift, with swatches along the bottom. */
  bg(c, W, H, th, t) {
    const pal = PAL.byId(th.palette);
    if (!pal) return;
    const col = pal.colors;
    const style = th.style || 'linear';
    const dx = Math.sin(t * 0.5) * W * 0.08, dy = Math.cos(t * 0.4) * H * 0.08;
    let g;
    if (style === 'radial') { g = c.createRadialGradient(W / 2 + dx, H / 2 + dy, 0, W / 2, H / 2, Math.hypot(W, H) / 2); g.addColorStop(0, col[th.from || 0]); g.addColorStop(1, col[th.to === undefined ? 2 : th.to]); }
    else { g = c.createLinearGradient(dx, dy, W - dx, H - dy); g.addColorStop(0, col[th.from || 0]); g.addColorStop(1, col[th.to === undefined ? 2 : th.to]); }
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (style === 'mesh') {
      [[0.15, 0.2, 2], [0.85, 0.2, 3], [0.2, 0.85, 4], [0.85, 0.8, 1]].forEach(([x, y, i], k) => {
        const rg = c.createRadialGradient(W * x + Math.sin(t * 0.6 + k) * 8, H * y, 0, W * x, H * y, W * 0.55);
        rg.addColorStop(0, col[i]); rg.addColorStop(1, 'rgba(0,0,0,0)');
        c.globalAlpha = 0.75; c.fillStyle = rg; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
      });
    }
    const sw = W / 5;
    col.forEach((hex, i) => { c.fillStyle = hex; c.fillRect(i * sw, H - 6, sw, 6); });
  },
  /** Palette strip (Colorize / palette pickers). */
  palette(c, W, H, th) {
    const pal = PAL.byId(th.palette);
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

/** Draw one thumbnail frame. */
function draw(c, W, H, thumb, t) {
  theme();
  const fn = DRAW[thumb.k];
  if (fn) fn(c, W, H, thumb, t);
}

module.exports = { draw, DRAW, EXPR_FN };
