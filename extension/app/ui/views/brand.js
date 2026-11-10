'use strict';
/** Brand Kit: clients, palettes, fonts. Click a swatch / font to apply it to the selection. */
const { h, icon } = require('../dom');
const { renderReport } = require('../report');
const B = require('../../../features/brand/brands');
const K = require('../../../features/brand/kit');
const A = require('../actions');

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
      h('button', { class: 'btn primary', onclick: () => {
        const sv = app.services.brands.save(d);
        if (!sv.ok) return app.toast(sv.errors.join(' · '), 5000, 'err');
        // v0.26: the new client becomes the one you work for, and its gradients / palette become Backgrounds presets
        K.setActive(app.services.store, sv.brand.id);
        const nBg = K.saveBrandBackgrounds(app.services.presets, sv.brand);
        app.clearResult('brand.fromSource'); app.state.set({ brandImport: null, brandId: sv.brand.id });
        app.toast(`${sv.brand.name} saved${nBg ? ` · ${nBg} backgrounds in Backgrounds › Mine` : ''} — Apply brand styles the selection`, 4200, 'ok');
      } }, icon('check', 'sm'), 'Save client'),
      h('button', { class: 'btn ghost', onclick: () => { app.clearResult('brand.fromSource'); app.state.set({ brandImport: null, brandEdit: JSON.parse(JSON.stringify(d)) }); } }, icon('edit', 'sm'), 'Edit first')));
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

/* ---------- v0.73: the page, organised (owner: "full of information, not organised, not easy") ----------
 * 1 your clients as cards (palette fan + name; Example badge) + New
 * 2 the client card: its own background, name in its fonts, palette, tone — and the four actions
 * 3 tabs: Colours (click to colour the selection) · Type (fonts by script) · Guide (gradients, tone, motion, rules, notes)
 *   · Manage (edit, backup, import, examples, delete)
 */
const EX = () => require('../../../features/brand/examples');
const TABS = [['colours', 'Colours', 'palette'], ['type', 'Type', 'type'], ['motion', 'Motion', 'easeCurve'], ['guide', 'Guide', 'info'], ['manage', 'Manage', 'gear']];

function clientCards(app, s, brands, brand, startImport) {
  const newOpen = !!s.brandNew;
  const byHand = () => app.state.set({ brandNew: false, brandEdit: { name: '', colors: [], fonts: { arabic: null, english: null, extra: [] }, notes: '' } });
  return h('div', { class: 'bk-clients', 'data-key': 'bk-clients', role: 'listbox', 'aria-label': 'Clients' },
    brands.map((b) => h('button', {
      class: `bk-client ${brand && b.id === brand.id ? 'on' : ''}`, 'data-key': `bk-c-${b.id}`, role: 'option', 'aria-selected': String(!!(brand && b.id === brand.id)), title: `${b.name}${EX().isExample(b) ? ' — example client' : ''}`,
      onclick: () => { K.setActive(app.services.store, b.id); app.state.set({ brandId: b.id }); }
    }, h('span', { class: 'bk-fan', 'aria-hidden': 'true' }, b.colors.slice(0, 5).map((c) => h('i', { style: { background: c.hex } }))),
    h('span', { class: 'bk-cname' }, b.name), EX().isExample(b) ? h('span', { class: 'bk-ex' }, 'Example') : null)),
    h('div', { class: 'bk-new-wrap' },
      h('button', { class: 'bk-client bk-new', 'data-key': 'bk-new', 'aria-expanded': String(newOpen), title: 'Add a client', onclick: () => app.state.set({ brandNew: !newOpen }) }, icon('plus', ''), h('span', { class: 'bk-cname' }, 'New client')),
      newOpen ? h('div', { class: 'bk-new-menu', role: 'menu' },
        h('button', { class: 'bk-mi', role: 'menuitem', 'data-key': 'bi-start', title: 'Paste the client website or choose their brand book PDF — colours, fonts, tone and rules filled in for you', onclick: () => { app.state.set({ brandNew: false }); startImport(); } }, icon('sparkles', 'sm'), h('span', {}, h('b', {}, 'From website / PDF'), h('i', {}, 'colours, fonts, tone and rules found for you'))),
        h('button', { class: 'bk-mi', role: 'menuitem', 'data-key': 'bk-hand', onclick: byHand }, icon('edit', 'sm'), h('span', {}, h('b', {}, 'By hand'), h('i', {}, 'name, colours, two fonts')))) : null));
}

