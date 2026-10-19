'use strict';
/**
 * Claude API client (Messages API over raw HTTPS).
 *
 * Why raw HTTPS instead of @anthropic-ai/sdk: the CEP 12 runtime ships
 * Node.js 17.7.1, below the SDK's supported Node range, and has no global fetch.
 *
 * Design:
 *  - JSON results via structured outputs (output_config.format = json_schema).
 *  - Stable system prompt is marked for prompt caching (cache_control).
 *  - Server-side refusal fallback ("fallbacks": "default") on models that support it.
 *  - Retries 408/429/5xx/network with backoff; honours retry-after.
 *  - The API key is read from the secret store per call and never logged.
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5']);

class AIError extends Error {
  constructor(code, message, extra) {
    super(message);
    this.code = code;
    Object.assign(this, extra || {});
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createClaudeClient({ http, secrets, cost, logger, getSettings }) {
  async function createJSON({ purpose, system, user, schema, maxTokens = 16000, effort }) {
    const settings = getSettings().ai;
    if (!settings.enabled) throw new AIError('AI_DISABLED', 'AI features are turned off in Settings.');
    const budget = cost.canSpend();
    if (!budget.ok) throw new AIError('AI_BUDGET', budget.reason);
    const key = await secrets.getApiKey();
    if (!key) throw new AIError('AI_NO_KEY', 'Add your Claude API key in Settings to use AI features.');

    const model = settings.model;
    const body = {
      model,
      max_tokens: maxTokens,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
      output_config: { effort: effort || settings.effort || 'medium', format: { type: 'json_schema', schema } }
    };
    const headers = {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    };
    if (FALLBACK_MODELS.has(model)) {
      body.fallbacks = 'default';
      headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    }
    const payload = JSON.stringify(body);

    let attempt = 0;
    for (;;) {
      attempt++;
      let res;
      try {
        res = await http.request({ url: API_URL, method: 'POST', headers, body: payload, timeoutMs: 180000 });
      } catch (e) {
        if (attempt < 3) { await sleep(800 * attempt); continue; }
        throw new AIError('AI_NETWORK', `Cannot reach the Claude API (${e.code || e.message}). Local tools still work offline.`);
      }
      if (res.status === 200) {
        const msg = JSON.parse(res.body);
        if (msg.usage) {
          const usd = cost.record(model, msg.usage, purpose);
          logger.info('ai', `${purpose} done`, { model, usage: msg.usage, usd });
        }
        if (msg.stop_reason === 'refusal') {
          throw new AIError('AI_REFUSED', 'Claude declined this request. Try rephrasing it.', { details: msg.stop_details || null });
        }
        if (msg.stop_reason === 'max_tokens') throw new AIError('AI_TRUNCATED', 'The answer was cut off (output limit). Try a narrower request.');
        const text = (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
        try {
          return { data: JSON.parse(text), usage: msg.usage, model: msg.model || model };
        } catch (e) {
          throw new AIError('AI_BAD_JSON', 'Claude returned an unreadable answer.');
        }
      }
      const retryable = res.status === 408 || res.status === 429 || res.status >= 500;
      let apiMessage = '';
      try { apiMessage = JSON.parse(res.body).error.message; } catch (e) { apiMessage = String(res.body).slice(0, 200); }
      logger.warn('ai', `HTTP ${res.status}`, { attempt, apiMessage });
      if (retryable && attempt < 3) {
        const ra = Number(res.headers && res.headers['retry-after']);
        await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 30) * 1000 : 1000 * 2 ** attempt);
        continue;
      }
      if (res.status === 401) throw new AIError('AI_AUTH', 'The Claude API key was rejected. Check it in Settings.');
      if (res.status === 429) throw new AIError('AI_RATE_LIMIT', 'Claude API rate limit reached. Try again shortly.');
      throw new AIError('AI_HTTP', `Claude API error ${res.status}: ${apiMessage}`);
    }
  }

  return { createJSON };
}

module.exports = { createClaudeClient, AIError, API_URL };
