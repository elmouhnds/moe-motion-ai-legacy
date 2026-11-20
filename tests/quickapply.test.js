'use strict';
/* v1.0 Quick Apply + MOE Quick (docs/features/QUICK_APPLY.md). Mock results — not After Effects. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const { createTestServices } = require('./helpers/harness');
const fixture = require('../dev/preview-fixture.js');
const HK = require('../extension/core/platform/hotkeyWin');
const QL = require('../extension/app/quickLauncher');
const QS = require('../extension/app/ui/quickSearch');

const FX = Object.assign({}, fixture, {
  presetFiles: ['/mock/app/Support Files/Presets/Text/Animate In/Fade Up Words.ffx', '/mock/app/Support Files/Presets/Backgrounds/Grid.ffx', '/mock/docs/Adobe/After Effects 2026/User Presets/My Bounce.ffx', '/mock/docs/Adobe/After Effects 2026/User Presets/readme.txt'],
  menuCommands: ['Pre-compose...', 'Trim Comp to Work Area', 'Undo']
});

test('catalog: effects, presets (both roots, .ffx only) and only the menu commands After Effects knows', async () => {
  const { services } = await createTestServices(FX);
  const cat = await require('../extension/features/quickapply/catalog').createCatalog(services.host).get();
  assert.ok(cat.effects.some((e) => /Gaussian/.test(e.n)));
  assert.deepEqual(cat.presets.map((p) => p.n).sort(), ['Fade Up Words', 'Grid', 'My Bounce']);
  assert.equal(cat.presets.find((p) => p.n === 'Fade Up Words').c, 'Presets/Text/Animate In');
  assert.deepEqual(cat.commands.filter((c) => !/Audio|Reveal/.test(c)), ['Pre-compose...', 'Trim Comp to Work Area']);
  assert.ok(!cat.commands.includes('Undo') && !cat.commands.includes('Scripts'), 'only names asked for and known');
});

test('quick.applyEffect: on the selected layers, or on ONE new adjustment layer above them — one undo group each', async () => {
  const { services, env } = await createTestServices(FX);
  const before = env.undo.entries.length;
  const r = await services.executor.run('quick.applyEffect', { matchName: 'ADBE Gaussian Blur 2', effectName: 'Gaussian Blur', target: 'layers' }, { origin: 'user' });
  assert.equal(r.status, 'success', JSON.stringify(r.errors || r.reasons));
  assert.ok(r.result.added.length >= 1);
  const comp = env.project.activeItem, n = comp.numLayers;
  const r2 = await services.executor.run('quick.applyEffect', { matchName: 'ADBE Gaussian Blur 2', effectName: 'Gaussian Blur', target: 'adjustment' }, { origin: 'user' });
  assert.equal(r2.status, 'success');
  assert.equal(comp.numLayers, n + 1);
  const adj = comp._layers.find((L) => L.adjustmentLayer && /Adjustment/.test(L.name));
  assert.ok(adj, 'an adjustment layer was made');
  assert.equal(env.undo.entries.length - before, 2, 'one undo step per run');
  assert.equal(env.undo.mismatch || 0, 0);
  const bad = await services.executor.run('quick.applyEffect', { matchName: 'ADBE Nope', target: 'layers' }, { origin: 'user' });
  assert.notEqual(bad.status, 'success');
});

test('quick.applyPreset: only an .ffx inside After Effects’ own preset folders, on the current selection', async () => {
  const { services, env } = await createTestServices(FX);
  const ok = await services.executor.run('quick.applyPreset', { path: '/mock/app/Support Files/Presets/Backgrounds/Grid.ffx', presetName: 'Grid' }, { origin: 'user' });
  assert.equal(ok.status, 'success', JSON.stringify(ok.errors || ok.reasons));
  assert.equal(env.project.activeItem._appliedPresets.length, 1);
  const outside = await services.executor.run('quick.applyPreset', { path: '/tmp/evil.ffx' }, { origin: 'user' });
  assert.notEqual(outside.status, 'success');
  assert.equal(env.project.activeItem._appliedPresets.length, 1, 'nothing applied from outside the preset folders');
});

test('quick.runCommand: finds the command again by NAME; Undo / Redo are refused', async () => {
  const t = await createTestServices(FX);
  const services = t.services;
  const r = await services.executor.run('quick.runCommand', { command: 'Trim Comp to Work Area' }, { origin: 'user' });
  assert.equal(r.status, 'success');
  assert.deepEqual(t.sandbox.app._log.ranCommands, ['Trim Comp to Work Area']);
  const u = await services.executor.run('quick.runCommand', { command: 'Undo' }, { origin: 'user' });
  assert.notEqual(u.status, 'success');
});

test('rank: every word must match; names beat descriptions; MOE first among equals', () => {
  const items = [{ kind: 'ae-effect', name: 'Glow', desc: 'Effect · Stylize' }, { kind: 'tool', name: 'Glow Up', desc: 'MOE' }, { kind: 'ae-effect', name: 'Fast Box Blur', desc: 'Effect · Blur & Sharpen' }];
  assert.deepEqual(QS.rank(items, 'glow').map((x) => x.name), ['Glow', 'Glow Up']);
  assert.deepEqual(QS.rank(items, 'blur sharpen').map((x) => x.name), ['Fast Box Blur']);
  assert.deepEqual(QS.rank(items, ''), []);
});

function fakeSpawn(lines) {
  const calls = [];
  const spawn = (cmd, args) => {
    const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = () => { child.killed = true; };
    calls.push({ cmd, args, child });
    setImmediate(() => lines.forEach((l) => child.stdout.emit('data', `${l}\r\n`)));
    return child;
  };
  return { spawn, calls };
}

test('global shortcut (Windows): fixed script, RegisterHotKey with the chosen keys; opens only when After Effects is in front', async () => {
  const { spawn, calls } = fakeSpawn(['READY', 'HOTKEY AfterFX', 'HOTKEY chrome', 'HOTKEY CEPHtmlEngine']);
  let keys = 0; const states = [];
  const h = HK.start({ combo: 'ctrl+alt+space', spawn, onKey: () => keys++, onState: (s) => states.push(s), platform: 'win32' });
  await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
  assert.equal(calls[0].cmd, 'powershell.exe');
  const code = Buffer.from(calls[0].args[calls[0].args.indexOf('-EncodedCommand') + 1], 'base64').toString('utf16le');
  assert.match(code, /RegisterHotKey/);
  assert.match(code, /\[MoeHotkey\]::Run\(3, 32\)/, 'Ctrl (2) + Alt (1), VK_SPACE (0x20)');
  assert.equal(keys, 2, 'After Effects and its panels only');
  assert.equal(states[0].on, true);
  h.stop(); assert.ok(calls[0].child.killed);
  const off = fakeSpawn([]);
  HK.start({ combo: 'ctrl+alt+space', spawn: off.spawn, onKey: () => {}, platform: 'darwin' });
  HK.start({ combo: 'off', spawn: off.spawn, onKey: () => {}, platform: 'win32' });
  assert.equal(off.calls.length, 0, 'nothing is started on macOS or when Off');
});

test('MOE Quick: the script event and the shortcut open the floating window by its extension id', async () => {
  const listeners = {}; const opened = [];
  const cs = { requestOpenExtension: (id) => opened.push(id), addEventListener: (t, fn) => { listeners[t] = fn; }, dispatchEvent: () => {} };
  const { spawn } = fakeSpawn([]);
  const app = { services: { settings: { get: () => ({ ui: { pie: { globalKey: 'off' } } }) }, logger: { info() {} } } };
  QL.attach(app, cs, { spawn });
  listeners[QL.REQUEST]();
  assert.deepEqual(opened, ['tv.madtomato.moe.motionai.quick']);
  const manifest = fs.readFileSync(path.join(__dirname, '../extension/CSXS/manifest.xml'), 'utf8');
  assert.match(manifest, /<Extension Id="tv\.madtomato\.moe\.motionai\.quick">[\s\S]*?<Type>Modeless<\/Type>[\s\S]*?<Menu>MOE Quick<\/Menu>/);
  assert.match(fs.readFileSync(path.join(__dirname, '../extension/scripts/MOE Quick.jsx'), 'utf8'), /tv\.madtomato\.moe\.quick\.request/);
});
