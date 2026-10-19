'use strict';
/** Renders a tool's param schema as compact controls. */
const { h, icon } = require('./dom');

function control(key, p, value, set, ctx) {
  if (p.type === 'layer') {
    const layers = (ctx && ctx.compLayers) || [];
    return h('select', { onchange: (e) => set(e.target.value ? Number(e.target.value) : undefined), 'aria-label': p.label },
      h('option', { value: '', selected: !value }, layers.length ? 'Choose layer…' : 'No layers in comp'),
      layers.map((l) => h('option', { value: l.index, selected: l.index === value }, `${l.index}  ${l.name}`)));
  }
  if (p.type === 'boolean') {
    return h('button', { class: 'toggle', role: 'switch', 'aria-checked': String(!!value), 'aria-label': p.label, onclick: () => set(!value) });
  }
  if (p.type === 'enum') {
    if (p.options.length <= 4) {
      return h('div', { class: 'seg', role: 'group', 'aria-label': p.label },
        p.options.map((o) => h('button', { 'aria-pressed': String(o.value === value), title: o.label || o.value, onclick: () => set(o.value) }, o.label || o.value)));
    }
    return h('select', { onchange: (e) => set(e.target.value), 'aria-label': p.label },
      p.options.map((o) => h('option', { value: o.value, selected: o.value === value }, o.label || o.value)));
  }
  if (p.type === 'number' || p.type === 'integer') {
    const step = p.step || (p.type === 'integer' ? 1 : 0.1);
    const num = h('input', {
      class: 'num', type: 'number', value: value, step, min: p.min, max: p.max, 'aria-label': p.label,
      onchange: (e) => { const n = Number(e.target.value); if (Number.isFinite(n)) set(p.type === 'integer' ? Math.round(n) : n); }
    });
    const ranged = p.min !== undefined && p.max !== undefined && p.max - p.min <= 400;
    if (!ranged) return h('div', { class: 'slider-row' }, num, p.unit ? h('span', { class: 'unit' }, p.unit) : null);
    const pct = ((value - p.min) / (p.max - p.min)) * 100;
    const range = h('input', { type: 'range', min: p.min, max: p.max, step, value, style: { '--pct': `${pct}%` }, 'aria-label': p.label });
    range.addEventListener('input', (e) => {
      const n = Number(e.target.value);
      num.value = n;
      range.style.setProperty('--pct', `${((n - p.min) / (p.max - p.min)) * 100}%`);
    });
    range.addEventListener('change', (e) => set(Number(e.target.value)));
    return h('div', { class: 'slider-row' }, range, num, p.unit ? h('span', { class: 'unit' }, p.unit) : null);
  }
  if (p.type === 'text') {
    const ta = h('textarea', { class: key === 'code' ? 'code' : '', spellcheck: 'false', placeholder: p.description || '', 'aria-label': p.label }, value || '');
    ta.addEventListener('change', (e) => set(e.target.value));
    return ta;
  }
  return h('input', { class: 'txt', value: value || '', placeholder: p.description || '', onchange: (e) => set(e.target.value), 'aria-label': p.label });
}

function renderForm(params, args, onChange, { advancedOpen, onToggleAdvanced, ctx } = {}) {
  const entries = Object.entries(params || {});
  const main = entries.filter(([, p]) => !p.advanced);
  const adv = entries.filter(([, p]) => p.advanced);
  const field = ([key, p]) => h('div', { class: `field ${p.type === 'text' ? 'stack' : ''}`, title: p.description || '' },
    h('label', {}, p.label),
    control(key, p, args[key], (v) => onChange(Object.assign({}, args, { [key]: v })), ctx));
  return h('div', { class: 'form' },
    main.map(field),
    adv.length ? h('button', { class: 'adv-toggle', 'aria-expanded': String(!!advancedOpen), onclick: onToggleAdvanced }, icon('chev', 'sm'), 'Advanced') : null,
    adv.length && advancedOpen ? adv.map(field) : null);
}

module.exports = { renderForm };
