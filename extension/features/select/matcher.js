'use strict';
/**
 * Moe Selector engine (ported from the owner's Moe_Selector_v5). Pure functions over
 * the lightweight layer list returned by host op `layers.list`.
 */

const TYPES = [
  ['text', 'Text'], ['shape', 'Shapes'], ['image', 'Images'], ['video', 'Videos'], ['audio', 'Audio Only'],
  ['solid', 'Solids'], ['null', 'Nulls'], ['precomp', 'Pre-Comps'], ['camera', 'Cameras'], ['light', 'Lights'],
  ['adjustment', 'Adjustment'], ['threeD', '3D Layers'], ['guide', 'Guide Layers'], ['shy', 'Shy Layers'],
  ['effects', 'With Effects'], ['expressions', 'Expressions'], ['motionBlur', 'Motion Blur'], ['activeNow', 'Active Now']
];

const DEFAULT_LABELS = ['None', 'Red', 'Yellow', 'Aqua', 'Pink', 'Lavender', 'Peach', 'Sea Foam', 'Blue', 'Green', 'Purple', 'Orange', 'Brown', 'Fuchsia', 'Cyan', 'Sandstone', 'Dark Green'];
const DEFAULT_LABEL_COLORS = ['#3A3A3A', '#B53838', '#E4D84C', '#A9CBC7', '#E5BCC9', '#A9A9CA', '#E7C19E', '#B3C7B3', '#677DE0', '#4AA44C', '#8E2C9A', '#E8920D', '#7F452A', '#F46DD6', '#3DA2A5', '#A89677', '#1E401E'];

function matchesType(L, type, compTime) {
  switch (type) {
    case 'text': case 'shape': case 'null': case 'camera': case 'light': case 'adjustment': return L.type === type;
    case 'solid': return L.footage === 'solid';
    case 'precomp': return L.footage === 'precomp';
    case 'image': return L.footage === 'image';
    case 'video': return L.footage === 'video';
    case 'audio': return L.hasAudio && !L.hasVideo;
    case 'threeD': return L.threeD;
    case 'guide': return L.guide;
    case 'shy': return L.shy;
    case 'effects': return L.effects.length > 0;
    case 'expressions': return !!L.expressions;
    case 'motionBlur': return L.motionBlur;
    case 'activeNow': return compTime !== undefined && L.inPoint <= compTime && compTime < L.outPoint;
    default: return false;
  }
}

function passes(L, filters) {
  if (filters.enabledOnly && !L.enabled) return false;
  if (filters.unlockedOnly && L.locked) return false;
  return true;
}

const lower = (s) => String(s || '').toLowerCase();
function searchable(L) { return [L.name, L.sourceName, L.comment, L.ext].map(lower).join(' '); }

function byType(layers, types, filters = {}, compTimes = {}) {
  return layers.filter((L) => passes(L, filters) && types.some((t) => matchesType(L, t, compTimes[L.compId])));
}
function bySearch(layers, term, filters = {}) {
  const terms = lower(term).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return layers.filter((L) => passes(L, filters) && terms.every((t) => searchable(L).includes(t)));
}
function byLabel(layers, label, filters = {}) { return layers.filter((L) => passes(L, filters) && L.label === label); }

function typeKey(L) { return L.footage || L.type; }
function effectSignature(L) { return L.effects.slice().sort().join('|'); }

function same(layers, reference, criterion, filters = {}) {
  const test = {
    type: (L) => typeKey(L) === typeKey(reference),
    source: (L) => reference.sourceId !== null && L.sourceId === reference.sourceId,
    label: (L) => L.label === reference.label,
    name: (L) => lower(L.name) === lower(reference.name),
    effects: (L) => reference.effects.length > 0 && effectSignature(L) === effectSignature(reference)
  }[criterion];
  if (!test) throw new Error(`Unknown criterion "${criterion}"`);
  if (criterion === 'source' && reference.sourceId === null) return { error: 'The reference layer has no source.' };
  return layers.filter((L) => passes(L, filters) && test(L));
}

function counts(layers, filters = {}, compTimes = {}) {
  const out = {};
  for (const [t] of TYPES) out[t] = byType(layers, [t], filters, compTimes).length;
  return out;
}

/** Merge a match list into a selection plan per comp. mode: replace | add | remove. */
function plan(layers, matched, mode) {
  const byComp = new Map();
  for (const L of layers) if (!byComp.has(L.compId)) byComp.set(L.compId, []);
  for (const L of matched) byComp.get(L.compId).push(L.id);
  return [...byComp.entries()].map(([compId, ids]) => ({ compId, layerIds: ids, mode }));
}

function invert(layers, filters = {}) {
  const sel = layers.filter((L) => passes(L, filters) && !L.selected);
  return plan(layers, sel, 'replace');
}

module.exports = { TYPES, DEFAULT_LABELS, DEFAULT_LABEL_COLORS, matchesType, byType, bySearch, byLabel, same, counts, plan, invert };
