'use strict';
/**
 * Grid layouts (pure). The SAME maths is emitted as expressions (expressions.js),
 * so the panel preview, the verification read-back and After Effects agree.
 *
 * Every mode returns local positions around (0, 0) = the grid null, plus a facing
 * angle (degrees) used by "Face Center" / "Orient to Path".
 */

const MODES = [
  { id: 'rect', label: 'Grid', menu: 'Rectangular' },
  { id: 'radial', label: 'Radial', menu: 'Radial' },
  { id: 'spiral', label: 'Spiral', menu: 'Spiral' },
  { id: 'phyllo', label: 'Sunflower', menu: 'Phyllotaxis' },
  { id: 'path', label: 'Path', menu: 'Path' },
  { id: 'sphere', label: 'Sphere', menu: 'Sphere (3D)' }
];
const ORDERS = ['Rows', 'Columns', 'Snake', 'Random'];
const BUILD_ORDERS = ['Index', 'Reverse', 'Center Out', 'Edges In', 'Random'];
const BUILD_STYLES = ['Pop', 'Fade', 'Rise', 'Pop + Fade', 'Drop', 'Spin In'];
const GOLDEN_DEG = 137.50776405003785;
const GOLDEN_RAD = 2.399963229728653;

/** Park–Miller PRNG (exact in doubles, same in expressions). */
function prng(seed) {
  let s = Math.abs(Math.round(seed)) % 2147483646 + 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

/** slot index for item k (0..n-1) under an order; Random = seeded permutation. */
function permutation(n, seed) {
  const r = prng(seed);
  const p = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  return p;
}

/**
 * place(params, n) -> [{ x, y, z, face, f }]   (f = build start fraction 0..1)
 * params: { mode, columns, spacingX, spacingY, rowOffset, columnOffset, order (1..4), reverse,
 *           radius, startAngle, arc, ringSize, ringSpacing, spiralStep, angleStep, spread,
 *           sphereSpin, sphereTilt, seed, buildOrder (1..5), path: { points(pct) -> [x,y], tangent(pct) } }
 */
function place(p, n) {
  const out = [];
  const perm = p.order === 4 ? permutation(n, p.seed || 1) : null;
  const C = Math.max(1, Math.round(p.columns || 1));
  const R = Math.ceil(n / C);
  let maxDist = 0;
  for (let i = 0; i < n; i++) {
    let k = p.reverse ? n - 1 - i : i;
    if (perm) k = perm[k];
    let x = 0, y = 0, z = 0, face = 0;
    if (p.mode === 'rect') {
      let row, col;
      if (p.order === 2) { row = k % R; col = Math.floor(k / R); } else { row = Math.floor(k / C); col = k % C; if (p.order === 3 && row % 2 === 1) col = C - 1 - col; }
      x = (col - (C - 1) / 2) * p.spacingX + (row % 2 === 1 ? (p.rowOffset / 100) * p.spacingX : 0);
      y = (row - (R - 1) / 2) * p.spacingY + (col % 2 === 1 ? (p.columnOffset / 100) * p.spacingY : 0);
      maxDist = Math.hypot(((C - 1) / 2 + Math.abs(p.rowOffset) / 100) * p.spacingX, ((R - 1) / 2 + Math.abs(p.columnOffset) / 100) * p.spacingY);
    } else if (p.mode === 'radial') {
      const per = p.ringSize > 0 ? Math.round(p.ringSize) : n;
      const ri = Math.floor(k / per), j = k % per;
      const cnt = Math.min(per, n - ri * per);
      const full = Math.abs(p.arc) >= 359.999;
      const a = p.startAngle + (cnt > 1 ? (full ? (j * p.arc) / cnt : (j * p.arc) / (cnt - 1)) : 0);
      const rad = p.radius + ri * p.ringSpacing;
      x = rad * Math.cos(((a - 90) * Math.PI) / 180);
      y = rad * Math.sin(((a - 90) * Math.PI) / 180);
      face = a;
      maxDist = p.radius + (Math.ceil(n / per) - 1) * p.ringSpacing;
    } else if (p.mode === 'spiral') {
      const a = p.startAngle + k * p.angleStep;
      const rad = p.radius + k * p.spiralStep;
      x = rad * Math.cos(((a - 90) * Math.PI) / 180);
      y = rad * Math.sin(((a - 90) * Math.PI) / 180);
      face = a;
      maxDist = Math.abs(p.radius) + (n - 1) * Math.abs(p.spiralStep);
    } else if (p.mode === 'phyllo') {
      const a = p.startAngle + k * GOLDEN_DEG;
      const rad = p.spread * Math.sqrt(k + 0.5);
      x = rad * Math.cos(((a - 90) * Math.PI) / 180);
      y = rad * Math.sin(((a - 90) * Math.PI) / 180);
      face = a;
      maxDist = p.spread * Math.sqrt(n - 0.5);
    } else if (p.mode === 'path') {
      const span = p.pathEnd - p.pathStart;
      let pct = p.pathStart + (n > 1 ? (span * k) / (p.pathClosed && Math.abs(span) >= 99.999 ? n : n - 1) : 0) + p.pathOffset;
      if (pct < 0 || pct > 100) pct = ((pct % 100) + 100) % 100;
      if (p.path) { const q = p.path.point(pct / 100); x = q[0]; y = q[1]; const t = p.path.tangent(pct / 100); face = (Math.atan2(t[1], t[0]) * 180) / Math.PI; }
      maxDist = 1;
    } else if (p.mode === 'sphere') {
      const yN = n > 1 ? 1 - ((k + 0.5) / n) * 2 : 0;
      const rr = Math.sqrt(Math.max(0, 1 - yN * yN));
      const th = k * GOLDEN_RAD;
      let X = Math.cos(th) * rr, Y = yN, Z = Math.sin(th) * rr;
      const s = (p.sphereSpin * Math.PI) / 180, t = (p.sphereTilt * Math.PI) / 180;
      const X1 = X * Math.cos(s) + Z * Math.sin(s), Z1 = -X * Math.sin(s) + Z * Math.cos(s);
      const Y2 = Y * Math.cos(t) - Z1 * Math.sin(t), Z2 = Y * Math.sin(t) + Z1 * Math.cos(t);
      X = X1; Y = Y2; Z = Z2;
      x = X * p.radius; y = Y * p.radius; z = Z * p.radius;
      face = (Math.atan2(X, -Z) * 180) / Math.PI;
      maxDist = p.radius;
    }
    out.push({ i, k, x, y, z, face });
  }
  // Build start fraction.
  const rnd = prng((p.seed || 1) + 7919);
  const rands = Array.from({ length: n }, () => rnd());
  for (const o of out) {
    const lin = n > 1 ? o.k / (n - 1) : 0;
    const dist = p.mode === 'path' ? Math.abs(lin - 0.5) * 2 : (maxDist > 0 ? Math.min(1, Math.hypot(o.x, o.y, o.z) / maxDist) : 0);
    o.f = [lin, 1 - lin, dist, 1 - dist, rands[o.i]][(p.buildOrder || 1) - 1];
  }
  return out;
}

/** Item modifiers at build progress — shared with expressions (scale %, rotation °, opacity %, offset). */
function modifiers(p, item, n) {
  const B = p.build / 100, S = Math.min(Math.max(p.buildStagger / 100, 0), 1);
  const pr = Math.min(Math.max((B - item.f * S) / Math.max(1 - S, 0.05), 0), 1);
  const eOut = 1 - Math.pow(1 - pr, 3);
  const back = 1 + 2.70158 * Math.pow(pr - 1, 3) + 1.70158 * Math.pow(pr - 1, 2);
  const r = prng((p.seed || 1) * 31 + item.i * 7 + 3);
  const jx = (r() * 2 - 1) * p.randomPosition, jy = (r() * 2 - 1) * p.randomPosition, jr = (r() * 2 - 1) * p.randomRotation, js = (r() * 2 - 1) * p.randomScale;
  let scale = (p.itemScale / 100) * Math.max(0, 1 + (p.scaleStep / 100) * item.k) * Math.max(0, 1 + js / 100);
  let rot = p.twist * item.k + jr + (p.faceCenter ? item.face : 0);
  let opacity = 1;
  let dy = 0;
  const st = p.buildStyle || 1;
  if (st === 1) scale *= Math.max(back, 0);
  else if (st === 2) opacity *= eOut;
  else if (st === 3) { dy += (1 - eOut) * p.buildDistance; opacity *= eOut; }
  else if (st === 4) { scale *= Math.max(back, 0); opacity *= eOut; }
  else if (st === 5) { dy -= (1 - eOut) * p.buildDistance; opacity *= eOut; }
  else if (st === 6) { scale *= eOut; rot += (1 - eOut) * -180; }
  return { scale, rot, opacity, dx: jx, dy: dy + jy, progress: pr };
}

/** Smart defaults from item sizes and the comp (auto spacing / columns / radius). */
function autoParams({ n, maxW, maxH, compW, compH, gap = 0.25 }) {
  const sx = Math.max(10, Math.round(maxW * (1 + gap)));
  const sy = Math.max(10, Math.round(maxH * (1 + gap)));
  const aspect = compW / compH;
  const columns = Math.max(1, Math.min(n, Math.round(Math.sqrt((n * aspect * sy) / sx))));
  const radius = Math.max(120, Math.round((n * Math.max(sx, sy)) / (2 * Math.PI)));
  return { spacingX: sx, spacingY: sy, columns, radius, spread: Math.round(Math.max(sx, sy) * 0.55), ringSpacing: Math.round(Math.max(sx, sy)) };
}

module.exports = { MODES, ORDERS, BUILD_ORDERS, BUILD_STYLES, GOLDEN_DEG, GOLDEN_RAD, prng, permutation, place, modifiers, autoParams };
