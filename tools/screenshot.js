'use strict';
/** Dev: capture preview screenshots + console errors. Usage: node tools/screenshot.js */
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');

const W = (q) => `${q}&w=900`;
const SHOTS = [
  // v0.6.3 connection error
  ['c-hostfail', W('?view=home&fixture=layout&hostFail=1'), async (p) => { await p.waitForSelector('.ctx-err'); await p.waitForTimeout(300); }],
  ['c-hostfail-diag', W('?view=home&fixture=layout&hostFail=1'), async (p) => { await p.waitForSelector('.ctx-err'); await p.click('.ctx-btn'); await p.waitForTimeout(300); }],
  // v0.8.0 workspaces & pie
  ['v-pie-keys', '?view=animate&fixture=layout&w=420', async (p) => { await p.click('.content'); await p.mouse.move(230, 420); await p.keyboard.press('q'); await p.mouse.move(300, 420); await p.waitForTimeout(200); }],
  ['v-pie-text', '?view=text&fixture=studio&w=420', async (p) => { await p.click('.content'); await p.mouse.move(230, 420); await p.keyboard.press('q'); await p.waitForTimeout(200); }],
  ['v-pie-wide', W('?view=layout&fixture=layout'), async (p) => { await p.click('.content'); await p.mouse.move(520, 420); await p.keyboard.press('q'); await p.mouse.move(520, 340); await p.waitForTimeout(200); }],
  ['v-workspace', W('?view=backgrounds&fixture=layout'), async (p) => { await p.waitForTimeout(400); }],
  ['v-home-suggest', '?view=home&fixture=studio&w=420', async (p) => { await p.evaluate(() => document.querySelector('.hm-suggest').scrollIntoView()); await p.waitForTimeout(300); }],
  ['v-settings-pie', W('?view=settings'), async (p) => { await p.click('.set-group .seg button:has-text("My pie")'); await p.evaluate(() => [...document.querySelectorAll('.section-h')].find((x) => x.textContent === 'Pie menu').scrollIntoView()); await p.waitForTimeout(300); }],
  // v0.7.0 workflow
  ['w-actbar', '?view=animate&fixture=layout&w=420', async (p) => { await p.hover('.st-cell:nth-child(2)'); await p.waitForTimeout(300); }],
  ['w-search', '?view=animate&fixture=layout&w=420', async (p) => { await p.keyboard.press('Control+k'); await p.keyboard.type('pop'); await p.waitForTimeout(300); }],
  ['w-repeat', '?view=animate&fixture=layout&w=420', async (p) => { await p.click('.st-actbar .btn.primary'); await p.waitForSelector('.ctx-repeat'); await p.waitForTimeout(300); }],
  ['w-blocked', '?view=animate&fixture=layout&w=420', async (p) => { await p.click('.content'); await p.evaluate(() => { const c = [...document.querySelectorAll('.st-cell')].find((x) => /Draw On/.test(x.textContent)); c.scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(300); }],
  ['w-compositing', W('?view=compositing&fixture=comp'), async (p) => { await p.waitForTimeout(500); }],
  ['w-sidebar', W('?view=home&fixture=layout'), async (p) => { await p.waitForTimeout(400); }],
  ['w-settings', W('?view=settings'), async (p) => { await p.evaluate(() => { const h = [...document.querySelectorAll('.section-h')].find((x) => x.textContent === 'Sidebar'); h.scrollIntoView(); }); await p.waitForTimeout(300); }],
  // v0.6.1 Updates
  ['u-updates', W('?view=settings&demoUpdate=1'), async (p) => { await p.click('text=Check now'); await p.waitForSelector('.upd-card'); await p.waitForTimeout(300); }],
  ['u-ready', W('?view=settings&demoUpdate=1'), async (p) => { await p.click('text=Check now'); await p.waitForSelector('.upd-card'); await p.click('text=Download & verify'); await p.waitForSelector('text=Install when I close After Effects', { timeout: 8000 }); await p.waitForTimeout(200); }],
  ['u-scheduled', W('?view=settings&demoUpdate=1'), async (p) => { await p.click('text=Check now'); await p.waitForSelector('.upd-card'); await p.click('text=Download & verify'); await p.click('text=Install when I close After Effects', { timeout: 8000 }); await p.waitForTimeout(300); }],
  // v0.6 Premium
  ['p-home', W('?view=home&fixture=layout'), async (p) => { await p.waitForTimeout(700); }],
  ['p-shapes', W('?view=shapes&fixture=layout'), async (p) => { await p.click('.sh-tile:nth-child(9)'); await p.waitForTimeout(500); }],
  ['p-shapes-search', W('?view=shapes&fixture=layout'), async (p) => { await p.fill('[data-fk="sh-q"]', 'rocket'); await p.press('[data-fk="sh-q"]', 'Enter'); await p.waitForTimeout(200); await p.click('.sh-tile:nth-child(1)'); await p.click('.st-inspector .seg button:has-text("Duo")'); await p.waitForTimeout(500); }],
  ['p-shapes-insert', W('?view=shapes&fixture=layout'), async (p) => { await p.click('.st-inspector .btn.primary'); await p.waitForSelector('.st-inspector .report'); await p.waitForTimeout(400); }],
  ['p-shapes-prim', W('?view=shapes&fixture=layout'), async (p) => { await p.click('text=Shapes · 22'); await p.waitForTimeout(200); await p.click('.sh-tile.prim:nth-child(3)'); await p.waitForTimeout(500); }],
  ['p-bg', W('?view=backgrounds&fixture=layout'), async (p) => { await p.click('.st-cell:nth-child(2) .st-tile'); await p.waitForTimeout(700); }],
  ['p-bg-mesh', W('?view=backgrounds&fixture=layout'), async (p) => { await p.click('.st-cell:nth-child(14) .st-tile'); await p.waitForTimeout(200); await p.click('.st-inspector .seg button:has-text("Mesh")'); await p.click('.st-inspector .btn.primary'); await p.waitForSelector('.st-inspector .report'); await p.waitForTimeout(400); }],
  ['p-expr', W('?view=expressions&fixture=layout'), async (p) => { await p.click('.chip-btn:has-text("Auto")'); await p.waitForTimeout(500); }],
  ['p-ease', W('?view=animate&fixture=layout'), async (p) => { await p.click('.chip-btn:has-text("Ease")'); await p.waitForTimeout(500); }],
  ['p-whatsnew', W('?view=home&fixture=layout&fresh=1')],
  ['p-shortcuts', W('?view=animate&fixture=layout'), async (p) => { await p.keyboard.press('Shift+Slash'); await p.waitForTimeout(300); }],
  ['p-about', W('?view=home&fixture=layout'), async (p) => { await p.click('.sb-brand'); await p.waitForTimeout(300); }],
  ['p-settings', W('?view=settings'), async (p) => { await p.waitForTimeout(200); }],
  ['p-midnight', W('?view=home&fixture=layout&theme=midnight&accent=violet'), async (p) => { await p.waitForTimeout(600); }],
  ['p-light-mint', W('?view=shapes&fixture=layout&theme=light&accent=mint'), async (p) => { await p.waitForTimeout(500); }],
  ['p-mine', W('?view=animate&fixture=layout'), async (p) => { await p.click('.st-cell:nth-child(3) .st-tile'); await p.waitForTimeout(200); await p.click('.st-inspector [aria-label="Save as preset"]'); await p.waitForSelector('.overlay .txt'); await p.fill('.overlay .txt', 'My slide'); await p.click('.overlay .btn.primary'); await p.waitForTimeout(500); }],
  ['p-splash', W('?view=home&fixture=layout&splash=1'), async (p) => { await p.waitForTimeout(450); }],
  ['p-narrow-home', '?view=home&fixture=layout&w=380', async (p) => { await p.waitForTimeout(500); }],
  ['p-narrow-shapes', '?view=shapes&fixture=layout&w=380', async (p) => { await p.waitForTimeout(500); }],
  // Studio (wide, 900 px)
  ['s-animate', W('?view=animate&fixture=layout'), async (p) => { await p.waitForTimeout(500); }],
  ['s-animate-pick', W('?view=animate&fixture=layout'), async (p) => { await p.click('.st-cell:nth-child(6) .st-tile'); await p.waitForTimeout(500); }],
  ['s-animate-apply', W('?view=animate&fixture=layout'), async (p) => { await p.dblclick('.st-cell:nth-child(1) .st-tile'); await p.waitForSelector('.toast'); await p.waitForTimeout(200); }],
  ['s-animate-all', W('?view=animate&fixture=layout'), async (p) => { await p.click('text=All tools'); await p.waitForTimeout(300); }],
  ['s-text', W('?view=text&fixture=studio'), async (p) => { await p.waitForTimeout(700); }],
  ['s-layout', W('?view=layout&fixture=layout'), async (p) => { await p.waitForTimeout(600); }],
  ['s-layout-ring', W('?view=layout&fixture=layout'), async (p) => { await p.click('.st-cell:nth-child(4) .st-tile'); await p.waitForTimeout(600); }],
  ['s-layout-build', W('?view=layout&fixture=layout'), async (p) => { await p.click('.st-cell:nth-child(3) .st-tile'); await p.waitForTimeout(300); await p.click('.st-inspector .btn.primary'); await p.waitForSelector('.st-inspector .report'); await p.waitForTimeout(300); }],
  ['s-looks', W('?view=looks&fixture=layout'), async (p) => { await p.waitForTimeout(600); }],
  ['s-looks-apply', W('?view=looks&fixture=layout'), async (p) => { await p.click('.st-inspector .btn.primary'); await p.waitForSelector('.st-inspector .report'); await p.waitForTimeout(300); }],
  ['s-zoom', W('?view=zoom&fixture=layout'), async (p) => { await p.click('.st-cell:nth-child(5) .st-tile'); await p.waitForTimeout(600); }],
  ['s-expr', W('?view=expressions&fixture=layout'), async (p) => { await p.click('.st-cell:nth-child(14) .st-tile'); await p.waitForTimeout(500); }],
  ['s-expr-editor', W('?view=expressions&fixture=layout'), async (p) => { await p.click('text=Editor'); await p.waitForTimeout(300); }],
  ['s-deliver', W('?view=deliver&fixture=layout'), async (p) => { await p.waitForSelector('.dv-board'); await p.waitForTimeout(400); }],
  ['s-deliver-edit', W('?view=deliver&fixture=layout'), async (p) => { await p.waitForSelector('.dv-board'); await p.click('.dv-card:nth-child(3)'); await p.selectOption('.st-inspector .plan-row:nth-child(10) select', 'pinned'); await p.waitForTimeout(400); }],
  ['s-deliver-create', W('?view=deliver&fixture=layout'), async (p) => { await p.waitForSelector('.dv-board'); await p.click('.dv-foot .btn.primary'); await p.waitForSelector('.dv-results .report'); await p.waitForTimeout(800); }],
  ['s-comp', W('?view=compositing&fixture=comp'), async (p) => { await p.waitForTimeout(300); }],
  ['s-quick', W('?view=quick&fixture=layout')],
  ['s-quickpop', W('?view=quick&fixture=layout'), async (p) => { await p.click('.qbar .qb-btn:nth-child(11)', { button: 'right' }); await p.waitForSelector('.qpop'); await p.waitForTimeout(200); }],
  ['s-brand', W('?view=brand&fixture=studio&seedBrand=1'), async (p) => { await p.waitForTimeout(300); }],
  ['s-select', W('?view=select&fixture=studio'), async (p) => { await p.waitForSelector('.type-btn .count'); await p.waitForTimeout(300); }],
  ['s-copilot', W('?view=animate&demoAI=1'), async (p) => { await p.click('.cp-bar'); await p.fill('[data-fk="cp-input"]', 'make it snappy and cascade the layers'); await p.click('.cp-sheet .btn'); await p.waitForSelector('.step'); }],
  ['s-settings', W('?view=settings')],
  ['s-history', W('?view=history&fixture=layout')],
  ['s-light', W('?view=animate&fixture=layout&theme=light'), async (p) => { await p.waitForTimeout(400); }],
  ['s-palette', W('?view=animate'), async (p) => { await p.keyboard.press('Control+K'); await p.keyboard.type('grid'); }],
  // Narrow docks still work (icon sidebar, inspector under the tiles)
  ['n-animate', '?view=animate&fixture=layout&w=380', async (p) => { await p.waitForTimeout(500); }],
  ['n-layout', '?view=layout&fixture=layout&w=380', async (p) => { await p.waitForTimeout(500); }],
  ['n-deliver', '?view=deliver&fixture=layout&w=380', async (p) => { await p.waitForSelector('.dv-board'); await p.waitForTimeout(300); }],
  ['n-compact', '?view=animate&fixture=layout&w=280', async (p) => { await p.waitForTimeout(300); }]
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const only = process.argv[2];
  let errors = 0;
  for (const [name, qs, act] of SHOTS) {
    if (only && !name.startsWith(only)) continue;
    const page = await browser.newPage({ viewport: { width: (qs.match(/w=(\d+)/) ? Number(RegExp.$1) : 360) + 40, height: 720 }, deviceScaleFactor: 2 });
    page.setDefaultTimeout(6000);
    page.on('pageerror', (e) => { errors++; console.log(`[${name}] pageerror: ${e.message}`); });
    page.on('console', (m) => { if (m.type() === 'error') { errors++; console.log(`[${name}] console: ${m.text()}`); } });
    await page.goto(`http://localhost:5173/${qs}`);
    if (!/splash=1/.test(qs)) await page.waitForSelector('.ctx .dot.live', { timeout: 5000 }).catch(() => console.log(`[${name}] host not live`));
    await page.waitForTimeout(150);
    if (act) await act(page).catch((e) => { errors++; console.log(`[${name}] action failed: ${e.message.split('\n')[0]}`); });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `dev/screens/${name}.png` });
    await page.close();
  }
  await browser.close();
  console.log(errors ? `${errors} error(s)` : 'no errors');
})();
