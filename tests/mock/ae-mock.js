'use strict';
/*
 * Minimal After Effects object-model mock used to exercise the REAL host .jsx
 * files outside After Effects (Node tests and the browser UI preview).
 *
 * It models only what MOE's host ops touch, following the documented
 * behaviour in the After Effects Scripting Guide (docsforadobe.dev).
 * Passing tests against this mock is NOT host verification — see TEST_REPORT.md.
 */

const PropertyValueType = {
  NO_VALUE: 6412, ThreeD_SPATIAL: 6413, ThreeD: 6414, TwoD_SPATIAL: 6415, TwoD: 6416,
  OneD: 6417, COLOR: 6418, CUSTOM_VALUE: 6419, MARKER: 6420, LAYER_INDEX: 6421,
  MASK_INDEX: 6422, SHAPE: 6423, TEXT_DOCUMENT: 6424
};
const KeyframeInterpolationType = { LINEAR: 6612, BEZIER: 6613, HOLD: 6614 };
const AutoOrientType = { NO_AUTO_ORIENT: 4212, ALONG_PATH: 4213, CAMERA_OR_POINT_OF_INTEREST: 4214, CHARACTERS_TOWARD_CAMERA: 4215 };
const PropertyType = { PROPERTY: 6812, INDEXED_GROUP: 6813, NAMED_GROUP: 6814 };
const ParagraphDirection = { DIRECTION_LEFT_TO_RIGHT: 1, DIRECTION_RIGHT_TO_LEFT: 2 };
const ParagraphJustification = { LEFT_JUSTIFY: 7413, RIGHT_JUSTIFY: 7414, CENTER_JUSTIFY: 7415, FULL_JUSTIFY_LASTLINE_LEFT: 7416 };
const ComposerEngine = { UNIVERSAL_TYPE_ENGINE: 1, LATIN_CJK_ENGINE: 2 };
const CTScript = { CT_ROMAN_SCRIPT: 0, CT_ARABIC_SCRIPT: 4 };

/** TextDocument: fillColor throws on read when applyFill is false (as documented). */
class TextDocument {
  constructor(text, o = {}) {
    this.text = text;
    this.font = o.font || 'ArialMT';
    this.applyFill = o.applyFill !== false;
    this.applyStroke = !!o.applyStroke;
    this._fill = o.fillColor || [1, 1, 1];
    this._stroke = o.strokeColor || [0, 0, 0];
    this.direction = o.direction || ParagraphDirection.DIRECTION_LEFT_TO_RIGHT;
    // v0.37: paragraph facts the Text Cloner reads (TextDocument.fontSize / justification / leading / autoLeading / boxText)
    this.fontSize = o.fontSize || 100;
    this.justification = o.justification || ParagraphJustification.LEFT_JUSTIFY;
    this.autoLeading = o.leading === undefined;
    this.leading = o.leading || this.fontSize * 1.2;
    this.boxText = !!o.boxText;
    this.composerEngine = ComposerEngine.UNIVERSAL_TYPE_ENGINE;
  }
  get fillColor() { if (!this.applyFill) throw new Error('After Effects error: fillColor not available'); return this._fill.slice(); }
  set fillColor(v) { this._fill = v.slice(); this.applyFill = true; }
  get strokeColor() { if (!this.applyStroke) throw new Error('After Effects error: strokeColor not available'); return this._stroke.slice(); }
  set strokeColor(v) { this._stroke = v.slice(); }
  clone() { const d = new TextDocument(this.text); Object.assign(d, this); d._fill = this._fill.slice(); d._stroke = this._stroke.slice(); return d; }
}

class KeyframeEase {
  constructor(speed, influence) {
    if (arguments.length < 2) throw new Error('KeyframeEase requires speed and influence');
    if (influence < 0.1 || influence > 100) throw new Error('After Effects error: influence out of range [0.1..100]');
    this.speed = speed;
    this.influence = influence;
  }
}

function clone(v) { return Array.isArray(v) ? v.slice() : (v && v.clone ? v.clone() : v); }

/**
 * Minimal expression evaluator for the probe: runs the expression as JavaScript
 * with thisComp / time / value bound. Layers expose sampleImage() computed from
 * the fixture's procedural pixel function (spec.pixels(u, v, t) -> [r,g,b,a]).
 */
function evalExpression(prop, t) {
  return require('./ae-expr').evaluate(prop, t, { layerExtras: (L) => (L && L.width ? { sampleImage: sampleable(L).sampleImage } : {}) });
}

function sampleable(layer) {
  if (!layer) throw new Error('Expression error: layer index out of range');
  return {
    width: layer.width, height: layer.height, name: layer.name,
    sampleImage(point, radius, postEffect, t) {
      layer._comp._sampleCalls = (layer._comp._sampleCalls || 0) + 1;
      const px = layer._pixels;
      const acc = [0, 0, 0, 0];
      const N = 5;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const x = point[0] - radius[0] + (2 * radius[0] * (i + 0.5)) / N;
          const y = point[1] - radius[1] + (2 * radius[1] * (j + 0.5)) / N;
          const c = postEffect ? renderEffects(layer, px(x / layer.width, y / layer.height, t), x, y, t) : px(x / layer.width, y / layer.height, t);
          for (let k = 0; k < 3; k++) acc[k] += (c[k] * c[3]) / (N * N);
          acc[3] += c[3] / (N * N);
        }
      }
      // Unpremultiplied result, like sampleImage.
      return acc[3] > 0 ? [acc[0] / acc[3], acc[1] / acc[3], acc[2] / acc[3], acc[3]] : [0, 0, 0, 0];
    }
  };
}

/** Post-effect pixel simulation for the effects MOE adds (enabled ones only, in stack order). */
function renderEffects(layer, rgba, x, y, t) {
  let c = rgba.slice();
  for (const fx of (layer._parade ? layer._parade._children : [])) {
    if (!fx.enabled) continue;
    // v0.99.5: Linear Wipe as measured in After Effects 26.5 by the Self-Test — at 90° it HIDES from the left as
    // Transition Completion rises (travel direction (sin a, −cos a) in layer space, y down); feather ignored
    if (fx.matchName === 'ADBE Linear Wipe' && x !== undefined) {
      const at = (n) => { const p = fx._children.find((q) => q.name === n); return t !== undefined && p.numKeys ? p.valueAtTime(t, false) : p.value; };
      const a = at('Wipe Angle') * Math.PI / 180, done = at('Transition Completion') / 100;
      const u = (x / layer.width - 0.5) * Math.sin(a) - (y / layer.height - 0.5) * Math.cos(a) + 0.5;
      if (u < done) c = [c[0], c[1], c[2], 0];
      continue;
    }
    // v0.40 mock: Gradient Ramp (linear) replaces the colour along Start → End (layer space)
    if (fx.matchName === 'ADBE Ramp' && x !== undefined) {
      const v = (n) => fx._children.find((q) => q.name === n).value;
      const a = v('Start of Ramp'), b = v('End of Ramp'), ca = v('Start Color'), cb = v('End Color');
      const dx = b[0] - a[0], dy = b[1] - a[1], u = Math.min(Math.max(((x - a[0]) * dx + (y - a[1]) * dy) / Math.max(dx * dx + dy * dy, 1e-9), 0), 1);
      c = [0, 1, 2].map((k) => ca[k] + (cb[k] - ca[k]) * u).concat([c[3]]);
      continue;
    }
    if (fx.matchName === 'ADBE CHANNEL MIXER') {
      const v = fx._children.map((p) => p.value / 100);
      c = [0, 1, 2].map((r) => v[r * 4] * c[0] + v[r * 4 + 1] * c[1] + v[r * 4 + 2] * c[2] + v[r * 4 + 3]).concat([c[3]]);
    } else if (fx.matchName === 'Keylight 906') {
      const sc = fx._children[2].value;
      const d = Math.hypot(c[0] - sc[0], c[1] - sc[1], c[2] - sc[2]);
      if (d < 0.3) c = [c[0], c[1], c[2], 0];
    }
  }
  return c;
}

