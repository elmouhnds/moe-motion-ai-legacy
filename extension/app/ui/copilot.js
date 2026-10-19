'use strict';
/**
 * Guided Copilot — contextual, collapsed by default. Flow:
 * describe → plan (Claude) → local validation → preview → approve → run with
 * per-step verification → roll back or save as a reusable tool.
 */
const { h, icon } = require('./dom');

function argChips(args) {
  return h('div', { class: 'args' }, Object.entries(args || {}).map(([k, v]) => h('span', { class: 'arg' }, `${k}: ${typeof v === 'string' && v.length > 24 ? JSON.stringify(v.slice(0, 24) + '…') : JSON.stringify(v)}`)));
}

function stepView(step, prog) {
  const state = prog && prog.state;
  const mark = state === 'running' ? h('span', { class: 'spin' }) : state === 'success' ? '✓' : state && state !== 'running' ? '✕' : String(step.index + 1);
  return h('div', { class: `step ${step.errors.length ? 'bad' : ''}` },
    h('div', { class: 'step-h' }, h('span', { class: 'n' }, mark), h('span', { class: 'tn' }, step.toolName)),
    step.reason ? h('div', { class: 'reason' }, step.reason) : null,
    argChips(step.args),
    step.preview ? h('ul', { class: 'preview-list' }, h('li', {}, step.preview.summary)) : null,
    step.errors.length ? h('div', { class: 'errs' }, step.errors.join(' · ')) : null,
    prog && prog.result && prog.result.summary ? h('div', { class: 'reason' }, prog.result.summary) : null,
    prog && prog.result && !prog.result.ok && prog.result.errors ? h('div', { class: 'errs' }, prog.result.errors.join(' · ')) : null);
}

function render(app) {
  const s = app.state.get();
  const c = s.copilot;
  const setC = (patch) => app.state.set((st) => ({ copilot: Object.assign({}, st.copilot, patch) }));
  if (!c.open) {
    return h('div', { class: 'copilot' },
      h('div', { class: 'cp-bar', role: 'button', tabindex: '0', onclick: () => app.openCopilot(), onkeydown: (e) => { if (e.key === 'Enter') app.openCopilot(); } },
        h('span', { class: 'spark' }, icon('spark')),
        h('span', { class: 'spacer' }, 'Describe a change…'),
        h('span', { class: 'kbd' }, 'Ctrl+Space')));
  }
  const input = h('textarea', { 'data-fk': 'cp-input', placeholder: 'e.g. “make the selected keys feel snappy, then cascade the layers 3 frames apart”', 'aria-label': 'Describe a change' }, c.request || '');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setC({ request: input.value }); app.planCopilot(); }
    if (e.key === 'Escape') app.closeCopilot();
  });
  input.addEventListener('input', () => { app.state.get().copilot.request = input.value; });
  if (c.phase === 'idle' && !c.validated && !c.error) setTimeout(() => { if (document.activeElement !== input && !document.querySelector('.overlay')) input.focus(); }, 0);
  const v = c.validated;
  const progress = c.progress || {};

  return h('div', { class: 'copilot' },
    h('div', { class: 'cp-sheet' },
      h('div', { class: 'step-h', style: { marginBottom: '6px' } }, h('span', { class: 'spark', style: { color: 'var(--accent)' } }, icon('spark')), h('span', { class: 'tn' }, 'Copilot'), h('button', { class: 'icon-btn', title: 'Close (Esc)', onclick: () => app.closeCopilot() }, icon('x', 'sm'))),
      input,
      h('div', { class: 'actions' },
        h('button', { class: 'btn', disabled: c.phase === 'planning' || c.phase === 'running', onclick: () => { setC({ request: input.value }); app.planCopilot(); } }, c.phase === 'planning' ? h('span', { class: 'spin' }) : icon('spark', 'sm'), v ? 'Re-plan' : 'Plan'),
        h('span', { class: 'cost-hint' }, 'Nothing changes until you approve')),
      c.error ? h('div', { class: 'notice err', style: { margin: '8px 0 0' } }, c.error) : null,
      v ? h('div', {},
        h('div', { class: 'plan-sum' }, v.summary),
        v.clarification ? h('div', { class: 'notice', style: { margin: '6px 0' } }, v.clarification) : null,
        v.warnings.map((w) => h('div', { class: 'notice', style: { margin: '6px 0' } }, w)),
        v.steps.map((st) => stepView(st, progress[st.index])),
        c.phase === 'review' ? h('div', { class: 'actions' },
          h('button', { class: 'btn primary grow', disabled: !v.ok, onclick: () => app.approvePlan() }, icon('play', 'sm'), v.ok ? `Approve & run ${v.steps.length} step${v.steps.length > 1 ? 's' : ''}` : 'Plan has problems'),
          h('button', { class: 'btn ghost', onclick: () => setC({ validated: null, phase: 'idle' }) }, 'Cancel')) : null,
        c.phase === 'done' && c.run ? h('div', {},
          h('div', { class: `report ${c.run.ok ? 'success' : 'failed'}` }, h('div', { class: 'report-h' }, h('span', { class: 'st' }, icon(c.run.ok ? 'check' : 'x', 'sm')),
            h('span', { class: 'msg' }, c.run.ok ? `All ${c.run.total} step(s) done and verified` : `Stopped after ${c.run.done} of ${c.run.total} step(s)`))),
          h('div', { class: 'actions' },
            c.run.results.some((r) => r.result.checkpointId) ? h('button', { class: 'btn', onclick: () => app.rollbackPlan() }, icon('undo', 'sm'), 'Roll back') : null,
            c.run.ok ? h('button', { class: 'btn ghost', onclick: () => app.savePlanAsRecipe() }, icon('save', 'sm'), 'Save as tool') : null)) : null) : null));
}

module.exports = { render };
