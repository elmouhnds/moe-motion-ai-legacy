'use strict';
/** Brand Kit: clients, palettes, fonts. Click a swatch / font to apply it to the selection. */
const { h, icon } = require('../dom');
const { renderReport } = require('../report');
const B = require('../../../features/brand/brands');

function fontLabel(f) { return f ? `${f.family || f.ps}${f.style ? ' ' + f.style : ''}` : 'Not set'; }

function fontPicker(app, current, onPick, arabicFirst) {
  const box = h('div', { class: 'font-pick' });
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
    h('button', { class: 'icon-btn', title: 'New client', onclick: () => app.state.set({ brandEdit: { name: '', colors: [], fonts: { arabic: null, english: null, extra: [] }, notes: '' } }) }, icon('plus', 'sm')),
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

  if (!brand) return h('div', { class: 'view' }, head, h('div', { class: 'empty' }, h('b', {}, 'Add your first client'), h('br'), 'Save each client’s palette and Arabic / English fonts, then colour and style the selection in one click.'));

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
    brand.notes ? h('div', { class: 'pad' }, h('div', { class: 'section-h', style: { padding: '12px 0 4px' } }, 'Notes'), h('div', { class: 'explain' }, brand.notes)) : null);
}

module.exports = { render };
