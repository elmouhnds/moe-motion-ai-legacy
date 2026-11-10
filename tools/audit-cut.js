'use strict';
/**
 * v0.54 No cut names (docs/features/NO_CUT_NAMES.md): every page × the three styles × two widths. A text cut with
 * "…" (text-overflow or a line clamp) fails unless it is a description whose full text is in a tooltip (title on it
 * or a parent). Names must wrap instead. Needs the dev server (node tools/dev-server.js).
 *
 *   node tools/audit-cut.js            → exit 1 on any cut name
 */
const { chromium } = require('playwright');
const VIEWS = ['home', 'kits', 'kit', 'animate', 'text', 'layout', 'looks', 'zoom', 'expressions', 'shapes', 'backgrounds', 'compositing', 'deliver', 'quick', 'select', 'brand', 'tools', 'favorites', 'history', 'settings', 'diagnostics', 'templates', 'productui'];
const STYLES = ['bento', 'glass', 'moe', 'control'];
const WIDTHS = [420, 740];
(async () => {
  const b = await chromium.launch();
  const bad = {}, ok = {}, errs = [];
  for (const style of STYLES) for (const w of WIDTHS) {
    const p = await b.newPage({ viewport: { width: w + 20, height: 900 } });
    p.on('pageerror', (e) => errs.push(`${style}@${w}: ${e.message}`));
    await p.goto(`http://localhost:5173/?w=${w}`); await p.waitForFunction(() => !!window.__app); await p.waitForTimeout(500);
    // the MOE sidebar open wide is the tightest case: the page gets the least room
    await p.evaluate((s) => { const a = window.__app; a.services.settings.update({ ui: { layout: s } }); a.services.store.set('moe-rail-wide', true); const qb = require('/extension/app/ui/quickbar.js'); a.services.store.set('quick-bar', qb.ACTIONS.map((x) => x.id)); a.render(); }, style);
    for (const v of VIEWS) {
      await p.evaluate((v) => window.__app.go(v), v); await p.waitForTimeout(450);
      const found = await p.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => {
        if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return false;
        const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || e.offsetParent === null) return false;
        const clamped = cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none';
        // also a word clipped with no "…" at all (overflow hidden, not a scrolling row)
        const hidden = cs.overflowX === 'hidden' || cs.overflow === 'hidden';
        if (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') return false;
        return (clamped || hidden) && (e.scrollWidth > e.clientWidth + 1 || (clamped && e.scrollHeight > e.clientHeight + 2));
      }).map((e) => {
        const text = e.textContent.trim();
        let t = e, tip = '';
        for (let k = 0; k < 4 && t; k++, t = t.parentElement) if (t.title) { tip = t.title; break; }
        const key = (e.closest('[data-key]') || { dataset: {} }).dataset.key || '';
        return { id: `${key} | ${e.className || e.tagName.toLowerCase()} | ${text.slice(0, 50)}`, tipped: tip.indexOf(text.slice(0, 40)) >= 0 };
      }));
      found.forEach((f) => { const m = f.tipped ? ok : bad; (m[f.id] = m[f.id] || []).push(`${style}@${w}/${v}`); });
    }
    await p.close();
  }
  await b.close();
  console.log(`${STYLES.length * WIDTHS.length * VIEWS.length} screens · cut names ${Object.keys(bad).length} · shortened with full tooltip ${Object.keys(ok).length} · JS errors ${errs.length}`);
  Object.keys(bad).forEach((k) => console.log(` ✗ ${k}  ←  ${bad[k].slice(0, 3).join(', ')}${bad[k].length > 3 ? ` +${bad[k].length - 3}` : ''}`));
  errs.slice(0, 10).forEach((e) => console.log(` ✗ ${e}`));
  process.exitCode = Object.keys(bad).length || errs.length ? 1 : 0;
})();
