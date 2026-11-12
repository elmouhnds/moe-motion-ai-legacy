'use strict';
/** v0.80 Scene Check (docs/features/SCENE_CHECK.md): one read of the comp → what fits, timeline, quality check, storyboard. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { TA } = require('./fixtures/layout');
const { studioComp } = require('./fixtures/studio');
const P = require('../extension/features/scene/plan');
const KITS = require('../extension/app/ui/kits');

const fd = 1 / 25;
const L = (o) => Object.assign({ id: 1, index: 1, name: 'Layer', type: 'shape', text: '', enabled: true, guide: false, locked: false, hasVideo: true, hasAudio: false, threeD: false, parentId: null, inPoint: 0, outPoint: 10, moe: false, props: [] }, o);
const scanOf = (layers, comp, markers) => ({ comp: Object.assign({ id: 9, name: 'Main', width: 1920, height: 1080, duration: 10, time: 1, fd }, comp), layers, markers: Object.assign({ comp: [], layers: [] }, markers), truncated: false });
const keys = (name, times, extra) => Object.assign({ name, matchName: `ADBE ${name}`, keys: times, moe: false, expr: false }, extra);

test('suggest: every point has its reason, and the kit exists', () => {
  const vertical = scanOf([L({ id: 1, type: 'text', text: 'Hi' }), L({ id: 2, type: 'text', text: 'There' }), L({ id: 3, name: 'Music', hasAudio: true, hasVideo: false })], { width: 1080, height: 1920 });
  const s = P.suggest(vertical);
  assert.equal(s[0].kit, 'social'); assert.match(s[0].why[0], /vertical comp \(1080 × 1920\)/);
  assert.ok(s.find((x) => x.kit === 'beat') && s.find((x) => x.kit === 'kinetic'));
  s.forEach((x) => { assert.ok(KITS.byId(x.kit), x.kit); assert.ok(x.score > 0 && x.why.length); });
  const cloner = P.suggest(scanOf([L({ name: 'MOE Grid 1' }), L({ id: 2, name: 'MOE Clone 1 · Dot' }), L({ id: 3, name: 'MOE Glass 1' })]));
  assert.deepEqual(cloner.slice(0, 2).map((x) => x.kit).sort(), ['effectors', 'glass']);
  assert.equal(P.suggest(scanOf([L({ props: [keys('Position', [0, 1])] })])).length, 0, 'one moving layer points at nothing — no kit is forced');
  const stillOnes = P.suggest(scanOf([L({}), L({ id: 2 }), L({ id: 3, props: [keys('Scale', [0, 1])] })]));
  assert.equal(stillOnes[0].kit, 'loops'); assert.match(stillOnes[0].why[0], /2 of 3 visible layers do not move/);
});

test('timeline: fractions of the comp, keyed spans, markers, the playhead', () => {
  const T = P.timeline(scanOf([L({ id: 1, name: 'A', inPoint: 2, outPoint: 6, props: [keys('Position', [2, 3]), keys('Opacity', [], { expr: true, moe: true })] }), L({ id: 2, name: 'Guide', guide: true })],
    { time: 5 }, { comp: [{ t: 4, comment: 'Scene 2' }], layers: [{ layerId: 1, name: 'A', markers: [{ t: 2.5, comment: 'x' }] }] }));
  assert.equal(T.now, 0.5); assert.deepEqual(T.compMarks, [{ at: 0.4, comment: 'Scene 2' }]);
  assert.deepEqual(T.rows[0].life, [0.2, 0.6]); assert.deepEqual(T.rows[0].spans, [{ name: 'Position', a: 0.2, b: 0.3, n: 2 }]);
  assert.equal(T.rows[0].expr, 1); assert.deepEqual(T.rows[0].marks, [0.25]); assert.equal(T.rows[1].dim, true);
});

test('check: short moves, keys between frames, empty text, a cut exit, title safe, brand colours — each says what was read', () => {
  const scan = scanOf([
    L({ id: 1, name: 'Flash', props: [keys('Opacity', [1, 1.08])] }),
    L({ id: 2, name: 'Off', props: [keys('Position', [0, 1.013])] }),
    L({ id: 3, name: 'Blank', type: 'text', text: '  ' }),
    L({ id: 4, name: 'Title', type: 'text', text: 'Hello', inPoint: 0, outPoint: 4, props: [keys('Scale', [0, 0.6])] }),
    L({ id: 5, name: 'Fine', props: [keys('Position', [0, 1])] }),
    L({ id: 6, name: 'Hidden', enabled: false, props: [keys('Opacity', [1, 1.04])] })
  ]);
  const f = P.check(scan, {});
  const of = (name) => f.filter((x) => x.layer === name).map((x) => x.title);
  assert.deepEqual(of('Flash'), ['Opacity: a move of 2 frames']);
  assert.deepEqual(of('Off'), ['1 key between frames']);
  assert.deepEqual(of('Blank'), ['Empty text layer']);
  assert.deepEqual(of('Title'), ['Comes in, leaves with a cut']); assert.equal(f.find((x) => x.layer === 'Title').level, 'hint');
  assert.deepEqual(of('Fine'), []); assert.deepEqual(of('Hidden'), [], 'a hidden layer is not judged');
  assert.equal(f[0].level, 'fix', 'worst first'); assert.match(f[f.length - 1].title, /1 hidden layer/);
  // measured
  const m = P.check(scan, { boxes: { 4: [100, 500, 600, 600], 3: [-40, 10, 300, 90] }, colours: [{ layerId: 5, name: 'Fine', rgb: [1, 0, 0] }, { layerId: 5, name: 'Fine', rgb: [0.043, 0.063, 0.125] }], brand: { name: 'Pulse Pay', colors: [{ hex: '#0B1020' }, { hex: '#5B8CFF' }] } });
  const safe = m.filter((x) => /title safe/.test(x.title));
  assert.equal(safe.find((x) => x.layer === 'Title').title, 'Text outside title safe (left)'); assert.match(safe.find((x) => x.layer === 'Title').detail, /By 92 px/);
  assert.equal(safe.find((x) => x.layer === 'Blank').level, 'fix', 'outside the frame itself');
  assert.deepEqual(m.filter((x) => /is not in Pulse Pay/.test(x.title)).map((x) => x.title), ['Colour #FF0000 is not in Pulse Pay'], 'the brand\'s own Night passes');
  assert.equal(P.check(scan, { boxes: { 4: [300, 300, 900, 500] } }).filter((x) => /title safe/.test(x.title)).length, 0);
});

test('scenes and the storyboard page: comp markers first, then layer markers, then even spacing — said; the page is escaped and says it is not a render', () => {
  const layers = [L({ id: 1, name: 'T <b>', type: 'text', text: 'Sale & "more"', inPoint: 0, outPoint: 5 }), L({ id: 2, name: 'Late', inPoint: 6, outPoint: 10 })];
  const withComp = P.scenes(scanOf(layers, {}, { comp: [{ t: 4, comment: 'Two' }, { t: 1, comment: '' }, { t: 1.01, comment: 'dup' }, { t: 99, comment: 'out' }], layers: [{ layerId: 1, name: 'x', markers: [{ t: 2, comment: 'L' }] }] }));
  assert.equal(withComp.from, 'comp markers'); assert.deepEqual(withComp.list.map((x) => [x.t, x.label]), [[1, 'Scene 1'], [4, 'Two']]);
  assert.equal(P.scenes(scanOf(layers, {}, { layers: [{ layerId: 1, name: 'x', markers: [{ t: 2, comment: 'L' }] }] })).from, 'layer markers');
  const none = P.scenes(scanOf(layers)); assert.match(none.from, /even spacing \(no markers/); assert.equal(none.list.length, 4);
  const many = P.scenes(scanOf(layers, { duration: 100 }, { comp: Array.from({ length: 30 }, (_, i) => ({ t: i + 1, comment: '' })) })); assert.ok(many.cut && many.list.length === P.LIMITS.scenes);
  const B = P.board(scanOf(layers), withComp, [{ 1: [100, 100, 500, 200], 2: [0, 0, 10, 10] }, { 1: [100, 100, 500, 200] }]);
  assert.deepEqual(B.scenes.map((x) => x.layers.map((y) => y.name)), [['T <b>'], ['T <b>']], 'Late is not alive at 1 s or 4 s');
  const html = P.boardHtml(B);
  assert.ok(html.startsWith('<!doctype html>') && /not a render/.test(html));
  assert.ok(!/<b>"|Sale & "/.test(html) && /Sale &amp; &quot;more&quot;/.test(html), 'text from the comp is escaped');
  assert.ok(!/<script/i.test(html));
});

const box = (name, x, extra) => Object.assign({ name, selected: true, transform: TA({ pos: [x, 300] }), rect: { left: -20, top: -20, width: 40, height: 40 } }, extra || {});
test('on the mock: Read This Comp changes nothing and counts every layer; Measure leaves no layer behind and measures boxes at each scene', async () => {
  const { services, comp } = await createTestServices(studioComp([box('A', 400), box('B', 900), { name: 'Title', text: 'Hello', transform: TA({ pos: [960, 540] }) }], { comp: { time: 1 } }));
  const A = comp._layers[0];
  const sc = A.property('ADBE Transform Group').property('ADBE Scale'); sc.setValueAtTime(1, [0, 0]); sc.setValueAtTime(1.6, [100, 100]);
  const calls = []; const call = services.host.call.bind(services.host); services.host.call = async (op, a) => { calls.push(op); return call(op, a); };
  await services.host.call('markers.add', { compId: comp.id, label: 'MOE: test', layers: [A.id], times: [2], comment: 'Beat' });
  calls.length = 0;
  const n0 = comp._layers.length;
  const r = await services.executor.run('scene.read', {});
  assert.equal(r.status, 'success', JSON.stringify(r.errors || r.verification));
  assert.ok(!calls.some((c) => /^tx\./.test(c)), 'a read opens no undo group');
  const scan = r.result.scan;
  assert.equal(scan.layers.length, n0); assert.equal(scan.comp.id, comp.id);
  const a = scan.layers.find((x) => x.name === 'A');
  assert.deepEqual(a.props.map((p) => [p.name, p.keys.length]), [['Scale', 2]]);
  assert.deepEqual(scan.markers.layers.map((m) => [m.name, m.markers.map((x) => x.t)]), [['A', [2]]]);
  assert.equal(P.timeline(scan).rows.find((x) => x.name === 'A').spans.length, 1);
  const scenes = P.scenes(scan); assert.equal(scenes.from, 'layer markers');
  const m = await services.executor.run('scene.measure', { times: JSON.stringify(scenes.list.map((x) => x.t)) });
  assert.equal(m.status, 'success', JSON.stringify(m.errors || m.verification));
  assert.equal(comp._layers.length, n0, 'the probe is gone');
  assert.deepEqual(m.result.times, [1, 2]); assert.equal(m.result.boxesAt.length, 2);
  const b = m.result.boxesAt[0][a.id]; assert.ok(Array.isArray(b) && b.length === 4 && b[2] >= b[0]);
  const B = P.board(scan, scenes, m.result.boxesAt.slice(1)); assert.ok(B.scenes[0].layers.length >= 1);
  assert.equal((await services.executor.run('scene.measure', { times: '[-1]' })).status, 'blocked');
  assert.equal((await services.executor.run('scene.measure', { times: 'x' })).status, 'blocked');
});
