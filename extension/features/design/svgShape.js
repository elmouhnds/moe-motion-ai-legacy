'use strict';
/**
 * SVG → After Effects Shape conversion (pure, testable).
 *
 * AE's Shape object (Scripting Guide › Shape) stores, per path:
 *   vertices[]     absolute points
 *   inTangents[]   relative to their vertex
 *   outTangents[]  relative to their vertex
 *   closed         boolean
 * Every SVG segment is converted to a cubic Bézier: lines get zero tangents, quadratics are
 * raised to cubics exactly, and elliptical arcs are split into ≤ 90° cubic pieces.
 *
 * Supported elements: path (M L H V C S Q T A Z, absolute + relative), circle, ellipse,
 * rect (incl. rounded), line, polyline, polygon — everything Lucide uses.
 */

const KAPPA = 0.5522847498307936;
const EPS = 1e-6;

/* ---------- path data tokenizer ---------- */
function tokenize(d) {
  const out = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)/g;
  let m;
  while ((m = re.exec(d))) out.push(m[1] ? { cmd: m[1] } : { num: parseFloat(m[2]), raw: m[2] });
  return out;
}

/** Arc flags may be written without separators ("a1 1 0 011 1"): split single-digit runs. */
function expandFlags(tokens) {
  const out = [];
  let cmd = null, argi = 0;
  for (const t of tokens) {
    if (t.cmd) { cmd = t.cmd; argi = 0; out.push(t); continue; }
    if (cmd && /[Aa]/.test(cmd)) {
      const pos = argi % 7;
      if ((pos === 3 || pos === 4) && /^[01]{2,}/.test(t.raw)) {
        // "011" → flag 0, flag 1, then the rest as a number
        const raw = t.raw;
        out.push({ num: +raw[0] }); argi++;
        if (pos === 3) { out.push({ num: +raw[1] }); argi++; const rest = raw.slice(2); if (rest) { out.push({ num: parseFloat(rest), raw: rest }); argi++; } }
        else { const rest = raw.slice(1); if (rest) { out.push({ num: parseFloat(rest), raw: rest }); argi++; } }
        continue;
      }
    }
    out.push(t); argi++;
  }
  return out;
}

/* ---------- builder ---------- */
function newPath(p) { return { pts: [{ p: p.slice(), in: [0, 0], out: [0, 0] }], closed: false }; }
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const near = (a, b) => Math.abs(a[0] - b[0]) < 1e-4 && Math.abs(a[1] - b[1]) < 1e-4;

function cubicTo(path, c1, c2, p) {
  const last = path.pts[path.pts.length - 1];
  last.out = sub(c1, last.p);
  path.pts.push({ p: p.slice(), in: sub(c2, p), out: [0, 0] });
}
function lineTo(path, p) { path.pts.push({ p: p.slice(), in: [0, 0], out: [0, 0] }); }

function closePath(path) {
  path.closed = true;
  const pts = path.pts;
  if (pts.length > 1 && near(pts[0].p, pts[pts.length - 1].p)) {
    const last = pts.pop();
    pts[0].in = last.in;
  }
}

/** Elliptical arc (SVG endpoint parameterization, spec F.6.5) → cubic pieces. */
function arcToCubics(p0, rx, ry, phiDeg, large, sweep, p) {
  if (near(p0, p)) return [];
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (rx < EPS || ry < EPS) return [{ line: p }];
  const phi = phiDeg * Math.PI / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (p0[0] - p[0]) / 2, dy = (p0[1] - p[1]) / 2;
  const x1 = cos * dx + sin * dy, y1 = -sin * dx + cos * dy;
  let lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lam > 1) { lam = Math.sqrt(lam); rx *= lam; ry *= lam; }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  let co = Math.sqrt(Math.max(0, num / den));
  if (!!large === !!sweep) co = -co;
  const cx1 = co * rx * y1 / ry, cy1 = -co * ry * x1 / rx;
  const cx = cos * cx1 - sin * cy1 + (p0[0] + p[0]) / 2;
  const cy = sin * cx1 + cos * cy1 + (p0[1] + p[1]) / 2;
  const ang = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
  const th1 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dth = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && dth > 0) dth -= 2 * Math.PI;
  if (sweep && dth < 0) dth += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(dth) / (Math.PI / 2) - 1e-9));
  const step = dth / n;
  const k = 4 / 3 * Math.tan(step / 4);
  const pt = (t) => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos];
  const dpt = (t) => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos];
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = th1 + i * step, b = a + step;
    const pa = pt(a), pb = i === n - 1 ? p.slice() : pt(b), da = dpt(a), db = dpt(b);
    out.push({ c1: [pa[0] + k * da[0], pa[1] + k * da[1]], c2: [pb[0] - k * db[0], pb[1] - k * db[1]], p: pb });
  }
  return out;
}

