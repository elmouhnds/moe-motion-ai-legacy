'use strict';
const { h, icon } = require('../dom');
const theme = require('../theme');
const { PRICES } = require('../../../core/ai/cost');
const { SCOPES } = require('../../../core/permissions');

const SCOPE_LABEL = {
  read: 'Read project', 'modify.keyframes': 'Change keyframes', 'modify.layers': 'Change layers',
  'modify.expressions': 'Change expressions', 'modify.effects': 'Change effects', 'network.ai': 'Send context to Claude'
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

  const updUi = (patch) => { app.services.settings.update({ ui: patch }); app.applyAppearance(); app.render(); };
  const hiddenBanners = app.services.store.get('banners-hidden', []);
  const presets = app.services.presets.list();

  return h('div', { class: 'view' },
    h('div', { class: 'section-h' }, 'Appearance'),
    h('div', { class: 'set-group' },
      h('div', { class: 'field' }, h('label', {}, 'Theme'), seg(theme.THEMES, st.ui.theme || 'auto', (v) => updUi({ theme: v }))),
      h('div', { class: 'field' }, h('label', {}, 'Accent'), h('div', { class: 'accent-row', role: 'radiogroup', 'aria-label': 'Accent colour' },
        theme.ACCENTS.map(([id, label, hex]) => h('button', { class: `accent-sw ${(st.ui.accent || 'tomato') === id ? 'on' : ''}`, role: 'radio', 'aria-checked': String((st.ui.accent || 'tomato') === id), title: label, 'aria-label': label, style: { background: hex }, onclick: () => updUi({ accent: id }) })))),
      h('div', { class: 'field' }, h('label', {}, 'Motion'), seg([['full', 'Full'], ['reduced', 'Reduced']], st.ui.motion || 'full', (v) => updUi({ motion: v }))),
      h('div', { class: 'field' }, h('label', {}, 'Headings'), seg([['display', 'Sora'], ['system', 'System']], st.ui.headings || 'display', (v) => updUi({ headings: v }))),
      h('div', { class: 'field' }, h('label', {}, 'Section banners'), h('button', { class: 'toggle', role: 'switch', 'aria-checked': String(st.ui.banners !== false), onclick: () => updUi({ banners: st.ui.banners === false }) }),
        hiddenBanners.length ? h('button', { class: 'btn ghost', onclick: () => { app.services.store.set('banners-hidden', []); app.render(); } }, `Show ${hiddenBanners.length} hidden`) : null),
      h('div', { class: 'field' }, h('label', {}, 'Splash on start'), h('button', { class: 'toggle', role: 'switch', 'aria-checked': String(st.ui.splash !== false), onclick: () => updUi({ splash: st.ui.splash === false }) }))),

    h('div', { class: 'section-h' }, 'My Presets'),
    h('div', { class: 'set-group' },
      h('div', { class: 'why' }, `${presets.length} preset${presets.length === 1 ? '' : 's'} saved. Packs are plain JSON (format "moe-presets") — share them with your team.`),
      h('div', { class: 'actions', style: { marginTop: '6px' } },
        h('button', { class: 'btn', disabled: !presets.length, onclick: () => app.exportPresets() }, icon('download', 'sm'), 'Export pack'),
        h('button', { class: 'btn', onclick: () => app.importPresets() }, icon('import', 'sm'), 'Import pack'))),

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
    h('dl', { class: 'kv' }, h('dt', {}, 'Folder'), h('dd', {}, app.services.store.dataDir)),
    h('div', { class: 'actions pad' }, h('button', { class: 'btn', onclick: () => app.go('diagnostics') }, 'Diagnostics'),
      h('button', { class: 'btn ghost', onclick: () => app.state.set({ modal: 'about' }) }, icon('info', 'sm'), 'About'),
      h('button', { class: 'btn ghost', onclick: () => app.state.set({ modal: 'whatsnew' }) }, icon('gift', 'sm'), "What's new")));
}
module.exports = { render };
