'use strict';
const FG = require('../extension/core/framegrid'); // v0.61: keys are written on the comp's frame grid
/**
 * v0.49 — Native Templates (docs/features/TEMPLATES.md): real text + shape layers, sized to the text After Effects
 * measures, parented to one null, the entrance keyed from the same plan the tile preview draws. Everything is read
 * back from the mock comp.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTestServices } = require('./helpers/harness');
const { studioComp } = require('./fixtures/studio');
const { TA } = require('./fixtures/layout');
const TPL = require('../extension/features/design/templates');

const near = (a, b, t = 0.01) => (Array.isArray(a) ? a.every((x, i) => Math.abs(x - b[i]) <= t) : Math.abs(a - b) <= t);
const byName = (comp, n) => comp._layers.find((l) => l.name === n);
const tr = (L, mn) => L.property('ADBE Transform Group').property(mn);
/** Depth-first search for a property by match name (shape contents). */
function find(node, mn) {
  if (!node) return null;
  if (node.matchName === mn) return node;
  for (const c of node._children || []) { const r = find(c, mn); if (r) return r; }
  return null;
}
const world = (comp, L) => { const p = tr(L, 'ADBE Position').value; const P = L.parent ? tr(L.parent, 'ADBE Position').value : [0, 0]; return [p[0] + P[0], p[1] + P[1]]; };
const textDoc = (L) => L.property('ADBE Text Properties').property('ADBE Text Document').value;

async function build(args, layers) {
  const { services, comp } = await createTestServices(studioComp(layers || [], { comp: { time: 1 } }));
  const r = await services.executor.run('design.template', Object.assign({ container: 'layers' }, args));
  return { services, comp, r };
}

test('each template: real layers named MOE Template 1 · …, all parented to one null, placed where the plan says', async () => {
  for (const id of TPL.TEMPLATES.filter((t) => !t.kit).map((t) => t.id)) { // v0.50: all eight (v0.57 Product UI: tests/productui.test.js)
    const { comp, r } = await build({ template: id });
    assert.equal(r.status, 'success', `${id}: ${JSON.stringify(r.errors || r.verification)}`);
    const nul = byName(comp, 'MOE Template 1');
    assert.ok(nul && !nul.parent, `${id}: the null`);
    const parts = comp._layers.filter((l) => l.name.indexOf('MOE Template 1 · ') === 0);
    assert.ok(parts.length >= 2 && parts.every((l) => l.parent === nul), `${id}: every part in the null`);
    // the plan, with the sizes After Effects measured (read back from the text layers themselves)
    const opts = { title: TPL.byId(id).title, subtitle: id === 'tag' ? '' : TPL.byId(id).subtitle };
    const measured = {};
    for (const sp of TPL.textSpecs(id, opts, comp)) { const L = byName(comp, `MOE Template 1 · ${TPL.nameOf(sp)}`); assert.ok(L, `${id}: ${TPL.nameOf(sp)}`); const rr = L.sourceRectAtTime(comp.time, false); measured[sp.key] = [rr.width, rr.height]; }
    const plan = TPL.layout(id, opts, comp, measured);
    for (const el of plan.elements) {
      const L = byName(comp, `MOE Template 1 · ${el.name}`);
      assert.ok(L, `${id}: ${el.name}`);
      // after the entrance (the last key), every part sits exactly where the plan put it
      const want = el.kind === 'path' ? el.points[0] : el.position;
      const pos = tr(L, 'ADBE Position');
      const atEnd = pos._keys.length ? pos._keys[pos._keys.length - 1].value : pos.value;
      const P = tr(nul, 'ADBE Position').value;
      assert.ok(near([atEnd[0] + P[0], atEnd[1] + P[1]], want, 0.01), `${id} ${el.name}: ${JSON.stringify([atEnd[0] + P[0], atEnd[1] + P[1]])} vs ${JSON.stringify(want)}`);
    }
  }
});

