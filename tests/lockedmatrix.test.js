'use strict';
/**
 * v0.61 Engine 2 (the study's rule 9 and defect A1: "a locked layer changed with no warning"): every library tile and
 * every registered tool runs with the selected layers LOCKED. Whatever each tool decides (skip, refuse, work on
 * other layers), a locked layer must come out exactly as it went in: keys, values, expressions, effects, name.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { studioComp } = require('./fixtures/studio');
const { TA } = require('./fixtures/layout');
const S = require('../extension/app/ui/studio/sections');

const fixture = () => studioComp([
  { name: 'Box', selected: true, locked: true, transform: TA({ pos: [700, 540] }), rect: { left: -50, top: -50, width: 100, height: 100 } },
  { name: 'Card', selected: true, locked: true, transform: TA({ pos: [1200, 400] }), rect: { left: -120, top: -40, width: 240, height: 80 } },
  { name: 'Line', selected: true, locked: true, shapes: [{ name: 'S', stroke: [1, 1, 1], path: [[0, 0], [100, 0]] }], transform: TA({ pos: [960, 800] }) }
], { comp: { time: 1 } });

/** Everything a tool could change on a layer, as a string. */
function snap(L) {
  const out = [];
  const walk = (n, path) => {
    if (!n) return;
    if (n._keys) out.push(`${path}=${JSON.stringify(n._value)}|${JSON.stringify(n._keys.map((k) => [k.t, k.value]))}|${n._expression || ''}`);
    (n._children || []).forEach((c, i) => walk(c, `${path}/${c.matchName || c.name}#${i}`));
  };
  walk(L.property('ADBE Transform Group'), 'tr');
  walk(L.property('ADBE Effect Parade'), 'fx');
  walk(L.property('ADBE Root Vectors Group'), 'shape');
  return `${L.name}|${L.enabled}|${L.parent ? L.parent.name : ''}|${out.join('\n')}`;
}

const cases = [];
for (const sec of S.SECTIONS.filter((s) => s.kind === 'library')) for (const t of sec.tiles || []) if (!t.needsInput) cases.push({ id: `${sec.id}/${t.id}`, tool: t.tool, args: t.args });
for (const tool of require('../extension/features/index.js').TOOLS) if (!(tool.permissions || []).includes('network.ai')) cases.push({ id: `tool/${tool.id}`, tool: tool.id, args: {} });

test(`a locked layer is never changed — ${cases.length} tiles and tools run on locked layers`, { timeout: 600000 }, async () => {
  const changed = [];
  for (const c of cases) {
    const { services, comp } = await createTestServices(fixture());
    const before = comp._layers.filter((l) => l.locked).map(snap);
    const tool = services.registry.get(c.tool);
    const args = Object.assign(Object.fromEntries(Object.entries(tool.params || {}).filter(([, p]) => p.default !== undefined).map(([k, p]) => [k, p.default])), c.args);
    await services.executor.run(c.tool, args, { approved: true }).catch(() => null);
    const after = comp._layers.filter((l) => before.some((b) => b.startsWith(`${l.name}|`)) && l.locked).map(snap);
    before.forEach((b, i) => { if (b !== after[i]) changed.push(`${c.id}: ${b.split('|')[0]}`); });
  }
  assert.deepEqual(changed, []);
});
