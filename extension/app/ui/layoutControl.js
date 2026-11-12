'use strict';
/**
 * Style "Control" (v0.70, docs/features/CONTROL_STYLE.md) — a Control Center for motion.
 *
 * Owner (round 2 of the from-scratch concepts): "Control Center for motion — make something like it, very professional".
 *   - every square IS the tool, not a button that opens one: the Motion square plays the real move it will write
 *     (thumbs.js / animatePlan — the same keys), a tall square is a slider (drag up / down), a round one a switch;
 *   - the squares follow the selection (keys → Ease + Loop, text → Typewriter, any layers → Motion, Wiggle, Beats);
 *   - squares you switch on gather in the Mix bar at the bottom: one line says what will happen (the tools' own
 *     Tool Cards, never a second rule list) and ONE Apply runs them in order — each run is its own tool run
 *     (validate → prepare → execute → verify → checkpoint), so History lists each and Restore undoes each;
 *   - the Motion Control (graph / anchor / align) stays the one place for ease, anchor and align (NO_REPEATS);
 *   - Libraries: every page one click away, so nothing is lost in this style.
 * Right-click a square: open its full page. Double-click a square: run it alone, now.
 */
const { h, icon } = require('./dom');
const A = require('./actions');
const AE = require('./layoutAE');
const studio = require('./studio/sections');

/* ---------- the Mix: what is switched on, as plain data ---------- */
const MOVES = [['fade', 'Fade'], ['scale', 'Pop'], ['moveBT', 'Rise'], ['moveRL', 'Slide'], ['spin', 'Spin']];
const LOOPS = [['loopCycle', 'Cycle'], ['loopPingPong', 'Ping-Pong'], ['loopOffset', 'Offset']];
const DEFAULTS = {
  move: { on: false, kind: 'scale', dir: 'in', duration: 0.6, ease: 'snappy', over: true, blur: false, screen: false, stagger: 0.08 },
  wiggle: { on: false, freq: 2, amp: 30, target: 'position' },
  loop: { on: false, preset: 'loopCycle' },
  type: { on: false },
  beats: { on: false }
};
const BLUR_PX = 24;
/** v0.74: what Wiggle moves — each is the expression library's own preset (amount = its amp) */
const WIGGLES = [['position', 'Position', 'wiggle', 'px', 200], ['rotation', 'Rotation', 'wiggleRot', '°', 90], ['scale', 'Scale', 'wiggleScale', '%', 50]];
const wiggleOf = (w) => WIGGLES.find(([id]) => id === w.target) || WIGGLES[0];
/** v0.74: the numbers you set stay for next time (the switches do not — nothing is armed when the panel opens) */
const TUNE_KEY = 'cc-tune';
const MIX_KEY = 'cc-mixes';
const numbersOf = (cc) => { const out = {}; for (const k of Object.keys(cc)) { out[k] = Object.assign({}, cc[k]); delete out[k].on; } return out; };
const RISE_PX = 120;

/** The Control state (switches and numbers), defaults filled in. */
function ccOf(s) {
  const cur = (s && s.cc) || {};
  const out = {};
  for (const k of Object.keys(DEFAULTS)) out[k] = Object.assign({}, DEFAULTS[k], cur[k] || {});
  return out;
}
function setCc(app, key, patch) {
  app.state.set((s) => { const cc = ccOf(s); cc[key] = Object.assign({}, cc[key], patch); return { cc }; });
  try { app.services.store.set(TUNE_KEY, numbersOf(ccOf(app.state.get()))); } catch (e) { /* the store is optional in tests */ }
}
/** v0.74: the panel opens with your last numbers (switches off). */
function restoreTune(app) {
  const saved = app.services.store.get(TUNE_KEY, null);
  if (!saved || typeof saved !== 'object') return;
  const cc = {};
  for (const k of Object.keys(DEFAULTS)) cc[k] = Object.assign({}, DEFAULTS[k], saved[k] || {}, { on: false });
  app.state.set({ cc });
}
/** v0.74 My mixes: a Mix you use often, saved by name (its squares and numbers). Pure helpers + store. */
const mixesOf = (app) => (app.services.store.get(MIX_KEY, []) || []).filter((m) => m && m.name && m.cc).slice(0, 12);
function saveMix(app, name) {
  const cc = ccOf(app.state.get());
  const on = Object.keys(cc).filter((k) => cc[k].on);
  if (!on.length || !String(name || '').trim()) return null;
  const mix = { id: `mix_${Date.now().toString(36)}`, name: String(name).trim().slice(0, 28), cc: JSON.parse(JSON.stringify(cc)) };
  app.services.store.set(MIX_KEY, [mix].concat(mixesOf(app)).slice(0, 12));
  return mix;
}
const loadMix = (app, mix) => app.state.set({ cc: ccOf({ cc: mix.cc }) });
const removeMix = (app, id) => app.services.store.set(MIX_KEY, mixesOf(app).filter((m) => m.id !== id));

