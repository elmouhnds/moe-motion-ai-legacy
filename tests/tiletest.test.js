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
  const r = await TT.runTiles(services, [{ section: 'x', id: 'bad', label: 'Bad', tool: 'grid.build', args: { mode: 'path' }, subject: 'card' }, { section: 'x', id: 'none', label: 'None', tool: 'no.such.tool' }]);
  assert.equal(r.tiles[0].status, 'skip');
  assert.equal(r.tiles[1].status, 'fail');
  const left = env.project._items.filter((i) => /^MOE Self-Test/.test(i.name));
  assert.equal(left.length, 0, 'the test comps are removed');
});

test('v0.99.4: the subjects the first runs lacked — path, field, sound, green screen, property, two layers, follow — run, and leave nothing in the project', async () => {
  const { services, env } = await createTestServices([]);
  const ids = ['path', 'clonePoints', 'efImage', 'efBeat', 'efProperty', 'split2', 'c-compositing.keySetup', 'follow', 'trailEcho'];
  const tiles = TT.libraryTiles(SECTIONS).filter((t) => ids.includes(t.id));
  assert.equal(tiles.length, ids.length);
  const r = await TT.runTiles(services, tiles);
  for (const t of r.tiles) assert.equal(t.status, 'pass', `${t.tile}: ${t.detail}`);
  assert.equal(env.project._items.filter((i) => /beat\.wav|green-screen\.png|^MOE Self-Test/.test(i.name)).length, 0, 'test files and comps removed');
  assert.ok(r.hostProfile && r.hostProfile.effects.length === TT.PROFILE_EFFECTS.length, 'host profile read');
  assert.ok(r.hostProfile.effects.find((e) => e.matchName === 'ADBE Gradient Wipe').params[0].max === 1, 'ranges read');
});

/**
 * v0.99.6 (Group 8 manual test, measured in After Effects 26.5.3): After Effects sometimes IGNORES Edit > Undo run
 * from a script — the command is found by its own menu text, executed, and nothing at all changes (measured: four
 * presses inside one host call, no change). The same tile then passed a moment later, so the tool was never at
 * fault. The runner must say the undo rule was not measured, never report the tool as failing to undo.
 */
test('v0.99.6: a real Edit > Undo is counted; an Undo After Effects refuses is reported as not measured, not as a failed undo', async () => {
  const tiles = pick(['mtIris']);
  assert.equal(tiles.length, 1);

  // 1. Edit > Undo works: one press takes the whole run back and the tile passes with ONE press counted
  const ok = await createTestServices([]);
  ok.env.undo.menu = true;
  const r1 = await TT.runTiles(ok.services, tiles);
  assert.equal(r1.tiles[0].status, 'pass', r1.tiles[0].detail);
  assert.equal(r1.tiles[0].undo.presses, 1, 'one Ctrl+Z was counted');
  assert.equal(r1.tiles[0].undo.back, true);
  assert.equal(r1.totals.undoUnchecked, 0);

  // 2. After Effects refuses the Undo (the command runs, nothing changes): the tile still passes, and the report
  //    says the undo was not measured instead of blaming the tool
  const no = await createTestServices([]);
  no.env.undo.menu = true;
  no.env.undo.refuse = true;
  const r2 = await TT.runTiles(no.services, tiles);
  const row = r2.tiles[0];
  assert.equal(row.status, 'pass', row.detail);
  assert.equal(row.undo.stuck, true, 'the refused press is recorded as stuck');
  assert.equal(row.undo.presses, 0, 'a press that changed nothing is not counted as a Ctrl+Z');
  assert.match(row.detail, /Undo not checked \(the Edit > Undo press changed nothing\)/);
  assert.equal(r2.totals.undoUnchecked, 1, 'the report counts what could not be measured');
  assert.ok(!/did not bring it back/.test(row.detail), 'the tool is not blamed for After Effects refusing the Undo');
});
