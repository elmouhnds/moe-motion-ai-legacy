'use strict';
/**
 * v0.57 Product UI (docs/features/PRODUCT_UI.md): interface pieces on the Templates engine — real layers, the text
 * above its shapes, the animation that uses the piece (click, switch, type, fill), light / dark, the brand's colour.
 * All read back from the mock comp.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { studioComp } = require('./fixtures/studio');
const TPL = require('../extension/features/design/templates');
const UI = require('../extension/features/design/uiKit');

const byName = (comp, n) => comp._layers.find((l) => l.name === n);
const tr = (L, mn) => L.property('ADBE Transform Group').property(mn);
const near = (a, b, t = 0.01) => (Array.isArray(a) ? a.every((x, i) => Math.abs(x - b[i]) <= t) : Math.abs(a - b) <= t);
function find(node, mn) { if (!node) return null; if (node.matchName === mn) return node; for (const c of node._children || []) { const r = find(c, mn); if (r) return r; } return null; }
const fillOf = (L) => find(L.property('ADBE Root Vectors Group'), 'ADBE Vector Fill Color').value.slice(0, 3); // RGB (After Effects adds alpha)
async function build(args) {
  const { services, comp } = await createTestServices(studioComp([], { comp: { time: 1 } }));
  const r = await services.executor.run('design.template', Object.assign({ container: 'layers' }, args));
  return { services, comp, r };
}
const idx = (comp, n) => comp._layers.indexOf(byName(comp, n)); // 0 = top of the timeline

test('all eight pieces build: real layers in one null, every planned part there, the texts above the shapes', async () => {
  assert.equal(UI.COMPONENTS.length, 8);
  for (const C of UI.COMPONENTS) {
    const { comp, r } = await build({ template: C.id });
    assert.equal(r.status, 'success', `${C.id}: ${JSON.stringify(r.errors || r.verification)}`);
    const nul = byName(comp, 'MOE Template 1');
    const parts = comp._layers.filter((l) => l.name.indexOf('MOE Template 1 · ') === 0);
    assert.ok(parts.length >= 3 && parts.every((l) => l.parent === nul), `${C.id}: parts in the null`);
    const specs = TPL.textSpecs(C.id, {}, comp);
    const plan = TPL.layout(C.id, {}, comp, Object.fromEntries(specs.map((s) => [s.key, [300, 40, s.fontSize]])));
    for (const el of plan.elements) assert.ok(byName(comp, `MOE Template 1 · ${el.name}`), `${C.id}: ${el.name}`);
    // stacking: every text layer is above every shape layer (a card never covers its words)
    const texts = specs.map((s) => idx(comp, `MOE Template 1 · ${s.name}`)), shapes = plan.elements.filter((e) => e.kind !== 'text').map((e) => idx(comp, `MOE Template 1 · ${e.name}`));
    assert.ok(Math.max(...texts) < Math.min(...shapes), `${C.id}: texts above shapes`);
  }
});

test('the stacking fix also holds for the original templates (Tag: the word above its pill)', async () => {
  const { comp } = await build({ template: 'tag' });
  assert.ok(idx(comp, 'MOE Template 1 · Title') < idx(comp, 'MOE Template 1 · Pill'));
  const e = await build({ template: 'endCard' });
  assert.ok(idx(e.comp, 'MOE Template 1 · Button Text') < idx(e.comp, 'MOE Template 1 · Button'));
});

test('the pieces are used, not just shown: the toggle switches, the button is clicked, the bar fills, the task is ticked', async () => {
  const t = await build({ template: 'uiToggle' });
  const knob = tr(byName(t.comp, 'MOE Template 1 · Knob'), 'ADBE Position')._keys;
  assert.ok(knob[knob.length - 1].value[0] > knob[0].value[0] + 20, 'the knob slides to the right');
  const on = tr(byName(t.comp, 'MOE Template 1 · Track On'), 'ADBE Opacity')._keys;
  assert.equal(on[0].value, 0); assert.equal(on[on.length - 1].value, 100);
  const b = await build({ template: 'uiButton' });
  const sc = tr(byName(b.comp, 'MOE Template 1 · Button'), 'ADBE Scale')._keys.map((k) => k.value[0]);
  assert.ok(Math.min(...sc.slice(3)) < 96 && sc[sc.length - 1] === 100, 'pressed, then back');
  const rip = tr(byName(b.comp, 'MOE Template 1 · Ripple'), 'ADBE Opacity')._keys;
  assert.equal(rip[0].value, 0, 'the ripple is invisible until the click');
  const p = await build({ template: 'uiProgress' });
  assert.ok(p.r.verification.checks.some((c) => /Fill › /.test(c.label)), 'the fill is keyed (Trim Paths)');
  const k = await build({ template: 'uiTask' });
  const op = tr(byName(k.comp, 'MOE Template 1 · Task'), 'ADBE Opacity')._keys;
  assert.equal(op[op.length - 1].value, 55, 'crossed out, then dimmed');
  const c = await build({ template: 'uiChat' });
  const dots = tr(byName(c.comp, 'MOE Template 1 · Typing Dot 1'), 'ADBE Position')._keys;
  assert.ok(dots.length > 4, 'the typing dots bounce');
});

test('Light / Dark and the brand: card colours by look; an active client replaces the kit blue, a chosen colour stays', async () => {
  const l = await build({ template: 'uiStat' }), d = await build({ template: 'uiStat', theme: 'dark' });
  assert.ok(near(fillOf(byName(l.comp, 'MOE Template 1 · Card')), [1, 1, 1]));
  assert.ok(near(fillOf(byName(d.comp, 'MOE Template 1 · Card')), UI.THEMES.dark.card));
  const { services, comp } = await createTestServices(studioComp([], { comp: { time: 1 } }));
  const saved = services.brands.save({ name: 'Nile & Co.', colors: [{ name: 'Nile Green', hex: '#0E7C66', role: 'primary' }, { name: 'Ink', hex: '#1F2421', role: 'text' }], fonts: { extra: [] } });
  require('../extension/features/brand/kit').setActive(services.store, saved.brand.id);
  await services.executor.run('design.template', { container: 'layers', template: 'uiButton', accent: '#0A84FF' });
  assert.ok(near(fillOf(byName(comp, 'MOE Template 1 · Button')), [0x0e / 255, 0x7c / 255, 0x66 / 255], 0.002), 'the brand replaced the kit blue');
  await services.executor.run('design.template', { container: 'layers', template: 'uiButton', accent: '#FF00AA', useBrand: true });
  assert.ok(near(fillOf(byName(comp, 'MOE Template 2 · Button')), [1, 0, 0xaa / 255], 0.002), 'a colour you chose is kept');
});

test('the Product UI page: 12 tiles (light + dark), on the Design tab and stage, settings only where they apply', () => {
  const S = require('../extension/app/ui/studio/sections');
  const sec = S.byId('productui');
  // v0.60: + 5 Interact tiles (Click on Layer, Tap, UI Reveal ×3) in front of the 12 pieces
  const pieces = sec.tiles.filter((t) => !t.tags.includes('Interact'));
  assert.equal(pieces.length, 12);
  assert.equal(sec.tiles.length, 17);
  assert.ok(pieces.every((t) => t.tool === 'design.template' && TPL.isUi(t.args.template)));
  const AE = require('../extension/app/ui/layoutAE');
  assert.ok(AE.TABS.find((t) => t.id === 'ae-design').groups.some((g) => g.id === 'productui'));
  const W = require('../extension/app/ui/workflow');
  assert.ok(W.STAGES.find((s) => s.id === 'st-design').groups.some((g) => g[1] === 'productui'));
  const tool = require('../extension/features/design/templateTool').template;
  assert.ok(tool.params.theme.showIf({ template: 'uiStat' }) && !tool.params.theme.showIf({ template: 'lowerThird' }));
  assert.ok(!tool.params.textColor.showIf({ template: 'uiStat' }) && tool.params.subtitle.showIf({ template: 'uiNotify' }) && !tool.params.subtitle.showIf({ template: 'uiButton' }));
});