/* Effect catalog: param specs in UI order. Param matchNames follow "<effect>-NNNN". */
const MIXER_NAMES = ['Red-Red', 'Red-Green', 'Red-Blue', 'Red-Const', 'Green-Red', 'Green-Green', 'Green-Blue', 'Green-Const', 'Blue-Red', 'Blue-Green', 'Blue-Blue', 'Blue-Const'];
const EFFECTS = {
  'ADBE Color Control': [{ name: 'Color', valueType: 'COLOR', value: [1, 0, 0, 1] }],
  'ADBE CHANNEL MIXER': [...MIXER_NAMES.map((n) => ({ name: n, valueType: 'OneD', value: ['Red-Red', 'Green-Green', 'Blue-Blue'].includes(n) ? 100 : 0 })), { name: 'Monochrome', valueType: 'OneD', value: 0 }],
  'Keylight 906': [{ name: 'View', valueType: 'OneD', value: 1 }, { name: 'Unpremultiply Result', valueType: 'OneD', value: 1 }, { name: 'Screen Colour', valueType: 'COLOR', value: [0, 0, 0, 1] }, { name: 'Screen Gain', valueType: 'OneD', value: 100 }],
  'ADBE KeyCleaner': [{ name: 'Additional Edge Radius', valueType: 'OneD', value: 1 }],
  'ADBE Spill2': [{ name: 'Method', valueType: 'OneD', value: 1 }],
  'ADBE Simple Choker': [{ name: 'View', valueType: 'OneD', value: 1 }, { name: 'Choke Matte', valueType: 'OneD', value: 0 }],
  'ADBE Gaussian Blur 2': [{ name: 'Blurriness', valueType: 'OneD', value: 0 }, { name: 'Blur Dimensions', valueType: 'OneD', value: 1 }, { name: 'Repeat Edge Pixels', valueType: 'OneD', value: 0 }],
  // v0.99.1: After Effects 26.5 as the Tile Test read it (13 parameters; match names NOT in display order — Uniform Scale is
  // -0011 at position 3; the apostrophe of "Use Composition’s" is typographic). Parameters 12–13 were cut off in the
  // report: their names here are stand-ins (unverified).
  'ADBE Geometry2': [{ name: 'Anchor Point', mn: 1, valueType: 'TwoD_SPATIAL', value: [960, 540] }, { name: 'Position', mn: 2, valueType: 'TwoD_SPATIAL', value: [960, 540] }, { name: 'Uniform Scale', mn: 11, valueType: 'OneD', value: 1 },
    { name: 'Scale Height', mn: 3, valueType: 'OneD', value: 100 }, { name: 'Scale Width', mn: 4, valueType: 'OneD', value: 100 }, { name: 'Skew', mn: 5, valueType: 'OneD', value: 0 }, { name: 'Skew Axis', mn: 6, valueType: 'OneD', value: 0 },
    { name: 'Rotation', mn: 7, valueType: 'OneD', value: 0 }, { name: 'Opacity', mn: 8, valueType: 'OneD', value: 100 }, { name: 'Use Composition\u2019s Shutter Angle', mn: 9, valueType: 'OneD', value: 1 }, { name: 'Shutter Angle', mn: 10, valueType: 'OneD', value: 0 }, { name: 'Shutter Phase', mn: 12, valueType: 'OneD', value: 0 }, { name: 'Sampling', mn: 13, valueType: 'OneD', value: 1 }],
  'ADBE Optics Compensation': [{ name: 'Field Of View (FOV)', valueType: 'OneD', value: 0 }, { name: 'Reverse Lens Distortion', valueType: 'OneD', value: 0 }, { name: 'FOV Orientation', valueType: 'OneD', value: 1 },
    { name: 'View Center', valueType: 'TwoD_SPATIAL', value: [960, 540] }, { name: 'Optimal Pixels (Invalidates Reversal)', valueType: 'OneD', value: 0 }, { name: 'Resize', valueType: 'OneD', value: 1 }],
  'ADBE Brightness & Contrast 2': [{ name: 'Brightness', valueType: 'OneD', value: 0 }, { name: 'Contrast', valueType: 'OneD', value: 0 }, { name: 'Use Legacy', valueType: 'OneD', value: 0 }],
  'ADBE Bevel Alpha': [{ name: 'Edge Thickness', valueType: 'OneD', value: 2 }, { name: 'Light Angle', valueType: 'OneD', value: -60 }, { name: 'Light Color', valueType: 'COLOR', value: [1, 1, 1, 1] }, { name: 'Light Intensity', valueType: 'OneD', value: 0.4 }],
  'ADBE Point Control': [{ name: 'Point', valueType: 'TwoD_SPATIAL', value: [0, 0] }],
  'ADBE Point3D Control': [{ name: '3D Point', valueType: 'ThreeD_SPATIAL', value: [0, 0, 0] }],
  'ADBE Angle Control': [{ name: 'Angle', valueType: 'OneD', value: 0 }],
  'ADBE Layer Control': [{ name: 'Layer', valueType: 'LAYER_INDEX', value: 0 }],
  'ADBE Dropdown Control': [{ name: 'Menu', valueType: 'OneD', value: 1 }],
  // v0.59 Styles: After Effects' own parameter names (Drop Shadow, Glow, CC Light Sweep)
  'ADBE Drop Shadow': [{ name: 'Shadow Color', valueType: 'COLOR', value: [0, 0, 0, 1] }, { name: 'Opacity', valueType: 'OneD', value: 50 }, { name: 'Direction', valueType: 'OneD', value: 135 }, { name: 'Distance', valueType: 'OneD', value: 5 }, { name: 'Softness', valueType: 'OneD', value: 0 }, { name: 'Shadow Only', valueType: 'OneD', value: 0 }],
  'ADBE Glo2': [{ name: 'Glow Based On', valueType: 'OneD', value: 2 }, { name: 'Glow Threshold', valueType: 'OneD', value: 60 }, { name: 'Glow Radius', valueType: 'OneD', value: 10 }, { name: 'Glow Intensity', valueType: 'OneD', value: 1 }, { name: 'Composite Original', valueType: 'OneD', value: 2 }, { name: 'Glow Operation', valueType: 'OneD', value: 3 }, { name: 'Glow Colors', valueType: 'OneD', value: 1 }, { name: 'Color Looping', valueType: 'OneD', value: 3 }, { name: 'Color Loops', valueType: 'OneD', value: 1 }, { name: 'Color Phase', valueType: 'OneD', value: 0 }, { name: 'A & B Midpoint', valueType: 'OneD', value: 50 }, { name: 'Color A', valueType: 'COLOR', value: [1, 1, 1, 1] }, { name: 'Color B', valueType: 'COLOR', value: [0, 0, 0, 1] }, { name: 'Glow Dimensions', valueType: 'OneD', value: 1 }],
  // v0.63 Wipe Reveal: After Effects' Linear Wipe, its parameter names
  'ADBE Linear Wipe': [{ name: 'Transition Completion', valueType: 'OneD', value: 0 }, { name: 'Wipe Angle', valueType: 'OneD', value: 90 }, { name: 'Feather', valueType: 'OneD', value: 0 }],
  'CC Light Sweep': [{ name: 'Center', valueType: 'TwoD_SPATIAL', value: [0, 0] }, { name: 'Direction', valueType: 'OneD', value: -30 }, { name: 'Shape', valueType: 'OneD', value: 1 }, { name: 'Width', valueType: 'OneD', value: 50 }, { name: 'Sweep Intensity', valueType: 'OneD', value: 50 }, { name: 'Edge Intensity', valueType: 'OneD', value: 100 }, { name: 'Edge Thickness', valueType: 'OneD', value: 1 }, { name: 'Light Color', valueType: 'COLOR', value: [1, 1, 1, 1] }, { name: 'Light Reception', valueType: 'OneD', value: 1 }],
  'ADBE Tint': [{ name: 'Map Black To', valueType: 'COLOR', value: [0, 0, 0, 1] }, { name: 'Map White To', valueType: 'COLOR', value: [1, 1, 1, 1] }, { name: 'Amount to Tint', valueType: 'OneD', value: 100 }],
  'ADBE Ramp': [{ name: 'Start of Ramp', valueType: 'TwoD_SPATIAL', value: [0, 0] }, { name: 'Start Color', valueType: 'COLOR', value: [0, 0, 0, 1] }, { name: 'End of Ramp', valueType: 'TwoD_SPATIAL', value: [0, 100] }, { name: 'End Color', valueType: 'COLOR', value: [1, 1, 1, 1] }, { name: 'Ramp Shape', valueType: 'OneD', value: 1 }, { name: 'Ramp Scatter', valueType: 'OneD', value: 0 }, { name: 'Blend With Original', valueType: 'OneD', value: 0 }],
  'ADBE 4ColorGradient': [{ name: 'Point 1', valueType: 'TwoD_SPATIAL', value: [0, 0] }, { name: 'Color 1', valueType: 'COLOR', value: [1, 1, 0, 1] }, { name: 'Point 2', valueType: 'TwoD_SPATIAL', value: [100, 0] }, { name: 'Color 2', valueType: 'COLOR', value: [0, 1, 0, 1] }, { name: 'Point 3', valueType: 'TwoD_SPATIAL', value: [0, 100] }, { name: 'Color 3', valueType: 'COLOR', value: [1, 0, 1, 1] }, { name: 'Point 4', valueType: 'TwoD_SPATIAL', value: [100, 100] }, { name: 'Color 4', valueType: 'COLOR', value: [0, 0, 1, 1] }, { name: 'Blend', valueType: 'OneD', value: 100 }, { name: 'Jitter', valueType: 'OneD', value: 0 }, { name: 'Opacity', valueType: 'OneD', value: 100 }, { name: 'Blending Mode', valueType: 'OneD', value: 1 }],
  'ADBE Noise': [{ name: 'Amount of Noise', valueType: 'OneD', value: 0 }, { name: 'Noise Type', valueType: 'OneD', value: 1 }, { name: 'Clipping', valueType: 'OneD', value: 1 }],
  'ADBE Fill': [{ name: 'Fill Mask', valueType: 'OneD', value: 0 }, { name: 'All Masks', valueType: 'OneD', value: 0 }, { name: 'Color', valueType: 'COLOR', value: [1, 0, 0, 1] }, { name: 'Invert', valueType: 'OneD', value: 0 }, { name: 'Horizontal Feather', valueType: 'OneD', value: 0 }, { name: 'Vertical Feather', valueType: 'OneD', value: 0 }, { name: 'Opacity', valueType: 'OneD', value: 1 }],
  'ADBE Slider Control': [{ name: 'Slider', valueType: 'OneD', value: 0 }],
  // CC Glass (Cycore, bundled with AE). Names as shown in Effect Controls; topic headers are NO_VALUE entries.
  // UNVERIFIED in After Effects - effects.ensure fails with the real list if a name differs.
  'CC Glass': [{ name: 'Surface', valueType: 'NO_VALUE', value: 0 }, { name: 'Bump Map', valueType: 'LAYER_INDEX', value: 0 }, { name: 'Property', valueType: 'OneD', value: 4 },
    { name: 'Softness', valueType: 'OneD', value: 10 }, { name: 'Height', valueType: 'OneD', value: 50 }, { name: 'Displacement', valueType: 'OneD', value: 100 },
    { name: 'Light', valueType: 'NO_VALUE', value: 0 }, { name: 'Using', valueType: 'OneD', value: 1 }, { name: 'Light Intensity', valueType: 'OneD', value: 100 }, { name: 'Light Color', valueType: 'COLOR', value: [1, 1, 1, 1] },
    { name: 'Light Type', valueType: 'OneD', value: 1 }, { name: 'Light Height', valueType: 'OneD', value: 50 }, { name: 'Light Position', valueType: 'TwoD_SPATIAL', value: [960, 540] }, { name: 'Light Direction', valueType: 'OneD', value: -45 },
    { name: 'Shading', valueType: 'NO_VALUE', value: 0 }, { name: 'Ambient', valueType: 'OneD', value: 75 }, { name: 'Diffuse', valueType: 'OneD', value: 0 }, { name: 'Specular', valueType: 'OneD', value: 25 }, { name: 'Roughness', valueType: 'OneD', value: 0.1, range: [0.00099182128906, 0.5] }, { name: 'Metal', valueType: 'OneD', value: 100 }],
  'ADBE Checkbox Control': [{ name: 'Checkbox', valueType: 'OneD', value: 0 }],
  // v0.96 Matte FX: Gradient Wipe, Fractal Noise, Turbulent Displace — names as in Effect Controls (topic headers are
  // NO_VALUE). UNVERIFIED in After Effects: effects.ensure fails with the real list if a name differs (Self-Test fxMatte).
  'ADBE Gradient Wipe': [{ name: 'Transition Completion', valueType: 'OneD', value: 0, range: [0, 1] }, { name: 'Transition Softness', valueType: 'OneD', value: 0, range: [0, 1] }, { name: 'Gradient Layer', valueType: 'LAYER_INDEX', value: 0 }, { name: 'Gradient Placement', valueType: 'OneD', value: 3 }, { name: 'Invert Gradient', valueType: 'OneD', value: 0 }],
  'ADBE Fractal Noise': [{ name: 'Fractal Type', valueType: 'OneD', value: 1 }, { name: 'Noise Type', valueType: 'OneD', value: 3 }, { name: 'Invert', valueType: 'OneD', value: 0 }, { name: 'Contrast', valueType: 'OneD', value: 100 }, { name: 'Brightness', valueType: 'OneD', value: 0 }, { name: 'Overflow', valueType: 'OneD', value: 3 },
    { name: 'Transform', valueType: 'NO_VALUE', value: 0 }, { name: 'Rotation', valueType: 'OneD', value: 0 }, { name: 'Uniform Scaling', valueType: 'OneD', value: 1 }, { name: 'Scale', valueType: 'OneD', value: 100 }, { name: 'Scale Width', valueType: 'OneD', value: 100 }, { name: 'Scale Height', valueType: 'OneD', value: 100 }, { name: 'Offset Turbulence', valueType: 'TwoD_SPATIAL', value: [960, 540] }, { name: 'Perspective Offset', valueType: 'OneD', value: 0 },
    { name: 'Complexity', valueType: 'OneD', value: 6 }, { name: 'Sub Settings', valueType: 'NO_VALUE', value: 0 }, { name: 'Sub Influence (%)', valueType: 'OneD', value: 70 }, { name: 'Sub Scaling', valueType: 'OneD', value: 56 }, { name: 'Sub Rotation', valueType: 'OneD', value: 0 }, { name: 'Sub Offset', valueType: 'TwoD', value: [0, 0] }, { name: 'Center Subscale', valueType: 'OneD', value: 0 },
    { name: 'Evolution', valueType: 'OneD', value: 0 }, { name: 'Evolution Options', valueType: 'NO_VALUE', value: 0 }, { name: 'Cycle Evolution', valueType: 'OneD', value: 0 }, { name: 'Cycle (in Revolutions)', valueType: 'OneD', value: 1 }, { name: 'Random Seed', valueType: 'OneD', value: 0 }, { name: 'Opacity', valueType: 'OneD', value: 100 }, { name: 'Blending Mode', valueType: 'OneD', value: 1 }],
  // v0.98 Click VFX: Mosaic and CC Ball Action (Cycore, bundled) — UNVERIFIED names, Self-Test clickFx checks them
  'ADBE Mosaic': [{ name: 'Horizontal Blocks', valueType: 'OneD', value: 10 }, { name: 'Vertical Blocks', valueType: 'OneD', value: 10 }, { name: 'Sharp Colors', valueType: 'OneD', value: 0 }],
  'CC Ball Action': [{ name: 'Scatter', valueType: 'OneD', value: 0 }, { name: 'Rotation Axis', valueType: 'OneD', value: 1 }, { name: 'Rotation', valueType: 'OneD', value: 0 }, { name: 'Twist Property', valueType: 'OneD', value: 1 }, { name: 'Twist Angle', valueType: 'OneD', value: 0 }, { name: 'Grid Spacing', valueType: 'OneD', value: 4 }, { name: 'Ball Size', valueType: 'OneD', value: 100 }, { name: 'Instability State', valueType: 'OneD', value: 0 }],
  'ADBE Posterize Time': [{ name: 'Frame Rate', valueType: 'OneD', value: 24 }],
  'ADBE Turbulent Displace': [{ name: 'Displacement', valueType: 'OneD', value: 1 }, { name: 'Amount', valueType: 'OneD', value: 50 }, { name: 'Size', valueType: 'OneD', value: 100 }, { name: 'Offset (Turbulence)', valueType: 'TwoD_SPATIAL', value: [960, 540] }, { name: 'Complexity', valueType: 'OneD', value: 1 }, { name: 'Evolution', valueType: 'OneD', value: 0 },
    { name: 'Evolution Options', valueType: 'NO_VALUE', value: 0 }, { name: 'Cycle Evolution', valueType: 'OneD', value: 0 }, { name: 'Cycle (in Revolutions)', valueType: 'OneD', value: 1 }, { name: 'Random Seed', valueType: 'OneD', value: 0 }, { name: 'Pinning', valueType: 'OneD', value: 3 }, { name: 'Resize Layer', valueType: 'OneD', value: 0 }, { name: 'Antialiasing for Best Quality', valueType: 'OneD', value: 1 }]
};

