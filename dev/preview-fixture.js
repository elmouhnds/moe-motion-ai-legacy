'use strict';
/** Preview fixture: a typical title comp with a few animated layers. */
const k = (times, sel, valFn) => times.map((t, i) => ({ time: t, value: valFn(i), selected: sel }));
module.exports = {
  comp: {
    name: 'HERO_Title_v03', frameRate: 25, duration: 8,
    layers: [
      { name: 'Title', selected: true, transform: [
        { name: 'Position', matchName: 'ADBE Position', valueType: 'ThreeD_SPATIAL', selected: true, keys: k([0, 0.6, 1.2], true, (i) => [960, 540 + 40 * (2 - i), 0]) },
        { name: 'Scale', matchName: 'ADBE Scale', valueType: 'ThreeD', selected: true, keys: k([0, 0.6], true, (i) => [90 + i * 10, 90 + i * 10, 100]) },
        { name: 'Rotation', matchName: 'ADBE Rotate Z', valueType: 'OneD', keys: [], expression: 'wiggle(2, thisComp.layer("Ctrl").effect("Amount")("Slider"))' }
      ] },
      { name: 'Subtitle', selected: true, transform: [{ name: 'Opacity', matchName: 'ADBE Opacity', valueType: 'OneD', selected: true, keys: k([0.2, 0.8], true, (i) => i * 100) }] },
      { name: 'Logo', selected: true, transform: [] },
      { name: 'Light Sweep', selected: true, transform: [] },
      { name: 'BG', locked: true, transform: [] }
    ]
  }
};
