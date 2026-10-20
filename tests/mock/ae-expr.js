'use strict';
/*
 * Small After Effects expression runtime for the mock. It evaluates the
 * expressions MOE generates (grid, zoom, glass, proximity, probes) so tests
 * can check their maths. It models the documented expression API subset MOE
 * uses: thisComp / thisLayer / thisProperty, effect()(), transform, toComp /
 * fromComp (2D chain + Z passthrough), sourceRectAtTime, hasParent / parent,
 * mask().maskPath / content().path with pointOnPath / tangentOnPath, and the
 * vector maths helpers. It is NOT the After Effects engine.
 */

function unwrap(v) {
  if (v && typeof v === 'object' && v.__isProp) return v.value;
  return v;
}
function arr(v) { v = unwrap(v); return Array.isArray(v) ? v : [v]; }

const vec = {
  add(a, b) { a = unwrap(a); b = unwrap(b); if (!Array.isArray(a)) return a + b; const n = Math.max(a.length, b.length); return Array.from({ length: n }, (_, i) => (a[i] || 0) + (b[i] || 0)); },
  sub(a, b) { a = unwrap(a); b = unwrap(b); if (!Array.isArray(a)) return a - b; const n = Math.max(a.length, b.length); return Array.from({ length: n }, (_, i) => (a[i] || 0) - (b[i] || 0)); },
  mul(a, k) { a = unwrap(a); k = unwrap(k); return Array.isArray(a) ? a.map((x) => x * k) : a * k; },
  div(a, k) { a = unwrap(a); k = unwrap(k); return Array.isArray(a) ? a.map((x) => x / k) : a / k; },
  clamp(v, lo, hi) { v = unwrap(v); return Array.isArray(v) ? v.map((x, i) => Math.min(Math.max(x, arr(lo)[i] !== undefined ? arr(lo)[i] : lo), arr(hi)[i] !== undefined ? arr(hi)[i] : hi)) : Math.min(Math.max(v, lo), hi); },
  length(a, b) { a = arr(a); if (b !== undefined) { b = arr(b); a = a.map((x, i) => x - (b[i] || 0)); } return Math.sqrt(a.reduce((s, x) => s + x * x, 0)); },
  normalize(a) { a = arr(a); const l = Math.sqrt(a.reduce((s, x) => s + x * x, 0)) || 1; return a.map((x) => x / l); },
  dot(a, b) { a = arr(a); b = arr(b); return a.reduce((s, x, i) => s + x * (b[i] || 0), 0); },
  degreesToRadians(d) { return d * Math.PI / 180; },
  radiansToDegrees(r) { return r * 180 / Math.PI; },
  linear(t, a, b, c, d) {
    if (c === undefined) { c = a; d = b; a = 0; b = 1; }
    t = unwrap(t); const u = b === a ? 1 : Math.min(Math.max((t - a) / (b - a), 0), 1);
    return Array.isArray(unwrap(c)) ? vec.add(c, vec.mul(vec.sub(d, c), u)) : unwrap(c) + (unwrap(d) - unwrap(c)) * u;
  },
  ease(t, a, b, c, d) {
    if (c === undefined) { c = a; d = b; a = 0; b = 1; }
    t = unwrap(t); let u = b === a ? 1 : Math.min(Math.max((t - a) / (b - a), 0), 1);
    u = u * u * (3 - 2 * u);
    return Array.isArray(unwrap(c)) ? vec.add(c, vec.mul(vec.sub(d, c), u)) : unwrap(c) + (unwrap(d) - unwrap(c)) * u;
  }
};

/** Property wrapper: `.value`, valueAtTime(), valueOf(), and array index access. */
function wrapProp(prop, layerCtx, t) {
  const get = (tt) => prop.valueAtTime(tt, false);
  const v = get(t);
  const w = { __isProp: true, name: prop.name, get value() { return get(t); }, valueAtTime: (tt) => get(tt), valueOf() { return Array.isArray(v) ? v : v; }, numKeys: prop.numKeys };
  if (Array.isArray(v)) { v.forEach((x, i) => { w[i] = x; }); w.length = v.length; }
  if (prop.propertyValueType === 6423 /* SHAPE */) {
    w.pointOnPath = (pct = 0.5, tt = t) => pathPoint(prop.valueAtTime(tt, false), pct).p;
    w.tangentOnPath = (pct = 0.5, tt = t) => pathPoint(prop.valueAtTime(tt, false), pct).tan;
  }
  return w;
}

