'use strict';
/**
 * Smart controls (v0.56, docs/features/SMART_CONTROLS.md): every number field is also a hidden slider.
 *
 *   attach(input, { step, min, max, round, live(v), commit(v), fill })
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
 * Inputs are rebuilt on every render, so listeners are attached directly (UI rule: allowed on inputs).
 */
function attach(input, o) {
  const step = o.step > 0 ? o.step : 1;
  const lo = o.min === undefined ? -Infinity : o.min, hi = o.max === undefined ? Infinity : o.max;
  const dec = (String(step).split('.')[1] || '').length;
  const round = o.round || ((v) => Number(v.toFixed(Math.min(4, dec + 1))));
  const clamp = (v) => Math.max(lo, Math.min(hi, v));
  const read = () => { const n = Number(String(input.value).replace(',', '.')); return Number.isFinite(n) ? n : (Number.isFinite(lo) ? lo : 0); };
  const show = (v) => {
    input.value = String(v);
    if (o.fill && Number.isFinite(lo) && Number.isFinite(hi) && hi > lo) o.fill.style.setProperty('--p', `${Math.round(((v - lo) / (hi - lo)) * 1000) / 10}%`);
  };
  const k = (e) => (e.shiftKey ? 10 : (e.ctrlKey || e.metaKey) ? 0.1 : 1);
  const live = (v) => { show(v); if (o.live) o.live(v); };
  const commit = (v) => { if (o.commit) o.commit(v); };
  show(read());
  input.classList.add('scrubbable');
  if (!input.title) input.title = o.axis === 'y' ? 'Drag up or down to change (Shift ×10, Ctrl fine) · ↑ ↓ step · click to type' : 'Drag sideways to change (Shift ×10, Ctrl fine) · ↑ ↓ step · click to type';

  input.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || document.activeElement === input || input.disabled) return;
    e.preventDefault();
    const x0 = e.clientX, y0 = e.clientY, v0 = read();
    const vert = o.axis === 'y';
    const per = vert && o.span > 0 && Number.isFinite(lo) && Number.isFinite(hi) ? (hi - lo) / o.span : step;
    let moved = false, v = v0, cancelled = false;
    try { input.setPointerCapture(e.pointerId); } catch (_) { /* older CEP */ }
    const move = (m) => {
      const dx = vert ? y0 - m.clientY : m.clientX - x0;
      if (!moved && Math.abs(dx) < 3) return;
      if (!moved) { moved = true; input.classList.add('scrubbing'); }
      const raw = v0 + dx * per * k(m);
      v = clamp(round(vert ? Math.round(raw / step) * step : raw));
      live(v);
    };
    const esc = (ke) => { if (ke.key === 'Escape' && moved) { cancelled = true; live(v0); end(); } };
    const end = () => {
      input.removeEventListener('pointermove', move); input.removeEventListener('pointerup', end); input.removeEventListener('pointercancel', end);
      document.removeEventListener('keydown', esc, true);
      input.classList.remove('scrubbing');
      if (cancelled) return;
      if (moved) commit(v); else { input.focus(); input.select(); }
    };
    input.addEventListener('pointermove', move); input.addEventListener('pointerup', end); input.addEventListener('pointercancel', end);
    document.addEventListener('keydown', esc, true);
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

module.exports = { attach };
