#!/usr/bin/env node
'use strict';
/**
 * v0.99.4 Host profile diff: the profile After Effects returned (Tile Test report `hostProfile`, or the whole
 * tiletest JSON) against the same profile read from the test mock. Every difference is a place where the mock — and
 * so the tests — believe something After Effects does not do.
 *   node tools/compare-profile.js <report.json>
 */
const fs = require('fs');
const path = require('path');
const { createTestServices } = require('../tests/helpers/harness');
const TT = require('../extension/features/selftest/tileRunner');

(async () => {
  const j = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const ae = j.hostProfile || j;
  if (!ae.effects) { console.log('No hostProfile in this file', ae.error || ''); process.exit(1); }
  const { services } = await createTestServices([]);
  const mock = await TT.hostProfile(services.host);
  const byMn = (p) => Object.fromEntries(p.effects.map((e) => [e.matchName, e]));
  const A = byMn(ae), M = byMn(mock);
  let n = 0;
  const say = (s) => { n++; console.log(s); };
  console.log(`After Effects ${ae.appVersion || '?'} vs the test mock — ${ae.effects.length} effects\n`);
  for (const mn of Object.keys(A)) {
    const a = A[mn], m = M[mn];
    if (!a.available) { say(`✗ ${mn}: NOT AVAILABLE in After Effects`); continue; }
    if (!m) { say(`? ${mn}: not modelled in the mock`); continue; }
    if (a.params.length !== m.params.length) say(`✗ ${mn}: ${a.params.length} parameters in After Effects, ${m.params.length} in the mock`);
    a.params.forEach((p, i) => {
      const q = m.params.find((x) => x.matchName === p.matchName);
      const at = m.params[i];
      if (!q) { say(`  ${mn} #${p.i} "${p.name}" (${p.matchName}) — missing in the mock`); return; }
      if (q.name !== p.name) say(`  ${mn} ${p.matchName}: name "${p.name}" in After Effects, "${q.name}" in the mock`);
      if (at && at.matchName !== p.matchName) say(`  ${mn} position ${p.i}: ${p.matchName} in After Effects, ${at.matchName} in the mock`);
      if ((p.min !== undefined || q.min !== undefined) && (p.min !== q.min || p.max !== q.max)) say(`  ${mn} "${p.name}": range ${p.min}..${p.max} in After Effects, ${q.min}..${q.max} in the mock`);
    });
  }
  console.log(n ? `\n${n} difference(s) — each one goes into tests/mock/ae-mock.js before the code is trusted` : 'No differences.');
})();
