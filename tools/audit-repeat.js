'use strict';
/**
 * No Repeats audit (v0.45, docs/features/NO_REPEATS.md) — one button per job on a screen.
 *
 * For Bento, Glass (every space) and MOE (every tab) × every kind of selection (keys, one layer, several, text,
 * one shape, several shapes, nothing), at 420 px, it lists the buttons on screen by the job they do (a Quick action,
 * a library tile, a Motion Control button: Easy, the Out Expo chip, an anchor dot, an align button …) and reports:
 *   - near: the same job twice on one screen — in one block (the NOW card with its Motion Control, one group), or
 *           anywhere in a Glass space or a MOE tab (each is one short screen) — always a copy, it fails;
 *   - page: Bento only (one long scroll): a NOW tile and the same job in its full group further down — reported,
 *           not failed: NOW is the short list for the selection, the group is the whole set in its place.
 * Your own buttons are left out — the Quick Bar (strip and sidebar), your pins, "Next" (it comes and goes) and the
 * Assistant button: you chose them, or they are not on screen for long.
 * Usage: node tools/audit-repeat.js   (dev server on :5173). Writes dev/audit/repeat.json.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const A = require('../extension/app/ui/actions');
const AE = require('../extension/app/ui/layoutAE');
const W = require('../extension/app/ui/workflow');

const URL = process.env.MOE_URL || 'http://localhost:5173/';
const WIDTH = Number(process.argv[2]) || 420;
// the Motion Control's own buttons → the Quick action that does the same job
const CONTROL = {};
for (const [ref, [, key]] of Object.entries(A.IN_CONTROL)) CONTROL[key] = ref.replace(/^quick:/, '');
// which layers to select (studio fixture) for each kind; keys = the default fixture
const PICK = { none: [], layer: ['Logo'], layers: ['Logo', 'Badge'], text: ['Headline EN', 'Headline AR'], shapes: ['Badge'], shapesMany: ['Dot 1', 'Dot 2'] };
const KINDS = ['keys', 'layer', 'layers', 'text', 'shapes', 'shapesMany', 'none'];

/* runs in the page: one screen → { jobs: [{ job, block }] } */
function measure({ control }) {
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && el.offsetParent !== null; };
  const OWN = '.qbar, .moe-rail [data-key^="rq-"], .b-next, .ae-next, .gl-next, .assistant, [aria-label="Your tools"], .overlay';
  const els = Array.from(document.querySelectorAll('[data-key^="a-"], [data-key^="kt-"], [data-key^="ci-"], [data-key^="chip-"], [data-key^="ap-"], [data-key^="al-"], [data-key^="t-"]'))
    .filter(vis).filter((el) => !el.closest(OWN) && el.getAttribute('role') !== 'tab');
  const jobOf = (k) => {
    if (control[k]) return control[k];
    // a library tile: 'a-tile:animate/fadeIn' (NOW, rows) and 't-animate/fadeIn' (its group's strip) are one job
    if (/^a-tile:/.test(k)) return `tile:${k.split('/').pop()}`;
    if (/^t-[^/]+\//.test(k)) return `tile:${k.split('/').pop()}`;
    if (/^(a|kt)-/.test(k)) return k.replace(/^(a|kt)-/, '').replace(/^quick:/, '');
    return null; // other curve chips, other anchor dots: no Quick action does that job
  };
  const blockOf = (el) => {
    // the NOW card is one block with its Motion Control inside
    const b = el.closest('.b-now, .gl-now') || el.closest('[data-g], .ae-group, .ae-control, .lay-drop, .moe-rail, .kit-block, section');
    return b ? (b.getAttribute('data-g') || b.getAttribute('data-key') || b.getAttribute('aria-label') || b.className) : 'page';
  };
  return els.map((el) => ({ job: jobOf(el.getAttribute('data-key')), block: blockOf(el), key: el.getAttribute('data-key') })).filter((x) => x.job);
}

async function select(p, kind) {
  await p.evaluate(({ kind, pick }) => {
    const comp = window.app.project.activeItem;
    if (kind === 'keys') return;
    const clear = (n) => { if (n && n._selected !== undefined) n._selected = false; ((n && n._children) || []).forEach(clear); };
    comp._layers.forEach((L) => { L.selected = false; clear(L._group); });
    comp._selectionOrder = null;
    (pick[kind] || []).forEach((name) => { const L = comp._layers.find((x) => x.name === name); if (L) L.selected = true; });
  }, { kind, pick: PICK });
  await p.evaluate(() => window.__app.refreshContext(true));
  await p.waitForTimeout(450);
}

