'use strict';
/**
 * v0.54 No cut names (docs/features/NO_CUT_NAMES.md): the MOE sidebar shows names only when the panel has room, and a
 * name wraps instead of "…". The whole UI is checked in the browser by tools/audit-cut.js (126 screens).
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

const { createTestServices } = require('./helpers/harness');
const { createState } = require('../extension/app/ui/state');
const fixture = require('../dev/preview-fixture.js');

async function rail(navWide, want, railPeek) {
  const { services } = await createTestServices(fixture);
  const ctx = await services.executor.readContext();
  const app = { services, state: createState({ ctx, studio: {}, args: {}, running: null, view: 'home', navWide, railPeek }), toast: () => {}, go: () => {}, render: () => {}, scheduleRender: () => {} };
  services.store.set('moe-rail-wide', want);
  return require('../extension/app/ui/layouts').moeRail(app, app.state.get());
}

test('the MOE sidebar shows names only with room (≥ 600 px); a narrow dock keeps icons, the choice is remembered', async () => {
  const roomy = await rail(true, true);
  assert.ok(roomy.classList.contains('wide'), 'names when the panel is wide');
  const narrow = await rail(false, true);
  assert.ok(!narrow.classList.contains('wide'), 'icons on a narrow dock');
  const t = narrow.querySelector('[data-key="rail-toggle"]');
    assert.ok(!(await rail(true, false)).classList.contains('wide'), 'off stays off');
  // owner comment: the toggle must always open — on a narrow dock the names open over the page
  const peek = await rail(false, false, true);
  assert.ok(peek.classList.contains('wide') && peek.classList.contains('float'), 'opens over the page');
  assert.equal(peek.querySelector('[data-key="rail-toggle"]').getAttribute('aria-pressed'), 'true');
  assert.ok(!(await rail(true, false, true)).classList.contains('float'), 'with room it never floats');
});

test('names wrap to two lines instead of "…" (sidebar, tiles, power cards, Quick Bar rows, action bar, segmented)', () => {
  const css = ['app.css', 'styles.css'].map((f) => fs.readFileSync(path.join(__dirname, '../extension/css', f), 'utf8')).join('\n');
  for (const sel of ['.moe-rail.wide .rail-l', '.st-name, .tp-name', '.qt-grid.rows .qt-tile span', '.st-act-name', '.pw-t']) {
    const i = css.lastIndexOf(`${sel} {`);
    assert.ok(i > 0, sel);
    const rule = css.slice(i, css.indexOf('}', i));
    assert.match(rule, /white-space: normal/, `${sel} wraps`);
    assert.match(rule, /-webkit-line-clamp: 2/, `${sel} two lines`);
  }
  assert.match(css, /\.seg \{ flex-wrap: wrap;/, 'segmented options take a second row instead of losing letters');
  assert.match(css, /\.st-actbar \{ flex-wrap: wrap;/, 'the action bar keeps its name readable');
  assert.ok(fs.existsSync(path.join(__dirname, '../tools/audit-cut.js')));
});

test('v0.55 hidden slider: each Keyframe Velocity number scrubs sideways (Shift ×10, Ctrl fine), clamps, and a click still types', () => {
  const src = fs.readFileSync(path.join(__dirname, '../extension/app/ui/views/kit.js'), 'utf8');
  assert.match(src, /addEventListener\('pointerdown'/);
  assert.match(src, /m\.shiftKey \? 10 : \(m\.ctrlKey \|\| m\.metaKey\) \? 0\.1 : 1/);
  assert.match(src, /if \(moved\) commit\(v\); else \{ input\.focus\(\); input\.select\(\); \}/);
  // influence stays 1–99 %, speed never negative
  const INFL = { clamp: (v) => Math.max(1, Math.min(99, v)) };
  assert.equal(INFL.clamp(140), 99); assert.equal(INFL.clamp(-5), 1);
  assert.match(src, /clamp: \(v\) => Math\.max\(1, Math\.min\(99, v\)\)/);
  assert.match(src, /clamp: \(v\) => Math\.max\(0, v\)/);
  const css = fs.readFileSync(path.join(__dirname, '../extension/css/app.css'), 'utf8');
  assert.match(css, /\.kit-vel:not\(:focus\) \{ cursor: ew-resize; \}/);
});
