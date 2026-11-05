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
    const fix = (n) => (p.type === 'integer' ? Math.round(n) : n);
    // v0.56 Smart controls: the number is a hidden slider too (drag sideways, ↑ ↓, wheel while focused)
    const scrub = (live) => require('./scrub').attach(num, { step, min: p.min, max: p.max, round: p.type === 'integer' ? Math.round : undefined, live, commit: (n) => set(fix(n)) });
    if (!ranged) { scrub(); return h('div', { class: 'slider-row' }, num, p.unit ? h('span', { class: 'unit' }, p.unit) : null); }
    const pct = ((value - p.min) / (p.max - p.min)) * 100;
    const range = h('input', { type: 'range', min: p.min, max: p.max, step, value, style: { '--pct': `${pct}%` }, 'aria-label': p.label, title: p.default !== undefined ? `Double-click: back to ${p.default}${p.unit ? ` ${p.unit}` : ''}` : '' });
    const moveRange = (n) => { range.value = n; range.style.setProperty('--pct', `${((n - p.min) / (p.max - p.min)) * 100}%`); };
    range.addEventListener('input', (e) => {
      const n = Number(e.target.value);
      num.value = n;
      moveRange(n);
    });
    range.addEventListener('change', (e) => set(Number(e.target.value)));
    // v0.56: double-click a slider to put its default back
    if (p.default !== undefined) range.addEventListener('dblclick', () => { num.value = p.default; moveRange(p.default); set(p.default); });
    scrub(moveRange);
    return h('div', { class: 'slider-row' }, range, num, p.unit ? h('span', { class: 'unit' }, p.unit) : null);
  }
  if (p.type === 'text') {
    const ta = h('textarea', { class: key === 'code' ? 'code' : '', spellcheck: 'false', placeholder: p.description || '', 'aria-label': p.label }, value || '');
    ta.addEventListener('change', (e) => set(e.target.value));
    return ta;
  }
  if (p.format === 'color') return colorControl(p, value, set, ctx);
  return h('input', { class: 'txt', value: value || '', placeholder: p.description || '', onchange: (e) => set(e.target.value), 'aria-label': p.label });
}

/** Colour field: native picker + #RRGGBB text + quick swatches (active client first). */
function colorControl(p, value, set, ctx) {
  const ok = /^#[0-9a-fA-F]{6}$/.test(value || '');
  const swatches = (ctx && ctx.__swatches) || [];
  return h('div', { class: 'color-row' },
    h('label', { class: 'color-chip', style: { background: ok ? value : 'transparent' }, title: 'Pick a colour' },
      h('input', { type: 'color', value: ok ? value : '#ffffff', 'aria-label': p.label, onchange: (e) => set(e.target.value.toUpperCase()) })),
    h('input', { class: 'txt hex', value: value || '', maxlength: 7, spellcheck: 'false', 'aria-label': `${p.label} hex`, onchange: (e) => { let v = e.target.value.trim(); if (/^[0-9a-fA-F]{6}$/.test(v)) v = `#${v}`; set(v.toUpperCase()); } }),
    swatches.length ? h('div', { class: 'swatches' }, swatches.map((hex) => h('button', { class: `sw ${hex === String(value).toUpperCase() ? 'on' : ''}`, style: { background: hex }, title: hex, 'aria-label': hex, onclick: () => set(hex) }))) : null);
}

function renderForm(params, args, onChange, { advancedOpen, onToggleAdvanced, ctx, swatches } = {}) {
  if (swatches) ctx = Object.assign({}, ctx, { __swatches: swatches });
  // `hidden` params are set by custom UI (e.g. a picker); `showIf(args)` makes a field conditional.
  const entries = Object.entries(params || {}).filter(([, p]) => !p.hidden && (!p.showIf || p.showIf(args)));
  const main = entries.filter(([, p]) => !p.advanced);
  const adv = entries.filter(([, p]) => p.advanced);
  const field = ([key, p]) => h('div', { class: `field ${p.type === 'text' || p.format === 'color' ? 'stack' : ''}`, title: p.description || '' },
    h('label', {}, p.label),
    control(key, p, args[key], (v) => onChange(Object.assign({}, args, { [key]: v })), ctx));
  // Booleans flagged `grid` render as a compact checkbox grid (e.g. Proximity reactions).
  const gridKeys = main.filter(([, p]) => p.type === 'boolean' && p.grid);
  const rest = main.filter(([, p]) => !(p.type === 'boolean' && p.grid));
  const grid = gridKeys.length ? h('div', { class: 'check-grid' }, gridKeys.map(([key, p]) => h('button', {
    class: 'check', role: 'checkbox', 'aria-checked': String(!!args[key]), title: p.description || p.label,
    onclick: () => onChange(Object.assign({}, args, { [key]: !args[key] }))
  }, h('span', { class: 'box' }), p.label))) : null;
  return h('div', { class: 'form' },
    rest.map(field),
    grid,
    adv.length ? h('button', { class: 'adv-toggle', 'aria-expanded': String(!!advancedOpen), onclick: onToggleAdvanced }, icon('chev', 'sm'), 'Advanced') : null,
    adv.length && advancedOpen ? adv.map(field) : null);
}

module.exports = { renderForm, control };
