'use strict';
/** Dev: capture preview screenshots + console errors. Usage: node tools/screenshot.js */
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');

const SHOTS = [
  ['motion', '?view=motion'],
  ['motion-compact', '?view=motion&w=260'],
  ['motion-wide', '?view=motion&w=560'],
  ['expressions', '?view=expressions&demoAI=1'],
  ['copilot', '?view=motion&demoAI=1', async (p) => { await p.click('.cp-bar'); await p.fill('[data-fk="cp-input"]', 'make it snappy and cascade the layers'); await p.click('.cp-sheet .btn'); await p.waitForSelector('.step'); }],
  ['copilot-done', '?view=motion&demoAI=1', async (p) => { await p.click('.cp-bar'); await p.fill('[data-fk="cp-input"]', 'snappy cascade'); await p.click('.cp-sheet .btn'); await p.waitForSelector('.btn.primary.grow'); await p.click('.btn.primary.grow'); await p.waitForSelector('.cp-sheet .report'); }],
  ['assistant', '?view=expressions&demoAI=1', async (p) => { await p.fill('[data-fk="assist-req"]', 'overshoot when the move ends'); await p.click('text=Ask Claude'); await p.waitForSelector('.diff'); }],
  ['tools', '?view=tools&demoAI=1', async (p) => { await p.fill('[data-fk="factory-desc"]', 'soft cascade'); await p.click('text=Design tool'); await p.waitForSelector('text=Approve & save'); }],
  ['history', '?view=motion', async (p) => { await p.click('.tool.open .btn.primary'); await p.waitForSelector('.report'); await p.click('[aria-label="History"]'); await p.waitForSelector('.list-row'); }],
  ['comp', '?view=compositing&fixture=comp'],
  ['comp-compact', '?view=compositing&fixture=comp&w=260'],
  ['comp-analyze', '?view=compositing&fixture=comp', async (p) => { await p.click('.tool.open .btn.primary'); await p.waitForSelector('.swatches'); }],
  ['comp-key', '?view=compositing&fixture=comp', async (p) => { await p.click('[data-tool="compositing.keySetup"] .tool-h'); await p.click('[data-tool="compositing.keySetup"] .btn.primary'); await p.waitForSelector('[data-tool="compositing.keySetup"] .report'); }],
  ['comp-match', '?view=compositing&fixture=comp', async (p) => { await p.click('[data-tool="compositing.matchColor"] .tool-h'); await p.selectOption('[data-tool="compositing.matchColor"] select', '2'); await p.click('[data-tool="compositing.matchColor"] .btn.primary'); await p.waitForSelector('[data-tool="compositing.matchColor"] .report'); }],
  ['comp-look', '?view=compositing&fixture=comp&demoAI=1', async (p) => { await p.click('[data-tool="compositing.lookAssist"] .tool-h'); await p.fill('[data-tool="compositing.lookAssist"] textarea', 'cold clinical thriller'); await p.locator('[data-tool="compositing.lookAssist"] textarea').blur(); await p.click('[data-tool="compositing.lookAssist"] .btn.primary'); await p.waitForSelector('text=Use in Grade'); await p.click('text=Use in Grade'); await p.waitForTimeout(200); }],
  ['text', '?view=text&fixture=studio'],
  ['text-ar', '?view=text&fixture=studio', async (p) => { await p.click('button[title="Arabic sample"]'); await p.waitForTimeout(700); }],
  ['text-apply', '?view=text&fixture=studio', async (p) => { await p.click('.tp-card'); await p.click('.tp-apply .btn.primary'); await p.waitForSelector('.tp-apply .report'); await p.waitForTimeout(500); }],
  ['brand', '?view=brand&fixture=studio&seedBrand=1'],
  ['brand-applied', '?view=brand&fixture=studio&seedBrand=1', async (p) => { await p.click('.brand-swatch:nth-child(3)'); await p.waitForSelector('.report'); await p.click('text=Auto fonts'); await p.waitForTimeout(400); }],
  ['brand-edit', '?view=brand&fixture=studio&seedBrand=1', async (p) => { await p.click('button[title="Edit client"]'); await p.waitForSelector('.brand-edit'); }],
  ['select', '?view=select&fixture=studio', async (p) => { await p.waitForSelector('.type-btn .count'); await p.waitForTimeout(300); }],
  ['select-run', '?view=select&fixture=studio', async (p) => { await p.waitForTimeout(400); await p.click('.type-btn:first-child'); await p.waitForTimeout(400); }],
  ['proximity', '?view=motion&fixture=studio', async (p) => { await p.click('[data-tool="proximity.apply"] .tool-h'); await p.waitForTimeout(200); }],
  ['proximity-run', '?view=motion&fixture=studio', async (p) => { await p.click('[data-tool="proximity.apply"] .tool-h'); await p.click('[data-tool="proximity.apply"] .btn.primary'); await p.waitForSelector('[data-tool="proximity.apply"] .report'); }],
  ['settings', '?view=settings'],
  ['diagnostics', '?view=diagnostics'],
  ['palette', '?view=motion', async (p) => { await p.keyboard.press('Control+K'); await p.keyboard.type('ease'); }],
  ['light', '?view=motion&theme=light']
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
