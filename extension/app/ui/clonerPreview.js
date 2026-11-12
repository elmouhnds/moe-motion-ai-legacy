'use strict';
/**
 * v0.39 Live Preview (docs/features/LIVE_PREVIEW.md) — the Effector's Inspector shows a sample grid (or your own:
 * "Use my grid" reads it once) and the effector null: drag it with the mouse and every item answers with the same
 * maths the expressions use (features/grid/sim.js → effectors.js). Spring, Target, Audio, Noise / Image fields and
 * the colour tint all show. Audio and Image use stand-ins (a two-beat pulse, a dark → bright image) — said under it.
 * Also: demoInputs() gives the Grid Builder preview a sample shape (Points) and word blocks (In Place / text).
 */
const SIM = require('../../features/grid/sim');
const GT = require('../../features/grid/tools');

/* One simulation per Inspector, kept across re-renders (changing a setting must not lose the null's path). */
let shared = null;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
const rgb = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '')); const v = m ? parseInt(m[1], 16) : 0xffffff; return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const mixRgb = (a, b, t) => `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(',')})`;

/** Sample inputs for layouts that need something from the comp: a shape's points, a title's words. */
function demoInputs(args, compW, compH) {
  if (args.mode === 'points' || args.morphTo === 'points') {
    const R = Math.min(compW, compH) * 0.32, n = 10; // a 5-pointed star outline (10 points)
    return { vertices: Array.from({ length: n }, (_, j) => { const r = j % 2 ? R * 0.45 : R, a = (j * 36 - 90) * Math.PI / 180; return [r * Math.cos(a), r * Math.sin(a)]; }) };
  }
  if (args.mode === 'keep') {
    const letters = args.splitText === 'letters';
    const parts = letters ? 'MOVE IT'.split('') : ['Make', 'it', 'move'];
    const em = Math.min(compW, compH) * 0.12, adv = (s) => (s === ' ' ? 0.35 : 0.6 * s.length) * em, gap = letters ? 0 : 0.35 * em;
    const total = parts.reduce((a, s) => a + adv(s), 0) + gap * (parts.length - 1);
    let x = -total / 2;
    const homes = [], widths = [];
    parts.forEach((s) => { const w = adv(s); if (s !== ' ') { homes.push([x + w / 2, 0]); widths.push(w * 0.92); } x += w + gap; });
    return { homes, widths, height: em };
  }
  return {};
}

/**
 * The Effector's live preview. tools: { animated, prep, css } from widgets.js (shared canvas loop, DPR, tokens).
 */
