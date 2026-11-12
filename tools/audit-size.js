'use strict';
/**
 * Size audit (v0.82, docs/features/LAYOUT_PLAN.md): every page × the four styles × two widths.
 *   text:    a visible text smaller than 10 px                              → fails
 *   target:  a visible control that does not answer a click 12 px from its centre in each direction — probed
 *            with document.elementFromPoint, so a widened hit area counts only if it really works      → fails
 *            (the design system's smallest control is 24 px — CLAUDE.md, DESIGN_SYSTEM.md)
 * Not counted: a control inside a text line (links in prose), native range thumbs, and what is listed in ALLOW with its reason.
 * Needs the dev server (node tools/dev-server.js).   node tools/audit-size.js   → exit 1 on any finding
 */
const { chromium } = require('playwright');
const VIEWS = ['home', 'scene', 'kits', 'kit', 'animate', 'text', 'layout', 'looks', 'zoom', 'expressions', 'shapes', 'backgrounds', 'compositing', 'deliver', 'quick', 'select', 'brand', 'tools', 'favorites', 'history', 'settings', 'diagnostics', 'templates', 'productui'];
const STYLES = process.argv.slice(2).length ? process.argv.slice(2) : ['bento', 'glass', 'moe', 'control'];
const WIDTHS = [420, 740];
/** class prefix → why it may be smaller than 24 px */
/** Findings that are a style's own look, waiting for the owner (reported, not failed): style → class prefixes */
const WAITING = { glass: ['gl-kbd', 'plan-row>select', 'kit-vel', 'chip-btn', 'bgc-sw', 'tag', 'kit-chip', 'kit-dot', 'seg>button', 'toggle', 'qt-pin', 'adv-toggle'] };
const ALLOW = {
  'qb-sep': 'a separator, not a control',
  'kit-grip': 'the graph\'s resize edge: full width, 6 px tall by design (a grip, like After Effects\' own)'
};
(async () => {
  const b = await chromium.launch();
  const text = {}, target = {}, errs = [], waiting = {};
  for (const style of STYLES) for (const w of WIDTHS) {
    const p = await b.newPage({ viewport: { width: w + 20, height: 900 } });
    p.on('pageerror', (e) => errs.push(`${style}@${w}: ${e.message}`));
    await p.goto(`http://localhost:5173/?w=${w}`); await p.waitForFunction(() => !!window.__app); await p.waitForTimeout(500);
    await p.evaluate((s) => { const a = window.__app; a.services.settings.update({ ui: { layout: s } }); a.services.store.set('bento-fold', Object.fromEntries(require('/extension/app/ui/workflow.js').STAGES.map((x) => [x.id, false]))); a.render(); }, style);
    for (const v of VIEWS) {
      await p.evaluate((v) => window.__app.go(v), v); await p.waitForTimeout(400);
      const found = await p.evaluate((allow) => {
        const vis = (e) => { if (e.offsetParent === null) return false; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        const cls = (e) => String(e.getAttribute('class') || '').split(' ')[0];
        const name = (e) => cls(e) || `${cls(e.parentElement) || cls(e.parentElement.parentElement) || '?'}>${e.tagName.toLowerCase()}`;
        const small = [], tiny = [];
        document.querySelectorAll('.app *').forEach((e) => {
          if (!vis(e)) return;
          if ([...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) { const f = parseFloat(getComputedStyle(e).fontSize); if (f < 10) small.push(`${name(e)} ${f}px “${e.textContent.trim().slice(0, 18)}”`); }
        });
        document.querySelectorAll('.app button, .app [role="button"], .app select, .app input:not([type="range"]):not([type="checkbox"]):not([type="radio"])').forEach((e) => {
          if (!vis(e) || e.disabled) return;
          const n = name(e); if (Object.keys(allow).some((k) => n.indexOf(k) === 0)) return;
          const r0 = e.getBoundingClientRect();
          // what really answers a click: probe the points a 24 px box around the control's centre would reach
          // (document.elementFromPoint — an invisible ::before counts only if it is not clipped). A control near
          // the edge of the screen or under a sticky bar cannot be probed there and is checked on another screen.
          if (r0.top < 40 || r0.bottom > innerHeight - 40 || r0.left < 14 || r0.right > innerWidth - 14) return;
          const cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
          const mine = (x, y) => { const t = document.elementFromPoint(x, y); return !!t && (t === e || e.contains(t)); };
          if (!mine(cx, cy)) return; // covered by something else here (a sticky bar): not this screen's to judge
          const r = { width: r0.width >= 23.5 || (mine(cx - 11.5, cy) && mine(cx + 11.5, cy)) ? 24 : r0.width, height: r0.height >= 23.5 || (mine(cx, cy - 11.5) && mine(cx, cy + 11.5)) ? 24 : r0.height };
          // a control wider than its row can still be reached; what matters is the smaller side it offers the pointer
          if (r.width < 23.5 || r.height < 23.5) tiny.push(`${n}|${Math.round(r.width)}|${Math.round(r.height)}`);
        });
        return { small, tiny };
      }, ALLOW);
      const waits = (n) => (WAITING[style] || []).some((k) => n.indexOf(k) === 0);
      found.small = found.small.filter((x) => { if (waits(x)) { waiting[`${style}: ${x.split(' “')[0]}`] = 1; return false; } return true; });
      found.tiny = found.tiny.filter((x) => { if (waits(x)) { waiting[`${style}: ${x.split('|')[0]} ${x.split('|').slice(1).join('×')}`] = 1; return false; } return true; });
      found.small.forEach((x) => { (text[x] = text[x] || []).push(`${style}@${w}/${v}`); });
      found.tiny.forEach((x) => { const [n, tw, th] = x.split('|'); const t = (target[n] = target[n] || { w: 999, h: 999, at: [] }); t.w = Math.min(t.w, +tw); t.h = Math.min(t.h, +th); t.at.push(`${style}@${w}/${v}`); });
    }
    await p.close();
  }
  await b.close();
  console.log(`${STYLES.length * WIDTHS.length * VIEWS.length} screens · text under 10 px ${Object.keys(text).length} · kinds of target under 24 px ${Object.keys(target).length} · JS errors ${errs.length}`);
  Object.keys(text).sort((a, c) => text[c].length - text[a].length).slice(0, 30).forEach((k) => console.log(` ✗ text ${k}  ←  ${text[k].length}×: ${[...new Set(text[k])].slice(0, 2).join(', ')}`));
  Object.keys(target).sort((a, c) => target[c].at.length - target[a].at.length).slice(0, 60).forEach((k) => console.log(` ✗ target ${k} (smallest ${target[k].w}×${target[k].h})  ←  ${target[k].at.length}×: ${[...new Set(target[k].at)].slice(0, 3).join(', ')}`));
  errs.slice(0, 8).forEach((e) => console.log(` ✗ ${e}`));
  if (Object.keys(waiting).length) console.log(` … waiting for the owner (not failed): ${Object.keys(waiting).join(' · ')}`);
  process.exitCode = Object.keys(text).length || Object.keys(target).length || errs.length ? 1 : 0;
})();
