'use strict';
/**
 * v0.40 — Self-Test inside After Effects (docs/features/SELF_TEST.md). Here the "After Effects" is tests/mock, so
 * these tests prove the RUNNER: it makes and removes its own comp, leaves the user's comp exactly as it was, runs
 * every check against the reference maths, undoes every tool, and reports a real mismatch as a failure.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { TA } = require('./fixtures/layout');
const { studioComp } = require('./fixtures/studio');
const { runSelfTest, CHECKS } = require('../extension/features/selftest/runner');
const EF = require('../extension/features/grid/effectors');

async function userProject() {
  const r = await createTestServices(studioComp([{ name: 'My Logo', transform: TA({ pos: [400, 300] }) }, { name: 'My Title', text: 'Hello', transform: TA({ pos: [960, 800] }) }], { comp: { name: 'My Comp' } }));
  r.comp._project.activeItem = r.comp;
  return r;
}
const snapshot = (comp) => comp._layers.map((l) => `${l.name}|${l.enabled}|${l.property('ADBE Transform Group').property('ADBE Position').value.join(',')}`).join(';');

test('every check runs in its own comp and passes on the mock; the comp is removed and yours is active and untouched', async () => {
  const { services, comp } = await userProject();
  const before = snapshot(comp), items0 = comp._project._items.length;
  const seen = [];
  const report = await runSelfTest(services, { onProgress: (c) => seen.push(c.id) });
  const bad = report.checks.filter((c) => c.status === 'fail');
  assert.equal(bad.length, 0, `failed: ${bad.map((c) => `${c.id}: ${c.detail}`).join(' | ')}`);
  assert.deepEqual(seen, CHECKS.map((c) => c.id), 'every check ran, in order');
  assert.ok(report.checks.every((c) => typeof c.ms === 'number' && c.detail), 'each has a time and a detail');
  assert.match(String(report.cleanup.removed), /^MOE Self-Test /, 'the test comp was removed');
  assert.equal(report.cleanup.reopened, true);
  assert.equal(comp._project.activeItem, comp, 'your comp is active again');
  assert.equal(comp._project._items.length, items0, 'no project items left behind');
  assert.equal(snapshot(comp), before, 'your comp is exactly as it was');
  assert.deepEqual(report.totals, { pass: report.checks.filter((c) => c.status === 'pass').length, fail: 0, info: report.checks.filter((c) => c.status === 'info').length, skip: 0 });
  // the report is plain data, ready to copy
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(report)));
});

test('a real mismatch is reported as a failure (a fault injected in the reference maths), and cleanup still runs', async () => {
  const { services, comp } = await userProject();
  const real = EF.applyAt;
  EF.applyAt = (...a) => { const r = real(...a); return Object.assign({}, r, { scaleMul: r.scaleMul + 0.1 }); };
  let report;
  try { report = await runSelfTest(services, { only: ['effector'] }); } finally { EF.applyAt = real; }
  assert.equal(report.checks.length, 1);
  assert.equal(report.checks[0].status, 'fail', report.checks[0].detail);
  assert.ok(report.checks[0].numbers.worst >= 9.9, `worst ${report.checks[0].numbers.worst} %`);
  assert.equal(comp._project.activeItem, comp);
  assert.ok(!comp._project._items.some((it) => /^MOE Self-Test/.test(it.name)), 'removed even after a failure');
});

test('a check that throws is a failure with its message; the others still run', async () => {
  const { services } = await userProject();
  const real = services.executor.run;
  services.executor.run = async (id, ...rest) => (id === 'grid.colour' ? { status: 'failed', errors: ['simulated: Fill not available'] } : real(id, ...rest));
  let report;
  try { report = await runSelfTest(services, { only: ['grid', 'colours', 'points'] }); } finally { services.executor.run = real; }
  const by = Object.fromEntries(report.checks.map((c) => [c.id, c]));
  assert.equal(by.colours.status, 'fail');
  assert.match(by.colours.detail, /simulated: Fill not available/);
  assert.equal(by.grid.status, 'pass');
  assert.equal(by.points.status, 'pass', by.points.detail);
});

test('Diagnostics shows "Check in After Effects" with what it does before you run it', () => {
  const D = require('../extension/app/ui/views/diagnostics');
  assert.equal(typeof D.selfTestCard, 'function');
  assert.ok(CHECKS.length >= 12 && CHECKS.every((c) => c.id && c.label && typeof c.run === 'function'));
});
