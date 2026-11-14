'use strict';
/**
 * Studio layout (concept B): labelled sidebar of creative sections. Library sections
 * show visual tiles (a tile = a registered tool + preset args + a thumbnail recipe)
 * and an Inspector with that tool's own form. Every tool stays reachable from the
 * section's "All tools" tab, the command search and the Copilot.
 */
const { PRESETS: EXPR } = require('../../../features/expressions/quick');
const { LOOKS } = require('../../../features/glass/tools');
const { THICK_LOOKS } = require('../../../features/glass/thick');
const PAL = require('../../../features/design/palettes');

const T = (id, label, tool, args, thumb, tags, badge) => ({ id, label, tool, args: args || {}, thumb, tags: tags || [], badge });

const ANIMATE = [
  T('inRL', 'Slide In ←', 'quick.animate', { kind: 'moveRL', dir: 'in' }, { k: 'move', dx: 1, dy: 0, dir: 'in' }, ['In', 'Slide'], 'IN'),
  T('inLR', 'Slide In →', 'quick.animate', { kind: 'moveLR', dir: 'in' }, { k: 'move', dx: -1, dy: 0, dir: 'in' }, ['In', 'Slide'], 'IN'),
  T('inTB', 'Slide In ↓', 'quick.animate', { kind: 'moveTB', dir: 'in' }, { k: 'move', dx: 0, dy: -1, dir: 'in' }, ['In', 'Slide'], 'IN'),
  T('inBT', 'Slide In ↑', 'quick.animate', { kind: 'moveBT', dir: 'in' }, { k: 'move', dx: 0, dy: 1, dir: 'in' }, ['In', 'Slide'], 'IN'),
  T('fadeIn', 'Fade In', 'quick.animate', { kind: 'fade', dir: 'in' }, { k: 'fade', dir: 'in' }, ['In', 'Fade'], 'IN'),
  T('popIn', 'Pop In', 'quick.animate', { kind: 'scale', dir: 'in', overshoot: true }, { k: 'scale', dir: 'in', over: true }, ['In', 'Scale'], 'IN'),
  T('spinIn', 'Spin In', 'quick.animate', { kind: 'spin', dir: 'in', overshoot: true }, { k: 'spin', dir: 'in' }, ['In'], 'IN'),
  T('outRL', 'Slide Out ←', 'quick.animate', { kind: 'moveRL', dir: 'out' }, { k: 'move', dx: -1, dy: 0, dir: 'out' }, ['Out', 'Slide'], 'OUT'),
  T('outLR', 'Slide Out →', 'quick.animate', { kind: 'moveLR', dir: 'out' }, { k: 'move', dx: 1, dy: 0, dir: 'out' }, ['Out', 'Slide'], 'OUT'),
  T('outTB', 'Slide Out ↓', 'quick.animate', { kind: 'moveTB', dir: 'out' }, { k: 'move', dx: 0, dy: 1, dir: 'out' }, ['Out', 'Slide'], 'OUT'),
  T('outBT', 'Slide Out ↑', 'quick.animate', { kind: 'moveBT', dir: 'out' }, { k: 'move', dx: 0, dy: -1, dir: 'out' }, ['Out', 'Slide'], 'OUT'),
  T('fadeOut', 'Fade Out', 'quick.animate', { kind: 'fade', dir: 'out' }, { k: 'fade', dir: 'out' }, ['Out', 'Fade'], 'OUT'),
  T('scaleOut', 'Scale Out', 'quick.animate', { kind: 'scale', dir: 'out' }, { k: 'scale', dir: 'out' }, ['Out', 'Scale'], 'OUT'),
  T('trimDraw', 'Draw On', 'quick.trimPaths', { mode: 'draw' }, { k: 'trim', mode: 'draw' }, ['Trim'], 'TRIM'),
  T('trimErase', 'Erase', 'quick.trimPaths', { mode: 'erase' }, { k: 'trim', mode: 'erase' }, ['Trim'], 'TRIM'),
  T('trimTravel', 'Travel', 'quick.trimPaths', { mode: 'travel' }, { k: 'trim', mode: 'travel' }, ['Trim'], 'TRIM'),
  T('trimBoth', 'Draw + Erase', 'quick.trimPaths', { mode: 'drawErase' }, { k: 'trim', mode: 'drawErase' }, ['Trim'], 'TRIM'),
  T('easeSmooth', 'Smooth Ease', 'motion.smartEase', { influenceIn: 75, influenceOut: 75 }, { k: 'ease', a: 0.75, b: 0.75 }, ['Keys', 'Ease'], 'EASE'),
  T('easeSnappy', 'Snappy Ease', 'motion.smartEase', { influenceIn: 90, influenceOut: 15 }, { k: 'ease', a: 0.15, b: 0.9 }, ['Keys', 'Ease'], 'EASE'),
  T('riseIn', 'Rise In', 'quick.animate', { kind: 'moveBT', dir: 'in', ease: 'expo', distance: 120, duration: 0.8 }, { k: 'move', dx: 0, dy: 0.45, dir: 'in' }, ['In', 'Slide'], 'IN'),
  T('dropIn', 'Drop In', 'quick.animate', { kind: 'moveTB', dir: 'in', overshoot: true, distance: 160 }, { k: 'move', dx: 0, dy: -0.5, dir: 'in' }, ['In', 'Slide'], 'IN'),
  T('cascadeIn', 'Cascade In', 'quick.animate', { kind: 'moveBT', dir: 'in', distance: 80, stagger: 0.08, ease: 'smooth' }, { k: 'stagger' }, ['In', 'Slide'], 'IN'),
  T('cascadeFade', 'Cascade Fade', 'quick.animate', { kind: 'fade', dir: 'in', stagger: 0.06, duration: 0.5 }, { k: 'fade', dir: 'in' }, ['In', 'Fade'], 'IN'),
  // v0.48 (COMBINED_MOVES.md): two properties on one timing — the entrances and exits designers build by hand
  T('riseFade', 'Rise + Fade', 'quick.animate', { kind: 'moveBT', dir: 'in', distance: 60, fade: true, ease: 'smooth', duration: 0.7 }, { k: 'move', dx: 0, dy: 0.3, dir: 'in' }, ['In', 'Slide', 'Fade'], 'IN'),
  // v0.64 (WAVE4.md): from the depth of the scene — native 3D along Z, fade + blur, in screen order (no plugin, no download)
  Object.assign(T('depthIn', 'Depth In', 'quick.depth', { dir: 'in', depth: 900, duration: 0.9, fade: true, blur: 14, stagger: 0.06, order: 'screen' }, { k: 'depth', dir: 'in' }, ['In', 'Depth'], 'NEW'), { hint: 'Comes forward from the depth of the scene, sharpening as it lands' }),
  Object.assign(T('depthInFar', 'Depth In · Far', 'quick.depth', { dir: 'in', depth: 2400, duration: 1.2, fade: true, blur: 24, stagger: 0.08, order: 'screen', ease: 'expo' }, { k: 'depth', dir: 'in', far: true }, ['In', 'Depth'], 'NEW'), { hint: 'From far away, fast then soft (Expo)' }),
  Object.assign(T('depthOut', 'Depth Out', 'quick.depth', { dir: 'out', depth: 900, duration: 0.7, fade: true, blur: 14, stagger: 0.04, order: 'screen' }, { k: 'depth', dir: 'out' }, ['Out', 'Depth'], 'NEW'), { hint: 'Falls back into the depth of the scene' }),
  // v0.63 (WIPE_CAROUSEL.md): After Effects' Linear Wipe with a soft edge, eased, staggered by screen order
  ...[['wipeInL', 'Wipe In →', { from: 'left', dir: 'in' }], ['wipeInR', 'Wipe In ←', { from: 'right', dir: 'in' }], ['wipeInB', 'Wipe In ↑', { from: 'bottom', dir: 'in' }], ['wipeInD', 'Wipe In ↘', { from: 'topLeft', dir: 'in' }],
    ['wipeOutL', 'Wipe Out →', { from: 'left', dir: 'out' }], ['wipeOutR', 'Wipe Out ←', { from: 'right', dir: 'out' }]]
    .map(([id, label, a]) => Object.assign(T(id, label, 'quick.wipe', Object.assign({ duration: 0.8, feather: 60, ease: 'smooth' }, a), { k: 'wipe', from: a.from, dir: a.dir }, [a.dir === 'in' ? 'In' : 'Out', 'Wipe'], 'NEW'), { hint: `${a.dir === 'in' ? 'Reveals' : 'Hides'} the layer with a soft-edged wipe (After Effects' Linear Wipe)` })),
  // v0.95 (MATTE_REVEAL.md): an alpha track matte per layer (a MOE matte shape layer that follows it), nine styles
  ...[['mtWipe', 'Matte Wipe →', { style: 'wipe', from: 'left' }, 'One straight edge sweeps across — the layer shows through an alpha matte'],
    ['mtDiag', 'Matte Diagonal ↘', { style: 'wipe', from: 'topLeft', duration: 0.9 }, 'A diagonal edge sweeps from the top-left corner'],
    ['mtCorner', 'Matte Corner', { style: 'corner', corner: 'topLeft' }, 'The layer grows out of its top-left corner'],
    ['mtSplit', 'Matte Split ↔', { style: 'split', axis: 'h', ease: 'expo' }, 'Opens from the middle line outward, like doors'],
    ['mtIris', 'Iris Reveal', { style: 'iris', ease: 'expo', duration: 0.9 }, 'A circle opens from the centre'],
    ['mtCard', 'Card Reveal', { style: 'card', radius: 24, ease: 'expo', duration: 0.9 }, 'A round pill grows into a rounded card — a SaaS favourite'],
    ['mtBlinds', 'Blinds Reveal', { style: 'blinds', axis: 'h', count: 6, cascade: 0.5, duration: 1 }, 'Bars wipe in one after the other'],
    ['mtBlindsV', 'Vertical Blinds', { style: 'blinds', axis: 'v', count: 8, cascade: 0.6, alternate: true, duration: 1 }, 'Vertical bars, alternate sides'],
    ['mtStripes', 'Stripes Reveal', { style: 'stripes', axis: 'h', count: 5, cascade: 0.4, ease: 'expo', duration: 1 }, 'Bars slide in from alternate sides'],
    ['mtShutter', 'Shutter Reveal', { style: 'shutter', axis: 'v', count: 8, cascade: 0.3, duration: 0.9 }, 'Slats open from their own centres'],
    ['mtPixels', 'Pixel Reveal', { style: 'pixels', cols: 10, order: 'random', cascade: 0.75, duration: 1.1 }, 'A grid of blocks pops in, at random'],
    ['mtPixelSweep', 'Pixel Sweep', { style: 'pixels', cols: 12, order: 'diagonal', cascade: 0.7, duration: 1.1 }, 'Blocks pop in along the diagonal'],
    ['mtWipeOut', 'Matte Wipe Out', { style: 'wipe', from: 'left', dir: 'out' }, 'Hides the layer behind a sweeping edge'],
    ['mtIrisOut', 'Iris Close', { style: 'iris', dir: 'out', ease: 'expo' }, 'A circle closes on the centre'],
    ['mtPixelsOut', 'Pixel Hide', { style: 'pixels', cols: 10, order: 'random', cascade: 0.75, dir: 'out', duration: 1 }, 'Blocks disappear at random']]
    .map(([id, label, a, hint]) => { const args = Object.assign({ dir: 'in', duration: 0.8, ease: 'smooth' }, a); return Object.assign(T(id, label, 'reveal.matte', args, { k: 'matte', style: args.style, dir: args.dir }, [args.dir === 'in' ? 'In' : 'Out', 'Matte'], 'NEW'), { hint }); }),
  // v0.96 (MATTE_FX.md): organic reveals from a Fractal Noise gradient map read by Gradient Wipe; the tile plays the
  // render After Effects made of it (Diagnostics › Rendered previews) — an icon until then, never a look-alike drawing
  ...Object.entries(require('../../../features/reveal/fxPlan').PRESETS).map(([id, p]) => Object.assign(T(`fx-${id}`, p.label, 'reveal.fx', { preset: id, dir: 'in' }, { k: 'icon', icon: 'layers' }, ['In', 'FX'], 'NEW'), { hint: p.hint })),
  ...[['fx-burnAway', 'Burn Away', 'burnIn', 'Burns away along the diagonal, an ember front'], ['fx-inkRecede', 'Ink Recede', 'inkBleed', 'Ink draws back into the centre'], ['fx-grainOut', 'Grain Out', 'grainDissolve', 'Dissolves away into film grain']]
    .map(([id, label, preset, hint]) => Object.assign(T(id, label, 'reveal.fx', { preset, dir: 'out' }, { k: 'icon', icon: 'layers', dir: 'out' }, ['Out', 'FX'], 'NEW'), { hint })),
  T('slideFadeIn', 'Slide + Fade In', 'quick.animate', { kind: 'moveRL', dir: 'in', distance: 140, fade: true, ease: 'expo', duration: 0.7 }, { k: 'move', dx: 0.5, dy: 0, dir: 'in' }, ['In', 'Slide', 'Fade'], 'IN'),
  T('dropFade', 'Drop + Fade', 'quick.animate', { kind: 'moveTB', dir: 'in', distance: 80, fade: true, overshoot: true, duration: 0.7 }, { k: 'move', dx: 0, dy: -0.3, dir: 'in' }, ['In', 'Slide', 'Fade'], 'IN'),
  T('zoomFadeIn', 'Zoom Fade In', 'quick.animate', { kind: 'scale', dir: 'in', away: 130, fade: true, ease: 'expo', duration: 0.7 }, { k: 'scale', dir: 'in' }, ['In', 'Scale', 'Fade'], 'IN'),
  T('growFade', 'Grow + Fade', 'quick.animate', { kind: 'scale', dir: 'in', away: 60, fade: true, ease: 'smooth', duration: 0.6 }, { k: 'scale', dir: 'in' }, ['In', 'Scale', 'Fade'], 'IN'),
  T('popFade', 'Pop + Fade', 'quick.animate', { kind: 'scale', dir: 'in', overshoot: true, fade: true, duration: 0.6 }, { k: 'scale', dir: 'in' }, ['In', 'Scale', 'Fade'], 'IN'),
  T('swingIn', 'Swing In', 'quick.animate', { kind: 'spin', dir: 'in', angle: 25, fade: true, overshoot: true, duration: 0.7 }, { k: 'spin', dir: 'in' }, ['In', 'Fade'], 'IN'),
  T('sinkFade', 'Sink + Fade', 'quick.animate', { kind: 'moveTB', dir: 'out', distance: 60, fade: true, ease: 'smooth', duration: 0.6 }, { k: 'move', dx: 0, dy: 0.3, dir: 'out' }, ['Out', 'Slide', 'Fade'], 'OUT'),
  T('slideFadeOut', 'Slide + Fade Out', 'quick.animate', { kind: 'moveRL', dir: 'out', distance: 140, fade: true, ease: 'expo', duration: 0.6 }, { k: 'move', dx: -0.5, dy: 0, dir: 'out' }, ['Out', 'Slide', 'Fade'], 'OUT'),
  T('zoomFadeOut', 'Zoom Fade Out', 'quick.animate', { kind: 'scale', dir: 'out', away: 130, fade: true, ease: 'expo', duration: 0.6 }, { k: 'scale', dir: 'out' }, ['Out', 'Scale', 'Fade'], 'OUT'),
  T('shrinkFade', 'Shrink + Fade', 'quick.animate', { kind: 'scale', dir: 'out', away: 60, fade: true, ease: 'smooth', duration: 0.5 }, { k: 'scale', dir: 'out' }, ['Out', 'Scale', 'Fade'], 'OUT'),
  T('swingOut', 'Swing Out', 'quick.animate', { kind: 'spin', dir: 'out', angle: 25, fade: true, duration: 0.6 }, { k: 'spin', dir: 'out' }, ['Out', 'Fade'], 'OUT'),
  // v0.58 (docs/features/APPLE_MOTION.md): Apple-style — the layer comes in sharp from a blur, on the same timing
  T('blurIn', 'Blur In', 'quick.animate', { kind: 'fade', dir: 'in', blur: 40, ease: 'smooth', duration: 0.7 }, { k: 'fade', dir: 'in' }, ['In', 'Fade', 'Blur'], 'IN'),
  T('blurOut', 'Blur Out', 'quick.animate', { kind: 'fade', dir: 'out', blur: 40, ease: 'smooth', duration: 0.6 }, { k: 'fade', dir: 'out' }, ['Out', 'Fade', 'Blur'], 'OUT'),
  T('focusIn', 'Focus In', 'quick.animate', { kind: 'scale', dir: 'in', away: 112, fade: true, blur: 30, ease: 'expo', duration: 0.8 }, { k: 'scale', dir: 'in' }, ['In', 'Scale', 'Blur'], 'IN'),
  T('focusOut', 'Focus Out', 'quick.animate', { kind: 'scale', dir: 'out', away: 92, fade: true, blur: 24, ease: 'smooth', duration: 0.6 }, { k: 'scale', dir: 'out' }, ['Out', 'Scale', 'Blur'], 'OUT'),
  T('whipIn', 'Whip In', 'quick.animate', { kind: 'moveRL', dir: 'in', distance: 420, fade: true, blur: 60, ease: 'expo', duration: 0.5 }, { k: 'move', dx: 0.6, dy: 0, dir: 'in' }, ['In', 'Slide', 'Blur'], 'IN'),
  T('whipOut', 'Whip Out', 'quick.animate', { kind: 'moveRL', dir: 'out', distance: 420, fade: true, blur: 60, ease: 'expo', duration: 0.45 }, { k: 'move', dx: -0.6, dy: 0, dir: 'out' }, ['Out', 'Slide', 'Blur'], 'OUT'),
  T('riseBlur', 'Rise + Blur', 'quick.animate', { kind: 'moveBT', dir: 'in', distance: 60, fade: true, blur: 24, ease: 'smooth', duration: 0.7 }, { k: 'move', dx: 0, dy: 0.3, dir: 'in' }, ['In', 'Slide', 'Blur'], 'IN'),
  // v0.59 (docs/features/STYLES_SHAKES.md): impacts as real keys — Shake mode
  ...Object.entries(require('../../../features/quick/shakePlan').TYPES).map(([id, sh]) => Object.assign(T(`shake-${id}`, sh.label, 'quick.shake', { type: id, intensity: sh.intensity, rotation: sh.rotation, frequency: sh.frequency, settle: sh.settle }, { k: 'shake', type: id }, ['Shake'], 'NEW'), { hint: sh.hint })),
  T('gentlePop', 'Soft Pop', 'quick.animate', { kind: 'scale', dir: 'in', ease: 'gentle', duration: 0.8 }, { k: 'scale', dir: 'in' }, ['In', 'Scale'], 'IN'),
  T('spinOut', 'Spin Out', 'quick.animate', { kind: 'spin', dir: 'out' }, { k: 'spin', dir: 'out' }, ['Out'], 'OUT'),
  T('popOut', 'Pop Out', 'quick.animate', { kind: 'scale', dir: 'out', overshoot: true, duration: 0.45 }, { k: 'scale', dir: 'out', over: true }, ['Out', 'Scale'], 'OUT'),
  T('easeExpo', 'Expo Ease', 'motion.smartEase', { influenceIn: 95, influenceOut: 95 }, { k: 'ease', a: 0.95, b: 0.95 }, ['Keys', 'Ease'], 'EASE'),
  T('easeDecel', 'Decelerate', 'motion.smartEase', { influenceIn: 85, influenceOut: 10 }, { k: 'ease', a: 0.1, b: 0.85 }, ['Keys', 'Ease'], 'EASE'),
  T('easeHard', 'Hard Stop', 'motion.smartEase', { influenceIn: 100, influenceOut: 5 }, { k: 'ease', a: 0.05, b: 1 }, ['Keys', 'Ease'], 'EASE'),
  T('easeAccel', 'Accelerate', 'motion.smartEase', { influenceIn: 10, influenceOut: 85 }, { k: 'ease', a: 0.85, b: 0.1 }, ['Keys', 'Ease'], 'EASE'),
  T('easeLaunch', 'Launch', 'motion.smartEase', { influenceIn: 5, influenceOut: 100 }, { k: 'ease', a: 1, b: 0.05 }, ['Keys', 'Ease'], 'EASE'),
  T('proxGrow', 'Proximity Grow', 'proximity.apply', { scaleUp: true, scaleDown: false, pushAway: false }, { k: 'prox', mode: 'grow' }, ['Proximity'], 'FX'),
  T('proxRepel', 'Proximity Repel', 'proximity.apply', { scaleUp: false, pushAway: true, pullToward: false }, { k: 'prox', mode: 'repel' }, ['Proximity'], 'FX')
];

