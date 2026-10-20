'use strict';
/** Fixtures for Resize & Adapt / Grid / Zoom / Glass tests. */
const { T, studioComp } = require('./studio');

const TA = (o = {}) => T(o).map((p) => (p.matchName === 'ADBE Anchor Point' && o.anchor ? Object.assign({}, p, { value: o.anchor }) : p));

/** A 1920×1080 key visual: background, logo (top-left), headline (left, animated), product (right), CTA (bottom-right). */
function keyVisual(extra = {}) {
  const headline = TA({ pos: [600, 500] });
  headline[1] = Object.assign({}, headline[1], { keys: [{ time: 0, value: [300, 500] }, { time: 1, value: [600, 500] }] });
  return studioComp([
    { name: 'Logo', transform: TA({ pos: [160, 110] }), rect: { left: -80, top: -40, width: 160, height: 80 } },
    { name: 'Headline', text: 'Big Sale', transform: headline, rect: { left: -400, top: -60, width: 800, height: 120 } },
    { name: 'Product', source: { kind: 'image' }, transform: TA({ pos: [1450, 560] }), rect: { left: -300, top: -300, width: 600, height: 600 } },
    { name: 'CTA', transform: TA({ pos: [1650, 980] }), rect: { left: -120, top: -30, width: 240, height: 60 } },
    { name: 'BG', source: { kind: 'solid' }, transform: TA({ pos: [960, 540], anchor: [960, 540] }), rect: { left: 0, top: 0, width: 1920, height: 1080 } }
  ], Object.assign({ comp: { name: 'KV', time: 1 } }, extra));
}

/** The same key visual nested in a full-frame pre-comp inside a render comp. */
function nestedVisual() {
  const inner = keyVisual().comp;
  return studioComp([
    { name: 'KV Precomp', source: { kind: 'precomp', name: 'KV Main', comp: Object.assign({}, inner, { name: 'KV Main' }) }, transform: TA({ pos: [960, 540], anchor: [960, 540] }), rect: { left: 0, top: 0, width: 1920, height: 1080 } }
  ], { comp: { name: 'Render', time: 1 } });
}

function gridItems(n, extra = {}) {
  const layers = Array.from({ length: n }, (_, i) => ({ name: `Card ${i + 1}`, selected: true, transform: TA({ pos: [100 + i * 10, 100] }), rect: { left: -50, top: -50, width: 100, height: 100 } }));
  return studioComp(layers, extra);
}

module.exports = { TA, keyVisual, nestedVisual, gridItems };
