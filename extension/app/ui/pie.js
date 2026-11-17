'use strict';
/**
 * Pie menu (v0.8): eight actions around the pointer, chosen by direction.
 *
 *   Hold Q  (or hold the right mouse button) → point toward a slice → release = run it.
 *   Tap Q / the header button                → the pie stays open: click a slice, or press 1–8.
 *   Centre                                   → repeat the last change (F4); Esc or a click outside closes.
 *
 * The slices come from actions.slotsFor(): the smart set for what is selected (keyframes, text,
 * shapes, one layer, several layers, nothing) or the user's own pie (Settings › Pie menu).
 * Each slice uses the tool's own readiness check, so a slice that cannot run explains why instead.
 * Works while the panel has keyboard focus (CEP panels do not receive keys while AE has focus).
 */
const { h, icon } = require('./dom');
const actions = require('./actions');

const R = 86;          // slice centres from the pie centre
const DEAD = 22;       // centre zone: no slice
const OUTER = R + 58;  // a click further out closes the pie
const SVGNS = 'http://www.w3.org/2000/svg';

/** Slice under a point (pure): -1 = centre, else 0…7 with 0 = north, clockwise. */
function sliceAt(dx, dy) {
  const d = Math.hypot(dx, dy);
  if (d < DEAD) return -1;
  const a = (Math.atan2(dx, -dy) * 180 / Math.PI + 360 + 22.5) % 360; // 0° = up, clockwise
  return Math.floor(a / 45);
}

/** Donut sector path for slice i (SVG coords centred on 0,0). */
function sectorPath(i, r0, r1) {
  const a0 = (i * 45 - 22.5 - 90) * Math.PI / 180, a1 = (i * 45 + 22.5 - 90) * Math.PI / 180;
  const p = (r, a) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  return `M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`;
}

let current = null;

function close() {
  if (!current) return;
  current.cleanup();
  current = null;
}

/**
 * Open the pie centred near (clientX, clientY).
 * hold: 'key' (released with Q up) | 'mouse' (released with the right button) | null (click mode).
 */
