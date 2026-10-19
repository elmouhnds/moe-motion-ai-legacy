'use strict';
/** WCAG contrast check for the text tokens in css/tokens.css (both themes). */
const fs = require('fs');
const css = fs.readFileSync(require('path').resolve(__dirname, '../extension/css/tokens.css'), 'utf8');
function block(sel) { const m = css.match(new RegExp(sel.replace(/[[\]"=]/g, '\\$&') + '\\s*{([\\s\\S]*?)}')); return Object.fromEntries([...m[1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((x) => [x[1], x[2]])); }
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const dark = block(':root');
const light = Object.assign({}, dark, block(':root[data-theme="light"]'));
let bad = 0;
for (const [name, t] of [['dark', dark], ['light', light]]) {
  for (const [fg, bg, min] of [['text', 'bg', 4.5], ['text-2', 'bg', 4.5], ['text-3', 'bg', 4.5], ['text-3', 'bg-sunken', 4.5], ['accent', 'bg', 3], ['accent-ink', 'accent', 4.5], ['ok', 'bg', 3], ['err', 'bg', 3], ['warn', 'bg', 3]]) {
    const r = ratio(t[fg], t[bg]);
    const ok = r >= min;
    if (!ok) bad++;
    console.log(`${ok ? '✓' : '✗'} ${name.padEnd(5)} ${fg.padEnd(10)} on ${bg.padEnd(9)} ${r.toFixed(2)} (min ${min})`);
  }
}
process.exit(bad ? 1 : 0);
