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

  // v0.10 Motion Kit tools (also pinnable to the bar). Rig tools put their numbers on Slider Controls.
  A('k_easy', 'motion.smartEase', { influenceIn: 33.33, influenceOut: 33.33 }, 'easeCurve', 'Easy Ease (F9)', 'Kit'),
  A('k_linear', 'kit.interp', { mode: 'linear', side: 'both' }, 'kLinear', 'Linear keys', 'Kit'),
  A('k_hold', 'kit.interp', { mode: 'hold', side: 'both' }, 'kHold', 'Hold keys', 'Kit'),
  A('k_parent', 'kit.parent', {}, 'kChain', 'Parent chain (Alt: reverse)', 'Kit'),
  A('k_excite', 'expressions.quick', { preset: 'inertia', live: true }, 'kExcite', 'Excite (overshoot)', 'Kit'),
  A('k_jump', 'expressions.quick', { preset: 'bounceBack', live: true }, 'xBounceLand', 'Jump (bounce)', 'Kit'),
  A('k_orbit', 'expressions.quick', { preset: 'orbit', live: true }, 'xOrbit', 'Orbit', 'Kit'),
  A('k_spin', 'expressions.quick', { preset: 'timeRotate', live: true }, 'xSpin', 'Spin', 'Kit'),
  A('k_swing', 'expressions.quick', { preset: 'swing', live: true }, 'xSwing', 'Swing', 'Kit'),
  A('k_wiggle', 'expressions.quick', { preset: 'wiggle', live: true }, 'xWiggle', 'Wiggle', 'Kit'),
  A('k_stare', 'kit.stare', {}, 'kStare', 'Stare (face a layer)', 'Kit'),
  A('k_delay', 'kit.delay', { mode: 'spring' }, 'kDelay', 'Delay (MoGraph)', 'Kit'),
  A('k_stagger', 'motion.stagger', {}, 'stagger', 'Stagger layers', 'Kit'),
  A('k_trimKeys', 'kit.trimToKeys', {}, 'kTrimKeys', 'Trim to keys', 'Kit'),
  A('k_repeat', 'transform.clone', { mode: 'radial', count: 8, radius: 300, arc: 360, faceOut: true }, 'clone', 'Repeat (radial clone)', 'Kit'),
  A('k_vignette', 'kit.vignette', {}, 'kVignette', 'Vignette', 'Kit'),
  A('k_trash', 'kit.trash', {}, 'trash', 'Trash MOE rigs', 'Kit'),

  A('typewriter', 'quick.typewriter', {}, 'typewriter', 'Typewriter', 'Text'),
  A('counter', 'quick.counter', {}, 'counter', 'Number Counter', 'Text'),

  ...['wiggle', 'wiggleX', 'wiggleY', 'jitter', 'blink', 'flicker', 'autoFade', 'loopCycle', 'loopPingPong', 'loopOffset', 'loopInOut', 'timeRotate', 'pendulum', 'pulse', 'float', 'inertia', 'posterize']
    .map((p) => A(`x_${p}`, 'expressions.quick', { preset: p }, null, null, 'Expressions'))
];

// v0.28 (docs/features/WORKFLOW_HOME.md): ordered by how often a motion designer needs it, not by menu.
// The first ten are the Everyday slots (Alt+1…0, workflow.EVERYDAY); housekeeping (Purge, Open Folder) is
// no longer in the default bar — it lives in Deliver › Project and in search.
const DEFAULT_BAR = ['k_easy', 'curveExpo', 'centerAnchor', 'parentNull', 'precompose', 'k_stagger', 'x_loopCycle', 'x_wiggle', 'reverse', 'dupComp',
  'trimDraw', 'fadeIn', 'fadeOut', 'inBT', 'scaleUp', 'mirror', 'flipH', 'separate', 'selectSame', 'typewriter', 'x_loopPingPong', 'revealProject'];
const GROUPS = ['Project', 'Layer', 'Kit', 'Align', 'Keys', 'Animate', 'Text', 'Expressions'];

/** Fill icon/label for expression actions from the expression library (kit actions keep their own). */
function resolve(PRESETS) {
  return ACTIONS.map((a) => {
    if (a.tool !== 'expressions.quick') return a;
    const p = PRESETS[a.args.preset];
    // The preset's own numbers ride along: the form's generic defaults (e.g. Amount 30) must not
    // replace them (Inertia's 0.06 became 30 — a wild overshoot — before v0.10).
    const out = Object.assign({}, a, { args: Object.assign({}, p.nums, a.args) });
    return a.group === 'Kit' ? out : Object.assign(out, { icon: p.icon, label: p.label });
  });
}

/* Motion Kit layout: the tool grid (Motion 4 Toolbox order: layer helpers, rigs, keys, looks, clean-up). */
const KIT_TOOLS = ['parentNull', 'k_parent', 'k_excite', 'k_delay', 'k_jump', 'k_orbit', 'k_spin', 'k_swing', 'k_wiggle', 'k_stare', 'clone', 'reverse', 'k_stagger', 'k_trimKeys', 'separate', 'trimDraw', 'k_repeat', 'k_vignette', 'k_trash'];
/* v0.14: the Toolbox shows the same tools grouped by what they do. */
const KIT_GROUPS = [
  ['Motion rigs', ['k_excite', 'k_delay', 'k_jump', 'k_orbit', 'k_spin', 'k_swing', 'k_wiggle', 'k_stare', 'k_repeat']],
  ['Keyframes', ['clone', 'reverse', 'k_stagger', 'k_trimKeys', 'trimDraw']],
  ['Layers', ['parentNull', 'k_parent', 'separate', 'k_vignette']],
  ['Clean up', ['k_trash']]
];
/* Alt-click variants (Motion 4 / Flow convention: the modifier gives the second most common intent). */
const KIT_ALT = { k_parent: { reverse: true }, clone: { mode: 'mirror' }, k_delay: { mode: 'blend' } };
const KIT_LABEL = { parentNull: 'Null', k_parent: 'Parent', k_excite: 'Excite', k_delay: 'Delay', k_jump: 'Jump', k_orbit: 'Orbit', k_spin: 'Spin', k_swing: 'Swing', k_wiggle: 'Wiggle', k_stare: 'Stare', clone: 'Clone keys', reverse: 'Reverse', k_stagger: 'Stagger', k_trimKeys: 'Trim keys', separate: 'Separate', trimDraw: 'Trim path', k_repeat: 'Repeat', k_vignette: 'Vignette', k_trash: 'Trash' };

module.exports = { ACTIONS, DEFAULT_BAR, GROUPS, resolve, KIT_TOOLS, KIT_GROUPS, KIT_ALT, KIT_LABEL };
