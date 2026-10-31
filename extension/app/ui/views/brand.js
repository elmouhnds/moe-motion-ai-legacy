'use strict';
/** Brand Kit: clients, palettes, fonts. Click a swatch / font to apply it to the selection. */
const { h, icon } = require('../dom');
const { renderReport } = require('../report');
const B = require('../../../features/brand/brands');

/* ---------- v0.25: brand from a website / PDF (features/brand/fromSource.js) ---------- */
const openUrl = (url) => { try { if (window.cep && window.cep.util && window.cep.util.openURLInDefaultBrowser) window.cep.util.openURLInDefaultBrowser(url); else window.open(url, '_blank', 'noopener'); } catch (e) { /* nothing to open with */ } };
const ROLE_LABEL = { primary: 'Primary', secondary: 'Secondary', accent: 'Accent', background: 'Background', surface: 'Surface', text: 'Text', neutral: 'Neutral' };
function importPanel(app, s) {
  const imp = s.brandImport;
  const set = (patch) => app.state.set((st) => ({ brandImport: Object.assign({}, st.brandImport, patch) }));
  const res = s.results['brand.fromSource'];
  const r = res && res.status === 'success' ? res.result : null;
  const hasKey = app.state.get().hasKey !== false;
  const url = h('input', { class: 'txt', type: 'url', placeholder: 'client.com', 'aria-label': 'Client website', value: imp.url || '', spellcheck: 'false' });
  url.addEventListener('input', (e) => { app.state.get().brandImport.url = e.target.value; });
  url.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  const pickPdf = () => {
    const cep = window.cep && window.cep.fs;
    if (cep && cep.showOpenDialogEx) { const p = cep.showOpenDialogEx(false, false, 'Choose the client brand book (PDF)', '', ['pdf']); if (p && p.data && p.data[0]) set({ file: p.data[0] }); return; }
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.pdf';
    inp.onchange = () => { const f = inp.files[0]; if (f) set({ file: f.path || f.name }); }; inp.click();
  };
  const run = () => { const cur = app.state.get().brandImport; app.clearResult('brand.fromSource'); app.runTool('brand.fromSource', { source: cur.source, url: cur.url || '', file: cur.file || '', deep: cur.deep !== false }, { label: 'Brand from website / PDF' }); };
  return h('div', { class: 'view' }, h('div', { class: 'pad bi' },
    h('div', { class: 'bi-h' }, icon('sparkles', ''), h('b', {}, 'New client from their website or brand book'), h('span', { class: 'spacer' }), h('button', { class: 'icon-btn', 'aria-label': 'Close', title: 'Close', onclick: () => { app.clearResult('brand.fromSource'); app.state.set({ brandImport: null }); } }, icon('x', 'sm'))),
    h('p', { class: 'why' }, 'MOE reads the site (or PDF), Claude finds the brand colours with their roles, fonts, gradients, tone, how it should move and its rules. Fonts are matched to the ones you have installed. You review everything before it is saved.'),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Source' }, [['website', 'Website'], ['pdf', 'PDF brand book']].map(([v, l]) => h('button', { role: 'radio', 'aria-checked': String(imp.source === v), 'aria-pressed': String(imp.source === v), onclick: () => set({ source: v }) }, l))),
    imp.source === 'website' ? h('div', { class: 'field' }, h('label', {}, 'Website'), url)
      : h('div', { class: 'field' }, h('label', {}, 'PDF'), h('button', { class: 'btn', onclick: pickPdf }, icon('folder', 'sm'), imp.file ? String(imp.file).split(/[\\/]/).pop() : 'Choose PDF…')),
    h('label', { class: 'bi-deep', title: hasKey ? 'Claude reads the page / PDF and logo (uses your API key; a few cents)' : 'Add your Claude API key in Settings for deep analysis' },
      h('input', { type: 'checkbox', checked: imp.deep !== false, onchange: (e) => set({ deep: e.target.checked }) }), h('span', {}, 'Deep analysis with Claude'), h('span', { class: 'why' }, imp.source === 'pdf' ? ' (needed for a PDF)' : ' (off = quick local scan of colours and fonts)')),
    h('div', { class: 'actions' }, h('button', { class: 'btn primary', disabled: !!s.running, onclick: run }, icon('sparkles', 'sm'), s.running ? 'Analysing…' : 'Analyse')),
    res && res.status !== 'success' ? renderReport(res, { onDismiss: () => app.clearResult('brand.fromSource') }) : null,
    r ? review(app, r) : null));
}
/** The proposal, before anything is saved. */
function review(app, r) {
  const d = r.draft, p = d.profile || {};
  return h('div', { class: 'bi-review', 'data-key': 'bi-review' },
    h('div', { class: 'bi-top' },
      p.logo && p.logo.url ? h('img', { class: 'bi-logo', src: p.logo.url, alt: p.logo.description || `${d.name} logo` }) : null,
      h('div', {}, h('div', { class: 'bi-name' }, d.name), p.tagline ? h('div', { class: 'why' }, p.tagline) : null,
        h('div', { class: 'why' }, `${r.usedAI ? 'Analysed by Claude' : 'Local scan'} · ${r.source.kind === 'pdf' ? r.source.file : r.source.url}${r.aiError ? ` — Claude unavailable: ${r.aiError}` : ''}`))),
    h('div', { class: 'section-h' }, 'Colours'),
    h('div', { class: 'swatch-grid' }, d.colors.map((c) => { const ink = B.contrast(B.hexToRgb(c.hex), [1, 1, 1]) >= 3 ? '#fff' : '#111'; return h('div', { class: 'brand-swatch', style: { background: c.hex, color: ink }, title: c.usage || c.name }, h('span', { class: 'sw-name' }, c.name), h('span', { class: 'sw-hex' }, `${c.hex}${c.role ? ` · ${ROLE_LABEL[c.role] || c.role}` : ''}`)); })),
    (p.gradients || []).length ? h('div', { class: 'bi-grads' }, p.gradients.map((g) => h('div', { class: 'bi-grad', title: g.name, style: { background: `linear-gradient(90deg, ${g.stops.join(', ')})` } }, h('span', {}, g.name)))) : null,
    h('div', { class: 'section-h' }, 'Fonts'),
    (r.matches || []).length ? h('div', { class: 'bi-fonts' }, r.matches.map((m) => h('div', { class: 'list-row' },
      h('span', { class: `bi-ok ${m.installed ? 'yes' : 'no'}` }, icon(m.installed ? 'check' : 'info', 'sm')),
      h('div', { class: 'main' }, h('div', { class: 't1' }, `${m.family} · ${m.role}`), h('div', { class: 't2' }, m.installed ? `Installed (${m.installed.style})` : m.fallbackInstalled ? `Not installed — using ${m.fallbackInstalled.family} meanwhile` : 'Not installed')),
      !m.installed && m.getUrl ? h('button', { class: 'btn ghost sm', title: m.getUrl, onclick: () => openUrl(m.getUrl) }, 'Get font') : null))) : h('div', { class: 'why' }, 'No font names found.'),
    p.tone && (p.tone.description || p.tone.keywords.length) ? [h('div', { class: 'section-h' }, 'Tone'), h('div', { class: 'bi-chips' }, p.tone.keywords.map((k) => h('span', { class: 'chip' }, k))), p.tone.description ? h('div', { class: 'explain' }, p.tone.description) : null] : null,
    p.motion && (p.motion.feel || p.motion.easing) ? [h('div', { class: 'section-h' }, 'Motion'), h('div', { class: 'explain' }, [p.motion.feel, p.motion.easing && `Easing: ${p.motion.easing}`, p.motion.pace && `Pace: ${p.motion.pace}`].filter(Boolean).join(' · '))] : null,
    (p.rules || []).length ? [h('div', { class: 'section-h' }, 'Rules'), h('ul', { class: 'bi-rules' }, p.rules.map((x) => h('li', {}, x)))] : null,
    h('div', { class: 'actions' },
      h('button', { class: 'btn primary', onclick: () => { const sv = app.services.brands.save(d); if (!sv.ok) return app.toast(sv.errors.join(' · '), 5000, 'err'); app.clearResult('brand.fromSource'); app.state.set({ brandImport: null, brandId: sv.brand.id }); app.toast(`${sv.brand.name} saved — click a colour or Auto fonts to use it`, 3500, 'ok'); } }, icon('check', 'sm'), 'Save client'),
      h('button', { class: 'btn ghost', onclick: () => { app.clearResult('brand.fromSource'); app.state.set({ brandImport: null, brandEdit: JSON.parse(JSON.stringify(d)) }); } }, icon('edit', 'sm'), 'Edit first')));
}
/** What import found, shown on a saved client (tone, motion, rules, gradients, fonts to install). */
function profileBlock(app, brand) {
  const p = brand.profile;
  if (!p) return null;
  const missing = (p.fonts || []).filter((f) => !f.installed);
  return h('div', { class: 'pad bi-profile' },
    (p.gradients || []).length ? h('div', { class: 'bi-grads' }, p.gradients.map((g) => h('div', { class: 'bi-grad', title: g.name, style: { background: `linear-gradient(90deg, ${g.stops.join(', ')})` } }, h('span', {}, g.name)))) : null,
    p.tone && p.tone.keywords && p.tone.keywords.length ? h('div', { class: 'bi-chips' }, h('span', { class: 'why' }, 'Tone'), p.tone.keywords.map((k) => h('span', { class: 'chip' }, k))) : null,
    p.motion && p.motion.easing ? h('div', { class: 'why' }, `Motion: ${[p.motion.feel, p.motion.easing, p.motion.pace].filter(Boolean).join(' · ')}`) : null,
    missing.length ? h('div', { class: 'bi-missing' }, h('span', { class: 'why' }, 'Fonts to install:'), missing.map((f) => f.getUrl ? h('button', { class: 'btn ghost sm', title: f.getUrl, onclick: () => openUrl(f.getUrl) }, f.family) : h('span', { class: 'chip' }, f.family))) : null,
    p.source ? h('div', { class: 'why' }, `From ${p.source.kind === 'pdf' ? p.source.file : p.source.url}${p.source.usedAI ? ' (Claude)' : ' (local scan)'}`) : null);
}

