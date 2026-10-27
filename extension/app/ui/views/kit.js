'use strict';
/**
 * Motion Kit (v0.10) — the everyday animation tools in one compact screen, after the study in
 * docs/features/MOTION_KIT.md (Motion 4 Home + Toolbox, Flow's graph):
 *   Ease    a small value graph that shows the selected keys' curve by itself; drag a handle
 *           and the curve lands on the keys when you let go (Auto); preset chips apply on click
 *           (Shift = ease in only, Ctrl = ease out only); Easy Ease · Linear · Hold · Copy · Paste.
 *   Anchor  3 × 3 dots — click = anchor there, nothing moves; Alt-click = also place the layer
 *           at that point of the comp.
 *   Align   one row; to the selection or the comp; the whole animation moves.
 *   Tools   one click with saved defaults; right-click = options; Alt = the variant.
 * No tiles, no Apply bar, no banner: every control acts on the selection.
 */
const { h, icon } = require('../dom');
const W = require('../widgets');
const KG = require('./kitGraph');
const BZ = require('../../../features/curves/bezier');
const TM = require('../../../features/transform/math');
const BAR = require('../../../features/quick/bar');
const quickbar = require('../quickbar');
const library = require('../studio/library');

const NUMERIC = /^(OneD|TwoD|ThreeD|TwoD_SPATIAL|ThreeD_SPATIAL)$/;
const CHIPS = ['easyEase', 'outCubic', 'outExpo', 'outBack', 'inOutCubic', 'inOutExpo', 'inOutBack', 'inCubic', 'inExpo', 'snap', 'punch', 'glide', 'settle', 'swoosh', 'linear'];
const ALIGN = [['left', 'alignLeft', 'Align left'], ['hcenter', 'alignCenter', 'Align centres ↔'], ['right', 'alignRight', 'Align right'], ['top', 'alignTop', 'Align top'], ['vcenter', 'alignMiddle', 'Align middles ↕'], ['bottom', 'alignBottom', 'Align bottom'], ['distH', 'distribute', 'Distribute ↔ (3+ layers)'], ['distV', 'distributeV', 'Distribute ↕ (3+ layers)']];
const ORDER = ['tl', 't', 'tr', 'l', 'c', 'r', 'bl', 'b', 'br'];
const CHIP_LABEL = { easyEase: 'Easy', inOutCubic: 'InOut Cub', inOutExpo: 'InOut Exp', inOutBack: 'InOut Back', outCubic: 'Out Cubic' };
const DEFAULT_CURVE = BZ.normalize(BZ.PRESETS.find((p) => p.id === 'easyEase'));

/* Transient kit state (one panel = one kit). The graph keeps its curve between renders. */
const K = { curve: Object.assign({}, DEFAULT_CURVE), ghost: null, sig: null, src: null, reading: false, lib: false, libTag: 'All', graph: null };

/** Tools pinned to Home (Motion 4 "Pin Tools"); edited in the Toolbox. */
const DEFAULT_PINS = ['parentNull', 'k_parent', 'k_excite', 'k_jump', 'k_wiggle', 'k_stare', 'k_trimKeys', 'k_trash'];
const prefs = (app) => Object.assign({ auto: true, side: 'both', to: 'selection', masks: false, link: false, clip: null, pins: DEFAULT_PINS, graph: 'value', graphH: 150 }, app.services.settings.get().ui.kit || {});
const setPref = (app, patch) => { app.services.settings.update({ ui: { kit: Object.assign(prefs(app), patch) } }); app.render(); };
const r3 = (v) => Math.round(v * 1000) / 1000;
const ctxOf = (app) => app.state.get().ctx;

/** First property with 2+ selected numeric keys (what the graph reads and the curve applies to). */
function keyed(ctx) { return ((ctx && ctx.properties) || []).filter((p) => (p.selectedKeys || []).length >= 2 && NUMERIC.test(p.valueType)); }
function selectedKeyCount(ctx) { return ((ctx && ctx.properties) || []).reduce((n, p) => n + (p.selectedKeys || []).length, 0); }

/** Nearest preset (within 0.02 on every handle) — lit in the chip row, like Flow's Read. */
function matchPreset(cv, user) {
  const all = BZ.PRESETS.concat(user || []);
  const n = (p) => BZ.normalize(p);
  return (all.find((p) => ['x1', 'y1', 'x2', 'y2'].every((k) => Math.abs(n(p)[k] - cv[k]) <= 0.02)) || {}).id || null;
}
const userCurves = (app) => app.services.store.get('kit-curves', []);

