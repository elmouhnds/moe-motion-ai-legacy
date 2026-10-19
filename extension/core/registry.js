'use strict';
/**
 * Tool registry. Every capability in MOE Motion AI is a registered tool:
 *
 * {
 *   id: 'motion.smartEase',            unique, "<module>.<name>"
 *   version: '1.0.0',
 *   category: 'motion' | 'expressions' | 'tools',
 *   group: 'Easing',                   sub-heading inside a workspace
 *   name, description, keywords: [],
 *   icon: 'ease',
 *   params: { ...schema.js },
 *   requires: { ...context.js },
 *   permissions: ['modify.keyframes'],
 *   destructive: false,
 *   recovery: 'undo+checkpoint' | 'undo' | 'none',
 *   ai: { callable: true, hint: 'when to use it' } | null,   planner may use it
 *   uses: { hostOps: ['keyframes.applyEase'], network: false },
 *   compatibility: { minAE: '25.0' },
 *   ui: { primaryLabel, presets: [{ id, label, args }] },
 *
 *   prepare(args, ctx)            -> { ok, error?, preview: { summary, items[] }, ...plan }   pure
 *   execute({ args, ctx, prepared, host, services }) -> result                           async
 *   verify({ args, ctx, prepared, result })  -> { ok, checks: [{ ok, label, detail }] }   pure
 *   checkpoint({ result, ctx })   -> data to restore later (or null)                      pure
 *   restore({ data, host })       -> async undo independent of the AE undo stack
 *   summarize(result)             -> one-line human result
 * }
 */

const { checkSchema } = require('./schema');
const { SCOPES } = require('./permissions');

const CATEGORIES = ['motion', 'expressions', 'tools'];

class Registry {
  constructor() {
    this._tools = new Map();
  }

  register(def) {
    const errors = Registry.check(def);
    if (errors.length) throw new Error(`Invalid tool "${def && def.id}":\n - ${errors.join('\n - ')}`);
    if (this._tools.has(def.id)) throw new Error(`Duplicate tool id "${def.id}"`);
    this._tools.set(def.id, Object.freeze(Object.assign({ keywords: [], requires: {}, recovery: 'none', ai: null }, def)));
    return this;
  }

  static check(def) {
    const e = [];
    if (!def || typeof def !== 'object') return ['definition must be an object'];
    if (!/^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$/.test(def.id || '')) e.push('id must look like "module.toolName"');
    if (!/^\d+\.\d+\.\d+$/.test(def.version || '')) e.push('version must be semver x.y.z');
    if (!CATEGORIES.includes(def.category)) e.push(`category must be one of ${CATEGORIES.join(', ')}`);
    if (!def.name) e.push('name is required');
    if (!def.description) e.push('description is required');
    e.push(...checkSchema(def.params || {}, 'params'));
    if (!Array.isArray(def.permissions) || def.permissions.length === 0) e.push('permissions must be a non-empty array');
    else for (const p of def.permissions) if (!SCOPES.includes(p)) e.push(`unknown permission "${p}"`);
    if (typeof def.execute !== 'function') e.push('execute() is required');
    const mutates = (def.permissions || []).some((p) => p.startsWith('modify.'));
    if (mutates && (def.recovery || 'none') === 'none') e.push('mutating tools must declare a recovery strategy');
    if (mutates && typeof def.verify !== 'function') e.push('mutating tools must implement verify()');
    if (def.recovery === 'undo+checkpoint' && (typeof def.checkpoint !== 'function' || typeof def.restore !== 'function')) {
      e.push('recovery "undo+checkpoint" needs checkpoint() and restore()');
    }
    return e;
  }

  get(id) { return this._tools.get(id) || null; }
  has(id) { return this._tools.has(id); }
  list(filter) {
    const all = [...this._tools.values()];
    if (!filter) return all;
    return all.filter((t) => (!filter.category || t.category === filter.category) && (!filter.aiCallable || (t.ai && t.ai.callable)));
  }

  /** Ranked fuzzy search over name, keywords, group and description. */
  search(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return this.list();
    const terms = q.split(/\s+/);
    const scored = [];
    for (const t of this._tools.values()) {
      const name = t.name.toLowerCase();
      const hay = [name, t.group || '', t.description, ...(t.keywords || []), t.id].join(' ').toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (name.startsWith(term)) score += 6;
        else if (name.includes(term)) score += 4;
        else if ((t.keywords || []).some((k) => k.toLowerCase().startsWith(term))) score += 3;
        else if (hay.includes(term)) score += 1;
        else { score = 0; break; }
      }
      if (score > 0) scored.push({ t, score });
    }
    return scored.sort((a, b) => b.score - a.score || a.t.name.localeCompare(b.t.name)).map((s) => s.t);
  }
}

module.exports = { Registry, CATEGORIES };
