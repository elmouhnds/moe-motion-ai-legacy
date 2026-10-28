'use strict';
/**
 * Actions (v0.8): one small vocabulary for "something you can do in one click", shared by the
 * Pie menu and Home's "For this selection" row.
 *
 *   tile:<section>/<tileId>   apply a library tile (readiness checked, same as ▶)
 *   quick:<actionId>          a Quick Bar action
 *   nav:<sectionId>           open a section
 *   cmd:search | cmd:copilot | cmd:repeat
 *
 * Context sets: the selection decides which eight actions the smart pie shows. Positions inside a
 * set never move (a pie works by direction, so muscle memory matters more than ranking).
 * Slot order: N, NE, E, SE, S, SW, W, NW — opposites face each other (In ↔ Out, Draw ↔ Erase).
 */
const studio = require('./studio/sections');

const SETS = {
  keys: ['tile:animate/easeSmooth', 'tile:animate/easeSnappy', 'quick:curveExpo', 'quick:x_loopCycle', 'quick:reverse', 'quick:x_loopPingPong', 'quick:curveBack', 'tile:animate/stagger'],
  text: ['quick:typewriter', 'tile:animate/riseIn', 'quick:inRL', 'quick:counter', 'tile:animate/fadeOut', 'nav:brand', 'nav:text', 'tile:animate/popIn'],
  shapes: ['quick:trimDraw', 'quick:trimTravel', 'tile:animate/popIn', 'quick:x_wiggle', 'quick:trimErase', 'quick:k_repeat', 'tile:animate/spinIn', 'tile:animate/fadeIn'],
  shapesMany: ['quick:trimDraw', 'tile:layout/grid', 'tile:layout/ring', 'quick:x_wiggle', 'quick:trimErase', 'quick:distH', 'tile:animate/cascadeIn', 'tile:animate/popIn'],
  layers: ['tile:animate/cascadeIn', 'tile:layout/grid', 'tile:layout/ring', 'quick:parentNull', 'tile:animate/stagger', 'quick:distH', 'quick:alignV', 'tile:animate/fadeIn'],
  layer: ['tile:animate/fadeIn', 'tile:animate/popIn', 'quick:inRL', 'quick:x_wiggle', 'tile:animate/fadeOut', 'quick:anchorB', 'quick:flipH', 'tile:zoom/punch'],
  none: ['cmd:search', 'nav:shapes', 'nav:backgrounds', 'tile:layout/g12', 'cmd:copilot', 'tile:layout/safe', 'nav:text', 'nav:kit']
};
/**
 * Smart Home (v0.15): what the focus card offers for each kind of selection — curated rows, each
 * action in one row only (docs/features/SMART_HOME.md). Same references as SETS (tile: / quick: /
 * nav: / cmd:), so readiness and running go through resolve() exactly like the pie.
 */