test('the bar / pill / underline is sized to the text After Effects measured — a longer name, a longer pill', async () => {
  const short = await build({ template: 'tag', title: 'NEW' });
  const long = await build({ template: 'tag', title: 'LIMITED EDITION' });
  const size = (comp) => find(byName(comp, 'MOE Template 1 · Pill').property('ADBE Root Vectors Group'), 'ADBE Vector Rect Size').value;
  const tw = (comp) => byName(comp, 'MOE Template 1 · Title').sourceRectAtTime(1, false).width;
  const s = TPL.unit(short.comp);
  assert.ok(near(size(short.comp)[0], tw(short.comp) + 56 * s), 'pill = text + padding');
  assert.ok(near(size(long.comp)[0], tw(long.comp) + 56 * s));
  assert.ok(size(long.comp)[0] > size(short.comp)[0] * 2);
  const card = await build({ template: 'titleCard', title: 'A much longer headline here' });
  const uw = find(byName(card.comp, 'MOE Template 1 · Underline').property('ADBE Root Vectors Group'), 'ADBE Vector Rect Size').value[0];
  assert.ok(near(uw, Math.max(80 * TPL.unit(card.comp), byName(card.comp, 'MOE Template 1 · Title').sourceRectAtTime(1, false).width * 0.35)));
});

test('the entrance keys are the plan (Quick Animate\'s own keys) at the playhead, positions in the null\'s space', async () => {
  const { comp } = await build({ template: 'lowerThird', duration: 0.8 });
  const nul = byName(comp, 'MOE Template 1');
  const opts = { title: 'Sara Ahmed', subtitle: 'Motion Designer', duration: 0.8 };
  const measured = {};
  for (const k of ['title', 'subtitle']) { const rr = byName(comp, `MOE Template 1 · ${k === 'title' ? 'Title' : 'Subtitle'}`).sourceRectAtTime(1, false); measured[k] = [rr.width, rr.height]; }
  const plan = TPL.layout('lowerThird', opts, comp, measured);
  const P = tr(nul, 'ADBE Position').value;
  for (const k of plan.keys) {
    const el = plan.elements.find((e) => e.key === k.key);
    const L = byName(comp, `MOE Template 1 · ${el.name}`);
    const prop = tr(L, { position: 'ADBE Position', opacity: 'ADBE Opacity', scale: 'ADBE Scale' }[k.prop]);
    assert.equal(prop._keys.length, k.keys.length, `${el.name} ${k.prop}`);
    k.keys.forEach((x, i) => {
      assert.ok(near(prop._keys[i].t, x.t + 1, 1e-6), `${el.name} ${k.prop} key ${i} time`);
      const v = k.prop === 'position' ? [x.v[0] - P[0], x.v[1] - P[1]] : x.v;
      assert.ok(near(Array.isArray(v) ? Array.from(prop._keys[i].value).slice(0, v.length) : prop._keys[i].value, v, 1e-6), `${el.name} ${k.prop} key ${i} value`);
      if (x.easeOut) assert.ok(near(prop._keys[i].easeOut[0].influence, x.easeOut.influence, 1e-6));
    });
  }
  // the callout's leader draws on: a MOE Trim with End keyed 0 → 100
  const c = await build({ template: 'callout' });
  const trim = byName(c.comp, 'MOE Template 1 · Leader').property('ADBE Root Vectors Group')._children.find((x) => x.name === 'MOE Trim');
  assert.deepEqual(trim._children[1]._keys.map((k) => k.value), [0, 100]);
});

test('Arabic: right-to-left text with the universal composer, the layout mirrored (bar on the right)', async () => {
  const { comp, r } = await build({ template: 'lowerThird', title: 'سارة أحمد', subtitle: 'مصممة موشن' });
  assert.equal(r.status, 'success');
  const title = byName(comp, 'MOE Template 1 · Title');
  const d = textDoc(title);
  const { ParagraphDirection } = require('./mock/ae-mock');
  assert.equal(d.direction, ParagraphDirection.DIRECTION_RIGHT_TO_LEFT, 'right-to-left');
  assert.equal(String(d.composerEngine).length > 0, true);
  assert.equal(textDoc(byName(comp, 'MOE Template 1 · Subtitle')).direction, ParagraphDirection.DIRECTION_RIGHT_TO_LEFT);
  const bar = world(comp, byName(comp, 'MOE Template 1 · Accent Bar'));
  const tx = world(comp, title);
  assert.ok(bar[0] > tx[0], 'the bar is on the right of the text');
  assert.ok(bar[0] > comp.width * 0.9, 'right side of the frame (title safe)');
  // English stays left to right, on the left
  assert.notEqual(textDoc(byName((await build({ template: 'tag' })).comp, 'MOE Template 1 · Title')).direction, ParagraphDirection.DIRECTION_RIGHT_TO_LEFT);
  const en = await build({ template: 'lowerThird' });
  assert.ok(world(en.comp, byName(en.comp, 'MOE Template 1 · Accent Bar'))[0] < en.comp.width * 0.1);
});

