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
const brand = require('./brand/tools');
const text = require('./text/tools');
const proximity = require('./proximity/tools');
const select = require('./select/tools');

const TOOLS = [
  smartEase, stagger, proximity.apply, proximity.centerAnchor, proximity.remove,
  text.animate, text.removeAnimation,
  brand.applyColor, brand.applyFont, brand.extractPalette,
  select.selectLayers,
  expr.apply, expr.validate, expr.inspect, expr.remove, assist,
  ...compositing
];

function registerAll(registry) {
  for (const t of TOOLS) registry.register(t);
  return registry;
}

module.exports = { registerAll, TOOLS };
