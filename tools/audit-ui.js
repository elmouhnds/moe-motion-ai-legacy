'use strict';
/**
 * Dev: click-every-button audit of the panel (preview + mock AE host, NOT After Effects).
 *   npm run preview   (in another terminal)
 *   node tools/audit-ui.js [view…]      → dev/audit/audit.json + dev/audit/audit.md
 *
 * For every view, every clickable element (buttons, tabs, tiles, chips, role=button, anything
 * with an onclick / ondblclick handler) is clicked from a known starting state, then:
 *   effect   — what changed: view, modal, dialog, toast, panel state, DOM, host calls, history
 *   errors   — page errors, console errors, error toasts, failed tool runs
 *   dead     — nothing observable happened (and the control was not already active)
 * Elements that only appear after a click (Inspector controls, "All tools" forms, dialogs,
 * sheets) are discovered and clicked too, one level down, de-duplicated per tool.
 * Tiles with a double-click handler are double-clicked as well (= apply the preset).
 * A layout pass at 340 / 420 / 600 / 900 px checks overflow, unnamed controls and small targets.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');

const BASE = 'http://localhost:5173/';
const VIEWS = ['home', 'kit', 'animate', 'text', 'layout', 'looks', 'zoom', 'expressions', 'shapes', 'backgrounds', 'compositing', 'deliver', 'quick', 'select', 'brand', 'tools', 'favorites', 'history', 'settings', 'diagnostics'];
const FIXTURE = { layout: 'layout', deliver: 'layout', zoom: 'layout', looks: 'layout', quick: 'layout', text: 'studio', brand: 'studio', select: 'studio' };
const WIDTH = 900;
const WORKERS = 5;
// Controls revealed by one click that are queued for testing (a category chip can reveal ~100 icons).
const MAX_NEW = Number(process.env.AUDIT_MAX_NEW || 1e9);
const OUT = path.resolve(__dirname, '../dev/audit');

// "view@variant" runs a view with data, so empty states are not all that gets tested.
const VARIANTS = {
  seed: { qs: '&seedBrand=1' },
  runs: { setup: async () => { const a = window.__app; const d = (id) => require('/extension/core/schema.js').defaults(a.services.registry.get(id).params || {}); await a.runTool('motion.smartEase', d('motion.smartEase')); await a.runTool('expressions.quick', Object.assign(d('expressions.quick'), { preset: 'wiggle' })); } },
  pins: { setup: async () => { const f = window.__app.services.favorites; ['motion.smartEase', 'quick.animate', 'grid.build'].forEach((id) => f.toggle(id)); window.__app.render(); } }
};
const split = (v) => { const [view, variant] = v.split('@'); return { view, variant: VARIANTS[variant] || {} }; };
const url = (v, w = WIDTH) => { const { view, variant } = split(v); return `${BASE}?view=${view}&w=${w}&demoAI=1${FIXTURE[view] ? `&fixture=${FIXTURE[view]}` : ''}${variant.qs || ''}`; };
async function setupVariant(page, v) { const { variant } = split(v); if (variant.setup) { await page.evaluate(variant.setup); await page.waitForTimeout(300); } }

/* ---------- in-page helpers (stringified into the page) ---------- */
const PAGE_HELPERS = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden]'); };
  const isClickable = (el) => el.__onclick || el.__ondblclick || el.tagName === 'BUTTON' || el.tagName === 'A' || ['button', 'tab', 'menuitem', 'switch'].includes(el.getAttribute('role'));
  const label = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70) || `<${el.tagName.toLowerCase()}.${(el.className && el.className.baseVal === undefined ? el.className : '').split(' ')[0]}>`;
  const cssPath = (el) => {
    const parts = [];
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const p = n.parentElement; if (!p) break;
      parts.unshift(`${n.tagName.toLowerCase()}:nth-child(${[...p.children].indexOf(n) + 1})`);
    }
    return `body > ${parts.join(' > ')}`;
  };
  const region = (el) => {
    const r = el.closest('.overlay, .sheet, .cp-sheet, .palette, .sidebar, .hdr, .header, .ctx, .qb, .quickbar, .st-inspector, .st-grid, .st-chips, .st-tabs, .tool, .content');
    return r ? (r.className.split(' ')[0] || r.tagName.toLowerCase()) : 'page';
  };
  const describe = (el) => ({
    path: cssPath(el), label: label(el), region: region(el),
    tool: (el.closest('[data-tool]') || {}).dataset ? el.closest('[data-tool]').dataset.tool : null,
    cls: typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '',
    active: el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-selected') === 'true',
    disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true',
    dbl: !!el.__ondblclick, ctxmenu: !!el.__oncontextmenu, tag: el.tagName.toLowerCase()
  });
  window.__audit = {
    collect() { return [...document.querySelectorAll('body *')].filter((el) => isClickable(el) && vis(el)).map(describe); },
    find(p) { try { return document.querySelector(p); } catch (e) { return null; } },
    label,
    snap() {
      const a = window.__app; const s = a.state.get();
      const st = {}; for (const k of Object.keys(s)) if (!['ctx', 'toast', 'toastKind'].includes(k)) st[k] = s[k];
      const sv = a.services;
      const svc = JSON.stringify([sv.favorites.list(), sv.presets.list(), sv.brands.list(), sv.settings.get(), sv.executor.history(500).length]);
      const ov = document.querySelector('.overlay');
      let h = 0; const html = document.body.innerHTML; for (let i = 0; i < html.length; i += 7) h = (h * 31 + html.charCodeAt(i)) | 0;
      return { view: s.view, modal: s.modal, toast: s.toast, toastKind: s.toastKind, state: JSON.stringify(st, (k, v) => (typeof v === 'function' ? 'fn' : v)), svc, dom: `${html.length}:${h}`,
        hist: sv.executor.history(500).length, last: sv.executor.history(1)[0] || null, calls: window.__calls.slice(), overlay: ov ? (ov.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90) : null,
        palette: !!a.paletteOpen, copilot: s.copilot && s.copilot.open, running: s.running };
    }
  };
  window.__audit.base = null;
  window.__audit.keep = function () { const s = window.__app.state.get(); const o = {}; for (const k of Object.keys(s)) if (k !== 'ctx') o[k] = s[k]; this.base = JSON.parse(JSON.stringify(o)); this.baseDom = this.snap().dom; };
  window.__audit.reset = function () {
    document.querySelectorAll('.overlay').forEach((o) => o.remove());
    window.__app.paletteOpen = false;
    const s = window.__app.state.get(); const patch = JSON.parse(JSON.stringify(this.base));
    for (const k of Object.keys(s)) if (k !== 'ctx' && !(k in patch)) patch[k] = undefined;
    window.__app.state.set(patch);
    const c = document.querySelector('.content'); if (c) c.scrollTop = 0;
  };
  window.__calls = [];
  const host = window.__app.services.host;
  const orig = host.call.bind(host);
  host.call = (op, args) => { window.__calls.push(op); return orig(op, args); };
};

