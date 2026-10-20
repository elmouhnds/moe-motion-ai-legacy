'use strict';
/** Minimal observable UI state. */
function createState(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    /** Shallow merge; listeners run only when a value actually changed. */
    set(patch) {
      const p = typeof patch === 'function' ? patch(state) : patch;
      if (!p) return;
      let changed = false;
      for (const k of Object.keys(p)) if (!Object.is(state[k], p[k])) { changed = true; break; }
      if (!changed) return;
      state = Object.assign({}, state, p);
      subs.forEach((fn) => fn(state));
    },
    sub: (fn) => { subs.add(fn); return () => subs.delete(fn); }
  };
}
module.exports = { createState };
