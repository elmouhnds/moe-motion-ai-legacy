'use strict';
/**
 * Smart Arrange audit (v0.43, docs/features/SMART_ARRANGE.md) — measures the panel on screen:
 *   for Bento, Glass and MOE (every tab / space, every group opened, every MOE menu) and the Motion Kit,
 *   at 340, 420, 600 and 900 px:
 *   - family: the members of a family (app/ui/arrange.js FAMILIES) shown in one group sit next to each other,
 *     on one row (same top, nothing between them);
 *   - group:  a Bento tile sits under its own group's caption, above the next one (nothing drifts across);
 *   - hole:   every Bento row of a group is filled edge to edge;
 *   - cut:    a label shorter than its text (ellipsis / clamp) — reported, not failed.
 * Usage: node tools/audit-arrange.js [width …]   (dev server on :5173). Writes dev/audit/arrange.json.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const AR = require('../extension/app/ui/arrange');
const AE = require('../extension/app/ui/layoutAE');
const W = require('../extension/app/ui/workflow');
const L = require('../extension/app/ui/layouts');

const URL = process.env.MOE_URL || 'http://localhost:5173/';
const WIDTHS = process.argv.slice(2).map(Number).filter(Boolean);
const widths = WIDTHS.length ? WIDTHS : [340, 420, 600, 900];
const keysOf = (ref) => { const n = AR.norm(ref); return [`a-${n}`, `kt-${n}`]; };
const FAMS = AR.FAMILIES.map(([name, refs]) => ({ name, members: refs.map(keysOf) }));
const KINDS = ['none', 'layer', 'layers', 'keys', 'text', 'shapes', 'shapesMany'];
const GROUP_IDS = AE.TABS.flatMap((t) => t.groups.map((g) => g.id));

/* runs in the page: one screen → findings */
function measure({ fams, screen }) {
  const out = [];
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && el.offsetParent !== null; };
  const contOf = (el) => el.closest('[data-g]') || el.closest('.ae-group') || el.closest('.lay-drop') || el.closest('.kit-tools, .kit-grp, .ae-kit') || el.closest('section') || document.body;
  const all = Array.from(document.querySelectorAll('[data-key^="a-"], [data-key^="kt-"]')).filter(vis);
  const conts = new Map();
  all.forEach((el) => { const c = contOf(el); const k = c.getAttribute('data-g') ? `g:${c.getAttribute('data-g')}` : c; if (!conts.has(k)) conts.set(k, []); conts.get(k).push(el); });
  const nameOf = (c) => (typeof c === 'string' ? c : (c.getAttribute('data-key') || c.getAttribute('aria-label') || c.className || 'body'));
  for (const [c, els] of conts) {
    const keys = els.map((e) => e.getAttribute('data-key'));
    for (const f of fams) {
      const at = [];
      f.members.forEach((alts) => { const i = keys.findIndex((k) => alts.includes(k)); if (i >= 0) at.push(i); });
      if (at.length < 2) continue;
      at.sort((a, b) => a - b);
      if (at[at.length - 1] - at[0] !== at.length - 1) { out.push({ rule: 'family', screen, where: nameOf(c), family: f.name, detail: `not next to each other: ${at.map((i) => keys[i]).join(', ')}` }); continue; }
      // a family inside its own box (labelled row, pair, .fam) is together even when the box has two lines
      const box = (el) => el.closest('.ae-sub-b, .fam, .b-pair-b, .ae-pair');
      const b0 = box(els[at[0]]);
      if (b0 && at.every((i) => box(els[i]) === b0)) continue;
      for (let j = 1; j < at.length; j++) {
        const a = els[at[j - 1]].getBoundingClientRect(), b = els[at[j]].getBoundingClientRect();
        if (Math.abs(a.top - b.top) > 3) out.push({ rule: 'family', screen, where: nameOf(c), family: f.name, detail: `${keys[at[j - 1]]} and ${keys[at[j]]} on different rows` });
      }
    }
  }
  // Bento: tiles stay under their caption, and every row is full
  const grids = Array.from(document.querySelectorAll('.b-grid')).filter(vis);
  for (const grid of grids) {
    const gr = grid.getBoundingClientRect();
    const caps = Array.from(grid.querySelectorAll(':scope > .b-cap')).filter(vis).map((c) => ({ id: (c.getAttribute('data-key') || '').replace(/^cap-/, ''), top: c.getBoundingClientRect().top }));
    const tiles = Array.from(grid.querySelectorAll(':scope > [data-g]')).filter(vis);
    const byG = new Map();
    tiles.forEach((t) => { const g = t.getAttribute('data-g'); if (!byG.has(g)) byG.set(g, []); byG.get(g).push(t); });
    for (const [g, ts] of byG) {
      const ci = caps.findIndex((c) => c.id === g);
      if (ci >= 0) {
        const lo = caps[ci].top, hi = ci + 1 < caps.length ? caps[ci + 1].top : Infinity;
        ts.forEach((t) => { const r = t.getBoundingClientRect(); if (r.top < lo || r.top > hi) out.push({ rule: 'group', screen, where: g, detail: `${t.getAttribute('data-key')} sits outside its group` }); });
      }
      const rows = new Map();
      ts.forEach((t) => { const r = t.getBoundingClientRect(); const k = Math.round(r.top); if (!rows.has(k)) rows.set(k, { l: r.left, r: r.right }); const x = rows.get(k); x.l = Math.min(x.l, r.left); x.r = Math.max(x.r, r.right); });
      for (const [top, x] of rows) if (x.l - gr.left > 2 || gr.right - x.r > 2) out.push({ rule: 'hole', screen, where: g, detail: `row at ${top}px spans ${Math.round(x.l - gr.left)}…${Math.round(x.r - gr.left)} of ${Math.round(gr.width)}` });
    }
  }
  // labels cut short (info)
  Array.from(document.querySelectorAll('.bt-l, .b-half-t, .ae-act span, .lay-act span, .kit-tool span')).filter(vis).forEach((el) => {
    if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2) out.push({ rule: 'cut', screen, where: (el.closest('[data-key]') || {}).getAttribute ? el.closest('[data-key]').getAttribute('data-key') : '', detail: el.textContent.trim().slice(0, 60) });
  });
  return out;
}

