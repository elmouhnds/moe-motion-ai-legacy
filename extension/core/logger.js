'use strict';
/**
 * Structured logger with an in-memory ring buffer (for the Diagnostics view)
 * and optional persistence. Secrets are scrubbed before anything is stored.
 */

const SECRET_PATTERNS = [
  [/sk-ant-[A-Za-z0-9_\-]{8,}/g, () => '[redacted-key]'],
  [/("?x-api-key"?\s*[:=]\s*)"[^"]*"/gi, (m, prefix) => `${prefix}"[redacted]"`]
];

function scrub(value) {
  let s = typeof value === 'string' ? value : JSON.stringify(value);
  if (s === undefined) return value;
  for (const [re, fn] of SECRET_PATTERNS) s = s.replace(re, fn);
  return typeof value === 'string' ? s : JSON.parse(s);
}

function createLogger({ capacity = 500, sink } = {}) {
  const entries = [];
  const listeners = new Set();

  function write(level, area, message, data) {
    const entry = { t: new Date().toISOString(), level, area, message: scrub(String(message)) };
    if (data !== undefined) entry.data = scrub(data);
    entries.push(entry);
    if (entries.length > capacity) entries.shift();
    if (sink && level !== 'debug') { try { sink(entry); } catch (e) { /* never throw from logging */ } }
    listeners.forEach((fn) => fn(entry));
    return entry;
  }

  return {
    debug: (a, m, d) => write('debug', a, m, d),
    info: (a, m, d) => write('info', a, m, d),
    warn: (a, m, d) => write('warn', a, m, d),
    error: (a, m, d) => write('error', a, m, d),
    entries: (level) => entries.filter((e) => !level || e.level === level),
    onEntry: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }
  };
}

module.exports = { createLogger, scrub };