function open(app, clientX, clientY, { hold = null } = {}) {
  close();
  const s = app.state.get();
  const pieSet = app.services.settings.get().ui.pie || {};
  const refs = actions.slotsFor(s.ctx, pieSet);
  const slots = refs.map((r) => actions.resolve(r));
  const ready = slots.map((a) => (a ? a.ready(app) : { ok: false, hint: 'Empty slot' }));
  const ctxName = pieSet.mode === 'mine' ? 'My pie' : actions.CONTEXT_LABEL[actions.profile(s.ctx)];
  const last = s.last;
  let hi = -2; // -2 = nothing yet, -1 = centre
  const opened = Date.now();
  let moved = false;

  // v0.99.5 (manual test): the centre used to read "Repeat <name>", which does not fit its 64 px / two lines —
  // After Effects showed "Repeat / Anchor Top…", a CUT NAME (docs/features/NO_CUT_NAMES.md) that also hid WHICH
  // anchor would be repeated. The repeat arrow above it already says "repeat", so the centre shows the name only
  // (the same text a hovered slot puts there, pie.js below), and the full sentence stays in the tooltip + aria.
  const centreLabel = h('span', { class: 'pie-c-l' }, last ? last.label : 'Close');
  const centreCtx = h('span', { class: 'pie-c-k' }, ctxName);
  const centre = h('button', { class: 'pie-centre', title: last ? `Repeat ${last.label}` : 'Close the pie', 'aria-label': last ? `Repeat ${last.label}` : 'Close the pie', onclick: () => choose(-1) }, icon(last ? 'repeat' : 'x', 'sm'), centreLabel, centreCtx);

  // Background ring + highlight sector (updated by setAttribute, no re-render).
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'pie-ring');
  svg.setAttribute('viewBox', `${-OUTER} ${-OUTER} ${OUTER * 2} ${OUTER * 2}`);
  svg.setAttribute('aria-hidden', 'true');
  const ring = document.createElementNS(SVGNS, 'circle');
  ring.setAttribute('r', String(R + 34)); ring.setAttribute('class', 'pie-disc');
  const hole = document.createElementNS(SVGNS, 'circle');
  hole.setAttribute('r', String(DEAD + 14)); hole.setAttribute('class', 'pie-hole');
  const hl = document.createElementNS(SVGNS, 'path');
  hl.setAttribute('class', 'pie-hl');
  svg.appendChild(ring); svg.appendChild(hl); svg.appendChild(hole);

  const buttons = slots.map((a, i) => {
    const ang = (i * 45 - 90) * Math.PI / 180;
    const b = h('button', {
      class: `pie-slot ${a ? '' : 'empty'} ${ready[i].ok ? '' : 'blocked'}`, role: 'menuitem',
      title: a ? `${i + 1} · ${a.label}${ready[i].ok ? '' : ` — ${ready[i].hint}`}` : 'Empty slot (Settings › Pie menu)',
      'aria-label': a ? `${a.label}${ready[i].ok ? '' : `, ${ready[i].hint}`}` : 'Empty slot',
      style: { left: `${(R * Math.cos(ang)).toFixed(1)}px`, top: `${(R * Math.sin(ang)).toFixed(1)}px` },
      onclick: () => choose(i)
    }, a ? icon(a.icon || 'bolt') : icon('plus'), h('span', { class: 'pie-l' }, a ? a.label : '—'), h('span', { class: 'pie-n' }, String(i + 1)));
    return b;
  });

  const pie = h('div', { class: 'pie', role: 'menu', 'aria-label': `Pie menu · ${ctxName}` }, svg, buttons, centre);
  const overlay = h('div', { class: 'overlay pie-ov', 'data-fresh': '' }, pie);
  document.body.appendChild(overlay);
  // Coordinates relative to the overlay (it is the panel window in AE; a frame in the web preview).
  const box = overlay.getBoundingClientRect();
  const m = OUTER - 20;
  const cx = Math.min(Math.max(clientX - box.left, m), Math.max(m, box.width - m));
  const cy = Math.min(Math.max(clientY - box.top, m), Math.max(m, box.height - m));
  pie.style.left = `${cx}px`;
  pie.style.top = `${cy}px`;
  const centreAbs = () => { const r = overlay.getBoundingClientRect(); return { x: r.left + cx, y: r.top + cy }; };

  function highlight(i) {
    if (i === hi) return;
    hi = i;
    buttons.forEach((b, k) => b.classList.toggle('hot', k === i));
    centre.classList.toggle('hot', i === -1);
    if (i >= 0) { hl.setAttribute('d', sectorPath(i, DEAD + 14, R + 34)); hl.style.display = ''; } else hl.style.display = 'none';
    const a = i >= 0 ? slots[i] : null;
    centreLabel.textContent = a ? a.label : (last ? last.label : 'Close');
    centreCtx.textContent = a ? (ready[i].ok ? a.where || ctxName : ready[i].hint) : ctxName;
  }
  highlight(-1);

  function choose(i) {
    close();
    if (i === -1) { if (last) app.repeatLast(); return; }
    const a = slots[i];
    if (!a) { app.toast('Empty slot — fill it in Settings › Pie menu', 3000, 'info'); return; }
    if (!ready[i].ok && !a.nav) { app.toast(`${a.label}: ${ready[i].hint}`, 4500, 'warn'); return; }
    a.run(app);
  }

  const onMove = (e) => {
    const c = centreAbs();
    const dx = e.clientX - c.x, dy = e.clientY - c.y;
    if (Math.hypot(dx, dy) > 6) moved = true;
    highlight(sliceAt(dx, dy));
  };
  const onDown = (e) => {
    const c = centreAbs();
    if (Math.hypot(e.clientX - c.x, e.clientY - c.y) > OUTER && !pie.contains(e.target)) { e.preventDefault(); close(); }
  };
  const release = () => {
    // Marking-menu release: run what is under the pointer; a quick tap without moving keeps it open.
    if (!moved && Date.now() - opened < 350) { hold = null; return; }
    if (hi >= 0 || (hi === -1 && moved && last)) choose(hi); else close();
  };
  const onUp = (e) => { if (hold === 'mouse' && e.button === 2) { e.preventDefault(); hold = null; release(); } };
  const onCtx = (e) => e.preventDefault();
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (/^[1-8]$/.test(e.key)) { e.preventDefault(); choose(Number(e.key) - 1); return; }
    if (e.key === 'Enter') { e.preventDefault(); choose(hi === -2 ? -1 : hi); return; }
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step) { e.preventDefault(); highlight(((hi < 0 ? (step > 0 ? -1 : 0) : hi) + step + 8) % 8); }
    if (e.key.toLowerCase() === 'q') e.preventDefault();
  };
  const onKeyUp = (e) => { if (hold === 'key' && e.key.toLowerCase() === 'q') { e.preventDefault(); hold = null; release(); } };
  const onBlur = () => close();

  document.addEventListener('pointermove', onMove, true);
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('pointerup', onUp, true);
  document.addEventListener('contextmenu', onCtx, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', onBlur);
  current = {
    overlay,
    cleanup() {
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('pointerup', onUp, true);
      // The contextmenu after a right-button release arrives after pointerup: swallow it once more.
      setTimeout(() => document.removeEventListener('contextmenu', onCtx, true), 0);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
      overlay.remove();
    }
  };
  (hi === -1 ? centre : centre).focus({ preventScroll: true });
  return current;
}

const isOpen = () => !!current;

module.exports = { open, close, isOpen, sliceAt, sectorPath, R, DEAD };
