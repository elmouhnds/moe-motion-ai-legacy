'use strict';
/**
 * Smart Kits (v0.76, owner: "ideas that are not only what already exists"). Three things a kit can now do, all made of
 * EXISTING one-click refs (app/ui/kits.js) — never a new tool or a second engine:
 *  · Recipes — a named chain of a kit's own tools, run in order through actions.resolve (readiness before every step),
 *    as ONE After Effects undo group (executor.batch). It stops at the first step that is not ready or fails and says
 *    what ran before it — the same contract as Control's Mix.
 *  · Progress — a step is ticked when one of its tools ran here (session memory: what you did, not what the comp holds).
 *  · Working in — pin one kit; every style's Home then shows its next step as one slim strip.
 */
const { h, icon } = require('./dom');
const K = require('./kits');
const A = require('./actions');

const FOCUS_KEY = 'kit-focus';
const okOf = (r) => !!r && (r.status === 'success' || r.status === 'partial');
const doneOf = (s, kitId) => ((s.kitDone || {})[kitId]) || {};

function mark(app, kitId, refs) {
  app.state.set((s) => {
    const all = Object.assign({}, s.kitDone);
    all[kitId] = Object.assign({}, all[kitId]);
    refs.forEach((r) => { all[kitId][r] = true; });
    return { kitDone: all };
  });
}

/** Run one kit tool (click): readiness first; a run that worked ticks its step. */
async function runRef(app, kit, ref, e) {
  const a = A.resolve(ref);
  if (!a) return null;
  const rd = a.ready(app);
  if (!rd.ok && !a.nav) { app.toast(`${a.label}: ${rd.hint}`, 4500, 'warn'); return null; }
  const r = await a.run(app, e);
  if (!a.nav && okOf(r)) mark(app, kit.id, [ref]);
  return r;
}

/** Run a recipe: its refs in order, one undo group; → { done[], stopped } (stopped = the label it stopped at, or null). */
async function runRecipe(app, kit, rec) {
  if (app.state.get().running) return null;
  const done = [], ran = [];
  const before = () => (done.length ? ` — done before it: ${done.join(', ')} (one Ctrl+Z undoes them)` : '');
  const go = async () => {
    for (const ref of rec.refs) {
      const a = A.resolve(ref);
      if (!a) return { done, stopped: ref };
      const rd = a.ready(app);
      if (!rd.ok) { app.toast(`${rec.label} stopped at ${a.label}: ${rd.hint}${before()}`, 6000, 'warn'); return { done, stopped: a.label }; }
      const r = await a.run(app);
      if (!okOf(r)) { app.toast(`${rec.label} stopped at ${a.label}${before()}`, 6000, 'err'); return { done, stopped: a.label }; }
      done.push(a.label); ran.push(ref);
    }
    return { done, stopped: null };
  };
  const ex = app.services.executor;
  const out = ex && ex.batch && rec.refs.length > 1 ? await ex.batch(`MOE: ${rec.label}`, go) : await go();
  if (ran.length) mark(app, kit.id, ran);
  if (out && !out.stopped) app.toast(`${rec.label}: ${done.join(' → ')} — one Ctrl+Z undoes it all`, 3600, 'ok');
  return out;
}

const focusId = (app) => { const id = app.services.store.get(FOCUS_KEY, null); return K.byId(id) ? id : null; };
function setFocus(app, id) { app.services.store.set(FOCUS_KEY, id || null); app.render(); }

/** The "Working in" strip (every style's Home): the pinned kit, its step dots, and the next step's tools. */
function focusStrip(app, s) {
  const kit = K.byId(focusId(app));
  if (!kit || s.view !== 'home') return null;
  const pg = K.progress(kit, doneOf(s, kit.id));
  const at = pg.next < 0 ? kit.steps.length - 1 : pg.next;
  const step = kit.steps[at];
  const open = () => { app.state.set({ kitId: kit.id }); app.go('kits'); };
  return h('div', { class: 'kf', 'data-key': 'kit-focus', style: { '--k1': kit.accent[0], '--k2': kit.accent[1] }, role: 'group', 'aria-label': `Working in ${kit.label}` },
    h('button', { class: 'kf-kit', 'data-key': 'kf-open', title: `Working in ${kit.label} — open the whole kit`, onclick: open },
      h('span', { class: 'kf-ic', 'aria-hidden': 'true' }, icon(kit.icon, 'sm')),
      h('span', { class: 'kf-t' }, h('b', {}, kit.label), h('i', {}, pg.next < 0 ? 'Every step touched' : step.label.replace(/^\d+ · /, 'Next · ')))),
    h('span', { class: 'kf-dots', 'aria-hidden': 'true' }, pg.steps.map((d, i) => h('i', { class: `${d ? 'on' : ''} ${i === at ? 'at' : ''}` }))),
    h('div', { class: 'kf-tools' }, step.refs.slice(0, 6).map((ref) => {
      const a = A.resolve(ref);
      if (!a) return null;
      const rd = a.ready(app);
      return h('button', { class: `kf-tool ${rd.ok || a.nav ? '' : 'off'}`, 'data-key': `kf-${ref}`, title: `${a.label}${rd.ok || a.nav ? '' : ` — ${rd.hint}`}`, onclick: (e) => runRef(app, kit, ref, e) }, icon(a.icon || 'bolt', 'sm'), h('span', {}, a.label));
    })),
    h('button', { class: 'icon-btn kf-x', 'data-key': 'kf-x', title: 'Stop working in this kit (the kit stays in Design › Style Kits)', 'aria-label': 'Stop working in this kit', onclick: () => setFocus(app, null) }, icon('x', 'sm')));
}

module.exports = { FOCUS_KEY, runRef, runRecipe, focusId, setFocus, focusStrip, doneOf, mark };
