'use strict';
/**
 * v0.60 SaaS Interaction (docs/features/SAAS_INTERACTION.md): Click on Layer (a cursor at each target's measured
 * centre, the target pressing in place on top of its own animation), UI Reveal (stagger in the order a screen is
 * read, from the boxes After Effects measures) and product backdrops.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const CP = require('../extension/features/interact/clickPlan');
const PLAN = require('../extension/features/quick/animatePlan');
const base = require('../dev/preview-fixture.js');

const tr = (L, mn) => L.property('ADBE Transform Group').property(mn);
const near = (a, b, e = 0.05) => a.every((x, i) => Math.abs(x - b[i]) < e);
/** The fixture with: only Title and Logo selected (Logo first), and Logo's anchor at its top-left corner. */
function fixture() {
  const f = JSON.parse(JSON.stringify(base, (k, v) => v));
  f.comp.layers.forEach((l) => { l.selected = l.name === 'Title' || l.name === 'Logo'; });
  const logo = f.comp.layers.find((l) => l.name === 'Logo');
  logo.rect = { left: 0, top: 0, width: 160, height: 160 }; // visual centre = anchor + (80, 80)
  f.comp.layers = [logo].concat(f.comp.layers.filter((l) => l !== logo));
  return f;
}

test('the click plan: arrives and settles before each click, travels between them, presses down to Depth and springs back', () => {
  const T = CP.times(3, { time: 1, travel: 0.5, gap: 1 });
  assert.ok(Math.abs(T[0] - (1 + 0.5 + CP.SETTLE)) < 1e-9 && Math.abs(T[2] - T[1] - 1) < 1e-9);
  const tight = CP.times(2, { time: 0, travel: 2, gap: 0.5 });
  assert.ok(tight[1] - tight[0] >= 2 + CP.SETTLE + CP.DWELL - 1e-9, 'a gap shorter than one travel is widened');
  const clicks = [{ t: T[0], p: [100, 100] }, { t: T[1], p: [500, 300] }];
  const pl = CP.plan(clicks, { from: 'corner', W: 1920, H: 1080, travel: 0.5, gap: 1, depth: 90 });
  assert.deepEqual(pl.pos[0].v, [1980, 1140], 'comes in from off frame, bottom right');
  clicks.forEach((c) => assert.ok(near(CP.valueAt(pl.pos, c.t), c.p), 'on the target at the click'));
  assert.ok(pl.pos.some((k) => Math.abs(k.t - (clicks[0].t + CP.DWELL)) < 1e-9), 'dwells, then leaves');
  const f = pl.press.map((k) => k.f);
  assert.equal(f[0], 1); assert.equal(f[f.length - 1], 1); assert.equal(Math.min(...f), 0.9);
  assert.ok(Math.max(...f) > 1, 'springs a little past its rest');
  assert.equal(CP.plan(clicks, { from: 'center', W: 1920, H: 1080, travel: 0.5, gap: 1 }).opacity[0].v, 0, 'from the centre it fades in');
});

test('Click on Layer on the mock: the cursor sits on each measured centre, the layer presses around it, Restore removes it all', async () => {
  const { services, comp } = await createTestServices(fixture());
  const title = comp._layers.find((l) => l.name === 'Title'), logo = comp._layers.find((l) => l.name === 'Logo');
  const titleScaleKeys = tr(title, 'ADBE Scale').numKeys, n0 = comp._layers.length;
  const r = await services.executor.run('interact.click', { kind: 'arrow', from: 'corner', gap: 1.1, travel: 0.55, depth: 94, ripple: true, size: 40, color: '#FFFFFF' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.error));
  const cursor = comp._layers.find((l) => /^MOE Cursor/.test(l.name));
  assert.ok(cursor, 'cursor layer made');
  const T = CP.times(2, { time: comp.time, travel: 0.55, gap: 1.1 });
  // Logo is first in the selection: its centre is its anchor + (80, 80)
  assert.ok(near(tr(cursor, 'ADBE Position').valueAtTime(T[0], false).slice(0, 2), [1780, 220]), 'cursor on the Logo centre');
  assert.ok(near(tr(cursor, 'ADBE Position').valueAtTime(T[1], false).slice(0, 2), [960, 540]), 'cursor on the Title centre');
  // the Logo presses around its centre: Position + Scale × (80, 80) stays on [1780, 220] at the deepest key
  const t = T[0] + 0.06, s = tr(logo, 'ADBE Scale').valueAtTime(t, false), p = tr(logo, 'ADBE Position').valueAtTime(t, false);
  assert.ok(Math.abs(s[0] - 94) < 0.01, 'pressed to 94 %');
  assert.ok(near([p[0] + s[0] / 100 * 80, p[1] + s[1] / 100 * 80], [1780, 220]), 'pressed in place, not toward its corner');
  // the Title presses on top of its own Scale animation (100 after 0.6 s)
  assert.ok(Math.abs(tr(title, 'ADBE Scale').valueAtTime(T[1] + 0.06, false)[0] - 94) < 0.01);
  assert.ok(r.verification.checks.some((c) => /^Click Logo/.test(c.label) && c.ok), 'the arrival is read back');
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.equal(comp._layers.length, n0, 'cursor removed');
  assert.equal(tr(title, 'ADBE Scale').numKeys, titleScaleKeys, 'Title keys as they were');
  assert.equal(tr(logo, 'ADBE Position').numKeys, 0, 'Logo position as it was');
});

