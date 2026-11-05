'use strict';
/**
 * Deliver board (Studio): every target format at once. Measures the comp once, plans
 * each format locally (planner), draws before/after diagrams, lets you override roles
 * and zones per format, optionally asks Claude, then creates one adapted comp per
 * checked format through the normal Resize & Adapt tool (each run verified + restorable).
 */
const { h, icon } = require('../dom');
const { renderReport } = require('../report');
const widgets = require('../widgets');
const F = require('../../../features/adapt/formats');
const P = require('../../../features/adapt/planner');
const { measureComp } = require('../../../features/adapt/measure');

const DEFAULT = { formats: ['v916', 'sq', 'p45'], selected: 'v916', method: 'smart', margin: 5, reflow: true, nested: true, overrides: {}, custom: { w: 1500, h: 500 } };
const ROLE_OPTIONS = ['auto', 'background', 'band', 'pinned', 'content', 'skip'];
const ZONE_OPTIONS = ['auto', 'TL', 'TC', 'TR', 'ML', 'MC', 'MR', 'BL', 'BC', 'BR'];

function sizeOf(st, id) {
  if (id === 'custom') return { width: st.custom.w, height: st.custom.h };
  const f = F.byId(id);
  return { width: f.w, height: f.h };
}
const label = (id, st) => (id === 'custom' ? `${st.custom.w}×${st.custom.h}` : F.byId(id).label.split(' ')[0]);

