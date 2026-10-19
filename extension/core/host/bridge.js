'use strict';
/**
 * Host bridge: the only path from the panel to ExtendScript.
 *
 * - Calls are serialized (ExtendScript runs on After Effects' main thread;
 *   overlapping evalScript calls only queue up inside AE anyway).
 * - Only named ops are callable: MOE_dispatch(op, argsJson).
 * - Arguments are passed as an escaped JSON string literal (ASCII-only), so
 *   user text can never become ExtendScript code.
 */

class HostError extends Error {
  constructor(code, message, extra) {
    super(message);
    this.code = code;
    Object.assign(this, extra || {});
  }
}

/** Encode any string as an ASCII-only JS string literal accepted by ES3. */
function literal(str) {
  return JSON.stringify(String(str)).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

function createHostBridge({ evalScript, rootPath, timeoutMs = 30000, logger }) {
  let queue = Promise.resolve();
  let ready = false;
  let busy = false;
  const log = logger || { info() {}, warn() {}, error() {} };

  function rawEval(script, label, callTimeout) {
    const limit = callTimeout || timeoutMs;
    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new HostError('HOST_TIMEOUT', `After Effects did not answer "${label}" within ${Math.round(limit / 1000)}s. It may be busy (rendering or a modal dialog).`));
      }, limit);
      try {
        evalScript(script, (res) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(res);
        });
      } catch (e) {
        done = true;
        clearTimeout(timer);
        reject(new HostError('HOST_UNAVAILABLE', `Host bridge unavailable: ${e.message}`));
      }
    });
  }

  function enqueue(fn) {
    const run = queue.then(async () => {
      busy = true;
      try { return await fn(); } finally { busy = false; }
    });
    queue = run.catch(() => {});
    return run;
  }

  async function loadHost() {
    const entry = `${rootPath}/host/index.jsx`;
    const script =
      `(function(){try{$.global.MOE_ROOT=${literal(rootPath)};` +
      `return String($.evalFile(new File(${literal(entry)})));}` +
      `catch(e){return "MOE_HOST_INIT_ERROR "+e.message+" (line "+e.line+")";}})()`;
    const res = await rawEval(script, 'load host');
    if (!/^MOE_HOST_READY/.test(String(res))) {
      ready = false;
      throw new HostError('HOST_INIT_FAILED', `Could not load the MOE host module: ${res}`);
    }
    ready = true;
    log.info('host', 'Host module loaded', { result: res });
    return res;
  }

  async function dispatch(op, args, opts) {
    const t = opts && opts.timeoutMs;
    const script = `(typeof MOE_dispatch==="function")?MOE_dispatch(${literal(op)},${literal(JSON.stringify(args || {}))}):"MOE_NOT_LOADED"`;
    let res = await rawEval(script, op, t);
    if (res === 'MOE_NOT_LOADED') {
      log.warn('host', 'Host module not loaded; reloading', { op });
      await loadHost();
      res = await rawEval(script, op, t);
    }
    if (res === 'EvalScript error.' || res === undefined || res === null || res === '') {
      throw new HostError('HOST_EVAL_ERROR', `After Effects could not run "${op}" (ExtendScript evaluation error).`);
    }
    let env;
    try { env = JSON.parse(res); } catch (e) {
      throw new HostError('HOST_BAD_RESPONSE', `Unexpected host response for "${op}": ${String(res).slice(0, 200)}`);
    }
    if (!env.ok) {
      throw new HostError(env.error.code, env.error.message, { op, line: env.error.line, ms: env.ms });
    }
    log.info('host', `${op} ok`, { ms: env.ms });
    return env.data;
  }

  return {
    init: () => enqueue(loadHost),
    call: (op, args, opts) => enqueue(() => dispatch(op, args, opts)),
    get ready() { return ready; },
    get busy() { return busy; }
  };
}

module.exports = { createHostBridge, HostError, literal };
