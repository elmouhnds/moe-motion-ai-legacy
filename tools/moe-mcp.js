#!/usr/bin/env node
'use strict';
/**
 * v0.99 MOE After Effects MCP server (docs/features/CLAUDE_TEST_BRIDGE.md) — lets Claude Code on the owner's computer
 * test MOE INSIDE After Effects. It speaks MCP over stdio (JSON-RPC 2.0, one message per line, no dependencies) and
 * forwards each tool call to the panel's Claude Test Bridge (extension/core/testbridge.js) on 127.0.0.1, with the
 * port + key the panel wrote to %APPDATA%\MOE Motion AI\testbridge.json. The bridge must be switched on in the panel
 * (Diagnostics › Claude Test Bridge) — nothing runs in After Effects without that click.
 *
 * Tools: moe_status · moe_list_tiles · moe_test_tiles · moe_try_tool (returns rendered frames as images) · moe_job ·
 * moe_stop · moe_logs · moe_deploy (copy this repo's extension/ into the installed panel and reload it).
 *
 * Claude Code: the repo's .mcp.json registers it (`node tools/moe-mcp.js`).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const VERSION = (() => { try { return require('../package.json').version; } catch (e) { return '0'; } })();
const ROOT = path.resolve(__dirname, '..');
const DATA = process.env.MOE_DATA_DIR || (process.platform === 'win32' && process.env.APPDATA ? path.join(process.env.APPDATA, 'MOE Motion AI') : process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support', 'MOE Motion AI') : path.join(os.homedir(), '.moe-motion-ai'));
const BUNDLE = 'tv.madtomato.moe.motionai';
const INSTALLED = process.env.MOE_EXTENSION_DIR || (process.env.APPDATA ? path.join(process.env.APPDATA, 'Adobe', 'CEP', 'extensions', BUNDLE) : path.join(os.homedir(), 'Library', 'Application Support', 'Adobe', 'CEP', 'extensions', BUNDLE));

/* ---------- the bridge ---------- */
function bridgeInfo() {
  const f = path.join(DATA, 'testbridge.json');
  if (!fs.existsSync(f)) throw new Error(`The Claude Test Bridge is off. In After Effects open MOE Motion AI › Diagnostics › Claude Test Bridge › "Allow Claude to test". (No ${f})`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
function call(cmd, body = {}, timeoutMs = 60000) {
  const { port, token } = bridgeInfo();
  const data = Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: `/v1/${cmd}`, method: 'POST', timeout: timeoutMs, headers: { 'Content-Type': 'application/json', 'Content-Length': data.length, Authorization: `Bearer ${token}` } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        let j = null;
        try { j = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { return reject(new Error(`Bad answer from the panel (${res.statusCode})`)); }
        if (res.statusCode !== 200) return reject(new Error(j.error || `HTTP ${res.statusCode}`));
        resolve(j);
      });
    });
    req.on('timeout', () => req.destroy(new Error(`The panel did not answer "${cmd}" in ${timeoutMs / 1000}s — After Effects may be busy or showing a dialog`)));
    req.on('error', (e) => reject(e.code === 'ECONNREFUSED' ? new Error('The panel is not listening — is After Effects open with MOE Motion AI, and the bridge on?') : e));
    req.end(data);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitJob(id, maxS) {
  const until = Date.now() + maxS * 1000;
  for (;;) {
    const j = await call('job', { job: id });
    if (j.state !== 'running') return j;
    if (Date.now() > until) return Object.assign(j, { note: `still running after ${maxS}s — call moe_job { job: "${id}" } later` });
    await sleep(1500);
  }
}