const READ_OPS = /^(context\.get|host\.ping|keyframes\.read|layers\.read|.*\.(read|inspect|measure|list|get|bounds|probe))/;

const pageState = new WeakMap(); // page → { view, dirty }
async function open(page, view) {
  const ps = pageState.get(page);
  if (ps && ps.view === view && !ps.dirty) {
    await page.evaluate(() => window.__audit.reset());
    await page.waitForTimeout(90);
    const same = await page.evaluate(() => window.__audit.snap().dom === window.__audit.baseDom && window.__audit.snap().svc === window.__audit.baseSvc);
    if (same) return;
  }
  await page.goto(url(view));
  await page.waitForSelector('.ctx .dot.live', { timeout: 10000 });
  await page.waitForTimeout(250); // library tiles fill their Inspector on the next tick
  await setupVariant(page, view);
  await page.evaluate(PAGE_HELPERS);
  await page.evaluate(() => { window.__audit.keep(); window.__audit.baseSvc = window.__audit.snap().svc; });
  pageState.set(page, { view, dirty: false });
}

async function settle(page) {
  await page.waitForTimeout(220);
  for (let i = 0; i < 40; i++) { if (!(await page.evaluate(() => window.__app.state.get().running))) break; await page.waitForTimeout(150); }
  await page.waitForTimeout(120);
}