function render(app) {
  const s = app.state.get();
  const st = Object.assign({}, DEFAULT, s.deliver || {});
  const set = (patch) => app.state.set((x) => ({ deliver: Object.assign({}, DEFAULT, x.deliver || {}, patch) }));
  const ctx = s.ctx;
  if (!ctx || !ctx.comp) return h('div', { class: 'view' }, h('div', { class: 'notice' }, 'Open the composition you want to deliver in other formats.'));
  const comp = ctx.comp;
  const tabBar = h('div', { class: 'st-tabs', role: 'tablist' }, [['board', 'Board'], ['tool', 'Single format']].map(([id, l]) => h('button', { role: 'tab', 'aria-selected': String((st.tab || 'board') === id), onclick: () => set({ tab: id }) }, l)));
  if (st.tab === 'tool') return h('div', { class: 'view studio-sec' }, tabBar, require('../toolBlock').renderTool(app, app.services.registry.get('adapt.resize'), { openByDefault: true }));
  const measured = st.measured && st.measured.compId === comp.id ? st.measured : null;
  const planFor = (id) => {
    if (!measured) return null;
    const dst = sizeOf(st, id);
    let overrides = {};
    try { overrides = JSON.parse(st.overrides[id] || '{}'); } catch (e) { overrides = {}; }
    const p = P.plan({ src: measured.src, dst, elements: measured.elements, method: st.method, margin: st.margin / 100, reflow: st.reflow ? 'auto' : 'off', overrides, nested: st.nested });
    return Object.assign({ src: measured.src, dst }, p);
  };

  const measure = async () => {
    set({ busy: 'measure', error: null });
    try {
      const m = await measureComp(app.services.host, comp.id, { refTime: comp.time });
      set({ busy: null, measured: { compId: comp.id, src: { width: m.info.width, height: m.info.height }, elements: m.elements, at: comp.time } });
    } catch (e) { set({ busy: null, error: e.message }); }
  };
  if (!measured && !st.busy && !st.error && !st.autoTried) { setTimeout(() => { set({ autoTried: true }); measure(); }, 0); }

  const create = async () => {
    const results = [];
    set({ busy: 'create', results: [] });
    for (const id of st.formats) {
      const dst = sizeOf(st, id);
      if (dst.width === comp.width && dst.height === comp.height) { results.push({ id, r: { status: 'blocked', errors: ['Same size as the comp'] } }); continue; }
      const args = { format: id === 'custom' ? 'custom' : id, method: st.method, output: 'copy', margin: st.margin, reflow: st.reflow, nested: st.nested, open: false, overrides: st.overrides[id] || '' };
      if (id === 'custom') Object.assign(args, { width: dst.width, height: dst.height });
      const r = await app.runTool('adapt.resize', args, { resultKey: `deliver:${id}` });
      results.push({ id, r });
      set({ results: results.slice() });
    }
    set({ busy: null, results });
    const ok = results.filter((x) => x.r && x.r.status === 'success').length;
    app.toast(`${ok} of ${results.length} comps created — originals untouched`);
  };

  const refine = async () => {
    const id = st.selected;
    const dst = sizeOf(st, id);
    set({ busy: 'claude' });
    const r = await app.runTool('adapt.suggestLayout', { format: id === 'custom' ? 'custom' : id, width: dst.width, height: dst.height, brief: '' }, { resultKey: 'deliver:claude' });
    set({ busy: null });
    if (r && r.status === 'success') { set({ overrides: Object.assign({}, st.overrides, { [id]: JSON.stringify(r.result.overrides) }) }); app.toast(`Claude layout loaded for ${label(id, st)} — review, then create`); }
    else if (r) app.toast((r.errors || [r.status]).join(' · '), 5000);
  };

  const sel = planFor(st.selected);
  const frame = (id, which, cls) => {
    const p = planFor(id);
    const canvas = h('canvas', { class: `dv-frame ${cls || ''}`, 'aria-label': `${label(id, st)} layout` });
    const sz = which === 'old' ? measured.src : sizeOf(st, id);
    const k = Math.min(150 / sz.width, 130 / sz.height);
    canvas.style.width = `${Math.round(sz.width * k)}px`;
    canvas.style.height = `${Math.round(sz.height * k)}px`;
    if (p) setTimeout(() => widgets.drawPlanFrame(canvas, p, which), 0);
    return canvas;
  };

  const formatCards = measured ? st.formats.map((id) => h('button', {
    class: `dv-card ${st.selected === id ? 'on' : ''}`, 'aria-pressed': String(st.selected === id), onclick: () => set({ selected: id })
  }, frame(id, 'new'), h('span', { class: 'dv-cap' }, label(id, st), st.overrides[id] ? h('span', { class: 'st-badge' }, 'edited') : null))) : [];

  const toggles = h('div', { class: 'st-chips dv-formats' }, [...F.FORMATS.map((f) => f.id), 'custom'].map((id) => h('button', {
    class: 'chip-btn', 'aria-pressed': String(st.formats.includes(id)), title: id === 'custom' ? 'Custom size' : `${F.byId(id).w}×${F.byId(id).h} · ${F.byId(id).note}`,
    onclick: () => set({ formats: st.formats.includes(id) ? st.formats.filter((x) => x !== id) : [...st.formats, id], selected: st.formats.includes(id) && st.selected === id ? st.formats.filter((x) => x !== id)[0] : id })
  }, id === 'custom' ? 'Custom' : F.byId(id).label.split(' ')[0])));

  let overrides = {};
  try { overrides = JSON.parse(st.overrides[st.selected] || '{}'); } catch (e) { overrides = {}; }
  const setOverride = (layerId, patch) => {
    const o = Object.assign({}, overrides);
    o[layerId] = Object.assign({}, o[layerId] || {}, patch);
    for (const k of Object.keys(o[layerId])) if (o[layerId][k] === undefined) delete o[layerId][k];
    if (!Object.keys(o[layerId]).length) delete o[layerId];
    set({ overrides: Object.assign({}, st.overrides, { [st.selected]: Object.keys(o).length ? JSON.stringify(o) : '' }) });
  };
  const overlaps = sel ? sel.warnings.filter((w) => /overlaps/.test(w)) : [];

  const inspector = h('aside', { class: 'st-inspector', 'aria-label': 'Format inspector' },
    h('div', { class: 'st-ins-h' }, h('span', { class: 'st-kicker' }, st.selected ? `${label(st.selected, st)} · ${sizeOf(st, st.selected).width}×${sizeOf(st, st.selected).height}` : 'FORMAT')),
    st.selected === 'custom' ? h('div', { class: 'dv-custom' },
      h('label', {}, 'W', h('input', { class: 'num', type: 'number', value: st.custom.w, min: 16, max: 16000, onchange: (e) => set({ custom: Object.assign({}, st.custom, { w: Math.round(Number(e.target.value) || 1500) }) }) })),
      h('label', {}, 'H', h('input', { class: 'num', type: 'number', value: st.custom.h, min: 16, max: 16000, onchange: (e) => set({ custom: Object.assign({}, st.custom, { h: Math.round(Number(e.target.value) || 500) }) }) }))) : null,
    sel ? h('div', { class: 'plan-list' }, sel.layers.map((l) => {
      const o = overrides[l.layerId] || {};
      return h('div', { class: 'plan-row' },
        h('span', { class: 'label-dot', style: { background: widgets.ROLE_COLORS[l.role] || '#888' } }),
        h('span', { class: 'pn', title: l.reason ? `${l.name} — ${l.reason}` : l.name }, l.name),
        h('select', { 'aria-label': `${l.name} role`, onchange: (e) => setOverride(l.layerId, { role: e.target.value === 'auto' ? undefined : e.target.value }) }, ROLE_OPTIONS.map((r) => h('option', { value: r, selected: (o.role || 'auto') === r }, r === 'auto' ? `auto · ${l.role}` : r))),
        h('select', { 'aria-label': `${l.name} zone`, onchange: (e) => setOverride(l.layerId, { zone: e.target.value === 'auto' ? undefined : e.target.value }) }, ZONE_OPTIONS.map((z) => h('option', { value: z, selected: (o.zone || 'auto') === z }, z === 'auto' ? `auto · ${l.zone}` : z))));
    })) : h('div', { class: 'why' }, st.busy === 'measure' ? 'Measuring layers…' : 'Measure the comp to see each layer’s plan.'),
    h('div', { class: 'field' }, h('label', {}, 'Method'), h('div', { class: 'seg' }, [['smart', 'Smart'], ['fit', 'Fit'], ['fill', 'Fill'], ['keep', 'Keep']].map(([v, l]) => h('button', { 'aria-pressed': String(st.method === v), onclick: () => set({ method: v }) }, l)))),
    h('div', { class: 'field' }, h('label', {}, `Safe margin ${st.margin}%`), h('input', { type: 'range', min: 0, max: 20, step: 0.5, value: st.margin, 'aria-label': 'Safe margin', onchange: (e) => set({ margin: Number(e.target.value) }) })),
    h('button', { class: 'check', role: 'checkbox', 'aria-checked': String(st.reflow), onclick: () => set({ reflow: !st.reflow }) }, h('span', { class: 'box' }), 'Re-stack when the orientation flips'),
    h('button', { class: 'check', role: 'checkbox', 'aria-checked': String(st.nested), onclick: () => set({ nested: !st.nested }) }, h('span', { class: 'box' }), 'Adapt inside full-frame pre-comps'),
    h('span', { class: 'spacer' }),
    sel ? h('div', { class: `dv-status ${overlaps.length ? 'warn' : 'ok'}` }, overlaps.length ? overlaps[0] : 'No overlaps · all inside the safe area') : null);

  const results = (st.results || []).map(({ id, r }) => h('div', { class: 'dv-result' }, h('b', {}, label(id, st)), renderReport(r, { onRestore: r && r.checkpointId ? () => app.restore(r.checkpointId, `deliver:${id}`) : undefined })));
  const n = st.formats.length;

  return h('div', { class: 'view studio-sec deliver' },
    tabBar,
    h('div', { class: 'st-tabs sub' },
      h('span', { class: 'st-kicker', title: `ALL FORMATS AT ONCE — EVERY KEYFRAME KEPT · reference ${comp.time.toFixed(2)}s` }, `ALL FORMATS AT ONCE — EVERY KEYFRAME KEPT · reference ${comp.time.toFixed(2)}s`),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn ghost', disabled: !!st.busy, onclick: measure, title: 'Measure again (after moving the playhead or editing layers)' }, st.busy === 'measure' ? h('span', { class: 'spin' }) : icon('refresh', 'sm'), 'Measure'),
      h('button', { class: 'btn ghost', disabled: !!st.busy || !st.selected, onclick: refine, title: 'Claude proposes the layout for the selected format (names, text and boxes are sent — no pixels)' }, st.busy === 'claude' ? h('span', { class: 'spin' }) : icon('spark', 'sm'), 'Refine with Claude')),
    toggles,
    st.error ? h('div', { class: 'notice' }, st.error) : null,
    h('div', { class: `st-body ${s.studioWide ? 'wide' : ''}` },
      h('div', { class: 'st-main' },
        measured ? h('div', { class: 'dv-board' },
          h('div', { class: 'dv-card src' }, frame(st.formats[0] || 'v916', 'old', 'src'), h('span', { class: 'dv-cap' }, `Source · ${F.ratioText(measured.src.width, measured.src.height)}`)),
          formatCards) : h('div', { class: 'empty' }, st.busy === 'measure' ? 'Measuring…' : 'No measurement yet'),
        h('div', { class: 'dv-legend' }, [['background', 'background · cover'], ['pinned', 'pinned · keeps its corner'], ['content', 'content · re-stacked'], ['band', 'band · full width']].map(([r, t]) => h('span', {}, h('span', { class: 'label-dot', style: { background: widgets.ROLE_COLORS[r] } }), t))),
        results.length ? h('div', { class: 'dv-results' }, results) : null),
      inspector),
    h('div', { class: 'dv-foot' },
      h('span', { class: 'why' }, `${n} new comp${n === 1 ? '' : 's'} · originals untouched · each result is measured and checked`),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn primary', disabled: !!st.busy || !n || !measured, onclick: create }, st.busy === 'create' ? h('span', { class: 'spin' }) : null, `Create ${n} comp${n === 1 ? '' : 's'}`)));
}

module.exports = { render };
