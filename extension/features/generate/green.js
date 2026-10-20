'use strict';
/**
 * Generate on Green — produce elements for compositing on a guaranteed chroma-green
 * background, then key them inside After Effects.
 *
 *   generate.greenPrompt  Claude writes a production prompt for an image / video / 3D
 *                         generator. The green-screen rules are ENFORCED locally after
 *                         the AI answers (a request can never lose its green background).
 *   generate.importKey    import the generated file, fit it to the comp and run the MOE
 *                         Screen Key chain (Keylight → Key Cleaner → Spill → Choke).
 *
 * Claude's API does not generate images or video. The generation itself happens in the
 * provider you choose (see PROVIDERS); MOE keeps the prompt rules and the keying.
 */

const SCREEN = { hex: '#00B140', rgb: [0, 177, 64], name: 'chroma-key green' };

const RULES = [
  `Background: a perfectly flat, evenly lit, pure ${SCREEN.name} ${SCREEN.hex} (RGB ${SCREEN.rgb.join(', ')}) seamless backdrop filling the entire frame — no gradient, no vignette, no texture, no horizon, no floor line, no scenery.`,
  'Subject fully inside the frame with clear margin on every side; nothing touches the frame edges.',
  'No green, teal, cyan or lime anywhere on the subject (clothing, props, light, reflections, particles).',
  'Soft neutral key light plus a rim/back light that separates the subject from the background; no cast shadows or contact shadows on the backdrop; no green light bouncing onto the subject.',
  'Sharp, well-defined edges; avoid motion blur and depth-of-field blur on the subject; hair and fine detail crisp.',
  'No text, logos, watermarks, borders or frames.'
];
const VIDEO_RULES = ['Locked-off camera: no camera shake, no zoom, no pan; constant lighting and exposure over time; steady frame rate; subject stays inside the frame for the whole clip.'];
const THREE_D_RULES = ['Render as a studio product/character render on the green backdrop; matte or satin materials preferred (glossy/chrome surfaces reflect green — keep reflections neutral); 50 mm lens look.'];
const NEGATIVE = ['background scenery', 'gradient background', 'vignette', 'shadow on background', 'floor', 'horizon', 'green clothing', 'green props', 'green light on subject', 'motion blur', 'depth of field', 'text', 'watermark', 'logo', 'frame border', 'cropped subject'];

/** Guarantee the green-screen rules whatever the AI wrote. Pure. */
function enforce({ prompt, negative, kind }) {
  let p = String(prompt || '').trim();
  // Remove background descriptions that contradict the screen.
  p = p.replace(/\b(on|in|against|with)\s+(a|an|the)?\s*(white|black|grey|gray|blue|transparent|studio|neutral|plain|colorful|colourful|dark|light|gradient)\s+(background|backdrop)\b/gi, '').replace(/\s{2,}/g, ' ').trim();
  const rules = [...RULES, ...(kind === 'video' ? VIDEO_RULES : []), ...(kind === '3d' ? THREE_D_RULES : [])];
  const missing = !p.includes(SCREEN.hex) || !/green/i.test(p);
  const final = `${p}${p.endsWith('.') ? '' : '.'}\n\nGREEN SCREEN REQUIREMENTS (mandatory):\n- ${rules.join('\n- ')}`;
  const neg = [...new Set([...(String(negative || '').split(/\s*,\s*/).filter(Boolean)), ...NEGATIVE])].join(', ');
  return { prompt: final, negative: neg, enforcedAdded: missing };
}

const PROVIDERS = [
  { id: 'manual', label: 'Any generator (copy prompt)', note: 'Paste the prompt in your image / video / 3D tool, export PNG / MOV / MP4, then Import & Key.' }
];

const SYSTEM = [
  'You write prompts for image, video and 3D generators inside MOE Motion AI (After Effects). Every element you describe will be composited, so it MUST be generated on a flat chroma-key green background (#00B140).',
  'Write one rich, concrete prompt: subject, materials, pose/action, lighting, lens, style, resolution hints. Do not describe any other background or environment.',
  'Also give a negative prompt, and keying advice for the compositor (spill risk, fine hair/transparency, motion).'
].join('\n');

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['prompt', 'negative', 'title', 'keying'],
  properties: {
    title: { type: 'string', description: 'Short name for the element (used as layer name).' },
    prompt: { type: 'string' },
    negative: { type: 'string' },
    keying: {
      type: 'object', additionalProperties: false, required: ['spillRisk', 'choke', 'advice'],
      properties: { spillRisk: { type: 'string', enum: ['low', 'medium', 'high'] }, choke: { type: 'number', description: 'Suggested Simple Choker px, -2..3' }, advice: { type: 'string' } }
    }
  }
};

