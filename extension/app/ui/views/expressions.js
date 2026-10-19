'use strict';
/** Expression Engineer workspace: target, editor, engine validation, assistant, presets. */
const { h, icon } = require('../dom');
const { renderReport } = require('../report');
const { diffLines } = require('../diff');
const SNIPPETS = require('../../../features/expressions/snippets');

function target(ctx) {
  return ctx && (ctx.properties || []).find((p) => p.canSetExpression);
}

function render(app) {
  const s = app.state.get();
  const ex = s.expr;
  const t = target(s.ctx);
  const layer = t && (s.ctx.layers || []).find((l) => l.id === t.address.layerId);
  const capable = s.ctx ? (s.ctx.properties || []).filter((p) => p.canSetExpression).length : 0;
  const setEx = (patch) => app.state.set((st) => ({ expr: Object.assign({}, st.expr, patch) }));

  const editor = h('textarea', { class: 'code', 'data-fk': 'expr-editor', spellcheck: 'false', placeholder: '// Write or load an expression…', 'aria-label': 'Expression editor' }, ex.code);
  editor.addEventListener('input', (e) => { app.state.get().expr.code = e.target.value; });
  editor.addEventListener('change', (e) => setEx({ code: e.target.value }));
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: a, selectionEnd: b, value } = editor;
      editor.value = value.slice(0, a) + '  ' + value.slice(b);
      editor.selectionStart = editor.selectionEnd = a + 2;
      app.state.get().expr.code = editor.value;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); app.runTool('expressions.validate', { code: editor.value }, { resultKey: 'expr' }); }
  });

  const assist = ex.assist;
  const busy = s.running === 'expressions.assist';
  const proposal = assist && assist.result && assist.result.status === 'success' ? assist.result.result : null;

  return h('div', { class: 'view' },
    t ? h('div', { class: 'target' },
      icon('expr', 'sm'),
      h('span', {}, h('b', {}, t.name), ' · ', layer ? layer.name : `Layer ${t.address.layerIndex}`),
      h('span', { class: 'badge' }, t.valueType),
      capable > 1 ? h('span', { class: 'badge' }, `+${capable - 1}`) : null,
      h('span', { class: 'spacer' }),
      t.expressionError ? h('span', { class: 'badge err' }, 'error') : t.expression ? h('span', { class: 'badge ok' }, 'expression') : null,
      t.expression ? h('button', { class: 'btn ghost', title: 'Load the current expression into the editor', onclick: () => setEx({ code: t.expression }) }, 'Load') : null)
      : h('div', { class: 'notice' }, s.ctx && s.ctx.comp ? 'Select a property (e.g. press P, S, R or T on a layer) to target expressions.' : 'Open a composition and select a property.'),
    t && t.expressionError ? h('div', { class: 'pad' }, h('div', { class: 'engine-err' }, t.expressionError)) : null,

    h('div', { class: 'section-h' }, 'Editor'),
    h('div', { class: 'pad' }, editor,
      h('div', { class: 'actions' },
        h('button', { class: 'btn', disabled: !t || !!s.running, title: 'Test with the real After Effects engine, then restore (Ctrl+Enter)', onclick: () => app.runTool('expressions.validate', { code: app.state.get().expr.code }, { resultKey: 'expr' }) }, icon('check', 'sm'), 'Validate'),
        h('button', { class: 'btn primary', disabled: !t || !!s.running || !ex.code.trim(), onclick: () => app.runTool('expressions.apply', { code: app.state.get().expr.code }, { resultKey: 'expr' }) }, capable > 1 ? `Apply to ${capable}` : 'Apply'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn ghost', title: 'Save editor content as a preset', disabled: !ex.code.trim(), onclick: () => app.saveSnippet(app.state.get().expr.code) }, icon('save', 'sm')),
        h('button', { class: 'btn ghost danger', title: 'Remove expressions from the selected properties (restorable)', disabled: !t || !t.expression || !!s.running, onclick: () => app.runTool('expressions.remove', {}, { resultKey: 'expr' }) }, icon('trash', 'sm'))),
      renderReport(s.results.expr, { onRestore: () => app.restore(s.results.expr.checkpointId, 'expr'), onDismiss: () => app.clearResult('expr') })),

    h('div', { class: 'section-h' }, icon('spark', 'sm'), 'Assistant'),
    h('div', { class: 'pad' },
      h('div', { class: 'seg', style: { marginBottom: '6px' } }, ['generate', 'fix', 'explain', 'optimize'].map((m) => h('button', { 'aria-pressed': String(assist.mode === m), onclick: () => setEx({ assist: Object.assign({}, assist, { mode: m }) }) }, m[0].toUpperCase() + m.slice(1)))),
      assist.mode === 'generate' || assist.mode === 'fix'
        ? h('textarea', { 'data-fk': 'assist-req', placeholder: assist.mode === 'generate' ? 'e.g. bounce scale when the layer enters, settle in 0.5s' : 'Optional: what is wrong?', oninput: (e) => { app.state.get().expr.assist.request = e.target.value; } }, assist.request || '')
        : null,
      h('div', { class: 'actions' },
        h('button', { class: 'btn', disabled: !t || !!s.running, onclick: () => app.askExpression() }, busy ? h('span', { class: 'spin' }) : icon('spark', 'sm'), 'Ask Claude'),
        h('span', { class: 'cost-hint' }, assist.mode === 'generate' ? 'Uses the selected property as context' : 'Works on the selected property\'s expression')),
      assist.result && assist.result.status !== 'success' ? renderReport(assist.result, { onDismiss: () => setEx({ assist: Object.assign({}, assist, { result: null }) }) }) : null,
      proposal ? h('div', {},
        proposal.explanation ? h('div', { class: 'explain' }, proposal.explanation) : null,
        proposal.notes && proposal.notes.length ? h('ul', { class: 'notes' }, proposal.notes.map((n) => h('li', {}, n))) : null,
        proposal.controls && proposal.controls.length ? h('div', { class: 'why', style: { marginTop: '4px' } }, `Needs controls: ${proposal.controls.map((c) => `${c.type} “${c.name}”`).join(', ')}`) : null,
        proposal.code && proposal.code !== proposal.original ? h('div', { class: 'diff' }, diffLines(proposal.original, proposal.code).map((l) => h('div', { class: `ln ${l.op}` }, h('span', { class: 'g' }, l.op === 'add' ? '+' : l.op === 'del' ? '−' : ''), l.t || ' '))) : null,
        proposal.code && proposal.code !== proposal.original ? h('div', { class: 'actions' },
          h('button', { class: 'btn', onclick: () => setEx({ code: proposal.code }) }, 'Use in editor'),
          h('button', { class: 'btn', disabled: !!s.running, onclick: () => { setEx({ code: proposal.code }); app.runTool('expressions.validate', { code: proposal.code }, { resultKey: 'expr' }); } }, icon('check', 'sm'), 'Validate')) : null) : null),

    h('div', { class: 'section-h' }, 'Presets'),
    h('div', { class: 'snips' },
      [...SNIPPETS, ...app.services.store.get('snippets', [])].map((sn) => h('button', { class: 'chip-btn', title: sn.user ? 'Your preset — right-click to delete' : sn.code.split('\n')[0],
        onclick: () => setEx({ code: sn.code }),
        oncontextmenu: sn.user ? (e) => { e.preventDefault(); app.services.store.update('snippets', [], (all) => all.filter((x) => x.id !== sn.id)); app.render(); } : undefined }, sn.label))));
}

module.exports = { render };
