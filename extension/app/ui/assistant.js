'use strict';
/**
 * MOE Assistant (v0.28, docs/features/ASSISTANT.md) — a floating button in the corner of the panel.
 *
 *   ◉ button      always there, never covers a control you need (right-click: other corner);
 *                 a small number = suggestions for what you have in front of you (never a pop-up)
 *   sheet         suggestions · conversation · quick prompts for the selection · one text box
 *   ask           questions about After Effects / motion / MOE → Claude answers in your language
 *   do            describe a change → Claude plans it with MOE tools → you approve → each step
 *                 verified → roll back or save as a tool (the Copilot flow, unchanged)
 *   offline       no key or no internet: your words (Arabic or English) are matched to MOE tools
 *                 and power cards — one click runs or opens them
 */
const { h, icon } = require('./dom');

/**
 * v0.85: the Assistant's own mark — a speech bubble (it answers) holding a spark (it thinks). Drawn here because
 * Lucide's `sparkles` is also the Look stage's icon: the assistant must not look like a stage. Token colours only.
 */
const MARK = '<path class="as-m-b" d="M12 3.2c5 0 8.8 3.3 8.8 7.6s-3.8 7.6-8.8 7.6c-1 0-2-.1-2.9-.4L5 20.6l.9-3.9C4.2 15.3 3.2 13.2 3.2 10.8 3.2 6.5 7 3.2 12 3.2z"/>'
  + '<path class="as-m-s" d="M12 6c.5 3.1 1.7 4.3 4.8 4.8-3.1.5-4.3 1.7-4.8 4.8-.5-3.1-1.7-4.3-4.8-4.8 3.1-.5 4.3-1.7 4.8-4.8z"/>';
