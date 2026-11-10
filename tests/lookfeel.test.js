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
  // palettes: still cards — only the stage animates
  // v0.73: each palette is a STILL frame of the real background (paletteCard, still: true) — only the stage animates
  assert.match(src, /require\('\.\.\/paletteCard'\)/);
  assert.match(require('fs').readFileSync(require('path').join(__dirname, '../extension/app/ui/paletteCard.js'), 'utf8'), /\{ still: !moves\(a\) \}/, 'a still look draws once; a moving one plays under the mouse');
  // the stage's canvas is replaced when the look changes (a reused canvas kept drawing the old look)
  assert.match(src, /'data-key': `bgc-canvas\|\$\{\[a\.palette/);
});

test('MOE (Classic) has no banners; composer pages explain themselves with their stage', () => {
  const chrome = require('../extension/app/ui/chrome');
  const mk = (layout) => ({ services: { settings: { get: () => ({ ui: { layout, banners: true } }) }, store: { get: (k, d) => d, set() {} }, registry: { list: () => [] } }, state: { get: () => ({}), set() {} } });
  assert.equal(chrome.banner(mk('moe'), 'expressions'), null);
  assert.equal(chrome.banner(mk('bento'), 'backgrounds'), null);
});

test('Glass is back to its v0.67 look (the v0.68 frost was removed at the owner\'s request); nothing newer than Chromium 99', () => {
  const st = css('styles.css');
  assert.ok(!/gl-drift|--g-frost|--g-blur/.test(st), 'no frost layer in Glass');
  // CEP 12 runs Chromium 99: color-mix(), :has(), container queries and nesting do not exist there
  for (const f of ['app.css', 'styles.css', 'tokens.css']) {
    const c = css(f);
    assert.ok(!/color-mix\(|:has\(|@container|\bcqw\b/.test(c), `${f} uses CSS that Chromium 99 lacks`);
  }
});

test('Glass uses MOE\'s sidebar (every shortcut on the left, no icon row on top); NOW actions and the narrow Anchor header have room', () => {
  const src = fs.readFileSync(path.join(__dirname, '../extension/app/ui/layouts.js'), 'utf8');
  assert.match(src, /if \(layout === 'glass'(?: \|\| layout === 'control')?\) \{\s*parts\.top = parts\.top\.slice\(1\);[^\n]*\n\s*parts\.side = moeRail\(app, s(?:, \{ iconsOnly: layout === 'control' \})?\);/);
  const L = require('../extension/app/ui/layoutGlass');
  const gsrc = fs.readFileSync(path.join(__dirname, '../extension/app/ui/layoutGlass.js'), 'utf8');
  assert.match(gsrc, /top: \[require\('\.\/quickbar'\)\.strip\(app\), AE\.searchBox\(app, s\)\]/, 'the strip Glass builds is the first top item — the one the sidebar replaces');
  assert.ok(L);
  assert.match(css('styles.css'), /\.gl-now-acts \{ margin-top: 12px; \}/);
  assert.match(css('app.css'), /\.kit-anchor\.mini \.kit-cap-row \{ flex-wrap: wrap;/);
});
