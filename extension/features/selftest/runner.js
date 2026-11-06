'use strict';
/**
 * Self-Test inside After Effects (v0.40, docs/features/SELF_TEST.md).
 *
 * One click in Diagnostics: MOE makes a temporary comp ("MOE Self-Test …"), runs its own advanced tools there
 * (Grid, Cloner, Effectors, Spring, Target, Noise / Image fields, Clone Colours, Points, Text Cloner, Trail, Bake), reads what
 * After Effects really computed (props.values / layers.bounds), compares it with the same reference maths the unit
 * tests use (layouts.js, effectors.js), times the heavy expressions, undoes every tool (checkpoint restore — the
 * restore is checked too), then removes the comp and reopens yours. The report is plain JSON to copy and send.
 *
 * In the test suite this runs against tests/mock (so the runner's logic is tested); its value is in After Effects.
 */
const EF = require('../grid/effectors');
const L = require('../grid/layouts');
const X = require('../grid/expressions');
const TR = require('../grid/trail');

const POS = ['ADBE Transform Group', 'ADBE Position'];
const SCALE = ['ADBE Transform Group', 'ADBE Scale'];
const ROT = ['ADBE Transform Group', 'ADBE Rotate Z'];
const ctlAddr = (layerId, name, param) => ({ layerId, matchNames: ['ADBE Effect Parade', `name:${name}`, `name:${param}`] });
const maxOf = (a) => (a.length ? Math.max(...a) : 0);
const r2 = (v) => Math.round(v * 100) / 100;

/** The checks, in order. Each gets the helper T and returns { status: 'pass'|'fail'|'info'|'skip', detail, numbers }. */
const CHECKS = [
  { id: 'env', label: 'After Effects & expression engine', run: checkEnv },
  { id: 'commands', label: 'Menu commands MOE relies on', run: checkCommands },
  { id: 'grid', label: 'Grid Builder: positions = layouts.js', run: checkGrid },
  { id: 'cloner', label: 'Cloner: 12 copies on a ring', run: checkCloner },
  { id: 'effector', label: 'Effector (sphere sweep): scales = effectors.js', run: (T) => checkEffector(T, { type: 'plain', falloff: 'sphere', size: 200, softness: 50, scale: 60, sweep: true }, 'scale', [0, 0.7, 1.4, 2]) },
  { id: 'spring', label: 'Spring: overshoot = effectors.js', run: (T) => checkEffector(T, { type: 'plain', falloff: 'sphere', size: 200, softness: 50, scale: 60, spring: 100, frequency: 3, decay: 5, sweep: true }, 'scale', [0.6, 1.2, 2.1, 2.4]) },
  { id: 'target', label: 'Target: items face the null', run: (T) => checkEffector(T, { type: 'target', falloff: 'all', scale: 0, sweep: true }, 'rot', [0.5, 1.5]) },
  { id: 'noise', label: 'Noise Field: scales = effectors.js', run: (T) => checkEffector(T, { type: 'plain', falloff: 'noise', size: 160, softness: 40, scale: 80, fieldSpeed: 60 }, 'scale', [0, 1.5]) },
  { id: 'image', label: 'Image field: sampleImage of a Gradient Ramp', run: checkImage },
  { id: 'colours', label: 'Clone Colours: Fill colours = palette', run: checkColours },
  { id: 'points', label: 'Points: clones on a mask\'s 4 points', run: checkPoints },
  { id: 'text', label: 'Text Cloner: words where the title was', run: (T) => checkText(T, { text: 'Make it move', justification: 'center' }) },
  { id: 'textArabic', label: 'Text Cloner: Arabic words (right to left)', run: (T) => checkText(T, { text: 'مرحبا بالعالم', justification: 'right', rtl: true }) },
  { id: 'trail', label: 'Clone Trail: copies = the source, later', run: checkTrail },
  { id: 'bake', label: 'Bake: keyframes = the live grid', run: checkBake },
  { id: 'speed', label: 'Speed: 48 clones, Spring on vs off', run: checkSpeed },
  { id: 'template', label: 'Template: Lower Third = templates.js', run: (T) => checkTemplate(T, { template: 'lowerThird' }) },
  { id: 'templateArabic', label: 'Template: Arabic Lower Third (right to left)', run: (T) => checkTemplate(T, { template: 'lowerThird', title: 'سارة أحمد', subtitle: 'مصممة موشن' }) },
  // v0.60 (SAAS_INTERACTION.md): the press stays in place even on a text whose anchor is on its baseline corner
  { id: 'click', label: 'Click on Layer: cursor on the centre, press in place', run: checkClick },
  // v0.61 (ENGINE2.md): the study's rule 4 — one apply = one Ctrl+Z, proven in After Effects itself
  { id: 'oneUndo', label: 'One Ctrl+Z undoes a whole run (Click on Layer: measure, cursor, keys)', run: checkOneUndo },
  // v0.62 (LINKS.md): the study's defect S1 — rename the controller null, nothing may break
  { id: 'relink', label: 'Rename a Grid null: Relink keeps every item where it was', run: checkRelink },
  // v0.63 (WIPE_CAROUSEL.md): the wipe's direction measured from pixels, not assumed from the manual
  { id: 'wipe', label: 'Wipe Reveal "from the left" reveals the left side first (pixels)', run: checkWipe },
  // v0.64 (WAVE4.md): Exploder's Wiggly Selector settings are found by their English names in this After Effects
  { id: 'exploder', label: 'Explode: the Wiggly Selector and its 7 settings, found by name', run: checkExploder }
];

