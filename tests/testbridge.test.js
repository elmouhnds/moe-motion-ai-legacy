'use strict';
/**
 * v0.99 Claude Test Bridge (docs/features/CLAUDE_TEST_BRIDGE.md): the panel's local bridge + the MCP server Claude Code
 * runs, end to end — a real HTTP server on 127.0.0.1, the real MCP process over stdio — with the mock After Effects
 * behind it. Proves the plumbing and the guards; After Effects itself is what the owner's machine adds.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { createTestServices } = require('./helpers/harness');
const { createTestBridge } = require('../extension/core/testbridge');

async function bridge() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moe-bridge-'));
  const { services } = await createTestServices([]);
  let reloaded = 0;
  const b = createTestBridge({ services, http, fs, path, crypto, dataDir: dir, onReload: () => { reloaded++; } });
  await b.start();
  return { b, dir, services, reloaded: () => reloaded, info: JSON.parse(fs.readFileSync(path.join(dir, 'testbridge.json'), 'utf8')) };
}
function post(port, cmd, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body || {}));
    const req = http.request({ host: '127.0.0.1', port, path: `/v1/${cmd}`, method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': data.length }, headers) }, (res) => {
      const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => resolve({ code: res.statusCode, body: JSON.parse(Buffer.concat(c).toString() || '{}') }));
    });
    req.on('error', reject); req.end(data);
  });
}

test('the bridge answers only with its key, only known commands, never a browser', async () => {
  const { b, info } = await bridge();
  try {
    assert.equal((await post(info.port, 'status', {})).code, 401);
    assert.equal((await post(info.port, 'status', {}, { Authorization: 'Bearer wrong' })).code, 401);
    const auth = { Authorization: `Bearer ${info.token}` };
    assert.equal((await post(info.port, 'eval', {}, auth)).code, 404);
    assert.equal((await post(info.port, 'status', {}, Object.assign({ Origin: 'https://evil.example' }, auth))).code, 403);
    const s = await post(info.port, 'status', {}, auth);
    assert.equal(s.code, 200);
    assert.ok(s.body.moe);
    assert.equal((await post(info.port, 'try', { tool: 'no.such.tool' }, auth)).code, 400);
  } finally { await b.stop(); }
  assert.equal(b.on, false);
});

test('MCP server ↔ bridge ↔ mock After Effects: list tools, try a Cloner tile, test a section', async () => {
  const { b, dir, info } = await bridge();
  const mcp = spawn(process.execPath, [path.join(__dirname, '..', 'tools', 'moe-mcp.js')], { env: Object.assign({}, process.env, { MOE_DATA_DIR: dir }) });
  const pending = new Map(); let buf = ''; let next = 1;
  mcp.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } } });
  const rpc = (method, params) => new Promise((resolve) => { const id = next++; pending.set(id, resolve); mcp.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`); });
  try {
    const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
    assert.equal(init.result.serverInfo.name, 'moe-after-effects');
    const list = await rpc('tools/list', {});
    assert.ok(list.result.tools.some((t) => t.name === 'moe_try_tool'));
    const st = await rpc('tools/call', { name: 'moe_status', arguments: {} });
    assert.ok(!st.result.isError, JSON.stringify(st.result));
    const tr = await rpc('tools/call', { name: 'moe_try_tool', arguments: { tool: 'grid.build', args: { mode: 'sphere' }, subject: 'cards' } });
    assert.ok(!tr.result.isError, JSON.stringify(tr.result));
    assert.match(tr.result.content[0].text, /PASS .*grid\.build/);
    const tt = await rpc('tools/call', { name: 'moe_test_tiles', arguments: { ids: ['globe', 'efPush', 'easeSmooth'] } });
    assert.match(tt.result.content[0].text, /3 pass · 0 fail/);
    const bad = await rpc('tools/call', { name: 'moe_try_tool', arguments: { tool: 'nope' } });
    assert.equal(bad.result.isError, true);
  } finally { mcp.kill(); await b.stop(); }
  // with the bridge off, the MCP server says how to turn it on
  const mcp2 = spawn(process.execPath, [path.join(__dirname, '..', 'tools', 'moe-mcp.js')], { env: Object.assign({}, process.env, { MOE_DATA_DIR: dir }) });
  const out = await new Promise((resolve) => { let s = ''; mcp2.stdout.on('data', (d) => { s += d; if (s.includes('\n')) resolve(JSON.parse(s.split('\n')[0])); }); mcp2.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'moe_status', arguments: {} } })}\n`); });
  mcp2.kill();
  assert.equal(out.result.isError, true);
  assert.match(out.result.content[0].text, /Allow Claude to test/);
});

test('reload: the bridge turns back on only after a reload it was asked for', async () => {
  const { b, info, services, reloaded } = await bridge();
  try {
    const r = await post(info.port, 'reload', {}, { Authorization: `Bearer ${info.token}` });
    assert.equal(r.body.reloading, true);
    await new Promise((res) => setTimeout(res, 250));
    assert.equal(reloaded(), 1);
    const resume = services.store.get('bridge-resume', null);
    assert.ok(resume && resume.until > Date.now() && resume.until < Date.now() + 130000);
  } finally { await b.stop(); }
});
