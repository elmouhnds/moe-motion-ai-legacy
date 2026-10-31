'use strict';
/**
 * Brand in action (v0.26, docs/features/BRAND_IN_ACTION.md) — pure helpers, tested.
 *   activeBrand(store, brands)  the client you are working for (Brand page choice, remembered)
 *   brandBackgrounds(brand)     Backgrounds presets from the brand: its gradients, its palette, a soft mesh
 *   saveBrandBackgrounds(...)   writes them as "Mine" presets of design.background (re-saving replaces them)
 *   brandEaseRef(brand)         the brand's motion feel → the existing ease that matches it
 */
const { brandRoles } = require('./applyAll');

const ACTIVE_KEY = 'brand-active';
const activeId = (store) => store.get(ACTIVE_KEY, null);
function activeBrand(store, brands) {
  const all = brands.list();
  return brands.get(activeId(store)) || (all.length === 1 ? all[0] : null);
}
const setActive = (store, id) => store.set(ACTIVE_KEY, id || null);

/** Up to 4 background presets for a client (palette 'custom' = its own colours). */
function brandBackgrounds(brand) {
  const out = [];
  const p = brand && brand.profile || {};
  const base = { palette: 'custom', paletteName: brand ? brand.name : '', grain: 0, motion: 'none', colorMotion: 'none' };
  for (const g of (p.gradients || []).slice(0, 2)) {
    if ((g.stops || []).length < 2) continue;
    out.push({ name: `${brand.name} · ${g.name}`, args: Object.assign({}, base, { colors: g.stops.slice(0, 5).join(', '), style: 'linear', from: 0, to: Math.min(g.stops.length, 5) - 1, angle: 135, spread: 100 }) });
  }
  const r = brandRoles(brand);
  if (r) {
    const uniq = [r.primary, r.secondary, r.accent, r.background].map((c) => c.hex).filter((h, i, a) => a.indexOf(h) === i);
    if (uniq.length >= 2) {
      out.push({ name: `${brand.name} · Brand glow`, args: Object.assign({}, base, { colors: uniq.join(', '), style: 'radial', from: 0, to: uniq.indexOf(r.background.hex) >= 0 ? uniq.indexOf(r.background.hex) : 1, spread: 120 }) });
      out.push({ name: `${brand.name} · Soft mesh`, args: Object.assign({}, base, { colors: [r.background.hex].concat(uniq.filter((h) => h !== r.background.hex)).join(', '), style: 'mesh', from: 0, to: 1, motion: 'drift', loop: 10, amount: 30 }) });
    }
  }
  return out.slice(0, 4);
}

/** Save them as Backgrounds › Mine presets (ids brand_<client>_<n>; saving again replaces the old ones). */
function saveBrandBackgrounds(presets, brand) {
  const list = brandBackgrounds(brand);
  const prefix = `brand_${brand.id}_`;
  for (const p of presets.list('design.background')) if (String(p.id).indexOf(prefix) === 0) presets.remove(p.id);
  list.forEach((b, i) => presets.save('design.background', b.name.slice(0, 40), b.args, { id: `${prefix}${i}`, tile: 'bg-tomato' }));
  return list.length;
}

/** The ease that matches the brand's motion feel (the refs are existing presets / quick actions). */
const EASE_REF = { smooth: 'tile:animate/easeSmooth', snappy: 'tile:animate/easeSnappy', gentle: 'tile:animate/easeGentle', bouncy: 'quick:curveBack', elastic: 'quick:curveBack', linear: 'quick:k_linear' };
const brandEaseRef = (brand) => { const e = brand && brand.profile && brand.profile.motion && brand.profile.motion.easing; return EASE_REF[e] || null; };

module.exports = { ACTIVE_KEY, activeBrand, setActive, brandBackgrounds, saveBrandBackgrounds, brandEaseRef, EASE_REF };
