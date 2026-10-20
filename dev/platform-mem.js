'use strict';
/**
 * In-memory platform (tests + browser preview). Same interface as
 * extension/core/platform/node.js. HTTP is injectable for AI tests.
 */
function createMemPlatform({ http, apiKey = null, system = null } = {}) {
  const files = new Map();
  const dataDir = '/mem/MOE Motion AI';
  let key = apiKey;
  return {
    kind: 'memory',
    files,
    fs: {
      dataDir,
      join: (...p) => p.join('/'),
      exists: (p) => files.has(p),
      readText: (p) => { if (!files.has(p)) throw new Error('ENOENT ' + p); return files.get(p); },
      writeText: (p, s) => files.set(p, s),
      writeTextAtomic: (p, s) => files.set(p, s),
      appendText: (p, s) => files.set(p, (files.get(p) || '') + s),
      readBytes: (p) => { if (!files.has(p)) throw new Error('ENOENT ' + p); return files.get(p); },
      writeBytes: (p, b) => files.set(p, b),
      remove: (p) => files.delete(p)
    },
    http: http || { request: async () => { const e = new Error('offline'); e.code = 'ENOTFOUND'; throw e; } },
    system,
    secrets: {
      status: async () => ({ stored: !!key, protection: 'memory' }),
      getApiKey: async () => key,
      setApiKey: async (k) => { key = k; },
      clear: async () => { key = null; }
    },
    info: { platform: 'memory', node: typeof process !== 'undefined' ? process.version : 'browser', dataDir }
  };
}
module.exports = { createMemPlatform };
