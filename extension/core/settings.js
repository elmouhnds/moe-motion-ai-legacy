'use strict';
/** Settings with defaults; stored in the product's own data folder. */

const { DEFAULT_POLICY } = require('./permissions');

const DEFAULTS = {
  ai: {
    enabled: true,
    model: 'claude-opus-5-5',
    effort: 'medium',
    monthlyBudgetUSD: 20,
    priceOverrides: {}
  },
  permissions: Object.assign({}, DEFAULT_POLICY),
  limits: { maxLayers: 200, maxProps: 200 },
  updates: { feedUrl: '', autoCheck: true, lastCheck: '' },
  ui: { density: 'auto', workspace: 'home', theme: 'auto', accent: 'tomato', motion: 'calm', motionV: 2, headings: 'display', banners: true, splash: true, seenVersion: '', tiles: 'auto', hiddenSections: [], wsLast: {}, pie: { mode: 'smart', mine: [], holdQ: true, rightHold: true } }
};

function merge(base, over) {
  const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
  for (const [k, v] of Object.entries(over || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' ? merge(base[k], v) : v;
  }
  return out;
}

function createSettings(store) {
  let current = merge(DEFAULTS, store.get('settings', {}));
  let seen = store.version ? store.version('settings') : 0;
  const listeners = new Set();
  // The other MOE panel may have saved settings: pick them up before reading or changing them.
  const fresh = () => {
    if (!store.version) return;
    const v = store.version('settings');
    if (v !== seen) { seen = v; current = merge(DEFAULTS, store.get('settings', {})); }
  };
  return {
    get: () => { fresh(); return current; },
    update(patch) {
      fresh();
      current = merge(current, patch);
      store.set('settings', current);
      if (store.version) seen = store.version('settings');
      listeners.forEach((fn) => fn(current));
      return current;
    },
    reset() { current = merge(DEFAULTS, {}); store.set('settings', current); listeners.forEach((fn) => fn(current)); },
    on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }
  };
}

module.exports = { createSettings, DEFAULTS, merge };
