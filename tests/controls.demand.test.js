'use strict';
/** v0.87 Controls on demand (docs/features/CONTROLS_ON_DEMAND.md): an effector arrives with the sliders it uses. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { gridItems } = require('./fixtures/layout');
const EF = require('../extension/features/grid/effectors');
const X = require('../extension/features/grid/expressions');
const E = require('../extension/features/expressions/quick');

const names = (L) => L._parade._children.map((f) => f.name);
const cards = (comp) => comp._layers.filter((l) => /^Card/.test(l.name));
const pos = (L, t) => Array.from(L.property('ADBE Transform Group').property('ADBE Position').valueAtTime(t, false));
const scl = (L, t) => Array.from(L.property('ADBE Transform Group').property('ADBE Scale').valueAtTime(t, false));

async function grid(n = 6) {
  const r0 = await createTestServices(gridItems(n));
  const r = await r0.services.executor.run('grid.build', { mode: 'rect', columns: 3, spacingX: 150, spacingY: 120 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const G = r0.comp._layers.find((l) => l.name === 'MOE Grid 1');
  r0.comp._layers.forEach((l) => { l.selected = l === G; });
  return Object.assign(r0, { G });
}

test('needed(): the core six, the moves that move, and a group only when its setting is on', () => {
  const N = (a) => EF.needed(EF.valuesOf(a));
  assert.deepEqual(N({ type: 'plain', falloff: 'sphere', scale: 60 }), ['Effector Type', 'Falloff', 'Size', 'Softness', 'Strength', 'Invert', 'Scale']);
  assert.deepEqual(N({ type: 'random', falloff: 'all', moveX: 80, rotate: 60 }), ['Effector Type', 'Falloff', 'Size', 'Softness', 'Strength', 'Invert', 'Move X', 'Rotate', 'Seed']);
  assert.ok(['Noise Scale', 'Noise Speed', 'Seed'].every((n) => N({ type: 'noise', moveY: 5 }).includes(n)));
  assert.ok(N({ type: 'delay', moveY: 5 }).includes('Delay') && !N({ type: 'plain', moveY: 5 }).includes('Delay'));
  assert.ok(N({ type: 'target' }).includes('Rotate'), 'Target keeps its aim offset');
  assert.ok(['Spring', 'Frequency', 'Decay'].every((n) => N({ scale: 5, spring: 100 }).includes(n)) && !N({ scale: 5 }).includes('Spring'));
  assert.ok(['Colour', 'Colour Mix'].every((n) => N({ colourMix: 50 }).includes(n)));
  assert.ok(['Audio Layer', 'Audio Max', 'Delay'].every((n) => N({ type: 'audio', scale: 5 }).includes(n)));
  assert.ok(N({ falloff: 'image', scale: 5 }).includes('Field Layer') && N({ falloff: 'noise', scale: 5 }).includes('Field Speed'));
  // every group is made of real controls, and together with the core they cover all of them exactly once
  const all = Object.values(EF.GROUPS).flat();
  assert.deepEqual(all.slice().sort(), EF.CONTROLS.map((c) => c[0]).sort());
  assert.equal(EF.needed(EF.valuesOf({ scale: 60 })).length < EF.CONTROLS.length / 2, true, 'far fewer than all 24');
});

test('a new effector has only its own sliders; the items evaluate; all controls give the same result', async () => {
  const a = await grid();
  const r = await a.services.executor.run('grid.effector', { type: 'plain', falloff: 'sphere', size: 260, softness: 60, scale: 80, rotate: 30 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const Ea = a.comp._layers.find((l) => l.name === 'MOE Effector 1');
  assert.deepEqual(names(Ea), ['Effector Type', 'Falloff', 'Size', 'Softness', 'Strength', 'Invert', 'Scale', 'Rotate']);
  const b = await grid();
  const rb = await b.services.executor.run('grid.effector', { type: 'plain', falloff: 'sphere', size: 260, softness: 60, scale: 80, rotate: 30, controls: 'all' });
  assert.equal(rb.status, 'success');
  assert.equal(names(b.comp._layers.find((l) => l.name === 'MOE Effector 1')).length, EF.CONTROLS.length);
  cards(a.comp).forEach((L, i) => {
    assert.deepEqual(pos(L, 0), pos(cards(b.comp)[i], 0), `item ${i} position`);
    assert.deepEqual(scl(L, 0), scl(cards(b.comp)[i], 0), `item ${i} scale`);
  });
  assert.ok(cards(a.comp).some((L) => scl(L, 0)[0] > 100.5), 'the effector does scale items');
});

test('Effector Controls adds only what is missing, changes nothing, and Restore removes exactly that', async () => {
  const a = await grid();
  await a.services.executor.run('grid.effector', { type: 'plain', falloff: 'sphere', size: 260, softness: 60, scale: 80 });
  const Ef = a.comp._layers.find((l) => l.name === 'MOE Effector 1');
  const before = names(Ef), was = cards(a.comp).map((L) => scl(L, 0));
  Ef._parade._children.find((f) => f.name === 'Size')._children[0].setValue(333);
  a.comp._layers.forEach((l) => { l.selected = l === Ef; });
  const r = await a.services.executor.run('grid.effectorControls', { group: 'spring' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.deepEqual(names(Ef), before.concat(['Spring', 'Frequency', 'Decay']));
  assert.equal(Ef._parade._children.find((f) => f.name === 'Size')._children[0].value, 333, 'a control that was there keeps its value');
  const r2 = await a.services.executor.run('grid.effectorControls', { group: 'all' });
  assert.equal(r2.status, 'success');
  assert.deepEqual(names(Ef).slice().sort(), EF.CONTROLS.map((c) => c[0]).sort());
  assert.equal(new Set(names(Ef)).size, names(Ef).length, 'never a second copy of a control');
  // the added controls carry the defaults the expression was already using → the result is the same as with Size 333 alone
  Ef._parade._children.find((f) => f.name === 'Size')._children[0].setValue(260);
  cards(a.comp).forEach((L, i) => assert.deepEqual(scl(L, 0), was[i], `item ${i} unchanged`));
  await a.services.executor.restore(r2.checkpointId);
  assert.deepEqual(names(Ef), before.concat(['Spring', 'Frequency', 'Decay']), 'Restore removes what that run added');
  // nothing selected that is an effector → refused before anything is written
  a.comp._layers.forEach((l) => { l.selected = l === a.G; });
  const r3 = await a.services.executor.run('grid.effectorControls', { group: 'all' });
  assert.notEqual(r3.status, 'success');
});

test('a grid built before v0.87 (v3 items) is rewritten when an effector is added, so a lean effector never breaks it', async () => {
  const a = await grid();
  // make the items look like v0.86 ones: the v3 tag and the old unguarded reads
  for (const L of cards(a.comp)) for (const mn of ['ADBE Position', 'ADBE Scale', 'ADBE Rotate Z', 'ADBE Opacity']) {
    const p = L.property('ADBE Transform Group').property(mn);
    if (p.expression) p.expression = p.expression.replace(` · v${X.VERSION}\n`, ' · v3\n');
  }
  const code0 = cards(a.comp)[0].property('ADBE Transform Group').property('ADBE Position').expression;
  assert.ok(X.isV3(code0) && !X.isCurrent(code0) && X.factsOf(code0), 'the stored code (with its MOE-LINK id) is readable');
  const r = await a.services.executor.run('grid.effector', { type: 'plain', falloff: 'all', moveX: 10 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.ok(cards(a.comp).every((L) => X.isCurrent(L.property('ADBE Transform Group').property('ADBE Position').expression)), 'every item is the current version now');
  await a.services.executor.restore(r.checkpointId);
  assert.equal(cards(a.comp)[0].property('ADBE Transform Group').property('ADBE Position').expression, code0, 'Restore puts the old expression back');
});

test('quick expressions arrive with their own sliders (live on by default); off writes the numbers in the code', async () => {
  assert.equal(E.quick.params.live.default, true);
  const mk = () => createTestServices(gridItems(1));
  const a = await mk();
  assert.equal((await a.services.executor.run('expressions.quick', { preset: 'wiggle', freq: 3, amp: 12 })).status, 'success');
  assert.deepEqual(names(cards(a.comp)[0]), ['MOE Wiggle Frequency', 'MOE Wiggle Amount']);
  const b = await mk();
  assert.equal((await b.services.executor.run('expressions.quick', { preset: 'wiggle', freq: 3, amp: 12, live: false })).status, 'success');
  assert.deepEqual(names(cards(b.comp)[0]), []);
  assert.match(cards(b.comp)[0].property('ADBE Transform Group').property('ADBE Position').expression, /wiggle\(3, 12\)/);
});
