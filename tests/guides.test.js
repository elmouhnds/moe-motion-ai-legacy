'use strict';
/**
 * v0.53 — Guide presets (docs/features/GUIDE_PRESETS.md) and the Guides sidebar menu; plus a guard that every icon the
 * UI names exists (the Parent & Link menu showed an empty icon: `link` was missing).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTestServices } = require('./helpers/harness');
const { studioComp } = require('./fixtures/studio');
const GP = require('../extension/features/grid/guidePresets');

const lines = (comp, o) => comp.guides.filter((g) => g.orientationType === o).map((g) => Math.round(g.position * 100) / 100).sort((a, b) => a - b);
async function run(args, comp) {
  const { services, comp: C } = await createTestServices(studioComp([], { comp: comp || {} }));
  const r = await services.executor.run('grid.guidePreset', args);
  return { services, comp: C, r };
}

test('composition presets put the guides where the maths says (read back from the comp)', async () => {
  let { comp, r } = await run({ preset: 'center' });
  assert.equal(r.status, 'success');
  assert.deepEqual(lines(comp, 1), [960]); assert.deepEqual(lines(comp, 0), [540]);
  ({ comp, r } = await run({ preset: 'golden' }));
  assert.deepEqual(lines(comp, 1), [733.44, 1186.56]); assert.deepEqual(lines(comp, 0), [412.56, 667.44]);
  ({ comp, r } = await run({ preset: 'tvSafe' }));
  assert.deepEqual(lines(comp, 1), [67.2, 96, 1824, 1852.8]); // action 93 %, title 90 %
  assert.deepEqual(lines(comp, 0), [37.8, 54, 1026, 1042.2]);
});

test('social safe zones: margins at 1080 × 1920, scaled to other sizes with a note; approximate, said so', async () => {
  const { comp, r } = await run({ preset: 'tiktok' }, { width: 1080, height: 1920 });
  assert.equal(r.status, 'success');
  assert.deepEqual(lines(comp, 1), [60, 940]); assert.deepEqual(lines(comp, 0), [220, 1440]);
  const reels = GP.lines('reels', 1080, 1920);
  assert.deepEqual(reels.box, { x: 65, y: 270, w: 895, h: 980 });
  assert.equal(reels.note, '');
  const half = GP.lines('shorts', 540, 960);
  assert.deepEqual(half.h, [60, 810]); assert.deepEqual(half.v, [30, 492]);
  assert.match(GP.lines('reels', 1920, 1080).note, /made for 9:16/);
  assert.deepEqual(GP.lines('stories', 1080, 1920).v, [], 'Stories: top and bottom only');
  const P = await createTestServices(studioComp([], { comp: { width: 1080, height: 1920 } }));
  const prep = await P.services.executor.run('grid.guidePreset', { preset: 'reels' });
  assert.match(prep.summary || JSON.stringify(prep), /guides added|approximate/);
});

test('pressed twice adds nothing new; Clear removes all; Restore brings the cleared guides back', async () => {
  const { services, comp } = await createTestServices(studioComp([], {}));
  await services.executor.run('grid.guidePreset', { preset: 'tvSafe' });
  const again = await services.executor.run('grid.guidePreset', { preset: 'tvSafe' });
  assert.equal(again.status, 'success');
  assert.equal(comp.guides.length, 8, 'no doubles');
  assert.ok(again.verification.checks[0].detail.includes('8 already there'));
  const clear = await services.executor.run('grid.guidePreset', { preset: 'clear' });
  assert.equal(clear.status, 'success'); assert.equal(comp.guides.length, 0);
  assert.ok((await services.executor.restore(clear.checkpointId)).ok);
  assert.equal(comp.guides.length, 8, 'Restore brings them back');
});

test('the Guides sidebar menu: lines, safe, social; each button also on the Comp tab', () => {
  const L = require('../extension/app/ui/layouts');
  const m = L.MENUS.find((x) => x.id === 'Guides');
  assert.ok(m && m.tab === 'ae-comp');
  assert.deepEqual(m.rows.map((r) => r[0]), ['Lines', 'Safe', 'Social']);
  assert.deepEqual(m.rows[2][2], ['TikTok', 'Reels', 'Shorts', 'Stories']);
  const AE = require('../extension/app/ui/layoutAE');
  const g = AE.TABS.find((t) => t.id === 'ae-comp').groups.find((x) => x.id === 'guides');
  for (const ref of m.refs) assert.ok(g.ids.includes(ref.split('/')[1]), ref);
});

test('every icon the UI names exists (Parent & Link had an empty icon)', () => {
  const sets = ['icons-ui', 'icons2', 'icons3'].map((f) => require(`../extension/app/ui/${f}`));
  const dom = fs.readFileSync(path.join(__dirname, '../extension/app/ui/dom.js'), 'utf8');
  const base = [...(dom.match(/const ICONS = \{([\s\S]*?)\n\};/) || ['', ''])[1].matchAll(/^\s*'?([A-Za-z0-9_]+)'?\s*:/gm)].map((x) => x[1]);
  const all = new Set([...base, ...sets.flatMap((s) => Object.keys(s))]);
  const missing = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.js')) { const s = fs.readFileSync(p, 'utf8'); for (const re of [/icon\('([A-Za-z0-9_]+)'/g, /icon: '([A-Za-z0-9_]+)'/g]) for (const x of s.matchAll(re)) if (!all.has(x[1])) missing.push(`${x[1]} (${path.relative(d, p)})`); }
    }
  })(path.join(__dirname, '../extension'));
  assert.deepEqual(missing, []);
  const L = require('../extension/app/ui/layouts');
  for (const m of L.MENUS) assert.ok(all.has(m.icon), `${m.id} menu icon ${m.icon}`);
});