/** Which squares this selection gets (pure). */
function modulesFor(kind) {
  if (kind === 'none') return [];
  if (kind === 'keys') return ['control', 'loop', 'wiggle'];
  const m = ['move', 'wiggle'];
  if (kind === 'text') m.push('type');
  m.push('beats');
  return m;
}

/** The runs the Mix will make, in order (pure, tested): motion first, then what rides on it. */
function plan(cc, kind, nLayers) {
  const mods = modulesFor(kind);
  const runs = [];
  const m = cc.move;
  if (mods.includes('move') && m.on) {
    const name = (MOVES.find(([id]) => id === m.kind) || MOVES[0])[1];
    const many = nLayers > 1;
    runs.push({ id: 'move', label: `${name} ${m.dir === 'in' ? 'In' : 'Out'}`, tool: 'quick.animate', args: {
      kind: m.kind, dir: m.dir, duration: m.duration, ease: m.ease,
      overshoot: !!(m.over && m.dir === 'in' && m.kind !== 'fade'),
      blur: m.blur ? BLUR_PX : 0,
      distance: m.kind === 'moveBT' ? RISE_PX : 0,
      stagger: many ? m.stagger : 0,
      order: many && m.screen ? 'screen' : 'selection'
    } });
  }
  if (mods.includes('type') && cc.type.on) runs.push({ id: 'type', label: 'Typewriter', tool: 'quick.typewriter', args: {} });
  if (mods.includes('wiggle') && cc.wiggle.on) { const [, wl, preset] = wiggleOf(cc.wiggle); runs.push({ id: 'wiggle', label: `Wiggle ${wl === 'Position' ? '' : `${wl} `}${cc.wiggle.amp}`, tool: 'expressions.quick', args: { preset, freq: cc.wiggle.freq, amp: cc.wiggle.amp } }); }
  if (mods.includes('loop') && cc.loop.on) runs.push({ id: 'loop', label: `Loop ${(LOOPS.find(([id]) => id === cc.loop.preset) || LOOPS[0])[1]}`, tool: 'expressions.quick', args: { preset: cc.loop.preset } });
  if (mods.includes('beats') && cc.beats.on) runs.push({ id: 'beats', label: 'Beat Markers', tool: 'markers.beats', args: {} });
  return runs;
}

/** A run's full args: the tool's defaults under the Mix's own numbers. */
function fullArgs(app, run) {
  const tool = app.services.registry.get(run.tool);
  return Object.assign(require('../../core/schema').defaults((tool && tool.params) || {}), run.args);
}
const lib = () => require('./studio/library');
const readyOf = (app, run) => lib().readiness(app, { id: `cc-${run.id}`, label: run.label, tool: run.tool, args: fullArgs(app, run) });

/** One Apply: the runs in order; stops at the first that does not succeed (said, never silent). */
async function applyMix(app) {
  const s = app.state.get();
  const kind = A.profile(s.ctx);
  const runs = plan(ccOf(s), kind, ((s.ctx && s.ctx.layers) || []).length);
  if (!runs.length || s.running) return null;
  const done = [];
  // v0.75: the whole Mix is ONE After Effects undo group — one Ctrl+Z takes it all back (each run keeps its History entry)
  const ex = app.services.executor;
  const go = async () => {
    for (const run of runs) {
      const rd = readyOf(app, run);
      if (!rd.ok) { app.toast(`${run.label}: ${rd.hint}${done.length ? ` — done before it: ${done.join(', ')} (Ctrl+Z undoes them)` : ''}`, 5000, 'warn'); return { done, stopped: run.id }; }
      const r = await app.runTool(run.tool, fullArgs(app, run), { label: run.label });
      const ok = r && (r.status === 'success' || r.status === 'partial');
      if (!ok) { app.toast(`${run.label}: ${r ? (r.errors || r.reasons || [r.status]).join(' · ') : 'not run'}${done.length ? ` — done before it: ${done.join(', ')} (Ctrl+Z undoes them)` : ''}`, 6000, 'err'); return { done, stopped: run.id }; }
      done.push(run.label);
    }
    return null;
  };
  const stopped = ex && ex.batch && runs.length > 1 ? await ex.batch(`MOE: ${runs.map((r) => r.label).join(' + ')}`.slice(0, 110), go) : await go();
  if (stopped) return stopped;
  // switched off after it ran, so a second click never repeats it by accident; the numbers stay
  app.state.set((x) => { const cc = ccOf(x); runs.forEach((r) => { cc[r.id] = Object.assign({}, cc[r.id], { on: false }); }); return { cc }; });
  app.toast(`${done.join(' · ')}${done.length > 1 ? ' — one Ctrl+Z undoes them all' : ''}`, 3200, 'ok');
  return { done, stopped: null };
}

