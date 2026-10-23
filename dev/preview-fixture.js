'use strict';
/** Preview fixture: a typical title comp with a few animated layers. */
const k = (times, sel, valFn) => times.map((t, i) => ({ time: t, value: valFn(i), selected: sel }));
/**
 * Every AV layer in After Effects has all five Transform properties; the fixture used to list only
 * the animated ones, so tools that read Opacity / Scale failed in the preview for a reason that
 * cannot happen in AE (found by tools/audit-ui.js). Listed props override the defaults.
 */
const T = (pos, own) => {
  const base = [
    { name: 'Anchor Point', matchName: 'ADBE Anchor Point', valueType: 'TwoD_SPATIAL', value: [0, 0], keys: [] },
    { name: 'Position', matchName: 'ADBE Position', valueType: 'TwoD_SPATIAL', value: pos, keys: [] },
    { name: 'Scale', matchName: 'ADBE Scale', valueType: 'TwoD', value: [100, 100], keys: [] },
    { name: 'Rotation', matchName: 'ADBE Rotate Z', valueType: 'OneD', value: 0, keys: [] },
    { name: 'Opacity', matchName: 'ADBE Opacity', valueType: 'OneD', value: 100, keys: [] }
  ];
  return base.map((b) => (own || []).find((o) => o.matchName === b.matchName) || b);
};
module.exports = {
  comp: {
    name: 'HERO_Title_v03', frameRate: 25, duration: 8,
    layers: [
      { name: 'Title', selected: true, rect: { left: -320, top: -60, width: 640, height: 120 }, transform: T([960, 540], [
        { name: 'Position', matchName: 'ADBE Position', valueType: 'ThreeD_SPATIAL', value: [960, 540, 0], selected: true, keys: k([0, 0.6, 1.2], true, (i) => [960, 540 + 40 * (2 - i), 0]) },
        { name: 'Scale', matchName: 'ADBE Scale', valueType: 'ThreeD', value: [100, 100, 100], selected: true, keys: k([0, 0.6], true, (i) => [90 + i * 10, 90 + i * 10, 100]) },
        { name: 'Rotation', matchName: 'ADBE Rotate Z', valueType: 'OneD', value: 0, keys: [], expression: 'value + Math.sin(time * 4) * 3 // swing' }
      ]) },
      { name: 'Subtitle', selected: true, rect: { left: -240, top: -30, width: 480, height: 60 }, transform: T([960, 640], [{ name: 'Opacity', matchName: 'ADBE Opacity', valueType: 'OneD', value: 100, selected: true, keys: k([0.2, 0.8], true, (i) => i * 100) }]) },
      { name: 'Logo', selected: true, rect: { left: -80, top: -80, width: 160, height: 160 }, transform: T([1700, 140]) },
      { name: 'Light Sweep', selected: true, rect: { left: -960, top: -540, width: 1920, height: 1080 }, transform: T([960, 540]) },
      { name: 'BG', locked: true, rect: { left: -960, top: -540, width: 1920, height: 1080 }, transform: T([960, 540]) }
    ]
  }
};
