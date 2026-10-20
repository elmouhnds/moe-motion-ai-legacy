'use strict';
/** In-panel updates: feed validation, verified download, launch modes, install detection, release script. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const U = require('../extension/core/updater');

const FEED_URL = 'https://updates.example.com/moe/latest.json';
const SHA = 'b'.repeat(64);
const feed = (over = {}) => Object.assign({
  format: 'moe-update', version: 1, product: U.PRODUCT,
  release: { version: '0.7.0', published: '2026-11-01T00:00:00Z', notes: 'Notes', minAE: '25.0' },
  installer: { url: 'MOE-Motion-AI-Setup-0.7.0.exe', sha256: SHA, size: 1000 }
}, over);

test('Versions compare numerically', () => {
  assert.equal(U.compare('0.10.0', '0.9.9'), 1);
  assert.equal(U.compare('1.0.0', '1.0.0'), 0);
  assert.equal(U.compare('0.6.1', '0.7.0'), -1);
  assert.equal(U.compare('bad', '0.1.0'), -1);
});

test('Feed: relative installer URL resolves against the feed; newer detected', () => {
  const r = U.parseFeed(JSON.stringify(feed()), { feedUrl: FEED_URL, current: '0.6.1' });
  assert.equal(r.ok, true);
  assert.equal(r.newer, true);
  assert.equal(r.update.url, 'https://updates.example.com/moe/MOE-Motion-AI-Setup-0.7.0.exe');
  assert.equal(U.parseFeed(feed(), { feedUrl: FEED_URL, current: '0.7.0' }).newer, false);
});

test('Feed: untrusted fields are rejected', () => {
  const bad = (f, msg) => { const r = U.parseFeed(JSON.stringify(f), { feedUrl: FEED_URL, current: '0.6.1' }); assert.equal(r.ok, false, msg); return r.error; };
  assert.match(bad(feed({ format: 'other' })), /format/);
  assert.match(bad(feed({ product: 'com.evil' })), /another product/);
  assert.match(bad(feed({ release: { version: 'latest' } })), /version/);
  assert.match(bad(feed({ installer: { url: 'x.exe', sha256: 'nope', size: 10 } })), /SHA-256/);
  assert.match(bad(feed({ installer: { url: 'x.exe', sha256: SHA, size: 0 } })), /size/);
  assert.match(bad(feed({ installer: { url: 'x.exe', sha256: SHA, size: U.MAX_SIZE + 1 } })), /size/);
  assert.match(bad(feed({ installer: { url: 'http://plain.example.com/x.exe', sha256: SHA, size: 10 } })), /HTTPS/);
  assert.match(bad(feed({ installer: { url: 'https://x.example.com/setup.zip', sha256: SHA, size: 10 } })), /\.exe/);
  assert.equal(U.parseFeed('{oops', { feedUrl: FEED_URL, current: '0.6.1' }).ok, false);
});

function fakeSystem({ bytes = 1000, sha = SHA, fail = null } = {}) {
  const calls = { launch: [], removed: [] };
  return {
    calls,
    tempPath: (n) => `/tmp/moe/${n}`,
    download: async (url, dest, { maxBytes }) => { if (fail) throw Object.assign(new Error(fail), { code: fail }); calls.url = url; calls.max = maxBytes; },
    fileSize: () => bytes,
    sha256File: async () => sha,
    removeFile: (p) => calls.removed.push(p),
    launch: (file, args) => calls.launch.push([file, args]),
    extensionInfo: (root) => ({ root, linked: false, install: { installer: 'nsis', version: '0.6.1' } })
  };
}
const make = (http, system, feedUrl = FEED_URL) => U.createUpdater({ http, system, current: '0.6.1', getSettings: () => ({ updates: { feedUrl } }), root: '/ext' });
const okHttp = { request: async () => ({ status: 200, body: JSON.stringify(feed()) }) };

test('check(): HTTPS feed only; HTTP errors and offline are reported, never thrown', async () => {
  assert.match((await make(okHttp, fakeSystem(), 'http://updates.example.com/latest.json').check()).error, /https/);
  assert.match((await make(okHttp, fakeSystem(), '').check()).error, /No update feed/);
  assert.match((await make({ request: async () => ({ status: 404, body: '' }) }, fakeSystem()).check()).error, /404/);
  assert.match((await make({ request: async () => { throw Object.assign(new Error('x'), { code: 'ENOTFOUND' }); } }, fakeSystem()).check()).error, /ENOTFOUND/);
  const r = await make(okHttp, fakeSystem()).check();
  assert.equal(r.ok, true);
  assert.equal(r.newer, true);
});

test('download(): verified file kept; size or hash mismatch deletes it', async () => {
  const update = U.parseFeed(feed(), { feedUrl: FEED_URL, current: '0.6.1' }).update;
  const good = fakeSystem();
  const r = await make(okHttp, good).download(update);
  assert.equal(r.ok, true);
  assert.equal(good.calls.max, 1000 + 1024, 'size cap passed to the downloader');
  for (const sys of [fakeSystem({ bytes: 999 }), fakeSystem({ sha: 'c'.repeat(64) })]) {
    const x = await make(okHttp, sys).download(update);
    assert.equal(x.ok, false);
    assert.match(x.error, /does not match/);
    assert.equal(sys.calls.removed.length, 1, 'bad file deleted');
  }
  const off = fakeSystem({ fail: 'ETIMEDOUT' });
  assert.match((await make(okHttp, off).download(update)).error, /ETIMEDOUT/);
});

test('launch(): /WAITAE when installing on close; only .exe files', () => {
  const sys = fakeSystem();
  const up = make(okHttp, sys);
  assert.equal(up.launch('C:/t/MOE-Motion-AI-Setup-0.7.0.exe', 'on-close').ok, true);
  assert.equal(up.launch('C:/t/MOE-Motion-AI-Setup-0.7.0.exe', 'now').ok, true);
  assert.deepEqual(sys.calls.launch.map((c) => c[1]), [['/WAITAE'], []]);
  assert.equal(up.launch('C:/t/evil.bat').ok, false);
  assert.equal(up.installInfo().kind, 'installer');
});

test('Install detection: installer record, developer link, manual copy', () => {
  assert.equal(U.installKind({ linked: true, install: null }), 'dev-link');
  assert.equal(U.installKind({ linked: false, install: { installer: 'nsis' } }), 'installer');
  assert.equal(U.installKind({ linked: false, install: null }), 'manual');
  assert.equal(U.installKind(null), 'unknown');
});

test('Node platform helpers: sha256File and extensionInfo on a real folder and a symlink', async () => {
  const { createNodePlatform } = require('../extension/core/platform/node');
  process.env.MOE_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'moe-data-'));
  const sys = createNodePlatform().system;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moe-ext-'));
  const file = path.join(dir, 'a.bin');
  fs.writeFileSync(file, 'hello');
  assert.equal(await sys.sha256File(file), crypto.createHash('sha256').update('hello').digest('hex'));
  fs.writeFileSync(path.join(dir, 'install.json'), '{"installer":"nsis","version":"0.6.1"}');
  assert.equal(U.installKind(sys.extensionInfo(dir)), 'installer');
  const link = `${dir}-link`;
  fs.symlinkSync(dir, link);
  assert.equal(U.installKind(sys.extensionInfo(link)), 'dev-link');
  await assert.rejects(sys.download('http://example.com/x.exe', path.join(dir, 'x.exe')), /HTTPS/);
});

test('Release script: versions agree across files; notes come from the CHANGELOG', () => {
  const R = require('../tools/build-release');
  const v = R.versions();
  assert.equal(v, require('../package.json').version);
  assert.match(R.notes(v), new RegExp(`^## \\[${v.replace(/\./g, '\\.')}\\]`));
});

test('End to end over real HTTPS (local server, self-signed): redirect followed, file verified, oversize refused', async (t) => {
  const { execFileSync } = require('child_process');
  const https = require('https');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moe-tls-'));
  try {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dir, 'k.pem'), '-out', path.join(dir, 'c.pem'), '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], { stdio: 'ignore' });
  } catch (e) { t.skip('openssl not available'); return; }
  const cert = fs.readFileSync(path.join(dir, 'c.pem'));
  const payload = crypto.randomBytes(50000);
  const sha = crypto.createHash('sha256').update(payload).digest('hex');
  const server = https.createServer({ key: fs.readFileSync(path.join(dir, 'k.pem')), cert }, (req, res) => {
    if (req.url === '/latest.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(feed({ installer: { url: 'go/MOE-Motion-AI-Setup-0.7.0.exe', sha256: sha, size: payload.length } }))); }
    if (req.url === '/go/MOE-Motion-AI-Setup-0.7.0.exe') { res.writeHead(302, { location: '/files/MOE-Motion-AI-Setup-0.7.0.exe' }); return res.end(); }
    if (req.url === '/files/MOE-Motion-AI-Setup-0.7.0.exe') { res.writeHead(200, { 'content-length': payload.length }); return res.end(payload); }
    res.writeHead(404); res.end();
  });
  await new Promise((r) => server.listen(0, 'localhost', r));
  const prevCa = https.globalAgent.options.ca;
  https.globalAgent.options.ca = cert;
  try {
    const { createNodePlatform } = require('../extension/core/platform/node');
    process.env.MOE_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'moe-data-'));
    const plat = createNodePlatform();
    const base = `https://localhost:${server.address().port}`;
    const up = U.createUpdater({ http: plat.http, system: plat.system, current: '0.6.1', getSettings: () => ({ updates: { feedUrl: `${base}/latest.json` } }), root: dir });
    const c = await up.check();
    assert.equal(c.ok, true, c.error);
    assert.equal(c.newer, true);
    let progress = 0;
    const d = await up.download(c.update, (got) => { progress = got; });
    assert.equal(d.ok, true, d.error);
    assert.equal(progress, payload.length);
    assert.deepEqual(fs.readFileSync(d.file), payload);
    fs.unlinkSync(d.file);
    // The feed lies about the size: the download is cut off and nothing is kept.
    const lying = Object.assign({}, c.update, { size: 1000 });
    const bad = await up.download(lying);
    assert.equal(bad.ok, false);
    assert.equal(fs.existsSync(d.file), false);
  } finally {
    https.globalAgent.options.ca = prevCa;
    server.close();
  }
});
