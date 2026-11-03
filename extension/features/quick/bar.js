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
  A('k_stare', 'kit.stare', {}, 'kStare', 'Stare (face a layer)', 'Kit'),
  A('k_delay', 'kit.delay', { mode: 'spring' }, 'kDelay', 'Delay (MoGraph)', 'Kit'),
  A('k_stagger', 'motion.stagger', {}, 'stagger', 'Stagger layers', 'Kit'),
  A('k_trimKeys', 'kit.trimToKeys', {}, 'kTrimKeys', 'Trim to keys', 'Kit'),
  A('k_repeat', 'transform.clone', { mode: 'radial', count: 8, radius: 300, arc: 360, faceOut: true }, 'clone', 'Repeat (radial clone)', 'Kit'),
  A('k_vignette', 'kit.vignette', {}, 'kVignette', 'Vignette', 'Kit'),
  A('k_bake', 'rig.bake', {}, 'bake', 'Bake to keyframes (Alt: one per frame)', 'Kit'),
  A('k_trash', 'kit.trash', {}, 'trash', 'Trash MOE rigs', 'Kit'),

  A('typewriter', 'quick.typewriter', {}, 'typewriter', 'Typewriter', 'Text'),
  A('counter', 'quick.counter', {}, 'counter', 'Number Counter', 'Text')
];

/**
 * v0.29 (docs/features/FEWER_CLEARER.md): one source per preset. These Quick Bar actions were copies of
 * library tiles (Slide In / Out, Fade, Pop, Spin, Draw On, every expression) or of another action (the
 * Motion Kit's Wiggle / Orbit / Swing / Spin = the expression presets with live sliders; Smart Ease =
 * Easy Ease). The bar now holds the tile itself ("tile:<section>/<id>"); old ids in a saved bar, a pin
 * or a pie still work through this map.
 */
const MIGRATE = {
  inRL: 'tile:animate/inRL', inLR: 'tile:animate/inLR', inTB: 'tile:animate/inTB', inBT: 'tile:animate/inBT',
  outRL: 'tile:animate/outRL', outLR: 'tile:animate/outLR', outTB: 'tile:animate/outTB', outBT: 'tile:animate/outBT',
  fadeIn: 'tile:animate/fadeIn', fadeOut: 'tile:animate/fadeOut', scaleUp: 'tile:animate/popIn', scaleDown: 'tile:animate/scaleOut', spinIn: 'tile:animate/spinIn',
  trimDraw: 'tile:animate/trimDraw', trimErase: 'tile:animate/trimErase', trimTravel: 'tile:animate/trimTravel', trimBoth: 'tile:animate/trimBoth',
  ease: 'k_easy', k_wiggle: 'tile:expressions/x-wiggle', k_orbit: 'tile:expressions/x-orbit', k_swing: 'tile:expressions/x-swing', k_spin: 'tile:expressions/x-timeRotate'
};
['wiggle', 'wiggleX', 'wiggleY', 'jitter', 'blink', 'flicker', 'autoFade', 'loopCycle', 'loopPingPong', 'loopOffset', 'loopInOut', 'timeRotate', 'pendulum', 'pulse', 'float', 'inertia', 'posterize']
  .forEach((p) => { MIGRATE[`x_${p}`] = `tile:expressions/x-${p}`; });
// …and the other way: four "Motion presets" tiles were copies of Kit actions (keyframe tools, not presets)
Object.assign(MIGRATE, { 'tile:animate/easeGentle': 'k_easy', 'tile:animate/stagger': 'k_stagger', 'tile:animate/reverse': 'reverse', 'tile:animate/mirror': 'mirror' });
const migrate = (id) => MIGRATE[id] || id;

// v0.28 (docs/features/WORKFLOW_HOME.md): ordered by how often a motion designer needs it, not by menu.
// The first ten are the Everyday slots (Alt+1…0, workflow.EVERYDAY); housekeeping (Purge, Open Folder) is
// no longer in the default bar — it lives in Deliver › Project and in search.
const DEFAULT_BAR = ['k_easy', 'curveExpo', 'centerAnchor', 'parentNull', 'precompose', 'k_stagger', 'tile:expressions/x-loopCycle', 'tile:expressions/x-wiggle', 'reverse', 'dupComp',
  // v0.43 (SMART_ARRANGE): after Alt+1…0 the rest sits by family — Mirror and Ping-Pong right after Reverse and Loop,
  // the moves together, Flip H next to Flip V, then layers, text and the project
  'mirror', 'tile:expressions/x-loopPingPong', 'tile:animate/fadeIn', 'tile:animate/fadeOut', 'tile:animate/inBT', 'tile:animate/popIn', 'tile:animate/trimDraw',
  'flipH', 'flipV', 'separate', 'selectSame', 'typewriter', 'revealProject'];
const GROUPS = ['Project', 'Layer', 'Kit', 'Align', 'Keys', 'Text'];

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

/* Motion Kit layout: the tool grid (Motion 4 Toolbox order: layer helpers, rigs, keys, looks, clean-up).
   v0.29: Wiggle / Orbit / Swing / Spin left the rigs — they are the expression presets (Expressions,
   with "Live controls" in their options); the rigs keep what only they do. */
const KIT_TOOLS = ['parentNull', 'k_parent', 'k_excite', 'k_delay', 'k_jump', 'k_stare', 'clone', 'reverse', 'k_stagger', 'k_trimKeys', 'separate', 'tile:animate/trimDraw', 'k_repeat', 'k_vignette', 'k_bake', 'k_trash'];
/* v0.14: the Toolbox shows the same tools grouped by what they do. */
const KIT_GROUPS = [
  ['Motion rigs', ['k_excite', 'k_delay', 'k_jump', 'k_stare', 'k_repeat']],
  ['Keyframes', ['clone', 'reverse', 'k_stagger', 'k_trimKeys', 'tile:animate/trimDraw']],
  ['Layers', ['parentNull', 'k_parent', 'separate', 'k_vignette']],
  ['Clean up', ['k_bake', 'k_trash']]
];
/* Alt-click variants (Motion 4 / Flow convention: the modifier gives the second most common intent). */
const KIT_ALT = { k_parent: { reverse: true }, clone: { mode: 'mirror' }, k_delay: { mode: 'blend' }, k_bake: { keys: 'every' } };
const KIT_LABEL = { parentNull: 'Null', k_parent: 'Parent', k_excite: 'Excite', k_delay: 'Delay', k_jump: 'Jump', k_stare: 'Stare', clone: 'Clone keys', reverse: 'Reverse', k_stagger: 'Stagger', k_trimKeys: 'Trim keys', separate: 'Separate', 'tile:animate/trimDraw': 'Draw On', k_repeat: 'Repeat', k_vignette: 'Vignette', k_bake: 'Bake', k_trash: 'Trash' };

module.exports = { MIGRATE, migrate, ACTIONS, DEFAULT_BAR, GROUPS, resolve, KIT_TOOLS, KIT_GROUPS, KIT_ALT, KIT_LABEL };
