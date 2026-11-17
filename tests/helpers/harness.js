'use strict';
/**
 * Test harness: loads the REAL host/*.jsx into a Node vm context with the AE
 * mock installed, and exposes a CEP-like evalScript(script, callback).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { installAE } = require('../mock/ae-mock');
const { createMemPlatform } = require('../../dev/platform-mem');
const { createServices } = require('../../extension/core/services');

// CEP's getSystemPath(EXTENSION) returns forward slashes on Windows too, and the mock's File
// normalises fsName the same way — keep ROOT in that form so in-memory file keys match.
const ROOT = path.resolve(__dirname, '../../extension').replace(/\\/g, '/');

function createHostEnv(fixture, memFiles) {
  const sandbox = {};
  const context = vm.createContext(sandbox);
  const evalCode = (code) => vm.runInContext(code, context);
  // Host-side File checks see both real files (host .jsx) and the in-memory data folder.
  const readFile = (p) => (memFiles && memFiles.has(p) ? memFiles.get(p) : fs.readFileSync(p, 'utf8'));
  const env = installAE(sandbox, fixture, { readFile, evalCode });
  const evalScript = (script, cb) => {
    setImmediate(() => {
      let res;
      const before = env.undo.entries.length;
      try { res = vm.runInContext(script, context); } catch (e) { res = 'EvalScript error.'; }
      // v0.94 (docs/features/ONE_UNDO.md): After Effects closes an undo group when the script that opened it returns —
      // a group can never span two panel calls. And a write made outside any group is its own undo step (or many).
      if (env.undo.depth > 0) { env.undo.autoClosed++; env.undo.depth = 0; }
      const m = /MOE_dispatch\("([^"]+)"/.exec(script);
      const op = m && sandbox.MOE && sandbox.MOE.ops && sandbox.MOE.ops[m[1]];
      if (op && op.mutates && env.undo.entries.length === before) {
        let ok = false; try { ok = JSON.parse(String(res)).ok; } catch (e) { ok = false; }
        if (ok) env.undo.entries.push(`(no undo group) ${m[1]}`);
      }
      cb(res === undefined ? 'undefined' : String(res));
    });
  };
  return { sandbox, context, evalScript, env, comp: env.project && env.project.activeItem };
}

async function createTestServices(fixture, platformOpts) {
  const platform = createMemPlatform(platformOpts);
  const h = createHostEnv(fixture, platform.files);
  const services = createServices({ platform, evalScript: h.evalScript, rootPath: ROOT, hostTimeoutMs: 5000 });
  await services.host.init();
  return Object.assign(h, { services, platform });
}

module.exports = { createHostEnv, createTestServices, ROOT };