/* ---------- helpers ---------- */
function helper(services, comp, opts) {
  const host = services.host;
  const T = {
    host, services, comp, compId: comp.compId, made: [],
    async nulls(points, prefix = 'ST Item') {
      const ids = [];
      for (let i = 0; i < points.length; i++) {
        const r = await host.call('layers.createNull', { compId: comp.compId, name: `${prefix} ${i + 1}`, position: points[i], label: 9, threeD: false, undoLabel: 'MOE: Self-Test Item' });
        ids.push(r.layerId);
      }
      return ids;
    },
    async select(ids) { await host.call('layers.setSelection', { items: [{ compId: comp.compId, layerIds: ids, mode: 'set' }] }); },
    /** Run a tool like the user would (approved: the self-test itself was the click). Throws with its errors. */
    async run(toolId, args) {
      const r = await services.executor.run(toolId, args, { origin: 'user', approved: true, batchId: opts.batchId });
      if (r.status !== 'success') { const e = new Error(`${toolId}: ${r.status} — ${(r.errors || (r.verification ? r.verification.checks.filter((c) => !c.ok).map((c) => `${c.label}: ${c.detail}`) : [])).join('; ')}`); e.result = r; throw e; }
      return r;
    },
    async values(time, addrs) { const r = await host.call('props.values', { compId: comp.compId, time, items: addrs.map((a) => ({ address: a })) }); return r.items; },
    async positions(ids, time) { return (await T.values(time, ids.map((id) => ({ layerId: id, matchNames: POS })))).map((v) => v.value); },
    async layerIds() { const d = await host.call('layers.describe', { compId: comp.compId }); return d.layers; },
    /** Undo a tool through its checkpoint and check the comp has the layers it had before. */
    async undo(r, before) {
      const ok = await services.executor.restore(r.checkpointId);
      const after = (await T.layerIds()).length;
      return { restored: !!(ok && ok.ok !== false), back: after === before, layers: after, expected: before };
    }
  };
  return T;
}
/** A 3 × 3 grid of nulls (150 × 120 apart) built with Grid Builder; returns its ids, grid null and base positions. */
async function grid9(T, extra = {}) {
  const ids = await T.nulls(Array.from({ length: 9 }, (_, i) => [300 + i * 40, 300]));
  await T.select(ids);
  const r = await T.run('grid.build', Object.assign({ mode: 'rect', columns: 3, spacingX: 150, spacingY: 120, centerAnchors: false }, extra));
  const all = await T.layerIds();
  const g = all.find((l) => l.id === r.result.nullId);
  // the grid's own item order (item i = slot i in its expressions) — not the order the nulls were made in
  const order = r.result.items.map((it) => it.id);
  return { ids: order, made: ids, r, gridId: r.result.nullId, gridName: g ? g.name : 'MOE Grid 1', base: await T.positions(order, T.comp.time) };
}
/** Undo the grid (back to `before` + its 9 nulls), then delete the self-test's own nulls. */
async function dropGrid9(T, g, before) {
  const u = await T.undo(g.r, before + 9);
  await T.host.call('layers.remove', { compId: T.compId, layerIds: g.made, onlyNamed: 'ST Item' });
  return u;
}

/* ---------- checks ---------- */
async function checkEnv(T) {
  const ctx = T.ctx || {};
  const eng = ctx.expressionEngine || 'unknown';
  return { status: eng === 'javascript-1.0' || eng === 'unknown' ? 'pass' : 'info', detail: `AE ${T.info.appVersion || '?'} · expression engine ${eng}${eng === 'extendscript' ? ' (Legacy ExtendScript — MOE expressions are written to run on it, but JavaScript is faster)' : ''}`, numbers: { appVersion: T.info.appVersion, engine: eng } };
}

async function checkCommands(T) {
  const names = ['Convert Audio to Keyframes'];
  const r = await T.host.call('selftest.commands', { names });
  const audio = r.commands[0];
  return { status: audio.id > 0 ? 'pass' : 'fail', detail: audio.id > 0 ? `Convert Audio to Keyframes found (command ${audio.id}) — the Audio effector can run it` : 'Convert Audio to Keyframes not found by its English name (another AE language?) — the Audio effector will ask you to run it by hand', numbers: { audioCommand: audio.id } };
}

async function checkGrid(T) {
  const before = (await T.layerIds()).length;
  const g = await grid9(T);
  const p = Object.assign(X.defaultParams('rect'), { mode: 'rect', columns: 3, spacingX: 150, spacingY: 120, order: 1, buildOrder: 1, buildStyle: 1, build: 100, seed: 1, rowOffset: 0, columnOffset: 0 });
  const ref = L.placeMorph(p, 9);
  const err = g.base.map((v, i) => Math.hypot(v[0] - ref[i].x, v[1] - ref[i].y));
  const u = await dropGrid9(T, g, before);
  const worst = maxOf(err);
  return { status: worst < 0.6 && u.back ? 'pass' : 'fail', detail: `9 positions, worst ${r2(worst)} px from layouts.js · undo ${u.back ? 'ok' : `left ${u.layers} layers (expected ${u.expected})`}`, numbers: { worstPx: r2(worst), undo: u.back } };
}

