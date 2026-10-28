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
const VIEWS = [['animate', '.st-tile'], ['shapes', '.sh-tile'], ['home', '.focus-act'], ['backgrounds', '.st-tile'], ['kit', '.kit-tool']];

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
    const rect = (i) => page.evaluate(([s, k]) => { const el = document.querySelectorAll(s)[k]; const c = el.closest('.content'); const r0 = el.getBoundingClientRect(); if (c && (r0.bottom > c.getBoundingClientRect().bottom || r0.top < c.getBoundingClientRect().top)) el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, [sel, i]);
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
    // Kit buttons run a tool instead of selecting a tile: count clicks that reach a live button and either start a run
    // or (dimmed tool) explain why in a warning — both mean the click registered.
    if (view === 'kit' || view === 'home') await page.evaluate(([s]) => { window.__kc = 0; document.addEventListener('click', (e) => { const el = e.target.closest(s); if (el && el.isConnected) window.__kc++; }, true); const run = window.__app.runTool, toast = window.__app.toast; window.__runs = 0; window.__app.runTool = (...a) => { window.__runs++; return run(...a); }; window.__app.toast = (...a) => { if (a[2] === 'warn') window.__runs++; return toast(...a); }; const go = window.__app.go; window.__app.go = (...a) => { window.__runs++; return go(...a); }; }, [sel]);
    for (let i = 0; i < 20; i++) {
      if (view === 'kit' || view === 'home') { await page.waitForFunction(() => !window.__app.state.get().running, null, { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(60); }
      const b = await rect(i % 2 ? 3 : 4);
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(120);
      await page.mouse.up();
      await page.waitForTimeout(view === 'home' ? 0 : 150);
      // Smart Home (v0.15): focus-card buttons run a tool, warn why not, or open a section — all count as registered
      if (view === 'home') { const c = await page.evaluate(() => [window.__kc, window.__runs]); ok += c[0] === i + 1 && c[1] === i + 1 ? 1 : 0; if (await page.evaluate(() => window.__app.state.get().view !== 'home')) { await page.evaluate(() => window.__app.state.set({ view: 'home' })); await page.waitForTimeout(150); } continue; }
      if (view === 'kit') { const c = await page.evaluate(() => [window.__kc, window.__runs]); ok += c[0] === i + 1 && c[1] === i + 1 ? 1 : 0; continue; }
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
