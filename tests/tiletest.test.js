'use strict';
/**
 * v0.98.2 Tile Test (docs/features/TILE_TEST.md): the runner that tests every tile INSIDE After Effects. Here it runs
 * against the mock, so this proves the runner's logic (subjects, selection, classification, cleanup) — not After
 * Effects. The mock has no Edit > Undo by name, so the Undo count is "not checked" here; in After Effects it is real.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { SECTIONS } = require('../extension/app/ui/studio/sections');
const TT = require('../extension/features/selftest/tileRunner');

const pick = (ids) => TT.libraryTiles(SECTIONS).filter((t) => ids.includes(t.id));

test('the Cloner, effectors, ease and Matte FX tiles run on their own subjects and leave nothing behind', async () => {
  const { services, env } = await createTestServices([]);
  const tiles = pick(['globe', 'cloneGlobe', 'efPush', 'efSpring', 'easeSmooth', 'efFreeze']).concat(TT.libraryTiles(SECTIONS).filter((t) => t.tool === 'reveal.fx').slice(0, 2));
  assert.ok(tiles.length >= 6);
  const r = await TT.runTiles(services, tiles);
  for (const t of r.tiles) assert.equal(t.status, 'pass', `${t.tile}: ${t.detail}`);
  assert.equal(env.undo.mismatch || 0, 0, 'no undo group inside another');
  assert.equal(env.project._items.filter((i) => /^MOE (Self-Test|FX|Grid|Click)/.test(i.name)).length, 0, 'no test comp or MOE pre-comp left in the project');
});

test('subjects: a grid tool gets a ready grid, an effector tool an effector, an ease tool selected keys', () => {
  assert.equal(TT.subjectOf({ tool: 'grid.effector', args: {} }), 'grid');
  assert.equal(TT.subjectOf({ tool: 'grid.effectorFreeze', args: {} }), 'effector');
  assert.equal(TT.subjectOf({ tool: 'motion.smartEase', args: {} }), 'keys');
  assert.equal(TT.subjectOf({ tool: 'grid.build', args: { mode: 'sphere' } }), 'cards');
  assert.equal(TT.subjectOf({ tool: 'grid.build', args: { clones: 50 } }), 'card');
  assert.equal(TT.subjectOf({ tool: 'text.animate', args: {} }), 'text');
});

test('a tool that fails is reported with its own error, and the test comp is still removed', async () => {
  const { services, env } = await createTestServices([]);
  const r = await TT.runTiles(services, [{ section: 'x', id: 'bad', label: 'Bad', tool: 'grid.build', args: { mode: 'path' } }, { section: 'x', id: 'none', label: 'None', tool: 'no.such.tool' }]);
  assert.equal(r.tiles[0].status, 'skip');
  assert.equal(r.tiles[1].status, 'fail');
  const left = env.project._items.filter((i) => /^MOE Self-Test/.test(i.name));
  assert.equal(left.length, 0, 'the test comps are removed');
});
