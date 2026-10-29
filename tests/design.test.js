'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { T, studioComp } = require('./fixtures/studio');
const SVG = require('../extension/features/design/svgShape');
const LIB = require('../extension/features/design/shapesLib');
const PAL = require('../extension/features/design/palettes');
const D = require('../extension/features/design/tools');

const A = (v) => Array.from(v);
const near = (a, b, t = 0.01) => Math.abs(a - b) <= t;
const named = (comp, n) => comp._layers.find((l) => l.name === n);
const vec = (L, ...mns) => mns.reduce((p, mn) => p.property(mn), L);
const contentsOf = (L) => L.property('ADBE Root Vectors Group').property(1).property('ADBE Vectors Group');

const base = (layers) => studioComp(layers || [
  { name: 'Title', text: 'Hello', selected: true, transform: T({ pos: [960, 300] }) },
  { name: 'Card', shapes: [{ name: 'Card', fill: [1, 1, 1], path: [[0, 0], [100, 0], [100, 60]], closed: true }], selected: true, transform: T() },
  { name: 'Photo', selected: true, transform: T() }
]);

/* ---------------- SVG → AE Shape ---------------- */

test('Path parser: absolute + relative lines, H/V, Z merges the closing vertex', () => {
  const [p] = SVG.parsePath('M2 2h10v10H2z');
  assert.equal(p.closed, true);
  assert.deepEqual(p.pts.map((q) => q.p), [[2, 2], [12, 2], [12, 12], [2, 12]]);
  const [q] = SVG.parsePath('m4 4 6 0 0 6');
  assert.deepEqual(q.pts.map((x) => x.p), [[4, 4], [10, 4], [10, 10]], 'implicit lineto after m, relative');
  assert.equal(q.closed, false);
});

test('Path parser: cubic tangents are relative to their vertex; S reflects; Q raises to cubic', () => {
  const [c] = SVG.parsePath('M0 0C0 10 20 10 20 0S40 -10 40 0');
  assert.deepEqual(c.pts[0].out, [0, 10]);
  assert.deepEqual(c.pts[1].in, [0, 10]);
  assert.deepEqual(c.pts[1].out, [0, -10], 'S mirrors the previous control point');
  const [qq] = SVG.parsePath('M0 0Q10 10 20 0');
  assert.ok(near(qq.pts[0].out[0], 20 / 3) && near(qq.pts[0].out[1], 20 / 3));
  assert.ok(near(qq.pts[1].in[0], -20 / 3) && near(qq.pts[1].in[1], 20 / 3));
});

