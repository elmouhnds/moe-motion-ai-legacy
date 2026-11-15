'use strict';
/**
 * v0.99.5 — After Effects cannot interrupt a script: a call that times out still runs. The next call must wait for its
 * late answer instead of timing out as well (side session, run 3: one 120 s clone grid made the next 4 tiles "time out").
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHostBridge } = require('../extension/core/host/bridge');

test('a slow call times out once; the next call waits for it and succeeds', async () => {
  let busyUntil = 0; const log = [];
  // a fake evalScript that, like After Effects, runs scripts one at a time and cannot be interrupted
  const evalScript = (script, cb) => {
    const start = Math.max(Date.now(), busyUntil);
    const ms = /slow/.test(script) ? 300 : 20;
    busyUntil = start + ms;
    setTimeout(() => { log.push(script.slice(0, 40)); cb(/load|evalFile/.test(script) ? 'MOE_HOST_READY' : JSON.stringify({ ok: true, data: { ok: 1 } })); }, busyUntil - Date.now());
  };
  const b = createHostBridge({ evalScript, rootPath: '/x', timeoutMs: 100, logger: { info() {}, warn() {}, error() {} } });
  await b.init();
  await assert.rejects(b.call('slow.op', {}), (e) => e.code === 'HOST_TIMEOUT' && /still working/.test(e.message));
  const r = await b.call('fast.op', {});        // would time out at 100 ms without waiting for the late answer
  assert.deepEqual(r, { ok: 1 });
});
