'use strict';
/** Fixtures for Brand / Text / Proximity / Select tests. */
const T = (o = {}) => [
  { name: 'Anchor Point', matchName: 'ADBE Anchor Point', valueType: o.threeD ? 'ThreeD_SPATIAL' : 'TwoD_SPATIAL', value: o.threeD ? [0, 0, 0] : [0, 0], keys: [] },
  { name: 'Position', matchName: 'ADBE Position', valueType: o.threeD ? 'ThreeD_SPATIAL' : 'TwoD_SPATIAL', value: o.pos || [960, 540], keys: [] },
  { name: 'Scale', matchName: 'ADBE Scale', valueType: o.threeD ? 'ThreeD' : 'TwoD', value: o.threeD ? [100, 100, 100] : [100, 100], keys: [] },
  ...(o.threeD ? [{ name: 'X Rotation', matchName: 'ADBE Rotate X', valueType: 'OneD', value: 0, keys: [] }, { name: 'Y Rotation', matchName: 'ADBE Rotate Y', valueType: 'OneD', value: 0, keys: [] }] : []),
  { name: 'Rotation', matchName: 'ADBE Rotate Z', valueType: 'OneD', value: o.rot || 0, keys: [] },
  { name: 'Opacity', matchName: 'ADBE Opacity', valueType: 'OneD', value: 100, keys: [] }
];

function studioComp(layers, extra = {}) {
  const { comp, ...rest } = extra;
  return Object.assign({ comp: Object.assign({ name: 'Studio', frameRate: 25, duration: 10, width: 1920, height: 1080, time: 1, layers }, comp || {}) }, rest);
}

module.exports = { T, studioComp };