test('Arcs: points stay on the circle; compact flags ("011") parse', () => {
  const r = SVG.toAEShapes([['path', { d: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0' }]], { size: 24 });
  const s = r.shapes[0];
  let err = 0;
  for (let i = 0; i < s.v.length - 1; i++) for (const t of [0.2, 0.5, 0.8]) { const p = SVG.segmentPoint(s, i, t); err = Math.max(err, Math.abs(Math.hypot(p[0], p[1]) - 10)); }
  assert.ok(err < 0.01, `arc error ${err}`);
  const [a] = SVG.parsePath('M0 0a5 5 0 015 5');
  assert.deepEqual(a.pts[a.pts.length - 1].p, [5, 5]);
});

test('Elements: circle, rounded rect, line, polygon', () => {
  assert.equal(SVG.elementPaths(['circle', { cx: 12, cy: 12, r: 4 }])[0].pts.length, 4);
  const rr = SVG.elementPaths(['rect', { x: 2, y: 2, width: 20, height: 10, rx: 2 }])[0];
  assert.equal(rr.pts.length, 8);
  assert.equal(rr.closed, true);
  assert.equal(SVG.elementPaths(['rect', { x: 0, y: 0, width: 4, height: 4 }])[0].pts.length, 4);
  assert.equal(SVG.elementPaths(['line', { x1: 0, y1: 0, x2: 4, y2: 4 }])[0].closed, false);
  assert.equal(SVG.elementPaths(['polygon', { points: '0,0 4,0 4,4' }])[0].closed, true);
});

test('Every bundled Lucide icon converts and stays inside its 24-grid box', () => {
  const d = LIB.data();
  assert.ok(d.count >= 1800, `icons: ${d.count}`);
  for (const [name, ic] of Object.entries(d.icons)) {
    const r = SVG.toAEShapes(ic.n, { size: 240 });
    assert.ok(r.shapes.length > 0, name);
    for (const k of ['minX', 'minY']) assert.ok(r.bounds[k] >= -125, `${name} ${k}`);
    for (const k of ['maxX', 'maxY']) assert.ok(r.bounds[k] <= 125, `${name} ${k}`);
  }
  assert.ok(d.categories.length >= 10);
  assert.equal(LIB.search('heart')[0], 'heart');
  assert.ok(LIB.search('arrow', 'arrows').length > 20);
});

/* ---------------- Insert shape ---------------- */

test('Insert icon (line + pop): paths, round caps, stroke = size/12, scale keys; restore removes it', async () => {
  const { services, comp } = await createTestServices(base());
  const r = await services.executor.run('design.insertShape', { icon: 'heart', size: 240, color: '#FF0000', animate: 'pop', duration: 0.5 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const L = named(comp, 'MOE Icon • Heart');
  assert.ok(L, 'layer created');
  const c = contentsOf(L);
  assert.equal(c.property(1).matchName, 'ADBE Vector Shape - Group');
  const stroke = c.property(c.numProperties);
  assert.equal(stroke.matchName, 'ADBE Vector Graphic - Stroke');
  assert.ok(near(stroke.property('ADBE Vector Stroke Width').value, 20));
  assert.equal(stroke.property('ADBE Vector Stroke Line Cap').value, 2);
  const sc = vec(L, 'ADBE Transform Group', 'ADBE Scale');
  assert.equal(sc.numKeys, 3);
  assert.deepEqual(A(sc.keyValue(1)), [0, 0]);
  assert.deepEqual(A(vec(L, 'ADBE Transform Group', 'ADBE Position').value), [960, 540]);
  assert.ok(near(L.inPoint, 1), 'starts at the playhead');
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.equal(named(comp, 'MOE Icon • Heart'), undefined);
});

test('Insert native star (solid): Polystar parameters set; draw-on refused for fill-only primitives', async () => {
  const { services, comp } = await createTestServices(base());
  const r = await services.executor.run('design.insertShape', { source: 'primitive', primitive: 'star', style: 'fill', size: 400, color: '#00FF00', animate: 'none' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const c = contentsOf(named(comp, 'MOE Shape • Star'));
  const star = c.property(1);
  assert.equal(star.matchName, 'ADBE Vector Shape - Star');
  assert.equal(star.property('ADBE Vector Star Points').value, 5);
  assert.ok(near(star.property('ADBE Vector Star Outer Radius').value, 208));
  assert.ok(near(star.property('ADBE Vector Star Inner Radius').value, 88));
  assert.equal(c.property(2).matchName, 'ADBE Vector Graphic - Fill');
  assert.deepEqual(A(c.property(2).property('ADBE Vector Fill Color').value).slice(0, 3), [0, 1, 0]);
  const bad = await services.executor.run('design.insertShape', { source: 'primitive', primitive: 'circle', style: 'fill', animate: 'draw' });
  assert.equal(bad.status, 'blocked');
});

test('Insert icon with draw-on: MOE Trim end 0 → 100; duotone adds a 35% fill', async () => {
  const { services, comp } = await createTestServices(base());
  const r = await services.executor.run('design.insertShape', { icon: 'rocket', style: 'duotone', color: '#FFFFFF', color2: '#FF7A59', animate: 'draw', duration: 1 });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const L = named(comp, 'MOE Icon • Rocket');
  const root = L.property('ADBE Root Vectors Group');
  const trim = root.property(2);
  assert.equal(trim.name, 'MOE Trim');
  const end = trim.property('ADBE Vector Trim End');
  assert.equal(end.numKeys, 2);
  assert.deepEqual([end.keyValue(1), end.keyValue(2)], [0, 100]);
  const c = contentsOf(L);
  const fill = c.property(c.numProperties);
  assert.equal(fill.property('ADBE Vector Fill Opacity').value, 35);
  assert.equal(fill.property('ADBE Vector Fill Rule').value, 2);
});

test('Insert: unknown icon / bad colour are refused before touching AE', async () => {
  const { services, comp } = await createTestServices(base());
  const n = comp.numLayers;
  assert.equal((await services.executor.run('design.insertShape', { icon: 'no-such-icon' })).status, 'blocked');
  assert.equal((await services.executor.run('design.insertShape', { icon: 'heart', color: 'red' })).status, 'blocked');
  assert.equal(comp.numLayers, n);
});

test('Every native primitive inserts and verifies', async () => {
  const { services, comp } = await createTestServices(base());
  for (const p of LIB.PRIMITIVES) {
    const r = await services.executor.run('design.insertShape', { source: 'primitive', primitive: p.id, style: 'both', animate: 'none' });
    assert.equal(r.status, 'success', `${p.id}: ${JSON.stringify(r.verification || r.errors)}`);
  }
  assert.equal(comp._layers.filter((l) => /^MOE Shape/.test(l.name)).length, LIB.PRIMITIVES.length);
});

/* ---------------- Background ---------------- */

test('Gradient geometry: linear angle 0 runs left → right across the half diagonal', () => {
  const g = D.gradientPoints('linear', 1920, 1080, 0, 100);
  const half = Math.hypot(1920, 1080) / 2;
  assert.ok(near(g.start[0], 960 - half) && near(g.end[0], 960 + half) && near(g.start[1], 540));
  const r = D.gradientPoints('radial', 1920, 1080, 0, 50);
  assert.deepEqual(r.start, [960, 540]);
});

test('Background (linear + grain + drift) is created at the bottom with Ramp params; restore removes it', async () => {
  const { services, comp } = await createTestServices(base());
  const r = await services.executor.run('design.background', { palette: 'ocean', style: 'linear', from: 0, to: 3, angle: 90, grain: 8, drift: true });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const L = comp._layers[comp._layers.length - 1];
  assert.equal(L.name, 'MOE Background');
  const fx = L.property('ADBE Effect Parade');
  const ramp = fx.property('MOE Gradient');
  assert.ok(ramp);
  const pal = PAL.byId('ocean');
  const hex = (c) => require('../extension/features/brand/brands').rgbToHex(A(c));
  assert.equal(hex(ramp.property('Start Color').value), pal.colors[0]);
  assert.equal(hex(ramp.property('End Color').value), pal.colors[3]);
  assert.ok(String(ramp.property('Start of Ramp').expression).startsWith(D.TAG));
  assert.equal(fx.property('MOE Grain').property('Amount of Noise').value, 8);
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.equal(named(comp, 'MOE Background'), undefined);
});

test('Background mesh uses the 4-Colour Gradient; flat style needs no effect', async () => {
  const { services, comp } = await createTestServices(base());
  const r = await services.executor.run('design.background', { palette: 'cyber', style: 'mesh' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  assert.ok(named(comp, 'MOE Background').property('ADBE Effect Parade').property('MOE Mesh'));
  const f = await services.executor.run('design.background', { palette: 'mono', style: 'solid', name: 'MOE Background Flat' });
  assert.equal(f.status, 'success', JSON.stringify(f.verification || f.errors));
  assert.equal(named(comp, 'MOE Background Flat').property('ADBE Effect Parade').numProperties, 0);
});

/* ---------------- Animated backgrounds (v0.18) ---------------- */
const BM = require('../extension/features/design/bgMotion');
const Brand = require('../extension/features/brand/brands');

test('bgMotion maths: every motion loops exactly; Still holds; swirl turns around the centre; HSL matches the standard', () => {
  const o = { loop: 6, amount: 40, w: 1920, h: 1080 }, base = [400, 300];
  for (const m of BM.POINT_MOTIONS) {
    for (const t of [0.37, 2.2, 5.1]) {
      const a = BM.pointAt(m.id, base, 1, 4, t, o), b = BM.pointAt(m.id, base, 1, 4, t + o.loop, o);
      assert.ok(near(a[0], b[0], 1e-6) && near(a[1], b[1], 1e-6), `${m.id} loops`);
    }
  }
  assert.deepEqual(BM.pointAt('none', base, 0, 2, 3, o), base);
  const c = [960, 540], q = BM.pointAt('swirl', base, 0, 2, 1.5, o); // a quarter turn
  assert.ok(near(Math.hypot(q[0] - c[0], q[1] - c[1]), Math.hypot(base[0] - c[0], base[1] - c[1]), 1e-6), 'same distance from the centre');
  assert.ok(near(q[0], c[0] - (base[1] - c[1]), 1e-6) && near(q[1], c[1] + (base[0] - c[0]), 1e-6));
  assert.deepEqual(BM.rgbToHsl([1, 0, 0, 1]), [0, 1, 0.5, 1]);
  assert.deepEqual(BM.rgbToHsl([0.5, 0.5, 0.5, 1]), [0, 0, 0.5, 1]);
  const blue = BM.rgbToHsl([0, 0, 1, 1]); assert.ok(near(blue[0], 2 / 3, 1e-9));
  for (const col of [[0.2, 0.6, 0.9, 1], [0.95, 0.4, 0.1, 1], [0.1, 0.1, 0.12, 1]]) {
    const back = BM.hslToRgb(BM.rgbToHsl(col)); col.forEach((v, k) => assert.ok(near(back[k], v, 1e-9), 'round trip'));
  }
  const P = PAL.byId('ocean').colors.map((hx) => Brand.hexToRgb(hx).concat([1]));
  for (const m of BM.COLOR_MOTIONS) {
    const s = { i: 0, n: 2, idx: 1, P, own: P[1], other: P[3] }, oo = { loop: 4, colour: 100 };
    const a = BM.colorAt(m.id, s, 1.3, oo), b = BM.colorAt(m.id, s, 5.3, oo);
    a.forEach((v, k) => assert.ok(near(v, b[k], 1e-9), `${m.id} colour loops`));
    BM.colorAt(m.id, s, 0, oo).forEach((v, k) => assert.ok(near(v, P[1][k], 1e-9), `${m.id} starts on the palette colour`));
    BM.colorAt(m.id, s, 1.3, { loop: 4, colour: 0 }).forEach((v, k) => assert.ok(near(v, P[1][k], 1e-9), `${m.id}: Colour change 0 % keeps the colour`));
  }
});

test('Animated background: the expressions AE runs give the same points and colours as the JS reference, for every motion', async () => {
  for (const style of ['linear', 'radial', 'mesh']) {
    for (const [i, m] of BM.POINT_MOTIONS.filter((x) => x.id !== 'none').entries()) {
      const cm = BM.COLOR_MOTIONS[1 + (i % 4)].id;
      const { services, comp } = await createTestServices(base());
      const r = await services.executor.run('design.background', { palette: 'ocean', style, from: 1, to: 3, motion: m.id, colorMotion: cm, loop: 5, amount: 60, colourAmount: 80 });
      assert.equal(r.status, 'success', `${style}/${m.id}/${cm}: ${JSON.stringify(r.verification || r.errors)}`);
      const L = named(comp, 'MOE Background'), fx = L.property('ADBE Effect Parade');
      assert.equal(fx.property(BM.FX.loop).property('Slider').value, 5);
      assert.equal(fx.property(BM.FX.amount).property('Slider').value, 60);
      assert.equal(fx.property(BM.FX.colour).property('Slider').value, 80);
      const eff = fx.property(style === 'mesh' ? 'MOE Mesh' : 'MOE Gradient');
      const plan = D.backgroundPlan({ palette: 'ocean', style, from: 1, to: 3, angle: 135, spread: 100, grain: 0, motion: m.id, colorMotion: cm, loop: 5, amount: 60, colourAmount: 80 }, comp);
      const pointNames = style === 'mesh' ? ['Point 1', 'Point 2', 'Point 3', 'Point 4'] : ['Start of Ramp', 'End of Ramp'];
      const colourNames = style === 'mesh' ? ['Color 1', 'Color 2', 'Color 3', 'Color 4'] : ['Start Color', 'End Color'];
      const P = PAL.byId('ocean').colors.map((hx) => Brand.hexToRgb(hx).concat([1]));
      for (const t of [0, 1.1, 3.7, 5]) {
        pointNames.forEach((pn, k) => {
          const got = eff.property(pn).valueAtTime(t, false), want = BM.pointAt(m.id, plan.bases[k], k, pointNames.length, t, { loop: 5, amount: 60, w: comp.width, h: comp.height });
          assert.ok(near(got[0], want[0], 0.01) && near(got[1], want[1], 0.01), `${style}/${m.id} ${pn} @${t}: ${got} vs ${want}`);
        });
        colourNames.forEach((cn, k) => {
          const sl = plan.slots[k], other = plan.slots.find((x) => x.id === sl.other);
          const got = A(eff.property(cn).valueAtTime(t, false)), want = BM.colorAt(cm, { i: k, n: colourNames.length, idx: sl.idx, P, own: P[sl.idx], other: P[other.idx] }, t, { loop: 5, colour: 80 });
          want.forEach((v, j) => assert.ok(near(got[j], v, 1e-3), `${style}/${cm} ${cn} @${t}: ${got} vs ${want}`));
        });
      }
      // live: the sliders drive the expressions
      fx.property(BM.FX.amount).property('Slider').setValue(0);
      const still = eff.property(pointNames[0]).valueAtTime(1.1, false);
      if (m.id !== 'swirl') assert.ok(near(still[0], plan.bases[0][0], 0.01) && near(still[1], plan.bases[0][1], 0.01), `${m.id}: Movement 0 % holds the point`);
      assert.ok((await services.executor.restore(r.checkpointId)).ok);
      assert.equal(named(comp, 'MOE Background'), undefined);
    }
  }
});

test('Animated background: old "drift" presets still work (= Drift); Flat ignores motion; every expression is tagged and uses add(), never array +', async () => {
  const { services, comp } = await createTestServices(base());
  const r = await services.executor.run('design.background', { palette: 'cyber', style: 'mesh', drift: true });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const mesh = named(comp, 'MOE Background').property('ADBE Effect Parade').property('MOE Mesh');
  assert.match(mesh.property('Point 1').expression, /^\/\/ MOE Background: motion drift/);
  assert.equal(mesh.property('Color 1').expression, '', 'colours stay still unless asked');
  const f = await services.executor.run('design.background', { palette: 'mono', style: 'solid', motion: 'orbit', colorMotion: 'cycle', name: 'MOE Background Flat' });
  assert.equal(f.status, 'success');
  assert.equal(named(comp, 'MOE Background Flat').property('ADBE Effect Parade').numProperties, 0, 'no sliders, no expressions on a flat colour');
  for (const m of BM.POINT_MOTIONS.filter((x) => x.id !== 'none')) {
    const e = BM.pointExpression(m.id, 1, 4, 1920, 1080);
    assert.ok(e.startsWith(D.TAG));
    assert.ok(!/value \+ \[/.test(e), `${m.id}: no array + array`);
  }
});

/* ---------------- Colorize ---------------- */

test('Palette colour maths: cycle wraps, blend hits both ends, shuffle is deterministic', () => {
  const pal = PAL.byId('playground');
  const B = require('../extension/features/brand/brands');
  assert.equal(B.rgbToHex(D.paletteColor(pal, 'cycle', 6, 7)), pal.colors[1]);
  assert.equal(B.rgbToHex(D.paletteColor(pal, 'blend', 0, 9)), pal.colors[0]);
  assert.equal(B.rgbToHex(D.paletteColor(pal, 'blend', 8, 9)), pal.colors[4]);
  assert.deepEqual(D.paletteColor(pal, 'shuffle', 3, 9, 0, 7), D.paletteColor(pal, 'shuffle', 3, 9, 0, 7));
  assert.equal(PAL.PALETTES.length, new Set(PAL.PALETTES.map((p) => p.id)).size);
  for (const p of PAL.PALETTES) assert.ok(p.colors.length === 5 && p.colors.every((c) => /^#[0-9A-F]{6}$/.test(c)), p.id);
});

test('Colorize text, shape and footage layers in selection order; restore', async () => {
  const { services, comp } = await createTestServices(base());
  const r = await services.executor.run('design.colorize', { palette: 'playground', mode: 'cycle' });
  assert.equal(r.status, 'success', JSON.stringify(r.verification || r.errors));
  const pal = PAL.byId('playground');
  const B = require('../extension/features/brand/brands');
  const shapeFill = named(comp, 'Card').property('ADBE Root Vectors Group').property(1).property('ADBE Vectors Group').property('ADBE Vector Graphic - Fill').property('ADBE Vector Fill Color');
  assert.equal(B.rgbToHex(A(shapeFill.value)), pal.colors[1]);
  const photoFill = named(comp, 'Photo').property('ADBE Effect Parade').property('MOE Palette Fill');
  assert.ok(photoFill);
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.deepEqual(A(shapeFill.value).slice(0, 3), [1, 1, 1]);
});