test('numbering, restore, refusals and the user\'s own layers', async () => {
  const mine = [{ name: 'My Logo', transform: TA({ pos: [100, 100] }) }];
  const { services, comp, r } = await build({ template: 'tag' }, mine);
  const r2 = await services.executor.run('design.template', { container: 'layers', template: 'tag', title: 'SALE' });
  assert.equal(r2.status, 'success');
  assert.ok(byName(comp, 'MOE Template 2'), 'the second one is MOE Template 2');
  assert.ok((await services.executor.restore(r2.checkpointId)).ok);
  assert.ok(!byName(comp, 'MOE Template 2') && byName(comp, 'MOE Template 1'), 'restore removes only its own template');
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.deepEqual(comp._layers.map((l) => l.name), ['My Logo'], 'the user\'s layer untouched, nothing left behind');
  const bad = await services.executor.run('design.template', { container: 'layers', template: 'tag', accent: 'red' });
  assert.notEqual(bad.status, 'success');
  assert.match(JSON.stringify(bad), /#RRGGBB/);
  assert.deepEqual(comp._layers.map((l) => l.name), ['My Logo'], 'a refusal changes nothing');
});

test('the tile previews draw the same plan; the library is on the Design tab and stage', () => {
  const th = fs.readFileSync(path.join(__dirname, '../extension/app/ui/studio/thumbs.js'), 'utf8');
  assert.match(th, /TPL\.layout\(id, opts, TPL_COMP, measured\)/);
  assert.match(th, /PLAN\.valueAt\(kk\.keys, lt\)/);
  const S = require('../extension/app/ui/studio/sections');
  const AE = require('../extension/app/ui/layoutAE');
  const W = require('../extension/app/ui/workflow');
  const sec = S.byId('templates');
  assert.ok(sec && sec.tiles.length >= 6 && sec.tiles.every((t) => t.tool === 'design.template' && TPL.byId(t.args.template)));
  // v0.65: Product UI (Click on Layer first) leads the Design tab, Templates next
  assert.deepEqual(AE.TABS.find((t) => t.id === 'ae-design').groups.slice(0, 2).map((g) => g.id), ['productui', 'templates']);
  assert.deepEqual(W.STAGES.find((s) => s.id === 'st-design').groups[1], ['ae-design', 'templates', 'core']);
  // every template's plan keys are real Quick Animate keys (two or three, AE influence)
  for (const T of TPL.TEMPLATES.filter((t) => !t.kit)) {
    const p = TPL.layout(T.id, {}, { width: 1920, height: 1080 }, { title: [400, 60], subtitle: [300, 30] });
    p.keys.forEach((k) => assert.ok(k.keys.length >= 2 && k.keys.length <= 3, `${T.id} ${k.key}`));
    assert.ok(p.elements.every((e) => e.position || e.points));
  }
});

test('v0.49 audit: the assistant button never covers the bar\'s button — the bar keeps its corner free on its side', () => {
  const css = fs.readFileSync(path.join(__dirname, '../extension/css/app.css'), 'utf8');
  const shell = fs.readFileSync(path.join(__dirname, '../extension/app/ui/shell.js'), 'utf8');
  assert.match(shell, /fab-\$\{app\.services\.store\.get\('assistant-side', 'right'\) === 'left' \? 'left' : 'right'\}/);
  const pad = (side) => new RegExp(`\\.app\\.has-actbar\\.fab-${side} \\.st-actbar \\{ padding-${side}: (\\d+)px; \\}`).exec(css);
  for (const side of ['right', 'left']) {
    const m = pad(side);
    assert.ok(m, side);
    // the button is 44 px wide and sits 12 px in: the bar's buttons stop before it
    assert.ok(Number(m[1]) >= 44 + 12, `${side}: ${m[1]} px`);
  }
  assert.ok(!/\.app\.has-actbar \.assistant:not\(\.open\) \{ bottom: 62px; \}/.test(css), 'no more lifting over a bar that may not be at the bottom');
});

test('v0.50 Hold: after the entrance and the hold, every part leaves the way it came — the keys written are the plan', async () => {
  const { comp, r } = await build({ template: 'lowerThird', hold: 3, duration: 0.8 });
  assert.equal(r.status, 'success');
  const nul = byName(comp, 'MOE Template 1');
  const opts = { title: 'Sara Ahmed', subtitle: 'Motion Designer', duration: 0.8, hold: 3 };
  const measured = {};
  for (const k of ['title', 'subtitle']) { const rr = byName(comp, `MOE Template 1 · ${k === 'title' ? 'Title' : 'Subtitle'}`).sourceRectAtTime(1, false); measured[k] = [rr.width, rr.height]; }
  const plan = TPL.layout('lowerThird', opts, comp, measured);
  const noHold = TPL.layout('lowerThird', Object.assign({}, opts, { hold: 0 }), comp, measured);
  const inEnd = Math.max(...noHold.keys.map((k) => k.keys[k.keys.length - 1].t));
  assert.ok(Math.abs(plan.exitAt - (inEnd + 3)) < 1e-9);
  const P = tr(nul, 'ADBE Position').value;
  for (const k of plan.keys) {
    const el = plan.elements.find((e) => e.key === k.key);
    const prop = tr(byName(comp, `MOE Template 1 · ${el.name}`), { position: 'ADBE Position', opacity: 'ADBE Opacity', scale: 'ADBE Scale' }[k.prop]);
    const n0 = noHold.keys.find((x) => x.key === k.key && x.prop === k.prop).keys.length;
    assert.equal(prop._keys.length, n0 + 2, `${el.name} ${k.prop}: entrance + 2 exit keys`);
    // the exit starts after the hold and ends where the entrance started
    assert.ok(prop._keys[n0].t >= 1 + inEnd + 3 - 1e-9, `${el.name} ${k.prop}: exit after the hold`);
    const first = prop._keys[0].value, last = prop._keys[prop._keys.length - 1].value;
    assert.deepEqual(Array.isArray(first) ? Array.from(first).slice(0, 2) : first, Array.isArray(last) ? Array.from(last).slice(0, 2) : last, `${el.name} ${k.prop}: leaves the way it came`);
    FG.snapKeys(k.keys.map((x) => Object.assign({}, x, { t: x.t + 1 })), 1 / 25).keys.forEach((x, i) => assert.ok(near(prop._keys[i].t, x.t, 1e-6), `${el.name} ${k.prop} key ${i} (on the frame grid)`));
  }
  // hold 0 = it stays (no exit keys)
  const stay = await build({ template: 'lowerThird' });
  assert.equal(tr(byName(stay.comp, 'MOE Template 1 · Title'), 'ADBE Opacity')._keys.length, 2);
});

test('v0.50 Quote, End Card, Social Handle, Chapter: their own parts, Arabic mirrored, the chapter number', async () => {
  const q = await build({ template: 'quote', title: 'الحركة تحكي القصة', subtitle: 'سارة' });
  const mark = world(q.comp, byName(q.comp, 'MOE Template 1 · Quote Mark')), qt = world(q.comp, byName(q.comp, 'MOE Template 1 · Title'));
  assert.ok(mark[0] >= qt[0], 'Arabic: the quote mark on the right');
  assert.equal(textDoc(byName(q.comp, 'MOE Template 1 · Quote Mark')).text, '\u201D');
  const e = await build({ template: 'endCard', subtitle: 'Subscribe now' });
  const btn = find(byName(e.comp, 'MOE Template 1 · Button').property('ADBE Root Vectors Group'), 'ADBE Vector Rect Size').value;
  assert.ok(near(btn[0], byName(e.comp, 'MOE Template 1 · Button Text').sourceRectAtTime(1, false).width + 64 * TPL.unit(e.comp)), 'the button fits its word');
  const h = await build({ template: 'handle', title: '@sara.motion.design' });
  const pill = find(byName(h.comp, 'MOE Template 1 · Pill').property('ADBE Root Vectors Group'), 'ADBE Vector Rect Size').value;
  assert.ok(pill[0] > byName(h.comp, 'MOE Template 1 · Title').sourceRectAtTime(1, false).width, 'the pill holds the handle');
  assert.ok(world(h.comp, byName(h.comp, 'MOE Template 1 · Pill'))[1] > h.comp.height * 0.8, 'bottom corner');
  const c = await build({ template: 'chapter', number: '07' });
  assert.equal(textDoc(byName(c.comp, 'MOE Template 1 · Number')).text, '07');
  assert.ok(byName(c.comp, 'MOE Template 1 · Divider'));
  assert.ok(TPL.TEMPLATES.filter((t) => !t.kit).length === 8);
});

const NILE = { name: 'Nile & Co.', colors: [{ name: 'Nile Green', hex: '#0E7C66', role: 'primary' }, { name: 'Sunset', hex: '#F2A541', role: 'accent' }, { name: 'Sand', hex: '#F4E9D8', role: 'background' }, { name: 'Ink', hex: '#1F2421', role: 'text' }],
  fonts: { arabic: { ps: 'Cairo-Bold', family: 'Cairo', style: 'Bold' }, english: { ps: 'Montserrat-Bold', family: 'Montserrat', style: 'Bold' }, extra: [] } };
const fillOf = (L) => find(L.property('ADBE Root Vectors Group'), 'ADBE Vector Fill Color').value;
const nearRGB = (a, b) => [0, 1, 2].every((i) => Math.abs(a[i] - b[i]) < 0.005);

test('v0.51 brand: the accent is the brand\'s primary, the word on it the brand colour that reads best, the brand\'s font by script', async () => {
  const B = require('../extension/features/brand/brands');
  const o = TPL.brandOpts(NILE, { title: 'NEW' });
  assert.equal(o.accent, '#0E7C66');
  // on Nile Green the best of Ink / Sand / black / white is chosen, and it really reads (≥ 4.5)
  const ratios = ['#1F2421', '#F4E9D8', '#111111', '#ffffff'].map((h) => B.contrast(B.hexToRgb(h), B.hexToRgb('#0E7C66')));
  assert.ok(Math.abs(o.contrast - Math.max(...ratios)) < 0.01 && o.contrast >= 4.5, `${o.tagText} ${o.contrast}`);
  assert.equal(o.font, 'Montserrat-Bold');
  assert.equal(TPL.brandOpts(NILE, { title: 'جديد' }).font, 'Cairo-Bold', 'Arabic text → the Arabic font');
  assert.equal(TPL.brandOpts({ name: 'Empty', colors: [], fonts: {} }, {}), null);

  // built with the client active: the pill is Nile Green, its word the best-reading colour, the font Montserrat
  const { services, comp } = await createTestServices(studioComp([], { comp: { time: 1 } }));
  const id = services.brands.save(Object.assign({}, NILE)).brand.id;
  require('../extension/features/brand/kit').setActive(services.store, id);
  const r = await services.executor.run('design.template', { container: 'layers', template: 'tag' });
  assert.equal(r.status, 'success');
  assert.match(r.summary, /Nile & Co\. brand/);
  assert.ok(nearRGB(fillOf(byName(comp, 'MOE Template 1 · Pill')), B.hexToRgb('#0E7C66')), 'pill = primary');
  const word = textDoc(byName(comp, 'MOE Template 1 · Title'));
  assert.ok(nearRGB(word.fillColor, B.hexToRgb(o.tagText)), 'word = best reading colour');
  assert.equal(word.font, 'Montserrat-Bold');
  // what you set yourself wins; Use the brand off ignores it
  const own = await services.executor.run('design.template', { container: 'layers', template: 'tag', accent: '#3c9dff' });
  assert.ok(nearRGB(fillOf(byName(comp, 'MOE Template 2 · Pill')), B.hexToRgb('#3c9dff')));
  const off = await services.executor.run('design.template', { container: 'layers', template: 'tag', useBrand: false });
  assert.ok(nearRGB(fillOf(byName(comp, 'MOE Template 3 · Pill')), B.hexToRgb('#ff5a3c')));
  assert.doesNotMatch(off.summary, /brand/);
  assert.ok(own.status === 'success');
});

test('v0.51 brand: the template tiles and the big preview show the client\'s colours (the tool\'s own rule)', () => {
  const lib = fs.readFileSync(path.join(__dirname, '../extension/app/ui/studio/library.js'), 'utf8');
  assert.match(lib, /if \(t\.tool === 'design\.template'\) return Object\.assign\(\{\}, t, \{ args: brandedArgs\(app, t\.args\) \}\);/);
  assert.match(lib, /require\('\.\.\/\.\.\/\.\.\/features\/design\/templateTool'\)\.withBrand/);
  const { withBrand } = require('../extension/features/design/templateTool');
  const store = new Map();
  const services = { store: { get: (k, d) => (store.has(k) ? store.get(k) : d), set: (k, v) => store.set(k, v) }, brands: { list: () => [Object.assign({ id: 'b1' }, NILE)], get: (id) => (id === 'b1' ? Object.assign({ id: 'b1' }, NILE) : null) } };
  assert.equal(withBrand({ template: 'tag' }, services).accent, '#0E7C66', 'one client = the active one');
  assert.equal(withBrand({ template: 'tag', accent: '#123456' }, services).accent, '#123456');
  assert.equal(withBrand({ template: 'tag', useBrand: false }, services).accent, undefined);
});

test('v0.52 Auto-fit: a long line gets a smaller font until After Effects measures it inside the safe area; short lines keep theirs', async () => {
  const long = 'The most ambitious launch of the year, live from the main stage';
  const { comp, r } = await build({ template: 'titleCard', title: long });
  assert.equal(r.status, 'success');
  const title = byName(comp, 'MOE Template 1 · Title');
  const spec = TPL.textSpecs('titleCard', { title: long }, comp).find((x) => x.key === 'title');
  const w = title.sourceRectAtTime(1, false).width;
  assert.ok(spec.maxWidth > 0 && w <= spec.maxWidth, `${Math.round(w)} ≤ ${spec.maxWidth}`);
  assert.ok(textDoc(title).fontSize < spec.fontSize, 'smaller font');
  assert.ok(textDoc(title).fontSize >= Math.round(spec.fontSize * 0.4), 'never under 40 %');
  assert.ok(r.verification.checks.some((c) => c.label === 'Fitted to the safe area' && /Title 120 → \d+ px/.test(c.detail)));
  // the underline follows the fitted title (35 % of what was measured)
  const uw = find(byName(comp, 'MOE Template 1 · Underline').property('ADBE Root Vectors Group'), 'ADBE Vector Rect Size').value[0];
  assert.ok(near(uw, Math.max(80 * TPL.unit(comp), w * 0.35)));
  // a short title is not touched
  const short = await build({ template: 'titleCard', title: 'Launch' });
  assert.equal(textDoc(byName(short.comp, 'MOE Template 1 · Title')).fontSize, 120);
  assert.ok(!short.r.verification.checks.some((c) => c.label === 'Fitted to the safe area'));
  // Arabic fits too, and the quote mark keeps its size
  const q = await build({ template: 'quote', title: 'الحركة الجميلة لا تحتاج إلى كلمات كثيرة، تحتاج فقط إلى توقيت صحيح وإحساس بالإيقاع', subtitle: 'سارة' });
  const qs = TPL.textSpecs('quote', { title: 'x' }, q.comp).find((x) => x.key === 'title');
  assert.ok(byName(q.comp, 'MOE Template 1 · Title').sourceRectAtTime(1, false).width <= qs.maxWidth);
  assert.equal(textDoc(byName(q.comp, 'MOE Template 1 · Quote Mark')).fontSize, 220);
  // the pure rule the preview uses = the host's
  assert.equal(TPL.fitSize(100, 900, 1000), 100);
  assert.equal(TPL.fitSize(100, 2000, 1000), 49);
  assert.equal(TPL.fitSize(100, 100000, 1000), 40);
  const th = fs.readFileSync(path.join(__dirname, '../extension/app/ui/studio/thumbs.js'), 'utf8');
  assert.match(th, /Math\.max\(Math\.round\(s\.fontSize \* 0\.4\), Math\.floor\(fs \* \(s\.maxWidth \/ w\) \* 0\.98\)\)/);
});