/** Read the curve of the selected keys whenever the key selection changes (no button needed). */
function autoRead(app, force) {
  const ctx = ctxOf(app);
  const p = keyed(ctx)[0];
  const sig = p ? JSON.stringify([p.address.layerId, p.address.matchNames, p.selectedKeys]) : '';
  if (!force && sig === K.sig) return;
  K.sig = sig;
  if (!p) { K.src = null; return; }
  const keys = [...new Set(p.selectedKeys)].sort((a, b) => a - b).slice(0, 2);
  const layer = ((ctx.layers || []).find((l) => l.id === p.address.layerId) || {}).name || 'Layer';
  setTimeout(async () => {
    if (K.reading || app.services.executor.running) { K.sig = null; return; }
    K.reading = true;
    try {
      const r = await app.services.host.call('keyframes.read', { compId: ctx.comp.id, targets: [{ address: p.address, keys }] });
      const [ka, kb] = r.targets[0].keys;
      const va = [].concat(ka.value), vb = [].concat(kb.value);
      const got = BZ.fromTemporal(ka.easeOut, kb.easeIn, { dt: kb.time - ka.time, dv: vb.map((v, d) => v - va[d]), spatial: /_SPATIAL$/.test(p.valueType) });
      K.ghost = null;
      if (ka.outInterp === 'HOLD') K.src = `${layer} › ${p.name}: hold`;
      else if (ka.outInterp === 'LINEAR' && kb.inInterp === 'LINEAR') { K.curve = BZ.normalize({ x1: 0.333, y1: 0.333, x2: 0.667, y2: 0.667 }); K.src = `${layer} › ${p.name}: linear`; }
      else { K.curve = { x1: r3(got.x1), y1: r3(got.y1), x2: r3(got.x2), y2: r3(got.y2) }; K.src = `${layer} › ${p.name} · keys ${keys.join('–')}`; }
      K.ghost = Object.assign({}, K.curve);
    } catch (e) { K.src = null; } finally { K.reading = false; app.scheduleRender(); }
  }, 0);
}

/* ---------- running (same readiness + messages as the pie and the ▶ buttons) ---------- */
function run(app, toolId, args, label) {
  return library.applyNow(app, { id: `kit-${toolId}`, label, tool: toolId, args }, null);
}
function applyCurve(app, cv, side, label) {
  K.curve = Object.assign({}, cv);
  if (!keyed(ctxOf(app)).length) { app.toast('Curve set — select two or more keyframes to apply it', 3200, 'info'); app.render(); return null; }
  // After applying, read the keys again (the line above the graph then names what is on them).
  return Promise.resolve(run(app, 'motion.easeCurve', Object.assign({}, BZ.normalize(cv), { side }), label || 'Ease Curve')).then((r) => { K.sig = null; app.scheduleRender(); return r; });
}
const sideOf = (e, p) => (e && e.shiftKey ? 'in' : e && (e.ctrlKey || e.metaKey) ? 'out' : p.side);

