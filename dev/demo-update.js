'use strict';
/** Preview only: a fake update feed (9.0.0) + fake download/launch, so Settings › Updates can be clicked through. */
const FEED = {
  format: 'moe-update', version: 1, product: 'tv.madtomato.moe.motionai',
  release: { version: '9.0.0', published: '2026-11-02T10:00:00Z', minAE: '25.0', notes: '## [9.0.0] — Preview feed\n### Added\n- Icon morphs\n- Lower thirds from shapes + text\n- Pattern backgrounds' },
  installer: { url: 'MOE-Motion-AI-Setup-9.0.0.exe', sha256: 'a'.repeat(64), size: 720000 }
};
const http = { request: async ({ url }) => (/latest\.json$/.test(url) ? { status: 200, headers: {}, body: JSON.stringify(FEED) } : { status: 404, headers: {}, body: '' }) };
const system = {
  extensionInfo: (root) => ({ root: 'C:\\Users\\you\\AppData\\Roaming\\Adobe\\CEP\\extensions\\tv.madtomato.moe.motionai', linked: false, install: { installer: 'nsis', version: '0.6.1' } }),
  tempPath: (n) => `C:\\Temp\\MOE Motion AI\\${n}`,
  download: (url, dest, { onProgress }) => new Promise((res) => { let b = 0; const t = setInterval(() => { b += 120000; onProgress && onProgress(Math.min(b, 720000), 720000); if (b >= 720000) { clearInterval(t); res({ bytes: 720000 }); } }, 120); }),
  fileSize: () => 720000,
  sha256File: async () => 'a'.repeat(64),
  removeFile: () => {},
  launch: () => {}
};
module.exports = { http, system, FEED };
