'use strict';
const { h, icon } = require('../dom');
const ST = require('../../../features/selftest/runner');
const PR = require('../../../features/previews/renderer');
const TT = require('../../../features/selftest/tileRunner');

/* ---------- v0.98.2 Tile Test (docs/features/TILE_TEST.md) — every tile, inside After Effects ---------- */
const tt = { step: 'idle', section: 'all', progress: null, report: null, stop: false, filter: 'fail' };
const TT_KEY = 'tiletest-last';
async function runTileTest(app) {
  const { SECTIONS } = require('../studio/sections');
  tt.step = 'running'; tt.stop = false; tt.report = null; tt.progress = { i: 0, total: 0, label: 'Starting' }; app.scheduleRender();
  try {
    tt.report = await TT.runTiles(app.services, TT.libraryTiles(SECTIONS, tt.section === 'all' ? null : tt.section), { shouldStop: () => tt.stop, onProgress: (i, total, label) => { tt.progress = { i, total, label }; app.scheduleRender(); } });
    try { app.services.store.set(TT_KEY, tt.report); } catch (_) { /* store is optional */ }
  } catch (e) { tt.report = { error: String(e.message || e), tiles: [], totals: {} }; }
  tt.step = 'done'; tt.progress = null;
  try { await app.refreshContext(true); } catch (_) { /* re-reads on its own */ }
  app.scheduleRender();
}
/* ---------- v0.99 Claude Test Bridge (docs/features/CLAUDE_TEST_BRIDGE.md) ---------- */
function bridgeOf(app) {
  if (app.bridge !== undefined) return app.bridge;
  let mods = null;
  try { mods = { http: require('http'), fs: require('fs'), path: require('path'), crypto: require('crypto') }; } catch (_) { mods = null; }
  if (!mods || !mods.http || !mods.http.createServer) { app.bridge = null; return null; } // the browser preview has no Node
  app.bridge = require('../../../core/testbridge').createTestBridge(Object.assign({ services: app.services, onReload: () => { try { window.location.reload(); } catch (_) { /* not in a panel */ } }, onChange: () => app.scheduleRender() }, mods));
  try { window.addEventListener('beforeunload', () => { app.bridge && app.bridge.stop(); }); } catch (_) { /* no window */ }
  return app.bridge;
}
function bridgeCard(app) {
  const b = bridgeOf(app);
  if (!b) return h('div', { class: 'selftest-card', 'data-key': 'bridge' }, h('div', { class: 'why pad' }, 'Claude Test Bridge works only inside After Effects (it needs the panel\'s Node.js).'));
  const toggle = async () => {
    try { if (b.on) await b.stop(); else await b.start(); } catch (e) { app.toast(`Claude Test Bridge: ${e.message}`, 5000, 'warn'); }
    app.scheduleRender();
  };
  return h('div', { class: 'selftest-card', 'data-key': 'bridge' },
    h('div', { class: 'why pad' }, 'Lets Claude Code on THIS computer test MOE inside After Effects: run tiles and tools on a temporary "MOE Self-Test" comp, render the result, press Ctrl+Z and read the report — the same as Test every tile, driven by Claude. Local only (127.0.0.1) with a private key file; no scripts, only MOE\'s own tools; your comps are not touched. Off when the panel closes.'),
    h('div', { class: 'actions pad' },
      h('button', { class: `btn${b.on ? '' : ' primary'}`, disabled: !app.state.get().hostInfo && !b.on, onclick: toggle }, icon(b.on ? 'x' : 'play', 'sm'), b.on ? 'Turn off' : 'Allow Claude to test'),
      b.on ? h('span', { class: 'why' }, `On · port ${b.port}${b.job ? ` · ${b.job.id}: ${b.job.progress.i + 1}/${b.job.progress.total} ${b.job.progress.label}` : ' · waiting for Claude'}`) : null),
    b.on ? h('div', { class: 'why pad' }, `Key file: ${b.file}`) : null);
}