function fontLabel(f) { return f ? `${f.family || f.ps}${f.style ? ' ' + f.style : ''}` : 'Not set'; }

function fontPicker(app, current, onPick, arabicFirst) {
  const box = h('div', { class: 'font-pick', 'data-fresh': '' }); // draw() writes into list: rebuild as a unit
  const input = h('input', { class: 'txt', placeholder: current ? fontLabel(current) : 'Search installed fonts…', spellcheck: 'false' });
  const list = h('div', { class: 'font-list' });
  let fonts = null;
  const draw = () => {
    list.innerHTML = '';
    if (!fonts) { list.appendChild(h('div', { class: 'why' }, 'Loading fonts…')); return; }
    const q = input.value.toLowerCase();
    const hits = fonts.filter((f) => !q || `${f.family} ${f.style} ${f.ps}`.toLowerCase().includes(q))
      .sort((a, b) => (arabicFirst ? Number(b.arabic) - Number(a.arabic) : 0) || a.family.localeCompare(b.family)).slice(0, 40);
    hits.forEach((f) => list.appendChild(h('button', { class: 'font-row', onclick: () => { onPick({ ps: f.ps, family: f.family, style: f.style }); input.value = ''; list.innerHTML = ''; } },
      h('span', {}, `${f.family} ${f.style}`), f.arabic ? h('span', { class: 'badge' }, 'ع') : null)));
    if (!hits.length) list.appendChild(h('div', { class: 'why' }, 'No matching fonts'));
  };
  input.addEventListener('focus', () => { app.fonts().then((f) => { fonts = f; draw(); }).catch((e) => { list.innerHTML = ''; list.appendChild(h('div', { class: 'why' }, `Fonts unavailable: ${e.message}`)); }); draw(); });
  input.addEventListener('input', draw);
  box.append(input, list);
  return box;
}