const LAYOUT = [
  T('grid', 'Grid', 'grid.build', { mode: 'rect', order: '1', rowOffset: 0 }, { k: 'grid', mode: 'rect' }, ['Arrange', 'Grid']),
  T('honey', 'Honeycomb', 'grid.build', { mode: 'rect', order: '1', rowOffset: 50 }, { k: 'grid', mode: 'rect', rowOffset: 50 }, ['Arrange', 'Grid']),
  T('wall', 'Wall Build', 'grid.build', { mode: 'rect', animateIn: true, buildStyle: '4', buildOrder: '3' }, { k: 'grid', mode: 'rect', build: true }, ['Arrange', 'Grid', 'Animated']),
  T('ring', 'Ring', 'grid.build', { mode: 'radial', arc: 360, faceCenter: true }, { k: 'grid', mode: 'radial' }, ['Arrange', 'Radial']),
  T('fan', 'Fan', 'grid.build', { mode: 'radial', arc: 120, faceCenter: true }, { k: 'grid', mode: 'radial', arc: 120 }, ['Arrange', 'Radial']),
  T('spiral', 'Spiral', 'grid.build', { mode: 'spiral' }, { k: 'grid', mode: 'spiral' }, ['Arrange', 'Radial']),
  T('galaxy', 'Sunflower', 'grid.build', { mode: 'phyllo', animateIn: true, buildStyle: '1', buildOrder: '3' }, { k: 'grid', mode: 'phyllo', build: true }, ['Arrange', 'Radial', 'Animated']),
  T('path', 'On a Path', 'grid.build', { mode: 'path' }, { k: 'grid', mode: 'path' }, ['Arrange', 'Path']),
  T('globe', 'Globe 3D', 'grid.build', { mode: 'sphere' }, { k: 'grid', mode: 'sphere' }, ['Arrange', '3D']),
  // v0.33 Cloner: one selected layer (or a few) → N live copies on a MOE Grid (sources cycle)
  T('cloneGrid', 'Clone Grid 5×5', 'grid.build', { mode: 'rect', clones: 25, columns: 5, animateIn: true, buildStyle: '4', buildOrder: '3' }, { k: 'grid', mode: 'rect', clone: true, build: true }, ['Clone']),
  T('cloneRow', 'Clone Row', 'grid.build', { mode: 'rect', clones: 8, columns: 8 }, { k: 'grid', mode: 'rect', clone: true, row: true }, ['Clone']),
  T('cloneRing', 'Clone Ring', 'grid.build', { mode: 'radial', clones: 12, arc: 360, orient: '2' }, { k: 'grid', mode: 'radial', clone: true }, ['Clone']),
  T('cloneSpiral', 'Clone Spiral', 'grid.build', { mode: 'spiral', clones: 24, orient: '2' }, { k: 'grid', mode: 'spiral', clone: true }, ['Clone']),
  T('cloneSun', 'Clone Sunflower', 'grid.build', { mode: 'phyllo', clones: 60, animateIn: true, buildStyle: '1', buildOrder: '3' }, { k: 'grid', mode: 'phyllo', clone: true, build: true }, ['Clone']),
  T('cloneGlobe', 'Clone Globe', 'grid.build', { mode: 'sphere', clones: 50 }, { k: 'grid', mode: 'sphere', clone: true }, ['Clone']),
  // v0.34 Clone Colours: a palette over the items (live on the grid null; effectors with Colour Mix tint them)
  T('colCycle', 'Colour Cycle', 'grid.colour', { mode: 'cycle', palette: 'tomato' }, { k: 'cloneCol', mode: 1 }, ['Clone']),
  T('colGradient', 'Colour Gradient', 'grid.colour', { mode: 'gradient', palette: 'ocean' }, { k: 'cloneCol', mode: 2 }, ['Clone']),
  T('colRandom', 'Colour Random', 'grid.colour', { mode: 'random', palette: 'candy', seed: 3 }, { k: 'cloneCol', mode: 3 }, ['Clone']),
  // v0.37 Object Cloner (one copy on each point of a shape — select the layer and the shape) and Text Cloner (words / letters in place)
  T('clonePoints', 'Clone on Points', 'grid.build', { mode: 'points', orient: '2' }, { k: 'grid', mode: 'points', clone: true }, ['Clone']),
  T('textWords', 'Text Cloner', 'grid.build', { mode: 'keep', splitText: 'words' }, { k: 'grid', mode: 'keep', text: 'words' }, ['Clone']),
  T('textLetters', 'Letters Rise', 'grid.build', { mode: 'keep', splitText: 'letters', animateIn: true, buildStyle: '3', buildOrder: '1', stagger: 70 }, { k: 'grid', mode: 'keep', text: 'letters', build: true, bs: 3 }, ['Clone']),
  // v0.41 Clone Trails: copies that replay the selected layer's own motion later (features/grid/trail.js)
  T('trailEcho', 'Echo Trail', 'grid.trail', { copies: 8, delay: 2, fade: 12, scaleStep: 0, rotateStep: 0 }, { k: 'trail', copies: 8, delay: 2, fade: 12, scaleStep: 0 }, ['Clone']),
  T('trailGhost', 'Ghost Trail', 'grid.trail', { copies: 12, delay: 1, fade: 8, scaleStep: 4, rotateStep: 0 }, { k: 'trail', copies: 12, delay: 1, fade: 8, scaleStep: 4 }, ['Clone']),
  T('trailSpin', 'Spin Trail', 'grid.trail', { copies: 8, delay: 3, fade: 15, scaleStep: 0, rotateStep: 15 }, { k: 'trail', copies: 8, delay: 3, fade: 15, scaleStep: 0, rotateStep: 15 }, ['Clone']),
  // v0.93 controls on demand for the grid null: it arrives with what it uses — this adds the rest (features/grid/gridControls.js)
  T('gridSliders', 'Grid Sliders', 'grid.controls', { group: 'all' }, { k: 'icon', icon: 'sliders' }, ['Clone']),
  // v0.91 (React 3 study): lines between a grid's items that follow them (features/grid/tracer.js)
  T('trOrder', 'Tracer Line', 'grid.tracer', { mode: 'order' }, { k: 'tracer', mode: 'order' }, ['Clone']),
  T('trGrid', 'Tracer Grid', 'grid.tracer', { mode: 'grid' }, { k: 'tracer', mode: 'grid' }, ['Clone']),
  T('trZig', 'Tracer Zig-zag', 'grid.tracer', { mode: 'zigzag' }, { k: 'tracer', mode: 'zigzag' }, ['Clone']),
  T('trHub', 'Tracer Hub', 'grid.tracer', { mode: 'hub' }, { k: 'tracer', mode: 'hub' }, ['Clone']),
  // v0.33 Effectors: a null that changes the grid's items near it (select the grid null or an item)
  T('efPush', 'Grow', 'grid.effector', { type: 'plain', falloff: 'sphere', scale: 80, softness: 70, sweep: true }, { k: 'eff', type: 'plain', falloff: 'sphere', scale: 80 }, ['Effectors']),
  T('efReveal', 'Reveal', 'grid.effector', { type: 'plain', falloff: 'linear', scale: -100, invert: true, sweep: true }, { k: 'eff', type: 'plain', falloff: 'linear', scale: -100, invert: true }, ['Effectors']),
  T('efScatter', 'Scatter', 'grid.effector', { type: 'random', falloff: 'all', moveX: 80, moveY: 80, rotate: 60, scale: 0 }, { k: 'eff', type: 'random', falloff: 'all', moveX: 40, moveY: 40, rotate: 60 }, ['Effectors']),
  T('efStep', 'Step', 'grid.effector', { type: 'step', falloff: 'all', scale: 100, rotate: 90 }, { k: 'eff', type: 'step', falloff: 'all', scale: 100, rotate: 90 }, ['Effectors']),
  T('efWave', 'Wave', 'grid.effector', { type: 'noise', falloff: 'all', moveY: 50, rotate: 20, scale: 0, noiseScale: 250, noiseSpeed: 120 }, { k: 'eff', type: 'noise', falloff: 'all', moveY: 22, rotate: 20 }, ['Effectors']),
  T('efShrink', 'Shrink', 'grid.effector', { type: 'plain', falloff: 'sphere', scale: -70, softness: 70, sweep: true }, { k: 'eff', type: 'plain', falloff: 'sphere', scale: -70 }, ['Effectors']),
  T('efTint', 'Tint', 'grid.effector', { type: 'plain', falloff: 'sphere', scale: 0, colour: '#FFFFFF', colourMix: 100, softness: 60, sweep: true }, { k: 'eff', type: 'plain', falloff: 'sphere', tint: true }, ['Effectors']),
  T('efCascade', 'Cascade', 'grid.effector', { type: 'delay', falloff: 'all', moveY: 80, fade: 100, scale: 0, delay: 2 }, { k: 'eff', type: 'delay', falloff: 'all', moveY: 30, fade: 100 }, ['Effectors']),
  // v0.35 Spring / Inertia: the items follow the effector through a damped spring (features/grid/effectors.js springTerms)
  T('efSpring', 'Spring Grow', 'grid.effector', { type: 'plain', falloff: 'sphere', scale: 80, softness: 60, spring: 100, frequency: 3, decay: 5, sweep: true }, { k: 'eff', type: 'plain', falloff: 'sphere', scale: 80, spring: 100, frequency: 3, decay: 5 }, ['Effectors']),
  T('efJelly', 'Jelly', 'grid.effector', { type: 'plain', falloff: 'sphere', scale: 40, rotate: 25, softness: 60, spring: 100, frequency: 4, decay: 3, sweep: true }, { k: 'eff', type: 'plain', falloff: 'sphere', scale: 40, rotate: 25, spring: 100, frequency: 4, decay: 3 }, ['Effectors']),
  T('efInertia', 'Inertia', 'grid.effector', { type: 'plain', falloff: 'sphere', moveY: -60, scale: 0, softness: 60, spring: 100, frequency: 0, decay: 6, sweep: true }, { k: 'eff', type: 'plain', falloff: 'sphere', moveY: -30, spring: 100, frequency: 0, decay: 6 }, ['Effectors']),
  T('efBounce', 'Bounce Up', 'grid.effector', { type: 'plain', falloff: 'linear', moveY: -80, scale: 0, spring: 100, frequency: 2, decay: 4, sweep: true }, { k: 'eff', type: 'plain', falloff: 'linear', moveY: -8, spring: 100, frequency: 2, decay: 4 }, ['Effectors']),
  // v0.36 Target (the items face the effector) and Audio (the moves follow a soundtrack's loudness)
  T('efAim', 'Aim', 'grid.effector', { type: 'target', falloff: 'all', scale: 0, sweep: true }, { k: 'eff', type: 'target', falloff: 'all' }, ['Effectors']),
  T('efLook', 'Face Near', 'grid.effector', { type: 'target', falloff: 'sphere', size: 0, softness: 70, scale: 20, spring: 100, frequency: 2.5, decay: 5, sweep: true }, { k: 'eff', type: 'target', falloff: 'sphere', scale: 20, spring: 100, frequency: 2.5, decay: 5 }, ['Effectors']),
  T('efBeat', 'Beat Pulse', 'grid.effector', { type: 'audio', falloff: 'all', scale: 60, delay: 0 }, { k: 'eff', type: 'audio', falloff: 'all', scale: 30, delay: 0 }, ['Effectors']),
  T('efBeatWave', 'Beat Wave', 'grid.effector', { type: 'audio', falloff: 'all', moveY: -60, scale: 20, delay: 3 }, { k: 'eff', type: 'audio', falloff: 'all', moveY: -18, scale: 20, delay: 3 }, ['Effectors']),
  // v0.38 Field falloffs: a drifting Noise Field, and the brightness of a layer (Image — select it with the grid)
  T('efField', 'Noise Grow', 'grid.effector', { type: 'plain', falloff: 'noise', size: 0, softness: 50, scale: 70, fieldSpeed: 50 }, { k: 'eff', type: 'plain', falloff: 'noise', scale: 35, softness: 50, fieldSpeed: 50 }, ['Effectors']),
  T('efFlicker', 'Noise Flicker', 'grid.effector', { type: 'plain', falloff: 'noise', size: 0, softness: 0, scale: 0, fade: 100, fieldSpeed: 200 }, { k: 'eff', type: 'plain', falloff: 'noise', softness: 0, fade: 100, fieldSpeed: 200 }, ['Effectors']),
  T('efImage', 'Image Grow', 'grid.effector', { type: 'plain', falloff: 'image', scale: 100 }, { k: 'eff', type: 'plain', falloff: 'image', scale: 45 }, ['Effectors']),
  T('efImageReveal', 'Image Reveal', 'grid.effector', { type: 'plain', falloff: 'image', invert: true, scale: -100 }, { k: 'eff', type: 'plain', falloff: 'image', invert: true, scale: -100 }, ['Effectors']),
  // v0.88 (React 3 study): Wave effectors, Snap To and Clamp (features/grid/effectors.js waveAt / modify)
  T('efRipple', 'Ripple', 'grid.effector', { type: 'wave', falloff: 'all', moveY: 40, scale: 0, waveShape: 'sine', waveLength: 6, waveSpeed: 0.6 }, { k: 'eff', type: 'wave', falloff: 'all', moveY: 12, waveShape: 'sine', waveLength: 7, waveSpeed: 0.6 }, ['Effectors']),
  T('efPulseSteps', 'Square Pulse', 'grid.effector', { type: 'wave', falloff: 'all', scale: 40, waveShape: 'square', waveLength: 4, waveSpeed: 0.5 }, { k: 'eff', type: 'wave', falloff: 'all', scale: 30, waveShape: 'square', waveLength: 4, waveSpeed: 0.5 }, ['Effectors']),
  T('efSawFade', 'Saw Fade', 'grid.effector', { type: 'wave', falloff: 'all', scale: 0, fade: 45, waveShape: 'rampDown', waveLength: 7, waveSpeed: 0.7 }, { k: 'eff', type: 'wave', falloff: 'all', fade: 45, waveShape: 'rampDown', waveLength: 7, waveSpeed: 0.7 }, ['Effectors']),
  T('efSnapTurn', 'Snap Turn', 'grid.effector', { type: 'noise', falloff: 'all', rotate: 180, scale: 0, snapRotate: 45, noiseScale: 150, noiseSpeed: 60 }, { k: 'eff', type: 'noise', falloff: 'all', rotate: 180, snapRotate: 45, noiseScale: 150, noiseSpeed: 60 }, ['Effectors']),
  // v0.89 (React 3 study): Attract / Repel and Absolute moves (features/grid/effectors.js termsAt, Move Mode)
  T('efMagnet', 'Magnet', 'grid.effector', { type: 'plain', falloff: 'sphere', moveMode: 'attract', moveX: 120, scale: 0, softness: 80, sweep: true }, { k: 'eff', type: 'plain', falloff: 'sphere', moveMode: 'attract', moveX: 26, softness: 80 }, ['Effectors']),
  T('efRepel', 'Repel', 'grid.effector', { type: 'plain', falloff: 'sphere', moveMode: 'attract', moveX: -90, scale: 0, softness: 80, sweep: true }, { k: 'eff', type: 'plain', falloff: 'sphere', moveMode: 'attract', moveX: -22, softness: 80 }, ['Effectors']),
  T('efGather', 'Gather', 'grid.effector', { type: 'plain', falloff: 'sphere', moveMode: 'absolute', scale: 0, softness: 70, falloffCurve: 'easeIn', sweep: true }, { k: 'eff', type: 'plain', falloff: 'sphere', moveMode: 'absolute', softness: 70, falloffCurve: 'easeIn' }, ['Effectors']),
  // v0.87 Controls on demand: an effector arrives with the sliders it uses — this adds the rest (features/grid/effectorControls.js)
  T('efControls', 'More Sliders', 'grid.effectorControls', { group: 'all' }, { k: 'icon', icon: 'sliders' }, ['Effectors']),
  // v0.92 (React 3 study): the effectors drive any number property of the items (features/grid/effectProperty.js)
  T('efProperty', 'Effector on Property', 'grid.effectProperty', { amount: 50 }, { k: 'icon', icon: 'target' }, ['Effectors']),
  // v0.90 (React 3 study): take one effector away, or keep what it does at this frame (features/grid/effectorRemove.js)
  T('efFreeze', 'Freeze Effector', 'grid.effectorFreeze', {}, { k: 'icon', icon: 'lock' }, ['Effectors']),
  T('efRemove', 'Remove Effector', 'grid.effectorRemove', {}, { k: 'icon', icon: 'trash' }, ['Effectors']),
  T('g12', '12 Columns', 'grid.guides', { columns: 12, rows: 1, gutterX: 24, marginX: 96, marginY: 72 }, { k: 'guides', c: 12, r: 1 }, ['Guides']),
  T('thirds', 'Thirds', 'grid.guides', { columns: 3, rows: 3, gutterX: 0, gutterY: 0, marginX: 0, marginY: 0 }, { k: 'guides', c: 3, r: 3 }, ['Guides']),
  // v0.53 guide presets (features/grid/guidePresets.js): composition lines, broadcast safe, social safe zones, clear
  T('gpCenter', 'Centre Guides', 'grid.guidePreset', { preset: 'center' }, { k: 'gpreset', id: 'center' }, ['Guides']),
  T('gpGolden', 'Golden Ratio', 'grid.guidePreset', { preset: 'golden' }, { k: 'gpreset', id: 'golden' }, ['Guides']),
  T('gpTv', 'Title / Action Safe', 'grid.guidePreset', { preset: 'tvSafe' }, { k: 'gpreset', id: 'tvSafe' }, ['Guides']),
  T('safe', 'Safe Area', 'grid.guides', { columns: 1, rows: 1, marginX: 96, marginY: 54, gutterX: 0, gutterY: 0, center: true }, { k: 'guides', c: 1, r: 1, safe: true }, ['Guides']),
  T('gpClear', 'Clear Guides', 'grid.guidePreset', { preset: 'clear' }, { k: 'gpreset', id: 'clear' }, ['Guides']),
  T('gpTiktok', 'TikTok Safe', 'grid.guidePreset', { preset: 'tiktok' }, { k: 'gpreset', id: 'tiktok' }, ['Guides'], 'NEW'),
  T('gpReels', 'Reels Safe', 'grid.guidePreset', { preset: 'reels' }, { k: 'gpreset', id: 'reels' }, ['Guides'], 'NEW'),
  T('gpShorts', 'Shorts Safe', 'grid.guidePreset', { preset: 'shorts' }, { k: 'gpreset', id: 'shorts' }, ['Guides'], 'NEW'),
  T('gpStories', 'Stories Safe', 'grid.guidePreset', { preset: 'stories' }, { k: 'gpreset', id: 'stories' }, ['Guides'], 'NEW'),
  T('split2', 'Split 2', 'grid.placeInCells', { columns: 2, rows: 1, gutterX: 0, marginX: 0, marginY: 0, fit: 'fill', padding: 0 }, { k: 'cells', c: 2, r: 1 }, ['Cells']),
  // v0.63 (WIPE_CAROUSEL.md): a 3D ring that steps one card at a time, back cards fading — native keys on one null
  Object.assign(T('carousel', 'Carousel 3D', 'layout.carousel', { turn: 0.7, hold: 1.2, gap: 60, depth: 60 }, { k: 'carousel' }, ['Arrange', '3D', 'Animated'], 'NEW'), { hint: 'The selected cards on a 3D ring that turns one card at a time; the back ones fade' }),
  Object.assign(T('carouselTilt', 'Carousel · Tilted', 'layout.carousel', { turn: 0.8, hold: 1, gap: 40, depth: 70, tilt: 12 }, { k: 'carousel', tilt: 12 }, ['Arrange', '3D', 'Animated'], 'NEW'), { hint: 'The same ring leaning toward the camera' }),
  Object.assign(T('carouselQuick', 'Carousel · Quick', 'layout.carousel', { turn: 0.45, hold: 0.6, gap: 60, depth: 50 }, { k: 'carousel' }, ['Arrange', '3D', 'Animated'], 'NEW'), { hint: 'Short holds, fast turns — for a lively showcase' }),
  T('quad', '2 × 2', 'grid.placeInCells', { columns: 2, rows: 2, gutterX: 12, gutterY: 12, marginX: 0, marginY: 0, fit: 'fill', padding: 0 }, { k: 'cells', c: 2, r: 2 }, ['Cells']),
  T('wall6', '3 × 2 Tiles', 'grid.placeInCells', { columns: 3, rows: 2 }, { k: 'cells', c: 3, r: 2 }, ['Cells'])
];