/** Run one square alone, now (double-click). */
async function runOne(app, run) {
  const rd = readyOf(app, run);
  if (!rd.ok) { app.toast(`${run.label}: ${rd.hint}`, 4500, 'warn'); return null; }
  const r = await app.runTool(run.tool, fullArgs(app, run), { label: run.label });
  if (r) app.toast(r.status === 'success' || r.status === 'partial' ? (r.summary || run.label) : `${run.label}: ${(r.errors || r.reasons || [r.status]).join(' · ')}`, 3000, r.status === 'success' ? 'ok' : r.status === 'partial' ? 'warn' : 'err');
  return r;
}
/** The single run a square would make if it were the only one on (for double-click). */
function soloRun(cc, kind, n, id) {
  const one = ccOf({ cc: Object.assign({}, cc, { [id]: Object.assign({}, cc[id], { on: true }) }) });
  for (const k of Object.keys(one)) if (k !== id) one[k].on = false;
  return plan(one, kind, n)[0] || null;
}

/* ---------- squares ---------- */
const pressHandlers = (app, s, kind, n, id, page) => ({
  onclick: () => setCc(app, id, { on: !ccOf(s)[id].on }),
  ondblclick: (e) => { e.preventDefault(); const r = soloRun(ccOf(s), kind, n, id); if (r) runOne(app, r); },
  oncontextmenu: page ? (e) => { e.preventDefault(); app.go(page); } : undefined
});

/** The move the Motion square plays: the matching library tile's preview recipe, with the Mix's own args. */
function moveThumb(m) {
  const dirIn = m.dir === 'in';
  const th = m.kind === 'fade' ? { k: 'fade', dir: m.dir } : m.kind === 'scale' ? { k: 'scale', dir: m.dir, over: !!m.over } : m.kind === 'spin' ? { k: 'spin', dir: m.dir }
    : m.kind === 'moveBT' ? { k: 'move', dx: 0, dy: dirIn ? 0.45 : -0.45, dir: m.dir } : { k: 'move', dx: dirIn ? 1 : -1, dy: 0, dir: m.dir };
  return th;
}
function motionSquare(app, s, kind, n, cc) {
  const m = cc.move;
  const args = plan(Object.assign({}, cc, { move: Object.assign({}, m, { on: true }) }), kind, n)[0].args;
  const th = Object.assign(moveThumb(m), { args });
  const widgets = require('./widgets');
  const thumbs = require('./studio/thumbs');
  const canvas = h('canvas', { class: 'cc-canvas', 'aria-hidden': 'true', 'data-key': `cc-move|${JSON.stringify(th)}` });
  const t0 = Date.now();
  widgets.animated(canvas, (now) => { const { c, W, H } = widgets.prep(canvas); thumbs.draw(c, W, H, now === null ? Object.assign({}, th, { still: true }) : th, now === null ? (m.dir === 'out' ? 0.6 : 1.6) : (Date.now() - t0) / 1000); });
  const name = (MOVES.find(([id]) => id === m.kind) || MOVES[0])[1];
  return h('div', { class: `cc-sq cc-hero ${m.on ? 'on' : ''}`, 'data-key': 'cc-move' },
    h('button', Object.assign({ class: 'cc-hero-hit', 'data-key': 'cc-move-hit', 'aria-pressed': String(m.on), 'aria-label': `${name} ${m.dir === 'in' ? 'In' : 'Out'} — ${m.on ? 'in the Mix' : 'add to the Mix'}`,
      title: `${name} ${m.dir === 'in' ? 'In' : 'Out'} · ${m.duration} s\nClick: add to the Mix · double-click: run it now · right-click: all motion presets` }, pressHandlers(app, s, kind, n, 'move', 'animate')),
    canvas,
    h('span', { class: 'cc-hero-cap' },
      h('span', { class: 'cc-hero-name' }, `${name} ${m.dir === 'in' ? 'In' : 'Out'}`),
      h('span', { class: 'cc-hero-sub' }, `${m.duration} s${args.stagger ? ` · stagger ${args.stagger} s` : ''}${args.blur ? ' · blur' : ''}${args.overshoot ? ' · overshoot' : ''}${m.ease === 'expo' ? ' · expo' : ''}`)),
    m.on ? h('span', { class: 'cc-on-dot', 'aria-hidden': 'true' }) : null),
    h('div', { class: 'cc-hero-opts' },
      h('div', { class: 'cc-seg cc-seg-k', role: 'radiogroup', 'aria-label': 'Move' }, MOVES.map(([id, label]) => h('button', { class: 'cc-segb', role: 'radio', 'aria-checked': String(m.kind === id), 'data-key': `cc-k-${id}`, onclick: () => setCc(app, 'move', { kind: id, on: true }) }, label))),
      h('div', { class: 'cc-seg cc-seg-io', role: 'radiogroup', 'aria-label': 'Direction' }, [['in', 'In'], ['out', 'Out']].map(([id, label]) => h('button', { class: 'cc-segb', role: 'radio', 'aria-checked': String(m.dir === id), 'data-key': `cc-d-${id}`, onclick: () => setCc(app, 'move', { dir: id, on: true }) }, label)))));
}

