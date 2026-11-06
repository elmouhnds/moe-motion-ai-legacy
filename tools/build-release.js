'use strict';
/**
 * Release build:  npm run release            (add --skip-check to skip npm run check)
 *
 *   dist/stage/extension/                       clean copy of extension/ (no .debug remote-debug file)
 *   dist/MOE-Motion-AI-Setup-<v>.exe            Windows installer (NSIS) — installs / updates in place
 *   dist/MOE-Motion-AI-<v>-portable.zip         same files for manual install (advanced)
 *   dist/latest.json                            update feed read by Settings › Updates
 *
 * Publish the .exe and latest.json side by side on any HTTPS host (e.g. a GitHub Release or a
 * company server) and put the latest.json URL in Settings › Updates. The installer URL in the
 * feed is relative unless MOE_UPDATE_BASE_URL is set.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const EXT = path.join(ROOT, 'extension');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function versions() {
  const pkg = JSON.parse(read('package.json')).version;
  const found = {
    'package.json': pkg,
    'CSXS/manifest.xml (bundle)': (read('extension/CSXS/manifest.xml').match(/ExtensionBundleVersion="([^"]+)"/) || [])[1],
    'CSXS/manifest.xml (extension)': (read('extension/CSXS/manifest.xml').match(/<Extension Id="[^"]+" Version="([^"]+)"/) || [])[1],
    'CSXS/manifest.xml (Motion Kit panel)': (read('extension/CSXS/manifest.xml').match(/<Extension Id="[^"]+\.kit" Version="([^"]+)"/) || [])[1],
    'host/index.jsx': (read('extension/host/index.jsx').match(/MOE\.version = '([^']+)'/) || [])[1],
    'core/services.js': (read('extension/core/services.js').match(/const VERSION = '([^']+)'/) || [])[1]
  };
  const bad = Object.entries(found).filter(([, v]) => v !== pkg);
  if (bad.length) throw new Error(`Version mismatch (package.json = ${pkg}): ${bad.map(([k, v]) => `${k} = ${v}`).join(', ')}`);
  if (!/^\d+\.\d+\.\d+$/.test(pkg)) throw new Error(`Version must be x.y.z, got ${pkg}`);
  return pkg;
}

/** Release notes = the CHANGELOG section of this version (plain text, trimmed). */
function notes(version) {
  const log = read('CHANGELOG.md');
  const start = log.indexOf(`## [${version}]`);
  if (start < 0) return '';
  const next = log.indexOf('\n## [', start + 5);
  return log.slice(start, next < 0 ? undefined : next).replace(/\*\*/g, '').replace(/`/g, '').trim().slice(0, 4000);
}

function copyDir(src, dst, skip) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d, skip); else fs.copyFileSync(s, d);
  }
}

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function main() {
  const version = versions();
  if (!process.argv.includes('--skip-check')) execFileSync('npm', ['run', 'check', '--silent'], { cwd: ROOT, stdio: 'inherit' });
  fs.rmSync(DIST, { recursive: true, force: true });
  const stage = path.join(DIST, 'stage', 'extension');
  // .debug opens a remote-debugging port — development only.
  copyDir(EXT, stage, (name) => name === '.debug' || name === '.DS_Store' || name === 'install.json');

  const setupName = `MOE-Motion-AI-Setup-${version}.exe`;
  const setup = path.join(DIST, setupName);
  execFileSync('makensis', ['-V2', `-DVERSION=${version}`, `-DSRC=${stage}`, `-DOUTFILE=${setup}`,
    `-DICON=${path.join(ROOT, 'installer/assets/moe.ico')}`, `-DSIDEBAR=${path.join(ROOT, 'installer/assets/sidebar.bmp')}`,
    `-DHEADER=${path.join(ROOT, 'installer/assets/header.bmp')}`,
    path.join(ROOT, 'installer/moe-motion-ai.nsi')], { stdio: 'inherit' });

  const zipName = `MOE-Motion-AI-${version}-portable.zip`;
  fs.writeFileSync(path.join(DIST, 'stage', 'INSTALL.txt'), [
    `MOE Motion AI ${version} — manual install (advanced; the Setup .exe does all of this for you)`, '',
    '1. Close After Effects.',
    '2. Delete any older MOE Motion AI folder in %APPDATA%\\Adobe\\CEP\\extensions\\.',
    '3. Copy the "extension" folder there and rename it to: tv.madtomato.moe.motionai',
    '4. Allow unsigned panels once: reg add HKCU\\Software\\Adobe\\CSXS.12 /v PlayerDebugMode /t REG_SZ /d 1 /f',
    '5. Open After Effects › Window › Extensions › MOE Motion AI.', ''
  ].join('\r\n'));
  execFileSync('zip', ['-qr', path.join(DIST, zipName), 'extension', 'INSTALL.txt'], { cwd: path.join(DIST, 'stage') });

  const base = (process.env.MOE_UPDATE_BASE_URL || '').replace(/\/+$/, '');
  const feed = {
    format: 'moe-update', version: 1,
    product: 'tv.madtomato.moe.motionai',
    release: { version, published: new Date().toISOString(), notes: notes(version), minAE: '25.0' },
    installer: { url: base ? `${base}/${setupName}` : setupName, sha256: sha256(setup), size: fs.statSync(setup).size }
  };
  fs.writeFileSync(path.join(DIST, 'latest.json'), JSON.stringify(feed, null, 2));

  console.log(`\nMOE Motion AI ${version}`);
  for (const f of [setupName, zipName, 'latest.json']) console.log(`  dist/${f}  ${(fs.statSync(path.join(DIST, f)).size / 1024).toFixed(0)} KB`);
  console.log(`  installer sha256 ${feed.installer.sha256}`);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
}
module.exports = { versions, notes };
