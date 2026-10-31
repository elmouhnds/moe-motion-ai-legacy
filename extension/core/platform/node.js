'use strict';
/**
 * Node platform adapter (runs inside the CEP panel's Node.js context).
 * Provides: filesystem, HTTPS, and secret storage.
 *
 * Secret storage on Windows uses DPAPI (CurrentUser scope) through the
 * built-in Windows PowerShell 5.1 — no native modules, nothing to compile.
 * The key is passed via stdin, never on the command line.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');
const crypto = require('crypto');

const APP_DIR_NAME = 'MOE Motion AI';

function resolveDataDir() {
  if (process.env.MOE_DATA_DIR) return process.env.MOE_DATA_DIR;
  if (process.platform === 'win32' && process.env.APPDATA) return path.join(process.env.APPDATA, APP_DIR_NAME);
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', APP_DIR_NAME);
  return path.join(os.homedir(), '.moe-motion-ai');
}

function createFs(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  return {
    dataDir,
    join: (...p) => path.join(...p),
    exists: (p) => fs.existsSync(p),
    readText: (p) => fs.readFileSync(p, 'utf8'),
    writeText: (p, s) => fs.writeFileSync(p, s, 'utf8'),
    writeTextAtomic: (p, s) => {
      const tmp = `${p}.tmp-${process.pid}`;
      fs.writeFileSync(tmp, s, 'utf8');
      fs.renameSync(tmp, p);
    },
    appendText: (p, s) => fs.appendFileSync(p, s, 'utf8'),
    readBytes: (p) => new Uint8Array(fs.readFileSync(p)),
    writeBytes: (p, bytes) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, Buffer.from(bytes)); },
    remove: (p) => { if (fs.existsSync(p)) fs.unlinkSync(p); },
    /** Last-modified time (ms), 0 if missing — lets two MOE panels notice each other's writes. */
    mtime: (p) => { try { return fs.statSync(p).mtimeMs; } catch (e) { return 0; } }
  };
}

function request({ method = 'POST', url, headers = {}, body, timeoutMs = 120000 }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      method, hostname: u.hostname, path: u.pathname + u.search, port: u.port || 443,
      headers: Object.assign({}, headers, body ? { 'content-length': Buffer.byteLength(body) } : {})
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.setTimeout(timeoutMs, () => req.destroy(Object.assign(new Error('Request timed out'), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * GET a web page / stylesheet / image for Brand import (v0.25). HTTPS only (every redirect too, max 5),
 * size-capped while streaming (truncate = keep the first maxBytes instead of failing), timed out.
 * binary → body is base64 (images); otherwise UTF-8 text. Nothing fetched is ever executed.
 */
function get(url, { maxBytes = 3 * 1024 * 1024, timeoutMs = 20000, binary = false, truncate = false, accept = '*/*' } = {}) {
  return new Promise((resolve, reject) => {
    const go = (u, hops) => {
      let parsed;
      try { parsed = new URL(u); } catch (e) { return reject(Object.assign(new Error('Not a web address'), { code: 'BAD_URL' })); }
      if (parsed.protocol !== 'https:') return reject(Object.assign(new Error('Only HTTPS addresses are read'), { code: 'NOT_HTTPS' }));
      const req = https.get(u, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MOE-Motion-AI-Brand', accept, 'accept-language': 'en,ar;q=0.8' } }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          if (hops >= 5) return reject(Object.assign(new Error('Too many redirects'), { code: 'REDIRECTS' }));
          return go(new URL(res.headers.location, u).toString(), hops + 1);
        }
        const chunks = [];
        let got = 0, done = false;
        const finish = () => { if (done) return; done = true; const buf = Buffer.concat(chunks); resolve({ status: res.statusCode, url: u, headers: res.headers, contentType: String(res.headers['content-type'] || ''), truncated: got > maxBytes, body: binary ? buf.toString('base64') : buf.toString('utf8') }); };
        res.on('data', (c) => {
          if (done) return;
          got += c.length;
          if (got > maxBytes) {
            if (!truncate) { done = true; req.destroy(); return reject(Object.assign(new Error('The file is too large'), { code: 'TOO_LARGE' })); }
            chunks.push(c.slice(0, c.length - (got - maxBytes))); req.destroy(); finish(); return;
          }
          chunks.push(c);
        });
        res.on('end', finish);
      });
      req.setTimeout(timeoutMs, () => req.destroy(Object.assign(new Error('The site took too long to answer'), { code: 'ETIMEDOUT' })));
      req.on('error', (e) => reject(e));
    };
    go(url, 0);
  });
}

/**
 * Download a file over HTTPS only (redirects followed, max 5, each must stay HTTPS).
 * Streams to "<dest>.part", enforces maxBytes, renames on success.
 */
function download(url, dest, { maxBytes = 300 * 1024 * 1024, onProgress, timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const part = `${dest}.part`;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const get = (u, hops) => {
      const parsed = new URL(u);
      if (parsed.protocol !== 'https:') return reject(Object.assign(new Error('Only HTTPS downloads are allowed'), { code: 'NOT_HTTPS' }));
      const req = https.get(u, { headers: { 'user-agent': 'MOE-Motion-AI-Updater' } }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          if (hops >= 5) return reject(Object.assign(new Error('Too many redirects'), { code: 'REDIRECTS' }));
          return get(new URL(res.headers.location, u).toString(), hops + 1);
        }
        if (res.statusCode !== 200) { res.resume(); return reject(Object.assign(new Error(`HTTP ${res.statusCode}`), { code: `HTTP_${res.statusCode}` })); }
        const total = Number(res.headers['content-length']) || 0;
        if (total > maxBytes) { res.resume(); return reject(Object.assign(new Error('File is larger than announced'), { code: 'TOO_LARGE' })); }
        const out = fs.createWriteStream(part);
        let got = 0;
        res.on('data', (c) => {
          got += c.length;
          if (got > maxBytes) { req.destroy(Object.assign(new Error('File is larger than announced'), { code: 'TOO_LARGE' })); return; }
          if (onProgress) onProgress(got, total);
        });
        res.pipe(out);
        out.on('finish', () => out.close(() => { try { fs.renameSync(part, dest); resolve({ bytes: got }); } catch (e) { reject(e); } }));
        out.on('error', reject);
      });
      req.setTimeout(timeoutMs, () => req.destroy(Object.assign(new Error('Download timed out'), { code: 'ETIMEDOUT' })));
      req.on('error', (e) => { try { fs.unlinkSync(part); } catch (ignored) { /* none */ } reject(e); });
    };
    get(url, 0);
  });
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(file).on('data', (c) => h.update(c)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });
}

