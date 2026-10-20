'use strict';
/** Measure a comp for the planner: structure (layers.describe) + comp-space boxes at the reference time and across time. */
const P = require('./planner');

const UNION_SAMPLES = 5;

function sampleTimes(info, refTime) {
  const fd = info.frameDuration;
  const snap = (t) => Math.round(t / fd) * fd;
  const out = [snap(Math.min(Math.max(refTime, 0), info.duration - fd))];
  for (let i = 0; i < UNION_SAMPLES; i++) out.push(snap(((i + 0.5) / UNION_SAMPLES) * (info.duration - fd)));
  return out;
}

/**
 * Returns { info, elements, bounds } for comp `compId`.
 * `any` = the comp may be a non-active comp (nested pre-comps).
 */
async function measureComp(host, compId, { refTime, any = false } = {}) {
  const info = await host.call('layers.describe', { compId, any });
  const visual = info.layers.filter((L) => !['camera', 'light'].includes(L.type) && L.hasVideo !== false);
  const times = sampleTimes(info, refTime === undefined ? info.time : refTime);
  const bounds = {};
  if (visual.length) {
    const res = await host.call('layers.bounds', { compId, any, layerIds: visual.map((L) => L.id), times }, { timeoutMs: 120000 });
    if (res.layerCountAfter !== res.layerCountBefore) throw new Error('Measurement probe was not removed — check the comp (Edit › Undo).');
    for (const L of res.layers) {
      if (L.error || !L.boxes.length) { bounds[L.layerId] = { ref: null, union: null, error: L.error }; continue; }
      const live = (i) => { const D = info.layers.find((x) => x.id === L.layerId); const t = times[i]; return t >= D.inPoint - 1e-6 && t < D.outPoint; };
      const ok = (b) => b && b.every(Number.isFinite) && b[2] > b[0] && b[3] > b[1];
      const ref = live(0) && ok(L.boxes[0]) ? L.boxes[0] : null;
      let uni = null;
      L.boxes.forEach((b, i) => { if (live(i) && ok(b)) uni = P.union(uni, b); });
      bounds[L.layerId] = { ref: ref || uni, union: uni };
    }
  }
  return { info, bounds, elements: P.buildElements(info, bounds), times };
}

module.exports = { measureComp, sampleTimes };
