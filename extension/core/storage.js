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
  // Two MOE panels (main + Motion Kit) share one data folder: before using a cached document,
  // look (at most every 500 ms) whether the other panel rewrote the file since we read it.
  const stamp = new Map(), checked = new Map(), versions = new Map();
  const bump = (name) => versions.set(name, (versions.get(name) || 0) + 1);
  function stale(name) {
    if (!fsa.mtime || !cache.has(name)) return false;
    const now = Date.now();
    if (now - (checked.get(name) || 0) < 500) return false;
    checked.set(name, now);
    return fsa.mtime(file(name, 'json')) !== (stamp.get(name) || 0);
  }

  function file(name, ext) {
    if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error(`Invalid store name "${name}"`);
    return fsa.join(fsa.dataDir, `${name}.${ext}`);
  }

  function get(name, fallback) {
    if (stale(name)) cache.delete(name);
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
    if (fsa.mtime) { stamp.set(name, fsa.mtime(p)); checked.set(name, Date.now()); }
    bump(name);
    return structuredCloneSafe(value);
  }

  function set(name, value) {
    cache.set(name, structuredCloneSafe(value));
    fsa.writeTextAtomic(file(name, 'json'), JSON.stringify({ schemaVersion: SCHEMA_VERSION, data: value }, null, 2));
    if (fsa.mtime) { stamp.set(name, fsa.mtime(file(name, 'json'))); checked.set(name, Date.now()); }
    bump(name);
  }
  /** Changes whenever the document was (re)loaded or written — cheap "did it change?" check. */
  function version(name) { if (stale(name)) { cache.delete(name); get(name, undefined); } return versions.get(name) || 0; }

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

  return { get, set, update, append, tail, compact, version, dataDir: fsa.dataDir };
}

function structuredCloneSafe(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

module.exports = { createStore };
