'use strict';
/**
 * v0.61 (docs/features/ENGINE2.md): every tile and tool on 3 and on 30 selected layers — prints the tools whose host
 * round trips grow with the layer count (each round trip is a CEP evalScript in After Effects). Run: node tools/scan-roundtrips.js
 */
const { createTestServices } = require('../tests/helpers/harness');
const { studioComp } = require('../tests/fixtures/studio');
const { TA } = require('../tests/fixtures/layout');
const S = require('../extension/app/ui/studio/sections');
const mk = (n) => studioComp(Array.from({ length: n }, (_, i) => ({ name: `L${i}`, selected: true, transform: TA({ pos: [100 + (i % 10) * 170, 100 + Math.floor(i / 10) * 150] }), rect: { left: -40, top: -40, width: 80, height: 80 } })), { comp: { time: 1 } });
(async () => {
  const seen = new Set(), out = [];
  const cases = [];
  for (const sec of S.SECTIONS.filter((s) => s.kind === 'library')) for (const t of sec.tiles || []) if (!t.needsInput && !seen.has(t.tool + JSON.stringify(t.args))) { seen.add(t.tool + JSON.stringify(t.args)); cases.push([t.tool, t.args]); }
  for (const tool of require('../extension/features/index.js').TOOLS) cases.push([tool.id, {}]);
  const byTool = {};
  for (const [id, a] of cases) {
    const res = [];
    for (const n of [3, 30]) {
      const { services } = await createTestServices(mk(n));
      const tool = services.registry.get(id);
      if ((tool.permissions || []).includes('network.ai')) break;
      const args = Object.assign(Object.fromEntries(Object.entries(tool.params || {}).filter(([, p]) => p.default !== undefined).map(([k, p]) => [k, p.default])), a);
      const real = services.host.call.bind(services.host); let c = 0; const ops = {};
      services.host.call = (op, x, o) => { c++; ops[op] = (ops[op] || 0) + 1; return real(op, x, o); };
      const r = await services.executor.run(id, args, { approved: true }).catch(() => ({ status: 'threw' }));
      res.push({ n, c, ops, status: r.status });
    }
    if (res.length === 2 && res[1].status === 'success' && res[1].c > res[0].c + 4) {
      const grow = Object.keys(res[1].ops).filter((k) => (res[1].ops[k] || 0) > (res[0].ops[k] || 0) + 2).map((k) => `${k} ${res[0].ops[k] || 0}→${res[1].ops[k]}`);
      if (!byTool[id] || byTool[id].c < res[1].c) byTool[id] = { c: res[1].c, c3: res[0].c, grow };
    }
  }
  Object.entries(byTool).sort((a, b) => b[1].c - a[1].c).forEach(([id, v]) => console.log(id.padEnd(26), `${v.c3} → ${v.c} calls`, v.grow.join(', ')));
})();
