'use strict';
/**
 * Quick Apply catalogue (v1.0, docs/features/QUICK_APPLY.md): what the pie's centre can search in After Effects itself.
 * Read once per panel session (three read-only host calls) and kept in memory; `refresh()` reads again.
 *   effects   app.effects (displayName, matchName, category)
 *   presets   .ffx files under After Effects' Presets and the user's User Presets folders
 *   commands  menu names below that THIS After Effects answers with an id (findMenuCommandId) — nothing invented:
 *             a name After Effects does not know is simply not offered.
 */

/* Everyday menu commands, by the exact English name in After Effects' menus (both "..." and "…" spellings are asked;
   only the one After Effects knows comes back). */
const MENU = [
  'Pre-compose...', 'Trim Comp to Work Area', 'Crop Comp to Region of Interest', 'Composition Settings...', 'Add to Render Queue',
  'Add to Adobe Media Encoder Queue...', 'Sequence Layers...', 'Split Layer', 'Lift Work Area', 'Extract Work Area', 'Freeze Frame',
  'Enable Time Remapping', 'Time-Reverse Layer', 'Time-Reverse Keyframes', 'Easy Ease', 'Easy Ease In', 'Easy Ease Out',
  'Toggle Hold Keyframe', 'Convert Expression to Keyframes', 'Convert Audio to Keyframes', 'Center Anchor Point in Layer Content',
  'Fit to Comp', 'Fit to Comp Width', 'Fit to Comp Height', 'Create Shapes from Vector Layer', 'Create Shapes from Text',
  'Create Masks from Text', 'Auto-trace...', 'Duplicate', 'Select All', 'Deselect All', 'Open Layer', 'Open Layer Source',
  'Reveal Layer Source in Project', 'Reveal in Project', 'Reduce Project', 'Remove Unused Footage', 'Consolidate All Footage',
  'Collect Files...', 'Track Camera', 'Track Motion', 'Stabilize Motion', 'Solid...', 'Null Object', 'Adjustment Layer',
  'Shape Layer', 'Camera...', 'Light...', 'Text', 'Increment and Save', 'Save', 'Scripts'
];
const ASKED = [...new Set(MENU.flatMap((n) => (/\.\.\.$/.test(n) ? [n, n.replace(/\.\.\.$/, '…')] : [n])))];

function createCatalog(host) {
  let data = null, loading = null;
  async function load() {
    const [fx, pr, cm] = await Promise.all([
      host.call('catalog.effects', {}).catch((e) => ({ effects: [], error: e.message })),
      host.call('catalog.presets', {}, { timeoutMs: 60000 }).catch((e) => ({ presets: [], roots: [], error: e.message })),
      host.call('catalog.commands', { names: ASKED }).catch((e) => ({ commands: [], error: e.message }))
    ]);
    data = {
      effects: (fx.effects || []).filter((e) => e.c && !/^_|obsolete/i.test(e.c)),
      presets: pr.presets || [], roots: pr.roots || [], truncated: !!pr.truncated,
      commands: (cm.commands || []).map((c) => c.name),
      errors: [fx.error, pr.error, cm.error].filter(Boolean),
      at: Date.now()
    };
    return data;
  }
  return {
    get data() { return data; },
    ready: () => !!data,
    /** The catalogue (read once; concurrent callers share the read). */
    async get() { if (data) return data; if (!loading) loading = load().finally(() => { loading = null; }); return loading; },
    async refresh() { data = null; return this.get(); }
  };
}

/** Pure: catalogue → search items { kind, id, name, desc, icon } (the pie centre ranks them with MOE's own items). */
function items(cat) {
  if (!cat) return [];
  const out = [];
  for (const e of cat.effects) out.push({ kind: 'ae-effect', id: `fx:${e.m}`, name: e.n, desc: `Effect · ${e.c}`, icon: 'wand', matchName: e.m });
  for (const p of cat.presets) out.push({ kind: 'ae-preset', id: `ffx:${p.p}`, name: p.n, desc: `Animation preset · ${p.c}`, icon: 'bolt', path: p.p });
  for (const c of cat.commands) out.push({ kind: 'ae-command', id: `cmd:${c}`, name: c.replace(/(\.\.\.|…)$/, ''), desc: 'After Effects menu command', icon: 'menu', command: c });
  return out;
}

module.exports = { createCatalog, items, MENU, ASKED };
