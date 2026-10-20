'use strict';
const { h } = require('../dom');
const { renderTool } = require('../toolBlock');

function groupTools(tools) {
  const groups = new Map();
  for (const t of tools) {
    if (!groups.has(t.group)) groups.set(t.group, []);
    groups.get(t.group).push(t);
  }
  return groups;
}

/** Generic workspace: tools of one category, grouped by purpose. */
function renderCategory(app, category, keep) {
  // Tools flagged ui.hidden are driven from another tool's UI (still in search / Copilot).
  const tools = app.services.registry.list({ category }).filter((t) => !(t.ui && t.ui.hidden) && (!keep || keep(t)));
  const groups = groupTools(tools);
  let first = true;
  return h('div', { class: 'view' }, [...groups.entries()].map(([g, list]) => [
    h('div', { class: 'section-h' }, g),
    list.map((t) => { const el = renderTool(app, t, { openByDefault: first }); first = false; return el; })
  ]));
}

module.exports = { render: (app) => renderCategory(app, 'motion'), renderCategory };
