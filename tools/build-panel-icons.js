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
/* Installer artwork (installer/assets): 256 px mark for the .ico, 164 × 314 welcome sidebar. */
const sidebar = `<div style="width:164px;height:314px;position:relative;overflow:hidden;font-family:Segoe UI,system-ui,sans-serif;
  background:radial-gradient(120% 70% at 100% 0%,rgba(255,122,89,.55),transparent 60%),radial-gradient(90% 60% at 0% 100%,rgba(108,92,231,.45),transparent 60%),#17171b">
  <div style="position:absolute;left:22px;top:34px">${mark.replace('<svg ', '<svg width="64" height="64" ')}</div>
  <div style="position:absolute;left:22px;top:112px;color:#fff;font-weight:700;font-size:17px;line-height:1.15">MOE<br>Motion AI</div>
  <div style="position:absolute;left:22px;top:160px;color:#ffb38a;font-size:10px;letter-spacing:.12em;font-weight:700">FOR AFTER EFFECTS</div>
  <svg width="164" height="120" style="position:absolute;left:0;bottom:0" viewBox="0 0 164 120"><path d="M-10 100 C 40 100, 50 40, 90 40 S 150 90, 180 50" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2" stroke-dasharray="4 5"/>
  <path d="M90 33l7 7-7 7-7-7z" fill="#ff7a59"/><path d="M30 93l6 6-6 6-6-6z" fill="rgba(255,255,255,.6)"/><rect x="130" y="58" width="22" height="16" rx="4" fill="#ff7a59"/></svg></div>`;
const INSTALLER = [['moe-256.png', mark.replace('<svg ', '<svg width="256" height="256" '), 256, 256], ['sidebar.png', sidebar, 164, 314]];

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
  const IOUT = path.join(__dirname, '..', 'installer', 'assets');
  fs.mkdirSync(IOUT, { recursive: true });
  for (const [file, html, w, hh] of INSTALLER) {
    const page = await browser.newPage({ viewport: { width: w, height: hh }, deviceScaleFactor: 1 });
    await page.setContent(`<html><body style="margin:0;background:transparent">${html}</body></html>`);
    await page.screenshot({ path: path.join(IOUT, file), omitBackground: true, clip: { x: 0, y: 0, width: w, height: hh } });
    await page.close();
    console.log(`✓ installer/assets/${file}`);
  }
  await browser.close();
})();