function mark(cls) { return h('span', { class: `as-mark ${cls || ''}`, 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24">${MARK}</svg>` }); }
const A = require('./actions');
const W = require('./workflow');

const SIDE_KEY = 'assistant-side';

/** Tools and cards that match a request's words (offline). Same search as Ctrl+K, scored by keywords hit. */
function localMatches(app, keywords) {
  const pal = require('./palette');
  const seen = new Map();
  (keywords || []).forEach((k, ki) => {
    pal.results(app, k).slice(0, 12).forEach((it, i) => {
      const key = `${it.kind}:${it.id}`;
      const cur = seen.get(key) || { it, hits: 0, rank: 1e9 };
      cur.hits += 1; cur.rank = Math.min(cur.rank, ki * 20 + i);
      seen.set(key, cur);
    });
  });
  return [...seen.values()].sort((a, b) => b.hits - a.hits || a.rank - b.rank).slice(0, 5).map((x) => x.it);
}

function currentTips(app, s) {
  const c = s.ctx;
  if (!c || !c.comp) return [];
  const brand = require('../../features/brand/kit').activeBrand(app.services.store, app.services.brands);
  return W.tips(c, { brand, dismissed: W.dismissedTips(app.services.store) });
}
function runTip(app, t) {
  if (t.tool) { app.runTool(t.tool, t.args, { label: t.label }); return; }
  const a = A.resolve(t.ref);
  if (!a) return;
  const rd = a.ready(app);
  if (!rd.ok && !a.nav) app.toast(`${a.label}: ${rd.hint}`, 4500, 'warn'); else a.run(app);
}
function tipRow(app, s, t) {
  return h('div', { class: 'as-tip', 'data-key': `tip-${t.id}` }, icon(t.icon || 'lightbulb', 'sm'), h('span', { class: 'as-tip-t' }, t.text),
    h('button', { class: 'btn sm', 'data-key': `tip-run-${t.id}`, title: t.label, onclick: () => runTip(app, t) }, t.label),
    h('button', { class: 'icon-btn', 'data-key': `tip-x-${t.id}`, 'aria-label': `Hide this suggestion: ${t.text}`, title: 'Not now (hidden for this comp)', onclick: () => { W.dismissTip(app.services.store, s.ctx.comp.id, t.id); app.render(); } }, icon('x', 'xs')));
}

function localBody(app, e) {
  const found = localMatches(app, e.keywords);
  const cards = W.powerFor((e.keywords || []).join(' '));
  return [
    cards.map((p) => { const a = A.resolve(p.open); return h('div', { class: 'as-card', 'data-key': `as-card-${e.id}-${p.id}` }, h('b', {}, icon(p.icon, 'sm'), p.title), h('p', {}, p.what), h('ol', {}, p.steps.map((x) => h('li', {}, x))),
      a ? h('button', { class: 'btn ghost sm', onclick: () => a.run(app) }, `Open ${a.label}`, icon('chev', 'xs')) : null); }),
    found.length ? h('div', { class: 'as-found' }, found.map((it) => h('button', { class: 'as-hit', 'data-key': `as-hit-${e.id}-${it.kind}-${it.id}`, title: it.desc, onclick: () => it.run() },
      icon(it.icon || 'tools', 'sm'), h('span', { class: 'as-hit-n' }, it.name), h('span', { class: 'as-hit-d' }, it.kind === 'preset' ? 'apply' : it.ws)))) : (cards.length ? null : h('div', { class: 'kit-hint' }, 'Nothing in MOE matches those words — try other words, or search with Ctrl+K.')),
    e.code === 'AI_NO_KEY' ? h('button', { class: 'btn ghost sm as-key', onclick: () => app.go('settings') }, icon('gear', 'sm'), 'Add a Claude key for answers and multi-step plans') : null
  ];
}

function planBody(app, c, e) {
  if (e.id !== c.planEntry || !c.validated) return h('div', { class: 'as-old' }, icon('check', 'xs'), e.summary || 'Plan');
  const cp = require('./copilot');
  const v = c.validated, progress = c.progress || {};
  return h('div', { class: 'as-plan' },
    h('div', { class: 'plan-sum' }, v.summary),
    e.clarification ? h('div', { class: 'notice' }, e.clarification) : null,
    v.warnings.map((w) => h('div', { class: 'notice' }, w)),
    v.steps.map((st) => cp.stepView(st, progress[st.index])),
    c.phase === 'review' ? h('div', { class: 'actions' },
      h('button', { class: 'btn primary grow', 'data-key': 'as-approve', disabled: !v.ok, onclick: () => app.approvePlan() }, icon('play', 'sm'), v.ok ? `Approve & run ${v.steps.length} step${v.steps.length > 1 ? 's' : ''}` : 'Plan has problems'),
      h('button', { class: 'btn ghost', 'data-key': 'as-cancel', onclick: () => app.state.set((st) => ({ copilot: Object.assign({}, st.copilot, { validated: null, phase: 'idle', planEntry: null }) })) }, 'Cancel')) : null,
    c.phase === 'running' ? h('div', { class: 'kit-hint' }, h('span', { class: 'spin' }), ' Running…') : null,
    c.phase === 'done' && c.run ? h('div', {},
      h('div', { class: `report ${c.run.ok ? 'success' : 'failed'}` }, h('div', { class: 'report-h' }, h('span', { class: 'st' }, icon(c.run.ok ? 'check' : 'x', 'sm')),
        h('span', { class: 'msg' }, c.run.ok ? `All ${c.run.total} step(s) done and verified` : `Stopped after ${c.run.done} of ${c.run.total} step(s)`))),
      h('div', { class: 'actions' },
        c.run.results.some((r) => r.result.checkpointId) ? h('button', { class: 'btn', 'data-key': 'as-rollback', onclick: () => app.rollbackPlan() }, icon('undo', 'sm'), 'Roll back') : null,
        c.run.ok ? h('button', { class: 'btn ghost', 'data-key': 'as-save', onclick: () => app.savePlanAsRecipe() }, icon('save', 'sm'), 'Save as tool') : null)) : null);
}

function entryView(app, c, e) {
  if (e.role === 'user') return h('div', { class: 'as-msg you', 'data-key': `m-${e.id}` }, h('div', { class: 'as-bubble' }, e.text));
  return h('div', { class: `as-msg moe ${e.kind || ''}`, 'data-key': `m-${e.id}` },
    h('span', { class: 'as-av', 'aria-hidden': 'true' }, mark()),
    h('div', { class: 'as-bubble' }, e.text ? h('div', { class: 'as-text', dir: 'auto' }, e.text) : null,
      e.kind === 'local' ? localBody(app, e) : null,
      e.plan ? planBody(app, c, e) : null));
}

function sheet(app, s, c, tips) {
  const kind = A.profile(s.ctx);
  const f = W.formatOf(s.ctx && s.ctx.comp);
  const client = require('../../features/brand/kit').activeBrand(app.services.store, app.services.brands);
  const input = h('textarea', { class: 'as-input', 'data-fk': 'as-input', rows: '1', dir: 'auto', placeholder: 'Ask, or describe a change…', title: 'Arabic or English', 'aria-label': 'Ask the assistant or describe a change' }, c.request || '');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const v = input.value; input.value = ''; app.askAssistant(v); }
    if (e.key === 'Escape') { e.preventDefault(); app.closeCopilot(); }
  });
  input.addEventListener('input', () => { app.state.get().copilot.request = input.value; });
  if (c.phase !== 'thinking') setTimeout(() => { if (document.activeElement !== input && !document.querySelector('.overlay') && document.contains(input)) input.focus(); }, 0);
  const thinking = c.phase === 'thinking';
  const prompts = W.PROMPTS[kind] || W.PROMPTS.none;
  const asks = W.ASK[kind] || W.ASK.none;
  const m = mode(c);
  const tab = c.homeTab === 'ask' ? 'ask' : 'do';
  const setTab = (t) => app.state.set((st) => ({ copilot: Object.assign({}, st.copilot, { homeTab: t }) }));
  const sees = [s.ctx && s.ctx.comp ? A.CONTEXT_LABEL[kind] : 'No comp open', s.ctx && s.ctx.comp ? s.ctx.comp.name : null, f ? `${f.ratio} ${f.size}` : null, client ? client.name : null].filter(Boolean);
  const row = (p, ic, k) => h('button', { class: 'as-prompt', 'data-key': `as-p-${k}-${p}`, onclick: () => app.askAssistant(p) }, icon(ic, 'sm'), h('span', { class: 'as-prompt-t' }, p), icon('chev', 'xs'));
  return h('div', { class: 'as-sheet', role: 'dialog', 'aria-label': 'Assistant', 'data-key': 'as-sheet' },
    h('div', { class: 'as-h' }, h('span', { class: 'as-logo' }, mark()), h('b', {}, 'Assistant'), h('span', { class: 'as-chip' }, 'AI'),
      h('span', { class: 'spacer' }),
      c.thread.length ? h('button', { class: 'icon-btn', 'data-key': 'as-clear', 'aria-label': 'Start a new conversation', title: 'New conversation', onclick: () => app.clearAssistant() }, icon('refresh', 'sm')) : null,
      h('button', { class: 'icon-btn', 'data-key': 'as-close', 'aria-label': 'Close the assistant', title: 'Close (Esc)', onclick: () => app.closeCopilot() }, icon('x', 'sm'))),
    // what it works from, said plainly: the selection, the comp, its format, the active client
    h('div', { class: 'as-sees', 'aria-label': `The assistant sees: ${sees.join(', ')}`, title: 'What the assistant works from — the active comp and your selection, nothing else' }, icon('eye', 'xs'), sees.map((t, i) => h('span', { class: `as-see ${i === 0 ? 'as-see-main' : ''}`, 'data-key': `see-${i}` }, t)),
      m === 'claude' ? h('span', { class: 'as-mode on', title: 'The last answer came from Claude' }, 'Claude') : null,
      m === 'offline' ? h('button', { class: 'as-mode', 'data-key': 'as-mode', title: 'The last request was answered without Claude: your words were matched to MOE tools. Click to open Settings.', onclick: () => app.go('settings') }, 'Offline') : null),
    tips.length ? h('div', { class: 'as-tips', 'aria-label': 'Suggestions' }, h('div', { class: 'as-sec' }, icon('lightbulb', 'xs'), 'Suggested now'), tips.map((t) => tipRow(app, s, t))) : null,
    h('div', { class: 'as-thread', 'data-key': 'as-thread' },
      c.thread.length ? c.thread.map((e) => entryView(app, c, e)) : h('div', { class: 'as-empty' },
        h('div', { class: 'as-hello' }, W.HEAD[kind] || W.HEAD.none),
        // one list at a time: what it can DO to the selection, or what you can ASK about it
        h('div', { class: 'seg as-tabs', role: 'group', 'aria-label': 'What the assistant can do' },
          h('button', { 'data-key': 'as-tab-do', 'aria-pressed': String(tab === 'do'), onclick: () => setTab('do') }, 'Do it for me'),
          h('button', { 'data-key': 'as-tab-ask', 'aria-pressed': String(tab === 'ask'), onclick: () => setTab('ask') }, 'Ask a question')),
        h('div', { class: 'as-prompts' }, (tab === 'ask' ? asks : prompts).map((p) => row(p, tab === 'ask' ? 'lightbulb' : 'play', tab))),
        h('div', { class: 'as-note' }, tab === 'ask' ? (m === 'offline' ? 'Offline: your words are matched to MOE tools. Answers need a Claude key.' : 'About After Effects, motion or MOE — in Arabic or English.') : 'I plan it with MOE tools. Nothing changes until you approve.')),
      thinking ? h('div', { class: 'as-msg moe', 'data-key': 'as-thinking' }, h('span', { class: 'as-av' }, mark()), h('div', { class: 'as-bubble' }, h('span', { class: 'spin' }), ' Thinking…')) : null),
    h('div', { class: 'as-in' }, input,
      h('button', { class: 'btn primary as-send', 'data-key': 'as-send', disabled: thinking, 'aria-label': 'Send', title: 'Send (Enter) · new line: Shift+Enter', onclick: () => { const v = input.value; if (!v.trim()) { input.focus(); app.toast('Type a question or a change first — or pick a prompt', 2500, 'warn'); return; } input.value = ''; app.askAssistant(v); } }, thinking ? h('span', { class: 'spin' }) : icon('play', 'sm'))),
    h('div', { class: 'as-foot' }, h('kbd', {}, 'Enter'), 'send', h('kbd', {}, 'Shift+Enter'), 'new line', h('kbd', {}, '`'), 'open / close'));
}

