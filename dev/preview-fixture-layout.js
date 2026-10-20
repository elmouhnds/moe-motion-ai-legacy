'use strict';
/** Preview fixture for Layout (Grid / Adapt), Zoom, Glass and the Quick Bar. */
const T = (pos, anchor, keys) => [
  { name: 'Anchor Point', matchName: 'ADBE Anchor Point', valueType: 'TwoD_SPATIAL', value: anchor || [0, 0], keys: [] },
  { name: 'Position', matchName: 'ADBE Position', valueType: 'TwoD_SPATIAL', value: pos || [960, 540], keys: keys || [], selected: !!keys },
  { name: 'Scale', matchName: 'ADBE Scale', valueType: 'TwoD', value: [100, 100], keys: [] },
  { name: 'Rotation', matchName: 'ADBE Rotate Z', valueType: 'OneD', value: 0, keys: [] },
  { name: 'Opacity', matchName: 'ADBE Opacity', valueType: 'OneD', value: 100, keys: [] }
];
const cards = Array.from({ length: 9 }, (_, i) => ({ name: `Card ${i + 1}`, selected: true, label: 9, shapes: [{ name: 'Card', fill: [0.95, 0.95, 0.95] }], transform: T([300 + (i % 3) * 200, 300 + Math.floor(i / 3) * 200]), rect: { left: -80, top: -60, width: 160, height: 120 } }));
module.exports = {
  comp: {
    name: 'KV_Launch_16x9', frameRate: 25, duration: 10, time: 1, projectSelected: true,
    layers: [
      ...cards,
      { name: 'Logo', label: 2, transform: T([170, 110]), rect: { left: -90, top: -40, width: 180, height: 80 } },
      { name: 'Headline', text: 'The New Collection', label: 9, transform: T([620, 500], null, [{ time: 0, value: [300, 500] }, { time: 1, value: [620, 500] }]), rect: { left: -420, top: -70, width: 840, height: 140 } },
      { name: 'Product', source: { kind: 'image', name: 'product.png', file: 'product.png' }, transform: T([1440, 560]), rect: { left: -300, top: -300, width: 600, height: 600 } },
      { name: 'CTA', shapes: [{ name: 'Button', fill: [1, 0.44, 0.35] }], transform: T([1650, 975]), rect: { left: -130, top: -32, width: 260, height: 64 } },
      { name: 'BG', source: { kind: 'solid', name: 'BG' }, locked: false, transform: T([960, 540], [960, 540]), rect: { left: 0, top: 0, width: 1920, height: 1080 } }
    ]
  }
};