/* ---------- results for the model ---------- */
function summary(report) {
  if (!report) return 'No report.';
  if (report.error) return `Error: ${report.error}`;
  const t = report.totals || {};
  const lines = [`MOE ${report.moe} · After Effects ${(report.ae && report.ae.appVersion) || '?'} · ${t.pass || 0} pass · ${t.fail || 0} fail · ${t.skip || 0} skip${report.stopped ? ' · STOPPED' : ''} · ${Math.round((report.ms || 0) / 1000)} s`];
  const hp = report.hostProfile;
  if (hp) lines.push(hp.error ? `Host profile: failed — ${hp.error}` : `Host profile: ${hp.effects.length} effects read, ${hp.effects.filter((e) => !e.available).length} not available (${hp.effects.filter((e) => !e.available).map((e) => e.matchName).join(', ') || 'none'}) — compare with tools/compare-profile.js`);
  const order = { fail: 0, skip: 1, pass: 2 };
  for (const r of (report.tiles || []).slice().sort((a, b) => order[a.status] - order[b.status])) {
    lines.push(`${r.status.toUpperCase().padEnd(4)} ${r.tile} (${r.tool}) — ${r.detail}${r.undo ? ` [undo ${r.undo.presses}${r.undo.back ? ' ✓' : ' ✗'}]` : ''}${r.frames && r.frames.count ? ` [${r.frames.count} frames]` : ''}`);
  }
  return lines.join('\n');
}
function frameImages(row, want = 4) {
  if (!row || !row.frames || !row.frames.count || !row.frames.folder) return [];
  const n = row.frames.count, picks = [...new Set(Array.from({ length: Math.min(want, n) }, (_, i) => Math.round((i + 1) * (n - 1) / Math.min(want, n))))];
  const out = [];
  for (const i of picks) {
    const file = path.join(row.frames.folder, row.frames.pattern.replace('[#####]', String(i).padStart(5, '0')));
    const mime = /\.png$/i.test(file) ? 'image/png' : /\.jpe?g$/i.test(file) ? 'image/jpeg' : null;
    if (!mime) { out.push({ type: 'text', text: `frame ${i}: ${path.extname(file)} cannot be shown as an image — ${file}` }); continue; }
    try { out.push({ type: 'image', data: fs.readFileSync(file).toString('base64'), mimeType: mime }); out.push({ type: 'text', text: `frame ${i} / ${n} (${(i / row.frames.fps).toFixed(2)} s) — ${file}` }); } catch (e) { out.push({ type: 'text', text: `frame ${i}: ${e.message}` }); }
  }
  return out;
}

/* ---------- deploy (this repo → the installed panel) ---------- */
function copyDir(src, dst, skip, log) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d, skip, log); else { fs.copyFileSync(s, d); log.n++; }
  }
}
async function deploy() {
  const manifest = path.join(INSTALLED, 'CSXS', 'manifest.xml');
  if (!fs.existsSync(manifest) || !fs.readFileSync(manifest, 'utf8').includes(BUNDLE)) throw new Error(`MOE Motion AI is not installed at ${INSTALLED} — run the installer once first.`);
  const log = { n: 0 };
  // .debug opens a remote-debugging port; install.json belongs to the installer
  copyDir(path.join(ROOT, 'extension'), INSTALLED, (name) => name === '.debug' || name === '.DS_Store' || name === 'install.json', log);
  let reload = 'not reloaded (bridge off) — reopen the panel';
  try { await call('reload', {}); reload = 'panel reloading'; } catch (e) { reload = `not reloaded: ${e.message}`; }
  // the panel turns the bridge back on after a reload it was asked for; wait for it
  if (reload === 'panel reloading') {
    await sleep(2500);
    for (let i = 0; i < 20; i++) { try { const s = await call('status', {}, 8000); return `Copied ${log.n} files to ${INSTALLED}; panel reloaded — MOE ${s.moe}, After Effects ${s.ae && s.ae.appVersion}.`; } catch (e) { await sleep(1500); } }
    reload = 'panel did not come back within 30 s — check After Effects';
  }
  return `Copied ${log.n} files to ${INSTALLED}; ${reload}.`;
}

