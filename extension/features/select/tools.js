'use strict';
/** Selection tools for Copilot / recipes (the Select view drives the same service directly). */
const M = require('./matcher');

const SCOPE = { type: 'enum', label: 'Scope', default: 'active', options: [{ value: 'active', label: 'Active comp' }, { value: 'selectedComps', label: 'Selected comps' }, { value: 'project', label: 'Project' }] };
const MODE = { type: 'enum', label: 'Mode', default: 'replace', options: [{ value: 'replace', label: 'Replace' }, { value: 'add', label: 'Add' }, { value: 'remove', label: 'Remove' }] };
const FILTERS = {
  enabledOnly: { type: 'boolean', label: 'Enabled only', default: false, advanced: true },
  unlockedOnly: { type: 'boolean', label: 'Unlocked only', default: false, advanced: true }
};

const selectLayers = {
  id: 'select.layers',
  version: '1.0.0',
  category: 'select',
  group: 'Select',
  name: 'Select Layers',
  description: 'Select layers by type, label or search text in the active comp, selected comps or the whole project.',
  keywords: ['select', 'selection', 'find', 'type', 'label', 'search'],
  icon: 'cursor',
  params: Object.assign({
    by: { type: 'enum', label: 'By', default: 'type', options: [{ value: 'type', label: 'Type' }, { value: 'label', label: 'Label' }, { value: 'search', label: 'Search' }] },
    type: { type: 'enum', label: 'Type', default: 'text', options: M.TYPES.map(([value, label]) => ({ value, label })) },
    label: { type: 'integer', label: 'Label #', min: 0, max: 16, default: 1 },
    query: { type: 'string', label: 'Search', default: '', description: 'Name, source, comment or file extension' },
    scope: SCOPE, mode: MODE
  }, FILTERS),
  requires: {},
  permissions: ['read'],
  recovery: 'none',
  ai: { callable: true, hint: 'Select layers (by=type/label/search) before other steps, e.g. select all text layers then animate them.' },
  uses: { hostOps: ['layers.list', 'layers.setSelection'], network: false },
  compatibility: { minAE: '25.0' },
  prepare(args) { return { ok: true, preview: { summary: `Select ${args.by === 'type' ? M.TYPES.find((t) => t[0] === args.type)[1] : args.by === 'label' ? `label ${args.label}` : `“${args.query}”`} (${args.mode}, ${args.scope})`, items: [] } }; },
  async execute({ args, services }) {
    const sel = services.selector;
    const snap = await sel.load(args.scope, args.by === 'type' && args.type === 'expressions');
    const filters = { enabledOnly: args.enabledOnly, unlockedOnly: args.unlockedOnly };
    const matched = args.by === 'type' ? M.byType(snap.layers, [args.type], filters, sel.compTimes())
      : args.by === 'label' ? M.byLabel(snap.layers, args.label, filters) : M.bySearch(snap.layers, args.query, filters);
    const r = await sel.apply(M.plan(snap.layers, matched, args.mode), `Select ${args.by}`, args.scope);
    return { matched: matched.length, total: r.total };
  },
  summarize(result) { return `${result.matched} matched · ${result.total} selected`; }
};

module.exports = { selectLayers };
