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

test('search palette: hovering a result keeps the row (no rebuild), so a mouse click runs it', () => {
  const palette = require('../extension/app/ui/palette');
  const ran = [];
  const tools = ['a', 'b', 'c'].map((id) => ({ id, name: `Tool ${id}`, description: 'd', icon: 'tools', category: 'motion' }));
  const app = { services: { registry: { search: () => tools }, recipes: { list: () => [] } }, openTool: (t) => ran.push(t.id), go: () => {}, refreshContext: () => {}, openCopilot: () => {} };
  palette.open(app);
  const rows = () => [...document.querySelectorAll('.pal-item')];
  const target = rows()[1];
  target.dispatchEvent(new window.MouseEvent('mouseenter'));
  assert.equal(rows()[1], target, 'row under the pointer is the same element after hover');
  assert.equal(target.getAttribute('aria-selected'), 'true');
  assert.equal(rows()[0].getAttribute('aria-selected'), 'false');
  target.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(ran, ['b']);
  assert.equal(app.paletteOpen, false);
});

test('search palette lists every sidebar section', () => {
  const palette = require('../extension/app/ui/palette');
  const studio = require('../extension/app/ui/studio/sections');
  const app = { services: { registry: { search: () => [] }, recipes: { list: () => [] } }, go: () => {}, refreshContext: () => {}, openCopilot: () => {} };
  const ids = palette.results(app, '').filter((x) => x.kind === 'nav').map((x) => x.id);
  for (const s of [...studio.SECTIONS, ...studio.SECONDARY]) assert.ok(ids.includes(s.id), s.id);
});

test('animated previews: the first paint is the still frame (never a random moment)', async () => {
  const widgets = require('../extension/app/ui/widgets');
  const calls = [];
  const c = document.createElement('canvas');
  document.body.appendChild(c);
  widgets.animated(c, (now) => calls.push(now));
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(calls[0], null);
});

test('morph keeps a kept canvas drawn (width/height are not stripped, which would clear it)', () => {
  const mk = (key) => { const c = document.createElement('canvas'); c.setAttribute('data-key', key); return c; };
  const box = (c) => { const d = document.createElement('div'); d.appendChild(c); return d; };
  const a = box(mk('thumb-a'));
  a.firstChild.width = 240; a.firstChild.height = 148; // set by the drawer (devicePixelRatio size)
  morph(a, box(mk('thumb-a')));
  assert.equal(a.firstChild.getAttribute('width'), '240');
  assert.equal(a.firstChild.getAttribute('height'), '148');
});

test('morph: an old data-fresh element is replaced, never patched into a different element (v0.13 graph grip bug)', () => {
  const root = document.createElement('div');
  const grip = h('div', { class: 'grip' }); grip.setAttribute('data-fresh', '');
  let grabbed = 0;
  grip.addEventListener('pointerdown', () => { grabbed++; });
  root.appendChild(h('div', {}, h('div', { class: 'seg' }), grip));
  // next render: the same positions now hold two plain cells
  morph(root.firstChild, h('div', {}, h('div', { class: 'cell' }), h('div', { class: 'cell' })));
  const cells = root.firstChild.children;
  assert.equal(cells[1].className, 'cell');
  assert.notEqual(cells[1], grip, 'the grip element was replaced, not reused');
  cells[1].dispatchEvent(new window.Event('pointerdown'));
  assert.equal(grabbed, 0, 'the cell does not carry the old grip listener');
});