class MockEffect {
  constructor(matchName, parade, opts) {
    this.matchName = matchName;
    this.name = (opts.displayNames && opts.displayNames[matchName]) || matchName;
    this.propertyType = PropertyType.NAMED_GROUP;
    this.parentProperty = parade;
    this.propertyDepth = 2;
    this.enabled = true;
    const specs = (EFFECTS[matchName] || []).filter((p) => !(opts.dropParams || []).includes(p.name));
    this._children = specs.map((p, i) => new MockProperty({
      name: opts.locale ? `${opts.locale}:${p.name}` : p.name,
      matchName: `${matchName}-${String(p.mn || i + 1).padStart(4, '0')}`,
      valueType: p.valueType, value: p.value, canSetExpression: true, range: p.range
    }, this, i + 1));
  }
  get propertyIndex() { return this.parentProperty._children.indexOf(this) + 1; }
  get numProperties() { return this._children.length; }
  property(key) { return MockGroup.prototype.property.call(this, key); }
  propertyGroup(countUp) { return MockProperty.prototype.propertyGroup.call(this, countUp); }
  remove() { this.parentProperty._children.splice(this.propertyIndex - 1, 1); }
  moveTo(i) {
    const list = this.parentProperty._children;
    if (i < 1 || i > list.length) throw new Error('After Effects error: invalid index');
    list.splice(this.propertyIndex - 1, 1);
    list.splice(i - 1, 0, this);
  }
}

class MockParade {
  constructor(layer, opts) {
    this.name = 'Effects';
    this.matchName = 'ADBE Effect Parade';
    this.propertyType = PropertyType.INDEXED_GROUP;
    this.parentProperty = layer;
    this.propertyDepth = 1;
    this.propertyIndex = 2;
    this._opts = opts;
    this._children = [];
  }
  get numProperties() { return this._children.length; }
  property(key) { return MockGroup.prototype.property.call(this, key); }
  propertyGroup(countUp) { return MockProperty.prototype.propertyGroup.call(this, countUp); }
  canAddProperty(matchName) { return Object.prototype.hasOwnProperty.call(EFFECTS, matchName) && !(this._opts.unavailable || []).includes(matchName); }
  addProperty(matchName) {
    if (!this.canAddProperty(matchName)) throw new Error('After Effects error: cannot add ' + matchName);
    const fx = new MockEffect(matchName, this, this._opts);
    this._children.push(fx);
    return fx;
  }
}

const DEFAULT_TRANSFORM = [
  { name: 'Anchor Point', matchName: 'ADBE Anchor Point', valueType: 'TwoD_SPATIAL', value: [0, 0], keys: [] },
  { name: 'Position', matchName: 'ADBE Position', valueType: 'TwoD_SPATIAL', value: [0, 0], keys: [] },
  { name: 'Scale', matchName: 'ADBE Scale', valueType: 'TwoD', value: [100, 100], keys: [] },
  { name: 'Rotation', matchName: 'ADBE Rotate Z', valueType: 'OneD', value: 0, keys: [] },
  { name: 'Opacity', matchName: 'ADBE Opacity', valueType: 'OneD', value: 100, keys: [] }
];

const DEFAULT_FONTS = [
  [{ postScriptName: 'ArialMT', familyName: 'Arial', styleName: 'Regular', writingScripts: [0] }],
  [{ postScriptName: 'Montserrat-Bold', familyName: 'Montserrat', styleName: 'Bold', writingScripts: [0] }, { postScriptName: 'Montserrat-Regular', familyName: 'Montserrat', styleName: 'Regular', writingScripts: [0] }],
  [{ postScriptName: 'Cairo-Bold', familyName: 'Cairo', styleName: 'Bold', writingScripts: [0, 4] }]
];

function dimsFor(valueType) {
  if (valueType === PropertyValueType.TwoD) return 2;
  if (valueType === PropertyValueType.ThreeD) return 3;
  return 1;
}

