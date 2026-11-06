'use strict';
/**
 * Rename watch (v0.62, docs/features/LINKS.md). Between two context reads of the SAME comp, a layer id whose name
 * changed is a rename. If MOE expressions link to it (links.scan, read-only), the panel runs Relink — one undo
 * step, one toast that says what changed. Settings › engine.autoRelink = false turns it off.
 *
 *   renamed(prev, next)   → [{ id, from, to }]   pure
 *   watch(app, prev, next) → Promise             scans and relinks when needed
 */
function renamed(prev, next) {
  if (!prev || !next || !prev.comp || !next.comp || prev.comp.id !== next.comp.id) return [];
  const was = new Map((prev.compLayers || []).map((l) => [l.id, l.name]));
  return (next.compLayers || []).filter((l) => was.has(l.id) && was.get(l.id) !== l.name).map((l) => ({ id: l.id, from: was.get(l.id), to: l.name }));
}

async function watch(app, prev, next) {
  const changes = renamed(prev, next);
  if (!changes.length) return null;
  const s = app.services.settings.get();
  if (s.engine && s.engine.autoRelink === false) return null;
  const scan = await app.services.host.call('links.scan', { compId: next.comp.id });
  if (!scan.renamed.length) return null;
  const r = await app.services.executor.run('links.relink', {}, { origin: 'user', approved: true });
  if (r && r.status === 'success') app.toast(`${r.summary} — Ctrl+Z undoes it`, 4200, 'ok');
  else if (r) app.toast(`Relink: ${(r.errors || []).join(', ') || r.status}`, 4200, 'warn');
  return r;
}

module.exports = { renamed, watch };