/** The number's own width (digits ≈ 0.62 em, '.' ≈ 0.3 em) so the unit sits right after it. */
const numWidth = (v) => Math.round(String(v).split('').reduce((w, ch) => w + (/[0-9]/.test(ch) ? 0.62 : 0.32), 0.12) * 100) / 100;

/** A tall square that is a slider: drag up / down anywhere on it (scrub.js, one commit on release). */
function sliderSquare(app, key, o) {
  const p = Math.max(0, Math.min(1, (o.value - o.min) / (o.max - o.min)));
  const input = h('input', { class: 'cc-val', 'data-fk': `cc-v-${key}`, type: 'text', inputmode: 'decimal', value: String(o.value), style: { width: `${numWidth(o.value)}em` }, 'aria-label': `${o.label}${o.unit ? ` (${o.unit})` : ''}`, disabled: !!o.disabled });
  const box = h('div', { class: `cc-sq cc-slider ${o.on ? 'on' : ''} ${o.disabled ? 'off' : ''} ${o.wide ? 'wide' : ''}`, 'data-key': `cc-sl-${key}`, style: { '--p': `${Math.round(p * 1000) / 10}%` }, title: o.disabled || o.title },
    h('span', { class: 'cc-fill', 'aria-hidden': 'true' }),
    o.toggle || null,
    h('span', { class: 'cc-num' }, input, o.unit ? h('span', { class: 'cc-unit', 'aria-hidden': 'true' }, o.unit) : null),
    h('span', { class: 'cc-sl-name' }, o.label), o.sub ? h('span', { class: 'cc-sl-sub' }, o.disabled ? o.disabledShort : o.sub) : null);
  // v0.75: while you drag, the liquid "pours" (its surface moves faster and bubbles rise) — CSS only, no host call
  let calm = null;
  const pour = (v) => { box.classList.add('pouring'); clearTimeout(calm); calm = setTimeout(() => box.classList.remove('pouring'), 700); if (v !== undefined) input.style.width = `${numWidth(v)}em`; };
  // v0.80: the whole square is the handle (it was only the number) — drag anywhere, click sets the level, double-click resets
  require('./scrub').attach(input, { axis: o.wide ? 'x' : 'y', span: o.wide ? 220 : 140, surface: o.disabled ? null : box, reset: o.reset, min: o.min, max: o.max, step: o.step, fill: box, live: pour, commit: (v) => { pour(v); o.commit(v); } });
  input.addEventListener('change', (e) => { const v = Number(String(e.target.value).replace(',', '.')); if (Number.isFinite(v)) o.commit(Math.max(o.min, Math.min(o.max, v))); });
  if (o.dbl) input.addEventListener('dblclick', (e) => { e.preventDefault(); o.dbl(); });
  return box;
}

/** A round switch. */
function roundSwitch(app, key, label, ic, on, onTap, title, disabled) {
  return h('button', { class: `cc-sq cc-round ${on ? 'on' : ''}`, 'data-key': `cc-r-${key}`, 'aria-pressed': String(!!on), disabled: !!disabled, title: disabled || title, onclick: onTap }, icon(ic, ''), h('span', {}, label));
}

/** A wide square for one job (Beats, Typewriter, Loop): click adds it to the Mix. */
function wideSquare(app, s, kind, n, id, o) {
  const on = ccOf(s)[id].on;
  return h('button', Object.assign({ class: `cc-sq cc-wide ${on ? 'on' : ''} ${o.cls || ''}`, 'data-key': `cc-w-${id}`, 'aria-pressed': String(on),
    title: `${o.title}\nClick: ${on ? 'take out of' : 'add to'} the Mix · double-click: run it now${o.page ? ' · right-click: its page' : ''}` }, pressHandlers(app, s, kind, n, id, o.page)),
  h('span', { class: 'cc-w-ic', 'aria-hidden': 'true' }, icon(o.icon, '')),
  h('span', { class: 'cc-w-t' }, h('b', {}, o.label), h('span', {}, o.sub)),
  o.art || null,
  on ? h('span', { class: 'cc-on-dot', 'aria-hidden': 'true' }) : null);
}
function wave() {
  const bars = [];
  for (let i = 0; i < 28; i++) { const beat = i % 6 === 0; bars.push(h('i', { class: beat ? 'b' : '', style: { height: `${beat ? 100 : 18 + ((i * 29) % 40)}%` } })); }
  return h('span', { class: 'cc-wave', 'aria-hidden': 'true' }, bars);
}

