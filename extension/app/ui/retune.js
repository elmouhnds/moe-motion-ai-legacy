'use strict';
/**
 * Tune After (v0.79, docs/features/TUNE_AFTER.md; owner picked ideas 12 · 14 · 16): what just ran stays adjustable.
 * A slim strip under the header shows the last run's numbers (drag them), four Variations from the tool's own
 * parameters, and for Stagger a live picture of the offsets while you drag. A change is ONE commit: the run's own
 * checkpoint is restored and the tool runs again with the new numbers, inside one undo group (executor.batch) —
 * never a second engine, never a write per pixel. The strip is only for the selection the run was made on.
 */
const { h, icon } = require('./dom');
const P = require('../../features/retune/plan');

const sameSel = (a, b) => a.length === b.length && a.slice().sort().join('|') === b.slice().sort().join('|');
const okOf = (r) => !!r && (r.status === 'success' || r.status === 'partial');

/** Called by app.runTool after every run: keep what can be tuned, forget the rest (its checkpoint is stale). */
function remember(app, toolId, args, label, r, sel) {
  const tool = app.services.registry.get(toolId);
  if (!tool || !okOf(r)) return;
  const writes = (tool.permissions || []).some((p) => p !== 'read');
  if (!writes) return; // a read (Copy Motion, Select…) changes nothing: the strip stays
  const can = !!tool.restore && !!r.checkpointId && (P.tunables(tool).length > 0 || P.variations(tool, args).length > 0);
  const prev = app.state.get().tune;
  app.state.set({ tune: can ? { toolId, args: JSON.parse(JSON.stringify(args || {})), label: label || tool.name, checkpointId: r.checkpointId, sel: sel || [], vars: !!(prev && prev.vars && prev.toolId === toolId) } : null });
}

/** The tune that fits what is selected now, or null. */
function current(s) {
  const t = s.tune;
  if (!t || s.hostError || !s.ctx || !s.ctx.comp) return null;
  return sameSel(t.sel, (s.ctx.layers || []).map((l) => l.id)) ? t : null;
}

/** Restore the last run and run it again with `patch` — one undo group. → the new result, or null. */
async function retune(app, patch, name) {
  const s = app.state.get();
  const t = current(s);
  if (!t || s.running) return null;
  const args = Object.assign({}, t.args, patch);
  if (JSON.stringify(args) === JSON.stringify(t.args)) return null;
  const ex = app.services.executor;
  app.state.set({ tune: Object.assign({}, t, { show: args }) }); // v0.79.1: the strip shows the number you set while the run is redone
  const go = async () => {
    const back = await ex.restore(t.checkpointId);
    if (!back.ok) { app.toast(`${t.label}: cannot go back to before it (${(back.errors || []).join(' · ')}) — nothing was changed`, 5000, 'warn'); app.state.set({ tune: null }); return null; }
    await app.refreshContext(true);
    const r = await app.runTool(t.toolId, args, { label: t.label });
    if (!okOf(r)) app.toast(`${t.label}: ${r ? (r.errors || r.reasons || [r.status]).join(' · ') : 'not run'} — the first version was removed; Ctrl+Z brings it back`, 6000, 'err');
    return r;
  };
  const r = ex.batch ? await ex.batch(`MOE: Tune ${t.label}`, go) : await go();
  if (okOf(r)) app.toast(`${t.label}${name ? ` · ${name}` : ''} — ${r.summary || 'done'}`, 2400, 'ok');
  else if (app.state.get().tune && app.state.get().tune.show) app.state.set((x) => ({ tune: Object.assign({}, x.tune, { show: null }) }));
  return r;
}

const fmt = (p, v) => (p.type === 'integer' ? String(Math.round(v)) : String(Math.round(v * 1000) / 1000));

/** Stagger's picture: one bar per layer, pushed right by its offset (the tool's own order = index). */
function staggerBars(n, frames) {
  const count = Math.min(n, 8), span = Math.max(1, Math.abs(frames) * (count - 1));
  return h('span', { class: 'tn-stag', 'aria-hidden': 'true', 'data-n': String(count) }, Array.from({ length: count }, (_, i) => {
    const at = frames >= 0 ? i : count - 1 - i;
    return h('i', { style: { marginLeft: `${Math.round((at * Math.abs(frames) / span) * 46)}%` } });
  }));
}