/* ---------- ease block ---------- */
function curveSvg(cv) {
  const pts = [];
  for (let i = 0; i <= 24; i++) { const q = BZ.point(cv, i / 24); pts.push(`${(2 + q.x * 24).toFixed(1)},${(22 - q.y * 18).toFixed(1)}`); }
  return `<svg viewBox="0 0 28 26" aria-hidden="true"><path d="M2 22H26M2 4H26" stroke="currentColor" opacity=".2" fill="none"/><polyline points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
}
function chip(app, p, active, user) {
  const pr = prefs(app);
  return h('button', {
    class: `kit-chip ${active ? 'on' : ''}`, 'data-key': `chip-${p.id}`, 'aria-pressed': String(!!active),
    title: `${p.label} — ${BZ.css(BZ.normalize(p))}\nClick: apply (${pr.side === 'both' ? 'in + out' : pr.side}) · Shift: ease in only · Ctrl: ease out only${user ? ' · Right-click: delete' : ''}`,
    onclick: (e) => applyCurve(app, BZ.normalize(p), sideOf(e, pr), p.label),
    oncontextmenu: user ? (e) => { e.preventDefault(); app.services.store.set('kit-curves', userCurves(app).filter((x) => x.id !== p.id)); app.render(); } : undefined
  }, h('span', { class: 'kit-chip-g', html: curveSvg(BZ.normalize(p)) }), h('span', { class: 'kit-chip-l' }, CHIP_LABEL[p.id] || p.label.replace(/^In-Out /, 'InOut ')));
}

function graph(app) {
  const pr = prefs(app);
  const w = KG.widget({
    get: () => K.curve, ghost: () => K.ghost, mode: pr.graph, height: pr.graphH, link: pr.link, autoApply: pr.auto,
    onCommit: (cv) => { K.curve = cv; if (pr.auto) applyCurve(app, cv, pr.side, 'Ease Curve'); else app.render(); },
    onLive: (cv) => { const el = document.querySelector('.kit-num'); if (el && document.activeElement !== el) el.value = nums(cv); },
    onHeight: (px) => setPref(app, { graphH: Math.round(px) })
  });
  K.graph = w;
  W.animated(w.canvas, (now) => w.paint(w.state.drag || w.state.nudge ? null : now));
  const num = h('input', { class: 'kit-num', value: nums(K.curve), spellcheck: 'false', 'aria-label': 'Curve numbers (cubic-bezier)', title: 'Type or paste 4 numbers or a cubic-bezier(…) — Enter applies' });
  num.addEventListener('focus', () => num.select());
  num.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const cv = KG.parseCurve(num.value);
    if (!cv) { app.toast('Type 4 numbers, e.g. 0.16, 1, 0.3, 1', 3000, 'warn'); return; }
    K.curve = cv; w.set(cv);
    if (pr.auto) applyCurve(app, cv, pr.side, 'Ease Curve'); else app.render();
  });
  const mode = (m, l, t) => h('button', { 'aria-pressed': String(pr.graph === m), title: t, onclick: () => setPref(app, { graph: m }) }, l);
  return h('div', { class: 'kit-graph-wrap' },
    w.canvas,
    h('div', { class: 'kit-gbar' },
      h('div', { class: 'kit-seg kit-gmode', role: 'group', 'aria-label': 'Graph' }, mode('value', 'Value', 'Value graph: progress over time (like CSS / Flow)'), mode('speed', 'Speed', 'Speed graph: drag a handle sideways for influence, up / down for the speed at that key (like AE\'s speed graph)')),
      w.grip,
      num));
}
const nums = (cv) => [cv.x1, cv.y1, cv.x2, cv.y2].map((v) => String(Math.round(v * 100) / 100)).join(', ');

function slider(app, label, which) {
  const pr = prefs(app);
  const cv = K.curve;
  const val = which === 'out' ? Math.round(cv.x1 * 100) : Math.round((1 - cv.x2) * 100);
  const input = h('input', { type: 'range', min: 1, max: 99, step: 1, value: val, 'aria-label': `${label} influence`, class: 'kit-range' });
  const out = h('span', { class: 'kit-range-v' }, `${val}%`);
  const set = (v) => {
    const c = K.curve;
    if (which === 'out' || pr.link) c.x1 = v / 100;
    if (which === 'in' || pr.link) c.x2 = 1 - v / 100;
    out.textContent = `${v}%`;
    if (K.graph) K.graph.set(c);
  };
  input.addEventListener('input', () => set(Number(input.value)));
  input.addEventListener('change', () => { set(Number(input.value)); if (pr.auto) applyCurve(app, K.curve, pr.side, `${label} ${input.value}%`); else app.render(); });
  return h('label', { class: 'kit-slider', title: `${label} influence — how long the ${which === 'out' ? 'first key holds back' : 'second key settles'}` }, h('span', { class: 'kit-slider-l' }, label), input, out);
}

function easeBlock(app) {
  const pr = prefs(app);
  const ctx = ctxOf(app);
  autoRead(app);
  const match = matchPreset(K.curve, userCurves(app));
  const nKeys = selectedKeyCount(ctx);
  const seg = (v, l, t) => h('button', { 'aria-pressed': String(pr.side === v), title: t, onclick: () => setPref(app, { side: v }) }, l);
  const tool = (ic, label, title, onclick, extra = {}) => h('button', Object.assign({ class: 'kit-tb', title, 'aria-label': label, onclick }, extra), icon(ic, 'sm'), h('span', {}, label));
  const chips = CHIPS.map((id) => BZ.PRESETS.find((p) => p.id === id)).filter(Boolean);
  const mine = userCurves(app);
  return h('section', { class: 'kit-block kit-ease', 'aria-label': 'Ease' },
    h('div', { class: 'kit-h' },
      h('span', { class: 'kit-t' }, 'Ease'),
      h('button', { class: `kit-src ${K.src ? '' : 'dim'}`, title: `${K.src || 'No curve read'} — click to read the selected keys again`, onclick: () => autoRead(app, true) }, K.src || (nKeys ? 'select 2+ keys on one property' : 'no keys selected')),
      match ? h('span', { class: 'kit-match', title: 'The curve matches this preset' }, `≈ ${(BZ.PRESETS.concat(userCurves(app)).find((p) => p.id === match) || {}).label || ''}`) : null,
      h('span', { class: 'spacer' }),
      h('div', { class: 'kit-seg', role: 'group', 'aria-label': 'Apply to' }, seg('in', 'In', 'Ease in only (incoming side)'), seg('both', 'Both', 'In and out'), seg('out', 'Out', 'Ease out only (outgoing side)')),
      h('button', { class: `icon-btn ${pr.link ? 'on' : ''}`, 'aria-pressed': String(pr.link), title: 'Mirror: the two handles move together (symmetric ease)', 'aria-label': 'Mirror handles', onclick: () => setPref(app, { link: !pr.link }) }, icon('mirror', 'sm')),
      h('button', { class: `icon-btn kit-auto ${pr.auto ? 'on' : ''}`, 'aria-pressed': String(pr.auto), title: pr.auto ? 'Auto on: graph edits land on the selected keys when you let go' : 'Auto off: shape the curve, then press Apply', 'aria-label': 'Auto apply', onclick: () => setPref(app, { auto: !pr.auto }) }, icon('kAuto', 'sm'))),
    h('div', { class: 'kit-graph-wrap' }, graph(app)),
    pr.auto ? null : h('div', { class: 'kit-row' }, h('span', { class: 'spacer' }), h('button', { class: 'btn primary sm', onclick: () => applyCurve(app, K.curve, pr.side, 'Ease Curve') }, icon('play', 'xs'), 'Apply curve')),
    h('div', { class: 'kit-sliders' }, slider(app, 'Out', 'out'), slider(app, 'In', 'in')),
    h('div', { class: 'kit-tools-row' },
      tool('easeCurve', 'Easy', 'Easy Ease (F9): speed 0, 33 % influence on both sides', () => run(app, 'motion.smartEase', { influenceIn: 33.33, influenceOut: 33.33 }, 'Easy Ease')),
      tool('kLinear', 'Linear', `Linear keys (${pr.side})`, () => run(app, 'kit.interp', { mode: 'linear', side: pr.side }, 'Linear')),
      tool('kHold', 'Hold', `Hold keys (${pr.side})`, () => run(app, 'kit.interp', { mode: 'hold', side: pr.side }, 'Hold')),
      tool('copy', 'Copy', 'Copy this curve', () => { setPref(app, { clip: Object.assign({}, K.curve) }); app.toast(`Copied ${BZ.css(K.curve)}`, 2000, 'ok'); }),
      tool('kPaste', 'Paste', pr.clip ? `Paste ${BZ.css(pr.clip)} on the selected keys` : 'Copy a curve first', () => applyCurve(app, pr.clip, pr.side, 'Paste ease'), { disabled: !pr.clip })),
    h('div', { class: 'kit-chips', role: 'toolbar', 'aria-label': 'Ease presets' },
      chips.map((p) => chip(app, p, match === p.id)),
      mine.map((p) => chip(app, p, match === p.id, true)),
      h('button', { class: 'kit-chip more', title: 'Save this curve as a preset', 'aria-label': 'Save curve', onclick: async () => {
        const name = await app.dialog({ title: 'Save curve', body: BZ.css(K.curve), input: 'My curve', okLabel: 'Save' });
        if (!name) return;
        app.services.store.set('kit-curves', userCurves(app).concat([Object.assign({ id: `u${Date.now().toString(36)}`, label: String(name).slice(0, 24), tag: 'Mine' }, K.curve)]));
        app.render();
      } }, icon('plus', 'sm')),
      h('button', { class: `kit-chip more ${K.lib ? 'on' : ''}`, 'aria-pressed': String(K.lib), title: 'All curves', 'aria-label': 'All curves', onclick: () => { K.lib = !K.lib; app.render(); } }, h('span', { class: 'kit-chip-l' }, K.lib ? 'Less' : 'All'))),
    K.lib ? h('div', { class: 'kit-lib' }, curveLibrary(app, match)) : null);
}
function curveLibrary(app, match) {
  return [
    h('div', { class: 'kit-seg wide', role: 'group', 'aria-label': 'Curve family' }, ['All', ...BZ.TAGS].map((t) => h('button', { 'aria-pressed': String(K.libTag === t), onclick: () => { K.libTag = t; app.render(); } }, t))),
    h('div', { class: 'kit-chips grid' }, BZ.PRESETS.filter((p) => K.libTag === 'All' || p.tag === K.libTag).map((p) => chip(app, p, match === p.id)), userCurves(app).filter(() => K.libTag === 'All').map((p) => chip(app, p, match === p.id, true)))];
}

/* ---------- anchor + align ---------- */
function anchorBlock(app) {
  const pr = prefs(app);
  const rd = library.readiness(app, { tool: 'transform.anchor', args: { point: 'c' } });
  return h('section', { class: 'kit-block kit-anchor', 'aria-label': 'Anchor point' },
    h('div', { class: 'kit-h' }, h('span', { class: 'kit-t' }, 'Anchor')),
    h('div', { class: `kit-dots ${rd.ok ? '' : 'off'}`, role: 'group', 'aria-label': 'Anchor point' },
      ORDER.map((p) => h('button', {
        class: 'kit-dot', 'data-key': `ap-${p}`, 'aria-label': `Anchor ${TM.POINT_LABEL[p]}`,
        title: `${TM.POINT_LABEL[p]}\nClick: anchor here (the layer does not move)\nAlt-click: also place the layer at the ${TM.POINT_LABEL[p].toLowerCase()} of the comp${rd.ok ? '' : `\n— ${rd.hint}`}`,
        onclick: (e) => run(app, 'transform.anchor', { point: p, masks: pr.masks, place: !!e.altKey }, `Anchor ${TM.POINT_LABEL[p]}${e.altKey ? ' + place' : ''}`)
      }, h('span')))),
    h('label', { class: 'kit-check', title: 'Use the layer\'s masks for the box instead of its content' }, h('input', { type: 'checkbox', checked: pr.masks, onchange: (e) => setPref(app, { masks: e.target.checked }) }), 'Masks'));
}
function alignBlock(app) {
  const pr = prefs(app);
  return h('section', { class: 'kit-block kit-align', 'aria-label': 'Align' },
    h('div', { class: 'kit-h' }, h('span', { class: 'kit-t' }, 'Align'), h('span', { class: 'spacer' }),
      h('div', { class: 'kit-seg', role: 'group', 'aria-label': 'Align to' },
        h('button', { 'aria-pressed': String(pr.to === 'selection'), title: 'Align to the selection', onclick: () => setPref(app, { to: 'selection' }) }, 'Sel'),
        h('button', { 'aria-pressed': String(pr.to === 'comp'), title: 'Align to the comp', onclick: () => setPref(app, { to: 'comp' }) }, 'Comp'))),
    h('div', { class: 'kit-align-row' }, ALIGN.map(([mode, ic, label]) => {
      const args = { mode, to: pr.to };
      const rd = library.readiness(app, { tool: 'transform.align', args });
      return h('button', { class: `kit-ib ${rd.ok ? '' : 'off'}`, 'data-key': `al-${mode}`, 'aria-label': label, title: `${label}${/^dist/.test(mode) ? '' : ` to the ${pr.to}`} — the whole animation moves${rd.ok ? '' : `\n— ${rd.hint}`}`, onclick: () => run(app, 'transform.align', args, label) }, icon(ic, 'sm'));
    })));
}

/* ---------- tools ---------- */
function toolButton(app, id, pinMode) {
  const s = app.state.get();
  const pr = prefs(app);
  const a = quickbar.ACTIONS.find((x) => x.id === id);
  if (!a) return null;
  const rd = library.readiness(app, { tool: a.tool, args: a.args });
  const alt = BAR.KIT_ALT[id];
  const pinned = pr.pins.includes(id);
  if (pinMode) {
    return h('button', { class: `kit-tool pin ${pinned ? 'on' : ''}`, 'data-key': `kp-${id}`, 'aria-pressed': String(pinned), 'aria-label': `${pinned ? 'Unpin' : 'Pin'} ${BAR.KIT_LABEL[id] || a.label}`, title: pinned ? 'On Home — click to unpin' : 'Click to pin to Home',
      onclick: () => setPref(app, { pins: pinned ? pr.pins.filter((x) => x !== id) : pr.pins.concat([id]) }) },
    icon(a.icon || 'bolt'), h('span', { class: 'kit-tool-l' }, BAR.KIT_LABEL[id] || a.label), pinned ? h('span', { class: 'kit-pin-mark' }, icon('star', 'xs')) : null);
  }
  return h('button', {
    class: `kit-tool ${rd.ok ? '' : 'off'} ${id === 'k_trash' ? 'danger' : ''}`, 'data-key': `kt-${id}`, disabled: !!s.running, 'aria-label': BAR.KIT_LABEL[id] || a.label,
    title: `${a.label}${alt ? `\nAlt-click: ${id === 'clone' ? 'mirror keys' : 'reverse order'}` : ''}\nRight-click: options${rd.ok ? '' : `\n— ${rd.hint}`}`,
    onclick: (e) => (e.altKey && alt ? quickbar.run(app, Object.assign({}, a, { args: Object.assign({}, a.args, alt) })) : rd.ok ? quickbar.run(app, a) : app.toast(`${a.label}: ${rd.hint}`, 4000, 'warn')),
    oncontextmenu: (e) => { e.preventDefault(); quickbar.openOptions(app, a); }
  }, icon(a.icon || 'bolt'), h('span', { class: 'kit-tool-l' }, BAR.KIT_LABEL[id] || a.label));
}
function toolsBlock(app, opts = {}) {
  const ids = opts.ids || BAR.KIT_TOOLS;
  return h('section', { class: `kit-block kit-toolbox ${opts.cls || ''}`, 'aria-label': opts.title || 'Tools' },
    h('div', { class: 'kit-h' }, h('span', { class: 'kit-t' }, opts.title || 'Tools'), opts.right || h('span', { class: 'kit-hint' }, 'right-click: options · Alt: variant')),
    ids.length ? h('div', { class: 'kit-grid' }, ids.map((id) => toolButton(app, id, opts.pinMode)))
      : h('div', { class: 'why kit-empty' }, 'Nothing pinned — open the Toolbox and use “Pin to Home”.'));
}

/** Docked Motion Kit panel: everything, compact. */
function render(app) {
  return h('div', { class: 'view kit' },
    easeBlock(app),
    h('div', { class: 'kit-pair' }, anchorBlock(app), alignBlock(app)),
    toolsBlock(app));
}

/** Home (Motion 4 Home): ease + anchor + align always first, then the tools you pinned. */
function homeTop(app) {
  const pr = prefs(app);
  return h('div', { class: 'kit home-kit' },
    easeBlock(app),
    h('div', { class: 'kit-pair' }, anchorBlock(app), alignBlock(app)),
    toolsBlock(app, { ids: pr.pins.filter((id) => BAR.KIT_TOOLS.includes(id)), title: 'Pinned tools', right: h('button', { class: 'btn ghost sm kit-more', title: 'All tools and the pin list (Ctrl 2)', onclick: () => app.go('kit') }, 'Toolbox', icon('chev', 'xs')) }));
}

/** Toolbox (sidebar, Ctrl 2): every tool, the pin list for Home, the whole curve library. */
function renderToolbox(app) {
  const match = matchPreset(K.curve, userCurves(app));
  return h('div', { class: 'view kit toolbox' },
    toolsBlock(app, { pinMode: K.pinMode, title: K.pinMode ? 'Pin tools to Home' : 'Tools', right: h('button', { class: `btn ${K.pinMode ? 'primary' : 'ghost'} sm`, 'aria-pressed': String(!!K.pinMode), title: K.pinMode ? 'Done' : 'Choose the tools shown on Home', onclick: () => { K.pinMode = !K.pinMode; app.render(); } }, icon('star', 'xs'), K.pinMode ? 'Done' : 'Pin to Home') }),
    h('section', { class: 'kit-block', 'aria-label': 'Curve library' },
      h('div', { class: 'kit-h' }, h('span', { class: 'kit-t' }, 'Curve library'), h('span', { class: 'kit-hint' }, 'click: apply · Shift: in · Ctrl: out')),
      curveLibrary(app, match)));
}

module.exports = { render, homeTop, renderToolbox, matchPreset, keyed, K, DEFAULT_PINS };