/* ---------- the page ---------- */
/** v0.71: one head for the selection AND the comp (the shell's context strip is not shown on Control's home). */
function selectionHead(app, s, kind) {
  const c = s.ctx;
  const ls = (c && c.layers) || [];
  const keys = c && c.comp ? (c.properties || []).reduce((t, p) => t + (p.selectedKeys || []).length, 0) : 0;
  const what = !c ? 'Reading After Effects…' : !c.comp ? (c.project ? 'No active composition' : 'No project open') : kind === 'none' ? 'Nothing selected' : kind === 'keys' ? `${keys} keys` : ls.length === 1 ? ls[0].name : `${ls.length} layers`;
  const fps = c && c.comp ? Math.round(c.comp.frameRate * 1000) / 1000 : 0;
  const sub = c && c.comp ? `${c.comp.name} · ${fps} fps${ls.length > 1 && kind !== 'keys' ? ` · ${ls.slice(0, 3).map((l) => l.name).join(', ')}${ls.length > 3 ? ` +${ls.length - 3}` : ''}` : ''}` : '';
  return h('div', { class: 'cc-head', 'data-key': 'cc-head', title: c && c.truncated ? 'Large selection: only the first part is read (see Settings › Performance)' : '' },
    h('span', { class: 'cc-stack', 'aria-hidden': 'true' }, ls.length ? ls.slice(0, 3).map((l, i) => h('i', { class: `t-${l.type || 'av'}`, style: { zIndex: String(3 - i) } })) : h('i', { class: 'none' })),
    h('span', { class: 'cc-head-t' }, h('b', {}, what), sub ? h('span', { title: sub }, sub) : null),
    s.last ? h('button', { class: 'icon-btn cc-repeat', 'data-key': 'cc-repeat', title: `Repeat “${s.last.label}” on the current selection (F4)`, 'aria-label': `Repeat ${s.last.label}`, disabled: !!s.running, onclick: () => app.repeatLast() }, icon('repeat', 'sm')) : null,
    h('button', { class: 'icon-btn', 'data-key': 'cc-refresh', title: 'Refresh selection', 'aria-label': 'Refresh selection', onclick: () => app.refreshContext(true) }, icon('refresh', 'sm')));
}

/** v0.71: every page in one row that scrolls sideways (it was a 17-button wall under the squares). */
function libraries(app) {
  const ids = studio.NAV.filter((id) => id !== 'home');
  return h('section', { class: 'cc-libs', 'data-key': 'cc-libs', 'aria-label': 'Libraries' },
    h('div', { class: 'cc-cap' }, 'Libraries'),
    h('div', { class: 'cc-lib-row' }, ids.map((id) => { const sec = studio.byId(id); return sec ? h('button', { class: 'cc-lib', 'data-key': `cc-lib-${id}`, title: `Open ${sec.label}`, onclick: () => app.go(id) }, icon(sec.icon, 'sm'), h('span', {}, sec.label)) : null; })));
}

/** v0.71: the Motion Control as a card — open for keys (it is their tool), one line you open for layers. */
function controlCard(app, s, kind) {
  const ctl = kind === 'none' ? null : AE.controlTop(app, kind);
  if (!ctl) return null;
  if (kind === 'keys') return h('div', { class: 'cc-control open', 'data-key': 'cc-control' }, ctl);
  const open = !!app.services.store.get('cc-control-open', false);
  return h('div', { class: `cc-control ${open ? 'open' : ''}`, 'data-key': 'cc-control' },
    h('button', { class: 'cc-ctl-h', 'data-key': 'cc-ctl-h', 'aria-expanded': String(open), title: open ? 'Fold the Motion Control' : 'Ease, anchor and align for the selection', onclick: () => { app.services.store.set('cc-control-open', !open); app.render(); } },
      icon('chev', `xs cc-chev ${open ? 'open' : ''}`), h('b', {}, 'Motion Control'), h('span', {}, 'Ease · Anchor · Align')),
    open ? ctl : null);
}

