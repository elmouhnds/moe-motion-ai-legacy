'use strict';
/** v0.6 Premium UI logic: preset packs, appearance, artwork, banners copy, shapes/background content. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { Registry } = require('../extension/core/registry');
const { registerAll } = require('../extension/features/index');
const { validateArgs, defaults } = require('../extension/core/schema');
const packs = require('../extension/core/presetPacks');
const theme = require('../extension/app/ui/theme');
const art = require('../extension/app/ui/art');
const chrome = require('../extension/app/ui/chrome');
const S = require('../extension/app/ui/studio/sections');
const LIB = require('../extension/features/design/shapesLib');
const E = require('../extension/features/expressions/quick');

const reg = registerAll(new Registry());

test('Preset packs: round-trip; unknown tools, bad args and junk are skipped', () => {
  const saved = [
    { id: 'a', toolId: 'quick.animate', name: 'My slide', args: { kind: 'moveRL', dir: 'in', duration: 0.4 }, tile: 'inRL' },
    { id: 'b', toolId: 'design.background', name: 'Night', args: { palette: 'midnight', style: 'mesh' } }
  ];
  const text = packs.exportPack(saved);
  const r = packs.parsePack(text, reg);
  assert.equal(r.ok, true);
  assert.equal(r.presets.length, 2);
  assert.deepEqual(r.presets[0], { toolId: 'quick.animate', name: 'My slide', args: saved[0].args, tile: 'inRL' });
  const bad = JSON.stringify({ format: 'moe-presets', version: 1, presets: [
    { toolId: 'nope.tool', name: 'x', args: {} },
    { toolId: 'quick.animate', name: 'bad', args: { kind: 'explode' } },
    { toolId: 'quick.animate', name: '', args: {} },
    { toolId: 'quick.animate', name: 'ok', args: { kind: 'fade' } }
  ] });
  const b = packs.parsePack(bad, reg);
  assert.equal(b.presets.length, 1);
  assert.equal(b.skipped.length, 3);
  assert.equal(packs.parsePack('{"format":"other"}', reg).ok, false);
  assert.equal(packs.parsePack('not json', reg).ok, false);
});

test('Appearance: auto follows AE brightness; explicit themes win', () => {
  assert.equal(theme.resolveTheme({ theme: 'auto' }, { red: 50, green: 50, blue: 50 }), 'dark');
  assert.equal(theme.resolveTheme({ theme: 'auto' }, { red: 220, green: 220, blue: 220 }), 'light');
  assert.equal(theme.resolveTheme({ theme: 'midnight' }, { red: 220, green: 220, blue: 220 }), 'midnight');
  assert.equal(theme.resolveTheme({}, null), 'dark');
  assert.equal(theme.ACCENTS.length, 8);
  assert.equal(new Set(theme.ACCENTS.map((a) => a[0])).size, 8);
});

test('Artwork: logo + an illustration for every sidebar section; banners have copy', () => {
  assert.match(art.logo(), /^<svg class="moe-logo"/);
  for (const sec of [...S.SECTIONS, ...S.SECONDARY]) {
    const svg = art.art(sec.id);
    assert.match(svg, /^<svg class="moe-art/, sec.id);
    assert.ok(!/undefined|NaN/.test(svg), `${sec.id} art has undefined/NaN`);
  }
  for (const k of Object.keys(art.EMPTY)) assert.match(art.empty(k), /<svg/);
  const fakeApp = { services: { registry: reg } };
  const n = chrome.counts(fakeApp);
  assert.ok(n.icons >= 1800 && n.expressions === Object.keys(E.PRESETS).length && n.palettes === 36);
  for (const [id, f] of Object.entries(chrome.COPY)) {
    const c = f(n);
    assert.ok(c.kicker && c.title && c.pitch, id);
    for (const [v] of c.stats || []) assert.ok(v !== undefined && !Number.isNaN(v), `${id} stat`);
  }
});

test('Shapes library: every primitive and a sample of icons are valid insertShape args', () => {
  const tool = reg.get('design.insertShape');
  for (const p of LIB.PRIMITIVES) {
    const v = validateArgs(tool.params, Object.assign(defaults(tool.params), { source: 'primitive', primitive: p.id, style: 'fill' }));
    assert.deepEqual(v.errors, [], p.id);
  }
  for (const name of LIB.search('').filter((_, i) => i % 50 === 0)) {
    const v = validateArgs(tool.params, Object.assign(defaults(tool.params), { icon: name }));
    assert.deepEqual(v.errors, [], name);
  }
});

test('Expressions: 33 presets, all tagged, tiles carry their own numbers, every number has a param', () => {
  assert.equal(Object.keys(E.PRESETS).length, 33);
  const tool = reg.get('expressions.quick');
  for (const [id, p] of Object.entries(E.PRESETS)) {
    assert.ok(p.tag, `${id} has no library tag`);
    for (const k of Object.keys(p.nums)) assert.ok(tool.params[k], `${id}: no param for ${k}`);
    const code = E.code(id, p.nums, false);
    assert.ok(code.startsWith('// MOE Expr'), id);
    assert.ok(!/undefined/.test(code), `${id} code has undefined`);
    const live = E.code(id, p.nums, true);
    assert.ok(!/undefined/.test(live), `${id} live code has undefined`);
  }
  const sec = S.byId('expressions');
  const orbit = sec.tiles.find((t) => t.id === 'x-orbit');
  assert.equal(orbit.args.radius, 80);
});

test('NEW badges only mark existing tiles; Home / Shapes are sidebar views', () => {
  const all = S.SECTIONS.flatMap((s) => s.tiles || []);
  assert.ok(all.filter((t) => t.isNew).length >= 28); // v0.29: Gentle Ease left (a copy of Easy Ease)
  assert.equal(S.byId('home').kind, 'view');
  assert.equal(S.byId('shapes').kind, 'view');
  assert.equal(S.sectionOf(reg.get('design.insertShape')), 'shapes');
  assert.equal(S.sectionOf(reg.get('design.colorize')), 'backgrounds');
});
