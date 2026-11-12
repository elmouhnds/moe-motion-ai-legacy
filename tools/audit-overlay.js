'use strict';
/**
 * Overlay audit (v0.83, docs/features/GLASS_OVERLAYS.md; owner: "anything that pops up over the plugin must be
 * opaque so it reads"). In every style and both themes it opens each surface that floats over the page — the
 * sidebar menus, the panel menu, a tool's options, Search, a dialog, a sheet (What's new), the toast, the
 * Assistant — and fails when the page shows through it: its background alpha × the opacity of every parent, read
 * after the fade-in has ended, must be at least 0.97.
 * Needs the dev server (node tools/dev-server.js).   node tools/audit-overlay.js   → exit 1 on any finding
 */
const { chromium } = require('playwright');
const STYLES = process.argv.slice(2).length ? process.argv.slice(2) : ['bento', 'glass', 'moe', 'control'];
const THEMES = ['dark', 'light'];
(async () => {
  const b = await chromium.launch();
  const bad = [], seen = {}, errs = [];
  for (const style of STYLES) for (const theme of THEMES) {
    const p = await b.newPage({ viewport: { width: 760, height: 900 } });
    p.on('pageerror', (e) => errs.push(`${style}/${theme}: ${e.message}`));
    await p.goto(`http://localhost:5173/?w=740&theme=${theme}`); await p.waitForFunction(() => !!window.__app); await p.waitForTimeout(500);
    await p.evaluate((s) => { const a = window.__app; a.services.settings.update({ ui: { layout: s } }); a.go('home'); a.render(); }, style); await p.waitForTimeout(900);
    const check = async (name, sels) => {
      await p.waitForTimeout(700); // past the 100 ms fade-in, also on a slow machine
      const r = await p.evaluate((sels) => {
        const alphaOf = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return 0; const v = m[1].split(',').map(Number); return v.length > 3 ? v[3] : 1; };
        for (const sel of sels) for (const e of document.querySelectorAll(sel)) { const r = e.getBoundingClientRect(); if (r.width < 40 || r.height < 20) continue; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') continue; let op = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) op *= Number(getComputedStyle(n).opacity); /* a faded parent makes a solid panel see-through too */ return { sel, alpha: Math.round(alphaOf(cs.backgroundColor) * op * 100) / 100 }; }
        return null;
      }, sels);
      const key = `${style}/${theme} ${name}`;
      if (!r) { seen[key] = 'not shown'; return; }
      seen[key] = r.alpha;
      if (r.alpha < 0.97) bad.push(`${key}: ${r.sel} is ${Math.round(r.alpha * 100)} % opaque`);
    };
    const close = async () => { await p.keyboard.press('Escape'); await p.evaluate(() => { window.__app.state.set({ quickPop: null, aeMenu: null, layMenu: null, modal: null, qbarMore: null, aeTabMenu: null }); document.querySelectorAll('body > .overlay').forEach((e) => e.remove()); }); await p.waitForTimeout(200); };
    await p.evaluate(() => require('/extension/app/ui/palette.js').open(window.__app)); await p.waitForTimeout(300); await check('search', ['.palette']); await close();
    const m = await p.$('[data-key^="rm-"]'); if (m) { await m.click(); await p.waitForTimeout(300); await check('sidebar menu', ['.lay-drop']); await close(); }
    const mb = await p.$('.hdr .icon-btn:last-child'); if (mb) { await mb.click(); await p.waitForTimeout(300); await check('panel menu', ['.ae-menu']); await close(); }
    const rb = await p.$('[data-key^="rq-"], .qb-btn:not(.more):not(.qb-rest)'); if (rb) { await rb.click({ button: 'right' }); await p.waitForTimeout(400); await check('tool options', ['.qpop']); await close(); }
    const more = await p.$('.qb-rest'); if (more) { await more.click(); await p.waitForTimeout(300); await check('more quick actions', ['.qb-rest-pop']); await close(); }
    await p.evaluate(() => window.__app.state.set({ modal: 'whatsnew' })); await p.waitForTimeout(400); await check('sheet', ['.sheet']); await close();
    p.evaluate(() => window.__app.dialog({ title: 'Remove?', body: ['Only the recipe is removed.'], okLabel: 'Remove' })); await p.waitForTimeout(300); await check('dialog', ['.overlay > .palette', '.overlay > div']); await close();
    await p.evaluate(() => window.__app.toast('Pop In — Animated 4 propert(ies)', 5000, 'ok')); await p.waitForTimeout(250); await check('toast', ['.toast']);
    await check('assistant button', ['.as-core']);
    await p.keyboard.press('`'); await p.waitForTimeout(500); await check('assistant', ['.as-sheet']); await p.keyboard.press('`');
    await p.close();
  }
  await b.close();
  const n = Object.keys(seen).length, shown = Object.keys(seen).filter((k) => seen[k] !== 'not shown').length;
  console.log(`${STYLES.length} styles × ${THEMES.length} themes · ${shown} floating surfaces opened (${n - shown} not present in that style) · see-through ${bad.length} · JS errors ${errs.length}`);
  bad.forEach((x) => console.log(` ✗ ${x}`)); errs.slice(0, 6).forEach((e) => console.log(` ✗ ${e}`));
  if (process.env.VERBOSE) Object.keys(seen).forEach((k) => console.log(`   ${k}: ${seen[k]}`));
  process.exitCode = bad.length || errs.length ? 1 : 0;
})();