function squares(app, s, kind) {
  const cc = ccOf(s);
  const n = ((s.ctx && s.ctx.layers) || []).length;
  const mods = modulesFor(kind);
  const move = [], add = [];
  if (!mods.length) return { empty: h('div', { class: 'cc-empty', 'data-key': 'cc-empty' }, icon('cursor', 'lg'), h('b', {}, s.ctx && s.ctx.comp ? 'Select a layer' : 'Open a composition'), h('span', {}, 'The squares follow what you select: motion for layers, ease and loops for keys, a typewriter for text.')), move, add };
  if (mods.includes('move')) {
    const m = cc.move;
    move.push(motionSquare(app, s, kind, n, cc));
    // v0.71: everything that tunes the move is one block beside it — two tall sliders and the four switches
    move.push(h('div', { class: 'cc-tune', 'data-key': 'cc-tune' },
      sliderSquare(app, 'dur', { label: 'Duration', unit: 's', value: m.duration, min: 0.1, max: 3, step: 0.05, on: m.on, reset: DEFAULTS.move.duration, title: 'How long the move takes\nDrag anywhere on the bar · click sets the level · double-click: 0.6 s\nShift: bigger steps · Ctrl: fine · click the number to type', commit: (v) => setCc(app, 'move', { duration: v, on: true }) }),
      sliderSquare(app, 'stag', { label: 'Stagger', unit: 's', value: m.stagger, min: 0, max: 0.5, step: 0.01, on: m.on && n > 1, sub: n > 1 ? null : '2+ layers', disabled: n > 1 ? null : 'Stagger needs two or more layers', disabledShort: '2+ layers', reset: DEFAULTS.move.stagger, title: 'Delay between the layers\nDrag anywhere on the bar · click sets the level · double-click: 0.08 s\nShift: bigger steps · Ctrl: fine · click the number to type', commit: (v) => setCc(app, 'move', { stagger: v, on: true }) }),
      h('div', { class: 'cc-rounds', 'data-key': 'cc-rounds' },
        roundSwitch(app, 'blur', 'Blur', 'drop', m.blur, () => setCc(app, 'move', { blur: !m.blur, on: true }), `Comes in sharp from a ${BLUR_PX} px blur (MOE Blur, removed by Restore)`),
        roundSwitch(app, 'over', 'Overshoot', 'scaleUp', m.over && m.dir === 'in' && m.kind !== 'fade', () => setCc(app, 'move', { over: !m.over, on: true }), 'Goes a little past and settles', m.dir !== 'in' ? 'Overshoot is for moves in' : m.kind === 'fade' ? 'A fade has nothing to overshoot' : null),
        roundSwitch(app, 'expo', 'Expo', 'easeCurve', m.ease === 'expo', () => setCc(app, 'move', { ease: m.ease === 'expo' ? 'snappy' : 'expo', on: true }), 'Expo ease (fast start, long soft landing) instead of Snappy'),
        roundSwitch(app, 'screen', 'Order', 'stagger', m.screen && n > 1, () => setCc(app, 'move', { screen: !m.screen, on: true }), 'Screen order: stagger by where the layers are on screen (rows, left → right)', n > 1 ? null : 'Screen order needs two or more layers'))));
  }
  if (mods.includes('loop')) {
    const lp = cc.loop;
    add.push(h('div', { class: `cc-sq cc-wide cc-loop ${lp.on ? 'on' : ''}`, 'data-key': 'cc-w-loop' },
      h('button', Object.assign({ class: 'cc-loop-hit', 'data-key': 'cc-loop-hit', 'aria-pressed': String(lp.on), title: 'Loop the selected keys\nClick: add to the Mix · double-click: run it now · right-click: all expressions' }, pressHandlers(app, s, kind, n, 'loop', 'expressions')),
        h('span', { class: 'cc-w-ic', 'aria-hidden': 'true' }, icon('repeat', '')), h('span', { class: 'cc-w-t' }, h('b', {}, 'Loop'), h('span', {}, 'the selected keys, forever'))),
      h('div', { class: 'cc-seg', role: 'radiogroup', 'aria-label': 'Loop' }, LOOPS.map(([id, label]) => h('button', { class: 'cc-segb', role: 'radio', 'aria-checked': String(lp.preset === id), 'data-key': `cc-l-${id}`, onclick: () => setCc(app, 'loop', { preset: id, on: true }) }, label))),
      lp.on ? h('span', { class: 'cc-on-dot', 'aria-hidden': 'true' }) : null));
  }
  if (mods.includes('wiggle')) {
    const w = cc.wiggle;
    const [, wl, , unit, max] = wiggleOf(w);
    add.push(sliderSquare(app, 'wig', { wide: true, label: `Wiggle ${wl}`, unit, value: Math.min(w.amp, max), min: 0, max, step: 1, sub: `${w.freq} × a second · drag sideways`, on: w.on, title: 'How far it wiggles\nDrag sideways anywhere on the bar · click sets the level · Shift: bigger steps · Ctrl: fine\nDouble-click the number: run it alone',
      commit: (v) => setCc(app, 'wiggle', { amp: v, on: true }), dbl: () => { const r = soloRun(cc, kind, n, 'wiggle'); if (r) runOne(app, r); },
      toggle: h('span', { class: 'cc-wig-head' },
        h('span', { class: 'cc-seg cc-seg-mini', role: 'radiogroup', 'aria-label': 'Wiggle what' }, WIGGLES.map(([id, label]) => h('button', { class: 'cc-segb', role: 'radio', 'data-key': `cc-wt-${id}`, 'aria-checked': String(wiggleOf(w)[0] === id), title: `Wiggle ${label}`, onclick: () => setCc(app, 'wiggle', { target: id, amp: Math.min(w.amp, WIGGLES.find((x) => x[0] === id)[4]), on: true }) }, label.slice(0, 3)))),
        h('button', { class: `cc-mini-switch ${w.on ? 'on' : ''}`, 'data-key': 'cc-wig-on', role: 'switch', 'aria-checked': String(w.on), 'aria-label': 'Wiggle in the Mix', title: w.on ? 'In the Mix — click to take it out' : `Add Wiggle ${wl} to the Mix`, onclick: () => setCc(app, 'wiggle', { on: !w.on }) }, h('i', {}))) }));
  }
  if (mods.includes('type')) add.push(wideSquare(app, s, kind, n, 'type', { icon: 'typewriter', label: 'Typewriter', sub: 'letters appear one by one', title: 'Types the text in', page: 'text' }));
  if (mods.includes('beats')) add.push(wideSquare(app, s, kind, n, 'beats', { cls: 'cc-beats', icon: 'xPulse', label: 'Beats', sub: 'markers on the music\'s beats', art: wave(), title: 'A marker on every beat of the comp\'s sound layer (read with After Effects\' Convert Audio to Keyframes)' }));
  return { empty: null, move, add };
}