async function checkCloner(T) {
  const before = (await T.layerIds()).length;
  const ids = await T.nulls([[960, 540]], 'ST Star');
  await T.select(ids);
  const r = await T.run('grid.build', { mode: 'radial', clones: 12, radius: 300, arc: 360, orient: '2', centerAnchors: false });
  const items = r.result.items.map((it) => it.id);
  const pos = await T.positions(items, T.comp.time);
  const err = pos.map((v) => Math.abs(Math.hypot(v[0], v[1]) - 300));
  const u = await T.undo(r, before + 1);
  await T.host.call('layers.remove', { compId: T.compId, layerIds: ids, onlyNamed: 'ST ' });
  const worst = maxOf(err);
  return { status: items.length === 12 && worst < 0.6 && u.back ? 'pass' : 'fail', detail: `${items.length} items, worst ${r2(worst)} px off the 300 px ring · undo ${u.back ? 'removed the copies' : 'left layers'}`, numbers: { items: items.length, worstPx: r2(worst), undo: u.back } };
}

/** Effector check: build a 3 × 3 grid, add the effector, compare one channel with effectors.applyAt at several times. */
async function checkEffector(T, args, channel, offsets, extraSrc) {
  const before = (await T.layerIds()).length;
  const g = await grid9(T);
  await T.select([g.gridId]);
  const r = await T.run('grid.effector', args);
  const effId = r.result.effectorId;
  const t0 = T.comp.time;
  const names = EF.CONTROLS.filter(([, kind]) => kind !== 'layer' && kind !== 'color').map(([n, kind]) => [n, { slider: 'Slider', angle: 'Angle', checkbox: 'Checkbox', menu: 'Menu' }[kind]]);
  const readValues = async (t) => { const v = {}; const got = await T.values(t, names.map(([n, p]) => ctlAddr(effId, n, p))); names.forEach(([n], i) => { v[EF.KEY[n]] = got[i].value; }); v.invert = v.invert === 1; v.colour = [1, 1, 1, 1]; return v; };
  // the effector's values and position along its path (sampled for the spring's look-back)
  const effPos = async (t) => (await T.positions([effId], t))[0];
  const gp = (await T.positions([g.gridId], t0))[0];
  const errs = [], samples = [];
  for (const off of offsets) {
    const t = t0 + off;
    const cache = new Map();
    const at = async (tt) => { const k = Math.round(tt * 1000); if (!cache.has(k)) cache.set(k, { v: await readValues(tt), p: await effPos(tt) }); return cache.get(k); };
    // prefetch the spring window (≤ 61 samples) so applyAt can stay synchronous
    const V0 = (await at(t)).v, win = (V0.spring || 0) > 0 ? EF.springWindow(V0.decay, 1 / 25) : null;
    const times = [t].concat(win ? Array.from({ length: win.N }, (_, j) => t - (j + 1) * win.D) : []);
    for (const tt of times) await at(tt);
    const near = (tt) => { const k = Math.round(tt * 1000); return cache.get(k) || cache.get(Math.round(t * 1000)); };
    const src = Object.assign({ at: (tt) => near(tt).v, toLocal: (tt) => EF.localFn({ position: near(tt).p }), originAt: (tt) => near(tt).p, audioAt: () => 0, lumaAt: () => 0 }, extraSrc || {});
    const got = channel === 'rot' ? (await T.values(t, g.ids.map((id) => ({ layerId: id, matchNames: ROT })))).map((x) => x.value) : (await T.values(t, g.ids.map((id) => ({ layerId: id, matchNames: SCALE })))).map((x) => x.value[0]);
    g.base.forEach((b, i) => {
      const e = EF.applyAt([src], { i, k: i, n: 9, x: b[0], y: b[1], fd: 1 / 25, compAt: () => [gp[0] + b[0], gp[1] + b[1]], baseRotAt: () => 0 }, t);
      const want = channel === 'rot' ? e.rot : 100 * e.scaleMul;
      errs.push(channel === 'rot' ? Math.abs(EF.wrap180(got[i] - want)) : Math.abs(got[i] - want));
      samples.push(r2(got[i]));
    });
  }
  // speed of these expressions: one read of all 9 items' scale
  const s0 = Date.now();
  await T.values(t0 + 1, g.ids.map((id) => ({ layerId: id, matchNames: SCALE })));
  const ms = Date.now() - s0;
  const u = await T.undo(r, before + 10);
  await dropGrid9(T, g, before);
  const worst = maxOf(errs), tol = channel === 'rot' ? 0.1 : 0.05;
  return { status: worst <= tol && u.back ? 'pass' : 'fail', detail: `${errs.length} values at ${offsets.length} times, worst ${r2(worst)}${channel === 'rot' ? '°' : ' %'} from effectors.js · 9 items read in ${ms} ms · undo ${u.back ? 'ok' : 'left layers'}`, numbers: { worst: r2(worst), readMs: ms, undo: u.back, sample: samples.slice(0, 9) } };
}

