'use strict';
/**
 * Execution controller. The single path through which any tool runs —
 * whether triggered by a click, an AI plan step, or a saved recipe.
 *
 *   validate args → fresh context → requirements → permission → prepare
 *   → execute (host) → verify (read-back) → checkpoint → history
 *
 * A result is only reported as "success" when verify() confirms the host state.
 */

const { validateArgs } = require('./schema');
const contextReq = require('./context');
const { decide } = require('./permissions');
const LOCK = require('./lockpolicy');

const MAX_CHECKPOINTS = 50;

function createExecutor({ registry, host, store, logger, getSettings, services }) {
  const listeners = new Set();
  let running = false;
  let checkpoints = store.get('checkpoints', []);

  function emit(evt) { listeners.forEach((fn) => { try { fn(evt); } catch (e) { /* ignore */ } }); }

  async function readContext() {
    const s = getSettings();
    return host.call('context.get', { maxLayers: s.limits.maxLayers, maxProps: s.limits.maxProps });
  }

  function record(entry) {
    store.append('history', entry);
    store.compact('history', 1000);
    emit({ type: 'history', entry });
  }

  /* v0.63 (docs/features/PROGRESS.md): every host call of a run is a visible step — "Measuring", "Writing keys"… —
     and Stop is honoured before the next one. What a stopped run already made stays as ONE undo step (the run's
     transaction), so the panel can say exactly that: "Stopped after 3 steps — Ctrl+Z removes what was made". */
  const STEP = [
    [/^layers\.bounds|^text\.measure|measure/, 'Measuring'], [/^props\.values|^keys\.list|^layers\.describe|scan|read/, 'Reading'],
    [/^keys\./, 'Writing keys'], [/^expressions\./, 'Writing expressions'], [/^effects\./, 'Setting effects'],
    [/clone|duplicate/, 'Making copies'], [/^shapes\.|^design\.|^text\.create/, 'Drawing'], [/^layers\.create|^layers\.add/, 'Adding layers'],
    [/^bake\./, 'Baking'], [/^layers\./, 'Arranging layers'], [/^comp/, 'Building comps']
  ];
  const stepLabel = (op) => (STEP.find(([re]) => re.test(op)) || [null, 'Working'])[1];
  let stopRequested = false;
  /** The host a tool sees: counts its steps, reports them, and stops before the next one when asked. */
  function stepHost(toolId, started) {
    let step = 0;
    const h = Object.create(host);
    h.stepsDone = () => step;
    h.call = function call(op, args, opts) {
        if (stopRequested && !/^tx\./.test(op)) { const e = new Error('Stopped'); e.code = 'STOPPED'; e.steps = step; throw e; }
        step++;
        emit({ type: 'step', toolId, step, op, label: stepLabel(op), ms: Date.now() - started });
        return host.call(op, args, opts);
    };
    return h;
  }

  /** A tool writes when any of its permissions changes the project (modify.*). */
  const writes = LOCK.writes;
  /** Open / close the run's undo group. A host without tx ops (older build) still runs, one group per op. */
  async function openTx(label) {
    if (getSettings().engine && getSettings().engine.oneUndo === false) return false;
    try { await host.call('tx.begin', { label }); return true; } catch (e) { logger.warn('exec', 'tx.begin unavailable', { message: e.message }); return false; }
  }
  async function closeTx() {
    try { await host.call('tx.end', {}); } catch (e) { logger.error('exec', 'tx.end failed', { message: e.message }); }
  }

  function saveCheckpoint(tool, data, label) {
    const cp = { id: `cp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, toolId: tool.id, label, t: new Date().toISOString(), data, restored: false };
    checkpoints.push(cp);
    if (checkpoints.length > MAX_CHECKPOINTS) checkpoints = checkpoints.slice(-MAX_CHECKPOINTS);
    store.set('checkpoints', checkpoints);
    return cp.id;
  }

  /** Check without executing: used by the UI and the AI plan validator. */
  async function check(toolId, args, { origin = 'user', ctx } = {}) {
    const tool = registry.get(toolId);
    if (!tool) return { ok: false, stage: 'lookup', errors: [`Unknown tool "${toolId}"`] };
    const v = validateArgs(tool.params || {}, args);
    if (!v.ok) return { ok: false, stage: 'validate', errors: v.errors, tool };
    // v0.61 (ENGINE2.md): locked layers never reach a tool that writes — the same rule the panel shows (lockpolicy.js)
    const lp = LOCK.apply(tool, ctx || (await readContext()));
    const context = lp.ctx, lockedSkipped = lp.skipped;
    if (lp.error) return { ok: false, stage: 'context', errors: [lp.error], tool, ctx: context, lockedSkipped };
    const req = contextReq.evaluate(tool.requires, context);
    if (!req.ok) return { ok: false, stage: 'context', errors: req.reasons.map((e, i) => (i ? e : LOCK.explain(e, lockedSkipped))), tool, ctx: context };
    const perm = decide(tool, origin, getSettings().permissions);
    if (perm.decision === 'deny') return { ok: false, stage: 'permission', errors: perm.reasons, tool };
    const prepared = tool.prepare ? tool.prepare(v.value, context, services) : { ok: true, preview: { summary: tool.name, items: [] } };
    if (!prepared.ok) return { ok: false, stage: 'prepare', errors: [LOCK.explain(prepared.error, lockedSkipped)], tool, ctx: context };
    if (lockedSkipped.length && prepared.preview) prepared.preview = Object.assign({}, prepared.preview, { summary: `${prepared.preview.summary} · skips locked ${lockedSkipped.join(', ')}` });
    return { ok: true, tool, args: v.value, ctx: context, prepared, permission: perm, lockedSkipped };
  }

  /**
   * Run a tool. `approved` must be true when the permission decision is 'confirm'.
   * Returns { ok, status: 'success'|'partial'|'failed'|'needs-approval'|'blocked', ... }.
   */
  async function run(toolId, args, { origin = 'user', approved = false, batchId } = {}) {
    if (running) return { ok: false, status: 'blocked', errors: ['Another operation is still running'] };
    running = true;
    stopRequested = false; // a Stop belongs to the run it was pressed in
    const started = Date.now();
    emit({ type: 'start', toolId });
    try {
      const c = await check(toolId, args, { origin });
      if (!c.ok) {
        logger.warn('exec', `${toolId} blocked at ${c.stage}`, { errors: c.errors });
        return { ok: false, status: 'blocked', stage: c.stage, errors: c.errors };
      }
      const { tool, prepared, ctx } = c;
      if (c.permission.decision === 'confirm' && !approved) {
        return { ok: false, status: 'needs-approval', reasons: c.permission.reasons, preview: prepared.preview };
      }
      emit({ type: 'progress', toolId, message: prepared.preview.summary });

      let result;
      // v0.61 (docs/features/ENGINE2.md): a tool that writes runs inside ONE After Effects undo group — one Ctrl+Z
      // undoes the whole run, whatever number of host ops it took. Always closed, even when the tool throws.
      const tx = writes(tool) ? await openTx(`MOE: ${tool.name}`) : false;
      const sh = stepHost(toolId, started);
      try {
        result = await tool.execute({ args: c.args, ctx, prepared, host: sh, services });
      } catch (e) {
        if (tx) await closeTx();
        if (e.code === 'STOPPED') {
          const n = sh.stepsDone(), made = n > 0 && writes(tool);
          const summary = made ? `${tool.name} stopped after ${n} step(s) — Ctrl+Z removes what was made` : `${tool.name} stopped before it changed anything`;
          logger.info('exec', `${toolId} stopped`, { steps: n });
          record({ t: new Date().toISOString(), toolId, toolName: tool.name, origin, batchId, status: 'stopped', summary, ms: Date.now() - started });
          return { ok: false, status: 'stopped', summary, steps: n, errors: [summary] };
        }
        logger.error('exec', `${toolId} failed`, { code: e.code, message: e.message });
        record({ t: new Date().toISOString(), toolId, toolName: tool.name, origin, batchId, status: 'failed', error: e.message, ms: Date.now() - started });
        return { ok: false, status: 'failed', errors: [e.message], code: e.code };
      }
      if (tx) await closeTx();

      const verification = tool.verify ? tool.verify({ args: c.args, ctx, prepared, result }) : { ok: true, checks: [], unverified: true };
      if (c.lockedSkipped && c.lockedSkipped.length) verification.checks.push({ ok: true, label: 'Locked', detail: `${c.lockedSkipped.join(', ')} — not changed` });
      let checkpointId = null;
      if (tool.checkpoint) {
        const data = tool.checkpoint({ result, ctx, args: c.args });
        if (data) checkpointId = saveCheckpoint(tool, data, prepared.preview.summary);
      }
      const summary = tool.summarize ? tool.summarize(result, verification) : prepared.preview.summary;
      const status = verification.ok ? 'success' : (verification.checks.some((x) => x.ok) ? 'partial' : 'failed');
      record({
        t: new Date().toISOString(), toolId, toolName: tool.name, origin, batchId, status, summary,
        args: c.args, checkpointId, verification: { ok: verification.ok, failed: verification.checks.filter((x) => !x.ok).length },
        ms: Date.now() - started
      });
      logger.info('exec', `${toolId} ${status}`, { ms: Date.now() - started });
      return { ok: verification.ok, status, summary, result, verification, checkpointId, preview: prepared.preview };
    } finally {
      running = false;
      emit({ type: 'end', toolId });
    }
  }

  async function restore(checkpointId) {
    const cp = checkpoints.find((x) => x.id === checkpointId);
    if (!cp) return { ok: false, errors: ['Checkpoint not found'] };
    if (cp.restored) return { ok: false, errors: ['Checkpoint already restored'] };
    const tool = registry.get(cp.toolId);
    if (!tool || !tool.restore) return { ok: false, errors: ['This tool cannot restore checkpoints'] };
    const tx = await openTx(`MOE: Restore ${tool.name}`);
    try {
      const res = await tool.restore({ data: cp.data, host });
      if (tx) await closeTx();
      cp.restored = true;
      store.set('checkpoints', checkpoints);
      record({ t: new Date().toISOString(), toolId: cp.toolId, toolName: `Restore: ${tool.name}`, origin: 'user', status: 'success', summary: `Restored “${cp.label}”`, restoredCheckpoint: cp.id });
      return { ok: true, result: res };
    } catch (e) {
      if (tx) await closeTx();
      logger.error('exec', 'restore failed', { message: e.message });
      return { ok: false, errors: [e.message] };
    }
  }

  /** Stop the running tool before its next host step (v0.63). */
  function stop() { if (running) { stopRequested = true; emit({ type: 'stopping' }); } return running; }

  return {
    check, run, restore, readContext, stop,
    history: (limit = 200) => store.tail('history', limit).reverse(),
    checkpoint: (id) => checkpoints.find((x) => x.id === id) || null,
    on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    get running() { return running; }
  };
}

module.exports = { createExecutor };