const LOOK_FAMILY = { clear: 'Clear', crystal: 'Clear', frosted: 'Frosted', ice: 'Frosted', liquid: 'Liquid', tinted: 'Tinted', smoke: 'Tinted' };
// Thick Glass (v0.27) first: the Glaze-class refractive looks, then the flat UI glass looks.
// v0.59 (docs/features/STYLES_SHAKES.md): Styles — a finished look from After Effects' own effects
const STYLE_TILES = Object.entries(require('../../../features/design/styles').STYLES).map(([id, st]) => Object.assign(T(`style-${id}`, st.label, 'design.style', { style: id, amount: 1 }, { k: 'style', style: id }, ['Styles'], 'NEW'), { hint: st.hint }));
const THICK_TILES = Object.entries(THICK_LOOKS).map(([id, l]) => T(`thick-${id}`, l.label, 'glass.thick', { look: id }, { k: 'thick', look: id }, ['Thick']));
const LOOK_TILES = THICK_TILES.concat(Object.entries(LOOKS).map(([id, l]) => T(`glass-${id}`, `${l.label} Glass`, 'glass.apply', { look: id }, { k: 'glass', look: id }, [LOOK_FAMILY[id] || 'Clear'])));

const ZOOM = [
  T('punch', 'Punch-in', 'zoom.focus', { level: 150, inDur: 0.25, ease: 'snappy', zoomOut: true, hold: 2, outDur: 0.3 }, { k: 'zoom', z: 1.5 }, ['Zoom']),
  T('smooth', 'Smooth Zoom', 'zoom.focus', { level: 200, inDur: 0.8, ease: 'smooth', zoomOut: true }, { k: 'zoom', z: 2 }, ['Zoom']),
  T('detail', 'Detail', 'zoom.focus', { level: 350, inDur: 0.7, ease: 'expo', zoomOut: true, hold: 1.2 }, { k: 'zoom', z: 3.5 }, ['Zoom']),
  T('stay', 'Stay In', 'zoom.focus', { zoomOut: false, level: 180 }, { k: 'zoom', z: 1.8, stay: true }, ['Zoom']),
  T('spot', 'Spotlight', 'zoom.focus', { level: 160, spotlight: 55 }, { k: 'zoom', z: 1.6, spot: true }, ['Focus']),
  T('follow', 'Follow Layer', 'zoom.follow', {}, { k: 'follow' }, ['Focus']),
  T('cursorArrow', 'Cursor · Arrow', 'zoom.cursor', { kind: 'arrow' }, { k: 'cursor', hand: false }, ['Cursor']),
  T('cursorHand', 'Cursor · Hand', 'zoom.cursor', { kind: 'hand' }, { k: 'cursor', hand: true }, ['Cursor']),
  // v0.60: the cursor that clicks the selected layers themselves (no click-point null to key)
  T('clickLayers', 'Cursor · Clicks', 'interact.click', { kind: 'arrow' }, { k: 'click', hand: false }, ['Cursor'], 'NEW')
];