/** The report to send: totals, then every failed / skipped tile first (what needs fixing), then the passes. */
function tileReportText(r) {
  const order = { fail: 0, skip: 1, pass: 2 };
  return JSON.stringify(Object.assign({}, r, { tiles: (r.tiles || []).slice().sort((a, b) => order[a.status] - order[b.status]) }), null, 1);
}
function tileTestCard(app) {
  const { SECTIONS } = require('../studio/sections');
  if (!tt.report && tt.step === 'idle') { try { tt.report = app.services.store.get(TT_KEY, null); } catch (_) { tt.report = null; } }
  const libs = SECTIONS.filter((s) => s.kind === 'library' && Array.isArray(s.tiles));
  const count = TT.libraryTiles(SECTIONS, tt.section === 'all' ? null : tt.section).length;
  const r = tt.report, busy = tt.step === 'running';
  const shown = r && r.tiles ? r.tiles.filter((t) => tt.filter === 'all' || t.status === tt.filter) : [];
  return h('div', { class: 'selftest-card', 'data-key': 'tile-test' },
    h('div', { class: 'why pad' }, 'Runs every tile the way a click does, each in its own temporary "MOE Self-Test Tiles" comp (a card, the words "MOE Motion", three cards, or a ready grid with an effector), then presses Edit › Undo in After Effects and counts how many it takes to bring everything back. Your comps are not touched. All tiles take several minutes; Stop works between tiles.'),
    h('div', { class: 'actions pad' },
      h('select', { class: 'inp', 'aria-label': 'Which tiles to test', disabled: busy, value: tt.section, onchange: (e) => { tt.section = e.target.value; app.scheduleRender(); } },
        [h('option', { value: 'all', selected: tt.section === 'all' }, 'All libraries')].concat(libs.map((s) => h('option', { value: s.id, selected: tt.section === s.id }, s.label)))),
      h('span', { class: 'why' }, `${count} tile(s)`)),
    h('div', { class: 'actions pad' },
      busy ? h('button', { class: 'btn', onclick: () => { tt.stop = true; app.scheduleRender(); } }, icon('x', 'sm'), tt.stop ? 'Stopping after this tile…' : 'Stop')
        : h('button', { class: 'btn primary', disabled: !app.state.get().hostInfo, title: app.state.get().hostInfo ? 'Test every tile in After Effects' : 'Connect to After Effects first', onclick: () => runTileTest(app) }, icon('play', 'sm'), r ? 'Test again' : 'Test every tile'),
      r && r.tiles && r.tiles.length && !busy ? h('button', { class: 'btn ghost', onclick: () => app.copy(tileReportText(r)) }, icon('copy', 'sm'), 'Copy report') : null),
    busy && tt.progress ? h('div', { class: 'why pad', role: 'status' }, `${tt.progress.i + 1} / ${tt.progress.total || '…'} · ${tt.progress.label}`) : null,
    r && r.error ? h('div', { class: 'notice err' }, r.error) : null,
    r && r.tiles && r.tiles.length ? h('div', { class: 'why pad' }, `${r.totals.pass || 0} passed · ${r.totals.fail || 0} failed · ${r.totals.skip || 0} need something else in the comp${r.stopped ? ' · stopped' : ''} — ${((r.ms || 0) / 1000).toFixed(0)} s${r.ae && r.ae.appVersion ? ` · AE ${r.ae.appVersion}` : ''}`) : null,
    r && r.tiles && r.tiles.length ? h('div', { class: 'actions pad' }, ['fail', 'skip', 'pass', 'all'].map((f) => h('button', { class: `btn ghost${tt.filter === f ? ' on' : ''}`, 'aria-pressed': String(tt.filter === f), onclick: () => { tt.filter = f; app.scheduleRender(); } }, { fail: 'Failed', skip: 'Skipped', pass: 'Passed', all: 'All' }[f]))) : null,
    shown.length ? h('div', { class: 'selftest-list' }, shown.slice(0, 80).map((t) => h('div', { class: `selftest-check ${t.status}`, 'data-key': `tt-${t.tile}` },
      h('span', { class: `selftest-badge ${t.status}` }, STATUS[t.status] || t.status), h('div', {}, h('div', { class: 'selftest-label' }, `${t.label} · ${t.tool}`), h('div', { class: 'why' }, `${t.detail}${t.ms ? ` · ${(t.ms / 1000).toFixed(1)} s` : ''}`))))) : null);
}

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