/** Parse an SVG path "d" string into AE-style paths. */
function parsePath(d) {
  const toks = expandFlags(tokenize(String(d || '')));
  const paths = [];
  let cur = null, pos = [0, 0], start = [0, 0], cmd = null, i = 0, lastC2 = null, lastQ = null, prevCmd = '';
  const n = () => { const t = toks[i++]; if (!t || t.num === undefined) throw new Error(`Bad path data near token ${i}`); return t.num; };
  const ensure = () => { if (!cur) { cur = newPath(pos); paths.push(cur); } };
  while (i < toks.length) {
    if (toks[i].cmd) cmd = toks[i++].cmd;
    else if (!cmd) throw new Error('Path data must start with a command');
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const pt = (x, y) => (rel ? [pos[0] + x, pos[1] + y] : [x, y]);
    if (C === 'Z') {
      if (cur) closePath(cur);
      pos = start.slice(); cur = null; lastC2 = null; lastQ = null; prevCmd = 'Z';
      continue;
    }
    if (C === 'M') {
      pos = pt(n(), n()); start = pos.slice();
      cur = newPath(pos); paths.push(cur);
      cmd = rel ? 'l' : 'L'; // implicit lineto for following pairs
      lastC2 = null; lastQ = null; prevCmd = 'M';
      continue;
    }
    ensure();
    if (C === 'L') { pos = pt(n(), n()); lineTo(cur, pos); lastC2 = null; lastQ = null; }
    else if (C === 'H') { const x = n(); pos = [rel ? pos[0] + x : x, pos[1]]; lineTo(cur, pos); lastC2 = null; lastQ = null; }
    else if (C === 'V') { const y = n(); pos = [pos[0], rel ? pos[1] + y : y]; lineTo(cur, pos); lastC2 = null; lastQ = null; }
    else if (C === 'C') { const c1 = pt(n(), n()), c2 = pt(n(), n()), p = pt(n(), n()); cubicTo(cur, c1, c2, p); pos = p; lastC2 = c2; lastQ = null; }
    else if (C === 'S') {
      const c1 = lastC2 && /[CS]/.test(prevCmd) ? add(pos, sub(pos, lastC2)) : pos.slice();
      const c2 = pt(n(), n()), p = pt(n(), n());
      cubicTo(cur, c1, c2, p); pos = p; lastC2 = c2; lastQ = null;
    } else if (C === 'Q' || C === 'T') {
      const q = C === 'Q' ? pt(n(), n()) : (lastQ && /[QT]/.test(prevCmd) ? add(pos, sub(pos, lastQ)) : pos.slice());
      const p = pt(n(), n());
      const c1 = [pos[0] + 2 / 3 * (q[0] - pos[0]), pos[1] + 2 / 3 * (q[1] - pos[1])];
      const c2 = [p[0] + 2 / 3 * (q[0] - p[0]), p[1] + 2 / 3 * (q[1] - p[1])];
      cubicTo(cur, c1, c2, p); pos = p; lastQ = q; lastC2 = null;
    } else if (C === 'A') {
      const rx = n(), ry = n(), rot = n(), large = n(), sweep = n(), p = pt(n(), n());
      for (const seg of arcToCubics(pos, rx, ry, rot, large, sweep, p)) {
        if (seg.line) lineTo(cur, seg.line); else cubicTo(cur, seg.c1, seg.c2, seg.p);
      }
      pos = p; lastC2 = null; lastQ = null;
    } else throw new Error(`Unsupported path command ${cmd}`);
    prevCmd = C;
  }
  return paths.filter((p) => p.pts.length > 1 || p.closed);
}

/* ---------- elements ---------- */
const num = (v, d = 0) => { const x = parseFloat(v); return Number.isFinite(x) ? x : d; };

function ellipsePath(cx, cy, rx, ry) {
  const kx = rx * KAPPA, ky = ry * KAPPA;
  return { closed: true, pts: [
    { p: [cx, cy - ry], in: [-kx, 0], out: [kx, 0] },
    { p: [cx + rx, cy], in: [0, -ky], out: [0, ky] },
    { p: [cx, cy + ry], in: [kx, 0], out: [-kx, 0] },
    { p: [cx - rx, cy], in: [0, ky], out: [0, -ky] }
  ] };
}