/** The client card: the brand in its own colours and fonts. */
function hero(app, s, brand) {
  const AA = require('../../../features/brand/applyAll');
  const r = AA.brandRoles(brand);
  const bg = r ? r.background.hex : '#222';
  const p = brand.profile || {};
  const grad = (p.gradients || [])[0];
  const fontCss = (f) => (f ? `"${f.family}", var(--font)` : 'var(--font)');
  return h('section', { class: 'bk-hero', 'data-key': `bk-hero-${brand.id}`, style: { background: grad && grad.stops.length > 1 ? `linear-gradient(135deg, ${grad.stops.join(', ')})` : bg, color: r ? r.text.hex : '#fff' } },
    h('div', { class: 'bk-hero-top' },
      h('span', { class: 'bk-hero-name', style: { fontFamily: fontCss(brand.fonts.english), color: r ? r.headline.hex : undefined } }, brand.name),
      EX().isExample(brand) ? h('span', { class: 'bk-ex on-hero' }, 'Example') : null),
    p.tagline ? h('div', { class: 'bk-hero-tag', style: { fontFamily: fontCss(/[؀-ۿ]/.test(p.tagline) ? brand.fonts.arabic : brand.fonts.english) } }, p.tagline) : null,
    h('div', { class: 'bk-hero-type' },
      h('span', { style: { fontFamily: fontCss(brand.fonts.english) }, title: fontLabel(brand.fonts.english) }, 'Aa'),
      h('span', { dir: 'rtl', lang: 'ar', style: { fontFamily: fontCss(brand.fonts.arabic) }, title: fontLabel(brand.fonts.arabic) }, 'أبجد')),
    h('div', { class: 'bk-hero-pal' }, brand.colors.slice(0, 8).map((c) => h('span', { class: 'bk-dot', style: { background: c.hex }, title: `${c.name} ${c.hex}${c.role ? ` · ${ROLE_LABEL[c.role] || c.role}` : ''}` }))),
    p.tone && p.tone.keywords && p.tone.keywords.length ? h('div', { class: 'bk-hero-tone' }, p.tone.keywords.slice(0, 4).map((k) => h('span', {}, k))) : null);
}

function coloursTab(app, s, brand) {
  const target = s.brandTarget || 'fill';
  const colorResult = s.results['brand.applyColor'];
  const sel = s.ctx ? (s.ctx.layers || []) : [];
  const selProps = s.ctx ? (s.ctx.properties || []).filter((p) => p.valueType === 'COLOR').length : 0;
  return [
    h('div', { class: 'bk-row' }, h('span', { class: 'bk-hint' }, selProps ? `Click a colour: ${selProps} selected colour propert${selProps > 1 ? 'ies' : 'y'}` : sel.length ? `Click a colour: ${sel.length} selected layer${sel.length > 1 ? 's' : ''}` : 'Select layers or a colour property, then click a colour'),
      h('div', { class: 'seg mini' }, [['fill', 'Fill'], ['stroke', 'Stroke'], ['both', 'Both']].map(([v, l]) => h('button', { 'aria-pressed': String(target === v), onclick: () => app.state.set({ brandTarget: v }) }, l)))),
    h('div', { class: 'bk-swatches' }, brand.colors.map((c, i) => {
      const rgb = B.hexToRgb(c.hex);
      const ink = B.contrast(rgb, [1, 1, 1]) >= 3 ? '#fff' : '#111';
      return h('button', { class: 'bk-swatch', style: { background: c.hex, color: ink }, title: `${c.name} ${c.hex}${c.usage ? ` — ${c.usage}` : ''}`, disabled: !sel.length || !!s.running,
        onclick: () => app.runTool('brand.applyColor', { brandId: brand.id, colorIndex: i, target }) },
      c.role ? h('span', { class: 'bk-role' }, ROLE_LABEL[c.role] || c.role) : null, h('span', { class: 'sw-name' }, c.name), h('span', { class: 'sw-hex' }, c.hex));
    })),
    renderReport(colorResult, { onRestore: () => app.restore(colorResult.checkpointId, 'brand.applyColor'), onDismiss: () => app.clearResult('brand.applyColor') })];
}