/** Replay a prefix of clicks (to reveal second-level controls). */
async function replay(page, prefix) {
  for (const p of prefix) {
    const ok = await page.evaluate((pp) => { const el = window.__audit.find(pp.path); return !!el && window.__audit.label(el) === pp.label; }, p);
    if (!ok) return false;
    const pt = await page.evaluate((pp) => { const x = window.__audit.find(pp); x.scrollIntoView({ block: 'center' }); const r = x.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, p.path);
    await page.mouse.click(pt.x, pt.y);
    await settle(page);
  }
  return true;
}

function diff(a, b, el) {
  const fx = [];
  if (a.view !== b.view) fx.push(`→ ${b.view}`);
  if (a.modal !== b.modal && b.modal) fx.push(`sheet:${b.modal}`);
  if (!a.overlay && b.overlay) fx.push(`dialog:"${b.overlay.slice(0, 50)}"`);
  if (!a.palette && b.palette) fx.push('search opened');
  if (!a.copilot && b.copilot) fx.push('copilot opened');
  if (b.toast && b.toast !== a.toast) fx.push(`toast(${b.toastKind || 'info'}):"${String(b.toast).slice(0, 60)}"`);
  if (b.hist > a.hist) fx.push(`ran ${b.last.toolId}=${b.last.status}`);
  const newCalls = b.calls.slice(a.calls.length).filter((c) => !/^context\.get$/.test(c));
  if (newCalls.length) fx.push(`host:${[...new Set(newCalls)].join(',')}`);
  if (a.svc !== b.svc && b.hist === a.hist) fx.push('saved data changed');
  if (!fx.length && a.state !== b.state) fx.push('state');
  if (!fx.length && a.dom !== b.dom) fx.push('dom');
  return fx;
}

async function clickOne(page, view, prefix, el, mode, log) {
  await open(page, view);
  if (!(await replay(page, prefix))) return { skipped: 'prefix-failed' };
  const found = await page.evaluate((e) => { const x = window.__audit.find(e.path); return !!x && window.__audit.label(x) === e.label; }, el);
  if (!found) return { skipped: 'not-found' };
  const errs = [];
  const onErr = (e) => errs.push(`pageerror: ${e.message}`);
  const onCon = (m) => { if (m.type() === 'error') errs.push(`console: ${m.text().slice(0, 160)}`); };
  page.on('pageerror', onErr); page.on('console', onCon);
  const before = await page.evaluate(() => window.__audit.snap());
  let clickErr = null;
  const t0 = Date.now();
  try {
    // A real mouse click at the element's centre, like a person. If something else is on top
    // (overlap, clipped by a scroller), that is reported instead of clicking through it.
    const pt = await page.evaluate((pp) => {
      const x = window.__audit.find(pp); if (!x) return { err: 'gone' };
      x.scrollIntoView({ block: 'center', inline: 'center' });
      const r = x.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      if (!top || !(top === x || x.contains(top) || top.contains(x))) return { err: `covered by ${top ? `${top.tagName.toLowerCase()}.${String(top.className).split(' ')[0]}` : 'nothing (off-screen)'}` };
      return { x: cx, y: cy };
    }, el.path);
    if (pt.err) clickErr = pt.err;
    else if (mode === 'dbl') await page.mouse.dblclick(pt.x, pt.y);
    else if (mode === 'ctx') await page.mouse.click(pt.x, pt.y, { button: 'right' });
    else await page.mouse.click(pt.x, pt.y);
  } catch (e) { clickErr = e.message.split('\n')[0].slice(0, 160); }
  await settle(page);
  const after = await page.evaluate(() => window.__audit.snap());
  const ms = Date.now() - t0;
  // Discover controls that appeared because of this click.
  const appeared = await page.evaluate(() => window.__audit.collect());
  page.off('pageerror', onErr); page.off('console', onCon);
  const effect = diff(before, after, el);
  const mutated = after.calls.slice(before.calls.length).some((c) => !READ_OPS.test(c));
  if (mutated || after.svc !== before.svc || errs.length || prefix.length || mode !== 'click') pageState.get(page).dirty = true;
  const ranBad = after.hist > before.hist && !['success', 'partial'].includes(after.last.status) ? `${after.last.toolId}: ${after.last.status} ${(after.last.errors || after.last.reasons || []).join(' · ').slice(0, 140)}` : null;
  const errToast = after.toast && after.toast !== before.toast && after.toastKind === 'err' ? String(after.toast).slice(0, 160) : null;
  const res = { effect, errors: errs, clickErr, ranBad, errToast, ms, appeared: after.view === before.view ? appeared : null };
  if (log) process.stdout.write(effect.length || errs.length || clickErr ? '.' : 'o');
  return res;
}

async function auditView(browser, view) {
  const page = await browser.newPage({ viewport: { width: WIDTH + 40, height: 900 } });
  page.setDefaultTimeout(8000);
  const rows = [];
  await open(page, view);
  const initial = await page.evaluate(() => window.__audit.collect());
  const seen = new Set(initial.map((e) => `${e.path}|${e.label}`));
  const sigOf = (n) => `${n.region}|${n.tool}|${n.cls}|${n.label}`;
  const sig = new Set(initial.map(sigOf)); // a control that only moved (e.g. after "Hide banner") is not new
  const queue = initial.filter((e) => !e.disabled).map((e) => ({ el: e, prefix: [], depth: 0 }));
  // Global chrome (sidebar / header / ctx strip) is the same everywhere: test it only on Home.
  const chromeRegion = (e) => ['sidebar', 'hdr', 'header', 'ctx', 'sb', 'page'].includes(e.region) || /^(nav-btn|sb-|hdr|icon-btn hdr|ctx)/.test(e.cls);
  for (let qi = 0; qi < queue.length; qi++) {
    const { el, prefix, depth } = queue[qi];
    if (split(view).view !== 'home' && depth === 0 && chromeRegion(el)) continue;
    const modes = ['click'].concat(el.dbl ? ['dbl'] : []);
    for (const mode of modes) {
      const r = await clickOne(page, view, prefix, el, mode, true);
      if (rows.length % 50 === 0) fs.writeFileSync(path.join(OUT, `view-${view}.partial.json`), JSON.stringify({ rows, layout: [] }));
      rows.push(Object.assign({ view, mode, depth, via: prefix.map((p) => p.label).join(' › '), label: el.label, region: el.region, tool: el.tool, cls: el.cls, active: el.active }, r, { appeared: undefined }));
      if (mode !== 'click' || depth >= 1 || !r.appeared) continue;
      // Queue new controls, one level down; same control in the same tool form only once.
      let added = 0;
      for (const n of r.appeared) {
        if (added >= MAX_NEW) break;
        const key = `${n.path}|${n.label}`;
        if (seen.has(key) || n.disabled) continue;
        const s = sigOf(n);
        if (sig.has(s)) continue;
        sig.add(s); seen.add(key);
        if (/^(Cancel|Close)$/i.test(n.label) && n.region === 'overlay') continue;
        queue.push({ el: n, prefix: prefix.concat([{ path: el.path, label: el.label }]), depth: depth + 1 });
        added++;
      }
    }
  }
  await page.close();
  return rows;
}

/* ---------- layout pass ---------- */
async function layoutPass(browser, view) {
  const out = [];
  for (const w of [340, 420, 600, 900]) {
    const page = await browser.newPage({ viewport: { width: w + 40, height: 800 } });
    await page.goto(url(view, w));
    await page.waitForSelector('.ctx .dot.live', { timeout: 10000 });
    await setupVariant(page, view);
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const vis = (el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
      const frame = document.querySelector('.app') || document.body;
      const content = document.querySelector('.content');
      const ctl = [...document.querySelectorAll('button, [role=button], [role=tab], a, input, select, textarea')].filter(vis);
      const name = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.getAttribute('placeholder') || (el.labels && el.labels[0] && el.labels[0].textContent) || '').trim();
      const unnamed = ctl.filter((el) => !name(el)).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
      const small = ctl.filter((el) => { const b = el.getBoundingClientRect(); return (b.width < 24 || b.height < 22) && !/^(INPUT)$/.test(el.tagName); }).map((el) => `${name(el).slice(0, 24) || el.className} ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`);
      const clipped = [...document.querySelectorAll('.content *, .sidebar *, .hdr *')].filter((el) => vis(el) && el.children.length === 0 && el.textContent.trim().length > 2 && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible' && !el.title && !el.closest('[title]')).map((el) => el.textContent.trim().slice(0, 30));
      return {
        hOverflow: content ? content.scrollWidth - content.clientWidth : 0,
        pageOverflow: frame.scrollWidth - frame.clientWidth,
        controls: ctl.length,
        aboveFold: ctl.filter((el) => el.getBoundingClientRect().top < window.innerHeight).length,
        contentHeight: content ? content.scrollHeight : 0,
        unnamed: [...new Set(unnamed)], unnamedCount: unnamed.length, small: [...new Set(small)].slice(0, 12), smallCount: small.length, clipped: [...new Set(clipped)].slice(0, 12), clippedCount: clipped.length
      };
    });
    out.push(Object.assign({ view, w }, r));
    await page.close();
  }
  return out;
}

