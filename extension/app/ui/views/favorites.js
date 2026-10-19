'use strict';
const { h } = require('../dom');
const { renderTool } = require('../toolBlock');

function render(app) {
  const ids = app.services.favorites.list();
  const tools = ids.map((id) => app.services.registry.get(id)).filter(Boolean);
  if (!tools.length) return h('div', { class: 'view' }, h('div', { class: 'empty' }, h('b', {}, 'No favorites yet'), h('br'), 'Hover a tool and click ☆ to pin it here.'));
  return h('div', { class: 'view' }, h('div', { class: 'section-h' }, 'Pinned'), tools.map((t, i) => renderTool(app, t, { openByDefault: i === 0 })));
}
module.exports = { render };
