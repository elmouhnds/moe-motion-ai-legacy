'use strict';
const { h } = require('../dom');
const { PRICES } = require('../../../core/ai/cost');
const { SCOPES } = require('../../../core/permissions');

const SCOPE_LABEL = {
  read: 'Read project', 'modify.keyframes': 'Change keyframes', 'modify.layers': 'Change layers',
  'modify.expressions': 'Change expressions', 'network.ai': 'Send context to Claude'
};

function seg(options, value, onPick) {
  return h('div', { class: 'seg' }, options.map(([v, l]) => h('button', { 'aria-pressed': String(v === value), onclick: () => onPick(v) }, l)));
}

function render(app) {
  const st = app.services.settings.get();
  const s = app.state.get();
  const key = s.keyStatus || {};
  const upd = (patch) => { app.services.settings.update(patch); app.render(); };
  const keyInput = h('input', { class: 'txt', type: 'password', placeholder: key.stored ? '•••••••• saved' : 'sk-ant-…', autocomplete: 'off', spellcheck: 'false' });

  return h('div', { class: 'view' },
    h('div', { class: 'section-h' }, 'Claude API'),
    h('div', { class: 'set-group' },
      h('div', { class: 'field' }, h('label', {}, 'AI features'), h('button', { class: 'toggle', role: 'switch', 'aria-checked': String(st.ai.enabled), onclick: () => upd({ ai: { enabled: !st.ai.enabled } }) })),
      h('div', { class: 'field' }, h('label', {}, 'API key'), keyInput),
      h('div', { class: 'field' }, h('label', {}, ''), h('div', { class: 'actions', style: { marginTop: 0 } },
        h('button', { class: 'btn', onclick: () => app.saveKey(keyInput.value) }, 'Save key'),
        key.stored ? h('button', { class: 'btn ghost danger', onclick: () => app.clearKey() }, 'Remove') : null,
        h('span', { class: 'why' }, key.stored ? (key.protection === 'dpapi' ? 'Encrypted with Windows DPAPI' : `Stored (${key.protection}) — not encrypted`) : 'Not set'))),
      h('div', { class: 'field' }, h('label', {}, 'Model'), h('select', { onchange: (e) => upd({ ai: { model: e.target.value } }) },
        Object.entries(PRICES).map(([id, p]) => h('option', { value: id, selected: id === st.ai.model }, `${p.label} · $${p.input}/$${p.output} per MTok`)))),
      h('div', { class: 'field' }, h('label', {}, 'Effort'), seg([['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], st.ai.effort, (v) => upd({ ai: { effort: v } }))),
      h('div', { class: 'field' }, h('label', {}, 'Monthly budget'), h('div', { class: 'slider-row' },
        h('input', { class: 'num', type: 'number', min: 0, step: 1, value: st.ai.monthlyBudgetUSD, onchange: (e) => upd({ ai: { monthlyBudgetUSD: Math.max(0, Number(e.target.value) || 0) } }) }),
        h('span', { class: 'why' }, `USD · 0 = no limit · used this month $${app.services.cost.month().usd.toFixed(3)}`)))),

    h('div', { class: 'section-h' }, 'Permissions'),
    h('div', { class: 'set-group' },
      SCOPES.filter((x) => x !== 'read').map((scope) => h('div', { class: 'field' }, h('label', { title: scope }, SCOPE_LABEL[scope]),
        seg([['allow', 'Allow'], ['confirm', 'Ask'], ['deny', 'Off']], st.permissions[scope], (v) => upd({ permissions: { [scope]: v } })))),
      h('div', { class: 'why' }, 'Copilot changes always ask for approval, whatever is set here.')),

    h('div', { class: 'section-h' }, 'Performance'),
    h('div', { class: 'set-group' },
      h('div', { class: 'field' }, h('label', {}, 'Max layers read'), h('input', { class: 'num', type: 'number', min: 10, max: 2000, value: st.limits.maxLayers, onchange: (e) => upd({ limits: { maxLayers: Math.min(2000, Math.max(10, Number(e.target.value) || 200)) } }) })),
      h('div', { class: 'field' }, h('label', {}, 'Layout'), seg([['auto', 'Auto'], ['compact', 'Compact'], ['expanded', 'Expanded']], st.ui.density, (v) => { upd({ ui: { density: v } }); app.applyDensity(); }))),

    h('div', { class: 'section-h' }, 'Data'),
    h('dl', { class: 'kv' }, h('dt', {}, 'Folder'), h('dd', {}, app.services.store.dataDir)));
}
module.exports = { render };