function rectPath(x, y, w, h, rx, ry) {
  if (rx === undefined && ry !== undefined) rx = ry;
  if (ry === undefined && rx !== undefined) ry = rx;
  rx = Math.min(Math.max(rx || 0, 0), w / 2); ry = Math.min(Math.max(ry || 0, 0), h / 2);
  if (rx < EPS || ry < EPS) {
    return { closed: true, pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map((p) => ({ p, in: [0, 0], out: [0, 0] })) };
  }
  const kx = rx * KAPPA, ky = ry * KAPPA;
  return { closed: true, pts: [
    { p: [x + rx, y], in: [-kx, 0], out: [0, 0] },
    { p: [x + w - rx, y], in: [0, 0], out: [kx, 0] },
    { p: [x + w, y + ry], in: [0, -ky], out: [0, 0] },
    { p: [x + w, y + h - ry], in: [0, 0], out: [0, ky] },
    { p: [x + w - rx, y + h], in: [kx, 0], out: [0, 0] },
    { p: [x + rx, y + h], in: [0, 0], out: [-kx, 0] },
    { p: [x, y + h - ry], in: [0, ky], out: [0, 0] },
    { p: [x, y + ry], in: [0, 0], out: [0, -ky] }
  ] };
}

function pointsList(s) { const v = String(s || '').trim().split(/[\s,]+/).map(Number); const out = []; for (let i = 0; i + 1 < v.length; i += 2) out.push([v[i], v[i + 1]]); return out; }

/** One SVG element ([tag, attrs]) → AE-style paths. */
function elementPaths([tag, a]) {
  switch (tag) {
    case 'path': return parsePath(a.d);
    case 'circle': return [ellipsePath(num(a.cx), num(a.cy), num(a.r), num(a.r))];
    case 'ellipse': return [ellipsePath(num(a.cx), num(a.cy), num(a.rx), num(a.ry))];
    case 'rect': return [rectPath(num(a.x), num(a.y), num(a.width), num(a.height), a.rx !== undefined ? num(a.rx) : undefined, a.ry !== undefined ? num(a.ry) : undefined)];
    case 'line': return [{ closed: false, pts: [[num(a.x1), num(a.y1)], [num(a.x2), num(a.y2)]].map((p) => ({ p, in: [0, 0], out: [0, 0] })) }];
    case 'polyline':
    case 'polygon': {
      const pts = pointsList(a.points).map((p) => ({ p, in: [0, 0], out: [0, 0] }));
      const path = { closed: tag === 'polygon', pts };
      if (path.closed && pts.length > 1 && near(pts[0].p, pts[pts.length - 1].p)) pts.pop();
      return pts.length > 1 ? [path] : [];
    }
    default: return [];
  }
}

/**
 * Icon nodes (24×24 grid) → AE shapes centred on (0,0), scaled to `size` px.
 * Returns [{ v, i, o, c }] (the compact form shapes.insert takes) plus bounds.
 */
function toAEShapes(nodes, { size = 240, grid = 24 } = {}) {
  const k = size / grid, half = grid / 2;
  const shapes = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    for (const p of elementPaths(node)) {
      const v = p.pts.map((q) => [(q.p[0] - half) * k, (q.p[1] - half) * k]);
      for (const [x, y] of v) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
      shapes.push({
        v: v.map(round),
        i: p.pts.map((q) => round([q.in[0] * k, q.in[1] * k])),
        o: p.pts.map((q) => round([q.out[0] * k, q.out[1] * k])),
        c: !!p.closed
      });
    }
  }
  return { shapes, bounds: shapes.length ? { minX, minY, maxX, maxY } : null };
}

function round(p) { return [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000]; }

/** Point on a cubic path segment (tests / previews). */
function segmentPoint(shape, idx, t) {
  const n = shape.v.length;
  const a = shape.v[idx], b = shape.v[(idx + 1) % n];
  const c1 = add(a, shape.o[idx]), c2 = add(b, shape.i[(idx + 1) % n]);
  const u = 1 - t;
  return [0, 1].map((d) => u * u * u * a[d] + 3 * u * u * t * c1[d] + 3 * u * t * t * c2[d] + t * t * t * b[d]);
}

/** SVG markup for previews (same nodes, rendered by the browser). */
function nodesToSvg(nodes, attrs = '') {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const body = nodes.map(([tag, a]) => `<${tag} ${Object.entries(a).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}/>`).join('');
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${attrs}>${body}</svg>`;
}

module.exports = { tokenize, parsePath, elementPaths, toAEShapes, arcToCubics, segmentPoint, nodesToSvg, KAPPA };
