'use strict';
/** Selection tools for Copilot / recipes (the Select view drives the same service directly). */
const M = require('./matcher');

const SCOPE = { type: 'enum', label: 'Scope', default: 'active', options: [{ value: 'active', label: 'Active comp' }, { value: 'selectedComps', label: 'Selected comps' }, { value: 'project', label: 'Project' }] };
const MODE = { type: 'enum', label: 'Mode', default: 'replace', options: [{ value: 'replace', label: 'Replace' }, { value: 'add', label: 'Add' }, { value: 'remove', label: 'Remove' }] };
const FILTERS = {
  enabledOnly: { type: 'boolean', label: 'Enabled only', default: false, advanced: true },
  unlockedOnly: { type: 'boolean', label: 'Unlocked only', default: false, advanced: true }
};

const CRIT = { type: 'type', source: 'source', label: 'label', name: 'name', effects: 'effects' };
/** footage = images + videos; cameraLight = cameras + lights */
const typesOf = (t) => (t === 'footage' ? ['image', 'video'] : t === 'cameraLight' ? ['camera', 'light'] : [t]);
function describe(a) {
  if (a.by === 'type') { const f = { footage: 'Footage', cameraLight: 'Cameras & Lights' }[a.type]; return f || (M.TYPES.find((t) => t[0] === a.type) || [, a.type])[1]; }
  if (a.by === 'label') return `label ${a.label}`;
  if (a.by === 'search') return `“${a.query}”`;
  if (a.by === 'same') return `same ${CRIT[a.criterion] || a.criterion}`;
  return { all: 'all', invert: 'invert', none: 'none' }[a.by] || a.by;
}

const selectLayers = {
  id: 'select.layers',
  version: '1.0.0',
  category: 'select',
  group: 'Select',
  name: 'Select Layers',
  description: 'Select layers by type, label, search text or like the selected layer — or all / invert / none — in the active comp, selected comps or the whole project.',
  keywords: ['select', 'selection', 'find', 'type', 'label', 'search'],
  icon: 'cursor',
  params: Object.assign({
    // v0.44 (docs/features/FIND_FAST.md): also all / invert / none, and "same as the selected layer"
    by: { type: 'enum', label: 'By', default: 'type', options: [{ value: 'type', label: 'Type' }, { value: 'label', label: 'Label' }, { value: 'search', label: 'Search' }, { value: 'same', label: 'Same as selected' }, { value: 'all', label: 'All' }, { value: 'invert', label: 'Invert' }, { value: 'none', label: 'None' }] },
    type: { type: 'enum', label: 'Type', default: 'text', options: M.TYPES.map(([value, label]) => ({ value, label })).concat([{ value: 'footage', label: 'Footage (images + videos)' }, { value: 'cameraLight', label: 'Cameras & Lights' }]) },
    criterion: { type: 'enum', label: 'Same', default: 'type', options: [{ value: 'type', label: 'Type' }, { value: 'source', label: 'Source' }, { value: 'label', label: 'Label' }, { value: 'name', label: 'Name' }, { value: 'effects', label: 'Effects' }], showIf: (a) => a.by === 'same' },
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
  prepare(args, ctx) {
    if (args.by === 'same' && !((ctx && ctx.layers) || []).length) return { ok: false, error: 'Select one layer first — it is the reference' };
    return { ok: true, preview: { summary: `Select ${describe(args)} (${args.mode}, ${args.scope})`, items: [] } };
  },
  async execute({ args, ctx, services }) {
    const sel = services.selector;
    const types = typesOf(args.type);
    const snap = await sel.load(args.scope, args.by === 'type' && types.includes('expressions'));
    const filters = { enabledOnly: args.enabledOnly, unlockedOnly: args.unlockedOnly };
    const pass = (L) => (!filters.enabledOnly || L.enabled) && (!filters.unlockedOnly || !L.locked);
    let plan, matched;
    if (args.by === 'invert') { plan = M.invert(snap.layers, filters); matched = null; }
    else {
      if (args.by === 'same') {
        const refId = ((ctx && ctx.layers) || [])[0] && ctx.layers[0].id;
        const ref = snap.layers.find((L) => L.id === refId);
        if (!ref) throw Object.assign(new Error('Select one layer first — it is the reference'), { code: 'NO_REFERENCE' });
        matched = M.same(snap.layers, ref, args.criterion, filters);
        if (matched && matched.error) throw Object.assign(new Error(matched.error), { code: 'NO_SOURCE' });
      } else matched = args.by === 'type' ? M.byType(snap.layers, types, filters, sel.compTimes())
        : args.by === 'label' ? M.byLabel(snap.layers, args.label, filters)
          : args.by === 'search' ? M.bySearch(snap.layers, args.query, filters)
            : args.by === 'all' ? snap.layers.filter(pass) : [];
      plan = M.plan(snap.layers, matched, args.by === 'all' || args.by === 'none' ? 'replace' : args.mode);
    }
    const r = await sel.apply(plan, `Select ${describe(args)}`, args.scope);
    return { matched: matched ? matched.length : null, total: r.total, what: describe(args) };
  },
  summarize(result) { return `${result.what}: ${result.matched === null ? '' : `${result.matched} matched · `}${result.total} selected`; }
};

/** v0.44: one step back / forward in the selection history (After Effects does not undo selections). */
const selectStep = {
  id: 'select.step',
  version: '1.0.0',
  category: 'select',
  group: 'Select',
  name: 'Previous / Next Selection',
  description: 'Go back to the selection you had before the last Select (or forward again) — After Effects has no undo for selections.',
  keywords: ['select', 'selection', 'back', 'previous', 'forward', 'history', 'undo selection'],
  icon: 'undo',
  params: { dir: { type: 'enum', label: 'Direction', default: 'back', options: [{ value: 'back', label: 'Back' }, { value: 'forward', label: 'Forward' }] } },
  requires: {},
  permissions: ['read'],
  recovery: 'none',
  ai: { callable: false },
  uses: { hostOps: ['layers.setSelection'], network: false },
  compatibility: { minAE: '25.0' },
  prepare(args, ctx, services) {
    const sel = services && services.selector;
    if (sel && !(args.dir === 'forward' ? sel.canForward : sel.canBack)) return { ok: false, error: args.dir === 'forward' ? 'Nothing later in the selection history' : 'No earlier selection yet — use a Select button first' };
    return { ok: true, preview: { summary: args.dir === 'forward' ? 'Next selection' : 'Previous selection', items: [] } };
  },
  async execute({ args, services }) {
    const r = await (args.dir === 'forward' ? services.selector.forward() : services.selector.back());
    if (!r.ok) throw Object.assign(new Error(args.dir === 'forward' ? 'Nothing later in the selection history' : 'No earlier selection'), { code: 'NO_HISTORY' });
    return { label: r.label };
  },
  summarize(result) { return `Selection: ${result.label}`; }
};

module.exports = { selectLayers, selectStep, typesOf, describe };
