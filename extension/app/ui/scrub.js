'use strict';
/**
 * Smart controls (v0.56, docs/features/SMART_CONTROLS.md): every number field is also a hidden slider.
 *
 *   attach(input, { step, min, max, round, live(v), commit(v), fill, axis, span, surface, reset })
 *
 *  - drag sideways on the number (not while typing in it): ±step per pixel, Shift ×10, Ctrl / Cmd ×0.1 —
 *    `live` follows the pointer, `commit` on release; Esc while dragging puts the first value back
 *  - a plain click focuses the field for typing (the caret is left alone while it has focus)
 *  - ↑ / ↓ step it (Shift ×10, Ctrl fine): `live` at once, `commit` 400 ms after the last key, so a held key
 *    never floods After Effects
 *  - the mouse wheel steps it only while the field has focus, so scrolling the page is never hijacked
 *  - `fill`: an optional element whose --p (0–100 %) shows where the value sits between min and max
 *  - v0.70 `axis: 'y'` + `span` (px): a tall slider tile — drag up raises it, the whole range over `span` pixels,
 *    snapped to `step` (Control style's sliders)
 *  - v0.80 (docs/features/DRAG_ENGINE.md) `surface` (element with a data-key) + `reset`: the whole bar is the
 *    handle — drag anywhere on it (the range over the bar's own size, so the level travels as far as the hand),
 *    a plain click sets the level at that point, double-click puts `reset` back; Shift = bigger steps,
 *    Ctrl = a quarter of the pace. Buttons / switches inside the bar and the number while you type keep their clicks.
 *
 * Inputs are rebuilt on every render, so their listeners are attached directly (UI rule: allowed on inputs).
 * A surface is NOT rebuilt — the shell morphs it in place — so it gets no listener of its own: one delegated
 * listener on the document finds the bar under the pointer and the number that is in it NOW (v0.80: a listener on
 * the bar kept reading and writing the number of the first render).
 */

/** One drag, tracked the same way for every control. */
function track(e, t) {
  let moved = false, cancelled = false, done = false, v = t.v0, lastX = e.clientX, lastY = e.clientY, acc = 0, timer = 0, dirty = false, last = 0;
  // painted at most once per 16 ms, on a clock (not requestAnimationFrame: a panel After Effects is not drawing gets none)
  const paint = () => { timer = 0; if (dirty && !done) { dirty = false; last = Date.now(); t.live(v); } };
  const queue = () => { const now = Date.now(); if (now - last >= 16) { last = now; dirty = false; t.live(v); } else { dirty = true; if (!timer) timer = setTimeout(paint, 16 - (now - last)); } };
  try { t.el.setPointerCapture(e.pointerId); } catch (_) { /* older CEP: the window listeners below carry the drag */ }
  const classes = (on) => {
    (t.marks || []).forEach((el) => { if (el) el.classList[on ? 'add' : 'remove']('scrubbing'); });
    document.documentElement.classList.remove('moe-scrub-x', 'moe-scrub-y');
    if (on) document.documentElement.classList.add(t.vert ? 'moe-scrub-y' : 'moe-scrub-x');
  };
  const move = (m) => {
    if (done) return;
    if (m.buttons === 0) { end(); return; } // released where the panel could not hear it
    if (!moved) {
      if (Math.abs(t.vert ? e.clientY - m.clientY : m.clientX - e.clientX) < 3) return;
      moved = true; classes(true); // the travel up to here counts too (lastX / lastY are still the press point): no dead zone
    }
    const d = t.vert ? lastY - m.clientY : m.clientX - lastX;
    lastX = m.clientX; lastY = m.clientY;
    acc += d * t.per * t.factor(m); // accumulated: Shift / Ctrl pressed in the middle changes the pace, never the value
    v = t.value(t.v0 + acc, m);
    queue();
    if (m.cancelable) m.preventDefault();
  };
  const esc = (ke) => { if (ke.key === 'Escape' && moved) { ke.preventDefault(); ke.stopPropagation(); cancelled = true; end(); } };
  const blur = () => end();
  function end() {
    if (done) return; done = true;
    window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', end, true); window.removeEventListener('pointercancel', end, true);
    window.removeEventListener('blur', blur); document.removeEventListener('keydown', esc, true);
    clearTimeout(timer); classes(false);
    try { t.el.releasePointerCapture(e.pointerId); } catch (_) { /* not captured */ }
    if (cancelled) { t.live(t.v0); return; }
    if (moved) { t.live(v); t.commit(v); } else t.click();
  }
  window.addEventListener('pointermove', move, true); window.addEventListener('pointerup', end, true); window.addEventListener('pointercancel', end, true);
  window.addEventListener('blur', blur); document.addEventListener('keydown', esc, true);
}

/** The maths of one control, bound to the number (and bar) that are on screen now. */
function engine(input, o, fill) {
  const step = o.step > 0 ? o.step : 1;
  const lo = o.min === undefined ? -Infinity : o.min, hi = o.max === undefined ? Infinity : o.max;
  const dec = (String(step).split('.')[1] || '').length;
  const round = o.round || ((v) => Number(v.toFixed(Math.min(4, dec + 1))));
  const clamp = (v) => Math.max(lo, Math.min(hi, v));
  const ranged = Number.isFinite(lo) && Number.isFinite(hi) && hi > lo;
  const read = () => { const n = Number(String(input.value).replace(',', '.')); return Number.isFinite(n) ? n : (Number.isFinite(lo) ? lo : 0); };
  const show = (v) => {
    input.value = String(v);
    if (fill && ranged) fill.style.setProperty('--p', `${Math.round(((v - lo) / (hi - lo)) * 1000) / 10}%`);
  };
  const live = (v) => { show(v); if (o.live) o.live(v); };
  const commit = (v) => { if (o.commit) o.commit(v); };
  /** On the step; `big` (Shift on a bar) = ten steps when the range has room for them, else five. */
  const snap = (raw, big) => { const st = big ? (step * 10 <= (hi - lo) / 2 ? step * 10 : step * 5) : step; return clamp(round(Math.round(raw / st) * st)); };
  return { step, lo, hi, round, clamp, ranged, read, show, live, commit, snap };
}

