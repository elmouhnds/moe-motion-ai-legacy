'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFs, createSecrets } = require('../extension/core/platform/node');
const { createStore } = require('../extension/core/storage');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'moe-'));

test('store: atomic JSON docs, jsonl logs, corrupt file recovery', () => {
  const dir = tmp();
  const store = createStore(createFs(dir));
  store.set('settings', { a: 1 });
  assert.deepEqual(createStore(createFs(dir)).get('settings', {}), { a: 1 });
  store.append('history', { n: 1 });
  store.append('history', { n: 2 });
  assert.deepEqual(store.tail('history', 1), [{ n: 2 }]);
  fs.writeFileSync(path.join(dir, 'favorites.json'), '{broken');
  assert.deepEqual(createStore(createFs(dir)).get('favorites', []), []);
  assert.ok(fs.readdirSync(dir).some((f) => f.startsWith('favorites.json.corrupt')));
});

test('secrets (non-Windows fallback): stored outside source, mode 0600, clearable', { skip: process.platform === 'win32' }, async () => {
  const dir = tmp();
  const s = createSecrets(dir);
  assert.equal((await s.status()).stored, false);
  await s.setApiKey('sk-ant-xyz-123456');
  assert.equal(await createSecrets(dir).getApiKey(), 'sk-ant-xyz-123456');
  const st = await s.status();
  assert.equal(st.protection, 'file');
  assert.equal(fs.statSync(path.join(dir, 'secrets.dat')).mode & 0o777, 0o600);
  await s.clear();
  assert.equal(await createSecrets(dir).getApiKey(), null);
});
