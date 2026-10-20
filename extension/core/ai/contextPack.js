'use strict';
/**
 * Builds the compact project context sent to Claude. Only the active comp and
 * the current selection — never the whole project, never file paths.
 * Smaller context = lower cost and less noise.
 */

const r3 = (n) => (typeof n === 'number' ? Math.round(n * 1000) / 1000 : n);

function packContext(ctx, { maxLayers = 30, maxProps = 30, maxExpr = 1500 } = {}) {
  if (!ctx || !ctx.comp) return { comp: null, note: 'No active composition.' };
  const c = ctx.comp;
  const layerName = new Map((ctx.layers || []).map((l) => [l.id, l.name]));
  return {
    comp: { name: c.name, fps: r3(c.frameRate), duration: r3(c.duration), size: [c.width, c.height], currentTime: r3(c.time) },
    expressionEngine: ctx.expressionEngine || 'unknown',
    selectedLayers: (ctx.layers || []).slice(0, maxLayers).map((l) => ({
      index: l.index, name: l.name, type: l.type, start: r3(l.startTime), in: r3(l.inPoint), out: r3(l.outPoint), text: l.text ? String(l.text).slice(0, 80) : undefined,
      parent: l.parentIndex, locked: l.locked || undefined, threeD: l.threeD || undefined
    })),
    selectedProperties: (ctx.properties || []).slice(0, maxProps).map((p) => ({
      layer: layerName.get(p.address.layerId) || `#${p.address.layerIndex}`,
      name: p.name,
      matchName: p.matchName,
      valueType: p.valueType,
      keys: p.numKeys,
      selectedKeys: p.selectedKeys.length,
      expression: p.expression ? String(p.expression).slice(0, maxExpr) : undefined,
      expressionError: p.expressionError || undefined
    })),
    compLayers: (ctx.compLayers || []).slice(0, 60).map((l) => ({ index: l.index, name: l.name, type: l.type })),
    brands: ctx.brands && ctx.brands.length ? ctx.brands : undefined,
    textPresets: ctx.textPresets && ctx.textPresets.length ? ctx.textPresets : undefined,
    truncated: ctx.truncated || (ctx.layers || []).length > maxLayers || (ctx.properties || []).length > maxProps || undefined
  };
}

module.exports = { packContext };
