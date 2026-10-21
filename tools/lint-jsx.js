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
  [/\.indexOf\(/, 'indexOf (Array.indexOf is not ES3; avoid for safety)'],
  [/\bDate\.now\b|\.toISOString\(|\.bind\(|\bObject\.(defineProperty|getPrototypeOf|getOwnPropertyNames)\b/, 'ES5 Date/Function/Object APIs'],
  [/\bArray\.from\b|\.includes\(|\.startsWith\(|\.endsWith\(|\.repeat\(|\.padStart\(|\.padEnd\(|\.find\(|\.findIndex\(|\.fill\(/, 'ES2015+ array/string methods'],
  [/\bNumber\.(isFinite|isInteger|isNaN|parseFloat|parseInt)\b|\bMath\.(trunc|sign|hypot|log10|log2|cbrt)\b/, 'ES2015+ Number/Math helpers'],
  [/\bnew (Map|Set|WeakMap|WeakSet|Promise|Proxy)\b|\bSymbol\b|\bReflect\./, 'ES2015+ built-ins']
];

/* ES3 keywords + future reserved words (ECMA-262 3rd ed. §7.5.2–7.5.3). ExtendScript is an ES3
   engine: these must not appear as identifiers, object-literal keys or dot-property names. */
const RESERVED = new Set(('break case catch continue default delete do else finally for function if in instanceof new return switch this throw try typeof var void while with ' +
  'abstract boolean byte char class const debugger double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile').split(' '));

function reservedUses(ast) {
  const out = [];
  (function visit(n) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'Identifier' && RESERVED.has(n.name)) out.push(`${n.name} (line ${n.loc.start.line})`);
    if (n.type === 'Property' && !n.computed && n.key.type === 'Identifier' && RESERVED.has(n.key.name)) out.push(`key "${n.key.name}" (line ${n.loc.start.line})`);
    if (n.type === 'MemberExpression' && !n.computed && RESERVED.has(n.property.name)) out.push(`.${n.property.name} (line ${n.loc.start.line})`);
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (k === 'loc') continue;
      if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v === 'object' && typeof v.type === 'string') visit(v);
    }
  }(ast));
  return [...new Set(out)];
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : d.name.endsWith('.jsx') ? [path.join(dir, d.name)] : []));
}

let failed = 0;
for (const file of walk(HOST)) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(process.cwd(), file);
  let ast;
  try {
    ast = acorn.parse(src, { ecmaVersion: 3, allowReserved: true, locations: true });
  } catch (e) {
    console.error(`✗ ${rel}: ES3 parse error: ${e.message}`);
    failed++;
    continue;
  }
  const reserved = reservedUses(ast);
  if (reserved.length) { console.error(`✗ ${rel}: ES3 reserved word(s): ${reserved.join(', ')}`); failed++; }
  // ExtendScript may read files in the system code page: keep host sources pure ASCII.
  const nonAscii = src.split('\n').map((l, i) => (/[^\x00-\x7f]/.test(l) ? i + 1 : 0)).filter(Boolean);
  if (nonAscii.length) { console.error(`✗ ${rel}: non-ASCII characters on line(s) ${nonAscii.slice(0, 8).join(', ')}`); failed++; }
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const [re, what] of FORBIDDEN) {
    if (re.test(code)) { console.error(`✗ ${rel}: uses ${what}`); failed++; }
  }
  if (!failed) console.log(`✓ ${rel}`);
}
if (failed) { console.error(`\n${failed} problem(s)`); process.exit(1); }
console.log('All host files are ES3-clean.');