async function checkImage(T) {
  const before = (await T.layerIds()).length;
  const W = T.comp.width;
  const solid = await T.host.call('layers.createSolid', { compId: T.compId, name: 'ST Ramp', color: [0.5, 0.5, 0.5], bottom: true });
  await T.host.call('effects.ensure', { compId: T.compId, label: 'MOE: Self-Test Ramp', layers: [{ layer: { layerId: solid.layerId }, items: [{ key: 'ST Ramp', matchName: 'ADBE Ramp', before: [], params: [
    { id: 'Start of Ramp', value: [0, T.comp.height / 2], names: ['Start of Ramp'] }, { id: 'Start Color', value: [0, 0, 0, 1], names: ['Start Color'] },
    { id: 'End of Ramp', value: [W, T.comp.height / 2], names: ['End of Ramp'] }, { id: 'End Color', value: [1, 1, 1, 1], names: ['End Color'] }] }] }] });
  const lumaAt = (cx) => Math.min(Math.max(cx / W, 0), 1);
  const g = await grid9(T);
  await T.select([g.gridId, solid.layerId]);
  const r = await T.run('grid.effector', { type: 'plain', falloff: 'image', scale: 100 });
  const gp = (await T.positions([g.gridId], T.comp.time))[0];
  const got = (await T.values(T.comp.time, g.ids.map((id) => ({ layerId: id, matchNames: SCALE })))).map((x) => x.value[0]);
  const errs = g.base.map((b, i) => Math.abs(got[i] - 100 * (1 + lumaAt(gp[0] + b[0]))));
  const s0 = Date.now();
  await T.values(T.comp.time + 0.5, g.ids.map((id) => ({ layerId: id, matchNames: SCALE })));
  const ms = Date.now() - s0;
  await T.undo(r, before + 11);
  const u = await dropGrid9(T, g, before + 1);
  await T.host.call('layers.remove', { compId: T.compId, layerIds: [solid.layerId], onlyNamed: 'ST Ramp' });
  const worst = maxOf(errs);
  return { status: worst <= 2 && u.back ? 'pass' : 'fail', detail: `brightness of a black → white ramp: worst ${r2(worst)} % from the expected scale (2 % allowed for the ramp's own dither) · 9 items sampled in ${ms} ms`, numbers: { worst: r2(worst), readMs: ms, got: got.map(r2) } };
}

async function checkColours(T) {
  const before = (await T.layerIds()).length;
  const g = await grid9(T);
  await T.select([g.gridId]);
  const r = await T.run('grid.colour', { mode: 'cycle', palette: 'tomato' });
  // the colour tool's own item order (its `expected` follows it)
  const cIds = r.result.items.map((it) => it.id);
  const fills = (await T.values(T.comp.time, cIds.map((id) => ctlAddr(id, EF.COLOUR_FX, 'Color')))).map((x) => x.value);
  const want = r.result.expected;
  const errs = fills.map((c, i) => (c && want[i] ? Math.max(...[0, 1, 2].map((k) => Math.abs(c[k] - want[i][k]))) : 1));
  await T.undo(r, before + 10);
  const u = await dropGrid9(T, g, before);
  const worst = maxOf(errs);
  return { status: worst <= 0.002 && u.back ? 'pass' : 'fail', detail: `9 Fill colours, worst ${r2(worst * 255)} / 255 from the palette · undo ${u.back ? 'ok' : 'left layers'}`, numbers: { worst255: r2(worst * 255) } };
}

async function checkPoints(T) {
  const before = (await T.layerIds()).length;
  const solid = await T.host.call('layers.createSolid', { compId: T.compId, name: 'ST Shape', color: [0.2, 0.2, 0.2], bottom: true });
  const C = [T.comp.width / 2, T.comp.height / 2], R = [300, 200];
  await T.host.call('masks.ellipse', { compId: T.compId, layerId: solid.layerId, name: 'ST Ellipse', center: C, size: [R[0] * 2, R[1] * 2], feather: 0 });
  const star = await T.nulls([[200, 200]], 'ST Dot');
  await T.select([star[0]]);
  const shapeIndex = ((await T.layerIds()).find((l) => l.id === solid.layerId) || {}).index;
  const r = await T.run('grid.build', { mode: 'points', pathLayer: shapeIndex, orient: '2', centerAnchors: false });
  const items = r.result.items.map((it) => it.id);
  const pos = await T.positions(items, T.comp.time);
  const want = [[C[0], C[1] - R[1]], [C[0] + R[0], C[1]], [C[0], C[1] + R[1]], [C[0] - R[0], C[1]]];
  const errs = pos.map((p) => Math.min(...want.map((w) => Math.hypot(p[0] - w[0], p[1] - w[1]))));
  const u = await T.undo(r, before + 2);
  await T.host.call('layers.remove', { compId: T.compId, layerIds: [solid.layerId, star[0]], onlyNamed: 'ST ' });
  const worst = maxOf(errs);
  return { status: items.length === 4 && worst < 0.6 && u.back ? 'pass' : 'fail', detail: `${items.length} items on the ellipse's 4 points, worst ${r2(worst)} px · undo ${u.back ? 'ok' : 'left layers'}`, numbers: { items: items.length, worstPx: r2(worst) } };
}

