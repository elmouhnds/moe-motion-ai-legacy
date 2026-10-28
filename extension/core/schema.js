'use strict';
/**
 * Parameter schema: a small, explicit format shared by tools, recipes, the UI
 * form renderer and the Claude planner.
 *
 *   { key: { type: 'number'|'integer'|'string'|'text'|'boolean'|'enum'|'layer',
 *            label, description, default, min, max, step, unit,
 *            options: [{ value, label }], aliases: { oldValue: value }, maxLength, required, advanced } }
 */

const TYPES = new Set(['number', 'integer', 'string', 'text', 'boolean', 'enum', 'layer']);

function checkSchema(schema, where) {
  const errors = [];
  if (!schema || typeof schema !== 'object') return [`${where}: params must be an object`];
  for (const [key, p] of Object.entries(schema)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) errors.push(`${where}.${key}: invalid key`);
    if (!TYPES.has(p.type)) errors.push(`${where}.${key}: unknown type "${p.type}"`);
    if (p.type === 'enum' && (!Array.isArray(p.options) || p.options.length === 0)) {
      errors.push(`${where}.${key}: enum needs options`);
    }
    if (!p.label) errors.push(`${where}.${key}: label is required`);
  }
  return errors;
}

function validateValue(key, p, raw) {
  if (raw === undefined || raw === null || raw === '') {
    if (p.default !== undefined) return { value: p.default };
    if (p.required) return { error: `${p.label || key} is required` };
    return { value: undefined };
  }
  switch (p.type) {
    case 'number':
    case 'integer': {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(n)) return { error: `${p.label} must be a number` };
      if (p.type === 'integer' && !Number.isInteger(n)) return { error: `${p.label} must be a whole number` };
      if (p.min !== undefined && n < p.min) return { error: `${p.label} must be ≥ ${p.min}` };
      if (p.max !== undefined && n > p.max) return { error: `${p.label} must be ≤ ${p.max}` };
      return { value: n };
    }
    case 'layer': {
      // A layer number (index) in the active comp; the UI renders a layer picker.
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isInteger(n) || n < 1) return { error: `${p.label} must be a layer number` };
      return { value: n };
    }
    case 'boolean':
      if (typeof raw === 'boolean') return { value: raw };
      if (raw === 'true' || raw === 'false') return { value: raw === 'true' };
      return { error: `${p.label} must be true or false` };
    case 'enum':
      // aliases: old values saved by an earlier version (e.g. a renamed mode) map to the new one
      if (p.aliases && Object.prototype.hasOwnProperty.call(p.aliases, raw)) return { value: p.aliases[raw] };
      if (!p.options.some((o) => o.value === raw)) {
        return { error: `${p.label} must be one of: ${p.options.map((o) => o.value).join(', ')}` };
      }
      return { value: raw };
    case 'string':
    case 'text': {
      if (typeof raw !== 'string') return { error: `${p.label} must be text` };
      const max = p.maxLength || (p.type === 'text' ? 20000 : 500);
      if (raw.length > max) return { error: `${p.label} is too long (max ${max} characters)` };
      return { value: raw };
    }
    default:
      return { error: `${key}: unsupported type` };
  }
}

/** Validate + normalise args. Unknown keys are rejected (never silently passed to a handler). */
function validateArgs(schema, args) {
  const input = args || {};
  const value = {};
  const errors = [];
  for (const k of Object.keys(input)) {
    if (!Object.prototype.hasOwnProperty.call(schema, k)) errors.push(`Unknown parameter "${k}"`);
  }
  for (const [key, p] of Object.entries(schema)) {
    const r = validateValue(key, p, input[key]);
    if (r.error) errors.push(r.error);
    else if (r.value !== undefined) value[key] = r.value;
  }
  return { ok: errors.length === 0, value, errors };
}

function defaults(schema) {
  const out = {};
  for (const [k, p] of Object.entries(schema)) if (p.default !== undefined) out[k] = p.default;
  return out;
}

/**
 * Convert to JSON Schema for Claude structured outputs. Numeric/length limits
 * are not supported there, so they are written into the description and
 * enforced locally by validateArgs().
 */
function toJsonSchema(schema) {
  const properties = {};
  for (const [key, p] of Object.entries(schema)) {
    const limits = [];
    if (p.min !== undefined) limits.push(`min ${p.min}`);
    if (p.max !== undefined) limits.push(`max ${p.max}`);
    if (p.unit) limits.push(`unit: ${p.unit}`);
    if (p.default !== undefined) limits.push(`default ${JSON.stringify(p.default)}`);
    if (p.type === 'layer') limits.push('layer number (index) in the active comp');
    const description = [p.description || p.label, limits.length ? `(${limits.join(', ')})` : '']
      .filter(Boolean).join(' ');
    let js;
    if (p.type === 'enum') js = { type: 'string', enum: p.options.map((o) => o.value) };
    else if (p.type === 'text') js = { type: 'string' };
    else if (p.type === 'layer') js = { type: 'integer' };
    else js = { type: p.type };
    properties[key] = Object.assign(js, { description });
  }
  return properties;
}

module.exports = { checkSchema, validateArgs, defaults, toJsonSchema };