/** Where the last answer came from — known only from the conversation itself, never guessed. */
function mode(c) {
  for (let i = c.thread.length - 1; i >= 0; i--) {
    const e = c.thread[i];
    if (e.role !== 'assistant') continue;
    return e.kind === 'local' ? 'offline' : 'claude';
  }
  return '';
}

let seenTurns = -1;
function render(app) {
  const s = app.state.get();
  const c = s.copilot;
  // a new message scrolls the conversation to the end (once per change, never while you read back)
  const turns = c.open ? c.thread.length + (c.phase === 'thinking' ? 1 : 0) : -1;
  if (turns !== seenTurns) { seenTurns = turns; if (turns > 0) setTimeout(() => { const el = document.querySelector('.as-thread'); if (el) el.scrollTop = el.scrollHeight; }, 0); }
  const side = app.services.store.get(SIDE_KEY, 'right') === 'left' ? 'left' : 'right';
  const tips = currentTips(app, s);
  const fab = h('button', {
    class: `as-fab ${c.open ? 'on' : ''} ${c.phase === 'thinking' ? 'busy' : ''} ${!c.open && tips.length ? 'hint' : ''}`, 'data-key': 'as-fab', 'aria-label': c.open ? 'Close the assistant' : `Assistant${tips.length ? ` — ${tips.length} suggestion${tips.length > 1 ? 's' : ''}` : ''}`, 'aria-expanded': String(!!c.open),
    title: `${c.open ? 'Close' : 'Ask or describe a change'} (\` or Ctrl+Space)\nRight-click: move to the ${side === 'right' ? 'left' : 'right'} corner`,
    onclick: () => app.toggleAssistant(),
    oncontextmenu: (e) => { e.preventDefault(); app.services.store.set(SIDE_KEY, side === 'right' ? 'left' : 'right'); app.render(); }
  }, h('span', { class: 'as-aura', 'aria-hidden': 'true' }), h('span', { class: 'as-core' }, c.open ? icon('x', '') : [mark(), h('span', { class: 'as-ai' }, 'AI')]), !c.open && tips.length ? h('span', { class: 'as-badge', 'aria-hidden': 'true' }, String(tips.length)) : null);
  return h('div', { class: `assistant side-${side} ${c.open ? 'open' : ''}`, 'data-key': 'assistant' }, c.open ? sheet(app, s, c, tips) : null, fab);
}

module.exports = { render, localMatches, currentTips, mode, SIDE_KEY };