// A tile carries its preset's own numbers (the form's generic defaults would override them otherwise).
const EXPRESSIONS = Object.entries(EXPR).map(([id, p]) => Object.assign(T(`x-${id}`, p.label, 'expressions.quick', Object.assign({ preset: id }, p.nums), { k: 'expr', preset: id }, [p.tag || 'Periodic']), { hint: p.hint }));

// Compositing (v0.7): one tile per tool — analyse, grade, match, key, green screen.
const COMP_TOOLS = [...require('../../../features/compositing/index'), require('../../../features/generate/green').greenPrompt, require('../../../features/generate/green').importKey];
const COMP_TAG = { Analyze: 'Analyze', Color: 'Color', Key: 'Key', 'Generate on Green': 'Green screen' };
// Tools that need something only the user can give (a look description, a reference layer, a file)
// are "setup" tiles: ▶ opens their settings instead of running.
const COMPOSITING = COMP_TOOLS.map((t) => Object.assign(T(`c-${t.id}`, t.name, t.id, {}, { k: 'icon', icon: t.icon || 'layers' }, [COMP_TAG[t.group] || 'Color']),
  { hint: t.description, needsInput: Object.values(t.params || {}).some((p) => p.required && p.default === undefined) }));

// v0.60: product backdrops open on their own look — a glow behind the UI, a studio sweep, a slow aurora — with fine grain
const PRODUCT_BG = {
  productNight: { style: 'radial', from: 2, to: 0, spread: 130, grain: 3 },
  studioLight: { style: 'radial', from: 4, to: 0, spread: 160, grain: 2 },
  auroraProduct: { style: 'mesh', from: 0, grain: 3, motion: 'drift' },
  graphite: { style: 'radial', from: 2, to: 0, spread: 120, grain: 4 }
};
// v0.75 Signature looks: each palette with the style and motion it was made for (loops exactly — bgMotion rules)
const SIG = (style, motion, colorMotion, extra) => Object.assign({ style, motion, colorMotion: colorMotion || 'none', grain: 2, loop: 10, amount: 35 }, extra || {});
Object.assign(PRODUCT_BG, {
  liquidChrome: SIG('mesh', 'wander', 'none', { from: 0 }), peachFuzz: SIG('mesh', 'drift', 'none', { from: 1 }),
  mochaMousse: SIG('radial', 'breathe', 'none', { from: 2, to: 0, spread: 140 }), electricLime: SIG('mesh', 'orbit', 'none', { from: 0 }),
  ultraDream: SIG('mesh', 'swirl', 'cycle', { from: 0, loop: 12 }), northernLights: SIG('mesh', 'wave', 'none', { from: 0 }),
  tokyoNight: SIG('radial', 'drift', 'pulse', { from: 3, to: 0, spread: 130 }), miamiSunset: SIG('linear', 'breathe', 'none', { from: 0, to: 3, angle: 160 }),
  desertRose: SIG('mesh', 'drift', 'none', { from: 1 }), matchaLatte: SIG('radial', 'breathe', 'none', { from: 3, to: 1, spread: 150 }),
  oceanGlass: SIG('mesh', 'wander', 'none', { from: 0 }), holographic: SIG('mesh', 'swirl', 'hue', { from: 0, amount: 30 }),
  emberGlow: SIG('radial', 'breathe', 'pulse', { from: 3, to: 0, spread: 120 }), cosmicLatte: SIG('mesh', 'drift', 'none', { from: 1 }),
  neoMint: SIG('linear', 'wave', 'none', { from: 1, to: 3, angle: 120 }), midnightGold: SIG('radial', 'drift', 'none', { from: 3, to: 0, spread: 125 })
});
const BACKGROUNDS = PAL.PALETTES.map((p) => { const x = PRODUCT_BG[p.id]; const a = Object.assign({ palette: p.id, style: 'linear', from: 0, to: 2 }, x); const t = T(`bg-${p.id}`, p.name, 'design.background', a, Object.assign({ k: 'bg' }, a), p.tags, x ? 'NEW' : undefined); if (x) t.ownLook = true; return t; });

