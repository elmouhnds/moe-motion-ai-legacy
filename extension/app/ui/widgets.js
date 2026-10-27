'use strict';
/**
 * Tool-specific UI widgets, looked up by tool id from toolBlock:
 *   body[toolId](args, setArgs, { h, app, ctx })   → rendered above the form
 *   result[toolId](runResult, { h, app })          → rendered under the report
 * Keeps feature modules free of DOM code.
 */
const { icon } = require('./dom');
const L = require('../../features/grid/layouts');
const GT = require('../../features/grid/tools');
const AT = require('../../features/adapt/tools');
const BZ = require('../../features/curves/bezier');
const TM = require('../../features/transform/math');

/* ---------- shared canvas loop (stops when canvases unmount) ---------- */
const live = new Set();
let raf = null;
/*
 * Motion (Settings › Appearance): "calm" (default) animates only the tile under the mouse and the
 * Inspector preview; "full" animates every visible tile; "reduced" draws once and holds.
 * At most 30 fps, off-screen canvases skipped, nothing drawn while the panel is hidden.
 */
let frame = 0, lastFrame = 0;
function loop(now) {
  raf = null;
  if (!live.size) return;
  raf = requestAnimationFrame(loop);
  if (now - lastFrame < 32 || (typeof document !== 'undefined' && document.hidden)) return;
  lastFrame = now;
  frame++;
  const mode = (typeof document !== 'undefined' && document.documentElement.getAttribute('data-motion')) || 'calm';
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1e9;
  for (const e of live) {
    if (!e.canvas.isConnected) { live.delete(e); continue; }
    if (frame % 6 === 0 || e.visible === undefined) { const r = e.canvas.getBoundingClientRect(); e.visible = r.bottom > -40 && r.top < vh + 40 && r.width > 0; }
    if (!e.visible) continue;
    let animate = mode === 'full';
    if (mode === 'calm') { const host = e.canvas.closest('.st-tile, .tp-card, .st-inspector, .tool'); animate = !!host && (host.classList.contains('st-tile') || host.classList.contains('tp-card') ? host.matches(':hover') : true); }
    // After a hover ends, draw the still frame once (it used to freeze on the last moving frame).
    if (!animate && e.drawn && !e.moving) continue;
    e.draw(animate ? now : null); e.drawn = true; e.moving = animate; // null = still frame (each drawer picks its rest pose)
  }
  if (!live.size && raf) { cancelAnimationFrame(raf); raf = null; }
}
function animated(canvas, draw) {
  const entry = { canvas, draw };
  live.add(entry);
  if (!raf && typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(loop);
  // First paint is the still frame. (It used to be a random moment of the animation, and it ran
  // after the loop's still frame, so Calm tiles could rest on an empty frame — e.g. Text "OUT" cards.)
  setTimeout(() => draw(null), 0);
  return canvas;
}
function prep(canvas) {
  const c = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 300, H = canvas.clientHeight || 160;
  if (canvas.width !== Math.round(W * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);
  return { c, W, H };
}
const css = (name, fb) => (typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() : '') || fb;

/** Fit a comp-sized frame into the canvas. */
function frameIn(W, H, cw, ch, pad = 10) {
  const k = Math.min((W - 2 * pad) / cw, (H - 2 * pad) / ch);
  return { k, ox: (W - cw * k) / 2, oy: (H - ch * k) / 2 };
}

/* ---------- Grid Builder preview ---------- */
function gridPreview(args, setArgs, { h, ctx }) {
  if (!ctx || !ctx.comp) return null;
  const items = (ctx.layers || []).filter((l) => !GT.GRID_NAME.test(l.name) && !['camera', 'light'].includes(l.type) && l.index !== args.pathLayer && l.index !== args.effector);
  const n = Math.max(items.length, 2) < 3 ? 12 : items.length;
  const maxW = Math.min(Math.max(...items.map((l) => l.width || 160), 160), ctx.comp.width / 3);
  const maxH = Math.min(Math.max(...items.map((l) => l.height || 160), 160), ctx.comp.height / 3);
  const auto = L.autoParams({ n, maxW: Math.min(maxW, 220), maxH: Math.min(maxH, 220), compW: ctx.comp.width, compH: ctx.comp.height });
  const p = GT.resolveParams(Object.assign({}, args), auto);
  const canvas = h('canvas', { class: 'grid-canvas', 'aria-label': 'Grid preview' });
  const accent = css('--accent', '#ff6f59');
  const dim = css('--text-3', '#777');
  animated(canvas, (now) => {
    const { c, W, H } = prep(canvas);
    const f = frameIn(W, H, ctx.comp.width, ctx.comp.height);
    c.strokeStyle = dim; c.lineWidth = 1; c.setLineDash([3, 3]);
    c.strokeRect(f.ox + 0.5, f.oy + 0.5, ctx.comp.width * f.k, ctx.comp.height * f.k);
    c.setLineDash([]);
    const cx = f.ox + (ctx.comp.width / 2) * f.k, cy = f.oy + (ctx.comp.height / 2) * f.k;
    let path = null;
    if (args.mode === 'path') {
      const pts = (u) => [ctx.comp.width * (0.1 + 0.8 * u), ctx.comp.height * (0.5 - 0.3 * Math.sin(u * Math.PI))];
      path = { point: (u) => { const q = pts(u); return [q[0] - ctx.comp.width / 2, q[1] - ctx.comp.height / 2]; }, tangent: (u) => { const a = pts(u), b = pts(Math.min(1, u + 0.01)); return [b[0] - a[0], b[1] - a[1]]; } };
      c.strokeStyle = dim; c.beginPath();
      for (let u = 0; u <= 1.001; u += 0.02) { const q = path.point(u); u === 0 ? c.moveTo(cx + q[0] * f.k, cy + q[1] * f.k) : c.lineTo(cx + q[0] * f.k, cy + q[1] * f.k); }
      c.stroke();
    }
    const cycle = (args.buildDuration || 1.5) + 1.2;
    const build = args.animateIn && now !== null ? Math.min(100, Math.max(0, (((now / 1000) % cycle) - 0.3) / (args.buildDuration || 1.5) * 100)) : 100;
    const pp = Object.assign({}, p, { build, path });
    const pts = L.place(pp, n).map((it) => Object.assign(it, { m: L.modifiers(pp, it, n) }));
    if (args.mode === 'sphere') pts.sort((a, b) => a.z - b.z);
    for (const it of pts) {
      const depth = args.mode === 'sphere' ? (it.z / Math.max(p.radius, 1) + 1) / 2 : 1;
      const s = it.m.scale * (args.mode === 'sphere' ? 0.55 + 0.45 * (1 - depth) : 1);
      const w = auto.spacingX / 1.25 * f.k * s, hh = auto.spacingY / 1.25 * f.k * s;
      const x = cx + (it.x + it.m.dx) * f.k, y = cy + (it.y + it.m.dy) * f.k;
      c.save(); c.translate(x, y); c.rotate((it.m.rot * Math.PI) / 180);
      c.globalAlpha = Math.max(0, Math.min(1, it.m.opacity)) * (args.mode === 'sphere' ? 0.35 + 0.65 * (1 - depth) : 1);
      c.fillStyle = it.i === 0 ? accent : css('--text-2', '#bbb');
      c.beginPath(); c.rect(-w / 2, -hh / 2, w, hh); c.fill();
      c.restore();
    }
    c.globalAlpha = 1; c.fillStyle = accent; c.beginPath(); c.arc(cx, cy, 2.5, 0, Math.PI * 2); c.fill();
  });
  return h('div', { class: 'field stack' }, h('label', {}, `Preview · ${n} item${n > 1 ? 's' : ''}${items.length < 2 ? ' (select layers)' : ''}`), canvas);
}

/* ---------- Layout guides preview ---------- */
function guidesPreview(args, setArgs, { h, ctx }) {
  if (!ctx || !ctx.comp) return null;
  const g = GT.layoutGuides(args, ctx.comp.width, ctx.comp.height);
  const canvas = h('canvas', { class: 'grid-canvas short', 'aria-label': 'Layout preview' });
  setTimeout(() => {
    const { c, W, H } = prep(canvas);
    const f = frameIn(W, H, ctx.comp.width, ctx.comp.height, 6);
    c.fillStyle = css('--bg-sunken', '#111'); c.fillRect(f.ox, f.oy, ctx.comp.width * f.k, ctx.comp.height * f.k);
    if (g.error) return;
    c.fillStyle = 'rgba(255,111,89,0.16)';
    for (const cell of g.cells) c.fillRect(f.ox + cell.x * f.k, f.oy + cell.y * f.k, cell.w * f.k, cell.h * f.k);
    c.strokeStyle = 'rgba(80,190,255,0.85)'; c.lineWidth = 1;
    for (const x of g.v) { c.beginPath(); c.moveTo(f.ox + x * f.k + 0.5, f.oy); c.lineTo(f.ox + x * f.k + 0.5, f.oy + ctx.comp.height * f.k); c.stroke(); }
    for (const y of g.h) { c.beginPath(); c.moveTo(f.ox, f.oy + y * f.k + 0.5); c.lineTo(f.ox + ctx.comp.width * f.k, f.oy + y * f.k + 0.5); c.stroke(); }
  }, 0);
  return h('div', { class: 'field stack' }, h('label', {}, g.error ? g.error : `Cell ${Math.round(g.cw)} × ${Math.round(g.ch)} px`), canvas);
}

/* ---------- Resize & Adapt: plan preview with overrides ---------- */
const ROLE_COLORS = { background: '#4a5568', band: '#2b8a9e', pinned: '#e0a526', content: '#ff6f59', point: '#9b8cff', nested: '#7cc36a', layout: '#ff6f59', skip: '#555' };
const ROLE_OPTIONS = ['auto', 'background', 'band', 'pinned', 'content', 'skip'];
const ZONE_OPTIONS = ['auto', 'TL', 'TC', 'TR', 'ML', 'MC', 'MR', 'BL', 'BC', 'BR'];

function drawPlanFrame(canvas, plan, which) {
  const { c, W, H } = prep(canvas);
  const fw = which === 'old' ? plan.src.width : plan.dst.width;
  const fh = which === 'old' ? plan.src.height : plan.dst.height;
  const f = frameIn(W, H, fw, fh, 6);
  c.save(); c.beginPath(); c.rect(f.ox, f.oy, fw * f.k, fh * f.k); c.clip();
  c.fillStyle = css('--bg-sunken', '#111'); c.fillRect(f.ox, f.oy, fw * f.k, fh * f.k);
  const layers = plan.layers.slice().reverse();
  for (const l of layers) {
    const b = which === 'old' ? l.boxOld : l.boxNew;
    if (!b) continue;
    const col = ROLE_COLORS[l.role] || '#888';
    c.globalAlpha = l.role === 'background' ? 0.35 : 0.8;
    c.fillStyle = col; c.fillRect(f.ox + b[0] * f.k, f.oy + b[1] * f.k, (b[2] - b[0]) * f.k, (b[3] - b[1]) * f.k);
    c.globalAlpha = 1; c.fillStyle = '#fff'; c.font = '9px sans-serif';
    if (l.role !== 'background') c.fillText(l.name.slice(0, 14), f.ox + b[0] * f.k + 2, f.oy + b[1] * f.k + 10);
  }
  if (which === 'new' && plan.safe) { c.strokeStyle = 'rgba(255,255,255,0.35)'; c.setLineDash([2, 3]); const s = plan.safe; c.strokeRect(f.ox + s[0] * f.k, f.oy + s[1] * f.k, (s[2] - s[0]) * f.k, (s[3] - s[1]) * f.k); c.setLineDash([]); }
  c.restore();
}

function adaptPreview(args, setArgs, { h, app, ctx }) {
  if (!ctx || !ctx.comp) return null;
  const s = app.state.get();
  const st = s.adaptPreview || {};
  const dst = AT.targetSize(args, ctx);
  const key = `${ctx.comp.id}|${dst && dst.width}x${dst && dst.height}|${args.method}|${args.margin}|${args.reflow}|${args.overrides || ''}`;
  const plan = st.key === key ? st.plan : null;
  const overrides = (() => { try { return JSON.parse(args.overrides || '{}'); } catch (e) { return {}; } })();
  const setOverride = (id, patch) => {
    const o = Object.assign({}, overrides);
    o[id] = Object.assign({}, o[id] || {}, patch);
    for (const k of Object.keys(o[id])) if (o[id][k] === undefined) delete o[id][k];
    if (!Object.keys(o[id]).length) delete o[id];
    setArgs(Object.assign({}, args, { overrides: Object.keys(o).length ? JSON.stringify(o) : '' }));
  };
  const load = async () => {
    if (!dst) return;
    app.state.set({ adaptPreview: { key, busy: true } });
    try {
      const p = await AT.buildPlan(app.services.host, ctx.comp.id, args, ctx.comp.time, dst);
      app.state.set({ adaptPreview: { key, plan: { src: p.src, dst: p.dst, safe: p.safe, layers: p.layers, warnings: p.warnings, nested: p.nested.map((n) => n.name) } } });
    } catch (e) { app.state.set({ adaptPreview: { key, error: e.message } }); }
  };
  const ask = async () => {
    const r = await app.runTool('adapt.suggestLayout', { format: args.format, width: args.width, height: args.height, brief: '' }, { resultKey: 'adapt.suggest.inline' });
    if (r && r.status === 'success') { setArgs(Object.assign({}, args, { overrides: JSON.stringify(r.result.overrides) })); app.toast('Claude layout loaded — review the preview, then Adapt'); }
    else if (r) app.toast((r.errors || [r.status]).join(' · '), 5000);
  };
  const busy = st.key === key && st.busy;
  const head = h('div', { class: 'actions', style: { marginTop: 0 } },
    h('button', { class: 'btn', disabled: busy || !dst, onclick: load }, busy ? h('span', { class: 'spin' }) : icon('eye', 'sm'), plan ? 'Refresh preview' : 'Preview layout'),
    h('button', { class: 'btn ghost', title: 'Claude proposes a layout (names, text and boxes are sent — no pixels)', onclick: ask }, icon('spark', 'sm'), 'Ask Claude'),
    args.overrides ? h('button', { class: 'btn ghost', title: 'Clear your adjustments', onclick: () => setArgs(Object.assign({}, args, { overrides: '' })) }, icon('undo', 'sm'), 'Reset') : null);
  if (!plan) return h('div', { class: 'field stack adapt-box' }, head, st.key === key && st.error ? h('div', { class: 'why' }, st.error) : h('div', { class: 'why' }, 'Preview measures every layer (nothing changes) and shows where each one lands.'));
  const old = h('canvas', { class: 'plan-canvas', 'aria-label': 'Current layout' });
  const neu = h('canvas', { class: 'plan-canvas', 'aria-label': 'Adapted layout' });
  setTimeout(() => { drawPlanFrame(old, plan, 'old'); drawPlanFrame(neu, plan, 'new'); }, 0);
  const rows = plan.layers.map((l) => {
    const o = overrides[l.layerId] || {};
    return h('div', { class: 'plan-row' },
      h('span', { class: 'label-dot', style: { background: ROLE_COLORS[l.role] || '#888' } }),
      h('span', { class: 'pn', title: l.reason }, l.name),
      h('select', { 'aria-label': `${l.name} role`, onchange: (e) => setOverride(l.layerId, { role: e.target.value === 'auto' ? undefined : e.target.value }) },
        ROLE_OPTIONS.map((r) => h('option', { value: r, selected: (o.role || 'auto') === r }, r === 'auto' ? `auto (${l.role})` : r))),
      h('select', { 'aria-label': `${l.name} zone`, onchange: (e) => setOverride(l.layerId, { zone: e.target.value === 'auto' ? undefined : e.target.value }) },
        ZONE_OPTIONS.map((z) => h('option', { value: z, selected: (o.zone || 'auto') === z }, z === 'auto' ? `auto (${l.zone})` : z))));
  });
  return h('div', { class: 'field stack adapt-box' }, head,
    h('div', { class: 'plan-frames' }, h('div', {}, old, h('div', { class: 'cap' }, `${plan.src.width}×${plan.src.height}`)), icon('chev'), h('div', {}, neu, h('div', { class: 'cap' }, `${plan.dst.width}×${plan.dst.height}`))),
    h('div', { class: 'plan-list' }, rows),
    plan.nested.length ? h('div', { class: 'why' }, `Adapted inside: ${plan.nested.join(', ')}`) : null,
    plan.warnings.map((w) => h('div', { class: 'why' }, w)));
}

/* ---------- Glass: tint from the Brand Kit ---------- */
function glassTint(args, setArgs, { h, app }) {
  const colors = app.services.brands.list().flatMap((b) => b.colors.map((c) => Object.assign({ brand: b.name }, c))).slice(0, 16);
  if (!colors.length) return null;
  return h('div', { class: 'field stack' }, h('label', {}, 'Tint from Brand Kit'),
    h('div', { class: 'mini-swatches' }, h('button', { class: `mini-sw none ${!args.tint ? 'on' : ''}`, title: 'Look colour', onclick: () => setArgs(Object.assign({}, args, { tint: '' })) }, '∅'),
      colors.map((c) => h('button', { class: `mini-sw ${args.tint && args.tint.toUpperCase() === c.hex.toUpperCase() ? 'on' : ''}`, title: `${c.brand} · ${c.name || c.hex}`, style: { background: c.hex }, onclick: () => setArgs(Object.assign({}, args, { tint: c.hex })) }))));
}

/* ---------- Generate on Green ---------- */
function greenResult(r, { h, app }) {
  if (!r || r.status !== 'success') return null;
  const g = r.result;
  return h('div', { class: 'analysis gen-out' },
    h('div', { class: 'explain' }, h('b', {}, g.title), ` · ${g.kind} · ${g.frame}`),
    h('pre', { class: 'prompt' }, g.prompt),
    h('div', { class: 'why' }, `Negative: ${g.negative}`),
    h('div', { class: 'why' }, `Keying: spill ${g.keying.spillRisk}, choke ${g.keying.choke}px — ${g.keying.advice}`),
    h('div', { class: 'actions wrap' },
      h('button', { class: 'btn primary', onclick: () => app.copy(g.prompt) }, icon('copy', 'sm'), 'Copy prompt'),
      h('button', { class: 'btn ghost', onclick: () => app.copy(g.negative) }, 'Copy negative'),
      h('button', { class: 'btn ghost', onclick: () => app.prefillTool('generate.importKey', { name: g.title, choke: Math.max(-10, Math.min(10, g.keying.choke || 0)) }) }, icon('key', 'sm'), 'Import & Key…')),
    h('div', { class: 'why' }, g.providers.map((p) => `${p.label}: ${p.note}`).join(' ')));
}

function filePicker(args, setArgs, { h }) {
  const pick = () => {
    const cep = typeof window !== 'undefined' && window.cep && window.cep.fs;
    if (cep && cep.showOpenDialogEx) {
      const r = cep.showOpenDialogEx(false, false, 'Choose a generated green-screen file', '', ['png', 'jpg', 'jpeg', 'exr', 'tif', 'tiff', 'mov', 'mp4', 'webm']);
      if (r && r.data && r.data[0]) setArgs(Object.assign({}, args, { path: r.data[0] }));
      return;
    }
    input.click();
  };
  const input = h('input', { type: 'file', accept: '.png,.jpg,.jpeg,.exr,.tif,.tiff,.mov,.mp4,.webm', style: { display: 'none' } });
  input.addEventListener('change', () => { const f = input.files[0]; if (f) setArgs(Object.assign({}, args, { path: f.path || f.name })); });
  return h('div', { class: 'actions', style: { marginTop: 0 } }, h('button', { class: 'btn', onclick: pick }, icon('folder', 'sm'), 'Choose file…'), input,
    h('span', { class: 'why' }, args.path ? args.path.split(/[\\/]/).pop() : 'PNG / EXR / MOV / MP4 on green'));
}

/* ---------- v0.9 Ease Curve editor (value graph + speed graph) ---------- */
/*
 * Drag the two handles. While the pointer is down the panel does not re-render (shell defers
 * renders during a press), so the drag draws straight onto this canvas and only commits the
 * numbers with setArgs on pointer-up.
 */
const VIEW = { yLo: -0.7, yHi: 1.7 };
function curveGeom(W, H) {
  const pad = 14, graphH = Math.round(H * 0.68);
  const side = Math.min(W - 2 * pad, graphH - 2 * pad);
  const ox = (W - side) / 2, top = pad;
  const span = VIEW.yHi - VIEW.yLo;
  const X = (x) => ox + x * side, Y = (y) => top + (VIEW.yHi - y) / span * (graphH - 2 * pad);
  const ix = (px) => (px - ox) / side, iy = (py) => VIEW.yHi - (py - top) / (graphH - 2 * pad) * span;
  return { pad, graphH, side, ox, X, Y, ix, iy, speedTop: graphH + 6, speedH: H - graphH - 12 };
}
function drawCurve(canvas, cv, now, drag) {
  const { c, W, H } = prep(canvas);
  const g = curveGeom(W, H);
  const acc = css('--accent', '#ff6f59'), fg = css('--text-1', '#eee'), dim = css('--text-3', '#777'), sunk = css('--bg-sunken', '#111');
  c.fillStyle = sunk; c.fillRect(g.X(0), g.Y(VIEW.yHi), g.side, g.Y(VIEW.yLo) - g.Y(VIEW.yHi));
  c.strokeStyle = dim; c.lineWidth = 1; c.setLineDash([2, 3]); c.beginPath();
  for (const y of [0, 1]) { c.moveTo(g.X(0), g.Y(y)); c.lineTo(g.X(1), g.Y(y)); }
  for (const x of [0, 1]) { c.moveTo(g.X(x), g.Y(VIEW.yLo)); c.lineTo(g.X(x), g.Y(VIEW.yHi)); }
  c.stroke(); c.setLineDash([]);
  // handles
  c.strokeStyle = dim; c.lineWidth = 1.2; c.beginPath();
  c.moveTo(g.X(0), g.Y(0)); c.lineTo(g.X(cv.x1), g.Y(cv.y1)); c.moveTo(g.X(1), g.Y(1)); c.lineTo(g.X(cv.x2), g.Y(cv.y2)); c.stroke();
  // curve
  c.strokeStyle = acc; c.lineWidth = 2.5; c.beginPath();
  for (let i = 0; i <= 60; i++) { const p = BZ.point(cv, i / 60); if (i) c.lineTo(g.X(p.x), g.Y(p.y)); else c.moveTo(g.X(p.x), g.Y(p.y)); }
  c.stroke();
  for (const [x, y, k] of [[cv.x1, cv.y1, 1], [cv.x2, cv.y2, 2]]) {
    c.fillStyle = drag === k ? acc : fg; c.beginPath(); c.arc(g.X(x), g.Y(y), drag === k ? 7 : 6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = acc; c.lineWidth = 2; c.stroke();
  }
  // moving dot (value) on the curve + playhead
  const t = now === null ? null : ((now / 1000) % 2.2) / 1.6;
  if (t !== null && t <= 1) {
    const v = BZ.valueAt(cv, t);
    c.fillStyle = acc; c.beginPath(); c.arc(g.X(t), g.Y(v), 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = fg; c.beginPath(); c.arc(g.X(1) + 10, g.Y(v), 4, 0, Math.PI * 2); c.fill();
  }
  // speed graph strip
  const n = 48, sp = [];
  for (let i = 0; i <= n; i++) sp.push(BZ.speedAt(cv, i / n));
  const max = Math.max(1.2, ...sp.map(Math.abs));
  const base = g.speedTop + g.speedH * (Math.min(...sp) < 0 ? 0.6 : 1);
  const sy = (v) => base - v / max * (g.speedH * (Math.min(...sp) < 0 ? 0.6 : 1) - 2);
  c.fillStyle = sunk; c.fillRect(g.X(0), g.speedTop, g.side, g.speedH);
  c.strokeStyle = dim; c.lineWidth = 1; c.beginPath(); c.moveTo(g.X(0), base); c.lineTo(g.X(1), base); c.stroke();
  c.strokeStyle = fg; c.lineWidth = 1.5; c.beginPath();
  sp.forEach((v, i) => { const x = g.X(i / n), y = sy(v); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
  c.stroke();
  c.fillStyle = dim; c.font = '9px sans-serif'; c.fillText('SPEED', g.X(0) + 4, g.speedTop + 10);
  if (t !== null && t <= 1) { c.fillStyle = acc; c.fillRect(g.X(t) - 0.5, g.speedTop, 1, g.speedH); }
}
const round3 = (v) => Math.round(v * 1000) / 1000;
function curveEditor(args, setArgs, { h, app, ctx }) {
  const cv = BZ.normalize({ x1: args.x1 === undefined ? 0.333 : args.x1, y1: args.y1 || 0, x2: args.x2 === undefined ? 0.667 : args.x2, y2: args.y2 === undefined ? 1 : args.y2 });
  let drag = 0;
  const label = h('code', { class: 'curve-css' }, BZ.css(cv));
  const canvas = h('canvas', { class: 'curve-canvas', 'aria-label': 'Ease curve: drag the two handles', role: 'img' });
  const pick = (e) => {
    const r = canvas.getBoundingClientRect();
    const g = curveGeom(r.width, r.height);
    return { g, x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const redraw = () => { label.textContent = BZ.css(cv); drawCurve(canvas, cv, null, drag); };
  const down = (e) => {
    const { g, x, y } = pick(e);
    const d1 = Math.hypot(x - g.X(cv.x1), y - g.Y(cv.y1)), d2 = Math.hypot(x - g.X(cv.x2), y - g.Y(cv.y2));
    drag = d1 <= d2 ? 1 : 2;
    if (Math.min(d1, d2) > 28) { drag = 0; return; }
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* old CEP */ }
    e.preventDefault(); redraw();
  };
  const move = (e) => {
    if (!drag) return;
    const { g, x, y } = pick(e);
    const nx = Math.min(BZ.X_MAX, Math.max(BZ.X_MIN, g.ix(x))), ny = Math.min(BZ.Y_MAX, Math.max(BZ.Y_MIN, g.iy(y)));
    if (drag === 1) { cv.x1 = round3(nx); cv.y1 = round3(ny); } else { cv.x2 = round3(nx); cv.y2 = round3(ny); }
    redraw();
  };
  const up = () => { if (!drag) return; drag = 0; setArgs(Object.assign({}, args, { x1: cv.x1, y1: cv.y1, x2: cv.x2, y2: cv.y2 })); };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.setAttribute('data-fresh', '');
  animated(canvas, (now) => drawCurve(canvas, cv, drag ? null : now, drag));

  const readKeys = async () => {
    const p = ((ctx && ctx.properties) || []).find((q) => (q.selectedKeys || []).length >= 2);
    if (!p) { app.toast('Select two keyframes first'); return; }
    const keys = [...new Set(p.selectedKeys)].sort((a, b) => a - b).slice(0, 2);
    try {
      const r = await app.services.host.call('keyframes.read', { compId: ctx.comp.id, targets: [{ address: p.address, keys }] });
      const [ka, kb] = r.targets[0].keys;
      const va = Array.isArray(ka.value) ? ka.value : [ka.value], vb = Array.isArray(kb.value) ? kb.value : [kb.value];
      const got = BZ.fromTemporal(ka.easeOut, kb.easeIn, { dt: kb.time - ka.time, dv: vb.map((v, d) => v - va[d]), spatial: /_SPATIAL$/.test(p.valueType) });
      setArgs(Object.assign({}, args, { x1: round3(got.x1), y1: round3(got.y1), x2: round3(got.x2), y2: round3(got.y2) }));
      app.toast(`Read ${p.name}: ${BZ.css(got)}`);
    } catch (err) { app.toast(`Could not read the keys: ${err.message || err}`); }
  };
  const copyCss = () => { try { navigator.clipboard.writeText(BZ.css(cv)); app.toast('Copied'); } catch (_) { app.toast(BZ.css(cv)); } };
  const hasKeys = ((ctx && ctx.properties) || []).some((q) => (q.selectedKeys || []).length >= 2);
  return h('div', { class: 'field stack curve-ed' },
    h('label', {}, 'Value graph · drag the handles'),
    canvas,
    h('div', { class: 'curve-row' }, label, h('span', { class: 'spacer' }),
      h('button', { class: 'btn ghost sm', title: 'Copy as CSS cubic-bezier', 'aria-label': 'Copy curve', onclick: copyCss }, icon('copy', 'sm')),
      h('button', { class: 'btn ghost sm', disabled: !hasKeys, title: hasKeys ? 'Load the curve of the first two selected keyframes' : 'Select two keyframes to read their curve', onclick: readKeys }, icon('import', 'sm'), 'Read from keys')));
}

/* ---------- v0.9 Anchor point picker (3 × 3) ---------- */
function anchorPicker(args, setArgs, { h }) {
  const order = ['tl', 't', 'tr', 'l', 'c', 'r', 'bl', 'b', 'br'];
  const cur = args.point || 'c';
  return h('div', { class: 'field stack' }, h('label', {}, `Anchor point · ${TM.POINT_LABEL[cur]}`),
    h('div', { class: 'anchor-pick', role: 'radiogroup', 'aria-label': 'Anchor point' },
      order.map((p) => h('button', { class: `ap-dot ${p === cur ? 'on' : ''}`, role: 'radio', 'aria-checked': String(p === cur), 'aria-label': TM.POINT_LABEL[p], title: TM.POINT_LABEL[p], 'data-key': p, onclick: () => setArgs(Object.assign({}, args, { point: p })) }, h('span')))));
}

const body = {
  'motion.easeCurve': curveEditor,
  'transform.anchor': anchorPicker,
  'grid.build': gridPreview,
  'grid.guides': guidesPreview,
  'grid.placeInCells': guidesPreview,
  'adapt.resize': adaptPreview,
  'glass.apply': glassTint,
  'glass.look': glassTint,
  'generate.importKey': filePicker
};
const result = { 'generate.greenPrompt': greenResult };

module.exports = { body, result, animated, prep, drawPlanFrame, ROLE_COLORS };
