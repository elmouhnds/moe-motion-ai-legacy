'use strict';
/**
 * Locked layers (v0.61, docs/features/ENGINE2.md; the study's rule 9 / defect A1) — pure, ONE rule for the executor
 * and the panel's readiness check: a tool that writes (modify.*) never receives a locked layer. They are taken out of
 * the selection and named; with nothing unlocked left, a selection tool is refused with that reason.
 * A tool that only looks at the selected layer (a zoom target, click points) declares ui.lockedOk.
 *
 *   apply(tool, ctx) → { ctx, skipped: [names], error?: string }
 */
const writes = (tool) => (tool.permissions || []).some((p) => /^modify\./.test(p));

function apply(tool, ctx) {
  if (!ctx || !writes(tool) || (tool.ui && tool.ui.lockedOk)) return { ctx, skipped: [] };
  // locked = a selected layer that is locked, or the layer of a selected property (a property can be picked alone)
  const lockedIds = new Set([...(ctx.layers || []), ...(ctx.compLayers || [])].filter((l) => l.locked).map((l) => l.id));
  const props = (ctx.properties || []).filter((p) => p.address && lockedIds.has(p.address.layerId));
  const lays = (ctx.layers || []).filter((l) => l.locked);
  if (!lays.length && !props.length) return { ctx, skipped: [] };
  const names = [...new Set([...lays.map((l) => l.name), ...props.map((p) => ((ctx.compLayers || []).find((l) => l.id === p.address.layerId) || {}).name || 'a layer')])];
  const out = Object.assign({}, ctx, { layers: (ctx.layers || []).filter((l) => !l.locked), properties: (ctx.properties || []).filter((p) => !(p.address && lockedIds.has(p.address.layerId))) });
  if (!out.layers.length && !out.properties.length && tool.requires && (tool.requires.minLayers || tool.requires.minProperties || tool.requires.keyframedProperties || tool.requires.selectedKeys || tool.requires.expressionCapable)) {
    return { ctx: out, skipped: names, error: lockedReason(names) };
  }
  return { ctx: out, skipped: names };
}

const lockedReason = (names) => `${names.length > 1 ? `${names.length} selected layers are` : `"${names[0]}" is`} locked — unlock to change ${names.length > 1 ? 'them' : 'it'}`;
/** A refusal after locked layers were taken out says so (the real reason the tool found nothing to do). */
const explain = (error, skipped) => (skipped && skipped.length && !/locked/.test(error || '') ? `${error || 'Nothing to change'} — ${lockedReason(skipped)}` : error);

module.exports = { writes, apply, explain };
