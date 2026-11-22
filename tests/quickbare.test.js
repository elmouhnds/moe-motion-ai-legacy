'use strict';
/**
 * v1.0.2 MOE Quick, the bare wheel (the owner, in After Effects: "a completely black circle and ring around the
 * wheel ... I do not want it at this thickness").
 *
 * That ring was the pie's own disc. Inside the panel it is a soft backdrop; floating over After Effects it cannot
 * be soft at all — the window is see-through by COLOUR (Win32 colour key, core/platform/hotkeyWin.js), so every
 * fade over the key colour lands as a solid band. So the disc is hidden in the MOE Quick window and each slice
 * becomes one of the panel's own chips.
 *
 * Chips only read as chips if they do not touch, and eight of them do not fit on the panel's 86 px ring: the
 * diagonal neighbours are 66 px apart. This is the geometry that look depends on, so it is checked here against
 * the real numbers: the stylesheet's chip sizes, pie.js's ring, and the window the manifest asks for.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;

const pie = require('../extension/app/ui/pie');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', 'extension', p), 'utf8');
const css = read('css/app.css');
const manifest = read('CSXS/manifest.xml');

const one = (re, what) => { const m = css.match(re); assert.ok(m, `css: ${what}`); return Number(m[1]); };
// the chip: width from the bare rule, height from the slice itself
const CHIP_W = one(/body\.quick \.pie-slot \{[^}]*width: (\d+)px/, 'bare slice width');
const CHIP_H = one(/^\.pie-slot \{[^}]*height: (\d+)px/m, 'slice height');
// the centre chip (the search): the last .pie-slot-free .pie-centre rule that sizes it
const CENTRE = one(/\.pie-centre \{ cursor: default; width: (\d+)px/, 'centre size');

const overlap = (a, b) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
const box = (cx, cy, w, h) => ({ x1: cx - w / 2, x2: cx + w / 2, y1: cy - h / 2, y2: cy + h / 2 });
const chips = () => Array.from({ length: 8 }, (_, i) => {
  const ang = (i * 45 - 90) * Math.PI / 180;
  return box(pie.R_BARE * Math.cos(ang), pie.R_BARE * Math.sin(ang), CHIP_W, CHIP_H);
});

test('v1.0.2 the black ring is gone: MOE Quick draws no disc behind the wheel', () => {
  assert.match(css, /body\.quick \.pie-ring \{ display: none; \}/);
  // and the slice is a real surface instead of a hole in the disc
  assert.match(css, /body\.quick \.pie-slot \{[^}]*background: var\(--bg-raised\)/);
  assert.match(css, /body\.quick \.pie-slot \{[^}]*border: 1px solid var\(--line\)/);
  // no shadow may come back: over the key colour a fade is a solid band, which is what the owner saw first
  assert.match(css, /body\.quick \.pie-slot \{[^}]*box-shadow: none/);
});

test('v1.0.2 the bare chips never touch each other or the search in the middle', () => {
  const c = chips();
  for (let i = 0; i < c.length; i++) {
    for (let j = i + 1; j < c.length; j++) assert.ok(!overlap(c[i], c[j]), `chips ${i + 1} and ${j + 1} overlap`);
    assert.ok(!overlap(c[i], box(0, 0, CENTRE, CENTRE)), `chip ${i + 1} overlaps the centre`);
  }
  // the panel's own ring is too tight for them — this is why the bare wheel has its own
  const tight = Array.from({ length: 8 }, (_, i) => {
    const ang = (i * 45 - 90) * Math.PI / 180;
    return box(pie.R * Math.cos(ang), pie.R * Math.sin(ang), CHIP_W, CHIP_H);
  });
  assert.ok(overlap(tight[0], tight[1]), 'if 86 px ever fits the chips, R_BARE can go');
});

test('v1.0.2 the whole bare wheel fits the window the manifest opens', () => {
  const size = manifest.match(/<Size><Height>(\d+)<\/Height><Width>(\d+)<\/Width><\/Size>/g).pop();
  const [, h, w] = size.match(/<Height>(\d+)<\/Height><Width>(\d+)<\/Width>/).map(Number);
  const cancel = css.match(/body\.quick \.pie-x \{ left: (\d+)px; top: -(\d+)px; \}/);
  assert.ok(cancel, 'css: the cancel moves out with the wider ring');
  const all = chips().concat([box(0, 0, CENTRE, CENTRE), { x1: +cancel[1], x2: +cancel[1] + 28, y1: -cancel[2], y2: -cancel[2] + 28 }]);
  const needX = Math.max(...all.map((b) => Math.max(Math.abs(b.x1), Math.abs(b.x2))));
  const needY = Math.max(...all.map((b) => Math.max(Math.abs(b.y1), Math.abs(b.y2))));
  assert.ok(needX * 2 <= w, `needs ${needX * 2} px across, the window is ${w}`);
  assert.ok(needY * 2 <= h, `needs ${needY * 2} px down, the window is ${h}`);
  // and the cancel is clear of the chips it sits next to
  for (const c of chips()) assert.ok(!overlap(c, all[all.length - 1]), 'the cancel overlaps a chip');
});
