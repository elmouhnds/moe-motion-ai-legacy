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
  keys: ['tile:animate/easeSmooth', 'tile:animate/easeSnappy', 'quick:curveExpo', 'tile:expressions/x-loopCycle', 'quick:reverse', 'tile:expressions/x-loopPingPong', 'quick:curveBack', 'quick:k_stagger'],
  text: ['quick:typewriter', 'tile:animate/riseIn', 'tile:animate/inRL', 'quick:counter', 'tile:animate/fadeOut', 'nav:brand', 'nav:text', 'tile:animate/popIn'],
  shapes: ['tile:animate/trimDraw', 'tile:animate/trimTravel', 'tile:animate/popIn', 'tile:expressions/x-wiggle', 'tile:animate/trimErase', 'quick:k_repeat', 'tile:animate/spinIn', 'tile:animate/fadeIn'],
  shapesMany: ['tile:animate/trimDraw', 'tile:layout/grid', 'tile:layout/ring', 'tile:expressions/x-wiggle', 'tile:animate/trimErase', 'quick:distH', 'tile:animate/cascadeIn', 'tile:animate/popIn'],
  layers: ['tile:animate/cascadeIn', 'tile:layout/grid', 'tile:layout/ring', 'quick:parentNull', 'quick:k_stagger', 'quick:distH', 'quick:alignV', 'tile:animate/fadeIn'],
  layer: ['tile:animate/fadeIn', 'tile:animate/popIn', 'tile:animate/inRL', 'tile:expressions/x-wiggle', 'tile:animate/fadeOut', 'quick:anchorB', 'quick:flipH', 'tile:zoom/punch'],
  none: ['cmd:search', 'nav:shapes', 'nav:backgrounds', 'tile:layout/g12', 'cmd:copilot', 'tile:layout/safe', 'nav:text', 'nav:kit']
};
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
const SHORT = { reverse: 'Reverse Keys', mirror: 'Mirror Keys', clone: 'Clone Keys', selectSame: 'Select Same', revealProject: 'Reveal', revealFolder: 'Open Folder', dupComp: 'Dup Comp', parentNull: 'Parent Null', centerAnchor: 'Center Anchor', separate: 'Separate XY', trimDraw: 'Draw On', trimErase: 'Erase', trimTravel: 'Travel', trimBoth: 'Draw + Erase', scaleUp: 'Pop In', scaleDown: 'Scale Out', counter: 'Counter', anchorB: 'Anchor Bottom', anchorC: 'Anchor Centre', anchorTL: 'Anchor TL', alignH: 'Align H', alignV: 'Align V', distH: 'Distribute H', distV: 'Distribute V', compCentre: 'Comp Centre', curveExpo: 'Out Expo', curveBack: 'Out Back', k_repeat: 'Repeat', k_excite: 'Excite', k_trimKeys: 'Trim keys', k_trash: 'Trash MOE rigs' };

/* v0.26: brand actions follow the client you work for (set by the shell: kit.activeBrand) */
let brandSource = () => null;
const setBrandSource = (fn) => { brandSource = fn || (() => null); };
function brandAction(ref, rest) {
  const K = require('../../features/brand/kit');
  const b = brandSource();
  if (rest === 'apply' || rest === 'applyComp') {
    const comp = rest === 'applyComp';
    const label = comp ? 'Brand whole comp' : 'Apply brand';
    const args = (bb) => Object.assign(require('../../core/schema').defaults(require('../../features/brand/applyAll').applyAll.params), { brandId: bb.id, scope: comp ? 'comp' : 'selection' });
    return { id: ref, label, icon: 'brand', where: b ? `Brand · ${b.name}` : 'Brand',
      run: (app) => { const bb = brandSource(); if (bb) app.runTool('brand.applyAll', args(bb), { label: `${label}: ${bb.name}` }); },
      ready: (app) => { const bb = brandSource(); return bb ? require('./studio/library').readiness(app, { id: ref, label, tool: 'brand.applyAll', args: args(bb) }) : { ok: false, kind: 'input', hint: 'Choose a client in Brand first (or add one from their website / PDF)' }; } };
  }
  if (rest === 'ease') {
    const er = K.brandEaseRef(b);
    const inner = er ? resolve(er) : null;
    return { id: ref, label: 'Brand ease', icon: 'easeCurve', where: b ? `Brand · ${b.name}${inner ? ` · ${b.profile.motion.easing}` : ''}` : 'Brand',
      run: (app) => { if (inner) inner.run(app); },
      ready: (app) => (!b ? { ok: false, kind: 'input', hint: 'Choose a client in Brand first' } : !inner ? { ok: false, kind: 'input', hint: `${b.name} has no motion feel yet — add it from their website / PDF` } : inner.ready(app)) };
  }
  return null;
}

/** Resolve a reference to { id, label, icon, run(app), ready(app) } — null if it no longer exists. */
function resolve(ref) {
  if (!ref) return null;
  const [kind, rest] = [ref.slice(0, ref.indexOf(':')), ref.slice(ref.indexOf(':') + 1)];
  if (kind === 'tile') {
    const mq = require('../../features/quick/bar').migrate(ref);
    if (mq !== ref) return resolve(mq.indexOf('tile:') === 0 ? mq : `quick:${mq}`); // v0.29: a removed copy → the one that stayed
    const [secId, tileId] = rest.split('/');
    const sec = studio.byId(secId);
    const tile = sec && (sec.tiles || []).find((t) => t.id === tileId);
    if (!tile) return null;
    const lib = () => require('./studio/library');
    // v0.29: expression presets show their own icon (they replaced the Quick Bar copies)
    const xp = tile.tool === 'expressions.quick' && tile.args ? require('../../features/expressions/quick').PRESETS[tile.args.preset] : null;
    return { id: ref, label: tile.label, icon: (xp && xp.icon) || TILE_ICON[tile.id] || (/^(ease|curve-)/.test(tile.id) ? 'easeCurve' : /^anchor-/.test(tile.id) ? 'anchor' : /^align-dist/.test(tile.id) ? 'distribute' : /^align/.test(tile.id) ? 'alignCenter' : /^clone/.test(tile.id) ? 'clone' : tile.thumb && tile.thumb.k === 'icon' ? tile.thumb.icon : sec.icon), where: sec.label,
      run: (app) => lib().applyNow(app, tile, sec), ready: (app) => lib().readiness(app, tile) };
  }
  if (kind === 'quick') {
    const q = require('./quickbar');
    const m = require('../../features/quick/bar').migrate(rest);
    if (m.indexOf('tile:') === 0) return resolve(m); // v0.29: the action became its library tile
    const a = q.ACTIONS.find((x) => x.id === m);
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
  if (kind === 'brand') return brandAction(ref, rest);
  if (kind === 'cmd') {
    const CMD = {
      search: { label: 'Search', icon: 'search', run: (app) => require('./palette').open(app) },
      copilot: { label: 'Assistant', icon: 'sparkles', run: (app) => app.openCopilot() },
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
  for (const [id, label] of [['search', 'Search'], ['copilot', 'Assistant'], ['repeat', 'Repeat last']]) out.push({ ref: `cmd:${id}`, group: 'Commands', label });
  for (const [id, label] of [['apply', 'Apply brand'], ['applyComp', 'Brand whole comp'], ['ease', 'Brand ease']]) out.push({ ref: `brand:${id}`, group: 'Brand', label });
  return out;
}

module.exports = { SETS, CONTEXT_LABEL, profile, slotsFor, resolve, catalog, setBrandSource };
