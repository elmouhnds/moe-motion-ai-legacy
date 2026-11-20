'use strict';
/**
 * The pie's centre search (v1.0, docs/features/QUICK_APPLY.md — the owner: "like FX Console: type what you want —
 * tools, effects, presets, anything in After Effects — instead of looking for it").
 * One list from two sources, ranked together:
 *   - MOE: everything Ctrl+K finds (tools, presets, one-click actions, recipes, sections) — palette.results;
 *   - After Effects: its effects, its animation presets and its everyday menu commands — features/quickapply/catalog.
 * After Effects items run through registered tools (quick.applyEffect / applyPreset / runCommand).
 */
const CAT = require('../../features/quickapply/catalog');

/** Rank (pure): every word of the query must be in the name or the description; name hits rank higher. */
function rank(items, q, limit = 40) {
  const words = String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored = [];
  items.forEach((x, i) => {
    const n = String(x.name || '').toLowerCase(), d = String(x.desc || '').toLowerCase();
    if (!words.every((w) => n.includes(w) || d.includes(w))) return;
    const full = words.join(' ');
    const s = n === full ? 6 : n.startsWith(full) ? 5 : n.includes(full) ? 4 : words.every((w) => n.includes(w)) ? 3 : 1;
    scored.push({ x, i, s, moe: x.kind && x.kind.slice(0, 3) !== 'ae-' ? 1 : 0 });
  });
  return scored.sort((a, b) => b.s - a.s || b.moe - a.moe || a.i - b.i).slice(0, limit).map((o) => o.x);
}

/** The catalogue of After Effects (read once per panel session, shared). */
function catalogOf(app) {
  if (!app.services.quickCatalog) app.services.quickCatalog = CAT.createCatalog(app.services.host);
  return app.services.quickCatalog;
}

/** The After Effects items as runnable results. mods: { adjustment } → an effect goes on a new adjustment layer. */
function aeItems(app) {
  const cat = catalogOf(app).data;
  return CAT.items(cat).map((it) => Object.assign(it, {
    ws: it.kind === 'ae-effect' ? 'Effect' : it.kind === 'ae-preset' ? 'Preset' : 'Menu',
    run: (mods = {}) => runAe(app, it, mods)
  }));
}

async function runAe(app, it, mods) {
  let r;
  if (it.kind === 'ae-effect') r = await app.runTool('quick.applyEffect', { matchName: it.matchName, effectName: it.name, target: mods.adjustment ? 'adjustment' : 'layers' }, { label: it.name });
  else if (it.kind === 'ae-preset') r = await app.runTool('quick.applyPreset', { path: it.path, presetName: it.name }, { label: it.name });
  else r = await app.runTool('quick.runCommand', { command: it.command }, { label: it.name });
  if (r) {
    const ok = r.status === 'success' || r.status === 'partial';
    app.toast(ok ? (r.summary || it.name) : `${it.name}: ${(r.errors || r.reasons || [r.status]).join(' · ')}`, ok ? 2600 : 5000, ok ? 'ok' : 'warn');
  }
  return r;
}

/** MOE's own results for the query (the Ctrl+K list), as the same shape. */
function moeItems(app, q) {
  try { return require('./palette').results(app, q).map((x) => Object.assign({}, x, { run: () => x.run() })); } catch (e) { return []; }
}

/** Everything for a query — MOE first among equals. */
function results(app, q) {
  const moe = moeItems(app, q);
  const all = moe.concat(aeItems(app));
  const ranked = rank(all, q);
  // Arabic: palette.results already matched by meaning; keep its list when the word rank finds nothing
  return ranked.length ? ranked : moe.slice(0, 40);
}

module.exports = { rank, results, catalogOf, aeItems, runAe };
