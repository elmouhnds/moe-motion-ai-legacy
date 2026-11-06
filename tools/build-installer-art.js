'use strict';
/**
 * Installer artwork (installer/assets), rendered with Chromium and converted to 24-bit BMP (NSIS needs BMP):
 *   sidebar.bmp  164 × 314  welcome / finish pages (left)
 *   header.bmp   150 ×  57  install / uninstall pages (top right)
 * Both are drawn on the installer's background colour BG (MUI_BGCOLOR in moe-motion-ai.nsi) so the art and the
 * page are one surface — keep the two in sync.
 *
 *   node tools/build-installer-art.js
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');

const BG = '#111116';
const OUT = path.join(__dirname, '..', 'installer', 'assets');
const mark = (s) => `<svg width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a59"/><stop offset="1" stop-color="#ff3d6e"/></linearGradient></defs>
<rect x="1" y="1" width="30" height="30" rx="8.5" fill="url(#g)"/><path d="M8 22.5V11.5l8 7.2 8-7.2v11" fill="none" stroke="#1c0d08" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
// the panel's own display font (bundled, OFL) so the art matches the panel on any build machine
const FONT_DIR = path.join(__dirname, '..', 'extension', 'assets', 'fonts');
const fontFace = fs.readdirSync(FONT_DIR).filter((f) => /^sora.*\.woff2$/i.test(f)).map((f) => `@font-face{font-family:Sora;src:url(data:font/woff2;base64,${fs.readFileSync(path.join(FONT_DIR, f)).toString('base64')}) format('woff2');font-weight:100 800}`).join('');
const font = "font-family:Sora,'Segoe UI',system-ui,sans-serif";

// a speed graph: the ease the panel is about, with its keyframes
const curve = (w, h) => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="position:absolute;left:0;bottom:0">
  <defs><linearGradient id="c" x1="0" x2="1"><stop offset="0" stop-color="#ff7a59" stop-opacity=".15"/><stop offset=".55" stop-color="#ff7a59"/><stop offset="1" stop-color="#ff3d6e" stop-opacity=".5"/></linearGradient>
  <linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a59" stop-opacity=".22"/><stop offset="1" stop-color="#ff7a59" stop-opacity="0"/></linearGradient></defs>
  <path d="M0 ${h - 18} C ${w * 0.38} ${h - 18}, ${w * 0.42} 18, ${w} 18 L ${w} ${h} L 0 ${h} Z" fill="url(#f)"/>
  <path d="M0 ${h - 18} C ${w * 0.38} ${h - 18}, ${w * 0.42} 18, ${w} 18" fill="none" stroke="url(#c)" stroke-width="2"/>
  <line x1="${w * 0.38}" y1="${h - 18}" x2="22" y2="${h - 18}" stroke="rgba(255,255,255,.35)" stroke-width="1"/>
  <circle cx="${w * 0.38}" cy="${h - 18}" r="3" fill="#fff" fill-opacity=".85"/>
  <path d="M22 ${h - 24}l6 6-6 6-6-6z" fill="#fff"/>
</svg>`;

const sidebar = `<div style="width:164px;height:314px;position:relative;overflow:hidden;${font};
  background:radial-gradient(110% 60% at 0% 0%,rgba(255,122,89,.30),transparent 62%),radial-gradient(90% 50% at 0% 100%,rgba(108,92,231,.28),transparent 65%),${BG}">
  <div style="position:absolute;left:24px;top:30px;filter:drop-shadow(0 6px 16px rgba(255,90,80,.45))">${mark(52)}</div>
  <div style="position:absolute;left:24px;top:98px;color:#fff;font-weight:700;font-size:19px;line-height:1.12;letter-spacing:-.01em">MOE<br>Motion AI</div>
  <div style="position:absolute;left:24px;top:149px;color:#ff9a7a;font-size:9.5px;letter-spacing:.14em;font-weight:700">AFTER EFFECTS 2025</div>
  <div style="position:absolute;left:24px;top:170px;width:28px;height:2px;border-radius:2px;background:#ff7a59"></div>
  ${curve(164, 96)}
  <div style="position:absolute;right:0;top:0;bottom:0;width:18px;background:linear-gradient(90deg,transparent,${BG})"></div>
</div>`;

const header = `<div style="width:150px;height:57px;position:relative;overflow:hidden;${font};background:${BG}">
  <svg width="150" height="57" viewBox="0 0 150 57" style="position:absolute;inset:0">
    <path d="M10 46 C 52 46, 58 12, 104 12" fill="none" stroke="#ff7a59" stroke-opacity=".75" stroke-width="1.6"/>
    <path d="M10 41l5 5-5 5-5-5z" fill="#fff" fill-opacity=".8"/><circle cx="58" cy="29" r="2.4" fill="#ff7a59"/>
  </svg>
  <div style="position:absolute;right:12px;top:12px;filter:drop-shadow(0 4px 10px rgba(255,90,80,.4))">${mark(33)}</div>
</div>`;

const ART = [['sidebar', sidebar, 164, 314], ['header', header, 150, 57]];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const [name, html, w, h] of ART) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.setContent(`<html><head><style>${fontFace}</style></head><body style="margin:0;background:${BG}">${html}</body></html>`);
    await page.evaluate(async () => { await document.fonts.load('700 19px Sora'); await document.fonts.ready; });
    const png = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: png, clip: { x: 0, y: 0, width: w, height: h } });
    await page.close();
    // NSIS loads 24-bit BMP v3 only
    execFileSync('convert', [png, '-background', BG, '-flatten', '-type', 'TrueColor', `BMP3:${path.join(OUT, `${name}.bmp`)}`]);
    console.log(`✓ installer/assets/${name}.bmp (${w}×${h})`);
  }
  await browser.close();
})();
