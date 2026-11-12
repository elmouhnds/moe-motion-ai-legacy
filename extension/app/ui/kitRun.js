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
let bound = null;
/** The shell binds the app once, so a ref ('recipe:<kit>/<id>') can find a recipe of your own (they live in the store). */
const bind = (app) => { bound = app; };

/* ---- v0.78 precheck: say what a recipe needs BEFORE anything is written ---- */
/** Tools that make what the next steps act on (a grid, split text): a later step cannot be judged before they ran. */
const PRODUCERS = ['grid.build'];
/**
 * Each step against the selection now: 'ready', 'needs' (with the tool's own hint) or 'after' (it acts on what an
 * earlier step makes — known only then). → { ok, steps[], block: { at, label, hint } | null }
 */
function precheck(app, rec) {
  let made = false, block = null;
  const steps = rec.refs.map((ref, i) => {
    const a = A.resolve(ref);
    if (!a) { if (!block) block = { at: i, label: ref, hint: 'this tool no longer exists' }; return { ref, label: ref, state: 'needs', hint: 'this tool no longer exists' }; }
    let rd; try { rd = a.ready(app); } catch (e) { rd = { ok: false, hint: e.message }; }
    const state = rd.ok ? 'ready' : made ? 'after' : 'needs';
    if (state === 'needs' && !block) block = { at: i, label: a.label, hint: rd.hint };
    if (PRODUCERS.indexOf(a.tool) >= 0) made = true;
    return { ref, label: a.label, state, hint: rd.ok ? '' : rd.hint };
  });
  return { ok: !block, steps, block };
}
const refOf = (kit, rec) => `recipe:${kit.id}/${rec.id}`;
/** 'recipe:<kit>/<id>' → { kit, rec } (built-in, or one of yours through the bound app), or null. */
function byRef(ref, app) {
  const m = /^recipe:([^/]+)\/(.+)$/.exec(ref || '');
  const kit = m && K.byId(m[1]);
  if (!kit) return null;
  const ap = app || bound;
  const rec = (kit.recipes || []).find((r) => r.id === m[2]) || (ap ? mineOf(ap, kit.id).find((r) => r.id === m[2]) : null);
  return rec ? { kit, rec } : null;
}
/** A recipe as a one-click action (actions.resolve): Ctrl+K, the pie, the Quick Bar. */
function action(ref) {
  const x = byRef(ref);
  if (!x) return null;
  return { id: ref, label: x.rec.label, icon: x.kit.icon, where: `${x.kit.label} recipe`, recipe: true,
    hint: x.rec.refs.map((r) => (A.resolve(r) || { label: r }).label).join(' → '),
    run: (app) => { const y = byRef(ref, app); return y ? runRecipe(app, y.kit, y.rec) : null; },
    ready: (app) => { const y = byRef(ref, app); if (!y) return { ok: false, hint: 'this recipe was removed' }; const pc = precheck(app, y.rec); return pc.ok ? { ok: true } : { ok: false, hint: `step ${pc.block.at + 1} · ${pc.block.label}: ${pc.block.hint}` }; } };
}
/** Every recipe as a ref (built-in + yours) — for Ctrl+K and the pie's catalogue. */
function allRefs(app) {
  const out = [];
  K.KITS.forEach((kit) => (kit.recipes || []).concat(app || bound ? mineOf(app || bound, kit.id) : []).forEach((rec) => out.push({ ref: refOf(kit, rec), label: rec.label, kit: kit.label })));
  return out;
}

/* ---- v0.78 share: your recipes as a small data file (names + refs only; re-validated on the way in) ---- */
const PACK = 'moe-recipes';
function exportMine(app) {
  const kits = {};
  K.KITS.forEach((kit) => { const m = mineOf(app, kit.id); if (m.length) kits[kit.id] = m.map((r) => ({ label: r.label, refs: r.refs })); });
  return { count: Object.keys(kits).reduce((n, k) => n + kits[k].length, 0), json: JSON.stringify({ format: PACK, version: 1, kits }, null, 1) };
}
/** Untrusted text → your list. Every recipe goes through kits.makeRecipe; nothing runs. → { imported, skipped[] } */
function importMine(app, text) {
  const skipped = []; let imported = 0, doc;
  if (typeof text !== 'string' || text.length > 200000) return { imported, skipped: ['The file is too large or not text'] };
  try { doc = JSON.parse(text); } catch (e) { return { imported, skipped: ['Not a recipe file (JSON expected)'] }; }
  if (!doc || doc.format !== PACK || !doc.kits || typeof doc.kits !== 'object') return { imported, skipped: ['Not a MOE recipe file'] };
  Object.keys(doc.kits).slice(0, 40).forEach((kitId) => {
    const kit = K.byId(kitId), list = doc.kits[kitId];
    if (!kit || !Array.isArray(list)) { skipped.push(`${String(kitId).slice(0, 30)}: unknown kit`); return; }
    list.slice(0, K.MINE_MAX).forEach((r) => {
      const mine = mineOf(app, kit.id);
      const name = r && typeof r.label === 'string' ? r.label : '';
      const refs = r && Array.isArray(r.refs) ? r.refs.filter((x) => typeof x === 'string') : [];
      if (mine.some((m) => m.refs.join('|') === refs.join('|'))) { skipped.push(`${name.slice(0, 30)}: you already have this chain`); return; }
      const made = K.makeRecipe(kit, name, refs, mine);
      if (!made.ok || !made.recipe.refs.every((x) => A.resolve(x))) { skipped.push(`${name.slice(0, 30) || 'recipe'}: ${made.ok ? 'a tool is missing' : made.error}`); return; }
      setMine(app, kit.id, mine.concat(made.recipe)); imported++;
    });
  });
  return { imported, skipped };
}

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

