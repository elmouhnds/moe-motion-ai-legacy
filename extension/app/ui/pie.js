'use strict';
/**
 * Pie menu (v0.8): eight actions around the pointer, chosen by direction.
 *
 *   Hold Q  (or hold the right mouse button) → point toward a slice → release = run it.
 *   Tap Q / the header button                → the pie stays open: click a slice, or press 1–8.
 *   Centre (v1.0)                             → a search box: MOE tools + After Effects effects, presets, commands.
 *   ✕, Esc or a click outside                → cancel; releasing on no slice keeps it open — nothing is forced.
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
const HOLE = 46;       // v1.0: the centre disc that holds the search box
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
 * onClose: called once when the pie goes away (the MOE Quick window closes itself with it).
 *
 * v1.0 (the owner): the CENTRE is a search box — type a tool, a preset, an After Effects effect, an animation preset or
 * a menu command and run it, like FX Console (quickSearch.js). Nothing is forced: releasing in the centre (or on no
 * slice) keeps the pie open to type in, and ✕ / Esc / a click outside cancel without running anything.
 */
function open(app, clientX, clientY, { hold = null, onClose = null, standalone = false } = {}) {
  close();
  const QS = require('./quickSearch');
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
  let found = [], sel = 0;

  const input = h('input', { class: 'pie-q', type: 'text', placeholder: 'Search…', spellcheck: 'false', 'aria-label': 'Search MOE tools, After Effects effects, presets and commands', 'data-fresh': '' });
  const centreCtx = h('span', { class: 'pie-c-k' }, ctxName);
  const rep = last ? h('button', { class: 'pie-rep', title: `Repeat ${last.label} (F4)`, 'aria-label': `Repeat ${last.label}`, onclick: () => { close(); app.repeatLast(); } }, icon('repeat', 'xs'), h('span', {}, last.label)) : null;
  const centre = h('div', { class: 'pie-centre' }, h('span', { class: 'pie-q-i' }, icon('search', 'xs')), input, centreCtx, rep);
  const cancel = h('button', { class: 'pie-x', title: 'Cancel — nothing runs (Esc)', 'aria-label': 'Cancel', onclick: () => close() }, icon('x', 'sm'));
  const list = h('div', { class: 'pie-res-list', role: 'listbox' });
  const res = h('div', { class: 'pie-res' }, list, h('div', { class: 'pie-res-foot' },
    h('span', {}, h('b', {}, 'Enter'), ' run'), h('span', {}, h('b', {}, 'Ctrl+Enter'), ' effect on a new adjustment layer'), h('span', {}, h('b', {}, 'Esc'), ' cancel')));

  // Background ring + highlight sector (updated by setAttribute, no re-render).
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'pie-ring');
  svg.setAttribute('viewBox', `${-OUTER} ${-OUTER} ${OUTER * 2} ${OUTER * 2}`);
  svg.setAttribute('aria-hidden', 'true');
  const ring = document.createElementNS(SVGNS, 'circle');
  ring.setAttribute('r', String(R + 34)); ring.setAttribute('class', 'pie-disc');
  const hole = document.createElementNS(SVGNS, 'circle');
  hole.setAttribute('r', String(HOLE)); hole.setAttribute('class', 'pie-hole');
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

  const pie = h('div', { class: `pie${standalone ? ' standalone' : ''}`, role: 'menu', 'aria-label': `Pie menu · ${ctxName}` }, svg, buttons, centre, cancel, res);
  const overlay = h('div', { class: 'overlay pie-ov', 'data-fresh': '' }, pie);
  document.body.appendChild(overlay);
  // Coordinates relative to the overlay (it is the panel window in AE; a frame in the web preview).
  const box = overlay.getBoundingClientRect();
  const m = OUTER - 20;
  const cx = standalone ? box.width / 2 : Math.min(Math.max(clientX - box.left, m), Math.max(m, box.width - m));
  const cy = standalone ? box.height / 2 : Math.min(Math.max(clientY - box.top, m), Math.max(m, box.height - m));
  pie.style.left = `${cx}px`;
  pie.style.top = `${cy}px`;
  const centreAbs = () => { const r = overlay.getBoundingClientRect(); return { x: r.left + cx, y: r.top + cy }; };
  const searching = () => input.value.trim().length > 0;

  function highlight(i) {
    if (i === hi) return;
    hi = i;
    buttons.forEach((b, k) => b.classList.toggle('hot', k === i));
    if (i >= 0) { hl.setAttribute('d', sectorPath(i, HOLE, R + 34)); hl.style.display = ''; } else hl.style.display = 'none';
    const a = i >= 0 ? slots[i] : null;
    centreCtx.textContent = a ? (ready[i].ok ? a.label : `${a.label} — ${ready[i].hint}`) : ctxName;
  }
  highlight(-1);

  function drawResults() {
    while (list.firstChild) list.removeChild(list.firstChild);
    const q = input.value.trim();
    pie.classList.toggle('searching', !!q);
    if (!q) return;
    const loading = !QS.catalogOf(app).ready();
    if (!found.length) list.appendChild(h('div', { class: 'pie-res-empty' }, loading ? 'Reading After Effects’ effects and presets…' : 'Nothing matches — try other words'));
    found.forEach((it, i) => list.appendChild(h('div', {
      class: 'pie-res-item', role: 'option', 'aria-selected': String(i === sel),
      onmouseenter: () => mark(i), onclick: (e) => runFound(i, e)
    }, icon(it.icon || 'tools', 'sm'), h('span', { class: 'pn' }, it.name), h('span', { class: 'pd' }, it.desc || ''), h('span', { class: 'ws' }, it.ws || ''))));
    if (loading && found.length) list.appendChild(h('div', { class: 'pie-res-empty' }, 'Still reading After Effects’ effects and presets…'));
    const cur = list.children[sel];
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }
  function mark(i) { sel = i; [...list.children].forEach((el, k) => el.setAttribute('aria-selected', String(k === sel))); }
  function search() { found = QS.results(app, input.value); sel = 0; drawResults(); }
  function runFound(i, e) {
    const it = found[i];
    if (!it) return;
    close();
    it.run({ adjustment: !!(e && (e.ctrlKey || e.metaKey)) });
  }
  input.addEventListener('input', search);
  // the catalogue of After Effects is read once per session; when it arrives, refresh what is on screen
  QS.catalogOf(app).get().then(() => { if (current && current.pie === pie && searching()) search(); }).catch(() => {});

  function choose(i) {
    const a = slots[i];
    close();
    if (!a) { app.toast('Empty slot — fill it in Settings › Pie menu', 3000, 'info'); return; }
    if (!ready[i].ok && !a.nav) { app.toast(`${a.label}: ${ready[i].hint}`, 4500, 'warn'); return; }
    a.run(app);
  }

  const onMove = (e) => {
    if (searching()) return;
    const c = centreAbs();
    const dx = e.clientX - c.x, dy = e.clientY - c.y;
    if (Math.hypot(dx, dy) > 6) moved = true;
    highlight(sliceAt(dx, dy));
  };
  const onDown = (e) => {
    if (pie.contains(e.target)) return;
    const c = centreAbs();
    if (standalone || Math.hypot(e.clientX - c.x, e.clientY - c.y) > OUTER) { e.preventDefault(); close(); }
  };
  const release = () => {
    // Marking-menu release: a slice under the pointer runs; anywhere else the pie STAYS open to type in (never forced)
    if (!moved && Date.now() - opened < 350) { hold = null; input.focus({ preventScroll: true }); return; }
    if (hi >= 0) choose(hi); else { hold = null; highlight(-1); input.focus({ preventScroll: true }); }
  };
  const onUp = (e) => { if (hold === 'mouse' && e.button === 2) { e.preventDefault(); hold = null; release(); } };
  const onCtx = (e) => e.preventDefault();
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (hold === 'key' && e.key.toLowerCase() === 'q') { e.preventDefault(); return; } // the held Q repeats: never typed
    if (searching()) {
      if (e.key === 'ArrowDown') { e.preventDefault(); mark(Math.min(found.length - 1, sel + 1)); const c = list.children[sel]; if (c && c.scrollIntoView) c.scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); mark(Math.max(0, sel - 1)); const c = list.children[sel]; if (c && c.scrollIntoView) c.scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'Enter') { e.preventDefault(); runFound(sel, e); }
      return;
    }
    if (/^[1-8]$/.test(e.key)) { e.preventDefault(); choose(Number(e.key) - 1); return; }
    if (e.key === 'Enter') { e.preventDefault(); if (hi >= 0) choose(hi); return; }
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step) { e.preventDefault(); highlight(((hi < 0 ? (step > 0 ? -1 : 0) : hi) + step + 8) % 8); return; }
    // any other printable key starts a search (the box takes the focus before the character lands)
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && document.activeElement !== input) input.focus({ preventScroll: true });
  };
  const onKeyUp = (e) => { if (hold === 'key' && e.key.toLowerCase() === 'q') { e.preventDefault(); hold = null; release(); } };
  const onBlur = () => { if (!standalone) close(); };

  document.addEventListener('pointermove', onMove, true);
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('pointerup', onUp, true);
  document.addEventListener('contextmenu', onCtx, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', onBlur);
  current = {
    overlay, pie, input,
    // v1.0.2: has the user started using this pie? MOE Quick paints the pie before the host has answered, and may
    // redraw it once the real selection lands — but never under a hand that is already pointing or typing.
    touched: () => moved || input.value.trim().length > 0,
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
      if (onClose) { try { onClose(); } catch (_) { /* the window may already be going */ } }
    }
  };
  input.focus({ preventScroll: true });
  return current;
}

const isOpen = () => !!current;
/** Open, and nobody has pointed at a slice or typed in it yet — safe to redraw. */
const untouched = () => !!current && !current.touched();

module.exports = { open, close, isOpen, untouched, sliceAt, sectorPath, R, DEAD, HOLE };
