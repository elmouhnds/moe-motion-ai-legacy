'use strict';
/**
 * PREVIEW ONLY: canned Claude responses so the Copilot / Assistant UI can be
 * viewed without an API key. Never used by the real panel.
 */
function reply(data) {
  return { status: 200, headers: {}, body: JSON.stringify({ model: 'claude-opus-5-5', stop_reason: 'end_turn', usage: { input_tokens: 2100, output_tokens: 310, cache_read_input_tokens: 1800, cache_creation_input_tokens: 0 }, content: [{ type: 'text', text: JSON.stringify(data) }] }) };
}
module.exports = {
  request: async (req) => {
    const body = JSON.parse(req.body);
    await new Promise((r) => setTimeout(r, 400));
    if (/Expression Engineer/.test(body.system[0].text)) {
      return reply({ code: '// Scale overshoot after the last keyframe\nvar amp = 0.05, freq = 3, decay = 7;\nvar n = numKeys ? nearestKey(time).index : 0;\nif (n && key(n).time > time) n--;\nif (n > 0) {\n  var t = time - key(n).time;\n  var v = velocityAtTime(key(n).time - thisComp.frameDuration / 10);\n  value + v * amp * Math.sin(freq * t * 2 * Math.PI) / Math.exp(decay * t);\n} else value;', explanation: 'Adds a decaying overshoot after each keyframe, driven by the incoming velocity, so faster moves bounce more.', notes: ['Works on Scale and Position.', 'Tweak decay for a quicker settle.'], controls: [] });
    }
    if (/colourist/.test(body.system[0].text)) {
      return reply({ settings: { exposure: -0.2, contrast: 25, saturation: 70, temperature: -35, tint: -5, autoBalance: 60, autoLevels: 30 }, explanation: 'Neutralises the warm cast first, then pulls the shot cold and desaturated with firmer contrast for a tense, clinical feel.', limitations: 'Teal-only shadows need split toning, which a single grade cannot do.' });
    }
    if (/layout designer/.test(body.system[0].text)) {
      return reply({ layout: [], explanation: 'Logo stays top-left, headline above the product, CTA bottom-right.' });
    }
    if (/chroma-key green/.test(body.system[0].text) || /green background/.test(body.system[0].text)) {
      return reply({ title: 'Gold coin', prompt: 'Photoreal spinning gold coin, studio light', negative: 'text', keying: { spillRisk: 'high', choke: 1, advice: 'Gold reflects green — keep spill suppression on.' } });
    }
    if (/Tool Factory/.test(body.system[0].text)) {
      return reply({ name: 'Soft cascade', description: 'Stagger the selected layers by N frames, then give their keys a smooth ease.', limitations: '', params: [{ key: 'step', type: 'integer', label: 'Frames apart', default_json: '3', min: 1, max: 30, options: [] }], steps: [{ tool: 'motion.stagger', args_json: '{"frames":{"$param":"step"},"order":"index","mode":"offset","seed":1}', note: 'Cascade top to bottom' }, { tool: 'motion.smartEase', args_json: '{"influenceIn":70,"influenceOut":70,"sides":"both","scope":"all"}', note: 'Smooth every key' }] });
    }
    return reply({ summary: 'Give the selected keys a snappy feel — fast departure, long settle — then cascade the four layers 3 frames apart.', warnings: ['“BG” is locked and will be left alone.'], clarification: '', steps: [
      { tool: 'motion.smartEase', args_json: '{"influenceIn":90,"influenceOut":15,"sides":"both","scope":"selected"}', reason: 'Snappy = quick out of each key, long ease into the next.' },
      { tool: 'motion.stagger', args_json: '{"frames":3,"order":"index","mode":"offset","seed":1}', reason: 'Sequential reveal, top to bottom.' }
    ] });
  }
};
