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
    const context = ctx || (await readContext());
    const req = contextReq.evaluate(tool.requires, context);
    if (!req.ok) return { ok: false, stage: 'context', errors: req.reasons, tool, ctx: context };
    const perm = decide(tool, origin, getSettings().permissions);
    if (perm.decision === 'deny') return { ok: false, stage: 'permission', errors: perm.reasons, tool };
    const prepared = tool.prepare ? tool.prepare(v.value, context, services) : { ok: true, preview: { summary: tool.name, items: [] } };
    if (!prepared.ok) return { ok: false, stage: 'prepare', errors: [prepared.error], tool, ctx: context };
    return { ok: true, tool, args: v.value, ctx: context, prepared, permission: perm };
  }

  /**
   * Run a tool. `approved` must be true when the permission decision is 'confirm'.
   * Returns { ok, status: 'success'|'partial'|'failed'|'needs-approval'|'blocked', ... }.
   */
  async function run(toolId, args, { origin = 'user', approved = false, batchId } = {}) {
    if (running) return { ok: false, status: 'blocked', errors: ['Another operation is still running'] };
    running = true;
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
      try {
        result = await tool.execute({ args: c.args, ctx, prepared, host, services });
      } catch (e) {
        logger.error('exec', `${toolId} failed`, { code: e.code, message: e.message });
        record({ t: new Date().toISOString(), toolId, toolName: tool.name, origin, batchId, status: 'failed', error: e.message, ms: Date.now() - started });
        return { ok: false, status: 'failed', errors: [e.message], code: e.code };
      }

      const verification = tool.verify ? tool.verify({ args: c.args, ctx, prepared, result }) : { ok: true, checks: [], unverified: true };
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
    try {
      const res = await tool.restore({ data: cp.data, host });
      cp.restored = true;
      store.set('checkpoints', checkpoints);
      record({ t: new Date().toISOString(), toolId: cp.toolId, toolName: `Restore: ${tool.name}`, origin: 'user', status: 'success', summary: `Restored “${cp.label}”`, restoredCheckpoint: cp.id });
      return { ok: true, result: res };
    } catch (e) {
      logger.error('exec', 'restore failed', { message: e.message });
      return { ok: false, errors: [e.message] };
    }
  }

  return {
    check, run, restore, readContext,
    history: (limit = 200) => store.tail('history', limit).reverse(),
    checkpoint: (id) => checkpoints.find((x) => x.id === id) || null,
    on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    get running() { return running; }
  };
}

module.exports = { createExecutor };
