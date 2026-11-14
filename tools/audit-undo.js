'use strict';
/**
 * v0.94 (docs/features/ONE_UNDO.md): how many Ctrl+Z each library tile and each tool really takes in After Effects.
 * Runs every tile on the test mock, which now behaves like After Effects (an undo group closes when its script
 * returns; a write outside any group is its own step). Prints the tiles that take more than one step, worst first.
 *   node tools/audit-undo.js            summary + the multi-step list
 *   node tools/audit-undo.js --json     everything as JSON
 */
const { createTestServices } = require('../tests/helpers/harness');
const { studioComp } = require('../tests/fixtures/studio');
const { TA } = require('../tests/fixtures/layout');
const S = require('../extension/app/ui/studio/sections');

const comp = () => studioComp([
  { name: 'Box', selected: true, transform: TA({ pos: [700, 540] }), rect: { left: -50, top: -50, width: 100, height: 100 } },
  { name: 'Card', selected: true, transform: TA({ pos: [1200, 400] }), rect: { left: -120, top: -40, width: 240, height: 80 } },
  { name: 'Line', selected: true, shapes: [{ name: 'S', stroke: [1, 1, 1], path: [[0, 0], [100, 0]] }], transform: TA({ pos: [960, 800] }) }
], { comp: { time: 1, frameRate: 25 } });

const MEASURE = /^MOE: (Measure \(temporary\)|Measure Text|Analyze \(temporary\))$/;
(async () => {
  const tiles = [];
  for (const sec of S.SECTIONS.filter((s) => s.kind === 'library')) for (const t of sec.tiles || []) if (!t.needsInput) tiles.push(Object.assign({ section: sec.id }, t));
  const out = [], mismatch = [];
  for (const t of tiles) {
    const { services, env } = await createTestServices(comp());
    const tool = services.registry.get(t.tool);
    if (!tool) continue;
    const args = Object.assign({}, Object.fromEntries(Object.entries(tool.params || {}).filter(([, p]) => p.default !== undefined).map(([k, p]) => [k, p.default])), t.args);
    const e0 = env.undo.entries.length;
    const r = await services.executor.run(t.tool, args, { approved: true }).catch((e) => ({ status: `threw ${e.message}` }));
    if (env.undo.mismatch) mismatch.push(`${t.section}/${t.id} ×${env.undo.mismatch}`);
    if (r.status !== 'success' && r.status !== 'partial') continue; // not runnable on this fixture
    const steps = env.undo.entries.slice(e0);
    // a measuring step makes a temporary probe / comp and removes it inside the same undo group: it changes nothing
    const measure = steps.filter((e) => MEASURE.test(e)).length;
    out.push({ tile: `${t.section}/${t.id}`, label: t.label, tool: t.tool, steps: steps.length - measure, measure, ungrouped: steps.filter((e) => /^\(no undo group\)/.test(e)).length, names: steps });
  }
  out.sort((a, b) => b.steps - a.steps);
  if (process.argv.includes('--json')) { console.log(JSON.stringify(out, null, 1)); return; }
  const one = out.filter((o) => o.steps <= 1).length, many = out.filter((o) => o.steps > 1), loose = out.filter((o) => o.ungrouped);
  console.log(`undo group mismatches (After Effects warns on each): ${mismatch.length ? mismatch.join(', ') : 0}`);
  console.log(`${out.length} tiles ran · one Ctrl+Z: ${one} (of them ${out.filter((o) => o.steps <= 1 && o.measure).length} also have measure step(s) that change nothing) · more than one: ${many.length} · a write with no undo group: ${loose.length}`);
  const byTool = new Map();
  for (const o of many) { const k = o.tool; if (!byTool.has(k)) byTool.set(k, { tool: k, tiles: 0, max: 0, example: o }); const b = byTool.get(k); b.tiles++; if (o.steps > b.max) { b.max = o.steps; b.example = o; } }
  for (const b of [...byTool.values()].sort((x, y) => y.max - x.max)) console.log(`  ${String(b.max).padStart(3)} steps · ${b.tool} (${b.tiles} tile${b.tiles > 1 ? 's' : ''}) e.g. ${b.example.label}: ${b.example.names.join(' › ')}`);
})().catch((e) => { console.error(e); process.exit(1); });
