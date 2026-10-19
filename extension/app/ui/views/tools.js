'use strict';
/** Tools workspace: Tool Factory (describe → recipe) and saved recipes. */
const { h, icon, relTime } = require('../dom');
const { renderForm } = require('../form');
const { defaults } = require('../../../core/schema');

function stepLine(app, s) {
  const tool = app.services.registry.get(s.tool);
  return h('div', { class: 'step' },
    h('div', { class: 'step-h' }, h('span', { class: 'tn' }, tool ? tool.name : s.tool)),
    h('div', { class: 'args' }, Object.entries(s.args || {}).map(([k, v]) => h('span', { class: 'arg' }, `${k}: ${v && v.$param ? '⟨' + v.$param + '⟩' : JSON.stringify(v)}`))),
    s.note ? h('div', { class: 'reason' }, s.note) : null);
}

function render(app) {
  const s = app.state.get();
  const f = s.factory;
  const recipes = app.services.recipes.list();
  const setF = (patch) => app.state.set((st) => ({ factory: Object.assign({}, st.factory, patch) }));

  return h('div', { class: 'view' },
    h('div', { class: 'section-h' }, icon('spark', 'sm'), 'Tool Factory'),
    h('div', { class: 'pad' },
      h('textarea', { 'data-fk': 'factory-desc', placeholder: 'Describe a utility, e.g. “soft cascade: stagger selected layers by N frames and give them a smooth ease”', oninput: (e) => { app.state.get().factory.description = e.target.value; } }, f.description || ''),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', disabled: f.busy, onclick: () => app.draftRecipe() }, f.busy ? h('span', { class: 'spin' }) : icon('spark', 'sm'), 'Design tool'),
        h('span', { class: 'cost-hint' }, 'Built only from existing tools — no scripts are generated')),
      f.error ? h('div', { class: 'notice err', style: { margin: '8px 0 0' } }, f.error) : null,
      f.draft ? h('div', { style: { marginTop: '10px' } },
        h('div', { class: 'field' }, h('label', {}, 'Name'), h('input', { class: 'txt', value: f.draft.recipe.name, onchange: (e) => { f.draft.recipe.name = e.target.value; } })),
        h('div', { class: 'plan-sum' }, f.draft.recipe.description),
        Object.keys(f.draft.recipe.params || {}).length ? h('div', { class: 'why' }, `Parameters: ${Object.values(f.draft.recipe.params).map((p) => p.label).join(', ')}`) : null,
        f.draft.recipe.steps.map((st) => stepLine(app, st)),
        f.draft.limitations ? h('div', { class: 'notice' }, f.draft.limitations) : null,
        f.draft.errors.length ? h('div', { class: 'step bad' }, h('div', { class: 'errs' }, f.draft.errors.join(' · '))) : null,
        h('div', { class: 'actions' },
          h('button', { class: 'btn primary', disabled: f.draft.errors.length > 0 || !f.draft.recipe.steps.length, onclick: () => app.saveDraft() }, icon('save', 'sm'), 'Approve & save'),
          h('button', { class: 'btn ghost', onclick: () => setF({ draft: null }) }, 'Discard'))) : null),

    h('div', { class: 'section-h' }, 'Saved tools'),
    recipes.length === 0 ? h('div', { class: 'empty' }, 'No saved tools yet.', h('br'), 'Design one above, or save an approved Copilot plan.') : null,
    recipes.map((r) => {
      const open = s.open[r.id];
      const vals = s.args[r.id] || defaults(r.params || {});
      const res = s.results[r.id];
      return h('div', { class: `tool ${open ? 'open' : ''}` },
        h('div', { class: 'tool-h', role: 'button', tabindex: '0', onclick: () => app.toggleTool(r.id, !open) },
          icon('tools'), h('span', { class: 'name' }, r.name),
          h('span', { class: 'hint' }, `${r.steps.length} step${r.steps.length > 1 ? 's' : ''} · ${r.source === 'copilot' ? 'from Copilot' : relTime(r.createdAt)}`),
          h('span', { class: 'chev' }, icon('chev', 'sm'))),
        open ? h('div', { class: 'tool-b' },
          r.description ? h('div', { class: 'why', style: { marginBottom: '8px' } }, r.description) : null,
          renderForm(r.params || {}, vals, (next) => app.state.set((st) => ({ args: Object.assign({}, st.args, { [r.id]: next }) }))),
          r.steps.map((st) => stepLine(app, st)),
          h('div', { class: 'actions' },
            h('button', { class: 'btn primary', disabled: !!s.running, onclick: () => app.runRecipe(r, vals) }, s.running === r.id ? h('span', { class: 'spin' }) : icon('play', 'sm'), 'Run'),
            h('button', { class: 'btn ghost', title: 'Check against the current selection without changing anything', onclick: () => app.preflightRecipe(r, vals) }, 'Dry run'),
            h('span', { class: 'spacer' }),
            h('button', { class: 'btn ghost danger', title: 'Delete this saved tool', onclick: () => { app.services.recipes.remove(r.id); app.render(); } }, icon('trash', 'sm'))),
          res ? h('div', { class: `report ${res.ok ? 'success' : 'failed'}` }, h('div', { class: 'report-h' }, h('span', { class: 'st' }, icon(res.ok ? 'check' : 'x', 'sm')), h('span', { class: 'msg' }, res.message))) : null) : null);
    }));
}

module.exports = { render };
