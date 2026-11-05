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
  T('g12', '12 Columns', 'grid.guides', { columns: 12, rows: 1, gutterX: 24, marginX: 96, marginY: 72 }, { k: 'guides', c: 12, r: 1 }, ['Guides']),
  T('thirds', 'Thirds', 'grid.guides', { columns: 3, rows: 3, gutterX: 0, gutterY: 0, marginX: 0, marginY: 0 }, { k: 'guides', c: 3, r: 3 }, ['Guides']),
  T('safe', 'Safe Area', 'grid.guides', { columns: 1, rows: 1, marginX: 96, marginY: 54, gutterX: 0, gutterY: 0, center: true }, { k: 'guides', c: 1, r: 1, safe: true }, ['Guides']),
  T('split2', 'Split 2', 'grid.placeInCells', { columns: 2, rows: 1, gutterX: 0, marginX: 0, marginY: 0, fit: 'fill', padding: 0 }, { k: 'cells', c: 2, r: 1 }, ['Cells']),
  T('quad', '2 × 2', 'grid.placeInCells', { columns: 2, rows: 2, gutterX: 12, gutterY: 12, marginX: 0, marginY: 0, fit: 'fill', padding: 0 }, { k: 'cells', c: 2, r: 2 }, ['Cells']),
  T('wall6', '3 × 2 Tiles', 'grid.placeInCells', { columns: 3, rows: 2 }, { k: 'cells', c: 3, r: 2 }, ['Cells'])
];

const LOOK_FAMILY = { clear: 'Clear', crystal: 'Clear', frosted: 'Frosted', ice: 'Frosted', liquid: 'Liquid', tinted: 'Tinted', smoke: 'Tinted' };
// Thick Glass (v0.27) first: the Glaze-class refractive looks, then the flat UI glass looks.
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
  T('cursorHand', 'Cursor · Hand', 'zoom.cursor', { kind: 'hand' }, { k: 'cursor', hand: true }, ['Cursor'])
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

const BACKGROUNDS = PAL.PALETTES.map((p) => T(`bg-${p.id}`, p.name, 'design.background', { palette: p.id, style: 'linear', from: 0, to: 2 }, { k: 'bg', palette: p.id, style: 'linear' }, p.tags));

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

const SECTIONS = [
  { id: 'home', label: 'Home', icon: 'home', kind: 'view' },
  { id: 'kit', label: 'Toolbox', icon: 'kExcite', kind: 'view' },
  // v0.32 modes: In / Out / Draw On / Proximity are what the moves are for — one set at a time. The ease tiles
  // live in the Motion Control (graph + curve presets); they still resolve (Quick Bar, search) and show when searched.
  { id: 'animate', label: 'Motion', icon: 'motion', kind: 'library', tiles: ANIMATE, filters: ['All', 'In', 'Out', 'Slide', 'Fade', 'Scale', 'Trim', 'Ease', 'Keys', 'Proximity'],
    modes: [['In', 'In', 'The layer arrives'], ['Out', 'Out', 'The layer leaves'], ['Trim', 'Draw On', 'Trim paths for shape lines'], ['Proximity', 'Proximity', 'Layers react to a moving point']],
    elsewhere: [['kit', 'Ease', 'Ease presets and the speed graph are in Motion Control']], tools: (t) => t.category === 'motion' && !/^zoom\./.test(t.id) && t.id !== 'motion.easeCurve' && t.id !== 'motion.pasteEase' || /^quick\.(animate|trimPaths|reverseKeys|mirrorKeys)$/.test(t.id) },
  { id: 'text', label: 'Text', icon: 'type', kind: 'view' },
  { id: 'expressions', label: 'Expressions', icon: 'expr', kind: 'library', tiles: EXPRESSIONS, filters: ['All', 'Random', 'Periodic', 'Keys', 'Auto'], tools: null, editor: true },
  { id: 'templates', label: 'Templates', icon: 'type', kind: 'library', tiles: TEMPLATE_TILES, filters: ['All', 'Titles', 'Callouts', 'Outro', 'Arabic'], tools: (t) => t.id === 'design.template' },
  { id: 'shapes', label: 'Shapes & Icons', icon: 'shapes', kind: 'view' },
  { id: 'backgrounds', label: 'Backgrounds', icon: 'background', kind: 'library', tiles: BACKGROUNDS, filters: PAL.TAGS, tools: (t) => /^design\.(background|colorize)$/.test(t.id), extras: 'palette' },
  { id: 'looks', label: 'Looks & Glass', icon: 'glass', kind: 'library', tiles: LOOK_TILES, filters: ['All', 'Thick', 'Clear', 'Frosted', 'Liquid', 'Tinted'], tools: (t) => /^glass\./.test(t.id) },
  { id: 'brand', label: 'Brand', icon: 'brand', kind: 'view' },
  { id: 'layout', label: 'Layout & Grid', icon: 'grid', kind: 'library', tiles: LAYOUT, filters: ['All', 'Grid', 'Radial', 'Path', '3D', 'Animated', 'Guides', 'Cells', 'Clone', 'Effectors'],
    modes: [['Arrange', 'Arrange', 'Lay the selected layers out (grid, ring, spiral, globe…)'], ['Clone', 'Clone', 'One layer → many live copies on a grid (v0.33 Cloner)'], ['Effectors', 'Effectors', 'Change a grid’s items near a moving null: grow, reveal, scatter, step, wave, cascade'], ['Guides', 'Guides', 'Guides and safe areas on the comp'], ['Cells', 'Cells', 'Fit layers into split-screen cells']], tools: (t) => /^grid\./.test(t.id) },
  { id: 'zoom', label: 'Zoom & Focus', icon: 'zoom', kind: 'library', tiles: ZOOM, filters: ['All', 'Zoom', 'Focus', 'Cursor'], tools: (t) => /^zoom\./.test(t.id) },
  { id: 'deliver', label: 'Deliver', icon: 'resize', kind: 'view' },
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
  { id: 'ws-design', label: 'Design', icon: 'palette', items: ['templates', 'shapes', 'backgrounds', 'looks', 'brand'] },
  { id: 'ws-layout', label: 'Layout', icon: 'grid', items: ['layout', 'zoom', 'deliver'] },
  { id: 'ws-finish', label: 'Finish', icon: 'layers', items: ['compositing'] },
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
const NEW_TILES = new Set(['riseFade', 'slideFadeIn', 'dropFade', 'zoomFadeIn', 'growFade', 'popFade', 'swingIn', 'sinkFade', 'slideFadeOut', 'zoomFadeOut', 'shrinkFade', 'swingOut', 'riseIn', 'dropIn', 'cascadeIn', 'cascadeFade', 'gentlePop', 'spinOut', 'popOut', 'easeExpo', 'easeDecel', 'easeHard', 'easeAccel', 'easeLaunch',
  ...['bounceBack', 'squash', 'orbit', 'swing', 'heartbeat', 'breathe', 'wiggleRot', 'wiggleScale', 'organic', 'loopWiggle', 'drift', 'clock', 'faceMotion', 'scatter', 'popIn', 'slideIn'].map((x) => `x-${x}`)]);
for (const sec of SECTIONS) for (const t of sec.tiles || []) if (NEW_TILES.has(t.id)) t.isNew = true;

const byId = (id) => SECTIONS.find((s) => s.id === id) || null;

module.exports = { SECTIONS, SECONDARY, WORKSPACES, GROUPS, NAV, UTILITY, ALIAS, sectionOf, byId, workspaceOf };
