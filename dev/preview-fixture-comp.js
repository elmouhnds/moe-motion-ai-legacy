'use strict';
/** Preview fixture for the Comp workspace: a warm green-screen actor over a cool plate. */
const actor = (u, v) => {
  const inside = (u - 0.5) ** 2 / 0.05 + (v - 0.55) ** 2 / 0.12 < 1;
  if (!inside) return [0.12 + 0.05 * v, 0.72 - 0.1 * v, 0.22, 1];
  const y = 0.3 + 0.4 * (1 - v);
  return [Math.min(1, y * 1.3), y, y * 0.7, 1];
};
const plate = (u, v) => { const y = 0.25 + 0.35 * (1 - v) + 0.1 * u; return [y * 0.8, y * 0.95, Math.min(1, y * 1.25), 1]; };
module.exports = {
  bitsPerChannel: 16,
  comp: {
    name: 'SH010_comp_v02', frameRate: 23.976, duration: 6, time: 2,
    layers: [
      { name: 'GS_Actor_012', selected: true, pixels: actor },
      { name: 'BG_Plate_Street', pixels: plate },
      { name: 'Grain', adjustment: true },
      { name: 'Camera 1', camera: true }
    ]
  }
};