function editor(app, draft) {
  const setD = (patch) => app.state.set((st) => ({ brandEdit: Object.assign({}, st.brandEdit, patch) }));
  const colors = draft.colors || [];
  const palette = app.state.get().results['brand.extractPalette'];
  return h('div', { class: 'pad brand-edit' },
    h('div', { class: 'field' }, h('label', {}, 'Client'), h('input', { class: 'txt', value: draft.name || '', placeholder: 'Client name', oninput: (e) => { app.state.get().brandEdit.name = e.target.value; } })),
    h('div', { class: 'section-h', style: { padding: '10px 0 4px' } }, 'Palette'),
    colors.map((c, i) => h('div', { class: 'color-row' },
      h('input', { type: 'color', value: B.hexToRgb(c.hex) ? c.hex : '#000000', onchange: (e) => { colors[i] = Object.assign({}, c, { hex: e.target.value.toUpperCase() }); setD({ colors: colors.slice() }); } }),
      h('input', { class: 'txt hex', value: c.hex, onchange: (e) => { colors[i] = Object.assign({}, c, { hex: e.target.value }); setD({ colors: colors.slice() }); } }),
      h('input', { class: 'txt', value: c.name || '', placeholder: 'Name', onchange: (e) => { colors[i] = Object.assign({}, c, { name: e.target.value }); setD({ colors: colors.slice() }); } }),
      h('button', { class: 'icon-btn', title: 'Remove colour', onclick: () => setD({ colors: colors.filter((_, j) => j !== i) }) }, icon('x', 'sm')))),
    h('div', { class: 'actions', style: { marginTop: '4px' } },
      h('button', { class: 'btn ghost', onclick: () => setD({ colors: [...colors, { name: `Colour ${colors.length + 1}`, hex: '#FFFFFF' }] }) }, icon('plus', 'sm'), 'Colour'),
      h('button', { class: 'btn ghost', title: 'Measure the selected logo/footage layer', onclick: async () => {
        const r = await app.runTool('brand.extractPalette', { count: 5 });
        if (r && r.ok) setD({ colors: [...(app.state.get().brandEdit.colors || []), ...r.result.colors.map((hex, i) => ({ name: `Sampled ${i + 1}`, hex }))] });
      } }, icon('pulse', 'sm'), 'From selected layer')),
    palette && palette.status !== 'success' ? renderReport(palette, { onDismiss: () => app.clearResult('brand.extractPalette') }) : null,
    h('div', { class: 'section-h', style: { padding: '10px 0 4px' } }, 'Fonts'),
    [['arabic', 'Arabic'], ['english', 'English']].map(([role, label]) => h('div', { class: 'field stack' },
      h('label', {}, `${label}: ${fontLabel(draft.fonts && draft.fonts[role])}`),
      fontPicker(app, draft.fonts && draft.fonts[role], (f) => setD({ fonts: Object.assign({}, draft.fonts, { [role]: f }) }), role === 'arabic'))),
    h('div', { class: 'field stack' }, h('label', {}, 'Notes'), h('textarea', { placeholder: 'Usage rules, tone, do / don’t…', oninput: (e) => { app.state.get().brandEdit.notes = e.target.value; } }, draft.notes || '')),
    draft.errors ? h('div', { class: 'notice err', style: { margin: '8px 0 0' } }, draft.errors.join(' · ')) : null,
    h('div', { class: 'actions' },
      h('button', { class: 'btn primary', onclick: () => {
        const d = app.state.get().brandEdit;
        const r = app.services.brands.save(d);
        if (!r.ok) return setD({ errors: r.errors });
        app.state.set({ brandEdit: null, brandId: r.brand.id });
        app.toast('Client saved');
      } }, 'Save client'),
      h('button', { class: 'btn ghost', onclick: () => app.state.set({ brandEdit: null }) }, 'Cancel')));
}

