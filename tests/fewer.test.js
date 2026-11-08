'use strict';
/**
 * v0.29 — Fewer, clearer (docs/features/FEWER_CLEARER.md): one source per preset, no copies between the
 * Quick Bar, the Motion Kit and the libraries; three styles only; old saved ids keep working.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../extension/features/quick/bar');
const qb = require('../extension/app/ui/quickbar');
const A = require('../extension/app/ui/actions');
const studio = require('../extension/app/ui/studio/sections');

const memStore = (data = {}) => ({ data, get: (k, f) => (k in data ? JSON.parse(JSON.stringify(data[k])) : f), set: (k, v) => { data[k] = v; }, update: (k, f, fn) => { data[k] = fn(k in data ? data[k] : f); } });
const sameCall = (a, b) => a.tool === b.tool && JSON.stringify(Object.keys(a.args || {}).sort().map((k) => [k, a.args[k]])) === JSON.stringify(Object.keys(b.args || {}).sort().map((k) => [k, b.args[k]]));

test('no Quick action is a copy of a library tile or of another Quick action', () => {
  const tiles = studio.SECTIONS.filter((x) => x.kind === 'library').flatMap((sec) => sec.tiles.filter((t) => t.tool).map((t) => Object.assign({ sec: sec.id }, t)));
  for (const a of qb.ACTIONS) {
    const twin = tiles.find((t) => sameCall(a, t));
    assert.equal(twin, undefined, `${a.id} duplicates tile ${twin && `${twin.sec}/${twin.id}`}`);
    const other = qb.ACTIONS.find((b) => b !== a && sameCall(a, b));
    assert.equal(other, undefined, `${a.id} duplicates ${other && other.id}`);
  }
  // v0.44 (FIND_FAST): + 16 Select filters and 9 text animators — each a distinct call (checked above), not a copy
  assert.ok(qb.ACTIONS.length <= 70, `Quick actions: ${qb.ACTIONS.length} (were 80 in v0.28, 45 after v0.29 + 25 in v0.44)`);
});

test('old ids keep working: saved bars, pins, pie and recent refs migrate to the tile (or the kept action)', () => {
  for (const [old, to] of Object.entries(B.MIGRATE)) {
    const a = qb.byId(old);
    assert.ok(a, `${old} resolves`);
    assert.equal(a.id, to, `${old} → ${to}`);
    assert.ok(A.resolve(`quick:${old}`), `quick:${old} resolves for the pie / NOW`);
    if (to.indexOf('tile:') === 0) assert.ok(studio.byId(to.slice(5).split('/')[0]).tiles.some((t) => t.id === to.split('/')[1]), `${to} exists`);
  }
  assert.equal(A.resolve('quick:fadeIn').id, 'tile:animate/fadeIn');
  assert.equal(A.resolve('quick:k_wiggle').id, 'tile:expressions/x-wiggle');
  // a saved bar with old and new ids for the same thing shows it once
  const app = { services: { store: memStore({ 'quick-bar': ['inRL', 'tile:animate/inRL', 'x_wiggle', 'k_wiggle', 'ease', 'k_easy', 'gone'] }) }, render() {} };
  assert.deepEqual(qb.barIds(app), ['tile:animate/inRL', 'tile:expressions/x-wiggle', 'k_easy']);
  // pin / unpin a tile from its library page
  qb.togglePin(app, 'tile:animate/popIn');
  assert.ok(qb.barIds(app).includes('tile:animate/popIn'));
  qb.togglePin(app, 'scaleUp'); // the old id of the same preset unpins it
  assert.ok(!qb.barIds(app).includes('tile:animate/popIn'));
  assert.equal(qb.byId(undefined), null);
});

test('tile buttons on the bar run the tile itself (its tool, numbers, label, icon)', () => {
  const { PRESETS } = require('../extension/features/expressions/quick');
  const w = qb.byId('tile:expressions/x-wiggle');
  assert.equal(w.tool, 'expressions.quick');
  assert.equal(w.args.preset, 'wiggle');
  assert.equal(w.args.freq, PRESETS.wiggle.nums.freq);
  assert.equal(w.icon, PRESETS.wiggle.icon);
  const f = qb.byId('tile:animate/fadeIn');
  const tile = studio.byId('animate').tiles.find((t) => t.id === 'fadeIn');
  assert.deepEqual(f.args, tile.args);
  assert.equal(f.label, tile.label);
  B.DEFAULT_BAR.forEach((id) => assert.ok(qb.byId(id), id));
});

test('Motion Kit rigs keep only what only they do; Keying shows Key Setup, Generate on Green stays in its library', () => {
  const rigs = B.KIT_GROUPS.find(([n]) => n === 'Motion rigs')[1];
  assert.deepEqual(rigs, ['k_excite', 'k_delay', 'k_jump', 'k_stare', 'k_repeat']);
  B.KIT_TOOLS.forEach((id) => assert.ok(qb.byId(id), id));
  const AE = require('../extension/app/ui/layoutAE');
  // v0.31: Keying + Color Correction are one "Key & Color" group, Key Setup first (the job's order)
  const keying = AE.TABS.find((t) => t.id === 'ae-effect').groups.find((g) => g.id === 'keycolor');
  assert.equal(keying.ids[0], 'c-compositing.keySetup');
  assert.ok(!keying.ids.some((id) => /generate/.test(id)));
  assert.ok(studio.byId('compositing').tiles.some((t) => /generate/.test(t.id)), 'still one search / "All" away');
});

test('three styles, one render path; the retired styles and Smart Home are gone from the code', () => {
  const fs = require('fs');
  const path = require('path');
  const L = require('../extension/app/ui/layouts');
  assert.deepEqual(L.LAYOUTS.map((x) => x.id), ['bento', 'glass', 'moe', 'control']);
  const shell = fs.readFileSync(path.join(__dirname, '../extension/app/ui/shell.js'), 'utf8');
  assert.ok(!/class: 'sidebar'/.test(shell), 'the Sidebar layout render is gone');
  assert.match(shell, /RETIRED\.includes\(services\.settings\.get\(\)\.ui\.layout\)/, 'a retired style is moved to Bento at start-up');
  const layouts = fs.readFileSync(path.join(__dirname, '../extension/app/ui/layouts.js'), 'utf8');
  assert.ok(!/function (hub|bar|workspace)\(/.test(layouts));
  assert.ok(!fs.existsSync(path.join(__dirname, '../extension/app/ui/layoutApple.js')));
  assert.ok(!fs.existsSync(path.join(__dirname, '../extension/app/ui/views/home.js')));
  const copilot = require('../extension/app/ui/copilot');
  assert.equal(copilot.render, undefined, 'the old Copilot bar is gone (the Assistant shows the steps)');
  const expr = fs.readFileSync(path.join(__dirname, '../extension/app/ui/views/expressions.js'), 'utf8');
  assert.ok(!/'One-click'/.test(expr), 'the Expressions page no longer repeats its own tiles');
  const bento = fs.readFileSync(path.join(__dirname, '../extension/app/ui/layoutBento.js'), 'utf8');
  assert.match(bento, /AE\.controlTop\(app, kind\)/, 'NOW leads with the Motion Control (v0.30)');
});