/* ---------- keyboard shortcuts ---------- */
async function keys(browser) {
  const page = await browser.newPage({ viewport: { width: 940, height: 800 } });
  const res = [];
  const go = async () => { await page.goto(url('home')); await page.waitForSelector('.ctx .dot.live'); await page.waitForTimeout(200); };
  const st = () => page.evaluate(() => { const s = window.__app.state.get(); return { view: s.view, modal: s.modal, pal: !!window.__app.paletteOpen, cp: s.copilot.open }; });
  for (const [k, expect] of [['Control+k', (s) => s.pal], ['/', (s) => s.pal], ['Control+Space', (s) => s.cp], ['?', (s) => s.modal === 'shortcuts']].concat([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [`Control+Digit${n}`, (s) => s.view !== 'home' || n === 1]))) {
    await go();
    await page.keyboard.press(k);
    await page.waitForTimeout(250);
    const s = await st();
    res.push({ key: k, ok: !!expect(s), state: s });
  }
  await go();
  await page.keyboard.press('?'); await page.waitForTimeout(150); await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  res.push({ key: 'Escape closes sheet', ok: !(await st()).modal });
  await page.close();
  return res;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const only = process.argv.slice(2);
  const views = only.length ? only : VIEWS.concat(['brand@seed', 'history@runs', 'favorites@pins']);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const t0 = Date.now();
  const rows = [];
  const layout = [];
  let next = 0;
  await Promise.all(Array.from({ length: WORKERS }, async () => {
    while (next < views.length) {
      const v = views[next++];
      const r = await auditView(browser, v).catch((e) => [{ view: v, fatal: e.message }]);
      rows.push(...r);
      const lp = await layoutPass(browser, v).catch((e) => [{ view: v, fatal: e.message }]);
      layout.push(...lp);
      fs.writeFileSync(path.join(OUT, `view-${v}.json`), JSON.stringify({ rows: r, layout: lp }, null, 1));
      process.stdout.write(`\n${v}: ${r.length} clicks\n`);
    }
  }));
  const kb = await keys(browser);
  await browser.close();
  const report = { when: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), rows, layout, keys: kb };
  fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify(report, null, 1));
  const tested = rows.filter((r) => !r.skipped && !r.fatal);
  const dead = tested.filter((r) => !r.effect.length && !r.active && !r.clickErr && !r.errors.length);
  const broken = tested.filter((r) => r.errors.length || r.clickErr);
  console.log(`\n${tested.length} interactions in ${report.seconds}s · dead ${dead.length} · errors ${broken.length} · tool failures ${tested.filter((r) => r.ranBad).length} · skipped ${rows.length - tested.length}`);
})();
