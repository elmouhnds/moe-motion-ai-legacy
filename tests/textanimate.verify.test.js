'use strict';
/**
 * v1.0.2 — when Animate Text's read-back disagrees with the plan, say WHICH number is off.
 *
 * Measured by hand in After Effects 26.5.3x9 on 2026-11-22 (docs/handoff/reports/RETEST_1.0.md): the Self-Test
 * check "Explode: the Wiggly Selector and its 7 settings" failed, and the whole of what it could tell the owner
 * was:
 *
 *     text.animate: failed — ST Explode: animator read-back mismatch
 *
 * `verify()` had compared three different things — the key times, the number of keys and the number of animator
 * properties — and reported all three failures with the same four words, so there was nothing to act on and no
 * way to tell a hidden animator property (a documented After Effects behaviour, CLAUDE.md "After Effects hides
 * some text-selector settings by context") from a key landing on the wrong frame.
 *
 * `verify` is a pure function of `prepared` and `result`, so this needs no After Effects and no mock.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { animate } = require('../extension/features/text/tools');

const prepared = (over = {}) => Object.assign({
  fd: 1 / 25,
  duration: 1,
  spec: { props: ['ADBE Text Position 3D', 'ADBE Text Opacity', 'ADBE Text Scale 3D'] },
  layers: [{ layerId: 7, startTime: 0 }]
}, over);
const result = (over = {}) => ({
  layers: [Object.assign({
    layerId: 7, name: 'ST Explode', animator: 'MOE In',
    props: 3, keys: 2, firstKey: 0, lastKey: 1,
    wiggly: { set: [1, 2, 3, 4, 5, 6, 7], missing: [] }
  }, over)]
});

test('a missing animator property is named, with the count and the properties wanted', () => {
  const v = animate.verify({ prepared: prepared(), result: result({ props: 2 }) });
  assert.equal(v.ok, false);
  const d = v.checks[0].detail;
  assert.match(d, /2 animator properties, wanted 3/, `read: "${d}"`);
  assert.match(d, /ADBE Text Opacity/, 'and which properties the plan asked for');
});

test('keys on the wrong frame say where they landed and where they belonged', () => {
  const v = animate.verify({ prepared: prepared(), result: result({ firstKey: 0.5, lastKey: 1.5 }) });
  assert.equal(v.ok, false);
  assert.match(v.checks[0].detail, /keys at 0\.50–1\.50 s, wanted 0\.00–1\.00 s/, `read: "${v.checks[0].detail}"`);
});

test('the wrong number of keys on the selector says how many there were', () => {
  const v = animate.verify({ prepared: prepared(), result: result({ keys: 1 }) });
  assert.equal(v.ok, false);
  assert.match(v.checks[0].detail, /1 key\(s\) on the selector, wanted 2/, `read: "${v.checks[0].detail}"`);
});

test('two things wrong at once are both reported', () => {
  const v = animate.verify({ prepared: prepared(), result: result({ props: 1, keys: 3 }) });
  assert.equal(v.ok, false);
  const d = v.checks[0].detail;
  assert.match(d, /3 key\(s\) on the selector/);
  assert.match(d, /1 animator property, wanted 3/);
});

test('a Wiggly Selector whose settings are not found still wins the message, and a good run reads as before', () => {
  const miss = animate.verify({ prepared: prepared(), result: result({ props: 2, wiggly: { set: [1], missing: ['Wiggles/Second'] } }) });
  assert.match(miss.checks[0].detail, /Wiggly Selector: not found by name — Wiggles\/Second/);

  const good = animate.verify({ prepared: prepared(), result: result() });
  assert.equal(good.ok, true);
  assert.match(good.checks[0].detail, /MOE In: 3 properties \+ Wiggly Selector \(7 settings by name\), keys 0\.00–1\.00s/);
});
