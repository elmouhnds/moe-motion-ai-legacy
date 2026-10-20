'use strict';
/** Dev: capture preview screenshots + console errors. Usage: node tools/screenshot.js */
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');

const W = (q) => `${q}&w=900`;
const SHOTS = [
  // Studio (wide, 900 px)
  ['s-animate', W('?view=animate&fixture=layout'), async (p) => { await p.waitForTimeout(500); }],
  ['s-animate-pick', W('?view=animate&fixture=layout'), async (p) => { await p.click('.st-tile:nth-child(6)'); await p.waitForTimeout(500); }],
  ['s-animate-apply', W('?view=animate&fixture=layout'), async (p) => { await p.dblclick('.st-tile:nth-child(1)'); await p.waitForSelector('.toast'); await p.waitForTimeout(200); }],
  ['s-animate-all', W('?view=animate&fixture=layout'), async (p) => { await p.click('text=All tools'); await p.waitForTimeout(300); }],
  ['s-text', W('?view=text&fixture=studio'), async (p) => { await p.waitForTimeout(700); }],
  ['s-layout', W('?view=layout&fixture=layout'), async (p) => { await p.waitForTimeout(600); }],
  ['s-layout-ring', W('?view=layout&fixture=layout'), async (p) => { await p.click('.st-tile:nth-child(4)'); await p.waitForTimeout(600); }],
  ['s-layout-build', W('?view=layout&fixture=layout'), async (p) => { await p.click('.st-tile:nth-child(3)'); await p.waitForTimeout(300); await p.click('.st-inspector .btn.primary'); await p.waitForSelector('.st-inspector .report'); await p.waitForTimeout(300); }],
  ['s-looks', W('?view=looks&fixture=layout'), async (p) => { await p.waitForTimeout(600); }],
  ['s-looks-apply', W('?view=looks&fixture=layout'), async (p) => { await p.click('.st-inspector .btn.primary'); await p.waitForSelector('.st-inspector .report'); await p.waitForTimeout(300); }],
  ['s-zoom', W('?view=zoom&fixture=layout'), async (p) => { await p.click('.st-tile:nth-child(5)'); await p.waitForTimeout(600); }],
  ['s-expr', W('?view=expressions&fixture=layout'), async (p) => { await p.click('.st-tile:nth-child(14)'); await p.waitForTimeout(500); }],
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
    page.on('pageerror', (e) => { errors++; console.log(`[${name}] pageerror: ${e.message}`); });
    page.on('console', (m) => { if (m.type() === 'error') { errors++; console.log(`[${name}] console: ${m.text()}`); } });
    await page.goto(`http://localhost:5173/${qs}`);
    await page.waitForSelector('.ctx .dot.live', { timeout: 5000 }).catch(() => console.log(`[${name}] host not live`));
    await page.waitForTimeout(150);
    if (act) await act(page).catch((e) => { errors++; console.log(`[${name}] action failed: ${e.message.split('\n')[0]}`); });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `dev/screens/${name}.png` });
    await page.close();
  }
  await browser.close();
  console.log(errors ? `${errors} error(s)` : 'no errors');
})();
