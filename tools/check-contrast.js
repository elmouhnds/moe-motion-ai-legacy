'use strict';
/** WCAG contrast check for css/tokens.css: every theme (dark, midnight, light) × every accent. */
const fs = require('fs');
const css = fs.readFileSync(require('path').resolve(__dirname, '../extension/css/tokens.css'), 'utf8');
/** All `selector { --x: #hex }` blocks, keyed by selector text. */
const blocks = {};
for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const sel = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
  blocks[sel] = Object.assign(blocks[sel] || {}, Object.fromEntries([...m[2].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((x) => [x[1], x[2]])));
}
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const base = blocks[':root'];
const THEMES = { dark: base, midnight: Object.assign({}, base, blocks[':root[data-theme="midnight"]']), light: Object.assign({}, base, blocks[':root[data-theme="light"]']) };
const ACCENTS = ['tomato', ...Object.keys(blocks).map((k) => (k.match(/^:root\[data-accent="(\w+)"\]$/) || [])[1]).filter(Boolean)];
const PAIRS = [['text', 'bg', 4.5], ['text-2', 'bg', 4.5], ['text-3', 'bg', 4.5], ['text-3', 'bg-sunken', 4.5], ['accent', 'bg', 3], ['accent', 'bg-raised', 3], ['accent-ink', 'accent', 4.5], ['ok', 'bg', 3], ['err', 'bg', 3], ['warn', 'bg', 3]];
let bad = 0, n = 0;
for (const [theme, t0] of Object.entries(THEMES)) {
  for (const accent of ACCENTS) {
    const acc = accent === 'tomato' ? {} : Object.assign({}, blocks[`:root[data-accent="${accent}"]`], theme === 'light' ? blocks[`:root[data-theme="light"][data-accent="${accent}"]`] : {});
    const t = Object.assign({}, t0, acc);
    for (const [fg, bg, min] of PAIRS) {
      if (accent !== 'tomato' && !/accent/.test(fg)) continue;
      const r = ratio(t[fg], t[bg]);
      n++;
      if (r < min) { bad++; console.log(`✗ ${theme}/${accent} ${fg} on ${bg} ${r.toFixed(2)} (min ${min})`); }
    }
  }
}
console.log(`${bad ? '✗' : '✓'} contrast: ${n - bad}/${n} pairs pass (${Object.keys(THEMES).length} themes × ${ACCENTS.length} accents)`);
process.exit(bad ? 1 : 0);