async function checkText(T, { text, justification, rtl }) {
  const before = (await T.layerIds()).length;
  const tl = await T.host.call('selftest.addText', { compId: T.compId, text, name: 'ST Title', fontSize: 90, justification, rtl, position: [T.comp.width / 2, T.comp.height / 2] });
  const b0 = (await T.host.call('layers.bounds', { compId: T.compId, layerIds: [tl.layerId], times: [T.comp.time] })).layers[0].boxes[0];
  await T.select([tl.layerId]);
  const r = await T.run('grid.build', { mode: 'keep', splitText: 'words' });
  const pieces = r.result.split.pieces.map((p) => p.layerId);
  const boxes = (await T.host.call('layers.bounds', { compId: T.compId, layerIds: pieces, times: [T.comp.time] })).layers.map((l) => l.boxes[0]);
  const uni = [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))];
  const edge = [0, 1, 2, 3].map((k) => Math.abs(uni[k] - b0[k]));
  // neighbours on a line must not overlap (allow 1 px of ink overhang)
  const sorted = boxes.slice().sort((a, b) => a[0] - b[0]);
  const overlap = Math.max(0, ...sorted.slice(1).map((b, i) => sorted[i][2] - b[0]));
  const u = await T.undo(r, before + 1);
  await T.host.call('layers.remove', { compId: T.compId, layerIds: [tl.layerId], onlyNamed: 'ST ' });
  const worst = maxOf(edge);
  return { status: worst <= 3 && overlap <= 1 && u.back ? 'pass' : 'fail', detail: `${pieces.length} words; their outline vs the title: worst edge ${r2(worst)} px (3 allowed), overlap ${r2(overlap)} px · undo ${u.back ? 'brought the title back' : 'left layers'}`, numbers: { words: pieces.length, edgesPx: edge.map(r2), overlapPx: r2(overlap) } };
}

async function checkTrail(T) {
  const before = (await T.layerIds()).length;
  const ball = await T.host.call('layers.createSolid', { compId: T.compId, name: 'ST Ball', color: [0.9, 0.4, 0.2] });
  await T.host.call('keys.write', { compId: T.compId, label: 'MOE: Self-Test Keys', items: [{ address: { layerId: ball.layerId, matchNames: POS }, keys: [{ t: 0, v: [200, 500] }, { t: 2, v: [1400, 300] }] }] });
  await T.select([ball.layerId]);
  const c = { delay: 3, fade: 20, scaleStep: 10, rotateStep: 15 };
  const r = await T.run('grid.trail', Object.assign({ copies: 4 }, c));
  const copies = r.result.copies, errs = [];
  for (const t of [0.6, 1.2]) {
    const got = await T.values(t, copies.flatMap((id) => [{ layerId: id, matchNames: POS }, { layerId: id, matchNames: SCALE }, { layerId: id, matchNames: ROT }, { layerId: id, matchNames: ['ADBE Transform Group', 'ADBE Opacity'] }]));
    for (let i = 0; i < copies.length; i++) {
      const ts = TR.timeOf(i + 1, c.delay, t, 1 / 25);
      const s = (await T.values(ts, [{ layerId: ball.layerId, matchNames: POS }, { layerId: ball.layerId, matchNames: SCALE }, { layerId: ball.layerId, matchNames: ROT }, { layerId: ball.layerId, matchNames: ['ADBE Transform Group', 'ADBE Opacity'] }])).map((x) => x.value);
      const want = TR.at(i + 1, () => ({ position: s[0], scale: s[1], rotation: s[2], opacity: s[3] }), c, t, 1 / 25);
      const g = got.slice(i * 4, i * 4 + 4).map((x) => x.value);
      errs.push(Math.hypot(g[0][0] - want.position[0], g[0][1] - want.position[1]), Math.abs(g[1][0] - want.scale[0]), Math.abs(g[2] - want.rotation), Math.abs(g[3] - want.opacity));
    }
  }
  const u = await T.undo(r, before + 1);
  await T.host.call('layers.remove', { compId: T.compId, layerIds: [ball.layerId], onlyNamed: 'ST ' });
  const worst = maxOf(errs);
  return { status: worst < 0.05 && u.back ? 'pass' : 'fail', detail: `${copies.length} copies at 2 times (position, scale, rotation, opacity), worst ${r2(worst)} from trail.js · undo ${u.back ? 'removed the copies and the null' : 'left layers'}`, numbers: { worst: r2(worst), copies: copies.length } };
}