class MockProperty {
  constructor(spec, parent, index) {
    this.name = spec.name;
    this.matchName = spec.matchName || spec.name;
    this.propertyType = PropertyType.PROPERTY;
    this.propertyValueType = PropertyValueType[spec.valueType || 'OneD'];
    this._range = spec.range || null; // v0.99.1: a parameter After Effects limits (Tile Test on AE 26.5)
    this.isSpatial = /SPATIAL/.test(spec.valueType || '');
    this.canVaryOverTime = true;
    this.canSetExpression = spec.canSetExpression !== false;
    this.parentProperty = parent;
    this.propertyIndex = index;
    this.propertyDepth = parent.propertyDepth + 1;
    this._value = spec.value !== undefined ? clone(spec.value) : 0;
    this._expression = spec.expression || '';
    this.expressionEnabled = !!spec.expression;
    this.expressionError = '';
    const dims = dimsFor(this.propertyValueType);
    const linear = () => Array.from({ length: dims }, () => ({ speed: 0, influence: 16.666666667 }));
    this._keys = (spec.keys || []).map((k) => ({
      t: k.time, value: k.value,
      inInterp: KeyframeInterpolationType[k.inInterp || 'LINEAR'],
      outInterp: KeyframeInterpolationType[k.outInterp || 'LINEAR'],
      easeIn: linear(), easeOut: linear(), selected: !!k.selected
    }));
  }
  _layer() { return this.propertyGroup(this.propertyDepth); }
  propertyGroup(countUp) {
    let p = this;
    for (let i = 0; i < (countUp || 1); i++) p = p.parentProperty;
    return p;
  }
  get numKeys() { return this._keys.length; }
  setSelectedAtKey(i, on) { const k = this._keys[i - 1]; if (!k) throw new Error('After Effects error: no key ' + i); k.selected = !!on; }
  get selectedKeys() {
    const out = [];
    this._keys.forEach((k, i) => { if (k.selected) out.push(i + 1); });
    return out;
  }
  _key(i) {
    if (i < 1 || i > this._keys.length) throw new Error('After Effects error: keyIndex out of range');
    return this._keys[i - 1];
  }
  keyTime(i) { return this._key(i).t + this._layer().startTime; }
  keyValue(i) { return this._key(i).value; }
  keyInInterpolationType(i) { return this._key(i).inInterp; }
  keyOutInterpolationType(i) { return this._key(i).outInterp; }
  keyInTemporalEase(i) { return this._key(i).easeIn.map((e) => new KeyframeEase(e.speed, e.influence)); }
  keyOutTemporalEase(i) { return this._key(i).easeOut.map((e) => new KeyframeEase(e.speed, e.influence)); }
  setInterpolationTypeAtKey(i, inType, outType) {
    const k = this._key(i);
    k.inInterp = inType;
    k.outInterp = outType === undefined ? inType : outType;
  }
  setTemporalEaseAtKey(i, inEase, outEase) {
    const dims = dimsFor(this.propertyValueType);
    const out = outEase || inEase;
    if (!Array.isArray(inEase) || inEase.length !== dims || out.length !== dims) {
      throw new Error('After Effects error: temporal ease array must contain ' + dims + ' KeyframeEase objects');
    }
    const k = this._key(i);
    k.easeIn = inEase.map((e) => ({ speed: e.speed, influence: e.influence }));
    k.easeOut = out.map((e) => ({ speed: e.speed, influence: e.influence }));
  }
  get value() {
    this._checkStale();
    // A layer parameter points at a LAYER, not at a number: After Effects shows the layer's current index and follows it
    // when layers are added, removed or reordered (0 = None once its layer is gone). v0.90: the mock kept the raw index,
    // so a second effector added on top silently re-pointed the first slot.
    if (this.propertyValueType === PropertyValueType.LAYER_INDEX && this._ref !== undefined) {
      const layers = this._layer()._comp._layers, i = this._ref ? layers.indexOf(this._ref) : -1;
      return i < 0 ? 0 : i + 1;
    }
    return clone(this._value);
  }
  /** v0.98.1: a Dropdown Menu Control starts with 3 items (After Effects' default) and refuses a value outside its list —
   *  the owner's After Effects reported "Value 6 out of range 1 to 3" when a menu was set before its items were. */
  // Property.hasMin / minValue / hasMax / maxValue (Scripting Guide) — from the modelled range
  get hasMin() { return !!this._range; }
  get hasMax() { return !!this._range; }
  get minValue() { if (!this._range) throw new Error('After Effects error: no minimum'); return this._range[0]; }
  get maxValue() { if (!this._range) throw new Error('After Effects error: no maximum'); return this._range[1]; }
  // PropertyBase.selected (read/write, Scripting Guide) — the tile test selects a property as a click does
  get selected() { return !!this._selected; }
  set selected(v) { this._selected = !!v; }
  _checkRange(v, i) {
    if (!this._range || typeof v !== 'number') return;
    if (v < this._range[0] || v > this._range[1]) throw new Error(`After Effects error: Unable to call "${i ? 'setValueAtTime' : 'setValue'}" because of parameter ${i ? 2 : 1}. Value ${v} out of range ${this._range[0]} to ${this._range[1]}.`);
  }
  _checkMenu(v) {
    if (!/Dropdown Control/.test(this.matchName || '')) return;
    const n = (this._menuItems || ['Item 1', 'Item 2', 'Item 3']).length;
    if (!(v >= 1 && v <= n)) throw new Error(`After Effects error: Unable to call "setValue" because of parameter 1. Value ${v} out of range 1 to ${n}.`);
  }
  _checkHidden() {
    const L = this._hidden3D || /^ADBE (Rotate X|Rotate Y|Orientation)$/.test(this.matchName || '') ? this._layer() : null;
    if (L && !L.threeDLayer) throw new Error('After Effects error: Can not "set value" with this property, because the property or a parent property is hidden.');
  }
  setValue(v) {
    this._checkStale();
    this._checkHidden();
    this._checkMenu(v);
    this._checkRange(v, 0);
    if (this.propertyValueType === PropertyValueType.COLOR && (!Array.isArray(v) || v.length !== 4)) throw new Error('After Effects error: color value must have 4 components');
    if (this.propertyValueType === PropertyValueType.LAYER_INDEX) { const layers = this._layer()._comp._layers; this._ref = v >= 1 && v <= layers.length ? layers[v - 1] : null; }
    this._value = clone(v);
  }
  setValueAtTime(t, v) {
    this._checkMenu(v);
    this._checkRange(v, 1);
    const lt = t - this._layer().startTime;
    const dims = dimsFor(this.propertyValueType);
    const lin = () => Array.from({ length: dims }, () => ({ speed: 0, influence: 16.666666667 }));
    let k = this._keys.find((x) => Math.abs(x.t - lt) < 1e-9);
    if (!k) {
      k = { t: lt, value: null, inInterp: KeyframeInterpolationType.LINEAR, outInterp: KeyframeInterpolationType.LINEAR, easeIn: lin(), easeOut: lin(), selected: false };
      this._keys.push(k);
      this._keys.sort((a, b) => a.t - b.t);
    }
    k.value = clone(v);
  }
  valueAtTime(t, preExpression) {
    if (this._keys.length && (preExpression || !this._expression || !this.expressionEnabled)) {
      const lt = t - this._layer().startTime;
      const ks = this._keys;
      if (lt <= ks[0].t + 1e-9) return clone(ks[0].value);
      if (lt >= ks[ks.length - 1].t - 1e-9) return clone(ks[ks.length - 1].value);
      let i = 0;
      while (i < ks.length - 1 && ks[i + 1].t <= lt + 1e-9) i++;
      const a = ks[i], b = ks[i + 1];
      if (Math.abs(b.t - lt) < 1e-9) return clone(b.value);
      if (a.outInterp === KeyframeInterpolationType.HOLD || typeof a.value !== 'number' && !Array.isArray(a.value)) return clone(a.value);
      const u = (lt - a.t) / (b.t - a.t);
      return Array.isArray(a.value) ? a.value.map((v, j) => v + (b.value[j] - v) * u) : a.value + (b.value - a.value) * u;
    }
    if (preExpression || !this._expression || !this.expressionEnabled) return this.value;
    return evalExpression(this, t);
  }
  /** Property.setValuesAtTimes(times, newValues) — one key per time (AE Scripting Guide). */
  setValuesAtTimes(times, values) {
    if (!Array.isArray(times) || !Array.isArray(values) || times.length !== values.length) throw new Error('After Effects error: times and values must be arrays of the same length');
    for (let i = 0; i < times.length; i++) this.setValueAtTime(times[i], values[i]);
  }
  /** Property.isInterpolationTypeValid(type) — checkboxes and menus only hold. */
  isInterpolationTypeValid(type) {
    if (type === KeyframeInterpolationType.HOLD) return true;
    return !/Checkbox|Dropdown/.test(this.matchName || '');
  }
  setValueAtKey(i, v) { this._key(i).value = clone(v); }
  removeKey(i) { this._key(i); this._keys.splice(i - 1, 1); }
  keyInSpatialTangent(i) { return (this._key(i).inTan || this._zeroTan()).slice(); }
  keyOutSpatialTangent(i) { return (this._key(i).outTan || this._zeroTan()).slice(); }
  _zeroTan() { return Array.isArray(this._value) ? this._value.map(() => 0) : [0, 0]; }
  setSpatialTangentsAtKey(i, inT, outT) {
    if (!this.isSpatial) throw new Error('After Effects error: property is not spatial');
    const k = this._key(i); k.inTan = inT.slice(); k.outTan = (outT || inT).slice();
  }
  setSpatialAutoBezierAtKey(i, b) { this._key(i).autoBezier = !!b; }
  setSpatialContinuousAtKey(i, b) { this._key(i).continuous = !!b; }
  get dimensionsSeparated() { return !!this._separated; }
  set dimensionsSeparated(v) {
    v = !!v;
    if (v === !!this._separated) return;
    this._separated = v;
    if (this.matchName !== 'ADBE Position') return;
    const g = this.parentProperty;
    const dims = Array.isArray(this._value) ? this._value.length : 2;
    if (v) {
      for (let d = 0; d < dims; d++) {
        const pr = new MockProperty({ name: ['X Position', 'Y Position', 'Z Position'][d], matchName: `ADBE Position_${d}`, valueType: 'OneD', value: this._value[d] }, g, 0);
        pr._keys = this._keys.map((k) => ({ t: k.t, value: k.value[d], inInterp: k.inInterp, outInterp: k.outInterp, easeIn: [Object.assign({}, k.easeIn[0])], easeOut: [Object.assign({}, k.easeOut[0])], selected: k.selected }));
        g._children.push(pr);
      }
    } else {
      const parts = g._children.filter((c) => /^ADBE Position_\d$/.test(c.matchName));
      this._value = parts.map((pr) => pr._value);
      g._children = g._children.filter((c) => !parts.includes(c));
    }
    g._children.forEach((c, i) => { c.propertyIndex = i + 1; });
  }
  /* v0.99.5: a reference taken before setPropertyParameters is dead until it is fetched again from the effect. */
  _checkStale() { if (this._stale) throw new Error('After Effects error: null is not an object'); }
  get parentProperty() { return this._parentGone ? null : this._parentProperty; }
  set parentProperty(v) { this._parentProperty = v; }
  setPropertyParameters(items) {
    if (!/Dropdown Control/.test(this.matchName)) throw new Error('After Effects error: setPropertyParameters needs a Dropdown Menu Control');
    this._menuItems = items.slice();
    // v0.99.1: modelled on After Effects 26.5 (Tile Test: the effect could not be found by its name afterwards) —
    // the old references go stale and the effect is back to its default name; callers must use the returned property
    if (this.parentProperty && this.parentProperty.matchName === 'ADBE Dropdown Control') this.parentProperty.name = 'Dropdown Menu Control';
    // v0.99.5 (Self-Test on After Effects 26.5.3: grid.build died with "null is not an object (step 2 of 6:
    // effects.ensure)"): setPropertyParameters invalidates EVERY reference into that effect, not only this one.
    // A reference taken before the call throws until it is fetched again through the effect.
    const fxg = this.parentProperty;
    if (fxg && fxg._children) fxg._children.forEach((c) => { c._stale = true; });
    this._stale = false;
    // v0.99.5: and the way back to the effect is gone with them. Inferred from After Effects 26.5.3, where
    // grid.build died at compositing.jsx "entry.index = fx.propertyIndex" — the effect could no longer be found
    // by its MOE name, which can only mean the rename through `parentProperty` never happened. Find the effect
    // again by its INDEX, which does not change when a menu list is set.
    this._parentGone = true;
    return this;
  }
  get expression() { return this._expression; }
  set expression(code) {
    if (!this.canSetExpression) throw new Error('After Effects error: cannot set expression');
    this._expression = String(code);
    this.expressionError = '';
    if (this._expression.trim() === '') { this.expressionEnabled = false; return; }
    this.expressionEnabled = true;
    try {
      // Syntax-only stand-in for the AE expression engine.
      // eslint-disable-next-line no-new-func
      try { new Function(this._expression); } catch (eCsp) { if (!(eCsp instanceof EvalError)) throw eCsp; /* web preview without eval: skip the syntax check */ }
      if (/thisComp\.layer\("([^"]+)"\)/.test(this._expression)) {
        const name = RegExp.$1;
        const comp = this._layer()._comp;
        if (!comp._layers.some((l) => l.name === name)) {
          this.expressionError = 'Error: Layer named \'' + name + '\' is missing or does not exist.';
        }
      }
    } catch (e) {
      this.expressionError = 'SyntaxError: ' + e.message;
    }
  }
}

class MockGroup {
  constructor(spec, parent, index) {
    this.name = spec.name;
    this.matchName = spec.matchName || spec.name;
    this.propertyType = PropertyType.NAMED_GROUP;
    this.parentProperty = parent;
    this.propertyIndex = index;
    this.propertyDepth = parent.propertyDepth + 1;
    this._children = (spec.children || []).map((c, i) => build(c, this, i + 1));
  }
  get numProperties() { return this._children.length; }
  property(key) {
    if (typeof key === 'number') { const c = this._children[key - 1] || null; if (c) c._stale = false; return c; }
    const found = this._children.find((c) => c.matchName === key || c.name === key) || null;
    if (found) found._stale = false;
    // v0.99.1 (Tile Test, After Effects 26.5: "the property or a parent property is hidden"): a 2D layer still HAS its
    // 3D Transform properties, hidden — reading works, writing throws. Modelled for X / Y Rotation and Orientation.
    if (!found && this.matchName === 'ADBE Transform Group' && HIDDEN_2D[key]) {
      if (!this._hidden2D) this._hidden2D = {};
      if (!this._hidden2D[key]) { const pr = new MockProperty({ name: HIDDEN_2D[key][0], matchName: key, valueType: HIDDEN_2D[key][1], value: HIDDEN_2D[key][2] }, this, 0); pr._hidden3D = true; this._hidden2D[key] = pr; }
      return this._hidden2D[key];
    }
    return found;
  }
  propertyGroup(countUp) { return MockProperty.prototype.propertyGroup.call(this, countUp); }
}
const HIDDEN_2D = { 'ADBE Rotate X': ['X Rotation', 'OneD', 0], 'ADBE Rotate Y': ['Y Rotation', 'OneD', 0], 'ADBE Orientation': ['Orientation', 'ThreeD_SPATIAL', [0, 0, 0]] };

/* Generic named/indexed groups used by text animators and shape contents. */
class MockNode {
  constructor(name, matchName, parent, type) {
    this.name = name; this.matchName = matchName; this.parentProperty = parent;
    this.propertyType = type || PropertyType.NAMED_GROUP; this.propertyDepth = parent.propertyDepth + 1; this._children = [];
    this.enabled = true;
  }
  get propertyIndex() { return this.parentProperty._children ? this.parentProperty._children.indexOf(this) + 1 : 1; }
  get numProperties() { return this._children.length; }
  property(key) { return MockGroup.prototype.property.call(this, key); }
  propertyGroup(countUp) { return MockProperty.prototype.propertyGroup.call(this, countUp); }
  remove() { this.parentProperty._children.splice(this.propertyIndex - 1, 1); }
  canAddProperty(mn) { return !!(this._factory && this._factory[mn]); }
  addProperty(mn) {
    if (!this.canAddProperty(mn)) throw new Error('After Effects error: cannot add ' + mn + ' to ' + this.matchName);
    const child = this._factory[mn](this);
    this._children.push(child);
    return child;
  }
  _prop(name, matchName, valueType, value) {
    const p = new MockProperty({ name, matchName, valueType, value }, this, this._children.length + 1);
    this._children.push(p);
    return p;
  }
}