async function main() {
  const b = await chromium.launch();
  const found = [];
  const screens = [];
  const run = async (p, screen) => { screens.push(screen); found.push(...await p.evaluate(measure, { fams: FAMS, screen })); };
  for (const w of widths) {
    const p = await b.newPage({ viewport: { width: w + 40, height: 1000 } });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`${URL}?view=home&w=${w}&demoAI=1`);
    await p.waitForFunction(() => !!window.__app, null, { timeout: 15000 });
    await p.waitForTimeout(800);
    // open every group for every kind of selection, every Bento section and "More"
    await p.evaluate(({ kinds, gids }) => {
      const a = window.__app, st = a.services.store;
      const open = {}; kinds.forEach((k) => { open[k] = {}; gids.forEach((g) => { open[k][g] = true; }); });
      st.set('ae-open', open); st.set('bento-fold', Object.fromEntries(require('/extension/app/ui/workflow.js').STAGES.map((x) => [x.id, false]))); st.set('bento-more', { 'st-core': true, 'st-anim': true, 'st-arr': true, 'st-design': true, 'st-finish': true, 'st-deliver': true });
    }, { kinds: KINDS, gids: GROUP_IDS });
    // Bento: one scroll
    await p.evaluate((ids) => { const a = window.__app; const more = {}; ids.forEach((i) => { more[i] = true; }); a.services.store.set('bento-more', more); a.services.settings.update({ ui: { layout: 'bento' } }); a.state.set({ view: 'home' }); a.render(); }, W.STAGES.map((s) => s.id));
    await p.waitForTimeout(700);
    await run(p, `bento@${w}`);
    // Glass: every space
    await p.evaluate(() => { const a = window.__app; a.services.settings.update({ ui: { layout: 'glass' } }); a.render(); });
    for (const st of W.STAGES) {
      await p.evaluate((id) => { const a = window.__app; a.state.set({ view: 'home', glSpace: id }); a.render(); }, `gl-${st.id.slice(3)}`);
      await p.waitForTimeout(350);
      await run(p, `glass ${st.label}@${w}`);
    }
    // MOE: every tab, then every menu
    await p.evaluate(() => { const a = window.__app; a.services.settings.update({ ui: { layout: 'moe' } }); a.render(); });
    for (const t of AE.TABS) {
      await p.evaluate((id) => { const a = window.__app; a.state.set({ view: 'home', aeTab: id }); a.render(); }, t.id);
      await p.waitForTimeout(350);
      await run(p, `moe ${t.label}@${w}`);
    }
    for (const m of L.MENUS) {
      if (!m.refs.length) continue;
      await p.evaluate(({ id, w }) => { const a = window.__app; a.state.set({ layMenu: { id, top: 40, left: 50, right: null, maxW: Math.max(220, w - 60) } }); a.render(); }, { id: m.id, w });
      await p.waitForTimeout(250);
      await run(p, `moe menu ${m.id}@${w}`);
    }
    await p.evaluate(() => { const a = window.__app; a.state.set({ layMenu: null }); a.render(); });
    // the Motion Kit
    await p.evaluate(() => { const a = window.__app; a.go('kit'); });
    await p.waitForTimeout(500);
    await run(p, `kit@${w}`);
    errs.forEach((e) => found.push({ rule: 'jsError', screen: `@${w}`, detail: e }));
    // Control (v0.70): its home for this selection (the squares, the Motion Control, the sidebar)
    await p.evaluate(() => { const a = window.__app; a.services.settings.update({ ui: { layout: 'control' } }); a.state.set({ view: 'home' }); a.render(); });
    await p.waitForTimeout(400);
    await run(p, `control@${w}`);
    await p.close();
  }
  await b.close();
  const fail = found.filter((f) => f.rule !== 'cut');
  const report = { when: new Date().toISOString(), widths, screens: screens.length, counts: found.reduce((m, f) => { m[f.rule] = (m[f.rule] || 0) + 1; return m; }, {}), findings: found };
  fs.mkdirSync(path.join(__dirname, '../dev/audit'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '../dev/audit/arrange.json'), JSON.stringify(report, null, 1));
  console.log(`${screens.length} screens at ${widths.join(' / ')} px · family ${report.counts.family || 0} · group ${report.counts.group || 0} · hole ${report.counts.hole || 0} · cut labels ${report.counts.cut || 0} · JS errors ${report.counts.jsError || 0}`);
  fail.slice(0, 40).forEach((f) => console.log(` ✗ ${f.rule} · ${f.screen} · ${f.where || ''} · ${f.family || ''} ${f.detail}`));
  process.exitCode = fail.length ? 1 : 0;
}
main().catch((e) => { console.error(e); process.exitCode = 2; });
