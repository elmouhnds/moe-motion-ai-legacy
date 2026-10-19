'use strict';
/**
 * Cost monitor. Prices are USD per 1M tokens (Anthropic first-party API,
 * published list prices as of 2026-10). Cache writes use the standard 1.25×
 * input multiplier for 5-minute TTL. Prices can be overridden in Settings.
 */

const PRICES = {
  'claude-opus-5-5': { label: 'Claude Opus 5.5', input: 4.0, output: 20.0, cacheRead: 0.20, cacheWrite: 5.0 },
  'claude-sonnet-5-5': { label: 'Claude Sonnet 5.5', input: 2.0, output: 10.0, cacheRead: 0.20, cacheWrite: 2.5 },
  // Haiku 5.5 cache-read price not confirmed in our sources: estimated at 10% of input.
  'claude-haiku-5-5': { label: 'Claude Haiku 5.5', input: 0.10, output: 0.50, cacheRead: 0.01, cacheWrite: 0.125, estimated: true }
};

function costOf(model, usage, overrides) {
  const p = Object.assign({}, PRICES[model] || PRICES['claude-opus-5-5'], (overrides || {})[model] || {});
  const u = usage || {};
  const usd =
    ((u.input_tokens || 0) * p.input +
      (u.output_tokens || 0) * p.output +
      (u.cache_read_input_tokens || 0) * p.cacheRead +
      (u.cache_creation_input_tokens || 0) * p.cacheWrite) / 1e6;
  return Math.round(usd * 1e6) / 1e6;
}

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function createCostMonitor({ store, getSettings }) {
  const session = { calls: 0, usd: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };

  function usage() {
    const doc = store.get('usage', { months: {} });
    return doc.months[monthKey()] || { calls: 0, usd: 0 };
  }

  return {
    record(model, u, purpose) {
      const usd = costOf(model, u, getSettings().ai.priceOverrides);
      session.calls++;
      session.usd += usd;
      session.inputTokens += u.input_tokens || 0;
      session.outputTokens += u.output_tokens || 0;
      session.cacheReadTokens += u.cache_read_input_tokens || 0;
      store.update('usage', { months: {} }, (doc) => {
        const m = doc.months[monthKey()] || { calls: 0, usd: 0, byPurpose: {} };
        m.calls++;
        m.usd = Math.round((m.usd + usd) * 1e6) / 1e6;
        m.byPurpose = m.byPurpose || {};
        m.byPurpose[purpose] = Math.round(((m.byPurpose[purpose] || 0) + usd) * 1e6) / 1e6;
        doc.months[monthKey()] = m;
        return doc;
      });
      return usd;
    },
    /** Block new calls when the monthly budget is exhausted (0 = no limit). */
    canSpend() {
      const budget = Number(getSettings().ai.monthlyBudgetUSD) || 0;
      if (!budget) return { ok: true };
      const used = usage().usd;
      return used >= budget
        ? { ok: false, reason: `Monthly AI budget reached ($${used.toFixed(2)} of $${budget.toFixed(2)}). Raise it in Settings.` }
        : { ok: true, remaining: budget - used };
    },
    session: () => Object.assign({}, session),
    month: usage
  };
}

module.exports = { PRICES, costOf, createCostMonitor };