const greenPrompt = {
  id: 'generate.greenPrompt',
  version: '1.0.0',
  category: 'compositing',
  group: 'Generate on Green',
  name: 'Green-Screen Prompt',
  description: 'Describe an element (object, character, 3D render, effect…). Claude writes a production prompt for your generator — always on a flat chroma-green background (enforced), with a negative prompt and keying advice.',
  keywords: ['generate', 'green screen', 'chroma', 'prompt', 'ai', 'image', 'video', '3d', 'element', 'asset'],
  icon: 'spark',
  params: {
    description: { type: 'text', label: 'Element', required: true, maxLength: 1500, description: 'e.g. “a gold 3D coin spinning”, “woman waving, waist-up”, “smoke burst”' },
    kind: { type: 'enum', label: 'For', default: 'image', options: [{ value: 'image', label: 'Image' }, { value: 'video', label: 'Video' }, { value: '3d', label: '3D render' }] },
    size: { type: 'enum', label: 'Frame', default: 'comp', options: [{ value: 'comp', label: 'Comp size' }, { value: 'square', label: 'Square' }, { value: 'vertical', label: '9:16' }] }
  },
  requires: {},
  permissions: ['network.ai'],
  recovery: 'none',
  ai: null,
  uses: { hostOps: [], network: true },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Write Prompt' },
  prepare(args) { return { ok: true, preview: { summary: `Green-screen ${args.kind} prompt for “${String(args.description).slice(0, 60)}”`, items: [] } }; },
  async execute({ args, ctx, services }) {
    const size = args.size === 'square' ? '1:1' : args.size === 'vertical' ? '9:16' : ctx && ctx.comp ? `${ctx.comp.width}×${ctx.comp.height}` : '16:9';
    const res = await services.ai.createJSON({ purpose: 'generate.green', system: SYSTEM, schema: SCHEMA, user: JSON.stringify({ element: args.description, kind: args.kind, frame: size }) });
    const e = enforce({ prompt: res.data.prompt, negative: res.data.negative, kind: args.kind });
    return { title: res.data.title, prompt: e.prompt, negative: e.negative, enforcedAdded: e.enforcedAdded, keying: res.data.keying, kind: args.kind, frame: size, providers: PROVIDERS };
  },
  verify({ result }) {
    const ok = result.prompt.includes(SCREEN.hex);
    return { ok, checks: [{ ok, label: 'Green screen', detail: `${SCREEN.hex} rules enforced${result.enforcedAdded ? ' (added — the AI text did not state them)' : ''}` }, { ok: true, label: 'Keying', detail: `spill ${result.keying.spillRisk} · choke ${result.keying.choke}px` }] };
  },
  summarize(result) { return `Prompt ready: ${result.title}`; }
};

const importKey = {
  id: 'generate.importKey',
  version: '1.0.0',
  category: 'compositing',
  group: 'Generate on Green',
  name: 'Import & Key',
  description: 'Import a generated green-screen image or clip into the active comp at the playhead, fit it, and key it with the MOE Screen Key chain.',
  keywords: ['import', 'key', 'green screen', 'generated', 'element', 'chroma'],
  icon: 'key',
  params: {
    path: { type: 'string', label: 'File', required: true, maxLength: 1000, description: 'PNG / JPG / EXR / TIFF / MOV / MP4' },
    name: { type: 'string', label: 'Layer name', default: '', maxLength: 120 },
    fit: { type: 'enum', label: 'Fit', default: 'fit', options: [{ value: 'fit', label: 'Fit' }, { value: 'fill', label: 'Fill' }, { value: 'none', label: '100%' }] },
    choke: { type: 'number', label: 'Choke', min: -10, max: 10, step: 0.1, default: 0.5, unit: 'px' }
  },
  requires: { comp: true },
  permissions: ['modify.layers', 'modify.effects'],
  recovery: 'undo+checkpoint',
  ai: null,
  uses: { hostOps: ['footage.importToComp', 'layers.setSelection', 'footage.remove'], network: false },
  compatibility: { minAE: '25.0' },
  ui: { primaryLabel: 'Import & Key' },
  prepare(args) {
    if (!/\.(png|jpe?g|exr|tiff?|mov|mp4|webm)$/i.test(args.path || '')) return { ok: false, error: 'Choose a PNG, JPG, EXR, TIFF, MOV or MP4 file' };
    return { ok: true, preview: { summary: `Import ${String(args.path).split(/[\\/]/).pop()} and key it`, items: [] } };
  },
  async execute({ args, ctx, host, services }) {
    const imp = await host.call('footage.importToComp', { compId: ctx.comp.id, path: args.path, name: args.name || undefined, fit: args.fit, atTime: ctx.comp.time });
    await host.call('layers.setSelection', { label: 'MOE: Select', items: [{ compId: ctx.comp.id, layerIds: [imp.layerId], mode: 'replace' }] });
    // Run the Screen Key tool's own steps on the new layer (the executor runs one tool at a time).
    const keyTool = services.registry.get('compositing.keySetup');
    const kctx = await services.executor.readContext();
    const kargs = { screen: 'green', cleanup: true, spill: true, choke: args.choke };
    let key;
    try {
      const prep = keyTool.prepare(kargs, kctx);
      if (!prep.ok) throw new Error(prep.error);
      const kres = await keyTool.execute({ args: kargs, ctx: kctx, prepared: prep, host, services });
      const kv = keyTool.verify({ args: kargs, ctx: kctx, prepared: prep, result: kres });
      key = { ok: kv.ok, checks: kv.checks };
    } catch (e) {
      await host.call('footage.remove', { compId: ctx.comp.id, layerId: imp.layerId, itemId: imp.itemId });
      throw new Error(`Imported, but keying failed: ${e.message} The import was removed.`);
    }
    return { imp, key };
  },
  verify({ result }) {
    return { ok: result.key.ok, checks: [{ ok: true, label: result.imp.name, detail: `${result.imp.width}×${result.imp.height}${result.imp.duration ? ` · ${result.imp.duration.toFixed(2)}s` : ''} · scale ${Math.round(result.imp.scale)}%` }, ...result.key.checks] };
  },
  checkpoint({ result, ctx }) { return { compId: ctx.comp.id, layerId: result.imp.layerId, itemId: result.imp.itemId }; },
  async restore({ data, host }) { return host.call('footage.remove', data); },
  summarize(result) { return `${result.imp.name} imported and keyed`; }
};

module.exports = { greenPrompt, importKey, enforce, SCREEN, PROVIDERS, RULES };