/** Bake: a swept grid baked every 5 frames — the keys must give what the live expressions gave at those frames. */
async function checkBake(T) {
  const before = (await T.layerIds()).length;
  const g = await grid9(T);
  await T.select([g.gridId]);
  const e = await T.run('grid.effector', { type: 'plain', falloff: 'sphere', size: 200, softness: 50, scale: 60, rotate: 45, sweep: true });
  const times = [0.4, 0.8, 1.2, 1.6, 2.0];
  const addrs = g.ids.flatMap((id) => [{ layerId: id, matchNames: POS }, { layerId: id, matchNames: SCALE }, { layerId: id, matchNames: ROT }]);
  const read = async () => { const out = []; for (const t of times) out.push(await T.values(t, addrs)); return out; };
  const live = await read();
  await T.select([g.gridId]);
  const s0 = Date.now();
  const r = await T.run('rig.bake', { range: 'work', every: 5, keys: 'smart', which: 'moe' });
  const ms = Date.now() - s0;
  const baked = await read();
  const diff = (a, b) => (Array.isArray(a) ? Math.max(...a.map((v, i) => Math.abs(v - b[i]))) : Math.abs(a - b));
  const errs = [], keys = [];
  baked.forEach((row, ti) => row.forEach((x, k) => { errs.push(diff(x.value, live[ti][k].value)); if (ti === 0) keys.push(x.numKeys); }));
  const exprLeft = r.result.written.filter((w) => w.expression).length;
  const ub = await T.undo(r, before + 11);
  const back = await read();
  const errBack = maxOf(back.flatMap((row, ti) => row.map((x, k) => diff(x.value, live[ti][k].value))));
  const u = await T.undo(e, before + 10);
  await dropGrid9(T, g, before);
  const worst = maxOf(errs);
  const ok = worst <= 0.01 && exprLeft === 0 && errBack <= 0.001 && ub.back && u.back;
  return { status: ok ? 'pass' : 'fail', detail: `${r.result.written.length} properties baked in ${ms} ms (${r.result.keysTotal} keys, ${r.result.constants} plain values) · ${errs.length} values at ${times.length} frames, worst ${r2(worst)} from the live rig · restore ${errBack <= 0.001 ? 'brought the expressions back' : `differs by ${r2(errBack)}`} · undo ${ub.back && u.back ? 'ok' : 'left layers'}`, numbers: { worst: r2(worst), bakeMs: ms, keys: r.result.keysTotal, keysPerItem: keys.slice(0, 3), restoreErr: r2(errBack) } };
}

/**
 * v0.49: build a template; After Effects measures the texts, the plan (templates.layout) is recomputed with those
 * sizes, and every part's place after the entrance (its position at the last key + the null's) is compared with it.
 */
async function checkTemplate(T, args) {
  const TPL = require('../design/templates');
  const before = (await T.layerIds()).length;
  const r = await T.run('design.template', args);
  const res = r.result;
  const opts = { title: args.title || TPL.byId(args.template).title, subtitle: args.subtitle || TPL.byId(args.template).subtitle };
  const plan = TPL.layout(args.template, opts, { width: T.comp.width, height: T.comp.height }, res.measured);
  const end = T.comp.time + Math.max(...plan.keys.map((k) => k.keys[k.keys.length - 1].t)) + 0.05;
  const nulPos = (await T.values(end, [{ layerId: res.nullId, matchNames: POS }]))[0].value;
  const errs = [];
  for (const el of plan.elements) {
    const id = res.ids[el.key];
    const p = (await T.values(end, [{ layerId: id, matchNames: POS }]))[0].value;
    const want = el.kind === 'path' ? el.points[0] : el.position;
    errs.push(Math.hypot(p[0] + nulPos[0] - want[0], p[1] + nulPos[1] - want[1]));
  }
  const widths = Object.keys(res.measured).map((k) => Math.round(res.measured[k][0]));
  const u = await T.undo(r, before);
  const worst = maxOf(errs);
  const ok = worst < 0.6 && widths.every((w) => w > 0) && u.back;
  return { status: ok ? 'pass' : 'fail', detail: `${res.made.length} layers · text measured by After Effects ${widths.join(' / ')} px · ${errs.length} parts, worst ${r2(worst)} px from templates.js after the entrance · undo ${u.back ? 'removed it' : 'left layers'}`, numbers: { layers: res.made.length, textWidths: widths, worstPx: r2(worst), undo: u.back } };
}

async function checkClick(T) {
  const W = T.comp.width, H = T.comp.height;
  const before = (await T.layerIds()).length;
  // left- and right-justified texts: their anchors sit on a baseline corner, far from what the eye sees as the centre
  const a = await T.host.call('selftest.addText', { compId: T.compId, text: 'Get started', name: 'ST Button', fontSize: 80, justification: 'left', position: [W * 0.25, H * 0.4] });
  const b = await T.host.call('selftest.addText', { compId: T.compId, text: 'Upgrade', name: 'ST Upgrade', fontSize: 80, justification: 'right', position: [W * 0.75, H * 0.65] });
  await T.select([a.layerId, b.layerId]);
  const r = await T.run('interact.click', { kind: 'arrow', from: 'corner', gap: 1.1, travel: 0.55, depth: 90, ripple: true, size: 40, color: '#FFFFFF' });
  const clicks = r.result.clicks;
  const onTarget = clicks.map((c) => Math.hypot(c.got[0] - c.p[0], c.got[1] - c.p[1]));
  // After Effects measures each text at rest (just before the press) and at the deepest key
  const ids = [a.layerId, b.layerId], times = [];
  clicks.forEach((c) => times.push(c.t + r.result.press[0].t, c.t + r.result.press[1].t)); // rest / deepest key (whole frames); selection order
  const m = await T.host.call('layers.bounds', { compId: T.compId, layerIds: ids, times });
  const drift = [], ratio = [];
  clicks.forEach((c, i) => {
    const bx = m.layers.find((l) => l.layerId === c.layerId).boxes, rest = bx[2 * i], deep = bx[2 * i + 1];
    const cr = [(rest[0] + rest[2]) / 2, (rest[1] + rest[3]) / 2], cd = [(deep[0] + deep[2]) / 2, (deep[1] + deep[3]) / 2];
    drift.push(Math.hypot(cd[0] - cr[0], cd[1] - cr[1]));
    ratio.push((deep[2] - deep[0]) / Math.max(1e-6, rest[2] - rest[0]));
  });
  const u = await T.undo(r, before + 2);
  await T.host.call('layers.remove', { compId: T.compId, layerIds: ids, onlyNamed: 'ST ' });
  const ok = maxOf(onTarget) < 0.6 && maxOf(drift) < 0.6 && ratio.every((q) => Math.abs(q - 0.9) < 0.01) && u.back;
  return { status: ok ? 'pass' : 'fail', detail: `${clicks.length} clicks · cursor ${r2(maxOf(onTarget))} px from each measured centre · the centre moved ${r2(maxOf(drift))} px under the press (0.6 allowed) · width ${ratio.map((q) => Math.round(q * 100)).join(' / ')} % (90 wanted) · undo ${u.back ? 'ok' : 'left layers'}`, numbers: { onTarget, drift, ratio } };
}

