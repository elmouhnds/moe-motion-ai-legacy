'use strict';
/** Preview fixture for Text / Brand / Select / Proximity. */
const T = (pos) => [
  { name: 'Anchor Point', matchName: 'ADBE Anchor Point', valueType: 'TwoD_SPATIAL', value: [0, 0], keys: [] },
  { name: 'Position', matchName: 'ADBE Position', valueType: 'TwoD_SPATIAL', value: pos || [960, 540], keys: [] },
  { name: 'Scale', matchName: 'ADBE Scale', valueType: 'TwoD', value: [100, 100], keys: [] },
  { name: 'Rotation', matchName: 'ADBE Rotate Z', valueType: 'OneD', value: 0, keys: [] },
  { name: 'Opacity', matchName: 'ADBE Opacity', valueType: 'OneD', value: 100, keys: [] }
];
module.exports = {
  comp: {
    name: 'PROMO_Ramadan_v04', frameRate: 25, duration: 10, time: 1, projectSelected: true,
    layers: [
      { name: 'Headline EN', selected: true, text: 'Big Savings This Season', label: 9, transform: T([960, 400]) },
      { name: 'Headline AR', selected: true, text: 'عروض رمضان الكبرى', label: 9, transform: T([960, 520]) },
      { name: 'Badge', shapes: [{ name: 'Circle', fill: [1, 0.3, 0.2], stroke: [1, 1, 1] }], label: 2, transform: T([400, 300]) },
      { name: 'Logo', source: { kind: 'image', name: 'logo.png', file: 'logo.png' }, transform: T([1700, 120]) },
      { name: 'Dot 1', shapes: [{ name: 'Dot', fill: [0.9, 0.9, 0.9] }], transform: T([600, 800]) },
      { name: 'Dot 2', shapes: [{ name: 'Dot', fill: [0.9, 0.9, 0.9] }], transform: T([800, 800]) },
      { name: 'BG plate', source: { kind: 'image', name: 'plate.jpg', file: 'plate.jpg' }, locked: true, transform: T() },
      { name: 'Music', source: { kind: 'audio', name: 'bed.wav', file: 'bed.wav' } },
      { name: 'Ctrl', nullLayer: true, shy: true, transform: T() }
    ]
  }
};