const TEXT_PROPS = {
  'ADBE Text Position 3D': ['Position', 'ThreeD_SPATIAL', [0, 0, 0]], 'ADBE Text Scale 3D': ['Scale', 'ThreeD', [100, 100, 100]],
  'ADBE Text Rotation': ['Rotation', 'OneD', 0], 'ADBE Text Opacity': ['Opacity', 'OneD', 100], 'ADBE Text Blur': ['Blur', 'TwoD', [0, 0]],
  'ADBE Text Tracking Amount': ['Tracking Amount', 'OneD', 0], 'ADBE Text Skew': ['Skew', 'OneD', 0], 'ADBE Text Fill Color': ['Fill Color', 'COLOR', [1, 0, 0, 1]],
  'ADBE Text Character Offset': ['Character Offset', 'OneD', 0]
};
const ADV_PROPS = [['Units', 'ADBE Text Range Units', 1], ['Based On', 'ADBE Text Range Type2', 1], ['Mode', 'ADBE Text Selector Mode', 1], ['Amount', 'ADBE Text Selector Max Amount', 100],
  ['Shape', 'ADBE Text Range Shape', 1], ['Smoothness', 'ADBE Text Selector Smoothness', 100], ['Ease High', 'ADBE Text Levels Max Ease', 0], ['Ease Low', 'ADBE Text Levels Min Ease', 0], ['Randomize Order', 'ADBE Text Randomize Order', 0]];

function makeSelector(parent) {
  const sel = new MockNode('Range Selector 1', 'ADBE Text Selector', parent);
  sel._prop('Start', 'ADBE Text Percent Start', 'OneD', 0);
  sel._prop('End', 'ADBE Text Percent End', 'OneD', 100);
  sel._prop('Offset', 'ADBE Text Percent Offset', 'OneD', 0);
  const adv = new MockNode('Advanced', 'ADBE Text Range Advanced', sel);
  sel._children.push(adv);
  ADV_PROPS.forEach(([n, mn, v]) => adv._prop(n, mn, 'OneD', v));
  return sel;
}
function makeWiggly(parent) {
  const w = new MockNode('Wiggly Selector 1', 'ADBE Text Wiggly Selector', parent);
  [['Mode', 'ADBE Text Wiggly Mode', 3], ['Max Amount', 'ADBE Text Wiggly Max Amount', 100], ['Min Amount', 'ADBE Text Wiggly Min Amount', -100], ['Based On', 'ADBE Text Range Type2', 1],
    ['Wiggles/Second', 'ADBE Text Temporal Freq', 2], ['Correlation', 'ADBE Text Character Correlation', 50], ['Temporal Phase', 'ADBE Text Temporal Phase', 0], ['Spatial Phase', 'ADBE Text Spatial Phase', 0],
    ['Lock Dimensions', 'ADBE Text Wiggly Lock Dim', 0], ['Random Seed', 'ADBE Text Wiggly Random Seed', 0]].forEach(([n, mn, v]) => w._prop(n, mn, 'OneD', v));
  return w;
}
function makeAnimator(parent) {
  const a = new MockNode('Animator ' + (parent._children.length + 1), 'ADBE Text Animator', parent);
  const sels = new MockNode('Selectors', 'ADBE Text Selectors', a, PropertyType.INDEXED_GROUP);
  sels._factory = { 'ADBE Text Selector': makeSelector, 'ADBE Text Wiggly Selector': makeWiggly };
  const props = new MockNode('Properties', 'ADBE Text Animator Properties', a, PropertyType.INDEXED_GROUP);
  props._factory = {};
  Object.entries(TEXT_PROPS).forEach(([mn, [n, vt, v]]) => { props._factory[mn] = (g) => new MockProperty({ name: n, matchName: mn, valueType: vt, value: v }, g, g._children.length + 1); });
  a._children.push(sels, props);
  return a;
}

/** Shape contents: spec.shapes = [{ name, fill: [r,g,b], stroke: [r,g,b] }] */
function makeShapeContents(layer, shapes) {
  const root = new MockNode('Contents', 'ADBE Root Vectors Group', layer, PropertyType.INDEXED_GROUP);
  root.propertyDepth = 1;
  root._factory = { 'ADBE Vector Group': makeVectorGroup, 'ADBE Vector Filter - Trim': makeTrim };
  (shapes || []).forEach((sh) => {
    const g = new MockNode(sh.name, 'ADBE Vector Group', root);
    root._children.push(g);
    const c = new MockNode('Contents', 'ADBE Vectors Group', g);
    g._children.push(c);
    if (sh.fill) { const f = new MockNode('Fill 1', 'ADBE Vector Graphic - Fill', c); c._children.push(f); f._prop('Color', 'ADBE Vector Fill Color', 'COLOR', sh.fill.concat([1])); }
    if (sh.stroke) { const k = new MockNode('Stroke 1', 'ADBE Vector Graphic - Stroke', c); c._children.push(k); k._prop('Color', 'ADBE Vector Stroke Color', 'COLOR', sh.stroke.concat([1])); }
    if (sh.path) { const pg = new MockNode('Path 1', 'ADBE Vector Shape - Group', c); c._children.unshift(pg); const sp = new Shape(); sp.vertices = sh.path.map((v) => v.slice()); sp.inTangents = sh.path.map(() => [0, 0]); sp.outTangents = sh.path.map(() => [0, 0]); sp.closed = !!sh.closed; pg._prop('Path', 'ADBE Vector Shape', 'SHAPE', sp); }
  });
  return root;
}

class SolidSource { constructor(color) { this.color = color || [0.5, 0.5, 0.5]; } }
class FileSource { constructor(isStill) { this.isStill = !!isStill; } }

function build(spec, parent, index) {
  return spec.children ? new MockGroup(spec, parent, index) : new MockProperty(spec, parent, index);
}

let nextId = 100;

class Shape {
  constructor() { this.vertices = []; this.inTangents = []; this.outTangents = []; this.closed = true; }
  clone() { const c = new Shape(); c.vertices = this.vertices.map((v) => v.slice()); c.inTangents = this.inTangents.map((v) => v.slice()); c.outTangents = this.outTangents.map((v) => v.slice()); c.closed = this.closed; return c; }
}
const MaskMode = { NONE: 6812 + 100, ADD: 6913, SUBTRACT: 6914, INTERSECT: 6915, LIGHTEN: 6916, DARKEN: 6917, DIFFERENCE: 6918 };
const BlendingMode = { NORMAL: 5212, ADD: 5220, SCREEN: 5222, OVERLAY: 5224, SOFT_LIGHT: 5225, MULTIPLY: 5216, LIGHTEN: 5219, DIFFERENCE: 5214 };
const TrackMatteType = { ALPHA: 5013, ALPHA_INVERTED: 5014, LUMA: 5015, LUMA_INVERTED: 5016, NO_TRACK_MATTE: 5012 };

function deepClone(v) {
  if (Array.isArray(v)) return v.map(deepClone);
  if (v && typeof v === 'object' && typeof v.clone === 'function') return v.clone();
  return v;
}
/** Deep copy of a property tree with parent pointers rewired (layer.duplicate / comp.duplicate). */
function cloneNode(node, parent) {
  const c = Object.create(Object.getPrototypeOf(node));
  for (const k of Object.keys(node)) c[k] = node[k];
  c.parentProperty = parent;
  if ('_value' in node) c._value = deepClone(node._value);
  if (node._keys) c._keys = node._keys.map((k) => Object.assign({}, k, { value: deepClone(k.value), easeIn: k.easeIn.map((e) => Object.assign({}, e)), easeOut: k.easeOut.map((e) => Object.assign({}, e)) }));
  if (node._children) c._children = node._children.map((ch) => cloneNode(ch, c));
  return c;
}
/** Mock text metric (see sourceRectAtTime): lines split on \r, each placed by the paragraph justification. */
function measureText(doc) {
  const fs = doc.fontSize || 100, lead = doc.autoLeading ? fs * 1.2 : doc.leading;
  const adv = (ch) => (ch === ' ' ? 0.3 : /[\u0600-\u06FF]/.test(ch) ? 0.5 : 0.55) * fs;
  const lines = String(doc.text).split(/\r\n|\r|\n/);
  let l = Infinity, r = -Infinity;
  lines.forEach((ln) => {
    const W = Array.from(ln).reduce((a, ch) => a + adv(ch), 0);
    const x0 = doc.justification === ParagraphJustification.CENTER_JUSTIFY ? -W / 2 : doc.justification === ParagraphJustification.RIGHT_JUSTIFY ? -W : 0;
    if (W > 0) { l = Math.min(l, x0); r = Math.max(r, x0 + W); }
  });
  if (!isFinite(l)) return { left: 0, top: 0, width: 0, height: 0 };
  return { left: l, top: -0.75 * fs, width: r - l, height: (lines.length - 1) * lead + fs };
}

function cloneLayer(L, comp) {
  const d = Object.create(Object.getPrototypeOf(L));
  for (const k of Object.keys(L)) d[k] = L[k];
  d.id = nextId++;
  d._comp = comp;
  d.selected = false;
  d._rect = Object.assign({}, L._rect);
  d._group = cloneNode(L._group, L._group.parentProperty);
  d._group._children.forEach((c) => { c.parentProperty = d; });
  if (L._parade) { d._parade = cloneNode(L._parade, d); }
  if (L._masks) { d._masks = cloneNode(L._masks, d); }
  return d;
}

function makeMaskParade(layer) {
  const masks = new MockNode('Masks', 'ADBE Mask Parade', layer, PropertyType.INDEXED_GROUP);
  masks.propertyDepth = 1;
  masks._factory = {
    'ADBE Mask Atom': (g) => {
      const m = new MockNode('Mask ' + (g._children.length + 1), 'ADBE Mask Atom', g);
      m.maskMode = MaskMode.ADD; m.inverted = false;
      m._prop('Mask Path', 'ADBE Mask Shape', 'SHAPE', new Shape());
      m._prop('Mask Feather', 'ADBE Mask Feather', 'TwoD', [0, 0]);
      m._prop('Mask Opacity', 'ADBE Mask Opacity', 'OneD', 100);
      m._prop('Mask Expansion', 'ADBE Mask Offset', 'OneD', 0);
      return m;
    }
  };
  return masks;
}