/** Where and how this extension is installed (install.json is written by the Windows installer). */
function extensionInfo(root) {
  if (!root) return null;
  const out = { root, linked: false, install: null };
  try { out.linked = fs.lstatSync(root).isSymbolicLink(); } catch (e) { /* unknown */ }
  try { out.install = JSON.parse(fs.readFileSync(path.join(root, 'install.json'), 'utf8')); } catch (e) { out.install = null; }
  return out;
}

const system = {
  download,
  sha256File,
  extensionInfo,
  tempPath: (name) => path.join(os.tmpdir(), 'MOE Motion AI', path.basename(name)),
  fileSize: (p) => { try { return fs.statSync(p).size; } catch (e) { return -1; } },
  removeFile: (p) => { try { fs.unlinkSync(p); } catch (e) { /* already gone */ } },
  /** Start a program detached from After Effects (it keeps running after AE quits). */
  launch: (file, args) => { const c = spawn(file, args || [], { detached: true, stdio: 'ignore', windowsHide: false }); c.unref(); }
};

function runPowerShell(script, stdinText) {
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true });
    let out = '';
    let err = '';
    ps.stdout.on('data', (d) => { out += d; });
    ps.stderr.on('data', (d) => { err += d; });
    ps.on('error', reject);
    ps.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`PowerShell exited ${code}: ${err.trim()}`))));
    ps.stdin.end(stdinText || '');
  });
}

const PS_PROTECT = "Add-Type -AssemblyName System.Security; $t=[Console]::In.ReadToEnd(); $b=[Text.Encoding]::UTF8.GetBytes($t); " +
  "[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($b,$null,'CurrentUser'))";
const PS_UNPROTECT = "Add-Type -AssemblyName System.Security; $t=[Console]::In.ReadToEnd(); $b=[Convert]::FromBase64String($t.Trim()); " +
  "[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($b,$null,'CurrentUser'))";

function createSecrets(dataDir) {
  const file = path.join(dataDir, 'secrets.dat');
  const isWin = process.platform === 'win32';
  let memo = null;

  async function read() {
    if (memo !== null) return memo;
    if (!fs.existsSync(file)) return null;
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (doc.protection === 'dpapi') memo = await runPowerShell(PS_UNPROTECT, doc.data);
    else memo = Buffer.from(doc.data, 'base64').toString('utf8');
    return memo;
  }

  return {
    async status() {
      if (!fs.existsSync(file)) return { stored: false, protection: isWin ? 'dpapi' : 'file' };
      try {
        const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
        return { stored: true, protection: doc.protection, savedAt: doc.savedAt };
      } catch (e) { return { stored: false, protection: 'corrupt' }; }
    },
    async getApiKey() { return read(); },
    async setApiKey(key) {
      let doc;
      if (isWin) doc = { protection: 'dpapi', data: await runPowerShell(PS_PROTECT, key) };
      else doc = { protection: 'file', data: Buffer.from(key, 'utf8').toString('base64') };
      doc.savedAt = new Date().toISOString();
      fs.writeFileSync(file, JSON.stringify(doc), { encoding: 'utf8', mode: 0o600 });
      memo = key;
    },
    async clear() {
      memo = null;
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  };
}

function createNodePlatform() {
  const dataDir = resolveDataDir();
  return {
    kind: 'cep-node',
    fs: createFs(dataDir),
    http: { request, get },
    system,
    secrets: createSecrets(dataDir),
    info: { platform: process.platform, node: process.version, dataDir }
  };
}

module.exports = { createNodePlatform, resolveDataDir, createFs, createSecrets };