function typeTab(app, s, brand) {
  const fontResult = s.results['brand.applyFont'];
  const texts = (s.ctx ? (s.ctx.layers || []) : []).filter((l) => l.type === 'text').length;
  const p = brand.profile || {};
  const missing = (p.fonts || []).filter((f) => !f.installed);
  return [
    [['arabic', 'Arabic', 'مرحبا بكم'], ['english', 'English', 'Hello there']].map(([role, label, sample]) => {
      const f = brand.fonts[role];
      return h('div', { class: 'bk-font' },
        h('span', { class: 'bk-font-sample', dir: role === 'arabic' ? 'rtl' : 'ltr', style: { fontFamily: f ? `"${f.family}"` : 'inherit' } }, sample),
        h('span', { class: 'bk-font-meta' }, h('b', {}, fontLabel(f)), h('i', {}, label)),
        h('button', { class: 'btn sm', disabled: !f || !texts || !!s.running, title: texts ? `${label} font on the selected text` : 'Select text layers first', onclick: () => app.runTool('brand.applyFont', { brandId: brand.id, role }) }, 'Apply'));
    }),
    h('div', { class: 'actions' },
      h('button', { class: 'btn primary', disabled: !texts || !!s.running, title: 'Arabic text gets the Arabic font (right-to-left); other text gets the English font', onclick: () => app.runTool('brand.applyFont', { brandId: brand.id, role: 'auto' }) }, `Auto fonts${texts ? ` · ${texts} text layer${texts > 1 ? 's' : ''}` : ''}`)),
    missing.length ? h('div', { class: 'bk-row wrap' }, h('span', { class: 'bk-hint' }, 'Fonts to install:'), missing.map((f) => f.getUrl ? h('button', { class: 'btn ghost sm', title: f.getUrl, onclick: () => openUrl(f.getUrl) }, f.family) : h('span', { class: 'chip' }, f.family))) : null,
    renderReport(fontResult, { onRestore: () => app.restore(fontResult.checkpointId, 'brand.applyFont'), onDismiss: () => app.clearResult('brand.applyFont') })];
}

/* ---------- v0.75 motion identity (owner: "edit and add Easy Ease keyframe values so the brand has a motion identity") ----------
   The brand's own Ease Out / Ease In influence (%), started from a preset or typed / dragged (scrub.js). The curve and a
   ball show the feel (hover plays it). Save stores it on the client (profile.motion.ease); Brand ease then applies exactly
   these values with Smart Ease (motion.smartEase) — the same tool as everywhere else. */