async function checkOneUndo(T) {
  const W = T.comp.width, H = T.comp.height;
  const before = (await T.layerIds()).length;
  const a = await T.host.call('selftest.addText', { compId: T.compId, text: 'Buy now', name: 'ST Undo', fontSize: 80, justification: 'center', position: [W / 2, H / 2] });
  await T.select([a.layerId]);
  const r = await T.run('interact.click', { kind: 'arrow', from: 'corner', gap: 1.1, travel: 0.55, depth: 90, ripple: true, size: 40, color: '#FFFFFF' });
  const scale = { layerId: a.layerId, matchNames: ['ADBE Transform Group', 'ADBE Scale'] };
  const keysAfter = (await T.host.call('keys.list', { compId: T.compId, address: scale })).keys.length;
  const made = (await T.layerIds()).length - (before + 1);
  const u = await T.host.call('selftest.undoOnce', { label: 'MOE: Click on Layer' });
  let detail, status;
  if (!u.found) {
    // the menu item is looked up by its exact name; if this AE names it differently, say so instead of guessing
    await T.undo(r, before + 1);
    status = 'info';
    detail = `Edit › "Undo MOE: Click on Layer" not found by name in this After Effects — press Ctrl+Z once after any MOE run to check by hand (cleaned up with Restore)`;
  } else {
    const keysNow = (await T.host.call('keys.list', { compId: T.compId, address: scale })).keys.length;
    const layersNow = (await T.layerIds()).length;
    const ok = keysAfter > 0 && made === 1 && keysNow === 0 && layersNow === before + 1;
    status = ok ? 'pass' : 'fail';
    detail = `the run made ${made} layer(s) and ${keysAfter} Scale keys; ONE Edit › Undo left ${layersNow - (before + 1)} layer(s) and ${keysNow} keys${ok ? '' : ' — the run took more than one undo step'}`;
  }
  await T.host.call('layers.remove', { compId: T.compId, layerIds: [a.layerId], onlyNamed: 'ST ' });
  return { status, detail, numbers: { keysAfter, made, found: u.found } };
}

async function checkRelink(T) {
  const before = (await T.layerIds()).length;
  const g = await grid9(T);
  const at = T.comp.time + 0.5;
  const p0 = await T.positions(g.ids, at);
  await T.host.call('selftest.rename', { layerId: g.gridId, name: 'ST Renamed "Grid"' });
  const broken = (await T.values(at, g.ids.map((id) => ({ layerId: id, matchNames: POS })))).filter((v) => v.error).length;
  const r = await T.run('links.relink', {});
  const p1 = await T.positions(g.ids, at);
  const errs = p1.map((p, i) => Math.hypot(p[0] - p0[i][0], p[1] - p0[i][1]));
  const left = (await T.host.call('links.scan', { compId: T.compId })).renamed.length;
  await T.services.executor.restore(r.checkpointId);
  await T.host.call('selftest.rename', { layerId: g.gridId, name: g.gridName });
  const u = await dropGrid9(T, g, before);
  const worst = maxOf(errs);
  const ok = broken > 0 && worst < 0.01 && left === 0 && u.back;
  return { status: ok ? 'pass' : 'fail', detail: `after the rename ${broken} of ${g.ids.length} items showed an expression error (as After Effects does); Relink: ${r.result.fixed.length} expression(s), items back within ${r2(worst)} px, ${left} renamed link(s) left · undo ${u.back ? 'ok' : 'left layers'}`, numbers: { broken, worst, fixed: r.result.fixed.length } };
}

async function checkWipe(T) {
  const before = (await T.layerIds()).length;
  const solid = await T.host.call('layers.createSolid', { compId: T.compId, name: 'ST Wipe', color: [1, 1, 1] });
  await T.select([solid.layerId]);
  const r = await T.run('quick.wipe', { dir: 'in', from: 'left', duration: 1, feather: 0, ease: 'linear', stagger: 0, order: 'selection' });
  const mid = r.result.keys.items[0].written[0].t + 0.5;
  const px = await T.host.call('pixels.sample', { compId: T.compId, layer: { layerId: solid.layerId }, cols: 4, rows: 1, times: [mid], postEffect: true });
  const a = px.samples[0].cells.map((c) => (Array.isArray(c) ? c[3] : 0));
  const u = await T.undo(r, before + 1);
  await T.host.call('layers.remove', { compId: T.compId, layerIds: [solid.layerId], onlyNamed: 'ST ' });
  const spread = Math.max(...a) - Math.min(...a);
  if (spread < 0.05) return { status: 'info', detail: `half-way through, the four columns read the same alpha (${a.map(r2).join(' / ')}) — nothing to compare here · undo ${u.back ? 'ok' : 'left layers'}` };
  const ok = a[0] > a[3] && u.back;
  return { status: ok ? 'pass' : 'fail', detail: `half-way through, alpha left → right ${a.map(r2).join(' / ')}${ok ? ' — revealed from the left' : ' — the wipe runs the other way'} · undo ${u.back ? 'ok' : 'left layers'}`, numbers: { alpha: a } };
}

