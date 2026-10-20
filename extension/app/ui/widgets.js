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

/* ---------- shared canvas loop (stops when canvases unmount) ---------- */
const live = new Set();
let raf = null;
function loop(now) {
  for (const e of live) { if (!e.canvas.isConnected) { live.delete(e); continue; } e.draw(now); }
  raf = live.size ? requestAnimationFrame(loop) : null;
}
function animated(canvas, draw) {
  const entry = { canvas, draw };
  live.add(entry);
  if (!raf && typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(loop);
  setTimeout(() => draw(typeof performance !== 'undefined' ? performance.now() : 0), 0);
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
    const build = args.animateIn ? Math.min(100, Math.max(0, (((now / 1000) % cycle) - 0.3) / (args.buildDuration || 1.5) * 100)) : 100;
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

const body = {
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
