'use strict';
/** Pixel fixtures for compositing tests. pixels(u, v, t) -> [r, g, b, a], u/v in 0..1. */

const flat = (c) => () => [c[0], c[1], c[2], 1];
/** Warm-cast gradient: luminance ramps left→right with an orange cast. */
const warmGradient = () => (u) => { const y = 0.15 + 0.7 * u; return [Math.min(1, y * 1.25), y, y * 0.75, 1]; };
/** Cool, low-contrast plate. */
const coolPlate = () => (u, v) => { const y = 0.35 + 0.25 * (u * 0.6 + v * 0.4); return [y * 0.85, y * 0.98, Math.min(1, y * 1.2), 1]; };
/** Green screen with a grey subject in the centre. */
const greenScreen = (screen = [0.1, 0.75, 0.2]) => (u, v) => {
  const inside = u > 0.3 && u < 0.7 && v > 0.25 && v < 0.85;
  return inside ? [0.55, 0.45, 0.4, 1] : [screen[0], screen[1], screen[2], 1];
};

function shotComp({ layers, time = 1, bitsPerChannel = 16, effectsOptions } = {}) {
  return {
    bitsPerChannel,
    comp: { name: 'Shot', frameRate: 25, duration: 10, width: 1920, height: 1080, time, effectsOptions, layers }
  };
}

module.exports = { flat, warmGradient, coolPlate, greenScreen, shotComp };
