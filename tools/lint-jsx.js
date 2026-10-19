'use strict';
/**
 * ExtendScript is ES3. Parse every host .jsx file as ECMAScript 3 and reject
 * ES5+ runtime APIs that ExtendScript does not provide.
 */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const HOST = path.resolve(__dirname, '../extension/host');
const FORBIDDEN = [
  [/\bJSON\.(parse|stringify)\b/, 'native JSON (use MOE.json)'],
  [/\.forEach\(|\.map\(|\.filter\(|\.reduce\(|\.some\(|\.every\(/, 'ES5 array iteration methods'],
  [/\bObject\.(keys|assign|create|freeze|entries|values)\b/, 'ES5+ Object helpers'],
  [/\.trim\(\)/, 'String.prototype.trim'],
  [/\bArray\.isArray\b/, 'Array.isArray'],
  [/\.indexOf\(/, 'indexOf (Array.indexOf is not ES3; avoid for safety)']
];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : d.name.endsWith('.jsx') ? [path.join(dir, d.name)] : []));
}

let failed = 0;
for (const file of walk(HOST)) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(process.cwd(), file);
  try {
    acorn.parse(src, { ecmaVersion: 3, allowReserved: true });
  } catch (e) {
    console.error(`✗ ${rel}: ES3 parse error: ${e.message}`);
    failed++;
    continue;
  }
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const [re, what] of FORBIDDEN) {
    if (re.test(code)) { console.error(`✗ ${rel}: uses ${what}`); failed++; }
  }
  if (!failed) console.log(`✓ ${rel}`);
}
if (failed) { console.error(`\n${failed} problem(s)`); process.exit(1); }
console.log('All host files are ES3-clean.');
