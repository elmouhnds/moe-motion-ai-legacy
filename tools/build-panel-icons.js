'use strict';
/**
 * Renders the panel icons referenced by CSXS/manifest.xml (<UI><Icons>) with Chromium:
 *   Normal / RollOver           dark glyph for AE's light interface
 *   DarkNormal / DarkRollOver   light glyph for AE's dark interface (the default)
 * 23 × 23 px, monochrome like AE's own panel icons, plus a 128 px colour mark for docs.
 *
 *   node tools/build-panel-icons.js
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');

const OUT = path.join(__dirname, '..', 'extension', 'icons');
const glyph = (color) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<rect x="2.5" y="2.5" width="27" height="27" rx="7.5" fill="none" stroke="${color}" stroke-width="2.4"/>
<path d="M9 22V12l7 6.4 7-6.4v10" fill="none" stroke="${color}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a59"/><stop offset="1" stop-color="#ff3d6e"/></linearGradient></defs>
<rect x="1" y="1" width="30" height="30" rx="8.5" fill="url(#g)"/><path d="M8 22.5V11.5l8 7.2 8-7.2v11" fill="none" stroke="#1c0d08" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M24.5 5.2l2.3 2.3-2.3 2.3-2.3-2.3z" fill="#1c0d08"/></svg>`;

const ICONS = [
  ['icon-normal.png', glyph('#4a4a4a'), 23], ['icon-rollover.png', glyph('#1d1d1d'), 23],
  ['icon-dark.png', glyph('#b3b3b3'), 23], ['icon-dark-rollover.png', glyph('#ffffff'), 23],
  ['moe-mark-128.png', mark, 128]
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  for (const [file, svg, size] of ICONS) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await page.screenshot({ path: path.join(OUT, file), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
    console.log(`✓ ${file} (${size}px)`);
  }
  await browser.close();
})();
