'use strict';
/**
 * v0.61 Engine 2 test matrix (the study's §13.5 "comp" row): every library tile is run on the same comp at 25 fps and
 * again at 24, 30 and 60 fps — keys now land on the frame grid, so a tool whose verify counted plan keys could break at
 * one frame rate only. The status must not change with the frame rate, and no tile may leave an undo group open.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { studioComp } = require('./fixtures/studio');
const { TA } = require('./fixtures/layout');
const S = require('../extension/app/ui/studio/sections');

const comp = (fps) => studioComp([
  { name: 'Box', selected: true, transform: TA({ pos: [700, 540] }), rect: { left: -50, top: -50, width: 100, height: 100 } },
  { name: 'Card', selected: true, transform: TA({ pos: [1200, 400] }), rect: { left: -120, top: -40, width: 240, height: 80 } },
  { name: 'Line', selected: true, shapes: [{ name: 'S', stroke: [1, 1, 1], path: [[0, 0], [100, 0]] }], transform: TA({ pos: [960, 800] }) }
], { comp: { time: 1, frameRate: fps } });

const tiles = [];
for (const sec of S.SECTIONS.filter((s) => s.kind === 'library')) for (const t of sec.tiles || []) if (!t.needsInput) tiles.push(Object.assign({ section: sec.id }, t));
// and every registered tool at its own defaults (the Toolbox, the Quick Bar, the Copilot reach them without a tile)
for (const tool of require('../extension/features/index.js').TOOLS || []) if (!(tool.permissions || []).includes('network.ai')) tiles.push({ section: 'tool', id: tool.id, tool: tool.id, args: {} });

test(`every library tile (${tiles.length}) gives the same result at 24 / 30 / 60 fps as at 25, and closes its undo group`, { timeout: 600000 }, async () => {
  const diffs = [];
  for (const t of tiles) {
    const status = {};
    for (const fps of [25, 24, 30, 60]) {
      const { services, env } = await createTestServices(comp(fps));
      const tool = services.registry.get(t.tool);
      if (!tool) { status[fps] = 'missing'; continue; }
      const args = Object.assign({}, Object.fromEntries(Object.entries(tool.params || {}).filter(([, p]) => p.default !== undefined).map(([k, p]) => [k, p.default])), t.args);
      const r = await services.executor.run(t.tool, args, { approved: true }).catch((e) => ({ status: `threw ${e.message}` }));
      status[fps] = r.status;
      if (env.undo.depth !== 0) diffs.push(`${t.section}/${t.id} @ ${fps}: undo group left open`);
    }
    for (const fps of [24, 30, 60]) if (status[fps] !== status[25]) diffs.push(`${t.section}/${t.id}: ${status[25]} at 25 fps, ${status[fps]} at ${fps}`);
  }
  assert.deepEqual(diffs, []);
});
