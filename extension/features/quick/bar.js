'use strict';
/**
 * Quick Bar catalogue (pure data). Each action = a registered tool + preset args + icon.
 * Click runs it with these args; right-click (or Alt-click) opens its options first.
 */
const A = (id, tool, args, icon, label, group) => ({ id, tool, args: args || {}, icon, label, group });

const ACTIONS = [
  A('revealProject', 'quick.reveal', { mode: 'project' }, 'search', 'Reveal in Project', 'Project'),
  A('revealFolder', 'quick.reveal', { mode: 'folder' }, 'folder', 'Open Folder', 'Project'),
  A('openPrecomp', 'quick.reveal', { mode: 'open' }, 'precomp', 'Open Pre-comp', 'Project'),
  A('purge', 'quick.purge', { target: 'image' }, 'purge', 'Purge Cache', 'Project'),
  A('dupComp', 'quick.duplicateComp', {}, 'copy', 'Duplicate Comp (deep)', 'Project'),

  A('flipH', 'quick.flip', { axis: 'h' }, 'flipH', 'Flip Horizontal', 'Layer'),
  A('flipV', 'quick.flip', { axis: 'v' }, 'flipV', 'Flip Vertical', 'Layer'),
  A('parentNull', 'quick.parentToNull', {}, 'parentNull', 'Parent to Null', 'Layer'),
  A('precompose', 'quick.precompose', {}, 'precomp', 'Pre-compose', 'Layer'),
  A('centerAnchor', 'proximity.centerAnchor', {}, 'target', 'Center Anchor', 'Layer'),
  A('separate', 'quick.separateXY', {}, 'separate', 'Separate X/Y', 'Layer'),

  A('selectSame', 'quick.selectSame', { scope: 'selected' }, 'selectSame', 'Select Same Property', 'Keys'),
  A('reverse', 'quick.reverseKeys', {}, 'reverse', 'Reverse Keyframes', 'Keys'),
  A('mirror', 'quick.mirrorKeys', { mode: 'mirror' }, 'mirror', 'Mirror Keys at Playhead', 'Keys'),
  A('clone', 'quick.mirrorKeys', { mode: 'clone' }, 'copy', 'Clone Keys at Playhead', 'Keys'),
  A('ease', 'motion.smartEase', {}, 'ease', 'Smart Ease', 'Keys'),

  A('inRL', 'quick.animate', { kind: 'moveRL', dir: 'in' }, 'moveRL', 'Slide In ← (from right)', 'Animate'),
  A('inLR', 'quick.animate', { kind: 'moveLR', dir: 'in' }, 'moveLR', 'Slide In → (from left)', 'Animate'),
  A('inTB', 'quick.animate', { kind: 'moveTB', dir: 'in' }, 'moveTB', 'Slide In ↓ (from top)', 'Animate'),
  A('inBT', 'quick.animate', { kind: 'moveBT', dir: 'in' }, 'moveBT', 'Slide In ↑ (from bottom)', 'Animate'),
  A('outRL', 'quick.animate', { kind: 'moveRL', dir: 'out' }, 'moveRL', 'Slide Out ← (to left)', 'Animate'),
  A('outLR', 'quick.animate', { kind: 'moveLR', dir: 'out' }, 'moveLR', 'Slide Out → (to right)', 'Animate'),
  A('outTB', 'quick.animate', { kind: 'moveTB', dir: 'out' }, 'moveTB', 'Slide Out ↓ (to bottom)', 'Animate'),
  A('outBT', 'quick.animate', { kind: 'moveBT', dir: 'out' }, 'moveBT', 'Slide Out ↑ (to top)', 'Animate'),
  A('fadeIn', 'quick.animate', { kind: 'fade', dir: 'in' }, 'fadeIn', 'Fade In', 'Animate'),
  A('fadeOut', 'quick.animate', { kind: 'fade', dir: 'out' }, 'fadeOut', 'Fade Out', 'Animate'),
  A('scaleUp', 'quick.animate', { kind: 'scale', dir: 'in', overshoot: true }, 'scaleUp', 'Scale Up (pop in)', 'Animate'),
  A('scaleDown', 'quick.animate', { kind: 'scale', dir: 'out' }, 'scaleDown', 'Scale Down (out)', 'Animate'),
  A('spinIn', 'quick.animate', { kind: 'spin', dir: 'in' }, 'spin', 'Spin In', 'Animate'),
  A('trimDraw', 'quick.trimPaths', { mode: 'draw' }, 'trim', 'Trim: Draw On', 'Animate'),
  A('trimErase', 'quick.trimPaths', { mode: 'erase' }, 'scaleDown', 'Trim: Erase', 'Animate'),
  A('trimTravel', 'quick.trimPaths', { mode: 'travel' }, 'xOffset', 'Trim: Travel (start + end)', 'Animate'),
  A('trimBoth', 'quick.trimPaths', { mode: 'drawErase' }, 'mirror', 'Trim: Draw then Erase', 'Animate'),

  // v0.9 Anchor & Align (Motion-4-style one-clickers)
  A('anchorTL', 'transform.anchor', { point: 'tl' }, 'anchor', 'Anchor → Top Left', 'Align'),
  A('anchorC', 'transform.anchor', { point: 'c' }, 'anchor', 'Anchor → Centre', 'Align'),
  A('anchorB', 'transform.anchor', { point: 'b' }, 'anchor', 'Anchor → Bottom', 'Align'),
  A('alignLeft', 'transform.align', { mode: 'left', to: 'selection' }, 'alignLeft', 'Align Left', 'Align'),
  A('alignH', 'transform.align', { mode: 'hcenter', to: 'selection' }, 'alignCenter', 'Align Centres (H)', 'Align'),
  A('alignV', 'transform.align', { mode: 'vcenter', to: 'selection' }, 'alignCenter', 'Align Centres (V)', 'Align'),
  A('compCentre', 'transform.align', { mode: 'hcenter', to: 'comp' }, 'target', 'Centre in Comp (H)', 'Align'),
  A('distH', 'transform.align', { mode: 'distH', to: 'selection' }, 'distribute', 'Distribute Horizontally', 'Align'),
  A('distV', 'transform.align', { mode: 'distV', to: 'selection' }, 'distribute', 'Distribute Vertically', 'Align'),
  A('curveExpo', 'motion.easeCurve', { x1: 0.16, y1: 1, x2: 0.3, y2: 1 }, 'easeCurve', 'Curve: Out Expo', 'Keys'),
  A('curveBack', 'motion.easeCurve', { x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 }, 'easeCurve', 'Curve: Out Back (overshoot)', 'Keys'),

  A('typewriter', 'quick.typewriter', {}, 'typewriter', 'Typewriter', 'Text'),
  A('counter', 'quick.counter', {}, 'counter', 'Number Counter', 'Text'),

  ...['wiggle', 'wiggleX', 'wiggleY', 'jitter', 'blink', 'flicker', 'autoFade', 'loopCycle', 'loopPingPong', 'loopOffset', 'loopInOut', 'timeRotate', 'pendulum', 'pulse', 'float', 'inertia', 'posterize']
    .map((p) => A(`x_${p}`, 'expressions.quick', { preset: p }, null, null, 'Expressions'))
];

const DEFAULT_BAR = ['revealProject', 'revealFolder', 'purge', 'flipH', 'flipV', 'parentNull', 'precompose', 'selectSame', 'reverse', 'mirror', 'inRL', 'inLR', 'inTB', 'inBT', 'fadeIn', 'fadeOut', 'scaleUp', 'scaleDown', 'trimDraw', 'trimTravel', 'x_wiggle', 'x_loopCycle', 'x_loopPingPong', 'x_blink', 'x_timeRotate'];
const GROUPS = ['Project', 'Layer', 'Align', 'Keys', 'Animate', 'Text', 'Expressions'];

/** Fill icon/label for expression actions from the expression library. */
function resolve(PRESETS) {
  return ACTIONS.map((a) => (a.tool === 'expressions.quick' ? Object.assign({}, a, { icon: PRESETS[a.args.preset].icon, label: PRESETS[a.args.preset].label }) : a));
}

module.exports = { ACTIONS, DEFAULT_BAR, GROUPS, resolve };
