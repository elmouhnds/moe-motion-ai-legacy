'use strict';
/** Text Animation Library: live previews, filters, apply, import .ffx. */
const { h, icon } = require('../dom');
const { renderForm } = require('../form');
const { renderReport } = require('../report');
const { previewCanvas } = require('../textPreview');
const { defaults } = require('../../../core/schema');

const GROUPS = ['All', 'Signature', 'Slide', 'Blur', 'Fade', 'Type', 'Scale', 'Rotate', 'Imported'];
// v0.75 (owner): every text-animation preview plays a two-word phrase, so word / line / letter moves all read clearly
const SAMPLES = { en: 'MOE Motion', ar: 'مو موشن' };

function render(app) {
  const s = app.state.get();
  const tl = s.textLib || { kind: 'all', group: 'All', sample: 'en', selected: null };
  const setTL = (patch) => app.state.set((st) => ({ textLib: Object.assign({}, st.textLib || tl, patch) }));
  const lib = app.services.textLibrary;
  const tool = app.services.registry.get('text.animate');
  const presets = lib.all().filter((p) => (tl.kind === 'all' || p.kind === tl.kind) && (tl.group === 'All' || p.group === tl.group));
  const chosen = tl.selected ? lib.get(tl.selected) : null;
  const sample = tl.custom || SAMPLES[tl.sample];
  const texts = s.ctx ? (s.ctx.layers || []).filter((l) => l.type === 'text') : [];
  const { presetId, ...params } = tool.params; // eslint-disable-line no-unused-vars
  const args = s.args['text.animate'] || defaults(params);
  const result = s.results['text.animate'];

  // One-click apply (▶ / double-click / the action bar) — same rules as the library sections.
  const applyPreset = async (p) => {
    if (!texts.length) { setTL({ selected: p.id }); app.toast(`${p.name}: select one or more text layers first`, 4000, 'warn'); return; }
    const runArgs = Object.assign({}, args, { presetId: p.id }, tl.selected === p.id ? {} : { duration: p.duration || args.duration });
    const r = await app.runTool('text.animate', runArgs, { label: `Text · ${p.name}` });
    if (r) app.toast(r.status === 'success' || r.status === 'partial' ? (r.summary || p.name) : `${p.name}: ${(r.errors || r.reasons || [r.status]).join(' · ')}`, 3000, r.status === 'success' ? 'ok' : r.status === 'partial' ? 'warn' : 'err');
  };
  const fileInput = h('input', { type: 'file', accept: '.ffx', multiple: true, style: { display: 'none' } });
  fileInput.addEventListener('change', async () => {
    let n = 0;
    for (const f of fileInput.files) {
      const r = lib.importFfx(f.name, new Uint8Array(await f.arrayBuffer()));
      if (r.ok) n++; else app.toast(`${f.name}: ${r.errors.join(' · ')}`, 5000);
    }
    if (n) { app.toast(`Imported ${n} preset${n > 1 ? 's' : ''}`); setTL({ group: 'Imported' }); }
  });

  return h('div', { class: 'view' },
    h('div', { class: 'pad tl-bar' },
      h('div', { class: 'seg' }, [['all', 'All'], ['in', 'In'], ['out', 'Out']].map(([v, l]) => h('button', { 'aria-pressed': String(tl.kind === v), onclick: () => setTL({ kind: v }) }, l))),
      h('div', { class: 'seg', style: { width: '84px' } }, [['en', 'EN'], ['ar', 'ع']].map(([v, l]) => h('button', { 'aria-pressed': String(tl.sample === v && !tl.custom), title: v === 'ar' ? 'Arabic sample' : 'English sample', onclick: () => setTL({ sample: v, custom: '' }) }, l))),
      h('button', { class: 'icon-btn', title: 'Import .ffx presets', onclick: () => fileInput.click() }, icon('upload', 'sm')), fileInput),
    h('div', { class: 'presets pad', style: { marginTop: '8px' } }, GROUPS.map((g) => h('button', { class: 'chip-btn', 'aria-pressed': String(tl.group === g), onclick: () => setTL({ group: g }) }, g))),
    presets.length ? h('div', { class: 'tp-grid pad' }, presets.map((p) => h('div', { class: `st-cell tp-cell ${texts.length ? '' : 'blocked select'}`, 'data-key': `tp-${p.id}` }, h('button', {
      class: `tp-card ${chosen && chosen.id === p.id ? 'on' : ''}`, title: `${p.name} · ${p.duration}s${p.arabicSafe ? ' · Arabic-safe' : ''} · ▶ or double-click to apply now`,
      onclick: () => { setTL({ selected: p.id }); app.state.set((st) => ({ args: Object.assign({}, st.args, { 'text.animate': Object.assign({}, st.args['text.animate'] || defaults(params), { duration: p.duration || 1 }) }) })); },
      ondblclick: () => applyPreset(p),
      oncontextmenu: p.source === 'ffx' ? (e) => { e.preventDefault(); lib.remove(p.id); app.render(); } : undefined
    },
    previewCanvas(p, sample),
    h('span', { class: 'tp-meta' },
      h('span', { class: 'tp-name' }, p.name),
      h('span', { class: `badge ${p.kind === 'out' ? '' : 'ok'}` }, p.kind.toUpperCase()),
      p.arabicSafe ? h('span', { class: 'badge', title: 'Words/Lines based: keeps Arabic letters joined' }, 'ع') : null)),
    h('button', { class: 'st-play', title: texts.length ? `Apply ${p.name} now` : 'Select text layers first', 'aria-label': `Apply ${p.name} now`, onclick: () => applyPreset(p) }, icon('play', 'sm'))))) : h('div', { class: 'empty' }, tl.group === 'Imported' ? 'Import your .ffx text presets with the upload button.' : 'No presets in this group.'),
    chosen ? h('div', { class: 'tp-apply' },
      h('div', { class: 'section-h' }, chosen.name, h('span', { class: 'spacer' }), h('span', { class: 'why' }, `${chosen.group}${chosen.source === 'owner' ? ' · your preset' : chosen.source === 'ffx' ? ' · imported .ffx' : ''}`)),
      h('div', { class: 'pad' },
        chosen.source === 'ffx' ? h('div', { class: 'why', style: { marginBottom: '6px' } }, 'Applied by After Effects exactly as saved (settings below do not change an imported preset).') : renderForm(params, args, (next) => app.state.set((st) => ({ args: Object.assign({}, st.args, { 'text.animate': next }) })), { ctx: s.ctx, advancedOpen: s.advanced['text.animate'], onToggleAdvanced: () => app.state.set((st) => ({ advanced: Object.assign({}, st.advanced, { 'text.animate': !st.advanced['text.animate'] }) })) }),
        h('div', { class: 'actions' },
          h('span', { class: 'spacer' }),
          h('button', { class: 'btn ghost', title: 'Remove MOE In/Out animators from the selected text layers', disabled: !texts.length, onclick: () => app.runTool('text.removeAnimation', { which: chosen.kind }) }, icon('trash', 'sm'))),
        renderReport(result, { onRestore: () => app.restore(result.checkpointId, 'text.animate'), onDismiss: () => app.clearResult('text.animate') }))) : null,
    // Sticky action bar, as in every library section.
    h('div', { class: 'st-actbar', role: 'region', 'aria-label': 'Apply' },
      h('div', { class: 'st-act-text' },
        h('div', { class: 'st-act-name' }, chosen ? chosen.name : 'Pick a text preset'),
        h('div', { class: `st-act-hint ${texts.length ? '' : 'warn'}`, title: texts.length ? '' : 'Select text layers in After Effects' }, texts.length ? `${texts.length} text layer${texts.length > 1 ? 's' : ''} selected` : 'Select text layers in After Effects')),
      chosen && !s.studioWide ? h('button', { class: 'btn ghost', title: 'Show the settings of this preset', onclick: () => { const el = document.querySelector('.tp-apply'); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } }, icon('sliders', 'sm'), h('span', { class: 'label' }, 'Settings')) : null,
      h('button', { class: 'btn primary', disabled: !chosen || !texts.length || !!s.running, title: texts.length ? '' : 'Select text layers first', onclick: () => chosen && applyPreset(chosen) },
        s.running === 'text.animate' ? h('span', { class: 'spin' }) : icon('play', 'sm'), texts.length ? `Apply to ${texts.length}` : 'Apply')));
}

module.exports = { render };
