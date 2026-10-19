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

class KeyframeEase {
  constructor(speed, influence) {
    if (arguments.length < 2) throw new Error('KeyframeEase requires speed and influence');
    if (influence < 0.1 || influence > 100) throw new Error('After Effects error: influence out of range [0.1..100]');
    this.speed = speed;
    this.influence = influence;
  }
}

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
    this.adjustmentLayer = false;
    this.parent = null;
    this.selected = !!spec.selected;
    this.propertyDepth = 0;
    this.propertyType = PropertyType.INDEXED_GROUP;
    this.matchName = 'ADBE AV Layer';
    const tf = (spec.transform || []).map((p) => Object.assign({}, p));
    this._group = new MockGroup({ name: 'root', children: [{ name: 'Transform', matchName: 'ADBE Transform Group', children: tf }] }, { propertyDepth: -1 }, 0);
    this._group._children.forEach((c) => { c.parentProperty = this; c.propertyDepth = 1; fixDepth(c); });
  }
  get index() { return this._comp._layers.indexOf(this) + 1; }
  property(key) { return this._group.property(key); }
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
    this.time = 0;
    this.workAreaStart = 0;
    this.workAreaDuration = this.duration;
    this.displayStartTime = 0;
    this._layers = (spec.layers || []).map((l) => new MockLayer(l, this));
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
  const project = fixture ? { file: null, dirty: true, activeItem: null } : null;
  if (fixture && fixture.comp) {
    const comp = new CompItem(fixture.comp);
    markSelected(comp, fixture.comp);
    project.activeItem = comp;
  }
  class File {
    constructor(p) { this.fsName = p; this.name = String(p).split('/').pop(); }
    get exists() { try { readFile(this.fsName); return true; } catch (e) { return false; } }
  }
  Object.assign(target, {
    PropertyValueType, KeyframeInterpolationType, PropertyType, KeyframeEase, CompItem, File,
    TextLayer: function TextLayer() {}, ShapeLayer: function ShapeLayer() {},
    CameraLayer: function CameraLayer() {}, LightLayer: function LightLayer() {},
    SolidSource: function SolidSource() {},
    app: {
      version: '25.0.0x00 (mock)', buildNumber: 0, buildName: 'mock', isoLanguage: 'en_US',
      project,
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

module.exports = { installAE, PropertyValueType, KeyframeInterpolationType, KeyframeEase };
