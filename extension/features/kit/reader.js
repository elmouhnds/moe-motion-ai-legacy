'use strict';
/**
 * Layer Reader (v0.67, docs/features/SMART_LAYER.md): what MOE did to a layer, read from the names and tags it
 * writes (`MOE …` effects, `// MOE …` expressions — the same rules Trash uses), with one action per item:
 * an expression preset can be edited (its numbers are read back exactly by expressions/quick.parse) and any item
 * can be removed alone (rigs.remove with `only`). Pure description here; reading is one host call (rigs.find).
 */
const E = require('../expressions/quick');

const PROP_NAME = { 'ADBE Position': 'Position', 'ADBE Scale': 'Scale', 'ADBE Rotate Z': 'Rotation', 'ADBE Opacity': 'Opacity', 'ADBE Anchor Point': 'Anchor Point' };

/** One readable row per MOE expression / effect on a scanned layer (rigs.find → layers[i]). */
function describe(scan) {
  const rows = [];
  for (const x of scan.expressions || []) {
    const tag = (/^\/\/ (MOE[^\n:]*)(?::\s*([^\n]*))?/.exec(x.expression || '') || []);
    const parsed = E.parse(x.expression);
    const prop = PROP_NAME[(x.address.matchNames || []).slice(-1)[0]] || x.name;
    const label = parsed ? E.PRESETS[parsed.preset].label : (tag[2] || (tag[1] || 'MOE').replace(/^MOE\s*/, '') || 'MOE expression');
    const detail = parsed ? (parsed.live ? 'numbers on live sliders' : Object.entries(parsed.values).map(([k, v]) => `${k} ${v}`).join(' · ')) : (tag[1] || 'MOE');
    rows.push({ kind: 'expression', key: `x:${(x.address.matchNames || []).join('>')}`, label, on: prop, detail, off: x.enabled === false,
      edit: parsed && !parsed.live ? { preset: parsed.preset, values: parsed.values } : null,
      only: { expressions: [(x.address.matchNames || []).join('>')], effects: [] } });
  }
  for (const name of scan.effects || []) {
    rows.push({ kind: 'effect', key: `e:${name}`, label: name.replace(/^MOE\s*[•·:]?\s*/, '') || name, on: 'Effect', detail: '', edit: null, only: { expressions: [], effects: [name] } });
  }
  return rows;
}

const removeRig = {
  id: 'kit.removeRig', version: '1.0.0', category: 'tools', group: 'Layer', name: 'Remove One Rig',
  description: 'Remove one thing MOE added to a layer — one MOE expression or one MOE effect — and nothing else. Your own expressions and effects are never touched.',
  keywords: ['remove rig', 'layer reader', 'remove expression', 'remove effect'],
  icon: 'trash',
  params: {
    layerId: { type: 'integer', label: 'Layer id', default: 0 },
    only: { type: 'string', label: 'Item', default: '' }
  },
  requires: { comp: true },
  permissions: ['modify.expressions', 'modify.effects'], recovery: 'undo',
  ai: null,
  uses: { hostOps: ['rigs.remove'], network: false }, compatibility: { minAE: '25.0' },
  ui: { hidden: true, primaryLabel: 'Remove' },
  prepare(args, ctx) {
    let only = null;
    try { only = JSON.parse(args.only || 'null'); } catch (e) { only = null; }
    if (!only || !(only.expressions || []).concat(only.effects || []).length) return { ok: false, error: 'Pick an item in On this layer' };
    const layer = (ctx.layers || []).find((l) => l.id === args.layerId);
    if (!layer) return { ok: false, error: 'Select the layer again' };
    const what = (only.effects || []).concat((only.expressions || []).map((m) => `${m.split('>').slice(-1)[0].replace(/^ADBE /, '')} expression`));
    return { ok: true, only, layer, preview: { summary: `Remove ${what.join(', ')} from ${layer.name}`, items: [] } };
  },
  async execute({ ctx, prepared, host }) {
    return host.call('rigs.remove', { compId: ctx.comp.id, label: 'MOE: Remove Rig', layers: [prepared.layer.id], only: prepared.only });
  },
  verify({ result, prepared }) {
    const l = result.layers[0] || {};
    if (l.skipped) return { ok: false, checks: [{ ok: false, label: l.name, detail: 'locked — nothing removed' }] };
    const leftX = (l.left.expressions || []).map((x) => x.address.matchNames.join('>'));
    const ok = (prepared.only.expressions || []).every((m) => !leftX.includes(m)) && (prepared.only.effects || []).every((n) => !(l.left.effects || []).includes(n));
    return { ok, checks: [{ ok, label: l.name, detail: `${l.expressions || 0} expression(s), ${(l.effects || []).length} effect(s) removed` }] };
  },
  summarize(result) { const l = result.layers[0] || {}; return `Removed ${(l.effects || []).concat(l.expressions ? ['an expression'] : []).join(', ') || 'nothing'} from ${l.name}`; }
};

module.exports = { describe, removeRig, PROP_NAME };