function makeVectorGroup(parent) {
  const g = new MockNode('Group ' + (parent._children.length + 1), 'ADBE Vector Group', parent);
  const c = new MockNode('Contents', 'ADBE Vectors Group', g, PropertyType.INDEXED_GROUP);
  c._factory = VECTOR_ITEMS;
  g._children.push(c);
  const t = new MockNode('Transform', 'ADBE Vector Transform Group', g);
  g._children.push(t);
  t._prop('Anchor Point', 'ADBE Vector Anchor', 'TwoD_SPATIAL', [0, 0]);
  t._prop('Position', 'ADBE Vector Position', 'TwoD_SPATIAL', [0, 0]);
  t._prop('Scale', 'ADBE Vector Scale', 'TwoD', [100, 100]);
  t._prop('Rotation', 'ADBE Vector Rotation', 'OneD', 0);
  t._prop('Opacity', 'ADBE Vector Group Opacity', 'OneD', 100);
  return g;
}
function makeTrim(g) {
  const n = new MockNode('Trim Paths 1', 'ADBE Vector Filter - Trim', g);
  n._prop('Start', 'ADBE Vector Trim Start', 'OneD', 0);
  n._prop('End', 'ADBE Vector Trim End', 'OneD', 100);
  n._prop('Offset', 'ADBE Vector Trim Offset', 'OneD', 0);
  return n;
}
const VECTOR_ITEMS = {
  'ADBE Vector Group': makeVectorGroup,
  'ADBE Vector Filter - Trim': makeTrim,
  'ADBE Vector Shape - Group': (g) => { const n = new MockNode('Path ' + (g._children.length + 1), 'ADBE Vector Shape - Group', g); n._prop('Path', 'ADBE Vector Shape', 'SHAPE', new Shape()); return n; },
  'ADBE Vector Shape - Ellipse': (g) => { const n = new MockNode('Ellipse Path 1', 'ADBE Vector Shape - Ellipse', g); n._prop('Size', 'ADBE Vector Ellipse Size', 'TwoD', [100, 100]); n._prop('Position', 'ADBE Vector Ellipse Position', 'TwoD_SPATIAL', [0, 0]); return n; },
  'ADBE Vector Shape - Rect': (g) => { const n = new MockNode('Rectangle Path 1', 'ADBE Vector Shape - Rect', g); n._prop('Size', 'ADBE Vector Rect Size', 'TwoD', [100, 100]); n._prop('Position', 'ADBE Vector Rect Position', 'TwoD_SPATIAL', [0, 0]); n._prop('Roundness', 'ADBE Vector Rect Roundness', 'OneD', 0); return n; },
  'ADBE Vector Shape - Star': (g) => {
    const n = new MockNode('Polystar Path 1', 'ADBE Vector Shape - Star', g);
    n._prop('Type', 'ADBE Vector Star Type', 'OneD', 1); n._prop('Points', 'ADBE Vector Star Points', 'OneD', 5);
    n._prop('Position', 'ADBE Vector Star Position', 'TwoD_SPATIAL', [0, 0]); n._prop('Rotation', 'ADBE Vector Star Rotation', 'OneD', 0);
    n._prop('Inner Radius', 'ADBE Vector Star Inner Radius', 'OneD', 50); n._prop('Outer Radius', 'ADBE Vector Star Outer Radius', 'OneD', 100);
    n._prop('Inner Roundness', 'ADBE Vector Star Inner Roundess', 'OneD', 0); n._prop('Outer Roundness', 'ADBE Vector Star Outer Roundess', 'OneD', 0);
    return n;
  },
  'ADBE Vector Graphic - Fill': (g) => { const n = new MockNode('Fill 1', 'ADBE Vector Graphic - Fill', g); n._prop('Fill Rule', 'ADBE Vector Fill Rule', 'OneD', 1); n._prop('Color', 'ADBE Vector Fill Color', 'COLOR', [1, 0, 0, 1]); n._prop('Opacity', 'ADBE Vector Fill Opacity', 'OneD', 100); return n; },
  'ADBE Vector Graphic - Stroke': (g) => {
    const n = new MockNode('Stroke 1', 'ADBE Vector Graphic - Stroke', g);
    n._prop('Color', 'ADBE Vector Stroke Color', 'COLOR', [1, 1, 1, 1]); n._prop('Opacity', 'ADBE Vector Stroke Opacity', 'OneD', 100); n._prop('Stroke Width', 'ADBE Vector Stroke Width', 'OneD', 2);
    n._prop('Line Cap', 'ADBE Vector Stroke Line Cap', 'OneD', 1); n._prop('Line Join', 'ADBE Vector Stroke Line Join', 'OneD', 1);
    return n;
  }
};

/** v0.67: AE's MarkerValue (comment) and a layer's Marker property — keys are { t, value }; layer._markers mirrors
 *  the times so expressions (ae-expr.markerOf) see exactly what the property holds. */
class MarkerValue { constructor(comment) { this.comment = String(comment || ''); } }
class MockMarkerProperty {
  constructor(layer) { this._layer = layer; this._keys = []; this.name = 'Marker'; this.matchName = 'ADBE Marker'; }
  get numKeys() { return this._keys.length; }
  _sync() { this._keys.sort((a, b) => a.t - b.t); this._layer._markers = this._keys.map((k) => k.t); }
  setValueAtTime(t, mv) {
    if (!(mv instanceof MarkerValue)) throw new Error('After Effects error: a marker needs a MarkerValue');
    const at = this._keys.findIndex((k) => Math.abs(k.t - t) < 1e-9);
    if (at >= 0) this._keys[at].value = mv; else this._keys.push({ t, value: mv });
    this._sync();
  }
  keyTime(i) { if (i < 1 || i > this._keys.length) throw new Error('After Effects error: key index out of range'); return this._keys[i - 1].t; }
  keyValue(i) { if (i < 1 || i > this._keys.length) throw new Error('After Effects error: key index out of range'); return this._keys[i - 1].value; }
  removeKey(i) { if (i < 1 || i > this._keys.length) throw new Error('After Effects error: key index out of range'); this._keys.splice(i - 1, 1); this._sync(); }
}

class MockLayer {
  constructor(spec, comp) {
    this._comp = comp;
    this.id = nextId++;
    this.name = spec.name;
    this.startTime = spec.startTime || 0;
    this.inPoint = spec.inPoint || 0;
    this.outPoint = spec.outPoint || comp.duration;
    this.stretch = 100;
    this.locked = !!spec.locked;
    this.enabled = true;
    this._threeD = !!spec.threeD;
    this.blendingMode = 5212; // BlendingMode.NORMAL
    this._matte = null; this._matteType = 0;
    this.nullLayer = !!spec.nullLayer;
    this._parent = null;
    this._spec = spec;
    this.selected = !!spec.selected;
    this.propertyDepth = 0;
    this.propertyType = PropertyType.INDEXED_GROUP;
    this.matchName = 'ADBE AV Layer';
    this.adjustmentLayer = !!spec.adjustment;
    this.width = spec.camera ? undefined : (spec.width || (this.nullLayer ? 100 : comp.width));
    this.height = spec.camera ? undefined : (spec.height || (this.nullLayer ? 100 : comp.height));
    this._pixels = spec.pixels || (() => [0.5, 0.5, 0.5, 1]);
    this._audio = spec.audio || null; // v0.36: amplitude over time (fixture) for Convert Audio to Keyframes
    this._parade = spec.camera ? null : new MockParade(this, comp._fxOpts || {});
    (spec.effects || []).forEach((e) => { const fx = this._parade.addProperty(e.matchName); if (e.name) fx.name = e.name; });
    this.label = spec.label || 0; this.comment = spec.comment || ''; this.shy = !!spec.shy; this.solo = false;
    this.guideLayer = !!spec.guide; this.motionBlur = !!spec.motionBlur; this.enabled = spec.enabled !== false;
    this._rect = spec.rect || (this.nullLayer ? { left: 0, top: 0, width: 100, height: 100 } : { left: -100, top: -30, width: 200, height: 60 });
    this._masks = null;
    if (spec.source) {
      const src = spec.source;
      const id = nextId++;
      if (src.kind === 'precomp') this.source = Object.assign(new CompItem(Object.assign({ name: src.name || 'Pre-comp', layers: [] }, src.comp || {})), { hasVideo: true, hasAudio: false });
      else this.source = { id, name: src.name || 'Footage', hasVideo: src.kind !== 'audio', hasAudio: src.kind === 'video' || src.kind === 'audio',
        mainSource: src.kind === 'solid' ? new SolidSource(src.color) : new FileSource(src.kind === 'image'), file: src.file ? { name: src.file } : null };
      if (spec.sourceId) this.source.id = spec.sourceId;
    }

    const tf = (spec.transform || (spec.camera ? [] : DEFAULT_TRANSFORM)).map((p) => Object.assign({}, p));
    this._group = new MockGroup({ name: 'root', children: [{ name: 'Transform', matchName: 'ADBE Transform Group', children: tf }] }, { propertyDepth: -1 }, 0);
    this._group._children.forEach((c) => { c.parentProperty = this; c.propertyDepth = 1; fixDepth(c); });
    this._measure = !!spec.measure;
    if (spec.text !== undefined) {
      const tp = new MockNode('Text', 'ADBE Text Properties', this._group);
      tp.propertyDepth = 1; tp.parentProperty = this;
      const doc = tp._prop('Source Text', 'ADBE Text Document', 'TEXT_DOCUMENT', new TextDocument(spec.text, spec.textStyle || {}));
      doc.canSetExpression = true;
      if (spec.textKeys) spec.textKeys.forEach((t) => doc.setValueAtTime(t, new TextDocument(spec.text, spec.textStyle || {})));
      const anims = new MockNode('Animators', 'ADBE Text Animators', tp, PropertyType.INDEXED_GROUP);
      anims._factory = { 'ADBE Text Animator': makeAnimator };
      tp._children.push(anims);
      this._group._children.push(tp);
    }
    if (spec.shapes) { const c = makeShapeContents(this, spec.shapes); this._group._children.push(c); }
  }
  get index() { return this._comp._layers.indexOf(this) + 1; }
  get numProperties() { return this._group._children.length + (this._parade ? 1 : 0); }
  property(key) {
    if (key === 'ADBE Marker' || key === 'Marker') { if (!this._markerProp) { this._markerProp = new MockMarkerProperty(this); for (const t of this._markers || []) this._markerProp.setValueAtTime(t, new MarkerValue('')); } return this._markerProp; }
    if (key === 'ADBE Effect Parade' || key === 'Effects') return this._parade;
    if (key === 'ADBE Mask Parade' || key === 'Masks') { if (!this._masks) this._masks = makeMaskParade(this); return this._masks; }
    if (typeof key === 'number' && key === this._group._children.length + 1) return this._parade;
    return this._group.property(key);
  }
  sourceRectAtTime(t) {
    // v0.37: a text layer built with `measure: true` measures its own text (a simple font metric — tests compare
    // MOE's maths with this metric, not with real glyphs): per character 0.55 em, Arabic 0.5 em, space 0.3 em
    if (this._measure) { const td = this.property('ADBE Text Properties'); if (td) return measureText(td.property('ADBE Text Document').valueAtTime(t || 0, false)); }
    return Object.assign({}, this._rect);
  }
  get parent() { return this._parent; }
  set parent(p) { if (p === this) throw new Error('After Effects error: a layer cannot be its own parent'); this._parent = p || null; this._comp._parentSetCalls = (this._comp._parentSetCalls || 0) + 1; }
  setParentWithJump(p) { if (p === this) throw new Error('After Effects error: a layer cannot be its own parent'); this._parent = p || null; }
  get autoOrient() { return this._autoOrient || AutoOrientType.NO_AUTO_ORIENT; }
  set autoOrient(v) { this._autoOrient = v; }
  // Layer.label: a label colour 0..16 — After Effects 26.5 throws for anything else (Tile Test: '"MOE: Carousel" is not an integer')
  get label() { return this._label || 0; }
  set label(v) { if (typeof v !== 'number' || Math.floor(v) !== v || v < 0 || v > 16) throw new Error(`After Effects error: Unable to set "label". ${v} is not an integer.`); this._label = v; }
  get threeDLayer() { return this._threeD; }
  set threeDLayer(v) {
    v = !!v;
    if (v === this._threeD) return;
    const g = this.property('ADBE Transform Group');
    const conv = (mn, vt, z) => { const pr = g.property(mn); if (!pr) return; pr.propertyValueType = PropertyValueType[vt]; const f = (x) => (v ? x.concat([z]) : x.slice(0, 2)); pr._value = f(pr._value); pr._keys.forEach((k) => { k.value = f(k.value); }); };
    conv('ADBE Anchor Point', v ? 'ThreeD_SPATIAL' : 'TwoD_SPATIAL', 0);
    conv('ADBE Position', v ? 'ThreeD_SPATIAL' : 'TwoD_SPATIAL', 0);
    conv('ADBE Scale', v ? 'ThreeD' : 'TwoD', 100);
    if (v && !g.property('ADBE Rotate X')) {
      ['ADBE Rotate X', 'ADBE Rotate Y'].forEach((mn, i) => { const pr = new MockProperty({ name: i ? 'Y Rotation' : 'X Rotation', matchName: mn, valueType: 'OneD', value: 0 }, g, 0); g._children.splice(3 + i, 0, pr); });
      g._children.forEach((c, i) => { c.propertyIndex = i + 1; });
    }
    this._threeD = v;
  }
  get trackMatteLayer() { return this._matte; }
  get trackMatteType() { return this._matte ? this._matteType : 5012; }
  get hasTrackMatte() { return !!this._matte; }
  setTrackMatte(layer, type) {
    if (!layer || layer === this) throw new Error('After Effects error: invalid track matte layer');
    if (layer._comp !== this._comp) throw new Error('After Effects error: track matte must be in the same composition');
    this._matte = layer; this._matteType = type;
  }
  removeTrackMatte() { this._matte = null; this._matteType = 0; }
  moveBefore(L) { const a = this._comp._layers; a.splice(a.indexOf(this), 1); a.splice(a.indexOf(L), 0, this); }
  moveAfter(L) { const a = this._comp._layers; a.splice(a.indexOf(this), 1); a.splice(a.indexOf(L) + 1, 0, this); }
  moveToBeginning() { const a = this._comp._layers; a.splice(a.indexOf(this), 1); a.unshift(this); }
  moveToEnd() { const a = this._comp._layers; a.splice(a.indexOf(this), 1); a.push(this); }
  get hasAudio() { return !!(this.source && this.source.hasAudio); }
  replaceSource(item) { this.source = item; if (item.width) { this.width = item.width; this.height = item.height; } }
  duplicate() {
    const d = cloneLayer(this, this._comp);
    const a = this._comp._layers;
    a.splice(a.indexOf(this), 0, d);
    return d;
  }
  applyPreset(file) {
    const comp = this._comp;
    comp._appliedPresets = comp._appliedPresets || [];
    comp._appliedPresets.push({ path: file.fsName, layers: comp._layers.filter((l) => l.selected).map((l) => l.name) });
  }
  get timeRemapEnabled() { return !!this._timeRemap; }
  /** Layer.copyToComp(intoComp): the copy goes to the top of the target comp; returns nothing. */
  copyToComp(into) {
    if (!(into instanceof CompItem)) throw new Error('After Effects error: copyToComp needs a composition');
    const d = cloneLayer(this, into);
    into._layers.unshift(d);
  }
  remove() {
    const i = this._comp._layers.indexOf(this);
    if (i < 0) throw new Error('After Effects error: layer already removed');
    this._comp._layers.splice(i, 1);
  }
}