/** v0.74 My mixes: one click loads a saved Mix, double-click loads and applies it, × forgets it. */
function myMixes(app, s, kind) {
  const list = mixesOf(app);
  if (!list.length || kind === 'none') return null;
  return h('section', { class: 'cc-group cc-mixes', 'data-key': 'cc-g-mixes', 'aria-label': 'My mixes' }, h('div', { class: 'cc-cap' }, 'My mixes'),
    h('div', { class: 'cc-mix-saved' }, list.map((m) => h('span', { class: 'cc-saved', 'data-key': `cc-mx-${m.id}` },
      h('button', { class: 'cc-saved-b', title: `${m.name}\nClick: load it into the Mix · double-click: load and apply`, onclick: () => loadMix(app, m), ondblclick: (e) => { e.preventDefault(); loadMix(app, m); applyMix(app); } },
        icon('layers', 'xs'), h('span', {}, m.name)),
      h('button', { class: 'cc-chip-x', 'aria-label': `Forget ${m.name}`, title: 'Forget this mix', onclick: () => { removeMix(app, m.id); app.render(); } }, '×')))));
}

/** The Mix bar: what will happen, said by the tools' own cards, and the one Apply. */
function mixBar(app, s, kind) {
  const cc = ccOf(s);
  const runs = plan(cc, kind, ((s.ctx && s.ctx.layers) || []).length);
  if (!runs.length) {
    return h('div', { class: 'cc-mix empty', 'data-key': 'cc-mix' }, h('span', { class: 'cc-mix-dot', 'aria-hidden': 'true' }),
      h('span', { class: 'cc-mix-t' }, kind === 'none' ? 'Select layers to get the squares' : 'Tap squares to mix · double-click runs one'));
  }
  const TC = require('../../core/toolcard');
  const notReady = runs.map((r) => ({ r, rd: readyOf(app, r) })).find((x) => !x.rd.ok);
  let warn = null;
  for (const r of runs) {
    const tool = app.services.registry.get(r.tool);
    try { const c = tool && s.ctx ? TC.card(tool, fullArgs(app, r), s.ctx, app.services) : null; if (c && c.warnings && c.warnings.length) { warn = `${r.label}: ${c.warnings[0]}`; break; } } catch (e) { /* the card is a preview — never block the bar */ }
  }
  const n = ((s.ctx && s.ctx.layers) || []).length;
  return h('div', { class: `cc-mix ${notReady ? 'blocked' : ''}`, 'data-key': 'cc-mix', role: 'region', 'aria-label': 'Mix' },
    h('div', { class: 'cc-mix-chips' }, runs.map((r) => h('span', { class: 'cc-chip', 'data-key': `cc-c-${r.id}` }, r.label,
      h('button', { class: 'cc-chip-x', 'aria-label': `Take ${r.label} out of the Mix`, title: 'Take it out', onclick: () => setCc(app, r.id, { on: false }) }, '×')))),
    h('div', { class: 'cc-mix-row' },
      h('span', { class: 'cc-mix-dot', 'aria-hidden': 'true' }),
      h('span', { class: 'cc-mix-t', title: warn || 'One Ctrl+Z undoes the whole Mix; each run also has its own entry in History' }, notReady ? `${notReady.r.label}: ${notReady.rd.hint}` : warn || `${runs.length > 1 ? `${runs.length} runs` : '1 run'}${kind === 'keys' ? '' : ` · ${n} layer${n === 1 ? '' : 's'}`}`),
      h('button', { class: 'icon-btn', 'data-key': 'cc-save-mix', title: 'Save this Mix by name (My mixes)', 'aria-label': 'Save this mix', onclick: async () => { const name = await app.dialog({ title: 'Save this mix', body: runs.map((r) => r.label).join(' + '), input: runs.map((r) => r.label).join(' + ').slice(0, 28), okLabel: 'Save' }); if (name && saveMix(app, name)) { app.toast(`${name} saved — My mixes`, 2200, 'ok'); app.render(); } } }, icon('star', 'sm')),
      h('button', { class: 'btn ghost sm', 'data-key': 'cc-clear', title: 'Switch everything off (Esc)', onclick: () => app.state.set((x) => { const c2 = ccOf(x); Object.keys(c2).forEach((k) => { c2[k].on = false; }); return { cc: c2 }; }) }, 'Clear'),
      h('button', { class: 'btn primary cc-apply', 'data-key': 'cc-apply', disabled: !!(notReady || s.running), title: notReady ? notReady.rd.hint : `${runs.map((r) => r.label).join(' → ')} (Enter)`, onclick: () => applyMix(app) }, icon('play', 'sm'), 'Apply')));
}