function effectorPreview(args, setArgs, { h, app, ctx }, tools) {
  const { animated, prep, css } = tools;
  if (!shared) { shared = { sim: SIM.createSim({ args }), mine: null, key: '', state: args.sweep ? 'sweep' : 'rest' }; shared.sim.reset(now()); }
  const S = shared, sim = S.sim;
  const key = JSON.stringify(args);
  if (key !== S.key) {
    const sweepChanged = !!args.sweep !== !!JSON.parse(S.key || '{}').sweep;
    sim.setArgs(args);
    if (sweepChanged || !S.key) { sim.reset(now()); S.state = args.sweep ? 'sweep' : 'rest'; }
    S.key = key;
  }
  const canvas = h('canvas', { class: 'grid-canvas live', role: 'img', 'aria-label': 'Live preview: drag to move the effector null' });
  canvas.setAttribute('data-fresh', '');
  let view = { k: 1, ox: 0, oy: 0 };
  const toSim = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left - view.ox) / view.k, (e.clientY - r.top - view.oy) / view.k]; };
  const draw = () => {
    const { c, W, H } = prep(canvas);
    const t = now(), V = sim.values, ext = sim.extent, pad = Math.max(ext * 0.18, 40);
    // fit the items themselves (their widest x and y), whatever the layout
    const mx = Math.max(...sim.items.map((p) => Math.abs(p[0]))), my = Math.max(...sim.items.map((p) => Math.abs(p[1])));
    const k = Math.min(W / (2 * (mx + pad)), H / (2 * (my + pad)));
    view = { k, ox: W / 2, oy: H / 2 };
    const X = (x) => view.ox + x * k, Y = (y) => view.oy + y * k;
    const fg = css('--text-2', '#bbb'), acc = css('--accent', '#ff6f59'), dim = css('--text-3', '#777');
    const fo = Math.round(V.falloff), ep = sim.effectorAt(t), tp = Math.round(V.type);
    // the field / falloff under the items
    if (fo === 5 || fo === 6) {
      const step = 12;
      c.fillStyle = acc;
      for (let py = 0; py < H; py += step) for (let px = 0; px < W; px += step) {
        const w = sim.weightAt(t, (px + step / 2 - view.ox) / k, (py + step / 2 - view.oy) / k);
        if (w > 0.02) { c.globalAlpha = w * 0.28; c.fillRect(px, py, step, step); }
      }
      c.globalAlpha = 1;
    }
    c.strokeStyle = acc; c.lineWidth = 1.5; c.setLineDash([4, 3]);
    if (fo === 1) { c.beginPath(); c.arc(X(ep[0]), Y(ep[1]), V.size * k, 0, Math.PI * 2); c.stroke(); }
    else if (fo === 3) { c.strokeRect(X(ep[0] - V.size), Y(ep[1] - V.size), 2 * V.size * k, 2 * V.size * k); }
    else if (fo === 2) { c.beginPath(); c.moveTo(X(ep[0] + V.size / 2), 6); c.lineTo(X(ep[0] + V.size / 2), H - 6); c.stroke(); }
    c.setLineDash([]);
    // the items, with the effector's result
    const cell = Math.max(10, Math.min(46, ext * 0.11)) * k * 2.2;
    const base = rgb(fg.startsWith('#') ? fg : '#bbbbbb'), tint = rgb(args.colour || '#ffffff');
    for (const it of sim.frame(t)) {
      const s = Math.max(0, it.scale);
      c.save(); c.translate(X(it.x), Y(it.y)); c.rotate(it.rot * Math.PI / 180);
      c.globalAlpha = Math.min(Math.max(it.op, 0), 1);
      c.fillStyle = it.tint > 0 ? mixRgb(base, tint, it.tint) : fg;
      const w = cell * 0.5 * s, hh = cell * 0.5 * s;
      if (tp === 6) { c.beginPath(); c.moveTo(w * 0.7, 0); c.lineTo(-w * 0.5, -hh * 0.45); c.lineTo(-w * 0.25, 0); c.lineTo(-w * 0.5, hh * 0.45); c.closePath(); c.fill(); }
      else { c.beginPath(); c.rect(-w / 2, -hh / 2, w, hh); c.fill(); }
      c.restore();
    }
    c.globalAlpha = 1;
    // the null: a ring you can grab
    c.strokeStyle = acc; c.lineWidth = 2; c.beginPath(); c.arc(X(ep[0]), Y(ep[1]), 7, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(X(ep[0]) - 11, Y(ep[1])); c.lineTo(X(ep[0]) + 11, Y(ep[1])); c.moveTo(X(ep[0]), Y(ep[1]) - 11); c.lineTo(X(ep[0]), Y(ep[1]) + 11); c.stroke();
    if (tp === 7) { const b = SIM.beat(t); c.fillStyle = dim; c.fillRect(8, H - 10, 60, 4); c.fillStyle = acc; c.fillRect(8, H - 10, 60 * b, 4); }
  };
  canvas.addEventListener('pointerdown', (e) => { const p = toSim(e); sim.grab(now(), p[0], p[1]); S.state = 'moved'; try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* old CEP */ } e.preventDefault(); draw(); });
  canvas.addEventListener('pointermove', (e) => { if (!sim.dragging) return; const p = toSim(e); sim.drag(now(), p[0], p[1]); draw(); });
  // the label says what the null is doing (at rest / moved / sweeping) — updated when a drag ends
  const up = () => { if (!sim.dragging) return; sim.release(now()); S.state = 'moved'; app.scheduleRender(); };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  require('./scrub').guard(canvas, () => !!sim.dragging, up); // v0.80
  animated(canvas, () => draw());

  const grid = ctx ? GT.gridFor(ctx, args) : null;
  const useMine = async () => {
    if (!grid) return;
    try {
      const d = await app.services.host.call('layers.describe', { compId: ctx.comp.id });
      const kids = d.layers.filter((l) => l.parentId === grid.id);
      if (kids.length < 2) { app.toast(`${grid.name} has no items to show`); return; }
      // the items' positions after their grid expressions (props.values reads the evaluated value), in the null's space
      const r = await app.services.host.call('props.values', { compId: ctx.comp.id, time: ctx.comp.time, items: kids.map((l) => ({ address: { layerId: l.id, matchNames: ['ADBE Transform Group', 'ADBE Position'] } })) });
      const pts = r.items.map((it) => it.value).filter((v) => Array.isArray(v));
      if (pts.length < 2) { app.toast(`Could not read ${grid.name}'s items`); return; }
      sim.setItems(pts.map((v) => [v[0], v[1]]));
      S.mine = { name: grid.name, n: pts.length };
      sim.reset(now());
      app.scheduleRender();
    } catch (err) { app.toast(`Could not read ${grid.name}: ${err.message || err}`); }
  };
  const sample = () => { sim.setItems(null); S.mine = null; sim.reset(now()); app.scheduleRender(); };
  const tp = Math.round(sim.values.type), fo = Math.round(sim.values.falloff);
  const notes = [tp === 7 && 'Audio: a two-beat pulse stands in for your soundtrack', fo === 6 && 'Image: a dark → bright sample stands in for your layer'].filter(Boolean);
  return h('div', { class: 'field stack' },
    h('label', {}, `Live preview · ${S.mine ? `${S.mine.name} (${S.mine.n} items)` : 'sample grid'} · ${{ sweep: 'sweeping — grab the null to stop', moved: 'null moved — Reset puts it back', rest: 'drag the null' }[S.state]}`),
    canvas,
    h('div', { class: 'curve-row' },
      h('button', { class: `btn ghost sm${S.state === 'sweep' ? ' on' : ''}`, 'aria-pressed': String(S.state === 'sweep'), title: 'Play / stop the sweep: across in 2 s, hold, back', onclick: () => { if (S.state === 'sweep') { sim.reset(now(), false); S.state = 'rest'; } else { sim.sweep(now()); S.state = 'sweep'; } app.scheduleRender(); } }, 'Sweep'),
      h('button', { class: 'btn ghost sm', disabled: S.state === 'rest', title: 'Stop and put the null back where the tool puts it', onclick: () => { sim.reset(now(), false); S.state = 'rest'; app.scheduleRender(); } }, 'Reset'),
      h('span', { class: 'spacer' }),
      S.mine
        ? h('button', { class: 'btn ghost sm', title: 'Back to the sample grid', onclick: sample }, 'Sample grid')
        : h('button', { class: 'btn ghost sm', disabled: !grid, title: grid ? `Show ${grid.name}'s items (read once)` : 'Select a MOE Grid to preview its own items', onclick: useMine }, 'Use my grid')),
    notes.length ? h('div', { class: 'why' }, notes.join(' · ')) : null);
}

/** For tests: forget the shared simulation. */
function resetShared() { shared = null; }

module.exports = { effectorPreview, demoInputs, resetShared };