/**
 * kind: 'library' (tiles + inspector) | 'view' (custom view id) | 'category' (classic tool list)
 * categories: tool categories / ids listed under "All tools".
 */
// v0.49 (docs/features/TEMPLATES.md): native templates — real text + shape layers sized to the text, one null, the entrance keyed
const TPL_T = (id, label, args, tags) => T(`tpl-${id}`, label, 'design.template', args, { k: 'template', id: args.template }, tags, 'NEW');
const TEMPLATE_TILES = [
  TPL_T('lowerThird', 'Lower Third', { template: 'lowerThird', hold: 3 }, ['Titles']),
  TPL_T('titleCard', 'Title Card', { template: 'titleCard' }, ['Titles']),
  TPL_T('callout', 'Callout', { template: 'callout' }, ['Callouts']),
  TPL_T('tag', 'Tag', { template: 'tag' }, ['Callouts']),
  // v0.50: four more, and the lower thirds leave by themselves after Hold
  TPL_T('handle', 'Social Handle', { template: 'handle', hold: 3 }, ['Callouts']),
  TPL_T('quote', 'Quote', { template: 'quote' }, ['Titles']),
  TPL_T('chapter', 'Chapter', { template: 'chapter' }, ['Titles']),
  TPL_T('endCard', 'End Card', { template: 'endCard' }, ['Outro']),
  TPL_T('lowerThirdAr', 'شريط الاسم', { template: 'lowerThird', title: 'سارة أحمد', subtitle: 'مصممة موشن جرافيك', hold: 3 }, ['Titles', 'Arabic']),
  TPL_T('quoteAr', 'اقتباس', { template: 'quote', title: 'الحركة تحكي القصة', subtitle: 'سارة أحمد' }, ['Titles', 'Arabic']),
  TPL_T('endCardAr', 'شكراً للمشاهدة', { template: 'endCard', title: 'شكراً للمشاهدة', subtitle: 'اشترك الآن' }, ['Outro', 'Arabic']),
  TPL_T('titleCardAr', 'عنوان كبير', { template: 'titleCard', title: 'الإطلاق الكبير', subtitle: 'قريباً هذا الصيف' }, ['Titles', 'Arabic'])
];
TEMPLATE_TILES.forEach((t) => { t.hint = (require('../../../features/design/templates').byId(t.args.template) || {}).hint; });
// v0.57 (docs/features/PRODUCT_UI.md): Product UI — interface pieces that animate the way they are used (click, switch,
// type, fill), for SaaS / app / product videos; the same engine as Templates, in the brand when a client is active
const UI_T = (id, label, args, tags) => T(`ui-${id}`, label, 'design.template', Object.assign({ accent: '#0A84FF' }, args), { k: 'template', id: args.template }, tags, 'NEW');
const UI_TILES = [
  UI_T('button', 'Button Click', { template: 'uiButton' }, ['Controls']),
  UI_T('toggle', 'Toggle Switch', { template: 'uiToggle' }, ['Controls']),
  UI_T('search', 'Search Bar', { template: 'uiSearch' }, ['Controls']),
  UI_T('task', 'Task Done', { template: 'uiTask' }, ['Controls']),
  UI_T('notify', 'Notification', { template: 'uiNotify', hold: 2 }, ['Feedback']),
  UI_T('progress', 'Progress Bar', { template: 'uiProgress' }, ['Feedback']),
  UI_T('chat', 'Chat Message', { template: 'uiChat' }, ['Feedback']),
  UI_T('stat', 'Stat Card', { template: 'uiStat' }, ['Data']),
  // the dark look of the pieces a dark product page uses most
  UI_T('notifyDark', 'Notification · Dark', { template: 'uiNotify', theme: 'dark', hold: 2 }, ['Feedback', 'Dark']),
  UI_T('statDark', 'Stat Card · Dark', { template: 'uiStat', theme: 'dark' }, ['Data', 'Dark']),
  UI_T('toggleDark', 'Toggle · Dark', { template: 'uiToggle', theme: 'dark' }, ['Controls', 'Dark']),
  UI_T('taskDark', 'Task · Dark', { template: 'uiTask', theme: 'dark' }, ['Controls', 'Dark'])
];
UI_TILES.forEach((t) => { t.hint = (require('../../../features/design/templates').byId(t.args.template) || {}).hint; });
// v0.60 (docs/features/SAAS_INTERACTION.md): Interact — a cursor that clicks the real layers, and a UI that builds in reading order
const REVEAL = { kind: 'moveBT', dir: 'in', distance: 40, fade: true, blur: 12, stagger: 0.06, ease: 'smooth', duration: 0.7 };
const INTERACT_TILES = [
  Object.assign(T('ui-click', 'Click on Layer', 'interact.click', { kind: 'arrow', from: 'corner' }, { k: 'click', hand: false }, ['Interact'], 'NEW'), { hint: 'Select the layers in click order: the cursor goes to each one\'s real centre and the layer presses with it' }),
  Object.assign(T('ui-tap', 'Tap', 'interact.click', { kind: 'hand', from: 'side', depth: 92 }, { k: 'click', hand: true }, ['Interact'], 'NEW'), { hint: 'A hand cursor that taps each selected layer, for touch and mobile UI' }),
  Object.assign(T('ui-reveal', 'UI Reveal', 'quick.animate', Object.assign({ order: 'screen' }, REVEAL), { k: 'uiReveal', order: 'screen' }, ['Interact'], 'NEW'), { hint: 'The selected UI rises in from a blur in reading order — rows top to bottom, left to right, measured on screen' }),
  Object.assign(T('ui-revealRtl', 'UI Reveal · RTL', 'quick.animate', Object.assign({ order: 'screenRtl' }, REVEAL), { k: 'uiReveal', order: 'screenRtl' }, ['Interact'], 'NEW'), { hint: 'The same build, right to left — for Arabic and Hebrew interfaces' }),
  Object.assign(T('ui-revealCenter', 'UI Pop · Centre Out', 'quick.animate', { kind: 'scale', dir: 'in', overshoot: true, fade: true, stagger: 0.05, order: 'center', ease: 'snappy', duration: 0.5 }, { k: 'uiReveal', order: 'center' }, ['Interact'], 'NEW'), { hint: 'The pieces pop in from the middle of the layout outwards' })
];