/** Polyline approximation of a Shape (vertices only) — good enough for tests. */
function pathPoint(shape, pct) {
  const vs = shape.vertices.slice();
  if (shape.closed) vs.push(vs[0]);
  const segs = [];
  let total = 0;
  for (let i = 0; i < vs.length - 1; i++) { const l = Math.hypot(vs[i + 1][0] - vs[i][0], vs[i + 1][1] - vs[i][1]); segs.push(l); total += l; }
  let d = Math.min(Math.max(pct, 0), 1) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const u = segs[i] ? d / segs[i] : 0;
      const a = vs[i], b = vs[i + 1];
      const tan = vec.normalize([b[0] - a[0], b[1] - a[1]]);
      return { p: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], tan };
    }
    d -= segs[i];
  }
  return { p: vs[0].slice(), tan: [1, 0] };
}

function tf(layer, name, t) {
  const g = layer.property('ADBE Transform Group');
  const p = g && g.property(name);
  return p ? p.valueAtTime(t, false) : null;
}

/** Layer → parent space (2D affine around anchor; Z passes through). */
function toParent(layer, pt, t) {
  const a = tf(layer, 'ADBE Anchor Point', t) || [0, 0];
  const p = tf(layer, 'ADBE Position', t) || [0, 0];
  const s = tf(layer, 'ADBE Scale', t) || [100, 100];
  const r = (tf(layer, 'ADBE Rotate Z', t) || 0) * Math.PI / 180;
  const x = (pt[0] - a[0]) * s[0] / 100;
  const y = (pt[1] - a[1]) * s[1] / 100;
  const out = [p[0] + x * Math.cos(r) - y * Math.sin(r), p[1] + x * Math.sin(r) + y * Math.cos(r)];
  if (pt.length > 2 || p.length > 2) out.push(((pt[2] || 0) - (a[2] || 0)) * ((s[2] || 100) / 100) + (p[2] || 0));
  return out;
}
function fromParent(layer, pt, t) {
  const a = tf(layer, 'ADBE Anchor Point', t) || [0, 0];
  const p = tf(layer, 'ADBE Position', t) || [0, 0];
  const s = tf(layer, 'ADBE Scale', t) || [100, 100];
  const r = -(tf(layer, 'ADBE Rotate Z', t) || 0) * Math.PI / 180;
  const dx = pt[0] - p[0], dy = pt[1] - p[1];
  const x = dx * Math.cos(r) - dy * Math.sin(r);
  const y = dx * Math.sin(r) + dy * Math.cos(r);
  const out = [x * 100 / s[0] + a[0], y * 100 / s[1] + a[1]];
  if (pt.length > 2 || p.length > 2) out.push(((pt[2] || 0) - (p[2] || 0)) * 100 / (s[2] || 100) + (a[2] || 0));
  return out;
}
function toCompPt(layer, pt, t) {
  let q = arr(pt).slice();
  for (let L = layer; L; L = L.parent) q = toParent(L, q, t);
  return q;
}
function fromCompPt(layer, pt, t) {
  const chain = [];
  for (let L = layer; L; L = L.parent) chain.unshift(L);
  let q = arr(pt).slice();
  for (const L of chain) q = fromParent(L, q, t);
  return q;
}

