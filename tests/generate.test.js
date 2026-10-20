'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestServices } = require('./helpers/harness');
const { studioComp } = require('./fixtures/studio');
const G = require('../extension/features/generate/green');

test('Green prompt rules are enforced even when the AI text forgets them or asks for another background', () => {
  const e = G.enforce({ prompt: 'A golden coin spinning, on a white background, studio light', negative: 'blurry', kind: 'video' });
  assert.ok(e.enforcedAdded);
  assert.ok(e.prompt.includes('#00B140'));
  assert.ok(!/white background/i.test(e.prompt));
  assert.match(e.prompt, /Locked-off camera/);
  assert.ok(e.negative.startsWith('blurry'));
  assert.match(e.negative, /green clothing/);
});

test('Green prompt via Claude (mocked HTTP): enforced and returned with keying advice', async () => {
  const reply = { title: 'Gold coin', prompt: 'Photoreal gold coin, chroma green #00B140 background', negative: 'text', keying: { spillRisk: 'high', choke: 1, advice: 'Gold reflects green; use spill suppression.' } };
  const { services } = await createTestServices(studioComp([]), {
    http: { request: async () => ({ status: 200, headers: {}, body: JSON.stringify({ model: 'claude-opus-5-5', stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: 'text', text: JSON.stringify(reply) }] }) }) },
    apiKey: 'sk-ant-test'
  });
  services.settings.update && services.settings.update({ ai: { enabled: true } });
  const r = await services.executor.run('generate.greenPrompt', { description: 'gold coin spinning', kind: '3d' });
  assert.equal(r.status, 'success', JSON.stringify(r.errors || r.verification));
  assert.match(r.result.prompt, /GREEN SCREEN REQUIREMENTS/);
  assert.match(r.result.prompt, /satin materials/);
});

test('Import & Key: generated file imported at the playhead, fitted and keyed (Keylight chain); restore removes it', async () => {
  const { services, comp, sandbox, platform } = await createTestServices(studioComp([], { comp: { time: 2 } }));
  platform.files.set('/gen/coin_green.png', 'PNG');
  const r = await services.executor.run('generate.importKey', { path: '/gen/coin_green.png', name: 'Coin', choke: 1 });
  assert.equal(r.status, 'success', JSON.stringify(r.errors || r.verification, null, 1));
  const L = comp._layers.find((l) => l.name === 'Coin');
  assert.equal(L.startTime, 2);
  assert.deepEqual(L._parade._children.map((f) => f.name), ['MOE Key', 'MOE Key Cleaner', 'MOE Spill', 'MOE Choke']);
  assert.ok((await services.executor.restore(r.checkpointId)).ok);
  assert.equal(comp._layers.length, 0);
  assert.ok(!sandbox.app.project._items.some((i) => i.name === 'coin_green.png'));
});
