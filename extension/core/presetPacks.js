'use strict';
/**
 * User presets ("My Presets") and shareable preset packs.
 *
 * A preset = { id, toolId, name, args, tile? } where `tile` is the library tile it was saved
 * from (its thumbnail is reused). A pack is plain JSON:
 *   { format: 'moe-presets', version: 1, exportedAt, presets: [{ toolId, name, args, tile }] }
 * Imported packs are untrusted: unknown tools are skipped, every args object is re-validated
 * against the tool's own schema, names are trimmed and the count is capped.
 */
const { validateArgs } = require('./schema');

const FORMAT = 'moe-presets';
const MAX = 500;

function exportPack(presets, { toolIds } = {}) {
  const list = presets.filter((p) => !toolIds || toolIds.includes(p.toolId)).map((p) => ({ toolId: p.toolId, name: p.name, args: p.args, tile: p.tile || null }));
  return JSON.stringify({ format: FORMAT, version: 1, exportedAt: new Date().toISOString(), presets: list }, null, 2);
}

/** Parse + validate a pack. Returns { ok, presets: [valid], skipped: [reasons] } — nothing is saved here. */
function parsePack(text, registry) {
  let doc;
  try { doc = JSON.parse(String(text || '')); } catch (e) { return { ok: false, presets: [], skipped: ['Not valid JSON'] }; }
  if (!doc || doc.format !== FORMAT || !Array.isArray(doc.presets)) return { ok: false, presets: [], skipped: ['Not a MOE preset pack (format "moe-presets")'] };
  const presets = [], skipped = [];
  for (const [i, p] of doc.presets.slice(0, MAX).entries()) {
    const label = `#${i + 1}${p && p.name ? ` "${String(p.name).slice(0, 40)}"` : ''}`;
    const tool = p && typeof p.toolId === 'string' ? registry.get(p.toolId) : null;
    if (!tool) { skipped.push(`${label}: unknown tool ${p && p.toolId}`); continue; }
    const name = String(p.name || '').trim().slice(0, 40);
    if (!name) { skipped.push(`${label}: no name`); continue; }
    const v = validateArgs(tool.params || {}, p.args || {});
    if (!v.ok) { skipped.push(`${label}: ${v.errors.join(', ')}`); continue; }
    presets.push({ toolId: tool.id, name, args: p.args || {}, tile: typeof p.tile === 'string' ? p.tile.slice(0, 60) : null });
  }
  if (doc.presets.length > MAX) skipped.push(`Only the first ${MAX} presets were read`);
  return { ok: presets.length > 0, presets, skipped };
}

module.exports = { exportPack, parsePack, FORMAT, MAX };