function easeY(x, o, i) {
  // cubic-bezier(o, 0, 1 - i, 1): solve x(t) by bisection, return y(t)
  const p1x = o / 100, p2x = 1 - i / 100;
  const bx = (t) => 3 * (1 - t) * (1 - t) * t * p1x + 3 * (1 - t) * t * t * p2x + t * t * t;
  const by = (t) => 3 * (1 - t) * t * t + t * t * t;
  let lo = 0, hi = 1, t = x;
  for (let k = 0; k < 30; k++) { t = (lo + hi) / 2; if (bx(t) < x) lo = t; else hi = t; }
  return by(t);
}
function curveCanvas(o, i, key) {
  const widgets = require('../widgets');
  const canvas = h('canvas', { class: 'bk-curve-c', 'aria-hidden': 'true', 'data-key': `bk-curve|${key}|${o}|${i}` });
  const t0 = Date.now();
  widgets.animated(canvas, (now) => {
    const { c, W, H } = widgets.prep(canvas);
    const css = getComputedStyle(canvas);
    const acc = css.getPropertyValue('--accent').trim() || '#ff7a59', line = css.getPropertyValue('--line-strong').trim() || 'rgba(255,255,255,.2)', txt = css.getPropertyValue('--text-3').trim() || '#999';
    const pad = 14, gw = W - pad * 2, gh = H - pad * 2 - 22;
    c.strokeStyle = line; c.lineWidth = 1; c.strokeRect(pad + 0.5, pad + 0.5, gw, gh);
    // handles
    c.strokeStyle = txt; c.beginPath(); c.moveTo(pad, pad + gh); c.lineTo(pad + gw * o / 100, pad + gh); c.moveTo(pad + gw, pad); c.lineTo(pad + gw * (1 - i / 100), pad); c.stroke();
    c.fillStyle = txt; c.beginPath(); c.arc(pad + gw * o / 100, pad + gh, 3.5, 0, 7); c.arc(pad + gw * (1 - i / 100), pad, 3.5, 0, 7); c.fill();
    // the curve
    c.strokeStyle = acc; c.lineWidth = 2.5; c.beginPath();
    for (let k = 0; k <= 60; k++) { const x = k / 60, y = easeY(x, o, i); const px = pad + gw * x, py = pad + gh - gh * y; if (k) c.lineTo(px, py); else c.moveTo(px, py); }
    c.stroke();
    // a ball that moves with this feel (hover plays it; at rest it waits at the end)
    const cyc = 1.6, tt = now === null ? 1 : Math.min(1, Math.max(0, (((Date.now() - t0) / 1000) % (cyc + 0.6)) / cyc));
    const v = easeY(tt, o, i);
    c.fillStyle = acc; c.beginPath(); c.arc(pad + gw * tt, pad + gh - gh * v, 4.5, 0, 7); c.fill();
    c.beginPath(); c.arc(pad + 8 + (gw - 16) * v, H - 11, 6, 0, 7); c.fill();
  });
  return canvas;
}
function motionTab(app, s, brand) {
  const saved = K.brandEase(brand);
  const d = s.brandEase && s.brandEase.id === brand.id ? s.brandEase : { id: brand.id, out: saved ? saved.out : 33, in: saved ? saved.in : 33 };
  const set = (patch) => app.state.set({ brandEase: Object.assign({}, d, patch) });
  const changed = !saved || saved.out !== d.out || saved.in !== d.in;
  const field = (key, label) => {
    const input = h('input', { class: 'txt bk-ease-v', 'data-fk': `bk-ease-${key}`, value: String(d[key]), 'aria-label': `${label} (%)` });
    require('../scrub').attach(input, { step: 1, min: 0.1, max: 100, commit: (v) => set({ [key]: v }) });
    input.addEventListener('change', (e) => { const v = Number(e.target.value); if (Number.isFinite(v)) set({ [key]: Math.max(0.1, Math.min(100, v)) }); });
    return h('label', { class: 'bk-ease-f' }, h('span', {}, label), input, h('i', {}, '%'));
  };
  const keysSel = s.ctx ? (s.ctx.properties || []).reduce((n, p) => n + (p.selectedKeys || []).length, 0) : 0;
  const smartArgs = Object.assign(require('../../../core/schema').defaults(require('../../../features/motion/smartEase').params), { influenceOut: d.out, influenceIn: d.in, sides: 'both' });
  return [
    h('div', { class: 'bk-row' }, h('span', { class: 'bk-hint' }, saved ? `${brand.name} moves with Ease Out ${saved.out}% · Ease In ${saved.in}% — Brand ease applies it.` : `Give ${brand.name} its own ease: start from a feel, then fine-tune.`)),
    h('div', { class: 'bk-ease-presets', role: 'radiogroup', 'aria-label': 'Start from' }, K.EASE_PRESETS.map(([id, label, o, i]) => h('button', { class: `chip-btn ${d.out === o && d.in === i ? 'on' : ''}`, 'data-key': `bk-ep-${id}`, role: 'radio', 'aria-checked': String(d.out === o && d.in === i), 'aria-pressed': String(d.out === o && d.in === i), title: `Ease Out ${o}% · Ease In ${i}%`, onclick: () => set({ out: o, in: i }) }, label))),
    h('div', { class: 'bk-ease' },
      h('div', { class: 'bk-curve', title: 'Rest the mouse here to play the feel' }, curveCanvas(d.out, d.in, brand.id)),
      h('div', { class: 'bk-ease-fields' }, field('out', 'Ease Out'), field('in', 'Ease In'))),
    h('div', { class: 'actions' },
      h('button', { class: 'btn primary sm', 'data-key': 'bk-ease-save', disabled: !changed, title: changed ? `Save as ${brand.name}'s motion identity` : 'Saved', onclick: () => { const r = app.services.brands.save(K.withEase(brand, d)); app.toast(r.ok ? `${brand.name} moves with ${d.out}% / ${d.in}% now` : r.errors.join(' · '), 2600, r.ok ? 'ok' : 'err'); app.state.set({ brandEase: null }); } }, icon('check', 'sm'), saved ? 'Save changes' : 'Save to client'),
      h('button', { class: 'btn sm', 'data-key': 'bk-ease-apply', disabled: !keysSel || !!s.running, title: keysSel ? `Ease Out ${d.out}% · Ease In ${d.in}% on ${keysSel} selected keys (Smart Ease)` : 'Select keyframes first', onclick: () => app.runTool('motion.smartEase', smartArgs, { label: `${brand.name} ease` }) }, icon('easeCurve', 'sm'), keysSel ? `Apply to ${keysSel} keys` : 'Apply to keys'),
      saved ? h('button', { class: 'btn ghost sm', 'data-key': 'bk-ease-clear', title: 'Remove the motion identity (Brand ease falls back to its easing word)', onclick: () => { app.services.brands.save(K.withEase(brand, null)); app.state.set({ brandEase: null }); } }, 'Remove') : null)];
}

