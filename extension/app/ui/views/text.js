'use strict';
/** Text Animation Library: live previews, filters, apply, import .ffx. */
const { h, icon } = require('../dom');
const { renderForm } = require('../form');
const { renderReport } = require('../report');
const { previewCanvas } = require('../textPreview');
const { defaults } = require('../../../core/schema');

const GROUPS = ['All', 'Signature', 'Slide', 'Blur', 'Fade', 'Type', 'Scale', 'Rotate', 'Imported'];
const SAMPLES = { en: 'Motion Design', ar: 'تصميم الحركة' };

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
    presets.length ? h('div', { class: 'tp-grid pad' }, presets.map((p) => h('button', {
      class: `tp-card ${chosen && chosen.id === p.id ? 'on' : ''}`, title: `${p.name} · ${p.duration}s${p.arabicSafe ? ' · Arabic-safe' : ''}`,
      onclick: () => { setTL({ selected: p.id }); app.state.set((st) => ({ args: Object.assign({}, st.args, { 'text.animate': Object.assign({}, st.args['text.animate'] || defaults(params), { duration: p.duration || 1 }) }) })); },
      oncontextmenu: p.source === 'ffx' ? (e) => { e.preventDefault(); lib.remove(p.id); app.render(); } : undefined
    },
    previewCanvas(p, sample),
    h('span', { class: 'tp-meta' },
      h('span', { class: 'tp-name' }, p.name),
      h('span', { class: `badge ${p.kind === 'out' ? '' : 'ok'}` }, p.kind.toUpperCase()),
      p.arabicSafe ? h('span', { class: 'badge', title: 'Words/Lines based: keeps Arabic letters joined' }, 'ع') : null)))) : h('div', { class: 'empty' }, tl.group === 'Imported' ? 'Import your .ffx text presets with the upload button.' : 'No presets in this group.'),
    chosen ? h('div', { class: 'tp-apply' },
      h('div', { class: 'section-h' }, chosen.name, h('span', { class: 'spacer' }), h('span', { class: 'why' }, `${chosen.group}${chosen.source === 'owner' ? ' · your preset' : chosen.source === 'ffx' ? ' · imported .ffx' : ''}`)),
      h('div', { class: 'pad' },
        chosen.source === 'ffx' ? h('div', { class: 'why', style: { marginBottom: '6px' } }, 'Applied by After Effects exactly as saved (settings below do not change an imported preset).') : renderForm(params, args, (next) => app.state.set((st) => ({ args: Object.assign({}, st.args, { 'text.animate': next }) })), { ctx: s.ctx, advancedOpen: s.advanced['text.animate'], onToggleAdvanced: () => app.state.set((st) => ({ advanced: Object.assign({}, st.advanced, { 'text.animate': !st.advanced['text.animate'] }) })) }),
        h('div', { class: 'actions' },
          h('button', { class: 'btn primary', disabled: !texts.length || !!s.running, onclick: () => app.runTool('text.animate', Object.assign({}, args, { presetId: chosen.id })) },
            s.running === 'text.animate' ? h('span', { class: 'spin' }) : null, texts.length ? `Apply to ${texts.length} text layer${texts.length > 1 ? 's' : ''}` : 'Select text layers'),
          h('span', { class: 'spacer' }),
          h('button', { class: 'btn ghost', title: 'Remove MOE In/Out animators from the selected text layers', disabled: !texts.length, onclick: () => app.runTool('text.removeAnimation', { which: chosen.kind }) }, icon('trash', 'sm'))),
        renderReport(result, { onRestore: () => app.restore(result.checkpointId, 'text.animate'), onDismiss: () => app.clearResult('text.animate') }))) : null);
}

module.exports = { render };