const LINK = ['quick:parentNull', 'quick:k_parent', 'quick:k_delay', 'quick:k_stare'];
const ARRANGE = ['tile:layout/grid', 'tile:layout/ring', 'tile:layout/honey', 'tile:layout/spiral', 'tile:layout/fan']; // distribute lives in the Align block right below
const FOCUS = {
  keys: [['Keys', ['quick:reverse', 'quick:mirror', 'quick:clone', 'quick:k_stagger', 'quick:k_trimKeys']], ['Loop', ['quick:x_loopCycle', 'quick:x_loopPingPong', 'quick:x_loopOffset', 'quick:x_loopInOut']]],
  layer: [['Animate in', ['quick:inRL', 'quick:inLR', 'quick:inBT', 'tile:animate/fadeIn', 'tile:animate/popIn', 'tile:animate/riseIn', 'tile:animate/spinIn']], ['Animate out', ['quick:outRL', 'quick:outLR', 'tile:animate/fadeOut', 'tile:animate/popOut', 'tile:animate/scaleOut', 'tile:animate/spinOut']], ['Rig', ['quick:k_excite', 'quick:k_wiggle', 'quick:k_swing', 'quick:k_spin', 'quick:k_orbit', 'quick:x_float']]],
  layers: [['Animate in, one after another', ['tile:animate/cascadeIn', 'tile:animate/cascadeFade', 'tile:animate/stagger', 'quick:inRL', 'tile:animate/popIn']], ['Arrange', ARRANGE], ['Link', LINK]],
  text: [['Text in', ['quick:typewriter', 'tile:animate/riseIn', 'tile:animate/cascadeIn', 'tile:animate/fadeIn', 'quick:counter']], ['Text tools', ['nav:text', 'nav:brand']]],
  shapes: [['Draw', ['quick:trimDraw', 'quick:trimErase', 'quick:trimTravel', 'quick:trimBoth']], ['Motion', ['quick:k_repeat', 'quick:x_wiggle', 'tile:animate/popIn', 'tile:animate/spinIn', 'quick:k_excite']]],
  shapesMany: [['Draw', ['quick:trimDraw', 'quick:trimErase', 'quick:trimTravel', 'quick:trimBoth']], ['Arrange', ARRANGE], ['Animate in, one after another', ['tile:animate/cascadeIn', 'tile:animate/stagger', 'tile:animate/popIn']]],
  none: [['Create', ['nav:shapes', 'nav:backgrounds', 'nav:text', 'tile:layout/g12', 'tile:layout/safe']], ['Find', ['cmd:search', 'cmd:copilot', 'nav:kit']]]
};
/** Which kit blocks are the focus for each kind of selection (the rest go under "More", folded). */
const FOCUS_BLOCKS = { keys: ['ease'], layer: ['anchorAlign'], layers: ['anchorAlign'], text: ['anchorAlign'], shapes: ['anchorAlign'], shapesMany: ['anchorAlign'], none: [] };
const CONTEXT_LABEL = { keys: 'Keyframes', text: 'Text layers', shapes: 'Shape layer', shapesMany: 'Several shapes', layers: 'Several layers', layer: 'One layer', none: 'Nothing selected' };

/** What is selected, in one word (pure). */
function profile(ctx) {
  if (!ctx || !ctx.comp) return 'none';
  const keys = (ctx.properties || []).reduce((n, p) => n + ((p.selectedKeys || []).length), 0);
  if (keys > 0) return 'keys';
  const layers = (ctx.layers || []).filter((l) => !['camera', 'light'].includes(l.type));
  if (!layers.length) return 'none';
  if (layers.every((l) => l.type === 'text')) return 'text';
  // Several shapes (e.g. circles to clone around a ring) also need layout, not only draw-ons.
  if (layers.every((l) => l.type === 'shape')) return layers.length > 1 ? 'shapesMany' : 'shapes';
  return layers.length > 1 ? 'layers' : 'layer';
}

/** The eight slots for this selection: the smart set, or the user's own pie. */
function slotsFor(ctx, pieSettings) {
  const p = pieSettings || {};
  if (p.mode === 'mine' && Array.isArray(p.mine) && p.mine.some(Boolean)) return Array.from({ length: 8 }, (_, i) => p.mine[i] || null);
  return SETS[profile(ctx)].slice();
}

const TILE_ICON = { fadeIn: 'fadeIn', fadeOut: 'fadeOut', popIn: 'scaleUp', gentlePop: 'scaleUp', scaleOut: 'scaleDown', popOut: 'scaleDown', spinIn: 'spin', spinOut: 'spin', riseIn: 'moveBT', dropIn: 'moveTB', cascadeIn: 'stagger', cascadeFade: 'stagger', stagger: 'stagger', reverse: 'reverse', mirror: 'mirror', grid: 'grid', honey: 'grid', ring: 'target', fan: 'target', spiral: 'target', g12: 'guides', thirds: 'guides', safe: 'guides', punch: 'zoom', smooth: 'zoom', spot: 'zoom', inRL: 'moveRL', inLR: 'moveLR', inTB: 'moveTB', inBT: 'moveBT' };

