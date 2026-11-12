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
  input.dispatchEvent(ev('pointermove', Object.assign({ clientX: 100 + dx, buttons: 1 }, mods))); // v0.80: tracked on the window (the event bubbles there)
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

/* ---- v0.80 drag engine (docs/features/DRAG_ENGINE.md): the whole bar is the handle ---- */
function bar(opts, value = '1') {
  const box = document.createElement('div'); box.setAttribute('data-key', opts.key || 'bar-a');
  Object.defineProperty(box, 'clientHeight', { value: 200, configurable: true }); Object.defineProperty(box, 'clientWidth', { value: 400, configurable: true });
  box.getBoundingClientRect = () => ({ top: 0, left: 0, width: 400, height: 200 });
  const btn = document.createElement('button'); box.appendChild(btn);
  const label = document.createElement('span'); box.appendChild(label);
  const got = { live: [], commit: [] };
  const mount = (v) => { // what a render does: the bar stays, its number is rebuilt
    const old = box.querySelector('input'); if (old) old.remove();
    const input = document.createElement('input'); input.value = v; box.appendChild(input);
    scrub.attach(input, Object.assign({ axis: 'y', span: 140, surface: box, fill: box, step: 0.5, min: 0, max: 10, live: (x) => got.live.push(x), commit: (x) => got.commit.push(x) }, opts));
    return input;
  };
  document.body.appendChild(box);
  return { box, btn, label, got, mount, input: mount(value) };
}
const press = (el, y, x = 50) => el.dispatchEvent(ev('pointerdown', { button: 0, clientX: x, clientY: y, pointerId: 1 }));
const moveTo = (y, mods = {}, x = 50) => window.dispatchEvent(ev('pointermove', Object.assign({ clientX: x, clientY: y, buttons: 1 }, mods)));
const release = () => window.dispatchEvent(ev('pointerup'));

test('v0.80: drag anywhere on the bar — the full range over the bar\'s own height, on the step; the level and the number follow', () => {
  const b = bar({ key: 'bar-1' }, '1');
  press(b.label, 150); moveTo(50); release(); // 100 px up of 200 px = half the range
  assert.deepEqual(b.got.commit, [6]); assert.equal(b.input.value, '6'); assert.equal(b.box.style.getPropertyValue('--p'), '60%');
  assert.ok(b.box.classList.contains('scrub-surface') && !b.box.classList.contains('scrubbing') && !document.documentElement.className.includes('moe-scrub'));
  press(b.box, 100); moveTo(100 + 400); release(); assert.equal(b.got.commit.at(-1), 0, 'clamped to min far below the bar');
  press(b.box, 100); moveTo(60, { ctrlKey: true }); release(); assert.equal(b.got.commit.at(-1), 0.5, 'Ctrl: a quarter of the pace (40 px → 10 px worth)');
  press(b.box, 100); moveTo(90, { shiftKey: true }); release(); assert.equal(b.got.commit.at(-1), 0, 'Shift: steps of 2.5 here (ten steps would be the whole range) — 0.5 more rounds back');
});

test('v0.80: after a render rebuilt the number, the bar drags the number that is on screen now (it used to read the first one)', () => {
  const b = bar({ key: 'bar-2' }, '1');
  press(b.label, 150); moveTo(130); release(); assert.deepEqual(b.got.commit, [2]);
  const fresh = b.mount('2'); // re-render: same bar element, new input
  press(b.label, 150); moveTo(130); release();
  assert.deepEqual(b.got.commit, [2, 3], 'starts from 2 — the value on screen — not from the stale 1');
  assert.equal(fresh.value, '3'); assert.ok(fresh.isConnected && !b.input.isConnected);
  // new limits from a later render are used too
  b.mount('3'); scrub.attach(b.box.querySelector('input'), { axis: 'y', surface: b.box, fill: b.box, step: 1, min: 0, max: 4, commit: (x) => b.got.commit.push(x) });
  press(b.label, 150); moveTo(-500); release(); assert.equal(b.got.commit.at(-1), 4);
});

test('v0.80: a click sets the level there; double-click resets; switches inside the bar and the number keep their clicks; a lost mouse-up still commits; Esc cancels', () => {
  const b = bar({ key: 'bar-3', reset: 2.5 }, '1');
  press(b.box, 50); release(); assert.deepEqual(b.got.commit, [7.5], 'clicked a quarter from the top = 75 %');
  b.box.dispatchEvent(ev('dblclick', {})); assert.equal(b.got.commit.at(-1), 2.5);
  const n = b.got.commit.length;
  press(b.btn, 50); moveTo(0); release(); assert.equal(b.got.commit.length, n, 'a press on a button inside the bar is the button\'s');
  b.btn.dispatchEvent(ev('dblclick', {})); assert.equal(b.got.commit.length, n);
  // the number: a plain click types (no commit); a drag on it uses the bar's scale too
  press(b.input, 150); release(); assert.equal(document.activeElement, b.input); assert.equal(b.got.commit.length, n);
  b.input.blur(); press(b.input, 150); moveTo(130); release(); assert.equal(b.got.commit.at(-1), 3.5, '20 px of 200 = 1 from 2.5');
  // released outside the panel: the next move has no button → commit, and the drag is over
  press(b.box, 150); moveTo(110); window.dispatchEvent(ev('pointermove', { clientX: 50, clientY: 90, buttons: 0 }));
  assert.equal(b.got.commit.at(-1), 5.5); const m = b.got.commit.length; moveTo(10); release(); assert.equal(b.got.commit.length, m, 'nothing follows the pointer after that');
  // the window losing focus ends it the same way
  press(b.box, 150); moveTo(130); window.dispatchEvent(ev('blur', {})); assert.equal(b.got.commit.at(-1), 6.5);
  // Esc: the first value back, no commit
  const k = b.got.commit.length; press(b.box, 150); moveTo(50); document.dispatchEvent(ev('keydown', { key: 'Escape' }));
  assert.equal(b.got.commit.length, k); assert.equal(b.input.value, '6.5'); assert.equal(b.box.style.getPropertyValue('--p'), '65%');
  // a disabled number: the bar does nothing
  b.input.disabled = true; press(b.box, 150); moveTo(50); release(); assert.equal(b.got.commit.length, k);
});

test('v0.80 guard: a canvas that tracks its own drag lets go when the button is already up, the capture is lost or the window blurs', () => {
  const c = document.createElement('div'); document.body.appendChild(c);
  let dragging = false, ended = 0; scrub.guard(c, () => dragging, () => { dragging = false; ended++; });
  c.dispatchEvent(ev('pointermove', { buttons: 0 })); assert.equal(ended, 0, 'not dragging: nothing');
  dragging = true; c.dispatchEvent(ev('pointermove', { buttons: 1 })); assert.equal(ended, 0);
  c.dispatchEvent(ev('pointermove', { buttons: 0 })); assert.equal(ended, 1);
  dragging = true; c.dispatchEvent(ev('lostpointercapture', {})); assert.equal(ended, 2);
  dragging = true; window.dispatchEvent(ev('blur', {})); assert.equal(ended, 3);
});
