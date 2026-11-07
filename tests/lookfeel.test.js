'use strict';
/* v0.68 (docs/features/LOOK_AND_FEEL.md): Background Composer, frosted Glass, no banners in MOE. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const BC = require('../extension/app/ui/studio/bgComposer');
const S = require('../extension/app/ui/studio/sections');
const css = (f) => fs.readFileSync(path.join(__dirname, '../extension/css', f), 'utf8');

test('Background Composer: a plain palette swaps only the colours (your style and motion stay); a designed look takes all of it', () => {
  const sec = S.byId('backgrounds');
  assert.equal(sec.composer, 'background');
  const cur = { palette: 'tomato', style: 'mesh', motion: 'orbit', colorMotion: 'cycle', grain: 6, loop: 10 };
  const plain = sec.tiles.find((t) => !BC.fullLook(t));
  const look = sec.tiles.find((t) => BC.fullLook(t));
  assert.ok(plain && look, 'the library has both kinds');
  const a = BC.nextArgs(cur, plain);
  assert.equal(a.palette, plain.args.palette);
  assert.deepEqual([a.style, a.motion, a.colorMotion, a.grain, a.loop], ['mesh', 'orbit', 'cycle', 6, 10]);
  const b = BC.nextArgs(cur, look);
  for (const [k, v] of Object.entries(look.args)) assert.deepEqual(b[k], v, k);
  assert.ok(BC.fullLook({ user: true, tags: [] }), 'your own presets are complete looks');
  // the composer shows Style / Motion / Colours itself: Fine-tune lists only the rest, without the second preview
  const src = fs.readFileSync(path.join(__dirname, '../extension/app/ui/studio/bgComposer.js'), 'utf8');
  assert.match(src, /hide: \['palette', 'style', 'motion', 'colorMotion'\], noBody: true/);
  // palettes are light colour strips — only the stage animates (no canvas per palette)
  assert.ok(!/h\('canvas'[^)]*bgc-pal/.test(src) && /bgc-bars/.test(src));
  // the stage's canvas is replaced when the look changes (a reused canvas kept drawing the old look)
  assert.match(src, /'data-key': `bgc-canvas\|\$\{\[a\.palette/);
});

test('MOE (Classic) has no banners; composer pages explain themselves with their stage', () => {
  const chrome = require('../extension/app/ui/chrome');
  const mk = (layout) => ({ services: { settings: { get: () => ({ ui: { layout, banners: true } }) }, store: { get: (k, d) => d, set() {} }, registry: { list: () => [] } }, state: { get: () => ({}), set() {} } });
  assert.equal(chrome.banner(mk('moe'), 'expressions'), null);
  assert.equal(chrome.banner(mk('bento'), 'backgrounds'), null);
});

test('Frosted Glass: blur + rim + grain on the cards, light behind them, honours "frost off" and reduced motion; nothing newer than Chromium 99', () => {
  const st = css('styles.css');
  assert.match(st, /\.app\.layout-glass::before \{[\s\S]*filter: blur\(46px\)/);
  assert.match(st, /--g-blur: blur\(22px\) saturate\(165%\)/);
  assert.match(st, /backdrop-filter: var\(--g-blur\)/);
  assert.match(st, /@media \(prefers-reduced-motion: no-preference\) \{\s*\.app\.layout-glass::before \{ animation: gl-drift/);
  assert.match(st, /:root\[data-glass-blur="off"\] \.app\.layout-glass::before \{ animation: none/);
  // CEP 12 runs Chromium 99: color-mix(), :has(), container queries and nesting do not exist there
  for (const f of ['app.css', 'styles.css', 'tokens.css']) {
    const c = css(f);
    assert.ok(!/color-mix\(|:has\(|@container|\bcqw\b/.test(c), `${f} uses CSS that Chromium 99 lacks`);
  }
});