function render(app) {
  const s = app.state.get();
  const brands = app.services.brands.list();
  if (s.brandEdit) return h('div', { class: 'view' }, editor(app, s.brandEdit));
  if (s.brandImport) return importPanel(app, s);
  const startImport = () => app.state.set({ brandImport: { source: 'website', url: '', file: '', deep: true } });
  const brand = brands.find((b) => b.id === s.brandId) || brands[0] || null;
  const target = s.brandTarget || 'fill';
  const colorResult = s.results['brand.applyColor'];
  const fontResult = s.results['brand.applyFont'];
  const sel = s.ctx ? (s.ctx.layers || []) : [];
  const selProps = s.ctx ? (s.ctx.properties || []).filter((p) => p.valueType === 'COLOR').length : 0;
  const texts = sel.filter((l) => l.type === 'text').length;

  const head = h('div', { class: 'pad brand-head' },
    h('select', { 'aria-label': 'Client', onchange: (e) => app.state.set({ brandId: e.target.value }) },
      brands.length ? brands.map((b) => h('option', { value: b.id, selected: brand && b.id === brand.id }, b.name)) : h('option', {}, 'No clients yet')),
    h('button', { class: 'btn sm bi-start', 'data-key': 'bi-start', title: 'Paste the client website or choose their brand book PDF — colours, fonts, tone and rules filled in for you', onclick: startImport }, icon('sparkles', 'sm'), 'From website / PDF'),
    h('button', { class: 'icon-btn', title: 'New client (by hand)', 'aria-label': 'New client by hand', onclick: () => app.state.set({ brandEdit: { name: '', colors: [], fonts: { arabic: null, english: null, extra: [] }, notes: '' } }) }, icon('plus', 'sm')),
    brand ? h('button', { class: 'icon-btn', title: 'Edit client', onclick: () => app.state.set({ brandEdit: JSON.parse(JSON.stringify(brand)) }) }, icon('edit', 'sm')) : null,
    h('button', { class: 'icon-btn', title: 'Copy all clients as JSON (backup / share)', onclick: () => app.copy(app.services.brands.exportJSON()) }, icon('copy', 'sm')),
    h('button', { class: 'icon-btn', title: 'Import clients from JSON', onclick: async () => {
      const text = await app.dialog({ title: 'Import clients', body: 'Paste exported JSON', input: '', okLabel: 'Import' });
      if (!text) return;
      const r = app.services.brands.importJSON(text);
      app.toast(r.ok ? `Imported ${r.imported} client(s)` : r.errors.join(' · '), 4000);
      app.render();
    } }, icon('upload', 'sm')),
    brand ? h('button', { class: 'icon-btn danger', title: 'Delete client', onclick: async () => { if (await app.dialog({ title: `Delete ${brand.name}?`, okLabel: 'Delete', danger: true })) { app.services.brands.remove(brand.id); app.state.set({ brandId: null }); } } }, icon('trash', 'sm')) : null);

  if (!brand) return h('div', { class: 'view' }, head, h('div', { class: 'empty' }, h('b', {}, 'Add your first client'), h('br'), 'Paste their website (or brand book PDF) and MOE fills the palette, fonts, tone and rules — or add them by hand. Then colour and style the selection in one click.',
    h('div', { class: 'actions', style: { justifyContent: 'center' } }, h('button', { class: 'btn primary', onclick: startImport }, icon('sparkles', 'sm'), 'From website / PDF'))));

  return h('div', { class: 'view' }, head,
    h('div', { class: 'section-h' }, 'Colours', h('span', { class: 'spacer' }),
      h('div', { class: 'seg mini' }, [['fill', 'Fill'], ['stroke', 'Stroke'], ['both', 'Both']].map(([v, l]) => h('button', { 'aria-pressed': String(target === v), onclick: () => app.state.set({ brandTarget: v }) }, l)))),
    h('div', { class: 'pad why', style: { marginBottom: '6px' } }, selProps ? `Applies to ${selProps} selected colour propert${selProps > 1 ? 'ies' : 'y'}` : sel.length ? `Applies to ${sel.length} selected layer${sel.length > 1 ? 's' : ''}` : 'Select layers or a colour property, then click a colour'),
    h('div', { class: 'swatch-grid pad' }, brand.colors.map((c, i) => {
      const rgb = B.hexToRgb(c.hex);
      const ink = B.contrast(rgb, [1, 1, 1]) >= 3 ? '#fff' : '#111';
      return h('button', { class: 'brand-swatch', style: { background: c.hex, color: ink }, title: `${c.name} ${c.hex}`, disabled: !sel.length || !!s.running,
        onclick: () => app.runTool('brand.applyColor', { brandId: brand.id, colorIndex: i, target }) },
      h('span', { class: 'sw-name' }, c.name), h('span', { class: 'sw-hex' }, c.hex));
    })),
    renderReport(colorResult, { onRestore: () => app.restore(colorResult.checkpointId, 'brand.applyColor'), onDismiss: () => app.clearResult('brand.applyColor') }),
    h('div', { class: 'section-h' }, 'Typography'),
    h('div', { class: 'pad' },
      [['arabic', 'Arabic', 'مرحبا'], ['english', 'English', 'Aa']].map(([role, label, sample]) => {
        const f = brand.fonts[role];
        return h('div', { class: 'list-row font-apply' },
          h('span', { class: 'font-sample', style: { fontFamily: f ? `"${f.family}"` : 'inherit' } }, sample),
          h('div', { class: 'main' }, h('div', { class: 't1' }, fontLabel(f)), h('div', { class: 't2' }, label)),
          h('button', { class: 'btn', disabled: !f || !texts || !!s.running, onclick: () => app.runTool('brand.applyFont', { brandId: brand.id, role }) }, 'Apply'));
      }),
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary', disabled: !texts || !!s.running, title: 'Arabic text gets the Arabic font (right-to-left); other text gets the English font', onclick: () => app.runTool('brand.applyFont', { brandId: brand.id, role: 'auto' }) }, `Auto fonts${texts ? ` · ${texts} text layer${texts > 1 ? 's' : ''}` : ''}`)),
      renderReport(fontResult, { onRestore: () => app.restore(fontResult.checkpointId, 'brand.applyFont'), onDismiss: () => app.clearResult('brand.applyFont') })),
    profileBlock(app, brand),
    brand.notes ? h('div', { class: 'pad' }, h('div', { class: 'section-h', style: { padding: '12px 0 4px' } }, 'Notes'), h('div', { class: 'explain bi-notes' }, brand.notes)) : null);
}

module.exports = { render };
