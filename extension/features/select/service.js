'use strict';
/** Selection service: reads layers, applies plans, keeps back/forward history (AE does not undo selections). */
const M = require('./matcher');

const HISTORY_LIMIT = 30;

function createSelector({ host, logger }) {
  let snapshot = null; // last layers.list result
  const history = [];
  let pos = -1;

  async function load(scope, deep) {
    snapshot = await host.call('layers.list', { scope, deep: !!deep });
    snapshot.scope = scope;
    return snapshot;
  }
  const selectedPlan = (snap) => M.plan(snap.layers, snap.layers.filter((L) => L.selected), 'replace');

  function push(entry) {
    history.splice(pos + 1);
    history.push(entry);
    if (history.length > HISTORY_LIMIT) history.shift();
    pos = history.length - 1;
  }

  /** Apply a plan, recording the selection before and after so Back/Forward work. */
  async function apply(planItems, label, scope) {
    const before = await load(scope);
    if (pos < 0 || JSON.stringify(history[pos].plan) !== JSON.stringify(selectedPlan(before))) push({ label: 'Before', plan: selectedPlan(before) });
    const res = await host.call('layers.setSelection', { items: planItems });
    const after = await load(scope);
    push({ label, plan: selectedPlan(after) });
    const total = res.comps.reduce((n, c) => n + c.selected, 0);
    logger && logger.info('select', label, { total });
    return { total, comps: res.comps.length };
  }

  async function move(dir) {
    const next = pos + dir;
    if (next < 0 || next >= history.length) return { ok: false };
    pos = next;
    await host.call('layers.setSelection', { items: history[pos].plan });
    return { ok: true, label: history[pos].label };
  }

  return {
    load, apply,
    back: () => move(-1),
    forward: () => move(1),
    get canBack() { return pos > 0; },
    get canForward() { return pos >= 0 && pos < history.length - 1; },
    get snapshot() { return snapshot; },
    compTimes: () => Object.fromEntries(((snapshot && snapshot.comps) || []).map((c) => [c.id, c.time]))
  };
}

module.exports = { createSelector };
