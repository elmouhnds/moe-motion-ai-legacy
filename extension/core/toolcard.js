'use strict';
/**
 * Tool Card (v0.66, docs/features/TOOL_CARDS.md): what a tool will do, said BEFORE it runs, from the tool's own
 * contract — never a second rule list. Pure: reads the context the panel already has, never calls After Effects.
 *
 *   card(tool, args, ctx, services) -> {
 *     name, purpose,                 one line: what it is for
 *     signature,                     e.g. "autoFade(secs 0.4)" (tools with explain())
 *     target,                        what it acts on: "Opacity · 3 layers"
 *     ready, needs,                  ready to run; else the one thing to do first, in plain words
 *     writes[],                      what will be written (keys, effects, layers, expressions)
 *     undo,                          how to take it back
 *     code, numbers[]                the exact expression (expression tools), and the numbers to highlight in it
 *   }
 *
 * A tool may add explain(args, ctx, prepared) -> { signature?, target?, writes?, code?, numbers? }; otherwise the card
 * is built from prepare()'s preview (summary + items) — every tool gets a card without extra work.
 */
const contextReq = require('./context');
const LP = require('./lockpolicy');

/** "4 layer(s)" → "4 layers", "1 propert(ies)" → "1 property": tool summaries read like sentences in the card. */
function tidy(line) {
  return String(line)
    .replace(/(\d+)(\s+)(\w+?)\(ies\)/g, (m, n, sp, w) => `${n}${sp}${w}${+n === 1 ? 'y' : 'ies'}`)
    .replace(/(\d+)(\s+)(\w+)\(s\)/g, (m, n, sp, w) => `${n}${sp}${w}${+n === 1 ? '' : 's'}`);
}

const mutates = (tool) => (tool.permissions || []).some((p) => p.startsWith('modify.'));

function undoLine(tool) {
  if (!mutates(tool)) return 'Changes nothing in the comp';
  if (tool.recovery === 'undo+checkpoint') return 'One Ctrl+Z, or Restore from History';
  return 'One Ctrl+Z';
}

/** prepare() with the executor's own rules: locked layers first, then requirements, then the tool's plan. */
function plan(tool, args, ctx0, services) {
  if (!ctx0) return { ok: false, error: 'Reading After Effects…' };
  const lp = LP.apply(tool, ctx0);
  if (lp.error) return { ok: false, error: lp.error };
  const r = contextReq.evaluate(tool.requires, lp.ctx);
  if (!r.ok) return { ok: false, error: LP.explain(r.reasons[0], lp.skipped), ctx: lp.ctx };
  if (!tool.prepare) return { ok: true, preview: { summary: tool.name, items: [] }, ctx: lp.ctx, skipped: lp.skipped };
  try {
    const p = tool.prepare(args, lp.ctx, services) || { ok: false, error: 'Nothing to do' };
    return Object.assign({}, p, { ctx: lp.ctx, skipped: lp.skipped, error: p.ok ? undefined : LP.explain(p.error, lp.skipped) });
  } catch (e) {
    return { ok: false, error: 'Check the parameters' };
  }
}

function card(tool, args, ctx, services, extra) {
  const purpose = (extra && extra.purpose) || tool.description;
  const p = plan(tool, args, ctx, services);
  let ex = {};
  if (typeof tool.explain === 'function') {
    try { ex = tool.explain(args, p.ctx || ctx || {}, p.ok ? p : null) || {}; } catch (e) { ex = {}; }
  }
  const items = p.ok && p.preview ? p.preview.items || [] : [];
  const writes = ex.writes || (p.ok && p.preview ? [p.preview.summary].concat(items.slice(0, 5), items.length > 5 ? [`+${items.length - 5} more`] : []) : []);
  if (p.ok && p.skipped && p.skipped.length) writes.push(`skips locked ${p.skipped.join(', ')}`);
  // v0.67 foresight: what could surprise you after Apply, said before it (the tool's own words + one generic rule:
  // keys written under an enabled expression stay invisible while the expression is on)
  const warnings = [].concat(ex.warnings || []);
  if (p.ok && (tool.permissions || []).includes('modify.keyframes')) {
    const ctxUsed = p.ctx || ctx || {};
    const layerName = (id) => ((ctxUsed.layers || []).find((l) => l.id === id) || {}).name || 'Layer';
    const hidden = (ctxUsed.properties || []).filter((x) => x.expression && x.expressionEnabled && !/^\s*\/\/ MOE/.test(x.expression));
    if (hidden.length) warnings.push(`${hidden.slice(0, 2).map((x) => `${layerName(x.address && x.address.layerId)} › ${x.name}`).join(', ')}${hidden.length > 2 ? ` +${hidden.length - 2}` : ''} ${hidden.length === 1 ? 'has' : 'have'} an expression on — new keys stay hidden until it is off`);
  }
  return {
    name: tool.name,
    purpose: String(purpose || '').split(/(?<=[.!?])\s/)[0],
    signature: ex.signature || null,
    target: ex.target || null,
    ready: !!p.ok,
    needs: p.ok ? null : p.error || 'Not ready',
    writes: p.ok ? writes.map(tidy) : [],
    undo: undoLine(tool),
    code: ex.code || null,
    numbers: ex.numbers || [],
    warnings: p.ok ? warnings : []
  };
}

/** Split code into plain / number runs so the UI can highlight the numbers the sliders set (no HTML here). */
function codeRuns(code, numbers) {
  if (!code) return [];
  const nums = [...new Set((numbers || []).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!nums.length) return [{ text: code, num: false }];
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?<![\\w.])(${nums.map(esc).join('|')})(?![\\w])`, 'g');
  const out = [];
  let last = 0, m;
  while ((m = re.exec(code))) {
    if (m.index > last) out.push({ text: code.slice(last, m.index), num: false });
    out.push({ text: m[0], num: true });
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push({ text: code.slice(last), num: false });
  return out;
}

module.exports = { card, plan, codeRuns, undoLine, tidy };
