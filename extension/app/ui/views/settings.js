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
  const seenBanners = app.services.store.get('banners-seen', []);
  const hiddenSections = st.ui.hiddenSections || [];
  const studio = require('../studio/sections');
  const presets = app.services.presets.list();

  return h('div', { class: 'view' },
    updatesSection(app, st),
    h('div', { class: 'section-h' }, 'Appearance'),
    h('div', { class: 'set-group' },
      h('div', { class: 'field', title: 'Bento (default): one page, tile size = importance · Glass: four spaces by stage of work · MOE: AE-named tabs with every shortcut in a sidebar (docs/features/STYLES_V2.md)' }, h('label', {}, 'Panel style'),
        seg([['bento', 'Bento'], ['glass', 'Glass'], ['moe', 'MOE']], require('../layouts').layoutOf(app), (v) => { app.services.settings.update({ ui: { layout: v } }); app.state.set({ layMenu: null, view: 'home' }); app.render(); })),
      require('../layouts').layoutOf(app) === 'glass' ? h('div', { class: 'field', title: 'The frosted blur behind the Glass bar, Now card and menus. Turn it off if After Effects feels slower.' }, h('label', {}, 'Glass blur'),
        seg([['on', 'On'], ['off', 'Off']], st.ui.glassBlur === false ? 'off' : 'on', (v) => updUi({ glassBlur: v === 'on' }))) : null,
      h('div', { class: 'field' }, h('label', {}, 'Theme'), seg(theme.THEMES, st.ui.theme || 'auto', (v) => updUi({ theme: v }))),
      h('div', { class: 'field' }, h('label', {}, 'Accent'), h('div', { class: 'accent-row', role: 'radiogroup', 'aria-label': 'Accent colour' },
        theme.ACCENTS.map(([id, label, hex]) => h('button', { class: `accent-sw ${(st.ui.accent || 'tomato') === id ? 'on' : ''}`, role: 'radio', 'aria-checked': String((st.ui.accent || 'tomato') === id), title: label, 'aria-label': label, style: { background: hex }, onclick: () => updUi({ accent: id }) })))),
      h('div', { class: 'field' }, h('label', {}, 'Motion'), seg([['calm', 'Calm'], ['full', 'Full'], ['reduced', 'Off']], st.ui.motion || 'calm', (v) => updUi({ motion: v }))),
      h('div', { class: 'field' }, h('label', {}, 'Headings'), seg([['display', 'Sora'], ['system', 'System']], st.ui.headings || 'display', (v) => updUi({ headings: v }))),
      h('div', { class: 'field' }, h('label', {}, 'Section banners'), h('button', { class: 'toggle', role: 'switch', 'aria-checked': String(st.ui.banners !== false), onclick: () => updUi({ banners: st.ui.banners === false }) }),
        hiddenBanners.length || seenBanners.length ? h('button', { class: 'btn ghost', title: 'Show every section intro in full again', onclick: () => { app.services.store.set('banners-hidden', []); app.services.store.set('banners-seen', []); app.toast('Section intros will show in full again', 2200, 'ok'); app.render(); } }, 'Show intros again') : null),
      h('div', { class: 'field' }, h('label', {}, 'Tiles'), seg([['auto', 'Auto'], ['comfortable', 'Large'], ['compact', 'Compact']], st.ui.tiles || 'auto', (v) => { app.services.settings.update({ ui: { tiles: v } }); app.applyDensity(); app.render(); })),
      h('div', { class: 'field' }, h('label', {}, 'Splash on start'), h('button', { class: 'toggle', role: 'switch', 'aria-checked': String(st.ui.splash !== false), onclick: () => updUi({ splash: st.ui.splash === false }) }))),

    pieSection(app, st),

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
/* ---------- Pie menu (v0.8) ---------- */
const SLOT_NAMES = ['1 · N', '2 · NE', '3 · E', '4 · SE', '5 · S', '6 · SW', '7 · W', '8 · NW'];
function pieSection(app, st) {
  const actions = require('../actions');
  const pie = Object.assign({ mode: 'smart', mine: [], holdQ: true, rightHold: true }, st.ui.pie);
  const setPie = (patch) => { app.services.settings.update({ ui: { pie: Object.assign({}, pie, patch) } }); app.render(); };
  const cat = actions.catalog();
  const groups = [...new Set(cat.map((c) => c.group))];
  const mine = Array.from({ length: 8 }, (_, i) => pie.mine[i] || '');
  return [
    h('div', { class: 'section-h' }, 'Pie menu'),
    h('div', { class: 'set-group' },
      h('div', { class: 'why', style: { marginBottom: '6px' } }, 'Hold Q (or the right mouse button) over the panel, point toward an action and release. Tap Q to keep it open; 1–8 choose; the centre repeats your last change. The panel needs focus — click it once.'),
      h('div', { class: 'field' }, h('label', {}, 'Slices'), seg([['smart', 'Smart'], ['mine', 'My pie']], pie.mode, (v) => setPie({ mode: v }))),
      h('div', { class: 'why', style: { margin: '-2px 0 6px 84px' } }, pie.mode === 'smart' ? 'Smart: the eight actions follow what is selected — keyframes, text, shapes, one layer, several layers or nothing.' : 'My pie: the same eight actions every time, in the order below.'),
      h('div', { class: 'field' }, h('label', {}, 'Hold Q'), h('button', { class: 'toggle', role: 'switch', 'aria-checked': String(pie.holdQ !== false), 'aria-label': 'Open the pie with the Q key', onclick: () => setPie({ holdQ: pie.holdQ === false }) })),
      h('div', { class: 'field' }, h('label', {}, 'Right hold'), h('button', { class: 'toggle', role: 'switch', 'aria-checked': String(pie.rightHold !== false), 'aria-label': 'Open the pie by holding the right mouse button', onclick: () => setPie({ rightHold: pie.rightHold === false }) })),
      pie.mode === 'mine' ? [
        h('div', { class: 'pie-slots' }, mine.map((ref, i) => h('label', {}, h('span', {}, SLOT_NAMES[i]),
          h('select', { 'aria-label': `Pie slot ${i + 1}`, onchange: (e) => { const next = mine.slice(); next[i] = e.target.value; setPie({ mine: next }); } },
            h('option', { value: '', selected: !ref }, '— empty —'),
            groups.map((g) => h('optgroup', { label: g }, cat.filter((c) => c.group === g).map((c) => h('option', { value: c.ref, selected: c.ref === ref }, c.label)))))))),
        h('div', { class: 'actions', style: { marginTop: '8px' } },
          h('button', { class: 'btn ghost', title: 'Copy the smart slices for the current selection into My pie', onclick: () => setPie({ mine: actions.slotsFor(app.state.get().ctx, { mode: 'smart' }) }) }, icon('wand', 'sm'), 'Start from the smart set'),
          h('button', { class: 'btn ghost', onclick: () => { const r = document.querySelector('.hdr-pie'); const b = r ? r.getBoundingClientRect() : { left: 200, width: 0, bottom: 100 }; app.openPie(b.left + b.width / 2, b.bottom + 140); } }, icon('pie', 'sm'), 'Try it'))] : null)];
}

/* ---------- Updates ---------- */
const KIND = {
  installer: ['Installed with the MOE installer', 'Updates replace this copy in place.'],
  'dev-link': ['Developer link (install-dev.ps1)', 'This copy follows the repository — update with git pull. The installer will unlink it.'],
  manual: ['Manual copy', 'Run the MOE installer once: it replaces manual copies so updates stay in one place.'],
  unknown: ['Preview / unknown', '']
};

function updatesSection(app, st) {
  const u = app.state.get().update || { phase: 'idle' };
  const info = app.services.updater.installInfo();
  const [kindLabel, kindNote] = KIND[info.kind] || KIND.unknown;
  const up = st.updates || {};
  const feed = h('input', { class: 'txt', 'data-fk': 'upd-feed', placeholder: 'https://…/latest.json', value: up.feedUrl || '', spellcheck: 'false',
    onchange: (e) => { app.services.settings.update({ updates: { feedUrl: e.target.value.trim() } }); app.render(); } });
  const pct = Math.round((u.progress || 0) * 100);
  let status;
  switch (u.phase) {
    case 'checking': status = h('div', { class: 'upd-status' }, h('span', { class: 'spin' }), 'Checking…'); break;
    case 'current': status = h('div', { class: 'upd-status ok' }, icon('check', 'sm'), `You have the latest version (${app.services.version}).`); break;
    case 'available': status = h('div', { class: 'upd-card' },
      h('div', { class: 'upd-h' }, icon('gift', 'sm'), h('b', {}, `Version ${u.info.version} is available`), h('span', { class: 'why' }, `${(u.info.size / 1048576).toFixed(1)} MB`)),
      u.info.notes ? h('pre', { class: 'upd-notes' }, u.info.notes.replace(/^## .*\n/, '').replace(/^#+ /gm, '').slice(0, 1200)) : null,
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', disabled: info.kind === 'dev-link', onclick: () => app.downloadUpdate() }, icon('download', 'sm'), 'Download & verify'),
        info.kind === 'dev-link' ? h('span', { class: 'why' }, 'Developer link: use git pull') : null)); break;
    case 'downloading': status = h('div', { class: 'upd-card' }, h('div', { class: 'upd-h' }, h('span', { class: 'spin' }), h('b', {}, `Downloading ${u.info.version}… ${pct}%`)), h('div', { class: 'upd-bar' }, h('span', { style: { width: `${pct}%` } }))); break;
    case 'ready': status = h('div', { class: 'upd-card' },
      h('div', { class: 'upd-h' }, icon('check', 'sm'), h('b', {}, `${u.info.version} downloaded and verified (SHA-256)`)),
      h('div', { class: 'why' }, 'It replaces this version in place; settings, presets, clients and your API key stay.'),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => app.installUpdate('on-close') }, 'Install when I close After Effects'),
        h('button', { class: 'btn ghost', onclick: () => app.installUpdate('now') }, 'Install now…'))); break;
    case 'scheduled': status = h('div', { class: 'upd-status ok' }, icon('clock', 'sm'), `Ready: ${u.info.version} installs as soon as After Effects closes. Reopen AE to use it.`); break;
    case 'launched': status = h('div', { class: 'upd-status ok' }, icon('check', 'sm'), 'The installer is open — close After Effects when it asks.'); break;
    case 'error': status = h('div', { class: 'upd-status err' }, icon('x', 'sm'), u.error); break;
    default: status = null;
  }
  return h('div', {},
    h('div', { class: 'section-h' }, 'Updates'),
    h('div', { class: 'set-group' },
      h('div', { class: 'field' }, h('label', {}, 'Installed'), h('div', { class: 'upd-installed' }, h('b', {}, `MOE Motion AI ${app.services.version}`), h('span', { class: 'why' }, kindLabel))),
      kindNote ? h('div', { class: 'why' }, kindNote) : null,
      h('div', { class: 'field' }, h('label', {}, 'Update feed'), feed),
      h('div', { class: 'field' }, h('label', {}, 'Check on start'), h('button', { class: 'toggle', role: 'switch', 'aria-checked': String(up.autoCheck !== false), onclick: () => { app.services.settings.update({ updates: { autoCheck: up.autoCheck === false } }); app.render(); } }),
        up.lastCheck ? h('span', { class: 'why' }, `last checked ${new Date(up.lastCheck).toLocaleString()}`) : null),
      h('div', { class: 'actions', style: { marginTop: '6px' } },
        h('button', { class: 'btn', disabled: !up.feedUrl || u.phase === 'checking' || u.phase === 'downloading', onclick: () => app.checkUpdates(true) }, icon('refresh', 'sm'), 'Check now'),
        h('button', { class: 'btn ghost', disabled: info.kind === 'dev-link', onclick: () => app.installFromFile() }, icon('import', 'sm'), 'Install from file…')),
      status));
}

module.exports = { render, updatesSection };
