'use strict';
/**
 * Studio layout (concept B): labelled sidebar of creative sections. Library sections
 * show visual tiles (a tile = a registered tool + preset args + a thumbnail recipe)
 * and an Inspector with that tool's own form. Every tool stays reachable from the
 * section's "All tools" tab, the command search and the Copilot.
 */
const { PRESETS: EXPR } = require('../../../features/expressions/quick');
const { LOOKS } = require('../../../features/glass/tools');

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
  T('easeSmooth', 'Smooth Ease', 'motion.smartEase', { influenceIn: 75, influenceOut: 75 }, { k: 'ease', a: 0.75, b: 0.75 }, ['Keys'], 'KEYS'),
  T('easeSnappy', 'Snappy Ease', 'motion.smartEase', { influenceIn: 90, influenceOut: 15 }, { k: 'ease', a: 0.15, b: 0.9 }, ['Keys'], 'KEYS'),
  T('stagger', 'Stagger', 'motion.stagger', {}, { k: 'stagger' }, ['Keys'], 'KEYS'),
  T('reverse', 'Reverse Keys', 'quick.reverseKeys', {}, { k: 'icon', icon: 'reverse' }, ['Keys'], 'KEYS'),
  T('mirror', 'Mirror Keys', 'quick.mirrorKeys', { mode: 'mirror' }, { k: 'icon', icon: 'mirror' }, ['Keys'], 'KEYS'),
  T('proxGrow', 'Proximity Grow', 'proximity.apply', { scaleUp: true, scaleDown: false, pushAway: false }, { k: 'prox', mode: 'grow' }, ['Proximity'], 'FX'),
  T('proxRepel', 'Proximity Repel', 'proximity.apply', { scaleUp: false, pushAway: true, pullToward: false }, { k: 'prox', mode: 'repel' }, ['Proximity'], 'FX')
];

const LAYOUT = [
  T('grid', 'Grid', 'grid.build', { mode: 'rect', order: '1', rowOffset: 0 }, { k: 'grid', mode: 'rect' }, ['Grid']),
  T('honey', 'Honeycomb', 'grid.build', { mode: 'rect', order: '1', rowOffset: 50 }, { k: 'grid', mode: 'rect', rowOffset: 50 }, ['Grid']),
  T('wall', 'Wall Build', 'grid.build', { mode: 'rect', animateIn: true, buildStyle: '4', buildOrder: '3' }, { k: 'grid', mode: 'rect', build: true }, ['Grid', 'Animated']),
  T('ring', 'Ring', 'grid.build', { mode: 'radial', arc: 360, faceCenter: true }, { k: 'grid', mode: 'radial' }, ['Radial']),
  T('fan', 'Fan', 'grid.build', { mode: 'radial', arc: 120, faceCenter: true }, { k: 'grid', mode: 'radial', arc: 120 }, ['Radial']),
  T('spiral', 'Spiral', 'grid.build', { mode: 'spiral' }, { k: 'grid', mode: 'spiral' }, ['Radial']),
  T('galaxy', 'Sunflower', 'grid.build', { mode: 'phyllo', animateIn: true, buildStyle: '1', buildOrder: '3' }, { k: 'grid', mode: 'phyllo', build: true }, ['Radial', 'Animated']),
  T('path', 'On a Path', 'grid.build', { mode: 'path' }, { k: 'grid', mode: 'path' }, ['Path']),
  T('globe', 'Globe 3D', 'grid.build', { mode: 'sphere' }, { k: 'grid', mode: 'sphere' }, ['3D']),
  T('g12', '12 Columns', 'grid.guides', { columns: 12, rows: 1, gutterX: 24, marginX: 96, marginY: 72 }, { k: 'guides', c: 12, r: 1 }, ['Guides']),
  T('thirds', 'Thirds', 'grid.guides', { columns: 3, rows: 3, gutterX: 0, gutterY: 0, marginX: 0, marginY: 0 }, { k: 'guides', c: 3, r: 3 }, ['Guides']),
  T('safe', 'Safe Area', 'grid.guides', { columns: 1, rows: 1, marginX: 96, marginY: 54, gutterX: 0, gutterY: 0, center: true }, { k: 'guides', c: 1, r: 1, safe: true }, ['Guides']),
  T('split2', 'Split 2', 'grid.placeInCells', { columns: 2, rows: 1, gutterX: 0, marginX: 0, marginY: 0, fit: 'fill', padding: 0 }, { k: 'cells', c: 2, r: 1 }, ['Cells']),
  T('quad', '2 × 2', 'grid.placeInCells', { columns: 2, rows: 2, gutterX: 12, gutterY: 12, marginX: 0, marginY: 0, fit: 'fill', padding: 0 }, { k: 'cells', c: 2, r: 2 }, ['Cells']),
  T('wall6', '3 × 2 Tiles', 'grid.placeInCells', { columns: 3, rows: 2 }, { k: 'cells', c: 3, r: 2 }, ['Cells'])
];

