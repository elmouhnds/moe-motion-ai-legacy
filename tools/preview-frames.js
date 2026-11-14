#!/usr/bin/env node
'use strict';
/**
 * v0.98 Bundled previews, step 1 of 2 (docs/features/RENDERED_PREVIEWS.md): for every library tile the offline renderer
 * can draw, the values of every frame — taken from the SAME pure plans the tools write to After Effects (mattePlan,
 * fxPlan, clickFxPlan, animatePlan, wipe.plan). Step 2 (tools/render-previews.py) turns them into pixels.
 *   node tools/preview-frames.js > frames.json
 */
const path = require('path');
const ROOT = path.join(__dirname, '..', 'extension');
const { SECTIONS } = require(path.join(ROOT, 'app/ui/studio/sections'));
const R = require(path.join(ROOT, 'features/previews/renderer'));
const M = require(path.join(ROOT, 'features/reveal/mattePlan'));
const F = require(path.join(ROOT, 'features/reveal/fxPlan'));
const CP = require(path.join(ROOT, 'features/interact/clickFxPlan'));
const P = require(path.join(ROOT, 'features/quick/animatePlan'));
const WP = require(path.join(ROOT, 'features/quick/wipe'));
const { Registry } = require(path.join(ROOT, 'core/registry'));
const { registerAll } = require(path.join(ROOT, 'features/index'));

const FPS = 15, CARD = [168, 96];
const registry = registerAll(new Registry());
const times = (end, hold = 0.6) => { const out = []; for (let t = -0.2; t <= end + hold + 1e-9; t += 1 / FPS) out.push(Math.round(t * 1000) / 1000); return out; };
const r3 = (v) => (Array.isArray(v) ? v.map(r3) : Math.round(v * 1000) / 1000);

function job(tile) {
  const a = Object.assign({}, tile.args || {});
  const rect = [0, 0, CARD[0], CARD[1]];
  if (tile.tool === 'reveal.matte') {
    const p = M.build(Object.assign({ dir: 'in', duration: 0.8, ease: 'smooth' }, a), rect);
    return { kind: 'matte', cells: p.cells, frames: times(p.end).map((t) => ({ t, v: M.valuesAt(p, t).map((x) => ({ scale: r3(x.scale), position: r3(x.position), roundness: x.roundness })) })) };
  }
  if (tile.tool === 'reveal.fx') {
    const p = F.build(Object.assign({ dir: 'in' }, a), rect);
    const q = (t) => (p.stepped ? Math.floor(t * p.stepped) / p.stepped : t);
    return { kind: 'fx', spec: p, frames: times(p.end).map((t) => ({ t, c: r3(P.valueAt(p.completion, q(t))), e: r3(P.valueAt(p.evolution, q(t))), cl: p.edge ? r3(P.valueAt(p.completion, q(t - p.edge.lag))) : null })) };
  }
  if (tile.tool === 'interact.clickFx') {
    const p = CP.build(Object.assign({}, a, { size: 70, glow: 14 }));
    return { kind: 'click', layers: p.layers.map((L) => ({ role: L.role, primitive: L.primitive, stroke: L.stroke, fill: L.fill, effects: L.effects })), frames: times(p.end).map((t) => ({ t, L: p.layers.map((L) => ({ s: r3(P.valueAt(L.keys.scale, t)), o: r3(P.valueAt(L.keys.opacity, t)), w: L.keys.strokeWidth ? r3(P.valueAt(L.keys.strokeWidth, t)) : null, sc: L.keys.scatter ? r3(P.valueAt(L.keys.scatter, t)) : null })) })) };
  }
  if (tile.tool === 'quick.wipe') {
    const keys = WP.plan(Object.assign({ duration: 0.8, ease: 'smooth' }, a));
    return { kind: 'wipe', angle: (WP.FROM[a.from] || WP.FROM.left).angle, feather: (a.feather || 60) * CARD[0] / 600, frames: times(P.endOf(keys)).map((t) => ({ t, c: r3(P.valueAt(keys, t)) })) };
  }
  if (tile.tool === 'quick.animate' && /^(move|fade|scale|spin)/.test(a.kind || '')) {
    const pose = { position: [0, 0], offset: [1, 1], opacity: 100, scale: [100, 100], rotation: 0 };
    const main = P.animate(a, pose), fade = a.fade ? P.fade(a, pose) : null, blur = P.blur(a);
    const dir = tile.thumb && (tile.thumb.dx !== undefined) ? [tile.thumb.dx, tile.thumb.dy] : [0, 0];
    const end = Math.max(P.endOf(main.keys), fade ? P.endOf(fade.keys) : 0);
    return { kind: 'anim', prop: main.prop, dir, frames: times(end).map((t) => {
      const v = P.valueAt(main.keys, t);
      return { t, v: r3(v), o: fade ? r3(P.valueAt(fade.keys, t)) : (main.prop === 'opacity' ? r3(v) : 100), b: blur ? r3(P.valueAt(blur.keys, t)) : 0 };
    }) };
  }
  return null;
}

const out = [];
for (const s of SECTIONS.filter((x) => x.kind === 'library' && Array.isArray(x.tiles))) {
  for (const tile of s.tiles) {
    if (!['reveal.matte', 'reveal.fx', 'interact.clickFx', 'quick.wipe', 'quick.animate'].includes(tile.tool)) continue;
    const tool = registry && registry.get(tile.tool);
    if (!tool) continue;
    const j = job(tile);
    if (!j) continue;
    out.push(Object.assign({ key: R.keyOf(tile), sig: R.sigOf(tool, tile), label: tile.label, dir: (tile.args && tile.args.dir) || (tile.thumb && tile.thumb.dir) || 'in', fps: FPS, card: CARD }, j));
  }
}
process.stdout.write(JSON.stringify(out));
process.stderr.write(`${out.length} tiles\n`);
