'use strict';
/** Shared helpers for compositing tools: target checks, sampling, effect write/verify/restore. */
const cm = require('./colorMath');

const KEYS = { grade: 'MOE Grade', match: 'MOE Match', key: 'MOE Key', cleaner: 'MOE Key Cleaner', spill: 'MOE Spill', choke: 'MOE Choke' };
const MATCH = { mixer: 'ADBE CHANNEL MIXER', keylight: 'Keylight 906', cleaner: 'ADBE KeyCleaner', spill: 'ADBE Spill2', choker: 'ADBE Simple Choker' };
const OTHER_KEYERS = ['Keylight 906', 'ADBE Linear Color Key2', 'ADBE Color Range', 'ADBE Extract', 'ADBE ATG Extract', 'ADBE Color Key', 'ADBE Luma Key', 'ADBE Difference Matte2', 'ADBE Color Difference Key'];
const QUALITY = {
  fast: { cols: 3, rows: 3, times: 1 },
  balanced: { cols: 4, rows: 4, times: 3 },
  thorough: { cols: 6, rows: 6, times: 5 }
};
const QUALITY_PARAM = {
  type: 'enum', label: 'Analysis', default: 'balanced', advanced: true, description: 'How many pixel regions and frames to measure',
  options: [{ value: 'fast', label: 'Fast' }, { value: 'balanced', label: 'Balanced' }, { value: 'thorough', label: 'Thorough' }]
};
const SAMPLE_TIMEOUT = 180000;
/* Channel Mixer: 12 weights/constants + Monochrome. Fallback mapping is only trusted at this count. */
const MIXER_PARAM_COUNT = 13;
const NO_PIXELS = new Set(['null', 'camera', 'light']);

/** Selected layers usable for compositing. `needPixels` excludes adjustment layers too. */
function targets(ctx, { needPixels }) {
  const usable = [];
  const skipped = [];
  for (const l of ctx.layers || []) {
    if (l.locked) skipped.push(`${l.name} (locked)`);
    else if (NO_PIXELS.has(l.type)) skipped.push(`${l.name} (${l.type} layer)`);
    else if (needPixels && l.type === 'adjustment') skipped.push(`${l.name} (adjustment layer has no source pixels)`);
    else if (needPixels && !(l.width > 0 && l.height > 0)) skipped.push(`${l.name} (no pixels)`);
    else usable.push(l);
  }
  return { usable, skipped };
}

/** Sample times inside a layer's visible range. */
function sampleTimes(layer, ctx, count, mode) {
  const fd = ctx.comp.frameDuration;
  const a = Math.max(layer.inPoint, 0);
  const b = Math.min(layer.outPoint, ctx.comp.duration) - fd;
  if (mode === 'current' || count === 1 || b <= a) {
    const t = ctx.comp.time;
    return [Math.min(Math.max(t, a), Math.max(a, b))];
  }
  return Array.from({ length: count }, (_, i) => Math.round((a + ((i + 1) / (count + 1)) * (b - a)) / fd) * fd);
}

/** Does the layer carry a keyer (ours or the user's)? Then measure the keyed subject only. */
function isKeyed(layer) {
  return (layer.effects || []).some((e) => e.enabled !== false && (e.name === KEYS.key || OTHER_KEYERS.includes(e.matchName)));
}

/**
 * Sample a layer. Unkeyed: source pixels (before effects). Keyed: after effects,
 * so the screen is transparent and ignored — with MOE Grade / MOE Match bypassed
 * so our own corrections never feed back into the measurement.
 */
async function sample(host, ctx, layer, { quality = 'balanced', times, screen = false }) {
  const q = QUALITY[quality] || QUALITY.balanced;
  const keyed = !screen && isKeyed(layer);
  const res = await host.call('pixels.sample', {
    compId: ctx.comp.id, layer: { layerId: layer.id }, cols: q.cols, rows: q.rows,
    times: times || sampleTimes(layer, ctx, q.times, 'spread'),
    postEffect: keyed, bypass: keyed ? [KEYS.grade, KEYS.match] : []
  }, { timeoutMs: SAMPLE_TIMEOUT });
  const cells = res.samples.flatMap((s) => s.cells);
  return { raw: res, cells, stats: cm.stats(cells), keyed, probeOk: res.layerCountAfter === res.layerCountBefore };
}

/** Effects already on a layer that are not ours. */
function foreignKeyers(layer) {
  const ours = new Set(Object.values(KEYS));
  return (layer.effects || []).filter((e) => OTHER_KEYERS.includes(e.matchName) && !ours.has(e.name));
}

async function writeEffects(host, ctx, layers, label) {
  return host.call('effects.ensure', { compId: ctx.comp.id, label, layers });
}

/** Verify an effects.ensure result against the requested values. */
function verifyEffects(result, requested, extraChecks = []) {
  const checks = [...extraChecks];
  for (const L of result.layers) {
    const req = requested.find((r) => r.layer.layerId === L.layerId);
    for (const item of L.items) {
      const want = req.items.find((i) => i.key === item.key);
      const unverifiedMap = item.params.filter((p) => p.resolvedBy !== 'name').map((p) => p.id);
      const bad = item.params.filter((p) => {
        const w = want.params.find((x) => x.id === p.id).value;
        return Array.isArray(w) ? w.some((v, i) => Math.abs(v - p.after[i]) > 0.01) : Math.abs(w - p.after) > 0.01;
      });
      checks.push({
        ok: bad.length === 0,
        label: `${L.name} › ${item.key}`,
        detail: bad.length ? `value mismatch: ${bad.map((p) => p.id).join(', ')}`
          : `${item.created ? 'added' : 'updated'}${item.params.length ? `, ${item.params.length} param(s) read back` : ''}${unverifiedMap.length ? ` · mapping unverified: ${unverifiedMap.join(', ')}` : ''}`
      });
    }
  }
  return { ok: checks.length > 0 && checks.every((c) => c.ok), checks };
}

function effectsCheckpoint(result, ctx) {
  return {
    compId: ctx.comp.id,
    layers: result.layers.map((L) => ({
      layer: { layerId: L.layerId },
      items: L.items.map((i) => ({ key: i.key, matchName: i.matchName, created: i.created, params: i.params.map((p) => ({ index: p.index, before: p.before })) }))
    }))
  };
}

async function restoreEffects({ data, host }) {
  return host.call('effects.restore', { compId: data.compId, label: 'MOE: Restore Effects', layers: data.layers });
}

const pct = (v) => `${Math.round(v * 100)}%`;
const rgbText = (c) => c.map((v) => v.toFixed(2)).join(' / ');

module.exports = { isKeyed, MIXER_PARAM_COUNT, KEYS, MATCH, QUALITY, QUALITY_PARAM, targets, sampleTimes, sample, foreignKeyers, writeEffects, verifyEffects, effectsCheckpoint, restoreEffects, pct, rgbText };