function guideTab(app, brand) {
  const p = brand.profile || {};
  const blocks = [];
  if ((p.gradients || []).length) blocks.push(h('div', { class: 'bk-g' }, h('span', { class: 'bk-g-h' }, 'Gradients'), h('div', { class: 'bi-grads' }, p.gradients.map((g) => h('div', { class: 'bi-grad', title: g.name, style: { background: `linear-gradient(90deg, ${g.stops.join(', ')})` } }, h('span', {}, g.name))))));
  if (p.tone && (p.tone.keywords || []).length) blocks.push(h('div', { class: 'bk-g' }, h('span', { class: 'bk-g-h' }, 'Tone'), h('div', { class: 'bi-chips' }, p.tone.keywords.map((k) => h('span', { class: 'chip' }, k))), p.tone.description ? h('div', { class: 'bk-hint' }, p.tone.description) : null));
  if (p.motion && (p.motion.easing || p.motion.feel)) blocks.push(h('div', { class: 'bk-g' }, h('span', { class: 'bk-g-h' }, 'Motion'), h('div', { class: 'bk-hint' }, [p.motion.feel, p.motion.easing && `${p.motion.easing} ease`, p.motion.pace && `${p.motion.pace} pace`].filter(Boolean).join(' · '))));
  if ((p.rules || []).length) blocks.push(h('div', { class: 'bk-g' }, h('span', { class: 'bk-g-h' }, 'Rules'), h('ul', { class: 'bk-rules' }, p.rules.map((r) => h('li', {}, r)))));
  if (brand.notes) blocks.push(h('div', { class: 'bk-g' }, h('span', { class: 'bk-g-h' }, 'Notes'), h('div', { class: 'explain bi-notes' }, brand.notes)));
  if (p.source) blocks.push(h('div', { class: 'bk-hint' }, `From ${p.source.kind === 'pdf' ? p.source.file : p.source.url}${p.source.usedAI ? ' (Claude)' : ' (local scan)'}`));
  return blocks.length ? blocks : h('div', { class: 'bk-hint' }, 'No guide yet — import the client from their website / PDF, or write notes in Edit.');
}

function manageTab(app, brand) {
  const missing = EX().EXAMPLES.filter((x) => !app.services.brands.get(x.id)).length;
  const row = (key, ic, label, sub, onclick, cls) => h('button', { class: `bk-manage ${cls || ''}`, 'data-key': key, onclick }, icon(ic, 'sm'), h('span', {}, h('b', {}, label), h('i', {}, sub)));
  return h('div', { class: 'bk-manages' },
    row('bk-edit', 'edit', 'Edit client', 'name, colours, fonts, notes', () => app.state.set({ brandEdit: JSON.parse(JSON.stringify(brand)) })),
    row('bk-copy', 'copy', 'Copy all clients', 'as JSON — a backup, or to share', () => app.copy(app.services.brands.exportJSON())),
    row('bk-import', 'upload', 'Import clients', 'paste exported JSON', async () => {
      const text = await app.dialog({ title: 'Import clients', body: 'Paste exported JSON', input: '', okLabel: 'Import' });
      if (!text) return;
      const r = app.services.brands.importJSON(text);
      app.toast(r.ok ? `Imported ${r.imported} client(s)` : r.errors.join(' · '), 4000);
      app.render();
    }),
    missing ? row('bk-examples', 'sparkles', `Add the ${missing} example client${missing > 1 ? 's' : ''}`, 'Nile Roast · Pulse Pay · Sahara Atelier', () => { const n = EX().addMissing(app.services.brands); app.toast(`${n} example client${n === 1 ? '' : 's'} added`, 2400, 'ok'); app.render(); }) : null,
    row('bk-delete', 'trash', `Delete ${brand.name}`, 'removes this client only', async () => { if (await app.dialog({ title: `Delete ${brand.name}?`, okLabel: 'Delete', danger: true })) { app.services.brands.remove(brand.id); app.state.set({ brandId: null }); } }, 'danger'));
}

