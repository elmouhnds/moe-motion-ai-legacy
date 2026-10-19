'use strict';
/** Fixture compositions for mock-host tests. */

const pos = (selectedKeys, extra) => Object.assign({
  name: 'Position', matchName: 'ADBE Position', valueType: 'ThreeD_SPATIAL', selected: true,
  keys: [0, 1, 2].map((t, i) => ({ time: t, value: [i * 100, 0, 0], selected: selectedKeys.includes(i + 1) }))
}, extra || {});

const scale = (selectedKeys) => ({
  name: 'Scale', matchName: 'ADBE Scale', valueType: 'ThreeD', selected: true,
  keys: [0, 1].map((t, i) => ({ time: t, value: [100, 100, 100], selected: selectedKeys.includes(i + 1) }))
});

const opacity = (opts = {}) => Object.assign({
  name: 'Opacity', matchName: 'ADBE Opacity', valueType: 'OneD', selected: true,
  keys: [{ time: 0, value: 0, selected: true }, { time: 0.5, value: 100, selected: true, inInterp: 'HOLD', outInterp: 'HOLD' }]
}, opts);

function easeComp(frameRate = 25) {
  return {
    comp: {
      name: 'Ease Test', frameRate, duration: 10,
      layers: [
        { name: 'Box', selected: true, transform: [pos([1, 2, 3]), scale([1, 2]), opacity()] },
        { name: 'Unselected', transform: [pos([])] }
      ]
    }
  };
}

function staggerComp(frameRate = 29.97, lockedIndex = -1) {
  return {
    comp: {
      name: 'Stagger Test', frameRate, duration: 20,
      selectionOrder: ['C', 'A', 'D', 'B'],
      layers: ['A', 'B', 'C', 'D'].map((n, i) => ({ name: n, selected: true, locked: i === lockedIndex, startTime: 0, transform: [pos([])] }))
    }
  };
}

function exprComp() {
  return {
    comp: {
      name: 'Expr Test', frameRate: 24, duration: 5,
      layers: [
        { name: 'Ctrl', transform: [] },
        { name: 'Target', selected: true, transform: [
          { name: 'Rotation', matchName: 'ADBE Rotate Z', valueType: 'OneD', selected: true, expression: 'time * 90', keys: [] },
          { name: 'Opacity', matchName: 'ADBE Opacity', valueType: 'OneD', selected: true, keys: [] }
        ] }
      ]
    }
  };
}

module.exports = { easeComp, staggerComp, exprComp };
