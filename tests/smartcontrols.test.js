'use strict';
/**
 * v0.56 Smart controls (docs/features/SMART_CONTROLS.md): every number field is a hidden slider (app/ui/scrub.js) —
 * drag sideways, ↑ ↓, wheel only while focused, Esc cancels a drag — and a slider's double-click restores its default.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;

const scrub = require('../extension/app/ui/scrub');
const ev = (type, o) => Object.assign(new dom.window.Event(type, { bubbles: true, cancelable: true }), o);

function field(opts, value = '10') {
  const input = document.createElement('input'); input.value = value; document.body.appendChild(input);
  const got = { live: [], commit: [] };
  scrub.attach(input, Object.assign({ step: 1, min: 0, max: 100, live: (v) => got.live.push(v), commit: (v) => got.commit.push(v) }, opts));
  return { input, got };
}
const drag = (input, dx, mods = {}) => {
  input.dispatchEvent(ev('pointerdown', { button: 0, clientX: 100, pointerId: 1 }));
  input.dispatchEvent(ev('pointermove', Object.assign({ clientX: 100 + dx }, mods)));
};

test('drag sideways: ±step a pixel, Shift ×10, Ctrl fine, clamped; release commits once', () => {
  let { input, got } = field({});
  drag(input, 20); input.dispatchEvent(ev('pointerup'));
  assert.equal(got.live.at(-1), 30); assert.deepEqual(got.commit, [30]);
  ({ input, got } = field({}));
  drag(input, 20, { shiftKey: true }); input.dispatchEvent(ev('pointerup'));
  assert.equal(got.commit[0], 100, 'Shift ×10, clamped to max');
  ({ input, got } = field({}));
  drag(input, 20, { ctrlKey: true }); input.dispatchEvent(ev('pointerup'));
  assert.equal(got.commit[0], 12, 'Ctrl fine');
  ({ input, got } = field({}));
  drag(input, -50); input.dispatchEvent(ev('pointerup'));
  assert.equal(got.commit[0], 0, 'clamped to min');
});

test('a click without moving focuses for typing; Esc during a drag puts the first value back and commits nothing', () => {
  let { input, got } = field({});
  input.dispatchEvent(ev('pointerdown', { button: 0, clientX: 100, pointerId: 1 })); input.dispatchEvent(ev('pointerup'));
  assert.equal(document.activeElement, input); assert.deepEqual(got.commit, []);
  ({ input, got } = field({}));
  drag(input, 30);
  document.dispatchEvent(ev('keydown', { key: 'Escape' }));
  assert.equal(input.value, '10'); assert.deepEqual(got.commit, []);
});

test('↑ ↓ step live and commit once after the keys stop; the wheel works only while focused', async () => {
  const { input, got } = field({});
  input.dispatchEvent(ev('keydown', { key: 'ArrowUp' }));
  input.dispatchEvent(ev('keydown', { key: 'ArrowUp', shiftKey: true }));
  assert.equal(input.value, '21');
  await new Promise((r) => setTimeout(r, 450));
  assert.deepEqual(got.commit, [21], 'one commit for a burst of keys (never floods After Effects)');
  input.blur();
  input.dispatchEvent(ev('wheel', { deltaY: -1 }));
  assert.equal(input.value, '21', 'not focused: the page scrolls, the value stays');
  input.focus();
  input.dispatchEvent(ev('wheel', { deltaY: -1 }));
  assert.equal(input.value, '22');
});

test('every Inspector number is scrubbable and a slider double-click restores the default', () => {
  const form = require('../extension/app/ui/form');
  const set = [];
  const make = form.control || form.render || null;
  const src = require('fs').readFileSync(require('path').join(__dirname, '../extension/app/ui/form.js'), 'utf8');
  assert.match(src, /require\('\.\/scrub'\)\.attach\(num/);
  assert.match(src, /range\.addEventListener\('dblclick'/);
  if (typeof make === 'function') {
    const row = make('dur', { type: 'number', label: 'Duration', min: 0.1, max: 4, step: 0.05, default: 0.7 }, 1.5, (v) => set.push(v));
    const range = row.querySelector('input[type=range]'), num = row.querySelector('input.num');
    assert.ok(num.classList.contains('scrubbable'));
    range.dispatchEvent(ev('dblclick'));
    assert.deepEqual(set, [0.7]); assert.equal(Number(num.value), 0.7);
  }
});
