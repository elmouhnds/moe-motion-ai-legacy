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
const PropertyType = { PROPERTY: 6812, INDEXED_GROUP: 6813, NAMED_GROUP: 6814 };
const ParagraphDirection = { DIRECTION_LEFT_TO_RIGHT: 1, DIRECTION_RIGHT_TO_LEFT: 2 };
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
  const layer = prop._layer();
  const comp = layer._comp;
  const thisComp = { layer: (i) => sampleable(comp.layer(i)), frameDuration: comp.frameDuration, width: comp.width, height: comp.height };
  // eslint-disable-next-line no-new-func
  const fn = new Function('thisComp', 'time', 'value', '__code', 'return eval(__code);');
  return fn(thisComp, t, prop.value, prop._expression);
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
          const c = postEffect ? renderEffects(layer, px(x / layer.width, y / layer.height, t)) : px(x / layer.width, y / layer.height, t);
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
function renderEffects(layer, rgba) {
  let c = rgba.slice();
  for (const fx of (layer._parade ? layer._parade._children : [])) {
    if (!fx.enabled) continue;
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
  'ADBE Gaussian Blur 2': [{ name: 'Blurriness', valueType: 'OneD', value: 0 }],
  'ADBE Tint': [{ name: 'Map Black To', valueType: 'COLOR', value: [0, 0, 0, 1] }, { name: 'Map White To', valueType: 'COLOR', value: [1, 1, 1, 1] }, { name: 'Amount to Tint', valueType: 'OneD', value: 100 }],
  'ADBE Fill': [{ name: 'Fill Mask', valueType: 'OneD', value: 0 }, { name: 'All Masks', valueType: 'OneD', value: 0 }, { name: 'Color', valueType: 'COLOR', value: [1, 0, 0, 1] }, { name: 'Invert', valueType: 'OneD', value: 0 }, { name: 'Horizontal Feather', valueType: 'OneD', value: 0 }, { name: 'Vertical Feather', valueType: 'OneD', value: 0 }, { name: 'Opacity', valueType: 'OneD', value: 1 }],
  'ADBE Slider Control': [{ name: 'Slider', valueType: 'OneD', value: 0 }],
  'ADBE Checkbox Control': [{ name: 'Checkbox', valueType: 'OneD', value: 0 }]
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
      matchName: `${matchName}-${String(i + 1).padStart(4, '0')}`,
      valueType: p.valueType, value: p.value, canSetExpression: true
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
  get value() { return clone(this._value); }
  setValue(v) {
    if (this.propertyValueType === PropertyValueType.COLOR && (!Array.isArray(v) || v.length !== 4)) throw new Error('After Effects error: color value must have 4 components');
    this._value = clone(v);
  }
  setValueAtTime(t, v) {
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
    if (this._keys.length && (preExpression || !this._expression)) {
      const lt = t - this._layer().startTime;
      let best = this._keys[0];
      for (const k of this._keys) if (k.t <= lt + 1e-9) best = k;
      return clone(best.value);
    }
    if (preExpression || !this._expression || !this.expressionEnabled) return this.value;
    return evalExpression(this, t);
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
      new Function(this._expression);
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
    if (typeof key === 'number') return this._children[key - 1] || null;
    return this._children.find((c) => c.matchName === key || c.name === key) || null;
  }
  propertyGroup(countUp) { return MockProperty.prototype.propertyGroup.call(this, countUp); }
}

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
  'ADBE Text Tracking Amount': ['Tracking Amount', 'OneD', 0], 'ADBE Text Skew': ['Skew', 'OneD', 0], 'ADBE Text Fill Color': ['Fill Color', 'COLOR', [1, 0, 0, 1]]
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
function makeAnimator(parent) {
  const a = new MockNode('Animator ' + (parent._children.length + 1), 'ADBE Text Animator', parent);
  const sels = new MockNode('Selectors', 'ADBE Text Selectors', a, PropertyType.INDEXED_GROUP);
  sels._factory = { 'ADBE Text Selector': makeSelector };
  const props = new MockNode('Properties', 'ADBE Text Animator Properties', a, PropertyType.INDEXED_GROUP);
  props._factory = {};
  Object.entries(TEXT_PROPS).forEach(([mn, [n, vt, v]]) => { props._factory[mn] = (g) => new MockProperty({ name: n, matchName: mn, valueType: vt, value: v }, g, g._children.length + 1); });
  a._children.push(sels, props);
  return a;
}

/** Shape contents: spec.shapes = [{ name, fill: [r,g,b], stroke: [r,g,b] }] */
function makeShapeContents(layer, shapes) {
  const root = new MockNode('Contents', 'ADBE Root Vectors Group', layer);
  root.propertyDepth = 1;
  (shapes || []).forEach((sh) => {
    const g = new MockNode(sh.name, 'ADBE Vector Group', root);
    root._children.push(g);
    const c = new MockNode('Contents', 'ADBE Vectors Group', g);
    g._children.push(c);
    if (sh.fill) { const f = new MockNode('Fill 1', 'ADBE Vector Graphic - Fill', c); c._children.push(f); f._prop('Color', 'ADBE Vector Fill Color', 'COLOR', sh.fill.concat([1])); }
    if (sh.stroke) { const k = new MockNode('Stroke 1', 'ADBE Vector Graphic - Stroke', c); c._children.push(k); k._prop('Color', 'ADBE Vector Stroke Color', 'COLOR', sh.stroke.concat([1])); }
  });
  return root;
}

class SolidSource { constructor(color) { this.color = color || [0.5, 0.5, 0.5]; } }
class FileSource { constructor(isStill) { this.isStill = !!isStill; } }

function build(spec, parent, index) {
  return spec.children ? new MockGroup(spec, parent, index) : new MockProperty(spec, parent, index);
}

let nextId = 100;

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
    this.threeDLayer = !!spec.threeD;
    this.nullLayer = !!spec.nullLayer;
    this.parent = null;
    this.selected = !!spec.selected;
    this.propertyDepth = 0;
    this.propertyType = PropertyType.INDEXED_GROUP;
    this.matchName = 'ADBE AV Layer';
    this.adjustmentLayer = !!spec.adjustment;
    this.width = spec.camera ? undefined : (spec.width || (this.nullLayer ? 100 : comp.width));
    this.height = spec.camera ? undefined : (spec.height || (this.nullLayer ? 100 : comp.height));
    this._pixels = spec.pixels || (() => [0.5, 0.5, 0.5, 1]);
    this._parade = spec.camera ? null : new MockParade(this, comp._fxOpts || {});
    (spec.effects || []).forEach((e) => { const fx = this._parade.addProperty(e.matchName); if (e.name) fx.name = e.name; });
    this.label = spec.label || 0; this.comment = spec.comment || ''; this.shy = !!spec.shy; this.solo = false;
    this.guideLayer = !!spec.guide; this.motionBlur = !!spec.motionBlur; this.enabled = spec.enabled !== false;
    this._rect = spec.rect || { left: -100, top: -30, width: 200, height: 60 };
    if (spec.source) {
      const src = spec.source;
      const id = nextId++;
      if (src.kind === 'precomp') this.source = Object.assign(new CompItem({ name: src.name || 'Pre-comp', layers: [] }), { hasVideo: true, hasAudio: false });
      else this.source = { id, name: src.name || 'Footage', hasVideo: src.kind !== 'audio', hasAudio: src.kind === 'video' || src.kind === 'audio',
        mainSource: src.kind === 'solid' ? new SolidSource(src.color) : new FileSource(src.kind === 'image'), file: src.file ? { name: src.file } : null };
      if (spec.sourceId) this.source.id = spec.sourceId;
    }

    const tf = (spec.transform || (spec.camera ? [] : DEFAULT_TRANSFORM)).map((p) => Object.assign({}, p));
    this._group = new MockGroup({ name: 'root', children: [{ name: 'Transform', matchName: 'ADBE Transform Group', children: tf }] }, { propertyDepth: -1 }, 0);
    this._group._children.forEach((c) => { c.parentProperty = this; c.propertyDepth = 1; fixDepth(c); });
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
    if (key === 'ADBE Effect Parade' || key === 'Effects') return this._parade;
    if (typeof key === 'number' && key === this._group._children.length + 1) return this._parade;
    return this._group.property(key);
  }
  sourceRectAtTime() { return Object.assign({}, this._rect); }
  applyPreset(file) {
    const comp = this._comp;
    comp._appliedPresets = comp._appliedPresets || [];
    comp._appliedPresets.push({ path: file.fsName, layers: comp._layers.filter((l) => l.selected).map((l) => l.name) });
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
    this.layers = {
      addNull(duration) {
        const n = new MockLayer({ name: 'Null 1', nullLayer: true, outPoint: duration }, comp);
        comp._layers.unshift(n);
        return n;
      }
    };
    this._selectionOrder = spec.selectionOrder || null;
  }
  get numLayers() { return this._layers.length; }
  layer(i) { return this._layers[i - 1]; }
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
    this.selectedLayers.forEach((l) => walk(l._group));
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
  const undo = { depth: 0, groups: [] };
  const project = fixture ? { file: null, dirty: true, activeItem: null, bitsPerChannel: fixture.bitsPerChannel || 16, expressionEngine: 'javascript-1.0', _items: [], selection: [] } : null;
  if (project) {
    Object.defineProperty(project, 'numItems', { get() { return project._items.length; } });
    project.item = (i) => project._items[i - 1];
  }
  if (fixture && fixture.comp) {
    const comp = new CompItem(fixture.comp);
    markSelected(comp, fixture.comp);
    project.activeItem = comp;
    project._items.push(comp);
    (fixture.otherComps || []).forEach((oc) => { const c = new CompItem(oc); project._items.push(c); if (oc.projectSelected) project.selection.push(c); });
    if (fixture.comp.projectSelected) project.selection.push(comp);
  }
  class File {
    constructor(p) { this.fsName = p; this.name = String(p).split('/').pop(); }
    get exists() { try { readFile(this.fsName); return true; } catch (e) { return false; } }
  }
  Object.assign(target, {
    PropertyValueType, KeyframeInterpolationType, PropertyType, KeyframeEase, CompItem, File,
    TextLayer: MockTextLayer, ShapeLayer: MockShapeLayer, AVLayer: MockLayer, FileSource,
    ParagraphDirection, ComposerEngine, CTScript, PREFType: { PREF_Type_MACHINE_INDEPENDENT: 0 },
    CameraLayer: MockCameraLayer, LightLayer: function LightLayer() {},
    SolidSource,
    app: {
      version: '25.0.0x00 (mock)', buildNumber: 0, buildName: 'mock', isoLanguage: 'en_US',
      project,
      fonts: {
        allFonts: (fixture && fixture.fonts ? fixture.fonts : DEFAULT_FONTS).map((g) => g.map((f) => Object.assign({}, f))),
        getFontsByPostScriptName(ps) { return [].concat(...this.allFonts).filter((f) => f.postScriptName === ps); }
      },
      effects: Object.keys(EFFECTS).map((mn) => ({ displayName: mn.replace(/^ADBE /, ''), matchName: mn, category: 'Mock' })).concat((fixture && fixture.extraEffects) || []),
      preferences: { getPrefAsString() { throw new Error('After Effects error: preference not found'); } },
      beginUndoGroup(label) { undo.depth++; undo.groups.push(label); },
      endUndoGroup() { undo.depth--; }
    },
    $: {
      global: target, os: 'MockOS', version: 'mock',
      evalFile(f) { return evalCode(readFile(typeof f === 'string' ? f : f.fsName)); }
    }
  });
  return { undo, project };
}

module.exports = { installAE, PropertyValueType, KeyframeInterpolationType, KeyframeEase, TextDocument, ParagraphDirection };
