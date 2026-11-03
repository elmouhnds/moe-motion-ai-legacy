'use strict';
/**
 * Clone Trails (v0.41, docs/features/CLONE_TRAILS.md) — copies of an animated layer, each playing the layer's own
 * motion a little later (Delay frames per copy), fading (Fade % per copy), shrinking (Scale Step) and turning
 * (Rotate Step). One "MOE Trail N" null holds the four live controls; copy k's transform reads the source at
 * time − k × Delay frames. This file is the reference (`at`) and the expressions (`code`) — tests compare them.
 */
const NAME = (n) => `MOE Trail ${n}`;
const TAG = '// MOE Trail';
/* [name, kind, default] — the trail null's controls */
const CONTROLS = [['Delay', 'slider', 3], ['Fade', 'slider', 20], ['Scale Step', 'slider', 6], ['Rotate Step', 'angle', 0]];
const KEY = { Delay: 'delay', Fade: 'fade', 'Scale Step': 'scaleStep', 'Rotate Step': 'rotateStep' };

/** The time copy k reads the source at. */
const timeOf = (k, delay, now, fd) => now - k * delay * fd;
/** How much copy k keeps (0..1) of a per-copy loss in %. */
const keep = (pct, k) => Math.pow(Math.max(0, 1 - pct / 100), k);

/**
 * Reference: copy k at time now. src(t) → { position (comp), scale [x, y(, z)], rotation, opacity } of the source;
 * c = { delay, fade, scaleStep, rotateStep }; fd = frame duration.
 */
function at(k, src, c, now, fd) {
  const s = src(timeOf(k, c.delay, now, fd)), f = keep(c.scaleStep, k);
  return { position: s.position.slice(), scale: s.scale.map((v) => v * f), rotation: s.rotation + k * c.rotateStep, opacity: s.opacity * keep(c.fade, k) };
}

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
/** The four expressions of copy k (plain ES3-style; vector maths with mul()). */
function code(k, sourceName, nullName) {
  const head = [
    `${TAG} · ${esc(nullName)}`,
    `var S = thisComp.layer("${esc(sourceName)}"), C = thisComp.layer("${esc(nullName)}"), k = ${k};`,
    'function c(nm) { return C.effect(nm)(1).value; }',
    'var t = time - k * c("Delay") * thisComp.frameDuration;'
  ].join('\n');
  return {
    // the source's anchor in the comp at that time (the copy is unparented and has the source's anchor)
    position: `${head}\nvar P = S.toComp(S.anchorPoint.valueAtTime(t), t);\nvalue.length > 2 ? [P[0], P[1], P.length > 2 ? P[2] : value[2]] : [P[0], P[1]];`,
    scale: `${head}\nmul(S.transform.scale.valueAtTime(t), Math.pow(Math.max(0, 1 - c("Scale Step") / 100), k));`,
    rotation: `${head}\nS.transform.rotation.valueAtTime(t) + k * c("Rotate Step");`,
    opacity: `${head}\nS.transform.opacity.valueAtTime(t) * Math.pow(Math.max(0, 1 - c("Fade") / 100), k);`
  };
}

module.exports = { NAME, TAG, CONTROLS, KEY, timeOf, keep, at, code };
