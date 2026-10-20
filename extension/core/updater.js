'use strict';
/**
 * In-panel updates.
 *
 * Feed (dist/latest.json, produced by tools/build-release.js, hosted anywhere over HTTPS):
 *   { format: 'moe-update', version: 1, product: 'tv.madtomato.moe.motionai',
 *     release: { version, published, notes, minAE },
 *     installer: { url (absolute or relative to the feed), sha256, size } }
 *
 * Flow: check → download the installer to the temp folder → verify size + SHA-256 →
 * launch it with /WAITAE (it waits until After Effects closes, then replaces the installed
 * copy in place) or without (normal installer window, asks to close AE).
 * Nothing runs without the user's click; a file that fails verification is deleted.
 * The feed is untrusted input: every field is validated here.
 */

const PRODUCT = 'tv.madtomato.moe.motionai';
const MAX_SIZE = 300 * 1024 * 1024;

function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v || ''));
  return m ? m.slice(1).map(Number) : null;
}
/** -1 / 0 / 1; invalid versions sort lowest. */
function compare(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return x ? 1 : y ? -1 : 0;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}

function resolveUrl(url, feedUrl) {
  try { return new URL(url, feedUrl).toString(); } catch (e) { return null; }
}

/** Validate a feed document. Returns { ok, error?, update? }. */
function parseFeed(text, { feedUrl, current, allowHttp = false }) {
  let doc;
  try { doc = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { return { ok: false, error: 'The update feed is not valid JSON' }; }
  if (!doc || doc.format !== 'moe-update') return { ok: false, error: 'Not a MOE update feed (format "moe-update")' };
  if (doc.product !== PRODUCT) return { ok: false, error: `This feed is for another product (${String(doc.product).slice(0, 60)})` };
  const r = doc.release || {}, ins = doc.installer || {};
  if (!parseVersion(r.version)) return { ok: false, error: 'The feed has no valid version' };
  if (!/^[a-f0-9]{64}$/i.test(ins.sha256 || '')) return { ok: false, error: 'The feed has no valid SHA-256 for the installer' };
  if (!(Number.isInteger(ins.size) && ins.size > 0 && ins.size <= MAX_SIZE)) return { ok: false, error: 'The feed has no valid installer size' };
  const url = resolveUrl(ins.url, feedUrl);
  if (!url) return { ok: false, error: 'The installer URL is not valid' };
  const proto = new URL(url).protocol;
  if (!(proto === 'https:' || (allowHttp && proto === 'http:'))) return { ok: false, error: 'Updates are only downloaded over HTTPS' };
  if (!/\.exe$/i.test(new URL(url).pathname)) return { ok: false, error: 'The installer must be a .exe' };
  const update = {
    version: r.version, published: typeof r.published === 'string' ? r.published.slice(0, 40) : '',
    notes: typeof r.notes === 'string' ? r.notes.slice(0, 4000) : '', minAE: typeof r.minAE === 'string' ? r.minAE.slice(0, 10) : '',
    url, sha256: ins.sha256.toLowerCase(), size: ins.size
  };
  return { ok: true, update, newer: compare(update.version, current) > 0 };
}

/** How this copy was installed: 'installer' | 'dev-link' | 'manual' | 'unknown'. */
function installKind(info) {
  if (!info) return 'unknown';
  if (info.linked) return 'dev-link';
  if (info.install && info.install.installer === 'nsis') return 'installer';
  return 'manual';
}

function createUpdater({ http, system, getSettings, current, logger, root }) {
  const log = (msg, data) => { if (logger) logger.info('update', msg, data); };
  return {
    current,
    installInfo() {
      const info = system && system.extensionInfo ? system.extensionInfo(root) : null;
      return Object.assign({ kind: installKind(info) }, info || {});
    },
    /** Read and validate the feed. */
    async check(feedUrl = getSettings().updates.feedUrl) {
      if (!feedUrl) return { ok: false, error: 'No update feed set' };
      let u;
      try { u = new URL(feedUrl); } catch (e) { return { ok: false, error: 'The feed URL is not valid' }; }
      if (u.protocol !== 'https:') return { ok: false, error: 'The feed URL must start with https://' };
      let res;
      try { res = await http.request({ method: 'GET', url: feedUrl, headers: { accept: 'application/json' }, timeoutMs: 20000 }); } catch (e) {
        return { ok: false, error: `Cannot reach the update feed (${e.code || e.message})` };
      }
      if (res.status !== 200) return { ok: false, error: `The update feed answered ${res.status}` };
      const r = parseFeed(res.body, { feedUrl, current });
      log('checked', { ok: r.ok, latest: r.update && r.update.version, newer: r.newer });
      return r;
    },
    /** Download + verify. Returns { ok, file?, error? }; a bad file is deleted. */
    async download(update, onProgress) {
      if (!system || !system.download) return { ok: false, error: 'Downloads are not available here' };
      const file = system.tempPath(`MOE-Motion-AI-Setup-${update.version}.exe`);
      try {
        await system.download(update.url, file, { maxBytes: update.size + 1024, onProgress });
      } catch (e) {
        system.removeFile(file);
        return { ok: false, error: `Download failed (${e.code || e.message})` };
      }
      const size = system.fileSize(file);
      const sha = await system.sha256File(file);
      if (size !== update.size || sha !== update.sha256) {
        system.removeFile(file);
        log('verification failed', { size, expected: update.size });
        return { ok: false, error: 'The download does not match the feed (size or SHA-256) — it was deleted' };
      }
      log('downloaded', { version: update.version, size });
      return { ok: true, file, sha256: sha };
    },
    /** Start the installer. when: 'on-close' (wait for After Effects to quit) | 'now'. */
    launch(file, when = 'on-close') {
      if (!system || !system.launch) return { ok: false, error: 'Cannot start programs here' };
      if (!/\.exe$/i.test(file)) return { ok: false, error: 'Choose the MOE Motion AI Setup .exe' };
      system.launch(file, when === 'on-close' ? ['/WAITAE'] : []);
      log('installer started', { when });
      return { ok: true };
    }
  };
}

module.exports = { createUpdater, parseFeed, compare, installKind, PRODUCT, MAX_SIZE };