class MockCameraLayer extends MockLayer {}
class MockTextLayer extends MockLayer {}
class MockShapeLayer extends MockLayer {}

/* v0.99.5 (read in After Effects 26.5.3): a null or solid layer has a SOLID of its own in the project
   ("Null 1", "Null 2", ...), and removing the layer leaves that item behind — the owner's Solids folder filled
   up with probe nulls. The mock used to make no item at all, so no test could see the leak. */
class SolidItem {
  constructor(name, w, h, color, project) {
    this.id = nextId++;
    this.name = name;
    this.width = w; this.height = h;
    this.kind = 'solid'; this.color = color || [0, 0, 0];
    // After Effects: a solid item's mainSource is a SolidSource — selftest.end and other cleanups test for it.
    this.mainSource = new SolidSource(this.color);
    this._project = project || null;
    if (this._project) this._project._items.push(this);
  }
  get usedIn() { return this._project ? this._project._items.filter((c) => c instanceof CompItem && c._layers.some((L) => L.source === this)) : []; }
  remove() { if (this._project) { const k = this._project._items.indexOf(this); if (k >= 0) this._project._items.splice(k, 1); } }
}

function fixDepth(node) {
  (node._children || []).forEach((c) => { c.propertyDepth = node.propertyDepth + 1; fixDepth(c); });
}

class CompItem {
  constructor(spec) {
    this.id = nextId++;
    this.name = spec.name;
    this.width = spec.width || 1920;
    this.height = spec.height || 1080;
    this.pixelAspect = 1;
    this.frameRate = spec.frameRate || 25;
    this.frameDuration = 1 / this.frameRate;
    this.duration = spec.duration || 10;
    this.time = spec.time || 0;
    this.workAreaStart = 0;
    this.workAreaDuration = this.duration;
    this.displayStartTime = 0;
    this._fxOpts = spec.effectsOptions || {};
    this._layers = (spec.layers || []).map((l) => (l.camera ? new MockCameraLayer(l, this) : l.text !== undefined ? new MockTextLayer(l, this) : l.shapes ? new MockShapeLayer(l, this) : new MockLayer(l, this)));
    const comp = this;
    this.guides = [];
    // v0.99.5 (read in After Effects 26.5.3): adding a layer SELECTS it and deselects every other
    // layer — so a tool that adds a temporary probe layer destroys the user's selection unless it
    // puts it back. The mock used to keep the selection, which hid that from the tests.
    const selectOnly = (L) => { comp._layers.forEach((x) => { x.selected = x === L; }); return L; };
    this.layers = {
      addNull(duration) {
        const n = new MockLayer({ name: 'Null 1', nullLayer: true, outPoint: duration }, comp);
        // v0.99.5: After Effects 26.5 makes a null with Opacity 0 % (the owner's screenshot of "Null 14"; the Self-Test's
        // Marker In / Out read 0 · 0 · 0 on one) — an expression that scales `value` reads 0 there
        n.property('ADBE Transform Group').property('ADBE Opacity').setValue(0);
        n.source = new SolidItem(`Null ${++comp._nullN}`, 100, 100, [0, 0, 0], comp._project);
        comp._layers.unshift(n);
        return selectOnly(n);
      },
      addSolid(color, name, w, h, pa, duration) {
        const L = new MockLayer({ name, width: w, height: h, outPoint: duration, rect: { left: 0, top: 0, width: w, height: h } }, comp);
        L.source = new SolidItem(name, w, h, color, comp._project);
        const tg = L.property('ADBE Transform Group');
        tg.property('ADBE Anchor Point').setValue([w / 2, h / 2]);
        tg.property('ADBE Position').setValue([comp.width / 2, comp.height / 2]);
        comp._layers.unshift(L);
        return selectOnly(L);
      },
      precompose(indices, name, moveAll) {
        const sorted = indices.slice().sort((a, b) => a - b);
        const moving = sorted.map((i) => comp._layers[i - 1]);
        const pc = new CompItem({ name, width: comp.width, height: comp.height, frameRate: comp.frameRate, duration: comp.duration, layers: [] });
        pc._project = comp._project;
        if (comp._project) comp._project._items.push(pc);
        moving.forEach((L) => { comp._layers.splice(comp._layers.indexOf(L), 1); L._comp = pc; pc._layers.push(L); });
        const holder = new MockLayer({ name, source: { kind: 'solid' }, rect: { left: 0, top: 0, width: comp.width, height: comp.height } }, comp);
        holder.source = pc;
        comp._layers.splice(sorted[0] - 1, 0, holder);
        comp._precomposeMoveAll = moveAll;
        return pc;
      },
      add(item) {
        const L = new MockLayer({ name: item.name, width: item.width, height: item.height, rect: { left: 0, top: 0, width: item.width, height: item.height }, source: { kind: 'video' }, pixels: item._pixels }, comp);
        L.source = item;
        const tg = L.property('ADBE Transform Group');
        tg.property('ADBE Anchor Point').setValue([item.width / 2, item.height / 2]);
        tg.property('ADBE Position').setValue([comp.width / 2, comp.height / 2]);
        comp._layers.unshift(L);
        return selectOnly(L);
      },
      // v0.40: LayerCollection.addText (the self-test's title)
      addText(text) {
        const L = new MockTextLayer({ name: String(text), text: String(text), measure: true, transform: DEFAULT_TRANSFORM.map((q) => Object.assign({}, q)) }, comp);
        comp._layers.unshift(L);
        return selectOnly(L);
      },
      addShape() {
        const L = new MockShapeLayer({ name: 'Shape Layer 1', shapes: [], rect: { left: -50, top: -50, width: 100, height: 100 } }, comp);
        comp._layers.unshift(L);
        return selectOnly(L);
      }
    };
    this._selectionOrder = spec.selectionOrder || null;
    this._nullN = 0;
  }
  get numLayers() { return this._layers.length; }
  layer(i) { return this._layers[i - 1]; }
  duplicate() {
    const c = new CompItem({ name: this.name + ' 2', width: this.width, height: this.height, frameRate: this.frameRate, duration: this.duration, time: this.time, layers: [] });
    c._project = this._project;
    c._fxOpts = this._fxOpts;
    c._layers = this._layers.map((L) => cloneLayer(L, c));
    c._layers.forEach((L, i) => { const op = this._layers[i]._parent; L._parent = op ? c._layers[this._layers.indexOf(op)] : null; const om = this._layers[i]._matte; L._matte = om ? c._layers[this._layers.indexOf(om)] : null; });
    c.guides = this.guides.map((g) => Object.assign({}, g));
    if (this._project) this._project._items.push(c);
    return c;
  }
  addGuide(orientationType, position) {
    if (orientationType !== 0 && orientationType !== 1) throw new Error('After Effects error: orientationType must be 0 or 1');
    this.guides.push({ orientationType, position, positionType: 0 });
    return this.guides.length - 1;
  }
  removeGuide(i) { if (i < 0 || i >= this.guides.length) throw new Error('After Effects error: guide index out of range'); this.guides.splice(i, 1); }
  get usedIn() { return this._project ? this._project._items.filter((c) => c instanceof CompItem && c._layers.some((L) => L.source === this)) : []; }
  openInViewer() { if (this._project) this._project.activeItem = this; return {}; }
  remove() { if (this._project) { const k = this._project._items.indexOf(this); if (k >= 0) this._project._items.splice(k, 1); if (this._project.activeItem === this) this._project.activeItem = null; } }
  get selectedLayers() {
    const sel = this._layers.filter((l) => l.selected);
    if (this._selectionOrder) {
      return this._selectionOrder.map((n) => sel.find((l) => l.name === n)).filter(Boolean);
    }
    return sel;
  }
  get selectedProperties() {
    const out = [];
    const walk = (n) => {
      if (n instanceof MockProperty) { if (n._selected) out.push(n); return; }
      (n._children || []).forEach(walk);
    };
    // v0.92: effect parameters and mask properties can be selected too (CompItem.selectedProperties covers every property of the layer)
    this.selectedLayers.forEach((l) => [l._group, l._parade, l._masks].filter(Boolean).forEach(walk));
    return out;
  }
}

/** Build fixture: properties with `selected: true` are part of the property selection. */
function markSelected(comp, fixture) {
  fixture.layers.forEach((ls, li) => {
    const layer = comp._layers[li];
    const walk = (spec, node) => {
      if (spec.selected && node instanceof MockProperty) node._selected = true;
      (spec.children || []).forEach((c, i) => walk(c, node._children[i]));
    };
    (ls.transform || []).forEach((ps, i) => walk(ps, layer._group._children[0]._children[i]));
  });
}

/**
 * Install AE globals onto `target` (a vm context sandbox or window).
 * `readFile(path)` returns file text; `evalCode(text)` evaluates it in the target global scope.
 */
