'use strict';
/**
 * Appearance: theme (auto = follow After Effects' brightness, dark, midnight, light), accent
 * colour, motion (full / reduced) and heading font. Applied as attributes on <html> so the
 * token sets in css/tokens.css take over.
 */
const ACCENTS = [
  ['tomato', 'Tomato', '#ff7a59'], ['electric', 'Electric', '#4d8dff'], ['violet', 'Violet', '#a78bfa'], ['mint', 'Mint', '#34d399'],
  ['gold', 'Gold', '#f5b942'], ['rose', 'Rose', '#fb7185'], ['sky', 'Sky', '#38bdf8'], ['lime', 'Lime', '#a3e635']
];
const THEMES = [['auto', 'Auto'], ['dark', 'Dark'], ['midnight', 'Midnight'], ['light', 'Light']];

let aeColor = null;

/** AE panel colour from CSInterface (or null outside AE). */
function readHost(cs) {
  try { aeColor = cs.getHostEnvironment().appSkinInfo.panelBackgroundColor.color; } catch (e) { aeColor = null; }
  return aeColor;
}

function resolveTheme(ui, color = aeColor) {
  const pick = (ui && ui.theme) || 'auto';
  if (pick !== 'auto') return pick;
  if (!color) return 'dark';
  const lum = (0.2126 * color.red + 0.7152 * color.green + 0.0722 * color.blue) / 255;
  return lum > 0.5 ? 'light' : 'dark';
}

function apply(ui = {}) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const theme = resolveTheme(ui);
  root.setAttribute('data-theme', theme);
  // Auto + dark: match AE's exact panel grey.
  if ((ui.theme || 'auto') === 'auto' && theme === 'dark' && aeColor) root.style.setProperty('--bg', `rgb(${Math.round(aeColor.red)}, ${Math.round(aeColor.green)}, ${Math.round(aeColor.blue)})`);
  else root.style.removeProperty('--bg');
  root.setAttribute('data-accent', ui.accent || 'tomato');
  root.setAttribute('data-motion', ui.motion || 'full');
  root.setAttribute('data-headings', ui.headings || 'display');
}

const reducedMotion = () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-motion') === 'reduced';

module.exports = { ACCENTS, THEMES, apply, readHost, resolveTheme, reducedMotion };
