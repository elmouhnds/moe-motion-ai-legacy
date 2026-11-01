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
const brandSource = require('./brand/fromSource');
const brandAll = require('./brand/applyAll');
const text = require('./text/tools');
const proximity = require('./proximity/tools');
const select = require('./select/tools');
const adapt = require('./adapt/tools');
const grid = require('./grid/tools');
const zoom = require('./zoom/tools');
const glass = require('./glass/tools');
const thickGlass = require('./glass/thickTools');
const quick = require('./quick/tools');
const exprQuick = require('./expressions/quick');
const green = require('./generate/green');
const design = require('./design/tools');
const curves = require('./curves/tools');
const transform = require('./transform/tools');
const kit = require('./kit/tools');
const { delay } = require('./kit/delay');

const TOOLS = [
  smartEase, stagger, proximity.apply, proximity.centerAnchor, proximity.remove,
  zoom.focus, zoom.follow, zoom.cursor,
  text.animate, text.removeAnimation,
  brand.applyColor, brand.applyFont, brand.extractPalette, brandSource.fromSource, brandAll.applyAll,
  select.selectLayers,
  grid.build, grid.update, grid.items, grid.remove, grid.guides, grid.placeInCells,
  adapt.resize, adapt.suggest,
  exprQuick.quick, expr.apply, expr.validate, expr.inspect, expr.remove, assist,
  quick.reveal, quick.purge, quick.duplicate, quick.flip, quick.parentNull, quick.precompose, quick.separate,
  quick.selectSame, quick.reverseKeys, quick.mirrorKeys, quick.animate, quick.trim, quick.typewriter, quick.counter,
  ...compositing,
  glass.apply, glass.look, thickGlass.thick, thickGlass.thickLook,
  green.greenPrompt, green.importKey,
  design.insertShape, design.background, design.colorize,
  curves.easeCurve, curves.pasteEase, transform.anchor, transform.align, transform.clone,
  kit.interp, kit.trimToKeys, kit.parent, kit.stare, kit.vignette, kit.trash, delay
];

function registerAll(registry) {
  for (const t of TOOLS) registry.register(t);
  return registry;
}

module.exports = { registerAll, TOOLS };
