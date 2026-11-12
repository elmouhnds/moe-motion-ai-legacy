'use strict';
/**
 * v0.30 — Motion Control (docs/features/MOTION_CONTROL.md): Ease Copy (copy the ease of the selected keys
 * segment by segment, paste it on other keys / properties), one control block for keys + anchor + align,
 * and the "Next" steps that follow a run.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { TA } = require('./fixtures/layout');
const { studioComp } = require('./fixtures/studio');
const C = require('../extension/features/curves/tools');
const W = require('../extension/app/ui/workflow');
const A = require('../extension/app/ui/actions');

const tp = (L, mn) => L.property('ADBE Transform Group').property(mn);
const named = (comp, n) => comp._layers.find((l) => l.name === n);
function keyed(name, keys) {
  const t = TA({ pos: [100, 100] });
  t[1] = Object.assign({}, t[1], { selected: true, keys: keys || [{ time: 0.5, value: [100, 100], selected: true }, { time: 1.5, value: [500, 100], selected: true }, { time: 2.5, value: [500, 400], selected: true }] });
  return { name, selected: true, transform: t, rect: { left: -50, top: -50, width: 100, height: 100 } };
}
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

test('clip parsing: curves, holds, limits and broken data are explained', () => {
  const ok = C.parseClip(JSON.stringify([{ x1: 0.1, y1: 0, x2: 0.9, y2: 1 }, { hold: true }, null]));
  assert.equal(ok.curves.length, 3);
  assert.equal(ok.curves[1], null);
  assert.equal(ok.curves[2], null);
  assert.match(C.parseClip('nope').error, /not readable/);
  assert.match(C.parseClip('[]').error, /Copy 1/);
  assert.match(C.parseClip(JSON.stringify(Array.from({ length: C.CLIP_MAX + 1 }, () => ({ x1: 0, y1: 0, x2: 1, y2: 1 })))).error, /Copy 1/);
  assert.match(C.parseClip(JSON.stringify([{ x1: 'a' }])).error, /broken/);
  assert.match(C.parseClip(JSON.stringify([{ hold: true }])).error, /hold/);
});

test('Ease Copy: each segment gets its own copied curve; a one-segment clip goes everywhere; restore', async () => {
  const { services, comp } = await createTestServices(studioComp([keyed('Ball')]));
  const P = tp(named(comp, 'Ball'), 'ADBE Position');
  const before = [1, 2, 3].map((k) => [P.keyInTemporalEase(k)[0].influence, P.keyOutTemporalEase(k)[0].influence]);
  // two segments: 0.1 / 0.9 handles on segment 1, 0.6 / 0.3 on segment 2
  const clip = [{ x1: 0.1, y1: 0, x2: 0.1, y2: 1 }, { x1: 0.6, y1: 0, x2: 0.7, y2: 1 }];
  let r = await services.executor.run('motion.pasteEase', { clip: JSON.stringify(clip), side: 'both' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.ok(near(P.keyOutTemporalEase(1)[0].influence, 10), 'segment 1 out = 10 %');
  assert.ok(near(P.keyInTemporalEase(2)[0].influence, 90), 'segment 1 in = 90 %');
  assert.ok(near(P.keyOutTemporalEase(2)[0].influence, 60), 'segment 2 out = 60 %');
  assert.ok(near(P.keyInTemporalEase(3)[0].influence, 30), 'segment 2 in = 30 %');
  await services.executor.restore(r.checkpointId);
  [1, 2, 3].forEach((k, i) => { assert.equal(P.keyInTemporalEase(k)[0].influence, before[i][0]); assert.equal(P.keyOutTemporalEase(k)[0].influence, before[i][1]); });
  // one copied segment → the same ease on every segment
  r = await services.executor.run('motion.pasteEase', { clip: JSON.stringify([clip[1]]), side: 'both' });
  assert.equal(r.status, 'success');
  assert.ok(near(P.keyOutTemporalEase(1)[0].influence, 60) && near(P.keyOutTemporalEase(2)[0].influence, 60));
  // ease out only leaves the incoming sides alone
  await services.executor.restore(r.checkpointId);
  r = await services.executor.run('motion.pasteEase', { clip: JSON.stringify([clip[0]]), side: 'out' });
  assert.equal(r.status, 'success');
  assert.ok(near(P.keyOutTemporalEase(1)[0].influence, 10));
  assert.equal(P.keyInTemporalEase(2)[0].influence, before[1][0]);
});

test('Ease Copy: a copied hold segment is left alone; the clip fits other distances (speed follows the move)', async () => {
  const keys = [{ time: 0, value: [0, 0], selected: true }, { time: 1, value: [100, 0], selected: true }, { time: 3, value: [900, 0], selected: true }];
  const { services, comp } = await createTestServices(studioComp([keyed('Far', keys)]));
  const P = tp(named(comp, 'Far'), 'ADBE Position');
  const seg2Out = P.keyOutTemporalEase(2)[0].influence;
  const curve = { x1: 0.25, y1: 0.1, x2: 0.75, y2: 0.9 };
  const r = await services.executor.run('motion.pasteEase', { clip: JSON.stringify([curve, { hold: true }]), side: 'both' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.ok(near(P.keyOutTemporalEase(1)[0].influence, 25));
  assert.equal(P.keyOutTemporalEase(2)[0].influence, seg2Out, 'hold segment kept');
  // speed = slope × average speed of THIS segment (100 px in 1 s): 0.1 / 0.25 × 100 = 40 px/s
  assert.ok(near(P.keyOutTemporalEase(1)[0].speed, 40, 0.5), `speed ${P.keyOutTemporalEase(1)[0].speed}`);
});

test('Paste Ease is a Motion Kit tool, not offered to the AI planner, refuses without keys', async () => {
  const S = require('../extension/app/ui/studio/sections');
  assert.equal(S.sectionOf({ id: 'motion.pasteEase', category: 'motion' }), 'kit');
  assert.equal(C.pasteEase.ai.callable, false);
  const { services } = await createTestServices(studioComp([{ name: 'Still', selected: true, transform: TA({ pos: [10, 10] }), rect: { left: 0, top: 0, width: 10, height: 10 } }]));
  const r = await services.executor.run('motion.pasteEase', { clip: JSON.stringify([{ x1: 0.3, y1: 0, x2: 0.7, y2: 1 }]), side: 'both' });
  assert.notEqual(r.status, 'success');
});

test('Motion Control: one block for keys + anchor + align, at the top of every style; no separate groups', () => {
  const fs = require('fs');
  const path = require('path');
  const AE = require('../extension/app/ui/layoutAE');
  assert.ok(!AE.TABS.some((t) => t.groups.some((g) => ['ease', 'align', 'anchor'].includes(g.id))));
  const src = (f) => fs.readFileSync(path.join(__dirname, '../extension/app/ui', f), 'utf8');
  assert.match(src('layoutBento.js'), /AE\.controlTop\(app, kind\)/);
  assert.match(src('layoutGlass.js'), /AE\.controlTop\(app, kind, \['bar', 'rail'\]\)/, 'v0.81: Glass always shows every part (unchanged)');
  assert.match(src('layoutAE.js'), /tabControl\(app, tab, kind\), nextStrip\(app, s\)/);
  const kit = src('views/kit.js');
  assert.match(kit, /h\('div', \{ class: 'kit-graph-row' \}, h\('div', \{ class: 'kit-graph-wrap' \}, graph\(app\)\), rail\(app\)\)/, 'anchor + align sit beside the graph');
  assert.match(kit, /function render\(app\) \{\n  return h\('div', \{ class: 'view kit' \},\n    easeBlock\(app, \{ rail: true \}\)/, 'the docked Motion Kit uses the same control');
  const K = require('../extension/app/ui/views/kit');
  assert.deepEqual(K.clipOf({ clip: { x1: 0.1, y1: 0, x2: 0.9, y2: 1 } }).curves, [{ x1: 0.1, y1: 0, x2: 0.9, y2: 1 }], 'a v0.29 single-curve clip still pastes');
  assert.equal(K.clipOf({ clip: null }), null);
});

test('Next: the steps that follow a run resolve, are few and never repeat the tool itself', () => {
  for (const [tool, refs] of Object.entries(W.NEXT)) {
    assert.ok(refs.length >= 2 && refs.length <= 4, tool);
    assert.equal(new Set(refs).size, refs.length, `${tool}: no duplicates`);
    refs.forEach((r) => { const a = A.resolve(r); assert.ok(a, `${tool}: ${r}`); });
  }
  assert.deepEqual(W.nextAfter(null), []);
  assert.deepEqual(W.nextAfter({ toolId: 'nope' }), []);
  assert.deepEqual(W.nextAfter({ toolId: 'quick.animate', label: 'Slide In' }).slice(0, 2), ['quick:curveExpo', 'quick:k_stagger'], 'animate in → shape the ease → offset the layers');
});

test('v0.30.1: Ease Copy has named buttons with the clipboard status; the rail fills its space at every width', () => {
  const fs = require('fs');
  const path = require('path');
  const kit = fs.readFileSync(path.join(__dirname, '../extension/app/ui/views/kit.js'), 'utf8');
  assert.match(kit, /icon\('easeCopy', 'sm'\), h\('span', \{\}, 'Copy ease'\)/);
  assert.match(kit, /icon\('easePaste', 'sm'\), h\('span', \{\}, 'Paste ease'\)/);
  assert.match(kit, /easeCopyBar\(app, pr, true\)/, 'the folded strip keeps the named buttons');
  const icons = require('../extension/app/ui/icons-ui');
  assert.ok(icons.easeCopy && icons.easePaste, 'Lucide clipboard icons (the old paste icon read as a bin)');
  const css = fs.readFileSync(path.join(__dirname, '../extension/css/app.css'), 'utf8');
  assert.match(css, /\.kit-anchor\.mini \.kit-dots \{ flex: 1 1 auto;[^}]*grid-template-columns: repeat\(3, 1fr\)/, 'the anchor grid fills the rail');
  assert.match(css, /\.app\.kit-mid \.kit-graph-row \{ flex-direction: column; \}/, 'under 560 px the rail goes under the graph');
  const shell = fs.readFileSync(path.join(__dirname, '../extension/app/ui/shell.js'), 'utf8');
  assert.match(shell, /w < 560 \? 'kit-mid'/);
});

