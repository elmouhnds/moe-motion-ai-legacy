'use strict';
/** Minimal observable UI state. */
function createState(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      state = Object.assign({}, state, typeof patch === 'function' ? patch(state) : patch);
      subs.forEach((fn) => fn(state));
    },
    sub: (fn) => { subs.add(fn); return () => subs.delete(fn); }
  };
}
module.exports = { createState };