async function checkExploder(T) {
  const before = (await T.layerIds()).length;
  const tl = await T.host.call('selftest.addText', { compId: T.compId, text: 'Explode', name: 'ST Explode', fontSize: 90, justification: 'center', position: [T.comp.width / 2, T.comp.height / 2] });
  await T.select([tl.layerId]);
  const tool = T.services.registry.get('text.animate');
  const args = Object.assign(Object.fromEntries(Object.entries(tool.params || {}).filter(([, p]) => p.default !== undefined).map(([k, p]) => [k, p.default])), { presetId: 'explode', placement: 'cti' });
  const r = await T.run('text.animate', args);
  const w = r.result.layers[0].wiggly || { set: [], missing: ['(no Wiggly Selector)'] };
  const u = await T.undo(r, before + 1);
  await T.host.call('layers.remove', { compId: T.compId, layerIds: [tl.layerId], onlyNamed: 'ST ' });
  const ok = !w.missing.length && w.set.length === 7 && u.back;
  return { status: ok ? 'pass' : 'fail', detail: `Wiggly Selector: ${w.set.length} of 7 settings set by name${w.missing.length ? ` — not found: ${w.missing.join(', ')}` : ''} · undo ${u.back ? 'ok' : 'left layers'}`, numbers: { set: w.set.length } };
}

async function checkSpeed(T) {
  const before = (await T.layerIds()).length;
  const ids = await T.nulls([[960, 540]], 'ST Speed');
  await T.select(ids);
  const g = await T.run('grid.build', { mode: 'rect', clones: 48, columns: 8, spacingX: 100, spacingY: 90, centerAnchors: false });
  const items = g.result.items.map((it) => it.id);
  await T.select([g.result.nullId]);
  const time = async () => { const s = Date.now(); for (let k = 0; k < 3; k++) await T.values(T.comp.time + 0.3 + k * 0.4, items.map((id) => ({ layerId: id, matchNames: SCALE }))); return (Date.now() - s) / 3; };
  const e1 = await T.run('grid.effector', { type: 'plain', falloff: 'sphere', scale: 50, sweep: true });
  const plain = await time();
  await T.undo(e1, before + 49);
  const e2 = await T.run('grid.effector', { type: 'plain', falloff: 'sphere', scale: 50, sweep: true, spring: 100, frequency: 3, decay: 5 });
  const spring = await time();
  await T.undo(e2, before + 49);
  const u = await T.undo(g, before + 1);
  await T.host.call('layers.remove', { compId: T.compId, layerIds: ids, onlyNamed: 'ST ' });
  return { status: 'info', detail: `reading 48 clones' scale: ${Math.round(plain)} ms with a plain effector, ${Math.round(spring)} ms with Spring (${plain > 0 ? r2(spring / plain) : '?'}×) · undo ${u.back ? 'ok' : 'left layers'}`, numbers: { plainMs: Math.round(plain), springMs: Math.round(spring) } };
}

/**
 * Run every check. opts: { onProgress(check, index, total), only: [ids] }. Returns the report. The test comp is
 * removed (and your comp reopened) in finally, whatever happens.
 */
async function runSelfTest(services, opts = {}) {
  const started = Date.now();
  const report = { moe: services.version, startedAt: new Date(started).toISOString(), checks: [], cleanup: null };
  let info = {};
  try { info = await services.host.call('host.ping', {}); } catch (e) { info = {}; }
  report.ae = { appVersion: info.appVersion, os: info.os };
  const begin = await services.host.call('selftest.begin', { name: `MOE Self-Test ${new Date(started).toISOString().slice(11, 19)}`, width: 1920, height: 1080, duration: 10, frameRate: 25 });
  const comp = { compId: begin.compId, width: 1920, height: 1080, time: 0 };
  const T = helper(services, comp, { batchId: `selftest-${started}` });
  T.info = report.ae;
  try {
    T.ctx = await services.host.call('context.get', { maxLayers: 50, maxProps: 10 });
    const list = CHECKS.filter((c) => !opts.only || opts.only.includes(c.id));
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (opts.onProgress) opts.onProgress(c, i, list.length);
      const s = Date.now();
      let out;
      try { out = await c.run(T); } catch (e) { out = { status: 'fail', detail: String(e.message || e).slice(0, 400) }; }
      report.checks.push(Object.assign({ id: c.id, label: c.label, ms: Date.now() - s }, out));
    }
  } finally {
    try { report.cleanup = await services.host.call('selftest.end', { compId: begin.compId, previousId: begin.previousId }); } catch (e) { report.cleanup = { error: String(e.message || e) }; }
  }
  report.ms = Date.now() - started;
  report.totals = ['pass', 'fail', 'info', 'skip'].reduce((o, k) => Object.assign(o, { [k]: report.checks.filter((c) => c.status === k).length }), {});
  return report;
}

module.exports = { runSelfTest, CHECKS };
