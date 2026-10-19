'use strict';
/**
 * Local storage for MOE Motion AI. Everything lives in the product's own data
 * folder (Windows: %APPDATA%\MOE Motion AI). Never inside the extension folder,
 * never shared with other products.
 *
 * Documents (JSON):  settings, favorites, presets, recipes, usage
 * Logs (JSON lines): history, diagnostics
 */

const SCHEMA_VERSION = 1;

function createStore(fsa) {
  const cache = new Map();

  function file(name, ext) {
    if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error(`Invalid store name "${name}"`);
    return fsa.join(fsa.dataDir, `${name}.${ext}`);
  }

  function get(name, fallback) {
    if (cache.has(name)) return structuredCloneSafe(cache.get(name));
    let value = fallback;
    const p = file(name, 'json');
    try {
      if (fsa.exists(p)) {
        const doc = JSON.parse(fsa.readText(p));
        value = doc && doc.schemaVersion ? doc.data : doc;
      }
    } catch (e) {
      // Corrupt file: keep a copy for diagnostics and continue with defaults.
      try { fsa.writeText(`${p}.corrupt-${Date.now()}`, fsa.readText(p)); } catch (ignored) { /* noop */ }
      value = fallback;
    }
    cache.set(name, value);
    return structuredCloneSafe(value);
  }

  function set(name, value) {
    cache.set(name, structuredCloneSafe(value));
    fsa.writeTextAtomic(file(name, 'json'), JSON.stringify({ schemaVersion: SCHEMA_VERSION, data: value }, null, 2));
  }

  function update(name, fallback, fn) {
    const next = fn(get(name, fallback));
    set(name, next);
    return next;
  }

  function append(name, record) {
    fsa.appendText(file(name, 'jsonl'), JSON.stringify(record) + '\n');
  }

  function tail(name, limit) {
    const p = file(name, 'jsonl');
    if (!fsa.exists(p)) return [];
    const lines = fsa.readText(p).split('\n').filter(Boolean);
    const out = [];
    for (const line of lines.slice(-limit)) {
      try { out.push(JSON.parse(line)); } catch (e) { /* skip damaged line */ }
    }
    return out;
  }

  /** Keep jsonl logs bounded. */
  function compact(name, keep) {
    const p = file(name, 'jsonl');
    if (!fsa.exists(p)) return;
    const lines = fsa.readText(p).split('\n').filter(Boolean);
    if (lines.length > keep * 1.5) fsa.writeTextAtomic(p, lines.slice(-keep).join('\n') + '\n');
  }

  return { get, set, update, append, tail, compact, dataDir: fsa.dataDir };
}

function structuredCloneSafe(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

module.exports = { createStore };
