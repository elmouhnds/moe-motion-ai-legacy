'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Registry } = require('../extension/core/registry');
const { validateArgs, toJsonSchema } = require('../extension/core/schema');
const { decide } = require('../extension/core/permissions');
const { evaluate } = require('../extension/core/context');
const { scrub } = require('../extension/core/logger');
const { literal } = require('../extension/core/host/bridge');
const { registerAll, TOOLS } = require('../extension/features');

test('all built-in tools pass registry validation', () => {
  const r = registerAll(new Registry());
  assert.equal(r.list().length, TOOLS.length);
});

test('registry rejects incomplete or unsafe definitions', () => {
  const r = new Registry();
  assert.throws(() => r.register({ id: 'bad' }), /module.toolName/);
  const base = { id: 'x.y', version: '1.0.0', category: 'motion', name: 'X', description: 'd', params: {}, execute() {} };
  assert.throws(() => r.register(Object.assign({}, base, { permissions: ['modify.layers'] })), /recovery strategy/);
  assert.throws(() => r.register(Object.assign({}, base, { permissions: ['root'] })), /unknown permission/);
  r.register(Object.assign({}, base, { permissions: ['read'] }));
  assert.throws(() => r.register(Object.assign({}, base, { permissions: ['read'] })), /Duplicate/);
});

test('search ranks name matches first', () => {
  const r = registerAll(new Registry());
  const top = r.search('ease').slice(0, 3).map((t) => t.id); // v0.30: Paste Ease is an ease tool too
  ['motion.easeCurve', 'motion.smartEase'].forEach((id) => assert.ok(top.includes(id), id));
  assert.equal(r.search('cascade')[0].id, 'motion.stagger');
  assert.equal(r.search('expr fix')[0].id, 'expressions.assist');
  assert.equal(r.search('zzzz').length, 0);
});

test('schema: defaults, coercion, bounds, unknown keys', () => {
  const s = { a: { type: 'number', label: 'A', min: 0, max: 10, default: 5 }, b: { type: 'enum', label: 'B', options: [{ value: 'x' }], default: 'x' } };
  assert.deepEqual(validateArgs(s, {}).value, { a: 5, b: 'x' });
  assert.equal(validateArgs(s, { a: '7' }).value.a, 7);
  assert.equal(validateArgs(s, { a: 11 }).ok, false);
  assert.equal(validateArgs(s, { b: 'y' }).ok, false);
  assert.equal(validateArgs(s, { c: 1 }).ok, false);
  const js = toJsonSchema(s);
  assert.equal(js.a.minimum, undefined, 'no numeric constraints in structured-output schema');
  assert.match(js.a.description, /min 0, max 10/);
});

test('permissions: agent can never modify silently; deny wins', () => {
  const t = { permissions: ['modify.keyframes'] };
  assert.equal(decide(t, 'user', {}).decision, 'allow');
  assert.equal(decide(t, 'agent', {}).decision, 'confirm');
  assert.equal(decide(t, 'user', { 'modify.keyframes': 'deny' }).decision, 'deny');
  assert.equal(decide(t, 'agent', { 'modify.keyframes': 'allow' }).decision, 'confirm');
  assert.equal(decide({ permissions: ['read'] }, 'agent', {}).decision, 'allow');
  assert.equal(decide({ permissions: ['modify.expressions'], destructive: true }, 'recipe', {}).decision, 'confirm');
});

test('context requirements produce human reasons', () => {
  assert.deepEqual(evaluate({ comp: true }, { comp: null }).reasons, ['Open a composition']);
  const ctx = { comp: {}, layers: [{}], properties: [{ numKeys: 0, selectedKeys: [], canSetExpression: true }] };
  assert.deepEqual(evaluate({ minLayers: 2 }, ctx).reasons, ['Select at least 2 layers']);
  assert.ok(evaluate({ expressionCapable: 1 }, ctx).ok);
  assert.deepEqual(evaluate({ keyframedProperties: 1 }, ctx).reasons, ['Select a keyframed property']);
});

test('logger scrubs API keys', () => {
  assert.equal(scrub('key sk-ant-api03-abcdefghijkl'), 'key [redacted-key]');
  assert.deepEqual(scrub({ h: { 'x-api-key': 'abc' } }), { h: { 'x-api-key': '[redacted]' } });
});

test('host literal is ASCII-only and ES3-safe', () => {
  const l = literal('مرحبا "\\');
  assert.ok(/^[\x20-\x7e]+$/.test(l));
  assert.equal(JSON.parse(l), 'مرحبا "\\');
});
