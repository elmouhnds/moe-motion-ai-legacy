'use strict';
/**
 * PREVIEW ONLY: canned Claude responses so the Copilot / Assistant UI can be
 * viewed without an API key. Never used by the real panel.
 */
function reply(data) {
  return { status: 200, headers: {}, body: JSON.stringify({ model: 'claude-opus-5-5', stop_reason: 'end_turn', usage: { input_tokens: 2100, output_tokens: 310, cache_read_input_tokens: 1800, cache_creation_input_tokens: 0 }, content: [{ type: 'text', text: JSON.stringify(data) }] }) };
}
// Brand import demo (v0.25): any address returns this small studio site; Claude's answer is canned below.
const DEMO_SITE = '<html lang="en"><head><title>Nile & Co. — Coffee roasters</title><meta property="og:site_name" content="Nile & Co."><meta name="theme-color" content="#0E7C66">'
  + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600&family=Inter&family=Tajawal"><style>:root{--brand:#0E7C66;--sand:#F4E9D8;--ink:#1F2421;--sun:#F2A541} body{font-family:Inter,sans-serif;color:#1F2421;background:#F4E9D8} h1{font-family:Fraunces,serif;color:#0E7C66} .btn{background:#F2A541}</style></head>'
  + '<body><h1>Roasted by the river</h1><h2>Single-origin coffee from Cairo</h2></body></html>';
const DEMO_BRAND = { name: 'Nile & Co.', tagline: 'Coffee roasted by the river', colors: [{ name: 'Nile Green', hex: '#0E7C66', role: 'primary', usage: 'Logo, headlines, buttons' }, { name: 'Sunset', hex: '#F2A541', role: 'accent', usage: 'Calls to action' }, { name: 'Sand', hex: '#F4E9D8', role: 'background', usage: 'Pages and packaging' }, { name: 'Ink', hex: '#1F2421', role: 'text', usage: 'Body text' }],
  gradients: [{ name: 'Dawn', stops: ['#0E7C66', '#F2A541'] }], fonts: [{ family: 'Fraunces', role: 'heading', weights: [600], source: 'google', fallback: 'Georgia' }, { family: 'Inter', role: 'body', weights: [400, 600], source: 'google', fallback: '' }, { family: 'Tajawal', role: 'arabic', weights: [400, 700], source: 'google', fallback: '' }],
  tone: { keywords: ['warm', 'crafted', 'local'], description: 'Warm, crafted and proudly local — calm confidence, never loud.' }, motion: { feel: 'Slow pours and gentle settles; nothing snaps.', easing: 'gentle', pace: 'slow' },
  rules: ['Keep the logo on Sand or Nile Green only', 'Sunset is for one call to action per frame', 'Headlines in Fraunces, body in Inter, Arabic in Tajawal'], logo: { url: '', description: 'Green wordmark with a river line' }, notes: 'Demo answer (preview).' };
module.exports = {
  get: async (url) => { await new Promise((r) => setTimeout(r, 300)); return /fonts\.googleapis/.test(url) ? { status: 200, url, contentType: 'text/css', body: '' } : { status: 200, url, contentType: 'text/html', body: DEMO_SITE }; },
  request: async (req) => {
    const body = JSON.parse(req.body);
    await new Promise((r) => setTimeout(r, 400));
    if (/brand strategist/.test(body.system[0].text)) return reply(DEMO_BRAND);
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
    if (/MOE Assistant/.test(body.system[0].text)) {
      // v0.28 assistant demo: a question gets an answer only; a change gets a short answer + the demo plan
      const u = JSON.parse(body.messages[0].content);
      const q = String(u.request || '');
      const ar = /[\u0600-\u06FF]/.test(q);
      if (/\?|؟|^how|^what|^why|ازاي|إزاي|ايه|إيه|ليه/i.test(q)) {
        return reply({ answer: ar ? 'عشان تعمل نسخة 9:16 من نفس الكومب: افتح Deliver واختار 9:16، MOE بيعمل كومب جديدة ويرتب العناصر جوه المقاس الجديد. بعدها راجع المنطقة الآمنة (Social safe area) عشان الكلام ميتغطاش بزراير التطبيق.' : 'Open Deliver and tick 9:16 — MOE builds a new comp and re-fits the layout. Then add the Social safe area so text stays clear of the app buttons. Render each version from the Render Queue as usual.', summary: '', steps: [], warnings: [], clarification: '' });
      }
      return reply({ answer: ar ? 'تمام — هخلي الكيز سريعة في البداية وهادية في الآخر، وبعدين أعمل تتابع للطبقات.' : 'Snappy keys, then a 3-frame cascade.', summary: 'Give the selected keys a snappy feel, then cascade the layers 3 frames apart.', warnings: [], clarification: '', steps: [
        { tool: 'motion.smartEase', args_json: '{"influenceIn":90,"influenceOut":15,"sides":"both","scope":"selected"}', reason: 'Snappy = quick out of each key, long ease into the next.' },
        { tool: 'motion.stagger', args_json: '{"frames":3,"order":"index","mode":"offset","seed":1}', reason: 'Sequential reveal, top to bottom.' }
      ] });
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