const SECTIONS = [
  { id: 'home', label: 'Home', icon: 'home', kind: 'view' },
  { id: 'kit', label: 'Toolbox', icon: 'kExcite', kind: 'view' },
  // v0.32 modes: In / Out / Draw On / Proximity are what the moves are for — one set at a time. The ease tiles
  // live in the Motion Control (graph + curve presets); they still resolve (Quick Bar, search) and show when searched.
  { id: 'animate', label: 'Motion', icon: 'motion', kind: 'library', tiles: ANIMATE, filters: ['All', 'In', 'Out', 'Slide', 'Fade', 'Scale', 'Blur', 'Wipe', 'Matte', 'FX', 'Depth', 'Trim', 'Ease', 'Keys', 'Proximity'],
    modes: [['In', 'In', 'The layer arrives'], ['Out', 'Out', 'The layer leaves'], ['Shake', 'Shake', 'An impact that settles back (real keys)'], ['Trim', 'Draw On', 'Trim paths for shape lines'], ['Proximity', 'Proximity', 'Layers react to a moving point']],
    elsewhere: [['kit', 'Ease', 'Ease presets and the speed graph are in Motion Control']], tools: (t) => t.category === 'motion' && !/^(zoom|interact)\./.test(t.id) && t.id !== 'motion.easeCurve' && t.id !== 'motion.pasteEase' || /^quick\.(animate|trimPaths|reverseKeys|mirrorKeys)$/.test(t.id) },
  { id: 'text', label: 'Text', icon: 'type', kind: 'view' },
  { id: 'kits', label: 'Style Kits', icon: 'sparkles', kind: 'view' }, // v0.75: each look's tools in one place (app/ui/kits.js)
  { id: 'expressions', label: 'Expressions', icon: 'expr', kind: 'library', tiles: EXPRESSIONS, filters: ['All', 'Random', 'Periodic', 'Keys', 'Auto'], tools: null, editor: true,
    // v0.66 (TOOL_CARDS.md): a list grouped by what each expression moves; the group that fits the selection comes first
    groupBy: (t) => (EXPR[t.args.preset] || {}).target, groups: [['position', 'Position'], ['rotation', 'Rotation'], ['scale', 'Scale'], ['opacity', 'Opacity'], ['keyed', 'Your keyframes']] },
  { id: 'productui', label: 'Product UI', icon: 'uiKit', kind: 'library', tiles: INTERACT_TILES.concat(UI_TILES), filters: ['All', 'Interact', 'Controls', 'Feedback', 'Data', 'Dark'], tools: (t) => t.id === 'design.template' || t.id === 'interact.click' },
  { id: 'templates', label: 'Templates', icon: 'type', kind: 'library', tiles: TEMPLATE_TILES, filters: ['All', 'Titles', 'Callouts', 'Outro', 'Arabic'], tools: (t) => t.id === 'design.template' },
  { id: 'shapes', label: 'Shapes & Icons', icon: 'shapes', kind: 'view' },
  { id: 'backgrounds', label: 'Backgrounds', icon: 'background', kind: 'library', composer: 'background', tiles: BACKGROUNDS, filters: PAL.TAGS, tools: (t) => /^design\.(background|colorize)$/.test(t.id), extras: 'palette' },
  { id: 'looks', label: 'Looks & Glass', icon: 'glass', kind: 'library', tiles: LOOK_TILES.concat(STYLE_TILES), filters: ['All', 'Styles', 'Thick', 'Clear', 'Frosted', 'Liquid', 'Tinted'], tools: (t) => /^glass\./.test(t.id) || t.id === 'design.style' },
  { id: 'brand', label: 'Brand', icon: 'brand', kind: 'view' },
  { id: 'layout', label: 'Layout & Grid', icon: 'grid', kind: 'library', tiles: LAYOUT, filters: ['All', 'Grid', 'Radial', 'Path', '3D', 'Animated', 'Guides', 'Cells', 'Clone', 'Effectors'],
    modes: [['Arrange', 'Arrange', 'Lay the selected layers out (grid, ring, spiral, globe…)'], ['Clone', 'Clone', 'One layer → many live copies on a grid (v0.33 Cloner)'], ['Effectors', 'Effectors', 'Change a grid’s items near a moving null: grow, reveal, scatter, step, wave, cascade'], ['Guides', 'Guides', 'Guides and safe areas on the comp'], ['Cells', 'Cells', 'Fit layers into split-screen cells']], tools: (t) => /^grid\./.test(t.id) },
  { id: 'zoom', label: 'Zoom & Focus', icon: 'zoom', kind: 'library', tiles: ZOOM, filters: ['All', 'Zoom', 'Focus', 'Cursor'], tools: (t) => /^(zoom|interact)\./.test(t.id) },
  { id: 'deliver', label: 'Deliver', icon: 'resize', kind: 'view' },
  { id: 'scene', label: 'Scene Check', icon: 'eye', kind: 'view' }, // v0.80: read the comp once — what fits, motion timeline, quality check, storyboard
  { id: 'compositing', label: 'Compositing', icon: 'layers', kind: 'library', tiles: COMPOSITING, filters: ['All', 'Analyze', 'Color', 'Key', 'Green screen'], tools: (t) => t.category === 'compositing' && !/^glass\./.test(t.id) },
  { id: 'quick', label: 'Quick Bar', icon: 'bolt', kind: 'view' },
  { id: 'select', label: 'Select', icon: 'cursor', kind: 'view' },
  { id: 'tools', label: 'My Tools', icon: 'tools', kind: 'view' }
];
/**
 * Workspaces (v0.8; Motion Kit added in v0.10): the sidebar shows Home + the workspaces instead of fifteen sections; each
 * workspace shows its sections as tabs. Ctrl 1–6 = Home + the workspaces. Users can hide
 * sections in Settings › Sidebar (a workspace with nothing left disappears).
 */