function installAE(target, fixture, { readFile, evalCode }) {
  // v0.94: entries = what Edit › Undo would list — one per top-level group (After Effects closes a group when its script ends; see harness)
  // menu: a test opts in to Edit > Undo by name (env.undo.menu = true). It is OFF by default because this undo is
  // PARTIAL: it restores the layer and project-item lists the group started with - what the Tile Test's census
  // compares - and NOT property values or keys, so a test that measures keys must not use it.
  // refuse: v0.99.6 (Group 8 manual test, After Effects 26.5.3) reproduces After Effects ignoring Edit > Undo - the
  // command is found by its own menu text, executed, and nothing at all changes.
  const undo = { depth: 0, groups: [], entries: [], autoClosed: 0, stack: [], menu: false, refuse: false, undone: [] };
  const UNDO_ID = 16;
  const snapshot = () => {
    if (!project) return null;
    const comps = [];
    for (const it of project._items) if (it instanceof CompItem) comps.push({ comp: it, layers: it._layers.slice() });
    return { items: project._items.slice(), comps };
  };
  const restoreSnap = (snap) => {
    if (!snap || !project) return;
    project._items.length = 0;
    for (const it of snap.items) project._items.push(it);
    for (const c of snap.comps) { c.comp._layers.length = 0; for (const L of c.layers) c.comp._layers.push(L); }
  };
  const project = fixture ? { file: null, dirty: true, activeItem: null, bitsPerChannel: fixture.bitsPerChannel || 16, expressionEngine: 'javascript-1.0', _items: [], selection: [] } : null;
  if (project) {
    Object.defineProperty(project, 'numItems', { get() { return project._items.length; } });
    project.item = (i) => project._items[i - 1];
    project.items = {
      addComp(name, w, h, pa, duration, rate) {
        if (!(w >= 4 && h >= 4 && duration > 0 && rate > 0)) throw new Error('After Effects error: invalid composition settings');
        const c = new CompItem({ name, width: w, height: h, duration, frameRate: rate, layers: [] });
        c.pixelAspect = pa; c._project = project; project._items.push(c);
        return c;
      }
    };
    project.itemByID = (id) => { const it = project._items.find((x) => x.id === id); if (!it) throw new Error('After Effects error: no item with id ' + id); return it; };
  }
  if (fixture && fixture.comp) {
    const comp = new CompItem(fixture.comp);
    comp._project = project;
    markSelected(comp, fixture.comp);
    const registerNested = (c) => c._layers.forEach((L) => { if (L.source instanceof CompItem && !project._items.includes(L.source)) { L.source._project = project; project._items.push(L.source); registerNested(L.source); } });
    registerNested(comp);
    project.activeItem = comp;
    project._items.push(comp);
    (fixture.otherComps || []).forEach((oc) => { const c = new CompItem(oc); c._project = project; project._items.push(c); if (oc.projectSelected) project.selection.push(c); });
    if (fixture.comp.projectSelected) project.selection.push(comp);
  }
  class File {
    constructor(p) { this.fsName = p; this.name = String(p).split('/').pop(); }
    get exists() { try { readFile(this.fsName); return true; } catch (e) { return false; } }
  }
  const app0 = {};
  // v0.96: a tiny in-memory file list for rendered previews (Folder.getFiles with a "name_*.jpg" mask, File.remove)
  const mockFiles = new Set();
  class Folder {
    constructor(p) { this.fsName = String(p).replace(/\\/g, '/'); }
    get exists() { return true; }
    create() { return true; }
    execute() { (app0.opened = app0.opened || []).push(this.fsName); return true; }
    getFiles(mask) {
      const re = new RegExp('^' + String(mask || '*').replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$');
      return [...mockFiles].filter((f) => f.slice(0, f.lastIndexOf('/')) === this.fsName && re.test(f.slice(f.lastIndexOf('/') + 1))).map((f) => { const x = new File(f); x.remove = () => mockFiles.delete(f); return x; });
    }
  }
  Folder.userData = new Folder('/mock/userData');
  // v0.96: the Render Queue as rendered previews use it (items.add, timeSpan*, outputModule(1).setSettings / file, render)
  const RQItemStatus = { QUEUED: 2615, UNQUEUED: 2614, DONE: 2619 };
  const renderQueue = { _items: [], renders: [],
    get numItems() { return this._items.length; },
    item(i) { return this._items[i - 1]; },
    items: { add: (c) => { const it = { comp: c, status: RQItemStatus.QUEUED, render: true, timeSpanStart: 0, timeSpanDuration: c.duration, _om: { settings: {}, file: null,
      // v0.99.1: like After Effects 26.5 (Tile Test: "Invalid Value for key: <Format>. Property is read-only") — the format
      // comes from a template. Template names here are stand-ins (the real list was not read yet); no JPEG one on purpose.
      setSettings(o) { if (o && Object.prototype.hasOwnProperty.call(o, 'Format')) throw new Error('After Effects error: Invalid Value for key: <Format>.  Property is read-only'); Object.assign(this.settings, o); },
      templates: ['Best Settings', 'High Quality', 'High Quality with Alpha', 'Lossless', 'Photoshop', 'PNG Sequence', 'TIFF Sequence with Alpha'],
      applyTemplate(t) { if (!this.templates.includes(t)) throw new Error('After Effects error: no such template ' + t); this.settings.Format = t; } },
      outputModule() { return this._om; }, remove() { const k = renderQueue._items.indexOf(it); if (k >= 0) renderQueue._items.splice(k, 1); } }; renderQueue._items.push(it); return it; } },
    render() {
      for (const it of this._items.filter((x) => x.render && x.status === RQItemStatus.QUEUED)) {
        const n = Math.round(it.timeSpanDuration * it.comp.frameRate), f = it._om.file.fsName;
        this.renders.push({ comp: it.comp.name, format: it._om.settings.Format, frames: n, file: f });
        for (let k = 0; k < n; k++) mockFiles.add(f.replace('[#####]', String(k).padStart(5, '0')));
        it.status = RQItemStatus.DONE;
      }
    } };
  if (project) project.renderQueue = renderQueue;
  class ImportOptions { constructor(file) { this.file = file; this.importAs = 1; } canImportAs() { return /\.(png|jpg|jpeg|mov|mp4|exr|tif|tiff|webm|wav|mp3|aif)$/i.test(this.file.fsName); } }
  if (project) {
    project.importFile = (io) => {
      const green = /green/i.test(io.file.fsName);
      const audio = /\.(wav|mp3|aif)$/i.test(io.file.fsName);
      const item = { id: nextId++, name: io.file.name, width: audio ? 0 : 1920, height: audio ? 0 : 1080, duration: /\.(mov|mp4|webm|wav|mp3|aif)$/i.test(io.file.fsName) ? (audio ? 2 : 5) : 0, file: io.file, hasAudio: audio || /\.(mov|mp4)$/i.test(io.file.fsName), hasVideo: !audio,
        remove() { const k = project._items.indexOf(item); if (k >= 0) project._items.splice(k, 1); },
        _pixels: green ? (u, v) => (Math.abs(u - 0.5) < 0.2 && Math.abs(v - 0.5) < 0.25 ? [0.8, 0.6, 0.5, 1] : [0.0, 0.69, 0.25, 1]) : undefined };
      project._items.push(item);
      return item;
    };
  }
  Object.assign(target, {
    ImportOptions, ImportAsType: { FOOTAGE: 1, COMP: 2, PROJECT: 3 },
    Folder, RQItemStatus, PurgeTarget: { ALL_CACHES: 1, UNDO_CACHES: 2, SNAPSHOT_CACHES: 3, IMAGE_CACHES: 4 },
    PropertyValueType, KeyframeInterpolationType, PropertyType, KeyframeEase, CompItem, File, MarkerValue,
    TextLayer: MockTextLayer, ShapeLayer: MockShapeLayer, AVLayer: MockLayer, FileSource,
    ParagraphDirection, ParagraphJustification, ComposerEngine, CTScript, PREFType: { PREF_Type_MACHINE_INDEPENDENT: 0 },
    CameraLayer: MockCameraLayer, LightLayer: function LightLayer() {},
    SolidSource, Shape, MaskMode, BlendingMode, TrackMatteType, AutoOrientType,
    app: {
      version: '25.0.0x00 (mock)', buildNumber: 0, buildName: 'mock', isoLanguage: 'en_US',
      project,
      fonts: {
        allFonts: (fixture && fixture.fonts ? fixture.fonts : DEFAULT_FONTS).map((g) => g.map((f) => Object.assign({}, f))),
        getFontsByPostScriptName(ps) { return [].concat(...this.allFonts).filter((f) => f.postScriptName === ps); }
      },
      effects: Object.keys(EFFECTS).map((mn) => ({ displayName: mn.replace(/^ADBE /, ''), matchName: mn, category: 'Mock' })).concat((fixture && fixture.extraEffects) || []),
      preferences: { getPrefAsString() { throw new Error('After Effects error: preference not found'); } },
      // v0.98.2: After Effects 26.5 warns "Undo group mismatch, will attempt to fix" for a group opened inside an open one or
      // an end with none open (the owner's report); the mock counts both and the tests require zero
      beginUndoGroup(label) { if (undo.depth === 0) { undo.entries.push(label); undo.stack.push({ label, snap: snapshot() }); } else undo.mismatch = (undo.mismatch || 0) + 1; undo.depth++; undo.groups.push(label); },
      purge(target) { (app0.purged = app0.purged || []).push(target); },
      findMenuCommandId(name) {
        const fixed = { 'Reveal Layer Source in Project': 2517, 'Convert Audio to Keyframes': 3065 }[name];
        if (fixed) return fixed;
        // After Effects finds Edit > Undo only by its CURRENT text, which carries the newest group's label
        const top = undo.menu && undo.stack.length ? undo.stack[undo.stack.length - 1].label : null;
        if (top && name === `Undo ${top}`) return UNDO_ID;
        return 0;
      },
      executeCommand(id) {
        (app0.commands = app0.commands || []).push(id);
        if (id === UNDO_ID) {
          if (undo.refuse) return;
          const e = undo.stack.pop();
          if (e) { restoreSnap(e.snap); undo.undone.push(e.label); const k = undo.entries.lastIndexOf(e.label); if (k >= 0) undo.entries.splice(k, 1); }
          return;
        }
        // mock of Convert Audio to Keyframes: an "Audio Amplitude" null at the top with Left / Right / Both Channels
        // sliders keyed every frame from the selected sound layer's fixture `audio(t)` (0 when it has none)
        if (id === 3065 && project && project.activeItem) {
          const comp = project.activeItem, src = comp._layers.find((L) => L.selected && L.hasAudio);
          if (!src) return;
          const A = comp.layers.addNull(comp.duration); A.name = 'Audio Amplitude';
          const f = src._audio || (() => 0);
          for (const nm of ['Left Channel', 'Right Channel', 'Both Channels']) {
            const fx = A._parade.addProperty('ADBE Slider Control'); fx.name = nm;
            const sl = fx.property(1);
            for (let fr = 0; fr <= Math.round(comp.duration * comp.frameRate); fr++) sl.setValueAtTime(fr / comp.frameRate, Math.round(f(fr / comp.frameRate) * 100) / 100);
          }
        }
      },
      endUndoGroup() { if (undo.depth === 0) undo.mismatch = (undo.mismatch || 0) + 1; undo.depth = Math.max(0, undo.depth - 1); }
    },
    $: {
      global: target, os: 'MockOS', version: 'mock',
      evalFile(f) { return evalCode(readFile(typeof f === 'string' ? f : f.fsName)); }
    }
  });
  target.app._log = app0;
  return { undo, project };
}

module.exports = { Shape, installAE, PropertyValueType, KeyframeInterpolationType, KeyframeEase, TextDocument, ParagraphDirection };
