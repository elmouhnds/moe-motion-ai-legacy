'use strict';
/**
 * v0.99 Claude Test Bridge (docs/features/CLAUDE_TEST_BRIDGE.md) — the owner: "we want Opus to review and test the
 * tool inside After Effects by itself, as a plugin inside After Effects".
 *
 * Claude Code runs on the owner's own computer; its MCP server (tools/moe-mcp.js) talks to THIS bridge, which runs in
 * the panel's Node.js. The bridge only:
 *   - listens on 127.0.0.1 (never another interface), on a random free port;
 *   - answers a request only with the token it wrote to <data>/testbridge.json (readable by this Windows user only);
 *   - accepts a fixed list of commands (below) — NO script, NO eval, NO host op by name: tools run through the
 *     executor on a fresh "MOE Self-Test Tiles" comp (tileRunner), never on the user's comps;
 *   - is OFF until the user turns it on in Diagnostics (and off again with one click, or when the panel closes).
 *
 * Commands (POST /v1/<cmd>, JSON body, `Authorization: Bearer <token>`):
 *   status            version, After Effects, the active comp's name and layer count, busy job
 *   tiles             every library tile { section, id, label, tool, args }
 *   test  {section?, ids?, render?}   start a Tile Test job → { job }
 *   try   {tool, args, subject?, render?}   one tool on a fresh test subject → { job }
 *   job   {job}        progress / report of a job
 *   stop               stop the running job after its current tile
 *   logs               the panel's last warnings and errors
 *   reload             reload the panel (after new code was deployed) — the host scripts reload with it
 */
const MAX_BODY = 64 * 1024;
const COMMANDS = ['status', 'tiles', 'test', 'try', 'job', 'stop', 'logs', 'reload'];

