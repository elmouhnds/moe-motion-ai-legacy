'use strict';
const { h, icon } = require('../dom');
const ST = require('../../../features/selftest/runner');

/* ---------- v0.40 Self-Test inside After Effects (docs/features/SELF_TEST.md) ---------- */
const test = { step: 'idle', progress: null, report: null };  // idle → confirm → running → done
const LAST_KEY = 'selftest-last';
const STATUS = { pass: 'Pass', fail: 'Fail', info: 'Info', skip: 'Skipped' };

async function runTest(app) {
  test.step = 'running'; test.progress = { i: 0, total: ST.CHECKS.length, label: 'Making the test comp' }; app.scheduleRender();
  try {
    test.report = await ST.runSelfTest(app.services, { onProgress: (c, i, total) => { test.progress = { i, total, label: c.label }; app.scheduleRender(); } });
    try { app.services.store.set(LAST_KEY, test.report); } catch (_) { /* store is optional */ }
  } catch (e) {
    test.report = { error: String(e.message || e), checks: [], totals: {} };
  }
  test.step = 'done'; test.progress = null;
  try { await app.refreshContext(true); } catch (_) { /* the panel re-reads on its own */ }
  app.scheduleRender();
}

/** The card: what it does, Run (with a confirm step), live progress, results, Copy report. */
function selfTestCard(app) {
  if (!test.report && test.step === 'idle') { try { test.report = app.services.store.get(LAST_KEY, null); } catch (_) { test.report = null; } }
  const r = test.report;
  const hasComp = !!(app.state.get().ctx && app.state.get().ctx.comp);
  const rows = r && r.checks ? r.checks.map((c) => h('div', { class: `selftest-check ${c.status}`, 'data-key': `st-${c.id}` },
    h('span', { class: `selftest-badge ${c.status}` }, STATUS[c.status] || c.status), h('div', {}, h('div', { class: 'selftest-label' }, c.label), h('div', { class: 'why' }, `${c.detail}${c.ms ? ` · ${(c.ms / 1000).toFixed(1)} s` : ''}`)))) : [];
  return h('div', { class: 'selftest-card', 'data-key': 'selftest' },
    h('div', { class: 'why pad' }, `Runs MOE's advanced tools (Grid, Cloner, Effectors, Spring, Target, Noise / Image fields, Clone Colours, Points, Text Cloner) in a temporary comp, reads what After Effects computed, compares it with MOE's own maths, undoes every step and removes the comp. Your comps are not touched. About ${ST.CHECKS.length} checks, a minute or two.`),
    test.step === 'confirm'
      ? h('div', { class: 'actions pad' },
        h('span', { class: 'why' }, 'A comp named "MOE Self-Test …" will be made and removed.'),
        h('button', { class: 'btn primary', onclick: () => runTest(app) }, icon('play', 'sm'), 'Start'),
        h('button', { class: 'btn ghost', onclick: () => { test.step = 'idle'; app.scheduleRender(); } }, 'Cancel'))
      : h('div', { class: 'actions pad' },
        h('button', { class: 'btn', disabled: test.step === 'running' || !app.state.get().hostInfo, title: app.state.get().hostInfo ? 'Check MOE inside After Effects' : 'Connect to After Effects first', onclick: () => { test.step = 'confirm'; app.scheduleRender(); } }, icon('check', 'sm'), test.step === 'running' ? 'Checking…' : r ? 'Run again' : 'Check in After Effects'),
        r && r.checks && r.checks.length ? h('button', { class: 'btn ghost', onclick: () => app.copy(JSON.stringify(r, null, 2)) }, icon('copy', 'sm'), 'Copy report') : null),
    test.step === 'running' && test.progress ? h('div', { class: 'why pad', role: 'status' }, `${test.progress.i + 1} / ${test.progress.total} · ${test.progress.label}`) : null,
    r && r.error ? h('div', { class: 'notice err' }, r.error) : null,
    r && r.checks && r.checks.length ? h('div', { class: 'why pad' }, `${r.totals.pass || 0} passed · ${r.totals.fail || 0} failed · ${r.totals.info || 0} info — ${r.ae && r.ae.appVersion ? `AE ${r.ae.appVersion}` : ''}${r.startedAt ? ` · ${r.startedAt.slice(0, 16).replace('T', ' ')}` : ''}${r.cleanup && r.cleanup.removed ? ' · test comp removed' : ''}`) : null,
    rows.length ? h('div', { class: 'selftest-list' }, rows) : null,
    !hasComp ? null : null);
}