const WORKSPACES = [
  { id: 'ws-kit', label: 'Toolbox', icon: 'kExcite', items: ['kit'] },
  { id: 'ws-animate', label: 'Animate', icon: 'motion', items: ['animate', 'text', 'expressions'] },
  { id: 'ws-design', label: 'Design', icon: 'palette', items: ['kits', 'templates', 'productui', 'shapes', 'backgrounds', 'looks', 'brand'] },
  { id: 'ws-layout', label: 'Layout', icon: 'grid', items: ['layout', 'zoom', 'deliver'] },
  { id: 'ws-finish', label: 'Finish', icon: 'layers', items: ['compositing', 'scene'] },
  { id: 'ws-tools', label: 'Utilities', icon: 'tools', items: ['quick', 'select', 'tools'] } // v0.14: was "Tools" (too close to Toolbox)
];
/** v0.7 name for the same grouping. */
const GROUPS = WORKSPACES;
/** Kept for callers of v0.5–0.6: the utility sections that used to sit under the separator. */
const SECONDARY = SECTIONS.filter((x) => ['quick', 'select', 'brand', 'tools'].includes(x.id));
/** Every section in workspace order: Home, then the workspaces' sections. */
const NAV = ['home', ...WORKSPACES.flatMap((g) => g.items)];
const workspaceOf = (sectionId) => WORKSPACES.find((w) => w.items.includes(sectionId)) || null;
const UTILITY = [['favorites', 'Favorites', 'star'], ['history', 'History', 'history'], ['settings', 'Settings', 'gear']];