function render(app) {
  const s = app.state.get();
  // v0.73: three example clients the first time Brand opens with none (never over your own; Manage adds them back)
  try { if (EX().seedOnce(app.services.store, app.services.brands)) setTimeout(() => app.render(), 0); } catch (e) { /* the store is optional in tests */ }
  const brands = app.services.brands.list();
  if (s.brandEdit) return h('div', { class: 'view' }, editor(app, s.brandEdit));
  if (s.brandImport) return importPanel(app, s);
  const startImport = () => app.state.set({ brandImport: { source: 'website', url: '', file: '', deep: true } });
  const active = K.activeBrand(app.services.store, app.services.brands);
  const brand = brands.find((b) => b.id === s.brandId) || active || brands[0] || null;

  if (!brand) return h('div', { class: 'view bk' }, clientCards(app, s, brands, null, startImport), h('div', { class: 'empty' }, h('b', {}, 'Add your first client'), h('br'), 'Paste their website (or brand book PDF) and MOE fills the palette, fonts, tone and rules — or add them by hand. Then colour and style the selection in one click.',
    h('div', { class: 'actions', style: { justifyContent: 'center' } }, h('button', { class: 'btn primary', onclick: startImport }, icon('sparkles', 'sm'), 'From website / PDF'))));

  if (!active || active.id !== brand.id) setTimeout(() => K.setActive(app.services.store, brand.id), 0); // the client shown is the one you work for
  const act = (ref, primary) => { const a = A.resolve(ref); if (!a) return null; const rd = a.ready(app); return h('button', { class: `btn ${primary ? 'primary' : ''} sm`, 'data-key': `ba-${ref}`, disabled: !!s.running, title: rd.ok ? `${a.label} — fonts by script, colours by role (headlines, body, shapes, background)` : `${a.label} — ${rd.hint}`, onclick: () => (rd.ok ? a.run(app) : app.toast(`${a.label}: ${rd.hint}`, 4500, 'warn')) }, icon(a.icon, 'sm'), a.label); };
  const tab = TABS.some(([id]) => id === s.brandTab) ? s.brandTab : 'colours';
  return h('div', { class: 'view bk' },
    clientCards(app, s, brands, brand, startImport),
    hero(app, s, brand),
    h('div', { class: 'bk-actions', 'data-key': 'bi-use' }, act('brand:apply', true), act('brand:applyComp'), act('brand:ease'),
      h('button', { class: 'btn sm', 'data-key': 'ba-bg', title: 'Make Backgrounds presets from this client (its gradients, palette and a soft mesh) — Backgrounds › Mine', onclick: () => { const n = K.saveBrandBackgrounds(app.services.presets, brand); app.toast(n ? `${n} ${brand.name} backgrounds in Backgrounds › Mine` : `${brand.name} needs at least 2 colours`, 3500, n ? 'ok' : 'warn'); if (n) app.state.set((st) => ({ studio: Object.assign({}, st.studio, { backgrounds: Object.assign({}, (st.studio || {}).backgrounds, { filter: 'Mine' }) }) })); } }, icon('background', 'sm'), 'Make backgrounds')),
    h('nav', { class: 'bk-tabs', role: 'tablist', 'aria-label': 'Client' }, TABS.map(([id, label, ic]) => h('button', { class: `bk-tab ${tab === id ? 'on' : ''}`, role: 'tab', 'data-key': `bk-t-${id}`, 'aria-selected': String(tab === id), onclick: () => app.state.set({ brandTab: id }) }, icon(ic, 'sm'), h('span', {}, label)))),
    h('div', { class: 'bk-panel', 'data-key': `bk-p-${tab}` }, tab === 'colours' ? coloursTab(app, s, brand) : tab === 'type' ? typeTab(app, s, brand) : tab === 'motion' ? motionTab(app, s, brand) : tab === 'guide' ? guideTab(app, brand) : manageTab(app, brand)));
}

module.exports = { render };