function build(app, s, body) {
  if (!s.cc && !build.restored) { build.restored = true; setTimeout(() => restoreTune(app), 0); }
  const kind = A.profile(s.ctx);
  const q = (s.aeQ || '').trim();
  let content, title, page = 'move';
  if (q) { content = h('div', { class: 'view ae-page cc-page' }, AE.searchResults(app, q)); title = 'Search'; }
  else if (s.view === 'home' || AE.TAB_IDS.includes(s.view) || require('./workflow').STAGE_IDS.includes(s.view)) {
    title = 'Control';
    const sq = squares(app, s, kind);
    const group = (id, label, kids) => kids.length ? h('section', { class: `cc-group g-${id}`, 'data-key': `cc-g-${id}`, 'aria-label': label }, h('div', { class: 'cc-cap' }, label), h('div', { class: `cc-grid k-${kind}`, 'data-key': `cc-grid-${id}` }, kids)) : null;
    const P = require('./layoutControlPages');
    page = P.pageOf(app);
    content = page !== 'move' ? h('div', { class: `view cc-page p-${page}`, 'data-key': `cc-page-${page}` }, selectionHead(app, s, kind), P.tabs(app, s, kind), P.render(app, s, page))
      : h('div', { class: 'view cc-page', 'data-key': 'cc-page' }, selectionHead(app, s, kind), P.tabs(app, s, kind),
      sq.empty ? h('div', { class: 'cc-grid', 'data-key': 'cc-grid-none' }, sq.empty) : null,
      kind === 'keys' ? h('section', { class: 'cc-group', 'data-key': 'cc-g-keys', 'aria-label': 'Keys' }, h('div', { class: 'cc-cap' }, 'Keys'), controlCard(app, s, kind)) : null,
      group('move', 'Move', sq.move), group('add', 'Add', sq.add),
      myMixes(app, s, kind), kind === 'keys' ? null : controlCard(app, s, kind), libraries(app));
  } else {
    const sec = studio.byId(s.view);
    title = (sec || { label: s.view.charAt(0).toUpperCase() + s.view.slice(1) }).label;
    content = [h('div', { class: 'lay-crumb ae-crumb cc-crumb', 'data-key': `crumb-${s.view}` }, h('button', { class: 'btn ghost sm', onclick: () => app.go('home') }, icon('chev', 'xs'), 'Control'),
      h('span', { class: 'lay-crumb-sep' }, '›'), h('span', {}, title)), body(s.view)];
  }
  const home = !q && (s.view === 'home' || AE.TAB_IDS.includes(s.view) || require('./workflow').STAGE_IDS.includes(s.view));
  // v0.71: on the home the search is an icon in the header (Ctrl+K) and the comp line lives in the head — the squares start higher
  const search = h('button', { class: 'icon-btn cc-search', 'data-key': 'cc-search', title: 'Search tools & presets (Ctrl+K)', 'aria-label': 'Search tools and presets', onclick: () => require('./palette').open(app) }, icon('search', 'sm'));
  return { top: home ? [require('./quickbar').strip(app)] : [require('./quickbar').strip(app), AE.searchBox(app, s)], title, titleExtra: home ? search : null, hideCtx: home && !s.hostError,
    content, bottom: !home ? null : page === 'move' ? mixBar(app, s, kind) : require('./layoutControlPages').pickBar(app, s, page), overlay: s.aeMenu ? AE.panelMenu(app, s) : null, menuBtn: AE.menuButton(app, s) };
}

module.exports = { build, plan, modulesFor, ccOf, soloRun, applyMix, MOVES, LOOPS, DEFAULTS, BLUR_PX, WIGGLES, numbersOf, saveMix, mixesOf, loadMix, removeMix, restoreTune, TUNE_KEY, MIX_KEY };
