'use strict';
/**
 * v0.6.2 UI stability (the "flicker + clicks ignored" report): renders update the DOM in place,
 * so the element under the mouse is never swapped; handlers stay current; no-op state changes
 * do not render. (Browser-level stress: npm run stress.)
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;
const { h, morph } = require('../extension/app/ui/dom');
const { createState } = require('../extension/app/ui/state');

const view = (n, label, onClick, extra = {}) => h('div', { class: 'app' },
  h('div', { class: 'grid' }, Array.from({ length: n }, (_, i) => h('button', { class: `tile ${i === extra.on ? 'on' : ''}`, 'data-key': `t${i}`, onclick: () => onClick(i) }, `${label} ${i}`))),
  h('input', { class: 'txt', value: extra.q || '' }),
  extra.keyed ? h('canvas', { 'data-key': extra.keyed }) : h('canvas', {}));

test('morph keeps the element under the mouse and updates text, classes and handlers', () => {
  const root = document.getElementById('root');
  const clicks = [];
  root.appendChild(view(4, 'A', (i) => clicks.push(`v1:${i}`)));
  const hovered = root.querySelectorAll('.tile')[2];
  morph(root.firstChild, view(4, 'B', (i) => clicks.push(`v2:${i}`), { on: 2 }));
  const after = root.querySelectorAll('.tile')[2];
  assert.equal(after, hovered, 'same element instance');
  assert.equal(after.textContent, 'B 2');
  assert.ok(after.classList.contains('on'));
  after.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(clicks, ['v2:2'], 'the current handler runs (no stale closure, no double call)');
});

test('morph: keyed children with a new key, form fields and unkeyed canvases are replaced', () => {
  const root = document.getElementById('root');
  root.innerHTML = '';
  root.appendChild(view(3, 'A', () => {}, { keyed: 'thumb-1' }));
  const input = root.querySelector('input'), canvas = root.querySelector('canvas'), t0 = root.querySelector('.tile');
  morph(root.firstChild, view(3, 'A', () => {}, { keyed: 'thumb-1', q: 'x' }));
  assert.notEqual(root.querySelector('input'), input, 'inputs are rebuilt (their own listeners)');
  assert.equal(root.querySelector('canvas'), canvas, 'canvas with the same data-key is kept (animation continues)');
  morph(root.firstChild, view(3, 'A', () => {}, { keyed: 'thumb-2' }));
  assert.notEqual(root.querySelector('canvas'), canvas, 'new thumbnail recipe → new canvas');
  // list shrinks / grows
  morph(root.firstChild, view(1, 'A', () => {}));
  assert.equal(root.querySelectorAll('.tile').length, 1);
  assert.equal(root.querySelector('.tile'), t0);
  morph(root.firstChild, view(5, 'A', () => {}));
  assert.equal(root.querySelectorAll('.tile').length, 5);
});

test('morph removes stale attributes and handlers', () => {
  const a = h('button', { class: 'x', title: 'old', onclick: () => {} });
  const b = h('button', { class: 'y' });
  morph(a, b);
  assert.equal(a.getAttribute('title'), null);
  assert.equal(a.className, 'y');
  assert.equal(a.__onclick, undefined);
});

test('state: setting the same values does not notify (no idle re-renders)', () => {
  const s = createState({ a: 1, ctx: null });
  let n = 0;
  s.sub(() => n++);
  s.set({ a: 1 });
  s.set({ ctx: null });
  s.set(() => ({ a: 1 }));
  assert.equal(n, 0);
  s.set({ a: 2 });
  assert.equal(n, 1);
});

test('CSS: no hover / press style moves or resizes an element (that made icons tremble)', () => {
  const css = require('fs').readFileSync(require('path').resolve(__dirname, '../extension/css/app.css'), 'utf8');
  const bad = [...css.matchAll(/([^{}]*:(?:hover|active)[^{}]*)\{([^}]*)\}/g)].filter(([, sel, body]) => !/::-webkit-slider-thumb/.test(sel) && /transform|translate|scale\(|(?:^|;)\s*(?:flex|width|height|margin|padding|top|left)\s*:/.test(body)).map(([, sel]) => sel.trim());
  assert.deepEqual(bad, []);
  assert.ok(!/backdrop-filter/.test(css), 'backdrop-filter is costly in CEP');
});