test('screen order: rows by measured centre (a few px off still one row), left → right, right → left, centre out', () => {
  const boxes = [[700, 105, 900, 205], [100, 100, 300, 200], [400, 96, 600, 196], [100, 400, 900, 500]];
  assert.deepEqual(PLAN.screenOrder(boxes, 'screen'), [2, 0, 1, 3]);
  assert.deepEqual(PLAN.screenOrder(boxes, 'screenRtl'), [0, 2, 1, 3]);
  const c = PLAN.screenOrder([[0, 0, 10, 10], [45, 45, 55, 55], [90, 90, 100, 100]], 'center');
  assert.equal(c[1], 0, 'the middle one first');
});

test('UI Reveal on the mock: Quick Animate staggers by where the layers are on screen, not by selection order', async () => {
  const f = JSON.parse(JSON.stringify(base));
  f.comp.layers.forEach((l) => { l.selected = ['Title', 'Subtitle', 'Logo'].includes(l.name); });
  const { services } = await createTestServices(f);
  const r = await services.executor.run('quick.animate', { kind: 'fade', dir: 'in', duration: 0.5, ease: 'smooth', stagger: 0.1, order: 'screen' });
  assert.equal(r.status, 'success');
  const first = (name) => Math.min(...r.result.keys.items.filter((it) => it.layerName === name).map((it) => it.written[0].t));
  assert.ok(first('Logo') < first('Title') && first('Title') < first('Subtitle'), 'top to bottom: Logo (y 140), Title (540), Subtitle (640)');
  assert.ok(r.verification.checks.some((c) => c.label === 'Screen order' && /Logo → Title → Subtitle/.test(c.detail)));
});

test('the tiles: Interact in Product UI, Click in Zoom & Focus, product backdrops open on their own look', () => {
  const { SECTIONS } = require('../extension/app/ui/studio/sections');
  const by = (id) => SECTIONS.find((s) => s.id === id);
  const ui = by('productui').tiles.filter((t) => t.tags.includes('Interact'));
  assert.deepEqual(ui.map((t) => t.id), ['ui-click', 'ui-tap', 'ui-reveal', 'ui-revealRtl', 'ui-revealCenter']);
  assert.equal(ui.find((t) => t.id === 'ui-reveal').args.order, 'screen');
  assert.ok(by('zoom').tiles.some((t) => t.tool === 'interact.click'));
  const bg = by('backgrounds').tiles.filter((t) => t.tags.includes('Product'));
  assert.equal(bg.length, 4);
  assert.ok(bg.every((t) => t.args.style !== 'linear' && t.args.grain > 0), 'radial / mesh with fine grain');
  assert.ok(bg.every((t) => t.ownLook), 'they apply their own look, not just the palette (library.fill / tileThumb)');
});

test('Click on Layer never touches a locked layer: it is skipped and named; all locked → refused before anything changes', async () => {
  const f = fixture();
  f.comp.layers.find((l) => l.name === 'Logo').locked = true;
  const { services, comp } = await createTestServices(f);
  const logo = comp._layers.find((l) => l.name === 'Logo');
  const args = { kind: 'arrow', from: 'corner', gap: 1.1, travel: 0.55, depth: 94, ripple: true, size: 40, color: '#FFFFFF' };
  const r = await services.executor.run('interact.click', args);
  assert.equal(r.status, 'success');
  assert.equal(r.result.clicks.length, 1, 'only the Title is clicked');
  assert.ok(r.result.skipped.some((s) => /Logo \(locked/.test(s)));
  assert.equal(tr(logo, 'ADBE Scale').numKeys, 0, 'the locked Logo is untouched');
  const g = fixture(); g.comp.layers.forEach((l) => { if (l.selected) l.locked = true; });
  const s2 = await createTestServices(g);
  const n0 = s2.comp._layers.length;
  const r2 = await s2.services.executor.run('interact.click', args);
  assert.notEqual(r2.status, 'success');
  assert.equal(s2.comp._layers.length, n0, 'nothing made');
});
