'use strict';
const { h, icon } = require('../dom');

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
module.exports = { render, report };