const LOOK_FAMILY = { clear: 'Clear', crystal: 'Clear', frosted: 'Frosted', ice: 'Frosted', liquid: 'Liquid', tinted: 'Tinted', smoke: 'Tinted' };
const LOOK_TILES = Object.entries(LOOKS).map(([id, l]) => T(`glass-${id}`, `${l.label} Glass`, 'glass.apply', { look: id }, { k: 'glass', look: id }, [LOOK_FAMILY[id] || 'Clear']));

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

const EXPRESSIONS = Object.entries(EXPR).map(([id, p]) => T(`x-${id}`, p.label, 'expressions.quick', { preset: id }, { k: 'expr', preset: id },
  [/loop|Ping|posterize|inertia/i.test(id + p.label) ? 'Keys' : /wiggle|jitter|flicker/i.test(id) ? 'Random' : 'Periodic']));

/**
 * kind: 'library' (tiles + inspector) | 'view' (custom view id) | 'category' (classic tool list)
 * categories: tool categories / ids listed under "All tools".
 */
const SECTIONS = [
  { id: 'animate', label: 'Animate', icon: 'motion', kind: 'library', tiles: ANIMATE, filters: ['All', 'In', 'Out', 'Slide', 'Fade', 'Scale', 'Trim', 'Keys', 'Proximity'], tools: (t) => t.category === 'motion' && !/^zoom\./.test(t.id) || /^quick\.(animate|trimPaths|reverseKeys|mirrorKeys)$/.test(t.id) },
  { id: 'text', label: 'Text', icon: 'type', kind: 'view' },
  { id: 'layout', label: 'Layout & Grid', icon: 'grid', kind: 'library', tiles: LAYOUT, filters: ['All', 'Grid', 'Radial', 'Path', '3D', 'Animated', 'Guides', 'Cells'], tools: (t) => /^grid\./.test(t.id) },
  { id: 'looks', label: 'Looks & Glass', icon: 'glass', kind: 'library', tiles: LOOK_TILES, filters: ['All', 'Clear', 'Frosted', 'Liquid', 'Tinted'], tools: (t) => /^glass\./.test(t.id) },
  { id: 'zoom', label: 'Zoom & Focus', icon: 'zoom', kind: 'library', tiles: ZOOM, filters: ['All', 'Zoom', 'Focus', 'Cursor'], tools: (t) => /^zoom\./.test(t.id) },
  { id: 'expressions', label: 'Expressions', icon: 'expr', kind: 'library', tiles: EXPRESSIONS, filters: ['All', 'Random', 'Periodic', 'Keys'], tools: null, editor: true },
  { id: 'compositing', label: 'Compositing', icon: 'layers', kind: 'category' },
  { id: 'deliver', label: 'Deliver', icon: 'resize', kind: 'view' }
];
const SECONDARY = [
  { id: 'quick', label: 'Quick', icon: 'bolt' },
  { id: 'select', label: 'Select', icon: 'cursor' },
  { id: 'brand', label: 'Brand', icon: 'brand' },
  { id: 'tools', label: 'Tools', icon: 'tools' }
];
const UTILITY = [['favorites', 'Favorites', 'star'], ['history', 'History', 'history'], ['settings', 'Settings', 'gear']];

/** Old view ids (v0.3/0.4) → Studio sections. */
const ALIAS = { motion: 'animate', diagnostics: 'diagnostics' };

/** Section that owns a tool (for search / prefill / Copilot "open"). */
function sectionOf(tool) {
  const id = tool.id;
  if (/^zoom\./.test(id)) return 'zoom';
  if (/^glass\./.test(id)) return 'looks';
  if (/^adapt\./.test(id)) return 'deliver';
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

const byId = (id) => SECTIONS.find((s) => s.id === id) || null;

module.exports = { SECTIONS, SECONDARY, UTILITY, ALIAS, sectionOf, byId };