function strip(app, s) {
  const t = current(s);
  if (!t) return null;
  const tool = app.services.registry.get(t.toolId);
  if (!tool) return null;
  const nums = P.tunables(tool);
  const vars = P.variations(tool, t.args);
  const isStag = t.toolId === 'motion.stagger';
  const field = (p) => {
    const shown = t.show || t.args;
    const value = shown[p.key] !== undefined ? shown[p.key] : p.default;
    const step = p.step || (p.type === 'integer' ? 1 : 0.1);
    const input = h('input', { class: 'num tn-num', type: 'number', value: fmt(p, value), step, min: p.min, max: p.max, 'aria-label': p.label, 'data-fk': `tn-${t.toolId}-${p.key}`, disabled: s.running ? 'disabled' : undefined,
      title: `${p.label}: drag sideways, ↑ ↓, or type — Shift ×10, Ctrl fine. One change = one Ctrl+Z${p.default !== undefined ? ` · double-click: ${p.default}` : ''}` });
    const commit = (n) => retune(app, { [p.key]: p.type === 'integer' ? Math.round(n) : n });
    input.addEventListener('change', (e) => { const n = Number(e.target.value); if (Number.isFinite(n)) commit(Math.min(p.max !== undefined ? p.max : n, Math.max(p.min !== undefined ? p.min : n, n))); });
    if (p.default !== undefined) input.addEventListener('dblclick', () => commit(p.default));
    require('./scrub').attach(input, { step, min: p.min, max: p.max, round: p.type === 'integer' ? Math.round : undefined, commit,
      live: isStag && p.key === 'frames' ? (v) => { const box = input.closest('.tn'); const old = box && box.querySelector('.tn-stag'); if (old) old.replaceWith(staggerBars(t.sel.length, Math.round(v))); } : undefined });
    return h('label', { class: 'tn-f' }, h('span', {}, p.label), input, p.unit ? h('i', {}, p.unit) : null);
  };
  return h('div', { class: `tn ${t.vars ? 'open' : ''}`, 'data-key': 'tune', role: 'group', 'aria-label': `Tune ${t.label}` },
    h('div', { class: 'tn-row' },
      h('span', { class: 'tn-t', title: 'What you just applied — change it here instead of Undo and Apply again' }, icon('sliders', 'sm'), h('b', {}, t.label)),
      isStag ? staggerBars(t.sel.length, t.args.frames !== undefined ? t.args.frames : 2) : null,
      h('span', { class: 'tn-fs' }, nums.map(field)),
      vars.length ? h('button', { class: `btn ghost sm tn-v ${t.vars ? 'on' : ''}`, 'data-key': 'tn-vars', 'aria-expanded': String(!!t.vars), title: 'Four takes on this, from the tool\'s own settings', onclick: () => app.state.set((x) => ({ tune: Object.assign({}, x.tune, { vars: !x.tune.vars }) })) }, 'Variations') : null,
      h('button', { class: 'icon-btn tn-x', 'data-key': 'tn-x', title: 'Done tuning (the result stays)', 'aria-label': 'Close tune', onclick: () => app.state.set({ tune: null }) }, icon('x', 'sm'))),
    t.vars && vars.length ? h('div', { class: 'tn-vars' }, vars.map((v) => variationCard(app, s, tool, t, v))) : null);
}

/** The library tile closest to these args (same tool; most equal identifying args), or null. */
function likeTile(toolId, args) {
  const studio = require('./studio/sections'); let best = null, score = -1;
  for (const sec of studio.SECTIONS) for (const tile of sec.tiles || []) {
    if (tile.tool !== toolId || !tile.thumb) continue;
    const n = ['kind', 'dir', 'preset', 'mode', 'style'].filter((k) => tile.args && tile.args[k] !== undefined && tile.args[k] === args[k]).length;
    if (n > score) { best = tile; score = n; }
  }
  return best;
}

/** A variation: the tool's real preview with those numbers when it has one, and what changes in words. */
function variationCard(app, s, tool, t, v) {
  const diff = Object.keys(v.args).filter((k) => JSON.stringify(v.args[k]) !== JSON.stringify(t.args[k])).map((k) => { const p = tool.params[k] || {}; const o = (p.options || []).find((x) => x.value === v.args[k]); const val = typeof v.args[k] === 'boolean' ? (v.args[k] ? 'on' : 'off') : o ? o.label : v.args[k]; return `${p.label || k} ${val}${p.unit && !o && typeof v.args[k] === 'number' ? ` ${p.unit}` : ''}`; });
  let thumb = null;
  try {
    // the real preview: a library tile of this tool draws from its args (animatePlan) — give it the variation's numbers
    const L = require('./studio/library'); const base = likeTile(t.toolId, v.args);
    if (base) thumb = L.thumbEl(L.tileThumb(app, Object.assign({}, base, { id: `tn-${t.toolId}-${v.id}`, label: v.label, args: Object.assign({}, base.args, v.args) })));
  } catch (e) { thumb = null; }
  return h('button', { class: 'tn-var', 'data-key': `tn-var-${v.id}`, disabled: s.running ? 'disabled' : undefined, title: `${v.label}: ${diff.join(' · ')}\nReplaces what you applied — one Ctrl+Z`, onclick: () => retune(app, v.args, v.label) },
    thumb ? h('span', { class: 'tn-var-art' }, thumb) : null, h('b', {}, v.label), h('span', {}, diff.join(' · ')));
}

module.exports = { remember, current, retune, strip, staggerBars };
