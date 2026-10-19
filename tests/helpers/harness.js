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

const ROOT = path.resolve(__dirname, '../../extension');

function createHostEnv(fixture) {
  const sandbox = {};
  const context = vm.createContext(sandbox);
  const evalCode = (code) => vm.runInContext(code, context);
  const env = installAE(sandbox, fixture, { readFile: (p) => fs.readFileSync(p, 'utf8'), evalCode });
  const evalScript = (script, cb) => {
    setImmediate(() => {
      let res;
      try { res = vm.runInContext(script, context); } catch (e) { res = 'EvalScript error.'; }
      cb(res === undefined ? 'undefined' : String(res));
    });
  };
  return { sandbox, context, evalScript, env, comp: env.project && env.project.activeItem };
}

async function createTestServices(fixture, platformOpts) {
  const h = createHostEnv(fixture);
  const platform = createMemPlatform(platformOpts);
  const services = createServices({ platform, evalScript: h.evalScript, rootPath: ROOT, hostTimeoutMs: 5000 });
  await services.host.init();
  return Object.assign(h, { services, platform });
}

module.exports = { createHostEnv, createTestServices, ROOT };
