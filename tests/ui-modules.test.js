'use strict';
/** Every panel UI module must at least parse and load (catches syntax/scope errors before the preview). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const UI = path.resolve(__dirname, '../extension/app');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } })(UI);

for (const f of files) {
  test(`UI module loads: ${path.relative(UI, f)}`, () => {
    assert.doesNotThrow(() => new Function('module', 'exports', 'require', fs.readFileSync(f, 'utf8')));
    assert.doesNotThrow(() => require(f));
  });
}
