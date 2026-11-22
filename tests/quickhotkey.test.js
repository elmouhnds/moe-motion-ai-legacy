'use strict';
/**
 * v1.0.2 — what Settings says about the global shortcut (docs/features/QUICK_APPLY.md).
 *
 * Measured by hand in After Effects 26.5.3x9 on 2026-11-22 (docs/handoff/reports/RETEST_1.0.md): the default
 * Ctrl+Alt+Space never listened on the owner's machine and Settings said only "Not listening: stopped." Running the
 * panel's own helper outside the panel showed the real answer on the first line of its output:
 *
 *     FAIL 1409          (Win32 ERROR_HOTKEY_ALREADY_REGISTERED — another program holds that combo)
 *
 * Two faults, one in each file, and both of them hid that line from the owner:
 *   1. `hotkeyWin.start` reported the FAIL reason and then, half a second later, the PowerShell process exited and
 *      the exit handler REPLACED it with "stopped".
 *   2. `quickLauncher.attach` stored the new state on `app` without asking for a render, so the Settings line kept
 *      whatever it had been at render time — it still read "Not listening: stopped." after Ctrl+Shift+Space had been
 *      chosen and was demonstrably opening MOE Quick over the timeline.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const HK = require('../extension/core/platform/hotkeyWin');
const QL = require('../extension/app/quickLauncher');

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
const tick = () => new Promise((r) => setImmediate(r));

test('a combo another program already holds keeps saying so after the helper exits', async () => {
  const { spawn, calls } = fakeSpawn(['FAIL 1409']);
  const states = [];
  HK.start({ combo: 'ctrl+alt+space', spawn, onKey: () => {}, onState: (s) => states.push(s), platform: 'win32' });
  await tick(); await tick();
  calls[0].child.emit('exit'); // PowerShell returns right after FAIL, as the real script does
  await tick();
  const last = states[states.length - 1];
  assert.equal(last.on, false);
  assert.match(last.reason, /taken by another program/, `the last thing Settings shows is: "${last.reason}"`);
  assert.match(last.reason, /1409/, 'and it keeps the Win32 code, so the cause is findable');
  assert.ok(!states.some((s) => s.reason === 'stopped'), 'the exit never overwrites a reason the helper gave');
});

test('a helper that dies without a reason is still reported as stopped', async () => {
  const { spawn, calls } = fakeSpawn(['READY']);
  const states = [];
  HK.start({ combo: 'ctrl+alt+space', spawn, onKey: () => {}, onState: (s) => states.push(s), platform: 'win32' });
  await tick(); await tick();
  assert.equal(states[0].on, true, 'it was listening');
  calls[0].child.emit('exit');
  await tick();
  assert.deepEqual(states[states.length - 1], { on: false, reason: 'stopped' }, 'a silent death still says something');
});

test('every change of state asks for a render, so Settings never shows a stale answer', async () => {
  const { spawn, calls } = fakeSpawn(['READY']);
  let renders = 0;
  const app = {
    scheduleRender: () => { renders++; },
    services: { settings: { get: () => ({ ui: { pie: { globalKey: 'ctrl+alt+space' } } }) }, logger: { info() {} } }
  };
  const cs = { requestOpenExtension: () => {}, addEventListener: () => {}, dispatchEvent: () => {} };
  QL.attach(app, cs, { spawn });
  await tick(); await tick();
  assert.equal(app.quickKey.on, true, 'the helper answered READY');
  assert.ok(renders >= 1, 'the panel was asked to draw the new state');
  const before = renders;
  calls[0].child.emit('exit');
  await tick();
  assert.equal(app.quickKey.on, false);
  assert.ok(renders > before, 'and again when it stops');
});

test('v1.0.2 the shortcut MOE ships with is Ctrl+Shift+Space', async () => {
  // Ctrl+Alt+Space was the default and RegisterHotKey refused it on the owner's machine (FAIL 1409 — another
  // program holds it), which is a quiet way to ship a shortcut that does nothing. He picked this one by hand.
  const { spawn, calls } = fakeSpawn(['READY']);
  const app = {
    scheduleRender: () => {},
    services: { settings: { get: () => ({ ui: {} }) }, logger: { info() {} } }   // nothing saved: the default
  };
  QL.attach(app, { requestOpenExtension: () => {}, addEventListener: () => {}, dispatchEvent: () => {} }, { spawn });
  await tick(); await tick();
  assert.equal(app.quickKey.label, 'Ctrl+Shift+Space');
  const sent = Buffer.from(calls[0].args[calls[0].args.length - 1], 'base64').toString('utf16le');
  const c = HK.COMBOS['ctrl+shift+space'];
  assert.ok(sent.includes(`Run(${c.mods}, ${c.vk})`), 'and that is the combo the script registers');
});
