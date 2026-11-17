'use strict';
/**
 * v0.99.7 — one holder per run (core/holder.js), the owner's rule.
 *
 * The two things this guards are the ones that were got wrong by hand:
 *  - a holder a tool PARENTS to must be at identity, because layers.setParent uses setParentWithJump (no
 *    compensation) and comp.layers.addNull leaves the anchor at [0,0] while the position is set elsewhere;
 *  - Effect Controls carries only the controls the run's own settings drive (CLAUDE.md v0.87).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../extension/core/holder');

test('a holder null is created AT IDENTITY, so parts parented to it do not jump', () => {
  const a = H.nullArgs({ compId: 7, name: 'MOE Glass 1 Controls', at: [960, 540], label: 9 });
  assert.deepEqual(a.position, [960, 540]);
  assert.deepEqual(a.anchor, a.position, 'anchor must equal position — setParentWithJump does not compensate');
  assert.equal(a.compId, 7);
  assert.equal(a.name, 'MOE Glass 1 Controls');
  assert.equal(a.label, 9);

  // 3D holders carry the third ordinate on both, for the same reason
  const b = H.nullArgs({ compId: 1, name: 'MOE Carousel 1', at: [100, 200], threeD: true });
  assert.equal(b.threeD, true);
  assert.deepEqual(b.position, [100, 200, 0]);
  assert.deepEqual(b.anchor, b.position);

  // the default is still a point, never undefined (an undefined anchor is what leaves AE's [0,0])
  assert.deepEqual(H.nullArgs({ compId: 1, name: 'x' }).anchor, [0, 0]);
});

test('controls on demand: only what this run drives reaches Effect Controls', () => {
  const controls = [
    { key: 'Softness', value: 16 },
    { key: 'Rim', value: 50, when: (a) => !!a.rim },
    { key: 'Shadow', value: 40, when: (a) => !!a.shadow },
    { key: 'Tint', value: '#fff', kind: 'color', when: (a) => !!a.tintLayer }
  ];

  const lean = H.needed(controls, { rim: false, shadow: false, tintLayer: false }).map((c) => c.key);
  assert.deepEqual(lean, ['Softness'], 'a part that is off must not leave its slider behind');

  const full = H.needed(controls, { rim: true, shadow: true, tintLayer: true }).map((c) => c.key);
  assert.deepEqual(full, ['Softness', 'Rim', 'Shadow', 'Tint']);

  // a control with no `when` is always kept, and a `when` that throws keeps it too: an extra slider costs a line,
  // a missing one breaks the write that follows
  assert.equal(H.needed([{ key: 'A' }], {}).length, 1);
  assert.equal(H.needed([{ key: 'B', when: () => { throw new Error('x'); } }], {}).length, 1);
  assert.equal(H.needed([{ key: 'C', when: false }], {}).length, 0);
});

test('each control kind gets its real match name and parameter', () => {
  const got = H.items([
    { key: 'Amount', value: 10 },
    { key: 'Colour', value: [1, 0, 0, 1], kind: 'color' },
    { key: 'On', value: 1, kind: 'checkbox' },
    { key: 'Angle', value: 45, kind: 'angle' },
    { key: 'Legacy', value: [0, 0, 0, 1], color: true }
  ]);
  assert.deepEqual(got.map((i) => i.matchName), [
    'ADBE Slider Control', 'ADBE Color Control', 'ADBE Checkbox Control', 'ADBE Angle Control', 'ADBE Color Control'
  ]);
  assert.deepEqual(got.map((i) => i.params[0].id), ['Slider', 'Color', 'Checkbox', 'Angle', 'Color']);
  assert.deepEqual(got[0], { key: 'Amount', matchName: 'ADBE Slider Control', before: [], params: [{ id: 'Slider', value: 10, names: ['Slider'] }] });
});

test('an expression reads the holder by name — thisComp in the same comp, comp("…") from inside a pre-comp', () => {
  const c = { key: 'Softness', value: 16 };
  assert.equal(H.read('MOE FX 1 Controls', c), 'thisComp.layer("MOE FX 1 Controls").effect("Softness")("Slider")');
  assert.equal(
    H.read('MOE FX 1 Controls', c, { fromComp: 'My Comp' }),
    'comp("My Comp").layer("MOE FX 1 Controls").effect("Softness")("Slider")'
  );
  // a colour control reads its own parameter
  assert.equal(
    H.read('MOE Click 1 Controls', { key: 'Edge Colour', kind: 'color' }),
    'thisComp.layer("MOE Click 1 Controls").effect("Edge Colour")("Color")'
  );
  // a name with a quote in it stays valid JavaScript
  assert.equal(H.read('A"B', c), 'thisComp.layer("A\\"B").effect("Softness")("Slider")');
});

test('make() queues the null and its controls on the plan, and can parent the parts', () => {
  const steps = [];
  const T = { add(op, args) { steps.push({ op, args }); return { at: (k) => `$ref:s${steps.length - 1}.${k}` }; } };

  const holder = H.make(T, {
    compId: 3,
    name: 'MOE Glass 1 Controls',
    at: [960, 540],
    label: 9,
    label2: 'MOE: Glass',
    args: { rim: false },
    controls: [{ key: 'Frost', value: 20 }, { key: 'Rim', value: 50, when: (a) => !!a.rim }]
  });

  assert.equal(steps[0].op, 'layers.createNull');
  assert.deepEqual(steps[0].args.anchor, steps[0].args.position, 'the holder is at identity');
  assert.equal(steps[1].op, 'effects.ensure');
  assert.deepEqual(steps[1].args.layers[0].items.map((i) => i.key), ['Frost'], 'Rim is off, so its slider is not written');
  assert.deepEqual(holder.controls.map((c) => c.key), ['Frost']);

  holder.parent(['$ref:s9.layerId', null, '$ref:s10.layerId']);
  const par = steps[2];
  assert.equal(par.op, 'layers.setParent');
  assert.equal(par.args.items.length, 2, 'empty ids are dropped');
  assert.equal(par.args.items[0].parentId, holder.layerId);

  // nothing to parent writes no step
  const before = steps.length;
  assert.equal(holder.parent([]), null);
  assert.equal(steps.length, before);
});

test('a holder with no needed controls still exists, and writes no effects step', () => {
  const steps = [];
  const T = { add(op, args) { steps.push({ op, args }); return { at: (k) => `s.${k}` }; } };
  H.make(T, { compId: 1, name: 'MOE Carousel 1', at: [0, 0], args: {}, controls: [{ key: 'X', when: false }] });
  assert.deepEqual(steps.map((s) => s.op), ['layers.createNull']);
});