/* ---------- v0.96 Rendered previews (docs/features/RENDERED_PREVIEWS.md) ---------- */
const rp = { step: 'idle', section: 'animate', progress: null, report: null, stop: false };
function libraryTiles(id) {
  const { SECTIONS } = require('../studio/sections');
  return SECTIONS.filter((s) => s.kind === 'library' && Array.isArray(s.tiles) && (id === 'all' || s.id === id)).flatMap((s) => s.tiles);
}
async function runRender(app, force) {
  rp.step = 'running'; rp.stop = false; rp.report = null; rp.progress = { i: 0, total: 0, label: 'Starting' }; app.scheduleRender();
  try {
    rp.report = await PR.renderTiles(app.services, libraryTiles(rp.section), { force, shouldStop: () => rp.stop, onProgress: (i, total, label) => { rp.progress = { i, total, label }; app.scheduleRender(); } });
  } catch (e) { rp.report = { error: String(e.message || e), rendered: [], failed: [], skipped: [] }; }
  rp.step = 'done'; rp.progress = null;
  try { await app.refreshContext(true); } catch (_) { /* re-reads on its own */ }
  app.scheduleRender();
}
function renderCard(app) {
  const { SECTIONS } = require('../studio/sections');
  const libs = SECTIONS.filter((s) => s.kind === 'library' && Array.isArray(s.tiles));
  const p = PR.plan(libraryTiles(rp.section), app.services.registry);
  const r = rp.report;
  const busy = rp.step === 'running';
  return h('div', { class: 'selftest-card', 'data-key': 'render-previews' },
    h('div', { class: 'why pad' }, `After Effects renders each tile's real result — the tool with the tile's own settings on a card or the words "MOE Motion", ${PR.SCENE.width} × ${PR.SCENE.height}, ${PR.SCENE.fps} fps — and the tile plays those frames. Each tile is made and removed in its own "MOE Self-Test Preview" comp; your comps and your Render Queue items are not touched (queued ones are paused while it renders and switched back on). Tiles already rendered with the same settings are skipped.`),
    h('div', { class: 'actions pad' },
      h('select', { class: 'inp', 'aria-label': 'Which tiles', disabled: busy, value: rp.section, onchange: (e) => { rp.section = e.target.value; app.scheduleRender(); } },
        [h('option', { value: 'all', selected: rp.section === 'all' }, 'All libraries')].concat(libs.map((s) => h('option', { value: s.id, selected: rp.section === s.id }, s.label)))),
      h('span', { class: 'why' }, `${p.ok.length} tile(s) can be rendered${p.skip.length ? ` · ${p.skip.length} not yet` : ''}`)),
    h('div', { class: 'actions pad' },
      busy ? h('button', { class: 'btn', onclick: () => { rp.stop = true; app.scheduleRender(); } }, icon('x', 'sm'), rp.stop ? 'Stopping after this tile…' : 'Stop')
        : h('button', { class: 'btn', disabled: !app.state.get().hostInfo || !p.ok.length, title: app.state.get().hostInfo ? 'Render the previews in After Effects' : 'Connect to After Effects first', onclick: () => runRender(app, false) }, icon('play', 'sm'), 'Render previews'),
      busy ? null : h('button', { class: 'btn ghost', disabled: !app.state.get().hostInfo || !p.ok.length, onclick: () => runRender(app, true) }, icon('refresh', 'sm'), 'Render again (all)')),
    busy && rp.progress ? h('div', { class: 'why pad', role: 'status' }, `${rp.progress.i + 1} / ${rp.progress.total || '…'} · ${rp.progress.label}`) : null,
    r && r.error ? h('div', { class: 'notice err' }, r.error) : null,
    r && !r.error ? h('div', { class: 'why pad' }, `${r.rendered.filter((x) => !x.cached).length} rendered · ${r.rendered.filter((x) => x.cached).length} already up to date · ${r.failed.length} failed · ${r.skipped.length} not rendered yet${r.stopped ? ' · stopped' : ''} — ${(r.ms / 1000).toFixed(0)} s`) : null,
    r && r.failed && r.failed.length ? h('div', { class: 'selftest-list' }, r.failed.slice(0, 30).map((f) => h('div', { class: 'selftest-check fail', 'data-key': `rf-${f.id}` }, h('span', { class: 'selftest-badge fail' }, 'Fail'), h('div', {}, h('div', { class: 'selftest-label' }, f.label), h('div', { class: 'why' }, f.why))))) : null);
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
    session: app.services.cost.session(), problems: app.services.logger.problems().slice(-30)
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
    h('div', { class: 'section-h' }, 'Claude Test Bridge'),
    bridgeCard(app),
    h('div', { class: 'section-h' }, 'Test every tile in After Effects'),
    tileTestCard(app),
    h('div', { class: 'section-h' }, 'Check in After Effects'),
    selfTestCard(app),
    h('div', { class: 'section-h' }, 'Rendered previews'),
    renderCard(app),
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
module.exports = { render, report, selfTestCard, tileTestCard, tileReportText, bridgeOf };