function exprLayer(L, t) {
  if (!L) throw new Error('Expression error: layer does not exist');
  const comp = L._comp;
  const self = {
    __layer: L,
    name: L.name, index: L.index, width: L.width, height: L.height, inPoint: L.inPoint, outPoint: L.outPoint, startTime: L.startTime,
    get hasParent() { return !!L.parent; },
    get parent() { if (!L.parent) throw new Error('Expression error: layer has no parent'); return exprLayer(L.parent, t); },
    toComp: (p, tt = t) => toCompPt(L, unwrap(p), tt),
    fromComp: (p, tt = t) => fromCompPt(L, unwrap(p), tt),
    sourceRectAtTime: () => L.sourceRectAtTime(t, false),
    effect(name) {
      const parade = L.property('ADBE Effect Parade');
      const fx = typeof name === 'number' ? parade.property(name) : parade._children.find((e) => e.name === name);
      if (!fx) throw new Error(`Expression error: effect "${name}" is missing`);
      const f = (pn) => {
        const p = typeof pn === 'number' ? fx.property(pn) : fx._children.find((c) => c.name === pn || c.name.endsWith(':' + pn));
        if (!p) throw new Error(`Expression error: effect parameter "${pn}" is missing`);
        if (p.propertyValueType === 6421 /* LAYER_INDEX */) { const v = p.valueAtTime(t, false); return v ? exprLayer(comp.layer(v), t) : null; }
        return wrapProp(p, self, t);
      };
      f.active = fx.enabled;
      return f;
    },
    mask(name) {
      const masks = L.property('ADBE Mask Parade');
      const m = masks && (typeof name === 'number' ? masks.property(name) : masks._children.find((x) => x.name === name));
      if (!m) throw new Error(`Expression error: mask "${name}" is missing`);
      return { maskPath: wrapProp(m.property('ADBE Mask Shape'), self, t) };
    },
    content(name) { return contentNode(L.property('ADBE Root Vectors Group'), name, self, t); }
  };
  const T = { anchorPoint: 'ADBE Anchor Point', position: 'ADBE Position', scale: 'ADBE Scale', rotation: 'ADBE Rotate Z', opacity: 'ADBE Opacity', xRotation: 'ADBE Rotate X', yRotation: 'ADBE Rotate Y' };
  self.transform = {};
  for (const [k, mn] of Object.entries(T)) {
    Object.defineProperty(self.transform, k, { get() { const g = L.property('ADBE Transform Group'); const p = g && g.property(mn); return p ? wrapProp(p, self, t) : undefined; } });
    Object.defineProperty(self, k, { get() { return self.transform[k]; } });
  }
  return self;
}

function contentNode(group, name, layerCtx, t) {
  if (!group) throw new Error('Expression error: no contents');
  const list = group.matchName === 'ADBE Vector Group' ? group.property('ADBE Vectors Group')._children : group._children;
  const node = typeof name === 'number' ? list[name - 1] : list.find((c) => c.name === name);
  if (!node) throw new Error(`Expression error: content "${name}" is missing`);
  const out = { content: (n) => contentNode(node, n, layerCtx, t) };
  if (node.matchName === 'ADBE Vector Shape - Group') out.path = wrapProp(node.property('ADBE Vector Shape'), layerCtx, t);
  return out;
}

/** Evaluate `prop`'s expression at comp time t. */
function evaluate(prop, t, extra = {}) {
  const layer = prop._layer();
  const comp = layer._comp;
  const thisLayer = exprLayer(layer, t);
  const thisComp = {
    name: comp.name, width: comp.width, height: comp.height, frameDuration: comp.frameDuration, duration: comp.duration, numLayers: comp.numLayers,
    layer(k) { const L = typeof k === 'number' ? comp.layer(k) : comp._layers.find((x) => x.name === k); return Object.assign(exprLayer(L, t), extra.layerExtras ? extra.layerExtras(L) : {}); }
  };
  const scope = Object.assign({}, vec, {
    thisComp, thisLayer, time: t, value: prop.valueAtTime(t, true), index: layer.index,
    thisProperty: { numKeys: prop.numKeys, value: prop.valueAtTime(t, true) },
    effect: thisLayer.effect, transform: thisLayer.transform, toComp: thisLayer.toComp, fromComp: thisLayer.fromComp,
    hasParent: thisLayer.hasParent, mask: thisLayer.mask, content: thisLayer.content, sourceRectAtTime: thisLayer.sourceRectAtTime,
    width: layer.width, height: layer.height, inPoint: layer.inPoint, outPoint: layer.outPoint
  });
  Object.defineProperty(scope, 'parent', { get() { return thisLayer.parent; } });
  for (const k of ['anchorPoint', 'position', 'scale', 'rotation', 'opacity']) Object.defineProperty(scope, k, { get() { return thisLayer.transform[k]; } });
  // eslint-disable-next-line no-new-func
  const fn = new Function('__s', '__code', 'with (__s) { return eval(__code); }');
  return unwrap(fn(scope, prop._expression));
}

module.exports = { evaluate, vec, pathPoint, toCompPt, fromCompPt };
