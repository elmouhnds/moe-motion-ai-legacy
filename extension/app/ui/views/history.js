'use strict';
const { h, icon, relTime } = require('../dom');

function render(app) {
  const items = app.services.executor.history(150);
  if (!items.length) return h('div', { class: 'view' }, h('div', { class: 'empty' }, h('b', {}, 'Nothing yet'), h('br'), 'Every change MOE makes is listed here, with one-click restore.'));
  return h('div', { class: 'view' },
    h('div', { class: 'section-h' }, 'Recent'),
    items.map((e) => {
      const cp = e.checkpointId ? app.services.executor.checkpoint(e.checkpointId) : null;
      return h('div', { class: 'list-row' },
        h('span', { class: `st-ico ${e.status}` }, e.status === 'success' ? '✓' : e.status === 'partial' ? '!' : '✕'),
        h('div', { class: 'main' },
          h('div', { class: 't1' }, e.summary || e.toolName),
          h('div', { class: 't2' }, `${e.toolName} · ${relTime(e.t)}${e.origin !== 'user' ? ` · via ${e.origin === 'agent' ? 'Copilot' : 'recipe'}` : ''}${e.error ? ` · ${e.error}` : ''}`)),
        cp && !cp.restored ? h('button', { class: 'btn ghost', title: 'Restore the state before this change', onclick: () => app.restore(cp.id) }, icon('undo', 'sm'), 'Restore') : null,
        cp && cp.restored ? h('span', { class: 'why' }, 'restored') : null);
    }));
}
module.exports = { render };