const SURFACES = new Map(); // data-scrub id → the options of the latest render
const BLOCK = 'button, a, select, textarea, input, [data-nodrag]';
let installed = false;
/** The bar under the pointer and its number, as they are in the page now. */
function surfaceAt(target) {
  const el = target && target.closest ? target.closest('[data-scrub]') : null;
  const o = el && SURFACES.get(el.getAttribute('data-scrub'));
  const input = el && el.querySelector('input.scrubbable');
  if (!o || !input || input.disabled) return null;
  return { el, o, input, E: engine(input, o, el), vert: o.axis === 'y' };
}
function install() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const S = surfaceAt(e.target);
    if (!S || !S.E.ranged || (e.target.closest && e.target.closest(BLOCK))) return; // the number and the switches keep their own clicks
    e.preventDefault();
    if (document.activeElement === S.input) S.input.blur(); // leave typing: the bar has the hand now
    const { E, el, vert } = S;
    const size = Math.max(20, vert ? el.clientHeight : el.clientWidth);
    track(e, { el, marks: [el, S.input], v0: E.read(), vert, per: (E.hi - E.lo) / size, factor: (m) => ((m.ctrlKey || m.metaKey) ? 0.25 : 1),
      value: (raw, m) => E.snap(raw, m.shiftKey), live: E.live, commit: E.commit,
      click: () => { // a plain click: the level goes where you clicked
        const r = el.getBoundingClientRect();
        const f = vert ? 1 - (e.clientY - r.top) / Math.max(1, r.height) : (e.clientX - r.left) / Math.max(1, r.width);
        const v = E.snap(E.lo + Math.max(0, Math.min(1, f)) * (E.hi - E.lo), e.shiftKey);
        if (v !== E.read()) { E.live(v); E.commit(v); }
      } });
  });
  document.addEventListener('dblclick', (e) => {
    const S = surfaceAt(e.target);
    if (!S || S.o.reset === undefined || (e.target.closest && e.target.closest(BLOCK))) return;
    const v = S.E.clamp(S.E.round(S.o.reset));
    S.E.live(v); S.E.commit(v);
  });
}

let seq = 0;
function attach(input, o) {
  const E = engine(input, o, o.fill || null);
  const { step, read, show, live, commit, clamp, round } = E;
  const k = (e) => (e.shiftKey ? 10 : (e.ctrlKey || e.metaKey) ? 0.1 : 1);
  show(read());
  input.classList.add('scrubbable');
  const vert = o.axis === 'y';
  const surface = o.surface || null;
  if (!input.title) input.title = vert ? 'Drag up or down to change (Shift ×10, Ctrl fine) · ↑ ↓ step · click to type' : 'Drag sideways to change (Shift ×10, Ctrl fine) · ↑ ↓ step · click to type';
  if (surface && E.ranged) {
    const id = surface.getAttribute('data-key') || `scrub-${++seq}`;
    surface.setAttribute('data-scrub', id); surface.classList.add('scrub-surface');
    SURFACES.set(id, o); // the newest options win: the bar itself is morphed in place, never rebuilt
    install();
  }

  // the number itself: drag sideways (up / down on a tall tile); a plain click types
  input.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || document.activeElement === input || input.disabled) return;
    e.preventDefault();
    const bar = surface && E.ranged, tall = vert && o.span > 0 && E.ranged;
    const size = bar ? Math.max(20, vert ? surface.clientHeight : surface.clientWidth) : 0;
    track(e, { el: input, marks: [input, surface], v0: read(), vert, per: bar ? (E.hi - E.lo) / size : tall ? (E.hi - E.lo) / o.span : step,
      factor: bar || tall ? (m) => ((m.ctrlKey || m.metaKey) ? 0.25 : 1) : k,
      value: (raw, m) => (bar || tall ? E.snap(raw, m.shiftKey) : clamp(round(raw))), live, commit,
      click: () => { input.focus(); input.select(); } });
  });

  let timer = null;
  const nudge = (dir, e) => {
    const v = clamp(round(read() + dir * step * k(e)));
    live(v);
    clearTimeout(timer); timer = setTimeout(() => commit(read()), 400);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); nudge(e.key === 'ArrowUp' ? 1 : -1, e); }
  });
  input.addEventListener('wheel', (e) => {
    if (document.activeElement !== input) return; // never steal the page's scroll
    e.preventDefault(); nudge(e.deltaY < 0 ? 1 : -1, e);
  }, { passive: false });
  return { show };
}

/**
 * v0.80: a canvas that tracks its own drag (graph handles, the curve editor, the cloner stage) never gets stuck in
 * it — a move with no button down, a lost capture, or the window losing focus ends the drag through its own `end`.
 */
function guard(el, isDragging, end) {
  const stop = () => { if (isDragging()) end(); };
  el.addEventListener('pointermove', (e) => { if (e.buttons === 0) stop(); });
  el.addEventListener('lostpointercapture', stop);
  window.addEventListener('blur', stop);
}

module.exports = { attach, guard, engine, track };
