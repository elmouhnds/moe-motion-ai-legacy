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

  // v0.99.5 (side session, run 3: a call "timed out at 30 s" yet After Effects worked on it for 120 s, and every call
  // after it timed out too): After Effects cannot interrupt a script, so a timeout only stops the panel WAITING. The
  // script still runs; `stillRunning` is its late answer, and the next call waits for it before its own clock starts —
  // so one slow call is reported once, not as a cascade of false timeouts.
  let stillRunning = null;
  const LATE_WAIT_MS = 10 * 60 * 1000;

  async function rawEval(script, label, callTimeout) {
    if (stillRunning) {
      const s = stillRunning;
      let t;
      await Promise.race([s.done, new Promise((r) => { t = setTimeout(r, LATE_WAIT_MS); })]);
      clearTimeout(t);
      if (stillRunning === s) stillRunning = null;
    }
    const limit = callTimeout || timeoutMs;
    const started = Date.now();
    return new Promise((resolve, reject) => {
      let done = false, late = null;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        let finish;
        late = { label, started, done: new Promise((r) => { finish = r; }) };
        late.finish = finish;
        stillRunning = late;
        reject(new HostError('HOST_TIMEOUT', `After Effects is still working on "${label}" after ${Math.round(limit / 1000)} s (it may be busy or showing a dialog). It is not stopped — After Effects cannot interrupt a script — and the next steps wait for it.`));
      }, limit);
      try {
        evalScript(script, (res) => {
          if (late) { log.warn('host', `"${label}" finished late`, { code: 'HOST_LATE', ms: Date.now() - started }); late.finish(); if (stillRunning === late) stillRunning = null; return; }
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