async function main() {
  const b = await chromium.launch();
  const found = [], screens = [], errs = [];
  for (const kind of KINDS) {
    const p = await b.newPage({ viewport: { width: WIDTH + 40, height: 1000 } });
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`${URL}?view=home&w=${WIDTH}&demoAI=1${kind === 'keys' ? '' : '&fixture=studio'}`);
    await p.waitForFunction(() => !!window.__app, null, { timeout: 15000 });
    await p.waitForTimeout(700);
    await select(p, kind);
    const actual = await p.evaluate(() => { const c = window.__app.state.get().ctx; return c; });
    const real = A.profile(actual);
    if (real !== kind) { found.push({ rule: 'setup', screen: kind, detail: `the selection reads as ${real}` }); await p.close(); continue; }
    const run = async (screen) => {
      screens.push(screen);
      const jobs = await p.evaluate(measure, { control: CONTROL });
      const by = new Map();
      jobs.forEach((j) => { if (!by.has(j.job)) by.set(j.job, []); by.get(j.job).push(j); });
      for (const [job, list] of by) {
        if (list.length < 2) continue;
        const blocks = new Map();
        list.forEach((x) => blocks.set(x.block, (blocks.get(x.block) || 0) + 1));
        // Glass spaces and MOE tabs are one short screen: any copy there is near. Bento is one long scroll:
        // NOW at the top and the same job in its full group further down is the page rule.
        const near = /^bento/.test(screen) ? [...blocks].filter(([, n]) => n > 1) : (blocks.size > 1 || list.length > 1 ? [[[...blocks.keys()].join(' + '), list.length]] : []);
        if (near.length) near.forEach(([blk, n]) => found.push({ rule: 'near', screen, job, detail: `${n}× in ${blk}: ${list.map((x) => x.key).join(', ')}` }));
        else found.push({ rule: 'page', screen, job, detail: list.map((x) => `${x.key} @ ${x.block}`).join(' · ') });
      }
    };
    // Bento: one scroll, every stage open
    await p.evaluate((ids) => { const a = window.__app; const more = {}; ids.forEach((i) => { more[i] = true; }); a.services.store.set('bento-more', more); a.services.store.set('bento-fold', {}); a.services.settings.update({ ui: { layout: 'bento' } }); a.state.set({ view: 'home' }); a.render(); }, W.STAGES.map((s) => s.id));
    await p.waitForTimeout(500);
    await run(`bento · ${kind}`);
    // Glass: every space
    await p.evaluate(() => { const a = window.__app; a.services.settings.update({ ui: { layout: 'glass' } }); a.render(); });
    for (const st of W.STAGES) {
      await p.evaluate((id) => { const a = window.__app; a.state.set({ view: 'home', glSpace: id }); a.render(); }, `gl-${st.id.slice(3)}`);
      await p.waitForTimeout(300);
      await run(`glass ${st.label} · ${kind}`);
    }
    // MOE: every tab (the sidebar is on screen with each)
    await p.evaluate(() => { const a = window.__app; a.services.settings.update({ ui: { layout: 'moe' } }); a.render(); });
    for (const t of AE.TABS) {
      await p.evaluate((id) => { const a = window.__app; a.state.set({ view: 'home', aeTab: id }); a.render(); }, t.id);
      await p.waitForTimeout(300);
      await run(`moe ${t.label} · ${kind}`);
    }
    await p.close();
  }
  await b.close();
  errs.forEach((e) => found.push({ rule: 'jsError', screen: '', detail: e }));
  const counts = found.reduce((m, f) => { m[f.rule] = (m[f.rule] || 0) + 1; return m; }, {});
  fs.mkdirSync(path.join(__dirname, '../dev/audit'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '../dev/audit/repeat.json'), JSON.stringify({ when: new Date().toISOString(), width: WIDTH, screens: screens.length, counts, findings: found }, null, 1));
  console.log(`${screens.length} screens at ${WIDTH} px · near ${counts.near || 0} · page ${counts.page || 0} (info) · setup ${counts.setup || 0} · JS errors ${counts.jsError || 0}`);
  found.filter((f) => f.rule !== 'page').slice(0, 60).forEach((f) => console.log(` ✗ ${f.rule} · ${f.screen} · ${f.job || ''} · ${f.detail}`));
  if (process.env.VERBOSE) found.filter((f) => f.rule === 'page').forEach((f) => console.log(` · page · ${f.screen} · ${f.job} · ${f.detail}`));
  process.exitCode = found.some((f) => f.rule !== 'page') ? 1 : 0;
}
main().catch((e) => { console.error(e); process.exitCode = 2; });
