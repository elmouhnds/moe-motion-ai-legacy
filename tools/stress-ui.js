'use strict';
/**
 * Dev: AE-like stress test of the panel UI in Chromium (slow host + a selection context that
 * changes on every read, like a live After Effects session).
 *   node tools/stress-ui.js            (dev server must run: npm run preview)
 * Measures, per view:
 *   swaps     — was the element under the resting mouse replaced while hovering 6 s? (must be 0)
 *   renders   — full panel renders during those 6 s
 *   clicks    — slow, human clicks (120 ms press) that registered, out of 20
 *   jitter    — hover on/off flips with the mouse resting 1 px inside a tile's bottom edge (must be 0)
 *   busy      — main-thread busy % while idle (CDP TaskDuration)
 * Exits 1 if any hard check fails.
 */
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');

const BASE = 'http://localhost:5173/';
const Q = '&fixture=layout&w=900&hostDelay=250&ctxChurn=1';
const VIEWS = [['animate', '.st-tile'], ['shapes', '.sh-tile'], ['home', '.hm-start'], ['backgrounds', '.st-tile']];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  let failed = 0;
  const rows = [];
  for (const [view, sel] of VIEWS) {
    const page = await browser.newPage({ viewport: { width: 940, height: 720 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}?view=${view}${Q}`);
    await page.waitForSelector('.ctx .dot.live', { timeout: 8000 });
    await page.waitForTimeout(600);
    const rect = (i) => page.evaluate(([s, k]) => { const r = document.querySelectorAll(s)[k].getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, [sel, i]);
    const box = await rect(2);
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.waitForTimeout(300);

    // 1) resting hover: is the node under the mouse replaced?
    await page.evaluate(([x, y]) => { window.__probe = document.elementFromPoint(x, y); window.__r0 = window.__app.stats.renders; }, [cx, cy]);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    const m0 = (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'TaskDuration').value;
    await page.waitForTimeout(6000);
    const m1 = (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'TaskDuration').value;
    const hover = await page.evaluate(() => ({ swapped: !window.__probe.isConnected, renders: window.__app.stats.renders - window.__r0, reads: window.__app.stats.ctxReads }));

    // 2) slow human clicks on alternating tiles (only meaningful for selectable tiles)
    let ok = 0;
    for (let i = 0; i < 20; i++) {
      const b = await rect(i % 2 ? 3 : 4);
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(120);
      await page.mouse.up();
      await page.waitForTimeout(view === 'home' ? 0 : 150);
      if (view === 'home') { ok += (await page.evaluate(() => window.__app.state.get().view)) !== 'home' ? 1 : 0; await page.evaluate(() => window.__app.go('home')); await page.waitForTimeout(150); continue; }
      const on = await page.evaluate(([s, idx]) => { const el = document.querySelectorAll(s)[idx]; return !!el && (el.classList.contains('on') || el.getAttribute('aria-pressed') === 'true'); }, [sel, i % 2 ? 3 : 4]);
      if (on) ok++;
    }

    // 3) hover jitter at the bottom edge of a tile
    const b5 = await rect(5);
    await page.mouse.move(b5.x + b5.width / 2, b5.y + b5.height - 1);
    await page.waitForTimeout(200);
    const flips = await page.evaluate(([s]) => new Promise((res) => {
      let n = 0, last = null, k = 0;
      const tick = () => { const el = document.querySelectorAll(s)[5]; const h = !!el && el.matches(':hover'); if (last !== null && h !== last) n++; last = h; if (++k < 40) requestAnimationFrame(tick); else res(n); };
      requestAnimationFrame(tick);
    }), [sel]);

    const busy = Math.round(((m1 - m0) / 6) * 100);
    const row = { view, swaps: hover.swapped ? 1 : 0, renders: hover.renders, clicks: `${ok}/20`, jitter: flips, busy: `${busy}%`, errors: errors.length };
    rows.push(row);
    if (hover.swapped || ok < 20 || flips > 0 || errors.length) failed++;
    await page.close();
  }
  await browser.close();
  console.table(rows);
  console.log(failed ? `✗ ${failed} view(s) failed` : '✓ stable: no swaps under the mouse, every click registered, no hover jitter');
  process.exit(failed ? 1 : 0);
})();
