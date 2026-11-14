'use strict';
/**
 * v0.98.1 — the owner's first real After Effects report: "Globe 3D: … Value 6 out of range 1 to 3". A new Dropdown Menu
 * Control has 3 items; effects.ensure used to set the grid's menu values (Mode = 6 for sphere, Effector Type, Falloff…)
 * before effects.setMenu gave it its list. The mock now throws exactly like After Effects (ae-mock _checkMenu).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { gridItems } = require('./fixtures/layout');

test('Globe 3D (menu value 6) builds on a 3-item Dropdown like After Effects', async () => {
  const r0 = await createTestServices(gridItems(9));
  const r = await r0.services.executor.run('grid.build', { mode: 'sphere' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.ok(r0.comp._layers.some((l) => l.name === 'MOE Grid 1'));
});

test('a failed grid leaves no MOE Grid null and no clones behind', async () => {
  const r0 = await createTestServices(gridItems(4));
  const before = r0.comp._layers.map((l) => l.name).sort();
  const host = r0.services.host, call = host.call.bind(host);
  // fail the grid plan after the null exists (expressions.set is a later step of the same tx.run; a bad comp id fails it at run time)
  // …and the cleanup's first step (unparent) fails too: the null must still go
  const broken = (a, bad) => Object.assign({}, a, { steps: a.steps.map((s) => (s.op === bad ? Object.assign({}, s, { args: { compId: -12345 } }) : s)) });
  host.call = (op, a) => {
    if (op === 'tx.run' && a.steps.some((s) => s.op === 'expressions.set')) return call(op, broken(a, 'expressions.set'));
    if (op === 'tx.run' && /failed/.test(a.label)) return call(op, broken(a, 'layers.setParent'));
    return call(op, a);
  };
  const r = await r0.services.executor.run('grid.build', { mode: 'rect', columns: 2 });
  assert.notEqual(r.status, 'success');
  assert.deepEqual(r0.comp._layers.map((l) => l.name).sort(), before);
});

test('a grid null\'s menus hold their full lists and the chosen value straight from effects.ensure', async () => {
  const r0 = await createTestServices(gridItems(9));
  const r = await r0.services.executor.run('grid.build', { mode: 'sphere' });
  assert.equal(r.status, 'success');
  const G = r0.comp._layers.find((l) => l.name === 'MOE Grid 1');
  const menus = G._parade._children.filter((f) => f.matchName === 'ADBE Dropdown Control');
  assert.ok(menus.length > 0);
  for (const f of menus) { const p = f._children[0]; assert.ok((p._menuItems || []).length >= 2, f.name); assert.ok(p.value >= 1 && p.value <= p._menuItems.length, f.name); }
  const layout = menus.find((f) => f.name === 'Layout');
  assert.ok(layout && layout._children[0].value > 3, 'sphere is past item 3 of the Layout menu');
});
