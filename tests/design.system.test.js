'use strict';
/**
 * Design system (v0.23, docs/features/DESIGN_SYSTEM.md): one scale for controls, icons and radii;
 * importance tiers in Classic are well-formed; generic icons come from the bundled Lucide set.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const tokens = fs.readFileSync(path.join(__dirname, '../extension/css/tokens.css'), 'utf8');
const root = tokens.slice(tokens.indexOf(':root {'), tokens.indexOf('}', tokens.indexOf(':root {')));
const tok = (name) => (root.match(new RegExp(`--${name}:\\s*([^;]+);`)) || [])[1];

test('design system: the control, icon, radius and type scales', () => {
  assert.deepEqual(['h-s', 'h-m', 'h-l'].map(tok), ['24px', '28px', '32px']);
  assert.deepEqual(['ic-xs', 'ic-s', 'ic', 'ic-l'].map(tok), ['12px', '14px', '16px', '20px']);
  assert.deepEqual(['r', 'r-lg', 'r-pill'].map(tok), ['6px', '8px', '999px']);
  assert.deepEqual(['fs-sm', 'fs', 'fs-lg', 'fs-xl'].map(tok), ['11px', '12px', '13px', '15px']);
  for (const t of ['bg-elev', 'shadow-1', 'shadow-2']) assert.ok(tok(t), `--${t}`);
  // every theme defines its own elevated surface
  for (const sel of [':root[data-theme="light"]', ':root[data-theme="midnight"]']) {
    const b = tokens.slice(tokens.indexOf(sel), tokens.indexOf('}', tokens.indexOf(sel)));
    assert.match(b, /--bg-elev:\s*#[0-9a-f]{6}/i, sel);
  }
});

test('design system: importance tiers in Classic — primary and minor are parts of the group, never both', () => {
  const AE = require('../extension/app/ui/layoutAE');
  const A = require('../extension/app/ui/actions');
  let heroes = 0;
  for (const t of AE.TABS) {
    for (const g of t.groups) {
      if (!g.hero && !g.minor) continue;
      assert.equal(g.kind, 'acts', `${g.id}: tiers only on action groups`);
      const hero = g.hero || [], minor = g.minor || [];
      assert.ok(hero.length <= 2, `${g.id}: at most two primary actions`);
      [...hero, ...minor].forEach((r) => { assert.ok(g.refs.includes(r), `${g.id}: ${r} is in refs`); assert.ok(A.resolve(r), `${g.id}: ${r} resolves`); });
      assert.ok(hero.every((r) => !minor.includes(r)), `${g.id}: a tool has one tier`);
      // refs list the tiers in reading order: primary first, minor last
      assert.deepEqual(g.refs.slice(0, hero.length), hero, `${g.id}: primary first`);
      if (minor.length) assert.deepEqual(g.refs.slice(-minor.length), minor, `${g.id}: minor last`);
      heroes += hero.length;
    }
  }
  assert.ok(heroes >= 6, 'the everyday actions are marked primary');
});

test('design system: generic icons are generated from the bundled Lucide set', () => {
  const { MAP } = require('../tools/build-ui-icons');
  const ui = require('../extension/app/ui/icons-ui');
  const lucide = require('../extension/assets/icons/lucide.json');
  assert.deepEqual(Object.keys(ui).sort(), Object.keys(MAP).sort(), 'icons-ui.js is up to date (node tools/build-ui-icons.js)');
  for (const [moe, lu] of Object.entries(MAP)) {
    assert.ok(lucide.icons[lu], `${moe} → ${lu} exists in Lucide ${lucide.version}`);
    assert.ok(!/<script|on\w+=/i.test(ui[moe]), `${moe}: plain SVG only`);
  }
});