function createTestBridge({ services, http, fs, path, crypto, onReload, onChange, dataDir }) {
  const TT = require('../features/selftest/tileRunner');
  const file = path.join(dataDir || services.store.dataDir || services.platform.fs.dataDir, 'testbridge.json');
  let server = null, token = null, port = 0;
  const jobs = new Map();
  let running = null;

  const tiles = () => TT.libraryTiles(require('../app/ui/studio/sections').SECTIONS);

  function startJob(kind, list, opts) {
    if (running) { const e = new Error(`A job is running (${running.id}) — wait for it or send stop`); e.status = 409; throw e; }
    const id = `${kind}-${Date.now().toString(36)}`;
    const job = { id, kind, state: 'running', progress: { i: 0, total: list.length, label: '' }, report: null, stop: false, startedAt: new Date().toISOString() };
    jobs.set(id, job); running = job;
    if (onChange) onChange();
    TT.runTiles(services, list, Object.assign({}, opts, { shouldStop: () => job.stop, onProgress: (i, total, label) => { job.progress = { i, total, label }; } }))
      .then((r) => { job.report = r; job.state = r.stopped ? 'stopped' : 'done'; })
      .catch((e) => { job.report = { error: String(e.message || e) }; job.state = 'failed'; })
      .finally(() => { running = null; services.logger.info('bridge', `${kind} job ${job.state}`, { id }); if (onChange) onChange(); });
    return { job: id, tiles: list.length };
  }

  const handlers = {
    async status() {
      let ae = null, ctx = null;
      try { ae = await services.host.call('host.ping', {}); } catch (e) { ae = { error: e.message }; }
      try { const c = await services.executor.readContext(); ctx = c && c.comp ? { comp: c.comp.name, layers: (c.compLayers || []).length, selected: (c.layers || []).length } : { comp: null }; } catch (e) { ctx = { error: e.message }; }
      return { moe: services.version, ae: ae && { appVersion: ae.appVersion, os: ae.os, error: ae.error }, context: ctx, job: running ? { id: running.id, progress: running.progress } : null };
    },
    async tiles() { return { tiles: tiles().map((t) => ({ section: t.section, id: t.id, label: t.label, tool: t.tool, args: t.args || {} })) }; },
    async test(b) {
      let list = tiles();
      if (b.section) list = list.filter((t) => t.section === b.section);
      if (Array.isArray(b.ids) && b.ids.length) list = list.filter((t) => b.ids.includes(t.id) || b.ids.includes(`${t.section}/${t.id}`));
      if (!list.length) { const e = new Error('No tile matches'); e.status = 400; throw e; }
      return startJob('test', list, { render: b.render ? { duration: Number(b.render.duration) || 2.4 } : null });
    },
    async try(b) {
      if (!b || typeof b.tool !== 'string' || !services.registry.get(b.tool)) { const e = new Error(`Unknown tool: ${b && b.tool}`); e.status = 400; throw e; }
      const subjects = ['card', 'text', 'outline', 'cards', 'grid', 'effector', 'keys', 'none'];
      if (b.subject && !subjects.includes(b.subject)) { const e = new Error(`subject is one of ${subjects.join(', ')}`); e.status = 400; throw e; }
      // args are validated by the executor against the tool's own schema, like any click
      const tile = { section: 'try', id: b.tool.replace(/[^a-z0-9]+/gi, '-'), label: `Try ${b.tool}`, tool: b.tool, args: b.args && typeof b.args === 'object' ? b.args : {}, subject: b.subject || undefined };
      return startJob('try', [tile], { render: b.render === false ? null : { duration: Number(b.render && b.render.duration) || 2.4 } });
    },
    async job(b) {
      const job = jobs.get(b && b.job) || (b && b.job === 'last' ? [...jobs.values()].pop() : null);
      if (!job) { const e = new Error('No such job'); e.status = 404; throw e; }
      return { id: job.id, state: job.state, progress: job.progress, report: job.report };
    },
    async stop() { if (running) running.stop = true; return { stopping: !!running }; },
    async logs() { return { entries: services.logger.entries().filter((e) => e.level !== 'debug' && e.level !== 'info').slice(-60) }; },
    async reload() {
      // the bridge comes back on after THIS reload only (asked by the authenticated client, valid 2 minutes)
      services.store.set('bridge-resume', { until: Date.now() + 120000 });
      setTimeout(() => { if (onReload) onReload(); }, 150);
      return { reloading: true };
    }
  };

  function send(res, code, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body);
  }

  function same(a, b) { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && crypto.timingSafeEqual(x, y); }

  async function handle(req, res) {
    // 127.0.0.1 only, POST only, no browser origin (a web page cannot reach it with a forged request)
    if (req.socket.remoteAddress !== '127.0.0.1' && req.socket.remoteAddress !== '::ffff:127.0.0.1') return send(res, 403, { error: 'local only' });
    if (req.headers.origin) return send(res, 403, { error: 'no browser requests' });
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
    const m = /^\/v1\/([a-z]+)$/.exec(req.url || '');
    if (!m || !COMMANDS.includes(m[1])) return send(res, 404, { error: `commands: ${COMMANDS.join(', ')}` });
    const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!same(auth, token)) return send(res, 401, { error: 'bad token' });
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { req.destroy(); } else chunks.push(c); });
    req.on('end', async () => {
      let body = {};
      try { body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; } catch (e) { return send(res, 400, { error: 'body is not JSON' }); }
      try { send(res, 200, await handlers[m[1]](body || {})); } catch (e) { send(res, e.status || 500, { error: String(e.message || e) }); }
    });
  }

  return {
    get on() { return !!server; },
    get port() { return port; },
    get job() { return running ? { id: running.id, progress: running.progress } : null; },
    file,
    start() {
      if (server) return Promise.resolve({ port, file });
      token = crypto.randomBytes(24).toString('hex');
      return new Promise((resolve, reject) => {
        server = http.createServer((req, res) => { handle(req, res).catch((e) => send(res, 500, { error: String(e.message || e) })); });
        server.on('error', (e) => { server = null; reject(e); });
        server.listen(0, '127.0.0.1', () => {
          port = server.address().port;
          fs.writeFileSync(file, JSON.stringify({ port, token, moe: services.version, pid: process.pid, startedAt: new Date().toISOString() }, null, 1), { encoding: 'utf8', mode: 0o600 });
          services.logger.info('bridge', 'Claude Test Bridge on', { port });
          if (onChange) onChange();
          resolve({ port, file });
        });
      });
    },
    stop() {
      if (running) running.stop = true;
      try { fs.unlinkSync(file); } catch (_) { /* already gone */ }
      if (!server) return Promise.resolve();
      return new Promise((resolve) => { server.close(() => resolve()); server = null; token = null; port = 0; if (onChange) onChange(); });
    },
    _handlers: handlers
  };
}

module.exports = { createTestBridge, COMMANDS };