/* ---------- MCP ---------- */
const SUBJECTS = ['card', 'text', 'outline', 'cards', 'grid', 'effector', 'keys', 'none'];
const TOOLS = [
  { name: 'moe_status', description: 'Is After Effects + the MOE panel reachable? Returns MOE version, After Effects version, the active comp and any running job.', inputSchema: { type: 'object', properties: {} } },
  { name: 'moe_list_tiles', description: 'Every library tile of the MOE panel (section, id, label, tool, args). Optionally one section.', inputSchema: { type: 'object', properties: { section: { type: 'string' } } } },
  { name: 'moe_test_tiles', description: 'Run tiles INSIDE After Effects, each on a fresh temporary "MOE Self-Test Tiles" comp with a fitting subject, then press Edit > Undo for real and count. Returns pass / fail / skip per tile with the real error. All tiles take several minutes; prefer a section or ids while iterating.', inputSchema: { type: 'object', properties: { section: { type: 'string' }, ids: { type: 'array', items: { type: 'string' }, description: 'tile ids or "section/id"' }, render: { type: 'boolean', description: 'also render each result (slower)' }, waitSeconds: { type: 'number', description: 'how long to wait for the job (default 900)' } } } },
  { name: 'moe_try_tool', description: 'Run ONE registered MOE tool with given args on a fresh test subject inside After Effects, render the result with After Effects\' Render Queue and return up to 4 frames as images, then Undo and report. Use it to SEE what a tool produces.', inputSchema: { type: 'object', required: ['tool'], properties: { tool: { type: 'string', description: 'e.g. reveal.fx, grid.build, interact.clickFx' }, args: { type: 'object' }, subject: { type: 'string', enum: SUBJECTS }, seconds: { type: 'number', description: 'seconds to render (default 2.4, max 6)' }, frames: { type: 'number', description: 'images to return (default 4, max 8)' } } } },
  { name: 'moe_job', description: 'Progress or report of a job (id, or "last").', inputSchema: { type: 'object', required: ['job'], properties: { job: { type: 'string' } } } },
  { name: 'moe_stop', description: 'Stop the running job after its current tile.', inputSchema: { type: 'object', properties: {} } },
  { name: 'moe_logs', description: 'Every warning and error the panel wrote to diagnostics.jsonl (on disk, so nothing rolls off). Filters: since (ISO time), limit (default 300), code (e.g. HOST_EXCEPTION, PARAM_UNRESOLVED, HOST_TIMEOUT).', inputSchema: { type: 'object', properties: { since: { type: 'string' }, limit: { type: 'number' }, code: { type: 'string' } } } },
  { name: 'moe_deploy', description: 'Copy this repository\'s extension/ folder into the installed MOE panel and reload the panel (host scripts reload with it). Run after changing code, before testing again.', inputSchema: { type: 'object', properties: {} } }
];

async function runTool(name, a = {}) {
  const text = (t) => [{ type: 'text', text: typeof t === 'string' ? t : JSON.stringify(t, null, 1) }];
  switch (name) {
    case 'moe_status': return text(await call('status'));
    case 'moe_list_tiles': { const r = await call('tiles'); return text(r.tiles.filter((t) => !a.section || t.section === a.section).map((t) => `${t.section}/${t.id} · ${t.label} · ${t.tool} ${JSON.stringify(t.args)}`).join('\n')); }
    case 'moe_test_tiles': { const s = await call('test', { section: a.section, ids: a.ids, render: a.render ? { duration: 2.4 } : null }); const j = await waitJob(s.job, a.waitSeconds || 900); return text(`${j.note ? `${j.note}\n` : ''}${summary(j.report)}`); }
    case 'moe_try_tool': {
      const s = await call('try', { tool: a.tool, args: a.args || {}, subject: a.subject, render: { duration: Math.min(6, a.seconds || 2.4) } });
      const j = await waitJob(s.job, 300);
      const row = j.report && j.report.tiles && j.report.tiles[0];
      return text(summary(j.report)).concat(row && row.frames && row.frames.error ? text(`render: ${row.frames.error}`) : [], frameImages(row, Math.min(8, a.frames || 4)));
    }
    case 'moe_job': { const j = await call('job', { job: a.job }); return text(j.state === 'running' ? `running ${j.progress.i + 1}/${j.progress.total} · ${j.progress.label}` : summary(j.report)); }
    case 'moe_stop': return text(await call('stop'));
    case 'moe_logs': return text((await call('logs', { since: a.since, limit: a.limit, code: a.code })).entries.map((e) => `${e.t} ${e.level} ${e.area}: ${e.message}${e.data ? ` ${JSON.stringify(e.data)}` : ''}`).join('\n') || 'No warnings or errors.');
    case 'moe_deploy': return text(await deploy());
    default: throw new Error(`Unknown tool ${name}`);
  }
}

function reply(id, result) { process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`); }
function fail(id, code, message) { process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`); }

async function onMessage(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') return reply(id, { protocolVersion: (params && params.protocolVersion) || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'moe-after-effects', version: VERSION } });
  if (method === 'ping') return reply(id, {});
  if (method === 'tools/list') return reply(id, { tools: TOOLS });
  if (method === 'tools/call') {
    try { return reply(id, { content: await runTool(params.name, params.arguments || {}) }); } catch (e) { return reply(id, { content: [{ type: 'text', text: String(e.message || e) }], isError: true }); }
  }
  if (id === undefined || id === null) return undefined; // a notification
  return fail(id, -32601, `Method not found: ${method}`);
}

if (require.main === module) {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let msg; try { msg = JSON.parse(line); } catch (e) { fail(null, -32700, 'Parse error'); continue; }
      onMessage(msg).catch((e) => fail(msg.id, -32603, String(e.message || e)));
    }
  });
}

module.exports = { TOOLS, runTool, onMessage, summary, frameImages, deploy };