/* ---- v0.77 My Recipes: build a chain by clicking the kit's tools, name it, keep it (store, per kit) ---- */
const MINE_KEY = 'kit-my-recipes';
function mineOf(app, kitId) {
  const kit = K.byId(kitId); const own = kit ? K.refsOf(kit) : [];
  const all = app.services.store.get(MINE_KEY, {}) || {};
  // a saved chain whose tool is gone (renamed / removed) is not shown rather than half-run
  return (all[kitId] || []).filter((r) => r && r.label && Array.isArray(r.refs) && r.refs.length >= 2 && r.refs.every((x) => own.indexOf(x) >= 0 && A.resolve(x)));
}
function setMine(app, kitId, list) {
  const all = Object.assign({}, app.services.store.get(MINE_KEY, {}) || {});
  all[kitId] = list; app.services.store.set(MINE_KEY, all);
}
const buildOf = (s, kitId) => (s.kitBuild && s.kitBuild.kitId === kitId ? s.kitBuild.refs : null);
const startBuild = (app, kitId) => app.state.set({ kitBuild: { kitId, refs: [] } });
const cancelBuild = (app) => app.state.set({ kitBuild: null });
function toggleBuild(app, kit, ref) {
  const a = A.resolve(ref);
  if (!a || a.nav) { app.toast(`${a ? a.label : ref} opens a page — a recipe is made of tools that run`, 3200, 'warn'); return; }
  app.state.set((s) => {
    const refs = (buildOf(s, kit.id) || []).slice(); const i = refs.indexOf(ref);
    if (i >= 0) refs.splice(i, 1);
    else if (refs.length >= 4) { app.toast('A recipe is at most four tools', 2600, 'warn'); return {}; }
    else refs.push(ref);
    return { kitBuild: { kitId: kit.id, refs } };
  });
}
async function saveBuild(app, kit) {
  const refs = buildOf(app.state.get(), kit.id) || [];
  const first = K.makeRecipe(kit, 'x', refs, []);
  if (!first.ok) { app.toast(first.error, 3200, 'warn'); return null; }
  const suggested = refs.map((r) => A.resolve(r).label).slice(0, 2).join(' + ').slice(0, 32);
  const name = app.dialog ? await app.dialog({ title: 'Name your recipe', body: [refs.map((r) => A.resolve(r).label).join(' → ')], input: suggested, okLabel: 'Save' }) : suggested;
  if (name === null || name === false || name === undefined) return null;
  const mine = mineOf(app, kit.id);
  const made = K.makeRecipe(kit, typeof name === 'string' ? name : suggested, refs, mine);
  if (!made.ok) { app.toast(made.error, 3200, 'warn'); return null; }
  setMine(app, kit.id, mine.concat(made.recipe));
  app.state.set({ kitBuild: null });
  app.toast(`Saved “${made.recipe.label}” — it runs in one click, one Ctrl+Z`, 3000, 'ok');
  return made.recipe;
}
async function removeMine(app, kit, rec) {
  const ok = app.dialog ? await app.dialog({ title: `Remove “${rec.label}”?`, body: ['Only the recipe is removed — nothing in After Effects changes.'], okLabel: 'Remove', danger: true }) : true;
  if (!ok) return false;
  setMine(app, kit.id, mineOf(app, kit.id).filter((r) => r.id !== rec.id)); app.render();
  return true;
}
/** v0.77: how many of a kit's tools can run on the selection right now (the overview's "ready now"). */
function readyCount(app, kit) {
  return K.refsOf(kit).reduce((n, r) => { const a = A.resolve(r); try { return n + (a && !a.nav && a.ready(app).ok ? 1 : 0); } catch (e) { return n; } }, 0);
}

/** Run one kit tool (click): readiness first; a run that worked ticks its step. While building a recipe a click picks. */
async function runRef(app, kit, ref, e) {
  if (buildOf(app.state.get(), kit.id)) { toggleBuild(app, kit, ref); return null; }
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
  // v0.78: everything that can be known is checked first — a recipe that cannot finish does not start
  const pc = precheck(app, rec);
  if (!pc.ok) { app.toast(`${rec.label} needs ${pc.block.label}: ${pc.block.hint} (step ${pc.block.at + 1}) — nothing was changed`, 6000, 'warn'); return { done, stopped: pc.block.label }; }
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

module.exports = { bind, precheck, PRODUCERS, refOf, byRef, action, allRefs, exportMine, importMine, PACK, MINE_KEY, mineOf, buildOf, startBuild, cancelBuild, toggleBuild, saveBuild, removeMine, readyCount, FOCUS_KEY, runRef, runRecipe, focusId, setFocus, focusStrip, doneOf, mark };