function kv(rows) {
  return h('dl', { class: 'kv' }, rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v === undefined || v === null || v === '' ? '—' : String(v))]));
}

function report(app) {
  const s = app.state.get();
  return JSON.stringify({
    moe: app.services.version, host: s.hostInfo, hostError: s.hostError, platform: app.services.platform.info,
    tools: app.services.registry.list().map((t) => `${t.id}@${t.version}`),
    ui: Object.assign({ motion: document.documentElement.getAttribute('data-motion'), uptimeS: Math.round(performance.now() / 1000) }, app.stats),
    session: app.services.cost.session(), problems: app.services.logger.entries().filter((e) => e.level !== 'info' && e.level !== 'debug').slice(-30)
  }, null, 2);
}

function render(app) {
  const s = app.state.get();
  const hi = s.hostInfo || {};
  const sess = app.services.cost.session();
  const month = app.services.cost.month();
  const logs = app.services.logger.entries().filter((e) => e.level !== 'debug').slice(-60).reverse();
  return h('div', { class: 'view' },
    h('div', { class: 'section-h' }, 'After Effects'),
    s.hostError ? h('div', { class: 'notice err' }, s.hostError) : null,
    kv([['Version', hi.appVersion], ['Build', hi.buildName || hi.buildNumber], ['Language', hi.language], ['OS', hi.os], ['ExtendScript', hi.engineVersion], ['Host module', hi.hostModuleVersion], ['Expression engine', s.ctx && s.ctx.expressionEngine]]),
    h('div', { class: 'actions pad' }, h('button', { class: 'btn', onclick: () => app.reconnect() }, icon('refresh', 'sm'), 'Reconnect'), h('button', { class: 'btn ghost', onclick: () => app.copy(report(app)) }, icon('copy', 'sm'), 'Copy report')),
    h('div', { class: 'section-h' }, 'Check in After Effects'),
    selfTestCard(app),
    h('div', { class: 'section-h' }, 'MOE Motion AI'),
    kv([['Version', app.services.version], ['Runtime', `${app.services.platform.kind} · Node ${app.services.platform.info.node}`], ['Tools', app.services.registry.list().length], ['Data folder', app.services.store.dataDir]]),
    h('div', { class: 'section-h' }, 'Panel performance'),
    kv([['Renders', `${app.stats.renders} (${(app.stats.renders / Math.max(1, performance.now() / 60000)).toFixed(1)}/min)`], ['Deferred during clicks', app.stats.deferred],
      ['Selection reads', `${app.stats.ctxReads} · last ${app.stats.ctxMs} ms`], ['Motion', document.documentElement.getAttribute('data-motion')]]),
    h('div', { class: 'why pad' }, 'If the panel ever flickers or ignores clicks: Copy report and send it — these numbers show why.'),
    h('div', { class: 'section-h' }, 'AI usage'),
    kv([['This session', `${sess.calls} calls · $${sess.usd.toFixed(4)}`], ['Tokens', `${sess.inputTokens} in · ${sess.outputTokens} out · ${sess.cacheReadTokens} cached`], ['This month', `${month.calls} calls · $${(month.usd || 0).toFixed(4)}`]]),
    h('div', { class: 'section-h' }, 'Log'),
    h('div', { class: 'log' }, logs.length ? logs.map((e) => h('div', { class: e.level }, `${e.t.slice(11, 19)} ${e.level.padEnd(5)} ${e.area}: ${e.message}`)) : 'No entries'));
}
module.exports = { render, report, selfTestCard };
