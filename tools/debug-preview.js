'use strict';
/** Dev: print page/console errors for one preview URL. Usage: node tools/debug-preview.js "?view=motion" */
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('pageerror', e.message, (e.stack || '').split('\n').slice(0, 4).join(' | ')));
  p.on('console', (m) => { if (m.type() !== 'log') console.log('console', m.type(), m.text().slice(0, 300)); });
  await p.goto('http://localhost:5173/' + (process.argv[2] || '?view=motion'));
  await p.waitForTimeout(1500);
  console.log('ctx live:', await p.$('.ctx .dot.live') !== null);
  await b.close();
})();
