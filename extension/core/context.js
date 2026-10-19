'use strict';
/**
 * Context requirements: declarative conditions a tool needs from the current
 * After Effects selection. Evaluated locally against the read-only snapshot
 * returned by the host op `context.get`.
 *
 *   requires: {
 *     comp: true,
 *     minLayers, maxLayers,
 *     minProperties,
 *     selectedKeys: 1,          // at least N selected keyframes across selected properties
 *     keyframedProperties: 1,   // at least N selected properties that have keyframes
 *     expressionCapable: 1      // at least N selected properties that accept expressions
 *   }
 */

function summarize(ctx) {
  const props = (ctx && ctx.properties) || [];
  return {
    hasProject: !!(ctx && ctx.project),
    hasComp: !!(ctx && ctx.comp),
    layers: ((ctx && ctx.layers) || []).length,
    properties: props.length,
    selectedKeys: props.reduce((n, p) => n + (p.selectedKeys ? p.selectedKeys.length : 0), 0),
    keyframedProperties: props.filter((p) => p.numKeys > 0).length,
    expressionCapable: props.filter((p) => p.canSetExpression).length,
    withExpressions: props.filter((p) => p.expression).length
  };
}

function evaluate(requires, ctx) {
  const r = requires || {};
  const s = summarize(ctx);
  const reasons = [];
  if ((r.comp || r.minLayers || r.minProperties || r.selectedKeys) && !s.hasComp) {
    reasons.push('Open a composition');
  } else {
    if (r.minLayers && s.layers < r.minLayers) {
      reasons.push(r.minLayers === 1 ? 'Select a layer' : `Select at least ${r.minLayers} layers`);
    }
    if (r.maxLayers && s.layers > r.maxLayers) reasons.push(`Select at most ${r.maxLayers} layers`);
    if (r.minProperties && s.properties < r.minProperties) reasons.push('Select a property');
    if (r.keyframedProperties && s.keyframedProperties < r.keyframedProperties) reasons.push('Select a keyframed property');
    if (r.selectedKeys && s.selectedKeys < r.selectedKeys) reasons.push('Select keyframes');
    if (r.expressionCapable && s.expressionCapable < r.expressionCapable) reasons.push('Select a property that accepts expressions');
  }
  return { ok: reasons.length === 0, reasons, summary: s };
}

module.exports = { evaluate, summarize };