/** Old view ids (v0.3/0.4) → Studio sections. */
const ALIAS = { motion: 'animate', diagnostics: 'diagnostics' };

/** Section that owns a tool (for search / prefill / Copilot "open"). */
function sectionOf(tool) {
  const id = tool.id;
  if (/^zoom\./.test(id)) return 'zoom';
  if (/^(transform|kit)\./.test(id) || id === 'motion.easeCurve' || id === 'motion.pasteEase') return 'kit';
  if (/^glass\./.test(id)) return 'looks';
  if (/^adapt\./.test(id)) return 'deliver';
  if (id === 'design.insertShape') return 'shapes';
  if (/^design\./.test(id)) return 'backgrounds';
  if (/^grid\./.test(id)) return 'layout';
  if (/^quick\.(animate|trimPaths|reverseKeys|mirrorKeys)$/.test(id)) return 'animate';
  if (/^quick\./.test(id)) return 'quick';
  if (/^expressions\./.test(id)) return 'expressions';
  if (/^text\./.test(id)) return 'text';
  if (/^brand\./.test(id)) return 'brand';
  if (/^select\./.test(id)) return 'select';
  if (tool.category === 'motion') return 'animate';
  if (tool.category === 'compositing') return 'compositing';
  return tool.category;
}

/* v0.6 tiles get a NEW corner badge. */
const NEW_TILES = new Set(['blurIn', 'blurOut', 'focusIn', 'focusOut', 'whipIn', 'whipOut', 'riseBlur', 'riseFade', 'slideFadeIn', 'dropFade', 'zoomFadeIn', 'growFade', 'popFade', 'swingIn', 'sinkFade', 'slideFadeOut', 'zoomFadeOut', 'shrinkFade', 'swingOut', 'riseIn', 'dropIn', 'cascadeIn', 'cascadeFade', 'gentlePop', 'spinOut', 'popOut', 'easeExpo', 'easeDecel', 'easeHard', 'easeAccel', 'easeLaunch',
  ...['bounceBack', 'squash', 'orbit', 'swing', 'heartbeat', 'breathe', 'wiggleRot', 'wiggleScale', 'organic', 'loopWiggle', 'drift', 'clock', 'faceMotion', 'scatter', 'popIn', 'slideIn'].map((x) => `x-${x}`)]);
for (const sec of SECTIONS) for (const t of sec.tiles || []) if (NEW_TILES.has(t.id)) t.isNew = true;

const byId = (id) => SECTIONS.find((s) => s.id === id) || null;

module.exports = { SECTIONS, SECONDARY, WORKSPACES, GROUPS, NAV, UTILITY, ALIAS, sectionOf, byId, workspaceOf };
