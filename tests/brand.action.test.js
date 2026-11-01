'use strict';
/** Brand in action (v0.26): roles, one-click apply (selection / whole comp) on the AE mock, brand backgrounds, brand ease. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { T, studioComp } = require('./fixtures/studio');
const B = require('../extension/features/brand/brands');
const { brandRoles, planApply, isHeadline } = require('../extension/features/brand/applyAll');
const K = require('../extension/features/brand/kit');
const PAL = require('../extension/features/design/palettes');

const NILE = { name: 'Nile & Co.', colors: [{ name: 'Nile Green', hex: '#0E7C66', role: 'primary' }, { name: 'Sunset', hex: '#F2A541', role: 'accent' }, { name: 'Sand', hex: '#F4E9D8', role: 'background' }, { name: 'Ink', hex: '#1F2421', role: 'text' }],
  fonts: { arabic: { ps: 'Cairo-Bold', family: 'Cairo', style: 'Bold' }, english: { ps: 'Montserrat-Bold', family: 'Montserrat', style: 'Bold' }, extra: [] },
  profile: { gradients: [{ name: 'Dawn', stops: ['#0E7C66', '#F2A541'] }], motion: { feel: 'gentle', easing: 'gentle', pace: 'slow' } } };
const doc = (layer) => layer.property('ADBE Text Properties').property('ADBE Text Document').value;
const near = (a, b) => [0, 1, 2].every((i) => Math.abs(a[i] - b[i]) < 0.005);
const rgb = (hex) => B.hexToRgb(hex);

test('brand roles: imported roles used; contrast decides headline / text; hand-made clients get sensible roles', () => {
  const r = brandRoles(NILE);
  assert.deepEqual([r.primary.hex, r.secondary.hex, r.accent.hex, r.background.hex, r.text.hex, r.headline.hex], ['#0E7C66', '#F2A541', '#F2A541', '#F4E9D8', '#1F2421', '#0E7C66']);
  assert.ok(r.contrast.text >= 4.5 && r.contrast.headline >= 3);
  // dark brand whose "text" role would be unreadable on its background → the most readable colour is used
  const dark = brandRoles({ colors: [{ name: 'Night', hex: '#101018', role: 'background' }, { name: 'Ink', hex: '#202030', role: 'text' }, { name: 'Lime', hex: '#B6FF3B', role: 'primary' }, { name: 'White', hex: '#FFFFFF' }] });
  assert.equal(dark.text.hex, '#FFFFFF');
  assert.equal(dark.headline.hex, '#B6FF3B');
  // no roles at all (made by hand): lightest = background, first vivid = primary
  const hand = brandRoles({ colors: [{ name: 'Blue', hex: '#0A4D8C' }, { name: 'Gold', hex: '#D4A017' }, { name: 'White', hex: '#FFFFFF' }] });
  assert.equal(hand.background.hex, '#FFFFFF'); assert.equal(hand.primary.hex, '#0A4D8C'); assert.equal(hand.text.hex, '#0A4D8C');
  assert.equal(brandRoles({ colors: [] }), null);
});

test('brand plan: headline vs body, Arabic font + RTL, shapes in turn, only the background solid, MOE gradients and locked layers left alone', () => {
  assert.equal(isHeadline({ name: 'Layer 3', text: 'Big sale' }), true);
  assert.equal(isHeadline({ name: 'Copy', text: 'Our new collection arrives this week in every store' }), false);
  assert.equal(isHeadline({ name: 'Main title', text: 'A much longer sentence that is still the title of this frame' }), true);
  const L = [
    { id: 1, index: 1, name: 'Headline', type: 'text', text: 'Fresh roast' },
    { id: 2, index: 2, name: 'Body', type: 'text', text: 'Single-origin beans roasted every morning by the river in Cairo' },
    { id: 3, index: 3, name: 'AR', type: 'text', text: 'قهوة طازجة' },
    { id: 4, index: 4, name: 'Badge', type: 'shape' }, { id: 5, index: 5, name: 'Pill', type: 'shape' }, { id: 6, index: 6, name: 'Shape BG', type: 'shape' },
    { id: 7, index: 7, name: 'Logo', type: 'av' }, { id: 8, index: 8, name: 'Locked text', type: 'text', text: 'x', locked: true },
    { id: 9, index: 9, name: 'MOE Background', type: 'solid' }, { id: 10, index: 10, name: 'Plate', type: 'solid' }, { id: 11, index: 11, name: 'Base', type: 'solid' }
  ];
  const p = planApply(NILE, L);
  assert.deepEqual(p.text.map((t) => [t.layer.name, t.role, t.font.ps, t.rtl, t.fill.hex]), [['Headline', 'headline', 'Montserrat-Bold', false, '#0E7C66'], ['Body', 'body', 'Montserrat-Bold', false, '#1F2421'], ['AR', 'headline', 'Cairo-Bold', true, '#0E7C66']]);
  assert.deepEqual(p.shapes.map((x) => [x.layer.name, x.color.hex]), [['Badge', '#0E7C66'], ['Pill', '#F2A541'], ['Shape BG', '#F4E9D8']]);
  assert.deepEqual(p.fills.map((x) => [x.layer.name, x.color.hex]), [['Base', '#F4E9D8']], 'the bottom-most solid is the background');
  assert.ok(p.skipped.some((s) => /Logo/.test(s)) && p.skipped.some((s) => /Locked/.test(s)) && p.skipped.some((s) => /MOE Background.*gradient/.test(s)) && p.skipped.some((s) => /Plate/.test(s)));
  // fonts only / colours only
  assert.ok(planApply(NILE, L, { colors: false }).text.every((t) => !t.fill && t.font));
  assert.equal(planApply(NILE, L, { colors: false }).shapes.length, 0);
  assert.ok(planApply(NILE, L, { fonts: false }).text.every((t) => !t.font && t.fill));
});

test('Apply Whole Brand on the AE mock: fonts by script + colours by role, background fill, verified, one restore puts everything back', async () => {
  const { services, comp } = await createTestServices(studioComp([
    { name: 'Title', selected: true, text: 'Fresh roast', transform: T() },
    { name: 'AR', selected: true, text: 'قهوة طازجة', transform: T() },
    { name: 'Badge', selected: true, shapes: [{ name: 'Circle', fill: [1, 0, 0], stroke: [0, 0, 0] }], transform: T() },
    { name: 'BG', selected: true, source: { kind: 'solid', color: [0.2, 0.2, 0.2] }, transform: T() }
  ]));
  const id = services.brands.save(NILE).brand.id;
  const r = await services.executor.run('brand.applyAll', { brandId: id, scope: 'selection', fonts: true, colors: true });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.equal(doc(comp.layer(1)).font, 'Montserrat-Bold');
  assert.ok(near(doc(comp.layer(1)).fillColor, rgb('#0E7C66')), 'headline in the primary colour');
  assert.equal(doc(comp.layer(2)).font, 'Cairo-Bold');
  assert.equal(doc(comp.layer(2)).direction, 2, 'Arabic → right-to-left');
  const fill = comp.layer(3).property('ADBE Root Vectors Group').property(1).property(1).property(1).property(1).value;
  assert.ok(near(fill, rgb('#0E7C66')), 'first shape in the primary colour');
  assert.equal(comp.layer(4)._parade._children[0].name, 'MOE Brand Fill');
  assert.deepEqual(Array.from(comp.layer(4).source.mainSource.color), [0.2, 0.2, 0.2], 'shared solid source untouched');
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.equal(doc(comp.layer(1)).font, 'ArialMT');
  assert.deepEqual(Array.from(doc(comp.layer(1)).fillColor), [1, 1, 1]);
  assert.equal(comp.layer(3).property('ADBE Root Vectors Group').property(1).property(1).property(1).property(1).value[0], 1);
  assert.equal(comp.layer(4)._parade._children.length, 0);
});

test('Apply Whole Brand on the whole comp works with nothing selected; refuses with no client / nothing to do', async () => {
  const { services, comp } = await createTestServices(studioComp([
    { name: 'Title', text: 'Fresh roast', transform: T() },
    { name: 'Locked copy', text: 'Do not touch', locked: true, transform: T() }
  ]));
  const id = services.brands.save(NILE).brand.id;
  const r = await services.executor.run('brand.applyAll', { brandId: id, scope: 'comp', fonts: true, colors: true });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.equal(doc(comp.layer(1)).font, 'Montserrat-Bold');
  assert.notEqual(doc(comp.layer(2)).font, 'Montserrat-Bold', 'locked layer untouched');
  // refusals happen in prepare (the executor reports them as "blocked"), before anything touches AE
  const noClient = await services.executor.run('brand.applyAll', { brandId: 'nope', scope: 'comp', fonts: true, colors: true });
  assert.equal(noClient.status, 'blocked'); assert.match(noClient.errors[0], /Choose a client/);
  const noSel = await services.executor.run('brand.applyAll', { brandId: id, scope: 'selection', fonts: true, colors: true });
  assert.equal(noSel.status, 'blocked'); assert.match(noSel.errors[0], /Select layers, or choose “Whole comp”/);
});

test('brand backgrounds: gradients + palette become custom Backgrounds presets that the Background tool accepts; saving again replaces them', async () => {
  const list = K.brandBackgrounds(Object.assign({ id: 'b1' }, NILE));
  assert.deepEqual(list.map((b) => b.name), ['Nile & Co. · Dawn', 'Nile & Co. · Brand glow', 'Nile & Co. · Soft mesh']);
  for (const b of list) assert.ok(PAL.resolve(b.args.palette, b.args.colors, b.args.paletteName), b.name);
  assert.deepEqual(PAL.resolve('custom', '#0E7C66, #F2A541').colors, ['#0E7C66', '#F2A541', '#0E7C66', '#F2A541', '#0E7C66']);
  assert.equal(PAL.resolve('custom', '#0E7C66'), null, 'one colour is not a palette');
  const { services, comp } = await createTestServices(studioComp([{ name: 'Title', text: 'Hi', transform: T() }]));
  const saved = services.brands.save(NILE).brand;
  assert.equal(K.saveBrandBackgrounds(services.presets, saved), 3);
  assert.equal(K.saveBrandBackgrounds(services.presets, saved), 3);
  assert.equal(services.presets.list('design.background').length, 3, 'saving again replaces, never duplicates');
  const dawn = services.presets.list('design.background')[0];
  const tool = services.registry.get('design.background');
  const args = Object.assign(require('../extension/core/schema').defaults(tool.params), dawn.args);
  const r = await services.executor.run('design.background', args);
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.match(comp.layer(comp.numLayers).name, /^MOE Background/, 'added at the bottom of the comp');
});

test('brand ease + active client: motion feel → the matching ease; brand actions resolve with or without a client', () => {
  assert.equal(K.brandEaseRef(NILE), 'quick:k_easy');
  assert.equal(K.brandEaseRef({ profile: { motion: { easing: 'snappy' } } }), 'tile:animate/easeSnappy');
  assert.equal(K.brandEaseRef({ profile: {} }), null);
  const A = require('../extension/app/ui/actions');
  A.setBrandSource(() => null);
  const app = { state: { get: () => ({ ctx: null }) } };
  for (const ref of ['brand:apply', 'brand:applyComp', 'brand:ease']) { const a = A.resolve(ref); assert.ok(a, ref); assert.equal(a.ready(app).ok, false); assert.match(a.ready(app).hint, /client/i); }
  A.setBrandSource(() => Object.assign({ id: 'x' }, NILE));
  assert.match(A.resolve('brand:ease').where, /gentle/);
  A.setBrandSource(() => null);
  const data = {};
  const store = { get: (k, f) => (k in data ? data[k] : f), set: (k, v) => { data[k] = v; } };
  const brands = { list: () => [{ id: 'a' }, { id: 'b' }], get: (id) => [{ id: 'a' }, { id: 'b' }].find((b) => b.id === id) || null };
  assert.equal(K.activeBrand(store, brands), null, 'two clients and none chosen → none');
  K.setActive(store, 'b');
  assert.equal(K.activeBrand(store, brands).id, 'b');
  assert.equal(K.activeBrand(store, { list: () => [{ id: 'only' }], get: () => null }).id, 'only', 'a single client is the active one');
});