/** Shorter names for slices and chips (the full name stays in the tooltip / Quick Bar). */
const SHORT = { reverse: 'Reverse Keys', mirror: 'Mirror Keys', clone: 'Clone Keys', selectSame: 'Select Same', revealProject: 'Reveal', revealFolder: 'Open Folder', dupComp: 'Dup Comp', parentNull: 'Parent Null', centerAnchor: 'Center Anchor', separate: 'Separate XY', trimDraw: 'Draw On', trimErase: 'Erase', trimTravel: 'Travel', trimBoth: 'Draw + Erase', scaleUp: 'Pop In', scaleDown: 'Scale Out', counter: 'Counter', anchorB: 'Anchor Bottom', anchorC: 'Anchor Centre', anchorTL: 'Anchor TL', alignH: 'Align H', alignV: 'Align V', distH: 'Distribute H', distV: 'Distribute V', compCentre: 'Comp Centre', curveExpo: 'Out Expo', curveBack: 'Out Back', k_repeat: 'Repeat', k_excite: 'Excite', k_trimKeys: 'Trim keys', k_trash: 'Trash' };

/** Resolve a reference to { id, label, icon, run(app), ready(app) } — null if it no longer exists. */
function resolve(ref) {
  if (!ref) return null;
  const [kind, rest] = [ref.slice(0, ref.indexOf(':')), ref.slice(ref.indexOf(':') + 1)];
  if (kind === 'tile') {
    const [secId, tileId] = rest.split('/');
    const sec = studio.byId(secId);
    const tile = sec && (sec.tiles || []).find((t) => t.id === tileId);
    if (!tile) return null;
    const lib = () => require('./studio/library');
    return { id: ref, label: tile.label, icon: TILE_ICON[tile.id] || (/^(ease|curve-)/.test(tile.id) ? 'easeCurve' : /^anchor-/.test(tile.id) ? 'anchor' : /^align-dist/.test(tile.id) ? 'distribute' : /^align/.test(tile.id) ? 'alignCenter' : /^clone/.test(tile.id) ? 'clone' : tile.thumb && tile.thumb.k === 'icon' ? tile.thumb.icon : sec.icon), where: sec.label,
      run: (app) => lib().applyNow(app, tile, sec), ready: (app) => lib().readiness(app, tile) };
  }
  if (kind === 'quick') {
    const q = require('./quickbar');
    const a = q.ACTIONS.find((x) => x.id === rest);
    if (!a) return null;
    const short = SHORT[a.id] || a.label.replace(/\s*\(.*\)\s*$/, '');
    return { id: ref, label: short, icon: a.icon || 'bolt', where: 'Quick Bar',
      run: (app) => q.run(app, a), ready: (app) => require('./studio/library').readiness(app, { id: a.id, label: short, tool: a.tool, args: a.args }) };
  }
  if (kind === 'nav') {
    const sec = studio.byId(rest);
    if (!sec) return null;
    return { id: ref, label: sec.label, icon: sec.icon, where: 'Open', nav: true, run: (app) => app.go(rest), ready: () => ({ ok: true }) };
  }
  if (kind === 'cmd') {
    const CMD = {
      search: { label: 'Search', icon: 'search', run: (app) => require('./palette').open(app) },
      copilot: { label: 'Copilot', icon: 'spark', run: (app) => app.openCopilot() },
      repeat: { label: 'Repeat last', icon: 'repeat', run: (app) => app.repeatLast() }
    };
    const c = CMD[rest];
    return c ? Object.assign({ id: ref, where: 'Command', nav: true, ready: () => ({ ok: true }) }, c) : null;
  }
  return null;
}

/** Everything the user can put on "My pie" (for Settings), grouped. */
function catalog() {
  const out = [];
  for (const sec of studio.SECTIONS.filter((x) => x.kind === 'library')) for (const t of sec.tiles) out.push({ ref: `tile:${sec.id}/${t.id}`, group: sec.label, label: t.label });
  for (const a of require('./quickbar').ACTIONS) out.push({ ref: `quick:${a.id}`, group: 'Quick Bar', label: a.label });
  for (const id of studio.NAV) out.push({ ref: `nav:${id}`, group: 'Open section', label: studio.byId(id).label });
  for (const [id, label] of [['search', 'Search'], ['copilot', 'Copilot'], ['repeat', 'Repeat last']]) out.push({ ref: `cmd:${id}`, group: 'Commands', label });
  return out;
}

module.exports = { SETS, FOCUS, FOCUS_BLOCKS, CONTEXT_LABEL, profile, slotsFor, resolve, catalog };
