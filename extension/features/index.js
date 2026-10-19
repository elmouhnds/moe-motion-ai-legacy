'use strict';
/**
 * Feature modules. To add a tool: create its definition file and list it here.
 * The registry validates every definition at startup.
 */

const smartEase = require('./motion/smartEase');
const stagger = require('./motion/stagger');
const expr = require('./expressions/tools');
const assist = require('./expressions/assist');
const compositing = require('./compositing/index');

const TOOLS = [smartEase, stagger, expr.apply, expr.validate, expr.inspect, expr.remove, assist, ...compositing];

function registerAll(registry) {
  for (const t of TOOLS) registry.register(t);
  return registry;
}

module.exports = { registerAll, TOOLS };
