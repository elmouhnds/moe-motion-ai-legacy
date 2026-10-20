'use strict';
/** Select — Moe Selector v5 inside the workbench. Click = replace · Shift = add · Alt = remove. */
const { h, icon } = require('../dom');
const M = require('../../../features/select/matcher');

const modeOf = (e) => (e.altKey ? 'remove' : e.shiftKey ? 'add' : 'replace');

function render(app) {
  const s = app.state.get();
  const st = s.sel || { scope: 'active', enabledOnly: false, unlockedOnly: false, criterion: 'type', label: 1, query: '', status: 'Ready' };
  const setS = (patch) => app.state.set((x) => ({ sel: Object.assign({}, x.sel || st, patch) }));
  const sel = app.services.selector;
  const snap = sel.snapshot && sel.snapshot.scope === st.scope ? sel.snapshot : null;
  const filters = { enabledOnly: st.enabledOnly, unlockedOnly: st.unlockedOnly };
  const counts = snap ? M.counts(snap.layers, filters, sel.compTimes()) : {};
  const labelNames = s.labelNames || M.DEFAULT_LABELS;

  const refresh = async (deep) => {
    try {
      await sel.load(st.scope, deep);
      if (!s.labelNames) {
        const l = await app.services.host.call('labels.get', {}).catch(() => null);
        if (l) app.state.set({ labelNames: ['None', ...l.names.map((n, i) => n || M.DEFAULT_LABELS[i + 1])] });
      }
      app.render();
    } catch (e) { setS({ status: e.message }); }
  };
  if (!snap && !s.selLoading) { app.state.get().selLoading = true; refresh(false).finally(() => { app.state.get().selLoading = false; }); }

  const run = async (label, compute, mode, deep) => {
    try {
      const fresh = await sel.load(st.scope, deep);
      const matched = compute(fresh.layers);
      if (matched && matched.error) return setS({ status: matched.error });
      const plan = Array.isArray(matched) ? M.plan(fresh.layers, matched, mode) : matched.plan;
      const r = await sel.apply(plan, label, st.scope);
      setS({ status: `${label}: ${Array.isArray(matched) ? `${matched.length} matched · ` : ''}${r.total} selected` });
      app.refreshContext(true);
    } catch (e) { setS({ status: e.message }); }
  };

  const reference = () => {
    const ctxSel = s.ctx && s.ctx.layers && s.ctx.layers[0];
    return ctxSel && snap ? snap.layers.find((L) => L.id === ctxSel.id) : null;
  };

  const sw = (prop, label, ic) => h('button', { class: 'btn ghost', title: `Toggle ${label} on selected layers`, disabled: !(s.ctx && s.ctx.layers && s.ctx.layers.length),
    onclick: async () => {
      const ids = s.ctx.layers.map((l) => l.id);
      try {
        const r = await app.services.host.call('layers.setSwitch', { label: `MOE: ${label}`, items: [{ compId: s.ctx.comp.id, layerIds: ids }], prop, value: 'toggle' });
        setS({ status: `${label} toggled on ${r.layers.filter((x) => !x.skipped).length} layer(s)` });
        app.refreshContext(true);
      } catch (e) { setS({ status: e.message }); }
    } }, icon(ic, 'sm'), label);

  return h('div', { class: 'view' },
    h('div', { class: 'pad tl-bar', style: { marginTop: '8px' } },
      h('div', { class: 'seg' }, [['active', 'Comp'], ['selectedComps', 'Comps'], ['project', 'Project']].map(([v, l]) => h('button', { 'aria-pressed': String(st.scope === v), onclick: () => { setS({ scope: v }); setTimeout(() => refresh(false), 0); } }, l))),
      h('button', { class: 'icon-btn', title: 'Refresh counts', onclick: () => refresh(false) }, icon('refresh', 'sm'))),
    h('div', { class: 'pad check-grid two', style: { marginTop: '6px' } },
      [['enabledOnly', 'Enabled only'], ['unlockedOnly', 'Unlocked only']].map(([k, l]) => h('button', { class: 'check', role: 'checkbox', 'aria-checked': String(!!st[k]), onclick: () => setS({ [k]: !st[k] }) }, h('span', { class: 'box' }), l))),
    h('div', { class: 'section-h' }, 'Layer types', h('span', { class: 'spacer' }), h('span', { class: 'why', style: { textTransform: 'none', letterSpacing: 0 } }, 'Shift add · Alt remove')),
    h('div', { class: 'type-grid pad' }, M.TYPES.map(([key, label]) => h('button', {
      class: 'type-btn', disabled: snap && key !== 'expressions' && !counts[key],
      onclick: (e) => run(`Select ${label}`, (layers) => M.byType(layers, [key], filters, sel.compTimes()), modeOf(e), key === 'expressions')
    }, h('span', {}, label), h('span', { class: 'count' }, key === 'expressions' ? '…' : snap ? counts[key] : '')))),
    h('div', { class: 'section-h' }, 'Search'),
    h('div', { class: 'pad search-row' },
      h('input', { class: 'txt', 'data-fk': 'sel-search', placeholder: 'Name, source, comment or extension', value: st.query, oninput: (e) => { (app.state.get().sel || st).query = e.target.value; },
        onkeydown: (e) => { if (e.key === 'Enter') run('Search', (layers) => M.bySearch(layers, e.target.value, filters), modeOf(e)); } }),
      h('button', { class: 'btn', onclick: (e) => run('Search', (layers) => M.bySearch(layers, (app.state.get().sel || st).query, filters), modeOf(e)) }, icon('search', 'sm'))),
    h('div', { class: 'section-h' }, 'Match reference'),
    h('div', { class: 'pad search-row' },
      h('select', { 'aria-label': 'Match by', onchange: (e) => setS({ criterion: e.target.value }) }, [['type', 'Same type'], ['source', 'Same source'], ['label', 'Same label'], ['name', 'Same name'], ['effects', 'Same effects']].map(([v, l]) => h('option', { value: v, selected: st.criterion === v }, l))),
      h('button', { class: 'btn', title: 'Uses the first selected layer as the reference', onclick: (e) => run(`Same ${st.criterion}`, (layers) => {
        const ref = reference();
        if (!ref) return { error: 'Select one reference layer first.' };
        return M.same(layers, layers.find((L) => L.id === ref.id) || ref, st.criterion, filters);
      }, modeOf(e)) }, 'Select')),
    h('div', { class: 'section-h' }, 'Labels'),
    h('div', { class: 'pad label-grid' }, labelNames.map((name, i) => h('button', {
      class: `label-sw ${st.label === i ? 'on' : ''}`, title: `${name} — click to select, right-click to choose`, style: { background: M.DEFAULT_LABEL_COLORS[i] },
      onclick: (e) => { setS({ label: i }); run(`Label ${name}`, (layers) => M.byLabel(layers, i, filters), modeOf(e)); },
      oncontextmenu: (e) => { e.preventDefault(); setS({ label: i }); }
    }))),
    h('div', { class: 'pad actions', style: { marginTop: '6px' } },
      h('button', { class: 'btn ghost', disabled: !(s.ctx && s.ctx.layers && s.ctx.layers.length), onclick: async () => {
        try {
          await app.services.host.call('layers.setSwitch', { label: 'MOE: Apply Label', items: [{ compId: s.ctx.comp.id, layerIds: s.ctx.layers.map((l) => l.id) }], prop: 'label', value: st.label });
          setS({ status: `Applied ${labelNames[st.label]} to ${s.ctx.layers.length} layer(s)` });
          refresh(false);
        } catch (e) { setS({ status: e.message }); }
      } }, h('span', { class: 'label-dot', style: { background: M.DEFAULT_LABEL_COLORS[st.label] } }), `Apply ${labelNames[st.label]}`)),
    h('div', { class: 'section-h' }, 'Selection'),
    h('div', { class: 'pad actions wrap' },
      h('button', { class: 'btn', onclick: () => run('Select all', (layers) => layers.filter((L) => (!filters.enabledOnly || L.enabled) && (!filters.unlockedOnly || !L.locked)), 'replace') }, 'All'),
      h('button', { class: 'btn', onclick: () => run('Invert', (layers) => ({ plan: M.invert(layers, filters) }), 'replace') }, 'Invert'),
      h('button', { class: 'btn', onclick: () => run('Clear', () => [], 'replace') }, 'Clear'),
      h('span', { class: 'spacer' }),
      h('button', { class: 'icon-btn', title: 'Previous selection', disabled: !sel.canBack, onclick: async () => { const r = await sel.back(); setS({ status: r.ok ? `Back: ${r.label}` : 'Nothing earlier' }); app.refreshContext(true); } }, icon('undo', 'sm')),
      h('button', { class: 'icon-btn flip', title: 'Next selection', disabled: !sel.canForward, onclick: async () => { const r = await sel.forward(); setS({ status: r.ok ? `Forward: ${r.label}` : 'Nothing later' }); app.refreshContext(true); } }, icon('undo', 'sm'))),
    h('div', { class: 'section-h' }, 'Selected layers'),
    h('div', { class: 'pad actions wrap' }, sw('solo', 'Solo', 'solo'), sw('enabled', 'Visibility', 'eye'), sw('locked', 'Lock', 'lock'), sw('shy', 'Shy', 'shy')),
    h('div', { class: 'pad why', style: { marginTop: '10px' } }, st.status));
}

module.exports = { render };
