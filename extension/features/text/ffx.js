'use strict';
/**
 * Read-only parser for After Effects text-animator presets (.ffx, RIFX big-endian).
 * Extracts what a library preview needs: animator name, range selector advanced
 * settings, non-default animator properties and the Offset/Start/End keyframes.
 * Unknown structures are reported, never guessed. Applying a .ffx always uses AE's
 * own Layer.applyPreset(), so the parser only drives previews and metadata.
 */

const DEFAULTS = {
  'ADBE Text Position 3D': [0, 0, 0], 'ADBE Text Scale 3D': [100, 100, 100], 'ADBE Text Rotation': [0], 'ADBE Text Opacity': [100],
  'ADBE Text Blur': [0, 0], 'ADBE Text Tracking Amount': [0], 'ADBE Text Skew': [0]
};
const PROP_KEY = { 'ADBE Text Position 3D': 'position', 'ADBE Text Scale 3D': 'scale', 'ADBE Text Rotation': 'rotation', 'ADBE Text Opacity': 'opacity', 'ADBE Text Blur': 'blur', 'ADBE Text Tracking Amount': 'tracking', 'ADBE Text Skew': 'skew' };
const ADV = { 'ADBE Text Range Type2': 'basedOn', 'ADBE Text Range Shape': 'shape', 'ADBE Text Levels Max Ease': 'easeHigh', 'ADBE Text Levels Min Ease': 'easeLow', 'ADBE Text Selector Smoothness': 'smoothness', 'ADBE Text Randomize Order': 'randomize', 'ADBE Text Range Units': 'units', 'ADBE Text Selector Mode': 'mode', 'ADBE Text Selector Max Amount': 'amount' };
const KEYED = new Set(['ADBE Text Percent Offset', 'ADBE Text Percent Start', 'ADBE Text Percent End']);

function parse(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const str = (o, n) => String.fromCharCode(...b.subarray(o, o + n));
  if (str(0, 4) !== 'RIFX' || str(8, 4) !== 'FaFX') throw new Error('Not an After Effects preset (.ffx)');
  const out = { animators: [], warnings: [], timescale: 30720 };
  let mn = null;
  let current = null;
  const cstr = (o, n) => { let s = ''; for (let i = 0; i < n && b[o + i]; i++) s += String.fromCharCode(b[o + i]); return s; };
  const utf8 = (o, n) => { const bytes = []; for (let i = 0; i < n && b[o + i]; i++) bytes.push(b[o + i]); try { return decodeURIComponent(escape(String.fromCharCode(...bytes))); } catch (e) { return String.fromCharCode(...bytes); } };
  function walk(off, end) {
    while (off + 8 <= end) {
      const id = str(off, 4);
      const size = dv.getUint32(off + 4);
      const d = off + 8;
      if (id === 'LIST') walk(d + 4, d + size);
      else if (id === 'besc' && size >= 20) { const ts = dv.getUint32(d + 12); if (ts > 0) out.timescale = ts; }
      else if (id === 'tdmn') {
        mn = cstr(d, size);
        if (mn === 'ADBE Text Animator') { current = { name: null, advanced: {}, props: {}, keys: null }; out.animators.push(current); }
      } else if (id === 'tdsn' && current && current.name === null && mn === 'ADBE Text Animator') {
        // tdsn wraps a "Utf8" chunk: id, u32 length, bytes
        const inner = str(d, 4) === 'Utf8' ? utf8(d + 8, dv.getUint32(d + 4)) : utf8(d, size);
        current.name = inner.trim() || 'Animator';
      } else if (id === 'cdat' && current) {
        const n = Math.floor(size / 8);
        const vals = [];
        for (let i = 0; i < Math.min(n, 3); i++) vals.push(dv.getFloat64(d + i * 8));
        if (ADV[mn]) current.advanced[ADV[mn]] = vals[0];
        else if (PROP_KEY[mn]) {
          const def = DEFAULTS[mn];
          const v = vals.slice(0, def.length);
          if (v.some((x, i) => Math.abs(x - def[i]) > 1e-6)) current.props[PROP_KEY[mn]] = def.length === 1 ? v[0] : v;
        }
      } else if (id === 'ldat' && current && KEYED.has(mn)) {
        const rec = 48;
        const list = [];
        for (let k = d; k + rec <= d + size; k += rec) {
          // record: ticks u32 · flags u32 · value f64 · inSpeed f64 · inInfluence f64 · outSpeed f64 · outInfluence f64
          list.push({ ticks: dv.getUint32(k), v: dv.getFloat64(k + 8), inInfl: dv.getFloat64(k + 24) * 100, outInfl: dv.getFloat64(k + 40) * 100 });
        }
        if (list.length === 2) current.keys = { matchName: mn, list };
        else out.warnings.push(`${mn}: ${list.length} keyframes (preview uses first and last)`), current.keys = { matchName: mn, list: [list[0], list[list.length - 1]] };
      }
      off = d + size + (size & 1);
    }
  }
  walk(12, b.length);
  return out;
}

/** Convert a parsed preset to a MOE preview/spec preset (first animator). */
function toPreset(parsed, meta = {}) {
  const a = parsed.animators[0];
  if (!a || !a.keys) return null;
  const [k0, k1] = a.keys.list;
  const duration = (k1.ticks - k0.ticks) / parsed.timescale;
  const kind = /out/i.test(a.name || meta.name || '') || a.advanced.shape === 3 ? 'out' : 'in';
  return {
    id: meta.id, name: meta.name || a.name, group: 'Imported', source: 'ffx', kind,
    basedOn: a.advanced.basedOn || 1, shape: a.advanced.shape || 1, easeHigh: a.advanced.easeHigh || 0, easeLow: a.advanced.easeLow || 0,
    smoothness: a.advanced.smoothness === undefined ? 100 : a.advanced.smoothness, randomize: a.advanced.randomize || 0,
    duration: Math.round(duration * 1000) / 1000,
    ease: { first: [k0.inInfl, k0.outInfl], last: [k1.inInfl, k1.outInfl] },
    props: a.props, animatorName: a.name, arabicSafe: (a.advanced.basedOn || 1) >= 3,
    previewOnly: a.keys.matchName !== 'ADBE Text Percent Offset' || k0.v !== -100 || k1.v !== 100
  };
}

module.exports = { parse, toPreset };
