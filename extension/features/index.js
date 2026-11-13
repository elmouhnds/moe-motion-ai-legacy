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
const gridEffector = require('./grid/effectorTool');
const gridEffectorControls = require('./grid/effectorControls');
const gridEffectorRemove = require('./grid/effectorRemove');
const gridTracer = require('./grid/tracerTool');
const gridColour = require('./grid/colourTool');
const gridTrail = require('./grid/trailTool');
const rigBake = require('./bake/bake');
const zoom = require('./zoom/tools');
const interact = require('./interact/tools'); // v0.60 Click on Layer
const links = require('./links/tools'); // v0.62 rename-safe links
const { wipe } = require('./quick/wipe'); // v0.63 Wipe Reveal
const { carousel } = require('./carousel/tools'); // v0.63 Carousel 3D
const { depth } = require('./quick/depth'); // v0.64 Depth Reveal
const glass = require('./glass/tools');
const thickGlass = require('./glass/thickTools');
const quick = require('./quick/tools');
const exprQuick = require('./expressions/quick');
const green = require('./generate/green');
const design = require('./design/tools');
const { template } = require('./design/templateTool');
const { style } = require('./design/styles'); // v0.59 Styles
const curves = require('./curves/tools');
const transform = require('./transform/tools');
const kit = require('./kit/tools');
const reader = require('./kit/reader');
const markers = require('./markers/tools');
const { delay } = require('./kit/delay');
const scene = require('./scene/tools'); // v0.80 Scene Check: read the comp, measure scenes
const retune = require('./retune/tools'); // v0.79 Tune After: retime, copy / paste motion

const TOOLS = [
  smartEase, stagger, proximity.apply, proximity.centerAnchor, proximity.remove,
  zoom.focus, zoom.follow, zoom.cursor, interact.click, links.relink,
  text.animate, text.removeAnimation,
  brand.applyColor, brand.applyFont, brand.extractPalette, brandSource.fromSource, brandAll.applyAll,
  select.selectLayers, select.selectStep,
  grid.build, grid.update, grid.items, grid.remove, grid.guides, grid.guidePreset, grid.placeInCells, gridEffector.effector, gridEffectorControls.controls, gridEffectorRemove.remove, gridEffectorRemove.freeze, gridTracer.tracer, gridColour.colour, gridTrail.trail, rigBake.bake,
  adapt.resize, adapt.suggest,
  exprQuick.quick, expr.apply, expr.validate, expr.inspect, expr.remove, assist,
  quick.reveal, quick.purge, quick.duplicate, quick.flip, quick.parentNull, quick.precompose, quick.separate,
  quick.selectSame, quick.reverseKeys, quick.mirrorKeys, quick.animate, quick.shake, wipe, carousel, depth, quick.trim, quick.typewriter, quick.counter,
  ...compositing,
  glass.apply, glass.look, thickGlass.thick, thickGlass.thickLook,
  green.greenPrompt, green.importKey,
  design.insertShape, design.background, design.colorize, template, style,
  curves.easeCurve, curves.pasteEase, transform.anchor, transform.align, transform.clone,
  kit.interp, kit.trimToKeys, kit.parent, kit.stare, kit.vignette, kit.trash, reader.removeRig, markers.beatMarkers, delay,
  retune.retime, retune.copyMotion, retune.pasteMotion,
  scene.read, scene.measure
];

function registerAll(registry) {
  for (const t of TOOLS) registry.register(t);
  return registry;
}

module.exports = { registerAll, TOOLS };
